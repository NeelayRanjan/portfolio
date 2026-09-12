"use client";

import { useMemo } from "react";
import { Chess, type Square } from "chess.js";

/**
 * The board renderer, shared by the game and the activation view.
 *
 * Square geometry, the FEN parse and the glyphs live here exactly once — the
 * interpretability layer is an overlay on THIS board, not a second one.
 */

/** Both colours use the SOLID glyph set: the outline set renders at a different
 *  weight in most monospace fonts, so a mixed set makes one side look faded.
 *  Colour carries the side instead. */
const GLYPH: Record<string, string> = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
/** 8 at the top, matching board() and the overlay's row order. */
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

/** Peak overlay alpha. Above ~0.6 the pieces stop being readable, which defeats
 *  the point: the whole idea is reading the map ON the position. */
const MAX_ALPHA = 0.6;

const TINT: Record<Overlay["tint"], [number, number, number]> = {
  // Literals, not tokens: `background` is built as an rgba() string and a CSS
  // variable can't carry the alpha these need. Kept in step with the palette by
  // role — saliency is `--color-link` (#7ba7dc), the "what it saw / what it
  // would play" accent; activation is `--color-ok` (#63c68c), the engine's own
  // move map. (v1's indigo/teal pair, re-derived in the warm palette.)
  saliency: [123, 167, 220],
  activation: [99, 198, 140],
};

export type Overlay = {
  /** 64 floats in [0,1], row-major from rank 8 down to rank 1 — the same order
   *  chess.js board() yields, so index 0 is a8. */
  values: number[];
  tint: "saliency" | "activation";
};

export function ChessBoard({
  fen,
  overlay,
  selected,
  targets,
  onSquare,
  maxSize = 296,
}: {
  fen: string;
  overlay?: Overlay | null;
  selected?: Square | null;
  targets?: Set<string>;
  /** Omit to render a static board (activation mode passes nothing). */
  onSquare?: (square: Square) => void;
  /** Board width CAP, not a fixed width. It shrinks below this to fit. */
  maxSize?: number;
}) {
  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const interactive = Boolean(onSquare);

  return (
    /**
     * ⚠️ FLUID, AND IT HAS TO BE. This used to be a hard `width: 296px` with the
     * labels sized by hand off `size / 8`. 296 plus the rank gutter is ~314px,
     * which is wider than the panel on a 320px phone — and v1's TerminalPanel
     * was `overflow-hidden`, so the h-file was silently cut off rather than
     * scrolled to. Measured: the panel overflowed by 53px with no way to reach
     * the rest. Still fluid under `InstrumentFigure` for the same reason: the
     * board must fit its column, not force the sheet to scroll sideways.
     *
     * One grid does the whole job and deletes the pixel math. The board is
     * `1fr` of what's left, its cells are aspect-square, so its height follows
     * its width for free. Row 1's height is therefore the board's, and the rank
     * column stretches into it and splits it 8 ways — always aligned, at any
     * width, because nothing is computed. The files sit in row 2 under the board
     * only, which is what the empty row-2 cell is for.
     */
    <div
      className="grid w-full select-none gap-x-1.5"
      style={{
        gridTemplateColumns: "auto minmax(0, 1fr)",
        // The cap lands the board at ~296px wherever there's room, so this is
        // identical to the old layout on anything but a narrow phone.
        maxWidth: maxSize + 18,
      }}
    >
      {/* Ranks, 8 down to 1. aria-hidden: every square already carries its own
          coordinate in aria-label, so a screen reader gets this without the
          decoration. */}
      <div
        aria-hidden="true"
        className="grid"
        style={{ gridTemplateRows: "repeat(8, minmax(0, 1fr))" }}
      >
        {RANKS.map((r) => (
          <span
            key={r}
            className="flex items-center justify-end font-mono text-[9px] text-mut/60"
          >
            {r}
          </span>
        ))}
      </div>

    <div
      className="grid border border-rule font-mono"
      style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
    >
      {board.map((row, r) =>
        row.map((cell, f) => {
          const square = `${FILES[f]}${8 - r}` as Square;
          const dark = (r + f) % 2 === 1;
          const isSel = selected === square;
          const isTarget = targets?.has(square) ?? false;
          const heat = overlay?.values[r * 8 + f] ?? 0;
          const rgb = overlay ? TINT[overlay.tint] : null;

          const Cell = interactive ? "button" : "div";
          return (
            <Cell
              key={square}
              {...(interactive ? { onClick: () => onSquare?.(square) } : {})}
              aria-label={`${square}${cell ? ` ${cell.color}${cell.type}` : " empty"}`}
              className={`relative flex aspect-square items-center justify-center text-[26px] leading-none transition-colors ${
                dark ? "bg-board-dark" : "bg-board-light"
              } ${isSel ? "outline outline-2 -outline-offset-2 outline-ok" : ""}`}
            >
              {rgb && heat > 0.01 ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(
                      Math.min(1, Math.max(0, heat)) * MAX_ALPHA
                    ).toFixed(3)})`,
                  }}
                />
              ) : null}
              {cell ? (
                <span
                  className={`relative ${cell.color === "w" ? "text-ink" : "text-link"}`}
                >
                  {GLYPH[cell.type]}
                </span>
              ) : null}
              {isTarget && !cell ? (
                <span className="absolute size-1.5 rounded-full bg-ok/60" />
              ) : null}
              {isTarget && cell ? (
                <span className="absolute inset-0 outline outline-2 -outline-offset-2 outline-ok/50" />
              ) : null}
            </Cell>
          );
        }),
      )}
    </div>

      {/* Row 2, column 1: empty. It keeps the files under the board rather than
          under the rank gutter. */}
      <div />

      {/* Files, a to h. Same 8-column track as the board above, so they line up
          by construction instead of by arithmetic. */}
      <div
        aria-hidden="true"
        className="grid"
        style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
      >
        {FILES.map((f) => (
          <span key={f} className="text-center font-mono text-[9px] text-mut/60">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
