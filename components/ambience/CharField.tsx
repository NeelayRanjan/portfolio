"use client";

import { useEffect, useRef } from "react";

/**
 * The idle character field: a settled sample that re-samples patches of itself.
 *
 * A faint full-page monospace texture that mostly sits still, with small regions
 * occasionally scrambling to noise and resolving back. It replaces the migrating
 * swarm's "the page resolves as you move" feel without a constant sim — the field
 * is static except where a patch is live.
 *
 * BUDGET IS THE POINT. This is why the swarm stopped following you down the page:
 * a full-viewport canvas that never stops is a battery tax on a phone for
 * something you barely see. So:
 *   - ~10fps on a setTimeout, NOT a 60fps rAF. A background does not need frames.
 *   - a hard cap on simultaneous patches.
 *   - nothing runs while the tab is hidden.
 *   - fewer cells and a slower cadence on small screens.
 *   - reduced-motion renders the settled field once and never touches it again.
 * If you make this smoother, you have missed the reason it exists.
 */

/** The settled ramp: intensity, low to high. The same glyphs the diffusion demos
 *  resolve through, so the background rhymes with them. */
const RAMP = " .·:-=+*";
/** Noise also draws the direction glyphs. They carry no intensity, so they'd be
 *  meaningless in the base ramp, but they're what makes a scrambling patch read
 *  as flow rather than as static. */
const NOISE_CHARS = " .·:-=+*/\\|_";

/** Small enough that the field reads as a continuous texture rather than as
 *  legible characters, big enough that the glyphs still register. Tuned by eye
 *  between two failures: 22px was a wall of readable text competing with the
 *  copy, 6px was so fine it disappeared. The tradeoff is cell count — halving
 *  the font quadruples it, so see the paint budget note in `paint()`. */
const FONT_DESKTOP = 9;
const FONT_MOBILE = 10;
const LINE_HEIGHT = 1.1;
const SMALL_SCREEN = 640;

/** 10fps. Not negotiable — see above. */
const TICK_MS = 90;

/** Patch size is in PIXELS, not cells, on purpose. Sized in cells it would shrink
 *  with the font and the disruption would vanish into the texture; the visual
 *  footprint is what was tuned, so that's what's held constant. */
const PATCH_MIN_W_PX = 72;
const PATCH_MAX_W_PX = 124;
const PATCH_MIN_H_PX = 72;
const PATCH_MAX_H_PX = 124;
const PATCH_LIFE_MS = 1000;
const MAX_PATCHES = 4;
const MAX_PATCHES_SMALL = 3;
/** Idle cadence. Slower on small screens: fewer wakeups, cooler phone. */
const SPAWN_MIN_MS = 600;
const SPAWN_MAX_MS = 1400;
const SPAWN_MIN_MS_SMALL = 1400;
const SPAWN_MAX_MS_SMALL = 2800;
/** Cursor stirs are throttled so a sweep across the page doesn't spawn hundreds. */
const POINTER_THROTTLE_MS = 260;

/** Chars in the width probe. Averaging over a run divides out subpixel rounding,
 *  which a single glyph's rect would carry into every column of the grid. */
const PROBE_N = 100;

type Patch = { c: number; r: number; w: number; h: number; born: number };

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));

