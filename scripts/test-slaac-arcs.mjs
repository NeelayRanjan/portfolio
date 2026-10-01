// node --test scripts/test-slaac-arcs.mjs
// Arc planning, batching and the worker's pipeline (lib/slaac/arcs.ts,
// lib/slaac/run.ts). The real-model cases drive the served ONNX graph through
// onnxruntime-web/wasm in node, one thread, exactly as test-slaac-sampler does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as A from "../lib/slaac/arcs.ts";
import { runReroute, RunCancelled, rerouteOpts } from "../lib/slaac/run.ts";
import { makeMacrotaskYield } from "../lib/slaac/yield.ts";
import * as R from "../lib/slaac/reroute.ts";
import * as S from "../lib/slaac/sampler.ts";
import { normalNoise } from "../lib/slaac/rng.ts";
import { Navaids } from "../lib/slaac/navaids.ts";
import { inverseAlbers } from "../lib/slaac/albers.ts";
import { loadSua } from "../lib/slaac/geometry.ts";

const require = createRequire(import.meta.url);
const meta = JSON.parse(readFileSync(new URL("../public/slaac/meta.json", import.meta.url)));
const V = JSON.parse(readFileSync(new URL("./slaac-vectors/reroute.json", import.meta.url)));
const wpdb = new Navaids(V.snap_table.names, V.snap_table.lat, V.snap_table.lon);
const C = meta.channels, N = meta.sample_size;

const optsFor = (hug, margin) => ({ wpdb, lockDistNm: 10, snapTolNm: 100, devSpacingNm: 150, rdpTolNm: 10, hug, hugMarginNm: margin, clearMarginNm: margin });
const flightsOf = (cases) => cases.map((c) => ({ id: c.label.split(" ")[0], nominal: c.nominal }));
// The vectors carry polygons in metres; the wire carries lat/lon rings.
const ringsOf = (polysM) => polysM.map((P) => P.map(([x, y]) => inverseAlbers(x, y)));
const maxAbs = (a, b) => {
  assert.equal(a.length, b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};
// A polygon over the Gulf of Alaska: nowhere near any vector route.
const FAR_RING = [[55, -150], [56, -150], [56, -148], [55, -148]];

let session = null;
let modelCalls = 0;
async function realModel() {
  const ort = require("onnxruntime-web/wasm");
  if (!session) {
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(readFileSync(new URL(`../public/models/${meta.model}`, import.meta.url)));
  }
  return async ({ noisy, t, od, eh, sc, tid, B }) => {
    modelCalls++;
    const out = await session.run({
      noisy: new ort.Tensor("float32", noisy, [B, C, N]),
      t: new ort.Tensor("int64", BigInt64Array.from({ length: B }, () => BigInt(t)), [B]),
      od: new ort.Tensor("float32", od, [B, 4]), eh: new ort.Tensor("float32", eh, [B, 4]),
      sc: new ort.Tensor("float32", sc, [B, 6, N]), tid: new ort.Tensor("int64", tid, [B]) });
    return out.v.data;
  };
}
/** A deterministic stand-in for the UNet: fast, so pipeline plumbing can be
 *  tested without the model. Never used where a number must match the real one. */
function fakeModel(counter = { calls: 0 }) {
  return async ({ noisy, B }) => {
    counter.calls++;
    const v = new Float32Array(B * C * N);
    for (let k = 0; k < v.length; k++) v[k] = 0.3 * noisy[k];
    return v;
  };
}

// ---- (a), (b), (c): planning and chunking ---------------------------------

test("(a) planArcs returns exactly the calls localReroute makes, in order", () => {
  for (const c of V.local_reroute) {
    const opts = optsFor(c.hug, c.margin);
    const calls = [];
    let k = 0;
    R.localReroute(c.nominal, c.polys_m, (e, r) => { calls.push([...e, ...r]); return c.arcs[k++]; }, opts);
    const jobs = A.planArcs([{ id: "f", nominal: c.nominal }], c.polys_m, opts);
    assert.deepEqual(jobs.map((j) => [j.entry[1], j.entry[2], j.rejoin[1], j.rejoin[2]]), calls, c.label);
    assert.deepEqual(jobs.map((j) => [j.flight, j.index]), calls.map((_, i) => ["f", i]), c.label);
  }
  // Every flight of one policy in one call: flight order, then call order.
  for (const hug of [true, false]) for (const margin of [25, 40]) {
    const cases = V.local_reroute.filter((c) => c.hug === hug && c.margin === margin);
    const opts = optsFor(hug, margin);
    const jobs = A.planArcs(flightsOf(cases), cases[0].polys_m, opts);
    const want = cases.flatMap((c) => c.calls.map((x, i) => [c.label.split(" ")[0], i, ...x]));
    assert.deepEqual(jobs.map((j) => [j.flight, j.index, j.entry[1], j.entry[2], j.rejoin[1], j.rejoin[2]]), want);
  }
});

test("(b) a polygon far from every route plans no arcs", () => {
  const far = loadSua([FAR_RING]);
  for (const hug of [true, false]) {
    const cases = V.local_reroute.filter((c) => c.hug === hug && c.margin === 25);
    assert.deepEqual(A.planArcs(flightsOf(cases), far, optsFor(hug, 25)), []);
  }
  assert.deepEqual(A.planArcs(flightsOf(V.local_reroute.slice(0, 2)), [], optsFor(true, 25)), []);
});

test("(c) chunk", () => {
  assert.deepEqual(A.chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4), [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]]);
  assert.deepEqual(A.chunk([], 4), []);
  assert.deepEqual(A.chunk([1, 2], 4), [[1, 2]]);
  assert.throws(() => A.chunk([1], 0));
  assert.equal(A.BATCH_CAP_DESKTOP, 4);
  assert.equal(A.BATCH_CAP_PHONE, 4);
});

