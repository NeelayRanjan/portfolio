/**
 * Figure 3's map: the lower 48 in the owner's Albers projection, and every
 * layer the rerouter figure draws on it. Pure: no React, no fetch, no clock.
 * RerouteFigure owns the state and calls drawMap after any change; nothing
 * here animates by itself.
 *
 * Coordinates: MapView maps Albers metres to CSS pixels (north up), and
 * drawMap scales the context by `dpr` once, so every size below is in CSS px.
 * Latitude/longitude pairs are [lat, lon] everywhere except the outline file,
 * which is [lon, lat] (us-outline.json's own order).
 */
import { albers, inverseAlbers } from "../../lib/slaac/albers.ts";
import type { Fix, Role } from "../../lib/slaac/reroute.ts";

export type LL = [lat: number, lon: number];
export type MapView = { w: number; h: number; dpr: number; scale: number; ox: number; oy: number };

export type MapSite = { id: string; name: string; rings: LL[][] };
export type MapRoute = { id: string; fixes: Fix[] };
export type MapResult = {
  id: string;
  plan: Fix[];
  roles: Role[];
  dense: LL[];
  status: "ok" | "untouched" | "cannot-clear";
};
export type MapState = {
  /** [lon, lat] with null breaking the line between separate shapes. */
  outline: ([number, number] | null)[];
  /** The selected pair's two airports, labelled by ICAO code. */
  endpoints: { code: string; lat: number; lon: number }[];
  /** The filed routes (the flight-plan LM's), drawn thin in ink. */
  routes: MapRoute[];
  /** Launch sites in play; empty while the preset is off. */
  sites: MapSite[];
  /** Closed rings the visitor drew. */
  drawn: LL[][];
  /** The ring being drawn, open. */
  pending: LL[];
  /** The running chunk's x0 estimates, one per arc. */
  arcs: { flight: string; index: number; xyLL: LL[] }[];
  results: MapResult[] | null;
  display: "snapped" | "continuous";
  /** A flight id to draw on top, brighter (the table row under the pointer). */
  hover: string | null;
};
/** "r, g, b" triples, so each layer can pick its own alpha. */
export type MapColours = { rule: string; ink: string; mut: string; red: string; ok: string; panel: string };

const PAD = 8;
const BBOX = { latMin: 24, latMax: 50, lonMin: -125, lonMax: -66 };

/** Fit the Albers image of lat 24-50, lon -125..-66 into w x h with 8px padding.
 *  The projected box's edges are curves, so each edge is sampled, not just the corners. */
export function fitLower48(w: number, h: number, dpr: number): MapView {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const take = (lat: number, lon: number) => {
    const [x, y] = albers(lat, lon);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (let i = 0; i <= 32; i++) {
    const lon = BBOX.lonMin + ((BBOX.lonMax - BBOX.lonMin) * i) / 32;
    const lat = BBOX.latMin + ((BBOX.latMax - BBOX.latMin) * i) / 32;
    take(BBOX.latMin, lon); take(BBOX.latMax, lon);
    take(lat, BBOX.lonMin); take(lat, BBOX.lonMax);
  }
  const bw = maxX - minX, bh = maxY - minY;
  const scale = Math.max(1e-9, Math.min((w - 2 * PAD) / bw, (h - 2 * PAD) / bh));
  const ox = (w - scale * bw) / 2 - scale * minX;
  const oy = (h - scale * bh) / 2 + scale * maxY;
  return { w, h, dpr, scale, ox, oy };
}

export function toScreen(v: MapView, lat: number, lon: number): [number, number] {
  const [x, y] = albers(lat, lon);
  return [v.ox + v.scale * x, v.oy - v.scale * y];
}

/** CSS px -> [lat, lon]. */
export function fromScreen(v: MapView, x: number, y: number): [number, number] {
  return inverseAlbers((x - v.ox) / v.scale, (v.oy - y) / v.scale);
}

type XY = [number, number];
type Box = { x: number; y: number; w: number; h: number };

function insideXY(p: XY, poly: XY[]): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi) ins = !ins;
  }
  return ins;
}

