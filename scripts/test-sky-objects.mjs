// node --test scripts/test-sky-objects.mjs
// Shape and landmark checks on the COMMITTED public/sky/objects.json and
// public/sky/milkyway.json. prepare-sky-objects.mjs asserts the same things
// before writing; this guards the committed files against hand edits and
// bad regenerations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { register } from "node:module";

// sky-facts.ts and sky-objects.ts (imported below) carry "NO RUNTIME
// IMPORTS" so node can load them straight, extensionless specifiers and
// all. lib/sky-layers.ts (task 3, colour seam) is a real drawing module
// with a genuine runtime import of ./sky-math, and node's ESM resolver
// (unlike TypeScript's "bundler" moduleResolution) refuses to resolve a
// relative specifier with no extension. Rather than adding a .ts extension
// to a production import (or a new npm-level flag), this registers a
// resolve hook, scoped to this test file's process only, that retries a
// failed relative specifier with ".ts" appended.
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\\.[a-zA-Z0-9]+$/.test(specifier)) {
      return nextResolve(specifier + ".ts", context);
    }
    throw err;
  }
}
`)}`,
  import.meta.url,
);

const OBJECTS = new URL("../public/sky/objects.json", import.meta.url);
const MILKYWAY = new URL("../public/sky/milkyway.json", import.meta.url);
const SKY = new URL("../public/sky/sky.json", import.meta.url);

const data = JSON.parse(await readFile(OBJECTS, "utf8"));
const mw = JSON.parse(await readFile(MILKYWAY, "utf8"));
const sky = JSON.parse(await readFile(SKY, "utf8"));
const byId = new Map(data.objects.map((o) => [o.id, o]));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const EXPECTED_IDS = [
  "m1", "m8", "m13", "m31", "m42", "m44", "m45", "m51", "m57", "m87",
  "sgr-a-star", "kepler-field", "hubble-deep-field", "voyager-1", "voyager-2",
  "polaris", "sirius", "arcturus", "vega", "capella", "rigel", "procyon", "betelgeuse",
  "altair", "aldebaran", "antares", "spica", "pollux", "deneb", "regulus",
  // Colour round (task 1) additions, in the order prepare-sky-objects.mjs
  // pushes them: the eight new Messier picks, then the five dsos.6.json
  // picks, then the two dsos.14.json (Veil) picks.
  "m16", "m20", "m27", "m33", "m78", "m81", "m82", "m104",
  "horsehead", "flame", "ngc869", "ngc884", "ngc7000", "ngc6960", "ngc6992",
];
const SYMBOLS = new Set(["galaxy", "nebula", "cluster", "core", "field", "square", "chevron", "star"]);

