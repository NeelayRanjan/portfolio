# Framed Manuscript Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild neelayranjan.dev as the approved "framed manuscript" design: a dark preprint on a living desk, real-data figures, two live demos on page 1, /lab for the rest, all v1 theatre deleted.

**Architecture:** A sheet-on-desk layout system (`components/manuscript/*`) replaces all v1 chrome; demo *logic* (models, workers, loaders) is untouched and re-wrapped; research figures are derived from `external_materials/` by a hand-run script into committed `public/research/` assets; everything ships from a `redesign` branch promoted only on the owner's go.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4 (`@theme` tokens, no config file), next/font/google (STIX Two Text + Spline Sans Mono), onnxruntime-web 1.27, chess.js, Playwright (Firefox) for verification, ffmpeg (local only) for asset transcodes.

**Spec:** `docs/superpowers/specs/2026-09-11-site-redesign-design.md` — read it first; every task argues from it. Also binding: the demo contracts and Constitution in `CLAUDE.md`.

## Global Constraints

- Dark only; tokens exactly as spec §3 (`--desk #0c0b09`, `--paper #12110f`, `--panel #171511`, `--ink #eae5da`, `--mut #9a948a`, `--rule #2a2823`, `--hair #1d1c18`, `--red #e5352b`, `--link #7ba7dc`, `--green #63c68c`, `--amber #d9a45b`).
- `--red` is reviewer's ink ONLY (stamp, headline numeral, x0 masks, alert/miss). `--green` marks true "active" state only. No other accent uses.
- Never fake a model's output; every model-backed feature gates on its artifact's presence. A control that changes nothing real must not look interactive.
- Copy: first person, sentence case, **no em-dashes**, banned-word list per CLAUDE.md Voice; all visitor-facing strings live in `content/copy.ts`; "under review at JAMIA", never "published"; Elo is "roughly 1900–2200 vs Stockfish's limited modes".
- Mobile: nothing model-sized in flight at first paint; heavy figures mount on IntersectionObserver (reduced-motion included); desk field off below 880px; 16px minimum gutters; no horizontal scroll at 400px.
- Physics/animation on frame-time gates, pause on tab-hide, `prefers-reduced-motion` = static.
- Keep runtime deps exactly: `chess.js`, `onnxruntime-web`. No new npm deps.
- onnxruntime-web is imported in `lib/chess-worker.ts` and nowhere else; the worker stays a literal `new Worker(new URL("./chess-worker.ts", import.meta.url), { type: "module" })`.
- Verify against `npm run build && npm start` (prod), in real Firefox via Playwright; never trust dev-server-only behavior (CLAUDE.md traps).
- All work on branch `redesign`; push after every task (Vercel preview); never merge/promote without the owner's explicit go.
- End every commit message with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Branch + teardown to a green skeleton

**Files:**
- Modify: `app/page.tsx` (gut to a placeholder main)
- Modify: `app/layout.tsx` (drop Swarm/CharField/BootScreen mounts + noscript reveal CSS)

**Interfaces:**
- Produces: a building, deployable skeleton on branch `redesign`; `app/page.tsx` exports default `Home` rendering `<main/>` only. Old components stay on disk (deleted in Task 13) but are unmounted.

- [ ] **Step 1: Branch**

```bash
cd /home/neelayranjan/Documents/portfolio
git checkout -b redesign
```

- [ ] **Step 2: Gut the page**

Replace the entire body of `app/page.tsx` with:

```tsx
export default function Home() {
  return <main className="flex-1" />;
}
```

(Delete all v1 imports from the file.)

- [ ] **Step 3: Unmount v1 ambience in `app/layout.tsx`**

Remove the imports and JSX for `CharField`, `Swarm`, `BootScreen`, and the entire `<noscript>` block (the reveal/boot CSS it un-hides is going away). Keep fonts, metadata, and the `<body className="min-h-full flex flex-col">` shell for now.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds (unused components may warn, must not error).

