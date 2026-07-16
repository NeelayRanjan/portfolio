"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { TerminalPanel } from "./TerminalPanel";
import { ChessBoard } from "./ChessBoard";
import { ChessActivations } from "./ChessActivations";
import { BootLog, useBootSequence } from "./ambience/BootLog";
import {
  loadChessEngine,
  SEARCH_MODES,
  DEFAULT_SEARCH,
  THINK_SIMS,
  type ChessEngine,
  type ScoredMove,
} from "@/lib/chess-engine";
import { CommandLine } from "./ambience/CommandLine";
import { loadChessActivations, type ActivationSet } from "@/lib/chess-activations";
import { copy } from "@/content/copy";

const CMD_NAME = copy.chess.cmd;
/**
 * `--sims` here is the budget `let it think` spends, NOT the live sim count.
 *
 * The boot loads the engine; it does not pick a mode. So this line is
 * configuration — what the search will spend when you ask for it — and the title
 * bar carries which mode is actually running. Two facts, two places, neither
 * contradicting the other.
 *
 * ⚠️ Must match what CommandLine renders, flag for flag and in this order.
 */
const BOOT_CMD = `${CMD_NAME} --model int8 --sims ${THINK_SIMS.default}`;
const BOOT_LINES = [...copy.chess.bootLines];

/** ~230ms a simulation, measured in Firefox (6.6ms/board x ~35 legal moves). Quote
 *  what's measured in a browser, never the Pi's numbers. */
const MS_PER_SIM = 0.23;
const aboutTime = (sims: number) => {
  const s = Math.round(sims * MS_PER_SIM);
  return s < 90 ? `${s}s` : `${(s / 60).toFixed(1)} min`;
};

/** Pause between self-play moves, at 1 ply only. One forward lands in ~140ms,
 *  which is far too fast to watch, so this is pacing rather than compute. A real
 *  search already takes seconds and needs no help looking deliberate. */
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
 * The engine's move preference, as a board heatmap.
 *
 * Costs nothing either way: both numbers already come back from the pass (or the
 * search) that picked the move, and were otherwise thrown away after the top-3
 * list. Several moves can land on one square (two pieces, a promotion fan), so
 * weights are summed per destination — the question is "how much does it want
 * something HERE", not "which piece".
 *
 * ⚠️ WHICH NUMBER IT PAINTS DEPENDS ON THE MODE, and it has to. At 1 ply the
 * weight is the prior, `softmax(-energy)`, because that IS the decision. Once
 * MCTS runs, the decision is the visit count, and the two disagree by design —
 * search exists to overrule the prior. Painting priors under a search would
 * light up a square the engine then declined to play, which is the map claiming
 * something the engine didn't do.
 *
 * Normalized by the max, so the hottest square reads 1.0 regardless of how the
 * mass is spread. It is a move preference, NOT an activation — don't let the
 * copy blur those.
 */
