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
/**
 * `grain` is aligned to `levels` (same 5 indices, faint outer to bright
 * core): a stipple of tiny points sampled and jittered from that level's own
 * ring vertices, prepared once so the band reads as a haze of stars rather
 * than a flat wash ("clutter" follow-up, 2026-09-15). Same flat-pair layout
 * as a ring; sky-layers.ts owns the alpha per level.
 */
export type PreparedMilkyWay = { levels: PreparedRing[][]; grain: PreparedRing[]; labels: [number, number][] };

export const OBJECTS_URL = "/sky/objects.json";
export const MILKYWAY_URL = "/sky/milkyway.json";

const D2R = Math.PI / 180;

/**
 * A tiny deterministic hash + PRNG pair ("clutter" follow-up, 2026-09-15):
 * every cluster's star scatter and every nebula's cloud blobs are seeded
 * from a string (the object's own id, or a fixed grain key), never
 * `Math.random`, so the shape is identical on every load, every visitor,
 * every frame. FNV-1a into mulberry32, both well-worn, both about a dozen
 * lines; no need for a dependency for this.
 */
function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/** One grain point every this many vertices, per level (0 = faint outer
 *  boundary, 4 = the small, bright, innermost region): a coarser stride on
 *  the big outer level keeps the total point count, and so the per-frame
 *  cost, bounded, while the small inner levels keep most or all of theirs so
 *  the core actually looks denser, not just more alpha on the same dots. */
const GRAIN_STRIDE = [5, 6, 4, 2, 1];
/** Jitter each grain point off its source vertex by up to this many degrees
 *  (both axes), so the stipple doesn't just retrace the isophote outlines. */
const GRAIN_JITTER_DEG = 0.6;

export function prepareMilkyWay(mw: MilkyWayData): PreparedMilkyWay {
  const toPrepared = (ring: [number, number][]): PreparedRing => {
    const out = new Float64Array(ring.length * 2);
    ring.forEach(([ra, dec], i) => {
      out[2 * i] = ra * D2R;
      out[2 * i + 1] = Math.tan(((90 - dec) / 2) * D2R);
    });
    return out;
  };
  return {
    levels: mw.levels.map((rings) => rings.map(toPrepared)),
    grain: mw.levels.map((rings, li) => {
      const stride = GRAIN_STRIDE[li] ?? 4;
      const pts: [number, number][] = [];
      let idx = 0;
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += stride) {
          const [ra, dec] = ring[i];
          const rnd = mulberry32(hashSeed(`grain:${li}:${idx}`));
          idx++;
          const jitterRa = (rnd() - 0.5) * 2 * GRAIN_JITTER_DEG;
          const jitterDec = (rnd() - 0.5) * 2 * GRAIN_JITTER_DEG;
          pts.push([(((ra + jitterRa) % 360) + 360) % 360, Math.max(-89, Math.min(89, dec + jitterDec))]);
        }
      }
      return toPrepared(pts);
    }),
    labels: mw.labels,
  };
}

/* ---------------------------------------------------------------------- */
/* Not-to-scale deep-sky glyphs ("clutter" follow-up, 2026-09-15)         */
/* ---------------------------------------------------------------------- */

/**
 * A galaxy glyph is drawn (lib/sky-layers.ts) as a translate + rotate +
 * non-uniform scale around a shared unit spiral, so only these three numbers
 * need preparing; the shape math itself is a module-level constant there,
 * not per-object data.
 */
export type GalaxyGlyph = { kind: "galaxy"; majorPx: number; minorPx: number; tiltDeg: number; corePx: number };
/** `blobs` are already-placed (dx, dy, r) offsets from the object's own
 *  projected point; `ring` (M57 only) is a plain annulus instead. */
export type NebulaGlyph = {
  kind: "nebula";
  blobs: { dx: number; dy: number; r: number }[];
  ring: { outerR: number; innerR: number } | null;
  corePx: number;
};
/** `stars` are already-placed (dx, dy, r) offsets, deterministic per cluster. */
export type ClusterGlyph = { kind: "cluster"; stars: { dx: number; dy: number; r: number }[]; corePx: number };
export type ObjectGlyph = GalaxyGlyph | NebulaGlyph | ClusterGlyph;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Illustrative sizes, tuned by eye against a 1440px-wide screenshot per the
 * owner's brief: "what you would see if you were to zoom into them a lot",
 * Andromeda the biggest at roughly 40px across, everything else smaller.
 * Not angular sizes and not proportional to the real ones (M87 is a giant
 * elliptical far bigger than M31 in life; here it is drawn smaller because
 * it is fainter and less the point) — the not-to-scale note in the credit
 * line and on every affected card is what keeps this honest.
 */
