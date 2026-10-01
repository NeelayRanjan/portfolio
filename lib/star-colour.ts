/**
 * A star's colour from its catalog B-V (task 18, controller ruling R24,
 * 2026-10-01). NO IMPORTS, on purpose, same as lib/sky-colour.ts: the node
 * tests load it straight.
 *
 * Two published steps, both fetched and checked on 2026-10-01:
 *
 * 1. B-V to temperature: Ballesteros, F. J. (2012), "New insights into black
 *    bodies", EPL 97, 34008 (doi:10.1209/0295-5075/97/34008; preprint
 *    https://arxiv.org/abs/1201.1809), equation (14):
 *      T = 4600 K * ( 1 / (0.92 (B-V) + 1.7) + 1 / (0.92 (B-V) + 0.62) ).
 *    Read off the arXiv PDF itself, not a secondary page.
 *
 * 2. Temperature to an sRGB pixel: Mitchell Charity, "What color is a
 *    blackbody? - some pixel rgb values",
 *    https://www.vendian.org/mncharity/dir3/blackbody/ (accessed 2026-10-01;
 *    the fetched page hashed sha256 27a3910d...ba4aa). His method, in his
 *    words: the blackbody spectrum "mapped to the CIE XYZ color space ...
 *    using the CIE 1964 10-deg color matching functions", then "sRGB's
 *    primaries and gamma correction, and a D65 whitepoint". BLACKBODY_HEX
 *    below is his table transcribed by script from that page, 1000 K to
 *    29800 K in 200 K steps, nothing edited; scripts/test-sky-stars.mjs pins
 *    entries against it. Between rows the channels are interpolated linearly.
 *
 * One display choice on top, stated rather than hidden: STAR_CHROMA_GAIN
 * (fix round 1, controller ruling R26). Charity's values are chromaticity at
 * D65, so a 5,300 K star like Capella is #ffe8d5, a peach so pale that a 2px
 * dot reads as white. So a star draws at the colour of a blackbody FURTHER
 * FROM WHITE than its own temperature, clamped to the table's extremes: its
 * distance from the table's white row (WHITE_K, 6,600 K, #fef9ff) is
 * multiplied by the gain in mireds (1e6 / T, the scale on which equal steps
 * look like equal colour steps), and the result is clamped to the table's
 * own range, 1,000 K (#ff3800) to 29,800 K (#9fbfff). Every drawn colour is
 * therefore a row of Charity's table (or between two rows): never bluer than
 * his hottest blackbody, never redder than his coolest, on the blackbody
 * locus and on the star's own side of white. The first version scaled
 * chroma away from grey instead, which pushed 837 hot stars bluer than any
 * blackbody; scripts/test-sky-stars.mjs now asserts every drawn colour lies
 * on the table. Honest for the reason the Milky Way's stargaze gain is: a
 * long exposure records star colour more strongly than the eye does, which
 * the credit line already says. Fainter stars get less of it
 * (STAR_CHROMA_GAIN_FAINT), since a tiny dim dot can't carry much colour and
 * a field of strong specks would read as noise.
 */