test("header", () => {
  assert.equal(data.version, 1);
  assert.equal(data.epoch, "J2000");
  assert.match(data.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.source.d3celestial.commit, "7e720a3de062059d4c5400a379146a601d9010e0");
  assert.match(data.source.d3celestial.copyright, /Olaf Frohn/);
  assert.equal(data.source.constellations.revision, 1373165890);
  assert.match(data.source.imo.url, /^https:\/\/web\.archive\.org\/web\/20260905025331id_\//);
});

test("objects: the exact set, valid shapes", () => {
  assert.deepEqual(data.objects.map((o) => o.id), EXPECTED_IDS);
  for (const o of data.objects) {
    assert.ok(o.name.length > 0, o.id);
    assert.ok(SYMBOLS.has(o.symbol), `${o.id} symbol ${o.symbol}`);
    assert.ok(o.raDeg >= 0 && o.raDeg < 360, `${o.id} ra ${o.raDeg}`);
    assert.ok(o.decDeg >= -90 && o.decDeg <= 90, `${o.id} dec ${o.decDeg}`);
    if (o.symbol === "galaxy") assert.ok(o.axisRatio >= 0.35 && o.axisRatio <= 1, `${o.id} axisRatio`);
  }
});

test("landmarks", () => {
  const m31 = byId.get("m31");
  assert.ok(near(m31.raDeg, 10.6751, 0.001) && near(m31.decDeg, 41.2667, 0.001), "M31");
  assert.equal(m31.symbol, "galaxy");
  const core = byId.get("sgr-a-star");
  assert.equal(core.name, "Galactic core");
  assert.ok(near(core.raDeg, 266.41683, 1e-4) && near(core.decDeg, -29.00781, 1e-4), "Sgr A*");
  const kepler = byId.get("kepler-field");
  assert.ok(near(kepler.raDeg, 290.66667, 1e-4) && kepler.decDeg === 44.5 && near(kepler.radiusDeg, 6.05, 0.01), "Kepler field");
  assert.match(kepler.name, /approximate outline/);
  const hdf = byId.get("hubble-deep-field");
  assert.ok(near(hdf.raDeg, 189.20583, 1e-4) && near(hdf.decDeg, 62.21611, 1e-4), "HDF");
  assert.equal(byId.get("m87").symbol, "galaxy");
  assert.equal(byId.get("m45").symbol, "cluster");
  assert.equal(byId.get("m57").symbol, "nebula");
});

test("the 15 named stars resolved by HIP", () => {
  const HIP = {
    polaris: 11767, sirius: 32349, arcturus: 69673, vega: 91262, capella: 24608, rigel: 24436,
    procyon: 37279, betelgeuse: 27989, altair: 97649, aldebaran: 21421, antares: 80763,
    spica: 65474, pollux: 37826, deneb: 102098, regulus: 49669,
  };
  for (const [id, hip] of Object.entries(HIP)) {
    const s = byId.get(id);
    assert.equal(s.symbol, "star", id);
    assert.equal(s.hip, hip, id);
    assert.ok(s.mag <= 2.0, `${id} mag ${s.mag}`);
    // Every named star is also in the drawn catalog, within its 0.01° rounding.
    assert.ok(
      sky.stars.some(([ra, dec]) => near(ra, s.raDeg, 0.006) && near(dec, s.decDeg, 0.006)),
      `${id} is not in sky.json's stars`,
    );
  }
  assert.ok(near(byId.get("polaris").decDeg, 89.2641, 0.001));
  assert.ok(near(byId.get("vega").raDeg, 279.2347, 0.001));
});

test("voyagers: dated, plausible", () => {
  const v1 = byId.get("voyager-1");
  const v2 = byId.get("voyager-2");
  // positionDate means "the date this position was true". On the live path
  // that's the run date. On the recorded fallback it's the date the
  // recorded query was actually made (source.horizons.queried's date part),
  // which can predate a later run's `generated` — it must never postdate it.
  const recordedDate = data.source.horizons.queried.slice(0, 10);
  for (const v of [v1, v2]) {
    assert.equal(v.symbol, "chevron");
    if (data.source.horizons.mode === "live") {
      assert.equal(v.positionDate, data.generated);
    } else {
      assert.equal(v.positionDate, recordedDate, `${v.id} positionDate vs recorded query date`);
      assert.ok(v.positionDate <= data.generated, `${v.id} positionDate ${v.positionDate} is after generated ${data.generated}`);
    }
  }
  assert.ok(v1.raDeg > 255 && v1.raDeg < 262 && v1.decDeg > 10 && v1.decDeg < 14, `V1 at ${v1.raDeg}, ${v1.decDeg}`);
  assert.ok(v1.distanceAu > 165 && v1.distanceAu < 185, `V1 ${v1.distanceAu} au`);
  assert.ok(v2.raDeg > 300 && v2.raDeg < 305 && v2.decDeg > -62 && v2.decDeg < -57, `V2 at ${v2.raDeg}, ${v2.decDeg}`);
  assert.ok(v2.distanceAu > 138 && v2.distanceAu < 155, `V2 ${v2.distanceAu} au`);
});

test("voyagers: match the recorded Horizons rows within 0.1°, live or not", () => {
  // Reference values parsed from the same recorded rows embedded in
  // prepare-sky-objects.mjs's RECORDED_HORIZONS (2026-09-15 00:00 UT). A
  // future live re-run should land within a pixel of these (the Voyagers
  // move ~0.01°/yr); a bigger drift means a live-vs-recorded mixup, not
  // real motion.
  const RECORDED = {
    "voyager-1": { raDeg: 258.61838, decDeg: 12.23786 },
    "voyager-2": { raDeg: 302.53388, decDeg: -59.78539 },
  };
  for (const [id, ref] of Object.entries(RECORDED)) {
    const v = byId.get(id);
    assert.ok(near(v.raDeg, ref.raDeg, 0.1), `${id} raDeg ${v.raDeg} vs recorded ${ref.raDeg}`);
    assert.ok(near(v.decDeg, ref.decDeg, 0.1), `${id} decDeg ${v.decDeg} vs recorded ${ref.decDeg}`);
  }
  assert.ok(["live", "recorded"].includes(data.source.horizons.mode), `source.horizons.mode "${data.source.horizons.mode}"`);
});

test("showers: the twelve, valid windows", () => {
  assert.deepEqual(
    data.showers.map((s) => s.id),
    ["quadrantids", "lyrids", "eta-aquariids", "southern-delta-aquariids", "perseids", "draconids",
      "southern-taurids", "orionids", "northern-taurids", "leonids", "geminids", "ursids"],
  );
  const md = (v) => Number(v.slice(0, 2)) * 100 + Number(v.slice(3));
  for (const s of data.showers) {
    for (const k of ["start", "end", "peak"]) assert.match(s[k], /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, `${s.id}.${k}`);
    const wraps = md(s.start) > md(s.end);
    const inside = wraps ? md(s.peak) >= md(s.start) || md(s.peak) <= md(s.end) : md(s.peak) >= md(s.start) && md(s.peak) <= md(s.end);
    assert.ok(inside, `${s.id} peak outside its window`);
    assert.ok(Number.isInteger(s.zhr) && s.zhr > 0, `${s.id} zhr`);
    assert.ok(s.radiantRaDeg >= 0 && s.radiantRaDeg < 360 && s.radiantDecDeg >= -90 && s.radiantDecDeg <= 90, `${s.id} radiant`);
    assert.ok(s.parent.length > 0 && /^https:\/\//.test(s.parentSource), `${s.id} parent`);
  }
  const per = data.showers.find((s) => s.id === "perseids");
  assert.deepEqual([per.start, per.end, per.peak, per.radiantRaDeg, per.radiantDecDeg, per.zhr], ["07-17", "08-24", "08-13", 48, 58, 100]);
  const qua = data.showers.find((s) => s.id === "quadrantids");
  assert.deepEqual([qua.start, qua.end], ["12-28", "01-12"]);
});

test("constellation origins: all 88, from the table", () => {
  assert.deepEqual(Object.keys(data.constellations).sort(), Object.keys(sky.constellations).sort());
  assert.deepEqual(data.constellations.UMa, { ancient: true, year: null, by: ["Ptolemy"], splitFrom: null });
  assert.deepEqual(data.constellations.Car, { ancient: true, year: 1756, by: ["Ptolemy", "Lacaille"], splitFrom: "Argo Navis" });
  assert.deepEqual(data.constellations.Cru, { ancient: false, year: 1589, by: ["Plancius"], splitFrom: "Centaurus" });
  const hevelius = Object.entries(data.constellations).filter(([, o]) => o.by.includes("Hevelius")).map(([a]) => a).sort();
  assert.deepEqual(hevelius, ["CVn", "LMi", "Lac", "Lyn", "Sct", "Sex", "Vul"]);
  for (const [abbr, o] of Object.entries(data.constellations)) {
    assert.ok(o.by.length >= 1, `${abbr} has no originator`);
    assert.ok(o.ancient || Number.isInteger(o.year), `${abbr} has neither "ancient" nor a year`);
  }
});

test("milky way: five levels, within the vertex and byte budgets", async () => {
  assert.equal(mw.version, 1);
  assert.equal(mw.epoch, "J2000");
  assert.equal(mw.levels.length, 5);
  let vertices = 0;
  for (const rings of mw.levels) {
    assert.ok(rings.length >= 4);
    for (const ring of rings) {
      assert.ok(ring.length >= 4);
      for (const [ra, dec] of ring) {
        assert.ok(ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90, `vertex ${ra}, ${dec}`);
        vertices++;
      }
    }
  }
  assert.ok(vertices >= 1500 && vertices <= 4000, `${vertices} vertices`);
  assert.equal(mw.labels.length, 7);
  const { size } = await stat(MILKYWAY);
  assert.ok(size < 90_000, `milkyway.json is ${size} bytes`);
});

// ---- lib/sky-objects.ts helpers (added with the renderer, Task 4) ----
const O = await import("../lib/sky-objects.ts");

test("isShowerActive: inclusive windows, and windows that wrap the new year", () => {
  const per = data.showers.find((s) => s.id === "perseids"); // 07-17 .. 08-24
  const qua = data.showers.find((s) => s.id === "quadrantids"); // 12-28 .. 01-12
  const at = (y, m, d, h = 12) => Date.UTC(y, m - 1, d, h);
  assert.equal(O.isShowerActive(per, at(2026, 7, 16, 23)), false);
  assert.equal(O.isShowerActive(per, at(2026, 7, 17, 0)), true);
  assert.equal(O.isShowerActive(per, at(2026, 8, 24, 23)), true);
  assert.equal(O.isShowerActive(per, at(2026, 8, 25, 0)), false);
  assert.equal(O.isShowerActive(qua, at(2026, 12, 31)), true);
  assert.equal(O.isShowerActive(qua, at(2027, 1, 12)), true);
  assert.equal(O.isShowerActive(qua, at(2027, 1, 13)), false);
  assert.equal(O.isShowerActive(qua, at(2026, 12, 27)), false);
});

test("smallCircle: every point at the requested angular radius", () => {
  const D2R = Math.PI / 180;
  const kepler = byId.get("kepler-field");
  const ring = O.smallCircle(kepler.raDeg, kepler.decDeg, kepler.radiusDeg);
  assert.equal(ring.length, 48);
  for (const [ra, dec] of ring) {
    const c =
      Math.sin(dec * D2R) * Math.sin(kepler.decDeg * D2R) +
      Math.cos(dec * D2R) * Math.cos(kepler.decDeg * D2R) * Math.cos((ra - kepler.raDeg) * D2R);
    const sep = Math.acos(Math.min(1, c)) / D2R;
    assert.ok(Math.abs(sep - kepler.radiusDeg) < 1e-9, `point at ${sep}°`);
    assert.ok(ra >= 0 && ra < 360);
  }
});

test("prepareMilkyWay: RA in radians and tan of half the colatitude, per vertex", () => {
  const prepared = O.prepareMilkyWay(mw);
  const [ra, dec] = mw.levels[0][0][0];
  const flat = prepared.levels[0][0];
  assert.equal(flat.length, mw.levels[0][0].length * 2);
  assert.ok(Math.abs(flat[0] - (ra * Math.PI) / 180) < 1e-12);
  assert.ok(Math.abs(flat[1] - Math.tan(((90 - dec) / 2) * (Math.PI / 180))) < 1e-12);
});

test("prepareMilkyWay: grain is one array per level, deterministic, bounded, and every point is a valid projection input", () => {
  const a = O.prepareMilkyWay(mw);
  const b = O.prepareMilkyWay(mw);
  assert.equal(a.grain.length, mw.levels.length);
  let total = 0;
  a.grain.forEach((pts, li) => {
    assert.deepEqual(Array.from(pts), Array.from(b.grain[li]), `level ${li} not deterministic`);
    assert.equal(pts.length % 2, 0, `level ${li} not (ra, tan) pairs`);
    total += pts.length / 2;
    for (let i = 0; i < pts.length; i += 2) {
      assert.ok(pts[i] >= 0 && pts[i] < 2 * Math.PI, `level ${li} raRad ${pts[i]} out of range`);
      assert.ok(Number.isFinite(pts[i + 1]), `level ${li} tanHalfColat not finite`);
    }
  });
  // A few hundred points total, not the full ~2,267-vertex budget: the grain
  // is a sampled stipple, not a retrace of every isophote vertex.
  assert.ok(total > 200 && total < 700, `total grain points ${total}`);
});

test("prepareObjectGlyphs: deterministic, and only galaxies/nebulae/clusters with a tuned size get a glyph", () => {
  const a = O.prepareObjectGlyphs(data.objects);
  const b = O.prepareObjectGlyphs(data.objects);
  assert.deepEqual(a, b, "not deterministic across two calls");
  // sky-colour task 1 added 15 catalog objects (8 Messier, 7 dsos) with no
  // tuned glyph size yet -- that tuning is task 4's job, and
  // prepareObjectGlyphs's own doc comment says an untuned galaxy/nebula/
  // cluster id correctly resolves no glyph ("not an error"). So a glyph is
  // required only for a symbol NOT in this shape set (must never draw one)
  // or for one of the ids already tuned before this task; a present glyph,
  // whichever id it's for, must still match its object's own symbol.
  const TUNED = ["m1", "m8", "m13", "m31", "m42", "m44", "m45", "m51", "m57", "m87"];
  for (const o of data.objects) {
    const glyph = a.get(o.id);
    if (["galaxy", "nebula", "cluster"].includes(o.symbol)) {
      if (TUNED.includes(o.id)) assert.ok(glyph, `${o.id} (${o.symbol}) has no glyph`);
      if (glyph) {
        assert.equal(glyph.kind, o.symbol);
        assert.ok(glyph.corePx >= 6, `${o.id} corePx ${glyph.corePx} below the default SYMBOL_CORE_PX`);
      }
    } else {
      assert.equal(glyph, undefined, `${o.id} (${o.symbol}) unexpectedly has a glyph`);
    }
  }
  const m31 = a.get("m31");
  assert.equal(m31.kind, "galaxy");
  assert.equal(m31.tiltDeg, 77, "M31's tilt should match its fact's ~77 degrees");
  assert.equal(m31.majorPx, 20, "Andromeda should be the biggest glyph (~40px across)");
  assert.ok(Math.abs(m31.minorPx - 20 * byId.get("m31").axisRatio) < 1e-9, "minorPx should track the catalog axisRatio");
  for (const id of ["m51", "m87"]) {
    assert.ok(a.get(id).majorPx < m31.majorPx, `${id} should be smaller than Andromeda`);
  }
  const m57 = a.get("m57");
  assert.equal(m57.kind, "nebula");
  assert.ok(m57.ring, "M57 should render as a ring, not blobs");
  assert.equal(m57.blobs.length, 0);
  for (const id of ["m1", "m8", "m42"]) {
    const g = a.get(id);
    assert.equal(g.ring, null);
    assert.ok(g.blobs.length > 0, `${id} should have cloud blobs`);
  }
  const m13 = a.get("m13");
  assert.equal(m13.kind, "cluster");
  assert.equal(m13.stars.length, 11);
  for (const s of m13.stars) {
    assert.ok(Math.hypot(s.dx, s.dy) <= 7 + 1e-9, `m13 star outside its 7px extent: ${JSON.stringify(s)}`);
  }
});

// ---- sky-colour task 1: the fifteen new deep-sky objects ----

test("objects.json carries the colour-round additions", () => {
  const ids = new Set(data.objects.map((o) => o.id));
  for (const id of ["horsehead", "flame", "m20", "m27", "m16", "m33", "m81", "m82", "m104", "m78",
                    "ngc869", "ngc884", "ngc6960", "ngc6992", "ngc7000"]) {
    assert.ok(ids.has(id), `${id} missing from objects.json`);
  }
  assert.equal(data.objects.length, 45);
});

test("no object displays a sentinel magnitude", () => {
  for (const o of data.objects) {
    if (o.mag === undefined) continue;
    assert.ok(o.mag > -30 && o.mag < 30, `${o.id} mag ${o.mag} is a sentinel, not a magnitude`);
  }
});

test("every object is north of the chart edge and has a usable position", () => {
  for (const o of data.objects) {
    if (o.id === "voyager-2") continue; // known: dec -59.8, has a card but never draws
    assert.ok(o.decDeg > -35, `${o.id} at dec ${o.decDeg} is south of the chart edge`);
    assert.ok(Number.isFinite(o.raDeg) && o.raDeg >= 0 && o.raDeg < 360, `${o.id} bad ra`);
  }
});

// ---- sky-colour task 3: the colour seam. OBJECT_COLOURS is empty until
// Tasks 4-5 populate it, so this loop is vacuous for now and becomes
// load-bearing once entries land. Follows the same dynamic-import-of-.ts
// pattern as O above (lib/sky-objects.ts), and the same byId-map pattern
// test-sky-facts.mjs uses for SKY_FACTS. ----

// ---- sky-colour task 4: the galaxy variants ----

test("galaxy glyphs carry the right variant and are deterministic", () => {
  const a = O.prepareObjectGlyphs(data.objects);
  const b = O.prepareObjectGlyphs(data.objects);
  assert.equal(a.get("m31").variant, "spiral");
  assert.equal(a.get("m33").variant, "spiral");
  assert.equal(a.get("m81").variant, "spiral");
  assert.equal(a.get("m87").variant, "elliptical");
  assert.equal(a.get("m104").variant, "edge-on");
  assert.equal(a.get("m82").variant, "starburst");
  assert.equal(a.get("m51").variant, "spiral-companion");
  assert.deepEqual(JSON.parse(JSON.stringify(a.get("m31"))), JSON.parse(JSON.stringify(b.get("m31"))));
  // Every galaxy in the catalog now has a glyph, so none falls back to the
  // plain 5px ellipse in drawObjects.
  for (const o of data.objects) {
    if (o.symbol === "galaxy") assert.ok(a.get(o.id), `${o.id} has no glyph`);
  }
});

test("each variant prepares exactly the geometry its draw function reads", () => {
  const g = O.prepareObjectGlyphs(data.objects);
  // Spirals: knots on the arms, no jet, no lane, no plumes. The companion is
  // M51's alone.
  for (const id of ["m31", "m33", "m81", "m51"]) {
    const a = g.get(id);
    assert.equal(a.knots.length, 5, `${id} knots`);
    assert.equal(a.jet, null, `${id} jet`);
    assert.equal(a.lane, null, `${id} lane`);
    assert.equal(a.plumes.length, 0, `${id} plumes`);
    for (const k of a.knots) {
      // A knot sits on an arm, so within the glyph's own major radius.
      assert.ok(Math.hypot(k.dx, k.dy) <= a.majorPx + 1e-9, `${id} knot outside the glyph`);
      assert.ok(k.r > 0.5 && k.r < 1.6, `${id} knot radius ${k.r}`);
    }
    assert.equal(a.companion === null, id !== "m51", `${id} companion`);
  }
  const m51 = g.get("m51");
  assert.ok(Math.hypot(m51.companion.dx, m51.companion.dy) > m51.minorPx, "M51's companion should sit past the disk");
  // M87: globulars, a jet, nothing else.
  const m87 = g.get("m87");
  assert.equal(m87.knots.length, 7);
  assert.equal(m87.companion, null);
  assert.equal(m87.lane, null);
  assert.ok(m87.jet.lengthPx > m87.majorPx, "the jet should reach past the halo");
  assert.ok(m87.jet.halfWidthPx > 0 && Number.isFinite(m87.jet.angleDeg));
  // M104: a lane wider than the glyph, offset off the centre line, no knots.
  const m104 = g.get("m104");
  assert.equal(m104.knots.length, 0);
  assert.equal(m104.jet, null);
  assert.ok(m104.lane.spanPx > 2 * m104.minorPx, "the dust ring should run past the bulge");
  assert.ok(m104.lane.offsetPx > 0 && m104.lane.halfPx > 0);
  // M82: a lane on the centre line and superwind filaments both ways.
  const m82 = g.get("m82");
  assert.equal(m82.lane.offsetPx, 0);
  assert.equal(m82.plumes.length, 6);
  assert.ok(m82.plumes.some((f) => f.y2 !== f.y1), "plumes should have length");
  assert.ok(
    m82.plumes.every((f) => Math.hypot(f.x2 - f.x1, f.y2 - f.y1) > m82.minorPx),
    "a superwind filament should reach past the disk's own thickness",
  );
});

test("M82 is deliberately absent from the palette, every other galaxy is in it", async () => {
  const { OBJECT_COLOURS } = await import("../lib/sky-layers.ts");
  const galaxies = data.objects.filter((o) => o.symbol === "galaxy").map((o) => o.id);
  // Ruling R-COLOUR-1: M82's famous colours are X-ray and infrared data,
  // which have no visible colour. It stays grey on purpose.
  assert.equal(OBJECT_COLOURS.m82, undefined, "M82 must not carry a colour");
  for (const id of galaxies) {
    if (id === "m82") continue;
    assert.ok(OBJECT_COLOURS[id], `${id} has no palette`);
    assert.match(OBJECT_COLOURS[id].base, /^\d{1,3},\d{1,3},\d{1,3}$/, `${id} base is not "r,g,b"`);
  }
  // M104's sourced story is a bulge and a dust lane, with no blue disk.
  assert.ok(OBJECT_COLOURS.m104.accent, "M104 needs its dust lane colour");
  // M81's sources name no knot colour, so it must not get an accent (the
  // widely shared pink M81 is a UV + visible + IR composite).
  assert.equal(OBJECT_COLOURS.m81.accent, undefined, "M81 must not draw knots");
});

// ---- sky-colour task 5: the nebula and cluster variants ----

test("nebula and cluster glyphs carry the right variant", () => {
  const g = O.prepareObjectGlyphs(data.objects);
  const EXPECTED = {
    m1: "remnant", ngc6960: "remnant", ngc6992: "remnant",
    m8: "emission", m16: "emission", m20: "emission", m42: "emission", ngc7000: "emission", flame: "emission",
    m27: "planetary", m57: "planetary",
    m78: "reflection",
    horsehead: "dark",
    m13: "globular",
    m44: "open", m45: "open", ngc869: "open", ngc884: "open",
  };
  for (const [id, variant] of Object.entries(EXPECTED)) {
    assert.ok(g.get(id), `${id} prepares no glyph`);
    assert.equal(g.get(id).variant, variant, id);
  }
  // Every nebula and cluster in the catalog now has a glyph, so none falls
  // back to drawObjects' dashed circle or six-dot ring.
  for (const o of data.objects) {
    if (o.symbol === "nebula" || o.symbol === "cluster") assert.ok(g.get(o.id), `${o.id} has no glyph`);
  }
});

test("no palette entry lacks a variant to draw it", async () => {
  const { OBJECT_COLOURS } = await import("../lib/sky-layers.ts");
  const g = O.prepareObjectGlyphs(data.objects);
  for (const id of Object.keys(OBJECT_COLOURS)) {
    assert.ok(g.get(id), `${id} has a palette but prepares no glyph`);
    assert.match(OBJECT_COLOURS[id].base, /^\d{1,3},\d{1,3},\d{1,3}$/, `${id} base is not "r,g,b"`);
  }
});

test("each nebula and cluster variant prepares the geometry its draw function reads", () => {
  const g = O.prepareObjectGlyphs(data.objects);
  // The Trifid's identity is its split: emission lobes plus one reflection
  // lobe, cut apart by the three dust lanes it is named for.
  const m20 = g.get("m20");
  assert.equal(m20.dust.length, 3, "the Trifid needs its three lanes");
  assert.equal(m20.blobs.filter((b) => b.tint === 1).length, 1, "the Trifid needs one reflection lobe");
  assert.equal(m20.blobs.filter((b) => b.tint === 0).length, 2, "the Trifid needs its emission lobes");
  // The Horsehead is a silhouette, so it carries both the dark shape and the
  // backdrop that shape blocks: a dark outline alone on a dark sky is nothing.
  const hh = g.get("horsehead");
  assert.ok(hh.silhouette.length >= 8, "the Horsehead needs an outline");
  assert.ok(hh.blobs.length > 0, "the Horsehead needs its IC 434 backdrop");
  const headH = Math.max(...hh.silhouette.map((s) => s.dy)) - Math.min(...hh.silhouette.map((s) => s.dy));
  const backR = Math.max(...hh.blobs.map((b) => Math.hypot(b.dx, b.dy) + b.r));
  assert.ok(backR > headH * 0.6, `the backdrop (${backR.toFixed(1)}px) must read around the head (${headH.toFixed(1)}px tall)`);
  assert.ok(g.get("horsehead").silhouette.every((s) => Number.isFinite(s.dx) && Number.isFinite(s.dy)));
  // Remnants are filaments. The Veil is one thin slice of a shell 3 degrees
  // across, so it is lace with no body: filaments and nothing else.
  for (const id of ["ngc6960", "ngc6992"]) {
    const v = g.get(id);
    assert.equal(v.blobs.length, 0, `${id} should draw no cloud`);
    assert.equal(v.filaments.length, 5, `${id} filaments`);
  }
  const m1 = g.get("m1");
  assert.equal(m1.filaments.length, 6);
  assert.ok(m1.blobs.length > 0, "the Crab keeps its diffuse interior");
  for (const f of [...m1.filaments, ...g.get("ngc6960").filaments]) {
    for (const n of [f.x1, f.y1, f.cx, f.cy, f.x2, f.y2]) assert.ok(Number.isFinite(n));
    assert.ok(Math.hypot(f.x2 - f.x1, f.y2 - f.y1) > 1, "a filament needs length");
  }
  // Planetary nebulae: M57 is the annulus it always was, M27 an apple core of
  // two lobes about a waist.
  assert.ok(g.get("m57").ring);
  const m27 = g.get("m27");
  assert.equal(m27.ring, null);
  assert.equal(m27.blobs.length, 3);
  const lobes = m27.blobs.filter((b) => Math.hypot(b.dx, b.dy) > 0);
  assert.equal(lobes.length, 2, "the Dumbbell needs two lobes");
  assert.ok(Math.abs(lobes[0].dx + lobes[1].dx) < 1e-9 && Math.abs(lobes[0].dy + lobes[1].dy) < 1e-9, "opposite sides of the waist");
  // M42's Trapezium core is kept OUT of blobs so the grey path, which draws
  // every blob, is untouched by it.
  assert.ok(g.get("m42").coreBlob, "M42 needs its core region");
  assert.equal(g.get("m8").coreBlob, null);
  assert.equal(g.get("m8").stars.length, 3, "M8's embedded blue-white stars");
  assert.equal(g.get("m16").dust.length, 3, "the Eagle's pillars");
  assert.equal(g.get("ngc7000").dust.length, 1, "the Gulf of Mexico notch");
  // Clusters: tints are a minority of the stars, never all of them, and the
  // Double Cluster carries no haze, because the pink gas in its famous image
  // is narrowband enhancement (colour-sources.md corrections).
  const m13 = g.get("m13");
  assert.equal(m13.stars.length, 11);
  assert.ok(m13.haze.length > 0, "a globular's unresolved core");
  assert.ok(m13.stars.some((s) => s.tint === 1) && m13.stars.some((s) => s.tint === 2), "M13's blue and red giants");
  assert.ok(m13.stars.filter((s) => s.tint === 0).length > m13.stars.length / 2, "most of a globular is its common colour");
  assert.ok(g.get("m45").haze.length > 0, "the Pleiades' reflection nebulosity");
  for (const id of ["ngc869", "ngc884"]) {
    assert.equal(g.get(id).haze.length, 0, `${id} must draw no gas`);
    assert.ok(g.get(id).stars.every((s) => s.tint === 0), `${id} stars are one sourced colour`);
  }
});

test("colour-off geometry is unchanged for every glyph that existed before the colour round", () => {
  // Recorded from HEAD~ (the pre-round lib/sky-objects.ts) and pinned here:
  // the Global Constraint is that with colour off the chart renders exactly
  // as it did, and the grey path draws these numbers and nothing else. A
  // rnd() call inserted before or inside either placement loop moves all of
  // them at once, which is the failure this catches.
  const BEFORE = {
    m1: [[0, 0, 6.780019], [1.731545, -3.749743, 4.614483], [-5.07385, 0.084356, 3.227873]],
    m8: [[0, 0, 7.17359], [-2.723536, -3.124637, 3.175588], [0.70862, -5.588762, 5.203734]],
    m42: [[0, 0, 7.638677], [2.73876, 4.86814, 4.693195], [4.358007, 2.716654, 3.62308]],
    m13: [[0.679642, 1.083148, 1.029468], [-4.074239, 5.348776, 0.842976], [2.546159, 0.86389, 1.107533],
      [-1.24546, -1.92219, 0.887456], [0.029783, 2.024421, 0.844557], [-4.94824, -0.294202, 1.191002],
      [2.496401, -5.782248, 0.944421], [4.624135, -4.194965, 0.725891], [3.295001, 6.011263, 1.083903],
      [-5.786105, 2.751467, 1.101721], [-4.155542, -4.546985, 1.124866]],
    m44: [[6.246202, 3.061123, 0.852055], [-1.830355, 0.506407, 0.997816], [-0.910846, -9.341291, 1.103128],
      [0.257536, -8.737051, 1.090642], [-3.863856, -4.761445, 1.124502], [5.937319, 4.09741, 0.838163],
      [3.633071, -0.683399, 0.912189], [-8.360601, -2.158915, 1.083316], [-6.004138, 4.172917, 1.071017]],
    m45: [[3.246976, 4.063393, 1.122904], [-7.441785, 2.78475, 0.85367], [-0.383844, 10.741678, 0.971434],
      [8.274036, -2.222437, 1.115885], [4.209389, -2.144613, 1.000309], [-5.294123, 7.546798, 0.995052],
      [-2.708962, 10.12979, 0.980841]],
  };
  const g = O.prepareObjectGlyphs(data.objects);
  for (const [id, rows] of Object.entries(BEFORE)) {
    const glyph = g.get(id);
    const now = glyph.kind === "nebula" ? glyph.blobs : glyph.stars;
    assert.equal(now.length, rows.length, `${id} count`);
    rows.forEach(([dx, dy, r], i) => {
      assert.ok(near(now[i].dx, dx, 1e-6) && near(now[i].dy, dy, 1e-6) && near(now[i].r, r, 1e-6),
        `${id}[${i}] moved: ${JSON.stringify(now[i])} vs ${JSON.stringify([dx, dy, r])}`);
    });
  }
  const m57 = g.get("m57");
  assert.deepEqual(m57.ring, { outerR: 8, innerR: 3.36 });
  assert.equal(m57.blobs.length, 0);
  for (const id of ["m1", "m8", "m42", "m13", "m44", "m45", "m57"]) assert.equal(g.get(id).corePx, { m42: 7, m45: 7 }[id] ?? 6, id);
});

test("the nebula and cluster palettes keep the false-colour rulings", async () => {
  const { OBJECT_COLOURS } = await import("../lib/sky-layers.ts");
  const rgb = (s) => s.split(",").map(Number);
  // The Veil's famous teal and red is the Hubble palette (ESA's own caption:
  // blue oxygen, green sulphur, red hydrogen). A broadband Veil is dimmer and
  // red-dominant, so neither arc may carry a blue-green anywhere.
  for (const id of ["ngc6960", "ngc6992"]) {
    const p = OBJECT_COLOURS[id];
    assert.ok(p, `${id} palette`);
    const [r, g2, b] = rgb(p.base);
    assert.ok(r > g2 && r > b, `${id} broadband appearance is red-dominant, got ${p.base}`);
    assert.equal(p.accent, undefined, `${id} must not carry the narrowband oxygen teal`);
    assert.equal(p.core, undefined, `${id} must not carry the narrowband oxygen teal`);
  }
  // The Eagle's gold pillars on teal is the SHO palette, with H-alpha put on
  // green. Its glow follows the line's own wavelength instead: red.
  const [r16, g16, b16] = rgb(OBJECT_COLOURS.m16.base);
  assert.ok(r16 > g16 * 1.5 && r16 > b16, `M16 must not read gold or teal, got ${OBJECT_COLOURS.m16.base}`);
  // Planetary nebulae are blue-green from doubly ionized oxygen, which is
  // where M57's and M27's bodies come from.
  //
  // ⚠️ And that is ALL they get. Until 2026-09-16 both fringed their outer
  // edge red "as hydrogen", and this test pinned it (final review M2). No
  // source puts H-alpha at the outer edge of either: APOD says M57's hydrogen
  // is in the INNER ring and the outer ring's red is nitrogen and sulphur,
  // NASA's M27 stratification puts hydrogen in the MIDDLE shell, and
  // R-COLOUR-2 rules [N II] = red unsourced. A blue-green body inside a red
  // rim is the narrowband composite's own arrangement, so the test now holds
  // the accent OFF until a source says otherwise.
  for (const id of ["m57", "m27"]) {
    const [r, g2, b] = rgb(OBJECT_COLOURS[id].base);
    assert.ok(g2 > r && b > r, `${id} body should be the blue-green of O III, got ${OBJECT_COLOURS[id].base}`);
    assert.equal(OBJECT_COLOURS[id].accent, undefined, `${id} must not fringe its outer edge: no source puts hydrogen there`);
    assert.equal(OBJECT_COLOURS[id].core, undefined, `${id} must not carry the narrowband helium blue at its centre`);
  }
  // Nothing in this table may be GREEN. Blue-green is fine and sourced (O III
  // at 495.9 and 500.7 nm, and M42's calibrated teal), so the test allows a
  // green channel that a nearly equal blue comes with; what it refuses is a
  // green that leaves blue behind, which is what the Hubble palette's
  // H-alpha-on-green looks like, the canonical false-colour offence.
  for (const [id, p] of Object.entries(OBJECT_COLOURS)) {
    for (const [slot, value] of Object.entries(p)) {
      const [r, g2, b] = rgb(value);
      assert.ok(!(g2 > r && g2 > b * 1.15), `${id}.${slot} is green (${value}), not blue-green: that is the Hubble palette's own tell`);
    }
  }
  // The Double Cluster's stars are ordinary stellar colour and citable; the
  // pink hydrogen around them in the famous image is narrowband enhancement
  // and is not. Stars only, so no second colour.
  for (const id of ["ngc869", "ngc884"]) {
    assert.ok(OBJECT_COLOURS[id].base, `${id} stars`);
    assert.equal(OBJECT_COLOURS[id].accent, undefined, `${id} must not colour the enhanced hydrogen glow`);
  }
  // The Crab's interior blue is synchrotron light in a confirmed false-colour
  // composite, so only its hydrogen filaments carry a colour.
  assert.ok(OBJECT_COLOURS.m1.base);
  assert.equal(OBJECT_COLOURS.m1.core, undefined, "the Crab's synchrotron interior has no sourced visible colour");
});

/**
 * The source each coloured object's palette actually rests on, by id: the
 * URL(s) that must appear on that object's own card.
 *
 * ⚠️ This map is the round's central honesty claim, and until 2026-09-16 the
 * test below only asserted `citations.length >= 1` (final review M4), which
 * every card passes by existing. That is how ten objects came to draw colours
 * their cards cited nothing for (C1). An entry here is a promise that the
 * page at that URL says, in words, what the palette draws, checked by hand
 * against the served page.
 *
 * "Card" means what a reader sees, so the effective set includes the
 * Lodriguss citation SkyCard.tsx appends to every EMISSION_LINE_COLOURED
 * object: for those, the chain is one page naming the emitting species and
 * Lodriguss giving that line's own colour (ruling R-COLOUR-1).
 */
const LODRIGUSS = "https://www.astropix.com/books/BGAIP/chapter1/103.html";
const messier = (n) => `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-${n}/`;
const COLOUR_CITATION = {
  // "a bright yellow nucleus, dark winding dust lanes, luminous blue spiral
  // arms, and bright red emission nebulas" (APOD 2019).
  m31: ["https://apod.nasa.gov/apod/ap190909.html"],
  // "Blue-colored regions... reveal numerous sites of rapid star birth" and
  // "its bright-white core" (NASA); "pinkish star forming regions" (APOD).
  m33: [messier(33), "https://science.nasa.gov/image-article/apod-2017-november-30-m33-triangulum-galaxy/"],
  // "bright pink star-forming regions... brilliant blue strands of star
  // clusters", around an older core.
  m51: [messier(51)],
  // "young, bluish, hot stars" in the arms, "much older, redder stars" in the
  // bulge.
  m81: [messier(81)],
  // "the blue jet contrasts with the yellow glow from the combined light of
  // billions of unresolved stars".
  m87: [messier(87)],
  // "a brilliant, white, bulbous core encircled by thick dust lanes".
  m104: [messier(104)],
  // "The orange filaments... consist mostly of hydrogen", drawn at hydrogen's
  // own wavelength rather than at that composite's orange.
  m1: [messier(1), LODRIGUSS],
  // "Wisps of pinkish-grey clouds fill the scene... Bright, blue-white stars
  // shine through the cloud."
  m8: [messier(8)],
  // The card quotes the SHO palette off this page; what is left under it is a
  // hydrogen glow, and Lodriguss gives that line its colour.
  m16: [messier(16), LODRIGUSS],
  // ESO, on the two halves: "the round, pink-reddish area typical of an
  // emission nebula" and "the bluish patch... called a reflection nebula",
  // where dust "scatter[s] blue light more efficiently than red light".
  m20: ["https://www.eso.org/public/news/eso0930/"],
  // NASA names the emitting species and calls it a planetary nebula;
  // Lodriguss: planetary nebulae "are blue-green in color from emission lines
  // of doubly ionized oxygen".
  m27: [messier(27), LODRIGUSS],
  m57: [messier(57), LODRIGUSS],
  // The teal core is ClarkVision's calibrated true-colour measurement, not
  // NASA's false-colour map of the same cloud; the card carries both readings
  // and says which is which.
  m42: [messier(42), "https://clarkvision.com/articles/astrophotography.m42-trapezium.true.color/", LODRIGUSS],
  // "The dust... reflects the light of several bright blue stars... The same
  // type of scattering that colors the daytime sky further enhances the blue."
  m78: ["https://science.nasa.gov/image-article/apod-2000-april-24-reflection-nebula-m78/"],
  // "the nebula's suggestive reddish color is due to the glow of hydrogen
  // atoms".
  flame: ["https://science.nasa.gov/image-article/apod-2007-february-2-flame-nebula-close-up/", LODRIGUSS],
  // What the head blocks is IC 434's hydrogen; the head itself is opaque dust
  // and carries no colour claim.
  horsehead: [
    "https://science.nasa.gov/missions/webb/webb-captures-top-of-iconic-horsehead-nebula-in-unprecedented-detail/",
    LODRIGUSS,
  ],
  // "Sensitive cameras can pick up the reddish color that is characteristic
  // of hydrogen that dominates C20."
  ngc7000: ["https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-20/", LODRIGUSS],
  // ESA names hydrogen among the shock's emitters; the arcs draw that line's
  // own red and none of that caption's narrowband teal.
  ngc6960: ["https://esahubble.org/news/heic0712/", LODRIGUSS],
  ngc6992: ["https://esahubble.org/news/heic0712/", LODRIGUSS],
  // "Blue stars are hot and red stars are cool" (APOD), around a core "so
  // dense in the middle it looks solid white" (EarthSky).
  m13: ["https://apod.nasa.gov/apod/ap190613.html", "https://earthsky.org/clusters-nebulae-galaxies/m13-finest-globular-cluster-in-northern-skies/"],
  // "The cluster's few yellowish tinted, cool, red giants are scattered
  // through the field of its brighter hot blue main sequence stars."
  m44: ["https://apod.nasa.gov/apod/ap220430.html"],
  // "The nearly straight, blue-white wisps... are streams of large dust
  // particles."
  m45: [messier(45)],
  // ⚠️ The one entry whose page does not name a colour: it says these are
  // "stars much younger and hotter than the Sun", and the blue-white is that
  // temperature, not a quotation. Recorded rather than hidden; see the
  // Double Cluster's note in OBJECT_COLOURS.
  ngc869: ["https://apod.nasa.gov/apod/ap140123.html"],
  ngc884: ["https://apod.nasa.gov/apod/ap140123.html"],
};

test("every coloured object's card cites the source its colour rests on", async () => {
  const { OBJECT_COLOURS, EMISSION_LINE_COLOURED } = await import("../lib/sky-layers.ts");
  const { SKY_FACTS } = await import("../content/sky-facts.ts");
  const FACTS = new Map(SKY_FACTS.map((f) => [f.id, f]));
  assert.deepEqual(
    Object.keys(COLOUR_CITATION).sort(),
    Object.keys(OBJECT_COLOURS).sort(),
    "every id in OBJECT_COLOURS needs an entry in COLOUR_CITATION and nothing else may have one",
  );
  for (const [id, urls] of Object.entries(COLOUR_CITATION)) {
    const fact = FACTS.get(id);
    assert.ok(fact, `${id} has a palette but no card to cite it on`);
    // Exactly what SkyCard.tsx renders under Sources.
    const cited = new Set(fact.citations.map((c) => c.url));
    if (EMISSION_LINE_COLOURED.has(id)) cited.add(LODRIGUSS);
    for (const url of urls) {
      assert.ok(cited.has(url), `${id} draws a colour this card does not source: its Sources list must include ${url}, and holds ${[...cited].join(", ")}`);
    }
  }
});

// ---- discoverability task 3: saturation replaces the colour flag ----
//
// The draw layers are recorded through a fake 2D context that logs every call
// and every style assignment, over five fixed scenes (four orientations at
// 1600x1000 with names, one 400x800 without). The two digests below were
// recorded from the colour-flag code immediately before the flag became a
// number (commit 209247f): `colour: false` and `colour: true`. They are the
// byte-identity contract for the two ends: saturation 0 must draw exactly
// what the grey chart drew, saturation 1 with stargaze's chrome exactly what
// stargaze drew. A changed digest means the ends moved, not that a fixture
// needs refreshing.
//
// ⚠️ TRACE_STARGAZE was RE-RECORDED for task 18 (2026-10-01), and only
// after a proof. The Milky Way's flat stargaze fill became the gold-core
// gradient (rulings R24/R26), which changes the saturation-1 trace on purpose; the
// colour-off digest did NOT change and is the 209247f recording still. The
// proof (.superpowers/sdd/2026-09-30-slaac-rerouter/task-18-trace-proof.mjs,
// run against the pre-task-18 modules, which also covers drawSky's own star
// loop that these layer traces never reach): with the new faint stars'
// calls removed, saturation 0 is byte-identical to the old full-frame trace;
// at saturation 1 (and at paper) the only differences are 25 band fillStyle
// lines (the wash's flat rgba -> the gradient, 5 levels x 5 scenes; the grain
// stays flat), the 25 createRadialGradient + 75 addColorStop calls those
// gradients add (three stops each since fix round 1 dropped the blue disc
// stop: the round-0 recording was 17,184), and, in the full frame only, the
// old stars' fill colours (B-V colour). That is the +100 calls here:
// 17,059 -> 17,159. The pre-task value was
// { n: 17059, sha: "9703c058a9f7c3ba9f202c6a35ec48178a9ecfb8bcc53c226d4c1bc401736ad6" }.
const TRACE_COLOUR_OFF = { n: 16577, sha: "f0ea2cc4199c4c1ba44549465a52ff6172ad6dfdc8cf8ae0ccd943a8555a34a4" };
const TRACE_STARGAZE = { n: 17159, sha: "1b36da1dce9f237a11d3940e746f61ef47741ee5cf573e71371ba048146bf722" };
const TRACE_SCENES = [[1600, 1000, 0, true], [1600, 1000, 90, true], [1600, 1000, 180, true], [1600, 1000, 270, true], [400, 800, 45, false]];

const L = await import("../lib/sky-layers.ts");
const SM = await import("../lib/sky-math.ts");
const SC = await import("../lib/sky-colour.ts");
const traceMw = O.prepareMilkyWay(mw);
const traceGlyphs = O.prepareObjectGlyphs(data.objects);
const traceRings = new Map(data.objects.filter((o) => o.symbol === "field").map((o) => [o.id, O.smallCircle(o.raDeg, o.decDeg, o.radiusDeg)]));

/** Every call and style set the layers make, as text lines. */
function traceLayers(viewExtra, objects = data.objects, { milkyWay = true } = {}) {
  const log = [];
  const target = {
    measureText: (t) => ({ width: t.length * 5.4 }),
    // Task 18: above saturation 0 the Milky Way fills with a radial gradient.
    // Its creation and every stop are logged; the fillStyle line then reads
    // "radialGradient". Saturation 0 never builds one, so the colour-off
    // recording below is untouched by this (asserted, unchanged).
    createRadialGradient: (...a) => {
      log.push(`createRadialGradient(${a.join(",")})`);
      return { addColorStop: (o, c) => void log.push(`addColorStop(${o},${c})`), toString: () => "radialGradient" };
    },
  };
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => {
        log.push(`${String(k)}(${a.join(",")})`);
      };
    },
    set(t, k, v) {
      log.push(`${String(k)}=${v}`);
      return true;
    },
  });
  for (const [w, h, lst, names] of TRACE_SCENES) {
    const chart = SM.chartFor(w, h, lst);
    const v = { chart, width: w, height: h, fontFamily: "mono", names, suppressName: null, ...viewExtra };
    if (milkyWay) L.drawMilkyWay(ctx, v, traceMw, data.objects.map((o) => SM.project(chart, o.raDeg, o.decDeg)));
    L.drawObjects(ctx, v, objects, traceRings, traceGlyphs);
  }
  return log;
}
const digestOf = (log) => ({ n: log.length, sha: createHash("sha256").update(log.join("\n")).digest("hex") });
/** Channel spread of every rgba() in a line; [] when it has none. */
const chromasIn = (line) =>
  [...line.matchAll(/rgba\((\d+),(\d+),(\d+),/g)].map((m) => Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]));

