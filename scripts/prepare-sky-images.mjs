#!/usr/bin/env node
/**
 * Derives public/sky/images/{index.json,<id>.webp} from scripts/sky-image-picks.json
 * (spec docs/superpowers/specs/2026-09-16-sky-card-images-design.md §3-4).
 *
 * HAND-RUN, never wired to prebuild: Vercel's build has no network. Outputs
 * are committed. Needs ffmpeg on PATH.
 *
 *   node scripts/prepare-sky-images.mjs            # regenerate everything, refuse changed upstreams
 *   node scripts/prepare-sky-images.mjs --repin    # accept upstream sha1 changes
 *   node scripts/prepare-sky-images.mjs m31 moon   # only these ids
 *
 * Wikimedia Commons is the index for every pick, NASA images included: its
 * imageinfo API returns author, license, sha1 and a thumbnail URL in one
 * shape, so nothing about a license is hand-typed. A pick outside
 * ALLOWED_LICENSES fails the run. The ORIGINAL's sha1 is pinned in the index
 * so a silent upstream swap can't change a photograph here; the bytes
 * actually fetched are Commons' 1280px thumbnail (the originals run to
 * 130 MB), re-encoded to 640px WebP q80, metadata stripped, like the
 * headshot photos.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PICKS = join(ROOT, "scripts", "sky-image-picks.json");
const OUT_DIR = join(ROOT, "public", "sky", "images");
const INDEX = join(OUT_DIR, "index.json");
const UA = "neelayranjan.dev prepare-sky-images (https://neelayranjan.dev; neelay.ranjan@outlook.com)";
const THUMB_PX = 1280;
const OUT_PX = 640;

/** Must equal scripts/test-sky-images.mjs's ALLOWED_LICENSES, byte for byte (the test asserts it). */
const ALLOWED_LICENSES = [
  "Public domain", "CC0",
  "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
  "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
];

const args = process.argv.slice(2);
const repin = args.includes("--repin");
const only = new Set(args.filter((a) => !a.startsWith("--")));

const picks = JSON.parse(readFileSync(PICKS, "utf8")).picks;
const previous = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : { images: {} };
mkdirSync(OUT_DIR, { recursive: true });

const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
const firstLine = (s) => s.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
const stripUtm = (u) => u.replace(/\?utm_source=.*$/, "");

async function commonsInfo(titles) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
    "&iiprop=url|size|sha1|extmetadata&iiurlwidth=" + THUMB_PX +
    "&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist" +
    "&titles=" + encodeURIComponent(titles.join("|"));
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
  const byTitle = new Map();
  for (const page of Object.values(data.query.pages)) {
    if (page.missing !== undefined) { byTitle.set(page.title, null); continue; }
    const ii = page.imageinfo[0];
    const m = ii.extmetadata ?? {};
    byTitle.set(page.title, {
      title: page.title,
      descriptionUrl: ii.descriptionurl,
      thumbUrl: ii.thumburl ?? ii.url,
      sha1: ii.sha1,
      license: stripHtml(m.LicenseShortName?.value ?? "").trim(),
      licenseUrl: stripHtml(m.LicenseUrl?.value ?? "").trim(),
      author: firstLine(stripHtml(m.Artist?.value ?? "")).replace(/\s+/g, " ").slice(0, 160),
    });
  }
  // The API normalises titles (underscores to spaces); map back by normalised form.
  const norm = (t) => t.replace(/_/g, " ");
  return (t) => byTitle.get(norm(t)) ?? null;
}

function encode(inputPath, outPath, crop) {
  // crop: "x,y,w,h" as fractions of the source; then scale so the long side is OUT_PX.
  const filters = [];
  if (crop) {
    const [x, y, w, h] = crop.split(",").map(Number);
    filters.push(`crop=iw*${w}:ih*${h}:iw*${x}:ih*${y}`);
  }
  filters.push(`scale='if(gt(iw,ih),${OUT_PX},-2)':'if(gt(iw,ih),-2,${OUT_PX})'`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", inputPath, "-map_metadata", "-1", "-vf", filters.join(","), "-c:v", "libwebp", "-quality", "80", outPath], { stdio: "inherit" });
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", outPath]).toString().trim();
  const [width, height] = probe.split(",").map(Number);
  return { width, height };
}

const selected = only.size ? picks.filter((p) => only.has(p.id)) : picks;
const lookup = await commonsInfo(selected.map((p) => p.file));
const images = { ...previous.images };
const failures = [];

for (const pick of selected) {
  const info = lookup(pick.file);
  if (!info) { failures.push(`${pick.id}: ${pick.file} is missing on Commons`); continue; }
  if (!ALLOWED_LICENSES.includes(info.license)) { failures.push(`${pick.id}: license ${JSON.stringify(info.license)} is not allowed`); continue; }
  if (!info.author) { failures.push(`${pick.id}: no Artist on Commons`); continue; }
  const prev = previous.images[pick.id];
  if (prev && prev.sha1 !== info.sha1 && !repin) { failures.push(`${pick.id}: upstream changed (sha1 ${prev.sha1} -> ${info.sha1}); re-run with --repin to accept`); continue; }

  const tmp = join(OUT_DIR, `.${pick.id}.src`);
  const res = await fetch(info.thumbUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) { failures.push(`${pick.id}: thumbnail fetch ${res.status}`); continue; }
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  const out = join(OUT_DIR, `${pick.id}.webp`);
  const { width, height } = encode(tmp, out, pick.crop);
  rmSync(tmp);

  images[pick.id] = {
    src: `/sky/images/${pick.id}.webp`,
    width, height,
    alt: pick.alt,
    author: info.author,
    license: info.license,
    licenseUrl: info.licenseUrl,
    sourceTitle: info.title.replace(/^File:/, ""),
    sourceUrl: stripUtm(info.descriptionUrl),
    sha1: info.sha1,
    ...(pick.note ? { note: pick.note } : {}),
  };
  console.log(`${pick.id.padEnd(18)} ${info.license.padEnd(14)} ${width}x${height}  ${info.author}`);
}

if (failures.length) {
  console.error("\nprepare-sky-images: refusing to write index.json:\n  " + failures.join("\n  "));
  process.exit(1);
}
// Drop entries whose pick is gone, so the index and the pick list never drift.
const pickIds = new Set(picks.map((p) => p.id));
for (const id of Object.keys(images)) if (!pickIds.has(id)) { delete images[id]; rmSync(join(OUT_DIR, `${id}.webp`), { force: true }); }

writeFileSync(INDEX, JSON.stringify({ version: 1, generated: new Date().toISOString().slice(0, 10), images }, null, 2) + "\n");
console.log(`\nprepare-sky-images: wrote ${Object.keys(images).length} entries to public/sky/images/index.json`);
