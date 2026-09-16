#!/usr/bin/env node
/**
 * prepare-sky-objects.mjs: builds the two data files behind the night sky's
 * objects layer (spec docs/superpowers/specs/2026-09-15-sky-objects-design.md
 * §4, §9):
 *
 *   public/sky/objects.json   deep-sky picks, landmarks, the named stars, the
 *                             Voyagers, the meteor showers and the
 *                             constellation origin table
 *   public/sky/milkyway.json  the Milky Way band, simplified
 *
 * Hand-run, like prepare-sky.mjs: needs the network, never wired to prebuild,
 * outputs committed.
 *
 *   node scripts/prepare-sky-objects.mjs
 *
 * Sources (every one pinned or dated):
 *   - d3-celestial (BSD-3-Clause) at COMMIT: messier.json, mw.json,
 *     starnames.json, stars.6.json.
 *   - JPL Horizons API: Voyager 1 (-31) and Voyager 2 (-32), geocentric
 *     astrometric RA/Dec (ICRF, which is J2000 to far better than a pixel) and
 *     distance, for the day the script runs. The date is written into the
 *     output and the cards say it.
 *   - IMO 2026 Meteor Shower Calendar, Table 5 (Working List of Visual Meteor
 *     Showers). imo.net was offline when this was written, so the source is
 *     the Wayback Machine copy at IMO_PDF, checked by SHA-256 below. SHOWERS is
 *     transcribed from it by hand; the assertions after it catch a mistyped
 *     date or solar longitude.
 *   - Parent bodies: the IMO calendar's own text where it names one, NASA
 *     Science's shower pages ("Fast Facts") otherwise, Wikipedia's "Ursids"
 *     article (pinned revision) for the one neither covers. Per shower in
 *     SHOWERS[].parentSource.
 *   - Constellation origins: the Year / Discoverer / Split from columns of
 *     Wikipedia's "IAU designated constellations" table, parsed from the
 *     wikitext of the pinned revision WIKI_REVISION (checked by SHA-256), never
 *     hand-typed.
 *
 * Assert-before-write: everything is fetched, assembled and checked first;
 * nothing is written if any check fails.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as Astronomy from "astronomy-engine";

const COMMIT = "7e720a3de062059d4c5400a379146a601d9010e0";
const REPO = "https://github.com/ofrohn/d3-celestial";
const RAW = `https://raw.githubusercontent.com/ofrohn/d3-celestial/${COMMIT}/data`;
/** Verbatim from d3-celestial's LICENSE at COMMIT (BSD-3 requires the notice). */
const D3_CELESTIAL_COPYRIGHT = "Copyright (c) 2015, Olaf Frohn";

const WIKI_REVISION = 1373165890;
const WIKI_RAW = `https://en.wikipedia.org/w/index.php?title=IAU_designated_constellations&action=raw&oldid=${WIKI_REVISION}`;
const WIKI_PAGE = `https://en.wikipedia.org/w/index.php?title=IAU_designated_constellations&oldid=${WIKI_REVISION}`;
const WIKI_SHA256 = "b2a22176359234614002fbf7ca177dfd0c4d10ea2346d71f2723827b6e9c45b5";

const IMO_PDF = "https://web.archive.org/web/20260905025331id_/https://www.imo.net/files/meteor-shower/cal2026.pdf";
const IMO_SHA256 = "fde5388889ebda9fe13436d793da5e9935ae46b99edf20e0b19f7fe32ce1ed9f";

const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api";
const UA = "neelayranjan.dev scripts/prepare-sky-objects.mjs (hand-run build script)";

const OUT_DIR = new URL("../public/sky/", import.meta.url);
const SKY_JSON = new URL("sky.json", OUT_DIR);

const D2R = Math.PI / 180;
const ra360 = (lon) => ((lon % 360) + 360) % 360;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r5 = (v) => Math.round(v * 1e5) / 1e5;

function fail(msg) {
  console.error(`prepare-sky-objects: ${msg}. Nothing written.`);
  process.exit(1);
}

