# Sky Objects, Drag to Pan, Stargaze Cards and the ISS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the north celestial pole to the top left and let visitors drag the chart; add the Milky Way, deep-sky objects, named stars, Voyagers, meteor radiants and the ISS as real-data layers; give every one of them a sourced one-liner on the desk and a cited card in stargaze mode.

**Architecture:** Two hand-run pipelines and one hand-written content file feed the existing canvas. `scripts/prepare-sky-objects.mjs` builds `public/sky/objects.json` and `public/sky/milkyway.json` from pinned or dated sources (d3-celestial, JPL Horizons, the IMO 2026 calendar, a pinned Wikipedia revision). `content/sky-facts.ts` holds every card's words and citations, voice-gated like `copy.ts`. Pure, import-free modules (`lib/sky-math.ts`, `lib/sky-pan.ts`, `lib/sky-objects.ts`, `lib/sky-iss.ts`) are pinned in plain node; `lib/sky-layers.ts` and `lib/sky-render.ts` draw; `components/manuscript/NightSky.tsx` owns time, input, loading and the card; `components/manuscript/SkyCard.tsx` is the DOM card. A same-origin, 2-hour-cached route (`app/api/iss-tle/route.ts`) proxies CelesTrak; `satellite.js` propagates in the browser.

**Tech Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript, Tailwind v4, canvas 2D, `satellite.js` 7.1.0 (new runtime dependency), `astronomy-engine` 2.1.19 (devDependency, tests only), Playwright Firefox, Node 24 (`node --test`, native type stripping).

**Spec:** `docs/superpowers/specs/2026-09-15-sky-objects-design.md` (binding; read it first). It builds on `docs/superpowers/specs/2026-09-14-night-sky-design.md`, whose contracts stand unless the new spec changes them. Also binding: `CLAUDE.md` (Constitution, Voice, traps, "Night sky + stargaze") and `AGENTS.md`.

## Global Constraints

