/**
 * AlphaZero-lite MCTS over an injected evaluator.
 *
 * A port of `pi/mcts.py` from the entropy-chess repo, and it must stay one: the
 * ~2330 Elo on the ladder was measured with THIS search at 500 sims, so a
 * "reasonable improvement" here is an unvalidated engine wearing a validated
 * number. The port is line-for-line deliberate. See the traps below.
 *
 * Perspective convention (matches lib/chess-encode.ts and training/encoding.py):
 * a position s' is always evaluated from the perspective of the player who just
 * MOVED INTO it. The evaluator is handed the board being expanded and returns,
 * for all of its legal children in ONE batched forward:
 *
 *     { moves, priors, values } = await evaluate(fen)
 *
 *   - priors: softmax(-E/tau) over the children, the mover's move distribution
 *   - values: v(s') in [-1, 1], "how good is s' for the player who moved into it"
 *
 * Because both fall out of the same pass, each simulation costs exactly one
 * evaluator call, at expansion: a node's own value is already known from its
 * parent's expansion. That is why `expand()` returns the node's EXISTING value
 * rather than computing one, which reads like a bug and is not.
 *
 * Backups flip sign every ply, since the mover alternates.
 *
 * REPETITION BLINDNESS IS INHERITED ON PURPOSE. Nodes hold a FEN and nothing
 * else, so threefold and fifty-move are invisible inside the search, exactly as
 * `copy(stack=False)` makes them invisible on the Pi. This is the engine's known
 * ceiling (it donated 10 of 20 draws vs SF-2500 this way). Game-level draw claims
 * are the caller's job, and ChessPanel already owns them.
 */
import { Chess } from "chess.js";

export type Evaluation = {
  /** UCI, aligned index-for-index with `priors`, `values` and `sans`. */
  moves: string[];
  sans: string[];
  priors: ArrayLike<number>;
  values: ArrayLike<number>;
};

export type Evaluator = (fen: string) => Promise<Evaluation>;

export type MoveStats = {
  uci: string;
  san: string;
  visits: number;
  prior: number;
  /** Mean backed-up value, from the perspective of the player making this move. */
  q: number;
  /** The model's raw v(s') for this move, straight off the root expansion.
   *  A port addition — the reference has no UI to feed. It costs nothing (the
   *  node already carries it) and the search never reads it back. */
  value: number;
};

export type SearchResult = {
  best: MoveStats;
  /** Every root move, most-visited first. */
  stats: MoveStats[];
  simulations: number;
};

/** The reference's `c_puct`. Do not tune: the ladder ran at 1.5. */
export const C_PUCT = 1.5;

/**
 * python-chess's `board.outcome(claim_draw=False)`, and ONLY that.
 *
 * ⚠️ Do NOT reach for chess.js's `isDraw()` or `isGameOver()` here. Those fire on
 * the FIFTY-move rule (halfmove >= 100); python-chess without a draw claim only
 * ends at SEVENTY-FIVE (>= 150). Using chess.js's notion would score positions as
 * dead draws that the reference still hands to the model, which silently changes
 * the search in exactly the long endgames this engine is already weakest in.
 *
 * Fivefold repetition is the reference's other no-claim terminal, and it is
 * unreachable here for the same reason it is unreachable there: no history.
 *
 * Returns the value from the perspective of the player who MOVED INTO `fen`, or
 * null if the position is live. Mate = +1 for them (you cannot move into your own
 * checkmate); every draw = 0.
 */
function terminalValue(fen: string): number | null {
  const g = new Chess(fen);
  if (g.isCheckmate()) return 1;
  if (g.isInsufficientMaterial()) return 0;
  if (g.isStalemate()) return 0;
  const halfmove = Number(fen.split(" ")[4]);
  if (Number.isFinite(halfmove) && halfmove >= 150) return 0;
  return null;
}

/** "e7e8q" -> the object chess.js wants. */
function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

/**
 * Stats live on the node an edge leads INTO: `prior` and `value` describe the
 * move that reaches this position, both from that mover's perspective.
 */
