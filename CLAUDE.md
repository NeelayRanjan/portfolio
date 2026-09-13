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
live-sampled author photo, the UNDER REVIEW stamp linking `/lab` through a
"pending additional materials" sub-line, identity links) → Table 1 → Research
(Figure 1 wipe, Figure 2 Dice CDF, Figure 3 flight map) → the live demos as
Figures 4–5 → Experience as Figure 6 (NASA and Regenstrief lamps green/active)
→ References. `/lab` holds S1–S3. Same-day post-launch passes: the wipe moved
to image 330 with the owner's green-x0/red-SAM legend; Figure 2 rebuilt from a
budget ladder into the paper's pannable Dice CDF; the flight video's dark-map
treatment; the owner's STIX-N favicon set; headshots presented
last-class-first (photo 2 is the default face).

**Verification: `scripts/verify-redesign.mjs`** — 14 named checks,
Playwright-Firefox against a real `npm run build && npm start` on :3000, never
the dev server; pass check-name substrings as args to run subsets. Covers the
desk field (motion / reduced-motion / absent below 880px), no horizontal
scroll at 400px on both pages, nothing model-sized before scroll, the wipe's
endpoints, the Dice-CDF slider (curves, readouts vs `cdf.json`, repaint on stop
change), flight video play/pause, a drawn stroke producing a real auto-label,
the chess hint matching vector D (`g3 p=0.236`), JEPA seed query 834 plus the
triple-equality, and the headshot toy (no model fetched at rest; the sampled
canvas pixel-matches the pressed photo, with the other two photos as asserted
controls). Run it after any change touching a demo, a figure, or the page
shell. `scripts/check-voice.mjs` gates every copy.ts edit.

**Open items, roughly in order:**
1. **The Pi claim needs the owner.** `systems.chess.searchNote.post` says "The
   Pi gets through its 500 sims in about 2 seconds" — owner-authored in v1,
   carried on that authority, unsourced in this file (and the browser's own
   numbers make it look very fast). Confirm or cut; do not soften it into a
   different unsourced claim.
2. **arXiv link** (~2026-09-18) swaps into the references when the preprint is
   live; the owner then creates a Google Scholar profile, which joins the
   identity links (the link list is data-driven copy).
3. **A regenerated `predictions_cache`** (more images, real tail cases, runs
   matching the CSV seeds) would substantially strengthen Figures 1–2 — see
   the research-figures section for today's limits.
4. The mobile draw-demo bugs (Known bugs below) are open.
5. `public/research/label_efficiency.json` is computed, committed, and
   currently unrendered — free material for a future figure.
6. Much later: a third headliner demo, a **live network-security honeypot**
   (exposed Pi, malicious ssh/https logged, LLM-categorized into a live UMAP
   of attack families). Needs a live-data seam the static site doesn't have;
   the systems figure column is trivially appendable when it comes.

Deadline context: MS application season (materials due ~Nov 2026); the site
and the owner's SOP tell one story.

## Mission and audience (settled)

