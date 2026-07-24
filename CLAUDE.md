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
  `onnxruntime-web` (every model on the page). `playwright` is a devDependency with two
  jobs: verifying canvas work ("HTTP 200" proves nothing about whether particles resolved
  into a name or a model returned a digit), and **rendering committed artifacts**
  (`gen-icons.mjs`, `gen-og.mjs` — see Model artifacts). Only Firefox is installed
  locally, which matters: Playwright's Firefox doesn't implement
  `screenshot({omitBackground})`, so the icon script rasterizes via canvas `toDataURL`.

**Turbopack has served stale CSS at least once**, for hours, silently: an edit to
`globals.css` never compiled and the browser kept the old rule, which made a correct
fix look like it did nothing. If a CSS change appears to have no effect, check the
served chunk (`curl` the `/_next/static/chunks/*.css` URL) before doubting the code.
`rm -rf .next` and restart fixes it.

## Aesthetic — "latent space"

- Near-black background: `#080a12`. One indigo accent (`#8f88dd`) and one teal accent (`#5dcaa5`). Clean sans type, generous whitespace.
- The hero is the particle swarm (see §1) — the one deliberately loud element.
  Everything below it stays quiet.
- Two type weights only (400 / 500). Sentence case everywhere. No gradients, no drop shadows, no glow.
  (The swarm rasterizes its text masks bold purely to give the sampler more ink — no
  bold type is ever displayed, so the two-weight rule holds.)
- Mobile: everything must degrade gracefully and stay fast. Lazy-load anything heavy; pause canvas animations off-screen.

### 🔒 LOCKED: the mono/sans split is semantic, not decorative

**Monospace = anything the MACHINE says.** Terminal command lines, flags, the
`neelay@latent:~$` prompt, demo captions and labels, readouts (step counts, `p`/`v`
values, timings, sim progress), the boot log, the ASCII grids.

**Sans = anything a PERSON says.** The explanatory paragraph under each demo that tells
you what it is, and the hero's affiliation line.

**⚠️ DO NOT "unify" this by converting the prose to mono.** It looks tempting, and it is
the single most likely wrong move a future pass makes here. Long blocks of terminal-styled
text are genuinely hard to read; the sans prose is what keeps the explanations legible
while the mono framing carries the terminal identity. The split *is* the design. Apply it
consistently in both directions: no explanatory paragraph in mono, no readout in sans, and
no mixing inside one category.

- **Known tension, deliberately left alone:** a few *secondary* notes are still mono prose
  (the hero's Langevin caption, the classifier note under §2b, the `hint` and search notes
  under §4). They sit in the "demo caption" bucket rather than the "explanatory paragraph"
  bucket, and they're styled as captions. If they ever grow past ~4 lines, they've become
  prose and should move to sans.

### 🔒 LOCKED: the spacing scale is multiples of 8

Every **layout** gap is a multiple of 8px: `8 / 16 / 24 / 32 / 48 / 64 / 80 / 96`
(Tailwind `2 / 4 / 6 / 8 / 12 / 16 / 20 / 24`). Section-to-section is `py-20` on `Section`,
heading-to-content is `mb-2`, block-to-block is `mt-4`/`mt-6`/`mt-8`. 20px (`mt-5`, `p-5`)
and 12px (`mt-3`, `gap-3`) were the strays and are gone; don't reintroduce them.

**Control padding is exempt and stays.** `px-3 py-1.5` on a button is component-internal
sizing, not page rhythm — snapping it to 8s changes hit targets for nothing.

### 🔒 LOCKED: the measure for sans prose is `max-w-[54ch]`

**⚠️ 54ch renders ~70 ACTUAL characters. This is not a typo, and don't "fix" it to 68.**
The CSS `ch` unit is the advance of `0`, which is far wider than the average lowercase
letter in proportional type, so it over-counts by ~30%. Measured in-browser: `68ch` gave
**88** characters per line (too long, and the reason the chess lede was tiring); `54ch`
gives **70**, inside the 65-75 comfortable band. Mono and terminal elements stay
full-width; this cap is for sans prose only.

### The fonts, and the three things that depend on them

Geist + Geist Mono (`next/font/google`, self-hosted at build), wired to `--font-sans` /
`--font-mono` in `@theme`. **Evaluated IBM Plex, JetBrains Mono and Instrument Sans on
2026-07-15 and deliberately stayed on Geist.** Any future swap has to clear all three of
these, and none of them announce themselves:

- **⚠️ THE MONO'S ADVANCE MUST BE 0.6em.** Measured: Geist Mono is exactly 0.600em, and
  `AsciiLines`' `lineHeight: 0.68` is that 0.6 **plus** its 0.08em `letterSpacing`. That
  identity is the only reason the ASCII cells read square. Swap in a narrower mono
  (Iosevka and Inconsolata are ~0.5em) without re-deriving `lineHeight` and every digit in
  §2/§2b renders stretched, with no error. Most monos are 0.6em by convention — Plex Mono,
  JetBrains Mono and Instrument's pairing all measured 0.600em exactly — but measure,
  don't assume.
- **⚠️ NO LIGATURE FONTS.** This is a disqualifier here, not a preference. JetBrains Mono
  rewrites `==` and `===` into single connected rules and `->` into `→`. The ASCII ramp is
  `" .:-=+*#%@"` and runs of `=` are what mid-intensity regions are MADE of, so a coding
  font silently turns rows of cells into continuous lines and corrupts the art the page
  exists to show. `font-variant-ligatures: none` fixes it, but it would have to be
  remembered on both `AsciiLines` and `CharField`, and forgetting is invisible.
- **The hero nameplate is NOT in `--font-sans`, and can't easily be.** `Swarm.tsx`
  rasterizes with a literal `ui-sans-serif, system-ui, -apple-system` stack, because
  `ctx.font` silently ignores a CSS variable (the same trap `CharField` documents at
  length). So the loudest text on the page is the visitor's system font, and changing the
  page's sans does not touch it. If that ever needs to match, resolve the family off
  `getComputedStyle` first — do not just paste the variable in.

## Voice — write like a person, not a model

**🔒 ALL user-facing copy lives in `content/copy.ts`. Edit it there, not inline in
components.** Headings, ledes, captions, button labels, boot-log lines, terminal command
names, notices, status words, section anchors, page metadata, the 404, the boot screen,
and the demo labels/blurbs that used to sit in lib data (`SEARCH_MODES`, `TARGETS`) — all
in the one file, referenced as `copy.*`. A wording change is now find-by-name, not a JSX
hunt. `content/profile.ts` was folded into it; `content/sample-space.md` is still the
external source for that one write-up.
- **What deliberately stays inline** (moving it changes behavior, not copy): the `--flag`
  tokens (they're logic identifiers threaded through `commitParam`/`CommandLine`, and
  interwoven with number interpolation in each `BOOT_CMD`); number-format glue in
  interpolated readouts (` · `, `p=`, `v=`, `n=`, step/timing/percent counters);
  aria-labels built from live values; enum values rendered directly (`pixel`/`ascii`/
  `game` button faces); and the `neelay@latent:~$` prompt (composed in `lib/identity.ts`).
  The header of `copy.ts` lists these.
