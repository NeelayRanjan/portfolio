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
export type Projected = { segments: Map<string, Segment[]> };
export type FrameInput = {
  width: number;
  height: number;
  chart: Chart;
  magLimit: number;
  bodies: Bodies;
  fontFamily: string;
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
  for (const [ra, dec, mag, bv] of sky.stars) {
    if (mag > f.magLimit) break;
    const p = project(c, ra, dec);
    if (!onCanvas(p, 4)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, clamp(2.1 - 0.32 * mag, 0.5, 2.6), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${starRgb(bv)},${clamp(1 - (mag + 1.5) * 0.12, 0.25, 1)})`;
    ctx.fill();
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

  return { segments };
}
