#!/usr/bin/env node
/**
 * verify-redesign.mjs — the keepable regression suite for the manuscript
 * redesign.
 *
 * Run against a REAL PRODUCTION BUILD, never the dev server:
 *   npm run build
 *   npm start -- -p 3000
 *   node scripts/verify-redesign.mjs
 *
 * ⚠️ Port 3000 only. A human dev server may be running on :3001 — never
 * touch it, never point this script at it. This script does not start or
 * stop any server itself; that is deliberate, so a session can rerun it
 * against a server it is already iterating on.
 *
 * Playwright's Firefox is the only browser installed in this repo (see
 * CLAUDE.md), and headless inference through onnxruntime-web measures
 * roughly 20x slower here than a real browser on the same machine. Every
 * timeout below is sized for that, not for a snappy laptop.
 *
 * Each check is a small, independently named async function so a future
 * session can import and rerun a subset instead of the whole suite. Pass
 * check names (or substrings) as CLI args to run only those:
 *   node scripts/verify-redesign.mjs desk label
 * With no args, every check runs. PASS/FAIL prints per check as it
 * finishes; the process exits 1 if anything failed.
 *
 * Deliberately no sleep-and-hope: every wait is either (a) a bounded poll
 * on a real in-page condition via page.waitForFunction, (b) a bounded
 * scroll-and-recheck loop against IntersectionObserver-gated mounts, or
 * (c) a fixed, short, explicitly-timing-based wait where the assertion
 * itself IS about elapsed time (the desk field's two-samples-apart check).
 */
import { firefox } from "playwright";
import * as Astronomy from "astronomy-engine";

const BASE = "http://localhost:3000";

/* ---------------------------------------------------------------------- */
/* small harness                                                          */
/* ---------------------------------------------------------------------- */

let passCount = 0;
let failCount = 0;

/** Run `fn(browser)`, print PASS/FAIL, never throw past this point. */
async function run(name, browser, fn) {
  const start = Date.now();
  try {
    const detail = await fn(browser);
    const ms = Date.now() - start;
    console.log(`PASS  ${name} (${ms}ms)${detail ? " — " + detail : ""}`);
    passCount++;
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`FAIL  ${name} (${ms}ms) — ${err?.message ?? err}`);
    failCount++;
  }
}

/** New isolated context + page, closed automatically when `fn` returns. */
async function withPage(browser, contextOptions, fn) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    return await fn(page, context);
  } finally {
    await context.close();
  }
}

/**
 * Scroll the real page (mouse wheel, so IntersectionObserver actually fires)
 * until `selector` is attached, or give up after `maxScrolls`. Bounded, so
 * this is a poll, not an indefinite wait.
 */
async function scrollUntilAttached(page, selector, { maxScrolls = 20, step = 700 } = {}) {
  for (let i = 0; i < maxScrolls; i++) {
    if ((await page.locator(selector).count()) > 0) return;
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(150);
  }
  throw new Error(`${selector} never appeared after ${maxScrolls} scrolls`);
}

/* ---------------------------------------------------------------------- */
/* 1. Night sky (components/manuscript/NightSky.tsx)                      */
/* ---------------------------------------------------------------------- */

/** The sky is the sole direct-child canvas of <body> (app/layout.tsx); every
 *  other canvas on the page lives inside <main>. */
const SKY_CANVAS = "body > canvas";

async function waitSkyDrawn(page) {
  await page.waitForFunction(() => window.__sky?.drawn === true, null, { timeout: 15000 });
}

/** Brightest mean-RGB value in a (2r+1)px box of the sky canvas, CSS coords. */
function skyPeak(page, x, y, r) {
  return page.evaluate(
    ([sel, x, y, r]) => {
      const c = document.querySelector(sel);
      const s = c.width / window.innerWidth;
      const size = Math.round(2 * r * s) + 1;
      const { data } = c.getContext("2d").getImageData(Math.round((x - r) * s), Math.round((y - r) * s), size, size);
      let best = 0;
      for (let i = 0; i < data.length; i += 4) best = Math.max(best, (data[i] + data[i + 1] + data[i + 2]) / 3);
      return best;
    },
    [SKY_CANVAS, x, y, r],
  );
}

async function skyAnimatesAt1280(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    const canvas = page.locator(SKY_CANVAS);
    const sample = () => canvas.evaluate((el) => el.toDataURL());
    const a = await sample();
    await page.waitForTimeout(1500); // real elapsed time is the point of this assertion
    const b = await sample();
    if (a === b) throw new Error("two samples 1.5s apart are byte-identical (the sky is not turning)");
    const ms = await page.evaluate(() => window.__sky.frameMsMedian);
    return `samples differ; median frame draw ${ms?.toFixed(2)}ms (a headless Firefox number, not a device number)`;
  });
}

async function skyStaticUnderReducedMotion(browser) {
  return withPage(
    browser,
    { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" },
    async (page) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const canvas = page.locator(SKY_CANVAS);
      const sample = () => canvas.evaluate((el) => el.toDataURL());
      const a = await sample();
      await page.waitForTimeout(1500);
      const b = await sample();
      if (a !== b) throw new Error("reduced-motion sky changed between two samples 1.5s apart");
      const credit = await page.locator("[data-sky-credit]").innerText();
      if (/faster/.test(credit)) throw new Error(`reduced-motion credit still claims a speed-up: "${credit}"`);
      return "drawn, static for 1.5s, credit carries the still wording";
    },
  );
}

async function skyPresentAt400(browser) {
  // Inverted from the old desk-field-absent-500: the owner wants the sky on phones.
  return withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    const { display, lit } = await page.evaluate((sel) => {
      const c = document.querySelector(sel);
      const { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 300) lit++;
      return { display: getComputedStyle(c).display, lit };
    }, SKY_CANVAS);
    if (display === "none") throw new Error("sky canvas is display:none at 400px");
    if (lit < 50) throw new Error(`only ${lit} bright pixels at 400px`);
    const credit = await page.locator("[data-sky-credit]").innerText();
    if (!/Hipparcos/.test(credit)) throw new Error(`credit line missing or wrong: "${credit}"`);
    return `visible, ${lit} bright pixels, credit present`;
  });
}

const VEGA = { raDeg: 279.2347, decDeg: 38.7837 }; // J2000
const MOFFETT_LON = -122.0647;

/**
 * The pole position from controller ruling P1 (2026-09-15), written out
 * independently of lib/sky-math.ts: Sheet.tsx is max-width 1000px, centered,
 * inside 16px page gutters, its top 56px down. When that leaves at least 72px
 * of margin beside it, the pole sits in that margin, 18% down the viewport;
 * otherwise it drops to half the sheet's top offset instead.
 */
function specPole(width, height) {
  const sheetW = Math.min(width - 32, 1000);
  const leftMargin = (width - sheetW) / 2;
  if (leftMargin >= 72) return { x: leftMargin / 2, y: 0.18 * height };
  return { x: 0.22 * width, y: 28 };
}
/** The spec's projection (§2), written out independently of lib/sky-math.ts;
 *  pole from specPole, k puts dec -35° on the corner farthest from the pole. */
function specProject(width, height, lstDeg, raDeg, decDeg) {
  const D2R = Math.PI / 180;
  const pole = specPole(width, height);
  const far = Math.max(
    Math.hypot(pole.x, pole.y),
    Math.hypot(width - pole.x, pole.y),
    Math.hypot(pole.x, height - pole.y),
    Math.hypot(width - pole.x, height - pole.y),
  );
  const k = far / Math.tan(62.5 * D2R); // (90° - (-35°)) / 2
  const rho = k * Math.tan(((90 - decDeg) / 2) * D2R);
  const phi = (raDeg - lstDeg) * D2R;
  return { x: pole.x + rho * Math.sin(phi), y: pole.y - rho * Math.cos(phi) };
}

async function checkSkyOrientation(browser) {
  const W = 1600;
  const H = 1000;
  // The first 06:00 UTC from 2026-10-01 whose Moon is >30% lit and lands well
  // inside the canvas AND leaves Vega on-canvas too, computed by
  // astronomy-engine, not by the site. Both constraints are needed now that
  // the pole sits off-centre (controller ruling P1, 2026-09-15): unlike the
  // old centred projection, a given LST can easily push a mid-declination
  // star like Vega off the canvas even while the Moon stays on it, so the
  // combined condition is rarer and needs a wider search window: at a fixed
  // UTC hour LST drifts only ~0.9856°/day, so covering enough of the LST
  // cycle to hit the combined condition at all takes on the order of a
  // season, not a month (measured: the first hit against this pole and this
  // margin, searching from 2026-10-01, lands on day 117).
  let when = null;
  let moon = null;
  let vega = null;
  let lst = null;
  for (let d = 0; d < 400 && !when; d++) {
    const date = new Date(Date.UTC(2026, 9, 1 + d, 6));
    const eq = Astronomy.EquatorFromVector(Astronomy.GeoMoon(date));
    const lstDeg = (((Astronomy.SiderealTime(date) * 15 + MOFFETT_LON) % 360) + 360) % 360;
    const p = specProject(W, H, lstDeg, eq.ra * 15, eq.dec);
    const v = specProject(W, H, lstDeg, VEGA.raDeg, VEGA.decDeg);
    const lit = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
    const onCanvas = (q) => q.x > 60 && q.x < W - 60 && q.y > 60 && q.y < H - 60;
    if (lit > 0.3 && onCanvas(p) && onCanvas(v)) {
      when = date;
      moon = p;
      vega = v;
      lst = lstDeg;
    }
  }
  if (!when) throw new Error("no test night with a lit, on-canvas Moon and on-canvas Vega in 400 days");

  return withPage(
    browser,
    { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 },
    async (page) => {
      await page.clock.setFixedTime(when);
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const siteLst = await page.evaluate(() => window.__sky.lstDeg);
      let dl = Math.abs(siteLst - lst) % 360;
      if (dl > 180) dl = 360 - dl;
      if (dl > 0.05) throw new Error(`site LST ${siteLst.toFixed(3)}° vs astronomy-engine ${lst.toFixed(3)}°`);
      const pole = specPole(W, H);
      const site = await page.evaluate(() => ({ cx: window.__sky.cx, cy: window.__sky.cy, offset: window.__sky.offset }));
      if (Math.abs(site.cx - pole.x) > 0.01 || Math.abs(site.cy - pole.y) > 0.01 || site.offset.x !== 0 || site.offset.y !== 0) {
        throw new Error(`pole at (${site.cx}, ${site.cy}) offset ${JSON.stringify(site.offset)}, expected (${pole.x}, ${pole.y}) at rest`);
      }

      const vegaPeak = await skyPeak(page, vega.x, vega.y, 3);
      const moonPeak = await skyPeak(page, moon.x, moon.y, 4);
      if (vegaPeak < 150) throw new Error(`no bright pixel at Vega's expected (${vega.x.toFixed(0)}, ${vega.y.toFixed(0)}): peak ${vegaPeak}`);
      if (moonPeak < 150) throw new Error(`no bright pixel at the Moon's expected (${moon.x.toFixed(0)}, ${moon.y.toFixed(0)}): peak ${moonPeak}`);
      return `${when.toISOString()}: LST off by ${dl.toFixed(4)}°, pole at (${pole.x}, ${pole.y}), Vega peak ${vegaPeak.toFixed(0)}, Moon peak ${moonPeak.toFixed(0)}`;
    },
  );
}

