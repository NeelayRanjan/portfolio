// node --test scripts/test-sky-stars.mjs
// Task 18 (2026-10-01, rulings R23 and R24): the catalog stars to mag 6.0
// and their colour from B-V. Pins lib/star-colour.ts against its two
// published sources, and lib/sky-render.ts's star paint against what it drew
// before the task: the bright stars' fills and radii byte for byte, the faint
// ones smaller and dimmer than the old faintest, and the whole star frame by
// trace digest.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { register } from "node:module";

// Same resolve hook as test-sky-objects.mjs: lib/sky-render.ts imports its
// siblings without an extension, which node's own resolver refuses.
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

const C = await import("../lib/star-colour.ts");
const R = await import("../lib/sky-render.ts");
const SM = await import("../lib/sky-math.ts");
const sky = JSON.parse(await readFile(new URL("../public/sky/sky.json", import.meta.url), "utf8"));

const rgbOf = (s) => s.split(",").map(Number);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test("B-V to temperature is Ballesteros (2012) equation 14", () => {
  const eq14 = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  for (const bv of [-0.3, 0, 0.65, 1.0, 1.85, 3.3]) assert.equal(C.bvToKelvin(bv), eq14(bv));
  // Sanity against what the formula is known to give: the Sun (B-V 0.65)
  // near 5,778 K, Vega-like A0 (0.0) near 10,000 K.
  assert.ok(Math.abs(C.bvToKelvin(0.65) - 5778) < 5);
  assert.ok(Math.abs(C.bvToKelvin(0) - 10125) < 1);
});

test("temperature to colour is Mitchell Charity's blackbody table, unedited", () => {
  // 1000 K to 29800 K in 200 K steps: 145 rows.
  assert.equal(C.BLACKBODY_HEX.length, 145);
  assert.equal(C.BLACKBODY_MIN_K, 1000);
  assert.equal(C.BLACKBODY_STEP_K, 200);
  // Rows read straight off http://www.vendian.org/mncharity/dir3/blackbody/
  // on 2026-10-01, spread across the table.
  const page = { 1000: "ff3800", 3000: "ffb46b", 5800: "fff0e9", 6600: "fef9ff", 10000: "ccdbff", 20000: "a8c5ff", 29800: "9fbfff" };
  for (const [k, hex] of Object.entries(page)) {
    assert.equal(C.BLACKBODY_HEX[(Number(k) - 1000) / 200], hex, `${k} K`);
    const want = [0, 2, 4].map((o) => Number.parseInt(hex.slice(o, o + 2), 16));
    assert.deepEqual(C.kelvinToRgb(Number(k)), want, `${k} K exact on a row`);
  }
  // Between rows: linear per channel; outside the table: clamped.
  const mid = C.kelvinToRgb(1100);
  assert.deepEqual(mid, [255, (0x38 + 0x53) / 2, 0]);
  assert.deepEqual(C.kelvinToRgb(500), C.kelvinToRgb(1000));
  assert.deepEqual(C.kelvinToRgb(40_000), C.kelvinToRgb(29_800));
});

