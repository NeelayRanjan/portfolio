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
import { SITE } from "../lib/site.ts";
import { fitLower48, fromScreen, toScreen } from "../components/figures/reroute-map.ts";
import { albers } from "../lib/slaac/albers.ts";
import { loadSua, segCrossesPoly } from "../lib/slaac/geometry.ts";
import { planArcs, mayConflict, uniqueArcCount } from "../lib/slaac/arcs.ts";
import { rerouteOpts } from "../lib/slaac/run.ts";
import { fmtSigned, summarizeFlights } from "../lib/slaac/summary.ts";

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

// VERIFY_BASE overrides the port when :3000 is taken; the default is unchanged.
const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";

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
    await stargazeToggle(page).click();
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
      await stargazeToggle(page).click();
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

// `/ort/` (any file, the runtime's .mjs glue included) and the rerouter's
// model by name joined this list in the SLAAC round: Figure 3's worker loads
// the plain ORT runtime and a 23 MB model, both only on a reroute press that
// has an arc to sample (components/figures/RerouteFigure.tsx).
const HEAVY_RE = /\.(onnx|wasm)(\?|$)|\/ort\/|\/models\/flightdiff-|traj\.json(\?|$)|manifest\.json(\?|$)|sprites\.webp(\?|$)/i;
/** Figure 3's small JSON (~230 KB): loaded when the figure scrolls in, never
 *  at first paint. Proved to bite (2026-09-30): unwrapping RerouteFigure from
 *  its DeferredMount in app/page.tsx failed with "Figure 3's data loaded
 *  before it was scrolled to: .../slaac/meta.json, ...". */
const SLAAC_DATA_RE = /\/slaac\/[^/?#]+\.json/;

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
    const slaac = urls.filter((u) => SLAAC_DATA_RE.test(u));
    if (slaac.length) throw new Error(`Figure 3's data loaded before it was scrolled to: ${slaac.join(", ")}`);
    return `${urls.length} requests total, none model/trajectory-sized, no /ort/, no rerouter model or data`;
  });
}

/* ---------------------------------------------------------------------- */
/* 3c. Which ORT runtime build the page actually fetches                  */
/* (lib/draw-model.ts, lib/headshot-model.ts, lib/chess-worker.ts,        */
/* scripts/sync-ort.mjs). Since 2026-09-16 every ORT import goes through  */
/* the `onnxruntime-web/wasm` entry. The `/webgpu` entry always fetched   */
/* the asyncify build, whatever provider was asked for, and               */
/* JavaScriptCore's optimizing wasm tier runs away on that build (ORT     */
/* issue 26827): measured in WebKitGTK 2.52 driving one stroke, the       */
/* classify and one generate, the web process then sat at ~395% CPU and  */
/* grew from 5.3 to 11.5 GB in a minute of idle; on iOS that is a jetsam  */
/* kill and Safari's "a problem repeatedly occurred". The plain build     */
/* measured flat at ~800 MB (scripts/probe-webkit-draw.py). Asserted on  */
/* the network, not the source: the chess worker's load, the main        */
/* thread's draw load and (SLAAC round, 2026-09-30) the rerouter worker's */
/* load (lib/slaac-worker.ts) must each fetch the plain runtime, and      */
/* nothing may fetch an asyncify, jsep or jspi build. Proved to bite by   */
/* pointing one import back at `/webgpu`. The rerouter's leg was proved   */
/* the same way (lib/slaac-worker.ts at `/webgpu`), and failed with "the  */
/* rerouter's worker did not fetch the plain runtime; its /ort/ requests: */
/* []": in headless Firefox that entry throws inside the worker before it */
/* fetches any runtime (no WebGPU adapter), so the plain-build assertion, */
/* not the asyncify one, is what catches it here.                         */
/* ---------------------------------------------------------------------- */

const ORT_PATH_RE = /\/ort\/[^?#]+/;
const ORT_BAD_BUILD_RE = /\.(asyncify|jsep|jspi)\./;

async function checkOrtRuntimeBuild(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    const urls = [];
    page.on("request", (req) => urls.push(req.url()));
    await page.goto(BASE, { waitUntil: "networkidle" });

    // The worker's runtime: reaching Figure 4 loads the chess engine, and the
    // hint button enables once the session exists.
    await scrollUntilAttached(page, "#fig-chess");
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
    const afterWorker = urls.length;

    // The main thread's runtime: the first stroke starts the draw model, and
    // the fit scores prove a session ran on it.
    await scrollUntilAttached(page, "#fig-draw");
    await drawStroke(page);
    await waitDrawFits(page);

    const afterMain = urls.length;

    // The rerouter's worker (SLAAC round): last, so the chess worker and the
    // draw session have finished every runtime fetch of their own and
    // whatever /ort/ request follows is the rerouter's. A press on
    // KJFK-KMIA (past the Cape) has arcs to sample, so it loads the
    // model and the runtime; `window.__slaac.loaded` turns true once the
    // worker's session exists. The run itself is left to finish unobserved.
    await openReroute(page);
    await selectReroutePair(page, "KJFK-KMIA");
    await page.locator("[data-reroute-go]").click();
    // Loaded, or failed to load: a wrong runtime build 404s (sync-ort ships
    // only the plain pair) and the figure goes unavailable, and the URL
    // assertions below are what name the build.
    await page.waitForFunction(
      () =>
        window.__slaac?.loaded === true ||
        JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus).state === "unavailable",
      null,
      { timeout: 120000 },
    );

    const ortOf = (list) => list.map((u) => (u.match(ORT_PATH_RE) || [])[0]).filter(Boolean);
    const workerOrt = ortOf(urls.slice(0, afterWorker));
    const mainOrt = ortOf(urls.slice(afterWorker, afterMain));
    const slaacOrt = ortOf(urls.slice(afterMain));
    const all = [...workerOrt, ...mainOrt, ...slaacOrt];
    const bad = all.filter((u) => ORT_BAD_BUILD_RE.test(u));
    if (bad.length) {
      throw new Error(`an asyncify/jsep/jspi runtime was fetched: ${[...new Set(bad)].join(", ")}`);
    }
    // Requests, not distinct files: each leg is its own fetch of the same URL
    // (a worker's runtime is its own instance), so the count per leg is what
    // says that leg fetched it. The detail lists the distinct files.
    const plainWasm = (list) => list.filter((u) => u.endsWith("/ort-wasm-simd-threaded.wasm")).length;
    if (plainWasm(workerOrt) < 1) {
      throw new Error(`the chess worker did not fetch the plain runtime; its /ort/ requests: ${JSON.stringify(workerOrt)}`);
    }
    if (plainWasm(mainOrt) < 1) {
      throw new Error(`the draw demo did not fetch the plain runtime; its /ort/ requests: ${JSON.stringify(mainOrt)}`);
    }
    if (plainWasm(slaacOrt) < 1) {
      throw new Error(`the rerouter's worker did not fetch the plain runtime; its /ort/ requests: ${JSON.stringify(slaacOrt)}`);
    }
    return `plain runtime fetched by the chess worker (${plainWasm(workerOrt)}x), the main thread (${plainWasm(mainOrt)}x) and the rerouter's worker (${plainWasm(slaacOrt)}x); no asyncify/jsep/jspi build; files: ${[...new Set(all)].join(", ")}`;
  });
}

/* ---------------------------------------------------------------------- */
/* 3d. Ink survives a height-only resize (components/DrawDigit.tsx).      */
/* A phone's URL bar collapsing on scroll fires `resize` with the same    */
/* width, and the panel used to re-run setup() there and wipe the         */
/* drawing (v1 known bug 1). A width change still resets the buffer: the  */
/* pen width and the backing store are derived from it.                   */
/* ---------------------------------------------------------------------- */

async function checkDrawInkSurvivesHeightResize(browser) {
  return withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#fig-draw");
    await drawStroke(page);
    const inkPixels = () =>
      page.evaluate(() => {
        const c = document.querySelector("#fig-draw canvas");
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 128) n++;
        return n;
      });
    const before = await inkPixels();
    if (before < 100) throw new Error(`stroke left only ${before} lit pixels`);

    // The URL bar: same width, shorter viewport.
    await page.setViewportSize({ width: 400, height: 700 });
    await page.waitForTimeout(400); // past the 150ms resize debounce
    const afterHeight = await inkPixels();
    if (afterHeight !== before) {
      throw new Error(`height-only resize changed the ink: ${before} -> ${afterHeight} lit pixels`);
    }
    const clearEnabled = await page
      .locator("#fig-draw button", { hasText: copy.systems.draw.clear })
      .first()
      .isEnabled();
    if (!clearEnabled) throw new Error("clear button disabled after height-only resize: hasInk was reset");

    // A width change still resets the buffer.
    await page.setViewportSize({ width: 360, height: 700 });
    await page.waitForTimeout(400);
    const afterWidth = await inkPixels();
    if (afterWidth !== 0) throw new Error(`width resize kept ${afterWidth} lit pixels; setup() should have reset the buffer`);
    return `ink (${before} lit px) survived 800->700 height resize; a 400->360 width resize reset the buffer`;
  });
}

/* ---------------------------------------------------------------------- */
/* 5b. Self-play (components/ChessPanel.tsx, lib/chess-selfplay.ts).      */
/* The engine is deterministic, so engine-vs-engine used to replay one    */
/* 41-move game on every press. At one ply it may now take its second or */
/* third choice when that move is nearly tied with the first, at most     */
/* twice a game (the rule itself is pinned in node by                     */
/* test-chess-selfplay.mjs). This pins the wiring: every departure the    */
/* panel records is a near-tie in the top three and within budget, the   */
/* rule is stated while it applies, watching counts as using the demo,    */
/* the loop stops when the panel leaves the viewport or the tab is        */
/* hidden and resumes after, and a human game is untouched (the engine's  */
/* reply is its top move). Date.now() seeds the game, so the clock is     */
/* pinned and the game is the same on every run.                          */
/* ---------------------------------------------------------------------- */

const SELF_PLAY_DATE = new Date(Date.UTC(2026, 8, 17, 12, 0, 0));

function chessState(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#fig-chess [data-chess-self-play]");
    return el ? JSON.parse(el.getAttribute("data-chess-self-play")) : null;
  });
}

async function waitChessReady(page) {
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("#fig-chess button")].find((b) => b.textContent.trim() === "hint");
      return !!btn && !btn.disabled;
    },
    null,
    { timeout: 90000 },
  );
}

async function pliesSettle(page, ms) {
  const a = (await chessState(page)).plies;
  await page.waitForTimeout(ms);
  const b = (await chessState(page)).plies;
  return { a, b };
}

async function checkChessSelfPlay(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.clock.setFixedTime(SELF_PLAY_DATE);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollUntilAttached(page, "#fig-chess");
    await page.locator("#fig-chess").scrollIntoViewIfNeeded();
    await waitChessReady(page);
    const notes = [];

    const start = page.locator("#fig-chess button", { hasText: copy.systems.chess.engineVsEngine });
    await start.click();

    // The rule is stated while it applies.
    const rule = page.locator("#fig-chess [data-chess-self-play-rule]");
    await rule.waitFor({ state: "visible", timeout: 5000 });
    const ruleText = (await rule.textContent())?.trim();
    if (ruleText !== copy.systems.chess.selfPlayRule) {
      throw new Error(`self-play rule reads ${JSON.stringify(ruleText)}, expected copy.systems.chess.selfPlayRule`);
    }

    // Play until the budget is spent or the game is long enough to judge.
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector("#fig-chess [data-chess-self-play]");
          if (!el) return false;
          const st = JSON.parse(el.getAttribute("data-chess-self-play"));
          return st.deviations.length >= 2 || st.plies >= 40;
        },
        null,
        { timeout: 240000 },
      )
      .catch(async () => {
        throw new Error(`self-play stalled: ${JSON.stringify(await chessState(page))}`);
      });

    const st = await chessState(page);
    if (st.deviations.length < 1) {
      throw new Error(`no departure in ${st.plies} plies at the pinned seed; the sampling is not wired: ${JSON.stringify(st)}`);
    }
    if (st.deviations.length > 2) throw new Error(`${st.deviations.length} departures, budget is 2: ${JSON.stringify(st.deviations)}`);
    for (const d of st.deviations) {
      if (d.rank !== 2 && d.rank !== 3) throw new Error(`departure took rank ${d.rank}: ${JSON.stringify(d)}`);
      if (!(d.ratio >= 0.8)) throw new Error(`departure at ratio ${d.ratio}, under the 0.8 tie: ${JSON.stringify(d)}`);
    }
    notes.push(`departures ${JSON.stringify(st.deviations.map((d) => `ply ${d.ply}: rank ${d.rank} at ${d.ratio.toFixed(3)}`))} by ply ${st.plies}`);

    // Watching counts as using the demo, with no human move made.
    const used = await demoEvents(page, "chess");
    if (used !== 1) throw new Error(`self-play alone queued demo_used{chess} ${used}x, expected 1`);

    // Off-screen: the loop stops (a move already in flight may still land).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    const off = await pliesSettle(page, 6000);
    if (off.b - off.a > 0) throw new Error(`self-play kept playing off-screen: ${off.a} -> ${off.b} plies in 6s`);
    await page.locator("#fig-chess").scrollIntoViewIfNeeded();
    await page
      .waitForFunction((n) => JSON.parse(document.querySelector("#fig-chess [data-chess-self-play]").getAttribute("data-chess-self-play")).plies > n, off.b, { timeout: 15000 })
      .catch(() => {
        throw new Error(`self-play did not resume after scrolling back (stuck at ${off.b} plies)`);
      });
    notes.push(`off-screen held at ${off.b} plies for 6s, resumed on return`);

    // Tab hidden: same.
    const setHidden = (hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    await setHidden(true);
    await page.waitForTimeout(1500);
    const hid = await pliesSettle(page, 6000);
    if (hid.b - hid.a > 0) throw new Error(`self-play kept playing with the tab hidden: ${hid.a} -> ${hid.b} plies in 6s`);
    await setHidden(false);
    await page
      .waitForFunction((n) => JSON.parse(document.querySelector("#fig-chess [data-chess-self-play]").getAttribute("data-chess-self-play")).plies > n, hid.b, { timeout: 15000 })
      .catch(() => {
        throw new Error(`self-play did not resume after the tab came back (stuck at ${hid.b} plies)`);
      });
    notes.push(`tab hidden held at ${hid.b} plies, resumed on visible`);

    // A human game is untouched: stop, start over, play e4, the reply is the top move.
    await page.locator("#fig-chess button", { hasText: copy.systems.chess.stop }).click();
    await page.locator("#fig-chess button", { hasText: copy.systems.chess.newGame }).click();
    // A self-play move may still be in flight: wait until the board takes input.
    await waitChessReady(page);
    const stale = await chessState(page);
    if (stale.played !== null) throw new Error(`a reply from the old game landed on the new board: ${JSON.stringify(stale)}`);
    // Eight moves, the human side playing the engine's own hint each time:
    // every reply must be the top move and nothing may be recorded as a
    // departure. One move was not enough to mean anything (the mutation that
    // let human games sample still passed: that single reply happened not to
    // hit a near-tie and win the coin).
    const replies = [];
    for (let move = 1; move <= 8; move++) {
      await waitChessReady(page);
      await page.locator("#fig-chess button", { hasText: /^hint$/ }).click();
      await page.waitForFunction(() => JSON.parse(document.querySelector("#fig-chess [data-chess-self-play]").getAttribute("data-chess-self-play")).hint, null, { timeout: 60000 });
      const uci = (await chessState(page)).hint;
      await page.locator(`#fig-chess [aria-label^="${uci.slice(0, 2)} "]`).click();
      await page.locator(`#fig-chess [aria-label^="${uci.slice(2, 4)} "]`).click();
      await page
        .waitForFunction((n) => {
          const st = JSON.parse(document.querySelector("#fig-chess [data-chess-self-play]").getAttribute("data-chess-self-play"));
          return st.plies === n && st.played;
        }, move * 2, { timeout: 60000 })
        .catch(async () => {
          throw new Error(`human move ${move} (${uci}) never got an engine reply: ${JSON.stringify(await chessState(page))}`);
        });
      const st = await chessState(page);
      if (st.played !== st.top) throw new Error(`human game, reply ${move}: the engine played ${st.played}, not its top move ${st.top}`);
      if (st.deviations.length) throw new Error(`human game recorded a departure: ${JSON.stringify(st.deviations)}`);
      replies.push(st.played);
    }
    if ((await rule.count()) !== 0 && (await rule.isVisible())) throw new Error("the self-play rule still shows in a human game");
    notes.push(`human game, 8 hint moves: every reply the top move (${replies.join(" ")})`);
    return notes.join("; ");
  });
}

/* ---------------------------------------------------------------------- */
/* 3e. What search engines read (app/layout.tsx icons, app/page.tsx and   */
/* app/lab/page.tsx canonicals, app/robots.ts, app/sitemap.ts,            */
/* lib/site.ts). 2026-09-17: search results still showed the old logo and */
/* text. One host everywhere (neelayranjan.dev, owner's call); each page  */
/* names itself as canonical and the 404 names nothing; the icons are the */
/* owner's STIX-N mark at STABLE paths (a file-convention icon link       */
/* carries a hash and, on Vercel, the deployment id, which changes every  */
/* deploy; Google asks for a stable favicon URL); no SVG icon (Google     */
/* ignores SVG) and a PNG of 48px or more (Google's recommendation).      */
/* ---------------------------------------------------------------------- */

const EXPECTED_ICONS = [
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32" },
  { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
  { rel: "apple-touch-icon", href: "/apple-icon.png", type: "image/png", sizes: "180x180" },
];

function pngSize(buf) {
  if (buf.subarray(1, 4).toString("latin1") !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function checkSearchBasics(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    const notes = [];
    const headOf = (path) =>
      page.goto(BASE + path, { waitUntil: "domcontentloaded" }).then(() =>
        page.evaluate(() => ({
          canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute("href")),
          icons: [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]')].map((l) => ({
            rel: l.getAttribute("rel"),
            href: l.getAttribute("href"),
            type: l.getAttribute("type"),
            sizes: l.getAttribute("sizes"),
          })),
        })),
      );

    for (const [path, canonical] of [["/", SITE], ["/lab", `${SITE}/lab`]]) {
      const h = await headOf(path);
      if (h.canonicals.length !== 1 || h.canonicals[0] !== canonical) {
        throw new Error(`${path}: canonical ${JSON.stringify(h.canonicals)}, expected exactly ${canonical}`);
      }
      if (JSON.stringify(h.icons) !== JSON.stringify(EXPECTED_ICONS)) {
        throw new Error(`${path}: icon links ${JSON.stringify(h.icons)}, expected ${JSON.stringify(EXPECTED_ICONS)} (stable paths, no SVG, no query string)`);
      }
    }
    const missing = await headOf("/this-page-does-not-exist");
    if (missing.canonicals.length) throw new Error(`the 404 names a canonical: ${JSON.stringify(missing.canonicals)}`);
    notes.push(`canonicals ${SITE} and ${SITE}/lab, none on the 404; icons at stable paths`);

    for (const icon of EXPECTED_ICONS) {
      const res = await page.request.get(BASE + icon.href);
      if (res.status() !== 200 || res.headers()["content-type"] !== icon.type) {
        throw new Error(`${icon.href}: ${res.status()} ${res.headers()["content-type"]}, expected 200 ${icon.type}`);
      }
      const buf = await res.body();
      if (icon.type === "image/png") {
        const [w, h] = icon.sizes.split("x").map(Number);
        const got = pngSize(buf);
        if (!got || got.w !== w || got.h !== h) throw new Error(`${icon.href} is ${JSON.stringify(got)}, its link says ${icon.sizes}`);
        if (w < 48) throw new Error(`${icon.href} is ${w}px; Google recommends 48px or larger`);
      } else {
        const n = buf.readUInt16LE(4);
        const sizes = Array.from({ length: n }, (_, i) => buf[6 + 16 * i] || 256).sort((a, b) => a - b);
        if (sizes.join(",") !== "16,32") throw new Error(`/favicon.ico holds ${sizes.join(",")}, its link says 16 and 32`);
      }
    }
    for (const gone of ["/icon.svg", "/icon.png"]) {
      const res = await page.request.get(BASE + gone);
      if (res.status() !== 404) throw new Error(`${gone} is still served (${res.status()})`);
    }

    const robots = await page.request.get(`${BASE}/robots.txt`);
    const robotsText = await robots.text();
    if (robots.status() !== 200 || !robots.headers()["content-type"]?.startsWith("text/plain")) {
      throw new Error(`/robots.txt: ${robots.status()} ${robots.headers()["content-type"]}`);
    }
    for (const line of ["User-Agent: *", "Allow: /", "Disallow: /api/", `Sitemap: ${SITE}/sitemap.xml`]) {
      if (!robotsText.split("\n").map((l) => l.trim()).includes(line)) throw new Error(`/robots.txt lacks ${JSON.stringify(line)}: ${JSON.stringify(robotsText)}`);
    }

    const sitemap = await page.request.get(`${BASE}/sitemap.xml`);
    const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (sitemap.status() !== 200 || JSON.stringify(locs) !== JSON.stringify([SITE, `${SITE}/lab`])) {
      throw new Error(`/sitemap.xml: ${sitemap.status()}, locs ${JSON.stringify(locs)}, expected ${JSON.stringify([SITE, `${SITE}/lab`])}`);
    }
    notes.push(`robots.txt disallows /api/ and names the sitemap; sitemap lists ${locs.length} pages on ${SITE}`);
    return notes.join("; ");
  });
}

