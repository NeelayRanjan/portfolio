/**
 * Self-play's one departure from argmin (owner's idea, 2026-09-17).
 *
 * The engine is fully deterministic: no randomness anywhere in the chess path,
 * so engine-vs-engine from the start position played the same 41-move game on
 * every press, move for move. Real model output that looks like a recording.
 * The owner's fix: a couple of times a game, when the second or third choice
 * is nearly tied with the first, sometimes take it. Every move played is still
 * one of the model's own top three, from its own distribution
 * (softmax(-energy), `ScoredMove.prior`), so nothing here invents a move.
 *
 * SCOPE, and why: self-play at ONE PLY only. Against a visitor the engine
 * plays its best move (varying it would weaken the engine on purpose and bend
 * the measured strength claim), the hint is always the best move (a hint is a
 * claim about what this engine would play), and at "let it think" the move is
 * the search's, which is what that mode promises.
 *
 * MEASURED, 2026-09-17, in node against the served int8 model, the worker's
 * exact scoring path, 12 presses per rule:
 *
 *   rule                                       distinct   mates   median plies
 *   argmin (before)                            1 of 12    -       81 (1 game)
 *   this rule                                  9 of 12    10/12   95
 *   first deviation forced into the opening    7 of 12    9/12    99
 *
 * The third row is why the coin is flat across the whole game: biasing the
 * first departure early made nearly every game take the SAME alternative first
 * move, so they all opened alike. prior[1]/prior[0] over a full game: median
 * 0.40, p90 0.91; at 0.8 about one position in six qualifies (~13 a game), so
 * a budget of two always has room.
 *
 * No imports, so scripts/test-chess-selfplay.mjs pins it in plain node.
 */

/** The runner-up must be at least this fraction of the top move's prior. */
export const SELF_PLAY_TIE_RATIO = 0.8;
/** Departures per game, at most. The panel owns the count. */
export const SELF_PLAY_MAX_DEVIATIONS = 2;
/** At a qualifying position, the chance of taking the runner-up. */
export const SELF_PLAY_TAKE_P = 0.5;
/** Candidates considered: the top move and the next two. */
export const SELF_PLAY_TOP_K = 3;

export type RankedPrior = { uci: string; prior: number };

/** `index` into the ranked list (0 = the top move); `ratio` is that move's
 *  prior over the top move's, 1 when the top move is played. */
export type SelfPlayPick = { index: number; ratio: number };

/** The same generator the repo seeds its other deterministic shapes with. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which of `ranked` (best first, the worker's order) self-play plays, given
 * `left` departures remaining this game. Draws from `rand` ONLY at a position
 * that qualifies, so a seed's sequence is spent on near-ties and nothing else.
 */
export function pickSelfPlayMove(
  ranked: readonly RankedPrior[],
  left: number,
  rand: () => number,
): SelfPlayPick {
  if (left <= 0 || ranked.length < 2) return { index: 0, ratio: 1 };
  const top = ranked[0].prior;
  const alts: number[] = [];
  for (let i = 1; i < Math.min(SELF_PLAY_TOP_K, ranked.length); i++) {
    if (ranked[i].prior / top >= SELF_PLAY_TIE_RATIO) alts.push(i);
  }
  if (alts.length === 0 || rand() >= SELF_PLAY_TAKE_P) return { index: 0, ratio: 1 };
  const index = alts[Math.floor(rand() * alts.length)];
  return { index, ratio: ranked[index].prior / top };
}
