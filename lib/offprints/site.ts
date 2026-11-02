/** Offprints' canonical host; every absolute URL for a piece starts here. */
export const OFFPRINTS_SITE = "https://offprints.neelayranjan.dev";

export { OFFPRINTS_PREFIX } from "./host.ts";

export function pieceUrl(slug: string): string {
  return `${OFFPRINTS_SITE}/${slug}`;
}
