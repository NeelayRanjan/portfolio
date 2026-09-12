"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AsciiGrid, AsciiLines } from "./AsciiGrid";
import { TerminalPanel } from "./TerminalPanel";
import { BootLog, useBootSequence } from "./ambience/BootLog";
import { CommandLine } from "./ambience/CommandLine";
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

type Mode = "pixel" | "ascii";

const CMD_NAME = copy.lab.diffusion.cmd;
/**
 * ⚠️ ONLY `--digit` IS LIVE HERE, AND THIS PANEL IS THE TRAP.
 *
 * §2b's sdedit runs a model, so every flag on it genuinely re-samples. This one
 * PLAYS A PRECOMPUTED TRAJECTORY — the frames are baked into diffusion_traj.json
 * and there is no model on the page to re-run. `--digit` works because all 10
 * digits are in the file. `--steps` and `--schedule` are properties of the export
 * itself, so they are frozen: verified against the file, the distinct frame count
 * across all 10 digits is [32], exactly one step count. There is nothing to snap
 * a typed value to.
 *
 * So they render as plain text with no input, no underline, no hover. The visible
 * difference between them and `--digit` is the point: it says which numbers are
 * real controls and which are facts about a file. Do NOT let --steps look
 * interactive. A new export with multiple step counts is the only thing that
 * changes this ruling, and re-running that check is the only way to know.
 */
// Command name from copy; the --flags stay inline (they're structural, and must
// match what CommandLine renders — see copy.ts).
const BOOT_CMD = `${copy.lab.diffusion.cmd} --digit 7 --steps 32 --schedule cosine`;
const BOOT_LINES = [...copy.lab.diffusion.bootLines];

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
        label={`${mode === "ascii" ? copy.lab.diffusion.labelAscii : copy.lab.diffusion.labelPixel} --digit ${digit}`}
        status={
          !booted
            ? copy.lab.diffusion.statusBooting
            : total
              ? mode === "ascii" && asciiLines
                ? `${asciiLines.masked}/${asciiLines.cells} masked · step ${shownStep}/${total}`
                : `step ${String(shownStep).padStart(2, "0")}/${total}`
              : copy.lab.diffusion.statusLoading
        }
        notice={
          booted && isPlaceholder ? (
            <>
              <span className="text-indigo">{copy.lab.diffusion.notice.tag}</span>
              {copy.lab.diffusion.notice.body}
              <span className="text-muted">{copy.lab.diffusion.notice.path}</span>
              {copy.lab.diffusion.notice.tail}
            </>
          ) : null
        }
      >
        <BootLog
          typed={boot.typed}
          printed={boot.printed}
          done={booted}
          command={
            <CommandLine
              name={CMD_NAME}
              // Order must match BOOT_CMD, or the line rewrites at the handover.
              items={[
                {
                  kind: "param",
                  flag: "--digit",
                  value: Number(digit),
                  min: 0,
                  max: 9,
                  step: 1,
                  int: true,
                  onCommit: (v) => pick(String(v)),
                },
                // Baked into the export, not knobs. See the ruling above.
                { kind: "frozen", flag: "--steps", value: "32" },
                { kind: "frozen", flag: "--schedule", value: "cosine" },
              ]}
              // NOT "edit any number": only --digit is live here, and the two
              // beside it are baked into the export.
              hint={copy.lab.diffusion.hint}
              dirty={digit !== "7"}
              onReset={() => pick("7")}
            />
          }
        />

        {!booted ? null : (
          <>
            {/* Names the ACTIVE model, which the teal anchor ("reverse process")
                deliberately does not — the anchor says where you are, this says
                what is running. It is also where the copy makes the distinction
                the two models actually have: pixel is Gaussian (continuous),
                ascii is absorbing-state (discrete). Never repeat the anchor. */}
            <h2 className="mt-6 mb-2 text-2xl tracking-tight">
              {mode === "ascii" ? copy.lab.diffusion.headingDiscrete : copy.lab.diffusion.headingContinuous}
            </h2>
            {mode === "ascii" ? (
              <p className="mb-8 max-w-[54ch] leading-relaxed text-muted">
                {copy.lab.diffusion.ledeAscii}
              </p>
            ) : (
              <p className="mb-8 max-w-[54ch] leading-relaxed text-muted">
                {copy.lab.diffusion.ledePixel}
              </p>
            )}
          </>
        )}

        <div className={`mb-4 flex flex-wrap items-center gap-2 ${booted ? "" : "hidden"}`}>
          <span className="mr-1 font-mono text-xs text-faint">{copy.lab.diffusion.modelLabel}</span>
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

        <div className={`mb-6 flex flex-wrap items-center gap-2 ${booted ? "" : "hidden"}`}>
          <span className="mr-1 font-mono text-xs text-faint">{copy.lab.diffusion.digitLabel}</span>
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
            {playing ? copy.lab.diffusion.pause : copy.lab.diffusion.play}
          </button>
          <button
            onClick={() => {
              reset();
              setPlaying(true);
            }}
            disabled={!frames}
            className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
          >
            {copy.lab.diffusion.replay}
          </button>
        </div>

        {!booted ? null : error ? (
          <p className="py-16 text-center font-mono text-xs text-indigo">
            {copy.lab.diffusion.errorPrefix}{error}
          </p>
        ) : missing ? (
          <p className="py-16 text-center font-mono text-xs text-faint">
            {copy.lab.diffusion.missingPre}{digit}{copy.lab.diffusion.missingPost}
          </p>
        ) : !grids && !asciiLines ? (
          <p className="py-16 text-center font-mono text-xs text-faint">
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
              <figcaption className="text-center font-mono text-[11px] text-faint">
                <span className="text-muted">{copy.lab.diffusion.xtLabel}</span> ·{" "}
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
              <figcaption className="text-center font-mono text-[11px] text-faint">
                <span className="text-teal">{copy.lab.diffusion.x0Label}</span> ·{" "}
                {mode === "ascii" ? copy.lab.diffusion.x0Guess : copy.lab.diffusion.x0Predicted}
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
          aria-label={copy.lab.diffusion.progressAria}
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
