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
is deleted; v1 lives at the tag). **2026-10-01: the `slaac-demo` round
(the live SLAAC rerouter as Figure 3, the flight video to `/lab`, the
colophon, the secret stargaze door, the mag-6 coloured sky, the myth
artworks) fast-forwarded into `main` and deployed, after the owner's NASA
mentor and NASA legal approved its preview.** Page 1: masthead (title, abstract, the
live-sampled author photo, the paper-status stamp (IN PREPARATION; UNDER REVIEW until 2026-09-14), status only since
2026-09-16, with the bordered "Supplementary material" box beneath it as the
door to `/lab`, identity links) → Table 1 → Research
(Figure 1 label-efficiency sweep, Figure 2 Dice CDF, then the bordered NASA
box holding Figure 3, the live SLAAC rerouter, since 2026-10-01; Figure 3
was the flight-day video until then) →
the live demos as Figures 4–5 (chess, then draw — swapped 2026-09-13 at the owner's call, the `n` props swapped with them) → Experience as Figure 6 (Regenstrief's lamp green/active; NASA as two rows
since 2026-10-01, SLAAC complete and SHIFT active) → References → the footer's stargaze door → the colophon (`© 2026 Neelay Ranjan · email · Resume`, `Colophon.tsx`, the sheet's last child on `/` and `/lab`; its Resume link carries `data-track-label="Resume"`). `/lab` holds S1–S3: the trajectory viewer, JEPA, and since 2026-10-01 the flight-day video as Figure S3 (the sample-space S3 was cut 2026-09-29). Same-day post-launch
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
`scripts/prepare-sky.mjs` builds `public/sky/sky.json` (~134 KB, ~46 KB
gzipped, since Task 18 on 2026-10-01: 5,044 stars to magnitude 6, the
naked-eye limit under a dark sky; it was ~57 KB and 1,627 stars to magnitude 5
until then; 88 constellations with thin lines, English meanings transcribed
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

**Verification: `scripts/verify-redesign.mjs`** — 53 named checks (on `main`
since the 2026-10-01 merge of the `slaac-demo` round; 52 before Task 17, 2026-10-01, added
`stargaze-secret-door`; the count read 51 here though `colophon` made it 52;
50 before Task 12c, 2026-10-01, added
`slaac-all-flights`; 45 before the SLAAC round, 2026-09-30, added the five
`slaac-*` checks and renamed `flight-video-play-pause` to `lab-flight-video`
when the video moved to `/lab`; 46 until
the 2026-09-29 copy pass cut `draw-classify-lead-400` with the line it
checked; 45 before `resume-pdf`, 2026-09-22; 43 before the
2026-09-17 rounds added `chess-self-play` and `search-basics`; 30 before
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
the dev server (`VERIFY_BASE=http://localhost:3100` points it elsewhere: this
machine's Open WebUI container holds :3000); pass check-name substrings as args to run subsets. Covers the
night sky (turning at 1280px with a measured median frame draw around 2.54ms
against a 5.92ms budget, flat against the pre-colour-round 2.40-2.48ms
baseline; the discoverability round read 2.70-3.54ms across its tasks, and a
same-session stash rebuild of the pre-task tree read the same, so the machine
drifted, not the sky; Task 18's 5,044 stars and band gradient read
3.96-4.18ms against 2.82-2.92ms for a stash rebuild of the pre-task tree in
the same session; a headless
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
warmth must rise at paper and again in stargaze (the original thresholds, on
the original frame and, since Task 18, again on a second frame with the
galactic core up, `SKY_CORE_INSTANT`, where the colour stargaze ADDS must
also be golder within 300px of Sgr A* than beyond 700px: warmth gained per
unit of red, measured 0.963 vs 0.716, floor 0.12 more; a raw warmth-gain
comparison does NOT bite, since the core's levels are brighter, and an
all-tan mutant measured 0.715 vs 0.716 and fails), and a motion-on half records
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
`/` and ends the sheet on `/lab`; the colophon follows the door as the sheet's last child, each door queues exactly one `demo_used`
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
**`stargaze-secret-door`** (Task 17, pinned to `SKY_HOVER_INSTANT`: a
click on UMa's lines in the left margin enters stargaze `via: "sky"`, main
inert at once with the 600ms fade, UMa still lit; the caption's exact text
fades in centred below the bar, `pointer-events: none`, a polite status,
gone after ~6s with its text cleared; a click on an object symbol and an 80px
drag across the same lines do nothing; the toggle shows no caption; Escape
mid-caption removes it; one event per load; reduced motion: no fades; a
touch tap is the door too; proved to bite by letting any hit be the door and
by dropping `secret.show()`), **`colophon`** (present on `/` and `/lab` at 1280 and 400: `© 2026 Neelay Ranjan`, a mailto to the owner, `/resume.pdf`, last in the sheet, no horizontal scroll; proved to bite by dropping it from `/lab`),
**`resume-pdf`** (2026-09-22: every `[data-track-label="Resume"]` points at
`/resume.pdf`, nothing on the page links Drive, the file serves 200 as
`application/pdf` starting `%PDF-`, carries `X-Robots-Tag: noindex` and is
absent from the sitemap; proved to bite by pointing the masthead back at
Drive and by flipping the header to `all`),
**`search-basics`** (2026-09-17: one canonical per page on `lib/site.ts`'s
host, none on the 404; the icon links exactly the three stable `public/`
paths with no query string, each served with the type and pixel size its
link claims, the PNG 48px or larger, no `/icon.svg` or `/icon.png`;
robots.txt disallowing `/api/` and naming the sitemap; the sitemap listing
exactly `/` and `/lab`; proved to bite by deleting the sitemap, moving the
canonical into the layout, and reinstalling an `app/icon.svg`), **`lab-box-navigates`**, **`stamp-no-link-ancestor`** (proved by re-wrapping
the stamp in a Link), **`references-lab-link-resolves`**,
**`stargaze-card-image`** (an `<img>`
flush above Andromeda's card, CSS-sized before load, credited and cited;
none on Polaris; the card complete with the index held; the docked phone
card's photograph at most 28% of the viewport and the card at most 60%),
**`stargaze-myth-image`** (2026-10-01, task 19: Andromeda's card, opened
from the keyboard list, shows its artwork flush on top in the photographs'
318x238.5 box, credited "Image:" with the index's author, the artwork's name
plus "An artwork, not a photograph of the sky.", a Commons citation tagged
"[Image]" and the pick's `focus` as `object-position`; since task 20 the
SERVED index must cover all 88 constellations, and a constellation whose
card tells no myth (Camelopardalis when listed) shows its atlas plate the
same way, its artwork line naming the atlas (the myth set is read from
`MYTH_CONSTELLATIONS` in `test-sky-images.mjs`); Orion's docked 400px card
keeps the artwork at most 28% and the card at most 60%; proved to bite by
dropping `image: imageFor(h.id)` from the constellation branch of
`buildCard`, and (task 20) by deleting Cam's entry from the served index),
stargaze mode
(hiding the page with `inert` and firing no page-content fetch; offloading
the chess worker and the draw/headshot sessions; cancelling a run in flight
without ever showing it as a failure or counting `demo_used`; surviving
stargaze entered mid-download plus an immediate exit/re-entry), no horizontal
scroll at 400px on both pages, nothing model-sized before scroll, the
label-efficiency chart (static since 2026-09-30: no controls or strip, every
displayed series with one point per budget and ε-diffusion off it, x0 drawn
last at full strength with the baselines faded, x0's printed value and the
lead bracket's number equal to what the SERVED `label_efficiency.json`
gives at the smallest budget, and the shaded column on those points), the Dice-CDF slider (curves, readouts vs `cdf.json`, repaint on stop
change), **`lab-flight-video`** (the flight-day video plays in view and
pauses out of it on `/lab`, captioned Figure S3), the SLAAC rerouter's five
(2026-09-30, each proved to bite, headers in the suite):
**`slaac-nothing-at-rest`** (scrolling Figure 3 in fetches its six JSON files
and no model and starts no rerouter worker; a no-conflict press, a Nevada box
with the launch sites off, still loads nothing), **`slaac-reroute`**
(KJFK-KMIA past all six launch sites at a pinned clock; legs crossing
recomputed in node from every plan the page received, 0 for `ok` and
`untouched`, more than 0 for `cannot-clear`; then the stale-run rule at each
layer: three presses in one task run once, a run-999 reply is dropped by the
engine, back-to-back runs 1001/1002 sent straight to the worker stop 1001 at
its first yield; `demo_used{slaac}` once), **`slaac-launch-preset`**
(whole-US view at 1280: all six sites in view, labelled and airspace-red at
their centroids, all clear with the sites off), **`slaac-stargaze-cancel`**
(stargaze mid-run terminates the worker, `__offload.slaac` 1, idle with no
`done`, no error and no `demo_used`, no transient `done`/`unavailable` seen,
a new worker on return), **`slaac-400`** (no horizontal scroll at 400px with
touch; three taps and a tap on the first corner close a shape, two say it
needs three corners), **`slaac-all-flights`** (Task 12c, 2026-10-01: opens
on "all flights (373)", amber, its pre-press arc count equal to the suite's
own planner; a press reads "stop" with progress in unique arcs; done holds
every library flight, the worker's unique arcs equal the planned count, every
summary value equals `summarizeFlights` over the status, green iff no
cannot-clear; a map click picks a flight into the detail row, empty map
clears it; after a margin change, a stopped press returns to the stale
result with no done, no failed/unavailable state, no error and
`demo_used{slaac}` still one; ~260 s in Playwright's Firefox; every check
about one pair now selects KJFK-KMIA itself); a drawn stroke producing a real auto-label,
the chess hint matching vector D (`g3 p=0.236`), **`chess-self-play`** (pinned
clock, so the seed and the game are fixed: at least one departure, every one
a near-tie in the top three and within budget, the rule stated while it
applies, watching alone queuing one `demo_used{chess}`, the loop holding
still for 6s off-screen and with the tab hidden and resuming after, and a
human game of eight hint moves where every reply is the top move; proved
to bite four ways, one per contract), JEPA seed query 834 plus the
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
scripts/test-sky-iss.mjs scripts/test-sky-images.mjs
scripts/test-chess-selfplay.mjs scripts/test-resume.mjs
scripts/test-sky-secret.mjs scripts/test-sky-stars.mjs`** (`test-sky-secret`,
Task 17's door rule, 4 cases; `test-sky-stars`, Task 18's star paint and
star colour, 9) plus the rerouter's ten (`test-slaac-arcs` 16,
`test-slaac-data` 8, `test-slaac-dpm` 3, `test-slaac-geometry` 2,
`test-slaac-guidance` 4, `test-slaac-reroute` 37, `test-slaac-ring` 7,
`test-slaac-sampler` 5, `test-slaac-summary` 5, `test-slaac-view` 8;
`node --test scripts/test-*.mjs` runs them all, ~16 s) runs outside
Playwright, in plain node (202 cases total, 192 before Task 18, 188 before Task 17; 95 of them the rerouter's, which
the SLAAC section describes; 180 before Task 12c; 93 before those, 3 of them the served resume's and
10 the self-play rule's; 80 before those, 73 before the card
photographs, 62 before the discoverability round and 47 before the colour
round): `test-sky-data` pins the committed `sky.json`'s shape (star
count/order/ranges: 4,900-5,200 stars to mag 6.0 since Task 18, exactly two
with a null B-V, the old 5.0 cut an exact prefix; Polaris and Sirius by position and magnitude, all 88
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
conversion and the 7-day TLE-staleness gate; `test-sky-images` pins
`public/sky/images/index.json`'s shape against the pick list (every pick has
an entry and every entry a pick, every file on disk is indexed, the right
subjects per spec §2 coverage and no others, and since task 20 all 88
constellations with an image, each carrying an `artwork` name, every one
outside the 37 `MYTH_CONSTELLATIONS` an atlas plate by its artwork line,
and no `artwork` on anything but a constellation; proved to bite by
deleting Cam's entry), the generator's license
allow-list matching the runtime validator's, and the validator itself
accepting the committed index and rejecting malformed ones. `SKY_FACTS_PARTIAL=1` in front
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

**2026-09-17: chess self-play stopped being a recording, LIVE** (merged to
`main` the same day with the search round). Engine-vs-engine replayed one game forever; at one ply it
now takes a near-tied second or third choice up to twice a game, 9 distinct
games in 12 presses. Same round: watching counts as demo use, the loop
pauses off-screen and tab-hidden, a stale in-flight reply no longer lands on
a new game, and `chess-self-play` pins all of it. Contract under "Chess" below.

**2026-09-16 (night): card photographs, branch `sky-card-images`.** Every
galaxy, nebula, cluster, remnant, the Hubble Deep Field, Sgr A*, the Milky
Way, the five planets, the Moon and the ISS card opens with a real photograph
flush above it, the card's full width (owner's layout call). 35 images, most
Wikipedia's own lead image for the subject; the two Veil halves have no
single Wikipedia lead (both come from NOIRLab), and two more were swapped
away from their Wikipedia lead for cause (final-review fix #9, 2026-09-17):
m27 to a different NOIRLab frame free of a watermark, Saturn to a
square-cropped Cassini derivative. All sourced through the Wikimedia Commons
API so author, license and the original's sha1 are machine-read, never
typed: `scripts/sky-image-picks.json`
names the file, `scripts/prepare-sky-images.mjs` (hand-run) refuses any
license outside its allow-list and writes `public/sky/images/index.json` plus
640px WebPs (~1.7 MB total, fetched only when a card opens). Self-hosted
because COEP forbids hotlinking anyway. The card prints the credit and adds
a Commons citation; the box is CSS-sized (318x238.5 desktop, measuring the
aside's 320px border-box less its 1px border against the 4:3 aspect; 2:1
capped at 28dvh on phones, body cap 32dvh so the docked card stays under 60%)
so the cached card height never goes stale. Stars, showers, the Voyagers
and the Kepler field get none, on purpose. Every constellation has one
since 2026-10-01: an artwork of its myth where its card tells one (37),
else its figure from a historical star atlas (51; see "Card photographs"
below).

**2026-09-17: what search engines read, LIVE** (merged to `main` with the
chess round). The owner
saw search results still showing the old logo and old text. Production was
serving the new icons and current copy; Google had a stale crawl. Four
things on our side slowed or muddied the refresh, each fixed: **one host**
(owner's call: `neelayranjan.dev` is the main address; `lib/site.ts` holds
it for metadataBase, og:url, the canonicals, robots and the sitemap), **a
canonical per page** (`/` and `/lab` each name themselves; the 404 names
nothing), **robots.txt and a sitemap** (`app/robots.ts`, `app/sitemap.ts`,
both prerendered), and **stable icon URLs** (see the Stack bullet and the
trap below). **Both owner actions are DONE (2026-09-17)**: Vercel's Domains
now make the apex primary (verified: `www` 308s to `neelayranjan.dev`; it
redirected the other way until this round), and Google Search Console has a
property for `neelayranjan.dev` with the sitemap submitted. Search Console
first showed the sitemap as "Couldn't fetch"; its URL Inspection live test
said the URL is available to Google, i.e. the status meant PENDING, a known
Search Console quirk for a fresh sitemap, not a failure. If the favicon or
snippet in results is still stale after a couple of weeks, Request indexing
on the homepage is the lever, not code.

**2026-09-29: the owner's copy pass** (content/copy.ts, sky-facts.ts, the
chess activations' hanging-knight line). Tightened nearly every caption and
note, and cut the claims the page can't back ("nothing here is a
recording": the chess internals are precomputed). The ε-diffusion result
moved out of the Figure 1 caption into the Research prose. Cut: the SCOPE
and CREDIT margin notes, the draw demo's permanent classifier-free lead
line, /lab's three lead-in paragraphs, and Figure S3 (sample-space) with its
teaser entry. The DATA note now links the angiogram benchmark (Dr-SAM,
Zohranyan et al., CVPRW 2024, github.com/vazgenzohranyan/Dr.SAM, the source
of `external_materials/paper1/data/benchmarkDataset/`). Visitor copy is
American spelling, and ranges use hyphens (1900-2200, 98-99%), both site-wide.
Experience's antenna row says "led the PCB design team", the resume's words.

**2026-09-30: the no-self-vouching pass** (owner-approved). Feedback the
owner got: the site "is begging to be viewed as authentic with all the text
saying that it is". The rule it settled: **keep every limitation, cut every
assurance.** Stated limits (a few hundred Elo below the full engine, SAM's
re-drawn masks scoring off their recorded runs, ε at 0.23) are what read as
real; repeated claims of realness read as insecure. So "in your browser" is
said twice on page 1 (the headshot caption and the Live systems intro), not
nine times; the headshot's state-swapping lead is gone (one caption, true
before and after a press, because it describes the press); Figure 3 no longer
vouches that its paths are generated; the four page-1 figure captions are
paper length (the Research prose carries the argument); the chess hint note
is cut; the sky invite, credit tail and not-to-scale note dropped "real" and
"accurate". Don't add assurance lines back; if a claim needs defending, show
the measurement instead.
Same day, the Research section's reference detail moved to the margin rail
(owner: "cut down on any bloat text that doesn't need to be in the main
bar"): the paper's full title (PAPER), the one-surgeon disclosure (STUDY),
"label efficiency, not peak accuracy" (SCOPE, under DATA beside Figure 1),
the MWSCAS citation (REFERENCE) and the SLAAC poster's numbers (SLAAC), all
in `copy.research.notes` / `mwscas.citeTag`. The main column keeps the
claims; the rail keeps the provenance. The research row's rail is pushed
down 60px at desktop so PAPER starts level with the h2, not above it.
Also 2026-09-30: **the NASA work sits in its own bordered box**
(`[data-nasa-box]`, a `section` labelled by its `h3#nasa`, "NASA Ames"),
holding the NASA paragraph with its SLAAC note and Figure 3, so it reads as
separate from the paper. The owner plans to grow it into a fuller section;
the box is that seam. It has no background of its own, on purpose: Figure
3's video used `mix-blend-mode: screen` against its own panel. (Since the
2026-10-01 merge the box is headed "NASA Ames Research Center" and holds the
SLAAC and SHIFT paragraphs and Figure 3, the live rerouter; the video, and
its blend, went to `/lab` as Figure S3.)
And the chess lede was halved (owner: "cut it down to around half the
size, if not less"): two short paragraphs of claims, with the training data
and the int8/fp32 finding moved to a side column of notes inside the
figure (`copy.systems.chess.ledeNotes`, the same `Note` and 880px split as
the Research rows). The limit, "here it runs without search, a few hundred
Elo weaker", stays in the main column.

**2026-09-30/10-01: the SLAAC rerouter, LIVE since 2026-10-01** (built on
branch `slaac-demo` in worktree `../portfolio-slaac`, a 16-task SDD build from
`1e9b4f8` plus Tasks 17-19: the secret stargaze door, the denser sky
below, the myth artworks; it was held as a preview-only branch until
the owner's NASA mentor and NASA legal approved the preview, then
fast-forwarded into `main` and deployed the same day, 2026-10-01). NASA
cleared the Summer 2026 codebase for sharing (owner, 2026-09-30), so
**Figure 3 became the live rerouter**: pick
one of 48 hub pairs, its flight-plan-LM routes draw, draw an airspace or turn
on all six US launch sites, and the owner's 5.78M-param diffusion model
reroutes every flight in a worker and snaps each arc to named fixes, with
added nm, minimum clearance and legs crossing per flight. The port is pinned
against the owner's Python by vectors, the routes are precomputed (the LM is
222M params), and a Python gate over 2,240 runs chose 20 steps and snapped
plans with both lookahead policies. **The flight-day video moved to `/lab` as
Figure S3**, unchanged (the slot the cut sample-space figure left). The NASA
box went SLAAC-first with a SHIFT paragraph and DATA/DIFFERENCES notes under
Figure 3; Experience became two NASA rows (SLAAC complete, SHIFT active) per
the new resume. Measured on this laptop (Task 15): ~2.8 s from a first press
to done for KJFK-KMIA past the launch sites in stock Firefox, ~6 s for the
heaviest library case; the batch cap went 16 → 4 on that measurement.
**The NASA box's written copy carries no numerals since 2026-10-01** (owner:
"remove the numbers, and just keep the high-level"; heading "NASA Ames
Research Center", SLAAC as "space launch and air/airspace coordination", no
mentor or colleague names): the poster note is the poster's result in words,
and the DIFFERENCES note says only that a reroute "takes seconds on my
laptop, longer with more airspace or every flight at once" and nothing about
phones. The numbers behind each phrase are in content/copy.ts's comments.
Contracts, rulings and numbers: "SLAAC rerouter (Figure 3)" under the demos.

**2026-10-01, Task 18 (built on `slaac-demo`, LIVE with it the same day): a
denser, more colourful sky, every addition real.** Owner: "more randomly added stars around so that it's
decently dense, but the constellations still pop out", then colour and pop
for stargazing. Ruling R23 made it REAL stars, never random ones: the same
pinned stars.6.json to mag 6.0 (5,044 stars against 1,627), the fainter
ones drawn smaller and dimmer than the old faintest so the lines and bright
stars still lead. Ruling R24: stars take their colour from their own B-V
(Ballesteros 2012 to a temperature, Mitchell Charity's blackbody table to a
colour) and the Milky Way grew a gradient, gold toward the galactic core
(cited on its card) easing into the colour round's tan; both ride
the existing saturation (paper share on the page, full over the sky and in
stargaze, the grey chart at 0 byte-identical). Review fix round 1 (ruling
R26) put every star colour ON the blackbody table (a hotter or cooler
blackbody, never a bluer-than-any-blackbody push) and dropped a faintly blue
disc stop whose only source was an outside-view education page. Frame draw 3.96-4.18 ms
against 2.82-2.92 ms for the pre-task tree measured in the same session
(A/B), budget 5.92. Contracts under "Night sky + stargaze": "A denser sky,
star colour, and the band's gradient".

**Open items, roughly in order:**

The SLAAC round's own, ahead of the list (LIVE on `main` since 2026-10-01):
- a. ~~Mentor approval of the preview is the merge gate.~~ **DONE
  2026-10-01**: the owner's NASA mentor and NASA legal approved the preview,
  and the branch was fast-forwarded into `main` and deployed.
- b. **Chrome proper and the owner's iPhone, timed on production.** The
  laptop numbers are in the SLAAC section; no phone has run the rerouter.
  The phone batch cap (4) is unmeasured on a phone: if the iPhone stalls
  between progress updates, 2 is the lever, and on this laptop it costs
  nothing in total time. A WebKitGTK run showed no JavaScriptCore runaway.
- c. **The route LM, live**: distil it to a browser-sized student, or export
  it with a KV cache; the likely shape is a desktop-only "write a new route"
  button. Until then its routes are precomputed data.
- d. **The owner's pipeline rewrite** (it was built in 7 weeks and the owner
  wants to redo parts). Any change to `plan_cli.py`, `sua_guidance.py` or the
  checkpoint means re-running `make_vectors.py`, the ten `test-slaac-*`
  files and the gate, in that order, and re-exporting the ONNX under a new
  hashed name.
- e. **The FRD doubling-back bug, upstream** (R13): fix
  `gen_trx_sua.py`'s `geocode_items` LM-token path in the owner's own repo;
  this site only works around it in `route_library.py`.
- f. **Both owner questions answered (2026-10-01)**: the `/lab` video came
  from `route_lm_best.pt`, so S3's lede says Figure 3's routes come from
  that model; and no names in the NASA box ("no name dropping").
- g. **The FAA chart cycle in `launch-sua.json` expires 2026-10-29**: re-pull
  per the SLAAC section.

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
   review m1: the chart runs 180x, so "the real sky" read as live; trimmed
   to "the sky over NASA Ames" on 2026-09-30), the footer
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
- **Positioning (owner, 2026-09-29): a diffusion and energy-based modeling
  researcher with a focus, "not just a stereotypical AI dev".** Where copy
  explains a choice (why an EBM, why two diffusion variants), tie it back to
  that research focus. /lab may stay loose; page 1 carries the polish.
- **The site and the owner's SOP tell one story.** Admissions readers will see
  both. The site must never contradict the SOP's numbers, claims, or framing; when
  a fact below and older repo content disagree, this file wins.

## Settled redesign decisions — don't relitigate

- **Multi-page, but page 1 delivers ~95% of the experience.** Other pages are
  overflow for the genuinely curious.
- Page-1 demos: **draw-a-digit and chess**. The trajectory viewer, JEPA and
  sample-space move to **`/lab`** (one page for all of them). Sample-space
  (S3) was then CUT on 2026-09-29 (owner's copy pass): it was the site's one
  hand-built illustration, and it returns only as a real trained 2D model.
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
  diffusion toy · research → the label-efficiency chart (static since 2026-09-30) and the Dice-CDF pan ·
  experience → the live SLAAC rerouter, Figure 3 in the NASA box (since
  2026-10-01; the flight-day video held that slot until then and is now
  Figure S3 on `/lab`) · publications → figure hovers. The owner's
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
  `copy.masthead.supplementContents` ("diffusion trajectories · MAE vs I-JEPA";
  "· DDPM vs flow matching" left with S3, 2026-09-29). The teaser is written, not composed from /lab's
  section headings: those read wrong out of context ("Predicting pixels, or
  predicting representations") and ran four items long in a narrow rail.
  ⚠️ The cost is drift: if /lab's sections change, change this line by hand.
  The box borrows the figure frames' `border-rule` → `border-mut` line style
  on hover and focus, never a rounded button. References already ended with a
  "Supplementary material" → `/lab` entry, so no second link was added there.
  `public/og.png` was regenerated for the new rail.
- v1's draw-demo bugs survived the re-chrome where the code path survived
  (see Known bugs) — they are open on the live site.
- Navigation listings (menus, the 404's directory joke if it survives, and
  since 2026-09-17 `app/sitemap.ts`) track the real set of pages — v1 kept its 404 `ls` in step with its sections; keep that
  discipline whatever shape it takes.

## Content facts — the source of truth for copy

(`content/resume-notes.md` was stale and was deleted with v1.) The facts below
are the source of truth; for anything else, read the resume and ask the owner.
Any fact on the resume is cleared for publication, with two exceptions below.

**⚠️ The resume moved to a private GitHub repo (owner, 2026-09-22): read it
there, not from Drive.** `NeelayRanjan/SAVE` (private, default branch
`master`), directory `Resume/`: `NeelayRanjan_Resume_Public.{tex,pdf}` (the
designed one, altacv) and `NeelayRanjan_Resume_ATS.{tex,pdf}` (plain, for
application forms). The `.tex` files are the ones to read, being plain text.
The machine's `gh` is authenticated with `repo` scope, so:
`gh api repos/NeelayRanjan/SAVE/contents/Resume/NeelayRanjan_Resume_ATS.tex -q .content | base64 -d`.
**Never publish two things that repo holds**: the owner's phone number, which
both resumes carry and no page here ever shows, and anything outside
`Resume/` (it also stores `Unofficial Transcript.pdf` and NASA material).
⚠️ One override (owner ruling, 2026-09-30): the NASA SLAAC items listed as
publishable in "SLAAC rerouter (Figure 3)" under the demos may ship;
everything else outside `Resume/` still never does.
The Drive URLs below still work and are what the site links today, but the
owner now updates GitHub, so treat Drive as possibly stale.

**Drift, 2026-09-22: the owner fixed the resume the same day and most of it
is gone.** The resume now reads 88.2% Dice at 16 labels, the 75%
correction-time speedup, Regenstrief from Feb 2024, and both first-author
manuscripts by name, all matching this file. **The NASA gap is RESOLVED
(2026-09-30)**: the resume now lists NASA as two roles, SLAAC and SHIFT, and
the site's copy follows it since the 2026-10-01 merge (see the NASA bullet
below). **One
gap is still open and is the owner's call**: the resume lists TWO first-author manuscripts in preparation (the second,
"Modular SAM-prior diffusion refinement for real-world angiogram and
seven-shot moyamoya MRA vessel segmentation"), while the site names one.
Davinci Wearables is on the site and not on the resume, which is a superset,
not a contradiction. The original drift list, for the record:
  - **NASA is one role on the resume, not the two-engagement arc**:
    "Generative Modeling Research Intern, Generative Trajectory Modeling",
    May 2026 to present, building weather- and hazard-aware aircraft routing
    with diffusion on FAA radar-track (TRX) data, a mid-sampling
    gradient-guidance step that reroutes around hazards with no retraining,
    integrated into ATM simulation software used by NASA and the FAA. The
    flight-plan LLM (~44,000 flights) is one bullet under it. SLAAC, the
    synthetic ATC-speech pipeline, Sheth and Clarke appear nowhere.
  - **The paper is now three**: "three first-author manuscripts in
    preparation" (benchmark angiograms surpassing SAM, real-world SAM-x0
    refinement, seven-shot moyamoya MRA), where this file and the site say
    one.
  - **The headline numbers differ**: the resume leads with "80% Dice vs
    SAM's 73% with just 18 labeled images", plus 70% Dice at 22 labels for
    the SAM-x0 refinement and ~55% vs ~20% on 7-image moyamoya. This file
    pins 0.882 at 16 labels and a ~75% correction-time speedup, and bans
    "80% Dice at 19 images" as a superseded v1 number; the new one is that
    same shape. Which is current is the owner's call.
  - Regenstrief reads "Jul 2024 to present, Applied Vision-AI Researcher"
    (this file says Feb 2024); Davinci Wearables is absent from both
    resumes while the site's Experience still lists it; neither resume
    mentions the leave the site shows as a "gap semester" row; and the
    resume still says the Pi runs ~1 s/move, which the owner already ruled
    the site states its own way.

- **First-author paper**: "Bootstrapping surgeon labeling campaigns with
  x0-diffusion: label-efficient vessel segmentation of catheter-based angiograms"
  (Ranjan, Dev, Gonzalez). **IN PREPARATION** (owner correction, 2026-09-14:
  the site said "under review at JAMIA" from launch until then, and that was
  wrong). Say "in preparation" and name no journal; never "under review" or
  "published" until the owner says the status changed. arXiv preprint from
  ~2026-09-18 (owner: still on track). The numbers: **Dice 0.882 at 16
  labels, beating all five baselines in all 25 paired runs; ~75% measured surgeon
  correction-time speedup, measured with ONE vascular surgeon, the paper's
  coauthor Dr. Andrew Gonzalez (owner, 2026-09-29; the site says so, case
  count not given); the claim is label efficiency, not peak accuracy.**
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
- **NASA Ames is two roles** (per the resume since 2026-09-30; NASA Ames,
  Aeronautics Directorate, Code AF, May 2026 to present; the NASA box and Experience rows follow it since the
  2026-10-01 merge, before which the site showed the older two-engagement
  arc):
  **GenAI Applied Research Intern, SLAAC, May-Aug 2026** (space launch and
  air/airspace coordination, the owner's wording since 2026-10-01; mentors on
  the poster Dr. Kapil Sheth and Prachi Panda, never named in visitor copy):
  hazard-aware rerouting with diffusion models learned from FAA radar
  tracks, guidance applied mid-sampling, no retraining, "99% of reroutes clear
  the 25 nm hazard buffer at a median +10 nm (1.1%) added distance, within
  1.2% of the geometric optimum"; and the flight-plan LLM, ~44,000 flights a
  day for the simulation software NASA and the FAA use to evaluate future ATM
  strategies. **GenAI Applied Research Intern, SHIFT, Aug 2026 to present**
  (Stephen Clarke): Qwen3-Omni-30B fine-tuned with QLoRA for ATC
  speech-to-text, 17% WER vs 20% for the Whisper ASR in use (30% zero-shot,
  5-fold CV, ~1.5 h of real audio); Kev, a typed decision model parsing
  transcripts into the DTI maneuver ontology, value-match 40% → 80%; a
  text-to-speech synthetic ATC corpus ~20x the real data. ⚠️ **No names in
  visitor copy** (owner, 2026-10-01: "no name dropping"): Sheth, Panda and
  Clarke are context here only. **The NASA box's text carries no numerals**
  (owner, 2026-10-01), so these numbers live in this file and copy.ts
  comments, not on the page. **The Summer
  2027 lunar digital twin is DROPPED** (owner, 2026-09-14: no longer
  pursuing it); never mention it again.
- **The flight-day transformer (Figure S3 on `/lab` since 2026-10-01;
  page 1's Figure 3 before that) is the owner's own work**, trained
  from scratch (owner, 2026-09-14), and **part of SLAAC** (owner,
  2026-09-29). What broke: the waypoint system, where a continuous route that
  obeyed every rule often stopped obeying once snapped onto the waypoint map;
  most of the owner's time went there. The SLAAC poster's "98-99% clear the
  25 nm buffer" is 98-99% **of reroutes**. Resume wording: a custom LLM with a novel
  token vocabulary that "speaks" filed flight plans, synthesizing ~44,000
  flights matched to historical density, for capacity and safety studies of US
  airspace failure modes; the owner adds it is being used at NASA to justify
  real changes and projects. Too slow to run live in the browser (222M
  params, 890 MB fp32); the rerouter's routes are its precomputed output.
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
  - Resume: **`/resume.pdf`, served by this site** (owner call, 2026-09-22).
    `scripts/pull-resume.mjs` copies the designed PDF out of the private
    `NeelayRanjan/SAVE` repo into `public/`; the Drive URL below is retired as
    the public copy and nothing on the site links Drive any more. Re-run the
    script whenever the owner updates the resume, or the site keeps serving
    the old one. The ATS variant can be pulled with `--ats` to
    `/resume-ats.pdf`; it is deliberately NOT linked (one Resume link, and the
    designed one is what a human should open).
  - Retired Drive resume (kept only as history): https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview
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
  completed digit generation, an accepted chess move, or a self-play move
  landing, since watching the engine play itself is real output) so failures and
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
- `scripts/pull-resume.mjs` (2026-09-22, hand-run, needs `gh` with `repo`
  scope) copies the resume PDF out of the private `NeelayRanjan/SAVE` repo to
  `public/resume.pdf` and records repo, path, blob sha, sha256, size and date
  in `scripts/resume-source.json` (committed, never served, since it names a
  private repo). `scripts/test-resume.mjs` re-hashes the committed PDF against
  that record, so a stale or hand-edited file fails rather than shipping. ⚠️ It
  pulls exactly one named file: that repo also holds the owner's transcript
  and NASA material, which must never be served here. ⚠️ Both resumes print
  the owner's phone number, so hosting the PDF publishes it;
  `next.config.ts` sends `X-Robots-Tag: noindex` for `/resume.pdf` and
  `/resume-ats.pdf` so the file isn't indexed (the site's own page should rank
  for the name), which is about indexing, not privacy.
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
  or `/og.png` never resolves in unfurls. **The icons live in `public/` and
  are declared in `layout.tsx`'s `icons` (2026-09-17)**, not through the
  `app/` icon file conventions: `public/favicon.ico` (the tuned 16 and 32),
  `public/icon-192.png` (the mark rendered from its SVG, because Google
  ignores SVG favicons and recommends 48px or more) and
  `public/apple-icon.png`. The SVG is no longer served; its vector master is
  `scripts/icon-mark.svg`. `icon-192.png` was rendered from that SVG through
  a Firefox canvas (this machine has no cairosvg); `gen-icons.py` now emits
  the same size for its next run.
- The chess worker must stay a literal
  `new Worker(new URL("./chess-worker.ts", import.meta.url), { type: "module" })`
  or the bundler loses the dependency. **onnxruntime-web is imported in the worker
  and nowhere else** — importing it from a component puts 24MB back in the page
  bundle.
- Loading discipline (v1 behavior worth keeping in any design): nothing heavy in
  flight at first paint; each demo's payload loads when its section is reached;
  the 26MB draw model loads on first interaction (and the
  rerouter's 23.4MB model on the first reroute press that has an arc to
  sample, never in the warm window); ORT+chess (24.4MB) may warm on
  desktop idle, gated by `saveData` / bad `effectiveType` / `deviceMemory < 4` /
  `(max-width: 767px)`, where **absent means unknown, not no** (the connection
  APIs are Chrome-only). All loaders are memoized promises so warm and section
  calls share one download.

## Hard-won traps — measured; they will bite again

- **An `app/` file-convention icon's URL changes on every Vercel deploy**
  (2026-09-17). Next appends a content hash (`/favicon.ico?favicon.<hash>.ico`)
  and, when `NEXT_DEPLOYMENT_ID` is set, as it is on Vercel, `&dpl=<deployment
  id>` to every metadata-image link, and Google's favicon guidance asks for a
  stable URL. Reproduce locally with `NEXT_DEPLOYMENT_ID=dpl_x npm run build`.
  Icons declared as plain `public/` paths in `metadata.icons` carry no query
  string at all, measured under the same build. Two side effects, both
  measured: declaring `icons` in config dropped the file-based `apple-icon`
  link (so the whole set moved to config), and a stray `app/icon.svg` beside
  the config does not change the links but IS still served, which
  `search-basics` catches.
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
  browser; quote only measured numbers. **⚠️ It isn't the headlessness, it's
  Playwright's Firefox build** (measured 2026-09-30, Task 15 of the SLAAC
  round): HEADED Playwright Firefox ran the rerouter's forwards ~7x slower
  than the stock system Firefox 152 on the same laptop, the same build and
  the same press (686 vs 100 ms per forward at 6 CFG samples, 447 vs 65 at 4,
  1655 vs 248 at 16; 13.9 s vs 2.15 s of worker time), and headless read the
  same as headed (14.2 s). Playwright can't drive stock Firefox (it needs its
  Juggler-patched build), but WebDriver BiDi can, with no dependency: launch
  `/usr/bin/firefox --new-instance --no-remote --profile <fresh dir>
  --remote-debugging-port=<port>`, read "WebDriver BiDi listening on ws://..."
  from its output, and drive it with `session.new`,
  `browsingContext.navigate`, `script.evaluate`, `input.performActions` over
  node's global `WebSocket`. That is the desktop Firefox number to quote. The
  machine also holds a Playwright Chromium (`~/.cache/ms-playwright/
  chromium-1243`, from a newer Playwright than the repo's 1.61.1, launched
  through `executablePath`), which ran 14% behind stock Firefox on KJFK-KMIA (3.15 vs 2.77 s) and 35%
  behind on the 8-arc case at cap 16 (7.76 vs 5.75 s; 7% at cap 4); Playwright's
  WebKit can't launch here (missing system libraries), so a WebKit number
  comes from WebKitGTK through python gi.
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
  **⚠️ This check fails on a loaded machine, and the failure says nothing
  about the sky** (2026-09-22): with an unrelated python job holding half a
  core and load average above 3, it read 8.00ms, then 9.56-9.72ms over three
  reruns. The A/B that settles it in one build: check out the commit BEFORE
  the round, rebuild, run the same check under the same load. That read
  9.72-12.18ms, worse than the tree under suspicion, so the machine was the
  variable. Do that before touching a draw path; the same shape of answer
  applies to any timing check here.
