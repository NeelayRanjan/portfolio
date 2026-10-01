/**
 * Draws one frame of the night sky. No state, no clock, no DOM beyond the
 * context it is handed: NightSky owns time, sizing and input.
 *
 * Layers, back to front (spec 2026-09-15 §4): desk fill, Milky Way band,
 * graticule, ecliptic, constellation lines, stars, objects, meteor radiants,
 * planets, the Moon, the ISS, then the hover/selection layer. Colors are the
 * site tokens (desk #0c0b09, ink #eae5da, mut #9a948a, warm #d9a45b) at low
 * alpha; no red, which stays reviewer's ink.
 *
 * Planet names and "Moon" are rendered straight from the PLANETS enum and a
 * literal, the way copy.ts's header allows enum values; they are proper
 * nouns, not prose. The hover one-liners come from content/sky-facts.ts,
 * handed in through `oneLiner`.
 */
import type { SkyData } from "./sky-data";
import { addUnderline, drawIss, drawMilkyWay, drawObjects, drawRadiants, nameBox, nameClearsPhoneChrome, strokeUnderlines, type Hit, type View } from "./sky-layers";
import type { ObjectGlyph, PreparedMilkyWay, SkyObject, SkyShower } from "./sky-objects";
import { eclipticToEquatorial, project, type Chart, type Equatorial, type Planet, type Point } from "./sky-math";
import { lerpRgb } from "./sky-colour";
import { starColourRgb } from "./star-colour";

export type { Hit };
export type Bodies = {
  planets: { name: Planet; eq: Equatorial }[];
  moon: Equatorial;
  phase: { litFraction: number; brightLimbDeg: number };
};
export type Segment = [x1: number, y1: number, x2: number, y2: number];
/** A rectangle to keep hover labels clear of, CSS px (the sheet's own bounding rect). */
export type Avoid = { left: number; top: number; right: number; bottom: number };
/** The box a hover label was actually drawn in, CSS px, top-left + size. */
export type LabelBox = { x: number; y: number; w: number; h: number };
/** What a hover label says: the name (constellations: Latin, then English) and the one-liner. */
export type LabelText = { title: string; english: string | null; sub: string | null };
export type Projected = {
  segments: Map<string, Segment[]>;
  /** Everything selectable that is on screen this frame, in draw order. */
  hits: Hit[];
  /** The Milky Way's label point this frame, drawn or not (below 880px it
   *  has no hit, but the stargaze keyboard list still offers it; F6). */
  milkyWay: { x: number; y: number } | null;
  label: LabelBox | null;
  labelText: LabelText | null;
  /** The id whose always-on name was skipped this frame because the
   *  hover/selection label was about to draw it again (fix round 1, C1). */
  suppressName: string | null;
  /** How many entry rings drew this frame (0 when none are live). */
  entryRings: number;
};
/** A hovered (or tapped) thing: a constellation by abbreviation, or a Hit by id. */
export type Highlight = { kind: "constellation" | "hit"; id: string; pointer: Point };
export type FrameInput = {
  width: number;
  height: number;
  chart: Chart;
  magLimit: number;
  bodies: Bodies;
  fontFamily: string;
  highlight: Highlight | null;
  avoid: Avoid | null;
  /** Every `sky.stars` entry's radius, alpha and colours, same order, from
   *  `prepareStarPaint`, once per catalog load. The fill strings depend only
   *  on catalog mag/bv and the saturation, so `drawSky` rebuilds them only
   *  when the saturation changes (task 18: stars take their B-V colour
   *  through the same saturation as everything else). */
  starPaint: StarPaint;
  /** Prepared once per load (lib/sky-objects.ts); null until it lands or if absent. */
  milkyWay: PreparedMilkyWay | null;
  /** objects.json's objects; empty until it lands or if absent. */
  objects: SkyObject[];
  /** Small-circle outlines by object id (the Kepler field), prepared once per load. */
  objectRings: ReadonlyMap<string, [number, number][]>;
  /** Enlarged galaxy/nebula/cluster shapes by object id ("clutter" follow-up,
   *  2026-09-15), prepared once per load in lib/sky-objects.ts. */
  objectGlyphs: ReadonlyMap<string, ObjectGlyph>;
  /** Only the showers active on the simulated date. */
  showers: SkyShower[];
  /** Always-on names beside symbols (false below 880px, spec §4). */
  names: boolean;
  /** Sourced colour, 0..1 (lib/sky-layers.ts View.saturation): 0 the grey
   *  chart, 1 full colour. Data, like `names`: the caller decides it, this
   *  module never reads the stargaze store or the pointer. */
  saturation: number;
  /** Stargaze's fixed chrome is on screen (the band's label avoids it). */
  stargazeChrome: boolean;
  /** The stargaze hint bar's measured bottom edge in px (0 when unmeasured):
   *  phone names keep clear of it. Data, like the rest; see View.chromeTopPx. */
  chromeTopPx?: number;
  /** Dotted underlines under drawn names (View.underlineNames): stargaze only. */
  underlineNames: boolean;
  /** Names for coloured objects below 880px (View.colouredNames): stargaze only. */
  colouredNames: boolean;
  /** The one-shot entry rings (discoverability spec §4): the ids to ring and
   *  the envelope's opacity this frame, 0..1. The caller owns the clock and
   *  the choice of ids; null or alpha 0 draws nothing. Drawn only, never a
   *  hit: a ring can't take a click or open anything. */
  entryRings: { ids: readonly string[]; alpha: number } | null;
  /** The desk one-liner for an id, from content/sky-facts.ts; null until the facts load. */
  oneLiner: (id: string) => string | null;
  /** The id whose card is open (Task 5), ringed like a hover. */
  selectedId: string | null;
  /** The ISS in J2000 (lib/sky-iss.ts, precessed), or null when there is no usable TLE. */
  iss: { eq: Equatorial; aboveHorizon: boolean } | null;
};

