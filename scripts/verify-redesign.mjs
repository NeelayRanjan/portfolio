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
 *  app/layout.tsx); every other canvas on the page (the Dice CDF strip's
 *  masks, the draw demo's pixel grids) lives inside <main>. */
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

    return `no model at rest; "${readout}" matches the fetched ${graph}; ${steps1} steps, MAD own ${mad.toFixed(2)} vs others ${controls.map((c) => c.toFixed(2)).join(", ")}; 2nd press ("${readout2}") ran ${steps2} of ${steps1} steps, MAD own ${second.mad.toFixed(2)} vs ${second.controls.map((c) => c.toFixed(2)).join(", ")}`;
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
/* driver                                                                  */
/* ---------------------------------------------------------------------- */

const CHECKS = [
  ["desk-field-animates-1280", deskFieldAnimatesAt1280],
  ["desk-field-static-reduced-motion", deskFieldStaticUnderReducedMotion],
  ["desk-field-absent-500", deskFieldAbsentAt500],
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
