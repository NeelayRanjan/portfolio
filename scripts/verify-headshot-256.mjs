#!/usr/bin/env node
/**
 * verify-headshot-256.mjs — the 256 primary and the morph, out of band.
 *
 * HAND-RUN, not part of `verify-redesign.mjs`. Run it when the headshot bundle
 * is re-vendored, when `wantsPrimary()`'s policy changes in
 * `lib/headshot-model.ts`, or when anything touches `lib/headshot-diffusion.js`:
 *
 *   npm run build
 *   npm start -- -p 3000
 *   node scripts/verify-headshot-256.mjs
 *
 * ⚠️ Port 3000 only, same rule as verify-redesign.mjs: a human dev server may
 * be on :3001, and the production domain is never contacted.
 *
 * WHY THIS EXISTS. The browser check in `verify-redesign.mjs` runs at a 400px
 * viewport, so the loader's device budget always hands it the 128 fallback.
 * Nothing in the suite ever touches the 256 primary, and the 256 is what every
 * desktop visitor gets. This drives the SITE's vendored module
 * (`lib/headshot-diffusion.js`) against the bytes the SERVER is actually
 * serving (`/headshot/v2/...`), so a graph that was never deployed, a meta that
 * drifted from its graph, or a module that quietly stopped honouring `init`
 * fails here.
 *
 * It is node-wasm, not a browser: it proves the model and the sampler, not the
 * UI. Timings printed are node numbers and must not be quoted as browser ones
 * (CLAUDE.md: measure in a real browser before claiming browser latency).
 *
 * Asserts:
 *   1. from-noise at 256 runs the meta's full step count and reconstructs the
 *      class it was asked for, decisively closer to that photo than the others;
 *   2. a morph seeded by that sample lands on the DESTINATION photo, same test;
 *   3. the morph ran strictly FEWER steps than the from-noise run — the
 *      structural proof that `init` took the transition branch rather than
 *      being silently ignored (which is exactly what the v1 module did with
 *      unknown options).
 *
 * Exits non-zero on any failure.
 */
import { execFileSync } from "node:child_process";
import * as ort from "onnxruntime-web";
import { generate } from "../lib/headshot-diffusion.js";

const BASE = process.env.HEADSHOT_BASE ?? "http://localhost:3000";
const V2 = `${BASE}/headshot/v2`;

/**
 * Same 0-255 scale as the browser check's limit, but calibrated SEPARATELY and
 * deliberately looser. That one compares at 32x32, where downscaling averages
 * the sampler's high-frequency error away; this compares at the full 256, where
 * it does not, and the 256 model's own per-photo PSNR is 21.0 / 27.4 / 18.0 dB.
 *
 * Measured over four runs (fresh noise every time, so this number moves):
 * own-class MAD 9.33, 11.47, 11.54, 13.02 — while the nearest wrong photo never
 * came in under 64. So 25 sits ~2x above the worst real value and ~2.5x below
 * the nearest wrong answer. The control ratio below is the assertion that
 * actually proves the right class was drawn; this one catches a run that is
 * merely bad.
 */
const MAD_MAX = 25;

ort.env.wasm.numThreads = 4;

let failed = false;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failed = true;
};

async function get(path) {
  const res = await fetch(`${V2}/${path}`);
  if (!res.ok) throw new Error(`${V2}/${path} -> HTTP ${res.status}`);
  return res;
}

const meta = await (await get("headshot256_meta.json")).json();
if (meta?.version !== 1 || !meta.res || !meta.channels || !meta.k) {
  throw new Error(`headshot256_meta.json is malformed: ${JSON.stringify(meta)}`);
}
console.log(`meta: res ${meta.res}, k ${meta.k}, steps_default ${meta.steps_default}`);

const graph = new Uint8Array(await (await get("headshot256.onnx")).arrayBuffer());
console.log(`graph: headshot256.onnx, ${(graph.byteLength / 1e6).toFixed(2)} MB served`);
const session = await ort.InferenceSession.create(graph.buffer, {
  executionProviders: ["wasm"],
});

