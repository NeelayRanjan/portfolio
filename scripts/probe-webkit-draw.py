#!/usr/bin/env python3
"""
Drive the draw demo in WebKitGTK and watch the web process's memory and CPU.

HAND-RUN, never wired to a build: it needs the system WebKitGTK 4.1 with the
python gi bindings (Fedora: webkit2gtk4.1, python3-gobject) and a display.
Headless Firefox can't stand in for it: this probe exists because the bug it
guards against lives in JavaScriptCore's optimizing wasm tier, the engine
behind every WebKit browser (iOS Safari, and Chrome and Firefox on iOS too).

    npm run build && npm start        # the prod build on :3000, in another shell
    WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
      GDK_BACKEND=x11 python3 scripts/probe-webkit-draw.py http://localhost:3000/ label [idle_s]

It loads the page, scrolls until the deferred draw figure mounts (which also
reaches the chess figure and loads its worker), draws one stroke through
synthetic pointer events, waits for the classify's fit scores, presses
generate, waits for it to finish, then samples the WebKitWebProcess's RSS and
CPU once a second through `idle_s` seconds of nothing (default 60). The
number that matters is what happens in that idle stretch.

WHY (2026-09-16): the site imported `onnxruntime-web/webgpu` for every model,
and in ORT 1.27 that entry always fetches the `asyncify` wasm build, whatever
provider is requested. JavaScriptCore's OMG tier runs away on that build
(microsoft/onnxruntime issue 26827: looping in B3's stack allocator), which is
what crashed the draw demo on every iPhone and put Safari into its "a problem
repeatedly occurred" loop on reload. Measured here, WebKitGTK 2.52.5 on a
16-core desktop, one stroke + classify + generate, then 60 s idle:

    build                          peak RSS   idle RSS first -> last   idle CPU
    /webgpu entry (asyncify)       11489 MB   5328 -> 11489 MB         ~395%
    /wasm entry (plain build)        891 MB    802 ->   790 MB          ~96%

The ~96% is the page's own render loop under software rendering (it reads
the same before any model loads) and is not the bug. A healthy run holds
its idle RSS within a few percent and its idle CPU near that floor; a
regression looks like the first row: CPU pinned across several cores and
RSS climbing by gigabytes while nothing happens.

Re-run after bumping onnxruntime-web, changing which entry any loader
imports, or changing what scripts/sync-ort.mjs copies.
"""
import gi, sys, time, os, json
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

if len(sys.argv) < 3:
    print(__doc__); sys.exit(2)
URL, LABEL = sys.argv[1], sys.argv[2]
IDLE = int(sys.argv[3]) if len(sys.argv) > 3 else 60

DRIVER = r"""
(() => {
  if (window.__probe) return;
  const P = window.__probe = { stage: "start", t0: performance.now(), log: [] };
  const mark = (s) => { P.stage = s; P.log.push([s, Math.round(performance.now() - P.t0)]); };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms) => { const t = performance.now(); while (performance.now() - t < ms) { const v = fn(); if (v) return v; await sleep(200); } return null; };
  (async () => {
    // scroll down until the deferred draw figure mounts its canvas
    let canvas = null;
    for (let y = 0; y < document.body.scrollHeight && !canvas; y += 300) {
      window.scrollTo(0, y); await sleep(120);
      canvas = document.querySelector('#fig-draw canvas');
    }
    if (!canvas) return mark("no-canvas");
    canvas.scrollIntoView({ block: "center" }); await sleep(400);
    mark("canvas");
    // synthetic pointers have no active pointerId; capture would throw NotFoundError
    HTMLCanvasElement.prototype.setPointerCapture = function () {};
    const r = canvas.getBoundingClientRect();
    const ev = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: r.x + x, clientY: r.y + y }));
    const x0 = r.width * 0.35, y0 = r.height * 0.35;
    ev("pointerdown", x0, y0);
    for (let i = 1; i <= 8; i++) { ev("pointermove", x0 + r.width * 0.3 * i / 8, y0 + r.height * 0.3 * i / 8); await sleep(16); }
    ev("pointerup", x0 + r.width * 0.3, y0 + r.height * 0.3);
    mark("stroke");
    const fit = await until(() => document.querySelector('#fig-draw button[aria-label*="fits your drawing"]'), 240000);
    if (!fit) return mark("classify-timeout");
    mark("classified");
    const gen = [...document.querySelectorAll('#fig-draw button')].find(b => b.textContent.trim() === "generate");
    if (!gen) return mark("no-generate");
    await until(() => !gen.disabled, 20000);
    gen.click();
    await until(() => gen.disabled, 5000);
    mark("generating");
    const done = await until(() => !gen.disabled, 240000);
    mark(done ? "generated" : "generate-timeout");
    await sleep(1000); mark("idle");
  })().catch(e => mark("error:" + e.message));
})();
"""

