"use client";

import { useCallback, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { loadHeadshotModel, type HeadshotModel } from "@/lib/headshot-model";

/**
 * The author photo, sampled live.
 *
 * The joke the site is entitled to make: a diffusion researcher's headshot is
 * not an `<img>`, it is his own tiny class-conditional model redrawing that
 * exact photo from fresh noise, in the visitor's browser. Three photos, three
 * classes, three buttons. The model is deliberately overfit, which is also the
 * safety property: it can only produce faces the owner approved.
 *
 * ⚠️ NOTHING MODEL-RELATED IS FETCHED AT REST. This sits in the masthead, the
 * first thing painted on the site, and the runtime it needs is ~24 MB. At rest
 * the box is a plain `<img>` of the real photo; the first press is what starts
 * the download (`loadHeadshotModel`, memoized). `scripts/verify-redesign.mjs`
 * asserts the no-request-at-rest half of that in a real browser.
 *
 * Division of labour, per the Constitution: `lib/headshot-diffusion.js` is
 * vendored verbatim from the model repo and owns every piece of math (the
 * cosine schedule, the DDIM step, the timestep sequence, the clamp). This file
 * owns the canvas, the buttons, the readout and the copy, and nothing else.
 * Three of the module's rules are load-bearing here:
 *   1. the site NEVER passes `t` — the module builds the raw 0..999 sequence;
 *   2. `xt` frames are UNBOUNDED, so they are clamped before display;
 *   3. `x0` (and the returned final sample) is ALREADY clamped, so it is not
 *      clamped again.
 *
 * Reduced-motion: the toy stays available, because it only ever runs on a
 * press. Same ruling as the draw and chess demos, and there is no ambient
 * motion here to suppress.
 */
export function HeadshotToy({
  /** Class indices that actually have a photo served, in order. From the
   *  server gate, which reads `k` out of `headshot_meta.json`. */
  photos,
  /** `meta.res` (128 today). The canvas backing store is exactly this and CSS
   *  upscales it with DEFAULT smoothing, per the bundle's integrator note:
   *  softness is expected at a 256px display size, nearest-neighbour blocks
   *  are not. (This is the opposite of the draw demo's 28px grids, which are
   *  `pixelated` on purpose.) */
  res,
}: {
  photos: number[];
  res: number;
}) {
  const t = copy.masthead.headshot;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sel, setSel] = useState(photos[0]);
  const [model, setModel] = useState<HeadshotModel | null>(null);
  const [loading, setLoading] = useState(false);
  /** Set when the loader resolves null: the photos are served but the weights
   *  aren't. Honest state, not a silent dead button. */
  const [absent, setAbsent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  /** Mirrors `running` synchronously. A double-press (or a press landing in the
   *  same tick as a state update) would run two samplers into one ORT session
   *  and one canvas; the buttons are disabled while running, but the ref is
   *  what actually makes it safe. Same shape as DrawDigit's `classifyingRef`. */
  const runningRef = useRef(false);
  const [step, setStep] = useState<{ i: number; n: number } | null>(null);
  /** True once anything has been painted. The canvas then replaces the `<img>`
   *  for good: the final frame IS the sampled photo, so there is nothing to
   *  revert to. */
  const [painted, setPainted] = useState(false);

  /**
   * One frame onto the 128px canvas.
   *
   * Frames are planar C-order ([1, C, R, R]), NOT interleaved RGBA: channel c
   * of pixel p lives at `c * R * R + p`. `clampForDisplay` is true only for
   * `xt`, which is unbounded; the final sample arrives pre-clamped and is
   * written straight through (`ImageData`'s Uint8ClampedArray saturates rather
   * than wrapping, so the write is safe either way).
   */
  const paint = useCallback(
    (data: Float32Array, channels: number, clampForDisplay: boolean) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const n = res * res;
      const img = ctx.createImageData(res, res);
      for (let p = 0; p < n; p++) {
        const o = p * 4;
        for (let ch = 0; ch < 3; ch++) {
          // A single-channel export would be grayscale; read plane 0 three
          // times rather than running off the end of the array.
          const v = data[(channels >= 3 ? ch : 0) * n + p];
          const s = clampForDisplay ? Math.min(1, Math.max(-1, v)) : v;
          img.data[o + ch] = Math.round((s + 1) * 127.5);
        }
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    },
    [res],
  );

  /**
   * The ONLY path that runs the model. Every press (a face, or resample) lands
   * here.
   *
   * The class index comes in as an argument rather than off `sel`: pressing a
   * face sets the selection and runs in the same tick, so reading state would
   * sample the photo the visitor just navigated away from. (Exactly the trap
   * DrawDigit documents for its param commits.)
   */
  const run = useCallback(
    async (idx: number) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setSel(idx);
      setRunning(true);
      setFailed(false);
      setStep(null);
      try {
        let m = model;
        if (!m) {
          setLoading(true);
          try {
            // First press starts the ~24 MB runtime + 1.55 MB of weights.
            m = await loadHeadshotModel();
          } finally {
            setLoading(false);
          }
          if (!m) {
            setAbsent(true); // gated: keep showing the real photo
            return;
          }
          setModel(m);
        }

        const final = await m.generate({
          session: m.session,
          ort: m.ort,
          meta: m.meta,
          classIdx: idx,
          // No `steps`: the module falls back to meta.steps_default, which is
          // the export's own number rather than one picked here.
          onFrame: ({ xt, step: i, total }) => {
            // Render INSIDE onFrame. The computation is the animation, so
            // there is no spinner to design. ⚠️ Nothing in here may throw:
            // the module's event-loop yield sits immediately after this call,
            // and skipping it locks the page (the draw demo's trap 3).
            paint(xt, m.meta.channels, true);
            setPainted(true);
            setStep({ i: i + 1, n: total });
          },
        });
        // The run's last state, kept. `final` is the module's return: with the
        // final alpha-bar at 1 it IS the last clamped x0, so it is the sampled
        // photo and is painted WITHOUT a second clamp.
        paint(final, m.meta.channels, false);
        setPainted(true);
      } catch {
        // ⚠️ `painted` has to go back to false, not just `failed` to true. A run
        // that dies mid-sampling after an earlier successful one would
        // otherwise leave whatever frame it got to (quite possibly raw noise)
        // on screen, still labelled as a sample of the photo. Reverting to the
        // real <img> is the honest state: the readout says the run failed, and
        // what you see is the photo itself again.
        setFailed(true);
        setPainted(false);
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    },
    [model, paint],
  );

  const altOf = (i: number) => t.photoAlts[i] ?? t.photoAltGeneric;
  /**
   * The part of the readout that is ANNOUNCED: terminal states only.
   *
   * ⚠️ The step counter is deliberately NOT in here. It ticks 25 times a run,
   * and a live region carrying it interrupts a screen reader 25 times per
   * press to read a number that was never the point. ChessPanel sets the
   * precedent: its `role="status"` carries the settled echo, not the search's
   * progress. Empty string while sampling, so the span stays mounted (a live
   * region inserted with its text already in place is unreliably announced)
   * and the finish is what speaks.
   */
  const liveStatus = failed
    ? t.statusFailed
    : absent
      ? t.statusAbsent
      : loading
        ? t.statusLoading
        : running
          ? ""
          : painted
            ? `${t.statusDone} · ${model?.build ?? ""}`
            : t.statusRest;

  return (
    <figure id="headshot-toy" className="w-full max-w-[256px]">
      <div className="relative aspect-square w-full border border-rule bg-desk">
        {/*
         * Both boxes live in the DOM from first render, and `hidden` swaps
         * them. The canvas has to exist before the first frame arrives (a
         * mount-on-paint canvas has no context to paint into), and `hidden`
         * takes it out of the a11y tree as well as the layout, so exactly one
         * of the two is ever announced. Painting into a display:none canvas
         * works fine.
         */}
        <img
          src={`/headshot/photos/${sel}.webp`}
          alt={altOf(sel)}
          hidden={painted}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas
          ref={canvasRef}
          width={res}
          height={res}
          hidden={!painted}
          role="img"
          // The photo's own alt text rides along. Without it, the description
          // of what the author actually looks like is gone the moment the
          // canvas takes over, and it never comes back.
          aria-label={`${t.canvasAria} ${photos.indexOf(sel) + 1}${t.faceAriaMid}${photos.length}. ${altOf(sel)}`}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {photos.map((i, n) => (
          <button
            key={i}
            onClick={() => void run(i)}
            // Honest controls: while a sampler is running, pressing another
            // face cannot do anything, so it must not look like it can.
            disabled={running}
            aria-pressed={i === sel}
            aria-label={`${t.faceAriaPre}${n + 1}${t.faceAriaMid}${photos.length}${t.faceAriaPost}`}
            className={`size-11 overflow-hidden border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              i === sel ? "border-ok" : "border-rule hover:border-mut"
            }`}
          >
            {/* The 96px derivative, not the 512² crop: these are 44px boxes,
                three of them, in first paint. The full-size files stay for the
                main display only.
                alt="": the button's own aria-label names it, and the face is
                already described by the big photo's alt above. */}
            <img
              src={`/headshot/photos/${i}_thumb.webp`}
              alt=""
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
        <button
          onClick={() => void run(sel)}
          disabled={running}
          aria-label={t.resampleAria}
          className="border border-rule px-2 py-1 font-mono text-[10px] text-mut transition-colors hover:border-mut hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.resample}
        </button>
      </div>

      {/* The readout, in two halves for one reason: what gets ANNOUNCED and
          what merely ticks. `role="status"` carries the settled state; the step
          counter is aria-hidden beside it, because it is the visual proof the
          model is running rather than something a screen reader needs 25 times
          a press. */}
      <p
        className={`mt-2 font-mono text-[10px] leading-relaxed ${
          failed ? "text-red-ink" : running || painted ? "text-warm" : "text-mut/60"
        }`}
      >
        <span role="status">{liveStatus}</span>
        {running && step ? (
          <span aria-hidden="true">{`${t.statusSampling} ${step.i}/${step.n}`}</span>
        ) : null}
      </p>

      <figcaption className="mt-2 font-mono text-[10px] leading-relaxed text-mut/60">
        {/* True in both states: at rest the box IS the loaded file, and saying
            otherwise before anyone has pressed anything would be the one kind
            of claim this whole section exists to avoid making. */}
        {painted ? t.captionLeadSampled : t.captionLeadRest}
        {t.captionBody}
      </figcaption>
    </figure>
  );
}
