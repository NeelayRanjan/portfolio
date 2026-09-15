#!/usr/bin/env node
/**
 * prepare-sky.mjs: builds public/sky/sky.json, the star catalog behind the
 * night-sky desk (components/manuscript/NightSky.tsx).
 *
 * Hand-run, like prepare-research.mjs: needs the network (GitHub raw at a
 * PINNED commit), never wired to prebuild, output committed.
 *
 *   node scripts/prepare-sky.mjs
 *
 * Sources:
 *   - d3-celestial (BSD-3-Clause) at COMMIT: stars.6.json (Extended
 *     Hipparcos Compilation, Anderson & Francis 2012), constellations.json
 *     (IAU names + label anchors), constellations.lines.json (IAU lines).
 *   - English meanings: NOT d3-celestial's `en` field, which is not a
 *     translation (it calls Ursa Major "Big Dipper", an asterism). They are
 *     transcribed below from the "Meaning" column of Wikipedia's "IAU
 *     designated constellations" table (accessed 2026-09-14), shortened and
 *     title-cased. Meanings that are a mythological figure, or that would
 *     repeat the Latin (Lynx, Phoenix, Sculptor), are null: the label then
 *     shows the Latin alone.
 *
 * Assert-before-write: every check runs on the assembled object and nothing
 * is written if any fails.
 */
import { mkdir, writeFile } from "node:fs/promises";

const COMMIT = "7e720a3de062059d4c5400a379146a601d9010e0";
const REPO = "https://github.com/ofrohn/d3-celestial";
const RAW = `https://raw.githubusercontent.com/ofrohn/d3-celestial/${COMMIT}/data`;
/** The BSD-3-Clause notice requires redistributing the copyright line, not
 *  just naming the license. Verbatim from the repo's LICENSE at COMMIT:
 *  https://raw.githubusercontent.com/ofrohn/d3-celestial/7e720a3de062059d4c5400a379146a601d9010e0/LICENSE
 *  (fetched by hand, not at build time — the same pin as the data files above). */
const D3_CELESTIAL_COPYRIGHT = "Copyright (c) 2015, Olaf Frohn";
const MAG_LIMIT = 5.0;
const OUT_DIR = new URL("../public/sky/", import.meta.url);
const OUT = new URL("sky.json", OUT_DIR);

const ENGLISH = {
  And: null, Ant: "Air Pump", Aps: "Bird of Paradise", Aqr: "Water Bearer",
  Aql: "Eagle", Ara: "Altar", Ari: "Ram", Aur: "Charioteer", Boo: "Herdsman",
  Cae: "Chisel", Cam: "Giraffe", Cnc: "Crab", CVn: "Hunting Dogs",
  CMa: "Greater Dog", CMi: "Lesser Dog", Cap: "Sea Goat", Car: "Keel",
  Cas: null, Cen: "Centaur", Cep: null, Cet: "Sea Monster", Cha: "Chameleon",
  Cir: "Compasses", Col: "Dove", Com: "Berenice’s Hair", CrA: "Southern Crown",
  CrB: "Northern Crown", Crv: "Crow", Crt: "Mixing Bowl", Cru: "Cross",
  Cyg: "Swan", Del: "Dolphin", Dor: "Dolphinfish", Dra: "Dragon", Equ: "Pony",
  Eri: "River", For: "Furnace", Gem: "Twins", Gru: "Crane", Her: null,
  Hor: "Pendulum Clock", Hya: null, Hyi: "Lesser Water Snake", Ind: "Indian",
  Lac: "Lizard", Leo: "Lion", LMi: "Lesser Lion", Lep: "Hare", Lib: "Balance",
  Lup: "Wolf", Lyn: null, Lyr: "Lyre", Men: "Table Mountain",
  Mic: "Microscope", Mon: "Unicorn", Mus: "Fly", Nor: "Carpenter’s Level",
  Oct: "Octant", Oph: "Serpent Bearer", Ori: null, Pav: "Peacock", Peg: null,
  Per: null, Phe: null, Pic: "Painter", Psc: "Fishes", PsA: "Southern Fish",
  Pup: "Poop Deck", Pyx: "Mariner’s Compass", Ret: "Reticle", Sge: "Arrow",
  Sgr: "Archer", Sco: "Scorpion", Scl: null, Sct: "Shield", Ser: "Snake",
  Sex: "Sextant", Tau: "Bull", Tel: "Telescope", Tri: "Triangle",
  TrA: "Southern Triangle", Tuc: "Toucan", UMa: "Great Bear",
  UMi: "Lesser Bear", Vel: "Sails", Vir: "Maiden", Vol: "Flying Fish",
  Vul: "Little Fox",
};

