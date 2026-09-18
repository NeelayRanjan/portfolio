"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { trackDemoOnce } from "@/lib/track";
import { InstrumentFigure } from "./manuscript/InstrumentFigure";
import { ChessBoard } from "./ChessBoard";
import { ChessActivations } from "./ChessActivations";
import {
  EngineUnloaded,
  loadChessEngine,
  unloadChessEngine,
  SEARCH_MODES,
  DEFAULT_SEARCH,
  THINK_SIMS,
  type ChessEngine,
  type ScoredMove,
} from "@/lib/chess-engine";
import { subscribeStargaze } from "@/lib/stargaze";
import { loadChessActivations, type ActivationSet } from "@/lib/chess-activations";
import { mulberry32, pickSelfPlayMove, SELF_PLAY_MAX_DEVIATIONS } from "@/lib/chess-selfplay";
import { copy } from "@/content/copy";

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

/**
 * `sims` is the budget `let it think` spends, NOT the live sim count.
 *
 * Nothing about mounting picks a mode, so this box is configuration — what the
 * search will spend when you ask for it — and the segmented control beside it
 * carries which mode is actually running. Two facts, two controls, neither
 * contradicting the other. (v1 put the number in the boot log's `--sims` flag
 * and the mode in the panel's title bar, for exactly the same reason.)
 */
const SIMS_RANGE = {
  min: THINK_SIMS.min,
  max: THINK_SIMS.max,
  step: THINK_SIMS.step,
} as const;

/**
 * Clamp HARD: snap to the grid, then into range. Never pass a raw value through.
 *
 * Replicated from v1's `CommandLine.snap`, which died with the terminal chrome —
 * same six lines, same numbers. Typing `10` landing on 250 is not a rounding
 * accident, it IS the finding: below ~250 simulations the search returns the same
 * move as 1-ply argmin, so every value this box accepts is a search that actually
 * searches. See THINK_SIMS in lib/chess-protocol.ts before widening it.
 *
 * The steps here are whole numbers, so there is no decimal round-trip to do (the
 * draw panel's `snap` needs one for its 0.05 grid).
 */
function snapSims(raw: number): number {
  const stepped = Math.round(raw / SIMS_RANGE.step) * SIMS_RANGE.step;
  return Math.min(SIMS_RANGE.max, Math.max(SIMS_RANGE.min, stepped));
}

/**
 * The one labeled number box. Same clamping, same commit rules as the command
 * line flag it replaces; only the chrome changed.
 */
function SimsField({
  name,
  value,
  disabled,
  onCommit,
}: {
  name: string;
  value: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  /** null = not being edited, so the committed value shows. A draft has to exist
   *  or a half-typed number would be clamped out from under the visitor. */
  const [draft, setDraft] = useState<string | null>(null);
  /**
   * ⚠️ Escape abandons through a REF, and `setDraft(null)` CANNOT do this job.
   *
   * Escape has to blur (the box must let go of the keyboard), and `blur()` fires
   * `onBlur` synchronously, inside the same event — so the commit that runs is
   * still this render's closure, where `draft` is the string just typed. A
   * `setDraft(null)` on the way out is invisible to it. Same pattern, same
   * reason, as the draw panel's `ParamField`.
   */
  const escaped = useRef(false);
  const text = draft ?? String(value);

  const commit = () => {
    if (escaped.current) {
      escaped.current = false;
      setDraft(null); // show the committed value again, unchanged
      return;
    }
    // No draft means no edit — which matters, because disabling a focused input
    // blurs it, and a blur must not commit anything on its own.
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null); // snap back to the committed value, edited or not
    if (draft.trim() === "" || !Number.isFinite(n)) return;
    const v = snapSims(n);
    if (v !== value) onCommit(v);
  };

  return (
    <label className="flex flex-col gap-1">
      {/* aria-hidden: the input's own label already names the param and its
          range, so announcing this would say the word twice. */}
      <span aria-hidden="true" className="text-mut">
        {name}
      </span>
      <input
        type="number"
        value={text}
        disabled={disabled}
        min={SIMS_RANGE.min}
        max={SIMS_RANGE.max}
        step={SIMS_RANGE.step}
        inputMode="numeric"
        spellCheck={false}
        autoComplete="off"
        aria-label={`${name}, ${SIMS_RANGE.min} to ${SIMS_RANGE.max}`}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur(); // blur commits
          if (e.key === "Escape") {
            // Abandon: the flag is what the blur below reads (see `escaped`).
            escaped.current = true;
            e.currentTarget.blur();
          }
        }}
        className="w-16 border border-rule bg-desk px-1.5 py-1 text-center font-mono text-[11px] tabular-nums text-ink outline-none transition-colors hover:border-mut focus:border-ok disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  );
}

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

