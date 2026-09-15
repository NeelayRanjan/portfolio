/**
 * Loads the night sky's star catalog, public/sky/sky.json (built by the
 * hand-run scripts/prepare-sky.mjs). ~55 KB, fetched after first paint by
 * NightSky, never bundled.
 *
 * Same gate discipline as the model loaders: absent (a failed fetch, a 404)
 * resolves null and the desk stays plain dark, with no stand-in sky; present
 * and malformed throws, because that is an export bug to see, not hide.
 */
import type { Equatorial } from "./sky-math";

export type SkyStar = [raDeg: number, decDeg: number, mag: number, bv: number];
export type SkyConstellation = { latin: string; english: string | null; labels: [number, number][] };
export type SkyData = {
  version: 1;
  epoch: "J2000";
  source: Record<string, string>;
  stars: SkyStar[];
  lines: Record<string, [number, number][][]>;
  constellations: Record<string, SkyConstellation>;
};
export type { Equatorial };

export const SKY_URL = "/sky/sky.json";

let cache: Promise<SkyData | null> | null = null;

export function loadSky(): Promise<SkyData | null> {
  if (cache) return cache;
  cache = (async () => {
    let res: Response;
    try {
      res = await fetch(SKY_URL);
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const sky = (await res.json()) as SkyData;
    if (sky?.version !== 1 || sky.epoch !== "J2000") {
      throw new Error(`${SKY_URL}: version ${String(sky?.version)} / epoch ${String(sky?.epoch)}`);
    }
    if (!Array.isArray(sky.stars) || sky.stars.length < 500) throw new Error(`${SKY_URL}: too few stars`);
    if (Object.keys(sky.constellations ?? {}).length !== 88) throw new Error(`${SKY_URL}: not 88 constellations`);
    return sky;
  })().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
}
