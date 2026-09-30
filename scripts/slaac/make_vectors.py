"""Hand-run. ~/.venvs/slaac/bin/python scripts/slaac/make_vectors.py [--nasa-dir DIR]

Writes scripts/slaac-vectors/{albers,geometry,dpm,guidance,sampler,reroute}.json:
reference ("parity") vectors produced by the owner's Python pipeline, imported BY
PATH through nasa.py (nothing of theirs is copied here). The TypeScript ports in
Tasks 3-7 are pinned against these files; the layout is the Task 2 vector
contract (.superpowers/sdd/2026-09-30-slaac-rerouter/task-2-contract.md).

Deterministic: every random draw comes from a seeded numpy Generator or a seeded
torch.Generator, and every sampler run uses a fresh DPMSolverMultistepScheduler.
Everything runs on the CPU. The file ends with a self-validation pass that reloads
each JSON and asserts every contract key and array shape.

dtypes, so a port picks the right tolerance:
  albers, geometry, guidance, chord_features, reroute: float64 inputs, float64 math.
  dpm: float32 tensors (what the real sampler steps), recorded as float64.
  sampler runs: the real float32 pipeline end to end; each run carries its own
    tolerance_m from the torch-vs-onnxruntime drift (ruling R2).
"""
import argparse, json, os, sys
import numpy as np, torch
sys.path.insert(0, os.path.dirname(__file__))
import nasa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "scripts/slaac-vectors")
NM = 1852.0
N = 256
rng = np.random.default_rng(20260930)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def conv(o):
    if isinstance(o, torch.Tensor):
        o = o.detach().cpu().numpy()
    if isinstance(o, np.ndarray):
        if o.dtype == np.bool_ or np.issubdtype(o.dtype, np.integer):
            return o.tolist()
        return np.asarray(o, dtype=np.float64).tolist()
    if isinstance(o, np.floating): return float(o)
    if isinstance(o, np.integer): return int(o)
    if isinstance(o, np.bool_): return bool(o)
    if isinstance(o, np.str_): return str(o)
    raise TypeError(type(o))


def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, default=conv, allow_nan=False, separators=(",", ":"))


def ring(lat, lon, r_deg, k=7, jitter=0.25):
    """Star-shaped (so simple) lat/lon ring: sorted angles, jittered radius."""
    ang = np.sort(rng.uniform(0, 2 * np.pi, k))
    rr = r_deg * (1 + jitter * rng.uniform(-1, 1, k))
    return [(lat + rr[i] * np.sin(ang[i]), lon + rr[i] * np.cos(ang[i]) * 1.3) for i in range(k)]


# Concave L-shape (lat, lon), hand-written.
L_SHAPE = [(32.0, -106.5), (32.0, -103.5), (33.0, -103.5), (33.0, -105.5), (35.0, -105.5), (35.0, -106.5)]


def plist(polys):
    return [np.asarray(P, np.float64) for P in polys]


def fix(name, lat, lon):
    return [str(name), float(lat), float(lon)]


def fixes_json(fs):
    return [fix(*f) for f in fs]


# ---------------------------------------------------------------------------
# albers.json
# ---------------------------------------------------------------------------
def albers(sg):
    lats = np.linspace(20.0, 52.0, 8)
    lons = np.linspace(-128.0, -64.0, 8)
    LA, LO = np.meshgrid(lats, lons, indexing="ij")
    la, lo = LA.ravel(), LO.ravel()
    x, y = sg.albers(la, lo)
    ila, ilo = sg.inverse_albers(x, y)
    assert np.abs(ila - la).max() < 1e-9 and np.abs(ilo - lo).max() < 1e-9, "albers round trip"
    cases = [dict(lat=la[i], lon=lo[i], x=x[i], y=y[i], inv_lat=ila[i], inv_lon=ilo[i])
             for i in range(len(la))]
    dump("albers.json", {"cases": cases})
    return len(cases)


# ---------------------------------------------------------------------------
# geometry.json
# ---------------------------------------------------------------------------
def geo_polys(sg):
    rings = [ring(39.0, -100.0, 1.2), ring(35.0, -90.0, 1.0), ring(42.0, -85.0, 1.4), L_SHAPE]
    return sg.load_sua(rings)


def pts_around(P, n_uniform=150, n_near=50):
    lo, hi = P.min(0), P.max(0)
    pad = 0.3 * (hi - lo)
    u = rng.uniform(lo - pad, hi + pad, size=(n_uniform, 2))
    # near the boundary: a point on a random edge plus up to 30 nm of offset
    K = len(P)
    e = rng.integers(0, K, n_near)
    t = rng.uniform(0, 1, n_near)[:, None]
    on = P[e] * (1 - t) + P[(e + 1) % K] * t
    near = on + rng.uniform(-30 * NM, 30 * NM, size=(n_near, 2))
    special = np.vstack([P[0], P[2], 0.5 * (P[1] + P[2]), P.mean(0)])   # vertices, an edge midpoint, centroid
    return np.vstack([u, near, special])


