/**
 * The wire between the rerouter figure's client (lib/slaac-engine.ts) and its
 * worker (lib/slaac-worker.ts).
 *
 * Its own file because both sides import it and neither may import the other:
 * the worker's graph holds onnxruntime-web, which must never reach the page
 * bundle. Types only; nothing here executes.
 *
 * Every run-scoped message carries the press's `runId`. The worker never posts
 * one for a run other than its current one, and the client drops any whose
 * runId isn't the run it is awaiting, so a superseded press can't land a late
 * reply on a newer one.
 */
import type { FlightIn } from "./slaac/arcs.ts";
import type { SlaacMeta } from "./slaac/data.ts";
import type { FlightOut, LL, ProgressArc } from "./slaac/run.ts";

export type { FlightIn, FlightOut, LL, ProgressArc };

export type RerouteReq = {
  kind: "reroute";
  runId: number;
  flights: FlightIn[];
  /** [lat, lon] rings: the launch polygons in play plus any the visitor drew. */
  rings: [number, number][][];
  marginNm: number;
  hug: boolean;
  seed: number;
  steps: number;
  batchCap: number;
  display: "snapped" | "continuous";
};

export type Req =
  | { kind: "load"; modelUrl: string; meta: SlaacMeta; navaids: { names: string[]; lat: number[]; lon: number[] } }
  | RerouteReq
  | { kind: "cancel"; runId: number };

export type Res =
  | { kind: "loaded"; ok: true }
  | { kind: "loaded"; ok: false; reason: string }
  /** At most every 2 forward passes. `step` counts passes across every chunk
   *  (1-based) out of `steps`; `arcs` is the running chunk's arcs, each one's
   *  x0 estimate as [lat, lon]. */
  | { kind: "progress"; runId: number; step: number; steps: number; arcs: ProgressArc[] }
  /** `arcs`: arcs actually sampled (flights sharing an entry and rejoin share one).
   *  `fallbackArcs`: of those, sampled on demand because planning missed them (R3);
   *  expected 0. */
  | { kind: "done"; runId: number; flights: FlightOut[]; ms: number; arcs: number; fallbackArcs: number }
  /** In the union for completeness; under the stale-reply rule the worker never
   *  posts it (a cancelled run is no longer the current one), and the client
   *  rejects a superseded press itself. */
  | { kind: "cancelled"; runId: number }
  | { kind: "error"; runId: number; message: string };
