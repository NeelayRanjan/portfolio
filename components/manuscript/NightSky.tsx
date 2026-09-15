"use client";

import { useEffect, useRef } from "react";
import { loadSky, type SkyData } from "@/lib/sky-data";
import {
  drawSky,
  nearestConstellation,
  precomputeStarFills,
  type Bodies,
  type Highlight,
  type Projected,
} from "@/lib/sky-render";
import {
  PLANETS,
  chartFor,
  lstDeg,
  moonEquatorial,
  moonPhase,
  planetEquatorial,
  simTimeMs,
  sunEquatorial,
} from "@/lib/sky-math";
import { CLICK_SLOP_PX, PAN_LIMIT_FRAC, rubberBand, springStep, type Vec } from "@/lib/sky-pan";
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";

/**
 * NightSky: the real sky over NASA Ames behind every page, replacing v2's
 * DeskField particles (spec: docs/superpowers/specs/2026-09-14-night-sky-design.md).
 *
 * Budgets, all load-bearing:
 * - One clock: the load instant, then SKY_SPEEDUP (180x). Angles come from
 *   it, never from frame counts (the Constitution's dt rule).
 * - ~20 fps at >=880px, ~10 fps below; frames skipped while document.hidden;
 *   DPR capped at 2 so stars stay crisp without a 3x backing store.
 * - Reduced motion: the real sky at the load instant, painted on change only.
 * - The catalog (~55 KB) is fetched after first paint; until it lands, or if
 *   it never does, the desk is plain dark. Nothing stands in for it.
 * - Phones get it too (owner call, 2026-09-14) with a mag 4.5 cut.
 * - Drag to pan (spec 2026-09-15 §3): mouse or pen on the desk in normal
 *   mode, any pointer anywhere while stargazing; a critically damped spring
 *   (lib/sky-pan.ts) brings the chart home on release, and the frame gate is
 *   lifted while a drag or the spring is live so the motion stays smooth.
 *   Reduced motion snaps home instead. The sky keeps turning throughout.
 *
 * `window.__sky` is a read-only snapshot for scripts/verify-redesign.mjs.
 */

const FRAME_MS_WIDE = 50;
const FRAME_MS_NARROW = 100;
const BODY_REFRESH_SIM_MS = 10 * 60_000;
const DPR_CAP = 2;
const HOVER_PX = 24;
/** Never start a pan on these: the page's own controls, and (Task 5) the card. */
const PAN_BLOCKERS = "a, button, input, select, textarea, label, summary, [role='button'], [data-sky-card]";

type SkySnapshot = {
  drawn: boolean;
  simMs: number;
  lstDeg: number;
  k: number;
  cx: number;
  cy: number;
  offset: Vec;
  dragging: boolean;
  frameMsMedian: number | null;
  highlight: string | null;
  label: { x: number; y: number; w: number; h: number } | null;
  segmentsFor: (abbr: string) => number[][];
};

