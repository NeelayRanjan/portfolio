// node --test scripts/test-slaac-summary.mjs
// Figure 3's all-flights summary (lib/slaac/summary.ts): the numbers that
// replace a 373-row table.
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFlights } from "../lib/slaac/summary.ts";

const f = (status, addedNm, addedPct, minClearanceNm, legCrossings = 0) => ({
  status, metrics: { nominalNm: 1000, planNm: 1000 + addedNm, addedNm, addedPct, legCrossings, minClearanceNm },
});

test("counts: checked, affected, rerouted, can't clear; untouched excluded from the rest", () => {
  const s = summarizeFlights([
    f("untouched", 0, 0, 80), f("ok", 10, 1, 30), f("ok", 30, 3, 26), f("cannot-clear", 50, 5, 0, 2), f("untouched", 0, 0, 200),
  ], 25);
  assert.equal(s.checked, 5);
  assert.equal(s.affected, 3);
  assert.equal(s.rerouted, 2);
  assert.equal(s.cannotClear, 1);
});

test("medians over rerouted flights only: odd and even counts", () => {
  const odd = summarizeFlights([f("ok", 5, 0.5, 30), f("ok", 40, 4, 30), f("ok", 20, 2, 30), f("cannot-clear", 999, 99, 0, 1), f("untouched", 0, 0, 90)], 25);
  assert.equal(odd.medianAddedNm, 20);
  assert.equal(odd.medianAddedPct, 2);
  const even = summarizeFlights([f("ok", 10, 1, 30), f("ok", 40, 4, 30), f("ok", 20, 2, 30), f("ok", -6, -0.5, 30)], 25);
  assert.equal(even.medianAddedNm, 15);
  assert.equal(even.medianAddedPct, 1.5);
});

test("worst added distance is the largest over rerouted flights, with its own %", () => {
  const s = summarizeFlights([f("ok", 10, 1, 30), f("ok", 140, 9, 30), f("cannot-clear", 999, 99, 0, 1)], 25);
  assert.equal(s.maxAddedNm, 140);
  assert.equal(s.maxAddedPct, 9);
});

test("lowest clearance over affected flights, a cannot-clear counted, and judged against the margin", () => {
  const s = summarizeFlights([f("ok", 10, 1, 31.2), f("ok", 10, 1, 24.96), f("untouched", 0, 0, 3)], 25);
  assert.equal(s.minClearanceNm, 24.96);
  assert.equal(s.belowMargin, true);
  const c = summarizeFlights([f("ok", 10, 1, 31.2), f("cannot-clear", 10, 1, 0, 1)], 25);
  assert.equal(c.minClearanceNm, 0);
  const ok = summarizeFlights([f("ok", 10, 1, 31.2)], 25);
  assert.equal(ok.belowMargin, false);
});

test("empty input and nothing affected: zero counts, no medians", () => {
  for (const input of [[], [f("untouched", 0, 0, 90)]]) {
    const s = summarizeFlights(input, 25);
    assert.equal(s.affected, 0);
    assert.equal(s.rerouted, 0);
    assert.equal(s.cannotClear, 0);
    assert.equal(s.medianAddedNm, null);
    assert.equal(s.medianAddedPct, null);
    assert.equal(s.maxAddedNm, null);
    assert.equal(s.minClearanceNm, null);
    assert.equal(s.belowMargin, false);
  }
  assert.equal(summarizeFlights([], 25).checked, 0);
});
