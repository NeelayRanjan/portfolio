/**
 * The secret door into stargaze (Task 17, owner-approved 2026-10-01): in
 * paper mode, a click or tap on a constellation's lines in the page margin
 * enters stargaze, tagged `via: "sky"`, and a caption says what just happened.
 *
 * No imports, on purpose, so scripts/test-sky-secret.mjs can pin the rule in
 * plain node. The pointer controller supplies the inputs: the hit test
 * (`pick`, the same one hover uses, so `nearestHit`'s precedence holds and a
 * symbol or drawn name under the pointer is NOT a constellation click), the
 * pointer's travel, and whether the press was on the sky at all.
 */

export type SecretDoorInput = {
  /** Already stargazing: a click there opens a card instead. */
  stargazing: boolean;
  /** Pointer travel between down and up, px. */
  travelPx: number;
  /** CLICK_SLOP_PX (lib/sky-pan.ts), passed in to keep this module import-free. */
  clickSlopPx: number;
  /** The press and the release were both on the sky: not the sheet, a
   *  control, the credit, or anything in PAN_BLOCKERS. */
  onSky: boolean;
  /** What the hover hit test resolves at the release point. */
  picked: { kind: "constellation" | "hit"; id: string } | null;
};

/** The constellation whose lines were clicked, or null when this click is not the door. */
export function secretDoorTarget(i: SecretDoorInput): string | null {
  if (i.stargazing || !i.onSky) return null;
  if (!(i.travelPx < i.clickSlopPx)) return null; // a drag, never a click
  return i.picked?.kind === "constellation" ? i.picked.id : null;
}

/** The caption's fade in and out (none under reduced motion). */
export const SECRET_FADE_MS = 400;
/** How long the caption stays fully up between its fades. */
export const SECRET_HOLD_MS = 6000;
