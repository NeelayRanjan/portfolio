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
//   node scripts/prepare-research.mjs [--image <id>] [--ladder-image <id>]
//                                     [--accept-csv-drift]
//
// --image <id> overrides the auto-picked wipe image (see the printed top-5).
// --ladder-image <id> overrides Figure 2's ladder image (defaults to the wipe
//   image, so the same angiogram runs all the way down the page).
// --accept-csv-drift lets the ladder's computed-vs-CSV gate through when a
//   (model, budget) pair drifts past 0.15 Dice. Read the gate's comment before
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
//   5. Builds Figure 2's label-efficiency LADDER: for the ladder image, every
//      label budget the cache holds for all three ladder models, one mask PNG
//      per (model, budget), with Dice COMPUTED against the benchmark ground
//      truth for the exact bytes shipped. Cross-checked against the CSV.
//   6. Writes label_efficiency.json, ladder.json and provenance.json.

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
/* Ladder: mask geometry and Dice, computed with ffmpeg as the decoder     */
/* ---------------------------------------------------------------------- */

const LADDER_MODELS = ["x0diffusion", "vit_base_patch16", "deeplabv3"];

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

/**
 * ⚠️ Polarity is DETECTED from the IMAGE BORDER, and this is the same rule
 * `components/figures/mask-paint.ts` runs on the client, deliberately: the
 * number under a panel has to describe the pixels that panel paints.
 *
 * These masks share no polarity convention. In this cache it flips with the
 * label budget: every mask at 320 labels is black-vessel-on-white, every mask
 * below it is white-vessel-on-black, and the benchmark's ground truth is
 * black-vessel-on-white. Background always runs out to the frame edge and
 * vessels essentially never do, so the border side is the background.
 *
 * The obvious alternative, "the vessel is the minority class", is true of a
 * good prediction and false of a broken one: ViT-DPT at 16 labels calls 67.7%
 * of image 330 vessel, and the minority rule scores its complement (Dice
 * 0.007 instead of 0.290).
 */
