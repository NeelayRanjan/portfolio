// node --test scripts/test-sky-secret.mjs
// Pins lib/sky-secret.ts: the rule that decides whether a paper-mode click
// on the sky is the secret door into stargaze (Task 17). Only a click (under
// the slop) on the sky whose hit test resolves to a CONSTELLATION counts; a
// symbol or name that wins the hit test, a drag, a press off the sky, or a
// click while already stargazing never does.
import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/sky-secret.ts";

const base = {
  stargazing: false,
  travelPx: 0,
  clickSlopPx: 5,
  onSky: true,
  picked: { kind: "constellation", id: "UMa" },
};

test("a still click on a constellation's lines is the door", () => {
  assert.equal(S.secretDoorTarget(base), "UMa");
  assert.equal(S.secretDoorTarget({ ...base, travelPx: 4.99 }), "UMa");
});

test("a symbol or drawn name that wins the hit test is not the door", () => {
  assert.equal(S.secretDoorTarget({ ...base, picked: { kind: "hit", id: "m31" } }), null);
  assert.equal(S.secretDoorTarget({ ...base, picked: { kind: "hit", id: "milkyway" } }), null);
});

test("empty sky, a drag, a press off the sky, or stargaze itself is not the door", () => {
  assert.equal(S.secretDoorTarget({ ...base, picked: null }), null);
  assert.equal(S.secretDoorTarget({ ...base, travelPx: 5 }), null);
  assert.equal(S.secretDoorTarget({ ...base, travelPx: 120 }), null);
  assert.equal(S.secretDoorTarget({ ...base, travelPx: Number.NaN }), null);
  assert.equal(S.secretDoorTarget({ ...base, onSky: false }), null);
  assert.equal(S.secretDoorTarget({ ...base, stargazing: true }), null);
});

test("the caption's timing matches the brief (~400ms fades, ~6s up)", () => {
  assert.equal(S.SECRET_FADE_MS, 400);
  assert.equal(S.SECRET_HOLD_MS, 6000);
});
