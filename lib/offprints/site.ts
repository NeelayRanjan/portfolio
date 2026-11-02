/** Offprints' canonical host; every absolute URL for a piece starts here. */
export const OFFPRINTS_SITE = "https://offprints.neelayranjan.dev";

export { OFFPRINTS_PREFIX } from "./host.ts";

/** The share card (scripts/gen-offprints-og.mjs). A page's own `openGraph` replaces the layout's wholesale, so pages repeat it. */
export const OFFPRINTS_OG_IMAGE = { url: "/offprints/og.png", width: 1200, height: 630 };

export function pieceUrl(slug: string): string {
  return `${OFFPRINTS_SITE}/${slug}`;
}
