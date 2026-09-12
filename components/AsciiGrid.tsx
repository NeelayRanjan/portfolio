/* Measured (scripts/measure-mono.mjs, 2026-09-11): Spline Sans Mono's advance is
   0.5590em, not v1 Geist Mono's 0.600em — so the 0.6 + letterSpacing line-height
   identity this file's AsciiLines comment describes does not hold for it. ASCII
   grids keep a dedicated mono rather than adopting --font-serif/--font-mono's
   Spline Sans Mono in Task 11; AsciiLines' metrics stay as measured for the old
   font and must be re-derived (not just reused) if a mono is ever swapped in here. */
"use client";

import { useMemo } from "react";

/** Intensity ramp, darkest -> brightest. Index = round(v * (len - 1)). */
export const RAMP = " .:-=+*#%@";

export type AsciiGridProps = {
  /** Row-major 2D array of intensities in [0, 1]. Values are clamped. */
  grid: number[][];
  /** Override the default ramp. Must be at least 2 characters. */
  ramp?: string;
  /** Accent applied to the whole grid. */
  tint?: "ink" | "indigo" | "teal";
  /** Font size in px. Kept >= 11 per the type spec. */
  fontSize?: number;
  /** Describes the grid for screen readers; the glyphs themselves are decorative. */
  label?: string;
  className?: string;
};

const TINTS: Record<NonNullable<AsciiGridProps["tint"]>, string> = {
  ink: "var(--color-ink)",
  indigo: "var(--color-indigo)",
  teal: "var(--color-teal)",
};

/**
 * Renders an intensity grid as monospace glyphs.
 *
 * One text node per row rather than per cell: a 28x28 grid re-rendering at
 * playback speed is 28 nodes to diff, not 784. This matters on mobile.
 */
export function AsciiGrid({
  grid,
  ramp = RAMP,
  tint = "ink",
  fontSize = 11,
  label,
  className = "",
}: AsciiGridProps) {
  const lines = useMemo(() => {
    const last = ramp.length - 1;
    return grid.map((row) => {
      let line = "";
      for (let x = 0; x < row.length; x++) {
        const v = row[x];
        // Guard against NaN/undefined from a half-loaded trajectory frame.
        const clamped = v > 0 ? (v < 1 ? v : 1) : 0;
        line += ramp[Math.round(clamped * last)];
      }
      return line;
    });
  }, [grid, ramp]);

  return (
    <AsciiLines
      lines={lines}
      tint={tint}
      fontSize={fontSize}
      label={label}
      className={className}
    />
  );
}

export type AsciiLinesProps = {
  /** Pre-rendered rows. Each string is one row of glyphs. */
  lines: string[];
  tint?: AsciiGridProps["tint"];
  fontSize?: number;
  /**
   * Line box height, in em. Default 0.68 squares up a 28x28 intensity grid
   * (a monospace glyph is ~0.6em wide, + 0.08em tracking).
   *
   * Pass 1 with tracking 0 for grids whose aspect is ALREADY corrected upstream
   * — the 28x14 ASCII diffusion frames are pre-corrected by averaging row pairs
   * on the model side, so squeezing them again re-stretches the digit.
   */
  lineHeight?: number;
  letterSpacing?: string;
  label?: string;
  className?: string;
};

/**
 * The shared glyph renderer: the trajectory viewer maps intensities through a
 * ramp and delegates here; the live draw-a-digit feature passes the model's
 * ASCII strings straight in.
 *
 * One text node per row rather than per cell — a grid re-rendering at playback
 * speed is 14-28 nodes to diff, not hundreds. This matters on mobile.
 *
 * Rows go in as text, never innerHTML: the vocabularies here include glyphs like
 * \\ and characters adjacent to < and &, and one of these grids is fed straight
 * from model output.
 */
export function AsciiLines({
  lines,
  tint = "ink",
  fontSize = 11,
  lineHeight = 0.68,
  letterSpacing = "0.08em",
  label,
  className = "",
}: AsciiLinesProps) {
  return (
    <div
      className={`select-none font-mono ${className}`}
      style={{
        fontSize: `${Math.max(11, fontSize)}px`,
        lineHeight,
        letterSpacing,
        color: TINTS[tint],
      }}
      role="img"
      aria-label={label}
    >
      {lines.map((line, y) => (
        // Row index is a stable key: the grid's shape never reorders, only its values.
        <div key={y} className="whitespace-pre">
          {line}
        </div>
      ))}
    </div>
  );
}