function edgeDist(p: XY, poly: XY[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby + 1e-12)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * abx, p[1] - a[1] - t * aby));
  }
  return best;
}

/**
 * A screen point inside a site's largest ring, for the verify suite to sample
 * (ruling R4). The area centroid when it falls inside; a concave ring (the
 * Cape's merged outline is one) can put that outside, so then the inside
 * grid point farthest from any edge.
 */
export function siteAnchor(v: MapView, site: MapSite): [number, number] | null {
  let best: XY[] | null = null, bestA = 0;
  for (const r of site.rings) {
    const pts = r.map(([la, lo]) => toScreen(v, la, lo));
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    if (Math.abs(a) >= bestA) { bestA = Math.abs(a); best = pts; }
  }
  if (!best || best.length < 3) return null;
  const pts = best;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const c = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += c; cx += (pts[j][0] + pts[i][0]) * c; cy += (pts[j][1] + pts[i][1]) * c;
  }
  if (Math.abs(a) > 1e-9) {
    const c: XY = [cx / (3 * a), cy / (3 * a)];
    if (insideXY(c, pts)) return [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10];
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let pick: XY | null = null, pickD = -1;
  for (let i = 1; i < 24; i++) for (let k = 1; k < 24; k++) {
    const p: XY = [x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * k) / 24];
    if (!insideXY(p, pts)) continue;
    const d = edgeDist(p, pts);
    if (d > pickD) { pickD = d; pick = p; }
  }
  return pick ? [Math.round(pick[0] * 10) / 10, Math.round(pick[1] * 10) / 10] : null;
}

const rgba = (c: string, a: number) => `rgba(${c}, ${a})`;

