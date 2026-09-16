# Night sky: colour and structured deep-sky renders — design

**Date:** 2026-09-15
**Branch:** `sky-colour` (off `main` at `4bb91f5`, which already carries the
night sky, the objects/cards/ISS round and the not-to-scale glyph round)
**Owner calls this round:** colour appears in **stargaze only**; the deep-sky
objects get **structured, per-object renders** rather than flat tints; **about
a dozen new objects** join the catalog.

## 1. Why

The sky is uniform grey. Everything in it is real and sourced, and the cards
are the piece visitors respond to most, but the chart itself reads as one
material. Colour is the cheapest large gain available, and unlike most
decoration it can be made of facts: a galaxy's warm core against blue arms is
old stars against young ones, a planetary nebula's blue-green centre and red
rim is oxygen against hydrogen. Drawn from sourced descriptions and cited on
the card, colour becomes more content rather than less.

## 2. The honesty problem, and the ruling

The owner asked for the Milky Way "maybe like how I would see it from Earth".
**The naked eye sees almost no colour in any of this.** The band and every
deep-sky object are far too dim to excite cone cells, so a dark-adapted
observer sees grey. Every colourful sky image is a long exposure.

So "as I would see it" and "colourful" are opposites, and the spec picks
**long-exposure photographic colour**, then says so. This is the same move the
not-to-scale note already makes: state the gap rather than paper over it.

Three binding rules follow.

- **R1. Every colour is sourced.** A colour with no citation does not ship.
  Where a source could not be found, the object keeps its current grey
  treatment; a missing colour is cheaper than an invented one.
- **R2. False colour is never presented as real colour.** Many famous images
  (the Hubble palette in particular) map sulphur, hydrogen and oxygen
  emission onto red, green and blue. That is a data visualisation, not the
  object's appearance. Any object whose popular images are narrowband
  false-colour is either rendered in its documented *broadband* colour or
  left grey, and the research file records which objects this affects.
- **R3. The credit line carries the gap.** It already says the symbols are
  drawn bigger than life. It gains that the colours follow long-exposure
  photographs and that the naked eye sees the band as pale grey.

These sit under the Constitution's existing "illustrative pieces are labeled
illustrative" rule. Nothing here is a model output, so "never fake a model's
output" is not engaged; the rule that binds is the labelling one.

## 3. Colour is a property of stargaze, not of the sky

**Owner call: colour appears in stargaze only.** In normal mode the margins
keep drawing exactly what they draw today.

Two reasons, both load-bearing:

- Page 1 is a framed manuscript, and its figures use colour *semantically*
  (green is x0-diffusion, red is SAM, amber is an instrument readout,
  link-blue is a hyperlink). A colourful background would compete with that
  system and weaken it.
- It makes entering stargaze a reveal rather than a lighting change, which is
  worth something on its own.

**Mechanism.** `View` (`lib/sky-layers.ts`) and `FrameInput`
(`lib/sky-render.ts`) each gain a `colour: boolean`. `NightSky` passes
`isStargazing()` into it, exactly as it already passes `names`. Every draw
path reads that flag and falls back to today's ink/mut greys when it is
false. `lib/sky-render.ts` stays pure: no state, no clock, no direct read of
the stargaze store.

The flag is a render input, not a second code path: there is ONE draw function
per object kind, and it selects a palette. Two parallel renderers would drift.

## 4. What the palette is made of

A module-level table, `OBJECT_COLOURS`, keyed by object id. It is **code, not
data in objects.json**: these are rendering choices derived from sourced
descriptions, and objects.json is a generated artifact whose every field comes
from a pinned upstream source. Mixing a hand-authored palette into a generated
file would break that file's provenance story.

Each entry carries the colours the object's structure needs, so the table's
shape follows the render, e.g. a spiral carries a core colour and an arm
colour; a planetary nebula carries an inner and a rim colour.

Colours are stored as `r,g,b` triples so every draw site can pick its own
alpha, matching how `INK`, `MUT` and `WARM` already work in that file.

**Saturation ceiling.** The desk is `#0c0b09` and the sky is dim by design.
Colours are used at low alpha and never at full saturation; the target is a
tinted chart, not a poster. The reviewer gate for this is a screenshot, not a
number: the chart must still read as a star chart.

## 5. Structured renders, by what the object actually is

Today's `prepareObjectGlyphs` produces a galaxy/nebula/cluster shape per id.
This round extends that: a glyph gains a **variant** naming the real structure,
and each variant has one draw function.

| Variant | Structure drawn | Applies to |
|---|---|---|
| `spiral` | warm old-star core, blue arms, dust lane | M31, M33, M51, M81 |
| `spiral-companion` | `spiral` plus a small second nucleus | M51 (NGC 5195) |
| `elliptical` | smooth old-star halo, no arms, optional jet | M87 |
| `edge-on` | bright bulge cut by a dark lane | M104 |
| `starburst` | elongated body with an outflow along the minor axis | M82 |
| `emission` | hydrogen-pink cloud | M8, M16, M20, M42, NGC 7000 |
| `planetary` | oxygen blue-green centre, hydrogen red rim | M27, M57 |
| `remnant` | filaments over a diffuse interior | M1, the Veil |
| `reflection` | blue cloud, no emission rim | M78, the Pleiades' nebulosity |
| `dark` | silhouette against a drawn backdrop | Horsehead (needs IC 434 behind it) |
| `globular` | dense round scatter, yellowish stars | M13 |
| `open` | loose scatter, blue-white young stars | M44, M45, the Double Cluster |

