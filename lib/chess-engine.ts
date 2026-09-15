/**
 * The main thread's handle on the chess engine.
 *
 * There is no model here any more, and there must not be. The session, the
 * encoder and the search all live in lib/chess-worker.ts; this file owns the
 * worker's lifetime and turns its messages back into promises. Importing
 * onnxruntime-web (24MB) from this side of the wire would put it straight back
 * into the page bundle and undo the whole point.
 *
 * The API is deliberately unchanged from the pre-worker version: `loadChessEngine()`
 * is still a memoized promise resolving null when the weights aren't deployed, so
 * lib/warm.ts still warms the engine by calling exactly this and the panel still
 * gates on null. What moved is where the work happens.
 *
 * The Pi runs the same two modes over the same numbers: argmin is one forward and
 * no search; mcts is `pi/mcts.py` over the priors and values that same forward
 * produces. See lib/chess-mcts.ts.
 */
import type { EngineBuild, EngineReply, Req, Res } from "./chess-protocol";
import { noteOffload } from "./stargaze";

export type { EngineReply, ScoredMove, EngineMode, EngineBuild } from "./chess-protocol";
export { SEARCH_MODES, DEFAULT_SEARCH, THINK_SIMS, type SearchMode } from "./chess-protocol";

/** A move or hint abandoned because stargaze mode unloaded the engine. The
 *  panel treats it as "engine idle", never as an error to show. */
export class EngineUnloaded extends Error {
  constructor() {
    super("chess engine unloaded");
    this.name = "EngineUnloaded";
  }
}

export type ChessEngine = {
  build: EngineBuild;
  /**
   * `sims` 0 is 1-ply argmin; anything higher runs that many MCTS simulations.
   * `onProgress` fires per simulation and never for argmin, which has nothing to
   * report and returns before a spinner would be honest.
   */
  move(
    fen: string,
    sims: number,
    onProgress?: (done: number, total: number) => void,
  ): Promise<EngineReply>;
  /** Abandon the running search. Its answer is about a position that has moved on. */
  cancel(): void;
  /** Stop the worker for good (stargaze offload). Every pending move rejects
   *  with EngineUnloaded, so no caller is left awaiting a dead worker. */
  terminate(): void;
};

let cache: Promise<ChessEngine | null> | null = null;

/** Resolves null if the weights aren't deployed — the UI gates on that. */
export function loadChessEngine(): Promise<ChessEngine | null> {
  if (cache) return cache;
  cache = (async () => {
    // Turbopack resolves this form at build time and emits the worker as its own
    // chunk graph, loaded via its `turbopack-worker-[client-fs]` shim. It must
    // stay a literal `new URL(..., import.meta.url)`: hand it a variable and the
    // bundler cannot see the dependency, so nothing is emitted and it 404s.
    //
    // ⚠️ RED HERRING, VERIFIED HARMLESS — don't "fix" it. `next build` ALSO drops
    // the raw, uncompiled source at `.next/static/media/chess-worker.<hash>.ts`,
    // which the dev server never produces, and serves it as `video/mp2t` (the
    // MPEG-transport-stream type for `.ts`). It looks exactly like a worker that
    // is about to be rejected on MIME type. It isn't: that file is a side effect
    // of `new URL()`'s asset semantics and is never fetched. The worker loads
    // from compiled chunks. Confirmed against a real `npm start`: engine reaches
    // "int8 · your move", zero console errors, and vector D returns g3 p=0.236.
    const worker = new Worker(new URL("./chess-worker.ts", import.meta.url), {
      type: "module",
    });

    type Pending = {
      resolve: (r: EngineReply) => void;
      reject: (e: Error) => void;
      onProgress?: (done: number, total: number) => void;
    };
    const pending = new Map<number, Pending>();
    let nextId = 1;

    const ready = new Promise<EngineBuild | null>((resolve, reject) => {
      const onFirst = (e: MessageEvent<Res>) => {
        const m = e.data;
        if (m.type === "ready") {
          worker.removeEventListener("message", onFirst);
          resolve(m.build);
        } else if (m.type === "unavailable") {
          worker.removeEventListener("message", onFirst);
          resolve(null);
        } else if (m.type === "error" && m.id === null) {
          worker.removeEventListener("message", onFirst);
          reject(new Error(m.message));
        }
      };
      worker.addEventListener("message", onFirst);
    });

    worker.addEventListener("message", (e: MessageEvent<Res>) => {
      const m = e.data;
      if (m.type === "progress") {
        pending.get(m.id)?.onProgress?.(m.done, m.total);
        return;
      }
      if (m.type === "result") {
        pending.get(m.id)?.resolve(m.reply);
        pending.delete(m.id);
        return;
      }
      if (m.type === "error" && m.id !== null) {
        pending.get(m.id)?.reject(new Error(m.message));
        pending.delete(m.id);
      }
    });

    const send = (r: Req) => worker.postMessage(r);
    send({ type: "init" });

    const build = await ready;
    if (build === null) {
      worker.terminate();
      return null;
    }

    const engine: ChessEngine = {
      build,
      move(fen: string, sims: number, onProgress?: (done: number, total: number) => void) {
        return new Promise<EngineReply>((resolve, reject) => {
          const id = nextId++;
          pending.set(id, { resolve, reject, onProgress });
          send({ type: "search", id, fen, sims });
        });
      },
      cancel() {
        send({ type: "cancel" });
      },
      terminate() {
        worker.terminate();
        for (const p of pending.values()) p.reject(new EngineUnloaded());
        pending.clear();
      },
    };
    return engine;
  })().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
}

/**
 * Stargaze offload: terminate the worker and reset the memo, so the next
 * `loadChessEngine()` starts a fresh worker (the model and runtime come back
 * from the HTTP cache). A worker's memory really does go back to the OS,
 * unlike the main thread's ORT heap (spec §5).
 */
export async function unloadChessEngine(): Promise<void> {
  const pendingLoad = cache;
  cache = null;
  if (!pendingLoad) return;
  const engine = await pendingLoad.catch(() => null);
  if (!engine) return;
  engine.terminate();
  noteOffload("chess");
}