def rand_seg(lo, hi):
    return rng.uniform(lo, hi), rng.uniform(lo, hi)


def geometry(sg):
    polys = geo_polys(sg)
    out = {k: [] for k in ["inside", "nearest_boundary", "seg_crosses_poly", "seg_poly_dist",
                           "seg_illegal", "pt_illegal", "dist_to_sua_nm", "rdp_mask"]}
    for P in polys:
        pts = pts_around(P)
        out["inside"].append(dict(pts=pts, poly=P, out=sg._inside(pts, P)))
        out["nearest_boundary"].append(dict(pts=pts, poly=P, out=sg._nearest_boundary(pts, P)))
        lo, hi = P.min(0), P.max(0)
        pad = 0.4 * (hi - lo)
        segs = [rand_seg(lo - pad, hi + pad) for _ in range(30)]
        c = P.mean(0)
        segs += [
            (P[0].copy(), P[0] + (P[0] - c)),            # starts exactly on a vertex, points outward
            (P[1].copy(), P[2].copy()),                  # lies exactly on an edge
            (c.copy(), c + 0.1 * (P[0] - c)),            # entirely inside
            (P[0] + 1.5 * (P[0] - c), P[3] + 1.5 * (P[3] - c)),   # both ends outside, cuts across
            (P[0] + 0.3 * (P[0] - c), P[0] + 0.3 * (P[0] - c)),   # zero-length, outside
        ]
        for a, b in segs:
            out["seg_crosses_poly"].append(dict(a=a, b=b, poly=P, out=bool(sg._seg_crosses_poly(a, b, P))))
            out["seg_poly_dist"].append(dict(a=a, b=b, poly=P, out=float(sg.seg_poly_dist(a, b, P))))
    allp = np.vstack(polys)
    lo, hi = allp.min(0), allp.max(0)
    for _ in range(40):
        a, b = rng.uniform(lo, hi), rng.uniform(lo, hi)
        for m in (0.0, 25 * NM):
            out["seg_illegal"].append(dict(a=a, b=b, polys=polys, margin_m=m,
                                           out=bool(sg.seg_illegal(a, b, polys, m))))
    pts = np.vstack([rng.uniform(lo, hi, size=(80, 2)),
                     pts_around(polys[1], n_uniform=0, n_near=16)])      # 16 near + 4 specials
    for p in pts:
        for m in (0.0, 25 * NM):
            out["pt_illegal"].append(dict(p=p, polys=polys, margin_m=m, out=bool(sg.pt_illegal(p, polys, m))))
        out["dist_to_sua_nm"].append(dict(p=p, polys=polys, out=float(sg.dist_to_sua_nm(p, polys))))
    # RDP on a 256-point wavy path, a noisy one, and a closed loop (the L<1e-9 branch)
    s = np.linspace(0, 1, N)
    wavy = np.column_stack([s * 1.2e6, 9e4 * np.sin(6 * np.pi * s) + 3e4 * np.sin(17 * np.pi * s)])
    noisy = wavy + rng.normal(0, 4e3, size=wavy.shape)
    loop = np.column_stack([3e5 * np.cos(2 * np.pi * s), 2e5 * np.sin(2 * np.pi * s)])
    for xy, tol in [(wavy, 10 * NM), (wavy, 2 * NM), (noisy, 10 * NM), (loop, 10 * NM)]:
        out["rdp_mask"].append(dict(xy=xy, tol_m=tol, out=sg._rdp_mask(xy, tol)))
    dump("geometry.json", out)
    return {k: len(v) for k, v in out.items()}


# ---------------------------------------------------------------------------
# dpm.json
# ---------------------------------------------------------------------------
def dpm(sched):
    from diffusers import DPMSolverMultistepScheduler
    cases = []
    for steps in (20, 30, 40, 50):
        sch = DPMSolverMultistepScheduler.from_config(sched.config)
        sch.set_timesteps(steps)
        ts = [int(t) for t in sch.timesteps]
        g = torch.Generator().manual_seed(steps)
        x = torch.randn(2, 7, 16, generator=g)
        roll = []
        for t in ts[:6]:
            mo = torch.randn(2, 7, 16, generator=g)
            prev = sch.step(mo, t, x).prev_sample
            roll.append(dict(t=t, model_output=mo.clone(), sample=x.clone(), prev_sample=prev.clone()))
            x = prev                                     # CHAIN: next sample = this prev_sample
        cases.append(dict(steps=steps, timesteps=ts, rollout=roll))
    sch = DPMSolverMultistepScheduler.from_config(sched.config)
    sch.set_timesteps(40)
    g = torch.Generator().manual_seed(4040)
    xT = torch.randn(2, 7, 16, generator=g)
    x = xT.clone()
    for t in sch.timesteps:
        x = sch.step(0.1 * x, int(t), x).prev_sample
    dump("dpm.json", {"cases": cases, "full40": {"x_T": xT, "x_0": x}})
    return len(cases)


