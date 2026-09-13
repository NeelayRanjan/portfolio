/**
 * Loads the live headshot diffusion model (the masthead's author photo toy).
 *
 * Named headshot-model, not headshot-diffusion, because
 * `lib/headshot-diffusion.js` is the vendored module from the model repo and
 * would collide on the same specifier. That module owns all the math; this
 * file owns loading it. Same split as `lib/draw-model.ts` /
 * `lib/ascii-diffusion.js`.
 *
 * Gate, per the Constitution: if the meta or both model files aren't deployed
 * this resolves `null` and the toy stays a plain photo. A malformed meta
 * throws instead of resolving null (same split as `lib/jepa.ts`): absent means
 * "never shipped, so gate", present-and-wrong means "a bug in the export that
 * swallowing would hide forever".
 */
import type { HeadshotMeta, generate as Generate } from "./headshot-diffusion";

export const META_URL = "/headshot/headshot_meta.json";
/** int8 first for the same reason chess ships int8 in the browser: 1.55 MB of
 *  download versus 5.29 MB, and int8 measures 35-39 dB PSNR against the fp32
 *  samples (visually indistinguishable). */
export const MODEL_INT8_URL = "/headshot/headshot_int8.onnx";
export const MODEL_FP32_URL = "/headshot/headshot.onnx";

/** Which weights the browser actually got. Surfaced in the UI, because "int8"
 *  is a claim and the fallback would quietly make it false. */
export type HeadshotBuild = "int8" | "fp32";

export type HeadshotModel = {
  meta: HeadshotMeta;
  session: import("onnxruntime-web/webgpu").InferenceSession;
  ort: typeof import("onnxruntime-web/webgpu");
  build: HeadshotBuild;
  /**
   * Whether the vendored sampler supports transition mode (init/strength),
   * read off its MODULE_VERSION export at load time. v1 exports none and
   * SILENTLY IGNORES unknown generate() options, so this flag — never
   * option-passing — is the only safe capability test: feeding `init` to v1
   * would run a full from-noise sample while the UI claims a morph. Flips to
   * true the moment the v2 module file replaces lib/headshot-diffusion.js.
   */
  canMorph: boolean;
  /**
   * The vendored sampler, handed out with the session so the component has
   * exactly one thing to await. Dynamically imported here for the same reason
   * the runtime is: neither belongs in the main bundle, and the masthead is
   * first paint.
   */
  generate: typeof Generate;
};

let cache: Promise<HeadshotModel | null> | null = null;

/** HEAD probe. Cheap, and it keeps the UI gated rather than throwing when the
 *  weights aren't deployed. */
async function served(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolves the model, or null if the bundle isn't deployed.
 *
 * ⚠️ Call this on first interaction (a press on a face button), never on page
 * load or on mount. This sits in the masthead, which is the first thing
 * painted, and it pulls the ~24 MB onnxruntime-web runtime plus 1.55 MB of
 * weights. Visitors who never press a face must not pay for it.
 *
 * Memoized, so a second press reuses the same promise rather than downloading
 * again — and the ORT dynamic import is the SAME specifier
 * (`onnxruntime-web/webgpu`) the draw demo and the chess worker use, so module
 * caching hands back the instance already in memory if either has loaded.
 */
export function loadHeadshotModel(): Promise<HeadshotModel | null> {
  if (cache) return cache;
  cache = (async () => {
    // 1. The meta. Absent -> gate; present and wrong -> throw.
    let metaRes: Response;
    try {
      metaRes = await fetch(META_URL);
    } catch {
      return null;
    }
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as HeadshotMeta;
    if (meta?.version !== 1) {
      throw new Error(
        `headshot_meta.json version ${String(meta?.version)} is not 1; re-read the contract in lib/headshot-diffusion.d.ts before bumping this guard`,
      );
    }
    if (!meta.res || !meta.channels || !meta.k || !meta.schedule?.T) {
      throw new Error("headshot_meta.json is missing res/channels/k/schedule.T");
    }

    // 2. The weights. Probed before importing 24 MB of runtime for nothing.
    const hasInt8 = await served(MODEL_INT8_URL);
    const hasFp32 = await served(MODEL_FP32_URL);
    if (!hasInt8 && !hasFp32) return null;

    const [mod, ort] = await Promise.all([
      import("./headshot-diffusion.js"),
      import("onnxruntime-web/webgpu"),
    ]);
    const { generate } = mod;
    // Index access, not a named import: the binding doesn't exist in v1, and
    // bundlers reject a missing NAMED export at build time.
    const canMorph =
      (((mod as Record<string, unknown>).MODULE_VERSION as number | undefined) ?? 1) >= 2;
    // ORT fetches its wasm at runtime, so it needs a served path. Vendored into
    // public/ort/ by scripts/sync-ort.mjs — never a CDN.
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.logLevel = "error";
    // Threaded wasm needs SharedArrayBuffer, which needs COOP/COEP. The site
    // sets those on every route, but a context that isn't isolated (an embed,
    // a stripped proxy) must not ask for threads it can't have.
    if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

    // wasm only, deliberately. The bundle's parity pin (max|Δ| 6.71e-6) was
    // measured on the wasm EP, and CLAUDE.md's standing rule is not to ship
    // WebGPU unmeasured — int8-on-WebGPU is also poorly supported.
    const opts = { executionProviders: ["wasm"] } as const;

    // 3. int8, falling back to fp32 — the chess precedent: losing the "int8"
    // label costs nothing user-visible, a runtime that rejects the quantized
    // graph and leaves a dead button costs everything.
    if (hasInt8) {
      try {
        const session = await ort.InferenceSession.create(MODEL_INT8_URL, opts);
        return { meta, session, ort, generate, canMorph, build: "int8" as const };
      } catch (err) {
        if (!hasFp32) throw err;
        console.warn("headshot: int8 session failed, falling back to fp32", err);
      }
    }
    const session = await ort.InferenceSession.create(MODEL_FP32_URL, opts);
    return { meta, session, ort, generate, canMorph, build: "fp32" as const };
  })().catch((err) => {
    cache = null; // let a later press retry rather than caching the failure
    throw err;
  });
  return cache;
}
