/**
 * Copies onnxruntime-web's wasm runtime into public/ort/.
 *
 * ORT fetches its wasm binary at runtime from `ort.env.wasm.wasmPaths`, so the
 * files have to be served, not bundled. Vendored rather than hotlinked from a
 * CDN, per the model handoff.
 *
 * WHICH BUILD: the plain `ort-wasm-simd-threaded.{wasm,mjs}` pair, which is
 * what the `onnxruntime-web/wasm` entry fetches (every ORT import on the site
 * goes through that entry since 2026-09-16: lib/draw-model.ts,
 * lib/headshot-model.ts, lib/chess-worker.ts). Not the asyncify build the
 * `/webgpu` entry fetches, and not the jsep build the bare `onnxruntime-web`
 * entry fetches in 1.27: JavaScriptCore's optimizing wasm tier runs away on
 * both (ORT issue 26827), which is what crashed the draw demo on every
 * WebKit browser, iOS Safari and Chrome-on-iOS included. Measured in
 * WebKitGTK 2.52 after one classify + one generate: asyncify sat at ~395%
 * CPU and grew from 5.3 to 11.5 GB in a minute of idle; the plain build held
 * flat at ~800 MB (scripts/probe-webkit-draw.py). Don't guess at this list:
 * if ORT changes what it fetches, the network tab names the file, and the
 * verify suite's `ort-runtime-build` check asserts it from the network.
 *
 * Runs from `predev`/`prebuild` rather than being a one-time copy: the binary is
 * version-locked to the JS, so bumping onnxruntime-web without re-copying gives a
 * mismatch that only shows up as a runtime failure on first draw.
 */
import { copyFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "onnxruntime-web", "dist");
const to = join(root, "public", "ort");

const FILES = ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"];

/** Builds this site used to ship and must not any more. Removed if present so
 *  a stale local public/ort/ can't mask a code path that still asks for one:
 *  the request would 404 in production, and the verify check would only see
 *  the fetch, not the failure. */
const STALE = ["ort-wasm-simd-threaded.asyncify.wasm", "ort-wasm-simd-threaded.asyncify.mjs"];

if (!existsSync(from)) {
  console.error("sync-ort: onnxruntime-web not installed; skipping");
  process.exit(0);
}
mkdirSync(to, { recursive: true });

for (const f of STALE) {
  const dst = join(to, f);
  if (existsSync(dst)) {
    rmSync(dst);
    console.log(`sync-ort: removed stale ${f}`);
  }
}

let copied = 0;
for (const f of FILES) {
  const src = join(from, f);
  const dst = join(to, f);
  if (!existsSync(src)) {
    console.error(`sync-ort: missing ${f} — did onnxruntime-web change its layout?`);
    process.exit(1);
  }
  // Skip identical files so dev restarts don't re-copy 26MB every time.
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst);
  copied++;
}
console.log(
  copied ? `sync-ort: copied ${copied} file(s) to public/ort/` : "sync-ort: up to date",
);
