/**
 * The gate a visitor-drawn airspace passes before the rerouter sees it.
 *
 * The pipeline's inside test is ray casting and its crossing test walks the
 * ring's edges, so both quietly assume a simple polygon: a bow-tie has a
 * "hole" where the two lobes overlap that ray casting calls outside, and a
 * route through it would read as clear. So a ring must have at least three
 * distinct vertices, some area, and no two non-adjacent edges may cross.
 *
 * Tested in the same projection the pipeline uses (Albers metres), with the
 * pipeline's own segment test, so "crosses" means what it means downstream.
 * No React, no DOM: plain node runs scripts/test-slaac-ring.mjs against it.
 */
import { albers } from "../../lib/slaac/albers.ts";
import { segInt, type Pt } from "../../lib/slaac/geometry.ts";

export type RingCheck = { ok: true } | { ok: false; reason: "too-few" | "self-crossing" | "degenerate" };

/** Area below this fraction of the perimeter squared is "no area". An
 *  equilateral triangle scores ~0.048 and a 1:100 sliver ~0.0012; three
 *  points on one meridian score 0 (Albers draws meridians straight). */
const MIN_AREA_RATIO = 1e-4;

export function checkRing(ll: [number, number][]): RingCheck {
  let ring = ll;
  // A ring closed by repeating its first vertex is the same ring.
  if (ring.length > 1) {
    const f = ring[0], l = ring[ring.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) ring = ring.slice(0, -1);
  }
  // A repeated vertex (a double click) adds no corner: keep the distinct ones.
  ring = ring.filter((q, i) => i === 0 || q[0] !== ring[i - 1][0] || q[1] !== ring[i - 1][1]);
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
  if (ring.length < 3) return { ok: false, reason: "too-few" };
  const p: Pt[] = ring.map(([la, lo]) => albers(la, lo));
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    // Edges i and j share a vertex when j is i's neighbour (j = i + 1, or the
    // wrap-around pair i = 0, j = n - 1), and a shared vertex is not a crossing.
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segInt(a, b, p[j], p[(j + 1) % n])) return { ok: false, reason: "self-crossing" };
    }
  }
  // After the crossing test: a bow-tie's two lobes cancel to ~zero signed
  // area, and it should be told it crosses itself, not that it has no area.
  let area2 = 0, perim = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    area2 += a[0] * b[1] - b[0] * a[1];
    perim += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (Math.abs(area2) / 2 < MIN_AREA_RATIO * perim * perim) return { ok: false, reason: "degenerate" };
  return { ok: true };
}