test("saturation 0 draws exactly the old grey chart, 1 exactly the old stargaze chart", () => {
  assert.deepEqual(digestOf(traceLayers({ saturation: 0, stargazeChrome: false })), TRACE_COLOUR_OFF, "saturation 0 no longer matches the colour-off recording");
  assert.deepEqual(digestOf(traceLayers({ saturation: 1, stargazeChrome: true })), TRACE_STARGAZE, "saturation 1 in stargaze no longer matches the stargaze recording");
});

test("chroma grows with saturation, call for call, and paper mode sits strictly between", () => {
  const levels = [0.1, 0.25, SC.PAPER_SATURATION, 0.75, 1].sort((a, b) => a - b).filter((x, i, a) => a.indexOf(x) === i);
  const logs = levels.map((s) => traceLayers({ saturation: s, stargazeChrome: false }));
  // Above zero the geometry is the coloured path at every level, so the logs
  // line up call for call and only colour strings may differ.
  for (const log of logs) assert.equal(log.length, logs[0].length, "geometry changed with saturation above 0");
  let grew = 0;
  for (let i = 0; i < logs[0].length; i++) {
    const per = logs.map((log) => chromasIn(log[i]));
    if (!per[0].length) {
      for (const log of logs) assert.equal(log[i], logs[0][i], `line ${i} has no colour but differs across saturation`);
      continue;
    }
    for (let j = 1; j < per.length; j++) {
      per[j].forEach((c, k) =>
        assert.ok(c >= per[j - 1][k], `line ${i}: chroma fell from ${per[j - 1][k]} at s=${levels[j - 1]} to ${c} at s=${levels[j]} (${logs[j - 1][i]} -> ${logs[j][i]})`),
      );
    }
    if (per[per.length - 1].some((c, k) => c > per[0][k])) grew++;
  }
  assert.ok(grew > 100, `only ${grew} styled calls gained chroma from s=0.1 to s=1`);
  // Paper's total chroma is strictly above the grey chart's and below stargaze's.
  const total = (log) => log.reduce((a, line) => a + chromasIn(line).reduce((x, y) => x + y, 0), 0);
  const grey = total(traceLayers({ saturation: 0, stargazeChrome: false }));
  const paper = total(logs[levels.indexOf(SC.PAPER_SATURATION)]);
  const full = total(logs[levels.length - 1]);
  assert.ok(grey < paper && paper < full, `summed chroma grey ${grey}, paper ${paper}, full ${full} should increase strictly`);
});

