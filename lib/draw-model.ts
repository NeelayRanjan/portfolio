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
 * The in-flight `unloadDrawModel()`, if any — set by that function to the
 * exact work it's doing (releasing the previous session), cleared back to
 * null once that work settles. `loadDrawModel()` awaits this before doing
 * anything else: without it, a stargaze round trip quick enough to start a
 * new download while the old session's `release()` is still pending could
 * briefly hold two ~26MB sessions in the same never-shrinking main-thread
 * wasm heap at once (task-7 fix round 2, N1/N2 — moved here from a
 * component-level wait that only covered one of the two load call sites and
 * lost track of "was the model wanted" while it waited).
 */
let unloading: Promise<void> | null = null;

/**
 * Resolves the model, or null if the weights aren't deployed.
 *
 * Pulls ~26MB of ONNX plus ~26MB of wasm runtime, so call it on first
 * interaction (pointer-down on the canvas), never on page load. Visitors who
 * never draw shouldn't pay for it.
 */
export function loadDrawModel(): Promise<AsciiDiffusion | null> {
  if (cache) return cache;
  const p: Promise<AsciiDiffusion | null> = (async () => {
    // See `unloading`'s doc comment: a session still being released must
    // finish before this one starts building a new one.
    if (unloading) await unloading.catch(() => {});
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
      import("onnxruntime-web/wasm"),
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
    // providers. wasm only, since 2026-09-16: the demo used to ask for
    // ["webgpu", "wasm"] through the `onnxruntime-web/webgpu` entry, and that
    // entry always fetches ORT's asyncify wasm build, whatever provider ends
    // up running. JavaScriptCore's optimizing wasm tier runs away on that
    // build (ORT issue 26827; measured in WebKitGTK: ~395% CPU and 5.3 to
    // 11.5 GB of RSS in a minute of idle after one generate), which is what
    // crashed this demo on every iPhone. The `/wasm` entry fetches the plain
    // build, which measured flat at ~800 MB. No WebGPU speed number was ever
    // measured for this 28x28 batch-2 model; the verify suite only ever
    // proved the wasm path. See scripts/probe-webkit-draw.py.
    return AD.load(MODEL_URL, { ort, executionProviders: ["wasm"] });
  })().catch((err) => {
    // Identity guard: an older failed load must not wipe a newer `cache` a
    // stargaze round trip has since installed. Without this, that newer
    // load's session (or worker) is never released by unloadDrawModel, which
    // finds `cache === null` and does nothing, and the next load builds a
    // second one alongside it.
    if (cache === p) cache = null; // let a later attempt retry rather than caching the failure
    throw err;
  });
  cache = p;
  return p;
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
 *
 * Records its own work in `unloading` so a `loadDrawModel()` that starts
 * before this settles waits for it rather than racing it.
 */
export async function unloadDrawModel(): Promise<void> {
  const pending = cache;
  cache = null;
  if (!pending) return;
  const work = (async () => {
    const model = await pending.catch(() => null);
    if (!model) return;
    await model.session.release();
    noteOffload("draw");
  })();
  unloading = work;
  try {
    await work;
  } finally {
    if (unloading === work) unloading = null;
  }
}
