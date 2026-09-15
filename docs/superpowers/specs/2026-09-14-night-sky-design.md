# Night sky + stargaze mode: design spec

Date: 2026-09-14 · Status: reviewed by the owner (open questions resolved, §12)
Replaces: `components/manuscript/DeskField.tsx` (the flow-field particles).
Binding context: CLAUDE.md (Constitution, Voice, Stack, traps). Where this spec
and CLAUDE.md disagree, CLAUDE.md wins until this spec is approved and folded in.

## 1. Summary

The desk behind the sheet becomes a real star atlas: the sky visible from NASA
Ames, drawn as a polar star chart with the north celestial pole hidden behind
the page, turning once every ~8 minutes. Real stars, thin constellation lines,
the naked-eye planets and the Moon at their computed positions. Hovering near a
constellation brightens it and names it. A "stargaze for a bit?" button hides
the page, unloads the heavy models, and gives the visitor the whole screen of
sky until they come back.

Owner decisions this spec locks (2026-09-14):
- Real sky, not procedural. Thin constellation lines. Planets and the Moon.
- Crisp stars (no trails). Star-atlas furniture (graticule, ecliptic, labels).
- Hover: the nearest constellation brightens and gets its name.
- A credit line saying what the sky is.
- On on phones too, for now; judged on the owner's iPhone after it ships.
- Same sky on `/`, `/lab` and the 404.
- One turn per ~8 minutes. Pole hidden behind the page.
- A "stargaze for a bit?" button that hides the page content and offloads the
  expensive models.
- Review answers (same day): a model run in flight when stargaze is pressed is
  CANCELLED; stargazing counts as `demo_used {demo: "stargaze"}`; no horizon
  line; constellation names in both languages, "Ursa Major (Great Bear)", the
  Latin larger and the English smaller and dimmer.

## 2. What is drawn

**Frame.** J2000 equatorial coordinates throughout (the star catalog's epoch;
precession since 2000 moves the pole ~0.14°, invisible at this scale). Planet
and Moon positions are computed in the same frame, so everything agrees.

**Projection.** Polar stereographic centred on the north celestial pole, pole
at the centre of the viewport (so behind the sheet on desktop), radius
`r = k · tan((90° − dec) / 2)`. `k` is one constant chosen so the viewport's
half-diagonal reaches declination −30°; set by eye once, recorded with the
number it produces at 1440×900.

**Orientation (sky view, as seen facing north).** Up the screen from the pole
points toward the zenith over Moffett Field (lat 37.4153° N, lon 122.0647° W);
east is to the right. A star's screen angle is `RA − LST`, measured from
straight up, positive to the right; so as local sidereal time advances the sky
turns counterclockwise, which is how the real sky turns around Polaris.

**Layers, back to front:**
1. Desk fill `#0c0b09` (unchanged token).
2. Graticule: declination circles at +60°, +30°, 0°, −30°; hour-angle spokes
   every 2h; hairline, `--color-hair`/`--color-rule` strength. The celestial
   equator slightly stronger than the other circles. Mono labels (`0h`, `2h`,
   …; `+30°`) set upright along the 0° circle and one spoke.
3. Ecliptic: dashed, faint `--color-mut`.
4. Constellation lines: 88 IAU constellations, 1px (device-independent),
   `mut` at low alpha.
5. Stars: magnitude ≤ 5.0 on desktop (≤ 4.5 on phones), radius and alpha from
   magnitude, a faint tint from B−V (blue-white to amber), never saturated.
6. Planets: Mercury, Venus, Mars, Jupiter, Saturn as small `--color-warm`
   discs with a mono name beside each, always shown.
