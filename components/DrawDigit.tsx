"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TerminalPanel } from "./TerminalPanel";
import { AsciiLines } from "./AsciiGrid";
import { BootLog, useBootSequence } from "./ambience/BootLog";
import { CommandLine } from "./ambience/CommandLine";
import type { AsciiDiffusion } from "@/lib/ascii-diffusion";
import { classifyDrawing } from "@/lib/classify";
import {
  DEFAULT_DISSOLVE,
  DEFAULT_GUIDANCE,
  DEFAULT_STEPS,
  DEFAULT_STRENGTH,
  loadDrawModel,
  type AsciiFrame,
} from "@/lib/draw-model";

const CMD_NAME = "./sdedit";

type RunParams = {
  digit: number;
  strength: number;
  steps: number;
  guidance: number;
  dissolve: number;
};

/**
 * The params' defaults, and the command the boot types, from one source.
 *
 * ⚠️ These must agree exactly. The boot TYPES `BOOT_CMD` as plain text, then
 * CommandLine swaps real inputs in on top of it once the typing lands. If the two
 * disagree by so much as a decimal, the line visibly rewrites itself at the
 * handover. Order here is the order on screen.
 */
const DEFAULTS: RunParams = {
  digit: 7,
  strength: DEFAULT_STRENGTH,
  steps: DEFAULT_STEPS,
  guidance: DEFAULT_GUIDANCE,
  dissolve: DEFAULT_DISSOLVE,
};
/** Ranges are the module's real limits, not taste. See the notes on each below. */
const RANGES = {
  // Clamped module-side to tStart in [1, T-1], so the ends are safe: 0 barely
  // noises the drawing, 1 ignores it.
  strength: { min: 0, max: 1, step: 0.05 },
  // ⚠️ The module divides by (steps - 1). 1 would be a division by zero, so this
  // floor is load-bearing, not a taste call. Don't lower it to 1.
  steps: { min: 5, max: 40, step: 1, int: true },
  // A plain CFG multiplier: 0 is unconditional, 1 collapses to the pure
  // conditional, above that it over-steers. The output is clamped module-side.
  guidance: { min: 0, max: 5, step: 0.5 },
  // Free — closed form, zero model calls. 0 skips the dissolve entirely, which
  // the module documents.
  dissolve: { min: 0, max: 30, step: 1, int: true },
  digit: { min: 0, max: 9, step: 1, int: true },
};

const BOOT_CMD =
  `${CMD_NAME} --digit ${DEFAULTS.digit} --strength ${DEFAULTS.strength}` +
  ` --steps ${DEFAULTS.steps} --guidance ${DEFAULTS.guidance} --dissolve ${DEFAULTS.dissolve}`;
const BOOT_LINES = [
  "sdedit: noise your drawing ~60% -> denoise -> your strokes survive",
  "runtime: onnxruntime-web (webgpu, wasm fallback) · fully client-side",
  "weights: mnist_x0.onnx (26 MB, lazy on first stroke)",
];

/**
 * Pen width as a fraction of canvas width. THIS IS THE FEATURE'S FAILURE MODE.
 *
 * MNIST digits normalize into a 20x20 box, so a 280px canvas is downscaled ~14x.
 * A thin stroke vanishes entirely in that reduction, the model gets
 * off-distribution input, and it returns noise — which reads as the diffusion
 * being broken when the input was. ~10% feels comically fat while drawing and
 * lands at ~2px once normalized, which is what real MNIST strokes look like.
 *
 * Verified against the real model: at 28px on a 280px canvas the drawing survives
 * the reduction with ~76 ink cells. If output ever degrades to mush, re-render
 * `modelSpace()` to see what the model actually receives — that view is the
 * oracle, and it's two lines to put back.
 */
const PEN_FRAC = 0.1;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const INK = "#ffffff";
const PAPER = "#080a12";
/**
 * We draw white ink on near-black paper. The module's normalizeCanvas defaults to
 * `inkIsHigh: false` — dark ink on light paper — and inverts, so without this the
 * model receives a photographic negative: off-distribution input, garbage out,
 * and it reads as the diffusion being broken when the input was.
 */
const PREPROCESS_OPTS = { inkIsHigh: true } as const;