function moveMap(ranked: ScoredMove[]): number[] {
  const out = new Array(64).fill(0);
  const searched = ranked.some((m) => m.visits !== undefined);
  for (const m of ranked) {
    out[squareToIndex(m.uci.slice(2, 4))] += searched ? (m.visits ?? 0) : m.prior;
  }
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
  const [lastReply, setLastReply] = useState<{
    ranked: ScoredMove[];
    ms: number;
    mode: "argmin" | "mcts";
    sims: number;
  } | null>(null);
  /** Simulations done, while a search is running. Null when nothing is. A search
   *  is ~1 minute, so without this the panel is indistinguishable from a hang. */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  /** 1 ply, or the Pi's real search. Defaults to 1 ply: nobody should land on a
   *  board that takes a minute to answer. */
  const [level, setLevel] = useState(DEFAULT_SEARCH);
  /** What `let it think` spends, via --sims. Clamped to [250, 500] — see
   *  THINK_SIMS: the floor is the measurement, not a preference. */
  const [thinkSims, setThinkSims] = useState<number>(THINK_SIMS.default);
  /** Confirms a --sims edit. It configures the NEXT search rather than re-running:
   *  the engine has already moved, and re-answering a position the board has left
   *  would be a claim about a game that moved on. */
  const [echo, setEcho] = useState<string | null>(null);
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
    if (g.isCheckmate())
      return `${copy.chess.checkmatePre}${g.turn() === "w" ? copy.chess.checkmateWinsBlack : copy.chess.checkmateWinsWhite}`;
    if (g.isStalemate()) return copy.chess.drawStalemate;
    if (g.isThreefoldRepetition()) return copy.chess.drawThreefold;
    if (g.isInsufficientMaterial()) return copy.chess.drawInsufficient;
    if (g.isDraw()) return copy.chess.drawFiftyMove;
    return null;
  }, [fen]);

  const mode = useMemo(
    () => SEARCH_MODES.find((d) => d.id === level) ?? SEARCH_MODES[0],
    [level],
  );
  /** 0 means argmin. Otherwise it's whatever --sims says, not the mode's default. */
  const sims = mode.sims === 0 ? 0 : thinkSims;

  const engineMove = useCallback(async () => {
    const g = gameRef.current;
    if (!engine || g.isGameOver()) return;
    setThinking(true);
    setProgress(null);
    try {
      const reply = await engine.move(g.fen(), sims, (done, total) =>
        setProgress({ done, total }),
      );
      g.move(reply.best.san);
      // Keep every move: the top 3 feeds the list, the whole set feeds the map.
      setLastReply({ ranked: reply.ranked, ms: reply.ms, mode: reply.mode, sims: reply.sims });
      sync();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setThinking(false);
      setProgress(null);
    }
  }, [engine, sync, sims]);

  /**
   * What the engine would play from where you're sitting.
   *
   * The same call it makes for itself, not a second code path: the encoder always
   * builds from the perspective of the side to move (see lib/chess-encode.ts), so
   * "its move" and "your move" are one computation and this needed no model work
   * at all.
   *
   * That is why it searches at the CURRENT difficulty rather than always at 1 ply.
   * A hint is a claim about what the engine would play, so it has to be what this
   * engine, as configured, would actually play — a cheaper hint would be a
   * different engine's advice wearing this one's name.
   */
  const askHint = useCallback(async () => {
    const g = gameRef.current;
    // Never call the engine on a finished position.
    if (!engine || g.isGameOver() || thinking || g.turn() !== "w") return;
    setHinting(true);
    setProgress(null);
    try {
      const reply = await engine.move(g.fen(), sims, (done, total) =>
        setProgress({ done, total }),
      );
      setHint(reply.best);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setHinting(false);
      setProgress(null);
    }
  }, [engine, thinking, sims]);

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
      // Only pad self-play when there's nothing to wait for anyway.
      selfPlay && sims === 0 ? SELF_PLAY_MS : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, engine, selfPlay, sims]);

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
      setFlash(copy.chess.illegalMove);
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
    // A search in flight is about a board that is about to stop existing.
    engine?.cancel();
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
  const busy = thinking || hinting;
  const status = !booted
    ? copy.chess.statusBooting
    : loading
      ? copy.chess.statusLoading
      : busy
        ? // The search runs in a worker, so this counter keeps ticking while the
          // page stays live. That IS the demo: a frozen tab would prove nothing.
          progress
          ? `${copy.chess.statusSearchingPre}${progress.done}/${progress.total}`
          : copy.chess.statusThinking
        : outcome
          ? copy.chess.statusGameOver
          : ready
            ? selfPlay
              ? `${engine.build} · ${copy.chess.statusSelfPlay} · move ${Math.ceil(game.history().length / 2) || 1}`
              : `${engine.build} · ${game.turn() === "w" ? copy.chess.statusYourMove : copy.chess.statusWaiting}`
            : copy.chess.statusEnginePending;

  return (
    <div ref={boot.ref}>
      <TerminalPanel
        // Which mode is RUNNING. --sims lives in the boot log and means the
        // configured budget — showing sims in both places would put two different
        // numbers under one flag name.
        label={`${copy.chess.label} --engine ebm --search ${sims === 0 ? "argmin" : "mcts"}`}
        status={status}
        notice={
          booted && err ? (
            <>
              <span className="text-indigo">{copy.chess.engineError}</span>: {err}
            </>
          ) : null
        }
      >
        <BootLog
          typed={boot.typed}
          printed={boot.printed}
          done={booted}
          echo={echo}
          command={
            <CommandLine
              name={CMD_NAME}
              disabled={busy}
              hint={copy.chess.hint}
              dirty={thinkSims !== THINK_SIMS.default}
              onReset={() => {
                setThinkSims(THINK_SIMS.default);
                setEcho(null);
              }}
              // Order must match BOOT_CMD.
              items={[
                // The loader picks the build (fp32 is a fallback), so this is
                // never a knob. The status bar reports what actually answered.
                { kind: "frozen", flag: "--model", value: "int8" },
                {
                  kind: "param",
                  flag: "--sims",
                  value: thinkSims,
                  min: THINK_SIMS.min,
                  max: THINK_SIMS.max,
                  step: THINK_SIMS.step,
                  int: true,
                  onCommit: (v) => {
                    setThinkSims(v);
                    setEcho(
                      sims === 0
                        ? `--sims ${v}${copy.chess.simsEchoWhenThink}`
                        : `--sims ${v}${copy.chess.simsEchoNextMove}`,
                    );
                  },
                },
              ]}
            />
          }
        />

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
                    {v === "game" ? v : copy.chess.viewSaw}
                  </button>
                ))}
              </div>
            ) : null}

            <h2 className="mt-6 mb-2 text-2xl tracking-tight">{copy.chess.heading}</h2>
            <p className="mb-8 max-w-[54ch] leading-relaxed text-muted">
              {copy.chess.lede}
            </p>

            {acts && view === "activations" ? (
              <>
                <p className="mb-8 max-w-[54ch] leading-relaxed text-muted">
                  {copy.chess.activationsLede}
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

                <p className="mt-4 max-w-[296px] font-mono text-[11px] leading-relaxed text-faint">
                  {outcome ? (
                    <span className="text-teal">{outcome}</span>
                  ) : flash ? (
                    <span className="text-indigo">{flash}</span>
                  ) : game.isCheck() ? (
                    <span className="text-indigo">{copy.chess.check}</span>
                  ) : hint ? (
                    <>
                      <span className="text-indigo">{copy.chess.hintPlayPre}{hint.san}</span> · p=
                      {hint.prior.toFixed(3)} · v={hint.value.toFixed(2)}
                    </>
                  ) : showMap && lastReply ? (
                    <>
                      <span className="text-teal">{copy.chess.mapCaption}</span>
                      {copy.chess.mapCaptionTail}
                    </>
                  ) : selfPlay ? (
                    <span className="text-teal">{copy.chess.selfPlayCaption}</span>
                  ) : (
                    copy.chess.boardCaptionIdle
                  )}
                </p>

                <button
                  onClick={() => setShowMap((v) => !v)}
                  aria-pressed={showMap}
                  className={`mt-4 rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
                    showMap
                      ? "border-teal text-teal"
                      : "border-line text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  {copy.chess.moveMap}
                </button>

                {/* The map is a move preference, not an activation. Saying "its
                    ranking" keeps it distinct from the "what it saw" view, which
                    shows internals. */}
                <p className="mt-2 max-w-[296px] font-mono text-[11px] leading-relaxed text-faint">
                  {lastReply?.mode === "mcts"
                    ? copy.chess.mapNoteMcts
                    : copy.chess.mapNoteArgmin}
                </p>
              </div>

              <div className="min-w-[220px] flex-1">
                {pendingPromo ? (
                  <div className="mb-6">
                    <span className="font-mono text-xs text-faint">{copy.chess.promoteTo}</span>
                    <div className="mt-2 flex gap-2">
                      {PROMOTIONS.map((p) => (
                        <button
                          key={p}
                          onClick={() => play(pendingPromo.from, pendingPromo.to, p)}
                          className="flex size-10 items-center justify-center rounded border border-line text-[22px] text-ink transition-colors hover:border-teal hover:text-teal"
                          aria-label={`${copy.chess.promoteAria} ${p}`}
                        >
                          {PROMO_GLYPH[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <span className="font-mono text-xs text-faint">
                  {copy.chess.top3}
                </span>
                <div className="mt-2 min-h-[76px] font-mono text-[11px] leading-relaxed">
                  {lastReply ? (
                    lastReply.ranked.slice(0, 3).map((m, i) => (
                      <div key={m.uci} className="flex items-baseline gap-4">
                        <span className={i === 0 ? "w-10 text-teal" : "w-10 text-muted"}>
                          {m.san}
                        </span>
                        {/* n= is what the search decided, p= is what the model
                            guessed before it ran. Showing both is the whole point:
                            where they disagree, that disagreement IS the search. */}
                        <span className="text-faint">
                          {m.visits !== undefined ? `n=${m.visits} · ` : ""}p=
                          {m.prior.toFixed(3)} · v={m.value.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-faint">
                      {ready ? copy.chess.makeMove : copy.chess.loadingEngine}
                    </span>
                  )}
                </div>
                {lastReply ? (
                  <p className="mt-2 font-mono text-[11px] text-faint">
                    {lastReply.mode === "mcts"
                      ? `${lastReply.sims} simulations · ${(lastReply.ms / 1000).toFixed(1)}s`
                      : `one forward pass · ${Math.round(lastReply.ms)}ms`}
                  </p>
                ) : null}

                {/* Two modes, not a ladder — see chess-protocol.ts for the
                    measurement that deleted the ladder. Switching mid-game is
                    fine: every move is an independent search, no tree is carried
                    between them. Applies to its move, your hint and self-play
                    alike, because they are all one call. */}
                <div className="mt-6">
                  <span className="font-mono text-xs text-faint">{copy.chess.searchLabel}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEARCH_MODES.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setLevel(d.id)}
                        disabled={busy}
                        aria-pressed={d.id === level}
                        className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-40 ${
                          d.id === level
                            ? "border-teal text-teal"
                            : "border-line text-muted hover:border-faint hover:text-ink"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                    {sims > 0 ? (
                      <>
                        {sims} {mode.about} · about {aboutTime(sims)} a move.
                        {copy.chess.searchNoteSetPre}
                        <span className="text-ink">--sims</span>
                        {copy.chess.searchNoteRange}
                        {THINK_SIMS.min}
                        {copy.chess.searchNoteTo}
                        {THINK_SIMS.max}
                        {copy.chess.searchNotePiRuns}
                        {THINK_SIMS.max}.
                      </>
                    ) : (
                      <>
                        {mode.about}
                        {copy.chess.searchNoteFloor}
                      </>
                    )}
                  </p>
                </div>

                {/* flex-wrap: four buttons don't fit one row on a 320px phone,
                    and the panel is overflow-hidden, so `hint` was cut off the
                    right edge rather than wrapping under. */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={reset}
                    className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink"
                  >
                    {copy.chess.newGame}
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
                    {selfPlay ? copy.chess.stop : copy.chess.engineVsEngine}
                  </button>
                  <button
                    onClick={undo}
                    disabled={selfPlay || thinking || game.history().length < 2}
                    className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
                  >
                    {copy.chess.takeBack}
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
                    {hinting ? copy.chess.thinking : copy.chess.hintButton}
                  </button>
                </div>

                <p className="mt-4 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                  <span className="text-indigo">{copy.chess.hintNote.word}</span>
                  {copy.chess.hintNote.post}
                </p>

                <p className="mt-6 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                  {copy.chess.searchNote.pre}
                  <span className="text-teal">{copy.chess.searchNote.letItThink}</span>
                  {copy.chess.searchNote.post}
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
