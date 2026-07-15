# CLAUDE.md — neelayranjan.dev

Personal portfolio for an AI/ML researcher (NASA Ames, Regenstrief Institute). The
site should read as *generative-modeling researcher*, with a few genuinely interactive
pieces that visualize the actual work.

**The demos are real, and that is the entire point of the site.** Three trained models
now run client-side: an MNIST pixel diffusion model, an absorbing-state discrete
diffusion model, and a 553KB int8 chess EBM. Nothing is faked, and nothing should be:
a plausible-looking stub teaches visitors the wrong thing about how the work behaves,
which costs more than an empty section would. When a model isn't ready, gate the
feature on its file's absence and say so in the UI (see §2b's history).

Everything hides behind a clean seam so a retrained model drops in without touching UI.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + React 19
- Tailwind v4 — theme tokens live in CSS via `@theme`, there is no `tailwind.config.ts`
- Deploy target: Vercel (zero-config; custom domain `neelayranjan.dev`)
- Keep dependencies minimal. No component libraries. The only runtime deps beyond
  Next/React are `chess.js` (all chess rules — never hand-roll them) and
  `onnxruntime-web` (every model on the page). `playwright` is a devDependency, used
  to verify canvas work: "HTTP 200" proves nothing about whether particles resolved
  into a name or a model returned a digit.

**Turbopack has served stale CSS at least once**, for hours, silently: an edit to
`globals.css` never compiled and the browser kept the old rule, which made a correct
fix look like it did nothing. If a CSS change appears to have no effect, check the
served chunk (`curl` the `/_next/static/chunks/*.css` URL) before doubting the code.
`rm -rf .next` and restart fixes it.

## Aesthetic — "latent space"

- Near-black background: `#080a12`. One indigo accent (`#8f88dd`) and one teal accent (`#5dcaa5`). Clean sans type, generous whitespace.
- The hero is the migrating particle swarm (see §1) — the one deliberately loud
  element. Everything below it stays quiet.
- Two type weights only (400 / 500). Sentence case everywhere. No gradients, no drop shadows, no glow.
  (The swarm rasterizes its text masks bold purely to give the sampler more ink — no
  bold type is ever displayed, so the two-weight rule holds.)
- Mobile: everything must degrade gracefully and stay fast. Lazy-load anything heavy; pause canvas animations off-screen.

## Voice — write like a person, not a model

Applies to **all visitor-facing copy**: headings, ledes, captions, notices, boot-log
lines, alt text, metadata. (Code comments and this file are for maintainers and are
exempt.) The audience is researchers who read a lot of LLM output and clock it
instantly. Copy that pattern-matches to "written by ChatGPT" undercuts the whole site,
which is about the work being real.

**Punctuation**
- **No em-dashes (—).** The single loudest giveaway. Use a comma, a period, a colon, or
  parentheses. If a sentence needs an em-dash to hold together, it wants to be two
  sentences.
- No en-dashes as connectors either. Ranges (7–11s) are fine.
- Avoid the rhetorical colon-then-payoff every other sentence.

**Banned words and phrases** (non-exhaustive; the smell is what matters)
- delve, dive into, unlock, unleash, harness, leverage, elevate, empower, foster
- seamless, robust, cutting-edge, state-of-the-art, game-changing, revolutionary
- showcase, testament, tapestry, realm, landscape (as metaphor), journey (as metaphor)
- crucial, pivotal, vital, meticulous, comprehensive, holistic, nuanced
- vibrant, bustling, rich (of an abstraction), profound
- "it's worth noting", "it's important to note", "in today's world", "at its core"
- "let's explore", "join me", "buckle up"

**Banned constructions**
- **"Not just X, but Y."** And its cousins: "isn't merely X, it's Y", "more than just X".
- **Rule-of-three padding**: "fast, elegant, and powerful". Two is usually a lie about
  needing three. Cut to the one that's true.
- Antithesis scaffolding: "It's not about X. It's about Y."
- Rhetorical questions the copy then answers.
- "In conclusion", "Ultimately", "At the end of the day".
- Starting a sentence with "Indeed" or "Moreover".

**Positive rules**
- Concrete numbers beat adjectives. "80% Dice at 19 labeled images" says more than
  "strong performance in low-data regimes".
- Say the surprising thing plainly and stop. Don't restate it in a summary sentence.
- Sentence case everywhere (see Aesthetic). Contractions are fine and help.
- Hedge only where there's real uncertainty (see the Elo note in
  `content/resume-notes.md`). Don't hedge as a verbal tic.
- Read it aloud. If it sounds like a press release or a LinkedIn post, rewrite it.