async function checkSkyHover(browser) {
  // Reduced motion keeps the chart still, so the targeted segment can't drift
  // away from the pointer mid-check. Hover works there too (spec §3).
  return withPage(
    browser,
    { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 },
    async (page) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const target = await page.evaluate(() => {
        const sheet = document.querySelector("[data-sheet]").getBoundingClientRect();
        const W = window.innerWidth;
        const H = window.innerHeight;
        const inMargin = (x, y) =>
          x > 12 && x < W - 12 && y > 12 && y < H - 12 &&
          (x < sheet.left - 30 || x > sheet.right + 30 || y < sheet.top - 30);
        const abbrs = ["UMa", "Ori", "Cas", "Cyg", "Lyr", "Leo", "Sco", "Peg", "And", "Per", "Aur", "Gem",
          "Tau", "Boo", "Her", "Dra", "Cep", "UMi", "Cnc", "Vir", "Sgr", "Aql", "Aqr", "Cap", "Psc", "Ari",
          "CMa", "Hya", "Oph", "Ser"];
        for (const abbr of abbrs) {
          for (const [x1, y1, x2, y2] of window.__sky.segmentsFor(abbr)) {
            const x = (x1 + x2) / 2;
            const y = (y1 + y2) / 2;
            if (Math.hypot(x2 - x1, y2 - y1) > 30 && inMargin(x, y)) return { abbr, x, y, x1, y1, x2, y2 };
          }
        }
        return null;
      });
      if (!target) throw new Error("no named constellation has a segment in the desk margin at 1440x900");

      // A point 30% along the segment: on the line, away from the vertex stars.
      const qx = target.x1 + (target.x2 - target.x1) * 0.3;
      const qy = target.y1 + (target.y2 - target.y1) * 0.3;

      await page.mouse.move(720, 450); // over the sheet: nothing may highlight
      await page.waitForFunction(() => window.__sky.highlight === null, null, { timeout: 3000 });
      const before = await skyPeak(page, qx, qy, 1);

      await page.mouse.move(target.x, target.y);
      await page.waitForFunction((abbr) => window.__sky.highlight === abbr, target.abbr, { timeout: 3000 });
      const after = await skyPeak(page, qx, qy, 1);
      if (after - before < 60) {
        throw new Error(`${target.abbr} highlighted but its line did not brighten (${before} -> ${after})`);
      }

      // The name must land somewhere the visitor can actually read it: on
      // screen, and clear of the sheet (fix round 1, finding I1). Since the
      // pole moved top left (2026-09-15) near-pole anchors sit near the
      // sheet's top-left corner, and on 1280-1440px viewports that corner is
      // still under the page, so the avoidance still matters.
      const { label, sheet, viewport } = await page.evaluate(() => {
        const r = document.querySelector("[data-sheet]").getBoundingClientRect();
        return {
          label: window.__sky.label,
          sheet: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        };
      });
      if (!label) throw new Error(`${target.abbr} highlighted but window.__sky.label is null`);
      if (label.x < 0 || label.y < 0 || label.x + label.w > viewport.width || label.y + label.h > viewport.height) {
        throw new Error(
          `${target.abbr} label box ${JSON.stringify(label)} falls outside the ${viewport.width}x${viewport.height} viewport`,
        );
      }
      const intersectsSheet =
        label.x < sheet.right && label.x + label.w > sheet.left && label.y < sheet.bottom && label.y + label.h > sheet.top;
      if (intersectsSheet) {
        throw new Error(`${target.abbr} label box ${JSON.stringify(label)} intersects the sheet ${JSON.stringify(sheet)}`);
      }

      await page.mouse.move(720, 450);
      await page.waitForFunction(() => window.__sky.highlight === null, null, { timeout: 3000 });
      return `${target.abbr}: line brightened ${before.toFixed(0)} -> ${after.toFixed(0)}; label ${label.w.toFixed(0)}x${label.h.toFixed(0)} at (${label.x.toFixed(0)}, ${label.y.toFixed(0)}), clear of the sheet; cleared over the sheet`;
    },
  );
}

/** Press at (x, y), move by (dx, dy) in `steps` real mouse moves, and hold (no release). */
async function dragBy(page, x, y, dx, dy, steps = 12) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
}

const skyOffset = (page) => page.evaluate(() => window.__sky.offset);

/**
 * A desk point in the left margin at mid-height with nothing clickable under
 * it: the sheet is 1000px wide and centred, so at 1440 the margin is 220px.
 */
async function leftMarginPoint(page) {
  const p = await page.evaluate(() => {
    const sheet = document.querySelector("[data-sheet]").getBoundingClientRect();
    const x = Math.round(sheet.left / 2);
    const y = Math.round(window.innerHeight / 2);
    const el = document.elementFromPoint(x, y);
    return { x, y, blocked: !!el?.closest("a, button, input, [data-sheet]"), sheetLeft: sheet.left };
  });
  if (p.sheetLeft < 100) throw new Error(`desk margin only ${p.sheetLeft}px wide`);
  if (p.blocked) throw new Error(`(${p.x}, ${p.y}) is over a control or the sheet`);
  return p;
}

async function checkSkyDrag(browser) {
  const notes = [];
  // Animated sky: drag in the margin, measure the spring home.
  await withPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    const { x, y } = await leftMarginPoint(page);

    await dragBy(page, x, y, 150, 80);
    await page.waitForFunction(() => window.__sky.dragging === true, null, { timeout: 2000 });
    const held = await skyOffset(page);
    if (Math.abs(held.x - 150) > 2 || Math.abs(held.y - 80) > 2) {
      throw new Error(`dragged (150, 80) but the offset is ${JSON.stringify(held)}`);
    }
    const hl = await page.evaluate(() => window.__sky.highlight);
    if (hl !== null) throw new Error(`hover highlight "${hl}" stayed on during a drag`);
    const t0 = Date.now();
    await page.mouse.up();
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, {
      timeout: 1500,
      polling: "raf",
    });
    notes.push(`(150, 80) held, home in ${Date.now() - t0}ms`);

    // Rubber band: 900px of drag must move the chart past the limit but less than 1.5x it.
    const limit = 0.45 * 900;
    await dragBy(page, x, y, 900, 0, 20);
    const far = await skyOffset(page);
    await page.mouse.up();
    if (!(far.x > limit && far.x < 1.5 * limit)) throw new Error(`900px drag gave offset ${far.x}, limit ${limit}`);
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 2500 });
    notes.push(`900px drag banded to ${far.x.toFixed(0)}px`);

    // Starting on the sheet never pans (and the page text is not a drag handle).
    const sheetPoint = await page.evaluate(() => {
      const r = document.querySelector("[data-sheet]").getBoundingClientRect();
      return { x: Math.round(r.left + 60), y: Math.round(Math.max(r.top, 0) + 200) };
    });
    await dragBy(page, sheetPoint.x, sheetPoint.y, -150, 40);
    const onSheet = await page.evaluate(() => ({ offset: window.__sky.offset, dragging: window.__sky.dragging }));
    await page.mouse.up();
    if (onSheet.dragging || onSheet.offset.x !== 0 || onSheet.offset.y !== 0) {
      throw new Error(`a drag that started on the sheet panned the sky: ${JSON.stringify(onSheet)}`);
    }
    notes.push("sheet drag ignored");
  });

  // Reduced motion: the drag still works, the release snaps home.
  await withPage(
    browser,
    { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" },
    async (page) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      const { x, y } = await leftMarginPoint(page);
      await dragBy(page, x, y, 100, 0);
      await page.waitForFunction(() => Math.abs(window.__sky.offset.x - 100) < 2, null, { timeout: 2000 });
      await page.mouse.up();
      // One paint, no spring: home at once.
      await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 100 });
      notes.push("reduced motion: dragged, snapped home");
    },
  );
  return notes.join("; ");
}

/* ---------------------------------------------------------------------- */
/* 2. No horizontal scroll at 400px                                       */
/* ---------------------------------------------------------------------- */

function checkNoHorizontalScroll(route) {
  return async (browser) =>
    withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (scrollWidth > clientWidth + 1) {
        throw new Error(`scrollWidth ${scrollWidth} > clientWidth ${clientWidth} at 400px`);
      }
      return `scrollWidth ${scrollWidth} <= clientWidth ${clientWidth}`;
    });
}

/* ---------------------------------------------------------------------- */
/* 3. Nothing model-sized before scroll, at 400px                         */
/* ---------------------------------------------------------------------- */