Rules carried forward from the existing glyph work, all still binding:

- **No `Math.random`.** Every scatter, blob and filament is seeded from the
  object's id through the existing `hashSeed`/`mulberry32` pair, so the sky is
  identical for every visitor on every load. This is the same determinism rule
  the sample-space figure lives under.
- **Prepared once per catalog load**, never per frame. The ~20 fps paint loop
  only translates and transforms already-placed points. Gradients are the new
  risk here: a `createRadialGradient` per object per frame is the obvious way
  to blow the frame budget, so gradients are built at prepare time where the
  API allows, and where it does not (gradients are tied to coordinates) the
  draw uses layered low-alpha fills instead. §8 gates this with a measurement.
- **Positions stay real.** Nothing in this round moves an object.
- **Unknown id falls back**, it does not throw: an object with no palette
  entry draws today's grey glyph.

## 6. The thirteen new objects

Horsehead (Barnard 33), Flame (NGC 2024), Trifid (M20), Dumbbell (M27),
Eagle (M16), Triangulum (M33), Bode's (M81), Cigar (M82), Sombrero (M104),
Double Cluster (NGC 869/884), M78, Veil (NGC 6960/6992), North America
(NGC 7000).

All lie north of the chart's `EDGE_DEC_DEG` of −35°, so all can actually draw.

**Positions come through `scripts/prepare-sky-objects.mjs` under its existing
assert-before-write discipline** — fetched from a pinned or stable source at
hand-run time, never hand-typed. The Messier objects are expected to come from
the already-pinned d3-celestial data; the non-Messier ones need a second
source. `/.superpowers/sdd/position-sources.md` records what was actually
found, with the exact queries run, and the plan's first task consumes it.

Two of these are not single points and need an explicit representation
decision, recorded in that same file: the **Veil** is a large broken loop
(NGC 6960 and NGC 6992 are opposite sides of one supernova remnant) and the
**Double Cluster** is two adjacent open clusters.

**Each new object needs a full sourced card**: kind line, one-liner, body,
visibility, citations, in `content/sky-facts.ts` under that file's existing
rules. This is the round's most expensive and most error-prone work. Last
round a reviewer fetched all 143 citations and checked every number; the same
gate applies here.

## 7. Copy changes

- `copy.stargaze.credit` and `creditStill` gain the colour note (R3).
- `copy.stargaze.card` gains a colour line, shown on cards whose object has a
  palette entry, in the same shape as the existing `notToScale` line: it says
  the colours follow long-exposure photographs and that the eye sees far less.
- Thirteen new fact entries in `content/sky-facts.ts`.

All of it is voice-gated by `scripts/check-voice.mjs`, which already scans both
files. No em-dashes, no banned words, sentence case, concrete over adjectival.

## 8. Verification

New and changed checks in `scripts/verify-redesign.mjs`, all against a
production build on :3000, plus node tests:

- **Colour is stargaze-only.** Sample the drawn chart in normal mode and assert
  the pixels are neutral (r ≈ g ≈ b within a tolerance) at a point where a
  coloured object draws; enter stargaze and assert the same point is now
  chromatic. This asserts the owner's call from both sides, the way the
  hidden-model contract in Figure 1 is asserted from both sides.
- **Each new object draws and opens a card**, with at least one citation link,
  reusing the existing `stargaze-card` machinery.
- **Determinism**: two loads produce the same shape for a seeded object. The
  existing node test file for objects is the right home.
- **Frame budget**: `window.__sky.frameMsMedian` stays under the existing
  5.92ms gate at 1280px with the catalog roughly doubled and colour on. This
  is the measurement that decides whether the gradient approach in §5 holds.
  Record the before and after medians.
- **Every citation resolves**: the existing fact tests plus a reviewer pass
  that actually fetches the new URLs.
- The full existing suite (29 checks, 49 node tests, voice gate,
  `verify-headshot-256.mjs`) must stay green.

## 9. Out of scope, deliberately

- **Discovery.** Making the stargaze entry point findable is the bigger
  problem and gets its own round; mixing it in here would make both harder to
  review. Recorded so it is not lost: make the sky itself the invitation (a
  first-hover response in the margin), give the control a mark rather than
  only words, add a second entry point at the foot of the page, and measure
  the change against `demo_used {stargaze}`.
- **The mobile stargaze gap** (no names below 880px) rides with the discovery
  round, since the phone answer to "make the sky the invitation" is a
  different interaction.
- **The iOS draw-demo crash loop**, still the top engineering item overall.
- Time controls, a visible object index, search. All discussed, none in this
  round.

## 10. Risks

1. **The citations are the long pole**, not the rendering. Thirteen cards at
   the existing standard is real work, and a wrong number on a sourced card
   costs more than a missing object.
2. **Frame budget.** Roughly double the objects, each drawing more, plus
   gradients. §8 gates it; the fallback is fewer layered fills per object, and
   past sky work has repeatedly found the reasonable guess about cost wrong in
   both directions, so it gets measured before anything is tuned.
3. **Saturation drift.** Colour added object by object tends toward a poster.
   The screenshot gate in §4 exists for this, and the whole-branch review
   should look at the chart as a whole, not at individual glyphs.
4. **A non-Messier position source may not exist** in a pinnable form. If one
   of the thirteen cannot be sourced cleanly it is dropped rather than
   hand-typed, and the drop is recorded.