// ---- (d): batching changes no arc ------------------------------------------

test("(d) batched sampling equals unbatched, every arc on the same seeded noise", async () => {
  const model = await realModel();
  const cases = V.local_reroute.filter((c) => !c.hug && c.margin === 25 && c.calls.length > 0);
  const anchors = cases.flatMap((c) => c.calls).slice(0, 3);
  assert.equal(anchors.length, 3);
  const n = anchors.length, steps = 10, polysM = cases[0].polys_m;
  const one = normalNoise(1234, C * N);
  const ep = anchors.map(([a, b, c, d]) => S.endpointsFromLL([a, b], [c, d], meta));
  const noise = new Float32Array(n * C * N);
  for (let b = 0; b < n; b++) noise.set(one, b * C * N);
  const t0 = performance.now();
  const batched = S.toMetres(await S.samplePaths({ model, meta, endpoints: Float32Array.from(ep.flatMap((e) => [...e])),
    n, noise, steps, polysM, marginNm: 25 }), n, N, meta);
  const t1 = performance.now();
  let err = 0;
  for (let b = 0; b < n; b++) {
    const single = S.toMetres(await S.samplePaths({ model, meta, endpoints: ep[b], n: 1,
      noise: noise.subarray(b * C * N, (b + 1) * C * N), steps, polysM, marginNm: 25 }), 1, N, meta);
    err = Math.max(err, maxAbs(batched.subarray(b * N * 2, (b + 1) * N * 2), single));
  }
  console.log(`batched n=${n} ${(t1 - t0).toFixed(0)} ms, 3x n=1 ${(performance.now() - t1).toFixed(0)} ms, max|d| ${err.toExponential(2)} m`);
  assert.ok(err < 1e-3, `${err} m`);
});

// ---- the worker's pipeline -------------------------------------------------

