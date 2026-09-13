/**
 * Types for the vendored `headshot-diffusion.js` (v2), shipped from the
 * headshot model repo (`~/Documents/headshot_diffusion/dist/`).
 *
 * Hand-written to match that module, adapted from the bundle's starter .d.ts —
 * the house rule is that the site types its own copy, so re-check this against
 * the .js when a new version lands, and never edit the .js. That module owns
 * ALL model math: the cosine schedule, the DDIM (eta = 0) step, the descending
 * timestep sequence, the transition mode's forward-noising, and the per-step
 * clamp. ONE MODULE DRIVES BOTH MODELS — the 256 primary and the 128 fallback
 * differ only in the meta handed to `generate`. It is pinned against the
 * PyTorch reference on both (vendored JS + ONNX wasm vs PyTorch: max|Δ|
 * 3.14e-5 at 256, 6.71e-6 at 128), so a "fix" here is almost certainly a bug.
 *
 * Two things the site must respect, both of which produce plausible-looking
 * wrong output rather than an error:
 *   - `t` is module-internal. The site never passes a timestep; the module
 *     builds the raw 0..999 sequence itself.
 *   - `x0` frames are ALREADY clamped to [-1,1] (`meta.output_clamp`). Do not
 *     clamp again. `xt` frames are unbounded and must be clamped/mapped for
 *     display.
 *
 * The module exports no version marker. Capability facts about it live in
 * `lib/headshot-module-info.ts`, the hand-maintained sibling of this file.
 */

/** Exactly the shape of a bundled `*_meta.json`. Read every one of these from
 *  the file, never hardcode them: the 256 and the 128 ship DIFFERENT metas
 *  (res 256 vs 128) and a retrained export changes more. */
export interface HeadshotMeta {
  /** Guarded by `lib/headshot-model.ts`; a bump means re-read the contract. */
  version: 1;
  /** Side length R. Frames are [1, channels, R, R]. Per model, never shared. */
  res: number;
  channels: number;
  /** How many classes (= source photos), so how many buttons. */
  k: number;
  schedule: { type: "cosine"; T: number; s?: number };
  steps_default: number;
  t_input: "float32";
  /** True for both exports: the module clamps x0 every step. */
  output_clamp: boolean;
}

export interface HeadshotFrame {
  /**
   * The current state x_t, Float32Array [1, channels, R, R] in C-order
   * (channel-planar, NOT interleaved RGBA), R = the run's resolution.
   *
   * UNBOUNDED: the first frames are near-raw Gaussian noise, so clamp to
   * [-1,1] before mapping to bytes or the display wraps around.
   */
  xt: Float32Array;
  /** The model's x0 estimate at this step, already clamped to [-1,1]. */
  x0: Float32Array;
  /** 0-based index into the run. */
  step: number;
  /** Total steps in THIS run. Transition mode runs fewer than `steps`. */
  total: number;
}

/** The module's own schedule helper. The site has no reason to call it; it's
 *  declared only so the module's surface is fully typed. */
export declare function cosineAlphasCumprod(
  steps: number,
  s?: number,
): Float64Array;

export interface HeadshotGenerateOptions {
  /**
   * Transition mode: the currently displayed sample, [1, channels, R, R]
   * planar C-order in [-1,1], length `channels*R*R` for the LOADED model's R.
   * The module forward-noises it to t = round(strength·(T−1)) and runs the
   * normal conditioned descent from there; the step count (and so the onFrame
   * count) scales down, and `total` on each frame tells the real number. Hand
   * the module a COPY — the site keeps its own buffer.
   *
   * Wrong-length input throws, which is the one honest failure mode: the two
   * model families have different R, so a buffer from the other family must
   * never be fed in (`lib/headshot-model.ts` picks one family per session and
   * the component length-checks besides).
   */
  init?: Float32Array | null;
  /** Only meaningful with `init`. (0,1]; module default 0.55, which is the
   *  tuned one — the site deliberately does not pass it. Higher = more steps
   *  survive the filter = a longer visible morph away from `init`. */
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
  /** Which photo to sample. Integer in 0..meta.k-1; the module throws
   *  otherwise. Required unless `classWeights` is given, which the site never
   *  does. */
  classIdx: number;
  /** Defaults to `meta.steps_default` (25 on both exports). */
  steps?: number | null;
  /** Fires per step AS IT COMPUTES, then the module yields to the event loop.
   *  Render inside it: the computation is the animation. */
  onFrame?: ((frame: HeadshotFrame) => void) | null;
  /** Reproducible noise. Left null, every run draws fresh noise, which is the
   *  point of the resample button. */
  seed?: number | null;
  /** Parity-test escape hatch: explicit initial noise, length channels*R*R. */
  noise?: Float32Array | null;
  /**
   * Generation resolution instead of `meta.res`; must be a positive integer
   * divisible by 8, and only the dynamic-shape 256 graph accepts anything
   * but its own res (the 128 graph's shape is frozen and rejects it).
   *
   * ⚠️ THE SITE NEVER PASSES THIS. The bundle's README calls it exploratory:
   * off the trained resolution the model is off-distribution by design, so a
   * control wired to it would be showing visitors artifacts as if they were
   * the model. Declared so the module's surface is typed, nothing more.
   */
  size?: number | null;
  /**
   * Replaces the one-hot `c` tensor with arbitrary weights (or a per-step
   * function of them), used as given with no normalization.
   *
   * ⚠️ THE SITE NEVER PASSES THIS either, and for the same reason: off the
   * training simplex the output is not a face the owner approved, which is
   * the safety property the overfit model is relied on for.
   */
  classWeights?:
    | Float32Array
    | number[]
    | ((step: number, total: number) => Float32Array | number[])
    | null;
}

/** Runs the reverse process for one class and resolves to the final x0 (already
 *  clamped). The last frame handed to `onFrame` is that same sample. */
export declare function generate(
  opts: HeadshotGenerateOptions,
): Promise<Float32Array>;
