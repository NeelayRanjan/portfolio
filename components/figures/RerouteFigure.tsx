"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { copy } from "@/content/copy";
import { loadSlaacData, type SlaacData } from "@/lib/slaac/data";
import { albers } from "@/lib/slaac/albers";
import { loadSua, segCrossesPoly } from "@/lib/slaac/geometry";
import {
  loadSlaacEngine,
  unloadSlaacEngine,
  SlaacCancelled,
  SlaacUnloaded,
  type SlaacEngine,
} from "@/lib/slaac-engine";
import type { ProgressArc, Res } from "@/lib/slaac-protocol";
import type { Fix } from "@/lib/slaac/reroute";
import { summarizeFlights } from "@/lib/slaac/summary";
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";
import { trackDemoOnce } from "@/lib/track";
import { checkRing } from "./ring";
import {
  drawMap,
  fitBox,
  fitLower48,
  focusBox,
  fromScreen,
  lerpView,
  nearestFlight,
  sameView,
  siteAnchor,
  toScreen,
  FOCUS_FIT,
  FOCUS_LAUNCH_NM,
  type LL,
  type MapColours,
  type MapState,
  type MapView,
} from "./reroute-map";

/**
 * Figure 3: the SLAAC rerouter, run on the visitor's device.
 *
 * The routes are data: the owner's flight-plan LM (222M params, far too big
 * for a browser) wrote them offline. What runs here is the diffusion
 * rerouter, in a worker (lib/slaac-engine.ts), on the press of "reroute".
 *
 * Loading discipline (CLAUDE.md): this mounts behind DeferredMount, so at
 * scroll-in only the small JSON loads (loadSlaacData, ~230 KB); the model and
 * the ORT runtime load on the first press that actually has an arc to sample.
 * A press with no conflict plans its arcs on the main thread (the planner is
 * a dynamic import, pure geometry, no model) and says so without loading
 * anything.
 *
 * Honest controls: margin and lookahead change real output, so changing
 * either (or the airspace) after a run marks that run stale, and only a press
 * re-runs it. Nothing re-runs by itself.
 *
 * Stargaze (the chess rule): entering remembers whether the engine was loaded
 * or loading, then terminates the worker; leaving reloads it only if it was.
 * A run in flight is cancelled by the termination and goes back to idle,
 * never to an error. Load generations discard a load that resolves after an
 * unload, as ChessPanel does.
 *
 * Two modes (Task 12c): "all flights", the default, sends every library
 * route (373) in one press and answers with a summary (lib/slaac/summary.ts)
 * plus a detail row for a flight picked on the map; one pair keeps its
 * per-flight table. Before a press the readout counts the arcs it will
 * sample (the same planner and dedupe as the worker, never a predicted
 * time). The reroute button is amber until the result on screen answers the
 * current settings with every touched flight cleared, then green, and reads
 * "stop" while a press is in flight: stopping returns to the previous result
 * with no error and no demo_used.
 *
 * No animation loop: the map repaints on state changes only (progress events
 * included, coalesced into one rAF), so nothing runs off-screen or in a hidden
 * tab except a reroute the visitor started, and a 350 ms ease when the view
 * changes (task 12b: "focus" fits the pair's routes, nearby launch airspace,
 * drawn rings and the run's plans; "whole US" is the lower 48). Reduced
 * motion snaps instead.
 */

type Done = Extract<Res, { kind: "done" }>;
/** "planning" covers the planner import and the arc plan, before any model:
 *  the controls are already disabled then, so a pair change can't slip in. */
/** "unavailable": the data or the model never loaded (nothing can run).
 *  "failed": both had loaded and a run threw; the next press can try again. */
type RunState = "idle" | "planning" | "loading" | "running" | "unavailable" | "failed";
/** Every outcome carries the pair it was run on (a different pair never
 *  draws or tabulates it) and the margin it was run at (the clearance column
 *  is judged against that, not the slider's current value). */
type Outcome =
  | { kind: "done"; done: Done; sig: string; pairIdx: number; marginNm: number; crossing: Record<string, number[]> }
  | { kind: "no-conflict"; sig: string; pairIdx: number }
  | null;

/** The route picker's "all flights" entry (Task 12c, the default): every
 *  library route in one press. Any other value is an index into routes.pairs. */
const ALL = -1;
/** Filed-route ink: one pair reads at 0.45; all 373 routes are texture. */
const ROUTE_ALPHA_PAIR = 0.45;
const ROUTE_ALPHA_ALL = 0.2;
/** Picking a flight on the all-flights map: CSS px from its line. */
const PICK_PX_MOUSE = 8;
const PICK_PX_TOUCH = 16;

/** One flight as the figure knows it: the wire's id and route, plus where it
 *  came from for the all-flights detail row. */
type FlightRef = { id: string; nominal: Fix[]; pair: string; route: number };

/** The planner (pure geometry, no model) as one memoized dynamic import: the
 *  pre-press arc count and every press share it, and it stays out of the page
 *  bundle. */
let plannerP: Promise<[typeof import("@/lib/slaac/arcs"), typeof import("@/lib/slaac/run")]> | null = null;
const loadPlanner = () => (plannerP ??= Promise.all([import("@/lib/slaac/arcs"), import("@/lib/slaac/run")]));
const RING_MSG_MS = 3000;
const TAP_SLOP_PX = 8;
/** A click this close to the last vertex is a double click, not a new corner. */
const DUP_VERTEX_PX = 4;
/** How long a change of view eases, on real elapsed ms (cubic ease-out). */
const VIEW_EASE_MS = 350;