/** GET with a user agent and up to three tries (Wayback rate-limits bursts). */
async function get(url, as) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": UA } });
    } catch (err) {
      res = { ok: false, status: String(err) };
    }
    if (res.ok) {
      if (as === "json") return res.json();
      if (as === "bytes") return Buffer.from(await res.arrayBuffer());
      return res.text();
    }
    if (attempt >= 3) fail(`${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 10_000 * attempt));
  }
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/* ---------------------------------------------------------------------- */
/* Transcribed tables                                                      */
/* ---------------------------------------------------------------------- */

/** The ten Messier favourites (spec §4). Names are the common English names. */
const MESSIER = {
  M1: { id: "m1", name: "Crab Nebula" },
  M8: { id: "m8", name: "Lagoon Nebula" },
  M13: { id: "m13", name: "Hercules Cluster" },
  M31: { id: "m31", name: "Andromeda Galaxy" },
  M42: { id: "m42", name: "Orion Nebula" },
  M44: { id: "m44", name: "Beehive Cluster" },
  M45: { id: "m45", name: "Pleiades" },
  M51: { id: "m51", name: "Whirlpool Galaxy" },
  M57: { id: "m57", name: "Ring Nebula" },
  M87: { id: "m87", name: "M87" },
};
/**
 * Eight more Messier picks added for the colour round
 * (docs/superpowers/sdd/sky-colour/task-1-brief.md, task 1). Kept as a
 * second table, processed by a second `addMessierPicks` call below rather
 * than merged into `MESSIER` above, so the original ten objects keep their
 * exact position in `objects` and the diff against the committed
 * objects.json shows only additions at the end.
 */
const MESSIER_2 = {
  M16: { id: "m16", name: "Eagle Nebula" },
  M20: { id: "m20", name: "Trifid Nebula" },
  M27: { id: "m27", name: "Dumbbell Nebula" },
  M33: { id: "m33", name: "Triangulum Galaxy" },
  M78: { id: "m78", name: "M78" },
  M81: { id: "m81", name: "Bode's Galaxy" },
  M82: { id: "m82", name: "Cigar Galaxy" },
  M104: { id: "m104", name: "Sombrero Galaxy" },
};
/**
 * Non-Messier deep-sky picks (same colour-round task): four from
 * `dsos.6.json` (Horsehead, Flame, the Double Cluster pair, North America)
 * and the Veil pair from `dsos.14.json`, since `dsos.6.json` does not carry
 * the Veil despite the "6" nominally naming a limiting magnitude (NGC
 * 2024's own nominal mag of `"999"` in `dsos.6.json` shows that isn't a
 * hard filter either). Keyed by the dsos feature's `desig`.
 *
 * dsos entries carry no name field. `name` here is either the
 * dsonames.json join (checked in the assert-before-write section below) or
 * a hand label: dsonames.json names the Double Cluster's and the Veil's
 * individual pieces ("h Persei", "χ Persei", "Filamentary Nebula", "East
 * Veil Nebula"), never the popular pair name, so "Double Cluster" and
 * "Veil Nebula" below are hand-typed, the same way some Messier `name`s
 * above are hand-typed rather than read verbatim from `alt`. The Double
 * Cluster and the Veil are each represented as two separate sourced
 * objects (real, independently-catalogued positions), never a fabricated
 * midpoint.
 */
const DSOS6_PICKS = {
  "B 33": { id: "horsehead" },
  "NGC 2024": { id: "flame" },
  "NGC 869": { id: "ngc869", name: "Double Cluster (h Persei)" },
  "NGC 884": { id: "ngc884", name: "Double Cluster (χ Persei)" },
  "NGC 7000": { id: "ngc7000" },
};
const DSOS14_PICKS = {
  "NGC 6960": { id: "ngc6960", name: "Veil Nebula (west)" },
  "NGC 6992": { id: "ngc6992", name: "Veil Nebula (east)" },
};
/**
 * A dsos `mag` at or above this is d3-celestial's own "not meaningfully
 * measured" sentinel (NGC 2024 carries the literal string "999" in
 * dsos.6.json), not a real magnitude, and must never reach a card.
 */
const DSOS_MAG_SENTINEL = 900;
/** d3-celestial `type` codes: galaxies draw as an ellipse, nebulae and remnants a dotted circle, clusters a ring of dots. */
const SYMBOL_FOR_TYPE = {
  s: "galaxy", e: "galaxy", i: "galaxy",
  snr: "nebula", sfr: "nebula", pn: "nebula", rn: "nebula",
  // dn (dark nebula, Horsehead/B33) and bn (bright nebula, North America/NGC
  // 7000) added for the colour round's dsos.6.json picks: absent from the
  // original table, which only ever saw messier.json's narrower type set.
  dn: "nebula", bn: "nebula",
  oc: "cluster", gc: "cluster",
};

/** The 15 named bright stars (spec §4), by Hipparcos number. */
const NAMED_STARS = [
  ["polaris", "Polaris", 11767], ["sirius", "Sirius", 32349], ["arcturus", "Arcturus", 69673],
  ["vega", "Vega", 91262], ["capella", "Capella", 24608], ["rigel", "Rigel", 24436],
  ["procyon", "Procyon", 37279], ["betelgeuse", "Betelgeuse", 27989], ["altair", "Altair", 97649],
  ["aldebaran", "Aldebaran", 21421], ["antares", "Antares", 80763], ["spica", "Spica", 65474],
  ["pollux", "Pollux", 37826], ["deneb", "Deneb", 102098], ["regulus", "Regulus", 49669],
];

const NASA_SHOWER = (slug) => `https://science.nasa.gov/solar-system/meteors-meteorites/${slug}/`;
const URSIDS_WIKI = "https://en.wikipedia.org/w/index.php?title=Ursids&oldid=1328535157";

/**
 * IMO 2026 calendar, Table 5, transcribed. Dates are MM-DD; `start` after
 * `end` means the window wraps the new year. solarLongitudeDeg is Table 5's
 * λ⊙ (J2000.0). Radiants are the tabulated peak positions (radiant drift is
 * ignored, and the cards say so).
 */
const SHOWERS = [
  { id: "quadrantids", name: "Quadrantids", imo: "010 QUA", start: "12-28", end: "01-12", peak: "01-03", solarLongitudeDeg: 283.15, radiantRaDeg: 230, radiantDecDeg: 49, speedKmS: 41, zhr: 80, parent: "2003 EH1", parentSource: NASA_SHOWER("quadrantids") },
  { id: "lyrids", name: "April Lyrids", imo: "006 LYR", start: "04-14", end: "04-30", peak: "04-22", solarLongitudeDeg: 32.32, radiantRaDeg: 271, radiantDecDeg: 34, speedKmS: 49, zhr: 18, parent: "C/1861 G1 (Thatcher)", parentSource: IMO_PDF },
  { id: "eta-aquariids", name: "η-Aquariids", imo: "031 ETA", start: "04-19", end: "05-28", peak: "05-06", solarLongitudeDeg: 45.5, radiantRaDeg: 338, radiantDecDeg: -1, speedKmS: 66, zhr: 50, parent: "1P/Halley", parentSource: NASA_SHOWER("eta-aquarids") },
  { id: "southern-delta-aquariids", name: "Southern δ-Aquariids", imo: "005 SDA", start: "07-12", end: "08-23", peak: "07-31", solarLongitudeDeg: 128, radiantRaDeg: 340, radiantDecDeg: -16, speedKmS: 41, zhr: 25, parent: "96P/Machholz (suspected)", parentSource: NASA_SHOWER("delta-aquariids") },
  { id: "perseids", name: "Perseids", imo: "007 PER", start: "07-17", end: "08-24", peak: "08-13", solarLongitudeDeg: 140.0, radiantRaDeg: 48, radiantDecDeg: 58, speedKmS: 59, zhr: 100, parent: "109P/Swift-Tuttle", parentSource: IMO_PDF },
  { id: "draconids", name: "Draconids", imo: "009 DRA", start: "10-06", end: "10-10", peak: "10-09", solarLongitudeDeg: 195.4, radiantRaDeg: 262, radiantDecDeg: 54, speedKmS: 20, zhr: 5, parent: "21P/Giacobini-Zinner", parentSource: IMO_PDF },
  { id: "southern-taurids", name: "Southern Taurids", imo: "002 STA", start: "09-20", end: "11-20", peak: "11-05", solarLongitudeDeg: 223, radiantRaDeg: 52, radiantDecDeg: 15, speedKmS: 27, zhr: 7, parent: "2P/Encke", parentSource: IMO_PDF },
  { id: "orionids", name: "Orionids", imo: "008 ORI", start: "10-02", end: "11-07", peak: "10-21", solarLongitudeDeg: 208, radiantRaDeg: 95, radiantDecDeg: 16, speedKmS: 66, zhr: 20, parent: "1P/Halley", parentSource: NASA_SHOWER("orionids") },
  { id: "northern-taurids", name: "Northern Taurids", imo: "017 NTA", start: "10-20", end: "12-10", peak: "11-12", solarLongitudeDeg: 230, radiantRaDeg: 58, radiantDecDeg: 22, speedKmS: 29, zhr: 5, parent: "2P/Encke", parentSource: IMO_PDF },
  { id: "leonids", name: "Leonids", imo: "013 LEO", start: "11-06", end: "11-30", peak: "11-17", solarLongitudeDeg: 235.27, radiantRaDeg: 152, radiantDecDeg: 22, speedKmS: 71, zhr: 15, parent: "55P/Tempel-Tuttle", parentSource: IMO_PDF },
  { id: "geminids", name: "Geminids", imo: "004 GEM", start: "12-04", end: "12-20", peak: "12-14", solarLongitudeDeg: 262.2, radiantRaDeg: 112, radiantDecDeg: 33, speedKmS: 35, zhr: 150, parent: "3200 Phaethon", parentSource: NASA_SHOWER("geminids") },
  { id: "ursids", name: "Ursids", imo: "015 URS", start: "12-17", end: "12-26", peak: "12-22", solarLongitudeDeg: 270.7, radiantRaDeg: 217, radiantDecDeg: 76, speedKmS: 33, zhr: 10, parent: "8P/Tuttle", parentSource: URSIDS_WIKI },
];

/**
 * Horizons was down (every query, including JPL's own documented example,
 * returned an internal server error: "wldini(): missing required file
 * LTKERNL" / "ERROR in VLRDC: Var not declared: IP_ADDR") when this
 * fallback was added. Rather than fabricate a position, these are REAL
 * Horizons rows, recorded by hand from successful queries made earlier the
 * same day, using this script's exact query shape (EPHEM_TYPE=OBSERVER,
 * CENTER='500@399', QUANTITIES='1,20'). They feed the SAME `parseHorizons`
 * regex the live path uses, so the parsing is exercised either way.
 *
 * Voyager 1 (COMMAND '-31'): the controller's own raw row, recorded at
 * 2026-09-15 00:00 UT.
 * Voyager 2 (COMMAND '-32'): the planner recorded RA 20h10m08.13s, Dec
 * -59°47'07.4", delta 143.56 au at the same instant, but not the full raw
 * row — no deldot (range-rate) figure was captured. The row below is built
 * from those values; the trailing number is an unused placeholder, because
 * parseHorizons() only reads delta (its 9th capture group) and discards
 * deldot (the 10th) entirely.
 */
const RECORDED_HORIZONS = {
  queried: "2026-09-15T00:00Z",
  v1: { row: " 2026-Sep-15 00:00     17 14 28.41 +12 14 16.3  171.826720347160  40.9496750" },
  v2: { row: " 2026-Sep-15 00:00     20 10 08.13 -59 47 07.4  143.560000000000   0.0000000" }, // deldot unused/placeholder
};

/* ---------------------------------------------------------------------- */
/* Fetch                                                                   */
/* ---------------------------------------------------------------------- */

const [messier, mw, starnames, stars6, dsos6, dsos14, dsonames, wikitext, imoPdf, skyJson] = await Promise.all([
  get(`${RAW}/messier.json`, "json"),
  get(`${RAW}/mw.json`, "json"),
  get(`${RAW}/starnames.json`, "json"),
  get(`${RAW}/stars.6.json`, "json"),
  get(`${RAW}/dsos.6.json`, "json"),
  get(`${RAW}/dsos.14.json`, "json"),
  get(`${RAW}/dsonames.json`, "json"),
  get(WIKI_RAW, "text"),
  get(IMO_PDF, "bytes"),
  readFile(SKY_JSON, "utf8").then(JSON.parse),
]);

if (sha256(Buffer.from(wikitext, "utf8")) !== WIKI_SHA256) fail(`Wikipedia revision ${WIKI_REVISION} bytes changed`);
if (sha256(imoPdf) !== IMO_SHA256) fail("the archived IMO 2026 calendar is not the PDF SHOWERS was transcribed from");

const today = new Date();
const QUERY_DATE = today.toISOString().slice(0, 10);
const NEXT_DATE = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

function horizonsUrl(command) {
  const q = new URLSearchParams({
    format: "text",
    COMMAND: `'${command}'`,
    EPHEM_TYPE: "OBSERVER",
    CENTER: "'500@399'",
    START_TIME: `'${QUERY_DATE}'`,
    STOP_TIME: `'${NEXT_DATE}'`,
    STEP_SIZE: "'1d'",
    QUANTITIES: "'1,20'",
    OBJ_DATA: "'NO'",
  });
  return `${HORIZONS}?${q}`;
}

/** First row between $$SOE and $$EOE: RA h m s, Dec d m s, delta (au). */
function parseHorizons(text, label) {
  const soe = text.indexOf("$$SOE");
  const eoe = text.indexOf("$$EOE");
  if (soe < 0 || eoe < soe) fail(`${label}: no $$SOE/$$EOE block in the Horizons reply`);
  const row = text.slice(soe + 5, eoe).trim().split("\n")[0];
  const m = row.match(
    /^(\d{4}-[A-Za-z]{3}-\d{2}) \d{2}:\d{2}\s+(?:[^\d\s+-]{1,2}\s+)?(\d{2}) (\d{2}) ([\d.]+) ([+-])(\d{2}) (\d{2}) ([\d.]+)\s+([\d.]+)\s+(-?[\d.]+)/,
  );
  if (!m) fail(`${label}: unparsed Horizons row "${row}"`);
  const [, , h, mi, s, sign, d, dm, ds, delta] = m;
  const raDeg = 15 * (Number(h) + Number(mi) / 60 + Number(s) / 3600);
  const decDeg = (sign === "-" ? -1 : 1) * (Number(d) + Number(dm) / 60 + Number(ds) / 3600);
  return { raDeg: r5(raDeg), decDeg: r5(decDeg), distanceAu: r2(Number(delta)) };
}

/** The first line of a Horizons error body worth showing a human: skips the
 *  two "API VERSION"/"API SOURCE" banner lines every reply carries. */
function firstErrorLine(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => !/^API (VERSION|SOURCE):/.test(l)) ?? lines[0] ?? "empty response";
}