- **A sub-pixel dot smears its light across four pixels** (Task 18). The
  first faint-star pass drew 3,400 new stars at their exact sub-pixel points
  and the lit-pixel count of a 1440px screenshot moved under 2%: each dot's
  light was split four ways below visibility. Snapping each square inside
  one pixel (`Math.floor(x) + inset`) made them read as pinpricks at LESS
  total light than the old faintest star. Count lit pixels before and after
  before judging a dim layer by eye.
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
- **A denser sky, star colour, and the band's gradient** (Task 18,
  2026-10-01, controller rulings R23 and R24; the trace proof and the
  screenshots are in the gitignored `.superpowers/sdd/2026-09-30-slaac-rerouter/`,
  `task-18-*`):
  - **Real stars only.** `prepare-sky.mjs`'s `MAG_LIMIT` went 5.0 → 6.0 on
    the same pinned commit: every star stars.6.json has, 5,044. Nothing is
    random or invented. Sorting is by the stored (0.1-rounded) magnitude
    with a tiebreak that keeps the old cut first, so the first 1,627 entries
    are the old file exactly (77 stars of catalog mag 5.01-5.04 round to 5.0
    and follow them). A missing B-V (two stars, HIP 26220 and 32609) is now
    `null`, never the old 0.6 stand-in, because B-V now drives a colour.
  - **Faint stars lead less** (`lib/sky-render.ts`, `FAINT_STAR_MAG` = 5.0):
    every star at or brighter than 5.0 draws exactly as before (one arc, the
    old radius and fill); the fainter 3,340 draw as 0.88px squares SNAPPED
    inside one CSS pixel, alpha 0.22 at 5.1 down to 0.12 at 6.0, so each
    one's light (alpha x area) is under the old faintest dot's 0.2. They are
    BATCHED: 216 buckets of equal magnitude and colour, one path and one fill
    each, their RA and tan-half-colatitude prepared once. Phones cut at 5.5
    (was 4.5), desktop at 6.0. Catalog stars are not hit targets, so hover
    and picking are unchanged.
  - **Star colour** (`lib/star-colour.ts`, no imports): B-V → temperature by
    Ballesteros (2012, EPL 97 34008, eq. 14, read off the arXiv PDF), →
    sRGB by Mitchell Charity's "What color is a blackbody?" table (CIE 1964
    10° CMFs, sRGB, D65; transcribed by script, 1000-29800 K in 200 K steps,
    accessed 2026-10-01). The two source URLs, both read on 2026-10-01:
    https://arxiv.org/abs/1201.1809 (doi 10.1209/0295-5075/97/34008) and
    https://www.vendian.org/mncharity/dir3/blackbody/. One display choice on
    top, stated in the file (ruling R26): **stars draw at the colour of a
    blackbody further from white than their own temperature, clamped to the
    table's extremes**: the temperature's distance from the table's white
    row (6,600 K, #fef9ff) is multiplied by `STAR_CHROMA_GAIN` 1.8 (1.2 at
    mag 6) in mireds, clamped to 1,000 K (#ff3800) - 29,800 K (#9fbfff),
    and looked up in the table, because Charity's 5,300 K is a peach too
    pale to read on a 2px dot. ⚠️ The first version scaled chroma away from
    grey instead, which pushed 837 stars (every B-V <= -0.1) bluer than any
    blackbody; `test-sky-stars.mjs` now asserts every drawn colour lies on
    the table's locus and inside its two extremes. Rigel and Vega (B-V 0.0)
    draw 172,199,255; Betelgeuse and Aldebaran (1.5) 255,174,96; Antares
    (1.9) 255,154,57; Arcturus (1.2) 255,192,130; Capella (0.8)
    255,220,188. Through the
    saturation: the old faint tint at 0 (so the grey chart is unchanged),
    the star's colour at 1, a lerp between (`starFillsAt`, memoised on
    saturation). Betelgeuse's and Antares's cards, the two that already say
    "distinctly reddish", cite both sources (Sources only: their bodies are
    at the three-sentence cap).
  - **The band's gradient** (`lib/sky-layers.ts`, `MILKY_WAY_CORE_RGB`):
    above saturation 0 each level's WASH fills with a radial gradient
    centred on Sgr A* (objects.json's own position): gold to ~10° of the
    core, the colour round's tan from ~28° on, which then holds for the rest
    of the band (the radius is the screen distance to galactic longitude 70,
    through the standard J2000 galactic matrix, pinned against the defined
    centre). Source for the gold, on the Milky Way card: ESA's Euclid bulge
    image ("filled mainly with old, cooler stars, giving it its
    characteristic yellow colour"). Both stops lerp from INK on `bandMix`
    exactly as the flat band did, so the tan stop IS the old band colour at
    every saturation (asserted). The grain stays flat tan: a gradient on
    ~500 one-pixel points cost 0.3 ms for nothing visible. ⚠️ **No disc hue**
    (ruling R26): round 0 cooled the disc to a faintly blue white sourced to
    Las Cumbres Observatory's education page, which describes the galaxy
    from outside beside an artist's impression, not a long exposure of the
    band; it also turned the Cygnus star clouds a cold grey, LESS colour than
    before. A disc hue returns only with a long-exposure caption that states
    it. No pink H II regions either: the band has no positions for them.
  - **What the tests pin.** `test-sky-stars.mjs`: eq. 14 and the table
    verbatim, hue kept and warmth monotone in B-V, the owner's named stars,
    faint stars less chroma, every bright star's fill and radius equal to the
    pre-task code (re-implemented verbatim in the test), every faint star in
    one bucket and dimmer than the old faintest, and a full drawSky star-frame
    digest at 0 and 1. `test-sky-objects.mjs`: the band test reads gradients
    stop by stop (the tan and the gold warm with saturation and past half way
    at paper, the core warmer than the tan, no stop bluish, the tan stop equal
    to the old flat colour; the grain keeps the original assertions), the
    core is objects.json's Sgr A*, `prepareStarPaint` throws if a bright star
    follows a faint one (the prefix its indexing relies on), and
    `TRACE_STARGAZE` was RE-RECORDED, 17,059 → 17,159 (17,184 in round 0,
    with the blue stop), after the
    proof (`task-18-trace-proof.mjs`, run against the pre-task modules): with
    the new stars' calls removed, the saturation-0 FULL frame is
    byte-identical; at paper and in stargaze the only differences are 25
    wash fills (flat → gradient), their 100 gradient calls and the old
    stars' fill colours. `TRACE_COLOUR_OFF` did not change. The browser
    `sky-colour` check adds a golder-near-the-core assertion (see
    Verification).
  - **Cost**, headless Firefox at 1280px, A/B in one session: pre-task
    2.82-2.92 ms (`sky-animates-1280`), after 3.96-4.18 ms against the 5.92
    budget; the stars about +0.7 ms batched (+1.5 unbatched, measured), the
    wash gradient about +0.4. The margin is ~1.8 ms now, not ~3: under load,
    run the A/B before blaming the sky.
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
- **Card photographs** (2026-09-16, spec `docs/superpowers/specs/2026-09-16-sky-card-images-design.md`):
  `lib/sky-images.ts` loads `index.json` on the same per-layer gate as
  objects.json (`layers.images`: absent → no photographs, malformed → logged);
  `card-controller.ts`'s `imageFor(id)` attaches the entry; `SkyCard.tsx`
  renders it as the aside's FIRST child, outside the scroll body, `onError`
  clearing it rather than showing a broken image. Allowed licenses are
  public domain, CC0, CC BY and CC BY-SA (2.0 through 4.0), asserted equal in
  the generator and `scripts/test-sky-images.mjs`; the Moon's note says it is
  shown full, Sgr A*'s that it is a radio image, M57's that it is Webb's
  infrared. The index (~20 KB) loads on the same after-first-paint pass as
  the other layers (`loadSkyLayers`); only the photographs themselves are
  lazy, fetched when a card actually opens (`<img loading="lazy">`). ⚠️ A new
  object needs a pick, or the coverage test fails; a changed upstream file
  fails the generator until `--repin`, and that pin has a real boundary: it
  checks the upstream ORIGINAL as Commons reported it at generation time,
  only when the generator itself runs; it never authenticates the fetched
  thumbnail bytes and never ties the committed WebP back to the pin at
  build, deploy or load time.
  **Final-review fix wave (2026-09-17)**: `colourNote`/`colourNoteLines`
  reworded so their subject is unmistakably the drawn symbol, not the
  photograph now sitting above the card (a narrowband composite's own colour
  can be false in exactly the way R-COLOUR-1 forbids); eight picks whose own
  Commons description says composite/narrowband/mapped-emission-line/
  infrared (m42, m87, m33, m78, m82, ngc6960, ngc6992, mercury) gained a
  `note` saying so, on the description's own word, never a guess. The credit
  line now links the license name to `licenseUrl` (public-domain entries
  have none and stay plain text) and states the modification every
  photograph gets (", resized", or ", cropped and resized" for the pick
  list's two crops, m8 and m33, via a new `cropped` field the generator
  sets). The docked phone body cap dropped 1px (`calc(32dvh-1px)`) so
  figure + body + the aside's own border-t lands at exactly 60dvh, not
  60dvh+1px. The generator now stages each WebP and moves it into place only
  once the whole run has no failures, wraps its temp source fetch in
  try/finally, and never upscales past a source's own resolution
  (`min(long side, 640)`).
  **Myth artworks on constellation cards (task 19, ruling R25,
  2026-10-01)**, owner: "for the constellations named after a myth, display
  an image of the myth, fitting with its description". The rule: a
  constellation gets an ARTWORK only if ITS CARD in `content/sky-facts.ts`
  tells or names a myth, decided by reading each card (37 of 88; the
  included and excluded ids with a reason each are in the task-19 report,
  and `MYTH_CONSTELLATIONS` in `test-sky-images.mjs` pins the set). Not on
  the list, on purpose: the modern instruments and animals with no story,
  cards that tell history rather than myth (Coma Berenices, Scutum), Ursa
  Major and Ursa Minor (their cards quote Homer and Thales, no myth),
  Sagittarius (its card says no Greek myth belongs to it), Columba (a
  biblical story, left to the owner) and the Argo pieces (the brief admits
  them only if the card tells the Argo myth, and none does); since task 20
  each of these gets an atlas plate instead (below). The image is a
  public-domain or allow-listed artwork showing THE CARD'S version of the
  myth where one exists (Titian's *Bacchus and Ariadne* for Corona Borealis,
  with the crown in its sky; the Getty's Caeretan hydria for both Hydra and
  Cancer, whose crab pinches Herakles' heel), each subject confirmed on its
  Commons description page, not from the filename; otherwise the
  constellation's plate from a star atlas (Sidney Hall's *Urania's Mirror*,
  1825, for most; Bayer's *Uranometria* for Ara and Phoenix, Hevelius for
  Piscis Austrinus, which Urania's Mirror lacks or draws too small). Same
  pipeline as the photographs; two optional pick fields: `artwork` (the
  work's name, artist and date, typed from the description page) and
  `focus` (a CSS `object-position`, "50% 30%", so a figure's face survives
  the 4:3 / 2:1 box; it positions, never crops the file, so `cropped` still
  means only the generator's own `crop`). An entry with `artwork` is
  credited "Image:" (`imageCreditArtwork`) instead of "Photograph:", its
  citation is tagged " [Image]", and the credit ends with the work's name
  and `imageArtworkNote`, "An artwork, not a photograph of the sky." A pick
  may also carry `artworkSource`, a maintainer-only provenance note for an
  `artwork` line that departs from Commons' own fields (never published:
  Aquila's date is the Web Gallery of Art's 1531-32, not Commons' 1520-1540
  range that runs past Correggio's death in 1534; Hercules' tapestry reads
  "after Lambert Lombard" because its maker is anonymous). **Nudity: the
  owner ruled (2026-10-01) that nudity in these famous artworks is fine**;
  Cassiopeia's Urania's Mirror plate and Burne-Jones' Chrysaor stay.
  **Framing (fix round 1)**: every pick was audited in both the 4:3 desktop
  and the 2:1 phone frame for "is the card's subject the clear focus"; where
  not, a generator `crop` (so `cropped` stays truthful) and/or `focus` fixed
  it, and Leo moved from a black-figure amphora, unreadable at card size, to
  Zurbarán's *Hercules Fighting the Nemean Lion* (1634). Re-run the audit's
  contact sheets after any pick change. The Commons lookup is batched at 50
  titles (the API's limit, passed when the list reached 72 picks). ~2.0 MB
  added.
  **Atlas plates on every other constellation (task 20, ruling R27,
  2026-10-01)**, owner: "it seems a bit off only some have pictures and some
  don't." The 51 constellations whose card tells no myth (UMa, Sgr, Col,
  Cru and Sex included) show their own figure from a public-domain star
  atlas, in this order of preference: Sidney Hall's *Urania's Mirror*
  (1825; 29 picks, matching the myth set's plates), Bode's *Uranographia*
  (1801; 17: 15 far-southern figures off his southern sheet XX, plus
  Eridanus and Microscopium), Lacaille's own 1756 chart for his Norma, Circinus and
  Octans, Hevelius (1687) for Equuleus, Bayer (1603) for Lupus. Each is
  cropped onto its own figure (plates are shared: Urania's plate 32 serves
  Antlia, Sextans, Pyxis and the three Argo pieces) and checked in both the
  4:3 and 2:1 frames; the artwork line names the atlas ("Lynx, a star card
  from Urania's Mirror, Sidney Hall, 1825"). The pipeline gained one
  optional pick field, `thumbPx`: Commons' thumbnailer stops at 3840px
  whatever is asked (measured), so a pick whose `thumbPx` reaches the
  original's width fetches the ORIGINAL (Bode's sheets are 11,649px and
  22 MB), which a small figure cropped off a big plate needs; a run fetches
  each source once and backs off on HTTP 429. Picks without it fetch
  exactly as before, so every earlier WebP regenerates byte-identical.
  ~3.0 MB added (all 123 images ~6.8 MB, still fetched only when a card
  opens).
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
- **The credit line** (2026-09-16; reworded 2026-09-29): the owner trimmed
  `credit`/`creditStill` to one sentence each, then dropped the speed-up
  clause, and in the 2026-09-29 copy pass rewrote them as "The sky over NASA
  Ames from the moment you opened the page." / "The sky over NASA Ames when
  you opened the page.", followed by one honesty tail, `creditTail`, since 2026-09-30 "
  Objects are drawn enlarged, in long-exposure color." (Visitor copy is American spelling since that
  pass; code identifiers like `colourNote` keep their names.) The old `creditColour` span and its
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
- **The ways in** (three since Task 17's secret door, 2026-10-01; 2026-09-16, answering "I have had to tell everyone about
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
  - **The secret door** (Task 17, owner-approved 2026-10-01): in PAPER mode
    a still click (under `CLICK_SLOP_PX`) or a still touch tap on the sky
    that the hover hit test resolves to a CONSTELLATION's lines enters
    stargaze with `via: "sky"`; a symbol or drawn name that wins `nearestHit`
    is not it, nor a drag, nor anything in `NOT_SKY` (the sheet, controls,
    the credit). The rule is `secretDoorTarget` in `lib/sky-secret.ts` (no
    imports, pinned by `scripts/test-sky-secret.mjs`); the wiring is in
    `pointer-controller.ts` (a paper-mode touch is only REMEMBERED as `tap`,
    never a drag, so the margins still scroll). The clicked constellation
    stays lit after entry. Only this door shows a caption,
    `copy.stargaze.secretMessage` (the owner's words, verbatim), from
    `night-sky/secret-door.ts`: fade in 400ms, up 6s, fade out, none under
    reduced motion, centred at `max(--stargaze-hint-h + 24px, 22vh)` on the
    chrome's pill, `pointer-events: none`, inside an always-present polite
    `role="status"` region whose text is written only when it shows (so it is
    announced once), removed at once on exit. Exit focus goes to the toggle.
    On a 400px phone the margins are 16px, so the door there is mostly the
    band above the sheet: findable, not easy. The page's fade into stargaze
    is 600ms for every door (`globals.css`, was 400ms); `inert` is still
    immediate.
  - **`demo_used {demo: "stargaze", via}`**: `setStargazing(next, via =
    "toggle")` records the door (`getStargazeEntry()`), and `trackDemoOnce`
    sends `via: "toggle" | "footer" | "sky"` for the FIRST entry of the load.
    Still one event per page load.
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
  `invite` (its box), `secretShown` (the secret door's caption is up)), `window.__offload` (a per-kind offload counter) and the
  one WRITE hook, `window.__skySaturationOverride`, are verify hooks for
  `scripts/verify-redesign.mjs`, not UI. So are the `data-*` attributes the
  checks select on: `data-sheet`, `data-sky-credit`, `data-sky-credit-body`,
  `data-stargaze-toggle`, `data-ready`, `data-star-mark`,
  `data-stargaze-bar`, `data-stargaze-hint`, `data-stargaze-hint-text`,
  `data-stargaze-counts`, `data-stargaze-count-objects`,
  `data-stargaze-count-constellations`, `data-stargaze-browse`,
  `data-stargaze-exit`, `data-stargaze-chrome`, `data-sky-list-slot`,
  `data-sky-list-panel`, `data-sky-list`, `data-sky-list-item`,
  `data-sky-list-close`, `data-sky-invite`, `data-sky-secret`, `data-sky-secret-region`, `data-stargaze-footer`,
  `data-stargaze-footer-enter`, `data-lab-box`, `data-stamp`,
  and the chess panel's `data-chess-self-play`
  (JSON: plies, departures, the move played, the top move, the current
  hint), `data-chess-self-play-rule` and `data-chess-self-play-took`. The CSS variable `--stargaze-hint-h` is real
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
- **The classifier-free claim lives in the `classify.a` explainer only**
  (2026-09-29). From 2026-09-16 a permanent `classifyLead` line ("No
  classifier model: the diffusion model guesses the label itself.") sat above
  the label picker and the figure caption repeated it; the owner's copy pass
  cut the line and rewrote the caption, so the explainer is now the one place
  it's said. It says "no separate classifier", not "no classifier": the demo
  does classify, and the claim is that no second model does it. It cites Li
  et al. (2023) as "a cheap version": `lib/classify.ts` runs their idea at
  one timestep with one shared noise draw, where they average denoising error
  over many. Markup and copy only: no hook, handler, `classifyingRef`,
  `fitFreshRef`/`inkGenRef` or the `generate()` call site was touched.
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
- **Self-play varies itself inside the model's own near-ties** (owner's idea,
  2026-09-17; `lib/chess-selfplay.ts`, pinned by `scripts/test-chess-selfplay.mjs`).
  The engine is deterministic, so engine-vs-engine replayed ONE 41-move game
  on every press. At one ply self-play now plays its top move except up to
  twice a game (`SELF_PLAY_MAX_DEVIATIONS`), when the second or third choice
  is at least 0.8 of the top prior (`SELF_PLAY_TIE_RATIO`); then a coin
  (`SELF_PLAY_TAKE_P = 0.5`) may take it, uniformly among the qualifying two.
  Seeded per game from `Date.now()` at its first self-play move (mulberry32);
  the budget is per game (`gameIdRef`), so stop-and-restart never refills it.
  **Scope, deliberately**: a human game and the hint stay pure argmin
  (varying them would weaken the engine on purpose and bend the strength
  claim), and "let it think" self-play plays the search's move. Measured
  first, in node on the served int8 model through the worker's exact path:
  argmin self-play over ten openings ended 7 mates / 3 late threefolds
  (first repeat at ply 116-133, 5-8 pieces left), so the old comment's
  "tends to end in the threefold" was wrong about the common case; with the
  rule, 12 presses gave 9 distinct games and 10 mates (median 95 plies);
  forcing the first departure into the opening measured WORSE (7 of 12:
  every game then took the same alternative first move), which is why the
  coin is flat across the game. The list marks the move PLAYED (it used to
  colour the top row), a departure prints its own numbers ("took its second
  choice · p=0.211 vs 0.236"), the rule is stated while it applies, watching
  self-play counts as `demo_used{chess}`, and the loop pauses off-screen
  (IntersectionObserver) or tab-hidden and resumes after (a move already in
  flight still lands). **A reply for an older game is discarded**: a move in
  flight when "new game" was pressed used to land on the fresh board's list
  (pre-existing; the self-play check found it).
- The interpretability view is precomputed (`public/chess_activations.json`),
  gated on the file, and reads `grid`/`layers` from it — never hardcode. Works
  for this model because the backbone never downsamples below 8x8; don't attempt
  it on the diffusion UNets.

### SLAAC rerouter (Figure 3) — page 1's NASA box (LIVE since 2026-10-01)
- What it is: the owner's SLAAC hazard-aware rerouter, live. The figure
  opens on all 373 library routes at once (Task 12c), or a visitor picks
  one of 48 hub pairs; the LM-filed routes draw, they draw an airspace and/or
  turn on all six US launch sites, and the owner's diffusion model
  (`FlightDiffusion`, a diffusers `UNet1DModel`, 5.78M params, 7 channels x
  256 points, v-prediction, CFG 2.0) reroutes every affected flight, then the
  owner's `local_reroute` snaps each arc to named fixes. Spec
  `docs/superpowers/specs/2026-09-30-slaac-rerouter-design.md` (with an "As
  built" and a "Measured" section), rulings R1-R16 in the gitignored ledger
  `.superpowers/sdd/2026-09-30-slaac-rerouter/progress.md`. Files:
  `components/figures/RerouteFigure.tsx` (the figure), `reroute-map.ts` (canvas
  drawing and view math, node-tested), `ring.ts` (drawn-ring validation);
  `lib/slaac-engine.ts` (main-thread client), `lib/slaac-worker.ts` (thin
  shell), `lib/slaac-protocol.ts` (the wire); `lib/slaac/*` (the port and the
  pipeline: `albers`, `geometry`, `dpm-solver`, `guidance`, `sampler`,
  `reroute`, `navaids`, `rng`, `arcs`, `run`, `yield`, `data`). Python
  generators in `scripts/slaac/` (README there has the venv and the order).
- **The port is pinned by vectors, never trusted by reading**
  (`scripts/slaac/make_vectors.py` runs the owner's REAL modules, imported by
  path, into `scripts/slaac-vectors/*.json`, ~2.8 MB, never in `public/`):
  `test-slaac-geometry` (Albers forward 1e-6 m, inverse 1e-9°; inside,
  nearest boundary, segment tests, RDP case for case), `test-slaac-dpm`
  (diffusers 0.38.0 `DPMSolverMultistepScheduler` for exactly this config:
  timesteps equal for 20/30/40/50 steps, every step's `prev_sample` < 1e-4,
  a full 40-step rollout < 1e-4; any other config throws),
  `test-slaac-guidance` (smoothing and low-pass < 1e-6, margin top-up and
  `sua_displacement` < 1e-3 m), `test-slaac-sampler` (the real ONNX graph in
  node, 1 thread, on Python's own injected noise: `chord_features` < 1e-4,
  the first three x0 estimates < 1.5e-4, the final path within
  `tolerance_m = max(50, 20 x torch-vs-ORT drift)` per run (R2); measured
  0.585 m with no airspace, 1.02 m with it), `test-slaac-reroute`
  (`local_reroute` both policies, `refine_route_sua`, the snap: identical fix
  names and roles, coordinates < 1e-9°, and `anchorsFor` predicting every
  sampler call's entry and rejoin exactly). **⚠️ The float32 chord-end
  trap**: the Python sampler is float32 end to end, and torch's float32
  `linspace` and `A + (D - A) * s` put the pinned last chord point 1 ulp off
  the endpoint, so `chord_features`' to-end vector there is a tiny nonzero one
  and `atan2` reads pi (or -pi/2), not 0. A float64 chord flips those
  channels and the samples drift visibly. `sampler.ts` rounds through
  `Math.fround` wherever torch rounds; the chord is the one place that is
  load-bearing, and `make_vectors.py` carries pipeline-captured
  `chord_features` cases for it (Task 2 fix round). Re-run the vectors and all
  ten `test-slaac-*` files after any change to the owner's pipeline.
- **The owner's pipeline semantics are kept, even where they look odd**:
  `plan_cli.Sampler` reseeds per arc, so every arc in a press starts from the
  SAME noise (`normalNoise(seed, C*N)`, mulberry32 + Box-Muller, drawn once
  per press from `Date.now() >>> 0` and repeated per arc), which also makes an
  arc a pure function of its (entry, rejoin), so `run.ts` dedupes flights that
  share one. Both policies ship, named as on the poster: "1-waypoint lookahead"
  (`hug=1`) and "infinite lookahead" (`hug=0`, wide berth, the default); margin
  default 25 nm. 20 DPM-Solver steps from the gate (R10), not the pipeline's
  40. Every reroute option is read from `meta.reroute`, never hardcoded.
  (R5: the "wide branch returns None" bug the spec once claimed does not
  exist; `sua_guidance.py`'s last line has no trailing newline and line-count
  tools hid it. Call the owner's function as is.)
- **Batching**: an arc's anchors depend only on the filed route and the
  polygons (`anchorsFor`, exact in both policies), so `planArcs` knows every
  arc of a press before the model runs and the worker samples them together,
  one forward per step per chunk of `BATCH_CAP_DESKTOP`/`BATCH_CAP_PHONE` arcs
  (`lib/slaac/arcs.ts`; the CFG batch is twice that). **Both caps are 4
  (Task 15, measured, see Measured below)**: a forward costs ~16 ms per CFG
  sample whatever the batch, so batching buys almost no throughput, and the
  old desktop cap of 16 gave 548 ms progress intervals on 8 arcs. **R3
  fallback**: `localReroute` stays exact; its sampler returns the batched arc
  for a planned (entry, rejoin) and samples on demand, unbatched on the same
  noise, for any pair the planner missed, counted as `fallbackArcs` (expected
  0, asserted by `test-slaac-arcs`).
- **The worker yields one macrotask before every forward (R16)**: ORT-web's
  `session.run` settles without returning to the worker's task queue, so a
  run that only awaits forwards never lets a `cancel` or a newer `reroute`
  message in: it would post its whole run first. `lib/slaac/yield.ts` uses a
  MessageChannel round trip in browsers (measured in a Firefox worker:
  0.01-0.02 ms, where `setTimeout(0)` clamps to 4.17 ms) and `setImmediate` in
  node (a self-reposting MessagePort starves node's other ports; measured).
  `session.run` calls are chained through a promise `gate`, so two runs are
  never in one session at once. ⚠️ Chrome and Safari worker task ordering is
  unmeasured.
- **Stale-run discipline, three layers, each proved to bite in
  `slaac-reroute`**: the figure (`activeRef`, the in-flight press's
  generation, plus a press generation: three
  presses in one task start one run); the engine (every run-scoped message
  carries `runId`, and the client drops any but the run it awaits; a newer
  press rejects the old one with `SlaacCancelled`); the worker (`currentRun`,
  checked at every forward after the yield, and `post` drops any message for
  a run that isn't current, so a superseded run stops within one forward).
  `SlaacCancelled` and `SlaacUnloaded` are idle, never errors.
- **Loading and stargaze** (the chess rules): behind `DeferredMount`; at
  scroll-in only the six small JSON files load (~230 KB, `loadSlaacData`, one
  memo); a press first plans on the MAIN thread (a dynamic import of the pure
  planner) and a press with no affected leg says "no conflict" without loading
  anything (`slaac-nothing-at-rest`). Only then do the model (HEAD-probed:
  absent → "unavailable", nothing stands in) and the runtime load, in a worker
  created with the literal `new Worker(new URL("./slaac-worker.ts",
  import.meta.url), { type: "module" })`; onnxruntime-web is imported there
  through `onnxruntime-web/wasm` only (the WebKit trap). Stargaze terminates
  the worker (`unloadSlaacEngine`, `noteOffload("slaac")`) and reloads on
  return only if it was loaded or loading; load generations discard a load
  that lands after an unload. `demo_used {demo: "slaac"}` once per load, after
  a completed reroute. The model is `public/models/flightdiff-<sha8>.onnx`
  (`/models/*` is immutable for a year), its name read from `meta.json`.
- **R6, `.ts` sibling imports**: `lib/slaac/*` imports siblings as `./x.ts`
  (`allowImportingTsExtensions` in tsconfig) so plain `node --test` loads the
  real modules; Turbopack bundles them fine (verified in the production
  build's worker). Components import them extensionless through `@/lib/slaac/...`.
- **The gate decided what ships** (`scripts/slaac/gate.py`, hand-run, owner's
  real pipeline imported by path; `scripts/slaac-gate/report.{md,json}`
  committed, per-run `rows.jsonl` gitignored and provenance-hashed, so a resume
  on changed inputs is refused). Case set: every library route against all
  launch polygons at once (80 affected of 373), plus 200 random polygons from
  `eval_sua.build_cases` (seed 0), x both policies x 20/30/40/50 steps at
  margin 25: 2,240 runs, 0 exceptions. **R7**: each launch site's touching or
  overlapping rings are unioned into one outline (KSC's R-2932..R-2935 and
  W-497A/B abut, and the guidance field, treating polygons independently,
  pushed paths out of one ring into the next; hug sat at 97.5% before it).
  Each merged polygon keeps `merged_from` and every source URL. **R9's
  ladder**: snapped with `[wide, hug]` if hug >= 98% and wide >= 99% leg-clear
  with 0 exceptions; else `[wide]` alone (the lookahead control drops); else
  continuous (owner checkpoint). **R11**: the "never shorter than its anchor
  chord" column is an invariant, 0 by construction, not evidence; the evidence
  is leg-clear and clear-at-margin. Result (after R13): **20 steps, snapped,
  `[wide, hug]`**, hug 99.64% / wide 99.29% of plans with no leg crossing (the
  two failures are the same two random cases at every step count: snapping
  pulls a leg through, the repair budget stops; the figure draws such a flight
  as cannot-clear, dashed, its crossing legs red). **R10's trade**: 20 steps
  holds every leg at the full 25 nm on 86.1% / 85.4% (hug/wide) against 89.3% /
  85.4% at 40; the metric isn't monotone in steps (50 reads 86.4/82.5), and
  the launch-preset subset is noisier (hug 68.8% at 20 vs 77.5% at 40). Copy
  must never imply the buffer is always held; the figure prints each flight's
  real minimum clearance, floored, in red when under the margin.
- **R13, the FRD doubling-back fix, is an OWNER-PIPELINE bug worth fixing
  upstream**: for an LM token `NAV <Rxxx> <Dyyy>`, `gen_trx_sua.py`'s
  `geocode_items` keeps NAV as a waypoint AND appends the FRD point, so the
  route flies over NAV and then up to ~100 nm back (138 of 373 routes doubled
  back; 122 contained an FRD). The owner's own FP_ROUTE path (`rdp`) emits
  only the FRD point. `route_library.py`'s `frd_rewrite` turns each
  `("fix", NAV), ("rd", (b, d))` pair into `("rdp", (NAV, b, d))` before
  calling the owner's function (no owner file edited); same seeds, identical
  LM tokens, regenerated, gate re-run. 11 routes still backtrack: those are
  the LM's own doglegs, shown as generated, never reordered.
- **The route LM is precomputed, not live**: 222M params, 890 MB fp32 (~222
  MB even at int8), ~120 ms/token on CPU with no KV cache, 17-35 tokens a
  route. `route_library.py` ran `route_lm_best.pt` through the owner's
  `generate_batch` (temperature 0.8, top-k 40, seed = pair index) under one
  fixed context per pair (B738 FL350, or E75L FL300 under 400 nm great
  circle; month 9, dow 2, hour 14), geocoded with the owner's Viterbi
  geocoder (`max-leg-nm 1000`, endpoints anchored), broken routes dropped and
  counted: 48 owner-approved pairs (Task 9 checkpoint) between public hubs
  (FAA CY2025 enplanement rankings, lower 48, `scripts/slaac/hubs.json`; never
  ranked from `flights.csv`), 373 routes, each with its tokens and seed. The
  copy says the routes were written ahead of time.
- **Data permissions** (owner, 2026-09-30, NASA cleared the Summer 2026
  codebase; mirrors memory `nasa-codebase-permissions`): publishable are the
  trained weights (the rerouter's ONNX here; the LM's by extension, not
  shipped), the nav DB (`wyp345plus.txt`, shipped only as the 3-letter-navaid
  snap table clipped to the lower-48 box), `airports.txt` (only the
  library's airports), and ported code where it has to ship to the browser.
  **Never published**: `SUA_all` (the launch airspace is rebuilt from public
  FAA data instead), the real TRX days (`TRX_2025*`, `data/TRX_*`), anything
  under `out/`, and any `.py` source (the build plan's addition, in
  `scripts/slaac/README.md`; the memory file doesn't list it). `route_db.json` / `route_ranked.json` (mined
  from real filed plans) and `airways.txt` were never shipped; ask before
  either is. The NASA directory (`/home/neelayranjan/_SAVE/NASA/
  NeelayRanjan_Summer2026_Codebase`) is read BY PATH (`scripts/slaac/nasa.py`)
  and never copied; the codebase stays private (the owner commits it to
  `NeelayRanjan/SAVE`) and the site never links it. NASA requires no
  disclaimer; the DIFFERENCES note under Figure 3 is the owner's own (their
  intent, "an approximation of real models integrated into NASA ATC
  simulation software", made concrete; the owner rewords it later).
- **Launch airspace** (`public/slaac/launch-sua.json`,
  `scripts/slaac/prepare_launch_sua.py`, sources in
  `scripts/slaac/launch-sua-sources.json` and
  `docs/superpowers/specs/2026-09-30-launch-sua-sources.md`): six sites. Cape
  Canaveral/KSC (R-2932..R-2935, W-497A/B), Vandenberg (R-2516, R-2517,
  R-2534A/B, W-532S), Wallops (R-6604A/B; W-386 out, the handbook names no W
  number), Spaceport America (R-5111A/B, per the FAA PDF), all from the FAA AIS
  `Special_Use_Airspace` ArcGIS layer (public domain); Starbase and Blue
  Origin's Van Horn from two PAST launch TFRs (FDC 5/3325, FDC 5/0611),
  labelled as past TFRs. White Sands and Mojave dropped (owner), Kodiak outside
  the domain. Rings clipped to the model's box (lat 24-50, lon -126..-66),
  `clipped: true` where that changed them. **⚠️ The FAA chart cycle expires
  2026-10-29** (`cycle: "2026-09-03..2026-10-29"`). Re-pull: delete
  `scripts/slaac/.cache/faa_sua.geojson` (the layer rate-limits with HTTP 429,
  so pull once), set `CYCLE` in `prepare_launch_sua.py`, re-run it, run
  `test-slaac-data`; if `launch-sua.json`'s bytes changed, re-run the gate with
  `--fresh` (its sha256 is in the provenance) and re-check the decision it
  writes into `meta.json`; then update the cycle dates in
  `copy.research.notes.data`. The demo treats every polygon as surface to
  unlimited and always active.
- **Dynamic zoom (R14, Task 12b)**: the map fits the selected pair's routes,
  any launch airspace within 150 nm of them (`FOCUS_LAUNCH_NM`) and any drawn
  ring, padded, eased over 350 ms on real elapsed ms (snap under reduced
  motion); "whole US" returns to the lower-48 fit; the ring tool works at any
  zoom through `fromScreen` of the CURRENT view, mid-ease included; an open
  ring holds the view still until it closes. A finished run re-zooms once.
- **All flights, the button, stop (Task 12c, owner-approved design,
  2026-10-01)**: the route picker's first option, "all flights (N)" with N
  the library's route count, is the default (`pairIdx` -1, flight ids
  `ORIG-DEST-n`; one pair keeps ids "1".."8" and its per-flight table). One
  press sends every flight in ONE request; the worker plans, dedupes and
  batches as for one pair. Before a press the readout counts the arcs it will
  sample ("43 arcs to sample" at the defaults), computed on the main thread by
  the same planner and dedupe (`uniqueArcCount`) behind `mayConflict`, an
  exact bounding-box prefilter (a route whose fixes' box, grown by the widest
  distance the walk tests, misses every polygon's box can plan no arc;
  `test-slaac-arcs` pins planArcs over the kept flights equal to planArcs over
  all 373, both policies, three margins, with and without a drawn box): the
  full planner over 373 routes took ~0.5 s in node, too slow to run on every
  settings change. Never a predicted time. Progress reads "rerouting d/N
  arcs" from `arcsDone`/`arcsTotal` on the worker's progress messages (unique
  arcs whose chunk finished). All flights answers with a summary
  (`lib/slaac/summary.ts`, `summarizeFlights`, pinned by
  `test-slaac-summary`): flights checked, near airspace (not untouched),
  rerouted, can't clear, median and most added distance over rerouted flights
  only, lowest clearance over affected flights (floored, red under the run's
  margin). A click or tap within 8/16 px of a flight's line (plans first, then
  filed routes, through the current view; `nearestFlight`) picks it into one
  detail row; empty map clears it; the ring tool wins while drawing. **A
  pick's look (Task 12f, owner)**: every other flight's plan, dense arc and
  crossing legs drop to the filed routes' texture grey; the picked flight's
  filed route draws solid in the airspace red and its plan (stale fade and
  cannot-clear dashes kept) in green on top; an untouched pick is the red
  line alone. `slaac-all-flights` samples the red on filed legs clear of the
  plan, its dense arc, the outlines and the labels (`window.__slaacLabels`,
  the last paint's label boxes, a verify hook). The 373
  filed routes draw as texture: opaque ink on their own layer, composited
  once at 0.2, because a 1px line is a Skia hairline and hairlines stack even
  within one path (measured: 373 routes at 0.14 alpha read up to 229/255 on
  shared legs). **The reroute button** (`data-reroute-go-state`): amber
  (`warm`, "idle-stale") unless the result on screen answers the current
  settings and no flight is cannot-clear, then green (`ok`; a fresh
  no-conflict press counts); "stop" (`running`) while planning, loading or
  running. **Stop** bumps the press generation, calls `engine.cancel()`, and
  hands the figure back at once with the result it showed before the press
  (stale or not); the abandoned press can't write anything after
  (`activeRef`); a model still loading keeps loading; no error, no done, no
  `demo_used`.
- **Presentation rules**: airspace stamp red, filed routes ink, rerouted plans
  x0 green, numbers warm amber; a plan made stale by a control change is drawn
  faded and only a press re-runs it; cannot-clear plans are dashed with red
  crossing legs; untouched flights say so; degenerate or self-crossing rings
  are refused with a message; Escape clears an open ring except while
  stargazing. Taps add vertices on release within a slop (a phone's press is
  also a scroll); a tap near the first corner closes (22px touch, 12px mouse).
  `window.__slaac` (`runId`, `loaded`, `lastDone`, `view`) and
  `data-reroute-status` (state, step, arcs, ms, flights, launchSites with
  centroids, view, and since Task 12c `mode`, `arcsPlanned`, `arcsDone`,
  `arcsTotal`, `picked`), `data-reroute-go-state`, `data-reroute-planned`,
  `data-reroute-summary` / `data-summary` and `data-reroute-detail` are
  verify hooks, not UI.
- **The model's own arc, dotted under each snapped plan** (`drawPlan` in
  `reroute-map.ts`; each result's `dense` comes from `denseOf` in
  `lib/slaac/run.ts`: the plan's filed and rejoin fixes as they stand, with
  each sampled arc's interior points standing in for that run's snapped
  deviation fixes, i.e. the path as the model drew it before the snap). In
  snapped display, for any flight whose plan has a non-filed role, the dense
  arc strokes FIRST, 1px, dash `[1, 3]`, in the plan's green eased toward
  the panel at `DENSE_UNDER = 0.4`, taking the same stale (x0.35) and
  cannot-clear (x0.5) fades as the plan, and the subordinate grey under a
  pick; the plan then draws over it. So the sampled path and the plan snapped
  from it both show, which is the snapping the owner's poster is about. The
  caption names it ("the faint dotted line is the arc before snapping").
  In continuous display (the gate's fallback rung; `meta.json` ships
  `snapped`) the dense arc IS the plan, drawn at full width, dashed `[5, 3]`.
  `slaac-all-flights` treats the dense arc as an obstacle when it samples a
  pick's red filed legs.
- **The `failed` run state** (`RunState`, readout `copy.research.figReroute.runFailed`,
  "The reroute stopped with an error. Try again."; `data-reroute-status`
  state `failed`): a press throws something other than `SlaacCancelled` /
  `SlaacUnloaded` AFTER the planner chunk is in hand (`phase === "run"`:
  the airspace load and arc plan, or the worker's run once the model
  loaded). A throw
  while the planner or the model is still loading is `unavailable` instead,
  and nothing can run. The error goes to `console.error`; no done, no
  `demo_used`; the button stays amber (`idle-stale`). `failed` PERSISTS
  across margin, lookahead and ring changes: those only make the shown
  result stale and never touch `runState`, so the error line stays until the
  next press (which sets `planning`) or a change of route pair (the one
  control that resets `failed` to `idle`, since the error was the old pair's
  run). Stop, stargaze and a superseding press are never `failed`.
- **Measured** (Task 15, 2026-09-30, this laptop, production build, headed;
  first press, cold cache; median of 3 [range]): stock Firefox 152 (driven
  over WebDriver BiDi): KJFK-KMIA past all six launch sites, 3 arcs, 2.77 s
  [2.71-2.78] press to done, 2.15 s of worker time, ~100 ms per forward at 6
  CFG samples; with a large box over the Southeast too, 2 arcs, 2.07 s; the
  heaviest library case (KCLT-KSAN, launch sites plus the box, 8 arcs) 6.11 s
  at cap 4 (5.75 s at the old cap 16); a no-conflict press settles in ~17 ms
  and loads nothing. Press to model loaded ~0.62 s on localhost (23.4 MB model,
  plus 3.46 MB of gzipped runtime when the chess worker hasn't already fetched
  it; the runtime is 13.5 MB raw). Playwright's Chromium 1243: 3.15 s for
  KJFK-KMIA. WebKitGTK 2.52.5
  (JavaScriptCore): 8.3 s, ~330 ms per forward, idle afterwards flat at
  ~600-850 MB and ~97% CPU (the sky's render floor), no runaway. Playwright's
  Firefox: 15.8 s, see the trap. **Owed**: Chrome proper and the owner's
  iPhone on production; no phone number exists, and the copy says only
  "seconds on my laptop, longer with more airspace or every flight at once"
  (no numerals since 2026-10-01; behind it: medians 2.07-6.54 s across the
  cases, one 7.89 s Chromium run under load; each extra drawn airspace can
  add arcs, run in chunks of 4). **All flights** (Task 12c, 2026-10-01,
  `measure-sysff.mjs all desktop 3`): 43 unique arcs over 373 flights, stock
  Firefox 152, **34.7 s [33.3-34.8]** press to done, 0.87 s to model loaded,
  ~146 ms per forward (8 CFG samples), longest gap between progress
  messages ~0.78 s; measured with an unrelated job holding the machine at
  load ~3-6 (the same session's KJFK-KMIA read 3.14 s [3.05-4.11] against
  Task 15's 2.77 s), so if anything high. Playwright's Firefox: 232-249 s
  for the same press (and over 600 s on a saturated machine).

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

### Sample-space (DDPM vs flow matching) — REMOVED 2026-09-29
- Cut from /lab in the owner's copy pass, along with its copy and
  `content/sample-space.md`; `components/SampleSpace.tsx`,
  `SampleSpaceWriteup.tsx` and `lib/sample-space.ts` live in git history. It
  was hand-built and illustrative (labeled as such, deterministic `hash01`
  paths). If it returns, it returns as a real trained 2D model, not the
  illustration.

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
- **Figure 1 is STATIC since 2026-09-30** (owner call: the slider, readouts,
  whiskers and mask strip were hurting engagement). A server component, no
  client JS. The one thing it argues is drawn instead: x0-diffusion heavy
  (2.8px) and on top, the baselines faded to 0.5, the smallest budget's column
  shaded in x0's green, x0's value printed on its point, and a bracket from the
  next-best model up to x0 carrying the lead (+0.047 over SAM today), all
  computed from the json at the smallest budget and not drawn if x0 stops
  leading there. The y floor went from 0.4 to 0.6 (the 0.4 existed only for
  the whiskers; 0.6 spreads the lines half again further apart) and a mean
  under the floor throws. The `strip` block and `public/research/eff/` stay
  committed and unrendered, like the wipe's assets. The history below
  describes the interactive version.
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
- **Figure S3 on `/lab` (flight video, `FlightFigure.tsx`)**, page 1's
  Figure 3 until the live rerouter took that slot (2026-10-01): the component
  takes an `n` prop, and `app/lab/page.tsx` mounts it as `n="S3"`
  (`id="flight"`, behind `DeferredMount`) with its own heading and lede,
  `copy.lab.flight` ("A language model that writes flight plans", pointing
  back at Figure 3's filed routes as this model's output); `lab-flight-video`
  pins play in view, pause out of it and the S3 caption. The committed mp4 is
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
| `public/sky/sky.json` | ~134 KB (~46 KB gz) | star catalog behind every page: 5,044 stars to mag 6.0 (1,627 to mag 5 until Task 18), 88 constellations, built by `scripts/prepare-sky.mjs` from a pinned d3-celestial commit |
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
| `public/sky/images/*` | ~6.8 MB | 123 images: 35 card photographs, (task 19) 37 myth-constellation artworks and (task 20) 51 star-atlas plates (640px WebP, metadata stripped) plus `index.json` with author, license, Commons source and pinned sha1; built by `scripts/prepare-sky-images.mjs` from `scripts/sky-image-picks.json` |
| `public/models/flightdiff-b3463317.onnx` | 23.4 MB | the SLAAC rerouter's diffusion UNet (5.78M params, fp32, opset 17, dynamic batch; ONNX vs torch max abs 3.8e-6); the hash in the name is its sha256's head, and `meta.json` names it |
| `public/slaac/meta.json` | 1.5 KB | normalization stats, channels, the scheduler config, the sampler (20 steps, from the gate) and reroute settings, the model's name and sha256, `display: "snapped"`, `policies: ["wide", "hug"]` |
| `public/slaac/routes.json` | 143 KB | the LM route library: 48 pairs, 373 routes, each with its tokens, fixes and seed (`scripts/slaac/route_library.py`) |
| `public/slaac/navaids.json` | 57 KB | the snap table: 3-letter navaids from the nav DB, clipped to the lower-48 box |
| `public/slaac/us-outline.json` | 12.5 KB | the lower-48 outline embedded in the owner's `viz_common` |
| `public/slaac/launch-sua.json` | 9.8 KB | six launch sites' merged outlines (R7), each with its designators, source URLs and the FAA cycle (expires 2026-10-29) |
| `public/slaac/airports.json` | 2.1 KB | only the library's airports |
| `scripts/slaac-vectors/*.json` | ~2.8 MB | parity vectors from the owner's real modules; never in `public/` |
| `scripts/slaac-gate/report.{md,json}` | ~240 KB | the gate's decision and per-case table (`rows.jsonl` gitignored) |
| `public/ort/*` | ~37 MB | onnxruntime-web wasm, vendored, **gitignored**, synced on prebuild |

The JEPA bundle is produced by
`export.py` in `~/Documents/embedding_jepa/` and copied verbatim; nothing in this
repo generates it. `public/headshot/v2/` is copied verbatim out of
`~/Documents/headshot_diffusion/dist/` (graphs and metas byte-for-byte, renamed
to the `headshot256*` / `headshot128*` scheme; the photos re-encoded from the new
`photos/{i}.png` with `ffmpeg -map_metadata -1 -c:v libwebp -quality 80`, 512²
plus 96² thumbs); the bundle's `vectors/` and `*_{128,256}.png` training inputs
stay out of `public/`. Git LFS: settled, not needed (~73.5 MB tracked binaries on `main` since
the 2026-10-01 merge, measured over the tracked onnx/webp/png/mp4/ico/pdf
files: the rerouter's 23.4 MB ONNX and task 19's ~2 MB of artworks on top
(task 20's ~3 MB of atlas plates add to that, ~76.5 MB)
of the ~48 MB `main` held before it; ~47 MB until the card photographs,
final-review fix #9, 2026-09-17; every file still under GitHub's 100 MB
per-file limit). `public/models/flightdiff-*.onnx` and
`public/slaac/*` come from `scripts/slaac/` (hand-run, a local venv with
torch 2.13 and diffusers 0.38.0, reading the NASA directory by path).

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