7. Moon: an ink disc with its real phase (lit fraction and bright-limb angle
   from the Sun's position), drawn at least 8px across, labelled.
8. Hover highlight (§4) on top.

No red anywhere: red stays reviewer's ink. The cursor scatter goes away with
the particles.

## 3. Time and motion

**One simulated clock drives everything.** `simTime = loadTime + (now −
loadTime) × 180`. 180× turns the sky once per 23.934 h / 180 ≈ 7.98 min. LST,
planet positions and the Moon all read `simTime`, so the Moon visibly drifts
against the stars (~1.6° per real minute) instead of freezing. Planets and the
Moon are recomputed every ~3 real seconds (10 simulated minutes); stars need no
recompute, only the rotation.

**At load the sky is the real sky over NASA Ames at that instant.**

**Frame budget.** Angles come from the clock, never per-frame increments (the
Constitution's dt rule). Redraw at ~20 fps on desktop, ~10 fps below 880px.
Skip frames while `document.hidden`. DPR capped at 2 so stars stay crisp.
Every frame is a full redraw of ≤ ~1,700 stars + lines + labels; the frame cost
gets measured (§10), not assumed.

**Reduced motion:** one static frame at the real current sky (no speed-up),
never animated. Hover and stargaze still work; the hover redraws once per
change.

**Canvas fonts:** labels resolve Spline Sans Mono's real family through
`getComputedStyle` first (CLAUDE.md trap: `ctx.font` ignores CSS variables).

## 4. Hover and names

- Active only when the pointer is over the desk, not the sheet: normal mode
  hit-tests against the sheet's bounding rect; stargaze mode uses the whole
  screen.
- The nearest constellation line segment within 24px of the pointer wins. Its
  lines and member stars brighten to `--color-ink`; its name appears at the
  constellation's label anchor from the data file, on one line: the Latin IAU
  name in mono at the label size in `--color-ink`, then the English meaning in
  parentheses, smaller and in `--color-mut` ("Ursa Major (Great Bear)").
  Constellations named after a mythological figure (Orion, Andromeda,
  Cassiopeia…) have no separate English meaning and show the Latin alone; a
  duplicate "Orion (Orion)" never renders.
- Serpens is one constellation in two disjoint parts (Caput and Cauda). Both
  parts' lines highlight together; the name shows at the anchor of the part
  nearest the pointer.
- Touch: no hover in normal mode (the margins are 16px). In stargaze mode a tap
  selects the nearest constellation, and a tap on empty sky clears it.
- The canvas stays `aria-hidden`; names are decoration for sighted pointer
  users and claim nothing (§8 covers the accessible side).

## 5. Stargaze mode

**Entry.** A mono button reading "stargaze for a bit?" in the desk margin above
the sheet, right-aligned to the sheet's edge, on every page. It renders from
`app/layout.tsx`, so no page becomes a client component.

**What happens on entry:**
1. `<body data-stargaze>` is set. CSS fades every `main` out and then makes it
   `visibility: hidden`; the content also gets `inert`. Nothing unmounts: a
   chess game, a drawing, a slider position and the scroll position all
   survive.
2. A "back to the page" control appears top-right; Escape does the same.
3. The sky switches to whole-screen hit-testing and tap-to-name; the credit
   line pins to the bottom of the viewport.
4. Everything animated on the page pauses: the flight video (explicitly, since
   a hidden video can still intersect), the /lab animations.
5. **Offload.** The expensive models are released:
   - **Chess:** the worker is terminated and the engine's memoized loader is
     reset. This frees its memory completely. An in-flight search is
     abandoned; the panel treats that as "engine idle", keeps the game, and the
     next engine call spins up a new worker (files come from the HTTP cache).
   - **Draw and headshot:** each `InferenceSession` is released and its
     memoized loader reset. **A run in flight is cancelled** (owner call), at
     the next step boundary, then released. Neither vendored sampler has an
     abort option, and neither gets one: both call the site's `onFrame` after
     every model step, between `session.run` calls, so the site's callback
     throws a `StargazeAbort` sentinel and the sampler's promise rejects with
     the session idle. Vendored math is untouched. Rules, all silent-failure
     traps if broken:
     - **Throw, never return early.** CLAUDE.md's draw trap (3): returning
       from `onFrame` skips the module's event-loop yield and locks the page;
       a throw exits the loop instead.
     - The zero-shot classifier runs `generate()` with no `onFrame` (so no
       hook inside a reconstruction); it is cancelled between its ten
       reconstructions by checking the abort flag in the site's own loop
       (`lib/classify.ts`), at most one reconstruction late.
     - Release happens only after the cancelled promise has settled, and
       respects `classifyingRef`/`runningRef` (the shared-session exclusion).
     - The panels treat `StargazeAbort` as a quiet reset to their idle state:
       no "model failed" message, the half-finished frame is cleared rather
       than left looking like a result, and no `demo_used` fires for a
       cancelled run. A drawing's strokes survive (they are canvas pixels, not
       model output).
     - The headshot's transition `init` is cleared (it must come from a
       completed run), so the next press samples from noise and the readout
       says so.
   - The idle warm-up (`lib/warm.ts`) is skipped if it has not fired yet.

   ⚠️ **Honest limit, measured before any copy claims it:** draw and headshot
   run on the main thread and share one ORT WebAssembly heap, and WebAssembly
   memory never shrinks. Releasing their sessions frees space inside that heap
   for reuse, but the tab's footprint stays at its high-water mark until a
   reload. Only the chess worker's memory truly goes back. So the UI never
   says "memory freed"; if it says anything, it says the models were unloaded
   and will reload when you come back, which is true. (A draw worker, one of
   the fixes on the table for the iOS crash, would make its release real.)