# ---------------------------------------------------------------------------
# guidance.json
# ---------------------------------------------------------------------------
def line_path(a, b, wobble=0.0, freq=3.0):
    s = torch.linspace(0, 1, N, dtype=torch.float64)
    a = torch.as_tensor(a, dtype=torch.float64); b = torch.as_tensor(b, dtype=torch.float64)
    xy = a[:, None] + (b - a)[:, None] * s[None, :]
    d = (b - a) / torch.linalg.norm(b - a)
    perp = torch.stack([-d[1], d[0]])
    return xy + perp[:, None] * wobble * torch.sin(freq * np.pi * s)[None, :]


def guidance(sg):
    out = {"smooth": [], "lowpass": [], "topup": [], "displacement": []}
    g = torch.Generator().manual_seed(7)
    for sigma in (1, 2):
        disp = torch.zeros(2, 2, N, dtype=torch.float64)
        disp[:, :, 90:140] = 5e4                       # a step bump, like one inside-run's push
        disp += 1e4 * torch.randn(2, 2, N, generator=g, dtype=torch.float64)
        out["smooth"].append(dict(disp=disp, sigma=sigma, out=sg._smooth_along_N(disp, sigma)))
    path = torch.cumsum(0.05 * torch.randn(2, 7, N, generator=g, dtype=torch.float64), dim=2)
    out["lowpass"].append(dict(path=path, sigma=2, out=sg.lowpass_path(path, 2)))

    polys = sg.load_sua([ring(38.0, -100.0, 1.0), ring(38.3, -94.0, 1.0)])
    A, B = polys
    cA, cB = A.mean(0), B.mean(0)
    ext = lambda P: (P.max(0) - P.min(0))
    # a path that grazes A: parallel to x, 10 nm above A's top vertex
    top = A[A[:, 1].argmax()]
    graze = line_path([cA[0] - 2.5e5, top[1] + 10 * NM], [cA[0] + 2.5e5, top[1] + 10 * NM])
    cross = line_path([cA[0] - 3e5, cA[1] - 4e4], [cA[0] + 3e5, cA[1] + 6e4], wobble=1.5e4)
    two = line_path([cA[0] - 2.5e5, cA[1]], [cB[0] + 2.5e5, cB[1]], wobble=1e4)
    far = line_path([cA[0] - 3e5, cA[1] + 3 * ext(A)[1]], [cA[0] + 3e5, cA[1] + 3 * ext(A)[1]])

    xy = torch.stack([graze, cross])
    out["topup"].append(dict(xy=xy, polys=polys, margin_m=25 * NM, out=sg._margin_topup(xy, polys, 25 * NM)))
    xy = torch.stack([far, graze])
    out["topup"].append(dict(xy=xy, polys=polys, margin_m=40 * NM, out=sg._margin_topup(xy, polys, 40 * NM)))

    for label, xy, sm in [("crossing", cross[None], 1.0), ("grazing", graze[None], 1.0),
                          ("two-polygons", two[None], 1.0),
                          ("batch", torch.stack([cross, far, two]), 1.0),
                          ("crossing-final-clear", cross[None], 0.0)]:   # sample_paths' final hard clear
        o = sg.sua_displacement(xy, polys, 25.0, sm)
        out["displacement"].append(dict(label=label, xy=xy, polys=polys, margin_nm=25.0, smooth=sm, out=o))
    dump("guidance.json", out)
    return {k: len(v) for k, v in out.items()}


# ---------------------------------------------------------------------------
# sampler.json
# ---------------------------------------------------------------------------
class OrtModel(torch.nn.Module):
    """FlightDiffusion's call signature over an onnxruntime session. drop is honoured
    exactly like FlightDiffusion.forward: eh zeroed and tid -> null_type for dropped rows."""
    def __init__(self, path, null_type):
        super().__init__()
        import onnxruntime as ort
        self.s = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        self.null_type = null_type

    def forward(self, noisy, t, od, eh, sc, tid, drop=None):
        tid = tid.clone()
        if drop is not None:
            eh = eh * (~drop).view(-1, 1).to(eh.dtype)
            tid = torch.where(drop, torch.full_like(tid, self.null_type), tid)
        feed = dict(noisy=noisy.float().numpy(), t=t.long().numpy(), od=od.float().numpy(),
                    eh=eh.float().numpy(), sc=sc.float().numpy(), tid=tid.long().numpy())
        return torch.from_numpy(self.s.run(None, feed)[0])


