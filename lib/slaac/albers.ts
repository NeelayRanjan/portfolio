/** The owner's Albers equal-area projection (viz_common.py / sua_guidance.py),
 *  ported exactly: same sphere radius, origin and standard parallels. */
const R = 6371000.0;
const LAT0 = (23.0 * Math.PI) / 180, LON0 = (-96.0 * Math.PI) / 180;
const P1 = (29.5 * Math.PI) / 180, P2 = (45.5 * Math.PI) / 180;
const N = (Math.sin(P1) + Math.sin(P2)) / 2;
const C = Math.cos(P1) ** 2 + 2 * N * Math.sin(P1);
const RHO0 = (R / N) * Math.sqrt(C - 2 * N * Math.sin(LAT0));
export const NM = 1852.0;

export function albers(latDeg: number, lonDeg: number): [number, number] {
  const lat = (latDeg * Math.PI) / 180, lon = (lonDeg * Math.PI) / 180;
  const rho = (R / N) * Math.sqrt(Math.max(C - 2 * N * Math.sin(lat), 0));
  const theta = N * (lon - LON0);
  return [rho * Math.sin(theta), RHO0 - rho * Math.cos(theta)];
}

export function inverseAlbers(x: number, y: number): [number, number] {
  const rho = Math.sign(N) * Math.sqrt(x * x + (RHO0 - y) ** 2);
  const theta = Math.atan2(x, RHO0 - y);
  const lon = LON0 + theta / N;
  const val = (C - ((rho * N) / R) ** 2) / (2 * N);
  const lat = Math.asin(Math.min(1, Math.max(-1, val)));
  return [(lat * 180) / Math.PI, (lon * 180) / Math.PI];
}
