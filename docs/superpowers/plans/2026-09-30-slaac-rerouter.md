# SLAAC Rerouter (live Figure 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Figure 3's flight video with a live, in-browser demo of the owner's SLAAC diffusion rerouter, running over routes the owner's flight-plan LM wrote offline, around drawn airspace or every US launch site at once.

**Architecture:** Hand-run Python generators (in `scripts/slaac/`) read the owner's private NASA codebase by path and write only cleared artifacts: an ONNX export of the 5.78M-param UNet, a precomputed LM route library, a navaid snap table, launch airspace from FAA public data, and parity vectors. The browser runs an exact TypeScript port of the sampler, guidance and reroute pipeline in a module worker on `onnxruntime-web/wasm`, each module pinned in plain node against the Python vectors. A new client figure draws the map, the routes, the polygon tool and the live denoising.

**Tech Stack:** Python 3.12 (torch 2.13, diffusers 0.38.0, onnx, onnxruntime, numpy, scipy, pandas) via `uv`; Next.js 16 / React 19 / TypeScript; onnxruntime-web 1.27 (`/wasm` entry); `node --test`; Playwright-Firefox verify suite.

**Spec:** `docs/superpowers/specs/2026-09-30-slaac-rerouter-design.md` (read it first; this plan argues from it).

## Global Constraints

- **Branch `slaac-demo`, worktree `/home/neelayranjan/Documents/portfolio-slaac`. Never commit to `main`, never push without asking the owner, never deploy to production.** The owner's mentor approves a preview first.
- **NASA dir** (`NASA=/home/neelayranjan/_SAVE/NASA/NeelayRanjan_Summer2026_Codebase`): read by path only. **Never** copy into this repo or `public/`: `SUA_all`, `TRX_*` files, anything under `out/`, `route_db.json`, `route_ranked.json`, any `.py` source. Publishable outputs: the ONNX weights, derived navaid/airport subsets, airways data, LM-generated routes.
- The model math is PORTED, never approximated: every ported function is pinned against a Python vector before any UI uses it (Constitution).
- ORT is imported ONLY inside `lib/slaac-worker.ts`, and ONLY as `onnxruntime-web/wasm` (the `/webgpu` and bare entries fetch wasm builds that run away in JavaScriptCore).
- The worker is created with the literal `new Worker(new URL("./slaac-worker.ts", import.meta.url), { type: "module" })`.
- `/models/*` is immutable for a year: the ONNX filename carries a content hash (`flightdiff-<sha256[:8]>.onnx`) and the loader reads it from `public/slaac/meta.json`.
- Nothing model-sized is fetched before the visitor presses reroute. Small JSON (< 1 MB total) may load at scroll-in.
- All visitor copy lives in `content/copy.ts`, passes `node scripts/check-voice.mjs`, is first person, American spelling, no em-dashes, hyphenated ranges, no assurance lines ("keep every limitation, cut every assurance").
- Figure colours: airspace stamp red (`text-stamp`/its token), filed routes ink, rerouted plans x0 green, numbers `text-warm`.
- Breakpoint is `min-[880px]`; never pair it with rem breakpoints (`sm:` etc.).
- Canvas fonts resolve through `getComputedStyle`, never CSS variables in `ctx.font`.
- Animation runs on real elapsed ms; pause when off-screen or tab-hidden.
- `demo_used {demo: "slaac"}` once per page load after a completed reroute; no other new events.
- Timing numbers in copy come only from real-browser measurements on a production build.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A polygon that swallows an origin or destination airport** (or a filed anchor that can never clear): the pipeline cannot clear it; the figure must say so for that flight ("can't clear: an endpoint is inside the airspace"), show the residual legs crossing honestly, and never hang. Test: Task 7 step "endpoint inside" + Task 12 readout.
2. **A polygon no route comes near**: no reroute is needed, so the model must NOT download; the figure says no flight comes within the margin. Test: Task 11 (`planArcs` returns zero arcs) + Task 14 `slaac-nothing-at-rest` variant.
3. **A degenerate or self-crossing drawn ring** (fewer than 3 vertices, a closing click on the first vertex with 2 points, edges that cross): closing is refused with a short message; a self-crossing ring is refused rather than fed to the even-odd `_inside`. Test: Task 12 `ring.test`.
4. **Pressing reroute again, switching pair, or changing margin/lookahead while a run is in flight**: the old run is cancelled and its late replies are discarded by run id, never painted onto the new state (the chess stale-reply trap). Test: Task 14 `slaac-reroute` (two presses back to back; only the last run lands; bite by dropping the runId filter).
5. **The launch preset plus a large drawn polygon on a phone**: many arcs; the worker chunks the batch under its cap, progress keeps moving, and stargaze or cancel stops it within one step. Test: Task 11 chunking test + Task 14 `slaac-stargaze-cancel`.

---

## File Structure

Python (hand-run, committed, never shipped):
- `scripts/slaac/README.md`: how to create the env and run each generator, in order.
- `scripts/slaac/nasa.py`: imports the owner's modules by path (`--nasa-dir`), fixes the known `local_reroute` return bug by wrapping, loads model + stats.
- `scripts/slaac/export_model.py`: ONNX export + `public/slaac/meta.json`.
- `scripts/slaac/make_vectors.py`: parity vectors into `scripts/slaac-vectors/`.
- `scripts/slaac/prepare_nav.py`: `public/slaac/navaids.json`, `public/slaac/airports.json`, `public/slaac/us-outline.json`.
- `scripts/slaac/prepare_launch_sua.py`: `public/slaac/launch-sua.json` from FAA public data (+ `scripts/slaac/launch-sua-sources.json`, the hand-kept designator list with URLs).
- `scripts/slaac/hubs.json`: the public hub list with its source URL; `scripts/slaac/pairs.json`: the owner-reviewed pair list.
- `scripts/slaac/route_library.py`: runs the LM, geocodes, writes `public/slaac/routes.json`.
- `scripts/slaac/gate.py`: the snapped-plan gate and the step sweep, writes `scripts/slaac-gate/report.json`.

TypeScript (shipped):
- `lib/slaac/albers.ts`: projection constants, forward/inverse.
- `lib/slaac/geometry.ts`: point-in-polygon, nearest boundary, segment tests and distances, RDP.
- `lib/slaac/dpm-solver.ts`: the scheduler for this exact config.
- `lib/slaac/guidance.ts`: `suaDisplacement`, margin top-up, smoothing, low-pass.
- `lib/slaac/sampler.ts`: `samplePaths` over an injected model function.
- `lib/slaac/navaids.ts`: the snap table and k-nearest query.
- `lib/slaac/reroute.ts`: `localReroute`, `refineRouteSua`, metrics.
- `lib/slaac/arcs.ts`: `planArcs` (which arcs a press needs) and batching.
- `lib/slaac/data.ts`: loaders/validators for the public JSON.
- `lib/slaac/rng.ts`: seeded normal noise.
- `lib/slaac-protocol.ts`, `lib/slaac-worker.ts`, `lib/slaac-engine.ts`: worker wire, worker, client.
- `components/figures/RerouteFigure.tsx` (client), `components/figures/reroute-map.ts` (pure canvas drawing), `components/figures/ring.ts` (polygon tool validation).
- Modify: `app/page.tsx` (NASA box), `app/lab/page.tsx` (S3), `components/figures/FlightFigure.tsx` (`n` prop), `content/copy.ts`, `lib/stargaze.ts` (`OffloadKind`), `lib/track.ts` (demo union), `scripts/verify-redesign.mjs`, `CLAUDE.md`.

Tests: `scripts/test-slaac-geometry.mjs`, `test-slaac-dpm.mjs`, `test-slaac-guidance.mjs`, `test-slaac-sampler.mjs`, `test-slaac-reroute.mjs`, `test-slaac-arcs.mjs`, `test-slaac-data.mjs`, `test-slaac-ring.mjs`.

Vectors are JSON with float64 arrays as plain numbers. Every TS test reads them with `JSON.parse(readFileSync(new URL("./slaac-vectors/<name>.json", import.meta.url)))`.

---

### Task 1: Python env, the NASA loader, and the ONNX export

**Files:**
- Create: `scripts/slaac/README.md`, `scripts/slaac/nasa.py`, `scripts/slaac/export_model.py`
- Create (output): `public/models/flightdiff-<hash8>.onnx`, `public/slaac/meta.json`
- Modify: `.gitignore` (add `scripts/slaac/__pycache__/`)

