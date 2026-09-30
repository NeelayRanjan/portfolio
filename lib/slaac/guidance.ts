/** SUA guidance field, ported from sua_guidance.py (_smooth_along_N, lowpass_path,
 *  _margin_topup, sua_displacement). Paths are (B,C,N) row-major Float64Arrays,
 *  index b*C*N + c*N + i. The Python vectorizes _inside/_nearest_boundary over
 *  points; here they run per point, same results. */
import { NM } from "./albers.ts";
import { inside, nearestBoundary } from "./geometry.ts";
import type { Poly, Pt } from "./geometry.ts";

export type Path2 = { data: Float64Array; B: number; N: number };
export type PathC = { data: Float64Array; B: number; C: number; N: number };

function gaussKernel(sigma: number): { k: Float64Array; rad: number } {
  const rad = Math.max(1, Math.trunc(3 * sigma));
  const k = new Float64Array(2 * rad + 1);
  let s = 0;
  for (let j = -rad; j <= rad; j++) { const v = Math.exp(-(j * j) / (2 * sigma * sigma)); k[j + rad] = v; s += v; }
  for (let j = 0; j < k.length; j++) k[j] /= s;
  return { k, rad };
}

/** Zero-padded same-length Gaussian conv along N (F.conv1d, padding=rad, groups=C). */
function convZero(data: Float64Array, B: number, C: number, N: number, sigma: number): Float64Array {
  const { k, rad } = gaussKernel(sigma);
  const out = new Float64Array(data.length);
  for (let bc = 0; bc < B * C; bc++) {
    const o = bc * N;
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let j = -rad; j <= rad; j++) {
        const m = i + j;
        if (m >= 0 && m < N) acc += k[j + rad] * data[o + m];
      }
      out[o + i] = acc;
    }
  }
  return out;
}

export function smoothAlongN(disp: Path2, sigma: number): Path2 {
  return { data: convZero(disp.data, disp.B, 2, disp.N, sigma), B: disp.B, N: disp.N };
}

/** Replicate-padded Gaussian along N on every channel; xy ends re-pinned. */
export function lowpassPath(path: PathC, sigma: number, pinXyEnds = true): PathC {
  if (!sigma || sigma <= 0) return path;
  const { k, rad } = gaussKernel(sigma);
  const { B, C, N } = path;
  const out = new Float64Array(path.data.length);
  for (let bc = 0; bc < B * C; bc++) {
    const o = bc * N;
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let j = -rad; j <= rad; j++) {
        const m = Math.min(N - 1, Math.max(0, i + j));
        acc += k[j + rad] * path.data[o + m];
      }
      out[o + i] = acc;
    }
  }
  if (pinXyEnds) {
    for (let b = 0; b < B; b++) for (let c = 0; c < Math.min(2, C); c++) {
      const o = (b * C + c) * N;
      out[o] = path.data[o];
      out[o + N - 1] = path.data[o + N - 1];
    }
  }
  return { data: out, B, C, N };
}

export function marginTopup(xy: Path2, polys: Poly[], marginM: number, iters = 3): Path2 {
  const { B, N } = xy;
  const total = new Float64Array(B * 2 * N);
  if (marginM <= 0) return { data: total, B, N };
  let cur = Float64Array.from(xy.data);
  for (let it = 0; it < iters; it++) {
    const step = new Float64Array(total.length);
    for (let b = 0; b < B; b++) {
      const ox = b * 2 * N, oy = ox + N;
      for (const poly of polys) {
        for (let i = 0; i < N; i++) {
          const p: Pt = [cur[ox + i], cur[oy + i]];
          if (inside(p, poly)) continue;
          const nb = nearestBoundary(p, poly);
          const vx = p[0] - nb[0], vy = p[1] - nb[1];
          const d = Math.sqrt(vx * vx + vy * vy);
          if (d < marginM && d > 1e-6) {
            const amp = marginM - d;
            step[ox + i] += (vx / d) * amp;
            step[oy + i] += (vy / d) * amp;
          }
        }
      }
    }
    for (let i = 0; i < total.length; i++) total[i] += step[i];
    for (let i = 0; i < cur.length; i++) cur[i] = xy.data[i] + total[i];
  }
  return { data: total, B, N };
}

export function suaDisplacement(xy: Path2, polys: Poly[], marginNm: number, smoothSigma: number, pinEnds = true): Path2 {
  const { B, N } = xy;
  const margin = marginNm * NM;
  let out: Float64Array = new Float64Array(B * 2 * N);
  for (let b = 0; b < B; b++) {
    const ox = b * 2 * N, oy = ox + N;
    const px = (i: number): Pt => [xy.data[ox + i], xy.data[oy + i]];
    for (const poly of polys) {
      const ins: number[] = [];
      for (let i = 0; i < N; i++) if (inside(px(i), poly)) ins.push(i);
      if (ins.length === 0) continue;
      let cx = 0, cy = 0;
      for (const v of poly) { cx += v[0]; cy += v[1]; }
      cx /= poly.length; cy /= poly.length;
      const runs: number[][] = [[ins[0]]];
      for (let r = 1; r < ins.length; r++) {
        if (ins[r] - ins[r - 1] !== 1) runs.push([]);
        runs[runs.length - 1].push(ins[r]);
      }
      for (const run of runs) {
        const i0 = run[0], i1 = run[run.length - 1];
        const a = px(Math.max(i0 - 1, 0)), b2 = px(Math.min(i1 + 1, N - 1));
        let ux = b2[0] - a[0], uy = b2[1] - a[1];
        const nrm = Math.sqrt(ux * ux + uy * uy) + 1e-9;
        ux /= nrm; uy /= nrm;
        let perp: Pt = [-uy, ux];
        let mx = 0, my = 0;
        for (const i of run) { const q = px(i); mx += q[0]; my += q[1]; }
        mx /= run.length; my /= run.length;
        if (perp[0] * (mx - cx) + perp[1] * (my - cy) < 0) perp = [-perp[0], -perp[1]];
        let pmax = -Infinity;
        for (const v of poly) pmax = Math.max(pmax, v[0] * perp[0] + v[1] * perp[1]);
        const amp = pmax - (perp[0] * mx + perp[1] * my) + margin;
        for (const i of run) { out[ox + i] += perp[0] * amp; out[oy + i] += perp[1] * amp; }
      }
    }
  }
  if (smoothSigma && smoothSigma > 0) out = convZero(out, B, 2, N, smoothSigma);
  const moved = Float64Array.from(xy.data, (v, i) => v + out[i]);
  const top = marginTopup({ data: moved, B, N }, polys, margin).data;
  for (let i = 0; i < out.length; i++) out[i] += top[i];
  if (pinEnds) {
    for (let b = 0; b < B; b++) for (let c = 0; c < 2; c++) {
      const o = (b * 2 + c) * N;
      out[o] = 0; out[o + N - 1] = 0;
    }
  }
  return { data: out, B, N };
}
