// node --test scripts/test-slaac-geometry.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as A from "../lib/slaac/albers.ts";
import * as G from "../lib/slaac/geometry.ts";
const V = (n) => JSON.parse(readFileSync(new URL(`./slaac-vectors/${n}.json`, import.meta.url)));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("albers forward and inverse match the owner's projection", () => {
  for (const c of V("albers").cases) {
    const [x, y] = A.albers(c.lat, c.lon);
    close(x, c.x, 1e-6, "x"); close(y, c.y, 1e-6, "y");
    const [la, lo] = A.inverseAlbers(c.x, c.y);
    close(la, c.inv_lat, 1e-9, "lat"); close(lo, c.inv_lon, 1e-9, "lon");
  }
});

test("geometry predicates match, case for case", () => {
  const v = V("geometry");
  for (const c of v.inside) c.pts.forEach((p, i) => assert.equal(G.inside(p, c.poly), c.out[i], `inside ${i}`));
  for (const c of v.nearest_boundary) c.pts.forEach((p, i) => { const q = G.nearestBoundary(p, c.poly); close(q[0], c.out[i][0], 1e-6, "nbx"); close(q[1], c.out[i][1], 1e-6, "nby"); });
  for (const c of v.seg_crosses_poly) assert.equal(G.segCrossesPoly(c.a, c.b, c.poly), c.out);
  for (const c of v.seg_poly_dist) close(G.segPolyDist(c.a, c.b, c.poly), c.out, 1e-6, "segdist");
  for (const c of v.seg_illegal) assert.equal(G.segIllegal(c.a, c.b, c.polys, c.margin_m), c.out);
  for (const c of v.pt_illegal) assert.equal(G.ptIllegal(c.p, c.polys, c.margin_m), c.out);
  for (const c of v.dist_to_sua_nm) close(G.distToSuaNm(c.p, c.polys), c.out, 1e-9, "dist");
  for (const c of v.rdp_mask) assert.deepEqual(G.rdpMask(c.xy, c.tol_m), c.out);
});
