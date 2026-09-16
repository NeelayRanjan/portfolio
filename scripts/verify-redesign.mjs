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
import * as satellite from "satellite.js";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { EMISSION_LINE_COLOUR, SKY_FACTS } from "../content/sky-facts.ts";
import { EDGE_DEC_DEG, moonEquatorial, planetEquatorial } from "../lib/sky-math.ts";
import { copy } from "../content/copy.ts";

/**
 * The colour round's `sky-colour` and the card checks read the palette table
 * itself, so a colour added or dropped in lib/sky-layers.ts carries its own
 * assertions with it instead of being mirrored into a list here. That module
 * is a real drawing module with runtime imports written the bundler way
 * (`./sky-objects`, no extension), which node's ESM resolver refuses, so this
 * registers the same resolve hook scripts/test-sky-objects.mjs uses: scoped to
 * this process, it retries a failed relative specifier with ".ts". The static
 * imports above are already resolved by the time this runs; only the dynamic
 * import below goes through it.
 */
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\\.[a-zA-Z0-9]+$/.test(specifier)) {
      return nextResolve(specifier + ".ts", context);
    }
    throw err;
  }
}`)}`,
  import.meta.url,
);
const { OBJECT_COLOURS, EMISSION_LINE_COLOURED } = await import("../lib/sky-layers.ts");
const { PAPER_SATURATION, PAPER_COLOUR_SHARE } = await import("../lib/sky-colour.ts");

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

/**
 * New isolated context + page, closed automatically when `fn` returns.
 *
 * `/api/iss-tle` is answered `{ tle: null }` by default (final review F4):
 * the route is prerendered at build time, so without this every check would
 * draw whatever ISS the build's TLE puts on screen whenever a pinned instant
 * lands within 7 days of it, which makes a pixel or "lone symbol" pick depend
 * on the build date and the network. `sky-iss` opts out with
 * `{ stubIssTle: false }` and serves its own fixture.
 */
async function withPage(browser, contextOptions, fn, { stubIssTle = true } = {}) {
  const context = await browser.newContext(contextOptions);
  if (stubIssTle) {
    await context.route("**/api/iss-tle", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tle: null, fetchedAt: new Date().toISOString() }),
      }),
    );
  }
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

/** Mean (not brightest) RGB value in a (2r+1)px box of the sky canvas, CSS
 *  coords: skyPeak's companion, used to confirm a patch of canvas is dark
 *  (a desk-coloured label backing) rather than bright (bleed-through text). */
function skyMean(page, x, y, r) {
  return page.evaluate(
    ([sel, x, y, r]) => {
      const c = document.querySelector(sel);
      const s = c.width / window.innerWidth;
      const size = Math.round(2 * r * s) + 1;
      const { data } = c.getContext("2d").getImageData(Math.round((x - r) * s), Math.round((y - r) * s), size, size);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        n++;
      }
      return sum / n;
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
    // Spec 2026-09-15 §10: with every layer loaded, the median frame draw may
    // not exceed twice the 2.96 ms measured before the objects layers existed.
    // The median covers the last 60 frames, so wait for 60 frames (~3 s at
    // 20 fps) of the full sky before reading it.
    await page.waitForFunction(
      () => window.__sky.layers.objects === "ready" && window.__sky.layers.milkyWay === "ready",
      null,
      { timeout: 10000 },
    );
    await page.waitForTimeout(3200); // elapsed frames are the point: the median must be all full-sky frames
    const ms = await page.evaluate(() => window.__sky.frameMsMedian);
    const BUDGET_MS = 2 * 2.96;
    if (!(ms <= BUDGET_MS)) throw new Error(`median frame draw ${ms?.toFixed(2)}ms exceeds ${BUDGET_MS}ms (2x the pre-objects 2.96ms)`);
    return `samples differ; median frame draw ${ms.toFixed(2)}ms with every layer, budget ${BUDGET_MS}ms (a headless Firefox number, not a device number)`;
  });
}

async function skyStaticUnderReducedMotion(browser) {
  return withPage(
    browser,
    { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" },
    async (page) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      await page.waitForFunction(
        () => Object.values(window.__sky.layers).every((state) => state !== "loading"),
        null,
        { timeout: 10000 },
      );
      const canvas = page.locator(SKY_CANVAS);
      const sample = () => canvas.evaluate((el) => el.toDataURL());
      const a = await sample();
      await page.waitForTimeout(1500);
      const b = await sample();
      if (a !== b) throw new Error("reduced-motion sky changed between two samples 1.5s apart");
      const credit = await page.locator("[data-sky-credit]").innerText();
      if (/faster/.test(credit)) throw new Error(`reduced-motion credit still claims a speed-up: "${credit}"`);
      assertCredit(credit, copy.stargaze.creditStill + copy.stargaze.creditTail, "reduced-motion");
      return "drawn, static for 1.5s, credit carries the still wording";
    },
  );
}

/**
 * The credit line promises the owner's sentence plus one tail sentence, read
 * straight from copy.ts, and nothing else: present, equal to the composed
 * copy, and free of the doubled punctuation ("..", ".,") that fragment joins
 * produced once the owner trimmed the sentence (2026-09-16).
 */
function assertCredit(rendered, expected, where) {
  const text = rendered.replace(/\s+/g, " ").trim();
  if (!text) throw new Error(`${where}: credit line is empty or missing`);
  if (text !== expected.replace(/\s+/g, " ").trim()) {
    throw new Error(`${where}: credit reads ${JSON.stringify(text)}, copy composes ${JSON.stringify(expected)}`);
  }
  const doubled = text.match(/\.\.|\.,|,\.|,,/);
  if (doubled) throw new Error(`${where}: credit has doubled punctuation "${doubled[0]}": ${JSON.stringify(text)}`);
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
    assertCredit(credit, copy.stargaze.credit + copy.stargaze.creditTail, "400px");
    return `visible, ${lit} bright pixels, credit matches copy`;
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

// Root-caused 2026-09-15 (Task 5b): this check used to read the REAL clock
// under reduced motion, so which constellation/segment it picked, and where
// on that segment it sampled, depended on the wall-clock LST at whatever
// moment the suite happened to run. Task 4 added the hover label's own
// desk-coloured backing, drawn ON TOP of the highlighted line after the
// hover; at some real times the 30%-along-segment sample point that looked
// clear of every OTHER layer at pick-time ends up freshly covered by that
// backing once the label is drawn, which can only ever make the sampled
// pixel darker, not brighter, and pushes the diff under 60 (confirmed by
// replaying the exact pick+measure logic at pinned instants every 2h across
// a day on this branch's build: whenever the sample point fell inside the
// resulting label box the diff ranged -15..+51, and every instant where it
// fell clear of the label box scored 61..152 — see task-5b-report.md). The
// fix pins the clock to one instant, chosen so the picked segment's sample
// point lands comfortably clear of the label (confirmed >20px clearance,
// deterministic across repeated runs against this build).
const SKY_HOVER_INSTANT = new Date("2026-09-15T05:00:00.000Z");

async function checkSkyHover(browser) {
  // Reduced motion keeps the chart still, so the targeted segment can't drift
  // away from the pointer mid-check. Hover works there too (spec §3).
  return withPage(
    browser,
    { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 },
    async (page) => {
      await page.clock.setFixedTime(SKY_HOVER_INSTANT);
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      await page.waitForFunction(
        () => window.__sky.layers.objects === "ready" && window.__sky.layers.facts === "ready",
        null,
        { timeout: 10000 },
      );
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
        // Symbols win over lines within 12px (spec 2026-09-15 §5), so a
        // midpoint near any drawn object, star name, planet or radiant is
        // not a line hover.
        const clearOfHits = (x, y) => window.__sky.hits.every((h) => Math.hypot(h.x - x, h.y - y) > 20);
        for (const abbr of abbrs) {
          for (const [x1, y1, x2, y2] of window.__sky.segmentsFor(abbr)) {
            const x = (x1 + x2) / 2;
            const y = (y1 + y2) / 2;
            if (Math.hypot(x2 - x1, y2 - y1) > 30 && inMargin(x, y) && clearOfHits(x, y)) return { abbr, x, y, x1, y1, x2, y2 };
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

      // The name must land somewhere the visitor can actually read it: on
      // screen, and clear of the sheet (fix round 1, finding I1). Since the
      // pole moved top left (2026-09-15) near-pole anchors sit near the
      // sheet's top-left corner, and on 1280-1440px viewports that corner is
      // still under the page, so the avoidance still matters.
      // Fetched BEFORE the brightness sample (Task 5b): the label's own
      // backing paints over whatever was under it, so a direct "sample point
      // sits inside the label box" check here gives a clear diagnostic
      // instead of a confusing brightness-diff failure if a future layer
      // change ever pushes the label back onto the sample point.
      const { label, sheet, viewport } = await page.evaluate(() => {
        const r = document.querySelector("[data-sheet]").getBoundingClientRect();
        return {
          label: window.__sky.label,
          sheet: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        };
      });
      if (!label) throw new Error(`${target.abbr} highlighted but window.__sky.label is null`);
      const labelClearance = Math.max(label.x - qx, qx - (label.x + label.w), label.y - qy, qy - (label.y + label.h));
      if (labelClearance < 4) {
        throw new Error(
          `${target.abbr} sample point (${qx.toFixed(1)}, ${qy.toFixed(1)}) sits inside (or ${(-labelClearance).toFixed(1)}px from) the hover label's own backing box ${JSON.stringify(label)}, which would darken it rather than the highlight brightening it — pick a different SKY_HOVER_INSTANT`,
        );
      }

      const after = await skyPeak(page, qx, qy, 1);
      if (after - before < 60) {
        throw new Error(`${target.abbr} highlighted but its line did not brighten (${before} -> ${after})`);
      }
      const text = await page.evaluate(() => window.__sky.labelText);
      const oneLiner = SKY_FACTS.find((f) => f.id === target.abbr)?.oneLiner;
      if (!oneLiner || text?.sub !== oneLiner) {
        throw new Error(`${target.abbr} label's second line is ${JSON.stringify(text?.sub)}, expected the fact's one-liner ${JSON.stringify(oneLiner)}`);
      }
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

const M31 = { raDeg: 10.6751, decDeg: 41.2667 }; // objects.json, from d3-celestial
const SGR_A_STAR = { raDeg: 266.41683, decDeg: -29.00781 }; // spec §4: 17h45m40.04s, -29°00'28.1"
const PERSEID_RADIANT = { raDeg: 48, decDeg: 58 }; // IMO 2026 Table 5
/** A mean sidereal day: 40 of them later, the chart has the same orientation to 0.001°. */
const SIDEREAL_DAY_MS = 86_164_090.5;

const lstAt = (date) => (((Astronomy.SiderealTime(date) * 15 + MOFFETT_LON) % 360) + 360) % 360;

/** The first instant from `from`, in 10-minute steps over two days, where `body` lands `margin` px inside W x H. */
function findInstant(from, W, H, body, margin) {
  for (let i = 0; i < 288; i++) {
    const date = new Date(from.getTime() + i * 600_000);
    const lst = lstAt(date);
    const p = specProject(W, H, lst, body.raDeg, body.decDeg);
    if (p.x > margin && p.x < W - margin && p.y > margin && p.y < H - margin) return { date, lst, p };
  }
  throw new Error(`nothing lands ${margin}px inside ${W}x${H} in the two days from ${from.toISOString()}`);
}

/** A reduced-motion page pinned to `date`, with the sky and (unless `blockObjects`) its objects layer loaded. */
async function pinnedSkyPage(browser, { W, H, date, blockObjects = false, contextOptions = {} }, fn) {
  return withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1, ...contextOptions }, async (page, context) => {
    if (blockObjects) await context.route("**/sky/objects.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(
      (blocked) =>
        window.__sky.layers.objects === (blocked ? "absent" : "ready") && window.__sky.layers.milkyWay === "ready",
      blockObjects,
      { timeout: 10000 },
    );
    return fn(page);
  });
}

async function checkSkyObjects(browser) {
  const W = 1600;
  const H = 1000;
  const notes = [];

  // Andromeda and the galactic core, each at an instant it is well on screen:
  // its computed position holds pixels with objects.json served, and holds
  // clearly fewer with objects.json 404ing (which must still draw the sky).
  for (const [id, body, radius] of [["m31", M31, 6], ["sgr-a-star", SGR_A_STAR, 7]]) {
    const { date, lst, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, body, 60);
    const withObjects = await pinnedSkyPage(browser, { W, H, date }, async (page) => {
      const hit = await page.evaluate((id) => window.__sky.hits.find((h) => h.id === id) ?? null, id);
      if (!hit) throw new Error(`${id} is not among the drawn hits at ${date.toISOString()}`);
      if (Math.hypot(hit.x - p.x, hit.y - p.y) > 1.5) {
        throw new Error(`${id} drawn at (${hit.x.toFixed(1)}, ${hit.y.toFixed(1)}), spec projection says (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
      }
      return skyPeak(page, p.x, p.y, radius);
    });
    const without = await pinnedSkyPage(browser, { W, H, date, blockObjects: true }, async (page) => {
      const hits = await page.evaluate(() => window.__sky.hits.map((h) => h.id));
      if (hits.includes(id)) throw new Error(`${id} drawn although objects.json 404'd`);
      return skyPeak(page, p.x, p.y, radius);
    });
    if (withObjects - without < 40) {
      throw new Error(`${id} at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}), LST ${lst.toFixed(2)}°: peak ${withObjects} with objects, ${without} without`);
    }
    notes.push(`${id} peak ${without} -> ${withObjects}`);
  }

  // The Perseid radiant: drawn on 2026-08-12 (inside Jul 17..Aug 24), not 40
  // sidereal days later (outside), at the same chart orientation.
  const inside = findInstant(new Date(Date.UTC(2026, 7, 12)), W, H, PERSEID_RADIANT, 80);
  const outsideDate = new Date(inside.date.getTime() + 40 * SIDEREAL_DAY_MS);
  const radiantAt = (date) =>
    pinnedSkyPage(browser, { W, H, date }, async (page) => {
      const snap = await page.evaluate(() => ({ radiants: window.__sky.radiants, hits: window.__sky.hits }));
      const crowd = snap.hits.filter((h) => h.id !== "perseids" && Math.hypot(h.x - inside.p.x, h.y - inside.p.y) < 20);
      if (crowd.length) throw new Error(`${crowd.map((h) => h.id)} sit on the radiant at ${date.toISOString()}; pick another start`);
      return { radiants: snap.radiants, peak: await skyPeak(page, inside.p.x, inside.p.y, 7) };
    });
  const on = await radiantAt(inside.date);
  const off = await radiantAt(outsideDate);
  if (!on.radiants.includes("perseids")) throw new Error(`Perseids not active on ${inside.date.toISOString()}: ${on.radiants}`);
  if (off.radiants.includes("perseids")) throw new Error(`Perseids still active on ${outsideDate.toISOString()}`);
  if (on.peak - off.peak < 40) throw new Error(`radiant peak ${on.peak} inside the window vs ${off.peak} outside`);
  notes.push(`Perseid radiant ${off.peak} (${outsideDate.toISOString().slice(0, 10)}) -> ${on.peak} (${inside.date.toISOString().slice(0, 10)})`);

  // Desk one-liner (spec §5): hover a symbol in the desk margin, get its name and its fact's one-liner.
  const hovered = await pinnedSkyPage(browser, { W, H, date: inside.date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    const target = await page.evaluate(() => {
      const sheet = document.querySelector("[data-sheet]").getBoundingClientRect();
      const hits = window.__sky.hits;
      return (
        hits.find(
          (h) =>
            (h.x < sheet.left - 40 || h.x > sheet.right + 40) &&
            h.y > 40 &&
            h.y < window.innerHeight - 40 &&
            hits.every((o) => o === h || Math.hypot(o.x - h.x, o.y - h.y) > 30),
        ) ?? null
      );
    });
    if (!target) throw new Error(`no lone symbol in the desk margin at ${inside.date.toISOString()}`);
    await page.mouse.move(target.x + 2, target.y + 1);
    await page.waitForFunction((id) => window.__sky.highlight === id, target.id, { timeout: 3000 });
    const text = await page.evaluate(() => window.__sky.labelText);
    const oneLiner = SKY_FACTS.find((f) => f.id === target.id)?.oneLiner;
    if (!oneLiner || text?.sub !== oneLiner) throw new Error(`${target.id}: label ${JSON.stringify(text)}, fact one-liner ${JSON.stringify(oneLiner)}`);

    // Legibility (fix round 1, C1/I2): the hovered symbol's own always-on
    // name must be suppressed (it is about to be redrawn, larger, right
    // here), and the label itself must sit on a desk-coloured backing so a
    // neighbouring label's text can't bleed through underneath it.
    const suppressed = await page.evaluate(() => window.__sky.suppressedName);
    if (suppressed !== target.id) {
      throw new Error(`suppressedName is ${JSON.stringify(suppressed)} while hovering ${target.id}`);
    }
    const box = await page.evaluate(() => window.__sky.label);
    if (!box) throw new Error(`${target.id} hovered but window.__sky.label is null`);
    // Just inside the backing's few-px padding, outside the tight text box:
    // desk-coloured (low mean RGB) if the backing is real, still showing any
    // pre-existing bright content (a star, a line, a neighbour's name) at
    // roughly its own brightness if the backing regresses to nothing.
    const corners = [
      [box.x - 1, box.y - 1],
      [box.x + box.w + 1, box.y - 1],
      [box.x - 1, box.y + box.h + 1],
      [box.x + box.w + 1, box.y + box.h + 1],
    ];
    for (const [cx, cy] of corners) {
      const mean = await skyMean(page, cx, cy, 1);
      if (mean > 70) {
        throw new Error(
          `label backing corner (${cx}, ${cy}) mean RGB ${mean.toFixed(1)} looks like bleed-through, not the desk-coloured backing`,
        );
      }
    }
    return `${target.id} "${text.title}" / "${text.sub}"; suppressedName ok; backing corners dark`;
  });
  notes.push(`hover ${hovered}`);
  return notes.join("; ");
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

    // A drag can't get stuck: losing the window (blur) ends it and the
    // spring takes the chart home even though the button is still down.
    await dragBy(page, x, y, 120, 0);
    await page.waitForFunction(() => window.__sky.dragging === true, null, { timeout: 2000 });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForFunction(() => window.__sky.dragging === false && window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 2500 });
    await page.mouse.up();
    notes.push("window blur ended a held drag");

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

  // Stargaze (change 1, 2026-09-15): a released drag holds instead of
  // springing home; only leaving stargaze sends the chart back.
  await withPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    // Stargaze drags can start anywhere, not just the desk margin.
    await dragBy(page, 200, 200, 130, 70);
    await page.waitForFunction(() => window.__sky.dragging === true, null, { timeout: 2000 });
    await page.mouse.up();
    await page.waitForTimeout(1500); // real elapsed time is the point: nothing should have sprung
    const held = await skyOffset(page);
    if (held.x === 0 && held.y === 0) throw new Error("stargaze drag sprang home on release; it should hold");
    await page.getByRole("button", { name: STARGAZE_EXIT }).click();
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, {
      timeout: 2500,
      polling: "raf",
    });
    notes.push(`stargaze: held (${held.x.toFixed(0)}, ${held.y.toFixed(0)}) for 1.5s, home after exit`);
  });

  // Reduced motion: the drag still works, the release snaps home; the same
  // hold-until-exit rule applies while stargazing, just as a snap instead of
  // a spring on the way back.
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

      await waitStargazeReady(page);
      await page.getByRole("button", { name: STARGAZE_ENTER }).click();
      await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
      await dragBy(page, 200, 200, 90, 0);
      await page.waitForFunction(() => Math.abs(window.__sky.offset.x - 90) < 2, null, { timeout: 2000 });
      await page.mouse.up();
      await page.waitForTimeout(300); // no spring/snap should fire on release while stargazing
      const stillHeld = await skyOffset(page);
      if (stillHeld.x === 0) throw new Error("reduced motion: stargaze drag snapped home on release; it should hold");
      await page.getByRole("button", { name: STARGAZE_EXIT }).click();
      await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 100 });
      notes.push("reduced motion: stargaze drag held, snapped home on exit");
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

/** The 88 abbreviations, from the committed catalog (the snapshot's segmentsFor takes one at a time). */
const ABBRS = Object.keys(JSON.parse(readFileSync(new URL("../public/sky/sky.json", import.meta.url), "utf8")).constellations);

/** The committed objects catalog (fix round 1, I2): Voyager 1's RA/Dec and
 *  spacecraft data (distanceAu, positionDate) come from here, not a
 *  hardcoded copy, so a re-export can't silently drift from the assertion. */
const OBJECTS_DATA = JSON.parse(readFileSync(new URL("../public/sky/objects.json", import.meta.url), "utf8"));
const VOYAGER1 = OBJECTS_DATA.objects.find((o) => o.id === "voyager-1");

/** Mirrors SkyCard.tsx's own `longDate`: "2026-09-15" -> "September 15, 2026". */
const CARD_LONG_DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const cardLongDate = (iso) => CARD_LONG_DATE.format(new Date(`${iso}T00:00:00Z`));

/** Like findInstant, but for a body that moves (the Moon, a planet):
 *  `posAt(ms)` returns its RA/Dec at that instant. Reduced motion pins
 *  window.__sky's simulated clock to the page's fixed real clock exactly
 *  (no 180x speedup), so `ms` here is the same instant pinnedSkyPage's
 *  `date` will later set. */
function findInstantMoving(from, W, H, posAt, margin) {
  for (let i = 0; i < 288; i++) {
    const date = new Date(from.getTime() + i * 600_000);
    const lst = lstAt(date);
    const eq = posAt(date.getTime());
    const p = specProject(W, H, lst, eq.raDeg, eq.decDeg);
    if (p.x > margin && p.x < W - margin && p.y > margin && p.y < H - margin) return { date, lst, p };
  }
  throw new Error(`nothing lands ${margin}px inside ${W}x${H} in the two days from ${from.toISOString()}`);
}

/**
 * A point of genuinely empty sky: at least 30px from every drawn symbol and
 * every constellation line (so a click there selects nothing), off the card,
 * off any control, and at least `awayFrom.r` px from `awayFrom`.
 */
function emptySkyPoint(page, awayFrom, bounds = null) {
  return page.evaluate(
    ([abbrs, away, bounds]) => {
      const segs = abbrs.flatMap((a) => window.__sky.segmentsFor(a));
      const distToSeg = (x, y, [x1, y1, x2, y2]) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
        return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      };
      const card = document.querySelector("[data-sky-card]")?.getBoundingClientRect();
      for (let y = 120; y < window.innerHeight - 120; y += 23) {
        for (let x = 120; x < window.innerWidth - 120; x += 29) {
          if (Math.hypot(x - away.x, y - away.y) < away.r) continue;
          if (bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)) continue;
          if (card && x > card.left - 20 && x < card.right + 20 && y > card.top - 20 && y < card.bottom + 20) continue;
          if (window.__sky.hits.some((h) => Math.hypot(h.x - x, h.y - y) < 30)) continue;
          if (segs.some((s) => distToSeg(x, y, s) < 30)) continue;
          if (document.elementFromPoint(x, y)?.closest("button, a, [data-sky-card]")) continue;
          return { x, y };
        }
      }
      return null;
    },
    [ABBRS, awayFrom, bounds],
  );
}

