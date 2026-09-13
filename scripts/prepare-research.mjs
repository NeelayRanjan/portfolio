#!/usr/bin/env node
// scripts/prepare-research.mjs
//
// HAND-RUN ONLY. Never wire this to prebuild/predev: it shells out to ffmpeg
// and reads external_materials/, which is gitignored and doesn't exist in
// Vercel's build image.
//
// Derives the site's committed research assets (public/research/) from the
// owner's raw paper data (external_materials/, not committed). Run:
//
//   node scripts/prepare-research.mjs [--image <id>] [--accept-csv-drift]
//
// --image <id> overrides the auto-picked wipe image (see the printed top-5).
// --eff-image <id> overrides the auto-picked Figure 1 strip image likewise.
// --accept-csv-drift lets Figure 2's computed-vs-CSV gate through when a
//   (model, image) pair drifts past 0.15 Dice. Read the gate's comment before
//   reaching for it; it is not a convenience flag.
//
// What it does:
//   1. Extracts benchmarkDataset.tar.gz and predictions_cache.tar.gz to a
//      system temp dir (never into the repo).
//   2. Aggregates all_metrics_combined_long.csv by (model, fraction): mean/std
//      dice, labels = round(fraction * trainSize). Asserts the paper's
//      headline number (x0diffusion @ 16 labels, dice ~0.882) before writing
//      anything.
//   3. Picks the "wipe" comparison image: the image_index, among those with
//      cached masks for both x0diffusion and sam at frac0.05_fold1, with the
//      largest dice(x0) - dice(sam) at fraction 0.05.
//   4. Emits angiogram.webp, mask_x0.png, mask_sam.png (EXIF-stripped),
//      flight_lm_day.mp4 (copied), flight_poster.webp (frame 0, stripped).
//   5. Builds Figure 2's Dice CDF (the paper's fig_dice_cdf): the empirical
//      CDF of every per-image test Dice at the 16-label budget for
//      x0-diffusion, SAM and ResNet-UNet, plus one real test image per slider
//      stop with all three models' masks and Dice COMPUTED against the
//      benchmark ground truth for the exact bytes shipped. The curve's shape
//      is asserted against the paper's figure before anything is written.
//      ⚠️ The strip's masks come from external_materials/paper1/data/
//      test_predictions/ (the 2026-09-12 full re-export: every model, every
//      fraction, seed1_fold1, ALL 100 test images, from the SAME runs the CSV
//      records — its per_image_metrics.csv values equal the CSV's seed1/fold1
//      rows exactly). It arrives as test_pred.zip, which is BASE64-ENCODED
//      zip text: `base64 -d test_pred.zip > /tmp/tp.zip && unzip /tmp/tp.zip`
//      into paper1/data/. The old 10-image predictions_cache.tar.gz is still
//      read for the (retired, unrendered) wipe assets only.
//   5c. Builds Figure 1's strip: ONE test image with x0-diffusion's and
//      ResNet-UNet's masks at ALL THREE budgets (16/32/80), Dice computed
//      from the exact bytes, so the sweep's crossover is visible in pixels.
//      --eff-image <id> overrides the auto-pick.
//   6. Writes label_efficiency.json, cdf.json and provenance.json.
//      (label_efficiency.json is Figure 1, the label-efficiency sweep, since
//      2026-09-12; its `strip` block feeds the figure's mask panels. The wipe
//      assets from step 4 are written but unrendered since the sweep replaced
//      the wipe figure the same day; they stay real and current in case the
//      wipe returns.)

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTERNAL = path.join(ROOT, "external_materials");
const OUT_DIR = path.join(ROOT, "public", "research");
const TRAIN_SIZE = 320;

function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

function assertTool(cmd, installHint) {
  try {
    execSync(`${cmd} -version`, { stdio: "ignore" });
  } catch {
    fail(
      `"${cmd}" not found on PATH.\n${installHint}\nThen re-run: node scripts/prepare-research.mjs`,
    );
  }
}

function extractTarball(tarPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync("tar", ["-xzf", tarPath, "-C", destDir]);
}

// ---- tiny CSV parser (simple comma-separated, no quoted fields) ----
function parseCsv(text) {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = lines[0].split(",");
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const col of ["image_index", "dice", "model", "fraction", "seed", "fold"]) {
    if (!(col in idx)) fail(`CSV is missing expected column "${col}". Header: ${header.join(",")}`);
  }
  const rows = new Array(lines.length - 1);
  for (let i = 1; i < lines.length; i++) {
    // Plain split: no field in this export is ever quoted or itself contains a comma.
    const parts = lines[i].split(",");
    rows[i - 1] = {
      image_index: parseInt(parts[idx.image_index], 10),
      dice: parts[idx.dice] === "" ? NaN : parseFloat(parts[idx.dice]),
      model: parts[idx.model],
      fraction: parseFloat(parts[idx.fraction]),
      seed: parseInt(parts[idx.seed], 10),
      fold: parseInt(parts[idx.fold], 10),
    };
  }
  return rows;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function stddev(arr, m) {
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}
function round(n, d = 4) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/* ---------------------------------------------------------------------- */
/* Figure 2: mask geometry and Dice, computed with ffmpeg as the decoder   */
/* ---------------------------------------------------------------------- */

/** The paper's fig_dice_cdf models, in the paper's own order. */
const CDF_MODELS = ["x0diffusion", "sam", "resnet"];
/** The 16-label budget: the one the paper's CDF figure is drawn at. */
const CDF_FRACTION = 0.05;
/** Slider stops, in Dice. Nine, so the strip walks the whole axis. */
const CDF_STOPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
/** Whose per-image Dice decides which image a stop shows. See the pick below. */
const CDF_KEY_MODEL = "sam";
/** Points per curve after downsampling. Each one is a real (dice, share) pair
 *  out of the sorted rows, never an interpolation. */
const CDF_CURVE_POINTS = 200;
/**
 * The shape assertion, read off the paper's figure at its reference line:
 * share of predictions below 0.5 Dice. If a re-export lands outside these
 * bands the curve is no longer the paper's curve and nothing is written.
 */
const SHARE_BELOW_HALF_BANDS = {
  x0diffusion: [0, 0.02],
  sam: [0.04, 0.09],
  resnet: [0.11, 0.17],
};

function imageSize(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0",
    file,
  ]).toString().trim();
  const [w, h] = out.split(",").map((n) => parseInt(n, 10));
  if (!w || !h) fail(`ffprobe could not read dimensions from ${file}`);
  return { w, h };
}

/**
 * Decode a PNG to one byte per pixel (8-bit gray) through ffmpeg, optionally
 * NEAREST-NEIGHBOR resized to (w, h). No npm image decoder: ffmpeg is already
 * a hard dependency of this script, and `flags=neighbor` is the only resize
 * that can't invent intermediate values in a binary mask.
 */
function decodeGray(file, w, h) {
  const args = ["-v", "error", "-i", file];
  if (w && h) args.push("-vf", `scale=${w}:${h}:flags=neighbor`);
  args.push("-f", "rawvideo", "-pix_fmt", "gray", "-");
  return execFileSync("ffmpeg", args, { maxBuffer: 1 << 28 });
}

/** White fraction of a rectangular ring `inset` pixels in from the edge. */
function ringWhiteFrac(buf, w, h, inset) {
  const x0 = inset;
  const x1 = w - 1 - inset;
  const y0 = inset;
  const y1 = h - 1 - inset;
  if (x1 <= x0 || y1 <= y0) return 0.5;
  let white = 0;
  let total = 0;
  for (let x = x0; x <= x1; x++) {
    for (const y of [y0, y1]) {
      total++;
      if (buf[y * w + x] > 127) white++;
    }
  }
  for (let y = y0 + 1; y < y1; y++) {
    for (const x of [x0, x1]) {
      total++;
      if (buf[y * w + x] > 127) white++;
    }
  }
  return white / total;
}