/**
 * Live Horizons first; on any failure (network error, non-2xx, or a 200
 * whose body has no $$SOE/$$EOE block, e.g. the LTKERNL server error) falls
 * back to the RECORDED row for `command`, run through the same parser so
 * both paths are exercised the same way. Never silently retries forever:
 * three quick attempts (Wayback-style backoff isn't warranted here, this
 * endpoint doesn't rate-limit) before giving up on live and using the record.
 */
async function fetchVoyager(command, label, recorded) {
  const url = horizonsUrl(command);
  let liveText = null;
  let failNote = null;
  for (let attempt = 1; attempt <= 3 && liveText === null; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": UA } });
    } catch (err) {
      failNote = String(err);
      res = null;
    }
    if (res) {
      if (!res.ok) {
        failNote = `HTTP ${res.status}`;
      } else {
        const text = await res.text();
        if (text.includes("$$SOE") && text.includes("$$EOE")) {
          liveText = text;
          break;
        }
        failNote = firstErrorLine(text);
      }
    }
    if (liveText === null && attempt < 3) await new Promise((r) => setTimeout(r, 5_000 * attempt));
  }
  if (liveText !== null) return { ...parseHorizons(liveText, label), mode: "live" };

  console.error(`prepare-sky-objects: WARNING live Horizons query for ${label} failed (${failNote}); using the recorded row from ${RECORDED_HORIZONS.queried}.`);
  const syntheticText = `$$SOE\n${recorded.row}\n$$EOE`;
  return { ...parseHorizons(syntheticText, label), mode: "recorded", note: `live query failed on ${QUERY_DATE}: ${failNote}` };
}

