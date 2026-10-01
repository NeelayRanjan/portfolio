// node --test scripts/test-slaac-data.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as D from "../lib/slaac/data.ts";

const pub = (n) => new URL(`../public/slaac/${n}`, import.meta.url);
const J = (n) => JSON.parse(readFileSync(pub(n)));
const SRC = JSON.parse(readFileSync(new URL("./slaac/launch-sua-sources.json", import.meta.url)));
const APPROVED = ["ksc", "vandenberg", "wallops", "spaceport-america", "starbase", "van-horn"];
const BOX = { lat: [24, 50], lon: [-126, -66] };

// Drop one field (or one nested path) from a deep copy.
const without = (o, ...path) => {
  const c = structuredClone(o);
  let t = c;
  for (const k of path.slice(0, -1)) t = t[k];
  delete t[path[path.length - 1]];
  return c;
};

test("navaids: parallel arrays of 3-letter names inside the box", () => {
  const n = J("navaids.json");
  assert.equal(n.version, 1);
  assert.ok(n.names.length >= 300, `${n.names.length} navaids`);
  assert.equal(n.lat.length, n.names.length);
  assert.equal(n.lon.length, n.names.length);
  n.names.forEach((nm, i) => {
    assert.match(nm, /^[A-Z]{3}$/);
    assert.ok(n.lat[i] >= 17 && n.lat[i] <= 50 && n.lon[i] >= -130 && n.lon[i] <= -60, nm);
  });
  assert.doesNotThrow(() => D.validateNavaids(n));
  assert.throws(() => D.validateNavaids(without(n, "lon")));
  assert.throws(() => D.validateNavaids({ ...n, lat: n.lat.slice(1) }));
});

test("us-outline: lon/lat pairs with null segment breaks", () => {
  const o = J("us-outline.json");
  assert.equal(o.version, 1);
  assert.ok(o.lonlat.length > 100);
  assert.ok(o.lonlat.some((p) => p === null), "segment breaks kept");
  for (const p of o.lonlat) if (p) assert.ok(p[0] >= -130 && p[0] <= -60 && p[1] >= 17 && p[1] <= 50);
  assert.doesNotThrow(() => D.validateOutline(o));
  assert.throws(() => D.validateOutline(without(o, "lonlat")));
});