const GALAXY_PX: Record<string, { majorPx: number; tiltDeg: number }> = {
  // ~77 degrees from edge-on is the fact's own number (content/sky-facts.ts).
  m31: { majorPx: 20, tiltDeg: 77 },
  m51: { majorPx: 12, tiltDeg: -35 },
  m87: { majorPx: 10, tiltDeg: -35 },
};
const NEBULA_PX: Record<string, number> = { m1: 8, m8: 9, m42: 10, m57: 8 };
const CLUSTER_PX: Record<string, { extentPx: number; stars: number }> = {
  m13: { extentPx: 7, stars: 11 }, // globular: a tight ball
  m44: { extentPx: 10, stars: 9 },
  m45: { extentPx: 11, stars: 7 },
};

/**
 * Once per objects.json load: a galaxy/nebula/cluster's rendered shape,
 * computed here so the ~20fps paint loop only ever translates or transforms
 * already-placed points, never re-derives them. Every other symbol
 * (named stars, the Kepler field, the Hubble Deep Field, the Voyagers, the
 * ISS) is untouched and has no entry here; lib/sky-layers.ts falls back to
 * its own plain shape when a galaxy/nebula/cluster id isn't in this map
 * (an id the size tables don't yet know about, not an error).
 */
export function prepareObjectGlyphs(objects: readonly SkyObject[]): Map<string, ObjectGlyph> {
  const out = new Map<string, ObjectGlyph>();
  for (const o of objects) {
    if (o.symbol === "galaxy") {
      const cfg = GALAXY_PX[o.id];
      if (!cfg) continue;
      const minorPx = cfg.majorPx * (o.axisRatio ?? 1);
      // A bigger glyph earns a bigger hit core (never smaller than the
      // default SYMBOL_CORE_PX, which lib/sky-render.ts's nearestHit still
      // applies to every plain symbol): half the major radius, capped so a
      // touch-radius pointer can't be swallowed whole by one glyph.
      out.set(o.id, { kind: "galaxy", majorPx: cfg.majorPx, minorPx, tiltDeg: cfg.tiltDeg, corePx: clamp(Math.round(cfg.majorPx * 0.5), 6, 12) });
    } else if (o.symbol === "nebula") {
      const extent = NEBULA_PX[o.id];
      if (!extent) continue;
      const corePx = clamp(Math.round(extent * 0.7), 6, 10);
      if (o.id === "m57") {
        // The Ring Nebula reads as a ring, not a cloud of blobs.
        out.set(o.id, { kind: "nebula", blobs: [], ring: { outerR: extent, innerR: extent * 0.42 }, corePx });
        continue;
      }
      // 3 blobs of noticeably different sizes, spread far enough apart to
      // read as lumps rather than one bigger circle: an earlier attempt at
      // 4-5 same-ish-sized blobs close to the centre just unioned into a
      // smooth disc at this size (screenshot-caught, 2026-09-15) — a real
      // nebula's own irregularity barely survives at a 16-20px glyph, so
      // this leans on size contrast, not blob count, to show it.
      const rnd = mulberry32(hashSeed(o.id));
      const blobs = Array.from({ length: 3 }, (_, i) => {
        const angle = rnd() * Math.PI * 2;
        const dist = (i === 0 ? 0 : 0.35 + rnd() * 0.35) * extent;
        const r = extent * (i === 0 ? 0.75 + rnd() * 0.15 : 0.35 + rnd() * 0.25);
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, r };
      });
      out.set(o.id, { kind: "nebula", blobs, ring: null, corePx });
    } else if (o.symbol === "cluster") {
      const cfg = CLUSTER_PX[o.id];
      if (!cfg) continue;
      const rnd = mulberry32(hashSeed(o.id));
      const stars = Array.from({ length: cfg.stars }, () => {
        const angle = rnd() * Math.PI * 2;
        // sqrt(rnd()) spreads points evenly over the disk's AREA, not bunched
        // at the centre the way a plain linear radius would.
        const dist = Math.sqrt(rnd()) * cfg.extentPx;
        const r = 0.7 + rnd() * 0.5;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, r };
      });
      out.set(o.id, { kind: "cluster", stars, corePx: clamp(Math.round(cfg.extentPx * 0.6), 6, 9) });
    }
  }
  return out;
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