test("the Milky Way band's hue and alpha both follow saturation", () => {
  // Saturation 0 fills each band level (wash, then grain) with one flat rgba,
  // exactly as before task 18. Above 0 each WASH fill is a radial gradient
  // from the galactic core (task 18, rulings R24/R26): gold at offset 0 and
  // 0.15, the colour round's tan from 0.4 on. The grain keeps its flat tan at
  // every saturation and is held to the original assertions. A band fill is
  // read back as its list of [offset, r, g, b, a] stops; a flat fill is one
  // stop.
  const RGBA = /rgba\((\d+),(\d+),(\d+),([\d.e-]+)\)/;
  const bandFills = (s) => {
    const fills = [];
    let stops = [];
    for (const l of traceLayers({ saturation: s, stargazeChrome: false }, [], { milkyWay: true })) {
      if (l.startsWith("createRadialGradient(")) stops = [];
      else if (l.startsWith("addColorStop(")) {
        const at = Number(l.slice("addColorStop(".length, l.indexOf(",")));
        stops.push([at, ...l.match(RGBA).slice(1).map(Number)]);
      } else if (l === "fillStyle=radialGradient") fills.push(stops);
      else if (l.startsWith("fillStyle=rgba(")) {
        const c = l.match(RGBA).slice(1).map(Number);
        if (c[0] !== 154) fills.push([[null, ...c]]); // every fill but the MUT label
      }
    }
    return fills;
  };
  const at0 = bandFills(0);
  const atP = bandFills(SC.PAPER_SATURATION); // paper
  const at1 = bandFills(1);
  assert.equal(at0.length, atP.length);
  assert.equal(at0.length, at1.length);
  const warmth = ([, r, , b]) => r - b;
  const stop = (fill, at) => fill.find((x) => x[0] === at);
  let checked = 0;
  let gradients = 0;
  for (let i = 0; i < at0.length; i++) {
    const flat = at0[i][0];
    assert.equal(at0[i].length, 1, `band fill ${i}: saturation 0 is one flat colour`);
    if (at1[i].length === 1) {
      // A flat fill above 0 (the grain): the pre-task-18 assertions, as they were.
      const [[, r1, , b1, a1]] = atP[i];
      const [[, r2, , b2, a2]] = at1[i];
      const [, r0, , b0, a0] = flat;
      assert.equal(atP[i].length, 1, `band fill ${i}: flat in stargaze but not at paper`);
      assert.ok(r0 - b0 < r1 - b1 && r1 - b1 < r2 - b2, `band style ${i}: warmth ${r0 - b0} / ${r1 - b1} / ${r2 - b2} should increase`);
      assert.ok(a0 < a1 && a1 <= a2, `band style ${i}: alpha ${a0} / ${a1} / ${a2} should increase`);
      assert.ok(r1 - b1 - (r0 - b0) >= 0.5 * (r2 - b2 - (r0 - b0)), `band style ${i}: paper warmth ${r1 - b1} is under half way from ${r0 - b0} to ${r2 - b2}`);
      checked++;
      continue;
    }
    gradients++;
    assert.deepEqual(atP[i].map((x) => x[0]), [0, 0.15, 0.4], `band fill ${i}: paper stops`);
    assert.deepEqual(at1[i].map((x) => x[0]), [0, 0.15, 0.4], `band fill ${i}: stargaze stops`);
    // One alpha per fill, rising with saturation (the stargaze gain).
    for (const f of [atP[i], at1[i]]) assert.ok(f.every((x) => x[4] === f[0][4]), `band fill ${i}: stops disagree on alpha`);
    const [a0, aP, a1] = [flat[4], atP[i][0][4], at1[i][0][4]];
    assert.ok(a0 < aP && aP <= a1, `band fill ${i}: alpha ${a0} / ${aP} / ${a1} should increase`);
    // Every stop warms with saturation, as the whole band did before the
    // gradient, past half way at paper; nothing in the band is bluish (R26:
    // no disc hue without a long-exposure source).
    for (const at of [0.4, 0]) {
      const [w0, wP, w1] = [warmth(flat), warmth(stop(atP[i], at)), warmth(stop(at1[i], at))];
      assert.ok(w0 < wP && wP < w1, `band fill ${i}, stop ${at}: warmth ${w0} / ${wP} / ${w1} should increase`);
      // The band's own curve: at paper it is past half way in hue, where a
      // linear lerp left it (measured) exactly as warm as the grey chart.
      assert.ok(wP - w0 >= 0.5 * (w1 - w0), `band fill ${i}, stop ${at}: paper warmth ${wP} is under half way from ${w0} to ${w1}`);
    }
    for (const f of [atP[i], at1[i]]) for (const st of f) assert.ok(st[1] > st[3], `band fill ${i}: stop ${st} is not warm`);
    // The gold core is warmer than the tan, and the tan beyond it IS the
    // pre-gradient band: the same colour the flat fill drew before task 18.
    assert.ok(warmth(stop(at1[i], 0)) > warmth(stop(at1[i], 0.4)), `band fill ${i}: the core is not warmer than the middle`);
    // Each scene logs the five wash fills, then the five grain fills, and the
    // grain is still the old flat colour of its level.
    assert.deepEqual(stop(at1[i], 0.4).slice(1, 4), at1[i + 5][0].slice(1, 4), `band fill ${i}: the tan stop moved off the old band colour`);
    assert.deepEqual(stop(atP[i], 0.4).slice(1, 4), atP[i + 5][0].slice(1, 4), `band fill ${i}: the paper tan stop moved off the old band colour`);
    checked++;
  }
  assert.ok(checked >= 10, `only ${checked} band fills checked`);
  assert.ok(gradients >= 5, `only ${gradients} band fills are the core-to-disc gradient`);
  assert.equal(SC.bandMix(0), 0);
  assert.equal(SC.bandMix(1), 1);
  assert.ok(SC.bandMix(SC.PAPER_SATURATION) > SC.PAPER_SATURATION, "the band curve must lead the object mix at paper");
});