export function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const narrowQ = window.matchMedia("(max-width: 879px)");
    const reducedQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const loadMs = Date.now();
    const win = window as Window & { __sky?: SkySnapshot };

    let alive = true;
    let sky: SkyData | null = null;
    let starFills: string[] = [];
    let width = 0;
    let height = 0;
    // The canvas's actual backing-store pixel size and DPR at last
    // reallocation, so a resize that lands on the same values (iOS URL-bar
    // collapse fires `resize` repeatedly, often without changing either) can
    // skip re-allocating the backing store and re-running setTransform —
    // both of which clear/scale the canvas and are wasted work when nothing
    // about its pixel dimensions actually changed.
    let lastPxW = -1;
    let lastPxH = -1;
    let lastDpr = -1;
    let bodies: Bodies | null = null;
    let bodiesSim = Number.NEGATIVE_INFINITY;
    let projected: Projected | null = null;
    let fontFamily = "monospace";
    let raf = 0;
    let last = 0;
    let running = false;
    let highlight: Highlight | null = null;
    const frameTimes: number[] = [];
    // Drag to pan. `offset` slides the whole chart (lib/sky-math.ts chartFor);
    // `velocity` is the return spring's, px/s.
    type Drag = { id: number; startX: number; startY: number; base: Vec; moved: boolean };
    let drag: Drag | null = null;
    let offset: Vec = { x: 0, y: 0 };
    let velocity: Vec = { x: 0, y: 0 };
    let springing = false;
    let springLast = 0;
    let pendingPaint = 0;

    // ctx.font ignores CSS variables (CLAUDE.md trap): read the real family
    // list next/font put on <html>.
    const resolveFont = () => {
      const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-spline-mono").trim();
      if (fam) fontFamily = fam;
    };

    const simNow = () => (reducedQ.matches ? loadMs : simTimeMs(loadMs, Date.now()));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      width = window.innerWidth;
      height = window.innerHeight;
      const pxW = Math.round(width * dpr);
      const pxH = Math.round(height * dpr);
      // Same backing-store size and DPR as last time: the projection's own
      // `width`/`height` bookkeeping above is still refreshed every call (a
      // narrow<->wide crossover changes magLimit and the frame-rate gate
      // without necessarily changing the rounded pixel size), but skip the
      // reallocation itself and the setTransform that goes with it.
      if (pxW === lastPxW && pxH === lastPxH && dpr === lastDpr) return;
      canvas.width = pxW;
      canvas.height = pxH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastPxW = pxW;
      lastPxH = pxH;
      lastDpr = dpr;
    };

    const bodiesAt = (sim: number): Bodies => {
      const moon = moonEquatorial(sim);
      return {
        planets: PLANETS.map((name) => ({ name, eq: planetEquatorial(name, sim) })),
        moon,
        phase: moonPhase(moon, sunEquatorial(sim)),
      };
    };

    const paint = () => {
      if (!sky) {
        ctx.fillStyle = "#0c0b09";
        ctx.fillRect(0, 0, width, height);
        return;
      }
      const sim = simNow();
      if (!bodies || Math.abs(sim - bodiesSim) >= BODY_REFRESH_SIM_MS) {
        bodies = bodiesAt(sim);
        bodiesSim = sim;
      }
      const lst = lstDeg(sim);
      const chart = chartFor(width, height, lst, offset);
      // Read fresh every paint, not per pointer move: the sheet can scroll.
      // Stargaze mode steps the page aside, so nothing to avoid there.
      const sheetEl = isStargazing() ? null : document.querySelector("[data-sheet]");
      const avoid = sheetEl
        ? (() => {
            const r = sheetEl.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          })()
        : null;
      const t0 = performance.now();
      projected = drawSky(ctx, sky, {
        width,
        height,
        chart,
        magLimit: narrowQ.matches ? 4.5 : 5.0,
        bodies,
        fontFamily,
        highlight,
        avoid,
        starFills,
      });
      frameTimes.push(performance.now() - t0);
      if (frameTimes.length > 60) frameTimes.shift();
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const seen = projected;
      win.__sky = {
        drawn: true,
        simMs: sim,
        lstDeg: lst,
        k: chart.k,
        cx: chart.cx,
        cy: chart.cy,
        offset: { ...offset },
        dragging: drag !== null,
        frameMsMedian: sorted.length ? sorted[sorted.length >> 1] : null,
        highlight: highlight?.abbr ?? null,
        label: seen.label,
        segmentsFor: (abbr) => (seen.segments.get(abbr) ?? []).map((s) => [...s]),
      };
    };

    const step = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(step);
      if (document.hidden) return;
      // A live drag or spring paints every frame; the idle sky keeps its gate.
      const interacting = drag !== null || springing;
      if (springing) {
        const r = springStep(offset, velocity, springLast ? t - springLast : 1000 / 60);
        springLast = t;
        offset = r.p;
        velocity = r.v;
        if (r.settled) springing = false;
      }
      if (!interacting && t - last < (narrowQ.matches ? FRAME_MS_NARROW : FRAME_MS_WIDE)) return;
      last = t;
      paint();
    };
    const start = () => {
      if (running || reducedQ.matches) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const applyMode = () => {
      if (reducedQ.matches) {
        stop();
        paint();
      } else {
        start();
      }
    };
    const onResize = () => {
      resize();
      paint();
    };

    // Normal mode: only over the desk, never over the sheet. Stargaze mode:
    // the whole screen, and a tap works too (no hover on touch).
    const sheetContains = (x: number, y: number) => {
      const el = document.querySelector("[data-sheet]");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const pick = (x: number, y: number): Highlight | null => {
      if (!projected) return null;
      if (!isStargazing() && sheetContains(x, y)) return null;
      const abbr = nearestConstellation(projected, x, y, HOVER_PX);
      return abbr ? { abbr, pointer: { x, y } } : null;
    };
    const setHighlight = (next: Highlight | null) => {
      if (next === null && highlight === null) return;
      highlight = next;
      // A running loop repaints within one frame gate; a still sky (reduced
      // motion) repaints only on change.
      if (!running) paint();
    };
    // A still sky (reduced motion) has no loop: coalesce drag repaints to one per frame.
    const requestPaint = () => {
      if (running || pendingPaint) return;
      pendingPaint = requestAnimationFrame(() => {
        pendingPaint = 0;
        paint();
      });
    };

    // A pointer that never travelled CLICK_SLOP_PX. Stargaze keeps tap-to-name
    // (touch has no hover); Task 5 turns this into the card.
    const onSkyClick = (x: number, y: number) => {
      if (isStargazing()) setHighlight(pick(x, y));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || drag) return;
      const stargazing = isStargazing();
      // Normal-mode margins are 16px on a phone: a touch there must scroll the page.
      if (e.pointerType === "touch" && !stargazing) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(PAN_BLOCKERS)) return;
      if (!stargazing && (target?.closest("[data-sheet]") || sheetContains(e.clientX, e.clientY))) return;
      if (!stargazing) e.preventDefault(); // no text selection starting in the margin
      drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, base: { ...offset }, moved: false };
      springing = false;
      velocity = { x: 0, y: 0 };
      try {
        document.documentElement.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety (a release outside the window still ends the drag); never fatal.
      }
      document.documentElement.style.cursor = "grabbing";
      setHighlight(null);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) >= CLICK_SLOP_PX) drag.moved = true;
        offset = rubberBand({ x: drag.base.x + dx, y: drag.base.y + dy }, PAN_LIMIT_FRAC * Math.min(width, height));
        requestPaint();
        return; // hover is suspended while dragging
      }
      if (e.pointerType === "touch") return;
      setHighlight(pick(e.clientX, e.clientY));
    };
    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const click = !drag.moved && e.type === "pointerup";
      drag = null;
      document.documentElement.style.cursor = "";
      if (reducedQ.matches) {
        offset = { x: 0, y: 0 };
        velocity = { x: 0, y: 0 };
        springing = false;
        paint();
      } else if (offset.x !== 0 || offset.y !== 0) {
        springing = true;
        springLast = 0;
      }
      if (click) onSkyClick(e.clientX, e.clientY);
    };
    const onPointerLeave = () => {
      if (!drag) setHighlight(null);
    };

    resize();
    resolveFont();
    paint();
    applyMode();

    loadSky()
      .then((s) => {
        if (!alive) return;
        sky = s;
        // Once per catalog load, not once per frame: a star's fill colour
        // depends only on its catalog mag/bv, never on time or hover state.
        starFills = s ? precomputeStarFills(s.stars) : [];
        paint();
      })
      .catch((err) => {
        // A malformed catalog is an export bug; the desk stays plain dark
        // rather than drawing a sky that isn't the real one. Logged on
        // purpose (never swallowed silently): an export bug is something to
        // see, not hide, even though there is no visitor-facing UI for it.
        console.error("NightSky: the star catalog is malformed; the desk stays plain dark.", err);
      });
    void document.fonts?.ready.then(() => {
      if (!alive) return;
      resolveFont();
      paint();
    });

    window.addEventListener("resize", onResize);
    reducedQ.addEventListener("change", applyMode);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    const unsubStargaze = subscribeStargaze(() => {
      highlight = null;
      paint();
    });

    return () => {
      alive = false;
      stop();
      window.removeEventListener("resize", onResize);
      reducedQ.removeEventListener("change", applyMode);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      cancelAnimationFrame(pendingPaint);
      document.documentElement.style.cursor = "";
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      unsubStargaze();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