function whiteFrac(buf) {
  let white = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] > 127) white++;
  return white / buf.length;
}

/** Ring inset: 2% of the short side, so a 1-3px frame artifact is skipped. */
function ringInset(w, h) {
  return Math.max(2, Math.round(0.02 * Math.min(w, h)));
}

/**
 * ⚠️ Polarity is DETECTED, it is NOT a convention these masks share, and the
 * detector is an INSET frame ring. Measured over this figure's 30 masks plus
 * the ground truths: the polarity flips per FILE, not per model or per budget.
 * SAM alone writes black-vessel-on-white for 5 of its 10 images and
 * white-vessel-on-black for the other 5, because a zero-shot segment is
 * sometimes the vessel and sometimes the region around it.
 *
 * Background always runs out to the frame and vessels essentially never do, so
 * the frame side is the background. Two earlier rules both broke here:
 *
 * - "The OUTERMOST ring is background" (the rule Figure 1 shipped with) reads
 *   0.687 white on ResNet-UNet's image 330, because that mask carries a 1-2px
 *   white frame artifact around a plainly white vessel tree. It scored the
 *   complement: Dice 0.012 where the vessel side gives 0.613 and the CSV says
 *   0.632. Insetting 2% of the short side (7px at 384, 4px at 224) skips the
 *   artifact and fixes both affected masks.
 * - "The vessel is the minority class" breaks on a failed prediction, which is
 *   exactly the mask a figure about failure has to render: ResNet-UNet at 16
 *   labels returns salt-and-pepper noise on 5 of these 10 images, 53-58% white,
 *   so the minority rule flips a coin on the panel whose job is showing the
 *   failure.
 *
 * So: decide from the inset ring when the ring is DECISIVE (< 0.35 or > 0.65),
 * and when it isn't, fall back to the polarity the rest of that model's masks
 * in this export use (`fallbackWhite`). The vote is computed from the decisive
 * masks only and is mask-only input: no ground truth is consulted anywhere in
 * this decision, because picking the polarity that scores better would be
 * picking the answer.
 *
 * The decision is RECORDED per mask in cdf.json and the client paints from the
 * record rather than re-deriving it, so the number under a panel and the pixels
 * in it cannot disagree.
 */
function detectVesselIsWhite(buf, w, h, fallbackWhite) {
  const f = ringWhiteFrac(buf, w, h, ringInset(w, h));
  if (f < 0.35) return { vesselIsWhite: true, ring: f, decisive: true };
  if (f > 0.65) return { vesselIsWhite: false, ring: f, decisive: true };
  return {
    vesselIsWhite: fallbackWhite === undefined ? whiteFrac(buf) < 0.5 : fallbackWhite,
    ring: f,
    decisive: false,
  };
}

function binarize(buf, vesselIsWhite) {
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = (vesselIsWhite ? buf[i] > 127 : buf[i] < 127) ? 1 : 0;
  }
  return out;
}

/** Dice = 2|A∩B| / (|A|+|B|), both binarized at 127. */
function diceOf(a, b) {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    sa += a[i];
    sb += b[i];
    if (a[i] && b[i]) inter++;
  }
  if (sa + sb === 0) return 0;
  return (2 * inter) / (sa + sb);
}

