"""Hand-run. ~/.venvs/slaac/bin/python scripts/slaac/prepare_nav.py [--nasa-dir DIR]

Writes public/slaac/{navaids,us-outline,airports}.json from the owner's nav data,
imported BY PATH through nasa.py (nothing of theirs is copied):
  navaids.json     the vor3 snap table, built by nasa.snap_table (= plan_cli.build's).
  us-outline.json  viz_common._US_OUTLINE_B64 decoded (float32 lon,lat pairs; NaN -> null).
  airports.json    airports for scripts/slaac/pairs.json (Task 9); skipped if absent.
"""
import argparse, base64, json, os, re, sys, zlib
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import nasa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "public/slaac")
BOX = (17.0, 50.0, -130.0, -60.0)  # lat0, lat1, lon0, lon1


def dms(s):
    m = re.fullmatch(r"([NSEW])(\d+) (\d+) ([\d.]+)", s.strip())
    h, d, mi, se = m.groups()
    v = int(d) + int(mi) / 60 + float(se) / 3600
    return -v if h in "SW" else v


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    with open(p, "w") as f:
        json.dump(obj, f, allow_nan=False, separators=(",", ":"))
    print(f"wrote {p} ({os.path.getsize(p)} bytes)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nasa-dir", default=nasa.DEFAULT)
    a = ap.parse_args()
    *_, sg, ws, plan_cli = nasa.load(a.nasa_dir)
    import viz_common  # already on sys.path via nasa.load

    # navaids
    w3 = nasa.snap_table(ws, a.nasa_dir)
    lat0, lat1, lon0, lon1 = BOX
    keep = [i for i in range(len(w3.names))
            if lat0 <= w3.lat[i] <= lat1 and lon0 <= w3.lon[i] <= lon1]
    names = [str(w3.names[i]) for i in keep]
    write("navaids.json", {
        "version": 1, "source": "wyp345plus.txt (owner's nav DB)",
        "filter": "VOR+WAYPOINT, no digit names, no VP prefix, 3-letter alpha, box 17-50N -130..-60E",
        "names": names,
        "lat": [float(w3.lat[i]) for i in keep],
        "lon": [float(w3.lon[i]) for i in keep]})
    print(f"navaids: {len(names)} of {len(w3.names)} in table")

    # outline
    arr = np.frombuffer(zlib.decompress(base64.b64decode(viz_common._US_OUTLINE_B64)),
                        dtype=np.float32).reshape(-1, 2)
    pts = [None if not np.isfinite(r).all() else [round(float(r[0]), 4), round(float(r[1]), 4)] for r in arr]
    write("us-outline.json", {"version": 1, "lonlat": pts})
    print(f"outline: {len(pts)} points, {sum(p is None for p in pts)} breaks")

    # airports
    pairs_path = os.path.join(os.path.dirname(__file__), "pairs.json")
    if not os.path.exists(pairs_path):
        print("airports.json SKIPPED: scripts/slaac/pairs.json not present yet (Task 9); re-run then")
        return
    pairs = json.load(open(pairs_path))
    want = set()
    for p in pairs.get("pairs", pairs):
        want.update(p[:2] if isinstance(p, list) else [p["origin"], p["dest"]])
    _, gen = nasa.paths(a.nasa_dir)
    found = {}
    for line in open(os.path.join(gen, "airports.txt")):
        c = line.rstrip("\n").split("\t")
        if len(c) >= 7 and c[1] in want and c[1] not in found:
            found[c[1]] = {"name": c[0].replace("_", " "), "lat": round(dms(c[5]), 5), "lon": round(dms(c[6]), 5)}
    missing = sorted(want - set(found))
    if missing:
        sys.exit(f"airports not in airports.txt: {missing}")
    write("airports.json", {"version": 1, "airports": dict(sorted(found.items()))})


if __name__ == "__main__":
    main()