class Node {
  visits = 0;
  totalValue = 0;
  /** null = unexpanded. An empty map = expanded and terminal. */
  children: Map<string, Node> | null = null;

  constructor(
    readonly fen: string,
    readonly prior: number,
    public value: number,
    readonly uci: string = "",
    readonly san: string = "",
  ) {}

  get q(): number {
    return this.visits ? this.totalValue / this.visits : 0;
  }
}

export class MCTS {
  constructor(
    private readonly evaluate: Evaluator,
    private readonly simulations = 200,
    private readonly cPuct = C_PUCT,
  ) {}

  /**
   * `onProgress` and `shouldAbort` are port additions: the Pi has nobody waiting
   * on a spinner, and nothing that can take the board away mid-think. An abort
   * stops between simulations and returns what the tree knows so far, which is
   * still a legal, correctly-ranked answer — just a shallower one. `simulations`
   * in the result is what actually ran, never what was asked for.
   */
  async search(
    fen: string,
    opts: {
      onProgress?: (done: number, total: number) => void;
      shouldAbort?: () => boolean;
    } = {},
  ): Promise<SearchResult> {
    if (terminalValue(fen) !== null) {
      throw new Error(`cannot search a terminal position: ${fen}`);
    }
    const root = new Node(fen, 1, 0);
    await this.expand(root);

    let ran = 0;
    for (let i = 0; i < this.simulations; i++) {
      if (opts.shouldAbort?.()) break;
      await this.simulate(root);
      ran += 1;
      opts.onProgress?.(ran, this.simulations);
    }

    const stats: MoveStats[] = [...root.children!.values()].map((c) => ({
      uci: c.uci,
      san: c.san,
      visits: c.visits,
      prior: c.prior,
      q: c.q,
      value: c.value,
    }));
    // The reference's exact key: visits, then q, then prior, all descending.
    stats.sort((a, b) => b.visits - a.visits || b.q - a.q || b.prior - a.prior);

    return { best: stats[0], stats, simulations: ran };
  }

  private async simulate(root: Node): Promise<void> {
    const path: Node[] = [root];
    let node = root;
    // Descend through expanded, non-terminal nodes. Python's `while node.children:`
    // is falsy for BOTH None (unexpanded) and {} (terminal), so both exit here.
    while (node.children && node.children.size > 0) {
      node = this.select(node);
      path.push(node);
    }

    const value =
      node.children === null
        ? await this.expand(node) // returns the node's own value, from its parent
        : node.value; // terminal, revisited: exact

    // `value` is from the perspective of the mover into path[-1]. The mover
    // alternates every ply, so the sign flips on the way up.
    let sign = 1;
    for (let i = path.length - 1; i >= 0; i--) {
      path[i].visits += 1;
      path[i].totalValue += sign * value;
      sign = -sign;
    }
  }

  private select(node: Node): Node {
    const sqrtParent = Math.sqrt(node.visits + 1);
    let best: Node | null = null;
    let bestScore = -Infinity;
    // Strict `>` keeps the first maximum, matching Python's max().
    for (const child of node.children!.values()) {
      const score = child.q + this.cPuct * child.prior * sqrtParent / (1 + child.visits);
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }
    return best!;
  }

  /** Creates children (or marks terminal) and returns the node's OWN value. */
  private async expand(node: Node): Promise<number> {
    const term = terminalValue(node.fen);
    if (term !== null) {
      // Exact, and it overwrites the model's estimate for this node on purpose.
      node.value = term;
      node.children = new Map();
      return node.value;
    }

    const { moves, sans, priors, values } = await this.evaluate(node.fen);
    node.children = new Map();
    for (let i = 0; i < moves.length; i++) {
      const child = new Chess(node.fen);
      child.move(uciToMove(moves[i]));
      node.children.set(
        moves[i],
        new Node(child.fen(), priors[i], values[i], moves[i], sans[i]),
      );
    }
    // NOT recomputed: this node's value came from its parent's expansion. The
    // root's is 0 and its caller discards it.
    return node.value;
  }
}