test("the band's gradient centres on the real galactic core", () => {
  const sgr = byId.get("sgr-a-star");
  assert.equal(L.GALACTIC_CORE.raDeg, sgr.raDeg, "the gradient's centre is not objects.json's Sgr A*");
  assert.equal(L.GALACTIC_CORE.decDeg, sgr.decDeg);
  // The matrix behind the gradient's radius: l = 0 is the defined J2000
  // galactic centre (17h45m37.2s, -28d56m10s), l = 180 its antipode.
  const c = L.galacticToEquatorial(0);
  assert.ok(near(c.raDeg, 266.405, 0.001) && near(c.decDeg, -28.936, 0.001), JSON.stringify(c));
  const anti = L.galacticToEquatorial(180);
  assert.ok(near(anti.raDeg, 86.405, 0.001) && near(anti.decDeg, 28.936, 0.001), JSON.stringify(anti));
});

test("M82 draws identically at every saturation", () => {
  const m82 = data.objects.filter((o) => o.id === "m82");
  const ref = traceLayers({ saturation: 0, stargazeChrome: false }, m82, { milkyWay: false });
  assert.ok(ref.length > 20, "M82 was not drawn in any scene");
  for (const s of [0.01, SC.PAPER_SATURATION, 0.6, 1]) {
    assert.deepEqual(traceLayers({ saturation: s, stargazeChrome: false }, m82, { milkyWay: false }), ref, `M82's draw calls changed at saturation ${s}`);
  }
});

