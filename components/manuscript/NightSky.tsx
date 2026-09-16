"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { copy } from "@/content/copy";
import type { SkyFact } from "@/content/sky-facts";
import { loadSky, type SkyData } from "@/lib/sky-data";
import {
  isShowerActive,
  loadMilkyWay,
  loadObjects,
  prepareMilkyWay,
  prepareObjectGlyphs,
  smallCircle,
  type ObjectGlyph,
  type PreparedMilkyWay,
  type SkyObjectsData,
} from "@/lib/sky-objects";
import {
  constellationAt,
  drawSky,
  hitRadiusFor,
  nearestConstellation,
  nearestHit,
  precomputeStarFills,
  type Bodies,
  type Highlight,
  type LabelText,
  type Projected,
} from "@/lib/sky-render";
import { loadIss, MOFFETT_HEIGHT_KM, type IssLook, type IssTracker } from "@/lib/sky-iss";
import {
  MOFFETT,
  PLANETS,
  chartFor,
  lstDeg,
  moonEquatorial,
  moonPhase,
  planetEquatorial,
  precessToJ2000,
  simTimeMs,
  sunEquatorial,
} from "@/lib/sky-math";
import { CLICK_SLOP_PX, PAN_LIMIT_FRAC, STARGAZE_PAN_LIMIT_FRAC, rubberBand, springStep, type Vec } from "@/lib/sky-pan";
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
 *   CLICK_SLOP_PX of travel) on a selectable's symbol or drawn name opens
 *   its SkyCard, a click on empty sky closes it, Escape closes it before it
 *   can reach StargazeToggle's exit. The card follows its subject as the sky
 *   turns and while dragging. When the subject leaves the viewport the card
 *   stays open where it was and says so; only the visitor closes a card
 *   (final review F3).
 *
 * - Keyboard and screen readers (final review F2): the canvas is
 *   aria-hidden, so in stargaze mode a visually hidden list of buttons, one
 *   per selectable currently on screen, is portalled into StargazeToggle's
 *   slot right after the exit control. It refreshes every LIST_REFRESH_MS,
 *   and only re-renders when the set changes; a focused button rings its
 *   subject on the canvas through the hover highlight.
 *
 * - The ISS (spec 2026-09-15 §8): a TLE from the same-origin /api/iss-tle,
 *   propagated by satellite.js (lazy-imported only once there is a TLE) at
 *   the simulated time, precessed into the chart's J2000 frame.
 *
 * `window.__sky` is a read-only snapshot for scripts/verify-redesign.mjs.
 */

const FRAME_MS_WIDE = 50;
const FRAME_MS_NARROW = 100;
const BODY_REFRESH_SIM_MS = 10 * 60_000;
const DPR_CAP = 2;
const HOVER_PX = 24;
/** A live drag or spring paints at about 60 fps, not the display's refresh
 *  rate: a 16ms gate, less 2ms so ordinary rAF jitter at 60Hz doesn't drop
 *  every other frame. */
const FRAME_MS_INTERACTING = 14;
/** How often the stargaze keyboard list re-reads what's on screen. */
const LIST_REFRESH_MS = 2000;
/** Never start a pan on these: the page's own controls, and (Task 5) the card. */
const PAN_BLOCKERS = "a, button, input, select, textarea, label, summary, [role='button'], [data-sky-card]";
/** Which objects get the card's "symbol not to scale" line ("clutter"
 *  follow-up, 2026-09-15): the enlarged galaxies, nebulae and clusters. The
 *  Milky Way band gets the same note; it isn't an object, so buildCard sets
 *  it directly there instead of through this set. */
const NOT_TO_SCALE_SYMBOLS = new Set(["galaxy", "nebula", "cluster"]);

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
  hits: { id: string; x: number; y: number; box: { x: number; y: number; w: number; h: number } | null }[];
  milkyWay: { x: number; y: number } | null;
  radiants: string[];
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState; iss: LayerState };
  iss: { x: number; y: number; aboveHorizon: boolean } | null;
  card: string | null;
  /** The open card's subject has left the viewport (F3). */
  cardOutOfView: boolean;
  segmentsFor: (abbr: string) => number[][];
};

