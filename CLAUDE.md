# CLAUDE.md — neelayranjan.dev

Personal portfolio of Neelay Ranjan: AI/ML researcher (NASA Ames, Regenstrief
Institute), applying to Fall 2027 MS programs. The site's claim, in every era of its
design, is that **the work is real**: trained models run client-side, nothing is
faked, and honest numbers beat impressive ones.

**The "framed manuscript" redesign SHIPPED 2026-09-12** and is what production
serves. The prior site ("v1", the faux-terminal single-pager) is preserved at git
tag `v1`, its deep design documentation archived verbatim in
`docs/v1-design-notes.md` — that file's 🔒 LOCKED rules bound v1 only. What binds
now is this file: the Constitution, the Voice, the content facts, and the
contracts below.

## Current state

**In production at neelayranjan.dev since 2026-09-12** (fast-forward of the
15-task `redesign` build into `main` after a full verification run; the branch
is deleted; v1 lives at the tag). Page 1: masthead (title, abstract, the
live-sampled author photo, the paper-status stamp (IN PREPARATION; UNDER REVIEW until 2026-09-14), status only since
2026-09-16, with the bordered "Supplementary material" box beneath it as the
door to `/lab`, identity links) → Table 1 → Research
(Figure 1 label-efficiency sweep, Figure 2 Dice CDF, Figure 3 flight map) →
the live demos as Figures 4–5 (chess, then draw — swapped 2026-09-13 at the owner's call, the `n` props swapped with them) → Experience as Figure 6 (NASA and Regenstrief
lamps green/active) → References → the footer's stargaze door. `/lab` holds S1–S3. Same-day post-launch
passes: Figure 2 rebuilt from a budget ladder into the paper's pannable Dice
CDF; the flight video's dark-map treatment; the owner's STIX-N favicon set;
headshots presented last-class-first (photo 2 is the default face). The wipe
(originally Figure 1, moved to image 330 with the green-x0/red-SAM legend) was
then REPLACED by the label-efficiency sweep at the owner's direction; its
component and copy are gone, its assets stay (see the figure section).
2026-09-13: the owner dropped `test_pred.zip` (the full seed-1/fold-1
re-export) and both research figures re-sourced from it — Figure 2's stops
now land on genuine failures across all 100 test images, and Figure 1 grew
its mask strip (x0, SAM and ResNet-UNet across the budgets, image 333).
Same day: the masthead h1 split into the name at display size and the thesis
line smaller beneath it (`titleName` / `titleTagline`), and the OG card was
regenerated (`gen-og.mjs` now frames the top of the page; its old scroll-to-
Table-1 logic cut the name off once the headshot rail grew). Also 2026-09-13:
Figure 1's strip image became 333 (x0 must visibly beat SAM at 16 labels),
its whiskers went faint, chess moved ahead of draw, Vercel Web Analytics was
wired (see Stack), and the headline framing became "generative modeling"
(title, tagline, share blurb; OG card regenerated to match).

