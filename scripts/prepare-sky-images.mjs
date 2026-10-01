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
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync } from "node:fs";
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

/** "50% 30%": object-position as two percentages, nothing else. */
const FOCUS_RE = /^(100|[1-9]?\d)% (100|[1-9]?\d)%$/;

const args = process.argv.slice(2);
const repin = args.includes("--repin");
const only = new Set(args.filter((a) => !a.startsWith("--")));

const picks = JSON.parse(readFileSync(PICKS, "utf8")).picks;
const previous = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : { images: {} };
mkdirSync(OUT_DIR, { recursive: true });

const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
const firstLine = (s) => s.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
// Commons' Artist field sometimes keeps wikitext interwiki prefixes after HTML
// stripping (m87: "en:NASA, en:STScI, en:WikiSky"); drop a lowercase two-letter
// language code before a capitalised name, narrow enough to leave real credit
// text ("NASA/JPL-Caltech") and any URL untouched.
const stripInterwiki = (s) => s.replace(/(^|[,/(]\s*)[a-z]{2}:(?=[A-Z])/g, "$1");
const stripUtm = (u) => u.replace(/\?utm_source=.*$/, "");

// The imageinfo API takes at most 50 titles per request (task 19 took the
// pick list past 50), so the lookup is batched and merged.
async function commonsInfo(allTitles) {
  const unique = [...new Set(allTitles)];
  const byTitle = new Map();
  for (let i = 0; i < unique.length; i += 50) await commonsBatch(unique.slice(i, i + 50), byTitle);
  // The API normalises titles (underscores to spaces); map back by normalised form.
  const norm = (t) => t.replace(/_/g, " ");
  return (t) => byTitle.get(norm(t)) ?? null;
}

async function commonsBatch(titles, byTitle) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
    "&iiprop=url|size|sha1|extmetadata&iiurlwidth=" + THUMB_PX +
    "&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist" +
    "&titles=" + encodeURIComponent(titles.join("|"));
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
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
      author: stripInterwiki(firstLine(stripHtml(m.Artist?.value ?? "")).replace(/\s+/g, " ")).slice(0, 160),
    });
  }
}

function encode(inputPath, outPath, crop) {
  // crop: "x,y,w,h" as fractions of the source; then scale so the long side
  // is at most OUT_PX. min(iw,OUT_PX)/min(ih,OUT_PX) (fix round: never
  // upscale) means a source already narrower than 640 on its long side
  // keeps its own resolution rather than being blown up past its real detail.
  const filters = [];
  if (crop) {
    const [x, y, w, h] = crop.split(",").map(Number);
    filters.push(`crop=iw*${w}:ih*${h}:iw*${x}:ih*${y}`);
  }
  filters.push(`scale='if(gt(iw,ih),min(iw\\,${OUT_PX}),-2)':'if(gt(iw,ih),-2,min(ih\\,${OUT_PX}))'`);
  // -f webp: outPath is a .webp.stage staging name (fix round #6) so ffmpeg
  // can't infer the muxer from its extension; say it explicitly.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", inputPath, "-map_metadata", "-1", "-vf", filters.join(","), "-c:v", "libwebp", "-quality", "80", "-f", "webp", outPath], { stdio: "inherit" });
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", outPath]).toString().trim();
  const [width, height] = probe.split(",").map(Number);
  return { width, height };
}

const selected = only.size ? picks.filter((p) => only.has(p.id)) : picks;
const lookup = await commonsInfo(selected.map((p) => p.file));
const images = { ...previous.images };
const failures = [];
// Fix round #6: encode into a staging path per pick and rename into place
// only after the whole run has no failures, so a failed run leaves every
// already-committed public/sky/images/<id>.webp byte-for-byte untouched
// rather than half-overwritten by whichever picks got through before the
// failing one. Staged files are cleaned up on either exit.
const staged = [];