const HEAVY_RE = /\.(onnx|wasm)(\?|$)|traj\.json(\?|$)|manifest\.json(\?|$)|sprites\.webp(\?|$)/i;

async function checkNoEarlyHeavyPayload(browser) {
  return withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    const urls = [];
    page.on("request", (req) => urls.push(req.url()));
    // 400px is below lib/warm.ts's 768px idle-warm gate, and no demo is in
    // the initial viewport + DeferredMount's 200px
    // rootMargin at this width — so nothing heavy should be in flight yet.
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // catch anything an idle callback might still fire
    const heavy = urls.filter((u) => HEAVY_RE.test(u));
    if (heavy.length) throw new Error(`heavy request(s) before scroll: ${heavy.join(", ")}`);
    return `${urls.length} requests total, none model/trajectory-sized`;
  });
}

/* ---------------------------------------------------------------------- */
/* 4. Label-efficiency sweep (Figure 1,                                   */
/* components/figures/LabelEfficiencyFigure.tsx +                         */
/* public/research/label_efficiency.json)                                 */
/* ---------------------------------------------------------------------- */

/** Set a range input's value via the native setter (so React's onChange,
 *  which is wired to the 'input' event, actually fires) then dispatch input. */
async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      "value",
    ).set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** What the site's copy calls each series. Kept in step with
 *  `copy.research.figLabelEff.modelLabels`; the check fails loudly if a name
 *  drifts, which is the point. */
const EFF_LABELS = {
  x0diffusion: "x0-diffusion",
  sam: "SAM (zero-shot)",
  vit_base_patch16: "ViT-B/16",
  hybridresnetvit: "hybrid ResNet+ViT",
  resnet: "ResNet-UNet",
  deeplabv3: "DeepLabV3",
  ediffusion: "ε-diffusion",
};

async function checkLabelEfficiency(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 1400 } }, async (page) => {
    // The SERVED file is the reference, same rule as the Dice-CDF check.
    const eff = await (await fetch(`${BASE}/research/label_efficiency.json`)).json();
    // ε-diffusion stays in the json but off the chart (owner call,
    // 2026-09-13): its flat ~0.23 squashed the range. The figure displays
    // every OTHER model, and this list is what the readout/series asserts
    // run over.
    const EFF_HIDDEN = new Set(["ediffusion"]);
    const models = Object.keys(eff.models).filter((m) => !EFF_HIDDEN.has(m));
    if (models.length === Object.keys(eff.models).length) {
      throw new Error("expected ediffusion in the served json (the hidden-model contract moved?)");
    }
    const budgets = eff.models.x0diffusion.map((p) => p.labels);
    const lastIdx = budgets.length - 1;

    await page.goto(BASE, { waitUntil: "networkidle" });
    const slider = page.locator("#eff-labels");
    await slider.waitFor({ state: "attached", timeout: 10000 });

    // 1. Chart structure: one polyline per model in the file, plus one whisker
    //    group per model at the cursor.
    const figure = page.locator("figure").filter({ has: slider });
    const svg = figure.locator("svg").first();
    await svg.waitFor({ state: "visible", timeout: 10000 });
    const lines = await svg.locator("polyline").count();
    if (lines !== models.length) {
      throw new Error(`${lines} series polylines, want ${models.length}`);
    }
    const whiskers = await svg.locator("g[data-whisker]").count();
    if (whiskers !== models.length) {
      throw new Error(`${whiskers} whisker groups, want ${models.length}`);
    }

    const readReadouts = () =>
      page.evaluate(() => {
        const out = {};
        for (const el of document.querySelectorAll("#fig-eff-readouts [data-model]")) {
          out[el.dataset.model] = el.textContent;
        }
        return { models: out, gap: document.querySelector("#fig-eff-gap")?.textContent ?? "" };
      });

    // Strip helpers. The strip is data in the SERVED json, so its absence is
    // a failure, not a skip: the deploy would be missing Figure 1's panels.
    if (!eff.strip || !Array.isArray(eff.strip.budgets)) {
      throw new Error("label_efficiency.json has no strip block — Figure 1's panels are gone");
    }
    const stripModels = eff.strip.models;
    const readPanels = () =>
      page.evaluate(() => {
        return [...document.querySelectorAll("#fig-eff-strip > div")].map((panel) => ({
          text: panel.querySelector(".font-mono")?.textContent ?? "",
          url: panel.querySelector("canvas")?.toDataURL() ?? null,
        }));
      });
    const waitPainted = () =>
      page.waitForFunction(
        (want) => {
          const canvases = [...document.querySelectorAll("#fig-eff-strip canvas")];
          if (canvases.length !== want) return false;
          return canvases.every((c) => {
            const g = c.getContext("2d");
            if (!c.width || !c.height) return false;
            const px = g.getImageData(0, 0, c.width, c.height).data;
            for (let i = 3; i < px.length; i += 4) if (px[i] > 0) return true;
            return false;
          });
        },
        stripModels.length,
        { timeout: 20000 },
      );
    const assertPanels = async (i) => {
      const panels = await readPanels();
      if (panels.length !== stripModels.length + 1) {
        throw new Error(`${panels.length} strip panels, want ${stripModels.length + 1}`);
      }
      if (!panels[0].text.includes(String(eff.strip.image))) {
        throw new Error(`base panel says "${panels[0].text}", want test image ${eff.strip.image}`);
      }
      for (const [k, m] of stripModels.entries()) {
        const want = eff.strip.budgets[i].masks[m].dice.toFixed(3);
        if (!panels[k + 1].text.includes(want)) {
          throw new Error(
            `strip panel ${m} at ${budgets[i]} labels says "${panels[k + 1].text}", want Dice ${want}`,
          );
        }
      }
      return panels;
    };

    /** The cursor must sit exactly on the selected budget's x tick (the axis
     *  is log-spaced, so the tick text is the only honest reference). */
    const cursorOffset = (budget) =>
      page.evaluate((b) => {
        const svgEl = document
          .querySelector("#fig-eff-readouts")
          ?.closest("figure")
          ?.querySelector("svg");
        const cursor = svgEl?.querySelector("line[data-cursor]");
        const tick = [...svgEl.querySelectorAll("text")].find(
          (n) => n.getAttribute("text-anchor") === "middle" && n.textContent.trim() === String(b),
        );
        if (!cursor) return "no data-cursor line in the chart";
        if (!tick) return `no x tick labeled ${b}`;
        return Number(cursor.getAttribute("x1")) - Number(tick.getAttribute("x"));
      }, budget);

    /** The expected lead/trail sentence, computed from the file the way the
     *  component computes it. The sign flip across budgets is the figure's
     *  finding, so it is asserted, not just displayed. */
    const expectGap = (i) => {
      const x0 = eff.models.x0diffusion[i].diceMean;
      const best = models
        .filter((m) => m !== "x0diffusion")
        .reduce((a, b) => (eff.models[a][i].diceMean >= eff.models[b][i].diceMean ? a : b));
      const delta = x0 - eff.models[best][i].diceMean;
      return {
        verb: delta >= 0 ? "leads" : "trails",
        name: EFF_LABELS[best],
        value: Math.abs(delta).toFixed(3),
      };
    };

    const assertStop = async (i) => {
      const { models: rows, gap } = await readReadouts();
      for (const m of models) {
        const p = eff.models[m][i];
        const want = `${p.diceMean.toFixed(3)} ±${p.diceStd.toFixed(3)}`;
        if (!rows[m]?.includes(want)) {
          throw new Error(`readout for ${m} at ${budgets[i]} labels is "${rows[m]}", want "${want}"`);
        }
        if (!rows[m].includes(EFF_LABELS[m])) {
          throw new Error(`readout for ${m} does not carry the label "${EFF_LABELS[m]}"`);
        }
      }
      const g = expectGap(i);
      if (!gap.includes(g.verb) || !gap.includes(g.name) || !gap.includes(g.value)) {
        throw new Error(
          `gap sentence at ${budgets[i]} labels is "${gap}", want ${g.verb} / ${g.name} / ${g.value}`,
        );
      }
      const off = await cursorOffset(budgets[i]);
      if (typeof off === "string") throw new Error(off);
      if (Math.abs(off) > 0.01) {
        throw new Error(`cursor is ${off} user units off the ${budgets[i]}-label tick`);
      }
      return g;
    };

    // 2. Default stop: the smallest budget, where the claim lives. x0 must
    //    LEAD here — if the file ever says otherwise the site's headline is
    //    in trouble, and this is where that surfaces.
    const g0 = await assertStop(0);
    if (g0.verb !== "leads") {
      throw new Error(`x0 does not lead at ${budgets[0]} labels — the headline claim broke`);
    }
    await waitPainted();
    const panelsBefore = await assertPanels(0);

    // 3. Pan to the largest budget: every readout, the whiskers and the
    //    sentence must follow, and the sentence must FLIP to trails (the
    //    crossover in the committed data).
    const whiskerXBefore = await svg
      .locator("g[data-whisker] line")
      .first()
      .getAttribute("x1");
    await setRange(slider, lastIdx);
    await page.waitForFunction(
      (want) => document.querySelector("#eff-labels")?.value === String(want),
      lastIdx,
      { timeout: 5000 },
    );
    const gLast = await assertStop(lastIdx);
    if (gLast.verb !== "trails") {
      throw new Error(
        `expected the trail flip at ${budgets[lastIdx]} labels (data says the baselines pass x0 there)`,
      );
    }
    const whiskerXAfter = await svg
      .locator("g[data-whisker] line")
      .first()
      .getAttribute("x1");
    if (whiskerXBefore === whiskerXAfter) {
      throw new Error("whiskers did not move with the slider");
    }

    // 4. The strip must follow the budget: every mask canvas whose FILE
    //    changes repaints, and every printed Dice becomes the last budget's.
    //    SAM's mask is the same deduped file at every budget (zero-shot; the
    //    pipeline's content dedupe makes "same file" mean "same pixels"), so
    //    its canvas must NOT change — asserted both ways. The crossover is
    //    pixel-visible here (ResNet noise at 16, caught up at 80) — asserted
    //    via the numbers, which are computed from those pixels.
    const sameFile = stripModels.map(
      (m) => eff.strip.budgets[0].masks[m].file === eff.strip.budgets[lastIdx].masks[m].file,
    );
    if (!sameFile.some(Boolean) || sameFile.every(Boolean)) {
      throw new Error(
        `expected a mix of per-budget and deduped strip masks, got sameFile=[${sameFile.join(",")}]`,
      );
    }
    await page.waitForFunction(
      ({ want, same }) =>
        [...document.querySelectorAll("#fig-eff-strip canvas")].every(
          (c, i) => (same[i] ? true : c.toDataURL() !== want[i]),
        ),
      { want: panelsBefore.slice(1).map((p) => p.url), same: sameFile },
      { timeout: 20000 },
    );
    const panelsAfter = await assertPanels(lastIdx);
    for (const [k, m] of stripModels.entries()) {
      const changed = panelsAfter[k + 1].url !== panelsBefore[k + 1].url;
      if (sameFile[k] && changed) {
        throw new Error(`strip panel ${m} repainted although its mask file never changed`);
      }
      if (!sameFile[k] && !changed) {
        throw new Error(`strip panel ${m} did not repaint at ${budgets[lastIdx]} labels`);
      }
    }

    return (
      `${models.length} series; at ${budgets[0]} labels x0 ${g0.verb} ${g0.name} by ${g0.value}; ` +
      `at ${budgets[lastIdx]} x0 ${gLast.verb} ${gLast.name} by ${gLast.value}; ` +
      `readouts match label_efficiency.json at both stops; cursor exact; whiskers track the slider; ` +
      `strip image ${eff.strip.image}: ` +
      stripModels
        .map(
          (m) =>
            `${m} ${eff.strip.budgets[0].masks[m].dice.toFixed(3)} -> ${eff.strip.budgets[lastIdx].masks[m].dice.toFixed(3)}`,
        )
        .join(", ") +
      `, panels repainted`
    );
  });
}

