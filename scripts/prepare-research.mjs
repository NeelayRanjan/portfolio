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
//   node scripts/prepare-research.mjs [--image <id>]
//
// --image <id> overrides the auto-picked wipe image (see the printed top-5).
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
//   5. Writes label_efficiency.json and provenance.json.

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

function main() {
  const args = process.argv.slice(2);
  const imageFlagIdx = args.indexOf("--image");
  const forcedImage = imageFlagIdx >= 0 ? parseInt(args[imageFlagIdx + 1], 10) : null;

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

  const diceByModelImage = new Map(); // "model|id" -> dice[]
  for (const r of rows) {
    if (r.fraction !== 0.05) continue;
    if (r.model !== "x0diffusion" && r.model !== "sam") continue;
    if (!candidateIds.includes(r.image_index)) continue;
    if (Number.isNaN(r.dice)) continue;
    const key = `${r.model}|${r.image_index}`;
    if (!diceByModelImage.has(key)) diceByModelImage.set(key, []);
    diceByModelImage.get(key).push(r.dice);
  }

  const ranked = candidateIds
    .map((id) => {
      const x0arr = diceByModelImage.get(`x0diffusion|${id}`) || [];
      const samarr = diceByModelImage.get(`sam|${id}`) || [];
      const x0dice = round(mean(x0arr));
      const samdice = round(mean(samarr));
      return { id, x0dice, samdice, diff: round(x0dice - samdice) };
    })
    .sort((a, b) => b.diff - a.diff);

  console.log("\nTop 5 wipe-image candidates (dice(x0) - dice(sam) @ fraction 0.05):");
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

  // ---- Step 5: write JSON ----
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
      diceX0: chosen.x0dice,
      diceSam: chosen.samdice,
      diceDelta: chosen.diff,
      forced: forcedImage !== null,
      top5Candidates: ranked.slice(0, 5),
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
  console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, "provenance.json"))}`);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log("\nDone. Eyeball public/research/{angiogram.webp,mask_x0.png,mask_sam.png} before committing.");
}

main();