**Interfaces:**
- Produces: `nasa.load(nasa_dir) -> (model, sched, stats, sg, ws, plan_cli)`; `sg.local_reroute(...)` (the owner's function with `return plan, roles` added to the wide branch); `meta.json` schema:
  ```json
  {"version":1,"model":"flightdiff-xxxxxxxx.onnx","sha256":"...","channels":7,"num_types":448,
   "null_type":448,"sample_size":256,"res_scale":0.0737...,"xy_mean":[x,y],"xy_scale":1225841.79,
   "aux_mean":[4],"aux_std":[4],"dt_mean":..,"dt_std":..,
   "scheduler":{"num_train_timesteps":1000,"beta_schedule":"squaredcos_cap_v2","rescale_betas_zero_snr":true,
     "timestep_spacing":"trailing","prediction_type":"v_prediction","algorithm_type":"dpmsolver++",
     "solver_order":2,"solver_type":"midpoint","lower_order_final":true,"final_sigmas_type":"zero"},
   "sampler":{"steps":40,"guidance":2.0,"lowpass_sigma":2.0,"sua_strength":1.0,"sua_smooth":1.0},
   "reroute":{"sua_snap_tol_nm":100,"sua_rdp_tol_nm":10,"sua_spacing_nm":150,"reroute_dist_nm":10,
     "route_radius_nm":15,"route_min_spacing_nm":30},
   "onnx":{"inputs":["noisy","t","od","eh","sc","tid"],"output":"v","opset":17}}
  ```

- [ ] **Step 1: Create the env** (uv reuses the cached torch wheel):

```bash
uv venv ~/.venvs/slaac --python 3.12
uv pip install --python ~/.venvs/slaac/bin/python torch==2.13.0 diffusers==0.38.0 onnx onnxruntime==1.27.0 numpy scipy pandas matplotlib tqdm
~/.venvs/slaac/bin/python -c "import torch,diffusers,onnxruntime;print(torch.__version__,diffusers.__version__,onnxruntime.__version__,torch.cuda.is_available())"
```
Expected: `2.13.0... 0.38.0 1.27.0 True`.

- [ ] **Step 2: Write `scripts/slaac/nasa.py`**

```python
"""Imports the owner's SLAAC modules from the private NASA directory BY PATH.
Nothing here copies their source. See the spec's permissions section."""
import importlib, os, sys
import numpy as np, torch

DEFAULT = "/home/neelayranjan/_SAVE/NASA/NeelayRanjan_Summer2026_Codebase"
PLAN = "flight_path_generation/Hazard-Aware Generative Flight Planning"
GEN = "predictive_daily_flight_modeling"

def paths(nasa_dir=DEFAULT):
    return os.path.join(nasa_dir, PLAN), os.path.join(nasa_dir, GEN)

def load(nasa_dir=DEFAULT, sample_size=256, base=(32, 64, 128, 256)):
    plan_dir, _ = paths(nasa_dir)
    if plan_dir not in sys.path:
        sys.path.insert(0, plan_dir)
    viz = importlib.import_module("viz_common")
    sg = importlib.import_module("sua_guidance")
    ws = importlib.import_module("waypoint_snap")
    plan_cli = importlib.import_module("plan_cli")
    model, sched, stats = viz.load_stats_only(
        os.path.join(plan_dir, "checkpoints/flightdiff_all2all.pt"),
        sample_size=sample_size, base=base)
    return model.eval(), sched, stats, sg, ws, plan_cli

def fixed_local_reroute(sg):
    """The owner's local_reroute, with the wide-berth branch's missing
    `return plan, roles` restored (it returns None today; plan_cli defaults
    to hug=1, which hid it). Implemented by re-running the owner's own code
    path: hug is delegated untouched; wide is sg.local_reroute's wide branch
    copied from sua_guidance.py:840-861 with the return appended."""
    def wide_or_hug(nominal_fixes, polys, sampler, wpdb=None, lock_dist_nm=60.0,
                    snap_tol_nm=15.0, dev_spacing_nm=None, rdp_tol_nm=None,
                    hug=False, hug_margin_nm=25.0, clear_margin_nm=0.0):
        if hug or not polys or len(nominal_fixes) < 2:
            return sg.local_reroute(nominal_fixes, polys, sampler, wpdb, lock_dist_nm,
                                    snap_tol_nm, dev_spacing_nm, rdp_tol_nm, hug,
                                    hug_margin_nm, clear_margin_nm)
        def fm(f):
            x, y = sg.albers(np.array([f[1]]), np.array([f[2]]))
            return np.array([x[0], y[0]])
        def _dev(entry, rejoin):
            arc = sampler((entry[1], entry[2]), (rejoin[1], rejoin[2]), polys)
            return sg.refine_route_sua([entry, rejoin], np.asarray(arc, float), polys,
                                       wpdb=wpdb, snap_tol_nm=snap_tol_nm,
                                       max_leg_nm=dev_spacing_nm, rdp_tol_nm=rdp_tol_nm,
                                       clear_margin_nm=clear_margin_nm)
        n = len(nominal_fixes)
        lock = max(lock_dist_nm, float(clear_margin_nm))
        clear_wp = [sg.dist_to_sua_nm(fm(f), polys) > lock for f in nominal_fixes]
        aff_leg = [sg._leg_affected(nominal_fixes[i], nominal_fixes[i + 1], polys, lock)
                   for i in range(n - 1)]
        aff_wp = [False] * n
        for i in range(n):
            legL = aff_leg[i - 1] if i > 0 else False
            legR = aff_leg[i] if i < n - 1 else False
            aff_wp[i] = (not clear_wp[i]) or legL or legR
        aff_wp[0] = aff_wp[-1] = False
        plan, roles, i = [], [], 0
        while i < n:
            if not aff_wp[i]:
                plan.append(nominal_fixes[i]); roles.append("filed"); i += 1
            else:
                j = i
                while j < n and aff_wp[j]:
                    j += 1
                entry, rejoin = plan[-1], nominal_fixes[j]
                for f in _dev(entry, rejoin)[1:-1]:
                    plan.append(f); roles.append("deviation")
                plan.append(rejoin); roles.append("rejoin")
                i = j + 1
        return plan, roles
    return wide_or_hug
```

Before writing the wide branch, open `sua_guidance.py` lines 774-861 and confirm the copy above matches it statement for statement (it was transcribed on 2026-09-30); if the file changed, re-transcribe.

- [ ] **Step 3: Write `scripts/slaac/export_model.py`**

```python
"""Hand-run. Exports the rerouter UNet to ONNX and writes public/slaac/meta.json.
~/.venvs/slaac/bin/python scripts/slaac/export_model.py [--nasa-dir DIR]"""
import argparse, hashlib, json, os, sys
import numpy as np, torch, onnxruntime as ort
sys.path.insert(0, os.path.dirname(__file__))
import nasa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
NAMES = ["noisy", "t", "od", "eh", "sc", "tid"]

class Wrap(torch.nn.Module):
    """drop=None: the caller builds the unconditional half itself (eh zeroed,
    tid = null_type), which is exactly what FlightDiffusion.forward does with
    drop=True, so no branch is baked into the graph."""
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, noisy, t, od, eh, sc, tid): return self.m(noisy, t, od, eh, sc, tid, drop=None)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--nasa-dir", default=nasa.DEFAULT)
    a = ap.parse_args()
    model, sched, st, *_ = nasa.load(a.nasa_dir)
    w = Wrap(model).eval()
    g = torch.Generator().manual_seed(0)
    B = 4
    args = (torch.randn(B, 7, 256, generator=g), torch.tensor([999, 500, 24, 0]),
            torch.randn(B, 4, generator=g), torch.randn(B, 4, generator=g),
            torch.randn(B, 6, 256, generator=g), torch.tensor([0, 3, 448, 448]))
    # Also prove the drop-equivalence the Wrap docstring claims.
    with torch.no_grad():
        ref = w(*args)
        drop = torch.tensor([True, False, True, False])
        a_drop = model(args[0], args[1], args[2], args[3], args[4], torch.tensor([0, 3, 0, 448]), drop=drop)
        eh0 = args[3].clone(); eh0[drop] = 0
        tid0 = torch.where(drop, torch.tensor(448), torch.tensor([0, 3, 0, 448]))
        b_drop = w(args[0], args[1], args[2], eh0, args[4], tid0)
        assert torch.allclose(a_drop, b_drop, atol=1e-6), "drop != zeroed eh + null type"
    tmp = os.path.join(ROOT, "public/models/flightdiff.tmp.onnx")
    torch.onnx.export(w, args, tmp, input_names=NAMES, output_names=["v"],
                      dynamic_axes={k: {0: "B"} for k in NAMES + ["v"]},
                      opset_version=17, dynamo=False)
    s = ort.InferenceSession(tmp, providers=["CPUExecutionProvider"])
    out = s.run(None, {k: v.numpy() for k, v in zip(NAMES, args)})[0]
    err = float(np.abs(out - ref.numpy()).max())
    assert err < 1e-4, f"ONNX parity {err}"
    sha = hashlib.sha256(open(tmp, "rb").read()).hexdigest()
    name = f"flightdiff-{sha[:8]}.onnx"
    for f in os.listdir(os.path.join(ROOT, "public/models")):
        if f.startswith("flightdiff-") and f != name:
            os.remove(os.path.join(ROOT, "public/models", f))
    os.replace(tmp, os.path.join(ROOT, "public/models", name))
    meta = {
        "version": 1, "model": name, "sha256": sha,
        "channels": st.channels, "num_types": st.num_types, "null_type": st.num_types,
        "sample_size": 256, "res_scale": st.res_scale,
        "xy_mean": [float(x) for x in np.asarray(st.xy_mean).ravel()], "xy_scale": st.xy_scale,
        "aux_mean": [float(x) for x in np.asarray(st.aux_mean).ravel()],
        "aux_std": [float(x) for x in np.asarray(st.aux_std).ravel()],
        "dt_mean": st.dt_mean, "dt_std": st.dt_std,
        "scheduler": {k: sched.config[k] for k in [
            "num_train_timesteps", "beta_schedule", "rescale_betas_zero_snr", "timestep_spacing",
            "prediction_type", "algorithm_type", "solver_order", "solver_type",
            "lower_order_final", "final_sigmas_type"]},
        "sampler": {"steps": 40, "guidance": 2.0, "lowpass_sigma": 2.0, "sua_strength": 1.0, "sua_smooth": 1.0},
        "reroute": {"sua_snap_tol_nm": 100.0, "sua_rdp_tol_nm": 10.0, "sua_spacing_nm": 150.0,
                    "reroute_dist_nm": 10.0, "route_radius_nm": 15.0, "route_min_spacing_nm": 30.0},
        "onnx": {"inputs": NAMES, "output": "v", "opset": 17, "parity_max_abs": err},
    }
    os.makedirs(os.path.join(ROOT, "public/slaac"), exist_ok=True)
    json.dump(meta, open(os.path.join(ROOT, "public/slaac/meta.json"), "w"), indent=1)
    print(f"{name}  parity {err:.2e}  {os.path.getsize(os.path.join(ROOT,'public/models',name))/1e6:.1f} MB")

if __name__ == "__main__": main()
```

`sampler.steps` is 40 here and is rewritten by Task 10's sweep if a smaller count passes.

- [ ] **Step 4: Run it**

Run: `~/.venvs/slaac/bin/python scripts/slaac/export_model.py`
Expected: `flightdiff-xxxxxxxx.onnx  parity ~3e-06  23.4 MB`; `public/slaac/meta.json` exists.

- [ ] **Step 5: Write `scripts/slaac/README.md`** with: the env commands from Step 1, the permissions rule (copy the Global Constraints NASA bullet verbatim), and the generator order (export_model → make_vectors → prepare_nav → prepare_launch_sua → route_library → gate), each with its command.

- [ ] **Step 6: Commit**

```bash
git add scripts/slaac/README.md scripts/slaac/nasa.py scripts/slaac/export_model.py public/models/flightdiff-*.onnx public/slaac/meta.json .gitignore
git commit -m "slaac: export the rerouter UNet to ONNX, meta.json

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Parity vectors

**Files:**
- Create: `scripts/slaac/make_vectors.py`
- Create (output): `scripts/slaac-vectors/{albers,geometry,dpm,guidance,sampler,reroute}.json`

**Interfaces:**
- Consumes: `nasa.load`, `sg.local_reroute`.
- Produces: the vector files below; each is `{"cases": [...]}` with the named fields. Arrays are nested lists, float64.
  - `albers.json`: `{lat, lon, x, y}` for 64 points (grid over 20-52N, -128 to -64E) plus inverse round-trip.
  - `geometry.json`: cases for `inside` (pts, poly, out bools), `nearest_boundary`, `seg_crosses_poly`, `seg_poly_dist`, `seg_illegal` (margin 0 and 25 nm), `pt_illegal`, `dist_to_sua_nm`, `rdp_mask` (tol), including a concave poly and a point exactly on a vertex.
  - `dpm.json`: for steps in [20, 30, 40, 50]: `timesteps`, and a 6-step rollout with fixed `model_output` arrays (shape 2x7x16) and `sample` in / `prev_sample` out per step, produced by `sched.step`.
  - `guidance.json`: `smooth_along_N` (disp in/out, sigma 1 and 2), `lowpass_path` (sigma 2), `margin_topup` (xy, polys, margin_m, out), `sua_displacement` (xy, polys, margin_nm 25, smooth 1.0, out) including a path crossing two polygons and a grazing path.
  - `sampler.json`: `chord_features` (p_xy, endpoints, res_scale, out) and two full `sample_paths` runs (n=2 arcs, steps 20 and 40, one with SUA, one without) with the injected initial noise `r0`, endpoints, type ids, and the `final` output; plus the per-step `x0` of arc 0 for the first 3 steps.
  - `reroute.json`: `local_reroute` cases (hug and wide, margins 25 and 40) where the sampler is a stub that returns recorded arcs; fields `nominal`, `polys_ll`, `arcs` (the arcs the stub returned, in call order), `calls` (entry/rejoin lat-lon per call), `plan`, `roles`; plus `refine_route_sua` direct cases and an "endpoint inside" case.

- [ ] **Step 1: Write `make_vectors.py`.** Structure (write every function; no stubs left):

```python
"""Hand-run. ~/.venvs/slaac/bin/python scripts/slaac/make_vectors.py
Writes scripts/slaac-vectors/*.json. Deterministic (seeded)."""
import json, os, sys
import numpy as np, torch
sys.path.insert(0, os.path.dirname(__file__))
import nasa
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "scripts/slaac-vectors")
rng = np.random.default_rng(20260930)

