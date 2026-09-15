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
import type { PreparedMilkyWay, SkyObject, SkyShower } from "./sky-objects";
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
 */
export type Hit = { id: string; name: string; x: number; y: number; box?: Box; boxOnly?: boolean };

const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
const D2R = Math.PI / 180;
/** Each level adds this much ink; five nested levels build the band's core. Tuned by eye (Task 4 Step 9). */
export const MILKY_WAY_ALPHA = 0.022;

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
  ctx.fillStyle = `rgba(${INK},${MILKY_WAY_ALPHA})`;
  for (const rings of mw.levels) {
    ctx.beginPath();
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const rho = c.k * ring[i + 1];
        const phi = ring[i] - lst;
        const x = c.cx + rho * Math.sin(phi);
        const y = c.cy - rho * Math.cos(phi);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    // Rings nest (the band's two edges, dark lanes, bright clouds): even-odd
    // fills exactly the area between them.
    ctx.fill("evenodd");
  }
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
 * Deep-sky symbols, landmarks, Voyagers and the named stars' names. `rings`
 * holds precomputed small-circle outlines by object id (the Kepler field).
 * `names` false (below 880px) draws symbols only.
 */
export function drawObjects(
  ctx: CanvasRenderingContext2D,
  v: View,
  objects: SkyObject[],
  rings: ReadonlyMap<string, [number, number][]>,
): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const o of objects) {
    const p = project(c, o.raDeg, o.decDeg);
    if (!onCanvas(p, v, 0)) continue;
    const hit: Hit = { id: o.id, name: o.name, x: p.x, y: p.y };
    hits.push(hit);
    const human = o.symbol === "chevron";
    switch (o.symbol) {
      case "galaxy": {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 5 * (o.axisRatio ?? 1), -35 * D2R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        break;
      }
      case "nebula": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.setLineDash([1.5, 2]);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "cluster": {
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
      const dx = o.symbol === "field" ? 0 : 8;
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
