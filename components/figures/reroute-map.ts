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
import { albers, inverseAlbers, NM } from "../../lib/slaac/albers.ts";
import { loadSua, segPolyDist, type Pt } from "../../lib/slaac/geometry.ts";
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
  /** Plan leg indices that still cross airspace (cannot-clear flights only). */
  crossingLegs?: number[];
};
export type MapState = {
  /** [lon, lat] with null breaking the line between separate shapes. */
  outline: ([number, number] | null)[];
  /** The selected pair's two airports, labelled by ICAO code. */
  endpoints: { code: string; lat: number; lon: number }[];
  /** The filed routes (the flight-plan LM's), drawn thin in ink. */
  routes: MapRoute[];
  /** Their ink alpha: 0.45 for one pair; all flights (373 routes) draw
   *  fainter, as texture. One path for all of them, so where routes overlap
   *  the ink doesn't stack. */
  routeAlpha?: number;
  /** Launch sites in play; empty while the preset is off. */
  sites: MapSite[];
  /** Closed rings the visitor drew. */
  drawn: LL[][];
  /** The ring being drawn, open. */
  pending: LL[];
  /** The running chunk's x0 estimates, one per arc. */
  arcs: { flight: string; index: number; xyLL: LL[] }[];
  results: MapResult[] | null;
  /** False once the settings changed since the run: its plans draw faded. */
  fresh: boolean;
  display: "snapped" | "continuous";
  /** A flight id to draw on top, brighter (the table row under the pointer). */
  hover: string | null;
};
/** "r, g, b" triples, so each layer can pick its own alpha. */
export type MapColours = { rule: string; ink: string; mut: string; red: string; ok: string; panel: string };

const PAD = 8;
const BBOX = { latMin: 24, latMax: 50, lonMin: -125, lonMax: -66 };

/** An axis-aligned box in Albers metres. */
export type Box = { minX: number; maxX: number; minY: number; maxY: number };
export type FitOpts = {
  /** Extra room on each side, as a fraction of the box's own size. */
  padFrac: number;
  /** Then this many CSS px on each side of the canvas. */
  padPx: number;
  /** The view's shorter side never spans less than this, so a short route
   *  isn't zoomed into a few pixels of detail. */
  minExtentM: number;
};
/** The focus view's defaults (task 12b): 8% + 8px, at least 400 nm across. */
export const FOCUS_FIT: FitOpts = { padFrac: 0.08, padPx: 8, minExtentM: 400 * NM };
/** How near a route's legs a launch polygon must come to join the focus box. */
export const FOCUS_LAUNCH_NM = 150;

/**
 * Fit a box into w x h, north up, one scale on both axes (the box is
 * letterboxed into the canvas's aspect), centred.
 */
export function fitBox(w: number, h: number, dpr: number, box: Box, opts: FitOpts): MapView {
  const bw = (box.maxX - box.minX) * (1 + 2 * opts.padFrac);
  const bh = (box.maxY - box.minY) * (1 + 2 * opts.padFrac);
  const aw = Math.max(1, w - 2 * opts.padPx), ah = Math.max(1, h - 2 * opts.padPx);
  let scale = Math.min(bw > 0 ? aw / bw : Infinity, bh > 0 ? ah / bh : Infinity);
  if (opts.minExtentM > 0) scale = Math.min(scale, Math.min(w, h) / opts.minExtentM);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1e-9;
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  return { w, h, dpr, scale, ox: w / 2 - scale * cx, oy: h / 2 + scale * cy };
}

let lower48: Box | null = null;
/** The Albers image of lat 24-50, lon -125..-66. Its edges are curves, so
 *  each edge is sampled, not just the corners. */
function lower48Box(): Box {
  if (lower48) return lower48;
  const b: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let i = 0; i <= 32; i++) {
    const lon = BBOX.lonMin + ((BBOX.lonMax - BBOX.lonMin) * i) / 32;
    const lat = BBOX.latMin + ((BBOX.latMax - BBOX.latMin) * i) / 32;
    for (const [la, lo] of [[BBOX.latMin, lon], [BBOX.latMax, lon], [lat, BBOX.lonMin], [lat, BBOX.lonMax]]) grow(b, albers(la, lo));
  }
  return (lower48 = b);
}

function grow(b: Box, [x, y]: [number, number]) {
  if (x < b.minX) b.minX = x;
  if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y;
  if (y > b.maxY) b.maxY = y;
}

