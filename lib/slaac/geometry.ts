/** Airspace geometry, ported statement for statement from sua_guidance.py.
 *  Points are Albers metres. Float operation order follows the Python. */
import { albers, NM } from "./albers.ts";

export type Pt = [number, number];
export type Poly = Pt[];

/** sg.load_sua: rings of [lat, lon]; drops a closing duplicate vertex (np.allclose). */
export function loadSua(ringsLatLon: Pt[][]): Poly[] {
  return ringsLatLon.map((ring) => {
    let a = ring;
    if (a.length > 1) {
      const f = a[0], l = a[a.length - 1];
      const close = (u: number, v: number) => Math.abs(u - v) <= 1e-8 + 1e-5 * Math.abs(v);
      if (close(f[0], l[0]) && close(f[1], l[1])) a = a.slice(0, -1);
    }
    return a.map(([la, lo]) => albers(la, lo));
  });
}

/** _inside for one point: ray casting, XOR over edges, j starts at K-1. */
export function inside(p: Pt, poly: Poly): boolean {
  const [x, y] = p;
  let ins = false;
  const K = poly.length;
  let j = K - 1;
  for (let i = 0; i < K; i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const cond = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (cond) ins = !ins;
    j = i;
  }
  return ins;
}

/** _nearest_boundary for one point. */
export function nearestBoundary(p: Pt, poly: Poly): Pt {
  const K = poly.length;
  let bestD = Infinity;
  let best: Pt = [0, 0];
  let j = K - 1;
  for (let i = 0; i < K; i++) {
    const a = poly[j], b = poly[i];
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const dot = (p[0] - a[0]) * abx + (p[1] - a[1]) * aby;
    const t = Math.min(1, Math.max(0, dot / (abx * abx + aby * aby + 1e-12)));
    const px = a[0] + t * abx, py = a[1] + t * aby;
    const dx = p[0] - px, dy = p[1] - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) { bestD = d; best = [px, py]; }
    j = i;
  }
  return best;
}

function ccw(a: Pt, b: Pt, c: Pt): boolean {
  return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
}

function segInt(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function segCrossesPoly(a: Pt, b: Pt, poly: Poly): boolean {
  if (inside(a, poly) || inside(b, poly)) return true;
  const K = poly.length;
  for (let i = 0; i < K; i++) {
    if (segInt(a, b, poly[i], poly[(i + 1) % K])) return true;
  }
  return false;
}

function ptSeg(p: Pt, a: Pt, b: Pt): number {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const L2 = abx * abx + aby * aby;
  const t = L2 < 1e-12 ? 0.0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / L2));
  const dx = p[0] - (a[0] + t * abx), dy = p[1] - (a[1] + t * aby);
  return Math.sqrt(dx * dx + dy * dy);
}

function segSegDist(p1: Pt, p2: Pt, q1: Pt, q2: Pt): number {
  if (segInt(p1, p2, q1, q2)) return 0.0;
  return Math.min(ptSeg(p1, q1, q2), ptSeg(p2, q1, q2), ptSeg(q1, p1, p2), ptSeg(q2, p1, p2));
}

export function segPolyDist(a: Pt, b: Pt, poly: Poly): number {
  if (inside(a, poly) || inside(b, poly)) return 0.0;
  const K = poly.length;
  let m = Infinity;
  for (let i = 0; i < K; i++) m = Math.min(m, segSegDist(a, b, poly[i], poly[(i + 1) % K]));
  return m;
}

export function segIllegal(a: Pt, b: Pt, polys: Poly[], marginM = 0): boolean {
  if (marginM <= 0.0) return polys.some((P) => segCrossesPoly(a, b, P));
  return polys.some((P) => segPolyDist(a, b, P) < marginM);
}

export function distToSuaNm(p: Pt, polys: Poly[]): number {
  let best = Infinity;
  for (const poly of polys) {
    if (inside(p, poly)) return 0.0;
    const b = nearestBoundary(p, poly);
    const dx = p[0] - b[0], dy = p[1] - b[1];
    best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
  }
  return best / NM;
}

export function ptIllegal(p: Pt, polys: Poly[], marginM = 0): boolean {
  if (marginM <= 0.0) return polys.some((P) => inside(p, P));
  return distToSuaNm(p, polys) * NM < marginM;
}

/** _rdp_mask: keep endpoints and any vertex beyond tolM of the running chord. */
export function rdpMask(xy: Pt[], tolM: number): boolean[] {
  const m = xy.length;
  const keep: boolean[] = new Array(m).fill(false);
  keep[0] = true; keep[m - 1] = true;
  const stack: [number, number][] = [[0, m - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    if (j <= i + 1) continue;
    const a = xy[i], b = xy[j];
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const L = Math.hypot(abx, aby);
    let k = 0, dk = -Infinity;
    for (let n = i + 1; n < j; n++) {
      const sx = xy[n][0] - a[0], sy = xy[n][1] - a[1];
      const dd = L < 1e-9 ? Math.hypot(sx, sy) : Math.abs(sx * aby - sy * abx) / L;
      if (dd > dk) { dk = dd; k = n - (i + 1); }
    }
    if (dk > tolM) {
      const idx = i + 1 + k;
      keep[idx] = true;
      stack.push([i, idx]); stack.push([idx, j]);
    }
  }
  return keep;
}