**Return.** Remove `data-stargaze`; content fades back; the sky returns to
margin hit-testing. Models reload lazily on the next real use, each panel
showing its normal loading status. Nothing preloads on return.

**Analytics (owner call):** entering stargaze fires `trackDemoOnce("stargaze")`,
so `demo_used {demo: "stargaze"}` at most once per page load. No new event
name, so the two-event rule holds; `trackDemoOnce`'s union type grows one
member.

## 6. Data pipeline

`scripts/prepare-sky.mjs`, hand-run like `prepare-research.mjs`, output
committed, never run on Vercel.

- **Sources**, fetched from a pinned commit of d3-celestial (BSD-3-Clause):
  `stars.6.json` (Extended Hipparcos Compilation, Anderson & Francis 2012),
  `constellations.lines.json` and `constellations.json` (IAU lines and names).
  The license text and the commit hash are recorded in the output.
- **English meanings** do NOT come from d3-celestial: its `en` field is not a
  translation (it calls Ursa Major "Big Dipper", an asterism). They come from
  the "Meaning" column of Wikipedia's "IAU designated constellations" table,
  transcribed once into a table inside the script, title-cased ("Great Bear",
  "Greater Dog", "Swan"). Entries whose meaning is a mythological figure
  ("Orion (mythological character)") get no English meaning. The source URL
  and access date are recorded in the output.
- **Serpens:** the file has 89 entries for 88 constellations because Serpens
  is split into Caput and Cauda; the script merges them under one `Ser` with
  two line sets and two label anchors.
- **Output:** `public/sky/sky.json`:
  `{ version, epoch: "J2000", source: { repo, commit, license },
  stars: [[ra, dec, mag, bv], …], lines: { abbr: [[[ra, dec], …], …] },
  constellations: { abbr: { latin, english | null, labels: [[ra, dec], …] } } }`,
  degrees at 0.01° precision, stars sorted brightest first (so a phone can
  take a prefix).
- **Assert before write:** exactly 88 constellations after the Serpens merge,
  each with lines, a Latin name and at least one label; every English meaning
  present in the table maps to a real abbreviation, and `UMa` reads "Ursa
  Major" / "Great Bear"; star count in the expected range for mag ≤ 5.0 (~1,600); Polaris
  within 0.1° of dec +89.26°; Sirius present at mag ≈ −1.46; the file under
  60 KB. Nothing is written if any assert fails.
- **Loading:** fetched after first paint by the sky component, never bundled.
  If the fetch fails the desk stays plain dark: no stand-in sky, no particles.

## 7. Ephemeris

`lib/sky-ephemeris.ts`, small and dependency-free.

- **Sidereal time:** GMST from the standard IAU 1982 expression, plus Moffett
  Field's longitude.
- **Planets:** JPL "Approximate Positions of the Planets", Table 1 Keplerian
  elements (valid 1800–2050). Heliocentric ecliptic positions for each planet
  and the Earth-Moon barycentre, geocentric by difference, rotated to J2000
  equatorial. (The barycentre stands in for Earth; the offset is negligible at
  planet distances.)
- **Moon:** a truncated Meeus (Astronomical Algorithms, ch. 47) series for
  geocentric longitude, latitude and distance. Geocentric, not topocentric:
  lunar parallax (≤ 1°) is ignored and noted here.