const v1 = await fetchVoyager(-31, "Voyager 1", RECORDED_HORIZONS.v1);
const v2 = await fetchVoyager(-32, "Voyager 2", RECORDED_HORIZONS.v2);
const horizonsMode = v1.mode === "live" && v2.mode === "live" ? "live" : "recorded";
const horizonsNote = [v1.note, v2.note].filter(Boolean);
const horizonsNoteUnique = [...new Set(horizonsNote)].join(" | ") || undefined;
// The Voyagers move enough in a day to matter to a screen pixel but not to
// the 0.1° gate the tests apply; a same-day recording is close enough to be
// honest. When recorded, the card's date is the day the position was
// actually true, not the day the script happened to run.
const voyagerPositionDate = (v) => (v.mode === "recorded" ? RECORDED_HORIZONS.queried.slice(0, 10) : QUERY_DATE);

/* ---------------------------------------------------------------------- */
/* Assemble                                                                */
/* ---------------------------------------------------------------------- */

const objects = [];

function addMessierPicks(table) {
  for (const [name, pick] of Object.entries(table)) {
    const f = messier.features.find((x) => x.properties.name === name);
    if (!f) fail(`${name} missing from messier.json`);
    const { type, dim, desig, mag } = f.properties;
    const symbol = SYMBOL_FOR_TYPE[type];
    if (!symbol) fail(`${name}: unknown d3-celestial type "${type}"`);
    const [a, b] = String(dim).split("x").map(Number);
    objects.push({
      id: pick.id,
      name: pick.name,
      designation: desig ? `${name} · ${desig}` : name,
      symbol,
      raDeg: r5(ra360(f.geometry.coordinates[0])),
      decDeg: r5(f.geometry.coordinates[1]),
      mag,
      // Galaxy ellipse axis ratio from the catalog's size, clamped so a thin
      // disc still reads as an ellipse at 8px. A symbol, not a picture.
      ...(symbol === "galaxy" ? { axisRatio: r2(Math.min(1, Math.max(0.35, b && a ? b / a : 1))) } : {}),
    });
  }
}
addMessierPicks(MESSIER);

