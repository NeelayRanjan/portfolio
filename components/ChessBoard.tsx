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
  // The handoff asks for amber on saliency, but the site's palette is one indigo
  // + one teal and nothing else. Indigo reads as the "hot/attention" accent
  // everywhere else on the page, so it carries saliency here.
  saliency: [143, 136, 221],
  activation: [93, 202, 165],
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
  size = 296,
}: {
  fen: string;
  overlay?: Overlay | null;
  selected?: Square | null;
  targets?: Set<string>;
  /** Omit to render a static board (activation mode passes nothing). */
  onSquare?: (square: Square) => void;
  size?: number;
}) {
  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const interactive = Boolean(onSquare);
  /** Squares are aspect-square, so one is exactly an eighth of the width. The
   *  coordinate labels track that rather than guessing. Named cellPx, not cell:
   *  the board map below binds `cell` to a piece and would shadow it. */
  const cellPx = size / 8;

  return (
    <div className="flex select-none gap-1.5">
      {/* Ranks, 8 down to 1. aria-hidden: every square already carries its own
          coordinate in aria-label, so a screen reader gets this without the
          decoration. */}
      <div aria-hidden="true" className="flex flex-col">
        {RANKS.map((r) => (
          <span
            key={r}
            className="flex items-center justify-end font-mono text-[9px] text-faint"
            style={{ height: cellPx }}
          >
            {r}
          </span>
        ))}
      </div>

      <div>
    <div
      className="grid border border-line font-mono"
      style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))", width: size }}
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
                dark ? "bg-panel-bar" : "bg-panel"
              } ${isSel ? "outline outline-2 -outline-offset-2 outline-teal" : ""}`}
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
                  className={`relative ${cell.color === "w" ? "text-ink" : "text-indigo"}`}
                >
                  {GLYPH[cell.type]}
                </span>
              ) : null}
              {isTarget && !cell ? (
                <span className="absolute size-1.5 rounded-full bg-teal/60" />
              ) : null}
              {isTarget && cell ? (
                <span className="absolute inset-0 outline outline-2 -outline-offset-2 outline-teal/50" />
              ) : null}
            </Cell>
          );
        }),
      )}
    </div>

        {/* Files, a to h, aligned to the columns above. */}
        <div aria-hidden="true" className="flex" style={{ width: size }}>
          {FILES.map((f) => (
            <span
              key={f}
              className="text-center font-mono text-[9px] text-faint"
              style={{ width: cellPx }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