/* ---------------------------------------------------------------------- */
/* 3f. The resume the site serves (2026-09-22, owner call). It used to be  */
/* a Google Drive link; the resume now lives in a PRIVATE GitHub repo,     */
/* which can't serve a public link, so scripts/pull-resume.mjs copies the  */
/* PDF into public/. Linkable but not indexable: the site's own page is    */
/* what should rank for the owner's name, and the PDF carries a phone      */
/* number that needn't be in a search index.                               */
/* ---------------------------------------------------------------------- */

async function checkResumePdf(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('[data-track-label="Resume"]')].map((a) => a.getAttribute("href")),
    );
    if (links.length < 1) throw new Error("no Resume link on the page");
    for (const href of links) {
      if (href !== "/resume.pdf") throw new Error(`a Resume link points at ${href}, expected /resume.pdf`);
    }
    const drive = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h.includes("docs.google.com")),
    );
    if (drive.length) throw new Error(`Drive is still linked: ${drive.join(", ")}`);

    const res = await page.request.get(`${BASE}/resume.pdf`);
    const type = res.headers()["content-type"] ?? "";
    if (res.status() !== 200 || !type.startsWith("application/pdf")) {
      throw new Error(`/resume.pdf: ${res.status()} ${type}`);
    }
    const body = await res.body();
    if (body.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error(`/resume.pdf does not start %PDF- (${JSON.stringify(body.subarray(0, 8).toString("latin1"))})`);
    }
    const robots = res.headers()["x-robots-tag"] ?? "";
    if (!robots.includes("noindex")) throw new Error(`/resume.pdf has X-Robots-Tag ${JSON.stringify(robots)}, expected noindex`);

    // The sitemap lists pages, never the PDF.
    const sitemap = await (await page.request.get(`${BASE}/sitemap.xml`)).text();
    if (sitemap.includes("resume")) throw new Error("the sitemap lists the resume PDF");

    return `${links.length} Resume link(s) at /resume.pdf, served ${(body.length / 1024).toFixed(1)} KB as ${type}, noindex, absent from the sitemap; no Drive link left`;
  });
}

/* ---------------------------------------------------------------------- */
/* 3b. The /lab rail (discoverability Task 7): the stamp is status only,  */
/* no longer inside a link; the door is the bordered box below it; the   */
/* References entry that was always the fallback door still resolves.    */
/* ---------------------------------------------------------------------- */

async function checkLabBoxNavigates(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const box = page.locator("[data-lab-box]");
    const count = await box.count();
    if (count !== 1) throw new Error(`expected exactly one [data-lab-box] in the masthead rail, found ${count}`);
    const href = await box.getAttribute("href");
    if (href !== "/lab") throw new Error(`lab box href is ${JSON.stringify(href)}, expected "/lab"`);
    const text = (await box.textContent()).trim();
    if (!text.includes(copy.masthead.supplementLabel)) {
      throw new Error(`lab box text ${JSON.stringify(text)} does not include copy.masthead.supplementLabel ${JSON.stringify(copy.masthead.supplementLabel)}`);
    }
    if (!text.includes(copy.masthead.supplementContents)) {
      throw new Error(`lab box text ${JSON.stringify(text)} does not include copy.masthead.supplementContents ${JSON.stringify(copy.masthead.supplementContents)}`);
    }
    await box.click();
    await page.waitForURL(`${BASE}/lab`, { timeout: 5000 });
    if ((await page.locator("[data-sheet]").count()) < 1) {
      throw new Error(`navigated to ${page.url()} but no [data-sheet] rendered there`);
    }
    return `[data-lab-box] href is /lab, carries the label and contents copy, click navigated to ${page.url()}`;
  });
}

async function checkStampNoLinkAncestor(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const stamps = page.locator("[data-stamp]");
    const count = await stamps.count();
    if (count !== 1) throw new Error(`expected exactly one [data-stamp], found ${count}`);
    const ancestorTag = await stamps.first().evaluate((el) => el.closest("a")?.tagName ?? null);
    if (ancestorTag) throw new Error(`[data-stamp] has an <a> ancestor (${ancestorTag}); the stamp must be status only, not a link`);
    const stampText = (await stamps.first().textContent()).trim();
    if (stampText !== copy.masthead.stamp) {
      throw new Error(`stamp text is ${JSON.stringify(stampText)}, copy.masthead.stamp is ${JSON.stringify(copy.masthead.stamp)}`);
    }
    return `[data-stamp] ("${stampText}") has no <a> ancestor`;
  });
}

async function checkReferencesLabLinkResolves(browser) {
  const items = copy.references.items;
  const last = items[items.length - 1];
  if (last.href !== "/lab") {
    throw new Error(`References' last item is ${JSON.stringify(last)}, expected the supplementary-material entry with href "/lab"`);
  }
  const res = await fetch(`${BASE}${last.href}`);
  if (res.status !== 200) throw new Error(`GET ${BASE}${last.href} returned ${res.status}, expected 200`);
  // Cross-check it's actually reachable through the rendered References list too.
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const inReferences = await page.evaluate(
      (label) => [...document.querySelectorAll("ol a")].some((a) => a.textContent.trim() === label),
      last.label,
    );
    if (!inReferences) throw new Error(`References' list has no <a> reading ${JSON.stringify(last.label)}`);
    return `References' last entry ("${last.label}" -> ${last.href}) rendered as a link and GET ${last.href} returned 200`;
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

/** Figure 1 is STATIC since 2026-09-30 (owner call): no slider, readouts,
 *  whiskers or mask strip. What it must still get right, all against the
 *  SERVED json: every displayed series drawn with one point per budget and
 *  ε-diffusion still off the chart; x0 drawn last at full strength with the
 *  baselines faded; x0's printed value at the smallest budget; the lead
 *  bracket's number equal to x0 minus the best baseline there (and no
 *  bracket at all if x0 doesn't lead); the shaded column centred on that
 *  budget's points. */
async function checkLabelEfficiency(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 1400 } }, async (page) => {
    const eff = await (await fetch(`${BASE}/research/label_efficiency.json`)).json();
    const EFF_HIDDEN = new Set(["ediffusion"]);
    const models = Object.keys(eff.models).filter((m) => !EFF_HIDDEN.has(m));
    if (models.length === Object.keys(eff.models).length) {
      throw new Error("expected ediffusion in the served json (the hidden-model contract moved?)");
    }
    const budgets = eff.models.x0diffusion.map((p) => p.labels);
    const x0Low = eff.models.x0diffusion[0].diceMean;
    const baselines = models.filter((m) => m !== "x0diffusion");
    const runner = baselines.reduce((a, b) =>
      eff.models[a][0].diceMean >= eff.models[b][0].diceMean ? a : b,
    );
    const lead = x0Low - eff.models[runner][0].diceMean;

    await page.goto(BASE, { waitUntil: "networkidle" });
    const fig = page.locator("#fig-eff");
    await fig.waitFor({ state: "attached", timeout: 10000 });

    const shape = await fig.evaluate((el) => {
      const svg = el.querySelector("svg");
      const series = [...el.querySelectorAll("g[data-series]")].map((g) => ({
        id: g.getAttribute("data-series"),
        opacity: Number(g.getAttribute("opacity") ?? 1),
        points: g.querySelectorAll("circle").length,
        firstCx: Number(g.querySelector("circle")?.getAttribute("cx")),
      }));
      const rect = el.querySelector("rect[data-eff-highlight]");
      return {
        controls: el.querySelectorAll("input, button, canvas").length,
        strip: !!el.querySelector("#fig-eff-strip"),
        series,
        value: el.querySelector("[data-eff-x0-value]")?.textContent?.trim() ?? null,
        lead: el.querySelector("g[data-eff-lead] text")?.textContent?.trim() ?? null,
        rectCenter: rect ? Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) / 2 : null,
        legend: [...(svg?.querySelectorAll("text") ?? [])].map((n) => n.textContent),
      };
    });

    if (shape.controls !== 0 || shape.strip) {
      throw new Error(`Figure 1 should be static; found ${shape.controls} controls/canvases, strip ${shape.strip}`);
    }
    const ids = shape.series.map((s) => s.id);
    if (ids.length !== models.length || !models.every((m) => ids.includes(m))) {
      throw new Error(`drawn series ${JSON.stringify(ids)} != displayed models ${JSON.stringify(models)}`);
    }
    if (ids.includes("ediffusion")) throw new Error("ε-diffusion is drawn; it must stay off the chart");
    for (const s of shape.series) {
      if (s.points !== budgets.length) throw new Error(`${s.id} draws ${s.points} points, expected ${budgets.length}`);
    }
    if (ids[ids.length - 1] !== "x0diffusion") throw new Error(`x0 must be drawn last (on top); order ${JSON.stringify(ids)}`);
    const x0 = shape.series.find((s) => s.id === "x0diffusion");
    if (x0.opacity !== 1) throw new Error(`x0 series opacity ${x0.opacity}, expected 1`);
    const unfaded = shape.series.filter((s) => s.id !== "x0diffusion" && !(s.opacity < 1));
    if (unfaded.length) throw new Error(`baselines not faded: ${unfaded.map((s) => s.id).join(", ")}`);

    const wantValue = `${EFF_LABELS.x0diffusion} ${x0Low.toFixed(3)}`;
    if (shape.value !== wantValue) throw new Error(`x0 value label ${JSON.stringify(shape.value)}, expected ${JSON.stringify(wantValue)}`);
    if (lead > 0) {
      const wantLead = `+${lead.toFixed(3)}`;
      if (shape.lead !== wantLead) throw new Error(`lead label ${JSON.stringify(shape.lead)}, expected ${JSON.stringify(wantLead)} over ${runner}`);
    } else if (shape.lead !== null) {
      throw new Error(`x0 does not lead at ${budgets[0]} labels, but a lead label ${JSON.stringify(shape.lead)} is drawn`);
    }
    if (shape.rectCenter === null || Math.abs(shape.rectCenter - x0.firstCx) > 0.5) {
      throw new Error(`highlight column centre ${shape.rectCenter} is not on the ${budgets[0]}-label points (${x0.firstCx})`);
    }
    for (const m of models) {
      if (!shape.legend.includes(EFF_LABELS[m])) throw new Error(`legend has no entry ${JSON.stringify(EFF_LABELS[m])}`);
    }

    return (
      `static: ${models.length} series x ${budgets.length} budgets, no controls, ε-diffusion off the chart; ` +
      `x0 on top, baselines faded; "${shape.value}"; lead ${shape.lead} over ${runner} at ${budgets[0]} labels; ` +
      `highlight column on the ${budgets[0]}-label points`
    );
  });
}

/* ---------------------------------------------------------------------- */
/* 5. Flight video plays in view, pauses out of view                      */
/* (Figure S3 on /lab since the SLAAC round, 2026-09-30:                  */
/* components/figures/FlightFigure.tsx, the only <video> on that page;    */
/* page 1's Figure 3 is now the live rerouter, section 5b below)          */
/* ---------------------------------------------------------------------- */

async function checkLabFlightVideo(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
    // Behind DeferredMount on /lab, so it has to be scrolled to before it exists.
    await scrollUntilAttached(page, "video");
    const video = page.locator("video").first();
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
    // Proved to bite (2026-09-30): `n="3"` on /lab failed with "the video's
    // caption doesn't read Figure S3: "Figure 3. A full day of FAA ..."".
    const caption = await video.evaluate((v) => v.closest("figure")?.querySelector("figcaption")?.textContent ?? "");
    if (!caption.includes("Figure S3")) throw new Error(`the video's caption doesn't read Figure S3: ${JSON.stringify(caption.slice(0, 60))}`);
    return "on /lab as Figure S3: playing() while >=40% in view, paused() after scrolling back to top";
  });
}

/* ---------------------------------------------------------------------- */
/* 5b. Figure 3: the SLAAC rerouter (components/figures/RerouteFigure.tsx,*/
/* lib/slaac-engine.ts, lib/slaac-worker.ts; SLAAC round, 2026-09-30).    */
/* The figure sits behind DeferredMount inside the NASA box, so every     */
/* check scrolls it in first. One reroute of KJFK-KMIA past the Cape     */
/* measured ~14 s of worker time in headless Firefox here (~16 s from the  */
/* press, 3 arcs at 20 steps); the timeouts below are sized for that,     */
/* not for a real browser, and each check keeps its full runs few.        */
/* ---------------------------------------------------------------------- */

const SLAAC_ROUTES = JSON.parse(readFileSync(new URL("../public/slaac/routes.json", import.meta.url), "utf8"));
const SLAAC_LAUNCH = JSON.parse(readFileSync(new URL("../public/slaac/launch-sua.json", import.meta.url), "utf8"));
const SLAAC_COPY = copy.research.figReroute;
/** Florida's hubs in the route library. Hand-kept: airports.json carries no state. */
const FLORIDA = new Set(["KMIA", "KFLL", "KMCO", "KTPA"]);
/** Every slaac check runs at this instant: the press seeds its noise from
 *  Date.now(), so a pinned clock makes a run's arcs the same on every run. */
const SLAAC_DATE = new Date("2026-09-30T18:00:00.000Z");
/** A superseded run stops at its next per-forward yield (R16), before its
 *  first progress message (posted every 2 forwards) in practice; 2 allows a
 *  slow dispatch. A full KJFK-KMIA run posts 10. */
const SLAAC_STALE_PROGRESS_MAX = 2;

function rerouteStatus(page) {
  return page.evaluate(() => JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus));
}

async function waitRerouteState(page, states, timeout = 30000) {
  await page
    .waitForFunction(
      (states) => {
        const el = document.querySelector("[data-reroute-status]");
        return !!el && states.includes(JSON.parse(el.dataset.rerouteStatus).state);
      },
      states,
      { timeout },
    )
    .catch(async (err) => {
      const now = await page
        .evaluate(() => document.querySelector("[data-reroute-status]")?.dataset.rerouteStatus ?? null)
        .catch(() => null);
      throw new Error(`Figure 3 never reached ${states.join("/")}: ${now ? JSON.parse(now).state : "not mounted"} (${err.message.split("\n")[0]})`);
    });
}

/** Scroll the NASA box's figure in (DeferredMount), wait for its data, and
 *  centre the map. The notes sit right after the figure's slot, so bringing
 *  them into view brings the slot within DeferredMount's 200px margin. */
async function openReroute(page) {
  await page.locator("[data-nasa-notes]").scrollIntoViewIfNeeded();
  await scrollUntilAttached(page, "[data-reroute-pair]", { maxScrolls: 6, step: 300 });
  await waitRerouteState(page, ["idle"]);
  await page.evaluate(() => document.querySelector("[data-reroute-figure] canvas").scrollIntoView({ block: "center" }));
}

/** Pick one library pair by name ("KJFK-KMIA"). Figure 3 opens on "all
 *  flights" since Task 12c, so every check about one pair says which. */
async function selectReroutePair(page, name) {
  const i = SLAAC_ROUTES.pairs.findIndex((p) => `${p.origin}-${p.dest}` === name);
  if (i < 0) throw new Error(`${name} is not in routes.json`);
  await page.selectOption("[data-reroute-pair]", String(i));
  await page.waitForFunction((i) => JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus).mode === "pair" && document.querySelector("[data-reroute-pair]").value === String(i), i);
  // The focus view eases from all flights to the pair (350 ms): let it land
  // before anything reads the view to aim a click.
  await page.waitForTimeout(500);
  return SLAAC_ROUTES.pairs[i];
}

/** The map's current view as reroute-map.ts's MapView, from the page's hook. */
async function rerouteView(page) {
  const { box, view, dpr } = await page.evaluate(() => {
    const c = document.querySelector("[data-reroute-figure] canvas");
    const r = c.getBoundingClientRect();
    return { box: { x: r.x, y: r.y, w: r.width, h: r.height }, view: window.__slaac.view, dpr: c.width / r.width };
  });
  return { box, view: { w: box.w, h: box.h, dpr, ...view } };
}

/** Switch to the whole-US view and wait until the ease has SETTLED on
 *  exactly the lower-48 fit (the status re-renders only when it settles). */
async function rerouteWholeUs(page) {
  await page.locator("[data-reroute-view]").getByRole("button", { name: SLAAC_COPY.controls.viewUs, exact: true }).click();
  const { box, view } = await rerouteView(page);
  const want = fitLower48(Math.round(box.w), Math.round(box.h), view.dpr).scale;
  await page.waitForFunction(
    (want) => {
      const v = JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus).view;
      return v?.mode === "us" && Math.abs(v.scale - want) < 1e-12;
    },
    want,
    { timeout: 5000 },
  );
}

/** Click (or tap) at a [lat, lon] through the map's current view. */
async function rerouteAt(page, lat, lon, { touch = false } = {}) {
  const { box, view } = await rerouteView(page);
  const [x, y] = toScreen(view, lat, lon);
  if (touch) await page.touchscreen.tap(box.x + x, box.y + y);
  else await page.mouse.click(box.x + x, box.y + y);
}

/** Like workerSpy, plus each Worker's traffic: what it was sent and what it
 *  posted back, as {kind, runId}. The rerouter's worker is the one sent a
 *  `load` carrying navaids (the chess worker's load carries none). */
function slaacWorkerSpy() {
  const Real = window.Worker;
  window.__workers = [];
  window.Worker = class extends Real {
    constructor(...args) {
      super(...args);
      this.__terminated = false;
      this.__slaac = false;
      this.__sent = [];
      this.__got = [];
      this.addEventListener("message", (e) => {
        const d = e.data;
        if (d && typeof d === "object") this.__got.push({ kind: d.kind, runId: d.runId ?? null });
      });
      window.__workers.push(this);
    }
    postMessage(msg, ...rest) {
      if (msg?.kind === "load" && msg.navaids) this.__slaac = true;
      if (msg?.kind === "reroute") window.__lastRerouteReq = msg;
      this.__sent.push({ kind: msg?.kind, runId: msg?.runId ?? null });
      return super.postMessage(msg, ...rest);
    }
    terminate() {
      this.__terminated = true;
      super.terminate();
    }
  };
}

const slaacWorkers = (page) =>
  page.evaluate(() =>
    window.__workers
      .filter((w) => w.__slaac)
      .map((w) => ({ terminated: w.__terminated, sent: w.__sent, got: w.__got })),
  );

/**
 * Nothing at rest: scrolling Figure 3 in and leaving it alone fetches its
 * small JSON and nothing else: no model, and no rerouter worker, so none of
 * the ORT runtime on its account. Then a press with nothing to reroute
 * (launch sites off, a box drawn over central Nevada, the default KJFK-KMIA
 * pair a continent away) answers "no conflict" from the main thread's
 * planner and still loads nothing.
 *
 * The runtime is asserted through the worker, not the URL: scrolling the NASA
 * box in also brings Figure 4's DeferredMount within its 200px margin, and the
 * chess worker legitimately fetches the same `/ort/ort-wasm-simd-threaded.wasm`
 * (measured: it does, ~140 ms after the rerouter's JSON). The spy marks the
 * rerouter's worker by its `load` message, so "no such worker" is "no /ort/
 * fetch of the rerouter's own".
 *
 * Proved to bite (2026-09-30): calling `loadSlaacEngine()` in the figure's
 * data effect (on mount) failed with "the rerouter loaded at rest: model
 * requests [HEAD .../models/flightdiff-b3463317.onnx, GET ...], rerouter
 * workers 1, __slaac.loaded false".
 */
