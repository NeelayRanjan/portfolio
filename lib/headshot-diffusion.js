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
 * x0/xt layout: Float32Array, [1,3,R,R] C-order (channel-planar), R = meta.res
 * unless the `size` option overrides it (dynamic-shape export only).
 * x0 is already clamped to [-1,1] (meta.output_clamp: true) — do not clamp again.
 * xt is UNBOUNDED (early frames are near-raw Gaussian noise) — clamp or normalize for display.
 *
 * v2 options (all optional; omitting all three reproduces v1 byte-for-byte —
 * same RNG draws, same loop, same outputs on the classic classIdx path):
 *   - size: generate at a resolution other than meta.res. Only works against
 *     the dynamic-shape (256) export, whose ONNX graph has free H/W axes; the
 *     frozen-shape (128) export will reject anything but meta.res. Off the
 *     model's trained resolution is genuinely off-distribution — a toy, not a
 *     feature.
 *   - classWeights: replace the one-hot class vector with an arbitrary
 *     length-k array, or a per-step function of it. Values are used exactly
 *     as given (no renormalization) — you can go off the training simplex on
 *     purpose (e.g. sum > 1, negative weights) to see what the model does.
 *   - init + strength: img2img-style transition. Instead of starting from
 *     pure noise at t=T-1, start partway down the schedule from a supplied
 *     image. Higher strength = more steps = a longer morph away from init.
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
 *
 * v2 options — see the header comment above for the full picture:
 *   size          generation resolution, default meta.res. Must be a
 *                 positive integer divisible by 8.
 *   classWeights  Float32Array/number[] of length meta.k, OR a function
 *                 (step, total) => same, called once per step BEFORE that
 *                 step's session.run. Overrides classIdx as the `c` tensor;
 *                 when given, classIdx is not required. Values are used
 *                 as-is, no normalization.
 *   init          Float32Array of length channels*size*size, values in
 *                 [-1,1] — starting image for a transition instead of pure
 *                 noise.
 *   strength      (0,1], default 0.55. Only meaningful with `init`: fraction
 *                 of the schedule to run, starting from a partially-noised
 *                 version of `init`.
 */
export async function generate({
  session, ort, meta, classIdx,
  steps = null, onFrame = null, seed = null, noise = null,
  size = null, classWeights = null, init = null, strength = 0.55,
} = {}) {
  if (!session || !ort || !meta) {
    throw new Error("generate: session, ort and meta are required");
  }
  const K = meta.k, C = meta.channels, T = meta.schedule.T;

  let R = meta.res;
  if (size != null) {
    if (!Number.isInteger(size) || size <= 0 || size % 8 !== 0) {
      throw new Error("generate: size must be a positive integer divisible by 8");
    }
    R = size;
  }
  const n = C * R * R;

  const useClassWeights = classWeights != null;
  if (!useClassWeights) {
    if (!Number.isInteger(classIdx) || classIdx < 0 || classIdx >= K) {
      throw new Error(`generate: classIdx must be an integer in 0..${K - 1}`);
    }
  } else if (typeof classWeights !== "function") {
    if (classWeights.length !== K) {
      throw new Error(`generate: classWeights must have length ${K}`);
    }
  }

  if (init != null) {
    if (init.length !== n) {
      throw new Error(`generate: init must have length ${n}`);
    }
    if (!(strength > 0 && strength <= 1)) {
      throw new Error("generate: strength must be in (0,1]");
    }
  }

  const ab = cosineAlphasCumprod(T, meta.schedule.s ?? 0.008);
  const nSteps = steps ?? meta.steps_default;

  // descending timesteps, evenly spaced over [0, T-1]; Math.round matches the
  // reference's int(v + 0.5) — see src/headshot/diffusion.py
  const seq = [];
  if (nSteps < 2) seq.push(T - 1);
  else for (let i = 0; i < nSteps; i++) seq.push(Math.round((i * (T - 1)) / (nSteps - 1)));
  seq.reverse();

  const rand = mulberry32(seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed);

  let runSeq = seq;
  let x;
  if (init != null) {
    // transition mode: start partway down the schedule from a noised `init`.
    const tStart = Math.round(strength * (T - 1));
    runSeq = seq.filter((t) => t <= tStart);
    if (runSeq.length === 0) runSeq = [0]; // degenerate strength/steps combos still get one clamping model step
    const initNoise = noise ? Float32Array.from(noise) : randn(rand, n);
    const sqAbStart = Math.sqrt(ab[tStart]), sq1mStart = Math.sqrt(1 - ab[tStart]);
    x = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      x[j] = sqAbStart * init[j] + sq1mStart * initNoise[j];
    }
  } else {
    x = noise ? Float32Array.from(noise) : randn(rand, n);
  }

  const cHot = new Float32Array(K);
  if (!useClassWeights) cHot[classIdx] = 1;

  const total = runSeq.length;
  for (let i = 0; i < runSeq.length; i++) {
    const tCur = runSeq[i];

    let cArr;
    if (useClassWeights) {
      cArr = typeof classWeights === "function"
        ? Float32Array.from(classWeights(i, total))
        : Float32Array.from(classWeights);
      if (cArr.length !== K) {
        throw new Error(`generate: classWeights must have length ${K}`);
      }
    } else {
      cArr = cHot;
    }

    const out = await session.run({
      x: new ort.Tensor("float32", x, [1, C, R, R]),
      t: new ort.Tensor("float32", new Float32Array([tCur]), [1]),
      c: new ort.Tensor("float32", cArr, [1, K]),
    });
    const raw = out.x0.data;
    const x0 = new Float32Array(n);
    for (let j = 0; j < n; j++) x0[j] = Math.min(1, Math.max(-1, raw[j]));

    if (onFrame) {
      onFrame({ xt: x.slice(), x0: x0.slice(), step: i, total });
      await new Promise((r) => setTimeout(r, 0)); // yield so the frame paints
    }

    const abT = ab[tCur];
    const abP = i + 1 < runSeq.length ? ab[runSeq[i + 1]] : 1.0;
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