// Sagittarius A*, J2000 (spec §4): RA 17h45m40.04s, Dec −29°00′28.1″.
objects.push({
  id: "sgr-a-star",
  name: "Galactic core",
  designation: "Sagittarius A*",
  symbol: "core",
  raDeg: r5(15 * (17 + 45 / 60 + 40.04 / 3600)),
  decDeg: r5(-(29 + 0 / 60 + 28.1 / 3600)),
});

// Kepler field (spec §4): centre RA 19h22m40s, Dec +44°30′; a circle of the
// same ~115 deg² area. On a sphere, area = 2π(1 − cos r) steradians.
const KEPLER_AREA_DEG2 = 115;
const keplerRadiusDeg = Math.acos(1 - (KEPLER_AREA_DEG2 * D2R * D2R) / (2 * Math.PI)) / D2R;
objects.push({
  id: "kepler-field",
  name: "Kepler field (approximate outline)",
  symbol: "field",
  raDeg: r5(15 * (19 + 22 / 60 + 40 / 3600)),
  decDeg: 44.5,
  radiusDeg: r2(keplerRadiusDeg),
});

// Hubble Deep Field (spec §4): RA 12h36m49.4s, Dec +62°12′58″ (J2000).
objects.push({
  id: "hubble-deep-field",
  name: "Hubble Deep Field",
  designation: "HDF",
  symbol: "square",
  raDeg: r5(15 * (12 + 36 / 60 + 49.4 / 3600)),
  decDeg: r5(62 + 12 / 60 + 58 / 3600),
});

objects.push({
  id: "voyager-1", name: "Voyager 1", symbol: "chevron",
  raDeg: v1.raDeg, decDeg: v1.decDeg, distanceAu: v1.distanceAu,
  positionDate: voyagerPositionDate(v1),
});
objects.push({
  id: "voyager-2", name: "Voyager 2", symbol: "chevron",
  raDeg: v2.raDeg, decDeg: v2.decDeg, distanceAu: v2.distanceAu,
  positionDate: voyagerPositionDate(v2),
});

const starById = new Map(stars6.features.map((f) => [f.id, f]));
for (const [id, name, hip] of NAMED_STARS) {
  const entry = starnames[String(hip)];
  if (!entry || entry.name !== name) fail(`starnames.json HIP ${hip} is "${entry?.name}", expected ${name}`);
  const star = starById.get(hip);
  if (!star) fail(`${name} (HIP ${hip}) missing from stars.6.json`);
  objects.push({
    id,
    name,
    designation: `${entry.desig} ${entry.c} · HIP ${hip}`,
    symbol: "star",
    raDeg: r5(ra360(star.geometry.coordinates[0])),
    decDeg: r5(star.geometry.coordinates[1]),
    mag: star.properties.mag,
    hip,
  });
}

/**
 * The eight new Messier picks and the seven dsos picks (colour round, task
 * 1), added here, after the original 30 pushes, so the existing objects
 * keep their exact array position and the diff against the committed
 * objects.json shows only additions at the end.
 */
addMessierPicks(MESSIER_2);

function addDsosPicks(features, picks, fileLabel) {
  for (const [desig, pick] of Object.entries(picks)) {
    const f = features.find((x) => x.properties.desig === desig);
    if (!f) fail(`${desig} missing from ${fileLabel}`);
    const { type, mag } = f.properties;
    const symbol = SYMBOL_FOR_TYPE[type];
    if (!symbol) fail(`${desig}: unknown d3-celestial type "${type}"`);
    const joinedName = dsonames[desig]?.name;
    if (!pick.name && !joinedName) fail(`${desig}: no dsonames.json entry and no hand label`);
    const numericMag = Number(mag);
    // A DARK nebula has no meaningful magnitude: it emits nothing, it is a
    // silhouette against whatever lies behind it. d3-celestial still carries a
    // number in the field (B 33 has "2", which is Barnard's OPACITY class, not
    // a brightness), and "magnitude 2" on a card would claim the Horsehead is
    // as bright as Polaris. Dropped at the source so no later task can read it.
    const magOk =
      type !== "dn" && Number.isFinite(numericMag) && numericMag < DSOS_MAG_SENTINEL;
    objects.push({
      id: pick.id,
      name: pick.name ?? joinedName,
      designation: desig,
      symbol,
      raDeg: r5(ra360(f.geometry.coordinates[0])),
      decDeg: r5(f.geometry.coordinates[1]),
      // NGC 2024's mag is d3-celestial's own "999" sentinel: omitted, never
      // shown as a real number (see DSOS_MAG_SENTINEL above).
      ...(magOk ? { mag: numericMag } : {}),
    });
  }
}
addDsosPicks(dsos6.features, DSOS6_PICKS, "dsos.6.json");
addDsosPicks(dsos14.features, DSOS14_PICKS, "dsos.14.json");

