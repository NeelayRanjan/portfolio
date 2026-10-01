# SLAAC rerouter timing harness (Task 15)

Hand-run, never wired to a build or to `verify-redesign.mjs`. The numbers in
CLAUDE.md's SLAAC "Measured" bullet (and the "about 2-7 seconds" in the
DIFFERENCES note under Figure 3) came from these four scripts on the owner's
laptop, 2026-09-30. Re-run them after any change to the worker, the batch
caps (`lib/slaac/arcs.ts`), the step count in `meta.json`, or the model.

All of them want a production build, not the dev server:

```bash
npm run build && npx next start -p 3100   # :3000 belongs to another app on this machine
```

Scenarios (the browser scripts): `a` KJFK-KMIA past all six launch sites;
`b` `a` plus a drawn box over the Southeast; `c` KJFK-KMIA with the launch
sites off and a box over Nevada (no conflict: settles without loading the
model); `d` KCLT-KSAN with the launch sites and the Southeast box, the
heaviest library case; `all` (Task 12c) every library route in one press
(the figure's default), launch sites on, no drawn box (`measure-sysff.mjs` only). Each prints one JSON line per run, then a `SUMMARY`
line with median [min-max] per metric (press to done, press to model loaded,
worker ms, ms per forward, the longest gap between progress messages).

- **`measure-sysff.mjs`**: stock Firefox over WebDriver BiDi, a fresh profile
  (cold cache) per run, headed.
  `node scripts/slaac/measure/measure-sysff.mjs a desktop 3`.
  Env: `BASE` (default `http://localhost:3100`), `FIREFOX` (default
  `/usr/bin/firefox`), `DISPLAY` (default `:0`), `SCRATCH` (profile dir,
  default the OS tmpdir). This is the Firefox number CLAUDE.md quotes.
- **`measure-slaac.mjs`**: Playwright's own browsers.
  `node scripts/slaac/measure/measure-slaac.mjs chromium a desktop 3 headed`
  (`firefox | chromium | webkit`, `desktop | phone`, run count,
  `headed | headless`). Env: `BASE`, `CHROMIUM` (another Chromium binary).
- **`probe-webkit-slaac.py`**: WebKitGTK (JavaScriptCore) through python gi;
  one press, then RSS and CPU of the web process through an idle stretch. The
  usage line and the environment it needs are in its docstring; `PAIR` picks
  the pair by index in `public/slaac/routes.json` (default 1, KJFK-KMIA).
- **`arccount.mjs`**: no browser and no model. Plans every library pair under
  both policies, launch sites alone and with the Southeast box, and prints
  the heaviest by unique arcs (how scenario `d` was chosen).
  `node scripts/slaac/measure/arccount.mjs`.

⚠️ **Playwright's bundled Firefox is about 7x slower than stock Firefox for
this model**: ~686 ms per forward against ~100 ms for scenario `a` (6.9x),
15.8 s against 2.77 s press to done (the load and planning don't scale with
it), same machine, same build. Never quote a Playwright-Firefox time as "Firefox"; use
`measure-sysff.mjs`. Headless numbers in general are not device numbers, and
none of these is a phone.

Raw logs from the 2026-09-30 runs are not committed.
