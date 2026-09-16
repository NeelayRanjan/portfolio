/**
 * The night sky's objects layers (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §4): the Milky Way
 * band, the deep-sky and landmark symbols, the named stars' names, the Voyager
 * chevrons and the active meteor-shower radiants. Pure drawing, called by
 * lib/sky-render.ts drawSky in the spec's back-to-front order; every function
 * returns the Hits it drew so NightSky can hit-test exactly what is on screen.
 *
 * Colours are the site tokens: ink and mut at low alpha for natural things,
 * warm for human-made things and radiants, matching the planets. No red.
 *
 * Proper nouns ("Milky Way") are rendered straight from data or literals, the
 * way sky-render.ts renders planet names; they are names, not prose.
 */
import type { GalaxyGlyph, NebulaGlyph, ObjectGlyph, PreparedMilkyWay, SkyObject, SkyShower } from "./sky-objects";
import { project, type Chart, type Equatorial } from "./sky-math";

/** A rectangle, CSS px, top-left + size. */
export type Box = { x: number; y: number; w: number; h: number };
/**
 * A selectable thing as drawn this frame, CSS px. `name` is its label.
 * `box` is where its always-on name sits (final review F1): a click inside
 * it selects the thing, before any radius test, so "click a name" is true.
 * It is reported whenever names are on (>=880px), even while the name
 * itself is suppressed under a hover label, so hovering a name can't make
 * its own hit target vanish on the next pointer move. `boxOnly` hits (the
 * Milky Way, F6) have no symbol, so they are selectable by the box alone.
 * `core` overrides lib/sky-render.ts's default on-symbol radius
 * (SYMBOL_CORE_PX) for a glyph drawn bigger than that default ("clutter"
 * follow-up, 2026-09-15: the enlarged galaxies/nebulae/clusters); every
 * other symbol leaves it unset and keeps the default.
 */
export type Hit = { id: string; name: string; x: number; y: number; box?: Box; boxOnly?: boolean; core?: number };

const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
const D2R = Math.PI / 180;

/** Sourced long-exposure colours, "r,g,b" so each draw site picks its own
 *  alpha (same shape as INK/MUT/WARM). Stargaze only. Sources:
 *  .superpowers/sdd/colour-sources.md — every entry here traces to a
 *  citation on that object's card. An id absent from this table draws grey. */
export type ObjectPalette = {
  /** Body/cloud fill. */ base: string;
  /** Core, bulge or inner region where the structure has one. */ core?: string;
  /** Arms, rim or filaments where the structure has one. */ accent?: string;
};
export const OBJECT_COLOURS: Record<string, ObjectPalette> = { /* Task 4-5 fill */ };
/**
 * One fill alpha per Milky Way level (spec order: 0 faint/outer, 4
 * bright/inner), replacing the old flat 0.022 ("clutter" follow-up,
 * 2026-09-15). Each level's fill composites OVER the ones already drawn, so
 * they still stack toward the core the way flat equal alphas did; growing
 * the per-level step on top of that is what makes the core visibly
 * brighter, not just the whole band a little more opaque everywhere. Tuned
 * by eye (Task 4 Step 9, then this pass) against a real screenshot.
 */
const MILKY_WAY_LEVEL_ALPHA = [0.02, 0.024, 0.03, 0.038, 0.05];
/** Grain alpha, same per-level indexing as above and as `mw.grain`: fainter
 *  outer dots, brighter inner ones, so the stipple itself gets denser and
 *  brighter toward the core, not just the wash underneath it. */
const MILKY_WAY_GRAIN_ALPHA = [0.05, 0.07, 0.1, 0.15, 0.22];

/** What every layer needs to know about the frame. `suppressName` is the id
 *  (a hit id, or "milky-way") whose always-on name must be skipped because
 *  the hover/selection label is about to draw the same name over it (fix
 *  round 1, C1: the two used to double-draw and fuse with neighbours). */
export type View = {
  chart: Chart;
  width: number;
  height: number;
  fontFamily: string;
  names: boolean;
  /** Stargaze only; false means draw today's greys. */
  colour: boolean;
  suppressName: string | null;
};
const onCanvas = (p: { x: number; y: number }, v: View, m: number) =>
  p.x > -m && p.x < v.width + m && p.y > -m && p.y < v.height + m;

