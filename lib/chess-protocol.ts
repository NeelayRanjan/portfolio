/**
 * The wire between ChessPanel and the engine worker.
 *
 * Its own file because both sides import it and neither should import the other:
 * pulling the worker's module into the main thread would drag onnxruntime-web
 * (24MB) back onto it, which is the entire thing the worker exists to avoid.
 * Types only, plus the difficulty table. Nothing here executes.
 */
import { copy } from "@/content/copy";

export type EngineBuild = "int8" | "fp32";

/** How the move was chosen. The UI says which, because they are different claims. */
export type EngineMode = "argmin" | "mcts";

export type ScoredMove = {
  uci: string;
  san: string;
  /** softmax(-energy) over the position's legal moves: the model's raw move
   *  distribution. Present in both modes — MCTS starts from exactly this. */
  prior: number;
  /** Expected result for the mover, [-1, 1]. */
  value: number;
  /** argmin only. Lower is better, and only comparable within one batch. */
  energy?: number;
  /** mcts only: how much of the search this move actually got. */
  visits?: number;
  /** mcts only: mean backed-up value over those visits. */
  q?: number;
};

export type EngineReply = {
  best: ScoredMove;
  /** Every legal move. Best first, by energy in argmin and by visits in mcts. */
  ranked: ScoredMove[];
  ms: number;
  build: EngineBuild;
  mode: EngineMode;
  /** 1 for argmin. The count actually run, which is what the UI may quote. */
  sims: number;
};

/**
 * ⚠️ THERE IS NO DIFFICULTY LADDER HERE, AND THAT WAS MEASURED, NOT ASSUMED.
 *
 * The handoff specced difficulty as simulation count: casual 40 / club 120 /
 * strong 250 / max 400. Every one of those tiers was built, then deleted. Two
 * measurements killed them, and both need re-running before anyone rebuilds it:
 *
 * 1. **What a simulation costs here.** MCTS spends exactly one batched forward
 *    per simulation, over the expanded node's legal moves. In ort-web's WASM
 *    backend that batch costs ~6.6ms PER BOARD — flat from batch 8 to batch 256,
 *    so there is no batching win — and threads do nothing (1 thread ≈ 16 threads;
 *    the net is too small to parallelize). At ~35 legal moves that is ~230ms a
 *    simulation, hard floor. The Pi's 500 sims is ~2 minutes a move in a browser.
 *
 * 2. **What a simulation BUYS.** Measured with the reference search itself
 *    (`pi/mcts.py` + the int8 model), scoring each chosen move's centipawn loss
 *    against Stockfish depth 12 over on-distribution positions.
 *
 *    Shallow, 24 positions — the tiers as specced:
 *
 *        sims      mean cp   median   agrees with SF
 *        argmin      438.6     16.5       11/24
 *        16          438.3     16.5       11/24
 *        48          438.3     16.5       11/24
 *        96          438.3     16.5       11/24
 *
 *    16, 48 and 96 sims pick the SAME MOVE as 1-ply argmin in 23 of 24 positions.
 *    They are not weaker or stronger; they are the same engine, 3-20 seconds
 *    slower. Shipping them as tiers would be three buttons wired to nothing —
 *    the exact failure the editable-params rule exists to prevent, on a page
 *    whose whole claim is that the demos are real.
 *
 *    Deep, 30 positions — where it actually starts paying:
 *
 *        sims      mean cp   median   agrees with SF
 *        argmin      361.2      8.5       15/30
 *        150         350.6      7.0       17/30
 *        250         349.1      6.5       18/30
 *        400         351.8      7.0       18/30
 *        500          34.9      7.5       18/30
 *
 *    Hence 250. It has the best median and ties the best agreement, at half the
 *    wait of 500. 150 is NOT a cheaper version of it — it flips one position from
 *    44cp to 47cp, i.e. it is inside the noise.
 *
 *    ⚠️ DO NOT READ THAT 34.9 AS "500 IS TEN TIMES BETTER". It is one position:
 *    500 was the only setting to find a mate that every other setting walked into
 *    (9551cp -> 34cp), and 9551/30 ≈ 318 is the entire drop in the mean. The
 *    median moved the wrong way. What it does say is real and worth knowing: deep
 *    search buys blunder-avoidance, not everyday accuracy, which is exactly the
 *    shape you would expect and exactly why the ladder ran 500.
 *
 * The model is a strong POLICY: its raw prior is already median ~8cp off
 * Stockfish depth 12. That is why search adds so little so slowly — there is not
 * much left for it to fix except the tail, and the tail is where depth lives.
 *
 * So it ships as a toggle: `1 ply` (default) and `let it think`, whose budget is
 * editable via `--sims` over the range where the number is real. See THINK_SIMS.
 */
export type SearchMode = {
  id: string;
  label: string;
  sims: number;
  /** What the UI promises. Measured in Firefox, not projected from the Pi. */
  about: string;
};

// Labels/about text live in content/copy.ts; id and sims are logic and stay here.
// (The worker imports only TYPES from this module, so copy never reaches its bundle.)
export const SEARCH_MODES: SearchMode[] = [
  { id: "ply1", label: copy.chess.search.ply1Label, sims: 0, about: copy.chess.search.ply1About },
  { id: "think", label: copy.chess.search.thinkLabel, sims: 250, about: copy.chess.search.thinkAbout },
];

/** 1 ply. A visitor must never land on a mode that takes a minute to answer. */
export const DEFAULT_SEARCH = "ply1";

/**
 * The editable budget for `let it think`, via `--sims` on the command line.
 *
 * ⚠️ THE FLOOR IS THE MEASUREMENT, NOT A TASTE CALL — do not lower it. Below ~250
 * simulations the search returns the SAME MOVE as 1-ply argmin (23 of 24 positions
 * at 96 sims and below; see the tables above), so a 100-sim setting would spend 23
 * seconds to reproduce something the toggle already offers instantly. Clamping to
 * 250 is what keeps this control honest: every value it accepts is a search that
 * actually searches. The clamp IS the finding.
 *
 * The ceiling is the ladder's setting. 500 is what measured ~2330 Elo and the only
 * count that found a mate the others walked into, so it is the most this can claim
 * without leaving measured ground. It costs ~2 minutes a move here.
 *
 * Step 50: 250 / 300 / 350 / 400 / 450 / 500. Finer than that is noise — 250 vs
 * 260 does not reliably change anything.
 */
export const THINK_SIMS = { min: 250, max: 500, step: 50, default: 250 } as const;

/** main -> worker */
export type Req =
  | { type: "init" }
  | { type: "search"; id: number; fen: string; sims: number }
  /** Abandon whatever is running. The board moved on; its answer is now about a
   *  position that no longer exists. */
  | { type: "cancel" };

/** worker -> main */
export type Res =
  | { type: "ready"; build: EngineBuild }
  /** The weights are not deployed. The UI gates on this rather than faking. */
  | { type: "unavailable" }
  | { type: "progress"; id: number; done: number; total: number }
  | { type: "result"; id: number; reply: EngineReply }
  | { type: "error"; id: number | null; message: string };
