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
import { SPIRAL_DR, SPIRAL_R0, SPIRAL_TURNS } from "./sky-objects";
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
  /** Arms, rim, filaments, knots or a jet where the structure has one. */ accent?: string;
};
/**
 * Galaxies (colour round task 4). Every value below is the hex the object's
 * own section of .superpowers/sdd/sky-colour/colour-sources.md suggests for a
 * colour that file's citations state in words, converted to "r,g,b" and
 * nothing else. Where a source describes no colour for part of a structure,
 * that slot is ABSENT and the draw function leaves it undrawn.
 *
 * ⚠️ M82 is deliberately not here, and that is not an oversight to fix
 * (ruling R-COLOUR-1, .superpowers/sdd/sky-colour/progress.md). Both of its
 * famous portraits are composites of X-ray and infrared data, which have no
 * visible colour at all, so there is nothing honest to fall back on. It draws
 * its structure in the site's own neutrals instead, and its absence here is
 * also what keeps the colour note off its card (task 7).
 *
 * ⚠️ M104 gets a bulge and a dust lane and NO disk: colour-sources.md looked
 * for a sourced "blue disk" for this specific galaxy and could not find one.
 * Nebulae and clusters are task 5's to add.
 */
export const OBJECT_COLOURS: Record<string, ObjectPalette> = {
  // APOD 2019: "a bright yellow nucleus, dark winding dust lanes, luminous
  // blue spiral arms, and bright red emission nebulas".
  m31: { base: "111,168,255", core: "233,214,160", accent: "255,95,82" },
  // NASA/APOD 2017: "blue star clusters and pinkish star forming regions
  // along the galaxy's loosely wound spiral arms", over a yellow-white core.
  m33: { base: "91,143,214", core: "242,225,168", accent: "255,111,145" },
  // ESA/Hubble: "bright pink star-forming regions... Bright blue star
  // clusters", around an older yellow core.
  m51: { base: "111,168,255", core: "232,200,138", accent: "255,111,168" },
  // NASA: "spiral arms... made up of young, bluish, hot stars", "central
  // bulge contains much older, redder stars". No source names a knot colour
  // for M81 specifically, so it gets no accent and draws no knots; the pink
  // composite everyone shares is ultraviolet plus visible plus infrared and
  // is not this galaxy's colour.
  m81: { base: "91,143,214", core: "232,217,160" },
  // NASA: "the blue of the jet contrasts with the yellow glow from the
  // combined light of billions of unseen stars and the yellow, point-like
  // globular clusters". Base and core are that one yellow-white starlight;
  // the accent is the jet's synchrotron blue.
  m87: { base: "240,228,192", accent: "74,144,226" },
  // NASA/ESA: "a brilliant, white, bulbous core encircled by thick dust lanes
  // comprising the spiral structure". The lane IS the disk here.
  m104: { base: "245,240,225", accent: "36,28,22" },
};
/** M82's neutrals, and the fallback for any galaxy whose palette names no
 *  dust colour. Near the desk (#0c0b09) so a lane painted over a body reads
 *  as a gap in it rather than as a coloured bar. */
const STARBURST_MONO: ObjectPalette = { base: INK, core: INK, accent: "24,20,16" };
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
/** How far down to push a name that would land on one already drawn, and how
 *  many times to try before giving up and letting it overlap. One line of 9px
 *  text plus a little air; a handful of tries clears a realistic pile-up
 *  without letting a label drift so far it stops reading as this object's. */