/** The whole-US view: the lower-48 box with 8px padding. */
export function fitLower48(w: number, h: number, dpr: number): MapView {
  return fitBox(w, h, dpr, lower48Box(), { padFrac: 0, padPx: PAD, minExtentM: 0 });
}

/**
 * The focus box: every route point; every launch polygon whose nearest point
 * comes within `launchWithinNm` of a route leg; every drawn ring and open-ring
 * vertex; every outcome point. Null when there is nothing to focus on.
 */
export function focusBox(routes: LL[][], launchPolys: LL[][], rings: LL[][], outcomePoints: LL[],
  opts: { launchWithinNm: number }): Box | null {
  const b: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const legs: [Pt, Pt][] = [];
  for (const r of routes) {
    const xy = r.map(([la, lo]) => albers(la, lo));
    xy.forEach((p, i) => {
      grow(b, p);
      if (i > 0) legs.push([xy[i - 1], p]);
    });
  }
  const lim = opts.launchWithinNm * NM;
  for (const poly of loadSua(launchPolys)) {
    if (legs.some(([p, q]) => segPolyDist(p, q, poly) <= lim)) for (const p of poly) grow(b, p);
  }
  for (const r of rings) for (const [la, lo] of r) grow(b, albers(la, lo));
  for (const [la, lo] of outcomePoints) grow(b, albers(la, lo));
  return Number.isFinite(b.minX) ? b : null;
}

/**
 * Between two views: the centre (in metres) moves linearly and the scale
 * geometrically, so a zoom reads as one smooth move instead of a swoop.
 * t <= 0 and t >= 1 return copies of the ends exactly.
 */
export function lerpView(a: MapView, b: MapView, t: number): MapView {
  if (t <= 0) return { ...a };
  if (t >= 1) return { ...b };
  const ca = [(a.w / 2 - a.ox) / a.scale, (a.oy - a.h / 2) / a.scale];
  const cb = [(b.w / 2 - b.ox) / b.scale, (b.oy - b.h / 2) / b.scale];
  const scale = a.scale * Math.pow(b.scale / a.scale, t);
  const cx = ca[0] + (cb[0] - ca[0]) * t, cy = ca[1] + (cb[1] - ca[1]) * t;
  return { w: b.w, h: b.h, dpr: b.dpr, scale, ox: b.w / 2 - scale * cx, oy: b.h / 2 + scale * cy };
}

