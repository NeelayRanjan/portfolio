"""Hand-run. ~/.venvs/slaac/bin/python scripts/slaac/gate.py [flags]

The snapped-plan gate and the denoising-step sweep (plan Task 10). Runs the owner's
REAL pipeline (plan_cli.Sampler + sua_guidance.local_reroute, imported BY PATH through
nasa.py, nothing copied) over the demo's actual inputs and decides:
  (a) chosen_steps: the fewest DPM-Solver steps that stay as accurate as 40, and
  (b) display: whether the figure shows snapped named-fix plans or continuous paths.

Case set
  launch  every library route in public/slaac/routes.json against ALL polygons of
          public/slaac/launch-sua.json at once (the "all launch sites" preset). A route
          with no affected leg (sg._leg_affected at 25 nm, the trigger both policies
          use: hug_margin_nm = 25, and the wide branch's lock distance is
          max(reroute_dist_nm, clear_margin_nm) = 25) is skipped and counted.
  random  --n-random cases built by eval_sua.build_cases (imported by path): it picks
          a library route with eval_sua's own filters (CONUS, >=4 fixes, 300-2500 nm)
          and places eval_sua.random_polygon_on_route on it until the polygon crosses
          a filed leg. RNG: np.random.default_rng(--seed), eval_sua's default seed 0.
Each case runs under both policies (hug, wide) and every --steps value, each run with
a FRESH DPMSolverMultistepScheduler so solver state never leaks between runs.

Options mirror plan_cli.build's defaults: lock_dist = reroute_dist = 10, snap_tol 100,
dev_spacing 150, rdp_tol 10, hug_margin = sua_margin = clear_margin = 25; sampler
seed 0, guidance 2.0, sample_size 256, lowpass_sigma 2.0, sua_strength 1.0,
sua_smooth 1.0. The snap table is nasa.snap_table (plan_cli's vor3) clipped to the
same box as public/slaac/navaids.json, asserted identical to that file.

"exceptions" = any Python exception from local_reroute/refine for a run; caught per
run, recorded with a traceback summary, never allowed to abort the sweep. They count
as NOT clear in the rates.

Owner rulings (2026-09-30), superseding the plan's decision rule where they differ:
  R7  launch-sua.json unions each site's touching rings (prepare_launch_sua.py).
  R8  "shorter after reroute" = a replaced stretch whose plan is shorter than the
      straight line between its entry and rejoin anchors (impossible geometry). Plans
      shorter than the LM filed route are counted as shorter_than_filed, information only.
  R9  steps by the plan's rule; display "snapped" with policies [wide, hug] if hug >= 98%
      and wide >= 99% leg-clear with 0 exceptions and 0 anchor-chord violations, else
      [wide] if wide alone passes, else "continuous" (owner checkpoint, meta untouched).
A snapped result writes sampler.steps, display and policies into public/slaac/meta.json.

Outputs: scripts/slaac-gate/report.json, scripts/slaac-gate/report.md, and the per-run
rows at scripts/slaac-gate/rows.jsonl (resumable: rows already present are skipped).

Flags: --n-random 200  --seed 0  --steps 20,30,40,50  --policies hug,wide
       --limit N (first N cases only, for timing)  --device cuda  --no-report
"""
import argparse, json, math, os, statistics, sys, time, traceback
import numpy as np, torch
sys.path.insert(0, os.path.dirname(__file__))
import nasa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PUB = os.path.join(ROOT, "public/slaac")
OUT = os.path.join(ROOT, "scripts/slaac-gate")
NM = 1852.0
BOX = (17.0, 50.0, -130.0, -60.0)   # prepare_nav.py's navaids box
MARGIN = 25.0
OPTS = dict(lock_dist_nm=10.0, snap_tol_nm=100.0, dev_spacing_nm=150.0, rdp_tol_nm=10.0,
            hug_margin_nm=MARGIN, clear_margin_nm=MARGIN)
BASE_STEPS = 40


