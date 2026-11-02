import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PEEL,
  farCorner,
  cutFromPointer,
  releaseTarget,
  easeOutCubic,
  flapPath,
  clipPolygon,
  shadowOffset,
  shadowBlur,
} from "../lib/offprints/peel.ts";

test("farCorner is width + height + 120", () => {
  assert.equal(farCorner(1280, 800), 2200);
});

test("cutFromPointer clamps between rest and the far corner", () => {
  assert.equal(cutFromPointer(10, 10, 1280, 800), 40);
  assert.equal(cutFromPointer(300, 200, 1280, 800), 500);
  assert.equal(cutFromPointer(5000, 5000, 1280, 800), 2200);
});

test("releaseTarget opens at 40% of the far corner", () => {
  assert.equal(releaseTarget(879, 1280, 800), "rest");
  assert.equal(releaseTarget(880, 1280, 800), "open");
});

test("easeOutCubic endpoints and midpoint", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(0.5), 0.875);
});

test("flapPath follows the brief's formula", () => {
  const c = 100;
  assert.equal(
    flapPath(c),
    `M ${c} 0 Q ${c} ${c * 0.6} ${c * 0.96} ${c * 0.96} Q ${c * 0.6} ${c} 0 ${c} Z`,
  );
  assert.equal(flapPath(100), "M 100 0 Q 100 60 96 96 Q 60 100 0 100 Z");
});

test("clipPolygon describes the uncovered triangle", () => {
  assert.equal(clipPolygon(40), "polygon(0 0, 40px 0, 0 40px)");
});

test("shadow offset and blur cap at 10", () => {
  assert.equal(shadowOffset(2200), 10);
  assert.equal(shadowBlur(2200), 10);
});

test("PEEL constants match the brief", () => {
  assert.deepEqual(PEEL, {
    rest: 40, hover: 52, slop: 6, openMs: 650, threshold: 0.4,
    hintTo: 66, hintDelayMs: 1200, hintOutMs: 900, hintBackMs: 700,
  });
});