/** Padding around a name's text box, so a click on the glyphs' edge still lands. */
const NAME_PAD = 3;
/**
 * The box a name occupies when drawn with fillText at (x, baseline) in the
 * context's CURRENT font of `px` size: measured width, a cap height of
 * ~0.8em above the baseline and ~0.25em below, padded.
 */
export function nameBox(ctx: CanvasRenderingContext2D, text: string, x: number, baseline: number, px: number): Box {
  const w = ctx.measureText(text).width;
  return { x: x - NAME_PAD, y: baseline - 0.8 * px - NAME_PAD, w: w + 2 * NAME_PAD, h: 1.05 * px + 2 * NAME_PAD };
}

/**
 * The band, plus where its one label goes. `anchor` is the label point
 * whether or not a name is drawn; `hit` exists only when the name is drawn
 * (>=880px), and is selectable by that name's box alone (final review F6:
 * it used to be an invisible 12px point, at the text baseline on desktop
 * and at nothing visible at all on a phone). Below 880px the band has no
 * canvas hit; NightSky lists it in the stargaze keyboard list instead.
 */
export function drawMilkyWay(
  ctx: CanvasRenderingContext2D,
  v: View,
  mw: PreparedMilkyWay,
): { hit: Hit | null; anchor: { x: number; y: number } | null } {
  const c = v.chart;
  const lst = c.lstDeg * D2R;
  const toScreen = (raRad: number, tanHalfColat: number) => {
    const rho = c.k * tanHalfColat;
    const phi = raRad - lst;
    return { x: c.cx + rho * Math.sin(phi), y: c.cy - rho * Math.cos(phi) };
  };
  mw.levels.forEach((rings, li) => {
    ctx.fillStyle = `rgba(${INK},${MILKY_WAY_LEVEL_ALPHA[li] ?? 0.03})`;
    ctx.beginPath();
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const { x, y } = toScreen(ring[i], ring[i + 1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    // Rings nest (the band's two edges, dark lanes, bright clouds): even-odd
    // fills exactly the area between them.
    ctx.fill("evenodd");
  });
  // A grain of tiny points over the fill so the band reads as a haze of
  // stars, not a flat wash; brighter and denser toward the core (mw.grain is
  // aligned to mw.levels, prepared once in lib/sky-objects.ts). Cheap: a
  // fillStyle change per level (5 total, not per point) and a fillRect each.
  mw.grain.forEach((pts, li) => {
    ctx.fillStyle = `rgba(${INK},${MILKY_WAY_GRAIN_ALPHA[li] ?? 0.08})`;
    for (let i = 0; i < pts.length; i += 2) {
      const { x, y } = toScreen(pts[i], pts[i + 1]);
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    }
  });
  // One "Milky Way" label: the on-canvas anchor closest to the pole, which is
  // the most stable choice as the sky turns.
  let best: { x: number; y: number } | null = null;
  let bestRho = Infinity;
  for (const [ra, dec] of mw.labels) {
    const p = project(c, ra, dec);
    const rho = Math.hypot(p.x - c.cx, p.y - c.cy);
    if (onCanvas(p, v, -40) && rho < bestRho) {
      best = p;
      bestRho = rho;
    }
  }
  if (!best) return { hit: null, anchor: null };
  // Gated on v.names like every other always-on label (M5, fix round 1).
  // Also skipped when the band itself is the current hover/selection, whose
  // own label is about to draw the same name in the same place (C1).
  if (!v.names) return { hit: null, anchor: best };
  ctx.font = `9px ${v.fontFamily}`;
  if (v.suppressName !== "milky-way") {
    ctx.fillStyle = `rgba(${MUT},0.5)`;
    ctx.fillText("Milky Way", best.x, best.y);
  }
  const box = nameBox(ctx, "Milky Way", best.x, best.y, 9);
  return { hit: { id: "milky-way", name: "Milky Way", x: best.x, y: best.y, box, boxOnly: true }, anchor: best };
}

/**
 * A unit (radius 0..1), two-armed logarithmic-ish spiral, sampled once at
 * module load ("clutter" follow-up, 2026-09-15): every galaxy glyph shares
 * these points and reaches its own size/tilt through ctx.translate/rotate/
 * scale at draw time, so drawing a galaxy costs a handful of canvas calls,
 * never a re-derivation of the spiral itself.
 */
const SPIRAL_ARM_STEPS = 20;
const SPIRAL_TURNS = 0.8;
function buildSpiralArm(mirror: boolean): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= SPIRAL_ARM_STEPS; i++) {
    const t = i / SPIRAL_ARM_STEPS;
    const r = 0.15 + 0.82 * t;
    const theta = t * SPIRAL_TURNS * Math.PI * 2 * (mirror ? -1 : 1);
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return pts;
}
const SPIRAL_ARMS = [buildSpiralArm(false), buildSpiralArm(true)];

/** A tilted spiral: bright core, a couple of faint arms, an elongated halo
 *  (not to scale; see the credit line and the object's card). The core is
 *  drawn last, outside the rotate/scale, so it stays round instead of
 *  squashed onto the galaxy's minor axis. */
function drawGalaxyGlyph(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  ctx.scale(g.majorPx, g.minorPx);
  ctx.beginPath();
  ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${INK},0.09)`;
  ctx.fill();
  ctx.lineWidth = 0.12;
  ctx.strokeStyle = `rgba(${MUT},0.4)`;
  for (const arm of SPIRAL_ARMS) {
    ctx.beginPath();
    arm.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${INK},0.85)`;
  ctx.fill();
}