async function checkSlaacNothingAtRest(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.addInitScript(slaacWorkerSpy);
    const urls = [];
    page.on("request", (req) => urls.push(`${req.method()} ${req.url()}`));
    const loaded = async () => {
      const model = [...new Set(urls.filter((u) => /\/models\/flightdiff-/.test(u)).map((u) => u.split(" ")[1]))];
      const workers = (await slaacWorkers(page)).length;
      const hook = await page.evaluate(() => window.__slaac?.loaded ?? null);
      return model.length || workers || hook ? `model requests ${JSON.stringify(model)}, rerouter workers ${workers}, __slaac.loaded ${hook}` : null;
    };
    await page.goto(BASE, { waitUntil: "networkidle" });
    await openReroute(page);
    await page.waitForTimeout(2000); // anything a mount effect or an idle callback might start has started
    const data = new Set(urls.filter((u) => SLAAC_DATA_RE.test(u)).map((u) => u.split(" ")[1])).size;
    if (data < 6) throw new Error(`Figure 3 mounted but fetched ${data} of its 6 JSON files`);
    let bad = await loaded();
    if (bad) throw new Error(`the rerouter loaded at rest: ${bad}`);

    // At rest is the all-flights default; the no-conflict press is one pair's.
    await selectReroutePair(page, "KJFK-KMIA");
    await page.locator("[data-reroute-launch]").uncheck();
    await rerouteWholeUs(page);
    await page.locator("[data-reroute-draw]").click();
    const ring = [[39.5, -117.5], [39.5, -115.5], [37.5, -115.5], [37.5, -117.5]];
    for (const [lat, lon] of ring) await rerouteAt(page, lat, lon);
    await rerouteAt(page, ...ring[0]); // the first corner again closes it
    const pressed = await page.locator("[data-reroute-draw]").getAttribute("aria-pressed");
    if (pressed !== "false") throw new Error("the Nevada box didn't close (draw mode still on)");

    await page.locator("[data-reroute-go]").click();
    await waitRerouteState(page, ["no-conflict", "done", "unavailable", "failed"], 30000);
    const st = await rerouteStatus(page);
    if (st.state !== "no-conflict") throw new Error(`a box far from every route ran as ${st.state}, not no-conflict`);
    const readout = await page.locator("[data-reroute-figure] [role=status]").textContent();
    if (readout !== SLAAC_COPY.noConflict) throw new Error(`readout ${JSON.stringify(readout)}, not the no-conflict line`);
    await page.waitForTimeout(1000);
    bad = await loaded();
    if (bad) throw new Error(`a no-conflict press loaded the rerouter: ${bad}`);
    const ortFiles = [...new Set(urls.filter((u) => /\/ort\//.test(u)).map((u) => new URL(u.split(" ")[1]).pathname))];
    return `scrolled in (all flights, the default): ${data} JSON files, no model, no rerouter worker (distinct /ort/ files on the page, all the chess figure's: ${ortFiles.join(", ") || "none"}); a Nevada box with launch sites off read "no conflict" and still loaded nothing`;
  });
}

/**
 * One full reroute, KJFK-KMIA (the route library's first Florida pair) with
 * every launch site on, at a pinned instant. Crossings are recomputed here,
 * in node, from each plan the page received and the served launch rings
 * (lib/slaac/geometry.ts's own leg test), rather than read off the status
 * label the same numbers produced: 0 for every `ok` and every `untouched`
 * flight, more than 0 for any `cannot-clear` one. Then the stale-run rule, at
 * each of its three layers:
 *
 *  - the figure: three presses in ONE task, before React re-renders (so the
 *    disabled attribute can't be what stops the second and third; the
 *    figure's busy guard has to), start exactly one run and land one `done`;
 *  - the engine (lib/slaac-engine.ts's runId filter): while the figure's
 *    run 3 is in flight, a reply for run 999 (run 2's real `done` and a
 *    progress, relabelled) is dispatched on the worker object as if the
 *    worker had posted it. The engine must drop both: the figure ends on
 *    run 3's `done`, landed once. Dispatched rather than produced, because
 *    since R16 the worker itself can't post for a run it has moved past;
 *  - the worker (lib/slaac-worker.ts, R16's per-forward yield plus `post`'s
 *    filter): the figure's own request, sent straight to the live worker as
 *    runs 1001 and 1002 back to back. 1001 must stop at its first yield:
 *    at most SLAAC_STALE_PROGRESS_MAX progress messages and no `done` for
 *    it (a full run posts 10 progress messages here), nothing for it after
 *    1002's first message, and 1002 finishes.
 *
 * Proved to bite (2026-09-30), four ways:
 *  - dropping `busyRef.current` from the press's guard → "three presses in
 *    one task started 3 runs, expected 1";
 *  - dropping the engine's runId test (`if (!a) return;`) → "the figure took run 999's done while
 *    awaiting run 3";
 *  - removing `beforeForward: yieldToQueue` from lib/slaac-worker.ts (R16's
 *    yield) → "superseded run 1001 ran to its done (10 progress
 *    messages, a full run posts 10)";
 *  - (before R16, the engine bite against a worker-side replay, now
 *    replaced) "the figure took run 1001's done while awaiting run 3".
 */
async function checkSlaacReroute(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.clock.setFixedTime(SLAAC_DATE);
    await page.addInitScript(slaacWorkerSpy);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await openReroute(page);

    const pairIdx = SLAAC_ROUTES.pairs.findIndex((p) => FLORIDA.has(p.origin) || FLORIDA.has(p.dest));
    const pair = SLAAC_ROUTES.pairs[pairIdx];
    await page.selectOption("[data-reroute-pair]", String(pairIdx));
    await page.locator("[data-reroute-launch]").check();
    await page.locator("[data-reroute-go]").click();
    await waitRerouteState(page, ["done", "no-conflict", "unavailable", "failed"], 120000);
    const st = await rerouteStatus(page);
    if (st.state !== "done") throw new Error(`${pair.origin}-${pair.dest} with the launch sites on ended ${st.state}, not done`);
    if (st.flights.length !== pair.routes.length) throw new Error(`${st.flights.length} flights in the status, ${pair.routes.length} routes in the pair`);

    const done = await page.evaluate(() => window.__slaac.lastDone);
    const polys = loadSua(SLAAC_LAUNCH.sites.flatMap((s) => s.polys.map((p) => p.ring)));
    const crossingsOf = (plan) => {
      const xy = plan.map((q) => albers(q[1], q[2]));
      let n = 0;
      for (let i = 0; i + 1 < xy.length; i++) if (polys.some((P) => segCrossesPoly(xy[i], xy[i + 1], P))) n++;
      return n;
    };
    let rerouted = 0;
    let untouched = 0;
    for (const f of done.flights) {
      const s = st.flights.find((x) => x.id === f.id);
      const legs = crossingsOf(f.plan);
      if (s.status === "untouched") {
        if (legs !== 0) throw new Error(`flight ${f.id} marked untouched but its plan crosses airspace on ${legs} leg(s)`);
        untouched++;
        continue;
      }
      if (s.status === "cannot-clear") {
        if (legs === 0) throw new Error(`flight ${f.id} marked cannot-clear but its plan crosses no airspace`);
        continue;
      }
      if (s.metrics.legCrossings !== 0 || legs !== 0) {
        throw new Error(`flight ${f.id} (${s.status}) crosses airspace: status says ${s.metrics.legCrossings}, recomputed ${legs}`);
      }
      rerouted++;
    }
    if (rerouted < 1) throw new Error(`no flight was rerouted: ${JSON.stringify(st.flights.map((f) => f.status))}`);
    const used = () => demoEvents(page, "slaac");
    if ((await used()) !== 1) throw new Error(`demo_used{slaac} queued ${await used()}x after one run, expected 1`);

    // Every state the status takes from here, so a "done" left over from the
    // previous run can't satisfy a wait for the next one.
    await page.evaluate(() => {
      window.__rerouteStates = [];
      const el = document.querySelector("[data-reroute-status]");
      new MutationObserver(() => window.__rerouteStates.push(JSON.parse(el.dataset.rerouteStatus).state)).observe(el, {
        attributes: true,
        attributeFilter: ["data-reroute-status"],
      });
    });
    const nextDone = async () => {
      await page.waitForFunction(() => window.__rerouteStates.some((s) => s === "done" || s === "unavailable" || s === "failed"), null, {
        timeout: 180000,
      });
      const states = await page.evaluate(() => window.__rerouteStates.splice(0));
      const dones = states.filter((s, i) => s === "done" && states[i - 1] !== "done").length;
      if (states.includes("unavailable") || states.includes("failed")) throw new Error(`a run ended unavailable or failed: ${states.join(" > ")}`);
      return { states, dones };
    };

    // The figure: three presses in one task. React 19 renders a click's
    // state on a microtask, so between these synchronous clicks the button is
    // never re-rendered disabled and every click reaches the handler; only
    // the figure's busy guard can turn the second and third away. (A
    // Playwright click first and two more after it would hit a button React
    // had already disabled, and prove nothing: measured, the busy-guard bite
    // passed that way.)
    await page.evaluate(() => {
      const go = document.querySelector("[data-reroute-go]");
      go.click();
      go.click();
      go.click();
    });
    const burst = await nextDone();
    const runId = await page.evaluate(() => window.__slaac.runId);
    if (runId !== 2) throw new Error(`three presses in one task started ${runId - 1} runs, expected 1`);
    if (burst.dones !== 1) throw new Error(`${burst.dones} done states landed for one accepted press: ${burst.states.join(" > ")}`);
    let [w] = await slaacWorkers(page);
    const sentRuns = w.sent.filter((m) => m.kind === "reroute").map((m) => m.runId);
    if (JSON.stringify(sentRuns) !== "[1,2]") throw new Error(`the worker was sent reroute runs ${JSON.stringify(sentRuns)}, expected [1,2]`);
    if ((await page.evaluate(() => window.__slaac.lastDone?.runId)) !== 2) throw new Error("the figure doesn't hold run 2's done");
    if ((await used()) !== 1) throw new Error(`demo_used{slaac} queued ${await used()}x after two runs, expected 1`);

    // The engine: a reply for run 999 lands while it awaits run 3.
    await page.locator("[data-reroute-go]").click();
    await waitRerouteState(page, ["running"], 60000);
    await page.evaluate(() => {
      const worker = window.__workers.find((x) => x.__slaac && !x.__terminated);
      const stale = { ...window.__slaac.lastDone, runId: 999 };
      worker.dispatchEvent(new MessageEvent("message", { data: { kind: "progress", runId: 999, step: 1, steps: 20, arcs: [] } }));
      worker.dispatchEvent(new MessageEvent("message", { data: stale }));
    });
    const engine = await nextDone();
    const held = await page.evaluate(() => window.__slaac.lastDone?.runId);
    if (held !== 3) throw new Error(`the figure took run ${held}'s done while awaiting run 3`);
    if (engine.dones !== 1) throw new Error(`${engine.dones} done states landed for one press: ${engine.states.join(" > ")}`);

    // The worker: runs 1001 and 1002 back to back, straight in.
    await page.evaluate(() => {
      const worker = window.__workers.find((x) => x.__slaac && !x.__terminated);
      worker.postMessage({ ...window.__lastRerouteReq, runId: 1001 });
      worker.postMessage({ ...window.__lastRerouteReq, runId: 1002 });
    });
    await page.waitForFunction(
      () => window.__workers.find((x) => x.__slaac && !x.__terminated).__got.some((m) => m.kind === "done" && m.runId === 1002),
      null,
      { timeout: 180000 },
    );
    [w] = await slaacWorkers(page);
    const firstOf1002 = w.got.findIndex((m) => m.runId === 1002);
    const stale = w.got.map((m, i) => ({ ...m, i })).filter((m) => m.runId === 1001);
    const staleProgress = stale.filter((m) => m.kind === "progress").length;
    const fullProgress = w.got.filter((m) => m.kind === "progress" && m.runId === 1002).length;
    if (stale.some((m) => m.kind === "done")) {
      throw new Error(`superseded run 1001 ran to its done (${staleProgress} progress messages, a full run posts ${fullProgress})`);
    }
    if (staleProgress > SLAAC_STALE_PROGRESS_MAX) {
      throw new Error(`superseded run 1001 posted ${staleProgress} progress messages before stopping (max ${SLAAC_STALE_PROGRESS_MAX}, a full run posts ${fullProgress})`);
    }
    if (stale.some((m) => m.i > firstOf1002)) throw new Error(`the worker posted for run 1001 after run 1002 began: ${JSON.stringify(stale)}`);
    // (999 is the engine half's dispatched reply, which the spy hears too.)
    const doneOrder = w.got.filter((m) => m.kind === "done" && m.runId !== 999).map((m) => m.runId);
    if (JSON.stringify(doneOrder) !== "[1,2,3,1002]") throw new Error(`the worker answered done for runs ${JSON.stringify(doneOrder)}, expected [1,2,3,1002]`);
    if ((await page.evaluate(() => window.__slaac.lastDone?.runId)) !== 3) throw new Error("a reply nobody awaited replaced the figure's done");
    if ((await used()) !== 1) throw new Error(`demo_used{slaac} queued ${await used()}x after three runs, expected 1`);
    return `${pair.origin}-${pair.dest}, all six launch sites: ${rerouted} of ${st.flights.length} flights rerouted, ${untouched} untouched, 0 recomputed crossings, ${st.arcs} arcs in ${(st.ms / 1000).toFixed(1)} s; three presses in one task ran one run; a run-999 reply dispatched during run 3 was dropped by the engine; back-to-back runs 1001/1002: 1001 posted ${staleProgress} progress and no done, 1002 finished (${fullProgress} progress); demo_used{slaac} once`;
  });
}

/**
 * The launch preset draws: in the whole-US view at 1280, all six sites are in
 * view and labelled, and the canvas pixel at each site's own centroid (the
 * status's `launchSites[].centroid`, CSS px, ruling R4) is the map's red,
 * --color-red-ink, at the airspace fill's alpha or the outline's. Turning the
 * sites off clears every one of those pixels and every label: the red came
 * from the launch layer, not a route crossing the same spot.
 *
 * Proved to bite (2026-09-30): removing the launch sites' `fillRing` loop
 * from drawMap (components/figures/reroute-map.ts) failed with "ksc:
 * centroid pixel (611, 375) reads 0,0,0,0, not the airspace red".
 */
async function checkSlaacLaunchPreset(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await openReroute(page);
    // One pair: all 373 filed routes would put route ink on some centroids.
    await selectReroutePair(page, "KJFK-KMIA");
    await page.locator("[data-reroute-launch]").check();
    await rerouteWholeUs(page);
    const pixelAt = ([x, y]) =>
      page.evaluate(([x, y]) => {
        const c = document.querySelector("[data-reroute-figure] canvas");
        const s = c.width / c.getBoundingClientRect().width;
        return [...c.getContext("2d").getImageData(Math.round(x * s), Math.round(y * s), 1, 1).data];
      }, [x, y]);
    // The airspace fill is --color-red-ink (229, 53, 43) at 0.18 alpha
    // (~46/255), its outline the same red at full; getImageData returns it
    // un-premultiplied, so the hue survives the low alpha.
    const isRed = ([r, g, b, a]) => a >= 30 && r >= 180 && g <= 90 && b <= 90;

    let st = await rerouteStatus(page);
    const ids = SLAAC_LAUNCH.sites.map((s) => s.id);
    if (JSON.stringify(st.launchSites.map((s) => s.id)) !== JSON.stringify(ids)) {
      throw new Error(`status lists ${st.launchSites.map((s) => s.id).join(", ")}, launch-sua.json ${ids.join(", ")}`);
    }
    const reads = [];
    for (const s of st.launchSites) {
      if (!s.inView) throw new Error(`${s.id} is out of view in the whole-US view (centroid ${JSON.stringify(s.centroid)})`);
      if (!s.labelled) throw new Error(`${s.id}'s name isn't drawn at 1280 in the whole-US view`);
      const px = await pixelAt(s.centroid);
      if (!isRed(px)) throw new Error(`${s.id}: centroid pixel (${s.centroid.map(Math.round).join(", ")}) reads ${px.join(",")}, not the airspace red`);
      reads.push(`${s.id} ${px.join(",")}`);
    }

    await page.locator("[data-reroute-launch]").uncheck();
    await rerouteWholeUs(page); // the view doesn't move in "us" mode; this waits out the repaint
    await page.waitForFunction(() => !JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus).launchOn);
    await page.waitForTimeout(200); // the repaint is one coalesced rAF
    st = await rerouteStatus(page);
    for (const s of st.launchSites) {
      if (s.labelled) throw new Error(`${s.id} still labelled with the launch sites off`);
      const px = await pixelAt(s.centroid);
      if (isRed(px)) throw new Error(`${s.id}: centroid still red (${px.join(",")}) with the launch sites off`);
    }
    return `whole US at 1280: six sites in view and labelled, each centroid red (${reads.join("; ")}); all clear with the sites off`;
  });
}

/**
 * Stargaze mid-run (the chess rule, RerouteFigure's subscriber): a reroute
 * in progress, then stargaze. The worker is terminated (the spy sees it),
 * `__offload.slaac` counts exactly one, the run ends in idle with no `done`,
 * no error line and no `demo_used`, and a MutationObserver on the status
 * sees neither `done` nor `unavailable` at any point from the press through
 * the restore. On the way back the engine reloads (it
 * had been loaded), into a NEW worker, and still nothing lands.
 *
 * Proved to bite (2026-09-30): skipping `unloadSlaacEngine()` in the
 * stargaze handler failed with "window.__offload.slaac never reached 1 after
 * entering stargaze mid-run".
 */
async function checkSlaacStargazeCancel(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.clock.setFixedTime(SLAAC_DATE);
    await page.addInitScript(slaacWorkerSpy);
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    await openReroute(page);
    await selectReroutePair(page, "KJFK-KMIA");
    await page.locator("[data-reroute-launch]").check();
    // Every state from the press to the end, so a transient done or
    // unavailable between the cancel and the restore can't hide behind a
    // clean final read.
    await page.evaluate(() => {
      window.__rerouteStates = [];
      const el = document.querySelector("[data-reroute-status]");
      new MutationObserver(() => window.__rerouteStates.push(JSON.parse(el.dataset.rerouteStatus).state)).observe(el, {
        attributes: true,
        attributeFilter: ["data-reroute-status"],
      });
    });
    await page.locator("[data-reroute-go]").click();
    await page.waitForFunction(
      () => {
        const st = JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus);
        return st.state === "running" && (st.step ?? 0) >= 1;
      },
      null,
      { timeout: 120000 },
    );
    const step = (await rerouteStatus(page)).step;

    await stargazeToggle(page).click();
    await page
      .waitForFunction(() => (window.__offload?.slaac ?? 0) >= 1, null, { timeout: 15000 })
      .catch(() => {
        throw new Error("window.__offload.slaac never reached 1 after entering stargaze mid-run");
      });
    let workers = await slaacWorkers(page);
    if (workers.length !== 1 || !workers[0].terminated) {
      throw new Error(`the rerouter's worker was not terminated: ${JSON.stringify(workers.map((w) => w.terminated))}`);
    }
    if (await page.evaluate(() => window.__slaac.loaded)) throw new Error("window.__slaac.loaded still true while stargazing");
    await page.waitForTimeout(1500); // a reply that was going to land has had time to
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });

    // Restore rule: it was loaded, so it reloads, into a new worker.
    await page.waitForFunction(() => window.__slaac?.loaded === true, null, { timeout: 120000 });
    await page.waitForTimeout(1000);
    workers = await slaacWorkers(page);
    const st = await rerouteStatus(page);
    const readout = await page.locator("[data-reroute-figure] [role=status]").textContent();
    const offload = await page.evaluate(() => window.__offload.slaac);
    const lastDone = await page.evaluate(() => window.__slaac.lastDone);
    const states = [...new Set(await page.evaluate(() => window.__rerouteStates))];
    const transient = states.filter((x) => x === "done" || x === "unavailable" || x === "failed");
    if (transient.length) throw new Error(`the status passed through ${transient.join(", ")} across the cancel and restore: ${states.join(" > ")}`);
    if (st.state !== "idle") throw new Error(`after stargaze the figure reads ${st.state}, not idle`);
    if (lastDone) throw new Error("a done landed for the run stargaze cancelled");
    if (workers.some((w) => w.got.some((m) => m.kind === "done"))) throw new Error("a worker posted done for the cancelled run");
    if (readout === SLAAC_COPY.unavailable || readout === SLAAC_COPY.runFailed) throw new Error("the cancelled run was reported as a failure");
    if (readout) throw new Error(`the readout still says ${JSON.stringify(readout)} after the cancel`);
    if ((await demoEvents(page, "slaac")) !== 0) throw new Error("a cancelled reroute queued demo_used{slaac}");
    if (offload !== 1) throw new Error(`window.__offload.slaac is ${offload}, expected exactly 1`);
    if (workers.length !== 2 || workers[1].terminated) {
      throw new Error(`expected the old worker terminated and one live new one: ${JSON.stringify(workers.map((w) => w.terminated))}`);
    }
    if (errors.length) throw new Error(`console errors: ${errors.join(" | ")}`);
    return `stargaze at step ${step}: worker terminated, __offload.slaac 1, idle, no done, no error line, no demo_used{slaac}; reloaded into a new worker on return; states seen ${states.join(" > ")}`;
  });
}

/**
 * Phone width with touch: no horizontal scroll with the figure mounted; "draw
 * airspace", three taps and a tap on the first corner close a shape (draw mode
 * ends, "clear" enables); two taps and a tap on the first corner say a shape
 * needs three corners.
 *
 * Proved to bite (2026-09-30): making the canvas's pointerup ignore touch
 * (`if (e.pointerType === "touch") return;`) failed with "three taps and a
 * tap on the first corner didn't close the shape: {"draw":"true",
 * "clear":false,"pending":false}".
 */