const DESK = "#0c0b09";
const DESK_RGB = "12,11,9";
const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
/** Built once: the planet and Moon underlines, their names' colours at lower alpha. */
const UNDERLINE_WARM = `rgba(${WARM},0.5)`;
const UNDERLINE_INK = `rgba(${INK},0.45)`;
const D2R = Math.PI / 180;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Faint B-V tint: blue-white through the ink tone to amber. Never saturated.
 *  Since task 18 this is the SATURATION-0 colour only; above 0 a star lerps
 *  toward its photometric colour (prepareStarPaint, lib/star-colour.ts). */
function starRgb(bv: number): string {
  const t = clamp((bv + 0.3) / 2.0, 0, 1);
  const mix = (a: number, b: number, u: number) => Math.round(a + (b - a) * u);
  if (t < 0.45) {
    const u = t / 0.45;
    return `${mix(205, 234, u)},${mix(218, 229, u)},${mix(255, 218, u)}`;
  }
  const u = (t - 0.45) / 0.55;
  return `${mix(234, 240, u)},${mix(229, 196, u)},${mix(218, 150, u)}`;
}

/**
 * The faint-star cut (task 18, controller ruling R23): sky.json now runs to
 * mag 6.0, about the naked-eye limit under a dark sky, three times the stars
 * it had at 5.0 (5,044 against 1,627). Every star at or brighter than this
 * draws exactly as it always did, one arc each. Everything fainter draws
 * smaller and dimmer than the old faintest star (a radius-0.5 dot at alpha
 * 0.25, about 0.2 of a pixel's light), on a steeper curve, so the
 * constellation lines and the bright stars still lead. Tuned by eye against
 * 1440px screenshots at paper saturation and in stargaze.
 *
 * The faint ones are BATCHED: ~3,400 stars, so instead of an arc and a fill
 * each they go down as tiny squares, one path and one fill per bucket of
 * stars that share a colour and alpha (a few hundred buckets, prepared once
 * per catalog load). Each square is SNAPPED inside one CSS pixel: the first
 * try drew them at their exact sub-pixel points, and antialiasing smeared each
 * one across four pixels at a quarter of its light, so 3,400 new stars moved
 * the count of lit pixels in a 1440px screenshot by under 2% (measured). A
 * snapped 0.88px square keeps its light in one pixel, which is what a
 * pinprick of a star looks like. Its total light (alpha x area: 0.17 just
 * past the cut, 0.09 at mag 6) stays under the old faintest dot's 0.2, and
 * on screen it is one pixel where that dot smears across two to four, so
 * every new star is both smaller and dimmer than the faintest old one.
 */
export const FAINT_STAR_MAG = 5.0;
/** Square side in CSS px (area 0.77 px², under the old 0.5px disc's 0.785). */
const FAINT_SIDE = 0.88;
/** Alpha just past the cut, and at mag 6. */
const FAINT_ALPHA = [0.22, 0.12] as const;
/** Centres the square inside the pixel it falls in. */
const FAINT_INSET = (1 - FAINT_SIDE) / 2;

/** Stars past FAINT_STAR_MAG sharing a size, an alpha and colours. */
export type FaintBucket = {
  /** Catalog magnitude (0.1 steps), so a lower magLimit can skip the bucket. */
  mag: number;
  alpha: number;
  tint: string;
  full: string | null;
  base: string;
  /** Indices into sky.stars. */
  stars: number[];
  /** Per star, prepared once: RA in radians and tan((90° − dec) / 2), the
   *  two halves of `project` that never change, so the ~3,400-star loop does
   *  one sin and one cos each and allocates nothing. */
  raRad: Float64Array;
  tanHalfColat: Float64Array;
};

