"""Imports the owner's SLAAC modules from the private NASA directory BY PATH.
Nothing here copies their source. See the spec's permissions section."""
import importlib, os, sys

# The owner's directory stays read-only: importing a module from it would otherwise
# write a __pycache__/*.pyc beside their source. Set before any owner import.
sys.dont_write_bytecode = True

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


def snap_table(ws, nasa_dir=DEFAULT):
    """The vor3 snap table, built exactly as plan_cli.build's --snap-table vor3 does:
    VOR+WAYPOINT fixes, no digit names, no VP prefix, then names of exactly 3 letters."""
    import numpy as np
    _, gen = paths(nasa_dir)
    wpdb = ws.load_waypoints(os.path.join(gen, "wyp345plus.txt"), fix_types={"VOR", "WAYPOINT"},
                             exclude_digit_names=True, exclude_prefixes=("VP",))
    m3 = np.array([len(str(n)) == 3 and str(n).isalpha() for n in wpdb.names])
    i3 = np.where(m3)[0]
    return ws.WaypointDB(wpdb.names[i3], wpdb.lat[i3], wpdb.lon[i3])
