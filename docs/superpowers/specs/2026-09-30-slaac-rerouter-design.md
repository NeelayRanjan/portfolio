# SLAAC rerouter: a live Figure 3 — design

Status: BUILT on `slaac-demo` (plan Tasks 1-15, 2026-09-30/10-01; see sections 13
and 14), preview pending (Task 16). Originally a DRAFT for owner review, 2026-09-30. Branch `slaac-demo` (worktree
`../portfolio-slaac`). **Preview only**: nothing here merges to `main` or
reaches neelayranjan.dev until the owner says their NASA mentor approved the
preview link.

## 1. Goal

Replace Figure 3 (the looping video of the flight-plan LM's synthesized day)
with a live, in-browser demo of the SLAAC hazard-aware rerouter: the visitor
picks an origin and destination, sees a handful of routes the owner's
flight-plan LM filed for that pair, draws an airspace (or turns on every US
launch site at once), and watches the owner's diffusion model reroute those
flights around it, live, with the numbers that matter printed per flight.

Success means:
- The model math in the browser is the owner's model, ported exactly and pinned
  against the Python pipeline, never a lookalike (Constitution: never fake a
  model's output, never reimplement vendored math without reference vectors).
- A reroute's emitted plan crosses no airspace (legs crossing = 0) at the rate
  the Python pipeline achieves on the same inputs.
- Nothing model-sized loads before the visitor presses reroute; a phone can run
  it (measured, not assumed).
- The mentor can open a private preview link and approve it.

Audience: admissions committees and recruiters (site-wide), plus, for this
round, the owner's NASA mentor as the approver.

## 2. Owner rulings this design rests on (2026-09-30)

- **Permissions** (memory `nasa-codebase-permissions`): publishable are the
  trained weights, the nav DB (`wyp345plus.txt`), `airports.txt`, `airways.txt`,
  and code where it has to ship to the browser. **Never** published: `SUA_all`,
  the real TRX days, anything under `out/`, `route_db.json`/`route_ranked.json`
  (skipped by ruling). The Python codebase itself stays private (owner commits it
  to private `NeelayRanjan/SAVE`); the site never links it.
- **What is live**: the diffusion rerouter (5.78M params). The route LM (222M
  params, 890 MB fp32) is **precomputed**: its routes are generated offline and
  shipped as data. Distilling the LM into something browser-sized is later work
  (section 11).
- **Airspace input**: a drawn polygon, plus an "all launch sites" preset built
  from public FAA data (section 5). White Sands and Mojave are dropped; Blue
  Origin's Van Horn site is added.
- **Snapped vs continuous**: ship the snapped named-fix plan only if it holds up
  (the gate in section 7); otherwise ship the continuous path and bring the owner
  the list of problems. The owner allows changing the codebase to fix them.
- **Controls**: margin (nm) and the policy toggle, named as on the SLAAC poster:
  "1-waypoint lookahead" (`hug=1`) and "infinite lookahead" (`hug=0`, wide
  berth). Both change real output.
- **Headline numbers** come from the SLAAC poster (longer experiments the owner
  may not share; the figures are theirs to quote): clears the 25 nm buffer 98%
  (1-waypoint) / 99% (infinite); median added distance +23 nm (3.4%) / +10 nm
  (1.1%); within 2.3% / 1.2% of the geometric optimum. The rail cites the poster,
  as the SLAAC note already does. The demo's own per-flight numbers are computed
  live and never presented as the poster's.
- **Figure 3's video moves to `/lab`** as Figure S3 (the slot S3's cut
  illustration left), unchanged.
- **NASA box copy is SLAAC-first**, with one or two lines for SHIFT (the fall
  role) under it; the Experience row follows the new resume (two roles).
- **Disclaimer**: the owner's intent ("an approximation of real models
  integrated into NASA ATC simulation software, used to evaluate future ATM
  strategies"), reworded in site voice once the real differences are measured
  (section 8). Owner will wordsmith later.
- **Sidebar data note**: data sources were re-sourced from public data where
  possible, with some loss of quality.

## 3. What the Python pipeline does (the thing being ported)

From `flight_path_generation/Hazard-Aware Generative Flight Planning/`
(`plan_cli.py`, `sua_guidance.py`, `viz_common.py`, `waypoint_snap.py`):

1. A filed route (here: an LM route, geocoded) is a list of named fixes.
2. `local_reroute` finds the affected stretch (legs crossing or within the
   margin of any polygon), picks entry and rejoin anchors (hug: the filed fixes
   bracketing the box, walked outward until clear; wide: the first fixes beyond
   `reroute_dist_nm`), and asks the sampler for an arc between them.
3. `sample_paths`: `FlightDiffusion` (a diffusers `UNet1DModel`, 7 channels x
   256 points, conditioned on OD, endpoint headings, 6 self-conditioning
   channels and an aircraft-type embedding), v-prediction, CFG at guidance 2.0,
   `DPMSolverMultistepScheduler` (1000 train steps, `squaredcos_cap_v2`,
   `rescale_betas_zero_snr`, `trailing` spacing), 40 steps by default. Each step
   reconstructs x0, pushes it out of every polygon with `sua_displacement` (a
   perpendicular bow per inside-run, Gaussian-smoothed, then an iterated margin
   top-up), re-derives a consistent v, and steps the scheduler. After sampling: a
   Gaussian low-pass and a final hard clear.
4. `refine_route_sua` snaps the dense arc to named fixes (3-letter navaids,
   KD-tree), densifies illegal legs, prunes bypassable fixes, and splices the
   deviation into the filed route.
5. Metrics: legs crossing (the one that must be 0), minimum clearance, added nm
   and %.

**Corrected 2026-09-30**: an earlier draft claimed the wide-berth branch of
`local_reroute` had no `return`. It does: the file's last line, `return plan,
roles`, has no trailing newline, and the line-count tools used to read it hid
it. There is no bug; the port calls the owner's function as-is.

**Also to note in the port**: `Sampler.__call__` reseeds with the same seed for
every arc, so every arc in a run starts from identical noise. The port keeps
that per-run behaviour (one seed per reroute press), since it is how the
pipeline behaves.

## 4. Measured feasibility (2026-09-30, this laptop)

| measurement | result |
|---|---|
| UNet exported to ONNX (opset 17, dynamic batch) | 23.4 MB; max abs diff vs torch 3.0e-6 |
| One CFG step (batch 2), native ORT CPU, 4 threads | 16.4 ms |
| Same, onnxruntime-web 1.27 wasm in node, 1 thread | 78.9 ms (3.2 s per 40-step arc) |
| Same, 4 threads | 33.7 ms (1.35 s per 40-step arc) |
| Route LM, torch CPU 4 threads, no KV cache | 120 ms/token; 17-35 tokens a route, 2.4-4.6 s |
| Route LM, RTX 4070 laptop | 55 ms/token |

These are node and native numbers, not browser numbers; the build measures a
real browser before any timing reaches copy. The route LM at int8 would still be
~222 MB, which is why it is precomputed.

## 5. Data (offline, hand-run, outputs committed)

One hand-run generator, `scripts/prepare-slaac.py` (Python; torch and diffusers
from a local venv, never wired to prebuild, same rule as `prepare-research.mjs`),
reads the NASA directory **by path** (`--nasa-dir`) and writes only cleared
material:

| output | contents | est. size |
|---|---|---|
| `public/models/flightdiff-<hash8>.onnx` | the UNet, fp32 (int8 only if measured faster AND parity holds) | 23.4 MB |
| `public/slaac/meta.json` | normalization stats (`xy_mean`, `xy_scale`, `aux_mean/std`, `res_scale`, `dt_*`), `channels`, `num_types`, the scheduler config, the sampler defaults from `plan_cli`, model hash | < 2 KB |
| `public/slaac/routes.json` | the LM route library (below) | est. < 400 KB |
| `public/slaac/navaids.json` | the snap table: 3-letter navaids (`vor3`), lower 48 plus a border margin, name/lat/lon | est. < 150 KB |
| `public/slaac/airports.json` | only the library's airports | < 10 KB |
| `public/slaac/launch-sua.json` | launch airspace (below), each polygon with its source URL and FAA cycle date | est. < 100 KB |
| `public/slaac/us-outline.bin` | the lower-48 outline already embedded in `viz_common` | ~20 KB |
| `scripts/slaac-vectors/*.json` | parity vectors (never in `public/`) | a few MB |

`/models/*` is served `immutable` for a year, so the ONNX file carries a content
hash in its name and the loader reads that name from `meta.json`.

**Route library**: roughly 40-60 origin-destination pairs between major hubs.
The hubs come from a PUBLIC list, the FAA's published passenger-boarding
(enplanement) rankings, lower 48 only (owner, 2026-09-30), never ranked from
`flights.csv`, which is real TRX data. Checked 2026-09-30: the LM's vocabulary
has 2,316 airport tokens and covers every top-40 hub in the lower 48 (only
KHNL, outside the domain, is missing). Display names come from `airports.txt`
(publishable). Pairs are chosen from those hubs so that many pass a launch site
(Florida, California and Virginia routes especially), and the list goes to the
owner before the LM run. For each pair, 8 routes from `route_lm_best.pt` via the owner's own
`generate_batch` (temperature 0.8, top-k 40) under one fixed context per pair
(a common type such as B738 or A320, a typical cruise level, a weekday, midday);
geocoded with the owner's Viterbi `nearest` geocoder from `gen_trx_sua.py`, with
its `max-leg-nm 1000` and `endpoints anchor` rules; broken routes dropped and
counted. Each route records its tokens, resolved fixes, and the generation
settings and seed. The copy says plainly that these routes were written ahead of
time by the LM and the reroute runs live.

**Launch airspace** (from the research report, `launch-sua-sources.md`, and the
FAA AIS open-data layer `Special_Use_Airspace/FeatureServer/0`, public domain,
56-day cycle; pulled once, since it rate-limits):

| site | airspace | basis |
|---|---|---|
| Cape Canaveral / KSC | R-2932, R-2933, R-2934, R-2935, W-497A/B | FAA spaceports page; launch TFR FDC 6/6219 names them |
| Vandenberg | R-2516, R-2517, R-2534A/B, W-532S | FAA spaceports page |
| Wallops / MARS | R-6604A/B (+ W-386 only if the handbook figure confirms the number) | NASA Wallops Range User's Handbook |
| Spaceport America | R-5111A/B (verify the FAA PDF before shipping) | FAA PDF |
| Starbase | Starship Flight 10's launch TFR, FDC 5/3325 | tfr.faa.gov; labelled "a past launch TFR" |
| Blue Origin, Van Horn | New Shepard's launch TFR, FDC 5/0611 | tfr.faa.gov; labelled "a past launch TFR" |

Dropped: White Sands, Mojave (owner, 2026-09-30); Kodiak (outside the lower-48
training domain). Rows with the same designator are merged by name. Offshore
warning areas that run past the model's domain are clipped to it and the clip is
said in the note. Every polygon keeps its source URL, and `SUA_all` is never read.

## 6. Browser runtime

**Worker.** Everything that computes runs in a module worker,
`lib/slaac-worker.ts`, created with the literal
`new Worker(new URL("./slaac-worker.ts", import.meta.url), { type: "module" })`
form (the chess trap). It owns the ORT session (`onnxruntime-web/wasm`, the only
entry that fetches the plain wasm build; the WebKit trap), the sampler, the
guidance, the reroute and the snapping, and streams progress back: each step's x0
estimate per arc, for the animation. `lib/slaac-engine.ts` is the thin client,
with memoized loading and load generations like the other demos.

**Ported modules**, each import-free so plain node can pin it:
- `lib/slaac/albers.ts`: forward and inverse Albers, the viz_common constants.
- `lib/slaac/dpm-solver.ts`: diffusers 0.38.0 `DPMSolverMultistepScheduler` for
  exactly this config (betas, zero-SNR rescale, trailing timesteps, dpmsolver++
  order 2, lower-order final, and the final-sigma handling this config gets from the diffusers 0.38.0 defaults, read from its source),
  pinned per step.
- `lib/slaac/sampler.ts`: `sample_paths` (chord residual, CFG, self-conditioning
  `chord_features`, the SUA displacement with v re-derived, the low-pass, the
  final hard clear). Noise is an input, so tests inject Python's noise and the
  live demo draws its own from a seeded PRNG.
- `lib/slaac/guidance.ts`: `sua_displacement`, `_margin_topup`, `_inside`,
  `_nearest_boundary`, the Gaussian smoothing (zero-padded conv) and the low-pass
  (replicate padding).
- `lib/slaac/reroute.ts`: `local_reroute` (both policies),
  `refine_route_sua` and its helpers, the snap (KD-tree or a grid over the
  navaid table), the metrics.

**Batching.** The anchors depend only on the filed route and the polygons, so
every arc across every route in a press is known before sampling. The worker
batches them into one forward per step (batch = 2 x arcs for CFG) instead of
running them one by one, which also matches the per-run shared seed. The batch
is capped (measured) so a phone doesn't stall; beyond the cap it runs in chunks.

**Loading.** The figure is behind `DeferredMount`. At scroll-in only the small
JSON (routes, navaids, outline, launch airspace) loads; the 23 MB model and the
runtime load on the first reroute press, like the headshot toy. Gated on the
model file being present (absent: the map, the routes and the drawing still
work, and the figure says the rerouter isn't available; nothing stands in for
it). Stargaze: the worker is terminated and reloads on return only if it had
been loaded (the chess rule); a run in flight is cancelled through the worker's
abort path, never shown as a failure, never counted.

**Analytics.** `demo_used {demo: "slaac"}` once per page load, after a completed
reroute. No new per-interaction events.

## 7. The figure (Figure 3, in the NASA box)

- A dark Albers map of the lower 48 (the owner's embedded outline), drawn on
  canvas at device pixel ratio.
- **Pick a pair**: a select of the library's pairs. Its 8 LM routes draw as the
  filed plans, thin, in one ink.
- **Airspace**: click or tap to add vertices and close the ring; clear. "All
  launch sites" toggles the six sites' polygons (drawn with the airspace colour,
  each labelled), and can combine with a drawn one.
- **Controls**: margin (nm, default 25, the pipeline's default) and lookahead
  (1-waypoint / infinite, default infinite). Changing either after a run re-runs
  it on the next press, never silently.
- **Reroute**: the denoising animates live (the x0 estimate per arc per step);
  then each flight shows its continuous path and, if the gate below passed, its
  snapped named-fix plan, with the deviation fixes marked. A small table per
  flight: added nm and %, minimum clearance, legs crossing. Runtime is printed
  once.
- **Colour** (figure conventions): airspace in stamp red; filed routes in ink;
  rerouted plans in the x0 green (a diffusion model's output, as elsewhere);
  numbers in the warm instrument amber.
- **Mobile**: tap-to-add vertices, a 44px close control, no horizontal scroll
  at 400px, the map's height capped so the controls stay on screen.

**The snapped-plan gate** (the owner's question 4), run in Python before the UI
decides what to show, over the full library x {launch-sites preset, 200 random
polygons of the size range `eval_sua.py` uses} x both policies at margin 25:
- **Pass**: legs crossing = 0 on at least 99% of reroutes for infinite lookahead
  and at least 98% for 1-waypoint (the poster's own rates), no exceptions, and
  no flight shorter after its reroute (the `flights_shorter_after_reroute`
  rule). Then the figure shows snapped plans.
- **Fail**: the figure shows continuous paths only, and the failing cases go to
  the owner with a diagnosis; fixes to the pipeline are allowed.

The JS port must then reproduce the Python results on a fixed subset (same
noise, same polygons) within tolerance before either is shown.

## 8. Copy (all in `content/copy.ts`, through `check-voice.mjs`)

- **NASA box**: SLAAC first. What the rerouter does, in the poster's own
  framing (hazards applied at sampling time, no retraining; "clear by
  construction, not repaired after"; "the policy is the operator's dial"). One or
  two lines for SHIFT (ATC speech-to-text, the typed maneuver parser), from the
  new resume.
- **Figure 3 caption**: paper-length, as the other figures are since 2026-09-30.
  Says the routes were filed ahead of time by the LM and the reroute is live.
- **Rail notes**:
  - SLAAC: the poster's numbers (both columns), cited to the poster.
  - DATA: public sources where possible (FAA open-data airspace in place
    of the internal airspace file; the nav database as shipped), some loss of quality against the internal data; no historical
    route database, so the filed routes are LM-generated instead of mined.
  - The disclaimer: what differs from the internal system, stated concretely
    once measured (for example: no route database, public airspace in place of
    the internal file, fewer denoising steps if a phone needs them), rather than
    the word "approximation". The owner rewords later.
- **Experience row**: two NASA roles per the new resume (SLAAC May-Aug 2026,
  SHIFT Aug 2026 to present).
- **`/lab`**: Figure S3, the video, with its existing caption adapted to its new
  home.
- The keep-limits, cut-assurances rule (2026-09-30) applies: no lines vouching
  that it's real.

## 9. Verification

**Node, plain `node --test`** (new `scripts/test-slaac-*.mjs`):
- Albers forward and inverse against Python.
- DPM-Solver timesteps and every coefficient per step, and a full step sequence
  on fixed model outputs.
- `sua_displacement` / margin top-up / smoothing / low-pass on fixed paths and
  polygons.
- The full sampler on fixed noise with the ONNX model in node (onnxruntime-web
  wasm), against the Python run: dense path max abs diff under a stated
  tolerance (set from what fp32 drift measures, not guessed).
- `local_reroute` + snapping on fixed arcs: identical fix sequences and roles.
- Data shape tests for `routes.json`, `navaids.json`, `launch-sua.json` (every
  polygon has a source URL; no designator outside the approved list).

**Browser, `scripts/verify-redesign.mjs`** (production build, Firefox), new
checks, each proved to bite:
- `slaac-nothing-at-rest`: no ONNX or wasm request before the reroute press.
- `slaac-reroute`: a fixed pair, a fixed polygon, a pinned seed; the plan has 0
  legs crossing and matches the node reference.
- `slaac-launch-preset`: every site's polygons draw, each labelled.
- `slaac-stargaze-cancel`: stargaze mid-run cancels without an error or a
  `demo_used`, and the worker is terminated.
- `slaac-400`: no horizontal scroll at 400px; tapping adds vertices.
- `lab-flight-video`: the video plays on `/lab`.
- The existing flight video check moves with the figure.

**Timing**: measured in a real browser (desktop Chrome and Firefox at least,
the owner's phone for the WebKit pass), not headless Firefox.

## 10. Shipping

- All work on `slaac-demo` in `../portfolio-slaac`.
- Before the first push (which builds the Vercel preview), ask the owner.
- Check the project's Deployment Protection so the mentor can open the preview
  (a shareable link or bypass; the owner chooses).
- Merge to `main` only when the owner says the mentor approved. At merge,
  CLAUDE.md gains the SLAAC section (contracts and traps), the new permissions,
  the resolved NASA drift, and the regenerated OG card if the NASA box shows in
  it.

## 11. Out of scope, recorded for later

- Distilling the route LM to a browser-sized student; a KV-cache export; the
  LM running live (a desktop-only "write a new route" button is the likely
  shape).
- Rewrites of the Python pipeline beyond the fixes this round needs (the owner
  says it was built in 7 weeks and wants to redo parts of it).
- Weather hazards, altitude bands, and SUA activation schedules (the demo
  treats every polygon as surface-to-unlimited and always active, as `SUA_all`
  effectively did).
- A searchable OD picker beyond the curated library.

## 12. Open items the build will settle, with the owner where marked

- **Denoising steps and the other sampler settings**: the owner's ruling
  (2026-09-30) is "whatever is performant and accurate". So the build sweeps
  steps (for example 20, 30, 40, 50) in Python over the gate's case set, and
  the demo ships the fewest steps whose gate metrics (legs-crossing rate,
  median added distance, minimum clearance) stay within a stated tolerance of
  the 40-step `plan_cli` default, then confirms the browser time. The chosen
  value and its measured cost are recorded in the rail note and CLAUDE.md.
- W-386's number and the Spaceport America PDF, before those polygons ship.
- The route library's pair list: drafted by hand, shown to the owner before
  the LM run (owner).
- Whether int8 helps the UNet (measure; ship fp32 if not).
- The batch cap on phones (measure).

## 13. As built: where the build departed from this design

Rulings are numbered as in the build's ledger
(`.superpowers/sdd/2026-09-30-slaac-rerouter/progress.md`, gitignored).

- **Merged launch rings (R7).** Section 5 merged rows by designator only. The
  gate found KSC's abutting rings (R-2932..R-2935, W-497A/B) made the guidance
  push a path out of one ring into the next (1-waypoint lookahead at 97.5%,
  under its 98% bar), so each site's touching or overlapping rings are unioned
  into one outline. Every merged polygon keeps `merged_from` and every source
  URL; the outline differs from the FAA's separate designators, and the data
  says which it came from. W-386 is out (the Wallops handbook names no W
  number); R-5111A/B are in (the FAA PDF names them).
- **The gate's rules (R8, R9, R11) and its result (R10).** The
  `flights_shorter_after_reroute` rule measured the LM's own doglegs, not the
  rerouter; it became "never shorter than the straight line between its own
  anchors", which is an invariant (0 by construction), so the evidence is
  leg-clear and clear-at-margin only. Decision ladder: snapped with both
  policies if hug >= 98% and wide >= 99% leg-clear with 0 exceptions, else
  wide alone, else continuous. Result over 2,240 runs: **20 steps, snapped,
  `[wide, hug]`**, 99.64% / 99.29% of plans with no leg crossing. The trade
  of 20 over 40 steps: every leg at the full 25 nm on 86.1% / 85.4% of plans
  against 89.3% / 85.4% (the metric isn't monotone in steps; up to ~9 points
  on the noisier 80 launch-preset cases). The copy never implies the buffer
  is always held, and the figure prints each flight's real minimum clearance.
- **The FRD geocoding fix (R13).** The owner's `geocode_items` keeps a navaid
  AND appends its FRD point for an LM token `NAV <Rxxx> <Dyyy>`, so 138 of
  373 routes doubled back. `route_library.py` rewrites each such pair into the
  owner's own `rdp` form before calling the owner's function (no owner file
  edited), routes regenerated on the same seeds with identical tokens, gate
  re-run. 11 routes still backtrack: the LM's own doglegs, shown as generated.
  The bug is the owner's to fix upstream.
- **The worker yields before every forward (R16).** ORT-web's `session.run`
  never returns to the worker's task queue, so without a yield a `cancel` or a
  newer press was read only after the whole old run. A MessageChannel
  round trip (0.01-0.02 ms, measured in a Firefox worker) before each forward
  lets it in; the run stops within one forward. Section 6's "abort path" is
  this yield plus the run-id guards at the figure, engine and worker.
- **Dynamic zoom (R14, owner request).** Not in section 7: the map fits the
  selected pair's routes, launch airspace within 150 nm of them and drawn
  rings, eased over 350 ms (snapped under reduced motion), with a "whole US"
  toggle; the ring tool works at any zoom.
- **Notes layout.** Section 8 put DATA and the disclaimer in the rail. Stacked
  there they ran 725px against ~290px of prose, so the SLAAC note stays in the
  rail and DATA and DIFFERENCES sit under Figure 3 as a footnote band (two
  columns from 880px).
- **Smaller changes.** Arcs are deduplicated by (entry, rejoin), since every
  arc starts from the same noise; an arc the planner missed is sampled on
  demand (R3, expected never; counted as `fallbackArcs`). Progress posts
  every 2 forwards, not every step. The outline ships as
  `us-outline.json`, not `.bin`. The route library is 48 owner-approved pairs,
  373 routes. Both batch caps are 4 (section 14). `slaac-reroute` recomputes
  legs crossing in node from each received plan rather than matching a node
  reference run; the node reference lives in `test-slaac-arcs.mjs`, which
  pins `runReroute` against `localReroute` driven by the real ONNX model.
  The UNet ships fp32; int8 was not tried.

## 14. Measured (Task 15, 2026-09-30)

Where: this laptop (20 hardware threads; ORT runs 4), a production build
(`next build && next start -p 3100`), first press on a cold cache (a fresh
profile or context per run), headed windows on the desktop. Three runs each;
median [range]. Stock Firefox 152 is driven over WebDriver BiDi (Playwright
can't drive it); Chromium is Playwright's bundled Chromium 1243, not Google
Chrome. These are laptop numbers: **no phone, and not Chrome proper, has
been measured**.

Cases: (a) KJFK-KMIA with all six launch sites, 3 arcs; (b) the same plus a
large drawn box over the Southeast (36.5N-30N, 90W-75.5W), 2 arcs (fewer
distinct entry/rejoin pairs than (a)); (c) KJFK-KMIA, launch sites off, a box over central
Nevada: no conflict; (d) KCLT-KSAN with the launch sites and the Southeast
box, 8 arcs, the library's heaviest case with that box (found by planning
every pair offline). Default margin 25 nm, infinite lookahead, 20 steps.

| browser | case | cap | press → done | worker time | per forward | worst progress interval |
|---|---|---|---|---|---|---|
| stock Firefox 152 | a | 16 | 2.77 s [2.71-2.78] | 2.15 s [2.10-2.16] | 100 ms (6 samples) | 245 ms [240-277] |
| stock Firefox 152 | a | 4 | 2.82 s [2.77-2.92] | 2.20 s [2.15-2.28] | 104 ms | 266 ms [233-290] |
| stock Firefox 152 | b | 16 | 2.07 s [2.05-2.08] | 1.45 s | 65 ms (4 samples) | 174 ms [169-176] |
| stock Firefox 152 | c | - | 17 ms to "no conflict" [16-18] | none | - | - |
| stock Firefox 152 | d | 16 | 5.75 s [5.74-5.77] | 5.13 s | 248 ms (16 samples) | 548 ms [535-554] |
| stock Firefox 152 | d | 4 | 6.11 s [6.03-6.13] | 5.46 s | 131 ms (8 samples) | 309 ms [306-314] |
| Chromium 1243 | a | 16 | 3.15 s [3.14-3.17] | 2.22 s | 102 ms | 305 ms [294-325] |
| Chromium 1243 | b | 16 | 2.44 s [2.43-2.60] | 1.52 s | 68 ms | 224 ms [223-248] |
| Chromium 1243 | c | - | 18 ms to "no conflict" | none | - | - |
| Chromium 1243 | d | 16 | 7.76 s [7.70-7.97] | 6.85 s | 375 ms | 776 ms [773-827] |
| Chromium 1243 | d | 4 | 6.54 s [6.40-7.89] | 5.60 s | 132 ms | 407 ms [406-447] |
| WebKitGTK 2.52.5 (JavaScriptCore) | a | 16 | 8.28 s [8.12-8.44] | 6.61 s [6.61-6.84] | ~330 ms | ~700 ms |
| Playwright Firefox 151 | a | 16 | 15.8 s [15.7-15.9] | 13.9 s | 686 ms | 1450 ms |
| Playwright Firefox 151 | d | 16 | 35.2 s | 33.3 s | 1655 ms | 3408 ms |

At 400px (the phone cap, 4; same laptop CPU), stock Firefox: a 2.76 s, b
2.04 s, d 6.12 s with a 302 ms worst interval [298-311].

- **First-press download**: the model is 23,395,296 bytes, served
  uncompressed by `next start`;
  press to model loaded (HEAD probe, download, worker start, session
  create) 0.62 s [0.61-0.64] in stock Firefox, 0.92 s in Chromium, over
  localhost, so it says nothing about a visitor's network. The runtime
  (`ort-wasm-simd-threaded.wasm`, 13.5 MB raw) transfers as 3.46 MB gzipped
  when the chess worker hasn't already fetched it.
- **No conflict loads nothing**: case (c) made no model and no rerouter
  runtime request in every run (the planner runs on the main thread).
- **Batch caps (changed 16 → 4 on desktop)**: a forward costs ~16 ms per CFG
  sample in stock Firefox whatever the batch (65 ms at 4, 100 at 6, 131 at 8,
  248 at 16), so batching buys ~5-7% throughput at most. At the old desktop
  cap, case (d) ran as one chunk with 548 ms intervals; at 4 it runs as two,
  ~300 ms worst (the first interval, which includes setup) and ~250-280 ms in
  steady state, for 6% more total time. The phone cap stays 4 until a phone
  says otherwise; on this laptop a cap of 2 would cost nothing in total time.
- **Playwright's Firefox is ~7x slower at this wasm than stock Firefox**,
  headed or headless (the verify suite's headless run read 14.2 s for case
  a), so the suite's timings and timeouts say nothing about a visitor.
- **WebKitGTK** (`probe-webkit-draw.py`'s method, adapted to press reroute;
  3 runs): the press completes, all 8 flights `ok`, and the 30-60 s idle
  afterwards holds the web process flat (585-859 MB RSS, peak 859 MB) at
  ~97% CPU, the page's own render floor under software rendering: no
  JavaScriptCore runaway of the asyncify kind. Not an iPhone number.
- **Copy**: the DIFFERENCES note says a reroute takes "2-6 seconds on my
  laptop" (stock Firefox and Chromium, cases a-d, first press included). No
  phone timing is claimed anywhere.
- **Pending (Task 16)**: desktop Chrome and the owner's iPhone, on the
  preview link.
