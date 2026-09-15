/**
 * Pure sky math for the night-sky desk (components/manuscript/NightSky.tsx):
 * sidereal time, the simulated clock, planet / Sun / Moon positions, the
 * Moon's phase, and the chart projection.
 *
 * ⚠️ NO IMPORTS, ever. scripts/test-sky-math.mjs imports this file straight
 * into node (Node 24 strips the types) and pins it against astronomy-engine:
 * GMST within 2 s, planets within 0.25°, the Moon within 0.3°. Keep the
 * TypeScript erasable (no enums, namespaces or parameter properties).
 *
 * Frame: J2000 equatorial throughout, the star catalog's epoch. Precession
 * since 2000 moves the pole ~0.14°, invisible at ~10-20 px per degree.
 *
 * Sources: GMST, IAU 1982 expression. Planets and the Earth-Moon barycentre,
 * JPL "Approximate Positions of the Planets", Table 1 (valid 1800-2050),
 * copied digit for digit. Moon, Meeus "Astronomical Algorithms" ch. 47, the
 * largest terms of tables 47.A/47.B; geocentric (lunar parallax, up to 1°,
 * is ignored on purpose, spec §7).
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const OBLIQUITY_J2000 = 23.43928 * D2R;

export const SKY_SPEEDUP = 180;
export const MOFFETT = { latDeg: 37.4153, lonDeg: -122.0647 } as const;
/** The declination that lands on the viewport's half-diagonal. */
export const EDGE_DEC_DEG = -30;
export const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"] as const;
export type Planet = (typeof PLANETS)[number];
export type Equatorial = { raDeg: number; decDeg: number };
export type Chart = { cx: number; cy: number; k: number; lstDeg: number };

const norm360 = (d: number) => ((d % 360) + 360) % 360;

export function julianDate(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

const centuries = (ms: number) => (julianDate(ms) - 2451545.0) / 36525;

export function gmstDeg(ms: number): number {
  const d = julianDate(ms) - 2451545.0;
  const t = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/** Local sidereal time; longitude east-positive (Moffett Field is negative). */
export function lstDeg(ms: number, lonDeg: number = MOFFETT.lonDeg): number {
  return norm360(gmstDeg(ms) + lonDeg);
}

/** One clock drives the whole sky: the load instant, then 180x. */
export function simTimeMs(loadMs: number, nowMs: number, speedup: number = SKY_SPEEDUP): number {
  return loadMs + (nowMs - loadMs) * speedup;
}

type Vec3 = [number, number, number];

function eclToEq([x, y, z]: Vec3): Vec3 {
  const c = Math.cos(OBLIQUITY_J2000);
  const s = Math.sin(OBLIQUITY_J2000);
  return [x, c * y - s * z, s * y + c * z];
}

function toRaDec([x, y, z]: Vec3): Equatorial {
  return { raDeg: norm360(Math.atan2(y, x) * R2D), decDeg: Math.atan2(z, Math.hypot(x, y)) * R2D };
}

export function eclipticToEquatorial(lonDeg: number, latDeg: number = 0): Equatorial {
  const l = lonDeg * D2R;
  const b = latDeg * D2R;
  return toRaDec(eclToEq([Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)]));
}

/** a (au), e, I (deg), L (deg), long. perihelion (deg), long. node (deg). */
type Elements = [number, number, number, number, number, number];

const JPL: Record<Planet | "EMB", { base: Elements; rate: Elements }> = {
  Mercury: {
    base: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  },
  Venus: {
    base: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  },
  EMB: {
    base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  },
  Mars: {
    base: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  },
  Jupiter: {
    base: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  },
  Saturn: {
    base: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  },
};

/** Heliocentric ecliptic J2000 position in au. */
function helio(body: Planet | "EMB", t: number): Vec3 {
  const { base, rate } = JPL[body];
  const at = (i: number) => base[i] + rate[i] * t;
  const a = at(0);
  const e = at(1);
  const inc = at(2) * D2R;
  const L = at(3);
  const peri = at(4);
  const node = at(5);
  const omega = (peri - node) * D2R;
  const om = node * D2R;
  const M = ((norm360(L - peri) + 180) % 360 - 180) * D2R;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(omega), sw = Math.sin(omega);
  const cO = Math.cos(om), sO = Math.sin(om);
  const cI = Math.cos(inc), sI = Math.sin(inc);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

export function planetEquatorial(name: Planet, ms: number): Equatorial {
  const t = centuries(ms);
  const p = helio(name, t);
  const earth = helio("EMB", t); // the barycentre stands in for Earth; negligible at planet distances
  return toRaDec(eclToEq([p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]]));
}

export function sunEquatorial(ms: number): Equatorial {
  const earth = helio("EMB", centuries(ms));
  return toRaDec(eclToEq([-earth[0], -earth[1], -earth[2]]));
}

/** [D, M, M', F, coefficient in 1e-6 degrees] */
type Term = [number, number, number, number, number];

const MOON_LON: Term[] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
];