/** The suggested move as a two-square overlay. `saliency`, which is now-link
 *  (#7ba7dc), on purpose: `activation` already means "the engine's own move map"
 *  on this board, and a hint is a different claim. One tint, one meaning. */
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
    /** The move actually played. Always ranked[0] except in one-ply self-play,
     *  where it can be a near-tied second or third choice, so the list marks
     *  THIS, not the top row. */
    played: string;
  } | null>(null);
  /** Simulations done, while a search is running. Null when nothing is. A search
   *  is ~1 minute, so without this the panel is indistinguishable from a hang. */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  /** 1 ply, or the Pi's real search. Defaults to 1 ply: nobody should land on a
   *  board that takes a minute to answer. */
  const [level, setLevel] = useState(DEFAULT_SEARCH);
  /** What `let it think` spends, via the sims box. Clamped to [250, 500] — see
   *  THINK_SIMS: the floor is the measurement, not a preference. */
  const [thinkSims, setThinkSims] = useState<number>(THINK_SIMS.default);
  /** Confirms a sims edit. It configures the NEXT search rather than re-running:
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
  /** Engine plays both sides. MEASURED 2026-09-17 (node, the worker's exact
   *  scoring path, ten openings): most games end in checkmate, 7 of 10, after
   *  recognisable opening theory and then a one-move tactical blunder, which is
   *  what one ply with no lookahead predicts. The other 3 were threefold
   *  draws, and only late (first repeat at ply 116-133, five to eight pieces
   *  left): the no-history shuffle in won endgames is real but rare, so the
   *  site's draw detection still matters without being the usual ending. At
   *  one ply it may take a near-tied second or third choice, at most twice a
   *  game (lib/chess-selfplay.ts), or every press replays the same game. */
  const [selfPlay, setSelfPlay] = useState(false);
  const selfPlayRef = useRef(false);
  selfPlayRef.current = selfPlay;
  /** Self-play's departures this game, for the list and the verify hook. */
  const [deviations, setDeviations] = useState<{ ply: number; rank: number; ratio: number }[]>([]);
  /** Bumped by every new game, so the departure budget is per game: stopping
   *  and restarting self-play mid-game never refills it. */
  const gameIdRef = useRef(0);
  const spRef = useRef<{ game: number; rand: () => number; left: number }>({ game: -1, rand: () => 1, left: 0 });
  /** The loop runs only while someone could be watching (Constitution: pause
   *  everything animated off-screen or tab-hidden). A move already in flight
   *  still lands; the next one waits. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  /** The engine's suggestion for YOUR move, on demand. Not automatic: a hint
   *  standing on every turn stops being a game and starts being a solver. */
  const [hint, setHint] = useState<ScoredMove | null>(null);
  const [hinting, setHinting] = useState(false);

  /**
   * Every engine load goes through here, tagged with a generation. Stargaze
   * bumps the generation, so a load that resolves after the engine was
   * unloaded (or after the visitor came back and a newer load started) lands
   * nowhere instead of installing a terminated engine.
   */
  const loadGenRef = useRef(0);
  const startEngineLoad = useCallback(() => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    loadChessEngine()
      .then((e) => {
        if (gen === loadGenRef.current) setEngine(e);
      })
      .catch((e: Error) => {
        if (gen === loadGenRef.current) setErr(e.message);
      })
      .finally(() => {
        if (gen === loadGenRef.current) setLoading(false);
      });
  }, []);

  // 553KB + the wasm runtime. Lazy, and still lazy: this component is mounted on
  // scroll-in by `DeferredMount`, which is where v1's boot gate went. So the
  // first render IS the moment the panel was reached, and there is nothing left
  // to wait on.
  useEffect(() => {
    startEngineLoad();
    // Resolves null while chess_activations.json isn't deployed, which hides the
    // toggle. Nothing here is fabricated: a plausible fake heatmap would teach
    // the wrong thing about what the model sees.
    loadChessActivations()
      .then(setActs)
      .catch(() => setActs(null));
  }, [startEngineLoad]);

  // Stargaze: unload on entry (a running search is abandoned; the game, the
  // mode and self-play survive), reload on return, because this panel had
  // loaded it (spec §5's restore rule).
  useEffect(
    () =>
      subscribeStargaze((on) => {
        if (on) {
          loadGenRef.current++;
          setEngine(null);
          setLoading(false);
          void unloadChessEngine();
        } else {
          startEngineLoad();
        }
      }),
    [startEngineLoad],
  );

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
      return `${copy.systems.chess.checkmatePre}${g.turn() === "w" ? copy.systems.chess.checkmateWinsBlack : copy.systems.chess.checkmateWinsWhite}`;
    if (g.isStalemate()) return copy.systems.chess.drawStalemate;
    if (g.isThreefoldRepetition()) return copy.systems.chess.drawThreefold;
    if (g.isInsufficientMaterial()) return copy.systems.chess.drawInsufficient;
    if (g.isDraw()) return copy.systems.chess.drawFiftyMove;
    return null;
  }, [fen]);

  const mode = useMemo(
    () => SEARCH_MODES.find((d) => d.id === level) ?? SEARCH_MODES[0],
    [level],
  );
  /** 0 means argmin. Otherwise it's whatever the sims box says, not the mode's
   *  default. */
  const sims = mode.sims === 0 ? 0 : thinkSims;

  const engineMove = useCallback(async () => {
    const g = gameRef.current;
    if (!engine || g.isGameOver()) return;
    const gameAtStart = gameIdRef.current;
    setThinking(true);
    setProgress(null);
    try {
      const reply = await engine.move(g.fen(), sims, (done, total) =>
        setProgress({ done, total }),
      );
      // "new game" while this was in flight: the answer is about a board that
      // no longer exists. Without this it landed on the fresh board's list
      // (found 2026-09-17 by the self-play check: the new game's top 3 showed
      // the old game's e7e6). `finally` still clears thinking.
      if (gameAtStart !== gameIdRef.current) return;
      let chosen = reply.best;
      const selfPlaying = selfPlayRef.current;
      if (selfPlaying && sims === 0) {
        const sp = spRef.current;
        if (sp.game !== gameIdRef.current) {
          // First self-play move of this game: a fresh seed from the press,
          // so presses differ while one game stays reproducible under a
          // pinned clock (which is how the verify check replays it).
          spRef.current = { game: gameIdRef.current, rand: mulberry32(Date.now()), left: SELF_PLAY_MAX_DEVIATIONS };
        }
        const pick = pickSelfPlayMove(reply.ranked, spRef.current.left, spRef.current.rand);
        if (pick.index > 0) {
          chosen = reply.ranked[pick.index];
          spRef.current.left--;
          const ply = g.history().length + 1;
          setDeviations((ds) => [...ds, { ply, rank: pick.index + 1, ratio: pick.ratio }]);
        }
      }
      g.move(chosen.san);
      // Keep every move: the top 3 feeds the list, the whole set feeds the map.
      setLastReply({ ranked: reply.ranked, ms: reply.ms, mode: reply.mode, sims: reply.sims, played: chosen.uci });
      sync();
      // Watching it play itself is using the demo: real output, no human move.
      if (selfPlaying) trackDemoOnce("chess");
    } catch (e) {
      // Unloaded by stargaze mid-search: idle, not broken.
      if (!(e instanceof EngineUnloaded)) setErr((e as Error).message);
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
      // Unloaded by stargaze mid-search: idle, not broken.
      if (!(e instanceof EngineUnloaded)) setErr((e as Error).message);
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
    if (selfPlay && (!onScreen || !tabVisible)) return;
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
  }, [fen, engine, selfPlay, sims, onScreen, tabVisible]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
      setFlash(copy.systems.chess.illegalMove);
      setTimeout(() => setFlash(null), 1200);
      return;
    }
    setSelected(null);
    setPendingPromo(null);
    sync();
    trackDemoOnce("chess");
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
    gameIdRef.current++;
    setDeviations([]);
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
  /**
   * Which of the two views is on screen — and the ONE place that decides it, so
   * the body and the controls above it can never disagree.
   *
   * ⚠️ The search toggle, the sims box and the note under them are gated on
   * this, and that is not tidying. In the interpretability view they configure a
   * search that nothing on screen runs: the activation maps are a precomputed
   * export over curated positions, so changing the budget there is a control
   * wired to nothing, which is exactly what the repo's editable-param rule
   * forbids. They come back with their state intact when the game does.
   */
  const showGame = !(acts && view === "activations");
  const status = loading
    ? copy.systems.chess.statusLoading
    : busy
      ? // The search runs in a worker, so this counter keeps ticking while the
        // page stays live. That IS the demo: a frozen tab would prove nothing.
        progress
        ? `${copy.systems.chess.statusSearchingPre}${progress.done}/${progress.total}`
        : copy.systems.chess.statusThinking
      : outcome
        ? copy.systems.chess.statusGameOver
        : ready
          ? selfPlay
            ? `${engine.build} · ${copy.systems.chess.statusSelfPlay} · move ${Math.ceil(game.history().length / 2) || 1}`
            : `${engine.build} · ${game.turn() === "w" ? copy.systems.chess.statusYourMove : copy.systems.chess.statusWaiting}`
          : copy.systems.chess.statusEnginePending;

  return (
    <InstrumentFigure
      n="4"
      id="fig-chess"
      caption={copy.systems.chess.figureCaption}
      readout={status}
    >
      <div ref={rootRef}>
      {/* h3, not h2: the page's `<h2>` is the "Live systems" section above. */}
      {/* pr-40 keeps the heading clear of the figure's absolutely-positioned
          readout, which runs to ~"searching · 250/250" at its longest. */}
      <h3 className="mt-1 mb-2 pr-40 text-[17px] font-semibold text-ink">
        {copy.systems.chess.heading}
      </h3>
      <p className="mb-4 max-w-2xl text-[15px] leading-relaxed text-mut">
        {copy.systems.chess.lede.a}
      </p>
      <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-mut">
        {copy.systems.chess.lede.b}
      </p>

      {err ? (
        <p className="mb-4 font-mono text-[11px] leading-relaxed text-mut/60">
          <span className="text-red-ink">{copy.systems.chess.engineError}</span>: {err}
        </p>
      ) : null}

      {/* Gated on the export existing. No data -> no toggle, rather than a
          disabled control advertising something that may never land. */}
      {acts ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {(["game", "activations"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={v === view}
              className={`border px-3 py-1.5 font-mono text-xs transition-colors ${
                v === view
                  ? "border-link text-link"
                  : "border-rule text-mut hover:border-mut hover:text-ink"
              }`}
            >
              {v === "game" ? v : copy.systems.chess.viewSaw}
            </button>
          ))}
        </div>
      ) : null}

      {/* Game-only, see `showGame`: in the interpretability view these
          configure a search that nothing on screen runs. */}
      {showGame ? (
        <>
        {/*
         * The control row: which search is running, and what it spends.
         *
         * Two modes, not a ladder — see chess-protocol.ts for the measurement that
         * deleted the ladder. Switching mid-game is fine: every move is an
         * independent search, no tree is carried between them. It applies to its
         * move, your hint and self-play alike, because they are all one call.
         *
         * v1 rendered the mode in the panel's title bar and the number as an
         * editable `--sims` flag in the boot command. Same two facts, same clamp,
         * same commit rules; only the chrome changed.
         */}
        <div className="mb-2 flex flex-wrap items-end gap-x-5 gap-y-3 font-mono text-[11px]">
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="text-mut">
              {copy.systems.chess.searchLabel}
            </span>
            <div className="flex" role="group" aria-label={copy.systems.chess.searchLabel}>
              {SEARCH_MODES.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setLevel(d.id)}
                  disabled={busy}
                  aria-pressed={d.id === level}
                  // -ml-px joins the two into one segmented control; `relative` on
                  // the active half keeps its border painting over its neighbour's
                  // rather than under it.
                  className={`border px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    i > 0 ? "-ml-px" : ""
                  } ${
                    d.id === level
                      ? "relative border-ok text-ok"
                      : "border-rule text-mut hover:border-mut hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <SimsField
            name="sims"
            value={thinkSims}
            disabled={busy}
            onCommit={(v) => {
              setThinkSims(v);
              setEcho(
                sims === 0
                  ? `sims ${v}${copy.systems.chess.simsEchoWhenThink}`
                  : `sims ${v}${copy.systems.chess.simsEchoNextMove}`,
              );
            }}
          />

          {/* One slot, two states. The hint retires the moment the number has been
              touched, and reset takes its place — which is also the only moment
              reset is worth offering. */}
          {thinkSims !== THINK_SIMS.default ? (
            <button
              onClick={() => {
                setThinkSims(THINK_SIMS.default);
                setEcho(null);
              }}
              disabled={busy}
              className="self-end border-b border-dashed border-rule py-1 text-mut transition-colors hover:border-mut hover:text-ink disabled:opacity-40"
            >
              {copy.commandLine.reset}
            </button>
          ) : (
            // aria-hidden: the box above is already an exposed labelled control
            // carrying its own range, so this would only repeat it.
            <span aria-hidden="true" className="self-end py-1 text-mut/60">
              {copy.systems.chess.hint}
            </span>
          )}
        </div>

        {/* The confirmation that the number did something. `role="status"`, because
            the edit configures the NEXT search rather than re-running this one, so
            nothing else on screen changes to acknowledge it. */}
        {echo ? (
          <p role="status" className="mb-2 font-mono text-[11px] text-warm">
            {echo}
          </p>
        ) : null}

        <p className="mb-6 max-w-2xl font-mono text-[11px] leading-relaxed text-mut/60">
          {sims > 0 ? (
            <>
              {sims} {mode.about} · about {aboutTime(sims)} a move.
              {copy.systems.chess.searchNoteSetPre}
              <span className="text-ink">{copy.systems.chess.searchNoteSims}</span>
              {copy.systems.chess.searchNoteRange}
              {THINK_SIMS.min}
              {copy.systems.chess.searchNoteTo}
              {THINK_SIMS.max}
              {copy.systems.chess.searchNotePiRuns}
              {THINK_SIMS.max}.
            </>
          ) : (
            <>
              {mode.about}
              {copy.systems.chess.searchNoteFloor}
            </>
          )}
        </p>
        </>
      ) : null}

      {/* Same `showGame`, inverted: one boolean decides the body and the
          controls above it, so they cannot drift apart. */}
      {!showGame ? (
        <>
          <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-mut">
            {copy.systems.chess.activationsLede}
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

            <p className="mt-4 max-w-[296px] font-mono text-[11px] leading-relaxed text-mut/60">
              {outcome ? (
                <span className="text-ok">{outcome}</span>
              ) : flash ? (
                <span className="text-red-ink">{flash}</span>
              ) : game.isCheck() ? (
                // Warm, not red-ink: `check` is a live game state, not a
                // mistake. `illegal move` above is the mistake, and red is what
                // says so in this palette.
                <span className="text-warm">{copy.systems.chess.check}</span>
              ) : hint ? (
                <>
                  <span className="text-link">{copy.systems.chess.hintPlayPre}{hint.san}</span> · p=
                  {hint.prior.toFixed(3)} · v={hint.value.toFixed(2)}
                </>
              ) : showMap && lastReply ? (
                <>
                  <span className="text-ok">{copy.systems.chess.mapCaption}</span>
                  {copy.systems.chess.mapCaptionTail}
                </>
              ) : selfPlay ? (
                <span className="text-ok">{copy.systems.chess.selfPlayCaption}</span>
              ) : (
                copy.systems.chess.boardCaptionIdle
              )}
            </p>

            <button
              onClick={() => setShowMap((v) => !v)}
              aria-pressed={showMap}
              className={`mt-4 border px-3 py-1.5 font-mono text-xs transition-colors ${
                showMap
                  ? "border-ok text-ok"
                  : "border-rule text-mut hover:border-mut hover:text-ink"
              }`}
            >
              {copy.systems.chess.moveMap}
            </button>

            {/* The map is a move preference, not an activation. Saying "its
                ranking" keeps it distinct from the "what it saw" view, which
                shows internals. */}
            <p className="mt-2 max-w-[296px] font-mono text-[11px] leading-relaxed text-mut/60">
              {lastReply?.mode === "mcts"
                ? copy.systems.chess.mapNoteMcts
                : copy.systems.chess.mapNoteArgmin}
            </p>
          </div>

          <div className="min-w-[220px] flex-1">
            {pendingPromo ? (
              <div className="mb-6">
                <span className="font-mono text-xs text-mut/60">{copy.systems.chess.promoteTo}</span>
                <div className="mt-2 flex gap-2">
                  {PROMOTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => play(pendingPromo.from, pendingPromo.to, p)}
                      className="flex size-10 items-center justify-center border border-rule text-[22px] text-ink transition-colors hover:border-ok hover:text-ok"
                      aria-label={`${copy.systems.chess.promoteAria} ${p}`}
                    >
                      {PROMO_GLYPH[p]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <span className="font-mono text-xs text-mut/60">
              {copy.systems.chess.top3}
            </span>
            <div
              className="mt-2 min-h-[76px] font-mono text-[11px] leading-relaxed"
              // Verify hook (scripts/verify-redesign.mjs chess-self-play), not UI.
              data-chess-self-play={JSON.stringify({
                plies: game.history().length,
                deviations,
                played: lastReply?.played ?? null,
                top: lastReply?.ranked[0]?.uci ?? null,
                hint: hint?.uci ?? null,
              })}
            >
              {lastReply ? (
                lastReply.ranked.slice(0, 3).map((m) => (
                  <div key={m.uci} className="flex items-baseline gap-4">
                    <span className={m.uci === lastReply.played ? "w-10 text-ok" : "w-10 text-mut"}>
                      {m.san}
                    </span>
                    {/* n= is what the search decided, p= is what the model
                        guessed before it ran. Showing both is the whole point:
                        where they disagree, that disagreement IS the search. */}
                    <span className="text-mut/60">
                      {m.visits !== undefined ? `n=${m.visits} · ` : ""}p=
                      {m.prior.toFixed(3)} · v={m.value.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-mut/60">
                  {ready ? copy.systems.chess.makeMove : copy.systems.chess.loadingEngine}
                </span>
              )}
            </div>
            {lastReply && lastReply.ranked[0] && lastReply.played !== lastReply.ranked[0].uci ? (
              // A departure, stated with its own numbers: the move map shows
              // the same near-tie on the board.
              <p data-chess-self-play-took className="mt-2 font-mono text-[11px] text-warm">
                {copy.systems.chess.selfPlayTookPre}
                {lastReply.ranked[1]?.uci === lastReply.played
                  ? copy.systems.chess.selfPlaySecond
                  : copy.systems.chess.selfPlayThird}
                {" · p="}
                {lastReply.ranked.find((m) => m.uci === lastReply.played)?.prior.toFixed(3)}
                {copy.systems.chess.selfPlayVs}
                {lastReply.ranked[0].prior.toFixed(3)}
              </p>
            ) : null}
            {lastReply ? (
              <p className="mt-2 font-mono text-[11px] text-mut/60">
                {lastReply.mode === "mcts"
                  ? `${lastReply.sims} simulations · ${(lastReply.ms / 1000).toFixed(1)}s`
                  : `one forward pass · ${Math.round(lastReply.ms)}ms`}
              </p>
            ) : null}

            {/* flex-wrap: four buttons don't fit one row on a 320px phone, and
                v1's panel was overflow-hidden, so `hint` was cut off the right
                edge rather than wrapping under. */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={reset}
                className="border border-rule px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-mut hover:text-ink"
              >
                {copy.systems.chess.newGame}
              </button>
              <button
                onClick={() => setSelfPlay((v) => !v)}
                disabled={!ready || Boolean(outcome)}
                aria-pressed={selfPlay}
                className={`border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-40 ${
                  selfPlay
                    ? "border-ok text-ok"
                    : "border-rule text-mut hover:border-mut hover:text-ink"
                }`}
              >
                {selfPlay ? copy.systems.chess.stop : copy.systems.chess.engineVsEngine}
              </button>
              <button
                onClick={undo}
                disabled={selfPlay || thinking || game.history().length < 2}
                className="border border-rule px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-mut hover:text-ink disabled:opacity-40"
              >
                {copy.systems.chess.takeBack}
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
                className="border border-rule px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-link hover:text-link disabled:opacity-40"
              >
                {hinting ? copy.systems.chess.thinking : copy.systems.chess.hintButton}
              </button>
            </div>

            {selfPlay && sims === 0 ? (
              <p data-chess-self-play-rule className="mt-4 max-w-sm font-mono text-[11px] leading-relaxed text-mut/60">
                {copy.systems.chess.selfPlayRule}
              </p>
            ) : null}

            <p className="mt-4 max-w-sm font-mono text-[11px] leading-relaxed text-mut/60">
              <span className="text-link">{copy.systems.chess.hintNote.word}</span>
              {copy.systems.chess.hintNote.post}
            </p>

            <p className="mt-6 max-w-sm font-mono text-[11px] leading-relaxed text-mut/60">
              {copy.systems.chess.searchNote.pre}
              <span className="text-ok">{copy.systems.chess.searchNote.letItThink}</span>
              {copy.systems.chess.searchNote.post}
            </p>
          </div>
        </div>
      )}
      </div>
    </InstrumentFigure>
  );
}
