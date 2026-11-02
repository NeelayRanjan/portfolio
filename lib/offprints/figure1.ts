// Pure helpers behind No. 1's Figure 1 (Figure1Attention.tsx). No imports,
// so plain node can test them (scripts/test-offprints-figure1.mjs).

/** Above this weight a tinted chip's text turns paper (the tint is dark). */
export const TEXT_FLIP = 0.45;

/** Percent of k mixed into paper for a key of weight w: min(92, 6 + w^0.6 * 100). */
export function tintWidth(w: number): number {
  return Math.min(92, 6 + Math.pow(Math.max(0, w), 0.6) * 100);
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
