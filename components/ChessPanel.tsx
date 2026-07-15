"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { TerminalPanel } from "./TerminalPanel";
import { ChessBoard } from "./ChessBoard";
import { ChessActivations } from "./ChessActivations";
import { BootLog, useBootSequence } from "./ambience/BootLog";
import { loadChessEngine, type ChessEngine, type ScoredMove } from "@/lib/chess-engine";
import { loadChessActivations, type ActivationSet } from "@/lib/chess-activations";

const BOOT_CMD = "./entropy_chess --model int8 --mode argmin";
const BOOT_LINES = [
  "energy-based model · 469K params · scores positions, never outputs a move",
  "int8 quantized to 553 KB · the same artifact that runs on the Pi",
  "onnxruntime-web (wasm) · chess.js owns every rule -> ready",
];

/** Pause between self-play moves. The engine answers in ~140ms, which is far too
 *  fast to watch — this is pacing, not compute. */
const SELF_PLAY_MS = 750;

/** Promotion needs a piece and chess.js will not guess one. */
const PROMOTIONS = ["q", "r", "b", "n"] as const;
const PROMO_GLYPH: Record<string, string> = { q: "♛", r: "♜", b: "♝", n: "♞" };

type Pending = { from: Square; to: Square };

/** "e4" -> 36. Rank-8-first row-major, matching ChessBoard's overlay indexing
 *  and the activation export's ordering. */
const squareToIndex = (sq: string) =>
  (8 - Number(sq[1])) * 8 + (sq.charCodeAt(0) - 97);

/**
 * The engine's move distribution, as a board heatmap.
 *
 * Costs nothing: `softmax(-energy)` over every legal move already comes back from
 * the same forward pass that picks the move, and was otherwise thrown away after
 * the top-3 list. Several moves can land on one square (two pieces, a promotion
 * fan), so priors are summed per destination — the question is "how much does it
 * want something HERE", not "which piece".
 *
 * Normalized by the max, so the hottest square reads 1.0 regardless of how the
 * mass is spread. It is a move preference, NOT an activation — don't let the
 * copy blur those.
 */
function moveMap(ranked: ScoredMove[]): number[] {
  const out = new Array(64).fill(0);
  for (const m of ranked) out[squareToIndex(m.uci.slice(2, 4))] += m.prior;
  const max = Math.max(...out);
  return max > 0 ? out.map((v) => v / max) : out;
}

/** From-square dimmer than the to-square, so the hint reads as a direction
 *  rather than as two unrelated hot squares. */
const HINT_FROM_ALPHA = 0.4;

/** The suggested move as a two-square overlay. Indigo (`saliency`) on purpose:
 *  teal already means "the engine's own move map" on this board, and a hint is a
 *  different claim. One tint, one meaning. */
function hintMap(m: ScoredMove): number[] {
  const out = new Array(64).fill(0);
  out[squareToIndex(m.uci.slice(0, 2))] = HINT_FROM_ALPHA;
  out[squareToIndex(m.uci.slice(2, 4))] = 1;
  return out;
}