async function checkSlaac400(browser) {
  return withPage(browser, { viewport: { width: 400, height: 800 }, hasTouch: true }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await openReroute(page);
    await selectReroutePair(page, "KJFK-KMIA");
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if ((await overflow()) > 1) throw new Error(`horizontal scroll at 400px with Figure 3 mounted: ${await overflow()}px`);

    const { view } = await rerouteView(page);
    const at = (fx, fy) => fromScreen(view, fx * view.w, fy * view.h);
    const tri = [at(0.3, 0.3), at(0.7, 0.35), at(0.5, 0.7)];
    await page.locator("[data-reroute-draw]").tap();
    for (const p of tri) await rerouteAt(page, ...p, { touch: true });
    await rerouteAt(page, ...tri[0], { touch: true });
    const closed = await page.evaluate(() => ({
      draw: document.querySelector("[data-reroute-draw]").getAttribute("aria-pressed"),
      clear: !document.querySelector("[data-reroute-clear]").disabled,
      pending: !!document.querySelector("[data-reroute-close]"),
    }));
    if (closed.draw !== "false" || !closed.clear || closed.pending) {
      throw new Error(`three taps and a tap on the first corner didn't close the shape: ${JSON.stringify(closed)}`);
    }

    await page.waitForTimeout(500); // the view eases to fit the new shape (350 ms); re-read it after
    const v2 = (await rerouteView(page)).view;
    const two = [fromScreen(v2, 0.25 * v2.w, 0.75 * v2.h), fromScreen(v2, 0.45 * v2.w, 0.8 * v2.h)];
    await page.locator("[data-reroute-draw]").tap();
    for (const p of two) await rerouteAt(page, ...p, { touch: true });
    await rerouteAt(page, ...two[0], { touch: true });
    const alert = page.locator("[data-reroute-figure] [role=alert]");
    await alert.waitFor({ state: "visible", timeout: 2000 }).catch(() => {
      throw new Error("two taps and a close showed no message");
    });
    const msg = await alert.textContent();
    if (msg !== SLAAC_COPY.ringTooFew) throw new Error(`two-corner close says ${JSON.stringify(msg)}`);
    if ((await overflow()) > 1) throw new Error(`horizontal scroll at 400px after drawing: ${await overflow()}px`);
    return `no horizontal scroll at 400; a 3-tap triangle closed on a tap at its first corner; a 2-tap close said "${msg}"`;
  });
}

/**
 * All flights, the default since Task 12c. At rest: the picker reads "all
 * flights (373)" (the library's own route count), the status mode is "all",
 * the reroute button is amber, and the readout counts the arcs a press will
 * sample, equal to this script's own count of the same planner over every
 * library route (launch sites on, margin 25, infinite lookahead). A press
 * turns the button into "stop", reports progress as unique arcs done of that
 * same total, and finishes with every library flight in the status, the
 * worker's own unique-arc count equal to the planned one, and a summary whose
 * every value equals summarizeFlights over the status's flights. The button
 * is green exactly when no flight is cannot-clear. Picking a rerouted flight
 * on the map fills the detail row with its pair and draws its filed route in
 * the airspace red (Task 12f: sampled on filed legs clear of its plan, its
 * dense arc, the airspace outlines and the labels, `window.__slaacLabels`);
 * empty map clears the pick and the red. Then a
 * margin change makes it stale (amber), and a press stopped mid-run goes
 * back to that stale result: no done, no failed or unavailable state at any
 * point, no error line, the worker posts no done for the stopped run, and
 * demo_used{slaac} stays at one.
 *
 * Up to 1200 s for the full run: Playwright's Firefox is ~7x slower than
 * stock for this model (scripts/slaac/measure/README.md); the run measured
 * 249 s of worker time on an idle machine, and did not finish inside 600 s
 * with an unrelated job holding all 20 cores (load ~25, 2026-10-01).
 *
 * Proved to bite (2026-10-01), each against a production build:
 *  - the summary rendering `summary.affected` in the "flights checked" cell
 *    failed with "summary checked reads "80", expected "373"";
 *  - `stop()` no longer putting the previous result back failed with "after
 *    stop the figure reads idle, not the previous (stale) result".
 */
async function checkSlaacAllFlights(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.clock.setFixedTime(SLAAC_DATE);
    await page.addInitScript(slaacWorkerSpy);
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await openReroute(page);

    const C = SLAAC_COPY;
    const total = SLAAC_ROUTES.pairs.reduce((n, p) => n + p.routes.length, 0);
    const flights = SLAAC_ROUTES.pairs.flatMap((p) => p.routes.map((r, k) => ({ id: `${p.origin}-${p.dest}-${k + 1}`, nominal: r.fixes })));
    const polys = loadSua(SLAAC_LAUNCH.sites.flatMap((s) => s.polys.map((p) => p.ring)));
    const meta = JSON.parse(readFileSync(new URL("../public/slaac/meta.json", import.meta.url), "utf8"));
    const opts = rerouteOpts(meta, 25, false, null);
    const want = uniqueArcCount(planArcs(flights.filter((f) => mayConflict(f.nominal, polys, opts)), polys, opts));
    const goState = () => page.locator("[data-reroute-go]").getAttribute("data-reroute-go-state");
    const goText = () => page.locator("[data-reroute-go]").textContent();

    let st = await rerouteStatus(page);
    const option = await page.locator("[data-reroute-pair] option:checked").textContent();
    if (st.mode !== "all") throw new Error(`Figure 3 opened in mode ${st.mode}, not all`);
    if (option !== `${C.controls.allFlightsPre}${total}${C.controls.allFlightsPost}`) throw new Error(`picker reads ${JSON.stringify(option)}`);
    if (!st.launchOn) throw new Error("the launch sites aren't on by default");
    if ((await goState()) !== "idle-stale") throw new Error(`button is ${await goState()} before any press, not amber`);
    await page.waitForFunction(() => JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus).arcsPlanned !== null, null, { timeout: 15000 });
    st = await rerouteStatus(page);
    if (st.arcsPlanned !== want) throw new Error(`the page plans ${st.arcsPlanned} arcs, this script's planner ${want}`);
    const plannedText = await page.locator("[data-reroute-planned]").textContent();
    if (plannedText !== `${C.toSamplePre}${want}${want === 1 ? C.toSampleMidOne : C.toSampleMid}`) throw new Error(`planned line ${JSON.stringify(plannedText)}`);

    await page.evaluate(() => {
      window.__rerouteStates = [];
      const el = document.querySelector("[data-reroute-status]");
      new MutationObserver(() => window.__rerouteStates.push(JSON.parse(el.dataset.rerouteStatus).state)).observe(el, {
        attributes: true,
        attributeFilter: ["data-reroute-status"],
      });
    });
    await page.locator("[data-reroute-go]").click();
    await page.waitForFunction(() => {
      const s = JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus);
      return s.state === "running" && s.arcsTotal !== null;
    }, null, { timeout: 120000 });
    st = await rerouteStatus(page);
    if ((await goState()) !== "running" || (await goText()) !== C.controls.stop) {
      throw new Error(`mid-run the button is ${await goState()} "${await goText()}", not "${C.controls.stop}"`);
    }
    if (st.arcsTotal !== want) throw new Error(`progress counts ${st.arcsTotal} arcs, planned ${want}`);
    const readout = await page.locator("[data-reroute-figure] [role=status]").textContent();
    if (readout !== `${C.running} ${st.arcsDone}/${want}${C.runningArcs}`) throw new Error(`running readout ${JSON.stringify(readout)}`);

    await waitRerouteState(page, ["done", "failed", "unavailable"], 1200000);
    st = await rerouteStatus(page);
    if (st.state !== "done") throw new Error(`all flights ended ${st.state}`);
    if (st.flights.length !== total) throw new Error(`${st.flights.length} flights in the status, ${total} in the library`);
    if (st.arcs !== want) throw new Error(`the worker sampled ${st.arcs} unique arcs, the planner said ${want}`);
    const sum = summarizeFlights(st.flights, 25);
    const fl = (x) => `${(Math.floor(x * 10) / 10).toFixed(1)} nm`;
    const read = Object.fromEntries(await page.locator("[data-summary]").evaluateAll((els) => els.map((e) => [e.dataset.summary, e.textContent])));
    const expect = {
      checked: String(sum.checked),
      affected: String(sum.affected),
      rerouted: String(sum.rerouted),
      cannotClear: String(sum.cannotClear),
      lowestClearance: sum.minClearanceNm === null ? "-" : fl(sum.minClearanceNm),
    };
    for (const [k, v] of Object.entries(expect)) if (read[k] !== v) throw new Error(`summary ${k} reads ${JSON.stringify(read[k])}, expected ${JSON.stringify(v)}`);
    // Built exactly as the figure formats them (the same fmtSigned), sign and all.
    const added = (n, pct) => (n === null || pct === null ? "-" : `${fmtSigned(n, 0)} nm (${fmtSigned(pct, 1)}%)`);
    const wantMedian = added(sum.medianAddedNm, sum.medianAddedPct);
    const wantMost = added(sum.maxAddedNm, sum.maxAddedPct);
    if (read.medianAdded !== wantMedian) throw new Error(`median added reads ${JSON.stringify(read.medianAdded)}, expected ${JSON.stringify(wantMedian)}`);
    if (read.worstAdded !== wantMost) throw new Error(`most added reads ${JSON.stringify(read.worstAdded)}, expected ${JSON.stringify(wantMost)}`);
    if (sum.checked !== total || sum.affected < 1) throw new Error(`summary counts ${JSON.stringify(sum)}`);
    const green = (await goState()) === "ok";
    if (green !== (sum.cannotClear === 0)) throw new Error(`button ${await goState()} with ${sum.cannotClear} cannot-clear flight(s)`);
    if ((await demoEvents(page, "slaac")) !== 1) throw new Error(`demo_used{slaac} ${await demoEvents(page, "slaac")}x after one run`);

    // Pick a rerouted flight, and check the pick's look (Task 12f): the
    // picked flight's FILED route draws in the airspace red. Sample points on
    // its filed legs that sit clear of its own plan (green on top there) and
    // of every launch polygon's outline (red anyway); each must read opaque
    // red in a 3x3 neighbourhood while picked, and none once an empty click
    // clears the pick. A flight's plan keeps its filed fixes outside the
    // detour, so the target is the rerouted flight with the most such points,
    // clicked ON one of them.
    const done = await page.evaluate(() => window.__slaac.lastDone);
    await page.evaluate(() => document.querySelector("[data-reroute-figure] canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const { box, view: pv } = await rerouteView(page);
    const scr = (lat, lon) => toScreen(pv, lat, lon);
    const segDist = (p, a, b) => {
      const abx = b[0] - a[0], aby = b[1] - a[1];
      const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby + 1e-12)));
      return Math.hypot(p[0] - a[0] - t * abx, p[1] - a[1] - t * aby);
    };
    const outlines = SLAAC_LAUNCH.sites.flatMap((s) => s.polys.map((p) => [...p.ring, p.ring[0]].map(([la, lo]) => scr(la, lo))));
    const filedOf = (id) => {
      const m = /^(.+)-(.+)-(\d+)$/.exec(id);
      const p = SLAAC_ROUTES.pairs.find((q) => q.origin === m[1] && q.dest === m[2]);
      return p.routes[Number(m[3]) - 1].fixes;
    };
    const labelBoxes = await page.evaluate(() => window.__slaacLabels ?? []);
    const offLabels = (p) => labelBoxes.every((b) => p[0] < b.x - 4 || p[0] > b.x + b.w + 4 || p[1] < b.y - 4 || p[1] > b.y + b.h + 4);
    const samplesFor = (id) => {
      const f = done.flights.find((x) => x.id === id);
      const plan = f.plan.map((q) => scr(q[1], q[2]));
      const dense = f.dense.map(([la, lo]) => scr(la, lo)); // the faint dotted arc draws green on top too
      const clear = (p) => offLabels(p) && [plan, dense, ...outlines].every((L) => L.slice(1).every((b, i) => segDist(p, L[i], b) > 7));
      const fixes = filedOf(id);
      const out = [];
      for (let i = 0; i + 1 < fixes.length && out.length < 5; i++) {
        for (let k = 1; k <= 9 && out.length < 5; k += 2) {
          // On the leg as drawn: a straight line between the projected fixes
          // (interpolating lat/lon instead lands px off a long leg).
          const a = scr(fixes[i][1], fixes[i][2]), b = scr(fixes[i + 1][1], fixes[i + 1][2]);
          const p = [a[0] + ((b[0] - a[0]) * k) / 10, a[1] + ((b[1] - a[1]) * k) / 10];
          if (p[0] < 6 || p[1] < 6 || p[0] > pv.w - 6 || p[1] > pv.h - 6 || !clear(p)) continue;
          if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 15)) continue;
          out.push(p);
        }
      }
      return out;
    };
    const target = done.flights
      .filter((f) => f.status === "ok" && f.roles.includes("deviation"))
      .map((f) => ({ id: f.id, pts: samplesFor(f.id) }))
      .sort((x, y) => y.pts.length - x.pts.length)[0];
    if (!target || target.pts.length < 3) throw new Error(`no rerouted flight has 3 filed-route points clear of its plan and the airspace (best ${target?.id}: ${target?.pts.length})`);
    await page.mouse.click(box.x + target.pts[0][0], box.y + target.pts[0][1]);
    await page.waitForTimeout(200);
    st = await rerouteStatus(page);
    if (!st.picked) throw new Error("a click on a flight's filed route picked nothing");
    const pickedPair = st.picked.split("-").slice(0, 2).join(" → ");
    const detailPair = await page.locator('[data-reroute-detail] [data-detail="pair"]').textContent();
    if (detailPair !== pickedPair) throw new Error(`detail row reads ${detailPair}, picked ${st.picked}`);
    // Whatever the click picked (a sibling route can share the clicked leg),
    // sample that flight's own filed route.
    const samples = st.picked === target.id ? target.pts : samplesFor(st.picked);
    if (samples.length < 3) throw new Error(`picked ${st.picked}: only ${samples.length} filed-route points clear of its plan and the airspace to sample`);
    const redAt = (pts) =>
      page.evaluate((pts) => {
        const c = document.querySelector("[data-reroute-figure] canvas");
        const k = c.width / c.getBoundingClientRect().width;
        const ctx = c.getContext("2d");
        return pts.map(([x, y]) => {
          const d = ctx.getImageData(Math.round(x * k) - 1, Math.round(y * k) - 1, 3, 3).data;
          // Opaque-ish red: a 1.75 px line's best pixel on a diagonal measured
          // alpha 181; the airspace fill is 46, the grey texture never red.
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 150 && d[i] >= 180 && d[i + 1] <= 90 && d[i + 2] <= 90) return true;
          return false;
        });
      }, pts);
    const redPicked = await redAt(samples);
    if (redPicked.filter(Boolean).length < samples.length) {
      throw new Error(`picked ${st.picked}: its filed route isn't red (${redPicked.filter(Boolean).length} of ${samples.length} points red)`);
    }
    await page.mouse.click(box.x + 3, box.y + 3); // an empty corner
    await page.waitForTimeout(200);
    if ((await rerouteStatus(page)).picked !== null) throw new Error("a click on empty map didn't clear the pick");
    await page.waitForTimeout(100); // the repaint is one coalesced rAF
    const redCleared = await redAt(samples);
    if (redCleared.some(Boolean)) throw new Error(`the pick was cleared but ${redCleared.filter(Boolean).length} of its filed-route points still read red`);

    // Stale, then a stopped press goes back to the stale result.
    await page.locator("[data-reroute-margin]").fill("30");
    await waitRerouteState(page, ["stale"], 5000);
    if ((await goState()) !== "idle-stale") throw new Error(`stale result, button ${await goState()}`);
    await page.evaluate(() => window.__rerouteStates.splice(0));
    await page.locator("[data-reroute-go]").click();
    await page.waitForFunction(() => {
      const s = JSON.parse(document.querySelector("[data-reroute-status]").dataset.rerouteStatus);
      return s.state === "running" && (s.step ?? 0) >= 1;
    }, null, { timeout: 120000 });
    const sentRuns = (await slaacWorkers(page))[0].sent.filter((m) => m.kind === "reroute").map((m) => m.runId);
    const stoppedRun = sentRuns.at(-1);
    await page.locator("[data-reroute-go]").click(); // "stop"
    // The worker really stops: the engine sent it a cancel for that run, and
    // its progress for that run stops growing (one message already in flight
    // allowed). A run this size needs ~200 s here, so "no done yet" alone
    // would prove nothing.
    const progressOf = async () => (await slaacWorkers(page))[0].got.filter((m) => m.kind === "progress" && m.runId === stoppedRun).length;
    const p0 = await progressOf();
    await page.waitForTimeout(3000); // a done, an error or more progress that was coming has had time to land
    const p1 = await progressOf();
    const w0 = (await slaacWorkers(page))[0];
    if (!w0.sent.some((m) => m.kind === "cancel" && m.runId === stoppedRun)) {
      throw new Error(`stop sent the worker no cancel for run ${stoppedRun}: ${JSON.stringify(w0.sent.slice(-4))}`);
    }
    if (p1 - p0 > 1) throw new Error(`the stopped run ${stoppedRun} kept posting progress: ${p0} then ${p1} messages 3 s later`);
    st = await rerouteStatus(page);
    const states = [...new Set(await page.evaluate(() => window.__rerouteStates))];
    const bad = states.filter((x) => x === "done" || x === "failed" || x === "unavailable");
    if (bad.length) throw new Error(`the stopped press passed through ${bad.join(", ")}: ${states.join(" > ")}`);
    if (st.state !== "stale") throw new Error(`after stop the figure reads ${st.state}, not the previous (stale) result`);
    if ((await goText()) !== C.controls.go || (await goState()) !== "idle-stale") throw new Error(`after stop the button is ${await goState()} "${await goText()}"`);
    if ((await page.evaluate(() => window.__slaac.lastDone?.runId)) !== done.runId) throw new Error("a done landed for the stopped press");
    const [w] = await slaacWorkers(page);
    if (w.got.some((m) => m.kind === "done" && m.runId > done.runId)) throw new Error("the worker posted done for the stopped run");
    const line = await page.locator("[data-reroute-figure] [role=status]").textContent();
    if (line === C.runFailed || line === C.unavailable) throw new Error(`the stop read as a failure: ${line}`);
    if ((await demoEvents(page, "slaac")) !== 1) throw new Error(`demo_used{slaac} ${await demoEvents(page, "slaac")}x after a stop`);
    if (errors.length) throw new Error(`console errors: ${errors.join(" | ")}`);
    const stopNote = `stop sent cancel for run ${stoppedRun}, its progress ${p0} then ${p1} after 3 s`;
    const pickNote = `pick: ${redPicked.filter(Boolean).length}/${samples.length} filed-route points red, 0 after clearing`;
    return `${pickNote}; ${stopNote}; all flights (${total}) by default, amber, ${want} arcs planned (= this script's planner); one press: ${want} unique arcs in ${(done.ms / 1000).toFixed(1)} s, ${sum.affected} near airspace, ${sum.rerouted} rerouted, ${sum.cannotClear} can't clear, summary = summarizeFlights, button ${green ? "green" : "amber"}; picked ${pickedPair} on the map; margin 30 went stale and a stopped press returned to it (states ${states.join(" > ")}), no done, demo_used once`;
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

    // Speed Insights (Pro, 2026-09-16): same-origin like the tracker.
    const siSrc = await page.evaluate(
      () => document.querySelector('script[src*="_vercel/speed-insights"]')?.getAttribute("src") ?? null,
    );
    if (!siSrc) throw new Error("no Speed Insights script injected");
    if (!siSrc.startsWith("/")) throw new Error(`Speed Insights script is not same-origin: ${siSrc}`);

    // page_reload: never on a fresh navigation, exactly once after a reload.
    const reloads = () =>
      page.evaluate(
        () => (window.vaq ?? []).filter(([kind, ev]) => kind === "event" && ev?.name === "page_reload").length,
      );
    const fresh = await reloads();
    if (fresh !== 0) throw new Error(`page_reload queued ${fresh}x on a fresh navigation`);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Array.isArray(window.vaq), null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const after = await reloads();
    if (after !== 1) throw new Error(`page_reload queued ${after}x after one reload, expected 1`);

    return `tracker injected at ${src}, Speed Insights at ${siSrc}; Resume click queued outbound_link{label: "Resume"}; page_reload 0 fresh / 1 after reload`;
  });
}

/* ---------------------------------------------------------------------- */
/* Stargaze mode (lib/stargaze.ts, components/manuscript/StargazeToggle)  */
/* ---------------------------------------------------------------------- */

const STARGAZE_ENTER = "stargaze for a bit?";
const STARGAZE_EXIT = "back to the page";

/** The toggle above the sheet, by its accessible name. Scoped to the toggle
 *  because the footer entry (Task 6) is a second button with the same name. */
