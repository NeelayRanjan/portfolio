// node --test scripts/test-chess-selfplay.mjs
// Pins lib/chess-selfplay.ts, self-play's one departure from argmin: it may
// take the second or third choice, but only when that move is nearly tied with
// the first, only on a coin flip, and never past the game's budget. The panel
// owns the budget; this pins the rule it applies at each position.
import test from "node:test";
import assert from "node:assert/strict";
import {
  mulberry32,
  pickSelfPlayMove,
  SELF_PLAY_MAX_DEVIATIONS,
  SELF_PLAY_TAKE_P,
  SELF_PLAY_TIE_RATIO,
  SELF_PLAY_TOP_K,
} from "../lib/chess-selfplay.ts";

const r = (...priors) => priors.map((prior, i) => ({ uci: `m${i}`, prior }));
const always = () => 0; // every coin says take it, every draw picks the first alternative

test("the constants are the measured ones", () => {
  // 2026-09-17 spike: at 0.8 about one position in six qualifies, and 12
  // presses gave 9 distinct games with 10 mates. Change these and re-measure.
  assert.equal(SELF_PLAY_TIE_RATIO, 0.8);
  assert.equal(SELF_PLAY_MAX_DEVIATIONS, 2);
  assert.equal(SELF_PLAY_TAKE_P, 0.5);
  assert.equal(SELF_PLAY_TOP_K, 3);
});

test("mulberry32 is deterministic and in [0, 1)", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1, `${x}`);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test("no budget left: always the top move, and no randomness spent", () => {
  let calls = 0;
  const rand = () => (calls++, 0);
  assert.deepEqual(pickSelfPlayMove(r(0.34, 0.33, 0.33), 0, rand), { index: 0, ratio: 1 });
  assert.equal(calls, 0);
});

test("a runner-up under the tie ratio is never taken, and no randomness spent", () => {
  let calls = 0;
  const rand = () => (calls++, 0);
  // 0.39 / 0.5 = 0.78, just under 0.8
  assert.deepEqual(pickSelfPlayMove(r(0.5, 0.39, 0.11), 2, rand), { index: 0, ratio: 1 });
  assert.equal(calls, 0, "rand must only be drawn at a qualifying position, so the sequence stays tied to near-ties");
});

test("a near-tied runner-up is taken when the coin says so", () => {
  const p = pickSelfPlayMove(r(0.4, 0.35, 0.25), 2, always);
  assert.equal(p.index, 1);
  assert.ok(Math.abs(p.ratio - 0.875) < 1e-12);
});

test("the coin can decline: at or above the take probability, the top move stands", () => {
  assert.deepEqual(pickSelfPlayMove(r(0.4, 0.35, 0.25), 2, () => SELF_PLAY_TAKE_P), { index: 0, ratio: 1 });
});

test("with both runners-up tied, either can be taken", () => {
  const seq = (...xs) => { let i = 0; return () => xs[i++]; };
  assert.equal(pickSelfPlayMove(r(0.36, 0.33, 0.31), 2, seq(0, 0)).index, 1);
  assert.equal(pickSelfPlayMove(r(0.36, 0.33, 0.31), 2, seq(0, 0.9)).index, 2);
});

test("never deeper than the third choice, even when the fourth is tied", () => {
  for (let k = 0; k < 50; k++) {
    const idx = pickSelfPlayMove(r(0.25, 0.25, 0.25, 0.25), 2, mulberry32(k)).index;
    assert.ok(idx <= 2, `picked index ${idx}`);
  }
});

test("a single legal move is always played", () => {
  assert.deepEqual(pickSelfPlayMove(r(1), 2, always), { index: 0, ratio: 1 });
});

test("property: any departure from the top move is a near-tie in the top three", () => {
  const gen = mulberry32(2026);
  let departures = 0;
  for (let n = 0; n < 5000; n++) {
    const len = 1 + Math.floor(gen() * 40);
    const raw = Array.from({ length: len }, () => gen() ** 3);
    const z = raw.reduce((a, b) => a + b, 0);
    const priors = raw.map((x) => x / z).sort((a, b) => b - a);
    const p = pickSelfPlayMove(r(...priors), 1 + Math.floor(gen() * 2), mulberry32(n));
    if (p.index > 0) {
      departures++;
      assert.ok(p.index < SELF_PLAY_TOP_K, `index ${p.index}`);
      assert.ok(p.ratio >= SELF_PLAY_TIE_RATIO, `ratio ${p.ratio}`);
      assert.ok(Math.abs(p.ratio - priors[p.index] / priors[0]) < 1e-12);
    } else {
      assert.equal(p.ratio, 1);
    }
  }
  assert.ok(departures > 100, `only ${departures} departures in 5000 draws; the property ran on almost nothing`);
});
