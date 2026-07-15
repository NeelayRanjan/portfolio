"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AsciiGrid, AsciiLines } from "./AsciiGrid";
import { TerminalPanel } from "./TerminalPanel";
import { BootLog, useBootSequence } from "./ambience/BootLog";
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

type Mode = "pixel" | "ascii";

const BOOT_CMD = "./x0_diffusion --digit 7 --steps 32 --schedule cosine";
const BOOT_LINES = [
  "resolving trajectory source /diffusion_traj.json",
  "decoding 10 digits x 32 frames, 28x28 row-major",
  "warming ascii ramp \" .:-=+*#%@\" -> ready",
];

/** Milliseconds per stored frame. Playback interpolates within this. */
const STEP_MS = 190;
/** Cap re-renders at ~30fps — past that the ramp barely changes and it's just churn. */
const MIN_FRAME_MS = 1000 / 30;
/** Hold on the finished sample before looping, so the result reads. */
const END_DWELL_MS = 750;

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function DiffusionVisualizer() {
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

  const boot = useBootSequence(BOOT_CMD, BOOT_LINES);
  const rootRef = boot.ref;
  const booted = boot.done;

  // The trajectory file is ~230KB gzipped — don't spend that on page load, and
  // don't spend it until the boot log says we're fetching it either.
  useEffect(() => {
    if (!booted) return;
    loadTrajectories()
      .then(setData)
      .catch((e: Error) => setError(e.message));
    // Resolves null when ascii_traj.json isn't there, which disables the toggle.
    loadAsciiTraj()
      .then(setAscii)
      .catch((e: Error) => setError(e.message));
  }, [booted]);

  // Separate from the boot gate: this one toggles, to pause playback off-screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  const pixelFrames = data?.byDigit[digit] ?? null;
  const asciiFrames = ascii?.byDigit[digit] ?? null;
  const frames: unknown[] | null = mode === "ascii" ? asciiFrames : pixelFrames;
  const total = frames?.length ?? 0;

  // Continuous playback. Paused off-screen so a scrolled-past panel costs nothing.
  useEffect(() => {
    if (!playing || !frames || !visible) return;
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
  }, [playing, frames, visible]);

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

  return (
    // Section owns the id and scroll offset; this ref only drives the lazy load.
    <div ref={rootRef}>
      <TerminalPanel
        label={`${mode === "ascii" ? "ascii-diffusion" : "x0-diffusion"} --digit ${digit}`}
        status={
          !booted
            ? "booting"
            : total
              ? mode === "ascii" && asciiLines
                ? `${asciiLines.masked}/${asciiLines.cells} masked · step ${shownStep}/${total}`
                : `step ${String(shownStep).padStart(2, "0")}/${total}`
              : "loading"
        }
        notice={
          booted && isPlaceholder ? (
            <>
              <span className="text-indigo">placeholder data</span>. These frames are
              synthetic, not output from a trained model: a bitmap digit run through a
              hand-rolled noising schedule, played backwards. Real trajectories drop into{" "}
              <span className="text-muted">/diffusion_traj.json</span> unchanged.
            </>
          ) : null
        }
      >
        <BootLog typed={boot.typed} printed={boot.printed} done={booted} />

        {!booted ? null : (
          <>
            <h2 className="mt-6 mb-2 text-2xl tracking-tight">
              {mode === "ascii" ? "ASCII diffusion" : "x0 diffusion"}
            </h2>
            {mode === "ascii" ? (
              <p className="mb-8 max-w-2xl leading-relaxed text-muted">
                A different model, and a different kind of corruption: masked cells
                resolve into characters. It starts with every cell masked and commits
                them one at a time, most-confident first. There is no noise anywhere in
                it. Once a cell commits it&rsquo;s frozen and never re-predicted, so the
                grid can only ever fill in, never flicker. On the left, what&rsquo;s
                committed so far, mask holes and all. On the right, the model&rsquo;s
                current guess for every cell, including the ones it hasn&rsquo;t
                decided yet.
              </p>
            ) : (
              <p className="mb-8 max-w-2xl leading-relaxed text-muted">
                Noise sharpens into a digit, one step at a time. On the left, the noisy
                state x_t resolving. On the right, the model&rsquo;s prediction of the
                finished digit from that step. This model predicts the clean image
                directly rather than the noise, which is why you get both at every step.
              </p>
            )}
          </>
        )}

        <div className={`mb-4 flex flex-wrap items-center gap-2 ${booted ? "" : "hidden"}`}>
          <span className="mr-1 font-mono text-xs text-faint">model</span>
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
                title={ready ? undefined : "ascii_traj.json not present"}
                className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
                  m === mode
                    ? "border-indigo text-indigo"
                    : ready
                      ? "border-line text-muted hover:border-faint hover:text-ink"
                      : "cursor-not-allowed border-line/50 text-faint/40"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        <div className={`mb-5 flex flex-wrap items-center gap-2 ${booted ? "" : "hidden"}`}>
          <span className="mr-1 font-mono text-xs text-faint">digit</span>
          {DIGITS.map((d) => {
            const available =
              mode === "ascii" ? Boolean(ascii?.byDigit[d]) : !data || Boolean(data.byDigit[d]);
            return (
              <button
                key={d}
                onClick={() => pick(d)}
                disabled={!available}
                aria-pressed={d === digit}
                className={`size-8 rounded border font-mono text-sm transition-colors ${
                  d === digit
                    ? "border-teal text-teal"
                    : available
                      ? "border-line text-muted hover:border-faint hover:text-ink"
                      : "cursor-not-allowed border-line/50 text-faint/40"
                }`}
              >
                {d}
              </button>
            );
          })}

          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!frames}
            className="ml-auto rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
          >
            {playing ? "pause" : "play"}
          </button>
          <button
            onClick={() => {
              reset();
              setPlaying(true);
            }}
            disabled={!frames}
            className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
          >
            replay
          </button>
        </div>

        {!booted ? null : error ? (
          <p className="py-16 text-center font-mono text-xs text-indigo">
            could not load trajectories: {error}
          </p>
        ) : missing ? (
          <p className="py-16 text-center font-mono text-xs text-faint">
            no trajectory for digit {digit} in this dataset
          </p>
        ) : !grids && !asciiLines ? (
          <p className="py-16 text-center font-mono text-xs text-faint">
            loading trajectories…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <figure className="flex flex-col items-center gap-3">
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
              <figcaption className="text-center font-mono text-[11px] text-faint">
                <span className="text-muted">x_t</span> ·{" "}
                {mode === "ascii" ? "committed so far" : "noisy state"}
              </figcaption>
            </figure>

            <figure className="flex flex-col items-center gap-3">
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
              <figcaption className="text-center font-mono text-[11px] text-faint">
                <span className="text-teal">x̂₀</span> ·{" "}
                {mode === "ascii" ? "current guess" : "predicted sample"}
              </figcaption>
            </figure>
          </div>
        )}

        <div
          className={`mt-6 h-px w-full bg-line ${booted ? "" : "hidden"}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={shownStep}
          aria-label="Reverse diffusion progress"
        >
          <div
            className="h-px bg-teal"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </TerminalPanel>
    </div>
  );
}
