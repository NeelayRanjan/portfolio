# Offprints Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Offprints shell (full-bleed paper, the dog-ear peel, the index, the piece template, the subdomain routing, the feed) inside this Next.js app, with the hybrid-attention piece present as a draft carrying its first real figure, so the owner can review the whole thing on a preview deployment.

**Architecture:** A second root layout in a route group (`app/(offprints)/offprints/`) with its own CSS tokens, beside the portfolio moved into `app/(portfolio)/`. A root `proxy.ts` maps the `offprints.` host onto the internal `/offprints` prefix and redirects the apex's `/offprints/*` to the subdomain. Pure logic (host decisions, peel geometry, piece visibility, the Atom feed) lives in `lib/offprints/*.ts` with `node --test` suites; the browser behaviour is pinned by new checks in `scripts/verify-redesign.mjs` against a production build, each proved to bite by a mutation.

**Tech Stack:** Next.js 16.2 (App Router, Turbopack, `proxy.ts`, route groups), React 19, TypeScript, Tailwind v4 `@theme` tokens, `next/font` (STIX Two Text, Spline Sans Mono), `@vercel/analytics`, Playwright Firefox for verification, Node 24 `node --test` for pure modules.

**Spec:** `docs/superpowers/specs/2026-11-01-offprints-shell-design.md` (the shell) and `docs/superpowers/specs/2026-11-01-concepts-site-plan.md` §5 (the extracted Qwen data for piece 1).

## Global Constraints

- Read `node_modules/next/dist/docs/` before writing Next code (AGENTS.md); the relevant pages: `03-file-conventions/route-groups.md`, `layout.md` (multiple root layouts), `proxy.md`, `not-found.md`, `01-metadata/robots.md`, `01-metadata/sitemap.md`.
- The portfolio's URLs, HTML and headers do not change: `/`, `/lab`, `/api/iss-tle`, `/robots.txt`, `/sitemap.xml`, the 404. Its 56 verify checks and 203 node tests keep passing (`node --test scripts/test-*.mjs`; `node scripts/verify-redesign.mjs`).
- Every visitor-facing string lives in `content/offprints/*.ts` and passes `node scripts/check-voice.mjs` (no em-dashes, the banned-word list; CLAUDE.md "Voice").
- Hosts: canonical `https://offprints.neelayranjan.dev`; the Offprints host is any host whose lowercased name (port stripped) begins `offprints.`; the apex hosts are `neelayranjan.dev` and `www.neelayranjan.dev`. Internal prefix `/offprints`. Local verification host `http://offprints.localhost:3000`.
- Drafts: a piece with `status: "draft"` routes and lists only when `process.env.VERCEL_ENV !== "production"`.
- Tokens (spec §5, §5a): `paper #efebe3`, `paper-under #e6e1d7`, `fill #e7e2d8`, `ink #1d1b17`, `mut #625d54`, `rule #cbc5b8`, `link #0B5394`, `stamp #b9311f`, `q #3f55c9`, `k #1e8468`, `v #b86a12`. Light only. Text floor 12px. No rounded corners, no shadows except the fold's.
- Peel constants (spec §6): rest 40px, hover 52px, click slop 6px, open duration 650ms cubic ease-out, far corner `width + height + 120`, release threshold 40% of far corner, drag `c = max(40, px + py)`, hint at 1.2s to 66px (900ms out, 700ms back), instant under reduced motion.
- COOP/COEP headers stay on every route (`next.config.ts` `source: "/:path*"`).
- Analytics: Offprints page views recorded under `/offprints/...`; `demo_used { demo: "offprints/<slug>/<figure>" }` once per figure per load after real output; the N mark and the feed link as `outbound_link`.
- Commit after every task, on branch `offprints`, messages in the repo's style (`feat:`/`test:`/`docs:` prefixes are fine); never push without the owner.

## Review Focus

Spec-implied inputs no task's happy path exercises; each line's test is added to the owning task.

1. **A browser's automatic `/favicon.ico` on the Offprints host** must serve the Offprints icon, not a 404 or the portfolio's N (Task 4 proxy pass-through for `/offprints/*` assets; Task 8 declares icons under `/offprints/icons/`). Test in Task 8.
2. **A draft slug requested on a production build with `VERCEL_ENV=production`** must 404, and the index and feed must not list it (Task 2's `visiblePieces`; Task 3's `dynamicParams = false`). Test in Task 2 (pure) and Task 9 (feed).
3. **The peel while the piece is scrolled down**: the fold and the uncovered triangle must stay anchored to the viewport's corner, not the document's. Test in Task 6 (`scrollY > 0` before the drag).
4. **The Back button after opening the index via the peel** must close the index and stay on the piece, never leave the site. Test in Task 6.
5. **A host written `Offprints.LOCALHOST:3000`** (case, port) must still be the Offprints host, and a host with no match must pass through untouched. Test in Task 4 (pure).

---

## File structure

