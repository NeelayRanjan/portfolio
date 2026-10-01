// node --test scripts/test-slaac-ring.mjs
// The figure's drawn-airspace gate (components/figures/ring.ts): a ring the
// visitor closes must be a simple polygon, or the reroute's inside/crossing
// tests mean nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { checkRing } from "../components/figures/ring.ts";

test("a triangle is ok", () => {
  assert.deepEqual(checkRing([[30, -90], [35, -85], [30, -80]]), { ok: true });
});

test("two points are too few", () => {
  assert.deepEqual(checkRing([[30, -90], [35, -85]]), { ok: false, reason: "too-few" });
  assert.deepEqual(checkRing([]), { ok: false, reason: "too-few" });
});

test("a bow-tie crosses itself", () => {
  // (30,-90) -> (35,-80) -> (30,-80) -> (35,-90): edges 0 and 2 cross.
  assert.deepEqual(checkRing([[30, -90], [35, -80], [30, -80], [35, -90]]), { ok: false, reason: "self-crossing" });
});

test("a concave L-shape is ok", () => {
  const L = [[30, -95], [30, -85], [32, -85], [32, -92], [38, -92], [38, -95]];
  assert.deepEqual(checkRing(L), { ok: true });
});

test("a closing duplicate is dropped, and the ring is ok", () => {
  assert.deepEqual(checkRing([[30, -90], [35, -85], [30, -80], [30, -90]]), { ok: true });
  // ...and a closed two-point "ring" is still too few once the duplicate goes.
  assert.deepEqual(checkRing([[30, -90], [35, -85], [30, -90]]), { ok: false, reason: "too-few" });
});

test("a repeated vertex doesn't count: [A, B, B] is too few", () => {
  assert.deepEqual(checkRing([[30, -90], [35, -85], [35, -85]]), { ok: false, reason: "too-few" });
  // ...but a real triangle with one doubled click is still a triangle.
  assert.deepEqual(checkRing([[30, -90], [35, -85], [35, -85], [30, -80]]), { ok: true });
});

test("three collinear points have no area", () => {
  // One meridian: a straight line in Albers.
  assert.deepEqual(checkRing([[30, -90], [35, -90], [40, -90]]), { ok: false, reason: "degenerate" });
});
