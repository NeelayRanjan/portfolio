# Offprints: the shell

Design for the frame every piece lives in: the paper, the dog-ear peel, the
index, the piece template, the subdomain, the feed. The pieces themselves
(their interactives) are designed one at a time afterwards; the first is
hybrid attention. Planning record and research: `2026-11-01-concepts-site-plan.md`.

Status: written 2026-11-01 from the owner's brief and five rounds of
clickable mockups. **The approved mockup is
`.superpowers/brainstorm/808763-*/content/layout-dogear-v4.html`** (gitignored,
owner: "love this, im committed"); v3 settled the peel, v4 added the paper
conventions and explainer patterns in §11. Builder-checked the same day; the
five questions it raised are settled in §10. §9 items 1 and 2 (the door, the
icon) are still the owner's.

## 1. Intent

Offprints is a semi-separate site of visual, interactive explainers of recent
AI concepts, by Neelay Ranjan. An offprint is a separately printed copy of one
article, handed around; the name is the metaphor and the interaction: each
piece is one sheet of paper, and the reader peels the sheet back to find the
others underneath.

Why it exists (owner): a competent AI developer should be current and able to
explain hard concepts, and the owner believes long text and math are a
restrictive, inaccessible way to learn them. Demos and visuals are the way.
The reader is senior and experienced in the field but not at the frontier;
each piece is ten minutes at most, most of it spent playing with demos.

## 2. Goals, non-goals, anti-goals

Goals
- A reusable shell: paper, chrome, navigation, piece template, feed. A later
  session adds a piece by writing its interactives and one registry entry.
- Clean and decluttered. Two fixed controls on screen, nothing else.
- The peel: click the corner to open the index, drag it to peek.
- Each piece carries the owner's call (useful or useless) and, later, a
  revisit stamp; the index shows both.
- Served at offprints.neelayranjan.dev from this repository and this Vercel
  project; reached prominently from the portfolio.

Non-goals
- Not a blog: no feed of posts on the landing page, no tags, no search, no
  reading time, no author box, no comments, no newsletter.
- No dark mode. The paper is the design, as the dark desk is the portfolio's.
- No CMS or Markdown pipeline. Pieces are code: React components with their
  copy in a typed content file, like the portfolio.

