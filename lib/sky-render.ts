/**
 * Draws one frame of the night sky. No state, no clock, no DOM beyond the
 * context it is handed: NightSky owns time, sizing and input.
 *
 * Layers, back to front (spec §2): desk fill, graticule, ecliptic,
 * constellation lines, stars, planets, the Moon. Colors are the site tokens
 * (desk #0c0b09, ink #eae5da, mut #9a948a, warm #d9a45b) at low alpha; no
 * red, which stays reviewer's ink.
 *
 * Planet names and "Moon" are rendered straight from the PLANETS enum and a
 * literal, the way copy.ts's header allows enum values; they are proper
 * nouns, not prose.
 */
import type { SkyData } from "./sky-data";
import { eclipticToEquatorial, project, type Chart, type Equatorial, type Planet } from "./sky-math";

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
export type Projected = { segments: Map<string, Segment[]>; label: LabelBox | null };
export type Highlight = { abbr: string; pointer: { x: number; y: number } };
export type FrameInput = {
  width: number;
  height: number;
  chart: Chart;
  magLimit: number;
  bodies: Bodies;
  fontFamily: string;
  highlight: Highlight | null;
  avoid: Avoid | null;
  /** One rgba fill style per `sky.stars` entry, same order, from
   *  `precomputeStarFills`. A star's colour and brightness never change
   *  frame to frame (both come only from its catalog mag/bv), so building
   *  these 1,627 template strings is wasted work at ~20 fps; compute once
   *  per catalog load instead. */
  starFills: string[];
};

const DESK = "#0c0b09";
const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
const D2R = Math.PI / 180;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Faint B-V tint: blue-white through the ink tone to amber. Never saturated. */
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
 * One rgba fill style per `sky.stars` entry, same order. A star's mag/bv
 * never change after the catalog loads, so its fill string doesn't either:
 * call this once when `loadSky()` resolves (NightSky does) and hand the
 * result back into every `drawSky` call as `starFills`, rather than building
 * ~1,627 template strings inside the ~20 fps paint loop.
 */
export function precomputeStarFills(stars: SkyData["stars"]): string[] {
  return stars.map(([, , mag, bv]) => `rgba(${starRgb(bv)},${clamp(1 - (mag + 1.5) * 0.12, 0.25, 1)})`);
}