test("runReroute's plans equal localReroute driven directly by samplePaths arcs", async () => {
  const model = await realModel();
  const cases = V.local_reroute.filter((c) => !c.hug && c.margin === 25 && (c.label.startsWith("PIR-ORF") || c.label.startsWith("SFO-DEN")));
  assert.equal(cases.length, 2);
  const rings = ringsOf(cases[0].polys_m);
  const polys = loadSua(rings);
  const steps = meta.sampler.steps, seed = 99;
  const req = { flights: flightsOf(cases), rings, marginNm: 25, hug: false, seed, steps, batchCap: 16, display: "snapped" };
  const progress = [];
  const before = modelCalls;
  const t0 = performance.now();
  const got = await runReroute(req, { model, meta, wpdb, onProgress: (p) => progress.push(p) });
  const ms = performance.now() - t0;
  const nArcs = cases.reduce((s, c) => s + c.calls.length, 0);
  assert.equal(got.arcs, nArcs);
  assert.equal(got.fallbackArcs, 0);
  assert.equal(modelCalls - before, steps, "one batched forward per step");
  // Progress: at most every 2 steps, the last step included, every arc's x0 in lat/lon.
  assert.deepEqual(progress.map((p) => p.step), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].filter((s) => s <= steps));
  for (const p of progress) {
    assert.equal(p.steps, steps);
    assert.equal(p.arcs.length, nArcs);
    for (const a of p.arcs) {
      assert.equal(a.xyLL.length, N);
      assert.ok(a.xyLL.every(([la, lo]) => la > 20 && la < 55 && lo > -130 && lo < -60));
    }
  }

  const opts = rerouteOpts(meta, 25, false, wpdb);
  const one = normalNoise(seed, C * N);
  for (const [k, c] of cases.entries()) {
    const anchors = R.anchorsFor(c.nominal, polys, opts);
    const arcs = [];
    for (const { entry, rejoin } of anchors) {
      const fin = await S.samplePaths({ model, meta, endpoints: S.endpointsFromLL([entry[1], entry[2]], [rejoin[1], rejoin[2]], meta),
        n: 1, noise: one, steps, polysM: polys, marginNm: 25 });
      const m = S.toMetres(fin, 1, N, meta);
      arcs.push(Array.from({ length: N }, (_, i) => [m[2 * i], m[2 * i + 1]]));
    }
    let j = 0;
    const want = R.localReroute(c.nominal, polys, () => arcs[j++], opts);
    const f = got.flights[k];
    assert.equal(f.id, req.flights[k].id);
    assert.deepEqual(f.plan, want.plan, c.label);
    assert.deepEqual(f.roles, want.roles, c.label);
    assert.deepEqual(f.metrics, R.metrics(c.nominal, want.plan, polys));
    assert.equal(f.status, f.metrics.legCrossings > 0 ? "cannot-clear" : "ok");
    // dense: the filed fixes outside the arcs, the sampled arc between each entry and rejoin.
    assert.deepEqual(f.dense[0], [c.nominal[0][1], c.nominal[0][2]]);
    assert.deepEqual(f.dense.at(-1), [c.nominal.at(-1)[1], c.nominal.at(-1)[2]]);
    assert.equal(f.dense.length, want.roles.filter((r) => r !== "deviation").length + anchors.length * (N - 2));
    assert.ok(anchors.length > 0);
  }
  console.log(`runReroute: ${cases.length} flights, ${nArcs} arcs, ${steps} steps, ${ms.toFixed(0)} ms`);
});

test("runReroute: a polygon far from every route leaves every flight untouched, with no model call", async () => {
  const counter = { calls: 0 };
  const cases = V.local_reroute.filter((c) => c.hug && c.margin === 25);
  const progress = [];
  const got = await runReroute({ flights: flightsOf(cases), rings: [FAR_RING], marginNm: 25, hug: true, seed: 1, steps: 20, batchCap: 16, display: "snapped" },
    { model: fakeModel(counter), meta, wpdb, onProgress: (p) => progress.push(p) });
  assert.equal(counter.calls, 0);
  assert.equal(progress.length, 0);
  assert.equal(got.arcs, 0);
  assert.equal(got.flights.length, cases.length);
  for (const [k, f] of got.flights.entries()) {
    assert.equal(f.status, "untouched");
    assert.deepEqual(f.plan, cases[k].nominal);
    assert.deepEqual(f.roles, cases[k].nominal.map(() => "filed"));
    assert.deepEqual(f.dense, cases[k].nominal.map((x) => [x[1], x[2]]));
  }
});

test("runReroute: a crossing the walk can't touch reads cannot-clear, never untouched", async () => {
  // Wide berth pins both airports (affWp[0] = affWp[n-1] = false), so a 2-fix
  // route whose one leg crosses a box gets no arc at all: the plan is the
  // filed route, and only the status says it still crosses.
  const counter = { calls: 0 };
  const nominal = [["KAAA", 35, -100], ["KBBB", 35, -90]];
  const ring = [[34, -96], [36, -96], [36, -94], [34, -94]];
  const got = await runReroute({ flights: [{ id: "f", nominal }], rings: [ring], marginNm: 25, hug: false, seed: 1, steps: 20, batchCap: 4, display: "snapped" },
    { model: fakeModel(counter), meta, wpdb });
  assert.equal(counter.calls, 0);
  assert.equal(got.arcs, 0);
  const [f] = got.flights;
  assert.deepEqual(f.roles, ["filed", "filed"]);
  assert.ok(f.metrics.legCrossings > 0);
  assert.equal(f.status, "cannot-clear");
});