/* ---------------------------------------------------------------------- */
/* 5. Flight video plays in view, pauses out of view                      */
/* (Figure 3, components/figures/FlightFigure.tsx — the only <video> on   */
/* the page)                                                              */
/* ---------------------------------------------------------------------- */

async function checkFlightVideoPlayPause(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const video = page.locator("video").first();
    await video.waitFor({ state: "attached", timeout: 10000 });
    await video.scrollIntoViewIfNeeded();

    await page.waitForFunction(
      () => document.querySelector("video")?.paused === false,
      null,
      { timeout: 15000 },
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () => document.querySelector("video")?.paused === true,
      null,
      { timeout: 10000 },
    );
    return "playing() while >=40% in view, paused() after scrolling back to top";
  });
}

/* ---------------------------------------------------------------------- */
/* 6. Draw one stroke on Figure 4's canvas -> auto-label appears          */
/* (components/DrawDigit.tsx — downloads the 26MB ONNX model and runs it) */
/* ---------------------------------------------------------------------- */

async function checkDrawAutoLabel(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#fig-draw");

    const canvas = page.locator("#fig-draw canvas").first();
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    // scrollUntilAttached stops as soon as DeferredMount's 200px rootMargin
    // fires, which can be well before the canvas is actually inside the
    // viewport — page.mouse works in viewport coordinates, so a bounding box
    // that is technically "attached" but below the fold gets clicks on thin
    // air. Center it first.
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("drawing canvas has no bounding box");
    const cx = box.x + box.width * 0.35;
    const cy = box.y + box.height * 0.35;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + box.width * 0.3, cy + box.height * 0.3, { steps: 8 });
    await page.mouse.up();

    // Model load (~26MB, headless-slow) + the 450ms debounce + a zero-shot
    // classify (10 forward passes). Generous on purpose.
    await page.waitForFunction(
      () => !!document.querySelector('#fig-draw button[aria-label*="fits your drawing"]'),
      null,
      { timeout: 120000 },
    );
    return "digit picker shows fit scores after one stroke (classifier ran)";
  });
}

/* ---------------------------------------------------------------------- */
/* 7. Chess hint at startpos: g3, p=0.236                                 */
/* (components/ChessPanel.tsx, validation vector D)                       */
/* ---------------------------------------------------------------------- */

async function checkChessHint(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#fig-chess");

    const hintBtn = page.locator("#fig-chess").getByRole("button", { name: "hint", exact: true });
    await hintBtn.waitFor({ state: "attached", timeout: 10000 });

    // Ready once the 553KB int8 model + the ~24MB wasm runtime have loaded.
    await page.waitForFunction(
      () => {
        const btn = [...document.querySelectorAll("#fig-chess button")].find(
          (b) => b.textContent.trim() === "hint",
        );
        return !!btn && !btn.disabled;
      },
      null,
      { timeout: 90000 },
    );

    await hintBtn.click();

    await page.waitForFunction(
      () => document.querySelector("#fig-chess")?.innerText.includes("p=0.236"),
      null,
      { timeout: 20000 },
    );
    const text = await page.locator("#fig-chess").innerText();
    if (!/it would play g3\b/.test(text)) {
      throw new Error(`expected "it would play g3" in hint text, got: ${text.slice(0, 300)}`);
    }
    return "hint returned g3, p=0.236 (matches validation vector D)";
  });
}

/* ---------------------------------------------------------------------- */
/* 8. JEPA: seed query 834 (MAE 0/8, I-JEPA 8/8) + triple-equality on a    */
/* mixed query (red borders == red labels == cross marks)                 */
/* (components/JepaPanel.tsx, /lab)                                       */
/* ---------------------------------------------------------------------- */

/** Count the three carriers of "this neighbour's class differs from the
 *  query's" within #jepa. They are all derived from the same `differs`
 *  boolean in JepaPanel.tsx, so any mismatch means something (a stray hover
 *  style, a missed className) is overriding one of them independently. */
async function jepaMarkCounts(page) {
  return page.locator("#jepa").evaluate((el) => ({
    redBorders: el.querySelectorAll(".border-red-ink").length,
    redLabels: el.querySelectorAll("figcaption.text-red-ink").length,
    crosses: Array.from(el.querySelectorAll('figcaption span[aria-hidden="true"]')).filter((s) =>
      s.textContent.includes("✕"),
    ).length,
  }));
}

async function checkJepaSeedQuery834(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#jepa");
    // Manifest (483KB) + sprite atlas (3.6MB) have to land before there's
    // anything to read; "ship" is seed query 834's true class.
    await page.waitForFunction(
      () => document.querySelector("#jepa")?.innerText.includes("ship"),
      null,
      { timeout: 30000 },
    );

    const readouts = await page.locator("#jepa span.ml-auto.text-mut").allTextContents();
    if (readouts.length !== 2) {
      throw new Error(`expected 2 "n/8 same class" readouts, found ${readouts.length}: ${readouts.join(" | ")}`);
    }
    const [maeReadout, jepaReadout] = readouts.map((s) => s.trim());
    if (!maeReadout.startsWith("0/8")) throw new Error(`MAE readout expected 0/8, got "${maeReadout}"`);
    if (!jepaReadout.startsWith("8/8")) throw new Error(`I-JEPA readout expected 8/8, got "${jepaReadout}"`);

    const baseline = await jepaMarkCounts(page);
    if (baseline.redBorders !== baseline.redLabels || baseline.redLabels !== baseline.crosses) {
      throw new Error(
        `triple-equality broken at default query 834: borders=${baseline.redBorders} labels=${baseline.redLabels} crosses=${baseline.crosses}`,
      );
    }

    return `MAE "${maeReadout}", I-JEPA "${jepaReadout}", marks agree (${baseline.redBorders})`;
  });
}

async function checkJepaTripleEqualityOnMixedQuery(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#jepa");
    await page.waitForFunction(
      () => document.querySelector("#jepa")?.innerText.includes("ship"),
      null,
      { timeout: 30000 },
    );

    // Seed query index 1 (image 1517, "deer") is genuinely mixed in both
    // blocks: MAE 0/8, I-JEPA 7/8 — unlike the 834 default, where I-JEPA's
    // block is a clean 8/8 with nothing to mark. Preset thumbnails are the
    // first `n` "Set as query" buttons in DOM order (before either
    // neighbour block), so index 1 is the second preset.
    const presetButtons = page.locator('#jepa button[aria-label$="Set as query."]');
    await presetButtons.nth(1).click();
    await page.waitForFunction(
      () => document.querySelector("#jepa")?.innerText.includes("deer"),
      null,
      { timeout: 10000 },
    );

    const counts = await jepaMarkCounts(page);
    if (counts.redBorders === 0) {
      throw new Error("expected a mixed query to have at least one red-bordered neighbour");
    }
    if (counts.redBorders !== counts.redLabels || counts.redLabels !== counts.crosses) {
      throw new Error(
        `triple-equality broken on mixed query: borders=${counts.redBorders} labels=${counts.redLabels} crosses=${counts.crosses}`,
      );
    }
    return `mixed query: borders=${counts.redBorders} labels=${counts.redLabels} crosses=${counts.crosses}, all equal`;
  });
}

/* ---------------------------------------------------------------------- */
/* 9. Headshot toy: nothing fetched at rest, then it really samples HIS    */
/* photo (components/figures/HeadshotToy.tsx, lib/headshot-model.ts)      */
/* ---------------------------------------------------------------------- */