test("launch-sua: approved sites, sourced polygons, sources file agrees", () => {
  const l = J("launch-sua.json");
  assert.equal(l.version, 1);
  assert.match(l.cycle, /^\d{4}-\d\d-\d\d\.\.\d{4}-\d\d-\d\d$/);
  const excludedSites = new Set(SRC.sites.filter((s) => s.excluded && typeof s.excluded === "string").map((s) => s.id));
  const want = APPROVED.filter((id) => !excludedSites.has(id));
  assert.deepEqual(l.sites.map((s) => s.id), want);
  for (const banned of ["white-sands", "mojave", "kodiak"]) assert.ok(!l.sites.some((s) => s.id === banned));
  const listed = new Map(SRC.sites.map((s) => [s.id, new Set(s.designators)]));
  const excludedDesig = new Set(SRC.sites.flatMap((s) => Object.keys(s.excluded && typeof s.excluded === "object" ? s.excluded : {})));
  for (const s of l.sites) {
    assert.ok(s.polys.length >= 1, s.id);
    assert.ok(["charted", "past-tfr"].includes(s.kind));
    if (s.kind === "past-tfr") assert.ok(s.label, `${s.id} past-tfr needs a label`);
    assert.match(s.basis, /^https:\/\//);
    for (const p of s.polys) {
      assert.ok(p.ring.length >= 3, `${s.id} ${p.designator}`);
      assert.match(p.source, /^https:\/\//);
      // merged polygons (ruling R7): every constituent designator is approved and not excluded
      assert.ok(Array.isArray(p.merged_from) && p.merged_from.length >= 1, `${s.id} ${p.designator}: merged_from`);
      assert.equal(p.designator, p.merged_from.join("+"));
      for (const d of p.merged_from) {
        assert.ok(listed.get(s.id).has(d), `${d} not in sources file`);
        assert.ok(!excludedDesig.has(d), `${d} was excluded`);
      }
      assert.ok(Array.isArray(p.sources) && p.sources.length >= 1);
      assert.equal(p.sources[0], p.source);
      for (const u of p.sources) assert.match(u, /^https:\/\//);
      assert.equal(typeof p.clipped, "boolean");
      for (const [la, lo] of p.ring) {
        assert.ok(la >= BOX.lat[0] && la <= BOX.lat[1] && lo >= BOX.lon[0] && lo <= BOX.lon[1], `${p.designator} outside domain box`);
      }
    }
  }
  assert.doesNotThrow(() => D.validateLaunch(l));
  assert.throws(() => D.validateLaunch(without(l, "cycle")));
  assert.throws(() => D.validateLaunch(without(l, "sites", 0, "polys", 0, "source")));
  assert.throws(() => D.validateLaunch(without(l, "sites", 0, "basis")));
  const bad = structuredClone(l);
  bad.sites[0].polys[0].merged_from = ["R-9999"];
  assert.throws(() => D.validateLaunch(bad), "merged_from must join to the designator");
  const bad2 = structuredClone(l);
  bad2.sites[0].polys[0].sources = ["http://example.com"];
  assert.throws(() => D.validateLaunch(bad2), "sources must be https and start with source");
});

test("sources file records why excluded items are out", () => {
  const w = SRC.sites.find((s) => s.id === "wallops");
  assert.ok(w.excluded["W-386"].length > 40);
  assert.ok(!w.designators.includes("W-386"));
  assert.ok(SRC.sites.find((s) => s.id === "spaceport-america").designators.includes("R-5111A"));
});

test("meta validates and rejects a missing field", () => {
  const m = J("meta.json");
  assert.doesNotThrow(() => D.validateMeta(m));
  assert.throws(() => D.validateMeta(without(m, "xy_scale")));
  assert.throws(() => D.validateMeta(without(m, "sampler", "steps")));
  // the gate's outputs (Task 10, rulings R8/R9): optional, but well-formed when present
  if (m.display !== undefined) assert.ok(["snapped", "continuous"].includes(m.display));
  if (m.policies !== undefined) {
    assert.equal(m.display, "snapped");
    assert.ok(m.policies.includes("wide"), "wide is always among the shown policies");
  }
  assert.throws(() => D.validateMeta({ ...m, display: "maybe" }));
  assert.throws(() => D.validateMeta({ ...m, policies: ["sideways"] }));
  assert.throws(() => D.validateMeta({ ...m, policies: [] }));
  assert.throws(() => D.validateMeta({ ...m, policies: ["wide", "wide"] }));
  assert.doesNotThrow(() => D.validateMeta({ ...m, display: "snapped", policies: ["wide", "hug"] }));
  assert.throws(() => D.validateMeta(without(m, "scheduler")));
  assert.throws(() => D.validateMeta({ ...m, version: 2 }));
});

test("airports", () => {
  const a = J("airports.json");
  assert.doesNotThrow(() => D.validateAirports(a));
  assert.throws(() => D.validateAirports(without(a, "airports")));
});

test("routes", () => {
  const r = J("routes.json");
  assert.doesNotThrow(() => D.validateRoutes(r));
  assert.throws(() => D.validateRoutes(without(r, "pairs")));
  assert.throws(() => D.validateRoutes(without(r, "pairs", 0, "routes", 0, "fixes")));
  const hav = (a, b) => {
    const R = 3440.065, rad = Math.PI / 180;
    const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[2] - a[2]) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const airports = J("airports.json").airports;
  const used = new Set();
  for (const p of r.pairs) {
    const id = `${p.origin}-${p.dest}`;
    used.add(p.origin); used.add(p.dest);
    assert.ok(p.routes.length >= 5, `${id}: ${p.routes.length} routes`);
    for (const rt of p.routes) {
      assert.equal(rt.fixes[0][0], p.origin, `${id} first fix`);
      assert.equal(rt.fixes.at(-1)[0], p.dest, `${id} last fix`);
      for (let i = 1; i < rt.fixes.length; i++) assert.ok(hav(rt.fixes[i - 1], rt.fixes[i]) <= 1000, `${id} leg over 1000 nm`);
      for (const [, la, lo] of rt.fixes)
        assert.ok(la >= BOX.lat[0] && la <= BOX.lat[1] && lo >= BOX.lon[0] && lo <= BOX.lon[1], `${id} fix outside domain box`);
    }
  }
  assert.deepEqual([...used].sort(), Object.keys(airports).sort(), "airports.json covers exactly the library's airports");

  // An FRD point (NAV + 3-digit radial + 3-digit distance) must not follow its own parent navaid:
  // that is the fly-over-then-double-back the owner's LM-token geocoding produces.
  let back = 0, total = 0;
  for (const p of r.pairs) {
    for (const rt of p.routes) {
      total++;
      for (let i = 1; i < rt.fixes.length; i++) {
        const prev = rt.fixes[i - 1][0], cur = rt.fixes[i][0];
        assert.ok(!(cur.length === prev.length + 6 && cur.startsWith(prev) && /^\d{6}$/.test(cur.slice(prev.length))),
          `${p.origin}-${p.dest}: ${cur} directly follows its own navaid ${prev}`);
      }
      // coarse doubling-back: along-chord progress (origin to destination) that ever falls >10 nm below its running max
      const [, la0, lo0] = rt.fixes[0], cl = Math.cos((la0 * Math.PI) / 180);
      const xy = rt.fixes.map(([, la, lo]) => [(lo - lo0) * cl * 60, (la - la0) * 60]);
      const e = xy[xy.length - 1], len = Math.hypot(e[0], e[1]);
      let mx = -Infinity, worst = 0;
      for (const q of xy) { const pr = (q[0] * e[0] + q[1] * e[1]) / len; mx = Math.max(mx, pr); worst = Math.max(worst, mx - pr); }
      if (worst > 10) back++;
    }
  }
  console.log(`routes doubling back >10 nm along the chord: ${back} of ${total}`);
  assert.ok(back <= 20, `${back} routes double back`);
});

test("validators reject non-objects", () => {
  for (const v of [D.validateMeta, D.validateRoutes, D.validateNavaids, D.validateAirports, D.validateOutline, D.validateLaunch])
    assert.throws(() => v(null));
});
