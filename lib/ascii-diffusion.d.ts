/**
 * Types for the vendored `ascii-diffusion.js`, shipped from the model repo.
 *
 * Hand-written to match that module — do not edit the .js, and re-check this
 * against it when a new version lands. The module owns ALL model math:
 * preprocessing, the noise schedule, the sampler, guidance, and the ASCII
 * mapping. It's pinned against the PyTorch reference (sampler max|Δ| 7.9e-6),
 * so a "fix" here is almost certainly a bug.
 */

export declare const RAMP: string;
/** 14 rows x 28 cols. The aspect correction is already applied on the model
 *  side by averaging row pairs — never reshape frames to 28x28. */
export declare const ROWS: number;
export declare const COLS: number;
export declare function cosineAlphasCumprod(t: number): Float64Array;
export declare function toAscii(x784: Float32Array): string[];

/** Which half of the run a frame came from. `total` and `step` span both. */
export type Phase = "dissolve" | "denoise";

export type AsciiFrame = {
  phase: Phase;
  /** Numbered continuously across dissolve + denoise. */
  step: number;
  total: number;
  /** The current state. RENDER THIS — it's the drawing coming apart and re-forming. */
  xt: Float32Array;
  /** The model's guess at the finished digit. Held still during the dissolve. */
  x0: Float32Array;
  ascii: { xt: string[]; x0: string[] };
};

export type GenerateOptions = {
  /** The canvas the visitor drew on. Any size; square is best. */
  canvas: HTMLCanvasElement;
  /** REQUIRED 0-9. The model is class-conditional and cannot infer it. */
  digit: number;
  /** SDEdit noise level: 0 keeps the drawing, 1 ignores it. 0.6 is tuned. */
  strength?: number;
  /** Denoise steps — the model actually running, one forward each. */
  steps?: number;
  guidance?: number;
  /** Forward-process frames before the model runs. Closed form, so they cost
   *  nothing: no model calls, no GPU. Purely so the drawing is seen coming
   *  apart instead of cutting straight to static. */
  dissolve?: number;
  /** Fires per frame AS IT COMPUTES. Render inside it. */
  onFrame?: (frame: AsciiFrame) => void;
  /** Fixed seed, for reproducible runs. */
  seed?: number | null;
  /** Escape hatches used by the model repo's parity tests. */
  x0Init?: Float32Array | null;
  noise?: Float32Array | null;
};

export declare class AsciiDiffusion {
  readonly ready: boolean;
  /** The ORT session the module was loaded with. The site only ever calls
   *  `release()` on it (stargaze offload, lib/draw-model.ts). */
  readonly session: { release(): Promise<void> };
  /** Starts the ~26MB ONNX download. `ort` is injected rather than imported by
   *  the module, so the caller controls wasmPaths and the execution providers. */
  static load(
    modelUrl: string,
    opts?: { ort?: unknown; executionProviders?: string[] },
  ): Promise<AsciiDiffusion>;
  /**
   * Canvas -> Float32Array(784) in [0,1]: what the model actually sees. Drives
   * the live preview, which is the oracle for pen width.
   *
   * `inkIsHigh` defaults to FALSE, i.e. the module assumes dark ink on light
   * paper and inverts. Our canvas is white ink on near-black, so it must pass
   * true — otherwise the model gets a photographic negative, which is
   * off-distribution and comes back as garbage.
   */
  preprocess(
    canvas: HTMLCanvasElement,
    opts?: { inkIsHigh?: boolean },
  ): Float32Array;
  toAscii(x784: Float32Array): string[];
  generate(options: GenerateOptions): Promise<void>;
}