/** Mitchell Charity's blackbody table, 1000 K + 200 K * i, sRGB hex. */
export const BLACKBODY_HEX: readonly string[] = [
  "ff3800", "ff5300", "ff6500", "ff7300", "ff7e00", "ff8912", "ff932c", "ff9d3f",
  "ffa54f", "ffad5e", "ffb46b", "ffbb78", "ffc184", "ffc78f", "ffcc99", "ffd1a3",
  "ffd5ad", "ffd9b6", "ffddbe", "ffe1c6", "ffe4ce", "ffe8d5", "ffebdc", "ffeee3",
  "fff0e9", "fff3ef", "fff5f5", "fff8fb", "fef9ff", "f9f6ff", "f5f3ff", "f0f1ff",
  "edefff", "e9edff", "e6ebff", "e3e9ff", "e0e7ff", "dde6ff", "dae4ff", "d8e3ff",
  "d6e1ff", "d3e0ff", "d1dfff", "cfddff", "cedcff", "ccdbff", "cadaff", "c9d9ff",
  "c7d8ff", "c6d8ff", "c4d7ff", "c3d6ff", "c2d5ff", "c1d4ff", "c0d4ff", "bfd3ff",
  "bed2ff", "bdd2ff", "bcd1ff", "bbd1ff", "bad0ff", "b9d0ff", "b8cfff", "b7cfff",
  "b7ceff", "b6ceff", "b5cdff", "b5cdff", "b4ccff", "b3ccff", "b3ccff", "b2cbff",
  "b2cbff", "b1caff", "b1caff", "b0caff", "afc9ff", "afc9ff", "afc9ff", "aec9ff",
  "aec8ff", "adc8ff", "adc8ff", "acc7ff", "acc7ff", "acc7ff", "abc7ff", "abc6ff",
  "aac6ff", "aac6ff", "aac6ff", "a9c6ff", "a9c5ff", "a9c5ff", "a9c5ff", "a8c5ff",
  "a8c5ff", "a8c4ff", "a7c4ff", "a7c4ff", "a7c4ff", "a7c4ff", "a6c3ff", "a6c3ff",
  "a6c3ff", "a6c3ff", "a5c3ff", "a5c3ff", "a5c3ff", "a5c2ff", "a4c2ff", "a4c2ff",
  "a4c2ff", "a4c2ff", "a4c2ff", "a3c2ff", "a3c1ff", "a3c1ff", "a3c1ff", "a3c1ff",
  "a3c1ff", "a2c1ff", "a2c1ff", "a2c1ff", "a2c1ff", "a2c0ff", "a2c0ff", "a1c0ff",
  "a1c0ff", "a1c0ff", "a1c0ff", "a1c0ff", "a1c0ff", "a1c0ff", "a0c0ff", "a0bfff",
  "a0bfff", "a0bfff", "a0bfff", "a0bfff", "a0bfff", "a0bfff", "9fbfff", "9fbfff",
  "9fbfff",
];
export const BLACKBODY_MIN_K = 1000;
export const BLACKBODY_STEP_K = 200;

/** Ballesteros (2012) eq. 14. */
export function bvToKelvin(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Charity's table at `k` kelvin, linearly interpolated, clamped to its range. */
export function kelvinToRgb(k: number): [number, number, number] {
  const last = BLACKBODY_HEX.length - 1;
  const x = Math.min(last, Math.max(0, (k - BLACKBODY_MIN_K) / BLACKBODY_STEP_K));
  const i = Math.min(last - 1, Math.floor(x));
  const u = x - i;
  const a = BLACKBODY_HEX[i];
  const b = BLACKBODY_HEX[i + 1];
  const ch = (o: number) => {
    const p = Number.parseInt(a.slice(o, o + 2), 16);
    const q = Number.parseInt(b.slice(o, o + 2), 16);
    return p + (q - p) * u;
  };
  return [ch(0), ch(2), ch(4)];
}

/** The table's most neutral row (6,600 K, #fef9ff): the white the push is away from. */
export const WHITE_K = 6600;
export const BLACKBODY_MAX_K = BLACKBODY_MIN_K + BLACKBODY_STEP_K * (BLACKBODY_HEX.length - 1);
/** How far a bright star's temperature is pushed from white, in mireds. */
export const STAR_CHROMA_GAIN = 1.8;
/** The same for the faintest stars on the chart (mag 6). */
export const STAR_CHROMA_GAIN_FAINT = 1.2;
/** Full gain at or brighter than this magnitude, easing to the faint gain at 6. */
const GAIN_FULL_MAG = 1.5;
const GAIN_FAINT_MAG = 6;

/** The temperature a star draws at: its own, pushed from WHITE_K by `gain`
 *  in mireds, clamped to the table's 1,000-29,800 K. */
export function displayKelvin(k: number, gain: number): number {
  const white = 1e6 / WHITE_K;
  const mired = white + (1e6 / k - white) * gain;
  const lo = 1e6 / BLACKBODY_MAX_K;
  const hi = 1e6 / BLACKBODY_MIN_K;
  return 1e6 / Math.min(hi, Math.max(lo, mired));
}

/**
 * The full-saturation "r,g,b" a star draws with in stargaze, or null when it
 * has no B-V (two catalog stars): no index, no colour.
 */
export function starColourRgb(bv: number | null, mag: number): string | null {
  if (bv === null || !Number.isFinite(bv)) return null;
  const t = Math.min(1, Math.max(0, (mag - GAIN_FULL_MAG) / (GAIN_FAINT_MAG - GAIN_FULL_MAG)));
  const gain = STAR_CHROMA_GAIN + (STAR_CHROMA_GAIN_FAINT - STAR_CHROMA_GAIN) * t;
  return kelvinToRgb(displayKelvin(bvToKelvin(bv), gain)).map(Math.round).join(",");
}
