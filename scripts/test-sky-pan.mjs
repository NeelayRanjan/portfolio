// node --test scripts/test-sky-pan.mjs
// Pins lib/sky-pan.ts: the rubber band stays bounded, and the return spring
// is frame-rate independent, never overshoots, and settles to exactly zero
// well inside the 1.5 s the sky-drag browser check allows.
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../lib/sky-pan.ts";

test("constants match the spec", () => {
  assert.equal(P.CLICK_SLOP_PX, 5);
  assert.equal(P.PAN_LIMIT_FRAC, 0.45);
});

test("rubber band: identity inside the limit, bounded and monotonic past it", () => {
  const limit = 405; // 0.45 x 900
  assert.deepEqual(P.rubberBand({ x: 150, y: 80 }, limit), { x: 150, y: 80 });
  assert.deepEqual(P.rubberBand({ x: 0, y: 0 }, limit), { x: 0, y: 0 });
  let prev = limit;
  for (let raw = limit + 1; raw < limit * 40; raw += 7) {
    const out = P.rubberBand({ x: raw * 0.6, y: raw * 0.8 }, limit);
    const len = Math.hypot(out.x, out.y);
    assert.ok(len > prev - 1e-9, `not monotonic at ${raw}`);
    assert.ok(len < 1.5 * limit, `unbounded at ${raw}: ${len}`);
    assert.ok(Math.abs(out.x / out.y - 0.75) < 1e-9, "direction changed");
    prev = len;
  }
  // Continuous at the limit, and slower than the pointer just past it.
  const just = P.rubberBand({ x: limit + 10, y: 0 }, limit).x;
  assert.ok(just > limit && just < limit + 10, `just past the limit: ${just}`);
});

/** Run the spring from `p0` at a fixed frame length until it settles. */
function settle(p0, frameMs, maxMs = 5000) {
  let p = p0;
  let v = { x: 0, y: 0 };
  let t = 0;
  let minX = Infinity;
  while (t < maxMs) {
    const r = P.springStep(p, v, frameMs);
    t += frameMs;
    p = r.p;
    v = r.v;
    minX = Math.min(minX, p.x);
    if (r.settled) return { t, minX, p };
  }
  return { t: Infinity, minX, p };
}

test("spring: frame-rate independent", () => {
  const run = (frameMs, frames) => {
    let p = { x: 170, y: -60 };
    let v = { x: 0, y: 0 };
    for (let i = 0; i < frames; i++) ({ p, v } = P.springStep(p, v, frameMs));
    return p;
  };
  const a = run(700 / 42, 42);
  const b = run(100, 7);
  const c = run(700, 1);
  assert.ok(Math.abs(a.x - c.x) < 1e-9 && Math.abs(b.x - c.x) < 1e-9, `${a.x} ${b.x} ${c.x}`);
  assert.ok(Math.abs(a.y - c.y) < 1e-9 && Math.abs(b.y - c.y) < 1e-9, `${a.y} ${b.y} ${c.y}`);
  // ~700 ms: under 1.1% of the drag is left.
  assert.ok(Math.hypot(c.x, c.y) < 0.011 * Math.hypot(170, 60), `at 700 ms: ${Math.hypot(c.x, c.y)}`);
});

test("spring: no overshoot, exact zero, inside 1.1 s from the drag limit", () => {
  for (const frameMs of [1000 / 60, 50, 100]) {
    const { t, minX, p } = settle({ x: 405, y: 0 }, frameMs);
    assert.ok(t <= 1100, `settled after ${t} ms at ${frameMs.toFixed(1)} ms frames`);
    assert.ok(minX >= 0, `overshot to ${minX}`);
    assert.deepEqual(p, { x: 0, y: 0 });
  }
});
