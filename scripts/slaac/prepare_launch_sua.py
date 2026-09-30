"""Hand-run. python3 scripts/slaac/prepare_launch_sua.py   (stdlib only)

Writes public/slaac/launch-sua.json from PUBLIC FAA sources only (never SUA_all):
  - the FAA AIS Special_Use_Airspace ArcGIS layer, fetched ONCE (paginated) and cached
    to scripts/slaac/.cache/faa_sua.geojson; its SHA-256 is printed. The server
    rate-limits (HTTP 429), so delete the cache deliberately to refetch.
  - two past launch TFRs from tfr.faa.gov (XML cached beside it).
Designators and sites come from scripts/slaac/launch-sua-sources.json. A designator
can be several layer rows (altitude bands, exclusions); each row's outer ring is kept
as its own polygon (the pipeline treats polygons independently, no union is computed).
Rings are clipped to the model domain box (lat 24-50, lon -126..-66) by
Sutherland-Hodgman and marked clipped:true when that changed them.
"""
import hashlib, json, os, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))
CACHE = os.path.join(HERE, ".cache")
SRC = json.load(open(os.path.join(HERE, "launch-sua-sources.json")))
LAYER = SRC["layer"]
CYCLE = "2026-09-03..2026-10-29"  # FAA AIS cycle 0901Z 03 Sep 2026 - 0901Z 29 Oct 2026 (research report)
LAT0, LAT1, LON0, LON1 = 24.0, 50.0, -126.0, -66.0


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 portfolio-slaac"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:
            print("GET failed", e, file=sys.stderr)
            time.sleep(30 * (i + 1))
    raise SystemExit(f"could not fetch {url}")


def cached(name, url):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        open(p, "wb").write(get(url))
    return open(p, "rb").read()


def faa_layer():
    p = os.path.join(CACHE, "faa_sua.geojson")
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        feats, off = [], 0
        while True:
            q = urllib.parse.urlencode({"where": "1=1", "outFields": "NAME,TYPE_CODE", "f": "geojson",
                                        "resultOffset": off, "resultRecordCount": 1000,
                                        "orderByFields": "OBJECTID"})
            page = json.loads(get(f"{LAYER}/query?{q}"))
            feats += page["features"]
            if not (page.get("exceededTransferLimit") or page.get("properties", {}).get("exceededTransferLimit")):
                break
            off += len(page["features"])
        json.dump({"type": "FeatureCollection", "features": feats}, open(p, "w"), separators=(",", ":"))
    raw = open(p, "rb").read()
    print("FAA layer:", p, len(raw), "bytes, sha256", hashlib.sha256(raw).hexdigest())
    return json.loads(raw)


def clip(ring, box=(LAT0, LAT1, LON0, LON1)):
    """Sutherland-Hodgman over the four box edges; ring is [(lat, lon)]."""
    lat0, lat1, lon0, lon1 = box
    edges = [(0, lat0, True), (0, lat1, False), (1, lon0, True), (1, lon1, False)]  # axis, value, keep >=
    out = ring
    for ax, v, ge in edges:
        inp, out = out, []
        if not inp:
            break
        ins = (lambda p: p[ax] >= v) if ge else (lambda p: p[ax] <= v)
        for i, cur in enumerate(inp):
            prev = inp[i - 1]
            if ins(cur) != ins(prev):
                t = (v - prev[ax]) / (cur[ax] - prev[ax])
                x = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]
                x[ax] = v
                out.append((x[0], x[1]))
            if ins(cur):
                out.append(cur)
    return out


def finish(ring):
    """Clip, drop a closing duplicate, round to 5 dp. Returns (ring, clipped)."""
    if ring[0] == ring[-1]:
        ring = ring[:-1]
    c = clip(ring)
    clipped = len(c) != len(ring) or any(a != b for a, b in zip(c, ring)) if c else True
    c = [(round(a, 5), round(b, 5)) for a, b in c]
    return [list(p) for p in c], clipped


def tfr_ring(xml_bytes):
    root = ET.fromstring(xml_bytes.decode("utf-8-sig"))
    abds = [a for a in root.iter("Abd")]
    assert len(abds) == 1, len(abds)
    def val(s, neg):
        h = s[-1]; v = float(s[:-1])
        return -v if h in "SW" else v
    return [(val(a.find("geoLat").text, 0), val(a.find("geoLong").text, 0)) for a in abds[0].iter("Avx")]


def main():
    feats = faa_layer()["features"]
    by = {}
    for f in feats:
        by.setdefault(f["properties"]["NAME"], []).append(f)
    sites = []
    for s in SRC["sites"]:
        polys = []
        if s["kind"] == "charted":
            for d in s["designators"]:
                rows = by.get(d)
                if not rows:
                    raise SystemExit(f"{d} not in FAA layer")
                for r in rows:
                    g = r["geometry"]
                    outer = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
                    for o in outer:
                        ring, clipped = finish([(la, lo) for lo, la in o])
                        if len(ring) >= 3:
                            polys.append({"designator": d, "ring": ring, "source": LAYER, "clipped": clipped})
        else:
            xml = cached(os.path.basename(s["xml"]), s["xml"])
            ring, clipped = finish(tfr_ring(xml))
            polys.append({"designator": s["designators"][0], "ring": ring, "source": s["xml"], "clipped": clipped})
        site = {"id": s["id"], "name": s["name"], "kind": s["kind"], "polys": polys, "basis": s["basis"]}
        if "label" in s:
            site["label"] = s["label"]
        sites.append(site)
        nclip = sum(p["clipped"] for p in polys)
        print(f"{s['id']:18s} {len(polys):2d} polys, {sum(len(p['ring']) for p in polys):4d} vertices, {nclip} clipped:",
              [p["designator"] for p in polys if p["clipped"]])
    out = {"version": 1, "cycle": CYCLE, "sites": sites}
    p = os.path.join(ROOT, "public/slaac/launch-sua.json")
    json.dump(out, open(p, "w"), separators=(",", ":"), allow_nan=False)
    print("wrote", p, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