- [ ] **Step 5: Commit and push**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "redesign: tear down to skeleton on branch"
git push -u origin redesign
```

---

### Task 2: Tokens, fonts, ground

**Files:**
- Modify: `app/globals.css` (replace v1 `@theme` tokens and html/body ambience rules)
- Modify: `app/layout.tsx` (STIX Two Text + Spline Sans Mono)
- Create: `scripts/measure-mono.mjs` (one-off advance measurement)

**Interfaces:**
- Produces: Tailwind utilities `bg-desk bg-paper bg-panel text-ink text-mut border-rule border-hair text-red-ink text-link text-ok text-warm` etc. via `@theme`; CSS vars `--font-serif`, `--font-mono`; body painted `--desk`.
- Produces: a recorded Spline Sans Mono advance measurement (decides Task 11's ASCII grid font).

- [ ] **Step 1: Rewrite the token block in `app/globals.css`**

Replace v1's `@theme` (and delete the v1 `html` dot-grid background, `body::after` grain, `.reveal`, `.boot-*`, `.type-in` rules — grep the file for each) with:

```css
@theme {
  --color-desk: #0c0b09;
  --color-paper: #12110f;
  --color-panel: #171511;
  --color-ink: #eae5da;
  --color-mut: #9a948a;
  --color-rule: #2a2823;
  --color-hair: #1d1c18;
  --color-red-ink: #e5352b;
  --color-link: #7ba7dc;
  --color-ok: #63c68c;
  --color-warm: #d9a45b;
  --font-serif: var(--font-stix);
  --font-mono: var(--font-spline-mono);
}
html { background: var(--color-desk); }
body { background: transparent; color: var(--color-ink); }
:focus-visible { outline: 2px solid var(--color-red-ink); outline-offset: 3px; }
```

- [ ] **Step 2: Swap fonts in `app/layout.tsx`**

```tsx
import { STIX_Two_Text, Spline_Sans_Mono } from "next/font/google";

