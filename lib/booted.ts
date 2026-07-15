"use client";

import { useSyncExternalStore } from "react";

/**
 * Has the boot screen lifted?
 *
 * Exists for one reason: the swarm's anneal is on a wall-clock from its first
 * frame (`T = max(0.22, 2.1 * exp(-age/1400))`), and the boot screen covers the
 * page for ~2.5s. Left to start at page load, the sim burned its whole descent
 * behind an opaque overlay: by the time the ssh finished, age was ~2900ms, T had
 * decayed to ~0.26 against a 0.22 floor, and the reveal showed a nameplate that
 * had already settled. The one deliberately loud thing on the page, missed.
 *
 * A store rather than a prop because the two components are nowhere near each
 * other: BootScreen is a body child in the layout, the swarm is another.
 *
 * Sticky and one-way. Anything mounting after the boot reads `true` immediately
 * rather than waiting for an event that already fired.
 */
let booted = false;
const subs = new Set<() => void>();

export function markBooted() {
  if (booted) return;
  booted = true;
  for (const f of subs) f();
}

export function isBooted() {
  return booted;
}

export function subscribeBooted(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useBooted(): boolean {
  return useSyncExternalStore(
    subscribeBooted,
    () => booted,
    () => false,
  );
}