export function drawSky(ctx: CanvasRenderingContext2D, sky: SkyData, f: FrameInput): Projected {
  const { width, height, chart: c } = f;
  const onCanvas = (p: { x: number; y: number }, m: number) =>
    p.x > -m && p.x < width + m && p.y > -m && p.y < height + m;
  const radiusAt = (dec: number) => c.k * Math.tan(((90 - dec) / 2) * D2R);

  ctx.fillStyle = DESK;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;
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
  // hit-testing (Task 5) and the verify snapshot.
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

  // Stars, brightest first, so the magnitude cut is a break.
  for (let i = 0; i < sky.stars.length; i++) {
    const [ra, dec, mag] = sky.stars[i];
    if (mag > f.magLimit) break;
    const p = project(c, ra, dec);
    if (!onCanvas(p, 4)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, clamp(2.1 - 0.32 * mag, 0.5, 2.6), 0, Math.PI * 2);
    ctx.fillStyle = f.starFills[i];
    ctx.fill();
  }

  // Hover: the constellation's lines and vertex stars brighten to ink, and
  // its name appears near the pointer. Latin in ink at 12px, then the
  // English meaning, smaller and in mut.
  const hot = f.highlight;
  const hotSegs = hot ? segments.get(hot.abbr) : undefined;
  const con = hot ? sky.constellations[hot.abbr] : undefined;
  let label: LabelBox | null = null;
  if (hot && hotSegs && con) {
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of hotSegs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(${INK},0.85)`;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = `rgba(${INK},0.95)`;
    for (const [x1, y1, x2, y2] of hotSegs) {
      for (const [vx, vy] of [[x1, y1], [x2, y2]]) {
        ctx.beginPath();
        ctx.arc(vx, vy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let anchor = project(c, con.labels[0][0], con.labels[0][1]);
    for (const [ra, dec] of con.labels.slice(1)) {
      const q = project(c, ra, dec);
      if (Math.hypot(q.x - hot.pointer.x, q.y - hot.pointer.y) < Math.hypot(anchor.x - hot.pointer.x, anchor.y - hot.pointer.y)) {
        anchor = q;
      }
    }

    const englishParen = con.english ? `(${con.english})` : "";
    ctx.font = `12px ${f.fontFamily}`;
    const latinW = ctx.measureText(con.latin).width;
    ctx.font = `10px ${f.fontFamily}`;
    const inlineEnglishW = englishParen ? ctx.measureText(` ${englishParen}`).width : 0;
    const parenW = englishParen ? ctx.measureText(englishParen).width : 0;
    const oneLineW = latinW + inlineEnglishW;

    const ASCENT = 9;
    const DESCENT = 4;
    const LINE_GAP = 13; // baseline-to-baseline drop to the stacked English line
    const boxH = (lines: 1 | 2) => (lines === 1 ? ASCENT + DESCENT : ASCENT + LINE_GAP + DESCENT);
    const boxAt = (x: number, baselineY: number, w: number, lines: 1 | 2): LabelBox => ({
      x,
      y: baselineY - ASCENT,
      w,
      h: boxH(lines),
    });

    // Default: one line at the catalog label anchor, as spec §4 describes.
    let boxX = clamp(anchor.x - oneLineW / 2, 8, width - 8 - oneLineW);
    let baselineY = clamp(anchor.y, 18, height - 8);
    let lines: 1 | 2 = 1;
    let boxW = oneLineW;
    let box = boxAt(boxX, baselineY, boxW, lines);

    const avoid = f.avoid;
    const AVOID_PAD = 4;
    const overlapsAvoid = (b: LabelBox) =>
      !!avoid &&
      b.x < avoid.right + AVOID_PAD &&
      b.x + b.w > avoid.left - AVOID_PAD &&
      b.y < avoid.bottom + AVOID_PAD &&
      b.y + b.h > avoid.top - AVOID_PAD;

    // Deliberate deviation from spec §4 ("one line at the label anchor"):
    // the catalog label anchor sits near the equatorial pole for the
    // far-north constellations (UMa, UMi, Cas, Cep, Dra, Cam), and that
    // pole projects close to the canvas centre, which is exactly where the
    // sheet sits at typical viewport sizes. Drawing at the anchor
    // unconditionally would silently hide the name behind the page for the
    // constellations most likely to be hovered, so when the anchor's box
    // would land on the sheet, the label follows the pointer into whichever
    // desk margin it's actually in instead.
    if (avoid && overlapsAvoid(box)) {
      const { x: px, y: py } = hot.pointer;
      let avail: number;
      let xFor: (w: number) => number;
      if (px < avoid.left) {
        avail = avoid.left - 6 - 8;
        xFor = (w) => clamp(avoid.left - 6 - w, 8, avoid.left - 6);
      } else if (px > avoid.right) {
        avail = width - 8 - (avoid.right + 6);
        xFor = (w) => clamp(avoid.right + 6, avoid.right + 6, width - 8 - w);
      } else {
        // Above the sheet (the common case: pointer.y < avoid.top) or, on a
        // page shorter than the viewport, below it — neither is bounded by
        // the sheet horizontally, only vertically, so the full width is
        // available and the label follows the pointer's x.
        avail = width - 16;
        xFor = (w) => clamp(px - w / 2, 8, width - 8 - w);
      }

      const twoLineW = englishParen ? Math.max(latinW, parenW) : oneLineW;
      if (oneLineW <= avail) {
        lines = 1;
        boxW = oneLineW;
      } else if (englishParen && twoLineW <= avail) {
        lines = 2;
        boxW = twoLineW;
      } else {
        // Best effort (spec §4 tail): nothing fits the margin. Use whichever
        // layout is narrower and place it as close to the pointer as the
        // viewport allows, even if it grazes the sheet.
        lines = englishParen && twoLineW < oneLineW ? 2 : 1;
        boxW = lines === 2 ? twoLineW : oneLineW;
      }
      boxX = xFor(boxW);

      const h = boxH(lines);
      if (px < avoid.left || px > avoid.right) {
        // Left/right margins: the box's x-range already clears the sheet,
        // so any y is safe — just keep the label near the pointer.
        baselineY = clamp(py - 14, 18, height - 8);
      } else if (py < avoid.top) {
        baselineY = clamp(py - 14, 18, Math.min(height - 8, avoid.top - 4 - (h - ASCENT)));
      } else {
        // Below the sheet: not one of spec's named margins, but a real
        // hover can land here on a page shorter than the viewport. Mirror
        // "above".
        baselineY = clamp(py + 14, Math.max(18, avoid.bottom + 4 + ASCENT), height - 8);
      }
      box = boxAt(boxX, baselineY, boxW, lines);
    }

    ctx.font = `12px ${f.fontFamily}`;
    ctx.fillStyle = `rgba(${INK},0.95)`;
    ctx.fillText(con.latin, boxX, baselineY);
    if (englishParen) {
      ctx.font = `10px ${f.fontFamily}`;
      ctx.fillStyle = `rgba(${MUT},0.85)`;
      if (lines === 1) ctx.fillText(` ${englishParen}`, boxX + latinW, baselineY);
      else ctx.fillText(englishParen, boxX, baselineY + LINE_GAP);
    }
    ctx.font = `10px ${f.fontFamily}`;
    label = box;
  }

  // Planets.
  for (const { name, eq } of f.bodies.planets) {
    const p = project(c, eq.raDeg, eq.decDeg);
    if (!onCanvas(p, 20)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${WARM},0.95)`;
    ctx.fill();
    ctx.fillStyle = `rgba(${WARM},0.75)`;
    ctx.fillText(name, p.x + 6, p.y + 3);
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
    ctx.fillStyle = `rgba(${INK},0.7)`;
    ctx.fillText("Moon", mp.x + 8, mp.y + 3);
  }

  return { segments, label };
}

/** Distance from (x, y) to a segment, CSS px. */
function segmentDistance(x: number, y: number, [x1, y1, x2, y2]: Segment): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
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