/**
 * One served photo, decoded to the model's planar [-1,1] layout at meta.res.
 *
 * The comparison target is the SERVED WebP crop, not the bundle's training PNG:
 * the training inputs are not in this repo (and must not be), and the webp is
 * what the browser check compares against too, so both checks are measuring the
 * same thing. ffmpeg does the decode and the downscale; the browser's canvas
 * resampling is a little different, which is why the two checks report slightly
 * different numbers for the same model.
 */
async function loadPhoto(i) {
  const bytes = Buffer.from(await (await get(`photos/${i}.webp`)).arrayBuffer());
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", "pipe:0", "-vf", `scale=${meta.res}:${meta.res}`,
     "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { input: bytes, maxBuffer: 1 << 28 },
  );
  const n = meta.res * meta.res;
  if (raw.length !== n * 3) throw new Error(`photo ${i}: unexpected raw length ${raw.length}`);
  const out = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) out[c * n + p] = (raw[p * 3 + c] / 255) * 2 - 1;
  }
  return out;
}

/** Mean absolute difference in 0-255 units, plus PSNR, over all channels. */
function compare(a, b) {
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < a.length; i++) {
    const d = ((a[i] - b[i]) / 2) * 255;
    sum += Math.abs(d);
    sq += d * d;
  }
  return { mad: sum / a.length, psnr: 10 * Math.log10((255 * 255) / (sq / a.length)) };
}

const classes = Array.from({ length: meta.k }, (_, i) => i);
const photos = [];
for (const i of classes) photos.push(await loadPhoto(i));

/** Report `run` against every photo and assert its own class wins decisively. */
function judge(name, out, cls) {
  const own = compare(out, photos[cls]);
  const controls = classes.filter((i) => i !== cls).map((i) => compare(out, photos[i]).mad);
  console.log(
    `${name}: MAD ${own.mad.toFixed(2)} PSNR ${own.psnr.toFixed(1)} dB against class ${cls}` +
      `; controls ${controls.map((c) => c.toFixed(2)).join(", ")}`,
  );
  if (own.mad > MAD_MAX) fail(`${name}: MAD ${own.mad.toFixed(2)} exceeds ${MAD_MAX}`);
  if (!controls.every((c) => c > own.mad * 2)) {
    fail(`${name}: not decisively closest to class ${cls}`);
  }
}

// 1. From noise, into the last class — the seed for the morph.
const fromClass = meta.k - 1;
let steps1 = 0;
let t0 = performance.now();
const first = await generate({
  session, ort, meta,
  classIdx: fromClass,
  onFrame: () => { steps1++; },
});
console.log(
  `from noise -> class ${fromClass}: ${steps1} steps, ` +
    `${((performance.now() - t0) / steps1).toFixed(1)} ms/step (node wasm, 4 threads)`,
);
judge("from noise", first, fromClass);
if (steps1 !== meta.steps_default) {
  fail(`from-noise ran ${steps1} steps, expected the meta's ${meta.steps_default}`);
}
if (first.length !== meta.channels * meta.res * meta.res) {
  fail(`from-noise output length ${first.length} is not channels*res*res`);
}

// 2. MORPH into class 0, seeded by that sample — exactly what a cross-class
// press does in the component: a .slice() copy, no `strength`, no `size`.
let steps2 = 0;
t0 = performance.now();
const second = await generate({
  session, ort, meta,
  classIdx: 0,
  init: first.slice(),
  onFrame: () => { steps2++; },
});
console.log(
  `morph -> class 0: ${steps2} steps (of ${steps1}), ` +
    `${((performance.now() - t0) / steps2).toFixed(1)} ms/step (node wasm, 4 threads)`,
);
judge("morph", second, 0);
// 3. The structural proof. A transition starts partway down the schedule, so it
// runs a strict subset of the steps; an ignored `init` would run all of them.
if (!(steps2 > 0 && steps2 < steps1)) {
  fail(`morph ran ${steps2} steps against ${steps1}: the init branch did not run`);
}
if (second.length !== first.length) fail("morph output length differs from the from-noise run");

console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