- Audience: industry recruiters AND masters admissions committees. **Admissions
  wins conflicts.** Visitor actions that matter, in order: open the resume, read
  the paper.
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
  attention grab (v1 finding: visitors never discover it's draggable).
- **Dark theme, fixed.** Palette and fonts **roam freely** — the owner dislikes how
  v1 uses the indigo/teal palette (likes the hues in isolation, not the usage).
- **First person** copy ("I build…"). `content/copy.ts` remains the single copy
  seam; every word gets rewritten.
- **Interactivity bar**: prose sections stay readable — no forced gimmicks — but
  every text section carries one real-work artifact beside it: bio → headshot
  diffusion toy · research → x0-vs-SAM slider · experience → flight-day video ·
  publications → figure hovers. The owner's rule: "at no point should the user
  just be staring and reading at something."
- Fallback is the git tag `v1`, nothing more. No legacy subdomain.
- **Figure colour conventions (owner calls, 2026-09-12): green = x0-diffusion**
  (and true "active" states), **red = SAM** (and reviewer's ink: the stamp, the
  headline numeral, alerts/misses), **amber (`warm`) = instrument readouts**,
  the flight blips, ResNet-UNet's dotted curve, **link-blue = hyperlinks** and
  ViT-DPT where it appears. The spec-era "red marks the x0 finding" rule is
  dead; the spec file records history, this file records now.
- The UNDER REVIEW stamp doubles as the `/lab` link; the dotted-underlined
  "pending additional materials" sub-line carries the affordance.
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
  (Ranjan, Dev, Gonzalez). **Under review at JAMIA** — say exactly that, never
  "published". arXiv preprint from ~2026-09-18. The numbers: **Dice 0.882 at 16
  labels, beating all five baselines in all 25 paired runs; ~75% measured surgeon
  correction-time speedup; the claim is label efficiency, not peak accuracy.**
  (v1's "80% Dice at 19 images" was an older result. Do not reuse it.)
- **IEEE MWSCAS 2026** (co-author; led the PCB design team): delivered as an
  **oral**, August 11 2026, Cincinnati. 15 authors, Neelay 14th — cite as
  "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), IEEE
  MWSCAS 2026 (oral)". Don't claim IEEE Xplore indexing until confirmed.
- **Education**: B.S. Artificial Intelligence, Purdue (Indianapolis campus),
  Intelligent Control & Systems concentration, math minor, John Martinson Honors
  College, GPA ~3.7. **On leave Fall 2026 for NASA; returns January 2027;
  graduates May 2027.** (Not December 2026 — that's the stale file.)
- **NASA Ames is three engagements, presented as one arc**: Summer 2026 (SLAAC,
  space-launch/airspace coordination, Dr. Kapil Sheth) · Fall 2026, Aug 24–Dec 4
  (synthetic text-to-ATC-speech dataset; ATC speech→text→database pipeline,
  Stephen Clarke) · Summer 2027 (lunar digital twin, accepted, involves diffusion).
- Also real and usable: **Regenstrief** (Feb 2024 →; x0-diffusion vessel
  segmentation, synthetic angiogram pipeline, img2img CLIP for vessel locality;
  Dr. Andrew Gonzalez, Shantanu Dev) · **Davinci Wearables** (2025; agentic vLLM
  nutritional estimation from meal photos, <15% error) · **V2X aircraft-maintenance
  LLM lead** (two-stage RAG; hallucinations ~40% → ~5%) · **MRI birdcage**
  embedded/PCB team lead · the **chess EBM + solar Pi device** (v2 of a lost ESP32
  build; now stronger than its author).
- **Chess Elo phrasing stays honest**: "roughly 1900–2200 vs Stockfish's limited
  modes", never 2300+ flat. Quantization cost ≈ 0 (-14 ±59 Elo).
- **Links** (footer set is data-driven; Google Scholar joins after the preprint):
  - Resume: https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview
  - CV: https://docs.google.com/document/d/1mzXEobC6bxIV_SqX761EVrDTmsYtrbsA/preview
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
  them) and `onnxruntime-web` 1.27 (every model on the page). `playwright` is a
  devDependency (Firefox only installed) for canvas verification and the two
  artifact-rendering scripts.
- Deploy: Vercel, custom domain neelayranjan.dev. Repo is private
  (`NeelayRanjan/portfolio`).
- **⚠️ `/models/*`, `/ort/*` and `/headshot/*` are served `immutable` for a year**
  (`next.config.ts`). That makes filenames the cache key: a retrained model or a
  refreshed export MUST ship under a new filename (and the code path that loads it
  updated), or returning visitors keep the old bytes until the cache expires.
- **COOP/COEP headers on every route** (`next.config.ts`): they enable
  SharedArrayBuffer → multithreaded WASM. The draw demo's classifier needs them
  (~1s vs ~17s without); chess doesn't (measured: threads change nothing for a
  469K-param model). Consequence: any future cross-origin image/script/iframe
  needs CORP headers or `crossorigin="anonymous"` or it's blocked outright.
- `scripts/sync-ort.mjs` (wired to `predev`/`prebuild`) copies ORT's wasm into
  `public/ort/` — version-locked to the JS, so bumping `onnxruntime-web` without it
  fails at runtime. It copies the **asyncify** build because that is what ort-web
  1.27's webgpu entry actually fetches; a wrong build 404s and surfaces as the
  useless "no available backend found". If ORT changes what it fetches, the
  network tab names the file — don't guess.
- `scripts/gen-icons.py` (fontTools + cairosvg venv; fetches the STIX variable
  TTF, see its header) and `scripts/gen-og.mjs` (Playwright) are **hand-run,
  never wired to prebuild** — Vercel's image has neither toolchain. Their
  outputs are committed. The favicon is the owner's mark (2026-09-12): STIX "N"
  in ink on the paper tile with stamp-red corner brackets; edit the script's
  token constants and re-run rather than hand-editing the four app/ icon files. The OG card screenshots the live hero, so it must be
  regenerated when the new hero ships; `metadataBase` in `layout.tsx` is required
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
- **`ctx.font` silently ignores CSS variables** (invalid assignments don't throw,
  they keep the old font). Anything canvas that needs the page's font must resolve
  the family via `getComputedStyle` or a DOM probe + ResizeObserver first.
- **The CSS `ch` unit is the advance of `0`** and over-counts by ~30% in
  proportional type: v1 measured `54ch` ≈ 70 real characters, `68ch` ≈ 88.
- **Headless Firefox is not a browser for timing**: no WebGPU adapter, ~20x slower
  ONNX inference than the same machine natively. Verify UX timing in a real
  browser; quote only measured numbers.
- **Dev-server red herrings**, all confirmed harmless: the dev overlay loads its
  own Geist copies and triggers font-preload warnings (production: zero); a
  hydration error in a dev log right after a Fast Refresh full reload is not
  evidence of a bug; `next build` drops a raw `chess-worker.<hash>.ts` served as
  `video/mp2t` that is never fetched. Confirm suspicions against
  `npm run build && npm start`, not the dev server.
- **Playwright's Firefox lacks `screenshot({omitBackground})`** — the icon script
  rasterizes via canvas `toDataURL` instead.

## The demos — contracts and traps (these carry into the redesign)

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
- **The classifier and generate share one ORT session; running both at once
  corrupts it.** The mutual exclusion runs through `classifyingRef` (synchronous,
  not state). Respect it in any rebuild of this panel.

### Headshot diffusion (the author photo) — page 1's masthead
- The bio's signature piece: the photo is a live sample, not a file. A
  deliberately-overfit class-conditional x0 model (1.31M params, 128², cosine
  T=1000, DDIM-25) of three approved crops. Overfitting is also the safety
  property: it can only produce faces the owner approved, never a novel one.
- Pieces: `lib/headshot-diffusion.js` is **vendored verbatim** (all the math:
  schedule, DDIM step, timestep sequence, clamp) with `lib/headshot-diffusion.d.ts`
  hand-typed beside it; `lib/headshot-model.ts` owns loading;
  `components/figures/HeadshotFigure.tsx` is the server gate and
  `components/figures/HeadshotToy.tsx` the client UI. Pinned by the bundle's own
  parity test against this repo's ORT: **max|Δ| 6.71e-6**.
- **Three integrator rules, all silent failures if broken**: the site never
  passes `t` (module-internal, raw 0..999); `xt` frames are UNBOUNDED and get
  clamped for display; `x0` and the returned final sample are ALREADY clamped
  and must not be clamped again.
- **Nothing model-related is fetched at rest.** The masthead is first paint, so
  the box is a plain `<img>` until a face is pressed; the first press starts ORT
  + the weights (`loadHeadshotModel`, memoized, same `onnxruntime-web/webgpu`
  specifier as draw/chess so the runtime is shared). Deliberately NOT in
  `lib/warm.ts`: the warm window is spent on the runtime the two big demos share.
- int8 (1.55 MB) with an fp32 fallback if a runtime rejects the quantized graph,
  and the readout names which build loaded. Same ruling as chess: losing the
  "int8" label costs nothing, a dead button costs everything.
- Gate reads `k` and `res` out of `headshot_meta.json` and checks each class has a
  served photo, so a retrained export with four photos grows a fourth button with
  no code change. Canvas backing store is `res` and CSS upscales with DEFAULT
  smoothing (the opposite of the draw demo's `pixelated` grids) — softness at
  256px is expected.
- Every press is fresh noise, so the route differs and the photo doesn't:
  verified in-browser that two runs of one class are not byte-identical. All
  controls disable while a run is in flight (`runningRef`, synchronous).
- **Transition mode (built 2026-09-12, dormant until the v2 module lands).**
  The site is fully wired for SDEdit-style morphs: a cross-class press hands
  the previous COMPLETED run's final sample back as `init` and the module
  forward-noises it partway and descends into the new photo. Rules, all in
  code already: capability = the vendored module exporting `MODULE_VERSION
  >= 2`, read at load time via index access (⚠️ v1 silently IGNORES unknown
  generate() options, so option-passing is never the test; and a static named
  import of the flag fails the v1 build — Turbopack bind-checks it);
  first-press and `resample` and same-class presses stay from-noise (the
  demo's thesis + resample's meaning); init only from a completed run
  (failures clear it), defensive `.slice()` both directions, length-checked
  against `res`; `strength` is never passed (module default rules); the
  readout and caption swap to morph wording only when capable, so no state
  ever overclaims. When the v2 module file replaces `lib/headshot-diffusion.js`
  everything lights up with zero site edits — but demand its TRANSITION parity
  vector (init+strength case) in `vectors/` first; the forward-noising branch
  is unpinned vendored math until then. The verify check already exercises a
  second press and passes under both module versions.
- Measured in headless Firefox on a production build: 25 steps end to end
  ~15.5s including the download (a real browser is much faster; quote measured
  numbers only). Per-photo PSNR from the bundle: 29.3 / 24.0 / 21.1 dB — classes
  1-2 soften on busy backgrounds and that was approved at the human review gate.

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
  owner's 45MB asset mine — paper tarballs + metrics CSV, the NASA video, the
  headshot originals), absent on Vercel. Its outputs in `public/research/` are
  committed. **Assert-before-write**: the aggregate is computed first and
  nothing is written if x0diffusion@16-labels drifts from the paper's 0.882
  (±0.01).
- **⚠️ `--accept-csv-drift` is required, and it is not a formality**: the
  baselines' `predictions_cache` is a DIFFERENT training export than the CSV's
  runs (deeplabv3@32 computes 0.480 on an image whose four CSV seeds all sit
  above 0.90; x0's cache matches its CSV on all 10 cached images, which is
  what validates the pipeline itself). Every number the site shows is computed
  from the exact mask on screen, never a CSV mean; `provenance.json` is the
  audit trail.
- **Mask PNG polarity is PER-IMAGE, not a convention** (image 189's SAM mask
  was black-vessel-on-white, 330's is white-on-black; ViT's 16-label mask
  calls 67.7% of the frame vessel). The client (`components/figures/
  mask-paint.ts`) detects by minority side; the script votes per-model with an
  inset-ring rule and records the decision in `cdf.json`. Hardcoded polarity
  painted an entire background red once already.
- **Figure 1 (wipe, `WipeFigure.tsx`)**: image 330 (owner pick; 189 rejected as
  rough), fold1 16-label masks, x0 green over SAM red with an on-image legend,
  slider defaults to 50%. The caption's Dice pair is that image's computed
  values. Rerun: `node scripts/prepare-research.mjs --image N --accept-csv-drift`.
- **Figure 2 (Dice CDF, `DiceCdfFigure.tsx`)**: curves pooled from the CSV at
  **fraction 0.05 only** — pooling every fraction inverts the paper's model
  ordering, and the script's shape gate asserts shares-below-0.5 near
  0.3/5.4/13.5% (x0/SAM/ResNet) to match the paper's figure. Slider stops
  t=0.1..0.9 pick the cached image whose SAM dice is NEAREST t; only 10 images
  exist in the cache (SAM span 0.666–0.924), so low stops cannot land on the
  cursor's value and the copy says the cursor is a threshold. Panel Dice =
  computed from the shown pixels.
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
| `public/jepa/manifest.json` | 483 KB | JEPA bundle: labels, UMAPs, neighbours, metrics |
| `public/jepa/sprites.webp` | 3.6 MB | 4096 thumbnails, 64x64 atlas |
| `public/models/mnist_x0.onnx` | 26 MB | the pixel model, live draw-a-digit |
| `public/models/chess-int8.onnx` | 553 KB | the chess EBM |
| `public/models/chess-fp32.onnx` | 1.8 MB | chess fallback |
| `public/headshot/headshot_int8.onnx` | 1.55 MB | the headshot model, what the browser loads |
| `public/headshot/headshot.onnx` | 5.29 MB | headshot fp32 fallback |
| `public/headshot/headshot_meta.json` | 204 B | res/channels/k/schedule/steps — read, never hardcoded |
| `public/headshot/photos/{0,1,2}.webp` | 17/53/32 KB | the three approved crops, 512², q80, metadata stripped |
| `public/headshot/photos/{0,1,2}_thumb.webp` | ~2 KB each | 96² derivatives for the 44px face buttons (first paint) |
| `public/research/*` | ~1.7 MB | prepare-research outputs: wipe assets, `cdf/` stops, flight mp4 + poster, `cdf.json`, `label_efficiency.json`, `provenance.json` |
| `public/ort/*` | ~37 MB | onnxruntime-web wasm, vendored, **gitignored**, synced on prebuild |

The JEPA bundle is produced by
`export.py` in `~/Documents/embedding_jepa/` and copied verbatim; nothing in this
repo generates it. `public/headshot/` is copied verbatim out of
`~/Documents/headshot_diffusion/dist/` (the photos re-encoded to WebP q80 with
`-map_metadata -1`); the bundle's `vectors/` and `*_128.png` training inputs stay
out of `public/`. Git LFS: settled, not needed (~42 MB tracked binaries).

## Known bugs — open on the live site

Inherited from v1's draw demo; both code paths survived the re-chrome intact:
1. **Mobile: drawing wiped when scrolling to hit generate.** `DrawDigit`'s
   resize handler re-runs `setup()`, which resets the canvas buffer; mobile
   scroll collapses the URL bar → viewport height changes → resize fires. Fix
   shape: re-setup only on WIDTH change, or preserve ink across resizes
   (`components/DrawDigit.tsx`).
2. **Occasional mobile page reloads.** The 26MB draw model + ORT run on the
   MAIN thread (chess got a worker; draw never did); tab crashes under memory
   pressure reload silently. Fix shape: a draw worker mirroring the chess
   architecture, or accepting the cost on phones.

@AGENTS.md
