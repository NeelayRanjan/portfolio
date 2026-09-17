# Sky Card Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real, licensed photograph sits flush above every galaxy, nebula, cluster, remnant, planet, Moon, ISS, Milky Way, Sgr A* and Hubble Deep Field card in stargaze mode, self-hosted, with its author and license on the card.

**Architecture:** A hand-kept pick list names one Wikimedia Commons file per subject; a hand-run generator asks the Commons API for license, author and a pinned SHA-1, refuses anything outside the allow-list, downloads a 1280px thumbnail, re-encodes it to a 640px WebP with ffmpeg, and writes `public/sky/images/index.json`. At runtime `lib/sky-images.ts` loads that index on the same per-layer gate as `objects.json`; `card-controller.ts` attaches the entry to the `CardModel`; `SkyCard.tsx` renders it as the card's first child at a CSS-fixed aspect so the card's cached height stays right.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, plain node scripts (`node --test`), ffmpeg, Playwright-Firefox (the verify suite), the Wikimedia Commons `imageinfo` API.

**Spec:** `docs/superpowers/specs/2026-09-16-sky-card-images-design.md`

## Global Constraints

- Every visitor-facing string lives in `content/copy.ts` and passes `node scripts/check-voice.mjs` (no em dashes, no banned words, first person where prose). Alt text and credit lines are data, not copy, but the node test applies the em-dash rule to them.
- No hotlinking: the site sends `Cross-Origin-Embedder-Policy: require-corp`; every image is served from `public/sky/images/`.
- Allowed licenses, exactly as Commons' `LicenseShortName` spells them: `Public domain`, `CC0`, `CC BY 2.0`, `CC BY 2.5`, `CC BY 3.0`, `CC BY 4.0`, `CC BY-SA 2.0`, `CC BY-SA 2.5`, `CC BY-SA 3.0`, `CC BY-SA 4.0`. The generator and the node test each carry the list and the test asserts they are equal.
- `lib/sky-render.ts` is never touched. `lib/sky-images.ts` has no runtime imports except `./sky-objects`'s `gate` (so node can load it through the test's resolve hook).
- The generator is hand-run, never wired to prebuild (Vercel's build has no network). Its outputs are committed.
- Image box size comes from CSS `aspect-ratio`, never the bitmap (spec §5): desktop 320px wide at 4:3 (240px); phone full width at 2:1 capped at 28dvh. On a phone the docked card must still be at most 60% of the viewport tall (the existing `stargaze-touch-400` assertion), so the scrolling body's cap drops to 32dvh when an image is present.
- Every verify check goes through `stargazeToggle(page)`, never a bare role query (the footer door shares the name).
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Pick list, generator, node test, committed images

**Files:**
- Create: `scripts/sky-image-picks.json`
- Create: `scripts/prepare-sky-images.mjs`
- Create: `scripts/test-sky-images.mjs`
- Create (generated, committed): `public/sky/images/index.json`, `public/sky/images/<id>.webp` (35 files)
- Modify: `package.json` (nothing; the generator is hand-run), `README.md` hand-run generators table (one row)

**Interfaces:**
- Produces: `public/sky/images/index.json` with shape
  ```ts
  type SkyImagesIndex = {
    version: 1;
    generated: string; // "2026-09-16", the run date (ISO date), used as the citation's access date
    images: Record<string, SkyImage>;
  };
  type SkyImage = {
    src: string;        // "/sky/images/m31.webp"
    width: number;      // of the served WebP
    height: number;
    alt: string;
    author: string;     // Commons Artist, HTML stripped, first line, whitespace collapsed
    license: string;    // LicenseShortName, from the allow-list
    licenseUrl: string; // Commons LicenseUrl, may be "" for Public domain
    sourceTitle: string;// the Commons file title without "File:" and with spaces
    sourceUrl: string;  // Commons descriptionurl (the file page)
    sha1: string;       // the ORIGINAL file's sha1 as Commons reports it
    note?: string;      // per-image caption fragment (the Moon's phase, an instrument)
  };
  ```

- [ ] **Step 1: Write the pick list**

`scripts/sky-image-picks.json`. `file` is the Commons title. `alt` describes the photograph, not the object. These are Wikipedia's own lead images for each subject's article as of 2026-09-16, checked by the Commons API to carry an allowed license; the two Veil halves have no article image and use NOIRLab's WIYN frames.

```json
{
  "picks": [
    { "id": "m1", "file": "File:Crab Nebula.jpg", "alt": "The Crab Nebula: a tangled orange and blue cloud of filaments around a bright core, in a Hubble mosaic." },
    { "id": "m8", "file": "File:VST images the Lagoon Nebula.jpg", "alt": "The Lagoon Nebula: a wide pink and red cloud of glowing gas crossed by dark lanes, from the VLT Survey Telescope.", "crop": "0.2,0.1,0.6,0.8" },
    { "id": "m13", "file": "File:M13-Globular-Cluster.png", "alt": "The Hercules globular cluster: a dense round swarm of hundreds of thousands of stars, brightest at the centre." },
    { "id": "m31", "file": "File:Andromeda Galaxy 2025.png", "alt": "The Andromeda Galaxy: a tilted spiral with a yellow core, blue outer arms and dark dust lanes, with two small companion galaxies." },
    { "id": "m42", "file": "File:Orion Nebula - Hubble 2006 mosaic 18000.jpg", "alt": "The Orion Nebula: a bright teal and red cloud of gas around the Trapezium stars, in a Hubble mosaic." },
    { "id": "m44", "file": "File:M44-Star-Cluster.png", "alt": "The Beehive Cluster: a loose scatter of bright white and yellow stars against a dark field." },
    { "id": "m45", "file": "File:Pleiades large.jpg", "alt": "The Pleiades: seven bright blue stars wrapped in wispy blue reflection nebulosity." },
    { "id": "m51", "file": "File:Messier51 sRGB.jpg", "alt": "The Whirlpool Galaxy: a face-on spiral with pink star-forming knots along its arms, joined to a small yellow companion galaxy, from Hubble." },
    { "id": "m57", "file": "File:Webb captures detailed beauty of Ring Nebula (NIRCam image) (weic2320a).jpg", "alt": "The Ring Nebula seen by Webb's NIRCam: a glowing ring of gas with a faint star at its centre.", "note": "Webb's near-infrared view, not a visible-light photograph." },
    { "id": "m87", "file": "File:Messier 87 Hubble WikiSky.jpg", "alt": "M87: a smooth, round elliptical galaxy with a straight jet of plasma pointing out from its core, from Hubble." },
    { "id": "sgr-a-star", "file": "File:EHT Saggitarius A black hole.tif", "alt": "Sagittarius A*: the Event Horizon Telescope's orange ring of light around the dark shadow of the black hole.", "note": "A radio image from the Event Horizon Telescope, not a photograph in visible light." },
    { "id": "hubble-deep-field", "file": "File:HubbleDeepField.800px.jpg", "alt": "The Hubble Deep Field: hundreds of faint galaxies of every shape and colour scattered across a tiny patch of dark sky." },
    { "id": "m16", "file": "File:Eagle Nebula from ESO.jpg", "alt": "The Eagle Nebula: dark pillars of dust rising into a red glowing cloud, from ESO's La Silla observatory." },
    { "id": "m20", "file": "File:Trifid Nebula (noirlab2521ah).jpg", "alt": "The Trifid Nebula: a pink emission cloud split by three dark lanes, beside a blue reflection nebula, from the Rubin Observatory." },
    { "id": "m27", "file": "File:Messier 27 (1).jpg", "alt": "The Dumbbell Nebula: a blue-green oval shell of gas with red edges, photographed by an amateur astronomer." },
    { "id": "m33", "file": "File:VST snaps a very detailed view of the Triangulum Galaxy.jpg", "alt": "The Triangulum Galaxy: a loose face-on spiral with a bright white core and red star-forming regions, from the VLT Survey Telescope.", "crop": "0.1,0.15,0.8,0.7" },
    { "id": "m78", "file": "File:Messier 78.jpg", "alt": "M78: two bright blue reflection nebulae lit by young stars, with dark dust clouds around them, from ESO." },
    { "id": "m81", "file": "File:Messier 81 HST.jpg", "alt": "Bode's Galaxy: a grand-design spiral with a yellow core and blue arms, from Hubble." },
    { "id": "m82", "file": "File:M82 HST ACS 2006-14-a-large web.jpg", "alt": "The Cigar Galaxy: an edge-on disk with red filaments of gas blown out above and below it, from Hubble." },
    { "id": "m104", "file": "File:Sombrero Galaxy (heic2506a).jpg", "alt": "The Sombrero Galaxy: a bright bulge with a dark dust ring seen almost edge-on, from Hubble." },
    { "id": "horsehead", "file": "File:Nebulosa testa di cavallo con SPECULOOS.jpg", "alt": "The Horsehead Nebula: a dark horse-head-shaped cloud silhouetted against a red glowing background, from ESO's SPECULOOS telescopes." },
    { "id": "flame", "file": "File:Flame-Nebula.jpg", "alt": "The Flame Nebula: an orange glowing cloud cut by a dark lane of dust, beside a bright star." },
    { "id": "ngc869", "file": "File:H and χ Persei.jpg", "alt": "The Double Cluster: two dense groups of bright blue-white stars side by side." },
    { "id": "ngc884", "file": "File:Double Cluster.jpg", "alt": "The Double Cluster: two neighbouring clusters of blue-white stars in one wide field." },
    { "id": "ngc7000", "file": "File:NGC 7000 + IC 5070.jpg", "alt": "The North America Nebula: a red emission cloud shaped like the continent, with the Pelican Nebula beside it." },
    { "id": "ngc6960", "file": "File:The Veil Nebula, NGC 6960 (noao-veil-wiyn-0-9-m).jpg", "alt": "The western Veil Nebula: thin red and blue filaments of a supernova remnant, from the WIYN 0.9-metre telescope." },
    { "id": "ngc6992", "file": "File:NGC 6992 (Cygnus Loop) (noao-ngc6992).jpg", "alt": "The eastern Veil Nebula: bright braided filaments of red and blue-green gas, from the WIYN 0.9-metre telescope." },
    { "id": "milky-way", "file": "File:ESO-VLT-Laser-phot-33a-07.jpg", "alt": "The Milky Way's band arching over ESO's Very Large Telescope, with a laser guide star pointed at the galactic centre." },
    { "id": "mercury", "file": "File:Mercury in true color.jpg", "alt": "Mercury: a grey, heavily cratered planet in true colour from MESSENGER." },
    { "id": "venus", "file": "File:Venus from Mariner 10.jpg", "alt": "Venus: a pale yellow-white globe of unbroken cloud, from Mariner 10." },
    { "id": "mars", "file": "File:Mars - August 30 2021 - Flickr - Kevin M. Gill.png", "alt": "Mars: a rust-red planet with a white polar cap and dark surface markings." },
    { "id": "jupiter", "file": "File:Jupiter OPAL 2024.png", "alt": "Jupiter: banded cream and brown clouds with the Great Red Spot, from Hubble's 2024 OPAL programme." },
    { "id": "saturn", "file": "File:Saturn global view from Cassini, rings open Better Color.jpg", "alt": "Saturn: the pale gold planet with its rings wide open, from Cassini." },
    { "id": "moon", "file": "File:FullMoon2010.jpg", "alt": "The full Moon: grey maria and bright highlands with rays from Tycho crater.", "note": "Shown full; the chart draws the phase for your moment." },
    { "id": "iss", "file": "File:The station pictured from the SpaceX Crew Dragon 5.jpg", "alt": "The International Space Station against black space, its solar arrays spread wide, photographed from a departing Crew Dragon." }
  ]
}
```

- [ ] **Step 2: Write the failing node test**

`scripts/test-sky-images.mjs`:

```js
// node --test scripts/test-sky-images.mjs
// Shape and license checks on the COMMITTED public/sky/images/index.json
// and the WebP files beside it (spec 2026-09-16 §7). The generator asserts
// the same before writing; this guards the committed files against hand
// edits and bad regenerations.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const INDEX = new URL("public/sky/images/index.json", ROOT);
const PICKS = new URL("scripts/sky-image-picks.json", ROOT);
const GENERATOR = new URL("scripts/prepare-sky-images.mjs", ROOT);

/** Must equal the generator's ALLOWED_LICENSES, byte for byte (asserted below). */
const ALLOWED_LICENSES = [
  "Public domain", "CC0",
  "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
  "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
];

/** Spec §2: who gets an image. Derived from objects.json's symbols plus the fixed ids. */
const WITH_IMAGE_SYMBOLS = new Set(["galaxy", "nebula", "cluster", "core", "square"]);
const FIXED_WITH_IMAGE = ["milky-way", "mercury", "venus", "mars", "jupiter", "saturn", "moon", "iss"];
const NEVER_WITH_IMAGE_SYMBOLS = new Set(["star", "chevron", "field"]);

const index = JSON.parse(await readFile(INDEX, "utf8"));
const picks = JSON.parse(await readFile(PICKS, "utf8")).picks;
const objects = JSON.parse(await readFile(new URL("public/sky/objects.json", ROOT), "utf8")).objects;

test("index shape", () => {
  assert.equal(index.version, 1);
  assert.match(index.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof index.images, "object");
});

test("every pick has an entry and every entry a pick", () => {
  const pickIds = picks.map((p) => p.id).sort();
  assert.deepEqual(Object.keys(index.images).sort(), pickIds);
  assert.equal(new Set(pickIds).size, pickIds.length, "duplicate pick id");
});

test("every entry is complete, licensed, served, and sized as the file says", async () => {
  for (const [id, im] of Object.entries(index.images)) {
    assert.equal(im.src, `/sky/images/${id}.webp`, id);
    const file = new URL(`public${im.src}`, ROOT);
    const st = await stat(file);
    assert.ok(st.size > 2000 && st.size < 200_000, `${id}: ${st.size} bytes`);
    const bytes = await readFile(file);
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "RIFF", `${id}: not a WebP`);
    assert.equal(bytes.subarray(8, 12).toString("latin1"), "WEBP", `${id}: not a WebP`);
    assert.ok(Number.isInteger(im.width) && Number.isInteger(im.height) && im.width > 0 && im.height > 0, id);
    assert.ok(Math.max(im.width, im.height) <= 640, `${id}: ${im.width}x${im.height}`);
    assert.ok(ALLOWED_LICENSES.includes(im.license), `${id}: license ${JSON.stringify(im.license)}`);
    assert.ok(im.author.trim().length > 0 && !im.author.includes("<"), `${id}: author`);
    assert.match(im.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, id);
    assert.ok(im.sourceTitle.length > 0 && !im.sourceTitle.startsWith("File:"), id);
    assert.match(im.sha1, /^[0-9a-f]{40}$/, id);
    assert.ok(im.alt.length > 20, `${id}: alt`);
    for (const s of [im.alt, im.author, im.note ?? ""]) {
      assert.ok(!s.includes("—"), `${id}: em dash in ${JSON.stringify(s)}`);
    }
  }
});

test("no file under public/sky/images without an entry", async () => {
  const files = (await readdir(new URL("public/sky/images/", ROOT))).filter((f) => f.endsWith(".webp"));
  assert.deepEqual(files.sort(), Object.keys(index.images).map((id) => `${id}.webp`).sort());
});

test("spec §2 coverage: the right subjects have images and the rest don't", () => {
  const ids = new Set(Object.keys(index.images));
  for (const o of objects) {
    if (WITH_IMAGE_SYMBOLS.has(o.symbol)) assert.ok(ids.has(o.id), `${o.id} (${o.symbol}) should have an image`);
    if (NEVER_WITH_IMAGE_SYMBOLS.has(o.symbol)) assert.ok(!ids.has(o.id), `${o.id} (${o.symbol}) must not have an image`);
  }
  for (const id of FIXED_WITH_IMAGE) assert.ok(ids.has(id), `${id} should have an image`);
});

test("the allow-list equals the generator's", async () => {
  const src = await readFile(GENERATOR, "utf8");
  const m = src.match(/const ALLOWED_LICENSES = (\[[\s\S]*?\]);/);
  assert.ok(m, "generator has no ALLOWED_LICENSES literal");
  assert.deepEqual(JSON.parse(m[1].replace(/,\s*\]/, "]").replace(/\n/g, "")), ALLOWED_LICENSES);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test scripts/test-sky-images.mjs`
Expected: fails at the top-level `readFile(INDEX)` with ENOENT (no index yet).

- [ ] **Step 4: Write the generator**

`scripts/prepare-sky-images.mjs`. Hand-run. Needs network and ffmpeg.

```js
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
```

- [ ] **Step 5: Run the generator, then the test**

Run: `node scripts/prepare-sky-images.mjs`
Expected: 35 lines, one per pick, each with an allowed license, then the "wrote 35 entries" line. If a pick fails (missing, wrong license, no artist), fix the pick list (search Commons for the subject and choose another allowed file), never the allow-list.

Run: `node --test scripts/test-sky-images.mjs`
Expected: 6 tests pass. Check `du -sh public/sky/images`: expect 1 to 2 MB total.

- [ ] **Step 6: Eyeball every image**

Open `public/sky/images/` in an image viewer (or `python3 -m http.server` and a browser). Each subject must be recognisable at 640px and the crop must not cut the subject (m8 and m33 carry crops; adjust the fractions if the framing is off and re-run for that id). This is the one human gate in the round; record which crops changed in the commit message.

- [ ] **Step 7: README row and commit**

Add to README's hand-run generators table:

```
| `prepare-sky-images.mjs` | derives `public/sky/images/` (one licensed WebP per deep-sky object, planet, the Moon, the ISS, the Milky Way, plus `index.json` with author, license and a pinned sha1) from `scripts/sky-image-picks.json`, via the Wikimedia Commons API; refuses any license outside its allow-list; `--repin` accepts an upstream file change | network, ffmpeg |
```

```bash
git add scripts/sky-image-picks.json scripts/prepare-sky-images.mjs scripts/test-sky-images.mjs public/sky/images README.md
git commit -m "sky: 35 licensed photographs for the cards, generated from Commons with pinned sources

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Runtime loader and the card model

**Files:**
- Modify: `lib/sky-objects.ts` (export `gate`)
- Create: `lib/sky-images.ts`
- Modify: `components/manuscript/night-sky/state.ts` (`images`, `layers.images`)
- Modify: `components/manuscript/night-sky/layer-loaders.ts` (load the index)
- Modify: `components/manuscript/night-sky/card-controller.ts` (`buildCard` attaches `image`)
- Modify: `components/manuscript/SkyCard.tsx` (`CardModel.image` type only, in this task)
- Modify: `components/manuscript/night-sky/painter.ts` (`window.__sky.layers` already exposes `layers`; nothing to add if it spreads the object, verify)
- Test: `scripts/test-sky-images.mjs` (one more test: the loader's validator)

**Interfaces:**
- Consumes: `public/sky/images/index.json` (Task 1's `SkyImagesIndex`).
- Produces:
  ```ts
  // lib/sky-images.ts
  export type SkyImage = { src: string; width: number; height: number; alt: string; author: string; license: string; licenseUrl: string; sourceTitle: string; sourceUrl: string; sha1: string; note?: string };
  export type SkyImagesIndex = { version: 1; generated: string; images: Record<string, SkyImage> };
  export const IMAGES_URL = "/sky/images/index.json";
  export function validateImagesIndex(d: unknown): string | null; // null = ok, else the reason
  export const loadImages: () => Promise<SkyImagesIndex | null>;
  ```
  `SkyState.images: SkyImagesIndex | null`, `SkyLayers.images: LayerState`.
  `CardModel.image?: SkyImage & { accessed: string }` (the index's `generated` date rides along for the citation).

- [ ] **Step 1: Write the failing validator test**

Append to `scripts/test-sky-images.mjs` (the file already registers nothing; add the resolve hook the other tests use so `lib/sky-images.ts` can import `./sky-objects`):

```js
import { register } from "node:module";
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (err) {
    if (specifier.startsWith(".") && !/\\.[a-zA-Z0-9]+$/.test(specifier)) return nextResolve(specifier + ".ts", context);
    throw err;
  }
}`)}`,
  import.meta.url,
);
const { validateImagesIndex } = await import("../lib/sky-images.ts");