def run_sample(model, sched, st, plan_cli, sg, eps, polys, steps, r0, cfg, trace=None, cf_calls=None):
    """plan_cli.sample_paths with its ONE torch.randn call replaced by r0 (asserted)."""
    from diffusers import DPMSolverMultistepScheduler
    sch = DPMSolverMultistepScheduler.from_config(sched.config)
    n = eps.shape[0]
    calls = []
    real_randn = torch.randn

    def fake_randn(*a, **k):
        calls.append(a)
        return r0.clone()

    orig_v2x0, orig_cf = plan_cli.v_to_x0, plan_cli.chord_features
    stash = {}
    if trace is not None:
        def v2x0(*a, **k):
            stash["x0"] = orig_v2x0(*a, **k)              # mutated in place by the pins/SUA below
            return stash["x0"]

        def cf(*a, **k):
            trace.append(stash["x0"][0].clone())          # arc 0's x0 as self-conditioning saw it
            o = orig_cf(*a, **k)
            if cf_calls is not None:                      # the REAL float32 args, as torch saw them
                cf_calls.append(dict(p_xy=a[0].clone(), endpoints=a[1].clone(), res_scale=float(a[2]),
                                     out=o.clone()))
            return o
        plan_cli.v_to_x0, plan_cli.chord_features = v2x0, cf
    torch.randn = fake_randn
    try:
        final = plan_cli.sample_paths(
            model, sch, eps, torch.zeros(n, dtype=torch.long), n=n, channels=st.channels,
            sample_size=N, device="cpu", res_scale=st.res_scale, steps=steps,
            guidance=cfg["guidance"], sua=(polys or None), sua_strength=cfg["sua_strength"],
            sua_margin_nm=cfg["sua_margin_nm"], sua_smooth=cfg["sua_smooth"],
            xy_mean=torch.as_tensor(st.xy_mean).float(), xy_scale=st.xy_scale,
            lowpass_sigma=cfg["lowpass_sigma"])
    finally:
        torch.randn = real_randn
        plan_cli.v_to_x0, plan_cli.chord_features = orig_v2x0, orig_cf
    assert len(calls) == 1, f"sample_paths called torch.randn {len(calls)} times, expected exactly 1"
    assert tuple(calls[0][:3]) == (n, st.channels, N), f"randn shape {calls[0]}"
    return final


def sampler(model, sched, st, plan_cli, sg):
    meta = json.load(open(os.path.join(ROOT, "public/slaac/meta.json")))
    ort_model = OrtModel(os.path.join(ROOT, "public/models", meta["model"]), meta["null_type"])
    xm = np.asarray(st.xy_mean, np.float64).reshape(1, 2, 1)
    xs = float(st.xy_scale)
    out = {"note": "chord is computed in float32; the pinned end is A+(D-A)*1.0 in float32",
           "chord_features": [], "runs": []}

    # chord_features on 3 random paths (float64): chord + a smooth random residual
    for kk in range(3):
        n = 2
        eps = torch.from_numpy(rng.normal(0, 0.5, size=(n, 2, 6)))
        s = torch.linspace(0, 1, N, dtype=torch.float64)
        ch = eps[:, 0, :2, None] + (eps[:, 1, :2, None] - eps[:, 0, :2, None]) * s
        res = torch.from_numpy(rng.normal(0, 1, size=(n, 2, N))).cumsum(2) * 0.004
        p = ch + res
        o = plan_cli.chord_features(p, eps, st.res_scale)
        out["chord_features"].append(dict(label=f"random-{kk}", p_xy=p, endpoints=eps,
                                          res_scale=st.res_scale, out=o))

    cfg = dict(guidance=2.0, sua_strength=1.0, sua_margin_nm=25.0, sua_smooth=1.0, lowpass_sigma=2.0)
    ods = [((37.62, -122.38), (39.86, -104.67)),       # KSFO -> KDEN
           ((25.79, -80.29), (33.64, -84.43))]         # KMIA -> KATL
    eps = torch.stack([sg.endpoints_from_ll(o, d, st) for o, d in ods])
    sua_ll = [ring(38.9, -113.5, 1.0), ring(29.6, -82.2, 0.7)]   # each straddles one chord
    for label, steps, seed, polys_ll in [("no-sua", 20, 1, []), ("sua", 40, 2, sua_ll)]:
        polys = sg.load_sua(polys_ll) if polys_ll else []
        r0 = torch.randn(len(ods), st.channels, N, generator=torch.Generator().manual_seed(seed))
        trace, cf_calls = [], []
        final = run_sample(model, sched, st, plan_cli, sg, eps, polys, steps, r0, cfg, trace, cf_calls)
        if polys:
            # The demo's real input: x0's ends are pinned, so p_xy's last column is the float32
            # chord end A+(D-A)*1.0, which can sit 1 ulp off E. A float64 port reads to_end as
            # exactly 0 there and flips the dh_e channels; these cases pin that.
            for i, c in enumerate(cf_calls[:3]):
                out["chord_features"].append(dict(label=f"pipeline-step-{i}", **c))
        final_ort = run_sample(ort_model, sched, st, plan_cli, sg, eps, polys, steps, r0, cfg)
        a = final[:, :2].double().numpy() * xs + xm
        b = final_ort[:, :2].double().numpy() * xs + xm
        drift = float(np.abs(a - b).max())
        if polys:
            inside = sg.count_inside(torch.from_numpy(a), polys)
            assert inside == 0, f"guided run left {inside} points inside SUA"
        out["runs"].append(dict(
            label=label, steps=steps, endpoints=eps, r0=r0, polys_m=plist(polys), final=final,
            x0_first3=torch.stack(trace[:3]), ort_drift_m=drift, tolerance_m=max(50.0, 20 * drift),
            type_ids=[0] * len(ods), endpoints_ll=[[*o, *d] for o, d in ods], **cfg))
        print(f"  sampler run {label}: steps {steps}  ort_drift_m {drift:.4f}")
    dump("sampler.json", out)
    return out["runs"]


