/** One reroute press, end to end: plan every arc, sample them in capped
 *  batches on one seeded noise draw, then run the owner's local_reroute per
 *  flight over the sampled arcs. lib/slaac-worker.ts is a thin shell around
 *  runReroute; keeping the pipeline here, with the model injected, is what
 *  lets plain node pin it against the real ONNX graph.
 *
 *  Owner semantics kept on purpose:
 *  - The owner's Sampler reseeds per arc, so every arc in a press starts from
 *    the SAME noise: normalNoise(seed, C*N), drawn once and repeated per arc.
 *    That also makes an arc a pure function of its (entry, rejoin), so two
 *    flights asking for the same pair share one sampled arc.
 *  - localReroute stays exact (ruling R3): its sampler returns the batched arc
 *    for a planned (entry, rejoin), and samples on demand, unbatched on the
 *    same noise, for any pair the planner missed. anchorsFor is exact in both
 *    policies, so that path should never run; `fallbackArcs` counts it if it does. */
import { inverseAlbers } from "./albers.ts";
import { chunk, planArcs, type ArcJob, type FlightIn, type RerouteOpts } from "./arcs.ts";
import type { SlaacMeta } from "./data.ts";
import { loadSua, type Poly, type Pt } from "./geometry.ts";
import type { Navaids } from "./navaids.ts";
import { localReroute, metrics, type Fix, type Role } from "./reroute.ts";
import { normalNoise } from "./rng.ts";
import { endpointsFromLL, samplePaths, toMetres, type ModelFn } from "./sampler.ts";

export type LL = [lat: number, lon: number];

export type RunReq = {
  flights: FlightIn[];
  /** Polygons as [lat, lon] rings (loadSua drops a closing duplicate). */
  rings: LL[][];
  marginNm: number;
  hug: boolean;
  seed: number;
  steps: number;
  /** Arcs per forward pass; beyond it the arcs run in chunks. */
  batchCap: number;
  /** What the figure draws. The plan is computed either way: the metrics need it. */
  display: "snapped" | "continuous";
};

export type ProgressArc = { flight: string; index: number; xyLL: LL[] };
export type RunProgress = {
  /** Completed forward passes across every chunk, 1-based; `steps` is the total. */
  step: number; steps: number;
  /** The current chunk's arcs: each one's x0 estimate after this step. */
  arcs: ProgressArc[];
};

export type FlightOut = {
  id: string;
  /** [lat, lon]: the filed fixes the plan keeps, with each sampled arc between
   *  its entry and rejoin in place of the deviation fixes. */
  dense: LL[];
  plan: Fix[];
  roles: Role[];
  metrics: ReturnType<typeof metrics>;
  /** untouched: no leg came near a polygon, no arc sampled. cannot-clear: a
   *  leg of the emitted plan still crosses a polygon. */
  status: "ok" | "untouched" | "cannot-clear";
};

export type RunResult = { flights: FlightOut[]; arcs: number; fallbackArcs: number };

export type RunDeps = {
  model: ModelFn;
  meta: SlaacMeta;
  wpdb: Navaids | null;
  /** False once this run is superseded or cancelled; checked before every forward. */
  isCurrent?: () => boolean;
  onProgress?: (p: RunProgress) => void;
  /** Test seam: the arc planner. Defaults to planArcs. */
  planner?: typeof planArcs;
};

/** Thrown out of runReroute when isCurrent() turns false. */
export class RunCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "RunCancelled";
  }
}

class MissingArc extends Error {
  readonly entry: LL;
  readonly rejoin: LL;
  constructor(entry: LL, rejoin: LL) {
    super("arc not planned");
    this.entry = entry;
    this.rejoin = rejoin;
  }
}

/** The gate's reroute settings (scripts/slaac/gate.py), all off meta.reroute,
 *  with the press's one margin used for the hug berth and the clearance. */
export function rerouteOpts(meta: SlaacMeta, marginNm: number, hug: boolean, wpdb: Navaids | null): RerouteOpts {
  const r = meta.reroute;
  const need = (k: string): number => {
    const v = r?.[k];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`meta.reroute.${k} missing`);
    return v;
  };
  return {
    wpdb,
    lockDistNm: need("reroute_dist_nm"),
    snapTolNm: need("sua_snap_tol_nm"),
    devSpacingNm: need("sua_spacing_nm"),
    rdpTolNm: need("sua_rdp_tol_nm"),
    hug,
    hugMarginNm: marginNm,
    clearMarginNm: marginNm,
  };
}

const keyOf = (entry: LL, rejoin: LL) => `${entry[0]},${entry[1]}>${rejoin[0]},${rejoin[1]}`;