export function CharField() {
  const preRef = useRef<HTMLPreElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    const probe = probeRef.current;
    if (!pre || !probe) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cols = 0;
    let rows = 0;
    /** The settled field: one char per cell, computed once per size. */
    let base: string[] = [];
    let patches: Patch[] = [];
    let timer = 0;
    let nextSpawn = 0;
    let running = false;
    let small = false;
    let lastPointer = 0;
    /** Cell geometry in px, so patches can be sized in pixels. */
    let cellW = 1;
    let cellH = 1;
    /** The settled field, pre-joined. Painted as-is whenever nothing is live —
     *  which is most of the time, and is what keeps a 60k-cell grid cheap. */
    let baseText = "";
    let baseLines: string[] = [];

    /** The base pattern. A smooth function, so the field reads as a coherent
     *  texture rather than as noise that happens to be dim. */
    const buildBase = () => {
      base = new Array(cols * rows);
      baseLines = new Array(rows);
      for (let r = 0; r < rows; r++) {
        let line = "";
        for (let c = 0; c < cols; c++) {
          const raw =
            0.5 + 0.5 * Math.sin(c * 0.14 + r * 0.3) * Math.cos(r * 0.4 - c * 0.05);
          // Soft ramp, pushed HARD toward the low end. The raw pattern is a
          // product of sinusoids, so it sits around 0.5 on average — mapped
          // straight, half the field lands on "=+*" and the page becomes a wall
          // of characters you have to read the copy through. This gamma keeps
          // most cells blank or near-blank and lets only the crests show, which
          // is what makes it a texture rather than a background you fight.
          const v = Math.pow(Math.min(1, Math.max(0, raw)), 2.6);
          const ch = RAMP[Math.round(v * (RAMP.length - 1))];
          base[r * cols + c] = ch;
          line += ch;
        }
        baseLines[r] = line;
      }
      baseText = baseLines.join("\n");
    };

    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      small = w < SMALL_SCREEN;
      const fontSize = small ? FONT_MOBILE : FONT_DESKTOP;
      pre.style.fontSize = `${fontSize}px`;
      pre.style.lineHeight = String(LINE_HEIGHT);

      // Measure the real advance off `probe`, a hidden span carrying the same
      // font-mono class and font-size as the field. Never assume 0.6em: the mono
      // stack resolves differently per platform and a guess leaves a ragged edge.
      //
      // The obvious version of this measures a canvas —
      //   ctx.font = `${cs.fontSize} ${cs.fontFamily}`; ctx.measureText("M").width
      // — and it has a silent failure mode. next/font ships the family as a CSS
      // variable; if it hasn't resolved, the string canvas gets is invalid, and an
      // invalid ctx.font assignment is IGNORED rather than thrown. ctx.font stays
      // "10px sans-serif" and measureText returns ~9.5px instead of 5.4px.
      //
      // A DOM probe can't be handed the wrong font, but it CAN be read too early,
      // which is the actual bug this had. See the ResizeObserver below.
      probe.style.fontSize = `${fontSize}px`;
      cellW = probe.getBoundingClientRect().width / PROBE_N || fontSize * 0.6;
      cellH = fontSize * LINE_HEIGHT;

      cols = Math.max(8, Math.ceil(w / cellW) + 1);
      rows = Math.max(4, Math.ceil(h / cellH) + 1);
      buildBase();
    };

    /**
     * Compose the visible field: base everywhere, noise inside live patches.
     *
     * PAINT BUDGET. At a 6px font this grid is ~60k cells, so rebuilding every
     * cell each tick would be ~600k char ops a second for a background. It
     * doesn't: the settled field is pre-joined once per resize, and only the rows
     * a patch actually covers get rebuilt. With no patches live it's a single
     * assignment of a cached string.
     */
    const paint = (now: number) => {
      if (!patches.length) {
        if (pre.textContent !== baseText) pre.textContent = baseText;
        return;
      }
      const out = baseLines.slice();
      // Only the rows some patch touches.
      const dirty = new Set<number>();
      for (const p of patches) {
        for (let r = p.r; r < p.r + p.h && r < rows; r++) dirty.add(r);
      }
      for (const r of dirty) {
        let line = "";
        for (let c = 0; c < cols; c++) {
          let ch = base[r * cols + c];
          for (const p of patches) {
            if (c < p.c || c >= p.c + p.w || r < p.r || r >= p.r + p.h) continue;
            // Noise early, base late: the patch resolves as it ages.
            const noiseProb = 1 - (now - p.born) / PATCH_LIFE_MS;
            if (Math.random() < noiseProb) {
              ch = NOISE_CHARS[(Math.random() * NOISE_CHARS.length) | 0];
            }
            break;
          }
          line += ch;
        }
        out[r] = line;
      }
      // textContent, not React state: re-rendering the tree for this would be absurd.
      pre.textContent = out.join("\n");
    };

    const spawn = (c?: number, r?: number) => {
      const cap = small ? MAX_PATCHES_SMALL : MAX_PATCHES;
      if (patches.length >= cap) return;
      // px -> cells, so the disruption keeps its tuned size at any font.
      const w = Math.max(2, Math.round(rand(PATCH_MIN_W_PX, PATCH_MAX_W_PX) / cellW));
      const h = Math.max(2, Math.round(rand(PATCH_MIN_H_PX, PATCH_MAX_H_PX) / cellH));
      patches.push({
        c: Math.min(Math.max(0, c ?? randInt(0, cols - w)), Math.max(0, cols - w)),
        r: Math.min(Math.max(0, r ?? randInt(0, rows - h)), Math.max(0, rows - h)),
        w,
        h,
        born: performance.now(),
      });
    };

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      patches = patches.filter((p) => now - p.born < PATCH_LIFE_MS);
      if (now >= nextSpawn) {
        spawn();
        nextSpawn =
          now +
          (small ? rand(SPAWN_MIN_MS_SMALL, SPAWN_MAX_MS_SMALL) : rand(SPAWN_MIN_MS, SPAWN_MAX_MS));
      }
      paint(now);
      timer = window.setTimeout(tick, TICK_MS);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      nextSpawn = performance.now();
      tick();
    };
    const stop = () => {
      running = false;
      window.clearTimeout(timer);
    };

    measure();
    paint(performance.now()); // the settled field, immediately — reduced-motion stops here

    // RE-MEASURE WHEN THE METRICS ACTUALLY CHANGE, rather than at a moment we
    // guess is "ready". Mount is too early and there is no reliable later moment
    // to pick:
    //
    // This effect can run before the browser has applied its own styles. Measured
    // in Firefox: `pre.style.fontSize` reads back "9px" while
    // `getComputedStyle(pre).fontSize` still says "16px" — the default — so the
    // probe returns 9.6px per char (16 * 0.6) instead of 5.4px. cols comes out 135
    // instead of 239 and the field stops 57% across the viewport with a hard
    // vertical edge, silently, forever. Reproducible under prefers-reduced-motion,
    // which happens to get here ~120ms earlier.
    //
    // `document.fonts.ready` does NOT fix it: fonts were already "loaded" in the
    // failing runs. Fonts were never the problem, style application was, and the
    // two aren't ordered against each other.
    //
    // ResizeObserver on the probe is the honest signal — it fires exactly when the
    // advance changes, whatever the cause: styles landing late, a webfont
    // swapping in, or the reader zooming. measure() only re-sets the probe to the
    // same font-size, so this settles instead of looping.
    const metrics = new ResizeObserver(() => {
      const next = probe.getBoundingClientRect().width / PROBE_N;
      if (!next || Math.abs(next - cellW) < 0.05) return;
      measure();
      paint(performance.now());
    });
    metrics.observe(probe);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    // Stir under the cursor. Desktop-only in practice: touch fires no pointermove
    // without a press, so phones simply never reach this.
    const onPointer = (e: PointerEvent) => {
      if (reduced || e.pointerType === "touch") return;
      const now = performance.now();
      if (now - lastPointer < POINTER_THROTTLE_MS) return;
      lastPointer = now;
      spawn(Math.floor(e.clientX / cellW) - 8, Math.floor(e.clientY / cellH) - 5);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // Stir where a section arrives. This is what gives back "the page resolves as
    // you move" — and unlike the cursor, it works on a phone.
    const io = new IntersectionObserver(
      (entries) => {
        if (reduced || document.hidden) return;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          spawn(undefined, Math.floor(e.boundingClientRect.top / cellH));
        }
      },
      { threshold: 0.25 },
    );
    for (const el of document.querySelectorAll("main section")) io.observe(el);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        measure();
        paint(performance.now());
      }, 200);
    };
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      metrics.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <>
      {/* The width probe. A sibling rather than a child of `pre`, because paint()
          overwrites the field via textContent and would delete it on the first
          tick. Same font-mono class and same font-size as the field, so it
          resolves to identical metrics; visibility:hidden and fixed, so it costs
          no layout and paints nothing. Deterministic content, so it SSRs without
          a hydration mismatch. */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 font-mono whitespace-pre select-none"
        style={{ visibility: "hidden" }}
      >
        {"M".repeat(PROBE_N)}
      </span>
      {/* -z-20: behind the swarm (-z-10) and behind content, above html's
          background. body must stay transparent or this never shows.

          Indigo (--color-indigo, #8f88dd), not the teal this used to be. The
          alpha is 0.18 where teal sat at 0.15, and that is NOT a change of mind
          about density — it holds density constant. Against #080a12 indigo
          carries ~82% of teal's relative luminance (~144 vs ~176), so reusing
          0.15 would have quietly made the field fainter than the one that got
          tuned by eye. Measured full-viewport, floor subtracted: teal 0.15 =
          0.340, indigo 0.18 = 0.338 (-0.6%), indigo 0.15 = 0.261 (-23%). If you
          retint this again, scale the alpha by luminance and re-measure; don't
          copy the number across.

          The ceiling is unchanged: faint enough to read the copy over it
          everywhere. Raise it and check the hero caption still reads. */}
      <pre
        ref={preRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-20 overflow-hidden font-mono whitespace-pre text-[rgba(143,136,221,0.18)] select-none"
      />
    </>
  );
}