export function ChessPanel() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [engine, setEngine] = useState<ChessEngine | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const [lastReply, setLastReply] = useState<{ ranked: ScoredMove[]; ms: number } | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Pending | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** Null until the activation export lands — the toggle is gated on it. */
  const [acts, setActs] = useState<ActivationSet | null>(null);
  const [view, setView] = useState<"game" | "activations">("game");
  /** Paint the engine's move distribution on the live board. On by default: it's
   *  free, and watching where it wants to go is the point of playing it. */
  const [showMap, setShowMap] = useState(true);
  /** Engine plays both sides. Its own documented weakness shows up fast here:
   *  with no move history in the search it shuffles in won endgames, so games
   *  tend to end in the threefold the panel detects. That's honest, and it's the
   *  clearest possible demo of why the site has to own draw detection. */
  const [selfPlay, setSelfPlay] = useState(false);
  /** The engine's suggestion for YOUR move, on demand. Not automatic: a hint
   *  standing on every turn stops being a game and starts being a solver. */
  const [hint, setHint] = useState<ScoredMove | null>(null);
  const [hinting, setHinting] = useState(false);

  const boot = useBootSequence(BOOT_CMD, BOOT_LINES);
  const booted = boot.done;

  // 553KB + the wasm runtime. Lazy: only once the panel has actually booted.
  useEffect(() => {
    if (!booted) return;
    setLoading(true);
    loadChessEngine()
      .then(setEngine)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
    // Resolves null while chess_activations.json isn't deployed, which hides the
    // toggle. Nothing here is fabricated: a plausible fake heatmap would teach
    // the wrong thing about what the model sees.
    loadChessActivations()
      .then(setActs)
      .catch(() => setActs(null));
  }, [booted]);

  const game = gameRef.current;
  const sync = useCallback(() => setFen(gameRef.current.fen()), []);

  /**
   * Game-level draws the engine structurally cannot see.
   *
   * Search nodes drop move history, so the model has no idea a position has
   * repeated. Left to itself it shuffles in won endgames — it donated 10 of 20
   * draws against SF-2500 exactly this way. chess.js has the history, so the
   * site is the only thing that can call these.
   */
  const outcome = useMemo(() => {
    const g = new Chess(fen);
    if (g.isCheckmate()) return `checkmate · ${g.turn() === "w" ? "black" : "white"} wins`;
    if (g.isStalemate()) return "draw · stalemate";
    if (g.isThreefoldRepetition()) return "draw · threefold repetition";
    if (g.isInsufficientMaterial()) return "draw · insufficient material";
    if (g.isDraw()) return "draw · fifty-move rule";
    return null;
  }, [fen]);

  const engineMove = useCallback(async () => {
    const g = gameRef.current;
    if (!engine || g.isGameOver()) return;
    setThinking(true);
    try {
      const reply = await engine.bestMove(g.fen());
      g.move(reply.best.san);
      // Keep every move: the top 3 feeds the list, the whole set feeds the map.
      setLastReply({ ranked: reply.ranked, ms: reply.ms });
      sync();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setThinking(false);
    }
  }, [engine, sync]);

  /**
   * What the engine would play from where you're sitting.
   *
   * The same call it makes for itself, not a second code path: the encoder always
   * builds from the perspective of the side to move (see lib/chess-encode.ts), so
   * "its move" and "your move" are one computation and this needed no model work
   * at all. It carries the same 1-ply caveat as everything else here.
   */
  const askHint = useCallback(async () => {
    const g = gameRef.current;
    // Never call the engine on a finished position.
    if (!engine || g.isGameOver() || thinking || g.turn() !== "w") return;
    setHinting(true);
    try {
      const reply = await engine.bestMove(g.fen());
      setHint(reply.best);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setHinting(false);
    }
  }, [engine, thinking]);

  // A hint describes one position. The moment the board moves it is a claim
  // about a position that no longer exists, so it goes.
  useEffect(() => {
    setHint(null);
  }, [fen]);

  // The engine answers when it's its turn: black in a normal game, both sides in
  // self-play. Keyed on fen, so each new position triggers exactly one reply and
  // self-play loops by feeding its own output back in.
  useEffect(() => {
    const g = gameRef.current;
    if (!engine || thinking || g.isGameOver()) return;
    if (!selfPlay && g.turn() !== "b") return;
    let cancelled = false;
    const t = window.setTimeout(
      () => {
        if (!cancelled) void engineMove();
      },
      selfPlay ? SELF_PLAY_MS : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, engine, selfPlay]);

  const legalFrom = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(
      new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to),
    );
  }, [selected, fen]);

  const play = (from: Square, to: Square, promotion?: string) => {
    const g = gameRef.current;
    try {
      g.move({ from, to, promotion });
    } catch {
      setFlash("illegal move");
      setTimeout(() => setFlash(null), 1200);
      return;
    }
    setSelected(null);
    setPendingPromo(null);
    sync();
  };

  const onSquare = (square: Square) => {
    const g = gameRef.current;
    if (selfPlay || g.isGameOver() || thinking || g.turn() !== "w") return;

    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      const candidate = g
        .moves({ square: selected, verbose: true })
        .find((m) => m.to === square);
      if (candidate) {
        // Promotion needs a piece, and chess.js will not guess one for us.
        if (candidate.flags.includes("p")) setPendingPromo({ from: selected, to: square });
        else play(selected, square);
        return;
      }
    }
    const piece = g.get(square);
    if (piece && piece.color === "w") setSelected(square);
    else setSelected(null);
  };

  const reset = () => {
    gameRef.current = new Chess();
    setSelfPlay(false);
    setSelected(null);
    setPendingPromo(null);
    setLastReply(null);
    sync();
  };

  const undo = () => {
    const g = gameRef.current;
    if (thinking) return;
    g.undo(); // engine's reply
    g.undo(); // your move
    setSelected(null);
    setLastReply(null);
    sync();
  };

  const ready = engine !== null;
  const status = !booted
    ? "booting"
    : loading
      ? "loading 553 KB…"
      : thinking
        ? "thinking…"
        : outcome
          ? "game over"
          : ready
            ? selfPlay
              ? `${engine.build} · self-play · move ${Math.ceil(game.history().length / 2) || 1}`
              : `${engine.build} · ${game.turn() === "w" ? "your move" : "…"}`
            : "engine pending";

  return (
    <div ref={boot.ref}>
      <TerminalPanel
        label="entropy-chess --engine ebm --sims 1"
        status={status}
        notice={
          booted && err ? (
            <>
              <span className="text-indigo">engine error</span>: {err}
            </>
          ) : null
        }
      >
        <BootLog typed={boot.typed} printed={boot.printed} done={booted} />

        {!booted ? null : (
          <>
            {/* Gated on the export existing. No data -> no toggle, rather than a
                disabled control advertising something that may never land. */}
            {acts ? (
              <div className="mt-6 mb-4 flex flex-wrap gap-2">
                {(["game", "activations"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={v === view}
                    className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
                      v === view
                        ? "border-indigo text-indigo"
                        : "border-line text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {v === "game" ? "game" : "what it saw"}
                  </button>
                ))}
              </div>
            ) : null}

            <h2 className="mt-6 mb-2 text-2xl tracking-tight">Play the engine</h2>
            <p className="mb-8 max-w-2xl leading-relaxed text-muted">
              A 469K-parameter convolutional energy-based model. It scores resulting
              positions rather than proposing moves: every legal move is played out, the
              whole batch is ranked in one forward pass, and the lowest-energy position
              wins. Trained on ~30M positions from Lichess games where both players were
              rated 1800+, then quantized to 553 KB for a Raspberry Pi Zero 2 W with a
              3.5&quot; touchscreen. Strength is roughly 2000&ndash;2300 against
              Stockfish&rsquo;s limited modes. Quantization cost about nothing. This is
              that same int8 file, running in your browser.
            </p>

            {acts && view === "activations" ? (
              <>
                <p className="mb-8 max-w-2xl leading-relaxed text-muted">
                  The model&rsquo;s evaluation, laid back onto the board, and computed on
                  your device. This works here and not on the diffusion models for a
                  structural reason: the chess backbone never downsamples below 8x8, so
                  every layer stays registered to the squares and can be read as a
                  position. A UNet&rsquo;s middle layers have no such luxury.
                </p>
                <ChessActivations data={acts} />
              </>
            ) : (
              <div className="flex flex-wrap items-start gap-8">
              <div>
                <ChessBoard
                  fen={fen}
                  selected={selected}
                  targets={legalFrom}
                  onSquare={onSquare}
                  // A hint outranks the move map: two overlays at once would be
                  // two different claims in two colours on one board.
                  overlay={
                    hint
                      ? { values: hintMap(hint), tint: "saliency" }
                      : showMap && lastReply
                        ? { values: moveMap(lastReply.ranked), tint: "activation" }
                        : null
                  }
                />

                <p className="mt-3 w-[296px] font-mono text-[11px] leading-relaxed text-faint">
                  {outcome ? (
                    <span className="text-teal">{outcome}</span>
                  ) : flash ? (
                    <span className="text-indigo">{flash}</span>
                  ) : game.isCheck() ? (
                    <span className="text-indigo">check</span>
                  ) : hint ? (
                    <>
                      <span className="text-indigo">it would play {hint.san}</span> · p=
                      {hint.prior.toFixed(3)} · v={hint.value.toFixed(2)}
                    </>
                  ) : showMap && lastReply ? (
                    <>
                      <span className="text-teal">its move map</span> · where the engine
                      wanted to go, brightest = most wanted
                    </>
                  ) : selfPlay ? (
                    <span className="text-teal">engine vs engine · it plays both sides</span>
                  ) : (
                    "you are white · click a piece, then a square"
                  )}
                </p>

                <button
                  onClick={() => setShowMap((v) => !v)}
                  aria-pressed={showMap}
                  className={`mt-3 rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
                    showMap
                      ? "border-teal text-teal"
                      : "border-line text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  move map
                </button>

                {/* The map is a move preference, not an activation. Saying "its
                    ranking" keeps it distinct from the "what it saw" view, which
                    shows internals. */}
                <p className="mt-2 w-[296px] font-mono text-[11px] leading-relaxed text-faint">
                  Its ranking of every legal reply, summed onto the square each one
                  lands on. Free: it comes from the same pass that picked its move.
                </p>
              </div>

              <div className="min-w-[220px] flex-1">
                {pendingPromo ? (
                  <div className="mb-6">
                    <span className="font-mono text-xs text-faint">promote to</span>
                    <div className="mt-2 flex gap-2">
                      {PROMOTIONS.map((p) => (
                        <button
                          key={p}
                          onClick={() => play(pendingPromo.from, pendingPromo.to, p)}
                          className="flex size-10 items-center justify-center rounded border border-line text-[22px] text-ink transition-colors hover:border-teal hover:text-teal"
                          aria-label={`promote to ${p}`}
                        >
                          {PROMO_GLYPH[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <span className="font-mono text-xs text-faint">
                  the engine&rsquo;s top 3
                </span>
                <div className="mt-2 min-h-[76px] font-mono text-[11px] leading-relaxed">
                  {lastReply ? (
                    lastReply.ranked.slice(0, 3).map((m, i) => (
                      <div key={m.uci} className="flex items-baseline gap-3">
                        <span className={i === 0 ? "w-10 text-teal" : "w-10 text-muted"}>
                          {m.san}
                        </span>
                        <span className="text-faint">
                          p={m.prior.toFixed(3)} · v={m.value.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-faint">
                      {ready ? "make a move" : "loading the engine…"}
                    </span>
                  )}
                </div>
                {lastReply ? (
                  <p className="mt-2 font-mono text-[11px] text-faint">
                    one forward pass · {Math.round(lastReply.ms)}ms
                  </p>
                ) : null}

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={reset}
                    className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink"
                  >
                    new game
                  </button>
                  <button
                    onClick={() => setSelfPlay((v) => !v)}
                    disabled={!ready || Boolean(outcome)}
                    aria-pressed={selfPlay}
                    className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-40 ${
                      selfPlay
                        ? "border-teal text-teal"
                        : "border-line text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {selfPlay ? "stop" : "engine vs engine"}
                  </button>
                  <button
                    onClick={undo}
                    disabled={selfPlay || thinking || game.history().length < 2}
                    className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
                  >
                    take back
                  </button>
                  {/* Only while it's actually your move: asking the engine what
                      you should play when it isn't your turn is a question about
                      a position that isn't on the board. */}
                  <button
                    onClick={askHint}
                    disabled={
                      !ready ||
                      selfPlay ||
                      thinking ||
                      hinting ||
                      Boolean(outcome) ||
                      game.turn() !== "w"
                    }
                    className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-indigo hover:text-indigo disabled:opacity-40"
                  >
                    {hinting ? "thinking…" : "hint"}
                  </button>
                </div>

                <p className="mt-3 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                  <span className="text-indigo">hint</span> asks what it would play from
                  where you are sitting. It is the same call it makes for itself: the
                  encoder always builds from the side to move, so your move and its move
                  are one computation.
                </p>

                <p className="mt-6 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                  Currently one ply: it ranks every legal reply and plays the best, in a
                  single forward pass. The Pi runs MCTS on top of these same numbers,
                  which is where the real strength is.
                </p>
              </div>
            </div>
            )}
          </>
        )}
      </TerminalPanel>
    </div>
  );
}