**2026-09-15: the desk's particle swarm (`DeskField`) was replaced by a real
star chart of the sky over NASA Ames**, same on `/`, `/lab` and the 404.
`scripts/prepare-sky.mjs` builds `public/sky/sky.json` (~57 KB: 1,627 stars to
magnitude 5, 88 constellations with thin lines, English meanings transcribed
from Wikipedia's Meaning column rather than d3-celestial's own `en` field
which calls Ursa Major "Big Dipper", Serpens' two halves merged into one
constellation) from a commit-pinned d3-celestial. `lib/sky-math.ts` computes
the projection (GMST/LST, the planets, the Moon) with no imports, so
`scripts/test-sky-math.mjs` pins it against `astronomy-engine` in plain node.
`components/manuscript/NightSky.tsx` runs a simulated clock at 180x real time
from the load instant (one turn every ~8 minutes); the pole originally sat
behind the sheet and later moved to the top-left margin (2026-09-15, see the
paragraph below and the Night sky section's projection bullet for the
current, margin-based rule). Reduced motion paints one frame at load and
stays still. Hovering near
a constellation brightens its lines and names it in both languages ("Ursa
Major (Great Bear)", Latin larger and brighter), the label placed beside the
pointer in the page margin; when the catalog anchor would land under the
sheet the label moves into whichever margin the pointer is in instead, though
on narrow desktops it may still graze the sheet if even the Latin name alone
doesn't fit the available margin width. A "stargaze for a bit?"
button (`StargazeToggle.tsx`, state in `lib/stargaze.ts`) hides every page's
content with CSS plus `inert`, never unmounting (a chess game, a drawing, and
scroll position all survive the round trip), and counts once per page load as
`demo_used {demo: "stargaze", via}` (`via` added 2026-09-16, see below). A model run in flight is cancelled by throwing
`StargazeAbort` from the panel's own `onFrame`, never by returning early
(returning skips the vendored sampler's event-loop yield and locks the page).
**Restore rule**: the chess worker is terminated outright (pending moves
reject with `EngineUnloaded`) and reloads on return only if it had been
loaded or loading before stargazing, never if only the idle warm-up loaded
it; draw and headshot release their ORT sessions once the cancelled run
settles, draw reloads on return if it had been wanted, headshot waits for the
next press (as the first press always has). Load-generation tags on every
panel stop a load that resolves after an unload from installing a released
session or a terminated worker; the loaders themselves await any pending
unload before building a new session, so two sessions never coexist. The
honest limit: the main-thread ORT wasm heap never actually shrinks, only the
chess worker's termination truly frees memory. `window.__sky` and
`window.__offload` are verify hooks, not UI.

**Verification: `scripts/verify-redesign.mjs`** — 42 named checks (30 before
the discoverability round, 40 before the 2026-09-16 WebKit fix, which added
**`ort-runtime-build`**: every `/ort/` request during the chess worker's load
and the draw demo's first stroke, the plain `ort-wasm-simd-threaded.wasm`
fetched by each and never an asyncify, jsep or jspi build, and
**`draw-ink-survives-height-resize-400`**: lit pixels unchanged and the clear
button still enabled after an 800→700 height-only resize, the buffer reset by
a 400→360 width change; `analytics-queue` also asserts the same-origin Speed
Insights script and `page_reload` at 0 on a fresh navigation and 1 after a
reload),
Playwright-Firefox against a real `npm run build && npm start` on :3000, never
the dev server; pass check-name substrings as args to run subsets. Covers the
night sky (turning at 1280px with a measured median frame draw around 2.54ms
against a 5.92ms budget, flat against the pre-colour-round 2.40-2.48ms
baseline; the discoverability round read 2.70-3.54ms across its tasks, and a
same-session stash rebuild of the pre-task tree read the same, so the machine
drifted, not the sky; a headless
Firefox number, not a device number; static under reduced motion; present in
the 400px margins, with the credit equal to the composed copy in both motion
variants and no doubled punctuation ("..", ".,", ",." or ",,": the owner's
2026-09-16 trim once rendered "real one.."); orientation checked against an independently computed
astronomy-engine LST and two expected bright pixels, both at the moved,
margin-based pole; hovering brightening a constellation and naming it clear
of the sheet, with the hovered or selected symbol's own always-on name
suppressed), **`sky-drag`** (dragging the margin slides `window.__sky.offset`,
release springs it home inside 1.5s, a drag starting on the sheet never pans,
reduced motion snaps back instead of springing, a window blur ends a held
drag; in stargaze the offset instead HOLDS across the release and only goes
home when stargaze is left, under reduced motion too), **`sky-objects`** (Andromeda
and the galactic core each hold real pixels at an instant the check finds for
that body alone, since the two are never both on screen on a shared canvas at
once; an active meteor radiant only inside its window; the objects layer's
absence still leaves the rest of the sky drawn), **`stargaze-card`** (clicking
a selectable in stargaze opens a sourced card with a title, a kind line and at
least one citation link; clicking the middle of an object's drawn name, 20px+
from its symbol, opens that object's card, and the Milky Way's label box opens
its card; Escape closes the card before it reaches the stargaze-exit handler,
a second Escape exits; a drag never opens a card; the card follows its subject
during a drag; a subject dragged past the viewport edge leaves its card OPEN
with the out-of-view line, which clears when the subject snaps back),
**`stargaze-keyboard-list`** (every drawn hit and some constellations are
buttons named "title, kind" in a stable sorted order; Tab from the exit
control reaches the first, which rings its subject; Enter opens its card with
focus inside; Escape returns focus to that button),
**`stargaze-touch-400`** (touch emulated: the touch hint; a tap 18px from a
symbol opens its card while a mouse click at the same point doesn't; the
docked phone card is at most 60% of the viewport tall with no text under
12px; the Milky Way has no canvas hit but is in the keyboard list),
**`sky-iss`** (with the TLE route intercepted to a fixed reply, the ISS marker
draws and its card opens with live altitude/speed/epoch; with the route
returning `{ tle: null }`, no ISS and no console error; every OTHER check
gets `{ tle: null }` from `withPage` by default, since the route is
prerendered at build time and its TLE would otherwise draw an ISS into any
pinned instant within 7 days of the build), **`sky-colour`** (rewritten
2026-09-16 for paper-mode colour: the same drawn pixels of ten coloured
objects read in five states, saturation 0 through the override hook, paper,
pointer over the sky, back on the sheet, stargaze; each object's DISPLAYED
chroma share at paper must sit within ±0.15 of `PAPER_COLOUR_SHARE` and the
median within ±0.08, hovered must equal stargaze within 2, back-on-sheet must
equal paper exactly, M82's centre stays neutral in every state, the band's
warmth must rise at paper and again in stargaze, and a motion-on half records
the ease every rAF and requires it monotone and settled inside 500ms; proved
to bite with `PAPER_COLOUR_SHARE = 0.1`, which fails on M45 at a measured
share of 0.28. The colour round's version was proved the same way, by
mutating and rebuilding, which is the standard a new check should meet),
**`stargaze-affordances`** (dotted underlines measured as a DIFFERENCE: the
override hook forces saturation 1 in paper so both modes draw identical
colour, text rows must match byte for byte, and the rows under each name box
must gain lit dots in stargaze; entry rings on the first entry and never the
second, with motion and under reduced motion; the rings' slow-load case
below; the pointer cursor over a symbol, not on empty sky, `grabbing` during
a drag), **`stargaze-browse-1440`** / **`stargaze-browse-400`** (the counts
equal counts the page computes from the SERVED `objects.json`/`sky.json`,
and are absent while `objects.json` is held, while "browse the list" stays
once the list has items; the open panel is measured
on top, in the viewport, clear of the exit control, with the same ids in the
same order as the closed list; Escape order; an open panel's rows frozen
through a clock-jumped turn and a 2s refresh, refreshed on close; at 400px the docked panel's
size, and phone names clearing a hint bar the check grows by 110px, which
caught a content-box ResizeObserver ignoring padding), **`stargaze-doors`**
(the mark is SSR'd and `aria-hidden`; the footer door follows References on
`/` and ends the sheet on `/lab`; each door queues exactly one `demo_used`
with its own `via`, whichever door comes second adds nothing; exit returns
focus to the door used), **`sky-invite`** (nothing at rest; the first sky
entry shows it at the same instant the colour target goes to 1; once per
load, not again after a same-session reload, never under `hasTouch` (Firefox
really reports `(hover: none)` there), never in stargaze, and never after
stargaze has been entered by either door, not even after a reload (proved to
bite by dropping the spend); with `sessionStorage` throwing, once per load), **`stargaze-chrome`** (the
backing's alpha measured per lit pixel behind a pill, median 0.86 against a
0.75 floor; a covered name neither highlights nor opens a card, and does
once the chrome's pointer-events are forced off; no name box at 400px meets
the bar or credit; credit contrast over the band, backed, at or above its
pre-colour-round paper value: 3.68/3.69:1 at 400px against 3.49:1),
**`lab-box-navigates`**, **`stamp-no-link-ancestor`** (proved by re-wrapping
the stamp in a Link), **`references-lab-link-resolves`**,
**`draw-classify-lead-400`** (the draw demo's lead line visible, exact and in
bounds at 400px before any stroke), stargaze mode
(hiding the page with `inert` and firing no page-content fetch; offloading
the chess worker and the draw/headshot sessions; cancelling a run in flight
without ever showing it as a failure or counting `demo_used`; surviving
stargaze entered mid-download plus an immediate exit/re-entry), no horizontal
scroll at 400px on both pages, nothing model-sized before scroll, the
label-efficiency sweep (readouts and the computed lead/trail sentence vs the
SERVED `label_efficiency.json` at the first and last budgets, including the
x0-leads→x0-trails flip, cursor exactly on the budget tick, whiskers tracking
the slider, and the strip's panels carrying the json's Dice and repainting per
budget), the Dice-CDF slider (curves, readouts vs `cdf.json`, repaint on stop
change), flight video play/pause, a drawn stroke producing a real auto-label (with the classifier-free lead
line present and unchanged before and after),
the chess hint matching vector D (`g3 p=0.236`), JEPA seed query 834 plus the
triple-equality, Vercel Analytics (tracker injected same-origin, a Resume click
queues `outbound_link`; two headshot runs queue exactly one `demo_used`), and
the headshot toy (no model fetched at rest; the sampled
canvas pixel-matches the pressed photo, with the other two photos as asserted
controls; the readout's build label must match the graph the browser actually
fetched; the second press must match ITS photo and must run STRICTLY FEWER
steps than the first, which is the structural proof the morph happened — the
"morphed" wording alone is the site agreeing with itself; photo URLs are
derived from the pressed thumb, so the versioned bundle directory can move
without touching the check). Since the viewport gate was removed from
`wantsPrimary()` (2026-09-13), that check gets whichever family the machine's
capabilities grant — the 256 on the dev machine, and the check's label↔graph
assertion covers either honestly. The 256+morph path still has its own
hand-run script, **`scripts/verify-headshot-256.mjs`** (same prod build on
:3000; drives the site's vendored module in node against the SERVED bytes,
with MAD thresholds the browser check doesn't carry). Run the suite after any
change touching a demo, a figure, or the page shell.
`scripts/check-voice.mjs` gates every copy.ts edit, and (2026-09-15) scans
`content/sky-facts.ts` with the same rules. **`node --test
scripts/test-sky-data.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs
scripts/test-sky-objects.mjs scripts/test-sky-facts.mjs
scripts/test-sky-iss.mjs`** runs outside Playwright, in plain node (73 cases
total, up from 62 before the discoverability round and 47 before the colour
round): `test-sky-data` pins the committed `sky.json`'s shape (star
count/order/ranges, Polaris and Sirius by position and magnitude, all 88
constellations with Serpens merged and bilingual names) against hand edits
and bad regenerations; `test-sky-math` pins `lib/sky-math.ts`'s projection
math (GMST 1.13 s worst error, Saturn 0.088°, Moon 0.043°, all against
`astronomy-engine`, a devDependency used only here and by the verify suite),
plus the moved pole and the drag/spring math; `test-sky-pan` pins the rubber
band and spring in isolation (constants, frame-rate independence, no
overshoot); `test-sky-objects` pins `objects.json`/`milkyway.json`'s shape,
the 15 named stars resolved by HIP id, shower windows, the constellation
origin table, and the Milky Way's vertex budget, plus (colour round) that
every galaxy/nebula/cluster variant prepares exactly the geometry its draw
function reads, that colour-off geometry is byte-unchanged for every glyph
that predates the round, that the nebula and cluster palettes keep the
false-colour rulings, and that every coloured object's card cites the source
its colour rests on (`COLOUR_CITATION`, a hand-kept map of object id to the
URL(s) whose page carries the sentence its palette draws, asserted complete
against `OBJECT_COLOURS` and against the card's rendered Sources list,
Lodriguss included; the older form only counted citations, which is how ten
objects came to draw colours their cards sourced nothing for, final review
C1/M4, 2026-09-16), plus (discoverability round, +11) SHA-256 digests of a
fake 2D context's full call trace over five fixed scenes, recorded from the
pre-saturation code, which saturation 0 must reproduce as the old colour-off
trace and saturation 1 (with `stargazeChrome`) as the old stargaze trace,
chroma monotone call for call across levels, M82's calls identical at every
level, `bandMix`'s ends, `stepSaturation`'s frame-rate independence, the
underline trace being a strict supersequence of the plain one, phone names
never overlapping and clear of the chrome bands over 24 orientations, and the
entry-ring picker and envelope; `test-sky-facts` pins that
every drawn object, planet, the Moon, all 88 constellations, every shower,
both Voyagers and the ISS carry a complete, cited fact, plus (colour round)
that the fifteen new objects cite only verified sources, ship the Double
Cluster and the Veil as paired objects, and carry no invented magnitude;
`test-sky-iss` pins
`lib/sky-iss.ts`'s topocentric result against satellite.js's own look-angle
conversion and the 7-day TLE-staleness gate. `SKY_FACTS_PARTIAL=1` in front
of `test-sky-facts` exists only so facts can be written in batches without
the coverage assertion failing mid-work; it must never be set in CI or a
verification run. Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning for
these `lib/*.ts` and `content/sky-facts.ts` files when the suite runs —
known, harmless, not worth chasing (this repo's `package.json` has no
`"type"` field and that's staying as-is).

**2026-09-15 (later the same day): drag, objects and the ISS shipped on top of
the night sky, branch `sky-objects`.** Polaris moves to the top left (a
margin-based pole, not a fixed fraction: it sits at the midpoint of the
left margin whenever that margin is at least 72px wide, else near the top of
a narrow one); dragging the desk (or, in stargaze mode, dragging anywhere)
slides the whole chart with a rubber-banded limit. In normal mode it springs
back home on release, so the page keeps its composed margins; in stargaze it
stays where the visitor left it and only goes home on the way out. Ten
Messier favourites, the galactic core, the Kepler field, the
Hubble Deep Field, Voyager 1, 15 named bright stars, active meteor
radiants and the live ISS all draw from real data (Voyager 2 has its data
and card fact but never draws: dec −59.8° is south of the chart edge) (`public/sky/objects.json`,
`public/sky/milkyway.json`, `scripts/prepare-sky-objects.mjs`); the Milky
Way band itself draws as a low-alpha glow beneath everything, its five levels
brightening toward the galactic core under a stipple of grain points.
**The galaxies, nebulae and clusters are drawn NOT TO SCALE** (owner call,
2026-09-15: "a not-to-scale visual of them, much like what you would see if
you were to zoom into them a lot"): Andromeda is a tilted spiral ~40px
across, the nebulae are soft blob clouds (M57 a ring), the clusters are
deterministic star scatters. Positions stay real, and the honesty rule that
covers it is the credit line plus a `notToScale` line on every affected card.
Hovering any of it in normal mode adds a one-liner to the existing label;
clicking a symbol or its drawn name (or tapping a symbol) in stargaze mode,
or pressing Enter on its button in the hidden keyboard list, opens a sourced card (constellation
mythology and origin, deep-sky facts, planet and Moon name origins, shower
windows, spacecraft positions, the ISS's live look angles), all fed from one
new content file, `content/sky-facts.ts`. See "Night sky + stargaze" below
for the contracts. JPL Horizons was down during the build session, so the
Voyager rows first shipped from the recorded fallback; the generator was
re-run live on 2026-09-15 (`source.horizons.mode: "live"`), and the live
rows matched the recorded ones to every stored digit.

**2026-09-15/16: a colour round adds sourced colour to the deep-sky objects,
stargaze only, and fifteen more objects to the catalog (30 → 45).** Colour
rides the same flag as everything else stargaze changes: `View`/`FrameInput`
carries `colour: isStargazing()`, read only inside `lib/sky-layers.ts`'s
galaxy/nebula/cluster/Milky Way draw paths, while `lib/sky-render.ts` itself
stays pure and never reads the stargaze store. It was stargaze-only because
the page's OWN figures use colour to mean something (green is x0-diffusion,
red is SAM, amber is an instrument readout), and a colourful desk on every
other page would compete with that system. (⚠️ Reversed by the owner on
2026-09-16: paper mode now shows half the colour. The flag became a
saturation; see the next paragraph. The reasoning above is kept as history,
and it is why the paper level is a measured number rather than full colour.) No colour here claims to be what an eye would
see: at these brightnesses vision runs on rod cells, which register none, so
every colour follows a long exposure instead, and the credit line (its colour
clause then shown only while stargazing; ungated since 2026-09-16) and each
coloured card's note say so. Colour is never invented: a colour may follow an
emission line's OWN wavelength (O III really is blue-green at 500.7nm,
H-alpha really is red at 656.3nm, cited to Lodriguss's *Color in astronomical
objects*, a working astrophotographer's book, named honestly as such rather
than dressed up as an institutional source), but never a false-colour palette
that reassigns a line to a channel it doesn't belong to, which is what the
famous Hubble/SHO portraits of several of this round's own objects do. M82
stays grey outright: its famous colour is X-ray and infrared data with no
visible-light counterpart at all. The fifteen new objects are eight more
Messier picks (M16, M20, M27, M33, M78, M81, M82, M104), the Horsehead, the
Flame, and the Double Cluster and the Veil, each shipped as two separate
objects since neither has one defensible centre. Two data traps were dropped
at the source, both with an assertion: NGC 2024's (the Flame's) catalog
magnitude is d3-celestial's own literal `999` sentinel, and the Horsehead's
(B 33) `2` is Barnard's opacity class, not a brightness. See "Night sky +
stargaze" below for the full contracts, including the Milky Way label's
anchor now avoiding drawn objects, and crowded object names stepping down
instead of overlapping.

**2026-09-16: the discoverability round, LIVE since `538fe63`** (merged and
deployed the same day after the owner reviewed the preview; spec
`docs/superpowers/specs/2026-09-16-discoverability-design.md`, ledger with
every ruling in `.superpowers/sdd/discoverability/progress.md`). ⚠️ Every
round's SDD ledgers, research files (`colour-sources.md`,
`position-sources.md`), task reports and review screenshots are archived in
this checkout's `.superpowers/sdd/`, which is gitignored: they exist on the
owner's machine only. This file is the durable, versioned record; the ledgers
are the audit trail behind it. It answers
Open items 1 and 2 as they stood, and closed the old item 8 (splitting
`NightSky.tsx`, then past 800 lines). **The owner reversed
"colour is stargaze-only"**: the ordinary page shows the sky's sourced colour
at half of stargaze's, full colour returns while the pointer is over the sky,
and stargaze stays at full. The first attempt set a 0.25 parameter, chosen
low out of the same fear of competing with the figures, and it measured grey:
objects 14-44% of the way to stargaze and the band's warmth unchanged to two
decimals. A percentage of a parameter is not a percentage of what the eye
sees, so the controller overturned it and the shipped constant is a measured
DISPLAYED share (`PAPER_COLOUR_SHARE = 0.5`, median measured 0.53). Inside
stargaze, clickable things now look clickable (dotted underlines on names,
a pointer cursor, one-time entry rings), the hint bar says how much has a
card (44 objects, 88 constellations) and opens the keyboard list as a
visible panel, and phones draw names for the coloured objects. Getting in:
the toggle gained a star mark, the sky introduces itself once per session on
first pointer entry, and a second door sits at the foot of `/` and `/lab`,
with `demo_used` gaining `via` to say which door. The /lab door became a
bordered "Supplementary material" box under a stamp that is now status only.
The credit line keeps the owner's trimmed sentence plus one honesty tail. The
draw demo leads with classifier-free classification. `NightSky.tsx` was split
into `components/manuscript/night-sky/` first, with no behaviour change. See
"Night sky + stargaze" and "Draw-a-digit" below for the contracts.

**2026-09-16 (evening): the iPhone crash loop is root-caused and fixed,
merged to `main` the same evening after the owner approved the preview;
the field readout is still owed.** It was never the
26 MB model or the main thread. Every ORT import used the
`onnxruntime-web/webgpu` entry, and in 1.27 that entry always fetches ORT's
**asyncify** wasm build (24.3 MB) whatever provider is requested, so chess
and headshot, wasm-only by policy, loaded it too. JavaScriptCore's
optimizing wasm tier runs away on that build (microsoft/onnxruntime issue
26827, profiled looping in B3's stack allocator), on every WebKit browser:
iOS Safari, Chrome and Firefox on iOS, desktop Safari. Reproduced here in
WebKitGTK 2.52 (`scripts/probe-webkit-draw.py`, hand-run): one stroke,
classify and generate, then a minute of idle, the web process sat at ~395%
CPU and grew from 5.3 to 11.5 GB; on a phone that is a jetsam kill, and the
reload does it again, which is Safari's "a problem repeatedly occurred".
The fix is the `onnxruntime-web/wasm` entry everywhere (draw, headshot,
chess worker) and `["wasm"]` for the draw demo: same run, peak 891 MB, idle
flat at ~800 MB, and the demo ran faster (classify 2.2 s after the stroke
vs 3.6-4.5 s), with the runtime download 13.5 MB instead of 24.3 MB.
`sync-ort` now copies only the plain pair and removes a stale asyncify pair.
Asserted from the network by the new `ort-runtime-build` check (proved to
bite by pointing one loader back at `/webgpu`). Known bug 1, the URL-bar
resize wiping the drawing, went in the same round (width-only guard,
`draw-ink-survives-height-resize-400`, proved to bite). Analytics grew with
the Pro plan the owner bought the same day: custom events confirmed
ingested (stargaze 3 visitors, chess 3, headshot 2, draw 1 since launch),
Speed Insights added, and a third event, `page_reload`, so the crash loop
can be read in the field as reloads per page view by device. The trade
stated once: the draw demo no longer asks for WebGPU, and no WebGPU number
was ever measured for it.

**Open items, roughly in order:**
1. **Stargaze discoverability: built, not yet measured** (owner, 2026-09-14:
   "We 100% need to make that button more noticable, I have had to tell
   everyone about it"; re-confirmed 2026-09-16 as second only to the
   draw-demo crash). The 2026-09-16 round shipped the agreed direction: the
   sky names itself once per session on first pointer entry, the toggle has a
   mark, a footer door sits on `/` and `/lab`, and inside stargaze names,
   cursor, rings, counts and a browsable list say what can be opened. Still
   ruled out: autoplay, modals, pulsing, arrows, copy that oversells. What
   remains: **measure it** once live, stargaze entries against pageviews and
   the `via` split between toggle and footer (⚠️ custom-event ingestion
   depends on the Vercel plan and has never been confirmed from here; check
   the dashboard before trusting any number). **"Browse everything, click to
   fly there"** is the natural next step: the panel lists only what is on
   screen now while the hint's counts describe the whole catalog (honest,
   since the panel's title says "on screen now", but a visitor reading "44
   objects" can't reach most of them from the list). The invite is
   hover-only, so on a phone the footer door and the toggle are the only
   ways in. The owner reviewed and approved the round's copy on the preview
   (2026-09-16): the invite ("a real chart of the sky over NASA Ames", final
   review m1: the chart runs 180x, so "the real sky" read as live), the footer
   lead, and the credit's tail; at merge time they also cut the credit's
   speed-up clause themselves.
2. **Stargaze on a phone: names drawn, still thinner than desktop.** Below
   880px, since 2026-09-16, the coloured objects draw names that are tap
   targets (planets and the Moon always drew theirs, and now keep clear of the
   chrome too), but a phone name is dropped rather than squeezed
   when it is crowded, near the edge, or inside the hint bar or credit band,
   so at a given instant about half the coloured names show (5 of ~10 in the
   round's screenshot), and uncoloured objects and constellations still draw
   no name at all. The docked list panel is the phone's way to reach
   everything on screen by name. Needs the real-hardware pass (item 3).
3. **An owner pass on real hardware is still owed for the whole sky.** The
   pole position at 1280-1440px (the margin-based rule's low end, where it sits
   closest to the sheet), the drag feel and docked card on a real phone, and a
   WebGPU pass in desktop Chrome. Headless Firefox cannot speak to any of it.
4. **The iPhone crash loop: fixed and LIVE (merged 2026-09-16 evening); the
   field readout is owed** (owner, 2026-09-14, iPhone 17 Pro: repeated refreshes landed
   on Safari's "a problem repeatedly occurred", friends called the section
   "super buggy"). Root cause and measurements in Current state and Known
   bugs; the field readout is `page_reload` against page views, mobile vs
   desktop, before and after the deploy. None of the 2026-09-14 candidates
   (the 256 headshot on phones, iOS 26 WebGPU, threaded wasm) was it.
5. **arXiv link** (~2026-09-18) swaps into the references when the preprint is
   live; the owner then creates a Google Scholar profile, which joins the
   identity links (the link list is data-driven copy).
6. **A transition parity vector for the headshot bundle.** The morph is live on
   the site, but `test_parity.mjs` pins only the from-noise path; its
   `init+strength` case is a structural smoke (step count + finiteness), so the
   forward-noising branch is unpinned vendored math. Ask the model owner for an
   init+strength case in `vectors/`.
7. **The CV is hidden** (owner, 2026-09-14: "shouldn't be public facing yet").
   Removed from `masthead.links` and `references.items`; its URL stays below.
   ⚠️ The Drive doc itself is still shared "anyone with the link", so it is
   reachable by anyone holding that URL. Hiding the link is not the same as
   unsharing the document; the owner has been told and it is their call.
8. **Parked minors from the discoverability round**, each small and still
   true: a still pointer goes stale as the sky turns or the page scrolls under
   it (the pointer cursor and the paper-colour target only update on
   `pointermove`); the Moon's entry ring crosses the start of its own name for
   its 1.2s; on desktop, planet and star names under the stargaze chrome pills
   are shaded by the backing, not routed around it; the paper-mode credit now
   sits on a soft dark backing strip, an aesthetic call the owner may lighten
   (the contrast gate allows down to ~3.49:1 at 400px).
9. **A "research directions" section is PARKED** (2026-09-16). Designed to
   the copy stage: the owner's proposed robotic vascular-ultrasound project
   with Dr. Gonzalez, as a plan figure with honest status lamps. The owner
   held it: the project is a concept, and Dr. Gonzalez may not want it
   discussed publicly yet. Don't propose it again unless the owner raises it;
   if revived, a themes-only version (label efficiency, generative priors for
   perception in safety-critical domains, systems that act) that names no
   project and no collaborator is the fallback, with hover ties to the
   figures that already show each theme as its artifact. Facts settled the
   same day: the JAMIA submission is expected within the week of 2026-09-16
   (the site says "in preparation" until the owner confirms it went in), the
   lunar digital twin is officially dropped, and the antenna title is the
   resume's.
10. Much later: a third headliner demo, a **live network-security honeypot**
   (exposed Pi, malicious ssh/https logged, LLM-categorized into a live UMAP
   of attack families). Needs a live-data seam the static site doesn't have;
   the systems figure column is trivially appendable when it comes.

Deadline context: MS application season (materials due ~Nov 2026); the site
and the owner's SOP tell one story.

## Mission and audience (settled)

- Audience: industry recruiters AND masters admissions committees. **Admissions
  wins conflicts.** Visitor actions that matter, in order: open the resume, read
  the paper.
- **Public framing is "generative modeling" (owner call, 2026-09-13)**: the page
  title, the masthead tagline and the share blurb all say generative modeling,
  not diffusion. Diffusion stays the concrete specialty in the body copy and the
  figures; don't revert the headline framing to "diffusion".
- Takeaway to leave: specializes in diffusion modeling, with wide range around it
  (aerospace, medical, embedded), competent and current in the field.
- **The site and the owner's SOP tell one story.** Admissions readers will see
  both. The site must never contradict the SOP's numbers, claims, or framing; when
  a fact below and older repo content disagree, this file wins.

## Settled redesign decisions — don't relitigate

- **Multi-page, but page 1 delivers ~95% of the experience.** Other pages are
  overflow for the genuinely curious.
- Page-1 demos: **draw-a-digit and chess**. The trajectory viewer, JEPA and
  sample-space move to **`/lab`** (one page for all of them).
- The ssh **boot screen is cut**. The particle **swarm is tamed**, kept as the hero
  attention grab (v1 finding: visitors never discover it's draggable). This
  particle desk (`DeskField`) was itself replaced by the real night sky on
  2026-09-15 — see Current state and "Night sky + stargaze" below; this
  bullet records the original redesign decision, not the current desk.
- **Dark theme, fixed.** Palette and fonts **roam freely** — the owner dislikes how
  v1 uses the indigo/teal palette (likes the hues in isolation, not the usage).
- **First person** copy ("I build…"). `content/copy.ts` remains the single copy
  seam; every word gets rewritten.
- **Interactivity bar**: prose sections stay readable — no forced gimmicks — but
  every text section carries one real-work artifact beside it: bio → headshot
  diffusion toy · research → the label-budget sweep and the Dice-CDF pan ·
  experience → flight-day video · publications → figure hovers. The owner's
  rule: "at no point should the user just be staring and reading at something."
- Fallback is the git tag `v1`, nothing more. No legacy subdomain.
- **Figure colour conventions (owner calls, 2026-09-12): green = x0-diffusion**
  (and true "active" states), **red = SAM** (and reviewer's ink: the stamp, the
  headline numeral, alerts/misses), **amber (`warm`) = instrument readouts**,
  the flight blips, ResNet-UNet's dotted curve, **link-blue = hyperlinks** and
  ViT-DPT where it appears. The spec-era "red marks the x0 finding" rule is
  dead; the spec file records history, this file records now.
- **The paper-status stamp is status only** (2026-09-16; it used to double as
  the `/lab` link through a dotted "pending additional materials" sub-line,
  which nobody read as a door under a loud red stamp). Beneath it, a bordered
  box (`[data-lab-box]`, a plain `next/link`, untracked because `/lab` is
  internal) reads "Supplementary material →" over a short written teaser,
  `copy.masthead.supplementContents` ("diffusion trajectories · MAE vs I-JEPA
  · DDPM vs flow matching"). The teaser is written, not composed from /lab's
  section headings: those read wrong out of context ("Predicting pixels, or
  predicting representations") and ran four items long in a narrow rail.
  ⚠️ The cost is drift: if /lab's sections change, change this line by hand.
  The box borrows the figure frames' `border-rule` → `border-mut` line style
  on hover and focus, never a rounded button. References already ended with a
  "Supplementary material" → `/lab` entry, so no second link was added there.
  `public/og.png` was regenerated for the new rail.
- v1's draw-demo bugs survived the re-chrome where the code path survived
  (see Known bugs) — they are open on the live site.
- Navigation listings (menus, the 404's directory joke if it survives) track the
  real set of pages — v1 kept its 404 `ls` in step with its sections; keep that
  discipline whatever shape it takes.

## Content facts — the source of truth for copy

(`content/resume-notes.md` was stale and was deleted with v1.) The facts below
are the source of truth; for anything else, read the live Resume/CV Google Docs
(Drive connector) and ask the owner. Any fact on the resume is cleared for
publication.

- **First-author paper**: "Bootstrapping surgeon labeling campaigns with
  x0-diffusion: label-efficient vessel segmentation of catheter-based angiograms"
  (Ranjan, Dev, Gonzalez). **IN PREPARATION** (owner correction, 2026-09-14:
  the site said "under review at JAMIA" from launch until then, and that was
  wrong). Say "in preparation" and name no journal; never "under review" or
  "published" until the owner says the status changed. arXiv preprint from
  ~2026-09-18 (owner: still on track). The numbers: **Dice 0.882 at 16
  labels, beating all five baselines in all 25 paired runs; ~75% measured surgeon
  correction-time speedup; the claim is label efficiency, not peak accuracy.**
  (v1's "80% Dice at 19 images" was an older result. Do not reuse it.)
- **IEEE MWSCAS 2026** (co-author; led the PCB design team): delivered as an
  **oral**, August 11 2026, Cincinnati. 15 authors, Neelay 14th — cite as
  "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), IEEE
  MWSCAS 2026 (oral)". Don't claim IEEE Xplore indexing until confirmed.
  **Title, per the resume (owner call 2026-09-14): "Helical Antenna for
  Electromagnetic Field Stimulation in Alzheimer's Disease Therapy"**; the
  site used to call this project the "MRI birdcage coil".
- **Education**: B.S. Artificial Intelligence, Purdue (Indianapolis campus),
  Intelligent Control & Systems concentration, math minor, John Martinson Honors
  College, Dean's List, GPA 3.68 (all per the live resume, 2026-09-14).
  **On leave Fall 2026 for NASA (the site says "gap semester", owner's
  wording); returns January 2027; graduates May 2027.** Rendered as its own
  Experience row on an amber "gap semester" lamp (owner call, 2026-09-14).
- **NASA Ames is two engagements, presented as one arc**: Summer 2026 (SLAAC,
  space-launch/airspace coordination, Dr. Kapil Sheth) · Fall 2026, Aug 24–Dec 4
  (synthetic text-to-ATC-speech dataset; ATC speech→text→database pipeline,
  Stephen Clarke). **The Summer 2027 lunar digital twin is DROPPED** (owner,
  2026-09-14: no longer pursuing it); never mention it again.
- **The flight-day transformer (Figure 3) is the owner's own work**, trained
  from scratch (owner, 2026-09-14). Resume wording: a custom LLM with a novel
  token vocabulary that "speaks" filed flight plans, synthesizing ~44,000
  flights matched to historical density, for capacity and safety studies of US
  airspace failure modes; the owner adds it is being used at NASA to justify
  real changes and projects. Too slow to run live in the browser.
- Also real and usable: **Regenstrief** (Feb 2024 →; x0-diffusion vessel
  segmentation, synthetic angiogram pipeline, img2img CLIP for vessel locality;
  Dr. Andrew Gonzalez, Shantanu Dev) · **Davinci Wearables** (2025; agentic vLLM
  nutritional estimation from meal photos, <15% error) · **V2X aircraft-maintenance
  LLM lead** (two-stage RAG; hallucinations ~40% → ~5%) · **the MWSCAS
  helical stimulation antenna** embedded/PCB team lead · the **chess EBM + solar Pi device** (v2 of a lost ESP32
  build; now stronger than its author).
- **Chess Elo phrasing stays honest**: "roughly 1900–2200 vs Stockfish's limited
  modes", never 2300+ flat. Quantization cost ≈ 0 (-14 ±59 Elo). The copy's
  "The Pi gets through its 500 sims in about 2 seconds" is CONFIRMED by the
  owner (2026-09-14; "runs even faster on desktop"). ⚠️ The live resume says
  "RaspPi 2W (~1s / move)"; the owner ruled (2026-09-14) the site says
  **Raspberry Pi Zero 2 W**, not "Pi 4".
- **Links** (footer set is data-driven; Google Scholar joins after the preprint):
  - Resume: https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview
  - CV (HIDDEN from the site since 2026-09-14, owner call; restore on request): https://docs.google.com/document/d/1mzXEobC6bxIV_SqX761EVrDTmsYtrbsA/preview
  - Always the `/preview` form of a Drive URL, never `/edit?usp=sharing&ouid=…`
    (`ouid` is the owner's account id; `/edit` opens editing chrome;
    `/export?format=pdf` force-downloads).
  - ORCID: https://orcid.org/0009-0008-9482-0160 · GitHub: `NeelayRanjan` ·
    LinkedIn: `/in/neelayranjan` · email: `neelay.ranjan@outlook.com`

## Voice — binding for all visitor-facing copy

All copy lives in `content/copy.ts`; components reference `copy.*`. First person.
The audience reads a lot of LLM output and clocks it instantly; copy that
pattern-matches to "written by ChatGPT" undercuts a site whose claim is that the
work is real. (Code comments and this file are maintainer-facing and exempt.)

- **Before any copywriting pass, fetch Wikipedia's "Signs of AI writing" page and
  apply it** — the owner's standing instruction. It supersets the lists below.
- **No em-dashes.** Use a comma, a period, a colon, or parentheses. No en-dash
  connectors either; ranges (7–11s) are fine.
- Banned words (the smell is what matters): delve, dive into, unlock, unleash,
  harness, leverage, elevate, empower, foster, seamless, robust, cutting-edge,
  state-of-the-art, game-changing, revolutionary, showcase, testament, tapestry,
  realm, landscape/journey (as metaphor), crucial, pivotal, vital, meticulous,
  comprehensive, holistic, nuanced, vibrant, profound, "it's worth noting",
  "at its core", "let's explore".
- Banned constructions: "not just X, but Y" and cousins; rule-of-three padding;
  "It's not about X. It's about Y."; rhetorical questions the copy then answers;
  "In conclusion" / "Ultimately"; sentences starting "Indeed" or "Moreover".
- Concrete numbers beat adjectives. Say the surprising thing plainly and stop.
  Sentence case everywhere. Contractions are fine. Hedge only where there's real
  uncertainty. End flat — no summary sentence restating the point.
- Read it aloud; if it sounds like a press release or a LinkedIn post, rewrite.

## Constitution — survives any redesign

- **Never fake a model's output.** Gate every model-backed feature on its
  artifact's presence and say so in the UI when it's absent. A plausible stub
  teaches visitors the wrong thing about how the work behaves, which costs more
  than an empty section.
- **Never reimplement vendored model math.** Preprocessing, schedules, samplers,
  encoders: port exactly, validate against reference vectors, ask the model owner
  when the API doesn't expose what you need. A subtly wrong port produces
  plausible garbage that reads as "the model is bad".
- **A control is honest or absent.** A param, button or toggle that doesn't change
  anything real is the illusion breaking in the visitor's hands. (This killed v1's
  fake difficulty ladder and froze its non-live command-line params.)
- **Illustrative pieces are labeled illustrative.** The line between "I trained
  this" and "I drew this" never blurs, in copy or in presentation.
- **Measure, don't assume.** Every load-bearing number gets measured, in a real
  browser, on a production build. v1's history is full of measurements that
  contradicted the reasonable guess (int8 slower than fp32 on ARM; a classifier
  wanting MORE noise; threads doing nothing for a small model). "HTTP 200" proves
  nothing about a canvas — screenshot it.
- **Mobile above all.** Lazy-load everything heavy, pause everything animated when
  off-screen or tab-hidden, and keep first paint free of model payloads. Physics
  and animation run on a dt-scaled clock (`k = dt/16.67`), never raw per-frame
  constants.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + React 19. **Read
  `node_modules/next/dist/docs/` before writing Next code — this version has
  breaking changes** (see AGENTS.md, included below).
- Tailwind v4: theme tokens live in CSS `@theme`; there is no `tailwind.config.ts`.
- **Two monos, on purpose.** `--font-mono` is Spline Sans Mono (measured advance
  0.559em, `scripts/measure-mono.mjs`) and is the site-wide mono everywhere except
  the character grids. Those (the trajectory viewer's `AsciiLines`) keep v1's
  Geist Mono (0.600em) instead, scoped through `lib/grid-font.ts` rather than
  `--font-mono`: `AsciiLines`' `lineHeight: 0.68` is that 0.6 advance plus its
  0.08em letter-spacing, an identity derived for Geist Mono specifically, and
  swapping in Spline's narrower advance without re-deriving it would stretch
  every digit in the grid. Don't wire the grids to `--font-mono`.
- Runtime deps are exactly: `chess.js` (owns every chess rule — never hand-roll
  them), `onnxruntime-web` 1.27 (every model on the page), `@vercel/analytics`
  2 (see Analytics below) and, since 2026-09-15, `satellite.js` (SGP4
  propagation for the live ISS, `lib/sky-iss.ts`; lazy-imported only after
  `/api/iss-tle` actually returns a TLE, so it never loads for a visitor the
  route fails, and a new dependency owner-requested for that one feature — a
  lazy chunk of ~38.7 KB). `playwright` is a devDependency (Firefox only
  installed) for canvas verification and the two artifact-rendering scripts.
  `astronomy-engine` is also devDependency-only: it never ships to the
  browser, and exists solely so `scripts/test-sky-math.mjs` and
  `scripts/verify-redesign.mjs` have an independent reference to pin
  `lib/sky-math.ts`'s projection math against.
- **`app/api/iss-tle/route.ts` is the site's only server code path** (every
  other route is static). `GET` fetches CelesTrak's TLE for the ISS with an
  8s upstream timeout and `export const revalidate = 7200`; that works here
  specifically because this project has `cacheComponents` off (with it on,
  route-level `revalidate` means something different — see the route's own
  header comment and `node_modules/next/dist/docs/`). Every failure path —
  a non-OK response, an unparseable body, a thrown error, the timeout — still
  answers HTTP 200 with `{ tle: null, fetchedAt }`, never a non-2xx, so the
  cache keeps revalidating instead of getting stuck on a hard failure; the
  client (`lib/sky-iss.ts`) treats a null TLE as "no ISS today", not an
  error. A visitor's browser never talks to CelesTrak directly, and CelesTrak
  sees this deployment at most once per two hours (their own fair-use ask),
  plus once per build: preview and production builds both prerender the
  route, and each prerender is a real fetch.
  The build lists the route as `○ /api/iss-tle 2h 1y`.
- Deploy: Vercel, custom domain neelayranjan.dev. Repo is private
  (`NeelayRanjan/portfolio`).
- **Analytics (wired 2026-09-13): Vercel Web Analytics.** `<Analytics />` in
  `app/layout.tsx` records cookieless page views (client navigations
  included). Custom events live ONLY in `lib/track.ts`, deliberately three
  (two until 2026-09-16):
  `outbound_link {label}` on every identity and reference link (via the
  `TrackedLink` client leaf, so Masthead/References stay server components;
  `onAuxClick` catches middle-click), and `demo_used {demo}` once per demo
  per page load (stargaze's carries `via: "toggle" | "footer"` since
  2026-09-16, naming the FIRST door used that load: a property, never a
  second event, so the quota rule holds), fired only AFTER real output (a completed headshot run, a
  completed digit generation, an accepted chess move) so failures and
  slider-scrubbing never count, and (2026-09-16) `page_reload`, no
  properties, once per page load whose navigation type is `reload`: the one
  field signal a silent tab crash leaves, read as a rate against page views
  by device (`ReloadBeacon` in the layout calls `trackReloadOnce`). Quota-conscious on purpose: don't add
  per-interaction events. **Speed Insights** (`@vercel/speed-insights`,
  `<SpeedInsights />` beside `<Analytics />`, 2026-09-16) reports Core Web
  Vitals per route and device, same-origin from `/_vercel/speed-insights/`;
  it must be ENABLED in the dashboard like Web Analytics or its script 404s.
  ⚠️ Production loads the tracker SAME-ORIGIN from
  `/_vercel/insights/script.js`, which is why COEP never blocks it; dev mode
  loads a debug copy from va.vercel-scripts.com, which works only because that
  host sends `cross-origin-resource-policy: cross-origin` (measured). Locally
  the insights path 404s, so events wait in `window.vaq` forever, and that
  queue is what the verify check reads; real delivery is only visible in the
  Vercel dashboard, and Web Analytics must be ENABLED there or production's
  script 404s too. **The project is on Vercel Pro since 2026-09-16** (the
  Hobby plan answered custom-event queries with HTTP 402); custom events are
  ingested and readable, back to launch, through the Vercel MCP's
  `get_web_analytics` with project slug `portfolio` and no team.
- **⚠️ `/models/*`, `/ort/*` and `/headshot/*` are served `immutable` for a year**
  (`next.config.ts`). That makes filenames the cache key: a retrained model or a
  refreshed export MUST ship under a new filename (and the code path that loads it
  updated), or returning visitors keep the old bytes until the cache expires. The
  headshot bundle does that with a versioned DIRECTORY (`/headshot/v2/…`, the
  photos included, since their bytes changed too); `:path*` matches the deeper
  path, so the header still applies. The v1 paths are deleted, not redirected.
- **COOP/COEP headers on every route** (`next.config.ts`): they enable
  SharedArrayBuffer → multithreaded WASM. The draw demo's classifier needs them
  (~1s vs ~17s without); chess doesn't (measured: threads change nothing for a
  469K-param model). Consequence: any future cross-origin image/script/iframe
  needs CORP headers or `crossorigin="anonymous"` or it's blocked outright.
- `scripts/sync-ort.mjs` (wired to `predev`/`prebuild`) copies ORT's wasm into
  `public/ort/` — version-locked to the JS, so bumping `onnxruntime-web` without it
  fails at runtime. It copies the **plain** `ort-wasm-simd-threaded` pair, which
  is what the `onnxruntime-web/wasm` entry fetches, and removes a stale asyncify
  pair if one is lying around (2026-09-16; before that it copied the asyncify
  build for the `/webgpu` entry, see the WebKit trap below). ⚠️ The entry point
  decides the build: in 1.27 `/webgpu` always fetches asyncify and the BARE
  `onnxruntime-web` entry always fetches jsep, and both run away in
  JavaScriptCore; only `/wasm` fetches the plain build. A wrong build 404s and
  surfaces as the useless "no available backend found". If ORT changes what it
  fetches, the network tab names the file — don't guess, and the
  `ort-runtime-build` verify check asserts it from the network.
- `scripts/gen-icons.py` (fontTools + cairosvg venv; fetches the STIX variable
  TTF, see its header), `scripts/gen-og.mjs` (Playwright),
  `scripts/prepare-sky.mjs` (fetches the star catalog from a commit-pinned
  d3-celestial on GitHub raw) and `scripts/prepare-sky-objects.mjs`
  (2026-09-15: derives `public/sky/objects.json` and `public/sky/milkyway.json`
  from the same pinned d3-celestial, JPL Horizons for the Voyagers, a
  SHA-256-pinned Wayback copy of the IMO 2026 meteor calendar, and a
  SHA-256-pinned Wikipedia revision for constellation origins — see "Night
  sky + stargaze" below) are **hand-run, never wired to prebuild** —
  Vercel's image has neither toolchain and Vercel's build has no network
  access to fetch any of it. Their outputs are committed. The favicon is the owner's mark (2026-09-12): STIX "N"
  in ink on the paper tile with stamp-red corner brackets; edit the script's
  token constants and re-run rather than hand-editing the four app/ icon files. The OG card screenshots the TOP of the live page
  (name, tagline, abstract, headshot rail; it refuses to write a card whose h1
  is outside the frame), waiting on `window.__sky?.drawn` (2026-09-15, not the
  old DeskField-specific readiness check it used to poll) before it shoots, so
  re-run it after ANY masthead copy or layout change; `metadataBase` in `layout.tsx` is required
  or `/og.png` never resolves in unfurls.
- The chess worker must stay a literal
  `new Worker(new URL("./chess-worker.ts", import.meta.url), { type: "module" })`
  or the bundler loses the dependency. **onnxruntime-web is imported in the worker
  and nowhere else** — importing it from a component puts 24MB back in the page
  bundle.
- Loading discipline (v1 behavior worth keeping in any design): nothing heavy in
  flight at first paint; each demo's payload loads when its section is reached;
  the 26MB draw model loads on first interaction; ORT+chess (24.4MB) may warm on
  desktop idle, gated by `saveData` / bad `effectiveType` / `deviceMemory < 4` /
  `(max-width: 767px)`, where **absent means unknown, not no** (the connection
  APIs are Chrome-only). All loaders are memoized promises so warm and section
  calls share one download.

## Hard-won traps — measured; they will bite again

- **Turbopack has served stale CSS** for hours, silently. If a CSS change appears
  to do nothing, curl the served chunk before doubting the code; `rm -rf .next`
  fixes it.
- **Tailwind v4 can't order rem breakpoints against px ones.** `sm:` (40rem)
  and `min-[880px]` on one element: the build emitted `sm:` LATER, so it won at
  every desktop width (Figure 5 sat at two columns, 2026-09-14). The site's
  breakpoint is 880px; pair it only with other `min-[Npx]` variants.
- **`ctx.font` silently ignores CSS variables** (invalid assignments don't throw,
  they keep the old font). Anything canvas that needs the page's font must resolve
  the family via `getComputedStyle` or a DOM probe + ResizeObserver first.
- **The CSS `ch` unit is the advance of `0`** and over-counts by ~30% in
  proportional type: v1 measured `54ch` ≈ 70 real characters, `68ch` ≈ 88.
- **Headless Firefox is not a browser for timing**: no WebGPU adapter, ~20x slower
  ONNX inference than the same machine natively. Verify UX timing in a real
  browser; quote only measured numbers.
- **Headless Firefox is not a WebKit either, and the iPhone crash loop lived
  in JavaScriptCore** (2026-09-16). The site imported `onnxruntime-web/webgpu`
  for every model, that entry always fetches ORT's asyncify wasm build, and
  JSC's optimizing wasm tier runs away on it (ORT issue 26827) while every
  Firefox-based check passed and every Chrome visitor was fine. It was blamed
  on the 26 MB model on the main thread for two months, and the memory
  measurements in this file (the ~24 MB runtime, the never-shrinking heap)
  were all true and all beside the point. What found it: a real WebKit on
  the dev machine (WebKitGTK through python gi, `scripts/probe-webkit-draw.py`)
  and measuring the DIFFERENCE between two builds of the same run, same as
  the band-warmth lesson above: asyncify 5.3→11.5 GB and ~395% CPU across a
  minute of idle, plain build 802→790 MB and ~96%. Two habits follow. Any
  bug reported only from an iPhone gets a WebKitGTK run before a theory; and
  a dependency's ENTRY POINT is a build choice (ORT's `/webgpu`, bare and
  `/wasm` entries fetch three different binaries), so a loader that "only
  asks for wasm" can still ship the wrong runtime.
- **Dev-server red herrings**, all confirmed harmless: the dev overlay loads its
  own Geist copies and triggers font-preload warnings (production: zero); a
  hydration error in a dev log right after a Fast Refresh full reload is not
  evidence of a bug; `next build` drops a raw `chess-worker.<hash>.ts` served as
  `video/mp2t` that is never fetched. Confirm suspicions against
  `npm run build && npm start`, not the dev server.
- **Playwright's Firefox lacks `screenshot({omitBackground})`** — the icon script
  rasterizes via canvas `toDataURL` instead.
- **A re-render that flips a load-triggering prop null→loaded→null→loaded can
  silently re-fire an effect meant to run once — and the fix is NOT "skip on
  restore".** Night sky's stargaze restore reloads the draw model on return,
  so `model` (null→loaded) now cycles on every round trip; a pre-existing
  `useEffect(() => { if (!model || !hasInk) return; autoPick(); }, [model])`
  had assumed that transition happens once per page load and started
  re-classifying (and transiently disabling the generate button) on every
  restore. The failure mode was a genuinely flaky Playwright check, not an
  obvious one: the button's native disabled-click suppression swallows a
  `.click()` that lands in the disabled window with no thrown error and no
  handler firing, so the symptom was a `waitForFunction` timeout with nothing
  in between to blame. Measured before any fix: 3 runs at 67924ms (pass,
  lucky timing), 169033ms and 169431ms (fail, 400ms apart, which is what said
  "real race" over "slow machine"). **The first fix (`restoringRef`, a flag
  set before a restore's reload and consumed by the effect) was itself wrong**
  — a stronger-model review caught it skipping the classify on three paths
  where the restore was NOT actually fresh: stargaze entered during the first
  download (the pen-up classify never ran, having bailed on `model === null`),
  stargaze entered mid-classify (the in-flight run aborts before setting
  anything), and stargaze entered inside the 450ms pen-up debounce (cleared
  before it ever fires) — in all three the flag still claimed "fresh" on
  exit and the restore silently never classified. The shipped fix
  (`components/DrawDigit.tsx`, `fitFreshRef`/`inkGenRef`) is keyed on the
  actual invariant instead of on "was this a restore": `fitFreshRef` is set
  `true` only right after a classify actually completes against the ink still
  on screen (gated on `inkGenRef`, which `onDown`/`clear` bump so a stroke
  landing mid-classify can't mark stale scores fresh), and set `false` by any
  new ink or a wipe; the model-load effect skips only when `fitFreshRef.current`
  is true. After that fix, `stargaze-cancels-run` ran 3/3 clean at
  52200-52817ms (task-7 fix round 1) and 52969-54392ms across further runs,
  all pass. The general shape — an effect keyed on a value assumed monotonic
  that a new code path made cyclic — is worth checking for anywhere else a
  model-loaded flag gets a second producer; the specific trap inside that
  shape is reaching for "was this transition a restore" as the guard instead
  of the invariant the effect actually cares about.
- **Importing `satellite.js` on the client hangs a Turbopack production
  build indefinitely** (2026-09-15) — `next build` never gets past "Creating
  an optimized production build ...". Bisected (route-only vs. import-only
  vs. both) to: importing the package at all is what hangs it, not which of
  its two package-internal subpath imports (`#wasm-single-thread` /
  `#wasm-multi-thread`, reached transitively from its main export, resolved
  through the package's own `package.json` `imports` map into
  Emscripten-generated glue that does `await import("node:module")`, plus a
  pthreads variant that self-references a `new Worker(...)`) Turbopack
  actually trips on — the bisect isolated the trigger to "imports
  satellite.js," not to a single construct inside it. Fixed by
  `turbopack.resolveAlias` in `next.config.ts` mapping BOTH subpath imports
  to `lib/satellite-wasm-stub.js` (a stub that throws loudly if ever
  actually called — nothing here calls it, since the site only uses SGP4
  propagation, never the package's optional WASM runtimes). Vercel's own
  `next build` is Turbopack too, so this isn't a local-only quirk; it bites
  in production exactly the same way.
- **A Playwright check against the real system clock can be genuinely
  flaky, not just slow.** `sky-hover` intermittently missed its sampled
  pixel because the hover label's own desk-coloured backing (added to keep
  labels legible over drawn sky content) could, at some real clock instants,
  end up covering the exact point the check sampled for brightness — a race
  between "what LST is it right now" and "where did the check decide to
  sample," not a timeout. Fixed by pinning `sky-hover` (and, by the same
  logic, every other sky/stargaze check) to a fixed instant via
  `page.clock.setFixedTime`, rather than letting any of them run against
  whatever the wall clock happens to be. Every sky/stargaze verify check is
  now pinned or time-independent for exactly this reason.
- **Andromeda and the galactic core are never both on screen at once on a
  1600x1000 canvas** under the moved pole — `checkSkyObjects` finds each of
  their positions with its own independent instant search
  (`findInstant`), never a single shared instant, because the pole's new
  off-centre position means the two bodies' on-screen windows don't
  reliably overlap the way they did under the old centred pole.
- **The Intl `"at"` glue in a combined date-time format varies by engine**
  (`Intl.DateTimeFormat` with both `dateStyle` and `timeStyle`, or
  `month`/`day`/`year` plus `hour`/`minute` in one formatter, inserts locale
  connective text like "at" whose exact wording isn't guaranteed stable
  across browsers). `SkyCard.tsx` formats date and time with two separate
  `Intl.DateTimeFormat` instances (`LONG_DATE`/`SHORT_DATE` and `TIME`) and
  its own literal joins, rather than one combined formatter, so the ISS
  card's epoch line reads the same everywhere it renders.
- **Frame-time medians for the new sky layers, measured in headless Firefox**
  (`sky-animates-1280`, against the pre-objects 2.96ms baseline and its 2x
  budget of 5.92ms): three runs at 3.12ms, 2.80ms and 2.86ms, plus two more
  context readings at 2.80ms and 3.20ms — all comfortably under budget, most
  of them at or below the pre-objects baseline itself. The Milky Way's 5
  nested levels, ~30 objects and ~12 showers (≈2,300 precomputed vertices
  total) add no measurable draw cost at this catalog size; none of the
  planned fallbacks (per-level Path2D caching, off-canvas ring culling,
  half-resolution offscreen blit) were needed.
- **Hue cannot survive low alpha, and a screenshot review can't catch that it
  didn't.** Stargaze's first pass at warming the Milky Way band (colour
  round, 2026-09-15) changed only its hue, and a screenshot review passed it
  because the band looks warm in BOTH modes (the site's own `INK` token is a
  cream, `234,229,218`). Measured afterward: the band paints at 2-5% alpha
  over a (12,11,9) desk, and at that opacity the gap between `INK`'s warmth
  (r−b = 16) and the sourced tan's (r−b = 40) composites to about ONE level
  out of 255 — a 375-pixel sample across the band measured a median warmth
  change of exactly zero between colour on and off. A hue you can't see is a
  comment in the code, not a colour. Fixed by lifting the band's ALPHA
  alongside its hue in stargaze (gain 2.6), which is honest rather than a
  cheat: a real long exposure is genuinely brighter and more saturated than
  the eye, and the credit line already says these are long-exposure colours.
  After the fix: median warmth +6, p90 +12, luminance median +13, and normal
  mode stayed byte-identical by construction and by a stash-diff screenshot
  with a matching SHA-256. The general lesson, not just this one bug: measure
  the DIFFERENCE between two states, not the appearance of either one alone —
  and when an implementer hedges a measurement as "an observation, not a
  verdict," that hedge is exactly the thing to go measure.

## The demos — contracts and traps (these carry into the redesign)

### Night sky + stargaze (every page)
- **Frame**: J2000 equatorial throughout (the catalog's epoch; the Moon and
  planets are computed in the same frame so everything agrees). **Projection**:
  polar stereographic centred on the north celestial pole; `r = k · tan((90° −
  dec) / 2)`. **The pole moved top left, 2026-09-15, margin-based rather than
  a fixed viewport fraction**: `sheetW = min(width − 32, 1000)`,
  `leftMargin = (width − sheetW) / 2`, and the pole sits at
  `(leftMargin / 2, 0.18 · height)` whenever `leftMargin ≥ 72` (`POLE_MIN_MARGIN_PX`
  in `lib/sky-math.ts`), else at `(0.22 · width, 28)`. Because the pole in the
  wide branch is always exactly half the sheet's own left offset, it can
  never land under the sheet in that branch, by construction, at any width —
  at 1280px (sheet left edge at x=140) the pole sits at x=70, 70px clear; at
  1440px (sheet edge at x=220) it sits at x=110, 110px clear; at 1920px
  (sheet edge at x=460) it sits at x=230, 230px clear. The narrow branch
  (`width < 1144`, verified: `leftMargin` is a constant 16px below 1032px, so
  the branch threshold is exactly where `leftMargin` first reaches 72) is the
  only place Polaris sits close to the page at all, and there it's ABOVE the
  sheet in the top margin, not under it. `k` is chosen so the viewport corner
  FARTHEST from the pole lands on dec −35° (was: half-diagonal at −30°,
  which is now stale everywhere it's quoted) — measured `k = 791.8` at
  1440x900 for the new pole (110, 162), farthest corner bottom-right,
  `hypot(1330, 738) = 1521.03`, `k = 1521.03 / tan(62.5°)`. This keeps
  Sagittarius and the galactic core (dec −29°) reachable on screen as the sky
  turns, which is the reason the ruling moved the edge declination from −30°
  to −35° at the same time as the pole. **Orientation**: up from the pole
  points at the zenith over Moffett Field (37.4153°N, 122.0647°W), east is to
  the right, and a star's screen angle is `RA − LST` measured from straight up
  — so as LST advances the sky turns counterclockwise, same as the real sky
  around Polaris.
- **`lib/sky-math.ts` has no imports**, on purpose, so it can be pinned in
  plain node (`scripts/test-sky-math.mjs`) against `astronomy-engine`
  (devDependency only, never shipped): gated at GMST within 2 s, the planets
  within 0.25°, the Moon within 0.3° (measured worst case tighter: GMST
  1.13 s, Saturn 0.088°, Moon 0.043°). `lib/sky-render.ts` is the pure
  per-frame drawer (no state, no clock) that reads its projected output.
- **NightSky's module layout** (split 2026-09-16 before any discoverability
  work, with no behaviour change: 29/30 checks identical before and after,
  listener add/remove pairs 10/10, frame median flat; this closed the old
  "NightSky past 800 lines" open item). `components/manuscript/NightSky.tsx`
  (~350 lines) only orchestrates: refs, React state, the card focus effect
  keyed on `card?.id`, wiring, listeners, the stargaze subscriber, cleanup,
  render. The old effect closure's shared `let`s live on ONE mutable
  `SkyState` object passed as `s`; a value only one module needs stays private
  to it. Under `components/manuscript/night-sky/`:
  - `state.ts`: the `SkyState` type and `createSkyState()`, plus the layer and
    drag types.
  - `painter.ts`: canvas resize, font resolution, `paint` (the `drawSky` call,
    `window.__sky`, following the card, the ISS card's 1s refresh).
  - `frame-loop.ts`: the rAF step, its frame gates, the spring advance and
    the saturation ease.
  - `pointer-controller.ts`: picking, highlight, the stargaze click, every
    pointer/blur handler, drag and spring settling, the saturation target,
    the pointer cursor.
  - `card-controller.ts`: building, opening, closing and following a card,
    the out-of-view mirror, the capture-phase Escape handler.
  - `keyboard-list.tsx`: the list's refresh, its portal, and its visible
    panel presentation.
  - `layer-loaders.ts`: `sky.json`, `objects.json`, `milkyway.json`, the ISS
    TLE, the sky-facts chunk, `fonts.ready`.
  - `entry-rings.ts` (no imports): the one-time rings' picker and envelope.
  - `invite.ts`: the once-per-session sky caption.
  Two module-level stores sit beside it in `lib/`: `lib/stargaze.ts` (on/off,
  offload reporting, the door used) and `lib/stargaze-browse.ts` (the card
  counts, whether the list panel is open, the hint bar's measured bottom
  edge), shared by `StargazeToggle` and the sky's plain-module controllers,
  which read them outside React. `lib/sky-colour.ts` (no imports) holds the
  saturation constants and math. Put a new feature in the module that owns
  its concern; don't grow `NightSky.tsx` back into the closure it was.
- **Drag to pan** (2026-09-15, `lib/sky-pan.ts`, no imports, closed-form
  math): a pointer drag adds a screen-space offset to the whole chart —
  pole, stars, lines, objects, labels together. `rubberBand` bounds it past
  `PAN_LIMIT_FRAC · min(W,H)` to a fraction of further travel, never
  unbounded (stargaze uses `STARGAZE_PAN_LIMIT_FRAC`, twice as loose: there
  is no sheet to compose around while stargazing); on release `springStep` (critically damped, the exact closed-form
  solution advanced by the real elapsed ms, so frame rate can't change its
  curve; not the `k = dt/16.67` per-frame form) returns the offset to `(0,0)`, settling
  in under 1.5s (measured: a 150x80 held drag springs home in 945-947ms).
  Reduced motion snaps the offset to `(0,0)` on release instead of
  animating; the drag itself still works under reduced motion.
  **⚠️ That release-springs-home rule is normal mode only** (owner call,
  2026-09-15: "when I drag it snaps back, only snap back when I leave
  stargazing mode"). In stargaze a release leaves the offset exactly where
  the visitor put it; the single place it goes home is the
  `subscribeStargaze(false)` handler, which every exit path funnels through
  (the exit button, Escape, anything else), so a chart can't be left
  off-centre behind the sheet. That handler also ends a drag still held
  through the exit, or the next `pointermove` in normal mode would pan with
  stargaze's now-gone looser limit. The idle sky
  keeps painting at its frame gate (~20 fps at ≥880px, ~10 fps below; it
  turns, so it never pauses outside reduced motion or a hidden tab); a live
  drag or spring raises that to ~60 fps (a 16ms gate less 2ms of rAF
  jitter), never the display's full refresh rate. A drag ends on pointerup,
  pointercancel, a mouse move with no button down, `lostpointercapture` or
  a window blur, so it can't get stuck. In stargaze mode `body` is
  `user-select: none` except the card and the keyboard list. In normal mode, touch never starts a drag
  (the 16px desk margins there need to scroll the page instead) and dragging
  never starts on the sheet, a link, a button, an input, or the stargaze
  controls; in stargaze mode, touch drag is enabled and the container gets
  `touch-action: none` so the browser doesn't also try to scroll. A pointer
  that travels less than `CLICK_SLOP_PX` (5px) between down and up is a
  click (selects in stargaze mode), not a drag; hover highlighting and hover
  labels are suspended while dragging, and the desk cursor becomes
  `grabbing`.
- **The objects layer is gated exactly like the star catalog, but per layer**
  (`lib/sky-objects.ts`'s `loadObjects`/`loadMilkyWay`, `NightSky`'s
  `layers.{objects,milkyWay,facts,iss}`): each of `objects.json`,
  `milkyway.json`, the lazy-imported `content/sky-facts.ts`, and the ISS's
  own fetch is independently `"loading" | "ready" | "absent" | "error"`. A
  404 on any one of them resolves `null` for that layer only — the rest of
  the sky (stars, lines, whichever other layers did load) still draws; a
  malformed file throws, at the same "see the export bug, don't hide it"
  standard as the star catalog.
- **The catalog grew from 30 to 45 objects in the colour round** (`objects.json`,
  `scripts/prepare-sky-objects.mjs`): eight more Messier picks (M16, M20, M27,
  M33, M78, M81, M82, M104), the Horsehead, the Flame, and the Double Cluster
  and the Veil, the last two each shipping as TWO separate sourced objects
  (NGC 869 + NGC 884, NGC 6960 + NGC 6992) rather than one, the same ruling
  position-sources.md already applied elsewhere: neither pair has one
  defensible centre. Two data traps caught at the source, each with an
  assertion so a regeneration can't reintroduce it: NGC 2024's (the Flame's)
  magnitude is d3-celestial's own literal `999` sentinel, not a real value,
  and the Horsehead's (B 33) `2` is Barnard's OPACITY class, not a
  brightness — a dark nebula emits nothing to have a magnitude.
- **Not-to-scale deep-sky glyphs** (2026-09-15, `prepareObjectGlyphs` in
  `lib/sky-objects.ts` + the draw helpers in `lib/sky-layers.ts`): galaxies,
  nebulae and clusters are drawn as illustrative "zoomed in" shapes, sized by
  eye against a 1440px screenshot and **deliberately not proportional to the
  real angular sizes** (M87 is a giant elliptical far bigger than M31 in
  life; here it is drawn smaller because it is fainter and less the point).
  Every shape is prepared ONCE per catalog load, so the ~20 fps paint loop
  only translates and transforms already-placed points. Rules that keep it
  honest and cheap: no `Math.random` anywhere — the cluster scatters, nebula
  blobs and Milky Way grain all seed a `mulberry32` from a string hash, so
  the shape is identical on every load for every visitor (the same
  determinism rule as the sample-space figure); positions are untouched real
  data; the credit line and a `notToScale` card line both say the symbols are
  drawn bigger than life; and an id the size tables don't know about falls
  back to the original plain symbol rather than erroring. The Milky Way's
  five levels went from a flat 0.022 alpha to a per-level ramp plus a grain
  stipple, which is what makes the band read as a band and the core read as a
  core. Frame-time after all of it: 2.40-2.48ms median against the 5.92ms
  gate, under the 2.80-3.20ms it measured before. **The colour round
  (2026-09-15) replaced plain markers with a variant table**, still prepared
  once per catalog load under the same determinism rule: galaxies pick
  `spiral`, `spiral-companion`, `elliptical`, `edge-on` or `starburst`;
  nebulae pick `emission`, `planetary`, `reflection`, `remnant` or `dark`;
  clusters pick `open` or `globular` (`GALAXY_PX`/`NEBULA_PX`/`CLUSTER_PX` in
  `lib/sky-objects.ts`). Each variant's draw path in `lib/sky-layers.ts`
  composes the object's own dust lanes, filaments, stars and blobs from its
  prepared `ObjectGlyph`, and colours them from `OBJECT_COLOURS` only when
  `v.saturation > 0` (it was the boolean `v.colour` until 2026-09-16); an id
  the variant tables don't know about still falls
  back to the plain symbol. `test-sky-objects.mjs` pins that colour-off
  geometry is byte-unchanged for every glyph that predates the round.
- **Sourced colour: half on the page, full over the sky and in stargaze**
  (owner reversal, 2026-09-16; `lib/sky-colour.ts`, `lib/sky-layers.ts`'s
  `OBJECT_COLOURS`). **History**: the colour round made colour stargaze-only,
  threaded as `colour: isStargazing()`, because the page's OWN figures use
  colour to mean something (green is x0-diffusion, red is SAM, amber is an
  instrument readout, see Figure colour conventions) and a colourful desk
  would compete with that system. The owner reversed it; the concern still
  stands, which is why paper mode gets a measured share and not full colour.
  **Now**: `View`/`FrameInput` carry `saturation: number` in [0, 1] (plus
  `stargazeChrome: boolean`, below); `lib/sky-render.ts` still never reads the
  stargaze store, both arrive as data. Targets, set in `pointer-controller.ts`:
  1 while stargazing; 1 in paper mode while the pointer is over the sky
  (not over the sheet's rect, `[data-sheet]`, `[data-sky-credit]`, a link, a
  button or anything else in `PAN_BLOCKERS`; set on a non-touch
  `pointermove`, on a drag start; cleared on leaving the document, a window
  blur, leaving stargaze); `PAPER_SATURATION` otherwise, and ALWAYS under
  `(hover: none)`, where nothing can hover. The value eases toward its target
  on real elapsed ms (`stepSaturation`, closed-form exponential, tau 60ms,
  snaps inside 0.004: ~280-300ms over ~17 painted steps, measured), raising
  the frame gate while it moves like a drag does; reduced motion snaps.
  **⚠️ `PAPER_COLOUR_SHARE = 0.5` is a share of the DISPLAYED chroma, not a
  parameter** (`PAPER_SATURATION` is defined equal to it). The first attempt
  was `PAPER_SATURATION = 0.25`, picked low out of the figure-competition
  fear, and a three-way crop showed it indistinguishable from grey: objects
  moved 14-44% of the way to stargaze and the band's warmth changed by 0.00.
  The owner had asked for colour "reduced to 50% or 25%", meaning what the
  eye sees, so the controller overturned it (ruling R-SAT-1). A sweep then
  measured the displayed share tracking the internal mix almost one to one
  between about 0.25 and 0.8 (mix 0.5 → median 0.53, objects 0.44-0.61), so
  the constant means what it says there; below ~0.25 it doesn't (mix 0.1 gave
  M45 0.28), and a future lower value needs a real mapping. `sky-colour`
  asserts the measured share against the constant, so a palette or glyph
  change that bends the relation fails there. Each palette colour is mixed
  toward its own Rec. 709 luminance by `1 − s` (`saturateRgb`); the 45 mixed
  palettes and the band's colour and gain are memoised on the last `s`, so
  nothing rebuilds at rest. **The band has its own curve**: its hue lerp
  (`INK` → the stargaze tan) and alpha gain (1 → 2.6) both run on
  `bandMix(s) = s ** 0.5`, because at 2-5% alpha a linear lerp moves the
  composited warmth in whole-level steps that land late (mean warmth 4.02 at
  mix 0 through 0.4, 5.03 at 0.5-0.6, 6.04 at 0.7-0.8, 7.04 at 1, over 57,717
  band pixels). Paper's 0.5 maps to 0.71, the 6.04 step: 67% of stargaze's
  warmth gain, since exactly half isn't reachable in whole levels; paper's
  band is also 0.8 of a level BRIGHTER than stargaze's. **The ends are
  pinned**: saturation 0 reproduces the old colour-off draw calls and 1 (with
  `stargazeChrome`) the old stargaze calls, byte for byte, by trace digest in
  `test-sky-objects.mjs`. ⚠️ **0 → anything above 0 is a discontinuity**: it
  switches plain glyphs to coloured variant geometry. Harmless at runtime,
  where saturation never rests at 0; only the verify hook drives it there.
  `window.__skySaturationOverride` (a number, verify-only, nothing on the
  site sets it) replaces the target the next time it is recomputed; the
  browser check needs it for a saturation-0 frame at the same pixels.
  **`stargazeChrome`** exists because several decisions used to read
  `v.colour` as a stand-in for "stargazing" (the Milky Way label's avoidance
  of the hint bar and credit, phone names); with colour now showing on hover
  in paper mode, that stand-in would have pushed the label away from chrome
  that isn't there. The sheet is opaque, so none of this changes a pixel on it
  (measured: zero diff across 0, paper and hovered). **No colour here claims
  to be what an eye would see**: at these brightnesses human vision runs on
  rod cells, which register none, so every drawn colour follows a long
  exposure instead; the credit line says so on every page and each coloured
  card's `copy.stargaze.card.colourNote` restates the mechanism with its
  source. M82 is the one deep-sky object with no palette at all
  (`OBJECT_COLOURS[id]` is absent) and its draw calls are identical at every
  saturation, verified in-browser rather than only in the table, which is the
  proof the gate is real and not blanket.
- **The false-colour rule, ruling R-COLOUR-1**
  (`.superpowers/sdd/sky-colour/progress.md`): colour may follow an emission
  line's OWN wavelength, since a plain RGB camera really does record O III at
  500.7nm as blue-green and H-alpha at 656.3nm as red — but it may never
  follow a false-colour palette that reassigns a line to a channel it doesn't
  belong to, which is exactly what the Hubble/SHO portraits behind several of
  this round's own objects (M16, M27, the Veil among them) do, mapping
  H-alpha onto GREEN. M82 stays grey outright rather than falling back to a
  palette: its famous colour is X-ray and infrared data with no visible-light
  counterpart at all. M104 gets a bulge and a dust lane and no disk colour:
  colour-sources.md could not source a blue disk for this specific galaxy, so
  none is drawn. An id absent from `OBJECT_COLOURS` draws in the site's plain
  neutrals, same as before the round.
- **R-COLOUR-2's citation, for the emission-line-to-colour link itself**: Lodriguss,
  J., *Color in astronomical objects*, in *Beginner's Guide to Astronomical
  Image Processing*, AstroPix
  (astropix.com/books/BGAIP/chapter1/103.html). A freely published book by a
  working astrophotographer, not an institution — accepted here specifically
  because the claim (what colour a line photographs as) is exactly his field;
  it sits below NASA/ESA in authority and must never be dressed up as an
  institutional source. It supports H-alpha = red and O III = blue-green
  only. **[N II] = red stayed unsourced and unstated**: the only pages
  carrying it were unverified tutorials, so nothing on the site rests on it,
  even though it circulates as folk knowledge among astrophotographers.
- **Every palette traces to a citation on ITS OWN card, and that is now
  machine-checked** (final review C1/M4, fixed 2026-09-16). The ten objects
  that had cards before the colour round were coloured without anyone
  touching their citation lists, so six of them drew colours whose only
  source was a page the card never linked, and M42's single source asserted
  the competing false-colour reading. Fixed by fetching and adding the real
  sources: APOD for M31's yellow nucleus and red knots, APOD plus EarthSky
  for M13's giants and its white core, APOD for M44's yellow giants,
  ClarkVision's calibrated true-colour measurement for M42's teal Trapezium
  (its card now carries both readings and says which is which), ESO's
  *Trifid Triple Treat* for M20's blue reflection lobe, and the Milky Way's
  own card gaining the long-exposure APOD and the rod-vision paper behind its
  colour note. Two entries changed instead of gaining a citation: **M33's
  core went from a yellow-white nothing sourced to the "bright-white core"
  NASA's own M33 page describes**, and **the Double Cluster's blue-white is
  explicitly stellar temperature, not a quoted colour** — no page found on
  2026-09-16 (NASA's Caldwell 14, three more APODs) names a colour for it,
  and that is written into the palette comment rather than papered over.
- **⚠️ M57 and M27 carry NO red rim** (final review M2, removed 2026-09-16,
  along with the draw code and the test that pinned it). Both used to fringe
  their outer edge "in H-alpha", which read as sourced and was not: APOD puts
  M57's hydrogen in the INNER ring and its outer ring's red down to nitrogen
  and sulphur, NASA's M27 stratification puts hydrogen in the MIDDLE shell,
  and R-COLOUR-2 rules [N II] = red unsourced. A blue-green body inside a red
  rim is the narrowband composite's own arrangement reached by another route.
  They read as O III shells until a source puts H-alpha at the edge.
- **A dark nebula draws its silhouette in BOTH modes** (final review M3,
  fixed 2026-09-16): `drawPlainNebula` returned after the backdrop blobs, and
  the `dark` variant always has blobs, so the silhouette branch was
  unreachable and the Horsehead — the one object here defined by BLOCKING
  light — rendered outside stargaze as a soft grey glow, treated exactly like
  an emission nebula. The dust now goes down over the backdrop in grey mode
  too. This is one of the two deliberate normal-mode changes in the round.
- **Hit precedence** (`nearestHit` in `lib/sky-render.ts`, hover and
  stargaze clicks alike): a symbol the point is ON (within 6px by default,
  or a bigger glyph's own `core`, never past the caller's own hit radius)
  wins; then a drawn name's text box containing the point (every Hit carries the box of
  its always-on name whenever names draw, even while the name itself is
  suppressed under a hover label); then the nearest symbol within 12px, or
  22px for a touch pointer (`hitRadiusFor`); then the nearest constellation
  segment within 24px. The on-symbol pass exists because names are ~80px
  long: box-first alone made Mars unclickable under "Beehive Cluster"
  (measured). The Milky Way is `boxOnly`: its label box on desktop, and no
  canvas hit at all below 880px, where its label doesn't draw. The label is the
  existing name label plus a second line, the entry's `oneLiner` from
  `content/sky-facts.ts` (constellations get their origin line instead, e.g.
  "One of the 48 constellations in Ptolemy’s Almagest" or "Introduced by
  Lacaille in 1756"). The hover label draws on
  a desk-coloured backing so it never overlaps drawn sky content
  illegibly, and the hovered or selected symbol's own always-on name is
  suppressed while its hover/selection label is showing (`View.suppressName`
  in `lib/sky-render.ts`, read back as `window.__sky.suppressedName`) so the
  two labels never double up.
- **The Milky Way label's anchor avoids drawn objects and the page's own
  chrome, not just the sheet** (colour round Task 3): the band's label
  anchors sit inside the band by construction, so the Double Cluster (added
  this round, and lying inside the band) landed 6-10px from the label and
  made that stretch of the band unclickable — any object added inside the
  band can recreate this. The label now prefers whichever anchor is clear of
  every object drawn this frame AND, while stargazing, of stargaze's own top
  hint bar and bottom credit line, falling back to the closest anchor rather
  than ever dropping the label. The chrome half is gated on
  `v.stargazeChrome` (it read `v.colour` until colour reached paper mode; the
  top band is `max(90, measured hint bottom)`) (final review m6, 2026-09-16):
  the ordinary page fixes neither of those to
  the viewport, and applying the margins there pushed the label out of 220px
  of screen for nothing and moved it off where `main` draws it.
- **A crowded object name steps down past every name box already drawn this
  frame** instead of printing on top of one (`drawnNameBoxes` in
  `lib/sky-layers.ts`, controller fix on Task 4): the Double Cluster's two
  labels and M81/M82's 4px separation both produced an unreadable, and
  unclickable, smear before this — a drawn name is itself a hit target (see
  Hit precedence above), so an overlapped name box can't be clicked either.
- **Stargaze makes clickable things look clickable** (2026-09-16):
  - **Dotted underlines on drawn names, stargaze only** (`View.underlineNames`,
    `addUnderline`/`strokeUnderlines` in `lib/sky-layers.ts`): a 1px `[1, 2]`
    dotted line inside the existing name box, for object, radiant, ISS,
    Milky Way, planet and Moon names. A dotted underline already means
    "clickable" on this page (the stargaze toggle), so the sky borrows the
    page's own grammar; paper-mode names aren't click targets and stay plain.
    A suppressed name draws none. The underline-on trace is a strict
    supersequence of the underline-off trace (node), and the browser check
    measures it as a difference at forced-equal saturation (proved to bite).
  - **Pointer cursor over a selectable symbol or drawn name in stargaze, NOT
    over constellation line bands.** Lines open cards too, but their 24px hit
    band covers most of the sky, and a pointer cursor almost everywhere stops
    meaning anything. A live drag's `grabbing` always wins. ⚠️ It updates on
    `pointermove` only, so under a still pointer it can go stale as the sky
    turns (same as the hover highlight).
  - **One-time entry rings** (`night-sky/entry-rings.ts`, `ENTRY_RING_MS =
    1200`, `ENTRY_RING_COUNT = 4`): on the first stargaze entry of a page
    load, INK rings fade in and out (half-sine on real ms, held static under
    reduced motion and cleared by a timer) around the four non-`boxOnly` hits
    nearest the viewport centre, drawn under the hover layer and never
    hit-testable. A one-shot demonstration inside a mode the visitor chose,
    which is why it doesn't break the no-pulsing rule. **⚠️ The rings wait for
    something to ring**: the first build spent them on an empty sky when
    stargaze was entered before the catalog landed (a slow phone), so
    `tryStartEntryRings` is retried as each layer lands and the load's one
    showing is spent only when there are hits to ring. `stargaze-affordances` holds
    `sky.json`, enters, requires nothing fired, releases, requires rings; the
    old behaviour as a mutant fails with `{"drawn":true,"fired":true,"rings":0}`.
  - **Phone names for the coloured objects** (`View.colouredNames`, stargaze
    only, below 880px): names for ids in `OBJECT_COLOURS`, hit targets like
    any other, stricter than desktop. A phone name flips left at the right
    edge, goes through the step-down, and is LEFT UNDRAWN (no hit box; the
    symbol stays tappable) when no clear slot exists or its box would reach
    the hint bar or the credit band. The top band is the hint bar's MEASURED
    bottom + 6px (`--stargaze-hint-h`, published by a border-box
    ResizeObserver; a content-box one ignored padding growth and left names
    under a grown bar, which `stargaze-browse-400` caught), falling back to
    90px unmeasured; the bottom band is 130px. Planet and Moon names, which
    draw at every width on their own path, go through the same test
    (`nameClearsPhoneChrome`). Desktop names are unchanged: they draw under
    the chrome pills, shaded, not routed.
- **Stargaze cards** (`components/manuscript/SkyCard.tsx`, a DOM `aside`
  with `aria-labelledby`, not canvas): a click under `CLICK_SLOP_PX` on a
  selectable opens a card; a click on empty sky, or the card's own close
  button, closes it. Escape is handled in the capture phase and closes the
  card first, calling `stopImmediatePropagation` so the same keypress never
  also reaches `StargazeToggle`'s exit handler — a second, separate Escape
  press is what exits stargaze. With the list panel open, Escape peels one
  VISIBLE layer per press: panel → card → exit on desktop (the panel's
  capture handler is registered before the card's); on a phone, where a
  docked card hides the panel, card → panel → exit. The card follows its subject every frame as
  the sky turns and while dragging (`followCard`, clamped to the viewport,
  offset from the subject so it doesn't cover it). **Only the visitor closes
  a card** (final review, 2026-09-15): when the subject leaves the viewport
  (the ISS at 180x does within seconds) the card stops following, stays
  where it was, re-clamped, and shows `copy.stargaze.card.outOfView` in a
  polite live region until the subject returns; a constellation counts as in
  view while any segment crosses the viewport. Below 880px it docks to the
  bottom as a sheet (capped at 60dvh, no text under 12px); at 880px and up it uses the available
  viewport height (`calc(100vh - 32px)`) with a scroll fade rather than a
  fixed height, since card content length varies a lot (a one-citation
  planet card vs. a three-citation constellation mythology card). Opening a
  card moves focus into it. Closing moves focus only if it was inside the
  card (back to the keyboard-list button that opened it, else
  `[data-stargaze-exit]`), or on an Escape with focus on nothing (the body,
  after a mouse drag blurred the card); a click on empty sky never yanks it.
- **The stargaze keyboard list** (NightSky, portalled into
  `[data-sky-list-slot]`, which `StargazeToggle` renders right after the exit
  control): the canvas is `aria-hidden`, so this `sr-only` group of buttons,
  named "title, kind", is how keyboard and screen-reader visitors open cards.
  It holds every current Hit, the Milky Way when its label point is on
  screen, and every constellation with a segment in view; refreshed every
  2s, re-rendered only when the set changes, sorted by label (symbols, then
  constellations) so entries coming and going never reorder the rest, and a
  focused button is kept even if its subject leaves. Focusing a button sets
  the hover highlight, so the canvas rings the subject.
  The open effect is keyed on `card?.id`, not on the card object's identity,
  because the ISS's card rebuilds a fresh object every second to carry its
  live look angles — keying on identity would steal focus back every second
  the ISS card is open. Citation links are plain `<a target="_blank"
  rel="noopener">`, deliberately untracked (the analytics quota rule: no new
  per-interaction events).
- **Counts and the list panel** (2026-09-16, `lib/stargaze-browse.ts`,
  `StargazeToggle.tsx`, `night-sky/keyboard-list.tsx`): the hint bar reads
  "… · 44 objects, 88 constellations and more have cards · browse the list"
  ("and more": planets, the Moon, the Milky Way, the ISS and active showers
  open cards too and aren't counted, so it must not read as a total). The
  numbers are never literals: `countCards()` counts `objects.json` objects
  north of `EDGE_DEC_DEG` (−35°) that have a fact, which leaves out Voyager 2
  (the check was proved against 45), and the catalog's constellations with a
  fact. They publish only once `sky`, `objectsData` and `facts` have all
  landed, so no zero ever stands in for data in flight; with `objects.json`
  absent there are no counts, but "browse the list" follows the list, not the
  counts (`setListHasItems`), so it stays whenever the list holds anything. **One list, two presentations**: "browse the list" (`aria-expanded`)
  opens the SAME `[data-sky-list]` group as a visible panel, same buttons,
  same order, same identity. Closed, its `[data-sky-list-panel="closed"]`
  wrapper has no role and no class, so the accessibility tree is exactly what
  it was; open, the wrapper is a `region` labelled by its title with a close
  button, styled like SkyCard. At 880px and up it sits under the bar at the
  column's right edge (300px) and stays open under a card opened from it;
  below 880px it docks to the bottom, capped at `min(60dvh, viewport − bar −
  16px)` so it never reaches the exit control, and a docked card hides it
  until the card closes (focus returns to the opening button). Opening
  focuses the panel itself, not a button, because focusing a button rings its
  subject. **An open panel's rows are frozen** (final review m3): the 2s
  refresh skips while it's open, so a row can't move under a pointer as the
  sky turns; it refreshes once on open and once on close, then the timer
  resumes, and a row whose subject has left opens a card with the
  out-of-view line. Asserted with the clock jumped 10 minutes (a ~90° turn),
  proved to bite by removing the skip. The closed sr-only list is unchanged.
  An open panel blocks pan, sky clicks and hover like a card does;
  leaving stargaze closes it. ⚠️ **Known mismatch**: the panel lists what is
  ON SCREEN now (its title says so) while the counts describe the whole
  catalog, so most of "44 objects" isn't reachable from the list at any
  instant; see Open items.
- **Facts** (`content/sky-facts.ts`, the single source for every one-liner
  and card, typed per the spec's `SkyFact`/`Citation` shape): no runtime
  imports — it's a plain data module, scanned by `scripts/check-voice.mjs`
  under the same rules as `copy.ts` except its citation fields (author,
  title, site, URL, access date are factual, not prose, and exempt).
  `scripts/test-sky-facts.mjs` asserts coverage (every drawn object, all 5
  planets, the Moon, all 88 constellations, every shower, both Voyagers, the
  ISS, the Milky Way band — exactly one fact each) and shape (non-empty
  one-liner/body/visibility, ≥1 well-formed citation). The accuracy rule —
  every number in a card appears in its cited source — is a self-audit done
  by reading, not something a test can check; `SKY_FACTS_PARTIAL=1` exists
  only to let the coverage assertion be skipped while the file is being
  written in batches, and must never be set for an actual verification run.
  `ORIGIN_OVERRIDES` in `test-sky-facts.mjs` (Cru, Sct) exist because Ian
  Ridpath's *Star Tales* documents a different, more specific modern origin
  than the generated Wikipedia table for those two constellations; all 12
  meteor-shower cards' "Naked eye" line cites NASA's "Skywatching Tips From
  NASA" specifically. **Sourcing traps hit for real, 2026-09-15**: the IMO's
  own site was offline all session, so `SHOWERS` in
  `scripts/prepare-sky-objects.mjs` is transcribed from Table 5 of the IMO
  2026 calendar (not its prose, which differs slightly for the Draconids and
  the Southern Taurids), fetched from a SHA-256-pinned Wayback Machine copy
  rather than imo.net; constellation origins are parsed from Wikipedia
  revision 1373165890, also SHA-256-pinned, rather than the live article, so
  a future Wikipedia edit can't silently drift the generated table.
- **The ISS** (`lib/sky-iss.ts`, `satellite.js`'s SGP4): the TLE's native
  frame is TEME of date; the site precesses that to J2000 (`precessToJ2000`)
  before projecting, so it draws in the same frame as everything else. A
  TLE more than 7 days from its own epoch is treated as stale and the ISS is
  removed rather than drawn from a position that's aged past usefulness. The
  card shows whether it's currently above Moffett Field's horizon, altitude,
  speed, the TLE's epoch, and a CelesTrak citation, refreshed once a real
  second (not tied to the simulated clock, which the ISS otherwise follows
  like everything else — at 180x it can cross the visible sky in seconds).
- **Voyager 2 is never drawn** (dec −59.8°, south of the −35° farthest-corner
  edge the moved pole now uses) — its symbol never appears on screen at any
  width or LST, by construction of the projection, but it still keeps its
  fact and its Horizons-derived position in `objects.json`; this is expected,
  not a bug or a missing export.
- **English constellation names are transcribed from Wikipedia's "IAU
  designated constellations" Meaning column**, never d3-celestial's own `en`
  field — that field names asterisms, not the constellation ("Big Dipper" for
  Ursa Major, which is wrong for a name that should read "Great Bear"). A
  meaning that's a mythological figure, or that would just repeat the Latin
  (Lynx, Phoenix, Sculptor), is `null` and the label shows the Latin alone.
  Serpens' two halves (Caput and Cauda) are merged into one constellation
  entry, matching the IAU's 88, not 89.
- **The catalog gate** (`lib/sky-data.ts`, same discipline as the model
  loaders): a failed fetch or 404 resolves `null` and the desk stays plain
  dark, no stand-in sky ever drawn; a malformed catalog (bad version/epoch,
  too few stars, not 88 constellations) throws, because that's an export bug
  to see, not hide — `NightSky` catches it at the component boundary and logs
  it with `console.error` rather than swallowing it silently.
- **Reduced motion** paints one real frame at load from the actual current
  time and never advances; `SkyCredit`'s moving/still wording swap is pure CSS
  (`motion-reduce:` variants on two spans), not a JS branch, so a
  reduced-motion visitor's credit never implies a sky that, for them, never
  turns. (Neither credit variant states the 180x speed-up any more; the ISS
  card's `issClock` still does, and must match `SKY_SPEEDUP`.)
- **The credit line** (2026-09-16): the owner trimmed `credit`/`creditStill`
  to one sentence each, then trimmed `credit` again at merge time to drop its
  speed-up clause, both kept verbatim ("The sky over NASA Ames from the moment
  you arrived." / "The sky over NASA Ames at the moment you arrived."), followed by one honesty tail,
  `creditTail`: " The shapes are enlarged and coloured as long exposures show
  them, but every position is real." The old `creditColour` span and its
  `body[data-stargaze]` CSS gate are gone: colour shows on every page now, so
  the clause is true everywhere. The eyes-see-grey reason moved wholly onto
  each coloured card's `colourNote`, with its source. ⚠️ The trim once
  rendered "real one.." because the tail was written to continue the longer
  sentence; `assertCredit` in the verify suite compares the rendered credit to
  the composed copy in both motion variants and rejects "..", ".,", ",." and
  ",,". The credit body sits on the desk-toned backing described below, in
  BOTH modes.
- **Stargaze mode hides the page with CSS (`body[data-stargaze]`) plus
  `inert` on every `main`, and never unmounts anything** — a chess game, a
  half-drawn digit and the scroll position all survive the round trip
  (`lib/stargaze.ts`, a module-level store, not React context, since loaders
  outside any component tree need to report offloads into it too).
- **The ways in** (2026-09-16, answering "I have had to tell everyone about
  it"; autoplay, modals, pulsing and arrows stay ruled out):
  - **The star mark** (`StarMark.tsx`): an inline four-pointed SVG star,
    `aria-hidden`, `currentColor`, server-rendered, before the label on both
    doors. The toggle's accessible name is still exactly "stargaze for a bit?".
  - **The sky introduces itself once per session** (`night-sky/invite.ts`,
    `<p data-sky-invite>`, `copy.stargaze.invite`): the first time a
    hover-capable mouse or pen pointer moves onto the sky in PAPER mode, at
    the same instant and by the same "over the sky" test as the colour lift,
    so caption and colour read as one response. Placed in the clear region
    the pointer is in (max 240px wide, skipped under 96px), clear of the sheet,
    the toggle, the credit and the pointer; up for `INVITE_MS = 3500` with a
    300ms fade (none under reduced motion); hidden at once by a scroll that
    would bring the sheet under it or by entering stargaze, which also SPENDS
    it for the session by either door (final review m4: the visitor has
    already found what it points at);
    `pointer-events: none`. It needs the star catalog drawn first (a caption
    about a real chart of the sky over a plain desk would claim nothing), and an entry
    that can't show it doesn't spend it. Once per session through
    `sessionStorage` key `sky-invite-shown` (try/catch; if storage throws,
    once per page load). **`aria-hidden` on purpose**: the credit and the
    footer lead carry the same fact for every visitor, and a caption that
    appears on hover would be noise to a screen reader. Never under
    `(hover: none)`, so phones get the toggle and the footer door only.
  - **The footer door** (`StargazeFooterEntry.tsx`): after `<References />`
    inside the sheet on `/`, as the sheet's last child on `/lab`; the line
    `copy.stargaze.footerLead` then a button labelled with
    `copy.stargaze.enter` itself, because a second door to the same feature
    carrying a different name wouldn't read as the same feature. It lives
    inside `main`, so it's inert with the rest while stargazing. Exit returns
    focus to whichever door was used.
  - **`demo_used {demo: "stargaze", via}`**: `setStargazing(next, via =
    "toggle")` records the door (`getStargazeEntry()`), and `trackDemoOnce`
    sends `via: "toggle" | "footer"` for the FIRST entry of the load. Still one
    event per page load.
  - **The chrome's backing pills**: the hint, the exit control and the credit
    body each sit on a desk-toned `#0c0b09` pill at 0.85 with a feathered
    shadow (`data-stargaze-chrome`), so always-on names no longer print
    through the chrome's text (the Double Cluster's did). The bar container is
    `pointer-events: none` and the pills `auto`; the pointer controller treats
    `[data-stargaze-chrome]` like the card: no drag start, no click, no hover,
    no pointer cursor. Sky between pills stays live, and the feathered halo
    doesn't block (it fades to nothing, and names under it stay readable).
    Measured: backing alpha median 0.86 behind a pill, and backed credit
    contrast over the band at or above its pre-colour-round paper value
    (400px: 3.68-3.69:1 vs 3.49:1; 1440px: 3.71:1 vs 3.66:1), which the
    paper-mode backing fixed as well (unbacked, colour dropped it to ~3.0:1).
  - ⚠️ **The footer button shares the toggle's accessible name**, so a bare
    `page.getByRole("button", {name: "stargaze for a bit?"})` breaks
    Playwright's strict mode. Every check goes through `stargazeToggle(page)`
    (scoped to `[data-stargaze-toggle]`); a new check must too.
- **Cancelling a model run**: throw `StargazeAbort` from the panel's own
  `onFrame`, never return early — returning skips the vendored sampler's
  event-loop yield and locks the page (the draw demo's existing trap 3, now
  the load-bearing precedent for this too). Each panel releases its session
  only **after** the cancelled run's promise actually settles, never
  eagerly — releasing underneath an in-flight step is what would corrupt the
  shared ORT session.
- **Load generations**: each panel tags its own loads with a counter that
  stargaze bumps on unload, so a load that resolves after an unload (or after
  a newer load started) is discarded instead of installing a released session
  or a terminated worker into state. The loaders themselves (`lib/draw-
  model.ts`, `lib/headshot-model.ts`) additionally await any pending unload
  before building a new session, so two sessions never coexist even across
  a rapid exit/re-entry.
- **Restore rule** (the one the spec's original "nothing preloads on return"
  got wrong at plan time): on return, a model that was loaded or loading
  before stargazing reloads; one that never loaded stays unloaded. The
  headshot model is the deliberate exception: its next press loads it, same
  as the very first press always has, so no reload fires on return. A chess
  engine loaded only by the idle warm-up (never actually played against) is
  unloaded and **not** restored — nothing wanted it.
- **The honest memory limit**: the main-thread ORT wasm heap never actually
  shrinks after `release()` (only a full page reload does that); of the three
  offloaded models, only the chess worker's termination truly frees memory,
  since terminating a worker frees its whole heap. (This limit was long
  assumed to be behind the iPhone crash loop; it wasn't, see Known bugs. It
  still stands as a description of what stargaze can and can't free.)
- `window.__sky` (`drawn`, `simMs`, `lstDeg`, `k`, `cx`, `cy`, `offset`,
  `dragging`, `frameMsMedian`, `saturation`, `saturationTarget`, `highlight`,
  `label`, `labelText`, `suppressedName`, `hits`, `milkyWay`, `radiants`,
  `layers`, `card`, `cardOutOfView`, `iss`, `segmentsFor`, `nameUnderline`,
  `entryRings` (rings drawn this frame), `entryRingsFired`, `inviteShown`,
  `invite` (its box)), `window.__offload` (a per-kind offload counter) and the
  one WRITE hook, `window.__skySaturationOverride`, are verify hooks for
  `scripts/verify-redesign.mjs`, not UI. So are the `data-*` attributes the
  checks select on: `data-sheet`, `data-sky-credit`, `data-sky-credit-body`,
  `data-stargaze-toggle`, `data-ready`, `data-star-mark`,
  `data-stargaze-bar`, `data-stargaze-hint`, `data-stargaze-hint-text`,
  `data-stargaze-counts`, `data-stargaze-count-objects`,
  `data-stargaze-count-constellations`, `data-stargaze-browse`,
  `data-stargaze-exit`, `data-stargaze-chrome`, `data-sky-list-slot`,
  `data-sky-list-panel`, `data-sky-list`, `data-sky-list-item`,
  `data-sky-list-close`, `data-sky-invite`, `data-stargaze-footer`,
  `data-stargaze-footer-enter`, `data-lab-box`, `data-stamp`,
  `data-draw-classify-lead`. The CSS variable `--stargaze-hint-h` is real
  layout, not a hook: the panel and phone names both read it.

### Draw-a-digit (SDEdit, live MNIST diffusion) — page 1
- Division of labour: all model math lives in `lib/ascii-diffusion.js`, vendored
  from the model repo, pinned against a PyTorch reference (sampler max|Δ| 7.9e-6).
  The site owns canvas, pen, UI, copy. `lib/ascii-diffusion.d.ts` is hand-typed —
  re-check it when a new module version lands. `lib/draw-model.ts` owns loading.
- **Three API traps, all hit for real, all producing plausible garbage rather
  than errors:** (1) we draw white-on-black, `normalizeCanvas` assumes the
  opposite and `generate()` can't take `inkIsHigh` — so every run passes `x0Init`,
  and there is deliberately **exactly one `generate()` call site**; (2)
  `preprocess()` returns [0,1] but `toAscii()`/`x0Init` expect [-1,1] — they do
  not compose; `modelSpace()` does the remap; (3) bailing out of `onFrame` skips
  the module's event-loop yield and locks the page.
- Pen width is ~10% of canvas width on purpose: MNIST normalizes into a 20x20
  box, and a thin stroke vanishes in the ~14x downscale — garbage in, "broken
  diffusion" out.
- The zero-shot classifier is the diffusion model itself (10 conditioned
  reconstructions from identical noise, best fit wins): `CLASSIFY_STRENGTH` 0.85
  (measured plateau: 0.80→9/10, 0.85–0.95→10/10; low noise scores nothing),
  `guidance: 1`, `steps: 2` (module divides by steps-1). The guess is visible and
  overridable, never silent.
- **The demo leads with classifier-free classification** (owner request,
  2026-09-16): `copy.systems.draw.classifyLead` ("No classifier model: the
  diffusion model guesses the label itself.") renders permanently above the
  label picker (`[data-draw-classify-lead]`, `text-ink` so it reads as a
  standing claim, not one more dim caption), independent of every state, and
  the figure caption and the `classify.a` explainer both open with the same
  claim. The wording is "no classifier MODEL", not "no classifier": the demo
  does classify, and the claim is that no second model does it. Markup and
  copy only: the change touched no hook, handler, `classifyingRef`,
  `fitFreshRef`/`inkGenRef` or the `generate()` call site.
- **The classifier and generate share one ORT session; running both at once
  corrupts it.** The mutual exclusion runs through `classifyingRef` (synchronous,
  not state). Respect it in any rebuild of this panel.

### Headshot diffusion (the author photo) — page 1's masthead
- The bio's signature piece: the photo is a live sample, not a file. A
  deliberately-overfit class-conditional x0 model (1.31M params, cosine
  T=1000, DDIM-25) of three approved crops. Overfitting is also the safety
  property: it can only produce faces the owner approved, never a novel one.
- **Two models ship (v2 bundle, integrated 2026-09-12), one picked per
  device.** The **256 primary** (`headshot256.onnx`, 5.29 MB fp32, dynamic H/W
  axes, native training res) and the **128 fallback family**
  (`headshot128_int8.onnx` 1.55 MB, `headshot128.onnx` 5.29 MB fp32). They are
  independent: **never mix tensors between them**, and every `res` comes off
  the model's OWN meta. There is deliberately **no 256 int8** — the bundle
  quantized it, measured 34.8 / 30.5 / 32.5 dB PSNR against the fp32 samples,
  missed its own ≥35 dB gate on class 1 and discarded the artifact.
- **Budget policy** (`wantsPrimary()` in `lib/headshot-model.ts`): the 256 when
  `crossOriginIsolated` AND `hardwareConcurrency >= 4` AND not `saveData` AND
  not a known-bad `effectiveType` AND not (`deviceMemory` present and < 4);
  otherwise the 128 family, int8 first with fp32 fallback on session failure.
  **No viewport gate, deliberately** (owner call, 2026-09-13): phones render
  the photo at DPR 2-3, so the 256 matters most there, and this is a
  user-pressed 5.3 MB, not the warm window's background 24 MB — capability
  vetoes carry the decision, and **absent means unknown, not no** (only a
  present-and-bad value vetoes). The policy is a preference ORDER; **presence
  probes decide**: HEAD on both families first, and whichever is actually
  served wins, so a half-uploaded deploy gets the family it has rather than a
  gate. `build` is `"256" | "128 int8" | "128"` and the readout prints it —
  every fallback in the chain updates the label, so it can never lie.

- **Everything lives under `/headshot/v2/`.** `/headshot/:path*` is immutable
  for a year and the v2 bundle changed the weights, the metas AND the photo
  bytes, so the whole set moved rather than being overwritten. The v1 files are
  deleted; their URLs are dead by design. Nothing in the repo may spell a
  `/headshot/photos/...` or `/headshot/headshot*.onnx` path again.
- Pieces: `lib/headshot-diffusion.js` is **vendored verbatim** (all the math:
  schedule, DDIM step, timestep sequence, transition forward-noising, clamp);
  **one module drives both models**. Two hand-maintained siblings sit beside it
  and are updated at every re-vendor: `lib/headshot-diffusion.d.ts` (types) and
  `lib/headshot-module-info.ts` (`MODULE_SUPPORTS_TRANSITIONS`). That constant
  replaces the old `MODULE_VERSION` read — **the v2 module exports no version
  marker**, and option-sniffing is forbidden because v1 silently ignored unknown
  `generate()` options. Its truth is backed by a parity run, not by anything the
  module says about itself. `lib/headshot-model.ts` owns loading;
  `components/figures/HeadshotFigure.tsx` is the server gate and
  `components/figures/HeadshotToy.tsx` the client UI. Pinned by the bundle's own
  parity test against this repo's ORT, both models PASS: **max|Δ| 3.14e-5 (256)
  and 6.71e-6 (128)**.
- **`size` and `classWeights` are typed and never passed.** The bundle calls
  both exploratory — off the trained resolution or off the training simplex the
  output is not a face the owner approved, which is the whole safety property.
- **Three integrator rules, all silent failures if broken**: the site never
  passes `t` (module-internal, raw 0..999); `xt` frames are UNBOUNDED and get
  clamped for display; `x0` and the returned final sample are ALREADY clamped
  and must not be clamped again.
- **Nothing model-related is fetched at rest.** The masthead is first paint, so
  the box is a plain `<img>` until a face is pressed; the first press starts ORT
  + the weights (`loadHeadshotModel`, memoized, same `onnxruntime-web/wasm`
  specifier as draw/chess so the runtime is shared; `/webgpu` until 2026-09-16). Deliberately NOT in
  `lib/warm.ts`: the warm window is spent on the runtime the two big demos share.
- Within the 128 family, int8 first with an fp32 fallback if a runtime rejects
  the quantized graph. Same ruling as chess: losing the "int8" label costs
  nothing, a dead button costs everything.
- Gate reads `k` (and a default `res`) out of `headshot256_meta.json`, falling
  back to the 128 meta, and checks each class has a served photo, so a retrained
  export with four photos grows a fourth button with no code change. ⚠️ That
  `res` is SSR canvas attributes only: the real backing store is set inside
  `paint()` from the LOADED model's meta, because the family is a per-device
  choice made in the browser. CSS upscales with DEFAULT smoothing (the opposite
  of the draw demo's `pixelated` grids) — softness at 256px display is expected,
  less so now that the primary generates at 256.
- Every press is fresh noise, so the route differs and the photo doesn't:
  verified in-browser that two runs of one class are not byte-identical. All
  controls disable while a run is in flight (`runningRef`, synchronous).
- **Transition mode is LIVE (2026-09-12).** A cross-class press hands the
  previous COMPLETED run's final sample back as `init`; the module
  forward-noises it to `round(0.55·(T−1))` and descends into the new photo, so
  the run is ~14 of the 25 steps. Rules: capability comes from
  `MODULE_SUPPORTS_TRANSITIONS`, never from sniffing; first press, `resample`
  and same-class presses stay from-noise (the demo's thesis + resample's
  meaning); `init` only from a completed run (failures clear it), defensive
  `.slice()` both directions, length-checked against the LOADED meta's res (the
  two families differ, so this is what stops a 128 buffer reaching a 256 run);
  the morph decision is made AFTER the load for exactly that reason; `strength`
  is never passed (module default rules); readout and caption carry the morph
  wording, so no state overclaims.
  ⚠️ **The transition branch is still UNPINNED vendored math.** The bundle's
  `test_parity.mjs` pins only the classic from-noise path against PyTorch
  vectors (both models). Its three v2 additions are STRUCTURAL SMOKES with no
  expected output: `size:128` checks length + finiteness, `classWeights` checks
  the per-step call count + finiteness, and `init+strength` checks only that it
  ran a strict subset of the steps (14/25) and returned finite numbers. Nothing
  compares the forward-noising against a reference. Keep demanding a real
  init+strength vector in `vectors/`; until then the site's evidence is
  behavioural: the morph lands on the destination photo AND runs a strict
  subset of the steps, both asserted (browser + node, measured below).
- Measured on a production build, headless Firefox (~20x slower than a real
  browser; quote measured numbers only): the whole check, download + 25 steps +
  a 14-step morph, ~15s. Node wasm 4 threads: **~100-107 ms/step at 256** (25
  steps ≈ 2.6s), **29 ms/step at 128**. (The bundle README's 91.8 ms/step is the
  model repo's own measurement on its machine through `tools/time_wasm.mjs`;
  these are this repo's ORT on this machine, re-measured per run and a little
  slower. Neither is a browser number.) Per-photo PSNR from the bundle, DDIM-25 from
  fresh noise (the bundle's own numbers): **256 → 21.0 / 27.4 / 18.0 dB** (below target on classes 0 and 2;
  likeness sharp on all three, and the human gate accepted that photo 2's
  sampled face reads slightly leaner and lighter than the target); **128 → 29.3
  / 24.0 / 21.1 dB** (classes 1-2 soften on busy backgrounds, approved at the
  same gate).
- **The 256 + morph path has its own hand-run script:
  `node scripts/verify-headshot-256.mjs`** against the same prod build on :3000.
  It was written when the Playwright check's 400px viewport always landed on
  the 128; since the viewport gate was removed the browser check usually gets
  the 256 too, but this script still carries the MAD thresholds and runs the
  primary regardless of the machine's capabilities. It drives the
  site's vendored module against the SERVED bytes (fetched from the running
  server, not read off disk) and asserts: full step count from noise, the
  destination class winning decisively over both controls on both runs, and the
  morph running strictly fewer steps. **Re-run it whenever the bundle is
  re-vendored, `wantsPrimary()`'s policy changes, or `headshot-diffusion.js`
  moves.** Recorded 2026-09-12, four runs: from noise into class 2, always 25
  steps at ~100-104 ms/step; the morph into class 0 always **14 of 25 steps**;
  own-class mean abs 9.3-13.0 /255 (PSNR 19.7-22.4 dB) while the nearest wrong
  photo never came under 64. Fresh noise every run, so those numbers move — the
  script's own threshold comment carries the calibration.

### Chess (EBM + MCTS) — page 1
- Architecture: `lib/chess-engine.ts` is a thin worker client (no model);
  `lib/chess-worker.ts` owns the ORT session, encoder and search;
  `lib/chess-mcts.ts` is the search; `lib/chess-protocol.ts` is the wire.
  `components/ChessBoard.tsx` is the one renderer, shared by game and
  interpretability views.
- The model scores RESULTING positions and never outputs a move: enumerate legal
  moves, encode each child from the mover's perspective, one batched forward,
  argmin energy. `softmax(-energy)` is the move prior; `value` ∈ [-1,1].
- **The encoder (`lib/chess-encode.ts`) must match `training/encoding.py`
  exactly** — perspective is the side to move BEFORE the candidate move; black
  rank-mirrors via `sq ^ 56` (files never flip); en-passant plane only when a
  capture is actually legal. **Re-run validation vectors A–D after any touch.**
  Keep two handy: C) `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1` → argmin `a1a8`,
  prior ~0.168, value ~0.89; D) startpos top-3 priors `g2g3 .236, d2d4 .211,
  g1f3 .186` (yes, g3 first — trained on human games, not a bug).
- **Terminal detection follows python-chess `outcome(claim_draw=False)`**: the
  75-move rule, NOT chess.js's 50-move `isDraw()`. Repetition blindness is
  inherited on purpose (nodes hold a FEN, no history).
- **Draws are the site's job**: chess.js has the history, so the panel ends
  threefold/fifty-move/stalemate/insufficient-material games. Never call the
  engine on a finished position.
- Search economics, measured in-browser: ~6.6ms per board, flat from batch 8 to
  256 (leaf-batching buys nothing), threads change nothing, one sim ≈ 230ms.
  The UI is 1-ply (default) vs "let it think" (250 sims ≈ 60s in a worker).
  **Sims clamp to [250, 500]**: below ~250 the search returns the 1-ply move
  almost always (23/24 positions measured), and 500 is the only measured setting
  beyond it. Re-measure before widening. The MCTS port is verified move-for-move,
  visit-for-visit against `pi/mcts.py` on a deterministic fake evaluator.
- int8 (553KB) ships in the browser for download size; fp32 (1.8MB) is the
  fallback build. The Pi ships fp32 because it's faster on ARM. int8's win here
  is bytes, not speed.
- The interpretability view is precomputed (`public/chess_activations.json`),
  gated on the file, and reads `grid`/`layers` from it — never hardcode. Works
  for this model because the backbone never downsamples below 8x8; don't attempt
  it on the diffusion UNets.

### Trajectory viewer (pixel + ascii diffusion) — /lab
- Both files are real trained output. **The placeholder generator was deleted
  deliberately** (it wrote to the real export's path); never add one back.
- Read `vocab`, `mask_id`, `grid` from the file; guard `version`. **Check
  `mask_id` (-1) before indexing `vocab`** or the grid renders the literal text
  "undefined". Rows go in as text, never innerHTML (vocab contains `#%@`).
- The ascii grid is 28x14 — aspect handled model-side; never reshape to 28x28.
- Pixel mode interpolates between frames; ascii steps discretely (blending token
  indices is meaningless). The two models corrupt differently and the copy must
  keep saying so: Gaussian noise→denoise vs absorbing-state mask→commit (no noise
  anywhere in it; committed cells never change — verified 0 rewrites).
- `--steps`/`--schedule` style controls stay display-only: the file holds exactly
  one step count (verified). Only a new export changes that ruling.

### JEPA (MAE vs I-JEPA retrieval) — /lab
- **Gated on BOTH artifacts** (`manifest.json` + `sprites.webp`); either absent
  drops the whole section, anchor included. Absent → resolve `null` (gate);
  malformed → throw (an export bug that swallowing would hide). No placeholder
  mode, ever.
- Everything renders FROM the manifest: k from `neighbors[e][0].length` (loader
  throws if encoders disagree), all lengths asserted against `n`, metrics
  interpolated from `manifest.metrics` — a re-export updates the page with no
  code edit.
- Sprite atlas math: `background-position` percentages resolve against
  `(elementW - sheetW)`, so column c wants `c / (cols - 1)`, not `c / cols`.
- The honesty note is required: neighbours are cosine similarity in the FULL
  embedding space, not any reduction. The UMAP scatter tab was removed (a real
  12-point projection artifact + focus); if it returns, its own honesty note
  (independent fits, no point-to-point correspondence) returns with it, and the
  artifact gets fixed in the export first.
- The wrong-class marking is data-driven, never a left/right habit, and colour is
  never its only carrier (the `✕` prefix and aria-labels stay).

### Sample-space (DDPM vs flow matching) — /lab
- **Illustrative, labeled as such** — hand-built 2D animation, no weights, and
  the copy must keep saying so.
- Every shape and every flow path is deterministic (`hash01`, never
  `Math.random`): "same route every time" is the property on display. One click
  spawns the same start in both panels; that shared origin is the comparison.

### The research figures — real-data pipeline (`scripts/prepare-research.mjs`)
- Hand-run only: its inputs live in the gitignored `external_materials/` (the
  owner's asset mine — paper tarballs + metrics CSV + the `test_predictions/`
  re-export, the NASA video, the headshot originals), absent on Vercel. Its
  outputs in `public/research/` are committed. **Assert-before-write**: the
  aggregate is computed first and nothing is written if x0diffusion@16-labels
  drifts from the paper's 0.882 (±0.01).
- **The mask source is `test_predictions/`** (owner-dropped 2026-09-12 as
  `test_pred.zip`, which is BASE64-ENCODED zip text — `base64 -d` first): a
  re-run of the paper's seed-1/fold-1 runs, every model, every fraction, all
  100 test images, each run dir carrying `per_image_metrics.csv` whose
  `dice_recorded` equals the long CSV's rows exactly (the script asserts all
  100 on every load). The old 10-image `predictions_cache.tar.gz` is read only
  for the retired wipe's assets.
- **⚠️ THE LONG CSV'S `image_index` IS NOT THE IMAGE ID.** Two disjoint
  numbering spaces (0 of 100 coincide) that collide on 13 of 100 values; mask
  filenames, benchmark files and ground truths are ID space, the CSV is INDEX
  space, and `per_image_metrics.csv` is the bridge. A filename-to-CSV join
  cross-matched image 5 to index 5 and shipped someone else's number before
  the drift gate caught it. This same wrong join is also what produced the
  RETRACTED 2026-09-12 "the cache is a separate export" diagnosis: x0's and
  SAM's tight per-image spreads made the wrong join look like agreement, and
  ResNet's wide spread made it look like drift. Every CSV join goes through
  the bridge; the wipe's legacy ranking is the one knowing exception (commented
  in the script, retired figure, its caption numbers were always pixel-computed).
- **⚠️ `--accept-csv-drift` is still required, and now it means exactly one
  thing (root-caused 2026-09-13): SAM.** The export is a re-run, and SAM's
  inference is stochastic — the long CSV itself scores one image 0.196 under
  one seed and 0.475 under another — so its re-exported masks are fresh draws
  (measured |computed−recorded| up to 0.46 on hard images). The deterministic
  models reproduce their recorded rows from raw pixels: ResNet-UNet at Δ0.000
  on every panel, x0-diffusion within 0.02, which is the standing proof the
  decode, polarity and GT resize are right. Every number the site shows is
  computed from the exact mask on screen, never a CSV cell; `provenance.json`
  is the audit trail. Two export oddities, documented in the script: each
  `run_metadata.json`'s own `dice_mean` is garbage (its scorer read the wrong
  side; trust `dice_recorded`), and ε-diffusion's masks score far above its
  recorded ~0.23 (unexplained, never displayed).
- **Mask PNG polarity is PER-IMAGE, not a convention** (image 189's SAM mask
  was black-vessel-on-white, 330's is white-on-black; ViT's 16-label mask
  calls 67.7% of the frame vessel). The client (`components/figures/
  mask-paint.ts`) detects by minority side; the script votes per-model with an
  inset-ring rule and records the decision in `cdf.json`. Hardcoded polarity
  painted an entire background red once already.
- **Figure 1 (label-efficiency sweep, `LabelEfficiencyFigure.tsx`)** — replaced
  the wipe 2026-09-12, owner's call. Mean±std test Dice vs label budget,
  EVERYTHING read from `label_efficiency.json` (budgets, fractions, train
  size, means, stds); a regenerated export changes the figure with no code
  edit. **Six of the json's seven models are drawn: ε-diffusion is left off
  the chart AND the readouts (owner call, 2026-09-13)** — its flat ~0.23
  pinned the y axis to zero and squashed the working range, so the axis floor
  is 0.4 (clears every displayed mean and whisker; nothing drawn is clipped)
  and the caption discloses the omission with its number. It stays in the
  json, and the verify check asserts the hidden-model contract from both
  sides. Contracts: the x axis is LOG-spaced with inner padding
  (endpoint budgets on the axes hid the cursor and clipped the whiskers —
  screenshot-verified); one-σ whiskers render at the selected budget only and
  are DODGED horizontally (seven at one x smear into a line) and drawn FAINT
  (stroke-opacity 0.28, owner call 2026-09-13: at full strength they fought
  the lines; the exact ±σ lives in the readout row); the lead/trail
  sentence is COMPUTED per budget and flips at 32 labels (x0 leads only at 16 —
  that flip is the finding, never "fix" it); SAM's flat line is the data (the
  CSV replicates its zero-shot rows at every fraction, verified identical);
  x0/SAM/ResNet keep Figure 2's exact color+dash so the two figures read as one
  system; default stop = 16 labels, where the claim lives. **The strip**
  (2026-09-13): one real angiogram (image 333, picked by a transparent rule
  recorded in provenance — x0's worst budget ≥ 0.85 AND x0 ahead of SAM by
  ≥ `EFF_SAM_MARGIN` (0.03) at the smallest budget (owner call: the 16-label
  frame must show x0 winning; the first pick, 114, had SAM a hair ahead), then
  max ResNet gain lo→hi) with Figure 2's trio following the budget slider —
  x0 (green) 0.928 → 0.908, SAM (red) ONE zero-shot mask at 0.842 at every
  budget, ResNet-UNet (amber) 0.418 → 0.884 → 0.947, the crossover in
  pixels. The margin exists because SAM's panel is a stochastic re-draw that
  can score a few points off its recorded row (333: recorded 0.884, computed
  0.842), and a HARD, flag-proof gate asserts the COMPUTED x0 > SAM lead
  before anything is written. ⚠️ SAM's re-exported masks are
  byte-identical across the fractions, so the pipeline DEDUPES BY PIXEL
  CONTENT and every budget references one file: "same file" MEANS "same
  pixels", the client cache never repaints it, and the verify check asserts
  both directions (deduped panel must NOT change, per-budget panels must).
  Gated on the json's `strip` block; polarity comes RECORDED from the file;
  panel Dice is computed from the shipped bytes (ResNet's panels reproduce
  their CSV rows at Δ0.000); `--eff-image N` overrides the pick. The WIPE'S ASSETS (`angiogram.webp`,
  `mask_x0.png`, `mask_sam.png`) are still written by prepare-research and
  still committed, just unrendered — `WipeFigure.tsx` lives in git history if
  it ever returns, and `mask-paint.ts`'s border detector survives as a
  fallback only.
- **Figure 2 (Dice CDF, `DiceCdfFigure.tsx`)**: curves pooled from the CSV at
  **fraction 0.05 only** — pooling every fraction inverts the paper's model
  ordering, and the script's shape gate asserts shares-below-0.5 near
  0.3/5.4/13.5% (x0/SAM/ResNet) to match the paper's figure. Slider stops
  t=0.1..0.9 pick the image whose SAM dice is NEAREST t over all 100
  re-exported test images (SAM span 0.258–0.932 since the 2026-09-13
  re-source), so stops land close to the cursor, real failures included — but
  the cursor is still a threshold, and the copy keeps saying so. Panel Dice =
  computed from the shown pixels (SAM's are a fresh stochastic draw; see the
  drift bullet above).
- **Figure 3 (flight video, `FlightFigure.tsx`)**: the committed mp4 is
  untouched; the dark-map look is pure CSS — `invert(1) hue-rotate(33deg)
  saturate(2.1) brightness(1.05)` lands the blips on the warm token,
  `mix-blend-mode: screen` makes the inverted-black ground contribute nothing
  (the map melts into the panel, no border), and `clip-path: inset(2px)`
  shaves the source's not-quite-white edge row that survived inversion as a
  1px light border.

## Model artifacts

| path | size | what |
|---|---|---|
| `public/diffusion_traj.json` | 3.0 MB | pixel trajectories, 10 digits x 32 frames |
| `public/ascii_traj.json` | 586 KB | discrete/mask trajectories, same shape |
| `public/chess_activations.json` | 43 KB | precomputed saliency, 8 curated positions |
| `public/sky/sky.json` | ~57 KB | star catalog behind every page: 1,627 stars, 88 constellations, built by `scripts/prepare-sky.mjs` from a pinned d3-celestial commit |
| `public/sky/objects.json` | ~17 KB | 45 deep-sky picks (colour round, 2026-09-15, added 15: eight more Messier objects plus the Horsehead, the Flame, and the Double Cluster and the Veil as paired objects), Sgr A*, the Kepler field, the Hubble Deep Field, the 15 named stars, both Voyagers, the 12 meteor showers, the constellation origin table; built by `scripts/prepare-sky-objects.mjs` |
| `public/sky/milkyway.json` | ~30 KB | the Milky Way band, 5 nested levels, 2,267 vertices after simplification (budget 1,500-4,000); same generator |
| `content/sky-facts.ts` | 153 facts, 969 string literals (voice-scanned) | every card's and one-liner's facts and citations; single source, typed, no runtime imports |
| `public/jepa/manifest.json` | 483 KB | JEPA bundle: labels, UMAPs, neighbours, metrics |
| `public/jepa/sprites.webp` | 3.6 MB | 4096 thumbnails, 64x64 atlas |
| `public/models/mnist_x0.onnx` | 26 MB | the pixel model, live draw-a-digit |
| `public/models/chess-int8.onnx` | 553 KB | the chess EBM |
| `public/models/chess-fp32.onnx` | 1.8 MB | chess fallback |
| `public/headshot/v2/headshot256.onnx` | 5.29 MB | the 256 primary, fp32, dynamic H/W (no int8 exists) |
| `public/headshot/v2/headshot256_meta.json` | 204 B | res 256 — read, never hardcoded, never shared with the 128 |
| `public/headshot/v2/headshot128_int8.onnx` | 1.55 MB | the 128 fallback, what a phone loads |
| `public/headshot/v2/headshot128.onnx` | 5.29 MB | 128 fp32 fallback-of-the-fallback |
| `public/headshot/v2/headshot128_meta.json` | 204 B | res 128 |
| `public/headshot/v2/photos/{0,1,2}.webp` | 18/57/36 KB | the three approved crops, 512², q80, metadata stripped |
| `public/headshot/v2/photos/{0,1,2}_thumb.webp` | ~2 KB each | 96² derivatives for the 44px face buttons (first paint) |
| `public/research/*` | ~1.7 MB | prepare-research outputs: `label_efficiency.json` + `eff/` strip (Figure 1), `cdf/` stops + `cdf.json` (Figure 2), flight mp4 + poster, wipe assets (unrendered), `provenance.json` |
| `public/ort/*` | ~37 MB | onnxruntime-web wasm, vendored, **gitignored**, synced on prebuild |

The JEPA bundle is produced by
`export.py` in `~/Documents/embedding_jepa/` and copied verbatim; nothing in this
repo generates it. `public/headshot/v2/` is copied verbatim out of
`~/Documents/headshot_diffusion/dist/` (graphs and metas byte-for-byte, renamed
to the `headshot256*` / `headshot128*` scheme; the photos re-encoded from the new
`photos/{i}.png` with `ffmpeg -map_metadata -1 -c:v libwebp -quality 80`, 512²
plus 96² thumbs); the bundle's `vectors/` and `*_{128,256}.png` training inputs
stay out of `public/`. Git LFS: settled, not needed (~47 MB tracked binaries).

## Known bugs — open on the live site

Both of v1's draw-demo bugs were fixed on 2026-09-16 (branch
merged to `main` the same evening); they stay listed until `page_reload`
confirms the second in the field, and because the second's diagnosis was
wrong for two months.
1. **Mobile: drawing wiped when scrolling to hit generate. FIXED.**
   `DrawDigit`'s resize handler re-ran `setup()`, which resets the canvas
   buffer, and a phone's URL bar collapsing on scroll fires `resize` at the
   same width. The handler now compares the canvas width to the last
   `setup()` and returns when it is unchanged; a width change still resets
   the buffer (the backing store and pen width derive from it). Verified by
   `draw-ink-survives-height-resize-400`.
2. **Reloads and Safari's "a problem repeatedly occurred" on iPhone. FIXED,
   pending the owner's phone.** NOT memory pressure from the 26 MB model on
   the main thread, which is what this entry said until the fix: every ORT
   import used the `onnxruntime-web/webgpu` entry, which always fetches the
   asyncify wasm build, and JavaScriptCore's optimizing wasm tier runs away on
   it (ORT issue 26827) on every WebKit browser, including Chrome and Firefox
   on iOS and desktop Safari. Measured in WebKitGTK after one classify and one
   generate: ~395% CPU and 5.3→11.5 GB over a minute of idle; the plain build
   from the `/wasm` entry held ~800 MB. The main-thread architecture is
   unchanged and a draw worker is no longer on the table for this bug. Field
   readout: `page_reload` per page view, mobile vs desktop, before and after.

@AGENTS.md
