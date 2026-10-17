"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { isStargazing, noteOffload, subscribeStargaze } from "@/lib/stargaze";
import { trackDemoOnce } from "@/lib/track";
import { copy } from "@/content/copy";
import type {
  ConditionsLevel,
  LanderHandle,
  LanderOptions,
  LanderState,
  LanderTheme,
} from "@/lib/lander-types";

/**
 * The Titan lander, Figure 5 (since 2026-10-15): a rotorcraft flown through a
 * learned diffusion world model. Everything model-related lives in the module
 * the lunar_lander repo hands over (public/lander/v1/: its entry, its worker,
 * its models and its OWN onnxruntime-web build). The module draws only the
 * canvas (`ui: 'none'`, site embedding v2, 2026-10-16); every control, readout
 * and line of text around it is the site's, from `copy.systems.lander`.
 *
 * - The interface is the owner's "watch first" pick (2026-10-16): the attract
 *   flight runs on its own, and the only controls are the wind, take the
 *   controls (computer only: flying is keyboard-only, so phones watch) and a
 *   new flight. The readout shows the landing chance labelled "est." because
 *   the preview's value head misses its own calibration gate.
 * - Versioned directory, immutable cache (next.config.ts): any changed file
 *   ships as /lander/v2/ and this constant moves with it. `mount` rejects a
 *   query string, so the directory is the only cache key.
 * - The module is loaded by URL and never bundled: the magic comments leave
 *   the dynamic import alone (Next 16 docs, lazy-loading, "turbopackIgnore").
 * - Loading: `DeferredMount` mounts this near the viewport and `lander.js`
 *   (~43 KB gzipped) loads then; the module fetches its runtime and models
 *   only once the lander is on screen (owner call: the attract flight IS the
 *   demo). The WASM path shares the site's own `/ort/` plain pair
 *   (`ortBase: { wasm: '/ort' }`, owner call 2026-10-16: share the plain
 *   pair only): the worker checks each file's sha256 against its own
 *   manifest and falls back to its bundled copy on a mismatch. The WebGPU
 *   path always uses the bundled asyncify pair; `/ort/` never holds one.
 *   ⚠️ Upgrading onnxruntime-web means upgrading the lander with it (both
 *   1.27.0 today), or the shared entry falls back and downloads twice.
 * - Zoom (site embedding v2.1): a tighter camera, read once at mount, so it
 *   follows the same 880px breakpoint as the box's shape and a crossing
 *   remounts (the flight in progress is lost; rotating a tablet is rare).
 * - Stargaze unloads it outright, like chess: terminating the worker is the
 *   only way its memory comes back. A flight in progress is lost; on return
 *   it mounts fresh and loads again once on screen.
 * - A missing model is not a failure here: the module flies on a labelled
 *   physics predictor and draws `canvas.noModel` itself. `failed` is only a
 *   failed import of `lander.js` (a broken deploy).
 */
const LANDER_BASE = "/lander/v1";
/** The site's breakpoint, shared with the box's aspect classes below. */
const WIDE = "(min-width: 880px)";
/** Camera zoom by breakpoint (1 is the module's plain view, 4 its limit).
 *  Chosen from screenshots of both widths mid-flight, 2026-10-16. */
const ZOOM_WIDE = 1.5;
const ZOOM_NARROW = 2.25;

type LanderModule = { mount: (el: HTMLElement, opts: LanderOptions) => LanderHandle };
type Status = "loading" | "ready" | "failed";

/** Verify hook (scripts/verify-redesign.mjs), not UI: the module's own debug
 *  snapshot (null while nothing is mounted) and its newest state. */
const DEBUG = Symbol.for("lander.debug");
type LanderVerifyHook = {
  debug: () => Record<string, unknown> | null;
  state: LanderState | null;
  mounts: number;
  unloads: number;
};

/**
 * The site's palette for the roles that MEAN something, by the figure colour
 * conventions: green is the owner's own model (the dream's craft and ghosts),
 * red the baseline (the no-model fallback and the simple pilot) and alerts,
 * amber the instrument readouts. The craft keeps the module's own palette:
 * a role paints EVERY colour it owns in one colour, so setting `craft` drew
 * the hull, outline, rotors, MMRTG and centre-of-mass marker all in ink, one
 * flat shape with no detail. The sky, ground, terrain and
 * canvas text keep the module's Titan haze on purpose (2026-10-16, compared
 * at 1280px): with the site's dark tokens (panel, desk, rule, mut) the ground
 * nearly vanished and the dunes and target stopped reading, while Titan's
 * orange is the moon's own colour and the green trails stand out on it. A
 * canvas can't resolve var(--x), so each token is read once at mount; an
 * empty one leaves that role at the module's default.
 */
