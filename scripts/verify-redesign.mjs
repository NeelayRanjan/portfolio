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
 *   node scripts/verify-redesign.mjs desk wipe
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
/* 1. Desk field (components/manuscript/DeskField.tsx)                    */
/* ---------------------------------------------------------------------- */

/** The desk field is the sole direct-child canvas of <body> (see
 *  app/layout.tsx); every other canvas on the page (the wipe figure's mask,
 *  the draw demo's pixel grids) lives inside <main>. */
const DESK_CANVAS = "body > canvas";

async function deskFieldAnimatesAt1280(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 900 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const canvas = page.locator(DESK_CANVAS);
    await canvas.waitFor({ state: "attached", timeout: 10000 });
    // Gate confirmation: >=880px must show it.
    await page.waitForFunction(
      (sel) => getComputedStyle(document.querySelector(sel)).display !== "none",
      DESK_CANVAS,
      { timeout: 5000 },
    );
    const sample = () => canvas.evaluate((el) => el.toDataURL());
    const a = await sample();
    await page.waitForTimeout(500); // real elapsed time is the point of this assertion
    const b = await sample();
    if (a === b) throw new Error("two samples 500ms apart are byte-identical (field is not animating)");
    return `visible, samples differ (${a.length} vs ${b.length} chars)`;
  });
}

async function deskFieldStaticUnderReducedMotion(browser) {
  return withPage(
    browser,
    { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" },
    async (page) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      const canvas = page.locator(DESK_CANVAS);
      await canvas.waitFor({ state: "attached", timeout: 10000 });
      await page.waitForFunction(
        (sel) => getComputedStyle(document.querySelector(sel)).display !== "none",
        DESK_CANVAS,
        { timeout: 5000 },
      );
      const sample = () => canvas.evaluate((el) => el.toDataURL());
      const a = await sample();
      await page.waitForTimeout(500);
      const b = await sample();
      if (a !== b) throw new Error("reduced-motion field changed between two samples 500ms apart");
      return "visible, two samples 500ms apart are identical";
    },
  );
}

async function deskFieldAbsentAt500(browser) {
  return withPage(browser, { viewport: { width: 500, height: 800 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const canvas = page.locator(DESK_CANVAS);
    await canvas.waitFor({ state: "attached", timeout: 10000 });
    await page.waitForFunction(
      (sel) => getComputedStyle(document.querySelector(sel)).display === "none",
      DESK_CANVAS,
      { timeout: 5000 },
    );
    return "canvas present in DOM but display:none below the 880px gate";
  });
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
    // 400px is below lib/warm.ts's 768px idle-warm gate AND DeskField's 880px
    // gate, and no demo is in the initial viewport + DeferredMount's 200px
    // rootMargin at this width — so nothing heavy should be in flight yet.
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // catch anything an idle callback might still fire
    const heavy = urls.filter((u) => HEAVY_RE.test(u));
    if (heavy.length) throw new Error(`heavy request(s) before scroll: ${heavy.join(", ")}`);
    return `${urls.length} requests total, none model/trajectory-sized`;
  });
}

/* ---------------------------------------------------------------------- */
/* 4. Wipe endpoints differ (Figure 1, components/figures/WipeFigure.tsx) */
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

async function checkWipeEndpointsDiffer(browser) {
  return withPage(browser, { viewport: { width: 1280, height: 1400 } }, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    const slider = page.locator("#wipe-cut");
    await slider.waitFor({ state: "attached", timeout: 10000 });
    const figure = page.locator("figure").filter({ has: slider });
    const maskBox = figure.locator("div.relative.aspect-square").first();
    await maskBox.waitFor({ state: "visible", timeout: 10000 });

    await setRange(slider, 0);
    await page.waitForFunction(
      () => document.querySelector("#wipe-cut")?.value === "0",
      null,
      { timeout: 5000 },
    );
    const shotA = await maskBox.screenshot();

    await setRange(slider, 100);
    await page.waitForFunction(
      () => document.querySelector("#wipe-cut")?.value === "100",
      null,
      { timeout: 5000 },
    );
    const shotB = await maskBox.screenshot();

    if (Buffer.compare(shotA, shotB) === 0) {
      throw new Error("screenshots at cut=0 and cut=100 are byte-identical");
    }
    return `screenshots differ (${shotA.length}B vs ${shotB.length}B)`;
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
 */
const HEADSHOT_MAD_MAX = 20;

async function checkHeadshotSamplesPhoto(browser) {
  return withPage(browser, { viewport: { width: 400, height: 800 } }, async (page) => {
    const urls = [];
    page.on("request", (req) => urls.push(req.url()));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // catch an idle callback that might still fire

    // At rest the masthead is a plain <img>. The toy sits in first paint, so a
    // model fetch here would put ~24MB of runtime on the critical path.
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
    await face.scrollIntoViewIfNeeded();
    await face.click();

    // First press pulls onnxruntime-web + the 1.55MB int8 graph and then runs
    // 25 forward passes. Measured end to end here at ~15.5s; budget 5 minutes,
    // because headless Firefox is ~20x slower than a real browser (CLAUDE.md).
    await page.waitForFunction(
      () =>
        document
          .querySelector("#headshot-toy [role=status]")
          ?.textContent?.includes("sampled from noise"),
      null,
      { timeout: 300000 },
    );
    const readout = (await page.locator("#headshot-toy [role=status]").textContent()).trim();

    // A GET of one of the two graphs is what proves a model ran at all.
    if (!urls.some((u) => /\/headshot\/headshot(_int8)?\.onnx/.test(u))) {
      throw new Error("run completed without ever requesting a model file");
    }

    const { mad, controls } = await page.evaluate(async (cls) => {
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
      const target = await load(`/headshot/photos/${cls}.webp`);
      const controls = [];
      for (const i of [0, 1, 2].filter((i) => i !== cls)) {
        controls.push(meanAbs(sample, await load(`/headshot/photos/${i}.webp`)));
      }
      return { mad: meanAbs(sample, target), controls };
    }, cls);

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

    return `no model at rest; "${readout}"; MAD 32x32 own ${mad.toFixed(2)} (limit ${HEADSHOT_MAD_MAX}) vs others ${controls.map((c) => c.toFixed(2)).join(", ")}`;
  });
}

/* ---------------------------------------------------------------------- */
/* driver                                                                  */
/* ---------------------------------------------------------------------- */

const CHECKS = [
  ["desk-field-animates-1280", deskFieldAnimatesAt1280],
  ["desk-field-static-reduced-motion", deskFieldStaticUnderReducedMotion],
  ["desk-field-absent-500", deskFieldAbsentAt500],
  ["no-h-scroll-home-400", checkNoHorizontalScroll("/")],
  ["no-h-scroll-lab-400", checkNoHorizontalScroll("/lab")],
  ["no-early-heavy-payload-400", checkNoEarlyHeavyPayload],
  ["wipe-endpoints-differ", checkWipeEndpointsDiffer],
  ["flight-video-play-pause", checkFlightVideoPlayPause],
  ["draw-stroke-auto-label", checkDrawAutoLabel],
  ["chess-hint-g3", checkChessHint],
  ["jepa-seed-query-834", checkJepaSeedQuery834],
  ["jepa-triple-equality-mixed", checkJepaTripleEqualityOnMixedQuery],
  ["headshot-samples-photo", checkHeadshotSamplesPhoto],
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
