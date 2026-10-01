// Task 15: the same Figure 3 timing in a STOCK Firefox (not Playwright's
// Juggler build), driven over WebDriver BiDi, a fresh profile (cold cache) per
// run, headed. Hand-run; see README.md here. Usage:
//   node scripts/slaac/measure/measure-sysff.mjs <a|b|c|d|all> [desktop|phone] [runs]
// "all" (Task 12c): every library route in one press, launch sites on, no drawn box.
// Scenarios as in measure-slaac.mjs. Env: BASE (default http://localhost:3100),
// FIREFOX (default /usr/bin/firefox), DISPLAY (default :0), SCRATCH (where the
// throwaway profiles go, default the OS tmpdir). This is the script behind the
// Firefox numbers in CLAUDE.md's SLAAC "Measured" bullet.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const { toScreen } = await import(join(REPO, "components/figures/reroute-map.ts"));
const BASE = process.env.BASE ?? "http://localhost:3100";
const FIREFOX = process.env.FIREFOX ?? "/usr/bin/firefox";
const DISPLAY = process.env.DISPLAY || ":0";
// Scenario pairs by name, resolved against the served library's own order,
// so a regenerated routes.json can't silently point a scenario at another pair.
const PAIR_OF = { a: "KJFK-KMIA", b: "KJFK-KMIA", c: "KJFK-KMIA", d: "KCLT-KSAN", all: null };
const routesLib = JSON.parse(readFileSync(join(REPO, "public/slaac/routes.json"), "utf8"));
const pairIndex = (name) => {
  if (name === null) return "-1"; // Task 12c: the picker's "all flights" entry
  const i = routesLib.pairs.findIndex((p) => `${p.origin}-${p.dest}` === name);
  if (i < 0) throw new Error(`${name} is not in public/slaac/routes.json`);
  return String(i);
};

const [scenario = "a", form = "desktop", runsArg = "3"] = process.argv.slice(2);
const RUNS = Number(runsArg);
const SCRATCH = process.env.SCRATCH ?? tmpdir();
const W = form === "phone" ? 400 : 1280, H = form === "phone" ? 800 : 900;

function spy() {
  const Real = window.Worker;
  window.__m = { press: null, msgs: [], req: null, states: [] };
  new MutationObserver((recs) => {
    for (const r of recs) {
      const v = r.target.getAttribute && r.target.getAttribute("data-reroute-status");
      if (!v) continue;
      const s = JSON.parse(v).state;
      const last = window.__m.states.at(-1);
      if (!last || last.s !== s) window.__m.states.push({ s, t: performance.now() });
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-reroute-status"] });
  document.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-reroute-go]")) window.__m.press = performance.now();
  }, true);
  window.Worker = class extends Real {
    constructor(...a) {
      super(...a);
      this.addEventListener("message", (e) => {
        const d = e.data;
        if (!this.__slaac || !d || typeof d !== "object") return;
        window.__m.msgs.push({ kind: d.kind, t: performance.now(), step: d.step ?? null, ms: d.ms ?? null });
      });
    }
    postMessage(msg, ...r) {
      if (msg?.kind === "load" && msg.navaids) this.__slaac = true;
      if (msg?.kind === "reroute") window.__m.req = { batchCap: msg.batchCap, rings: msg.rings.length, t: performance.now() };
      return super.postMessage(msg, ...r);
    }
  };
}

