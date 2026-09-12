# neelayranjan.dev redesign — "Framed manuscript" design spec

Date: 2026-09-11 · Status: awaiting owner review
Mockup lineage: artifact "Five Directions"
(https://claude.ai/code/artifact/0f83689a-7f49-4ae6-8404-78b5e22c141a), winner vB2.1.

## 1. Summary

The site becomes a dark preprint: a bordered sheet on a living desk. Prose reads like
a paper (serif, numbered sections, an abstract, references); figures operate like
instruments (full-span frames with corner ticks, bars, lamps, readouts); red appears
only as reviewer's ink. Two trained models run live on page 1, and every text section
carries one real-work artifact beside it. Audience: recruiters and masters admissions
committees, admissions first. Ready by early November 2026.

Settled upstream (see CLAUDE.md and the decision log; not relitigated here): audience
and priority actions, first-person voice, copy.ts as the copy seam, dark theme,
page-1-delivers-95%, /lab for overflow demos, bugs deferred, `v1` tag as fallback.

Decisions this spec locks:
- **Desk: LIVE.** The cursor-reactive field runs on the desk around the sheet.
- **v1 is fully retired**: swarm, boot screen, CharField, scroll spine, resolving
  labels, terminal chrome, the ssh identity toy. All of it lives at the `v1` tag.
- **Rule (owner, 2026-09-11): a background field means a page in front of a
  background.** Content never floats in the field.

## 2. Information architecture

| route | job |
|---|---|
| `/` | the paper: masthead, abstract (bio), Table 1, research, live systems, experience, references |
| `/lab` | "Supplementary material": the three demos that left page 1, re-chromed as Figures S1–S3 |
| 404 | restyled to the conceit ("reference not found"), lists the two real routes |

Nav is minimal: the masthead rail links (Resume, CV, GitHub, ORCID, Email) plus one
"Supplementary material" link in References and in the footer. No menu bar.

## 3. Design system

**Tokens** (CSS `@theme`, Tailwind v4):

| token | value | job |
|---|---|---|
| `--desk` | `#0c0b09` | page ground under everything |
| `--paper` | `#12110f` | the sheet |
| `--panel` | `#171511` | instrument figure fill |
| `--ink` | `#eae5da` | text |
| `--mut` | `#9a948a` | secondary text, rail |
| `--rule` | `#2a2823` | borders |
| `--hair` | `#1d1c18` | hairlines (rail divider) |
| `--red` | `#e5352b` | reviewer's ink ONLY: the stamp, the headline numeral, x0 masks, alert/miss states |
| `--link` | `#7ba7dc` | hyperlinks (hyperref blue) |
| `--green` | `#63c68c` | true "active" status only (lamps) |
| `--amber` | `#d9a45b` | instrument readouts, "scheduled" lamps |

Red discipline: it marks annotation and findings, never decoration and never brand.
On /lab, JEPA's wrong-class mark maps to `--red` (same alert family; the `✕` and
aria carriers survive per CLAUDE.md).