function stargazeToggle(page) {
  return page.locator("[data-stargaze-toggle]").getByRole("button", { name: STARGAZE_ENTER });
}

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
    const enter = stargazeToggle(page);

    await enter.click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForTimeout(800); // the 600ms fade has to have finished: elapsed time is the assertion
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
    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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
    const enter = stargazeToggle(page);
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
    const enter = stargazeToggle(page);
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
    await stargazeToggle(page).click();
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
/** Task 18: an instant with the galactic core and the band's warm end on a
 *  1600x1000 canvas (Sagittarius setting, Scutum and Aquila up), where the
 *  band's gradient is measured; SKY_COLOUR_INSTANT shows the tan far from it. */
const SKY_CORE_INSTANT = new Date("2026-07-14T23:00:00.000Z");
/** The gradient's own claim, measured at SKY_CORE_INSTANT: the colour
 *  stargaze adds to band pixels within CORE_NEAR_PX of Sgr A* is golder
 *  (more warmth per unit of red) than beyond CORE_FAR_PX, by at least CORE_MIN_EXTRA_GOLD
 *  (calibration below and in the task-18 report's fix round 1). */
const CORE_NEAR_PX = 300;
const CORE_FAR_PX = 700;
// A raw warmth gain is no test (measured: 19.59 near vs 4.68 far, but an
// all-tan mutant ALSO passed a gap test, the core's levels being brighter),
// so the check compares the hue of the added colour instead. Measured (fix
// round 1, 2026-10-01): 0.963 near vs 0.716 far, a gap of 0.247; the all-tan
// mutant (no gold stop) measured 0.715 vs 0.716, a gap of -0.001, and FAILS.
// Half the real gap:
const CORE_MIN_EXTRA_GOLD = 0.12;
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
/**
 * The band's pixels in `window.__colourFrames` (grey, paper, stargaze), clear
 * of every drawn hit, in two sets (task 18, ruling R24): WARM, whose warmth
 * (r-b) rises by 3 or more from saturation 0 to stargaze (the core side of
 * the core-to-disc gradient, and the whole band before it), and COOL, whose
 * coolness (b-r) rises by 3 or more (the faintly blue disc). Per set: the
 * count, and the median and mean of its own direction's measure in each
 * state, plus luminance. Installed in the page as `window.__bandStats`.
 */
function installBandStats(page) {
  return page.evaluate(() => {
    window.__bandStats = (hits, bandClear, centre = null, near = 0, far = 0) => {
      const grad = { nearN: 0, farN: 0, nearSum: 0, farSum: 0, nearDr: 0, farDr: 0 };
      const f = window.__colourFrames;
      const c = document.querySelector("body > canvas");
      const s = c.width / window.innerWidth;
      const Wd = c.width;
      const warm = (d, i) => d[i] - d[i + 2];
      const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const pts = hits.map((h) => [h.x * s, h.y * s]);
      const clear = bandClear * s;
      const fresh = () => ({ grey: [], paper: [], stargaze: [], lumGrey: [], lumPaper: [], lumStargaze: [] });
      const sets = { band: fresh(), cool: fresh() };
      for (let yy = 0; yy < c.height; yy += 2) {
        for (let xx = 0; xx < c.width; xx += 2) {
          const i = (yy * Wd + xx) * 4;
          const dw = warm(f.stargaze, i) - warm(f.grey, i);
          if (dw > -3 && dw < 3) continue;
          if (pts.some(([px, py]) => Math.abs(px - xx) < clear && Math.abs(py - yy) < clear)) continue;
          const set = dw >= 3 ? sets.band : sets.cool;
          if (centre && dw >= 3) {
            const dist = Math.hypot(xx / s - centre.x, yy / s - centre.y);
            const dr = f.stargaze[i] - f.grey[i];
            if (dist < near) {
              grad.nearN++;
              grad.nearSum += dw;
              grad.nearDr += dr;
            } else if (dist > far) {
              grad.farN++;
              grad.farSum += dw;
              grad.farDr += dr;
            }
          }
          const sign = dw >= 3 ? 1 : -1;
          set.grey.push(sign * warm(f.grey, i));
          set.paper.push(sign * warm(f.paper, i));
          set.stargaze.push(sign * warm(f.stargaze, i));
          set.lumGrey.push(lum(f.grey, i));
          set.lumPaper.push(lum(f.paper, i));
          set.lumStargaze.push(lum(f.stargaze, i));
        }
      }
      const median = (a) => {
        const b = [...a].sort((x, y) => x - y);
        return b.length ? b[b.length >> 1] : null;
      };
      const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
      const out = {};
      for (const [name, set] of Object.entries(sets)) {
        const st = { n: set.grey.length };
        for (const [k, v] of Object.entries(set)) {
          st[k] = median(v);
          st[`${k}Mean`] = mean(v);
        }
        out[name] = st;
      }
      // The hue of what stargaze ADDS: warmth gained per unit of red gained,
      // summed over the pixels. Brightness cancels out of the ratio (the
      // core's levels are denser and brighter, so a raw warmth gain is
      // bigger there even for an all-tan band, which a mutant proved);
      // what's left is how gold the added colour is.
      out.gradient = {
        nearN: grad.nearN,
        farN: grad.farN,
        nearGain: grad.nearN ? grad.nearSum / grad.nearN : 0,
        farGain: grad.farN ? grad.farSum / grad.farN : 0,
        nearHue: grad.nearDr ? grad.nearSum / grad.nearDr : 0,
        farHue: grad.farDr ? grad.farSum / grad.farDr : 0,
      };
      return out;
    };
  });
}

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
/** The paper -> stargaze gain thresholds, for one direction of the band. */
function assertBandGain(where, measure, b) {
  if (!(b.paperMean - b.greyMean >= BAND_MIN_WARMTH_GAIN)) {
    throw new Error(`the band's ${where}: mean ${measure} over ${b.n} pixels is ${b.greyMean.toFixed(2)} at saturation 0 and ${b.paperMean.toFixed(2)} in paper mode (stargaze ${b.stargazeMean.toFixed(2)}); paper must add at least ${BAND_MIN_WARMTH_GAIN}`);
  }
  if (!(b.stargazeMean - b.paperMean >= BAND_MIN_STARGAZE_OVER_PAPER)) {
    throw new Error(`the band's ${where}: mean ${measure} over ${b.n} pixels is ${b.paperMean.toFixed(2)} in paper mode and ${b.stargazeMean.toFixed(2)} in stargaze; stargaze must add at least ${BAND_MIN_STARGAZE_OVER_PAPER}`);
  }
}

/**
 * The band with the galactic core on screen (task 18): grey (through the
 * override hook), paper and stargaze frames at SKY_CORE_INSTANT, same steps
 * as the main frame, read back as warming and cooling sets.
 */
async function bandAtCore(browser) {
  return pinnedSkyPage(browser, { W: 1600, H: 1000, date: SKY_CORE_INSTANT }, async (page) => {
    await waitStargazeReady(page);
    const core = await page.evaluate(() => window.__sky.hits.find((h) => h.id === "sgr-a-star") ?? null);
    if (!core) throw new Error(`the galactic core is not on screen at ${SKY_CORE_INSTANT.toISOString()}; pick another SKY_CORE_INSTANT`);
    const sheet = await page.evaluate(() => {
      const r = document.querySelector("[data-sheet]").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.max(r.top, 0) + 240 };
    });
    const sat = (v) => page.waitForFunction((v) => window.__sky.saturation === v, v, { timeout: 5000 });
    // A bare-sky point in the left margin, highlighting nothing.
    let skyPt = null;
    for (const y of [220, 420, 620, 820]) {
      await page.mouse.move(sheet.x, sheet.y);
      await page.mouse.move(60, y);
      const st = await page.evaluate(([x, y, sel]) => ({ h: window.__sky.highlight, blocked: !!document.elementFromPoint(x, y)?.closest(sel) }), [60, y, NOT_SKY_SELECTOR]);
      if (st.h === null && !st.blocked) {
        skyPt = { x: 60, y };
        break;
      }
    }
    if (!skyPt) throw new Error("no bare-sky point in the left margin at SKY_CORE_INSTANT");
    await page.mouse.move(sheet.x, sheet.y);
    await sat(PAPER_SATURATION);
    await snapSky(page, "paper");
    await page.evaluate(() => (window.__skySaturationOverride = 0));
    await page.mouse.move(skyPt.x, skyPt.y);
    await sat(0);
    await snapSky(page, "grey");
    await page.evaluate(() => delete window.__skySaturationOverride);
    await page.mouse.move(sheet.x, sheet.y);
    await sat(PAPER_SATURATION);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.move(skyPt.x, skyPt.y);
    await sat(1);
    if ((await page.evaluate(() => window.__sky.highlight)) !== null) throw new Error("the stargaze pointer highlights something at SKY_CORE_INSTANT");
    await snapSky(page, "stargaze");
    await installBandStats(page);
    return page.evaluate(([clear, near, far]) => {
      const c = window.__sky.hits.find((h) => h.id === "sgr-a-star");
      return window.__bandStats(window.__sky.hits, clear, { x: c.x, y: c.y }, near, far);
    }, [BAND_CLEAR_PX, CORE_NEAR_PX, CORE_FAR_PX]);
  });
}

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
    await stargazeToggle(page).click();
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
    await installBandStats(page);

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
        return { objects, ...window.__bandStats(window.__sky.hits, bandClear) };
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
  // The band (fix round 1; task 18 added the gold-core gradient, rulings
  // R24/R26). Its own curve must give paper mode a real warmth gain over
  // saturation 0, not only the brightness its alpha gain adds, and stargaze
  // must add warmth on top. This frame (SKY_COLOUR_INSTANT, the autumn sky
  // far from the core) is the band's tan, held to the original assertion and
  // numbers; SKY_CORE_INSTANT, below, has the core up and adds the gradient's
  // own claim: the band warms MORE near the core than far from it.
  // (Fix round 0 cooled the disc toward blue and moved this frame's half to
  // a coolness measure; R26 dropped the blue, and this half is back as it was.)
  const t = pixels.band;
  if (t.n < 5000) throw new Error(`only ${t.n} band pixels found (warmth moving between saturation 0 and 1, ${BAND_CLEAR_PX}px clear of objects)`);
  assertBandGain("tan", "warmth (r-b)", t);
  const core = await bandAtCore(browser);
  if (core.band.n < 5000) throw new Error(`only ${core.band.n} band pixels found warming between saturation 0 and 1 at ${SKY_CORE_INSTANT.toISOString()}, ${BAND_CLEAR_PX}px clear of objects`);
  assertBandGain("core", "warmth (r-b)", core.band);
  const g = core.gradient;
  if (!(g.nearN >= 2000 && g.farN >= 2000)) throw new Error(`too few band pixels to compare near the core (${g.nearN} within ${CORE_NEAR_PX}px) with far from it (${g.farN} beyond ${CORE_FAR_PX}px)`);
  if (!(g.nearHue - g.farHue >= CORE_MIN_EXTRA_GOLD)) {
    throw new Error(`the band does not turn gold toward the core: what stargaze adds carries ${g.nearHue.toFixed(3)} warmth per unit of red within ${CORE_NEAR_PX}px of Sgr A* (${g.nearN} px) and ${g.farHue.toFixed(3)} beyond ${CORE_FAR_PX}px (${g.farN} px); the core must be at least ${CORE_MIN_EXTRA_GOLD} more (warmth gains ${g.nearGain.toFixed(2)} / ${g.farGain.toFixed(2)})`);
  }
  const b = core.band;

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

  return `${ids.length} coloured objects across ${[...families].sort().join("/")}, paper's displayed colour share (constant ${PAPER_COLOUR_SHARE}, median ${medianShare.toFixed(2)}) and stargaze chroma shift at each object's most-moved pixel: ${notes.join(", ")}; hovered sky = stargaze, back on the sheet = paper exactly; M82 centre worst ${JSON.stringify(m82.worst)}; band mean warmth over ${t.n} px ${t.greyMean.toFixed(2)}/${t.paperMean.toFixed(2)}/${t.stargazeMean.toFixed(2)}, mean luminance ${t.lumGreyMean.toFixed(2)}/${t.lumPaperMean.toFixed(2)}/${t.lumStargazeMean.toFixed(2)}; with the core up (${SKY_CORE_INSTANT.toISOString()}) ${b.greyMean.toFixed(2)}/${b.paperMean.toFixed(2)}/${b.stargazeMean.toFixed(2)} over ${b.n} px, stargaze's added colour ${core.gradient.nearHue.toFixed(3)} warmth per red within ${CORE_NEAR_PX}px of the core vs ${core.gradient.farHue.toFixed(3)} beyond ${CORE_FAR_PX}px (warmth gain ${core.gradient.nearGain.toFixed(2)} vs ${core.gradient.farGain.toFixed(2)}); ease up ${ease.up.settleMs}ms over ${ease.up.between} painted steps, down ${ease.down.settleMs}ms over ${ease.down.between}`;
}

async function checkStargazeCard(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  const m31Fact = SKY_FACTS.find((f) => f.id === "m31");
  const m31Summary = await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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

/* ---------------------------------------------------------------------- */
/* Stargaze card photographs (spec 2026-09-16-sky-card-images): a licensed */
/* image flush above the card, CSS-sized before it loads, credited and     */
/* cited; none on a star; nothing at all with the index held; and (fix     */
/* round 1) the window.__sky.layers snapshot still reaches "ready" when    */
/* the index lands after every other layer under reduced motion.          */
/* ---------------------------------------------------------------------- */

// public/sky/sky.json's own star entries are bare [ra, dec, mag, ...]
// tuples with no name field (see checkStargazeCardImage's Polaris pick
// below by dec > 89, same as scripts/prepare-sky.mjs and test-sky-data.mjs).
// The named, id-bearing Polaris entry lives in public/sky/objects.json
// instead ({"id":"polaris","name":"Polaris",...,"raDeg":37.9545,"decDeg":89.2641}),
// so that is what this constant is read from.
const POLARIS = { raDeg: 37.9545, decDeg: 89.2641 };

// Fix round 2: same precedent as checkSkyIss's ISS_KNOWN_HARMLESS_CONSOLE —
// collect every console error on the index-held page, not only ones
// matching an images/index.json keyword (a generically worded error from
// the images-absent path would slip past a positive keyword filter), and
// fail on anything not explicitly listed here as harmless. Empty is the
// correct default, not a placeholder to fill in preemptively.
const CARD_IMAGE_KNOWN_HARMLESS_CONSOLE = [];

async function checkStargazeCardImage(browser) {
  const W = 1600;
  const H = 1000;
  const { date, p } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  const notes = [];

  await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    // Firefox observed to lag the images gate specifically (never objects,
    // milkyWay or facts, which pinnedSkyPage and this same wait already
    // clear) when this check runs immediately after the heaviest check in
    // the suite (stargaze-card, ~9s of drags and 11 card opens) — the same
    // "right after the heaviest checks" contention checkStargazeCard's own
    // drag waits already document. 20s (double the file's usual 10s) plus a
    // diagnostic that names the layer still pending, following the style of
    // checkStargazeCard's own catch blocks, rather than a bare
    // "Timeout 10000ms exceeded" that names nothing.
    await page.waitForFunction(() => window.__sky.layers.facts === "ready" && window.__sky.layers.images === "ready", null, { timeout: 20000 }).catch(async () => {
      const layers = await page.evaluate(() => ({ ...window.__sky.layers }));
      throw new Error("desktop: layers not ready within 20s: " + JSON.stringify(layers));
    });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });

    await page.mouse.click(p.x, p.y);
    const card = page.locator('[data-sky-card="m31"]');
    await card.waitFor({ state: "attached", timeout: 3000 });
    const fig = card.locator("[data-sky-card-image]");
    if ((await fig.count()) !== 1) throw new Error("Andromeda's card has no [data-sky-card-image]");
    const before = await fig.boundingBox();
    // The card is a fixed-width 320px border-box with a 1px border
    // (min-[880px]:w-[320px] min-[880px]:border on the aside), so the
    // figure's own content width is 318px, not 320 — 320x240 is the
    // design's shorthand for the 4:3 box, not what boundingBox() measures.
    // Task 3's own report measured this exact figure at 318x238.5 and
    // confirmed it matches min-[880px]:aspect-[4/3]; that is the value
    // pinned here, not a bug in SkyCard.tsx.
    if (!before || Math.abs(before.height - 238.5) > 1 || Math.abs(before.width - 318) > 1) {
      throw new Error(`image box is ${before?.width}x${before?.height}, expected 318x238.5 from CSS before load`);
    }
    // The box must be the aside's first child, its bottom on the body's top.
    const order = await card.evaluate((el) => {
      const first = el.firstElementChild;
      const body = first?.nextElementSibling;
      const a = first?.getBoundingClientRect();
      const b = body?.getBoundingClientRect();
      return { firstIsFigure: first?.hasAttribute("data-sky-card-image") ?? false, gap: a && b ? b.top - a.bottom : null, width: a && b ? a.width - b.width : null };
    });
    if (!order.firstIsFigure) throw new Error("the photograph is not the card's first child");
    if (order.gap === null || Math.abs(order.gap) > 1) throw new Error(`gap between photograph and body is ${order.gap}px`);
    if (order.width === null || Math.abs(order.width) > 1) throw new Error(`photograph and body widths differ by ${order.width}px`);

    await page.waitForFunction(() => {
      const img = document.querySelector('[data-sky-card="m31"] [data-sky-card-image] img');
      return img && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 10000 }).catch(async () => {
      const s = await page.evaluate(() => {
        const img = document.querySelector('[data-sky-card="m31"] [data-sky-card-image] img');
        return img ? { src: img.getAttribute("src"), complete: img.complete, naturalWidth: img.naturalWidth } : null;
      });
      throw new Error(`image never finished loading: ${JSON.stringify(s)}`);
    });
    const after = await fig.boundingBox();
    if (Math.abs(after.height - before.height) > 1) throw new Error(`image box changed height on load: ${before.height} -> ${after.height}`);
    const info = await card.evaluate((el) => ({
      src: el.querySelector("[data-sky-card-image] img")?.getAttribute("src"),
      alt: el.querySelector("[data-sky-card-image] img")?.getAttribute("alt") ?? "",
      credit: el.querySelector("[data-sky-card-image-credit]")?.textContent ?? "",
      sourceLinks: [...el.querySelectorAll("[data-sky-card-sources] a")].map((a) => a.getAttribute("href")),
      bottom: el.getBoundingClientRect().bottom,
    }));
    if (info.src !== "/sky/images/m31.webp") throw new Error(`src is ${info.src}`);
    if (info.alt.length < 20) throw new Error(`alt is ${JSON.stringify(info.alt)}`);
    if (!info.credit.startsWith(copy.stargaze.card.imageCredit)) throw new Error(`credit is ${JSON.stringify(info.credit)}`);
    if (!info.sourceLinks.some((h) => h && h.startsWith("https://commons.wikimedia.org/wiki/File:"))) {
      throw new Error(`no Commons citation among ${JSON.stringify(info.sourceLinks)}`);
    }
    if (info.bottom > H - 8) throw new Error(`card bottom at ${info.bottom} runs past the viewport (${H})`);
    notes.push(`m31: 318x238.5 box before and after load, credit ${JSON.stringify(info.credit)}`);

    // A star: no photograph, no credit, no Commons link. Located by its own
    // id, not the generic [data-sky-card] — a projection or hit-precedence
    // regression that opened a neighbouring star or constellation instead
    // (every one of them image-free too) would otherwise still pass.
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });
    const pol = findInstant(date, W, H, POLARIS, 40);
    await page.mouse.click(pol.p.x, pol.p.y);
    const starCard = page.locator('[data-sky-card="polaris"]');
    await starCard.waitFor({ state: "attached", timeout: 3000 }).catch(async () => {
      const opened = await page.evaluate(() => document.querySelector("[data-sky-card]")?.getAttribute("data-sky-card") ?? null);
      throw new Error(`clicking Polaris at (${pol.p.x.toFixed(0)}, ${pol.p.y.toFixed(0)}) opened ${opened ?? "no card"}, not polaris`);
    });
    const star = await starCard.evaluate((el) => ({
      id: el.getAttribute("data-sky-card"),
      figures: el.querySelectorAll("[data-sky-card-image]").length,
      credit: el.querySelectorAll("[data-sky-card-image-credit]").length,
      commons: [...el.querySelectorAll("[data-sky-card-sources] a")].filter((a) => (a.getAttribute("href") ?? "").includes("commons.wikimedia.org")).length,
    }));
    if (star.figures || star.credit || star.commons) throw new Error(`${star.id}'s card carries image markup: ${JSON.stringify(star)}`);
    notes.push(`${star.id}: no image markup`);
  });

  // The index held: no image, no error, the card otherwise complete.
  await withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    await context.route("**/sky/images/index.json", (route) => route.fulfill({ status: 404, body: "" }));
    const errors = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (CARD_IMAGE_KNOWN_HARMLESS_CONSOLE.some((re) => re.test(text))) return;
      errors.push(`console: ${text}`);
    });
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.images === "absent" && window.__sky.layers.facts === "ready", null, { timeout: 20000 }).catch(async () => {
      const layers = await page.evaluate(() => ({ ...window.__sky.layers }));
      throw new Error("index-held: layers not ready within 20s: " + JSON.stringify(layers));
    });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.mouse.click(p.x, p.y);
    const card = page.locator('[data-sky-card="m31"]');
    await card.waitFor({ state: "attached", timeout: 3000 });
    const held = await card.evaluate((el) => ({
      figures: el.querySelectorAll("[data-sky-card-image]").length,
      oneLiner: el.querySelector("[data-sky-card-oneliner]")?.textContent ?? "",
      sources: el.querySelectorAll("[data-sky-card-sources] a").length,
    }));
    if (held.figures) throw new Error("index held but the card shows a photograph");
    if (!held.oneLiner || held.sources < 1) throw new Error(`index held and the card is incomplete: ${JSON.stringify(held)}`);
    if (errors.length) throw new Error(`console errors with the index held: ${errors.join(" | ")}`);
    notes.push("index 404: card complete, no photograph, no console error");
  });

  // 400px, touch: the docked card, photograph at most 28% tall, card at most 60%.
  const P = { W: 400, H: 800 };
  const phone = findInstant(new Date(Date.UTC(2026, 9, 1)), P.W, P.H, M31, 40);
  await pinnedSkyPage(browser, { W: P.W, H: P.H, date: phone.date, contextOptions: { hasTouch: true } }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready" && window.__sky.layers.images === "ready", null, { timeout: 20000 }).catch(async () => {
      const layers = await page.evaluate(() => ({ ...window.__sky.layers }));
      throw new Error("phone: layers not ready within 20s: " + JSON.stringify(layers));
    });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.touchscreen.tap(phone.p.x, phone.p.y);
    const card = page.locator('[data-sky-card="m31"]');
    await card.waitFor({ state: "attached", timeout: 3000 });
    const sizes = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const f = el.querySelector("[data-sky-card-image]")?.getBoundingClientRect();
      const small = [...el.querySelectorAll("*")].filter((n) => n.textContent?.trim() && parseFloat(getComputedStyle(n).fontSize) < 12).length;
      return { card: r.height, img: f?.height ?? 0, imgW: f?.width ?? 0, cardW: r.width, small };
    });
    if (!sizes.img) throw new Error("no photograph on the docked card");
    if (sizes.img > 0.28 * P.H + 1) throw new Error(`phone photograph ${sizes.img}px tall, over 28% of ${P.H}`);
    if (sizes.card > 0.6 * P.H + 2) throw new Error(`phone card ${sizes.card}px tall, over 60% of ${P.H}`);
    if (Math.abs(sizes.imgW - sizes.cardW) > 1) throw new Error(`phone photograph width ${sizes.imgW} vs card ${sizes.cardW}`);
    if (sizes.small) throw new Error(`${sizes.small} element(s) under 12px on the phone card`);
    notes.push(`400px: photograph ${Math.round(sizes.img)}px of card ${Math.round(sizes.card)}px`);
  });

  // Fix round 1: window.__sky.layers is a snapshot taken only at paint
  // (painter.ts), and under reduced motion (every section above) the sky
  // repaints only when a layer landing calls paint(). Delaying the index's
  // own response past every other layer's landing makes that race
  // deterministic instead of relying on real network timing to occasionally
  // reproduce it — the images loader must call paint() on its own landing,
  // or this snapshot reports "loading" forever.
  await withPage(browser, { viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 }, async (page, context) => {
    await context.route("**/sky/images/index.json", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.clock.setFixedTime(date);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await page.waitForFunction(() => window.__sky.layers.images === "ready", null, { timeout: 10000 }).catch(async () => {
      const layers = await page.evaluate(() => ({ ...window.__sky.layers }));
      throw new Error(`delayed index: layers snapshot never reached images "ready" within 10s: ${JSON.stringify(layers)}`);
    });
    notes.push("index delayed 2.5s: snapshot reached ready");
  });

  return notes.join("; ");
}