/** A few overlapping low-alpha blobs read as a soft, irregular cloud instead
 *  of a dotted circle; M57 (Ring Nebula) gets a plain annulus instead, since
 *  that is the shape its own card describes. Overlap brightening is ordinary
 *  alpha compositing, no extra blend mode. */
function drawNebulaGlyph(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph): void {
  if (g.ring) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.ring.outerR, 0, Math.PI * 2);
    ctx.arc(p.x, p.y, g.ring.innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(${INK},0.4)`;
    ctx.fill("evenodd");
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.ring.innerR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${INK},0.08)`;
    ctx.fill();
    return;
  }
  ctx.fillStyle = `rgba(${INK},0.16)`;
  for (const b of g.blobs) {
    ctx.beginPath();
    ctx.arc(p.x + b.dx, p.y + b.dy, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Deep-sky symbols, landmarks, Voyagers and the named stars' names. `rings`
 * holds precomputed small-circle outlines by object id (the Kepler field);
 * `glyphs` holds the enlarged galaxy/nebula/cluster shapes ("clutter"
 * follow-up, 2026-09-15), precomputed once per catalog load in
 * lib/sky-objects.ts. `names` false (below 880px) draws symbols only.
 */
export function drawObjects(
  ctx: CanvasRenderingContext2D,
  v: View,
  objects: SkyObject[],
  rings: ReadonlyMap<string, [number, number][]>,
  glyphs: ReadonlyMap<string, ObjectGlyph>,
): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const o of objects) {
    const p = project(c, o.raDeg, o.decDeg);
    if (!onCanvas(p, v, 0)) continue;
    const glyph = glyphs.get(o.id);
    const hit: Hit = { id: o.id, name: o.name, x: p.x, y: p.y, core: glyph?.corePx };
    hits.push(hit);
    const human = o.symbol === "chevron";
    switch (o.symbol) {
      case "galaxy": {
        if (glyph && glyph.kind === "galaxy") {
          drawGalaxyGlyph(ctx, p, glyph);
          break;
        }
        // Fallback for a galaxy the size table doesn't (yet) know about.
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 5 * (o.axisRatio ?? 1), -35 * D2R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        break;
      }
      case "nebula": {
        if (glyph && glyph.kind === "nebula") {
          drawNebulaGlyph(ctx, p, glyph);
          break;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.setLineDash([1.5, 2]);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "cluster": {
        if (glyph && glyph.kind === "cluster") {
          ctx.fillStyle = `rgba(${INK},0.65)`;
          for (const s of glyph.stars) {
            ctx.beginPath();
            ctx.arc(p.x + s.dx, p.y + s.dy, s.r, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        ctx.fillStyle = `rgba(${INK},0.65)`;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(p.x + 4.5 * Math.cos(a), p.y + 4.5 * Math.sin(a), 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "core": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${INK},0.9)`;
        ctx.fill();
        break;
      }
      case "field": {
        const ring = rings.get(o.id);
        if (ring) {
          ctx.beginPath();
          ring.forEach(([ra, dec], i) => {
            const q = project(c, ra, dec);
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          });
          ctx.closePath();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = `rgba(${MUT},0.45)`;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "square": {
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.strokeRect(p.x - 2, p.y - 2, 4, 4);
        break;
      }
      case "chevron": {
        ctx.beginPath();
        ctx.moveTo(p.x - 3.5, p.y + 2);
        ctx.lineTo(p.x, p.y - 2.5);
        ctx.lineTo(p.x + 3.5, p.y + 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(${WARM},0.9)`;
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case "star":
        break; // the star layer already drew it; this adds the name and the hit
    }
    // Skipped when this object is the current hover/selection (C1): its
    // name is about to be drawn again, larger, by the hover label.
    if (v.names) {
      // A bigger glyph pushes its name out past its own edge (the enlarged
      // galaxies/nebulae/clusters, "clutter" follow-up); everything else
      // keeps the original fixed 8px.
      const dx = o.symbol === "field" ? 0 : glyph ? Math.max(8, glyph.corePx + 8) : 8;
      hit.box = nameBox(ctx, o.name, p.x + dx, p.y + 3, 9);
      if (o.id !== v.suppressName) {
        ctx.fillStyle = human ? `rgba(${WARM},0.75)` : `rgba(${MUT},0.7)`;
        ctx.fillText(o.name, p.x + dx, p.y + 3);
      }
    }
  }
  return hits;
}

/** A 6-ray burst at each active shower's peak radiant (drift ignored; the card says so). */
export function drawRadiants(ctx: CanvasRenderingContext2D, v: View, active: SkyShower[]): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const sh of active) {
    const p = project(c, sh.radiantRaDeg, sh.radiantDecDeg);
    if (!onCanvas(p, v, 0)) continue;
    const hit: Hit = { id: sh.id, name: sh.name, x: p.x, y: p.y };
    hits.push(hit);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(p.x + 2 * Math.cos(a), p.y + 2 * Math.sin(a));
      ctx.lineTo(p.x + 6.5 * Math.cos(a), p.y + 6.5 * Math.sin(a));
    }
    ctx.strokeStyle = `rgba(${WARM},0.9)`;
    ctx.stroke();
    if (v.names) {
      hit.box = nameBox(ctx, sh.name, p.x + 9, p.y + 3, 9);
      if (sh.id !== v.suppressName) {
        ctx.fillStyle = `rgba(${WARM},0.75)`;
        ctx.fillText(sh.name, p.x + 9, p.y + 3);
      }
    }
  }
  return hits;
}

/** The ISS: a small warm square with a faint halo, dimmed while it is below Moffett Field's horizon. */
export function drawIss(ctx: CanvasRenderingContext2D, v: View, iss: { eq: Equatorial; aboveHorizon: boolean }): Hit | null {
  const p = project(v.chart, iss.eq.raDeg, iss.eq.decDeg);
  if (!onCanvas(p, v, 0)) return null;
  const a = iss.aboveHorizon ? 1 : 0.35;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${WARM},${0.16 * a})`;
  ctx.fill();
  ctx.fillStyle = `rgba(${WARM},${0.95 * a})`;
  ctx.fillRect(p.x - 1.75, p.y - 1.75, 3.5, 3.5);
  // Skipped when the ISS is the current hover/selection (fix round 1, C1
  // precedent): its name is about to be drawn again, larger, by the hover label.
  const hit: Hit = { id: "iss", name: "ISS", x: p.x, y: p.y };
  if (v.names) {
    ctx.font = `9px ${v.fontFamily}`;
    hit.box = nameBox(ctx, "ISS", p.x + 8, p.y + 3, 9);
    if (v.suppressName !== "iss") {
      ctx.fillStyle = `rgba(${WARM},${0.75 * a})`;
      ctx.fillText("ISS", p.x + 8, p.y + 3);
    }
  }
  return hit;
}
