/** Arc planning and batching for the rerouter worker.
 *
 *  An arc's anchors depend only on the filed route and the polygons (see
 *  anchorsFor in reroute.ts), so every arc across every flight in one press is
 *  known before the model runs. The worker samples them together, one forward
 *  per step over up to a capped number of arcs, instead of one flight at a time.
 *  No imports beyond siblings, so plain node can pin it. */
import type { Poly } from "./geometry.ts";
import { anchorsFor, type Fix, type localReroute } from "./reroute.ts";

export type RerouteOpts = Parameters<typeof localReroute>[3];
export type FlightIn = { id: string; nominal: Fix[] };
/** One entry->rejoin arc: `index` is its place among its flight's sampler calls. */
export type ArcJob = { flight: string; index: number; entry: Fix; rejoin: Fix };

/** Arcs per forward pass (the CFG batch is twice this). Provisional; Task 15
 *  measures them on real hardware. */
export const BATCH_CAP_DESKTOP = 16;
export const BATCH_CAP_PHONE = 4;

/** Every arc localReroute will ask for, flight by flight, in call order. */
export function planArcs(flights: FlightIn[], polys: Poly[], opts: RerouteOpts): ArcJob[] {
  return flights.flatMap((f) =>
    anchorsFor(f.nominal, polys, opts).map(({ entry, rejoin }, index) => ({ flight: f.id, index, entry, rejoin })));
}

export function chunk<T>(xs: T[], size: number): T[][] {
  if (!(size >= 1) || !Number.isInteger(size)) throw new Error(`chunk: size ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
