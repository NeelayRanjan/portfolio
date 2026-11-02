/**
 * Renders public/offprints/og.png: Offprints' 1200x630 share card. A plain
 * card, not a screenshot of the page: paper with the site's grain, the
 * dog-ear drawn at 120px in the top-left, "Offprints" in STIX Two Text at
 * 96px and the index line in italic beneath. Needs the network for the font.
 * Hand-run, never wired to prebuild: node scripts/gen-offprints-og.mjs
 */
import { firefox } from "playwright";
import { mkdirSync } from "node:fs";
import { shell } from "../content/offprints/shell.ts";

const grain = (r, g, b) =>
  `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256"%3E%3Cfilter id="g" x="0" y="0" color-interpolation-filters="sRGB"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3CfeColorMatrix values="0.1 0 0 0 ${r} 0.1 0 0 0 ${g} 0.1 0 0 0 ${b} 0 0 0 0 1"/%3E%3C/filter%3E%3Crect width="256" height="256" filter="url(%23g)"/%3E%3C/svg%3E')`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;1,400&display=swap">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{position:relative;background:#efebe3 ${grain(0.887, 0.872, 0.84)};background-size:256px 256px;
    font-family:'STIX Two Text',serif;color:#1d1b17}
  .ear{position:absolute;top:0;left:0;width:120px;height:120px}
  .name{position:absolute;left:96px;top:232px;font-size:96px;line-height:1;letter-spacing:-0.01em}
  .line{position:absolute;left:100px;top:360px;font-size:34px;font-style:italic;line-height:1.3;width:900px}
</style></head><body>
<svg class="ear" viewBox="0 0 120 120"><path d="M0 0H120L0 120Z" fill="#e6e1d7"/>
<path d="M120 0V120H0Z" fill="#d8d2c5" stroke="#1d1b17" stroke-width="1.5"/></svg>
<div class="name">${shell.meta.siteName}</div>
<div class="line">${shell.index.line}</div>
</body></html>`;

mkdirSync(new URL("../public/offprints/", import.meta.url), { recursive: true });
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("../public/offprints/og.png", import.meta.url).pathname });
await browser.close();
console.log("wrote public/offprints/og.png");
