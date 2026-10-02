// node --test scripts/test-sky-images.mjs
// Shape and license checks on the COMMITTED public/sky/images/index.json
// and the WebP files beside it (spec 2026-09-16 §7). The generator asserts
// the same before writing; this guards the committed files against hand
// edits and bad regenerations.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { register } from "node:module";

// lib/sky-images.ts carries "no runtime imports except ./sky-objects", and
// that import (like sky-layers.ts's of sky-math) is a real relative
// specifier with no extension, which node's ESM resolver refuses to
// resolve on its own (unlike TypeScript's "bundler" moduleResolution).
// Same resolve-hook workaround as test-sky-objects.mjs: retry a failed
// relative specifier with ".ts" appended, scoped to this process only.
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
/**
 * Task 19 (ruling R25): the constellations whose card (content/sky-facts.ts)
 * tells or names a myth get an ARTWORK of that myth (or the constellation's
 * plate from a star atlas when no artwork fits the card's version). Decided
 * by reading each card, listed with reasons in the task-19 report. Since
 * task 20 (ruling R27) every other constellation gets its figure from a
 * historical star atlas instead (Urania's Mirror, Bode, Hevelius, Bayer or
 * Lacaille), so all 88 have an image.
 */
const MYTH_CONSTELLATIONS = [
  "And", "Aql", "Aqr", "Ara", "Ari", "Aur", "Boo", "Cap", "Cas", "Cen",
  "Cep", "Cet", "CMa", "Cnc", "CrB", "Crt", "Crv", "Cyg", "Del", "Dra",
  "Gem", "Her", "Hya", "Leo", "Lep", "Lyr", "Oph", "Ori", "Pav", "Peg",
  "Per", "Phe", "Psc", "PsA", "Sco", "Tau", "Vir",
];

/**
 * Fix round #5: the WebP container's own VP8/VP8L/VP8X chunk carries the
 * pixel dimensions the codec actually wrote, independent of whatever
 * width/height the index claims. Parsing it (rather than trusting ffprobe,
 * which the generator already uses to WRITE the index) is what lets this
 * test catch a hand-edited or stale index.json entry. RIFF layout: bytes
 * 0-3 "RIFF", 8-11 "WEBP", then one chunk starting at byte 12: a 4-byte
 * fourCC, a 4-byte LE size, then the chunk's own data.
 */
function webpDimensions(bytes) {
  const fourCC = bytes.subarray(12, 16).toString("latin1");
  const data = bytes.subarray(20);
  if (fourCC === "VP8 ") {
    // Lossy: a 3-byte frame tag, a 3-byte start code (9d 01 2a), then
    // 14-bit width and 14-bit height, each LE, the top 2 bits a scale factor.
    const w = data.readUInt16LE(6) & 0x3fff;
    const h = data.readUInt16LE(8) & 0x3fff;
    return { width: w, height: h };
  }
  if (fourCC === "VP8L") {
    // Lossless: a 1-byte signature (0x2f), then a 4-byte LE bitfield: 14-bit
    // width-1, 14-bit height-1, then an alpha bit and a 3-bit version.
    const bits = data.readUInt32LE(1);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourCC === "VP8X") {
    // Extended container (used when metadata chunks are present): 1 flags
    // byte, 3 reserved, then 24-bit LE canvas width-1 and height-1.
    const w = data.readUIntLE(4, 3) + 1;
    const h = data.readUIntLE(7, 3) + 1;
    return { width: w, height: h };
  }
  throw new Error(`unrecognised WebP chunk ${JSON.stringify(fourCC)}`);
}

const index = JSON.parse(await readFile(INDEX, "utf8"));
const picks = JSON.parse(await readFile(PICKS, "utf8")).picks;
const objects = JSON.parse(await readFile(new URL("public/sky/objects.json", ROOT), "utf8")).objects;
const constellationIds = Object.keys(JSON.parse(await readFile(new URL("public/sky/sky.json", ROOT), "utf8")).constellations);

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
    const dims = webpDimensions(bytes);
    assert.deepEqual(dims, { width: im.width, height: im.height }, `${id}: index says ${im.width}x${im.height}, the file says ${dims.width}x${dims.height}`);
    assert.ok(ALLOWED_LICENSES.includes(im.license), `${id}: license ${JSON.stringify(im.license)}`);
    assert.ok(im.author.trim().length > 0 && !im.author.includes("<"), `${id}: author`);
    assert.match(im.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, id);
    assert.ok(im.sourceTitle.length > 0 && !im.sourceTitle.startsWith("File:"), id);
    assert.match(im.sha1, /^[0-9a-f]{40}$/, id);
    assert.ok(im.alt.length > 20, `${id}: alt`);
    if (im.focus !== undefined) assert.match(im.focus, /^(100|[1-9]?\d)% (100|[1-9]?\d)%$/, `${id}: focus`);
    for (const s of [im.alt, im.author, im.note ?? "", im.artwork ?? ""]) {
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

test("every constellation has exactly one image: an artwork of its myth, else an atlas plate (tasks 19-20)", () => {
  const ids = new Set(Object.keys(index.images));
  assert.equal(constellationIds.length, 88);
  for (const id of MYTH_CONSTELLATIONS) assert.ok(constellationIds.includes(id), `${id} is not a constellation id`);
  // Keys are an object's own, so "exactly one" is "present"; the picks test
  // above already rejects a duplicate pick id.
  for (const id of constellationIds) {
    assert.ok(ids.has(id), `${id} has no image`);
    const im = index.images[id];
    assert.ok(typeof im.artwork === "string" && im.artwork.length > 10, `${id}: artwork names the work`);
    // Task 20 (R27): a constellation whose card tells no myth gets its figure
    // from a historical star atlas, and its artwork line says which.
    if (!MYTH_CONSTELLATIONS.includes(id)) {
      assert.match(im.artwork, /star card from Urania's Mirror|star atlas|star chart/, `${id}: a non-myth image must be an atlas plate, got ${JSON.stringify(im.artwork)}`);
    }
  }
  // An artwork is only ever a constellation's: a photograph never carries
  // the "not a photograph of the sky" line, and vice versa.
  for (const [id, im] of Object.entries(index.images)) {
    if (im.artwork !== undefined) assert.ok(constellationIds.includes(id), `${id}: artwork on a non-constellation entry`);
  }
});

test("the allow-list equals the generator's", async () => {
  const src = await readFile(GENERATOR, "utf8");
  const m = src.match(/const ALLOWED_LICENSES = (\[[\s\S]*?\]);/);
  assert.ok(m, "generator has no ALLOWED_LICENSES literal");
  assert.deepEqual(JSON.parse(m[1].replace(/,\s*\]/, "]").replace(/\n/g, "")), ALLOWED_LICENSES);
});

const { validateImagesIndex } = await import("../lib/sky-images.ts");

test("the runtime validator accepts the committed index and rejects the malformed", () => {
  assert.equal(validateImagesIndex(index), null);
  assert.match(validateImagesIndex({ version: 2, images: {} }) ?? "", /version/);
  assert.match(validateImagesIndex({ version: 1, generated: "2026-09-16", images: null }) ?? "", /images/);
  assert.match(validateImagesIndex({ version: 1, generated: "2026-09-16", images: { m31: { src: "x" } } }) ?? "", /m31/);
});
