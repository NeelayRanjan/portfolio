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