/**
 * Mean absolute per-channel difference between the sampled canvas and the
 * target photo, both downscaled to 32x32 in the page.
 *
 * ⚠️ THE THRESHOLD IS CALIBRATED, NOT GUESSED, and the control comparison is
 * what makes this a proof rather than a smoke test. Measured against a real
 * production build in headless Firefox: the class-0 sample lands at **6.17**
 * against its own photo (the bundle's per-photo PSNR for that class is 29.3
 * dB), while the same sample against the OTHER two photos measures 63.24 and
 * 89.68. So 20 sits ~3x above the real value and ~3x below the nearest wrong
 * answer: a sampler that ran the wrong class, a display mapping that inverted,
 * or a canned animation could not pass it. Fresh noise every press moves the
 * observed number by only a unit or two.
 *
 * ⚠️ This check runs at a 400px viewport, so the loader's device budget hands
 * it the 128 FALLBACK family — which is what those numbers were calibrated
 * against, and is deliberate: the phone path is the one most likely to break.
 * (Re-measured 2026-09-12 on the v2 bundle's re-encoded photos, display
 * position 1 = class 2: own 13.06 vs 90.20 / 87.50.)
 * The 256 primary is exercised separately (a node run against the served
 * graph); if this check is ever widened to a desktop viewport, recalibrate,
 * because the 256's per-photo PSNRs are 21.0 / 27.4 / 18.0 dB.
 */
const HEADSHOT_MAD_MAX = 20;

async function checkHeadshotSamplesPhoto(browser) {
  return withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    const urls = [];
    /** GETs only. The loader HEAD-probes BOTH families before choosing one, so
     *  a bare URL list would report a probe rather than the download. */
    const gets = [];
    page.on("request", (req) => {
      urls.push(req.url());
      if (req.method() === "GET") gets.push(req.url());
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // catch an idle callback that might still fire

    // At rest the masthead is a plain <img>. The toy sits in first paint, so a
    // model fetch here would put ~24MB of runtime on the critical path. Any
    // method counts: even a probe at rest would mean the loader ran.
    const early = urls.filter((u) => /\/headshot\/.*\.onnx/.test(u));
    if (early.length) {
      throw new Error(`model fetched at rest: ${early.join(", ")}`);
    }

    const face = page.locator('#headshot-toy button[aria-label^="Sample photo 1"]');
    await face.waitFor({ state: "visible", timeout: 10000 });
    // "Sample photo 1" is a DISPLAY position, not a class index — the photos
    // are presented in whatever order the server component chose (currently
    // reversed). The class this button actually samples is read off its own
    // thumbnail, so a presentation reorder can never silently break the check.
    const thumbSrc = await face.locator("img").getAttribute("src");
    const cls = Number(/photos\/(\d+)_thumb/.exec(thumbSrc ?? "")?.[1] ?? NaN);
    if (!Number.isInteger(cls)) {
      throw new Error(`could not derive the class index from the face button (src ${thumbSrc})`);
    }
    // The full-size photo URL is DERIVED from the thumb the page is actually
    // serving, never spelled out here: the bundle's directory is versioned
    // (/headshot/v2/ today, because those files are immutable for a year), and
    // a hardcoded prefix would have this check comparing the canvas against a
    // 404 the day that moves.
    const photoUrl = (i) => thumbSrc.replace(/\d+_thumb\.webp$/, `${i}.webp`);

    /**
     * Watch the readout's step counter for the duration of a press and keep the
     * largest `n` it reported.
     *
     * ⚠️ THIS IS THE STRUCTURAL EVIDENCE FOR THE MORPH. The "morphed from the
     * last sample" wording is the site's own boolean talking about itself: a
     * stale re-vendor with a forgotten `MODULE_SUPPORTS_TRANSITIONS` flip would
     * run a full from-noise sample and still print it. The step TOTAL comes
     * from the module (`onFrame`'s `total`), and transition mode filters the
     * schedule down (~14 of 25 at the default strength), so a second press with
     * a smaller total is proof the init branch actually ran.
     *
     * A MutationObserver rather than polling: the counter ticks once per model
     * step and an interval sampler could miss the run entirely on a fast
     * machine. Installed BEFORE the click, read after the run settles.
     */
    const watchSteps = () =>
      page.evaluate(() => {
        const status = document.querySelector("#headshot-toy [role=status]");
        const p = status?.parentElement;
        if (!p) throw new Error("readout paragraph not found");
        window.__hsTotals = [];
        const read = () => {
          const m = /(\d+)\s*\/\s*(\d+)/.exec(p.textContent ?? "");
          if (m) window.__hsTotals.push(Number(m[2]));
        };
        window.__hsObs?.disconnect();
        window.__hsObs = new MutationObserver(read);
        window.__hsObs.observe(p, { childList: true, characterData: true, subtree: true });
        read();
      });
    const maxTotal = () =>
      page.evaluate(() => (window.__hsTotals.length ? Math.max(...window.__hsTotals) : 0));

    await face.scrollIntoViewIfNeeded();
    await watchSteps();
    await face.click();

    // First press pulls onnxruntime-web + this device's graph and then runs the
    // meta's full step count. Measured end to end here at ~15s; budget 5
    // minutes, because headless Firefox is ~20x slower than a real browser
    // (CLAUDE.md).
    await page.waitForFunction(
      () =>
        /sampled from noise|morphed from the last sample/.test(
          document.querySelector("#headshot-toy [role=status]")?.textContent ?? "",
        ),
      null,
      { timeout: 300000 },
    );
    const readout = (await page.locator("#headshot-toy [role=status]").textContent()).trim();
    // The FIRST press can only be from-noise: there is no previous sample to
    // morph out of, so "morphed" here would be the readout lying outright.
    if (!/sampled from noise/.test(readout)) {
      throw new Error(`first press should report a from-noise sample, got: ${readout}`);
    }
    const steps1 = await maxTotal();
    if (steps1 < 2) throw new Error(`first press reported ${steps1} steps`);

    // A GET of one of the shipped graphs is what proves a model ran at all.
    // Path-agnostic: which family this device got (256 primary or 128 fallback)
    // is a runtime budget decision, so the NAME is read off the wire and then
    // checked against the readout's build label.
    const graphs = gets.filter((u) => /\/headshot\/.*\.onnx/.test(u));
    if (graphs.length === 0) {
      throw new Error("run completed without ever requesting a model file");
    }
    const graph = graphs[graphs.length - 1].split("/").pop();
    /**
     * "The label never lies", tested in the browser rather than trusted.
     *
     * The readout prints `build`, which the loader sets beside whichever
     * session it actually created — including after an int8→fp32 or 256→128
     * fallback. The only way to catch a label that stopped tracking the graph
     * is to compare it against the file the network actually fetched.
     */
    const EXPECTED_GRAPH = {
      "256": "headshot256.onnx",
      "128 int8": "headshot128_int8.onnx",
      "128": "headshot128.onnx",
    };
    const label = Object.keys(EXPECTED_GRAPH).find((b) => readout.endsWith(`· ${b}`));
    if (!label) {
      throw new Error(`readout carries no known build label: ${readout}`);
    }
    if (graph !== EXPECTED_GRAPH[label]) {
      throw new Error(`readout says "${label}" but the browser fetched ${graph}`);
    }

    const { mad, controls } = await page.evaluate(async ({ own, others }) => {
      const N = 32;
      // Downscale both through the same 2D path, so any resampling the browser
      // does applies equally to the sample and to the target.
      const shrink = (src) => {
        const c = document.createElement("canvas");
        c.width = N;
        c.height = N;
        const g = c.getContext("2d");
        g.drawImage(src, 0, 0, N, N);
        return g.getImageData(0, 0, N, N).data;
      };
      const meanAbs = (a, b) => {
        let sum = 0;
        let n = 0;
        for (let i = 0; i < a.length; i += 4) {
          for (let k = 0; k < 3; k++) {
            sum += Math.abs(a[i + k] - b[i + k]);
            n++;
          }
        }
        return sum / n;
      };
      const load = async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return shrink(img);
      };
      const sample = shrink(document.querySelector("#headshot-toy canvas"));
      const target = await load(own);
      const controls = [];
      for (const url of others) {
        controls.push(meanAbs(sample, await load(url)));
      }
      return { mad: meanAbs(sample, target), controls };
    }, { own: photoUrl(cls), others: [0, 1, 2].filter((i) => i !== cls).map(photoUrl) });

    if (mad > HEADSHOT_MAD_MAX) {
      throw new Error(
        `sampled canvas is ${mad.toFixed(2)} mean abs off photo ${cls} at 32x32 (limit ${HEADSHOT_MAD_MAX})`,
      );
    }
    // The sample must be closer to its own class than to either other photo,
    // or "it reconstructed a face" would be passing for "it reconstructed HIS
    // face, the one the button asked for".
    if (!controls.every((c) => c > mad)) {
      throw new Error(
        `sample is not closest to its own class: own ${mad.toFixed(2)} vs ${controls.map((c) => c.toFixed(2)).join(", ")}`,
      );
    }

    // Second press, different face: the new class must win on the canvas, and
    // the run must really be a TRANSITION. Two assertions, and only the second
    // is evidence:
    //   - the readout says "morphed", which is the site agreeing with itself;
    //   - the module's own step total drops (~14 of 25), which no from-noise
    //     run can fake. A stale vendored module with a forgotten capability
    //     flip would pass the first and fail the second, which is exactly the
    //     silent regression worth catching.
    const face2 = page.locator('#headshot-toy button[aria-label^="Sample photo 2"]');
    const thumb2 = await face2.locator("img").getAttribute("src");
    const cls2 = Number(/photos\/(\d+)_thumb/.exec(thumb2 ?? "")?.[1] ?? NaN);
    const photoUrl2 = (i) => thumb2.replace(/\d+_thumb\.webp$/, `${i}.webp`);
    if (!Number.isInteger(cls2) || cls2 === cls) {
      throw new Error(`could not derive a distinct second class (got ${cls2} vs ${cls})`);
    }
    await watchSteps();
    await face2.click();
    // The step counter lives in a separate aria-hidden span, so [role=status]
    // itself is empty for the whole run and its terminal text is unambiguous.
    await page.waitForFunction(
      () =>
        /sampled from noise|morphed from the last sample/.test(
          document.querySelector("#headshot-toy [role=status]")?.textContent ?? "",
        ),
      null,
      { timeout: 300000 },
    );
    // Small settle: the terminal readout lands in the same commit as the final
    // paint, but give the canvas one frame anyway.
    await page.waitForTimeout(200);
    const readout2 = (await page.locator("#headshot-toy [role=status]").textContent()).trim();
    if (!/morphed from the last sample/.test(readout2)) {
      throw new Error(`second press did not morph: "${readout2}"`);
    }
    // The structural half: the module ran fewer steps than a full descent.
    const steps2 = await maxTotal();
    if (!(steps2 > 0 && steps2 < steps1)) {
      throw new Error(
        `second press ran ${steps2} steps against the first press's ${steps1}: a transition runs a strict subset of the schedule, so this was a from-noise run wearing a morph label`,
      );
    }
    const second = await page.evaluate(async ({ own, others }) => {
      const N = 32;
      const shrink = (src) => {
        const c = document.createElement("canvas");
        c.width = N; c.height = N;
        const g = c.getContext("2d");
        g.drawImage(src, 0, 0, N, N);
        return g.getImageData(0, 0, N, N).data;
      };
      const meanAbs = (a, b) => {
        let sum = 0, n = 0;
        for (let i = 0; i < a.length; i += 4)
          for (let k = 0; k < 3; k++) { sum += Math.abs(a[i + k] - b[i + k]); n++; }
        return sum / n;
      };
      const load = async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return shrink(img);
      };
      const sample = shrink(document.querySelector("#headshot-toy canvas"));
      const target = await load(own);
      const controls = [];
      for (const url of others) {
        controls.push(meanAbs(sample, await load(url)));
      }
      return { mad: meanAbs(sample, target), controls };
    }, { own: photoUrl2(cls2), others: [0, 1, 2].filter((i) => i !== cls2).map(photoUrl2) });
    if (second.mad > HEADSHOT_MAD_MAX) {
      throw new Error(
        `after second press, canvas is ${second.mad.toFixed(2)} off photo ${cls2} (limit ${HEADSHOT_MAD_MAX})`,
      );
    }
    if (!second.controls.every((c) => c > second.mad)) {
      throw new Error(
        `second press not closest to its own class: own ${second.mad.toFixed(2)} vs ${second.controls.map((c) => c.toFixed(2)).join(", ")}`,
      );
    }

    // Analytics: two COMPLETED runs must queue exactly ONE demo_used event
    // (once per demo per page load, lib/track.ts). Off Vercel the tracker
    // script 404s, so window.vaq holds every call it would have sent.
    const headshotEvents = await page.evaluate(
      () =>
        (window.vaq ?? []).filter(
          ([kind, ev]) => kind === "event" && ev?.name === "demo_used" && ev?.data?.demo === "headshot",
        ).length,
    );
    if (headshotEvents !== 1) {
      throw new Error(`expected exactly 1 demo_used{headshot} after two completed runs, queued ${headshotEvents}`);
    }

    return `no model at rest; "${readout}" matches the fetched ${graph}; ${steps1} steps, MAD own ${mad.toFixed(2)} vs others ${controls.map((c) => c.toFixed(2)).join(", ")}; 2nd press ("${readout2}") ran ${steps2} of ${steps1} steps, MAD own ${second.mad.toFixed(2)} vs ${second.controls.map((c) => c.toFixed(2)).join(", ")}; demo_used{headshot} queued once`;
  });
}