Anti-goals (failure even if it works)
- A piece that reads as a wall of text with figures attached. Words come last.
- A demo that fakes model output, or a control that changes nothing real
  (the portfolio's constitution applies in full).
- Chrome that competes with the demos: menus, bars, badges, pulsing hints.
- The portfolio's existing pages or URLs changing because Offprints moved in.

## 3. Constraints

- The portfolio's `CLAUDE.md` binds: the Constitution, the Voice rules for
  every visitor-facing word, the Stack (Next.js 16 App Router + Turbopack,
  React 19, Tailwind v4 tokens in `@theme`, `next/font`), the COOP/COEP
  headers on every route (WASM demos want them), the analytics quota rule
  (no per-interaction events), and the rule to read
  `node_modules/next/dist/docs/` before writing Next code.
- The portfolio's 56 verify checks and 203 node tests keep passing unchanged.
- Fonts: STIX Two Text (serif) and Spline Sans Mono (mono), the portfolio's,
  already loaded through `next/font` (owner's call: continuity in type).
- Phones first-class: no horizontal scroll at 390px, touch drives the peel,
  44px hit targets. Where a demo cannot be touch-driven, a watch-only or a
  prerendered rigid version is acceptable (owner, 2026-11-01).
- Hardware for building pieces: this laptop (RTX 4070 Laptop 8 GB), a desktop
  4070 Ti Super, a Modal subscription. Not a shell concern, recorded for the
  piece designs.

## 4. Hosting and URLs (decided)

- Host: `offprints.neelayranjan.dev`, a domain of the existing Vercel project.
  Owner action: add the subdomain in Vercel's Domains (a CNAME on the apex's
  DNS, which Vercel manages).
- One Next.js app. Offprints pages live under an internal path prefix
  (`/offprints/...`) in their own route group with its own root layout, so
  the portfolio's `app/layout.tsx` (fonts, analytics, the night sky, the
  skip link, the reload beacon) is not inherited. A host-aware proxy
  (`proxy.ts`, Next 16's name for middleware) rewrites requests on the
  Offprints host from `/x` to `/offprints/x`, and 308-redirects
  `neelayranjan.dev/offprints/*` to the subdomain, so the internal prefix is
  never a public URL. Local and verify runs use `offprints.localhost:3000`
  (browsers resolve `*.localhost` to loopback) so no hosts-file edit is
  needed; the proxy treats any host beginning `offprints.` as the Offprints
  host.
- Public URLs on the Offprints host:
  - `/` renders the LATEST published piece (owner's call). Its canonical is
    the piece's own URL, so the root never competes with it in search.
  - `/<slug>` is a piece (`/hybrid-attention`).
  - `/all` is the index as a page of its own: the no-JS, crawler and
    direct-link form of what the peel reveals.
  - `/feed.xml` is the feed. `/robots.txt` and `/sitemap.xml` are the
    Offprints host's own (the portfolio's stay as they are and keep passing
    `search-basics`).
- Metadata: its own `metadataBase`, title template ("Hybrid attention ·
  Offprints"), description from the piece's claim, an OG card per piece
  (generated by a sibling of `scripts/gen-og.mjs` once pieces exist; the
  shell ships a plain Offprints card), and its own icon set (§9).
- The portfolio links to it (§9 decides where); Offprints links back through
  the N mark and the index foot.

## 5. The paper and the type (decided)

Light only. Tokens, in the Offprints root layout's `@theme` scope (names
final, values to be confirmed by measurement, see below):

| token | value | role |
|---|---|---|
| `paper` | `#efebe3` | the sheet |
| `paper-under` | `#e6e1d7` | the index page beneath, the back of the fold |
| `ink` | `#1d1b17` | text, the selected state |
| `mut` | `#6b665d` | captions, eyebrows, secondary text |
| `rule` | `#cbc5b8` | hairlines |
| `stamp` | `#b9311f` | the call stamp, "aged badly" |
| `q` / `k` / `v` | `#3f55c9` / `#146b55` / `#8f4f08` | the recurring demo roles |

`k` and `v` were darkened for AA (Task 10, measured): `#1e8468` read 3.88:1 on `paper` and `#b86a12` 3.46:1; the shipped values read 5.41 / 4.98 and 5.37 / 4.94 on `paper` / `fill`, and `q` 5.27 / 4.85.

Rules
- Every text colour clears WCAG AA (4.5:1) on the surface it sits on, measured,
  not assumed. `mut` on `paper` is close to the line in the mockup and must
  be measured and darkened if it misses. The three role hues must clear AA as
  text and pass the dataviz skill's palette validator for colour-vision
  deficiency (`scripts/validate_palette.js`) as a categorical set, before the
  first piece ships. A single sequential ramp for "how much" (attention
  weight, memory strength) is ink mixed into paper; it is the only ramp.
- Grain: the portfolio's SVG fractal-noise tile (256px, baseFrequency 0.8,
  3 octaves, `color-interpolation-filters="sRGB"`), with the colour matrix set
  so each channel is the surface token plus 0.1 x (noise - 0.5), one tile for
  `paper` and one for `paper-under`, so the mean tone stays the token.
- Type scale (desktop / phone): piece title 44 / 32 (STIX, regular, balanced
  wrapping); claim line 20 italic in `mut`; body 16.5 at 1.5 line height,
  measure 62ch; index titles 24 / 20; captions and labels 12 mono; eyebrows
  12 mono uppercase with 0.08em tracking. **Floor 12px everywhere** (my
  call: the portfolio's 11px was a contrast compromise on a dark surface that
  paper does not need). Tabular numerals wherever digits line up.
- One reading column, max 720px, centred, 28px side padding (18px on phones),
  72px top padding so the first line clears the corner and the N mark.

### 5a. Paper conventions (v4, decided)

The owner adopted the "LaTeX paper" conventions from StyleKit's style spec,
brought onto this paper (its white becomes `paper`, its theorem fill becomes
`fill` `#e7e2d8`, its muted `#6B6B66` becomes `mut` `#625d54`, darkened to
clear AA on the off-white; its hyperref blue `#0B5394` is the `link` token):
- Serif throughout; mono only for tokens, numbers and code. Headings carry
  `letter-spacing: -0.01em`. Small-caps (`font-variant: small-caps`, 0.05em
  tracking) for keyword labels such as the index's stamp lines.
- **No rounded corners. No shadows**, except the fold's cast shadow, the one
  object on the page. No gradients, except the two-stop flat gradient on the
  back of the fold.
- Links and inline citations in `link` blue only; underline on hover.
- Document head centred: title, author line with a superscript affiliation
  ("Neelay Ranjan¹", "¹ neelayranjan.dev"), italic date with the number
  ("November 2026 · No. 1"). The call stamp sits at the head's right on
  desktop and inline above it on phones.
