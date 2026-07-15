"use client";

import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { TerminalPanel } from "./TerminalPanel";
import { BootLog, useBootSequence } from "./ambience/BootLog";
import {
  DDPM_STEPS,
  FLOW_STEPS,
  ddpmPath,
  flowPath,
  targetFor,
  sampleStart,
  twoMoons,
  type Vec,
} from "@/lib/sample-space";

const BOOT_CMD = "./sample_space --target two-moons --compare ddpm,flow";
const BOOT_LINES = [
  "building 2d target manifold (two interleaving half-moons)",
  `ddpm: ${DDPM_STEPS} stochastic steps · flow: ${FLOW_STEPS} deterministic steps`,
  "hand-drawn fields, no weights loaded -> ready",
];

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
  ddpm: "143, 136, 221", // indigo — stochastic
  flow: "93, 202, 165", // teal — deterministic
};

function SamplePanel({
  kind,
  handleRef,
  onPick,
}: {
  kind: Kind;
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
    manifoldRef.current = twoMoons();

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
      ctx.fillStyle = "#080a12";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(122, 129, 153, 0.28)";
      for (const p of manifoldRef.current) {
        ctx.fillRect(p.x * w - 0.6, p.y * h - 0.6, 1.2, 1.2);
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
      ctx.strokeStyle = `rgba(${rgb}, ${(alpha * 0.5).toFixed(3)})`;
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

    const start = () => {
      if (running || reduced) return;
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
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

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
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [kind]);

  return (
    <canvas
      ref={canvasRef}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
      className="block aspect-[4/3] w-full cursor-crosshair rounded border border-line"
      aria-hidden="true"
    />
  );
}

export function SampleSpace() {
  const ddpmRef = useRef<PanelHandle | null>(null);
  const flowRef = useRef<PanelHandle | null>(null);
  const boot = useBootSequence(BOOT_CMD, BOOT_LINES);
  const booted = boot.done;

  // One start feeds both panels — that shared origin is the whole comparison.
  const spawn = useCallback((start: Vec) => {
    ddpmRef.current?.spawn(start);
    flowRef.current?.spawn(start);
  }, []);

  useEffect(() => {
    if (!booted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    spawn(sampleStart(Math.random));
    const id = setInterval(() => spawn(sampleStart(Math.random)), SPAWN_EVERY_MS);
    return () => clearInterval(id);
  }, [booted, spawn]);

  return (
    <div ref={boot.ref}>
      <TerminalPanel
        label="sample-space --compare ddpm,flow"
        status={booted ? "illustrative" : "booting"}
        notice={
          booted ? (
            <>
              <span className="text-indigo">illustrative</span>. Hand-drawn fields on a
              2D toy distribution. No model weights are loaded or run here.
            </>
          ) : null
        }
      >
        <BootLog typed={boot.typed} printed={boot.printed} done={booted} />

        {!booted ? null : (
          <>
            <h2 className="mt-6 mb-2 text-2xl tracking-tight">Sample space</h2>
            <p className="mb-8 max-w-2xl leading-relaxed text-muted">
              The same two-moons target, the same starting point, two ways of getting
              there. Click either panel to launch a trajectory from that point. Both
              panels run the same start, so the routes are directly comparable.
            </p>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <figure>
                <SamplePanel kind="ddpm" handleRef={ddpmRef} onPick={spawn} />
                <figcaption className="mt-3 font-mono text-[11px] text-faint">
                  <span className="text-indigo">DDPM</span> · stochastic (SDE),{" "}
                  {DDPM_STEPS} steps. Jagged; a different route every run.
                </figcaption>
              </figure>

              <figure>
                <SamplePanel kind="flow" handleRef={flowRef} onPick={spawn} />
                <figcaption className="mt-3 font-mono text-[11px] text-faint">
                  <span className="text-teal">Flow matching</span> · deterministic (ODE),{" "}
                  {FLOW_STEPS} steps. Smooth; the same route every time.
                </figcaption>
              </figure>
            </div>
          </>
        )}
      </TerminalPanel>
    </div>
  );
}