const MOON_LAT: Term[] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
];

export function moonEquatorial(ms: number): Equatorial {
  const t = centuries(ms);
  const Lp = 218.3164477 + 481267.88123421 * t;
  const D = 297.8501921 + 445267.1114034 * t;
  const M = 357.5291092 + 35999.0502909 * t;
  const Mp = 134.9633964 + 477198.8675055 * t;
  const F = 93.272095 + 483202.0175233 * t;
  const A1 = 119.75 + 131.849 * t;
  const A2 = 53.09 + 479264.29 * t;
  const A3 = 313.45 + 481266.484 * t;
  const E = 1 - 0.002516 * t - 0.0000074 * t * t;
  const sin = (deg: number) => Math.sin(deg * D2R);

  let sl = 0;
  for (const [d, m, mp, f, c] of MOON_LON) sl += c * E ** Math.abs(m) * sin(d * D + m * M + mp * Mp + f * F);
  let sb = 0;
  for (const [d, m, mp, f, c] of MOON_LAT) sb += c * E ** Math.abs(m) * sin(d * D + m * M + mp * Mp + f * F);
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

  // Meeus gives the mean equinox of date; general precession in longitude
  // (5029.0966"/century) takes it back to J2000.
  const lon = Lp + sl / 1e6 - 1.3969713 * t;
  return eclipticToEquatorial(lon, sb / 1e6);
}

/**
 * Lit fraction (0 new, 1 full) and the bright limb's position angle
 * (degrees, north through east). Geocentric; the Sun is far enough that the
 * phase angle is 180° minus the Moon-Sun elongation.
 */
export function moonPhase(moon: Equatorial, sun: Equatorial): { litFraction: number; brightLimbDeg: number } {
  const a1 = sun.raDeg * D2R, d1 = sun.decDeg * D2R;
  const a2 = moon.raDeg * D2R, d2 = moon.decDeg * D2R;
  const cosPsi = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
  const litFraction = (1 - Math.min(1, Math.max(-1, cosPsi))) / 2;
  const chi = Math.atan2(
    Math.cos(d1) * Math.sin(a1 - a2),
    Math.sin(d1) * Math.cos(d2) - Math.cos(d1) * Math.sin(d2) * Math.cos(a1 - a2),
  );
  return { litFraction, brightLimbDeg: norm360(chi * R2D) };
}

/** Polar stereographic chart, pole at the viewport centre. */
export function chartFor(width: number, height: number, lst: number): Chart {
  const halfDiagonal = Math.hypot(width, height) / 2;
  const k = halfDiagonal / Math.tan(((90 - EDGE_DEC_DEG) / 2) * D2R);
  return { cx: width / 2, cy: height / 2, k, lstDeg: lst };
}

/**
 * Sky view facing north: up is toward the zenith, east is right. The screen
 * angle is RA - LST from straight up, positive to the right, so as LST grows
 * the sky turns counterclockwise, the way it turns around Polaris.
 */
export function project(c: Chart, raDeg: number, decDeg: number): { x: number; y: number } {
  const rho = c.k * Math.tan(((90 - decDeg) / 2) * D2R);
  const phi = (raDeg - c.lstDeg) * D2R;
  return { x: c.cx + rho * Math.sin(phi), y: c.cy - rho * Math.cos(phi) };
}
