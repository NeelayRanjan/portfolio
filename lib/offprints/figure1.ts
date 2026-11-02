// Pure helpers behind No. 1's Figure 1 (Figure1Attention.tsx). No imports,
// so plain node can test them (scripts/test-offprints-figure1.mjs).

/**
 * Two regimes so every chip's text clears AA (controller ruling, Task 10
 * fix round; spec §5). Below TEXT_FLIP: ink text on at most 40% of k in
 * paper (ink on the 40% mix reads ~7.7:1). At or above it: paper text on the
 * solid 92% mix (~4.6:1 with k #146b55). A single curve flipping at 0.45 left
 * paper text at 2.9-4.2:1 between 0.45 and 0.85.
 */
export const TEXT_FLIP = 0.45;
export const LIGHT_CAP = 40;
export const SOLID = 92;

/** Whether a key of weight w carries paper text (the solid regime). */
export function paperText(w: number): boolean {
  return w >= TEXT_FLIP;
}

/** Percent of k mixed into paper for a key of weight w. */
export function tintWidth(w: number): number {
  if (paperText(w)) return SOLID;
  return Math.min(LIGHT_CAP, 6 + Math.pow(Math.max(0, w), 0.6) * 100);
}

/** The key the query at `sel` weighs most, over its causal prefix 0..sel (first on a tie). */
export function bestKey(row: readonly number[], sel: number): number {
  let best = 0;
  for (let j = 1; j <= sel; j++) if (row[j] > row[best]) best = j;
  return best;
}

/** A weight as a rounded whole percent: 0.896 → "90". */
export function pctOf(w: number): string {
  return String(Math.round(w * 100));
}

/** The readout template cut around its {from}, {pct} and {to} slots. */
export function readoutParts(template: string): string[] {
  return template.split(/(\{from\}|\{pct\}|\{to\})/).filter((p) => p !== "");
}

/** The readout as plain text, the same fill the figure renders. */
export function fillReadout(template: string, from: string, pct: string, to: string): string {
  return readoutParts(template)
    .map((p) => (p === "{from}" ? from : p === "{pct}" ? pct : p === "{to}" ? to : p))
    .join("");
}