/** Two views close enough to call the same (no ease needed). */
export function sameView(a: MapView, b: MapView): boolean {
  return a.w === b.w && a.h === b.h && a.dpr === b.dpr &&
    Math.abs(a.scale / b.scale - 1) < 1e-9 && Math.abs(a.ox - b.ox) < 0.01 && Math.abs(a.oy - b.oy) < 0.01;
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
type LabelBox = { x: number; y: number; w: number; h: number };

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

/**
 * The flight whose polyline passes nearest (x, y) in CSS px through view v,
 * if within maxPx; ties go to the earlier entry, so a caller listing plans
 * before filed routes picks the plan. For picking one flight out of the
 * all-flights map.
 */
export function nearestFlight(v: MapView, lines: { id: string; pts: LL[] }[], x: number, y: number, maxPx: number): string | null {
  let best: string | null = null, bestD = maxPx;
  for (const { id, pts } of lines) {
    let prev: [number, number] | null = null;
    for (const [la, lo] of pts) {
      const q = toScreen(v, la, lo);
      if (prev) {
        const abx = q[0] - prev[0], aby = q[1] - prev[1];
        const t = Math.min(1, Math.max(0, ((x - prev[0]) * abx + (y - prev[1]) * aby) / (abx * abx + aby * aby + 1e-12)));
        const d = Math.hypot(x - prev[0] - t * abx, y - prev[1] - t * aby);
        if (d < bestD) { bestD = d; best = id; }
      }
      prev = q;
    }
  }
  return best;
}
/** c mixed toward the panel by (1 - t), opaque. Fading by colour, not
 *  globalAlpha: five stale plans on one path would stack back to full
 *  strength under alpha (measured: 515 of 1,555 bright pixels survived). */
function toward(c: string, panel: string, t: number): string {
  const a = c.split(",").map(Number), b = panel.split(",").map(Number);
  return a.map((x, i) => Math.round(b[i] + (x - b[i]) * t)).join(", ");
}

function pathLL(ctx: CanvasRenderingContext2D, v: MapView, pts: LL[], close = false) {
  pts.forEach(([la, lo], i) => {
    const [x, y] = toScreen(v, la, lo);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (close) ctx.closePath();
}

const fixLL = (f: Fix): LL => [f[1], f[2]];

/** The model's own arc under a snapped plan: 1px dotted, well below the plan. */
const DENSE_UNDER = 0.4;

/**
 * One flight's result. A stale run draws faded (the table dims to match). A
 * cannot-clear plan never looks like a success: it draws dashed and faint,
 * and the legs that still cross go over it in the airspace red. In snapped
 * display the model's continuous arc (`dense`) draws first, thin, dotted and
 * faint, so the sampled path and the plan snapped from it both show; it
 * takes the same stale and cannot-clear fades as the plan above it.
 */
function drawPlan(ctx: CanvasRenderingContext2D, v: MapView, r: MapResult, c: MapColours, display: MapState["display"], width: number, fresh: boolean) {
  const failed = r.status === "cannot-clear";
  const fade = fresh ? 1 : 0.35;
  const green = toward(c.ok, c.panel, fade * (failed ? 0.5 : 1));
  ctx.save();
  if (display !== "continuous" && r.roles.some((role) => role !== "filed")) {
    ctx.strokeStyle = rgba(toward(c.ok, c.panel, fade * (failed ? 0.5 : 1) * DENSE_UNDER), 1);
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    pathLL(ctx, v, r.dense);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = rgba(green, 1);
  ctx.lineWidth = width;
  if (display === "continuous" || failed) ctx.setLineDash(display === "continuous" ? [5, 3] : [3, 3]);
  ctx.beginPath();
  pathLL(ctx, v, display === "continuous" ? r.dense : r.plan.map(fixLL));
  ctx.stroke();
  ctx.setLineDash([]);
  if (display !== "continuous") {
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
        ctx.fillStyle = rgba(green, 1);
        ctx.fill();
      }
    });
  }
  if (failed && r.crossingLegs?.length) {
    ctx.strokeStyle = rgba(toward(c.red, c.panel, fade), 1);
    ctx.lineWidth = Math.max(2, width);
    for (const i of r.crossingLegs) {
      ctx.beginPath();
      pathLL(ctx, v, [fixLL(r.plan[i]), fixLL(r.plan[i + 1])]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

let routeCanvas: HTMLCanvasElement | null = null;
/** The filed routes' own layer, reused while the backing size holds. */
function routeLayer(ctx: CanvasRenderingContext2D, w: number, h: number): HTMLCanvasElement | null {
  const doc = ctx.canvas.ownerDocument;
  if (!doc) return null;
  if (!routeCanvas) routeCanvas = doc.createElement("canvas");
  if (routeCanvas.width !== w) routeCanvas.width = w;
  if (routeCanvas.height !== h) routeCanvas.height = h;
  return routeCanvas;
}

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

  // 4. Filed routes: opaque ink on a layer of their own, then the layer
  // composited once at routeAlpha. Stroking them straight onto the map at low
  // alpha stacks wherever routes overlap (a 1px line is a Skia hairline, and
  // hairlines accumulate even within one path): measured, 373 routes at 0.14
  // read up to 229/255 on shared legs. On the layer an overlap is just more
  // of the same opaque ink.
  const layer = routeLayer(ctx, Math.round(v.w * v.dpr), Math.round(v.h * v.dpr));
  const lctx = layer?.getContext("2d") as CanvasRenderingContext2D | null;
  if (layer && lctx) {
    lctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    lctx.clearRect(0, 0, v.w, v.h);
    lctx.lineJoin = "round";
    lctx.lineCap = "round";
    lctx.strokeStyle = rgba(c.ink, 1);
    lctx.lineWidth = 1;
    lctx.beginPath();
    for (const r of s.routes) pathLL(lctx, v, r.fixes.map(fixLL));
    lctx.stroke();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = s.routeAlpha ?? 0.45;
    ctx.drawImage(layer as CanvasImageSource, 0, 0);
    ctx.restore();
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
    for (const r of s.results) if (r.status !== "untouched") drawPlan(ctx, v, r, c, s.display, 2, s.fresh);
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
    if (res && res.status !== "untouched") drawPlan(ctx, v, res, c, s.display, 3, s.fresh);
  }

  // 8. Labels last, on a panel-toned backing so routes passing under them
  // don't strike through the text. The pair's airports first, then each
  // site's name to the right of its airspace, else to the left; a name that
  // fits neither side without leaving the map or touching a label already
  // placed is dropped rather than squeezed (a narrow phone map can't hold
  // all six; the airspace itself still draws).
  ctx.font = font;
  ctx.textBaseline = "middle";
  const placed: LabelBox[] = [];
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
