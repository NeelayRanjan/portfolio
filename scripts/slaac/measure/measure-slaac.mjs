// Task 15: real-browser timing of Figure 3 (the SLAAC rerouter) in
// Playwright's own browsers, against a production build (default :3100, set
// BASE to change it). Hand-run; see README.md here. Usage:
//   node scripts/slaac/measure/measure-slaac.mjs <firefox|chromium|webkit> <a|b|c|d> [desktop|phone] [runs] [headed|headless]
// Scenarios: a = KJFK-KMIA past all six launch sites; b = a plus a drawn box
// over the Southeast; c = KJFK-KMIA, launch sites off, a box over Nevada (no
// conflict); d = KCLT-KSAN, launch sites plus the Southeast box (the heaviest
// library case). CHROMIUM=/path/to/chrome swaps in another Chromium binary.
// ⚠️ Playwright's Firefox runs this model ~7x slower than stock Firefox: use
// measure-sysff.mjs for the Firefox number.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(join(REPO, "package.json"));
const pw = require("playwright");
const { toScreen } = await import(join(REPO, "components/figures/reroute-map.ts"));
// Scenario pairs by name, resolved against the served library's own order,
// so a regenerated routes.json can't silently point a scenario at another pair.
const PAIR_OF = { a: "KJFK-KMIA", b: "KJFK-KMIA", c: "KJFK-KMIA", d: "KCLT-KSAN" };
const routesLib = JSON.parse(readFileSync(join(REPO, "public/slaac/routes.json"), "utf8"));
const pairIndex = (name) => {
  const i = routesLib.pairs.findIndex((p) => `${p.origin}-${p.dest}` === name);
  if (i < 0) throw new Error(`${name} is not in public/slaac/routes.json`);
  return String(i);
};


const BASE = process.env.BASE ?? "http://localhost:3100";
const [engine = "firefox", scenario = "a", form = "desktop", runsArg = "3", mode = "headed"] = process.argv.slice(2);
const RUNS = Number(runsArg);
const viewport = form === "phone" ? { width: 400, height: 800 } : { width: 1280, height: 900 };

const launchOpts = { headless: mode !== "headed" };
if (engine === "chromium" && process.env.CHROMIUM) launchOpts.executablePath = process.env.CHROMIUM;
const browser = await pw[engine].launch(launchOpts);

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
        window.__m.msgs.push({ kind: d.kind, t: performance.now(), step: d.step ?? null, steps: d.steps ?? null, n: d.arcs?.length ?? null, ms: d.ms ?? null, arcs: d.kind === "done" ? d.arcs : null });
      });
    }
    postMessage(msg, ...r) {
      if (msg?.kind === "load" && msg.navaids) { this.__slaac = true; window.__m.loadSent = performance.now(); }
      if (msg?.kind === "reroute") window.__m.req = { batchCap: msg.batchCap, steps: msg.steps, flights: msg.flights.length, rings: msg.rings.length, t: performance.now() };
      return super.postMessage(msg, ...r);
    }
  };
}

const status = (page) => page.evaluate(() => JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus));
async function waitState(page, states, timeout = 300000) {
  await page.waitForFunction((s) => {
    const el = document.querySelector("[data-reroute-status]");
    return !!el && s.includes(JSON.parse(el.dataset.rerouteStatus).state);
  }, states, { timeout });
}
async function open(page) {
  await page.locator("[data-nasa-notes]").scrollIntoViewIfNeeded();
  for (let i = 0; i < 8 && !(await page.locator("[data-reroute-pair]").count()); i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(150);
  }
  await waitState(page, ["idle"], 30000);
  await page.evaluate(() => document.querySelector("[data-reroute-figure] canvas").scrollIntoView({ block: "center" }));
}
async function view(page) {
  const { box, v, dpr } = await page.evaluate(() => {
    const c = document.querySelector("[data-reroute-figure] canvas");
    const r = c.getBoundingClientRect();
    return { box: { x: r.x, y: r.y, w: r.width, h: r.height }, v: window.__slaac.view, dpr: c.width / r.width };
  });
  return { box, view: { w: box.w, h: box.h, dpr, ...v } };
}
async function wholeUs(page) {
  await page.locator("[data-reroute-view] button").last().click();
  await page.waitForFunction(() => JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus).view?.mode === "us");
  await page.waitForTimeout(600);
}
async function clickLL(page, lat, lon) {
  const { box, view: v } = await view(page);
  const [x, y] = toScreen(v, lat, lon);
  await page.mouse.click(box.x + x, box.y + y);
}
async function drawRing(page, ring) {
  await page.locator("[data-reroute-draw]").click();
  for (const p of ring) await clickLL(page, ...p);
  await clickLL(page, ...ring[0]);
  const ok = await page.evaluate(() => !document.querySelector("[data-reroute-close]") && !document.querySelector("[data-reroute-clear]").disabled);
  if (!ok) throw new Error("ring didn't close");
}

// A large polygon over the Southeast (GA, the Carolinas, east TN, north FL's
// edge), clear of both KJFK and KMIA.
const SOUTHEAST = [[36.5, -90], [36.5, -75.5], [30, -80.5], [30, -90]];
// Central Nevada: a continent away from KJFK-KMIA.
const NEVADA = [[40, -118], [40, -115], [37, -115], [37, -118]];

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