const NAME_STACK_STEP_PX = 11;
const NAME_STACK_TRIES = 4;
const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** How far the Milky Way's label centre must clear a drawn object's symbol
 *  before that anchor counts as usable. Comfortably past the widest on-symbol
 *  hit radius (a big glyph's `core`, capped at 12) so the band's box, and not
 *  the object, wins a click aimed at the label. */
const LABEL_CLEARANCE_PX = 30;
/** Stargaze's own chrome: the hint line across the top and the credit block
 *  along the bottom. The band's label avoids both, so it is neither hard to
 *  read nor hard to click. Generous on the bottom because the credit wraps to
 *  three lines on a narrow window. */
const CHROME_TOP_PX = 90;
const CHROME_BOTTOM_PX = 130;
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
  /** Already-projected object points the label should not sit on; see the
   *  anchor-picking comment below. Empty is fine and keeps the old behaviour. */
  avoid: readonly { x: number; y: number }[] = [],
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
  //
  // ⚠️ Anchors that a drawn object sits on are passed over first (colour
  // round, 2026-09-15). The band is selectable by its label box ALONE
  // (`boxOnly`), and hit precedence runs the on-symbol pass before any box,
  // so an object within a few px of the label makes the Milky Way
  // unclickable there. That is not hypothetical: adding the Double Cluster
  // put NGC 869 and NGC 884 6 and 10px from the label's own centre, which is
  // no accident — the Double Cluster lies IN the band, and the band's
  // anchors are in the band by construction, so this collision class recurs
  // every time a new object lands in the Milky Way.
  //
  // Two things spoil an anchor: a drawn object sitting on it, and the page's
  // own chrome. Stargaze puts a hint line across the top and a credit block
  // along the bottom, so a label parked there is both hard to read and hard
  // to click. Both are scored, clear beats crowded, and closeness to the pole
  // only breaks ties within a tier. If EVERY anchor is spoiled we still take
  // the closest rather than drop the label: a band a visitor has to hunt to
  // click still beats an unlabelled one.
  ctx.font = `9px ${v.fontFamily}`;
  const labelHalfW = ctx.measureText("Milky Way").width / 2;
  const spoiled = (p: { x: number; y: number }) => {
    if (p.y < CHROME_TOP_PX || p.y > v.height - CHROME_BOTTOM_PX) return true;
    return avoid.some((o) => Math.hypot(o.x - (p.x + labelHalfW), o.y - p.y) < LABEL_CLEARANCE_PX);
  };
  let best: { x: number; y: number } | null = null;
  let bestRho = Infinity;
  let bestSpoiled = true;
  for (const [ra, dec] of mw.labels) {
    const p = project(c, ra, dec);
    if (!onCanvas(p, v, -40)) continue;
    const rho = Math.hypot(p.x - c.cx, p.y - c.cy);
    const isSpoiled = spoiled(p);
    if (bestSpoiled && !isSpoiled) {
      best = p;
      bestRho = rho;
      bestSpoiled = false;
    } else if (isSpoiled === bestSpoiled && rho < bestRho) {
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
function buildSpiralArm(mirror: boolean): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= SPIRAL_ARM_STEPS; i++) {
    const t = i / SPIRAL_ARM_STEPS;
    const r = SPIRAL_R0 + SPIRAL_DR * t;
    const theta = t * SPIRAL_TURNS * Math.PI * 2 * (mirror ? -1 : 1);
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return pts;
}
const SPIRAL_ARMS = [buildSpiralArm(false), buildSpiralArm(true)];

/** A tilted spiral: bright core, a couple of faint arms, an elongated halo
 *  (not to scale; see the credit line and the object's card). The core is
 *  drawn last, outside the rotate/scale, so it stays round instead of
 *  squashed onto the galaxy's minor axis.
 *
 *  This is what every galaxy draws with no palette, which is every galaxy
 *  outside stargaze: the colour round changes nothing about the page's
 *  ordinary look. */
function drawPlainGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph): void {
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

/* --- the coloured variants (stargaze only) ---------------------------- *
 *
 * Alpha discipline: this is a dim chart on a near-black desk, not a poster.
 * Every fill below is low-alpha and STACKS, which is how a body gets brighter
 * toward its middle without a single createRadialGradient. That matters for
 * more than taste: a gradient's coordinates are the object's screen position,
 * which moves every frame, so a gradient here would have to be rebuilt ~20
 * times a second per object. Three nested fills cost less than one
 * createRadialGradient, and they cost the same on every frame.
 */

/** Nested body fills, faint outside, stacking toward the middle. Scales are
 *  fractions of the glyph's own major/minor radii, drawn under the glyph's
 *  rotation (the caller owns the transform). */
const BODY_SCALES = [1, 0.72, 0.46];
const BODY_ALPHA = 0.05;
/** A round bulge, always drawn OUTSIDE the rotate/scale so it stays round.
 *  The innermost layer is the plain glyph's own core (r 1.6, alpha 0.85); the
 *  two around it are what make it read as a glow rather than a dot. */
const BULGE_LAYERS: [number, number][] = [
  [3.4, 0.09],
  [2.3, 0.18],
  [1.6, 0.85],
];
function drawBulge(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, rgb: string, scale = 1): void {
  for (const [r, a] of BULGE_LAYERS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fill();
  }
}
function fillBody(ctx: CanvasRenderingContext2D, g: GalaxyGlyph, rgb: string, scales: number[], alpha: number): void {
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  for (const s of scales) {
    ctx.beginPath();
    ctx.ellipse(0, 0, g.majorPx * s, g.minorPx * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
function fillPlaced(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, places: readonly { dx: number; dy: number; r: number }[], rgb: string, alpha: number): void {
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  for (const k of places) {
    ctx.beginPath();
    ctx.arc(p.x + k.dx, p.y + k.dy, k.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** The dust lane, in the glyph's rotated frame (the caller owns the
 *  transform). Painted at high alpha in a near-desk dark so it subtracts the
 *  body's light instead of adding a coloured bar: the lane reads as the gap
 *  it is. */
function fillLane(ctx: CanvasRenderingContext2D, lane: NonNullable<GalaxyGlyph["lane"]>, rgb: string): void {
  ctx.fillStyle = `rgba(${rgb},0.85)`;
  ctx.fillRect(-lane.spanPx / 2, lane.offsetPx - lane.halfPx, lane.spanPx, lane.halfPx * 2);
}

/** M31, M33, M81, and M51 with its companion: blue arms over a blue disk,
 *  a warm core, and (where a source names them) red or pink H II knots on
 *  the arms. */
function drawSpiralGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainGalaxy(ctx, p, g);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  fillBody(ctx, g, pal.base, BODY_SCALES, BODY_ALPHA);
  ctx.scale(g.majorPx, g.minorPx);
  ctx.lineWidth = 0.11;
  ctx.strokeStyle = `rgba(${pal.base},0.45)`;
  for (const arm of SPIRAL_ARMS) {
    ctx.beginPath();
    arm.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
  }
  ctx.restore();
  // The companion carries no colour of its own: no source in colour-sources.md
  // describes NGC 5195's, so it draws in the site's ink like any uncoloured
  // thing on the chart.
  if (g.companion) fillPlaced(ctx, p, [g.companion, { ...g.companion, r: g.companion.r * 0.45 }], INK, 0.17);
  if (pal.accent) fillPlaced(ctx, p, g.knots, pal.accent, 0.5);
  drawBulge(ctx, p, pal.core ?? pal.base);
}

/** M87: a smooth halo of old starlight, its yellow globular clusters, and the
 *  synchrotron jet, which is the one thing on this chart that has to be
 *  visible at a glance. */
function drawEllipticalGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainGalaxy(ctx, p, g);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  fillBody(ctx, g, pal.base, [1, 0.78, 0.56, 0.34], 0.05);
  ctx.restore();
  fillPlaced(ctx, p, g.knots, pal.core ?? pal.base, 0.4);
  if (g.jet && pal.accent) {
    const a = g.jet.angleDeg * D2R;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const s0 = 2.4;
    const s1 = g.jet.lengthPx;
    const w0 = 0.5;
    const w1 = g.jet.halfWidthPx;
    ctx.beginPath();
    ctx.moveTo(p.x + ux * s0 - uy * w0, p.y + uy * s0 + ux * w0);
    ctx.lineTo(p.x + ux * s1 - uy * w1, p.y + uy * s1 + ux * w1);
    ctx.lineTo(p.x + ux * s1 + uy * w1, p.y + uy * s1 - ux * w1);
    ctx.lineTo(p.x + ux * s0 + uy * w0, p.y + uy * s0 - ux * w0);
    ctx.closePath();
    ctx.fillStyle = `rgba(${pal.accent},0.5)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x + ux * s1, p.y + uy * s1, w1 * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${pal.accent},0.75)`;
    ctx.fill();
  }
  drawBulge(ctx, p, pal.core ?? pal.base);
}

/** M104: a brilliant bulge with the dust ring crossing it, and nothing else.
 *  No disk is drawn on purpose, because no fetched source describes the
 *  Sombrero's disk colour (colour-sources.md's own gap note). The lane runs
 *  wider than the bulge, so the ring shows past it on both sides. */
function drawEdgeOnGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainGalaxy(ctx, p, g);
  const bulgeR = Math.max(g.minorPx * 1.25, 4);
  ctx.fillStyle = `rgba(${pal.base},0.055)`;
  for (const s of BODY_SCALES) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, bulgeR * s, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBulge(ctx, p, pal.core ?? pal.base);
  if (g.lane) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(g.tiltDeg * D2R);
    fillLane(ctx, g.lane, pal.accent ?? STARBURST_MONO.accent!);
    ctx.restore();
  }
}

/** M82: an edge-on disk split by its dust lane, with the superwind's
 *  filaments running out both faces. Shape only. It takes STARBURST_MONO
 *  rather than a palette because nothing honest is available to colour it
 *  with (see OBJECT_COLOURS' note), and it draws the same in stargaze as out
 *  of it. */
function drawStarburstGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  const c = pal ?? STARBURST_MONO;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  fillBody(ctx, g, c.base, BODY_SCALES, 0.06);
  if (g.lane) fillLane(ctx, g.lane, c.accent ?? STARBURST_MONO.accent!);
  ctx.restore();
  if (g.plumes.length) {
    ctx.beginPath();
    for (const f of g.plumes) {
      ctx.moveTo(p.x + f.x1, p.y + f.y1);
      ctx.lineTo(p.x + f.x2, p.y + f.y2);
    }
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = `rgba(${MUT},0.3)`;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  drawBulge(ctx, p, c.core ?? c.base);
}

/**
 * One draw path per variant, each of them picking its colours out of the
 * palette it is handed; `null` (colour off, or an id with no palette entry)
 * falls back to the plain grey glyph above. The one exception is the
 * starburst, which HAS no honest palette and so would otherwise never draw
 * the structure it was given.
 */
function drawGalaxyGlyph(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  switch (g.variant) {
    case "elliptical":
      return drawEllipticalGalaxy(ctx, p, g, pal);
    case "edge-on":
      return drawEdgeOnGalaxy(ctx, p, g, pal);
    case "starburst":
      return drawStarburstGalaxy(ctx, p, g, pal);
    default:
      return drawSpiralGalaxy(ctx, p, g, pal);
  }
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
  /** Name boxes already placed this frame, so a later name can step down past
   *  them instead of printing on top (see the nudge loop below). */
  const drawnNameBoxes: Box[] = [];
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
          drawGalaxyGlyph(ctx, p, glyph, v.colour ? (OBJECT_COLOURS[o.id] ?? null) : null);
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
      // Nudge a name down until it clears the ones already drawn this frame.
      // Two objects a fraction of a degree apart otherwise print their labels
      // on top of each other into an unreadable smear: the Double Cluster's
      // two halves did exactly that once the catalog gained them (colour
      // round, 2026-09-15), and the same goes for M81 and M82, four px apart.
      // Each name also carries its own hit box, so overlapping boxes make the
      // upper name unclickable as well as unreadable.
      let baseline = p.y + 3;
      for (let attempt = 0; attempt < NAME_STACK_TRIES; attempt++) {
        const b = nameBox(ctx, o.name, p.x + dx, baseline, 9);
        if (!drawnNameBoxes.some((q) => boxesOverlap(b, q))) break;
        baseline += NAME_STACK_STEP_PX;
      }
      hit.box = nameBox(ctx, o.name, p.x + dx, baseline, 9);
      drawnNameBoxes.push(hit.box);
      if (o.id !== v.suppressName) {
        ctx.fillStyle = human ? `rgba(${WARM},0.75)` : `rgba(${MUT},0.7)`;
        ctx.fillText(o.name, p.x + dx, baseline);
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
