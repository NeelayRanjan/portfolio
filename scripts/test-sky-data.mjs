// node --test scripts/test-sky-data.mjs
// Shape and landmark checks on the COMMITTED public/sky/sky.json. The
// generator (prepare-sky.mjs) asserts the same things before writing; this
// test guards the committed file against hand edits and bad regenerations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const PATH = new URL("../public/sky/sky.json", import.meta.url);

const sky = JSON.parse(await readFile(PATH, "utf8"));

test("header", () => {
  assert.equal(sky.version, 1);
  assert.equal(sky.epoch, "J2000");
  assert.equal(sky.source.commit, "7e720a3de062059d4c5400a379146a601d9010e0");
  assert.match(sky.source.license, /BSD/);
});

test("stars: count, order, ranges", () => {
  assert.ok(sky.stars.length >= 1500 && sky.stars.length <= 1750, `count ${sky.stars.length}`);
  for (let i = 0; i < sky.stars.length; i++) {
    const [ra, dec, mag, bv] = sky.stars[i];
    assert.ok(ra >= 0 && ra < 360, `ra ${ra}`);
    assert.ok(dec >= -90 && dec <= 90, `dec ${dec}`);
    assert.ok(mag <= 5.0, `mag ${mag}`);
    assert.ok(Number.isFinite(bv), `bv ${bv}`);
    if (i > 0) assert.ok(sky.stars[i - 1][2] <= mag, "not sorted brightest first");
  }
});

test("landmarks: Polaris and Sirius", () => {
  const polaris = sky.stars.find(([, dec]) => dec > 89);
  assert.ok(polaris && Math.abs(polaris[1] - 89.26) < 0.1 && Math.abs(polaris[2] - 2.0) < 0.1);
  const sirius = sky.stars.find(([ra, dec]) => Math.abs(ra - 101.29) < 0.1 && Math.abs(dec + 16.72) < 0.1);
  assert.ok(sirius && sirius[2] < -1.3, "Sirius missing or too faint");
  assert.equal(sky.stars[0], sirius, "Sirius should be the brightest star");
});

test("constellations: 88, merged Serpens, bilingual names", () => {
  const abbrs = Object.keys(sky.constellations);
  assert.equal(abbrs.length, 88);
  for (const a of abbrs) {
    const c = sky.constellations[a];
    assert.ok(c.latin.length > 0, a);
    assert.ok(c.labels.length >= 1, a);
    assert.ok(Array.isArray(sky.lines[a]) && sky.lines[a].length > 0, `${a} has no lines`);
    assert.ok(c.english === null || c.english !== c.latin, `${a} duplicates its Latin`);
  }
  assert.deepEqual(Object.keys(sky.lines).sort(), abbrs.sort());
  assert.equal(sky.constellations.UMa.latin, "Ursa Major");
  assert.equal(sky.constellations.UMa.english, "Great Bear");
  assert.equal(sky.constellations.Ori.english, null);
  assert.equal(sky.constellations.Ser.latin, "Serpens");
  assert.equal(sky.constellations.Ser.labels.length, 2);
});

test("size", async () => {
  const { size } = await stat(PATH);
  assert.ok(size < 70_000, `sky.json is ${size} bytes`);
});
