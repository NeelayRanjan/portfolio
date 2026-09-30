/** The rerouter's sampler, ported from the owner's plan_cli.py (chord,
 *  from_residual, ep_heading, chord_features, v_to_x0, sample_paths) and
 *  sua_guidance.endpoints_from_ll: classifier-free guidance, self-conditioning
 *  and SUA-guided DPM-Solver++ over a (C, N) residual from the O->D chord.
 *
 *  Precision: the Python sampler runs in float32 tensors end to end, so every
 *  tensor op here is rounded through Math.fround where torch rounds (a Python
 *  float scalar is cast to float32 before it meets a float32 tensor). The one
 *  place that is load-bearing rather than cosmetic is the chord: torch's
 *  float32 linspace and A + (D - A) * s put the pinned last point 1 ulp off E,
 *  so chord_features' to-end vector there is a tiny nonzero one and atan2
 *  reads pi (or -pi/2), not 0; a float64 chord flips those channels. The
 *  guidance field (sua_displacement, lowpass_path) promotes to float64 inside
 *  numpy/torch and is cast back to float32 on the way out; the casts here sit
 *  at the same points. Pinned by scripts/test-slaac-sampler.mjs against the
 *  real ONNX model. */
import { albers } from "./albers.ts";
import { DpmSolver } from "./dpm-solver.ts";
import type { DpmConfig } from "./dpm-solver.ts";
import type { Poly } from "./geometry.ts";
import { lowpassPath, suaDisplacement } from "./guidance.ts";

const f = Math.fround;
const OD_DIM = 4, EPHDG_DIM = 4, SELFCOND_DIM = 6, EP_C = 6;

export type Meta = {
  channels: number; null_type: number; sample_size: number; res_scale: number;
  xy_mean: [number, number]; xy_scale: number; aux_mean: number[]; aux_std: number[];
  scheduler: DpmConfig;
  sampler: { steps: number; guidance: number; lowpass_sigma: number; sua_strength: number; sua_smooth: number };
};

/** One batched UNet call. Inputs are row-major; returns v (B,C,N). */
export type ModelFn = (inp: {
  noisy: Float32Array; t: number; od: Float32Array; eh: Float32Array; sc: Float32Array; tid: BigInt64Array; B: number;
}) => Promise<Float32Array>;

export type Endpoints = Float32Array; // (n,2,6) normalized, from endpointsFromLL

/** (2,6) normalized [start, end]: xy from the cache's stats, alt/spd at the
 *  dataset mean, heading along O->D. numpy float64 math, stored float32. */
export function endpointsFromLL(o: [number, number], d: [number, number], meta: Meta): Float32Array {
  const [ox, oy] = albers(o[0], o[1]);
  const [dx, dy] = albers(d[0], d[1]);
  const xm = meta.xy_mean, xs = meta.xy_scale, am = meta.aux_mean, ast = meta.aux_std;
  const hdg = Math.atan2(dy - oy, dx - ox);
  const ep = (x: number, y: number) => {
    const raw = [am[0], am[1], Math.sin(hdg), Math.cos(hdg)];
    return [(x - xm[0]) / xs, (y - xm[1]) / xs, ...raw.map((v, k) => (v - am[k]) / ast[k])];
  };
  return Float32Array.from([...ep(ox, oy), ...ep(dx, dy)]);
}

/** torch.linspace(0, 1, N) in float32 on CPU: s[i] = step*i below halfway,
 *  1 - step*(N-1-i) above, step = float32(1/(N-1)), each value rounded once
 *  (measured bitwise against torch 2.13 for N = 256). */
function linspace01(N: number): Float64Array {
  const s = new Float64Array(N);
  if (N === 1) { s[0] = 0; return s; }
  const step = f(1 / (N - 1));
  const half = Math.floor(N / 2);
  for (let i = 0; i < N; i++) s[i] = i < half ? f(step * i) : f(1 - step * (N - 1 - i));
  return s;
}

/** chord(endpoints[:, :, :2]): A + (D - A) * s, float32 ops. (n,2,N). */
function chord(ep: Float32Array, n: number, N: number): Float32Array {
  const s = linspace01(N);
  const out = new Float32Array(n * 2 * N);
  for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
    const A = ep[b * 2 * EP_C + c], D = ep[b * 2 * EP_C + EP_C + c];
    const dA = f(D - A), o = (b * 2 + c) * N;
    for (let i = 0; i < N; i++) out[o + i] = f(A + f(dA * s[i]));
  }
  return out;
}

/** from_residual: xy = r*res_scale + chord, the other channels pass through. */
function fromResidual(r: Float32Array, ch: Float32Array, n: number, C: number, N: number, rs32: number): Float32Array {
  const out = Float32Array.from(r);
  for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
    const o = (b * C + c) * N, oc = (b * 2 + c) * N;
    for (let i = 0; i < N; i++) out[o + i] = f(f(r[o + i] * rs32) + ch[oc + i]);
  }
  return out;
}