test("star colours keep the temperature's hue and grow warmer with B-V", () => {
  assert.equal(C.starColourRgb(null, 1), null, "no B-V, no colour");
  // Fix round 1 (R26): every drawn colour is a colour of the table, on the
  // blackbody locus between its coolest row (ff3800, 1,000 K) and its
  // hottest (9fbfff, 29,800 K): the push moves a star's TEMPERATURE further
  // from white, clamped to the table, and never leaves the locus.
  const locus = [];
  for (let k = 1000; k <= 29800; k += 10) locus.push(C.kelvinToRgb(k));
  const [hotR, hotG, hotB] = [0x9f, 0xbf, 0xff];
  let checked = 0;
  for (const [, , mag, bv] of sky.stars) {
    if (bv === null) continue;
    const [r, g, b] = rgbOf(C.starColourRgb(bv, mag));
    const off = Math.min(...locus.map(([x, y, z]) => Math.max(Math.abs(x - r), Math.abs(y - g), Math.abs(z - b))));
    assert.ok(off <= 1, `B-V ${bv} mag ${mag}: ${r},${g},${b} is ${off} levels off the table's locus`);
    // Never bluer than the hottest row, never redder than the coolest.
    // As chromaticity ratios (one level of rounding allowed): red over blue
    // no lower than 9fbfff's, green over red no lower than ff3800's.
    assert.ok(r / b >= (hotR - 1) / hotB && g / b >= (hotG - 1) / hotB, `B-V ${bv}: ${r},${g},${b} is bluer than 9fbfff`);
    assert.ok(g / r >= (0x38 - 1) / 0xff, `B-V ${bv}: ${r},${g},${b} is redder than ff3800`);
    checked++;
  }
  assert.equal(checked, sky.stars.length - 2);
  // The push is away from white on the star's own side, and clamped.
  assert.ok(Math.abs(C.displayKelvin(C.WHITE_K, 1.8) - C.WHITE_K) < 1e-6, "white stays white");
  assert.ok(C.displayKelvin(10_000, 1.8) > 10_000 && C.displayKelvin(4_000, 1.8) < 4_000);
  assert.equal(Math.round(C.displayKelvin(25_000, 3)), 29_800);
  assert.equal(Math.round(C.displayKelvin(1_500, 3)), 1_000);
  // Warmth (r - b) never falls as B-V rises.
  let prev = -Infinity;
  for (let bv = -0.3; bv <= 3.3; bv += 0.1) {
    const [r, , b] = rgbOf(C.starColourRgb(bv, 1));
    assert.ok(r - b >= prev, `warmth fell at B-V ${bv.toFixed(1)}`);
    prev = r - b;
  }
  // The owner's named stars, by their sky.json B-V: Rigel blue-white,
  // Betelgeuse and Antares orange-red, Capella and Arcturus yellow-orange.
  const named = (raDeg, decDeg) => sky.stars.find(([ra, dec]) => Math.abs(ra - raDeg) < 0.05 && Math.abs(dec - decDeg) < 0.05);
  const colourOf = (s) => rgbOf(C.starColourRgb(s[3], s[2]));
  const rigel = colourOf(named(78.63, -8.2));
  const betelgeuse = colourOf(named(88.79, 7.41));
  const antares = colourOf(named(247.35, -26.43));
  const capella = colourOf(named(79.17, 46.0));
  const arcturus = colourOf(named(213.92, 19.18));
  assert.ok(rigel[2] - rigel[0] > 60, `Rigel ${rigel}`);
  for (const [n, c] of [["Betelgeuse", betelgeuse], ["Antares", antares]]) assert.ok(c[0] - c[2] > 150 && c[0] > c[1], `${n} ${c}`);
  for (const [n, c] of [["Capella", capella], ["Arcturus", arcturus]]) assert.ok(c[0] - c[2] > 40 && c[0] - c[2] < 190, `${n} ${c}`);
  // No neon: nothing reaches a pure primary.
  for (const c of [rigel, betelgeuse, antares, capella, arcturus]) assert.ok(Math.min(...c) > 40, `${c} is close to a pure primary`);
  // A faint star carries less colour than a bright one of the same B-V.
  for (const bv of [-0.2, 1.6]) {
    const chroma = (mag) => {
      const c = rgbOf(C.starColourRgb(bv, mag));
      return Math.max(...c) - Math.min(...c);
    };
    assert.ok(chroma(6) < chroma(1), `B-V ${bv}: faint ${chroma(6)} vs bright ${chroma(1)}`);
  }
});

/** The pre-task-18 per-star fill, verbatim from lib/sky-render.ts at 13b7aba. */
function oldFill(mag, bv) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const t = clamp((bv + 0.3) / 2.0, 0, 1);
  const mix = (a, b, u) => Math.round(a + (b - a) * u);
  let rgb;
  if (t < 0.45) {
    const u = t / 0.45;
    rgb = `${mix(205, 234, u)},${mix(218, 229, u)},${mix(255, 218, u)}`;
  } else {
    const u = (t - 0.45) / 0.55;
    rgb = `${mix(234, 240, u)},${mix(229, 196, u)},${mix(218, 150, u)}`;
  }
  return { fill: `rgba(${rgb},${clamp(1 - (mag + 1.5) * 0.12, 0.25, 1)})`, radius: clamp(2.1 - 0.32 * mag, 0.5, 2.6) };
}

