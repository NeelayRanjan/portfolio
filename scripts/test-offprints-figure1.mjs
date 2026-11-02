import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bestEarlier, fillCaption, fillReadout, paperText, pctOf, readoutParts, tintWidth } from "../lib/offprints/figure1.ts";

const DATA = JSON.parse(
  readFileSync(new URL("../content/offprints/hybrid-attention/figure1.json", import.meta.url), "utf8"),
);
const ROW_IT = DATA.sentence.attention[DATA.defaultHead][13];

test("0.896 rounds to 90", () => {
  assert.equal(pctOf(0.896), "90");
  assert.equal(pctOf(0.504), "50");
});

test("tint width has two regimes: min(40, 6 + w^0.6 * 100) below 0.45, a solid 92 from it", () => {
  assert.equal(tintWidth(0.896), 92);
  assert.equal(tintWidth(0.687), 92);
  assert.equal(tintWidth(0.45), 92);
  assert.equal(tintWidth(0.25), 40); // 6 + 43.5 caps at 40
  assert.ok(Math.abs(tintWidth(0.05) - (6 + Math.pow(0.05, 0.6) * 100)) < 1e-9);
  assert.equal(tintWidth(0), 6);
});

test("paper text exactly in the solid regime", () => {
  assert.equal(paperText(0.4499), false);
  assert.equal(paperText(0.45), true);
  assert.equal(paperText(0.896), true);
});

test("the best key is the best EARLIER token, never the asker or a later one", () => {
  assert.equal(bestEarlier(ROW_IT, 13), 5); // " it" -> " fence"
  assert.equal(bestEarlier([1], 0), -1); // the first token has nothing earlier
  assert.equal(bestEarlier([0.496, 0.504], 1), 0); // " cat": self-dominant, still "The"
  assert.equal(bestEarlier([0.1, 0.2, 0.6, 0.1], 3), 2); // self 0.1, later ignored
  assert.equal(bestEarlier([0.2, 0.2, 0.6], 2), 0); // first on a tie
  const cat = DATA.sentence.attention[DATA.defaultHead][1];
  assert.equal(bestEarlier(cat, 1), 0);
});

test("the caption fills from the data", () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  assert.equal(
    fillCaption("{model}, layer {layer}, head {head}, extracted {date}.", DATA, months),
    "Qwen3.5-0.8B-Base, layer 7, head 1, extracted 1 Nov 2026.",
  );
});

test("the readout fills its three slots and keeps the rest", () => {
  const t = "“{from}” puts {pct}% of its attention on “{to}”";
  assert.deepEqual(readoutParts(t), ["“", "{from}", "” puts ", "{pct}", "% of its attention on “", "{to}", "”"]);
  assert.equal(fillReadout(t, "it", "90", "fence"), "“it” puts 90% of its attention on “fence”");
});
