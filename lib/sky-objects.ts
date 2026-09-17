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

export function gate<T>(url: string, validate: (body: T) => string | null): () => Promise<T | null> {
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
 * The unit spiral's own parameters, shared with lib/sky-layers.ts's
 * `buildSpiralArm` (colour round, 2026-09-15). They live here, not there, so
 * a spiral's H II knots can be placed ON its arms at catalog-load time
 * without sky-objects importing the drawing module back (sky-layers already
 * imports this one, and this file still imports nothing).
 * `r(t) = SPIRAL_R0 + SPIRAL_DR·t`, `theta(t) = ±t·SPIRAL_TURNS·2π`.
 */
export const SPIRAL_TURNS = 0.8;
export const SPIRAL_R0 = 0.15;
export const SPIRAL_DR = 0.82;

/** An already-placed offset from an object's own projected point, CSS px. */
export type Placed = { dx: number; dy: number; r: number };
/**
 * Which structured render a galaxy gets (colour round, 2026-09-15). The
 * assignment is the object's actual morphology, and each one draws a
 * different sourced story: arms and knots, a companion at an arm tip, a
 * smooth halo with a jet, a bulge crossed by a dust lane, an edge-on
 * starburst disk with a superwind.
 */
export type GalaxyVariant = "spiral" | "spiral-companion" | "elliptical" | "edge-on" | "starburst";
/**
 * A galaxy glyph is drawn (lib/sky-layers.ts) as a translate + rotate +
 * non-uniform scale around a shared unit spiral, so only these numbers need
 * preparing; the shape math itself is a module-level constant there, not
 * per-object data.
 *
 * Everything below `corePx` is the colour round's structured geometry, all
 * of it placed HERE, in px offsets from the object's own projected point,
 * already rotated and scaled: the paint loop translates and never re-derives.
 * A variant that has no use for a field gets the empty value, never
 * `undefined`, so the prepared map round-trips through JSON unchanged (the
 * determinism test compares it that way).
 */
export type GalaxyGlyph = {
  kind: "galaxy";
  variant: GalaxyVariant;
  majorPx: number;
  minorPx: number;
  tiltDeg: number;
  corePx: number;
  /** H II star-forming knots along a spiral's arms; an elliptical's
   *  point-like globular clusters. Empty for the other variants. */
  knots: Placed[];
  /** spiral-companion (M51) only: NGC 5195, just past one arm's tip. */
  companion: Placed | null;
  /** elliptical (M87) only: the jet. `angleDeg` is a screen angle (0 = +x,
   *  measured the way ctx.rotate does), so the jet turns with the chart. */
  jet: { angleDeg: number; lengthPx: number; halfWidthPx: number } | null;
  /** edge-on (M104) and starburst (M82): the dust lane, in the glyph's own
   *  rotated frame. `offsetPx` moves it off the centre line (the Sombrero's
   *  ring crosses below its bulge's middle). */
  lane: { offsetPx: number; halfPx: number; spanPx: number } | null;
  /** starburst (M82) only: superwind filaments, placed px segments running
   *  out perpendicular to the disk. */
  plumes: { x1: number; y1: number; x2: number; y2: number }[];
};
/**
 * Which structured render a nebula gets (colour round, 2026-09-15), from its
 * actual type: a glowing H II cloud, a shell thrown off a dying star, the
 * debris of a supernova, dust reflecting a star's light, or dust blocking
 * what is behind it.
 */
export type NebulaVariant = "emission" | "planetary" | "remnant" | "reflection" | "dark";
/** A globular's tight old ball, or an open cluster's loose young scatter. */
export type ClusterVariant = "globular" | "open";
/**
 * Which of the palette's colours a placed piece takes: 0 base, 1 accent,
 * 2 core. Prepared here so the split is data, not a rule the paint loop
 * re-derives: the Trifid's blue reflection lobe (1) against its pink
 * emission lobes (0), and a cluster's minority blue and red giants against
 * its common star colour. With colour off every tint draws the same ink, so
 * this changes nothing outside stargaze.
 */
export type Tint = 0 | 1 | 2;
export type TintedPlaced = Placed & { tint: Tint };
/** A dust lane, pillar or notch in silhouette: a round-capped thick segment,
 *  px offsets from the object's own projected point. */
export type DustLane = { x1: number; y1: number; x2: number; y2: number; w: number };
/** One filament strand of a supernova remnant, as a quadratic curve. */
export type Filament = { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number };
/**
 * `blobs` are already-placed (dx, dy, r) offsets from the object's own
 * projected point; `ring` (M57 only) is a plain annulus instead.
 *
 * Everything below `corePx` is the colour round's structured geometry, placed
 * here in px offsets so the paint loop only translates, and drawn ONLY on the
 * coloured path: the plain grey glyph is the blobs (or the ring) exactly as
 * before, so a nebula that had a glyph before this round renders identically
 * with colour off. A variant with no use for a field gets the empty value,
 * never `undefined`, so the prepared map round-trips through JSON unchanged.
 */
export type NebulaGlyph = {
  kind: "nebula";
  variant: NebulaVariant;
  blobs: TintedPlaced[];
  ring: { outerR: number; innerR: number } | null;
  corePx: number;
  /** emission: a distinct inner region (M42's Trapezium), drawn over the
   *  cloud in the palette's `core`. Kept out of `blobs` so the grey path,
   *  which draws every blob, is untouched. */
  coreBlob: Placed | null;
  /** Dark dust in silhouette: M20's three lanes, M16's pillars, the Gulf of
   *  Mexico notch in NGC 7000, the lanes across M8, M78 and the Flame. */
  dust: DustLane[];
  /** remnant only: the filamentary strands (M1's shell, the Veil's arc). */
  filaments: Filament[];
  /** Embedded or illuminating stars a source names by colour (M8's NGC 6530,
   *  M78's young blue stars). Empty everywhere else. */
  stars: Placed[];
  /** dark (the Horsehead) only: the silhouette outline as a closed polygon of
   *  px offsets, drawn over the backdrop blobs. Empty otherwise. */
  silhouette: { dx: number; dy: number }[];
};
/**
 * `stars` are already-placed (dx, dy, r) offsets, deterministic per cluster.
 * `haze` is the globular's unresolved core glow and the Pleiades' reflection
 * nebulosity, both coloured-path only, so the grey glyph stays the plain star
 * scatter it was.
 */
export type ClusterGlyph = {
  kind: "cluster";
  variant: ClusterVariant;
  stars: TintedPlaced[];
  haze: Placed[];
  corePx: number;
};
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
const GALAXY_PX: Record<string, { majorPx: number; tiltDeg: number; variant: GalaxyVariant }> = {
  // ~77 degrees from edge-on is the fact's own number (content/sky-facts.ts).
  m31: { majorPx: 20, tiltDeg: 77, variant: "spiral" },
  m33: { majorPx: 13, tiltDeg: 20, variant: "spiral" },
  m51: { majorPx: 12, tiltDeg: -35, variant: "spiral-companion" },
  // ⚠️ M81 and M82 are 0.6° apart, which at this projection's k is 4px on
  // screen (measured): at ANY size these two glyphs overlap, so the size that
  // was tried first, small enough to keep them apart, only made a single
  // unreadable smudge. They are drawn big enough to read as a spiral with a
  // cigar across it instead, which is roughly what a wide-field photo of the
  // pair shows. Their names overlap too, and did before this round.
  m81: { majorPx: 12, tiltDeg: -15, variant: "spiral" },
  m82: { majorPx: 10, tiltDeg: 62, variant: "starburst" },
  m87: { majorPx: 10, tiltDeg: -35, variant: "elliptical" },
  m104: { majorPx: 13, tiltDeg: 8, variant: "edge-on" },
};
/**
 * Nebula sizes and structure (colour round task 5). `extentPx` is the same
 * number the pre-round table held for the four ids that had one, so their
 * blobs are unchanged. `dust` places dark material in silhouette: `lane` is a
 * chord across the cloud (M20's three lanes are what trisect the Trifid),
 * `pillar` a column rising into it (M16), `notch` one fat bite out of its
 * edge (NGC 7000's Gulf of Mexico, which is the foreground cloud LDN 935 and
 * not a gap in the gas). `filaments` are a remnant's strands: `shell` wraps
 * them around the middle (M1), `arc` lays them along one direction (the Veil,
 * which is one thin slice of a shell 3 degrees across).
 */
type NebulaCfg = {
  extentPx: number;
  variant: NebulaVariant;
  dust?: { n: number; kind: "lane" | "pillar" | "notch" };
  filaments?: { n: number; kind: "shell" | "arc" };
  /** Embedded stars a source names by colour. */
  stars?: number;
  /** A distinct inner region drawn in the palette's `core` (M42 only). */
  coreBlob?: boolean;
  /** Per-blob palette slot; missing or short means base (0). */
  blobTints?: Tint[];
};
const NEBULA_PX: Record<string, NebulaCfg> = {
  m1: { extentPx: 8, variant: "remnant", filaments: { n: 6, kind: "shell" } },
  m8: { extentPx: 9, variant: "emission", dust: { n: 2, kind: "lane" }, stars: 3 },
  m16: { extentPx: 9, variant: "emission", dust: { n: 3, kind: "pillar" } },
  // The Trifid's identity is the split: two emission lobes (tint 0) and one
  // reflection lobe (tint 1), cut apart by the lanes it is named for.
  m20: { extentPx: 9, variant: "emission", dust: { n: 3, kind: "lane" }, blobTints: [0, 0, 1] },
  m27: { extentPx: 7, variant: "planetary" },
  m42: { extentPx: 10, variant: "emission", coreBlob: true },
  m57: { extentPx: 8, variant: "planetary" },
  m78: { extentPx: 7, variant: "reflection", dust: { n: 1, kind: "lane" }, stars: 3 },
  flame: { extentPx: 7, variant: "emission", dust: { n: 1, kind: "lane" } },
  horsehead: { extentPx: 11, variant: "dark" },
  ngc7000: { extentPx: 11, variant: "emission", dust: { n: 1, kind: "notch" } },
  ngc6960: { extentPx: 9, variant: "remnant", filaments: { n: 5, kind: "arc" } },
  ngc6992: { extentPx: 9, variant: "remnant", filaments: { n: 5, kind: "arc" } },
};
/**
 * The Horsehead's outline, in a unit frame (x right, y DOWN, as canvas
 * measures it): the muzzle points up and to the left, the mane falls away to
 * the right, and the neck runs off the bottom of the shape. Hand-traced to
 * read at about 11px tall, which is all this chart gives it; it is a
 * silhouette, so the shape is the whole object and nothing about it is a
 * colour claim. Same not-to-scale rule as every other glyph here.
 *
 * The x scale below is nearly as big as the y one on purpose: a first pass
 * drew it half as wide as tall, and at this size that reads as a dark thumb,
 * not a head (screenshot-caught).
 */
const HORSEHEAD_OUTLINE: [number, number][] = [
  [0.4, 1.0],
  [0.42, 0.1],
  [0.3, -0.45],
  [0.18, -0.7],
  [0.0, -0.88],
  [-0.22, -0.92],
  [-0.45, -0.7],
  [-0.38, -0.45],
  [-0.2, -0.3],
  [-0.28, 0.2],
  [-0.35, 1.0],
];
/** `haze` is the globular's unresolved core glow / the Pleiades' reflection
 *  nebulosity; `accentShare` and `accent2Share` are the share of stars taking
 *  the palette's accent (tint 1) and second accent (tint 2), where a source
 *  names a minority star colour. The rest take the base. */
type ClusterCfg = {
  extentPx: number;
  stars: number;
  variant: ClusterVariant;
  haze?: number;
  accentShare?: number;
  accent2Share?: number;
};
const CLUSTER_PX: Record<string, ClusterCfg> = {
  // globular: a tight ball, most stars yellow-white, a few blue giants and a
  // few red ones (APOD's colour-magnitude reading of M13).
  m13: { extentPx: 7, stars: 11, variant: "globular", haze: 3, accentShare: 0.16, accent2Share: 0.16 },
  // The Beehive's few yellowish red giants among its blue main-sequence stars.
  m44: { extentPx: 10, stars: 9, variant: "open", accentShare: 0.22 },
  m45: { extentPx: 11, stars: 7, variant: "open", haze: 5 },
  // The Double Cluster's two halves are 0.4 degrees apart, which is about 3px
  // here, so each half stays small and the pair reads as one rich double
  // knot, which is what it looks like in binoculars.
  ngc869: { extentPx: 6, stars: 9, variant: "open" },
  ngc884: { extentPx: 6, stars: 9, variant: "open" },
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
      const rnd = mulberry32(hashSeed(o.id));
      const rot = cfg.tiltDeg * D2R;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      /** A point in the glyph's own unit frame (x along the major axis, y
       *  along the minor) as a px offset from the projected point. */
      const place = (ux: number, uy: number) => {
        const x = ux * cfg.majorPx;
        const y = uy * minorPx;
        return { dx: x * cos - y * sin, dy: x * sin + y * cos };
      };
      /** A point on arm `mirror` at parameter t, in the unit frame. */
      const onArm = (t: number, mirror: boolean, radial = 0) => {
        const r = SPIRAL_R0 + SPIRAL_DR * t + radial;
        const th = t * SPIRAL_TURNS * Math.PI * 2 * (mirror ? -1 : 1);
        return place(Math.cos(th) * r, Math.sin(th) * r);
      };
      const spiral = cfg.variant === "spiral" || cfg.variant === "spiral-companion";
      const knots: Placed[] = [];
      if (spiral) {
        // Five H II knots strung along the two arms, out where the arms are
        // (t >= 0.35) rather than buried in the bulge. Seeded from the id, so
        // every visitor sees the same galaxy.
        for (let i = 0; i < 5; i++) {
          const { dx, dy } = onArm(0.35 + rnd() * 0.6, i % 2 === 1, (rnd() - 0.5) * 0.12);
          knots.push({ dx, dy, r: 0.8 + rnd() * 0.6 });
        }
      } else if (cfg.variant === "elliptical") {
        // M87's globular clusters: NASA's own description calls them "yellow,
        // point-like" against the galaxy's glow. Scattered over the halo's
        // area, sqrt for an even spread the way the cluster glyph does it.
        for (let i = 0; i < 7; i++) {
          const a = rnd() * Math.PI * 2;
          const d = 0.35 + Math.sqrt(rnd()) * 0.6;
          const { dx, dy } = place(Math.cos(a) * d, Math.sin(a) * d);
          knots.push({ dx, dy, r: 0.6 + rnd() * 0.35 });
        }
      }
      const companion =
        cfg.variant === "spiral-companion"
          ? { ...onArm(1, false, 0.25), r: Math.max(2, cfg.majorPx * 0.22) }
          : null;
      const jet =
        cfg.variant === "elliptical"
          ? { angleDeg: cfg.tiltDeg + 200, lengthPx: cfg.majorPx * 1.7, halfWidthPx: 1.3 }
          : null;
      const lane =
        cfg.variant === "edge-on"
          ? // The Sombrero's ring crosses below its bulge's middle and runs
            // wider than the bulge, which is what makes it read as a ring
            // seen edge-on rather than a bar drawn over a blob.
            { offsetPx: minorPx * 0.55, halfPx: Math.max(1, cfg.majorPx * 0.085), spanPx: cfg.majorPx * 1.5 }
          : cfg.variant === "starburst"
            ? { offsetPx: 0, halfPx: Math.max(0.8, minorPx * 0.24), spanPx: cfg.majorPx * 1.6 }
            : null;
      const plumes: { x1: number; y1: number; x2: number; y2: number }[] = [];
      if (cfg.variant === "starburst") {
        // The superwind leaves perpendicular to the disk, both ways. Shape
        // only: M82 carries no colour (see lib/sky-layers.ts's note and
        // ruling R-COLOUR-1), so these draw in the site's own greys.
        for (let i = 0; i < 6; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const along = (rnd() - 0.5) * 0.7;
          const start = place(along, side * 0.85);
          const end = place(along * 0.6, side * (2.2 + rnd() * 1.8));
          plumes.push({ x1: start.dx, y1: start.dy, x2: end.dx, y2: end.dy });
        }
      }
      // A bigger glyph earns a bigger hit core (never smaller than the
      // default SYMBOL_CORE_PX, which lib/sky-render.ts's nearestHit still
      // applies to every plain symbol): half the major radius, capped so a
      // touch-radius pointer can't be swallowed whole by one glyph.
      out.set(o.id, {
        kind: "galaxy",
        variant: cfg.variant,
        majorPx: cfg.majorPx,
        minorPx,
        tiltDeg: cfg.tiltDeg,
        corePx: clamp(Math.round(cfg.majorPx * 0.5), 6, 12),
        knots,
        companion,
        jet,
        lane,
        plumes,
      });
    } else if (o.symbol === "nebula") {
      const cfg = NEBULA_PX[o.id];
      if (!cfg) continue;
      const extent = cfg.extentPx;
      const corePx = clamp(Math.round(extent * 0.7), 6, 10);
      if (o.id === "m57") {
        // The Ring Nebula reads as a ring, not a cloud of blobs.
        out.set(o.id, {
          kind: "nebula",
          variant: cfg.variant,
          blobs: [],
          ring: { outerR: extent, innerR: extent * 0.42 },
          corePx,
          coreBlob: null,
          dust: [],
          filaments: [],
          stars: [],
          silhouette: [],
        });
        continue;
      }
      // ⚠️ The blob loop below is byte-for-byte the pre-colour-round one, and
      // every piece the colour round adds is drawn AFTER it, out of the same
      // stream: a rnd() call inserted before or inside it would move every
      // existing nebula's blobs, which have to stay identical with colour off.
      const rnd = mulberry32(hashSeed(o.id));
      const blobs: TintedPlaced[] = [];
      if (cfg.variant === "dark") {
        // The Horsehead's backdrop is IC 434, the lit gas BEHIND it, so it
        // spreads wider than any other cloud here: the silhouette only reads
        // as a silhouette if there is something to block.
        // Wide enough to frame the head, no wider: a first pass spread the
        // glow to 19px and made the Horsehead the biggest red patch in Orion,
        // next to a Flame Nebula 5px away (screenshot-caught).
        for (let i = 0; i < 3; i++) {
          const angle = rnd() * Math.PI * 2;
          const dist = (i === 0 ? 0 : 0.3 + rnd() * 0.3) * extent;
          const r = extent * (i === 0 ? 0.85 : 0.45 + rnd() * 0.25);
          blobs.push({ dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, r, tint: 0 });
        }
      } else if (cfg.variant === "planetary") {
        // M27: the apple core everyone draws, two lobes either side of a
        // narrow waist, on one seeded axis.
        const a = rnd() * Math.PI * 2;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        blobs.push({ dx: 0, dy: 0, r: extent * 0.45, tint: 0 });
        for (const s of [1, -1]) {
          blobs.push({ dx: ux * extent * 0.55 * s, dy: uy * extent * 0.55 * s, r: extent * 0.62, tint: 0 });
        }
      } else if (cfg.filaments?.kind !== "arc") {
        // 3 blobs of noticeably different sizes, spread far enough apart to
        // read as lumps rather than one bigger circle: an earlier attempt at
        // 4-5 same-ish-sized blobs close to the centre just unioned into a
        // smooth disc at this size (screenshot-caught, 2026-09-15) — a real
        // nebula's own irregularity barely survives at a 16-20px glyph, so
        // this leans on size contrast, not blob count, to show it.
        for (let i = 0; i < 3; i++) {
          const angle = rnd() * Math.PI * 2;
          const dist = (i === 0 ? 0 : 0.35 + rnd() * 0.35) * extent;
          const r = extent * (i === 0 ? 0.75 + rnd() * 0.15 : 0.35 + rnd() * 0.25);
          blobs.push({ dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, r, tint: cfg.blobTints?.[i] ?? 0 });
        }
      }
      // else: the Veil is lace with no body behind it, so it gets no blobs at
      // all and draws as filaments alone.
      const coreBlob = cfg.coreBlob ? { dx: 0, dy: 0, r: extent * 0.34 } : null;
      const dust: DustLane[] = [];
      if (cfg.dust) {
        const { n, kind } = cfg.dust;
        const a0 = rnd() * Math.PI * 2;
        const ux = Math.cos(a0);
        const uy = Math.sin(a0);
        const px = -uy;
        const py = ux;
        if (kind === "notch") {
          const d = extent * 0.5;
          const h = extent * 0.18;
          dust.push({ x1: ux * d - px * h, y1: uy * d - py * h, x2: ux * d + px * h, y2: uy * d + py * h, w: extent * 0.55 });
        } else if (kind === "pillar") {
          for (let i = 0; i < n; i++) {
            const off = ((i - (n - 1) / 2) / Math.max(1, n - 1)) * extent * 1.05;
            const len = extent * (0.8 + rnd() * 0.5);
            const x1 = px * off - ux * extent * 0.7;
            const y1 = py * off - uy * extent * 0.7;
            dust.push({ x1, y1, x2: x1 + ux * len, y2: y1 + uy * len, w: extent * 0.2 });
          }
        } else {
          for (let i = 0; i < n; i++) {
            const a = a0 + (i * Math.PI) / n + (rnd() - 0.5) * 0.3;
            const lx = Math.cos(a);
            const ly = Math.sin(a);
            const off = (rnd() - 0.5) * 0.4 * extent;
            const half = extent * 1.05;
            dust.push({
              x1: -lx * half - ly * off,
              y1: -ly * half + lx * off,
              x2: lx * half - ly * off,
              y2: ly * half + lx * off,
              w: extent * 0.15,
            });
          }
        }
      }
      const filaments: Filament[] = [];
      if (cfg.filaments) {
        const { n, kind } = cfg.filaments;
        if (kind === "shell") {
          // Strands wrapped around the middle, each bowing outward.
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2;
            const rr = extent * (0.5 + rnd() * 0.5);
            const span = 0.5 + rnd() * 0.5;
            const at = (t: number, k: number) => ({ x: Math.cos(a + t) * rr * k, y: Math.sin(a + t) * rr * k });
            const s = at(-span, 1);
            const e = at(span, 1);
            const c = at(0, 1.35);
            filaments.push({ x1: s.x, y1: s.y, cx: c.x, cy: c.y, x2: e.x, y2: e.y });
          }
        } else {
          // The Veil: near-parallel strands along one seeded direction.
          const a0 = rnd() * Math.PI * 2;
          const ux = Math.cos(a0);
          const uy = Math.sin(a0);
          const px = -uy;
          const py = ux;
          for (let i = 0; i < n; i++) {
            const off = ((i - (n - 1) / 2) / Math.max(1, n - 1)) * extent * 1.1 + (rnd() - 0.5) * extent * 0.2;
            const half = extent * (0.6 + rnd() * 0.35);
            const bow = (rnd() - 0.5) * extent * 0.8;
            filaments.push({
              x1: -ux * half + px * off,
              y1: -uy * half + py * off,
              cx: px * (off + bow),
              cy: py * (off + bow),
              x2: ux * half + px * off,
              y2: uy * half + py * off,
            });
          }
        }
      }
      const stars = Array.from({ length: cfg.stars ?? 0 }, () => {
        const a = rnd() * Math.PI * 2;
        const d = (0.2 + rnd() * 0.6) * extent;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 0.7 + rnd() * 0.45 };
      });
      const silhouette =
        cfg.variant === "dark"
          ? HORSEHEAD_OUTLINE.map(([x, y]) => ({ dx: x * extent * 0.95, dy: y * extent * 0.62 }))
          : [];
      out.set(o.id, { kind: "nebula", variant: cfg.variant, blobs, ring: null, corePx, coreBlob, dust, filaments, stars, silhouette });
    } else if (o.symbol === "cluster") {
      const cfg = CLUSTER_PX[o.id];
      if (!cfg) continue;
      const rnd = mulberry32(hashSeed(o.id));
      // ⚠️ Same rule as the nebula blobs: this loop is unchanged from before
      // the colour round, and the tints come out of a SECOND pass below, so
      // every existing cluster's stars sit exactly where they did.
      const placed = Array.from({ length: cfg.stars }, () => {
        const angle = rnd() * Math.PI * 2;
        // sqrt(rnd()) spreads points evenly over the disk's AREA, not bunched
        // at the centre the way a plain linear radius would.
        const dist = Math.sqrt(rnd()) * cfg.extentPx;
        const r = 0.7 + rnd() * 0.5;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, r };
      });
      const share1 = cfg.accentShare ?? 0;
      const share2 = cfg.accent2Share ?? 0;
      const stars: TintedPlaced[] = placed.map((s) => {
        const t = rnd();
        return { ...s, tint: t < share1 ? 1 : t < share1 + share2 ? 2 : 0 };
      });
      const haze = Array.from({ length: cfg.haze ?? 0 }, (_, i) => {
        // A globular's haze is its own unresolved core, so it is concentric;
        // the Pleiades' is the dust cloud it is drifting through, so it is
        // scattered over the stars.
        if (cfg.variant === "globular") return { dx: 0, dy: 0, r: cfg.extentPx * (1 - i * 0.28) };
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * cfg.extentPx * 0.7;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: cfg.extentPx * (0.45 + rnd() * 0.35) };
      });
      out.set(o.id, {
        kind: "cluster",
        variant: cfg.variant,
        stars,
        haze,
        corePx: clamp(Math.round(cfg.extentPx * 0.6), 6, 9),
      });
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
