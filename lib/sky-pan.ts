/**
 * Drag-to-pan physics for the night sky (spec 2026-09-15 §3): the rubber band
 * past the drag limit and the spring that brings the chart home on release.
 *
 * ⚠️ NO IMPORTS, same rule as lib/sky-math.ts: scripts/test-sky-pan.mjs
 * imports this file straight into node. Keep the TypeScript erasable.
 *
 * The spring is the exact closed-form solution of a critically damped
 * oscillator, advanced by the real elapsed time. That is the Constitution's
 * dt rule taken to its limit: a 16 ms frame, a 100 ms frame and a stalled tab
 * all land on the same curve, and it can never overshoot or blow up.
 */

export type Vec = { x: number; y: number };

/** A pointer that travels less than this between down and up is a click. */
export const CLICK_SLOP_PX = 5;
/** Drag freely up to this fraction of min(width, height); past it, rubber band. */
export const PAN_LIMIT_FRAC = 0.45;
/**
 * Stargaze's own, looser limit ("clutter" follow-up, 2026-09-15): there is no
 * sheet to compose around while stargazing, so a visitor should be able to
 * wander much farther before the rubber band starts pushing back. Twice the
 * normal-mode limit felt right by eye against a real drag; it still bands
 * past that, it just takes a lot more travel to notice.
 */
export const STARGAZE_PAN_LIMIT_FRAC = 0.9;
/** Spring rate (1/s). From rest, 1% of the drag is left after 700 ms. */
export const SPRING_OMEGA = 9.5;
/** Under both, the spring is done and the offset snaps to exactly (0, 0). */
export const SETTLE_PX = 0.25;
export const SETTLE_SPEED_PX_S = 2;

/**
 * Radial rubber band. Identity inside `limit`; past it the extra drag moves
 * the chart at 55% at first, less and less after, and never past 1.5·limit.
 */
export function rubberBand(raw: Vec, limit: number): Vec {
  const len = Math.hypot(raw.x, raw.y);
  if (len <= limit) return { x: raw.x, y: raw.y };
  const excess = len - limit;
  const give = limit * 0.5 * (1 - 1 / (1 + (1.1 * excess) / limit));
  const s = (limit + give) / len;
  return { x: raw.x * s, y: raw.y * s };
}

/**
 * Advance the return spring by `dtMs` of real time. `p` is the offset (px),
 * `v` its velocity (px/s). Returns `settled: true` (and exact zeros) once the
 * chart is home.
 */
export function springStep(p: Vec, v: Vec, dtMs: number): { p: Vec; v: Vec; settled: boolean } {
  const dt = Math.max(0, dtMs) / 1000;
  const e = Math.exp(-SPRING_OMEGA * dt);
  const axis = (x: number, u: number): [number, number] => {
    const b = u + SPRING_OMEGA * x;
    return [(x + b * dt) * e, (u - SPRING_OMEGA * b * dt) * e];
  };
  const [px, vx] = axis(p.x, v.x);
  const [py, vy] = axis(p.y, v.y);
  if (Math.hypot(px, py) < SETTLE_PX && Math.hypot(vx, vy) < SETTLE_SPEED_PX_S) {
    return { p: { x: 0, y: 0 }, v: { x: 0, y: 0 }, settled: true };
  }
  return { p: { x: px, y: py }, v: { x: vx, y: vy }, settled: false };
}
