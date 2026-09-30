"""Hand-run: ~/.venvs/slaac/bin/python scripts/slaac/route_library.py [--device cuda]

Builds public/slaac/routes.json: for each approved pair in scripts/slaac/pairs.json,
8 routes from the owner's flight-plan LM (route_lm_best.pt), geocoded with gen_trx_sua's
own functions. Everything of the owner's is imported BY PATH (nasa.py pattern), nothing
is copied. LM output is used as generated: sampled, geocoded, filtered, never edited
beyond gen_trx_sua's own endpoints-anchor step (which prepends/appends the airport).

Per pair: seed = pair_index (+ attempt), 8 prefix rows, generate_batch(temp 0.8, top_k 40,
max_new 60). Filters: geocode failure, route_max_leg_nm > 1000, endpoint (first/last fix
must be the origin/destination after anchoring; anchoring refused beyond 300 nm, the owner's
--max-anchor-nm default). < 5 survivors: retry with the next seed, up to 3 retries, then the
pair is dropped and reported.
"""
import argparse, importlib, json, os, sys, time, types
sys.path.insert(0, os.path.dirname(__file__))
import nasa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
N_ROUTES, MIN_OK, RETRIES, MAX_LEG, MAX_ANCHOR = 8, 5, 3, 1000.0, 300.0
TEMP, TOPK, MAX_NEW = 0.8, 40, 60
CTX_LONG = {"actype": "B738", "fl": 350, "month": 9, "dow": 2, "hour": 14}
CTX_SHORT = {"actype": "E75L", "fl": 300, "month": 9, "dow": 2, "hour": 14}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nasa-dir", default=nasa.DEFAULT)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--out", default=os.path.join(ROOT, "public/slaac/routes.json"))
    a = ap.parse_args()
    import torch
    t0 = time.time()
    _, gen = nasa.paths(a.nasa_dir)
    for d in (gen, a.nasa_dir, nasa.paths(a.nasa_dir)[0]):
        if d not in sys.path:
            sys.path.insert(0, d)
    route_lm = importlib.import_module("route_lm")
    gts = importlib.import_module("gen_trx_sua")
    dev = a.device if (a.device != "cuda" or torch.cuda.is_available()) else "cpu"
    lm_path = os.path.join(gen, "route_lm_best.pt")
    model, vocab = route_lm.load_route_lm(lm_path, device="cpu")
    model = model.to(dev).eval()     # fp32
    params = sum(p.numel() for p in model.parameters())
    print(f"LM loaded on {dev} fp32, {params:,} params, {time.time()-t0:.0f}s")

    args = types.SimpleNamespace(fixes=os.path.join(gen, "wyp345plus.txt"), navdb=[os.path.join(gen, "wyp345plus.txt")],
                                 airports=os.path.join(gen, "airports.txt"))
    index = gts.build_coord_index(args)

    pairs = json.load(open(os.path.join(os.path.dirname(__file__), "pairs.json")))["pairs"]
    out_pairs, dropped_pairs = [], []
    drops = {"geocode": 0, "max_leg": 0, "endpoint": 0}
    for pi, p in enumerate(pairs):
        o, d = p["origin"], p["dest"]
        ctx = CTX_SHORT if p["gc_nm"] < 400 else CTX_LONG
        for attempt in range(RETRIES + 1):
            seed = pi + attempt * 1000 if attempt else pi
            torch.manual_seed(seed)
            rows = [dict(origin=o, dest=d, **ctx) for _ in range(N_ROUTES)]
            with torch.no_grad():
                toks_all = route_lm.generate_batch(model, vocab, rows, temperature=TEMP, top_k=TOPK,
                                                   max_new=MAX_NEW, device=dev, progress=False)
            ok, dd = [], {"geocode": 0, "max_leg": 0, "endpoint": 0}
            for toks in toks_all:
                fixes, head, tail = gts.geocode_tokens(toks, index)
                if fixes is None:
                    dd["geocode"] += 1; continue
                good = True
                if fixes[0][0] != o:                      # anchor the origin
                    ap_ = gts.resolve_airport(o, index)
                    if ap_ and gts._hav_nm(ap_[1], ap_[2], fixes[0][1], fixes[0][2]) <= MAX_ANCHOR:
                        fixes = [ap_] + fixes
                    else:
                        good = False
                if good and fixes[-1][0] != d:            # anchor the destination
                    ap_ = gts.resolve_airport(d, index)
                    if ap_ and gts._hav_nm(ap_[1], ap_[2], fixes[-1][1], fixes[-1][2]) <= MAX_ANCHOR:
                        fixes = fixes + [ap_]
                    else:
                        good = False
                if not good:
                    dd["endpoint"] += 1; continue
                ml = gts.route_max_leg_nm(fixes)
                if ml > MAX_LEG:
                    dd["max_leg"] += 1; continue
                ok.append({"seed": seed, "tokens": toks,
                           "fixes": [[str(n), round(float(la), 4), round(float(lo), 4)] for n, la, lo in fixes],
                           "max_leg_nm": round(float(ml), 1)})
            for k in drops:
                drops[k] += dd[k]
            print(f"{pi:2d} {o}->{d} seed {seed} ok {len(ok)}/{N_ROUTES} drops {dd}")
            if len(ok) >= MIN_OK:
                out_pairs.append({"origin": o, "dest": d, "routes": ok})
                break
        else:
            dropped_pairs.append(f"{o}-{d}")
            print(f"DROPPED PAIR {o}->{d}: {len(ok)} survivors after {RETRIES+1} attempts")
    doc = {"version": 1,
           "lm": {"file": "route_lm_best.pt", "params": params, "temperature": TEMP, "top_k": TOPK, "max_new": MAX_NEW},
           "context": CTX_LONG | {"short_pair_override": CTX_SHORT},
           "pairs": out_pairs, "dropped": drops | {"pairs": dropped_pairs}}
    with open(a.out, "w") as f:
        json.dump(doc, f, allow_nan=False, separators=(",", ":"))
    print(f"wrote {a.out}: {len(out_pairs)} pairs, {os.path.getsize(a.out)/1024:.0f} KB, drops {drops}, dropped pairs {dropped_pairs}, {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