function siteTheme(): Partial<LanderTheme> {
  const css = getComputedStyle(document.documentElement);
  const roles: [keyof LanderTheme, string][] = [
    ["model", "--color-ok"],
    ["baseline", "--color-red-ink"],
    ["readout", "--color-warm"],
    ["hazard", "--color-red-ink"],
  ];
  const theme: Partial<LanderTheme> = {};
  for (const [role, prop] of roles) {
    const v = css.getPropertyValue(prop).trim();
    if (v) theme[role] = v;
  }
  return theme;
}

/** Which line describes the main craft. Only the dream's view in manual
 *  flight is a prediction (guide §4); the onboard view and a confirmed
 *  touchdown must never be called one. */
function viewKind(s: LanderState): keyof typeof copy.systems.lander.view {
  if (s.display === "fallback") return "fallback";
  if (s.outcome) return "touchdown";
  return s.mode === "autopilot" ? "onboard" : "prediction";
}

/** The amber corner: who is flying, the height, the landing chance. */
function readoutFor(s: LanderState | null, status: Status): string | null {
  const c = copy.systems.lander;
  if (status === "failed") return null;
  if (!s || s.model === "loading") return c.loading;
  if (s.outcome) return s.outcome === "landed" ? c.landed : c.crashed;
  const who =
    s.planner === "simple-pilot"
      ? c.who.simplePilot
      : s.display === "fallback"
        ? c.who.fallback
        : s.mode === "autopilot"
          ? c.who.autopilot
          : c.who.you;
  const parts = [who, `${Math.max(0, Math.round(s.flight.agl))} ${c.metres}`];
  // Floored, never rounded: 0.997 must not read as a certain "100%".
  if (s.landing) parts.push(`${c.landingPre}${Math.floor(s.landing.pSafe * 100)}${c.landingPost}`);
  return parts.join(" · ");
}

const LEVELS: ConditionsLevel[] = [0, 1, 2, 3];