- An **Abstract** block, narrow (560px), justified, under a centred heading,
  carrying the claim and a one-sentence map of the figures.
- **Numbered sections** (1, 2, 3) and **numbered figures** with the caption
  BELOW, centred, "Figure 1:" in semibold, the "try" nudge in italic `mut`.
- **Definition boxes** for recurring terms: bold label ("Definition 1
  (Query, q)."), italic body, 2px left rule in the term's role colour, on
  `fill`.
- **Display equations** centred in italic with the "(n)" tag flushed right;
  cross-referenced by number from the captions.
- **booktabs tables**: 2px `ink` rules top and bottom, a 1px rule under an
  italic header row, no vertical rules, no zebra stripes, caption above
  ("Table 1: ..."), tabular numerals.
- **References**: hanging indent (2rem), "[n]" labels in `link`; after them a
  "cite this piece" block on `fill` with a copy button.
- The foot of a piece: small-caps "Offprints", the number and month, RSS.

## 6. The chrome and the peel (decided)

Two fixed things on every page, nothing else:
- **The dog-ear**, top left. At rest a 40px folded corner: the back of the
  paper as a flat triangle with one soft cast shadow and a light crease line,
  the page beneath showing through the gap. It is a `<button>` named
  "All pieces" with `aria-expanded`, drawn by the shell (an SVG overlay that
  tracks the fold size), with a hit area of at least 72px square clipped to
  the corner triangle, `touch-action: none`, cursor `grab`. Hover lifts it to
  52px and shows a 12px mono label, "all pieces · drag to peek" (hover-capable
  pointers only).
- **The N mark**, top right: the portfolio's mark (STIX N with the red corner
  brackets), a link to `https://neelayranjan.dev`, titled "Back to
  neelayranjan.dev".

The peel
- The piece is clipped by a polygon whose top-left corner is cut off along the
  diagonal `x + y = c`; the index page sits beneath it. The fold is the
  reflected corner (the triangle (c,0), (0,c), (c,c) with a slightly softened
  tip), filled with a flat two-stop gradient of the paper's back, a 1px light
  crease on the fold line, and a blurred shadow cast on the flat page only.
  No curl, no shading on the uncovered page (owner: "a little less 3d").
- **Click** (a press that moves under 6px): the fold animates from rest to
  past the far corner (`c = width + height + 120`) in 650ms with a cubic
  ease-out; the index is then fully exposed and the piece hidden
  (`visibility: hidden`, never unmounted: a demo's state and the scroll
  position survive).
- **Drag** (a press that moves 6px or more): the fold follows the pointer,
  `c = max(40, px + py)` in page coordinates, so the uncovered corner grows as
  far as the pointer is pulled and the index is readable beneath. On release
  at or past 40% of the far-corner value it finishes opening; before that it
  lays back down to rest. Pointer capture holds the drag through fast
  movement; `pointercancel` and lost capture end it as a release.
- Closing: a click on the corner while open, Escape, the browser's Back
  button (opening pushes a history entry so phones behave), or choosing a
  piece. Closing animates back to rest.
