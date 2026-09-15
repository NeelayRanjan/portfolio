"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import type { SkyFact } from "@/content/sky-facts";
import { loadSky, type SkyData } from "@/lib/sky-data";
import {
  isShowerActive,
  loadMilkyWay,
  loadObjects,
  prepareMilkyWay,
  smallCircle,
  type PreparedMilkyWay,
  type SkyObjectsData,
} from "@/lib/sky-objects";
import {
  drawSky,
  nearestConstellation,
  nearestHit,
  precomputeStarFills,
  type Bodies,
  type Highlight,
  type LabelText,
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
import { SkyCard, type CardModel } from "./SkyCard";

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
 * - The objects layers (spec 2026-09-15 §4, §9): objects.json and
 *   milkyway.json are fetched after first paint alongside sky.json, each
 *   gated on its own (absent: the sky draws without it; malformed: logged).
 *   The one-liners come from content/sky-facts.ts, a lazy chunk, so first
 *   paint never carries ~138 entries of prose.
 *
 * - Cards (spec 2026-09-15 §6): in stargaze mode a click (under
 *   CLICK_SLOP_PX of travel) on a selectable opens its SkyCard, a click on
 *   empty sky closes it, Escape closes it before it can reach
 *   StargazeToggle's exit. The card follows its subject as the sky turns and
 *   while dragging, and closes when the subject leaves the viewport.
 *
 * `window.__sky` is a read-only snapshot for scripts/verify-redesign.mjs.
 */

const FRAME_MS_WIDE = 50;
const FRAME_MS_NARROW = 100;
const BODY_REFRESH_SIM_MS = 10 * 60_000;
const DPR_CAP = 2;
const HOVER_PX = 24;
/** Symbols (objects, stars, planets, the Moon, radiants) win within this, before any line (spec §5). */
const HOVER_HIT_PX = 12;
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
  labelText: LabelText | null;
  /** The id whose always-on name was skipped this frame, or null (fix round 1, I2). */
  suppressedName: string | null;
  hits: { id: string; x: number; y: number }[];
  radiants: string[];
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState };
  card: string | null;
  segmentsFor: (abbr: string) => number[][];
};

type LayerState = "loading" | "ready" | "absent" | "error";