test("runReroute chunks under batchCap: same plans, one forward per step per chunk", async () => {
  const cases = V.local_reroute.filter((c) => c.hug && c.margin === 40);
  const nArcs = cases.reduce((s, c) => s + c.calls.length, 0);
  assert.ok(nArcs >= 5, `${nArcs}`);
  const req = { flights: flightsOf(cases), rings: ringsOf(cases[0].polys_m), marginNm: 40, hug: true, seed: 5, steps: 6, display: "snapped" };
  const c16 = { calls: 0 }, c2 = { calls: 0 };
  const p2 = [];
  const all = await runReroute({ ...req, batchCap: 16 }, { model: fakeModel(c16), meta, wpdb });
  const two = await runReroute({ ...req, batchCap: 2 }, { model: fakeModel(c2), meta, wpdb, onProgress: (p) => p2.push(p) });
  const uniq = all.arcs; // flights sharing an (entry, rejoin) share its arc
  assert.ok(uniq >= 3 && uniq <= nArcs, `${uniq}`);
  assert.equal(c16.calls, 6);
  assert.equal(c2.calls, 6 * Math.ceil(uniq / 2));
  // The stand-in is batch-invariant, so chunking must change nothing at all.
  assert.deepEqual(two.flights, all.flights);
  // Progress counts steps across chunks, monotone, ending at the total.
  const total = 6 * Math.ceil(uniq / 2);
  assert.ok(p2.every((p) => p.steps === total));
  assert.deepEqual(p2.map((p) => p.step), [...p2.map((p) => p.step)].sort((a, b) => a - b));
  assert.equal(p2.at(-1).step, total);
  assert.ok(p2.every((p) => new Set(p.arcs.map((a) => a.xyLL)).size <= 2));
});

test("runReroute samples on demand any arc it did not plan (R3), and counts it", async () => {
  const cases = V.local_reroute.filter((c) => !c.hug && c.margin === 25);
  const req = { flights: flightsOf(cases), rings: ringsOf(cases[0].polys_m), marginNm: 25, hug: false, seed: 3, steps: 4, batchCap: 16, display: "snapped" };
  const full = await runReroute(req, { model: fakeModel(), meta, wpdb });
  // A planner that forgets every flight's last arc: the plans must not change.
  const forgetful = (fl, polys, opts) => {
    const jobs = A.planArcs(fl, polys, opts);
    const lastOf = new Map(jobs.map((j) => [j.flight, j.index]));
    return jobs.filter((j) => j.index !== lastOf.get(j.flight));
  };
  const forgot = new Set(A.planArcs(req.flights, loadSua(req.rings), rerouteOpts(meta, 25, false, wpdb)).map((j) => j.flight)).size;
  const got = await runReroute(req, { model: fakeModel(), meta, wpdb, planner: forgetful });
  assert.ok(forgot > 0);
  assert.equal(got.fallbackArcs, forgot);
  assert.equal(full.fallbackArcs, 0);
  assert.deepEqual(got.flights, full.flights);
});

test("runReroute samples an (entry, rejoin) pair once however many flights share it", async () => {
  const c = V.local_reroute.find((x) => x.label === "PIR-ORF wide 25");
  const counter = { calls: 0 };
  const req = { flights: [{ id: "a", nominal: c.nominal }, { id: "b", nominal: c.nominal }], rings: ringsOf(c.polys_m),
    marginNm: 25, hug: false, seed: 3, steps: 4, batchCap: 16, display: "snapped" };
  const progress = [];
  const got = await runReroute(req, { model: fakeModel(counter), meta, wpdb, onProgress: (p) => progress.push(p) });
  assert.equal(got.arcs, c.calls.length);
  assert.equal(counter.calls, 4);
  assert.deepEqual(got.flights[0].plan, got.flights[1].plan);
  // Each flight still sees its own arcs in progress.
  assert.deepEqual(progress[0].arcs.map((a) => [a.flight, a.index]).sort(), [["a", 0], ["a", 1], ["b", 0], ["b", 1]]);
  const byIndex = (i) => progress[0].arcs.filter((a) => a.index === i).map((a) => a.xyLL);
  assert.equal(byIndex(0)[0], byIndex(0)[1]);
});