/* Constellation origins, parsed from the pinned wikitext. */
function parseOrigins(src) {
  const start = src.indexOf('{| class="wikitable sortable');
  const end = src.indexOf("\n|}", start);
  if (start < 0 || end < 0) fail("IAU table not found in the wikitext");
  const clean = (cell) =>
    cell
      .replace(/<ref[^>]*\/>/g, "")
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
      .replace(/\{\{efn[^}]*\}\}/g, "")
      .replace(/\{\{IPAc-en[^}]*\}\}/g, "")
      .replace(/\{\{(?:br|wbr)\}\}/g, " ")
      .replace(/data-sort-value="[^"]*"\s*\|/g, "")
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
      .replace(/''/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const out = {};
  for (const row of src.slice(start, end).split(/\n\|-\s*\n/).slice(1)) {
    const cells = row.replace(/^\|\s?/, "").split(/\s*\|\|\s*|\n\|\s*/).map(clean);
    const abbr = cells[1];
    if (cells.length < 9 || !/^[A-Z][A-Za-z]{2}$/.test(abbr ?? "")) continue; // the header's second row
    const yearCell = cells[4];
    const years = yearCell.match(/\d{4}/g) ?? [];
    const by = cells[5].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    out[abbr] = {
      ancient: /ancient/.test(yearCell),
      year: years.length ? Number(years[years.length - 1]) : null,
      by,
      splitFrom: cells[7] || null,
    };
  }
  return out;
}
const constellations = parseOrigins(wikitext);

const sky = {
  version: 1,
  epoch: "J2000",
  generated: QUERY_DATE,
  source: {
    d3celestial: { repo: REPO, commit: COMMIT, license: "BSD-3-Clause", copyright: D3_CELESTIAL_COPYRIGHT },
    horizons: {
      url: "https://ssd.jpl.nasa.gov/horizons/",
      queried: horizonsMode === "recorded" ? RECORDED_HORIZONS.queried : QUERY_DATE,
      quantities: "1 (astrometric RA/Dec, ICRF), 20 (range)",
      mode: horizonsMode,
      ...(horizonsNoteUnique ? { note: horizonsNoteUnique } : {}),
    },
    imo: { title: "2026 Meteor Shower Calendar (IMO INFO(3-25)), Table 5", editor: "Jürgen Rendtel", url: IMO_PDF, sha256: IMO_SHA256 },
    constellations: { url: WIKI_PAGE, revision: WIKI_REVISION, sha256: WIKI_SHA256 },
  },
  objects,
  showers: SHOWERS,
  constellations,
};

