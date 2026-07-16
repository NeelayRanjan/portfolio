# neelayranjan.dev

Personal portfolio. One scrolling page, four interactive sections, three trained models
that run entirely in the browser.

Nothing here is faked. The digit trajectories are real exported samples, draw-a-digit runs
a 6.47M-param MNIST diffusion model client-side, and the chess section plays against the
same 553KB int8 energy-based model that runs on a Raspberry Pi. There is no backend and no
API: every forward pass happens on the visitor's machine.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

`predev` and `prebuild` both run `scripts/sync-ort.mjs`, which copies onnxruntime-web's
WASM binaries out of `node_modules` into `public/ort/`. That directory is gitignored and
regenerated, never committed: the binary is version-locked to the JS, so a stale copy
gives a runtime failure on the first model load rather than a build error. If you bump
`onnxruntime-web`, the copy happens automatically on the next dev or build.

```bash
npm run build        # production build
npm start            # serve the build
```

### Two things that will bite you

**COOP/COEP headers are set on every route** (`next.config.ts`). They turn on
cross-origin isolation, which is what gives WASM `SharedArrayBuffer` and multiple threads.
Without them a zero-shot classify takes ~17s instead of ~1s. The cost is that any
cross-origin image, script or iframe added later needs CORP headers or
`crossorigin="anonymous"`, or the browser blocks it outright. Safe today: fonts are
self-hosted by next/font, and the only external URLs are `<a href>` links.

**Turbopack has served stale CSS**, silently, for hours. If an edit to `globals.css`
appears to do nothing, `curl` the served `/_next/static/chunks/*.css` before doubting the
code. `rm -rf .next` and restart fixes it.

## Layout

```
app/            routes, globals.css (Tailwind v4 theme tokens live in @theme,
                there is no tailwind.config.ts)
components/     section components
  ambience/     swarm, CharField, boot screen, scroll spine, reveals
lib/            model loading, encoders, vendored model math
content/        copy and profile data
public/         model artifacts (see below)
scripts/        build and artifact generators
```

Dependencies stay minimal on purpose. No component libraries. Beyond Next and React the
only runtime deps are `chess.js` (every chess rule, never hand-rolled) and
`onnxruntime-web` (every model on the page).

## The sections

| section | what it is |
|---|---|
| `#diffusion` | Precomputed trajectories from two trained models, pixel and discrete. Real exported output. |
| `#draw` | Live SDEdit. You draw, the model dissolves it and re-forms it, streaming as it computes. |
| `#chess` | The int8 EBM, playable, plus a precomputed interpretability view of its internals. |
| `#sample-space` | DDPM vs flow matching. Hand-built and labelled illustrative, not a model. |

The line between real and illustrative is load-bearing. Keep the copy honest about which
is which.

## Model artifacts

All of these are committed and ship to Vercel. Roughly 31MB tracked.

| path | size | what |
|---|---|---|
| `public/diffusion_traj.json` | 3.0 MB | pixel trajectories, 10 digits x 32 frames |
| `public/ascii_traj.json` | 586 KB | discrete/mask trajectories, same shape |
| `public/chess_activations.json` | 43 KB | saliency + layer activations, 8 curated positions |
| `public/models/mnist_x0.onnx` | 26 MB | the pixel model, for live draw-a-digit |
| `public/models/chess-int8.onnx` | 553 KB | the chess EBM, the Pi's exact artifact |
| `public/models/chess-fp32.onnx` | 1.8 MB | chess fallback if a runtime rejects the int8 graph |
| `public/og.png` | 508 KB | share card |
| `app/icon.svg` | 1.1 KB | the favicon's source of truth |

They come from two separate training repos and are exported by hand, not built here:

- **entropy-chess** produces both `.onnx` chess models. `lib/chess-encode.ts` is a port of
  its `training/encoding.py` and must match exactly. A wrong transform gives
  legal-but-terrible moves rather than an error, so there are four known-answer validation
  vectors (see `CLAUDE.md` §4). Re-run them if you touch the encoder.
- **The ascii-diffusion repo** produces `mnist_x0.onnx`, both trajectory JSONs, and
  `lib/ascii-diffusion.js` itself, which is vendored rather than reimplemented. It owns all
  the model math (preprocessing, schedule, sampler, guidance) and is pinned against a
  PyTorch reference. `lib/ascii-diffusion.d.ts` types it by hand, so re-check that when a
  new version lands.

If an artifact is missing, the feature gates on its absence and says so in the UI. Do not
add a placeholder generator: the old one wrote to the same path as the real export, so
running it would have destroyed 3MB of trained data.

## The generator scripts are hand-run

`scripts/gen-icons.mjs` and `scripts/gen-og.mjs` both need a Playwright browser binary,
which Vercel's build image does not have. **Do not wire either to `prebuild`** the way
`sync-ort.mjs` is, or the deploy goes down regenerating files that only change when their
source does. Run them by hand and commit the output.

```bash
node scripts/gen-icons.mjs   # app/icon.svg -> icon.png, apple-icon.png, favicon.ico
node scripts/gen-og.mjs      # needs a dev server on :3000; screenshots the live hero
```

`gen-og.mjs` captures a real frame of the settled particle swarm rather than a mockup, so
it waits 7s for the anneal.

Playwright is also how canvas work gets verified. An HTTP 200 proves nothing about whether
particles resolved into a name or a model returned a digit, so screenshot it.

## Deploy

Vercel, zero config. It runs `npm run build`, which fires `prebuild`, which regenerates
`public/ort/`. Custom domain `neelayranjan.dev`.

`metadataBase` in `app/layout.tsx` is required, or the relative `/og.png` never resolves
and the card unfurls with no image.

## Notes for future work

`CLAUDE.md` is the real design document: what every decision was, what was tried and cut,
and which numbers were measured rather than guessed. Several of them contradict a
reasonable guess. int8 is not faster than fp32 (its win is download size). Zero-shot
classification wants *more* noise, not less. ORT fetches the `asyncify` build, not the
`jsep` one the WebGPU naming implies.

Read it before changing anything with a comment that sounds defensive. The comment is
probably load-bearing.
