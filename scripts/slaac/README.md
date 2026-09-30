# SLAAC rerouter generators

Hand-run, never wired to prebuild. Outputs are committed.

## Env

```bash
uv venv ~/.venvs/slaac --python 3.12
uv pip install --python ~/.venvs/slaac/bin/python torch==2.13.0 diffusers==0.38.0 onnx onnxruntime==1.27.0 numpy scipy pandas matplotlib tqdm
~/.venvs/slaac/bin/python -c "import torch,diffusers,onnxruntime;print(torch.__version__,diffusers.__version__,onnxruntime.__version__,torch.cuda.is_available())"
```

## Permissions

NASA dir (`NASA=/home/neelayranjan/_SAVE/NASA/NeelayRanjan_Summer2026_Codebase`): read by path only. **Never** copy into this repo or `public/`: `SUA_all`, `TRX_*` files, anything under `out/`, `route_db.json`, `route_ranked.json`, any `.py` source. Publishable outputs: the ONNX weights, derived navaid/airport subsets, airways data, LM-generated routes.

`nasa.py` imports the owner's modules by path; it copies nothing.

## Generator order

Run each with `~/.venvs/slaac/bin/python`:

1. `scripts/slaac/export_model.py` (ONNX + `public/slaac/meta.json`)
2. `scripts/slaac/make_vectors.py`
3. `scripts/slaac/prepare_nav.py`
4. `scripts/slaac/prepare_launch_sua.py`
5. `scripts/slaac/route_library.py`
6. `scripts/slaac/gate.py`

Steps 2-6 are added by later tasks; their flags are documented in each script's header.
