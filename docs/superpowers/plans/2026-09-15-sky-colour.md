# Night sky colour + structured renders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the stargaze sky sourced colour and per-object structured renders, and add thirteen new deep-sky objects with full cards.

**Architecture:** Colour is a render input (`colour: boolean`) threaded through `View`/`FrameInput` from `isStargazing()`, so normal mode is byte-for-byte unchanged and there is exactly one draw path per object kind, not two. A module-level `OBJECT_COLOURS` table in `lib/sky-layers.ts` holds sourced palettes; `prepareObjectGlyphs` in `lib/sky-objects.ts` gains a `variant` naming each object's real structure, and each variant gets one draw function. All shapes stay deterministic (seeded hash, never `Math.random`) and prepared once per catalog load.

**Tech Stack:** TypeScript, Canvas 2D, Next.js 16 App Router, node:test, Playwright-Firefox.

**Spec:** `docs/superpowers/specs/2026-09-15-sky-colour-design.md`

**Research inputs (produced before this plan, read them, do not re-derive):**
- `.superpowers/sdd/position-sources.md` — where each new object's J2000 position comes from, with the exact queries that were run.
- `.superpowers/sdd/colour-sources.md` — each object's documented long-exposure colour, the physical reason, and verified citations.

## Global Constraints

- **No `Math.random` anywhere in the sky.** Every scatter, blob and filament seeds from the object's id through the existing `hashSeed`/`mulberry32` in `lib/sky-objects.ts`. The sky must be identical for every visitor on every load.
- **Colour is stargaze-only.** With `colour: false` the rendered output must be unchanged from `main`. This is asserted from both sides in Task 8.
- **Every colour and every number is sourced.** No uncited claim ships. If a source could not be verified, the object keeps its grey treatment and the omission is recorded. A missing colour is cheap; an invented one is not.
- **Never present false colour as real colour.** Narrowband/Hubble-palette images map sulphur/hydrogen/oxygen to R/G/B and are not the object's appearance. `colour-sources.md` flags which objects this affects; those use documented broadband colour or stay grey.
- **Positions are never hand-typed.** They come through `scripts/prepare-sky-objects.mjs` from a pinned or stable source, asserted before write, same as every existing object.
- **Shapes are prepared once per catalog load**, never per frame. The paint loop only translates/transforms already-placed points.
- **Voice gate binds all copy**: `scripts/check-voice.mjs` scans `content/copy.ts` and `content/sky-facts.ts`. No em-dashes, no banned words, sentence case, concrete over adjectival.
- **`lib/sky-math.ts` keeps zero imports** (node tests import it directly). `lib/sky-render.ts` stays pure: no state, no clock, no stargaze store read.
- **Frame budget**: `window.__sky.frameMsMedian` stays under 5.92ms at 1280px. Current baseline 2.40-2.48ms.
- **Verify on a production build on :3000**, never the dev server. Port 3001 is the owner's own dev server: never touch it.
- The full existing suite stays green: 29 Playwright checks, 49 node tests, voice gate, `verify-headshot-256.mjs`.

---

### Task 1: Catalog — thirteen new objects through the pipeline

**Files:**
- Modify: `scripts/prepare-sky-objects.mjs`
- Modify (generated output, committed): `public/sky/objects.json`
- Test: `scripts/test-sky-objects.mjs`

**Interfaces:**
- Consumes: `.superpowers/sdd/position-sources.md`.
- Produces: `objects.json` with 43 objects, each new one carrying `id`, `name`, `designation`, `symbol`, `raDeg`, `decDeg`, and `mag`/`axisRatio` where the source has them. Task 2 keys its facts off these exact ids; Tasks 4-5 key palettes and variants off them too.

- [ ] **Step 1: Read the research file**

Read `.superpowers/sdd/position-sources.md` first. Its finding, already verified: **every one of the thirteen is present in the d3-celestial commit the script already pins. No new external source is needed.**

- Eight come from `messier.json`, which the script already fetches: M16, M20, M27, M33, M78, M81, M82, M104. Add them to the `MESSIER` table exactly like the existing ten.
- Four come from `dsos.6.json`, at the same pinned commit, which the script does **not** fetch yet: Horsehead (B33), Flame (NGC 2024), Double Cluster (NGC 869 and NGC 884), North America (NGC 7000).
- The Veil is absent from `dsos.6.json` but present in `dsos.14.json`, same commit.

