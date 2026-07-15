/**
 * The EBM chess engine, in the browser.
 *
 * The model is an energy function over RESULTING positions: it never outputs a
 * move. To pick one, enumerate every legal move, encode each resulting position
 * from the mover's perspective (lib/chess-encode.ts), run the whole batch in one
 * forward, and take argmin(energy). `softmax(-energy)` is a calibrated move
 * distribution; `value` is the expected result for the mover, in [-1, 1].
 *
 * Currently 1-ply argmin. The handoff's full-strength mode is MCTS over these
 * same priors and values (~150 lines, port of pi/mcts.py) run in a Web Worker —
 * a search blocks the main thread for seconds, so it cannot live here as-is.
 *
 * chess.js owns every rule. Never hand-roll chess logic.
 */
import { Chess, type Color } from "chess.js";
import { encodeBoard, TENSOR_SIZE } from "./chess-encode";

/** The int8 build: the exact artifact that ships on the Pi, and 553KB. Verified
 *  to load and pass the handoff's known-answer vector in ort-web's WASM backend,
 *  despite its QInt16 activations. */
export const MODEL_INT8 = "/models/chess-int8.onnx";
/** Fallback if a runtime ever rejects the quantized graph. Same answers, 1.8MB. */
export const MODEL_FP32 = "/models/chess-fp32.onnx";

export type ScoredMove = {
  uci: string;
  san: string;
  /** Lower is better for the mover. Only comparable within one batch. */
  energy: number;
  /** softmax(-energy) across this batch: a calibrated move probability. */
  prior: number;
  /** Expected game result for the mover, [-1, 1]. Comparable across positions. */
  value: number;
};

export type EngineReply = {
  best: ScoredMove;
  /** Every legal move, scored, best first. Drives the candidate readout. */
  ranked: ScoredMove[];
  ms: number;
  /** Which build actually answered. */
  build: "int8" | "fp32";
};

export type ChessEngine = {
  build: "int8" | "fp32";
  bestMove(fen: string): Promise<EngineReply>;
};

let cache: Promise<ChessEngine | null> | null = null;

/** Resolves null if the weights aren't deployed — the UI gates on that. */
export function loadChessEngine(): Promise<ChessEngine | null> {
  if (cache) return cache;
  cache = (async () => {
    try {
      const head = await fetch(MODEL_INT8, { method: "HEAD" });
      if (!head.ok) return null;
    } catch {
      return null;
    }

    const ort = await import("onnxruntime-web/webgpu");
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.logLevel = "error";
    if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

    let build: "int8" | "fp32" = "int8";
    let session;
    try {
      session = await ort.InferenceSession.create(MODEL_INT8, {
        executionProviders: ["wasm"],
      });
    } catch {
      // The quantized graph was rejected. Losing the "int8" label costs nothing
      // user-visible — a wrong-answer engine would cost everything.
      build = "fp32";
      session = await ort.InferenceSession.create(MODEL_FP32, {
        executionProviders: ["wasm"],
      });
    }

    return {
      build,
      async bestMove(fen: string): Promise<EngineReply> {
        const t0 = performance.now();
        const board = new Chess(fen);
        if (board.isGameOver()) throw new Error("bestMove called on a finished game");

        // The mover: whoever is to move NOW. Every child is encoded from their
        // point of view, which is the whole perspective convention.
        const perspective: Color = board.turn();
        const moves = board.moves({ verbose: true });

        const batch = new Float32Array(moves.length * TENSOR_SIZE);
        moves.forEach((m, i) => {
          const child = new Chess(fen);
          child.move({ from: m.from, to: m.to, promotion: m.promotion });
          batch.set(encodeBoard(child, perspective), i * TENSOR_SIZE);
        });

        const out = await session.run({
          planes: new ort.Tensor("float32", batch, [moves.length, 18, 8, 8]),
        });
        const energy = out.energy.data as Float32Array;
        const value = out.value.data as Float32Array;

        // softmax(-energy), tau = 1, shifted for stability.
        let maxNeg = -Infinity;
        for (let i = 0; i < moves.length; i++) maxNeg = Math.max(maxNeg, -energy[i]);
        let z = 0;
        const exp = new Float64Array(moves.length);
        for (let i = 0; i < moves.length; i++) {
          exp[i] = Math.exp(-energy[i] - maxNeg);
          z += exp[i];
        }

        const ranked: ScoredMove[] = moves.map((m, i) => ({
          uci: m.from + m.to + (m.promotion ?? ""),
          san: m.san,
          energy: energy[i],
          prior: exp[i] / z,
          value: value[i],
        }));
        ranked.sort((a, b) => a.energy - b.energy);

        return { best: ranked[0], ranked, ms: performance.now() - t0, build };
      },
    };
  })().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
}