/**
 * Opens the card for a drawn hit (found by id in window.__sky.hits, not a
 * hardcoded pixel) at a pinned instant, and returns its content (fix round
 * 1, I2: exercises the spacecraft/planet/Moon title and extra-line branches
 * the M31-only check never touched).
 */
async function openHitCard(browser, { W, H, date, hitId }) {
  return pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const at = await page.evaluate((id) => window.__sky.hits.find((h) => h.id === id) ?? null, hitId);
    if (!at) throw new Error(`${hitId} is not among the drawn hits at ${date.toISOString()}`);
    const card = page.locator("[data-sky-card]");
    await page.mouse.click(at.x, at.y);
    await card.waitFor({ state: "visible", timeout: 3000 });
    return card.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      title: el.querySelector("h2")?.textContent,
      kind: el.querySelector("[data-sky-card-kind]")?.textContent,
      oneLiner: el.querySelector("[data-sky-card-oneliner]")?.textContent,
      dataLines: [...el.querySelectorAll("[data-sky-card-data]")].map((p) => p.textContent),
    }));
  });
}

/* ---------------------------------------------------------------------- */
/* sourced colour: muted on the page, full over the sky and in stargaze  */
/* ---------------------------------------------------------------------- */

/**
 * One fixed instant, 1600x1000, chosen (measured, not guessed) because it
 * puts ten of the palette table's objects on the canvas at once and covers
 * all three glyph families: galaxy (M81), nebula (M1, M42, Flame, Horsehead,
 * M78) and cluster (M44, M45, NGC 869/884) — plus M82, the one deep-sky
 * object in the catalog that deliberately has NO palette, which the card
 * check needs. The checks assert that coverage rather than assuming it, so a
 * catalog change that empties the frame fails loudly instead of passing on
 * two objects.
 */
const SKY_COLOUR_INSTANT = new Date("2026-10-01T06:00:00.000Z");
/** Catalog ids that draw in sourced colour, and the deep-sky ids overall. */
const COLOURED_IDS = Object.keys(OBJECT_COLOURS);
const DEEP_SKY_IDS = OBJECTS_DATA.objects.filter((o) => ["galaxy", "nebula", "cluster"].includes(o.symbol)).map((o) => o.id);

/**
 * Thresholds. The contract since fix round 1 (controller ruling, 2026-09-16):
 * paper mode's colour is PAPER_COLOUR_SHARE of the way from the grey chart to
 * stargaze, as DISPLAYED, and the band shows a real warmth gain, not only a
 * brightness one. Calibration on this build at SKY_COLOUR_INSTANT:
 * - "share" is how far along the grey -> stargaze chroma line paper's pixel
 *   sits, at each object's most-moved pixel. At share 0.5 it measured
 *   0.44-0.61 across ten objects, median 0.53 (at the old 0.25 mix: 0.14-0.44,
 *   median 0.31). Each object must land within SHARE_TOLERANCE of the
 *   constant, the median within SHARE_MEDIAN_TOLERANCE.
 * - stargaze moved chroma 37-80: floor 25.
 * - hovered sky matched stargaze exactly (0): tolerance 2.
 * - M82's centre measured channel spread 15 in all four states: ceiling 24
 *   (the grey chart's own cream INK), and at most 3 between states.
 * - the band's mean warmth over its pixels: see the numbers recorded in the
 *   task-3 report's fix round 1; paper must add BAND_MIN_WARMTH_GAIN over
 *   saturation 0 (a whole composited level: the linear lerp added 0.00 at the
 *   old mix), and stargaze must add warmth on top of paper.
 * - the ease settled in ~300ms over 18 painted in-between values; the idle
 *   20 fps gate would paint about 6, so fewer than 10 means the gate did not rise.
 */
const STARGAZE_MIN_CHROMA_SHIFT = 25;
const SHARE_TOLERANCE = 0.15;
const SHARE_MEDIAN_TOLERANCE = 0.08;
const HOVER_STARGAZE_TOLERANCE = 2;
const M82_NEUTRAL_MAX_CHROMA = 24;
const M82_MAX_STATE_SPREAD = 3;
const BAND_MIN_WARMTH_GAIN = 1;
const BAND_MIN_STARGAZE_OVER_PAPER = 0.5;
const EASE_MIN_PAINTED_STEPS = 10;
const EASE_MAX_SETTLE_MS = 500;
/** Not the sky, for the colour target: mirrors pointer-controller.ts's NOT_SKY. */
const NOT_SKY_SELECTOR = "a, button, input, select, textarea, label, summary, [role='button'], [data-sky-card], [data-sheet], [data-sky-credit]";
/** 10 CSS px: inside the drawn glyph for all three enlarged families, and
 *  clear of the always-on name that sits beside the symbol. */
const COLOUR_DISC_R = 10;
/** How far a band pixel must sit from every drawn hit to count as band, not object. */
const BAND_CLEAR_PX = 25;

/**
 * Copies the whole sky canvas into `window.__colourFrames[name]`, in the page,
 * so the check can compare several saturation states pixel for pixel without
 * shipping megabytes of RGBA through the protocol.
 */
function snapSky(page, name) {
  return page.evaluate(
    ([sel, name]) => {
      const c = document.querySelector(sel);
      window.__colourFrames ??= {};
      window.__colourFrames[name] = c.getContext("2d").getImageData(0, 0, c.width, c.height).data.slice();
      return window.__sky.saturation;
    },
    [SKY_CANVAS, name],
  );
}

/**
 * Discoverability task 3: saturation replaced the colour flag, so paper mode
 * is no longer grey. What this asserts, every number a DIFFERENCE between
 * two states at the same canvas pixels (CLAUDE.md, "Hue cannot survive low
 * alpha"):
 *
 * - paper mode draws MORE colour than saturation 0 would at the same pixels
 *   (the 0 frame comes from the `__skySaturationOverride` verify hook) and
 *   LESS than stargaze;
 * - the pointer over the sky lifts it to stargaze's level, and moving onto
 *   the sheet brings it back down to paper's exact pixels;
 * - the band's warmth follows the same order;
 * - M82, the one deep-sky object with no palette, stays neutral in every state.
 *
 * Reduced motion, pinned clock (sky-hover's lesson): the chart cannot turn
 * between reads and every state change snaps, so each frame is final. A
 * second, motion-on page then asserts the ease itself.
 */
