/**
 * Renders Offprints' icons from scripts/offprints-icon.svg: icon-192.png,
 * apple-icon.png (180) and favicon.ico (16 + 32 as PNG-in-ICO) into
 * public/offprints/icons/, plus public/offprints/favicon.ico, a byte copy for
 * the browser's automatic /favicon.ico request (the Offprints host rewrites
 * it to /offprints/favicon.ico). Rasterised through a Playwright Firefox
 * canvas, since that build lacks screenshot({omitBackground}) and this
 * machine has no cairosvg (the way public/icon-192.png was made).
 * Hand-run, never wired to prebuild: node scripts/gen-offprints-icons.mjs
 */
import { firefox } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const svg = readFileSync(new URL("./offprints-icon.svg", import.meta.url), "utf8");
const out = new URL("../public/offprints/", import.meta.url);
mkdirSync(new URL("icons/", out), { recursive: true });

const browser = await firefox.launch();
const page = await browser.newPage();
const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
async function png(size) {
  const b64 = await page.evaluate(
    async ([src, n]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = n;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, n, n);
      return c.toDataURL("image/png").split(",")[1];
    },
    [dataUrl, size],
  );
  return Buffer.from(b64, "base64");
}
const p192 = await png(192);
const p180 = await png(180);
const p16 = await png(16);
const p32 = await png(32);
await browser.close();

const images = [
  [16, p16],
  [32, p32],
];
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const dir = images.map(([n, buf]) => {
  const e = Buffer.alloc(16);
  e[0] = n;
  e[1] = n;
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
const ico = Buffer.concat([head, ...dir, ...images.map(([, b]) => b)]);

writeFileSync(new URL("icons/icon-192.png", out), p192);
writeFileSync(new URL("icons/apple-icon.png", out), p180);
writeFileSync(new URL("icons/favicon.ico", out), ico);
writeFileSync(new URL("favicon.ico", out), ico);
console.log("wrote icon-192.png, apple-icon.png, favicon.ico (x2)");
