"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AsciiGrid, AsciiLines } from "./AsciiGrid";
import { InstrumentFigure } from "./manuscript/InstrumentFigure";
import { Note } from "./manuscript/Row";
import {
  GRID_WIDTH,
  lerpReshape,
  loadTrajectories,
  type TrajectorySet,
} from "@/lib/diffusion";
import {
  cellsToLines,
  loadAsciiTraj,
  maskCount,
  type AsciiTrajSet,
} from "@/lib/ascii-traj";
import { copy } from "@/content/copy";
import { useStargazing } from "@/lib/stargaze";

type Mode = "pixel" | "ascii";

/**
 * ⚠️ ONLY THE DIGIT IS LIVE HERE, AND THIS FIGURE IS THE TRAP.
 *
 * Figure S2b's SDEdit (the draw-a-digit demo, page 1) runs a real model, so
 * every one of its params genuinely re-samples. This one PLAYS A PRECOMPUTED
 * TRAJECTORY — the frames are baked into diffusion_traj.json, and there is no
 * model on the page to re-run. The digit picker works because all 10 digits
 * are in the file. Steps and schedule are properties of the export itself:
 * verified against the file, the distinct frame count across all 10 digits is
 * [32], exactly one step count. There is nothing to snap a typed value to, so
 * they render as plain text (`copy.lab.diffusion.frozenNote`) rather than a
 * control. A new export with multiple step counts is the only thing that
 * changes this ruling.
 */

