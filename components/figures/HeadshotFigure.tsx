import fs from "node:fs";
import path from "node:path";
import { copy } from "@/content/copy";

/**
 * A small headshot in the masthead's rail, gated on the file's absence per
 * the site's central rule (CLAUDE.md's "never fake a model's output," applied
 * here to a photo rather than a model artifact: an absent file means no
 * slot, never a placeholder box).
 *
 * Server component: `fs.existsSync` runs at request/build time, never in the
 * browser, so there is no client-side flash between "no photo" and "photo."
 * The live-drop-in path is exactly this: add `public/headshot/photo.webp`
 * and this starts rendering with no code change.
 */
export function HeadshotFigure() {
  const exists = fs.existsSync(
    path.join(process.cwd(), "public/headshot/photo.webp"),
  );
  if (!exists) return null;

  return (
    <img
      src="/headshot/photo.webp"
      alt={copy.meta.ogImageAlt}
      className="h-24 w-24 border border-rule object-cover"
    />
  );
}
