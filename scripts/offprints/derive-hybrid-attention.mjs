#!/usr/bin/env node
// scripts/offprints/derive-hybrid-attention.mjs
//
// HAND-RUN ONLY. Never wire this to prebuild/predev: it reads
// external_materials/, which is gitignored (a symlink into the owner's asset
// directory) and doesn't exist in Vercel's build image. Its output is
// committed.
//
// Derives Offprints No. 1's Figure 1 data from the owner's extraction of
// Qwen3.5-0.8B-Base (external_materials/concepts/hybrid-attention/
// hybrid-data.json, written by extract.py beside it). Run from the repo root:
//
//   node scripts/offprints/derive-hybrid-attention.mjs
//
// Writes content/offprints/hybrid-attention/figure1.json: the cat sentence
// (sentence 0) only, layer 7's attention as [head][query][key], 4 decimals,
// the causal zeros kept. Assert-before-write: nothing is written if any head's
// causal row (keys 0..query) does not sum to 1 ± 0.02, or if head 1's "it"
// row puts less than 0.85 on "fence" (the fact the caption and readout rest
// on).

import { readFileSync, writeFileSync } from "node:fs";

const SRC = "external_materials/concepts/hybrid-attention/hybrid-data.json";
const OUT = "content/offprints/hybrid-attention/figure1.json";
const LAYER = 7;
const SENTENCE = 0;
const DEFAULT_HEAD = 1;
const EXTRACTED = "2026-11-01";
const IT = 13;
const FENCE = 5;

function fail(msg) {
  console.error(`derive-hybrid-attention: REFUSING TO WRITE: ${msg}`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(readFileSync(SRC, "utf8"));
} catch (err) {
  fail(`cannot read ${SRC} (${err.message}); run from the repo root on the owner's machine`);
}

const s = raw.sentences?.[SENTENCE];
if (!s) fail(`no sentence ${SENTENCE}`);
const tokens = s.tokens;
const att = s.attention?.[String(LAYER)];
if (!Array.isArray(tokens) || !Array.isArray(att)) fail(`sentence ${SENTENCE} lacks tokens or layer ${LAYER} attention`);
const T = tokens.length;
if (T !== 15) fail(`sentence ${SENTENCE} has ${T} tokens, expected 15 (the cat sentence)`);
if (att.length !== 8) fail(`layer ${LAYER} has ${att.length} heads, expected 8`);
if (typeof raw.model !== "string" || raw.model.trim() === "") fail("the extraction names no model");

const attention = att.map((head, h) => {
  if (head.length !== T) fail(`head ${h} has ${head.length} rows, expected ${T}`);
  return head.map((row, q) => {
    if (row.length !== T) fail(`head ${h} row ${q} has ${row.length} keys, expected ${T}`);
    let sum = 0;
    for (let k = 0; k <= q; k++) sum += row[k];
    if (Math.abs(sum - 1) > 0.02) fail(`head ${h} row ${q} sums to ${sum.toFixed(4)} over its causal prefix`);
    return row.map((w) => Math.round(w * 1e4) / 1e4);
  });
});

if (tokens[IT] !== " it" || tokens[FENCE] !== " fence") {
  fail(`token ${IT} is ${JSON.stringify(tokens[IT])} and ${FENCE} is ${JSON.stringify(tokens[FENCE])}, expected " it" and " fence"`);
}
const itFence = attention[DEFAULT_HEAD][IT][FENCE];
if (!(itFence >= 0.85)) fail(`attention[${DEFAULT_HEAD}][${IT}][${FENCE}] is ${itFence}, under 0.85`);

const out = {
  model: raw.model,
  layer: LAYER,
  extracted: EXTRACTED,
  sentence: { tokens, attention },
  defaultHead: DEFAULT_HEAD,
};
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`wrote ${OUT}: ${T} tokens, ${attention.length} heads, it -> fence ${itFence}`);
