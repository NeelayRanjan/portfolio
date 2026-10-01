/**
 * The main thread's handle on the SLAAC rerouter worker, on the chess
 * engine's pattern (lib/chess-engine.ts): a memoized loader that resolves null
 * when the model isn't deployed, a worker that owns every model byte, and
 * messages turned back into promises.
 *
 * No model and no onnxruntime-web on this side of the wire, ever: importing
 * either here would put the runtime back into the page bundle.
 */
import { loadSlaacData } from "./slaac/data.ts";
import type { RerouteReq, Req, Res } from "./slaac-protocol.ts";
import { noteOffload } from "./stargaze";

export type { FlightIn, FlightOut, RerouteReq, Res } from "./slaac-protocol.ts";

/** Stargaze terminated the worker. The figure treats it as idle, never as an error. */
export class SlaacUnloaded extends Error {
  constructor() {
    super("rerouter unloaded");
    this.name = "SlaacUnloaded";
  }
}

/** A newer reroute press (or a cancel) superseded this one. Not an error either. */
export class SlaacCancelled extends Error {
  constructor() {
    super("reroute superseded");
    this.name = "SlaacCancelled";
  }
}

type Progress = Extract<Res, { kind: "progress" }>;
type Done = Extract<Res, { kind: "done" }>;

export type SlaacEngine = {
  /** One press. Starting a new one rejects the previous press with SlaacCancelled. */
  reroute(req: Omit<RerouteReq, "kind" | "runId">, onProgress: (p: Progress) => void): Promise<Done>;
  /** Abandon the running press, if any (its promise rejects with SlaacCancelled). */
  cancel(): void;
  /** Stop the worker for good. A pending press rejects with SlaacUnloaded. */
  terminate(): void;
};

let cache: Promise<SlaacEngine | null> | null = null;
/** The live worker's terminate, set as soon as a worker exists, so an unload
 *  mid-load (the model still downloading) stops it at once. */
let kill: (() => void) | null = null;
/** Bumped by every unload: a load that started before it must not go on to
 *  start a worker after it. */
let loadGen = 0;

/** Resolves null if the meta or the model isn't deployed: the figure gates on that. */
export function loadSlaacEngine(): Promise<SlaacEngine | null> {
  if (cache) return cache;
  const gen = loadGen;
  const p: Promise<SlaacEngine | null> = (async () => {
    const data = await loadSlaacData();
    if (gen !== loadGen) throw new SlaacUnloaded();
    if (!data) return null;
    const modelUrl = `/models/${data.meta.model}`;
    try {
      const head = await fetch(modelUrl, { method: "HEAD" });
      if (!head.ok) return null;
    } catch {
      return null;
    }
    if (gen !== loadGen) throw new SlaacUnloaded();

    // Must stay a literal `new URL(..., import.meta.url)`, or Turbopack can't
    // see the dependency and the worker chunk is never emitted (the chess trap;
    // the raw `.ts` it also drops under .next/static/media is never fetched).
    const worker = new Worker(new URL("./slaac-worker.ts", import.meta.url), { type: "module" });

    let dead = false;
    let failLoad: (e: Error) => void = () => {};
    let awaiting: { runId: number; resolve: (d: Done) => void; reject: (e: Error) => void; onProgress: (p: Progress) => void } | null = null;
    let nextRun = 0;
    const send = (r: Req) => worker.postMessage(r);

    const settle = (e: Error) => {
      const a = awaiting;
      awaiting = null;
      a?.reject(e);
    };
    const terminate = () => {
      if (dead) return;
      dead = true;
      worker.terminate();
      if (kill === terminate) kill = null;
      if (cache === p) cache = null;
      failLoad(new SlaacUnloaded());
      settle(new SlaacUnloaded());
    };
    kill = terminate;

    const loaded = new Promise<void>((resolve, reject) => {
      failLoad = reject;
      worker.addEventListener("error", (e) => {
        const err = new Error(e.message || "rerouter worker error");
        reject(err); // a no-op once loaded
        settle(err);
      });
      worker.addEventListener("message", (e: MessageEvent<Res>) => {
        const m = e.data;
        if (m.kind === "loaded") {
          if (m.ok) resolve();
          else reject(new Error(m.reason));
          return;
        }
        const a = awaiting;
        if (!a || m.runId !== a.runId) return; // a superseded press's late reply
        if (m.kind === "progress") a.onProgress(m);
        else if (m.kind === "done") { awaiting = null; a.resolve(m); }
        else if (m.kind === "cancelled") settle(new SlaacCancelled());
        else if (m.kind === "error") settle(new Error(m.message));
      });
    });

    send({ kind: "load", modelUrl, meta: data.meta, navaids: { names: data.navaids.names, lat: data.navaids.lat, lon: data.navaids.lon } });
    try {
      await loaded;
    } catch (err) {
      terminate();
      throw err;
    }

    const engine: SlaacEngine = {
      reroute(req, onProgress) {
        if (dead) return Promise.reject(new SlaacUnloaded());
        settle(new SlaacCancelled());
        const runId = ++nextRun;
        return new Promise<Done>((resolve, reject) => {
          awaiting = { runId, resolve, reject, onProgress };
          send({ ...req, kind: "reroute", runId });
        });
      },
      cancel() {
        if (dead || !awaiting) return;
        send({ kind: "cancel", runId: awaiting.runId });
        settle(new SlaacCancelled());
      },
      terminate,
    };
    return engine;
  })().catch((err) => {
    // Identity guard (the chess lesson): an older failed load must not wipe a
    // newer `cache` a stargaze round trip has since installed.
    if (cache === p) cache = null;
    throw err;
  });
  cache = p;
  return p;
}

/**
 * Stargaze offload: terminate the worker (loaded or still loading) and reset
 * the memo, so the next loadSlaacEngine() starts fresh; the model and runtime
 * come back from the HTTP cache. A worker's memory really does go back to the
 * OS, unlike the main thread's ORT heap.
 */
export function unloadSlaacEngine(): void {
  const k = kill;
  cache = null;
  loadGen++;
  if (!k) return;
  k();
  noteOffload("slaac");
}
