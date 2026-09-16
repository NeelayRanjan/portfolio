import type { CardModel } from "../SkyCard";
import { isShowerActive } from "@/lib/sky-objects";
import { drawSky, type Bodies, type Highlight, type LabelText, type Projected } from "@/lib/sky-render";
import {
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
import type { Vec } from "@/lib/sky-pan";
import { isStargazing } from "@/lib/stargaze";
import { ENTRY_RING_MS, entryRingAlpha } from "./entry-rings";
import type { SkyLayers, SkyState } from "./state";

/**
 * The canvas side of NightSky: backing-store sizing, the font, and the one
 * paint that draws a frame and publishes `window.__sky`.
 */

const BODY_REFRESH_SIM_MS = 10 * 60_000;
const DPR_CAP = 2;

export type SkySnapshot = {
  drawn: boolean;
  simMs: number;
  lstDeg: number;
  k: number;
  cx: number;
  cy: number;
  offset: Vec;
  dragging: boolean;
  frameMsMedian: number | null;
  /** The colour saturation this frame drew with, and where it is easing to. */
  saturation: number;
  saturationTarget: number;
  highlight: string | null;
  label: { x: number; y: number; w: number; h: number } | null;
  labelText: LabelText | null;
  /** The id whose always-on name was skipped this frame, or null (fix round 1, I2). */
  suppressedName: string | null;
  hits: { id: string; x: number; y: number; box: { x: number; y: number; w: number; h: number } | null }[];
  milkyWay: { x: number; y: number } | null;
  radiants: string[];
  layers: SkyLayers;
  iss: { x: number; y: number; aboveHorizon: boolean } | null;
  card: string | null;
  /** The open card's subject has left the viewport (F3). */
  cardOutOfView: boolean;
  segmentsFor: (abbr: string) => number[][];
  /** Drawn names carry their dotted underline this frame (stargaze only). */
  nameUnderline: boolean;
  /** How many entry rings drew this frame. */
  entryRings: number;
  /** The entry rings have had their one showing this page load. */
  entryRingsFired: boolean;
};

export type PainterDeps = {
  followCard: (p: Projected) => void;
  buildCard: (h: { kind: Highlight["kind"]; id: string }) => CardModel | null;
  setCard: (model: CardModel) => void;
  /** The card controller's mirror of cardOutOfView state. */
  isOutOfView: () => boolean;
};

export function createPainter(
  s: SkyState,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  deps: PainterDeps,
) {
  const win = window as Window & { __sky?: SkySnapshot };
  let issCardRefreshed = 0;
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
  const frameTimes: number[] = [];

  // ctx.font ignores CSS variables (CLAUDE.md trap): read the real family
  // list next/font put on <html>.
  const resolveFont = () => {
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-spline-mono").trim();
    if (fam) s.fontFamily = fam;
  };

  const simNow = () => (s.reducedQ.matches ? s.loadMs : simTimeMs(s.loadMs, Date.now()));

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    s.width = window.innerWidth;
    s.height = window.innerHeight;
    const pxW = Math.round(s.width * dpr);
    const pxH = Math.round(s.height * dpr);
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
    const { sky, width, height } = s;
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
    const chart = chartFor(width, height, lst, s.offset);
    // Read fresh every paint, not per pointer move: the sheet can scroll.
    // Stargaze mode steps the page aside, so nothing to avoid there.
    const sheetEl = isStargazing() ? null : document.querySelector("[data-sheet]");
    const avoid = sheetEl
      ? (() => {
          const r = sheetEl.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        })()
      : null;
    const objectsData = s.objectsData;
    const activeShowers = objectsData ? objectsData.showers.filter((x) => isShowerActive(x, sim)) : [];
    // Fix round 1: the SGP4 propagation + precession moved inside the
    // timed region below (it used to run before t0), so frameMsMedian
    // covers the ISS's own per-frame cost, not just the canvas draw.
    const t0 = performance.now();
    const stargazing = isStargazing();
    let entryRings: { ids: readonly string[]; alpha: number } | null = null;
    if (s.entryRings) {
      const elapsed = t0 - s.entryRings.start;
      if (elapsed >= ENTRY_RING_MS) s.entryRings = null;
      else entryRings = { ids: s.entryRings.ids, alpha: entryRingAlpha(elapsed, s.reducedQ.matches) };
    }
    s.issNow = s.issTracker ? s.issTracker.at(sim) : null;
    const issNow = s.issNow;
    const iss = issNow
      ? { eq: precessToJ2000({ raDeg: issNow.raDateDeg, decDeg: issNow.decDateDeg }, sim), aboveHorizon: issNow.elevationDeg > 0 }
      : null;
    s.projected = drawSky(ctx, sky, {
      width,
      height,
      chart,
      magLimit: s.narrowQ.matches ? 4.5 : 5.0,
      bodies,
      fontFamily: s.fontFamily,
      highlight: s.highlight,
      avoid,
      starFills: s.starFills,
      milkyWay: s.milkyWay,
      objects: objectsData?.objects ?? [],
      objectRings: s.objectRings,
      objectGlyphs: s.objectGlyphs,
      showers: activeShowers,
      names: !s.narrowQ.matches,
      saturation: s.saturation,
      stargazeChrome: stargazing,
      underlineNames: stargazing,
      colouredNames: stargazing,
      entryRings,
      oneLiner: (id) => s.facts?.get(id)?.oneLiner ?? null,
      selectedId: s.selected?.id ?? null,
      iss,
    });
    frameTimes.push(performance.now() - t0);
    if (frameTimes.length > 60) frameTimes.shift();
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const seen = s.projected;
    win.__sky = {
      drawn: true,
      simMs: sim,
      lstDeg: lst,
      k: chart.k,
      cx: chart.cx,
      cy: chart.cy,
      offset: { ...s.offset },
      dragging: s.drag !== null,
      frameMsMedian: sorted.length ? sorted[sorted.length >> 1] : null,
      saturation: s.saturation,
      saturationTarget: s.saturationTarget,
      highlight: s.highlight?.id ?? null,
      label: seen.label,
      labelText: seen.labelText,
      suppressedName: seen.suppressName,
      hits: seen.hits.map(({ id, x, y, box }) => ({ id, x, y, box: box ? { ...box } : null })),
      milkyWay: seen.milkyWay,
      radiants: activeShowers.map((x) => x.id),
      layers: { ...s.layers },
      card: s.selected?.id ?? null,
      cardOutOfView: deps.isOutOfView(),
      iss: (() => {
        const h = seen.hits.find((x) => x.id === "iss");
        return h && iss ? { x: h.x, y: h.y, aboveHorizon: iss.aboveHorizon } : null;
      })(),
      segmentsFor: (abbr) => (seen.segments.get(abbr) ?? []).map((x) => [...x]),
      nameUnderline: stargazing,
      entryRings: seen.entryRings,
      entryRingsFired: s.entryRingsFired,
    };
    if (s.selected) {
      deps.followCard(seen);
      win.__sky.cardOutOfView = deps.isOutOfView();
    }
    // The ISS card's live lines, refreshed once a real second.
    if (s.selected?.id === "iss" && performance.now() - issCardRefreshed > 1000) {
      issCardRefreshed = performance.now();
      const model = deps.buildCard(s.selected);
      if (model) deps.setCard(model);
    }
  };

  return { paint, resize, resolveFont };
}
