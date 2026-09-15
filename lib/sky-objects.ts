/**
 * Loads the night sky's objects layer data (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §9), both built by
 * the hand-run scripts/prepare-sky-objects.mjs:
 *
 *   /sky/objects.json   deep-sky picks, landmarks, named stars, Voyagers,
 *                       meteor showers, constellation origins (~15 KB)
 *   /sky/milkyway.json  the Milky Way band (~30 KB, ~2,300 vertices)
 *
 * Same gate as lib/sky-data.ts, per layer: absent (a failed fetch, a 404)
 * resolves null and the sky draws without that layer; present and malformed
 * throws, and NightSky logs it. Nothing stands in for a missing layer.
 *
 * Also the per-catalog precomputation spec §10 asks for: every Milky Way
 * vertex's RA in radians and its tan((90° − dec)/2), so a frame only
 * multiplies by k and takes one sin/cos pair per vertex; and the Kepler
 * field's outline as a ring of RA/Dec points.
 */

export type ObjectSymbol = "galaxy" | "nebula" | "cluster" | "core" | "field" | "square" | "chevron" | "star";
export type SkyObject = {
  id: string;
  name: string;
  designation?: string;
  symbol: ObjectSymbol;
  raDeg: number;
  decDeg: number;
  mag?: number;
  axisRatio?: number;
  radiusDeg?: number;
  distanceAu?: number;
  positionDate?: string;
  hip?: number;
};
export type SkyShower = {
  id: string;
  name: string;
  imo: string;
  start: string;
  end: string;
  peak: string;
  solarLongitudeDeg: number;
  radiantRaDeg: number;
  radiantDecDeg: number;
  speedKmS: number;
  zhr: number;
  parent: string;
  parentSource: string;
};
export type ConstellationOrigin = { ancient: boolean; year: number | null; by: string[]; splitFrom: string | null };
export type SkyObjectsData = {
  version: 1;
  epoch: "J2000";
  generated: string;
  source: Record<string, unknown>;
  objects: SkyObject[];
  showers: SkyShower[];
  constellations: Record<string, ConstellationOrigin>;
};
export type MilkyWayData = {
  version: 1;
  epoch: "J2000";
  source: Record<string, unknown>;
  toleranceDeg: number;
  levels: [number, number][][][];
  labels: [number, number][];
};
/** One ring as flat [raRad, tanHalfColat, raRad, tanHalfColat, ...]. */
export type PreparedRing = Float64Array;
export type PreparedMilkyWay = { levels: PreparedRing[][]; labels: [number, number][] };

export const OBJECTS_URL = "/sky/objects.json";
export const MILKYWAY_URL = "/sky/milkyway.json";

const D2R = Math.PI / 180;

function gate<T>(url: string, validate: (body: T) => string | null): () => Promise<T | null> {
  let cache: Promise<T | null> | null = null;
  return () => {
    if (cache) return cache;
    cache = (async () => {
      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        return null;
      }
      if (!res.ok) return null;
      const body = (await res.json()) as T;
      const problem = validate(body);
      if (problem) throw new Error(`${url}: ${problem}`);
      return body;
    })().catch((err) => {
      cache = null;
      throw err;
    });
    return cache;
  };
}

export const loadObjects = gate<SkyObjectsData>(OBJECTS_URL, (d) => {
  if (d?.version !== 1 || d.epoch !== "J2000") return `version ${String(d?.version)} / epoch ${String(d?.epoch)}`;
  if (!Array.isArray(d.objects) || d.objects.length < 1) return "no objects";
  if (!Array.isArray(d.showers)) return "no showers";
  if (Object.keys(d.constellations ?? {}).length !== 88) return "not 88 constellation origins";
  return null;
});

export const loadMilkyWay = gate<MilkyWayData>(MILKYWAY_URL, (d) => {
  if (d?.version !== 1 || d.epoch !== "J2000") return `version ${String(d?.version)} / epoch ${String(d?.epoch)}`;
  if (!Array.isArray(d.levels) || d.levels.length !== 5) return "not 5 levels";
  if (!Array.isArray(d.labels)) return "no label anchors";
  return null;
});

export function prepareMilkyWay(mw: MilkyWayData): PreparedMilkyWay {
  return {
    levels: mw.levels.map((rings) =>
      rings.map((ring) => {
        const out = new Float64Array(ring.length * 2);
        ring.forEach(([ra, dec], i) => {
          out[2 * i] = ra * D2R;
          out[2 * i + 1] = Math.tan(((90 - dec) / 2) * D2R);
        });
        return out;
      }),
    ),
    labels: mw.labels,
  };
}

/** `n` points of the small circle of angular radius `radiusDeg` around (ra, dec), as [ra, dec] degrees. */
export function smallCircle(raDeg: number, decDeg: number, radiusDeg: number, n = 48): [number, number][] {
  const a0 = raDeg * D2R;
  const d0 = decDeg * D2R;
  const r = radiusDeg * D2R;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const b = (i / n) * 2 * Math.PI; // bearing from north through east
    const d = Math.asin(Math.sin(d0) * Math.cos(r) + Math.cos(d0) * Math.sin(r) * Math.cos(b));
    const a = a0 + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(d0), Math.cos(r) - Math.sin(d0) * Math.sin(d));
    out.push([(((a / D2R) % 360) + 360) % 360, d / D2R]);
  }
  return out;
}

/** "MM-DD" as a sortable number. */
const mdNumber = (md: string) => Number(md.slice(0, 2)) * 100 + Number(md.slice(3));

/** Is the simulated UTC date inside the shower's active window? Windows can wrap the new year. */
export function isShowerActive(s: SkyShower, ms: number): boolean {
  const d = new Date(ms);
  const today = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const start = mdNumber(s.start);
  const end = mdNumber(s.end);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}