type LayerState = "loading" | "ready" | "absent" | "error";

/** One button in the stargaze keyboard list (F2). */
type ListItem = { kind: Highlight["kind"]; id: string; label: string };
type ListActions = {
  open: (item: ListItem, el: HTMLElement) => void;
  focus: (item: ListItem) => void;
  blur: (item: ListItem) => void;
};

export function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  /** The effect's own paint, so a freshly committed card gets placed before the browser paints it. */
  const repaintRef = useRef<() => void>(() => {});
  const closeRef = useRef<() => void>(() => {});
  /** Re-reads the open card's offsetWidth/offsetHeight into the effect's
   *  cached size (fix round 1, promoted minor): called on open, on window
   *  resize, and from the card's own ResizeObserver below, so followCard
   *  never forces a layout read at ~20fps. */
  const updateCardSizeRef = useRef<() => void>(() => {});
  /** False for a close that's part of leaving stargaze entirely (fix round
   *  1, I3): StargazeToggle already returns focus to its own entry button
   *  in that case, so NightSky must not also grab it for the exit control. */
  const focusRestoreRef = useRef(true);
  const prevCardRef = useRef<CardModel | null>(null);
  /** The keyboard-list button that opened the open card, if one did: focus
   *  goes back there on close, so a keyboard user keeps their place (F2). */
  const openerRef = useRef<HTMLElement | null>(null);
  const listActionsRef = useRef<ListActions | null>(null);
  const [card, setCard] = useState<CardModel | null>(null);
  const [cardOutOfView, setCardOutOfView] = useState(false);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listSlot, setListSlot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (card) {
      updateCardSizeRef.current();
      repaintRef.current();
      cardRef.current?.focus({ preventScroll: true });
      prevCardRef.current = card;
      const el = cardRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      // The card's own size can change after it opens (a shower's four data
      // lines vs. a star's none, or a width crossing 880px) without `card`
      // itself changing, which is why this can't just run once on open.
      const ro = new ResizeObserver(() => {
        updateCardSizeRef.current();
        repaintRef.current();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
    if (prevCardRef.current && focusRestoreRef.current) {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>("[data-stargaze-exit]")?.focus({ preventScroll: true });
    }
    openerRef.current = null;
    prevCardRef.current = null;
    // Fix round 1, I1: keyed on the SUBJECT (card?.id), not the card object
    // itself. The ISS card's once-a-second refresh (below) calls setCard
    // with a freshly built model whose altitude/speed/epoch text changed but
    // whose id didn't; keying on the object would re-run this effect every
    // second, stealing focus back from wherever the visitor had tabbed to
    // (a citation link, the close button) and making a screen reader
    // re-announce the card. Keying on id alone still fires exactly when a
    // card opens, changes subject, or closes.
  }, [card?.id]);

  useEffect(() => {
    // StargazeToggle renders the slot right after its exit control, so the
    // list follows it in tab order; both are in app/layout.tsx, so it exists
    // by the time this runs.
    setListSlot(document.querySelector<HTMLElement>("[data-sky-list-slot]"));
  }, []);

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
    let objectGlyphs: ReadonlyMap<string, ObjectGlyph> = new Map();
    let milkyWay: PreparedMilkyWay | null = null;
    let facts: Map<string, SkyFact> | null = null;
    const layers: SkySnapshot["layers"] = { objects: "loading", milkyWay: "loading", facts: "loading", iss: "loading" };
    let issTracker: IssTracker | null = null;
    /** The ISS as of the last paint. */
    let issNow: IssLook | null = null;
    let issCardRefreshed = 0;
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
    /** The open card's offsetWidth/offsetHeight, cached (fix round 1,
     *  promoted minor): followCard reads this instead of the DOM every paint
     *  (~20fps), which would otherwise force a layout outside the measured
     *  frame time. Refreshed by updateCardSize, never read from the DOM
     *  inline in the paint loop. */
    let cardSize: { w: number; h: number } | null = null;
    /** Where followCard last put the card (>=880px), so a card whose subject
     *  has left can stay put, re-clamped to the viewport (F3). */
    let cardPos: { x: number; y: number } | null = null;
    /** Mirrors cardOutOfView state; setState only on a change. */
    let outOfView = false;
    const setOutOfView = (next: boolean) => {
      if (next === outOfView) return;
      outOfView = next;
      setCardOutOfView(next);
    };
    let listTimer = 0;
    let listSignature = "";
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

    // The only place that reads the card's offsetWidth/offsetHeight off the
    // DOM (fix round 1, promoted minor): called on open, on window resize,
    // and from the card's own ResizeObserver, never from inside followCard.
    const updateCardSize = () => {
      const el = cardRef.current;
      cardSize = el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    };
    updateCardSizeRef.current = updateCardSize;

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
      // Fix round 1: the SGP4 propagation + precession moved inside the
      // timed region below (it used to run before t0), so frameMsMedian
      // covers the ISS's own per-frame cost, not just the canvas draw.
      const t0 = performance.now();
      issNow = issTracker ? issTracker.at(sim) : null;
      const iss = issNow
        ? { eq: precessToJ2000({ raDeg: issNow.raDateDeg, decDeg: issNow.decDateDeg }, sim), aboveHorizon: issNow.elevationDeg > 0 }
        : null;
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
        objectGlyphs,
        showers: activeShowers,
        names: !narrowQ.matches,
        oneLiner: (id) => facts?.get(id)?.oneLiner ?? null,
        selectedId: selected?.id ?? null,
        iss,
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
        hits: seen.hits.map(({ id, x, y, box }) => ({ id, x, y, box: box ? { ...box } : null })),
        milkyWay: seen.milkyWay,
        radiants: activeShowers.map((s) => s.id),
        layers: { ...layers },
        card: selected?.id ?? null,
        cardOutOfView: outOfView,
        iss: (() => {
          const h = seen.hits.find((x) => x.id === "iss");
          return h && iss ? { x: h.x, y: h.y, aboveHorizon: iss.aboveHorizon } : null;
        })(),
        segmentsFor: (abbr) => (seen.segments.get(abbr) ?? []).map((s) => [...s]),
      };
      if (selected) {
        followCard(seen);
        win.__sky.cardOutOfView = outOfView;
      }
      // The ISS card's live lines, refreshed once a real second.
      if (selected?.id === "iss" && performance.now() - issCardRefreshed > 1000) {
        issCardRefreshed = performance.now();
        const model = buildCard(selected);
        if (model) setCard(model);
      }
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
        return { id: h.id, title: object.name, fact, extra, notToScale: NOT_TO_SCALE_SYMBOLS.has(object.symbol) };
      }
      const planet = PLANETS.find((name) => name.toLowerCase() === h.id);
      if (planet) return { id: h.id, title: planet, fact, extra: { type: "none" } };
      if (h.id === "moon") return { id: h.id, title: copy.stargaze.card.titleMoon, fact, extra: { type: "none" } };
      if (h.id === "iss" && issTracker && issNow) {
        return {
          id: h.id,
          title: copy.stargaze.card.titleIss,
          fact,
          extra: {
            type: "iss",
            aboveHorizon: issNow.elevationDeg > 0,
            altitudeKm: issNow.altitudeKm,
            speedKmS: issNow.speedKmS,
            epoch: issTracker.tle.epoch,
            still: reducedQ.matches,
          },
        };
      }
      if (h.id === "milky-way") {
        return { id: h.id, title: copy.stargaze.card.titleMilkyWay, fact, extra: { type: "none" }, notToScale: true };
      }
      return null;
    };
    const openCard = (h: Highlight) => {
      const model = buildCard(h);
      if (!model) return;
      openerRef.current = null;
      selected = { kind: h.kind, id: h.id };
      setCard(model);
      paint();
    };
    const closeCard = (opts?: { restoreFocus?: boolean; byKey?: boolean }) => {
      if (!selected) return;
      // Focus moves back only if it was inside the card (F3): a click on
      // empty sky must not yank it from wherever the visitor put it. One
      // exception: Escape with focus on nothing at all (the body, after a
      // mouse drag blurred the card), where leaving it on the body would
      // strand a keyboard user. A close that leaves stargaze mode (below)
      // passes restoreFocus false, since StargazeToggle returns focus to its
      // own entry button then and must not be fought for it.
      const active = document.activeElement;
      const focusInCard = !!(active && cardRef.current?.contains(active));
      const focusNowhere = !active || active === document.body;
      focusRestoreRef.current = (opts?.restoreFocus ?? true) && (focusInCard || (!!opts?.byKey && focusNowhere));
      selected = null;
      cardSize = null;
      cardPos = null;
      setOutOfView(false);
      setCard(null);
      paint();
    };
    closeRef.current = closeCard;
    /** Where a subject is this frame, or null when it is off the viewport. */
    const positionOf = (p: Projected, kind: Highlight["kind"], id: string): { x: number; y: number } | null => {
      if (kind === "constellation") return constellationAt(p, id, width, height);
      const hit = p.hits.find((h) => h.id === id);
      if (hit) return hit;
      // Below 880px the Milky Way has no hit, only its label point (F6).
      return id === "milky-way" ? p.milkyWay : null;
    };
    const followCard = (p: Projected) => {
      const at = selected ? positionOf(p, selected.kind, selected.id) : null;
      // F3: a subject that left the viewport no longer closes its card. The
      // card stops following, stays where it was, and says it's out of view.
      setOutOfView(!at);
      const el = cardRef.current;
      if (!el) return;
      if (narrowQ.matches) {
        el.style.left = "";
        el.style.top = "";
        return;
      }
      // Cached by updateCardSize (fix round 1, promoted minor): reading
      // offsetWidth/offsetHeight here, every paint at ~20fps, forces a
      // layout the frame-time measurement never saw. The DOM read is the
      // fallback only for the rare paint that lands before the card's own
      // open effect has cached a size yet.
      if (!cardSize) updateCardSize();
      const w = cardSize?.w ?? el.offsetWidth;
      const h = cardSize?.h ?? el.offsetHeight;
      let x: number;
      let y: number;
      if (at) {
        x = at.x + 18;
        if (x + w > width - 16) x = at.x - 18 - w;
        y = at.y - 24;
      } else if (cardPos) {
        ({ x, y } = cardPos);
      } else {
        return;
      }
      x = Math.min(Math.max(x, 16), width - 16 - w);
      y = Math.min(Math.max(y, 16), height - 16 - h);
      cardPos = { x, y };
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    // ---- the stargaze keyboard list (F2) ----
    const refreshList = () => {
      if (!isStargazing() || !projected || !sky || !facts) return;
      const p = projected;
      const hitItems: ListItem[] = [];
      const conItems: ListItem[] = [];
      const label = (kind: Highlight["kind"], id: string) => {
        const model = buildCard({ kind, id });
        return model ? `${model.title}, ${model.fact.kind}` : null;
      };
      const seen = new Set<string>();
      const addHit = (id: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        const l = label("hit", id);
        if (l) hitItems.push({ kind: "hit", id, label: l });
      };
      for (const h of p.hits) addHit(h.id);
      if (p.milkyWay) addHit("milky-way");
      for (const abbr of p.segments.keys()) {
        if (!constellationAt(p, abbr, width, height)) continue;
        const l = label("constellation", abbr);
        if (l) conItems.push({ kind: "constellation", id: abbr, label: l });
      }
      // A button that has focus stays in the list even if its subject just
      // left the screen, or focus would drop to the body under the visitor.
      const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.skyListItem;
      if (focusedId && !seen.has(focusedId) && !conItems.some((i) => i.id === focusedId)) {
        const kind: Highlight["kind"] = sky.constellations[focusedId] ? "constellation" : "hit";
        const l = label(kind, focusedId);
        if (l) (kind === "hit" ? hitItems : conItems).push({ kind, id: focusedId, label: l });
      }
      // Sorted by label, symbols then constellations: the order depends only
      // on which things are listed, so entries coming and going never
      // reshuffle the ones that stay.
      const byLabel = (a: ListItem, b: ListItem) => a.label.localeCompare(b.label, "en");
      const items = [...hitItems.sort(byLabel), ...conItems.sort(byLabel)];
      const signature = items.map((i) => `${i.kind}:${i.id}`).join("|");
      if (signature === listSignature) return;
      listSignature = signature;
      setListItems(items);
    };
    const startList = () => {
      refreshList();
      if (!listTimer) listTimer = window.setInterval(refreshList, LIST_REFRESH_MS);
    };
    const stopList = () => {
      window.clearInterval(listTimer);
      listTimer = 0;
      listSignature = "";
      setListItems([]);
    };
    listActionsRef.current = {
      open: (item, el) => {
        const model = buildCard(item);
        if (!model) return;
        openerRef.current = el;
        selected = { kind: item.kind, id: item.id };
        setCard(model);
        paint();
      },
      focus: (item) => {
        if (!projected) return;
        const at = positionOf(projected, item.kind, item.id) ?? { x: width / 2, y: height / 2 };
        setHighlight({ kind: item.kind, id: item.id, pointer: at });
      },
      blur: (item) => {
        if (highlight?.id === item.id) setHighlight(null);
      },
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Capture phase: Escape closes the card first and never reaches
      // StargazeToggle's exit handler; the next Escape exits stargaze.
      if (e.key !== "Escape" || !selected) return;
      e.stopImmediatePropagation();
      closeCard({ byKey: true });
    };

    const step = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(step);
      if (document.hidden) return;
      // A live drag or spring paints at ~60 fps; the idle sky keeps its 20/10 fps gate.
      const interacting = drag !== null || springing;
      if (springing) {
        const r = springStep(offset, velocity, springLast ? t - springLast : 1000 / 60);
        springLast = t;
        offset = r.p;
        velocity = r.v;
        if (r.settled) springing = false;
      }
      if (t - last < (interacting ? FRAME_MS_INTERACTING : narrowQ.matches ? FRAME_MS_NARROW : FRAME_MS_WIDE)) return;
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
      updateCardSize();
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
    /** What is under (x, y): a drawn name's box, then a symbol within the
     *  pointer type's radius (22px for touch, 12px otherwise; F1), then a
     *  constellation line within HOVER_PX. */
    const pick = (x: number, y: number, pointerType: string): Highlight | null => {
      if (!projected) return null;
      if (!isStargazing() && sheetContains(x, y)) return null;
      const hit = nearestHit(projected, x, y, hitRadiusFor(pointerType));
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
    const onSkyClick = (x: number, y: number, pointerType: string) => {
      if (!isStargazing()) return;
      const next = pick(x, y, pointerType);
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
        // A mouse whose button is already up: the pointerup went somewhere
        // this never heard about (a context menu, a lost capture). End the
        // drag instead of panning with no button held.
        if (e.pointerType === "mouse" && e.buttons === 0) return finishDrag(null);
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) >= CLICK_SLOP_PX) drag.moved = true;
        // Stargaze has no sheet to compose around, so it gets a looser band.
        const limitFrac = isStargazing() ? STARGAZE_PAN_LIMIT_FRAC : PAN_LIMIT_FRAC;
        offset = rubberBand({ x: drag.base.x + dx, y: drag.base.y + dy }, limitFrac * Math.min(width, height));
        requestPaint();
        return; // hover is suspended while dragging
      }
      if (e.pointerType === "touch") return;
      // Over the open card: nothing under it is being pointed at.
      if (e.target instanceof Element && e.target.closest("[data-sky-card]")) return setHighlight(null);
      setHighlight(pick(e.clientX, e.clientY, e.pointerType));
    };
    // Sends a non-zero offset home: an exact reduced-motion snap, or a
    // spring (change 1, 2026-09-15). Shared by a normal-mode release and by
    // leaving stargaze, so both use the same rule.
    const settleOffset = () => {
      if (offset.x === 0 && offset.y === 0) {
        springing = false;
        return;
      }
      if (reducedQ.matches) {
        offset = { x: 0, y: 0 };
        velocity = { x: 0, y: 0 };
        springing = false;
      } else {
        springing = true;
        springLast = 0;
      }
    };
    /** Ends the drag; `click` is the pointer's final position when it never travelled CLICK_SLOP_PX. */
    const finishDrag = (click: { x: number; y: number; pointerType: string } | null) => {
      if (!drag) return;
      drag = null;
      document.documentElement.style.cursor = "";
      if (isStargazing()) {
        // Change 1 (2026-09-15): releasing a drag while stargazing leaves
        // the chart exactly where the visitor put it. Only leaving stargaze
        // mode (the subscribeStargaze handler below) sends it home.
        velocity = { x: 0, y: 0 };
        springing = false;
      } else {
        settleOffset();
        if (reducedQ.matches) paint();
      }
      if (click) onSkyClick(click.x, click.y, click.pointerType);
    };
    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      finishDrag(!drag.moved && e.type === "pointerup" ? { x: e.clientX, y: e.clientY, pointerType: e.pointerType } : null);
    };
    // pointerup fires before lostpointercapture, so a normal release has
    // already ended the drag by now; this catches a capture lost any other way.
    const onLostCapture = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) finishDrag(null);
    };
    const onBlur = () => finishDrag(null);
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
        objectGlyphs = prepareObjectGlyphs(d?.objects ?? []);
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
    loadIss(() => import("satellite.js"), { ...MOFFETT, heightKm: MOFFETT_HEIGHT_KM })
      .then((t) => {
        if (!alive) return;
        issTracker = t;
        layers.iss = t ? "ready" : "absent";
        paint();
      })
      .catch((err) => {
        layers.iss = "error";
        // Fix round 1: this also catches a failed import("satellite.js")
        // chunk load (loadIss awaits importSatellite() internally), not only
        // a malformed route body, so the message has to be true for both.
        console.error("NightSky: the ISS's TLE or its satellite.js module failed to load; no ISS drawn.", err);
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
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.documentElement.addEventListener("lostpointercapture", onLostCapture);
    const unsubStargaze = subscribeStargaze((on) => {
      highlight = null;
      // Leaving stargaze closes any open card too, but focus is
      // StargazeToggle's job here (it returns focus to its own entry
      // button), not the exit control NightSky would otherwise reach for.
      if (!on) {
        closeCard({ restoreFocus: false });
        // Change 1 (2026-09-15): a drag held through the exit (Escape
        // mid-drag, or the exit button under a touch that's still down)
        // ends here rather than surviving into normal mode, where the next
        // pointermove would pan it with stargaze's now-gone looser limit.
        if (drag) {
          try {
            document.documentElement.releasePointerCapture(drag.id);
          } catch {
            // Same nicety as the initial capture: never fatal.
          }
          drag = null;
          document.documentElement.style.cursor = "";
        }
        // The one place the page always gets its composed offset back,
        // however stargaze was left: the exit button, Escape, or anything
        // else, all of which funnel through setStargazing(false).
        settleOffset();
      }
      paint();
      if (on) startList();
      else stopList();
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
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      cancelAnimationFrame(pendingPaint);
      window.clearInterval(listTimer);
      document.documentElement.style.cursor = "";
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.documentElement.removeEventListener("lostpointercapture", onLostCapture);
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
      {card ? (
        <SkyCard model={card} outOfView={cardOutOfView} cardRef={cardRef} onClose={() => closeRef.current()} />
      ) : null}
      {listSlot && listItems.length
        ? createPortal(
            <div data-sky-list role="group" aria-label={copy.stargaze.listLabel} className="sr-only">
              {listItems.map((item) => (
                <button
                  key={`${item.kind}:${item.id}`}
                  type="button"
                  data-sky-list-item={item.id}
                  onClick={(e) => listActionsRef.current?.open(item, e.currentTarget)}
                  onFocus={() => listActionsRef.current?.focus(item)}
                  onBlur={() => listActionsRef.current?.blur(item)}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            listSlot,
          )
        : null}
    </>
  );
}
