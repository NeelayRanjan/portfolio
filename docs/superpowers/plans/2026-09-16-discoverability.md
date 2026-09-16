# Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stargaze and /lab findable, make stargaze's clickable things look clickable, show the sky's colour muted in paper mode and full under the pointer, and make the draw demo's classifier-free classification impossible to miss.

**Architecture:** `NightSky.tsx` is split first, with no behaviour change, because the project rule is to split it before the next sky feature. One copy task writes every new string so the round has one voice. Saturation replaces the boolean colour flag as data on `View`/`FrameInput`, with both ends pinned to the old outputs. The rest are bounded UI additions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Canvas 2D, node:test, Playwright-Firefox.

**Spec:** `docs/superpowers/specs/2026-09-16-discoverability-design.md`

## Global Constraints

- `CLAUDE.md` binds: the Constitution, the Voice rules, content facts. Read it. The paper is **in preparation**; never "under review".
- **No `Math.random`** in sky code. `lib/sky-render.ts` stays pure. `lib/sky-math.ts` keeps zero imports.
- **Every visitor-facing string lives in `content/copy.ts`** and passes `node scripts/check-voice.mjs`. No em-dashes.
- **Saturation 0 must reproduce the old colour-off output and saturation 1 the old stargaze output.** The existing byte-identity tests pin those ends and must keep passing unchanged in meaning.
- Frame budget: `window.__sky.frameMsMedian` under **5.92 ms** at 1280px (current 2.54 ms). Report the number.
- Analytics quota rule: **no new events.** `demo_used` may gain a `via` property.
- **The draw demo is fragile:** `classifyingRef`, `fitFreshRef`/`inkGenRef` and the single `generate()` call site must not change behaviour. Task 8 touches copy and markup only.
- **Servers:** verify against `npm run build && npm start` on **port 3000 only**. Port 3001 is the owner's dev server: never touch it. **Never `pkill`.** Start with `setsid nohup npm start > LOG 2>&1 < /dev/null &`. Stop only this worktree's server:
  `for p in $(pgrep -f "[n]ext-server"); do case "$(readlink -f /proc/$p/cwd)" in *portfolio-night-sky) kill $p;; esac; done`
- **Measure differences, not appearances** (CLAUDE.md trap: hue at low alpha). A check that sampled one state and "looked right" has already failed this project once.
- A failure message names what it found. A check asserts the promise, not something stricter.
- Commits end with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Full gate at the end of any task that touches runtime code: `node scripts/verify-redesign.mjs` (all checks), all six `node scripts/test-sky-*.mjs`, `node scripts/check-voice.mjs`, `npx tsc --noEmit`.

---

### Task 1: Split `NightSky.tsx`, no behaviour change

**Files:** `components/manuscript/NightSky.tsx` (995 lines) into it plus new modules beside it or under `lib/`.

Extract cohesive units out of the component's one large effect: at minimum the card placement and out-of-view logic, the keyboard list, and the pointer/drag/click controller. Pick boundaries by what changes together; name modules for what they do. The component should end up as orchestration under ~400 lines.

- [ ] Read the whole file and CLAUDE.md's "Night sky + stargaze" section first. Note every closure variable shared across the units and decide how each crosses a boundary (argument, returned handle, or a small shared state object). Record the decisions in the report.
- [ ] Move code; do not rewrite logic. Comments move with their code.
- [ ] `npx tsc --noEmit` clean. Full gate: every check must pass exactly as before. Record frame median before and after.
- [ ] Commit: `sky: split NightSky into cohesive modules, no behaviour change`

### Task 2: Copy pass for the whole round

