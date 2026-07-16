/// <reference lib="webworker" />
/**
 * The chess engine's whole runtime, off the main thread.
 *
 * WHY THIS EXISTS. One forward over a position's legal moves costs ~130-175ms in
 * ort-web's WASM backend, and MCTS spends one per simulation. Even a modest 48
 * simulations is ~7s of solid compute; on the main thread that is 7 seconds of
 * frozen page — no scroll, no CharField, no cursor. The search cannot live there.
 *
 * The session moved here with it, rather than staying on the main thread and
 * shipping tensors across. That is the point: `postMessage` per simulation would
 * hand 30 encoded boards (~2MB) back and forth 48 times, and the ~1s of session
 * creation would still land on the main thread during the hero. Now the ONLY
 * things crossing the wire are a FEN going in and a ranked move list coming out.
 *
 * onnxruntime-web is imported HERE and nowhere else on the main thread's graph.
 * Importing it from a component would pull 24MB back into the page bundle and
 * undo all of the above. See lib/chess-protocol.ts.
 */
import { Chess, type Color } from "chess.js";
import { encodeBoard, TENSOR_SIZE } from "./chess-encode";
import { MCTS, type Evaluation } from "./chess-mcts";
import type { EngineBuild, Req, Res, ScoredMove } from "./chess-protocol";

/** The int8 build: the exact artifact that ships on the Pi, and 553KB. Verified
 *  to load and pass the handoff's known-answer vector in ort-web's WASM backend,
 *  despite its QInt16 activations. */
const MODEL_INT8 = "/models/chess-int8.onnx";
/** Fallback if a runtime ever rejects the quantized graph. Same answers, 1.8MB. */
const MODEL_FP32 = "/models/chess-fp32.onnx";

type Ort = typeof import("onnxruntime-web/webgpu");

let ort: Ort | null = null;
let session: import("onnxruntime-web/webgpu").InferenceSession | null = null;
let build: EngineBuild = "int8";

/** Set by a `cancel`, read between simulations. The board moved on. */
let cancelled = false;

const post = (m: Res) => (self as unknown as Worker).postMessage(m);

async function init(): Promise<void> {
  try {
    const head = await fetch(MODEL_INT8, { method: "HEAD" });
    if (!head.ok) {
      post({ type: "unavailable" });
      return;
    }
  } catch {
    post({ type: "unavailable" });
    return;
  }

  ort = await import("onnxruntime-web/webgpu");
  ort.env.wasm.wasmPaths = "/ort/";
  ort.env.logLevel = "error";
  // Cross-origin isolation is what buys multi-threaded WASM (see next.config.ts).
  // It is reported on WorkerGlobalScope too, so this check works in here.
  if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

  try {
    session = await ort.InferenceSession.create(MODEL_INT8, { executionProviders: ["wasm"] });
  } catch {
    // The quantized graph was rejected. Losing the "int8" label costs nothing
    // user-visible — a wrong-answer engine would cost everything.
    build = "fp32";
    session = await ort.InferenceSession.create(MODEL_FP32, { executionProviders: ["wasm"] });
  }
  post({ type: "ready", build });
}

/**
 * Score every legal move from `fen` in ONE batched forward.
 *
 * This is the engine's only model call, and both modes go through it: argmin
 * reads `energy` straight off it, and MCTS uses it as the evaluator at every
 * expansion. The perspective convention is the encoder's (lib/chess-encode.ts):
 * every child is encoded from the point of view of whoever is to move NOW, which
 * is why "its move" and "your move" are one computation and `hint` needed no
 * second code path.
 *
 * ⚠️ TWO MEASURED FACTS THAT KILL THE TWO OBVIOUS OPTIMIZATIONS. Both were
 * benchmarked in Firefox against this exact model; both contradict a reasonable
 * guess, so re-measure before believing otherwise.
 *
 * 1. **The cost is per-BOARD, not per-call.** ~6.6ms/board, flat from batch 8 to
 *    batch 256 (batch 8 = 60ms, 32 = 208ms, 256 = 1683ms). Fixed overhead is only
 *    ~15ms. So batching several MCTS leaves into one forward — virtual loss, leaf
 *    parallelism, the standard trick — buys NOTHING here: 8 leaves in one call
 *    costs the same 8x. The batch below is wide only because a position's legal
 *    moves must all be scored anyway.
 * 2. **Threads do nothing.** 1 thread and 16 threads both land at ~6.5ms/board on
 *    a 20-core machine (ORT defaults to 4). The net is 469K params over 8x8, which
 *    is too small for intra-op parallelism to pay for itself. Raising numThreads
 *    is not a lever, and neither is cross-origin isolation *for this model* —
 *    though the draw demo still needs it, so leave the headers alone.
 *
 * That leaves ~6.6ms x (legal moves) per simulation, i.e. ~130-260ms, and no way
 * to buy it down short of a smaller model or a different backend. It is why the
 * difficulty tiers in chess-protocol.ts look nothing like the Pi's.
 */