const results = [];
for (let run = 0; run < RUNS; run++) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route("**/api/iss-tle", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tle: null, fetchedAt: new Date().toISOString() }) }));
  const page = await ctx.newPage();
  await page.addInitScript(spy);
  const reqs = [];
  page.on("requestfinished", async (req) => {
    const u = req.url();
    if (!/\/models\/flightdiff-|\/ort\//.test(u)) return;
    const timing = req.timing();
    let bytes = null;
    try { bytes = (await req.sizes()).responseBodySize; } catch {}
    let cl = null;
    try { cl = (await req.response())?.headers()["content-length"] ?? null; } catch {}
    reqs.push({ url: u.replace(BASE, ""), method: req.method(), startEpoch: timing.startTime, dur: timing.responseEnd, bytes, cl });
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await open(page);
  await page.selectOption("[data-reroute-pair]", pairIndex(PAIR_OF[scenario]));
  if (scenario === "c") await page.locator("[data-reroute-launch]").uncheck(); else await page.locator("[data-reroute-launch]").check();
  if (scenario === "b" || scenario === "d") { await wholeUs(page); await drawRing(page, SOUTHEAST); }
  if (scenario === "c") { await wholeUs(page); await drawRing(page, NEVADA); }
  await page.waitForTimeout(1500);
  const before = reqs.length;
  const pressEpoch = Date.now();
  await page.locator("[data-reroute-go]").click();
  await waitState(page, ["done", "no-conflict", "unavailable", "failed"]);
  await page.waitForTimeout(300);
  const st = await status(page);
  const m = await page.evaluate(() => window.__m);
  const iso = await page.evaluate(() => ({ pairVal: document.querySelector("[data-reroute-pair]").value, launch: document.querySelector("[data-reroute-launch]").checked, coi: crossOriginIsolated, hc: navigator.hardwareConcurrency, ua: navigator.userAgent }));
  const model = reqs.filter((r) => /flightdiff/.test(r.url) && r.method === "GET");
  const prog = m.msgs.filter((x) => x.kind === "progress");
  const loaded = m.msgs.find((x) => x.kind === "loaded");
  const done = m.msgs.find((x) => x.kind === "done");
  const ints = [];
  if (m.req && prog.length) {
    ints.push({ from: "req", dt: prog[0].t - m.req.t, steps: prog[0].step });
    for (let i = 1; i < prog.length; i++) ints.push({ dt: prog[i].t - prog[i - 1].t, steps: prog[i].step - prog[i - 1].step, n: prog[i].n });
  }
  // Forward passes per interval: progress fires at odd step indexes and the
  // last, i.e. step numbers 2,4,...,20 per chunk; within a chunk each interval
  // covers 2 forwards.
  const within = ints.slice(1).filter((x) => x.steps === 2);
  const perFwd = within.map((x) => x.dt / 2);
  const r = {
    run, engine, scenario, form, pairVal: iso.pairVal, launch: iso.launch, rings: m.req?.rings ?? null, ua: iso.ua, coi: iso.coi, hc: iso.hc,
    state: st.state, arcs: st.arcs, batchCap: m.req?.batchCap ?? null, flights: st.flights.length,
    statuses: st.flights.map((f) => f.status).join(","),
    pressToDone: (done ? done.t : m.msgs.at(-1)?.t ?? NaN) - m.press,
    pressToState: Date.now() - pressEpoch,
    pressToLoaded: loaded ? loaded.t - m.press : null,
    loadToReq: m.req && loaded ? m.req.t - loaded.t : null,
    workerMs: done?.ms ?? null,
    model: model.map((x) => ({ bytes: x.bytes, cl: x.cl, dur: Math.round(x.dur) })),
    modelReqs: reqs.filter((x) => /flightdiff/.test(x.url)).length,
    ortAfterPress: reqs.slice(before).filter((x) => /\/ort\//.test(x.url)).map((x) => `${x.url} ${x.bytes ?? x.cl} ${Math.round(x.dur)}ms`),
    progressN: prog.length,
      pressToSettled: (() => { const x = m.states.find((q) => q.t > m.press && ["done", "no-conflict", "unavailable", "failed"].includes(q.s)); return x ? x.t - m.press : null; })(),
      states: m.states.filter((q) => q.t >= m.press).map((q) => `${q.s}@${Math.round(q.t - m.press)}`).join(" "),
    firstProgressFromReq: ints[0]?.dt ?? null,
    perFwdMedian: median(perFwd), perFwdMin: perFwd.length ? Math.min(...perFwd) : null, perFwdMax: perFwd.length ? Math.max(...perFwd) : null,
    maxInterval: ints.length ? Math.max(...ints.map((x) => x.dt)) : null,
    intervals: ints.map((x) => Math.round(x.dt)),
  };
  results.push(r);
  console.log(JSON.stringify(r));
  await ctx.close();
}
await browser.close();
const pick = (k) => results.map((r) => r[k]).filter((x) => typeof x === "number");
const sum = (k) => { const xs = pick(k); return xs.length ? `${median(xs).toFixed(0)} [${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)}]` : "n/a"; };
console.log(`SUMMARY ${engine} ${scenario} ${form}: pressToDone ${sum("pressToDone")} | pressToSettled ${sum("pressToSettled")} | pressToLoaded ${sum("pressToLoaded")} | workerMs ${sum("workerMs")} | perFwd ${sum("perFwdMedian")} | maxInterval ${sum("maxInterval")} | firstProgress ${sum("firstProgressFromReq")} | pressToState ${sum("pressToState")}`);