- **⚠️ It's a PURE-EXTRACTION seam: the render must stay byte-identical.** When you move a
  string, entities become their Unicode chars (`&rsquo;`→’, `&quot;`→", `&ndash;`→–) and
  a fragment's leading/trailing spaces carry the spacing the JSX `{" "}` used to. Verify by
  diffing rendered text before/after (the scratchpad `snap.mjs` did exactly this across
  every section, both toggle states, metadata and the 404 — all identical).

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
leads. **Motion lives in the swarm (§1), the CharField, and the interactive demos, and
nowhere else.**

> **The full-page-background rule, as it actually stands.** This section once said
> "never add a second animated full-page background", then was amended when the swarm
> migrated down the page. Both are now history: the swarm is **hero-only** (see §1), and
> the ONE full-page animated layer is the CharField, which was built to that budget on
> purpose (~10fps, capped patches, tab-hidden stops it). One layer, and it is that one.
> Anything else full-page and moving needs a reason this file doesn't have yet.

**1. Base layer** (`app/globals.css`, **on `html`, NOT on `body`**) — static dot-grid,
near-zero cost:
```css
html { background-color: var(--color-base);
       background-image: radial-gradient(rgba(159,225,203,0.05) 1px, transparent 1px);
       background-size: 22px 22px; }
body { background: transparent; }
```
Reads "engineering graph paper," not empty void. **The `html`/`body` split is
load-bearing, not stylistic**: the swarm canvas and the CharField are fixed negative-z
children of `body`, so they paint above html's background but below anything `body`
paints. Give `body` a background (or `bg-base` on the body element) and both layers
vanish while their code keeps happily rendering to itself. See the stacking traps in
Sections §1 (Hero).

**2. The CharField** (`components/ambience/CharField.tsx`) — a faint full-page monospace
texture that mostly sits still, with small patches scrambling to noise and resolving
back. It's the settled-sample-that-re-samples-itself idea, and it's what gives back "the
page resolves as you move" now that the swarm stays in the hero.
- **Budget is the point, and it's why the swarm stopped migrating.** ~10fps on a
  `setTimeout` (NOT a 60fps rAF), a hard cap on live patches (4, or 3 on small screens),
  nothing at all while the tab is hidden, fewer cells and a slower cadence under 640px,
  and reduced-motion paints the settled field once and never touches it again. **If you
  make this smoother you have missed why it exists.**
- Patches spawn on an idle timer, under the cursor (throttled; desktop-only in practice,
  since touch fires no `pointermove`), and where a section scrolls in — the last one is
  what makes it work on a phone.
- Ramp `" .·:-=+*"`, the same glyphs the diffusion demos resolve through. Noise adds
  `/\|_`, which carry no intensity but make a live patch read as flow, not static.
- Paint budget: the settled field is pre-joined once per resize and only rows a patch
  touches get rebuilt. Idle is a single cached-string assignment. Written via
  `textContent`, never React state.
- **Tint: indigo `rgba(143,136,221,0.18)`.** The alpha is 0.18 where the older teal sat
  at 0.15, and that is NOT a density change — it holds density constant. Against #080a12
  indigo carries ~82% of teal's relative luminance, so reusing 0.15 would have quietly
  made the field fainter than the one tuned by eye. Measured full-viewport, floor
  subtracted: teal 0.15 = 0.340, indigo 0.18 = 0.338 (-0.6%), indigo 0.15 = 0.261 (-23%).
  **Retint again and you rescale the alpha by luminance and re-measure. Don't copy the
  number across.**
- **⚠️ Cell metrics come from a hidden DOM probe + `ResizeObserver`, and that is not
  overthinking it.** Two bugs live here, both silent. (a) Measuring via canvas
  `ctx.measureText` is wrong: next/font ships the family as a CSS variable, and an
  invalid `ctx.font` assignment is *ignored* rather than thrown, so it silently keeps
  `10px sans-serif`. (b) The effect can run before the browser applies its own styles —
  measured in Firefox, `pre.style.fontSize` read back `9px` while `getComputedStyle` said
  `16px`, giving 9.6px/char instead of 5.4px, so the field spanned **135 columns instead
  of 239** and stopped 57% across the viewport with a hard vertical edge, forever.
  `document.fonts.ready` does NOT fix it (fonts were already loaded in failing runs;
  fonts were never the problem). The observer fires when the advance actually changes,
  whatever the cause: late styles, a webfont swap, or page zoom.
- Mounted twice on purpose for the duration of the boot: the page's copy is buried under
  the boot screen's opaque `bg-base`, so `BootScreen` renders its own inside the overlay.
  The base pattern is deterministic, so there is nothing to match up when it unmounts.

**3. Scroll spine** (`components/ambience/ScrollSpine.tsx`) — a thin fixed line in the
left margin with a tick tracking scroll position.
- **It used to be the "diffusion-timestep rail"**, labelled `x_T · t=1000` at the top and
  `x̂₀ · t=0` at the footer, on the conceit that the page was one reverse-diffusion pass.
  **The labels are gone and should stay gone.** That conceit belonged to the migrating
  swarm. The CharField does re-diffuse, but only *locally* — a patch scrambles wherever a
  section arrives. It is not a monotonic denoise from hero to footer, so a countdown would
  be claiming something the page doesn't do. The spine stayed; it's now just a readout of
  how far down you are.
- Driven by `scrollY / scrollable height`, never a timer.
- Line `--color-rail` (rgba(93,202,165,0.14)); tick indigo.
- Writes through refs in a rAF-coalesced scroll handler — a `setState` per scroll
  event would re-render the page tree 60x/sec to move a 1px line.
- Hidden below `xl`, where there's no margin to live in.
- The tick tracks scroll 1:1 with **no easing**, so it has no motion of its own to
  disable under reduced-motion — it's a readout, like a scrollbar.

**🔒 LOCKED: the anchor and the heading never say the same words.** Each section carries
two names and they do different jobs. The **teal mono anchor** (`Section`'s `label`, in the
gap above the panel) says WHERE YOU ARE. The **white sans `<h2>`** inside the panel says
WHAT THE THING IS. They used to be near-duplicates ("x0 diffusion" above "x0 diffusion"),
which read as a stutter and wasted the one line a visitor actually reads.

| section | teal anchor | sans `<h2>` |
|---|---|---|
| §2 | `two models, one idea` | **Continuous diffusion** / **Discrete diffusion** (follows the toggle) |
| §2b | `draw a digit` | SDEdit |
| §4 | `play the engine` | Energy-based modeling over board states |
| §3 | `sample space` | Stochastic vs deterministic |

- **⚠️ §2's anchor must be true of BOTH toggle states.** The obvious pick, "noise to
  digit", is false half the time: the ascii model has no noise anywhere in it, it unmasks
  (see §2). Same trap as the copy rule there.
- **§2's `<h2>` is where the two models' difference gets said**, which is why it follows
  the toggle rather than sitting static. Gaussian is continuous; absorbing-state is
  discrete.
- The anchor stays `aria-hidden`. It is no longer an echo of the `<h2>`, so the old
  rationale is dead — the new one is that it's a decorative scroll marker and the `<h2>` is
  the real heading. A screen reader gets the heading and the lede, which carry the content.

**4. Section labels** (`components/ambience/ResolveText.tsx`, via `Section`'s `label`) —
the big teal mono marker in the open gap above each panel, resolving out of the ASCII
ramp on scroll-in. **One-shot, then static**, which is what keeps it in the scroll-reveal
category instead of becoming a second thing that never stops. Server-renders the real
text and only scrambles on the client; `aria-hidden`, because it echoes the panel's real
`<h2>` and must not be announced twice. Reduced-motion skips the scramble entirely.

**5. Per-section accents** — contained, static, faint. NOT full-section backgrounds.
- `DenoiseGlyph` — **removed 2026-07-15, don't rebuild it.** It was six rows of
  `" .·:-=+*"` resolving noise→structure in each section's top-right corner. The
  CharField now does exactly that — same ramp, whole page, re-diffusing as you scroll —
  so it was two layers of one idea, and once the field went indigo the teal corner block
  read as a smudge sitting on top of it. Retinting would have hidden it inside the field
  it duplicated. The field is the accent now. (`glyphSeed` went with it.)
- Node-graph watermark behind the multi-agent/consensus section — **not built yet**,
  that section doesn't exist. Wire it in with the section. `Section` already takes a
  `watermark` prop for exactly this.
- Board-grid watermark behind the chess section — **not built yet**, same reason.

**6. Scroll reveals** (`components/ambience/Reveal.tsx`) — opacity + ~12px translateY
over ~500ms via IntersectionObserver, one-way (never re-hides). The hidden state lives
in CSS (`.reveal`), so the server renders final markup and JS only flips
`data-shown`. A `<noscript>` override in `layout.tsx` un-hides everything if JS never
runs — otherwise the whole page is blank without it.

**7. Film grain** — one fixed `body::after` layer of static SVG turbulence
(desaturated, opacity 0.035, `pointer-events: none`). Rasterized once by the browser
and composited thereafter; no animation, so nothing to disable under reduced-motion.

**Accessibility / performance.** Under `prefers-reduced-motion`: reveals show
outright, labels don't scramble, the CharField paints once, and nothing else animates by
construction — the dot-grid, spine, accents and grain all stay. Every accent is
`aria-hidden`, non-focusable, and carries no text a screen reader needs.

## Terminal boot sequence

Each demo section is its own faux-terminal. On scroll-in it types a command, prints a
few lines of output, then reveals the demo — `components/ambience/BootLog.tsx`
(`useBootSequence` hook + `BootLog` view).

The section's heading and lede fold *inside* the panel, after the boot log, rather
than sitting above it. `Section` renders `title`/`lede` only for prose sections; terminal
sections pass neither, and pass `label` instead for the big resolving marker in the gap
above the panel (Page ambience §4).

It is not just theatre — **the demo mounts only once `done` flips**, so each section's
heavy work (the 3.0MB trajectory JSON, chess.js, a model) starts when its panel is
reached rather than all at once on load.

The panel's own command label is `components/ambience/TerminalLabel.tsx`: a blinking
cursor, plus a rare re-type of the label's **last token only** (every 9-20s, staggered
per panel, under a third of a second). Scrambling the command name would look like the
panel broke; scrambling a flag looks like it's re-reading its config. Panels never fire
in unison — several headers twitching together reads as a glitch. Reduced-motion gets
neither the blink nor the retype.

Under `prefers-reduced-motion` the typing is skipped and the boot resolves instantly —
but **still gated on IntersectionObserver**. The deferral is a loading strategy, not an
animation; reduced-motion users must not eat every section's payload up front.

### The boot screen  *(`components/ambience/BootScreen.tsx`)*

The page ssh's into itself before it loads. Full-viewport, opaque, above the nameplate,
page blank behind it, ~2.0s + a 420ms fade (~2.45s to gone), once per fresh load:

```
root@latent:~$ ssh neelay@neelayranjan.dev
                   ^^^^^^ editable. this is the easter egg.
connected · latent
neelay@latent:~$ ./latent --serve
```

You start at a root shell and connect to the box the site is served from. `root` is
indigo, you are teal: the colour change IS the connection. The prompt landing on `latent`
after dialling `neelayranjan.dev` is **not** a bug to fix — ssh shows the remote's
hostname, not the domain you dialled.

The editable part is the ssh **username**, which is the conceit: you connect as yourself
and the machine takes your word for it. It's swapped in as an `<input>` once the line
finishes typing, rather than typed into: you can't type into an input character by
character on a timer without fighting the caret. `connected · latent` is output, so it
prints whole and costs no time, only its dwell. **Typing is 30ms/char**, below the brief's
40-70 and by request: the ssh line is 27 characters, and at 40 it read as watching someone
hunt for keys rather than a machine connecting. Much faster and the username stops being
noticeable at all, which is the one thing on this screen worth finding.

**It's the overlay that is decoration, not the page.** The whole site is server-rendered
underneath and merely covered, so crawlers and no-JS get the content directly. That is
load-bearing in three places, and all three are easy to break:
- **noscript drops it** (`layout.tsx`). It's in the server's HTML, so without JS to
  dismiss it the site is a black rectangle with a 200 on every request.
- **A CSS failsafe** (`boot-failsafe`, 10s) drops it too. noscript does not cover a
  bundle that 404s or a hydration that throws — JS is *enabled*, just dead, and the
  overlay would sit there forever. 10s is past the boot but not past someone typing.
- **`prefers-reduced-motion` hides it in CSS**, not just in the effect: waiting for
  hydration to skip it would flash the overlay first.

The clock accumulates only while the username is unfocused, so **focusing it pauses the
boot** rather than racing it. Nothing else stalls it. Scroll is locked while it runs (a
stray wheel event would scroll the hidden page and show when the overlay lifts).

**Any key or click skips it** (~456ms to gone: the fade, nothing else). The trap is that
the one thing worth staying for lives ON this screen, so a naive "any keypress" fires on
the first letter of your own name. Four exemptions, all real, all tested: typing while
the username has focus; clicking the username; `Tab`, or the boot vanishes the instant a
keyboard user reaches for the field; and Ctrl/Cmd/Alt combos, which belong to the
browser. A skip still runs the normal `done` path, so it releases the swarm too — never
short-circuit past `markBooted()`. Known and accepted: the overlay is server-rendered, so
a key pressed in the ~300ms before hydration does nothing. Fixing that needs inline
script, and the sequence isn't running yet anyway.

**The name  *(`lib/identity.ts`)*.** Change who you connect as and every prompt on the
page follows — this one and every section panel's boot log. That's why the name is a
store rather than boot-screen state: the panels are nowhere near it in the tree.
`useSyncExternalStore` with a server snapshot pinned to `neelay`, so SSR and the first
client render agree. Input is folded to `[a-z0-9._-]`, max 12 chars, so a paste can't
push the prompt across the viewport. **Deliberately not persisted**: a reload restores
`neelay`, so the toy can't strand anyone in a state they can't undo, and there's no
storage read to trip hydration. Verified: typing `Ada Lovelace!!` yields `adalovelace`
and every panel prompt becomes `adalovelace@latent:~$`.

The affordance is one dashed underline. Discoverable only if you're reading that line,
which is the brief. It's also the only thing in the overlay that isn't `aria-hidden` —
a screen reader gets the labelled control, not the theatre around it.

**Superseded: the CSS `.type-in` hero prompt.** It typed by animating `width` in `ch`
steps over text already in the DOM, which got no-JS and reduced-motion for free. It could
not survive a sequence that pauses for input and gates the page on its own completion.
It didn't need to: the content was never inside the animation, so the guarantee moved to
the overlay being decoration over a rendered page. `HeroPrompt.tsx` is gone; don't
reintroduce a second prompt in the hero.

### The boot beat is also the preload window  *(`lib/warm.ts`, `HeroBoot.tsx`)*

The boot screen gives ~2s of cover, and `warmBackground()` spends it. The two are
**parallel and share nothing**: the warm never waits on the typing, the typing never
waits on the warm. `HeroBoot` owns it (it also flips `data-tab-hidden` on `<html>`
so cursors park when you leave the tab — there's no CSS query for tab visibility).

**What's worth warming is not what you'd guess. Measured in-browser:**

| when | fetched |
|---|---|
| page load, hero only | **3.63 MB** — `diffusion_traj.json` + `ascii_traj.json` |
| reaching `#chess` | **25.01 MB** — of which **onnxruntime-web is 24.44 MB** |
| reaching `#diffusion` | 0, already loaded |

- **The trajectory JSONs need no help.** The first section is inside the viewport at
  load on every size checked, so its observer fires immediately and the 3.63MB is
  already in flight. Warming them is a no-op. Don't add it back.
- **The entire cost is the ORT runtime**, and it's shared by both model demos. So the
  warm is one call to `loadChessEngine()`, which pulls ORT + the 553KB int8 model.
- **Not the draw model.** Its own loader says first-interaction-only, and drawing takes
  deliberate interaction. Warming ORT already pays half its bill.

**Gated, because 24MB is the one thing on this page that could break "mobile above
all".** Vetoes: `saveData`, a known-bad `effectiveType`, `deviceMemory < 4`, and
`(max-width: 767px)`. Phones keep today's behaviour exactly. `navigator.connection` and
`deviceMemory` are Chrome-only, so **absent must mean "unknown", not "no"** — treating
absent as a veto would quietly make this Chrome-only and leave every Firefox and Safari
reader booting chess from scratch. The viewport check carries the decision. Verified:
desktop warms 24.44MB before any scroll, phone 0.00MB, `saveData` 0.00MB.

Warming runs on `requestIdleCallback`, not immediately: creating the session costs ~1s of
CPU (int8 load 964ms measured) and spending it during the hero would stutter the swarm,
the one thing here that can't pause. Being ready before the scroll is the point; being
ready a second sooner isn't. Every loader is a memoized promise, so the section's own
call later returns *that* promise instead of downloading again — which is also why the
warm calls the real loaders rather than raw-fetching the same URLs.

### Editable terminal params — the rule, and the per-demo ruling  *(NOT BUILT)*

The idea: make the numbers in each panel's command line editable so a visitor can change
a param and watch the demo re-run with it. **SHIPPED for §2 and §2b**
(`components/ambience/CommandLine.tsx`). §3 and §4 stay display-only; see the rulings.

**THE RULE, which outranks the appeal of the feature: a param is editable only if changing
it produces a real, corresponding change. When in doubt, display-only.** A number that
changes nothing is worse than a number you can't touch — it's the illusion breaking in
the visitor's hands, on a page whose whole claim is that the demos are real. This is the
same principle as "never fake a model's output", applied to a control instead of a canvas.

Per demo, ruled against what the code and data can actually honour today:

| command (`BOOT_CMD`) | live-editable | frozen, and why |
|---|---|---|
| `./sdedit --digit 7 --strength 0.6 --steps 20 --guidance 2 --dissolve 10` (§2b) | **all five** | — |
| `./x0_diffusion --digit 7 --steps 32 --schedule cosine` (§2) | `--digit` only | **`--steps` and `--schedule` are BAKED.** ⚠️ |
| `./entropy_chess --model int8 --sims 250` (§4) | `--sims`, **clamped to [250, 500]** ⚠️ | `--model`: the loader picks the build, not you |
| `./sample_space --target two-moons --compare ddpm,flow` (§3) | `--target` (4 shapes) | `--compare`: both fields ARE the comparison |

- **§2b `sdedit` is the hero of the feature.** `generate()` in `lib/ascii-diffusion.js`
  genuinely takes `strength`, `steps`, `guidance`, `dissolve` and `digit`, and streams
  frames as it computes, so every one of them produces a visibly different run. Ranges:
  strength 0-1 step 0.05, steps int ~5-40, guidance ~0-5, digit 0-9. Mind trap 1 — the
  panel passes `x0Init`, not a bare canvas, and that must survive any re-run path.
- **⚠️ §2 `x0_diffusion` IS THE TRAP.** It plays a **precomputed** trajectory: the frames
  are baked into `diffusion_traj.json` and there is no model to re-run. **Verified against
  the file: the distinct frame count across all 10 digits is `[32]` — exactly one step
  count exists** (same for `ascii_traj.json`). So the "snap to the nearest precomputed
  value" option has nothing to snap to, and `--steps` and `--schedule` stay display-only.
  `--digit` is genuinely live, because all 10 digits are in the file. **Do not let
  `--steps` look interactive here.** Re-run that check before changing this ruling; a new
  export with multiple step counts is the only thing that changes it.
- **⚠️ §4 `--sims` is live, and THE CLAMP IS THE MEASUREMENT — don't widen it.** It sets
  what `let it think` spends, over **[250, 500] step 50**, and that range is not taste.
  Below ~250 the search returns the *same move as 1-ply argmin* (see §4's tables), so a
  box that accepted 40 would spend 9 seconds to reproduce what the toggle already gives
  instantly — a control doing nothing, which is the exact thing the rule above forbids.
  Clamping to 250 is what keeps it honest: every value it accepts is a search that
  actually searches, and typing `10` snapping to `250` *teaches* the finding. The ceiling
  is 500 because that is the ladder's setting, the only count that found a mate the others
  walked into, and the most this can claim without leaving measured ground.
  - It configures the NEXT search rather than re-running: the engine has already moved,
    and re-answering a position the board has left would be a claim about a game that
    moved on. The echo says so.
  - The boot log owns `--sims` (the configured budget); the title bar owns
    `--search argmin|mcts` (what is running). **Don't put sims in both** — that puts two
    different numbers under one flag name.
  - This inverts an earlier ruling twice over. It first read "display-only until MCTS
    ships"; then, once MCTS shipped, "still no, a free-form box is a no-op below 250".
    The clamp is what resolves it: bound the range to where the param is real, and it is
    real. **Re-measure before widening.**
- **§3 `--target` is live: four shapes** (two-moons, spiral, ring, 8-gaussians), as a
  `<select>` in the command line. This is squarely inside "§3 may change the animation but
  must not imply weights re-ran" — the manifolds are closed-form 2D geometry, so there is
  nothing to re-train and nothing to fake, and the panel stays as illustrative as it was.
  The label has to keep being true.
  - **⚠️ EVERY SHAPE MUST BE DETERMINISTIC** (`hash01`, never `Math.random`). Flow
    matching's whole claim here is "the same route every time", and `targetFor` picks a
    start's destination by hashing INTO the manifold array. One random call in a shape
    silently makes flow paths jump between renders and destroys what the panel exists to
    show. Same rule as `flowPath`'s bow.
  - Switching clears live trails: they end on the old manifold and would hang in mid-air
    pointing at a shape that is no longer there.
  - The spiral spaces points by `sqrt(i/n)`, not `i/n`: for r proportional to t the arc
    length grows as t², so linear spacing leaves the outer turns threadbare.

**How it's built** *(`components/ambience/CommandLine.tsx`)*
- **It lives in the BOOT LOG's command line, not the panel's title bar.** The title bar
  `truncate`s and the sdedit line is ~60 characters; the log is body-width. This is why
  the ruling table above is keyed on `BOOT_CMD`.
- **The swap-in is the boot screen's trick, for the boot screen's reason.** The boot TYPES
  the command a character at a time, and you can't type into an input on a timer without
  fighting the caret. So the line types as plain text and `BootLog` swaps `command` in once
  `done` flips. **`BOOT_CMD` and the params' defaults must be built from one source** —
  they are, via `DEFAULTS` in each panel — or the line visibly rewrites itself at the
  handover.
- **⚠️ `aria-hidden` moved off `BootLog`'s wrapper onto its pieces.** It used to wrap the
  whole log, correctly, when every character was theatre. An aria-hidden ancestor hides
  descendants whatever they declare, so leaving it would have made the params work fine
  and simply not exist for anyone not using a mouse. Same rule as the boot screen's
  username: hide the theatre, expose the control.
- Inputs take the flag's own colour and size with a dashed underline as the entire
  affordance (BootScreen's username, again); teal only on focus. **Frozen flags are a
  separate prop** and render as bare text with no underline and no hover — that visible
  difference is what tells you which numbers are controls and which are facts about a
  file. `CommandLine` never parses flags out of a string, so a baked param cannot
  accidentally become editable.
- Commit on Enter or blur, Escape abandons. **Clamp HARD**: `snap()` rounds to the step
  grid then into range, so 999 becomes 40 rather than reaching the module. A draft string
  is held while typing or you could never type "0." on the way to "0.5"; a blur with no
  draft is a no-op, which matters because disabling a focused input blurs it.
- **⚠️ A re-run must pass the new value EXPLICITLY** (`generate({ steps: v })`). The commit
  re-runs in the same tick it calls `setState`, so reading state would re-run with the
  number the visitor just changed away from, and the param would look broken.
- **⚠️ §2b has exactly one call site for `model.generate()`, on purpose.** It passes
  `x0Init`, which is the only way to get `inkIsHigh` right (trap 1 below). A second call
  site that forgot would feed the model a photographic negative: no error, just plausible
  garbage that reads as the diffusion being broken. Every re-run routes through `generate`.
- Re-runs only fire when there IS a run to redo (a previous frame, ink, a loaded model).
  Changing a number before drawing shouldn't invent a run. The echo line
  (`re-running --steps 40…`) is `role="status"`, because it is the confirmation that the
  number did something. §2 gets no echo: it plays a stored trajectory, and "re-running"
  would claim a model ran.
- Reduced-motion still allows editing; the boot just resolves instantly, and the inputs
  swap in with it.

## Sections (single scrolling page)

### 1. Hero — particle swarm  *(`components/ambience/Swarm.tsx`)*
One fixed, full-viewport canvas behind the page content. Particles do Langevin descent
into wells carved from whatever text the ACTIVE station declares.
`components/EnergyHero.tsx` is now only markup — the real `<h1>`, the sub-text, the
caption and the links. It owns no sim.

**TODAY THERE IS EXACTLY ONE STATION: the hero nameplate.** Section labels down the page
were built, shipped, and then removed. A swarm that re-forms all the way down is a
full-page canvas that never stops moving, which reads as noise on a phone; the CharField
covers that ground far more cheaply (see Page ambience §2). The gap above each panel now
gets `ResolveText` instead — real text that resolves out of noise once and then sits
still.

**That is what buys back the off-screen pause.** With the swarm confined to the hero, an
IntersectionObserver stops the loop once no station is on screen, so scrolling the rest of
the page costs nothing and the last frame is cleared rather than stranded mid-air. A
migrating swarm structurally could not do this — the canvas IS the viewport. **This
file used to record the opposite as a deliberate trade. That amendment is dead; don't
resurrect it.**

**The multi-station machinery stays** because it costs nothing and it's the seam: adding
any element with `data-swarm` brings stations back. Declared in the DOM, not hardcoded —
its text is the attractor and its box drives placement and font size. Layout owns where,
Swarm owns physics.
- `data-swarm="NEELAY|RANJAN"` — `|` splits lines
- `data-swarm-align="left|center"`, `data-swarm-frac` — text width as a fraction of the box
- `data-swarm-frac` is the DESKTOP fraction; it ramps up by `NARROW_FRAC_BOOST` (0.2) as
  the viewport narrows to 640px. Without that the nameplate is unreadably small on a
  phone — the pre-Swarm hero did this, it got lost in the move, and it had to come back.

**IF STATIONS EVER RETURN: use the gaps, not the headings.** The obvious idea is to
assemble each section's `<h2>`. It cannot work: the h2s live inside `TerminalPanel`,
which is opaque (`bg-panel`), and the canvas is behind the content. A station on a
heading is invisible. Stations go in open background. Don't "fix" this without also
making panels translucent.

**Two stacking traps, both of which silently blank the swarm:**
- The canvas is `fixed ... -z-10`, which paints ABOVE html's background but BELOW any
  background `body` paints. **`body` must stay transparent** — the base colour and
  dot-grid live on `html`. Put a background back on `body` (or `bg-base` on the body
  element) and the swarm vanishes while the canvas keeps happily rendering to itself.
  **This blanks the CharField (`-z-20`) with it** — the whole back-to-front order is
  `html` background → CharField (-z-20) → swarm (-z-10) → content → grain (`body::after`,
  z-60), and it only holds while `body` paints nothing. (One exception, and it's why the
  boot screen can carry its own field: `z-50` makes the overlay a stacking context, so a
  negative-z child inside it paints above the overlay's own background but below its
  lines, rather than escaping to the back of the page.)
- The canvas is `pointer-events: none` and drag is handled on `document`, bailing on
  `section, a, button, input, textarea, select`. A full-viewport canvas that ate clicks
  would break every link and control on the page.

**⚠️ The hero's dead zone lived in `bh * 0.86`, and it is a SPACING constant.** The
nameplate is centred in its station box and `FONT_MAX` (130) caps the font, so the ink is a
fixed ~219px tall *however tall the box is* — every extra pixel of box height becomes air,
split evenly above and below. That is why the hero once had **108px of nothing** between
the name and the tagline (measured: box 0..440, ink 113..332, tagline at 440). Two things
that do NOT fix it: shrinking the box alone (the air just scales down with the font), and
raising `data-swarm-frac` (that drives WIDTH, and `FONT_MAX` caps the result anyway).
Raising the height fraction from 0.62 to **0.86** is what closes it while keeping the name
at full size. With the box at `max-h-[336px]`: ink 62..280, gap **56px**, name still 130px.
Re-measure if you touch either number.

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
- `T = max(0.22, 2.1 * exp(-age_ms / 1400))` — anneals from the swarm's FIRST FRAME,
  which is **gated on the boot screen lifting** (`lib/booted.ts`), not on page load.
  This is not optional polish. The boot covers the canvas for ~2.5s, so starting at load
  spent the entire descent behind an opaque overlay: by the reveal, age was ~2900ms, T had
  decayed to ~0.26 against its 0.22 floor, and the nameplate was simply already settled.
  The one deliberately loud thing on the page, missed. Released at the START of the fade,
  so it is ~420ms in (T still ~1.55) when the overlay clears — mid-descent, rather than an
  empty gap that pops. Measured: 0 lit pixels during the boot, 58.8k at the reveal
  settling to 49.0k. `age` only advances inside the sim loop, so gating the loop is enough
  to hold the clock.
- `force = -energyGradient*10 + (home - pos)*HOME_PULL*(1 - 0.7*heat) + noise*(T + heat*2.6)`
- Integrate: `vel = vel*0.82 + force*0.4; pos += vel*0.5; heat *= 0.94`.
- **`HOME_PULL` is 0.1, not the 0.02 the original spec gave.** Inside a letter the energy
  is flat, so its gradient is ZERO and the home pull is the only thing holding a particle
  on its outline. At 0.02 it loses to the `T=0.22` noise floor: the nameplate reads as
  fuzz and small labels are illegible outright.

**Migration and panel avoidance — both DORMANT at one station.** Neither fires today
(nothing to migrate to, and the hero has no panel over it). They're the other half of the
station seam, kept for the same reason and documented so a future station doesn't
rediscover them the hard way:
- **Migration.** On a station change, `transit` flips: a plain capped spring pulls
  particles across the page, with the energy gradient and noise switched OFF (both are
  meaningless that far from the box and just smear the trip). Normal Langevin resumes
  once they land.
- **Panel avoidance.** Panels are opaque, so a swarm crossing one disappears for the
  length of the trip. `data-swarm-avoid` on `TerminalPanel` marks the obstacle; particles
  get shoved **horizontally** out to the gutter. Horizontal, NOT toward the nearest edge:
  a panel is far wider than it is tall, so "nearest edge" is usually the top, which
  shoves a descending swarm back where it came from and stalls it. Gated on gutter width
  — under ~44px of margin there's nowhere to route to, so it switches off rather than
  flinging particles off-screen.

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
- **Pauses off-screen** (IntersectionObserver on the stations, `80px` rootMargin) and on
  tab-hide. Both are taken. The canvas stays mounted — it's fixed and full-viewport;
  only the sim halts.
- `prefers-reduced-motion`: no sim, no kicks, no drag. Draws the resolved outline of the
  active station and redraws it on scroll — a fixed nameplate that followed the reader
  down the page would be worse than the motion.

### 2. Diffusion trajectory viewer — two models, one component  *(`components/DiffusionVisualizer.tsx`)*
A `TerminalPanel` with a `[pixel | ascii]` toggle and two side-by-side grids: `x_t` (the
current state) and `x̂₀` (the model's guess at the finished digit). Layout, scrubber,
playback and digit picker are identical across modes — only the cell renderer and the
copy differ, which is why it's one component. **Default pixel**; ascii is opt-in.

Both trajectory files are REAL, trained output. There is no placeholder any more, and the
generator that used to write one is **deleted, deliberately**: it wrote to the same path
as the real export, so running it would have destroyed 3MB of trained data. Don't add a
placeholder generator back. If a trajectory file is missing, gate on its absence and say
so (see the §2b history and the Constraints recap).

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

**Render `ascii.xt`, not `ascii.x0` — IF YOU ONLY HAVE ONE PANEL.** `xt` tells the whole
story on its own: drawing → static → digit. `x0` alone hides the dissolve completely,
because during the forward half it is just the drawing held still.

**Amended 2026-07-15: there are now three columns, and x̂₀ is the third.** With both up,
that stillness stops being a bug and becomes the point — x̂₀ sits frozen for the entire
dissolve and starts moving the instant the denoise begins, which is the model switching on,
visibly. It costs nothing (every frame already carries it) and it fills a panel that had
342px of dead space to the right of two 280px canvases. §2 shows the same pair for the same
reason. Tint: indigo while inert, teal once it is really predicting; no third colour.

**The label picker paints the classifier's actual scores.** `classifyDrawing` always
returned `scores[10]` and `margin`; the panel used to keep the argmin and bin the rest. Each
0-9 button now carries a teal background at `fitness(scores)` × `FIT_ALPHA` (0.28).
- **Min-max within the run is the honest normalisation.** The raw numbers are
  reconstruction MSE, lower-is-better, on no fixed scale (they depend on how much ink you
  drew), so an absolute threshold would mean nothing. The consequence is that one label is
  always 1.0 and one always 0: **this ranks, it does not score confidence.** `margin` is
  what carries confidence, and it drives the caption's "close to a coin flip" / "not close".
- **⚠️ The tint is not the only carrier.** Colour alone would put the whole classifier
  behind seeing it, so the fit goes in each button's `aria-label` too.
- Backgrounds only — the border stays the picker's selected state, so the model's opinion
  and your choice never contest the same pixels. `FIT_ALPHA` above ~0.3 makes the winner
  read as "selected" and starts that fight.
- Cleared with the canvas: scores describe a drawing that no longer exists.
- Verified in-browser, and this is the proof it isn't decoration: a single vertical stroke
  ranks `1:100% 0:0%`; a loop ranks `6:100% 9:88% 0:44% 1:0%`. Two drawings, inverted
  rankings. (It picks 6 over 0 on a crude loop — approximate by construction, which is what
  the picker is for.)

**⚠️ A one-stroke digit never got a guess at all, and it hid for months.** The first stroke
is what starts the 26MB download, so the classify it schedules 450ms later runs while
`model` is still null and bails out silently. Every *later* stroke worked, which is exactly
why nobody noticed: test with a two-stroke digit and it looks perfect. Fixed with an effect
keyed on `model` alone, firing on the null → loaded transition.

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
the expected result for the mover in [-1,1]. **1-ply argmin** (~130-200ms/move) by
default, with the Pi's real MCTS behind an opt-in (see "the search" below).

**chess.js owns every rule.** Never hand-roll chess logic.

**The pieces.** `lib/chess-engine.ts` is a thin **worker client** and holds no model at
all (`loadChessEngine()` is still a memoized promise resolving null when the weights are
absent — it's what the preload window warms, and its signature deliberately didn't change
when the worker landed). `lib/chess-worker.ts` owns the ORT session, the encoder and the
search; `lib/chess-mcts.ts` is the search itself; `lib/chess-protocol.ts` is the wire
between them. **onnxruntime-web is imported in the worker and nowhere else** — import it
from a component and 24MB lands back in the page bundle, which is the whole thing the
worker exists to prevent. `components/ChessBoard.tsx`
is the renderer, **shared by the game and the interpretability view**: square geometry,
the FEN parse and the glyphs live there exactly once, and the overlay is a prop on THAT
board rather than a second board. Two constraints that live in it: both colours use the
SOLID glyph set (the outline set renders at a different weight in most monospace fonts,
so a mixed set makes one side look faded — colour carries the side), and overlay alpha
caps at 0.6, above which the pieces stop being readable and the point of reading the map
*on* the position is lost.

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
WASM. They do, and vector C passes: `argmin=a1a8, prior=0.169, value=0.89`. So the browser
runs the genuine quantized model, not an fp32 stand-in: same trained weights, int8 build.
**But it is NOT the same file the Pi runs — the old "same artifact on both" pitch is dead.**
On the Pi's ARM cores fp32 is *faster* than int8, so the deployed on-device engine ships
fp32; the browser ships int8 for the opposite reason, because 553KB is a far smaller
download than fp32's 1.8MB. `chess-fp32.onnx` (1.8MB) also stays in the browser as a
fallback the loader uses only if a runtime rejects the int8 graph — losing the "int8" label
costs nothing user-visible; a wrong-answer engine would cost everything. Measured in the
browser: int8 load 964ms / infer 142ms; fp32 load 47ms / infer 128ms. **int8's win here is
download size, not speed** — which is exactly why the Pi, optimizing for speed over bytes,
runs fp32 instead.

**Draws are the SITE's job.** Search nodes drop move history, so the engine structurally
cannot see threefold repetition or the fifty-move rule, and left alone it shuffles in won
endgames — it donated 10 of 20 draws vs SF-2500 exactly this way. chess.js has the history:
the panel detects threefold, fifty-move, stalemate and insufficient material and ends the
game. Promotion has a piece picker. **Never call the engine on a finished position.**

**`hint` — the engine's move for YOU.** On demand, never standing: a hint that persisted
every turn would stop being a game and start being a solver. It is the SAME call the
engine makes for itself, not a second path — the encoder always builds from the side to
move (see the encoder notes above), so "its move" and "your move" are one computation, and
this needed no model work at all. Verified in-browser at startpos: `hint` returns
`g3 · p=0.236`, matching validation vector D's `g2g3 .236` to three decimals, which is the
proof it really is running white's perspective and not black's.
- Rendered as a two-square overlay: `from` at 0.4, `to` at 1.0, tinted **indigo**
  (`saliency`). Teal already means "the engine's own move map" on that board, and a hint
  is a different claim. A hint OUTRANKS the map — two overlays at once is two claims in
  two colours on one board.
- Cleared on every `fen` change. A hint describes one position; once the board moves it is
  a claim about a position that no longer exists.
- Gated on it actually being your turn, and on the game not being over — the same
  finished-position rule as everything else here. Round trip ~277ms measured in the
  browser at 1 ply, which is one forward pass over your legal moves.
- **It searches at whatever the toggle says, and that follows from "the same call".** At
  `let it think` a hint takes the same ~60s the engine's own move does. A hint that
  quietly ran cheaper would be a different engine's advice wearing this one's name.
- Carries the same caveat as the rest of the panel: it is what the model would play, not
  what's best.

**The interpretability view**  *(`components/ChessActivations.tsx`, `lib/chess-activations.ts`,
`public/chess_activations.json`, 43KB)*
The model's internals painted back onto the squares. **A mode on the same board as the
game, not a second board.** Two overlays: `energy attribution` (which squares move the
eval, indigo) and `layer activation` (mean magnitude per square, teal), with a depth
slider over 7 layers (`conv_in`, `res_1`..`res_6`) and a top-channel drill-down where the
export has one (today `res_5` and `res_6`). It names the hottest squares in words, because
the section's whole claim is that they're the squares a human would name too.

- **WHY THIS MODEL AND NOT THE DIFFUSION ONES.** The chess backbone is full-resolution:
  it never downsamples below 8x8 until the last layer, so every layer's activations stay
  registered to the squares and can be laid straight onto them. The diffusion UNets
  downsample to 7x7/4x4, so their mid-layers go spatially abstract. **Don't try this
  there.**
- **The curated scenarios ARE the feature.** 8 positions, each with a label written by
  whoever generated the export and asserted against python-chess (the fork really forks,
  Ra8 really is mate). One is from the author's own loss to the engine. Lead with them.
  Default is `fork_f7`, not startpos: it's the best first impression.
- **Precomputed, and NOT live — for a concrete reason.** The shipped `chess-int8.onnx`
  exposes only `["energy","value"]`. Live extraction needs a re-export marking the
  intermediate layers as extra outputs. The renderer takes 8x8 float arrays and does not
  care where they came from, so going live is a new loader and nothing else. **Keep it
  that way.**
- **Gated on the file's absence**, per the site's central rule: `loadChessActivations()`
  resolves `null` when the file isn't there and the toggle simply doesn't render. A
  plausible fake heatmap would teach the wrong thing about what the model sees.
- **READ `grid` and `layers` from the file; never hardcode the layer count.** The loader
  guards `version` and asserts `grid * grid === saliency.length` — a mismatch there is a
  silent off-by-N that lands every overlay on the wrong squares.

**Copy — accurate claims only.** Current claim is **roughly 1900–2200** vs Stockfish's
limited modes (new testing, 2026-07-24), or "master-ish". **Never claim 2300+ flat**: rung
labels compress. This new testing is the source of truth now: it supersedes the earlier
`entropy-chess/docs/2026-07-15-elo-ladder.md` (~2000 conservative / ~2330 ±41 nominal, int8,
500 sims, 0.5s/move ladder), the resume's 2250, and ARCHITECTURE.md's older 1850-2000 — the
site lede says 1900–2200. Quantization cost is inside the noise: **-14 ±59 Elo** (int8 vs
fp32), i.e. ~0. If the site ever quotes latency, quote what you measure in the browser — not
the Pi's numbers.

**The search — SHIPPED, and it is a toggle, not a ladder**  *(`lib/chess-mcts.ts`,
`lib/chess-worker.ts`)*
An exact port of `pi/mcts.py`: PUCT `Q + 1.5 * prior * sqrt(N_parent+1)/(1+N_child)`, leaf
value flipped every ply on backup, terminals exact (±1/0, never call the model), play the
most-visited root child. It runs in a Web Worker, which is not optional: a search is ~60s
of solid compute, and on the main thread that is a minute of frozen page.

- **The UI is `1 ply` (default) and `let it think` (250 sims, ~60s). THE HANDOFF'S
  DIFFICULTY LADDER WAS BUILT AND THEN DELETED — don't rebuild it.** casual 40 / club 120
  / strong 250 / max 400 are the *Pi's* tiers, and in a browser three of them are wired to
  nothing. Measured against Stockfish depth 12 on 24 on-distribution positions, **16, 48
  and 96 sims return the same move as 1-ply argmin in 23 of 24 positions** (mean cp
  438.6 → 438.3, median 16.5 → 16.5, SF agreement 11/24 for all four). They are the same
  engine, 3-20 seconds slower. That is exactly the "control wired to nothing" the editable
  params rule forbids.
- **Why it costs what it costs, measured in Firefox and both counter-intuitive.** (a) The
  model's cost is **per-board, ~6.6ms, flat from batch 8 to batch 256** (batch 8 = 60ms,
  32 = 208ms, 256 = 1683ms; fixed overhead only ~15ms). So **leaf-batching / virtual loss
  buys nothing** — 8 leaves in one call costs 8x. (b) **Threads do nothing**: 1 thread and
  16 threads both land at ~6.5ms/board on a 20-core box (ORT defaults to 4). 469K params
  over 8x8 is too small to parallelize. One sim = 6.6ms × legal moves ≈ 230ms, hard floor.
  The Pi's 500 sims is ~2 min/move here.
- **250 is where it starts paying**, on 30 positions: argmin 8.5 median / 15-30 SF
  agreement → 250 gives 6.5 / 18-30. 150 is inside the noise. ⚠️ 500 shows mean cp 34.9 vs
  ~350, which looks spectacular and **is one position**: it was the only setting to find a
  mate everything else walked into (9551cp → 34cp), and that single fix is the whole mean.
  Its median is *worse*. Deep search buys blunder-avoidance, not everyday accuracy.
- **The port is verified exact, independently of the model.** Both `pi/mcts.py` and
  `lib/chess-mcts.ts` were run against an identical deterministic fake evaluator (FNV-1a
  over the position + UCI) across 4 positions × {8, 64, 200} sims. All 12 cases match on
  best move, on **every** root move's visit count, and on every Q to 1e-6. Re-run that
  before believing any change here is harmless; it isolates search bugs from weight
  differences. (Scripts: scratchpad `port_ref.py` / `port_ts.ts`.)
- **⚠️ Terminal detection is python-chess's `outcome(claim_draw=False)` and NOT chess.js's
  `isDraw()`/`isGameOver()`.** Those fire at the FIFTY-move rule (halfmove ≥ 100); the
  reference only ends at SEVENTY-FIVE (≥ 150). Using chess.js's notion would score
  positions as dead draws that the reference still hands to the model, changing the search
  in exactly the long endgames this engine is weakest in. Repetition blindness is
  inherited on purpose (nodes hold a FEN, no history) — that IS the Pi's known ceiling.
- Verified in-browser: 250 sims = **60.4s**, 134 progress ticks rendered, and **135 rAF
  round-trips under 100ms while it searched** — the main thread never blocked. Root visits
  came back n=85 / 56 / 29, and the most-visited move was NOT the top prior (p=0.171 beat
  p=0.235). The search overruling the policy is the thing worth showing.

### 5. Research
Clean cards for publications and projects. **Not built — the section does not exist in
`app/page.tsx` at all.** (This file previously implied a stub was in place; there isn't
one.) `Section` already supports it: pass `title`/`lede` for a prose section and it
renders them above the content, which is exactly the path terminal sections skip.

Real content (paper titles, NASA/Regenstrief bullets, links) comes from
`content/resume-notes.md`. Three of four publications are "in preparation" — decide how
to present unpublished work before building the cards, not after.

### 6. Live preview: multi-agent robustness
A small `TerminalPanel` animating a committee of agent nodes reaching — or failing to
reach — consensus, with a covert minority visibly influencing the outcome. Stub the
data/logic behind a clean interface. Framing on the page is research-forward: "how
multi-agent systems fail under adversarial pressure," not a how-to.

## Model artifacts and the ONNX runtime

Everything in `public/` and `app/` that isn't code. All of it is git-tracked and ships to
Vercel.

| path | size | what |
|---|---|---|
| `public/diffusion_traj.json` | 3.0 MB | pixel trajectories, 10 digits x 32 frames |
| `public/ascii_traj.json` | 586 KB | discrete/mask trajectories, same shape |
| `public/chess_activations.json` | 43 KB | precomputed saliency + layer activations, 8 curated positions |
| `public/models/mnist_x0.onnx` | 26 MB | the pixel model, for live draw-a-digit |
| `public/models/chess-int8.onnx` | 553 KB | the chess EBM (the Pi's artifact) |
| `public/models/chess-fp32.onnx` | 1.8 MB | chess fallback |
| `public/ort/*` | ~37 MB | onnxruntime-web's wasm, vendored |
| `public/og.png` | 508 KB | the share card, `scripts/gen-og.mjs` |
| `app/icon.svg` | 1.1 KB | **the favicon's source of truth** |
| `app/icon.png` / `apple-icon.png` / `favicon.ico` | ~5.5 KB | derived, `scripts/gen-icons.mjs` |
| `lib/ascii-diffusion.js` | 12 KB | the model module, vendored |

**~70MB of binaries live in git history.** Worth a Git LFS decision; flagged, not decided.

**The two generator scripts are hand-run, and must NOT be wired to `prebuild` the way
`sync-ort.mjs` is.** Both need a Playwright browser binary, which Vercel's build image
doesn't have — wiring either one would take the whole deploy down to regenerate files
that only change when their source does. Their outputs are committed artifacts. Run them
by hand, commit the result.
- **`scripts/gen-icons.mjs`** rasterizes `app/icon.svg` → `app/icon.png` (32), 
  `app/apple-icon.png` (180), `app/favicon.ico` (16+32). Edit the SVG and re-run rather
  than hand-editing four files that then drift. Next serves these by file convention
  (`app/icon.*`, `app/apple-icon.*`, `app/favicon.ico`) and emits the `<link>` tags
  itself — there is no `metadata.icons` config, and adding one would fight the
  convention. The dark tile is baked into the mark on purpose so it reads on light
  browser themes; don't make it transparent. ICO is hand-encoded (PNG-in-ICO) since
  Playwright can't write one.
- **`scripts/gen-og.mjs`** screenshots the **live hero** at 1200x630 @2x — a real frame
  of the settled swarm, not a mockup. Needs a dev server on :3000, waits 7s for the
  anneal, and hides the Next dev overlay first (it would otherwise ship in the card).
  `metadataBase` in `layout.tsx` is required or the relative `/og.png` never resolves and
  the card unfurls with no image.

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

**The chess worker is bundled by Turbopack from `new Worker(new URL("./chess-worker.ts",
import.meta.url), { type: "module" })`** — it must stay a literal `new URL`, or the
bundler can't see the dependency and it 404s.
- **⚠️ A red herring that looks exactly like a shipping bug, verified harmless.**
  `next build` also drops the RAW, uncompiled worker source at
  `.next/static/media/chess-worker.<hash>.ts` (the dev server never does), and Next serves
  it as `video/mp2t` — the MPEG-transport-stream MIME for `.ts`. That is the same shape as
  the ORT asyncify trap below, so it reads as a module worker about to be rejected on MIME
  type. It is not: the file is a side effect of `new URL()`'s asset semantics and is never
  fetched; the worker loads from compiled chunks via `turbopack-worker-[client-fs]`.
  **Confirmed against a real `npm start`, not a dev server**: engine reaches `int8 · your
  move`, zero console errors, vector D returns `g3 p=0.236`. Don't spend an afternoon
  fixing it. Do re-run that prod check if the worker ever stops loading.

**⚠️ The dev overlay's "N Issues" badge counts a warning the dev overlay itself causes.**
Investigated 2026-07-15 and it is a red herring, in the same family as the worker MIME one
below. Next's dev overlay loads its OWN copies of Geist (`__nextjs-Geist`,
`__nextjs-Geist Mono`), which makes Firefox report the *page's* font preloads as
"preloaded with link preload was not used within a few seconds". Measured: **dev = 5 font
fetches + 2 warnings; production = 3 fetches, 0 warnings, no overlay.** There is no
hydration mismatch — a real one appeared in an old dev log and turned out to be a Fast
Refresh artifact from a mid-edit broken build, which is worth knowing: **a hydration error
in a dev log that followed a Fast Refresh full reload is not evidence of a bug.** Confirm
against a real `npm run build && npm start` before chasing it.

**COOP/COEP headers are set on every route** (`next.config.ts`). They enable
cross-origin isolation → `SharedArrayBuffer` → multi-threaded WASM. Without them ORT is
pinned to one thread. **This does nothing for the chess model** (1 thread ≈ 16 threads,
measured — see §4), but the draw demo still needs it: a zero-shot classify goes ~1s → ~17s
without it. Don't remove them on the strength of the chess numbers. **This is a real constraint on the whole site**: any future
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

**Built and verified:** scaffold + theme + `TerminalPanel`/`AsciiGrid`; the hero swarm
(§1); the trajectory viewer in both modes on real trained data (§2); live draw-a-digit
with the real ONNX + zero-shot auto-label (§2b); sample-space (§3); the chess engine at
1-ply on the real int8 build, with `hint` and the precomputed interpretability view (§4);
the MCTS port in a Web Worker behind `let it think` (§4); editable terminal params on §2
and §2b; page ambience (CharField, scroll spine, resolving labels, reveals, grain); the
terminal boot sequence, the ssh boot screen + editable identity, and the preload window;
favicon set and OG card; the README.

**The page is four sections today** (`app/page.tsx`): `#diffusion`, `#draw`, `#chess`,
`#sample-space`. §5 and §6 do not exist.

**Left, roughly in order:**
1. **§5 Research** — not built at all. Needs real content from `content/resume-notes.md`,
   and a decision on how to present three "in preparation" papers. **Blocked as of
   2026-07-15**: the work isn't shareable yet.
2. **§6 multi-agent robustness** — not started. Its node-graph watermark and the chess
   board-grid watermark (see Page ambience §5) land with their sections.
3. **Live chess activations** — a re-export exposing intermediate layers would turn the
   interpretability view live; the renderer is already source-agnostic (§4).
4. **A faster chess runtime is the only thing that unblocks deeper search** (§4). WebGPU
   is untested here (headless Firefox has no adapter, so it can't be measured on this
   box); int8-on-WebGPU is also poorly supported. Don't ship it unmeasured.

**Settled, don't relitigate:**
- **Git LFS: not needed.** The old note said "~70MB of binaries in history". It was wrong:
  `public/ort/` (~37MB) is gitignored and regenerated by `sync-ort.mjs` on prebuild, so it
  was never in history. Actual tracked binaries are ~31MB, dominated by the 25MB
  `mnist_x0.onnx` — under GitHub's warning threshold.
- **The repo is committed, pushed and Private** (`NeelayRanjan/portfolio`). The old note
  said nothing was committed. Still live: `content/resume-notes.md` IS tracked and holds a
  GPA, clearance eligibility and three unpublished paper titles. Fine while private; decide
  before it ever goes public.

**The resume is a link, not a file.** `PROFILE.resumeUrl` points at a Google Doc
`/preview` URL, deliberately not `public/`: the doc changes often, and an external URL
means updating it needs no commit and no redeploy. Left empty, the hero link simply isn't
rendered, so no dead link ever ships. Use `/preview`, **not** the `/edit?usp=sharing&ouid=…`
URL Drive hands you: `ouid` is the owner's account id and does nothing for a visitor,
`/edit` opens the editing chrome for a read-only viewer, and `/export?format=pdf` sends
`Content-Disposition: attachment` so it downloads a file instead of showing anything.

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
  off-screen where possible. **Everything animated pauses now**: the swarm on its
  stations leaving the viewport, the demos on theirs, the CharField on tab-hide (it's
  full-page, so off-screen is meaningless, and it's built to a ~10fps budget instead).
- Illustrative pieces must be labeled as illustrative. §1 and §3 are hand-built; §2,
  §2b and §4 are real trained models. Don't blur that line in copy.
- All physics runs on a dt-scaled clock (`k = dt / 16.67`) so it behaves the same at 30,
  60 and 144Hz. Schedules on wall-clock ms + physics per-frame = drift.

@AGENTS.md
