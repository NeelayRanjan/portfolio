// node --test scripts/test-slaac-dpm.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DpmSolver } from "../lib/slaac/dpm-solver.ts";
const V = JSON.parse(readFileSync(new URL("./slaac-vectors/dpm.json", import.meta.url)));
const meta = JSON.parse(readFileSync(new URL("../public/slaac/meta.json", import.meta.url)));
const maxAbs = (a, b) => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);

test("timesteps match diffusers for every step count", () => {
  for (const c of V.cases) {
    const s = new DpmSolver(meta.scheduler); s.setTimesteps(c.steps);
    assert.deepEqual(s.timesteps, c.timesteps);
  }
});

test("each step's prev_sample matches, including the final (lower-order) step", () => {
  for (const c of V.cases) {
    const s = new DpmSolver(meta.scheduler); s.setTimesteps(c.steps);
    for (const st of c.rollout) {
      const out = s.step(Float32Array.from(st.model_output.flat(3)), st.t, Float32Array.from(st.sample.flat(3)));
      assert.ok(maxAbs(out, st.prev_sample.flat(3)) < 1e-4, `steps=${c.steps} t=${st.t}`);
    }
  }
  const f = V.full40;
  const s = new DpmSolver(meta.scheduler); s.setTimesteps(40);
  let x = Float32Array.from(f.x_T.flat(3));
  for (const t of s.timesteps) x = s.step(x.map((v) => 0.1 * v), t, x);
  assert.ok(maxAbs(x, f.x_0.flat(3)) < 1e-4, "full 40-step rollout");
});

test("rejects a config it does not implement", () => {
  assert.throws(() => new DpmSolver({ ...meta.scheduler, solver_order: 3 }));
});
