import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as S from "../lib/slaac/sampler.ts";
import { normalNoise } from "../lib/slaac/rng.ts";
const require = createRequire(import.meta.url);
const ort = require("onnxruntime-web/wasm");
const meta = JSON.parse(readFileSync(new URL("../public/slaac/meta.json", import.meta.url)));
const V = JSON.parse(readFileSync(new URL("./slaac-vectors/sampler.json", import.meta.url)));
const maxAbs = (a, b) => {
  assert.equal(a.length, b.length);
  return a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);
};

async function modelFn() {
  ort.env.wasm.numThreads = 1;
  const s = await ort.InferenceSession.create(readFileSync(new URL(`../public/models/${meta.model}`, import.meta.url)));
  return async ({ noisy, t, od, eh, sc, tid, B }) => {
    const N = meta.sample_size, C = meta.channels;
    const out = await s.run({
      noisy: new ort.Tensor("float32", noisy, [B, C, N]),
      t: new ort.Tensor("int64", BigInt64Array.from({ length: B }, () => BigInt(t)), [B]),
      od: new ort.Tensor("float32", od, [B, 4]), eh: new ort.Tensor("float32", eh, [B, 4]),
      sc: new ort.Tensor("float32", sc, [B, 6, N]), tid: new ort.Tensor("int64", tid, [B]) });
    return out.v.data;
  };
}

test("chordFeatures matches", () => {
  for (const c of V.chord_features) {
    const out = S.chordFeatures(Float64Array.from(c.p_xy.flat(2)), Float32Array.from(c.endpoints.flat(2)), c.p_xy.length, c.p_xy[0][0].length, meta.res_scale);
    const err = maxAbs(out, c.out.flat(2));
    console.log(`chordFeatures ${c.label} max|d| ${err.toExponential(2)}`);
    assert.ok(err < 1e-4, `${c.label}: ${err}`);
  }
});

test("endpointsFromLL matches the runs' endpoints", () => {
  for (const c of V.runs) {
    c.endpoints_ll.forEach(([olat, olon, dlat, dlon], k) => {
      const ep = S.endpointsFromLL([olat, olon], [dlat, dlon], meta);
      const err = maxAbs(ep, c.endpoints[k].flat());
      assert.ok(err < 1e-6, `${c.label}[${k}]: ${err}`);
    });
  }
});

test("normalNoise is seeded and roughly standard normal", () => {
  const a = normalNoise(7, 20001), b = normalNoise(7, 20001), c = normalNoise(8, 20001);
  assert.equal(a.length, 20001);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length);
  assert.ok(Math.abs(mean) < 0.03 && Math.abs(sd - 1) < 0.03, `mean ${mean} sd ${sd}`);
  assert.ok(a.every(Number.isFinite));
});

// The Python run records arc 0's x0 (the residual, after the end pins and the
// SUA rewrite) at steps 0-2 as self-conditioning saw it. ORT (wasm, node) vs
// torch differs by ~4e-6 in v per call (meta.onnx.parity_max_abs), so the
// early x0 should sit near that. Observed 1.08e-5 (no-sua) and 1.54e-5
// (sua); the bound is ~10x that. A float64 chord reads 8.9e-3 here.
const X0_FIRST3_TOL = 1.5e-4;

test("full sample_paths runs match Python on injected noise", async () => {
  const model = await modelFn();
  for (const c of V.runs) {
    const n = c.endpoints.length, C = meta.channels, N = meta.sample_size;
    const x0s = [], pxys = [];
    const t0 = performance.now();
    const final = await S.samplePaths({ model, meta, endpoints: Float32Array.from(c.endpoints.flat(2)), n,
      noise: Float32Array.from(c.r0.flat(2)), steps: c.steps, polysM: c.polys_m.length ? c.polys_m : null, marginNm: 25,
      onStep: (i, x0Abs, x0) => {
        if (i >= 3) return;
        x0s.push(Float64Array.from(x0.subarray(0, C * N)));
        const p = [];
        for (let b = 0; b < n; b++) for (let ch = 0; ch < 2; ch++) p.push(x0Abs.subarray((b * C + ch) * N, (b * C + ch + 1) * N));
        pxys.push(p);
      } });
    // The sua run is where the pipeline-step chord_features cases were
    // recorded: its x0_abs xy is their p_xy. The pinned end columns are pure
    // float32 chord, so they must match bit for bit (a float64 chord doesn't).
    if (c.label === "sua") {
      const pipe = V.chord_features.filter((k) => k.label.startsWith("pipeline-step-"));
      pipe.forEach((k, i) => {
        const want = k.p_xy.flat();
        pxys[i].forEach((row, j) => {
          assert.equal(row[0], want[j][0], `step ${i} row ${j} start`);
          assert.equal(row[N - 1], want[j][N - 1], `step ${i} row ${j} end`);
        });
        const err = maxAbs(pxys[i].flatMap((row) => Array.from(row)), want.flat());
        console.log(`sua step ${i}: x0_abs xy vs pipeline p_xy max|d| ${err.toExponential(2)}`);
      });
    }
    const ms = performance.now() - t0;
    assert.equal(x0s.length, 3);
    let x0err = 0;
    for (let i = 0; i < 3; i++) x0err = Math.max(x0err, maxAbs(x0s[i], c.x0_first3[i].flat()));
    const m = S.toMetres(final, n, N, meta);
    const refM = S.toMetres(Float64Array.from(c.final.flat(2)), n, N, meta);
    const err = maxAbs(m, refM);
    console.log(`${c.label}: steps=${c.steps} sua=${c.polys_m.length > 0} x0_first3 max|d| ${x0err.toExponential(2)}  ` +
      `final max|d| ${err.toFixed(3)} m (python torch-vs-ORT drift ${c.ort_drift_m.toFixed(3)} m, tol ${c.tolerance_m} m)  ${ms.toFixed(0)} ms`);
    assert.ok(x0err < X0_FIRST3_TOL, `x0_first3 ${x0err}`);
    assert.ok(err < c.tolerance_m, `${err} m`);
  }
});

test("a throw from onStep cancels the run", async () => {
  const c = V.runs[0];
  const calls = [];
  const model = async (inp) => { calls.push(inp.t); return new Float32Array(inp.B * meta.channels * meta.sample_size); };
  await assert.rejects(S.samplePaths({ model, meta, endpoints: Float32Array.from(c.endpoints.flat(2)), n: c.endpoints.length,
    noise: Float32Array.from(c.r0.flat(2)), steps: 10, polysM: null, marginNm: 25,
    onStep: (i) => { if (i === 1) throw new Error("cancelled"); } }), /cancelled/);
  assert.equal(calls.length, 2);
});