async function scoreChildren(fen: string) {
  const board = new Chess(fen);
  const perspective: Color = board.turn();
  const moves = board.moves({ verbose: true });

  const batch = new Float32Array(moves.length * TENSOR_SIZE);
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const child = new Chess(fen);
    child.move({ from: m.from, to: m.to, promotion: m.promotion });
    encodeBoard(child, perspective, batch.subarray(i * TENSOR_SIZE, (i + 1) * TENSOR_SIZE));
  }

  const out = await session!.run({
    planes: new ort!.Tensor("float32", batch, [moves.length, 18, 8, 8]),
  });
  const energy = out.energy.data as Float32Array;
  const values = out.value.data as Float32Array;

  // softmax(-energy), tau = 1, shifted for stability.
  let maxNeg = -Infinity;
  for (let i = 0; i < moves.length; i++) maxNeg = Math.max(maxNeg, -energy[i]);
  let z = 0;
  const exp = new Float64Array(moves.length);
  for (let i = 0; i < moves.length; i++) {
    exp[i] = Math.exp(-energy[i] - maxNeg);
    z += exp[i];
  }
  const priors = new Float64Array(moves.length);
  for (let i = 0; i < moves.length; i++) priors[i] = exp[i] / z;

  return {
    moves: moves.map((m) => m.from + m.to + (m.promotion ?? "")),
    sans: moves.map((m) => m.san),
    priors,
    values,
    energy,
  };
}

/** 1-ply argmin: the shipped behaviour, and the floor of the difficulty list. */
async function argmin(fen: string): Promise<ScoredMove[]> {
  const s = await scoreChildren(fen);
  const ranked: ScoredMove[] = s.moves.map((uci, i) => ({
    uci,
    san: s.sans[i],
    energy: s.energy[i],
    prior: s.priors[i],
    value: s.values[i],
  }));
  ranked.sort((a, b) => a.energy! - b.energy!);
  return ranked;
}

async function runSearch(id: number, fen: string, sims: number): Promise<void> {
  const t0 = performance.now();

  if (sims <= 0) {
    const ranked = await argmin(fen);
    post({
      type: "result",
      id,
      reply: { best: ranked[0], ranked, ms: performance.now() - t0, build, mode: "argmin", sims: 1 },
    });
    return;
  }

  const evaluate = async (f: string): Promise<Evaluation> => {
    const s = await scoreChildren(f);
    return { moves: s.moves, sans: s.sans, priors: s.priors, values: s.values };
  };

  const mcts = new MCTS(evaluate, sims);
  const result = await mcts.search(fen, {
    onProgress: (done, total) => post({ type: "progress", id, done, total }),
    shouldAbort: () => cancelled,
  });
  if (cancelled) return;

  // prior and value here are the root expansion's, which is the same data argmin
  // reports — so the UI can show p= and v= in both modes.
  const ranked: ScoredMove[] = result.stats.map((s) => ({
    uci: s.uci,
    san: s.san,
    prior: s.prior,
    value: s.value,
    visits: s.visits,
    q: s.q,
  }));

  post({
    type: "result",
    id,
    reply: {
      best: ranked[0],
      ranked,
      ms: performance.now() - t0,
      build,
      mode: "mcts",
      sims: result.simulations,
    },
  });
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await init();
    } catch (err) {
      post({ type: "error", id: null, message: (err as Error).message });
    }
    return;
  }

  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }

  if (msg.type === "search") {
    cancelled = false;
    try {
      await runSearch(msg.id, msg.fen, msg.sims);
    } catch (err) {
      post({ type: "error", id: msg.id, message: (err as Error).message });
    }
  }
};
