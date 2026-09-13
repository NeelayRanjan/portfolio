# neelayranjan.dev

Personal portfolio, styled as a dark preprint: a sheet on a live particle-field
desk, research rendered as interactive figures, and trained models running
entirely in the visitor's browser. Shipped 2026-09-12; the previous
faux-terminal site lives at git tag `v1`.

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
node scripts/verify-redesign.mjs           # all 15 checks, against npm start on :3000
node scripts/verify-redesign.mjs chess cdf # any check-name substrings run a subset
node scripts/verify-headshot-256.mjs       # hand-run: the 256 headshot + morph, in node
node scripts/check-voice.mjs               # copy.ts voice gate (banned words, em-dashes)
```

The suite is Playwright-Firefox against a real production build and asserts
behavior, not HTTP 200s: the desk field pauses under reduced motion, the chess
hint returns validation vector D, the sampled headshot pixel-matches the photo
that was pressed, the label-efficiency readouts match the served JSON, and a
Resume click queues the analytics event production would send.

## The pages

`/` is the paper and carries ~95% of the site: masthead (name, tagline,
abstract, the sampled author photo, the UNDER REVIEW stamp linking `/lab`),
Table 1, three research figures (the label-efficiency sweep with a mask strip,
the pannable Dice CDF, the synthetic flight-day map), the two live demos (the
chess engine, then draw-a-digit), the experience board, references. `/lab` is
the supplementary material: the trajectory viewer, MAE-vs-I-JEPA retrieval,
and a hand-built (and labeled) DDPM-vs-flow-matching illustration.

## Layout

```
app/               routes (/, /lab, 404), globals.css (@theme tokens; no tailwind.config)
components/
  manuscript/      the design system: Sheet, Row/Note, InstrumentFigure, DeskField, TrackedLink, …
  figures/         the research figures + headshot toy, and shared mask-paint
  *.tsx            the demo panels (ChessPanel, DrawDigit, JepaPanel, …)
lib/               loaders, encoders, vendored model math (never reimplemented), track.ts
content/copy.ts    every visitor-facing string
public/            committed model artifacts and figure data
scripts/           gates, generators, verification
external_materials/  gitignored source data the figures are derived from
```

Runtime deps are exactly `chess.js`, `onnxruntime-web` and `@vercel/analytics`.
No component libraries.

## Analytics

Vercel Web Analytics: cookieless page views from `<Analytics />` in
`app/layout.tsx`, plus two custom events defined only in `lib/track.ts`:
`outbound_link {label}` (Resume, CV, GitHub, ORCID, Email, references) and
`demo_used {demo}` (once per demo per page load, after real output). Web
Analytics has to be enabled on the project in the Vercel dashboard. Nothing is
recorded locally; the verify suite reads the pending `window.vaq` queue instead.

## Hand-run generators (never wired to prebuild)

| script | what | needs |
|---|---|---|
| `prepare-research.mjs` | derives `public/research/` from the paper's data; asserts the headline number before writing; `--image N` (retired wipe), `--eff-image N` (Figure 1 strip), `--accept-csv-drift` (required: SAM's re-run masks are stochastic) | ffmpeg, `external_materials/` including `paper1/data/test_predictions/` (ships as base64-encoded `test_pred.zip`) |
| `gen-icons.py` | the STIX-N favicon set from site tokens | python venv (fontTools, cairosvg) + the STIX variable TTF (see header) |
| `gen-og.mjs` | screenshots the top of the page into `public/og.png`; rerun after any masthead copy or layout change | Playwright, server on :3000 |
| `measure-mono.mjs` | measures a mono's advance (why the ASCII grids keep Geist Mono) | Playwright, dev server |

Outputs are committed; Vercel never runs any of these.

## Things that will bite you

**COOP/COEP headers on every route** (`next.config.ts`) give WASM threads
(draw's classifier: ~1s vs ~17s without). Any future cross-origin
image/script/iframe needs CORP headers or `crossorigin="anonymous"`.

**`/models/*`, `/ort/*`, `/headshot/*` are cached immutable for a year**:
filenames are the cache key, so a retrained model must ship under a new name.

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
