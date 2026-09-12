/**
 * Renders public/og.png: the top of the manuscript redesign at OG card size.
 *
 * Rewritten for the redesign (v1 screenshot the hero swarm; there is no swarm
 * any more). This screenshots the masthead, the reviewer's-ink stamp, and the
 * start of Table 1 — the same crop the mockup review settled on as the card's
 * "what is this" frame. A real frame of the running page, not a mockup.
 *
 * RULING: shoot under `prefers-reduced-motion`. DeskField (the one live
 * background layer now, see CLAUDE.md's Page ambience notes / components/
 * manuscript/DeskField.tsx) paints a single static frame under reduced motion
 * and never repaints after, so the shot is deterministic run to run. Without
 * it the card would depend on exactly which mid-animation frame the shutter
 * caught.
 */
import { firefox } from "playwright";

// Run against a real prod server on :3000, from the repo root:
//   npm run build && npm start -- -p 3000   # in another shell
//   node scripts/gen-og.mjs
// Hand-run only, same as gen-icons.mjs — never wire this to prebuild (see
// CLAUDE.md: both need a Playwright browser Vercel's build image lacks).
const browser = await firefox.launch();
// 1200x630 is the OG/Twitter large-card size. deviceScaleFactor is carried
// over from v1's script and kept for parity, but measure before assuming it
// does anything: Playwright's Firefox raster ignores it for page.screenshot()
// here (verified: a clipped shot and a full-viewport shot both come back
// exactly 1200x630 regardless of deviceScaleFactor, and the committed v1
// og.png is the same 1200x630) — the same family of gap as this repo's
// documented `screenshot({omitBackground})` limitation. Not a regression:
// the previous script had the identical setting and the identical result.
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
// The dev overlay is not part of the site. Hide it if present, or it ships in
// the card (kept from v1's script; harmless no-op against a prod server).
await page.addStyleTag({
  content: "nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }",
});
// DeskField's reduced-motion path paints once in its mount effect; give it
// (and web fonts) a beat to settle before the shutter.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

/**
 * At a bare 1200x630 the masthead's abstract paragraph runs long enough that
 * Table 1's rule sits ~23px below the fold (measured) — "start of Table 1"
 * would be missing entirely. Scroll down just enough to bring Table 1's rule
 * + caption row fully into frame, computed from the live DOM rather than a
 * fixed pixel guess, so a future copy edit that changes the masthead's height
 * doesn't silently push this back below the fold again. Deliberately stops at
 * the caption, never into the numeral grid: a big serif number sliced in half
 * at the card's bottom edge would read as broken, not as "more content below".
 */
const scrollNeeded = await page.evaluate(() => {
  const label = Array.from(document.querySelectorAll("b")).find(
    (el) => el.textContent?.trim() === "Table 1.",
  );
  const captionRow = label?.closest("div")?.parentElement?.firstElementChild;
  if (!captionRow) return 0;
  const overflow = captionRow.getBoundingClientRect().bottom - window.innerHeight;
  return overflow > 0 ? Math.ceil(overflow) + 4 : 0; // +4px breathing room under the caption
});
if (scrollNeeded > 0) {
  await page.evaluate((s) => window.scrollBy(0, s), scrollNeeded);
}

await page.screenshot({ path: "public/og.png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote public/og.png");