async function checkSkyColour(browser) {
  const W = 1600;
  const H = 1000;
  const pixels = await pinnedSkyPage(browser, { W, H, date: SKY_COLOUR_INSTANT }, async (page) => {
    await waitStargazeReady(page);
    const satState = () => page.evaluate(() => ({ saturation: window.__sky.saturation, target: window.__sky.saturationTarget }));
    const expectSat = async (v, why) => {
      try {
        await page.waitForFunction((v) => window.__sky.saturation === v, v, { timeout: 5000 });
      } catch {
        throw new Error(`${why}: window.__sky.saturation is ${JSON.stringify(await satState())}, expected ${v}`);
      }
    };
    const initial = await satState();
    if (initial.saturation !== PAPER_SATURATION) {
      throw new Error(`paper mode at rest should draw at PAPER_SATURATION ${PAPER_SATURATION}, window.__sky reports ${JSON.stringify(initial)}`);
    }

    // Two points on the sheet (alternated, so each move really moves), and
    // one point on the bare sky that highlights nothing in either mode.
    const sheetPts = await page.evaluate((sel) => {
      const r = document.querySelector("[data-sheet]").getBoundingClientRect();
      const pts = [
        { x: r.left + r.width / 2, y: Math.max(r.top, 0) + 240 },
        { x: r.left + r.width / 2 + 40, y: Math.max(r.top, 0) + 260 },
      ];
      return pts.map((p) => ({ ...p, onSheet: !!document.elementFromPoint(p.x, p.y)?.closest(sel) }));
    }, "[data-sheet]");
    if (!sheetPts.every((p) => p.onSheet)) throw new Error(`sheet sample points ${JSON.stringify(sheetPts)} are not over [data-sheet]`);
    const toSheet = async (i) => page.mouse.move(sheetPts[i].x, sheetPts[i].y);

    let skyPt = null;
    const tried = [];
    for (const x of [60, 150, 240, W - 240, W - 150, W - 60]) {
      for (const y of [220, 420, 620, 820]) {
        const el = await page.evaluate(([x, y, sel]) => {
          const e = document.elementFromPoint(x, y);
          return { tag: e?.tagName ?? null, blocked: !!e?.closest(sel) };
        }, [x, y, NOT_SKY_SELECTOR]);
        if (el.blocked) {
          tried.push(`(${x},${y}) over ${el.tag}`);
          continue;
        }
        await toSheet(0);
        await page.mouse.move(x, y);
        const st = await page.evaluate(() => ({ s: window.__sky.saturation, h: window.__sky.highlight }));
        if (st.h !== null) {
          tried.push(`(${x},${y}) highlights ${st.h}`);
          continue;
        }
        if (st.s !== 1) throw new Error(`the pointer at (${x}, ${y}) is over ${el.tag}, not the sheet or a control, but saturation is ${st.s}, not 1`);
        skyPt = { x, y };
        break;
      }
      if (skyPt) break;
    }
    if (!skyPt) throw new Error(`no bare-sky point with nothing highlighted: ${tried.join("; ")}`);

    // Paper.
    await toSheet(0);
    await expectSat(PAPER_SATURATION, "moving from the sky onto the sheet");
    await snapSky(page, "paper");
    // Saturation 0 at the same pixels, through the verify hook.
    // (The hook is read when the target is recomputed, which a move from the
    // sheet onto the sky does; the pointer's highlight is null there.)
    await page.evaluate(() => (window.__skySaturationOverride = 0));
    await page.mouse.move(skyPt.x, skyPt.y);
    await expectSat(0, "with __skySaturationOverride = 0 and the pointer moved onto the sky");
    await snapSky(page, "grey");
    await page.evaluate(() => delete window.__skySaturationOverride);
    await toSheet(0);
    await expectSat(PAPER_SATURATION, "after clearing __skySaturationOverride");
    // Hovered sky, then back onto the sheet.
    await page.mouse.move(skyPt.x, skyPt.y);
    await expectSat(1, `pointer over the sky at (${skyPt.x}, ${skyPt.y})`);
    await snapSky(page, "hover");
    await toSheet(1);
    await expectSat(PAPER_SATURATION, "pointer moved back onto the sheet");
    await snapSky(page, "lowered");
    // Stargaze, pointer parked on the same bare sky.
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.move(skyPt.x, skyPt.y);
    await expectSat(1, "stargazing");
    const hl = await page.evaluate(() => window.__sky.highlight);
    if (hl !== null) throw new Error(`in stargaze the pointer at (${skyPt.x}, ${skyPt.y}) highlights ${hl}, which would draw over the samples`);
    await snapSky(page, "stargaze");
    await page.getByRole("button", { name: STARGAZE_EXIT }).click();
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await toSheet(0);
    await expectSat(PAPER_SATURATION, "after leaving stargaze with the pointer on the sheet");

    return page.evaluate(
      ([ids, r, bandClear]) => {
        const f = window.__colourFrames;
        const c = document.querySelector("body > canvas");
        const s = c.width / window.innerWidth;
        const Wd = c.width;
        const chroma = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
        const hits = window.__sky.hits;
        const objects = {};
        for (const h of hits) {
          if (!ids.includes(h.id) && h.id !== "m82") continue;
          const x0 = Math.round((h.x - r) * s);
          const y0 = Math.round((h.y - r) * s);
          const n = Math.round(2 * r * s) + 1;
          if (x0 < 0 || y0 < 0 || x0 + n > c.width || y0 + n > c.height) continue;
          if (h.id === "m82") {
            // Its own centre, 3x3: M81 is 4.7px away, so a disc would be M81's colour.
            const cx = Math.round(h.x * s);
            const cy = Math.round(h.y * s);
            const worst = {};
            for (const k of ["grey", "paper", "hover", "stargaze"]) {
              let w = 0;
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) w = Math.max(w, chroma(f[k], ((cy + dy) * Wd + cx + dx) * 4));
              worst[k] = w;
            }
            objects.m82 = { worst, rgb: [...f.stargaze.slice((cy * Wd + cx) * 4, (cy * Wd + cx) * 4 + 3)] };
            continue;
          }
          // The pixel whose chroma vector moves furthest between saturation 0 and 1.
          const cv = (d, i) => {
            const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            return [d[i] - y, d[i + 1] - y, d[i + 2] - y];
          };
          let best = -Infinity;
          let at = -1;
          for (let yy = y0; yy < y0 + n; yy++) {
            for (let xx = x0; xx < x0 + n; xx++) {
              const i = (yy * Wd + xx) * 4;
              const a = cv(f.grey, i);
              const z = cv(f.stargaze, i);
              const gain = Math.hypot(z[0] - a[0], z[1] - a[1], z[2] - a[2]);
              if (gain > best) {
                best = gain;
                at = i;
              }
            }
          }
          objects[h.id] = {
            px: [(at / 4) % Wd, Math.floor(at / 4 / Wd)],
            rgb: Object.fromEntries(["grey", "paper", "hover", "lowered", "stargaze"].map((k) => [k, [...f[k].slice(at, at + 3)]])),
          };
        }
        // The band: pixels whose warmth moves between saturation 0 and 1, clear of every object.
        const warm = (d, i) => d[i] - d[i + 2];
        const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const pts = hits.map((h) => [h.x * s, h.y * s]);
        const clear = bandClear * s;
        const band = { grey: [], paper: [], stargaze: [], lumGrey: [], lumPaper: [], lumStargaze: [] };
        for (let yy = 0; yy < c.height; yy += 2) {
          for (let xx = 0; xx < c.width; xx += 2) {
            const i = (yy * Wd + xx) * 4;
            if (warm(f.stargaze, i) - warm(f.grey, i) < 3) continue;
            if (pts.some(([px, py]) => Math.abs(px - xx) < clear && Math.abs(py - yy) < clear)) continue;
            band.grey.push(warm(f.grey, i));
            band.paper.push(warm(f.paper, i));
            band.stargaze.push(warm(f.stargaze, i));
            band.lumGrey.push(lum(f.grey, i));
            band.lumPaper.push(lum(f.paper, i));
            band.lumStargaze.push(lum(f.stargaze, i));
          }
        }
        const median = (a) => {
          const b = [...a].sort((x, y) => x - y);
          return b.length ? b[b.length >> 1] : null;
        };
        const bandStats = { n: band.grey.length };
        const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
        for (const [k, v] of Object.entries(band)) {
          bandStats[k] = median(v);
          bandStats[`${k}Mean`] = mean(v);
        }
        return { objects, band: bandStats };
      },
      [COLOURED_IDS, COLOUR_DISC_R, BAND_CLEAR_PX],
    );
  });

  // --- the pixel assertions ---
  const ids = Object.keys(pixels.objects).filter((id) => id !== "m82").sort();
  if (ids.length < 6) throw new Error(`only ${ids.length} coloured objects (${ids.join(", ") || "none"}) fully on a ${W}x${H} canvas at ${SKY_COLOUR_INSTANT.toISOString()}; pick another SKY_COLOUR_INSTANT`);
  const familyOf = (id) => OBJECTS_DATA.objects.find((o) => o.id === id)?.symbol;
  const families = new Set(ids.map(familyOf));
  for (const want of ["galaxy", "nebula", "cluster"]) {
    if (!families.has(want)) throw new Error(`no ${want} among the sampled coloured objects (${ids.map((id) => `${id}:${familyOf(id)}`).join(", ")})`);
  }
  // A pixel's chroma vector: its channels minus its own Rec. 709 luminance.
  // The grey chart is not chromaless (INK is a cream), so "more colour" is
  // measured as movement AWAY from the saturation-0 pixel toward the
  // stargaze pixel, never as raw channel spread.
  const cv = ([r, g, b]) => {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [r - y, g - y, b - y];
  };
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const norm = (a) => Math.hypot(...a);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const notes = [];
  const shares = [];
  for (const id of ids) {
    const o = pixels.objects[id];
    const g = cv(o.rgb.grey);
    const full = sub(cv(o.rgb.stargaze), g);
    const paper = sub(cv(o.rgb.paper), g);
    const dFull = norm(full);
    const dPaper = norm(paper);
    // How far along the grey -> stargaze line paper sits (0 grey, 1 stargaze).
    const along = dFull > 0 ? dot(paper, full) / (dFull * dFull) : 0;
    const dHover = norm(sub(cv(o.rgb.hover), cv(o.rgb.stargaze)));
    const where = `${id} (${familyOf(id)}) at device px (${o.px.join(", ")}): rgb grey (${o.rgb.grey}), paper (${o.rgb.paper}), hovered (${o.rgb.hover}), back on the sheet (${o.rgb.lowered}), stargaze (${o.rgb.stargaze}); chroma moved ${dPaper.toFixed(1)} from grey in paper, ${dFull.toFixed(1)} in stargaze, paper ${(along * 100).toFixed(0)}% of the way`;
    if (dFull < STARGAZE_MIN_CHROMA_SHIFT) throw new Error(`stargaze draws no colour here: ${where}; stargaze must move chroma at least ${STARGAZE_MIN_CHROMA_SHIFT}`);
    if (Math.abs(along - PAPER_COLOUR_SHARE) > SHARE_TOLERANCE) {
      throw new Error(`paper mode's displayed colour share is ${along.toFixed(2)} for ${where}; PAPER_COLOUR_SHARE is ${PAPER_COLOUR_SHARE}, allowed ±${SHARE_TOLERANCE}`);
    }
    shares.push([id, along]);
    if (dHover > HOVER_STARGAZE_TOLERANCE) throw new Error(`the pointer over the sky does not reach stargaze's colour: ${where}; hovered differs from stargaze by ${dHover.toFixed(1)}, allowed ${HOVER_STARGAZE_TOLERANCE}`);
    if (o.rgb.lowered.join() !== o.rgb.paper.join()) throw new Error(`moving onto the sheet did not return to paper's exact pixel: ${where}`);
    notes.push(`${id} ${along.toFixed(2)} of ${dFull.toFixed(1)}`);
  }
  const sortedShares = shares.map(([, a]) => a).sort((x, y) => x - y);
  const medianShare = sortedShares[sortedShares.length >> 1];
  if (Math.abs(medianShare - PAPER_COLOUR_SHARE) > SHARE_MEDIAN_TOLERANCE) {
    throw new Error(`paper mode's median displayed colour share is ${medianShare.toFixed(2)} (${shares.map(([id, a]) => `${id} ${a.toFixed(2)}`).join(", ")}); PAPER_COLOUR_SHARE is ${PAPER_COLOUR_SHARE}, allowed ±${SHARE_MEDIAN_TOLERANCE}`);
  }
  const m82 = pixels.objects.m82;
  if (!m82) throw new Error(`M82 is not drawn fully on the canvas at ${SKY_COLOUR_INSTANT.toISOString()}; the no-palette control is missing`);
  for (const [k, w] of Object.entries(m82.worst)) {
    if (w > M82_NEUTRAL_MAX_CHROMA) throw new Error(`M82 has no palette but its centre carries colour ${k === "grey" ? "at saturation 0" : `in ${k}`}: channel spread ${w} over ${M82_NEUTRAL_MAX_CHROMA} (all states ${JSON.stringify(m82.worst)})`);
  }
  const m82Spread = Math.max(...Object.values(m82.worst)) - Math.min(...Object.values(m82.worst));
  if (m82Spread > M82_MAX_STATE_SPREAD) throw new Error(`M82 has no palette but its centre's channel spread changes with saturation: ${JSON.stringify(m82.worst)}, spread ${m82Spread} over ${M82_MAX_STATE_SPREAD}`);
  const b = pixels.band;
  if (b.n < 5000) throw new Error(`only ${b.n} band pixels found (warmth moving between saturation 0 and 1, ${BAND_CLEAR_PX}px clear of objects)`);
  // The band (fix round 1): its own curve must give paper mode a real warmth
  // gain over saturation 0, not only the brightness its alpha gain adds, and
  // stargaze must still be warmer than paper.
  if (!(b.paperMean - b.greyMean >= BAND_MIN_WARMTH_GAIN)) {
    throw new Error(`the band's mean warmth (r-b) over ${b.n} pixels is ${b.greyMean.toFixed(2)} at saturation 0 and ${b.paperMean.toFixed(2)} in paper mode (stargaze ${b.stargazeMean.toFixed(2)}); paper must add at least ${BAND_MIN_WARMTH_GAIN}`);
  }
  if (!(b.stargazeMean - b.paperMean >= BAND_MIN_STARGAZE_OVER_PAPER)) {
    throw new Error(`the band's mean warmth over ${b.n} pixels is ${b.paperMean.toFixed(2)} in paper mode and ${b.stargazeMean.toFixed(2)} in stargaze; stargaze must add at least ${BAND_MIN_STARGAZE_OVER_PAPER}`);
  }

  // --- the ease, motion on ---
  const ease = await withPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    const sheet = await page.evaluate(() => {
      const r = document.querySelector("[data-sheet]").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.max(r.top, 0) + 240 };
    });
    await page.mouse.move(sheet.x, sheet.y);
    await page.waitForFunction((p) => window.__sky.saturation === p, PAPER_SATURATION, { timeout: 5000 });
    // Record every painted saturation value, per animation frame, for 1s.
    const record = () =>
      page.evaluate(
        () =>
          new Promise((res) => {
            const out = [];
            const t0 = performance.now();
            const tick = () => {
              const t = performance.now() - t0;
              out.push([Math.round(t), window.__sky.saturation]);
              if (t < 1000) requestAnimationFrame(tick);
              else res(out);
            };
            requestAnimationFrame(tick);
          }),
      );
    const summarise = (trace, from, to) => {
      const start = trace.find(([, v]) => v !== from);
      const end = trace.find(([, v]) => v === to);
      const values = [...new Set(trace.map(([, v]) => v))];
      const between = values.filter((v) => v > Math.min(from, to) && v < Math.max(from, to));
      let monotone = true;
      for (let i = 1; i < trace.length; i++) if ((to - from) * (trace[i][1] - trace[i - 1][1]) < 0) monotone = false;
      return { startMs: start?.[0] ?? null, settleMs: start && end ? end[0] - start[0] : null, between: between.length, monotone, final: trace[trace.length - 1][1] };
    };
    let pending = record();
    await page.mouse.move(60, 450);
    const up = summarise(await pending, PAPER_SATURATION, 1);
    pending = record();
    await page.mouse.move(sheet.x, sheet.y);
    const down = summarise(await pending, 1, PAPER_SATURATION);
    return { up, down };
  });
  for (const [dir, e, to] of [["onto the sky", ease.up, 1], ["back onto the sheet", ease.down, PAPER_SATURATION]]) {
    const s = JSON.stringify(e);
    if (e.final !== to) throw new Error(`easing ${dir} never reached ${to} within 1s: ${s}`);
    if (!e.monotone) throw new Error(`easing ${dir} reversed direction: ${s}`);
    if (e.between < EASE_MIN_PAINTED_STEPS) throw new Error(`easing ${dir} painted ${e.between} in-between values, under ${EASE_MIN_PAINTED_STEPS}: it snapped, or the frame gate did not rise (${s})`);
    if (e.settleMs > EASE_MAX_SETTLE_MS) throw new Error(`easing ${dir} took ${e.settleMs}ms, over ${EASE_MAX_SETTLE_MS}: ${s}`);
  }

  return `${ids.length} coloured objects across ${[...families].sort().join("/")}, paper's displayed colour share (constant ${PAPER_COLOUR_SHARE}, median ${medianShare.toFixed(2)}) and stargaze chroma shift at each object's most-moved pixel: ${notes.join(", ")}; hovered sky = stargaze, back on the sheet = paper exactly; M82 centre worst ${JSON.stringify(m82.worst)}; band mean warmth over ${b.n} px ${b.greyMean.toFixed(2)}/${b.paperMean.toFixed(2)}/${b.stargazeMean.toFixed(2)}, mean luminance ${b.lumGreyMean.toFixed(2)}/${b.lumPaperMean.toFixed(2)}/${b.lumStargazeMean.toFixed(2)}; ease up ${ease.up.settleMs}ms over ${ease.up.between} painted steps, down ${ease.down.settleMs}ms over ${ease.down.between}`;
}