/* ---------------------------------------------------------------------- */
/* 12. Figure 2's Dice CDF                                                 */
/* (components/figures/DiceCdfFigure.tsx + public/research/cdf.json)       */
/* ---------------------------------------------------------------------- */

/**
 * The figure makes three claims that can be checked from outside: the paper's
 * three curves are really drawn, the share readouts are the numbers the script
 * computed, and the slider moves the strip rather than just relabeling it.
 *
 * Sampling each mask canvas's dataURL before and after the move is what
 * separates "the labels changed" from "the masks changed". A slider that only
 * rewrote text would pass a text-only assertion, and that is exactly the
 * wired-to-nothing control the house rules forbid.
 */
async function checkDiceCdf(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 1600 } }, async (page) => {
    const cdf = await (await fetch(`${BASE}/research/cdf.json`)).json();
    const models = cdf.models;
    const defaultIdx = cdf.stops.findIndex((s) => s.t === 0.3);
    if (defaultIdx < 0) throw new Error("cdf.json has no 0.3 stop to default to");
    const otherIdx = cdf.stops.findIndex((s) => s.t === 0.8);
    if (otherIdx < 0) throw new Error("cdf.json has no 0.8 stop to pan to");
    const fmtShare = (s) => `${(s * 100).toFixed(s >= 0.1 ? 1 : 2)}%`;

    await page.goto(BASE, { waitUntil: "networkidle" });
    const strip = page.locator("#fig-cdf-strip");
    await strip.waitFor({ state: "visible", timeout: 10000 });
    await strip.scrollIntoViewIfNeeded();
    const slider = page.locator("#cdf-dice");
    await slider.waitFor({ state: "attached", timeout: 10000 });

    if ((await slider.inputValue()) !== String(defaultIdx)) {
      throw new Error(
        `slider does not default to the 0.3 stop (index ${defaultIdx}); got ${await slider.inputValue()}`,
      );
    }

    // 1. Three curve paths, one per model, each with a real polyline.
    const curveInfo = await page.evaluate(() => {
      const svg = document.querySelector("#fig-cdf-strip")?.closest("figure")?.querySelector("svg");
      if (!svg) return null;
      return [...svg.querySelectorAll("polyline")].map((p) => ({
        stroke: p.getAttribute("stroke"),
        dash: p.getAttribute("stroke-dasharray"),
        pts: (p.getAttribute("points") || "").trim().split(/\s+/).length,
      }));
    });
    if (!curveInfo) throw new Error("no chart svg in Figure 2");
    if (curveInfo.length !== models.length) {
      throw new Error(`expected ${models.length} curve polylines, found ${curveInfo.length}`);
    }
    for (const [i, c] of curveInfo.entries()) {
      if (c.pts < 20) throw new Error(`curve ${i} has only ${c.pts} points`);
    }
    // One solid, one dashed, one dotted: the paper's own encoding, and the
    // carrier that survives both colors being indistinguishable.
    const solid = curveInfo.filter((c) => !c.dash).length;
    if (solid !== 1) throw new Error(`expected exactly 1 solid curve, found ${solid}`);
    const dashes = new Set(curveInfo.filter((c) => c.dash).map((c) => c.dash));
    if (dashes.size !== 2) {
      throw new Error(`the two non-solid curves share a dash pattern: ${[...dashes].join(" | ")}`);
    }
    const strokes = new Set(curveInfo.map((c) => c.stroke));
    if (strokes.size !== 3) {
      throw new Error(`curves do not have 3 distinct colors: ${[...strokes].join(", ")}`);
    }

    // 2. The readouts at the default stop must be cdf.json's numbers.
    const readShares = () =>
      page.evaluate(
        (keys) =>
          Object.fromEntries(
            keys.map((k) => [
              k,
              document
                .querySelector(`#fig-cdf-readouts [data-model="${k}"]`)
                ?.textContent.trim()
                .replace(/\s+/g, " ") ?? null,
            ]),
          ),
        models,
      );

    const shares = await readShares();
    for (const m of models) {
      const want = fmtShare(cdf.stops[defaultIdx].shares[m]);
      if (shares[m] === null) throw new Error(`no readout for ${m}`);
      if (!shares[m].includes(want)) {
        throw new Error(`readout for ${m} is "${shares[m]}", want share ${want}`);
      }
    }

    // 3. Panels: labeled, and carrying the Dice cdf.json computed for the mask
    //    each one paints. Wait for every mask to have painted first (a fully
    //    transparent canvas is the pre-paint state).
    const readPanels = async () =>
      strip.evaluate((el) =>
        [...el.children].map((panel) => ({
          text: panel.textContent.trim().replace(/\s+/g, " "),
          src: panel.querySelector("img").getAttribute("src"),
          url: panel.querySelector("canvas")?.toDataURL() ?? null,
        })),
      );

    await page.waitForFunction(
      (n) => {
        const el = document.querySelector("#fig-cdf-strip");
        const canvases = [...document.querySelectorAll("#fig-cdf-strip canvas")];
        if (!el || el.children.length !== n + 1 || canvases.length !== n) return false;
        return canvases.every((c) => {
          const g = c.getContext("2d");
          if (!c.width || !c.height) return false;
          const px = g.getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < px.length; i += 4) if (px[i] > 0) return true;
          return false;
        });
      },
      models.length,
      { timeout: 20000 },
    );

    const before = await readPanels();
    const wantAngio = `/research/${cdf.stops[defaultIdx].angio}`;
    if (before[0].src !== wantAngio) {
      throw new Error(`base panel shows ${before[0].src}, want ${wantAngio}`);
    }
    for (const [i, m] of models.entries()) {
      const panel = before[i + 1];
      const want = cdf.stops[defaultIdx].masks[m].dice.toFixed(3);
      if (!panel.text.includes(want)) {
        throw new Error(`panel ${m} shows "${panel.text}", want Dice ${want}`);
      }
    }

    // 4. Moving the slider must swap the angiogram, repaint every mask and
    //    update every number.
    await setRange(slider, otherIdx);
    await page.waitForFunction(
      (want) => document.querySelector("#cdf-dice")?.value === String(want),
      otherIdx,
      { timeout: 5000 },
    );
    await page.waitForFunction(
      (want) =>
        [...document.querySelectorAll("#fig-cdf-strip canvas")].every(
          (c, i) => c.toDataURL() !== want[i],
        ),
      before.slice(1).map((p) => p.url),
      { timeout: 20000 },
    );

    const after = await readPanels();
    const wantAngioAfter = `/research/${cdf.stops[otherIdx].angio}`;
    if (after[0].src !== wantAngioAfter) {
      throw new Error(`base panel still shows ${after[0].src}, want ${wantAngioAfter}`);
    }
    if (after[0].src === before[0].src) throw new Error("the angiogram did not change");
    for (const [i, m] of models.entries()) {
      const want = cdf.stops[otherIdx].masks[m].dice.toFixed(3);
      if (!after[i + 1].text.includes(want)) {
        throw new Error(`panel ${m} shows "${after[i + 1].text}", want Dice ${want}`);
      }
      if (after[i + 1].url === before[i + 1].url) {
        throw new Error(`panel ${m} canvas did not repaint at the ${cdf.stops[otherIdx].t} stop`);
      }
    }
    const sharesAfter = await readShares();
    for (const m of models) {
      const want = fmtShare(cdf.stops[otherIdx].shares[m]);
      if (!sharesAfter[m].includes(want)) {
        throw new Error(`readout for ${m} is "${sharesAfter[m]}", want share ${want}`);
      }
    }

    // 5. The cursor must land exactly on the threshold it claims, at every
    //    stop. The x axis is linear over [0, 1], so this is checkable in user
    //    units against the axis geometry the ticks define.
    const offsets = [];
    for (let i = 0; i < cdf.stops.length; i++) {
      await setRange(slider, i);
      await page.waitForFunction(
        (want) => document.querySelector("#cdf-dice")?.value === String(want),
        i,
        { timeout: 5000 },
      );
      const off = await page.evaluate((t) => {
        const svg = document.querySelector("#fig-cdf-strip")?.closest("figure")?.querySelector("svg");
        const cursor = [...svg.querySelectorAll("line[stroke-dasharray]")].find(
          (l) => l.getAttribute("stroke") === "var(--color-link)",
        );
        const ticks = [...svg.querySelectorAll("text")].filter(
          (n) => n.getAttribute("text-anchor") === "middle" && /^[01]\.\d$/.test(n.textContent.trim()),
        );
        const zero = ticks.find((n) => n.textContent.trim() === "0.0");
        const one = ticks.find((n) => n.textContent.trim() === "1.0");
        if (!cursor) return "no cursor line in the chart";
        if (!zero || !one) return "no 0.0/1.0 x ticks to read the axis off";
        const x0 = Number(zero.getAttribute("x"));
        const x1 = Number(one.getAttribute("x"));
        return Number(cursor.getAttribute("x1")) - (x0 + t * (x1 - x0));
      }, cdf.stops[i].t);
      if (typeof off === "string") throw new Error(off);
      if (Math.abs(off) > 0.01) {
        throw new Error(`cursor is ${off} user units off Dice ${cdf.stops[i].t}`);
      }
      offsets.push(off);
    }

    return (
      `3 curves (1 solid, 2 dash patterns, 3 colors); stop ${cdf.stops[defaultIdx].t} image ` +
      `${cdf.stops[defaultIdx].image} ` +
      models.map((m) => cdf.stops[defaultIdx].masks[m].dice.toFixed(3)).join("/") +
      ` -> stop ${cdf.stops[otherIdx].t} image ${cdf.stops[otherIdx].image} ` +
      models.map((m) => cdf.stops[otherIdx].masks[m].dice.toFixed(3)).join("/") +
      `; angiogram swapped, all ${models.length} canvases repainted; shares match cdf.json; ` +
      `cursor exact at all ${offsets.length} stops`
    );
  });
}

