/** Offprints' canonical host; every absolute URL for a piece starts here. */
export const OFFPRINTS_SITE = "https://offprints.neelayranjan.dev";

// Task 4 moves this constant into lib/offprints/host.ts as the single source.
export const OFFPRINTS_PREFIX = "/offprints";

export function pieceUrl(slug: string): string {
  return `${OFFPRINTS_SITE}/${slug}`;
}