## Recurring motif — faux-terminal panels

Interactive elements render inside terminal-style panels:
- A title bar with three dots (red/amber/green) and a monospace label.
- Body content drawn as ASCII art / simple sprites where possible, monospace, on the dark panel bg.

Build two reusable primitives first, before any section:
1. `TerminalPanel` — the chrome (dot bar + label + content slot).
2. `AsciiGrid` — takes a 2D array of `0..1` intensities and renders a monospace character grid using the ramp `" .:-=+*#%@"` (intensity → ramp index). This one renderer is reused by the diffusion visualizer and the chess board sprites. Keep font-size ≥ 11px, tight line-height, slight letter-spacing so cells read roughly square.

## Page ambience

Keeps the page from being flat-black below the hero while staying CALM so content
leads. **Motion lives in the swarm (§1) and the interactive demos, and nowhere else.**

> **Amended 2026-07-15, deliberately.** This section used to say "never add a second
> animated full-page background." The migrating swarm IS one: a fixed, full-viewport
> canvas that runs the whole time you're on the page and cannot use the off-screen
> pause everything else does. That was an explicit owner decision to trade some of the
> calm-below-the-hero property for the swarm following you down the page. It is the
> ONE exception. Don't read it as licence for a second one.

**1. Base layer** (`app/globals.css`, on `body`) — static dot-grid, near-zero cost:
```css
background-image: radial-gradient(rgba(159,225,203,0.05) 1px, transparent 1px);
background-size: 22px 22px;
```
Reads "engineering graph paper," not empty void.

