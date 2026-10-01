// node --test scripts/test-slaac-view.mjs
// Figure 3's view math (components/figures/reroute-map.ts): the focus box,
// fitting a box into the canvas, and easing between two views.
import test from "node:test";
import assert from "node:assert/strict";
import { albers, NM } from "../lib/slaac/albers.ts";
import { fitBox, lerpView, focusBox, fitLower48, toScreen, fromScreen } from "../components/figures/reroute-map.ts";

const boxOf = (pts) => {
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const [la, lo] of pts) {
    const [x, y] = albers(la, lo);
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
  }
  return b;
};
const OPTS = { padFrac: 0.08, padPx: 8, minExtentM: 400 * NM };

test("fitBox contains the box with its padding, centred, one side tight", () => {
  const box = boxOf([[25.8, -80.3], [40.6, -73.8]]); // KMIA..KJFK
  const w = 600, h = 372;
  const v = fitBox(w, h, 2, box, OPTS);
  const corners = [[box.minX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY], [box.maxX, box.minY]];
  for (const [x, y] of corners) {
    const sx = v.ox + v.scale * x, sy = v.oy - v.scale * y;
    assert.ok(sx >= 8 && sx <= w - 8 && sy >= 8 && sy <= h - 8, `corner at ${sx},${sy}`);
  }
  const bw = (box.maxX - box.minX) * v.scale, bh = (box.maxY - box.minY) * v.scale;
  const tight = Math.max(bw / ((w - 16) / 1.16), bh / ((h - 16) / 1.16));
  assert.ok(Math.abs(tight - 1) < 1e-9, `one side fills the padded canvas: ${tight}`);
  // north up, one scale for both axes (aspect kept), centred
  const cx = v.ox + v.scale * (box.minX + box.maxX) / 2, cy = v.oy - v.scale * (box.minY + box.maxY) / 2;
  assert.ok(Math.abs(cx - w / 2) < 1e-6 && Math.abs(cy - h / 2) < 1e-6);
  assert.equal(v.w, w); assert.equal(v.h, h); assert.equal(v.dpr, 2);
});

test("fitBox enforces the minimum extent on the shorter side", () => {
  const box = boxOf([[37.6, -122.4], [37.7, -122.2]]); // a few nm
  const v = fitBox(400, 248, 1, box, OPTS);
  const shortM = Math.min(400, 248) / v.scale;
  assert.ok(Math.abs(shortM - 400 * NM) < 1, `shorter side spans ${shortM / NM} nm`);
});

test("fitLower48 is fitBox over the lower-48 box with 8px and no extra padding", () => {
  const v = fitLower48(836, 518, 1);
  assert.ok(v.scale > 0 && v.w === 836 && v.h === 518);
});

test("lerpView: exact endpoints, scale between them in the middle", () => {
  const a = fitLower48(600, 372, 1);
  const b = fitBox(600, 372, 1, boxOf([[25.8, -80.3], [40.6, -73.8]]), OPTS);
  assert.deepEqual(lerpView(a, b, 0), a);
  assert.deepEqual(lerpView(a, b, 1), b);
  const m = lerpView(a, b, 0.5);
  assert.ok(m.scale > Math.min(a.scale, b.scale) && m.scale < Math.max(a.scale, b.scale));
});

test("focusBox keeps a launch polygon 100 nm from a route and drops one 400 nm away", () => {
  const route = [[35, -100], [35, -90]];
  const sq = (lat, lon, d = 0.3) => [[lat, lon], [lat, lon + d], [lat + d, lon + d], [lat + d, lon]];
  const near = sq(35 + 100 / 60, -95); // 100 nm north (1 arc-minute of latitude = 1 nm)
  const far = sq(35 + 400 / 60, -95);  // 400 nm north
  const b = focusBox([route], [near, far], [], [], { launchWithinNm: 150 });
  const [, yNear] = albers(near[2][0], near[2][1]);
  const [, yFar] = albers(far[0][0], far[0][1]);
  assert.ok(b.maxY >= yNear - 1, "near polygon inside the focus box");
  assert.ok(b.maxY < yFar, "far polygon outside the focus box");
});

test("focusBox takes drawn rings and outcome points, and is null with nothing", () => {
  const b = focusBox([[[35, -100], [35, -90]]], [], [[[45, -95], [46, -94], [45, -93]]], [[30, -95]], { launchWithinNm: 150 });
  assert.ok(b.maxY >= albers(46, -94)[1] - 1 && b.minY <= albers(30, -95)[1] + 1);
  assert.equal(focusBox([], [], [], [], { launchWithinNm: 150 }), null);
});

test("fromScreen(toScreen(p)) round-trips at a zoomed view", () => {
  const v = fitBox(272, 169, 2, boxOf([[25.8, -80.3], [40.6, -73.8]]), OPTS);
  for (const [la, lo] of [[28.5, -80.6], [40.6, -73.8], [33, -84]]) {
    const [x, y] = toScreen(v, la, lo);
    const [la2, lo2] = fromScreen(v, x, y);
    assert.ok(Math.abs(la2 - la) < 1e-9 && Math.abs(lo2 - lo) < 1e-9, `${la},${lo} -> ${la2},${lo2}`);
  }
});