function pinXyEnds(x: Float32Array, n: number, C: number, N: number): void {
  for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
    const o = (b * C + c) * N;
    x[o] = 0; x[o + N - 1] = 0;
  }
}

/** (n,2,N) predicted xy + (n,2,6) endpoints -> (n,6,N) self-conditioning
 *  features: signed cross-track, normalized along-track, sin/cos heading
 *  change to the end, sin/cos heading change from the start. torch.gradient
 *  along N: central differences inside, one-sided at the ends. */
export function chordFeatures(pXy: Float64Array, ep: Float32Array, n: number, N: number, resScale: number): Float32Array {
  const out = new Float32Array(n * SELFCOND_DIM * N);
  const rs32 = f(resScale), eps = f(1e-8);
  for (let b = 0; b < n; b++) {
    const e = b * 2 * EP_C;
    const Sx = ep[e], Sy = ep[e + 1], Ex = ep[e + EP_C], Ey = ep[e + EP_C + 1];
    const dx = f(Ex - Sx), dy = f(Ey - Sy);
    const L = Math.max(f(Math.sqrt(f(f(dx * dx) + f(dy * dy)))), eps);
    const ux = f(dx / L), uy = f(dy / L);
    const ox = b * 2 * N, oy = ox + N, oo = b * SELFCOND_DIM * N;
    const px = (i: number) => pXy[ox + i], py = (i: number) => pXy[oy + i];
    for (let i = 0; i < N; i++) {
      const relx = f(px(i) - Sx), rely = f(py(i) - Sy);
      const along = f(f(relx * ux) + f(rely * uy));
      const cross = f(f(relx * uy) - f(rely * ux));
      let tx: number, ty: number;
      if (i === 0) { tx = f(px(1) - px(0)); ty = f(py(1) - py(0)); }
      else if (i === N - 1) { tx = f(px(N - 1) - px(N - 2)); ty = f(py(N - 1) - py(N - 2)); }
      else { tx = f(f(px(i + 1) - px(i - 1)) / 2); ty = f(f(py(i + 1) - py(i - 1)) / 2); }
      const thT = f(Math.atan2(ty, tx));
      const thE = f(Math.atan2(f(Ey - py(i)), f(Ex - px(i))));
      const thS = f(Math.atan2(rely, relx));
      const dhE = f(thE - thT), dhS = f(thT - thS);
      out[oo + i] = f(cross / rs32);
      out[oo + N + i] = f(along / L);
      out[oo + 2 * N + i] = Math.sin(dhE);
      out[oo + 3 * N + i] = Math.cos(dhE);
      out[oo + 4 * N + i] = Math.sin(dhS);
      out[oo + 5 * N + i] = Math.cos(dhS);
    }
  }
  return out;
}

/** xy channels of (n,C,N) in metres, float32 like the Python's x*xs + xm. */
function xyMetres32(x: Float32Array, n: number, C: number, N: number, xs32: number, xm: [number, number]): Float64Array {
  const out = new Float64Array(n * 2 * N);
  for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
    const o = (b * C + c) * N, oo = (b * 2 + c) * N;
    for (let i = 0; i < N; i++) out[oo + i] = f(f(x[o + i] * xs32) + xm[c]);
  }
  return out;
}