test("saturateRgb: exact at 1, luminance grey at 0, monotone spread between", () => {
  for (const pal of Object.values(L.OBJECT_COLOURS)) {
    for (const rgb of Object.values(pal)) {
      assert.equal(SC.saturateRgb(rgb, 1), rgb);
      const [r, g, b] = SC.saturateRgb(rgb, 0).split(",").map(Number);
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 1, `${rgb} at 0 is ${r},${g},${b}`);
      let prev = -1;
      for (let s = 0; s <= 1.0001; s += 0.05) {
        const c = SC.saturateRgb(rgb, s).split(",").map(Number);
        const spread = Math.max(...c) - Math.min(...c);
        assert.ok(spread >= prev, `${rgb}: spread fell to ${spread} at s=${s.toFixed(2)}`);
        prev = spread;
      }
    }
  }
});

test("stepSaturation: frame-rate independent, no overshoot, settles in about 300ms", () => {
  let a = 0.25;
  let b = 0.25;
  for (let t = 0; t < 120; t += 8) a = SC.stepSaturation(a, 1, 8);
  for (let t = 0; t < 120; t += 40) b = SC.stepSaturation(b, 1, 40);
  assert.ok(Math.abs(a - b) < 1e-9, `8ms frames reached ${a}, 40ms frames ${b}`);
  let s = 0.25;
  let ms = 0;
  while (s !== 1 && ms < 5000) {
    const next = SC.stepSaturation(s, 1, 16);
    assert.ok(next >= s && next <= 1, `overshoot or reversal: ${s} -> ${next}`);
    s = next;
    ms += 16;
  }
  assert.ok(ms >= 200 && ms <= 400, `0.25 -> 1 settled in ${ms}ms`);
  assert.equal(SC.stepSaturation(1, SC.PAPER_SATURATION, 10_000), SC.PAPER_SATURATION);
  assert.ok(SC.PAPER_COLOUR_SHARE > 0 && SC.PAPER_COLOUR_SHARE < 1, "paper mode is a share of stargaze's colour, strictly between none and all");
  assert.equal(SC.PAPER_SATURATION, SC.PAPER_COLOUR_SHARE, "the mix is the share (measured linear; see lib/sky-colour.ts)");
});

