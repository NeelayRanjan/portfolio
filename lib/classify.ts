/**
 * Zero-shot digit classification using the diffusion model itself.
 *
 * No second model, no extra weights. The model is class-conditional, so ask it
 * to predict the finished digit under every label from the *same* noise, and
 * take whichever label best explains the drawing. This is the standard
 * "your diffusion model is secretly a classifier" trick, cut down to one
 * timestep because a portfolio demo can't spend seconds on a label.
 *
 * IT IS A SUGGESTION, NOT A VERDICT. The picker stays visible and overridable:
 * the model handoff is explicit that a silent misclassification reads as the
 * diffusion failing when it didn't. Showing the guessed label, and letting it be
 * corrected, keeps the blame where it belongs.
 *
 * All model math still lives in ascii-diffusion.js — this only calls it.
 */
import type { AsciiDiffusion } from "./ascii-diffusion";
import { StargazeAbort } from "./stargaze";

/**
 * Noise level to judge at. HIGH, and counter-intuitively so.
 *
 * Low noise fails badly: the drawing survives, so the model echoes it back
 * whatever the label and all 10 scores land within ~0.001 of each other. There's
 * nothing to rank. High noise erases the drawing, so the prediction is driven by
 * the LABEL and each candidate returns that class's prototype — which turns this
 * into template matching against model-generated templates, and that separates
 * cleanly.
 *
 * Measured against the 10 clean digits in diffusion_traj.json (this model's own
 * output), 2 steps, guidance 1:
 *   0.25 -> 4/10   0.40 -> 3/10   0.55 -> 3/10   0.70 -> 4/10
 *   0.80 -> 9/10   0.85 -> 10/10  0.90 -> 10/10  0.95 -> 10/10
 * A plateau, not a spike, and winners take it by ~2x on the runner-up. Don't
 * lower this toward the generation strength (0.6) on the assumption they should
 * match — they measure different things.
 */
const CLASSIFY_STRENGTH = 0.85;
/** The module divides by (steps - 1), so 1 is a division by zero. 2 is the floor,
 *  and only the first frame is read. */
const CLASSIFY_STEPS = 2;
/** guidance 1 collapses the CFG mix to the pure conditional prediction:
 *  x0 = uncond + 1*(cond - uncond) = cond. Anything else blends the null class
 *  back in and blunts the very signal being measured. */
const CLASSIFY_GUIDANCE = 1;
/** Any fixed value. What matters is that all 10 labels see identical noise —
 *  otherwise the comparison measures the RNG, not the digit. */
const NOISE_SEED = 0x5eed;
/** Sentinel to bail out of generate() after the one frame we read. */
const ABORT = Symbol("classify-abort");

export type Classification = {
  digit: number;
  /** Reconstruction error per label, index 0-9. Lower is a better fit. */
  scores: number[];
  /** Gap between best and runner-up, relative to the spread. ~0 means a
   *  coin-flip between two labels; higher means the model is sure. */
  margin: number;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One fixed noise vector, shared across all 10 candidate labels. */
function seededNoise(n: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.max(rnd(), 1e-9);
    out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  }
  return out;
}

function mse(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s / a.length;
}

/**
 * Scores every label against the drawing and returns the best fit.
 *
 * `x0Init` must already be in model space ([-1,1]) — see DrawDigit's modelSpace().
 * Costs 10 x CLASSIFY_STEPS forwards, ~0.3-0.5s in WASM. Yields between labels,
 * so the UI stays responsive.
 */
export async function classifyDrawing(
  model: AsciiDiffusion,
  canvas: HTMLCanvasElement,
  x0Init: Float32Array,
  shouldAbort?: () => boolean,
): Promise<Classification> {
  const noise = seededNoise(x0Init.length, NOISE_SEED);
  const scores: number[] = [];

  for (let digit = 0; digit < 10; digit++) {
    // Stargaze cancel, checked between reconstructions: at most one forward
    // late, and the session is idle here (the previous generate() settled).
    if (shouldAbort?.()) throw new StargazeAbort();
    let pred: Float32Array | null = null;
    try {
      await model.generate({
        canvas, // unused: x0Init takes over the init path, but the API wants it
        x0Init,
        digit,
        strength: CLASSIFY_STRENGTH,
        steps: CLASSIFY_STEPS,
        dissolve: 0,
        guidance: CLASSIFY_GUIDANCE,
        noise,
        // Only the first prediction matters — that's the model's answer to
        // "what finished digit explains this, given label d?". The module has
        // no early exit and its step floor is 2, so throwing out of onFrame is
        // how the second (unread) forward gets skipped. That halves the work:
        // 10 forwards instead of 20, and a classify has to feel instant.
        // Each generate() call is independent, so bailing leaves nothing dirty.
        onFrame: (f) => {
          pred = f.x0;
          throw ABORT;
        },
      });
    } catch (err) {
      if (err !== ABORT) throw err;
    }
    scores.push(pred ? mse(pred, x0Init) : Infinity);
    // Yield. generate() normally yields after each onFrame, but bailing out of
    // onFrame skips that — so without this the 10 labels run back-to-back with
    // no return to the event loop and the page locks up for the whole classify.
    await new Promise((r) => setTimeout(r, 0));
  }

  let best = 0;
  for (let d = 1; d < 10; d++) if (scores[d] < scores[best]) best = d;

  const sorted = [...scores].sort((a, b) => a - b);
  const spread = sorted[sorted.length - 1] - sorted[0] || 1;
  const margin = (sorted[1] - sorted[0]) / spread;

  return { digit: best, scores, margin };
}
