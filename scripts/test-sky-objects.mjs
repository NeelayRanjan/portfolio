// node --test scripts/test-sky-objects.mjs
// Shape and landmark checks on the COMMITTED public/sky/objects.json and
// public/sky/milkyway.json. prepare-sky-objects.mjs asserts the same things
// before writing; this guards the committed files against hand edits and
// bad regenerations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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

test("every coloured object has a fact that cites its colour source", async () => {
  const { OBJECT_COLOURS } = await import("../lib/sky-layers.ts");
  const { SKY_FACTS } = await import("../content/sky-facts.ts");
  const FACTS = new Map(SKY_FACTS.map((f) => [f.id, f]));
  for (const id of Object.keys(OBJECT_COLOURS)) {
    assert.ok(FACTS.has(id), `${id} has a palette but no card to cite it on`);
    assert.ok(FACTS.get(id).citations.length >= 1, `${id} colour is uncited`);
  }
});
