/**
 * Loads the live headshot diffusion model (the masthead's author photo toy).
 *
 * Named headshot-model, not headshot-diffusion, because
 * `lib/headshot-diffusion.js` is the vendored module from the model repo and
 * would collide on the same specifier. That module owns all the math; this
 * file owns loading it, and choosing WHICH of the two shipped models to load.
 * Same split as `lib/draw-model.ts` / `lib/ascii-diffusion.js`.
 *
 * ⚠️ EVERY PATH HERE IS UNDER `/headshot/v2/`. `/headshot/:path*` is served
 * `immutable` for a year (next.config.ts), so a retrained export cannot reuse a
 * filename: the v2 bundle changed the weights, the metas AND the photo bytes,
 * so all of it moved under a new directory. The v1 files are deleted; their
 * URLs are dead by design.
 *
 * Gate, per the Constitution: if neither family's files are deployed this
 * resolves `null` and the toy stays a plain photo. A malformed meta throws
 * instead of resolving null (same split as `lib/jepa.ts`): absent means "never
 * shipped, so gate", present-and-wrong means "a bug in the export that
 * swallowing would hide forever".
 */
import type { HeadshotMeta, generate as Generate } from "./headshot-diffusion";
import { MODULE_SUPPORTS_TRANSITIONS } from "./headshot-module-info";

/** The 256 primary: fp32 only, dynamic H/W axes, native training resolution.
 *  There is deliberately no int8 here — the bundle quantized it, measured
 *  30.5 dB PSNR against the fp32 samples on class 1, missed its own ≥35 dB
 *  gate, and discarded the artifact. */
export const META_256_URL = "/headshot/v2/headshot256_meta.json";
export const MODEL_256_URL = "/headshot/v2/headshot256.onnx";

/** The 128 fallback family. int8 first for the same reason chess ships int8 in
 *  the browser: 1.55 MB of download versus 5.29 MB, and this one measures
 *  35-39 dB PSNR against the fp32 samples (visually indistinguishable). */
export const META_128_URL = "/headshot/v2/headshot128_meta.json";
export const MODEL_128_INT8_URL = "/headshot/v2/headshot128_int8.onnx";
export const MODEL_128_FP32_URL = "/headshot/v2/headshot128.onnx";

/** Where the approved crops live, for the component and the server gate. */
export const PHOTO_BASE = "/headshot/v2/photos";

/** Which weights the browser actually got. Surfaced in the UI, because each of
 *  these is a claim and a silent fallback would make it false. */
export type HeadshotBuild = "256" | "128 int8" | "128";

export type HeadshotModel = {
  /** The chosen model's OWN meta. `res` differs between the families (256 vs
   *  128), so nothing downstream may assume one of them. */
  meta: HeadshotMeta;
  session: import("onnxruntime-web/webgpu").InferenceSession;
  ort: typeof import("onnxruntime-web/webgpu");
  build: HeadshotBuild;
  /**
   * Whether the vendored sampler supports transition mode (init/strength).
   * Read from `lib/headshot-module-info.ts`, the hand-maintained sibling of
   * the vendored module — NOT sniffed off the module, which exports no version
   * marker, and never feature-detected by passing the option: v1's generate()
   * silently ignored unknown options, so a probe would have run a full
   * from-noise sample while the UI claimed a morph.
   */
  canMorph: boolean;
  /**
   * The vendored sampler, handed out with the session so the component has
   * exactly one thing to await. One module drives both models. Dynamically
   * imported here for the same reason the runtime is: neither belongs in the
   * main bundle, and the masthead is first paint.
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

/** Fetches and validates one family's meta. `null` = not served (gate or fall
 *  through to the other family); a throw = served and wrong. */
async function fetchMeta(url: string): Promise<HeadshotMeta | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const meta = (await res.json()) as HeadshotMeta;
  if (meta?.version !== 1) {
    throw new Error(
      `${url} version ${String(meta?.version)} is not 1; re-read the contract in lib/headshot-diffusion.d.ts before bumping this guard`,
    );
  }
  if (!meta.res || !meta.channels || !meta.k || !meta.schedule?.T) {
    throw new Error(`${url} is missing res/channels/k/schedule.T`);
  }
  return meta;
}

/**
 * Does this device get the 256 primary (5.29 MB fp32, ~4x the pixels per step)
 * or the 128 family (1.55 MB int8)?
 *
 * House rule on the connection APIs, inherited from `lib/warm.ts`: they are
 * Chrome-only, so ABSENT MEANS UNKNOWN, NOT NO. Only a value that is present
 * and bad vetoes. The positive requirements are the ones that are reliable
 * everywhere: cross-origin isolation (so wasm gets threads — the 256 at one
 * thread is a long wait for a masthead), 4+ cores, and a viewport that isn't a
 * phone.
 */