async function checkStargazeCard(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  const m31Fact = SKY_FACTS.find((f) => f.id === "m31");
  const m31Summary = await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const card = page.locator("[data-sky-card]");

    // A drag that starts on Andromeda is a drag, not a click: no card.
    // Change 1 (2026-09-15): stargaze no longer springs a released drag
    // home on its own, so this asserts the hold, then reverses the same
    // drag to land back on exactly (0, 0) before the position-dependent
    // assertions below (which assume the sky is where p.x/p.y says it is).
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 40, p.y + 10, { steps: 6 });
    await page.mouse.up();
    // Colour round task 8: these two 1 s waits used to fail as a bare
    // "Timeout 1000ms exceeded" naming neither the wait nor the state, which
    // is the dead end this round already paid for once. Measured here: this
    // first one timed out on 1 of 3 full-suite runs (the check passes in
    // 10.2-10.6 s otherwise), always right after the heaviest checks in the
    // suite, so the suspicion is a loaded machine rather than a real
    // regression. The diagnostics are so the next failure says which.
    await page.waitForFunction(() => window.__sky.dragging === false, null, { timeout: 1000 }).catch(async () => {
      const snap = await page.evaluate(() => ({ dragging: window.__sky.dragging, offset: window.__sky.offset }));
      throw new Error(`the release of the (40, 10) stargaze drag never cleared window.__sky.dragging within 1s: ${JSON.stringify(snap)}`);
    });
    if ((await card.count()) !== 0) throw new Error("a drag opened a card");
    const heldInStargaze = await page.evaluate(() => ({ ...window.__sky.offset }));
    if (heldInStargaze.x === 0 && heldInStargaze.y === 0) {
      throw new Error("stargaze drag sprang home on release; change 1 says it should hold until exit");
    }
    await page.mouse.move(p.x + 40, p.y + 10);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 1000 }).catch(async () => {
      const snap = await page.evaluate(() => ({ dragging: window.__sky.dragging, offset: window.__sky.offset }));
      throw new Error(
        `the reverse drag did not put the sky back at offset (0, 0) within 1s: ${JSON.stringify(snap)} — every position-dependent assertion below assumes it did`,
      );
    });

    // A click on Andromeda opens its card: title, kind line, one-liner, a real citation link.
    await page.mouse.click(p.x, p.y);
    await card.waitFor({ state: "visible", timeout: 3000 });
    const content = await card.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      title: el.querySelector("h2")?.textContent,
      kind: el.querySelector("[data-sky-card-kind]")?.textContent,
      oneLiner: el.querySelector("[data-sky-card-oneliner]")?.textContent,
      links: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => ({
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        rel: a.getAttribute("rel"),
      })),
      box: el.getBoundingClientRect().toJSON(),
    }));
    if (content.id !== "m31" || content.title !== "Andromeda Galaxy") throw new Error(`card opened for ${content.id} "${content.title}"`);
    if (content.kind !== m31Fact.kind) throw new Error(`kind line "${content.kind}", fact says "${m31Fact.kind}"`);
    if (content.oneLiner !== m31Fact.oneLiner) throw new Error(`one-liner "${content.oneLiner}", fact says "${m31Fact.oneLiner}"`);
    if (!content.links.length || !content.links.every((l) => /^https?:\/\//.test(l.href) && l.target === "_blank" && l.rel === "noopener")) {
      throw new Error(`citation links ${JSON.stringify(content.links)}`);
    }
    const { box } = content;
    if (box.left < 0 || box.top < 0 || box.right > W || box.bottom > H) throw new Error(`card ${JSON.stringify(box)} leaves the viewport`);

    // Fix round 1, I3: opening a card moves focus inside it (Tab reaches the
    // close button and the source links without first passing back through
    // the page).
    const focusedInCard = await page.evaluate(() => !!document.activeElement?.closest("[data-sky-card]"));
    if (!focusedInCard) throw new Error("focus did not move into the opened card");

    // The card follows its subject while the sky is dragged (from empty sky).
    const empty = await emptySkyPoint(page, { x: p.x, y: p.y, r: 420 });
    if (!empty) throw new Error("no empty sky to drag from");
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down();
    await page.mouse.move(empty.x - 100, empty.y, { steps: 10 });
    await page.waitForFunction(() => Math.abs(window.__sky.offset.x + 100) < 2, null, { timeout: 2000 });
    const dragged = await card.evaluate((el) => el.getBoundingClientRect().left);
    await page.mouse.up();
    if (Math.abs(dragged - (box.left - 100)) > 3) throw new Error(`card at ${dragged} during a -100px drag, was ${box.left}`);
    if ((await card.count()) !== 1) throw new Error("the drag closed the card");

    // Escape closes the card first; stargaze stays on. A second Escape exits.
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });
    if (!(await page.evaluate(() => document.body.hasAttribute("data-stargaze")))) {
      throw new Error("the first Escape exited stargaze instead of closing the card");
    }
    // Fix round 1, I3: focus returns to the stargaze exit control, not lost
    // to the body, once the card it was on is gone. (Final review F3: only
    // because focus was inside the card; the card took it on open.)
    const focusedAfterEscape = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (focusedAfterEscape !== STARGAZE_EXIT) {
      throw new Error(`focus after closing the card is on "${focusedAfterEscape}", not the exit control`);
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 3000 });

    // Back in: a click on empty sky closes an open card.
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.click(p.x, p.y);
    await card.waitFor({ state: "visible", timeout: 3000 });
    const blank = await emptySkyPoint(page, { x: p.x, y: p.y, r: 60 });
    if (!blank) throw new Error("no empty sky to click");
    await page.mouse.click(blank.x, blank.y);
    await card.waitFor({ state: "detached", timeout: 2000 });

    // Final review F1: a drawn name is a hit target. Click the middle of an
    // object's name box, at least 20px from its own symbol (well outside the
    // 12px symbol radius, so only the box can be what selects it). F6: the
    // Milky Way, which has no symbol, is selected by its label box the same way.
    const nameTarget = (wantMilkyWay) =>
      page.evaluate((wantMilkyWay) => {
        const hits = window.__sky.hits;
        // Why each candidate was rejected. Without this, "not clickable" is a
        // dead end: the colour round hit exactly that when the Double Cluster
        // landed on the band's label, and the message named neither the
        // culprit nor the reason (colour round, 2026-09-15).
        const why = [];
        // The contract is that the drawn NAME is a hit target, not that one
        // exact pixel of it is. A name box is ~55-80px wide and the sky is
        // crowded, so a neighbouring symbol can easily cover its midpoint
        // while most of the text stays clickable. Probe across the box and
        // take the first clear point (colour round, 2026-09-15: the Double
        // Cluster sits inside the Milky Way and lands on the band's label at
        // several of the band's anchors, which is not a defect so much as two
        // real objects occupying the same patch of sky).
        const spanOf = (box) => {
          const y = box.y + box.h / 2;
          const pts = [];
          for (const f of [0.5, 0.3, 0.7, 0.18, 0.82]) pts.push({ x: box.x + box.w * f, y });
          return pts;
        };
        for (const h of hits) {
          if (!h.box || (h.id === "milky-way") !== wantMilkyWay) continue;
          let picked = null;
          const reasons = [];
          for (const cand of spanOf(h.box)) {
            const cx = cand.x;
            const cy = cand.y;
            if (!wantMilkyWay && Math.hypot(cx - h.x, cy - h.y) < 20) { reasons.push("too near its own symbol"); continue; }
            if (cy < 80 || cy > window.innerHeight - 120 || cx < 20 || cx > window.innerWidth - 20) { reasons.push(`(${cx.toFixed(0)}, ${cy.toFixed(0)}) outside the safe area`); continue; }
            const blk = hits.filter((o) => o !== h && ((o.box && cx >= o.box.x && cx <= o.box.x + o.box.w && cy >= o.box.y && cy <= o.box.y + o.box.h) || Math.hypot(o.x - cx, o.y - cy) < 20));
            if (blk.length) { reasons.push(`(${cx.toFixed(0)}, ${cy.toFixed(0)}) covered by ${blk.map((o) => `${o.id}@${Math.hypot(o.x - cx, o.y - cy).toFixed(0)}px`).join(", ")}`); continue; }
            if (document.elementFromPoint(cx, cy)?.closest("button, a, [data-sky-card], [data-sky-credit]")) { reasons.push(`(${cx.toFixed(0)}, ${cy.toFixed(0)}) under page chrome`); continue; }
            picked = { id: h.id, x: cx, y: cy, symbolDist: Math.hypot(cx - h.x, cy - h.y) };
            break;
          }
          if (picked) return picked;
          why.push(`${h.id}: ${reasons.join("; ")}`);
        }
        return { none: true, why };
      }, wantMilkyWay);
    const clickName = async (t) => {
      await page.mouse.click(t.x, t.y);
      await page.locator(`[data-sky-card="${t.id}"]`).waitFor({ state: "visible", timeout: 3000 }).catch(async () => {
        const open = await page.evaluate(() => window.__sky.card);
        throw new Error(`clicking ${t.id}'s name at (${t.x.toFixed(0)}, ${t.y.toFixed(0)}) opened ${open}`);
      });
      await page.keyboard.press("Escape");
      await card.waitFor({ state: "detached", timeout: 2000 });
    };
    const named = await nameTarget(false);
    if (named.none) throw new Error(`no clickable object name box on screen: ${named.why.join("; ") || "no candidates at all"}`);
    await clickName(named);
    const mwName = await nameTarget(true);
    if (mwName.none) {
      throw new Error(`the Milky Way's label box is not clickable on screen: ${mwName.why.join("; ") || "the band drew no label"}`);
    }
    await clickName(mwName);

    // Final review F3: a subject leaving the viewport leaves its card open,
    // with the out-of-view line, until the visitor closes it; the line clears
    // when the subject comes back. Take a lone hit near an edge, open it, and
    // drag the sky from empty space until the hit is past that edge (under
    // the rubber band's 450px limit, so the drag moves it 1:1).
    const edgy = await page.evaluate(() => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      for (const h of window.__sky.hits) {
        // Not the Milky Way: its label hops to whichever anchor is on screen.
        if (h.boxOnly || h.id === "milky-way" || h.y < 90 || h.y > H - 130) continue;
        if (window.__sky.hits.some((o) => o !== h && (Math.hypot(o.x - h.x, o.y - h.y) < 30 || (o.box && h.x >= o.box.x - 4 && h.x <= o.box.x + o.box.w + 4 && h.y >= o.box.y - 4 && h.y <= o.box.y + o.box.h + 4)))) continue;
        const edges = [
          { dir: [-1, 0], d: h.x },
          { dir: [1, 0], d: W - h.x },
        ].filter((e) => e.d > 40 && e.d < 360);
        if (edges.length) return { id: h.id, x: h.x, y: h.y, ...edges[0] };
      }
      return null;
    });
    if (!edgy) throw new Error("no lone hit within 360px of a side edge");
    await page.mouse.click(edgy.x, edgy.y);
    const edgyCard = page.locator(`[data-sky-card="${edgy.id}"]`);
    await edgyCard.waitFor({ state: "visible", timeout: 3000 });
    const travel = Math.round(edgy.d + 60);
    const startBounds =
      edgy.dir[0] < 0 ? { left: travel + 20, right: W - 20, top: 100, bottom: H - 140 } : { left: 20, right: W - travel - 20, top: 100, bottom: H - 140 };
    const dragFrom = await emptySkyPoint(page, { x: edgy.x, y: edgy.y, r: 60 }, startBounds);
    if (!dragFrom) throw new Error(`no empty sky to drag ${edgy.id} out of view from`);
    await page.mouse.move(dragFrom.x, dragFrom.y);
    await page.mouse.down();
    await page.mouse.move(dragFrom.x + edgy.dir[0] * travel, dragFrom.y, { steps: 12 });
    await page.waitForFunction(() => window.__sky.cardOutOfView === true, null, { timeout: 3000 }).catch(async () => {
      const snap = await page.evaluate((id) => ({ offset: window.__sky.offset, dragging: window.__sky.dragging, hit: window.__sky.hits.find((h) => h.id === id) ?? null, card: window.__sky.card }), edgy.id);
      throw new Error(`${edgy.id} (${JSON.stringify(edgy)}) never went out of view after a ${travel}px drag from ${JSON.stringify(dragFrom)}: ${JSON.stringify(snap)}`);
    });
    const gone = await page.evaluate((id) => ({
      hit: window.__sky.hits.some((h) => h.id === id),
      card: document.querySelector("[data-sky-card]")?.getAttribute("data-sky-card") ?? null,
      line: document.querySelector("[data-sky-card-out-of-view]")?.textContent ?? null,
      box: document.querySelector("[data-sky-card]")?.getBoundingClientRect().toJSON() ?? null,
    }), edgy.id);
    if (gone.hit) throw new Error(`${edgy.id} still among the hits after a ${travel}px drag`);
    if (gone.card !== edgy.id) throw new Error(`card ${gone.card} open once ${edgy.id} left the viewport; it should stay open`);
    if (gone.line !== copy.stargaze.card.outOfView) throw new Error(`out-of-view line ${JSON.stringify(gone.line)}`);
    if (gone.box.left < 0 || gone.box.top < 0 || gone.box.right > W || gone.box.bottom > H) throw new Error(`out-of-view card ${JSON.stringify(gone.box)} left the viewport`);
    // Change 1 (2026-09-15): stargaze no longer snaps a released drag home,
    // so the subject is brought back the same way it left, still dragging,
    // and the line clears once it's back rather than on release.
    await page.mouse.move(dragFrom.x, dragFrom.y, { steps: 12 });
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 2000 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__sky.cardOutOfView === false, null, { timeout: 3000 }).catch(() => {
      throw new Error(`${edgy.id}'s card still out of view after the drag returned it`);
    });
    if ((await page.locator("[data-sky-card-out-of-view]").count()) !== 0) throw new Error("out-of-view line stayed after the subject came back");
    if ((await edgyCard.count()) !== 1) throw new Error(`${edgy.id}'s card closed when its subject came back`);
    return `drag opened nothing; card "${content.title}" / "${content.kind}" with one-liner "${content.oneLiner}" and ${content.links.length} source link(s); followed a -100px drag; Escape closed it, second Escape exited; empty click closed it; focus moved into the card and back to the exit control after Escape; clicking ${named.id}'s name ${named.symbolDist.toFixed(0)}px from its symbol opened its card, and the Milky Way's label box opened its card; ${edgy.id} dragged ${travel}px out of view kept its card open with "${gone.line}", cleared on return`;
  });

  // Fix round 1, I2: the spacecraft branch (Voyager 1), a planet, and the
  // Moon, each opened at its own pinned instant (three separate page loads,
  // like checkSkyObjects does for multiple bodies) so their title and
  // extra-line branches are actually exercised, not just M31's.
  const CW = 1440;
  const CH = 900;

  const voyagerFact = SKY_FACTS.find((f) => f.id === "voyager-1");
  const vInstant = findInstant(new Date(Date.UTC(2026, 9, 1)), CW, CH, { raDeg: VOYAGER1.raDeg, decDeg: VOYAGER1.decDeg }, 100);
  const voyager = await openHitCard(browser, { W: CW, H: CH, date: vInstant.date, hitId: "voyager-1" });
  if (voyager.id !== "voyager-1" || voyager.title !== VOYAGER1.name) {
    throw new Error(`voyager card opened for ${voyager.id} "${voyager.title}"`);
  }
  if (voyager.oneLiner !== voyagerFact.oneLiner) {
    throw new Error(`voyager one-liner "${voyager.oneLiner}", fact says "${voyagerFact.oneLiner}"`);
  }
  const spacecraftLine = `${copy.stargaze.card.spacecraftPre}${cardLongDate(VOYAGER1.positionDate)}${copy.stargaze.card.spacecraftMid}${VOYAGER1.distanceAu.toFixed(1)}${copy.stargaze.card.spacecraftPost}`;
  if (!voyager.dataLines.includes(spacecraftLine)) {
    throw new Error(`voyager data lines ${JSON.stringify(voyager.dataLines)} missing "${spacecraftLine}"`);
  }

  const marsFact = SKY_FACTS.find((f) => f.id === "mars");
  const mInstant = findInstantMoving(new Date(Date.UTC(2026, 9, 1)), CW, CH, (ms) => planetEquatorial("Mars", ms), 100);
  const mars = await openHitCard(browser, { W: CW, H: CH, date: mInstant.date, hitId: "mars" });
  if (mars.id !== "mars" || mars.title !== "Mars") throw new Error(`planet card opened for ${mars.id} "${mars.title}"`);
  if (mars.kind !== marsFact.kind) throw new Error(`Mars kind "${mars.kind}", fact says "${marsFact.kind}"`);
  if (mars.oneLiner !== marsFact.oneLiner) throw new Error(`Mars one-liner "${mars.oneLiner}", fact says "${marsFact.oneLiner}"`);

  const moonFact = SKY_FACTS.find((f) => f.id === "moon");
  const moonInstant = findInstantMoving(new Date(Date.UTC(2026, 9, 1)), CW, CH, (ms) => moonEquatorial(ms), 100);
  const moon = await openHitCard(browser, { W: CW, H: CH, date: moonInstant.date, hitId: "moon" });
  if (moon.id !== "moon" || moon.title !== copy.stargaze.card.titleMoon) {
    throw new Error(`Moon card opened for ${moon.id} "${moon.title}"`);
  }
  if (moon.oneLiner !== moonFact.oneLiner) throw new Error(`Moon one-liner "${moon.oneLiner}", fact says "${moonFact.oneLiner}"`);

  // ---- colour round task 8 step 2: the deep-sky objects this round added,
  // and the colour note's gate. One page load at SKY_COLOUR_INSTANT opens
  // every galaxy/nebula/cluster card on screen, rather than a page load per
  // object; each is opened through its keyboard-list button, which is both
  // the reliable way to reach M81 and M82 (4.7px apart, so a canvas click
  // cannot separate them) and an `element.click()` inside page.evaluate, the
  // only form those buttons respond to.
  const objectCards = await pinnedSkyPage(browser, { W, H, date: SKY_COLOUR_INSTANT }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });

    const onScreen = await page.evaluate((ids) => window.__sky.hits.filter((h) => ids.includes(h.id)).map((h) => h.id), DEEP_SKY_IDS);
    const open = onScreen.slice().sort();
    const coloured = open.filter((id) => OBJECT_COLOURS[id] !== undefined);
    const emission = coloured.filter((id) => EMISSION_LINE_COLOURED.has(id));
    // The colour note is only worth checking if both sides are represented.
    // M82 is named explicitly because it is the ONLY catalog object with no
    // palette: without it this is a check that every card shows the note.
    if (!open.includes("m82")) {
      throw new Error(`M82, the one deep-sky object with no palette, is not drawn at ${SKY_COLOUR_INSTANT.toISOString()}; the colour note's gate would be untested. Drawn deep-sky objects: ${open.join(", ") || "none"}`);
    }
    if (coloured.length < 3) throw new Error(`only ${coloured.length} coloured deep-sky objects on screen (${coloured.join(", ") || "none"}); the brief wants at least three`);
    if (!emission.length) throw new Error(`no emission-line-coloured object among ${coloured.join(", ")}; the Lodriguss citation's gate would be untested`);
    if (emission.length === coloured.length) throw new Error(`every coloured object on screen (${coloured.join(", ")}) is emission-line coloured; the "no Lodriguss citation" side would be untested`);

    const seen = [];
    for (const id of open) {
      const button = page.locator(`[data-sky-list-item="${id}"]`);
      if ((await button.count()) !== 1) throw new Error(`${id} is drawn but has no keyboard-list button`);
      await button.evaluate((el) => el.click());
      const card = page.locator(`[data-sky-card="${id}"]`);
      await card.waitFor({ state: "visible", timeout: 3000 }).catch(async () => {
        const opened = await page.evaluate(() => window.__sky.card);
        throw new Error(`the keyboard-list button for ${id} opened ${JSON.stringify(opened)} instead of ${id}'s card`);
      });
      const content = await card.evaluate((el) => ({
        title: el.querySelector("h2")?.textContent,
        kind: el.querySelector("[data-sky-card-kind]")?.textContent,
        colourNote: el.querySelector("[data-sky-card-colour-note]")?.textContent ?? null,
        links: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => ({
          href: a.getAttribute("href"),
          target: a.getAttribute("target"),
          rel: a.getAttribute("rel"),
        })),
      }));
      const object = OBJECTS_DATA.objects.find((o) => o.id === id);
      const fact = SKY_FACTS.find((f) => f.id === id);
      if (content.title !== object.name) throw new Error(`${id}'s card is titled ${JSON.stringify(content.title)}, the catalog says ${JSON.stringify(object.name)}`);
      if (!fact) throw new Error(`${id} opens a card but has no entry in content/sky-facts.ts`);
      if (content.kind !== fact.kind) throw new Error(`${id}'s kind line is ${JSON.stringify(content.kind)}, its fact says ${JSON.stringify(fact.kind)}`);
      const cited = content.links.filter((l) => /^https?:\/\//.test(l.href) && l.target === "_blank" && l.rel === "noopener");
      if (!cited.length) throw new Error(`${id}'s card carries no citation link; its Sources list is ${JSON.stringify(content.links)}`);

      // The note is gated on the palette table, not blanket. M82 is what
      // makes this assertion mean anything: it has a card, a kind line and
      // citations like every other object, and no colour note.
      const wantNote = OBJECT_COLOURS[id] !== undefined;
      if (wantNote !== (content.colourNote !== null)) {
        throw new Error(
          wantNote
            ? `${id} is drawn in sourced colour (OBJECT_COLOURS has a palette for it) but its card shows no colour note`
            : `${id} has NO palette in OBJECT_COLOURS, so it draws grey, yet its card shows the colour note ${JSON.stringify(content.colourNote)} — the note is blanket, not gated`,
        );
      }
      if (wantNote) {
        if (!content.colourNote.startsWith(copy.stargaze.card.colourNote)) {
          throw new Error(`${id}'s colour note reads ${JSON.stringify(content.colourNote)}, which does not start with copy.stargaze.card.colourNote`);
        }
        // The emission-line sentence, and the Lodriguss citation that backs
        // it, ride the same set: present on both sides or neither.
        const wantLines = EMISSION_LINE_COLOURED.has(id);
        const hasLines = content.colourNote.includes(copy.stargaze.card.colourNoteLines);
        if (wantLines !== hasLines) {
          throw new Error(
            wantLines
              ? `${id} is in EMISSION_LINE_COLOURED but its colour note omits the emission-line sentence: ${JSON.stringify(content.colourNote)}`
              : `${id} is NOT in EMISSION_LINE_COLOURED (its colour is star temperature or scattering) yet its note claims emission lines: ${JSON.stringify(content.colourNote)}`,
          );
        }
        const hasLodriguss = content.links.some((l) => l.href === EMISSION_LINE_COLOUR.url);
        // A fact may cite the same page itself; SkyCard dedupes, so only an
        // id whose own fact does not cite it proves the appending.
        const factCites = fact.citations.some((c) => c.url === EMISSION_LINE_COLOUR.url);
        if (wantLines && !hasLodriguss) throw new Error(`${id}'s note names emission lines but its Sources list lacks ${EMISSION_LINE_COLOUR.url}`);
        if (!wantLines && !factCites && hasLodriguss) {
          throw new Error(`${id} does not rest on an emission line, and its own fact does not cite Lodriguss, yet the citation is on its card`);
        }
      }
      seen.push(`${id}${wantNote ? (EMISSION_LINE_COLOURED.has(id) ? "+note+lines" : "+note") : "+NO note"}/${cited.length} cite`);
      await page.keyboard.press("Escape");
      await card.waitFor({ state: "detached", timeout: 2000 });
    }
    return `${open.length} deep-sky cards at ${SKY_COLOUR_INSTANT.toISOString()} (${coloured.length} coloured, ${emission.length} emission-line, M82 grey): ${seen.join(", ")}`;
  });

  return `${m31Summary}; voyager-1 card "${voyager.title}" data "${spacecraftLine}"; planet card "${mars.title}" / "${mars.kind}"; Moon card "${moon.title}" / "${moon.kind}"; ${objectCards}`;
}