for (const pick of selected) {
  const info = lookup(pick.file);
  if (!info) { failures.push(`${pick.id}: ${pick.file} is missing on Commons`); continue; }
  if (!ALLOWED_LICENSES.includes(info.license)) { failures.push(`${pick.id}: license ${JSON.stringify(info.license)} is not allowed`); continue; }
  if (!info.author) { failures.push(`${pick.id}: no Artist on Commons`); continue; }
  // Task 19 (R25): `focus` is a CSS object-position for the card's
  // object-fit: cover box, two percentages, so a painting's faces survive
  // the 4:3 / 2:1 crop the CSS makes. It positions, never crops the file.
  if (pick.focus !== undefined && !FOCUS_RE.test(pick.focus)) { failures.push(`${pick.id}: focus ${JSON.stringify(pick.focus)} is not "NN% NN%"`); continue; }
  const prev = previous.images[pick.id];
  if (prev && prev.sha1 !== info.sha1 && !repin) { failures.push(`${pick.id}: upstream changed (sha1 ${prev.sha1} -> ${info.sha1}); re-run with --repin to accept`); continue; }

  const tmp = join(OUT_DIR, `.${pick.id}.src`);
  const stage = join(OUT_DIR, `.${pick.id}.webp.stage`);
  let dims;
  try {
    const res = await fetch(info.thumbUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) { failures.push(`${pick.id}: thumbnail fetch ${res.status}`); continue; }
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    dims = encode(tmp, stage, pick.crop);
  } catch (err) {
    failures.push(`${pick.id}: ${err.message}`);
    rmSync(stage, { force: true });
    continue;
  } finally {
    // An ffmpeg failure throws out of encode() before this would otherwise
    // run; the try/finally is what stops the fetched original getting
    // stranded as a stray file inside the served public/sky/images/ dir.
    rmSync(tmp, { force: true });
  }
  staged.push({ id: pick.id, stage, final: join(OUT_DIR, `${pick.id}.webp`) });

  images[pick.id] = {
    src: `/sky/images/${pick.id}.webp`,
    width: dims.width, height: dims.height,
    alt: pick.alt,
    author: info.author,
    license: info.license,
    licenseUrl: info.licenseUrl,
    sourceTitle: info.title.replace(/^File:/, ""),
    sourceUrl: stripUtm(info.descriptionUrl),
    sha1: info.sha1,
    ...(pick.crop ? { cropped: true } : {}),
    ...(pick.note ? { note: pick.note } : {}),
    // Task 19 (R25): a myth constellation's image is an artwork (a painting,
    // a vase, a star-atlas plate), not a photograph of the sky. `artwork`
    // names it ("Bacchus and Ariadne, Titian, 1520-1523"), typed in the pick
    // list from the Commons description page; the card prints it after the
    // credit and says the image is an artwork.
    // `artworkSource` in a pick is the provenance of a hand-typed `artwork`
    // line wherever it departs from Commons' own fields (fix round 1: Aql's
    // date, Her's "after Lambert Lombard"). JSON carries no comments, so the
    // note lives in its own field; it is for maintainers and never published.
    ...(pick.artwork ? { artwork: pick.artwork } : {}),
    ...(pick.focus ? { focus: pick.focus } : {}),
  };
  console.log(`${pick.id.padEnd(18)} ${info.license.padEnd(14)} ${dims.width}x${dims.height}  ${info.author}`);
}

if (failures.length) {
  for (const s of staged) rmSync(s.stage, { force: true });
  console.error("\nprepare-sky-images: refusing to write index.json:\n  " + failures.join("\n  "));
  process.exit(1);
}
// Only now, with the whole run clean, does anything committed change.
for (const s of staged) {
  renameSync(s.stage, s.final);
}
// Drop entries whose pick is gone, so the index and the pick list never drift.
const pickIds = new Set(picks.map((p) => p.id));
for (const id of Object.keys(images)) if (!pickIds.has(id)) { delete images[id]; rmSync(join(OUT_DIR, `${id}.webp`), { force: true }); }

writeFileSync(INDEX, JSON.stringify({ version: 1, generated: new Date().toISOString().slice(0, 10), images }, null, 2) + "\n");
console.log(`\nprepare-sky-images: wrote ${Object.keys(images).length} entries to public/sky/images/index.json`);