function pathLL(ctx: CanvasRenderingContext2D, v: MapView, pts: LL[], close = false) {
  pts.forEach(([la, lo], i) => {
    const [x, y] = toScreen(v, la, lo);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (close) ctx.closePath();
}

const fixLL = (f: Fix): LL => [f[1], f[2]];

function drawPlan(ctx: CanvasRenderingContext2D, v: MapView, r: MapResult, c: MapColours, display: MapState["display"], width: number) {
  if (display === "continuous") {
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = rgba(c.ok, 1);
    ctx.lineWidth = width;
    ctx.beginPath();
    pathLL(ctx, v, r.dense);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.strokeStyle = rgba(c.ok, 1);
  ctx.lineWidth = width;
  ctx.beginPath();
  pathLL(ctx, v, r.plan.map(fixLL));
  ctx.stroke();
  // Deviation fixes: filled dots on a named fix, hollow on a raw BEND.
  r.plan.forEach((f, i) => {
    if (r.roles[i] !== "deviation") return;
    const [x, y] = toScreen(v, f[1], f[2]);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    if (f[0] === "BEND") {
      ctx.fillStyle = rgba(c.panel, 1); // the panel, so the hollow reads hollow over a route
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.lineWidth = width;
    } else {
      ctx.fillStyle = rgba(c.ok, 1);
      ctx.fill();
    }
  });
}

/** Returns which launch sites got their name drawn (the rest were dropped
 *  for room), so the figure can report it to the verify suite. */
export function drawMap(ctx: CanvasRenderingContext2D, v: MapView, s: MapState, colours: MapColours, font: string): { labelled: string[] } {
  const c = colours;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.clearRect(0, 0, v.w, v.h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 1. The outline.
  ctx.strokeStyle = rgba(c.rule, 1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  let pen = false;
  for (const p of s.outline) {
    if (p === null) { pen = false; continue; }
    const [x, y] = toScreen(v, p[1], p[0]);
    if (pen) ctx.lineTo(x, y);
    else { ctx.moveTo(x, y); pen = true; }
  }
  ctx.stroke();

  // 2. Launch airspace, then 3. the visitor's own: one style for both.
  const fillRing = (ring: LL[]) => {
    ctx.beginPath();
    pathLL(ctx, v, ring, true);
    ctx.fillStyle = rgba(c.red, 0.18);
    ctx.fill();
    ctx.strokeStyle = rgba(c.red, 1);
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  for (const site of s.sites) for (const r of site.rings) fillRing(r);
  for (const r of s.drawn) fillRing(r);

  // The ring in progress: dashed, its vertices dotted, the first one ringed
  // as the close target once there are enough points to close.
  if (s.pending.length) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = rgba(c.red, 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    pathLL(ctx, v, s.pending);
    ctx.stroke();
    ctx.restore();
    s.pending.forEach(([la, lo], i) => {
      const [x, y] = toScreen(v, la, lo);
      ctx.fillStyle = rgba(c.red, 1);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 0 && s.pending.length >= 3) {
        ctx.strokeStyle = rgba(c.red, 1);
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  // 4. Filed routes.
  ctx.strokeStyle = rgba(c.ink, 0.45);
  ctx.lineWidth = 1;
  for (const r of s.routes) {
    ctx.beginPath();
    pathLL(ctx, v, r.fixes.map(fixLL));
    ctx.stroke();
  }

  // The pair's airports.
  for (const e of s.endpoints) {
    const [x, y] = toScreen(v, e.lat, e.lon);
    ctx.fillStyle = rgba(c.ink, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. The denoising, live: each arc's current x0 estimate.
  if (s.arcs.length) {
    ctx.strokeStyle = rgba(c.ok, 0.5);
    ctx.lineWidth = 1.5;
    for (const a of s.arcs) {
      ctx.beginPath();
      pathLL(ctx, v, a.xyLL);
      ctx.stroke();
    }
  }

  // 6. Finished plans. A flight nothing touched keeps its filed line alone.
  if (s.results) {
    for (const r of s.results) if (r.status !== "untouched") drawPlan(ctx, v, r, c, s.display, 2);
  }

  // 7. Hover: one flight, on top.
  if (s.hover) {
    const route = s.routes.find((r) => r.id === s.hover);
    const res = s.results?.find((r) => r.id === s.hover);
    if (route) {
      ctx.strokeStyle = rgba(c.ink, 0.95);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      pathLL(ctx, v, route.fixes.map(fixLL));
      ctx.stroke();
    }
    if (res && res.status !== "untouched") drawPlan(ctx, v, res, c, s.display, 3);
  }

  // 8. Labels last, on a panel-toned backing so routes passing under them
  // don't strike through the text. The pair's airports first, then each
  // site's name to the right of its airspace, else to the left; a name that
  // fits neither side without leaving the map or touching a label already
  // placed is dropped rather than squeezed (a narrow phone map can't hold
  // all six; the airspace itself still draws).
  ctx.font = font;
  ctx.textBaseline = "middle";
  const placed: Box[] = [];
  const put = (text: string, x: number, y: number, colour: string) => {
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = rgba(c.panel, 0.8);
    ctx.fillRect(x - 2, y - 6, tw + 4, 12);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    placed.push({ x: x - 2, y: y - 6, w: tw + 4, h: 12 });
  };
  const fits = (x: number, y: number, tw: number) =>
    x >= 2 && x + tw <= v.w - 2 && y >= 7 && y <= v.h - 7 &&
    !placed.some((p) => x - 2 < p.x + p.w && x + tw + 2 > p.x && y - 6 < p.y + p.h && y + 6 > p.y);

  for (const e of s.endpoints) {
    const [x, y] = toScreen(v, e.lat, e.lon);
    const tw = ctx.measureText(e.code).width;
    put(e.code, x + 5 + tw <= v.w - 2 ? x + 5 : x - 5 - tw, y, rgba(c.mut, 1));
  }
  const labelled: string[] = [];
  for (const site of s.sites) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const r of site.rings) for (const [la, lo] of r) {
      const [x, y] = toScreen(v, la, lo);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const tw = ctx.measureText(site.name).width;
    const y = (y0 + y1) / 2;
    const x = [x1 + 5, x0 - 5 - tw].find((cx) => fits(cx, y, tw));
    if (x === undefined) continue;
    put(site.name, x, y, rgba(c.red, 1));
    labelled.push(site.id);
  }
  return { labelled };
}