/**
 * Final review F2: keyboard and screen-reader users reach every card. In
 * stargaze, a visually hidden list of buttons, one per selectable on screen
 * (every drawn hit plus every constellation with a segment in view), sits
 * right after the exit control: Tab from the exit lands in it, the focused
 * button rings its subject (window.__sky.highlight), Enter opens that
 * subject's card with focus inside it, and Escape hands focus back to the
 * same button.
 */
async function checkStargazeKeyboardList(browser) {
  const W = 1440;
  const H = 900;
  const { date } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  return pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });
    const onExit = await page.evaluate(() => document.activeElement?.hasAttribute("data-stargaze-exit"));
    if (!onExit) throw new Error("entering stargaze did not focus the exit control");

    const list = await page.evaluate(() => ({
      items: [...document.querySelectorAll("[data-sky-list-item]")].map((b) => ({ id: b.getAttribute("data-sky-list-item"), label: b.textContent })),
      hits: window.__sky.hits.map((h) => h.id),
      group: document.querySelector("[data-sky-list]")?.getAttribute("aria-label"),
    }));
    if (list.group !== copy.stargaze.listLabel) throw new Error(`list group named ${JSON.stringify(list.group)}`);
    const listed = new Set(list.items.map((i) => i.id));
    const missing = list.hits.filter((id) => !listed.has(id));
    if (missing.length) throw new Error(`drawn hits missing from the keyboard list: ${missing}`);
    const constellations = list.items.filter((i) => ABBRS.includes(i.id));
    if (!constellations.length) throw new Error("no constellation in the keyboard list");
    for (const item of list.items) {
      const fact = SKY_FACTS.find((f) => f.id === item.id);
      if (!fact || !item.label.endsWith(`, ${fact.kind}`)) throw new Error(`list button ${item.id} named "${item.label}", fact kind "${fact?.kind}"`);
    }
    // Stable order: symbols, then constellations, each sorted by name.
    const symbols = list.items.filter((i) => !ABBRS.includes(i.id));
    const sorted = (xs) => xs.every((x, i) => i === 0 || xs[i - 1].label.localeCompare(x.label, "en") <= 0);
    if (!sorted(symbols) || !sorted(constellations) || list.items.findIndex((i) => ABBRS.includes(i.id)) !== symbols.length) {
      throw new Error("keyboard list is not in its stable order");
    }

    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement?.getAttribute("data-sky-list-item"));
    if (first !== list.items[0].id) throw new Error(`Tab from the exit control landed on ${JSON.stringify(first)}, not the first list button ${list.items[0].id}`);
    await page.waitForFunction((id) => window.__sky.highlight === id, first, { timeout: 3000 });

    await page.keyboard.press("Enter");
    const card = page.locator(`[data-sky-card="${first}"]`);
    await card.waitFor({ state: "visible", timeout: 3000 });
    const inCard = await page.evaluate(() => !!document.activeElement?.closest("[data-sky-card]"));
    if (!inCard) throw new Error("Enter opened the card but focus is not inside it");
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });
    const back = await page.evaluate(() => document.activeElement?.getAttribute("data-sky-list-item"));
    if (back !== first) throw new Error(`after Escape, focus is on ${JSON.stringify(back)}, not the list button that opened the card`);
    if (!(await page.evaluate(() => document.body.hasAttribute("data-stargaze")))) throw new Error("Escape from the card left stargaze");
    return `${list.items.length} buttons (${symbols.length} symbols, ${constellations.length} constellations), every drawn hit listed; Tab from exit -> "${list.items[0].label}", ringed; Enter opened its card with focus inside; Escape returned focus to the button`;
  });
}

/**
 * Final review F1/F6 and the phone card, at 400x800 with touch emulated
 * (Playwright's Firefox dispatches real pointerType "touch" events for
 * touchscreen.tap, and `(hover: none)` matches): the touch hint; a tap 18px
 * from a symbol opens its card (outside the 12px mouse radius, inside the
 * 22px touch radius, and a mouse click at the same point does not); the
 * docked card stays within 60% of the viewport height with no text under
 * 12px; and the Milky Way, which has no canvas hit below 880px, is still in
 * the keyboard list.
 */