const FALLBACK_COLOURS: MapColours = {
  rule: "42, 40, 35",
  ink: "234, 229, 218",
  mut: "154, 148, 138",
  red: "229, 53, 43",
  ok: "99, 198, 140",
  panel: "23, 21, 17",
};

/** CSS tokens to "r, g, b" (ctx styles can't read var()). */
function resolveColours(): MapColours {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fb: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(cs.getPropertyValue(name).trim());
    if (!m) return fb;
    const h = m[1];
    return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
  };
  return {
    rule: read("--color-rule", FALLBACK_COLOURS.rule),
    ink: read("--color-ink", FALLBACK_COLOURS.ink),
    mut: read("--color-mut", FALLBACK_COLOURS.mut),
    red: read("--color-red-ink", FALLBACK_COLOURS.red),
    ok: read("--color-ok", FALLBACK_COLOURS.ok),
    panel: read("--color-panel", FALLBACK_COLOURS.panel),
  };
}

/** ctx.font ignores CSS variables (CLAUDE.md trap): read the family next/font set. */
function resolveFont(): string {
  const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-spline-mono").trim();
  return `10px ${fam || "ui-monospace"}, monospace`;
}

/** Signed to `digits`, with anything that rounds to zero printed as a bare
 *  zero: -0.004 must not read "-0.0" (nor +0.004 "+0.0"). */
const fmtSigned = (n: number, digits: number) => {
  const s = n.toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return n > 0 ? `+${s}` : s;
};