function main() {
  const args = process.argv.slice(2);
  const imageFlagIdx = args.indexOf("--image");
  const forcedImage = imageFlagIdx >= 0 ? parseInt(args[imageFlagIdx + 1], 10) : null;
  const effImageFlagIdx = args.indexOf("--eff-image");
  const forcedEffImage = effImageFlagIdx >= 0 ? parseInt(args[effImageFlagIdx + 1], 10) : null;
  const acceptCsvDrift = args.includes("--accept-csv-drift");

  assertTool("ffmpeg", "Install ffmpeg (e.g. `sudo dnf install ffmpeg`, `brew install ffmpeg`, `apt install ffmpeg`).");
  assertTool("ffprobe", "ffprobe ships with ffmpeg; reinstall ffmpeg if only ffprobe is missing.");
  try {
    execSync("tar --version", { stdio: "ignore" });
  } catch {
    fail("`tar` not found on PATH. Install it and re-run.");
  }

  const csvPath = path.join(EXTERNAL, "paper1/data/all_metrics_combined_long.csv");
  const benchTar = path.join(EXTERNAL, "paper1/data/benchmarkDataset.tar.gz");
  const predTar = path.join(EXTERNAL, "paper1/data/predictions_cache.tar.gz");
  const testPredDir = path.join(EXTERNAL, "paper1/data/test_predictions");
  const videoSrc = path.join(EXTERNAL, "nasa/flight_lm_day.mp4");

  for (const p of [csvPath, benchTar, predTar, videoSrc]) {
    if (!fs.existsSync(p)) {
      fail(
        `Missing input: ${p}\n` +
          "external_materials/ is gitignored raw material and must be present locally " +
          "before running this script.",
      );
    }
  }
  if (!fs.existsSync(testPredDir)) {
    fail(
      `Missing input: ${testPredDir}\n` +
        "It ships as paper1/data/test_pred.zip, which is BASE64-ENCODED zip text:\n" +
        "  base64 -d test_pred.zip > /tmp/tp.zip && unzip /tmp/tp.zip -d paper1/data/",
    );
  }

  console.log(`Reading ${path.relative(ROOT, csvPath)} ...`);
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  console.log(`  ${rows.length} rows`);

  // ---- Step 2: aggregate by (model, fraction) ----
  const groups = new Map(); // "model|fraction" -> dice[]
  for (const r of rows) {
    if (Number.isNaN(r.dice)) continue;
    const key = `${r.model}|${r.fraction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r.dice);
  }

  const modelsOut = {};
  for (const [key, dice] of groups) {
    const sep = key.lastIndexOf("|");
    const model = key.slice(0, sep);
    const fraction = parseFloat(key.slice(sep + 1));
    const m = mean(dice);
    const s = stddev(dice, m);
    const labels = Math.round(fraction * TRAIN_SIZE);
    if (!modelsOut[model]) modelsOut[model] = [];
    modelsOut[model].push({ fraction, labels, diceMean: round(m), diceStd: round(s), n: dice.length });
  }
  for (const model of Object.keys(modelsOut)) {
    modelsOut[model].sort((a, b) => a.fraction - b.fraction);
  }

  // ---- Assertions (fail fast, write nothing) ----
  const labels005 = Math.round(0.05 * TRAIN_SIZE);
  if (labels005 !== 16) {
    fail(`ASSERTION FAILED: round(0.05 * ${TRAIN_SIZE}) = ${labels005}, expected 16. Nothing written.`);
  }
  const x0005 = (modelsOut.x0diffusion || []).find((r) => r.fraction === 0.05);
  if (!x0005) {
    fail("ASSERTION FAILED: no x0diffusion rows at fraction 0.05 in the CSV. Nothing written.");
  }
  const diceDelta = Math.abs(x0005.diceMean - 0.882);
  if (diceDelta > 0.01) {
    fail(
      `ASSERTION FAILED: x0diffusion@0.05 diceMean = ${x0005.diceMean}, expected 0.882 +/- 0.01 ` +
        `(delta ${diceDelta.toFixed(4)}). Nothing written.`,
    );
  }
  console.log(
    `Assertions OK: labels(0.05)=${labels005}, x0diffusion@0.05 diceMean=${x0005.diceMean} ` +
      `(target 0.882, |delta|=${diceDelta.toFixed(4)})`,
  );

  // ---- Step 5a: Figure 2's CURVE, and its shape gate ----
  //
  // The empirical CDF of every per-image test Dice at the 16-label budget, one
  // curve per model, which is the paper's fig_dice_cdf. "Cumulative share of
  // predictions" pools every row at that fraction: all seeds, all folds, all
  // 100 test images (2500 rows per model).
  //
  // It runs HERE, before a single tarball is extracted or a single asset is
  // encoded, because it needs nothing but the CSV and it is the gate that says
  // the figure is still the paper's figure.
  //
  // ⚠️ THE CURVE IS THE 16-LABEL BUDGET ONLY, NOT EVERY FRACTION POOLED.
  // Measured: pooling 0.05/0.1/0.25 together puts ResNet-UNet's share below
  // 0.5 Dice at 4.85%, BELOW SAM's 5.44%, because ResNet recovers hard once it
  // sees 32+ labels (18.32% -> 0.24% -> 0.20%). That inverts the paper's
  // figure, where the dotted ResNet line sits well above the dashed SAM line at
  // the 0.5 reference. At fraction 0.05 alone the three land at 0.32% / 5.44% /
  // 13.52%, which is the published figure. The whole section's claim lives at
  // 16 labels, and so does this curve.
  const cdfLabels = Math.round(CDF_FRACTION * TRAIN_SIZE);
  const cdfRows = {};
  for (const r of rows) {
    if (r.fraction !== CDF_FRACTION || Number.isNaN(r.dice)) continue;
    if (!CDF_MODELS.includes(r.model)) continue;
    (cdfRows[r.model] = cdfRows[r.model] || []).push(r.dice);
  }
  for (const model of CDF_MODELS) {
    if (!cdfRows[model] || cdfRows[model].length === 0) {
      fail(`No ${model} rows at fraction ${CDF_FRACTION} in the CSV. Nothing written.`);
    }
    cdfRows[model].sort((a, b) => a - b);
  }

  /** Share of `sorted` strictly below `t`, by binary search. */
  const shareBelow = (sorted, t) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo / sorted.length;
  };

  const curves = {};
  for (const model of CDF_MODELS) {
    const sorted = cdfRows[model];
    const n = sorted.length;
    // Downsample by sampling the SORTED VALUES at even share intervals: every
    // point is a real (dice, share) pair out of the rows, never interpolated.
    const pts = [[0, 0]];
    const take = Math.min(CDF_CURVE_POINTS, n);
    for (let i = 0; i < take; i++) {
      const j = Math.round((i / (take - 1)) * (n - 1));
      pts.push([round(sorted[j]), round((j + 1) / n, 5)]);
    }
    curves[model] = pts;
  }

  const sharesBelowHalf = {};
  for (const model of CDF_MODELS) sharesBelowHalf[model] = round(shareBelow(cdfRows[model], 0.5), 5);

  console.log(
    `\nFigure 2 curve: per-image test Dice at fraction ${CDF_FRACTION} ` +
      `(${cdfLabels} labels), every seed and fold pooled`,
  );
  console.log("  model         rows  share below 0.5  band          verdict");
  const bandFailures = [];
  for (const model of CDF_MODELS) {
    const [lo, hi] = SHARE_BELOW_HALF_BANDS[model];
    const share = sharesBelowHalf[model];
    const ok = share >= lo && share <= hi;
    if (!ok) bandFailures.push(`${model}: ${(100 * share).toFixed(2)}% outside ${100 * lo}-${100 * hi}%`);
    console.log(
      `  ${model.padEnd(13)}${String(cdfRows[model].length).padStart(5)}  ` +
        `${(100 * share).toFixed(2).padStart(14)}%  ` +
        `${`${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}%`.padEnd(12)}  ${ok ? "ok" : "FAIL"}`,
    );
  }
  if (bandFailures.length > 0) {
    fail(
      "ASSERTION FAILED: the CDF no longer has the paper's shape at the 0.5 reference:\n  " +
        bandFailures.join("\n  ") +
        "\n\nThese bands are read off external_materials/paper1/img/fig_dice_cdf.pdf. " +
        "Check the fraction, the model names and the pooling before widening them. " +
        "Nothing written.",
    );
  }

  // ---- Step 1: extract tarballs (system temp dir, never the repo) ----
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-research-"));
  console.log(`\nExtracting tarballs to ${tmpRoot} ...`);
  const benchDir = path.join(tmpRoot, "bench");
  const predDir = path.join(tmpRoot, "pred");
  extractTarball(benchTar, benchDir);
  extractTarball(predTar, predDir);

  const imagesDir = path.join(benchDir, "benchmarkDataset", "images");
  const x0Dir = path.join(predDir, "predictions_cache", "x0diffusion", "frac0.05_fold1");
  const samDir = path.join(predDir, "predictions_cache", "sam", "frac0.05_fold1");

  if (!fs.existsSync(imagesDir)) fail(`Expected image dir not found: ${imagesDir}`);
  if (!fs.existsSync(x0Dir) || !fs.existsSync(samDir)) {
    fail(
      `Expected prediction dirs not found:\n  ${x0Dir}\n  ${samDir}\n` +
        "predictions_cache.tar.gz's layout may have changed; inspect it by hand.",
    );
  }

  // ---- Step 3: pick the wipe image ----
  const x0Ids = new Set(
    fs.readdirSync(x0Dir).filter((f) => f.endsWith(".png")).map((f) => parseInt(f, 10)),
  );
  const samIds = new Set(
    fs.readdirSync(samDir).filter((f) => f.endsWith(".png")).map((f) => parseInt(f, 10)),
  );
  const candidateIds = [...x0Ids].filter((id) => samIds.has(id));
  if (candidateIds.length === 0) {
    fail("No image_index has cached masks for both x0diffusion and sam at frac0.05_fold1.");
  }

  // Ranking must be computed from fold1 rows only: the cached masks we
  // actually display come from frac0.05_fold1, and averaging in other folds'
  // CSV rows would rank images by a number that doesn't match what's shown.
  //
  // ⚠️ LEGACY, KNOWN-WRONG JOIN, kept only because the wipe is RETIRED: this
  // matches old-cache FILENAMES (image-id space) against the long CSV's
  // image_index (a different space — see the bridge comment in step 5b). The
  // ranking numbers are therefore some other image's stats; the wipe's
  // shipped caption never used them (its Dice pair was computed from the
  // pixels), and the overlay itself pairs mask and angiogram by filename, so
  // what the owner approved on screen was correctly paired. If the wipe ever
  // returns, re-rank through per_image_metrics.csv's mapping first.
  const diceByModelImage = new Map(); // "model|id" -> dice[]
  for (const r of rows) {
    if (r.fraction !== 0.05) continue;
    if (r.fold !== 1) continue;
    if (r.model !== "x0diffusion" && r.model !== "sam") continue;
    if (!candidateIds.includes(r.image_index)) continue;
    if (Number.isNaN(r.dice)) continue;
    const key = `${r.model}|${r.image_index}`;
    if (!diceByModelImage.has(key)) diceByModelImage.set(key, []);
    diceByModelImage.get(key).push(r.dice);
  }

  const usableIds = candidateIds.filter((id) => {
    const x0arr = diceByModelImage.get(`x0diffusion|${id}`) || [];
    const samarr = diceByModelImage.get(`sam|${id}`) || [];
    return x0arr.length > 0 && samarr.length > 0;
  });
  if (usableIds.length === 0) {
    fail("No candidate image has fold1 CSV rows for both x0diffusion and sam at fraction 0.05.");
  }

  const ranked = usableIds
    .map((id) => {
      const x0arr = diceByModelImage.get(`x0diffusion|${id}`) || [];
      const samarr = diceByModelImage.get(`sam|${id}`) || [];
      const x0dice = round(mean(x0arr));
      const samdice = round(mean(samarr));
      return { id, x0dice, samdice, diff: round(x0dice - samdice) };
    })
    .sort((a, b) => b.diff - a.diff);

  console.log("\nTop 5 wipe-image candidates (dice(x0) - dice(sam) @ fraction 0.05, fold1 rows only):");
  for (const c of ranked.slice(0, 5)) {
    const sign = c.diff >= 0 ? "+" : "";
    console.log(`  id=${c.id}\tx0=${c.x0dice}\tsam=${c.samdice}\tdiff=${sign}${c.diff}`);
  }

  const chosen = forcedImage !== null ? ranked.find((c) => c.id === forcedImage) : ranked[0];
  if (!chosen) {
    fail(`--image ${forcedImage} is not a valid candidate. Choose one of: ${ranked.map((c) => c.id).join(", ")}`);
  }
  console.log(
    `\nChosen image: id=${chosen.id} (x0=${chosen.x0dice}, sam=${chosen.samdice}, diff=${chosen.diff})` +
      (forcedImage !== null ? " [forced via --image]" : " [top ranked]"),
  );

  // ---- Step 4: emit assets ----
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const srcImage = path.join(imagesDir, `${chosen.id}.jpg`);
  const srcMaskX0 = path.join(x0Dir, `${chosen.id}.png`);
  const srcMaskSam = path.join(samDir, `${chosen.id}.png`);
  for (const p of [srcImage, srcMaskX0, srcMaskSam]) {
    if (!fs.existsSync(p)) fail(`Missing expected extracted file: ${p}`);
  }

  console.log("\nEncoding assets (ffmpeg, -map_metadata -1 on every image)...");

  const angiogramOut = path.join(OUT_DIR, "angiogram.webp");
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", srcImage,
    "-map_metadata", "-1",
    "-q:v", "80",
    angiogramOut,
  ]);

  const maskX0Out = path.join(OUT_DIR, "mask_x0.png");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", srcMaskX0, "-map_metadata", "-1", maskX0Out]);

  const maskSamOut = path.join(OUT_DIR, "mask_sam.png");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", srcMaskSam, "-map_metadata", "-1", maskSamOut]);

  const videoOut = path.join(OUT_DIR, "flight_lm_day.mp4");
  fs.copyFileSync(videoSrc, videoOut);

  const posterOut = path.join(OUT_DIR, "flight_poster.webp");
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", videoSrc,
    "-frames:v", "1",
    "-map_metadata", "-1",
    posterOut,
  ]);

  console.log("\nOutput sizes:");
  const emitted = [
    ["angiogram.webp", angiogramOut],
    ["mask_x0.png", maskX0Out],
    ["mask_sam.png", maskSamOut],
    ["flight_lm_day.mp4", videoOut],
    ["flight_poster.webp", posterOut],
  ];
  for (const [label, p] of emitted) {
    const { size } = fs.statSync(p);
    console.log(`  ${label.padEnd(20)} ${(size / 1024).toFixed(1)} KB`);
  }

  // ---- Step 5b: Figure 2's STRIP ----
  //
  // One real test image per slider stop with all three models' masks, Dice
  // COMPUTED against the benchmark ground truth from the exact PNG bytes
  // shipped.
  //
  // Source (since 2026-09-12): test_predictions/, the full re-export — the
  // SAME runs the CSV records (seed 1, fold 1), all 100 test images. That
  // retires the old 10-image cache's two limits at once: stops can land on
  // genuinely hard images (the old floor was SAM 0.666), and the computed
  // Dice agrees with the CSV's seed1/fold1 rows instead of describing a
  // different export. The cursor is still a THRESHOLD (nearest-with-dedupe
  // picks the closest real image, and each panel prints its own computed
  // number), but nearest over 100 is close, not rank-order-only.
  const gtFor = (id) => path.join(benchDir, "benchmarkDataset", "masks", `${id}.png`);
  const testMaskDir = (model, fraction) =>
    path.join(testPredDir, model, `frac${fraction}`, "seed1_fold1", "masks");

  // -- the strip: one image per stop --
  const cdfCandidates = (() => {
    const sets = CDF_MODELS.map((model) => {
      const dir = testMaskDir(model, CDF_FRACTION);
      if (!fs.existsSync(dir)) fail(`Prediction dir not found: ${dir}`);
      return new Set(
        fs.readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => parseInt(f, 10)),
      );
    });
    return [...sets[0]]
      .filter((id) => sets.every((s) => s.has(id)))
      .filter((id) => fs.existsSync(gtFor(id)))
      .filter((id) => fs.existsSync(path.join(imagesDir, `${id}.jpg`)))
      .sort((a, b) => a - b);
  })();
  if (cdfCandidates.length < CDF_STOPS.length) {
    fail(
      `Only ${cdfCandidates.length} image(s) have masks for all of ${CDF_MODELS.join(", ")} at ` +
        `${cdfFracDir} plus a ground truth and a source jpg; need ${CDF_STOPS.length} for the ` +
        "slider's stops. Nothing written.",
    );
  }

  const cdfStage = path.join(tmpRoot, "cdf");
  fs.mkdirSync(cdfStage, { recursive: true });

  // Stage every candidate mask first, then decide polarity per model (the
  // fallback vote needs the whole set), then compute Dice from the staged
  // bytes. Nothing reaches public/ until the gates below pass.
  const staged = new Map(); // "model|id" -> { file, w, h, buf }
  for (const model of CDF_MODELS) {
    for (const id of cdfCandidates) {
      const src = path.join(testMaskDir(model, CDF_FRACTION), `${id}.png`);
      const dest = path.join(cdfStage, `${model}_${id}.png`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-map_metadata", "-1", dest]);
      const { w, h } = imageSize(dest);
      const buf = decodeGray(dest);
      if (buf.length !== w * h) {
        fail(`Decoded ${dest} to ${buf.length} bytes, expected ${w * h}. Nothing written.`);
      }
      staged.set(`${model}|${id}`, { file: dest, w, h, buf });
    }
  }

  // Per-model polarity vote over the masks whose inset ring is decisive. See
  // detectVesselIsWhite: mask-only input, no ground truth.
  const polarityVote = {};
  for (const model of CDF_MODELS) {
    let white = 0;
    let black = 0;
    for (const id of cdfCandidates) {
      const s = staged.get(`${model}|${id}`);
      const d = detectVesselIsWhite(s.buf, s.w, s.h);
      if (!d.decisive) continue;
      if (d.vesselIsWhite) white++;
      else black++;
    }
    polarityVote[model] = white === black ? undefined : white > black;
  }

  // Ground truth, decoded once per (image, size) and binarized by the same
  // detector. Nearest-neighbor resize of the GROUND TRUTH onto the mask's grid,
  // never the other way: upsampling a prediction would invent vessel the model
  // never predicted.
  const gtCache = new Map();
  const groundTruth = (id, w, h) => {
    const key = `${id}|${w}x${h}`;
    if (!gtCache.has(key)) {
      const p = gtFor(id);
      const size = imageSize(p);
      const resized = size.w !== w || size.h !== h;
      const buf = resized ? decodeGray(p, w, h) : decodeGray(p);
      if (buf.length !== w * h) {
        fail(`Ground truth ${p} decoded to ${buf.length} bytes, expected ${w * h}. Nothing written.`);
      }
      const d = detectVesselIsWhite(buf, w, h);
      gtCache.set(key, { mask: binarize(buf, d.vesselIsWhite), resized, native: size });
    }
    return gtCache.get(key);
  };

  // Cross-check values, joined through the export's own mapping.
  //
  // ⚠️ THE LONG CSV'S image_index IS NOT THE IMAGE ID. They are two disjoint
  // numbering spaces (0 of 100 coincide) that COLLIDE on 13 of 100 values —
  // discovered 2026-09-12 when mask id 5 cross-joined to CSV index 5 and
  // tripped the drift gate with someone else's numbers. Mask filenames,
  // benchmark files and the ground truth are ID space; the long CSV is INDEX
  // space; per_image_metrics.csv in each run dir carries the (image_index,
  // image_id, dice_recorded) triples that bridge them. Every CSV join below
  // goes through that bridge, and each load asserts dice_recorded equals the
  // long CSV's seed1/fold1 row on ALL 100 images, which validates the
  // mapping and the export in one move. (This same cross-space join is also
  // what produced 2026-09-12's earlier "the cache is a separate export"
  // diagnosis against the OLD 10-image cache: x0's and SAM's tight per-image
  // spreads made a wrong join look like agreement and ResNet's wide spread
  // made the same wrong join look like drift. The old cache's masks were
  // never proven mismatched; its figure is retired either way.)
  const longSeed1Fold1 = new Map(); // "model|fraction|index" -> dice
  for (const r of rows) {
    if (r.seed !== 1 || r.fold !== 1 || Number.isNaN(r.dice)) continue;
    longSeed1Fold1.set(`${r.model}|${r.fraction}|${r.image_index}`, r.dice);
  }
  const perImageMetricsCache = new Map();
  /** image_id -> the long CSV's seed1/fold1 dice for (model, fraction). */
  const recordedById = (model, fraction) => {
    const key = `${model}|${fraction}`;
    if (!perImageMetricsCache.has(key)) {
      const file = path.join(
        testPredDir, model, `frac${fraction}`, "seed1_fold1", "per_image_metrics.csv",
      );
      const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
      const col = Object.fromEntries(lines[0].split(",").map((h, i) => [h, i]));
      for (const need of ["image_index", "image_id", "dice_recorded"]) {
        if (!(need in col)) fail(`${file} is missing column "${need}".`);
      }
      const map = new Map();
      for (const line of lines.slice(1)) {
        const parts = line.split(",");
        const index = parseInt(parts[col.image_index], 10);
        const id = parseInt(parts[col.image_id], 10);
        const recorded = parseFloat(parts[col.dice_recorded]);
        const long = longSeed1Fold1.get(`${model}|${fraction}|${index}`);
        if (long === undefined || Math.abs(long - recorded) > 1e-9) {
          fail(
            `${file}: image_index ${index} (image_id ${id}) records dice ${recorded} but the long ` +
              `CSV's seed1/fold1 row says ${long}. The export and the CSV no longer describe the ` +
              "same runs. Nothing written.",
          );
        }
        map.set(id, recorded);
      }
      perImageMetricsCache.set(key, map);
    }
    return perImageMetricsCache.get(key);
  };

  const perImage = new Map(); // id -> { model -> entry }
  for (const id of cdfCandidates) {
    const byModel = {};
    for (const model of CDF_MODELS) {
      const s = staged.get(`${model}|${id}`);
      const d = detectVesselIsWhite(s.buf, s.w, s.h, polarityVote[model]);
      const gt = groundTruth(id, s.w, s.h);
      const dice = diceOf(binarize(s.buf, d.vesselIsWhite), gt.mask);
      const rec = recordedById(model, CDF_FRACTION).get(id);
      const csvDice = rec === undefined ? null : round(rec);
      byModel[model] = {
        model,
        dice: round(dice),
        csvDice,
        csvSeeds: rec === undefined ? 0 : 1,
        delta: csvDice === null ? null : round(Math.abs(dice - csvDice)),
        vesselIsWhite: d.vesselIsWhite,
        ring: round(d.ring, 3),
        ringDecisive: d.decisive,
        maskWidth: s.w,
        maskHeight: s.h,
        gtResized: gt.resized,
        stagedFile: s.file,
      };
    }
    perImage.set(id, byModel);
  }

  // Greedy nearest-with-dedupe on SAM's computed Dice, stop by stop. SAM is
  // the key because the slider's axis is the one the caption reads in SAM's
  // terms (it was originally chosen because the OLD cache's SAM masks were
  // the only ones agreeing with the CSV; the new export agrees across the
  // board, and the key stays SAM so the stops don't reshuffle by accident).
  const remaining = new Set(cdfCandidates);
  const stops = [];
  for (const t of CDF_STOPS) {
    let best = null;
    for (const id of remaining) {
      const d = Math.abs(perImage.get(id)[CDF_KEY_MODEL].dice - t);
      if (best === null || d < best.d || (d === best.d && id < best.id)) best = { id, d };
    }
    remaining.delete(best.id);
    stops.push({ t, id: best.id });
  }

  console.log(
    `\nFigure 2 strip: ${cdfCandidates.length} cached images at frac${CDF_FRACTION} seed1_fold1, ` +
      `SAM Dice ${Math.min(...cdfCandidates.map((id) => perImage.get(id).sam.dice)).toFixed(3)}` +
      `-${Math.max(...cdfCandidates.map((id) => perImage.get(id).sam.dice)).toFixed(3)}; ` +
      `nearest-with-dedupe over ${CDF_STOPS.length} stops`,
  );
  console.log(
    "  stop  image  " +
      CDF_MODELS.map((m) => m.slice(0, 11).padStart(12)).join("") +
      "   csv delta (x0/sam/resnet)      mask   polarity",
  );
  let anyDrift = false;
  for (const s of stops) {
    const byModel = perImage.get(s.id);
    for (const model of CDF_MODELS) {
      const e = byModel[model];
      if (e.delta !== null && e.delta > 0.15) anyDrift = true;
    }
    const first = byModel[CDF_MODELS[0]];
    console.log(
      `  ${s.t.toFixed(1)}   ${String(s.id).padEnd(6)} ` +
        CDF_MODELS.map((m) => byModel[m].dice.toFixed(4).padStart(12)).join("") +
        "   " +
        CDF_MODELS.map((m) => (byModel[m].delta === null ? "-" : byModel[m].delta.toFixed(3))).join(
          "/",
        ).padEnd(22) +
        `  ${first.maskWidth}px  ` +
        CDF_MODELS.map(
          (m) => `${m.slice(0, 3)}:${byModel[m].vesselIsWhite ? "w" : "b"}${byModel[m].ringDecisive ? "" : "*"}`,
        ).join(" "),
    );
  }
  console.log(
    "  polarity: w = white vessel, b = black vessel, * = ring undecided, took the model's vote " +
      `(${CDF_MODELS.map((m) => `${m}:${polarityVote[m] === undefined ? "split" : polarityVote[m] ? "white" : "black"}`).join(", ")})`,
  );

  // The drift gate. Its job is catching a BROKEN pipeline: a wrong polarity, a
  // misaligned ground truth, a join that isn't the id-index bridge above.
  //
  // ⚠️ WITH THE 2026-09-12 test_predictions EXPORT, --accept-csv-drift IS
  // STILL REQUIRED, AND ONLY FOR SAM (root-caused, 2026-09-12): the export is
  // a RE-RUN of the recorded seed1/fold1 runs, and SAM's inference is
  // stochastic — the long CSV itself scores the same image differently under
  // different seeds (image id 155: 0.196 vs 0.475), so SAM's re-exported mask
  // is a fresh draw that lands anywhere in that spread (measured here:
  // |computed - recorded| up to 0.46 on hard images, 0.01-0.04 on easy ones).
  // The deterministic trained models reproduce their recorded rows from raw
  // pixels: ResNet-UNet at delta 0.000 on every stop, x0-diffusion within
  // 0.02 — which is also the proof the decode, the polarity and the GT resize
  // are right. The SAM panels are therefore REAL SAM output on the same
  // angiograms with an honestly computed score, just not the CSV row's exact
  // draw, and the figure's copy says so. Two other oddities of the export,
  // noted, not blocking: run_metadata.json's own "dice_mean" is garbage
  // (~0.05; its scorer read the wrong side — trust dice_recorded), and
  // ε-diffusion's binary masks score far ABOVE its recorded ~0.23
  // (unexplained; ε-diffusion is never displayed, only its CSV aggregate is).
  if (anyDrift && !acceptCsvDrift) {
    const drifted = [];
    for (const s of stops) {
      const byModel = perImage.get(s.id);
      for (const model of CDF_MODELS) {
        const e = byModel[model];
        if (e.delta !== null && e.delta > 0.15) {
          drifted.push(`${model}@image ${s.id}: computed ${e.dice} vs csv ${e.csvDice} (Δ ${e.delta})`);
        }
      }
    }
    fail(
      "ASSERTION FAILED: Figure 2's computed Dice drifts past 0.15 from the CSV for:\n  " +
        drifted.join("\n  ") +
        "\n\nIf this is the known cache-vs-CSV mismatch, re-run with --accept-csv-drift. " +
        "If it is new, check polarity, the ground-truth resize and the image id FIRST. " +
        "Nothing written.",
    );
  }
  if (anyDrift) {
    console.log(
      "\n  --accept-csv-drift: shipping the COMPUTED numbers. They describe the pixels\n" +
        "  on screen; the CSV cell describes the recorded run, which for a stochastic\n" +
        "  model (SAM) is a different draw than the re-exported mask.",
    );
  }

  // Gates passed: write the stop assets.
  const cdfDir = path.join(OUT_DIR, "cdf");
  fs.rmSync(cdfDir, { recursive: true, force: true });
  fs.mkdirSync(cdfDir, { recursive: true });
  let cdfBytes = 0;
  const stopsOut = [];
  for (const s of stops) {
    const tag = String(Math.round(s.t * 100)).padStart(2, "0");
    const byModel = perImage.get(s.id);

    // The angiogram, squashed to the mask's square on the way out. The
    // prediction pipeline squashed its input (verified in the previous pass:
    // squash beats center-crop and aspect-pad by a wide margin against these
    // masks), so the SQUASHED frame is the one the masks are registered to.
    // Ship it that way and the overlay lands on the vessels with no CSS
    // object-fit to get wrong.
    const angioFile = `cdf/a${tag}.webp`;
    const side = byModel[CDF_MODELS[0]].maskWidth;
    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      "-i", path.join(imagesDir, `${s.id}.jpg`),
      "-vf", `scale=${side}:${side}`,
      "-map_metadata", "-1",
      "-q:v", "80",
      path.join(OUT_DIR, angioFile),
    ]);
    cdfBytes += fs.statSync(path.join(OUT_DIR, angioFile)).size;

    const masksOut = {};
    for (const model of CDF_MODELS) {
      const e = byModel[model];
      const file = `cdf/${model}_${tag}.png`;
      fs.copyFileSync(e.stagedFile, path.join(OUT_DIR, file));
      cdfBytes += fs.statSync(path.join(OUT_DIR, file)).size;
      masksOut[model] = {
        file,
        dice: e.dice,
        vesselIsWhite: e.vesselIsWhite,
        width: e.maskWidth,
        height: e.maskHeight,
      };
    }

    const shares = {};
    for (const model of CDF_MODELS) shares[model] = round(shareBelow(cdfRows[model], s.t), 5);

    stopsOut.push({ t: s.t, image: s.id, angio: angioFile, shares, masks: masksOut });
  }
  console.log(
    `\n  ${stopsOut.length} stops: ${stopsOut.length} angiograms + ` +
      `${stopsOut.length * CDF_MODELS.length} masks, ${(cdfBytes / 1024).toFixed(1)} KB total`,
  );

  const cdf = {
    version: 1,
    fraction: CDF_FRACTION,
    labels: cdfLabels,
    seed: 1,
    fold: 1,
    models: CDF_MODELS,
    rowsPerModel: cdfRows[CDF_MODELS[0]].length,
    curves,
    sharesBelowHalf,
    stops: stopsOut,
  };
  fs.writeFileSync(path.join(OUT_DIR, "cdf.json"), JSON.stringify(cdf, null, 2) + "\n");

  // ---- Step 5c: Figure 1's STRIP ----
  //
  // One test image, Figure 2's trio of models at ALL THREE budgets, so the
  // sweep's crossover is visible in pixels while the slider moves:
  // x0-diffusion (the line that starts high and stays there), SAM (zero-shot
  // — its one mask never changes with the budget, which IS its story) and
  // ResNet-UNet (the baseline the computed gap sentence names at 80 labels).
  // SAM joined 2026-09-13 at the owner's ask; its re-exported masks are
  // byte-identical across the fractions (run once, copied), so the emit
  // below dedupes by pixel content and every budget references one file.
  //
  // The image is RANKED FROM THE CSV (seed1/fold1, the rows describing these
  // exact masks), then the shipped panels' Dice is computed from the staged
  // bytes and gated against those same rows — the pick and the proof are two
  // separate steps on purpose. Rule: among images with every needed mask,
  // require x0's worst budget ≥ 0.85 (its flatness IS its story) AND x0 ahead
  // of SAM at the smallest budget by ≥ EFF_SAM_MARGIN (owner call,
  // 2026-09-13: the strip's 16-label frame must show x0 winning; the first
  // pick, image 114, had SAM a hair ahead), then take the largest ResNet gain
  // from the smallest budget to the largest.
  //
  // ⚠️ The margin is not decoration: SAM's panel is a stochastic re-draw
  // whose computed Dice moves a few points off its recorded row, so a
  // paper-thin recorded lead can invert on screen. 0.03 held for image 333
  // (recorded lead 0.041 → computed lead survived); if the computed gate
  // below ever fails, raise the margin rather than hand-picking by score.
  const EFF_MODELS = ["x0diffusion", "sam", "resnet"];
  const EFF_SAM_MARGIN = 0.03;
  const EFF_FRACTIONS = (modelsOut.x0diffusion || []).map((r) => r.fraction);
  if (EFF_FRACTIONS.length < 2) fail("Fewer than 2 fractions in the CSV; the strip needs a sweep.");

  const effCandidates = (() => {
    const sets = [];
    for (const model of EFF_MODELS) {
      for (const f of EFF_FRACTIONS) {
        const dir = testMaskDir(model, f);
        if (!fs.existsSync(dir)) fail(`Prediction dir not found: ${dir}`);
        sets.push(
          new Set(fs.readdirSync(dir).filter((x) => x.endsWith(".png")).map((x) => parseInt(x, 10))),
        );
      }
    }
    return [...sets[0]]
      .filter((id) => sets.every((s) => s.has(id)))
      .filter((id) => fs.existsSync(gtFor(id)))
      .filter((id) => fs.existsSync(path.join(imagesDir, `${id}.jpg`)))
      .sort((a, b) => a - b);
  })();
  if (effCandidates.length === 0) fail("No image has every mask the Figure 1 strip needs.");

  const fLo = EFF_FRACTIONS[0];
  const fHi = EFF_FRACTIONS[EFF_FRACTIONS.length - 1];
  // recordedById is the id-keyed bridge to the CSV's seed1/fold1 rows — see
  // the index-vs-id warning above; never join the long CSV by filename here.
  const effRanked = effCandidates
    .map((id) => {
      const x0 = EFF_FRACTIONS.map((f) => recordedById("x0diffusion", f).get(id));
      const sLo = recordedById("sam", fLo).get(id);
      const rLo = recordedById("resnet", fLo).get(id);
      const rHi = recordedById("resnet", fHi).get(id);
      if (x0.some((v) => v === undefined) || sLo === undefined || rLo === undefined || rHi === undefined) return null;
      return {
        id,
        x0Min: round(Math.min(...x0)),
        x0Lo: round(x0[0]),
        samLo: round(sLo),
        resnetLo: round(rLo),
        resnetHi: round(rHi),
        gain: round(rHi - rLo),
      };
    })
    .filter((c) => c !== null && c.x0Min >= 0.85 && c.x0Lo >= c.samLo + EFF_SAM_MARGIN)
    .sort((a, b) => b.gain - a.gain || a.id - b.id);
  if (effRanked.length === 0) {
    fail(
      `No Figure 1 strip candidate passes x0Min >= 0.85 AND x0@lo >= sam@lo + ${EFF_SAM_MARGIN}; ` +
        "loosen a rule by hand if the export changed.",
    );
  }

  console.log(
    `\nTop 5 Figure 1 strip candidates (ResNet gain lo->hi budget; x0 min >= 0.85; ` +
      `x0 >= sam + ${EFF_SAM_MARGIN} at ${Math.round(fLo * TRAIN_SIZE)} labels; seed1/fold1 CSV):`,
  );
  for (const c of effRanked.slice(0, 5)) {
    console.log(
      `  id=${c.id}\tx0min=${c.x0Min}\tx0@lo=${c.x0Lo} vs sam ${c.samLo}\tresnet ${c.resnetLo} -> ${c.resnetHi}\tgain=+${c.gain}`,
    );
  }
  const chosenEff =
    forcedEffImage !== null ? effRanked.find((c) => c.id === forcedEffImage) : effRanked[0];
  if (!chosenEff) {
    fail(`--eff-image ${forcedEffImage} is not a valid candidate. Choose one of: ${effRanked.map((c) => c.id).join(", ")}`);
  }
  console.log(
    `\nChosen strip image: id=${chosenEff.id} (x0 min ${chosenEff.x0Min}, ResNet ${chosenEff.resnetLo} -> ${chosenEff.resnetHi})` +
      (forcedEffImage !== null ? " [forced via --eff-image]" : " [top ranked]"),
  );

  // Stage, detect polarity (fallback: the model's Figure-2 vote), compute Dice
  // from the staged bytes, gate against the CSV row for these exact runs.
  const effPanels = new Map(); // "model|fraction" -> entry
  const effDrifted = [];
  for (const model of EFF_MODELS) {
    for (const f of EFF_FRACTIONS) {
      const src = path.join(testMaskDir(model, f), `${chosenEff.id}.png`);
      const dest = path.join(cdfStage, `eff_${model}_${f}.png`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-map_metadata", "-1", dest]);
      const { w, h } = imageSize(dest);
      const buf = decodeGray(dest);
      if (buf.length !== w * h) fail(`Decoded ${dest} to ${buf.length} bytes, expected ${w * h}.`);
      const d = detectVesselIsWhite(buf, w, h, polarityVote[model]);
      const gt = groundTruth(chosenEff.id, w, h);
      const dice = round(diceOf(binarize(buf, d.vesselIsWhite), gt.mask));
      const csvDice = recordedById(model, f).get(chosenEff.id);
      if (csvDice === undefined) fail(`No seed1/fold1 record for ${model}@frac${f} image ${chosenEff.id}.`);
      const delta = round(Math.abs(dice - csvDice));
      if (delta > 0.15) {
        effDrifted.push(`${model}@frac${f}: computed ${dice} vs csv ${csvDice} (Δ ${delta})`);
      }
      effPanels.set(`${model}|${f}`, {
        stagedFile: dest,
        buf, // kept for the content dedupe at emit time (SAM repeats)
        dice,
        csvDice: round(csvDice),
        delta,
        vesselIsWhite: d.vesselIsWhite,
        ring: round(d.ring, 3),
        ringDecisive: d.decisive,
        width: w,
        height: h,
        gtResized: gt.resized,
      });
    }
  }
  // The reason the margin exists: the DISPLAYED numbers must show x0 ahead of
  // SAM at the smallest budget (the owner's ask), and the displayed numbers
  // are computed, not recorded. Hard gate, not flag-bypassable.
  const x0LoComputed = effPanels.get(`x0diffusion|${fLo}`).dice;
  const samLoComputed = effPanels.get(`sam|${fLo}`).dice;
  if (x0LoComputed <= samLoComputed) {
    fail(
      `ASSERTION FAILED: computed strip Dice at the smallest budget has SAM (${samLoComputed}) ` +
        `at or above x0-diffusion (${x0LoComputed}) on image ${chosenEff.id}. SAM's stochastic ` +
        `re-draw ate the recorded margin; raise EFF_SAM_MARGIN or pick another candidate with ` +
        "--eff-image. Nothing written.",
    );
  }

  const effSides = new Set([...effPanels.values()].flatMap((e) => [e.width, e.height]));
  if (effSides.size !== 1) {
    fail(`Figure 1 strip masks disagree on size (${[...effSides].join(", ")}); the shared angiogram square needs one.`);
  }
  const effSide = [...effSides][0];

  console.log("\nFigure 1 strip panels (computed from staged bytes vs csv seed1/fold1):");
  for (const model of EFF_MODELS) {
    for (const f of EFF_FRACTIONS) {
      const e = effPanels.get(`${model}|${f}`);
      console.log(
        `  ${model.padEnd(12)} frac${String(f).padEnd(5)} dice=${e.dice.toFixed(4)} ` +
          `csv=${e.csvDice.toFixed(4)} Δ=${e.delta.toFixed(3)} ` +
          `${e.vesselIsWhite ? "white" : "black"}-vessel${e.ringDecisive ? "" : " (vote)"}`,
      );
    }
  }
  if (effDrifted.length > 0 && !acceptCsvDrift) {
    fail(
      "ASSERTION FAILED: Figure 1 strip Dice drifts past 0.15 from the seed1/fold1 CSV rows:\n  " +
        effDrifted.join("\n  ") +
        "\n\nFor the deterministic models these masks ARE those runs, so that is a pipeline " +
        "bug until proven otherwise (check polarity, the GT resize, the image id). SAM is the " +
        "known stochastic exception — see the drift bullet above — and --accept-csv-drift is " +
        "how a human says the table was read. Nothing written.",
    );
  }

  const effDir = path.join(OUT_DIR, "eff");
  fs.rmSync(effDir, { recursive: true, force: true });
  fs.mkdirSync(effDir, { recursive: true });
  let effBytes = 0;
  const effAngio = `eff/a${chosenEff.id}.webp`;
  // Squashed to the masks' square, same ruling as the Figure 2 panels: the
  // prediction pipeline squashed its input, so that frame is the registered one.
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", path.join(imagesDir, `${chosenEff.id}.jpg`),
    "-vf", `scale=${effSide}:${effSide}`,
    "-map_metadata", "-1",
    "-q:v", "80",
    path.join(OUT_DIR, effAngio),
  ]);
  effBytes += fs.statSync(path.join(OUT_DIR, effAngio)).size;

  // Content dedupe: a budget whose mask pixels are identical to an earlier
  // budget's (SAM: all three) references the earlier file instead of shipping
  // copies — and downstream (the client cache, the verify script's repaint
  // assertion) can read "same file" as "same pixels".
  const effEmitted = new Map(); // model -> [{ buf, file }]
  const effBudgets = EFF_FRACTIONS.map((f) => {
    const masks = {};
    const labels = Math.round(f * TRAIN_SIZE);
    for (const model of EFF_MODELS) {
      const e = effPanels.get(`${model}|${f}`);
      const prior = (effEmitted.get(model) || []).find((p) => Buffer.compare(p.buf, e.buf) === 0);
      let file;
      if (prior) {
        file = prior.file;
      } else {
        file = `eff/${model}_${labels}.png`;
        fs.copyFileSync(e.stagedFile, path.join(OUT_DIR, file));
        effBytes += fs.statSync(path.join(OUT_DIR, file)).size;
        if (!effEmitted.has(model)) effEmitted.set(model, []);
        effEmitted.get(model).push({ buf: e.buf, file });
      }
      masks[model] = {
        file,
        dice: e.dice,
        vesselIsWhite: e.vesselIsWhite,
        width: e.width,
        height: e.height,
      };
    }
    return { fraction: f, labels, masks };
  });
  for (const model of EFF_MODELS) {
    const n = (effEmitted.get(model) || []).length;
    if (n < EFF_FRACTIONS.length) {
      console.log(`  ${model}: identical pixels across budgets, ${n} file(s) emitted for ${EFF_FRACTIONS.length}`);
    }
  }
  const emittedCount = [...effEmitted.values()].reduce((a, v) => a + v.length, 0);
  console.log(`  strip assets: 1 angiogram + ${emittedCount} masks, ${(effBytes / 1024).toFixed(1)} KB total`);

  const effStrip = {
    image: chosenEff.id,
    angio: effAngio,
    models: EFF_MODELS,
    budgets: effBudgets,
  };

  // ---- Step 6: write JSON ----
  const labelEfficiency = {
    version: 1,
    trainSize: TRAIN_SIZE,
    models: modelsOut,
    strip: effStrip,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "label_efficiency.json"),
    JSON.stringify(labelEfficiency, null, 2) + "\n",
  );

  const provenance = {
    version: 1,
    generatedAt: new Date().toISOString(),
    generator: "scripts/prepare-research.mjs",
    sources: {
      csv: "external_materials/paper1/data/all_metrics_combined_long.csv",
      benchmarkTarball: "external_materials/paper1/data/benchmarkDataset.tar.gz",
      predictionsTarball: "external_materials/paper1/data/predictions_cache.tar.gz (wipe assets only)",
      testPredictions:
        "external_materials/paper1/data/test_predictions (from test_pred.zip, base64-encoded zip; " +
        "full seed1/fold1 re-export 2026-09-12, same runs the CSV records — feeds the Figure 2 " +
        "strip and the Figure 1 strip)",
      video: "external_materials/nasa/flight_lm_day.mp4",
    },
    wipeImage: {
      id: chosen.id,
      fraction: 0.05,
      fold: 1,
      diceX0: chosen.x0dice,
      diceSam: chosen.samdice,
      diceDelta: chosen.diff,
      forced: forcedImage !== null,
      top5Candidates: ranked.slice(0, 5),
    },
    diceCdf: {
      fraction: CDF_FRACTION,
      labels: cdfLabels,
      fold: 1,
      models: CDF_MODELS,
      rowsPerModel: cdfRows[CDF_MODELS[0]].length,
      curveScope:
        "every per-image test Dice row at this fraction, all seeds and all folds pooled; " +
        "the empirical CDF, downsampled to real (dice, share) pairs out of the sorted rows",
      sharesBelowHalf,
      shareBands: SHARE_BELOW_HALF_BANDS,
      keyModel: CDF_KEY_MODEL,
      stopPick:
        `nearest-with-dedupe on ${CDF_KEY_MODEL}'s computed Dice over the ` +
        `${cdfCandidates.length} images test_predictions holds for all three models at ` +
        `frac${CDF_FRACTION} seed1_fold1`,
      candidates: cdfCandidates,
      // `null` = the decisive masks split, so no model-wide fallback exists.
      // JSON has no `undefined`, and a silently missing key would read as a bug.
      polarityVote: Object.fromEntries(
        CDF_MODELS.map((m) => [m, polarityVote[m] === undefined ? null : polarityVote[m]]),
      ),
      diceMethod:
        "2|A∩B|/(|A|+|B|), both binarized at 127, vessel side detected from a frame ring " +
        "inset 2% of the short side (background runs to the frame edge) with the model's " +
        "own majority polarity as the fallback where that ring is undecided, ground truth " +
        "nearest-neighbor resized onto the mask's grid where the sizes differ",
      csvDriftAccepted: anyDrift && acceptCsvDrift,
      csvDriftNote:
        anyDrift && acceptCsvDrift
          ? "SAM only, root-caused 2026-09-12: test_predictions is a re-run of the recorded seed1/fold1 runs, and SAM's inference is stochastic (the long CSV scores the same image differently under different seeds), so its re-exported masks are fresh draws. The deterministic models reproduce their recorded rows from raw pixels (ResNet-UNet delta 0.000 at every stop, x0-diffusion within 0.02), which is the proof the decode, polarity and GT resize are right. Every number the site prints is computed from the shipped pixels."
          : null,
      stops: stops.map((s) => ({
        t: s.t,
        image: s.id,
        models: Object.fromEntries(
          CDF_MODELS.map((m) => {
            const e = perImage.get(s.id)[m];
            return [
              m,
              {
                dice: e.dice,
                csvDice: e.csvDice,
                csvSeeds: e.csvSeeds,
                delta: e.delta,
                vesselIsWhite: e.vesselIsWhite,
                ring: e.ring,
                ringDecisive: e.ringDecisive,
                maskWidth: e.maskWidth,
                maskHeight: e.maskHeight,
                gtResized: e.gtResized,
              },
            ];
          }),
        ),
      })),
    },
    effStrip: {
      image: chosenEff.id,
      models: EFF_MODELS,
      fractions: EFF_FRACTIONS,
      forced: forcedEffImage !== null,
      pickRule:
        "ranked from the CSV's seed1/fold1 rows (the rows describing these exact masks): " +
        "require min over budgets of x0-diffusion's Dice >= 0.85 AND x0 >= SAM + " +
        `${EFF_SAM_MARGIN} at the smallest budget (the margin absorbs SAM's stochastic ` +
        "re-draw), then maximize ResNet-UNet's gain from the smallest budget to the " +
        "largest; Dice shipped is computed from the staged bytes, gated within 0.15 of " +
        "those CSV rows, and the computed x0-beats-SAM lead is asserted before writing",
      top5Candidates: effRanked.slice(0, 5),
      panels: Object.fromEntries(
        [...effPanels.entries()].map(([key, e]) => [
          key,
          {
            dice: e.dice,
            csvDice: e.csvDice,
            delta: e.delta,
            vesselIsWhite: e.vesselIsWhite,
            ring: e.ring,
            ringDecisive: e.ringDecisive,
            width: e.width,
            height: e.height,
            gtResized: e.gtResized,
          },
        ]),
      ),
    },
    headline: {
      model: "x0diffusion",
      fraction: 0.05,
      labels: x0005.labels,
      diceMean: x0005.diceMean,
      diceStd: x0005.diceStd,
      n: x0005.n,
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");

  console.log(`\nWrote ${path.relative(ROOT, path.join(OUT_DIR, "label_efficiency.json"))}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, "cdf.json"))}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, "provenance.json"))}`);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log(
    "\nDone. Eyeball public/research/{angiogram.webp,mask_x0.png,mask_sam.png} and the\n" +
      "cdf/ masks before committing: a mask whose polarity flipped is where a decode\n" +
      "bug shows up as a plausible-looking wrong answer rather than an error.",
  );
}

main();