const SOUTHEAST = [[36.5, -90], [36.5, -75.5], [30, -80.5], [30, -90]];
const NEVADA = [[40, -118], [40, -115], [37, -115], [37, -118]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

async function oneRun(run) {
  const prof = mkdtempSync(join(SCRATCH, "ffprof-"));
  writeFileSync(join(prof, "user.js"), [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("trailhead.firstrun.didSeeAboutWelcome", true);',
  ].join("\n"));
  const port = 9300 + run;
  const ff = spawn(FIREFOX, ["--new-instance", "--no-remote", "--profile", prof, `--remote-debugging-port=${port}`, `--width=${W}`, `--height=${H + 100}`, "about:blank"], { env: { ...process.env, DISPLAY, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let wsUrl = null;
  const onOut = (b) => { const m = String(b).match(/WebDriver BiDi listening on (ws:\/\/\S+)/); if (m) wsUrl = m[1]; };
  ff.stdout.on("data", onOut); ff.stderr.on("data", onOut);
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(200);
  if (!wsUrl) throw new Error("no BiDi url");
  const ws = new WebSocket(`${wsUrl}/session`);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id != null && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.type === "error" ? p.j(new Error(`${m.error}: ${m.message}`)) : p.r(m.result); }
    else if (m.type === "event") events.push({ ...m, at: Date.now() });
  };
  const cmd = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  try {
    await cmd("session.new", { capabilities: {} });
    const tree = await cmd("browsingContext.getTree", {});
    const context = tree.contexts[0].context;
    await cmd("browsingContext.setViewport", { context, viewport: { width: W, height: H } });
    await cmd("session.subscribe", { events: ["network.responseCompleted"] });
    await cmd("script.addPreloadScript", { functionDeclaration: `() => { (${spy.toString()})(); }` });
    const ev = async (expr) => {
      const r = await cmd("script.evaluate", { expression: expr, target: { context }, awaitPromise: true, resultOwnership: "none" });
      if (r.type === "exception") throw new Error(`page: ${r.exceptionDetails.text}`);
      return r.result.type === "string" ? JSON.parse(r.result.value) : r.result.value;
    };
    const json = (expr) => ev(`(async () => JSON.stringify(await (${expr})))()`);
    await cmd("browsingContext.navigate", { context, url: BASE, wait: "complete" });
    await sleep(2500);
    const until = async (expr, timeout = 300000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) { if (await json(expr)) return; await sleep(100); }
      throw new Error(`timeout: ${expr}`);
    };
    await json(`(async () => { document.querySelector("[data-nasa-notes]").scrollIntoView({block:"center"}); return true; })()`);
    await until(`!!document.querySelector("[data-reroute-pair]")`);
    const stateIs = (s) => `(() => { const el = document.querySelector("[data-reroute-status]"); return !!el && ${JSON.stringify(s)}.includes(JSON.parse(el.dataset.rerouteStatus).state); })()`;
    await until(stateIs(["idle"]));
    await json(`(async () => { document.querySelector("[data-reroute-figure] canvas").scrollIntoView({block:"center"}); return true; })()`);
    // React needs the native setter and a change event.
    await json(`(async () => { const s = document.querySelector("[data-reroute-pair]"); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, ${JSON.stringify(pairIndex(PAIR_OF[scenario]))}); s.dispatchEvent(new Event("change", {bubbles:true})); return true; })()`);
    await sleep(500);
    await json(`(async () => { const c = document.querySelector("[data-reroute-launch]"); if (c.checked !== ${scenario !== "c"}) c.click(); return true; })()`);
    if (scenario !== "a" && scenario !== "all") {
      await json(`(async () => { document.querySelectorAll("[data-reroute-view] button")[1].click(); return true; })()`);
      await sleep(800);
      await json(`(async () => { document.querySelector("[data-reroute-draw]").click(); return true; })()`);
      await sleep(200);
      const ring = scenario === "c" ? NEVADA : SOUTHEAST;
      for (const p of [...ring, ring[0]]) {
        const { box, v, dpr } = await json(`(async () => { const c = document.querySelector("[data-reroute-figure] canvas"); const r = c.getBoundingClientRect(); return { box: {x:r.x,y:r.y,w:r.width,h:r.height}, v: window.__slaac.view, dpr: c.width / r.width }; })()`);
        const [x, y] = toScreen({ w: box.w, h: box.h, dpr, ...v }, p[0], p[1]);
        const cx = Math.round(box.x + x), cy = Math.round(box.y + y);
        await cmd("input.performActions", { context, actions: [{ type: "pointer", id: "mouse", parameters: { pointerType: "mouse" }, actions: [
          { type: "pointerMove", x: cx, y: cy }, { type: "pointerDown", button: 0 }, { type: "pointerUp", button: 0 }] }] });
        await sleep(150);
      }
      const ok = await json(`(async () => !document.querySelector("[data-reroute-close]") && !document.querySelector("[data-reroute-clear]").disabled)()`);
      if (!ok) throw new Error("ring didn't close");
    }
    await sleep(1500);
    const evStart = events.length;
    await json(`(async () => { document.querySelector("[data-reroute-go]").click(); return true; })()`);
    await until(stateIs(["done", "no-conflict", "unavailable", "failed"]));
    await sleep(300);
    const out = await json(`(async () => ({ st: JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus), m: window.__m, coi: crossOriginIsolated, hc: navigator.hardwareConcurrency, ua: navigator.userAgent, pairVal: document.querySelector("[data-reroute-pair]").value, launch: document.querySelector("[data-reroute-launch]").checked }))()`);
    const net = events.slice(evStart).filter((e) => e.method === "network.responseCompleted").map((e) => e.params)
      .filter((p) => /flightdiff|\/ort\//.test(p.request.url))
      .map((p) => ({ url: p.request.url.replace(BASE, ""), method: p.request.method, bytes: p.response.bytesReceived, dur: Math.round((p.request.timings?.responseEnd ?? 0) - (p.request.timings?.requestTime ?? 0)) }));
    const { st, m } = out;
    const prog = m.msgs.filter((x) => x.kind === "progress");
    const loaded = m.msgs.find((x) => x.kind === "loaded");
    const done = m.msgs.find((x) => x.kind === "done");
    const ints = [];
    if (m.req && prog.length) {
      ints.push({ dt: prog[0].t - m.req.t, steps: prog[0].step });
      for (let i = 1; i < prog.length; i++) ints.push({ dt: prog[i].t - prog[i - 1].t, steps: prog[i].step - prog[i - 1].step });
    }
    const perFwd = ints.slice(1).filter((x) => x.steps === 2).map((x) => x.dt / 2);
    return {
      run, engine: "system-firefox", scenario, form, pairVal: out.pairVal, launch: out.launch, ua: out.ua, coi: out.coi, hc: out.hc,
      rings: m.req?.rings ?? null, state: st.state, arcs: st.arcs, batchCap: m.req?.batchCap ?? null, flights: st.flights.length,
      statuses: st.flights.map((f) => f.status).join(","),
      pressToDone: (done ? done.t : NaN) - m.press,
      pressToLoaded: loaded ? loaded.t - m.press : null,
      workerMs: done?.ms ?? null,
      net,
      progressN: prog.length,
      pressToSettled: (() => { const x = m.states.find((q) => q.t > m.press && ["done", "no-conflict", "unavailable", "failed"].includes(q.s)); return x ? x.t - m.press : null; })(),
      states: m.states.filter((q) => q.t >= m.press).map((q) => `${q.s}@${Math.round(q.t - m.press)}`).join(" "),
      perFwdMedian: median(perFwd), perFwdMax: perFwd.length ? Math.max(...perFwd) : null,
      maxInterval: ints.length ? Math.max(...ints.map((x) => x.dt)) : null,
      intervals: ints.map((x) => Math.round(x.dt)),
    };
  } finally {
    try { await cmd("browser.close", {}); } catch {}
    ws.close();
    await sleep(1000);
    try { ff.kill("SIGTERM"); } catch {}
    await sleep(500);
    rmSync(prof, { recursive: true, force: true });
  }
}

const results = [];
for (let run = 0; run < RUNS; run++) {
  const r = await oneRun(run);
  results.push(r);
  console.log(JSON.stringify(r));
}
const pick = (k) => results.map((r) => r[k]).filter((x) => typeof x === "number" && Number.isFinite(x));
const sum = (k) => { const xs = pick(k); return xs.length ? `${median(xs).toFixed(0)} [${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)}]` : "n/a"; };
console.log(`SUMMARY system-firefox ${scenario} ${form}: pressToDone ${sum("pressToDone")} | pressToSettled ${sum("pressToSettled")} | pressToLoaded ${sum("pressToLoaded")} | workerMs ${sum("workerMs")} | perFwd ${sum("perFwdMedian")} | maxInterval ${sum("maxInterval")}`);