async function checkStargazeTouch400(browser) {
  const W = 400;
  const H = 800;
  const date = new Date(Date.UTC(2026, 9, 1, 6));
  return pinnedSkyPage(browser, { W, H, date, contextOptions: { hasTouch: true } }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const hint = await page.locator("[data-stargaze-exit]").evaluate((el) => el.parentElement.querySelector("span")?.textContent);
    if (hint !== copy.stargaze.hintTouch) throw new Error(`touch hint reads ${JSON.stringify(hint)}`);

    // A lone hit with a tap point 18px to one side that no name box covers,
    // no other symbol is within 24px of, and no control sits on.
    const target = await page.evaluate(() => {
      const hits = window.__sky.hits;
      const inBox = (b, x, y) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      for (const h of hits) {
        if (h.id === "milky-way") continue;
        for (const [dx, dy] of [[-18, 0], [0, 18], [18, 0], [0, -18]]) {
          const x = h.x + dx;
          const y = h.y + dy;
          if (y < 80 || y > window.innerHeight * 0.35 || x < 10 || x > window.innerWidth - 10) continue;
          if (hits.some((o) => inBox(o.box, x, y) || (o !== h && Math.hypot(o.x - x, o.y - y) < 30))) continue;
          if (document.elementFromPoint(x, y)?.closest("button, a, [data-sky-card], [data-sky-credit]")) continue;
          return { id: h.id, x, y };
        }
      }
      return null;
    });
    if (!target) throw new Error(`no lone symbol with a clear 18px tap point at ${date.toISOString()}`);

    // A mouse click 18px away is outside the 12px pointer radius: not this card.
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(200);
    const mouseCard = await page.evaluate(() => document.querySelector("[data-sky-card]")?.getAttribute("data-sky-card") ?? null);
    if (mouseCard === target.id) throw new Error(`a mouse click 18px from ${target.id} opened its card; the pointer radius is 12px`);
    if (mouseCard) {
      await page.keyboard.press("Escape");
      await page.locator("[data-sky-card]").waitFor({ state: "detached", timeout: 2000 });
    }

    await page.touchscreen.tap(target.x, target.y);
    const card = page.locator(`[data-sky-card="${target.id}"]`);
    await card.waitFor({ state: "visible", timeout: 3000 });
    const sizes = await card.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      bottom: el.getBoundingClientRect().bottom,
      fonts: [...el.querySelectorAll("p, h3, li, button")].map((n) => parseFloat(getComputedStyle(n).fontSize)),
    }));
    if (sizes.height > 0.6 * H + 2) throw new Error(`phone card ${sizes.height}px tall, over 60% of ${H}`);
    if (Math.abs(sizes.bottom - H) > 1) throw new Error(`phone card bottom at ${sizes.bottom}, not docked to ${H}`);
    const small = Math.min(...sizes.fonts);
    if (small < 12) throw new Error(`phone card has ${small}px text`);

    const mw = await page.evaluate(() => ({
      anchor: window.__sky.milkyWay,
      hit: window.__sky.hits.some((h) => h.id === "milky-way"),
      listed: !!document.querySelector('[data-sky-list-item="milky-way"]'),
    }));
    if (mw.hit) throw new Error("the Milky Way has a canvas hit below 880px (an invisible target)");
    if (!mw.anchor) throw new Error(`the Milky Way's label point is off screen at ${date.toISOString()}; pick another instant`);
    await page.waitForFunction(() => !!document.querySelector('[data-sky-list-item="milky-way"]'), null, { timeout: 3000 });

    // Discoverability Task 4: below 880px the coloured objects draw their
    // names, and a name is a tap target. Every name box on screen must belong
    // to a planet, the Moon or an OBJECT_COLOURS id, at least one coloured
    // object must carry one, and tapping inside it (clear of every symbol)
    // opens that object's card.
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });
    const coloured = Object.keys(OBJECT_COLOURS);
    const phoneNames = await page.evaluate((coloured) => {
      const always = new Set(["mercury", "venus", "mars", "jupiter", "saturn", "moon"]);
      const boxed = window.__sky.hits.filter((h) => h.box);
      const stray = boxed.filter((h) => !always.has(h.id) && !coloured.includes(h.id)).map((h) => h.id);
      const named = boxed.filter((h) => coloured.includes(h.id)).map((h) => h.id);
      for (const h of boxed) {
        if (!coloured.includes(h.id)) continue;
        const b = h.box;
        const x = b.x + b.w / 2;
        const y = b.y + b.h / 2;
        if (y < 80 || y > window.innerHeight * 0.35 || x < 4 || x > window.innerWidth - 4) continue;
        if (window.__sky.hits.some((o) => Math.hypot(o.x - x, o.y - y) < 24)) continue;
        if (window.__sky.hits.some((o) => o !== h && o.box && x >= o.box.x && x <= o.box.x + o.box.w && y >= o.box.y && y <= o.box.y + o.box.h)) continue;
        if (document.elementFromPoint(x, y)?.closest("button, a, [data-sky-card], [data-sky-credit]")) continue;
        return { stray, named, tap: { id: h.id, x, y } };
      }
      return { stray, named, tap: null };
    }, coloured);
    if (phoneNames.stray.length) throw new Error(`at ${W}px, name boxes for uncoloured ids: ${phoneNames.stray.join(", ")}`);
    if (!phoneNames.named.length) throw new Error(`at ${W}px in stargaze, no coloured object carries a name box at ${date.toISOString()}`);
    if (!phoneNames.tap) throw new Error(`coloured names ${phoneNames.named.join(", ")} drawn, but none has a box centre clear of symbols and controls to tap`);
    await page.touchscreen.tap(phoneNames.tap.x, phoneNames.tap.y);
    await page.locator(`[data-sky-card="${phoneNames.tap.id}"]`).waitFor({ state: "visible", timeout: 3000 }).catch(async () => {
      const open = await page.evaluate(() => document.querySelector("[data-sky-card]")?.getAttribute("data-sky-card") ?? null);
      throw new Error(`a tap on ${phoneNames.tap.id}'s name box at (${phoneNames.tap.x.toFixed(0)}, ${phoneNames.tap.y.toFixed(0)}) opened ${open ?? "nothing"}`);
    });
    return `touch hint; mouse click 18px from ${target.id} ${mouseCard ? `opened ${mouseCard}` : "opened nothing"}, a touch tap there opened ${target.id}; card ${sizes.height.toFixed(0)}px of ${H} (<= 60%), docked, smallest text ${small}px; Milky Way: no canvas hit, in the keyboard list; phone names on ${phoneNames.named.length} coloured objects, none on others, a tap on ${phoneNames.tap.id}'s name opened its card`;
  });
}

/** A real ISS element set (CelesTrak, fetched 2026-09-15), served in place of the route. */
const ISS_TLE = {
  name: "ISS (ZARYA)",
  line1: "1 25544U 98067A   26258.17538348  .00006015  00000+0  11677-3 0  9998",
  line2: "2 25544  51.6311 214.7209 0004917 142.0099 218.1237 15.49120584585708",
  epoch: "2026-09-15T04:12:33.132Z",
  fetchedAt: "2026-09-15T15:53:34.000Z",
};

/**
 * The first instant in the 24 h after the TLE's epoch (30 s steps) when the
 * ISS is more than 20° up over Moffett Field and lands 80px inside W x H.
 * Computed independently of lib/sky-iss.ts: satellite.js's own look angles,
 * converted to RA/Dec of date by the horizon-to-equatorial formulas, then to
 * J2000 by astronomy-engine.
 */
function findIssInstant(W, H) {
  const D2R = Math.PI / 180;
  const satrec = satellite.twoline2satrec(ISS_TLE.line1, ISS_TLE.line2);
  const site = { longitude: MOFFETT_LON * D2R, latitude: 37.4153 * D2R, height: 0.01 };
  const epoch = Date.parse(ISS_TLE.epoch);
  for (let ms = epoch; ms < epoch + 24 * 3600e3; ms += 30e3) {
    const date = new Date(ms);
    const pv = satellite.propagate(satrec, date);
    const gmst = satellite.gstime(date);
    const look = satellite.ecfToLookAngles(site, satellite.eciToEcf(pv.position, gmst));
    if (look.elevation / D2R < 20) continue;
    const phi = site.latitude;
    const A = look.azimuth;
    const h = look.elevation;
    const dec = Math.asin(Math.sin(phi) * Math.sin(h) + Math.cos(phi) * Math.cos(h) * Math.cos(A));
    const HA = Math.atan2(-Math.sin(A) * Math.cos(h), Math.sin(h) * Math.cos(phi) - Math.cos(h) * Math.cos(A) * Math.sin(phi));
    const raOfDate = (gmst + site.longitude - HA) / D2R;
    const time = new Astronomy.AstroTime(date);
    const v = Astronomy.RotateVector(
      Astronomy.Rotation_EQD_EQJ(time),
      Astronomy.VectorFromSphere(new Astronomy.Spherical(dec / D2R, raOfDate, 1), time),
    );
    const eq = Astronomy.EquatorFromVector(v);
    const p = specProject(W, H, lstAt(date), eq.ra * 15, eq.dec);
    if (p.x > 80 && p.x < W - 80 && p.y > 80 && p.y < H - 80) return { date, p, elevation: h / D2R };
  }
  throw new Error("the fixture TLE never puts the ISS 20° up and on screen in 24 h");
}

// Fix round 1, folded minor: 3 runs against the fixture TLE at the pinned
// instant all measured the SAME 0.02px (a pinned clock plus pure math has no
// room for run-to-run variance here), well inside the old 3px slack. Tightened
// to 2px rather than to the measured value itself, to leave headroom for a
// different machine's floating-point rounding without being so tight a real
// regression could hide under it.
const ISS_POSITION_TOLERANCE_PX = 2;

// Fix round 1, folded minor: on the {tle:null} page we now collect every
// console error, not only ones mentioning iss/satellite/NightSky — a route
// bug or an unrelated regression could log something that doesn't happen to
// match those words. Entries here are messages seen, confirmed unrelated to
// this check, and confirmed harmless; an empty list is the correct default,
// not a placeholder to fill in preemptively.
const ISS_KNOWN_HARMLESS_CONSOLE = [];

async function checkSkyIss(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p, elevation } = findIssInstant(W, H);
  const issPage = (body, fn, { motion = false, strictConsole = false } = {}) =>
    withPage(
      browser,
      { viewport: { width: W, height: H }, reducedMotion: motion ? "no-preference" : "reduce", deviceScaleFactor: 1 },
      async (page, context) => {
        const errors = [];
        page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
        page.on("console", (msg) => {
          if (msg.type() !== "error") return;
          const text = msg.text();
          if (strictConsole) {
            if (ISS_KNOWN_HARMLESS_CONSOLE.some((re) => re.test(text))) return;
            errors.push(`console: ${text}`);
          } else if (/iss|satellite|NightSky/i.test(text)) {
            errors.push(`console: ${text}`);
          }
        });
        await context.route("**/api/iss-tle", (route) =>
          route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
        );
        await page.clock.setFixedTime(date);
        await page.goto(BASE, { waitUntil: "networkidle" });
        await waitSkyDrawn(page);
        const out = await fn(page);
        if (errors.length) throw new Error(errors.join(" | "));
        return out;
      },
      { stubIssTle: false },
    );

  const t = copy.stargaze.card;
  let posErrPx = 0;
  const present = await issPage(ISS_TLE, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.iss === "ready" && window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    const iss = await page.evaluate(() => window.__sky.iss);
    if (!iss) throw new Error(`no ISS drawn at ${date.toISOString()} (elevation ${elevation.toFixed(1)}°)`);
    posErrPx = Math.hypot(iss.x - p.x, iss.y - p.y);
    if (posErrPx > ISS_POSITION_TOLERANCE_PX) {
      throw new Error(
        `ISS drawn at (${iss.x.toFixed(1)}, ${iss.y.toFixed(1)}), independent computation says (${p.x.toFixed(1)}, ${p.y.toFixed(1)}), off by ${posErrPx.toFixed(2)}px`,
      );
    }
    if (!iss.aboveHorizon) throw new Error(`ISS reported below the horizon at ${elevation.toFixed(1)}° elevation`);
    const peak = await skyPeak(page, p.x, p.y, 3);

    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.click(p.x, p.y);
    const card = page.locator("[data-sky-card]");
    await card.waitFor({ state: "visible", timeout: 3000 });
    const content = await card.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      title: el.querySelector("h2")?.textContent,
      data: [...el.querySelectorAll("[data-sky-card-data]")].map((d) => d.textContent),
      links: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => a.getAttribute("href")),
    }));
    if (content.id !== "iss" || content.title !== "International Space Station") throw new Error(`card ${content.id} "${content.title}"`);
    if (!content.data.some((d) => /^Above the horizon/.test(d))) throw new Error(`card data ${JSON.stringify(content.data)}`);
    if (!content.data.some((d) => /September 15, 2026, 04:12 UTC/.test(d))) throw new Error(`card lacks the TLE epoch: ${JSON.stringify(content.data)}`);
    if (!content.links.some((href) => href.startsWith("https://celestrak.org/"))) throw new Error(`no CelesTrak citation: ${content.links}`);

    // Fix round 1, folded minor: the altitude/speed line is well-formed AND
    // physically sane for the fixture TLE at the pinned instant (a stale
    // TLE, a unit bug, or a garbled readout would all slip past a pure
    // regex-presence check).
    const altLine = content.data.find((d) => d.startsWith(t.issAltitude) && d.endsWith(t.issSpeedPost));
    if (!altLine) throw new Error(`card missing an altitude/speed line: ${JSON.stringify(content.data)}`);
    const [altStr, speedStr] = altLine.slice(t.issAltitude.length, altLine.length - t.issSpeedPost.length).split(t.issSpeed);
    const altitudeKm = Number(altStr);
    const speedKmS = Number(speedStr);
    if (!(altitudeKm > 370 && altitudeKm < 460)) throw new Error(`card altitude ${altitudeKm} km outside 370-460`);
    if (!(speedKmS > 7.5 && speedKmS < 7.8)) throw new Error(`card speed ${speedKmS} km/s outside 7.5-7.8`);
    return { peak, altitudeKm, speedKmS };
  });

  const absentPeak = await issPage(
    { tle: null, fetchedAt: ISS_TLE.fetchedAt },
    async (page) => {
      await page.waitForFunction(() => window.__sky.layers.iss === "absent", null, { timeout: 10000 });
      const snap = await page.evaluate(() => ({ iss: window.__sky.iss, hit: window.__sky.hits.some((h) => h.id === "iss") }));
      if (snap.iss || snap.hit) throw new Error("an ISS was drawn although the route had no TLE");
      return skyPeak(page, p.x, p.y, 3);
    },
    { strictConsole: true },
  );
  if (present.peak - absentPeak < 40) throw new Error(`ISS pixel peak ${present.peak} with a TLE vs ${absentPeak} without`);

  // Fix round 1, I1's regression check: with motion ON (not reduced), open
  // the ISS card (whose readout refreshes once a real second — see
  // NightSky.tsx), move focus to its close button, and confirm a repaint
  // 2.5s later hasn't stolen focus back. Before the fix this failed: the
  // once-a-second setCard(buildCard(...)) created a new card object every
  // time, and the open/focus effect was keyed on that object, re-running
  // `.focus()` on the card itself each refresh.
  await issPage(
    ISS_TLE,
    async (page) => {
      await page.waitForFunction(() => window.__sky.layers.iss === "ready" && window.__sky.layers.facts === "ready", null, { timeout: 10000 });
      await waitStargazeReady(page);
      await page.getByRole("button", { name: STARGAZE_ENTER }).click();
      await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
      await page.mouse.click(p.x, p.y);
      const card = page.locator("[data-sky-card=iss]");
      await card.waitFor({ state: "visible", timeout: 3000 });
      await page.keyboard.press("Tab"); // aside itself has focus; Tab reaches the close button first
      const closeText = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (closeText !== copy.stargaze.card.close) throw new Error(`Tab from the card landed on "${closeText}", not the close button`);
      await page.waitForTimeout(2500);
      const stillFocused = await page.evaluate(
        (label) => document.activeElement?.tagName === "BUTTON" && document.activeElement.textContent?.trim() === label,
        copy.stargaze.card.close,
      );
      if (!stillFocused) throw new Error("focus moved off the card's close button during a live ISS-card refresh");
    },
    { motion: true, strictConsole: true },
  );

  return `${date.toISOString()} at ${elevation.toFixed(1)}°: drawn at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}), off by ${posErrPx.toFixed(2)}px, peak ${absentPeak} -> ${present.peak}, altitude ${present.altitudeKm} km / ${present.speedKmS} km/s, card opens; { tle: null } draws nothing, no errors; focus survives a live refresh under motion`;
}

