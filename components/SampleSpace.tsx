"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { InstrumentFigure } from "./manuscript/InstrumentFigure";
import { Note } from "./manuscript/Row";
import {
  DDPM_STEPS,
  DEFAULT_TARGET,
  FLOW_STEPS,
  TARGETS,
  ddpmPath,
  flowPath,
  manifoldFor,
  targetFor,
  sampleStart,
  type TargetId,
  type Vec,
} from "@/lib/sample-space";
import { copy } from "@/content/copy";
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";

/**
 * `--target` is genuinely live; `--compare` never was.
 *
 * The ruling for this figure is "may change the animation, must not imply
 * weights re-ran". Swapping the manifold is exactly that: it's hand-drawn 2D
 * geometry, so there is nothing to re-train and nothing to fake — the figure
 * stays as real (and as illustrative) as it was. `ddpm,flow` is frozen because
 * both panels ARE the entire comparison; there is no third field to switch to.
 */

/** How long a trajectory takes to draw, and how long it lingers before fading. */
const DRAW_MS = 1500;
const HOLD_MS = 1400;
const FADE_MS = 700;
const SPAWN_EVERY_MS = 2600;
const MAX_TRAILS = 4;
const BASE_FRAME_MS = 1000 / 60;

type Kind = "ddpm" | "flow";

type Trail = {
  pts: Vec[];
  /** ms since spawn; drives draw progress, then hold, then fade. */
  age: number;
};

export type PanelHandle = { spawn: (start: Vec) => void };

const TINT: Record<Kind, string> = {
  ddpm: "123, 167, 220", // --color-link — stochastic
  flow: "99, 198, 140", // --color-ok — deterministic
};

