#!/usr/bin/env python3
"""
Drive Figure 3 (the SLAAC rerouter) in WebKitGTK and watch the web process's
memory and CPU. The SLAAC twin of scripts/probe-webkit-draw.py.

HAND-RUN, never wired to a build: it needs the system WebKitGTK 4.1 with the
python gi bindings (Fedora: webkit2gtk4.1, python3-gobject) and a display.
Headless Firefox can't stand in for it: JavaScriptCore is the engine behind
every WebKit browser (iOS Safari, and Chrome and Firefox on iOS too), and its
optimizing wasm tier is where the 2026-09-16 iPhone crash loop lived.

    npm run build && npx next start -p 3100     # the prod build, another shell
    WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
      GDK_BACKEND=x11 python3 scripts/slaac/measure/probe-webkit-slaac.py http://localhost:3100/ label [idle_s]

It loads the page, scrolls the NASA box in until Figure 3 mounts, picks the
pair (env PAIR, the <select>'s option value, i.e. the pair's index in
public/slaac/routes.json; default 1, KJFK-KMIA), turns the launch sites on,
presses reroute, waits for the run to settle, then samples the newest
WebKitWebProcess's RSS and CPU once a second through `idle_s` seconds of
nothing (default 60). It prints press-to-done and the worker's messages.

Measured 2026-09-30 (Task 15, WebKitGTK 2.52.5): KJFK-KMIA past the launch
sites, 3 arcs, 8.3 s press to done, ~330 ms per forward; idle afterwards flat
at ~600-850 MB and ~97% CPU (the sky's render floor under software
rendering), no runaway. A regression looks like the draw probe's asyncify
row: CPU pinned across several cores and RSS climbing by gigabytes at idle.
"""
import gi, sys, time, os, json
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

if len(sys.argv) < 3:
    print(__doc__); sys.exit(2)
URL, LABEL = sys.argv[1], sys.argv[2]
PAIR = os.environ.get("PAIR", "1")
IDLE = int(sys.argv[3]) if len(sys.argv) > 3 else 60

DRIVER = r"""
(() => {
  if (window.__probe) return;
  const P = window.__probe = { stage: "start", t0: performance.now(), log: [], msgs: [] };
  const mark = (s) => { P.stage = s; P.log.push([s, Math.round(performance.now() - P.t0)]); };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms) => { const t = performance.now(); while (performance.now() - t < ms) { const v = fn(); if (v) return v; await sleep(100); } return null; };
  const Real = window.Worker;
  window.Worker = class extends Real {
    constructor(...a) { super(...a); this.addEventListener("message", (e) => { const d = e.data; if (this.__slaac && d && typeof d === "object") P.msgs.push([d.kind, Math.round(performance.now() - P.t0), d.step ?? null]); }); }
    postMessage(m, ...r) { if (m?.kind === "load" && m.navaids) this.__slaac = true; if (m?.kind === "reroute") P.req = Math.round(performance.now() - P.t0); return super.postMessage(m, ...r); }
  };
  const state = () => { const el = document.querySelector("[data-reroute-status]"); return el ? JSON.parse(el.dataset.rerouteStatus) : null; };
  (async () => {
    document.querySelector("[data-nasa-notes]").scrollIntoView({ block: "center" });
    if (!await until(() => document.querySelector("[data-reroute-pair]"), 30000)) return mark("no-figure");
    if (!await until(() => state()?.state === "idle", 30000)) return mark("no-idle");
    document.querySelector("[data-reroute-figure] canvas").scrollIntoView({ block: "center" });
    const s = document.querySelector("[data-reroute-pair]");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "PAIR");
    s.dispatchEvent(new Event("change", { bubbles: true }));
    const c = document.querySelector("[data-reroute-launch]"); if (!c.checked) c.click();
    await sleep(1500);
    P.pair = s.value;
    mark("press");
    P.press = Math.round(performance.now() - P.t0);
    document.querySelector("[data-reroute-go]").click();
    const end = await until(() => ["done", "no-conflict", "unavailable", "failed"].includes(state()?.state) && state(), 600000);
    if (!end) return mark("reroute-timeout");
    P.end = Math.round(performance.now() - P.t0);
    P.result = { state: end.state, arcs: end.arcs, ms: end.ms, statuses: end.flights.map(f => f.status).join(","), coi: crossOriginIsolated, hc: navigator.hardwareConcurrency };
    mark(end.state);
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
        GLib.timeout_add(1500, lambda: (js(DRIVER.replace("PAIR", PAIR), lambda v: None), False)[1])

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
    js("JSON.stringify(window.__probe && {log: window.__probe.log, press: window.__probe.press, req: window.__probe.req, end: window.__probe.end, pair: window.__probe.pair, result: window.__probe.result, msgs: window.__probe.msgs})", lambda v: (print("stages:", v.to_string()), Gtk.main_quit()))
    GLib.timeout_add(2000, Gtk.main_quit)

wv.connect("load-changed", on_load)
T0 = time.time()
wv.load_uri(URL)
GLib.timeout_add(1000, tick)
Gtk.main()
