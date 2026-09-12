"use client";

import { useEffect, useRef } from "react";

/**
 * DeskField — the live particle field on the desk behind the sheet.
 *
 * Ported from the approved mockup (vB2.1, `#field` + its `<script>`): a flow
 * field of drifting particles that scatter red-hot near the cursor, painted
 * with a trail-fade rather than a clear each frame. Self-managing: mounts
 * once in `app/layout.tsx` as the first child of `<body>`, before
 * `{children}`, so it paints behind every page (see the html/body split in
 * `globals.css` — `body` must stay transparent or this vanishes underneath
 * it).
 *
 * Three budgets on top of the mockup, all load-bearing:
 * - `matchMedia("(min-width: 880px)")` gates the whole loop AND hides the
 *   canvas below it (not just an idle repaint) — a phone never runs this.
 *   Listened live, so crossing the boundary starts/stops it without a
 *   reload.
 * - `prefers-reduced-motion: reduce` paints a single static frame and never
 *   schedules a loop at all, independent of the width gate above.
 * - The frame gate is 40ms (~25fps) and every particle draw is skipped
 *   outright on `document.hidden`, on top of a hard-forced DPR of 1 (canvas
 *   backing size tracks `innerWidth`/`innerHeight` directly — never
 *   multiplied by `devicePixelRatio`).
 */
export function DeskField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const FRAME_MS = 40;
    const MAX_PARTICLES = 450;
    const CELL_DIVISOR = 4200;
    const SCATTER_RADIUS = 120;
    const SCATTER_RADIUS_SQ = SCATTER_RADIUS * SCATTER_RADIUS;
    const IDLE_COLOR = "rgba(154,148,138,0.3)";
    const HOT_COLOR = "rgba(229,53,43,0.45)";
    const STATIC_COLOR = "rgba(154,148,138,0.26)";
    const TRAIL_FILL = "rgba(12,11,9,0.18)";
    const DESK_FILL = "#0c0b09";

    const gateQuery = window.matchMedia("(min-width: 880px)");
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    type Particle = { x: number; y: number; vx: number; vy: number };

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let rafId = 0;
    let last = 0;
    let active = false;
    const mouse = { x: -9000, y: -9000 };

    function seedParticles() {
      const count = Math.min(
        MAX_PARTICLES,
        Math.floor((width * height) / CELL_DIVISOR),
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
      }));
    }

    function resize() {
      // DPR forced to 1: the backing store tracks CSS pixels 1:1, never
      // `* devicePixelRatio` — part of the budget, not an oversight.
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
    }

    function flow(px: number, py: number, t: number) {
      return (
        (Math.sin(px * 0.0015 + t * 0.00019) +
          Math.cos(py * 0.0018 - t * 0.00015)) *
        Math.PI
      );
    }

    function paintStatic() {
      ctx!.fillStyle = DESK_FILL;
      ctx!.fillRect(0, 0, width, height);
      for (const p of particles) {
        ctx!.fillStyle = STATIC_COLOR;
        ctx!.fillRect(p.x, p.y, 1.3, 1.3);
      }
    }

    function step(t: number) {
      if (!active) return;
      rafId = requestAnimationFrame(step);
      if (document.hidden || t - last < FRAME_MS) return;
      last = t;

      ctx!.fillStyle = TRAIL_FILL;
      ctx!.fillRect(0, 0, width, height);

      for (const p of particles) {
        const a = flow(p.x, p.y, t);
        p.vx += Math.cos(a) * 0.04;
        p.vy += Math.sin(a) * 0.04;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        let hot = false;
        if (d2 < SCATTER_RADIUS_SQ) {
          hot = true;
          const d = Math.sqrt(d2) || 1;
          const f = (SCATTER_RADIUS - d) * 0.02;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }

        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x += width;
        if (p.x > width) p.x -= width;
        if (p.y < 0) p.y += height;
        if (p.y > height) p.y -= height;

        ctx!.fillStyle = hot ? HOT_COLOR : IDLE_COLOR;
        ctx!.fillRect(p.x, p.y, 1.3, 1.3);
      }
    }

    function startLoop() {
      if (active) return;
      active = true;
      last = 0;
      rafId = requestAnimationFrame(step);
    }

    function stopLoop() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(rafId);
    }

    // The gate: below 880px the canvas is hidden AND the loop is fully
    // stopped (not merely idling) — a phone should do zero work here.
    // Reduced-motion, independent of width, gets one static paint and no
    // loop at all.
    function applyMode() {
      const wide = gateQuery.matches;
      canvas!.style.display = wide ? "" : "none";
      if (!wide) {
        stopLoop();
        return;
      }
      if (reducedQuery.matches) {
        stopLoop();
        paintStatic();
      } else {
        startLoop();
      }
    }

    function onResize() {
      resize();
      applyMode();
    }

    function onPointerMove(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    resize();
    seedParticles();
    applyMode();

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove);
    gateQuery.addEventListener("change", applyMode);
    reducedQuery.addEventListener("change", applyMode);

    return () => {
      stopLoop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      gateQuery.removeEventListener("change", applyMode);
      reducedQuery.removeEventListener("change", applyMode);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="fixed inset-0 -z-10" />;
}
