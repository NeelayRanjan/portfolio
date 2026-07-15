/**
 * Rasterize the favicon from `app/icon.svg`.
 *
 * `app/icon.svg` is the source of truth. Everything here is derived from it, so
 * a tweak to the mark means re-running this rather than hand-editing four files
 * that then drift apart.
 *
 *   node scripts/gen-icons.mjs
 *
 * Writes (all under app/, which is how Next serves icons — see the file
 * conventions in node_modules/next/dist/docs/.../app-icons.md):
 *   app/icon.png        32x32   raster fallback
 *   app/apple-icon.png  180x180 iOS home screen
 *   app/favicon.ico     16 + 32 the /favicon.ico every browser asks for
 *
 * Playwright does the rasterizing. It is already a devDependency (the spec keeps
 * runtime deps minimal), and a real browser renders the gradient and the corner
 * radius exactly as the browser showing the tab will.
 *
 * DO NOT wire this to prebuild the way sync-ort.mjs is. That one only copies
 * files; this one needs a Playwright browser binary, which Vercel's build image
 * does not have — it would take the whole deploy down to regenerate four files
 * that only change when the mark does. The outputs are committed artifacts, same
 * as public/og.png. Run it by hand and commit the result.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { firefox } = require("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "app", "icon.svg");
const svg = readFileSync(SRC, "utf8");

/**
 * ICO container. Each member is just a PNG embedded whole — the format has
 * allowed that since Vista, and every browser that matters reads it. The older
 * alternative is a BMP with an upside-down bitmap and a padded AND mask, which
 * is a lot of code to support browsers this site's visitors do not use.
 */
const encodeIco = (members) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(members.length, 4);

  const dir = Buffer.alloc(16 * members.length);
  let offset = 6 + dir.length;
  members.forEach((m, i) => {
    const e = 16 * i;
    // 0 means 256 in this field; we never go that big, but encode it honestly.
    dir.writeUInt8(m.size >= 256 ? 0 : m.size, e + 0);
    dir.writeUInt8(m.size >= 256 ? 0 : m.size, e + 1);
    dir.writeUInt8(0, e + 2); // palette size (0 = truecolour)
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // colour planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(m.buf.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += m.buf.length;
  });

  return Buffer.concat([header, dir, ...members.map((m) => m.buf)]);
};

const browser = await firefox.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><body>");

/**
 * @param size      edge length in px
 * @param fullBleed drop the corner radius and let the tile reach the edges
 *
 * Rasterizes through a canvas rather than page.screenshot({omitBackground}),
 * because Playwright's Firefox does not implement omitBackground — it throws
 * "Not implemented" — and without it the corners outside the radius composite
 * against white. Chromium supports it, but it is not installed here and this is
 * not worth a ~170MB download. Canvas keeps real browser rendering of the
 * gradient and the radius, and toDataURL preserves the alpha.
 */
const raster = async (size, { fullBleed = false } = {}) => {
  let markup = svg;
  if (fullBleed) {
    // iOS masks the home-screen icon with its own squircle. Handing it our
    // rounded tile would round it twice: the transparent corners composite to
    // black inside a mask already cutting a slightly larger curve. Give iOS a
    // square tile and let it do the rounding it is going to do anyway.
    const squared = markup.replace('rx="13"', 'rx="0"');
    if (squared === markup) throw new Error("full-bleed: rx=13 not found in app/icon.svg");
    markup = squared;
  }
  // Make the SVG's intrinsic size the target size so the browser rasterizes AT
  // that resolution. Left at 64 it would render 64px and scale down, which is
  // visibly softer at 16.
  const sized = markup.replace('width="64" height="64"', `width="${size}" height="${size}"`);
  if (sized === markup) throw new Error('sizing: width="64" height="64" not found in app/icon.svg');

  const dataUrl = await page.evaluate(async ({ markup, size }) => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/png");
  }, { markup: sized, size });

  return Buffer.from(dataUrl.split(",")[1], "base64");
};

const png32 = await raster(32);
writeFileSync(join(ROOT, "app", "icon.png"), png32);

const apple = await raster(180, { fullBleed: true });
writeFileSync(join(ROOT, "app", "apple-icon.png"), apple);

const png16 = await raster(16);
const ico = encodeIco([
  { size: 16, buf: png16 },
  { size: 32, buf: png32 },
]);
writeFileSync(join(ROOT, "app", "favicon.ico"), ico);

await browser.close();

console.log(`app/icon.png        ${png32.length} bytes (32x32)`);
console.log(`app/apple-icon.png  ${apple.length} bytes (180x180, full-bleed)`);
console.log(`app/favicon.ico     ${ico.length} bytes (16x16 + 32x32)`);
