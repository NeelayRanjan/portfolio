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
(Figure 1 label-efficiency sweep, Figure 2 Dice CDF, Figure 3 flight map) →
the live demos as Figures 4–5 (chess, then draw — swapped 2026-09-13 at the owner's call, the `n` props swapped with them) → Experience as Figure 6 (NASA and Regenstrief
lamps green/active) → References. `/lab` holds S1–S3. Same-day post-launch
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
Table-1 logic cut the name off once the headshot rail grew).

**Verification: `scripts/verify-redesign.mjs`** — 15 named checks,
Playwright-Firefox against a real `npm run build && npm start` on :3000, never
the dev server; pass check-name substrings as args to run subsets. Covers the
desk field (motion / reduced-motion / absent below 880px), no horizontal
scroll at 400px on both pages, nothing model-sized before scroll, the
label-efficiency sweep (readouts and the computed lead/trail sentence vs the
SERVED `label_efficiency.json` at the first and last budgets, including the
x0-leads→x0-trails flip, cursor exactly on the budget tick, whiskers tracking
the slider, and the strip's panels carrying the json's Dice and repainting per
budget), the Dice-CDF slider (curves, readouts vs `cdf.json`, repaint on stop
change), flight video play/pause, a drawn stroke producing a real auto-label,
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
`scripts/check-voice.mjs` gates every copy.ts edit.

**Open items, roughly in order:**
1. **The Pi claim needs the owner.** `systems.chess.searchNote.post` says "The
   Pi gets through its 500 sims in about 2 seconds" — owner-authored in v1,
   carried on that authority, unsourced in this file (and the browser's own
   numbers make it look very fast). Confirm or cut; do not soften it into a
   different unsourced claim.
2. **arXiv link** (~2026-09-18) swaps into the references when the preprint is
   live; the owner then creates a Google Scholar profile, which joins the
   identity links (the link list is data-driven copy).
3. **A transition parity vector for the headshot bundle.** The morph is live on
   the site, but `test_parity.mjs` pins only the from-noise path; its
   `init+strength` case is a structural smoke (step count + finiteness), so the
   forward-noising branch is unpinned vendored math. Ask the model owner for an
   init+strength case in `vectors/`.
4. The mobile draw-demo bugs (Known bugs below) are open.
5. Much later: a third headliner demo, a **live network-security honeypot**
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
  them), `onnxruntime-web` 1.27 (every model on the page) and
  `@vercel/analytics` 2 (see Analytics below). `playwright` is a
  devDependency (Firefox only installed) for canvas verification and the two
  artifact-rendering scripts.
- Deploy: Vercel, custom domain neelayranjan.dev. Repo is private
  (`NeelayRanjan/portfolio`).
- **Analytics (wired 2026-09-13): Vercel Web Analytics.** `<Analytics />` in
  `app/layout.tsx` records cookieless page views (client navigations
  included). Custom events live ONLY in `lib/track.ts`, deliberately two:
  `outbound_link {label}` on every identity and reference link (via the
  `TrackedLink` client leaf, so Masthead/References stay server components;
  `onAuxClick` catches middle-click), and `demo_used {demo}` once per demo
  per page load, fired only AFTER real output (a completed headshot run, a
  completed digit generation, an accepted chess move) so failures and
  slider-scrubbing never count. Quota-conscious on purpose: don't add
  per-interaction events. ⚠️ Production loads the tracker SAME-ORIGIN from
  `/_vercel/insights/script.js`, which is why COEP never blocks it; dev mode
  loads a debug copy from va.vercel-scripts.com, which works only because that
  host sends `cross-origin-resource-policy: cross-origin` (measured). Locally
  the insights path 404s, so events wait in `window.vaq` forever, and that
  queue is what the verify check reads; real delivery is only visible in the
  Vercel dashboard, and Web Analytics must be ENABLED there or production's
  script 404s too. Whether custom events are ingested depends on the plan
  (unconfirmed from here); page views work on every plan.
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
  + the weights (`loadHeadshotModel`, memoized, same `onnxruntime-web/webgpu`
  specifier as draw/chess so the runtime is shared). Deliberately NOT in
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
  It exists because the Playwright check's 400px viewport always lands on the
  128, so nothing else in the repo ever touches the primary. It drives the
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