- Keyboard: the corner is in the tab order first; Enter or Space toggle.
  Opening moves focus to the index heading; closing returns it to the corner
  (or to the chosen piece's title when a piece was chosen).
- Reduced motion: every fold change is instant.
- **The hint** (Design Atlas's "restrained corner hint"): about 1.2s after
  load, once per page load, the corner lifts to ~66px over 900ms and settles
  back over 700ms. Never loops; nothing under reduced motion; skipped if the
  reader has already touched the corner.
- While open, the page behind does not scroll (body scroll lock); the index
  scrolls on its own.
- Progressive enhancement: the corner's underlying element links to `/all`
  for no-JS and crawlers; the script takes over on hydration.

## 7. The index (decided; v4 shape)

A full-bleed page in `paper-under` grain beneath every piece, and `/all` on
its own. It reads as a table of contents:
- The masthead, centred: "Offprints" at 30px and the italic line **"Recent
  favorite ideas, drawn rather than written. Neelay Ranjan."** (approved as
  part of the v4 mockup; the owner may still reword it).
- The heading "Contents", then the list newest first. Each entry: the number
  ("1."), the title at 18px, a dotted leader, the date at the right; beneath,
  the italic claim and the stamps in small-caps: `my call: useful` in
  `stamp`, `revisited: held up` in `k`, `revisited: aged badly` in `stamp`,
  `revisited: mixed` in `mut`. The open piece is marked "(open)". Rows are
  44px+ targets with no hairlines between them.
- The foot: RSS, neelayranjan.dev. No about page (v4 shipped none; the
  masthead line carries it).
- Drafts never appear and never route in production (`status: "draft"` in
  the registry); in development they do, marked.

## 8. A piece (decided)

The template, top to bottom; the registry entry supplies the facts, the
piece's own module supplies the figures and copy.
1. Head: eyebrow `No. NN · Month YYYY`, the title, the claim line; the call
   stamp at the right (rotated −7°, 2px `stamp` border, `multiply` blend,
   "USEFUL" or "USELESS" over "my call · 1 Nov 2026"); on phones the stamp
   sits inline above the eyebrow. When a revisit exists, a second stamp
   beside it ("HELD UP" / "AGED BADLY" / "MIXED" over "revisited · date").
2. The chain of figures, each a `Figure` with number, the interactive, and a
   mono caption line: `Figure N` · what it is, including the model, layer or
   head and the extraction date when output is precomputed · one "try"
   nudge · optionally a live readout. The first figure is the hero and sits
   within the first screen. Figures own their loading, unavailable and
   failed states, and state honestly when they are prerendered or
   watch-only on this device.
3. `Why it matters now`: the real-world relevance, a short paragraph or a
   few lines.
4. `Words, if you want them`: the supplement, folded in a `<details>`.
5. `Revisited`: present only once stamped; the owner's dated sentence on how
   the call aged.
6. `Sources`: a plain list of citations with links.
Headings 3 to 6 are numbered section headings in the paper conventions of
§5a (References unnumbered). Every figure follows them too: caption below,
"Figure N:", a "try" nudge, definitions and tables in their environments.

Data model, `content/offprints/pieces.ts` (typed, the single registry):
`slug`, `number`, `title`, `claim`, `published` (ISO date), `status`
("published" | "draft"), `call: { verdict: "useful" | "useless", date, line }`,
`revisit?: { verdict: "held up" | "aged badly" | "mixed", date, line }`,
`sources: Citation[]`, and the component to render. Each piece's copy lives
in `content/offprints/<slug>.ts` under the Voice rules and
`scripts/check-voice.mjs`'s scan; its figures in `components/offprints/<slug>/`.

Feed: `/feed.xml`, Atom, one entry per published piece (title, link, the
claim as summary, `published`; `updated` moves when a revisit is stamped),
the site title "Offprints", author Neelay Ranjan.

Analytics: the portfolio's Vercel Web Analytics covers the subdomain (same
project). One custom event per figure per page load after real output,
`demo_used { demo: "offprints/<slug>/<figure>" }`, through the existing
`trackDemoOnce`; the N mark and feed link go through `TrackedLink` as
`outbound_link`. Nothing per interaction.

Verification: a new check group in `scripts/verify-redesign.mjs` (or a
sibling file run the same way against the production build on :3000),
visiting `http://offprints.localhost:3000`: root serves the latest published
piece with its canonical; the corner is a button named "All pieces"; a click
opens the index with pieces newest first and the piece hidden but mounted; a
drag released at 25% lays back down and at 60% opens; Escape and Back close
and return focus; `/all` renders the same list without JS; 390px with touch
shows no horizontal scroll and a finger drag peeks; `/feed.xml` is valid Atom
listing exactly the published pieces; `neelayranjan.dev/offprints/x`
redirects to the subdomain; and the existing 56 checks still pass. Each new
check is proved to bite by a mutation, the portfolio's standard.

## 9. Open: the owner's calls

1. **The door from the portfolio.** "Easy and very prominent." Options: a
   bordered box under the paper stamp like the Supplementary material box
   (prominent, on page 1 first screen); an entry in the identity-links row;
   a line in the contents line; a References entry. Page 1 is curated
   copy, so this is yours. My default if unanswered: a bordered box beneath
   the Supplementary box reading "Offprints →" over the one-line claim of
   the latest piece, plus a References entry.
2. **The icon.** My proposal: the dog-ear itself, a paper square with its
   top-left corner folded, ink on paper, generated by a sibling of
   `scripts/gen-icons.py` so the favicon, the 192px PNG and the Apple icon
   come from one vector. Yes, or something else?