export function LanderPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<LanderHandle | null>(null);
  // A remount (Strict Mode, a stargaze round trip) waits for the previous
  // unload, so two landers never share the container (mount throws if one is
  // still live there).
  const unloadingRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<Status>("loading");
  const [state, setState] = useState<LanderState | null>(null);
  // The newest state for the click handlers. React's `state` can be one
  // onState tick behind the module (measured 2026-10-16: a wind press just
  // after a stargaze restore read model "loading" from the last render,
  // skipped setAutopilot, and left a hand-flown flight a phone can't fly).
  const stateRef = useRef<LanderState | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let mod: LanderModule | null = null;
    let disposed = false;
    let onScreen = true;

    const hook: LanderVerifyHook = {
      debug: () => {
        const h = handleRef.current as (LanderHandle & { [DEBUG]?: () => Record<string, unknown> }) | null;
        return h?.[DEBUG]?.() ?? null;
      },
      state: null,
      mounts: 0,
      unloads: 0,
    };
    (window as Window & { __lander?: LanderVerifyHook }).__lander = hook;

    // One desired state from every input. Tab visibility is the module's own.
    const sync = () => {
      const h = handleRef.current;
      if (!h) return;
      if (onScreen) h.resume();
      else h.pause();
    };
    const mountNow = async () => {
      await unloadingRef.current;
      if (disposed || !mod || handleRef.current || isStargazing()) return;
      handleRef.current = mod.mount(host, {
        assetBase: LANDER_BASE,
        ui: "none",
        // The box below sets the shape (wider on a desktop, taller on a
        // phone), so the canvas fills it rather than imposing its own.
        aspect: "fill",
        zoom: window.matchMedia(WIDE).matches ? ZOOM_WIDE : ZOOM_NARROW,
        ortBase: { wasm: "/ort" },
        theme: siteTheme(),
        text: { ...copy.systems.lander.canvas },
        onState: (s) => {
          hook.state = s;
          stateRef.current = s;
          setState(s);
        },
        onEvent: (e) => {
          if (e.type === "flight_started") trackDemoOnce("lander");
        },
      });
      hook.mounts++;
      sync();
    };
    const unmountNow = () => {
      const h = handleRef.current;
      handleRef.current = null;
      hook.state = null;
      stateRef.current = null;
      setState(null);
      if (!h) return;
      unloadingRef.current = h.unload().then(() => {
        hook.unloads++;
        noteOffload("lander");
      });
    };

    void (async () => {
      try {
        mod = (await import(
          /* webpackIgnore: true */ /* turbopackIgnore: true */ `${LANDER_BASE}/lander.js`
        )) as LanderModule;
        if (disposed) return;
        setStatus("ready");
        await mountNow();
      } catch (err) {
        console.error("lander: module failed to load", err);
        if (!disposed) setStatus("failed");
      }
    })();

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(host);
    const unsubscribe = subscribeStargaze((on) => {
      if (on) unmountNow();
      else void mountNow();
    });
    // Zoom is read at mount only: crossing the breakpoint remounts.
    const wide = window.matchMedia(WIDE);
    const onBreakpoint = () => {
      if (!handleRef.current) return;
      unmountNow();
      void mountNow();
    };
    wide.addEventListener("change", onBreakpoint);

    return () => {
      disposed = true;
      io.disconnect();
      unsubscribe();
      wide.removeEventListener("change", onBreakpoint);
      unmountNow();
    };
  }, []);

  const c = copy.systems.lander;
  const ready = state?.model === "ready";

  /** A fresh hop, flown by the autopilot when the model is there to fly it
   *  (watch first); without the model it waits on the pad for the keys. */
  const freshFlight = (level: ConditionsLevel) => {
    const h = handleRef.current;
    if (!h) return;
    h.newFlight({ level });
    if (stateRef.current?.model === "ready") h.setAutopilot(true);
  };
  const pickLevel = (level: ConditionsLevel) => {
    const h = handleRef.current;
    if (!h || level === stateRef.current?.level) return;
    h.setLevel(level);
    freshFlight(level);
  };
  const toggleControls = () => {
    const h = handleRef.current;
    const now = stateRef.current;
    if (!h || !now) return;
    if (now.mode === "autopilot") {
      h.setAutopilot(false);
      // Flying is keyboard-only: the canvas has to hold focus for the keys.
      hostRef.current?.querySelector("canvas")?.focus();
    } else {
      h.setAutopilot(true);
    }
  };

  const flyingByHand = state?.mode === "manual" && !state.attract;

  return (
    <InstrumentFigure
      n="5"
      id="fig-lander"
      caption={c.figureCaption}
      readout={<span data-lander-readout>{readoutFor(state, status)}</span>}
    >
      {/* The readout sits in the figure's top-right corner: from 880px the
          heading keeps clear of it on the same line, below that it starts
          under it (a right pad at 360px squeezed it to a word a line). */}
      <h3 className="mt-6 mb-2 text-[17px] font-semibold text-ink min-[880px]:mt-1 min-[880px]:pr-64">{c.heading}</h3>
      <p className="mb-5 text-[15px] leading-relaxed text-mut">{c.lede}</p>

      <div data-lander-panel={status}>
        {/* The module's root fills this box and its canvas fills the root
            (`aspect: 'fill'`), so the box needs a definite height, which
            aspect-ratio gives it: taller on a phone, where the sheet is
            narrow, wider from 880px. */}
        <div
          ref={hostRef}
          data-lander-host
          className="aspect-[4/3] w-full border border-rule min-[880px]:aspect-[16/9]"
        />

        {status === "failed" ? (
          <p className="mt-3 font-mono text-[12px] text-red-ink">{c.loadFailed}</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 font-mono text-[11px]">
            <div className="flex flex-col gap-1">
              <span aria-hidden="true" className="text-mut">
                {c.windLabel}
              </span>
              <div className="flex" role="group" aria-label={c.windLabel} data-lander-wind>
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => pickLevel(level)}
                    disabled={!state}
                    aria-pressed={state?.level === level}
                    // Chess's segmented control: -ml-px joins the buttons and
                    // `relative` keeps the active border on top.
                    className={`border px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      level > 0 ? "-ml-px" : ""
                    } ${
                      state?.level === level
                        ? "relative border-ok text-ok"
                        : "border-rule text-mut hover:border-mut hover:text-ink"
                    }`}
                  >
                    {c.levels[level]}
                  </button>
                ))}
              </div>
            </div>
            {/* Computer only: flying is keyboard-only, so phones watch. */}
            <button
              type="button"
              onClick={toggleControls}
              disabled={!state || (state.mode === "manual" && !ready)}
              data-lander-take
              className="hidden border border-rule px-3 py-1.5 text-xs text-mut transition-colors hover:border-mut hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 min-[880px]:inline-block"
            >
              {state?.mode === "manual" ? c.giveBack : c.takeControls}
            </button>
            <button
              type="button"
              onClick={() => state && freshFlight(state.level)}
              disabled={!state}
              data-lander-new
              className="border border-rule px-3 py-1.5 text-xs text-mut transition-colors hover:border-mut hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {c.newFlight}
            </button>
          </div>
        )}

        {state?.level === 3 ? (
          <p data-lander-beyond className="mt-2 font-mono text-[11px] text-warm">
            {c.beyondNote}
          </p>
        ) : null}
        {state ? (
          <p data-lander-view aria-live="polite" className="mt-3 text-[13.5px] leading-relaxed text-mut">
            {c.view[viewKind(state)]}
            {flyingByHand ? <span className="hidden min-[880px]:inline"> {c.keys}</span> : null}
          </p>
        ) : null}
      </div>
    </InstrumentFigure>
  );
}