def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    def conv(o):
        if isinstance(o, (np.ndarray, torch.Tensor)): return np.asarray(o, dtype=np.float64).tolist()
        if isinstance(o, (np.floating,)): return float(o)
        if isinstance(o, (np.integer,)): return int(o)
        if isinstance(o, (np.bool_,)): return bool(o)
        raise TypeError(type(o))
    json.dump(obj, open(os.path.join(OUT, name), "w"), default=conv)

def ring(lat, lon, r_deg, k=7, jitter=0.25):
    ang = np.sort(rng.uniform(0, 2*np.pi, k))
    rr = r_deg * (1 + jitter * rng.uniform(-1, 1, k))
    return [(lat + rr[i]*np.sin(ang[i]), lon + rr[i]*np.cos(ang[i])*1.3) for i in range(k)]
```

Then one function per file:
- `albers(sg)`: grid points → `sg.albers`, and `sg.inverse_albers` of the results.
- `geometry(sg)`: build 4 polygons in metres via `sg.load_sua([ring(...)])` (one concave: a hand-written L-shape), 200 random points around them; call `sg._inside`, `sg._nearest_boundary`, `sg._seg_crosses_poly`, `sg.seg_poly_dist`, `sg.seg_illegal(a,b,polys,0)` and `(…,25*1852)`, `sg.pt_illegal`, `sg.dist_to_sua_nm`, `sg._rdp_mask(xy, 10*1852)` on a 256-point wavy path; record inputs and outputs.
- `dpm(sched)`: for steps in (20,30,40,50): fresh `DPMSolverMultistepScheduler.from_config(sched.config)`, `set_timesteps(steps)`, record timesteps; for the 6-step rollout use `torch.Generator().manual_seed(steps)` for `sample` and each `model_output`; record each `step(...).prev_sample`. Also record a FULL 40-step rollout with `model_output = 0.1*sample` (deterministic function) so the final-order handling is covered at the last step.
- `guidance(sg)`: call `sg._smooth_along_N`, `sg.lowpass_path`, `sg._margin_topup`, `sg.sua_displacement` on the cases listed in Interfaces.
- `sampler(model, sched, st, plan_cli, sg)`: monkeypatch to inject noise:

```python
def run_sample(model, sched, st, plan_cli, sg, ep_ll_pairs, polys_ll, steps, seed):
    from diffusers import DPMSolverMultistepScheduler
    sch = DPMSolverMultistepScheduler.from_config(sched.config)
    eps = torch.stack([sg.endpoints_from_ll(o, d, st) for o, d in ep_ll_pairs])
    n = len(ep_ll_pairs)
    g = torch.Generator().manual_seed(seed)
    r0 = torch.randn(n, st.channels, 256, generator=g)
    real = torch.randn
    torch.randn = lambda *a, **k: r0.clone()          # sample_paths' ONE randn call
    try:
        polys = sg.load_sua(polys_ll) if polys_ll else None
        x0_trace = []
        orig_fr = plan_cli.from_residual
        final = plan_cli.sample_paths(
            model, sch, eps, torch.zeros(n, dtype=torch.long), n=n, channels=st.channels,
            sample_size=256, device="cpu", res_scale=st.res_scale, steps=steps, guidance=2.0,
            sua=polys, sua_strength=1.0, sua_margin_nm=25.0, sua_smooth=1.0,
            xy_mean=torch.as_tensor(st.xy_mean).float(), xy_scale=st.xy_scale, lowpass_sigma=2.0)
    finally:
        torch.randn = real
    return dict(r0=r0, endpoints=eps, final=final, polys_m=polys or [], steps=steps)
```
Record two runs (no SUA / with a polygon straddling the chord), each with 2 arcs (KSFO→KDEN-ish and KMIA→KATL-ish endpoints as lat/lon). Before trusting it, assert `sample_paths` calls `torch.randn` exactly once (count calls in the lambda); if the count differs, fail loudly. Also record `plan_cli.chord_features` on 3 random paths.
- `reroute(sg, ws, plan_cli)`: build a snap table exactly like `plan_cli.build` (`ws.load_waypoints(fixes, fix_types={"VOR","WAYPOINT"}, exclude_digit_names=True, exclude_prefixes=("VP",))`, then the `vor3` filter). Use 6 nominal routes as fix lists taken from the snap table itself (e.g. strings of 3-letter VORs across the country), 5 polygons. The sampler stub: a class whose `__call__(entry_ll, rejoin_ll, polys)` returns a recorded arc: for determinism, arc = the real `plan_cli.Sampler` output computed once and cached by key, with `cfg` from `plan_cli`'s defaults (seed 0, steps 20 to keep it fast). Record `calls`, `arcs`, `plan`, `roles` for hug and wide (via `sg.local_reroute`), margins 25 and 40, `clear_margin_nm` = margin (plan_cli's default). Include the "endpoint inside" case (a polygon over the route's first fix). Also export the snap table used (names/lat/lon) into `reroute.json` as `snap_table` so the TS tests use identical fixes.

- [ ] **Step 2: Run it**

Run: `~/.venvs/slaac/bin/python scripts/slaac/make_vectors.py && ls -la scripts/slaac-vectors`
Expected: six JSON files, total a few MB; no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/slaac/make_vectors.py scripts/slaac-vectors
git commit -m "slaac: parity vectors from the owner's Python pipeline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Albers and geometry port

**Files:**
- Create: `lib/slaac/albers.ts`, `lib/slaac/geometry.ts`
- Test: `scripts/test-slaac-geometry.mjs`

**Interfaces:**
- Produces:
  - `albers(latDeg: number, lonDeg: number): [number, number]`, `inverseAlbers(x: number, y: number): [number, number]`, `NM = 1852`.
  - `type Pt = [number, number]; type Poly = Pt[]` (metres).
  - `inside(p: Pt, poly: Poly): boolean`, `nearestBoundary(p: Pt, poly: Poly): Pt`, `segCrossesPoly(a: Pt, b: Pt, poly: Poly): boolean`, `segPolyDist(a, b, poly): number`, `segIllegal(a, b, polys: Poly[], marginM = 0): boolean`, `ptIllegal(p, polys, marginM = 0): boolean`, `distToSuaNm(p, polys): number`, `rdpMask(xy: Pt[], tolM: number): boolean[]`, `loadSua(ringsLatLon: Pt[][]): Poly[]` (drops a closing duplicate vertex, exactly like `sg.load_sua`).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/test-slaac-geometry.mjs`
Expected: FAIL, cannot find module `../lib/slaac/albers.ts`.

- [ ] **Step 3: Implement.** `lib/slaac/albers.ts` (no imports):