# ---------------------------------------------------------------------------
# reroute.json
# ---------------------------------------------------------------------------
LR_OPTS = dict(lock_dist_nm=10.0, snap_tol_nm=100.0, dev_spacing_nm=150.0, rdp_tol_nm=10.0)

ROUTES = [  # (label, origin lat/lon, dest lat/lon); nominal = vor3 fixes along the line
    ("SFO-DEN", (37.62, -122.38), (39.86, -104.67)),
    ("LAX-DFW", (33.94, -118.41), (32.90, -97.04)),
    ("SEA-ORD", (47.45, -122.31), (41.98, -87.90)),
    ("ATL-JFK", (33.64, -84.43), (40.64, -73.78)),
    ("PHX-MSP", (33.43, -112.01), (44.88, -93.22)),
    ("LAX-ATL", (33.94, -118.41), (33.64, -84.43)),
    ("PIR-ORF", (45.00, -101.00), (36.50, -75.50)),    # two separate stretches (two arcs)
    ("BOS-CLE", (42.36, -71.01), (41.41, -81.85)),     # touches nothing: plan == nominal, no arcs
]
SUA_CENTRES = [(38.9, -113.5, 1.0), (33.3, -107.5, 0.9), (43.5, -94.7, 1.0),
               (37.1, -79.1, 0.8), (33.6, -91.5, 0.9)]


def snap_table(ws, nasa_dir):
    _, gen = nasa.paths(nasa_dir)
    wpdb = ws.load_waypoints(os.path.join(gen, "wyp345plus.txt"), fix_types={"VOR", "WAYPOINT"},
                             exclude_digit_names=True, exclude_prefixes=("VP",))
    # exactly plan_cli.build's --snap-table vor3 filter
    m3 = np.array([len(str(n)) == 3 and str(n).isalpha() for n in wpdb.names])
    i3 = np.where(m3)[0]
    return ws.WaypointDB(wpdb.names[i3], wpdb.lat[i3], wpdb.lon[i3])


def nominal_route(sg, w3, o, d, spacing_nm=150.0):
    om = np.array(sg.albers(np.array([o[0]]), np.array([o[1]]))).ravel()
    dm = np.array(sg.albers(np.array([d[0]]), np.array([d[1]]))).ravel()
    k = max(2, int(np.linalg.norm(dm - om) / (spacing_nm * NM)) + 1)
    route = []
    for t in np.linspace(0, 1, k + 1):
        _, i = w3.tree.query(om + (dm - om) * t)
        f = (str(w3.names[i]), float(w3.lat[i]), float(w3.lon[i]))
        if not route or route[-1][0] != f[0]:
            route.append(f)
    return route


class Stub:
    """The sampler local_reroute sees. Returns the REAL plan_cli.Sampler arc (fresh
    scheduler, seed 0, 20 steps), computed once per key and cached, and records the
    calls and the arcs in call order."""
    def __init__(self, model, sched, st, plan_cli, cache, margin, polys_key):
        self.model, self.sched, self.st, self.pc = model, sched, st, plan_cli
        self.cache, self.margin, self.pk = cache, margin, polys_key
        self.calls, self.arcs = [], []

    def __call__(self, entry_ll, rejoin_ll, polys):
        from diffusers import DPMSolverMultistepScheduler
        key = (tuple(map(float, entry_ll)), tuple(map(float, rejoin_ll)), self.margin, self.pk)
        if key not in self.cache:
            cfg = dict(device="cpu", seed=0, steps=20, guidance=2.0, sample_size=N, lowpass_sigma=2.0,
                       sua_strength=1.0, sua_margin_nm=float(self.margin), sua_smooth=1.0)
            smp = self.pc.Sampler(self.model, DPMSolverMultistepScheduler.from_config(self.sched.config),
                                  self.st, cfg)
            self.cache[key] = np.asarray(smp(entry_ll, rejoin_ll, polys), np.float64)
        arc = self.cache[key]
        self.calls.append([float(entry_ll[0]), float(entry_ll[1]), float(rejoin_ll[0]), float(rejoin_ll[1])])
        self.arcs.append(arc)
        return arc.copy()