/**
 * Per-star paint, prepared once per catalog load. For the stars at or
 * brighter than FAINT_STAR_MAG (the first `brightCount` entries, since the
 * catalog is sorted brightest first), `base` is each star's fill at
 * saturation 0, byte-identical to what the pre-task-18 `precomputeStarFills`
 * built, and `radius` the same arc radius the old loop computed, so that loop
 * draws exactly the calls it always did (proved by trace, see
 * scripts/test-sky-stars.mjs). `tint` is that faint B-V tint as "r,g,b";
 * `full` the star's own photometric colour (lib/star-colour.ts), or null for
 * a star with no B-V, which then never leaves its tint. The fainter stars
 * live in `faint`, bucketed.
 */
export type StarPaint = {
  brightCount: number;
  radius: number[];
  alpha: number[];
  tint: string[];
  full: (string | null)[];
  base: string[];
  faint: FaintBucket[];
};

export function emptyStarPaint(): StarPaint {
  return { brightCount: 0, radius: [], alpha: [], tint: [], full: [], base: [], faint: [] };
}

export function prepareStarPaint(stars: SkyData["stars"]): StarPaint {
  const p = emptyStarPaint();
  const buckets = new Map<string, FaintBucket>();
  stars.forEach(([, , mag, bv], i) => {
    // A missing B-V (two stars) keeps the old neutral 0.6 tint, exactly as the
    // catalog's old stand-in value drew, and gets no colour above saturation 0.
    const tint = starRgb(bv ?? 0.6);
    const full = starColourRgb(bv, mag);
    if (mag <= FAINT_STAR_MAG) {
      // The bright stars must be an exact prefix (sky.json is sorted
      // brightest first): `radius`/`base` are indexed by catalog position,
      // so a bright star after a faint one would silently misalign them.
      if (p.brightCount !== i) throw new Error(`sky.json: star ${i} (mag ${mag}) follows a star fainter than ${FAINT_STAR_MAG}; the catalog must be sorted brightest first`);
      const alpha = clamp(1 - (mag + 1.5) * 0.12, 0.25, 1);
      p.brightCount = i + 1;
      p.radius.push(clamp(2.1 - 0.32 * mag, 0.5, 2.6));
      p.alpha.push(alpha);
      p.tint.push(tint);
      p.full.push(full);
      p.base.push(`rgba(${tint},${alpha})`);
      return;
    }
    const t = clamp(mag - FAINT_STAR_MAG, 0, 1);
    const alpha = Math.round((FAINT_ALPHA[0] + (FAINT_ALPHA[1] - FAINT_ALPHA[0]) * t) * 1000) / 1000;
    const key = `${mag}|${tint}|${full}`;
    let b = buckets.get(key);
    if (!b) {
      b = { mag, alpha, tint, full, base: `rgba(${tint},${alpha})`, stars: [], raRad: new Float64Array(0), tanHalfColat: new Float64Array(0) };
      buckets.set(key, b);
    }
    b.stars.push(i);
  });
  p.faint = [...buckets.values()].sort((a, b) => a.mag - b.mag || (a.stars[0] - b.stars[0]));
  for (const b of p.faint) {
    b.raRad = Float64Array.from(b.stars, (i) => stars[i][0] * D2R);
    b.tanHalfColat = Float64Array.from(b.stars, (i) => Math.tan(((90 - stars[i][1]) / 2) * D2R));
  }
  return p;
}

/**
 * The fill strings at saturation `s`, bright stars then faint buckets: `base`
 * at 0, each tint lerped toward its own colour by `s` above it (the same
 * share every other sky colour takes: PAPER_COLOUR_SHARE on the page, full
 * over the sky and in stargaze). Rebuilt only when `s` or the catalog
 * changes, which at rest is never.
 */
let memoStarPaint: StarPaint | null = null;
let memoStarS = Number.NaN;
let memoStarFills: { bright: string[]; faint: string[] } = { bright: [], faint: [] };
export function starFillsAt(p: StarPaint, s: number): { bright: string[]; faint: string[] } {
  if (p === memoStarPaint && s === memoStarS) return memoStarFills;
  memoStarPaint = p;
  memoStarS = s;
  const at = (base: string, tint: string, full: string | null, alpha: number) =>
    !(s > 0) || full === null ? base : `rgba(${lerpRgb(tint, full, s)},${alpha})`;
  memoStarFills = {
    bright: p.base.map((b, i) => at(b, p.tint[i], p.full[i], p.alpha[i])),
    faint: p.faint.map((b) => at(b.base, b.tint, b.full, b.alpha)),
  };
  return memoStarFills;
}