```ts
/** The owner's Albers equal-area projection (viz_common.py / sua_guidance.py),
 *  ported exactly: same sphere radius, origin and standard parallels. */
const R = 6371000.0;
const LAT0 = (23.0 * Math.PI) / 180, LON0 = (-96.0 * Math.PI) / 180;
const P1 = (29.5 * Math.PI) / 180, P2 = (45.5 * Math.PI) / 180;
const N = (Math.sin(P1) + Math.sin(P2)) / 2;
const C = Math.cos(P1) ** 2 + 2 * N * Math.sin(P1);
const RHO0 = (R / N) * Math.sqrt(C - 2 * N * Math.sin(LAT0));
export const NM = 1852.0;

export function albers(latDeg: number, lonDeg: number): [number, number] {
  const lat = (latDeg * Math.PI) / 180, lon = (lonDeg * Math.PI) / 180;
  const rho = (R / N) * Math.sqrt(Math.max(C - 2 * N * Math.sin(lat), 0));
  const theta = N * (lon - LON0);
  return [rho * Math.sin(theta), RHO0 - rho * Math.cos(theta)];
}

export function inverseAlbers(x: number, y: number): [number, number] {
  const rho = Math.sign(N) * Math.sqrt(x * x + (RHO0 - y) ** 2);
  const theta = Math.atan2(x, RHO0 - y);
  const lon = LON0 + theta / N;
  const val = (C - ((rho * N) / R) ** 2) / (2 * N);
  const lat = Math.asin(Math.min(1, Math.max(-1, val)));
  return [(lat * 180) / Math.PI, (lon * 180) / Math.PI];
}
```

`lib/slaac/geometry.ts` imports only `./albers`. Port each function from `sua_guidance.py` statement for statement (`_inside` lines 46-57 including its `+ 1e-12` in the denominator and XOR accumulation over edges with `j = K-1` start; `_nearest_boundary` 564-577 with the `+1e-12` and `<` update; `_ccw`/`_seg_int`/`_seg_crosses_poly` 243-258; `_seg_seg_dist`/`seg_poly_dist` 272-293 including the `L2 < 1e-12` guard; `seg_illegal`/`pt_illegal` 296-308; `dist_to_sua_nm` 580-589; `_rdp_mask` 358-380 with its explicit stack order). Translation rules: numpy vector ops become loops in the same order; `argmax` ties take the FIRST max (numpy semantics), so compare with `>` not `>=`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/test-slaac-geometry.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/slaac/albers.ts lib/slaac/geometry.ts scripts/test-slaac-geometry.mjs
git commit -m "slaac: port Albers and the airspace geometry, pinned to Python

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: DPM-Solver++ port

**Files:**
- Create: `lib/slaac/dpm-solver.ts`
- Test: `scripts/test-slaac-dpm.mjs`

