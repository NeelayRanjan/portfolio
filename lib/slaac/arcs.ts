/** Arc planning and batching for the rerouter worker.
 *
 *  An arc's anchors depend only on the filed route and the polygons (see
 *  anchorsFor in reroute.ts), so every arc across every flight in one press is
 *  known before the model runs. The worker samples them together, one forward
 *  per step over up to a capped number of arcs, instead of one flight at a time.
 *  No imports beyond siblings, so plain node can pin it. */
import { albers, NM } from "./albers.ts";
import type { Poly } from "./geometry.ts";
import { anchorsFor, type Fix, type localReroute } from "./reroute.ts";

export type RerouteOpts = Parameters<typeof localReroute>[3];
export type FlightIn = { id: string; nominal: Fix[] };
/** One entry->rejoin arc: `index` is its place among its flight's sampler calls. */
export type ArcJob = { flight: string; index: number; entry: Fix; rejoin: Fix };

/** Arcs per forward pass (the CFG batch is twice this). Progress posts every
 *  2 forwards, and the target is a progress interval of ~300 ms or less.
 *  Measured 2026-09-30 on the dev laptop, stock Firefox 152 (headed, prod
 *  build): a forward costs ~16 ms per CFG sample whatever the batch (65 ms at
 *  4 samples, 100 at 6, 131 at 8, 248 at 16), so batching buys almost no
 *  throughput. 8 arcs at the old desktop cap of 16 ran as one chunk with 548 ms
 *  intervals in 5.13 s; at 4 they run as two chunks with ~300 ms intervals in
 *  5.46 s. So desktop is 4 too. The phone cap is still unmeasured on a phone
 *  (the owner's pass): if it stalls there, 2 is the lever, and on this laptop
 *  it costs nothing in total time. */
export const BATCH_CAP_DESKTOP = 4;
export const BATCH_CAP_PHONE = 4;

/** Every arc localReroute will ask for, flight by flight, in call order. */
export function planArcs(flights: FlightIn[], polys: Poly[], opts: RerouteOpts): ArcJob[] {
  return flights.flatMap((f) =>
    anchorsFor(f.nominal, polys, opts).map(({ entry, rejoin }, index) => ({ flight: f.id, index, entry, rejoin })));
}

/** The worker's dedupe key: with one noise draw per press, an arc is a pure
 *  function of its (entry, rejoin), so two jobs with one key sample once. */
export function arcKey(entry: [number, number], rejoin: [number, number]): string {
  return `${entry[0]},${entry[1]}>${rejoin[0]},${rejoin[1]}`;
}

/** How many arcs a press will actually sample: its jobs after the dedupe. */
export function uniqueArcCount(jobs: ArcJob[]): number {
  return new Set(jobs.map((j) => arcKey([j.entry[1], j.entry[2]], [j.rejoin[1], j.rejoin[2]]))).size;
}

/**
 * False only when the flight provably asks for no arc: every point of the
 * route lies inside its own fixes' bounding box, so when that box, grown by
 * the widest distance the walk tests against (the wide berth's lock, or the
 * hug margin), still misses every polygon's box, no fix is within the lock
 * and no leg is affected or crossing in either policy. Exact by geometry, not
 * a heuristic: planArcs over the flights this keeps equals planArcs over all
 * of them (scripts/test-slaac-arcs.mjs pins that on the whole library). It
 * exists for the figure, which plans all 373 library routes on the main
 * thread before a press: ~0.5 s for the full planner in node, far less
 * when most routes are skipped by one box test.
 */
export function mayConflict(nominal: Fix[], polys: Poly[], opts: RerouteOpts): boolean {
  if (!polys.length || nominal.length < 2) return false;
  const grow = Math.max(opts.lockDistNm, opts.clearMarginNm, opts.hugMarginNm) * NM + 1;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of nominal) {
    const [x, y] = albers(f[1], f[2]);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  x0 -= grow; x1 += grow; y0 -= grow; y1 += grow;
  return polys.some((P) => {
    let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
    for (const [x, y] of P) {
      if (x < px0) px0 = x;
      if (x > px1) px1 = x;
      if (y < py0) py0 = y;
      if (y > py1) py1 = y;
    }
    return px0 <= x1 && px1 >= x0 && py0 <= y1 && py1 >= y0;
  });
}

export function chunk<T>(xs: T[], size: number): T[][] {
  if (!(size >= 1) || !Number.isInteger(size)) throw new Error(`chunk: size ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
