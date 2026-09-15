/**
 * Stargaze mode: the page steps aside and the sky gets the whole screen.
 *
 * A module-level store rather than React context, on purpose: the layout,
 * the sky canvas and three model panels in different subtrees all need it,
 * and the loaders (plain modules) report offloads into it. Nothing here
 * unmounts anything; hiding is CSS (`body[data-stargaze]` in globals.css)
 * plus `inert` on every `main`, so a chess game, a drawing and the scroll
 * position all survive the round trip.
 *
 * Each model-owning panel subscribes and handles its own cancel + release
 * (it owns the run state); see DrawDigit, HeadshotToy, ChessPanel.
 */
import { useSyncExternalStore } from "react";
import { trackDemoOnce } from "./track";

/**
 * Thrown from a panel's own `onFrame` callback to stop a vendored sampler
 * between model steps. The samplers have no abort option and never get one
 * (CLAUDE.md: vendored math is not edited). ⚠️ Throw, never return early:
 * returning from `onFrame` skips the module's event-loop yield and locks the
 * page (the draw demo's trap 3); a throw exits the loop.
 */
export class StargazeAbort extends Error {
  constructor() {
    super("stargaze: run cancelled");
    this.name = "StargazeAbort";
  }
}

type Listener = (on: boolean) => void;

let on = false;
const listeners = new Set<Listener>();

export function isStargazing(): boolean {
  return on;
}

export function subscribeStargaze(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setStargazing(next: boolean): void {
  if (next === on) return;
  on = next;
  document.body.toggleAttribute("data-stargaze", on);
  for (const main of document.querySelectorAll("main")) main.inert = on;
  if (on) trackDemoOnce("stargaze");
  for (const fn of [...listeners]) fn(on);
}

export function useStargazing(): boolean {
  return useSyncExternalStore(subscribeStargaze, isStargazing, () => false);
}

export type OffloadKind = "chess" | "draw" | "headshot";

const offloaded: Record<OffloadKind, number> = { chess: 0, draw: 0, headshot: 0 };

/**
 * Called by a loader AFTER it really released a session / terminated a worker.
 * Mirrored onto `window.__offload` for scripts/verify-redesign.mjs.
 */
export function noteOffload(kind: OffloadKind): void {
  offloaded[kind]++;
  (window as Window & { __offload?: Record<OffloadKind, number> }).__offload = { ...offloaded };
}
