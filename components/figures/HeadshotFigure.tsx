import fs from "node:fs";
import path from "node:path";
import { HeadshotToy } from "./HeadshotToy";
import type { HeadshotMeta } from "@/lib/headshot-diffusion";

/** Both families' metas, primary first. The gate needs `k` (how many buttons)
 *  and a starting `res` for the SSR canvas attributes; which model a given
 *  device actually loads is decided in the browser by `lib/headshot-model.ts`,
 *  so the client re-reads `res` off the loaded meta and this is only a
 *  sensible default. `k` is the same 3 in both, and the loader asserts each
 *  meta it uses. */
const META_FILES = ["headshot256_meta.json", "headshot128_meta.json"];

/**
 * The masthead rail's author photo, which is a live diffusion sample rather
 * than a file. `HeadshotToy` is the client half; this is the gate.
 *
 * Gated on the bundle's absence per the Constitution ("never fake a model's
 * output"): no meta for either model family, or no photo for any class, and
 * the slot simply isn't there. No placeholder box, no canned animation. A server
 * component, so `fs.existsSync` runs at request/build time and there is no
 * client-side flash between "no photo" and "photo".
 *
 * ⚠️ `k` and `res` are READ FROM THE META, never hardcoded — the same rule the
 * trajectory viewer and the JEPA loader follow. A retrained export with four
 * photos grows a fourth button here with no code change, and each class is
 * still checked for a served photo before it gets one (a button that samples a
 * class whose face is missing would be a control that half-works).
 *
 * ⚠️ Everything lives under `public/headshot/v2/`. `/headshot/:path*` is served
 * immutable for a year, and the v2 bundle changed the weights, the metas and
 * the photo bytes, so the whole set moved rather than being overwritten in
 * place. The v1 files are deleted and nothing references them.
 */
export function HeadshotFigure() {
  const root = process.cwd();
  let meta: HeadshotMeta | null = null;
  for (const file of META_FILES) {
    // Statically scoped under the bundle directory on purpose: Turbopack's file
    // tracer flags a join whose whole tail is a variable as "the project was
    // traced unintentionally", and the build warns.
    const metaPath = path.join(root, `public/headshot/v2/${file}`);
    if (!fs.existsSync(metaPath)) continue;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as HeadshotMeta;
    } catch {
      // Unreadable meta is the same as no meta as far as the visitor goes: try
      // the other family, then gate. (A meta that parses but carries the wrong
      // version is the loader's problem, and it throws there rather than being
      // swallowed.)
      meta = null;
      continue;
    }
    if (meta?.version === 1 && meta.k && meta.res) break;
    meta = null;
  }
  if (!meta) return null;

  // Presented last-class-first (owner's call, 2026-09-12): display order is the
  // reverse of the class indices, so class k-1 is the default photo. Class
  // indices themselves never change — they are the model's conditioning and
  // the photos' filenames.
  const photos = Array.from({ length: meta.k }, (_, i) => i)
    .filter((i) => fs.existsSync(path.join(root, `public/headshot/v2/photos/${i}.webp`)))
    .reverse();
  if (photos.length === 0) return null;

  return <HeadshotToy photos={photos} defaultRes={meta.res} />;
}
