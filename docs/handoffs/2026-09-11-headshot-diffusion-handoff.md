# Handoff: headshot diffusion toy for neelayranjan.dev

You are building a tiny, deliberately-overfit, class-conditional diffusion model of
Neelay's own headshots, to run client-side on his portfolio site. The site is being
redesigned; its bio section will show his photo, and the toy is: the photo is not an
`<img>`, it is his own diffusion model denoising his face from noise, with a row of
buttons (one per source photo) that re-generates the chosen one live in the browser.
He is a diffusion researcher; the joke is that even the headshot is sampled.

Everything on this site is real. No faking: if the model file is absent the site
falls back to a plain photo, so a half-finished artifact is fine to hand over, but a
canned animation pretending to be the model is not.

## What to train

- **Data:** K headshot photos of Neelay (he will supply them; K is whatever he gives
  you, expect 3–8). Center-crop square, identical framing across all K as far as the
  photos allow. Augment lightly (small crops/flips are fine; nothing that changes
  identity).
- **Overfitting is the point.** The model should near-memorize the K photos. One-hot
  conditioning on photo index; each button on the site reproduces one specific photo.
  This is the safety property too: outputs stay faces he approved, never a novel
  hallucinated face.
- **Objective: predict x0 directly** (the clean image), not epsilon. This matches his
  research brand (x0 / flipped-objective diffusion) and lets the site show the
  x̂₀-during-sampling view it already uses for its other diffusion demos.
- **Resolution:** 96x96 or 128x128 RGB, your call by budget. It displays at roughly
  256–320 px, upscaled; softness reads as aesthetic here, mush does not.
- **Size budget:** UNet around 1–3M params. **The exported ONNX must be ≤ 6 MB fp32**
  (int8 also welcome as a second file if it quantizes cleanly). The site already
  ships onnxruntime-web for two other models, so the marginal cost is just this file.
- **Sampling:** cosine or linear schedule, trained at whatever T you like, sampled
  DDIM-style at ~16–32 steps. Each step is one forward pass; in browser WASM a model
  this size runs a step in low tens of ms, so ~25 steps ≈ a 1–2 s animation, which is
  the desired feel. No CFG, no null class — it is always conditioned.

## What to deliver

1. **`headshot.onnx`** — opset 17, static shapes, fp32, standard ops only (it runs on
   `onnxruntime-web` **1.27**, WASM EP; avoid anything exotic).
   - inputs: `x` `[1,3,R,R]` float32 (the current x_t, in [-1,1]);
     `t` `[1]` float32 or int64 (timestep); `c` `[1,K]` float32 one-hot.
   - output: `x0` `[1,3,R,R]` float32 in [-1,1] (clamping site-side is fine, say which).
2. **`headshot_meta.json`** — everything the sampler needs, read from file, never
   hardcoded site-side: `{ "version": 1, "res": R, "channels": 3, "k": K,
   "schedule": { "type": "cosine", "T": ... }, "steps_default": 25,
   "t_input": "float32" | "int64", "output_clamp": true|false }`.
3. **A vendored JS sampler module**, ESM, no dependencies except an injected ORT
   session — mirroring the contract of the site's existing `lib/ascii-diffusion.js`:
   - `generate({ session, meta, classIdx, steps, onFrame })` runs the reverse process
     and calls `onFrame({ xt, x0, step, total })` with Float32Arrays after every step.
   - **After each frame, yield to the event loop** (`await new Promise(r =>
     setTimeout(r, 0))`) so the page never locks. The computation is the animation;
     the site renders inside `onFrame`.
   - The site will NOT reimplement the sampler (house rule: never reimplement vendored
     model math — a subtly wrong schedule produces plausible garbage that reads as
     "the model is bad"). Whatever math sampling needs must live in this module.
4. **Validation vectors** — the site pins vendored modules against a PyTorch
   reference. Ship: a fixed initial noise tensor (seed noted), a class index, a step
   count, and the expected final x0 (npz or JSON). State the tolerance you achieve
   between PyTorch and ONNX (the existing draw-digit module is pinned at max|Δ| ≈ 8e-6;
   anything ≤ 1e-3 is acceptable here).
5. **The K source photos** at the exact training crop, as PNG or WebP — the site uses
   them as the button faces and as the no-JS / model-absent fallback.
6. **A short README**: training config, epochs, final per-photo reconstruction quality,
   anything you'd warn an integrator about.

## Non-goals

- No novel face generation, no interpolation between photos, no CFG, no text
  conditioning, no server anything. K buttons, K reconstructions, streamed live.
- Don't build UI. The site owns canvas, buttons, fallback, and copy.

## Open choices you should make and just document

- Exact R, K handling if photos have mixed quality, schedule type, step default.
- Whether t is embedded sinusoidally or learned — invisible to the integrator as long
  as it's inside the ONNX graph and the JS module passes the right `t` values.