function wantsPrimary(): boolean {
  if (!globalThis.crossOriginIsolated) return false;
  const nav = globalThis.navigator as
    | (Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      })
    | undefined;
  if (!nav) return false;
  if ((nav.hardwareConcurrency ?? 0) < 4) return false;
  if (!globalThis.matchMedia?.("(min-width: 768px)").matches) return false;
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  return true;
}

/**
 * Resolves the model, or null if neither family is deployed.
 *
 * ⚠️ Call this on first interaction (a press on a face button), never on page
 * load or on mount. This sits in the masthead, which is the first thing
 * painted, and it pulls the ~24 MB onnxruntime-web runtime plus 1.55-5.29 MB of
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
    // 1. Presence first, budget second. The device policy picks an ORDER;
    // what is actually served decides. A deploy carrying only one family
    // (or a half-uploaded one) gets the family it has rather than a gate.
    const [has256, has128Int8, has128Fp32] = await Promise.all([
      served(MODEL_256_URL),
      served(MODEL_128_INT8_URL),
      served(MODEL_128_FP32_URL),
    ]);
    const has128 = has128Int8 || has128Fp32;
    if (!has256 && !has128) return null;

    const preferred: ("256" | "128")[] =
      wantsPrimary() && has256 ? ["256", "128"] : ["128", "256"];
    // Filtered by what is served, so the LAST entry really is the last chance:
    // a session failure there throws (an error the visitor is told about)
    // rather than falling through to a family that was never deployed and
    // gating, which would read to them as "the model isn't deployed".
    const order = preferred.filter((f) => (f === "256" ? has256 : has128));

    const [mod, ort] = await Promise.all([
      import("./headshot-diffusion.js"),
      import("onnxruntime-web/webgpu"),
    ]);
    const { generate } = mod;
    const canMorph = MODULE_SUPPORTS_TRANSITIONS;
    // ORT fetches its wasm at runtime, so it needs a served path. Vendored into
    // public/ort/ by scripts/sync-ort.mjs — never a CDN.
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.logLevel = "error";
    // Threaded wasm needs SharedArrayBuffer, which needs COOP/COEP. The site
    // sets those on every route, but a context that isn't isolated (an embed,
    // a stripped proxy) must not ask for threads it can't have.
    if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

    // wasm only, deliberately. The bundle's parity pins (max|Δ| 3.14e-5 at 256,
    // 6.71e-6 at 128) were measured on the wasm EP, and CLAUDE.md's standing
    // rule is not to ship WebGPU unmeasured — int8-on-WebGPU is also poorly
    // supported.
    const opts = { executionProviders: ["wasm"] } as const;

    for (let i = 0; i < order.length; i++) {
      const family = order[i];
      const last = i === order.length - 1;

      if (family === "256") {
        if (!has256) continue;
        const meta = await fetchMeta(META_256_URL);
        if (!meta) continue; // weights without a meta: try the other family
        try {
          const session = await ort.InferenceSession.create(MODEL_256_URL, opts);
          return { meta, session, ort, generate, canMorph, build: "256" as const };
        } catch (err) {
          if (last) throw err;
          console.warn("headshot: 256 session failed, falling back to the 128 family", err);
        }
        continue;
      }

      if (!has128) continue;
      const meta = await fetchMeta(META_128_URL);
      if (!meta) continue;
      // 2. int8, falling back to fp32 — the chess precedent: losing the "int8"
      // label costs nothing user-visible, a runtime that rejects the quantized
      // graph and leaves a dead button costs everything. The label follows the
      // graph that actually loaded, so it can never lie.
      if (has128Int8) {
        try {
          const session = await ort.InferenceSession.create(MODEL_128_INT8_URL, opts);
          return { meta, session, ort, generate, canMorph, build: "128 int8" as const };
        } catch (err) {
          if (!has128Fp32) {
            if (last) throw err;
            console.warn("headshot: 128 int8 session failed and no fp32 is served", err);
            continue;
          }
          console.warn("headshot: 128 int8 session failed, falling back to fp32", err);
        }
      }
      try {
        const session = await ort.InferenceSession.create(MODEL_128_FP32_URL, opts);
        return { meta, session, ort, generate, canMorph, build: "128" as const };
      } catch (err) {
        if (last) throw err;
        console.warn("headshot: 128 fp32 session failed, trying the 256 primary", err);
      }
    }
    return null;
  })().catch((err) => {
    cache = null; // let a later press retry rather than caching the failure
    throw err;
  });
  return cache;
}