def run_local(sg, model, sched, st, plan_cli, cache, w3, nominal, polys, hug, margin, pk):
    stub = Stub(model, sched, st, plan_cli, cache, margin, pk)
    plan, roles = sg.local_reroute(nominal, polys, stub, wpdb=w3, hug=hug, hug_margin_nm=float(margin),
                                   clear_margin_nm=float(margin), **LR_OPTS)
    return stub, plan, roles


def reroute(sg, ws, model, sched, st, plan_cli, nasa_dir):
    w3 = snap_table(ws, nasa_dir)
    polys = sg.load_sua([ring(la, lo, r) for la, lo, r in SUA_CENTRES])
    cache = {}
    out = {"snap_table": {"names": [str(n) for n in w3.names], "lat": w3.lat, "lon": w3.lon},
           "local_reroute": [], "refine": []}
    noms = {}
    for label, o, d in ROUTES:
        nominal = nominal_route(sg, w3, o, d)
        noms[label] = nominal
        for hug in (True, False):
            for margin in (25, 40):
                stub, plan, roles = run_local(sg, model, sched, st, plan_cli, cache, w3,
                                              nominal, polys, hug, margin, "five")
                out["local_reroute"].append(dict(
                    label=f"{label} {'hug' if hug else 'wide'} {margin}", hug=hug, margin=margin,
                    nominal=fixes_json(nominal), polys_m=plist(polys), arcs=stub.arcs, calls=stub.calls,
                    plan=fixes_json(plan), roles=list(roles)))
                print(f"  {label:8s} {'hug ' if hug else 'wide'} {margin}: {len(nominal)} filed -> "
                      f"{len(plan)} planned, {len(stub.calls)} arc(s), "
                      f"{sum(r == 'deviation' for r in roles)} deviation")

    # refine_route_sua direct: a few recorded entry->rejoin arcs, and a whole route
    ref_opts = dict(snap_tol_nm=100.0, max_leg_nm=150.0, rdp_tol_nm=10.0)
    seen = set()
    for c in out["local_reroute"]:
        for call, arc in zip(c["calls"], c["arcs"]):
            k = (tuple(call), c["margin"])
            if k in seen or len(seen) >= 6:
                continue
            seen.add(k)
            pool = c["nominal"] + c["plan"]          # the entry can be a kept deviation fix
            entry = next(f for f in pool if (f[1], f[2]) == (call[0], call[1]))
            rejoin = next(f for f in pool if (f[1], f[2]) == (call[2], call[3]))
            route = [tuple(entry), tuple(rejoin)]
            res = sg.refine_route_sua(route, arc, polys, wpdb=w3, clear_margin_nm=float(c["margin"]), **ref_opts)
            out["refine"].append(dict(route=fixes_json(route), dense=arc, polys_m=plist(polys),
                                      margin=c["margin"], out=fixes_json(res), **ref_opts))
    nominal = noms["SFO-DEN"]
    whole = Stub(model, sched, st, plan_cli, cache, 25, "five")
    arc = whole(nominal[0][1:], nominal[-1][1:], polys)
    for margin in (25, 0):
        res = sg.refine_route_sua(nominal, arc, polys, wpdb=w3, clear_margin_nm=float(margin), **ref_opts)
        out["refine"].append(dict(route=fixes_json(nominal), dense=arc, polys_m=plist(polys),
                                  margin=margin, out=fixes_json(res), **ref_opts))

    # endpoint inside: a polygon over the route's first fix (hug, margin 25: plan_cli's defaults)
    f0 = nominal[0]
    ein_polys = sg.load_sua([ring(f0[1], f0[2], 0.6)])
    assert sg.pt_illegal(np.array(sg.albers(np.array([f0[1]]), np.array([f0[2]]))).ravel(), ein_polys, 0.0), \
        "endpoint_inside: the first fix is not inside its polygon"
    stub, plan, roles = run_local(sg, model, sched, st, plan_cli, cache, w3, nominal, ein_polys, True, 25, "ein")
    out["endpoint_inside"] = dict(nominal=fixes_json(nominal), polys_m=plist(ein_polys), arcs=stub.arcs,
                                  calls=stub.calls, hug=True, margin=25, plan=fixes_json(plan), roles=list(roles))
    print(f"  endpoint_inside: {len(stub.calls)} arc(s), plan {len(plan)} fixes, starts {plan[0][0]}")
    dump("reroute.json", out)
    return out


