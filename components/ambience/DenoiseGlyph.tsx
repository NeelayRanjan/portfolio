/**
 * Small ASCII denoise block for a section corner: noise on the left resolving
 * into structure on the right. Decorative texture where the eye lands — not a
 * section background.
 *
 * Deterministic from `seed`, deliberately: this renders on the server and again
 * on the client, so Math.random() would produce two different grids and trip a
 * hydration mismatch.
 */
const GLYPH_RAMP = " .·:-=+*";

/** Cheap integer hash -> [0,1). Same input, same output, on both sides. */
function noiseAt(seed: number, x: number, y: number): number {
  let h = seed * 374761393 + x * 668265263 + y * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function DenoiseGlyph({
  seed = 1,
  rows = 6,
  cols = 20,
  className = "",
}: {
  seed?: number;
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      // 0 at the left edge (pure noise) -> 1 at the right (resolved).
      const resolved = x / (cols - 1);
      const noise = noiseAt(seed, x, y);
      // The "signal" the noise resolves into: a soft horizontal band.
      const signal = Math.max(0, 1 - Math.abs(y - (rows - 1) / 2) / (rows / 2)) * 0.8;
      const v = noise * (1 - resolved) + signal * resolved;
      line += GLYPH_RAMP[Math.round(Math.min(1, Math.max(0, v)) * (GLYPH_RAMP.length - 1))];
    }
    lines.push(line);
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none font-mono text-[10px] leading-[0.7] tracking-[0.08em] text-teal opacity-16 ${className}`}
    >
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre">
          {line}
        </div>
      ))}
    </div>
  );
}