**Type**: STIX Two Text (400/600, italics) for everything a person says; Spline Sans
Mono (400/500/600) for everything a machine says: readouts, figure tags, statuses,
flags, the ASCII grids. Both via `next/font/google`, self-hosted at build. v1's
mono/sans semantic split survives as **serif/mono**.
- ⚠️ Measure Spline Sans Mono's advance before wiring it into `AsciiLines`/`AsciiGrid`
  (v1 rule: the 0.6em advance is load-bearing for square cells; re-derive
  `lineHeight` from the measured advance, don't assume). Verify no ligatures mangle
  runs of `=` in the ramp. If either fails, the ASCII grids keep a dedicated mono.

**The sheet**: `max-width: 1000px`, 1px `--rule` border, soft shadow, centered on the
desk, `padding-inline: clamp(20px, 5vw, 56px)`. Everything on `/` and `/lab` lives
inside a sheet.

**The anchored grid** (inside the sheet): two tracks,
`minmax(0, 560px)` prose + `minmax(200px, 1fr)` margin rail, 48px gap. The prose left
edge never moves. Full-span elements (Table 1, wide figures) start at the same left
edge and run to the rail's right edge. Below 880px: one column; the rail folds inline
under its anchor as a bordered note. Prose measure stays ≤ 64ch.

**The margin rail** carries: the UNDER REVIEW stamp, date, identity links (masthead);
scope and honesty notes (the role v1's mono captions played); short caveats beside
figures. Rail notes are serif italic 13.5px with a mono uppercase tag; hairline
left border.

**Instrument figures**: 1px `--rule` border on `--panel`, two corner ticks, serif
"**Figure N.**" captions below, amber mono readouts top-right where a control has
state worth echoing. This chrome replaces `TerminalPanel` sitewide.

## 4. The desk field

A flow-field of drifting particles on the desk, visible in the gutters around the
sheet; near the cursor they scatter red-tinted and re-anneal.

Budget (the point, per v1's lesson): ≤ ~450 particles, ~25fps frame gate, DPR 1,
stops while the tab is hidden, **disabled below 880px** (no visible gutters, so it
would be pure battery cost), `prefers-reduced-motion` paints one static frame.
Plain canvas 2D; no library. Labeled nowhere as a model, claimed nowhere as one.

## 5. Page 1, section by section

**Masthead (row + rail).** H1 as a paper title carrying name + thesis line; italic
affiliation line; abstract = the bio, first person, ~80 words. Rail: stamp, date,
links. The stamp says UNDER REVIEW while JAMIA reviews; when status changes, the
stamp changes (it is a claim, not decor).

**Author photo (headshot figure, in the masthead row).** Gated on the headshot
diffusion bundle (docs/handoffs/2026-09-11-headshot-diffusion-handoff.md): when
present, the photo denoises in live with a resample control; when absent, a plain
`<img>` of the chosen photo; when no photo is chosen yet, the slot doesn't render.
Never a fake animation.

**Table 1.** Full-span stat band, STIX numerals, headline `0.882` in red:
0.882 Dice at 16 labels · 25/25 paired runs · ~75% faster corrections · 553 KB
engine. Numbers live in copy.ts and must match the paper exactly.

**§1 Research.**
- Prose: the JAMIA claim (label efficiency, not peak accuracy), "under review at
  JAMIA" phrasing, arXiv link when live. Rail: the scope note.
- **Figure 1 — the wipe.** Real angiogram with real masks from
  `external_materials/paper1/data/predictions_cache/` (x0diffusion vs sam at the
  16-label budget), drag-to-compare with a mono `cut N%` readout. x0 mask tinted
  red (the finding), SAM mask neutral. Image choice: pick a case where the
  difference is legible at a glance (the qualitative figure's case is a candidate).
  The benchmark is the public pelvic-iliac angiography dataset (confirmed from its
  README), so publishing frames is clean; the build script records which image ids
  ship.
- **Figure 2 — label efficiency, computed from real data.** A build-time script
  aggregates `all_metrics_combined_long.csv` (52K rows: model x fraction x seed x
  fold) into `public/research/label_efficiency.json`; the figure renders mean Dice
  vs labels per model with x0-diffusion in red. The script **asserts the headline
  number matches the paper (0.882 at 16)** before writing; a mismatch fails the
  build script, not the site.
- MWSCAS line: co-author, oral, August 2026, led the PCB team. No Xplore link until
  indexing is confirmed.
- **NASA block + Figure 3 — the flight day.** Short prose on the arc, with the
  poster's real numbers (98–99% clear the 25 nm buffer; +1.1% median added distance
  at infinite lookahead; within 1.2% of geometric optimum). Figure 3 is
  `flight_lm_day.mp4` (1.2 MB, 11.8s, h264) as a muted looping `<video>`: lazy,
  plays on scroll-in, pauses off-screen; reduced-motion gets poster frame + play
  control. Caption states what it is: a trained model's synthesis of a day of FAA
  flight plans.

**§2 Live systems.** A data-driven figure grid, two entries today, built to take a
third (the future honeypot demo slots in with zero layout work):
- **Figure 4 — draw a digit.** DrawDigit re-chromed as an instrument figure. Model
  path unchanged (all CLAUDE.md traps apply: one generate() call site, x0Init,
  classifyingRef exclusion). The five sdedit params become figure controls with the
  same clamps; the honest-control rule holds.
- **Figure 5 — the chess engine.** ChessPanel re-chromed; worker stack unchanged;
  1-ply / let-it-think toggle and sims clamp [250, 500] unchanged; the
  interpretability view stays a mode on the same board.

**§3 Experience.** Mission rows in one instrument figure: lamp + dates + org + one
line. Lamps encode true state (NASA active now, lunar twin scheduled, others
complete/ongoing). NASA presented as one three-session arc.

**References.** Real links as a bibliography: the paper (arXiv when live), Resume,
CV, GitHub, ORCID, LinkedIn, email, Google Scholar when created, and
"Supplementary material" → /lab. The footer link list is data-driven so additions
are copy edits.

## 6. /lab — Supplementary material

Same sheet, same grid, headed as supplementary material. Contents re-chromed as
instrument figures, internals untouched (their contracts live in CLAUDE.md):
- **Figure S1** — the trajectory viewer (pixel + ascii diffusion).
- **Figure S2** — MAE vs I-JEPA retrieval.
- **Figure S3** — sample-space DDPM vs flow matching, still labeled illustrative.
Each gets one serif intro sentence plus its existing honesty notes in the rail.
Payloads stay boot-gated by scroll (see §8). The desk field runs here too.

## 7. Copy

Full rewrite of `content/copy.ts`, restructured to the new IA (the seam survives,
the keys change; v1's copy is at the tag). First person throughout. Voice rules per
CLAUDE.md, plus the standing instruction: **before the copywriting pass, fetch
Wikipedia's "Signs of AI writing" and apply it.** Facts come from CLAUDE.md's
content-facts section and the live Resume/CV docs, never resume-notes.md.
Claims discipline: "under review at JAMIA"; MWSCAS as oral with et-al author
position; Elo as "roughly 1900–2200 vs Stockfish's limited modes"; illustrative
pieces labeled; the mockups' placeholder copy is a starting point, not final.

## 8. Engineering

**Kept (logic intact, chrome replaced):** DrawDigit model path, chess
worker/encoder/MCTS stack, jepa loaders + retrieval view, sample-space lib,
AsciiGrid/AsciiLines, loadChessActivations. All CLAUDE.md demo contracts apply.

**Kept (infrastructure):** COOP/COEP headers, sync-ort predev/prebuild, chess
worker `new URL` literal, memoized loaders, `warm.ts` gating logic (retargeted:
same vetoes, absent-means-unknown; the idle window now opens after first paint
instead of behind a boot screen).

**Deleted:** Swarm, EnergyHero, BootScreen, BootLog/useBootSequence, TerminalLabel,
TerminalPanel, CharField, ScrollSpine, ResolveText, CommandLine (params move into
figure-chrome controls), lib/identity, lib/booted, and Reveal: there are no
scroll-reveal animations in this design (IntersectionObserver survives only as the
loading gate, which is invisible). gen-og's output is regenerated for the new
masthead at ship time.

**Deferred mounting survives the boot log's death.** Each heavy figure mounts its
demo on IntersectionObserver, reduced-motion included (it is a loading strategy,
not an animation). Nothing model-sized is in flight at first paint.

**New pieces:**
- `components/manuscript/*`: Sheet, Row, Rail, InstrumentFigure, StatBand,
  MissionRows, Stamp.
- `components/DeskField.tsx` per §4.
- `components/WipeFigure.tsx` (Figure 1) and `components/EfficiencyFigure.tsx`
  (Figure 2, renders the precomputed JSON as inline SVG).
- `components/FlightFigure.tsx` (Figure 3 video with scroll play/pause).
- `scripts/prepare-research.mjs` (hand-run, like gen-icons): extracts the chosen
  angiogram + masks from the tarballs into `public/research/` (webp), aggregates
  the CSV into `label_efficiency.json`, asserts the headline number, prints what it
  chose. Committed outputs; the script never runs on Vercel.
- `external_materials/` is **gitignored** (45 MB, data tarballs, local asset mine).

**Rollout:** branch `redesign`, Vercel preview URLs per push, promote to production
only on the owner's explicit go. `v1` tag is the fallback. 404 and any route lists
updated with the IA. OG card and favicon revisited once the real masthead exists.

## 9. Mobile and performance

- First paint: fonts + CSS + the field script (~few KB). No models, no video, no
  atlas in flight.
- Field off below 880px; video lazy + paused off-screen; demos mount on reach; ORT
  warm stays desktop-idle-only with v1's vetoes.
- Sheet padding and grid collapse per §3; 16px minimum gutters; no horizontal
  scroll; thumb targets unchanged from v1's control sizing.

## 10. Accessibility

Visible focus states on every control (red offset outline). Reduced motion: field
static, video poster + control, wipe slider fully functional, no scroll-triggered
animation anywhere. Figures carry real captions; the wipe slider is a labeled
range input; lamps pair with mono status words (never color alone); rail notes
follow their anchor in DOM order.

## 11. Out of scope

The honeypot demo (slot reserved only), v1 bug fixes (tracked separately, one is
mooted if DrawDigit's chrome rebuild replaces the resize path), a separate
research page, Git LFS, the ultrasound project's presence on the site.

## 12. External dependencies (owner)

Headshot bundle from the other chat; photo choice for the fallback; arXiv link
(~Sep 18); Google Scholar profile after; resume doc content fix; ORCID fill-in.
None block the build; every one has a gate or a fallback.
