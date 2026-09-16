/**
 * The one-time entry rings (discoverability spec §4): on the first stargaze
 * entry of a page load, rings fade in and out around the few selectable
 * symbols nearest the viewport centre, once, so a visitor sees that the
 * things on the chart can be opened. A single demonstration inside a mode
 * the visitor chose, not a pulse: it never repeats that page load.
 *
 * NightSky's stargaze subscriber starts it, the painter reads the envelope
 * on real elapsed ms (performance.now, never the simulated sky clock) and
 * clears it when it ends, and the frame loop raises its gate while it runs,
 * the way it does for a drag.
 */

/** How long the rings live, fade in and out included. */
export const ENTRY_RING_MS = 1200;
/** How many symbols get a ring. */
export const ENTRY_RING_COUNT = 4;

type RingCandidate = { id: string; x: number; y: number; boxOnly?: boolean };

/** The ids of the ENTRY_RING_COUNT drawn symbols nearest the viewport centre.
 *  Box-only hits (the Milky Way's label) have no symbol to ring. */
export function pickEntryRingIds(hits: readonly RingCandidate[], width: number, height: number): string[] {
  const cx = width / 2;
  const cy = height / 2;
  return hits
    .filter((h) => !h.boxOnly)
    .map((h) => ({ id: h.id, d: Math.hypot(h.x - cx, h.y - cy) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, ENTRY_RING_COUNT)
    .map((h) => h.id);
}

/** Opacity at `elapsedMs` into the rings' life: a half-sine in and out, or
 *  fully on and still under reduced motion. 0 once the time is up. */
export function entryRingAlpha(elapsedMs: number, reducedMotion: boolean): number {
  if (elapsedMs < 0 || elapsedMs >= ENTRY_RING_MS) return 0;
  return reducedMotion ? 1 : Math.sin((Math.PI * elapsedMs) / ENTRY_RING_MS);
}
