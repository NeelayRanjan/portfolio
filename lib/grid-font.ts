import { Geist_Mono } from "next/font/google";

/**
 * A dedicated mono for the character grids only (`AsciiLines`' `pre`-style rows) —
 * NOT the site's `--font-mono` (Spline Sans Mono).
 *
 * Task 2 measured Spline Sans Mono's advance at 0.559em (`scripts/measure-mono.mjs`),
 * not v1 Geist Mono's 0.600em. `AsciiLines`' `lineHeight: 0.68` is exactly
 * 0.6 (the glyph advance) plus its 0.08em `letterSpacing` — an identity derived
 * for Geist Mono specifically, and the reason a 28-wide ascii row reads square.
 * Swapping in the page's serif-era mono without re-deriving that number would
 * stretch every digit in the trajectory viewer, silently. So the grids keep
 * Geist Mono, scoped to exactly the elements that need its measured metrics,
 * imported from this one tiny module rather than wired into `--font-mono`
 * site-wide (see the comment at the top of components/AsciiGrid.tsx).
 */
export const gridMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-grid-mono",
});
