/**
 * What stargaze's hint bar and NightSky's list panel share (discoverability
 * spec §4): the counts the bar shows, whether the list is open as a visible
 * panel, and how tall the bar measures.
 *
 * A module-level store for the same reason as lib/stargaze.ts: the bar
 * (StargazeToggle) and the sky (NightSky) are siblings in app/layout.tsx,
 * and the sky's plain-module controllers read these values outside React.
 * Leaving stargaze closes the panel (NightSky's stargaze subscriber).
 */
import { useSyncExternalStore } from "react";
import { EDGE_DEC_DEG } from "./sky-math";

/** How many things can open a card: never a literal, always the loaded data. */
export type CardCounts = { objects: number; constellations: number };

type Listener = () => void;

let counts: CardCounts | null = null;
let panelOpen = false;
/** Whether the stargaze list holds anything right now (NightSky's keyboard list). */
let listHasItems = false;
/** The hint bar's bottom edge in px, 0 while it isn't on screen. */
let hintBottom = 0;
const listeners = new Set<Listener>();
const emit = () => {
  for (const fn of [...listeners]) fn();
};

export function subscribeBrowse(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Objects: the catalog's objects that can actually draw, i.e. north of the
 * chart's edge declination (Voyager 2, at dec -59.8, never does), and that
 * have a fact to open. Constellations: the star catalog's own count.
 */
export function countCards(
  objects: readonly { id: string; decDeg: number }[],
  constellationIds: readonly string[],
  hasFact: (id: string) => boolean,
): CardCounts {
  return {
    objects: objects.filter((o) => o.decDeg > EDGE_DEC_DEG && hasFact(o.id)).length,
    constellations: constellationIds.filter(hasFact).length,
  };
}

export function setCardCounts(next: CardCounts | null): void {
  if (next?.objects === counts?.objects && next?.constellations === counts?.constellations) return;
  counts = next;
  emit();
}

export function getCardCounts(): CardCounts | null {
  return counts;
}

export function useCardCounts(): CardCounts | null {
  return useSyncExternalStore(subscribeBrowse, getCardCounts, () => null);
}

/**
 * "browse the list" depends on the list having something in it, not on the
 * counts: with objects.json absent the counts never publish, but the list
 * still holds constellations, planets and the Moon (final review m2).
 */
export function setListHasItems(next: boolean): void {
  if (next === listHasItems) return;
  listHasItems = next;
  emit();
}

export function getListHasItems(): boolean {
  return listHasItems;
}

export function useListHasItems(): boolean {
  return useSyncExternalStore(subscribeBrowse, getListHasItems, () => false);
}

export function isListPanelOpen(): boolean {
  return panelOpen;
}

export function setListPanelOpen(next: boolean): void {
  if (next === panelOpen) return;
  panelOpen = next;
  emit();
}

export function useListPanelOpen(): boolean {
  return useSyncExternalStore(subscribeBrowse, isListPanelOpen, () => false);
}

export function getHintBottom(): number {
  return hintBottom;
}

export function setHintBottom(px: number): void {
  const next = Math.round(px);
  if (next === hintBottom) return;
  hintBottom = next;
  // The panel's desktop top and phone max-height follow the bar's real
  // height, which wraps to more lines on a narrow screen.
  document.documentElement.style.setProperty("--stargaze-hint-h", `${next}px`);
  emit();
}