export async function samplePaths(args: {
  model: ModelFn; meta: Meta; endpoints: Float32Array; n: number; noise: Float32Array; // (n,C,N)
  steps: number; polysM: Poly[] | null; marginNm: number;
  /** Called after each step with that step's x0 (absolute, and the residual
   *  the solver saw). Throw from here to cancel: the error propagates. */
  onStep?: (i: number, x0Abs: Float64Array, x0: Float64Array) => void;
}): Promise<Float64Array> {
  const { model, meta, endpoints: ep, n, noise, steps, polysM, marginNm, onStep } = args;
  const C = meta.channels, N = meta.sample_size;
  if (ep.length !== n * 2 * EP_C) throw new Error(`samplePaths: endpoints length ${ep.length}, want ${n * 2 * EP_C}`);
  if (noise.length !== n * C * N) throw new Error(`samplePaths: noise length ${noise.length}, want ${n * C * N}`);
  const { guidance, lowpass_sigma: lowpassSigma, sua_strength: suaStrength, sua_smooth: suaSmooth } = meta.sampler;
  const sua = polysM && polysM.length > 0 ? polysM : null;
  const rs32 = f(meta.res_scale), xs32 = f(meta.xy_scale), g32 = f(guidance), str32 = f(suaStrength);
  const xm: [number, number] = [f(meta.xy_mean[0]), f(meta.xy_mean[1])];

  const solver = new DpmSolver(meta.scheduler);
  solver.setTimesteps(steps);
  const chordRef = chord(ep, n, N);
  const od = new Float32Array(n * OD_DIM), eh = new Float32Array(n * EPHDG_DIM);
  for (let b = 0; b < n; b++) {
    const e = b * 2 * EP_C;
    od.set([ep[e], ep[e + 1], ep[e + EP_C], ep[e + EP_C + 1]], b * OD_DIM);
    eh.set([ep[e + 4], ep[e + 5], ep[e + EP_C + 4], ep[e + EP_C + 5]], b * EPHDG_DIM);
  }
  const useCfg = guidance > 1.0;
  const B = useCfg ? 2 * n : n;
  // Conditional half: the owner's Sampler always passes type id 0. The
  // unconditional half (eh zeroed, tid = null_type) is FlightDiffusion's drop=True.
  const odB = new Float32Array(B * OD_DIM), ehB = new Float32Array(B * EPHDG_DIM);
  const tid = new BigInt64Array(B);
  odB.set(od); ehB.set(eh);
  if (useCfg) { odB.set(od, n * OD_DIM); for (let b = n; b < B; b++) tid[b] = BigInt(meta.null_type); }
  const noisy = new Float32Array(B * C * N), scB = new Float32Array(B * SELFCOND_DIM * N);
  const size = n * C * N;

  let r: Float32Array = Float32Array.from(noise);
  let sc: Float32Array = new Float32Array(n * SELFCOND_DIM * N);
  const ts = solver.timesteps;
  for (let step = 0; step < ts.length; step++) {
    const t = ts[step];
    noisy.set(r); scB.set(sc);
    if (useCfg) { noisy.set(r, size); scB.set(sc, n * SELFCOND_DIM * N); }
    const out = await model({ noisy, t, od: odB, eh: ehB, sc: scB, tid, B });
    if (out.length !== B * C * N) throw new Error(`samplePaths: model returned ${out.length} values, want ${B * C * N}`);
    let v = new Float32Array(size);
    if (useCfg) for (let k = 0; k < size; k++) { const vc = out[k], vu = out[size + k]; v[k] = f(vu + f(g32 * f(vc - vu))); }
    else v.set(out.subarray(0, size));

    // v_to_x0: x0 = sqrt(ac)*x_t - sqrt(1-ac)*v
    const ac = solver.alphasCumprod[t];
    const sa = f(Math.sqrt(ac)), s1 = f(Math.sqrt(f(1 - ac)));
    const x0 = new Float32Array(size);
    for (let k = 0; k < size; k++) x0[k] = f(f(sa * r[k]) - f(s1 * v[k]));
    pinXyEnds(x0, n, C, N);
    let x0Abs = fromResidual(x0, chordRef, n, C, N, rs32);
    if (sua) {
      const xyM = xyMetres32(x0Abs, n, C, N, xs32, xm);
      const d = suaDisplacement({ data: xyM, B: n, N }, sua, marginNm, suaSmooth).data;
      for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
        const o = (b * C + c) * N, oc = (b * 2 + c) * N;
        for (let i = 0; i < N; i++) {
          const dM = f(str32 * f(d[oc + i]));
          const xyNew = f(x0Abs[o + i] + f(dM / xs32));
          x0[o + i] = f(f(xyNew - chordRef[oc + i]) / rs32);
        }
      }
      pinXyEnds(x0, n, C, N);
      x0Abs = fromResidual(x0, chordRef, n, C, N, rs32);
      v = new Float32Array(size);
      for (let k = 0; k < size; k++) v[k] = f(f(f(sa * r[k]) - x0[k]) / s1);
    }
    const pXy = new Float64Array(n * 2 * N);
    for (let b = 0; b < n; b++) pXy.set(x0Abs.subarray(b * C * N, b * C * N + 2 * N), b * 2 * N);
    sc = chordFeatures(pXy, ep, n, N, meta.res_scale);
    r = solver.step(v, t, r);
    onStep?.(step, Float64Array.from(x0Abs), Float64Array.from(x0));
  }

  pinXyEnds(r, n, C, N);
  let final = fromResidual(r, chordRef, n, C, N, rs32);
  if (lowpassSigma && lowpassSigma > 0) {
    final = Float32Array.from(lowpassPath({ data: Float64Array.from(final), B: n, C, N }, lowpassSigma).data);
  }
  if (sua) { // final hard clear
    const xyM = xyMetres32(final, n, C, N, xs32, xm);
    const d = suaDisplacement({ data: xyM, B: n, N }, sua, marginNm, 0).data;
    for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
      const o = (b * C + c) * N, oc = (b * 2 + c) * N;
      for (let i = 0; i < N; i++) final[o + i] = f(final[o + i] + f(f(d[oc + i]) / xs32));
    }
  }
  return Float64Array.from(final);
}

/** (n,C,N) normalized absolute -> (n,N,2) Albers metres. */
export function toMetres(finalXy: Float64Array, n: number, N: number, meta: Meta): Float64Array {
  const C = finalXy.length / (n * N);
  if (!Number.isInteger(C) || C < 2) throw new Error(`toMetres: ${finalXy.length} values is not (${n}, C>=2, ${N})`);
  const out = new Float64Array(n * N * 2);
  for (let b = 0; b < n; b++) for (let c = 0; c < 2; c++) {
    const o = (b * C + c) * N;
    for (let i = 0; i < N; i++) out[(b * N + i) * 2 + c] = finalXy[o + i] * meta.xy_scale + meta.xy_mean[c];
  }
  return out;
}