export function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  /** The effect's own paint, so a freshly committed card gets placed before the browser paints it. */
  const repaintRef = useRef<() => void>(() => {});
  const closeRef = useRef<() => void>(() => {});
  const [card, setCard] = useState<CardModel | null>(null);

  useLayoutEffect(() => {
    if (card) repaintRef.current();
  }, [card]);

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
    let objectsData: SkyObjectsData | null = null;
    let objectRings = new Map<string, [number, number][]>();
    let milkyWay: PreparedMilkyWay | null = null;
    let facts: Map<string, SkyFact> | null = null;
    const layers: SkySnapshot["layers"] = { objects: "loading", milkyWay: "loading", facts: "loading" };
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
    /** The open card's subject; mirrors `card` state, readable synchronously. */
    let selected: { kind: Highlight["kind"]; id: string } | null = null;
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
      const activeShowers = objectsData ? objectsData.showers.filter((s) => isShowerActive(s, sim)) : [];
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
        milkyWay,
        objects: objectsData?.objects ?? [],
        objectRings,
        showers: activeShowers,
        names: !narrowQ.matches,
        oneLiner: (id) => facts?.get(id)?.oneLiner ?? null,
        selectedId: selected?.id ?? null,
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
        highlight: highlight?.id ?? null,
        label: seen.label,
        labelText: seen.labelText,
        suppressedName: seen.suppressName,
        hits: seen.hits.map(({ id, x, y }) => ({ id, x, y })),
        radiants: activeShowers.map((s) => s.id),
        layers: { ...layers },
        card: selected?.id ?? null,
        segmentsFor: (abbr) => (seen.segments.get(abbr) ?? []).map((s) => [...s]),
      };
      if (selected) followCard(seen);
    };

    // ---- cards ----
    const buildCard = (h: { kind: Highlight["kind"]; id: string }): CardModel | null => {
      const fact = facts?.get(h.id);
      if (!fact || !sky) return null;
      if (h.kind === "constellation") {
        const con = sky.constellations[h.id];
        return con ? { id: h.id, title: con.english ? `${con.latin} (${con.english})` : con.latin, fact, extra: { type: "none" } } : null;
      }
      const shower = objectsData?.showers.find((x) => x.id === h.id);
      if (shower) return { id: h.id, title: shower.name, fact, extra: { type: "shower", shower } };
      const object = objectsData?.objects.find((x) => x.id === h.id);
      if (object) {
        const extra: CardModel["extra"] =
          object.distanceAu !== undefined && object.positionDate
            ? { type: "spacecraft", distanceAu: object.distanceAu, positionDate: object.positionDate }
            : { type: "none" };
        return { id: h.id, title: object.name, fact, extra };
      }
      const planet = PLANETS.find((name) => name.toLowerCase() === h.id);
      if (planet) return { id: h.id, title: planet, fact, extra: { type: "none" } };
      if (h.id === "moon") return { id: h.id, title: copy.stargaze.card.titleMoon, fact, extra: { type: "none" } };
      if (h.id === "milky-way") return { id: h.id, title: copy.stargaze.card.titleMilkyWay, fact, extra: { type: "none" } };
      return null;
    };
    const openCard = (h: Highlight) => {
      const model = buildCard(h);
      if (!model) return;
      selected = { kind: h.kind, id: h.id };
      setCard(model);
      paint();
    };
    const closeCard = () => {
      if (!selected) return;
      selected = null;
      setCard(null);
      paint();
    };
    closeRef.current = closeCard;
    /** Where the card's subject is this frame, or null once it has left the viewport. */
    const subjectAt = (p: Projected): { x: number; y: number } | null => {
      const sel = selected;
      if (!sel) return null;
      if (sel.kind === "hit") return p.hits.find((h) => h.id === sel.id) ?? null;
      const inView = (p.segments.get(sel.id) ?? [])
        .flatMap(([x1, y1, x2, y2]) => [
          [x1, y1],
          [x2, y2],
        ])
        .filter(([x, y]) => x >= 0 && x <= width && y >= 0 && y <= height);
      if (!inView.length) return null;
      return {
        x: inView.reduce((sum, [x]) => sum + x, 0) / inView.length,
        y: inView.reduce((sum, [, y]) => sum + y, 0) / inView.length,
      };
    };
    const followCard = (p: Projected) => {
      const at = subjectAt(p);
      if (!at) {
        // Deferred: this runs inside paint, and closeCard paints again.
        queueMicrotask(closeCard);
        return;
      }
      const el = cardRef.current;
      if (!el) return;
      if (narrowQ.matches) {
        el.style.left = "";
        el.style.top = "";
        return;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let x = at.x + 18;
      if (x + w > width - 16) x = at.x - 18 - w;
      x = Math.min(Math.max(x, 16), width - 16 - w);
      const y = Math.min(Math.max(at.y - 24, 16), height - 16 - h);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Capture phase: Escape closes the card first and never reaches
      // StargazeToggle's exit handler; the next Escape exits stargaze.
      if (e.key !== "Escape" || !selected) return;
      e.stopImmediatePropagation();
      closeCard();
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
      const hit = nearestHit(projected, x, y, HOVER_HIT_PX);
      if (hit) return { kind: "hit", id: hit.id, pointer: { x, y } };
      const abbr = nearestConstellation(projected, x, y, HOVER_PX);
      return abbr ? { kind: "constellation", id: abbr, pointer: { x, y } } : null;
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

    // A pointer that never travelled CLICK_SLOP_PX: in stargaze mode, a card
    // for whatever is under it, or closing the open card on empty sky.
    const onSkyClick = (x: number, y: number) => {
      if (!isStargazing()) return;
      const next = pick(x, y);
      if (next) openCard(next);
      else closeCard();
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
      // Over the open card: nothing under it is being pointed at.
      if (e.target instanceof Element && e.target.closest("[data-sky-card]")) return setHighlight(null);
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
    // The objects layers, each on its own gate (spec §9).
    loadObjects()
      .then((d) => {
        if (!alive) return;
        objectsData = d;
        objectRings = new Map(
          (d?.objects ?? [])
            .filter((o) => o.symbol === "field" && o.radiusDeg)
            .map((o) => [o.id, smallCircle(o.raDeg, o.decDeg, o.radiusDeg as number)]),
        );
        layers.objects = d ? "ready" : "absent";
        paint();
      })
      .catch((err) => {
        layers.objects = "error";
        console.error("NightSky: objects.json is malformed; the sky draws without its objects.", err);
        if (alive) paint();
      });
    loadMilkyWay()
      .then((d) => {
        if (!alive) return;
        milkyWay = d ? prepareMilkyWay(d) : null;
        layers.milkyWay = d ? "ready" : "absent";
        paint();
      })
      .catch((err) => {
        layers.milkyWay = "error";
        console.error("NightSky: milkyway.json is malformed; the sky draws without the band.", err);
        if (alive) paint();
      });
    import("@/content/sky-facts")
      .then(({ SKY_FACTS }) => {
        if (!alive) return;
        facts = new Map(SKY_FACTS.map((f) => [f.id, f]));
        layers.facts = "ready";
        paint();
      })
      .catch((err) => {
        layers.facts = "error";
        console.error("NightSky: the sky facts chunk failed to load; hover shows names only.", err);
        if (alive) paint();
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
    window.addEventListener("keydown", onKeyDown, { capture: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    const unsubStargaze = subscribeStargaze((on) => {
      highlight = null;
      if (!on) closeCard();
      paint();
    });
    repaintRef.current = () => {
      if (!running) paint();
      else if (projected) followCard(projected);
    };

    return () => {
      alive = false;
      stop();
      window.removeEventListener("resize", onResize);
      reducedQ.removeEventListener("change", applyMode);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      cancelAnimationFrame(pendingPaint);
      document.documentElement.style.cursor = "";
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      unsubStargaze();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />
      {card ? <SkyCard model={card} cardRef={cardRef} onClose={() => closeRef.current()} /> : null}
    </>
  );
}
