/**
 * ascii-diffusion.js — in-browser MNIST diffusion, drawing -> ASCII.
 *
 * Owns all the model math: MNIST input normalization, the cosine schedule, SDEdit, DDIM
 * with classifier-free guidance, and the ASCII mapping. The host page owns the canvas,
 * the pen, and the UI.
 *
 * Every constant here is matched against the PyTorch reference implementation
 * (src/preprocess.py, src/diffusion.py). Changing one silently desyncs the browser from
 * the trained model, which looks like a bad model rather than a bad port.
 *
 *   const ad = await AsciiDiffusion.load("/models/mnist_x0.onnx");
 *   await ad.generate({ canvas, digit: 7, onFrame: ({ ascii }) => render(ascii.x0) });
 */

const T = 1000;
const NULL_CLASS = 10;          // labels 0-9 are digits; 10 is the CFG null token
const FIELD = 28;
const BOX = 20;                 // MNIST normalizes the digit's long side to 20px
const COM_TARGET = FIELD / 2;   // 14.0 — measured from real MNIST, NOT (FIELD-1)/2
const INK_THRESH = 0.05;
const RAMP = " .:-=+*#%@";
const ROWS = 14, COLS = 28;     // monospace cells are ~1:2, so 28x14 renders square-ish

/* ---------------------------------------------------------------- schedule */

function cosineAlphasCumprod(steps = T, s = 0.008) {
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

/* --------------------------------------------------------- preprocessing */

/**
 * Canvas -> [28,28] Float32Array in [0,1], white ink on black, MNIST-normalized.
 * Mirrors src/preprocess.py: crop to ink bbox, scale long side to 20 with smoothing,
 * centre by CENTER OF MASS (not bounding box) at 14.0.
 */
function normalizeCanvas(canvas, { inkIsHigh = false } = {}) {
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h);
  const d = src.data;

  // grayscale + invert if the page draws dark ink on light paper
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = d[i + 3] / 255;
    // composite over white, then luminance
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const v = lum * a + 1 * (1 - a);
    gray[p] = inkIsHigh ? (1 - v) : v;
  }
  for (let p = 0; p < gray.length; p++) gray[p] = 1 - gray[p];

  // ink bounding box
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] > INK_THRESH) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const field = new Float32Array(FIELD * FIELD);
  if (x1 < 0) return field; // empty drawing

  // scale long side to BOX, preserving aspect. drawImage gives MNIST-like gray levels.
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const scale = BOX / Math.max(cw, ch);
  const nw = Math.max(1, Math.round(cw * scale)), nh = Math.max(1, Math.round(ch * scale));

  const cropCv = document.createElement("canvas");
  cropCv.width = cw; cropCv.height = ch;
  const cctx = cropCv.getContext("2d");
  const cropImg = cctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const v = Math.round(gray[(y + y0) * w + (x + x0)] * 255);
      const i = (y * cw + x) * 4;
      cropImg.data[i] = cropImg.data[i + 1] = cropImg.data[i + 2] = v;
      cropImg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cropImg, 0, 0);

  const small = document.createElement("canvas");
  small.width = nw; small.height = nh;
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(cropCv, 0, 0, nw, nh);
  const sd = sctx.getImageData(0, 0, nw, nh).data;

  // paste roughly centred into the 28x28 field
  const top = Math.floor((FIELD - nh) / 2), left = Math.floor((FIELD - nw) / 2);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      field[(y + top) * FIELD + (x + left)] = sd[(y * nw + x) * 4] / 255;
    }
  }
  return comShift(field);
}