function SamplePanel({
  kind,
  target,
  handleRef,
  onPick,
}: {
  kind: Kind;
  target: TargetId;
  handleRef: React.RefObject<PanelHandle | null>;
  onPick: (start: Vec) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef<Trail[]>([]);
  const manifoldRef = useRef<Vec[]>([]);

  useImperativeHandle(handleRef, () => ({
    spawn(start: Vec) {
      const manifold = manifoldRef.current;
      if (!manifold.length) return;
      const end = targetFor(manifold, start);
      const pts =
        kind === "flow" ? flowPath(start, end) : ddpmPath(start, end, Math.random);
      trailsRef.current.push({ pts, age: 0 });
      if (trailsRef.current.length > MAX_TRAILS) trailsRef.current.shift();
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    manifoldRef.current = manifoldFor(target);
    // Every live trail ends on the OLD manifold, so they'd hang in mid-air
    // pointing at a shape that is no longer there.
    trailsRef.current = [];

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let elapsed = 0;
    const rgb = TINT[kind];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawManifold = () => {
      ctx.fillStyle = "#0c0b09"; // --color-desk
      ctx.fillRect(0, 0, w, h);
      // The target-distribution backdrop: light and opaque enough to read as a
      // cloud without competing with the accent-coloured trails on top.
      ctx.fillStyle = "rgba(154, 148, 138, 0.5)"; // --color-mut
      for (const p of manifoldRef.current) {
        ctx.fillRect(p.x * w - 0.7, p.y * h - 0.7, 1.4, 1.4);
      }
    };

    const drawTrail = (trail: Trail) => {
      const { pts, age } = trail;
      const progress = Math.min(1, age / DRAW_MS);
      const shown = Math.max(1, Math.floor(progress * (pts.length - 1)) + 1);

      let alpha = 1;
      if (age > DRAW_MS + HOLD_MS) {
        alpha = Math.max(0, 1 - (age - DRAW_MS - HOLD_MS) / FADE_MS);
      }
      if (alpha <= 0) return;

      // Connected segments...
      ctx.strokeStyle = `rgba(${rgb}, ${(alpha * 0.7).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < shown; i++) {
        const p = pts[i];
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // ...with a dot at each step: the hops.
      ctx.fillStyle = `rgba(${rgb}, ${(alpha * 0.95).toFixed(3)})`;
      for (let i = 0; i < shown; i++) {
        const p = pts[i];
        ctx.fillRect(p.x * w - 1.1, p.y * h - 1.1, 2.2, 2.2);
      }
    };

    const render = () => {
      drawManifold();
      for (const t of trailsRef.current) drawTrail(t);
    };

    const step = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(step);
      const dt = elapsed === 0 ? BASE_FRAME_MS : Math.min(now - elapsed, 48);
      elapsed = now;

      for (const t of trailsRef.current) t.age += dt;
      trailsRef.current = trailsRef.current.filter(
        (t) => t.age < DRAW_MS + HOLD_MS + FADE_MS,
      );
      render();
    };

    let inView = false;
    const start = () => {
      if (running || reduced || isStargazing()) return;
      running = true;
      elapsed = 0;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    render();

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    const unsubStargaze = subscribeStargaze((gazing) => {
      if (gazing) stop();
      else if (inView && !document.hidden) start();
    });

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        render();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      unsubStargaze();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [kind, target]);

  return (
    <canvas
      ref={canvasRef}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
      className="block aspect-[4/3] w-full cursor-crosshair border border-rule"
      aria-hidden="true"
    />
  );
}

export function SampleSpace() {
  const ddpmRef = useRef<PanelHandle | null>(null);
  const flowRef = useRef<PanelHandle | null>(null);
  const [target, setTarget] = useState<TargetId>(DEFAULT_TARGET);
  const shape = TARGETS.find((t) => t.id === target) ?? TARGETS[0];

  // One start feeds both panels — that shared origin is the whole comparison.
  const spawn = useCallback((start: Vec) => {
    ddpmRef.current?.spawn(start);
    flowRef.current?.spawn(start);
  }, []);

  // The component itself is mounted on scroll-in by DeferredMount (app/lab),
  // so this runs the moment the figure exists — no boot gate to wait on.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    spawn(sampleStart(Math.random));
    const id = setInterval(() => spawn(sampleStart(Math.random)), SPAWN_EVERY_MS);
    return () => clearInterval(id);
  }, [spawn]);

  return (
    <>
      <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-mut">
        {copy.lab.s3Intro}
      </p>
      <InstrumentFigure
        n="S3"
        id="sample-space"
        caption={copy.lab.sampleSpace.figureCaption}
        readout={copy.lab.sampleSpace.statusIllustrative}
      >
      {/* pr-28 keeps the heading clear of the figure's absolutely-positioned
          readout, which is always the static "illustrative" label here. */}
      <h2 className="mt-1 mb-2 pr-28 text-[22px] font-semibold text-ink">
        {copy.lab.sampleSpace.heading}
      </h2>
      <p className="mb-4 max-w-2xl text-[15px] leading-relaxed text-mut">
        {copy.lab.sampleSpace.lede.pre}
        <span className="text-ink">{copy.lab.sampleSpace.lede.target}</span>
        {copy.lab.sampleSpace.lede.post}
      </p>

      <div className="mb-6 max-w-2xl">
        <Note tag={copy.lab.sampleSpace.noticeTag}>{copy.lab.sampleSpace.noticeBody}</Note>
      </div>

      {/*
       * The target manifold, as a labeled segmented control — same state, same
       * behaviour as the boot command's `--target` select it replaces: picking a
       * new shape clears every live trail (see the effect above) and it's still
       * hand-drawn 2D geometry, so switching it never implies a model re-ran.
       */}
      <div className="mb-6 flex flex-col gap-1 font-mono text-[11px]">
        <span aria-hidden="true" className="text-mut">
          {copy.lab.sampleSpace.targetLabel}
        </span>
        <div className="flex flex-wrap" role="group" aria-label={copy.lab.sampleSpace.targetLabel}>
          {TARGETS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              aria-pressed={t.id === target}
              className={`border px-2.5 py-1 transition-colors ${i > 0 ? "-ml-px" : ""} ${
                t.id === target
                  ? "relative border-ok text-ok"
                  : "border-rule text-mut hover:border-mut hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <figure>
          <SamplePanel kind="ddpm" target={target} handleRef={ddpmRef} onPick={spawn} />
          <figcaption className="mt-4 font-mono text-[11px] text-mut/60">
            <span className="text-link">{copy.lab.sampleSpace.ddpmLabel}</span>
            {copy.lab.sampleSpace.ddpmCaptionPre}
            {DDPM_STEPS}
            {copy.lab.sampleSpace.ddpmCaptionPost}
          </figcaption>
        </figure>

        <figure>
          <SamplePanel kind="flow" target={target} handleRef={flowRef} onPick={spawn} />
          <figcaption className="mt-4 font-mono text-[11px] text-mut/60">
            <span className="text-ok">{copy.lab.sampleSpace.flowLabel}</span>
            {copy.lab.sampleSpace.flowCaptionPre}
            {FLOW_STEPS}
            {copy.lab.sampleSpace.flowCaptionPost}
          </figcaption>
        </figure>
      </div>

      <p className="mt-4 font-mono text-[11px] text-mut/60">
        {copy.lab.sampleSpace.targetCaptionPre}
        {shape.blurb}
      </p>
      </InstrumentFigure>
    </>
  );
}