Four gaps the research file names, all of which will fail the script's own gates if missed:

1. `SYMBOL_FOR_TYPE` lacks `dn` (dark nebula) and `bn` (bright nebula). Add them with a comment.
2. `dsos` entries carry no common-name field; join against `dsonames.json`. "Veil Nebula" and "Double Cluster" are not in it, so those names are hand labels, the same way some existing Messier names already are. Mark them in a comment as hand-labelled.
3. **NGC 2024's magnitude is a `"999"` sentinel, not a magnitude.** It must never reach the card. Treat any mag at or above a sentinel threshold as absent.
4. The Double Cluster and the Veil are each **two separate sourced objects**, not one. Do not invent a midpoint. That makes fifteen new objects for thirteen names, and `objects.json` ends at 45, not 43. Use ids `ngc869`/`ngc884` and `ngc6960`/`ngc6992`, and give each pair names that read correctly on their own card.

Do not hand-type any coordinate. If something does not match the research file, stop and report rather than improvising.

- [ ] **Step 2: Write the failing test**

Add to `scripts/test-sky-objects.mjs`:

```js
test("objects.json carries the colour-round additions", () => {
  const ids = new Set(data.objects.map((o) => o.id));
  for (const id of ["horsehead", "flame", "m20", "m27", "m16", "m33", "m81", "m82", "m104", "m78",
                    "ngc869", "ngc884", "ngc6960", "ngc6992", "ngc7000"]) {
    assert.ok(ids.has(id), `${id} missing from objects.json`);
  }
  assert.equal(data.objects.length, 45);
});

test("no object displays a sentinel magnitude", () => {
  for (const o of data.objects) {
    if (o.mag === undefined) continue;
    assert.ok(o.mag > -30 && o.mag < 30, `${o.id} mag ${o.mag} is a sentinel, not a magnitude`);
  }
});

test("every object is north of the chart edge and has a usable position", () => {
  for (const o of data.objects) {
    if (o.id === "voyager-2") continue; // known: dec -59.8, has a card but never draws
    assert.ok(o.decDeg > -35, `${o.id} at dec ${o.decDeg} is south of the chart edge`);
    assert.ok(Number.isFinite(o.raDeg) && o.raDeg >= 0 && o.raDeg < 360, `${o.id} bad ra`);
  }
});
```

Adjust the id list to match whatever Step 1 settled, and say so in your report.

- [ ] **Step 3: Run it to confirm it fails**

Run: `node scripts/test-sky-objects.mjs`
Expected: FAIL, the new ids are missing.

- [ ] **Step 4: Extend the script**

Add the eight Messier entries to `MESSIER`. For the non-Messier five, add a fetch + parse + assert path mirroring how the script already handles its other pinned sources (`get()` with retry, a hash or revision pin where the source allows one, `fail()` on anything unexpected). Follow the existing `SYMBOL_FOR_TYPE` mapping; extend it only if the source uses a type code the table lacks, and comment why.

The Veil and the Double Cluster are extended/double objects. Represent each as `position-sources.md` recommends, and record the choice in a code comment, since a reader will otherwise wonder why one id covers two NGC numbers.

- [ ] **Step 5: Regenerate and verify the diff**

Run: `node scripts/prepare-sky-objects.mjs`

Then inspect `git diff public/sky/objects.json`. The existing 30 objects must be **unchanged**; only additions. If any existing object's numbers moved, stop and report it, that means a source shifted under us and is not something to absorb silently.

- [ ] **Step 6: Run the tests**

Run: `node scripts/test-sky-objects.mjs && node scripts/test-sky-data.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/prepare-sky-objects.mjs scripts/test-sky-objects.mjs public/sky/objects.json
git commit -m "sky: add thirteen deep-sky objects to the catalog"
```

---

### Task 2: Thirteen sourced cards

**Files:**
- Modify: `content/sky-facts.ts`
- Test: `scripts/test-sky-facts.mjs`

**Interfaces:**
- Consumes: Task 1's object ids; `.superpowers/sdd/colour-sources.md`.
- Produces: a `SkyFact` for every new id, so `NightSky`'s existing card path works with no code change.

This is the round's most error-prone task. **A wrong number on a sourced card costs more than a missing object.**

