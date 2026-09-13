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
 * The card is the TOP of the page, no scroll. An earlier version scrolled
 * until Table 1's caption was in frame; that stopped fitting once the
 * headshot rail made the masthead ~840px tall (2026-09-13 regeneration: the
 * scroll pushed the name off the top of the card). The name, the tagline, the
 * abstract and the photo are what an unfurl needs, so the card frames them
 * and the assertion below fails the run rather than write a card without the
 * name in it.
 */
const nameTop = await page.evaluate(() => document.querySelector("h1")?.getBoundingClientRect().top);
if (nameTop === undefined || nameTop < 0 || nameTop > 630) {
  await browser.close();
  throw new Error(`the masthead h1 is not inside the 630px card (top ${nameTop}); nothing written`);
}

await page.screenshot({ path: "public/og.png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote public/og.png");
