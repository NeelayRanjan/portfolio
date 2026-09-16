/**
 * Saturation for the sky's sourced colour (discoverability spec 2026-09-16
 * §2-§3). NO IMPORTS, on purpose, same as lib/sky-math.ts and lib/sky-pan.ts:
 * scripts/test-sky-objects.mjs loads it in plain node.
 *
 * The owner reversed the colour round's "stargaze only" rule on 2026-09-16:
 * the ordinary page shows the sky's colour at PAPER_COLOUR_SHARE, and full
 * colour returns while the pointer is over the sky itself (or while
 * stargazing). The concern behind the old rule stands, the page's figures use
 * green, red and amber to mean something, so the paper level is a number
 * chosen against a screenshot of Figures 1 and 2, not a free choice.
 */

/**
 * How coloured paper mode looks, as a share of stargaze's colour: 0.5 means
 * each object's displayed colour sits about half way from the grey chart to
 * the full stargaze colour. The owner asked for the background "reduced to
 * 50% or 25%"; this is the one number to change.
 *
 * It means what it says because it was measured, not assumed (fix round 1,
 * 2026-09-16, headless Firefox, ten coloured objects at each one's
 * most-moved pixel): the displayed share tracks the internal mix almost
 * one to one. Mix 0.25 gave shares 0.14-0.44 (median 0.31), 0.4 gave median
 * 0.45, 0.5 gave 0.44-0.61 (median 0.53), 0.6 median 0.63, 0.8 median 0.83.
 * So PAPER_SATURATION is the share itself; if a future palette or glyph
 * change bends that relation, the sky-colour verify check (which asserts the
 * measured share against this constant) is what says so.
 */
export const PAPER_COLOUR_SHARE = 0.5;
/** The internal mix paper mode draws at; see PAPER_COLOUR_SHARE. */
export const PAPER_SATURATION = PAPER_COLOUR_SHARE;

/**
 * The Milky Way band's own curve: its hue lerp and alpha gain both run on
 * `saturation ** BAND_CURVE_EXPONENT`, not on saturation. The band paints at
 * 2-5% alpha, so a linear lerp moves its composited warmth in whole-level
 * steps that land late: measured mean warmth over 57,717 band pixels was
 * 4.02 at mix 0, 0.25 and 0.4, 5.03 at 0.5 and 0.6, 6.04 at 0.7 and 0.8, and
 * 7.04 at 1. A square root puts paper's 0.5 at band mix 0.71, the first step
 * that carries about half of stargaze's warmth gain or more. Both ends stay
 * exact (0 ** 0.5 = 0, 1 ** 0.5 = 1).
 */
export const BAND_CURVE_EXPONENT = 0.5;
export const bandMix = (s: number): number => (s <= 0 ? 0 : s >= 1 ? 1 : s ** BAND_CURVE_EXPONENT);

/** Time constant of the ease toward a new target, real ms. Exponential, so
 *  the same curve at any frame rate: a 0.5 -> 1 change is within
 *  SATURATION_SETTLE of its target after ~290 ms. */
export const SATURATION_TAU_MS = 60;
/** Close enough to snap onto the target and stop raising the frame gate. */
export const SATURATION_SETTLE = 0.004;

/**
 * One step of the ease, advanced by the real elapsed `dtMs`. Closed form
 * (`1 - exp(-dt/tau)`), never a per-frame constant, so two 16ms frames land
 * exactly where one 32ms frame does. Never overshoots; snaps onto the target
 * once within SATURATION_SETTLE.
 */
export function stepSaturation(current: number, target: number, dtMs: number): number {
  const next = target + (current - target) * Math.exp(-Math.max(0, dtMs) / SATURATION_TAU_MS);
  return Math.abs(next - target) < SATURATION_SETTLE ? target : next;
}

/**
 * An "r,g,b" colour mixed toward its own Rec. 709 luminance by `1 - s`: the
 * one desaturation on the chart. `s >= 1` returns the input string itself, so
 * full saturation is byte-identical to the palette; `s <= 0` is that grey.
 * Rounding is monotone, so a channel spread never shrinks as `s` grows.
 */
export function saturateRgb(rgb: string, s: number): string {
  if (s >= 1) return rgb;
  const [r, g, b] = rgb.split(",").map(Number);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const k = Math.max(0, s);
  const ch = (c: number) => Math.min(255, Math.max(0, Math.round(y + (c - y) * k)));
  return `${ch(r)},${ch(g)},${ch(b)}`;
}

/** "r,g,b" `a` to `b` by `t`, rounded; `t <= 0` is `a` and `t >= 1` is `b`, as strings. */
export function lerpRgb(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const pa = a.split(",").map(Number);
  const pb = b.split(",").map(Number);
  return pa.map((x, i) => Math.round(x + (pb[i] - x) * t)).join(",");
}

/** Linear `a` to `b` by `t`, exact at both ends (no float drift at 1). */
export function lerpNum(a: number, b: number, t: number): number {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return a + (b - a) * t;
}