const stix = STIX_Two_Text({
  variable: "--font-stix",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
```

Wire `${stix.variable} ${splineMono.variable}` onto `<html className=...>` (replacing the Geist variables) and set `<body className="min-h-full flex flex-col font-serif">`.

- [ ] **Step 3: Measure the mono's advance (spec §3 warning)**

Create `scripts/measure-mono.mjs`:

```js
import { firefox } from "playwright";
const b = await firefox.launch();
const p = await b.newPage();
await p.goto("http://localhost:3000");
const m = await p.evaluate(() => {
  const el = document.createElement("pre");
  el.style.cssText = "font-family:var(--font-spline-mono);font-size:100px;position:absolute;visibility:hidden";
  el.textContent = "0".repeat(100);
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width / 100 / 100; // em advance
  el.remove();
  return w;
});
console.log("Spline Sans Mono advance:", m.toFixed(4), "em");
await b.close();
```

Run against `npm run dev`, record the number in a comment at the top of `components/AsciiGrid.tsx`:
- If ≈ 0.600em: ASCII grids may adopt `--font-mono` in Task 11 with v1's line-height identity (`0.6 + letterSpacing`).
- If not: ASCII grids keep a dedicated mono (leave `AsciiLines` metrics untouched in Task 11) and the comment says why.

- [ ] **Step 4: Verify**

Run: `npm run build` (must pass). Load `npm run dev`, confirm the page ground is `#0c0b09` and serif text renders in STIX (View → fonts, or `getComputedStyle(document.body).fontFamily`).

- [ ] **Step 5: Commit and push**

```bash
git add app/globals.css app/layout.tsx scripts/measure-mono.mjs components/AsciiGrid.tsx
git commit -m "redesign: manuscript tokens and type"
git push
```

---

### Task 3: Manuscript primitives

**Files:**
- Create: `components/manuscript/Sheet.tsx`
- Create: `components/manuscript/Row.tsx` (Row + Note)
- Create: `components/manuscript/InstrumentFigure.tsx`
- Create: `components/manuscript/StatBand.tsx`
- Create: `components/manuscript/MissionRows.tsx`
- Create: `components/manuscript/Stamp.tsx`

**Interfaces:**
- Produces (exact signatures later tasks consume):
  - `Sheet({ children })` — the bordered page on the desk.
  - `Row({ children, rail, railAlign }: { children: ReactNode; rail?: ReactNode; railAlign?: "start" | "end" })` — anchored grid; prose left, rail right; stacks < 880px.
  - `Note({ tag, children })` — rail note: mono uppercase tag + serif italic body.
  - `InstrumentFigure({ n, caption, readout, children, id }: { n: string; caption: ReactNode; readout?: ReactNode; children: ReactNode; id?: string })` — panel, corner ticks, "Figure {n}." caption.
  - `StatBand({ caption, cells }: { caption: string; cells: { value: string; label: string; hot?: boolean }[] })`.
  - `MissionRows({ rows }: { rows: { when: string; who: string; what: string; status: "active" | "scheduled" | "complete" | "ongoing" }[] })` — lamp: active=ok+glow, scheduled=warm, else mut; status word always rendered beside the lamp (never color alone).
  - `Stamp({ children })` — red bordered, rotated, mono.

- [ ] **Step 1: Implement all six components**

Mirror the approved mockup (`vb21.html` in the mockup artifact) translated to Tailwind utilities on the Task 2 tokens. Key rules carried into code comments: Row grid is `md:grid md:grid-cols-[minmax(0,560px)_minmax(200px,1fr)] md:gap-x-12`; the rail has `border-l border-hair pl-6` on desktop and folds to `border-t` inline below 880px (use a `min-[880px]:` variant, not `md:`, for the split); InstrumentFigure corner ticks via two absolutely-positioned pseudo-like spans (`aria-hidden`); figure caption is serif 14px `text-mut` with `Figure {n}.` in 600 weight `text-ink`.

Representative (InstrumentFigure):

```tsx
export function InstrumentFigure({ n, caption, readout, children, id }: Props) {
  return (
    <figure id={id} className="relative my-8 border border-rule bg-panel p-5">
      <span aria-hidden className="absolute -top-px -left-px h-2.5 w-2.5 border-t-2 border-l-2 border-mut" />
      <span aria-hidden className="absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-mut" />
      {readout ? (
        <span className="absolute top-3 right-4 font-mono text-[11px] font-semibold text-warm tabular-nums">{readout}</span>
      ) : null}
      {children}
      <figcaption className="mt-3.5 text-sm leading-relaxed text-mut">
        <b className="font-semibold text-ink">Figure {n}.</b> {caption}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 2: Mount a smoke assembly**

Temporarily render in `app/page.tsx`: a `Sheet` containing one `Row` with a `Note`, one `InstrumentFigure` with a readout, a `StatBand` with 4 cells (one `hot`), `MissionRows` with the 4 real experience rows (spec §5), and a `Stamp`.

- [ ] **Step 3: Verify at three widths**

`npm run build && npm start`; Playwright-Firefox screenshot at 1280 / 880 / 400px wide. Check: rail beside prose at 1280, folded inline at 400; no horizontal scroll at 400 (`document.documentElement.scrollWidth <= innerWidth`); ticks and lamp colors present.

- [ ] **Step 4: Commit and push**

```bash
git add components/manuscript app/page.tsx
git commit -m "redesign: manuscript primitives"
git push
```

---

### Task 4: DeskField

**Files:**
- Create: `components/manuscript/DeskField.tsx`
- Modify: `app/layout.tsx` (mount it as first body child)

**Interfaces:**
- Produces: `DeskField()` — client component, `<canvas className="fixed inset-0 -z-10" aria-hidden>`; self-managing.

- [ ] **Step 1: Implement**

Port the field loop from mockup `vb21.html` to a client component with the spec §4 budget, all as code (not comments): particle count `Math.min(450, floor(w*h/4200))`; 40ms frame gate (~25fps); DPR forced 1; `document.hidden` skips frames; **matchMedia `(min-width: 880px)` gates the whole loop and hides the canvas below it** (listen for changes; stop/start accordingly); `prefers-reduced-motion` paints one static frame and never animates; cursor scatter radius 120px with red-tinted (`rgba(229,53,43,0.45)`) hot particles, idle particles `rgba(154,148,138,0.3)`; trail fade fill `rgba(12,11,9,0.18)`.

- [ ] **Step 2: Verify behavior, not just pixels**

Prod build + Playwright-Firefox:
- 1280px: sample the canvas via `toDataURL` twice 500ms apart → frames differ (it animates) and >1000 non-desk pixels exist.
- 500px viewport: canvas `display:none` or repaint loop idle (assert no frame difference).
- Emulate `reduced-motion`: two samples identical.

- [ ] **Step 3: Commit and push**

```bash
git add components/manuscript/DeskField.tsx app/layout.tsx
git commit -m "redesign: the desk field"
git push
```

---

### Task 5: prepare-research.mjs + committed research assets

**Files:**
- Create: `scripts/prepare-research.mjs` (hand-run; NEVER wired to prebuild — Vercel has no ffmpeg and no external_materials)
- Create (outputs, committed): `public/research/angiogram.webp`, `public/research/mask_x0.png`, `public/research/mask_sam.png`, `public/research/label_efficiency.json`, `public/research/flight_lm_day.mp4`, `public/research/flight_poster.webp`, `public/research/provenance.json`

**Interfaces:**
- Produces: `label_efficiency.json` shape (Task 6 consumes verbatim):

```json
{ "version": 1, "trainSize": 320,
  "models": { "x0diffusion": [ { "fraction": 0.05, "labels": 16, "diceMean": 0.882, "diceStd": 0.0, "n": 0 } ] } }
```

- Produces: `provenance.json` recording chosen image id, source tarball names, and date — the public-dataset audit trail (spec §5 Figure 1).

- [ ] **Step 1: Write the script**

Node, no new deps; shells out to `ffmpeg` (assert available, else exit with instructions). Behavior:
1. Extract both tarballs to a temp dir under the scratchpad.
2. Aggregate `all_metrics_combined_long.csv`: group by (model, fraction), mean/std of `dice`; `labels = Math.round(fraction * trainSize)` with `trainSize = 320`; **assert** `round(labels(0.05)) === 16` and `abs(x0diffusion@0.05 diceMean - 0.882) <= 0.01` — on failure print the computed value and exit 1 without writing.
3. Pick the wipe image: for each `image_index` with masks present in `predictions_cache/x0diffusion/frac0.05_fold1/` and `predictions_cache/sam/`, compute per-image `dice(x0) - dice(sam)` at fraction 0.05 from the CSV; print the top 5; take `--image <id>` or default to the top one.
4. Emit assets: angiogram jpg → `angiogram.webp` (ffmpeg, `-map_metadata -1` to strip EXIF); the two prediction masks → PNG copies re-encoded via ffmpeg (`-map_metadata -1`); `flight_lm_day.mp4` copied + `flight_poster.webp` from frame 0 (`ffmpeg -i ... -frames:v 1`).
5. Write `label_efficiency.json` and `provenance.json`; print everything it chose.

- [ ] **Step 2: Run it and eyeball the outputs**

```bash
node scripts/prepare-research.mjs
```

Open the three images; the x0-vs-SAM difference must be legible at a glance (if not, rerun with `--image` using the printed top-5). Confirm `label_efficiency.json` headline row.

- [ ] **Step 3: Assert no EXIF survived**

Run: `ffprobe -v error -show_entries format_tags public/research/angiogram.webp` → no maker/GPS tags.

- [ ] **Step 4: Commit and push**

```bash
git add scripts/prepare-research.mjs public/research
git commit -m "redesign: research assets derived from paper data"
git push
```

---

### Task 6: The three research figures

**Files:**
- Create: `components/figures/WipeFigure.tsx` (client)
- Create: `components/figures/EfficiencyFigure.tsx` (server; inline SVG)
- Create: `components/figures/FlightFigure.tsx` (client)

**Interfaces:**
- Consumes: Task 3 `InstrumentFigure`; Task 5 assets.
- Produces:
  - `WipeFigure()` — self-contained Figure 1: base `<img src="/research/mask_sam.png">` over `/research/angiogram.webp`, overlay `/research/mask_x0.png` (red-tinted via CSS `filter` or a pre-tinted PNG from Task 5) clipped by `clip-path: inset(0 0 0 var(--cut))`; labeled `<input type="range">`; mono `cut N%` readout via the `readout` prop.
  - `EfficiencyFigure()` — imports `public/research/label_efficiency.json` statically; renders one SVG line chart: x = labels, y = mean Dice, x0diffusion stroked `--red` and 2px, every other model `--mut` 1px with end-of-line labels; y-axis ticks at real values the data reaches; text inherits `currentColor` from `text-mut`.
  - `FlightFigure()` — `<video muted loop playsInline preload="none" poster="/research/flight_poster.webp">`; IntersectionObserver plays on ≥40% visible, pauses when off; `prefers-reduced-motion` never autoplays and shows native `controls` instead.

- [ ] **Step 1: Implement all three** per the interfaces above (each wraps itself in `InstrumentFigure` with its spec number: 1, 2, 3, captions from `copy.ts` placeholders until Task 7 lands real copy — import from `content/copy` from the start, adding keys as needed).

- [ ] **Step 2: Verify in prod build**

Playwright-Firefox: drag the range to 0 and 100 → screenshot at each, assert the two differ in the wipe region; SVG axis labels present and inside the viewBox; video `paused === true` before scroll, `false` after scrolling it into view, `true` again after scrolling past (poll, don't sleep-and-hope); with reduced-motion emulated, `paused === true` throughout.

- [ ] **Step 3: Commit and push**

```bash
git add components/figures content/copy.ts
git commit -m "redesign: wipe, efficiency and flight figures on real data"
git push
```

---

### Task 7: copy.ts v2 + voice gate

**Files:**
- Modify: `content/copy.ts` (full restructure; v1 strings die with their sections)
- Create: `scripts/check-voice.mjs`
- Delete: `content/resume-notes.md` (stale; facts live in CLAUDE.md — spec §7)

**Interfaces:**
- Produces: `copy` object with top-level keys `meta`, `masthead` (title, affiliation, abstract, stamp, links[{label,href}], date), `table1` (caption, cells[]), `research` (prose, scopeNote, figWipe, figEfficiency, mwscas, nasaProse, figFlight, noteBars), `systems` (intro, draw{...}, chess{...} — carry over every v1 status/control string the two demos still need, renamed into these namespaces), `experience` (rows[]), `references` (items[]), `lab` (heading, intro, s1/s2/s3 blocks — port the surviving jepa/diffusion/sample-space strings here), `notFound`. Exact strings drafted now, humanized in Task 14.
- Produces: `scripts/check-voice.mjs` — exits 1 if any visitor-facing string in copy.ts contains an em-dash, an en-dash used as a connector (allow digit–digit ranges), or a banned word from CLAUDE.md's list (encode the list in the script).

- [ ] **Step 1: Write `scripts/check-voice.mjs`** (regex over the copy.ts source; allowlist for `references` URLs; print offending key + word).

- [ ] **Step 2: Restructure copy.ts** with real first-person draft copy from CLAUDE.md's content facts + the spec's section text + the SLAAC poster numbers. Every number verbatim from the sources (0.882, 16, 25/25, ~75%, 553 KB, 1900–2200, 98–99%, +1.1%, 1.2%).

- [ ] **Step 3: Gate**

Run: `node scripts/check-voice.mjs` → PASS. Run `npm run build` → components referencing removed v1 keys will fail; fix call sites you own (later tasks own the rest; leave demos compiling by keeping their key names stable inside `systems.draw` / `systems.chess` / `lab.*`).

- [ ] **Step 4: Commit and push**

```bash
git add content/copy.ts scripts/check-voice.mjs
git rm content/resume-notes.md
git commit -m "redesign: copy seam v2 with voice gate"
git push
```

---

### Task 8: Page 1 assembly (static sections)

**Files:**
- Modify: `app/page.tsx` (real assembly, replacing the Task 3 smoke content)
- Create: `components/manuscript/Masthead.tsx`
- Create: `components/figures/HeadshotFigure.tsx`
- Create: `components/manuscript/References.tsx`
- Create: `components/WarmKick.tsx` (client, calls `warmBackground()` in a `useEffect`)

**Interfaces:**
- Consumes: everything from Tasks 3–7; `warmBackground()` from `lib/warm.ts` (unchanged).
- Produces: `/` rendering masthead (title, affiliation, abstract, rail: Stamp/date/links), HeadshotFigure, Table 1 StatBand, §1 Research (prose + scope Note + Figures 1–3 + MWSCAS + NASA block), §3 Experience (MissionRows as Figure 5... numbering: experience figure is **Figure 6**; Figures 4–5 are the demos from Tasks 9–10 — leave two placeholder slots `<div id="fig-draw" />`, `<div id="fig-chess" />`), References. Section ids: `#research`, `#systems`, `#experience`.
- `HeadshotFigure`: server component; renders `<img src="/headshot/photo.webp">` inside the masthead row **only if the file exists at build time** (`fs.existsSync` in the component, it is a server component); the live-model path is a later drop-in per the handoff — until then absent file = no slot, per the gate rule.

- [ ] **Step 1: Build Masthead, References, HeadshotFigure, WarmKick** (WarmKick renders null; mounted once in `page.tsx`).
- [ ] **Step 2: Assemble `app/page.tsx`** in spec §5 order with copy from `copy.*` only (zero inline strings).
- [ ] **Step 3: Verify**: prod build; Playwright at 1280/400: all sections present, anchors resolve, no horizontal scroll, network log shows **no** .onnx/.wasm/traj.json at first paint; on desktop idle, ORT warm request appears (spec §8 kept behavior).
- [ ] **Step 4: Commit and push**

```bash
git add app/page.tsx components/manuscript components/figures/HeadshotFigure.tsx components/WarmKick.tsx
git commit -m "redesign: page one assembly"
git push
```

---

### Task 9: DrawDigit re-chrome (Figure 4)

**Files:**
- Modify: `components/DrawDigit.tsx` (chrome only)
- Modify: `app/page.tsx` (mount into the `#fig-draw` slot behind an IntersectionObserver gate — create `components/manuscript/DeferredMount.tsx`: renders children only once its wrapper intersects; this replaces the boot-log gate everywhere)

**Interfaces:**
- Consumes: `InstrumentFigure`, `DeferredMount({ children, rootMargin? })`.
- Produces: DrawDigit rendered inside `InstrumentFigure n="4"` with its five params as labeled figure controls.

**⚠️ Logic that must not change (CLAUDE.md §draw contracts):** the single `generate()` call site passing `x0Init`; `modelSpace()`; `classifyingRef` mutual exclusion; `PEN_FRAC`; first-stroke model load; param clamps and `commitParam` passing the value explicitly; render-inside-`onFrame`.

- [ ] **Step 1: Create `DeferredMount`** (IntersectionObserver, one-way, fires under reduced-motion too — it is a loading strategy).
- [ ] **Step 2: Re-chrome DrawDigit**: remove `TerminalPanel`, `BootLog`/`useBootSequence`, `CommandLine` imports and JSX. Replace the command-line params with a mono control row inside the figure (one labeled `<input type="number">` or stepper per param, same `RANGES` clamps, same `commitParam("steps","steps",v)` path — the `flag` argument becomes the plain param name, echo line becomes the figure `readout`). Keep the canvas/result/x̂₀ triptych and the label picker exactly as they are. All strings from `copy.systems.draw`.
- [ ] **Step 3: Verify in prod (real browser)**: draw a one-stroke digit → auto-label appears (the null→loaded transition effect still fires); generate streams frames; editing steps mid-idle does not invent a run; editing after a run re-runs with the new value (readout echoes it); mobile 400px: canvas draws, page does not scroll while drawing (`touch-none` retained).
- [ ] **Step 4: Commit and push**

```bash
git add components/DrawDigit.tsx components/manuscript/DeferredMount.tsx app/page.tsx
git commit -m "redesign: draw-a-digit as figure 4"
git push
```

---

### Task 10: Chess re-chrome (Figure 5) + systems grid

**Files:**
- Modify: `components/ChessPanel.tsx`, `components/ChessActivations.tsx` (chrome only)
- Modify: `app/page.tsx` (both demos into a `grid gap-5 md:grid-cols-2` that takes a third entry without layout work — the honeypot slot, spec §5)

**Interfaces:**
- Consumes: `InstrumentFigure`, `DeferredMount`.
- Produces: ChessPanel inside `InstrumentFigure n="5"`; search toggle, sims control (clamp [250, 500] untouched), hint, activations view all functional.

**⚠️ Logic that must not change (CLAUDE.md §chess contracts):** worker stack, encoder, sims clamp and its "next search" semantics, draw detection by the site, hint-clears-on-fen, activations gated on file + `grid`/`layers` read from it, overlay alpha cap 0.6, never call the engine on a finished position.

- [ ] **Step 1: Re-chrome** ChessPanel + ChessActivations: strip TerminalPanel/BootLog/TerminalLabel/CommandLine; sims becomes a labeled stepper in the figure control row with the same snap-to-[250,500]; statuses render as the figure `readout`. Strings from `copy.systems.chess`.
- [ ] **Step 2: Verify in prod**: engine reaches "your move"; play a move (~130–200ms reply); hint at startpos returns `g3 · p=0.236` (validation vector D, CLAUDE.md); typing 10 into sims snaps to 250; activations toggle renders `fork_f7` and overlays land on the right squares (spot-check the named hottest square).
- [ ] **Step 3: Commit and push**

```bash
git add components/ChessPanel.tsx components/ChessActivations.tsx app/page.tsx
git commit -m "redesign: chess engine as figure 5"
git push
```

---

### Task 11: /lab — Supplementary material

**Files:**
- Create: `app/lab/page.tsx`
- Modify: `components/DiffusionVisualizer.tsx`, `components/JepaPanel.tsx`, `components/SampleSpace.tsx`, `components/SampleSpaceWriteup.tsx`, `components/AsciiGrid.tsx` (chrome + font note only)

**Interfaces:**
- Consumes: Sheet/Row/Note/InstrumentFigure/DeferredMount; Task 2's mono-advance ruling for `AsciiLines`.
- Produces: `/lab` with Figures S1 (trajectory viewer), S2 (JEPA retrieval), S3 (sample-space, still labeled illustrative), each behind `DeferredMount`, desk field running (it is in the layout).

**⚠️ Logic that must not change:** trajectory contracts (`vocab`/`mask_id`/`grid` from file, mask guard, text-not-innerHTML, 28x14, pixel-lerps/ascii-steps); JEPA gates (both artifacts, null-vs-throw, k from file, `✕` + aria carriers, red miss mark → map to `--red`); sample-space determinism (`hash01`, shared start). JepaSection keeps owning its own section gate (absent bundle drops S2 and its heading).

- [ ] **Step 1: Build `app/lab/page.tsx`** (Sheet, heading + one serif intro paragraph from `copy.lab`, three figure blocks).
- [ ] **Step 2: Re-chrome the three components**; move their honesty notes into rail `Note`s; ASCII grid font per Task 2's ruling.
- [ ] **Step 3: Verify in prod**: both trajectory modes play (ascii steps discretely); JEPA seed query 834 shows 0/8 vs 8/8 with red marks + `✕`; temporarily rename `public/jepa/manifest.json` → S2 and its heading vanish, no console errors, S1/S3 fine (rename back); sample-space flow paths identical across two clicks from the same point.
- [ ] **Step 4: Commit and push**

```bash
git add app/lab components/DiffusionVisualizer.tsx components/JepaPanel.tsx components/SampleSpace.tsx components/SampleSpaceWriteup.tsx components/AsciiGrid.tsx
git commit -m "redesign: /lab supplementary material"
git push
```

---

### Task 12: 404 + metadata

**Files:**
- Modify: `app/not-found.tsx` ("reference not found" on a Sheet; links to `/` and `/lab`)
- Modify: `app/layout.tsx` metadata (title/description/OG text from `copy.meta` v2 — draft OG image stays `/og.png` until Task 15 regenerates it)

- [ ] **Step 1: Implement both.** 404 conceit: a References-style list with one entry struck through and two real ones; strings in `copy.notFound`.
- [ ] **Step 2: Verify**: `/nonsense` renders it; `<title>` and meta description match copy v2.
- [ ] **Step 3: Commit and push**

```bash
git add app/not-found.tsx app/layout.tsx
git commit -m "redesign: 404 and metadata"
git push
```

---

### Task 13: v1 deletion sweep

**Files:**
- Delete: `components/ambience/` (all 9 files), `components/TerminalPanel.tsx`, `components/Section.tsx`, `components/EnergyHero.tsx`, `lib/identity.ts`, `lib/booted.ts`, `scripts/gen-og.mjs` only if replaced in Task 15 (else keep), plus anything the orphan check finds.

- [ ] **Step 1: Delete the known list**

```bash
git rm -r components/ambience components/TerminalPanel.tsx components/Section.tsx components/EnergyHero.tsx lib/identity.ts lib/booted.ts
```

- [ ] **Step 2: Orphan sweep** (the owner's "delete anything unnecessary" instruction): for every file in `components/` and `lib/`, grep the repo for imports of it; list files with zero importers; delete any that are v1-only (do NOT delete `lib/ascii-diffusion.js`/`.d.ts`, `lib/chess-*`, `lib/classify.ts`, `lib/draw-model.ts`, `lib/jepa.ts`, `lib/sample-space.ts`, `lib/ascii-traj.ts`, `lib/diffusion.ts`, `lib/warm.ts` — all consumed by kept demos; verify each actually has an importer and flag any that doesn't rather than deleting silently). Also grep `globals.css` for selectors no component references.
- [ ] **Step 3: Gate**: `npm run build` clean; `npm start` + click through `/`, `/lab`, 404.
- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "redesign: delete v1 theatre"
git push
```

---

### Task 14: Humanize copy pass

**Files:**
- Modify: `content/copy.ts` (wording only, no key changes)

- [ ] **Step 1: Fetch Wikipedia's "Signs of AI writing"** (WebFetch `https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing`) and extract its concrete tells beyond CLAUDE.md's list.
- [ ] **Step 2: Rewrite every string** against both lists: read each aloud, cut summary sentences, end flat. Numbers stay verbatim.
- [ ] **Step 3: Gate**: `node scripts/check-voice.mjs` PASS; `npm run build` PASS; render `/` and `/lab` and read every visible string in place once.
- [ ] **Step 4: Commit and push**

```bash
git add content/copy.ts
git commit -m "redesign: humanized copy pass"
git push
```

---

### Task 15: Full verification + ship prep

**Files:**
- Create: `scripts/verify-redesign.mjs` (the keepable regression script)
- Modify: `scripts/gen-og.mjs` (screenshot the new masthead at 1200x630@2x; keep the hand-run rule), regenerate `public/og.png`
- Modify: `CLAUDE.md` ("Where the redesign stands" updated: built on `redesign`, awaiting promote; note anything learned)

- [ ] **Step 1: Write `scripts/verify-redesign.mjs`** (Playwright-Firefox against `npm start`), asserting in one run: field animates at 1280 / static under reduced-motion / absent at 500px; no horizontal scroll at 400px on `/` and `/lab`; nothing model-sized before scroll; wipe endpoints differ; video plays in-view and pauses out; draw one-stroke → auto label; chess hint = `g3 p=0.236`; JEPA 834 = 0/8 vs 8/8; triple-equality on JEPA marks (red borders == red labels == crosses).
- [ ] **Step 2: Run it**: all assertions PASS (fix and rerun until).
- [ ] **Step 3: Regenerate the OG card** against the running redesign, commit `public/og.png`; revisit `app/icon.svg` ONLY if the owner asks (favicon change is opt-in, it is the site's recognition mark).
- [ ] **Step 4: Update CLAUDE.md status block; commit and push**

```bash
git add scripts/verify-redesign.mjs scripts/gen-og.mjs public/og.png CLAUDE.md
git commit -m "redesign: verification suite and ship prep"
git push
```

- [ ] **Step 5: Hand the Vercel preview URL to the owner. STOP. Promotion to production only on his explicit go** (then: merge `redesign` → `main`, push, confirm production, and only after that consider deleting the branch).

---

## Self-review notes

- Spec coverage: §2→T8/T11/T12; §3→T2/T3; §4→T4; §5→T5/T6/T8/T9/T10; §6→T11; §7→T7/T14; §8→T1/T9/T10/T13; §9/§10→T4/T6/T8/T15 assertions; §11 honored (no honeypot/bug/LFS tasks); §12 stays external.
- Deliberately not in this plan: the headshot live-model integration (blocked on the other chat's bundle; `HeadshotFigure`'s gate is its seam) and cropped-photo processing (owner replacing the photos; when they land, extend Task 5's script with a `--headshot` mode that crops/strips/emits `public/headshot/photo.webp`).
- Numbering fix applied during review: demos are Figures 4–5, experience is Figure 6 (Task 8 text matches).
