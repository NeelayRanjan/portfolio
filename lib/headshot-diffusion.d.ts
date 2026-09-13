/**
 * Types for the vendored `headshot-diffusion.js`, shipped from the headshot
 * model repo (`~/Documents/headshot_diffusion/dist/`).
 *
 * Hand-written to match that module, adapted from the bundle's starter .d.ts —
 * the house rule is that the site types its own copy, so re-check this against
 * the .js when a new version lands, and never edit the .js. That module owns
 * ALL model math: the cosine schedule, the DDIM (eta = 0) step, the descending
 * timestep sequence, and the per-step clamp. It is pinned against the PyTorch
 * reference (vendored JS + ONNX wasm vs PyTorch, max|Δ| 6.71e-6), so a "fix"
 * here is almost certainly a bug.
 *
 * Two things the site must respect, both of which produce plausible-looking
 * wrong output rather than an error:
 *   - `t` is module-internal. The site never passes a timestep; the module
 *     builds the raw 0..999 sequence itself.
 *   - `x0` frames are ALREADY clamped to [-1,1] (`meta.output_clamp`). Do not
 *     clamp again. `xt` frames are unbounded and must be clamped/mapped for
 *     display.
 */

/** Exactly the shape of `public/headshot/headshot_meta.json`. Read every one of
 *  these from the file, never hardcode them: a retrained export changes them. */
export interface HeadshotMeta {
  /** Guarded by `lib/headshot-model.ts`; a bump means re-read the contract. */
  version: 1;
  /** Side length R. Frames are [1, channels, R, R]. */
  res: number;
  channels: number;
  /** How many classes (= source photos), so how many buttons. */
  k: number;
  schedule: { type: "cosine"; T: number; s?: number };
  steps_default: number;
  t_input: "float32";
  /** True for this export: the module clamps x0 every step. */
  output_clamp: boolean;
}

export interface HeadshotFrame {
  /**
   * The current state x_t, Float32Array [1, channels, res, res] in C-order
   * (channel-planar, NOT interleaved RGBA).
   *
   * UNBOUNDED: the first frames are near-raw Gaussian noise, so clamp to
   * [-1,1] before mapping to bytes or the display wraps around.
   */
  xt: Float32Array;
  /** The model's x0 estimate at this step, already clamped to [-1,1]. */
  x0: Float32Array;
  /** 0-based index into the run. */
  step: number;
  /** Total steps in this run. */
  total: number;
}

/** The module's own schedule helper. The site has no reason to call it; it's
 *  declared only so the module's surface is fully typed. */
export declare function cosineAlphasCumprod(
  steps: number,
  s?: number,
): Float64Array;

/**
 * Module capability flag. v1 (the current 128 bundle) does NOT export this —
 * it reads as `undefined`. The v2 module (shipping with the 256 bundle, or
 * earlier on its own) exports `2`. ⚠️ THE FLAG IS THE ONLY SAFE CAPABILITY
 * TEST: v1's generate() silently IGNORES unknown options, so passing `init`
 * to it would run a full from-noise sample while the UI claims a morph.
 * Never feature-detect by passing the option.
 */
export declare const MODULE_VERSION: number | undefined;

export interface HeadshotGenerateOptions {
  /**
   * v2 ONLY (gate on MODULE_VERSION >= 2). Transition mode: the currently
   * displayed sample, [1,3,res,res] planar C-order in [-1,1]. The module
   * forward-noises it to t = round(strength·(T−1)) and runs the normal
   * conditioned descent from there; steps (and onFrame count) scale down,
   * `total` tells the real count. Hand the module a COPY — the site keeps its
   * own buffer.
   */
  init?: Float32Array | null;
  /** v2 ONLY, only meaningful with `init`. 0..1; module default 0.55. The site
   *  deliberately does not pass it: the module's default is the tuned one. */
  strength?: number | null;
  /**
   * A live onnxruntime-web `InferenceSession` for the headshot graph.
   *
   * Typed against the runtime rather than left `unknown`: `lib/headshot-model.ts`
   * imports `onnxruntime-web/webgpu` (the same specifier the draw demo and the
   * chess worker use, so the module instance and its wasm are shared), and
   * `import type` costs nothing at runtime.
   */
  session: import("onnxruntime-web/webgpu").InferenceSession;
  /** The ORT module itself. The module constructs its own tensors rather than
   *  importing ORT, which is what lets the caller own wasmPaths and providers. */
  ort: typeof import("onnxruntime-web/webgpu");
  meta: HeadshotMeta;
  /** Which photo to sample. Integer in 0..meta.k-1; the module throws otherwise. */
  classIdx: number;
  /** Defaults to `meta.steps_default` (25). */
  steps?: number | null;
  /** Fires per step AS IT COMPUTES, then the module yields to the event loop.
   *  Render inside it: the computation is the animation. */
  onFrame?: ((frame: HeadshotFrame) => void) | null;
  /** Reproducible noise. Left null, every run draws fresh noise, which is the
   *  point of the resample button. */
  seed?: number | null;
  /** Parity-test escape hatch: explicit initial noise, length channels*res*res. */
  noise?: Float32Array | null;
}

/** Runs the reverse process for one class and resolves to the final x0 (already
 *  clamped). The last frame handed to `onFrame` is that same sample. */
export declare function generate(
  opts: HeadshotGenerateOptions,
): Promise<Float32Array>;
