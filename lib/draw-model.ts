/**
 * Loads the live draw-a-digit model.
 *
 * Named draw-model, not ascii-diffusion, because `lib/ascii-diffusion.js` is the
 * vendored module from the model repo and would collide on the same specifier.
 * That module owns all the math; this file owns loading it.
 */
import type { AsciiDiffusion } from "./ascii-diffusion";
import { noteOffload } from "./stargaze";

export type { AsciiFrame, Phase } from "./ascii-diffusion";

export const MODEL_URL = "/models/mnist_x0.onnx";

/** SDEdit noise level. 0.6 is tuned: it noises ~60% of the way to static, which
 *  is why the visitor's own slant and strokes survive into the output. Starting
 *  at 60% is also why 20 steps is enough rather than 32. */
export const DEFAULT_STRENGTH = 0.6;
export const DEFAULT_STEPS = 20;
export const DEFAULT_GUIDANCE = 2.0;
/** Forward-process frames. Closed form, so they're free — no model calls at all.
 *  They exist purely so the drawing is watched coming apart. */
export const DEFAULT_DISSOLVE = 10;

let cache: Promise<AsciiDiffusion | null> | null = null;

/**
 * Resolves the model, or null if the weights aren't deployed.
 *
 * Pulls ~26MB of ONNX plus ~26MB of wasm runtime, so call it on first
 * interaction (pointer-down on the canvas), never on page load. Visitors who
 * never draw shouldn't pay for it.
 */
export function loadDrawModel(): Promise<AsciiDiffusion | null> {
  if (cache) return cache;
  cache = (async () => {
    // Probe first: cheap, and it keeps the UI gated rather than throwing if the
    // weights aren't deployed.
    try {
      const res = await fetch(MODEL_URL, { method: "HEAD" });
      if (!res.ok) return null;
    } catch {
      return null;
    }

    // Both dynamic: neither the runtime nor the module belongs in the main bundle.
    const [{ AsciiDiffusion: AD }, ort] = await Promise.all([
      import("./ascii-diffusion.js"),
      import("onnxruntime-web/webgpu"),
    ]);

    // ORT fetches its wasm at runtime, so it needs a served path. Vendored into
    // public/ort/ by scripts/sync-ort.mjs — never a CDN.
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.logLevel = "error";
    // Threaded wasm needs SharedArrayBuffer, which needs COOP/COEP headers. Those
    // would break cross-origin embeds site-wide for one demo, so stay
    // single-threaded unless the page happens to be isolated already.
    if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

    // The module injects `ort` rather than importing it, so this controls the
    // providers: WebGPU where available, wasm everywhere else.
    return AD.load(MODEL_URL, { ort, executionProviders: ["webgpu", "wasm"] });
  })().catch((err) => {
    cache = null; // let a later attempt retry rather than caching the failure
    throw err;
  });
  return cache;
}

/**
 * Stargaze offload: release the session and reset the memo, so the next
 * `loadDrawModel()` builds a fresh one (weights from the HTTP cache). Call
 * only while nothing is running on the session: DrawDigit waits for its
 * cancelled run to settle first (the one-session exclusion).
 *
 * ⚠️ Honest limit: this frees space INSIDE the main thread's ORT WebAssembly
 * heap, which never shrinks; the tab's footprint stays at its high-water
 * mark until a reload. Only a worker (like chess) truly gives memory back.
 */
export async function unloadDrawModel(): Promise<void> {
  const pending = cache;
  cache = null;
  if (!pending) return;
  const model = await pending.catch(() => null);
  if (!model) return;
  await model.session.release();
  noteOffload("draw");
}
