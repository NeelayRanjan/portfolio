import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as Gd from "../lib/slaac/guidance.ts";
const V = JSON.parse(readFileSync(new URL("./slaac-vectors/guidance.json", import.meta.url)));
const P = (arr) => ({ data: Float64Array.from(arr.flat(2)), B: arr.length, N: arr[0][0].length });
const maxAbs = (a, b) => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);

test("smoothAlongN", () => { for (const c of V.smooth) assert.ok(maxAbs(Gd.smoothAlongN(P(c.disp), c.sigma).data, c.out.flat(2)) < 1e-6); });
test("lowpassPath", () => { for (const c of V.lowpass) { const p = { data: Float64Array.from(c.path.flat(2)), B: c.path.length, C: c.path[0].length, N: c.path[0][0].length }; assert.ok(maxAbs(Gd.lowpassPath(p, c.sigma).data, c.out.flat(2)) < 1e-6); } });
test("marginTopup", () => { for (const c of V.topup) assert.ok(maxAbs(Gd.marginTopup(P(c.xy), c.polys, c.margin_m).data, c.out.flat(2)) < 1e-3); });
test("suaDisplacement: crossing, grazing, two polygons", () => { for (const c of V.displacement) assert.ok(maxAbs(Gd.suaDisplacement(P(c.xy), c.polys, c.margin_nm, c.smooth).data, c.out.flat(2)) < 1e-3, c.label); });
