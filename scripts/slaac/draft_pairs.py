"""Draft the demo's public-hub list and origin-destination pairs.

Hand-run:  ~/.venvs/slaac/bin/python scripts/slaac/draft_pairs.py [--refresh-hubs]

hubs.json: the FAA's public "Passenger Boarding (Enplanement) and All-Cargo Data
for U.S. Airports", Commercial Service Airports ranking (CY2025). Top 30 lower-48
by rank, kept only if the airport has an <AP:..> token in the route LM's vocab and a
row in airports.txt. Never ranked from the owner's flights/TRX data.
--refresh-hubs re-downloads the xlsx (stdlib parse, no openpyxl) and rewrites hubs.json.

pairs.json: 48 pairs, >=24 whose great-circle chord passes within 150 nm of a launch
site polygon (public/slaac/launch-sua.json). Status stays "draft" until the owner signs off.
"""
import datetime, itertools, json, math, os, random, re, sys, urllib.request, zipfile, io
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import nasa

SRC_URL = ("https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/"
           "passenger/arp-cy2025-commercial-service-enplanements.xlsx")
YEAR = 2025
N_HUBS, N_PAIRS, N_NEAR, NEAR_NM = 30, 48, 26, 150.0
MIN_GC, MAX_PER_HUB, SEED = 250.0, 7, 2026
NOT_LOWER48 = {"AK", "HI", "PR", "VI", "GU", "AS", "MP"}
R_NM = 3440.065


def read_xlsx(raw):
    z = zipfile.ZipFile(io.BytesIO(raw))
    ss = re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)
    ss = [re.sub(r"&amp;", "&", "".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S))) for s in ss]
    out = []
    for r in re.findall(r"<row [^>]*>(.*?)</row>", z.read("xl/worksheets/sheet1.xml").decode(), re.S):
        row = {}
        for c, a, b in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', r, re.S):
            v = re.search(r"<v>(.*?)</v>", b or "")
            v = v.group(1) if v else ""
            row[c] = ss[int(v)] if 't="s"' in a and v else v
        out.append(row)
    return out


def load_airports(path):
    d = {}
    for line in open(path, encoding="latin-1"):
        p = line.rstrip("\n").split("\t")
        if len(p) < 7:
            continue
        def dms(s):
            h, dd, m, sec = s[0], *map(float, s[1:].split())
            v = dd + m / 60 + sec / 3600
            return -v if h in "SW" else v
        try:
            d[p[1]] = (p[0], dms(p[-2]), dms(p[-1]))
        except Exception:
            pass
    return d


def build_hubs(airports, vocab):
    raw = urllib.request.urlopen(urllib.request.Request(SRC_URL, headers={"User-Agent": "Mozilla/5.0"})).read()
    rows = read_xlsx(raw)
    hubs, dropped = [], []
    for r in rows[1:]:
        if not r.get("A", "").isdigit() or r.get("C") in NOT_LOWER48:
            continue
        lid = r["D"]; icao = "K" + lid
        if icao not in vocab:
            dropped.append((icao, "no <AP:> token in LM vocab"))
        elif icao not in airports:
            dropped.append((icao, "not in airports.txt"))
        else:
            hubs.append({"icao": icao, "faa_lid": lid, "rank": int(r["A"]), "name": r["F"], "city": r["E"], "state": r["C"]})
        if len(hubs) == N_HUBS:
            break
    doc = {"source_url": SRC_URL, "year": YEAR, "retrieved": datetime.date.today().isoformat(),
           "hubs": hubs}
    for d in dropped:
        print("dropped hub", d)
    return doc


