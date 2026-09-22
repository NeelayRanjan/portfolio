# neelayranjan.dev

Personal portfolio, styled as a dark preprint: a sheet on a real, slowly
turning star chart of the sky over NASA Ames, research rendered as
interactive figures, and trained models running entirely in the visitor's
browser. Shipped 2026-09-12; the previous faux-terminal site lives at git tag
`v1`. The night sky replaced the original particle-field desk on 2026-09-15.

Nothing here is faked. The author photo is sampled on demand by a diffusion
model overfit on three real photos. The segmentation figures are computed from
the paper's own per-image metrics and prediction masks, with `provenance.json`
recording exactly which. Draw-a-digit runs a 6.47M-param MNIST diffusion model
client-side, and the chess figure plays the same 553KB int8 energy-based model
family that runs on a Raspberry Pi. No backend, no API: every forward pass
happens on the visitor's machine.

## Run it

```bash
npm install
npx next dev --port 3001   # the dev server; :3000 is kept free for verification
npm run build              # production build
npm start -- -p 3000       # serve the build (what the verify suite targets)
```

`predev`/`prebuild` run `scripts/sync-ort.mjs`, copying onnxruntime-web's WASM
out of `node_modules` into the gitignored `public/ort/`. The binary is
version-locked to the JS: a stale copy fails at the first model load, not at
build time.

### Verify before believing

```bash
node scripts/verify-redesign.mjs           # all 45 checks, against npm start on :3000
node scripts/verify-redesign.mjs chess cdf # any check-name substrings run a subset
node scripts/verify-headshot-256.mjs       # hand-run: the 256 headshot + morph, in node
node scripts/check-voice.mjs               # copy.ts + sky-facts.ts voice gate (banned words, em-dashes)
node --test scripts/test-sky-data.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs \
             scripts/test-sky-objects.mjs scripts/test-sky-facts.mjs scripts/test-sky-iss.mjs \
             scripts/test-sky-images.mjs scripts/test-chess-selfplay.mjs \
             scripts/test-resume.mjs
                                            # plain node: the committed sky data's shape, the projection/
                                            # drag math pinned against astronomy-engine, the colour ends pinned
                                            # by draw-call digest, card-image index shape, fact coverage, and
                                            # the chess self-play rule, and the served resume (93 cases)
```

The suite is Playwright-Firefox against a real production build and asserts
behavior, not HTTP 200s: the night sky turns and pauses under reduced motion,
paper mode's colour is measured as a share of stargaze's at the same pixels,
stargaze mode hides the page and offloads the models without ever faking a
completed run, the chess hint returns validation vector D, the sampled
headshot pixel-matches the photo that was pressed, the label-efficiency
readouts match the served JSON, and a Resume click queues the analytics event
production would send.

## The pages

Every page shares a real star chart of the sky over NASA Ames turning slowly
behind the paper: drag it to pan (it springs back on release, except in
stargaze, where it stays where you left it until you leave), hover a star,
object or line for a one-liner, and "stargaze for a bit?" hides the
page and gives the sky the screen, where deep-sky objects, named stars,
meteor radiants, Voyager 1 and the live ISS all draw from real data and
open a sourced, cited card on a click (a symbol or its name), a tap (a
symbol), or Enter in a hidden keyboard list (Voyager 2 keeps its data but sits
south of the chart's edge) (the models in flight get
cancelled and offloaded, never faked as finished). Inside stargaze, names carry
dotted underlines and a pointer cursor, rings mark a few symbols on the first
entry, the hint bar counts what has a card (44 objects, 88 constellations,
from the data) and opens the on-screen list as a visible panel, and phones
draw names for the coloured objects.

There are three ways in: the toggle (with a small star mark), a door at the
foot of `/` and `/lab` under the same name, and the sky itself, which
introduces itself in a short caption the first time a mouse pointer drifts
onto it in a session. `demo_used` records which door was used.

The 45 deep-sky objects and the Milky Way's band are drawn in sourced colour
at half strength on the page, and at full strength while the pointer is over
the sky or in stargaze (devices without hover stay at half). Colour was
stargaze-only until 2026-09-16, because the figures use colour semantically;
the owner reversed that, and the half is a measured share of the displayed
colour, not a guessed parameter. The shapes are illustrative and far bigger
than life, every position is real, and the colours follow long-exposure photographs rather than what an eye would
see, because at these brightnesses vision runs on rod cells and registers no
colour at all. The credit line on every page and every affected card say so. Where an
object's famous picture is a narrowband false-colour map, the site either
draws what that object's own emission lines emit or leaves it grey: the Cigar
Galaxy is grey for exactly that reason, and its card explains why. The ISS's position comes
from a same-origin, server-cached route (`app/api/iss-tle`) that fetches a
CelesTrak TLE at most once every two hours (plus once per build), so a visitor's browser never
talks to a third party and the ISS simply doesn't draw if that fetch ever
fails. `/` is the paper and carries ~95% of the site:
masthead (name, tagline, abstract, the sampled author photo, the paper-status
stamp, and a bordered "Supplementary material" box beneath it naming what's in
`/lab`), Table 1, three research figures (the label-efficiency
sweep with a mask strip, the pannable Dice CDF, the synthetic flight-day map),
the two live demos (the chess engine, then draw-a-digit, which leads with its
claim that the label guess needs no classifier model: the diffusion model
classifies by reconstruction), the experience board, references, and the
footer's stargaze door. `/lab` is the supplementary material: the trajectory
viewer, MAE-vs-I-JEPA retrieval, and a hand-built (and labeled)
DDPM-vs-flow-matching illustration.

## Layout