- [ ] **Step 1: Read the rules and the research**

Read `content/sky-facts.ts`'s header comment (the binding rules) and an existing galaxy and nebula entry to match shape and register. Then read `.superpowers/sdd/colour-sources.md`.

- [ ] **Step 2: Write the failing test**

Extend `scripts/test-sky-facts.mjs`:

```js
test("every object in objects.json has a fact", () => {
  for (const o of objects.objects) {
    assert.ok(FACTS[o.id], `no fact for ${o.id}`);
  }
});

test("every citation is structurally complete", () => {
  for (const [id, f] of Object.entries(FACTS)) {
    assert.ok(f.citations.length >= 1, `${id} has no citation`);
    for (const c of f.citations) {
      for (const k of ["author", "year", "title", "site", "url", "accessed"]) {
        assert.ok(c[k] && String(c[k]).trim(), `${id} citation missing ${k}`);
      }
      assert.match(c.url, /^https:\/\//, `${id} citation url is not https`);
      assert.match(c.accessed, /^\d{4}-\d{2}-\d{2}$/, `${id} bad accessed date`);
    }
  }
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `node scripts/test-sky-facts.mjs`
Expected: FAIL, missing facts for the new ids.

- [ ] **Step 4: Write the fifteen entries**

One per new object id (fifteen, since the Double Cluster and the Veil are two objects each): `kind` (e.g. "Emission nebula · 7,000 light-years"), `oneLiner` (a label, at most 64 characters), `body` (one to three sentences), `visibility` (starts with "Naked eye", "Binoculars", "Telescope" or "Not visible"), `citations`.

**Only use citations that `colour-sources.md` records as personally fetched and 200.** If an object's sourcing is thin, write a shorter card rather than padding it with an unsourced sentence.

Two specific traps the research already surfaced:

- **Distances disagree across sources**, sometimes widely (the Veil spans 1,500 to 2,400 light-years depending on who you ask). Do not invent false precision by picking one silently. Either cite the figure to the source you took it from, or give the range. The site's standing rule is that honest numbers beat impressive ones.
- **NGC 869 and NGC 884 share a sky and a nickname but get their own cards.** Each card should stand alone while making the pairing clear. Same for NGC 6960 and NGC 6992 as two sides of one supernova remnant.

- [ ] **Step 5: Run the tests and the voice gate**

Run: `node scripts/test-sky-facts.mjs && node scripts/check-voice.mjs`
Expected: both PASS. The voice gate scans `kind`, `oneLiner`, `body`, `visibility`; citation fields are the sources' own words and are not scanned.

- [ ] **Step 6: Verify every new URL actually resolves**

For each new citation URL, fetch it and confirm HTTP 200 and that the page carries the claim. Paste the status codes into your report. Do not skip this: last round a reviewer fetched all 143 citations, and this one will too.

- [ ] **Step 7: Commit**

```bash
git add content/sky-facts.ts scripts/test-sky-facts.mjs
git commit -m "facts: sourced cards for the thirteen new deep-sky objects"
```

---

### Task 3: Colour plumbing, no visual change yet

**Files:**
- Modify: `lib/sky-layers.ts`, `lib/sky-render.ts`, `components/manuscript/NightSky.tsx`
- Test: `scripts/test-sky-objects.mjs`

**Interfaces:**
- Produces: `View.colour: boolean`, `FrameInput.colour: boolean`, and `OBJECT_COLOURS: Record<string, ObjectPalette>` exported from `lib/sky-layers.ts`. Tasks 4-6 consume all three.

This task deliberately ships **no visible change**. It exists so the later tasks have one seam to hang colour on and so a reviewer can confirm normal mode is untouched before any colour lands.

- [ ] **Step 1: Add the flag**

Add `colour: boolean` to `View` (`lib/sky-layers.ts`) and `FrameInput` (`lib/sky-render.ts`), documented as "stargaze only; false means draw today's greys". Thread it in `NightSky`'s frame input from `isStargazing()`, beside the existing `names`. `lib/sky-render.ts` must not import the stargaze store: the value arrives as data.

- [ ] **Step 2: Define the palette type and table**

In `lib/sky-layers.ts`, beside the existing `INK`/`MUT`/`WARM` constants:

```ts
/** Sourced long-exposure colours, "r,g,b" so each draw site picks its own
 *  alpha (same shape as INK/MUT/WARM). Stargaze only. Sources:
 *  .superpowers/sdd/colour-sources.md — every entry here traces to a
 *  citation on that object's card. An id absent from this table draws grey. */