- Work in the worktree `/home/neelayranjan/Documents/portfolio-night-sky`, branch `sky-objects`. Every path below is relative to it.
- Runtime dependencies are exactly `chess.js`, `onnxruntime-web`, `@vercel/analytics`, `satellite.js` (added in Task 6 as `^7.1.0`, MIT). `astronomy-engine@2.1.19` stays a devDependency; nothing under `app/`, `components/`, `lib/` or `content/` imports it.
- Never edit vendored model math: `lib/ascii-diffusion.js`, `lib/headshot-diffusion.js`. `onnxruntime-web` is never imported by a new file; the chess worker literal `new Worker(new URL("./chess-worker.ts", import.meta.url), { type: "module" })` is untouched.
- `lib/sky-math.ts`, `lib/sky-pan.ts`, `lib/sky-objects.ts`, `lib/sky-iss.ts` and `content/sky-facts.ts` have NO runtime imports (node imports them directly; `import type` is allowed and erased). Erasable TypeScript only: no enums, namespaces or parameter properties.
- Frame: J2000 equatorial for everything drawn. The ISS arrives in a frame of date and is precessed to J2000 before drawing.
- Pole: `(0.16·W, 0.18·H)` at width ≥ 880px, `(0.22·W, 0.10·H)` below. `k` puts declination `−35°` on the viewport corner farthest from the pole (`k = far / tan(62.5°)`; measured `k = 737.6` at 1440x900). Orientation unchanged: up = zenith over Moffett Field, east right, counterclockwise. Observer: lat `37.4153`, lon `-122.0647`, height `0.01` km.
- Drag: offset rubber-banded past `0.45·min(W,H)`; click if travel < `5` px; spring rate `9.5 /s` critically damped, snaps to exactly (0, 0); reduced motion snaps home on release. Mouse or pen on the desk in normal mode (never starting on `[data-sheet]`, a link, button, input, select, textarea, label, summary, `[role='button']` or `[data-sky-card]`); any pointer anywhere in stargaze mode. The sky keeps turning.
- Hover: nearest selectable symbol within `12` px, else nearest constellation segment within `24` px. Cards open only in stargaze mode.
- Speed-up stays `180`. Frame gates stay `50` ms (≥ 880px) / `100` ms below, lifted only while a drag or spring is live. DPR cap `2`. Star limits `5.0` / `4.5`.
- Colours are the tokens in `app/globals.css`: desk `#0c0b09`, ink `#eae5da` (`234,229,218`), mut `#9a948a` (`154,148,138`), warm `#d9a45b` (`217,164,91`), panel, rule, link. No red in the sky. Warm marks human-made things (Voyagers, ISS) and radiants; ink/mut at low alpha marks natural objects.
- Canvas text resolves the real font family via `getComputedStyle` (already `fontFamily` in NightSky), never a CSS variable in `ctx.font` (CLAUDE.md trap).
- Animation reads the clock: angles from the simulated time, spring from real elapsed ms (closed form), never per-frame constants. Skip work while `document.hidden`.
- Tailwind breakpoints: only `min-[Npx]` variants alongside the site's `min-[880px]`; never `sm:`/`md:` (CLAUDE.md trap).
- Every visitor-facing string lives in `content/copy.ts` or `content/sky-facts.ts` and passes `node scripts/check-voice.mjs`: no em dashes, no en-dash connectors (digit ranges only), none of CLAUDE.md's banned words or constructions, first person where the site speaks, sentence case, end flat. Before any copy is written, fetch Wikipedia's "Signs of AI writing" (https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) and apply it (the owner's standing instruction).
- Facts: every number in a card appears in one of its cited sources; no uncited claim; quotes verbatim inside curly quotation marks; paraphrases change wording, never facts. Citations are APA: `Author. (Year). Title. Site. Retrieved Month D, YYYY, from URL`, `year` may be `n.d.`.
- Gates: a missing data file resolves `null` and the sky draws without that layer; a malformed one throws and NightSky logs it with `console.error`. Nothing stands in for a missing layer. Nothing model-sized loads before interaction (`HEAVY_RE` in the verify script must still match nothing new).
- Analytics: no new event names, no tracking on citation links.
- Verification only against a production build: `npm run build`, then `npx next start -p 3000`. Port 3000 only; the owner's dev server lives on :3001, never touch it; never request the production domain. Stop or restart only the :3000 process: `kill $(ss -ltnp | grep ':3000 ' | grep -o 'pid=[0-9]*' | cut -d= -f2)`. Never `pkill -f` anything.
- Commits end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Do not push; pushing `main` deploys production and the owner decides.

## File map

| file | responsibility |
|---|---|
| `lib/sky-math.ts` (modify) | `poleFor`, the new `chartFor` (pole + `k` rule + drag offset), `EDGE_DEC_DEG = -35`, `WIDE_MIN_PX`; `precessToJ2000` (Task 6) |
| `lib/sky-pan.ts` (new) | rubber band and closed-form return spring, no imports |
| `scripts/test-sky-math.mjs`, `scripts/test-sky-pan.mjs` | node pins for the projection, precession and the pan physics |
| `scripts/prepare-sky-objects.mjs` (new) | hand-run: fetch, parse, transcribe, assert, write the two data files |
| `public/sky/objects.json`, `public/sky/milkyway.json` (new, committed) | 30 objects, 12 showers, 88 constellation origins; the simplified band |
| `scripts/test-sky-objects.mjs` (new) | shape/landmark checks on the committed files; `lib/sky-objects.ts` helpers |
| `content/sky-facts.ts` (new) | 138 facts with citations, the single source of one-liners and card prose |
| `scripts/test-sky-facts.mjs` (new), `scripts/check-voice.mjs` (modify) | facts coverage and citation shape; the voice gate scans both content files |
| `lib/sky-objects.ts` (new) | loaders + types for the two data files; per-catalog precomputation; `isShowerActive` |
| `lib/sky-layers.ts` (new) | draws the Milky Way, object symbols, radiants, the ISS; returns hits |
| `lib/sky-render.ts` (replace) | spec §4 layer order, hits, generalized hover label with a one-liner line, selection ring |
| `components/manuscript/NightSky.tsx` (modify) | drag, layer loading, hover precedence, card state and placement, ISS tracking, `window.__sky` |
| `components/manuscript/SkyCard.tsx` (new) | the DOM card |
| `lib/sky-iss.ts` (new), `app/api/iss-tle/route.ts` (new), `scripts/test-sky-iss.mjs` (new) | TLE parsing, topocentric look, the cached proxy, its node pin |
| `content/copy.ts`, `app/globals.css`, `package.json` | card copy and hints, credit line; stargaze `touch-action`; the dependency |
| `scripts/verify-redesign.mjs` | `sky-orientation`/`sky-hover`/`sky-animates-1280` updated; `sky-drag`, `sky-objects`, `stargaze-card`, `sky-iss` added (27 checks) |
| `CLAUDE.md`, `README.md`, `public/og.png`, the spec's status line | docs and the regenerated share card |

## Measured while planning (2026-09-15), so asserts are calibrated, not guessed

- d3-celestial at `7e720a3de062059d4c5400a379146a601d9010e0`: `messier.json` gives M31 `[10.6751, 41.2667]` type `s` dim `190x60`, M87 `[-172.3, 12.4]` type `e`, M45 type `oc`, M57 type `pn`; `mw.json` is 5 `MultiPolygon` features `ol1..ol5` with 10/113/46/27/6 rings and 30,676 vertices, lat −74.9..66.9; rings cross RA 0h/24h without being split (harmless in a polar chart). Douglas-Peucker on the sphere at `0.2°`, dropping rings under 4 points or under `1.5°` across: **2,267 vertices, 30,159 bytes**. All 15 named stars resolve by HIP in `starnames.json` and `stars.6.json` (all mag ≤ 1.97).
- Wikipedia "IAU designated constellations" revision `1373165890` (2026-09-04), raw wikitext SHA-256 `b2a22176359234614002fbf7ca177dfd0c4d10ea2346d71f2723827b6e9c45b5`. Parsed origin groups: ancient-only 47, ancient split in 1756 (Car, Pup, Vel) 3, ancient + 1536 (Com) 1, Lacaille 1756 14, Plancius/Keyser/de Houtman 1598 12, Plancius 1613 2, 1592 1, 1589 1, Hevelius 1690 7. Some discoverer cells end in a stray comma in the source; the parser strips it.
- imo.net is offline ("temporarily offline", several weeks). The IMO 2026 Meteor Shower Calendar is archived at `https://web.archive.org/web/20260905025331id_/https://www.imo.net/files/meteor-shower/cal2026.pdf`, SHA-256 `fde5388889ebda9fe13436d793da5e9935ae46b99edf20e0b19f7fe32ce1ed9f`, 28 pages, "edited by Jürgen Rendtel", IMO INFO(3-25); Table 5 is on page 25. The Sun's J2000 ecliptic longitude at 12:00 UTC on each 2026 peak date is within 0.81° of Table 5's λ⊙ for all 12 showers (worst: Draconids).
- The calendar names parent bodies only for the Lyrids (C/1861 G1 Thatcher), Perseids (109P/Swift-Tuttle), Draconids (21P/Giacobini-Zinner), Taurids (2P/Encke) and Leonids (55P/Tempel-Tuttle). NASA Science "Fast Facts" give Quadrantids 2003 EH1, η-Aquariids 1P/Halley, Southern δ-Aquariids 96P/Machholz (suspected), Orionids 1P/Halley, Geminids 3200 Phaethon (NASA has no Draconids, Ursids or Taurids page). Wikipedia "Ursids" revision `1328535157` gives 8P/Tuttle.
- JPL Horizons, 2026-09-15 00:00 UT: Voyager 1 RA 17h14m28.41s Dec +12°14′16.3″ 171.83 au; **Voyager 2 RA 20h10m08.13s Dec −59°47′07.4″ 143.56 au, which is south of the −35° chart edge: it is never on screen.** It still gets data, a fact and a card id; it simply never draws.
- CelesTrak `gp.php?CATNR=25544&FORMAT=TLE` answers with CRLF line ends and a space-padded name. Today's set: epoch `26258.17538348` = `2026-09-15T04:12:33.132Z`; the ISS passes 25.9° up over Moffett Field at 07:49:03 UTC.
- `satellite.js` 7.1.0: ESM only, `exports` has only `"."`, types included; `propagate()` returns `PositionAndVelocity | null`. Its WASM runtimes load only through `createSingleThreadRuntime`/`createMultiThreadRuntime` dynamic imports of the package-internal `#wasm-single-thread`/`#wasm-multi-thread` (SINGLE_FILE Emscripten builds that contain `import("node:module")` behind a runtime Node check). The site never calls them.
- `astronomy-engine`'s `Rotation_EQD_EQJ` agrees with an IAU 1976 precession matrix within 0.002° in 2026 (the precession itself is ~0.35°).
- Milky Way fill cost in headless Firefox (1280x900, all five levels, even-odd): 0.46 ms median per frame including a 1-px readback flush.
- `sky-orientation`-style geometry at 1600x1000: Andromeda and Sagittarius A* are never both 60 px inside the canvas at once, so the checks pin a separate instant for each (M31 at `2026-10-01T00:00Z` lands at (567, 382); Sgr A* at `2026-10-01T17:00Z` at (1423, 939); the Perseid radiant at `2026-08-12T00:00Z` at (140, 384), and 40 sidereal days later, `2026-09-20T21:22:43.620Z`, the chart's LST differs by 0.0002°).
- Current suite: 23 checks, all passing; headless median frame draw 2.96 ms (`sky-animates-1280`).
- A scratch `next build` of this plan's code could not be completed in the planning sandbox (Turbopack hung before compiling anything, for a bare app too), so the build-time behaviour of `satellite.js` under Turbopack is unmeasured; Task 6 Step 10 carries the exact fallback. Everything else in this plan's code was typechecked (`tsc --noEmit` clean) and its node tests run green in a scratch copy of the worktree.

## Spec ambiguities resolved at plan time

1. **Polaris and the sheet.** §2's pole `(0.16·W, 0.18·H)` lands 10-65 px inside the 1000 px sheet at 1280-1440 px widths, so §1's "stops hiding behind the page" holds only from ~1480 px and in stargaze. The numbers are binding and are implemented as written; Task 1 Step 11 measures and reports it for the owner.
2. **Constellation one-liners** are hand-written in `content/sky-facts.ts` (§7: the single source of one-liners), and the origin data is generated from the table (§7: not hand-typed). `scripts/test-sky-facts.mjs` reconciles the two: each one-liner must contain the table's year and originator (or "Ptolemy") and its "split from" name.
3. **The Milky Way card** needs something to click. The band gets one faint "Milky Way" label at the on-screen galactic-equator anchor nearest the pole (seven anchors at l = 45°..315°, converted by astronomy-engine at build time); that label is the selectable.
4. **Card titles** for objects come from `objects.json` `name`; for the Moon, ISS and Milky Way from `copy.stargaze.card`; planets from the `PLANETS` enum; constellations "Latin (English)" from `sky.json`. `SkyFact` has no title field, as in §7.
5. **Live numbers stay out of the prose.** Shower windows/peaks/ZHR/parents, Voyager distances and ISS altitude/speed/epoch are rendered as data lines from the data files (each still cited in the fact's sources), so the dated or live values can never drift from a sentence.
6. **Voice gate and citations.** §7 says sky-facts is scanned "with the same rules as copy.ts". Citation fields (author, year, title, site, url, accessed) are the sources' own words and are not scanned; a verbatim quote in a body that would trip the gate is paraphrased instead.
7. **The IMO calendar** is offline at imo.net; the source is the Wayback copy, pinned by SHA-256. It names only five of the twelve parent bodies, so the others cite NASA Science's shower pages and, for the Ursids, a pinned Wikipedia revision (recorded per shower in `parentSource`).
8. **Voyager 2** (dec −59.8°) is south of the −35° chart edge and never draws; it keeps its data, fact and card so the set in §1 stays complete.
9. **Frame of the ISS.** satellite.js works in TEME (of date); §8 does not say which frame, the night-sky spec says everything is J2000, so the ISS is precessed (`precessToJ2000`, pinned against astronomy-engine).
10. **Stale TLEs.** Not in §8. At 180x the simulated clock passes a week in ~56 real minutes; SGP4 on a week-old set is not where the station is. `at()` returns null more than 7 days from the TLE epoch, so the ISS leaves the chart rather than being drawn wrong (Constitution: honest or absent).
11. **"Symbol paths precomputed once per catalog"** (§10) is applied where it costs something: the Milky Way's per-vertex trig and the Kepler outline. The ~30 point symbols are one to six canvas primitives each and are drawn directly; the frame-time gate in `sky-animates-1280` is the arbiter.
12. **Hover labels grew a line** (§5), which no longer fits a 140-220 px margin on one line, so the one-liner word-wraps to the margin when the label has to avoid the sheet; the existing `sky-hover` assertion (label on screen and clear of the sheet) covers it.
13. **Normal-mode clicks** do nothing beyond ending a drag; cards open only in stargaze (§6). Below 880 px a tap in stargaze opens the card, which is how names "appear on tap" (§4).

---

### Task 1: The pole moves top left; drag to pan

**Files:**
- Modify: `lib/sky-math.ts`, `components/manuscript/NightSky.tsx`, `app/globals.css`, `scripts/test-sky-math.mjs`, `scripts/verify-redesign.mjs`
- Create: `lib/sky-pan.ts`, `scripts/test-sky-pan.mjs`

**Interfaces:**
- Produces (`lib/sky-math.ts`):
  ```ts
  export const EDGE_DEC_DEG = -35;
  export const WIDE_MIN_PX = 880;
  export type Point = { x: number; y: number };
  export function poleFor(width: number, height: number): Point;
  export function chartFor(width: number, height: number, lst: number, offset?: Point): Chart; // Chart unchanged: { cx, cy, k, lstDeg }
  ```
- Produces (`lib/sky-pan.ts`):
  ```ts
  export type Vec = { x: number; y: number };
  export const CLICK_SLOP_PX = 5;
  export const PAN_LIMIT_FRAC = 0.45;
  export const SPRING_OMEGA = 9.5;
  export const SETTLE_PX = 0.25;
  export const SETTLE_SPEED_PX_S = 2;
  export function rubberBand(raw: Vec, limit: number): Vec;
  export function springStep(p: Vec, v: Vec, dtMs: number): { p: Vec; v: Vec; settled: boolean };
  ```
- Produces (`window.__sky`, added keys): `cx`, `cy` (the chart's pole, offset included), `offset: {x, y}`, `dragging: boolean`.
- Produces (NightSky, internal, used by Task 5): `onSkyClick(x, y)` is called on a pointerup that travelled less than `CLICK_SLOP_PX`; `PAN_BLOCKERS` already lists `[data-sky-card]`.
- Produces (`scripts/verify-redesign.mjs`): `specPole(width, height)`, the new `specProject(width, height, lstDeg, raDeg, decDeg)`, `dragBy(page, x, y, dx, dy, steps)`, `skyOffset(page)`, `leftMarginPoint(page)`.

- [ ] **Step 1: Write the failing node tests**

In `scripts/test-sky-math.mjs`, replace the two tests `test("projection: pole at centre, edge declination at the half-diagonal", …)` and `test("projection: sky view facing north, turning counterclockwise", …)` (everything from `test("projection: pole at centre` to the end of the file) with:

```js
test("projection: pole toward the top left, farthest corner at the edge declination", () => {
  assert.equal(S.EDGE_DEC_DEG, -35);
  const cases = [
    // [width, height, pole x fraction, pole y fraction]
    [1600, 1000, 0.16, 0.18],
    [1440, 900, 0.16, 0.18],
    [880, 700, 0.16, 0.18],
    [879, 700, 0.22, 0.1],
    [400, 800, 0.22, 0.1],
  ];
  for (const [W, H, fx, fy] of cases) {
    const c = S.chartFor(W, H, 0);
    assert.ok(Math.abs(c.cx - fx * W) < 1e-9 && Math.abs(c.cy - fy * H) < 1e-9, `${W}x${H}: pole at (${c.cx}, ${c.cy})`);
    const pole = S.project(c, 123, 90);
    assert.ok(Math.abs(pole.x - c.cx) < 1e-9 && Math.abs(pole.y - c.cy) < 1e-9, `${W}x${H}: dec +90 is not the pole`);
    // The pole is in the top-left quadrant, so the bottom-right corner is the farthest.
    const far = Math.hypot(W - fx * W, H - fy * H);
    const edge = S.project(c, 45, S.EDGE_DEC_DEG);
    const r = Math.hypot(edge.x - c.cx, edge.y - c.cy);
    assert.ok(Math.abs(r - far) < 1e-6, `${W}x${H}: edge radius ${r} vs farthest corner ${far}`);
  }
  // Recorded for CLAUDE.md: the scale at 1440x900.
  assert.ok(Math.abs(S.chartFor(1440, 900, 0).k - 737.6) < 0.1, `k at 1440x900 is ${S.chartFor(1440, 900, 0).k}`);
});

test("projection: an offset slides the whole chart and keeps its scale", () => {
  const still = S.chartFor(1440, 900, 77);
  const moved = S.chartFor(1440, 900, 77, { x: 120, y: -45 });
  assert.equal(moved.k, still.k);
  for (const [ra, dec] of [[0, 90], [279.23, 38.78], [266.42, -29.01]]) {
    const a = S.project(still, ra, dec);
    const b = S.project(moved, ra, dec);
    assert.ok(Math.abs(b.x - a.x - 120) < 1e-9 && Math.abs(b.y - a.y + 45) < 1e-9, `(${ra}, ${dec}) did not slide by the offset`);
  }
});

test("projection: sky view facing north, turning counterclockwise", () => {
  const lst = 200;
  const c = S.chartFor(1000, 1000, lst);
  const meridian = S.project(c, lst, 40);
  assert.ok(Math.abs(meridian.x - c.cx) < 1e-9 && meridian.y < c.cy, "RA = LST must sit straight up from the pole");
  const east = S.project(c, lst + 90, 40);
  assert.ok(east.x > c.cx && Math.abs(east.y - c.cy) < 1e-9, "east of the meridian must be to the right");
  // Six sidereal hours later that star has crossed the meridian: straight up.
  const c2 = S.chartFor(1000, 1000, lst + 90);
  const later = S.project(c2, lst + 90, 40);
  assert.ok(Math.abs(later.x - c2.cx) < 1e-6 && later.y < c2.cy, "the sky must turn counterclockwise");
});
```

Create `scripts/test-sky-pan.mjs`:

```js
// node --test scripts/test-sky-pan.mjs
// Pins lib/sky-pan.ts: the rubber band stays bounded, and the return spring
// is frame-rate independent, never overshoots, and settles to exactly zero
// well inside the 1.5 s the sky-drag browser check allows.
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../lib/sky-pan.ts";

test("constants match the spec", () => {
  assert.equal(P.CLICK_SLOP_PX, 5);
  assert.equal(P.PAN_LIMIT_FRAC, 0.45);
});

test("rubber band: identity inside the limit, bounded and monotonic past it", () => {
  const limit = 405; // 0.45 x 900
  assert.deepEqual(P.rubberBand({ x: 150, y: 80 }, limit), { x: 150, y: 80 });
  assert.deepEqual(P.rubberBand({ x: 0, y: 0 }, limit), { x: 0, y: 0 });
  let prev = limit;
  for (let raw = limit + 1; raw < limit * 40; raw += 7) {
    const out = P.rubberBand({ x: raw * 0.6, y: raw * 0.8 }, limit);
    const len = Math.hypot(out.x, out.y);
    assert.ok(len > prev - 1e-9, `not monotonic at ${raw}`);
    assert.ok(len < 1.5 * limit, `unbounded at ${raw}: ${len}`);
    assert.ok(Math.abs(out.x / out.y - 0.75) < 1e-9, "direction changed");
    prev = len;
  }
  // Continuous at the limit, and slower than the pointer just past it.
  const just = P.rubberBand({ x: limit + 10, y: 0 }, limit).x;
  assert.ok(just > limit && just < limit + 10, `just past the limit: ${just}`);
});

/** Run the spring from `p0` at a fixed frame length until it settles. */
function settle(p0, frameMs, maxMs = 5000) {
  let p = p0;
  let v = { x: 0, y: 0 };
  let t = 0;
  let minX = Infinity;
  while (t < maxMs) {
    const r = P.springStep(p, v, frameMs);
    t += frameMs;
    p = r.p;
    v = r.v;
    minX = Math.min(minX, p.x);
    if (r.settled) return { t, minX, p };
  }
  return { t: Infinity, minX, p };
}

test("spring: frame-rate independent", () => {
  const run = (frameMs, frames) => {
    let p = { x: 170, y: -60 };
    let v = { x: 0, y: 0 };
    for (let i = 0; i < frames; i++) ({ p, v } = P.springStep(p, v, frameMs));
    return p;
  };
  const a = run(700 / 42, 42);
  const b = run(100, 7);
  const c = run(700, 1);
  assert.ok(Math.abs(a.x - c.x) < 1e-9 && Math.abs(b.x - c.x) < 1e-9, `${a.x} ${b.x} ${c.x}`);
  assert.ok(Math.abs(a.y - c.y) < 1e-9 && Math.abs(b.y - c.y) < 1e-9, `${a.y} ${b.y} ${c.y}`);
  // ~700 ms: under 1.1% of the drag is left.
  assert.ok(Math.hypot(c.x, c.y) < 0.011 * Math.hypot(170, 60), `at 700 ms: ${Math.hypot(c.x, c.y)}`);
});

test("spring: no overshoot, exact zero, inside 1.1 s from the drag limit", () => {
  for (const frameMs of [1000 / 60, 50, 100]) {
    const { t, minX, p } = settle({ x: 405, y: 0 }, frameMs);
    assert.ok(t <= 1100, `settled after ${t} ms at ${frameMs.toFixed(1)} ms frames`);
    assert.ok(minX >= 0, `overshot to ${minX}`);
    assert.deepEqual(p, { x: 0, y: 0 });
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test scripts/test-sky-math.mjs scripts/test-sky-pan.mjs`
Expected: `test-sky-math` fails `pole toward the top left` (`EDGE_DEC_DEG` is −30) and `an offset slides` (the offset is ignored); `test-sky-pan` fails with `Cannot find module '…/lib/sky-pan.ts'`.

- [ ] **Step 3: Move the pole in `lib/sky-math.ts`**

Replace

```ts
/** The declination that lands on the viewport's half-diagonal. */
export const EDGE_DEC_DEG = -30;
```

with

```ts
/** The declination that lands on the viewport corner farthest from the pole
 *  (spec 2026-09-15 §2; keeps Sagittarius and the galactic core, dec −29°, on
 *  screen when the sky turns them into view). */
export const EDGE_DEC_DEG = -35;
/** The site's one breakpoint (CLAUDE.md): the pole's screen position switches here. */
export const WIDE_MIN_PX = 880;
```

Replace

```ts
export type Chart = { cx: number; cy: number; k: number; lstDeg: number };
```

with

```ts
export type Chart = { cx: number; cy: number; k: number; lstDeg: number };
export type Point = { x: number; y: number };
```

Replace the whole `chartFor` function and its comment

```ts
/** Polar stereographic chart, pole at the viewport centre. */
export function chartFor(width: number, height: number, lst: number): Chart {
  const halfDiagonal = Math.hypot(width, height) / 2;
  const k = halfDiagonal / Math.tan(((90 - EDGE_DEC_DEG) / 2) * D2R);
  return { cx: width / 2, cy: height / 2, k, lstDeg: lst };
}
```

with

```ts
/** Where the north celestial pole sits on screen before any drag (spec 2026-09-15 §2). */
export function poleFor(width: number, height: number): Point {
  return width >= WIDE_MIN_PX
    ? { x: 0.16 * width, y: 0.18 * height }
    : { x: 0.22 * width, y: 0.1 * height };
}

/**
 * Polar stereographic chart, pole toward the top left. `k` puts EDGE_DEC_DEG
 * on the viewport corner farthest from the pole. `offset` is the drag pan
 * (lib/sky-pan.ts): it slides the whole chart and never changes the scale.
 */
export function chartFor(width: number, height: number, lst: number, offset: Point = { x: 0, y: 0 }): Chart {
  const pole = poleFor(width, height);
  const far = Math.max(
    Math.hypot(pole.x, pole.y),
    Math.hypot(width - pole.x, pole.y),
    Math.hypot(pole.x, height - pole.y),
    Math.hypot(width - pole.x, height - pole.y),
  );
  const k = far / Math.tan(((90 - EDGE_DEC_DEG) / 2) * D2R);
  return { cx: pole.x + offset.x, cy: pole.y + offset.y, k, lstDeg: lst };
}
```

- [ ] **Step 4: Create `lib/sky-pan.ts`**

```ts
/**
 * Drag-to-pan physics for the night sky (spec 2026-09-15 §3): the rubber band
 * past the drag limit and the spring that brings the chart home on release.
 *
 * ⚠️ NO IMPORTS, same rule as lib/sky-math.ts: scripts/test-sky-pan.mjs
 * imports this file straight into node. Keep the TypeScript erasable.
 *
 * The spring is the exact closed-form solution of a critically damped
 * oscillator, advanced by the real elapsed time. That is the Constitution's
 * dt rule taken to its limit: a 16 ms frame, a 100 ms frame and a stalled tab
 * all land on the same curve, and it can never overshoot or blow up.
 */

export type Vec = { x: number; y: number };

/** A pointer that travels less than this between down and up is a click. */
export const CLICK_SLOP_PX = 5;
/** Drag freely up to this fraction of min(width, height); past it, rubber band. */
export const PAN_LIMIT_FRAC = 0.45;
/** Spring rate (1/s). From rest, 1% of the drag is left after 700 ms. */
export const SPRING_OMEGA = 9.5;
/** Under both, the spring is done and the offset snaps to exactly (0, 0). */
export const SETTLE_PX = 0.25;
export const SETTLE_SPEED_PX_S = 2;

/**
 * Radial rubber band. Identity inside `limit`; past it the extra drag moves
 * the chart at 55% at first, less and less after, and never past 1.5·limit.
 */
export function rubberBand(raw: Vec, limit: number): Vec {
  const len = Math.hypot(raw.x, raw.y);
  if (len <= limit) return { x: raw.x, y: raw.y };
  const excess = len - limit;
  const give = limit * 0.5 * (1 - 1 / (1 + (1.1 * excess) / limit));
  const s = (limit + give) / len;
  return { x: raw.x * s, y: raw.y * s };
}

/**
 * Advance the return spring by `dtMs` of real time. `p` is the offset (px),
 * `v` its velocity (px/s). Returns `settled: true` (and exact zeros) once the
 * chart is home.
 */
export function springStep(p: Vec, v: Vec, dtMs: number): { p: Vec; v: Vec; settled: boolean } {
  const dt = Math.max(0, dtMs) / 1000;
  const e = Math.exp(-SPRING_OMEGA * dt);
  const axis = (x: number, u: number): [number, number] => {
    const b = u + SPRING_OMEGA * x;
    return [(x + b * dt) * e, (u - SPRING_OMEGA * b * dt) * e];
  };
  const [px, vx] = axis(p.x, v.x);
  const [py, vy] = axis(p.y, v.y);
  if (Math.hypot(px, py) < SETTLE_PX && Math.hypot(vx, vy) < SETTLE_SPEED_PX_S) {
    return { p: { x: 0, y: 0 }, v: { x: 0, y: 0 }, settled: true };
  }
  return { p: { x: px, y: py }, v: { x: vx, y: vy }, settled: false };
}
```

- [ ] **Step 5: Run the node tests to verify they pass**

Run: `node --test scripts/test-sky-math.mjs scripts/test-sky-pan.mjs`
Expected: `test-sky-math` 16 pass (15 existing minus 2 replaced, plus 3); `test-sky-pan` 4 pass.

- [ ] **Step 6: Write the failing browser checks**

In `scripts/verify-redesign.mjs`:

1. Replace

```js
/** The spec's projection (§2), written out independently of lib/sky-math.ts. */
function specProject(width, height, lstDeg, raDeg, decDeg) {
  const D2R = Math.PI / 180;
  const k = Math.hypot(width, height) / 2 / Math.tan(60 * D2R); // dec -30 at the half-diagonal
  const rho = k * Math.tan(((90 - decDeg) / 2) * D2R);
  const phi = (raDeg - lstDeg) * D2R;
  return { x: width / 2 + rho * Math.sin(phi), y: height / 2 - rho * Math.cos(phi) };
}
```

with

```js
/** The projection from spec 2026-09-15 §2, written out independently of
 *  lib/sky-math.ts: the pole at (0.16W, 0.18H) from 880px up, (0.22W, 0.10H)
 *  below; k puts dec -35° on the corner farthest from the pole. */
function specPole(width, height) {
  return width >= 880 ? { x: 0.16 * width, y: 0.18 * height } : { x: 0.22 * width, y: 0.1 * height };
}
function specProject(width, height, lstDeg, raDeg, decDeg) {
  const D2R = Math.PI / 180;
  const pole = specPole(width, height);
  const far = Math.max(
    Math.hypot(pole.x, pole.y),
    Math.hypot(width - pole.x, pole.y),
    Math.hypot(pole.x, height - pole.y),
    Math.hypot(width - pole.x, height - pole.y),
  );
  const k = far / Math.tan(62.5 * D2R); // (90° - (-35°)) / 2
  const rho = k * Math.tan(((90 - decDeg) / 2) * D2R);
  const phi = (raDeg - lstDeg) * D2R;
  return { x: pole.x + rho * Math.sin(phi), y: pole.y - rho * Math.cos(phi) };
}
```

2. In `checkSkyOrientation`, replace

```js
      if (dl > 0.05) throw new Error(`site LST ${siteLst.toFixed(3)}° vs astronomy-engine ${lst.toFixed(3)}°`);
```

with

```js
      if (dl > 0.05) throw new Error(`site LST ${siteLst.toFixed(3)}° vs astronomy-engine ${lst.toFixed(3)}°`);
      const pole = specPole(W, H);
      const site = await page.evaluate(() => ({ cx: window.__sky.cx, cy: window.__sky.cy, offset: window.__sky.offset }));
      if (Math.abs(site.cx - pole.x) > 0.01 || Math.abs(site.cy - pole.y) > 0.01 || site.offset.x !== 0 || site.offset.y !== 0) {
        throw new Error(`pole at (${site.cx}, ${site.cy}) offset ${JSON.stringify(site.offset)}, expected (${pole.x}, ${pole.y}) at rest`);
      }
```

and its return line

```js
      return `${when.toISOString()}: LST off by ${dl.toFixed(4)}°, Vega peak ${vegaPeak.toFixed(0)}, Moon peak ${moonPeak.toFixed(0)}`;
```

with

```js
      return `${when.toISOString()}: LST off by ${dl.toFixed(4)}°, pole at (${pole.x}, ${pole.y}), Vega peak ${vegaPeak.toFixed(0)}, Moon peak ${moonPeak.toFixed(0)}`;
```

(The Vega and Moon pixel assertions now run against the moved projection: that is the pixel proof of the move.)

3. In `checkSkyHover`, replace the comment line `      // screen, and clear of the sheet (fix round 1, finding I1 — near-pole` and the line after it, `      // anchors like UMa's project near canvas centre, under the page).`, with:

```js
      // screen, and clear of the sheet (fix round 1, finding I1). Since the
      // pole moved top left (2026-09-15) near-pole anchors sit near the
      // sheet's top-left corner, and on 1280-1440px viewports that corner is
      // still under the page, so the avoidance still matters.
```

4. Immediately before the banner `/* 2. No horizontal scroll at 400px */` (keep its dashed rule line above it; insert above that rule), add:

```js
/** Press at (x, y), move by (dx, dy) in `steps` real mouse moves, and hold (no release). */
async function dragBy(page, x, y, dx, dy, steps = 12) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
}

const skyOffset = (page) => page.evaluate(() => window.__sky.offset);

/**
 * A desk point in the left margin at mid-height with nothing clickable under
 * it: the sheet is 1000px wide and centred, so at 1440 the margin is 220px.
 */
async function leftMarginPoint(page) {
  const p = await page.evaluate(() => {
    const sheet = document.querySelector("[data-sheet]").getBoundingClientRect();
    const x = Math.round(sheet.left / 2);
    const y = Math.round(window.innerHeight / 2);
    const el = document.elementFromPoint(x, y);
    return { x, y, blocked: !!el?.closest("a, button, input, [data-sheet]"), sheetLeft: sheet.left };
  });
  if (p.sheetLeft < 100) throw new Error(`desk margin only ${p.sheetLeft}px wide`);
  if (p.blocked) throw new Error(`(${p.x}, ${p.y}) is over a control or the sheet`);
  return p;
}

async function checkSkyDrag(browser) {
  const notes = [];
  // Animated sky: drag in the margin, measure the spring home.
  await withPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    const { x, y } = await leftMarginPoint(page);

    await dragBy(page, x, y, 150, 80);
    await page.waitForFunction(() => window.__sky.dragging === true, null, { timeout: 2000 });
    const held = await skyOffset(page);
    if (Math.abs(held.x - 150) > 2 || Math.abs(held.y - 80) > 2) {
      throw new Error(`dragged (150, 80) but the offset is ${JSON.stringify(held)}`);
    }
    const hl = await page.evaluate(() => window.__sky.highlight);
    if (hl !== null) throw new Error(`hover highlight "${hl}" stayed on during a drag`);
    const t0 = Date.now();
    await page.mouse.up();
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, {
      timeout: 1500,
      polling: "raf",
    });
    notes.push(`(150, 80) held, home in ${Date.now() - t0}ms`);

    // Rubber band: 900px of drag must move the chart past the limit but less than 1.5x it.
    const limit = 0.45 * 900;
    await dragBy(page, x, y, 900, 0, 20);
    const far = await skyOffset(page);
    await page.mouse.up();
    if (!(far.x > limit && far.x < 1.5 * limit)) throw new Error(`900px drag gave offset ${far.x}, limit ${limit}`);
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 2500 });
    notes.push(`900px drag banded to ${far.x.toFixed(0)}px`);

    // Starting on the sheet never pans (and the page text is not a drag handle).
    const sheetPoint = await page.evaluate(() => {
      const r = document.querySelector("[data-sheet]").getBoundingClientRect();
      return { x: Math.round(r.left + 60), y: Math.round(Math.max(r.top, 0) + 200) };
    });
    await dragBy(page, sheetPoint.x, sheetPoint.y, -150, 40);
    const onSheet = await page.evaluate(() => ({ offset: window.__sky.offset, dragging: window.__sky.dragging }));
    await page.mouse.up();
    if (onSheet.dragging || onSheet.offset.x !== 0 || onSheet.offset.y !== 0) {
      throw new Error(`a drag that started on the sheet panned the sky: ${JSON.stringify(onSheet)}`);
    }
    notes.push("sheet drag ignored");
  });

  // Reduced motion: the drag still works, the release snaps home.
  await withPage(
    browser,
    { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" },
    async (page) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const { x, y } = await leftMarginPoint(page);
      await dragBy(page, x, y, 100, 0);
      await page.waitForFunction(() => Math.abs(window.__sky.offset.x - 100) < 2, null, { timeout: 2000 });
      await page.mouse.up();
      // One paint, no spring: home at once.
      await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 100 });
      notes.push("reduced motion: dragged, snapped home");
    },
  );
  return notes.join("; ");
}

```

5. In `CHECKS`, after `["sky-hover", checkSkyHover],` add `["sky-drag", checkSkyDrag],`.

- [ ] **Step 7: Run them to verify they fail**

Run: `npx tsc --noEmit` (passes: `chartFor`'s new parameter is optional). Build and restart the :3000 server:

```bash
npm run build
kill $(ss -ltnp | grep ':3000 ' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
(npx next start -p 3000 > /tmp/next-3000.log 2>&1 &)
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
node scripts/verify-redesign.mjs sky-orientation sky-drag
```

Expected: `sky-orientation` FAIL (pole at `(800, 500)`, the viewport centre, or `window.__sky.cx` undefined); `sky-drag` FAIL (`window.__sky.dragging` never becomes true).

- [ ] **Step 8: Drag in `components/manuscript/NightSky.tsx`**

Apply these replacements in order (each old block occurs exactly once).

8a. Replace

```ts
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";
```

with

```ts
import { CLICK_SLOP_PX, PAN_LIMIT_FRAC, rubberBand, springStep, type Vec } from "@/lib/sky-pan";
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";
```

8b. In the header comment, replace

```ts
 * - Phones get it too (owner call, 2026-09-14) with a mag 4.5 cut.
```

with

```ts
 * - Phones get it too (owner call, 2026-09-14) with a mag 4.5 cut.
 * - Drag to pan (spec 2026-09-15 §3): mouse or pen on the desk in normal
 *   mode, any pointer anywhere while stargazing; a critically damped spring
 *   (lib/sky-pan.ts) brings the chart home on release, and the frame gate is
 *   lifted while a drag or the spring is live so the motion stays smooth.
 *   Reduced motion snaps home instead. The sky keeps turning throughout.
```

8c. Replace

```ts
const HOVER_PX = 24;
```

with

```ts
const HOVER_PX = 24;
/** Never start a pan on these: the page's own controls, and (Task 5) the card. */
const PAN_BLOCKERS = "a, button, input, select, textarea, label, summary, [role='button'], [data-sky-card]";
```

8d. In `type SkySnapshot`, replace

```ts
  k: number;
  frameMsMedian: number | null;
```

with

```ts
  k: number;
  cx: number;
  cy: number;
  offset: Vec;
  dragging: boolean;
  frameMsMedian: number | null;
```

8e. Replace

```ts
    let highlight: Highlight | null = null;
    const frameTimes: number[] = [];
```

with

```ts
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
```

8f. Replace `      const chart = chartFor(width, height, lst);` with `      const chart = chartFor(width, height, lst, offset);`.

8g. In the `win.__sky = { … }` literal, replace

```ts
        k: chart.k,
        frameMsMedian
```

with

```ts
        k: chart.k,
        cx: chart.cx,
        cy: chart.cy,
        offset: { ...offset },
        dragging: drag !== null,
        frameMsMedian
```

8h. Replace the whole `step` function

```ts
    const step = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(step);
      if (document.hidden) return;
      if (t - last < (narrowQ.matches ? FRAME_MS_NARROW : FRAME_MS_WIDE)) return;
      last = t;
      paint();
    };
```

with

```ts
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
```

8i. Replace the pointer handlers, from `    const setHighlight = (next: Highlight | null) => {` through `    const onPointerLeave = () => setHighlight(null);`, i.e. this block:

```ts
    const setHighlight = (next: Highlight | null) => {
      if (next === null && highlight === null) return;
      highlight = next;
      // A running loop repaints within one frame gate; a still sky (reduced
      // motion) repaints only on change.
      if (!running) paint();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      setHighlight(pick(e.clientX, e.clientY));
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !isStargazing()) return;
      setHighlight(pick(e.clientX, e.clientY));
    };
    const onPointerLeave = () => setHighlight(null);
```

with

```ts
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
```

8j. Replace

```ts
    window.addEventListener("pointerdown", onPointerDown);
    document.documentElement
```

with

```ts
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    document.documentElement
```

8k. In the cleanup, replace

```ts
      window.removeEventListener("pointerdown", onPointerDown);
```

with

```ts
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      cancelAnimationFrame(pendingPaint);
      document.documentElement.style.cursor = "";
```

- [ ] **Step 9: Stargaze touch drags in `app/globals.css`**

Replace

```css
body[data-stargaze] [data-sky-credit] { position: fixed; inset-inline: 0; bottom: 0; }
```

with

```css
body[data-stargaze] [data-sky-credit] { position: fixed; inset-inline: 0; bottom: 0; }
/* Stargaze: a touch drag pans the sky (NightSky, spec 2026-09-15 §3), so the
   browser must not claim it for scrolling or pinch-zoom first. */
html:has(body[data-stargaze]), body[data-stargaze] { touch-action: none; }
```

- [ ] **Step 10: Typecheck, build, run the sky and stargaze checks**

Run: `npx tsc --noEmit && node --test scripts/test-sky-math.mjs scripts/test-sky-pan.mjs`
Rebuild and restart :3000 exactly as in Step 7, then:
Run: `node scripts/verify-redesign.mjs sky stargaze`
Expected: all 6 `sky-*` checks and all 6 `stargaze-*` checks PASS. `sky-drag` reports the spring's home time (expect well under 1,500 ms).

- [ ] **Step 11: Look at it**

Take full-viewport screenshots of `/` at 1280x800, 1440x900, 1920x1080 and 400x800 (a Playwright one-off in the scratchpad, not a committed file) and look at them. Confirm Polaris sits about 5 px from the pole at the top left, Sagittarius comes into view at the lower right when it is up, and the chart reaches the bottom-right corner. Record in the task report where Polaris lands relative to the sheet at each width: at 1280 and 1440 the pole (`0.16·W`) falls 10-65 px inside the sheet's left edge (the sheet is 1000 px wide and centred), so it is visible beside the page only from about 1480 px wide and in stargaze mode. The spec's numbers are binding; flag this to the owner rather than changing them.

- [ ] **Step 12: Commit**

```bash
git add lib/sky-math.ts lib/sky-pan.ts components/manuscript/NightSky.tsx app/globals.css scripts/test-sky-math.mjs scripts/test-sky-pan.mjs scripts/verify-redesign.mjs
git commit -m "sky: pole to the top left, drag to pan with a spring home

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Objects and Milky Way data pipeline

**Files:**
- Create: `scripts/prepare-sky-objects.mjs`
- Create (generated, committed): `public/sky/objects.json`, `public/sky/milkyway.json`
- Test: `scripts/test-sky-objects.mjs`

**Interfaces:**
- Consumes: `public/sky/sky.json` (the 88 abbreviations, the drawn stars).
- Produces `public/sky/objects.json`, exactly:
  ```ts
  {
    version: 1,
    epoch: "J2000",
    generated: "YYYY-MM-DD",            // the day the script ran; also the Voyagers' positionDate
    source: {
      d3celestial: { repo, commit: "7e720a3de062059d4c5400a379146a601d9010e0", license: "BSD-3-Clause", copyright },
      horizons: { url: "https://ssd.jpl.nasa.gov/horizons/", queried, quantities },
      imo: { title, editor: "Jürgen Rendtel", url, sha256 },
      constellations: { url, revision: 1373165890, sha256 },
    },
    objects: Array<{
      id: string;              // m1 m8 m13 m31 m42 m44 m45 m51 m57 m87 sgr-a-star kepler-field hubble-deep-field
                               // voyager-1 voyager-2 polaris sirius arcturus vega capella rigel procyon betelgeuse
                               // altair aldebaran antares spica pollux deneb regulus (this order)
      name: string;            // canvas label and card title
      designation?: string;    // "M31 · NGC 224", "Sagittarius A*", "HDF", "α UMi · HIP 11767"
      symbol: "galaxy" | "nebula" | "cluster" | "core" | "field" | "square" | "chevron" | "star";
      raDeg: number;           // [0, 360), J2000
      decDeg: number;
      mag?: number;            // Messier picks and stars
      axisRatio?: number;      // galaxies only, [0.35, 1]
      radiusDeg?: number;      // kepler-field only: 6.05
      distanceAu?: number;     // voyagers only
      positionDate?: string;   // voyagers only
      hip?: number;            // stars only
    }>,
    showers: Array<{
      id: string; name: string; imo: string; start: "MM-DD"; end: "MM-DD"; peak: "MM-DD";
      solarLongitudeDeg: number; radiantRaDeg: number; radiantDecDeg: number; speedKmS: number;
      zhr: number; parent: string; parentSource: string;
    }>,                         // quadrantids lyrids eta-aquariids southern-delta-aquariids perseids draconids
                                // southern-taurids orionids northern-taurids leonids geminids ursids (this order)
    constellations: Record<Abbr, { ancient: boolean; year: number | null; by: string[]; splitFrom: string | null }>
  }
  ```
- Produces `public/sky/milkyway.json`: `{ version: 1, epoch: "J2000", source: { repo, commit, file: "data/mw.json", license, copyright }, toleranceDeg: 0.2, levels: [ring[]] (5 levels, ol1 outermost first; ring = [raDeg, decDeg][] at 0.1°), labels: [raDeg, decDeg][] (7 anchors on the galactic equator at l = 45..315°) }`.

- [ ] **Step 1: Write the failing data test**

Create `scripts/test-sky-objects.mjs`:

```js
// node --test scripts/test-sky-objects.mjs
// Shape and landmark checks on the COMMITTED public/sky/objects.json and
// public/sky/milkyway.json. prepare-sky-objects.mjs asserts the same things
// before writing; this guards the committed files against hand edits and
// bad regenerations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const OBJECTS = new URL("../public/sky/objects.json", import.meta.url);
const MILKYWAY = new URL("../public/sky/milkyway.json", import.meta.url);
const SKY = new URL("../public/sky/sky.json", import.meta.url);

const data = JSON.parse(await readFile(OBJECTS, "utf8"));
const mw = JSON.parse(await readFile(MILKYWAY, "utf8"));
const sky = JSON.parse(await readFile(SKY, "utf8"));
const byId = new Map(data.objects.map((o) => [o.id, o]));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const EXPECTED_IDS = [
  "m1", "m8", "m13", "m31", "m42", "m44", "m45", "m51", "m57", "m87",
  "sgr-a-star", "kepler-field", "hubble-deep-field", "voyager-1", "voyager-2",
  "polaris", "sirius", "arcturus", "vega", "capella", "rigel", "procyon", "betelgeuse",
  "altair", "aldebaran", "antares", "spica", "pollux", "deneb", "regulus",
];
const SYMBOLS = new Set(["galaxy", "nebula", "cluster", "core", "field", "square", "chevron", "star"]);

test("header", () => {
  assert.equal(data.version, 1);
  assert.equal(data.epoch, "J2000");
  assert.match(data.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.source.d3celestial.commit, "7e720a3de062059d4c5400a379146a601d9010e0");
  assert.match(data.source.d3celestial.copyright, /Olaf Frohn/);
  assert.equal(data.source.constellations.revision, 1373165890);
  assert.match(data.source.imo.url, /^https:\/\/web\.archive\.org\/web\/20260905025331id_\//);
});

test("objects: the exact set, valid shapes", () => {
  assert.deepEqual(data.objects.map((o) => o.id), EXPECTED_IDS);
  for (const o of data.objects) {
    assert.ok(o.name.length > 0, o.id);
    assert.ok(SYMBOLS.has(o.symbol), `${o.id} symbol ${o.symbol}`);
    assert.ok(o.raDeg >= 0 && o.raDeg < 360, `${o.id} ra ${o.raDeg}`);
    assert.ok(o.decDeg >= -90 && o.decDeg <= 90, `${o.id} dec ${o.decDeg}`);
    if (o.symbol === "galaxy") assert.ok(o.axisRatio >= 0.35 && o.axisRatio <= 1, `${o.id} axisRatio`);
  }
});

test("landmarks", () => {
  const m31 = byId.get("m31");
  assert.ok(near(m31.raDeg, 10.6751, 0.001) && near(m31.decDeg, 41.2667, 0.001), "M31");
  assert.equal(m31.symbol, "galaxy");
  const core = byId.get("sgr-a-star");
  assert.equal(core.name, "Galactic core");
  assert.ok(near(core.raDeg, 266.41683, 1e-4) && near(core.decDeg, -29.00781, 1e-4), "Sgr A*");
  const kepler = byId.get("kepler-field");
  assert.ok(near(kepler.raDeg, 290.66667, 1e-4) && kepler.decDeg === 44.5 && near(kepler.radiusDeg, 6.05, 0.01), "Kepler field");
  assert.match(kepler.name, /approximate outline/);
  const hdf = byId.get("hubble-deep-field");
  assert.ok(near(hdf.raDeg, 189.20583, 1e-4) && near(hdf.decDeg, 62.21611, 1e-4), "HDF");
  assert.equal(byId.get("m87").symbol, "galaxy");
  assert.equal(byId.get("m45").symbol, "cluster");
  assert.equal(byId.get("m57").symbol, "nebula");
});

test("the 15 named stars resolved by HIP", () => {
  const HIP = {
    polaris: 11767, sirius: 32349, arcturus: 69673, vega: 91262, capella: 24608, rigel: 24436,
    procyon: 37279, betelgeuse: 27989, altair: 97649, aldebaran: 21421, antares: 80763,
    spica: 65474, pollux: 37826, deneb: 102098, regulus: 49669,
  };
  for (const [id, hip] of Object.entries(HIP)) {
    const s = byId.get(id);
    assert.equal(s.symbol, "star", id);
    assert.equal(s.hip, hip, id);
    assert.ok(s.mag <= 2.0, `${id} mag ${s.mag}`);
    // Every named star is also in the drawn catalog, within its 0.01° rounding.
    assert.ok(
      sky.stars.some(([ra, dec]) => near(ra, s.raDeg, 0.006) && near(dec, s.decDeg, 0.006)),
      `${id} is not in sky.json's stars`,
    );
  }
  assert.ok(near(byId.get("polaris").decDeg, 89.2641, 0.001));
  assert.ok(near(byId.get("vega").raDeg, 279.2347, 0.001));
});

test("voyagers: dated, plausible", () => {
  const v1 = byId.get("voyager-1");
  const v2 = byId.get("voyager-2");
  for (const v of [v1, v2]) {
    assert.equal(v.symbol, "chevron");
    assert.equal(v.positionDate, data.generated);
  }
  assert.ok(v1.raDeg > 255 && v1.raDeg < 262 && v1.decDeg > 10 && v1.decDeg < 14, `V1 at ${v1.raDeg}, ${v1.decDeg}`);
  assert.ok(v1.distanceAu > 165 && v1.distanceAu < 185, `V1 ${v1.distanceAu} au`);
  assert.ok(v2.raDeg > 300 && v2.raDeg < 305 && v2.decDeg > -62 && v2.decDeg < -57, `V2 at ${v2.raDeg}, ${v2.decDeg}`);
  assert.ok(v2.distanceAu > 138 && v2.distanceAu < 155, `V2 ${v2.distanceAu} au`);
});

test("showers: the twelve, valid windows", () => {
  assert.deepEqual(
    data.showers.map((s) => s.id),
    ["quadrantids", "lyrids", "eta-aquariids", "southern-delta-aquariids", "perseids", "draconids",
      "southern-taurids", "orionids", "northern-taurids", "leonids", "geminids", "ursids"],
  );
  const md = (v) => Number(v.slice(0, 2)) * 100 + Number(v.slice(3));
  for (const s of data.showers) {
    for (const k of ["start", "end", "peak"]) assert.match(s[k], /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, `${s.id}.${k}`);
    const wraps = md(s.start) > md(s.end);
    const inside = wraps ? md(s.peak) >= md(s.start) || md(s.peak) <= md(s.end) : md(s.peak) >= md(s.start) && md(s.peak) <= md(s.end);
    assert.ok(inside, `${s.id} peak outside its window`);
    assert.ok(Number.isInteger(s.zhr) && s.zhr > 0, `${s.id} zhr`);
    assert.ok(s.radiantRaDeg >= 0 && s.radiantRaDeg < 360 && s.radiantDecDeg >= -90 && s.radiantDecDeg <= 90, `${s.id} radiant`);
    assert.ok(s.parent.length > 0 && /^https:\/\//.test(s.parentSource), `${s.id} parent`);
  }
  const per = data.showers.find((s) => s.id === "perseids");
  assert.deepEqual([per.start, per.end, per.peak, per.radiantRaDeg, per.radiantDecDeg, per.zhr], ["07-17", "08-24", "08-13", 48, 58, 100]);
  const qua = data.showers.find((s) => s.id === "quadrantids");
  assert.deepEqual([qua.start, qua.end], ["12-28", "01-12"]);
});

test("constellation origins: all 88, from the table", () => {
  assert.deepEqual(Object.keys(data.constellations).sort(), Object.keys(sky.constellations).sort());
  assert.deepEqual(data.constellations.UMa, { ancient: true, year: null, by: ["Ptolemy"], splitFrom: null });
  assert.deepEqual(data.constellations.Car, { ancient: true, year: 1756, by: ["Ptolemy", "Lacaille"], splitFrom: "Argo Navis" });
  assert.deepEqual(data.constellations.Cru, { ancient: false, year: 1589, by: ["Plancius"], splitFrom: "Centaurus" });
  const hevelius = Object.entries(data.constellations).filter(([, o]) => o.by.includes("Hevelius")).map(([a]) => a).sort();
  assert.deepEqual(hevelius, ["CVn", "LMi", "Lac", "Lyn", "Sct", "Sex", "Vul"]);
  for (const [abbr, o] of Object.entries(data.constellations)) {
    assert.ok(o.by.length >= 1, `${abbr} has no originator`);
    assert.ok(o.ancient || Number.isInteger(o.year), `${abbr} has neither "ancient" nor a year`);
  }
});

test("milky way: five levels, within the vertex and byte budgets", async () => {
  assert.equal(mw.version, 1);
  assert.equal(mw.epoch, "J2000");
  assert.equal(mw.levels.length, 5);
  let vertices = 0;
  for (const rings of mw.levels) {
    assert.ok(rings.length >= 4);
    for (const ring of rings) {
      assert.ok(ring.length >= 4);
      for (const [ra, dec] of ring) {
        assert.ok(ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90, `vertex ${ra}, ${dec}`);
        vertices++;
      }
    }
  }
  assert.ok(vertices >= 1500 && vertices <= 4000, `${vertices} vertices`);
  assert.equal(mw.labels.length, 7);
  const { size } = await stat(MILKYWAY);
  assert.ok(size < 90_000, `milkyway.json is ${size} bytes`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/test-sky-objects.mjs`
Expected: FAIL, `ENOENT … public/sky/objects.json`.

- [ ] **Step 3: Re-check the IMO transcription against the source**

The `SHOWERS` table in Step 4 was transcribed from the archived PDF while planning. Before trusting it, re-read the source yourself (in your session scratchpad, not the repo):

```bash
cd "$(mktemp -d)"
curl -sSL -o cal2026.pdf "https://web.archive.org/web/20260905025331id_/https://www.imo.net/files/meteor-shower/cal2026.pdf"
sha256sum cal2026.pdf
pdftotext -layout cal2026.pdf - | grep -E "Quadrantids \(010|April Lyrids \(006|η-Aquariids \(031|S\. δ-Aquariids \(005|Perseids \(007|^ *Draconids \(009|S\. Taurids \(002|Orionids \(008|N\. Taurids \(017|Leonids \(013|Geminids \(004|Ursids \(015"
```

Expected: the hash `fde5388889ebda9fe13436d793da5e9935ae46b99edf20e0b19f7fe32ce1ed9f` and these rows (columns: activity, max date, λ⊙, radiant α δ, V∞ km/s, r, ZHR):

```text
 Quadrantids (010 QUA)      Dec 28–Jan 12   Jan 03     283 ◦. 15   230◦   +49◦   41     2.1    80
 April Lyrids (006 LYR)     Apr 14–Apr 30   Apr 22      32 ◦. 32   271◦   +34◦   49     2.1    18
 η-Aquariids (031 ETA)      Apr 19–May 28   May 06      45 ◦. 5    338◦   −01◦   66     2.4    50
 S. δ-Aquariids (005 SDA) Jul 12–Aug 23     Jul 31     128◦        340◦   −16◦   41     2.5    25
 Perseids (007 PER)         Jul 17–Aug 24   Aug 13     140 ◦. 0     48◦   +58◦   59     2.2   100
 Draconids (009 DRA)        Oct 06–Oct 10   Oct 09     195 ◦. 4    262◦   +54◦   20     2.6     5
 Orionids (008 ORI)         Oct 02–Nov 07   Oct 21     208◦         95◦   +16◦   66     2.5    20
 S. Taurids (002 STA)       Sep 20–Nov 20   Nov 05     223◦         52◦   +15◦   27     2.3     7
 N. Taurids (017 NTA)       Oct 20–Dec 10   Nov 12     230◦         58◦   +22◦   29     2.3     5
 Leonids (013 LEO)          Nov 06–Nov 30   Nov 17     235 ◦. 27   152◦   +22◦   71     2.5    15
 Geminids (004 GEM)         Dec 04–Dec 20   Dec 14     262 ◦. 2    112◦   +33◦   35     2.6   150
 Ursids (015 URS)           Dec 17–Dec 26   Dec 22     270 ◦. 7    217◦   +76◦   33     2.8    10
```

("283 ◦. 15" is pdftotext's rendering of 283.15°.) Compare every number with the `SHOWERS` rows in Step 4, field by field. If the Wayback copy is unreachable (HTTP 429 or 5xx), wait a minute and retry; do not substitute another year's calendar. Then confirm the five parent bodies the calendar names: `pdftotext -layout cal2026.pdf - | grep -nE "Thatcher|109P|21P/Giacobini|2P/Encke|55P/Tempel"` must print lines for all five. For the others, open https://science.nasa.gov/solar-system/meteors-meteorites/quadrantids/, …/eta-aquarids/, …/delta-aquariids/, …/orionids/, …/geminids/ and read each "Fast Facts" origin, and https://en.wikipedia.org/w/index.php?title=Ursids&oldid=1328535157 for 8P/Tuttle.

- [ ] **Step 4: Write the generator**

Create `scripts/prepare-sky-objects.mjs`:

```js
#!/usr/bin/env node
/**
 * prepare-sky-objects.mjs: builds the two data files behind the night sky's
 * objects layer (spec docs/superpowers/specs/2026-09-15-sky-objects-design.md
 * §4, §9):
 *
 *   public/sky/objects.json   deep-sky picks, landmarks, the named stars, the
 *                             Voyagers, the meteor showers and the
 *                             constellation origin table
 *   public/sky/milkyway.json  the Milky Way band, simplified
 *
 * Hand-run, like prepare-sky.mjs: needs the network, never wired to prebuild,
 * outputs committed.
 *
 *   node scripts/prepare-sky-objects.mjs
 *
 * Sources (every one pinned or dated):
 *   - d3-celestial (BSD-3-Clause) at COMMIT: messier.json, mw.json,
 *     starnames.json, stars.6.json.
 *   - JPL Horizons API: Voyager 1 (-31) and Voyager 2 (-32), geocentric
 *     astrometric RA/Dec (ICRF, which is J2000 to far better than a pixel) and
 *     distance, for the day the script runs. The date is written into the
 *     output and the cards say it.
 *   - IMO 2026 Meteor Shower Calendar, Table 5 (Working List of Visual Meteor
 *     Showers). imo.net was offline when this was written, so the source is
 *     the Wayback Machine copy at IMO_PDF, checked by SHA-256 below. SHOWERS is
 *     transcribed from it by hand; the assertions after it catch a mistyped
 *     date or solar longitude.
 *   - Parent bodies: the IMO calendar's own text where it names one, NASA
 *     Science's shower pages ("Fast Facts") otherwise, Wikipedia's "Ursids"
 *     article (pinned revision) for the one neither covers. Per shower in
 *     SHOWERS[].parentSource.
 *   - Constellation origins: the Year / Discoverer / Split from columns of
 *     Wikipedia's "IAU designated constellations" table, parsed from the
 *     wikitext of the pinned revision WIKI_REVISION (checked by SHA-256), never
 *     hand-typed.
 *
 * Assert-before-write: everything is fetched, assembled and checked first;
 * nothing is written if any check fails.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as Astronomy from "astronomy-engine";

const COMMIT = "7e720a3de062059d4c5400a379146a601d9010e0";
const REPO = "https://github.com/ofrohn/d3-celestial";
const RAW = `https://raw.githubusercontent.com/ofrohn/d3-celestial/${COMMIT}/data`;
/** Verbatim from d3-celestial's LICENSE at COMMIT (BSD-3 requires the notice). */
const D3_CELESTIAL_COPYRIGHT = "Copyright (c) 2015, Olaf Frohn";

const WIKI_REVISION = 1373165890;
const WIKI_RAW = `https://en.wikipedia.org/w/index.php?title=IAU_designated_constellations&action=raw&oldid=${WIKI_REVISION}`;
const WIKI_PAGE = `https://en.wikipedia.org/w/index.php?title=IAU_designated_constellations&oldid=${WIKI_REVISION}`;
const WIKI_SHA256 = "b2a22176359234614002fbf7ca177dfd0c4d10ea2346d71f2723827b6e9c45b5";

const IMO_PDF = "https://web.archive.org/web/20260905025331id_/https://www.imo.net/files/meteor-shower/cal2026.pdf";
const IMO_SHA256 = "fde5388889ebda9fe13436d793da5e9935ae46b99edf20e0b19f7fe32ce1ed9f";

const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api";
const UA = "neelayranjan.dev scripts/prepare-sky-objects.mjs (hand-run build script)";

const OUT_DIR = new URL("../public/sky/", import.meta.url);
const SKY_JSON = new URL("sky.json", OUT_DIR);

const D2R = Math.PI / 180;
const ra360 = (lon) => ((lon % 360) + 360) % 360;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r5 = (v) => Math.round(v * 1e5) / 1e5;

function fail(msg) {
  console.error(`prepare-sky-objects: ${msg}. Nothing written.`);
  process.exit(1);
}

/** GET with a user agent and up to three tries (Wayback rate-limits bursts). */
async function get(url, as) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": UA } });
    } catch (err) {
      res = { ok: false, status: String(err) };
    }
    if (res.ok) {
      if (as === "json") return res.json();
      if (as === "bytes") return Buffer.from(await res.arrayBuffer());
      return res.text();
    }
    if (attempt >= 3) fail(`${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 10_000 * attempt));
  }
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/* ---------------------------------------------------------------------- */
/* Transcribed tables                                                      */
/* ---------------------------------------------------------------------- */

/** The ten Messier favourites (spec §4). Names are the common English names. */
const MESSIER = {
  M1: { id: "m1", name: "Crab Nebula" },
  M8: { id: "m8", name: "Lagoon Nebula" },
  M13: { id: "m13", name: "Hercules Cluster" },
  M31: { id: "m31", name: "Andromeda Galaxy" },
  M42: { id: "m42", name: "Orion Nebula" },
  M44: { id: "m44", name: "Beehive Cluster" },
  M45: { id: "m45", name: "Pleiades" },
  M51: { id: "m51", name: "Whirlpool Galaxy" },
  M57: { id: "m57", name: "Ring Nebula" },
  M87: { id: "m87", name: "M87" },
};
/** d3-celestial `type` codes: galaxies draw as an ellipse, nebulae and remnants a dotted circle, clusters a ring of dots. */
const SYMBOL_FOR_TYPE = {
  s: "galaxy", e: "galaxy", i: "galaxy",
  snr: "nebula", sfr: "nebula", pn: "nebula", rn: "nebula",
  oc: "cluster", gc: "cluster",
};

/** The 15 named bright stars (spec §4), by Hipparcos number. */
const NAMED_STARS = [
  ["polaris", "Polaris", 11767], ["sirius", "Sirius", 32349], ["arcturus", "Arcturus", 69673],
  ["vega", "Vega", 91262], ["capella", "Capella", 24608], ["rigel", "Rigel", 24436],
  ["procyon", "Procyon", 37279], ["betelgeuse", "Betelgeuse", 27989], ["altair", "Altair", 97649],
  ["aldebaran", "Aldebaran", 21421], ["antares", "Antares", 80763], ["spica", "Spica", 65474],
  ["pollux", "Pollux", 37826], ["deneb", "Deneb", 102098], ["regulus", "Regulus", 49669],
];

const NASA_SHOWER = (slug) => `https://science.nasa.gov/solar-system/meteors-meteorites/${slug}/`;
const URSIDS_WIKI = "https://en.wikipedia.org/w/index.php?title=Ursids&oldid=1328535157";

/**
 * IMO 2026 calendar, Table 5, transcribed. Dates are MM-DD; `start` after
 * `end` means the window wraps the new year. solarLongitudeDeg is Table 5's
 * λ⊙ (J2000.0). Radiants are the tabulated peak positions (radiant drift is
 * ignored, and the cards say so).
 */
const SHOWERS = [
  { id: "quadrantids", name: "Quadrantids", imo: "010 QUA", start: "12-28", end: "01-12", peak: "01-03", solarLongitudeDeg: 283.15, radiantRaDeg: 230, radiantDecDeg: 49, speedKmS: 41, zhr: 80, parent: "2003 EH1", parentSource: NASA_SHOWER("quadrantids") },
  { id: "lyrids", name: "April Lyrids", imo: "006 LYR", start: "04-14", end: "04-30", peak: "04-22", solarLongitudeDeg: 32.32, radiantRaDeg: 271, radiantDecDeg: 34, speedKmS: 49, zhr: 18, parent: "C/1861 G1 (Thatcher)", parentSource: IMO_PDF },
  { id: "eta-aquariids", name: "η-Aquariids", imo: "031 ETA", start: "04-19", end: "05-28", peak: "05-06", solarLongitudeDeg: 45.5, radiantRaDeg: 338, radiantDecDeg: -1, speedKmS: 66, zhr: 50, parent: "1P/Halley", parentSource: NASA_SHOWER("eta-aquarids") },
  { id: "southern-delta-aquariids", name: "Southern δ-Aquariids", imo: "005 SDA", start: "07-12", end: "08-23", peak: "07-31", solarLongitudeDeg: 128, radiantRaDeg: 340, radiantDecDeg: -16, speedKmS: 41, zhr: 25, parent: "96P/Machholz (suspected)", parentSource: NASA_SHOWER("delta-aquariids") },
  { id: "perseids", name: "Perseids", imo: "007 PER", start: "07-17", end: "08-24", peak: "08-13", solarLongitudeDeg: 140.0, radiantRaDeg: 48, radiantDecDeg: 58, speedKmS: 59, zhr: 100, parent: "109P/Swift-Tuttle", parentSource: IMO_PDF },
  { id: "draconids", name: "Draconids", imo: "009 DRA", start: "10-06", end: "10-10", peak: "10-09", solarLongitudeDeg: 195.4, radiantRaDeg: 262, radiantDecDeg: 54, speedKmS: 20, zhr: 5, parent: "21P/Giacobini-Zinner", parentSource: IMO_PDF },
  { id: "southern-taurids", name: "Southern Taurids", imo: "002 STA", start: "09-20", end: "11-20", peak: "11-05", solarLongitudeDeg: 223, radiantRaDeg: 52, radiantDecDeg: 15, speedKmS: 27, zhr: 7, parent: "2P/Encke", parentSource: IMO_PDF },
  { id: "orionids", name: "Orionids", imo: "008 ORI", start: "10-02", end: "11-07", peak: "10-21", solarLongitudeDeg: 208, radiantRaDeg: 95, radiantDecDeg: 16, speedKmS: 66, zhr: 20, parent: "1P/Halley", parentSource: NASA_SHOWER("orionids") },
  { id: "northern-taurids", name: "Northern Taurids", imo: "017 NTA", start: "10-20", end: "12-10", peak: "11-12", solarLongitudeDeg: 230, radiantRaDeg: 58, radiantDecDeg: 22, speedKmS: 29, zhr: 5, parent: "2P/Encke", parentSource: IMO_PDF },
  { id: "leonids", name: "Leonids", imo: "013 LEO", start: "11-06", end: "11-30", peak: "11-17", solarLongitudeDeg: 235.27, radiantRaDeg: 152, radiantDecDeg: 22, speedKmS: 71, zhr: 15, parent: "55P/Tempel-Tuttle", parentSource: IMO_PDF },
  { id: "geminids", name: "Geminids", imo: "004 GEM", start: "12-04", end: "12-20", peak: "12-14", solarLongitudeDeg: 262.2, radiantRaDeg: 112, radiantDecDeg: 33, speedKmS: 35, zhr: 150, parent: "3200 Phaethon", parentSource: NASA_SHOWER("geminids") },
  { id: "ursids", name: "Ursids", imo: "015 URS", start: "12-17", end: "12-26", peak: "12-22", solarLongitudeDeg: 270.7, radiantRaDeg: 217, radiantDecDeg: 76, speedKmS: 33, zhr: 10, parent: "8P/Tuttle", parentSource: URSIDS_WIKI },
];

/* ---------------------------------------------------------------------- */
/* Fetch                                                                   */
/* ---------------------------------------------------------------------- */

const [messier, mw, starnames, stars6, wikitext, imoPdf, skyJson] = await Promise.all([
  get(`${RAW}/messier.json`, "json"),
  get(`${RAW}/mw.json`, "json"),
  get(`${RAW}/starnames.json`, "json"),
  get(`${RAW}/stars.6.json`, "json"),
  get(WIKI_RAW, "text"),
  get(IMO_PDF, "bytes"),
  readFile(SKY_JSON, "utf8").then(JSON.parse),
]);

if (sha256(Buffer.from(wikitext, "utf8")) !== WIKI_SHA256) fail(`Wikipedia revision ${WIKI_REVISION} bytes changed`);
if (sha256(imoPdf) !== IMO_SHA256) fail("the archived IMO 2026 calendar is not the PDF SHOWERS was transcribed from");

const today = new Date();
const QUERY_DATE = today.toISOString().slice(0, 10);
const NEXT_DATE = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

function horizonsUrl(command) {
  const q = new URLSearchParams({
    format: "text",
    COMMAND: `'${command}'`,
    EPHEM_TYPE: "OBSERVER",
    CENTER: "'500@399'",
    START_TIME: `'${QUERY_DATE}'`,
    STOP_TIME: `'${NEXT_DATE}'`,
    STEP_SIZE: "'1d'",
    QUANTITIES: "'1,20'",
    OBJ_DATA: "'NO'",
  });
  return `${HORIZONS}?${q}`;
}

/** First row between $$SOE and $$EOE: RA h m s, Dec d m s, delta (au). */
function parseHorizons(text, label) {
  const soe = text.indexOf("$$SOE");
  const eoe = text.indexOf("$$EOE");
  if (soe < 0 || eoe < soe) fail(`${label}: no $$SOE/$$EOE block in the Horizons reply`);
  const row = text.slice(soe + 5, eoe).trim().split("\n")[0];
  const m = row.match(
    /^(\d{4}-[A-Za-z]{3}-\d{2}) \d{2}:\d{2}\s+(?:[^\d\s+-]{1,2}\s+)?(\d{2}) (\d{2}) ([\d.]+) ([+-])(\d{2}) (\d{2}) ([\d.]+)\s+([\d.]+)\s+(-?[\d.]+)/,
  );
  if (!m) fail(`${label}: unparsed Horizons row "${row}"`);
  const [, , h, mi, s, sign, d, dm, ds, delta] = m;
  const raDeg = 15 * (Number(h) + Number(mi) / 60 + Number(s) / 3600);
  const decDeg = (sign === "-" ? -1 : 1) * (Number(d) + Number(dm) / 60 + Number(ds) / 3600);
  return { raDeg: r5(raDeg), decDeg: r5(decDeg), distanceAu: r2(Number(delta)) };
}

const v1 = parseHorizons(await get(horizonsUrl(-31), "text"), "Voyager 1");
const v2 = parseHorizons(await get(horizonsUrl(-32), "text"), "Voyager 2");

/* ---------------------------------------------------------------------- */
/* Assemble                                                                */
/* ---------------------------------------------------------------------- */

const objects = [];

for (const [name, pick] of Object.entries(MESSIER)) {
  const f = messier.features.find((x) => x.properties.name === name);
  if (!f) fail(`${name} missing from messier.json`);
  const { type, dim, desig, mag } = f.properties;
  const symbol = SYMBOL_FOR_TYPE[type];
  if (!symbol) fail(`${name}: unknown d3-celestial type "${type}"`);
  const [a, b] = String(dim).split("x").map(Number);
  objects.push({
    id: pick.id,
    name: pick.name,
    designation: desig ? `${name} · ${desig}` : name,
    symbol,
    raDeg: r5(ra360(f.geometry.coordinates[0])),
    decDeg: r5(f.geometry.coordinates[1]),
    mag,
    // Galaxy ellipse axis ratio from the catalog's size, clamped so a thin
    // disc still reads as an ellipse at 8px. A symbol, not a picture.
    ...(symbol === "galaxy" ? { axisRatio: r2(Math.min(1, Math.max(0.35, b && a ? b / a : 1))) } : {}),
  });
}

// Sagittarius A*, J2000 (spec §4): RA 17h45m40.04s, Dec −29°00′28.1″.
objects.push({
  id: "sgr-a-star",
  name: "Galactic core",
  designation: "Sagittarius A*",
  symbol: "core",
  raDeg: r5(15 * (17 + 45 / 60 + 40.04 / 3600)),
  decDeg: r5(-(29 + 0 / 60 + 28.1 / 3600)),
});

// Kepler field (spec §4): centre RA 19h22m40s, Dec +44°30′; a circle of the
// same ~115 deg² area. On a sphere, area = 2π(1 − cos r) steradians.
const KEPLER_AREA_DEG2 = 115;
const keplerRadiusDeg = Math.acos(1 - (KEPLER_AREA_DEG2 * D2R * D2R) / (2 * Math.PI)) / D2R;
objects.push({
  id: "kepler-field",
  name: "Kepler field (approximate outline)",
  symbol: "field",
  raDeg: r5(15 * (19 + 22 / 60 + 40 / 3600)),
  decDeg: 44.5,
  radiusDeg: r2(keplerRadiusDeg),
});

// Hubble Deep Field (spec §4): RA 12h36m49.4s, Dec +62°12′58″ (J2000).
objects.push({
  id: "hubble-deep-field",
  name: "Hubble Deep Field",
  designation: "HDF",
  symbol: "square",
  raDeg: r5(15 * (12 + 36 / 60 + 49.4 / 3600)),
  decDeg: r5(62 + 12 / 60 + 58 / 3600),
});

objects.push({ id: "voyager-1", name: "Voyager 1", symbol: "chevron", ...v1, positionDate: QUERY_DATE });
objects.push({ id: "voyager-2", name: "Voyager 2", symbol: "chevron", ...v2, positionDate: QUERY_DATE });

const starById = new Map(stars6.features.map((f) => [f.id, f]));
for (const [id, name, hip] of NAMED_STARS) {
  const entry = starnames[String(hip)];
  if (!entry || entry.name !== name) fail(`starnames.json HIP ${hip} is "${entry?.name}", expected ${name}`);
  const star = starById.get(hip);
  if (!star) fail(`${name} (HIP ${hip}) missing from stars.6.json`);
  objects.push({
    id,
    name,
    designation: `${entry.desig} ${entry.c} · HIP ${hip}`,
    symbol: "star",
    raDeg: r5(ra360(star.geometry.coordinates[0])),
    decDeg: r5(star.geometry.coordinates[1]),
    mag: star.properties.mag,
    hip,
  });
}

/* Constellation origins, parsed from the pinned wikitext. */
function parseOrigins(src) {
  const start = src.indexOf('{| class="wikitable sortable');
  const end = src.indexOf("\n|}", start);
  if (start < 0 || end < 0) fail("IAU table not found in the wikitext");
  const clean = (cell) =>
    cell
      .replace(/<ref[^>]*\/>/g, "")
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
      .replace(/\{\{efn[^}]*\}\}/g, "")
      .replace(/\{\{IPAc-en[^}]*\}\}/g, "")
      .replace(/\{\{(?:br|wbr)\}\}/g, " ")
      .replace(/data-sort-value="[^"]*"\s*\|/g, "")
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
      .replace(/''/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const out = {};
  for (const row of src.slice(start, end).split(/\n\|-\s*\n/).slice(1)) {
    const cells = row.replace(/^\|\s?/, "").split(/\s*\|\|\s*|\n\|\s*/).map(clean);
    const abbr = cells[1];
    if (cells.length < 9 || !/^[A-Z][A-Za-z]{2}$/.test(abbr ?? "")) continue; // the header's second row
    const yearCell = cells[4];
    const years = yearCell.match(/\d{4}/g) ?? [];
    const by = cells[5].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    out[abbr] = {
      ancient: /ancient/.test(yearCell),
      year: years.length ? Number(years[years.length - 1]) : null,
      by,
      splitFrom: cells[7] || null,
    };
  }
  return out;
}
const constellations = parseOrigins(wikitext);

const sky = {
  version: 1,
  epoch: "J2000",
  generated: QUERY_DATE,
  source: {
    d3celestial: { repo: REPO, commit: COMMIT, license: "BSD-3-Clause", copyright: D3_CELESTIAL_COPYRIGHT },
    horizons: { url: "https://ssd.jpl.nasa.gov/horizons/", queried: QUERY_DATE, quantities: "1 (astrometric RA/Dec, ICRF), 20 (range)" },
    imo: { title: "2026 Meteor Shower Calendar (IMO INFO(3-25)), Table 5", editor: "Jürgen Rendtel", url: IMO_PDF, sha256: IMO_SHA256 },
    constellations: { url: WIKI_PAGE, revision: WIKI_REVISION, sha256: WIKI_SHA256 },
  },
  objects,
  showers: SHOWERS,
  constellations,
};

/* Milky Way: every ring of every level, Douglas-Peucker on the sphere. */
const MW_TOLERANCE_DEG = 0.2;
const unit = ([ra, dec]) => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
const angleDeg = (a, b) => {
  const u = unit(a);
  const v = unit(b);
  return Math.acos(Math.min(1, Math.max(-1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) / D2R;
};
/** Distance (deg, small-angle chord) from p to the chord a-b. */
function chordDistanceDeg(p, a, b) {
  const P = unit(p);
  const A = unit(a);
  const B = unit(b);
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  let t = len2 === 0 ? 0 : ((P[0] - A[0]) * d[0] + (P[1] - A[1]) * d[1] + (P[2] - A[2]) * d[2]) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(A[0] + t * d[0] - P[0], A[1] + t * d[1] - P[1], A[2] + t * d[2] - P[2]) / D2R;
}
function douglasPeucker(pts, tol) {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let best = -1;
    let at = -1;
    for (let i = s + 1; i < e; i++) {
      const dist = chordDistanceDeg(pts[i], pts[s], pts[e]);
      if (dist > best) {
        best = dist;
        at = i;
      }
    }
    if (best > tol) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
const levels = [];
if (mw.features.map((f) => f.id).join() !== "ol1,ol2,ol3,ol4,ol5") fail(`mw.json features are ${mw.features.map((f) => f.id)}`);
for (const f of mw.features) {
  const rings = [];
  for (const polygon of f.geometry.coordinates) {
    for (const ring of polygon) {
      const open = ring.slice(0, -1).map(([lon, lat]) => [ra360(lon), lat]); // GeoJSON rings repeat their first point
      if (open.length < 4) continue;
      // Split the closed ring in two so each half has distinct endpoints.
      const mid = open.length >> 1;
      const a = douglasPeucker(open.slice(0, mid + 1), MW_TOLERANCE_DEG);
      const b = douglasPeucker([...open.slice(mid), open[0]], MW_TOLERANCE_DEG);
      const simple = [...a.slice(0, -1), ...b.slice(0, -1)].map(([ra, dec]) => [r1(ra), r1(dec)]);
      const extent = Math.max(...simple.map((p) => angleDeg(p, simple[0])));
      if (simple.length < 4 || extent < 1.5) continue; // specks under ~15 px
      rings.push(simple);
    }
  }
  levels.push(rings);
}
// "Milky Way" label anchors on the galactic equator (b = 0), converted with
// astronomy-engine's own galactic rotation. l = 0 is skipped: that is the
// galactic core, which has its own label.
const galToEq = Astronomy.Rotation_GAL_EQJ();
const labels = [45, 90, 135, 180, 225, 270, 315].map((l) => {
  const v = Astronomy.RotateVector(galToEq, Astronomy.VectorFromSphere(new Astronomy.Spherical(0, l, 1), new Astronomy.AstroTime(0)));
  const eq = Astronomy.EquatorFromVector(v);
  return [r1(eq.ra * 15), r1(eq.dec)];
});
const milkyway = {
  version: 1,
  epoch: "J2000",
  source: { repo: REPO, commit: COMMIT, file: "data/mw.json", license: "BSD-3-Clause", copyright: D3_CELESTIAL_COPYRIGHT },
  toleranceDeg: MW_TOLERANCE_DEG,
  levels,
  labels,
};

/* ---------------------------------------------------------------------- */
/* Assert before write                                                     */
/* ---------------------------------------------------------------------- */

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const byId = new Map(objects.map((o) => [o.id, o]));
if (byId.size !== objects.length) fail("duplicate object ids");
if (objects.length !== 30) fail(`${objects.length} objects, expected 30`);

const m31 = byId.get("m31");
if (!near(m31.raDeg, 10.6751, 0.001) || !near(m31.decDeg, 41.2667, 0.001)) fail(`M31 at ${m31.raDeg}, ${m31.decDeg}`);
const core = byId.get("sgr-a-star");
if (!near(core.raDeg, 266.41683, 1e-4) || !near(core.decDeg, -29.00781, 1e-4)) fail(`Sgr A* at ${core.raDeg}, ${core.decDeg}`);
if (!near(byId.get("kepler-field").radiusDeg, 6.05, 0.01)) fail(`Kepler radius ${keplerRadiusDeg}`);
const hdf = byId.get("hubble-deep-field");
if (!near(hdf.raDeg, 189.20583, 1e-4) || !near(hdf.decDeg, 62.21611, 1e-4)) fail(`HDF at ${hdf.raDeg}, ${hdf.decDeg}`);
const polaris = byId.get("polaris");
if (!near(polaris.decDeg, 89.2641, 0.001)) fail(`Polaris at dec ${polaris.decDeg}`);
if (!near(byId.get("sirius").mag, -1.44, 0.01)) fail("Sirius magnitude");
for (const [id] of NAMED_STARS) if (!(byId.get(id).mag <= 2.0)) fail(`${id} is fainter than mag 2`);

// Voyager 1 sits in Ophiuchus near dec +12°, Voyager 2 far south in Pavo; both recede ~3-4 au a year.
if (!(v1.raDeg > 255 && v1.raDeg < 262 && v1.decDeg > 10 && v1.decDeg < 14 && v1.distanceAu > 165 && v1.distanceAu < 185))
  fail(`Voyager 1 implausible: ${JSON.stringify(v1)}`);
if (!(v2.raDeg > 300 && v2.raDeg < 305 && v2.decDeg > -62 && v2.decDeg < -57 && v2.distanceAu > 138 && v2.distanceAu < 155))
  fail(`Voyager 2 implausible: ${JSON.stringify(v2)}`);

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const mdNum = (md) => Number(md.slice(0, 2)) * 100 + Number(md.slice(3));
const inWindow = (md, start, end) =>
  mdNum(start) <= mdNum(end) ? mdNum(md) >= mdNum(start) && mdNum(md) <= mdNum(end) : mdNum(md) >= mdNum(start) || mdNum(md) <= mdNum(end);
const EXPECTED_SHOWERS = "quadrantids,lyrids,eta-aquariids,southern-delta-aquariids,perseids,draconids,southern-taurids,orionids,northern-taurids,leonids,geminids,ursids";
if (SHOWERS.map((s) => s.id).join() !== EXPECTED_SHOWERS) fail("shower list is not the spec's twelve, in order");
for (const s of SHOWERS) {
  for (const k of ["start", "end", "peak"]) if (!MD.test(s[k])) fail(`${s.id}.${k} "${s[k]}"`);
  if (!inWindow(s.peak, s.start, s.end)) fail(`${s.id}: peak ${s.peak} outside ${s.start}..${s.end}`);
  if (!(s.radiantRaDeg >= 0 && s.radiantRaDeg < 360 && s.radiantDecDeg >= -90 && s.radiantDecDeg <= 90)) fail(`${s.id} radiant`);
  if (!(Number.isInteger(s.zhr) && s.zhr > 0)) fail(`${s.id} ZHR ${s.zhr}`);
  if (!s.parent || !/^https:\/\//.test(s.parentSource)) fail(`${s.id} parent body or its source`);
  // A mistyped peak date or λ⊙ shows up here: the Sun's J2000 ecliptic
  // longitude at noon UTC on the 2026 peak date must be within 1° of Table 5's
  // λ⊙ (measured worst case when this was written: 0.81°, the Draconids).
  const [mm, dd] = s.peak.split("-").map(Number);
  const noon = new Date(Date.UTC(2026, mm - 1, dd, 12));
  const sunLon = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, noon, true)).elon;
  const dLon = Math.abs(((sunLon - s.solarLongitudeDeg + 540) % 360) - 180);
  if (dLon > 1) fail(`${s.id}: Sun at ${sunLon.toFixed(2)}° on ${s.peak}, Table 5 says λ⊙ ${s.solarLongitudeDeg}°`);
}

const skyAbbrs = Object.keys(skyJson.constellations).sort();
const originAbbrs = Object.keys(constellations).sort();
if (originAbbrs.join() !== skyAbbrs.join()) fail(`origin table abbreviations differ from sky.json's 88: ${originAbbrs.length}`);
// The groups, counted from the pinned revision when this was written. A
// parser slip moves a constellation between groups and trips this.
const group = (o) => (o.ancient ? (o.year === null ? "ancient" : `ancient+${o.year}`) : String(o.year));
const counts = {};
for (const o of Object.values(constellations)) counts[group(o)] = (counts[group(o)] ?? 0) + 1;
const EXPECTED_COUNTS = { ancient: 47, "ancient+1756": 3, "ancient+1536": 1, 1756: 14, 1598: 12, 1613: 2, 1592: 1, 1589: 1, 1690: 7 };
if (JSON.stringify(Object.entries(counts).sort()) !== JSON.stringify(Object.entries(EXPECTED_COUNTS).map(([k, v]) => [String(k), v]).sort()))
  fail(`origin groups ${JSON.stringify(counts)}`);
const expectOrigin = (abbr, want) => {
  const got = constellations[abbr];
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${abbr} origin ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
expectOrigin("UMa", { ancient: true, year: null, by: ["Ptolemy"], splitFrom: null });
expectOrigin("Ant", { ancient: false, year: 1756, by: ["Lacaille"], splitFrom: null });
expectOrigin("Aps", { ancient: false, year: 1598, by: ["Plancius", "Keyser", "de Houtman"], splitFrom: null });
expectOrigin("Car", { ancient: true, year: 1756, by: ["Ptolemy", "Lacaille"], splitFrom: "Argo Navis" });
expectOrigin("Com", { ancient: true, year: 1536, by: ["Ptolemy", "Caspar Vopel"], splitFrom: "Leo" });
expectOrigin("Cru", { ancient: false, year: 1589, by: ["Plancius"], splitFrom: "Centaurus" });
expectOrigin("Lyn", { ancient: false, year: 1690, by: ["Hevelius"], splitFrom: null });

const vertexCount = levels.reduce((n, rings) => n + rings.reduce((m, r) => m + r.length, 0), 0);
if (levels.length !== 5) fail(`${levels.length} Milky Way levels`);
for (const [i, rings] of levels.entries()) if (rings.length < 4) fail(`Milky Way level ${i + 1} has ${rings.length} rings`);
if (vertexCount > 4000 || vertexCount < 1500) fail(`${vertexCount} Milky Way vertices (budget 1,500-4,000)`);

const objectsBody = JSON.stringify(sky);
const milkywayBody = JSON.stringify(milkyway);
if (milkywayBody.length >= 90_000) fail(`milkyway.json would be ${milkywayBody.length} bytes`);
if (objectsBody.length >= 40_000) fail(`objects.json would be ${objectsBody.length} bytes`);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL("objects.json", OUT_DIR), objectsBody);
await writeFile(new URL("milkyway.json", OUT_DIR), milkywayBody);
console.log(
  `prepare-sky-objects: wrote public/sky/objects.json (${objectsBody.length} bytes: ${objects.length} objects, ` +
    `${SHOWERS.length} showers, ${originAbbrs.length} constellation origins; Voyagers as of ${QUERY_DATE}) and ` +
    `public/sky/milkyway.json (${milkywayBody.length} bytes, ${vertexCount} vertices)`,
);
```

- [ ] **Step 5: Run the generator**

Run: `node scripts/prepare-sky-objects.mjs`
Expected (the byte count and Voyager date move with the run date): `prepare-sky-objects: wrote public/sky/objects.json (~15260 bytes: 30 objects, 12 showers, 88 constellation origins; Voyagers as of YYYY-MM-DD) and public/sky/milkyway.json (30159 bytes, 2267 vertices)`.
If it stops on an assertion, fix the cause it names (a source that changed, a transcription slip). Never loosen an assertion to get past it without writing down, in the task report, the measurement that justifies the new number.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test scripts/test-sky-objects.mjs scripts/test-sky-data.mjs`
Expected: 8 + 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/prepare-sky-objects.mjs scripts/test-sky-objects.mjs public/sky/objects.json public/sky/milkyway.json
git commit -m "sky: objects and Milky Way data (d3-celestial, Horizons, IMO 2026, IAU origins)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 3: The facts (research and writing)

This task is research and prose. The test and the gate are complete code; the 138 entries are written by you, from sources you read, in batches. Nothing in this task touches the site's rendering.

**Files:**
- Create: `content/sky-facts.ts`, `scripts/test-sky-facts.mjs`
- Modify: `scripts/check-voice.mjs`

**Interfaces:**
- Consumes: `public/sky/objects.json` (object ids, shower ids, constellation origins), `public/sky/sky.json` (the 88 abbreviations and their Latin/English names).
- Produces (`content/sky-facts.ts`, no runtime imports):
  ```ts
  export type Citation = { author: string; year: string; title: string; site: string; url: string; accessed: string };
  export type SkyFact = { id: string; kind: string; oneLiner: string; body: string[]; visibility: string; citations: Citation[] };
  export const IAU_TABLE: Citation;      // the pinned Wikipedia revision
  export const IMO_2026: Citation;       // the archived IMO calendar
  export const HORIZONS: Citation;       // JPL Horizons
  export const CELESTRAK_ISS: Citation;  // CelesTrak's ISS element set
  export const SKY_FACTS: readonly SkyFact[];
  ```
- Fact ids (138): the 30 `objects.json` object ids; `mercury venus mars jupiter saturn moon iss milky-way`; the 12 shower ids; the 88 IAU abbreviations (case as in `sky.json`, e.g. `UMa`, `CVn`).

- [ ] **Step 1: Write the failing test and extend the voice gate**

Create `scripts/test-sky-facts.mjs`:

```js
// node --test scripts/test-sky-facts.mjs
// Coverage and shape of content/sky-facts.ts (spec 2026-09-15 §7): every
// selectable thing in the sky has exactly one fact, and every fact has a
// one-liner, a body, a visibility line and at least one well-formed
// citation. Cross-checks the constellation one-liners against the origin
// table that prepare-sky-objects.mjs parsed from Wikipedia, so a hand-typed
// origin can't drift from the generated one.
//
// While the facts are being written in batches, run it as
//   SKY_FACTS_PARTIAL=1 node --test scripts/test-sky-facts.mjs
// to check only the entries that exist so far (unknown ids and duplicates
// still fail). The finished file must pass WITHOUT the variable.
//
// What this cannot check: that each number and claim appears in its cited
// source. That is the self-audit step in the plan, done by reading.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SKY_FACTS } from "../content/sky-facts.ts";

const objects = JSON.parse(await readFile(new URL("../public/sky/objects.json", import.meta.url), "utf8"));
const sky = JSON.parse(await readFile(new URL("../public/sky/sky.json", import.meta.url), "utf8"));

const PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn"];
const CONSTELLATIONS = Object.keys(sky.constellations);
const SHOWERS = objects.showers.map((s) => s.id);
const EXPECTED = [
  ...objects.objects.map((o) => o.id),
  ...PLANETS,
  "moon",
  "iss",
  "milky-way",
  ...SHOWERS,
  ...CONSTELLATIONS,
];
/** The 30 best-known constellations, whose cards carry mythology (spec §7). */
const MYTH = [
  "And", "Aql", "Aqr", "Ari", "Aur", "Boo", "Cnc", "CMa", "Cap", "Cas", "Cen", "Cep", "Cet", "CrB", "Cyg",
  "Dra", "Gem", "Her", "Hya", "Leo", "Lyr", "Oph", "Ori", "Peg", "Per", "Sco", "Sgr", "Tau", "UMa", "Vir",
];
const PARTIAL = process.env.SKY_FACTS_PARTIAL === "1";
const byId = new Map(SKY_FACTS.map((f) => [f.id, f]));
/** The fact for `id`, or null when a partial run hasn't reached it yet. */
function factFor(id) {
  const f = byId.get(id);
  if (!f && !PARTIAL) assert.fail(`missing fact: ${id}`);
  return f ?? null;
}
const today = new Date().toISOString().slice(0, 10);
const cites = (fact, re) => fact.citations.some((c) => re.test(c.url));

test("coverage: exactly one fact per selectable id", () => {
  assert.equal(EXPECTED.length, 138);
  assert.equal(byId.size, SKY_FACTS.length, "duplicate fact ids");
  const missing = EXPECTED.filter((id) => !byId.has(id));
  const unknown = SKY_FACTS.map((f) => f.id).filter((id) => !EXPECTED.includes(id));
  assert.deepEqual(unknown, [], `facts for unknown ids: ${unknown.join(", ")}`);
  if (PARTIAL) console.log(`# partial run: ${SKY_FACTS.length} of ${EXPECTED.length} facts written`);
  else assert.deepEqual(missing, [], `missing facts: ${missing.join(", ")}`);
});

test("every fact: kind, one-liner, body, visibility", () => {
  for (const f of SKY_FACTS) {
    assert.ok(f.kind.length > 0 && f.kind.length <= 60, `${f.id}: kind "${f.kind}"`);
    assert.ok(f.oneLiner.length > 0 && f.oneLiner.length <= 64, `${f.id}: oneLiner is ${f.oneLiner.length} chars`);
    assert.ok(!/[.]$/.test(f.oneLiner), `${f.id}: the one-liner is a label, no closing period`);
    assert.ok(Array.isArray(f.body) && f.body.length >= 1 && f.body.length <= 3, `${f.id}: body has ${f.body.length} sentences`);
    for (const s of f.body) {
      assert.ok(s.trim().length > 0, `${f.id}: empty body sentence`);
      assert.match(s, /[.!?][”"’)]?$/, `${f.id}: body sentence without an ending: "${s}"`);
      const curlyOpen = (s.match(/“/g) ?? []).length;
      const curlyClose = (s.match(/”/g) ?? []).length;
      assert.equal(curlyOpen, curlyClose, `${f.id}: unbalanced quotation marks in "${s}"`);
      assert.equal((s.match(/"/g) ?? []).length % 2, 0, `${f.id}: unbalanced straight quotes in "${s}"`);
    }
    assert.match(f.visibility, /^(Naked eye|Binoculars|Telescope|Not visible)/, `${f.id}: visibility "${f.visibility}"`);
  }
});

test("every citation is complete (APA fields, http(s) URL, a real access date)", () => {
  for (const f of SKY_FACTS) {
    assert.ok(f.citations.length >= 1, `${f.id}: no citation`);
    for (const c of f.citations) {
      for (const k of ["author", "year", "title", "site", "url", "accessed"]) {
        assert.ok(typeof c[k] === "string" && c[k].trim().length > 0, `${f.id}: citation missing ${k}`);
      }
      assert.match(c.url, /^https?:\/\/\S+$/, `${f.id}: url ${c.url}`);
      assert.match(c.year, /^(\d{4}|n\.d\.)$/, `${f.id}: year ${c.year}`);
      assert.match(c.accessed, /^\d{4}-\d{2}-\d{2}$/, `${f.id}: accessed ${c.accessed}`);
      assert.ok(c.accessed >= "2026-09-15" && c.accessed <= today, `${f.id}: accessed ${c.accessed} is outside 2026-09-15..${today}`);
    }
  }
});

test("constellations: origin one-liner agrees with the generated table; sources", () => {
  for (const abbr of CONSTELLATIONS) {
    const f = factFor(abbr);
    if (!f) continue;
    const o = objects.constellations[abbr];
    assert.match(f.kind, /^Constellation/, `${abbr}: kind "${f.kind}"`);
    if (o.ancient && o.year === null) {
      assert.match(f.oneLiner, /Ptolemy/, `${abbr}: ancient, but "${f.oneLiner}" doesn't name Ptolemy`);
    } else {
      assert.ok(f.oneLiner.includes(String(o.year)), `${abbr}: "${f.oneLiner}" lacks the table's year ${o.year}`);
      const lead = o.ancient ? o.by[o.by.length - 1] : o.by[0]; // the later originator for a split ancient figure
      assert.ok(f.oneLiner.includes(lead), `${abbr}: "${f.oneLiner}" lacks ${lead}`);
    }
    if (o.splitFrom) assert.ok(f.oneLiner.includes(o.splitFrom), `${abbr}: "${f.oneLiner}" lacks "${o.splitFrom}"`);
    assert.ok(cites(f, /IAU_designated_constellations/), `${abbr}: must cite the IAU designated constellations table`);
  }
  for (const abbr of MYTH) {
    const f = factFor(abbr);
    if (f) assert.ok(cites(f, /^https?:\/\/www\.ianridpath\.com\/startales\//), `${abbr}: mythology must cite Star Tales`);
  }
});

test("showers, planets, the Moon, spacecraft, the ISS: required sources", () => {
  for (const id of SHOWERS) {
    const f = factFor(id);
    if (!f) continue;
    assert.match(f.kind, /^Meteor shower/, `${id}: kind`);
    assert.ok(cites(f, /^https:\/\/web\.archive\.org\/web\/20260905025331id_\/https:\/\/www\.imo\.net\/files\/meteor-shower\/cal2026\.pdf$/), `${id}: must cite the IMO 2026 calendar`);
  }
  for (const id of [...PLANETS, "moon"]) {
    const f = factFor(id);
    if (f) assert.ok(cites(f, /^https:\/\/science\.nasa\.gov\//), `${id}: must cite NASA Science`);
  }
  for (const id of ["voyager-1", "voyager-2"]) {
    const f = factFor(id);
    if (!f) continue;
    assert.ok(cites(f, /^https:\/\/ssd\.jpl\.nasa\.gov\/horizons/), `${id}: must cite JPL Horizons (the position)`);
    assert.ok(cites(f, /^https:\/\/science\.nasa\.gov\/mission\/voyager\//), `${id}: must cite NASA's Voyager page`);
  }
  const iss = factFor("iss");
  if (iss) assert.ok(cites(iss, /^https:\/\/celestrak\.org\//), "iss: must cite CelesTrak (the orbit data)");
  for (const id of ["voyager-1", "voyager-2", "hubble-deep-field"]) {
    const f = factFor(id);
    if (f) assert.match(f.visibility, /^Not visible/, `${id}: nothing to see there, only a direction`);
  }
  const m87 = factFor("m87");
  if (m87) assert.match(m87.body.join(" "), /black hole/i, "m87: the card covers the galaxy and its black hole (spec §4)");
});
```

In `scripts/check-voice.mjs`:

1. Replace the first two comment lines

```js
 * Voice gate for content/copy.ts (CLAUDE.md's Voice section, binding for all
 * visitor-facing copy).
```

with

```js
 * Voice gate for content/copy.ts and content/sky-facts.ts (CLAUDE.md's Voice
 * section, binding for all visitor-facing copy; the sky facts joined
 * 2026-09-15, spec docs/superpowers/specs/2026-09-15-sky-objects-design.md §7).
```

2. Replace

```js
 * where these live (résumé/CV/GitHub/ORCID/email links, the /lab route).
 */
```

with

```js
 * where these live (résumé/CV/GitHub/ORCID/email links, the /lab route).
 *
 * In content/sky-facts.ts the citation fields (author, year, title, site,
 * url, accessed, and anything inside a `citations:` list) are skipped too:
 * they are the SOURCE's own words, reproduced for the reference list, not
 * this site's voice. Everything a card says in its own words (kind, oneLiner,
 * body, visibility) is scanned with the same rules as copy.ts. A verbatim
 * quote in a body that would trip a rule is not an exemption: paraphrase it.
 */
```

3. Replace `const COPY_PATH = path.join(__dirname, "..", "content", "copy.ts");` with

```js
const FILES = [
  { rel: "content/copy.ts", skipKeys: new Set() },
  {
    rel: "content/sky-facts.ts",
    skipKeys: new Set(["author", "year", "title", "site", "url", "accessed", "citations"]),
  },
];
```

4. Replace the whole `main` function with

```js
function main() {
  const violations = [];
  const scanned = [];
  for (const { rel, skipKeys } of FILES) {
    const raw = readFileSync(path.join(__dirname, "..", rel), "utf8");
    const strings = extractStrings(raw).filter(({ key }) => !skipKeys.has(key));
    scanned.push(`${strings.length} in ${rel}`);
    for (const { key, value, line } of strings) {
      violations.push(...checkString(key, value, line).map((v) => ({ ...v, rel })));
    }
  }

  if (violations.length > 0) {
    console.error(`check-voice: ${violations.length} violation(s)\n`);
    for (const v of violations) {
      const preview = v.value.length > 90 ? v.value.slice(0, 90) + "…" : v.value;
      console.error(`  ${v.rel}:${v.line}  key "${v.key}"  ${v.issue}`);
      console.error(`    "${preview}"`);
    }
    process.exit(1);
  }

  console.log(`check-voice: passed (string literals scanned: ${scanned.join(", ")})`);
  process.exit(0);
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test scripts/test-sky-facts.mjs; node scripts/check-voice.mjs`
Expected: the test fails with `Cannot find module '…/content/sky-facts.ts'`; the gate fails with `ENOENT … content/sky-facts.ts`.

- [ ] **Step 3: Create the facts file with its shared sources and two worked examples**

Create `content/sky-facts.ts`:

```ts
/**
 * Every card and desk one-liner in the night sky (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §5-§7): one entry
 * per selectable thing, keyed by the same id the renderer uses (objects.json
 * ids, lowercase planet names, "moon", "iss", "milky-way", shower ids, IAU
 * constellation abbreviations).
 *
 * ⚠️ NO RUNTIME IMPORTS. scripts/test-sky-facts.mjs imports this file straight
 * into node. Types only.
 *
 * Rules, all binding (the plan's Task 3 spells them out):
 *   - Every number in an entry appears in one of its cited sources. No
 *     uncited claim. A quote is verbatim inside “curly quotes”; a paraphrase
 *     changes the wording, never the fact.
 *   - Voice-gated by scripts/check-voice.mjs with copy.ts's rules. The
 *     citation fields are the sources' own words and are not scanned; kind,
 *     oneLiner, body and visibility are. A quote that would trip the gate
 *     gets paraphrased instead.
 *   - `accessed` is the ISO date the source was actually read.
 */

export type Citation = {
  /** APA author: "Ridpath, I.", or an organisation: "NASA Science". */
  author: string;
  /** Four digits, or "n.d." when the page carries no date. */
  year: string;
  title: string;
  site: string;
  url: string;
  /** ISO date the page was read, rendered "Retrieved September 15, 2026". */
  accessed: string;
};

export type SkyFact = {
  id: string;
  /** Card kind line: "Spiral galaxy · 2.5 million light-years". */
  kind: string;
  /** Desk hover line, a label rather than a sentence, at most 64 characters. */
  oneLiner: string;
  /** One to three sentences. */
  body: string[];
  /** Starts with "Naked eye", "Binoculars", "Telescope" or "Not visible". */
  visibility: string;
  citations: Citation[];
};

/* Sources shared by many entries. */

export const IAU_TABLE: Citation = {
  author: "Wikipedia contributors",
  year: "2026",
  title: "IAU designated constellations (revision 1373165890)",
  site: "Wikipedia",
  url: "https://en.wikipedia.org/w/index.php?title=IAU_designated_constellations&oldid=1373165890",
  accessed: "2026-09-15",
};

export const IMO_2026: Citation = {
  author: "Rendtel, J. (Ed.)",
  year: "2025",
  title: "2026 meteor shower calendar (IMO INFO(3-25))",
  site: "International Meteor Organization, via the Internet Archive",
  url: "https://web.archive.org/web/20260905025331id_/https://www.imo.net/files/meteor-shower/cal2026.pdf",
  accessed: "2026-09-15",
};

export const HORIZONS: Citation = {
  author: "NASA Jet Propulsion Laboratory",
  year: "n.d.",
  title: "Horizons system",
  site: "JPL Solar System Dynamics",
  url: "https://ssd.jpl.nasa.gov/horizons/",
  accessed: "2026-09-15",
};

export const CELESTRAK_ISS: Citation = {
  author: "Kelso, T. S.",
  year: "n.d.",
  title: "ISS (ZARYA), NORAD 25544, two-line element set",
  site: "CelesTrak",
  url: "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE",
  accessed: "2026-09-15",
};

/** Ian Ridpath's Star Tales page for one constellation (http only: the site has no TLS). */
function starTales(slug: string, title: string, accessed: string): Citation {
  return {
    author: "Ridpath, I.",
    year: "n.d.",
    title,
    site: "Star Tales",
    url: `http://www.ianridpath.com/startales/${slug}.html`,
    accessed,
  };
}

/** A NASA Hubble Messier Catalog page. */
function hubbleMessier(n: number, title: string, accessed: string): Citation {
  return {
    author: "NASA Science",
    year: "n.d.",
    title,
    site: "NASA Hubble Messier Catalog",
    url: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-${n}/`,
    accessed,
  };
}

export const SKY_FACTS: readonly SkyFact[] = [
  /* ---- deep-sky objects and landmarks ---- */
  {
    id: "m31",
    kind: "Spiral galaxy · 2.5 million light-years",
    oneLiner: "The nearest major galaxy to the Milky Way",
    body: [
      "The first known report of it is in al-Sufi’s Book of Fixed Stars, from the year 964.",
      "We see its disk almost edge-on, tilted 77 degrees from our line of sight.",
    ],
    visibility: "Naked eye, even with moderate light pollution; best in November",
    citations: [hubbleMessier(31, "Messier 31 (The Andromeda Galaxy)", "2026-09-15")],
  },

  /* ---- constellations ---- */
  {
    id: "UMa",
    kind: "Constellation · the third largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The seven stars of the Plough, or Big Dipper, are only the bear’s rump and tail; the rest of the animal is fainter.",
      "Homer’s Odyssey has the bear that “circles opposite Orion, and never bathes in the sea”, a way of saying it never sets.",
    ],
    visibility: "Naked eye",
    citations: [starTales("ursamajor", "Ursa Major", "2026-09-15"), IAU_TABLE],
  },
];
```

Both examples were checked against their sources on 2026-09-15 (NASA's M31 page: "2.5 million light-years", al-Sufi's book "from the year 964 contains the first known report", "tilted by 77 degrees", "can be seen with the naked eye, even in areas with moderate light pollution", "best observed in November"; Star Tales' Ursa Major page: "third-largest constellation", "One of the 48 Greek constellations listed by Ptolemy", the seven stars "form the rump and tail of the bear", Homer's "circles opposite Orion, and never bathes in the sea", "a reference to its circumpolar (non-setting) nature"). Read both pages yourself before writing the next entry: they are the calibration for everything after.

Run: `SKY_FACTS_PARTIAL=1 node --test scripts/test-sky-facts.mjs && node scripts/check-voice.mjs`
Expected: 5 tests pass with `# partial run: 2 of 138 facts written`; the gate passes, scanning `12 in content/sky-facts.ts`.

Commit the harness (the full, non-partial test is expected to fail until Step 14; the message says so):

```bash
git add content/sky-facts.ts scripts/test-sky-facts.mjs scripts/check-voice.mjs
git commit -m "sky facts: schema, shared sources, coverage test, voice gate (2 of 138 written; test passes with SKY_FACTS_PARTIAL=1 until complete)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Read the rules before writing any entry**

1. **Voice.** Fetch https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing and read it end to end (the owner's standing instruction; it supersets CLAUDE.md's lists). Then CLAUDE.md's Voice section. Concretely for cards: say the surprising, specific thing plainly; one fact per sentence; no "fascinating", "stunning", "home to", "serves as", "stands as", "boasts", "rich history", "nestled", "a reminder that"; no rule-of-three lists; no closing summary sentence; no rhetorical questions; no em dashes, no en-dash connectors. Cards are not in the site's first person (they describe the sky, not the owner); plain third person. Sentence case.
2. **Accuracy.** Every number (digits, and number words like "third" that encode a number) in `kind`, `oneLiner`, `body` or `visibility` appears in one of that entry's cited sources. Every claim is in a cited source. A quote is verbatim, inside “curly quotes”, from a cited source; if a verbatim quote would trip the voice gate (an em dash, a banned word), paraphrase instead. Paraphrase changes words, never facts, units or hedges ("suspected" stays "suspected"). When two sources disagree on a number, use neither number, or cite the one you use and say "about". Never use a source you did not open.
3. **Fields.**
   - `kind`: a category, then optionally ` · ` and one headline number or attribute. Constellations start with `Constellation`; showers start with `Meteor shower`. At most 60 characters. Examples: `Spiral galaxy · 2.5 million light-years`, `Planet · fourth from the Sun`, `Constellation · the third largest`, `Meteor shower · radiant in Perseus`.
   - `oneLiner`: the desk hover line, a label (no closing period), at most 64 characters.
   - `body`: one to three sentences, each ending in `.`, `!` or `?` (optionally followed by a closing quote).
   - `visibility`: starts with exactly one of `Naked eye`, `Binoculars`, `Telescope`, `Not visible`, then optional detail after a comma or semicolon. Voyager 1, Voyager 2 and the Hubble Deep Field start with `Not visible` (a direction only, spec §4). Say how, not when, unless the source says when.
   - `citations`: one or more; `author` in APA form (`Ridpath, I.`, or an organisation such as `NASA Science`), `year` four digits or `n.d.`, `title` as the page titles itself, `site`, `url` (http or https; Star Tales is http only), `accessed` the ISO date you actually read it. Reuse `IAU_TABLE`, `IMO_2026`, `HORIZONS`, `CELESTRAK_ISS`, `starTales(slug, title, accessed)`, `hubbleMessier(n, title, accessed)`; add another helper only for a source used five or more times.
4. **Constellation one-liners** state the origin from `objects.json` `constellations[abbr]`, and the test cross-checks them. Use these shapes (pick the words; keep the facts):
   - ancient and `year` null: name Ptolemy, e.g. `One of the 48 constellations in Ptolemy’s Almagest` (cite Star Tales for "48").
   - ancient with a year and `splitFrom` (Car, Pup, Vel): e.g. `Split from Argo Navis by Lacaille in 1756`.
   - `Com` (ancient, 1536, Caspar Vopel, split from Leo): e.g. `Split from Leo by Caspar Vopel in 1536`.
   - not ancient: the first originator and the year, plus `splitFrom` when present, e.g. `Introduced by Lacaille in 1756`, `Introduced by Plancius, Keyser and de Houtman in 1598`, `Split from Centaurus by Plancius in 1589`, `Introduced by Hevelius in 1690`.
   Every constellation cites `IAU_TABLE`. These 30 carry a mythology sentence and cite their Star Tales page: `And Aql Aqr Ari Aur Boo Cnc CMa Cap Cas Cen Cep Cet CrB Cyg Dra Gem Her Hya Leo Lyr Oph Ori Peg Per Sco Sgr Tau UMa Vir`. The other 58 carry what the constellation depicts, its brightest or best-known feature, or its history, still sourced (Star Tales covers all 88: `http://www.ianridpath.com/startales/<name>.html`, lowercase Latin name without spaces, e.g. `canesvenatici.html`; open the Star Tales contents page http://www.ianridpath.com/startales/contents.html to confirm each slug).
5. **Where to look, per kind** (open the page; if one is unreachable, find an equally authoritative page and cite that instead):
   - Messier objects: `hubbleMessier(n, …)` pages, `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-<n>/` (all ten resolved on 2026-09-15). M87 must also cover its black hole (the test requires "black hole" in its body): the Event Horizon Telescope's April 10, 2019 release (https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole; it answers bots with 403, so read it in a browser or with WebFetch) or NASA's coverage of the same result.
   - Galactic core (`sgr-a-star`): the EHT's May 12, 2022 Sagittarius A* release (https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy) or ESO/NASA pages on Sagittarius A*.
   - Kepler field: NASA's Kepler mission pages (https://science.nasa.gov/mission/kepler/); the card must not contradict the label "approximate outline".
   - Hubble Deep Field: ESA/Hubble (https://esahubble.org/images/opo9601c/) or STScI.
   - Voyager 1 and 2: https://science.nasa.gov/mission/voyager/voyager-1/ and …/voyager-2/, plus `HORIZONS` (the test requires both). Do not state a distance in prose: the card prints the dated Horizons distance from `objects.json` itself.
   - The 15 stars: an authoritative page per star (NASA, ESA, ESO, or a Wikipedia article pinned to a revision with `&oldid=` in the URL and the revision's year).
   - Planets and the Moon: NASA Science facts pages `https://science.nasa.gov/<planet>/facts/` and `https://science.nasa.gov/moon/facts/` (the test requires a `science.nasa.gov` citation): where the name comes from, plus one fact each (spec §7).
   - ISS: NASA (https://www.nasa.gov/international-space-station/) plus `CELESTRAK_ISS` (the test requires CelesTrak). Do not state altitude or speed in prose: the card prints them live from the TLE.
   - Milky Way: a NASA Science page on the Milky Way.
   - Showers: `IMO_2026` (required by the test) plus the NASA shower page where one exists (`https://science.nasa.gov/solar-system/meteors-meteorites/<name>/`). Do not restate the window, peak, ZHR or parent in prose: the card prints them from `objects.json`. Say something else true: what the parent body is, why the rate varies, the radiant's constellation.

- [ ] **Step 5: Batch A, deep-sky objects and landmarks (12 entries)**

Write `m1 m8 m13 m42 m44 m45 m51 m57 m87 sgr-a-star kepler-field hubble-deep-field` under the `/* ---- deep-sky objects and landmarks ---- */` comment, after `m31`.
Run: `SKY_FACTS_PARTIAL=1 node --test scripts/test-sky-facts.mjs && node scripts/check-voice.mjs`
Expected: 5 pass (`14 of 138`), gate passes. Then commit:

```bash
git add content/sky-facts.ts
git commit -m "sky facts: deep-sky objects and landmarks

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Batch B, spacecraft and named stars (17 entries)**

Add a `/* ---- spacecraft and named stars ---- */` section: `voyager-1 voyager-2 polaris sirius arcturus vega capella rigel procyon betelgeuse altair aldebaran antares spica pollux deneb regulus`.
Run the same two commands. Expected: 5 pass (`31 of 138`). Commit with message `sky facts: Voyagers and the named stars`.

- [ ] **Step 7: Batch C, planets, Moon, ISS, Milky Way (8 entries)**

Add `/* ---- solar system, the ISS, the Milky Way ---- */`: `mercury venus mars jupiter saturn moon iss milky-way`.
Run the same two commands. Expected: 5 pass (`39 of 138`). Commit: `sky facts: planets, the Moon, the ISS, the Milky Way`.

- [ ] **Step 8: Batch D, meteor showers (12 entries)**

Add `/* ---- meteor showers ---- */`: `quadrantids lyrids eta-aquariids southern-delta-aquariids perseids draconids southern-taurids orionids northern-taurids leonids geminids ursids`.
Run the same two commands. Expected: 5 pass (`51 of 138`). Commit: `sky facts: meteor showers`.

- [ ] **Step 9: Batch E, mythology constellations, first half (15 entries)**

Under `/* ---- constellations ---- */`, after `UMa`: `And Aql Aqr Ari Aur Boo Cnc CMa Cap Cas Cen Cep Cet CrB Cyg`.
Run the same two commands. Expected: 5 pass (`66 of 138`). Commit: `sky facts: constellations with mythology, And to Cyg`.

- [ ] **Step 10: Batch F, mythology constellations, second half (14 entries)**

`Dra Gem Her Hya Leo Lyr Oph Ori Peg Per Sco Sgr Tau Vir` (UMa is already written).
Run the same two commands. Expected: 5 pass (`80 of 138`). Commit: `sky facts: constellations with mythology, Dra to Vir`.

- [ ] **Step 11: Batch G, the other constellations, 1 of 3 (20 entries)**

`Ant Aps Ara Cae Cam CVn CMi Car Cha Cir Col Com CrA Crv Crt Cru Del Dor Equ Eri`
Run the same two commands. Expected: 5 pass (`100 of 138`). Commit: `sky facts: constellations, Ant to Eri`.

- [ ] **Step 12: Batch H, the other constellations, 2 of 3 (20 entries)**

`For Gru Hor Hyi Ind Lac LMi Lep Lib Lup Lyn Men Mic Mon Mus Nor Oct Pav Phe Pic`
Run the same two commands. Expected: 5 pass (`120 of 138`). Commit: `sky facts: constellations, For to Pic`.

- [ ] **Step 13: Batch I, the other constellations, 3 of 3 (18 entries)**

`Psc PsA Pup Pyx Ret Sge Scl Sct Ser Sex Tel Tri TrA Tuc UMi Vel Vol Vul`
Run the same two commands. Expected: 5 pass (`138 of 138`). Commit: `sky facts: constellations, Psc to Vul`.

- [ ] **Step 14: The full test, without the partial flag**

Run: `node --test scripts/test-sky-facts.mjs && node scripts/check-voice.mjs`
Expected: 5 tests pass (coverage exactly 138, every constellation one-liner agrees with the origin table, every required source present); the gate passes.

- [ ] **Step 15: Self-audit against the sources**

Save this script in your session scratchpad (not the repo) as `audit-sky-facts.mjs`:

```js
// Hand-run self-audit for content/sky-facts.ts (plan Task 3). Not committed.
//   node audit-sky-facts.mjs /path/to/worktree [every=5]
// For a deterministic sample of facts (every Nth id, plus every shower, planet
// and spacecraft), fetches each citation and reports, per fact:
//   - numbers in kind/oneLiner/body/visibility found in NO cited source
//   - quoted passages (“…”) found verbatim in NO cited source
//   - citations that did not fetch (403/429 pages must then be read by hand)
// A report line is a question to answer by reading, not proof of an error:
// "2.5 million" can appear as "2,500,000". Every line gets resolved.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const every = Number(process.argv[3] ?? 5);
const { SKY_FACTS } = await import(path.join(root, "content/sky-facts.ts"));

const ALWAYS = /^(quadrantids|lyrids|eta-aquariids|southern-delta-aquariids|perseids|draconids|southern-taurids|orionids|northern-taurids|leonids|geminids|ursids|mercury|venus|mars|jupiter|saturn|moon|iss|voyager-1|voyager-2|m87|sgr-a-star)$/;
const sample = SKY_FACTS.filter((f, i) => i % every === 0 || ALWAYS.test(f.id));
const pages = new Map();
const dir = mkdtempSync(path.join(tmpdir(), "sky-audit-"));

const norm = (s) =>
  s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#8217;|&rsquo;|’|‘/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|“|”/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/\s+/g, " ")
    .toLowerCase();

async function text(url) {
  if (pages.has(url)) return pages.get(url);
  let out = null;
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (sky-facts audit)" }, redirect: "follow" });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (url.endsWith(".pdf") || (res.headers.get("content-type") ?? "").includes("pdf")) {
        const f = path.join(dir, `p${pages.size}.pdf`);
        writeFileSync(f, buf);
        out = execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
      } else {
        out = buf
          .toString("utf8")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ");
      }
      out = norm(out);
    } else {
      out = `__HTTP_${res.status}`;
    }
  } catch (err) {
    out = `__ERR_${err.message}`;
  }
  pages.set(url, out);
  await new Promise((r) => setTimeout(r, 400));
  return out;
}

let questions = 0;
for (const f of sample) {
  const texts = [];
  const unread = [];
  for (const c of f.citations) {
    const t = await text(c.url);
    if (t.startsWith("__")) unread.push(`${c.url} (${t.slice(2)})`);
    else texts.push(t);
  }
  const prose = [f.kind, f.oneLiner, ...f.body, f.visibility].join(" ");
  const numbers = [...new Set(norm(prose).match(/\d+(?:\.\d+)?/g) ?? [])];
  const missingNumbers = numbers.filter((n) => !texts.some((t) => new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(t)));
  const quotes = [...prose.matchAll(/“([^”]+)”/g)].map((m) => m[1]);
  const missingQuotes = quotes.filter((q) => !texts.some((t) => t.includes(norm(q))));
  if (missingNumbers.length || missingQuotes.length || unread.length) {
    questions += missingNumbers.length + missingQuotes.length + unread.length;
    console.log(`\n${f.id}`);
    if (missingNumbers.length) console.log(`  numbers not found in any cited source: ${missingNumbers.join(", ")}`);
    for (const q of missingQuotes) console.log(`  quote not found verbatim: “${q}”`);
    for (const u of unread) console.log(`  could not read: ${u}`);
  }
}
console.log(`\naudited ${sample.length} of ${SKY_FACTS.length} facts; ${questions} question(s) to resolve by reading`);
```

Run: `node <scratchpad>/audit-sky-facts.mjs /home/neelayranjan/Documents/portfolio-night-sky 5`
It samples every fifth fact plus every shower, planet, the Moon, the ISS, both Voyagers, M87 and the galactic core (about 50 facts), fetches every citation, and prints each number or quote it could not find in any cited source, and each citation it could not read. Resolve every line by reading: open the page (in a browser or with WebFetch for 403/429 pages), find the number; if it is there in another form (`2,500,000` for `2.5 million`), move on; if it is not there, fix the entry (change the number to the source's, cite the page that has it, or remove the claim). Re-run until every remaining line is one you have confirmed by reading, and list those in the task report with the page and the wording that confirms each. Then pick five constellations and five non-constellation facts outside the sample and read their sources end to end the same way.

- [ ] **Step 16: Commit the audit fixes**

```bash
node --test scripts/test-sky-facts.mjs && node scripts/check-voice.mjs
git add content/sky-facts.ts
git commit -m "sky facts: audited against their sources

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 4: Draw the new layers; desk one-liners

**Files:**
- Create: `lib/sky-objects.ts`, `lib/sky-layers.ts`
- Replace: `lib/sky-render.ts`
- Modify: `components/manuscript/NightSky.tsx`, `scripts/test-sky-objects.mjs`, `scripts/verify-redesign.mjs`

**Interfaces:**
- Consumes: `public/sky/objects.json`, `public/sky/milkyway.json` (Task 2); `SKY_FACTS`, `SkyFact` from `content/sky-facts.ts` (Task 3); `chartFor(…, offset)`, `Point` (Task 1).
- Produces (`lib/sky-objects.ts`, no imports):
  ```ts
  export type ObjectSymbol = "galaxy" | "nebula" | "cluster" | "core" | "field" | "square" | "chevron" | "star";
  export type SkyObject; export type SkyShower; export type ConstellationOrigin; // shapes as objects.json (Task 2)
  export type SkyObjectsData; export type MilkyWayData;
  export type PreparedRing = Float64Array;               // [raRad, tan((90°-dec)/2), …]
  export type PreparedMilkyWay = { levels: PreparedRing[][]; labels: [number, number][] };
  export const OBJECTS_URL = "/sky/objects.json";
  export const MILKYWAY_URL = "/sky/milkyway.json";
  export const loadObjects: () => Promise<SkyObjectsData | null>;
  export const loadMilkyWay: () => Promise<MilkyWayData | null>;
  export function prepareMilkyWay(mw: MilkyWayData): PreparedMilkyWay;
  export function smallCircle(raDeg: number, decDeg: number, radiusDeg: number, n?: number): [number, number][];
  export function isShowerActive(s: SkyShower, ms: number): boolean;
  ```
- Produces (`lib/sky-layers.ts`):
  ```ts
  export type Hit = { id: string; name: string; x: number; y: number };
  export type View = { chart: Chart; width: number; height: number; fontFamily: string; names: boolean };
  export const MILKY_WAY_ALPHA = 0.022;
  export function drawMilkyWay(ctx, v: View, mw: PreparedMilkyWay): Hit | null;
  export function drawObjects(ctx, v: View, objects: SkyObject[], rings: ReadonlyMap<string, [number, number][]>): Hit[];
  export function drawRadiants(ctx, v: View, active: SkyShower[]): Hit[];
  ```
- Produces (`lib/sky-render.ts`):
  ```ts
  export type LabelText = { title: string; english: string | null; sub: string | null };
  export type Projected = { segments: Map<string, Segment[]>; hits: Hit[]; label: LabelBox | null; labelText: LabelText | null };
  export type Highlight = { kind: "constellation" | "hit"; id: string; pointer: Point }; // replaces { abbr, pointer }
  export type FrameInput = { …existing, milkyWay, objects, objectRings, showers, names, oneLiner, selectedId };
  export function drawSky(ctx, sky: SkyData, f: FrameInput): Projected;
  export function nearestConstellation(p: Projected, x: number, y: number, maxPx: number): string | null;
  export function nearestHit(p: Projected, x: number, y: number, maxPx: number): Hit | null;
  ```
  Hit ids: object ids, lowercase planet names, `moon`, shower ids, `milky-way` (and `iss`, Task 6).
- Produces (`window.__sky`, added): `labelText`, `hits: {id, x, y}[]`, `radiants: string[]` (active shower ids), `layers: { objects, milkyWay, facts }` each `"loading" | "ready" | "absent" | "error"`; `highlight` is now the highlighted id (a constellation abbreviation or a hit id).
- Produces (`scripts/verify-redesign.mjs`): `M31`, `SGR_A_STAR`, `PERSEID_RADIANT`, `SIDEREAL_DAY_MS`, `lstAt(date)`, `findInstant(from, W, H, body, margin)`, `pinnedSkyPage(browser, { W, H, date, blockObjects }, fn)`; `SKY_FACTS` imported.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test-sky-objects.mjs`:

```js
// ---- lib/sky-objects.ts helpers (added with the renderer, Task 4) ----
const O = await import("../lib/sky-objects.ts");

test("isShowerActive: inclusive windows, and windows that wrap the new year", () => {
  const per = data.showers.find((s) => s.id === "perseids"); // 07-17 .. 08-24
  const qua = data.showers.find((s) => s.id === "quadrantids"); // 12-28 .. 01-12
  const at = (y, m, d, h = 12) => Date.UTC(y, m - 1, d, h);
  assert.equal(O.isShowerActive(per, at(2026, 7, 16, 23)), false);
  assert.equal(O.isShowerActive(per, at(2026, 7, 17, 0)), true);
  assert.equal(O.isShowerActive(per, at(2026, 8, 24, 23)), true);
  assert.equal(O.isShowerActive(per, at(2026, 8, 25, 0)), false);
  assert.equal(O.isShowerActive(qua, at(2026, 12, 31)), true);
  assert.equal(O.isShowerActive(qua, at(2027, 1, 12)), true);
  assert.equal(O.isShowerActive(qua, at(2027, 1, 13)), false);
  assert.equal(O.isShowerActive(qua, at(2026, 12, 27)), false);
});

test("smallCircle: every point at the requested angular radius", () => {
  const D2R = Math.PI / 180;
  const kepler = byId.get("kepler-field");
  const ring = O.smallCircle(kepler.raDeg, kepler.decDeg, kepler.radiusDeg);
  assert.equal(ring.length, 48);
  for (const [ra, dec] of ring) {
    const c =
      Math.sin(dec * D2R) * Math.sin(kepler.decDeg * D2R) +
      Math.cos(dec * D2R) * Math.cos(kepler.decDeg * D2R) * Math.cos((ra - kepler.raDeg) * D2R);
    const sep = Math.acos(Math.min(1, c)) / D2R;
    assert.ok(Math.abs(sep - kepler.radiusDeg) < 1e-9, `point at ${sep}°`);
    assert.ok(ra >= 0 && ra < 360);
  }
});

test("prepareMilkyWay: RA in radians and tan of half the colatitude, per vertex", () => {
  const prepared = O.prepareMilkyWay(mw);
  const [ra, dec] = mw.levels[0][0][0];
  const flat = prepared.levels[0][0];
  assert.equal(flat.length, mw.levels[0][0].length * 2);
  assert.ok(Math.abs(flat[0] - (ra * Math.PI) / 180) < 1e-12);
  assert.ok(Math.abs(flat[1] - Math.tan(((90 - dec) / 2) * (Math.PI / 180))) < 1e-12);
});
```

In `scripts/verify-redesign.mjs`:

1. Replace

```js
import * as Astronomy from "astronomy-engine";
```

with

```js
import * as Astronomy from "astronomy-engine";
import { SKY_FACTS } from "../content/sky-facts.ts";
```

2. In `skyAnimatesAt1280`, replace

```js
    if (a === b) throw new Error("two samples 1.5s apart are byte-identical (the sky is not turning)");
    const ms = await page.evaluate(() => window.__sky.frameMsMedian);
    return `samples differ; median frame draw ${ms?.toFixed(2)}ms (a headless Firefox number, not a device number)`;
```

with

```js
    if (a === b) throw new Error("two samples 1.5s apart are byte-identical (the sky is not turning)");
    // Spec 2026-09-15 §10: with every layer loaded, the median frame draw may
    // not exceed twice the 2.96 ms measured before the objects layers existed.
    // The median covers the last 60 frames, so wait for 60 frames (~3 s at
    // 20 fps) of the full sky before reading it.
    await page.waitForFunction(
      () => window.__sky.layers.objects === "ready" && window.__sky.layers.milkyWay === "ready",
      null,
      { timeout: 10000 },
    );
    await page.waitForTimeout(3200); // elapsed frames are the point: the median must be all full-sky frames
    const ms = await page.evaluate(() => window.__sky.frameMsMedian);
    const BUDGET_MS = 2 * 2.96;
    if (!(ms <= BUDGET_MS)) throw new Error(`median frame draw ${ms?.toFixed(2)}ms exceeds ${BUDGET_MS}ms (2x the pre-objects 2.96ms)`);
    return `samples differ; median frame draw ${ms.toFixed(2)}ms with every layer, budget ${BUDGET_MS}ms (a headless Firefox number, not a device number)`;
```

3. In `checkSkyHover`, replace

```js
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const target = await page.evaluate(() => {
```

with

```js
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      await page.waitForFunction(
        () => window.__sky.layers.objects === "ready" && window.__sky.layers.facts === "ready",
        null,
        { timeout: 10000 },
      );
      const target = await page.evaluate(() => {
```

then replace

```js
        for (const abbr of abbrs) {
          for (const [x1, y1, x2, y2] of window.__sky.segmentsFor(abbr)) {
            const x = (x1 + x2) / 2;
            const y = (y1 + y2) / 2;
            if (Math.hypot(x2 - x1, y2 - y1) > 30 && inMargin(x, y)) return { abbr, x, y, x1, y1, x2, y2 };
```

with

```js
        // Symbols win over lines within 12px (spec 2026-09-15 §5), so a
        // midpoint near any drawn object, star name, planet or radiant is
        // not a line hover.
        const clearOfHits = (x, y) => window.__sky.hits.every((h) => Math.hypot(h.x - x, h.y - y) > 20);
        for (const abbr of abbrs) {
          for (const [x1, y1, x2, y2] of window.__sky.segmentsFor(abbr)) {
            const x = (x1 + x2) / 2;
            const y = (y1 + y2) / 2;
            if (Math.hypot(x2 - x1, y2 - y1) > 30 && inMargin(x, y) && clearOfHits(x, y)) return { abbr, x, y, x1, y1, x2, y2 };
```

then replace

```js
      if (!label) throw new Error(`${target.abbr} highlighted but window.__sky.label is null`);
```

with

```js
      if (!label) throw new Error(`${target.abbr} highlighted but window.__sky.label is null`);
      const text = await page.evaluate(() => window.__sky.labelText);
      const oneLiner = SKY_FACTS.find((f) => f.id === target.abbr)?.oneLiner;
      if (!oneLiner || text?.sub !== oneLiner) {
        throw new Error(`${target.abbr} label's second line is ${JSON.stringify(text?.sub)}, expected the fact's one-liner ${JSON.stringify(oneLiner)}`);
      }
```

(The existing assertions that the label box is on screen and clear of the sheet now cover the wrapped one-liner too.)

3b. In `skyStaticUnderReducedMotion`, both samples must come after every layer has settled: the objects, the Milky Way and the facts chunk now land after the catalog (and the ISS in Task 6), and a late layer would repaint between the samples. Replace

```js
      await waitSkyDrawn(page);
      const canvas = page.locator(SKY_CANVAS);
```

with

```js
      await waitSkyDrawn(page);
      await page.waitForFunction(
        () => Object.values(window.__sky.layers).every((state) => state !== "loading"),
        null,
        { timeout: 10000 },
      );
      const canvas = page.locator(SKY_CANVAS);
```

4. Immediately above the `dragBy` helper's doc comment (the line starting `/** Press at (x, y), move by (dx, dy)`, added in Task 1), insert:

```js
const M31 = { raDeg: 10.6751, decDeg: 41.2667 }; // objects.json, from d3-celestial
const SGR_A_STAR = { raDeg: 266.41683, decDeg: -29.00781 }; // spec §4: 17h45m40.04s, -29°00'28.1"
const PERSEID_RADIANT = { raDeg: 48, decDeg: 58 }; // IMO 2026 Table 5
/** A mean sidereal day: 40 of them later, the chart has the same orientation to 0.001°. */
const SIDEREAL_DAY_MS = 86_164_090.5;

const lstAt = (date) => (((Astronomy.SiderealTime(date) * 15 + MOFFETT_LON) % 360) + 360) % 360;

/** The first instant from `from`, in 10-minute steps over two days, where `body` lands `margin` px inside W x H. */
function findInstant(from, W, H, body, margin) {
  for (let i = 0; i < 288; i++) {
    const date = new Date(from.getTime() + i * 600_000);
    const lst = lstAt(date);
    const p = specProject(W, H, lst, body.raDeg, body.decDeg);
    if (p.x > margin && p.x < W - margin && p.y > margin && p.y < H - margin) return { date, lst, p };
  }
  throw new Error(`nothing lands ${margin}px inside ${W}x${H} in the two days from ${from.toISOString()}`);
}

/** A reduced-motion page pinned to `date`, with the sky and (unless `blockObjects`) its objects layer loaded. */
async function pinnedSkyPage(browser, { W, H, date, blockObjects = false }, fn) {
  return withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    if (blockObjects) await context.route("**/sky/objects.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(
      (blocked) =>
        window.__sky.layers.objects === (blocked ? "absent" : "ready") && window.__sky.layers.milkyWay === "ready",
      blockObjects,
      { timeout: 10000 },
    );
    return fn(page);
  });
}

async function checkSkyObjects(browser) {
  const W = 1600;
  const H = 1000;
  const notes = [];

  // Andromeda and the galactic core, each at an instant it is well on screen:
  // its computed position holds pixels with objects.json served, and holds
  // clearly fewer with objects.json 404ing (which must still draw the sky).
  for (const [id, body, radius] of [["m31", M31, 6], ["sgr-a-star", SGR_A_STAR, 7]]) {
    const { date, lst, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, body, 60);
    const withObjects = await pinnedSkyPage(browser, { W, H, date }, async (page) => {
      const hit = await page.evaluate((id) => window.__sky.hits.find((h) => h.id === id) ?? null, id);
      if (!hit) throw new Error(`${id} is not among the drawn hits at ${date.toISOString()}`);
      if (Math.hypot(hit.x - p.x, hit.y - p.y) > 1.5) {
        throw new Error(`${id} drawn at (${hit.x.toFixed(1)}, ${hit.y.toFixed(1)}), spec projection says (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
      }
      return skyPeak(page, p.x, p.y, radius);
    });
    const without = await pinnedSkyPage(browser, { W, H, date, blockObjects: true }, async (page) => {
      const hits = await page.evaluate(() => window.__sky.hits.map((h) => h.id));
      if (hits.includes(id)) throw new Error(`${id} drawn although objects.json 404'd`);
      return skyPeak(page, p.x, p.y, radius);
    });
    if (withObjects - without < 40) {
      throw new Error(`${id} at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}), LST ${lst.toFixed(2)}°: peak ${withObjects} with objects, ${without} without`);
    }
    notes.push(`${id} peak ${without} -> ${withObjects}`);
  }

  // The Perseid radiant: drawn on 2026-08-12 (inside Jul 17..Aug 24), not 40
  // sidereal days later (outside), at the same chart orientation.
  const inside = findInstant(new Date(Date.UTC(2026, 7, 12)), W, H, PERSEID_RADIANT, 80);
  const outsideDate = new Date(inside.date.getTime() + 40 * SIDEREAL_DAY_MS);
  const radiantAt = (date) =>
    pinnedSkyPage(browser, { W, H, date }, async (page) => {
      const snap = await page.evaluate(() => ({ radiants: window.__sky.radiants, hits: window.__sky.hits }));
      const crowd = snap.hits.filter((h) => h.id !== "perseids" && Math.hypot(h.x - inside.p.x, h.y - inside.p.y) < 20);
      if (crowd.length) throw new Error(`${crowd.map((h) => h.id)} sit on the radiant at ${date.toISOString()}; pick another start`);
      return { radiants: snap.radiants, peak: await skyPeak(page, inside.p.x, inside.p.y, 7) };
    });
  const on = await radiantAt(inside.date);
  const off = await radiantAt(outsideDate);
  if (!on.radiants.includes("perseids")) throw new Error(`Perseids not active on ${inside.date.toISOString()}: ${on.radiants}`);
  if (off.radiants.includes("perseids")) throw new Error(`Perseids still active on ${outsideDate.toISOString()}`);
  if (on.peak - off.peak < 40) throw new Error(`radiant peak ${on.peak} inside the window vs ${off.peak} outside`);
  notes.push(`Perseid radiant ${off.peak} (${outsideDate.toISOString().slice(0, 10)}) -> ${on.peak} (${inside.date.toISOString().slice(0, 10)})`);

  // Desk one-liner (spec §5): hover a symbol in the desk margin, get its name and its fact's one-liner.
  const hovered = await pinnedSkyPage(browser, { W, H, date: inside.date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    const target = await page.evaluate(() => {
      const sheet = document.querySelector("[data-sheet]").getBoundingClientRect();
      const hits = window.__sky.hits;
      return (
        hits.find(
          (h) =>
            (h.x < sheet.left - 40 || h.x > sheet.right + 40) &&
            h.y > 40 &&
            h.y < window.innerHeight - 40 &&
            hits.every((o) => o === h || Math.hypot(o.x - h.x, o.y - h.y) > 30),
        ) ?? null
      );
    });
    if (!target) throw new Error(`no lone symbol in the desk margin at ${inside.date.toISOString()}`);
    await page.mouse.move(target.x + 2, target.y + 1);
    await page.waitForFunction((id) => window.__sky.highlight === id, target.id, { timeout: 3000 });
    const text = await page.evaluate(() => window.__sky.labelText);
    const oneLiner = SKY_FACTS.find((f) => f.id === target.id)?.oneLiner;
    if (!oneLiner || text?.sub !== oneLiner) throw new Error(`${target.id}: label ${JSON.stringify(text)}, fact one-liner ${JSON.stringify(oneLiner)}`);
    return `${target.id} "${text.title}" / "${text.sub}"`;
  });
  notes.push(`hover ${hovered}`);
  return notes.join("; ");
}
```

5. In `CHECKS`, after `["sky-drag", checkSkyDrag],` add `["sky-objects", checkSkyObjects],`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test scripts/test-sky-objects.mjs`
Expected: FAIL, `Cannot find module '…/lib/sky-objects.ts'`.
Rebuild and restart :3000 (Task 1 Step 7's commands), then run: `node scripts/verify-redesign.mjs sky-animates sky-hover sky-objects`
Expected: all three FAIL (`window.__sky.layers` is undefined).

- [ ] **Step 3: Create `lib/sky-objects.ts`**

```ts
/**
 * Loads the night sky's objects layer data (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §9), both built by
 * the hand-run scripts/prepare-sky-objects.mjs:
 *
 *   /sky/objects.json   deep-sky picks, landmarks, named stars, Voyagers,
 *                       meteor showers, constellation origins (~15 KB)
 *   /sky/milkyway.json  the Milky Way band (~30 KB, ~2,300 vertices)
 *
 * Same gate as lib/sky-data.ts, per layer: absent (a failed fetch, a 404)
 * resolves null and the sky draws without that layer; present and malformed
 * throws, and NightSky logs it. Nothing stands in for a missing layer.
 *
 * Also the per-catalog precomputation spec §10 asks for: every Milky Way
 * vertex's RA in radians and its tan((90° − dec)/2), so a frame only
 * multiplies by k and takes one sin/cos pair per vertex; and the Kepler
 * field's outline as a ring of RA/Dec points.
 */

export type ObjectSymbol = "galaxy" | "nebula" | "cluster" | "core" | "field" | "square" | "chevron" | "star";
export type SkyObject = {
  id: string;
  name: string;
  designation?: string;
  symbol: ObjectSymbol;
  raDeg: number;
  decDeg: number;
  mag?: number;
  axisRatio?: number;
  radiusDeg?: number;
  distanceAu?: number;
  positionDate?: string;
  hip?: number;
};
export type SkyShower = {
  id: string;
  name: string;
  imo: string;
  start: string;
  end: string;
  peak: string;
  solarLongitudeDeg: number;
  radiantRaDeg: number;
  radiantDecDeg: number;
  speedKmS: number;
  zhr: number;
  parent: string;
  parentSource: string;
};
export type ConstellationOrigin = { ancient: boolean; year: number | null; by: string[]; splitFrom: string | null };
export type SkyObjectsData = {
  version: 1;
  epoch: "J2000";
  generated: string;
  source: Record<string, unknown>;
  objects: SkyObject[];
  showers: SkyShower[];
  constellations: Record<string, ConstellationOrigin>;
};
export type MilkyWayData = {
  version: 1;
  epoch: "J2000";
  source: Record<string, unknown>;
  toleranceDeg: number;
  levels: [number, number][][][];
  labels: [number, number][];
};
/** One ring as flat [raRad, tanHalfColat, raRad, tanHalfColat, ...]. */
export type PreparedRing = Float64Array;
export type PreparedMilkyWay = { levels: PreparedRing[][]; labels: [number, number][] };

export const OBJECTS_URL = "/sky/objects.json";
export const MILKYWAY_URL = "/sky/milkyway.json";

const D2R = Math.PI / 180;

function gate<T>(url: string, validate: (body: T) => string | null): () => Promise<T | null> {
  let cache: Promise<T | null> | null = null;
  return () => {
    if (cache) return cache;
    cache = (async () => {
      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        return null;
      }
      if (!res.ok) return null;
      const body = (await res.json()) as T;
      const problem = validate(body);
      if (problem) throw new Error(`${url}: ${problem}`);
      return body;
    })().catch((err) => {
      cache = null;
      throw err;
    });
    return cache;
  };
}

export const loadObjects = gate<SkyObjectsData>(OBJECTS_URL, (d) => {
  if (d?.version !== 1 || d.epoch !== "J2000") return `version ${String(d?.version)} / epoch ${String(d?.epoch)}`;
  if (!Array.isArray(d.objects) || d.objects.length < 1) return "no objects";
  if (!Array.isArray(d.showers)) return "no showers";
  if (Object.keys(d.constellations ?? {}).length !== 88) return "not 88 constellation origins";
  return null;
});

export const loadMilkyWay = gate<MilkyWayData>(MILKYWAY_URL, (d) => {
  if (d?.version !== 1 || d.epoch !== "J2000") return `version ${String(d?.version)} / epoch ${String(d?.epoch)}`;
  if (!Array.isArray(d.levels) || d.levels.length !== 5) return "not 5 levels";
  if (!Array.isArray(d.labels)) return "no label anchors";
  return null;
});

export function prepareMilkyWay(mw: MilkyWayData): PreparedMilkyWay {
  return {
    levels: mw.levels.map((rings) =>
      rings.map((ring) => {
        const out = new Float64Array(ring.length * 2);
        ring.forEach(([ra, dec], i) => {
          out[2 * i] = ra * D2R;
          out[2 * i + 1] = Math.tan(((90 - dec) / 2) * D2R);
        });
        return out;
      }),
    ),
    labels: mw.labels,
  };
}

/** `n` points of the small circle of angular radius `radiusDeg` around (ra, dec), as [ra, dec] degrees. */
export function smallCircle(raDeg: number, decDeg: number, radiusDeg: number, n = 48): [number, number][] {
  const a0 = raDeg * D2R;
  const d0 = decDeg * D2R;
  const r = radiusDeg * D2R;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const b = (i / n) * 2 * Math.PI; // bearing from north through east
    const d = Math.asin(Math.sin(d0) * Math.cos(r) + Math.cos(d0) * Math.sin(r) * Math.cos(b));
    const a = a0 + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(d0), Math.cos(r) - Math.sin(d0) * Math.sin(d));
    out.push([(((a / D2R) % 360) + 360) % 360, d / D2R]);
  }
  return out;
}

/** "MM-DD" as a sortable number. */
const mdNumber = (md: string) => Number(md.slice(0, 2)) * 100 + Number(md.slice(3));

/** Is the simulated UTC date inside the shower's active window? Windows can wrap the new year. */
export function isShowerActive(s: SkyShower, ms: number): boolean {
  const d = new Date(ms);
  const today = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const start = mdNumber(s.start);
  const end = mdNumber(s.end);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}
```

- [ ] **Step 4: Create `lib/sky-layers.ts`**

```ts
/**
 * The night sky's objects layers (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §4): the Milky Way
 * band, the deep-sky and landmark symbols, the named stars' names, the Voyager
 * chevrons and the active meteor-shower radiants. Pure drawing, called by
 * lib/sky-render.ts drawSky in the spec's back-to-front order; every function
 * returns the Hits it drew so NightSky can hit-test exactly what is on screen.
 *
 * Colours are the site tokens: ink and mut at low alpha for natural things,
 * warm for human-made things and radiants, matching the planets. No red.
 *
 * Proper nouns ("Milky Way") are rendered straight from data or literals, the
 * way sky-render.ts renders planet names; they are names, not prose.
 */
import type { PreparedMilkyWay, SkyObject, SkyShower } from "./sky-objects";
import { project, type Chart } from "./sky-math";

/** A selectable thing as drawn this frame, CSS px. `name` is its label. */
export type Hit = { id: string; name: string; x: number; y: number };

const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
const D2R = Math.PI / 180;
/** Each level adds this much ink; five nested levels build the band's core. Tuned by eye (Task 4 Step 9). */
export const MILKY_WAY_ALPHA = 0.022;

/** What every layer needs to know about the frame. */
export type View = { chart: Chart; width: number; height: number; fontFamily: string; names: boolean };
const onCanvas = (p: { x: number; y: number }, v: View, m: number) =>
  p.x > -m && p.x < v.width + m && p.y > -m && p.y < v.height + m;

export function drawMilkyWay(ctx: CanvasRenderingContext2D, v: View, mw: PreparedMilkyWay): Hit | null {
  const c = v.chart;
  const lst = c.lstDeg * D2R;
  ctx.fillStyle = `rgba(${INK},${MILKY_WAY_ALPHA})`;
  for (const rings of mw.levels) {
    ctx.beginPath();
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const rho = c.k * ring[i + 1];
        const phi = ring[i] - lst;
        const x = c.cx + rho * Math.sin(phi);
        const y = c.cy - rho * Math.cos(phi);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    // Rings nest (the band's two edges, dark lanes, bright clouds): even-odd
    // fills exactly the area between them.
    ctx.fill("evenodd");
  }
  // One "Milky Way" label: the on-canvas anchor closest to the pole, which is
  // the most stable choice as the sky turns.
  let best: { x: number; y: number } | null = null;
  let bestRho = Infinity;
  for (const [ra, dec] of mw.labels) {
    const p = project(c, ra, dec);
    const rho = Math.hypot(p.x - c.cx, p.y - c.cy);
    if (onCanvas(p, v, -40) && rho < bestRho) {
      best = p;
      bestRho = rho;
    }
  }
  if (!best) return null;
  ctx.font = `9px ${v.fontFamily}`;
  ctx.fillStyle = `rgba(${MUT},0.5)`;
  ctx.fillText("Milky Way", best.x, best.y);
  return { id: "milky-way", name: "Milky Way", x: best.x, y: best.y };
}

/**
 * Deep-sky symbols, landmarks, Voyagers and the named stars' names. `rings`
 * holds precomputed small-circle outlines by object id (the Kepler field).
 * `names` false (below 880px) draws symbols only.
 */
export function drawObjects(
  ctx: CanvasRenderingContext2D,
  v: View,
  objects: SkyObject[],
  rings: ReadonlyMap<string, [number, number][]>,
): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const o of objects) {
    const p = project(c, o.raDeg, o.decDeg);
    if (!onCanvas(p, v, 0)) continue;
    hits.push({ id: o.id, name: o.name, x: p.x, y: p.y });
    const human = o.symbol === "chevron";
    switch (o.symbol) {
      case "galaxy": {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 5 * (o.axisRatio ?? 1), -35 * D2R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        break;
      }
      case "nebula": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.setLineDash([1.5, 2]);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "cluster": {
        ctx.fillStyle = `rgba(${INK},0.65)`;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(p.x + 4.5 * Math.cos(a), p.y + 4.5 * Math.sin(a), 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "core": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${INK},0.9)`;
        ctx.fill();
        break;
      }
      case "field": {
        const ring = rings.get(o.id);
        if (ring) {
          ctx.beginPath();
          ring.forEach(([ra, dec], i) => {
            const q = project(c, ra, dec);
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          });
          ctx.closePath();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = `rgba(${MUT},0.45)`;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "square": {
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.strokeRect(p.x - 2, p.y - 2, 4, 4);
        break;
      }
      case "chevron": {
        ctx.beginPath();
        ctx.moveTo(p.x - 3.5, p.y + 2);
        ctx.lineTo(p.x, p.y - 2.5);
        ctx.lineTo(p.x + 3.5, p.y + 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(${WARM},0.9)`;
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case "star":
        break; // the star layer already drew it; this adds the name and the hit
    }
    if (v.names) {
      ctx.fillStyle = human ? `rgba(${WARM},0.75)` : `rgba(${MUT},0.7)`;
      const dx = o.symbol === "field" ? 0 : 8;
      ctx.fillText(o.name, p.x + dx, p.y + 3);
    }
  }
  return hits;
}

/** A 6-ray burst at each active shower's peak radiant (drift ignored; the card says so). */
export function drawRadiants(ctx: CanvasRenderingContext2D, v: View, active: SkyShower[]): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const sh of active) {
    const p = project(c, sh.radiantRaDeg, sh.radiantDecDeg);
    if (!onCanvas(p, v, 0)) continue;
    hits.push({ id: sh.id, name: sh.name, x: p.x, y: p.y });
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(p.x + 2 * Math.cos(a), p.y + 2 * Math.sin(a));
      ctx.lineTo(p.x + 6.5 * Math.cos(a), p.y + 6.5 * Math.sin(a));
    }
    ctx.strokeStyle = `rgba(${WARM},0.9)`;
    ctx.stroke();
    if (v.names) {
      ctx.fillStyle = `rgba(${WARM},0.75)`;
      ctx.fillText(sh.name, p.x + 9, p.y + 3);
    }
  }
  return hits;
}
```

- [ ] **Step 5: Replace `lib/sky-render.ts`**

The whole file, replaced. Differences from the current one, so a reviewer can check them: the spec §4 layer order (Milky Way first; objects and radiants after the stars; the hover layer moved from before the planets to the very end); every drawn selectable returned as a `Hit`; `Highlight` is `{ kind, id, pointer }`; the hover label is one function for constellations and symbols, with the one-liner as its last line(s), word-wrapped to the margin when it has to avoid the sheet; `nearestHit` added; a selection ring or brightened lines for `selectedId`.

```ts
/**
 * Draws one frame of the night sky. No state, no clock, no DOM beyond the
 * context it is handed: NightSky owns time, sizing and input.
 *
 * Layers, back to front (spec 2026-09-15 §4): desk fill, Milky Way band,
 * graticule, ecliptic, constellation lines, stars, objects, meteor radiants,
 * planets, the Moon, the ISS, then the hover/selection layer. Colors are the
 * site tokens (desk #0c0b09, ink #eae5da, mut #9a948a, warm #d9a45b) at low
 * alpha; no red, which stays reviewer's ink.
 *
 * Planet names and "Moon" are rendered straight from the PLANETS enum and a
 * literal, the way copy.ts's header allows enum values; they are proper
 * nouns, not prose. The hover one-liners come from content/sky-facts.ts,
 * handed in through `oneLiner`.
 */
import type { SkyData } from "./sky-data";
import { drawMilkyWay, drawObjects, drawRadiants, type Hit, type View } from "./sky-layers";
import type { PreparedMilkyWay, SkyObject, SkyShower } from "./sky-objects";
import { eclipticToEquatorial, project, type Chart, type Equatorial, type Planet, type Point } from "./sky-math";

export type { Hit };
export type Bodies = {
  planets: { name: Planet; eq: Equatorial }[];
  moon: Equatorial;
  phase: { litFraction: number; brightLimbDeg: number };
};
export type Segment = [x1: number, y1: number, x2: number, y2: number];
/** A rectangle to keep hover labels clear of, CSS px (the sheet's own bounding rect). */
export type Avoid = { left: number; top: number; right: number; bottom: number };
/** The box a hover label was actually drawn in, CSS px, top-left + size. */
export type LabelBox = { x: number; y: number; w: number; h: number };
/** What a hover label says: the name (constellations: Latin, then English) and the one-liner. */
export type LabelText = { title: string; english: string | null; sub: string | null };
export type Projected = {
  segments: Map<string, Segment[]>;
  /** Everything selectable that is on screen this frame, in draw order. */
  hits: Hit[];
  label: LabelBox | null;
  labelText: LabelText | null;
};
/** A hovered (or tapped) thing: a constellation by abbreviation, or a Hit by id. */
export type Highlight = { kind: "constellation" | "hit"; id: string; pointer: Point };
export type FrameInput = {
  width: number;
  height: number;
  chart: Chart;
  magLimit: number;
  bodies: Bodies;
  fontFamily: string;
  highlight: Highlight | null;
  avoid: Avoid | null;
  /** One rgba fill style per `sky.stars` entry, same order, from
   *  `precomputeStarFills`. A star's colour and brightness never change
   *  frame to frame (both come only from its catalog mag/bv), so building
   *  these 1,627 template strings is wasted work at ~20 fps; compute once
   *  per catalog load instead. */
  starFills: string[];
  /** Prepared once per load (lib/sky-objects.ts); null until it lands or if absent. */
  milkyWay: PreparedMilkyWay | null;
  /** objects.json's objects; empty until it lands or if absent. */
  objects: SkyObject[];
  /** Small-circle outlines by object id (the Kepler field), prepared once per load. */
  objectRings: ReadonlyMap<string, [number, number][]>;
  /** Only the showers active on the simulated date. */
  showers: SkyShower[];
  /** Always-on names beside symbols (false below 880px, spec §4). */
  names: boolean;
  /** The desk one-liner for an id, from content/sky-facts.ts; null until the facts load. */
  oneLiner: (id: string) => string | null;
  /** The id whose card is open (Task 5), ringed like a hover. */
  selectedId: string | null;
};

const DESK = "#0c0b09";
const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
const D2R = Math.PI / 180;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Faint B-V tint: blue-white through the ink tone to amber. Never saturated. */
function starRgb(bv: number): string {
  const t = clamp((bv + 0.3) / 2.0, 0, 1);
  const mix = (a: number, b: number, u: number) => Math.round(a + (b - a) * u);
  if (t < 0.45) {
    const u = t / 0.45;
    return `${mix(205, 234, u)},${mix(218, 229, u)},${mix(255, 218, u)}`;
  }
  const u = (t - 0.45) / 0.55;
  return `${mix(234, 240, u)},${mix(229, 196, u)},${mix(218, 150, u)}`;
}

/**
 * One rgba fill style per `sky.stars` entry, same order. A star's mag/bv
 * never change after the catalog loads, so its fill string doesn't either:
 * call this once when `loadSky()` resolves (NightSky does) and hand the
 * result back into every `drawSky` call as `starFills`, rather than building
 * ~1,627 template strings inside the ~20 fps paint loop.
 */
export function precomputeStarFills(stars: SkyData["stars"]): string[] {
  return stars.map(([, , mag, bv]) => `rgba(${starRgb(bv)},${clamp(1 - (mag + 1.5) * 0.12, 0.25, 1)})`);
}

export function drawSky(ctx: CanvasRenderingContext2D, sky: SkyData, f: FrameInput): Projected {
  const { width, height, chart: c } = f;
  const view: View = { chart: c, width, height, fontFamily: f.fontFamily, names: f.names };
  const onCanvas = (p: { x: number; y: number }, m: number) =>
    p.x > -m && p.x < width + m && p.y > -m && p.y < height + m;
  const radiusAt = (dec: number) => c.k * Math.tan(((90 - dec) / 2) * D2R);
  const hits: Hit[] = [];

  ctx.fillStyle = DESK;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;

  // Milky Way band, under everything else.
  if (f.milkyWay) {
    const mwHit = drawMilkyWay(ctx, view, f.milkyWay);
    if (mwHit) hits.push(mwHit);
  }
  ctx.font = `10px ${f.fontFamily}`;

  // Graticule: declination circles, hour spokes, labels.
  for (const dec of [60, 30, 0, -30]) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, radiusAt(dec), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${MUT},${dec === 0 ? 0.16 : 0.08})`;
    ctx.stroke();
  }
  ctx.beginPath();
  for (let h = 0; h < 24; h += 2) {
    const a = project(c, h * 15, 80);
    const b = project(c, h * 15, -60);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = `rgba(${MUT},0.07)`;
  ctx.stroke();
  ctx.fillStyle = `rgba(${MUT},0.45)`;
  for (let h = 0; h < 24; h += 2) {
    const p = project(c, h * 15, 0);
    if (onCanvas(p, 0)) ctx.fillText(`${h}h`, p.x + 3, p.y - 3);
  }
  for (const dec of [60, 30, 0, -30]) {
    const p = project(c, 0, dec);
    if (onCanvas(p, 0)) ctx.fillText(dec > 0 ? `+${dec}°` : dec < 0 ? `−${-dec}°` : "0°", p.x + 3, p.y + 11);
  }

  // Ecliptic.
  ctx.beginPath();
  for (let lon = 0; lon <= 360; lon += 2) {
    const e = eclipticToEquatorial(lon);
    const p = project(c, e.raDeg, e.decDeg);
    if (lon === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = `rgba(${MUT},0.22)`;
  ctx.stroke();
  ctx.setLineDash([]);

  // Constellation lines; the projected segments go back to NightSky for
  // hit-testing and the verify snapshot.
  const segments = new Map<string, Segment[]>();
  ctx.beginPath();
  for (const [abbr, polylines] of Object.entries(sky.lines)) {
    const segs: Segment[] = [];
    for (const pl of polylines) {
      let prev: { x: number; y: number } | null = null;
      for (const [ra, dec] of pl) {
        const p = project(c, ra, dec);
        if (prev) {
          segs.push([prev.x, prev.y, p.x, p.y]);
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
        }
        prev = p;
      }
    }
    segments.set(abbr, segs);
  }
  ctx.strokeStyle = `rgba(${MUT},0.3)`;
  ctx.stroke();

  // Stars, brightest first, so the magnitude cut is a break.
  for (let i = 0; i < sky.stars.length; i++) {
    const [ra, dec, mag] = sky.stars[i];
    if (mag > f.magLimit) break;
    const p = project(c, ra, dec);
    if (!onCanvas(p, 4)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, clamp(2.1 - 0.32 * mag, 0.5, 2.6), 0, Math.PI * 2);
    ctx.fillStyle = f.starFills[i];
    ctx.fill();
  }

  // Objects, then the active radiants.
  hits.push(...drawObjects(ctx, view, f.objects, f.objectRings));
  hits.push(...drawRadiants(ctx, view, f.showers));
  ctx.font = `10px ${f.fontFamily}`;

  // Planets.
  for (const { name, eq } of f.bodies.planets) {
    const p = project(c, eq.raDeg, eq.decDeg);
    if (!onCanvas(p, 20)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${WARM},0.95)`;
    ctx.fill();
    ctx.fillStyle = `rgba(${WARM},0.75)`;
    ctx.fillText(name, p.x + 6, p.y + 3);
    if (onCanvas(p, 0)) hits.push({ id: name.toLowerCase(), name, x: p.x, y: p.y });
  }

  // The Moon, with its real phase. Screen directions of celestial north and
  // east are measured at the Moon's own position (the chart is conformal but
  // rotates and flips handedness), then the bright limb's position angle
  // (north through east) is laid onto them.
  const { moon, phase } = f.bodies;
  const mp = project(c, moon.raDeg, moon.decDeg);
  if (onCanvas(mp, 20)) {
    const unit = (q: { x: number; y: number }) => {
      const dx = q.x - mp.x;
      const dy = q.y - mp.y;
      const n = Math.hypot(dx, dy) || 1;
      return { x: dx / n, y: dy / n };
    };
    const north = unit(project(c, moon.raDeg, moon.decDeg + 0.5));
    const east = unit(project(c, moon.raDeg + 0.5 / Math.cos(moon.decDeg * D2R), moon.decDeg));
    const chi = phase.brightLimbDeg * D2R;
    const angle = Math.atan2(
      Math.cos(chi) * north.y + Math.sin(chi) * east.y,
      Math.cos(chi) * north.x + Math.sin(chi) * east.x,
    );
    const r = 5;
    const k = phase.litFraction;
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${INK},0.14)`;
    ctx.fill();
    ctx.save();
    ctx.translate(mp.x, mp.y);
    ctx.rotate(angle); // +x now points at the bright limb
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); // the lit half's rim
    // Terminator: half an ellipse back to the top, bulging into the dark
    // side when gibbous (k > 0.5), into the lit side when crescent.
    ctx.ellipse(0, 0, r * Math.abs(2 * k - 1), r, 0, Math.PI / 2, (3 * Math.PI) / 2, k < 0.5);
    ctx.closePath();
    ctx.fillStyle = `rgba(${INK},0.95)`;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(${INK},0.7)`;
    ctx.fillText("Moon", mp.x + 8, mp.y + 3);
    if (onCanvas(mp, 0)) hits.push({ id: "moon", name: "Moon", x: mp.x, y: mp.y });
  }

  // Hover and selection, on top of everything.
  const ring = (id: string | null) => {
    const h = id ? hits.find((x) => x.id === id) : undefined;
    if (!h) return;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 9, 0, Math.PI * 2);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(${INK},0.85)`;
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  const brighten = (abbr: string | null) => {
    const segs = abbr ? segments.get(abbr) : undefined;
    if (!segs) return;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(${INK},0.85)`;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = `rgba(${INK},0.95)`;
    for (const [x1, y1, x2, y2] of segs) {
      for (const [vx, vy] of [[x1, y1], [x2, y2]]) {
        ctx.beginPath();
        ctx.arc(vx, vy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  if (f.selectedId && f.selectedId !== f.highlight?.id) {
    if (sky.constellations[f.selectedId]) brighten(f.selectedId);
    else ring(f.selectedId);
  }

  const hot = f.highlight;
  let label: LabelBox | null = null;
  let labelText: LabelText | null = null;
  if (hot?.kind === "constellation" && segments.has(hot.id) && sky.constellations[hot.id]) {
    const con = sky.constellations[hot.id];
    brighten(hot.id);
    let anchor = project(c, con.labels[0][0], con.labels[0][1]);
    for (const [ra, dec] of con.labels.slice(1)) {
      const q = project(c, ra, dec);
      if (Math.hypot(q.x - hot.pointer.x, q.y - hot.pointer.y) < Math.hypot(anchor.x - hot.pointer.x, anchor.y - hot.pointer.y)) {
        anchor = q;
      }
    }
    labelText = { title: con.latin, english: con.english, sub: f.oneLiner(hot.id) };
    label = drawLabel(ctx, f, labelText, anchor, "center", hot.pointer);
  } else if (hot?.kind === "hit") {
    const h = hits.find((x) => x.id === hot.id);
    if (h) {
      ring(h.id);
      labelText = { title: h.name, english: null, sub: f.oneLiner(h.id) };
      label = drawLabel(ctx, f, labelText, h, "beside", hot.pointer);
    }
  }
  ctx.font = `10px ${f.fontFamily}`;

  return { segments, hits, label, labelText };
}

const ASCENT = 9;
const DESCENT = 4;
const LINE_GAP = 13; // baseline-to-baseline drop to each following line

/**
 * A hover label: the title in ink at 12px, the English meaning in mut at
 * 10px (inline in parentheses, or stacked on its own line when the margin is
 * narrow), and the one-liner in mut at 10px on its own line(s) below,
 * word-wrapped to whatever width the label is allowed. "center" places it on
 * the anchor (a constellation's catalog label point); "beside" places it just
 * right of a symbol.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  f: FrameInput,
  text: LabelText,
  anchor: Point,
  align: "center" | "beside",
  pointer: Point,
): LabelBox {
  const { width, height } = f;
  const englishParen = text.english ? `(${text.english})` : "";
  ctx.font = `12px ${f.fontFamily}`;
  const titleW = ctx.measureText(text.title).width;
  ctx.font = `10px ${f.fontFamily}`;
  const inlineEnglishW = englishParen ? ctx.measureText(` ${englishParen}`).width : 0;
  const parenW = englishParen ? ctx.measureText(englishParen).width : 0;

  /** Greedy word wrap at 10px; a single word wider than maxW gets its own line. */
  const wrap = (s: string, maxW: number): string[] => {
    const out: string[] = [];
    let line = "";
    for (const word of s.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
    return out;
  };
  type Layout = { stacked: boolean; sub: string[]; w: number; rows: number };
  const layout = (stacked: boolean, maxW: number): Layout => {
    const sub = text.sub ? wrap(text.sub, maxW) : [];
    const headW = stacked && englishParen ? Math.max(titleW, parenW) : titleW + inlineEnglishW;
    const w = Math.max(headW, ...sub.map((l) => ctx.measureText(l).width));
    return { stacked, sub, w, rows: 1 + (stacked && englishParen ? 1 : 0) + sub.length };
  };
  const heightFor = (rows: number) => ASCENT + (rows - 1) * LINE_GAP + DESCENT;
  const boxAt = (x: number, baselineY: number, w: number, rows: number): LabelBox => ({
    x,
    y: baselineY - ASCENT,
    w,
    h: heightFor(rows),
  });

  // Default: inline English, at the anchor, wrapped only to the viewport.
  let lay = layout(false, width - 16);
  let boxX =
    align === "center" ? clamp(anchor.x - lay.w / 2, 8, width - 8 - lay.w) : clamp(anchor.x + 10, 8, width - 8 - lay.w);
  let baselineY = clamp(anchor.y + (align === "beside" ? 4 : 0), 18, height - 8 - (lay.rows - 1) * LINE_GAP);
  let box = boxAt(boxX, baselineY, lay.w, lay.rows);

  const avoid = f.avoid;
  const AVOID_PAD = 4;
  const overlapsAvoid = (b: LabelBox) =>
    !!avoid &&
    b.x < avoid.right + AVOID_PAD &&
    b.x + b.w > avoid.left - AVOID_PAD &&
    b.y < avoid.bottom + AVOID_PAD &&
    b.y + b.h > avoid.top - AVOID_PAD;

  // When the anchor's box would land on the sheet (a far-north
  // constellation's catalog anchor, or a symbol near the sheet's edge), the
  // label follows the pointer into whichever desk margin it is actually in,
  // wrapping the one-liner to the margin's width, so the name is never
  // silently hidden behind the page.
  if (avoid && overlapsAvoid(box)) {
    const { x: px, y: py } = pointer;
    let avail: number;
    let xFor: (w: number) => number;
    if (px < avoid.left) {
      avail = avoid.left - 6 - 8;
      xFor = (w) => clamp(avoid.left - 6 - w, 8, avoid.left - 6);
    } else if (px > avoid.right) {
      avail = width - 8 - (avoid.right + 6);
      xFor = (w) => clamp(avoid.right + 6, avoid.right + 6, width - 8 - w);
    } else {
      // Above the sheet (the common case) or, on a page shorter than the
      // viewport, below it: bounded only vertically, so the label follows
      // the pointer's x across the full width.
      avail = width - 16;
      xFor = (w) => clamp(px - w / 2, 8, width - 8 - w);
    }

    const inline = layout(false, avail);
    const stacked = layout(true, avail);
    if (inline.w <= avail) lay = inline;
    else if (englishParen && stacked.w <= avail) lay = stacked;
    // Best effort: nothing fits the margin (a word or the title is wider
    // than it). Use the narrower layout, as close to the pointer as the
    // viewport allows, even if it grazes the sheet.
    else lay = englishParen && stacked.w < inline.w ? stacked : inline;
    boxX = xFor(lay.w);

    const h = heightFor(lay.rows);
    if (px < avoid.left || px > avoid.right) {
      baselineY = clamp(py - 14, 18, height - 8 - (lay.rows - 1) * LINE_GAP);
    } else if (py < avoid.top) {
      baselineY = clamp(py - 14, 18, Math.min(height - 8, avoid.top - 4 - (h - ASCENT)));
    } else {
      baselineY = clamp(py + 14, Math.max(18, avoid.bottom + 4 + ASCENT), height - 8 - (lay.rows - 1) * LINE_GAP);
    }
    box = boxAt(boxX, baselineY, lay.w, lay.rows);
  }

  ctx.font = `12px ${f.fontFamily}`;
  ctx.fillStyle = `rgba(${INK},0.95)`;
  ctx.fillText(text.title, boxX, baselineY);
  let nextBaseline = baselineY + LINE_GAP;
  ctx.font = `10px ${f.fontFamily}`;
  ctx.fillStyle = `rgba(${MUT},0.85)`;
  if (englishParen) {
    if (lay.stacked) {
      ctx.fillText(englishParen, boxX, nextBaseline);
      nextBaseline += LINE_GAP;
    } else {
      ctx.fillText(` ${englishParen}`, boxX + titleW, baselineY);
    }
  }
  for (const line of lay.sub) {
    ctx.fillText(line, boxX, nextBaseline);
    nextBaseline += LINE_GAP;
  }
  return box;
}

/** Distance from (x, y) to a segment, CSS px. */
function segmentDistance(x: number, y: number, [x1, y1, x2, y2]: Segment): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** The constellation whose nearest line segment is within maxPx, or null. */
export function nearestConstellation(p: Projected, x: number, y: number, maxPx: number): string | null {
  let best: string | null = null;
  let bestD = maxPx;
  for (const [abbr, segs] of p.segments) {
    for (const s of segs) {
      const d = segmentDistance(x, y, s);
      if (d <= bestD) {
        bestD = d;
        best = abbr;
      }
    }
  }
  return best;
}

/** The nearest drawn selectable within maxPx, or null. */
export function nearestHit(p: Projected, x: number, y: number, maxPx: number): Hit | null {
  let best: Hit | null = null;
  let bestD = maxPx;
  for (const h of p.hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}
```

- [ ] **Step 6: Load and pass the layers in `components/manuscript/NightSky.tsx`**

Apply in order.

6a. Replace

```ts
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
```

with

```ts
import { useEffect, useRef } from "react";
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
```

6b. Replace

```ts
 * `window.__sky` is a read-only snapshot for scripts/verify-redesign.mjs.
```

with

```ts
 * - The objects layers (spec 2026-09-15 §4, §9): objects.json and
 *   milkyway.json are fetched after first paint alongside sky.json, each
 *   gated on its own (absent: the sky draws without it; malformed: logged).
 *   The one-liners come from content/sky-facts.ts, a lazy chunk, so first
 *   paint never carries ~138 entries of prose.
 *
 * `window.__sky` is a read-only snapshot for scripts/verify-redesign.mjs.
```

6c. Replace

```ts
const HOVER_PX = 24;
```

with

```ts
const HOVER_PX = 24;
/** Symbols (objects, stars, planets, the Moon, radiants) win within this, before any line (spec §5). */
const HOVER_HIT_PX = 12;
```

6d. Replace

```ts
  label: { x: number; y: number; w: number; h: number } | null;
  segmentsFor: (abbr: string) => number[][];
};

export function NightSky() {
```

with

```ts
  label: { x: number; y: number; w: number; h: number } | null;
  labelText: LabelText | null;
  hits: { id: string; x: number; y: number }[];
  radiants: string[];
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState };
  segmentsFor: (abbr: string) => number[][];
};

type LayerState = "loading" | "ready" | "absent" | "error";

export function NightSky() {
```

6e. Replace

```ts
    let sky: SkyData | null = null;
    let starFills: string[] = [];
```

with

```ts
    let sky: SkyData | null = null;
    let starFills: string[] = [];
    let objectsData: SkyObjectsData | null = null;
    let objectRings = new Map<string, [number, number][]>();
    let milkyWay: PreparedMilkyWay | null = null;
    let facts: Map<string, SkyFact> | null = null;
    const layers: SkySnapshot["layers"] = { objects: "loading", milkyWay: "loading", facts: "loading" };
```

6f. Replace

```ts
      const t0 = performance.now();
      projected = drawSky(ctx, sky, {
```

with

```ts
      const activeShowers = objectsData ? objectsData.showers.filter((s) => isShowerActive(s, sim)) : [];
      const t0 = performance.now();
      projected = drawSky(ctx, sky, {
```

6g. Replace

```ts
        avoid,
        starFills,
      });
```

with

```ts
        avoid,
        starFills,
        milkyWay,
        objects: objectsData?.objects ?? [],
        objectRings,
        showers: activeShowers,
        names: !narrowQ.matches,
        oneLiner: (id) => facts?.get(id)?.oneLiner ?? null,
        selectedId: null,
      });
```

6h. Replace

```ts
        highlight: highlight?.abbr ?? null,
        label: seen.label,
```

with

```ts
        highlight: highlight?.id ?? null,
        label: seen.label,
        labelText: seen.labelText,
        hits: seen.hits.map(({ id, x, y }) => ({ id, x, y })),
        radiants: activeShowers.map((s) => s.id),
        layers: { ...layers },
```

6i. Replace

```ts
      const abbr = nearestConstellation(projected, x, y, HOVER_PX);
      return abbr ? { abbr, pointer: { x, y } } : null;
```

with

```ts
      const hit = nearestHit(projected, x, y, HOVER_HIT_PX);
      if (hit) return { kind: "hit", id: hit.id, pointer: { x, y } };
      const abbr = nearestConstellation(projected, x, y, HOVER_PX);
      return abbr ? { kind: "constellation", id: abbr, pointer: { x, y } } : null;
```

6j. Replace

```ts
    void document.fonts?.ready.then(() => {
```

with

```ts
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
```

- [ ] **Step 7: Typecheck, test, build, run the checks**

Run: `npx tsc --noEmit && node --test scripts/test-sky-objects.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs && node scripts/check-voice.mjs`
Expected: clean typecheck; 11 + 16 + 4 tests pass; the gate passes.
Rebuild and restart :3000, then run: `node scripts/verify-redesign.mjs sky no-early-heavy stargaze`
Expected: `sky-animates-1280`, `sky-static-reduced-motion`, `sky-present-400`, `sky-orientation`, `sky-hover`, `sky-drag`, `sky-objects`, `no-early-heavy-payload-400` and the six `stargaze-*` checks PASS. `sky-objects` reports three peak jumps (M31, the galactic core, the Perseid radiant) and the hovered symbol's name and one-liner.

- [ ] **Step 8: Measure the frame cost (spec §10)**

Run `node scripts/verify-redesign.mjs sky-animates-1280` three times. Write the three medians into the task report next to the 2.96 ms baseline, pass or fail. If any exceeds 5.92 ms, do not raise the budget. Measure where the time goes first (wrap each layer call in `drawSky` with `performance.now()` in a scratch build, not committed) and cut the layer that costs it, in this order: (1) build the Milky Way as one `Path2D` per level only when `lstDeg`, `k`, `cx` or `cy` changed since the last frame, and reuse it otherwise; (2) skip the Milky Way rings whose every vertex is off canvas by more than the viewport diagonal, precomputing each ring's RA/Dec bounding cap once in `prepareMilkyWay`; (3) draw the five levels at `MILKY_WAY_ALPHA` into an offscreen canvas at half the backing-store resolution only when the chart changes by more than 0.2°, and blit it. Re-measure after each and stop at the first that brings all three runs under budget.

- [ ] **Step 9: Look at it**

Screenshot `/` at 1440x900 and 400x800, and a stargaze screenshot at 1440x900 (the page hidden), at an instant when the band crosses the screen (pin the clock to `2026-10-01T04:00:00Z` in the one-off script). Confirm: the band reads as a faint glow, brighter toward its core, never brighter than the constellation lines (tune `MILKY_WAY_ALPHA` in `lib/sky-layers.ts` if not; record the final value and why); symbols are legible at 1x; names do not collide badly with planet names; below 880px the symbols draw without names. Hover a few objects and a constellation in the margin at 1280x800 and confirm the wrapped one-liner stays in the margin.

- [ ] **Step 10: Commit**

```bash
git add lib/sky-objects.ts lib/sky-layers.ts lib/sky-render.ts components/manuscript/NightSky.tsx scripts/test-sky-objects.mjs scripts/verify-redesign.mjs
git commit -m "sky: Milky Way, deep-sky objects, named stars, Voyagers, radiants; desk one-liners

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 5: Stargaze cards

**Files:**
- Create: `components/manuscript/SkyCard.tsx`
- Modify: `components/manuscript/NightSky.tsx`, `content/copy.ts`, `scripts/verify-redesign.mjs`

**Interfaces:**
- Consumes: `SkyFact`, `Citation` (Task 3); `SkyShower` (Task 4); `Highlight`, `Projected.hits`, `FrameInput.selectedId` (Task 4); `onSkyClick`, `PAN_BLOCKERS` (Task 1).
- Produces (`components/manuscript/SkyCard.tsx`):
  ```ts
  export type CardExtra =
    | { type: "none" }
    | { type: "shower"; shower: SkyShower }
    | { type: "spacecraft"; distanceAu: number; positionDate: string };   // Task 6 adds { type: "iss"; … }
  export type CardModel = { id: string; title: string; fact: SkyFact; extra: CardExtra };
  export function SkyCard(props: { model: CardModel; cardRef: Ref<HTMLElement>; onClose: () => void }): JSX.Element;
  ```
  DOM contract: `aside[data-sky-card="<id>"][aria-labelledby]` containing `h2` (title), `[data-sky-card-kind]`, zero or more `[data-sky-card-data]`, `[data-sky-card-visibility]`, `ol[data-sky-card-sources] a[target=_blank][rel=noopener]`.
- Produces (`copy.stargaze.card`): `close`, `closeAria`, `sources`, `retrieved`, `from`, `titleMoon`, `titleIss`, `titleMilkyWay`, `showerActive`, `showerTo`, `showerPeak`, `showerZhr`, `showerParent`, `showerDrift`, `spacecraftPre`, `spacecraftMid`, `spacecraftPost`.
- Produces (NightSky, internal, used by Task 6): `buildCard(h)`, `openCard(h)`, `closeCard()`, `followCard(p)`, `selected`, `setCard`; `window.__sky.card` (the open card's id or null).
- Produces (`scripts/verify-redesign.mjs`): `ABBRS`, `emptySkyPoint(page, awayFrom)`, `checkStargazeCard`.

- [ ] **Step 1: Write the failing check**

In `scripts/verify-redesign.mjs`:

1. Replace

```js
import { SKY_FACTS } from "../content/sky-facts.ts";
```

with

```js
import { readFileSync } from "node:fs";
import { SKY_FACTS } from "../content/sky-facts.ts";
```

2. Immediately above the driver banner (the dashed rule line directly above `/* driver */`), insert:

```js
/** The 88 abbreviations, from the committed catalog (the snapshot's segmentsFor takes one at a time). */
const ABBRS = Object.keys(JSON.parse(readFileSync(new URL("../public/sky/sky.json", import.meta.url), "utf8")).constellations);

/**
 * A point of genuinely empty sky: at least 30px from every drawn symbol and
 * every constellation line (so a click there selects nothing), off the card,
 * off any control, and at least `awayFrom.r` px from `awayFrom`.
 */
function emptySkyPoint(page, awayFrom) {
  return page.evaluate(
    ([abbrs, away]) => {
      const segs = abbrs.flatMap((a) => window.__sky.segmentsFor(a));
      const distToSeg = (x, y, [x1, y1, x2, y2]) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
        return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      };
      const card = document.querySelector("[data-sky-card]")?.getBoundingClientRect();
      for (let y = 120; y < window.innerHeight - 120; y += 23) {
        for (let x = 120; x < window.innerWidth - 120; x += 29) {
          if (Math.hypot(x - away.x, y - away.y) < away.r) continue;
          if (card && x > card.left - 20 && x < card.right + 20 && y > card.top - 20 && y < card.bottom + 20) continue;
          if (window.__sky.hits.some((h) => Math.hypot(h.x - x, h.y - y) < 30)) continue;
          if (segs.some((s) => distToSeg(x, y, s) < 30)) continue;
          if (document.elementFromPoint(x, y)?.closest("button, a, [data-sky-card]")) continue;
          return { x, y };
        }
      }
      return null;
    },
    [ABBRS, awayFrom],
  );
}

async function checkStargazeCard(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  const m31Fact = SKY_FACTS.find((f) => f.id === "m31");
  return pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const card = page.locator("[data-sky-card]");

    // A drag that starts on Andromeda is a drag, not a click: no card.
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 40, p.y + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 1000 });
    if ((await card.count()) !== 0) throw new Error("a drag opened a card");

    // A click on Andromeda opens its card: title, kind line, a real citation link.
    await page.mouse.click(p.x, p.y);
    await card.waitFor({ state: "visible", timeout: 3000 });
    const content = await card.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      title: el.querySelector("h2")?.textContent,
      kind: el.querySelector("[data-sky-card-kind]")?.textContent,
      links: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => ({
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        rel: a.getAttribute("rel"),
      })),
      box: el.getBoundingClientRect().toJSON(),
    }));
    if (content.id !== "m31" || content.title !== "Andromeda Galaxy") throw new Error(`card opened for ${content.id} "${content.title}"`);
    if (content.kind !== m31Fact.kind) throw new Error(`kind line "${content.kind}", fact says "${m31Fact.kind}"`);
    if (!content.links.length || !content.links.every((l) => /^https?:\/\//.test(l.href) && l.target === "_blank" && l.rel === "noopener")) {
      throw new Error(`citation links ${JSON.stringify(content.links)}`);
    }
    const { box } = content;
    if (box.left < 0 || box.top < 0 || box.right > W || box.bottom > H) throw new Error(`card ${JSON.stringify(box)} leaves the viewport`);

    // The card follows its subject while the sky is dragged (from empty sky).
    const empty = await emptySkyPoint(page, { x: p.x, y: p.y, r: 420 });
    if (!empty) throw new Error("no empty sky to drag from");
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down();
    await page.mouse.move(empty.x - 100, empty.y, { steps: 10 });
    await page.waitForFunction(() => Math.abs(window.__sky.offset.x + 100) < 2, null, { timeout: 2000 });
    const dragged = await card.evaluate((el) => el.getBoundingClientRect().left);
    await page.mouse.up();
    if (Math.abs(dragged - (box.left - 100)) > 3) throw new Error(`card at ${dragged} during a -100px drag, was ${box.left}`);
    if ((await card.count()) !== 1) throw new Error("the drag closed the card");

    // Escape closes the card first; stargaze stays on. A second Escape exits.
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });
    if (!(await page.evaluate(() => document.body.hasAttribute("data-stargaze")))) {
      throw new Error("the first Escape exited stargaze instead of closing the card");
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 3000 });

    // Back in: a click on empty sky closes an open card.
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.click(p.x, p.y);
    await card.waitFor({ state: "visible", timeout: 3000 });
    const blank = await emptySkyPoint(page, { x: p.x, y: p.y, r: 60 });
    if (!blank) throw new Error("no empty sky to click");
    await page.mouse.click(blank.x, blank.y);
    await card.waitFor({ state: "detached", timeout: 2000 });
    return `drag opened nothing; card "${content.title}" / "${content.kind}" with ${content.links.length} source link(s); followed a -100px drag; Escape closed it, second Escape exited; empty click closed it`;
  });
}
```

3. In `CHECKS`, after `["stargaze-during-download", checkStargazeDuringDownload],` add `["stargaze-card", checkStargazeCard],`.

- [ ] **Step 2: Run it to verify it fails**

Rebuild and restart :3000, then run: `node scripts/verify-redesign.mjs stargaze-card`
Expected: FAIL at `card.waitFor` (no `[data-sky-card]` ever appears; a click in stargaze only names a constellation today).

- [ ] **Step 3: Copy**

Fetch https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing again if you have not this session. In `content/copy.ts`, replace

```ts
    hintPointer: "hover a constellation",
    hintTouch: "tap a constellation",
```

with

```ts
    hintPointer: "drag to look around, click a name to read about it",
    hintTouch: "drag to look around, tap a name to read about it",
```

and replace

```ts
      "The sky over NASA Ames at the moment you arrived. Stars from the Extended Hipparcos Compilation; lines and Latin names from d3-celestial; English names from Wikipedia.",
  },
```

with

```ts
      "The sky over NASA Ames at the moment you arrived. Stars from the Extended Hipparcos Compilation; lines and Latin names from d3-celestial; English names from Wikipedia.",
    /** The stargaze card (components/manuscript/SkyCard.tsx). Numbers and
     *  dates between these fragments come from the data files; the facts
     *  themselves live in content/sky-facts.ts. */
    card: {
      close: "close",
      closeAria: "Close this card",
      sources: "Sources",
      /** "Retrieved September 15, 2026, from https://…" (APA). */
      retrieved: "Retrieved",
      from: "from",
      titleMoon: "Moon",
      titleIss: "International Space Station",
      titleMilkyWay: "Milky Way",
      /** "Active Jul 17 to Aug 24, peak Aug 13. Peak rate ZHR 100." */
      showerActive: "Active ",
      showerTo: " to ",
      showerPeak: ", peak ",
      showerZhr: ". Peak rate ZHR ",
      showerParent: "Parent body: ",
      showerDrift:
        "The burst marks the radiant at the peak. The real radiant creeps a little each night, and this chart leaves that out.",
      /** "Position on September 15, 2026: 171.8 au from Earth." */
      spacecraftPre: "Position on ",
      spacecraftMid: ": ",
      spacecraftPost: " au from Earth.",
    },
  },
```

Run: `node scripts/check-voice.mjs` (passes).

- [ ] **Step 4: Create `components/manuscript/SkyCard.tsx`**

```tsx
"use client";

import type { Ref } from "react";
import { copy } from "@/content/copy";
import type { Citation, SkyFact } from "@/content/sky-facts";
import type { SkyShower } from "@/lib/sky-objects";

/**
 * The stargaze card (spec docs/superpowers/specs/2026-09-15-sky-objects-design.md §6):
 * title, kind line, any live data lines, the fact's sentences, how to see it,
 * and its sources in APA form. DOM, not canvas, so it is selectable,
 * readable by assistive tech, and its links are real links.
 *
 * NightSky owns it: which card is open, and where it sits. From 880px up
 * NightSky positions it beside the selection every frame (style.left/top);
 * below 880px it docks to the bottom as a sheet and NightSky leaves the
 * position alone. Citation links are plain, untracked anchors (CLAUDE.md's
 * analytics quota rule: no new events).
 */

export type CardExtra =
  | { type: "none" }
  | { type: "shower"; shower: SkyShower }
  | { type: "spacecraft"; distanceAu: number; positionDate: string };

export type CardModel = { id: string; title: string; fact: SkyFact; extra: CardExtra };

const LONG_DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "2026-09-15" -> "September 15, 2026". */
const longDate = (iso: string) => LONG_DATE.format(new Date(`${iso}T00:00:00Z`));
/** "08-13" -> "Aug 13" (the year only fixes the calendar; these windows recur). */
const monthDay = (md: string) => SHORT_DATE.format(new Date(Date.UTC(2026, Number(md.slice(0, 2)) - 1, Number(md.slice(3)))));
const period = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);

function CitationItem({ c }: { c: Citation }) {
  const t = copy.stargaze.card;
  return (
    <li>
      {period(c.author)} ({c.year}). <i>{period(c.title)}</i> {period(c.site)} {t.retrieved} {longDate(c.accessed)},{" "}
      {t.from}{" "}
      <a href={c.url} target="_blank" rel="noopener" className="break-all text-link underline underline-offset-2">
        {c.url}
      </a>
    </li>
  );
}

function extraLines(extra: CardExtra): string[] {
  const t = copy.stargaze.card;
  switch (extra.type) {
    case "shower": {
      const s = extra.shower;
      return [
        `${t.showerActive}${monthDay(s.start)}${t.showerTo}${monthDay(s.end)}${t.showerPeak}${monthDay(s.peak)}${t.showerZhr}${s.zhr}.`,
        `${t.showerParent}${s.parent}.`,
        t.showerDrift,
      ];
    }
    case "spacecraft":
      return [`${t.spacecraftPre}${longDate(extra.positionDate)}${t.spacecraftMid}${extra.distanceAu.toFixed(1)}${t.spacecraftPost}`];
    case "none":
      return [];
  }
}

export function SkyCard({ model, cardRef, onClose }: { model: CardModel; cardRef: Ref<HTMLElement>; onClose: () => void }) {
  const t = copy.stargaze.card;
  const titleId = `sky-card-title-${model.id}`;
  return (
    <aside
      ref={cardRef}
      data-sky-card={model.id}
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto border-t border-rule bg-panel/95 px-4 py-4 font-mono text-[11px] leading-relaxed text-mut shadow-[0_0_40px_rgba(0,0,0,0.6)] min-[880px]:right-auto min-[880px]:bottom-auto min-[880px]:w-[320px] min-[880px]:border"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-serif text-[17px] leading-snug text-ink">
          {model.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.closeAria}
          className="shrink-0 underline decoration-dotted underline-offset-[3px] transition-colors hover:text-ink"
        >
          {t.close}
        </button>
      </div>
      <p data-sky-card-kind className="mt-1 text-warm">
        {model.fact.kind}
      </p>
      {extraLines(model.extra).map((line) => (
        <p key={line} data-sky-card-data className="mt-1">
          {line}
        </p>
      ))}
      <p className="mt-3 font-serif text-[13px] leading-snug text-ink/90">{model.fact.body.join(" ")}</p>
      <p data-sky-card-visibility className="mt-2">
        {model.fact.visibility}
      </p>
      <h3 className="mt-3 text-[10px] text-mut/80">{t.sources}</h3>
      <ol data-sky-card-sources className="mt-1 space-y-1 text-[10px] leading-snug">
        {model.fact.citations.map((c) => (
          <CitationItem key={c.url} c={c} />
        ))}
      </ol>
    </aside>
  );
}
```

- [ ] **Step 5: Card state, clicks, Escape and placement in `components/manuscript/NightSky.tsx`**

Apply in order.

5a. Replace

```ts
import { useEffect, useRef } from "react";
```

with

```ts
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
```

5b. Replace

```ts
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";
```

with

```ts
import { isStargazing, subscribeStargaze } from "@/lib/stargaze";
import { SkyCard, type CardModel } from "./SkyCard";
```

5c. Replace

```ts
 * `window.__sky` is a read-only snapshot
```

with

```ts
 * - Cards (spec 2026-09-15 §6): in stargaze mode a click (under
 *   CLICK_SLOP_PX of travel) on a selectable opens its SkyCard, a click on
 *   empty sky closes it, Escape closes it before it can reach
 *   StargazeToggle's exit. The card follows its subject as the sky turns and
 *   while dragging, and closes when the subject leaves the viewport.
 *
 * `window.__sky` is a read-only snapshot
```

5d. Replace

```ts
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState };
```

with

```ts
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState };
  card: string | null;
```

5e. Replace

```ts
export function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
```

with

```ts
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
```

5f. Replace

```ts
    let highlight: Highlight | null = null;
    const frameTimes: number[] = [];
```

with

```ts
    let highlight: Highlight | null = null;
    /** The open card's subject; mirrors `card` state, readable synchronously. */
    let selected: { kind: Highlight["kind"]; id: string } | null = null;
    const frameTimes: number[] = [];
```

5g. Replace `        selectedId: null,` with `        selectedId: selected?.id ?? null,`.

5h. Replace

```ts
        layers: { ...layers },
        segmentsFor: (abbr) => (seen.segments.get(abbr) ?? []).map((s) => [...s]),
      };
```

with

```ts
        layers: { ...layers },
        card: selected?.id ?? null,
        segmentsFor: (abbr) => (seen.segments.get(abbr) ?? []).map((s) => [...s]),
      };
      if (selected) followCard(seen);
```

5i. Replace the first line of the `step` function, `    const step = (t: number) => {`, with

```ts
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
```

5j. Replace

```ts
    // A pointer that never travelled CLICK_SLOP_PX. Stargaze keeps tap-to-name
    // (touch has no hover); Task 5 turns this into the card.
    const onSkyClick = (x: number, y: number) => {
      if (isStargazing()) setHighlight(pick(x, y));
    };
```

with

```ts
    // A pointer that never travelled CLICK_SLOP_PX: in stargaze mode, a card
    // for whatever is under it, or closing the open card on empty sky.
    const onSkyClick = (x: number, y: number) => {
      if (!isStargazing()) return;
      const next = pick(x, y);
      if (next) openCard(next);
      else closeCard();
    };
```

5k. Replace

```ts
      if (e.pointerType === "touch") return;
      setHighlight(pick(e.clientX, e.clientY));
    };
    const endDrag
```

with

```ts
      if (e.pointerType === "touch") return;
      // Over the open card: nothing under it is being pointed at.
      if (e.target instanceof Element && e.target.closest("[data-sky-card]")) return setHighlight(null);
      setHighlight(pick(e.clientX, e.clientY));
    };
    const endDrag
```

5l. Replace `    window.addEventListener("pointercancel", endDrag);` with

```ts
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("keydown", onKeyDown, { capture: true });
```

5m. Replace

```ts
    const unsubStargaze = subscribeStargaze(() => {
      highlight = null;
      paint();
    });
```

with

```ts
    const unsubStargaze = subscribeStargaze((on) => {
      highlight = null;
      if (!on) closeCard();
      paint();
    });
    repaintRef.current = () => {
      if (!running) paint();
      else if (projected) followCard(projected);
    };
```

5n. Replace `      window.removeEventListener("pointercancel", endDrag);` with

```ts
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
```

5o. Replace the returned JSX

```tsx
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
```

with

```tsx
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
```

- [ ] **Step 6: Typecheck, build, run**

Run: `npx tsc --noEmit && node scripts/check-voice.mjs`
Rebuild and restart :3000, then run: `node scripts/verify-redesign.mjs stargaze sky`
Expected: all seven `stargaze-*` checks (including `stargaze-card`) and all seven `sky-*` checks PASS.

- [ ] **Step 7: Look at it**

In stargaze mode at 1440x900, open cards for Andromeda, a planet, the Moon, a constellation with an English name, a shower (pin the clock to `2026-08-12T00:00:00Z`) and Voyager 1 (it is on screen when its RA is up). Screenshot each. Confirm: title, kind line, data lines, the sentences, the visibility line and APA-shaped sources read correctly and nothing overflows the 320 px card; the card sits beside its subject and follows it while dragging. At 400x800 open one card and confirm it docks to the bottom as a sheet, scrolls inside itself when long, and the close button works by touch (Playwright `hasTouch: true`, `page.tap`). Tab to the close button and confirm the visible focus ring.

- [ ] **Step 8: Commit**

```bash
git add components/manuscript/SkyCard.tsx components/manuscript/NightSky.tsx content/copy.ts scripts/verify-redesign.mjs
git commit -m "stargaze: cards with sourced facts for everything selectable

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 6: The ISS

**Files:**
- Create: `lib/sky-iss.ts`, `app/api/iss-tle/route.ts`, `scripts/test-sky-iss.mjs`
- Modify: `package.json`, `package-lock.json`, `lib/sky-math.ts`, `lib/sky-layers.ts`, `lib/sky-render.ts`, `components/manuscript/SkyCard.tsx`, `components/manuscript/NightSky.tsx`, `content/copy.ts`, `scripts/test-sky-math.mjs`, `scripts/verify-redesign.mjs`

**Interfaces:**
- Consumes: `MOFFETT`, `Equatorial`, `View`, `Hit`, `FrameInput`, `CardExtra`, `buildCard`, `selected`, `setCard`, `layers` (Tasks 1, 4, 5); `CELESTRAK_ISS` and the `iss` fact (Task 3); `copy.stargaze.card.titleIss` (Task 5).
- Produces (`lib/sky-math.ts`): `export function precessToJ2000(eq: Equatorial, ms: number): Equatorial;`
- Produces (`lib/sky-iss.ts`, no runtime imports):
  ```ts
  export type SatelliteLib = typeof import("satellite.js");
  export type IssTle = { name: string; line1: string; line2: string; epoch: string; fetchedAt: string };
  export type IssRouteBody = IssTle | { tle: null; fetchedAt: string };
  export type Observer = { latDeg: number; lonDeg: number; heightKm: number };
  export type IssLook = { raDateDeg: number; decDateDeg: number; azimuthDeg: number; elevationDeg: number; altitudeKm: number; speedKmS: number };
  export type IssTracker = { tle: IssTle; epochMs: number; at: (ms: number) => IssLook | null };
  export const ISS_URL = "/api/iss-tle";
  export const TLE_STALE_MS = 604_800_000; // 7 days
  export const MOFFETT_HEIGHT_KM = 0.01;
  export function parseTleText(text: string): { name: string; line1: string; line2: string } | null;
  export function tleEpochIso(line1: string): string;
  export function issLook(sat: SatelliteLib, satrec: SatRec, ms: number, obs: Observer): IssLook | null;
  export function loadIss(importSatellite: () => Promise<SatelliteLib>, obs: Observer): Promise<IssTracker | null>;
  ```
- Produces (`GET /api/iss-tle`): `200 { name, line1, line2, epoch, fetchedAt }`, or `200 { tle: null, fetchedAt }` on any failure; `revalidate = 7200`.
- Produces (`lib/sky-layers.ts`): `export function drawIss(ctx, v: View, iss: { eq: Equatorial; aboveHorizon: boolean }): Hit | null;` (hit id `iss`).
- Produces (`FrameInput.iss: { eq: Equatorial; aboveHorizon: boolean } | null`; `CardExtra` gains `{ type: "iss"; aboveHorizon; altitudeKm; speedKmS; epoch; still }`; `window.__sky.layers.iss`, `window.__sky.iss: { x, y, aboveHorizon } | null`).
- Produces (`scripts/verify-redesign.mjs`): `ISS_TLE`, `findIssInstant(W, H)`, `checkSkyIss`.

- [ ] **Step 1: Add the dependency**

Run: `npm install satellite.js@7.1.0`
Expected: `package.json` gains `"satellite.js": "^7.1.0"` under `dependencies`; `package-lock.json` updates. Confirm the license: `node -p "require('./node_modules/satellite.js/package.json').license"` prints `MIT`.

- [ ] **Step 2: Write the failing node tests**

Create `scripts/test-sky-iss.mjs`:

```js
// node --test scripts/test-sky-iss.mjs
// Pins lib/sky-iss.ts. For a fixed, real TLE (CelesTrak, fetched 2026-09-15)
// its topocentric RA/Dec, computed from the observer-to-station vector, must
// agree with satellite.js's OWN look angles (azimuth/elevation) converted to
// RA/Dec here by the textbook horizon-to-equatorial formulas: two
// independent routes to the same direction. Also the TLE text parser and the
// epoch, which the route handler relies on.
import test from "node:test";
import assert from "node:assert/strict";
import * as satellite from "satellite.js";
import * as I from "../lib/sky-iss.ts";

const TEXT =
  "ISS (ZARYA)             \r\n" +
  "1 25544U 98067A   26258.17538348  .00006015  00000+0  11677-3 0  9998\r\n" +
  "2 25544  51.6311 214.7209 0004917 142.0099 218.1237 15.49120584585708\r\n";
const MOFFETT = { latDeg: 37.4153, lonDeg: -122.0647, heightKm: I.MOFFETT_HEIGHT_KM };
const D2R = Math.PI / 180;

function sepDeg(a, b) {
  const c =
    Math.sin(a.dec * D2R) * Math.sin(b.dec * D2R) +
    Math.cos(a.dec * D2R) * Math.cos(b.dec * D2R) * Math.cos((a.ra - b.ra) * D2R);
  return Math.acos(Math.min(1, Math.max(-1, c))) / D2R;
}

test("parses CelesTrak's text and the epoch", () => {
  const tle = I.parseTleText(TEXT);
  assert.equal(tle.name, "ISS (ZARYA)");
  assert.equal(tle.line1.length, 69);
  assert.equal(I.tleEpochIso(tle.line1), "2026-09-15T04:12:33.132Z");
  assert.equal(I.parseTleText(TEXT.replace("0  9998", "0  9997")), null, "a bad checksum must be rejected");
  assert.equal(I.parseTleText("<html>maintenance</html>"), null);
});

test("topocentric RA/Dec agrees with satellite.js look angles within 0.01°", () => {
  const { line1, line2 } = I.parseTleText(TEXT);
  const satrec = satellite.twoline2satrec(line1, line2);
  const epochMs = Date.parse(I.tleEpochIso(line1));
  let worst = 0;
  let aboveHorizon = 0;
  for (let ms = epochMs - 12 * 3600e3; ms <= epochMs + 12 * 3600e3; ms += 7 * 60e3) {
    const look = I.issLook(satellite, satrec, ms, MOFFETT);
    assert.ok(look, `propagation failed at ${new Date(ms).toISOString()}`);
    assert.ok(look.altitudeKm > 380 && look.altitudeKm < 440, `altitude ${look.altitudeKm}`);
    assert.ok(look.speedKmS > 7.5 && look.speedKmS < 7.8, `speed ${look.speedKmS}`);

    // Independent: azimuth/elevation -> hour angle/declination -> RA, with
    // LST from satellite.js's own GMST so both sit in the same frame of date.
    const date = new Date(ms);
    const site = { longitude: MOFFETT.lonDeg * D2R, latitude: MOFFETT.latDeg * D2R, height: MOFFETT.heightKm };
    const pv = satellite.propagate(satrec, date);
    const gmst = satellite.gstime(date);
    const la = satellite.ecfToLookAngles(site, satellite.eciToEcf(pv.position, gmst));
    const phi = site.latitude;
    const A = la.azimuth;
    const h = la.elevation;
    const dec = Math.asin(Math.sin(phi) * Math.sin(h) + Math.cos(phi) * Math.cos(h) * Math.cos(A));
    const H = Math.atan2(-Math.sin(A) * Math.cos(h), Math.sin(h) * Math.cos(phi) - Math.cos(h) * Math.cos(A) * Math.sin(phi));
    const lst = gmst + site.longitude;
    const ref = { ra: ((((lst - H) / D2R) % 360) + 360) % 360, dec: dec / D2R };

    assert.ok(Math.abs(look.elevationDeg - h / D2R) < 1e-9, "elevation is satellite.js's own");
    worst = Math.max(worst, sepDeg({ ra: look.raDateDeg, dec: look.decDateDeg }, ref));
    if (look.elevationDeg > 0) aboveHorizon++;
  }
  assert.ok(worst < 0.01, `worst disagreement ${worst.toFixed(5)}°`);
  assert.ok(aboveHorizon > 0, "the sample never saw the ISS above Moffett Field's horizon");
});

test("a TLE more than seven days from the instant is not used", async () => {
  const tle = { ...I.parseTleText(TEXT), epoch: I.tleEpochIso(I.parseTleText(TEXT).line1), fetchedAt: "2026-09-15T16:00:00.000Z" };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(tle), { headers: { "content-type": "application/json" } });
  try {
    const tracker = await I.loadIss(async () => satellite, MOFFETT);
    assert.ok(tracker.at(tracker.epochMs + 3600e3), "an hour after the epoch is fine");
    assert.equal(tracker.at(tracker.epochMs + I.TLE_STALE_MS + 60e3), null);
  } finally {
    globalThis.fetch = realFetch;
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ tle: null, fetchedAt: "x" }));
  try {
    assert.equal(await I.loadIss(async () => satellite, MOFFETT), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
```

In `scripts/test-sky-math.mjs`, immediately above `test("projection: pole toward the top left, farthest corner at the edge declination", () => {`, insert:

```js
test("precession of date -> J2000 within 0.01° of astronomy-engine", () => {
  let worst = 0;
  for (const d of DATES.filter((_, i) => i % 13 === 0)) {
    const time = new A.AstroTime(d);
    const rot = A.Rotation_EQD_EQJ(time);
    for (let ra = 0; ra < 360; ra += 45) {
      for (const dec of [-60, -20, 0, 30, 60, 80]) {
        const ofDate = { raDeg: ra, decDeg: dec };
        const refVec = A.RotateVector(rot, A.VectorFromSphere(new A.Spherical(dec, ra, 1), time));
        const ref = refEq(refVec);
        worst = Math.max(worst, sepDeg(S.precessToJ2000(ofDate, d.getTime()), ref));
      }
    }
  }
  assert.ok(worst < 0.01, `worst ${worst.toFixed(4)}°`);
});

```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --test scripts/test-sky-iss.mjs scripts/test-sky-math.mjs`
Expected: `test-sky-iss` fails with `Cannot find module '…/lib/sky-iss.ts'`; `test-sky-math` fails the precession test with `S.precessToJ2000 is not a function`.

- [ ] **Step 4: Precession in `lib/sky-math.ts`**

Replace

```ts
/** Where the north celestial pole sits on screen before any drag (spec 2026-09-15 §2). */
```

with

```ts
/**
 * Mean equator and equinox of date -> J2000, IAU 1976 precession (Lieske
 * 1977: zeta, z, theta). For positions that arrive in the frame of date,
 * like the ISS's (satellite.js works in TEME); everything on the chart is
 * J2000 so it all agrees. Pinned against astronomy-engine within 0.01° (its
 * equator of date also carries nutation, under 0.006°).
 */
export function precessToJ2000(eq: Equatorial, ms: number): Equatorial {
  const t = centuries(ms);
  const as = D2R / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * as;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * as;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * as;
  const cz = Math.cos(z), sz = Math.sin(z);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const cZ = Math.cos(zeta), sZ = Math.sin(zeta);
  // P maps J2000 -> date; its transpose maps date -> J2000.
  const P = [
    [cz * ct * cZ - sz * sZ, -cz * ct * sZ - sz * cZ, -cz * st],
    [sz * ct * cZ + cz * sZ, -sz * ct * sZ + cz * cZ, -sz * st],
    [st * cZ, -st * sZ, ct],
  ];
  const a = eq.raDeg * D2R;
  const d = eq.decDeg * D2R;
  const v: Vec3 = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  return toRaDec([
    P[0][0] * v[0] + P[1][0] * v[1] + P[2][0] * v[2],
    P[0][1] * v[0] + P[1][1] * v[1] + P[2][1] * v[2],
    P[0][2] * v[0] + P[1][2] * v[1] + P[2][2] * v[2],
  ]);
}

/** Where the north celestial pole sits on screen before any drag (spec 2026-09-15 §2). */
```

- [ ] **Step 5: Create `lib/sky-iss.ts`**

```ts
/**
 * The ISS on the night sky (spec docs/superpowers/specs/2026-09-15-sky-objects-design.md §8).
 *
 * ⚠️ NO RUNTIME IMPORTS. satellite.js (SGP4) is handed in by the caller:
 * NightSky lazy-imports it only once the route has a TLE, and
 * scripts/test-sky-iss.mjs passes its own copy, so this file runs straight in
 * node. The `import type` below is erased.
 *
 * Frames: satellite.js propagates in TEME, an equator-and-equinox-of-date
 * frame, so `raDateDeg`/`decDateDeg` are of date. The chart is J2000; the
 * caller converts with lib/sky-math.ts precessToJ2000 (a ~0.36° shift in
 * 2026, about 4 px, which would otherwise put the station beside the wrong
 * stars).
 *
 * Honesty gate: a TLE is a fit to a few days of tracking. More than
 * TLE_STALE_MS from its epoch (the sky's 180x clock gets there in about 56
 * real minutes) `at()` returns null and the ISS leaves the chart instead of
 * drifting somewhere it isn't.
 */
import type * as Satellite from "satellite.js";

export type SatelliteLib = typeof Satellite;
export type IssTle = { name: string; line1: string; line2: string; epoch: string; fetchedAt: string };
export type IssRouteBody = IssTle | { tle: null; fetchedAt: string };
export type Observer = { latDeg: number; lonDeg: number; heightKm: number };
export type IssLook = {
  raDateDeg: number;
  decDateDeg: number;
  azimuthDeg: number;
  elevationDeg: number;
  altitudeKm: number;
  speedKmS: number;
};
export type IssTracker = { tle: IssTle; epochMs: number; at: (ms: number) => IssLook | null };

export const ISS_URL = "/api/iss-tle";
export const TLE_STALE_MS = 7 * 86_400_000;
/** Moffett Field's ground elevation is about 10 m. */
export const MOFFETT_HEIGHT_KM = 0.01;

const R2D = 180 / Math.PI;

/** TLE checksum: digits count their value, "-" counts 1, mod 10, in column 69. */
function checksumOk(line: string): boolean {
  let sum = 0;
  for (const ch of line.slice(0, 68)) {
    if (ch >= "0" && ch <= "9") sum += Number(ch);
    else if (ch === "-") sum += 1;
  }
  return sum % 10 === Number(line[68]);
}

/** CelesTrak's 3-line TLE text (CRLF line ends, padded name) -> the ISS's lines, or null. */
export function parseTleText(text: string): { name: string; line1: string; line2: string } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0);
  if (lines.length < 3) return null;
  const [name, line1, line2] = lines;
  if (line1.length !== 69 || line2.length !== 69) return null;
  if (!line1.startsWith("1 25544") || !line2.startsWith("2 25544")) return null;
  if (!checksumOk(line1) || !checksumOk(line2)) return null;
  return { name: name.trim(), line1, line2 };
}

/** Line 1 columns 19-32: two-digit year, then day of year with a fraction. */
export function tleEpochIso(line1: string): string {
  const yy = Number(line1.slice(18, 20));
  const doy = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000).toISOString();
}

/** Topocentric position of the station as seen by `obs` at `ms`, or null if SGP4 fails. */
export function issLook(sat: SatelliteLib, satrec: Satellite.SatRec, ms: number, obs: Observer): IssLook | null {
  const date = new Date(ms);
  const pv = sat.propagate(satrec, date);
  if (!pv) return null;
  const gmst = sat.gstime(date);
  const site = {
    longitude: sat.degreesToRadians(obs.lonDeg),
    latitude: sat.degreesToRadians(obs.latDeg),
    height: obs.heightKm,
  };
  // RA/Dec from the observer-to-station vector in the inertial frame.
  const here = sat.ecfToEci(sat.geodeticToEcf(site), gmst);
  const dx = pv.position.x - here.x;
  const dy = pv.position.y - here.y;
  const dz = pv.position.z - here.z;
  const range = Math.hypot(dx, dy, dz);
  // Elevation and azimuth from satellite.js's own horizon frame.
  const look = sat.ecfToLookAngles(site, sat.eciToEcf(pv.position, gmst));
  const geo = sat.eciToGeodetic(pv.position, gmst);
  return {
    raDateDeg: (((Math.atan2(dy, dx) * R2D) % 360) + 360) % 360,
    decDateDeg: Math.asin(dz / range) * R2D,
    azimuthDeg: look.azimuth * R2D,
    elevationDeg: look.elevation * R2D,
    altitudeKm: geo.height,
    speedKmS: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z),
  };
}

/**
 * Fetch the route; null when it has no TLE (CelesTrak unreachable at its last
 * revalidation) or the fetch fails, so the ISS simply isn't drawn. A body
 * that claims a TLE but isn't one throws: that's a route bug to see.
 */
export async function loadIss(importSatellite: () => Promise<SatelliteLib>, obs: Observer): Promise<IssTracker | null> {
  let res: Response;
  try {
    res = await fetch(ISS_URL);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json()) as IssRouteBody;
  if ("tle" in body && body.tle === null) return null;
  const tle = body as IssTle;
  if (typeof tle.line1 !== "string" || typeof tle.line2 !== "string" || Number.isNaN(Date.parse(tle.epoch))) {
    throw new Error(`${ISS_URL}: malformed body ${JSON.stringify(body).slice(0, 200)}`);
  }
  const sat = await importSatellite();
  const satrec = sat.twoline2satrec(tle.line1, tle.line2);
  const epochMs = Date.parse(tle.epoch);
  return {
    tle,
    epochMs,
    at: (ms) => (Math.abs(ms - epochMs) > TLE_STALE_MS ? null : issLook(sat, satrec, ms, obs)),
  };
}
```

- [ ] **Step 6: Run the node tests to verify they pass**

Run: `node --test scripts/test-sky-iss.mjs scripts/test-sky-math.mjs`
Expected: 3 + 17 pass. (The worst RA/Dec disagreement measured while planning was well under 0.01°; the precession worst case about 0.002°.)

- [ ] **Step 7: Write the failing browser check**

In `scripts/verify-redesign.mjs`:

1. Replace

```js
import { readFileSync } from "node:fs";
```

with

```js
import { readFileSync } from "node:fs";
import * as satellite from "satellite.js";
```

2. Immediately above the driver banner (the dashed rule line directly above `/* driver */`), insert:

```js
/** A real ISS element set (CelesTrak, fetched 2026-09-15), served in place of the route. */
const ISS_TLE = {
  name: "ISS (ZARYA)",
  line1: "1 25544U 98067A   26258.17538348  .00006015  00000+0  11677-3 0  9998",
  line2: "2 25544  51.6311 214.7209 0004917 142.0099 218.1237 15.49120584585708",
  epoch: "2026-09-15T04:12:33.132Z",
  fetchedAt: "2026-09-15T15:53:34.000Z",
};

/**
 * The first instant in the 24 h after the TLE's epoch (30 s steps) when the
 * ISS is more than 20° up over Moffett Field and lands 80px inside W x H.
 * Computed independently of lib/sky-iss.ts: satellite.js's own look angles,
 * converted to RA/Dec of date by the horizon-to-equatorial formulas, then to
 * J2000 by astronomy-engine.
 */
function findIssInstant(W, H) {
  const D2R = Math.PI / 180;
  const satrec = satellite.twoline2satrec(ISS_TLE.line1, ISS_TLE.line2);
  const site = { longitude: MOFFETT_LON * D2R, latitude: 37.4153 * D2R, height: 0.01 };
  const epoch = Date.parse(ISS_TLE.epoch);
  for (let ms = epoch; ms < epoch + 24 * 3600e3; ms += 30e3) {
    const date = new Date(ms);
    const pv = satellite.propagate(satrec, date);
    const gmst = satellite.gstime(date);
    const look = satellite.ecfToLookAngles(site, satellite.eciToEcf(pv.position, gmst));
    if (look.elevation / D2R < 20) continue;
    const phi = site.latitude;
    const A = look.azimuth;
    const h = look.elevation;
    const dec = Math.asin(Math.sin(phi) * Math.sin(h) + Math.cos(phi) * Math.cos(h) * Math.cos(A));
    const HA = Math.atan2(-Math.sin(A) * Math.cos(h), Math.sin(h) * Math.cos(phi) - Math.cos(h) * Math.cos(A) * Math.sin(phi));
    const raOfDate = (gmst + site.longitude - HA) / D2R;
    const time = new Astronomy.AstroTime(date);
    const v = Astronomy.RotateVector(
      Astronomy.Rotation_EQD_EQJ(time),
      Astronomy.VectorFromSphere(new Astronomy.Spherical(dec / D2R, raOfDate, 1), time),
    );
    const eq = Astronomy.EquatorFromVector(v);
    const p = specProject(W, H, lstAt(date), eq.ra * 15, eq.dec);
    if (p.x > 80 && p.x < W - 80 && p.y > 80 && p.y < H - 80) return { date, p, elevation: h / D2R };
  }
  throw new Error("the fixture TLE never puts the ISS 20° up and on screen in 24 h");
}

async function checkSkyIss(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p, elevation } = findIssInstant(W, H);
  const issPage = (body, fn) =>
    withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
      const errors = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error" && /iss|satellite|NightSky/i.test(msg.text())) errors.push(`console: ${msg.text()}`);
      });
      await context.route("**/api/iss-tle", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
      );
      await page.clock.setFixedTime(date);
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const out = await fn(page);
      if (errors.length) throw new Error(errors.join(" | "));
      return out;
    });

  const present = await issPage(ISS_TLE, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.iss === "ready" && window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    const iss = await page.evaluate(() => window.__sky.iss);
    if (!iss) throw new Error(`no ISS drawn at ${date.toISOString()} (elevation ${elevation.toFixed(1)}°)`);
    if (Math.hypot(iss.x - p.x, iss.y - p.y) > 3) {
      throw new Error(`ISS drawn at (${iss.x.toFixed(1)}, ${iss.y.toFixed(1)}), independent computation says (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
    }
    if (!iss.aboveHorizon) throw new Error(`ISS reported below the horizon at ${elevation.toFixed(1)}° elevation`);
    const peak = await skyPeak(page, p.x, p.y, 3);

    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.click(p.x, p.y);
    const card = page.locator("[data-sky-card]");
    await card.waitFor({ state: "visible", timeout: 3000 });
    const content = await card.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      title: el.querySelector("h2")?.textContent,
      data: [...el.querySelectorAll("[data-sky-card-data]")].map((d) => d.textContent),
      links: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => a.getAttribute("href")),
    }));
    if (content.id !== "iss" || content.title !== "International Space Station") throw new Error(`card ${content.id} "${content.title}"`);
    if (!content.data.some((d) => /^Above the horizon/.test(d))) throw new Error(`card data ${JSON.stringify(content.data)}`);
    if (!content.data.some((d) => /September 15, 2026, 04:12 UTC/.test(d))) throw new Error(`card lacks the TLE epoch: ${JSON.stringify(content.data)}`);
    if (!content.links.some((href) => href.startsWith("https://celestrak.org/"))) throw new Error(`no CelesTrak citation: ${content.links}`);
    return peak;
  });

  const absentPeak = await issPage({ tle: null, fetchedAt: ISS_TLE.fetchedAt }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.iss === "absent", null, { timeout: 10000 });
    const snap = await page.evaluate(() => ({ iss: window.__sky.iss, hit: window.__sky.hits.some((h) => h.id === "iss") }));
    if (snap.iss || snap.hit) throw new Error("an ISS was drawn although the route had no TLE");
    return skyPeak(page, p.x, p.y, 3);
  });
  if (present - absentPeak < 40) throw new Error(`ISS pixel peak ${present} with a TLE vs ${absentPeak} without`);
  return `${date.toISOString()} at ${elevation.toFixed(1)}°: drawn at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}), peak ${absentPeak} -> ${present}, card opens; { tle: null } draws nothing, no errors`;
}
```

3. In `CHECKS`, after `["stargaze-card", checkStargazeCard],` add `["sky-iss", checkSkyIss],`.

Rebuild and restart :3000, then run: `node scripts/verify-redesign.mjs sky-iss`
Expected: FAIL (`window.__sky.layers.iss` never becomes `"ready"`).

- [ ] **Step 8: The route**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` ("Revalidating Cached Data") and confirm `next.config.ts` still has no `cacheComponents` (with it, `revalidate` is removed). Create `app/api/iss-tle/route.ts`:

```ts
/**
 * The ISS's two-line element set for the night sky (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §8), same-origin
 * and cached, so a visitor's browser never contacts a third party and
 * CelesTrak sees this site at most once per revalidation window (their
 * fair-use guidance asks for no more than one download per two hours).
 *
 * `revalidate` works here because this project does not enable
 * cacheComponents (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/route.md, "Revalidating Cached Data"). Every failure,
 * including a reply that isn't a valid ISS TLE, answers 200 with
 * `{ tle: null }`: the cached body then carries no TLE, the next
 * revalidation tries again, and the client (lib/sky-iss.ts) simply draws no
 * ISS.
 */
import { parseTleText, tleEpochIso } from "@/lib/sky-iss";

export const revalidate = 7200;

const SOURCE = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

export async function GET() {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(SOURCE, {
      headers: { "user-agent": "neelayranjan.dev night sky (ISS position, cached 2 h)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ tle: null, fetchedAt });
    const tle = parseTleText(await res.text());
    if (!tle) return Response.json({ tle: null, fetchedAt });
    return Response.json({ ...tle, epoch: tleEpochIso(tle.line1), fetchedAt });
  } catch {
    return Response.json({ tle: null, fetchedAt });
  }
}
```

- [ ] **Step 9: Draw it, card it, track it**

9a. `lib/sky-layers.ts`: replace `import { project, type Chart } from "./sky-math";` with `import { project, type Chart, type Equatorial } from "./sky-math";`, and append to the end of the file:

```ts
/** The ISS: a small warm square with a faint halo, dimmed while it is below Moffett Field's horizon. */
export function drawIss(ctx: CanvasRenderingContext2D, v: View, iss: { eq: Equatorial; aboveHorizon: boolean }): Hit | null {
  const p = project(v.chart, iss.eq.raDeg, iss.eq.decDeg);
  if (!onCanvas(p, v, 0)) return null;
  const a = iss.aboveHorizon ? 1 : 0.35;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${WARM},${0.16 * a})`;
  ctx.fill();
  ctx.fillStyle = `rgba(${WARM},${0.95 * a})`;
  ctx.fillRect(p.x - 1.75, p.y - 1.75, 3.5, 3.5);
  if (v.names) {
    ctx.font = `9px ${v.fontFamily}`;
    ctx.fillStyle = `rgba(${WARM},${0.75 * a})`;
    ctx.fillText("ISS", p.x + 8, p.y + 3);
  }
  return { id: "iss", name: "ISS", x: p.x, y: p.y };
}
```

9b. `lib/sky-render.ts`: replace

```ts
import { drawMilkyWay, drawObjects, drawRadiants, type Hit, type View } from "./sky-layers";
```

with

```ts
import { drawIss, drawMilkyWay, drawObjects, drawRadiants, type Hit, type View } from "./sky-layers";
```

replace

```ts
  /** The id whose card is open (Task 5), ringed like a hover. */
  selectedId: string | null;
};
```

with

```ts
  /** The id whose card is open (Task 5), ringed like a hover. */
  selectedId: string | null;
  /** The ISS in J2000 (lib/sky-iss.ts, precessed), or null when there is no usable TLE. */
  iss: { eq: Equatorial; aboveHorizon: boolean } | null;
};
```

and replace

```ts
    if (onCanvas(mp, 0)) hits.push({ id: "moon", name: "Moon", x: mp.x, y: mp.y });
  }
```

with

```ts
    if (onCanvas(mp, 0)) hits.push({ id: "moon", name: "Moon", x: mp.x, y: mp.y });
  }

  // The ISS.
  if (f.iss) {
    const issHit = drawIss(ctx, view, f.iss);
    if (issHit) hits.push(issHit);
  }
```

9c. `content/copy.ts`: replace

```ts
      spacecraftPost: " au from Earth.",
```

with

```ts
      spacecraftPost: " au from Earth.",
      issAbove: "Above the horizon over NASA Ames at this chart's time.",
      issBelow: "Below the horizon over NASA Ames at this chart's time.",
      /** "Altitude 419 km, moving at 7.66 km/s." */
      issAltitude: "Altitude ",
      issSpeed: " km, moving at ",
      issSpeedPost: " km/s.",
      /** "Orbit data (TLE) from September 15, 2026, 04:12 UTC." */
      issEpoch: "Orbit data (TLE) from ",
      issEpochPost: " UTC.",
      issClock: "This sky runs 180 times faster than the real one, so the station crosses it in seconds.",
      issClockStill: "This sky holds still at the moment you arrived, so the station does too.",
```

9d. `components/manuscript/SkyCard.tsx`: replace

```ts
  | { type: "spacecraft"; distanceAu: number; positionDate: string };
```

with

```ts
  | { type: "spacecraft"; distanceAu: number; positionDate: string }
  | { type: "iss"; aboveHorizon: boolean; altitudeKm: number; speedKmS: number; epoch: string; still: boolean };
```

replace

```ts
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
```

with

```ts
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** Time on its own: a combined date-time format inserts locale glue ("at") that varies by engine. */
const TIME = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
```

and replace

```ts
    case "none":
      return [];
```

with

```ts
    case "iss":
      return [
        extra.aboveHorizon ? t.issAbove : t.issBelow,
        `${t.issAltitude}${Math.round(extra.altitudeKm)}${t.issSpeed}${extra.speedKmS.toFixed(2)}${t.issSpeedPost}`,
        `${t.issEpoch}${LONG_DATE.format(new Date(extra.epoch))}, ${TIME.format(new Date(extra.epoch))}${t.issEpochPost}`,
        extra.still ? t.issClockStill : t.issClock,
      ];
    case "none":
      return [];
```

9e. `components/manuscript/NightSky.tsx`, in order:

Replace

```ts
import {
  PLANETS,
  chartFor,
```

with

```ts
import { loadIss, MOFFETT_HEIGHT_KM, type IssLook, type IssTracker } from "@/lib/sky-iss";
import {
  MOFFETT,
  PLANETS,
  chartFor,
```

Replace

```ts
  planetEquatorial,
  simTimeMs,
```

with

```ts
  planetEquatorial,
  precessToJ2000,
  simTimeMs,
```

Replace

```ts
 * `window.__sky` is a read-only snapshot
```

with

```ts
 * - The ISS (spec 2026-09-15 §8): a TLE from the same-origin /api/iss-tle,
 *   propagated by satellite.js (lazy-imported only once there is a TLE) at
 *   the simulated time, precessed into the chart's J2000 frame.
 *
 * `window.__sky` is a read-only snapshot
```

Replace

```ts
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState };
```

with

```ts
  layers: { objects: LayerState; milkyWay: LayerState; facts: LayerState; iss: LayerState };
  iss: { x: number; y: number; aboveHorizon: boolean } | null;
```

Replace

```ts
    const layers: SkySnapshot["layers"] = { objects: "loading", milkyWay: "loading", facts: "loading" };
```

with

```ts
    const layers: SkySnapshot["layers"] = { objects: "loading", milkyWay: "loading", facts: "loading", iss: "loading" };
    let issTracker: IssTracker | null = null;
    /** The ISS as of the last paint. */
    let issNow: IssLook | null = null;
    let issCardRefreshed = 0;
```

Replace

```ts
      const activeShowers = objectsData ? objectsData.showers.filter((s) => isShowerActive(s, sim)) : [];
```

with

```ts
      const activeShowers = objectsData ? objectsData.showers.filter((s) => isShowerActive(s, sim)) : [];
      issNow = issTracker ? issTracker.at(sim) : null;
      const iss = issNow
        ? { eq: precessToJ2000({ raDeg: issNow.raDateDeg, decDeg: issNow.decDateDeg }, sim), aboveHorizon: issNow.elevationDeg > 0 }
        : null;
```

Replace

```ts
        selectedId: selected?.id ?? null,
      });
```

with

```ts
        selectedId: selected?.id ?? null,
        iss,
      });
```

Replace

```ts
        card: selected?.id ?? null,
```

with

```ts
        card: selected?.id ?? null,
        iss: (() => {
          const h = seen.hits.find((x) => x.id === "iss");
          return h && iss ? { x: h.x, y: h.y, aboveHorizon: iss.aboveHorizon } : null;
        })(),
```

Replace

```ts
      if (selected) followCard(seen);
```

with

```ts
      if (selected) followCard(seen);
      // The ISS card's live lines, refreshed once a real second.
      if (selected?.id === "iss" && performance.now() - issCardRefreshed > 1000) {
        issCardRefreshed = performance.now();
        const model = buildCard(selected);
        if (model) setCard(model);
      }
```

Replace

```ts
      if (h.id === "milky-way") return
```

with

```ts
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
      if (h.id === "milky-way") return
```

Replace

```ts
    import("@/content/sky-facts")
```

with

```ts
    loadIss(() => import("satellite.js"), { ...MOFFETT, heightKm: MOFFETT_HEIGHT_KM })
      .then((t) => {
        if (!alive) return;
        issTracker = t;
        layers.iss = t ? "ready" : "absent";
        paint();
      })
      .catch((err) => {
        layers.iss = "error";
        console.error("NightSky: /api/iss-tle answered with something that isn't a TLE; no ISS drawn.", err);
        if (alive) paint();
      });
    import("@/content/sky-facts")
```

- [ ] **Step 10: Typecheck and build**

Run: `npx tsc --noEmit && node scripts/check-voice.mjs && npm run build`
Expected: clean; the build lists `ƒ /api/iss-tle` or `○ /api/iss-tle` with `Revalidate 2h` in its route table.

While planning, satellite.js could not be test-built here (a scratch Turbopack build hung before compiling anything, unrelated to the package). Its package-internal dynamic imports `#wasm-single-thread` / `#wasm-multi-thread` point at Emscripten builds that contain `import("node:module")` behind a runtime Node check; the site never calls them. If, and only if, `npm run build` fails on one of those specifiers or on a `node:` module inside `node_modules/satellite.js/wasm-build/`, create `lib/satellite-wasm-stub.js`:

```js
// satellite.js's optional WASM runtimes (createSingleThreadRuntime /
// createMultiThreadRuntime) are never called by this site; lib/sky-iss.ts
// uses the pure-JS SGP4. This stub stands in so the bundler never tries to
// pull their Node-only Emscripten builds into the browser bundle.
export default async function createWasmModule() {
  throw new Error("satellite.js WASM runtimes are not used on this site");
}
```

and add to `next.config.ts`, inside `const nextConfig: NextConfig = {`, before `async headers() {`:

```ts
  turbopack: {
    resolveAlias: {
      "#wasm-single-thread": "./lib/satellite-wasm-stub.js",
      "#wasm-multi-thread": "./lib/satellite-wasm-stub.js",
    },
  },
```

(read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md` first), rebuild, and record in the task report which error forced it. `node --test scripts/test-sky-iss.mjs` is unaffected either way (node resolves the real package).

- [ ] **Step 11: Run it for real**

Restart :3000 on the new build, then:

```bash
curl -s http://localhost:3000/api/iss-tle | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const b=JSON.parse(s);console.log(Object.keys(b).join(","), b.line1?.slice(0,7), b.epoch)})'
curl -sI http://localhost:3000/api/iss-tle | grep -iE "^(cache-control|cross-origin-embedder-policy|x-nextjs-cache)"
node --test scripts/test-sky-data.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs scripts/test-sky-objects.mjs scripts/test-sky-facts.mjs scripts/test-sky-iss.mjs
node scripts/verify-redesign.mjs sky stargaze no-early-heavy
```

Expected: the route prints `name,line1,line2,epoch,fetchedAt 1 25544 <an ISO epoch within the last few days>` (or `tle,fetchedAt` if CelesTrak was unreachable at build time, which is allowed: say so in the report); `cross-origin-embedder-policy: require-corp` is present (the route falls under the site-wide headers); every node test passes; all eight `sky-*` checks, all seven `stargaze-*` checks and `no-early-heavy-payload-400` PASS. `sky-iss` reports the pinned instant (`2026-09-15T07:49:03.132Z` at 25.9°), the ISS pixel jump, and that `{ tle: null }` draws nothing without console errors.

- [ ] **Step 12: Look at it**

With the route un-intercepted on the running build, enter stargaze at 1440x900 and wait for the ISS to cross (at 180x it crosses in seconds when it is up; when it is below the horizon it draws dimmed). Click it: the card's altitude and speed should read about 400-420 km and 7.66 km/s and refresh each second. Screenshot it.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json lib/sky-iss.ts lib/sky-math.ts lib/sky-layers.ts lib/sky-render.ts app/api/iss-tle/route.ts components/manuscript/SkyCard.tsx components/manuscript/NightSky.tsx content/copy.ts scripts/test-sky-iss.mjs scripts/test-sky-math.mjs scripts/verify-redesign.mjs
git commit -m "sky: the ISS from a cached CelesTrak TLE, SGP4 in the browser, with its card

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

(If Step 10's stub was needed, add `lib/satellite-wasm-stub.js next.config.ts` to the `git add`.)

### Task 7: Credit line, docs, share card, full verification, hand-off

**Files:**
- Modify: `content/copy.ts` (the credit lines), `CLAUDE.md`, `README.md`, `public/og.png` (regenerated), `docs/superpowers/specs/2026-09-15-sky-objects-design.md` (status line)

**Interfaces:**
- Consumes: everything above. `sky-present-400` requires the credit to contain `Hipparcos`; `sky-static-reduced-motion` requires the still credit not to contain `faster`.

- [ ] **Step 1: The credit names the new sources**

Fetch https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing if you have not this session. In `content/copy.ts`, replace

```ts
    credit:
      "The sky over NASA Ames from the moment you arrived, turning 180 times faster than the real one. Stars from the Extended Hipparcos Compilation; lines and Latin names from d3-celestial; English names from Wikipedia.",
    creditStill:
      "The sky over NASA Ames at the moment you arrived. Stars from the Extended Hipparcos Compilation; lines and Latin names from d3-celestial; English names from Wikipedia.",
```

with

```ts
    credit:
      "The sky over NASA Ames from the moment you arrived, turning 180 times faster than the real one. Stars from the Extended Hipparcos Compilation; lines, Latin names, the Milky Way and the Messier objects from d3-celestial; English names and constellation origins from Wikipedia; spacecraft positions from JPL Horizons; meteor showers from the IMO; the ISS from CelesTrak. Every card cites its sources.",
    creditStill:
      "The sky over NASA Ames at the moment you arrived. Stars from the Extended Hipparcos Compilation; lines, Latin names, the Milky Way and the Messier objects from d3-celestial; English names and constellation origins from Wikipedia; spacecraft positions from JPL Horizons; meteor showers from the IMO; the ISS from CelesTrak. Every card cites its sources.",
```

Run: `node scripts/check-voice.mjs`. Read both lines aloud; if either reads like a press release, shorten it (keep `Hipparcos` in both and `faster` out of the still one).

- [ ] **Step 2: Full verification on a fresh production build**

```bash
rm -rf .next && npm run build
kill $(ss -ltnp | grep ':3000 ' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
(npx next start -p 3000 > /tmp/next-3000.log 2>&1 &)
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
npx tsc --noEmit
node --test scripts/test-sky-data.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs scripts/test-sky-objects.mjs scripts/test-sky-facts.mjs scripts/test-sky-iss.mjs
node scripts/check-voice.mjs
node scripts/verify-redesign.mjs
node scripts/verify-headshot-256.mjs
```

Expected: typecheck clean; node tests 5 + 17 + 4 + 11 + 5 + 3 = 45 pass; the voice gate passes; `verify-redesign` prints **27 passed, 0 failed** (the 23 from before, with `sky-orientation`, `sky-hover` and `sky-animates-1280` updated, plus `sky-drag`, `sky-objects`, `stargaze-card`, `sky-iss`); the headshot 256 script passes. Keep the full output for the hand-off. Any FAIL stops the task: fix, then re-run all of it.

- [ ] **Step 3: Regenerate the share card**

Run: `node scripts/gen-og.mjs` (server still on :3000). Open `public/og.png` and confirm the name, tagline, abstract and headshot rail are framed as before, with the moved sky (Milky Way, object symbols) in the margins and nothing overlapping the masthead text.

- [ ] **Step 4: CLAUDE.md**

Keep its maintainer-facing, measured, trap-first voice. Edits:

1. **Current state**: add a paragraph dated 2026-09-15 after the night-sky paragraph: the pole moved to the top left, drag to pan with a spring home, the Milky Way, ten Messier objects, the galactic core, the Kepler field, the Hubble Deep Field, the Voyagers, 15 named stars, active meteor radiants and the ISS drawn from real data; desk one-liners on hover; cited cards in stargaze mode; `content/sky-facts.ts` as their single source.
2. **Verification**: count 27; list `sky-drag`, `sky-objects`, `stargaze-card`, `sky-iss`; the node test list becomes `node --test scripts/test-sky-data.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs scripts/test-sky-objects.mjs scripts/test-sky-facts.mjs scripts/test-sky-iss.mjs`; `check-voice.mjs` gates `sky-facts.ts` too.
3. **Stack**: runtime deps are exactly `chess.js`, `onnxruntime-web`, `@vercel/analytics`, `satellite.js` (SGP4 for the ISS; lazy-imported only after `/api/iss-tle` returns a TLE). Hand-run generators gain `prepare-sky-objects.mjs`. Add the route: `app/api/iss-tle` is the site's only server code path, `revalidate = 7200` (works because `cacheComponents` is off), always 200, `{ tle: null }` on failure. If Task 6 Step 10's stub was needed, document it and why.
4. **Night sky + stargaze section**: replace the projection bullet's "pole at the centre of the viewport… `k` chosen so the viewport's half-diagonal reaches dec −30° (measured `k = 490.2` at 1440x900)" with the new rule (pole `(0.16W, 0.18H)` from 880px, `(0.22W, 0.10H)` below; farthest corner at dec −35°; measured `k = 737.6` at 1440x900) and the Polaris-under-the-sheet observation from Task 1 Step 11 with its numbers. Add bullets for: drag (`lib/sky-pan.ts`, closed-form spring, frame gate lifted only while live, touch drag only in stargaze, `touch-action: none` there); the objects gate per layer; the hover precedence (12 px symbols, 24 px lines); the card rules (click under 5 px, Escape capture-phase before the exit, follows its subject, closes off screen, docks below 880px, untracked citation links); the facts rules (no runtime imports, voice-gated except citation fields, every number in a cited source, `SKY_FACTS_PARTIAL=1` exists only for writing in batches); the ISS (TEME of date → `precessToJ2000`; 7-day TLE staleness gate; same-origin route); Voyager 2 is never on screen (dec −59.8° is past the −35° edge); IMO calendar fetched from the Wayback copy because imo.net was offline, pinned by SHA-256; constellation origins parsed from Wikipedia revision 1373165890, pinned by SHA-256. Extend the `window.__sky` key list with `cx`, `cy`, `offset`, `dragging`, `labelText`, `hits`, `radiants`, `layers`, `card`, `iss`.
5. **Model artifacts table**: add `public/sky/objects.json` (~15 KB, `prepare-sky-objects.mjs`) and `public/sky/milkyway.json` (~30 KB, 2,267 vertices).
6. **Hard-won traps**: add what was measured and surprising, with numbers: the Intl `"at"` glue in combined date-time formats (hence date and time formatted separately in SkyCard); Andromeda and the galactic core never both on a 1600x1000 canvas (why the checks pin separate instants); the three frame-time medians from Task 4 Step 8; anything else measured during Tasks 1-6. Add nothing unmeasured.
7. **Open items**: if the owner has not yet judged the moved pole at 1280-1440px, list it.

- [ ] **Step 5: README.md**

In "The pages" paragraph about the sky, mention dragging, the objects, the hover one-liners and the cited stargaze cards. Add a row to the hand-run generators table: `prepare-sky-objects.mjs` | derives `public/sky/objects.json` and `public/sky/milkyway.json` from pinned d3-celestial data, JPL Horizons (Voyager positions on the run date), the archived IMO 2026 calendar and a pinned Wikipedia revision | network access (GitHub raw, ssd.jpl.nasa.gov, web.archive.org, en.wikipedia.org). Replace the `node --test` line under "Verify before believing" with the six-file command from Step 2.

- [ ] **Step 6: Mark the spec implemented**

In `docs/superpowers/specs/2026-09-15-sky-objects-design.md`, change `Status: approved to build (owner, 2026-09-15: "go ahead and build all the new features now")` to `Status: implemented (plan docs/superpowers/plans/2026-09-15-sky-objects.md)`.

- [ ] **Step 7: Commit and hand off (no push)**

```bash
git add content/copy.ts CLAUDE.md README.md public/og.png docs/superpowers/specs/2026-09-15-sky-objects-design.md
git commit -m "docs: sky objects, drag, cards and the ISS; credit names the new sources; share card regenerated

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Stop the :3000 server (only that pid). Report to the owner: what shipped; the full verification output (27 checks, 45 node tests); the three frame-time medians against the 2.96 ms baseline; screenshots at 1440 and 400 in normal and stargaze mode, a card, and the ISS card; where Polaris sits relative to the sheet at 1280, 1440 and 1920; that Voyager 2 is never on screen; and the things only a real device can judge (drag feel and the docked card on the owner's iPhone, the Milky Way's brightness on a real display). Ask before pushing or merging: pushing `main` deploys production.

---

## Self-review (run at plan time against the spec)

**Spec coverage**

| spec | where |
|---|---|
| §1 owner decisions (pole top left, drag option 2, always-visible objects, two depths of trivia, cards for everything, the set, cited facts, branch) | Tasks 1-7 |
| §2 pole position, `k` rule, orientation, `chartFor`/`project`, sheet-avoiding labels kept | Task 1 Steps 1-3, 6; Task 4 Step 5 (`drawLabel`) |
| §3 where drag starts, touch only in stargaze, offset, rubber band at 0.45·min, spring ~700 ms on the dt clock, reduced-motion snap, 5 px click rule, hover suspended, `grabbing`, `preventDefault`, sky keeps turning | Task 1 Steps 4, 8, 9; `sky-drag` |
| §4 layer order and every layer in the table, colours, names hidden below 880 px, honesty lines (visibility, radiant drift, dated Voyagers, approximate Kepler outline) | Task 2 (data), Task 4 (drawing), Task 3 (visibility), Task 5 (drift and date lines), Task 6 (ISS) |
| §5 12 px symbols / 24 px lines, objects win, one-liner second line, constellation origin line, sheet-avoiding placement | Task 4 Steps 5-6; Task 3 Step 4 rule 4; `sky-hover`, `sky-objects` |
| §6 click opens, empty click closes, close button, Escape order, DOM `aside` with `aria-labelledby`, placement and clamping, bottom sheet below 880 px, content list, APA sources, untracked links, follows while turning and dragging, closes off screen | Task 5; `stargaze-card` |
| §7 `content/sky-facts.ts` schema, voice gate, citation format, coverage, constellation origins from the table plus 30 mythology cards, planets and Moon name origins, accuracy rule | Task 3; `test-sky-facts.mjs`; `check-voice.mjs` |
| §8 route with `revalidate = 7200` and `{ tle: null }` 200 fallback, `lib/sky-iss.ts` lazy satellite.js, topocentric RA/Dec + elevation + altitude + speed, one clock, card content, COOP/COEP | Task 6; `test-sky-iss.mjs`; `sky-iss` |
| §9 `prepare-sky-objects.mjs` outputs, assert-before-write, `milkyway.json` < 90 KB, fetched after first paint, per-layer gate | Task 2; Task 4 Steps 3, 6 |
| §10 frame budget 2x 2.96 ms, ≤ 4,000 Milky Way vertices, precomputation, phones | Task 2 asserts (2,267 vertices); Task 4 Step 8 and the `sky-animates-1280` gate; Task 1 (touch drag), Task 5 (docked card) |
| §11 `sky-orientation`/`sky-hover` updated, `sky-drag`, `sky-objects`, `stargaze-card`, `sky-iss`, three node tests | Tasks 1, 4, 5, 6 (plus `test-sky-pan.mjs` and helper tests) |
| §12 out of scope | nothing in this plan adds other satellites, precession circle, TRAPPIST-1/51 Peg, JWST's deep field, boundaries, asterisms, or a second clock |

**Placeholder scan.** No "TBD", "TODO", "implement later", "similar to Task N" or undefined helpers. The only intentionally unwritten content is the 136 remaining facts in Task 3, which the task specifies by id, schema, source, rule and test, with two worked examples and an audit script. Task 6 Step 10's stub is conditional on a named build error and carries its exact code.

**Type and name consistency.** Checked across tasks: `chartFor(width, height, lst, offset?)`, `Point`, `Vec`; `Highlight = { kind, id, pointer }` (Task 4 replaces `{ abbr, pointer }`; Task 1's NightSky code never reads `.abbr` after Task 4's edit 6h/6i); `Hit`, `View`, `Projected.hits`, `FrameInput.selectedId` (Task 4) used by Task 5's `followCard`/`subjectAt`; `CardModel`, `CardExtra` (Task 5) extended by Task 6's `iss` variant; `layers` gains `iss` in Task 6 and every consumer uses `Object.values` or named keys; `window.__sky` keys match between NightSky and every check (`cx`, `cy`, `offset`, `dragging`, `hits`, `radiants`, `labelText`, `layers`, `card`, `iss`); fact ids match hit ids (`mercury`… from `PLANETS[i].toLowerCase()`, `moon`, `iss`, `milky-way`). While planning, every code block in Tasks 1-6 was applied in order to a scratch copy of the worktree: `tsc --noEmit` clean, `test-sky-math` 17, `test-sky-pan` 4, `test-sky-objects` 11, `test-sky-facts` 5 (partial mode, two facts), `test-sky-iss` 3 all passing, the voice gate passing, and the sequentially edited `NightSky.tsx`, `sky-math.ts`, `verify-redesign.mjs`, `copy.ts`, `sky-render.ts`, `SkyCard.tsx`, `check-voice.mjs` and `test-sky-math.mjs` matching the tested files apart from comment wording and the `if (alive) paint();` lines added to the loaders' catch handlers (so a failed layer still refreshes the snapshot). The browser checks were not run (no production build was possible in the planning sandbox); their instant finders were run in node and produce the instants quoted above.

## Execution

Plan complete. Two execution options:

1. **Subagent-driven (recommended):** a fresh subagent per task, review between tasks (REQUIRED SUB-SKILL: superpowers:subagent-driven-development). Task 3 is long and prose-heavy; give it its own reviewer pass focused on the audit output.
2. **Inline:** execute in one session with checkpoints (REQUIRED SUB-SKILL: superpowers:executing-plans).