// ---- discoverability task 4: stargaze affordances ----

/** True when every line of `sub` appears in `sup`, in order. */
const isSubsequence = (sub, sup) => {
  let i = 0;
  for (const line of sup) if (i < sub.length && line === sub[i]) i++;
  return i === sub.length;
};

test("underlines and phone names are off unless asked for: both recorded ends are unchanged", () => {
  const off = { underlineNames: false, colouredNames: false };
  assert.deepEqual(digestOf(traceLayers({ saturation: 0, stargazeChrome: false, ...off })), TRACE_COLOUR_OFF, "explicit flags off changed the grey chart's calls");
  assert.deepEqual(digestOf(traceLayers({ saturation: 1, stargazeChrome: true, ...off })), TRACE_STARGAZE, "explicit flags off changed the stargaze chart's calls");
});

test("a dotted underline only adds calls: everything else draws exactly as before, in order", () => {
  const base = { saturation: 1, stargazeChrome: true, colouredNames: false };
  const plain = traceLayers({ ...base, underlineNames: false });
  const underlined = traceLayers({ ...base, underlineNames: true });
  const dashes = underlined.filter((l) => l === "setLineDash(1,2)").length;
  assert.ok(dashes > 0, "underlineNames drew no dotted stroke");
  assert.ok(underlined.length > plain.length, "underlineNames added no calls");
  assert.ok(isSubsequence(plain, underlined), "underlineNames changed or reordered a call that was not its own");
});