**Interfaces:**
- Produces:
  ```ts
  export type DpmConfig = { num_train_timesteps: number; beta_schedule: "squaredcos_cap_v2"; rescale_betas_zero_snr: boolean; timestep_spacing: "trailing"; prediction_type: "v_prediction"; algorithm_type: "dpmsolver++"; solver_order: 2; solver_type: "midpoint"; lower_order_final: boolean; final_sigmas_type: "zero" };
  export class DpmSolver {
    constructor(cfg: DpmConfig);
    readonly alphasCumprod: Float64Array;          // length num_train_timesteps
    setTimesteps(steps: number): void;
    timesteps: number[];
    step(modelOutput: Float32Array, timestep: number, sample: Float32Array): Float32Array; // prev_sample
  }
  ```
  The constructor throws on any config value other than the literal types above (this port covers exactly the owner's config).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails** — `node --test scripts/test-slaac-dpm.mjs`, expected FAIL (module missing).

- [ ] **Step 3: Implement** by porting `diffusers==0.38.0` `schedulers/scheduling_dpmsolver_multistep.py` for exactly this config. Read the source at `~/.venvs/slaac/lib/python3.12/site-packages/diffusers/schedulers/scheduling_dpmsolver_multistep.py` and port, in float64 internally, returning Float32Array:
  1. `betas_for_alpha_bar` with the cosine `alpha_bar(t) = cos((t + 0.008) / 1.008 * pi/2)^2`, `max_beta=0.999`.
  2. `rescale_zero_terminal_snr(betas)` exactly, then `alphas_cumprod`, and the diffusers override `alphas_cumprod[-1] = 2**-24` applied when `rescale_betas_zero_snr` is set.
  3. `alpha_t = sqrt(ac)`, `sigma_t = sqrt(1-ac)`, `lambda_t = log(alpha_t) - log(sigma_t)`, `sigmas = sqrt((1-ac)/ac)`.
  4. `set_timesteps` for `trailing`: `np.round(np.arange(T, 0, -T/steps)).astype(int64) - 1`, then the sigma interpolation onto those timesteps and `final_sigmas_type="zero"` appending sigma 0 (the vector shows 41 sigmas, first 4095.99, last 0).
  5. `convert_model_output` for `dpmsolver++` + `v_prediction`: `x0 = alpha_t * sample - sigma_t * model_output` using `_sigma_to_alpha_sigma_t`.
  6. `step`: first-order update (`dpm_solver_first_order_update`) when `lower_order_nums < 1` or at the last step (the diffusers condition: final step with `final_sigmas_type == "zero"` forces lower order); otherwise `multistep_dpm_solver_second_order_update` with `solver_type="midpoint"`. Keep the model-output history and `lower_order_nums` counter exactly as diffusers does.
  The file header comment names the diffusers version and file it was ported from.

- [ ] **Step 4: Run to verify it passes** — `node --test scripts/test-slaac-dpm.mjs`, expected PASS, 3 tests.

- [ ] **Step 5: Commit** (`slaac: port DPM-Solver++ for the rerouter's config, pinned per step`).

---

### Task 5: Guidance port

**Files:**
- Create: `lib/slaac/guidance.ts`
- Test: `scripts/test-slaac-guidance.mjs`

**Interfaces:**
- Consumes: `geometry.ts` (`inside`, `nearestBoundary`), `albers.ts` (`NM`).
- Produces (paths are `(B,2,N)` flattened row-major as `Float64Array` with explicit `B`, `N`):
  - `type Path2 = { data: Float64Array; B: number; N: number }` (index `b*2*N + c*N + i`).
  - `smoothAlongN(disp: Path2, sigma: number): Path2` (zero-padded conv, `rad = max(1, floor(3*sigma))`, same length, like `F.conv1d(padding=rad)`).
  - `marginTopup(xy: Path2, polys: Poly[], marginM: number, iters = 3): Path2`.
  - `suaDisplacement(xy: Path2, polys: Poly[], marginNm: number, smoothSigma: number, pinEnds = true): Path2`.
  - `lowpassPath(path: { data: Float64Array; B: number; C: number; N: number }, sigma: number, pinXyEnds = true)` (replicate padding, every channel).

- [ ] **Step 1: Write the failing test** (same shape as Task 3: load `guidance.json`, call each function on each case, assert max abs diff `< 1e-6` for smoothing/low-pass and `< 1e-3` metres for the displacement functions).

```js
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
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** by porting `sua_guidance.py` lines 60-148 and 213-230 exactly: the run split (`np.split` on non-consecutive inside indices), `a = p[max(i0-1,0)]`, `b2 = p[min(i1+1,N-1)]`, `u/(norm+1e-9)`, `perp=[-u1,u0]`, flip when `perp·(mid-cent) < 0`, `amp = max(poly·perp) - perp·mid + margin`, accumulation `+=` per polygon, smoothing BEFORE the top-up, top-up on `xy + out`, pin ends last. `_margin_topup` accumulates `step` per polygon per iteration and re-measures from `xy + total`. The Gaussian kernel is normalised by its sum.
- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit** (`slaac: port the SUA guidance field, pinned to Python`).

---

### Task 6: Sampler port, run against the real ONNX model in node

**Files:**
- Create: `lib/slaac/sampler.ts`, `lib/slaac/rng.ts`
- Test: `scripts/test-slaac-sampler.mjs`

**Interfaces:**
- Consumes: `DpmSolver`, `suaDisplacement`, `lowpassPath`, `albers`.
- Produces:
  ```ts
  export type Meta = { channels: number; null_type: number; sample_size: number; res_scale: number; xy_mean: [number, number]; xy_scale: number; aux_mean: number[]; aux_std: number[]; scheduler: DpmConfig; sampler: { steps: number; guidance: number; lowpass_sigma: number; sua_strength: number; sua_smooth: number } };
  /** One batched UNet call. Inputs are row-major; returns v (B,C,N). */
  export type ModelFn = (inp: { noisy: Float32Array; t: number; od: Float32Array; eh: Float32Array; sc: Float32Array; tid: BigInt64Array; B: number }) => Promise<Float32Array>;
  export type Endpoints = Float32Array; // (n,2,6) normalized, from endpointsFromLL
  export function endpointsFromLL(o: [number, number], d: [number, number], meta: Meta): Float32Array; // (2,6)
  export function chordFeatures(pXy: Float64Array, ep: Float32Array, n: number, N: number, resScale: number): Float32Array; // (n,6,N)
  export async function samplePaths(args: {
    model: ModelFn; meta: Meta; endpoints: Float32Array; n: number; noise: Float32Array; // (n,C,N)
    steps: number; polysM: Poly[] | null; marginNm: number;
    onStep?: (i: number, x0Abs: Float64Array) => void; // throw from here to cancel
  }): Promise<Float64Array>; // final (n,C,N), normalized absolute (xy in normalized units)
  export function toMetres(finalXy: Float64Array, n: number, N: number, meta: Meta): Float64Array; // (n,N,2) metres
  ```
  `rng.ts`: `export function normalNoise(seed: number, count: number): Float32Array` (mulberry32 + Box-Muller; only for live runs, never used by parity tests).

- [ ] **Step 1: Write the failing test.** It loads the ONNX file named in `meta.json` with `onnxruntime-web/wasm` in node (as `scripts/time-wasm` did during the spike):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as S from "../lib/slaac/sampler.ts";
const require = createRequire(import.meta.url);
const ort = require("onnxruntime-web/wasm");
const meta = JSON.parse(readFileSync(new URL("../public/slaac/meta.json", import.meta.url)));
const V = JSON.parse(readFileSync(new URL("./slaac-vectors/sampler.json", import.meta.url)));
const maxAbs = (a, b) => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);

async function modelFn() {
  ort.env.wasm.numThreads = 1;
  const s = await ort.InferenceSession.create(readFileSync(new URL(`../public/models/${meta.model}`, import.meta.url)));
  return async ({ noisy, t, od, eh, sc, tid, B }) => {
    const N = meta.sample_size, C = meta.channels;
    const out = await s.run({
      noisy: new ort.Tensor("float32", noisy, [B, C, N]),
      t: new ort.Tensor("int64", BigInt64Array.from({ length: B }, () => BigInt(t)), [B]),
      od: new ort.Tensor("float32", od, [B, 4]), eh: new ort.Tensor("float32", eh, [B, 4]),
      sc: new ort.Tensor("float32", sc, [B, 6, N]), tid: new ort.Tensor("int64", tid, [B]) });
    return out.v.data;
  };
}

test("chordFeatures matches", () => {
  for (const c of V.chord_features) {
    const out = S.chordFeatures(Float64Array.from(c.p_xy.flat(2)), Float32Array.from(c.endpoints.flat(2)), c.p_xy.length, c.p_xy[0][0].length, meta.res_scale);
    assert.ok(maxAbs(out, c.out.flat(2)) < 1e-4);
  }
});

test("full sample_paths runs match Python on injected noise", async () => {
  const model = await modelFn();
  for (const c of V.runs) {
    const final = await S.samplePaths({ model, meta, endpoints: Float32Array.from(c.endpoints.flat(2)), n: c.endpoints.length,
      noise: Float32Array.from(c.r0.flat(2)), steps: c.steps, polysM: c.polys_m.length ? c.polys_m : null, marginNm: 25 });
    const m = S.toMetres(final, c.endpoints.length, meta.sample_size, meta);
    const refM = S.toMetres(Float64Array.from(c.final.flat(2)), c.endpoints.length, meta.sample_size, meta);
    const err = maxAbs(m, refM);
    console.log(`steps=${c.steps} sua=${c.polys_m.length > 0} max|d| ${err.toFixed(2)} m`);
    assert.ok(err < c.tolerance_m, `${err} m`);
  }
});
```
`tolerance_m` is written into `sampler.json` by Task 2 as `max(50, 20 × the torch-vs-ORT drift of the same run)`: `make_vectors.py` computes that drift by re-running the same injected noise through the ONNX session in Python (the model function swapped for ORT) and recording `max|d|` in metres. The tolerance is therefore measured, not guessed; record the measured drift in the test output.

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** `sampler.ts` by porting `plan_cli.py` lines 91-202 and `sg.endpoints_from_ll` (sua_guidance 707-728) exactly:
  - `chord`, `from_residual` (only xy channels get `r*res_scale + chord`), `ep_heading` (channels 4,5 of each endpoint), `chord_features` with `torch.gradient` semantics along N (central differences `(x[i+1]-x[i-1])/2` inside, one-sided `x[1]-x[0]` and `x[N-1]-x[N-2]` at the ends), `v_to_x0` using `alphasCumprod[t]`.
  - Per step: build the CFG batch of `2n` (first n conditional: `eh`, `tid=0`; next n unconditional: `eh=0`, `tid=null_type`), ONE model call, `v = v_u + g(v_c - v_u)`; x0; zero xy at the ends; SUA displacement in metres (`xy_m = x0_abs*xy_scale + xy_mean`), `x0_xy = (xy_new - chord_ref)/res_scale`, re-pin, recompute `x0_abs`, re-derive `v = (sqrt(ac)*r - x0)/sqrt(1-ac)`; self-conditioning from `x0_abs`; `r = solver.step(v, t, r)`. After the loop: zero xy ends, `from_residual`, `lowpassPath(sigma)`, the final hard clear with `smooth_sigma = 0`.
  - The sampler always uses `tid = 0` for the conditional half (the owner's `Sampler` passes zeros).
  - `onStep(i, x0Abs)` is called after each step; a thrown error propagates (that is the cancel path).
- [ ] **Step 4: Run to verify it passes.** Record the printed max|d| values in the commit message.
- [ ] **Step 5: Commit** (`slaac: port sample_paths; full runs match Python within <measured> m`).

---

### Task 7: Snap table and the reroute pipeline

**Files:**
- Create: `lib/slaac/navaids.ts`, `lib/slaac/reroute.ts`
- Test: `scripts/test-slaac-reroute.mjs`

**Interfaces:**
- Consumes: geometry, albers.
- Produces:
  ```ts
  export type Fix = [name: string, lat: number, lon: number];
  export class Navaids { constructor(names: string[], lat: number[], lon: number[]); readonly xy: Float64Array; kNearest(p: Pt, k: number): { idx: number[]; dist: number[] } } // exact brute force, ties by index
  export type ArcSampler = (entryLL: [number, number], rejoinLL: [number, number], polys: Poly[]) => Pt[]; // metres (N,2)
  export function refineRouteSua(route: Fix[], dense: Pt[], polys: Poly[], opts: { wpdb: Navaids | null; snapTolNm: number; maxPasses?: number; maxLegNm?: number | null; rdpTolNm?: number | null; clearMarginNm: number }): Fix[];
  export function localReroute(nominal: Fix[], polys: Poly[], sampler: ArcSampler, opts: { wpdb: Navaids | null; lockDistNm: number; snapTolNm: number; devSpacingNm: number | null; rdpTolNm: number | null; hug: boolean; hugMarginNm: number; clearMarginNm: number }): { plan: Fix[]; roles: ("filed" | "deviation" | "rejoin")[] };
  export function anchorsFor(nominal: Fix[], polys: Poly[], opts: same as localReroute minus sampler): { entry: Fix; rejoin: Fix }[]; // the arcs localReroute WILL request, in order, without sampling
  export function metrics(nominal: Fix[], plan: Fix[], polys: Poly[]): { nominalNm: number; planNm: number; addedNm: number; addedPct: number; legCrossings: number; minClearanceNm: number | null };
  ```

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.** Port `sua_guidance.py` lines 311-553 (`_apex_between`, `_snap_or_raw`, `_fill_ceiling`, `_densify_leg`, `prune_bypassable`, `refine_route_sua` with its `repair` closure, budget and strict-improvement rule), 592-600 (`_leg_affected`, 24 samples), 774-862 (`local_reroute`, both branches), and `plan_cli.py` 245-280 (`fixes_to_m`, `path_len_nm`, `leg_crossings`, `min_clearance_nm`). `Navaids.kNearest` replaces `cKDTree.query`: exact Euclidean distances, sorted ascending, ties broken by lower index (`cKDTree` returns ties in index order for these tables; the vectors pin it). `anchorsFor` reuses the same anchor logic without calling the sampler (hug: anchor advancement uses only filed fixes, so it is sampler-independent; assert that in a comment). `searchsorted` in `_fill_ceiling` is left-side bisection.
- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit** (`slaac: port local_reroute and snapping`).

---

### Task 8: Public data: navaids, airports, outline, launch airspace

**Files:**
- Create: `scripts/slaac/prepare_nav.py`, `scripts/slaac/prepare_launch_sua.py`, `scripts/slaac/launch-sua-sources.json`, `lib/slaac/data.ts`
- Create (output): `public/slaac/navaids.json`, `public/slaac/airports.json`, `public/slaac/us-outline.json`, `public/slaac/launch-sua.json`
- Test: `scripts/test-slaac-data.mjs`

**Interfaces:**
- Produces:
  - `navaids.json`: `{"version":1,"source":"wyp345plus.txt (owner's nav DB)","filter":"VOR+WAYPOINT, no digit names, no VP prefix, 3-letter alpha, box 17-50N -130..-60E","names":[...],"lat":[...],"lon":[...]}` built with EXACTLY `plan_cli.build`'s `load_waypoints` + `vor3` filter (so the browser snaps to the same table the pipeline does).
  - `airports.json`: `{"version":1,"airports":{"KSFO":{"name":"SAN FRANCISCO INTL","lat":..,"lon":..}}}` for the library's airports only (names from `airports.txt`, underscores to spaces).
  - `us-outline.json`: `{"version":1,"lonlat":[[lon,lat],...,null,...]}` decoded from `viz_common._US_OUTLINE_B64` (float32 pairs; keep segment breaks as `null` where the decoded array has NaN).
  - `launch-sua.json`: `{"version":1,"cycle":"2026-09-03..2026-10-29","sites":[{"id":"ksc","name":"Cape Canaveral / KSC","kind":"charted","polys":[{"designator":"R-2932","ring":[[lat,lon],...],"source":"<url>","clipped":false}],"basis":"<url>"},{"id":"starbase","kind":"past-tfr","label":"Starship Flight 10 launch TFR, FDC 5/3325",...}]}`.
  - `data.ts`: `loadSlaacData(): Promise<SlaacData | null>` (fetches the four small files + `meta.json` + `routes.json`; 404 on any required file → null; malformed → throws, same discipline as `lib/sky-data.ts`), with validators exported for the test.

- [ ] **Step 1: Write `launch-sua-sources.json`** from `/tmp/claude-1000/-home-neelayranjan-Documents-portfolio/8d08531e-ae6f-44c9-a360-d5c6b7149e15/scratchpad/launch-sua-sources.md` (copy that file into `docs/superpowers/specs/2026-09-30-launch-sua-sources.md` first so it survives the session). Sites: KSC (R-2932, R-2933, R-2934, R-2935, W-497A, W-497B), Vandenberg (R-2516, R-2517, R-2534A, R-2534B, W-532S), Wallops (R-6604A, R-6604B; W-386 ONLY if Step 2 confirms it), Spaceport America (R-5111A, R-5111B ONLY if Step 2 confirms), Starbase (TFR FDC 5/3325 XML URL), Blue Origin Van Horn (TFR FDC 5/0611 XML URL). No White Sands, no Mojave, no Kodiak.
- [ ] **Step 2: Confirm the two medium-confidence items** by fetching the sources the report names (the NASA Wallops Range User's Handbook figure for the VACAPES warning-area number; the FAA PDF placing Spaceport America in R-5111A/B). Decision rule: include an item only if the source itself, opened, says it; otherwise leave it out and record why in `launch-sua-sources.json` (`"excluded": "<reason>"`).
- [ ] **Step 3: Write `prepare_launch_sua.py`**: one GET of the FAA layer (`.../Special_Use_Airspace/FeatureServer/0/query?where=1%3D1&outFields=NAME,TYPE_CODE&f=geojson`, paginated if `exceededTransferLimit`), cached to `scripts/slaac/.cache/faa_sua.geojson` (gitignored) with its SHA-256 printed; select the approved designators; merge rows by NAME (union of rings is NOT computed: keep each row's outer ring as its own polygon, since the pipeline treats polygons independently); fetch the two TFR XMLs (cache them too) and parse their vertex lists; clip any ring to the model domain box (lat 24-50, lon -126..-66) with Sutherland-Hodgman, setting `clipped: true`; write `launch-sua.json`. It never reads `SUA_all`.
- [ ] **Step 4: Write `prepare_nav.py`** (navaids via `nasa.load`'s `ws.load_waypoints` + the vor3 filter; airports for the pairs in `scripts/slaac/pairs.json` if present, else skip that file with a message; the outline decode).
- [ ] **Step 5: Run both**: `~/.venvs/slaac/bin/python scripts/slaac/prepare_nav.py && ~/.venvs/slaac/bin/python scripts/slaac/prepare_launch_sua.py`. Expected: counts printed (navaids a few hundred to a few thousand; 6 sites with their polygon counts).
- [ ] **Step 6: Write the failing test `scripts/test-slaac-data.mjs`**: navaids arrays equal length, all names `^[A-Z]{3}$`, all inside the box; `launch-sua.json` has exactly the approved site ids `["ksc","vandenberg","wallops","spaceport-america","starbase","van-horn"]` minus any excluded ones listed in `launch-sua-sources.json`, every poly has ≥3 vertices, an `https://` source, and a designator present in `launch-sua-sources.json`; no site id `white-sands`/`mojave`/`kodiak`; `validateMeta`, `validateRoutes`, `validateLaunch` from `data.ts` accept the committed files and reject a copy with one field removed.
- [ ] **Step 7: Implement `lib/slaac/data.ts`** to pass it.
- [ ] **Step 8: Run** `node --test scripts/test-slaac-data.mjs` (routes.json doesn't exist yet: the test skips the routes assertions with `t.skip` when absent, and Task 9 removes that skip).
- [ ] **Step 9: Commit** (`slaac: public nav subset, outline and launch airspace from FAA data`).

---

### Task 9: Hub list, owner-reviewed pairs, and the LM route library

**Files:**
- Create: `scripts/slaac/hubs.json`, `scripts/slaac/pairs.json`, `scripts/slaac/route_library.py`
- Create (output): `public/slaac/routes.json`
- Modify: `scripts/test-slaac-data.mjs` (remove the routes skip)

**Interfaces:**
- Produces `routes.json`: `{"version":1,"lm":{"file":"route_lm_best.pt","params":222420992,"temperature":0.8,"top_k":40,"max_new":60},"context":{"actype":..,"fl":..,"month":..,"dow":..,"hour":..},"pairs":[{"origin":"KMIA","dest":"KSFO","routes":[{"seed":..,"tokens":[...],"fixes":[[name,lat,lon],...],"max_leg_nm":..}]}],"dropped":{"geocode":n,"max_leg":n,"endpoint":n}}`.

- [ ] **Step 1: Build `hubs.json`** from the FAA's public "Passenger Boarding (Enplanement) and All-Cargo Data for U.S. Airports" (latest calendar year, the Commercial Service Airports rankings file on faa.gov). Record the URL and the year. Keep the top 30 lower-48 airports by rank as ICAO codes (`K` + FAA LID). Verify every code has an `<AP:...>` token in the LM vocab (`route_lm_best.pt`'s `itos`) and a row in `airports.txt`; print any that don't and drop them.
- [ ] **Step 2: Draft `pairs.json`**: 48 pairs among those hubs, at least 24 of which have a great-circle chord passing within 150 nm of a launch site's polygons (Florida: MIA/FLL/MCO/TPA to the northeast; California: LAX/SAN/SFO/SJC/SMF/LAS/PHX along the coast; Virginia/Mid-Atlantic: DCA/IAD/BWI/PHL/EWR/JFK/BOS southbound; Texas: IAH/DFW/AUS/SAT west toward El Paso-side Van Horn and south toward Brownsville-side Starbase). Compute the chord distances in the script and print them next to each pair.
- [ ] **Step 3: OWNER CHECKPOINT.** Show the owner the hub source URL and the pair list (as a table with the nearest launch site and distance). Wait for approval or edits before Step 4. Record "approved by owner, <date>" in `pairs.json`.
- [ ] **Step 4: Write `route_library.py`**: load the LM with the owner's `route_lm.load_route_lm` (from the `predictive_daily_flight_modeling` dir, by path), on `cuda` if available; for each pair build 8 prefix rows with the fixed context (actype `B738`, fl 350, month 9, dow 2, hour 14; for pairs under 400 nm use `E75L` at fl 300), and call the owner's `generate_batch(model, vocab, rows, temperature=0.8, top_k=40, max_new=60)` with `torch.manual_seed(pair_index)` before each pair. Geocode with `gen_trx_sua.py`'s `parse_route_tokens` + `geocode_items(items, index)` (the Viterbi `nearest` path) using the index `gen_trx_sua` builds from `wyp345plus.txt` + `airports.txt` (find its builder by reading `gen_trx_sua.py` around lines 1340-1400 and call the same function); drop routes whose `route_max_leg_nm > 1000`, and apply `--endpoints anchor` behaviour (re-anchor on the chosen origin/destination). If fewer than 5 routes survive for a pair, regenerate that pair with the next seed up to 3 times, then drop the pair and report it.
- [ ] **Step 5: Run it**: `~/.venvs/slaac/bin/python scripts/slaac/route_library.py`. Expected: per-pair survivor counts, drop totals, file size (< 400 KB), wall time. Then re-run `prepare_nav.py` so `airports.json` covers exactly the library's airports.
- [ ] **Step 6: Remove the routes skip in `test-slaac-data.mjs`** and add: every pair has ≥5 routes, every route's first fix is its origin and last its destination, no leg over 1000 nm, every fix within the domain box, and `validateRoutes` accepts the file. Run `node --test scripts/test-slaac-data.mjs`, expect PASS.
- [ ] **Step 7: Commit** (`slaac: LM route library over <n> public-hub pairs`).

---

### Task 10: The snapped-plan gate and the step sweep (Python)

**Files:**
- Create: `scripts/slaac/gate.py`
- Create (output): `scripts/slaac-gate/report.json`, `scripts/slaac-gate/report.md`
- Modify: `public/slaac/meta.json` (`sampler.steps`, and a new `"display": "snapped" | "continuous"`)

**Interfaces:**
- Consumes: `nasa.load`, `sg.local_reroute`, `routes.json`, `launch-sua.json`, `navaids.json`.
- Produces: `report.json` with, per policy (`hug`, `wide`) and per steps in [20, 30, 40, 50]: `n_reroutes`, `leg_clear_rate_pct` (legs crossing = 0), `clear_at_margin_pct`, `added_nm_median`, `added_pct_median`, `min_clearance_nm_median`, `shorter_after_reroute`, `exceptions`, `t_gen_s_median`; plus `chosen_steps`, `display`, and the failing cases (pair, route index, polygon id, legs crossing) when any.

- [ ] **Step 1: Write `gate.py`.** Case set: every route in the library × {the launch preset (all sites at once), 200 random polygons generated with `eval_sua.py`'s own random-polygon function (import it by path; if it isn't importable as a function, port its generator into `gate.py` from `eval_sua.py` and cite the lines)} × {hug, wide} × steps, margin 25, `clear_margin_nm = 25`. Skip (and count) route/polygon combinations with no affected leg. Sampler: `plan_cli.Sampler` with `cfg` from `plan_cli` defaults and the swept `steps`, on `cuda`. Reroute with `sg.local_reroute`. Metrics with `plan_cli.leg_crossings` / `min_clearance_nm` / `path_len_nm`.
- [ ] **Step 2: Decision rule, coded:**
  - A steps value is ACCEPTABLE if, versus steps=40 on the same cases: leg-clear rate within 0.5 points, median added nm within 10%, median min clearance within 2 nm.
  - `chosen_steps` = the smallest acceptable value.
  - `display = "snapped"` if at `chosen_steps`: wide leg-clear ≥ 99.0%, hug ≥ 98.0%, `exceptions == 0`, `shorter_after_reroute == 0`; else `"continuous"`.
- [ ] **Step 3: Run it** (`~/.venvs/slaac/bin/python scripts/slaac/gate.py`), then write `report.md` summarising the table.
- [ ] **Step 4: OWNER CHECKPOINT if `display == "continuous"`**: bring the owner the failing cases with a diagnosis (which stage broke: dense path inside, snapping, repair budget, anchors). Fixes to the pipeline are allowed (owner, 2026-09-30); any fix goes into BOTH `nasa.py`'s wrapper (never editing the owner's files in place without asking) and the TS port, with a new vector case, and the gate re-runs.
- [ ] **Step 5: Write `chosen_steps` and `display` into `meta.json`**, re-run `node --test scripts/test-slaac-*.mjs` (all pass), commit (`slaac: gate report; <display> plans at <steps> steps`).

---

### Task 11: Worker, protocol, arc planning and batching

**Files:**
- Create: `lib/slaac/arcs.ts`, `lib/slaac-protocol.ts`, `lib/slaac-worker.ts`, `lib/slaac-engine.ts`
- Modify: `lib/stargaze.ts` (`OffloadKind` gains `"slaac"`), `lib/track.ts` (demo union gains `"slaac"`)
- Test: `scripts/test-slaac-arcs.mjs`

**Interfaces:**
- Consumes: `anchorsFor`, `localReroute`, `samplePaths`, `endpointsFromLL`, `toMetres`, `normalNoise`, `Navaids`, `loadSua`, `metrics`.
- Produces:
  ```ts
  // lib/slaac/arcs.ts
  export type RerouteOpts = Parameters<typeof localReroute>[3]; // the opts object localReroute takes
  export type FlightIn = { id: string; nominal: Fix[] };
  export type ArcJob = { flight: string; index: number; entry: Fix; rejoin: Fix };
  export function planArcs(flights: FlightIn[], polys: Poly[], opts: RerouteOpts): ArcJob[];
  export function chunk<T>(xs: T[], size: number): T[][];
  export const BATCH_CAP_DESKTOP = 16; export const BATCH_CAP_PHONE = 4; // arcs per forward; confirmed in Task 15

  // lib/slaac-protocol.ts
  export type RerouteReq = { kind: "reroute"; runId: number; flights: FlightIn[]; rings: [number, number][][]; marginNm: number; hug: boolean; seed: number; steps: number; batchCap: number; display: "snapped" | "continuous" };
  export type Req = { kind: "load"; modelUrl: string; meta: Meta; navaids: { names: string[]; lat: number[]; lon: number[] } } | RerouteReq | { kind: "cancel"; runId: number };
  export type FlightOut = { id: string; dense: [number, number][]; plan: Fix[]; roles: string[]; metrics: ReturnType<typeof metrics>; status: "ok" | "untouched" | "cannot-clear" };
  export type Res =
    | { kind: "loaded"; ok: true } | { kind: "loaded"; ok: false; reason: string }
    | { kind: "progress"; runId: number; step: number; steps: number; arcs: { flight: string; index: number; xyLL: [number, number][] }[] }
    | { kind: "done"; runId: number; flights: FlightOut[]; ms: number; arcs: number }
    | { kind: "cancelled"; runId: number } | { kind: "error"; runId: number; message: string };

  // lib/slaac-engine.ts
  export class SlaacUnloaded extends Error {}   // stargaze terminated the worker
  export class SlaacCancelled extends Error {}  // a newer reroute press superseded this one
  export type SlaacEngine = { reroute(req: Omit<RerouteReq, "kind" | "runId">, onProgress: (p: Extract<Res, { kind: "progress" }>) => void): Promise<Extract<Res, { kind: "done" }>>; cancel(): void; terminate(): void };
  export function loadSlaacEngine(): Promise<SlaacEngine | null>; // memoized; null if meta or model 404s
  export function unloadSlaacEngine(): void; // stargaze offload; noteOffload("slaac")
  ```

- [ ] **Step 1: Write the failing test `test-slaac-arcs.mjs`**: (a) `planArcs` over the reroute vectors' nominal routes returns exactly the calls `localReroute` makes, in order; (b) a polygon far from every route yields `[]` (Review Focus 2); (c) `chunk([1..10], 4)` → `[[1,2,3,4],[5,6,7,8],[9,10]]`; (d) BATCHED sampling equals UNBATCHED: run `samplePaths` with n=3 arcs in one call vs three n=1 calls with the matching noise slices, via the node ONNX model from Task 6's test, max|d| < 1e-3 m (proves batching doesn't change any arc; per-arc noise is sliced from ONE seeded draw so each arc's noise equals the owner's shared-seed behaviour: every arc gets the SAME noise, `normalNoise(seed, C*N)` repeated per arc).
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement `arcs.ts`** (planArcs = flatMap of `anchorsFor`).
- [ ] **Step 4: Implement the worker** (`lib/slaac-worker.ts`): imports `onnxruntime-web/wasm` (and nothing else from ORT), sets `ort.env.wasm.wasmPaths = "/ort/"`, `numThreads = min(4, navigator.hardwareConcurrency || 1)`; on `load` creates the session from `modelUrl` and replies `loaded`. On `reroute`: set `currentRun = runId`; `polys = loadSua(rings)`; `jobs = planArcs(...)`; if none, reply `done` with every flight `untouched` immediately (no model call). Otherwise for each chunk of `batchCap` jobs run `samplePaths` with `onStep` that (a) throws `new Error("cancelled")` if `currentRun !== runId`, (b) posts `progress` at most every 2 steps with each arc's x0 converted to lat/lon (inverse Albers). Collect each job's dense arc (metres), then run `localReroute` per flight with a sampler that returns the precomputed arc for its (entry, rejoin) key. For `display: "continuous"` the flight's plan is still computed (metrics need it) but the UI draws `dense`. Status `cannot-clear` when `legCrossings > 0`. `cancel` sets `currentRun = -1`. Messages for any `runId !== currentRun` are never posted (stale-reply rule).
- [ ] **Step 5: Implement the engine client** on the `chess-engine.ts` pattern: literal `new Worker(new URL("./slaac-worker.ts", import.meta.url), { type: "module" })`; `loadSlaacEngine` fetches `/slaac/meta.json`, HEADs `/models/${meta.model}` (404 → null), posts `load`; `reroute` increments `runId`, cancels the previous run (its promise rejects with `SlaacCancelled`), resolves on the matching `done`; `terminate` rejects pending with `SlaacUnloaded`, clears the memo, calls `noteOffload("slaac")`.
- [ ] **Step 6: Add `"slaac"` to `OffloadKind` and to `trackDemoOnce`'s union.**
- [ ] **Step 7: Run all node tests** (`node --test scripts/test-slaac-*.mjs`), expect PASS. Run `npx tsc --noEmit`, expect no errors.
- [ ] **Step 8: Commit** (`slaac: worker, protocol and batched arc sampling`).

---

### Task 12: The figure

**Files:**
- Create: `components/figures/RerouteFigure.tsx`, `components/figures/reroute-map.ts`, `components/figures/ring.ts`
- Modify: `app/page.tsx` (NASA box: `<DeferredMount><RerouteFigure /></DeferredMount>` in place of `<FlightFigure />`), `content/copy.ts` (`copy.research.figReroute`)
- Test: `scripts/test-slaac-ring.mjs`

**Interfaces:**
- Consumes: `loadSlaacData`, `loadSlaacEngine`, `unloadSlaacEngine`, `useStargazing`/`subscribeStargaze`, `trackDemoOnce`, `InstrumentFigure`.
- Produces:
  - `ring.ts`: `export type RingCheck = { ok: true } | { ok: false; reason: "too-few" | "self-crossing" }; export function checkRing(ll: [number, number][]): RingCheck;` (projects with `albers`, rejects < 3 vertices and any pair of non-adjacent edges that intersect, using `geometry.ts`'s segment test).
  - `reroute-map.ts`: `export type MapView = { w: number; h: number; dpr: number; scale: number; ox: number; oy: number }; export function fitLower48(w: number, h: number, dpr: number): MapView; export function toScreen(v: MapView, lat: number, lon: number): [number, number]; export function fromScreen(v: MapView, x: number, y: number): [number, number]; export function drawMap(ctx: CanvasRenderingContext2D, v: MapView, s: MapState, colours: MapColours, font: string): void;` where `MapState` holds outline, routes, polygons (launch + drawn + in-progress ring), progress arcs, results, hover. Pure: no React, no fetch.

- [ ] **Step 1: Write the failing `test-slaac-ring.mjs`**: triangle ok; 2 points `too-few`; a bow-tie `self-crossing`; a concave L-shape ok; a ring whose last vertex equals the first is treated as closed (duplicate dropped) and ok.
- [ ] **Step 2: Run, verify fail. Step 3: implement `ring.ts`. Step 4: run, pass.**
- [ ] **Step 5: Implement `reroute-map.ts`**: `fitLower48` fits the Albers bbox of lat 24-50, lon -125..-66 into `w×h` with 8px padding, north up; `drawMap` draws, in order: the outline (rule colour, 1px), launch polygons (stamp red at 0.18 fill, 1px stroke, site label in mono 10px), drawn polygons (same style) and the in-progress ring (dashed), filed routes (ink at 0.45, 1px), progress arcs (x0 green at 0.5, 1.5px), finished plans (x0 green, 2px) with deviation fixes as 3px dots and BEND points hollow, continuous paths (x0 green dashed) when `display == "continuous"`, hover highlight on one flight.
- [ ] **Step 6: Implement `RerouteFigure.tsx`** (`"use client"`), rendered inside `InstrumentFigure n="3"`:
  - On mount: `loadSlaacData()`; null → the figure body is one line, `copy.research.figReroute.unavailable`; a malformed file → `console.error` and the same line.
  - Controls row (mono 11px, wraps at 400px): pair `<select>` (label "route"), "draw airspace" toggle button, "clear", "all launch sites" checkbox, margin `<input type="range" min=10 max=50 step=5>` with its value, lookahead segmented control ("1 waypoint" / "infinite"), "reroute" button. Margin/lookahead changes after a run mark the result stale (readout says so) and the next press re-runs; nothing re-runs by itself.
  - Canvas: width = container, height = `min(0.62 * width, 60vh)`, DPR-aware; ResizeObserver redraws on WIDTH change only.
  - Drawing: pointerdown on canvas while "draw airspace" is on adds a vertex (`fromScreen`); clicking within 12px (22px touch) of the first vertex closes the ring via `checkRing`; refusal shows `copy.research.figReroute.ringTooFew` / `ringSelfCrossing` for 3s. Escape cancels the in-progress ring.
  - Reroute press: disable controls; `loadSlaacEngine()` (first press downloads the model; readout "loading model"); null → unavailable line; then `engine.reroute({ flights, rings, marginNm, hug, seed: Date.now() >>> 0, steps: meta.sampler.steps, batchCap: isPhone ? BATCH_CAP_PHONE : BATCH_CAP_DESKTOP, display: meta.display })`, where `isPhone = matchMedia("(max-width: 879px)").matches`. Progress repaints the arcs (rAF-coalesced). On done: table per flight (added nm, added %, min clearance, legs crossing; `cannot-clear` rows say `copy.research.figReroute.cannotClear`), one runtime line, `<n> arcs in <s> s` (no "in your browser": page 1 already says it twice, the no-self-vouching limit); `trackDemoOnce("slaac")`.
  - Zero arcs → readout `copy.research.figReroute.noConflict`, no model load.
  - `SlaacCancelled` / `SlaacUnloaded` → controls re-enable silently (never an error line).
  - Stargaze (the spec's rule, the chess shape): `subscribeStargaze(true)` → remember `wasLoaded = engine loaded or loading`, then `unloadSlaacEngine()`; on `false` → reload (`loadSlaacEngine()`) only if `wasLoaded`. A load that resolves after an unload is discarded by a load-generation counter, as the other panels do.
  - Off-screen / tab hidden: no animation runs except while a reroute is in flight (progress repaints are event-driven, not a rAF loop).
  - `data-*` hooks for the verify suite: `data-reroute-figure`, `data-reroute-pair`, `data-reroute-draw`, `data-reroute-launch`, `data-reroute-margin`, `data-reroute-lookahead`, `data-reroute-go`, `data-reroute-status` (JSON: state, arcs, ms, flights with metrics), and `window.__slaac` (`{ runId, loaded, lastDone }`) as a verify hook.
- [ ] **Step 7: Wire into `app/page.tsx`**: replace `<FlightFigure />` in the NASA box with `<DeferredMount><RerouteFigure /></DeferredMount>`; remove the `FlightFigure` import there.
- [ ] **Step 8: Check it in the dev server** (http://localhost:3001): pick a Florida pair, turn on all launch sites, reroute; screenshot desktop 1280 and phone 400 with Playwright MCP; confirm the plan clears and the table fills. Fix what the screenshots show.
- [ ] **Step 9: Run** `npx tsc --noEmit`, `node --test scripts/test-slaac-*.mjs`, `node scripts/check-voice.mjs`. **Commit** (`slaac: Figure 3 is the live rerouter`).

---

### Task 13: Copy, the NASA box, Experience, and the video to /lab

**Files:**
- Modify: `content/copy.ts` (`research.nasaProse`, `research.notes.slaac`, new `research.notes.data`, `research.notes.disclaimer`, `research.figReroute.*`, `research.figFlight` caption for /lab, `experience.rows` NASA entries), `app/page.tsx` (rail notes in the NASA box), `app/lab/page.tsx` (S3), `components/figures/FlightFigure.tsx` (accept `n: string`)

- [ ] **Step 1: Fetch Wikipedia's "Signs of AI writing"** (owner's standing instruction) and keep it open for this task.
- [ ] **Step 2: Write the copy** (first person, SLAAC first):
  - `nasaProse`: SLAAC in the poster's framing: routes reroute around closed airspace at sampling time, with no retraining; the reroute has to come back as named fixes a controller will accept. One short sentence on SHIFT (fall 2026): ATC speech-to-text and a typed parser from transcripts to a maneuver database.
  - `notes.slaac`: the poster's two-column numbers, cited "From the SLAAC poster:", both policies named as the poster names them.
  - `notes.data`: airspace from the FAA's public data where possible (the internal airspace file isn't public), no historical route database (the filed routes are the LM's), some loss of quality against the internal data.
  - `notes.disclaimer`: concrete differences once measured (Task 15 fills the numbers): same model weights; the steps count if it changed; public airspace; LM routes written ahead of time.
  - `figReroute.caption` (paper length): what the visitor is looking at and doing; the routes were written ahead of time by the LM; the reroute runs live.
  - `figReroute.unavailable`, `ringTooFew`, `ringSelfCrossing`, `cannotClear`, `noConflict`, `stale`, control labels, the launch-site legend note (Starbase and Van Horn as "a past launch TFR").
  - `figFlight.caption` for /lab: the existing caption, lightly adapted ("Figure S3" context, no "above/below" references).
  - Experience: NASA rows per the new resume (SLAAC May-Aug 2026; SHIFT Aug 2026 to present), lamp states unchanged.
- [ ] **Step 3: Render the rail notes** in the NASA box (`Row rail={...}` stacking `slaac`, `data`, `disclaimer` notes like the Research rows).
- [ ] **Step 4: /lab**: `FlightFigure` takes `n` (default removed), `/lab` renders `<DeferredMount><FlightFigure n="S3" /></DeferredMount>` after S2, and `copy.masthead.supplementContents` adds " · a day of synthesized flight plans" (the teaser is hand-kept; see CLAUDE.md).
- [ ] **Step 5: Run** `node scripts/check-voice.mjs` (PASS), `npx tsc --noEmit`, screenshot `/` NASA box and `/lab` S3 at 1280 and 400.
- [ ] **Step 6: Commit** (`copy: SLAAC-first NASA box, data and disclaimer notes, video to /lab`).

---

### Task 14: Browser verification

**Files:**
- Modify: `scripts/verify-redesign.mjs`

- [ ] **Step 1: Move `flight-video-play-pause`** to `/lab` (rename `lab-flight-video`), same assertions.
- [ ] **Step 2: Add checks** (each registered in the checks list; each proved to bite by a temporary mutation, recorded in a comment above it):
  - `slaac-nothing-at-rest`: at 1280, scroll the NASA box into view, draw nothing; no request to `/models/flightdiff-` or `/ort/` (bite: call `loadSlaacEngine()` on mount). Second half: draw a small polygon far from every route (Nevada desert at a pair's opposite coast), press reroute → status `noConflict`, still no model request.
  - `slaac-reroute`: `page.clock.setFixedTime` pinned; pick the first Florida pair; enable all launch sites; press reroute; wait for `data-reroute-status.state == "done"`; every flight with `status != "untouched"` has `legCrossings == 0` except those marked `cannot-clear`, and at least one flight was rerouted; `window.vaq` holds exactly one `demo_used` with `demo: "slaac"`; press reroute again immediately and then once more: only the last run's `done` lands (runId check), still one `demo_used` (bite: drop the runId filter in the worker).
  - `slaac-launch-preset`: the six (or approved) site labels are drawn: read `data-reroute-status.launchSites` and a pixel in each site's projected polygon centre is stamp-red-ish.
  - `slaac-stargaze-cancel`: start a reroute, enter stargaze during progress, exit: no `done`, no error line, no `demo_used`, `window.__offload.slaac == 1`, the worker is gone (bite: skip `unloadSlaacEngine` in the stargaze handler).
  - `slaac-400`: 400x800, `touch` emulated: no horizontal scroll; "draw airspace" then three taps and a tap on the first vertex closes a ring; a two-tap attempt shows `ringTooFew`.
- [ ] **Step 3: Update `checkNoEarlyHeavyPayload` and `checkOrtRuntimeBuild`** to include the slaac worker's `/ort/` fetch: the plain `ort-wasm-simd-threaded.wasm`, never asyncify/jsep/jspi.
- [ ] **Step 4: Build and run the full suite**: `npm run build && npx next start -p 3100 &` then `VERIFY_BASE=http://localhost:3100 node scripts/verify-redesign.mjs` (port 3000 is taken by Open WebUI). Expected: every check passes; the frame-time check may fail under machine load (see CLAUDE.md's A/B rule before touching anything for it).
- [ ] **Step 5: Commit** (`verify: slaac checks, flight video on /lab`).

---

### Task 15: Real-browser measurement, the notes' numbers, CLAUDE.md

**Files:**
- Modify: `lib/slaac/arcs.ts` (batch caps if measurement says so), `content/copy.ts` (`notes.disclaimer` numbers), `CLAUDE.md`, `docs/superpowers/specs/2026-09-30-slaac-rerouter-design.md` (a "Measured" section)

- [ ] **Step 1: Measure on a production build** (`npm run build && npx next start -p 3100`), in desktop Chrome and Firefox via the Playwright MCP browser (not headless timing claims: record which browser and that it is this laptop): model download time and size, first-reroute time for (a) one Florida pair + all launch sites, (b) the same with a big drawn polygon; per-step ms; the batch cap that keeps each progress interval under ~300 ms. Record numbers in the spec's new "Measured" section.
- [ ] **Step 2: Phone pass**: ask the owner to open the preview on their iPhone once it exists (Task 16) and report the time and any stall; until then, run a WebKitGTK probe modelled on `scripts/probe-webkit-draw.py` if the environment allows, and record the result.
- [ ] **Step 3: Update `notes.disclaimer`** with the measured facts (e.g. the step count and that everything runs on the visitor's device), through `check-voice.mjs`.
- [ ] **Step 4: Update `CLAUDE.md` on the branch**: a "SLAAC rerouter (Figure 3)" section under the demos (contracts: port pinned by vectors, shared-seed arcs, batching, the gate and its decision, data permissions, launch-airspace sources and cycle, the LM library is precomputed), the Model artifacts table rows, the new verify checks and node test counts, the resolved NASA drift (two roles), and Open items (LM distillation; the owner's rewrite of the pipeline).
- [ ] **Step 5: Run everything once more** (`node --test` over all `scripts/test-*.mjs` the CLAUDE.md lists plus the slaac ones; the full verify suite). **Commit** (`slaac: measured, documented`).

---

### Task 16: The preview link for the mentor

- [ ] **Step 1: Ask the owner before pushing.** Message: the branch is ready, pushing `slaac-demo` makes Vercel build a preview; nothing reaches production.
- [ ] **Step 2: On a yes**: `git push -u origin slaac-demo`. Find the preview with the Vercel MCP (`list_deployments` for project `portfolio`, branch `slaac-demo`); wait for READY.
- [ ] **Step 3: Check Deployment Protection** (`get_project` → protection settings). If previews require Vercel login, tell the owner the two options (a shareable link for this deployment, or protection bypass) and let them choose; do not change protection settings without their answer.
- [ ] **Step 4: Smoke the preview** with Playwright MCP: page loads, Figure 3 reroutes a Florida pair around the launch sites, `/lab` S3 plays. Screenshot both.
- [ ] **Step 5: Hand the owner the link**, the screenshots, and a two-line summary for the mentor. Merge to `main` only when the owner says the mentor approved.
