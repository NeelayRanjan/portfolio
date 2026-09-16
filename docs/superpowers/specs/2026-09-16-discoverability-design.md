# Discoverability: stargaze, /lab, and a muted-colour sky — design

**Date:** 2026-09-16
**Branch:** `discoverability` (off `main` at `926763f`, plus the owner's own
credit-line trim as its first commit)
**Owner calls this round:** integrate every discoverability idea from the
2026-09-16 discussion; the sky shows **muted colour in paper mode** and full
colour when the pointer is over it.

## 1. Why

Two parts of the site are close to invisible. The owner has had to tell
people stargaze exists, and /lab's door is a small dotted line under a loud
red stamp that doesn't look clickable. Inside stargaze, nothing says the
symbols and names can be clicked or how much is behind them.

## 2. Reversed decision, recorded

The colour round settled **colour is stargaze-only**, because the page's
figures use colour semantically (green x0, red SAM, amber readouts). **The
owner reversed that on 2026-09-16**: paper mode shows the sky's colour at
reduced saturation, and hovering the sky restores it fully.

The concern that produced the old rule still stands, so this round answers it
with a number instead of a ban: paper-mode saturation defaults to **25%**, not
50%, as the level where the sky reads as coloured without competing with the
figures. It is one constant (`PAPER_SATURATION`). A screenshot of Figures 1
and 2 beside a coloured margin is the gate.

## 3. Saturation replaces the colour flag

`View.colour: boolean` and `FrameInput.colour` become
**`saturation: number` in [0, 1]**. `lib/sky-render.ts` stays pure; the value
arrives as data.

- Every `OBJECT_COLOURS` colour is mixed toward its own luminance by
  `1 − saturation`. M82 has no palette and stays grey at every level.
- The Milky Way band's hue lerps from `INK` to the stargaze tan, and its alpha
  gain lerps from 1 to `MILKY_WAY_STARGAZE_ALPHA_GAIN` (2.6), both by
  saturation. The hue-can't-survive-low-alpha trap applies: whatever 25% looks
  like, its difference from 0% is measured, not eyeballed.
- **At saturation 0 the output equals the old colour-off output, and at 1 it
  equals the old stargaze output.** The existing byte-identity tests keep
  meaning something by pinning those two ends.

**Targets.** Stargaze: 1. Paper mode, pointer over the sky (not over the
sheet, a link, a button or the credit): 1. Paper mode otherwise: 0.25.
Devices without hover (`(hover: none)`) stay at 0.25. The current value eases
toward the target on the real-elapsed-ms clock (about 300 ms), raising the
frame gate while it moves the way a drag already does. Reduced motion snaps.

## 4. Stargaze: making clickable things look clickable

- **Drawn names get a dotted underline, in stargaze only.** A dotted underline
  already means "clickable" on this page (the stargaze toggle, the stamp's old
  sub-line), so the sky borrows the page's own grammar. Paper-mode names are
  not click targets and stay plain.
- **Pointer cursor** over anything selectable in stargaze.
- **One-time entry rings.** On the first stargaze entry of a page load, rings
  fade in and out around the four selectable symbols nearest the viewport
  centre, once, over about 1.2 s. Never again that page load. Under reduced
  motion they appear without animating and clear after the same time. This is
  a one-shot demonstration inside a mode the visitor chose, which is why it
  doesn't break the no-pulsing rule; that rule is about nagging on the page.
- **Counts in the hint bar**, from the loaded data, never hardcoded: how many
  objects can be opened and how many constellations, plus **"browse the list"**,
  which opens the keyboard list as a **visible panel** (same buttons, same
  order, now styled, scrollable, and closable with its own button and Escape).
  The list stays in the accessibility tree when closed, exactly as now.
- **Phones draw names for coloured objects** below 880px, not none. Those names
  are hit targets like any other, go through the step-down de-collision, and
  the touch hint is updated to match.

## 5. Stargaze: getting in

- **The button gets a mark**: a small inline star glyph before "stargaze for a
  bit?". The accessible name doesn't change.
- **The sky introduces itself once per session.** The first time a
  hover-capable visitor's pointer enters the sky in paper mode, a small caption
  near the pointer says what they're looking at, for a few seconds, pointer
  events off. The saturation lift in §3 happens at the same moment, so the
  caption and the colour arriving read as one response. `sessionStorage`,
  wrapped in try/catch; if storage throws it shows once per page load instead.
- **A second entry at the foot of the page**, after References on `/` and at
  the end of `/lab`: a short line saying the sky behind the page is real, with a
  control that enters stargaze.
- **`demo_used {demo: "stargaze"}` gains `via`** (`toggle`, `footer`), so the
  dashboard can say which entry point people use. Still one event per page
  load: a property, not a new event, which keeps the quota rule.

## 6. /lab

- The rail's status stays as the small red-ink stamp, **no longer a link**.
- Below it, **a bordered link box**: "Supplementary material →" plus a line
  naming what's inside (the three /lab sections by name, read from copy, not
  retyped).
- The stamp's old dotted sub-line ("pending additional materials") goes.
- References gains a closing link to the supplementary material.
- The OG card is regenerated (`scripts/gen-og.mjs`), since the masthead layout
  changes; CLAUDE.md requires it after any masthead layout change.
- **The status stays "in preparation."** Content facts forbid "under review."

## 7. The credit line

The owner cut `credit`/`creditStill` to their first sentence. The pieces after
it were written to continue the longer sentence and now render as "real one.."
and "real one., in colours". This round keeps the owner's sentence verbatim and
fixes the joins. Colour now shows on every page, so the colour clause is no
longer stargaze-gated. The tail stays as short as honesty allows: shapes are
enlarged, colours follow long exposures, every position is real. The owner
reviews the final wording.

## 8. Copy rules

Every new string lives in `content/copy.ts`, passes `scripts/check-voice.mjs`,
and follows the owner's standing instruction to apply Wikipedia's "Signs of AI
writing" before the pass. First person where there is a person; the sky's UI
strings match the existing lowercase stargaze register.

## 9. Verification

- **Saturation, measured as differences:** a coloured object's pixel in paper
  mode is more chromatic than at saturation 0 and less than in stargaze; the
  pointer over the sky raises it to the stargaze level; moving onto the sheet
  lowers it again; M82 stays neutral throughout.
- Stargaze affordances: names carry the underline (hook plus a pixel under a
  name box), entry rings appear on the first entry and never on the second,
  the hint's counts match the data, "browse the list" opens a visible panel
  whose button opens a card, a coloured object's name is a hit target at 400px.
- Entry points: the invitation shows once per session; the footer control
  enters stargaze and queues `demo_used` with `via: "footer"`.
- /lab: the box link navigates to /lab; the stamp is not a link; References'
  closing link resolves.
- Frame time under the 5.92 ms budget, before and after reported.
- The full existing suite, the node tests, the voice gate and
  `verify-headshot-256.mjs` stay green.

## 10. Out of scope

The draw-demo crash loop (still the top engineering item), time controls,
search, the honeypot demo.