export function RerouteFigure() {
  const t = copy.research.figReroute;
  const c = t.controls;

  const [data, setData] = useState<SlaacData | null | undefined>(undefined);
  const [pairIdx, setPairIdx] = useState(ALL);
  const [launchOn, setLaunchOn] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [drawn, setDrawn] = useState<LL[][]>([]);
  const [pending, setPending] = useState<LL[]>([]);
  const [ringMsg, setRingMsg] = useState<string | null>(null);
  const [margin, setMargin] = useState(25);
  const [hug, setHug] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [progress, setProgress] = useState<{ step: number; steps: number; arcsDone: number; arcsTotal: number } | null>(null);
  /** The pre-press arc count, for the settings it was counted under. */
  const [planned, setPlanned] = useState<{ sig: string; n: number } | null>(null);
  /** All flights: the flight picked on the map (its id), or null. */
  const [picked, setPicked] = useState<string | null>(null);
  const [arcs, setArcs] = useState<ProgressArc[]>([]);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** The canvas's CSS size and DPR; the view itself lives in viewRef. */
  const [size, setSize] = useState<{ w: number; h: number; dpr: number } | null>(null);
  /** "focus" fits the pair's routes and nearby airspace; "us" the lower 48. */
  const [viewMode, setViewMode] = useState<"focus" | "us">("focus");
  /** Bumped when a view change settles, so the status JSON re-renders with it. */
  const [viewTick, setViewTick] = useState(0);
  /** Launch sites whose name fit on the map at this width, comma-joined. */
  const [labelled, setLabelled] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coloursRef = useRef<MapColours>(FALLBACK_COLOURS);
  const fontRef = useRef("10px monospace");
  const rafRef = useRef(0);
  /** The CURRENT view, mid-ease included. Drawing, hit-testing, the ring
   *  tool and the status centroids all read this, never the target. */
  const viewRef = useRef<MapView | null>(null);
  const easeRafRef = useRef(0);
  const lastTargetRef = useRef<{ view: MapView; mode: "focus" | "us" } | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const downRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const ringTimerRef = useRef(0);

  /** The generation of the press in flight, or 0. A press only clears it (and
   *  its own run state) while it is still the one in flight: "stop" hands the
   *  figure back at once, and the abandoned press must not touch it later. */
  const activeRef = useRef(0);
  /** The outcome on screen when the press began: "stop" puts it back. */
  const stashRef = useRef<Outcome>(null);
  const runIdRef = useRef(0);
  /** Bumped by every press and every pair change; a press writes its outcome
   *  only while it is still the current one. Kept apart from runIdRef, which
   *  counts presses for window.__slaac. */
  const pressGenRef = useRef(0);
  const engineRef = useRef<SlaacEngine | null>(null);
  const engineStateRef = useRef<"none" | "loading" | "loaded">("none");
  const loadGenRef = useRef(0);
  const wasLoadedRef = useRef(false);
  const lastDoneRef = useRef<Done | null>(null);

  const publishHook = useCallback(() => {
    (window as Window & { __slaac?: unknown }).__slaac = {
      runId: runIdRef.current,
      loaded: engineRef.current !== null,
      lastDone: lastDoneRef.current,
      view: viewRef.current ? { scale: viewRef.current.scale, ox: viewRef.current.ox, oy: viewRef.current.oy } : null,
    };
  }, []);

  // ---- data -----------------------------------------------------------------
  useEffect(() => {
    let live = true;
    loadSlaacData().then(
      (d) => {
        if (!live) return;
        setData(d);
      },
      (err) => {
        console.error(err); // a malformed export: visible, and the figure stays off
        if (live) setData(null);
      },
    );
    publishHook();
    return () => {
      live = false;
    };
  }, [publishHook]);

  const policies = data?.meta.policies ?? ["wide"];
  const showLookahead = policies.includes("hug") && policies.includes("wide");
  const display = data?.meta.display ?? "snapped";
  const isAll = pairIdx === ALL;
  const pair = !isAll ? (data?.routes.pairs[pairIdx] ?? null) : null;
  const totalRoutes = useMemo(() => data?.routes.pairs.reduce((n, p) => n + p.routes.length, 0) ?? 0, [data]);
  /** The flights a press sends: every library route, or the pair's. Ids are
   *  "1".."8" for one pair (the table's route numbers) and
   *  "ORIG-DEST-n" for all flights, unique across the library. */
  const flights = useMemo((): FlightRef[] => {
    if (!data) return [];
    const of = (p: SlaacData["routes"]["pairs"][number], all: boolean) =>
      p.routes.map((r, i) => ({
        id: all ? `${p.origin}-${p.dest}-${i + 1}` : String(i + 1),
        nominal: r.fixes,
        pair: `${p.origin} → ${p.dest}`,
        route: i + 1,
      }));
    if (pairIdx === ALL) return data.routes.pairs.flatMap((p) => of(p, true));
    const p = data.routes.pairs[pairIdx];
    return p ? of(p, false) : [];
  }, [data, pairIdx]);
  const sig = `${pairIdx}|${launchOn}|${margin}|${hug}|${JSON.stringify(drawn)}`;

  // ---- engine (load generations, stargaze) ----------------------------------
  const startLoad = useCallback((): Promise<SlaacEngine | null> => {
    const gen = ++loadGenRef.current;
    engineStateRef.current = "loading";
    return loadSlaacEngine().then(
      (e) => {
        if (gen !== loadGenRef.current) throw new SlaacUnloaded(); // stargaze came and went
        engineRef.current = e;
        engineStateRef.current = e ? "loaded" : "none";
        publishHook();
        return e;
      },
      (err) => {
        if (gen === loadGenRef.current) engineStateRef.current = "none";
        throw err;
      },
    );
  }, [publishHook]);

  useEffect(
    () =>
      subscribeStargaze((on) => {
        if (on) {
          wasLoadedRef.current = engineStateRef.current !== "none";
          loadGenRef.current++;
          engineRef.current = null;
          engineStateRef.current = "none";
          unloadSlaacEngine(); // a press in flight rejects SlaacUnloaded: back to idle
          publishHook();
        } else if (wasLoadedRef.current) {
          wasLoadedRef.current = false;
          startLoad().catch(() => {}); // the next press reports any real failure
        }
      }),
    [startLoad, publishHook],
  );

  // ---- canvas ---------------------------------------------------------------
  useEffect(() => {
    coloursRef.current = resolveColours();
    fontRef.current = resolveFont();
    void document.fonts?.ready.then(() => {
      fontRef.current = resolveFont();
      drawRef.current();
    });
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let lastW = -1;
    // Width changes only: a phone's URL bar resizing the viewport's height must
    // not reshape (and clear) the map mid-drawing.
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w === lastW || w <= 0) return;
      lastW = w;
      const h = Math.round(Math.min(0.62 * w, 0.6 * window.innerHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      setSize({ w, h, dpr });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const shown = outcome && outcome.pairIdx === pairIdx ? outcome : null;
  const fresh = shown !== null && shown.sig === sig;

  const mapState = (): MapState | null => {
    if (!data || !flights.length) return null;
    const done = shown?.kind === "done" ? shown : null;
    const ap = data.airports.airports;
    return {
      outline: data.outline.lonlat,
      endpoints: pair
        ? [pair.origin, pair.dest].flatMap((code) => (ap[code] ? [{ code, lat: ap[code].lat, lon: ap[code].lon }] : []))
        : [],
      routes: flights.map((f) => ({ id: f.id, fixes: f.nominal })),
      routeAlpha: isAll ? ROUTE_ALPHA_ALL : ROUTE_ALPHA_PAIR,
      sites: launchOn
        ? data.launch.sites.map((s) => ({ id: s.id, name: s.name, rings: s.polys.map((p) => p.ring) }))
        : [],
      drawn,
      pending,
      arcs,
      results: done ? done.done.flights.map((f) => ({ ...f, crossingLegs: done.crossing[f.id] ?? [] })) : null,
      fresh,
      display,
      hover: isAll ? picked : hover,
    };
  };

  // ---- the view (task 12b) ----------------------------------------------------
  // The focus box: the pair's routes, launch airspace near them, the drawn
  // rings, and the shown outcome's plans. Arcs in flight are not in it, so a
  // run re-zooms once, when it is done, not on every progress message.
  const shownKey = shown?.kind === "done" ? shown : null;
  const targetView = useMemo((): MapView | null => {
    if (!size || !data || !flights.length) return null;
    if (viewMode === "us") return fitLower48(size.w, size.h, size.dpr);
    const outcomePts: LL[] = shownKey
      ? shownKey.done.flights.flatMap((f) => [...f.plan.map((q): LL => [q[1], q[2]]), ...f.dense])
      : [];
    const box = focusBox(
      flights.map((f) => f.nominal.map((q): LL => [q[1], q[2]])),
      launchOn ? data.launch.sites.flatMap((st) => st.polys.map((p) => p.ring)) : [],
      drawn,
      outcomePts,
      { launchWithinNm: FOCUS_LAUNCH_NM },
    );
    return box ? fitBox(size.w, size.h, size.dpr, box, FOCUS_FIT) : fitLower48(size.w, size.h, size.dpr);
  }, [size, data, flights, viewMode, launchOn, drawn, shownKey]);

  useEffect(() => {
    if (!targetView) return;
    const last = lastTargetRef.current;
    if (last && sameView(last.view, targetView)) return;
    // An open ring holds the view still, so its vertices don't move under the
    // pointer; it eases once the ring closes (or is cleared). The visitor's
    // own focus/whole-US press still goes through, and so does a change of
    // canvas size: the canvas has already been resized, and a held view would
    // draw it at the old w/h/dpr. The ring's vertices are lat/lon, so they
    // land in the right place under the re-fitted view.
    const sameSize = last !== null && last.view.w === targetView.w && last.view.h === targetView.h && last.view.dpr === targetView.dpr;
    if (pending.length > 0 && last && last.mode === viewMode && sameSize) return;
    lastTargetRef.current = { view: targetView, mode: viewMode };
    cancelAnimationFrame(easeRafRef.current);
    easeRafRef.current = 0;
    const from = viewRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || reduce || from.w !== targetView.w || from.h !== targetView.h || from.dpr !== targetView.dpr) {
      viewRef.current = targetView;
      drawRef.current();
      publishHook();
      setViewTick((n) => n + 1);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / VIEW_EASE_MS);
      viewRef.current = lerpView(from, targetView, 1 - (1 - p) ** 3);
      drawRef.current();
      publishHook();
      if (p < 1) {
        easeRafRef.current = requestAnimationFrame(step);
      } else {
        easeRafRef.current = 0;
        viewRef.current = targetView;
        publishHook();
        setViewTick((n) => n + 1);
      }
    };
    easeRafRef.current = requestAnimationFrame(step);
  }, [targetView, viewMode, pending.length, publishHook]);
  useEffect(
    () => () => {
      cancelAnimationFrame(easeRafRef.current);
      easeRafRef.current = 0;
    },
    [],
  );

  drawRef.current = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const s = mapState();
    const view = viewRef.current;
    if (!ctx || !view || !s) return;
    const out = drawMap(ctx, view, s, coloursRef.current, fontRef.current).labelled.join(",");
    setLabelled((prev) => (prev === out ? prev : out));
  };

  // Every render repaints once, coalesced: state changes are rare except
  // progress, which arrives at most every two forward passes.
  useEffect(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  });
  // Reset the handle too: a cancelled frame left in the ref would block every
  // later repaint (StrictMode's mount, unmount, mount does exactly that).
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    },
    [],
  );

  // ---- drawing an airspace --------------------------------------------------
  const flashRing = (msg: string) => {
    setRingMsg(msg);
    window.clearTimeout(ringTimerRef.current);
    ringTimerRef.current = window.setTimeout(() => setRingMsg(null), RING_MSG_MS);
  };
  useEffect(() => () => window.clearTimeout(ringTimerRef.current), []);

  const closeRing = () => {
    if (pending.length < 3) {
      flashRing(t.ringTooFew);
      return;
    }
    const check = checkRing(pending);
    if (check.ok) {
      setDrawn((d) => [...d, pending]);
      setPending([]);
      setDrawMode(false);
    } else if (check.reason === "too-few") {
      flashRing(t.ringTooFew);
    } else {
      flashRing(check.reason === "degenerate" ? t.ringDegenerate : t.ringSelfCrossing);
      setPending([]);
    }
  };

  const busy = runState === "planning" || runState === "loading" || runState === "running";

  const ringTool = drawMode && !busy;
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    // The ring tool, or (all flights, draw mode off) picking a flight.
    if (!ringTool && !(isAll && !drawMode)) return;
    const r = e.currentTarget.getBoundingClientRect();
    downRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
  };
  // A vertex lands on release, not press, and only if the pointer barely
  // moved: on a phone a press is also the start of a scroll, and the browser
  // cancels the pointer (no pointerup here) once it takes the gesture over.
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = downRef.current;
    downRef.current = null;
    const view = viewRef.current; // the current view, mid-ease included
    if (!d || d.id !== e.pointerId || !view) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - d.x, y - d.y) > TAP_SLOP_PX) return;
    if (!ringTool) {
      if (!isAll || drawMode) return;
      // Pick the flight under the pointer: rerouted plans first (they draw on
      // top), then every filed route. Empty map clears the pick.
      const res = shown?.kind === "done" ? shown.done.flights.filter((f) => f.status !== "untouched") : [];
      const lines = [
        ...res.map((f) => ({ id: f.id, pts: f.plan.map((q): LL => [q[1], q[2]]) })),
        ...flights.map((f) => ({ id: f.id, pts: f.nominal.map((q): LL => [q[1], q[2]]) })),
      ];
      setPicked(nearestFlight(view, lines, x, y, e.pointerType === "touch" ? PICK_PX_TOUCH : PICK_PX_MOUSE));
      return;
    }
    if (pending.length) {
      const [fx, fy] = toScreen(view, pending[0][0], pending[0][1]);
      if (Math.hypot(x - fx, y - fy) <= (e.pointerType === "touch" ? 22 : 12)) {
        closeRing();
        return;
      }
    }
    if (pending.length) {
      const [lx, ly] = toScreen(view, pending[pending.length - 1][0], pending[pending.length - 1][1]);
      if (Math.hypot(x - lx, y - ly) <= DUP_VERTEX_PX) return;
    }
    setPending((p) => [...p, fromScreen(view, x, y)]);
  };

  useEffect(() => {
    if (!pending.length) return;
    // Capture phase, so this runs BEFORE StargazeToggle's bubble-phase exit
    // handler: an Escape that leaves stargaze still sees isStargazing() true
    // here and leaves the ring alone. The sky card's and list panel's own
    // capture handlers stop the event outright when they take it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isStargazing()) return;
      setPending([]);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending.length]);

  // ---- the press ------------------------------------------------------------
  /** The polygons in play: the launch sites (when on) and the drawn rings. */
  const ringsNow = useMemo(
    (): LL[][] => [...(launchOn && data ? data.launch.sites.flatMap((st) => st.polys.map((p) => p.ring)) : []), ...drawn],
    [data, launchOn, drawn],
  );

  // Before a press: how many distinct arcs it will sample, by the same planner
  // and dedupe the worker uses. The box prefilter (mayConflict, exact) keeps
  // all 373 routes off the slow path; a short debounce lets a margin drag settle.
  useEffect(() => {
    if (!data || !flights.length) return;
    let live = true;
    const id = window.setTimeout(() => {
      void loadPlanner().then(([{ planArcs, mayConflict, uniqueArcCount }, { rerouteOpts }]) => {
        if (!live) return;
        const polys = loadSua(ringsNow);
        const opts = rerouteOpts(data.meta, margin, hug, null);
        const n = uniqueArcCount(planArcs(flights.filter((f) => mayConflict(f.nominal, polys, opts)), polys, opts));
        setPlanned({ sig, n });
      });
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [data, flights, ringsNow, margin, hug, sig]);

  const reroute = async () => {
    if (activeRef.current || !data || !flights.length) return;
    setRunState("planning"); // before the first await: the controls lock now
    runIdRef.current++;
    const gen = ++pressGenRef.current;
    activeRef.current = gen;
    const current = () => gen === pressGenRef.current;
    const pressPair = pairIdx;
    const pressMargin = margin;
    publishHook();
    const pressSig = sig;
    const sent = flights.map((f) => ({ id: f.id, nominal: f.nominal }));
    const rings = ringsNow;
    stashRef.current = outcome;
    setOutcome(null);
    setArcs([]);
    setProgress(null);
    /** "load" while the planner chunk or the engine is still loading (a failure
     *  there means nothing can run); "run" once both are in hand (a failure
     *  there is this run's, and the next press may well succeed). */
    let phase: "load" | "run" = "load";
    try {
      // Plan first, on this thread: a press with nothing to reroute never
      // loads the model.
      const [{ planArcs, mayConflict, BATCH_CAP_DESKTOP, BATCH_CAP_PHONE }, { rerouteOpts }] = await loadPlanner();
      if (isStargazing() || !current()) return;
      phase = "run";
      const polys = loadSua(rings);
      const opts = rerouteOpts(data.meta, margin, hug, null);
      const jobs = planArcs(sent.filter((f) => mayConflict(f.nominal, polys, opts)), polys, opts);
      if (jobs.length === 0) {
        setOutcome({ kind: "no-conflict", sig: pressSig, pairIdx: pressPair });
        return;
      }
      setRunState("loading");
      phase = "load";
      const engine = engineRef.current ?? (await startLoad());
      if (!current()) return; // stopped while the model loaded
      if (!engine) {
        setRunState("unavailable");
        return;
      }
      phase = "run";
      setRunState("running");
      const isPhone = window.matchMedia("(max-width: 879px)").matches;
      // Every flight, all 373 in all-flights mode, in ONE request: the worker
      // plans, dedupes and batches the arcs itself.
      const done = await engine.reroute(
        {
          flights: sent,
          rings,
          marginNm: margin,
          hug,
          seed: Date.now() >>> 0,
          steps: data.meta.sampler.steps,
          batchCap: isPhone ? BATCH_CAP_PHONE : BATCH_CAP_DESKTOP,
          display,
        },
        (p) => {
          if (!current()) return;
          setArcs(p.arcs);
          setProgress({ step: p.step, steps: p.steps, arcsDone: p.arcsDone, arcsTotal: p.arcsTotal });
        },
      );
      if (!current()) return;
      lastDoneRef.current = done;
      publishHook();
      // Which legs still cross (the pipeline's own leg test), so the map can
      // draw a cannot-clear plan's crossing in red instead of as a success.
      const crossing: Record<string, number[]> = {};
      for (const f of done.flights) {
        if (f.status !== "cannot-clear") continue;
        const xy = f.plan.map((q) => albers(q[1], q[2]));
        crossing[f.id] = xy.slice(0, -1).flatMap((a, i) => (polys.some((P) => segCrossesPoly(a, xy[i + 1], P)) ? [i] : []));
      }
      setOutcome({ kind: "done", done, sig: pressSig, pairIdx: pressPair, marginNm: pressMargin, crossing });
      setRunState("idle");
      trackDemoOnce("slaac");
    } catch (err) {
      if (!current()) return; // "stop" already handed the figure back
      if (err instanceof SlaacCancelled || err instanceof SlaacUnloaded) {
        // Stargaze or a newer press: idle, never an error, the last result back.
        setRunState("idle");
        setOutcome(stashRef.current);
        return;
      }
      console.error(err);
      setRunState(phase === "run" ? "failed" : "unavailable");
    } finally {
      if (activeRef.current === gen) {
        activeRef.current = 0;
        setArcs([]);
        setProgress(null);
        setRunState((st) => (st === "planning" || st === "loading" || st === "running" ? "idle" : st));
      }
    }
  };

  /** "stop": the press in flight is abandoned at once. The figure goes back to
   *  idle with the result it showed before the press; the worker's run is
   *  cancelled (R16's per-forward yield lets the cancel land within a forward
   *  or two); a model still loading keeps loading, for the next press. No
   *  error, no done, no demo_used. */
  const stop = () => {
    if (!activeRef.current) return;
    activeRef.current = 0;
    pressGenRef.current++;
    engineRef.current?.cancel();
    setArcs([]);
    setProgress(null);
    setRunState("idle");
    setOutcome(stashRef.current);
  };

  // ---- render ---------------------------------------------------------------
  const doneOut = shown?.kind === "done" ? shown : null;
  const done = doneOut?.done ?? null;
  const stateName =
    data === undefined
      ? "data-loading"
      : data === null || runState === "unavailable"
        ? "unavailable"
        : runState === "failed"
          ? "failed"
          : busy
          ? runState
          : shown?.kind === "done"
            ? fresh ? "done" : "stale"
            : shown?.kind === "no-conflict" && fresh
              ? "no-conflict"
              : "idle";

  const cur = viewRef.current;
  void viewTick; // the status re-renders when a view change settles
  const status = JSON.stringify({
    state: stateName,
    step: progress?.step ?? null,
    steps: progress?.steps ?? null,
    arcs: done?.arcs ?? null,
    ms: done ? Math.round(done.ms) : null,
    fallbackArcs: done?.fallbackArcs ?? null,
    flights: done ? done.flights.map((f) => ({ id: f.id, status: f.status, metrics: f.metrics })) : [],
    launchOn,
    launchSites:
      data && cur
        ? data.launch.sites.map((s) => {
            const centroid = siteAnchor(cur, { id: s.id, name: s.name, rings: s.polys.map((p) => p.ring) });
            return {
              id: s.id,
              centroid,
              /** The centroid lies on the canvas at the current view. */
              inView: centroid !== null && centroid[0] >= 0 && centroid[0] <= cur.w && centroid[1] >= 0 && centroid[1] <= cur.h,
              labelled: launchOn && labelled.split(",").includes(s.id),
            };
          })
        : [],
    view: cur ? { mode: viewMode, scale: cur.scale } : null,
    mode: isAll ? "all" : "pair",
    /** The arcs a press would sample under the current settings (null until counted). */
    arcsPlanned: planned && planned.sig === sig ? planned.n : null,
    arcsDone: progress?.arcsDone ?? null,
    arcsTotal: progress?.arcsTotal ?? null,
    picked: isAll ? picked : null,
  });

  /** The reroute button's colour and label (Task 12c). "running": it reads
   *  "stop". "ok" (green): the result on screen is for the current settings
   *  and every touched flight cleared (a no-conflict press counts: nothing
   *  needed clearing). "idle-stale" (amber): anything else, never run, stale,
   *  failed, unavailable, or a run with a cannot-clear flight. */
  const cannotClearN = done ? done.flights.filter((f) => f.status === "cannot-clear").length : 0;
  const goState: "running" | "ok" | "idle-stale" = busy
    ? "running"
    : (stateName === "done" && cannotClearN === 0) || stateName === "no-conflict"
      ? "ok"
      : "idle-stale";

  const readout =
    runState === "loading"
      ? t.loading
      : runState === "running"
        ? `${t.running}${progress ? ` ${progress.arcsDone}/${progress.arcsTotal}${t.runningArcs}` : ""}`
        : stateName === "done" && done
          ? `${t.runtimePre}${done.arcs}${done.arcs === 1 ? t.runtimeMidOne : t.runtimeMid}${(done.ms / 1000).toFixed(1)}${t.runtimePost}`
          : stateName === "stale"
            ? t.stale
            : stateName === "no-conflict"
              ? t.noConflict
              : "";
  /** Before a press (and while a result is stale): the arcs it would sample. */
  const plannedN = planned && planned.sig === sig ? planned.n : null;
  const plannedLine =
    plannedN !== null && !busy && stateName !== "done" && stateName !== "no-conflict" && stateName !== "unavailable"
      ? `${t.toSamplePre}${plannedN}${plannedN === 1 ? t.toSampleMidOne : t.toSampleMid}`
      : null;

  if (data === null) {
    return (
      <InstrumentFigure n="3" caption={t.caption}>
        <p data-reroute-figure data-reroute-status={status} className="font-mono text-[11px] text-mut">
          {t.unavailable}
        </p>
      </InstrumentFigure>
    );
  }

  const launchTitle = data
    ? data.launch.sites
        .map((s) => `${s.name}: ${s.label ?? s.polys.map((p) => (p.merged_from ?? [p.designator]).join(", ")).join(", ")}`)
        .join("\n")
    : undefined;

  const btn =
    "border px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const idleBtn = "border-rule text-mut hover:border-mut hover:text-ink";
  const cell = "whitespace-nowrap py-1 pr-1.5 min-[880px]:pr-2";
  const head = "py-1 pr-1.5 min-[880px]:pr-2 font-normal";
  /** Floored, never rounded up: 24.96 nm against a 25 nm margin must not
   *  print as 25. Red when under the margin this run was asked for. */
  const clearanceCell = (v: number | null) => (
    <td className={`${cell} ${v !== null && doneOut && v < doneOut.marginNm ? "text-red-ink" : "text-warm"}`}>
      {v === null ? "-" : `${(Math.floor(v * 10) / 10).toFixed(1)} nm`}
    </td>
  );
  /** One flight's numbers: the pair table's row and the all-flights detail row. */
  const flightCells = (f: Done["flights"][number]) => {
    const m = f.metrics;
    return (
      <>
        {f.status === "untouched" ? (
          <td colSpan={2} className={`${cell} text-mut`}>
            {t.untouched}
          </td>
        ) : (
          <>
            <td className={`${cell} text-warm`}>{`${fmtSigned(m.addedNm, 0)} nm`}</td>
            <td className={`${cell} text-warm`}>{`${fmtSigned(m.addedPct, 1)}%`}</td>
          </>
        )}
        {clearanceCell(m.minClearanceNm)}
        <td className={`whitespace-nowrap py-1 ${f.status === "cannot-clear" ? "text-red-ink" : "text-warm"}`}>
          {f.status === "cannot-clear" ? `${m.legCrossings} · ${t.cannotClear}` : m.legCrossings}
        </td>
      </>
    );
  };
  const summary = isAll && done && doneOut ? summarizeFlights(done.flights, doneOut.marginNm) : null;
  const pickedRef = isAll && picked ? flights.find((f) => f.id === picked) ?? null : null;
  const pickedOut = pickedRef && done ? done.flights.find((f) => f.id === pickedRef.id) ?? null : null;
  const goClass =
    goState === "running"
      ? "border-ink text-ink hover:bg-ink/10"
      : goState === "ok"
        ? "border-ok text-ok hover:bg-ok/10"
        : "border-warm text-warm hover:bg-warm/10";

  return (
    <InstrumentFigure n="3" caption={t.caption}>
      <div data-reroute-figure data-reroute-status={status}>
        {/* Row 1: the settings on the left; drawing on the right, which on a
            wrapped desktop row stays right-aligned and on a phone sits on its
            own line at the left. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 font-mono text-[11px] text-mut">
          <label className="flex items-center gap-2">
            <span>{c.pair}</span>
            <select
              data-reroute-pair
              value={pairIdx}
              disabled={busy || !data}
              onChange={(e) => {
                pressGenRef.current++; // a press still landing belongs to the old pair
                setPairIdx(Number(e.target.value));
                setOutcome(null);
                setRunState((st) => (st === "failed" ? "idle" : st)); // the error was the old pair's run
                setHover(null);
                setPicked(null);
              }}
              className="border border-rule bg-panel px-1.5 py-1 text-ink disabled:opacity-40"
            >
              <option value={ALL}>{`${c.allFlightsPre}${totalRoutes}${c.allFlightsPost}`}</option>
              {data?.routes.pairs.map((p, i) => (
                <option key={`${p.origin}-${p.dest}`} value={i}>
                  {`${p.origin} → ${p.dest}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              data-reroute-launch
              type="checkbox"
              checked={launchOn}
              disabled={busy}
              onChange={(e) => setLaunchOn(e.target.checked)}
              className="accent-red-ink"
            />
            <span title={launchTitle}>{c.launch}</span>
          </label>

          <div className="flex items-center gap-2">
            <span aria-hidden="true">{c.view}</span>
            <div className="flex" role="group" aria-label={c.view} data-reroute-view>
              {([
                ["focus", c.viewFocus],
                ["us", c.viewUs],
              ] as const).map(([m, label], i) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={viewMode === m}
                  onClick={() => setViewMode(m)}
                  className={`${btn} ${i > 0 ? "-ml-px" : ""} ${
                    viewMode === m ? "relative border-ink text-ink" : idleBtn
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <span>{c.margin}</span>
            <input
              data-reroute-margin
              type="range"
              min={10}
              max={50}
              step={5}
              value={margin}
              disabled={busy}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="h-1 w-24 accent-link"
            />
            <span className="w-11 text-warm tabular-nums">{`${margin} ${c.marginUnit}`}</span>
          </label>

          {showLookahead ? (
            <div className="flex items-center gap-2">
              <span aria-hidden="true">{c.lookahead}</span>
              <div className="flex" role="group" aria-label={c.lookahead} data-reroute-lookahead>
                {([
                  [true, c.hug],
                  [false, c.wide],
                ] as const).map(([h, label], i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={hug === h}
                    disabled={busy}
                    onClick={() => setHug(h)}
                    className={`${btn} ${i > 0 ? "-ml-px" : ""} ${
                      hug === h ? "relative border-ok text-ok" : idleBtn
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div data-reroute-draw-group className="flex items-center gap-2 min-[880px]:ml-auto min-[880px]:pl-6">
            <button
              type="button"
              data-reroute-draw
              aria-pressed={drawMode}
              disabled={busy}
              onClick={() => {
                setDrawMode((m) => !m);
                setPending([]);
              }}
              className={`${btn} ${drawMode ? "border-red-ink text-red-ink" : idleBtn}`}
            >
              {c.draw}
            </button>
            {drawMode && pending.length > 0 ? (
              <button
                type="button"
                data-reroute-close
                disabled={busy}
                onClick={closeRing}
                className={`${btn} ${idleBtn} min-h-11 min-[880px]:min-h-0`}
              >
                {c.close}
              </button>
            ) : null}
            <button
              type="button"
              data-reroute-clear
              disabled={busy || (drawn.length === 0 && pending.length === 0)}
              onClick={() => {
                setDrawn([]);
                setPending([]);
              }}
              className={`${btn} ${idleBtn}`}
            >
              {c.clear}
            </button>
          </div>
        </div>

        {/* Row 2: the one primary action. Amber until the result on screen
            answers the current settings in full, green when it does, "stop"
            while a press is in flight. */}
        <div className="mt-3 mb-3 border-t border-rule pt-3">
          <button
            type="button"
            data-reroute-go
            data-reroute-go-state={goState}
            disabled={!data}
            onClick={busy ? stop : () => void reroute()}
            className={`w-full border px-6 py-2 font-mono text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 min-[880px]:w-auto ${goClass}`}
          >
            {busy ? c.stop : c.go}
          </button>
        </div>

        {/* Below 880px the map borrows the figure's side padding: every
            pixel of a phone-width map is a bigger target for a tapped vertex. */}
        <div ref={wrapRef} className="-mx-4 min-[880px]:mx-0">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={t.canvasAria}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              downRef.current = null;
            }}
            className={`block w-full ${drawMode ? "cursor-crosshair" : ""}`}
          />
        </div>

        <div className="mt-2 min-h-[1.5em] font-mono text-[11px] leading-relaxed">
          {ringMsg ? (
            <p className="text-red-ink" role="alert">
              {ringMsg}
            </p>
          ) : drawMode ? (
            <p className="text-mut">{t.drawHint}</p>
          ) : null}
          <p className="text-warm" role="status">
            {runState === "unavailable" ? t.unavailable : runState === "failed" ? t.runFailed : readout}
          </p>
          {plannedLine ? (
            <p data-reroute-planned className="text-mut">
              {plannedLine}
            </p>
          ) : null}
        </div>

        {summary ? (
          <div data-reroute-summary className={`mt-2 font-mono text-[11px] ${fresh ? "" : "opacity-50"}`}>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 min-[880px]:grid-cols-[auto_auto_auto_auto] min-[880px]:gap-x-6">
              {(
                [
                  ["checked", t.summary.checked, String(summary.checked), "text-ink"],
                  ["affected", t.summary.affected, String(summary.affected), "text-warm"],
                  ["rerouted", t.summary.rerouted, String(summary.rerouted), "text-warm"],
                  ["cannotClear", t.summary.cannotClear, String(summary.cannotClear), summary.cannotClear ? "text-red-ink" : "text-warm"],
                  [
                    "medianAdded",
                    t.summary.medianAdded,
                    summary.medianAddedNm === null || summary.medianAddedPct === null
                      ? "-"
                      : `${fmtSigned(summary.medianAddedNm, 0)} nm (${fmtSigned(summary.medianAddedPct, 1)}%)`,
                    "text-warm",
                  ],
                  [
                    "worstAdded",
                    t.summary.worstAdded,
                    summary.maxAddedNm === null || summary.maxAddedPct === null
                      ? "-"
                      : `${fmtSigned(summary.maxAddedNm, 0)} nm (${fmtSigned(summary.maxAddedPct, 1)}%)`,
                    "text-warm",
                  ],
                  [
                    "lowestClearance",
                    t.summary.lowestClearance,
                    summary.minClearanceNm === null ? "-" : `${(Math.floor(summary.minClearanceNm * 10) / 10).toFixed(1)} nm`,
                    summary.belowMargin ? "text-red-ink" : "text-warm",
                  ],
                ] as const
              ).map(([key, label, value, tone]) => (
                <div key={key} className="contents">
                  <dt className="text-mut">{label}</dt>
                  <dd data-summary={key} className={`tabular-nums ${tone}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {pickedRef ? (
              // One flight's numbers as label/value pairs, the summary's own
              // grid, so six fields fit a phone without a sideways scroll.
              <dl
                data-reroute-detail
                className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 border-t border-rule pt-2 min-[880px]:grid-cols-[auto_auto_auto_auto] min-[880px]:gap-x-6"
              >
                {(
                  [
                    ["pair", t.table.pair, pickedRef.pair, "text-ink"],
                    ["route", t.table.flight, String(pickedRef.route), "text-ink"],
                    ...(pickedOut
                      ? pickedOut.status === "untouched"
                        ? ([["added", t.table.added, t.untouched, "text-mut"]] as const)
                        : ([
                            ["added", t.table.added, `${fmtSigned(pickedOut.metrics.addedNm, 0)} nm`, "text-warm"],
                            ["addedPct", t.table.addedPct, `${fmtSigned(pickedOut.metrics.addedPct, 1)}%`, "text-warm"],
                          ] as const)
                      : []),
                    ...(pickedOut
                      ? ([
                          [
                            "clearance",
                            t.table.clearance,
                            pickedOut.metrics.minClearanceNm === null
                              ? "-"
                              : `${(Math.floor(pickedOut.metrics.minClearanceNm * 10) / 10).toFixed(1)} nm`,
                            pickedOut.metrics.minClearanceNm !== null && doneOut && pickedOut.metrics.minClearanceNm < doneOut.marginNm
                              ? "text-red-ink"
                              : "text-warm",
                          ],
                          [
                            "crossings",
                            t.table.crossings,
                            pickedOut.status === "cannot-clear"
                              ? `${pickedOut.metrics.legCrossings} · ${t.cannotClear}`
                              : String(pickedOut.metrics.legCrossings),
                            pickedOut.status === "cannot-clear" ? "text-red-ink" : "text-warm",
                          ],
                        ] as const)
                      : []),
                  ] as const
                ).map(([key, label, value, tone]) => (
                  <div key={key} className="contents">
                    <dt className="text-mut">{label}</dt>
                    <dd data-detail={key} className={`tabular-nums ${tone}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-mut">{t.pickHint}</p>
            )}
          </div>
        ) : null}

        {!isAll && done ? (
          <div className={`mt-2 overflow-x-auto ${fresh ? "" : "opacity-50"}`}>
            <table className="w-full border-collapse font-mono text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-rule text-left text-mut">
                  <th className={head}>{t.table.flight}</th>
                  <th className={head}>{t.table.added}</th>
                  <th className={head}>{t.table.addedPct}</th>
                  <th className={head}>{t.table.clearance}</th>
                  <th className="py-1 font-normal">{t.table.crossings}</th>
                </tr>
              </thead>
              <tbody>
                {done.flights.map((f) => (
                  <tr
                    key={f.id}
                    onPointerEnter={() => setHover(f.id)}
                    onPointerLeave={() => setHover((h) => (h === f.id ? null : h))}
                    className={`border-b border-hair ${hover === f.id ? "bg-ink/5" : ""}`}
                  >
                    <td className="py-1 pr-1.5 min-[880px]:pr-2 text-ink">{f.id}</td>
                    {flightCells(f)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {launchOn ? <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-mut">{t.launchNote}</p> : null}
      </div>
    </InstrumentFigure>
  );
}
