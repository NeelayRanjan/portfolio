/**
 * The ISS on the night sky (spec docs/superpowers/specs/2026-09-15-sky-objects-design.md §8).
 *
 * ⚠️ NO RUNTIME IMPORTS. satellite.js (SGP4) is handed in by the caller:
 * NightSky lazy-imports it only once the route has a TLE, and
 * scripts/test-sky-iss.mjs passes its own copy, so this file runs straight in
 * node. The `import type` below is erased.
 *
 * Frames: satellite.js propagates in TEME, an equator-and-equinox-of-date
 * frame, so `raDateDeg`/`decDateDeg` are of date. The chart is J2000; the
 * caller converts with lib/sky-math.ts precessToJ2000 (a ~0.36° shift in
 * 2026, about 4 px, which would otherwise put the station beside the wrong
 * stars).
 *
 * Honesty gate: a TLE is a fit to a few days of tracking. More than
 * TLE_STALE_MS from its epoch (the sky's 180x clock gets there in about 56
 * real minutes) `at()` returns null and the ISS leaves the chart instead of
 * drifting somewhere it isn't.
 */
import type * as Satellite from "satellite.js";

export type SatelliteLib = typeof Satellite;
export type IssTle = { name: string; line1: string; line2: string; epoch: string; fetchedAt: string };
export type IssRouteBody = IssTle | { tle: null; fetchedAt: string };
export type Observer = { latDeg: number; lonDeg: number; heightKm: number };
export type IssLook = {
  raDateDeg: number;
  decDateDeg: number;
  azimuthDeg: number;
  elevationDeg: number;
  altitudeKm: number;
  speedKmS: number;
};
export type IssTracker = { tle: IssTle; epochMs: number; at: (ms: number) => IssLook | null };

export const ISS_URL = "/api/iss-tle";
export const TLE_STALE_MS = 7 * 86_400_000;
/** Moffett Field's ground elevation is about 10 m. */
export const MOFFETT_HEIGHT_KM = 0.01;

const R2D = 180 / Math.PI;

/** TLE checksum: digits count their value, "-" counts 1, mod 10, in column 69. */
function checksumOk(line: string): boolean {
  let sum = 0;
  for (const ch of line.slice(0, 68)) {
    if (ch >= "0" && ch <= "9") sum += Number(ch);
    else if (ch === "-") sum += 1;
  }
  return sum % 10 === Number(line[68]);
}

/** CelesTrak's 3-line TLE text (CRLF line ends, padded name) -> the ISS's lines, or null. */
export function parseTleText(text: string): { name: string; line1: string; line2: string } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0);
  if (lines.length < 3) return null;
  const [name, line1, line2] = lines;
  if (line1.length !== 69 || line2.length !== 69) return null;
  if (!line1.startsWith("1 25544") || !line2.startsWith("2 25544")) return null;
  if (!checksumOk(line1) || !checksumOk(line2)) return null;
  return { name: name.trim(), line1, line2 };
}

/** Line 1 columns 19-32: two-digit year, then day of year with a fraction. */
export function tleEpochIso(line1: string): string {
  const yy = Number(line1.slice(18, 20));
  const doy = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000).toISOString();
}

/** Topocentric position of the station as seen by `obs` at `ms`, or null if SGP4 fails. */
export function issLook(sat: SatelliteLib, satrec: Satellite.SatRec, ms: number, obs: Observer): IssLook | null {
  const date = new Date(ms);
  const pv = sat.propagate(satrec, date);
  if (!pv) return null;
  const gmst = sat.gstime(date);
  const site = {
    longitude: sat.degreesToRadians(obs.lonDeg),
    latitude: sat.degreesToRadians(obs.latDeg),
    height: obs.heightKm,
  };
  // RA/Dec from the observer-to-station vector in the inertial frame.
  const here = sat.ecfToEci(sat.geodeticToEcf(site), gmst);
  const dx = pv.position.x - here.x;
  const dy = pv.position.y - here.y;
  const dz = pv.position.z - here.z;
  const range = Math.hypot(dx, dy, dz);
  // Elevation and azimuth from satellite.js's own horizon frame.
  const look = sat.ecfToLookAngles(site, sat.eciToEcf(pv.position, gmst));
  const geo = sat.eciToGeodetic(pv.position, gmst);
  return {
    raDateDeg: (((Math.atan2(dy, dx) * R2D) % 360) + 360) % 360,
    decDateDeg: Math.asin(dz / range) * R2D,
    azimuthDeg: look.azimuth * R2D,
    elevationDeg: look.elevation * R2D,
    altitudeKm: geo.height,
    speedKmS: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z),
  };
}

/**
 * Fetch the route; null when it has no TLE (CelesTrak unreachable at its last
 * revalidation) or the fetch fails, so the ISS simply isn't drawn. A body
 * that claims a TLE but isn't one throws: that's a route bug to see.
 */
export async function loadIss(importSatellite: () => Promise<SatelliteLib>, obs: Observer): Promise<IssTracker | null> {
  let res: Response;
  try {
    res = await fetch(ISS_URL);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json()) as IssRouteBody;
  if ("tle" in body && body.tle === null) return null;
  const tle = body as IssTle;
  if (typeof tle.line1 !== "string" || typeof tle.line2 !== "string" || Number.isNaN(Date.parse(tle.epoch))) {
    throw new Error(`${ISS_URL}: malformed body ${JSON.stringify(body).slice(0, 200)}`);
  }
  const sat = await importSatellite();
  const satrec = sat.twoline2satrec(tle.line1, tle.line2);
  const epochMs = Date.parse(tle.epoch);
  return {
    tle,
    epochMs,
    at: (ms) => (Math.abs(ms - epochMs) > TLE_STALE_MS ? null : issLook(sat, satrec, ms, obs)),
  };
}