export async function runReroute(req: RunReq, deps: RunDeps): Promise<RunResult> {
  const { model, meta, wpdb, onProgress } = deps;
  const isCurrent = deps.isCurrent ?? (() => true);
  const planner = deps.planner ?? planArcs;
  const C = meta.channels, N = meta.sample_size, steps = req.steps;
  if (!(req.batchCap >= 1)) throw new Error(`runReroute: batchCap ${req.batchCap}`);
  if (!isCurrent()) throw new RunCancelled();

  const polys: Poly[] = loadSua(req.rings);
  const polysM = polys.length ? polys : null;
  const opts = rerouteOpts(meta, req.marginNm, req.hug, wpdb);
  const noiseOne = normalNoise(req.seed, C * N);

  const guarded: ModelFn = (inp) => {
    if (!isCurrent()) throw new RunCancelled();
    return model(inp);
  };

  /** Sample arcs [entry, rejoin][] in one batch; returns each as (N,2) metres. */
  const sampleBatch = async (pairs: [LL, LL][], onStep?: (i: number, x0Abs: Float64Array) => void): Promise<Pt[][]> => {
    const n = pairs.length;
    const ep = new Float32Array(n * 12), noise = new Float32Array(n * C * N);
    pairs.forEach(([e, r], b) => {
      ep.set(endpointsFromLL(e, r, meta), b * 12);
      noise.set(noiseOne, b * C * N);
    });
    const fin = await samplePaths({
      model: guarded, meta, endpoints: ep, n, noise, steps, polysM, marginNm: req.marginNm,
      onStep: (i, x0Abs) => {
        if (!isCurrent()) throw new RunCancelled();
        onStep?.(i, x0Abs);
      },
    });
    const m = toMetres(fin, n, N, meta);
    return pairs.map((_, b) => Array.from({ length: N }, (_, i): Pt => [m[(b * N + i) * 2], m[(b * N + i) * 2 + 1]]));
  };

  const xyLLOf = (x0Abs: Float64Array, b: number): LL[] => {
    const out: LL[] = new Array(N);
    const ox = b * C * N, oy = ox + N;
    for (let i = 0; i < N; i++) {
      out[i] = inverseAlbers(x0Abs[ox + i] * meta.xy_scale + meta.xy_mean[0], x0Abs[oy + i] * meta.xy_scale + meta.xy_mean[1]);
    }
    return out;
  };

  // Plan, then dedupe: an arc is a function of its (entry, rejoin) alone.
  const jobs: ArcJob[] = planner(req.flights, polys, opts);
  const unique = new Map<string, { entry: LL; rejoin: LL; jobs: ArcJob[] }>();
  for (const j of jobs) {
    const entry: LL = [j.entry[1], j.entry[2]], rejoin: LL = [j.rejoin[1], j.rejoin[2]];
    const k = keyOf(entry, rejoin);
    const u = unique.get(k);
    if (u) u.jobs.push(j);
    else unique.set(k, { entry, rejoin, jobs: [j] });
  }

  const arcs = new Map<string, Pt[]>();
  const chunks = chunk([...unique.entries()], req.batchCap);
  const total = chunks.length * steps;
  for (const [ci, ch] of chunks.entries()) {
    if (!isCurrent()) throw new RunCancelled();
    const sampled = await sampleBatch(ch.map(([, u]) => [u.entry, u.rejoin]), (i, x0Abs) => {
      if (!onProgress || (i % 2 !== 1 && i !== steps - 1)) return;
      onProgress({
        step: ci * steps + i + 1, steps: total,
        arcs: ch.flatMap(([, u], b) => {
          const xyLL = xyLLOf(x0Abs, b);
          return u.jobs.map((j) => ({ flight: j.flight, index: j.index, xyLL }));
        }),
      });
    });
    ch.forEach(([k], b) => arcs.set(k, sampled[b]));
  }

  let fallbackArcs = 0;
  const flights: FlightOut[] = [];
  for (const f of req.flights) {
    if (!isCurrent()) throw new RunCancelled();
    let out: { plan: Fix[]; roles: Role[] } | null = null;
    // Each retry adds the one arc the last attempt was missing, and localReroute
    // is deterministic given its arcs, so this ends; the bound is a backstop.
    for (let attempt = 0; attempt <= 64 && out === null; attempt++) {
      try {
        out = localReroute(f.nominal, polys, (e, r) => {
          const a = arcs.get(keyOf(e, r));
          if (!a) throw new MissingArc(e, r);
          return a;
        }, opts);
      } catch (err) {
        if (!(err instanceof MissingArc)) throw err;
        const [a] = await sampleBatch([[err.entry, err.rejoin]]);
        arcs.set(keyOf(err.entry, err.rejoin), a);
        fallbackArcs++;
      }
    }
    if (out === null) throw new Error(`runReroute: ${f.id} kept asking for unplanned arcs`);
    const { plan, roles } = out;
    const m = metrics(f.nominal, plan, polys);
    const touched = roles.some((r) => r !== "filed");
    flights.push({
      id: f.id, plan, roles, metrics: m, dense: denseOf(plan, roles, arcs, N),
      status: !touched ? "untouched" : m.legCrossings > 0 ? "cannot-clear" : "ok",
    });
  }
  return { flights, arcs: arcs.size, fallbackArcs };
}

/** The flown path as the model drew it: filed and rejoin fixes as they stand,
 *  and between each rejoin and the fix its deviation run starts from, that
 *  arc's interior points in place of the snapped deviation fixes. */
function denseOf(plan: Fix[], roles: Role[], arcs: Map<string, Pt[]>, N: number): LL[] {
  const out: LL[] = [];
  for (let p = 0; p < plan.length; p++) {
    const f = plan[p];
    if (roles[p] === "deviation") continue;
    if (roles[p] === "rejoin") {
      let q = p - 1;
      while (q >= 0 && roles[q] === "deviation") q--;
      const arc = q >= 0 ? arcs.get(keyOf([plan[q][1], plan[q][2]], [f[1], f[2]])) : undefined;
      if (arc) for (let i = 1; i < N - 1; i++) out.push(inverseAlbers(arc[i][0], arc[i][1]));
    }
    out.push([f[1], f[2]]);
  }
  return out;
}
