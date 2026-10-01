/// <reference lib="webworker" />
/**
 * The SLAAC rerouter's whole runtime, off the main thread: the ORT session,
 * the sampler, the guidance, the reroute and the snapping. A press samples
 * ~20 CFG forwards over every arc at once, seconds of solid compute that
 * would freeze the page on the main thread.
 *
 * A thin shell on purpose: the pipeline is runReroute (lib/slaac/run.ts),
 * pinned in plain node against the real model by scripts/test-slaac-arcs.mjs.
 * This file only owns the session, the current run, and the wire.
 *
 * onnxruntime-web is imported HERE and nowhere else in the rerouter, and only through
 * the `/wasm` entry: in 1.27 that is the one entry that fetches the plain
 * wasm build (`/webgpu` fetches asyncify, the bare entry jsep, and both run
 * away in JavaScriptCore; see CLAUDE.md, the WebKit trap).
 */
import type { InferenceSession } from "onnxruntime-web/wasm";
import { Navaids } from "./slaac/navaids.ts";
import { RunCancelled, runReroute } from "./slaac/run.ts";
import type { ModelFn } from "./slaac/sampler.ts";
import { makeMacrotaskYield } from "./slaac/yield.ts";
import type { SlaacMeta } from "./slaac/data.ts";
import type { Req, Res } from "./slaac-protocol.ts";

type Ort = typeof import("onnxruntime-web/wasm");

let ort: Ort | null = null;
let session: InferenceSession | null = null;
let meta: SlaacMeta | null = null;
let wpdb: Navaids | null = null;

/** The run whose messages may be posted; -1 when none (after a cancel). */
let currentRun = -1;

/** session.run calls are chained: a superseded run can still be inside its
 *  last forward when the next press starts, and two runs must never be in
 *  one session at once. */
let gate: Promise<unknown> = Promise.resolve();

/** One macrotask before every forward (ruling R16): session.run never returns
 *  to the task queue, so without it a cancel or newer press would only be
 *  dispatched after the whole old run. */
const yieldToQueue = makeMacrotaskYield();

const postRaw = (m: Res) => (self as unknown as Worker).postMessage(m);
/** The stale-reply rule: a run-scoped message for any run but the current one
 *  is dropped here, at the only place the worker posts. */
const post = (m: Res) => {
  if ("runId" in m && m.runId !== currentRun) return;
  postRaw(m);
};

async function load(msg: Extract<Req, { kind: "load" }>): Promise<void> {
  try {
    ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.logLevel = "error";
    // Threads need SharedArrayBuffer, which needs cross-origin isolation
    // (next.config.ts's COOP/COEP); without it ORT would only warn and run one.
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 1)
      : 1;
    session = await ort.InferenceSession.create(msg.modelUrl, { executionProviders: ["wasm"] });
    meta = msg.meta;
    wpdb = new Navaids(msg.navaids.names, msg.navaids.lat, msg.navaids.lon);
    postRaw({ kind: "loaded", ok: true });
  } catch (err) {
    session = null;
    postRaw({ kind: "loaded", ok: false, reason: (err as Error).message || String(err) });
  }
}

const model: ModelFn = (inp) => {
  const o = ort!, s = session!, m = meta!;
  const C = m.channels, N = m.sample_size, B = inp.B;
  const run = gate.then(async () => {
    const out = await s.run({
      noisy: new o.Tensor("float32", inp.noisy, [B, C, N]),
      t: new o.Tensor("int64", BigInt64Array.from({ length: B }, () => BigInt(inp.t)), [B]),
      od: new o.Tensor("float32", inp.od, [B, 4]),
      eh: new o.Tensor("float32", inp.eh, [B, 4]),
      sc: new o.Tensor("float32", inp.sc, [B, 6, N]),
      tid: new o.Tensor("int64", inp.tid, [B]),
    });
    return out.v.data as Float32Array;
  });
  gate = run.catch(() => undefined);
  return run;
};

async function reroute(msg: Extract<Req, { kind: "reroute" }>): Promise<void> {
  const runId = msg.runId;
  currentRun = runId;
  if (!session || !meta) {
    post({ kind: "error", runId, message: "rerouter not loaded" });
    return;
  }
  const t0 = performance.now();
  try {
    const res = await runReroute(msg, {
      model, meta, wpdb,
      isCurrent: () => currentRun === runId,
      beforeForward: yieldToQueue,
      onProgress: (p) => post({ kind: "progress", runId, ...p }),
    });
    post({ kind: "done", runId, flights: res.flights, ms: performance.now() - t0, arcs: res.arcs, fallbackArcs: res.fallbackArcs });
  } catch (err) {
    if (err instanceof RunCancelled) post({ kind: "cancelled", runId });
    else post({ kind: "error", runId, message: (err as Error).message || String(err) });
  }
}

self.onmessage = (e: MessageEvent<Req>) => {
  const msg = e.data;
  if (msg.kind === "load") void load(msg);
  else if (msg.kind === "reroute") void reroute(msg);
  else if (msg.kind === "cancel" && msg.runId === currentRun) currentRun = -1;
};