function comShift(field) {
  let total = 0, sy = 0, sx = 0;
  for (let y = 0; y < FIELD; y++) {
    for (let x = 0; x < FIELD; x++) {
      const v = field[y * FIELD + x];
      total += v; sy += v * y; sx += v * x;
    }
  }
  if (total < 1e-8) return field;
  const dy = Math.round(COM_TARGET - sy / total);
  const dx = Math.round(COM_TARGET - sx / total);
  if (dy === 0 && dx === 0) return field;
  const out = new Float32Array(FIELD * FIELD);
  for (let y = 0; y < FIELD; y++) {
    for (let x = 0; x < FIELD; x++) {
      // np.roll semantics: wrap, matching the reference implementation
      const ny = ((y + dy) % FIELD + FIELD) % FIELD;
      const nx = ((x + dx) % FIELD + FIELD) % FIELD;
      out[ny * FIELD + nx] = field[y * FIELD + x];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ ascii */

function toAscii(x784) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let line = "";
    for (let c = 0; c < COLS; c++) {
      // aspect correction: average the two source rows that share this character cell
      const a = x784[(2 * r) * COLS + c], b = x784[(2 * r + 1) * COLS + c];
      const v = Math.min(1, Math.max(0, ((a + b) / 2 + 1) / 2));
      line += RAMP[Math.round(v * (RAMP.length - 1))];
    }
    rows.push(line);
  }
  return rows;
}

/* ------------------------------------------------------------------ model */

export class AsciiDiffusion {
  constructor(session, ort) {
    this.session = session;
    this.ort = ort;
    this.ab = cosineAlphasCumprod(T);
    this.ready = true;
  }

  static async load(modelUrl, { ort, executionProviders = ["webgpu", "wasm"] } = {}) {
    const runtime = ort || (await import("onnxruntime-web"));
    const session = await runtime.InferenceSession.create(modelUrl, { executionProviders });
    return new AsciiDiffusion(session, runtime);
  }

  /** Canvas -> Float32Array(784) in [0,1]. Render this to show what the model sees. */
  preprocess(canvas, opts) {
    return normalizeCanvas(canvas, opts);
  }

  toAscii(x784) {
    return toAscii(x784);
  }

  /** One CFG step: cond and uncond fused into a single batch-2 forward. */
  async _predX0(x, tStep, digit, guidance) {
    const n = 784;
    const twin = new Float32Array(n * 2);
    twin.set(x, 0); twin.set(x, n);
    const tt = new BigInt64Array([BigInt(tStep), BigInt(tStep)]);
    const yy = new BigInt64Array([BigInt(digit), BigInt(NULL_CLASS)]);

    const out = await this.session.run({
      x: new this.ort.Tensor("float32", twin, [2, 1, 28, 28]),
      t: new this.ort.Tensor("int64", tt, [2]),
      y: new this.ort.Tensor("int64", yy, [2]),
    });
    const o = out.x0.data;

    const x0 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const cond = o[i], uncond = o[n + i];
      // guide on the predicted x0, then clamp ONCE — never per-branch
      x0[i] = Math.min(1, Math.max(-1, uncond + guidance * (cond - uncond)));
    }
    return x0;
  }

  /**
   * SDEdit: noise the drawing partway, then denoise it back.
   *
   * onFrame({ phase, step, total, xt, x0, ascii }) fires per frame — render inside it.
   * phase is "dissolve" or "denoise":
   *
   *   dissolve — the forward process, ramping t from 0 up to strength*T. This is a closed
   *              form (x_t = sqrt(ab)*x0 + sqrt(1-ab)*eps), so it costs NOTHING: no model
   *              calls, no GPU. It exists purely so the viewer watches their drawing come
   *              apart instead of cutting straight to static. xt dissolves; x0 holds their
   *              drawing steady. Set dissolve: 0 to skip.
   *   denoise  — the model actually running. xt re-forms; x0 is the model's evolving guess.
   *
   * The same noise vector is used throughout, so the dissolve is one continuous motion and
   * its last frame flows straight into the first denoise frame.
   */
  async generate({
    canvas, digit, strength = 0.6, steps = 20, guidance = 2.0, dissolve = 10,
    onFrame = null, seed = null, x0Init = null, noise: noiseIn = null,
  } = {}) {
    if (digit == null || digit < 0 || digit > 9) throw new Error("generate: digit must be 0-9");
    const init = x0Init || (() => {
      const f = normalizeCanvas(canvas);
      const v = new Float32Array(784);
      for (let i = 0; i < 784; i++) v[i] = f[i] * 2 - 1; // [0,1] -> [-1,1]
      return v;
    })();

    const rand = mulberry32(seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed);
    const tStart = Math.max(1, Math.min(T - 1, Math.round(strength * T)));

    // descending timestep sequence over [0, tStart]
    const seq = [];
    for (let i = 0; i < steps; i++) {
      seq.push(Math.round((i * tStart) / (steps - 1)));
    }
    seq.reverse();

    // q_sample: x = sqrt(ab)*x0 + sqrt(1-ab)*noise
    // noiseIn is an escape hatch for cross-language parity tests (web/test_parity.mjs):
    // supply the reference implementation's noise and the outputs must agree numerically.
    const noise = noiseIn || randn(rand, 784);

    const qSample = (t) => {
      const ab = this.ab[Math.max(0, Math.min(T - 1, t))];
      const out = new Float32Array(784);
      const a = Math.sqrt(ab), b = Math.sqrt(1 - ab);
      for (let i = 0; i < 784; i++) out[i] = a * init[i] + b * noise[i];
      return out;
    };

    const nDissolve = onFrame ? dissolve : 0;
    const total = nDissolve + seq.length;

    // --- dissolve: forward process only, zero model calls ---
    for (let i = 0; i < nDissolve; i++) {
      const xd = qSample(Math.round((i / nDissolve) * tStart));
      onFrame({
        phase: "dissolve", step: i, total,
        xt: xd, x0: init.slice(),
        ascii: { xt: toAscii(xd), x0: toAscii(init) },
      });
      await new Promise(r => setTimeout(r, 0));
    }

    // --- denoise: the model runs from tStart back to 0 ---
    let x = qSample(seq[0]);

    for (let i = 0; i < seq.length; i++) {
      const tCur = seq[i];
      const x0 = await this._predX0(x, tCur, digit, guidance);

      if (onFrame) {
        onFrame({
          phase: "denoise", step: nDissolve + i, total,
          xt: x.slice(), x0: x0.slice(),
          ascii: { xt: toAscii(x), x0: toAscii(x0) },
        });
        await new Promise(r => setTimeout(r, 0)); // yield so the frame paints
      }

      const abT = this.ab[tCur];
      const abPrev = i + 1 < seq.length ? this.ab[seq[i + 1]] : 1.0;
      const sqAbT = Math.sqrt(abT), sq1mT = Math.sqrt(1 - abT);
      const sqAbP = Math.sqrt(abPrev), sq1mP = Math.sqrt(1 - abPrev);

      const next = new Float32Array(784);
      for (let j = 0; j < 784; j++) {
        const eps = (x[j] - sqAbT * x0[j]) / sq1mT;   // derive eps-hat from x0-hat
        next[j] = sqAbP * x0[j] + sq1mP * eps;        // DDIM step, eta = 0
      }
      x = next;
    }
    return x;
  }
}

export { RAMP, ROWS, COLS, cosineAlphasCumprod, toAscii };