def webproc():
    # WebKitGTK wraps the web process in bwrap, so it is not a child of this
    # process; take the WebKitWebProcess started most recently. /proc/comm is
    # truncated to 15 characters, hence the prefix match.
    best = None; best_start = -1
    for d in os.listdir("/proc"):
        if not d.isdigit(): continue
        try:
            if not open(f"/proc/{d}/comm").read().strip().startswith("WebKitWebProc"): continue
            start = int(open(f"/proc/{d}/stat").read().rsplit(")", 1)[1].split()[19])
        except Exception:
            continue
        if start > best_start: best, best_start = int(d), start
    return best

def sample(pid):
    rss = 0; cpu = 0
    try:
        for line in open(f"/proc/{pid}/status"):
            if line.startswith("VmRSS:"): rss = int(line.split()[1]) // 1024
        st = open(f"/proc/{pid}/stat").read().rsplit(")", 1)[1].split()
        cpu = (int(st[11]) + int(st[12])) / os.sysconf("SC_CLK_TCK")
    except Exception:
        pass
    return rss, cpu

win = Gtk.Window(); win.set_default_size(1280, 900); win.set_keep_below(True)
wv = WebKit2.WebView(); win.add(wv); win.show_all()
state = {"stage": "loading", "rows": [], "last": None, "idle_since": None, "peak": 0}

def js(code, cb):
    wv.evaluate_javascript(code, -1, None, None, None, lambda v, r, u: cb(v.evaluate_javascript_finish(r)), None)

def on_load(view, ev):
    if ev == WebKit2.LoadEvent.FINISHED and state["stage"] == "loading":
        state["stage"] = "loaded"
        GLib.timeout_add(1500, lambda: (js(DRIVER, lambda v: None), False)[1])

def tick():
    pid = webproc()
    if pid:
        rss, cpu = sample(pid)
        now = time.time()
        pct = 0
        if state["last"]:
            lt, lcpu = state["last"]; pct = 100 * (cpu - lcpu) / max(1e-6, now - lt)
        state["last"] = (now, cpu)
        state["peak"] = max(state["peak"], rss)
        state["rows"].append((round(now - T0), state["stage"], rss, round(pct)))
        print(f"{round(now - T0):4d}s {state['stage']:<18} rss={rss:5d}MB cpu={round(pct):4d}%", flush=True)
    def got(v):
        try:
            s = v.to_string()
            if s and s != "undefined":
                st = json.loads(s)["stage"]
                if st != state["stage"]:
                    state["stage"] = st
                    if st == "idle" or st.endswith("timeout") or st.startswith("error") or st.startswith("no-"):
                        state["idle_since"] = time.time()
        except Exception:
            pass
    js("JSON.stringify(window.__probe || null)", got)
    if state["idle_since"] and time.time() - state["idle_since"] > IDLE:
        finish(); return False
    if time.time() - T0 > 600:
        finish(); return False
    return True

def finish():
    rows = state["rows"]
    idle = [r for r in rows if r[1] == "idle"]
    print(f"\n== {LABEL}: peak rss {state['peak']}MB; idle samples {len(idle)}; "
          f"idle rss first/last {idle[0][2] if idle else '-'}/{idle[-1][2] if idle else '-'}MB; "
          f"idle cpu mean {round(sum(r[3] for r in idle)/max(1,len(idle)))}%; final stage {state['stage']}")
    js("JSON.stringify(window.__probe && window.__probe.log)", lambda v: (print("stages:", v.to_string()), Gtk.main_quit()))
    GLib.timeout_add(2000, Gtk.main_quit)

wv.connect("load-changed", on_load)
T0 = time.time()
wv.load_uri(URL)
GLib.timeout_add(1000, tick)
Gtk.main()