/** Milliseconds per stored frame. Playback interpolates within this. */
const STEP_MS = 190;
/** Cap re-renders at ~30fps — past that the ramp barely changes and it's just churn. */
const MIN_FRAME_MS = 1000 / 30;
/** Hold on the finished sample before looping, so the result reads. */
const END_DWELL_MS = 750;

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function DiffusionVisualizer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TrajectorySet | null>(null);
  const [ascii, setAscii] = useState<AsciiTrajSet | null>(null);
  /** Default pixel: it's the proven one. ascii is opt-in. */
  const [mode, setMode] = useState<Mode>("pixel");
  const [error, setError] = useState<string | null>(null);
  const [digit, setDigit] = useState("7");
  /** Continuous position in frame space, e.g. 4.37 = 37% from frame 4 to 5. */
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const stargazing = useStargazing();

  // The component itself is mounted on scroll-in by DeferredMount (app/lab),
  // so there is no boot gate left to wait on: fetch on first render.
  useEffect(() => {
    loadTrajectories()
      .then(setData)
      .catch((e: Error) => setError(e.message));
    // Resolves null when ascii_traj.json isn't there, which disables the toggle.
    loadAsciiTraj()
      .then(setAscii)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Pause playback off-screen — separate from the mount above, which already
  // happened once by the time this figure exists at all.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pixelFrames = data?.byDigit[digit] ?? null;
  const asciiFrames = ascii?.byDigit[digit] ?? null;
  const frames: unknown[] | null = mode === "ascii" ? asciiFrames : pixelFrames;
  const total = frames?.length ?? 0;

  // Continuous playback. Paused off-screen so a scrolled-past figure costs nothing.
  useEffect(() => {
    if (!playing || !frames || !visible || stargazing) return;
    const end = frames.length - 1;
    let raf = 0;
    let last = 0;
    let dwellUntil = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!last) last = now;
      const dt = now - last;
      if (dt < MIN_FRAME_MS) return; // throttle without dropping elapsed time
      last = now;

      if (dwellUntil) {
        if (now < dwellUntil) return;
        dwellUntil = 0;
        posRef.current = 0;
        setPos(0);
        return;
      }

      // Clamp dt so a backgrounded tab doesn't skip the whole trajectory.
      const next = posRef.current + Math.min(dt, 120) / STEP_MS;
      if (next >= end) {
        posRef.current = end;
        setPos(end);
        dwellUntil = now + END_DWELL_MS;
        return;
      }
      posRef.current = next;
      setPos(next);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, frames, visible, stargazing]);

  const reset = useCallback(() => {
    posRef.current = 0;
    setPos(0);
  }, []);

  const pick = useCallback(
    (d: string) => {
      setDigit(d);
      reset();
      setPlaying(true);
    },
    [reset],
  );

  // Pixel: blend the two frames either side of `pos` — the intensities are
  // continuous, so interpolating decouples smoothness from frame count.
  const grids = useMemo(() => {
    if (mode !== "pixel" || !pixelFrames) return null;
    const i0 = Math.min(Math.floor(pos), pixelFrames.length - 1);
    const i1 = Math.min(i0 + 1, pixelFrames.length - 1);
    const f = pos - i0;
    return {
      xt: lerpReshape(pixelFrames[i0].xt, pixelFrames[i1].xt, f, GRID_WIDTH),
      x0: lerpReshape(pixelFrames[i0].x0, pixelFrames[i1].x0, f, GRID_WIDTH),
    };
  }, [mode, pixelFrames, pos]);

  // ASCII: step, never interpolate. These are discrete token indices — blending
  // index 3 and index 7 is meaningless, and a cell commits in one step by design.
  // Snapping is the honest render of a mask-resolve.
  const asciiLines = useMemo(() => {
    if (mode !== "ascii" || !asciiFrames || !ascii) return null;
    const i = Math.min(Math.floor(pos), asciiFrames.length - 1);
    const fr = asciiFrames[i];
    const { vocab, maskId, rows, cols } = ascii;
    return {
      xt: cellsToLines(fr.xt, vocab, maskId, rows, cols),
      x0: cellsToLines(fr.x0, vocab, maskId, rows, cols),
      masked: maskCount(fr.xt, maskId),
      cells: rows * cols,
    };
  }, [mode, asciiFrames, ascii, pos]);

  const missing = data !== null && !frames;
  const isPlaceholder = data?.meta?.synthetic === true;
  const shownStep = Math.min(Math.floor(pos) + 1, total);
  const progress = total > 1 ? pos / (total - 1) : 0;

  const readout = total
    ? mode === "ascii" && asciiLines
      ? `${asciiLines.masked}/${asciiLines.cells} masked · step ${shownStep}/${total}`
      : `step ${String(shownStep).padStart(2, "0")}/${total}`
    : copy.lab.diffusion.statusLoading;

  return (
    <div ref={rootRef}>
      <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-mut">
        {copy.lab.s1Intro}
      </p>
      <InstrumentFigure
        n="S1"
        id="diffusion"
        caption={copy.lab.diffusion.figureCaption}
        readout={readout}
      >
        {/* Names the ACTIVE model — pixel is Gaussian (continuous), ascii is
            absorbing-state (discrete). That distinction is the whole reason
            this is one component with a toggle, not two panels. */}
        {/* pr-56 keeps the heading clear of the figure's absolutely-positioned
            readout, which runs to "196/392 masked · step 16/32" at its longest
            (the ascii mode's readout; the longest of any figure on the page). */}
        <h2 className="mt-1 mb-2 pr-56 text-[22px] font-semibold text-ink">
          {mode === "ascii" ? copy.lab.diffusion.headingDiscrete : copy.lab.diffusion.headingContinuous}
        </h2>
        <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-mut">
          {mode === "ascii" ? copy.lab.diffusion.ledeAscii : copy.lab.diffusion.ledePixel}
        </p>

        {isPlaceholder ? (
          <div className="mb-4">
            <Note tag={copy.lab.diffusion.notice.tag}>
              {copy.lab.diffusion.notice.body}
              {copy.lab.diffusion.notice.path}
              {copy.lab.diffusion.notice.tail}
            </Note>
          </div>
        ) : null}

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs text-mut/60">{copy.lab.diffusion.modelLabel}</span>
          {(["pixel", "ascii"] as Mode[]).map((m) => {
            // ascii is gated on the file being present, not stubbed.
            const ready = m === "pixel" || ascii !== null;
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  reset();
                  setPlaying(true);
                }}
                disabled={!ready}
                aria-pressed={m === mode}
                title={ready ? undefined : copy.lab.diffusion.asciiUnavailable}
                className={`border px-3 py-1.5 font-mono text-xs transition-colors ${
                  m === mode
                    ? "border-link text-link"
                    : ready
                      ? "border-rule text-mut hover:border-mut hover:text-ink"
                      : "cursor-not-allowed border-rule/50 text-mut/40"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        <p className="mb-6 font-mono text-[11px] text-mut/60">{copy.lab.diffusion.frozenNote}</p>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs text-mut/60">{copy.lab.diffusion.digitLabel}</span>
          {DIGITS.map((d) => {
            const available =
              mode === "ascii" ? Boolean(ascii?.byDigit[d]) : !data || Boolean(data.byDigit[d]);
            return (
              <button
                key={d}
                onClick={() => pick(d)}
                disabled={!available}
                aria-pressed={d === digit}
                className={`size-8 border font-mono text-sm transition-colors ${
                  d === digit
                    ? "border-ok text-ok"
                    : available
                      ? "border-rule text-mut hover:border-mut hover:text-ink"
                      : "cursor-not-allowed border-rule/50 text-mut/40"
                }`}
              >
                {d}
              </button>
            );
          })}

          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!frames}
            className="ml-auto border border-rule px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-mut hover:text-ink disabled:opacity-40"
          >
            {playing ? copy.lab.diffusion.pause : copy.lab.diffusion.play}
          </button>
          <button
            onClick={() => {
              reset();
              setPlaying(true);
            }}
            disabled={!frames}
            className="border border-rule px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-mut hover:text-ink disabled:opacity-40"
          >
            {copy.lab.diffusion.replay}
          </button>
        </div>

        {error ? (
          <p className="py-16 text-center font-mono text-xs text-red-ink">
            {copy.lab.diffusion.errorPrefix}
            {error}
          </p>
        ) : missing ? (
          <p className="py-16 text-center font-mono text-xs text-mut/60">
            {copy.lab.diffusion.missingPre}
            {digit}
            {copy.lab.diffusion.missingPost}
          </p>
        ) : !grids && !asciiLines ? (
          <p className="py-16 text-center font-mono text-xs text-mut/60">
            {copy.lab.diffusion.loadingTrajectories}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <figure className="flex flex-col items-center gap-4">
              {asciiLines ? (
                // line-height 1, no tracking: the 28x14 shape is already aspect
                // corrected on the model side. Squeezing it re-stretches the digit.
                <AsciiLines
                  lines={asciiLines.xt}
                  tint="ink"
                  lineHeight={1}
                  letterSpacing="0"
                  label={`Committed cells at step ${shownStep} of ${total}`}
                />
              ) : (
                <AsciiGrid
                  grid={grids!.xt}
                  tint="ink"
                  label={`Noisy state x_t at step ${shownStep} of ${total}`}
                />
              )}
              <figcaption className="text-center font-mono text-[11px] text-mut/60">
                <span className="text-mut">{copy.lab.diffusion.xtLabel}</span> ·{" "}
                {mode === "ascii" ? copy.lab.diffusion.xtCommitted : copy.lab.diffusion.xtNoisy}
              </figcaption>
            </figure>

            <figure className="flex flex-col items-center gap-4">
              {asciiLines ? (
                <AsciiLines
                  lines={asciiLines.x0}
                  tint="teal"
                  lineHeight={1}
                  letterSpacing="0"
                  label={`Predicted grid at step ${shownStep} of ${total}`}
                />
              ) : (
                <AsciiGrid
                  grid={grids!.x0}
                  tint="teal"
                  label={`Predicted clean image x-hat-0 at step ${shownStep} of ${total}`}
                />
              )}
              <figcaption className="text-center font-mono text-[11px] text-mut/60">
                <span className="text-ok">{copy.lab.diffusion.x0Label}</span> ·{" "}
                {mode === "ascii" ? copy.lab.diffusion.x0Guess : copy.lab.diffusion.x0Predicted}
              </figcaption>
            </figure>
          </div>
        )}

        <div
          className="mt-6 h-px w-full bg-rule"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={shownStep}
          aria-label={copy.lab.diffusion.progressAria}
        >
          <div className="h-px bg-ok" style={{ width: `${progress * 100}%` }} />
        </div>
      </InstrumentFigure>
    </div>
  );
}