Created:
- `app/(portfolio)/layout.tsx`, `app/(portfolio)/page.tsx`, `app/(portfolio)/lab/page.tsx`, `app/(portfolio)/not-found.tsx`, `app/(portfolio)/[...rest]/page.tsx` (moved/added; the portfolio's root)
- `app/(offprints)/offprints/layout.tsx` (the Offprints root: html/body, fonts, `offprints.css`, analytics, the Shell)
- `app/(offprints)/offprints/offprints.css` (Tailwind entry with the Offprints `@theme`, grain tiles, base rules)
- `app/(offprints)/offprints/page.tsx` (root: the latest piece), `[slug]/page.tsx`, `all/page.tsx`, `not-found.tsx`, `[...rest]/page.tsx`
- `app/(offprints)/offprints/feed.xml/route.ts`, `robots.txt/route.ts`, `sitemap.xml/route.ts`
- `proxy.ts` (project root)
- `lib/fonts.ts` (the two `next/font` loaders, shared by both roots)
- `lib/offprints/host.ts`, `lib/offprints/pieces.ts`, `lib/offprints/peel.ts`, `lib/offprints/undo.ts`, `lib/offprints/feed.ts`, `lib/offprints/site.ts`
- `content/offprints/shell.ts` (shell copy), `content/offprints/pieces.ts` (the registry), `content/offprints/hybrid-attention.ts` (piece copy), `content/offprints/test-sheet.ts`
- `content/offprints/hybrid-attention/figure1.json` (derived data) and `scripts/offprints/derive-hybrid-attention.mjs`
- `components/offprints/Shell.tsx` (client), `OffLink.tsx` (client), `HomeMark.tsx`, `IndexPage.tsx`, `PieceFrame.tsx`, `CallStamp.tsx`, `Figure.tsx`, `Definition.tsx`, `Booktabs.tsx`, `Equation.tsx`, `CopyButton.tsx` (client), `Toggle.tsx` (client), `StepControls.tsx` (client), `OffprintsAnalytics.tsx` (client)
- `components/offprints/pieces/index.ts` (slug to component map), `components/offprints/pieces/hybrid-attention/Piece.tsx`, `Figure1Attention.tsx` (client), `components/offprints/pieces/test-sheet/Piece.tsx`
- `scripts/test-offprints-host.mjs`, `test-offprints-pieces.mjs`, `test-offprints-peel.mjs`, `test-offprints-undo.mjs`, `test-offprints-feed.mjs`
- `scripts/gen-offprints-icons.mjs`, `scripts/offprints-icon.svg`, `public/offprints/icons/{favicon.ico,icon-192.png,apple-icon.png}`, `scripts/gen-offprints-og.mjs`, `public/offprints/og.png`

Modified:
- `scripts/verify-redesign.mjs` (new `offprints-*` checks), `scripts/check-voice.mjs` (scan `content/offprints/*.ts`), `content/copy.ts` (the page-1 door and References entry), `components/manuscript/Masthead.tsx` (the door), `CLAUDE.md`, `docs/superpowers/specs/2026-11-01-concepts-site-plan.md`.

---

### Task 0: Branch

**Files:** none.

- [ ] **Step 1: Create the worktree from the deployed main** (local `main` is stale at 409c09e; `origin/main` is f97da44, the homepage-fixes rounds). Use the superpowers:using-git-worktrees skill; the commands it should run:

```bash
cd /home/neelayranjan/Documents/portfolio && git fetch origin && git branch -f main origin/main
git worktree add ../portfolio-offprints -b offprints origin/main
cd ../portfolio-offprints && npm ci && node scripts/sync-ort.mjs
```

- [ ] **Step 2: Baseline.** Run `node --test scripts/test-*.mjs` (expect 203 pass) and `npm run build` (expect success, routes `/`, `/lab`, `○ /api/iss-tle`, `/robots.txt`, `/sitemap.xml`). Record the build's route list in the task notes.

---

### Task 1: The portfolio moves into its own route group

**Files:**
- Create: `lib/fonts.ts`; `app/(portfolio)/[...rest]/page.tsx`
- Move: `app/layout.tsx` → `app/(portfolio)/layout.tsx`; `app/page.tsx` → `app/(portfolio)/page.tsx`; `app/lab/page.tsx` → `app/(portfolio)/lab/page.tsx`; `app/not-found.tsx` → `app/(portfolio)/not-found.tsx`
- Keep at `app/`: `globals.css`, `robots.ts`, `sitemap.ts`, `api/iss-tle/route.ts`

**Interfaces:**
- Produces: `lib/fonts.ts` exporting `stix` and `splineMono` (the exact `STIX_Two_Text`/`Spline_Sans_Mono` calls now in `app/layout.tsx`, variables `--font-stix`, `--font-spline-mono`).

- [ ] **Step 1: Write the check that pins the portfolio's URLs** as a node script step in this task's notes (no new suite file): after `npm run build && npm start -- -p 3000`, `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → 200; `/lab` → 200; `/robots.txt` → 200 containing `Sitemap: https://neelayranjan.dev/sitemap.xml`; `/sitemap.xml` → 200 listing exactly `https://neelayranjan.dev` and `https://neelayranjan.dev/lab`; `/nope` → 404 whose body contains `copy.notFound.heading` ("reference not found" conceit). Run it before the move: all pass.
- [ ] **Step 2: Create `lib/fonts.ts`** with the two loaders moved verbatim out of `app/layout.tsx`, exported as `stix` and `splineMono`.
- [ ] **Step 3: Move the four files** with `git mv` into `app/(portfolio)/`, fix the relative `./globals.css` import to `../globals.css`, import the fonts from `@/lib/fonts`.
- [ ] **Step 4: Add `app/(portfolio)/[...rest]/page.tsx`**: `export default function CatchAll() { notFound(); }` (from `next/navigation`), with `export const dynamic = "force-static"` if the build complains about dynamic params; this keeps the portfolio's `not-found.tsx` as the 404 for unmatched URLs once a second root layout exists (per `not-found.md`: no top-level layout means no shared 404 without the experimental flag, which we do not enable).
- [ ] **Step 5: Build and re-run Step 1's curls.** Expected: identical results; `npm run build` lists the same routes plus `/[...rest]`.
- [ ] **Step 6: Run the fast verify subset** `node scripts/verify-redesign.mjs search-basics stamp-no-link references-lab lab-box colophon resume-pdf` against the production build. Expected: all PASS.
- [ ] **Step 7: Commit** `refactor: move the portfolio into app/(portfolio) ahead of a second root layout`.

---

### Task 2: The registry and piece visibility

**Files:**
- Create: `content/offprints/pieces.ts`, `content/offprints/shell.ts`, `content/offprints/test-sheet.ts`, `content/offprints/hybrid-attention.ts`, `lib/offprints/pieces.ts`, `lib/offprints/site.ts`
- Test: `scripts/test-offprints-pieces.mjs`
- Modify: `scripts/check-voice.mjs` (add the three `content/offprints/*.ts` files to `FILES` with `skipKeys` `["url", "href", "slug"]`)

**Interfaces:**
- Produces, in `content/offprints/pieces.ts`:
  ```ts
  export type Verdict = "useful" | "useless";
  export type RevisitVerdict = "held up" | "aged badly" | "mixed";
  export type Citation = { label: string; title: string; venue: string; year: number; href?: string };
  export type Piece = {
    slug: string; number: number; title: string; claim: string;
    published: string;            // ISO date "2026-11-01"
    status: "published" | "draft";
    call: { verdict: Verdict; date: string; line: string };
    revisit?: { verdict: RevisitVerdict; date: string; line: string };
    sources: Citation[];
  };
  export const PIECES: readonly Piece[];   // two entries: test-sheet (number 0, draft) and hybrid-attention (number 1, draft, published "2026-11-01")
  ```
- Produces, in `lib/offprints/pieces.ts` (no imports except the registry; pure):
  ```ts
  export function visiblePieces(all: readonly Piece[], vercelEnv: string | undefined): Piece[]; // drafts out when vercelEnv === "production"; sorted newest first by `published`, ties by number desc
  export function latestPiece(all: readonly Piece[], vercelEnv: string | undefined): Piece | null;
  export function pieceBySlug(all: readonly Piece[], slug: string, vercelEnv: string | undefined): Piece | null;
  export function numberLabel(n: number): string; // "No. 1", "No. 0"
  export function monthYear(iso: string): string; // "November 2026", en-US, UTC
  ```
- Produces, in `lib/offprints/site.ts`: `export const OFFPRINTS_SITE = "https://offprints.neelayranjan.dev"; export function pieceUrl(slug: string): string;` (absolute, on the canonical host). The prefix constant lives in `lib/offprints/host.ts` (Task 4) as the single source; until Task 4 exists, `site.ts` declares it and Task 4 moves it.
- Produces, in `content/offprints/shell.ts`: `shell.meta.{siteName:"Offprints", title, description}`, `shell.ear.label` ("All pieces"), `shell.ear.hint` ("all pieces · drag to peek"), `shell.index.{masthead:"Offprints", line:"Recent favorite ideas, drawn rather than written. Neelay Ranjan.", contents:"Contents", open:"(open)", callPrefix:"my call: ", revisitPrefix:"revisited: ", draft:"draft", feed:"RSS", home:"neelayranjan.dev"}`, `shell.piece.{abstract:"Abstract", references:"References", cite:"cite this piece", copy:"copy", copied:"copied", selected:"selected", why:"Why it matters now", words:"Words, if you want them", revisited:"Revisited", callLine:"my call", revisitLine:"revisited", footRss:"RSS"}`, `shell.homeMark.title` ("Back to neelayranjan.dev"), `shell.notFound.{heading, lede, back}`.

- [ ] **Step 1: Write the failing tests** in `scripts/test-offprints-pieces.mjs` (`node:test`, `assert/strict`, importing `../content/offprints/pieces.ts` and `../lib/offprints/pieces.ts`):
  - `visiblePieces(PIECES, "production")` returns `[]` (both entries are drafts) and `visiblePieces(PIECES, "preview")` returns both, newest first (`hybrid-attention` before `test-sheet` given `test-sheet` is `published: "2026-10-31"`).
  - A synthetic list with two published pieces dated `2026-11-01` and `2026-12-01` sorts December first under `"production"`.
  - `latestPiece(PIECES, "production")` is `null`; `latestPiece(PIECES, undefined)` has slug `hybrid-attention`.
  - `pieceBySlug(PIECES, "test-sheet", "production")` is `null`; under `"development"` its number is `0`.
  - `numberLabel(1) === "No. 1"`; `monthYear("2026-11-01") === "November 2026"`.
  - Every `Piece` has a non-empty `claim` ending in a period and `sources.length >= 1`; slugs are unique and match `/^[a-z0-9-]+$/`.
  - `pieceUrl("hybrid-attention") === "https://offprints.neelayranjan.dev/hybrid-attention"`.
- [ ] **Step 2: Run** `node --test scripts/test-offprints-pieces.mjs`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** the registry (hybrid-attention: title "Hybrid attention", claim "How Qwen 4 reads a sentence with a quarter of the attention it used to.", call `{ verdict: "useful", date: "2026-11-01", line: "" }`, sources [1] Qwen team, "On the design of Qwen3.8-Next architecture: evaluation, efficiency, and training stability", arXiv 2608.30320, 2026, href `https://arxiv.org/abs/2608.30320`; [2] S. Yang, J. Kautz, A. Hatamizadeh, "Gated Delta Networks: improving Mamba2 with delta rule", ICLR, 2025; test-sheet: title "A test sheet", claim "A fixture that exists so the checks have a second entry.", number 0, published "2026-10-31", draft, one source), the shell copy, the piece copy files (hybrid-attention's abstract from the v4 mockup reduced to Figure 1: "Alibaba says Qwen3.8-Flash-Next is the Qwen 4 architecture [1]. It keeps one attention layer in four and replaces the other three with a fixed-size memory that is overwritten as the text goes by. Figure 1 shows what the attention layer does with a sentence."; `why`, `words` with the equation parts, the figure-1 caption, the three definitions, the readout template "“{from}” puts {pct}% of its attention on “{to}”", `undo`), and the pure helpers.
- [ ] **Step 4: Run the tests.** Expected: PASS. Run `node scripts/check-voice.mjs`. Expected: clean (fix any flagged word in the new copy).
- [ ] **Step 5: Commit** `feat(offprints): the piece registry, visibility rules and shell copy`.

---

### Task 3: The Offprints root layout and pages

**Files:**
- Create: `app/(offprints)/offprints/layout.tsx`, `offprints.css`, `page.tsx`, `[slug]/page.tsx`, `all/page.tsx`, `not-found.tsx`, `[...rest]/page.tsx`; `components/offprints/HomeMark.tsx`, `IndexPage.tsx`, `PieceFrame.tsx`, `CallStamp.tsx`, `Figure.tsx`, `CopyButton.tsx`, `OffLink.tsx`; `components/offprints/pieces/index.ts`, `pieces/test-sheet/Piece.tsx`, `pieces/hybrid-attention/Piece.tsx` (a placeholder figure box until Task 10). `Definition`, `Booktabs` and `Equation` are Task 7's.

**Interfaces:**
- `components/offprints/pieces/index.ts`: `export const PIECE_COMPONENTS: Record<string, React.ComponentType<{ piece: Piece }>>` keyed by slug; `PieceFrame` throws at render if a visible slug has no component (a build error, not a blank page).
- `PieceFrame({ piece, children })` (server): the document head (title, "Neelay Ranjan¹", affiliation "¹ neelayranjan.dev", italic `monthYear(published) · No. N`), the `CallStamp`, the abstract from the piece copy, `children` (the figures and numbered sections the piece supplies), then numbered "Why it matters now" and "Words, if you want them" from the piece copy, "Revisited" when `piece.revisit` exists, References with hanging indents and `[n]` labels, the cite box with `CopyButton`, the foot. Section numbers are assigned by `PieceFrame` in order.
- `Figure({ n, caption, tryText, children })`: `<figure id="fig-N">`, caption below, "Figure N:" semibold, the try nudge italic `mut`.
- `OffLink({ href, ...a })` (client): renders `<a href={publicHref(href, hostname)}>`; server-renders with the `/offprints` prefix form and swaps on mount (uses `lib/offprints/host.ts` from Task 4; until then a local stub that returns `href`).
- `CopyButton({ text })` (client): `navigator.clipboard.writeText` with a select-the-text fallback; label `shell.piece.copy` → `copied` (or `selected`) for 1400ms.
- `IndexPage({ pieces, currentSlug })` (server): the Contents list per spec §7, each row an `OffLink` to `/offprints/<slug>`; stamps as small-caps spans with classes `call`, `held`, `aged`, `mixed`; draft rows carry the word `shell.index.draft`.
- The layout: `<html lang="en" className={stix.variable + splineMono.variable}>`, `<body className="font-serif">`, children only (the Shell arrives in Task 6; until then the body renders `<main id="main">{children}</main>` and a static `<HomeMark />`).
- Pages: `page.tsx` renders `latestPiece(PIECES, process.env.VERCEL_ENV)` inside `PieceFrame` (or `notFound()` when null) with `alternates.canonical = pieceUrl(slug)`; `[slug]/page.tsx` with `generateStaticParams` over `visiblePieces(...)` and `export const dynamicParams = false`; `all/page.tsx` renders `IndexPage`; `[...rest]/page.tsx` calls `notFound()`; `not-found.tsx` is a paper sheet with `shell.notFound`.
- `offprints.css`: `@import "tailwindcss"; @theme { --color-paper: #efebe3; ... --font-serif: var(--font-stix); --font-mono: var(--font-spline-mono); }`, `html { background: var(--color-paper); color-scheme: light }`, the two grain tiles as `[data-op-paper]` and `[data-op-under]` rules (fractal noise, baseFrequency 0.8, 3 octaves, `color-interpolation-filters="sRGB"`, colour matrix offsets `paper/255 - 0.05` per channel: 0.887/0.872/0.840 and 0.852/0.833/0.793), `:focus-visible { outline: 2px solid var(--color-ink) }`, `a { color: var(--color-link) }`, headings `letter-spacing: -0.01em`, body 16px/1.6, the `.sc` small-caps utility.

- [ ] **Step 1: Write the build-time assertion** as this task's verification: after `npm run build`, the route list contains `/offprints`, `/offprints/[slug]` with `/offprints/hybrid-attention` and `/offprints/test-sheet` prerendered (local builds have no `VERCEL_ENV`, so drafts are visible), `/offprints/all`, `/offprints/[...rest]`; and `VERCEL_ENV=production npm run build` prerenders neither slug and `/offprints` renders the 404 (curl → 404).
- [ ] **Step 2: Implement** the files above. The CSS tokens exactly as in Global Constraints. Serif throughout; mono only via `font-mono` on tokens and numbers.
- [ ] **Step 3: Build and curl** `http://localhost:3000/offprints/` → 200 with "Hybrid attention" and `<link rel="canonical" href="https://offprints.neelayranjan.dev/hybrid-attention">`; `/offprints/all` → 200 listing "1." "Hybrid attention" and "0." "A test sheet" with "draft"; `/offprints/nope` → 404 with `shell.notFound.heading`; `/` still the portfolio. Then Step 1's production-env build.
- [ ] **Step 4: Commit** `feat(offprints): second root layout, paper tokens, the index and piece pages`.

---

### Task 4: Host rules and the proxy

**Files:**
- Create: `lib/offprints/host.ts`, `proxy.ts`
- Test: `scripts/test-offprints-host.mjs`
- Modify: `components/offprints/OffLink.tsx` (use `publicHref`)

**Interfaces:**
- `lib/offprints/host.ts` (no imports):
  ```ts
  export const OFFPRINTS_PREFIX = "/offprints";
  export function hostName(hostHeader: string | null | undefined): string; // lowercased, port stripped, "" for null
  export function isOffprintsHost(host: string): boolean;   // hostName(host).startsWith("offprints.")
  export function isApexHost(host: string): boolean;        // "neelayranjan.dev" | "www.neelayranjan.dev"
  export function isAssetPath(pathname: string): boolean;   // last segment has an extension, except robots.txt, sitemap.xml, feed.xml
  export type Decision = { kind: "pass" } | { kind: "rewrite"; to: string } | { kind: "redirect"; to: string; status: 308 };
  export function decide(hostHeader: string | null, pathname: string, search: string): Decision;
  export function publicHref(href: string, hostname: string): string; // strips the prefix on an Offprints host, else returns href
  ```
  `decide` rules, in order: not an Offprints host and not apex → pass. Apex and pathname starts with `/offprints` → redirect to `https://offprints.neelayranjan.dev` + pathname without the prefix (`/offprints` alone → `/`) + search. Apex otherwise → pass. Offprints host and pathname starts with `/offprints/` and `isAssetPath` → pass. Offprints host and pathname starts with `/offprints` (a page path) → redirect to the same origin with the prefix stripped (status 308; `/offprints` → `/`). Offprints host otherwise → rewrite to `/offprints` + pathname (`/` → `/offprints`).
- `proxy.ts`: `export function proxy(req: NextRequest)` applying `decide(req.headers.get("host"), req.nextUrl.pathname, req.nextUrl.search)` with `NextResponse.rewrite(new URL(to, req.url))` / `NextResponse.redirect(to or new URL(to, req.url), 308)` / `NextResponse.next()`; `export const config = { matcher: ["/((?!_next/|api/).*)"] }`.

- [ ] **Step 1: Write the failing tests** in `scripts/test-offprints-host.mjs`:
  - `hostName("Offprints.LOCALHOST:3000") === "offprints.localhost"`; `hostName(null) === ""`.
  - `decide("offprints.neelayranjan.dev", "/", "")` → `{ kind: "rewrite", to: "/offprints" }`; `("offprints.localhost:3000", "/hybrid-attention", "?x=1")` → rewrite `/offprints/hybrid-attention` (search is kept by the proxy, not the decision); `("offprints.localhost", "/robots.txt", "")` → rewrite `/offprints/robots.txt`; `("offprints.localhost", "/offprints/icons/icon-192.png", "")` → pass; `("offprints.localhost", "/offprints/all", "")` → redirect `/all` 308; `("offprints.localhost", "/offprints", "")` → redirect `/`.
  - `decide("neelayranjan.dev", "/offprints/hybrid-attention", "?a=b")` → redirect `https://offprints.neelayranjan.dev/hybrid-attention?a=b`; `("www.neelayranjan.dev", "/offprints", "")` → redirect `https://offprints.neelayranjan.dev/`; `("neelayranjan.dev", "/lab", "")` → pass.
  - `decide("portfolio-abc.vercel.app", "/offprints/all", "")` → pass; `decide("localhost:3000", "/", "")` → pass.
  - `publicHref("/offprints/all", "offprints.localhost") === "/all"`; `publicHref("/offprints", "offprints.neelayranjan.dev") === "/"`; `publicHref("/offprints/all", "localhost") === "/offprints/all"`; `publicHref("https://neelayranjan.dev", "offprints.localhost")` unchanged.
- [ ] **Step 2: Run** `node --test scripts/test-offprints-host.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `host.ts` and `proxy.ts`; wire `OffLink` to `publicHref(href, location.hostname)` in a mount effect.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Build, start on :3000, verify from the shell:** `curl -s -o /dev/null -w '%{http_code}' http://offprints.localhost:3000/` → 200 and the body contains "Hybrid attention"; `curl -sI http://offprints.localhost:3000/offprints/all | grep -i '^location'` → `location: /all` (or absolute equivalent) with 308; `curl -sI -H 'Host: neelayranjan.dev' http://localhost:3000/offprints/hybrid-attention` → 308 to `https://offprints.neelayranjan.dev/hybrid-attention`; `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/offprints/all` → 200 (pass-through on a non-canonical host); `curl -s http://localhost:3000/lab | grep -c 'Supplementary'` unchanged. If `offprints.localhost` fails to resolve in curl, use `--resolve offprints.localhost:3000:127.0.0.1` and note it; Playwright Firefox resolves `*.localhost` to loopback natively.
- [ ] **Step 6: Commit** `feat(offprints): host rules and the proxy that maps the subdomain onto /offprints`.

---

### Task 5: Peel geometry, pure

**Files:**
- Create: `lib/offprints/peel.ts`
- Test: `scripts/test-offprints-peel.mjs`

**Interfaces:**
```ts
export const PEEL = { rest: 40, hover: 52, slop: 6, openMs: 650, threshold: 0.4, hintTo: 66, hintDelayMs: 1200, hintOutMs: 900, hintBackMs: 700 } as const;
export function farCorner(width: number, height: number): number;         // width + height + 120
export function cutFromPointer(px: number, py: number, width: number, height: number): number; // clamp(px + py, rest, farCorner)
export function releaseTarget(cut: number, width: number, height: number): "open" | "rest"; // cut >= threshold * farCorner
export function easeOutCubic(u: number): number;
export function flapPath(c: number): string;   // `M ${c} 0 Q ${c} ${c*0.6} ${c*0.96} ${c*0.96} Q ${c*0.6} ${c} 0 ${c} Z`
export function clipPolygon(c: number): string; // `polygon(0 0, ${c}px 0, 0 ${c}px)` for the index layer (the uncovered triangle)
export function shadowOffset(c: number): number;      // min(10, 2 + c * 0.012)
export function shadowBlur(c: number): number;        // min(10, 3 + c * 0.01)
```

- [ ] **Step 1: Write the failing tests**: `farCorner(1280, 800) === 2200`; `cutFromPointer(10, 10, 1280, 800) === 40`; `cutFromPointer(300, 200, 1280, 800) === 500`; `cutFromPointer(5000, 5000, 1280, 800) === 2200`; `releaseTarget(879, 1280, 800) === "rest"` and `releaseTarget(880, 1280, 800) === "open"`; `easeOutCubic(0) === 0`, `easeOutCubic(1) === 1`, `easeOutCubic(0.5) === 0.875`; `flapPath(100)` equals the string with the constants above; `clipPolygon(40) === "polygon(0 0, 40px 0, 0 40px)"`; `shadowOffset(2200) === 10`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(offprints): the peel's geometry as a pure module`.

---

### Task 6: The Shell: dog-ear, fold, index layer, peel behaviour

**Files:**
- Create: `components/offprints/Shell.tsx` (client)
- Modify: `app/(offprints)/offprints/layout.tsx` (wrap children in `<Shell index={<IndexPage ... />}>`), `app/(offprints)/offprints/all/page.tsx` (still renders `IndexPage` directly; the Shell is for pieces, so the layout passes `index` only when the route is a piece: do this by having `page.tsx` and `[slug]/page.tsx` render `<Shell index={<IndexPage/>}>{piece}</Shell>` themselves, and the layout stay plain)
- Test: a new check `offprints-peel` in `scripts/verify-redesign.mjs`

**Interfaces:**
- `Shell({ index, currentSlug, children })`: renders, in order: `<main id="main" data-op-piece>` with `children` (the document flow, scrollable as the page); `<nav aria-label={shell.ear.label} data-op-index>` fixed, inset 0, `overflow: auto`, `[data-op-under]` grain, `clip-path: clipPolygon(cut)`, `aria-hidden` until open, containing `index`; an `<svg data-op-fold aria-hidden>` fixed over everything, `pointer-events: none`, drawing the cast shadow (clipped to the flat page), the flap (`flapPath(cut)`, two-stop gradient `#ece8df → #d8d2c5`), and a 1px crease line at 50% white; the ear `<a href="/offprints/all" data-op-ear role="button" aria-label={shell.ear.label} aria-expanded>` fixed top-left, 72px square clipped to the corner triangle, `touch-action: none`, cursor `grab`; the hover label `<span data-op-ear-hint>`; `<HomeMark />` top right.
- State and behaviour per spec §6, using `lib/offprints/peel.ts`: `cut` in a ref driven by rAF (`easeOutCubic`); a press that moves under `PEEL.slop` is a click (open fully, or close when open); a drag sets `cut = cutFromPointer(px, py, innerWidth, innerHeight)` and on release goes to `releaseTarget`; opening pushes `history.pushState({ opIndex: true }, "")` and `popstate` closes; when fully open: `main` gets `visibility: hidden`, `document.documentElement.style.overflow = "hidden"`, the nav loses `aria-hidden`, focus moves to the index's `h1`; closing restores all, focus returns to the ear (or the new piece navigates). Escape closes. Enter/Space on the ear toggle. Reduced motion: `cut` set directly. The hint: once per load after `PEEL.hintDelayMs`, skipped if the ear has been pressed or hovered. Expose `window.__offprints = { cut, open, hintFired }` as verify hooks.
- Hover lifts to `PEEL.hover` only for `(hover: hover)` pointers.

- [ ] **Step 1: Write the failing check** `offprints-peel` in `scripts/verify-redesign.mjs` (a `withPage` at 1280×800 visiting `${OFFPRINTS_BASE}/`, where `const OFFPRINTS_BASE = process.env.OFFPRINTS_BASE ?? BASE.replace("://", "://offprints.")`):
  - the ear exists, `aria-label` equals `shell.ear.label`, `aria-expanded="false"`, `window.__offprints.cut === 40`;
  - scroll to `window.scrollTo(0, 600)`; the ear's bounding box is still at the viewport's top-left (x < 72, y < 72); a drag from (10,10) to (300,200) in 8 steps gives `__offprints.cut` within 2 of 500 and the index nav's `clip-path` containing `500px`; release → `cut` returns to 40 within 1.5s and `aria-expanded` stays false;
  - a drag to (900,500) and release → `aria-expanded="true"`, `__offprints.open === true`, `main` has `visibility: hidden`, `document.activeElement` is inside `[data-op-index]`, the index lists "Hybrid attention" before "A test sheet";
  - `page.goBack()` → `open === false`, `aria-expanded="false"`, URL unchanged (`/`), `main` visible, `document.activeElement` is the ear;
  - a click (no movement) on the ear → open; Escape → closed, focus on the ear;
  - under `reducedMotion: "reduce"`: a click opens with `cut === farCorner` on the next frame and `hintFired === false` after 2.5s;
  - at 1280×800 without reduced motion: after 2.5s `hintFired === true` and `cut === 40` again;
  - a mutation note in the check's header: swapping `releaseTarget`'s comparison to `>` must fail the 880 boundary (`drag to exactly threshold`), and dropping `pushState` must fail the Back step.
- [ ] **Step 2: Run** `node scripts/verify-redesign.mjs offprints-peel` against the build. Expected: FAIL (no ear).
- [ ] **Step 3: Implement `Shell.tsx`** and wire the pages.
- [ ] **Step 4: Run the check.** Expected: PASS. Then prove it bites: apply each mutation in the header, rebuild, run, see FAIL, revert.
- [ ] **Step 5: Commit** `feat(offprints): the dog-ear peel, click opens, drag peeks`.

---

### Task 7: Figure primitives for the paper conventions and interaction patterns

**Files:**
- Create: `components/offprints/Definition.tsx`, `Booktabs.tsx`, `Equation.tsx`, `Toggle.tsx`, `StepControls.tsx`, `useUndo.ts` (client), `lib/offprints/undo.ts`; extend `offprints.css` with the `.op-tool` button style (1px ink border, square, serif 13px, inverts on `aria-pressed`/hover; `.op-tool--primary` filled) and `input[type=range].op-min` (1px track, 10px square thumb)
- Test: `scripts/test-offprints-undo.mjs`

**Interfaces:**
- `Definition({ n, term, symbol, role, children })` with `role: "q" | "k" | "v" | "ink"`: bold label "Definition n (term, symbol).", italic body, 2px left rule in the role colour, on `fill`. `Booktabs({ caption, head, rows })`: 2px ink rules top and bottom, 1px under the italic header, no vertical rules, caption above "Table n: ...", `tabular-nums`. `Equation({ n, children })`: centred italic with "(n)" flushed right.
- `Toggle<T extends string>({ options: { value: T; label: string }[]; value: T; onChange(v: T): void; label: string })`: a `role="group"` of `.op-tool` buttons with `aria-pressed`.
- `StepControls({ position, max, playing, onStep(n), onPlayToggle(), labels: { prev, play, pause, next, position } })`: ◂ ▸ buttons, play/pause (`.op-tool--primary`), the `.op-min` range bound to `position`.
- `useUndo<T>(initial: T): { value: T; set(v: T): void; undo(): void; canUndo: boolean; reset(): void }`.

- [ ] **Step 1: Write the failing test** for the one pure part, `useUndo`'s reducer `undoReducer(state: { value: T; past: T[] }, action: { type: "set"; value: T } | { type: "undo" } | { type: "reset"; value: T })` in `lib/offprints/undo.ts`, tested in `scripts/test-offprints-undo.mjs`: set twice then undo returns the first value; `past` is empty at start; `undo` on an empty past is a no-op; `reset` clears `past`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the reducer, the hook over it, the five components, the CSS; render one `Definition`, one `Booktabs` and one `Equation` in the test-sheet piece so they have a live instance. **Step 4: Run** → PASS; `npm run build` passes; curl `/offprints/test-sheet` contains "Definition 1" and "Table 1:".
- [ ] **Step 5: Commit** `feat(offprints): definition, table and equation environments; toggle, step controls, undo`.

---

### Task 8: Metadata, icons, analytics per host

**Files:**
- Create: `app/(offprints)/offprints/robots.txt/route.ts`, `sitemap.xml/route.ts`, `components/offprints/OffprintsAnalytics.tsx`, `scripts/offprints-icon.svg`, `scripts/gen-offprints-icons.mjs`, `public/offprints/icons/{favicon.ico,icon-192.png,apple-icon.png}`, `scripts/gen-offprints-og.mjs`, `public/offprints/og.png`
- Modify: `app/(offprints)/offprints/layout.tsx` (metadata), the pages (`generateMetadata`)
- Test: `offprints-search` check in `scripts/verify-redesign.mjs`

**Interfaces:**
- Layout `metadata`: `metadataBase: new URL(OFFPRINTS_SITE)`, `title: { default: shell.meta.title, template: "%s · Offprints" }`, `icons` at `/offprints/icons/favicon.ico` (16/32), `/offprints/icons/icon-192.png`, apple `/offprints/icons/apple-icon.png`, `openGraph.images: ["/offprints/og.png"]` (1200×630), `robots: { index: true }`.
- `[slug]/page.tsx` `generateMetadata`: `title: piece.title`, `description: piece.claim`, `alternates.canonical: pieceUrl(slug)`, `openGraph.url: pieceUrl(slug)`. Root `page.tsx`: the same for the latest piece. `all/page.tsx`: canonical `${OFFPRINTS_SITE}/all`.
- `robots.txt/route.ts`: `GET` returns `User-Agent: *\nAllow: /\n\nSitemap: https://offprints.neelayranjan.dev/sitemap.xml\n`, `content-type: text/plain`. `sitemap.xml/route.ts`: `<urlset>` with `OFFPRINTS_SITE`, `/all`, and every `visiblePieces(PIECES, process.env.VERCEL_ENV)` URL.
- `OffprintsAnalytics` (client): `<Analytics beforeSend={(e) => { const u = new URL(e.url); if (!u.pathname.startsWith("/offprints")) u.pathname = "/offprints" + (u.pathname === "/" ? "" : u.pathname); return { ...e, url: u.toString() }; }} />` plus `<SpeedInsights />` and `<ReloadBeacon />`, rendered in the Offprints layout. The N mark is a `TrackedLink` labelled "Portfolio".
- Icons: `scripts/offprints-icon.svg` is a 64×64 paper square (`#efebe3`) with a 1px `#1d1b17` outline and the top-left corner folded (the triangle (0,0)-(22,0)-(0,22) shows `#e6e1d7`; the flap triangle (22,0)-(22,22)-(0,22) in `#d8d2c5` with a `#1d1b17` 1px edge); `gen-offprints-icons.mjs` rasterizes it with Playwright Firefox (canvas `toDataURL`, as `icon-192.png` was made) at 192 and 180, writes 16 and 32 PNGs into an ICO container (PNG-in-ICO: a 6-byte header, two 16-byte directory entries, the PNG payloads). `gen-offprints-og.mjs` renders a 1200×630 HTML card (paper grain, the dog-ear at 120px, "Offprints" in STIX at 96px, the index line) to `public/offprints/og.png`.

- [ ] **Step 1: Write the failing check** `offprints-search`: on `OFFPRINTS_BASE`: `/` has exactly one canonical equal to `https://offprints.neelayranjan.dev/hybrid-attention`; `/all` canonical `.../all`; `/hybrid-attention` `<title>` is "Hybrid attention · Offprints"; the icon links are exactly the three `/offprints/icons/...` paths with no query string and each serves 200 with its claimed type, the PNG 192px wide (`pngSize`); `/favicon.ico` on the Offprints host serves 200 `image/x-icon` (Review Focus 1); `/robots.txt` names the Offprints sitemap; `/sitemap.xml` lists exactly `OFFPRINTS_SITE`, `/all`, `/hybrid-attention`, `/test-sheet` (local build, drafts visible); `og:image` resolves 200. Then on `BASE`: the existing `search-basics` still passes. Then, with the tracker queue: load `/hybrid-attention`, read `window.vaq` after a pageview and assert its recorded URL path begins `/offprints/`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, generate the icons and the OG card (hand-run scripts, outputs committed). **Step 4: Run** `offprints-search` and `search-basics` → PASS. Mutation: point the icons at `/icon-192.png` → FAIL on the path assertion; revert.
- [ ] **Step 5: Commit** `feat(offprints): per-host metadata, icons, robots and sitemap, prefixed analytics`.

---

### Task 9: The Atom feed

**Files:**
- Create: `lib/offprints/feed.ts`, `app/(offprints)/offprints/feed.xml/route.ts`
- Test: `scripts/test-offprints-feed.mjs`; `offprints-feed` check

**Interfaces:**
- `atomFeed(pieces: Piece[], updated: string): string` (pure; escapes `&<>"`): `<feed xmlns="http://www.w3.org/2005/Atom">` with `<title>Offprints</title>`, `<id>https://offprints.neelayranjan.dev/</id>`, `<link rel="self" href=".../feed.xml"/>`, `<link rel="alternate" href="https://offprints.neelayranjan.dev/"/>`, `<author><name>Neelay Ranjan</name></author>`, `<updated>` = the latest of all entries' `updated`; one `<entry>` per piece: `<id>` and `<link>` the `pieceUrl`, `<title>`, `<summary>` the claim, `<published>` `published + "T00:00:00Z"`, `<updated>` the revisit date if any else published.
- The route: `GET` → `atomFeed(visiblePieces(PIECES, process.env.VERCEL_ENV), now)`, `content-type: application/atom+xml; charset=utf-8`.

- [ ] **Step 1: Write the failing tests**: with a piece whose title contains `&`, the output contains `&amp;`; two pieces produce two `<entry>` in newest-first order; a revisit moves `<updated>`; `atomFeed([], ...)` is still a valid feed with zero entries; the document parses with a minimal tag-balance check (count `<entry>` equals `</entry>`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Write the check** `offprints-feed`: `fetch(OFFPRINTS_BASE + "/feed.xml")` is 200, content-type starts `application/atom+xml`, body has exactly two `<entry>` naming both slugs' URLs on the canonical host (local build). Run → PASS. Mutation: drop `visiblePieces` for `PIECES` and set `VERCEL_ENV=production` for a build → the production feed must have zero entries, and the check, run with `OFFPRINTS_EXPECT_ENTRIES=0`, passes; note the env knob in the check's header.
- [ ] **Step 6: Commit** `feat(offprints): the Atom feed`.

---

### Task 10: Piece 1 as a draft with its real Figure 1

**Files:**
- Create: `scripts/offprints/derive-hybrid-attention.mjs`, `content/offprints/hybrid-attention/figure1.json`, `components/offprints/pieces/hybrid-attention/Figure1Attention.tsx` (client)
- Modify: `components/offprints/pieces/hybrid-attention/Piece.tsx`, `content/offprints/hybrid-attention.ts`
- Test: `offprints-figure1` check

**Interfaces:**
- The derive script reads `external_materials/concepts/hybrid-attention/hybrid-data.json` (gitignored; the owner's machine) and writes `figure1.json`: `{ model: "Qwen/Qwen3.5-0.8B-Base", layer: 7, extracted: "2026-11-01", sentence: { tokens: string[], attention: number[][][] /* [head][query][key], 4 decimals */ }, defaultHead: 1 }` for the cat sentence only. It refuses to write if any row of any head does not sum to 1 ± 0.02 over the causal prefix, or if `attention[1][13][5] < 0.85` (the "it → fence" fact the caption states).
- `Figure1Attention({ data, copy })`: the token chips (mono 16px) in a wrapping row, the asking token outlined in `q`, other seen tokens tinted `color-mix(in oklab, var(--color-k) W%, var(--color-paper))` with `W = min(92, 6 + w^0.6 * 100)`, text flips to paper above 0.45; future tokens at 35% opacity; `useUndo` on the selected index with the undo button (`.op-tool`) visible only when `canUndo`; the readout sentence with the two words coloured `q` and `k`; the three `Definition` boxes with role bars (`q` fixed 70%, `k` the best weight, `v` fixed 55%); `demo_used` via a new `trackDemoOnce` overload accepting any `` `offprints/${string}` `` string, fired once on the first token click.
- `Piece.tsx` renders `<Figure n={1} caption={copy.figure1.caption} tryText={copy.figure1.tryText}><Figure1Attention .../></Figure>`.

- [ ] **Step 1: Run the derive script** and commit `figure1.json` (~14 KB). Assert in the script's output: tokens length 15, heads 8.
- [ ] **Step 2: Write the failing check** `offprints-figure1` on `OFFPRINTS_BASE + "/hybrid-attention"`: 15 token chips; the selected one is "it" (index 13) with an outline colour equal to the `q` token; the chip "fence" has the darkest background among the others and the readout reads exactly `copy.figure1.readout` filled with "it", "90", "fence" (from the SERVED json: the check fetches `/_next`-served data? No: the check imports `content/offprints/hybrid-attention/figure1.json` from disk and computes 89.6 → "90"); no undo button before a click; click "cat" → the readout names "cat" and its best key; undo appears; click undo → back to "it"; `window.vaq` holds exactly one `demo_used` with `demo: "offprints/hybrid-attention/figure-1"` after two clicks; at 390px with touch: no horizontal scroll, chips wrap, the definitions stack in one column.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** the figure, the `trackDemoOnce` overload (in `lib/track.ts`: widen the parameter type to the union plus `` `offprints/${string}` ``), the piece copy. **Step 5: Run** → PASS; `node scripts/check-voice.mjs` clean. Mutation: hard-code the readout to "fence" regardless of the click → the "cat" step FAILS; revert.
- [ ] **Step 6: Commit** `feat(offprints): hybrid attention, draft, with its real Figure 1`.

---

### Task 11: Phones, the no-JS index, and the portfolio door

**Files:**
- Modify: `content/copy.ts` (`masthead.offprintsBox: { label: "Offprints →", lead: "Recent favorite ideas, drawn." }` and a References entry `{ label: "Offprints", href: "https://offprints.neelayranjan.dev" }`), `components/manuscript/Masthead.tsx` (a `[data-offprints-box]` bordered box beneath `[data-lab-box]`, same hover rule, a `TrackedLink` labelled "Offprints"; under the label it prints the latest piece's claim from `latestPiece(PIECES, process.env.VERCEL_ENV)`, and only `lead` when that is null, so a production build with no published piece never prints a draft's claim), `components/manuscript/References.tsx` if entries are not purely data-driven
- Test: `offprints-400` and `offprints-door` checks; regenerate `public/og.png` with `node scripts/gen-og.mjs` (the masthead changed)

- [ ] **Step 1: Write the failing checks.** `offprints-400`: `hasTouch`, 390×800, `/hybrid-attention`: `document.documentElement.scrollWidth <= 390`; a finger drag on the ear from (8,8) to (200,160) sets `cut` ≈ 360 and release returns to rest; a tap opens; the index at 390px shows the Contents list with the dotted leaders not overflowing (`scrollWidth <= 390`). Then `javaScriptEnabled: false` on `/all`: the list is present with both titles, and the ear is an `<a href>` whose public form is `/all`. `offprints-door`: on `BASE + "/"`, `[data-offprints-box]` exists under the stamp with text containing "Offprints" and links to `https://offprints.neelayranjan.dev`, carries `data-track-label="Offprints"`, and (local build, drafts visible) prints the hybrid-attention claim; References contains an "Offprints" item; the `og.png` is regenerated (file mtime newer than the Masthead's commit is not testable; instead the check asserts `/og.png` is 1200×630 as before).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; run `node scripts/gen-og.mjs` against the build. **Step 4: Run** the two checks and the full portfolio subset `masthead stamp lab-box references analytics-queue search-basics` → PASS.
- [ ] **Step 5: Commit** `feat: the Offprints door on page 1; Offprints at 390px and without JS`.

---

### Task 12: Docs, the full run, the handoff

**Files:**
- Modify: `CLAUDE.md` (a new "Offprints" section under Current state and the demos: hosting, the proxy rules, the peel constants, the registry and draft rule, the verify checks and tests, the hand-run scripts, the preview rule "review at the `/offprints/...` prefix on previews"), `docs/superpowers/specs/2026-11-01-concepts-site-plan.md` (status: shell built on branch `offprints`; next: the hybrid-attention figures' own spec)

- [ ] **Step 1: Run everything**: `node --test scripts/test-*.mjs` (expect 203 + the five new files' cases, all pass); `npm run build && npm start -- -p 3000`; `node scripts/verify-redesign.mjs` (expect 56 + 6 new checks, all pass; record the sky frame median as the suite prints it).
- [ ] **Step 2: Write the docs.** In CLAUDE.md, state plainly that the subdomain is NOT yet bound in Vercel and the branch is NOT merged: the shell ships with piece 1 (spec §10.1).
- [ ] **Step 3: Commit** `docs: Offprints shell on branch offprints (CLAUDE.md, planning record)`.
- [ ] **Step 4: Hand off** with superpowers:finishing-a-development-branch: do not merge; the owner reviews on a `dev` preview at `<preview-host>/offprints/hybrid-attention`, then the piece's remaining figures get their own spec and plan before the two ship together.