/**
 * Task 19 (ruling R25): a constellation whose card tells a myth opens with an
 * ARTWORK of that myth, flush above the card exactly like the deep-sky
 * photographs, but credited "Image:" (not "Photograph:"), naming the work and
 * saying it is not a photograph of the sky, with a Commons citation tagged
 * "[Image]". Every other constellation still opens with none. Which is which
 * comes from the SERVED index.json (an entry keyed by a constellation id), so
 * a regenerated pick list changes the check with no edit here. Opened through
 * the keyboard list for determinism (constellation hit bands overlap), at
 * desktop and on the docked 400px phone card.
 */
async function checkStargazeMythImage(browser) {
  const notes = [];
  const t = copy.stargaze.card;
  const openFromList = async (page, id) => {
    const button = page.locator(`[data-sky-list-item="${id}"]`);
    if ((await button.count()) !== 1) throw new Error(`${id} has no keyboard-list button`);
    await button.evaluate((el) => el.click());
    const card = page.locator(`[data-sky-card="${id}"]`);
    await card.waitFor({ state: "attached", timeout: 3000 }).catch(async () => {
      const opened = await page.evaluate(() => window.__sky.card);
      throw new Error(`the list button for ${id} opened ${JSON.stringify(opened)}`);
    });
    return card;
  };
  const readCard = (card) =>
    card.evaluate((el) => {
      const first = el.firstElementChild;
      const body = first?.nextElementSibling;
      const img = el.querySelector("[data-sky-card-image] img");
      const a = first?.getBoundingClientRect();
      const b = body?.getBoundingClientRect();
      return {
        figures: el.querySelectorAll("[data-sky-card-image]").length,
        firstIsFigure: first?.hasAttribute("data-sky-card-image") ?? false,
        gap: a && b ? b.top - a.bottom : null,
        src: img?.getAttribute("src") ?? null,
        alt: img?.getAttribute("alt") ?? "",
        objectPosition: img ? getComputedStyle(img).objectPosition : null,
        credit: el.querySelector("[data-sky-card-image-credit]")?.textContent ?? null,
        artwork: el.querySelector("[data-sky-card-image-artwork]")?.textContent ?? null,
        commons: [...el.querySelectorAll("[data-sky-card-sources] li")]
          .filter((li) => [...li.querySelectorAll("a")].some((x) => (x.getAttribute("href") ?? "").startsWith("https://commons.wikimedia.org/wiki/File:")))
          .map((li) => li.textContent),
        box: a ? { w: a.width, h: a.height } : null,
        card: el.getBoundingClientRect().height,
      };
    });
  const assertMyth = (id, c, entry, where) => {
    if (c.figures !== 1 || !c.firstIsFigure) throw new Error(`${where}: ${id}'s card has no artwork flush on top: ${JSON.stringify(c)}`);
    if (c.gap === null || Math.abs(c.gap) > 1) throw new Error(`${where}: ${id}'s artwork sits ${c.gap}px off the card body`);
    if (c.src !== entry.src) throw new Error(`${where}: ${id}'s image is ${c.src}, the index says ${entry.src}`);
    if (c.alt !== entry.alt) throw new Error(`${where}: ${id}'s alt ${JSON.stringify(c.alt)} is not the index's`);
    if (!c.credit?.startsWith(t.imageCreditArtwork + entry.author)) throw new Error(`${where}: ${id}'s credit ${JSON.stringify(c.credit)} does not start "${t.imageCreditArtwork}${entry.author}"`);
    if (c.credit.startsWith(t.imageCredit)) throw new Error(`${where}: ${id}'s artwork is credited as a photograph: ${JSON.stringify(c.credit)}`);
    const wantArt = `. ${entry.artwork}. ${t.imageArtworkNote}`;
    if (c.artwork !== wantArt) throw new Error(`${where}: ${id}'s artwork line ${JSON.stringify(c.artwork)}, want ${JSON.stringify(wantArt)}`);
    if (!c.commons.some((x) => x.includes(entry.sourceTitle + t.imageSourceSuffixArtwork))) {
      throw new Error(`${where}: ${id} has no Commons citation tagged "${t.imageSourceSuffixArtwork.trim()}": ${JSON.stringify(c.commons)}`);
    }
    if (entry.focus) {
      // The pick's focus is already the computed-style form ("50% 30%").
      if (c.objectPosition !== entry.focus) throw new Error(`${where}: ${id}'s object-position is ${c.objectPosition}, its focus is ${entry.focus}`);
    }
  };
  const assertNone = (id, c, where) => {
    if (c.figures || c.credit !== null || c.artwork !== null || c.commons.length) {
      throw new Error(`${where}: ${id} tells no myth on its card, yet it carries image markup: ${JSON.stringify(c)}`);
    }
  };
  const servedSplit = (page) =>
    page.evaluate(async () => {
      const index = await (await fetch("/sky/images/index.json")).json();
      const sky = await (await fetch("/sky/sky.json")).json();
      const abbrs = Object.keys(sky.constellations);
      const listed = [...document.querySelectorAll("[data-sky-list-item]")].map((b) => b.getAttribute("data-sky-list-item"));
      const myth = abbrs.filter((a) => index.images[a]);
      return {
        myth,
        entries: Object.fromEntries(myth.map((a) => [a, index.images[a]])),
        listedMyth: listed.filter((x) => myth.includes(x)),
        listedPlain: listed.filter((x) => abbrs.includes(x) && !myth.includes(x)),
      };
    });

  // Desktop: Andromeda (the brief's own example) when it is listed, and a
  // constellation with no myth on its card, on the same page.
  const W = 1440;
  const H = 900;
  const { date } = findInstant(new Date(Date.UTC(2026, 9, 1)), W, H, M31, 120);
  await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready" && window.__sky.layers.images === "ready", null, { timeout: 20000 }).catch(async () => {
      const layers = await page.evaluate(() => ({ ...window.__sky.layers }));
      throw new Error("desktop: layers not ready within 20s: " + JSON.stringify(layers));
    });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });
    const split = await servedSplit(page);
    if (split.myth.length < 20) throw new Error(`the served index gives only ${split.myth.length} constellations an artwork`);
    if (!split.listedMyth.includes("And")) throw new Error(`Andromeda is not in the keyboard list at ${date.toISOString()}; listed myth constellations: ${split.listedMyth.join(", ")}`);
    if (!split.listedPlain.length) throw new Error(`no constellation without a myth is on screen at ${date.toISOString()}; the "none" side would be untested`);

    const card = await openFromList(page, "And");
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-sky-card="And"] [data-sky-card-image] img');
      return img && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 10000 }).catch(() => {
      throw new Error("Andromeda's artwork never finished loading");
    });
    const c = await readCard(card);
    assertMyth("And", c, split.entries.And, "1440");
    if (!c.box || Math.abs(c.box.w - 318) > 1 || Math.abs(c.box.h - 238.5) > 1) throw new Error(`1440: artwork box ${JSON.stringify(c.box)}, expected the photographs' 318x238.5`);
    notes.push(`And: ${c.src} ${JSON.stringify(c.credit)}`);
    await page.keyboard.press("Escape");
    await card.waitFor({ state: "detached", timeout: 2000 });

    const plainId = split.listedPlain.includes("Tel") ? "Tel" : split.listedPlain[0];
    const plain = await readCard(await openFromList(page, plainId));
    assertNone(plainId, plain, "1440");
    notes.push(`${plainId}: no image (${split.listedPlain.length} plain and ${split.listedMyth.length} myth constellations listed, ${split.myth.length} myth in the index)`);
  });

  // 400px, touch: the docked card for Orion (or the first myth constellation
  // listed), artwork at most 28% of the viewport, the card at most 60%.
  const P = { W: 400, H: 800 };
  const ori = findInstant(new Date(Date.UTC(2026, 0, 15)), P.W, P.H, { raDeg: 83.8, decDeg: 2 }, 30);
  await pinnedSkyPage(browser, { W: P.W, H: P.H, date: ori.date, contextOptions: { hasTouch: true } }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready" && window.__sky.layers.images === "ready", null, { timeout: 20000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });
    const split = await servedSplit(page);
    const id = split.listedMyth.includes("Ori") ? "Ori" : split.listedMyth[0];
    if (!id) throw new Error(`400: no myth constellation listed at ${ori.date.toISOString()}`);
    const card = await openFromList(page, id);
    await page.waitForFunction((cid) => {
      const img = document.querySelector(`[data-sky-card="${cid}"] [data-sky-card-image] img`);
      return img && img.complete && img.naturalWidth > 0;
    }, id, { timeout: 10000 });
    const c = await readCard(card);
    assertMyth(id, c, split.entries[id], "400");
    if (c.box.h > 0.28 * P.H + 1) throw new Error(`400: ${id}'s artwork is ${c.box.h}px tall, over 28% of ${P.H}`);
    if (c.card > 0.6 * P.H + 2) throw new Error(`400: ${id}'s card is ${c.card}px tall, over 60% of ${P.H}`);
    notes.push(`400 ${id}: artwork ${Math.round(c.box.h)}px of card ${Math.round(c.card)}px`);
  });
  return notes.join("; ");
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
    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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
      // The search band starts under the hint bar's MEASURED bottom, not a
      // fixed 80px: the counts' "and more" wording (final review m2) wraps
      // the bar to 107px at 400px, and phone names step down below it.
      const barBottom = document.querySelector("[data-stargaze-bar]")?.getBoundingClientRect().bottom ?? 72;
      const stray = boxed.filter((h) => !always.has(h.id) && !coloured.includes(h.id)).map((h) => h.id);
      const named = boxed.filter((h) => coloured.includes(h.id)).map((h) => h.id);
      for (const h of boxed) {
        if (!coloured.includes(h.id)) continue;
        const b = h.box;
        const x = b.x + b.w / 2;
        const y = b.y + b.h / 2;
        if (y < barBottom + 8 || y > barBottom + window.innerHeight * 0.25 || x < 4 || x > window.innerWidth - 4) continue;
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
    await stargazeToggle(page).click();
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
      await stargazeToggle(page).click();
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

    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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
    const [first] = await Promise.all([record(), stargazeToggle(page).click()]);
    const live = first.seen.filter((f) => f.rings > 0);
    const tail = first.seen.filter((f) => f.t > 1700);
    if (!first.fired || !live.length) throw new Error(`first entry with motion: no frame drew rings (${first.seen.length} frames seen, fired ${first.fired})`);
    if (tail.some((f) => f.rings > 0) || first.seen.at(-1).rings !== 0) throw new Error(`rings still drawn ${first.seen.at(-1).rings} at ${first.seen.at(-1).t.toFixed(0)}ms`);
    const span = live.at(-1).t - live[0].t;
    // The idle gate is 50 ms (20 fps); live rings paint on the 14 ms gate.
    if (live.length < span / 50 + 10) throw new Error(`rings painted ${live.length} frames over ${span.toFixed(0)}ms, not above the idle 20 fps gate`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.hasAttribute("data-stargaze"), null, { timeout: 3000 });
    const [second] = await Promise.all([record(), stargazeToggle(page).click()]);
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
    const toggle = stargazeToggle(page);
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
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    // The list still holds constellations, planets and the Moon without
    // objects.json, so "browse the list" stays (final review m2); the counts don't.
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const early = await readHint(page);
    const earlyText = `${copy.stargaze.hintPointer} · ${copy.stargaze.browseList}`;
    if (early.text !== earlyText || early.objects !== null || early.constellations !== null || !early.browse) {
      throw new Error(`with objects.json held back the hint bar reads ${JSON.stringify(early)}; expected ${JSON.stringify(earlyText)}: no counts, the browse control kept for a list that has items`);
    }
    release();
    await page.waitForSelector("[data-stargaze-count-objects]", { timeout: 10000 });
    notes.push("objects.json held: no counts, browse kept (list has items); released: counts appeared");
  });

  await pinnedSkyPage(browser, { W, H, date }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
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
    await stargazeToggle(page).click();
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

  // An open panel's rows are frozen (final review m3): the sky turns (motion
  // on, the clock jumped 10 minutes = 30 simulated hours) and the 2s refresh
  // passes, rows unchanged; closing refreshes, and reopening shows the new set.
  await withPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1 }, async (page) => {
    await page.clock.install({ time: date });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.objects === "ready" && window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await page.waitForFunction(() => document.body.hasAttribute("data-stargaze"), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-sky-list-item]").length > 0, null, { timeout: 5000 });
    const rows = () => page.evaluate(() => [...document.querySelectorAll("[data-sky-list] [data-sky-list-item]")].map((b) => b.textContent).join("|"));
    await page.getByRole("button", { name: copy.stargaze.browseList }).click();
    await page.waitForSelector('[data-sky-list-panel="open"]', { timeout: 3000 });
    const before = await rows();
    const lst0 = await page.evaluate(() => window.__sky.lstDeg);
    await page.clock.fastForward("10:00");
    await page.waitForTimeout(2600);
    const lst1 = await page.evaluate(() => window.__sky.lstDeg);
    const turned = Math.abs((((lst1 - lst0) % 360) + 540) % 360 - 180);
    if (turned < 20) throw new Error(`the sky turned only ${turned.toFixed(1)} deg of LST; the freeze has nothing to hold against`);
    const during = await rows();
    if (during !== before) throw new Error(`with the panel open the rows changed as the sky turned ${turned.toFixed(0)} deg past a 2s refresh:\n  before ${before}\n  after  ${during}`);
    await page.getByRole("button", { name: copy.stargaze.listPanelClose }).click();
    await page.waitForFunction((b) => [...document.querySelectorAll("[data-sky-list] [data-sky-list-item]")].map((x) => x.textContent).join("|") !== b, before, { timeout: 3000 }).catch(() => {
      throw new Error(`closing the panel after a ${turned.toFixed(0)} deg turn did not refresh the list`);
    });
    await page.getByRole("button", { name: copy.stargaze.browseList }).click();
    await page.waitForSelector('[data-sky-list-panel="open"]', { timeout: 3000 });
    const reopened = await rows();
    if (reopened === before) throw new Error("the reopened panel still shows the rows from before the turn");
    notes.push(`open panel frozen through a ${turned.toFixed(0)} deg turn and a 2.6s wait (${before.split("|").length} rows); close refreshed, reopen shows ${reopened.split("|").length} new-set rows`);
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
    await stargazeToggle(page).click();
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

/* ---------------------------------------------------------------------- */
/* Ways in (discoverability Task 6): the mark, the invite, the footer door */
/* ---------------------------------------------------------------------- */

function stargazeEvents(page) {
  return page.evaluate(() =>
    (window.vaq ?? [])
      .filter(([kind, ev]) => kind === "event" && ev?.name === "demo_used" && ev?.data?.demo === "stargaze")
      .map(([, ev]) => ev.data),
  );
}

async function waitStargaze(page, on) {
  await page.waitForFunction((on) => document.body.hasAttribute("data-stargaze") === on, on, { timeout: 5000 });
}

/**
 * Both doors into stargaze: the toggle carries a decorative mark without its
 * accessible name changing; the footer entry is a button (not a link) at the
 * foot of `/` (after References) and `/lab`, labelled with the toggle's own
 * words; each door tags `demo_used` with its `via`, still once per page load
 * whichever door comes first; exit returns focus to the door that entered.
 */
async function checkStargazeDoors(browser) {
  const t = copy.stargaze;
  const notes = [];

  // The mark is in the server HTML, so hydration can't shift the toggle.
  const html = await (await fetch(BASE)).text();
  const toggleHtml = html.match(/<div[^>]*data-stargaze-toggle[\s\S]*?<\/button>/)?.[0] ?? "";
  if (!/<svg[^>]*data-star-mark[^>]*aria-hidden="true"/.test(toggleHtml)) {
    throw new Error(`the server-rendered toggle has no aria-hidden star mark: ${JSON.stringify(toggleHtml.slice(0, 300))}`);
  }

  await withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    const exact = page.locator("[data-stargaze-toggle]").getByRole("button", { name: STARGAZE_ENTER, exact: true });
    if ((await exact.count()) !== 1) throw new Error(`toggle's accessible name is not exactly "${STARGAZE_ENTER}" (${await exact.count()} exact matches)`);
    const mark = await page.evaluate(() => {
      const svg = document.querySelector("[data-stargaze-toggle] button svg[data-star-mark]");
      const btn = svg?.closest("button");
      if (!svg || !btn) return null;
      const sr = svg.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      return { hidden: svg.getAttribute("aria-hidden"), fill: getComputedStyle(svg.querySelector("path")).fill, color: getComputedStyle(btn).color, w: sr.width, h: sr.height, btnH: br.height };
    });
    if (!mark || mark.hidden !== "true") throw new Error(`toggle mark missing or not aria-hidden: ${JSON.stringify(mark)}`);
    if (mark.fill !== mark.color) throw new Error(`toggle mark fill ${mark.fill} is not the button's colour ${mark.color} (currentColor)`);
    if (!(mark.h > 4 && mark.h <= mark.btnH)) throw new Error(`toggle mark measures ${mark.w}x${mark.h} in a ${mark.btnH}px button`);
    notes.push(`mark ${mark.w.toFixed(1)}px, currentColor, aria-hidden, in the SSR html; toggle name exact`);

    // The footer door on /: after References, a button, the toggle's words.
    const footer = page.locator("[data-stargaze-footer-enter]");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForSelector("[data-stargaze-footer][data-ready]", { timeout: 5000 });
    const shape = await page.evaluate(() => {
      const btn = document.querySelector("[data-stargaze-footer-enter]");
      const p = btn.closest("[data-stargaze-footer]");
      const prev = p.previousElementSibling;
      return { next: p.nextElementSibling?.hasAttribute("data-colophon") && p.nextElementSibling === p.parentElement.lastElementChild, tag: btn.tagName, type: btn.getAttribute("type"), text: btn.textContent.trim(), lead: p.textContent.trim(), prevHeading: prev?.querySelector("h2")?.textContent ?? null, inSheet: !!p.closest("[data-sheet]"), mark: btn.querySelector("svg[data-star-mark]")?.getAttribute("aria-hidden") };
    });
    if (shape.tag !== "BUTTON" || shape.type !== "button") throw new Error(`footer entry is <${shape.tag} type=${shape.type}>, not a button`);
    if (shape.text !== t.enter) throw new Error(`footer button reads ${JSON.stringify(shape.text)}, copy.stargaze.enter is ${JSON.stringify(t.enter)}`);
    if (!shape.lead.startsWith(t.footerLead)) throw new Error(`footer line reads ${JSON.stringify(shape.lead)}, expected it to open with footerLead`);
    if (shape.prevHeading !== copy.references.heading || !shape.inSheet) throw new Error(`footer entry follows ${JSON.stringify(shape.prevHeading)} (inSheet ${shape.inSheet}), expected References inside the sheet`);
    if (shape.mark !== "true") throw new Error("footer button has no aria-hidden mark");
    if (!shape.next) throw new Error("on /, the footer door is not followed only by the colophon as the sheet's last child");

    await footer.click();
    await waitStargaze(page, true);
    let events = await stargazeEvents(page);
    if (events.length !== 1 || events[0].via !== "footer") throw new Error(`after the footer door, demo_used{stargaze} queue is ${JSON.stringify(events)}, expected one with via "footer"`);
    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    const focus = await page.evaluate(() => document.activeElement?.hasAttribute("data-stargaze-footer-enter"));
    if (!focus) throw new Error(`after leaving via Escape, focus is on ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}, not the footer button that entered`);
    // The other door in the same load: still one event, still the first door's via.
    await stargazeToggle(page).click();
    await waitStargaze(page, true);
    await page.getByRole("button", { name: STARGAZE_EXIT }).click();
    await waitStargaze(page, false);
    const toToggle = await page.evaluate(() => !!document.activeElement?.closest("[data-stargaze-toggle]"));
    if (!toToggle) throw new Error("entering by the toggle after the footer, exit did not return focus to the toggle");
    events = await stargazeEvents(page);
    if (events.length !== 1 || events[0].via !== "footer") throw new Error(`both doors used in one load queued ${JSON.stringify(events)}, expected exactly one, via "footer"`);
    notes.push("/: footer door after References queued via footer, focus back to it; toggle afterwards added nothing and got its own focus back");
  });

  await withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await waitStargaze(page, true);
    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    const footer = page.locator("[data-stargaze-footer-enter]");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForSelector("[data-stargaze-footer][data-ready]", { timeout: 5000 });
    await footer.click();
    await waitStargaze(page, true);
    const events = await stargazeEvents(page);
    if (events.length !== 1 || events[0].via !== "toggle") throw new Error(`toggle then footer queued ${JSON.stringify(events)}, expected exactly one, via "toggle"`);
    notes.push("toggle first: one event, via toggle");
  });

  await withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
    const shape = await page.evaluate(() => {
      const p = document.querySelector("[data-stargaze-footer]");
      const sheet = document.querySelector("[data-sheet]");
      return p ? { last: !!sheet && p.nextElementSibling === sheet.lastElementChild && sheet.lastElementChild.hasAttribute("data-colophon"), btn: p.querySelector("button[data-stargaze-footer-enter]")?.textContent.trim() } : null;
    });
    if (!shape?.last || shape.btn !== t.enter) throw new Error(`/lab footer entry ${JSON.stringify(shape)}; expected the door followed only by the colophon, with a "${t.enter}" button`);
    const footer = page.locator("[data-stargaze-footer-enter]");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForSelector("[data-stargaze-footer][data-ready]", { timeout: 5000 });
    const box = await footer.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 400) throw new Error(`/lab footer button at 400px is ${JSON.stringify(box)}, off the screen`);
    await footer.click();
    await waitStargaze(page, true);
    const events = await stargazeEvents(page);
    if (events.length !== 1 || events[0].via !== "footer") throw new Error(`/lab footer queued ${JSON.stringify(events)}, expected one via "footer"`);
    notes.push("/lab at 400px: footer door is followed only by the colophon, on screen, queued via footer");
  });
  return notes.join("; ");
}