/* Milky Way: every ring of every level, Douglas-Peucker on the sphere. */
const MW_TOLERANCE_DEG = 0.2;
const unit = ([ra, dec]) => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
const angleDeg = (a, b) => {
  const u = unit(a);
  const v = unit(b);
  return Math.acos(Math.min(1, Math.max(-1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) / D2R;
};
/** Distance (deg, small-angle chord) from p to the chord a-b. */
function chordDistanceDeg(p, a, b) {
  const P = unit(p);
  const A = unit(a);
  const B = unit(b);
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  let t = len2 === 0 ? 0 : ((P[0] - A[0]) * d[0] + (P[1] - A[1]) * d[1] + (P[2] - A[2]) * d[2]) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(A[0] + t * d[0] - P[0], A[1] + t * d[1] - P[1], A[2] + t * d[2] - P[2]) / D2R;
}
function douglasPeucker(pts, tol) {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let best = -1;
    let at = -1;
    for (let i = s + 1; i < e; i++) {
      const dist = chordDistanceDeg(pts[i], pts[s], pts[e]);
      if (dist > best) {
        best = dist;
        at = i;
      }
    }
    if (best > tol) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
const levels = [];
if (mw.features.map((f) => f.id).join() !== "ol1,ol2,ol3,ol4,ol5") fail(`mw.json features are ${mw.features.map((f) => f.id)}`);
for (const f of mw.features) {
  const rings = [];
  for (const polygon of f.geometry.coordinates) {
    for (const ring of polygon) {
      const open = ring.slice(0, -1).map(([lon, lat]) => [ra360(lon), lat]); // GeoJSON rings repeat their first point
      if (open.length < 4) continue;
      // Split the closed ring in two so each half has distinct endpoints.
      const mid = open.length >> 1;
      const a = douglasPeucker(open.slice(0, mid + 1), MW_TOLERANCE_DEG);
      const b = douglasPeucker([...open.slice(mid), open[0]], MW_TOLERANCE_DEG);
      const simple = [...a.slice(0, -1), ...b.slice(0, -1)].map(([ra, dec]) => [r1(ra), r1(dec)]);
      const extent = Math.max(...simple.map((p) => angleDeg(p, simple[0])));
      if (simple.length < 4 || extent < 1.5) continue; // specks under ~15 px
      rings.push(simple);
    }
  }
  levels.push(rings);
}
// "Milky Way" label anchors on the galactic equator (b = 0), converted with
// astronomy-engine's own galactic rotation. l = 0 is skipped: that is the
// galactic core, which has its own label.
const galToEq = Astronomy.Rotation_GAL_EQJ();
const labels = [45, 90, 135, 180, 225, 270, 315].map((l) => {
  const v = Astronomy.RotateVector(galToEq, Astronomy.VectorFromSphere(new Astronomy.Spherical(0, l, 1), new Astronomy.AstroTime(0)));
  const eq = Astronomy.EquatorFromVector(v);
  return [r1(eq.ra * 15), r1(eq.dec)];
});
const milkyway = {
  version: 1,
  epoch: "J2000",
  source: { repo: REPO, commit: COMMIT, file: "data/mw.json", license: "BSD-3-Clause", copyright: D3_CELESTIAL_COPYRIGHT },
  toleranceDeg: MW_TOLERANCE_DEG,
  levels,
  labels,
};

/* ---------------------------------------------------------------------- */
/* Assert before write                                                     */
/* ---------------------------------------------------------------------- */

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const byId = new Map(objects.map((o) => [o.id, o]));
if (byId.size !== objects.length) fail("duplicate object ids");
if (objects.length !== 45) fail(`${objects.length} objects, expected 45`);

const m31 = byId.get("m31");
if (!near(m31.raDeg, 10.6751, 0.001) || !near(m31.decDeg, 41.2667, 0.001)) fail(`M31 at ${m31.raDeg}, ${m31.decDeg}`);
const core = byId.get("sgr-a-star");
if (!near(core.raDeg, 266.41683, 1e-4) || !near(core.decDeg, -29.00781, 1e-4)) fail(`Sgr A* at ${core.raDeg}, ${core.decDeg}`);
if (!near(byId.get("kepler-field").radiusDeg, 6.05, 0.01)) fail(`Kepler radius ${keplerRadiusDeg}`);
const hdf = byId.get("hubble-deep-field");
if (!near(hdf.raDeg, 189.20583, 1e-4) || !near(hdf.decDeg, 62.21611, 1e-4)) fail(`HDF at ${hdf.raDeg}, ${hdf.decDeg}`);
const polaris = byId.get("polaris");
if (!near(polaris.decDeg, 89.2641, 0.001)) fail(`Polaris at dec ${polaris.decDeg}`);
if (!near(byId.get("sirius").mag, -1.44, 0.01)) fail("Sirius magnitude");
for (const [id] of NAMED_STARS) if (!(byId.get(id).mag <= 2.0)) fail(`${id} is fainter than mag 2`);

// Colour-round additions (task 1): positions transcribed in
// .superpowers/sdd/position-sources.md, re-checked here against the same
// pinned d3-celestial commit so a source shift can never slip through.
const m33b = byId.get("m33");
if (!near(m33b.raDeg, 23.475, 0.001) || !near(m33b.decDeg, 30.65, 0.001)) fail(`M33 at ${m33b.raDeg}, ${m33b.decDeg}`);
if (byId.get("m33").symbol !== "galaxy") fail("M33 symbol");
const horsehead = byId.get("horsehead");
if (!near(horsehead.raDeg, 85.2458, 0.001) || !near(horsehead.decDeg, -2.4583, 0.001)) fail(`Horsehead at ${horsehead.raDeg}, ${horsehead.decDeg}`);
if (horsehead.name !== "Horsehead Nebula") fail(`horsehead dsonames join drifted: "${horsehead.name}"`);
if (horsehead.mag !== undefined) fail(`Horsehead mag ${horsehead.mag} should be omitted: B 33's "2" is an opacity class, not a brightness`);
const flame = byId.get("flame");
if (!near(flame.raDeg, 85.429, 0.001) || !near(flame.decDeg, -1.842, 0.001)) fail(`Flame at ${flame.raDeg}, ${flame.decDeg}`);
if (flame.name !== "Flame Nebula") fail(`flame dsonames join drifted: "${flame.name}"`);
if (flame.mag !== undefined) fail(`Flame (NGC 2024) mag ${flame.mag} should be omitted, it is d3-celestial's own 999 sentinel`);
const northAmerica = byId.get("ngc7000");
if (!near(northAmerica.raDeg, 314.696, 0.001) || !near(northAmerica.decDeg, 44.33, 0.001)) fail(`NGC 7000 at ${northAmerica.raDeg}, ${northAmerica.decDeg}`);
if (northAmerica.name !== "North America Nebula") fail(`ngc7000 dsonames join drifted: "${northAmerica.name}"`);
const dc1 = byId.get("ngc869");
const dc2 = byId.get("ngc884");
if (!near(dc1.raDeg, 34.75, 0.001) || !near(dc1.decDeg, 57.128, 0.001)) fail(`NGC 869 at ${dc1.raDeg}, ${dc1.decDeg}`);
if (!near(dc2.raDeg, 35.596, 0.001) || !near(dc2.decDeg, 57.125, 0.001)) fail(`NGC 884 at ${dc2.raDeg}, ${dc2.decDeg}`);
const veilW = byId.get("ngc6960");
const veilE = byId.get("ngc6992");
if (!near(veilW.raDeg, 311.4083, 0.001) || !near(veilW.decDeg, 30.7083, 0.001)) fail(`NGC 6960 at ${veilW.raDeg}, ${veilW.decDeg}`);
if (!near(veilE.raDeg, 314.079, 0.001) || !near(veilE.decDeg, 31.743, 0.001)) fail(`NGC 6992 at ${veilE.raDeg}, ${veilE.decDeg}`);

// Voyager 1 sits in Ophiuchus near dec +12°, Voyager 2 far south in Pavo; both recede ~3-4 au a year.
if (!(v1.raDeg > 255 && v1.raDeg < 262 && v1.decDeg > 10 && v1.decDeg < 14 && v1.distanceAu > 165 && v1.distanceAu < 185))
  fail(`Voyager 1 implausible: ${JSON.stringify(v1)}`);
if (!(v2.raDeg > 300 && v2.raDeg < 305 && v2.decDeg > -62 && v2.decDeg < -57 && v2.distanceAu > 138 && v2.distanceAu < 155))
  fail(`Voyager 2 implausible: ${JSON.stringify(v2)}`);

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const mdNum = (md) => Number(md.slice(0, 2)) * 100 + Number(md.slice(3));
const inWindow = (md, start, end) =>
  mdNum(start) <= mdNum(end) ? mdNum(md) >= mdNum(start) && mdNum(md) <= mdNum(end) : mdNum(md) >= mdNum(start) || mdNum(md) <= mdNum(end);
const EXPECTED_SHOWERS = "quadrantids,lyrids,eta-aquariids,southern-delta-aquariids,perseids,draconids,southern-taurids,orionids,northern-taurids,leonids,geminids,ursids";
if (SHOWERS.map((s) => s.id).join() !== EXPECTED_SHOWERS) fail("shower list is not the spec's twelve, in order");
for (const s of SHOWERS) {
  for (const k of ["start", "end", "peak"]) if (!MD.test(s[k])) fail(`${s.id}.${k} "${s[k]}"`);
  if (!inWindow(s.peak, s.start, s.end)) fail(`${s.id}: peak ${s.peak} outside ${s.start}..${s.end}`);
  if (!(s.radiantRaDeg >= 0 && s.radiantRaDeg < 360 && s.radiantDecDeg >= -90 && s.radiantDecDeg <= 90)) fail(`${s.id} radiant`);
  if (!(Number.isInteger(s.zhr) && s.zhr > 0)) fail(`${s.id} ZHR ${s.zhr}`);
  if (!s.parent || !/^https:\/\//.test(s.parentSource)) fail(`${s.id} parent body or its source`);
  // A mistyped peak date or λ⊙ shows up here: the Sun's J2000 ecliptic
  // longitude at noon UTC on the 2026 peak date must be within 1° of Table 5's
  // λ⊙ (measured worst case when this was written: 0.81°, the Draconids).
  const [mm, dd] = s.peak.split("-").map(Number);
  const noon = new Date(Date.UTC(2026, mm - 1, dd, 12));
  const sunLon = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, noon, true)).elon;
  const dLon = Math.abs(((sunLon - s.solarLongitudeDeg + 540) % 360) - 180);
  if (dLon > 1) fail(`${s.id}: Sun at ${sunLon.toFixed(2)}° on ${s.peak}, Table 5 says λ⊙ ${s.solarLongitudeDeg}°`);
}

const skyAbbrs = Object.keys(skyJson.constellations).sort();
const originAbbrs = Object.keys(constellations).sort();
if (originAbbrs.join() !== skyAbbrs.join()) fail(`origin table abbreviations differ from sky.json's 88: ${originAbbrs.length}`);
// The groups, counted from the pinned revision when this was written. A
// parser slip moves a constellation between groups and trips this.
const group = (o) => (o.ancient ? (o.year === null ? "ancient" : `ancient+${o.year}`) : String(o.year));
const counts = {};
for (const o of Object.values(constellations)) counts[group(o)] = (counts[group(o)] ?? 0) + 1;
const EXPECTED_COUNTS = { ancient: 47, "ancient+1756": 3, "ancient+1536": 1, 1756: 14, 1598: 12, 1613: 2, 1592: 1, 1589: 1, 1690: 7 };
if (JSON.stringify(Object.entries(counts).sort()) !== JSON.stringify(Object.entries(EXPECTED_COUNTS).map(([k, v]) => [String(k), v]).sort()))
  fail(`origin groups ${JSON.stringify(counts)}`);
const expectOrigin = (abbr, want) => {
  const got = constellations[abbr];
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${abbr} origin ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
expectOrigin("UMa", { ancient: true, year: null, by: ["Ptolemy"], splitFrom: null });
expectOrigin("Ant", { ancient: false, year: 1756, by: ["Lacaille"], splitFrom: null });
expectOrigin("Aps", { ancient: false, year: 1598, by: ["Plancius", "Keyser", "de Houtman"], splitFrom: null });
expectOrigin("Car", { ancient: true, year: 1756, by: ["Ptolemy", "Lacaille"], splitFrom: "Argo Navis" });
expectOrigin("Com", { ancient: true, year: 1536, by: ["Ptolemy", "Caspar Vopel"], splitFrom: "Leo" });
expectOrigin("Cru", { ancient: false, year: 1589, by: ["Plancius"], splitFrom: "Centaurus" });
expectOrigin("Lyn", { ancient: false, year: 1690, by: ["Hevelius"], splitFrom: null });

const vertexCount = levels.reduce((n, rings) => n + rings.reduce((m, r) => m + r.length, 0), 0);
if (levels.length !== 5) fail(`${levels.length} Milky Way levels`);
for (const [i, rings] of levels.entries()) if (rings.length < 4) fail(`Milky Way level ${i + 1} has ${rings.length} rings`);
if (vertexCount > 4000 || vertexCount < 1500) fail(`${vertexCount} Milky Way vertices (budget 1,500-4,000)`);

const objectsBody = JSON.stringify(sky);
const milkywayBody = JSON.stringify(milkyway);
if (milkywayBody.length >= 90_000) fail(`milkyway.json would be ${milkywayBody.length} bytes`);
if (objectsBody.length >= 40_000) fail(`objects.json would be ${objectsBody.length} bytes`);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL("objects.json", OUT_DIR), objectsBody);
await writeFile(new URL("milkyway.json", OUT_DIR), milkywayBody);
if (horizonsMode === "recorded") {
  console.log(
    `prepare-sky-objects: WARNING Voyager positions used the RECORDED Horizons fallback ` +
      `(${horizonsNoteUnique}). Re-run this script once Horizons recovers.`,
  );
}
console.log(
  `prepare-sky-objects: wrote public/sky/objects.json (${objectsBody.length} bytes: ${objects.length} objects, ` +
    `${SHOWERS.length} showers, ${originAbbrs.length} constellation origins; Voyagers as of ${QUERY_DATE}, ` +
    `Horizons mode: ${horizonsMode}) and public/sky/milkyway.json (${milkywayBody.length} bytes, ${vertexCount} vertices)`,
);
