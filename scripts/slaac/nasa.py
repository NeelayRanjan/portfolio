"""Imports the owner's SLAAC modules from the private NASA directory BY PATH.
Nothing here copies their source. See the spec's permissions section."""
import importlib, os, sys

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
