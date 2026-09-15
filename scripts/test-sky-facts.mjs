// node --test scripts/test-sky-facts.mjs
// Coverage and shape of content/sky-facts.ts (spec 2026-09-15 §7): every
// selectable thing in the sky has exactly one fact, and every fact has a
// one-liner, a body, a visibility line and at least one well-formed
// citation. Cross-checks the constellation one-liners against the origin
// table that prepare-sky-objects.mjs parsed from Wikipedia, so a hand-typed
// origin can't drift from the generated one.
//
// While the facts are being written in batches, run it as
//   SKY_FACTS_PARTIAL=1 node --test scripts/test-sky-facts.mjs
// to check only the entries that exist so far (unknown ids and duplicates
// still fail). The finished file must pass WITHOUT the variable.
//
// What this cannot check: that each number and claim appears in its cited
// source. That is the self-audit step in the plan, done by reading.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SKY_FACTS } from "../content/sky-facts.ts";

const objects = JSON.parse(await readFile(new URL("../public/sky/objects.json", import.meta.url), "utf8"));
const sky = JSON.parse(await readFile(new URL("../public/sky/sky.json", import.meta.url), "utf8"));

const PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn"];
const CONSTELLATIONS = Object.keys(sky.constellations);
const SHOWERS = objects.showers.map((s) => s.id);
const EXPECTED = [
  ...objects.objects.map((o) => o.id),
  ...PLANETS,
  "moon",
  "iss",
  "milky-way",
  ...SHOWERS,
  ...CONSTELLATIONS,
];
/** The 30 best-known constellations, whose cards carry mythology (spec §7). */
const MYTH = [
  "And", "Aql", "Aqr", "Ari", "Aur", "Boo", "Cnc", "CMa", "Cap", "Cas", "Cen", "Cep", "Cet", "CrB", "Cyg",
  "Dra", "Gem", "Her", "Hya", "Leo", "Lyr", "Oph", "Ori", "Peg", "Per", "Sco", "Sgr", "Tau", "UMa", "Vir",
];
const PARTIAL = process.env.SKY_FACTS_PARTIAL === "1";
const byId = new Map(SKY_FACTS.map((f) => [f.id, f]));
/** The fact for `id`, or null when a partial run hasn't reached it yet. */
function factFor(id) {
  const f = byId.get(id);
  if (!f && !PARTIAL) assert.fail(`missing fact: ${id}`);
  return f ?? null;
}
const today = new Date().toISOString().slice(0, 10);
const cites = (fact, re) => fact.citations.some((c) => re.test(c.url));

test("coverage: exactly one fact per selectable id", () => {
  assert.equal(EXPECTED.length, 138);
  assert.equal(byId.size, SKY_FACTS.length, "duplicate fact ids");
  const missing = EXPECTED.filter((id) => !byId.has(id));
  const unknown = SKY_FACTS.map((f) => f.id).filter((id) => !EXPECTED.includes(id));
  assert.deepEqual(unknown, [], `facts for unknown ids: ${unknown.join(", ")}`);
  if (PARTIAL) console.log(`# partial run: ${SKY_FACTS.length} of ${EXPECTED.length} facts written`);
  else assert.deepEqual(missing, [], `missing facts: ${missing.join(", ")}`);
});