test("below 880px in stargaze, names draw for the coloured objects and nothing else", () => {
  const w = 400;
  const h = 800;
  const names = new Set(data.objects.map((o) => o.name));
  const drawnNames = (colouredNames) => {
    const log = [];
    const ctx = new Proxy(
      { measureText: (t) => ({ width: t.length * 5.4 }) },
      {
        get: (t, k) => (k in t ? t[k] : (...a) => void log.push([String(k), a])),
        set: () => true,
      },
    );
    let seen = [];
    for (const lst of [0, 90, 180, 270]) {
      const chart = SM.chartFor(w, h, lst);
      const v = { chart, width: w, height: h, fontFamily: "mono", names: false, suppressName: null, saturation: 1, stargazeChrome: true, underlineNames: true, colouredNames };
      const hits = L.drawObjects(ctx, v, data.objects, traceRings, traceGlyphs);
      seen = seen.concat(hits);
    }
    return { fills: log.filter(([k, a]) => k === "fillText" && names.has(a[0])).map(([, a]) => a[0]), hits: seen };
  };
  const off = drawnNames(false);
  assert.equal(off.fills.length, 0, "a phone drew object names with colouredNames off");
  assert.ok(off.hits.every((x) => !x.box), "a phone hit carried a name box with colouredNames off");
  const on = drawnNames(true);
  const colouredNames = new Set(data.objects.filter((o) => Object.hasOwn(L.OBJECT_COLOURS, o.id)).map((o) => o.name));
  assert.ok(on.fills.length > 0, "no coloured object was on a 400x800 screen at any of four orientations");
  for (const n of on.fills) assert.ok(colouredNames.has(n), `a phone drew the name "${n}", which has no palette`);
  for (const hit of on.hits) {
    if (hit.box) assert.ok(Object.hasOwn(L.OBJECT_COLOURS, hit.id), `${hit.id} has a name box on a phone but no palette`);
  }
  assert.equal(on.hits.filter((x) => x.box).length, on.fills.length, "every drawn phone name needs its hit box, and only a drawn one gets one");
});

test("phone names never overlap, never leave the screen, and keep clear of stargaze's hint bar and credit", () => {
  const w = 400;
  const h = 800;
  const ctx = new Proxy({ measureText: (t) => ({ width: t.length * 5.4 }) }, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });
  let named = 0;
  for (let lst = 0; lst < 360; lst += 15) {
    const chart = SM.chartFor(w, h, lst);
    const v = { chart, width: w, height: h, fontFamily: "mono", names: false, suppressName: null, saturation: 1, stargazeChrome: true, underlineNames: true, colouredNames: true };
    const boxes = L.drawObjects(ctx, v, data.objects, traceRings, traceGlyphs).filter((x) => x.box);
    named += boxes.length;
    for (const a of boxes) {
      assert.ok(a.box.x >= 0 && a.box.x + a.box.w <= w + 4, `LST ${lst}: ${a.id}'s name box ${JSON.stringify(a.box)} leaves the 400px screen`);
      assert.ok(a.box.y >= 90 && a.box.y + a.box.h <= h - 130, `LST ${lst}: ${a.id}'s name box ${JSON.stringify(a.box)} reaches the hint bar or the credit`);
      for (const b of boxes) {
        if (a === b) continue;
        const overlap = a.box.x < b.box.x + b.box.w && b.box.x < a.box.x + a.box.w && a.box.y < b.box.y + b.box.h && b.box.y < a.box.y + a.box.h;
        assert.ok(!overlap, `LST ${lst}: phone names ${a.id} and ${b.id} overlap`);
      }
    }
  }
  assert.ok(named > 20, `only ${named} phone names across 24 orientations`);
});

test("entry rings: the four symbols nearest the centre, a half-sine over 1.2 s, static under reduced motion", async () => {
  const R = await import("../components/manuscript/night-sky/entry-rings.ts");
  const hits = [
    { id: "far", x: 0, y: 0 },
    { id: "a", x: 500, y: 400 },
    { id: "band", x: 500, y: 400, boxOnly: true },
    { id: "b", x: 520, y: 400 },
    { id: "c", x: 500, y: 440 },
    { id: "d", x: 450, y: 350 },
    { id: "e", x: 900, y: 700 },
  ];
  assert.deepEqual(R.pickEntryRingIds(hits, 1000, 800), ["a", "b", "c", "d"]);
  assert.equal(R.ENTRY_RING_MS, 1200);
  assert.equal(R.entryRingAlpha(0, false), 0);
  assert.ok(Math.abs(R.entryRingAlpha(600, false) - 1) < 1e-9);
  assert.ok(R.entryRingAlpha(300, false) > 0 && R.entryRingAlpha(900, false) > 0);
  assert.equal(R.entryRingAlpha(1200, false), 0);
  assert.equal(R.entryRingAlpha(0, true), 1);
  assert.equal(R.entryRingAlpha(1199, true), 1);
  assert.equal(R.entryRingAlpha(1200, true), 0);
});