/**
 * The colophon (Task 12d): the last line of the sheet on / and /lab, the
 * copyright, a mailto to the owner and the resume, wrapping inside 400px.
 */
async function checkColophon(browser) {
  const t = copy.colophon;
  const notes = [];
  for (const [route, width] of [["/", 1280], ["/lab", 1280], ["/", 400], ["/lab", 400]]) {
    await withPage(browser, { viewport: { width, height: 800 } }, async (page) => {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      const c = await page.evaluate(() => {
        const el = document.querySelector("[data-colophon]");
        const sheet = document.querySelector("[data-sheet]");
        if (!el) return null;
        const link = (l) => el.querySelector(`a[data-track-label="${l}"]`)?.getAttribute("href") ?? null;
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent.replace(/\s+/g, " ").trim(),
          last: sheet?.lastElementChild === el,
          email: link("Email"),
          resume: link("Resume"),
          right: r.right,
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        };
      });
      if (!c) throw new Error(`${route}: no [data-colophon]`);
      if (!c.text.startsWith("© 2026 Neelay Ranjan")) throw new Error(`${route}: colophon reads ${JSON.stringify(c.text)}`);
      if (!c.last) throw new Error(`${route}: the colophon is not the sheet's last child`);
      if (c.email !== t.links[0].href || c.email !== "mailto:neelay.ranjan@outlook.com") throw new Error(`${route}: email link is ${c.email}`);
      if (c.resume !== "/resume.pdf") throw new Error(`${route}: Resume link is ${c.resume}`);
      if (c.scrollW > c.clientW) throw new Error(`${route} at ${width}px scrolls horizontally (${c.scrollW} > ${c.clientW})`);
      if (c.right > width) throw new Error(`${route} at ${width}px: colophon right edge ${c.right}`);
      notes.push(`${route}@${width}`);
    });
  }
  return `colophon on ${notes.join(", ")}: © line, mailto, /resume.pdf, last in the sheet, no horizontal scroll`;
}

/**
 * The once-per-session invite (night-sky/invite.ts): shown the first time a
 * hover-capable pointer moves onto the sky in paper mode, at the moment the
 * colour lift starts, clear of the sheet, pointer-events none, gone after a
 * few seconds; not again after a reload in the same session; never on a
 * no-hover device; never in stargaze; once per page load when storage throws.
 */
async function checkSkyInvite(browser) {
  const W = 1440;
  const H = 900;
  const notes = [];
  const sheetPt = { x: 720, y: 450 };
  const skyPt = { x: 110, y: 460 };

  const readInvite = (page) =>
    page.evaluate(() => {
      const el = document.querySelector("[data-sky-invite]");
      const r = el.getBoundingClientRect();
      const sh = document.querySelector("[data-sheet]").getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        shown: window.__sky.inviteShown,
        hookBox: window.__sky.invite,
        hidden: el.hidden,
        opacity: Number(cs.opacity),
        pointerEvents: cs.pointerEvents,
        text: el.textContent,
        box: { x: r.left, y: r.top, w: r.width, h: r.height },
        sheet: { x: sh.left, y: sh.top, w: sh.width, h: sh.height },
        sat: window.__sky.saturationTarget,
      };
    });
  const enterSky = async (page) => {
    await page.mouse.move(sheetPt.x, sheetPt.y);
    await page.waitForTimeout(100);
    await page.mouse.move(skyPt.x, skyPt.y, { steps: 3 });
  };
  const loadHome = async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.objects === "ready", null, { timeout: 10000 });
  };

  await withPage(browser, { viewport: { width: W, height: H } }, async (page) => {
    await loadHome(page);
    const rest = await readInvite(page);
    if (rest.shown || !rest.hidden) throw new Error(`invite up before any pointer entry: ${JSON.stringify(rest)}`);
    const t0 = Date.now();
    await enterSky(page);
    await page.waitForFunction(() => window.__sky.inviteShown === true, null, { timeout: 2000 }).catch(() => {
      throw new Error(`first entry onto the sky at (${skyPt.x}, ${skyPt.y}) did not show the invite`);
    });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("[data-sky-invite]")).opacity) > 0.99, null, { timeout: 2000 });
    const up = await readInvite(page);
    if (up.sat !== 1) throw new Error(`invite shown but the colour target is ${up.sat}, not the lift (1)`);
    if (up.hidden || up.pointerEvents !== "none") throw new Error(`invite hidden=${up.hidden}, pointer-events ${up.pointerEvents}`);
    if (up.text !== copy.stargaze.invite) throw new Error(`invite reads ${JSON.stringify(up.text)}`);
    if (boxesIntersect(up.box, up.sheet)) throw new Error(`invite ${JSON.stringify(up.box)} overlaps the sheet ${JSON.stringify(up.sheet)}`);
    if (up.box.x < 0 || up.box.y < 0 || up.box.x + up.box.w > W || up.box.y + up.box.h > H) throw new Error(`invite ${JSON.stringify(up.box)} leaves the ${W}x${H} viewport`);
    const dist = Math.hypot(up.box.x + up.box.w / 2 - skyPt.x, up.box.y + up.box.h / 2 - skyPt.y);
    if (dist > 200) throw new Error(`invite centre is ${dist.toFixed(0)}px from the pointer, not near it`);
    notes.push(`first entry: shown ${JSON.stringify(up.box)}, ${dist.toFixed(0)}px from the pointer, clear of the sheet, colour target 1, pointer-events none`);
    await page.waitForFunction(() => document.querySelector("[data-sky-invite]").hidden, null, { timeout: 6000 }).catch(() => {
      throw new Error("invite still up 6s after it appeared");
    });
    const lasted = Date.now() - t0;
    if (lasted < 3000) throw new Error(`invite gone after ${lasted}ms, expected a few seconds (3.5s)`);
    notes.push(`gone after ~${lasted}ms`);
    // Off and back on in the same load: no second showing.
    await enterSky(page);
    await page.waitForTimeout(600);
    if (!(await readInvite(page)).hidden) throw new Error("invite showed a second time in the same page load");

    await page.reload({ waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.objects === "ready", null, { timeout: 10000 });
    await enterSky(page);
    await page.waitForFunction(() => window.__sky.saturationTarget === 1, null, { timeout: 2000 });
    await page.waitForTimeout(800);
    const again = await readInvite(page);
    if (again.shown || !again.hidden) throw new Error(`after a reload in the same session the invite showed again: ${JSON.stringify(again)}`);
    notes.push("reload, same session: entry registered (colour target 1), invite not shown");
  });

  // No hover (touch emulation makes Firefox report (hover: none)).
  await withPage(browser, { viewport: { width: W, height: H }, hasTouch: true }, async (page) => {
    await loadHome(page);
    const hoverNone = await page.evaluate(() => matchMedia("(hover: none)").matches);
    if (!hoverNone) throw new Error("hasTouch did not emulate (hover: none); this half cannot run");
    await enterSky(page);
    await page.touchscreen.tap(skyPt.x, skyPt.y + 40);
    await page.waitForTimeout(800);
    const r = await readInvite(page);
    if (r.shown || !r.hidden) throw new Error(`invite showed on a (hover: none) device: ${JSON.stringify(r)}`);
    notes.push("(hover: none): mouse entry and a tap on the sky showed nothing");
  });

  // Never in stargaze; stargazing spends the session's invite, by either door
  // (final review m4): the visitor has already found what it points at.
  await withPage(browser, { viewport: { width: W, height: H } }, async (page) => {
    await loadHome(page);
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await waitStargaze(page, true);
    await page.mouse.move(700, 500, { steps: 3 });
    await page.mouse.move(skyPt.x, skyPt.y, { steps: 3 });
    await page.waitForTimeout(600);
    const r = await readInvite(page);
    if (r.shown || !r.hidden) throw new Error(`invite showed while stargazing: ${JSON.stringify(r)}`);
    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    await enterSky(page);
    await page.waitForFunction(() => window.__sky.saturationTarget === 1, null, { timeout: 2000 });
    await page.waitForTimeout(800);
    const after = await readInvite(page);
    if (after.shown || !after.hidden) throw new Error(`after stargazing by the toggle and leaving, a paper-mode entry showed the invite: ${JSON.stringify(after)}`);
    await page.reload({ waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await enterSky(page);
    await page.waitForFunction(() => window.__sky.saturationTarget === 1, null, { timeout: 2000 });
    await page.waitForTimeout(800);
    if (!(await readInvite(page)).hidden) throw new Error("stargazing by the toggle did not spend the invite for the session (it showed after a reload)");
    notes.push("stargaze by the toggle: nothing inside; entry registered afterwards and after a reload, invite not shown");
  });
  await withPage(browser, { viewport: { width: W, height: H } }, async (page) => {
    await loadHome(page);
    const footer = page.locator("[data-stargaze-footer-enter]");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForSelector("[data-stargaze-footer][data-ready]", { timeout: 5000 });
    await footer.click();
    await waitStargaze(page, true);
    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    await enterSky(page);
    await page.waitForFunction(() => window.__sky.saturationTarget === 1, null, { timeout: 2000 });
    await page.waitForTimeout(800);
    const r = await readInvite(page);
    if (r.shown || !r.hidden) throw new Error(`after stargazing by the footer door and leaving, a paper-mode entry showed the invite: ${JSON.stringify(r)}`);
    notes.push("stargaze by the footer door: invite spent too");
  });

  // Storage that throws: once per page load.
  await withPage(browser, { viewport: { width: W, height: H } }, async (page, context) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } });
    });
    for (const round of [1, 2]) {
      if (round === 1) await loadHome(page);
      else {
        await page.reload({ waitUntil: "networkidle" });
        await waitSkyDrawn(page);
        await page.waitForFunction(() => window.__sky.layers.objects === "ready", null, { timeout: 10000 });
      }
      await enterSky(page);
      await page.waitForFunction(() => window.__sky.inviteShown === true, null, { timeout: 2000 }).catch(() => {
        throw new Error(`with sessionStorage throwing, load ${round} did not show the invite`);
      });
      await page.evaluate(() => (document.querySelector("[data-sky-invite]").hidden = true));
      await page.mouse.move(sheetPt.x, sheetPt.y);
      await enterSky(page);
      await page.waitForTimeout(500);
      if (!(await readInvite(page)).hidden) throw new Error(`with sessionStorage throwing, load ${round} showed the invite twice`);
    }
    notes.push("sessionStorage throwing: once in each of two loads");
  });
  return notes.join("; ");
}

/**
 * Decodes a PNG screenshot in the page and returns its RGBA pixels. The
 * screenshot is the composited result (canvas, backing, anything above), so
 * it is what a visitor sees, not what one layer drew.
 */
async function screenshotPixels(page, clip) {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    return { w: c.width, h: c.height, data: [...ctx.getImageData(0, 0, c.width, c.height).data] };
  }, png.toString("base64"));
}

const srgbLum = ([r, g, b]) => {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const MUT_RGB = [0x9a, 0x94, 0x8a];

/**
 * The credit line's text contrast against the mean background behind its text
 * box, as composited on screen: the text is made transparent for the
 * screenshot, and its colour (mut at 70%) is laid over that mean.
 */
async function creditContrast(page) {
  const tag = await page.addStyleTag({ content: "[data-sky-credit], [data-sky-credit] * { color: transparent !important; }" });
  const r = await page.evaluate(() => {
    const el = document.querySelector("[data-sky-credit-body]");
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pl = parseFloat(cs.paddingLeft);
    const pt = parseFloat(cs.paddingTop);
    return { x: b.left + pl, y: b.top + pt, w: b.width - 2 * pl, h: b.height - 2 * pt };
  });
  const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) };
  const px = await screenshotPixels(page, clip);
  await tag.evaluate((n) => n.remove());
  const mean = [0, 0, 0];
  const n = px.data.length / 4;
  for (let i = 0; i < px.data.length; i += 4) for (let k = 0; k < 3; k++) mean[k] += px.data[i + k] / n;
  const text = mean.map((v, k) => 0.7 * MUT_RGB[k] + 0.3 * v);
  const lt = srgbLum(text);
  const lb = srgbLum(mean);
  return { contrast: (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05), bgLum: 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2], clip };
}

const NO_BACKING = "[data-sky-credit-body], [data-stargaze-chrome] { background: none !important; box-shadow: none !important; }";

/**
 * The stargaze chrome's desk-toned backing (Task 6, Addendum 2):
 * - at 1440 in stargaze, at an instant where drawn names (the Double Cluster's
 *   among them) run under the hint or exit, every such name's covered part is
 *   shaded: the backing's alpha, measured per pixel from the canvas and the
 *   composited screenshot, is at least 0.75 there; and the pointer over that
 *   covered part neither hovers nor opens the name, while the same point with
 *   the chrome's pointer-events off does (so it is the chrome doing it);
 * - at 400 (touch) in stargaze, no drawn name box at all, planets and the Moon
 *   included, reaches the hint bar or the credit block; the Moon, beside the
 *   exit control at this instant, keeps its symbol and loses only its name;
 * - the credit's contrast over the Milky Way, in stargaze and in paper mode,
 *   is at least the paper-mode value before the colour round (saturation 0,
 *   no backing), at the worst band-crossing instants Task 3 found.
 */
