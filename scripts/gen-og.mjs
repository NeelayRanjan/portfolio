/**
 * Renders public/og.png: a real frame of the live hero at OG card size.
 * Not a mockup — the actual swarm, settled, at 1200x630.
 */
import { chromium, firefox } from "playwright";

// Run against a dev or prod server on :3000, from the repo root:
//   npm run dev   # in another shell
//   node scripts/gen-og.mjs
const browser = await firefox.launch();
// 1200x630 is the OG/Twitter large-card size. deviceScaleFactor 2 => a crisp
// 2400x1260 that scales down cleanly in every unfurl.
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
// The dev overlay is not part of the site. Hide it, or it ships in the card.
await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }" });
// Let the swarm anneal so the name is resolved, not mid-collapse.
await page.waitForTimeout(7000);
await page.screenshot({ path: "public/og.png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote public/og.png");