/* ---------------------------------------------------------------------- */
/* driver                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Discoverability Task 4: the stargaze affordances on the canvas, each
 * measured as a difference between two states of the same pixels.
 *
 * - Underlines: the same named hits read at the SAME saturation (the verify
 *   hook forces 1 in paper mode, stargaze is 1 anyway) with the entry rings
 *   gone. Each name's bottom rows (where the dotted line sits) must gain
 *   lit pixels in stargaze over paper, while its text rows stay identical,
 *   which is what says nothing else moved under it.
 * - Entry rings (reduced motion, pinned, so the sky is still): the circle
 *   around each ringed symbol right after the first entry vs the same
 *   circle once the rings have cleared, and on a second entry.
 * - Entry rings with motion: the snapshot count every rAF for the first
 *   2 s of the first entry (present, then zero, painted above the idle
 *   20 fps gate while live), and zero throughout the second entry.
 * - Cursor: pointer over a symbol in stargaze, default on empty sky,
 *   grabbing mid-drag even over a symbol.
 */
const UNDERLINE_MIN_NAMES = 4;
const UNDERLINE_MIN_LIT = 4;
const RING_MIN_CHANGED = 12;

async function checkStargazeAffordances(browser) {
  const W = 1440;
  const H = 900;
  const { date, p: m31 } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 160);
  const notes = [];

  await withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    await context.addInitScript(() => {
      window.__skySaturationOverride = 1;
    });
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.objects === "ready" && window.__sky.layers.milkyWay === "ready" && window.__sky.saturation === 1, null, { timeout: 10000 });
    await waitStargazeReady(page);

    /** Per named hit: its box rows, as mean-RGB per pixel, read off the canvas. */
    const readNames = () =>
      page.evaluate((sel) => {
        const c = document.querySelector(sel);
        const g = c.getContext("2d");
        const out = {};
        for (const h of window.__sky.hits) {
          const b = h.box;
          if (!b || h.id === "milky-way") continue;
          if (b.y < 100 || b.y + b.h > window.innerHeight - 140 || b.x < 0 || b.x + b.w > window.innerWidth) continue;
          const x0 = Math.round(b.x + 3);
          const w = Math.round(b.w - 6);
          const y0 = Math.round(b.y);
          const hgt = Math.round(b.h);
          const { data } = g.getImageData(x0, y0, w, hgt);
          const rows = [];
          for (let r = 0; r < hgt; r++) {
            const row = [];
            for (let k = 0; k < w; k++) {
              const i = (r * w + k) * 4;
              row.push((data[i] + data[i + 1] + data[i + 2]) / 3);
            }
            rows.push(row);
          }
          out[h.id] = { box: b, rows };
        }
        return { names: out, highlight: window.__sky.highlight, underline: window.__sky.nameUnderline, suppressed: window.__sky.suppressedName };
      }, SKY_CANVAS);

    const paper = await readNames();
    if (paper.underline) throw new Error("window.__sky.nameUnderline is true in paper mode");
    if (paper.highlight) throw new Error(`paper mode has a highlight (${paper.highlight}) before any pointer move`);

    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze") && window.__sky.entryRingsFired, null, { timeout: 5000 });

    // Rings, right after the first entry: the ringed ids' circles, read now.
    const ringRead = (ids) =>
      page.evaluate(
        ([sel, ids]) => {
          const g = document.querySelector(sel).getContext("2d");
          const out = {};
          for (const id of ids) {
            const h = window.__sky.hits.find((x) => x.id === id);
            if (!h) continue;
            // Every pixel of the (2*32+1)px square around the symbol: with the
            // sky pinned and still, only a ring can change any of them.
            const R = 32;
            const { data } = g.getImageData(Math.round(h.x) - R, Math.round(h.y) - R, 2 * R + 1, 2 * R + 1);
            const px = [];
            for (let i = 0; i < data.length; i += 4) px.push((data[i] + data[i + 1] + data[i + 2]) / 3);
            out[id] = px;
          }
          return { rings: window.__sky.entryRings, px: out };
        },
        [SKY_CANVAS, ids],
      );
    const ringIds = await page.evaluate(() => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      return window.__sky.hits
        .filter((h) => h.id !== "milky-way")
        .map((h) => ({ id: h.id, d: Math.hypot(h.x - cx, h.y - cy) }))
        .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
        .slice(0, 4)
        .map((h) => h.id);
    });
    const ringsOn = await ringRead(ringIds);
    if (ringsOn.rings !== ringIds.length) {
      throw new Error(`right after the first stargaze entry window.__sky.entryRings is ${ringsOn.rings}, expected ${ringIds.length} (around ${ringIds.join(", ")}); a slow machine can miss the 1.2 s window, rerun before believing it`);
    }
    await page.waitForFunction(() => window.__sky.entryRings === 0, null, { timeout: 2500 }).catch(async () => {
      throw new Error(`entry rings still drawn ${await page.evaluate(() => window.__sky.entryRings)} after 2.5 s under reduced motion (should clear at 1.2 s)`);
    });
    const ringsOff = await ringRead(ringIds);
    const ringChanged = ringIds.map((id) => ({ id, n: ringsOn.px[id].filter((v, i) => v - ringsOff.px[id][i] >= 20).length }));
    const dull = ringChanged.filter((r) => r.n < RING_MIN_CHANGED);
    if (dull.length) throw new Error(`entry ring pixels (lit by >= 20 over the cleared frame) per ringed symbol: ${JSON.stringify(ringChanged)}; each needs >= ${RING_MIN_CHANGED}`);
    notes.push(`rings around ${ringChanged.map((r) => `${r.id} +${r.n}px`).join(", ")} on first entry, 0 after clearing`);

    // Underlines, with the rings gone and nothing hovered (the click left the
    // pointer on the exit control, which may sit near a symbol).
    const still = await emptySkyPoint(page, { x: -1000, y: -1000, r: 0 });
    if (still) {
      await page.mouse.move(still.x, still.y);
      await page.waitForFunction(() => window.__sky.highlight === null, null, { timeout: 2000 });
    }
    const star = await readNames();
    if (!star.underline) throw new Error("window.__sky.nameUnderline is false in stargaze");
    if (star.highlight) throw new Error(`stargaze has a highlight (${star.highlight}) with the pointer on the exit control`);
    const measured = [];
    for (const [id, a] of Object.entries(paper.names)) {
      const b = star.names[id];
      if (!b || id === star.suppressed) continue;
      if (Math.abs(a.box.x - b.box.x) > 0.01 || Math.abs(a.box.y - b.box.y) > 0.01 || a.rows.length !== b.rows.length) continue;
      const hgt = a.rows.length;
      // Text rows: from the top padding down to ~2px above the baseline.
      let textSame = true;
      for (let r = 3; r < hgt - 7; r++) if (a.rows[r].some((v, k) => v !== b.rows[r][k])) textSame = false;
      if (!textSame) continue; // the band's label or another layer moved over this name; not a fair comparison
      let lit = 0;
      let bestRow = -1;
      for (let r = Math.max(0, hgt - 6); r < hgt; r++) {
        const n = a.rows[r].filter((v, k) => b.rows[r][k] - v >= 20).length;
        if (n > lit) {
          lit = n;
          bestRow = r;
        }
      }
      measured.push({ id, lit, row: bestRow, width: a.rows[0].length });
    }
    const underlined = measured.filter((m) => m.lit >= UNDERLINE_MIN_LIT);
    if (underlined.length < UNDERLINE_MIN_NAMES || underlined.length < measured.length * 0.8) {
      throw new Error(
        `dotted underline pixels (lit by >= 20 in stargaze over paper, bottom 6 rows of each name box, same saturation, text rows identical): ${JSON.stringify(measured)}; need >= ${UNDERLINE_MIN_LIT} lit on >= ${UNDERLINE_MIN_NAMES} names and 80% of those compared`,
      );
    }
    notes.push(`underline: ${underlined.length}/${measured.length} names gained dots in stargaze (median ${underlined.map((m) => m.lit).sort((x, y) => x - y)[underlined.length >> 1]}px), text rows identical`);

    // Second entry: no rings, and the circles match the cleared frame.
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 3000 });
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const again = await ringRead(ringIds);
    const againLit = ringIds.map((id) => again.px[id]?.filter((v, i) => v - ringsOff.px[id][i] >= 20).length ?? 0);
    if (again.rings !== 0 || againLit.some((n) => n >= RING_MIN_CHANGED)) {
      throw new Error(`second stargaze entry drew rings: window.__sky.entryRings ${again.rings}, lit ring pixels over the cleared frame ${JSON.stringify(againLit)}`);
    }
    notes.push("second entry: 0 rings, circles unchanged");

    // Cursor: pointer on a symbol, default on empty sky, grabbing mid-drag.
    const hit = await page.evaluate(({ x, y }) => window.__sky.hits.find((h) => h.id === "m31") ?? null, m31);
    if (!hit) throw new Error(`m31 not drawn at ${date.toISOString()}`);
    const cursor = () => page.evaluate(() => document.documentElement.style.cursor);
    await page.mouse.move(hit.x, hit.y);
    await page.waitForFunction(() => window.__sky.highlight === "m31", null, { timeout: 2000 });
    const onSymbol = await cursor();
    const empty = await emptySkyPoint(page, { x: hit.x, y: hit.y, r: 200 });
    if (!empty) throw new Error("no empty sky for the cursor check");
    await page.mouse.move(empty.x, empty.y);
    await page.waitForFunction(() => window.__sky.highlight === null, null, { timeout: 2000 });
    const onEmpty = await cursor();
    await page.mouse.down();
    await page.mouse.move(hit.x, hit.y, { steps: 8 });
    const dragging = await cursor();
    await page.mouse.up();
    await page.mouse.move(empty.x + 1, empty.y + 1);
    if (onSymbol !== "pointer" || onEmpty !== "" || dragging !== "grabbing") {
      throw new Error(`cursor over m31 in stargaze "${onSymbol}" (want pointer), on empty sky "${onEmpty}" (want default), dragging across m31 "${dragging}" (want grabbing)`);
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 3000 });
    if ((await cursor()) !== "") throw new Error(`cursor "${await cursor()}" left on the page after leaving stargaze`);
    notes.push("cursor pointer / default / grabbing");
  });

  // With motion: the envelope runs on real ms and raises the frame gate.
  await withPage(browser, { viewport: { width: W, height: H } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.objects === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    const record = () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const seen = [];
            const t0 = performance.now();
            let lastSim = null;
            const tick = () => {
              const s = window.__sky;
              if (s.simMs !== lastSim) {
                seen.push({ t: performance.now() - t0, rings: s.entryRings });
                lastSim = s.simMs;
              }
              if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
              else resolve({ seen, fired: s.entryRingsFired });
            };
            requestAnimationFrame(tick);
          }),
      );
    const [first] = await Promise.all([record(), page.getByRole("button", { name: STARGAZE_ENTER }).click()]);
    const live = first.seen.filter((f) => f.rings > 0);
    const tail = first.seen.filter((f) => f.t > 1700);
    if (!first.fired || !live.length) throw new Error(`first entry with motion: no frame drew rings (${first.seen.length} frames seen, fired ${first.fired})`);
    if (tail.some((f) => f.rings > 0) || first.seen.at(-1).rings !== 0) throw new Error(`rings still drawn ${first.seen.at(-1).rings} at ${first.seen.at(-1).t.toFixed(0)}ms`);
    const span = live.at(-1).t - live[0].t;
    // The idle gate is 50 ms (20 fps); live rings paint on the 14 ms gate.
    if (live.length < span / 50 + 10) throw new Error(`rings painted ${live.length} frames over ${span.toFixed(0)}ms, not above the idle 20 fps gate`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 3000 });
    const [second] = await Promise.all([record(), page.getByRole("button", { name: STARGAZE_ENTER }).click()]);
    if (second.seen.some((f) => f.rings > 0)) throw new Error(`second entry with motion drew rings on ${second.seen.filter((f) => f.rings > 0).length} frames`);
    notes.push(`motion: rings on ${live.length} frames over ${span.toFixed(0)}ms, 0 by ${tail.length ? "1.7s" : "2s"}; second entry 0 over 2s`);
  });

  // Entering stargaze before the sky has loaded must not spend the one
  // showing on an empty chart (controller fix on Task 4): a visitor who taps
  // straight in on a slow phone is exactly who the rings are for. Hold the
  // star catalog, enter, confirm nothing fired, release it, and the rings
  // must then appear.
  await withPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    let release;
    const held = new Promise((r) => (release = r));
    await context.route("**/sky/sky.json", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const toggle = page.getByRole("button", { name: STARGAZE_ENTER });
    await toggle.waitFor({ state: "visible", timeout: 15000 });
    await toggle.click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForTimeout(400);
    const early = await page.evaluate(() => ({ drawn: window.__sky?.drawn ?? false, fired: window.__sky?.entryRingsFired ?? false }));
    if (early.drawn) throw new Error("the held star catalog still drew before release; the slow-load case was not reproduced");
    if (early.fired) throw new Error("entry rings were marked fired while the sky was still empty, so a slow-loading visitor never sees them");
    release();
    await page
      .waitForFunction(() => window.__sky?.drawn && window.__sky.entryRingsFired && window.__sky.entryRings > 0, null, { timeout: 15000 })
      .catch(async () => {
        const st = await page.evaluate(() => ({ drawn: window.__sky?.drawn, fired: window.__sky?.entryRingsFired, rings: window.__sky?.entryRings }));
        throw new Error(`after the catalog landed mid-stargaze the rings never showed: ${JSON.stringify(st)}`);
      });
    notes.push("slow load: nothing fired on the empty sky, rings showed once the catalog landed");
  });
  return notes.join("; ");
}

/* ---------------------------------------------------------------------- */
/* discoverability Task 5: counts in the hint, the list as a panel         */
/* ---------------------------------------------------------------------- */

/** Counts computed IN THE PAGE from the served JSON, independently of the site's own code. */
function servedCounts(page) {
  return page.evaluate(async (edge) => {
    const [objects, sky] = await Promise.all([
      fetch("/sky/objects.json").then((r) => r.json()),
      fetch("/sky/sky.json").then((r) => r.json()),
    ]);
    return {
      objects: objects.objects.filter((o) => o.decDeg > edge).length,
      belowEdge: objects.objects.filter((o) => o.decDeg <= edge).map((o) => o.id),
      constellations: Object.keys(sky.constellations).length,
    };
  }, EDGE_DEC_DEG);
}

