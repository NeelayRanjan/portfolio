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