function fail(msg) {
  console.error(`prepare-sky: ${msg}. Nothing written.`);
  process.exit(1);
}

async function getJson(name) {
  const res = await fetch(`${RAW}/${name}`);
  if (!res.ok) fail(`${name}: HTTP ${res.status}`);
  return res.json();
}

const ra360 = (lon) => ((lon % 360) + 360) % 360;
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

const [starsGeo, consGeo, linesGeo] = await Promise.all([
  getJson("stars.6.json"),
  getJson("constellations.json"),
  getJson("constellations.lines.json"),
]);

// Stars: mag cut, brightest first. A missing B-V (one star at this cut) gets
// 0.6, a neutral white: the tint is decoration, never a claim.
const stars = starsGeo.features
  .filter((f) => f.properties.mag <= MAG_LIMIT)
  .map((f) => {
    const bv = Number.parseFloat(f.properties.bv);
    return [
      r2(ra360(f.geometry.coordinates[0])),
      r2(f.geometry.coordinates[1]),
      r1(f.properties.mag),
      r1(Number.isFinite(bv) ? bv : 0.6),
    ];
  })
  .sort((a, b) => a[2] - b[2]);

// Lines: Serpens arrives as two features with the same id; concatenating the
// polylines under one key IS the merge.
const lines = {};
for (const f of linesGeo.features) {
  if (f.geometry.type !== "MultiLineString") fail(`${f.id}: geometry ${f.geometry.type}`);
  const polylines = f.geometry.coordinates.map((pl) =>
    pl.map(([lon, lat]) => [r2(ra360(lon)), r2(lat)]),
  );
  (lines[f.id] ??= []).push(...polylines);
}

// Names + label anchors: Serpens keeps both halves' anchors.
const constellations = {};
for (const f of consGeo.features) {
  const label = [r2(ra360(f.geometry.coordinates[0])), r2(f.geometry.coordinates[1])];
  if (constellations[f.id]) {
    constellations[f.id].labels.push(label);
    continue;
  }
  if (!Object.hasOwn(ENGLISH, f.id)) fail(`no English entry for ${f.id}`);
  constellations[f.id] = {
    latin: f.id === "Ser" ? "Serpens" : f.properties.name,
    english: ENGLISH[f.id],
    labels: [label],
  };
}

const sky = {
  version: 1,
  epoch: "J2000",
  source: {
    repo: REPO,
    commit: COMMIT,
    license: "BSD-3-Clause (d3-celestial); stars from the Extended Hipparcos Compilation (Anderson & Francis 2012)",
    copyright: D3_CELESTIAL_COPYRIGHT,
    meanings: "https://en.wikipedia.org/wiki/IAU_designated_constellations",
    accessed: "2026-09-14",
  },
  stars,
  lines,
  constellations,
};

// ---- assert before write ----
const abbrs = Object.keys(constellations);
if (abbrs.length !== 88) fail(`${abbrs.length} constellations, expected 88`);
if (Object.keys(ENGLISH).length !== 88) fail("ENGLISH table is not 88 entries");
for (const a of Object.keys(ENGLISH)) if (!constellations[a]) fail(`ENGLISH has unknown ${a}`);
for (const a of abbrs) {
  if (!lines[a]?.length) fail(`${a} has no lines`);
  if (constellations[a].english === constellations[a].latin) fail(`${a} english duplicates latin`);
}
for (const a of Object.keys(lines)) if (!constellations[a]) fail(`lines for unknown ${a}`);
if (constellations.UMa.latin !== "Ursa Major" || constellations.UMa.english !== "Great Bear")
  fail("UMa names wrong");
if (!sky.source.copyright?.includes("Olaf Frohn")) fail("source.copyright is missing or wrong");
if (constellations.Ser.labels.length !== 2) fail("Serpens did not merge to two anchors");
if (stars.length < 1500 || stars.length > 1750) fail(`${stars.length} stars at mag <= ${MAG_LIMIT}`);
const polaris = stars.find(([, dec]) => dec > 89);
if (!polaris || Math.abs(polaris[1] - 89.26) > 0.1) fail("Polaris missing or misplaced");
const sirius = stars[0];
if (Math.abs(sirius[0] - 101.29) > 0.1 || Math.abs(sirius[1] + 16.72) > 0.1 || sirius[2] > -1.3)
  fail(`brightest star is not Sirius: ${JSON.stringify(sirius)}`);
const body = JSON.stringify(sky);
if (body.length >= 70_000) fail(`sky.json would be ${body.length} bytes`);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, body);
console.log(
  `prepare-sky: wrote public/sky/sky.json (${body.length} bytes): ${stars.length} stars, ` +
    `${abbrs.length} constellations, ${Object.values(lines).reduce((n, pls) => n + pls.length, 0)} polylines`,
);