def gc_nm(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R_NM * math.asin(math.sqrt(h))


def chord(a, b, n=200):
    p = [np.array([math.cos(math.radians(x[0])) * math.cos(math.radians(x[1])),
                   math.cos(math.radians(x[0])) * math.sin(math.radians(x[1])),
                   math.sin(math.radians(x[0]))]) for x in (a, b)]
    om = math.acos(max(-1, min(1, float(p[0] @ p[1]))))
    pts = []
    for t in np.linspace(0, 1, n):
        v = (math.sin((1 - t) * om) * p[0] + math.sin(t * om) * p[1]) / math.sin(om)
        pts.append((math.degrees(math.asin(v[2])), math.degrees(math.atan2(v[1], v[0]))))
    return np.array(pts)


def aeqd(pts, lat0, lon0):
    la, lo = np.radians(pts[:, 0]), np.radians(pts[:, 1])
    l0, o0 = math.radians(lat0), math.radians(lon0)
    c = np.arccos(np.clip(math.sin(l0) * np.sin(la) + math.cos(l0) * np.cos(la) * np.cos(lo - o0), -1, 1))
    k = np.where(c < 1e-9, 1.0, c / np.sin(np.maximum(c, 1e-9)))
    x = R_NM * k * np.cos(la) * np.sin(lo - o0)
    y = R_NM * k * (math.cos(l0) * np.sin(la) - math.sin(l0) * np.cos(la) * np.cos(lo - o0))
    return np.stack([x, y], 1)


def seg_dist(P, A, B):
    """distance from each point in P to each segment A[i]-B[i]; returns min over all."""
    AB = B - A
    L2 = np.maximum((AB ** 2).sum(1), 1e-12)
    t = np.clip(((P[:, None, :] - A[None]) * AB[None]).sum(2) / L2[None], 0, 1)
    proj = A[None] + t[..., None] * AB[None]
    return np.sqrt(((P[:, None, :] - proj) ** 2).sum(2)).min()


def inside(pt, ring):
    x, y = pt; c = False
    for (x1, y1), (x2, y2) in zip(ring, np.roll(ring, -1, 0)):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def nearest_site(ch, sites):
    best = (1e9, None)
    for s in sites:
        for poly in s["polys"]:
            ring = np.array(poly["ring"], float)
            lat0, lon0 = ring[:, 0].mean(), ring[:, 1].mean()
            R = aeqd(ring, lat0, lon0); C = aeqd(ch, lat0, lon0)
            d = min(seg_dist(C, R, np.roll(R, -1, 0)),
                    seg_dist(R, C[:-1], C[1:]))
            if any(inside(c, R) for c in C[::4]):
                d = 0.0
            if d < best[0]:
                best = (d, s["id"])
    return best[1], best[0]


def main():
    hubs_path = os.path.join(HERE, "hubs.json")
    _, gen = nasa.paths()
    airports = load_airports(os.path.join(gen, "airports.txt"))
    if "--refresh-hubs" in sys.argv or not os.path.exists(hubs_path):
        import torch
        vocab = set(t[4:-1] for t in torch.load(os.path.join(gen, "route_lm_best.pt"), map_location="cpu",
                                                weights_only=False)["itos"] if t.startswith("<AP:"))
        doc = build_hubs(airports, vocab)
        json.dump(doc, open(hubs_path, "w"), indent=1)
    hubs = json.load(open(hubs_path))["hubs"]
    sites = json.load(open(os.path.join(ROOT, "public/slaac/launch-sua.json")))["sites"]
    pos = {h["icao"]: airports[h["icao"]][1:] for h in hubs}
    cand = []
    for a, b in itertools.combinations(pos, 2):
        g = gc_nm(pos[a], pos[b])
        if g < MIN_GC:
            continue
        site, d = nearest_site(chord(pos[a], pos[b]), sites)
        cand.append({"a": a, "b": b, "gc_nm": round(g), "nearest_site": site, "nearest_site_nm": round(d)})
    rng = random.Random(SEED)
    near = [c for c in cand if c["nearest_site_nm"] <= NEAR_NM]
    far = [c for c in cand if c["nearest_site_nm"] > NEAR_NM]
    count = {h: 0 for h in pos}
    chosen = []

    def take(pool, n, key):
        pool = sorted(pool, key=key)
        for c in pool:
            if len([x for x in chosen if x in pool]) >= n:
                break
            if count[c["a"]] < MAX_PER_HUB and count[c["b"]] < MAX_PER_HUB and c not in chosen:
                chosen.append(c); count[c["a"]] += 1; count[c["b"]] += 1
    # near: round-robin over sites so no launch site dominates, least-used hubs first
    bysite = {}
    for c in near:
        bysite.setdefault(c["nearest_site"], []).append(c)
    for v in bysite.values():
        rng.shuffle(v)
    nchosen = 0
    while nchosen < N_NEAR and any(bysite.values()):
        for s in sorted(bysite):
            v = sorted(bysite[s], key=lambda c: count[c["a"]] + count[c["b"]])
            while v:
                c = v.pop(0)
                if count[c["a"]] < MAX_PER_HUB and count[c["b"]] < MAX_PER_HUB:
                    chosen.append(c); count[c["a"]] += 1; count[c["b"]] += 1; nchosen += 1
                    break
            bysite[s] = v
            if nchosen >= N_NEAR:
                break
    rng.shuffle(far)
    far.sort(key=lambda c: count[c["a"]] + count[c["b"]])
    for c in far:
        if len(chosen) >= N_PAIRS:
            break
        if count[c["a"]] < MAX_PER_HUB and count[c["b"]] < MAX_PER_HUB:
            chosen.append(c); count[c["a"]] += 1; count[c["b"]] += 1
    pairs = []
    for c in chosen:
        o, d = (c["a"], c["b"]) if rng.random() < 0.5 else (c["b"], c["a"])
        pairs.append({"origin": o, "dest": d, "gc_nm": c["gc_nm"], "nearest_site": c["nearest_site"],
                      "nearest_site_nm": c["nearest_site_nm"]})
    pairs.sort(key=lambda p: (p["nearest_site_nm"], p["origin"], p["dest"]))
    assert len(pairs) == N_PAIRS and sum(p["nearest_site_nm"] <= NEAR_NM for p in pairs) >= 24, len(pairs)
    json.dump({"status": "draft — awaiting owner approval",
               "context_note": "Hubs are the top lower-48 airports by FAA CY2025 enplanements (hubs.json). "
                               "Pairs are chosen by great-circle chord proximity to launch-site polygons, not from any traffic data.",
               "pairs": pairs}, open(os.path.join(HERE, "pairs.json"), "w"), indent=1)
    print(len(pairs), "pairs;", sum(p["nearest_site_nm"] <= NEAR_NM for p in pairs), "within", NEAR_NM, "nm")
    for p in pairs:
        print(f'{p["origin"]}->{p["dest"]} {p["gc_nm"]:5d}nm  {p["nearest_site"]:18s}{p["nearest_site_nm"]:5d}nm')
    print("hub use:", dict(sorted(count.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()
