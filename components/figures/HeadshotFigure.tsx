import fs from "node:fs";
import path from "node:path";
import { HeadshotToy } from "./HeadshotToy";
import type { HeadshotMeta } from "@/lib/headshot-diffusion";

/**
 * The masthead rail's author photo, which is a live diffusion sample rather
 * than a file. `HeadshotToy` is the client half; this is the gate.
 *
 * Gated on the bundle's absence per the Constitution ("never fake a model's
 * output"): no `headshot_meta.json`, or no photo for class 0, and the slot
 * simply isn't there. No placeholder box, no canned animation. A server
 * component, so `fs.existsSync` runs at request/build time and there is no
 * client-side flash between "no photo" and "photo".
 *
 * ⚠️ `k` and `res` are READ FROM THE META, never hardcoded — the same rule the
 * trajectory viewer and the JEPA loader follow. A retrained export with four
 * photos grows a fourth button here with no code change, and each class is
 * still checked for a served photo before it gets one (a button that samples a
 * class whose face is missing would be a control that half-works).
 *
 * (This replaces the earlier single-file gate on `public/headshot/photo.webp`,
 * which was the placeholder path before the model bundle landed. Nothing
 * references that filename any more.)
 */
export function HeadshotFigure() {
  const root = process.cwd();
  const metaPath = path.join(root, "public/headshot/headshot_meta.json");
  if (!fs.existsSync(metaPath)) return null;

  let meta: HeadshotMeta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as HeadshotMeta;
  } catch {
    // Unreadable meta is the same as no meta as far as the visitor goes: gate.
    // (A meta that parses but carries the wrong version is the loader's
    // problem, and it throws there rather than being swallowed.)
    return null;
  }
  if (meta?.version !== 1 || !meta.k || !meta.res) return null;

  // Presented last-class-first (owner's call, 2026-09-12): display order is the
  // reverse of the class indices, so class k-1 is the default photo. Class
  // indices themselves never change — they are the model's conditioning and
  // the photos' filenames.
  const photos = Array.from({ length: meta.k }, (_, i) => i)
    .filter((i) => fs.existsSync(path.join(root, `public/headshot/photos/${i}.webp`)))
    .reverse();
  if (photos.length === 0) return null;

  return <HeadshotToy photos={photos} res={meta.res} />;
}