def load_eval_sua(plan_dir):
    import importlib.util
    spec = importlib.util.spec_from_file_location("eval_sua", os.path.join(plan_dir, "eval_sua.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def cfg_for(steps, device):
    # plan_cli.build's cfg keys and argparse defaults (plan_cli.py main/build)
    return dict(device=device, seed=0, steps=int(steps), guidance=2.0, sample_size=256,
                lowpass_sigma=2.0, sua_strength=1.0, sua_margin_nm=MARGIN, sua_smooth=1.0,
                sua_snap_tol_nm=100.0, sua_rdp_tol_nm=10.0, sua_spacing_nm=150.0,
                reroute_dist_nm=10.0, clear_margin_nm=MARGIN, route_radius_nm=15.0,
                route_min_spacing_nm=30.0, hug=1)


def snap_table_boxed(ws):
    w3 = nasa.snap_table(ws)
    lat0, lat1, lon0, lon1 = BOX
    keep = [i for i in range(len(w3.names))
            if lat0 <= w3.lat[i] <= lat1 and lon0 <= w3.lon[i] <= lon1]
    db = ws.WaypointDB(w3.names[keep], w3.lat[keep], w3.lon[keep])
    nav = json.load(open(os.path.join(PUB, "navaids.json")))
    assert [str(n) for n in db.names] == nav["names"], "snap table != navaids.json names"
    assert np.allclose(db.lat, nav["lat"]) and np.allclose(db.lon, nav["lon"]), "navaids lat/lon"
    return db


def library():
    r = json.load(open(os.path.join(PUB, "routes.json")))
    out = []
    for p in r["pairs"]:
        pair = f"{p['origin']}-{p['dest']}"
        for k, rt in enumerate(p["routes"]):
            out.append(dict(pair=pair, idx=k, fixes=[(str(n), float(a), float(b)) for n, a, b in rt["fixes"]]))
    return out


def launch_polys():
    s = json.load(open(os.path.join(PUB, "launch-sua.json")))
    out = []
    for site in s["sites"]:
        for j, p in enumerate(site["polys"]):
            ring = [(float(a), float(b)) for a, b in p["ring"]]
            if len(ring) > 1 and ring[0] == ring[-1]:
                ring = ring[:-1]
            out.append(dict(id=f"{site['id']}:{p['designator']}#{j}", ring=ring))
    return out


def leg_affected_culled(sg, A, B, polys_m, boxes):
    """sg._leg_affected, with polygons whose bounding box lies more than 25 nm from the
    leg's bounding box dropped first. Exact: a crossing, or any point of the leg within
    25 nm of a polygon, implies the two boxes are within 25 nm."""
    a = plan_xy(sg, [A, B])
    lo, hi = a.min(0), a.max(0)
    gap = MARGIN * NM + 1.0
    near = [P for P, (plo, phi) in zip(polys_m, boxes)
            if np.all(plo - gap <= hi) and np.all(lo <= phi + gap)]
    return bool(near) and sg._leg_affected(A, B, near, MARGIN)


def build_cases(sg, es, lib, n_random, seed):
    lp = launch_polys()
    lp_m = [sg.points_to_albers(p["ring"]) for p in lp]
    boxes = [(P.min(0), P.max(0)) for P in lp_m]
    cases, skipped = [], 0
    for i, r in enumerate(lib):
        f = r["fixes"]
        if any(leg_affected_culled(sg, f[k], f[k + 1], lp_m, boxes) for k in range(len(f) - 1)):
            cases.append(dict(kind="launch", pair=r["pair"], route=r["idx"], lib=i,
                              poly_id="launch-preset", rings=[p["ring"] for p in lp]))
        else:
            skipped += 1

    class DB:  # eval_sua.build_cases reads route_db.routes {od: fixes}
        routes = {(r["pair"], r["idx"]): r["fixes"] for r in lib}
    rng = np.random.default_rng(seed)
    rc = es.build_cases(DB, n_random, rng)
    nrand_skipped = 0
    for j, (od, fixes, poly, kind) in enumerate(rc):
        assert kind == "random"
        P = sg.points_to_albers(poly)
        if not any(sg._leg_affected(fixes[k], fixes[k + 1], [P], MARGIN) for k in range(len(fixes) - 1)):
            nrand_skipped += 1   # cannot happen: build_cases requires a crossing leg
            continue
        lib_i = next(i for i, r in enumerate(lib) if (r["pair"], r["idx"]) == od)
        cases.append(dict(kind="random", pair=od[0], route=od[1], lib=lib_i,
                          poly_id=f"rand{j:03d}", rings=[[tuple(map(float, v)) for v in poly]]))
    eligible = len({(r["pair"], r["idx"]) for r in lib
                    if len(r["fixes"]) >= 4
                    and 300 <= es.path_len_nm(es.fixes_to_m(r["fixes"])) <= 2500
                    and es.in_region(r["fixes"], es.CONUS_BOX)})
    return cases, dict(launch_polys=len(lp), launch_affected=sum(c["kind"] == "launch" for c in cases),
                       launch_skipped=skipped, random=sum(c["kind"] == "random" for c in cases),
                       random_skipped=nrand_skipped, random_eligible_routes=eligible,
                       library_routes=len(lib), seed=seed)


def diagnose(sg, plan, roles, arcs, polys_m):
    """Which stage broke, for a run whose plan still crosses: the dense arc itself,
    an anchor inside the margin, or the snapping/repair of a clear arc."""
    cm = MARGIN * NM
    xy = plan_xy(sg, plan)
    bad = [k for k in range(len(plan) - 1)
           if any(sg._seg_crosses_poly(xy[k], xy[k + 1], P) for P in polys_m)]
    arc_in = arc_clear = None
    if arcs:
        allp = np.concatenate(arcs, axis=0)
        arc_in = sg.count_inside(allp, polys_m)
        arc_clear = round(sg.clearance_nm(allp, polys_m), 2)
    anchors = [k for k, r in enumerate(roles) if r == "rejoin"]
    anchors += [k - 1 for k, r in enumerate(roles) if r == "deviation" and k > 0 and roles[k - 1] != "deviation"]
    anchor_ill = sorted({plan[k][0] for k in anchors if sg.pt_illegal(xy[k], polys_m, 0.0)})
    anchor_margin = sorted({plan[k][0] for k in anchors if sg.pt_illegal(xy[k], polys_m, cm)})
    end_inside = [plan[k][0] for k in (0, len(plan) - 1) if sg.pt_illegal(xy[k], polys_m, 0.0)]
    if end_inside:
        stage = "endpoint inside"
    elif anchor_ill:
        stage = "anchors"
    elif arc_in:
        stage = "dense path inside"
    else:
        stage = "snapping/repair"
    return dict(stage=stage, bad_legs=[[plan[k][0], plan[k + 1][0], roles[k], roles[k + 1]] for k in bad],
                arc_points_inside=arc_in, arc_clearance_nm=arc_clear,
                anchors_inside=anchor_ill, anchors_in_margin=anchor_margin, endpoints_inside=end_inside)


def plan_xy(sg, fixes):
    a = np.asarray([[f[1], f[2]] for f in fixes], float)
    x, y = sg.albers(a[:, 0], a[:, 1])
    return np.column_stack([x, y])


class CpuDenorm:
    """plan_cli.Sampler ends with cache.denorm_xy(final on the device), and the stats
    object's xy_mean lives on the CPU, so on cuda the owner's Sampler raises a device
    mismatch (plan_cli's own --device default is cpu, which is why it never surfaced).
    This shim moves the sampler's final xy to the CPU first and changes nothing else:
    the same float32 multiply-add, on the same values."""
    def __init__(self, stats):
        self._s = stats

    def __getattr__(self, k):
        return getattr(self._s, k)

    def denorm_xy(self, t):
        return self._s.denorm_xy(t.detach().cpu())


W = {}


def worker_init(nasa_dir, device):
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    torch.set_num_threads(1)
    model, sched, stats, sg, ws, pc = nasa.load(nasa_dir)
    model.to(device).eval()
    W.update(model=model, sched=sched, stats=CpuDenorm(stats), sg=sg, pc=pc,
             wpdb=snap_table_boxed(ws), device=device)


def worker_run(job):
    c, p, s = job
    return run_one(W["model"], W["sched"], W["stats"], W["sg"], W["pc"], W["wpdb"], c, p, s, W["device"])


def run_one(model, sched, stats, sg, pc, wpdb, case, policy, steps, device):
    from diffusers import DPMSolverMultistepScheduler
    polys_m = [sg.points_to_albers(r) for r in case["rings"]]
    nominal = case["_fixes"]
    smp = pc.Sampler(model, DPMSolverMultistepScheduler.from_config(sched.config), stats,
                     cfg_for(steps, device))
    row = dict(key=case["key"], kind=case["kind"], pair=case["pair"], route=case["route"],
               poly_id=case["poly_id"], policy=policy, steps=steps)
    t0 = time.perf_counter()
    try:
        plan, roles = sg.local_reroute(nominal, polys_m, smp, wpdb=wpdb, hug=(policy == "hug"), **OPTS)
    except Exception as e:
        tb = traceback.extract_tb(e.__traceback__)
        row.update(exception=f"{type(e).__name__}: {e}",
                   where=[f"{os.path.basename(f.filename)}:{f.lineno} {f.name}" for f in tb[-4:]],
                   t_gen_s=smp.gen_time, t_total_s=time.perf_counter() - t0)
        return row
    t_total = time.perf_counter() - t0
    nom_nm = pc.path_len_nm(pc.fixes_to_m(nominal))
    plan_nm = pc.path_len_nm(pc.fixes_to_m(plan))
    xing = pc.leg_crossings(plan, polys_m)
    under = sg.plan_illegal_legs(plan, polys_m, MARGIN)
    clr = pc.min_clearance_nm(plan, polys_m)
    row.update(exception=None, legs_crossing=int(xing), legs_under_margin=int(under),
               nominal_legs_crossing=int(pc.leg_crossings(nominal, polys_m)),
               min_clearance_nm=clr, nominal_nm=nom_nm, plan_nm=plan_nm,
               added_nm=plan_nm - nom_nm, added_pct=100.0 * (plan_nm - nom_nm) / nom_nm,
               n_arcs=len(smp.arcs), n_dev=sum(r == "deviation" for r in roles),
               n_bend=sum(1 for f, r in zip(plan, roles) if r == "deviation" and f[0] == "BEND"),
               t_gen_s=smp.gen_time, t_total_s=t_total,
               plan=[[n, round(a, 5), round(b, 5), r] for (n, a, b), r in zip(plan, roles)])
    row["anchor_chord_violations"] = chord_violations(plan, roles, pc)
    if xing:
        row["diagnosis"] = diagnose(sg, plan, roles, smp.arcs, polys_m)
    return row


CHORD_TOL_NM = 1e-6


def chord_violations(plan, roles, pc):
    """Ruling R8: for each replaced stretch, the plan between the entry and rejoin anchors
    must not be SHORTER than the straight line between those two anchors (impossible
    geometry, so a real bug). Returns the offending stretches."""
    out = []
    for k, r in enumerate(roles):
        if r != "rejoin":
            continue
        e = k - 1
        while e > 0 and roles[e] == "deviation":
            e -= 1
        L = pc.path_len_nm(pc.fixes_to_m(plan[e:k + 1]))
        C = pc.path_len_nm(pc.fixes_to_m([plan[e], plan[k]]))
        if L < C - CHORD_TOL_NM:
            out.append(dict(entry=plan[e][0], rejoin=plan[k][0], plan_nm=L, chord_nm=C))
    return out


def stretches(row, nominal, pc):
    """For a plan shorter than its filed route: each replaced stretch, entry -> rejoin,
    with the filed length between the anchors, the plan's length between them, and the
    straight chord. A filed stretch far longer than its chord is a dogleg in the filed
    route, which a deviation that hugs the chord removes."""
    plan = row["plan"]
    out, j0 = [], 0
    names = [(f[0], round(f[1], 4), round(f[2], 4)) for f in nominal]

    def nidx(f, start):
        key = (f[0], round(f[1], 4), round(f[2], 4))
        for k in range(start, len(names)):
            if names[k] == key:
                return k
        return None
    for k, f in enumerate(plan):
        if f[3] != "rejoin":
            continue
        e = k - 1
        while e > 0 and plan[e][3] == "deviation":
            e -= 1
        ie, ir = nidx(plan[e], j0), nidx(f, j0)
        if ie is None or ir is None:
            continue
        j0 = ir
        L = lambda fx: pc.path_len_nm(pc.fixes_to_m([(x[0], x[1], x[2]) for x in fx]))
        out.append(dict(entry=plan[e][0], rejoin=f[0],
                        filed_nm=round(L(nominal[ie:ir + 1]), 1),
                        plan_nm=round(L(plan[e:k + 1]), 1),
                        chord_nm=round(L([plan[e], f]), 1),
                        filed_dropped=[x[0] for x in nominal[ie + 1:ir]],
                        deviation=[x[0] for x in plan[e + 1:k]]))
    return out


def med(xs):
    xs = [x for x in xs if x is not None and math.isfinite(x)]
    return float(statistics.median(xs)) if xs else None


def summarize(rows):
    n = len(rows)
    ok = [r for r in rows if r["exception"] is None]
    return dict(
        n_reroutes=n,
        leg_clear_rate_pct=100.0 * sum(r["legs_crossing"] == 0 for r in ok) / n if n else None,
        clear_at_margin_pct=100.0 * sum(r["legs_under_margin"] == 0 for r in ok) / n if n else None,
        added_nm_median=med([r["added_nm"] for r in ok]),
        added_pct_median=med([r["added_pct"] for r in ok]),
        min_clearance_nm_median=med([r["min_clearance_nm"] for r in ok]),
        anchor_chord_violations=sum(bool(r["anchor_chord_violations"]) for r in ok),
        shorter_than_filed=sum(r["plan_nm"] < r["nominal_nm"] for r in ok),   # information only (R8)
        exceptions=n - len(ok),
        t_gen_s_median=med([r["t_gen_s"] for r in ok]),
        t_total_s_median=med([r["t_total_s"] for r in ok]),
        bend_fixes=sum(r["n_bend"] for r in ok),
    )


def decide(table, steps_list, policies):
    """Steps: the plan's rule, verbatim (Task 10 Step 2). Display: the owner's ruling R9,
    which supersedes the plan's: both policies -> snapped [wide, hug]; else wide alone ->
    snapped [wide]; else continuous. The shorter-than-filed check is replaced by the
    anchor-chord check (R8)."""
    log, accept = [], {}
    for s in sorted(steps_list):
        ok_all = True
        for p in policies:
            a, b = table[p][str(s)], table[p][str(BASE_STEPS)]
            d_rate = abs(a["leg_clear_rate_pct"] - b["leg_clear_rate_pct"])
            d_add = abs(a["added_nm_median"] - b["added_nm_median"])
            lim_add = 0.10 * abs(b["added_nm_median"])
            d_clr = abs(a["min_clearance_nm_median"] - b["min_clearance_nm_median"])
            ok = d_rate <= 0.5 and d_add <= lim_add and d_clr <= 2.0
            ok_all &= ok
            log.append(f"steps {s} {p}: |clear rate diff| {d_rate:.2f} <= 0.5 pts "
                       f"{'yes' if d_rate <= 0.5 else 'NO'}; |median added diff| {d_add:.2f} nm "
                       f"<= {lim_add:.2f} (10%) {'yes' if d_add <= lim_add else 'NO'}; "
                       f"|median clearance diff| {d_clr:.2f} <= 2 nm {'yes' if d_clr <= 2.0 else 'NO'}"
                       f" -> {'acceptable' if ok else 'not acceptable'}")
        accept[s] = ok_all
        log.append(f"steps {s}: {'ACCEPTABLE' if ok_all else 'not acceptable'} (both policies)")
    chosen = min(s for s in accept if accept[s])
    log.append(f"chosen_steps = smallest acceptable = {chosen}")
    th = {"wide": 99.0, "hug": 98.0}
    passes = {}
    for p in policies:
        c = table[p][str(chosen)]
        conds = [(f"leg-clear {c['leg_clear_rate_pct']:.2f}% >= {th[p]}%", c["leg_clear_rate_pct"] >= th[p]),
                 (f"exceptions {c['exceptions']} == 0", c["exceptions"] == 0),
                 (f"anchor-chord violations {c['anchor_chord_violations']} == 0", c["anchor_chord_violations"] == 0)]
        for txt, v in conds:
            log.append(f"{p} @ {chosen}: {txt}: {'yes' if v else 'NO'}")
        passes[p] = all(v for _, v in conds)
        log.append(f"{p} @ {chosen}: {'PASSES' if passes[p] else 'fails'}")
    if passes.get("hug") and passes.get("wide"):
        display, chosen_pol = "snapped", ["wide", "hug"]
        log.append("hug and wide both pass -> display snapped, policies [wide, hug]")
    elif passes.get("wide"):
        display, chosen_pol = "snapped", ["wide"]
        log.append("wide alone passes -> display snapped, policies [wide] (infinite lookahead only)")
    else:
        display, chosen_pol = "continuous", []
        log.append("wide does not pass -> display continuous (owner checkpoint)")
    log.append(f"display = {display}")
    return chosen, display, chosen_pol, accept, log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nasa-dir", default=nasa.DEFAULT)
    ap.add_argument("--n-random", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--steps", default="20,30,40,50")
    ap.add_argument("--policies", default="hug,wide")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--rows", default=os.path.join(OUT, "rows.jsonl"))
    ap.add_argument("--no-report", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    steps_list = [int(s) for s in a.steps.split(",")]
    policies = [p.strip() for p in a.policies.split(",")]

    _, _, _, sg, ws, pc = nasa.load(a.nasa_dir)
    plan_dir, _ = nasa.paths(a.nasa_dir)
    es = load_eval_sua(plan_dir)
    wpdb = snap_table_boxed(ws)
    lib = library()
    cases, counts = build_cases(sg, es, lib, a.n_random, a.seed)
    for c in cases:
        c["_fixes"] = lib[c["lib"]]["fixes"]
        c["key"] = f"{c['kind']}|{c['pair']}|{c['route']}|{c['poly_id']}"
    print(json.dumps(counts), flush=True)
    if a.limit:   # first N of EACH kind, for timing
        cases = ([c for c in cases if c["kind"] == "launch"][:a.limit]
                 + [c for c in cases if c["kind"] == "random"][:a.limit])
    else:         # the exact case set, so the JS port can replay any of it
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, "cases.json"), "w") as fh:
            json.dump(dict(version=1, counts=counts, launch_polygons="public/slaac/launch-sua.json, every site",
                           cases=[dict(key=c["key"], kind=c["kind"], pair=c["pair"], route=c["route"],
                                       poly_id=c["poly_id"],
                                       ring=(c["rings"][0] if c["kind"] == "random" else None))
                                  for c in cases]), fh, separators=(",", ":"))

    os.makedirs(os.path.dirname(a.rows), exist_ok=True)
    done = set()
    if os.path.exists(a.rows):
        for line in open(a.rows):
            r = json.loads(line)
            done.add((r["key"], r["policy"], r["steps"]))
    todo = [(c, p, s) for s in steps_list for p in policies for c in cases
            if (c["key"], p, s) not in done]
    print(f"{len(cases)} cases x {len(policies)} policies x {len(steps_list)} steps; "
          f"{len(todo)} runs to do ({len(done)} already in {a.rows})", flush=True)
    t_start = time.perf_counter()
    import multiprocessing as mp
    # slowest first (launch cases carry 23 polygons) so the pool's tail is short
    todo.sort(key=lambda j: j[0]["kind"] != "launch")
    ctx = mp.get_context("spawn")
    pool = (ctx.Pool(min(a.workers, len(todo)), initializer=worker_init,
                     initargs=(a.nasa_dir, a.device)) if todo else None)
    with open(a.rows, "a") as fh:
        for i, row in enumerate(pool.imap_unordered(worker_run, todo) if pool else [], 1):
            fh.write(json.dumps(row, default=float) + "\n")
            fh.flush()
            if i % 20 == 0 or i == len(todo):
                el = time.perf_counter() - t_start
                print(f"{i}/{len(todo)}  {el:.0f}s elapsed, ~{el / i * (len(todo) - i):.0f}s left", flush=True)
    if pool:
        pool.close()
        pool.join()
    wall = time.perf_counter() - t_start
    if a.no_report:
        return

    keys = {c["key"] for c in cases}
    rows = [json.loads(l) for l in open(a.rows)]
    rows = [r for r in rows if r["key"] in keys and r["policy"] in policies and r["steps"] in steps_list]
    table, by_kind = {}, {}
    for p in policies:
        table[p], by_kind[p] = {}, {}
        for s in steps_list:
            sel = [r for r in rows if r["policy"] == p and r["steps"] == s]
            table[p][str(s)] = summarize(sel)
            by_kind[p][str(s)] = {k: summarize([r for r in sel if r["kind"] == k]) for k in ("launch", "random")}
    chosen, display, chosen_pol, accept, log = decide(table, steps_list, policies)
    failing = [dict(policy=r["policy"], steps=r["steps"], kind=r["kind"], pair=r["pair"], route=r["route"],
                    poly_id=r["poly_id"], legs_crossing=r.get("legs_crossing"),
                    exception=r["exception"], diagnosis=r.get("diagnosis"), where=r.get("where"))
               for r in rows if r["exception"] or r["legs_crossing"] > 0]
    libmap = {(x["pair"], x["idx"]): x["fixes"] for x in lib}
    shorter = [dict(policy=r["policy"], steps=r["steps"], kind=r["kind"], pair=r["pair"], route=r["route"],
                    poly_id=r["poly_id"], added_nm=r["added_nm"],
                    stretches=stretches(r, libmap[(r["pair"], r["route"])], pc))
               for r in rows if r["exception"] is None and r["plan_nm"] < r["nominal_nm"]]
    rep = dict(version=1, generated=time.strftime("%Y-%m-%d"), counts=counts, options=OPTS,
               sampler=cfg_for(BASE_STEPS, a.device) | {"steps": steps_list},
               snap_table=f"nasa.snap_table (vor3) clipped to {BOX}, == public/slaac/navaids.json ({len(wpdb.names)} fixes)",
               rates_note="exceptions count as not clear; medians over runs without exceptions",
               table=table, by_kind=by_kind, acceptable={str(k): v for k, v in accept.items()},
               chosen_steps=chosen, display=display, policies=chosen_pol, decision_log=log,
               anchor_chord_cases=[dict(policy=r["policy"], steps=r["steps"], pair=r["pair"], route=r["route"],
                                        poly_id=r["poly_id"], stretches=r["anchor_chord_violations"])
                                   for r in rows if r["exception"] is None and r["anchor_chord_violations"]],
               failing_cases=failing, shorter_cases=shorter,
               wall_time_s_this_invocation=round(wall, 1))
    with open(os.path.join(OUT, "report.json"), "w") as f:
        json.dump(rep, f, indent=1, default=float)
    write_md(rep, policies, steps_list)
    print("\n".join(log))
    if display == "snapped" and not a.limit:
        write_meta(chosen, display, chosen_pol)


def write_meta(steps, display, policies):
    """Step 5: only reached when the gate says snapped (a continuous result is an owner
    checkpoint and leaves meta.json alone). Same formatting as export_model.py."""
    p = os.path.join(PUB, "meta.json")
    m = json.load(open(p))
    m["sampler"]["steps"] = int(steps)
    m["display"] = display
    m["policies"] = list(policies)
    with open(p, "w") as fh:
        json.dump(m, fh, indent=1)
    print(f"wrote {p}: sampler.steps={steps}, display={display}, policies={policies}")


def write_md(rep, policies, steps_list):
    L = ["# SLAAC snapped-plan gate", "",
         f"Generated {rep['generated']} by `scripts/slaac/gate.py` (owner's pipeline, imported by path).", "",
         "## Cases", ""]
    c = rep["counts"]
    L += [f"- Library: {c['library_routes']} routes.",
          f"- Launch preset (all {c['launch_polys']} polygons at once): {c['launch_affected']} affected routes, "
          f"{c['launch_skipped']} skipped (no leg within 25 nm).",
          f"- Random: {c['random']} cases from `eval_sua.build_cases` (seed {c['seed']}, "
          f"{c['random_eligible_routes']} eligible routes after its CONUS / 300-2500 nm / >=4-fix filters), "
          f"{c['random_skipped']} skipped.",
          "- Policies hug (1-waypoint) and wide (infinite lookahead), margin 25 nm, clear_margin 25 nm.",
          f"- {rep['rates_note']}.", "", "## All cases", "",
          "| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | added % (med) | min clearance nm (med) | chord viol. | shorter than filed | exceptions | t_gen s (med) |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|"]

    def f(v, d=2):
        return "-" if v is None else f"{v:.{d}f}"
    for p in policies:
        for s in steps_list:
            t = rep["table"][p][str(s)]
            L.append(f"| {p} | {s} | {t['n_reroutes']} | {f(t['leg_clear_rate_pct'])} | {f(t['clear_at_margin_pct'])} | "
                     f"{f(t['added_nm_median'], 1)} | {f(t['added_pct_median'])} | {f(t['min_clearance_nm_median'], 1)} | "
                     f"{t['anchor_chord_violations']} | {t['shorter_than_filed']} | {t['exceptions']} | {f(t['t_gen_s_median'], 3)} |")
    for kind in ("launch", "random"):
        L += ["", f"## {kind} cases only", "",
              "| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | chord viol. | shorter than filed | exceptions |",
              "|---|---|---|---|---|---|---|---|---|---|"]
        for p in policies:
            for s in steps_list:
                t = rep["by_kind"][p][str(s)][kind]
                L.append(f"| {p} | {s} | {t['n_reroutes']} | {f(t['leg_clear_rate_pct'])} | {f(t['clear_at_margin_pct'])} | "
                         f"{f(t['added_nm_median'], 1)} | {f(t['min_clearance_nm_median'], 1)} | "
                         f"{t['anchor_chord_violations']} | {t['shorter_than_filed']} | {t['exceptions']} |")
    L += ["", "## Decision", ""] + [f"- {x}" for x in rep["decision_log"]]
    L += ["", f"**chosen_steps = {rep['chosen_steps']}, display = {rep['display']}, "
          f"policies = {rep['policies']}**", ""]
    if rep["failing_cases"]:
        L += ["## Failing runs (legs crossing > 0 or exception)", "",
              "| policy | steps | kind | pair | route | polygon | legs crossing | stage / exception |", "|---|---|---|---|---|---|---|---|"]
        for x in rep["failing_cases"]:
            st = x["exception"] or (x["diagnosis"] or {}).get("stage")
            L.append(f"| {x['policy']} | {x['steps']} | {x['kind']} | {x['pair']} | {x['route']} | {x['poly_id']} | "
                     f"{x['legs_crossing']} | {st} |")
    if rep["shorter_cases"]:
        L += ["", "## Plans shorter than the filed route (information only, ruling R8)", "",
              "Each replaced stretch: filed length between the anchors / plan length / straight chord (nm).", "",
              "| policy | steps | pair | route | polygon | added nm | stretches |", "|---|---|---|---|---|---|---|"]
        for x in rep["shorter_cases"]:
            st = "; ".join(f"{t['entry']}>{t['rejoin']} {t['filed_nm']:.0f}/{t['plan_nm']:.0f}/{t['chord_nm']:.0f}"
                           for t in x["stretches"])
            L.append(f"| {x['policy']} | {x['steps']} | {x['pair']} | {x['route']} | {x['poly_id']} | "
                     f"{x['added_nm']:.2f} | {st} |")
    with open(os.path.join(OUT, "report.md"), "w") as fh:
        fh.write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