export function DrawDigit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  /**
   * Every sampler param, in one object.
   *
   * One object rather than five useStates because a re-run needs to hand
   * generate() the whole set with exactly one field overridden, and five separate
   * setters make that a stale-closure hunt every time. Each of these genuinely
   * reaches the module and produces a visibly different run — that is the entire
   * licence for making them editable (see ambience/CommandLine).
   */
  const [params, setParams] = useState<RunParams>(DEFAULTS);
  const digit = params.digit;
  /** The echo under the boot log: proof the number you typed did something. */
  const [echo, setEcho] = useState<string | null>(null);
  const [model, setModel] = useState<AsciiDiffusion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [frame, setFrame] = useState<AsciiFrame | null>(null);
  const [running, setRunning] = useState(false);
  /** True until the visitor picks a label by hand. Their choice wins from then
   *  on — re-classifying over a deliberate override would be obnoxious. */
  const [autoLabel, setAutoLabel] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const probed = useRef(false);
  const classifyTimer = useRef(0);

  const boot = useBootSequence(BOOT_CMD, BOOT_LINES);
  const booted = boot.done;

  // autoPick is async; read the flag through a ref so a hand-pick mid-classify
  // isn't clobbered by a stale closure.
  const autoLabelRef = useRef(autoLabel);
  autoLabelRef.current = autoLabel;

  const clearTo = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
  }, []);

  useEffect(() => {
    if (!booted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      clearTo(ctx, rect.width, rect.height);
      ctx.lineWidth = rect.width * PEN_FRAC;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      setHasInk(false);
    };
    setup();

    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(setup, 150); // resizing resets the buffer either way
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, [booted, clearTo]);

  /**
   * The drawing, in the space the model actually works in.
   *
   * preprocess() returns [0,1] but toAscii() and generate()'s x0Init both expect
   * [-1,1] — they do NOT compose despite the handoff listing them back to back.
   * Feeding [0,1] to toAscii maps background 0 to mid-ramp and washes it grey.
   */
  const modelSpace = useCallback((m: AsciiDiffusion, canvas: HTMLCanvasElement) => {
    const norm = m.preprocess(canvas, PREPROCESS_OPTS);
    const out = new Float32Array(norm.length);
    for (let i = 0; i < norm.length; i++) out[i] = norm[i] * 2 - 1;
    return out;
  }, []);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    // First stroke starts the ~26MB download, never page load. They can keep
    // drawing while it lands.
    if (!probed.current) {
      probed.current = true;
      setLoading(true);
      loadDrawModel()
        .then(setModel)
        .catch((err: Error) => setLoadErr(err.message))
        .finally(() => setLoading(false));
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = at(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y); // a tap with no drag still leaves a dot
    ctx.stroke();
    setHasInk(true);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = at(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    // Debounced: a classify is 10 forwards (~0.3-0.5s), so wait for the pen to
    // actually stop rather than firing on every stroke of a multi-stroke digit.
    window.clearTimeout(classifyTimer.current);
    classifyTimer.current = window.setTimeout(() => void autoPick(), 450);
  };

  /**
   * Guess the label from the drawing, using the diffusion model itself.
   *
   * A suggestion, never a verdict: it only moves the picker while the visitor
   * hasn't chosen one, and the picker stays visible either way. The handoff is
   * explicit that a silent misclassification reads as the diffusion failing when
   * it didn't — so the guess has to be visible and correctable.
   */
  const autoPick = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !model || running || classifying) return;
    setClassifying(true);
    try {
      const { digit: guess } = await classifyDrawing(model, canvas, modelSpace(model, canvas));
      // Re-check: they may have picked by hand while this was running.
      setParams((p) => (autoLabelRef.current ? { ...p, digit: guess } : p));
    } catch {
      // A failed guess is not worth surfacing — the picker still works.
    } finally {
      setClassifying(false);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    clearTo(ctx, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
    setHasInk(false);
    setFrame(null);
    setAutoLabel(true); // fresh drawing, guess again
    window.clearTimeout(classifyTimer.current);
  };

  /**
   * The ONLY path that runs the model. Every re-run goes through here.
   *
   * ⚠️ That is deliberate and it is the feature's trap. `generate()` in the module
   * calls `normalizeCanvas(canvas)` bare, with no way to pass `inkIsHigh` — so we
   * hand it `x0Init`, which fully replaces that internal path. A re-run that built
   * its own call and forgot would feed the model a photographic negative: no
   * error, just plausible garbage that reads as the diffusion being broken. Add a
   * second call site and you will eventually add that bug.
   */
  const generate = useCallback(
    async (over?: Partial<RunParams>) => {
      const canvas = canvasRef.current;
      if (!canvas || !model || running) return;
      setRunning(true);
      try {
        const x0Init = modelSpace(model, canvas);
        // `over` is not a convenience. A param commit re-runs in the same tick it
        // calls setState, so `params` here is still the OLD value — reading it
        // would re-run with exactly the number the visitor just changed away
        // from, and the param would look broken. The new value comes in directly.
        const p = { ...params, ...over };

        await model.generate({
          canvas,
          x0Init,
          ...p,
          // Render as each frame computes. The computation IS the animation, so
          // there is nothing to spin on — never await the run and then play it back.
          onFrame: (f) => setFrame(f),
        });
      } catch (err) {
        setLoadErr((err as Error).message);
      } finally {
        setRunning(false);
        setEcho(null);
      }
    },
    [model, running, params, modelSpace],
  );

  /** A run to redo: something already ran, there's ink, and the model is here. */
  const canRerun = Boolean(frame && hasInk && model && !running);

  /**
   * Commit a param, then show it doing something.
   *
   * Only re-runs when there IS a run to redo. Changing a number before drawing
   * anything shouldn't invent a run out of nothing — the value just waits for the
   * next `generate`.
   */
  const commitParam = useCallback(
    (key: keyof RunParams, flag: string, next: number) => {
      setParams((p) => ({ ...p, [key]: next }));
      if (!canRerun) return;
      setEcho(`re-running ${flag} ${next}…`);
      void generate({ [key]: next });
    },
    [canRerun, generate],
  );

  /** Anything off its default. Drives the reset affordance, which only appears
   *  once there's something to reset. */
  const dirty = (Object.keys(DEFAULTS) as (keyof RunParams)[]).some(
    (k) => params[k] !== DEFAULTS[k],
  );

  const reset = useCallback(() => {
    setParams(DEFAULTS);
    if (!canRerun) return;
    setEcho("re-running with defaults…");
    void generate(DEFAULTS);
  }, [canRerun, generate]);

  const ready = model !== null;
  const status = !booted
    ? "booting"
    : running && frame
      ? `${frame.phase} ${frame.step + 1}/${frame.total}`
      : loading
        ? "fetching weights…"
        : ready
          ? "ready"
          : "draw to load";

  return (
    <div ref={boot.ref}>
      <TerminalPanel
        label={`sdedit --digit ${digit} --strength ${DEFAULT_STRENGTH}`}
        status={status}
        notice={
          booted && loadErr ? (
            <>
              <span className="text-indigo">model failed to load</span>: {loadErr}
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
              disabled={running}
              dirty={dirty}
              hint="edit any number"
              onReset={reset}
              // Order must match BOOT_CMD, or the line rewrites at the handover.
              items={[
                { kind: "param", flag: "--digit", value: params.digit, ...RANGES.digit,
                  onCommit: (v) => {
                    setAutoLabel(false); // typing a label is picking one
                    commitParam("digit", "--digit", v);
                  } },
                { kind: "param", flag: "--strength", value: params.strength, ...RANGES.strength,
                  onCommit: (v) => commitParam("strength", "--strength", v) },
                { kind: "param", flag: "--steps", value: params.steps, ...RANGES.steps,
                  onCommit: (v) => commitParam("steps", "--steps", v) },
                { kind: "param", flag: "--guidance", value: params.guidance, ...RANGES.guidance,
                  onCommit: (v) => commitParam("guidance", "--guidance", v) },
                { kind: "param", flag: "--dissolve", value: params.dissolve, ...RANGES.dissolve,
                  onCommit: (v) => commitParam("dissolve", "--dissolve", v) },
              ]}
            />
          }
        />

        {!booted ? null : (
          <>
            <h2 className="mt-6 mb-2 text-2xl tracking-tight">Draw a digit</h2>
            <p className="mb-8 max-w-2xl leading-relaxed text-muted">
              Draw one, pick its label, and watch it dissolve into static and re-form.
              This is <span className="text-ink">SDEdit</span>: your drawing is noised
              about 60% of the way to pure static and then denoised back, so the coarse
              structure is never destroyed. Your slant and your strokes survive into the
              result. It is genuinely your digit being cleaned up, not a lookalike
              fetched from the model. The whole thing runs on your device; nothing is
              sent anywhere.
            </p>

            <div className="flex flex-wrap items-start gap-6">
              <figure>
                <canvas
                  ref={canvasRef}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  // touch-none or a touch drag scrolls the page instead of
                  // drawing. Safe here: a small box, not the full-width hero.
                  className="aspect-square w-[280px] max-w-full cursor-crosshair touch-none rounded border border-line"
                  aria-label={`Drawing canvas for digit ${digit}`}
                  role="img"
                />
                <figcaption className="mt-3 w-[280px] max-w-full font-mono text-[11px] leading-relaxed text-faint">
                  your drawing · the pen is deliberately fat, so the strokes survive
                  being downscaled 14x
                </figcaption>
              </figure>

              <figure>
                <div className="flex aspect-square w-[280px] max-w-full items-center justify-center rounded border border-line">
                  {frame ? (
                    // xt, not x0: xt IS the effect — drawing, then static, then
                    // digit. x0 during the dissolve is just the drawing held
                    // still, so rendering it would hide the dissolve entirely.
                    <AsciiLines
                      lines={frame.ascii.xt}
                      tint={frame.phase === "dissolve" ? "ink" : "teal"}
                      fontSize={13}
                      lineHeight={1}
                      letterSpacing="0"
                      label={`${frame.phase} frame ${frame.step + 1} of ${frame.total}`}
                    />
                  ) : (
                    <span className="px-6 text-center font-mono text-[11px] leading-relaxed text-faint">
                      {loading
                        ? "fetching weights…"
                        : ready
                          ? "hit generate"
                          : "draw to load the model"}
                    </span>
                  )}
                </div>
                <figcaption className="mt-3 w-[280px] max-w-full font-mono text-[11px] leading-relaxed text-faint">
                  {frame ? (
                    <>
                      <span className={frame.phase === "dissolve" ? "text-ink" : "text-teal"}>
                        {frame.phase}
                      </span>{" "}
                      · {frame.step + 1}/{frame.total}
                      {frame.phase === "dissolve"
                        ? " · forward process, no model calls"
                        : " · the model running"}
                    </>
                  ) : (
                    "the result · your strokes survive the noise"
                  )}
                </figcaption>
              </figure>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="mr-1 font-mono text-xs text-faint">
                label
                {autoLabel ? (
                  <span className="ml-2 text-teal">
                    {classifying ? "· guessing…" : model ? "· auto" : ""}
                  </span>
                ) : (
                  <span className="ml-2 text-indigo">· yours</span>
                )}
              </span>
              {DIGITS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setAutoLabel(false); // their pick wins from here
                    // Same path as editing --digit in the command line: the two
                    // are one control shown twice and must not drift apart.
                    commitParam("digit", "--digit", d);
                  }}
                  aria-pressed={d === digit}
                  className={`size-8 rounded border font-mono text-sm transition-colors ${
                    d === digit
                      ? "border-teal text-teal"
                      : "border-line text-muted hover:border-faint hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}

              <button
                onClick={clear}
                disabled={!hasInk || running}
                className="ml-auto rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
              >
                clear
              </button>
              <button
                // Not `onClick={generate}`: that hands the MouseEvent to `over`,
                // which spreads straight into the model's options.
                onClick={() => void generate()}
                disabled={!ready || !hasInk || running}
                title={ready ? undefined : "draw once to fetch the weights"}
                className="rounded border border-teal/60 px-3 py-1.5 font-mono text-xs text-teal transition-colors hover:border-teal disabled:cursor-not-allowed disabled:border-line disabled:text-faint"
              >
                {running ? "sampling…" : "generate"}
              </button>
            </div>

            <p className="mt-4 max-w-2xl font-mono text-[11px] leading-relaxed text-faint">
              The model is class-conditional, so it needs a label. That guess comes
              from the diffusion model itself: it predicts the finished digit under all
              ten labels from identical noise, and whichever best explains your strokes
              wins. No second model. It&rsquo;s a suggestion, so override it if it&rsquo;s
              wrong. Worth trying anyway: draw a 7 and ask for a{" "}
              <span className="text-indigo">4</span>. You can watch conditioning fight
              your drawing.
            </p>

          </>
        )}
      </TerminalPanel>
    </div>
  );
}