/* ---------------------------------------------------------------------- */
/* 13. Vercel Web Analytics (app/layout.tsx + lib/track.ts)                */
/* ---------------------------------------------------------------------- */

/**
 * What can be proven locally, and what can't. The tracker loads from
 * /_vercel/insights/script.js, which only Vercel serves, so on this prod
 * build it 404s and never drains `window.vaq` — the queue therefore holds
 * exactly what production would send. This asserts: the script tag is
 * injected at the same-origin path (anything cross-origin would be blocked
 * by the site's COEP header), and a click on the Resume link queues an
 * outbound_link event carrying its label. Delivery itself is only visible in
 * the Vercel dashboard. (demo_used is asserted inside the headshot check,
 * which already pays for two real model runs.)
 */
async function checkAnalyticsQueue(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => document.querySelector('script[src*="/_vercel/insights/script.js"]') !== null,
      null,
      { timeout: 10000 },
    );
    const src = await page.evaluate(
      () => document.querySelector('script[src*="_vercel/insights"]').getAttribute("src"),
    );
    if (!src.startsWith("/")) throw new Error(`tracker script is not same-origin: ${src}`);

    const resume = page.locator('a[data-track-label="Resume"]').first();
    await resume.waitFor({ state: "attached", timeout: 10000 });
    // Keep the click from navigating to Drive: a capture-phase preventDefault
    // stops the navigation without stopping React's onClick, which is what's
    // under test.
    await page.evaluate(() => document.addEventListener("click", (e) => e.preventDefault(), true));
    await resume.click();

    const events = await page.evaluate(() =>
      (window.vaq ?? []).filter(([kind]) => kind === "event").map(([, ev]) => ev),
    );
    const hit = events.find((ev) => ev?.name === "outbound_link" && ev?.data?.label === "Resume");
    if (!hit) {
      throw new Error(`no outbound_link{Resume} queued; queue holds ${JSON.stringify(events)}`);
    }
    return `tracker injected at ${src}; Resume click queued outbound_link{label: "Resume"}`;
  });
}

/* ---------------------------------------------------------------------- */
/* Stargaze mode (lib/stargaze.ts, components/manuscript/StargazeToggle)  */
/* ---------------------------------------------------------------------- */

const STARGAZE_ENTER = "stargaze for a bit?";
const STARGAZE_EXIT = "back to the page";

/** The toggle stamps data-ready in its mount effect: clicking the
 *  server-rendered button before hydration would do nothing. */
async function waitStargazeReady(page) {
  await page.waitForSelector("[data-stargaze-toggle][data-ready]", { state: "attached", timeout: 15000 });
}

function stargazeEventCount(page) {
  return page.evaluate(
    () =>
      (window.vaq ?? []).filter(
        ([kind, ev]) => kind === "event" && ev?.name === "demo_used" && ev?.data?.demo === "stargaze",
      ).length,
  );
}

async function checkStargazeHidesPage(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    const enter = page.getByRole("button", { name: STARGAZE_ENTER });

    await enter.click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForTimeout(600); // the 400ms fade has to have finished: elapsed time is the assertion
    const on = await page.evaluate(() => ({
      inert: [...document.querySelectorAll("main")].every((m) => m.inert),
      visibility: getComputedStyle(document.querySelector("main")).visibility,
      overflow: getComputedStyle(document.documentElement).overflow,
      focused: document.activeElement?.textContent?.trim(),
    }));
    if (!on.inert) throw new Error("main is not inert while stargazing");
    if (on.visibility !== "hidden") throw new Error(`main visibility is ${on.visibility}`);
    if (on.overflow !== "hidden") throw new Error(`page still scrolls (html overflow ${on.overflow})`);
    if (on.focused !== STARGAZE_EXIT) throw new Error(`focus is on "${on.focused}", not the exit control`);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const off = await page.evaluate(() => ({
      inert: [...document.querySelectorAll("main")].some((m) => m.inert),
      focused: document.activeElement?.textContent?.trim(),
    }));
    if (off.inert) throw new Error("main stayed inert after Escape");
    if (off.focused !== STARGAZE_ENTER) throw new Error(`focus returned to "${off.focused}"`);

    // A second visit must not count twice.
    await enter.click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.getByRole("button", { name: STARGAZE_EXIT }).click();
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const n = await stargazeEventCount(page);
    if (n !== 1) throw new Error(`demo_used{stargaze} queued ${n} times across two visits, expected 1`);
    return "page hidden + inert + scroll-locked, focus moved both ways, Escape exits, demo_used{stargaze} once";
  });
}

async function checkStargazeNoFetch(browser) {
  // 400px: below lib/warm.ts's 768px gate, so any heavy request after the
  // click can only have come from entering stargaze.
  return withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    const urls = [];
    page.on("request", (req) => urls.push(req.url()));
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForTimeout(3000); // anything stargaze might start has had time to start
    const heavy = urls.filter((u) => HEAVY_RE.test(u));
    if (heavy.length) throw new Error(`heavy request(s) after entering stargaze: ${heavy.join(", ")}`);
    return `${urls.length} requests after entering, none model-sized`;
  });
}

/** Counts constructed and terminated Workers. Installed before any page
 *  script runs, so the chess engine's worker is constructed through it. */
function workerSpy() {
  const Real = window.Worker;
  window.__workers = [];
  window.Worker = class extends Real {
    constructor(...args) {
      super(...args);
      this.__terminated = false;
      window.__workers.push(this);
    }
    terminate() {
      this.__terminated = true;
      super.terminate();
    }
  };
}

async function waitChessHintEnabled(page) {
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("#fig-chess button")].find((b) => b.textContent.trim() === "hint");
      return !!btn && !btn.disabled;
    },
    null,
    { timeout: 90000 },
  );
}

async function checkStargazeOffloadChess(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.addInitScript(workerSpy);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#fig-chess");
    await waitChessHintEnabled(page);
    const before = await page.evaluate(() => window.__workers.length);
    if (before < 1) throw new Error("no Worker was constructed for the chess engine");

    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => (window.__offload?.chess ?? 0) >= 1, null, { timeout: 15000 });
    const terminated = await page.evaluate(() => window.__workers.filter((w) => w.__terminated).length);
    if (terminated < 1) throw new Error("stargaze reported a chess offload but no worker was terminated");

    await page.keyboard.press("Escape");
    await waitChessHintEnabled(page);
    const after = await page.evaluate(() => window.__workers.length);
    if (after <= before) throw new Error("the hint re-enabled without a new worker: the engine never really reloaded");

    await page.locator("#fig-chess").getByRole("button", { name: "hint", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#fig-chess")?.innerText.includes("p=0.236"),
      null,
      { timeout: 20000 },
    );
    return `worker terminated on entry; new worker on return (${before} -> ${after}); hint again g3 p=0.236`;
  });
}

