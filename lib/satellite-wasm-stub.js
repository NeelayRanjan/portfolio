// satellite.js's optional WASM runtimes (createSingleThreadRuntime /
// createMultiThreadRuntime) are never called by this site; lib/sky-iss.ts
// uses the pure-JS SGP4. This stub stands in so the bundler never tries to
// pull their Node-only Emscripten builds into the browser bundle.
export default async function createWasmModule() {
  throw new Error("satellite.js WASM runtimes are not used on this site");
}