async function checkStargazeChrome(browser) {
  const notes = [];
  const W = 1440;
  const H = 900;
  await pinnedSkyPage(browser, { W, H, date: new Date(Date.UTC(2026, 9, 1, 6)) }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).click();
    await waitStargaze(page, true);
    await page.waitForSelector("[data-stargaze-count-objects]", { timeout: 5000 });
    await page.mouse.move(W / 2, H / 2);
    await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const bx = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      };
      return {
        chrome: [...document.querySelectorAll("[data-stargaze-bar] [data-stargaze-chrome]")].map(bx),
        hits: window.__sky.hits.filter((h) => h.box).map((h) => ({ id: h.id, box: h.box })),
      };
    });
    if (layout.chrome.length !== 2) throw new Error(`expected the hint and exit as backed chrome, found ${layout.chrome.length}`);
    const under = [];
    for (const h of layout.hits) {
      for (const c of layout.chrome) {
        if (!boxesIntersect(h.box, c)) continue;
        const x0 = Math.ceil(Math.max(h.box.x, c.x));
        const y0 = Math.ceil(Math.max(h.box.y, c.y));
        const x1 = Math.floor(Math.min(h.box.x + h.box.w, c.x + c.w));
        const y1 = Math.floor(Math.min(h.box.y + h.box.h, c.y + c.h));
        if (x1 - x0 >= 2 && y1 - y0 >= 2) under.push({ id: h.id, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    if (!under.some((u) => u.id === "ngc869" || u.id === "ngc884")) {
      throw new Error(`at 06:00Z no Double Cluster name runs under the chrome (under: ${JSON.stringify(under.map((u) => u.id))}); the instant no longer reproduces the defect`);
    }
    const tag = await page.addStyleTag({ content: "[data-stargaze-bar], [data-stargaze-bar] * { color: transparent !important; }" });
    const alphas = [];
    for (const u of under) {
      const shot = await screenshotPixels(page, { x: u.x, y: u.y, width: u.w, height: u.h });
      const canvas = await page.evaluate(([sel, u]) => [...document.querySelector(sel).getContext("2d").getImageData(u.x, u.y, u.w, u.h).data], [SKY_CANVAS, u]);
      const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const DESK_L = 0.2126 * 12 + 0.7152 * 11 + 0.0722 * 9;
      const a = [];
      for (let i = 0; i < canvas.length; i += 4) {
        const cl = lum(canvas, i);
        if (cl - DESK_L < 30) continue; // only pixels the name actually lit
        a.push((cl - lum(shot.data, i)) / (cl - DESK_L));
      }
      a.sort((p, q) => p - q);
      alphas.push({ id: u.id, n: a.length, median: a.length ? a[a.length >> 1] : null, min: a[0] ?? null });
    }
    await tag.evaluate((n) => n.remove());
    const lit = alphas.filter((a) => a.n >= 5);
    if (!lit.length) throw new Error(`no lit name pixels under the chrome to measure: ${JSON.stringify(alphas)}`);
    const weak = lit.filter((a) => a.median < 0.75);
    if (weak.length) throw new Error(`names under the stargaze chrome are not shaded: measured backing alpha ${JSON.stringify(weak)} (need median >= 0.75)`);
    notes.push(`1440 @06Z: ${lit.map((a) => `${a.id} under chrome, backing alpha median ${a.median.toFixed(2)} over ${a.n} lit px`).join(", ")}`);

    // Pointer consistency: the backed box is a control, the name under it is not live.
    const target = under.find((u) => u.id === "ngc869" || u.id === "ngc884");
    const pt = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(150);
    const blocked = await page.evaluate(() => window.__sky.highlight);
    if (blocked !== null) throw new Error(`pointer on the chrome over ${target.id}'s hidden name still highlights ${blocked}`);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(200);
    const card = await page.evaluate(() => window.__sky.card);
    if (card) throw new Error(`a click on the chrome over ${target.id}'s hidden name opened a card for ${card}`);
    const off = await page.addStyleTag({ content: "[data-stargaze-chrome] { pointer-events: none !important; }" });
    await page.mouse.move(W / 2, H / 2);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(150);
    const live = await page.evaluate(() => window.__sky.highlight);
    await off.evaluate((n) => n.remove());
    if (!live) throw new Error(`with the chrome's pointer-events off, (${pt.x}, ${pt.y}) highlights nothing either, so the block proves nothing`);
    notes.push(`pointer over ${target.id}'s shaded name: no hover, no card; same point with the chrome transparent highlights ${live}`);
  });

  await pinnedSkyPage(browser, { W: 400, H: 800, date: new Date(Date.UTC(2026, 9, 1, 5)), contextOptions: { hasTouch: true } }, async (page) => {
    await page.waitForFunction(() => window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    await stargazeToggle(page).tap();
    await waitStargaze(page, true);
    await page.waitForSelector("[data-stargaze-count-objects]", { timeout: 5000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const b = document.querySelector("[data-stargaze-bar]").getBoundingClientRect();
      const c = document.querySelector("[data-sky-credit-body]").getBoundingClientRect();
      return {
        bar: { x: b.left, y: b.top, w: b.width, h: b.height },
        credit: { x: c.left, y: c.top, w: c.width, h: c.height },
        hits: window.__sky.hits.map((h) => ({ id: h.id, x: h.x, y: h.y, box: h.box })),
      };
    });
    const clash = r.hits.filter((h) => h.box && (boxesIntersect(h.box, r.bar) || boxesIntersect(h.box, r.credit)));
    if (clash.length) throw new Error(`at 400px drawn names reach the chrome (bar ${JSON.stringify(r.bar)}, credit ${JSON.stringify(r.credit)}): ${JSON.stringify(clash)}`);
    const moon = r.hits.find((h) => h.id === "moon");
    if (!moon) throw new Error("the Moon is not on screen at 400px @05Z; the instant no longer reproduces the defect");
    if (moon.y > r.bar.y + r.bar.h + 20) throw new Error(`the Moon sits at y=${moon.y.toFixed(0)}, well below the ${r.bar.h.toFixed(0)}px bar; the instant no longer tests the band`);
    if (moon.box) throw new Error(`the Moon at (${moon.x.toFixed(0)}, ${moon.y.toFixed(0)}) beside the bar kept a name box ${JSON.stringify(moon.box)}`);
    notes.push(`400 @05Z: no name box meets the ${r.bar.h.toFixed(0)}px bar or the credit; Moon at (${moon.x.toFixed(0)}, ${moon.y.toFixed(0)}) keeps its symbol, name withheld`);
  });

  // Credit contrast over the band, worst instants from Task 3's scan.
  for (const [cw, ch, hr, touch] of [[400, 800, 14, true], [1440, 900, 16, false]]) {
    const date = new Date(Date.UTC(2026, 9, 1, hr));
    const res = await withPage(browser, { viewport: { width: cw, height: ch }, reducedMotion: "reduce", deviceScaleFactor: 1, hasTouch: touch }, async (page, context) => {
      await context.addInitScript(() => {
        window.__skySaturationOverride = 0;
      });
      await page.clock.setFixedTime(date);
      await page.goto(BASE, { waitUntil: "networkidle" });
      await waitSkyDrawn(page);
      await page.waitForFunction(() => window.__sky.layers.objects === "ready" && window.__sky.layers.milkyWay === "ready" && window.__sky.saturation === 0, null, { timeout: 10000 });
      await waitStargazeReady(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(200);
      const noBack = await page.addStyleTag({ content: NO_BACKING });
      const before = await creditContrast(page);
      await noBack.evaluate((n) => n.remove());
      await page.evaluate(() => delete window.__skySaturationOverride);
      // Recompute the target: onto the sky, then onto the credit (not the sky).
      await page.mouse.move(4, ch / 2);
      const creditBox = await page.locator("[data-sky-credit-body]").boundingBox();
      await page.mouse.move(creditBox.x + creditBox.width / 2, creditBox.y + creditBox.height / 2);
      await page.waitForFunction((s) => window.__sky.saturation === s, PAPER_SATURATION, { timeout: 3000 });
      const paper = await creditContrast(page);
      await page.evaluate(() => document.querySelector("[data-stargaze-toggle] button").click());
      await waitStargaze(page, true);
      await page.waitForFunction(() => window.__sky.saturation === 1, null, { timeout: 3000 });
      await page.waitForTimeout(200);
      const star = await creditContrast(page);
      const tag = await page.addStyleTag({ content: NO_BACKING });
      const starBare = await creditContrast(page);
      await tag.evaluate((n) => n.remove());
      return { before, paper, star, starBare };
    });
    const f = (m) => `${m.contrast.toFixed(2)}:1 (bg L ${m.bgLum.toFixed(1)})`;
    if (res.star.contrast < res.before.contrast) throw new Error(`${cw}px @${hr}Z stargaze credit contrast ${f(res.star)} is below paper mode before the colour round ${f(res.before)}`);
    if (res.paper.contrast < res.before.contrast) throw new Error(`${cw}px @${hr}Z paper credit contrast ${f(res.paper)} is below paper mode before the colour round ${f(res.before)}`);
    notes.push(`credit ${cw}px @${hr}Z: pre-colour paper ${f(res.before)}, stargaze bare ${f(res.starBare)} -> backed ${f(res.star)}, paper backed ${f(res.paper)}`);
  }
  return notes.join("; ");
}

/* ---------------------------------------------------------------------- */
/* The secret door (Task 17): a click on a constellation enters stargaze   */
/* ---------------------------------------------------------------------- */

/**
 * In paper mode, a still click (or touch tap) on a constellation's lines in
 * the margin enters stargaze tagged `via: "sky"`, the constellation stays
 * lit, the page fades over 600ms but goes inert at once, and a caption
 * (`copy.stargaze.secretMessage`) fades in for ~6s, pointer-events none,
 * centred below the hint bar, announced by a polite live region. A click on
 * an object symbol or a drag across the same lines does nothing; the toggle
 * shows no caption; leaving removes it; reduced motion has no fades.
 *
 * Pinned to SKY_HOVER_INSTANT (the sky turns from Date.now, so a fixed time
 * holds every segment still even with motion on; timers keep running).
 *
 * Proved to bite (2026-10-01), each a temporary product mutation, rebuilt:
 * - lib/sky-secret.ts returning `i.picked ? i.picked.id : null` (any hit is
 *   the door): FAILS "a click on the m.. symbol entered stargaze".
 * - NightSky's `secret.show()` call removed: FAILS "the secret door's
 *   caption never appeared".
 */
async function findSecretTarget(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector("[data-sheet]").getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const hits = window.__sky.hits;
    const clear = (x, y) =>
      hits.every((h) => Math.hypot(h.x - x, h.y - y) > 34) &&
      hits.every((h) => !h.box || x < h.box.x - 8 || x > h.box.x + h.box.w + 8 || y < h.box.y - 8 || y > h.box.y + h.box.h + 8);
    const inLeftMargin = (x, y) => x > 20 && x < sheet.left - 30 && y > 90 && y < H - 90;
    let target = null;
    let object = null;
    const abbrs = ["UMa", "UMi", "Cas", "Cep", "Dra", "Cyg", "Lyr", "Her", "Boo", "Leo", "Per", "And", "Aur", "Gem", "Ori", "Tau", "Peg", "Cnc", "Lyn", "CVn", "Com", "Cam", "LMi", "Lac", "Vul", "Sge", "Del", "Tri", "Ari", "Psc", "Aql", "Oph", "Ser", "Vir", "CrB", "Hya", "Mon", "CMi"];
    for (const abbr of abbrs) {
      for (const [x1, y1, x2, y2] of window.__sky.segmentsFor(abbr)) {
        if (Math.hypot(x2 - x1, y2 - y1) < 40) continue;
        for (const f of [0.5, 0.35, 0.65]) {
          const x = x1 + (x2 - x1) * f;
          const y = y1 + (y2 - y1) * f;
          if (inLeftMargin(x, y) && clear(x, y)) {
            target = { abbr, x, y, dx: (x2 - x1) / Math.hypot(x2 - x1, y2 - y1), dy: (y2 - y1) / Math.hypot(x2 - x1, y2 - y1) };
            break;
          }
        }
        if (target) break;
      }
      if (target) break;
    }
    // An object symbol in a margin, not the box-only Milky Way: a click there must not be the door.
    for (const h of hits) {
      if (h.id === "milkyway") continue;
      if ((h.x > 20 && h.x < sheet.left - 20) || (h.x > sheet.right + 20 && h.x < W - 20)) {
        if (h.y > 90 && h.y < H - 90) {
          object = { id: h.id, x: h.x, y: h.y };
          break;
        }
      }
    }
    return { target, object };
  });
}

const readSecret = (page) =>
  page.evaluate(() => {
    const el = document.querySelector("[data-sky-secret]");
    const region = document.querySelector("[data-sky-secret-region]");
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      hidden: el.hidden,
      text: el.textContent,
      opacity: Number(cs.opacity),
      transition: cs.transitionDuration,
      pointerEvents: cs.pointerEvents,
      regionPointerEvents: getComputedStyle(region).pointerEvents,
      live: region.getAttribute("aria-live"),
      role: region.getAttribute("role"),
      box: { x: r.left, y: r.top, w: r.width, h: r.height },
      hook: window.__sky.secretShown,
    };
  });

async function checkStargazeSecretDoor(browser) {
  const W = 1440;
  const H = 900;
  const notes = [];
  const msg = copy.stargaze.secretMessage;
  const load = async (page) => {
    await page.clock.setFixedTime(SKY_HOVER_INSTANT);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitSkyDrawn(page);
    await page.waitForFunction(() => window.__sky.layers.objects === "ready" && window.__sky.layers.facts === "ready", null, { timeout: 10000 });
    await waitStargazeReady(page);
    const found = await findSecretTarget(page);
    if (!found.target) throw new Error("no constellation segment clear of every symbol in the left margin at SKY_HOVER_INSTANT; pick another instant");
    return found;
  };
  const isOn = (page) => page.evaluate(() => document.body.hasAttribute("data-stargaze"));

  await withPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1 }, async (page) => {
    const { target, object } = await load(page);
    // The hover hit test agrees this point is the constellation's lines.
    await page.mouse.move(target.x, target.y);
    await page.waitForFunction((a) => window.__sky.highlight === a, target.abbr, { timeout: 3000 });

    // An object symbol is not the door.
    if (!object) throw new Error("no object symbol in either margin at SKY_HOVER_INSTANT to click as the negative case");
    await page.mouse.click(object.x, object.y);
    await page.waitForTimeout(500);
    if (await isOn(page)) throw new Error(`a click on the ${object.id} symbol entered stargaze; only constellation lines are the door`);
    notes.push(`click on ${object.id}'s symbol: nothing`);

    // A drag across the lines is not the door.
    await dragBy(page, target.x - target.dx * 40, target.y - target.dy * 40, target.dx * 80, target.dy * 80, 10);
    await page.mouse.up();
    await page.waitForFunction(() => window.__sky.offset.x === 0 && window.__sky.offset.y === 0, null, { timeout: 2500 });
    await page.waitForTimeout(300);
    if (await isOn(page)) throw new Error(`an 80px drag across ${target.abbr} entered stargaze`);
    if ((await stargazeEvents(page)).length) throw new Error("a drag queued demo_used{stargaze}");
    notes.push(`80px drag across ${target.abbr}: nothing`);

    // The click.
    await page.mouse.click(target.x, target.y);
    await waitStargaze(page, true);
    const entered = await page.evaluate(() => {
      const main = document.querySelector("main");
      const cs = getComputedStyle(main);
      return { inert: [...document.querySelectorAll("main")].every((m) => m.inert), opacity: Number(cs.opacity), duration: cs.transitionDuration, highlight: window.__sky.highlight };
    });
    if (!entered.inert) throw new Error("main is not inert at once after the secret door");
    if (!entered.duration.split(",").some((d) => d.trim() === "0.6s")) throw new Error(`main's transition is ${entered.duration}, expected the 600ms fade`);
    if (entered.highlight !== target.abbr) throw new Error(`after entry the highlight is ${entered.highlight}, expected ${target.abbr} to stay lit`);
    const events = await stargazeEvents(page);
    if (events.length !== 1 || events[0].via !== "sky") throw new Error(`demo_used{stargaze} queue is ${JSON.stringify(events)}, expected one with via "sky"`);
    notes.push(`click on ${target.abbr}: stargaze, via sky, inert at once, 600ms fade, ${target.abbr} still lit`);

    const t0 = Date.now();
    await page.waitForFunction(() => !document.querySelector("[data-sky-secret]").hidden, null, { timeout: 2000 }).catch(() => {
      throw new Error("the secret door's caption never appeared");
    });
    const first = await readSecret(page);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("[data-sky-secret]")).opacity) > 0.99, null, { timeout: 2000 });
    const up = await readSecret(page);
    if (up.text !== msg) throw new Error(`caption reads ${JSON.stringify(up.text)}, expected ${JSON.stringify(msg)}`);
    if (up.pointerEvents !== "none" || up.regionPointerEvents !== "none") throw new Error(`caption pointer-events ${up.pointerEvents}, region ${up.regionPointerEvents}`);
    if (up.role !== "status" || up.live !== "polite") throw new Error(`caption region role=${up.role} aria-live=${up.live}, expected a polite status`);
    if (!up.hook) throw new Error("window.__sky.secretShown is false while the caption is up");
    if (!(first.opacity < 0.99) || up.transition !== "0.4s") throw new Error(`caption did not fade in (first opacity ${first.opacity}, transition ${up.transition})`);
    const geo = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
      const bar = document.querySelector("[data-stargaze-bar]").getBoundingClientRect();
      const c = document.querySelector("[data-sky-secret]").getBoundingClientRect();
      return { chrome: [...document.querySelectorAll("[data-stargaze-bar] [data-stargaze-chrome]")].map(r), barBottom: bar.bottom, under: document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)?.closest("[data-sky-secret-region]") !== null };
    });
    const cx = up.box.x + up.box.w / 2;
    if (Math.abs(cx - W / 2) > 2) throw new Error(`caption centre x ${cx.toFixed(1)}, not centred in ${W}`);
    if (up.box.y < geo.barBottom || geo.chrome.some((b) => boxesIntersect(b, up.box))) throw new Error(`caption ${JSON.stringify(up.box)} overlaps the hint bar (bottom ${geo.barBottom}) or its chrome`);
    if (up.box.y + up.box.h > H * 0.5) throw new Error(`caption ${JSON.stringify(up.box)} is not in the upper middle of ${H}`);
    if (geo.under) throw new Error("the caption takes the pointer (elementFromPoint found it)");
    notes.push(`caption: exact text, fades in, ${up.box.w.toFixed(0)}x${up.box.h.toFixed(0)} centred at y=${up.box.y.toFixed(0)} below the bar (${geo.barBottom.toFixed(0)}), pointer-events none, polite status`);

    await page.waitForFunction(() => document.querySelector("[data-sky-secret]").hidden, null, { timeout: 9000 }).catch(() => {
      throw new Error("caption still up 9s after it appeared");
    });
    const lasted = Date.now() - t0;
    if (lasted < 6000) throw new Error(`caption gone after ${lasted}ms, expected ~6s up`);
    if ((await readSecret(page)).text !== "") throw new Error("hidden caption kept its text in the live region");
    notes.push(`gone after ~${lasted}ms`);

    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    const toToggle = await page.evaluate(() => !!document.activeElement?.closest("[data-stargaze-toggle]"));
    if (!toToggle) throw new Error("leaving a sky entry did not return focus to the toggle");

    // The toggle shows no caption.
    await stargazeToggle(page).click();
    await waitStargaze(page, true);
    await page.waitForTimeout(1000);
    if (!(await readSecret(page)).hidden) throw new Error("entering by the toggle showed the secret caption");
    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    notes.push("Escape exits, focus to the toggle; the toggle shows no caption");

    // Leaving before it ends removes it. Still one event for the load.
    await page.waitForTimeout(700); // the page's fade back in, so nothing is mid-transition
    await page.mouse.click(target.x, target.y);
    await waitStargaze(page, true);
    await page.waitForFunction(() => !document.querySelector("[data-sky-secret]").hidden, null, { timeout: 2000 });
    await page.keyboard.press("Escape");
    await waitStargaze(page, false);
    const gone = await readSecret(page);
    if (!gone.hidden || gone.text !== "") throw new Error(`exiting mid-caption left it ${JSON.stringify(gone)}`);
    const all = await stargazeEvents(page);
    if (all.length !== 1 || all[0].via !== "sky") throw new Error(`three entries in one load queued ${JSON.stringify(all)}, expected one via "sky"`);
    notes.push("exit mid-caption removes it; one event for the load");
  });

  // Reduced motion: no fades, page or caption.
  await withPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: "reduce" }, async (page) => {
    const { target } = await load(page);
    await page.mouse.click(target.x, target.y);
    await waitStargaze(page, true);
    const main = await page.evaluate(() => getComputedStyle(document.querySelector("main")).transitionDuration);
    if (main !== "0s") throw new Error(`reduced motion: main's transition is ${main}`);
    const up = await readSecret(page);
    if (up.hidden || up.opacity !== 1 || up.transition !== "0s") throw new Error(`reduced motion: caption at entry ${JSON.stringify({ hidden: up.hidden, opacity: up.opacity, transition: up.transition })}, expected fully up with no transition`);
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector("[data-sky-secret]").hidden, null, { timeout: 8000 });
    const lasted = Date.now() - t0;
    if (lasted < 5500) throw new Error(`reduced motion: caption gone after ${lasted}ms`);
    notes.push(`reduced motion: up at once with no transition, gone at ~${lasted}ms, page not faded`);
  });

  // Touch: a still tap on the same lines is the door too.
  await withPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true }, async (page) => {
    const { target } = await load(page);
    await page.touchscreen.tap(target.x, target.y);
    await waitStargaze(page, true);
    const events = await stargazeEvents(page);
    if (events.length !== 1 || events[0].via !== "sky") throw new Error(`touch tap queued ${JSON.stringify(events)}`);
    await page.waitForFunction(() => !document.querySelector("[data-sky-secret]").hidden, null, { timeout: 2000 });
    notes.push(`touch tap on ${target.abbr}: stargaze via sky, caption up`);
  });
  return notes.join("; ");
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
  ["lab-box-navigates", checkLabBoxNavigates],
  ["search-basics", checkSearchBasics],
  ["resume-pdf", checkResumePdf],
  ["stamp-no-link-ancestor", checkStampNoLinkAncestor],
  ["references-lab-link-resolves", checkReferencesLabLinkResolves],
  ["label-efficiency", checkLabelEfficiency],
  ["dice-cdf", checkDiceCdf],
  ["lab-flight-video", checkLabFlightVideo],
  ["slaac-nothing-at-rest", checkSlaacNothingAtRest],
  ["slaac-reroute", checkSlaacReroute],
  ["slaac-launch-preset", checkSlaacLaunchPreset],
  ["slaac-stargaze-cancel", checkSlaacStargazeCancel],
  ["slaac-400", checkSlaac400],
  ["slaac-all-flights", checkSlaacAllFlights],
  ["draw-stroke-auto-label", checkDrawAutoLabel],
  ["chess-hint-g3", checkChessHint],
  ["chess-self-play", checkChessSelfPlay],
  ["ort-runtime-build", checkOrtRuntimeBuild],
  ["draw-ink-survives-height-resize-400", checkDrawInkSurvivesHeightResize],
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
  ["stargaze-card-image", checkStargazeCardImage],
  ["stargaze-myth-image", checkStargazeMythImage],
  ["stargaze-keyboard-list", checkStargazeKeyboardList],
  ["stargaze-touch-400", checkStargazeTouch400],
  ["stargaze-affordances", checkStargazeAffordances],
  ["stargaze-browse-1440", checkStargazeBrowse],
  ["stargaze-browse-400", checkStargazeBrowse400],
  ["sky-iss", checkSkyIss],
  ["stargaze-doors", checkStargazeDoors],
  ["colophon", checkColophon],
  ["sky-invite", checkSkyInvite],
  ["stargaze-chrome", checkStargazeChrome],
  ["stargaze-secret-door", checkStargazeSecretDoor],
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