test("every fact: kind, one-liner, body, visibility", () => {
  for (const f of SKY_FACTS) {
    assert.ok(f.kind.length > 0 && f.kind.length <= 60, `${f.id}: kind "${f.kind}"`);
    assert.ok(f.oneLiner.length > 0 && f.oneLiner.length <= 64, `${f.id}: oneLiner is ${f.oneLiner.length} chars`);
    assert.ok(!/[.]$/.test(f.oneLiner), `${f.id}: the one-liner is a label, no closing period`);
    assert.ok(Array.isArray(f.body) && f.body.length >= 1 && f.body.length <= 3, `${f.id}: body has ${f.body.length} sentences`);
    for (const s of f.body) {
      assert.ok(s.trim().length > 0, `${f.id}: empty body sentence`);
      assert.match(s, /[.!?][”"’)]?$/, `${f.id}: body sentence without an ending: "${s}"`);
      const curlyOpen = (s.match(/“/g) ?? []).length;
      const curlyClose = (s.match(/”/g) ?? []).length;
      assert.equal(curlyOpen, curlyClose, `${f.id}: unbalanced quotation marks in "${s}"`);
      assert.equal((s.match(/"/g) ?? []).length % 2, 0, `${f.id}: unbalanced straight quotes in "${s}"`);
    }
    assert.match(f.visibility, /^(Naked eye|Binoculars|Telescope|Not visible)/, `${f.id}: visibility "${f.visibility}"`);
  }
});

test("every citation is complete (APA fields, http(s) URL, a real access date)", () => {
  for (const f of SKY_FACTS) {
    assert.ok(f.citations.length >= 1, `${f.id}: no citation`);
    for (const c of f.citations) {
      for (const k of ["author", "year", "title", "site", "url", "accessed"]) {
        assert.ok(typeof c[k] === "string" && c[k].trim().length > 0, `${f.id}: citation missing ${k}`);
      }
      assert.match(c.url, /^https?:\/\/\S+$/, `${f.id}: url ${c.url}`);
      assert.match(c.year, /^(\d{4}|n\.d\.)$/, `${f.id}: year ${c.year}`);
      assert.match(c.accessed, /^\d{4}-\d{2}-\d{2}$/, `${f.id}: accessed ${c.accessed}`);
      assert.ok(c.accessed >= "2026-09-15" && c.accessed <= today, `${f.id}: accessed ${c.accessed} is outside 2026-09-15..${today}`);
    }
  }
});

test("constellations: origin one-liner agrees with the generated table; sources", () => {
  for (const abbr of CONSTELLATIONS) {
    const f = factFor(abbr);
    if (!f) continue;
    const o = objects.constellations[abbr];
    assert.match(f.kind, /^Constellation/, `${abbr}: kind "${f.kind}"`);
    if (o.ancient && o.year === null) {
      assert.match(f.oneLiner, /Ptolemy/, `${abbr}: ancient, but "${f.oneLiner}" doesn't name Ptolemy`);
    } else {
      assert.ok(f.oneLiner.includes(String(o.year)), `${abbr}: "${f.oneLiner}" lacks the table's year ${o.year}`);
      const lead = o.ancient ? o.by[o.by.length - 1] : o.by[0]; // the later originator for a split ancient figure
      assert.ok(f.oneLiner.includes(lead), `${abbr}: "${f.oneLiner}" lacks ${lead}`);
    }
    if (o.splitFrom) assert.ok(f.oneLiner.includes(o.splitFrom), `${abbr}: "${f.oneLiner}" lacks "${o.splitFrom}"`);
    assert.ok(cites(f, /IAU_designated_constellations/), `${abbr}: must cite the IAU designated constellations table`);
  }
  for (const abbr of MYTH) {
    const f = factFor(abbr);
    if (f) assert.ok(cites(f, /^https?:\/\/www\.ianridpath\.com\/startales\//), `${abbr}: mythology must cite Star Tales`);
  }
});

test("showers, planets, the Moon, spacecraft, the ISS: required sources", () => {
  for (const id of SHOWERS) {
    const f = factFor(id);
    if (!f) continue;
    assert.match(f.kind, /^Meteor shower/, `${id}: kind`);
    assert.ok(cites(f, /^https:\/\/web\.archive\.org\/web\/20260905025331id_\/https:\/\/www\.imo\.net\/files\/meteor-shower\/cal2026\.pdf$/), `${id}: must cite the IMO 2026 calendar`);
  }
  for (const id of [...PLANETS, "moon"]) {
    const f = factFor(id);
    if (f) assert.ok(cites(f, /^https:\/\/science\.nasa\.gov\//), `${id}: must cite NASA Science`);
  }
  for (const id of ["voyager-1", "voyager-2"]) {
    const f = factFor(id);
    if (!f) continue;
    assert.ok(cites(f, /^https:\/\/ssd\.jpl\.nasa\.gov\/horizons/), `${id}: must cite JPL Horizons (the position)`);
    assert.ok(cites(f, /^https:\/\/science\.nasa\.gov\/mission\/voyager\//), `${id}: must cite NASA's Voyager page`);
  }
  const iss = factFor("iss");
  if (iss) assert.ok(cites(iss, /^https:\/\/celestrak\.org\//), "iss: must cite CelesTrak (the orbit data)");
  for (const id of ["voyager-1", "voyager-2", "hubble-deep-field"]) {
    const f = factFor(id);
    if (f) assert.match(f.visibility, /^Not visible/, `${id}: nothing to see there, only a direction`);
  }
  const m87 = factFor("m87");
  if (m87) assert.match(m87.body.join(" "), /black hole/i, "m87: the card covers the galaxy and its black hole (spec §4)");
});
