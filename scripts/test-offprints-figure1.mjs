import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bestKey, fillReadout, pctOf, readoutParts, tintWidth } from "../lib/offprints/figure1.ts";

const DATA = JSON.parse(
  readFileSync(new URL("../content/offprints/hybrid-attention/figure1.json", import.meta.url), "utf8"),
);
const ROW_IT = DATA.sentence.attention[DATA.defaultHead][13];

test("0.896 rounds to 90", () => {
  assert.equal(pctOf(0.896), "90");
  assert.equal(pctOf(0.504), "50");
});

test("tint width for w = 0.896 is 6 + 0.896^0.6 * 100, capped at 92", () => {
  assert.equal(tintWidth(0.896), 92); // 6 + 93.62 caps
  assert.ok(Math.abs(tintWidth(0.25) - (6 + Math.pow(0.25, 0.6) * 100)) < 1e-9);
  assert.equal(tintWidth(0), 6);
});

test("the best key is taken over the causal prefix only", () => {
  assert.equal(bestKey(ROW_IT, 13), 5); // " it" -> " fence"
  assert.equal(bestKey([0.2, 0.3, 0.9], 1), 1); // index 2 is after the query
  assert.equal(bestKey([0.5, 0.5], 1), 0); // first on a tie
});

test("the readout fills its three slots and keeps the rest", () => {
  const t = "“{from}” puts {pct}% of its attention on “{to}”";
  assert.deepEqual(readoutParts(t), ["“", "{from}", "” puts ", "{pct}", "% of its attention on “", "{to}", "”"]);
  assert.equal(fillReadout(t, "it", "90", "fence"), "“it” puts 90% of its attention on “fence”");
});