async function drawStroke(page) {
  const canvas = page.locator("#fig-draw canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 10000 });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("drawing canvas has no bounding box");
  const cx = box.x + box.width * 0.35;
  const cy = box.y + box.height * 0.35;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.3, cy + box.height * 0.3, { steps: 8 });
  await page.mouse.up();
}

async function waitDrawFits(page) {
  await page.waitForFunction(
    () => !!document.querySelector('#fig-draw button[aria-label*="fits your drawing"]'),
    null,
    { timeout: 120000 },
  );
}

function demoEvents(page, demo) {
  return page.evaluate(
    (demo) =>
      (window.vaq ?? []).filter(([kind, ev]) => kind === "event" && ev?.name === "demo_used" && ev?.data?.demo === demo)
        .length,
    demo,
  );
}

async function checkStargazeOffloadDraw(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#fig-draw");
    await drawStroke(page);
    await waitDrawFits(page); // the draw model is loaded and has run

    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => (window.__offload?.draw ?? 0) >= 1, null, { timeout: 15000 });
    await page.keyboard.press("Escape");

    // Restore rule: it had been loaded, so it comes back without a new stroke.
    const draw = page.locator("#fig-draw");
    await draw.getByRole("button", { name: "clear", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#fig-draw")?.textContent.includes("hit generate"),
      null,
      { timeout: 120000 },
    );
    await drawStroke(page);
    await waitDrawFits(page);
    return "draw session released on entry, reloaded on return, a new stroke auto-labels again";
  });
}

async function checkStargazeCancelsRun(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    const enter = page.getByRole("button", { name: STARGAZE_ENTER });
    const settled = async (sel) => {
      await page.waitForTimeout(1000); // let the cancel land: elapsed time is the assertion
      const a = await page.locator(sel).evaluate((el) => el.textContent);
      await page.waitForTimeout(2500);
      const b = await page.locator(sel).evaluate((el) => el.textContent);
      return { a, b };
    };

    // --- draw: cancel mid-generation ---
    await scrollUntilAttached(page, "#fig-draw");
    await drawStroke(page);
    await waitDrawFits(page);
    await page.locator("#fig-draw").getByRole("button", { name: "generate", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#fig-draw")?.textContent.includes("the model running"),
      null,
      { timeout: 60000 },
    );
    await enter.click();
    const d = await settled("#fig-draw");
    if (d.a !== d.b) throw new Error("the draw figure kept changing after stargaze: the run was not cancelled");
    if (d.b.includes("the model running")) throw new Error("the draw figure still shows a half-finished run");
    if (d.b.includes("model failed to load")) throw new Error("a cancelled draw run was reported as a failure");
    if ((await demoEvents(page, "draw")) !== 0) throw new Error("a cancelled draw run queued demo_used{draw}");
    // Prove the release, not just the stall: the panel's stable text above
    // could equally mean "still cancelling" as "session released". Only the
    // offload counter (bumped by unloadDrawModel once the cancelled run's
    // promise actually settles) proves the session is really gone.
    await page.waitForFunction(() => (window.__offload?.draw ?? 0) >= 1, null, { timeout: 15000 });
    await page.keyboard.press("Escape");

    // --- headshot: cancel mid-sampling ---
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /^Sample photo 1 of \d+ with the diffusion model$/ }).click();
    await page.waitForFunction(
      () => {
        const c = document.querySelector("#headshot-toy canvas");
        return !!c && !c.hidden;
      },
      null,
      { timeout: 120000 },
    );
    await enter.click();
    const h = await settled("#headshot-toy");
    if (h.a !== h.b) throw new Error("the headshot kept changing after stargaze: the run was not cancelled");
    if (h.b.includes("didn't load")) throw new Error("a cancelled headshot run was reported as a failure");
    const canvasHidden = await page.evaluate(() => document.querySelector("#headshot-toy canvas").hidden);
    if (!canvasHidden) throw new Error("a half-sampled headshot frame was left on screen");
    if ((await demoEvents(page, "headshot")) !== 0) throw new Error("a cancelled headshot run queued demo_used{headshot}");
    // Same proof as the draw phase above: the offload counter, not just a
    // stable readout, is what shows unloadHeadshotModel actually released
    // the session after the cancelled run settled.
    await page.waitForFunction(() => (window.__offload?.headshot ?? 0) >= 1, null, { timeout: 15000 });
    await page.keyboard.press("Escape");

    const gazes = await demoEvents(page, "stargaze");
    if (gazes !== 1) throw new Error(`demo_used{stargaze} queued ${gazes} times, expected 1`);

    // --- after returning, a run completes normally ---
    await scrollUntilAttached(page, "#fig-draw");
    await page.waitForFunction(
      () => document.querySelector("#fig-draw")?.textContent.includes("hit generate"),
      null,
      { timeout: 120000 },
    );
    await page.locator("#fig-draw").getByRole("button", { name: "generate", exact: true }).click();
    await page.waitForFunction(
      () =>
        (window.vaq ?? []).some(([k, ev]) => k === "event" && ev?.name === "demo_used" && ev?.data?.demo === "draw"),
      null,
      { timeout: 120000 },
    );
    return "draw and headshot runs stopped within a step, no failure shown, no demo_used, both sessions released (offload counters); a later generate completed";
  });
}

/**
 * Stargaze entered before the FIRST classify ever finished (mid-download,
 * ideally): the restore must still produce fit scores, never silently skip
 * them (task-7 fix round 1, I1 / P2). Not a hard assertion that entry beats
 * the download — headless Firefox HTTP-caches the 26MB model fast enough
 * that this can lose the race on a warm run, so a landed-before-entry case
 * is reported in the detail rather than failed.
 *
 * Also covers N1 (task-7 fix round 2): a rapid exit -> re-entry, before the
 * first exit's reload has had any time to settle, must not lose the
 * restore for good. Round 1's exit branch waited on the pending unload
 * before reloading, which let `probed` sit false during that wait — a
 * quick re-entry in that gap recorded `wantedRef` as false and the model
 * never came back. Round 2 made the exit branch synchronous again (the
 * session-overlap guard this wait used to provide now lives inside
 * `loadDrawModel`/`unloadDrawModel` themselves), which closes the gap
 * entirely rather than narrowing it, so this doesn't depend on winning a
 * timing race the way the download half above does.
 */
async function checkStargazeDuringDownload(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    await scrollUntilAttached(page, "#fig-draw");
    await drawStroke(page); // starts the ~26MB download
    const fitsAtEntry = await page.evaluate(
      () => !!document.querySelector('#fig-draw button[aria-label*="fits your drawing"]'),
    );
    const enter = page.getByRole("button", { name: STARGAZE_ENTER });
    await enter.click();
    // N1: exit, then re-enter immediately, before the first exit's reload
    // (or the still-in-flight unload behind it) has settled.
    await page.keyboard.press("Escape");
    await enter.click();
    await page.waitForTimeout(2000); // let the download, and a cancelled classify if one started, land
    await page.keyboard.press("Escape");
    await waitDrawFits(page);
    return fitsAtEntry
      ? "model landed and classified before stargaze was entered (too fast to reproduce the download race headlessly this run); restore still holds fit scores after a rapid re-entry"
      : "entered stargaze before the first classify ever ran (mid-download), then re-entered rapidly before the first exit's reload settled; restore still produced fit scores";
  });
}

/* ---------------------------------------------------------------------- */
/* driver                                                                  */
/* ---------------------------------------------------------------------- */

const CHECKS = [
  ["sky-animates-1280", skyAnimatesAt1280],
  ["sky-static-reduced-motion", skyStaticUnderReducedMotion],
  ["sky-present-400", skyPresentAt400],
  ["sky-orientation", checkSkyOrientation],
  ["sky-hover", checkSkyHover],
  ["sky-drag", checkSkyDrag],
  ["no-h-scroll-home-400", checkNoHorizontalScroll("/")],
  ["no-h-scroll-lab-400", checkNoHorizontalScroll("/lab")],
  ["no-early-heavy-payload-400", checkNoEarlyHeavyPayload],
  ["label-efficiency", checkLabelEfficiency],
  ["dice-cdf", checkDiceCdf],
  ["flight-video-play-pause", checkFlightVideoPlayPause],
  ["draw-stroke-auto-label", checkDrawAutoLabel],
  ["chess-hint-g3", checkChessHint],
  ["jepa-seed-query-834", checkJepaSeedQuery834],
  ["jepa-triple-equality-mixed", checkJepaTripleEqualityOnMixedQuery],
  ["headshot-samples-photo", checkHeadshotSamplesPhoto],
  ["analytics-queue", checkAnalyticsQueue],
  ["stargaze-hides-page", checkStargazeHidesPage],
  ["stargaze-no-fetch", checkStargazeNoFetch],
  ["stargaze-offload-chess", checkStargazeOffloadChess],
  ["stargaze-offload-draw", checkStargazeOffloadDraw],
  ["stargaze-cancels-run", checkStargazeCancelsRun],
  ["stargaze-during-download", checkStargazeDuringDownload],
];

async function main() {
  const filters = process.argv.slice(2);
  const selected = filters.length
    ? CHECKS.filter(([name]) => filters.some((f) => name.includes(f)))
    : CHECKS;

  if (selected.length === 0) {
    console.error(`No checks matched filter(s): ${filters.join(", ")}`);
    console.error(`Available: ${CHECKS.map(([n]) => n).join(", ")}`);
    process.exit(1);
  }

  console.log(`Running ${selected.length}/${CHECKS.length} check(s) against ${BASE}\n`);

  const browser = await firefox.launch();
  try {
    for (const [name, fn] of selected) {
      await run(name, browser, fn);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("verify-redesign crashed before completing:", err);
  process.exit(1);
});