export type ObjectPalette = {
  /** Body/cloud fill. */ base: string;
  /** Core, bulge or inner region where the structure has one. */ core?: string;
  /** Arms, rim or filaments where the structure has one. */ accent?: string;
};
export const OBJECT_COLOURS: Record<string, ObjectPalette> = { /* Task 4-5 fill */ };
```

Leave the table empty in this task; Tasks 4 and 5 populate the half each one draws.

- [ ] **Step 3: Write the failing test**

In `scripts/test-sky-objects.mjs`, assert the contract that keeps colour honest:

```js
test("every coloured object has a fact that cites its colour source", async () => {
  const { OBJECT_COLOURS } = await import("../lib/sky-layers.ts");
  for (const id of Object.keys(OBJECT_COLOURS)) {
    assert.ok(FACTS[id], `${id} has a palette but no card to cite it on`);
    assert.ok(FACTS[id].citations.length >= 1, `${id} colour is uncited`);
  }
});
```

If importing a `.ts` file from node is awkward here, follow whatever pattern the existing sky node tests already use for typed modules rather than inventing a new one, and say in your report what you did.

- [ ] **Step 4: Run the suite**

Run: `node scripts/test-sky-objects.mjs`
Expected: PASS (the table is empty, so the loop is vacuous, and that is fine; it becomes load-bearing in Tasks 4-5).

- [ ] **Step 5: Confirm nothing changed visually**

Build and screenshot the sky in normal mode and in stargaze; both must match `main`. Run `node scripts/verify-redesign.mjs sky-` to confirm the sky checks still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/sky-layers.ts lib/sky-render.ts components/manuscript/NightSky.tsx scripts/test-sky-objects.mjs
git commit -m "sky: thread a stargaze-only colour flag through the renderer"
```

---

### Task 4: Galaxy variants

**Files:**
- Modify: `lib/sky-objects.ts` (variant on the prepared glyph), `lib/sky-layers.ts` (draw functions + palette entries)
- Test: `scripts/test-sky-objects.mjs`

**Interfaces:**
- Consumes: `View.colour`, `ObjectPalette`, `OBJECT_COLOURS` from Task 3; object ids from Task 1.
- Produces: `GalaxyGlyph` gains `variant: "spiral" | "spiral-companion" | "elliptical" | "edge-on" | "starburst"`. Task 5 follows the same pattern for nebulae and clusters; do not change the existing `ObjectGlyph` union's other members.

- [ ] **Step 1: Add the variant to the prepared glyph**

