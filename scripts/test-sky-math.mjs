// node --test scripts/test-sky-math.mjs
// Pins lib/sky-math.ts against astronomy-engine (a devDependency; the site
// never ships it). Thresholds are the spec's (§7): GMST within 2 s, planets
// within 0.25°, the Moon within 0.3°.
import test from "node:test";
import assert from "node:assert/strict";
import * as A from "astronomy-engine";
import * as S from "../lib/sky-math.ts";

const D2R = Math.PI / 180;

/** Great-circle separation in degrees. */
function sepDeg(a, b) {
  const c =
    Math.sin(a.decDeg * D2R) * Math.sin(b.decDeg * D2R) +
    Math.cos(a.decDeg * D2R) * Math.cos(b.decDeg * D2R) * Math.cos((a.raDeg - b.raDeg) * D2R);
  return Math.acos(Math.min(1, Math.max(-1, c))) / D2R;
}

function refEq(vec) {
  const e = A.EquatorFromVector(vec);
  return { raDeg: e.ra * 15, decDeg: e.dec };
}

/** Weekly dates over 2026-2030. */
const DATES = [];
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2031, 0, 1); t += 7 * 86400000) DATES.push(new Date(t));

test("julian date of the J2000 epoch", () => {
  assert.equal(S.julianDate(Date.UTC(2000, 0, 1, 12)), 2451545.0);
});

test("GMST within 2 s of astronomy-engine's sidereal time", () => {
  let worst = 0;
  for (const d of DATES) {
    const refDeg = A.SiderealTime(d) * 15;
    let diff = Math.abs(S.gmstDeg(d.getTime()) - refDeg) % 360;
    if (diff > 180) diff = 360 - diff;
    worst = Math.max(worst, diff);
  }
  // 2 s of sidereal time = 2/240 deg
  assert.ok(worst < 2 / 240, `worst GMST error ${(worst * 240).toFixed(2)} s`);
});

test("LST adds east longitude", () => {
  const ms = Date.UTC(2026, 8, 20, 6);
  const expect = (((S.gmstDeg(ms) + S.MOFFETT.lonDeg) % 360) + 360) % 360;
  assert.ok(Math.abs(S.lstDeg(ms) - expect) < 1e-9);
});

test("simulated clock runs 180x from the load instant", () => {
  assert.equal(S.simTimeMs(1000, 1000), 1000);
  assert.equal(S.simTimeMs(1000, 2000), 1000 + 1000 * 180);
});

test("ecliptic to equatorial at the solstice point", () => {
  const e = S.eclipticToEquatorial(90, 0);
  assert.ok(Math.abs(e.raDeg - 90) < 1e-6);
  assert.ok(Math.abs(e.decDeg - 23.43928) < 1e-4);
});

for (const name of S.PLANETS) {
  test(`${name} within 0.25° of astronomy-engine`, () => {
    let worst = 0;
    for (const d of DATES) {
      const ref = refEq(A.GeoVector(A.Body[name], d, false));
      worst = Math.max(worst, sepDeg(S.planetEquatorial(name, d.getTime()), ref));
    }
    assert.ok(worst < 0.25, `${name} worst ${worst.toFixed(3)}°`);
  });
}

test("Sun within 0.05°", () => {
  let worst = 0;
  for (const d of DATES) {
    const ref = refEq(A.GeoVector(A.Body.Sun, d, false));
    worst = Math.max(worst, sepDeg(S.sunEquatorial(d.getTime()), ref));
  }
  assert.ok(worst < 0.05, `Sun worst ${worst.toFixed(3)}°`);
});

test("Moon within 0.3° (daily over 2026-2027)", () => {
  let worst = 0;
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 86400000 * 0.75) {
    const d = new Date(t);
    const ref = refEq(A.GeoMoon(d));
    worst = Math.max(worst, sepDeg(S.moonEquatorial(t), ref));
  }
  assert.ok(worst < 0.3, `Moon worst ${worst.toFixed(3)}°`);
});

test("Moon phase: lit fraction within 0.03, bright limb faces the Sun", () => {
  for (const d of DATES) {
    const ms = d.getTime();
    const moon = S.moonEquatorial(ms);
    const sun = S.sunEquatorial(ms);
    const { litFraction, brightLimbDeg } = S.moonPhase(moon, sun);
    const ref = A.Illumination(A.Body.Moon, d).phase_fraction;
    assert.ok(Math.abs(litFraction - ref) < 0.03, `${d.toISOString()} lit ${litFraction} vs ${ref}`);
    // Step a little from the Moon along the bright-limb position angle (north
    // through east); that must bring it closer to the Sun. The step is a
    // quarter of the separation (at most 0.1°) so it can't overshoot near new
    // moon.
    const chi = brightLimbDeg * D2R;
    const step = Math.min(0.1, sepDeg(moon, sun) / 4);
    const stepped = {
      raDeg: moon.raDeg + (step * Math.sin(chi)) / Math.cos(moon.decDeg * D2R),
      decDeg: moon.decDeg + step * Math.cos(chi),
    };
    assert.ok(sepDeg(stepped, sun) < sepDeg(moon, sun), `${d.toISOString()} limb points away from the Sun`);
  }
});

test("projection: pole at centre, edge declination at the half-diagonal", () => {
  const c = S.chartFor(1600, 1000, 0);
  assert.deepEqual([c.cx, c.cy], [800, 500]);
  const pole = S.project(c, 123, 90);
  assert.ok(Math.abs(pole.x - 800) < 1e-9 && Math.abs(pole.y - 500) < 1e-9);
  const edge = S.project(c, 45, S.EDGE_DEC_DEG);
  const r = Math.hypot(edge.x - 800, edge.y - 500);
  assert.ok(Math.abs(r - Math.hypot(1600, 1000) / 2) < 1e-6, `edge radius ${r}`);
});

test("projection: sky view facing north, turning counterclockwise", () => {
  const lst = 200;
  const c = S.chartFor(1000, 1000, lst);
  const meridian = S.project(c, lst, 40);
  assert.ok(Math.abs(meridian.x - 500) < 1e-9 && meridian.y < 500, "RA = LST must sit straight up");
  const east = S.project(c, lst + 90, 40);
  assert.ok(east.x > 500 && Math.abs(east.y - 500) < 1e-9, "east of the meridian must be to the right");
  // Six sidereal hours later that star has crossed the meridian: straight up.
  const later = S.project(S.chartFor(1000, 1000, lst + 90), lst + 90, 40);
  assert.ok(Math.abs(later.x - 500) < 1e-6 && later.y < 500, "the sky must turn counterclockwise");
});