test("the runtime validator accepts the committed index and rejects the malformed", () => {
  assert.equal(validateImagesIndex(index), null);
  assert.match(validateImagesIndex({ version: 2, images: {} }) ?? "", /version/);
  assert.match(validateImagesIndex({ version: 1, generated: "2026-09-16", images: null }) ?? "", /images/);
  assert.match(validateImagesIndex({ version: 1, generated: "2026-09-16", images: { m31: { src: "x" } } }) ?? "", /m31/);
});
```

Run: `node --test scripts/test-sky-images.mjs`
Expected: fails, `lib/sky-images.ts` not found.

- [ ] **Step 2: Export `gate` and write the loader**

In `lib/sky-objects.ts` change `function gate<T>(` to `export function gate<T>(` (nothing else).

`lib/sky-images.ts`:

```ts
/**
 * The card photographs' index (spec 2026-09-16 §4): one licensed WebP per
 * deep-sky object, planet, the Moon, the ISS and the Milky Way, generated by
 * scripts/prepare-sky-images.mjs. Same gate as objects.json: a 404 resolves
 * null and cards simply carry no photograph; a malformed index throws, which
 * NightSky logs at the component boundary. The photographs themselves load
 * only when a card opens (SkyCard's <img loading="lazy">), never here.
 */
import { gate } from "./sky-objects";

export type SkyImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceTitle: string;
  sourceUrl: string;
  sha1: string;
  note?: string;
};

export type SkyImagesIndex = { version: 1; generated: string; images: Record<string, SkyImage> };

export const IMAGES_URL = "/sky/images/index.json";

const REQUIRED: (keyof SkyImage)[] = ["src", "width", "height", "alt", "author", "license", "licenseUrl", "sourceTitle", "sourceUrl", "sha1"];

export function validateImagesIndex(d: unknown): string | null {
  const x = d as Partial<SkyImagesIndex> | null;
  if (x?.version !== 1) return `version ${String(x?.version)}`;
  if (typeof x.generated !== "string") return "no generated date";
  if (!x.images || typeof x.images !== "object") return "no images map";
  for (const [id, im] of Object.entries(x.images)) {
    for (const k of REQUIRED) {
      if (im == null || (im as Record<string, unknown>)[k] === undefined) return `${id}: missing ${k}`;
    }
    if (!(im as SkyImage).src.startsWith("/sky/images/")) return `${id}: src off-site`;
  }
  return null;
}

export const loadImages = gate<SkyImagesIndex>(IMAGES_URL, validateImagesIndex);
```

Run: `node --test scripts/test-sky-images.mjs`
Expected: all 7 tests pass. If `gate`'s `validate` signature differs from `(body) => string | null`, match it exactly; read `lib/sky-objects.ts:107-130` first.

- [ ] **Step 3: State, layer loader, card model**

`state.ts`: add `images: SkyImagesIndex | null;` beside `facts`, initialise `images: null`; extend `SkyLayers` with `images: LayerState` and initialise `images: "loading"`. Import the type from `@/lib/sky-images`.

`layer-loaders.ts`, after the `loadMilkyWay()` block:

```ts
  loadImages()
    .then((d) => {
      if (!s.alive) return;
      s.images = d;
      layers.images = d ? "ready" : "absent";
      // No repaint: photographs are DOM on the card, not canvas.
    })
    .catch((err) => {
      layers.images = "error";
      console.error("NightSky: sky/images/index.json is malformed; cards open without photographs.", err);
    });
```

`SkyCard.tsx`: extend `CardModel` with

```ts
  /** The card's photograph (spec 2026-09-16): the index entry plus the
   *  index's generation date, which is the citation's access date. Absent
   *  for stars, constellations, showers, the Voyagers and the Kepler field. */
  image?: SkyImage & { accessed: string };
```

with `import type { SkyImage } from "@/lib/sky-images";`.

`card-controller.ts`: add a helper inside the factory, above `buildCard`:

```ts
  const imageFor = (id: string): CardModel["image"] | undefined => {
    const im = s.images?.images[id];
    return im ? { ...im, accessed: s.images!.generated } : undefined;
  };
```

and attach `image: imageFor(h.id)` to the object, planet, Moon, ISS and Milky Way returns (not the constellation or shower returns). For the object return it goes beside `colourEmissionLines`; for the one-line returns spread it in: `{ id: h.id, title: planet, fact, extra: { type: "none" }, image: imageFor(h.id) }`.

Check `painter.ts`'s `window.__sky.layers` assignment: if it copies `s.layers` wholesale (`layers: { ...s.layers }` or `s.layers`), `images` is exposed already; if it lists fields, add `images`.

- [ ] **Step 4: Typecheck and a quick browser sanity**

Run: `npx tsc --noEmit -p .`
Expected: clean.

Run: `npm run build && npm start` (in another shell), then in a Playwright one-off or the browser: open `/`, enter stargaze, click Andromeda, and in the console `window.__sky.card` (if the painter exposes the card model) or React devtools shows `image.src === "/sky/images/m31.webp"`. Nothing renders yet; this only proves the model carries it.

- [ ] **Step 5: Commit**

```bash
git add lib/sky-objects.ts lib/sky-images.ts components/manuscript/night-sky/state.ts components/manuscript/night-sky/layer-loaders.ts components/manuscript/night-sky/card-controller.ts components/manuscript/SkyCard.tsx scripts/test-sky-images.mjs
git commit -m "sky: load the photograph index on its own layer gate; cards carry their image

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The photograph on the card

**Files:**
- Modify: `components/manuscript/SkyCard.tsx`
- Modify: `content/copy.ts` (`stargaze.card.imageCredit`, `stargaze.card.imageSource`)
- Modify: `components/manuscript/night-sky/card-controller.ts` only if `updateCardSize` needs the image's `load` event (it should not: the box is CSS-sized)

**Interfaces:**
- Consumes: `CardModel.image` from Task 2.
- Produces: DOM hooks the verify check selects on: `[data-sky-card-image]` (the `<figure>` wrapper), `[data-sky-card-image] img`, `[data-sky-card-image-credit]`; the Sources list gains one `<li>` whose link is `image.sourceUrl`.

- [ ] **Step 1: Copy**

In `content/copy.ts` under `stargaze.card`, after `sources`:

```ts
      /** Under the photograph: "Photograph: NASA, ESA · Public domain". The
       *  author and license are data from the Commons API (index.json), never
       *  typed here. */
      imageCredit: "Photograph: ",
      /** The photograph's own citation, in the same APA shape as the facts':
       *  author (year n.d.), "<file title> [Photograph]", Wikimedia Commons. */
      imageSourceSuffix: " [Photograph]",
      imageSite: "Wikimedia Commons",
```

Run: `node scripts/check-voice.mjs`
Expected: passed.

- [ ] **Step 2: Render**

In `SkyCard.tsx`, replace the `<aside ...>` body's opening so the image is the aside's FIRST child, outside the scrolling `div`:

```tsx
    <aside ... same classes ...>
      {model.image && !imageFailed ? (
        <figure
          data-sky-card-image
          className="m-0 w-full overflow-hidden border-b border-rule aspect-[2/1] max-h-[28dvh] min-[880px]:aspect-[4/3] min-[880px]:max-h-none"
        >
          <img
            src={model.image.src}
            alt={model.image.alt}
            width={model.image.width}
            height={model.image.height}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        </figure>
      ) : null}
      <div
        ref={scrollRef}
        className={[
          "overflow-y-auto px-4 py-4 font-mono text-[12px] leading-relaxed text-mut min-[880px]:text-[11px]",
          model.image && !imageFailed
            ? "max-h-[32dvh] min-[880px]:max-h-[calc(100vh-32px-240px)]"
            : "max-h-[60dvh] min-[880px]:max-h-[calc(100vh-32px)]",
        ].join(" ")}
      >
```

State: `const [imageFailed, setImageFailed] = useState(false);` reset on subject change: `useEffect(() => { setImageFailed(false); }, [model.id]);`.

Under the kind line (after `<p data-sky-card-kind>`), the credit:

```tsx
        {model.image && !imageFailed ? (
          <p data-sky-card-image-credit className="mt-1 text-mut/80">
            {t.imageCredit}
            {model.image.author} · {model.image.license}
            {model.image.note ? ` ${model.image.note}` : ""}
          </p>
        ) : null}
```

In `cardCitations(model)` (find it above the component), append when `model.image` is set:

```ts
  if (model.image) {
    out.push({
      author: model.image.author,
      year: "n.d.",
      title: `${model.image.sourceTitle}${copy.stargaze.card.imageSourceSuffix}`,
      site: copy.stargaze.card.imageSite,
      url: model.image.sourceUrl,
      accessed: model.image.accessed,
    });
  }
```

Keep the phone rule: no text under 12px below 880px (the credit inherits the body's 12px).

- [ ] **Step 3: Typecheck, build, look**

Run: `npx tsc --noEmit -p . && npm run build && npm start`
Open `/` at 1440px, enter stargaze, click Andromeda: the photograph fills the card's top at 320x240, the card body starts under it with a hairline rule, the credit reads "Photograph: Brody Wesner · CC0", Sources ends with the Commons link. Click Polaris: no image, card as before. Resize to 400px (touch emulation in devtools), tap Andromeda: the docked card shows the photograph at 2:1 no taller than 28% of the viewport, the whole card no taller than 60%. Take screenshots of both into `.superpowers/sdd/sky-card-images/` for the review.

- [ ] **Step 4: Commit**

```bash
git add components/manuscript/SkyCard.tsx content/copy.ts
git commit -m "stargaze: the photograph sits flush above the card, credited and cited

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Verify check, proved to bite

**Files:**
- Modify: `scripts/verify-redesign.mjs` (new check `stargaze-card-image`, registered after `stargaze-card`)

**Interfaces:**
- Consumes: `pinnedSkyPage`, `findInstant`, `M31`, `stargazeToggle`, `waitStargazeReady` (all existing in the suite), the hooks from Task 3, `window.__sky.layers.images`.

- [ ] **Step 1: Write the check**

Insert after `checkStargazeCard`:

```js
/* ---------------------------------------------------------------------- */
/* Stargaze card photographs (spec 2026-09-16-sky-card-images): a licensed */
/* image flush above the card, CSS-sized before it loads, credited and     */
/* cited; none on a star; nothing at all with the index held.              */
/* ---------------------------------------------------------------------- */

const POLARIS = { raDeg: 37.9546, decDeg: 89.2641 };

async function checkStargazeCardImage(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  const notes = [];

  await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready" && window.__sky.layers.images === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });

    await page.mouse.click(p.x, p.y);
    const card = page.locator('[data-sky-card="m31"]');
    await card.waitFor({ state: "attached", timeout: 3000 });
    const fig = card.locator("[data-sky-card-image]");
    if ((await fig.count()) !== 1) throw new Error("Andromeda's card has no [data-sky-card-image]");
    const before = await fig.boundingBox();
    if (!before || Math.abs(before.height - 240) > 1 || Math.abs(before.width - 320) > 1) {
      throw new Error(`image box is ${before?.width}x${before?.height}, expected 320x240 from CSS before load`);
    }
    // The box must be the aside's first child, its bottom on the body's top.
    const order = await card.evaluate((el) => {
      const first = el.firstElementChild;
      const body = first?.nextElementSibling;
      const a = first?.getBoundingClientRect();
      const b = body?.getBoundingClientRect();
      return { firstIsFigure: first?.hasAttribute("data-sky-card-image") ?? false, gap: a && b ? b.top - a.bottom : null, width: a && b ? a.width - b.width : null };
    });
    if (!order.firstIsFigure) throw new Error("the photograph is not the card's first child");
    if (order.gap === null || Math.abs(order.gap) > 1) throw new Error(`gap between photograph and body is ${order.gap}px`);
    if (order.width === null || Math.abs(order.width) > 1) throw new Error(`photograph and body widths differ by ${order.width}px`);

    await page.waitForFunction(() => {
      const img = document.querySelector('[data-sky-card="m31"] [data-sky-card-image] img');
      return img && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 10000 });
    const after = await fig.boundingBox();
    if (Math.abs(after.height - before.height) > 1) throw new Error(`image box changed height on load: ${before.height} -> ${after.height}`);
    const info = await card.evaluate((el) => ({
      src: el.querySelector("[data-sky-card-image] img")?.getAttribute("src"),
      alt: el.querySelector("[data-sky-card-image] img")?.getAttribute("alt") ?? "",
      credit: el.querySelector("[data-sky-card-image-credit]")?.textContent ?? "",
      sourceLinks: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => a.getAttribute("href")),
      bottom: el.getBoundingClientRect().bottom,
    }));
    if (info.src !== "/sky/images/m31.webp") throw new Error(`src is ${info.src}`);
    if (info.alt.length < 20) throw new Error(`alt is ${JSON.stringify(info.alt)}`);
    if (!info.credit.startsWith(copy.stargaze.card.imageCredit)) throw new Error(`credit is ${JSON.stringify(info.credit)}`);
    if (!info.sourceLinks.some((h) => h && h.startsWith("https://commons.wikimedia.org/wiki/File:"))) {
      throw new Error(`no Commons citation among ${JSON.stringify(info.sourceLinks)}`);
    }
    if (info.bottom > H - 8) throw new Error(`card bottom at ${info.bottom} runs past the viewport (${H})`);
    notes.push(`m31: 320x240 box before and after load, credit ${JSON.stringify(info.credit)}`);

    // A star: no photograph, no credit, no Commons link.
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });
    const pol = findInstant(date, W, H, POLARIS, 40);
    await page.mouse.click(pol.p.x, pol.p.y);
    const starCard = page.locator("[data-sky-card]");
    await starCard.waitFor({ state: "attached", timeout: 3000 });
    const star = await starCard.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      figures: el.querySelectorAll("[data-sky-card-image]").length,
      credit: el.querySelectorAll("[data-sky-card-image-credit]").length,
      commons: [...el.querySelectorAll("[data-sky-card-sources] a")].filter((a) => (a.getAttribute("href") ?? "").includes("commons.wikimedia.org")).length,
    }));
    if (star.figures || star.credit || star.commons) throw new Error(`${star.id}'s card carries image markup: ${JSON.stringify(star)}`);
    notes.push(`${star.id}: no image markup`);
  });

  // The index held: no image, no error, the card otherwise complete.
  await withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    await context.route("**/sky/images/index.json", (route) => route.fulfill({ status: 404, body: "" }));
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.images === "absent" && window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.click(p.x, p.y);
    const card = page.locator('[data-sky-card="m31"]');
    await card.waitFor({ state: "attached", timeout: 3000 });
    const held = await card.evaluate((el) => ({
      figures: el.querySelectorAll("[data-sky-card-image]").length,
      oneLiner: el.querySelector("[data-sky-card-oneliner]")?.textContent ?? "",
      sources: el.querySelectorAll("[data-sky-card-sources] a").length,
    }));
    if (held.figures) throw new Error("index held but the card shows a photograph");
    if (!held.oneLiner || held.sources < 1) throw new Error(`index held and the card is incomplete: ${JSON.stringify(held)}`);
    const imgErrors = errors.filter((e) => /images|index\.json/.test(e));
    if (imgErrors.length) throw new Error(`console errors with the index held: ${imgErrors.join(" | ")}`);
    notes.push("index 404: card complete, no photograph, no console error");
  });

  // 400px, touch: the docked card, photograph at most 28% tall, card at most 60%.
  const P = { W: 400, H: 800 };
  const phone = findInstant(new Date(Date.UTC(2026, 9, 1)), P.W, P.H, M31, 40);
  await pinnedSkyPage(browser, { W: P.W, H: P.H, date: phone.date, contextOptions: { hasTouch: true } }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready" && window.__sky.layers.images === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.touchscreen.tap(phone.p.x, phone.p.y);
    const card = page.locator('[data-sky-card="m31"]');
    await card.waitFor({ state: "attached", timeout: 3000 });
    const sizes = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const f = el.querySelector("[data-sky-card-image]")?.getBoundingClientRect();
      const small = [...el.querySelectorAll("*")].filter((n) => n.textContent?.trim() && parseFloat(getComputedStyle(n).fontSize) < 12).length;
      return { card: r.height, img: f?.height ?? 0, imgW: f?.width ?? 0, cardW: r.width, small };
    });
    if (!sizes.img) throw new Error("no photograph on the docked card");
    if (sizes.img > 0.28 * P.H + 1) throw new Error(`phone photograph ${sizes.img}px tall, over 28% of ${P.H}`);
    if (sizes.card > 0.6 * P.H + 2) throw new Error(`phone card ${sizes.card}px tall, over 60% of ${P.H}`);
    if (Math.abs(sizes.imgW - sizes.cardW) > 1) throw new Error(`phone photograph width ${sizes.imgW} vs card ${sizes.cardW}`);
    if (sizes.small) throw new Error(`${sizes.small} element(s) under 12px on the phone card`);
    notes.push(`400px: photograph ${Math.round(sizes.img)}px of card ${Math.round(sizes.card)}px`);
  });

  return notes.join("; ");
}
```

Register: `["stargaze-card-image", checkStargazeCardImage],` right after `["stargaze-card", checkStargazeCard],`.

`POLARIS`'s coordinates: read them from `public/sky/sky.json` (the star with `name: "Polaris"`) rather than trusting the literal above; if `findInstant` needs a `raDeg/decDeg` object, that is what it gets. If `findInstant` cannot place Polaris (it is always on screen near the pole, so it can), click the pole position from `window.__sky.cx/cy` instead.

- [ ] **Step 2: Run it against the build**

Run: `npm run build && npm start` then `node scripts/verify-redesign.mjs stargaze-card-image stargaze-card stargaze-touch-400 stargaze-keyboard-list`
Expected: all PASS. The old `stargaze-card` and `stargaze-touch-400` must still pass with the photograph present (the 60% cap is why the body cap shrinks to 32dvh).

- [ ] **Step 3: Prove it bites, twice**

(a) Delete the `m31` entry from `public/sky/images/index.json` (keep the file), rebuild, run the check. Expected: FAIL with "Andromeda's card has no [data-sky-card-image]". Restore with `git checkout public/sky/images/index.json`.

(b) In `SkyCard.tsx` change the figure's `min-[880px]:aspect-[4/3]` to `min-[880px]:aspect-[16/9]`, rebuild, run. Expected: FAIL with "image box is 320x180, expected 320x240". Restore.

Record both failure lines in the commit message.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-redesign.mjs
git commit -m "verify: the card photograph, its box, credit and citation; none on a star; index held

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Docs, the full suites, the branch

**Files:**
- Modify: `CLAUDE.md` (Current state paragraph; "Night sky + stargaze" gains a "Card photographs" bullet; the verify summary count; the model artifacts table gains `public/sky/images/*`; the node test list gains `test-sky-images`)
- Modify: `README.md` (already has the generator row from Task 1; add the node test to any test-list line)
- Modify: `docs/superpowers/specs/2026-09-16-sky-card-images-design.md` §4: the index loads with the other layers after first paint (it is ~10 KB); only the photographs are lazy. Record it as a plan-time refinement.

- [ ] **Step 1: CLAUDE.md**

Add to Current state, after the parked-directions paragraph's predecessor (the WebKit-fix paragraph):

```
**2026-09-16 (night): card photographs, branch `sky-card-images`.** Every
galaxy, nebula, cluster, remnant, the Hubble Deep Field, Sgr A*, the Milky
Way, the five planets, the Moon and the ISS card opens with a real photograph
flush above it, the card's full width (owner's layout call). 35 images,
each Wikipedia's own lead image for the subject (the two Veil halves from
NOIRLab), sourced through the Wikimedia Commons API so author, license and
the original's sha1 are machine-read, never typed: `scripts/sky-image-picks.json`
names the file, `scripts/prepare-sky-images.mjs` (hand-run) refuses any
license outside its allow-list and writes `public/sky/images/index.json` plus
640px WebPs (~1.5 MB total, fetched only when a card opens). Self-hosted
because COEP forbids hotlinking anyway. The card prints the credit and adds
a Commons citation; the box is CSS-sized (320x240 desktop, 2:1 capped at
28dvh on phones, body cap 32dvh so the docked card stays under 60%) so the
cached card height never goes stale. Stars, constellations, showers, the
Voyagers and the Kepler field get none, on purpose.
```

Under "Night sky + stargaze", a bullet:

```
- **Card photographs** (2026-09-16, spec `docs/superpowers/specs/2026-09-16-sky-card-images-design.md`):
  `lib/sky-images.ts` loads `index.json` on the same per-layer gate as
  objects.json (`layers.images`: absent → no photographs, malformed → logged);
  `card-controller.ts`'s `imageFor(id)` attaches the entry; `SkyCard.tsx`
  renders it as the aside's FIRST child, outside the scroll body, `onError`
  clearing it rather than showing a broken image. Allowed licenses are
  public domain, CC0, CC BY and CC BY-SA (2.0 through 4.0), asserted equal in
  the generator and `scripts/test-sky-images.mjs`; the Moon's note says it is
  shown full, Sgr A*'s that it is a radio image, M57's that it is Webb's
  infrared. ⚠️ A new object needs a pick, or the coverage test fails; a
  changed upstream file fails the generator until `--repin`.
```

Update: the verify count (43 checks) and the node test command to include `scripts/test-sky-images.mjs` with its case count; the artifacts table row `public/sky/images/*` (~1.5 MB, 35 WebPs + index).

- [ ] **Step 2: Full suites**

Run: `node --test scripts/test-sky-data.mjs scripts/test-sky-math.mjs scripts/test-sky-pan.mjs scripts/test-sky-objects.mjs scripts/test-sky-facts.mjs scripts/test-sky-iss.mjs scripts/test-sky-images.mjs`
Expected: all pass (73 + 7).

Run: `npm run build && npm start` then `node scripts/verify-redesign.mjs`
Expected: 43 passed, 0 failed. Record the `sky-animates-1280` frame median in the commit message (photographs are DOM, so it must be flat against 2.54ms).

- [ ] **Step 3: Commit and push the branch**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-09-16-sky-card-images-design.md
git commit -m "docs: card photographs recorded; 43 checks, 80 node cases

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin sky-card-images
```

The owner reviews the Vercel preview (branch alias `portfolio-git-sky-card-images-neelayranjans-projects.vercel.app`, behind Vercel login) on desktop and phone before the fast-forward to `main`.