3. **An "about" sheet**: none (the index masthead's one line carries it), or
   a short sheet linked from the index foot? My default: none.
4. **The masthead line** on the index: your words, one sentence.

## 10. Settled after the builder check (my calls, 2026-11-01)

1. **The shell ships with piece 1, never empty.** The subdomain is not bound
   in Vercel, the page-1 door is not added, and the feed is not announced
   until hybrid attention is published; the root never renders "no pieces".
   Verification still needs two pieces, so the registry carries one
   permanent fixture, `No. 00`, a labelled test sheet with `status:
   "draft"` that exists only to be the second entry in checks.
2. **Drafts are gated on `VERCEL_ENV === "production"`, not `NODE_ENV`.** A
   preview deployment and a local `npm start` route and list drafts, marked
   "draft" in the eyebrow and the index, so the owner reviews a piece on the
   `dev` preview as every round so far and the verify suite sees the fixture
   on a local production build; the live site never does either.
3. **Previews use the internal prefix.** The proxy rewrites host-to-prefix
   only on hosts beginning `offprints.`, redirects `/offprints/*` to the
   subdomain only on `neelayranjan.dev` and `www.neelayranjan.dev`, and
   serves `/offprints/*` as-is on every other host (`*.vercel.app` previews,
   the `.vercel.app` production alias). Canonicals and `metadataBase` always
   name the subdomain. The prefix is unlisted, not secret.
4. **Document scroll, index on top.** The piece scrolls as the document (so
   the phone URL bar, scroll restoration and hash links behave); the index is
   a fixed layer ABOVE it, clipped to the uncovered triangle `x + y <= c`,
   and the fold overlay sits above both. The piece itself is never clipped.
   Visually identical to the mockup; the mockup's two nested scroll layers
   are not what ships. Body scroll locks only once the index is fully open.
5. **Analytics are prefixed.** `<Analytics beforeSend>` on the Offprints root
   rewrites the recorded path to `/offprints/...`, so the portfolio's `/`
   readouts (stargaze entries per view, `page_reload` by device) stay clean.
6. **One `demo_used` per figure per load**, after that figure's first real
   output, `demo: "offprints/<slug>/<figure>"`. Not per interaction, so the
   quota rule holds; per figure because which figure gets played is the one
   number that says what to build next. Reverse to per piece if the owner
   objects.

## 11. Interaction patterns every figure follows (v4, decided)

Taken from the three explainers the owner picked (Ciechanowski's *Curves and
Surfaces*, Harri's *ASCII Characters Are Not Pixels*, Gadermann's *Tab
Roving*, as read through Unsung's "Three good interactive explainers"):
- **Undo appears once you start experimenting**: a figure with a mutable
  state shows an "undo" control only after the first change, so the reader
  feels safe to poke. A full "reset" may sit beside it.
- **Colour coding ties the words to the figure**: a role (Q, K, V) has one
  hue, used for the token outline or tint in the figure, the definition
  box's rule and label, and the coloured words in the readout sentence.
  Consequence: Figure 1's attention ramp is the K green mixed into paper,
  not ink (changed from v3 by this rule; the owner may revert).
- **A / B / both, never a drag divider**: comparisons are a three-way toggle
  of plain bordered buttons with `aria-pressed`, "both" side by side (one
  column on phones).
- **Soft keys plus automatic playback** for anything stepped: ◂ ▸ step
  buttons, a play/pause, and a minimal slider (1px track, 10px square thumb)
  bound to the same position, so phones and keyboards both work.
- **Copy buttons** wherever text is meant to be taken away: the citation
  block, any code. `navigator.clipboard` with a select-the-text fallback and
  a 1.4s "copied" confirmation in the button itself.
- **Phones get the same figure**, one column, soft keys instead of hotkeys;
  where even that cannot work, the figure is watch-only or prerendered and
  says so (§3).
- Controls are plain: 1px `ink` border, square, serif, inverting on press;
  the primary action filled `ink`. No icons except the step arrows.
- **Toys are labelled**: a figure that runs a real rule on made-up data says
  "A toy: random N-dimensional ..., the real update rule" in its caption; a
  figure showing a real model's output names model, layer, head and the
  extraction date.

## 12. Left to the builder

- The exact route-group and `proxy.ts` layout, after reading the Next 16
  docs in `node_modules/next/dist/docs/` (multiple root layouts, the proxy
  file, metadata routes per host, `metadataBase`).
- How the peel overlay is structured in React (a client shell component
  wrapping the server-rendered piece and index), as long as the piece stays
  mounted while hidden and the index is server-rendered.
- Whether the verify checks live in the main suite or a sibling, and the
  mutation that proves each.
- The OG card generator for pieces (not needed for the shell's first ship).
- Measuring and, if needed, nudging `mut` and the role hues to clear AA and
  the CVD validator, keeping the hues recognisably what the mockup shows.