Extend the `GALAXY_PX` table and `prepareObjectGlyphs` so each galaxy carries its variant and whatever extra placed geometry it needs (M51's companion offset, M87's jet angle and length, M104's lane). Everything deterministic and prepared here, not at draw time.

Assignments: `spiral` = M31, M33, M81; `spiral-companion` = M51; `elliptical` = M87; `edge-on` = M104; `starburst` = M82.

- [ ] **Step 2: Write the failing test**

```js
test("galaxy glyphs carry the right variant and are deterministic", async () => {
  const { prepareObjectGlyphs } = await import("../lib/sky-objects.ts");
  const a = prepareObjectGlyphs(data.objects);
  const b = prepareObjectGlyphs(data.objects);
  assert.equal(a.get("m31").variant, "spiral");
  assert.equal(a.get("m87").variant, "elliptical");
  assert.equal(a.get("m104").variant, "edge-on");
  assert.equal(a.get("m82").variant, "starburst");
  assert.equal(a.get("m51").variant, "spiral-companion");
  assert.deepEqual(JSON.parse(JSON.stringify(a.get("m31"))), JSON.parse(JSON.stringify(b.get("m31"))));
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `node scripts/test-sky-objects.mjs`
Expected: FAIL, `variant` undefined.

- [ ] **Step 4: Implement the draw functions**

One function per variant in `lib/sky-layers.ts`. Each takes `(ctx, point, glyph, palette | null)`; a null palette (colour off, or no table entry) draws today's grey shape. Populate `OBJECT_COLOURS` for these six ids from `colour-sources.md`.

Keep the existing rule that the core is drawn outside the rotate/scale so it stays round.

- [ ] **Step 5: Screenshot and judge**

Build, enter stargaze, and screenshot each galaxy at 1440px. Andromeda's core must read warm against blue arms; M87's jet must be visible; the Sombrero's lane must read as a lane. Attach the screenshots to your report. **The chart as a whole must still read as a star chart, not a poster** — if it does not, reduce alpha before anything else.

- [ ] **Step 6: Run the tests**

Run: `node scripts/test-sky-objects.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/sky-objects.ts lib/sky-layers.ts scripts/test-sky-objects.mjs
git commit -m "sky: structured, sourced-colour galaxy renders"
```

---

### Task 5: Nebula and cluster variants

**Files:**
- Modify: `lib/sky-objects.ts`, `lib/sky-layers.ts`
- Test: `scripts/test-sky-objects.mjs`

**Interfaces:**
- Consumes: everything Tasks 3-4 produced.
- Produces: `NebulaGlyph` gains `variant: "emission" | "planetary" | "remnant" | "reflection" | "dark"`; `ClusterGlyph` gains `variant: "globular" | "open"`.

- [ ] **Step 1: Assign variants**

`emission` = M8, M16, M20, M42, NGC 7000, the Flame (NGC 2024). `planetary` = M27, M57. `remnant` = M1, NGC 6960 and NGC 6992. `reflection` = M78 (and the Pleiades' nebulosity, drawn as part of M45's cluster glyph). `dark` = the Horsehead. `globular` = M13. `open` = M44, M45, NGC 869 and NGC 884.

**⚠️ The Veil is the round's false-colour trap (spec R2).** Its famous teal-and-red is the Hubble palette, a narrowband mapping of oxygen, sulphur and hydrogen onto blue, green and red. That is a data visualisation, not the object's appearance. `colour-sources.md` carries the ESA/Hubble source saying so in its own words. Render the Veil in its documented **broadband** colour, which is far more muted and red-dominant, or leave it grey. Do not reach for the image everyone recognises. The same question gets asked of every other emission object before its palette is written; `colour-sources.md` marks which are true broadband (M78's scattering blue and NGC 7000's hydrogen red both are).

**The Horsehead only reads as a silhouette if something is drawn behind it.** Draw its IC 434 backdrop as part of the same glyph. If that cannot be made to read at this size, fall back to a plain marker and say so rather than shipping a dark smudge on a dark sky.

- [ ] **Step 2: Write the failing test**

```js
test("nebula and cluster glyphs carry the right variant", async () => {
  const { prepareObjectGlyphs } = await import("../lib/sky-objects.ts");
  const g = prepareObjectGlyphs(data.objects);
  assert.equal(g.get("m57").variant, "planetary");
  assert.equal(g.get("m42").variant, "emission");
  assert.equal(g.get("m1").variant, "remnant");
  assert.equal(g.get("m78").variant, "reflection");
  assert.equal(g.get("m13").variant, "globular");
  assert.equal(g.get("m45").variant, "open");
});

test("no palette entry lacks a variant to draw it", async () => {
  const { OBJECT_COLOURS } = await import("../lib/sky-layers.ts");
  const g = prepareObjectGlyphs(data.objects);
  for (const id of Object.keys(OBJECT_COLOURS)) {
    assert.ok(g.get(id), `${id} has a palette but prepares no glyph`);
  }
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `node scripts/test-sky-objects.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement the draw functions and fill the palette**

One per variant. M57 keeps its annulus, now blue-green inside with a red rim. The Crab gets filaments over a diffuse interior. Open clusters get blue-white stars, the globular yellowish.

- [ ] **Step 5: Screenshot and judge**

Same gate as Task 4 Step 5, plus: the Trifid should show both its pink emission and its blue reflection halves, since that two-colour split is the object's whole identity.

- [ ] **Step 6: Run the tests**

Run: `node scripts/test-sky-objects.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/sky-objects.ts lib/sky-layers.ts scripts/test-sky-objects.mjs
git commit -m "sky: structured, sourced-colour nebula and cluster renders"
```

---

### Task 6: The Milky Way's colour

**Files:**
- Modify: `lib/sky-layers.ts`

**Interfaces:**
- Consumes: `View.colour`.
- Produces: no new exported symbol; `drawMilkyWay` reads the flag.

- [ ] **Step 1: Colour the levels and the grain**

The band photographs warm, tan through gold, brightening toward the core, with dark rifts. Today's five `MILKY_WAY_LEVEL_ALPHA` fills and five `MILKY_WAY_GRAIN_ALPHA` stipple passes become colour-aware: with `colour: false` they use `INK` exactly as now; with `colour: true` they ramp from a cooler outer tone to a warmer core. Take the actual colour from `colour-sources.md`.

Do not add new geometry. The existing levels and grain already carry the structure; this is a fill-style change.

- [ ] **Step 2: Screenshot at 1440px in both modes**

Normal mode must be pixel-identical to `main`. Stargaze must show a warm band with the core visibly warmer, and the dark rifts must still read. Attach both.

- [ ] **Step 3: Run the sky checks**

Run: `node scripts/verify-redesign.mjs sky- stargaze-`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/sky-layers.ts
git commit -m "sky: warm the Milky Way band in stargaze"
```

---

### Task 7: Copy — the colour note and the card line

**Files:**
- Modify: `content/copy.ts`, `components/manuscript/SkyCard.tsx`, `components/manuscript/NightSky.tsx`

**Interfaces:**
- Consumes: `OBJECT_COLOURS` (to decide which cards show the line).
- Produces: `CardModel.colourNote?: boolean`, set the same way `notToScale` already is.

- [ ] **Step 1: Extend the credit line**

`copy.stargaze.credit` and `creditStill` gain the colour note: the colours follow long-exposure photographs, and the naked eye sees the band as pale grey. Keep it to one sentence; the line is already long. Take the naked-eye claim's wording from the sourced version in `colour-sources.md`.

- [ ] **Step 2: Add the card line**

Add `copy.stargaze.card.colourNote`, in the same register as the existing `notToScale` line. Render it in `SkyCard.tsx` under a `data-sky-card-colour-note` attribute, mirroring how `notToScale` renders, and set `colourNote` in `NightSky`'s `buildCard` for any id present in `OBJECT_COLOURS`.

- [ ] **Step 3: Run the voice gate**

Run: `node scripts/check-voice.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add content/copy.ts components/manuscript/SkyCard.tsx components/manuscript/NightSky.tsx
git commit -m "copy: say the colours are long-exposure, not what the eye sees"
```

---

### Task 8: Verification

**Files:**
- Modify: `scripts/verify-redesign.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: new named checks, runnable as `node scripts/verify-redesign.mjs <name>`.

- [ ] **Step 1: Add the `sky-colour` check**

Assert the owner's call from both sides, the way Figure 1's hidden-model contract is asserted from both sides:

1. In normal mode, sample the canvas at a point where a coloured object draws and assert the pixel is neutral (max channel spread within a small tolerance).
2. Enter stargaze, sample the same point, assert it is now chromatic (spread above a threshold).

Pin the clock with `page.clock` the way `sky-hover` does, so the sample point is stable; a real-clock read here would be the same flake that check already hit.

- [ ] **Step 2: Extend `stargaze-card` for the new objects**

At minimum: three of the thirteen open a card with a title, a kind line and at least one citation link, and a coloured object's card shows the colour note while a grey one does not.

- [ ] **Step 3: Measure the frame budget**

Run the existing `sky-animates-1280` check and record the median. Compare against the 2.40-2.48ms pre-round baseline and the 5.92ms gate. **Report the number whether or not it passes.** If it regresses past the gate, reduce layered fills per object before tuning anything else, and report what you changed.

- [ ] **Step 4: Run everything**

```bash
npm run build && npm start &   # :3000 only, never touch :3001
node scripts/verify-redesign.mjs
for f in scripts/test-sky-*.mjs; do node "$f"; done
node scripts/check-voice.mjs
node scripts/verify-headshot-256.mjs
```

Expected: all green. Report the counts.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-redesign.mjs
git commit -m "verify: colour is stargaze-only, new objects open sourced cards"
```

---

### Task 9: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Record the contracts**

In the night-sky section: colour is stargaze-only and why (the figures use colour semantically); the long-exposure ruling and the naked-eye fact; the false-colour rule; the variant table; the determinism rule restated for the new shapes; the measured frame time before and after; and the object count going from 30 to 43.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the colour contracts and the new catalog size"
```