# ---------------------------------------------------------------------------
# self-validation: reload every file and assert the contract's keys and shapes
# ---------------------------------------------------------------------------
def shape(a):
    s = []
    while isinstance(a, list):
        s.append(len(a))
        a = a[0] if a else None
    return tuple(s)


def need(obj, keys, where):
    for k in keys:
        assert k in obj, f"{where}: missing key {k!r}"


def is_poly(P, where):
    s = shape(P)
    assert len(s) == 2 and s[1] == 2 and s[0] >= 3, f"{where}: poly shape {s}"


def fixlist(fs, where):
    assert isinstance(fs, list) and fs, f"{where}: empty fix list"
    for f in fs:
        assert len(f) == 3 and isinstance(f[0], str) and all(isinstance(v, float) for v in f[1:]), f"{where}: fix {f}"


def validate():
    L = lambda n: json.load(open(os.path.join(OUT, n)))
    a = L("albers.json")
    assert set(a) == {"cases"} and len(a["cases"]) == 64
    for c in a["cases"]:
        need(c, ["lat", "lon", "x", "y", "inv_lat", "inv_lon"], "albers")

    g = L("geometry.json")
    assert set(g) == {"inside", "nearest_boundary", "seg_crosses_poly", "seg_poly_dist", "seg_illegal",
                      "pt_illegal", "dist_to_sua_nm", "rdp_mask"}, set(g)
    for c in g["inside"]:
        need(c, ["pts", "poly", "out"], "inside"); is_poly(c["poly"], "inside")
        P = shape(c["pts"]); assert P[1] == 2 and shape(c["out"]) == (P[0],)
        assert all(isinstance(v, bool) for v in c["out"])
    for c in g["nearest_boundary"]:
        need(c, ["pts", "poly", "out"], "nearest_boundary"); assert shape(c["out"]) == shape(c["pts"])
    for k, t in [("seg_crosses_poly", bool), ("seg_poly_dist", float)]:
        for c in g[k]:
            need(c, ["a", "b", "poly", "out"], k); is_poly(c["poly"], k)
            assert shape(c["a"]) == (2,) == shape(c["b"]) and isinstance(c["out"], t), k
    margins = set()
    for c in g["seg_illegal"]:
        need(c, ["a", "b", "polys", "margin_m", "out"], "seg_illegal"); margins.add(c["margin_m"])
        assert isinstance(c["out"], bool)
    assert margins == {0.0, 25 * NM}, margins
    for c in g["pt_illegal"]:
        need(c, ["p", "polys", "margin_m", "out"], "pt_illegal"); assert isinstance(c["out"], bool)
    for c in g["dist_to_sua_nm"]:
        need(c, ["p", "polys", "out"], "dist_to_sua_nm"); assert isinstance(c["out"], float)
    for c in g["rdp_mask"]:
        need(c, ["xy", "tol_m", "out"], "rdp_mask"); assert shape(c["out"]) == (shape(c["xy"])[0],)
    for k in g:
        assert g[k], f"geometry.{k} empty"
    assert any(True in c["out"] for c in g["inside"]) and any(False in c["out"] for c in g["inside"])
    assert {c["out"] for c in g["seg_illegal"]} == {True, False}

    d = L("dpm.json")
    assert set(d) == {"cases", "full40"}
    assert [c["steps"] for c in d["cases"]] == [20, 30, 40, 50]
    for c in d["cases"]:
        need(c, ["steps", "timesteps", "rollout"], "dpm")
        assert len(c["timesteps"]) == c["steps"] and all(isinstance(t, int) for t in c["timesteps"])
        assert len(c["rollout"]) == 6
        for i, r in enumerate(c["rollout"]):
            need(r, ["t", "model_output", "sample", "prev_sample"], "dpm.rollout")
            assert r["t"] == c["timesteps"][i]
            for k in ("model_output", "sample", "prev_sample"):
                assert shape(r[k]) == (2, 7, 16), (k, shape(r[k]))
            if i:
                assert r["sample"] == c["rollout"][i - 1]["prev_sample"], "dpm rollout is not a chain"
    assert shape(d["full40"]["x_T"]) == (2, 7, 16) == shape(d["full40"]["x_0"])

    gu = L("guidance.json")
    assert set(gu) == {"smooth", "lowpass", "topup", "displacement"}
    assert {c["sigma"] for c in gu["smooth"]} == {1, 2}
    for c in gu["smooth"]:
        need(c, ["disp", "sigma", "out"], "smooth"); s = shape(c["disp"])
        assert len(s) == 3 and s[1] == 2 and shape(c["out"]) == s
    for c in gu["lowpass"]:
        need(c, ["path", "sigma", "out"], "lowpass"); assert c["sigma"] == 2
        assert len(shape(c["path"])) == 3 and shape(c["out"]) == shape(c["path"])
    for c in gu["topup"]:
        need(c, ["xy", "polys", "margin_m", "out"], "topup"); assert shape(c["out"]) == shape(c["xy"])
    labels = set()
    for c in gu["displacement"]:
        need(c, ["label", "xy", "polys", "margin_nm", "smooth", "out"], "displacement")
        assert c["margin_nm"] == 25 and shape(c["out"]) == shape(c["xy"]) and shape(c["xy"])[1] == 2
        labels.add(c["label"])
    assert {"crossing", "grazing", "two-polygons"} <= labels, labels

    sm = L("sampler.json")
    assert set(sm) == {"note", "chord_features", "runs"}
    for c in sm["chord_features"]:
        need(c, ["label", "p_xy", "endpoints", "out"], "chord_features")
        n, two, Nn = shape(c["p_xy"]); assert two == 2
        assert shape(c["endpoints"]) == (n, 2, 6) and shape(c["out"]) == (n, 6, Nn)
    pipe = [c for c in sm["chord_features"] if c["label"].startswith("pipeline-step-")]
    assert [c["label"] for c in pipe] == ["pipeline-step-0", "pipeline-step-1", "pipeline-step-2"]
    assert sum(c["label"].startswith("random-") for c in sm["chord_features"]) == 3
    ulp = 0
    for c in pipe:                                    # float32 values are exact in float64
        E = np.array(c["endpoints"])[:, 1, :2]
        to_end = E - np.array(c["p_xy"])[:, :, -1]
        ulp += int(np.count_nonzero(to_end))
    assert ulp > 0, "no pipeline case has a non-zero to_end at column N-1: the ulp is not exercised"
    assert sorted(r["steps"] for r in sm["runs"]) == [20, 40]
    assert sorted(bool(r["polys_m"]) for r in sm["runs"]) == [False, True]
    for r in sm["runs"]:
        need(r, ["label", "steps", "endpoints", "r0", "polys_m", "final", "x0_first3", "ort_drift_m",
                 "tolerance_m"], "runs")
        n, C, Nn = shape(r["r0"])
        assert (C, Nn) == (7, 256) and shape(r["endpoints"]) == (n, 2, 6) and shape(r["final"]) == (n, C, Nn)
        assert shape(r["x0_first3"]) == (3, C, Nn)
        assert r["tolerance_m"] == max(50.0, 20 * r["ort_drift_m"])
        for P in r["polys_m"]:
            is_poly(P, "runs.polys_m")

    rr = L("reroute.json")
    assert set(rr) == {"snap_table", "local_reroute", "refine", "endpoint_inside"}
    st = rr["snap_table"]
    assert len(st["names"]) == len(st["lat"]) == len(st["lon"]) > 1000
    assert all(len(nm) == 3 and nm.isalpha() for nm in st["names"])
    combos = set()
    for c in rr["local_reroute"]:
        need(c, ["label", "hug", "margin", "nominal", "polys_m", "arcs", "calls", "plan", "roles"], "local_reroute")
        combos.add((c["hug"], c["margin"]))
        fixlist(c["nominal"], "nominal"); fixlist(c["plan"], "plan")
        assert len(c["arcs"]) == len(c["calls"])
        for a_ in c["arcs"]:
            assert shape(a_) == (256, 2)
        for cl in c["calls"]:
            assert len(cl) == 4
        assert len(c["plan"]) == len(c["roles"]) and set(c["roles"]) <= {"filed", "deviation", "rejoin"}
    assert combos == {(True, 25), (True, 40), (False, 25), (False, 40)}
    assert any(c["calls"] for c in rr["local_reroute"])
    for c in rr["refine"]:
        need(c, ["route", "dense", "polys_m", "margin", "out"], "refine")
        fixlist(c["route"], "refine.route"); fixlist(c["out"], "refine.out")
        assert shape(c["dense"])[1] == 2
    e = rr["endpoint_inside"]
    need(e, ["nominal", "polys_m", "arcs"], "endpoint_inside")
    for a_ in e["arcs"]:
        assert shape(a_) == (256, 2)
    print("self-validation: all six files match the contract")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nasa-dir", default=nasa.DEFAULT)
    args = ap.parse_args()
    torch.set_grad_enabled(False)
    model, sched, st, sg, ws, plan_cli = nasa.load(args.nasa_dir)
    print("albers", albers(sg))
    print("geometry", geometry(sg))
    print("dpm", dpm(sched))
    print("guidance", guidance(sg))
    sampler(model, sched, st, plan_cli, sg)
    reroute(sg, ws, model, sched, st, plan_cli, args.nasa_dir)
    validate()
    for f in sorted(os.listdir(OUT)):
        print(f"  {f:16s} {os.path.getsize(os.path.join(OUT, f)) / 1e3:8.1f} KB")


if __name__ == "__main__":
    main()