test("runReroute cancels within one step once isCurrent turns false", async () => {
  const cases = V.local_reroute.filter((c) => !c.hug && c.margin === 25);
  const counter = { calls: 0 };
  let live = true;
  const progress = [];
  await assert.rejects(runReroute({ flights: flightsOf(cases), rings: ringsOf(cases[0].polys_m), marginNm: 25, hug: false, seed: 1, steps: 20, batchCap: 2, display: "snapped" },
    { model: fakeModel(counter), meta, wpdb, isCurrent: () => live, onProgress: (p) => { progress.push(p); live = false; } }),
  (e) => e instanceof RunCancelled);
  assert.equal(progress.length, 1);
  assert.equal(counter.calls, 2, "the step that posted progress, then nothing");
  // Already stale before it starts: no model call at all.
  const c2 = { calls: 0 };
  await assert.rejects(runReroute({ flights: flightsOf(cases), rings: ringsOf(cases[0].polys_m), marginNm: 25, hug: false, seed: 1, steps: 20, batchCap: 2, display: "snapped" },
    { model: fakeModel(c2), meta, wpdb, isCurrent: () => false }), (e) => e instanceof RunCancelled);
  assert.equal(c2.calls, 0);
});

test("rerouteOpts reads the gate's values from meta.reroute", () => {
  const o = rerouteOpts(meta, 25, true, wpdb);
  assert.deepEqual({ ...o, wpdb: null }, { wpdb: null, lockDistNm: 10, snapTolNm: 100, devSpacingNm: 150, rdpTolNm: 10, hug: true, hugMarginNm: 25, clearMarginNm: 25 });
  assert.throws(() => rerouteOpts({ ...meta, reroute: undefined }, 25, true, wpdb));
});

// ---- R16: a cancel or a newer press must be seen between forwards ----------
// ORT-web's session.run settles without returning to the worker's task queue,
// so without a macrotask yield before each forward a queued cancel is only
// dispatched after the whole run has posted everything. The worker passes
// makeMacrotaskYield() as beforeForward; these drive the same pair in node.
const cancelCase = () => {
  const cases = V.local_reroute.filter((c) => !c.hug && c.margin === 25);
  return { flights: flightsOf(cases), rings: ringsOf(cases[0].polys_m), marginNm: 25, hug: false, seed: 1, steps: 20, batchCap: 16, display: "snapped" };
};

test("R16: a cancel queued as a message after the first forward stops the run within 2 forwards", async () => {
  for (const withYield of [true, false]) {
    let token = 1, forwards = 0;
    const inbox = new MessageChannel(); // stands in for the worker's own message queue
    inbox.port1.onmessage = () => { token = -1; };
    const model = async (inp) => {
      forwards++;
      if (forwards === 1) inbox.port2.postMessage("cancel");
      return fakeModel()(inp);
    };
    try {
      const run = runReroute(cancelCase(), { model, meta, wpdb, isCurrent: () => token === 1,
        beforeForward: withYield ? makeMacrotaskYield() : undefined });
      if (withYield) {
        await assert.rejects(run, (e) => e instanceof RunCancelled);
        console.log(`R16 message cancel, with yield: stopped after ${forwards} forwards`);
        assert.ok(forwards <= 2, `${forwards} forwards`);
      } else {
        // The bug R16 found, kept as a control: with no yield the run never sees the message.
        await run;
        console.log(`R16 message cancel, no yield (control): ran all ${forwards} forwards`);
        assert.equal(forwards, 20);
      }
    } finally {
      inbox.port1.close();
    }
  }
});

test("R16: a cancel flipped by setTimeout(0) after the first forward stops the run within 2 forwards", async () => {
  let token = 1, forwards = 0;
  const model = async (inp) => {
    forwards++;
    if (forwards === 1) setTimeout(() => { token = -1; }, 0);
    const t = performance.now();
    while (performance.now() - t < 3); // a forward takes real time (~100 ms in a browser)
    return fakeModel()(inp);
  };
  await assert.rejects(runReroute(cancelCase(), { model, meta, wpdb, isCurrent: () => token === 1, beforeForward: makeMacrotaskYield() }),
    (e) => e instanceof RunCancelled);
  console.log(`R16 setTimeout(0) cancel: stopped after ${forwards} forwards`);
  assert.ok(forwards <= 2, `${forwards} forwards`);
});

test("R16: makeMacrotaskYield yields a macrotask, cheaply, and keeps no handle open", async () => {
  const y = makeMacrotaskYield();
  let ran = false;
  const ch = new MessageChannel();
  try {
    ch.port1.onmessage = () => { ran = true; };
    ch.port2.postMessage(0);
    await Promise.resolve();
    assert.equal(ran, false);
    await y();
    await y();
    assert.equal(ran, true, "a message queued before the yield is dispatched across it");
  } finally {
    ch.port1.close();
  }
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) await y();
  const per = (performance.now() - t0) / 200;
  console.log(`macrotask yield: ${(per * 1000).toFixed(0)} us each (node)`);
  assert.ok(per < 2, `${per} ms`);
});