const paint = R.prepareStarPaint(sky.stars);

test("every star at or brighter than 5.0 paints exactly as before task 18", () => {
  assert.equal(paint.brightCount, sky.stars.filter(([, , m]) => m <= R.FAINT_STAR_MAG).length);
  for (let i = 0; i < paint.brightCount; i++) {
    const [, , mag, bv] = sky.stars[i];
    const old = oldFill(mag, bv ?? 0.6); // the old catalog stored a missing B-V as 0.6
    assert.equal(paint.base[i], old.fill, `star ${i}`);
    assert.equal(paint.radius[i], old.radius, `star ${i}`);
  }
  // Saturation 0 hands those strings back unchanged.
  assert.equal(R.starFillsAt(paint, 0).bright.join("\n"), paint.base.join("\n"));
});

test("every fainter star is in one bucket, smaller and dimmer than the old faintest", () => {
  const seen = new Set();
  let prevMag = -Infinity;
  for (const b of paint.faint) {
    assert.ok(b.mag > R.FAINT_STAR_MAG && b.mag >= prevMag, "buckets sorted by magnitude, all past the cut");
    prevMag = b.mag;
    for (const i of b.stars) {
      assert.ok(!seen.has(i), `star ${i} in two buckets`);
      seen.add(i);
      assert.equal(sky.stars[i][2], b.mag);
    }
  }
  assert.equal(seen.size, sky.stars.length - paint.brightCount, "a faint star is missing from the buckets");
  // The old faintest: a radius-0.5 disc at alpha 0.25, light 0.25 * pi/4.
  const oldLight = 0.25 * Math.PI * 0.25;
  const side = 0.88;
  assert.ok(side * side < Math.PI * 0.25, "the faint square's area is not under the old faintest disc's");
  for (const b of paint.faint) assert.ok(b.alpha * side * side < oldLight, `mag ${b.mag}: light ${b.alpha * side * side} >= ${oldLight}`);
  // Dimmer as they get fainter.
  const byMag = new Map(paint.faint.map((b) => [b.mag, b.alpha]));
  const mags = [...byMag.keys()].sort((a, b) => a - b);
  for (let i = 1; i < mags.length; i++) assert.ok(byMag.get(mags[i]) < byMag.get(mags[i - 1]), `alpha at ${mags[i]}`);
});