**2. Diffusion-timestep rail** (`components/ambience/TimestepRail.tsx`) — a thin fixed
line in the left margin. Top = `x_T · t=1000`, bottom = `x̂₀ · t=0`; a tick and a
mono label track scroll and count the timestep *down*. Conceit: the whole page is one
reverse-diffusion pass, noise at the hero to resolved at the footer.
- Driven by `scrollY / scrollable height`, never a timer.
- Line `--color-rail` (rgba(93,202,165,0.14)); tick indigo; endpoint labels
  `--color-rail-label` (#3f8f78); current-t label indigo.
- Writes through refs in a rAF-coalesced scroll handler — a `setState` per scroll
  event would re-render the page tree 60x/sec to move a 1px line.
- Hidden below `xl`, where there's no margin to live in.
- The tick tracks scroll 1:1 with **no easing**, so it has no motion of its own to
  disable under reduced-motion — it's a readout, like a scrollbar.

**3. Per-section accents** — contained, static, faint. NOT full-section backgrounds.
- `DenoiseGlyph` — a few rows of `" .·:-=+*"` resolving noise→structure, in a section
  corner at opacity ~0.16. Seeded per section (`glyphSeed`), never `Math.random()`:
  it renders on server and client, and a mismatch would trip hydration.
- Node-graph watermark behind the multi-agent/consensus section — **not built yet**,
  that section doesn't exist. Wire it in with the section.
- Board-grid watermark behind the chess section — **not built yet**, same reason.

**4. Scroll reveals** (`components/ambience/Reveal.tsx`) — opacity + ~12px translateY
over ~500ms via IntersectionObserver, one-way (never re-hides). The hidden state lives
in CSS (`.reveal`), so the server renders final markup and JS only flips
`data-shown`. A `<noscript>` override in `layout.tsx` un-hides everything if JS never
runs — otherwise the whole page is blank without it.

**5. Film grain** — one fixed `body::after` layer of static SVG turbulence
(desaturated, opacity 0.035, `pointer-events: none`). Rasterized once by the browser
and composited thereafter; no animation, so nothing to disable under reduced-motion.

**Accessibility / performance.** Under `prefers-reduced-motion`: reveals show
outright, and nothing else animates by construction — the dot-grid, rail, accents and
grain all stay. Every accent is `aria-hidden`, non-focusable, and carries no text a
screen reader needs.

## Terminal boot sequence

Each demo section is its own faux-terminal. On scroll-in it types a command, prints a
few lines of output, then reveals the demo — `components/ambience/BootLog.tsx`
(`useBootSequence` hook + `BootLog` view).

The section's heading and lede fold *inside* the panel, after the boot log, rather
than sitting above it. `Section` renders `title`/`lede` only for prose sections.

It is not just theatre — **the demo mounts only once `done` flips**, so each section's
heavy work (the 231KB trajectory JSON, chess.js, a model) starts when its panel is
reached rather than all at once on load.

Under `prefers-reduced-motion` the typing is skipped and the boot resolves instantly —
but **still gated on IntersectionObserver**. The deferral is a loading strategy, not an
animation; reduced-motion users must not eat every section's payload up front.

## Sections (single scrolling page)

### 1. Hero — migrating particle swarm  *(`components/ambience/Swarm.tsx`)*
One fixed, full-viewport canvas behind the page content. Particles do Langevin descent
into wells carved from whatever text the ACTIVE station declares, and re-target as you
scroll: the nameplate at the top, then each section's label in the open gap above its
panel. `components/EnergyHero.tsx` is now only markup — the real `<h1>`, the sub-text,
the caption and the links. It owns no sim.

**Stations are declared in the DOM, not hardcoded.** Any element with `data-swarm` is a
station; its text is the attractor and its box drives placement and font size. Layout
owns where, Swarm owns physics. `Section` renders one via its `swarmLabel` prop.
- `data-swarm="NEELAY|RANJAN"` — `|` splits lines
- `data-swarm-align="left|center"`, `data-swarm-frac` — text width as a fraction of the box

**WHY THE GAPS, NOT THE HEADINGS.** The obvious idea is to assemble each section's
`<h2>`. It cannot work: the h2s live inside `TerminalPanel`, which is opaque
(`bg-panel`), and the canvas is behind the content. A station on a heading is invisible.
Stations go in open background. Don't "fix" this without also making panels translucent.

**Two stacking traps, both of which silently blank the swarm:**
- The canvas is `fixed ... -z-10`, which paints ABOVE html's background but BELOW any
  background `body` paints. **`body` must stay transparent** — the base colour and
  dot-grid live on `html`. Put a background back on `body` (or `bg-base` on the body
  element) and the swarm vanishes while the canvas keeps happily rendering to itself.
- The canvas is `pointer-events: none` and drag is handled on `document`, bailing on
  `section, a, button, input, textarea, select`. A full-viewport canvas that ate clicks
  would break every link and control on the page.

**Setup (per station).**
- Rasterize the text offscreen (bold sans, ~6px letter-spacing at 78px, scaled).
  measureText is linear in font size, so measure once at a reference and scale to target.
- **Energy grid: the cell size scales with the font** (`CELL_PER_FONT`). A fixed 5px cell
  resolves the 130px nameplate but smears a 48px label into one featureless well, and
  particles settle into an unreadable blob. Per-cell coverage → 3x3 box blur →
  `energy = 1 - min(1, coverage * 1.6)`. Low energy inside the letters.
- **Homes are OUTLINE points, not the filled interior**: an on-pixel with at least one
  off 4-neighbour. Particles then trace thin letterforms instead of clumping.
- Particle count = the largest station's. Smaller labels fade the excess out rather than
  stacking duplicates on one point.

**Per frame — Langevin descent with momentum.** Every constant is expressed *at 60fps*
and scaled by `k = dt / 16.67`; noise scales by `sqrt(k)` (it's Brownian). Not optional:
the kick schedule and the anneal run on wall-clock ms, so unscaled per-frame physics
drifts out of step with them — a slow device collapses late and gets kicked mid-flight,
a 144Hz one races.
- `T = max(0.22, 2.1 * exp(-age_ms / 1400))` — anneals on load.
- `force = -energyGradient*10 + (home - pos)*HOME_PULL*(1 - 0.7*heat) + noise*(T + heat*2.6)`
- Integrate: `vel = vel*0.82 + force*0.4; pos += vel*0.5; heat *= 0.94`.
- **`HOME_PULL` is 0.1, not the 0.02 the original spec gave.** Inside a letter the energy
  is flat, so its gradient is ZERO and the home pull is the only thing holding a particle
  on its outline. At 0.02 it loses to the `T=0.22` noise floor: the nameplate reads as
  fuzz and small labels are illegible outright.

**Migration.** On a station change, `transit` flips: a plain capped spring pulls
particles across the page, with the energy gradient and noise switched OFF (both are
meaningless that far from the box and just smear the trip). Normal Langevin resumes once
they land.

**Panel avoidance.** Panels are opaque, so a swarm crossing one disappears for the length
of the trip. `data-swarm-avoid` on `TerminalPanel` marks the obstacle; particles get
shoved **horizontally** out to the gutter. Horizontal, NOT toward the nearest edge: a
panel is far wider than it is tall, so "nearest edge" is usually the top, which shoves a
descending swarm back where it came from and stalls it. Gated on gutter width — under
~44px of margin there's nowhere to route to, so it switches off rather than flinging
particles off-screen.

**Disturbances.**
- **Thermal kicks** (~2.8–4.6s): a random home becomes the centre of a ~46–66px disc;
  particles whose *home* is inside re-shimmer. Suppressed while migrating.
- **Drag** (`GRAB_R` ~72px): held particles spring toward the pointer so the cluster
  bunches, underdamped so it bounces, with a soft core so the blob keeps volume instead
  of collapsing to a dot. Pointer velocity is injected, and bled off each frame —
  `pointermove` only fires while moving, so otherwise a parked cursor shoves forever.
  **Mouse/pen only**: capturing touch would swallow the swipe that scrolls the page.
  (Explosions and shockwave rings were specced, built, then cut. Don't reintroduce them.)

**Rendering** — two colour passes of `fillRect`, never per-particle `arc()`: teal
`rgba(93,202,165,0.92)` at 1.4px for `heat <= 0.35`, indigo `rgba(143,136,221,0.95)` at
1.6px above.

**Requirements.**
- A real, visually-hidden `<h1>Neelay Ranjan</h1>`; the canvas is `aria-hidden`. The drag
  conveys nothing essential, so this holds.
- No off-screen pause is possible (the canvas IS the viewport); tab-hide is the only
  free win and is taken.
- `prefers-reduced-motion`: no sim, no kicks, no drag. Draws the resolved outline of the
  active station and redraws it on scroll — a fixed nameplate that followed the reader
  down the page would be worse than the motion.

### 2. Diffusion trajectory viewer — two models, one component  *(`components/DiffusionVisualizer.tsx`)*
A `TerminalPanel` with a `[pixel | ascii]` toggle and two side-by-side grids: `x_t` (the
current state) and `x̂₀` (the model's guess at the finished digit). Layout, scrubber,
playback and digit picker are identical across modes — only the cell renderer and the
copy differ, which is why it's one component. **Default pixel**; ascii is opt-in.

Both trajectory files are REAL, trained output. There is no placeholder any more, and
`scripts/gen-placeholder-traj.mjs` has been deleted: it wrote to the same path as the
real export and running it would have destroyed 3MB of trained data.

**The two models corrupt differently, and the copy must say so.**
- **pixel** (`/diffusion_traj.json`, 3.0MB, 6.47M params): Gaussian diffusion. Starts
  from pure static and denoises. *"noise sharpens into a digit."* It predicts the clean
  image directly rather than the noise, which is why you get `x_t` AND `x̂₀` at every step.
- **ascii** (`/ascii_traj.json`, 586KB, 1.28M params): absorbing-state DISCRETE diffusion.
  Starts with every cell masked and commits cells one at a time, most-confident first.
  **There is no noise anywhere in it.** *"masked cells resolve into characters."* This is
  NOT the pixel model rendered as ASCII — don't let the copy imply that.

Once an ascii cell commits it is frozen and never re-predicted, so that animation
structurally cannot flicker. Verified against the export: **0 cells re-written across all
10 digits.**

**Contracts.** Pixel: `{ "<digit>": [ { xt: number[784], x0: number[784] } ] }`, 32 frames,
28x28 row-major, `[0,1]`, noisy → clean. Ascii (`lib/ascii-traj.ts`):
```json
{ "version": 1, "vocab": [" ",".",":","-","=","+","*","#","%","@"],
  "mask_id": -1, "grid": { "rows": 14, "cols": 28 },
  "digits": { "0": [ { "xt": [392 ints], "x0": [392 ints] } ] } }
```
- **READ `vocab`, `mask_id` and `grid` from the file. Never hardcode them.** They're in
  there so the model can be retuned without touching site code. Guard on `version`.
- **Check `mask_id` BEFORE indexing `vocab`.** `mask_id` is -1 and `vocab[-1]` is
  `undefined` in JS, which renders the literal text "undefined" into the grid. Masked
  cells get a dim `·`. Any out-of-range index gets the same guard.
- `xt` is what's committed (with mask holes); `x0` is the guess for EVERY cell and never
  contains `mask_id` — fully populated even at frame 0.
- Rows go in as text, never `innerHTML`: the vocab contains `#`, `%`, `@`.

**Playback differs by mode, deliberately.**
- **pixel interpolates.** A rAF loop advances a float through frame space at `STEP_MS`
  (190ms) and blends the two frames either side (`lerpReshape`). Intensities are
  continuous; stepping 32 frames directly reads as a slideshow.
- **ascii steps, never interpolates.** These are discrete token indices — blending index
  3 and index 7 is meaningless, and a cell commits in exactly one step by design.
  Snapping is the honest render of a mask-resolve.

Re-renders cap at ~30fps; the run holds `END_DWELL_MS` (750ms) on the finished sample.
Both files lazy-load on boot, never on page load.

**Rendering.** The ascii grid is 28 wide x 14 tall, `line-height: 1`, no tracking — the
aspect correction is already applied model-side by averaging row pairs. **Never reshape to
28x28**; it stretches the digit. Uses `AsciiLines` from `components/AsciiGrid.tsx` (the
shared renderer); the pixel mode uses `AsciiGrid`, which maps intensities through the ramp
and delegates to the same view.

### 2b. Draw a digit — live SDEdit  *(`components/DrawDigit.tsx`)*
The visitor draws; their digit dissolves into static and re-forms, streaming as it
computes. **Entirely client-side** — no backend, no API, no cost. SHIPPED and working.

**Division of labour — respect it.** All model math (preprocessing, schedule, sampler,
guidance, ASCII mapping) lives in `lib/ascii-diffusion.js`, vendored from the model repo
and pinned against a PyTorch reference (sampler max|Δ| 7.9e-6). **We own the canvas, pen,
UI, picker and copy.** Never reimplement the internals: a subtly wrong schedule produces
plausible garbage that reads as "the model is bad" and is horrible to debug from outside.
`lib/ascii-diffusion.d.ts` types it by hand — re-check that against the .js when a new
version lands. `lib/draw-model.ts` owns loading.

**⚠️ THREE TRAPS IN THE MODULE'S API.** All three were hit for real; all three produce
plausible-looking wrong output rather than an error.

1. **`inkIsHigh`.** `normalizeCanvas` defaults to `inkIsHigh: false` — dark ink on light
   paper — and inverts. We draw WHITE ink on near-black, so we must pass `true` or the
   model gets a photographic negative: off-distribution input, garbage out, and it reads
   as the diffusion being broken. **`generate()` cannot take this option** (it calls
   `normalizeCanvas(canvas)` bare), so we pass `x0Init` instead, which fully replaces
   that path. Worth asking the model owner to thread it through.
2. **`preprocess()` and `toAscii()` do NOT compose.** `preprocess` returns **[0,1]**;
   `toAscii` and `x0Init` both expect **[-1,1]**. The handoff lists them back to back,
   which reads like they chain. Feeding [0,1] to `toAscii` maps background 0 to mid-ramp
   and washes everything grey. `modelSpace()` does the one remap, shared by every caller.
3. **Bailing out of `onFrame` skips the module's yield.** `generate()` does
   `await new Promise(r => setTimeout(r, 0))` after each frame; throwing past it means no
   return to the event loop. The classifier's loop must yield itself or the page locks up.

**⚠️ Pen width is the other failure mode.** `PEN_FRAC` = ~10% of canvas width (~28px on
280px). MNIST normalizes into a 20x20 box, so a 280px canvas is downscaled ~14x and a thin
stroke **vanishes** — same garbage-out as trap 1. A fat pen feels wrong while drawing and
lands at ~2px normalized, which is what real MNIST strokes look like. **Verified: ~76 ink
cells survive the reduction.** The 28x28 preview via `ad.preprocess` is the oracle and it
caught trap 1 on the first run; it's since been removed from the UI as dev instrumentation,
but `modelSpace()` is two lines from putting it back if output ever degrades to mush.

**Streaming is the whole trick.** Render INSIDE `onFrame`. Measured: first frame ~3ms.
The computation IS the animation, so there is no spinner to design. Frames arrive in two
phases and `step` numbers continuously across both (10 + 20 = 30):
- **dissolve** — the forward process, closed form, **free**: no model calls at all. It
  exists purely so the drawing is watched coming apart instead of cutting to static.
- **denoise** — the model actually running, one forward per step.

**Render `ascii.xt`, not `ascii.x0`.** `xt` tells the whole story in one panel: drawing →
static → digit. `x0` during the dissolve is just the drawing held still, so rendering it
hides the dissolve completely.

**Auto-label: the classifier suggests, the picker decides**  *(`lib/classify.ts`)*
The model is class-conditional and can't infer the label. The handoff said "don't add a
classifier" because a misclassification reads as the diffusion failing — that concern is
answered by making the guess **visible and overridable**, not by hiding it. The chip reads
`label · auto` while guessing and `label · yours` once picked by hand; a hand-pick sticks
until `clear`. Keep it that way.

Zero-shot, using the diffusion model itself — no second model, no extra weights. Predict
x̂₀ under all 10 labels from **identical fixed noise** and take the best reconstruction.
- **`CLASSIFY_STRENGTH` is 0.85, and that is counter-intuitive.** Low noise fails badly:
  the drawing survives, the model echoes it back whatever the label, all 10 scores land
  within ~0.001 and there is nothing to rank. High noise erases the drawing so the
  prediction is driven by the LABEL, which makes this template matching against
  model-generated prototypes. Measured on the 10 clean digits in `diffusion_traj.json`:
  `0.25→4/10  0.40→3/10  0.55→3/10  0.70→4/10  0.80→9/10  0.85→10/10  0.90→10/10  0.95→10/10`.
  A plateau, not a spike. **Don't lower it toward the generation strength (0.6) on the
  assumption they should match — they measure different things.**
- `guidance: 1` collapses CFG to the pure conditional (`x0 = uncond + 1*(cond-uncond)`).
  Anything else blends the null class back in and blunts the signal.
- `steps: 2` is the floor — the module divides by `(steps - 1)`. Only the first frame is
  read; see trap 3 for how the second forward is skipped.
- It is approximate by construction (one timestep) and will fumble ambiguous strokes.
  That's what the picker is for. A classifier head from the model owner would be ~1ms and
  near-perfect if this ever gets annoying.

### 3. Sample-space: DDPM vs flow matching  *(illustrative — NOT a real model)*
Two side-by-side canvas panels inside a `TerminalPanel`, both over the same 2D target
distribution (two moons):
- Left: **DDPM (stochastic / SDE)** — trajectories are jagged; add decaying per-step
  Gaussian jitter so each path wanders and takes a different route from the same start.
- Right: **Flow matching (deterministic / ODE)** — trajectories are smooth and nearly
  straight, same route every time.

Both draw the path as connected line segments with a dot at each step (the "hops"),
converging onto the target manifold. Auto-spawn trajectories on an interval; also let
the visitor **click a point** to spawn one from there. This is a hand-crafted
illustrative animation — do **not** load or run real model weights. Label it clearly
as illustrative.

Directly beneath this panel, render the write-up in `content/sample-space.md`
(copy provided below) explaining the difference.

**Built** — `components/SampleSpace.tsx`, math in `lib/sample-space.ts`. Notes:
- **One start feeds both panels.** A click in either spawns the same start in both;
  that shared origin is the entire comparison, so don't let the panels diverge.
- **DDPM 40 steps / flow 9.** The step-count gap is visible in the dot counts, which
  is what makes "far fewer steps" concrete rather than just copy.
- **Flow must be a pure function of the start** — its bow is hashed from the start
  point, never RNG. "Same route every time" is the property being demonstrated;
  a stray `Math.random()` in `flowPath` silently destroys the whole point.
- **DDPM jitter is a FRACTION of the journey length** (`DDPM_SIGMA_FRAC`), not an
  absolute sigma. Fixed sigma reads as a tangled hairball on a short trip and a
  barely-bent line on a long one. Target ~2.5–3x path-length/straight-line — verified
  stable across journeys from 0.2 to 0.7.
- **Targets are hash-picked, not nearest.** The noise prior sits on top of the
  manifold, so nearest-point makes every path a short hop with nothing to watch.
  Hashing keeps flow deterministic while giving a real trip across the space.
- The write-up is rendered by `SampleSpaceWriteup` — a server component that reads the
  `.md` at build time with a ~30-line inline renderer for paragraphs/bold/italic. The
  copy uses only those three constructs; if it ever needs lists, links or headings,
  swap in a real markdown parser rather than growing that function.

### 4. Play the engine — EBM chess  *(`components/ChessPanel.tsx`)*
SHIPPED, playable, running the **int8** build in the browser. The model is an energy
function over RESULTING positions: it never outputs a move. To move: enumerate every legal
move, encode each child from the mover's perspective, run the whole batch in ONE forward,
take `argmin(energy)`. `softmax(-energy)` is a calibrated move distribution; `value` is
the expected result for the mover in [-1,1]. Currently **1-ply argmin** (~130-200ms/move).

**chess.js owns every rule.** Never hand-roll chess logic.

**The encoder** (`lib/chess-encode.ts`) is a port of `training/encoding.py` and must match
it EXACTLY — a wrong transform gives legal-but-terrible moves, not an error.
- Perspective = whoever is to move BEFORE the candidate move.
- Square transform: identity for white, rank-mirror `sq ^ 56` for black.
  **Files are NEVER flipped** — that would swap king and queenside.
- Planes: 0-5 self P N B R Q K, 6-11 opponent, 12 side-to-move (always 0 for s'; computed
  as `turn == perspective` rather than hardcoded, to match the reference), 13-16 castling
  rights per FEN (self K/Q then opponent K/Q, constant planes), 17 en-passant one-hot
  **only if an ep capture is actually LEGAL** (a set ep square in the FEN is not enough).

**Validation vectors — re-run these if you touch the encoder.** All four pass:
- **A** startpos + e2e4, **B** the mirror test (if B fails and A passes, the mirror is
  broken), plus ep gating in both directions.
- **C** `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1` → argmin `a1a8` (Ra8#), prior ~0.168,
  value ~0.89. Check top-1 identity, not exact floats.
- **D** startpos top-3 by prior: `g2g3 .236, d2d4 .211, g1f3 .186`. Yes, g3 first —
  human-database personality, not a bug.

**int8 works in ort-web.** The handoff warned the QInt16 activations might not load in
WASM. They do, and vector C passes: `argmin=a1a8, prior=0.169, value=0.89`. So the page
ships the same 553KB file that runs on the Pi, which is the whole pitch. `chess-fp32.onnx`
(1.8MB) stays as a fallback the loader uses only if a runtime rejects the graph — losing
the "int8" label costs nothing user-visible; a wrong-answer engine would cost everything.
Measured: int8 load 964ms / infer 142ms; fp32 load 47ms / infer 128ms. **int8's win is
download size, not speed.**

**Draws are the SITE's job.** Search nodes drop move history, so the engine structurally
cannot see threefold repetition or the fifty-move rule, and left alone it shuffles in won
endgames — it donated 10 of 20 draws vs SF-2500 exactly this way. chess.js has the history:
the panel detects threefold, fifty-move, stalemate and insufficient material and ends the
game. Promotion has a piece picker. **Never call the engine on a finished position.**

**Copy — accurate claims only.** "roughly 2000–2300" or "master-ish vs Stockfish's limited
modes". **Never claim 2300+ flat**: rung labels compress. Source of truth is
`entropy-chess/docs/2026-07-15-elo-ladder.md` (~2000 conservative / ~2330 ±41 nominal,
int8, 500 sims, 0.5s/move ladder); it supersedes both the resume's 2250 and
ARCHITECTURE.md's older 1850-2000. Quantization cost ~0 Elo. If the site ever quotes
latency, quote what you measure in the browser — not the Pi's numbers.

**NOT BUILT: MCTS.** 1-ply is the handoff's "ship-able checkpoint". Full strength is an
AlphaZero-lite search over these same priors and values (port of `pi/mcts.py`, ~150 lines):
PUCT `Q + 1.5 * prior * sqrt(N_parent+1)/(1+N_child)`, leaf value flipped every ply on
backup, terminals exact (±1/0, don't call the model), play the most-visited root child.
Difficulty = sims (casual 40 / club 120 / strong 250 / max 400).
**It must run in a Web Worker** — each sim is a batched forward of ~30 boards, so 120 sims
blocks the main thread for seconds. Measure before picking a default.

### 5. Research
Clean cards for publications and projects. Leave well-structured placeholder cards;
real content (paper titles, NASA/Regenstrief bullets, links) pasted in later.

### 6. Live preview: multi-agent robustness
A small `TerminalPanel` animating a committee of agent nodes reaching — or failing to
reach — consensus, with a covert minority visibly influencing the outcome. Stub the
data/logic behind a clean interface. Framing on the page is research-forward: "how
multi-agent systems fail under adversarial pressure," not a how-to.

## Model artifacts and the ONNX runtime

Everything in `public/` that isn't code. All of it is git-tracked and ships to Vercel.

| path | size | what |
|---|---|---|
| `public/diffusion_traj.json` | 3.0 MB | pixel trajectories, 10 digits x 32 frames |
| `public/ascii_traj.json` | 586 KB | discrete/mask trajectories, same shape |
| `public/models/mnist_x0.onnx` | 26 MB | the pixel model, for live draw-a-digit |
| `public/models/chess-int8.onnx` | 553 KB | the chess EBM (the Pi's artifact) |
| `public/models/chess-fp32.onnx` | 1.8 MB | chess fallback |
| `public/ort/*` | ~37 MB | onnxruntime-web's wasm, vendored |
| `lib/ascii-diffusion.js` | 12 KB | the model module, vendored |

**~68MB of binaries live in git history.** Worth a Git LFS decision; flagged, not decided.

**`scripts/sync-ort.mjs`** copies ORT's wasm into `public/ort/`, wired to `predev` and
`prebuild`. Not a one-off copy: the binary is version-locked to the JS, so bumping
`onnxruntime-web` without re-copying gives a mismatch that only shows up as a runtime
failure on first draw.
- **It copies the `asyncify` build, and that was found empirically.** ort-web 1.27's
  `webgpu` entry fetches `ort-wasm-simd-threaded.asyncify.mjs` at runtime — NOT the `jsep`
  one you'd guess from the WebGPU naming. Guessing wrong 404s, Next serves its HTML error
  page, the module loader rejects it on MIME type, and it surfaces as the useless message
  **"no available backend found"**. If ORT changes what it fetches, the network tab names
  the file. Don't guess.
- Never hotlink a CDN. Vendored on purpose.

**COOP/COEP headers are set on every route** (`next.config.ts`). They enable
cross-origin isolation → `SharedArrayBuffer` → multi-threaded WASM. Without them ORT is
pinned to one thread. **This is a real constraint on the whole site**: any future
cross-origin image, script or iframe needs CORP headers or `crossorigin="anonymous"`, or
it is blocked outright. Safe today — fonts are self-hosted by next/font and the only
external URLs are `<a href>` links, which COEP doesn't touch.

**Performance is environment-dependent; do not trust one browser.** Headless Firefox
(Playwright) measured the MNIST model at ~926ms per forward — a full 20-step generation in
18.5s — against ~30-40ms/forward for the same model natively on the same machine, and a
handoff prediction of ~1-2s for a whole run. That's ~20x off, on a 20-core i9. It has no
WebGPU adapter. **Verify UX timing in a real browser, not the test harness**, and quote
measured numbers rather than the handoff's.

## Write-up copy — `content/sample-space.md`

> **DDPM vs. flow matching.** Both learn to turn noise into data, but they take
> different routes there. A diffusion model (DDPM) reverses a stochastic noising
> process: sampling is a *random walk* that removes a little noise at each of many
> steps, so the path from noise to sample is jagged and takes a different route every
> run. Flow matching instead learns a *velocity field* and follows it as a
> deterministic ODE — the trajectory is smooth, repeatable, and much straighter, which
> is why it can sample in far fewer steps. Straighten the paths further (rectified
> flow / reflow) and they approach straight line segments, collapsing dozens of steps
> into a handful.
>
> *The panels above are illustrative — hand-drawn fields on a 2D toy distribution, not
> a trained model. In two dimensions these trajectories can be made genuinely real;
> in the high-dimensional space of actual image models the same picture becomes a
> projection.*

## State — what's built, what's left

**Built and verified:** scaffold + theme + `TerminalPanel`/`AsciiGrid`; the migrating
swarm (§1); the trajectory viewer in both modes on real trained data (§2); live
draw-a-digit with the real ONNX + zero-shot auto-label (§2b); sample-space (§3); the
chess engine at 1-ply on the real int8 build (§4); page ambience, terminal boot,
scroll reveals, timestep rail.

**Left, roughly in order:**
1. **Chess MCTS in a Web Worker** + difficulty selector (§4). The single biggest
   remaining win: 1-ply is where most of the strength isn't.
2. **§5 Research** — cards exist as a stub; needs real content from
   `content/resume-notes.md`. Three of four publications are "in preparation"; decide
   how to present unpublished work.
3. **§6 multi-agent robustness** — not started. Its node-graph watermark and the chess
   board-grid watermark (see Page ambience §3) land with their sections.
4. **README** — how to run, how to deploy, and where the model artifacts come from.
5. **Git LFS decision** for ~68MB of binaries.
6. **`content/profile.ts` links** are real; the resume PDF stays out of `public/`.

## Constraints recap

- **Never fake a model's output.** Gate on the artifact's absence and say so in the UI.
  A plausible stub teaches the wrong thing about how the work feels, which is worse than
  an empty section on a site whose whole claim is that the work is real.
- **Never reimplement vendored model math.** Preprocessing, schedules, samplers,
  encoders: port exactly, validate against the provided vectors, and ask if the API
  doesn't expose what you need. A subtly wrong port produces plausible garbage that
  reads as "the model is bad".
- **Measure, don't assume.** Every number in this file was measured; several
  contradicted a reasonable guess (int8 is not faster; classification wants MORE noise;
  the asyncify build, not jsep). "HTTP 200" proves nothing about a canvas — screenshot it.
- Performant on mobile above all — no heavy WebGL, lazy-load everything heavy, pause
  off-screen where possible (the swarm is the one thing that can't).
- Illustrative pieces must be labeled as illustrative. §1 and §3 are hand-built; §2,
  §2b and §4 are real trained models. Don't blur that line in copy.
- All physics runs on a dt-scaled clock (`k = dt / 16.67`) so it behaves the same at 30,
  60 and 144Hz. Schedules on wall-clock ms + physics per-frame = drift.

@AGENTS.md