```
app/               routes (/, /lab, 404), globals.css (@theme tokens; no tailwind.config)
components/
  manuscript/      the design system: Sheet, Row/Note, InstrumentFigure, NightSky, StargazeToggle, TrackedLink, …
    night-sky/     NightSky's modules: state, painter, frame loop, pointer, cards, list panel, loaders, rings, invite
  figures/         the research figures + headshot toy, and shared mask-paint
  *.tsx            the demo panels (ChessPanel, DrawDigit, JepaPanel, …)
lib/               loaders, encoders, vendored model math (never reimplemented), track.ts
content/copy.ts    every visitor-facing string
public/            committed model artifacts and figure data
scripts/           gates, generators, verification
external_materials/  gitignored source data the figures are derived from
```

Runtime deps are exactly `chess.js`, `onnxruntime-web`, `@vercel/analytics`,
`@vercel/speed-insights` and `satellite.js` (SGP4 for the live ISS,
lazy-loaded only after the ISS route returns a TLE). No component libraries.
Every model imports ORT through the `onnxruntime-web/wasm` entry: the
`/webgpu` and bare entries fetch wasm builds that JavaScriptCore runs away
on, which is what crashed the draw demo on every iPhone until 2026-09-16
(`scripts/probe-webkit-draw.py` is the WebKit measurement).

## Analytics

Vercel Web Analytics: cookieless page views from `<Analytics />` in
`app/layout.tsx`, plus three custom events defined only in `lib/track.ts`:
`outbound_link {label}` (Resume, GitHub, ORCID, Email, references),
`demo_used {demo}` (once per demo per page load, after real output; stargaze's
also carries `via`, toggle or footer) and `page_reload` (a load whose
navigation type is reload: the one field signal a silent tab crash leaves).
Speed Insights (`<SpeedInsights />`) reports Core Web Vitals. Both have to be
enabled on the project in the Vercel dashboard, and custom events need the Pro
plan. Nothing is recorded locally; the verify suite reads the pending
`window.vaq` queue instead.

## Hand-run generators (never wired to prebuild)

| script | what | needs |
|---|---|---|
| `prepare-research.mjs` | derives `public/research/` from the paper's data; asserts the headline number before writing; `--image N` (retired wipe), `--eff-image N` (Figure 1 strip), `--accept-csv-drift` (required: SAM's re-run masks are stochastic) | ffmpeg, `external_materials/` including `paper1/data/test_predictions/` (ships as base64-encoded `test_pred.zip`) |
| `pull-resume.mjs` | copies the resume PDF from the private `NeelayRanjan/SAVE` repo to `public/resume.pdf` (the site serves it; a private repo can't). `--ats` pulls the plain variant | `gh` with repo scope |
| `gen-icons.py` | the STIX-N favicon set from site tokens; installs to `public/` (favicon.ico, icon-192.png, apple-icon.png), declared in `layout.tsx`, never through `app/` icon files (their URLs change every deploy) | python venv (fontTools, cairosvg) + the STIX variable TTF (see header) |
| `gen-og.mjs` | screenshots the top of the page into `public/og.png`; rerun after any masthead copy or layout change | Playwright, server on :3000 |
| `probe-webkit-draw.py` | drives one stroke, classify and generate in a real WebKit and samples the web process's RSS and CPU through a minute of idle; rerun after bumping `onnxruntime-web` or changing which ORT entry any loader imports | system WebKitGTK 4.1 + python gi, a display, server on :3000 |
| `measure-mono.mjs` | measures a mono's advance (why the ASCII grids keep Geist Mono) | Playwright, dev server |
| `prepare-sky.mjs` | derives `public/sky/sky.json`, the star catalog behind every page, from a commit-pinned d3-celestial | network access to GitHub raw |
| `prepare-sky-objects.mjs` | derives `public/sky/objects.json` and `public/sky/milkyway.json` from pinned d3-celestial data, JPL Horizons (Voyager positions on the run date), the archived IMO 2026 calendar and a pinned Wikipedia revision | network access (GitHub raw, ssd.jpl.nasa.gov, web.archive.org, en.wikipedia.org) |
| `prepare-sky-images.mjs` | derives `public/sky/images/` (one licensed WebP per deep-sky object, planet, the Moon, the ISS, the Milky Way, plus `index.json` with author, license and a pinned sha1) from `scripts/sky-image-picks.json`, via the Wikimedia Commons API; refuses any license outside its allow-list; `--repin` accepts an upstream file change | network, ffmpeg |

Outputs are committed; Vercel never runs any of these.

## Things that will bite you

**COOP/COEP headers on every route** (`next.config.ts`) give WASM threads
(draw's classifier: ~1s vs ~17s without). Any future cross-origin
image/script/iframe needs CORP headers or `crossorigin="anonymous"`.

**`/models/*`, `/ort/*`, `/headshot/*` are cached immutable for a year**:
filenames are the cache key, so a retrained model must ship under a new name.
**`/sky/images/*` is deliberately NOT in that list**: `next.config.ts` sets
no immutable header for it, so a regenerated pick under the same filename
(a re-pin, a cropped-differently rerun) reaches returning visitors instead
of being stuck behind a year-long cache.

**The metrics CSV's `image_index` is not the image id.** Mask filenames and the
benchmark are id-space; the CSV is index-space; each run's
`per_image_metrics.csv` is the bridge. A filename-to-CSV join silently pairs
the wrong images.

## The real documentation

`CLAUDE.md` is the working design document: the constitution (never fake a
model's output; a control is honest or absent), the content facts the copy is
bound to, every demo's contracts and traps, the figure data pipeline, the open
items, and the measured numbers, several of which contradict a reasonable
guess. Read it before changing anything with a comment that sounds defensive;
the comment is probably load-bearing. `docs/v1-design-notes.md` is the v1
archive; `docs/superpowers/` holds the redesign's original spec and plan
(history, superseded where CLAUDE.md disagrees).