- **Sun** (for the Moon's phase): the negative of the barycentre's
  heliocentric vector.
- **Validation, not trust:** `scripts/verify-sky-ephemeris.mjs` compares against
  `astronomy-engine` (MIT), added as a **devDependency only**, over a grid of
  dates 2026–2030: GMST within 1 s; planets within 0.25° (JPL's own stated
  errors for Jupiter and Saturn are several arcminutes); the Moon within 0.3°.
  Runtime dependencies stay exactly as CLAUDE.md lists them.

Alternative considered: `astronomy-engine` at runtime. More accurate, no
hand-written orbital code, but it adds a runtime dependency and tens of KB to
the client for an accuracy nobody can see at ~10–20 px per degree.

## 8. Copy and accessibility

New `copy.stargaze` namespace, voice-gated, Wikipedia "Signs of AI writing"
pass before final:
- `enter`: "stargaze for a bit?" (owner's words)
- `exit`: "back to the page"
- `hintPointer` / `hintTouch`: "hover a constellation" / "tap a constellation"
- `credit` (draft): "The sky over NASA Ames, from the moment you arrived,
  turning 180 times faster than the real one. Stars from the Extended
  Hipparcos Compilation; lines and names from d3-celestial."

Accessibility: both buttons are real `<button>`s with visible focus. Entering
moves focus to "back to the page"; leaving returns it to the entry button.
Hidden content is `inert`, so keyboard and screen-reader users can't land in
it. Reduced motion makes the fade instant.

## 9. Files

New: `components/manuscript/NightSky.tsx` (replaces `DeskField.tsx`, which is
deleted), `components/manuscript/StargazeToggle.tsx`, `lib/sky-data.ts` (loader
+ types), `lib/sky-ephemeris.ts`, `lib/stargaze.ts` (mode store + offload
orchestration), `scripts/prepare-sky.mjs`, `scripts/verify-sky-ephemeris.mjs`,
`public/sky/sky.json`.

Modified: `app/layout.tsx`, `app/globals.css`, `lib/chess-engine.ts`,
`lib/draw-model.ts`, `lib/headshot-model.ts` (an unload function each),
`lib/classify.ts` (abort check between reconstructions), `lib/track.ts`
(`"stargaze"` joins the demo union),
`components/ChessPanel.tsx`, `components/DrawDigit.tsx`,
`components/figures/HeadshotToy.tsx`, `components/figures/FlightFigure.tsx`
(react to unload/pause), `content/copy.ts`, `scripts/verify-redesign.mjs`,
`package.json` (devDependency), CLAUDE.md, README.md; `public/og.png`
regenerated.

## 10. Verification

`scripts/verify-redesign.mjs` changes, all against a production build:
- The three desk-field checks become `sky-animates-1280`,
  `sky-static-reduced-motion` and **`sky-present-400`** (the old
  `desk-field-absent-500` inverts: the owner wants it on phones).
- `sky-orientation`: Playwright's clock pinned to a known instant. The sky
  component exposes a read-only `window.__sky` snapshot (simulated time, LST,
  projected screen positions of a few named bodies). The check asserts LST
  against an independent computation, then bright canvas pixels at Vega's and
  the Moon's projected positions (a canvas screenshot, not a number agreeing
  with itself).
- `sky-hover`: pointer placed at a projected point on Orion's lines in the
  margin → snapshot reports `Ori` highlighted and the canvas brightened there.
- `stargaze-offload`: on a page where chess has loaded and a stroke has been
  auto-labelled, enter stargaze → `main` is inert and hidden, the chess worker
  is terminated (counted via an init-script `Worker` wrapper), the draw session
  released; Escape returns; the chess hint again returns `g3 p=0.236` and a new
  stroke again auto-labels (both models genuinely reloaded).
- `stargaze-cancels-run`: start a draw generation and a headshot run, enter
  stargaze mid-run → both stop within one step (the step counters stop
  advancing), neither panel shows a failure, no `demo_used` is queued for the
  cancelled runs, `demo_used {demo: "stargaze"}` is queued exactly once across
  two entries; after returning, a fresh generate completes normally.
- `stargaze-no-fetch`: entering stargaze on a fresh page fetches nothing
  model-sized.
- Existing checks keep passing, including `no-early-heavy-payload-400`.
- Frame cost: median frame draw time logged by the animates check (headless
  Firefox as a floor, not a claim), then eyeballed on the owner's iPhone.

Plus `node scripts/verify-sky-ephemeris.mjs` (§7) and `gen-og.mjs` re-run.

## 11. Out of scope

A horizon line for Moffett Field (owner: leave it out); topocentric Moon parallax; Uranus and Neptune; the Sun; constellation
boundaries; star names; a sky for the visitor's own location (would need
geolocation permission). The iOS draw-demo crash is a separate item: stargaze
offload doesn't fix it.

## 12. Resolved questions (owner, 2026-09-14)

1. A run in flight when stargaze is pressed is **cancelled** (§5).
2. Stargazing **counts** as `demo_used {demo: "stargaze"}`, once per load (§5).
3. **No horizon line** (§11).
4. Names in **both languages**, Latin larger, English smaller and dimmer (§4).
