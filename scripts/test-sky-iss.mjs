// node --test scripts/test-sky-iss.mjs
// Pins lib/sky-iss.ts. For a fixed, real TLE (CelesTrak, fetched 2026-09-15)
// its topocentric RA/Dec, computed from the observer-to-station vector, must
// agree with satellite.js's OWN look angles (azimuth/elevation) converted to
// RA/Dec here by the textbook horizon-to-equatorial formulas: two
// independent routes to the same direction. Also the TLE text parser and the
// epoch, which the route handler relies on.
import test from "node:test";
import assert from "node:assert/strict";
import * as satellite from "satellite.js";
import * as I from "../lib/sky-iss.ts";

const TEXT =
  "ISS (ZARYA)             \r\n" +
  "1 25544U 98067A   26258.17538348  .00006015  00000+0  11677-3 0  9998\r\n" +
  "2 25544  51.6311 214.7209 0004917 142.0099 218.1237 15.49120584585708\r\n";
const MOFFETT = { latDeg: 37.4153, lonDeg: -122.0647, heightKm: I.MOFFETT_HEIGHT_KM };
const D2R = Math.PI / 180;

function sepDeg(a, b) {
  const c =
    Math.sin(a.dec * D2R) * Math.sin(b.dec * D2R) +
    Math.cos(a.dec * D2R) * Math.cos(b.dec * D2R) * Math.cos((a.ra - b.ra) * D2R);
  return Math.acos(Math.min(1, Math.max(-1, c))) / D2R;
}

test("parses CelesTrak's text and the epoch", () => {
  const tle = I.parseTleText(TEXT);
  assert.equal(tle.name, "ISS (ZARYA)");
  assert.equal(tle.line1.length, 69);
  assert.equal(I.tleEpochIso(tle.line1), "2026-09-15T04:12:33.132Z");
  assert.equal(I.parseTleText(TEXT.replace("0  9998", "0  9997")), null, "a bad checksum must be rejected");
  assert.equal(I.parseTleText("<html>maintenance</html>"), null);
});

test("topocentric RA/Dec agrees with satellite.js look angles within 0.01°", () => {
  const { line1, line2 } = I.parseTleText(TEXT);
  const satrec = satellite.twoline2satrec(line1, line2);
  const epochMs = Date.parse(I.tleEpochIso(line1));
  let worst = 0;
  let aboveHorizon = 0;
  for (let ms = epochMs - 12 * 3600e3; ms <= epochMs + 12 * 3600e3; ms += 7 * 60e3) {
    const look = I.issLook(satellite, satrec, ms, MOFFETT);
    assert.ok(look, `propagation failed at ${new Date(ms).toISOString()}`);
    assert.ok(look.altitudeKm > 380 && look.altitudeKm < 440, `altitude ${look.altitudeKm}`);
    assert.ok(look.speedKmS > 7.5 && look.speedKmS < 7.8, `speed ${look.speedKmS}`);

    // Independent: azimuth/elevation -> hour angle/declination -> RA, with
    // LST from satellite.js's own GMST so both sit in the same frame of date.
    const date = new Date(ms);
    const site = { longitude: MOFFETT.lonDeg * D2R, latitude: MOFFETT.latDeg * D2R, height: MOFFETT.heightKm };
    const pv = satellite.propagate(satrec, date);
    const gmst = satellite.gstime(date);
    const la = satellite.ecfToLookAngles(site, satellite.eciToEcf(pv.position, gmst));
    const phi = site.latitude;
    const A = la.azimuth;
    const h = la.elevation;
    const dec = Math.asin(Math.sin(phi) * Math.sin(h) + Math.cos(phi) * Math.cos(h) * Math.cos(A));
    const H = Math.atan2(-Math.sin(A) * Math.cos(h), Math.sin(h) * Math.cos(phi) - Math.cos(h) * Math.cos(A) * Math.sin(phi));
    const lst = gmst + site.longitude;
    const ref = { ra: ((((lst - H) / D2R) % 360) + 360) % 360, dec: dec / D2R };

    assert.ok(Math.abs(look.elevationDeg - h / D2R) < 1e-9, "elevation is satellite.js's own");
    worst = Math.max(worst, sepDeg({ ra: look.raDateDeg, dec: look.decDateDeg }, ref));
    if (look.elevationDeg > 0) aboveHorizon++;
  }
  assert.ok(worst < 0.01, `worst disagreement ${worst.toFixed(5)}°`);
  assert.ok(aboveHorizon > 0, "the sample never saw the ISS above Moffett Field's horizon");
});

test("a TLE more than seven days from the instant is not used", async () => {
  const tle = { ...I.parseTleText(TEXT), epoch: I.tleEpochIso(I.parseTleText(TEXT).line1), fetchedAt: "2026-09-15T16:00:00.000Z" };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(tle), { headers: { "content-type": "application/json" } });
  try {
    const tracker = await I.loadIss(async () => satellite, MOFFETT);
    assert.ok(tracker.at(tracker.epochMs + 3600e3), "an hour after the epoch is fine");
    assert.equal(tracker.at(tracker.epochMs + I.TLE_STALE_MS + 60e3), null);
  } finally {
    globalThis.fetch = realFetch;
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ tle: null, fetchedAt: "x" }));
  try {
    assert.equal(await I.loadIss(async () => satellite, MOFFETT), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a literal JSON null body is reported as malformed, not a raw TypeError (fix round 1)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("null", { headers: { "content-type": "application/json" } });
  try {
    await assert.rejects(() => I.loadIss(async () => satellite, MOFFETT), (err) => {
      assert.ok(err instanceof Error && !(err instanceof TypeError), `expected a plain Error, got ${err}`);
      assert.match(err.message, /malformed body/);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
