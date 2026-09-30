/** Seeded standard-normal noise for live rerouter runs: mulberry32 uniforms
 *  through Box-Muller. The parity tests never use this; they inject the
 *  Python run's own torch.randn draw instead. No imports, on purpose. */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalNoise(seed: number, count: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 2) {
    const u1 = 1 - rand(); // (0, 1]: log(0) never happens
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < count) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}