export function drawSky(ctx: CanvasRenderingContext2D, sky: SkyData, f: FrameInput): Projected {
  const { width, height, chart: c } = f;
  // The id whose always-on name must be skipped this frame (fix round 1,
  // C1): the current hover wins over the current selection, since the
  // hover's label is what is about to overdraw it. NightSky.tsx sets
  // selectedId to the open card's subject (Task 5), so a selected object's
  // own name stays suppressed while its card is open, the same as a hover.
  const suppressName = f.highlight?.kind === "hit" ? f.highlight.id : f.selectedId;
  const view: View = { chart: c, width, height, fontFamily: f.fontFamily, names: f.names, saturation: f.saturation, stargazeChrome: f.stargazeChrome, chromeTopPx: f.chromeTopPx, underlineNames: f.underlineNames, colouredNames: f.colouredNames, suppressName };
  const onCanvas = (p: { x: number; y: number }, m: number) =>
    p.x > -m && p.x < width + m && p.y > -m && p.y < height + m;
  const radiusAt = (dec: number) => c.k * Math.tan(((90 - dec) / 2) * D2R);
  const hits: Hit[] = [];

  ctx.fillStyle = DESK;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;

  // Milky Way band, under everything else. The objects are projected here,
  // though they draw much later: the band's label has to know where they
  // land so it can pick an anchor none of them is sitting on (see
  // drawMilkyWay). Pure arithmetic over ~45 points, no drawing, once a frame.
  const objectPoints = f.objects.map((o) => project(c, o.raDeg, o.decDeg));
  let milkyWayAnchor: { x: number; y: number } | null = null;
  if (f.milkyWay) {
    const mw = drawMilkyWay(ctx, view, f.milkyWay, objectPoints);
    if (mw.hit) hits.push(mw.hit);
    milkyWayAnchor = mw.anchor;
  }
  ctx.font = `10px ${f.fontFamily}`;

  // Graticule: declination circles, hour spokes, labels.
  for (const dec of [60, 30, 0, -30]) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, radiusAt(dec), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${MUT},${dec === 0 ? 0.16 : 0.08})`;
    ctx.stroke();
  }
  ctx.beginPath();
  for (let h = 0; h < 24; h += 2) {
    const a = project(c, h * 15, 80);
    const b = project(c, h * 15, -60);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = `rgba(${MUT},0.07)`;
  ctx.stroke();
  ctx.fillStyle = `rgba(${MUT},0.45)`;
  for (let h = 0; h < 24; h += 2) {
    const p = project(c, h * 15, 0);
    if (onCanvas(p, 0)) ctx.fillText(`${h}h`, p.x + 3, p.y - 3);
  }
  for (const dec of [60, 30, 0, -30]) {
    const p = project(c, 0, dec);
    if (onCanvas(p, 0)) ctx.fillText(dec > 0 ? `+${dec}°` : dec < 0 ? `−${-dec}°` : "0°", p.x + 3, p.y + 11);
  }

  // Ecliptic.
  ctx.beginPath();
  for (let lon = 0; lon <= 360; lon += 2) {
    const e = eclipticToEquatorial(lon);
    const p = project(c, e.raDeg, e.decDeg);
    if (lon === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = `rgba(${MUT},0.22)`;
  ctx.stroke();
  ctx.setLineDash([]);

  // Constellation lines; the projected segments go back to NightSky for
  // hit-testing and the verify snapshot.
  const segments = new Map<string, Segment[]>();
  ctx.beginPath();
  for (const [abbr, polylines] of Object.entries(sky.lines)) {
    const segs: Segment[] = [];
    for (const pl of polylines) {
      let prev: { x: number; y: number } | null = null;
      for (const [ra, dec] of pl) {
        const p = project(c, ra, dec);
        if (prev) {
          segs.push([prev.x, prev.y, p.x, p.y]);
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
        }
        prev = p;
      }
    }
    segments.set(abbr, segs);
  }
  ctx.strokeStyle = `rgba(${MUT},0.3)`;
  ctx.stroke();

  // Stars, brightest first, so the magnitude cut is a break. The bright
  // ones (mag <= FAINT_STAR_MAG) one arc each, exactly as before task 18...
  const sp = f.starPaint;
  const starFills = starFillsAt(sp, f.saturation);
  for (let i = 0; i < sp.brightCount; i++) {
    const [ra, dec, mag] = sky.stars[i];
    if (mag > f.magLimit) break;
    const p = project(c, ra, dec);
    if (!onCanvas(p, 4)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, sp.radius[i], 0, Math.PI * 2);
    ctx.fillStyle = starFills.bright[i];
    ctx.fill();
  }
  // ...then the faint ones, one path and one fill per bucket. The same
  // projection as `project` (sky-math.ts), split so the constant half is
  // prepared once.
  const lstRad = c.lstDeg * D2R;
  for (let b = 0; b < sp.faint.length; b++) {
    const bucket = sp.faint[b];
    if (bucket.mag > f.magLimit) break;
    let any = false;
    for (let j = 0; j < bucket.raRad.length; j++) {
      const rho = c.k * bucket.tanHalfColat[j];
      const phi = bucket.raRad[j] - lstRad;
      const x = c.cx + rho * Math.sin(phi);
      const y = c.cy - rho * Math.cos(phi);
      if (!(x > -4 && x < width + 4 && y > -4 && y < height + 4)) continue;
      if (!any) ctx.beginPath();
      any = true;
      ctx.rect(Math.floor(x) + FAINT_INSET, Math.floor(y) + FAINT_INSET, FAINT_SIDE, FAINT_SIDE);
    }
    if (!any) continue;
    ctx.fillStyle = starFills.faint[b];
    ctx.fill();
  }

  // Objects, then the active radiants.
  hits.push(...drawObjects(ctx, view, f.objects, f.objectRings, f.objectGlyphs));
  hits.push(...drawRadiants(ctx, view, f.showers));
  ctx.font = `10px ${f.fontFamily}`;

  // Planets. Their names draw at every width, so while stargazing they
  // underline at every width too.
  for (const { name, eq } of f.bodies.planets) {
    const p = project(c, eq.raDeg, eq.decDeg);
    if (!onCanvas(p, 20)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${WARM},0.95)`;
    ctx.fill();
    const id = name.toLowerCase();
    const box = nameBox(ctx, name, p.x + 6, p.y + 3, 10);
    // On a phone in stargaze a name that would sit in the hint bar's or the
    // credit's band is left undrawn, like the coloured phone names; the
    // symbol stays tappable (discoverability Task 6).
    const nameShown = nameClearsPhoneChrome(view, box);
    // Skipped when this planet is the current hover/selection (C1): its
    // name is about to be drawn again, larger, by the hover label.
    if (nameShown && id !== suppressName) {
      ctx.fillStyle = `rgba(${WARM},0.75)`;
      ctx.fillText(name, p.x + 6, p.y + 3);
      if (f.underlineNames) {
        ctx.beginPath();
        addUnderline(ctx, box, p.y + 3);
        strokeUnderlines(ctx, UNDERLINE_WARM);
      }
    }
    // Planet names draw at every width, so their boxes are hit targets at every width (F1).
    if (onCanvas(p, 0)) hits.push({ id, name, x: p.x, y: p.y, box: nameShown ? box : undefined });
  }

  // The Moon, with its real phase. Screen directions of celestial north and
  // east are measured at the Moon's own position (the chart is conformal but
  // rotates and flips handedness), then the bright limb's position angle
  // (north through east) is laid onto them.
  const { moon, phase } = f.bodies;
  const mp = project(c, moon.raDeg, moon.decDeg);
  if (onCanvas(mp, 20)) {
    const unit = (q: { x: number; y: number }) => {
      const dx = q.x - mp.x;
      const dy = q.y - mp.y;
      const n = Math.hypot(dx, dy) || 1;
      return { x: dx / n, y: dy / n };
    };
    const north = unit(project(c, moon.raDeg, moon.decDeg + 0.5));
    const east = unit(project(c, moon.raDeg + 0.5 / Math.cos(moon.decDeg * D2R), moon.decDeg));
    const chi = phase.brightLimbDeg * D2R;
    const angle = Math.atan2(
      Math.cos(chi) * north.y + Math.sin(chi) * east.y,
      Math.cos(chi) * north.x + Math.sin(chi) * east.x,
    );
    const r = 5;
    const k = phase.litFraction;
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${INK},0.14)`;
    ctx.fill();
    ctx.save();
    ctx.translate(mp.x, mp.y);
    ctx.rotate(angle); // +x now points at the bright limb
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); // the lit half's rim
    // Terminator: half an ellipse back to the top, bulging into the dark
    // side when gibbous (k > 0.5), into the lit side when crescent.
    ctx.ellipse(0, 0, r * Math.abs(2 * k - 1), r, 0, Math.PI / 2, (3 * Math.PI) / 2, k < 0.5);
    ctx.closePath();
    ctx.fillStyle = `rgba(${INK},0.95)`;
    ctx.fill();
    ctx.restore();
    // Skipped when the Moon is the current hover/selection (C1): its name
    // is about to be drawn again, larger, by the hover label.
    const moonBox = nameBox(ctx, "Moon", mp.x + 8, mp.y + 3, 10);
    const moonNameShown = nameClearsPhoneChrome(view, moonBox);
    if (moonNameShown && "moon" !== suppressName) {
      ctx.fillStyle = `rgba(${INK},0.7)`;
      ctx.fillText("Moon", mp.x + 8, mp.y + 3);
      if (f.underlineNames) {
        ctx.beginPath();
        addUnderline(ctx, moonBox, mp.y + 3);
        strokeUnderlines(ctx, UNDERLINE_INK);
      }
    }
    if (onCanvas(mp, 0)) hits.push({ id: "moon", name: "Moon", x: mp.x, y: mp.y, box: moonNameShown ? moonBox : undefined });
  }

  // The ISS.
  if (f.iss) {
    const issHit = drawIss(ctx, view, f.iss);
    if (issHit) hits.push(issHit);
  }

  // The one-shot entry rings (discoverability spec §4), under the hover and
  // selection layer so a real hover ring always reads on top.
  let entryRings = 0;
  if (f.entryRings && f.entryRings.alpha > 0) {
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(${INK},${(0.85 * f.entryRings.alpha).toFixed(3)})`;
    for (const id of f.entryRings.ids) {
      const h = hits.find((x) => x.id === id);
      if (!h) continue;
      ctx.beginPath();
      ctx.arc(h.x, h.y, Math.max(9, (h.core ?? 0) + 4), 0, Math.PI * 2);
      ctx.stroke();
      entryRings++;
    }
    ctx.lineWidth = 1;
  }

  // Hover and selection, on top of everything.
  const ring = (id: string | null) => {
    const h = id ? hits.find((x) => x.id === id) : undefined;
    if (!h) return;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 9, 0, Math.PI * 2);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(${INK},0.85)`;
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  const brighten = (abbr: string | null) => {
    const segs = abbr ? segments.get(abbr) : undefined;
    if (!segs) return;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(${INK},0.85)`;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = `rgba(${INK},0.95)`;
    for (const [x1, y1, x2, y2] of segs) {
      for (const [vx, vy] of [[x1, y1], [x2, y2]]) {
        ctx.beginPath();
        ctx.arc(vx, vy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  if (f.selectedId && f.selectedId !== f.highlight?.id) {
    if (sky.constellations[f.selectedId]) brighten(f.selectedId);
    else ring(f.selectedId);
  }

  const hot = f.highlight;
  let label: LabelBox | null = null;
  let labelText: LabelText | null = null;
  if (hot?.kind === "constellation" && segments.has(hot.id) && sky.constellations[hot.id]) {
    const con = sky.constellations[hot.id];
    brighten(hot.id);
    let anchor = project(c, con.labels[0][0], con.labels[0][1]);
    for (const [ra, dec] of con.labels.slice(1)) {
      const q = project(c, ra, dec);
      if (Math.hypot(q.x - hot.pointer.x, q.y - hot.pointer.y) < Math.hypot(anchor.x - hot.pointer.x, anchor.y - hot.pointer.y)) {
        anchor = q;
      }
    }
    labelText = { title: con.latin, english: con.english, sub: f.oneLiner(hot.id) };
    label = drawLabel(ctx, f, labelText, anchor, "center", hot.pointer);
  } else if (hot?.kind === "hit") {
    const h = hits.find((x) => x.id === hot.id);
    if (h) {
      ring(h.id);
      labelText = { title: h.name, english: null, sub: f.oneLiner(h.id) };
      label = drawLabel(ctx, f, labelText, h, "beside", hot.pointer);
    }
  }
  ctx.font = `10px ${f.fontFamily}`;

  return { segments, hits, milkyWay: milkyWayAnchor, label, labelText, suppressName, entryRings };
}

const ASCENT = 9;
const DESCENT = 4;
const LINE_GAP = 13; // baseline-to-baseline drop to each following line

/**
 * A hover label: the title in ink at 12px, the English meaning in mut at
 * 10px (inline in parentheses, or stacked on its own line when the margin is
 * narrow), and the one-liner in mut at 10px on its own line(s) below,
 * word-wrapped to whatever width the label is allowed. "center" places it on
 * the anchor (a constellation's catalog label point); "beside" places it just
 * right of a symbol.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  f: FrameInput,
  text: LabelText,
  anchor: Point,
  align: "center" | "beside",
  pointer: Point,
): LabelBox {
  const { width, height } = f;
  const englishParen = text.english ? `(${text.english})` : "";
  ctx.font = `12px ${f.fontFamily}`;
  const titleW = ctx.measureText(text.title).width;
  ctx.font = `10px ${f.fontFamily}`;
  const inlineEnglishW = englishParen ? ctx.measureText(` ${englishParen}`).width : 0;
  const parenW = englishParen ? ctx.measureText(englishParen).width : 0;

  /** Greedy word wrap at 10px; a single word wider than maxW gets its own line. */
  const wrap = (s: string, maxW: number): string[] => {
    const out: string[] = [];
    let line = "";
    for (const word of s.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
    return out;
  };
  type Layout = { stacked: boolean; sub: string[]; w: number; rows: number };
  const layout = (stacked: boolean, maxW: number): Layout => {
    const sub = text.sub ? wrap(text.sub, maxW) : [];
    const headW = stacked && englishParen ? Math.max(titleW, parenW) : titleW + inlineEnglishW;
    const w = Math.max(headW, ...sub.map((l) => ctx.measureText(l).width));
    return { stacked, sub, w, rows: 1 + (stacked && englishParen ? 1 : 0) + sub.length };
  };
  const heightFor = (rows: number) => ASCENT + (rows - 1) * LINE_GAP + DESCENT;
  const boxAt = (x: number, baselineY: number, w: number, rows: number): LabelBox => ({
    x,
    y: baselineY - ASCENT,
    w,
    h: heightFor(rows),
  });

  // Default: inline English, at the anchor, wrapped only to the viewport.
  let lay = layout(false, width - 16);
  let boxX =
    align === "center" ? clamp(anchor.x - lay.w / 2, 8, width - 8 - lay.w) : clamp(anchor.x + 10, 8, width - 8 - lay.w);
  let baselineY = clamp(anchor.y + (align === "beside" ? 4 : 0), 18, height - 8 - (lay.rows - 1) * LINE_GAP);
  let box = boxAt(boxX, baselineY, lay.w, lay.rows);

  const avoid = f.avoid;
  const AVOID_PAD = 4;
  const overlapsAvoid = (b: LabelBox) =>
    !!avoid &&
    b.x < avoid.right + AVOID_PAD &&
    b.x + b.w > avoid.left - AVOID_PAD &&
    b.y < avoid.bottom + AVOID_PAD &&
    b.y + b.h > avoid.top - AVOID_PAD;

  // When the anchor's box would land on the sheet (a far-north
  // constellation's catalog anchor, or a symbol near the sheet's edge), the
  // label follows the pointer into whichever desk margin it is actually in,
  // wrapping the one-liner to the margin's width, so the name is never
  // silently hidden behind the page.
  if (avoid && overlapsAvoid(box)) {
    const { x: px, y: py } = pointer;
    let avail: number;
    let xFor: (w: number) => number;
    if (px < avoid.left) {
      avail = avoid.left - 6 - 8;
      xFor = (w) => clamp(avoid.left - 6 - w, 8, avoid.left - 6);
    } else if (px > avoid.right) {
      avail = width - 8 - (avoid.right + 6);
      xFor = (w) => clamp(avoid.right + 6, avoid.right + 6, width - 8 - w);
    } else {
      // Above the sheet (the common case) or, on a page shorter than the
      // viewport, below it: bounded only vertically, so the label follows
      // the pointer's x across the full width.
      avail = width - 16;
      xFor = (w) => clamp(px - w / 2, 8, width - 8 - w);
    }

    const inline = layout(false, avail);
    const stacked = layout(true, avail);
    if (inline.w <= avail) lay = inline;
    else if (englishParen && stacked.w <= avail) lay = stacked;
    // Best effort: nothing fits the margin (a word or the title is wider
    // than it). Use the narrower layout, as close to the pointer as the
    // viewport allows, even if it grazes the sheet.
    else lay = englishParen && stacked.w < inline.w ? stacked : inline;
    boxX = xFor(lay.w);

    const h = heightFor(lay.rows);
    if (px < avoid.left || px > avoid.right) {
      baselineY = clamp(py - 14, 18, height - 8 - (lay.rows - 1) * LINE_GAP);
    } else if (py < avoid.top) {
      baselineY = clamp(py - 14, 18, Math.min(height - 8, avoid.top - 4 - (h - ASCENT)));
    } else {
      baselineY = clamp(py + 14, Math.max(18, avoid.bottom + 4 + ASCENT), height - 8 - (lay.rows - 1) * LINE_GAP);
    }
    box = boxAt(boxX, baselineY, lay.w, lay.rows);
  }

  // A desk-coloured backing behind the label (fix round 1, C1): the symbol's
  // own always-on name is suppressed above, but a neighbouring label (e.g.
  // "Mars" a few px away) is not, and used to bleed straight through.
  const BACKING_PAD = 3;
  ctx.fillStyle = `rgba(${DESK_RGB},0.85)`;
  ctx.fillRect(box.x - BACKING_PAD, box.y - BACKING_PAD, box.w + 2 * BACKING_PAD, box.h + 2 * BACKING_PAD);

  ctx.font = `12px ${f.fontFamily}`;
  ctx.fillStyle = `rgba(${INK},0.95)`;
  ctx.fillText(text.title, boxX, baselineY);
  let nextBaseline = baselineY + LINE_GAP;
  ctx.font = `10px ${f.fontFamily}`;
  ctx.fillStyle = `rgba(${MUT},0.85)`;
  if (englishParen) {
    if (lay.stacked) {
      ctx.fillText(englishParen, boxX, nextBaseline);
      nextBaseline += LINE_GAP;
    } else {
      ctx.fillText(` ${englishParen}`, boxX + titleW, baselineY);
    }
  }
  for (const line of lay.sub) {
    ctx.fillText(line, boxX, nextBaseline);
    nextBaseline += LINE_GAP;
  }
  return box;
}

/** Distance from (x, y) to a segment, CSS px. */
function segmentDistance(x: number, y: number, [x1, y1, x2, y2]: Segment): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/**
 * The part of a segment inside the rectangle [0, w] x [0, h] (Liang-Barsky),
 * or null when none of it is.
 */
export function clipSegment([x1, y1, x2, y2]: Segment, w: number, h: number): Segment | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  for (const [pk, qk] of [
    [-dx, x1],
    [dx, w - x1],
    [-dy, y1],
    [dy, h - y1],
  ]) {
    if (pk === 0) {
      if (qk < 0) return null;
      continue;
    }
    const r = qk / pk;
    if (pk < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

/**
 * Where a constellation sits on screen: the mean midpoint of the parts of its
 * segments inside the viewport, or null when no segment crosses it at all.
 * A constellation whose lines cross the screen with every star off it still
 * counts as in view.
 */
export function constellationAt(p: Projected, abbr: string, w: number, h: number): { x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const seg of p.segments.get(abbr) ?? []) {
    const c = clipSegment(seg, w, h);
    if (!c) continue;
    sx += (c[0] + c[2]) / 2;
    sy += (c[1] + c[3]) / 2;
    n++;
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** The constellation whose nearest line segment is within maxPx, or null. */
export function nearestConstellation(p: Projected, x: number, y: number, maxPx: number): string | null {
  let best: string | null = null;
  let bestD = maxPx;
  for (const [abbr, segs] of p.segments) {
    for (const s of segs) {
      const d = segmentDistance(x, y, s);
      if (d <= bestD) {
        bestD = d;
        best = abbr;
      }
    }
  }
  return best;
}

/** Symbols win within this for a mouse or pen (spec §5). */
export const HIT_PX_POINTER = 12;
/** A fingertip covers far more than a cursor tip does (final review F1). */
export const HIT_PX_TOUCH = 22;
/** The symbol radius for a PointerEvent's `pointerType`. */
export function hitRadiusFor(pointerType: string): number {
  return pointerType === "touch" ? HIT_PX_TOUCH : HIT_PX_POINTER;
}

/** A point this close to a drawn symbol is ON it: that symbol beats any name box over it. */
export const SYMBOL_CORE_PX = 6;

/**
 * The drawn selectable under (x, y), in three passes: a symbol the point is
 * actually on (within its own core radius, SYMBOL_CORE_PX by default; a
 * larger glyph — the enlarged galaxies/nebulae/clusters, "clutter" follow-up
 * 2026-09-15 — carries a bigger `core` from lib/sky-layers.ts, never past
 * maxPx); then any name box containing the point (topmost, i.e. last drawn,
 * wins); then the nearest symbol within maxPx. The first pass exists because
 * names are ~80px long: without it, a planet or star drawn under a
 * neighbour's name (Mars under "Beehive Cluster", measured) could never be
 * clicked. Box-only hits (the Milky Way's label) never match by radius.
 */
export function nearestHit(p: Projected, x: number, y: number, maxPx: number): Hit | null {
  const onSymbol = nearestSymbolCore(p, x, y, maxPx);
  if (onSymbol) return onSymbol;
  for (let i = p.hits.length - 1; i >= 0; i--) {
    const b = p.hits[i].box;
    if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return p.hits[i];
  }
  return nearestSymbol(p, x, y, maxPx);
}

/** The "on symbol" pass: each hit's own core radius, capped at maxPx so a
 *  bigger glyph can never claim more than the caller's own hit radius. */
function nearestSymbolCore(p: Projected, x: number, y: number, maxPx: number): Hit | null {
  let best: Hit | null = null;
  let bestD = Infinity;
  for (const h of p.hits) {
    if (h.boxOnly) continue;
    const r = Math.min(h.core ?? SYMBOL_CORE_PX, maxPx);
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= r && d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function nearestSymbol(p: Projected, x: number, y: number, maxPx: number): Hit | null {
  let best: Hit | null = null;
  let bestD = maxPx;
  for (const h of p.hits) {
    if (h.boxOnly) continue;
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}
