"use client";

import { useEffect, useRef, useState } from "react";
import { isStargazing, noteOffload, subscribeStargaze } from "@/lib/stargaze";
import { trackDemoOnce } from "@/lib/track";
import { copy } from "@/content/copy";
import type { LanderHandle, LanderOptions } from "@/lib/lander-types";

/**
 * The Titan lander (Figure 5): a rotorcraft flown through a learned diffusion
 * world model. Everything model-related lives in the module the lunar_lander
 * repo hands over (public/lander/v1/: its entry, its worker, its models and
 * its OWN onnxruntime-web build); this component only mounts it, pauses it
 * off-screen, unloads it for stargaze, and counts use.
 *
 * - Versioned directory, immutable cache (next.config.ts): any changed file
 *   ships as /lander/v2/ and this constant moves with it. `mount` rejects a
 *   query string, so the directory is the only cache key.
 * - The module is loaded by URL and never bundled: the magic comments leave
 *   the dynamic import alone (Next 16 docs, lazy-loading, "turbopackIgnore").
 *   Its worker is created by the module from the same base, so Turbopack
 *   never sees it either.
 * - Loading: `DeferredMount` mounts this near the viewport and `lander.js`
 *   (~43 KB gzipped) loads then; the module itself fetches its runtime and
 *   models only once the lander is actually on screen (owner call,
 *   2026-10-15: on screen, not on first press, because the attract flight IS
 *   the demo). Not in lib/warm.ts: its runtime is its own, not the one chess
 *   shares.
 * - Stargaze unloads it outright, like chess: terminating the worker is the
 *   only way its memory comes back. A flight in progress is lost; on return
 *   it mounts fresh and loads again once on screen.
 * - A missing model is not a failure here: the module flies on a labelled
 *   physics predictor and says so itself. `failed` is only a failed import of
 *   `lander.js` (a broken deploy).
 */
const LANDER_BASE = "/lander/v1";

type LanderModule = { mount: (el: HTMLElement, opts: LanderOptions) => LanderHandle };
type Status = "loading" | "ready" | "failed";

/** Verify hook (scripts/verify-redesign.mjs), not UI: the module's own debug
 *  snapshot, or null while nothing is mounted. */
const DEBUG = Symbol.for("lander.debug");
type LanderVerifyHook = { debug: () => Record<string, unknown> | null; mounts: number; unloads: number };

export function LanderPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  // A remount (Strict Mode, a stargaze round trip) waits for the previous
  // unload, so two landers never share the container (mount throws if one is
  // still live there).
  const unloadingRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let mod: LanderModule | null = null;
    let handle: LanderHandle | null = null;
    let disposed = false;
    let onScreen = true;

    const hook: LanderVerifyHook = {
      debug: () => {
        const h = handle as (LanderHandle & { [DEBUG]?: () => Record<string, unknown> }) | null;
        return h?.[DEBUG]?.() ?? null;
      },
      mounts: 0,
      unloads: 0,
    };
    (window as Window & { __lander?: LanderVerifyHook }).__lander = hook;

    // One desired state from every input. Tab visibility is the module's own.
    const sync = () => {
      if (!handle) return;
      if (onScreen) handle.resume();
      else handle.pause();
    };
    const mountNow = async () => {
      await unloadingRef.current;
      if (disposed || !mod || handle || isStargazing()) return;
      handle = mod.mount(host, {
        assetBase: LANDER_BASE,
        onEvent: (e) => {
          if (e.type === "flight_started") trackDemoOnce("lander");
        },
      });
      hook.mounts++;
      sync();
    };
    const unmountNow = () => {
      const h = handle;
      handle = null;
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

    return () => {
      disposed = true;
      io.disconnect();
      unsubscribe();
      unmountNow();
    };
  }, []);

  return (
    <div data-lander-panel={status}>
      {/* Auto height, against the handoff guide (which asks for 4:3 from
          880px and a phone min-height): the preview module sizes itself to
          its CONTENT (the canvas is 16:9 of the width, the controls flow
          below it), so a fixed box let it paint ~430px past the box at
          1280 and ~600px at 360, over the caption and the next section
          (measured 2026-10-15). Its root's 100% height resolves to auto
          here, which is the content height. Revisit with the site-owned UI. */}
      <div ref={hostRef} data-lander-host className="w-full" />
      {status === "failed" ? (
        <p className="mt-3 font-mono text-[12px] text-red-ink">{copy.systems.lander.loadFailed}</p>
      ) : null}
    </div>
  );
}
