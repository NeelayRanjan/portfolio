// node --test scripts/test-slaac-reroute.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as R from "../lib/slaac/reroute.ts";
import { Navaids } from "../lib/slaac/navaids.ts";
const V = JSON.parse(readFileSync(new URL("./slaac-vectors/reroute.json", import.meta.url)));
const wpdb = new Navaids(V.snap_table.names, V.snap_table.lat, V.snap_table.lon);

for (const c of V.local_reroute) {
  test(`localReroute ${c.label}`, () => {
    let k = 0; const calls = [];
    const sampler = (e, r) => { calls.push([e, r]); return c.arcs[k++]; };
    const opts = { wpdb, lockDistNm: 10, snapTolNm: 100, devSpacingNm: 150, rdpTolNm: 10, hug: c.hug, hugMarginNm: c.margin, clearMarginNm: c.margin };
    const out = R.localReroute(c.nominal, c.polys_m, sampler, opts);
    assert.deepEqual(calls.map(([e, r]) => [...e, ...r].map((x) => +x.toFixed(9))), c.calls.map((x) => x.map((y) => +y.toFixed(9))));
    assert.deepEqual(out.roles, c.roles);
    assert.deepEqual(out.plan.map((f) => f[0]), c.plan.map((f) => f[0]));
    out.plan.forEach((f, i) => { assert.ok(Math.abs(f[1] - c.plan[i][1]) < 1e-9 && Math.abs(f[2] - c.plan[i][2]) < 1e-9); });
    const anchors = R.anchorsFor(c.nominal, c.polys_m, opts);
    assert.equal(anchors.length, c.calls.length, "anchorsFor predicts every sampler call");
  });
}

test("refineRouteSua direct cases", () => {
  for (const c of V.refine) assert.deepEqual(R.refineRouteSua(c.route, c.dense, c.polys_m, { wpdb, snapTolNm: 100, maxLegNm: 150, rdpTolNm: 10, clearMarginNm: c.margin }).map((f) => f[0]), c.out.map((f) => f[0]));
});

test("endpoint inside: returns, reports the residual, never hangs", () => {
  const c = V.endpoint_inside;
  const t0 = Date.now();
  const out = R.localReroute(c.nominal, c.polys_m, () => c.arcs[0], { wpdb, lockDistNm: 10, snapTolNm: 100, devSpacingNm: 150, rdpTolNm: 10, hug: true, hugMarginNm: 25, clearMarginNm: 25 });
  assert.ok(Date.now() - t0 < 2000);
  assert.ok(R.metrics(c.nominal, out.plan, c.polys_m).legCrossings >= 1);
});

// Beyond the brief: anchorsFor names the exact pairs, not just the count, and the
// endpoint-inside run reproduces the owner's plan fix for fix.
test("anchorsFor predicts each sampler call's entry and rejoin exactly", () => {
  for (const c of [...V.local_reroute, { ...V.endpoint_inside, label: "endpoint inside" }]) {
    const opts = { wpdb, lockDistNm: 10, snapTolNm: 100, devSpacingNm: 150, rdpTolNm: 10, hug: c.hug, hugMarginNm: c.margin, clearMarginNm: c.margin };
    const got = R.anchorsFor(c.nominal, c.polys_m, opts).map(({ entry, rejoin }) => [entry[1], entry[2], rejoin[1], rejoin[2]]);
    assert.deepEqual(got, c.calls, c.label);
  }
});

test("endpoint inside reproduces the owner's plan and roles", () => {
  const c = V.endpoint_inside;
  const out = R.localReroute(c.nominal, c.polys_m, () => c.arcs[0], { wpdb, lockDistNm: 10, snapTolNm: 100, devSpacingNm: 150, rdpTolNm: 10, hug: true, hugMarginNm: 25, clearMarginNm: 25 });
  assert.deepEqual(out.plan.map((f) => f[0]), c.plan.map((f) => f[0]));
  assert.deepEqual(out.roles, c.roles);
});

test("kNearest: ascending, ties by lower index, matches a full sort", () => {
  const nv = new (wpdb.constructor)(["A", "B", "C", "D"], [40, 40, 40, 41], [-100, -100, -99, -100]);
  const r = nv.kNearest(nv.point(0), 3);
  assert.deepEqual(r.idx, [0, 1, 2]);
  const p = [nv.point(2)[0] + 5000, nv.point(2)[1] - 7000];
  const full = [0, 1, 2, 3].map((i) => [Math.hypot(p[0] - nv.point(i)[0], p[1] - nv.point(i)[1]), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(nv.kNearest(p, 4).idx, full.map((x) => x[1]));
});