/** What the hint bar shows, read off the DOM. */
function readHint(page) {
  return page.evaluate(() => {
    const hint = document.querySelector("[data-stargaze-hint]");
    const num = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent : null;
    };
    return {
      text: hint?.textContent ?? null,
      objects: num("[data-stargaze-count-objects]"),
      constellations: num("[data-stargaze-count-constellations]"),
      browse: !!document.querySelector("[data-stargaze-browse]"),
    };
  });
}

/** A visible box, measured: bounding box, computed display/visibility/opacity, and what is on top at its centre. */
function measureVisible(page, sel) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30));
    return {
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      bottom: r.bottom,
      right: r.right,
      display: cs.display,
      visibility: cs.visibility,
      opacity: Number(cs.opacity),
      onTop: !!top && el.contains(top),
    };
  }, sel);
}

const boxesIntersect = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const isShown = (m) => !!m && m.w > 0 && m.h > 0 && m.display !== "none" && m.visibility === "visible" && m.opacity > 0.9;

async function checkStargazeBrowse(browser) {
  const W = 1440;
  const H = 900;
  const { date } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  const notes = [];

  // Before the data lands: the hint without counts, never zeros.
  await withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    let release;
    const held = new Promise((r) => (release = r));
    await context.route("**/sky/objects.json", async (route) => {
      await held;
      await route.continue();
    });
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForTimeout(500);
    const early = await readHint(page);
    if (early.text !== copy.stargaze.hintPointer || early.objects !== null || early.browse) {
      throw new Error(`with objects.json held back the hint bar reads ${JSON.stringify(early)}; expected the hint alone, no counts and no browse control`);
    }
    release();
    await page.waitForSelector("[data-stargaze-count-objects]", { timeout: 10000 });
    notes.push("objects.json held: hint alone; released: counts appeared");
  });

  await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForSelector("[data-stargaze-count-objects]", { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });

    const served = await servedCounts(page);
    const hint = await readHint(page);
    if (Number(hint.objects) !== served.objects || Number(hint.constellations) !== served.constellations) {
      throw new Error(
        `hint says ${hint.objects} objects and ${hint.constellations} constellations; the served objects.json has ${served.objects} objects north of dec ${EDGE_DEC_DEG} (excluded: ${served.belowEdge.join(", ")}) and sky.json ${served.constellations} constellations`,
      );
    }
    const t = copy.stargaze;
    const composed = `${t.hintPointer} · ${served.objects}${t.countsObjects}${served.constellations}${t.countsConstellations} · ${t.browseList}`;
    if (hint.text !== composed) throw new Error(`hint bar reads ${JSON.stringify(hint.text)}, expected ${JSON.stringify(composed)}`);
    notes.push(`hint ${served.objects} objects / ${served.constellations} constellations = served JSON (excluded ${served.belowEdge.join(", ")})`);

    // Closed: the list is the same sr-only group as before.
    const closed = await page.evaluate(() => {
      const g = document.querySelector("[data-sky-list]");
      const r = g.getBoundingClientRect();
      return {
        label: g.getAttribute("aria-label"),
        role: g.getAttribute("role"),
        srOnly: g.classList.contains("sr-only"),
        w: r.width,
        h: r.height,
        wrapperRole: g.parentElement.getAttribute("role"),
        ids: [...g.querySelectorAll("[data-sky-list-item]")].map((b) => b.getAttribute("data-sky-list-item")),
      };
    });
    if (closed.label !== t.listLabel || closed.role !== "group" || !closed.srOnly || closed.w > 1 || closed.h > 1 || closed.wrapperRole) {
      throw new Error(`closed list: ${JSON.stringify({ ...closed, ids: closed.ids.length })}; expected the sr-only group "${t.listLabel}" (1px box) with no role on its wrapper`);
    }

    await page.getByRole("button", { name: t.browseList }).click();
    await page.waitForSelector('[data-sky-list-panel="open"]', { timeout: 3000 });
    const panel = await measureVisible(page, '[data-sky-list-panel="open"]');
    const exit = await measureVisible(page, "[data-stargaze-exit]");
    if (!isShown(panel) || panel.w < 200 || panel.h < 100 || !panel.onTop) throw new Error(`"browse the list" panel measured ${JSON.stringify(panel)}; expected a shown box at least 200x100 on top at its centre`);
    if (panel.x < 0 || panel.right > W || panel.y < 0 || panel.bottom > H) throw new Error(`panel box ${JSON.stringify(panel)} runs off the ${W}x${H} viewport`);
    if (boxesIntersect(panel, exit)) throw new Error(`panel box ${JSON.stringify(panel)} covers the exit control ${JSON.stringify(exit)}`);
    const open = await page.evaluate(() => ({
      ids: [...document.querySelectorAll("[data-sky-list] [data-sky-list-item]")].map((b) => b.getAttribute("data-sky-list-item")),
      title: document.querySelector("#sky-list-panel-title")?.textContent,
      focusIn: !!document.activeElement?.closest("[data-sky-list-panel]"),
      lists: document.querySelectorAll("[data-sky-list]").length,
      first: (() => {
        const r = document.querySelector("[data-sky-list-item]").getBoundingClientRect();
        return { w: r.width, h: r.height };
      })(),
    }));
    if (open.lists !== 1) throw new Error(`${open.lists} [data-sky-list] groups with the panel open; there must be one list`);
    if (open.ids.join("|") !== closed.ids.join("|")) throw new Error(`panel buttons ${open.ids.join(",")} differ from the closed list ${closed.ids.join(",")}`);
    if (open.title !== t.listPanelTitle) throw new Error(`panel title ${JSON.stringify(open.title)}`);
    if (!open.focusIn) throw new Error("opening the panel did not move focus into it");
    if (open.first.w < 20 || open.first.h < 8) throw new Error(`first panel button measures ${JSON.stringify(open.first)}`);
    notes.push(`panel ${panel.w.toFixed(0)}x${panel.h.toFixed(0)} at (${panel.x.toFixed(0)}, ${panel.y.toFixed(0)}), shown and on top, ${open.ids.length} buttons in the list's order`);

    // A panel button opens its card; the panel stays open behind it on desktop.
    const symbolId = open.ids.find((id) => !ABBRS.includes(id));
    const button = page.locator(`[data-sky-list-panel="open"] [data-sky-list-item="${symbolId}"]`);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.locator(`[data-sky-card="${symbolId}"]`).waitFor({ state: "visible", timeout: 3000 });
    const both = await measureVisible(page, '[data-sky-list-panel="open"]');
    if (!isShown(both)) throw new Error(`at ${W}px the panel was hidden when a card opened from it: ${JSON.stringify(both)}`);

    // Escape: panel, then card, then stargaze.
    await page.keyboard.press("Escape");
    const after1 = await page.evaluate(() => ({
      panel: document.querySelector("[data-sky-list-panel]")?.getAttribute("data-sky-list-panel") ?? null,
      card: document.querySelector("[data-sky-card]")?.getAttribute("data-sky-card") ?? null,
      stargaze: document.body.hasAttribute("data-stargaze"),
    }));
    if (after1.panel !== "closed" || after1.card !== symbolId || !after1.stargaze) throw new Error(`first Escape left ${JSON.stringify(after1)}; expected the panel closed, card ${symbolId} open, still stargazing`);
    await page.keyboard.press("Escape");
    await page.locator("[data-sky-card]").waitFor({ state: "detached", timeout: 2000 }).catch(() => {
      throw new Error("second Escape did not close the card");
    });
    if (!(await page.evaluate(() => document.body.hasAttribute("data-stargaze")))) throw new Error("second Escape left stargaze along with the card");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 2000 }).catch(() => {
      throw new Error("third Escape did not leave stargaze");
    });
    notes.push(`panel button opened ${symbolId}'s card (panel stayed); Escape x3: panel, card, stargaze`);

    // The close button closes it too, and returns focus to "browse the list".
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    const reopened = await page.evaluate(() => document.querySelector("[data-sky-list-panel]")?.getAttribute("data-sky-list-panel") ?? null);
    if (reopened === "open") throw new Error("the panel was still open on re-entering stargaze");
    await page.getByRole("button", { name: t.browseList }).click();
    await page.getByRole("button", { name: t.listPanelClose }).click();
    const closedByButton = await page.evaluate(() => ({
      panel: document.querySelector("[data-sky-list-panel]")?.getAttribute("data-sky-list-panel"),
      focus: document.activeElement?.hasAttribute("data-stargaze-browse"),
    }));
    if (closedByButton.panel !== "closed" || !closedByButton.focus) throw new Error(`close button left ${JSON.stringify(closedByButton)}`);
    notes.push("close button closes it, focus back on browse");
  });
  return notes.join("; ");
}

async function checkStargazeBrowse400(browser) {
  const W = 400;
  const H = 800;
  const date = new Date(Date.UTC(2026, 9, 1, 6));
  return pinnedSkyPage(browser, { W, H, date, contextOptions: { hasTouch: true } }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await page.getByRole("button", { name: STARGAZE_ENTER }).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForSelector("[data-stargaze-count-objects]", { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });
    // A paint after the bar's final height: the still sky repaints on a height change.
    await page.waitForTimeout(300);

    // Phone names are the coloured objects' (Task 4). Planet and Moon names
    // draw at every width on their own path and are not part of this band.
    const coloured = Object.keys(OBJECT_COLOURS);
    const readLayout = () =>
      page.evaluate((coloured) => {
        const r = document.querySelector("[data-stargaze-bar]").getBoundingClientRect();
        return {
          bar: { x: r.left, y: r.top, w: r.width, h: r.height },
          names: window.__sky.hits.filter((h) => h.box && coloured.includes(h.id)).map((h) => ({ id: h.id, box: h.box })),
        };
      }, coloured);
    const layout = await readLayout();
    const under = layout.names.filter((n) => boxesIntersect(n.box, layout.bar));
    if (under.length) throw new Error(`at ${W}px the hint bar measures ${JSON.stringify(layout.bar)} and phone names overlap it: ${JSON.stringify(under)}`);
    if (!layout.names.length) throw new Error(`no phone name drawn at ${date.toISOString()}, nothing to test against the hint bar`);
    const note = [`hint bar ${layout.bar.h.toFixed(0)}px tall at ${W}px, ${layout.names.length} phone names all clear of it (highest name top ${Math.min(...layout.names.map((n) => n.box.y)).toFixed(0)})`];

    // The band follows the bar's MEASURED height, not a fixed one: grow the
    // bar past the old fixed 90px band and the names must still clear it.
    await page.addStyleTag({ content: "[data-stargaze-bar] { padding-bottom: 110px; }" });
    await page.waitForFunction((h) => document.querySelector("[data-stargaze-bar]").getBoundingClientRect().height > h + 100, layout.bar.h, { timeout: 2000 });
    await page.waitForTimeout(300);
    const grown = await readLayout();
    const underGrown = grown.names.filter((n) => boxesIntersect(n.box, grown.bar));
    if (underGrown.length) throw new Error(`with the hint bar grown to ${grown.bar.h.toFixed(0)}px, phone names still overlap it: ${JSON.stringify(underGrown)}`);
    const displaced = layout.names.filter((n) => n.box.y < grown.bar.h).map((n) => n.id);
    note.push(`bar grown to ${grown.bar.h.toFixed(0)}px: names clear, ${displaced.length ? displaced.join(", ") : "no name"} moved off the grown band`);
    await page.evaluate(() => document.querySelectorAll("style").forEach((s) => s.textContent.includes("padding-bottom: 110px") && s.remove()));
    await page.waitForFunction((h) => Math.abs(document.querySelector("[data-stargaze-bar]").getBoundingClientRect().height - h) < 1, layout.bar.h, { timeout: 2000 });

    const t = copy.stargaze;
    await page.getByRole("button", { name: t.browseList }).tap();
    await page.waitForSelector('[data-sky-list-panel="open"]', { timeout: 3000 });
    const panel = await measureVisible(page, '[data-sky-list-panel="open"]');
    const exit = await measureVisible(page, "[data-stargaze-exit]");
    if (!isShown(panel) || !panel.onTop) throw new Error(`phone panel measured ${JSON.stringify(panel)}; expected shown and on top`);
    if (Math.abs(panel.bottom - H) > 1 || panel.h > 0.6 * H + 2 || panel.w < W - 1) throw new Error(`phone panel ${JSON.stringify(panel)}; expected docked full-width to the bottom of ${H}, at most 60% tall`);
    if (boxesIntersect(panel, exit) || boxesIntersect(panel, layout.bar)) throw new Error(`phone panel ${JSON.stringify(panel)} covers the hint bar ${JSON.stringify(layout.bar)} or exit ${JSON.stringify(exit)}`);
    note.push(`docked panel ${panel.h.toFixed(0)}px of ${H}, clear of the bar`);

    // A docked card takes the panel's place, and gives it back.
    const id = await page.evaluate(() => [...document.querySelectorAll("[data-sky-list-item]")].map((b) => b.getAttribute("data-sky-list-item"))[0]);
    const button = page.locator(`[data-sky-list-item="${id}"]`);
    await button.tap();
    await page.locator(`[data-sky-card="${id}"]`).waitFor({ state: "visible", timeout: 3000 });
    const hidden = await measureVisible(page, '[data-sky-list-panel="open"]');
    if (hidden && hidden.display !== "none") throw new Error(`at ${W}px the panel stayed shown under the docked card: ${JSON.stringify(hidden)}`);
    await page.keyboard.press("Escape");
    await page.locator("[data-sky-card]").waitFor({ state: "detached", timeout: 2000 }).catch(() => {
      throw new Error("on a phone, Escape with a card over the panel did not close the card first");
    });
    const back = await measureVisible(page, '[data-sky-list-panel="open"]');
    if (!isShown(back)) throw new Error(`closing the card did not bring the panel back: ${JSON.stringify(back)}`);
    const focus = await page.evaluate(() => document.activeElement?.getAttribute("data-sky-list-item"));
    if (focus !== id) throw new Error(`focus after closing the card is on ${JSON.stringify(focus)}, not the panel button ${id}`);
    await page.keyboard.press("Escape");
    if ((await page.evaluate(() => document.querySelector("[data-sky-list-panel]")?.getAttribute("data-sky-list-panel"))) !== "closed") throw new Error("second Escape did not close the phone panel");
    if (!(await page.evaluate(() => document.body.hasAttribute("data-stargaze")))) throw new Error("second Escape left stargaze");
    note.push(`card from ${id} hid the panel, Escape closed the card and the panel came back with focus on ${id}, next Escape closed the panel`);
    return note.join("; ");
  });
}

const CHECKS = [
  ["sky-animates-1280", skyAnimatesAt1280],
  ["sky-static-reduced-motion", skyStaticUnderReducedMotion],
  ["sky-present-400", skyPresentAt400],
  ["sky-orientation", checkSkyOrientation],
  ["sky-hover", checkSkyHover],
  ["sky-drag", checkSkyDrag],
  ["sky-objects", checkSkyObjects],
  ["sky-colour", checkSkyColour],
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
  ["stargaze-card", checkStargazeCard],
  ["stargaze-keyboard-list", checkStargazeKeyboardList],
  ["stargaze-touch-400", checkStargazeTouch400],
  ["stargaze-affordances", checkStargazeAffordances],
  ["stargaze-browse-1440", checkStargazeBrowse],
  ["stargaze-browse-400", checkStargazeBrowse400],
  ["sky-iss", checkSkyIss],
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