test("star fills: the tint at 0, the star's colour at 1, chroma rising between", () => {
  const at1 = R.starFillsAt(paint, 1);
  for (let i = 0; i < paint.brightCount; i++) {
    const full = paint.full[i];
    assert.equal(at1.bright[i], full === null ? paint.base[i] : `rgba(${full},${paint.alpha[i]})`);
  }
  const levels = [0, 0.25, 0.5, 0.75, 1];
  const fills = levels.map((s) => R.starFillsAt(paint, s));
  const spread = (f) => {
    const c = f.match(/rgba\((\d+),(\d+),(\d+),/).slice(1).map(Number);
    return Math.max(...c) - Math.min(...c);
  };
  let grew = 0;
  for (const kind of ["bright", "faint"]) {
    for (let i = 0; i < fills[0][kind].length; i++) {
      for (let j = 1; j < levels.length; j++) {
        assert.ok(spread(fills[j][kind][i]) >= spread(fills[j - 1][kind][i]) - 1, `${kind} ${i}: chroma fell at s=${levels[j]}`);
      }
      if (spread(fills[4][kind][i]) > spread(fills[0][kind][i])) grew++;
    }
  }
  // Bright stars one by one, faint ones per bucket: nearly all gain colour
  // (a star near 6,500 K is white in the table and stays near its tint).
  const items = fills[0].bright.length + fills[0].faint.length;
  assert.ok(grew > 0.9 * items, `only ${grew} of ${items} stars and buckets gained colour`);
});

// ---- the whole star frame, by digest ----
//
// drawSky over five fixed scenes with no objects and no Milky Way (those are
// test-sky-objects.mjs's), so the trace is the desk, graticule, ecliptic,
// constellation lines, every catalog star and the Moon. Recorded 2026-10-01
// AFTER .superpowers/sdd/2026-09-30-slaac-rerouter/task-18-trace-proof.mjs
// showed, against the pre-task-18 modules and catalog, that with the new
// stars' calls removed the saturation-0 frame is byte-identical to the old
// one, and that at saturation 1 the only other change is the old stars' fill
// colours. A changed digest means the stars moved, not that a fixture needs
// refreshing.
const STAR_TRACE_SCENES = [[1600, 1000, 0], [1600, 1000, 90], [1600, 1000, 180], [1600, 1000, 270], [400, 800, 45]];
const STAR_TRACE_OFF = { n: 22208, sha: "0bff6eb0913eb7717f6233f34e2a3bc3c899dc1e90ed7986f3808f890baf04fa" };
// STAR_TRACE_FULL re-recorded in fix round 1 (R26: star colour moved onto
// the blackbody locus); STAR_TRACE_OFF did not change.
const STAR_TRACE_FULL = { n: 22208, sha: "96e1dacecdd8b9614660934455d59e49a84912451bf4661aba15f9cc35ffa546" };
function starTrace(saturation) {
  const log = [];
  const ctx = new Proxy(
    { measureText: (t) => ({ width: t.length * 5.4 }) },
    {
      get: (t, k) => (k in t ? t[k] : (...a) => void log.push(`${String(k)}(${a.join(",")})`)),
      set: (t, k, v) => (log.push(`${String(k)}=${v}`), true),
    },
  );
  for (const [w, h, lst] of STAR_TRACE_SCENES) {
    R.drawSky(ctx, sky, {
      width: w, height: h, chart: SM.chartFor(w, h, lst), magLimit: w < 880 ? 5.5 : 6.0,
      bodies: { planets: [], moon: { raDeg: (lst + 120) % 360, decDeg: 10 }, phase: { litFraction: 0.6, brightLimbDeg: 30 } },
      fontFamily: "mono", highlight: null, avoid: null, starPaint: paint, milkyWay: null, objects: [],
      objectRings: new Map(), objectGlyphs: new Map(), showers: [], names: w >= 880, saturation,
      stargazeChrome: saturation === 1, underlineNames: false, colouredNames: false, entryRings: null,
      oneLiner: () => null, selectedId: null, iss: null,
    });
  }
  return { n: log.length, sha: createHash("sha256").update(log.join("\n")).digest("hex") };
}

test("the star frame matches its recording at saturation 0 and 1", () => {
  assert.deepEqual(starTrace(0), STAR_TRACE_OFF, "the grey chart's star frame changed");
  assert.deepEqual(starTrace(1), STAR_TRACE_FULL, "the stargaze star frame changed");
});

test("every new colour cites its source on the card it shows on", async () => {
  const { SKY_FACTS } = await import("../content/sky-facts.ts");
  const urls = (id) => SKY_FACTS.find((f) => f.id === id).citations.map((c) => c.url);
  // The band's gradient: the yellow bulge (Euclid).
  for (const u of ["https://www.esa.int/ESA_Multimedia/Videos/2026/06/ESA_s_Euclid_captures_the_Milky_Way_s_crowded_heart"]) {
    assert.ok(urls("milky-way").includes(u), `the Milky Way card does not cite ${u}`);
  }
  // Star colour, on the cards that already talk about a star's colour.
  for (const id of ["betelgeuse", "antares"]) {
    for (const u of ["https://arxiv.org/abs/1201.1809", "https://www.vendian.org/mncharity/dir3/blackbody/"]) {
      assert.ok(urls(id).includes(u), `${id} does not cite ${u}`);
    }
  }
});

test("prepareStarPaint refuses a catalog whose bright stars are not a prefix", () => {
  const stars = [[10, 10, 1.0, 0.5], [20, 20, 5.5, 0.5], [30, 30, 4.0, 0.5]];
  assert.throws(() => R.prepareStarPaint(stars), /brightest first/);
  assert.doesNotThrow(() => R.prepareStarPaint([stars[0], stars[2], stars[1]]));
});
