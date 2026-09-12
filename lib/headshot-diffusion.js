/**
 * headshot-diffusion.js — class-conditional headshot diffusion, noise -> photo.
 *
 * Owns all the model math: the cosine schedule and DDIM (eta = 0) over an
 * x0-predicting ONNX model. The host page owns canvas, buttons, and fallback.
 *
 * Every constant is read from headshot_meta.json or matched against the
 * PyTorch reference (src/headshot/schedule.py, src/headshot/diffusion.py) and
 * pinned by dist/vectors + test_parity.mjs. Changing anything here silently
 * desyncs the browser from the trained model, which looks like a bad model
 * rather than a bad port.
 *
 *   const ort = await import("onnxruntime-web");
 *   const session = await ort.InferenceSession.create("/models/headshot.onnx",
 *     { executionProviders: ["wasm"] });
 *   const meta = await (await fetch("/models/headshot_meta.json")).json();
 *   await generate({ session, ort, meta, classIdx: 0,
 *     onFrame: ({ x0 }) => paint(x0) });
 *
 * x0/xt layout: Float32Array, [1,3,R,R] C-order (channel-planar).
 * x0 is already clamped to [-1,1] (meta.output_clamp: true) — do not clamp again.
 * xt is UNBOUNDED (early frames are near-raw Gaussian noise) — clamp or normalize for display.
 */

/* ---------------------------------------------------------------- schedule */

export function cosineAlphasCumprod(steps, s = 0.008) {
  const f = new Float64Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const x = ((i / steps + s) / (1 + s)) * (Math.PI / 2);
    f[i] = Math.cos(x) ** 2;
  }
  const ab = new Float64Array(steps);
  let acc = 1.0;
  for (let i = 0; i < steps; i++) {
    const beta = Math.min(1 - f[i + 1] / f[i], 0.999);
    acc *= 1 - beta;
    ab[i] = acc;
  }
  return ab;
}

/* ------------------------------------------------------------------- rng */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rand, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(rand(), 1e-12), v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return out;
}

/* ----------------------------------------------------------------- sample */

/**
 * Run the reverse process for one class; resolves to the final x0.
 *
 * onFrame({ xt, x0, step, total }) fires after EVERY model step with copies
 * of the current state (render inside it), then control yields to the event
 * loop so the page never locks. The computation is the animation.
 *
 * noise is an escape hatch for cross-language parity tests (test_parity.mjs):
 * supply the reference implementation's noise and the outputs must agree
 * numerically. seed gives reproducible noise without a tensor in hand.
 */
export async function generate({
  session, ort, meta, classIdx,
  steps = null, onFrame = null, seed = null, noise = null,
} = {}) {
  if (!session || !ort || !meta) {
    throw new Error("generate: session, ort and meta are required");
  }
  const K = meta.k, R = meta.res, C = meta.channels, T = meta.schedule.T;
  if (!Number.isInteger(classIdx) || classIdx < 0 || classIdx >= K) {
    throw new Error(`generate: classIdx must be an integer in 0..${K - 1}`);
  }
  const ab = cosineAlphasCumprod(T, meta.schedule.s ?? 0.008);
  const nSteps = steps ?? meta.steps_default;
  const n = C * R * R;

  // descending timesteps, evenly spaced over [0, T-1]; Math.round matches the
  // reference's int(v + 0.5) — see src/headshot/diffusion.py
  const seq = [];
  if (nSteps < 2) seq.push(T - 1);
  else for (let i = 0; i < nSteps; i++) seq.push(Math.round((i * (T - 1)) / (nSteps - 1)));
  seq.reverse();

  const rand = mulberry32(seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed);
  let x = noise ? Float32Array.from(noise) : randn(rand, n);

  const cHot = new Float32Array(K);
  cHot[classIdx] = 1;

  for (let i = 0; i < seq.length; i++) {
    const tCur = seq[i];
    const out = await session.run({
      x: new ort.Tensor("float32", x, [1, C, R, R]),
      t: new ort.Tensor("float32", new Float32Array([tCur]), [1]),
      c: new ort.Tensor("float32", cHot, [1, K]),
    });
    const raw = out.x0.data;
    const x0 = new Float32Array(n);
    for (let j = 0; j < n; j++) x0[j] = Math.min(1, Math.max(-1, raw[j]));

    if (onFrame) {
      onFrame({ xt: x.slice(), x0: x0.slice(), step: i, total: seq.length });
      await new Promise((r) => setTimeout(r, 0)); // yield so the frame paints
    }

    const abT = ab[tCur];
    const abP = i + 1 < seq.length ? ab[seq[i + 1]] : 1.0;
    const sqAbT = Math.sqrt(abT), sq1mT = Math.sqrt(1 - abT);
    const sqAbP = Math.sqrt(abP), sq1mP = Math.sqrt(1 - abP);
    const next = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const eps = (x[j] - sqAbT * x0[j]) / sq1mT; // derive eps-hat from x0-hat
      next[j] = sqAbP * x0[j] + sq1mP * eps;      // DDIM step, eta = 0
    }
    x = next;
  }
  return x; // final abP = 1, so this IS the last clamped x0
}