**Files:** `content/copy.ts`, `components/manuscript/SkyCredit.tsx`, `app/globals.css` (the credit's stargaze gating only).

First fetch https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing and apply it (owner's standing instruction). Then write every string below. Later tasks render these keys; name them exactly as listed. Where a sentence is composed from fragments, add a comment beside the keys showing the full composed sentence, the way `copy.stargaze.card` already does.

- [ ] **Credit line (spec §7).** Keep the owner's `credit` and `creditStill` verbatim. Remove the stargaze-only gating of the colour clause (colour now shows in paper mode too) and replace `creditColour` + `creditTail` with one `creditTail` so the rendered line is the owner's sentence plus ONE short sentence: shapes enlarged, colours from long exposures, every position real. Update `SkyCredit.tsx` and remove the dead CSS rule. Check the rendered text for doubled punctuation in both motion variants.
- [ ] **Stargaze hint (spec §4).** Fragments for: "drag to look around, click a name or symbol" (pointer) / tap equivalent (touch; note phones now draw names for coloured objects, so a touch hint may mention names), a counts sentence built around two numbers (objects, constellations), and the words `browseList` ("browse the list"). Keys: `hintPointer`, `hintTouch`, `countsObjects`, `countsConstellations` (the literal text around the numbers), `browseList`.
- [ ] **List panel:** `listPanelTitle`, `listPanelClose`. Keep `listLabel`.
- [ ] **Entry points (spec §5):** `invite` (the once-per-session caption: what the visitor is looking at, e.g. the sky over NASA Ames right now; short), `footerLead` (the sky behind this page is real), `footerEnter` (the control's label, matching the toggle's own lowercase register).
- [ ] **/lab (spec §6)** under `copy.masthead`: remove `stampNote`; add `supplementLabel` ("Supplementary material") and `supplementJoin` if needed. Find the /lab section titles already in copy.ts (S1–S3) and note their key paths in a comment so Task 7 composes the contents line from them rather than retyping. In the references namespace add `supplementLink`.
- [ ] **Draw demo (owner request, 2026-09-16):** classification happens without a classification model, and that must be noticeable. (a) Revise `copy.systems.draw.figureCaption` to state it plainly in one sentence: the digit guess comes from the same diffusion model, no separate classifier. (b) Add `copy.systems.draw.classifyLead`: a short line (under ~70 characters) that sits permanently at the label picker. (c) Reorder `classify.a` so the claim leads instead of closing. Facts (CLAUDE.md, draw demo section): the diffusion model reconstructs the drawing under all ten labels from identical noise and the best fit wins. Don't add numbers the code doesn't produce.
- [ ] `node scripts/check-voice.mjs` passes. Read every string aloud.
- [ ] Commit: `copy: strings for discoverability, the credit's joins, and classifier-free classification`
- [ ] In the report, list every new or changed string's final text, so the owner can review the whole round's copy in one place.

### Task 3: Saturation replaces the colour flag

**Files:** `lib/sky-layers.ts`, `lib/sky-render.ts`, `components/manuscript/NightSky.tsx` (and whatever Task 1 extracted), `scripts/test-sky-objects.mjs`, `scripts/verify-redesign.mjs`.

- [ ] `View.colour`/`FrameInput.colour` become `saturation: number` in [0,1]. Palette colours mix toward their own luminance by `1 − s` (Rec. 709 luminance; one helper, one place). Milky Way hue lerps `INK` → stargaze tan and alpha gain lerps 1 → `MILKY_WAY_STARGAZE_ALPHA_GAIN`, both by `s`. Precompute what doesn't depend on `s`; the paint loop must not build strings per object per frame if it can be avoided once per saturation change.
- [ ] Tests first: at `s = 0` output equals old colour-off and at `s = 1` old stargaze (reuse the existing byte-identity fixtures); a monotonic chroma test in between; M82 grey at every `s`.
- [ ] Targets (spec §3): stargaze 1; paper mode pointer over the sky 1; paper otherwise `PAPER_SATURATION = 0.25`; `(hover: none)` stays 0.25. "Over the sky" = not over `[data-sheet]` and not over `PAN_BLOCKERS` or `[data-sky-credit]`. Ease toward target on real elapsed ms (~300 ms), raising the frame gate while moving as drags do. Reduced motion snaps. Expose `window.__sky.saturation`.
- [ ] Screenshot at 1440px: Figures 1 and 2 on screen beside a coloured margin at 0.25, then hovered at 1. Judge whether 0.25 competes with the figures' green/red/amber; if it does, lower it and say so. Attach both.
- [ ] Replace the `sky-colour` check: measured chroma of a coloured object's pixel at paper < stargaze and > what `s = 0` would give; hover over the sky raises it to stargaze level; moving onto the sheet lowers it; M82 neutral throughout. Prove it bites by mutating the constant and rebuilding once.
- [ ] Full gate; report frame median. Commit: `sky: muted colour in paper mode, full colour under the pointer`

### Task 4: Stargaze affordances on the canvas

**Files:** `lib/sky-layers.ts`, `lib/sky-render.ts`, NightSky modules, `scripts/verify-redesign.mjs`.

- [ ] **Dotted underline under drawn names, stargaze only** (a `View` flag, not a store read in render). Short dashes along the name box's baseline in the name's own colour at lower alpha. Expose `window.__sky.nameUnderline`.
- [ ] **Pointer cursor** over a selectable hit in stargaze; default elsewhere; `grabbing` during drag unchanged.
- [ ] **Entry rings (spec §4):** first stargaze entry per page load only; the four selectable symbols nearest the viewport centre; fade in/out ~1.2 s on the real clock; reduced motion shows them static and clears after the same time. Expose `window.__sky.entryRings` (count currently drawn) and a boolean that the one-shot has fired.
- [ ] **Phones:** below 880px draw names for ids in `OBJECT_COLOURS` only; they are hit targets and go through the name step-down. `stargaze-touch-400` must now find a coloured object's name box and open its card from it.
- [ ] Checks: underline pixels present under a name in stargaze and absent in paper mode (difference); rings present right after first entry, zero after ~2 s, zero on second entry.
- [ ] Full gate. Commit: `sky: names look clickable, a one-time ring on entry, names on phones`

### Task 5: Counts in the hint, and a visible list panel

**Files:** `components/manuscript/StargazeToggle.tsx`, NightSky's keyboard-list module, `scripts/verify-redesign.mjs`.

- [ ] Counts come from loaded data: objects = catalog objects that can draw (dec above the chart edge; Voyager 2 excluded), constellations = the catalog's count. Until data loads, show the hint without counts. Compose from Task 2's fragments in the documented order; "browse the list" is a button.
- [ ] The list becomes a visible panel on demand: same buttons, same sort, scrollable, titled, with a close button and Escape (Escape closes the panel before the card-close/stargaze-exit chain, same capture-phase pattern as the card). Closed, it stays in the accessibility tree exactly as today. Opening a card from it works as today. Below 880px it docks like the card.
- [ ] Checks: hint numbers equal counts computed in-page from the served JSON; the panel opens visibly, a button opens a card, Escape order is panel → card → exit.
- [ ] Full gate. Commit: `stargaze: say how much is here, and let people browse it`

### Task 6: Entry points

**Files:** `components/manuscript/StargazeToggle.tsx`, a small footer-entry component rendered on `/` after References and at the end of `/lab`, `lib/track.ts`, NightSky pointer module, `scripts/verify-redesign.mjs`.

- [ ] **Mark:** a small inline SVG star before the toggle label, `aria-hidden`, currentColor, no layout shift. Accessible name unchanged.
- [ ] **Invite:** first entry of a hover-capable pointer into the sky in paper mode per session shows `copy.stargaze.invite` near the pointer for ~3.5 s, `pointer-events: none`, not over the sheet. `sessionStorage` in try/catch; on failure once per page load. Never on `(hover: none)`. Never in stargaze. Expose `window.__sky.inviteShown`.
- [ ] **Footer entry:** `footerLead` + a button labelled `footerEnter` that enters stargaze. Not a link.
- [ ] **`via`:** `demo_used {demo: "stargaze", via}` where via is `toggle` or `footer`. Still once per page load.
- [ ] Checks: invite shows on first sky entry, not on a second entry after reload in the same session; footer button enters stargaze and queues `via: "footer"`; the toggle queues `via: "toggle"`.
- [ ] Full gate. Commit: `stargaze: a mark, a once-per-session hello, and a door at the foot of the page`

### Task 7: The /lab rail

**Files:** `components/manuscript/Masthead.tsx`, `components/manuscript/References.tsx`, `scripts/verify-redesign.mjs`, `public/og.png` via `scripts/gen-og.mjs`.

- [ ] The stamp stays (red ink, status) but is no longer inside the link. Below it a bordered link box to `/lab`: `supplementLabel` with an arrow, and a contents line composed from the S1–S3 section titles' existing copy keys (Task 2 noted the paths). Hover and focus-visible states. Remove the old dotted sub-line.
- [ ] References ends with `supplementLink` → `/lab`.
- [ ] 400px: no horizontal scroll; the box fits the rail.
- [ ] Check: the box link navigates to /lab; the stamp has no link ancestor; References' link resolves.
- [ ] Regenerate the OG card: `node scripts/gen-og.mjs` against the prod server on 3000. Look at `public/og.png` before committing.
- [ ] Full gate. Commit: `masthead: the door to /lab is a box that says what's behind it`

### Task 8: Draw demo, classification without a classifier

**Files:** `components/DrawDigit.tsx` (markup only), maybe the draw figure wrapper for the caption.

- [ ] Render `copy.systems.draw.classifyLead` permanently at the label picker, visible before any drawing, readable at 400px, not replaced by the guessing/auto/yours states. Style it as a quiet but distinct note, consistent with the panel.
- [ ] Confirm the revised `figureCaption` and reordered `classify.a` render.
- [ ] **Do not touch** `classifyingRef`, `fitFreshRef`, `inkGenRef`, `classifyDrawing` or the `generate()` call site.
- [ ] Checks: `draw-stroke-auto-label` and `stargaze-offload-draw` still pass; the lead line is present at 1280 and 400px.
- [ ] Full gate. Commit: `draw: say up front that the label guess needs no classifier`

### Task 9: Verification sweep and docs

- [ ] Full gate plus `node scripts/verify-headshot-256.mjs`. Report all counts and the frame median.
- [ ] `CLAUDE.md`: record the reversed colour decision (owner call 2026-09-16) where the old rule is stated, `PAPER_SATURATION` and the pinned ends, the affordances, the list panel, the entry points and `via`, the /lab rail, the credit's new composition, the draw lead line, NightSky's new module layout, the new check count. Update Open items 1 and 2 (discoverability, mobile names) to what shipped and what remains. `README.md`: the paper-mode colour and the entry points.
- [ ] Commit: `docs: record the discoverability round`