function vesselMask(buf, w, h) {
  let borderWhite = 0;
  let borderTotal = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      borderTotal++;
      if (buf[y * w + x] > 127) borderWhite++;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (const x of [0, w - 1]) {
      borderTotal++;
      if (buf[y * w + x] > 127) borderWhite++;
    }
  }
  const vesselIsWhite = borderWhite / borderTotal < 0.5;
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = (vesselIsWhite ? buf[i] > 127 : buf[i] < 127) ? 1 : 0;
  }
  return { out, vesselIsWhite };
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
  const ladderFlagIdx = args.indexOf("--ladder-image");
  const forcedLadderImage =
    ladderFlagIdx >= 0 ? parseInt(args[ladderFlagIdx + 1], 10) : null;
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

  // ---- Step 5: Figure 2's ladder ----
  //
  // One mask per (ladder model, label budget) for a single image, with Dice
  // computed against the benchmark ground truth for the exact bytes shipped.
  // The site displays the COMPUTED number, never the CSV's: the panel shows
  // one run's pixels, and the CSV cell is a mean over four seeds of a
  // different export. See the drift gate below.
  const ladderImage = forcedLadderImage !== null ? forcedLadderImage : chosen.id;
  const masksDir = path.join(benchDir, "benchmarkDataset", "masks");
  const gtPath = path.join(masksDir, `${ladderImage}.png`);
  if (!fs.existsSync(gtPath)) {
    fail(`No benchmark ground-truth mask for ladder image ${ladderImage}: ${gtPath}`);
  }

  const cacheRoot = path.join(predDir, "predictions_cache");
  // Budgets are whatever the cache actually holds for ALL three ladder models
  // (today 0.05/0.1/0.25/0.5/1.0 => 16/32/80/160/320). Discovered, never
  // hardcoded, so a re-export with a new fraction lands on the page.
  const fractionSets = LADDER_MODELS.map((model) => {
    const modelDir = path.join(cacheRoot, model);
    if (!fs.existsSync(modelDir)) fail(`Ladder model dir not found: ${modelDir}`);
    return new Set(
      fs
        .readdirSync(modelDir)
        .map((d) => /^frac([0-9.]+)_fold1$/.exec(d))
        .filter(Boolean)
        .filter((m) => fs.existsSync(path.join(modelDir, m[0], `${ladderImage}.png`)))
        .map((m) => m[1]),
    );
  });
  const ladderFractions = [...fractionSets[0]]
    .filter((f) => fractionSets.every((s) => s.has(f)))
    .map((f) => ({ fraction: parseFloat(f), dir: f }))
    .sort((a, b) => a.fraction - b.fraction);
  if (ladderFractions.length === 0) {
    fail(
      `No frac*_fold1 dir holds image ${ladderImage} for all of ${LADDER_MODELS.join(", ")}. ` +
        "Nothing written.",
    );
  }

  // Per-(model, fraction, image) fold1 CSV dice, for the cross-check only.
  const csvByCell = new Map();
  for (const r of rows) {
    if (r.fold !== 1 || r.image_index !== ladderImage || Number.isNaN(r.dice)) continue;
    const key = `${r.model}|${r.fraction}`;
    if (!csvByCell.has(key)) csvByCell.set(key, []);
    csvByCell.get(key).push(r.dice);
  }

  const ladderStage = path.join(tmpRoot, "ladder");
  fs.mkdirSync(ladderStage, { recursive: true });
  const ladderDir = path.join(OUT_DIR, "ladder");

  console.log(
    `\nLadder: image ${ladderImage}` +
      (forcedLadderImage !== null ? " [forced via --ladder-image]" : " [follows the wipe image]") +
      `, budgets ${ladderFractions.map((f) => Math.round(f.fraction * TRAIN_SIZE)).join("/")}`,
  );
  console.log(
    "  model               labels  computed  csv(4-seed)  delta  mask        gtResized",
  );

  const ladderEntries = [];
  let anyDrift = false;
  for (const model of LADDER_MODELS) {
    for (const { fraction, dir } of ladderFractions) {
      const labels = Math.round(fraction * TRAIN_SIZE);
      const srcMask = path.join(cacheRoot, model, `frac${dir}_fold1`, `${ladderImage}.png`);
      if (!fs.existsSync(srcMask)) fail(`Missing ladder mask: ${srcMask}`);

      // Encode into the staging dir first, compute Dice from THAT file, and
      // only move it into public/ once the gate below passes: the number on
      // the page has to describe the bytes the page serves, and a failing run
      // must leave public/research/ untouched.
      const staged = path.join(ladderStage, `${model}_${labels}.png`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", srcMask, "-map_metadata", "-1", staged]);

      const { w, h } = imageSize(staged);
      const gt = imageSize(gtPath);
      // Predictions are square (224 or 384); the benchmark's masks are native
      // 386x448. Nearest-neighbor resize of the GROUND TRUTH onto the mask's
      // grid, never the other way: upsampling a prediction would invent
      // vessel the model never predicted.
      const gtResized = gt.w !== w || gt.h !== h;
      const predBuf = decodeGray(staged);
      const gtBuf = gtResized ? decodeGray(gtPath, w, h) : decodeGray(gtPath);
      if (predBuf.length !== w * h) {
        fail(`Decoded ${staged} to ${predBuf.length} bytes, expected ${w * h}. Nothing written.`);
      }
      if (gtBuf.length !== predBuf.length) {
        fail(
          `Ground truth decoded to ${gtBuf.length} bytes against the mask's ${predBuf.length}. ` +
            "Nothing written.",
        );
      }
      const pred = vesselMask(predBuf, w, h);
      const truth = vesselMask(gtBuf, w, h);
      const dice = diceOf(pred.out, truth.out);

      const csvSeeds = csvByCell.get(`${model}|${fraction}`) || [];
      const csvDice = csvSeeds.length ? round(mean(csvSeeds)) : null;
      const delta = csvDice === null ? null : round(Math.abs(dice - csvDice));
      if (delta !== null && delta > 0.15) anyDrift = true;

      const flag =
        delta === null ? "     " : delta > 0.15 ? " FAIL" : delta > 0.05 ? " warn" : "     ";
      console.log(
        `  ${model.padEnd(18)} ${String(labels).padStart(6)}  ${dice.toFixed(4).padStart(8)}  ` +
          `${(csvDice === null ? "-" : csvDice.toFixed(4)).padStart(11)}  ` +
          `${(delta === null ? "-" : delta.toFixed(4)).padStart(5)}${flag}  ` +
          `${w}x${h}  ${gtResized ? `yes (${gt.w}x${gt.h})` : "no"}`,
      );

      ladderEntries.push({
        model,
        labels,
        fraction,
        dice: round(dice),
        csvDice,
        csvSeeds: csvSeeds.length,
        delta,
        maskWidth: w,
        maskHeight: h,
        gtResized,
        vesselIsWhite: pred.vesselIsWhite,
        file: `ladder/${model}_${labels}.png`,
        staged,
      });
    }
  }

  // The drift gate. Its job is catching a BROKEN pipeline: a wrong polarity, a
  // misaligned ground truth, a filename that isn't the image id. A cached mask
  // is one run and the CSV cell is a four-seed mean, so a few points of gap is
  // expected and only warns.
  //
  // ⚠️ KNOWN AND INVESTIGATED (2026-09-12): deeplabv3's cached masks drift far
  // past 0.15 at every budget, and ViT-DPT's do at 16 labels. This is NOT a
  // pipeline bug. Checked against the CSV's individual fold1 seeds for image
  // 330: deeplabv3 at 32 labels scores 0.480 from these pixels while its four
  // seeds sit at 0.904-0.940, so no seed in the CSV produced this mask. The
  // cache is a separate export from the runs the CSV aggregates. x0-diffusion
  // matches across all 10 cached images and every fraction, which is what
  // proves the decode, the polarity and the resize are right. So the drift is
  // real and the flag is how a human says "I have read this".
  if (anyDrift && !acceptCsvDrift) {
    const drifted = ladderEntries
      .filter((e) => e.delta !== null && e.delta > 0.15)
      .map((e) => `${e.model}@${e.labels}: computed ${e.dice} vs csv ${e.csvDice} (Δ ${e.delta})`);
    fail(
      "ASSERTION FAILED: ladder Dice drifts past 0.15 from the CSV for:\n  " +
        drifted.join("\n  ") +
        "\n\nIf this is the known cache-vs-CSV mismatch, re-run with --accept-csv-drift. " +
        "If it is new, check polarity, the ground-truth resize and the image id FIRST. " +
        "Nothing written.",
    );
  }
  if (anyDrift) {
    console.log(
      "\n  --accept-csv-drift: shipping the COMPUTED numbers. They describe the pixels\n" +
        "  on screen; the CSV cells describe a different export's four-seed means.",
    );
  }

  fs.rmSync(ladderDir, { recursive: true, force: true });
  fs.mkdirSync(ladderDir, { recursive: true });
  let ladderBytes = 0;
  for (const e of ladderEntries) {
    const dest = path.join(OUT_DIR, e.file);
    fs.copyFileSync(e.staged, dest);
    ladderBytes += fs.statSync(dest).size;
    delete e.staged;
  }
  console.log(
    `\n  ${ladderEntries.length} ladder masks, ${(ladderBytes / 1024).toFixed(1)} KB total`,
  );

  const ladderBudgets = ladderFractions.map((f) => Math.round(f.fraction * TRAIN_SIZE));
  const ladder = {
    version: 1,
    image: ladderImage,
    budgets: ladderBudgets,
    models: LADDER_MODELS.map((key) => ({
      key,
      series: ladderEntries
        .filter((e) => e.model === key)
        .sort((a, b) => a.labels - b.labels)
        .map((e) => ({ labels: e.labels, dice: e.dice })),
    })),
  };
  fs.writeFileSync(path.join(OUT_DIR, "ladder.json"), JSON.stringify(ladder, null, 2) + "\n");

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
    ladder: {
      image: ladderImage,
      forced: forcedLadderImage !== null,
      budgets: ladderBudgets,
      models: LADDER_MODELS,
      groundTruth: `benchmarkDataset/masks/${ladderImage}.png`,
      diceMethod:
        "2|A∩B|/(|A|+|B|), both binarized at 127, vessel side detected from the " +
        "image border (background runs to the frame edge), ground truth " +
        "nearest-neighbor resized onto the mask's grid where the sizes differ",
      csvDriftAccepted: anyDrift && acceptCsvDrift,
      csvDriftNote:
        anyDrift && acceptCsvDrift
          ? "The prediction cache is a separate export from the runs all_metrics_combined_long.csv aggregates: deeplabv3's cached masks, and ViT-DPT's at 16 labels, fall outside the spread of every CSV seed for this image. The site shows the computed Dice, which describes the shipped pixels."
          : null,
      masks: ladderEntries,
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
  console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, "ladder.json"))}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, "provenance.json"))}`);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log(
    "\nDone. Eyeball public/research/{angiogram.webp,mask_x0.png,mask_sam.png} and the\n" +
      "ladder masks before committing: the 16-label panels are where a decode or\n" +
      "polarity bug shows up as a plausible-looking mask.",
  );
}

main();
