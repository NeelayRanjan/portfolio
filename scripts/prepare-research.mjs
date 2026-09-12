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
//   6. Writes label_efficiency.json, cdf.json and provenance.json.
//      (label_efficiency.json feeds no figure today; it is real computed data
//      kept for a future one.)

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
  // shipped. Same budget and same fold as the wipe (frac0.05_fold1).
  //
  // ⚠️ THE CACHE HOLDS 10 IMAGES AND SAM SCORES 0.666-0.924 ON THEM, so a stop
  // at Dice 0.1 has no image at 0.1 to show. Greedy nearest-with-dedupe over
  // those 10 comes out exactly rank-ordered, so panning right walks toward
  // images SAM handles better, and each panel prints its own computed number.
  // The site must NOT claim the shown image scores the cursor's value; the
  // cursor is a threshold and the readouts are shares below it.
  const gtFor = (id) => path.join(benchDir, "benchmarkDataset", "masks", `${id}.png`);
  const cacheRoot = path.join(predDir, "predictions_cache");
  const cdfFracDir = `frac${CDF_FRACTION}_fold1`;

  // -- the strip: one image per stop --
  const cdfCandidates = (() => {
    const sets = CDF_MODELS.map((model) => {
      const dir = path.join(cacheRoot, model, cdfFracDir);
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
      const src = path.join(cacheRoot, model, cdfFracDir, `${id}.png`);
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

  // Per-(model, image) fold1 CSV dice at this fraction, for the cross-check only.
  const csvByCell = new Map();
  for (const r of rows) {
    if (r.fold !== 1 || r.fraction !== CDF_FRACTION || Number.isNaN(r.dice)) continue;
    const key = `${r.model}|${r.image_index}`;
    if (!csvByCell.has(key)) csvByCell.set(key, []);
    csvByCell.get(key).push(r.dice);
  }

  const perImage = new Map(); // id -> { model -> entry }
  for (const id of cdfCandidates) {
    const byModel = {};
    for (const model of CDF_MODELS) {
      const s = staged.get(`${model}|${id}`);
      const d = detectVesselIsWhite(s.buf, s.w, s.h, polarityVote[model]);
      const gt = groundTruth(id, s.w, s.h);
      const dice = diceOf(binarize(s.buf, d.vesselIsWhite), gt.mask);
      const csvSeeds = csvByCell.get(`${model}|${id}`) || [];
      const csvDice = csvSeeds.length ? round(mean(csvSeeds)) : null;
      byModel[model] = {
        model,
        dice: round(dice),
        csvDice,
        csvSeeds: csvSeeds.length,
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
  // the key because its cached masks are the ones that AGREE with the CSV
  // (max |delta| 0.14 here): the number driving which image you see should be
  // the trustworthy one, not the drifted one.
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
    `\nFigure 2 strip: ${cdfCandidates.length} cached images at ${cdfFracDir}, ` +
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
  // misaligned ground truth, a filename that isn't the image id. A cached mask
  // is one run and the CSV cell is a mean over that fold's seeds, so a few
  // points of gap is expected and only warns.
  //
  // ⚠️ KNOWN AND INVESTIGATED (2026-09-12): ResNet-UNet's cached masks drift
  // far past 0.15 on most of these images, and this is NOT a pipeline bug. Its
  // 16-label masks are salt-and-pepper noise on 5 of the 10 (53-58% of the
  // frame either way), while the CSV's fold1 seeds for the same images sit at
  // 0.70-0.73. No seed in the CSV produced those pixels: the prediction cache
  // is a separate export from the runs all_metrics_combined_long.csv
  // aggregates. x0-diffusion matches across all 10 images (max |delta| 0.10)
  // and so does SAM (max 0.14), which is what proves the decode, the polarity
  // and the ground-truth resize are right. So the drift is real and the flag is
  // how a human says "I have read this".
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
        "  on screen; the CSV cells describe a different export's per-seed means.",
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
    fold: 1,
    models: CDF_MODELS,
    rowsPerModel: cdfRows[CDF_MODELS[0]].length,
    curves,
    sharesBelowHalf,
    stops: stopsOut,
  };
  fs.writeFileSync(path.join(OUT_DIR, "cdf.json"), JSON.stringify(cdf, null, 2) + "\n");

  // ---- Step 6: write JSON ----
  const labelEfficiency = {
    version: 1,
    trainSize: TRAIN_SIZE,
    models: modelsOut,
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
      predictionsTarball: "external_materials/paper1/data/predictions_cache.tar.gz",
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
        `${cdfCandidates.length} images the cache holds for all three models at ${cdfFracDir}`,
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
          ? "The prediction cache is a separate export from the runs all_metrics_combined_long.csv aggregates: ResNet-UNet's 16-label masks are salt-and-pepper noise on 5 of the 10 cached images while the CSV's fold1 seeds for the same images sit at 0.70-0.73, outside the spread of every seed. x0-diffusion (max delta 0.10) and SAM (max 0.14) match, which is what proves the decode, the polarity and the ground-truth resize. The site shows the computed Dice, which describes the shipped pixels."
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
