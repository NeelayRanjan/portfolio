"use client";

import { useSyncExternalStore } from "react";

/**
 * Who the shell thinks you are.
 *
 * The boot screen asks `whoami` and answers `neelay`, and that answer is
 * editable. Change it and every terminal prompt on the page follows: the boot's
 * own second prompt, and each section panel's boot log. That is the whole payoff
 * of the easter egg, so the name lives here rather than in the boot screen's
 * state — the section panels are nowhere near it in the tree.
 *
 * Deliberately NOT persisted. A reload puts it back to `neelay`, which means the
 * toy can't strand a visitor in a state they can't explain or undo, and there is
 * no storage read to trip hydration.
 */
const DEFAULT_USER = "neelay";
const HOST = "latent";

let user = DEFAULT_USER;
const subs = new Set<() => void>();

/**
 * Fold input down to what can sit in a shell prompt without looking absurd.
 * Lowercase, no spaces, no punctuation beyond the usual, and short enough that
 * a long paste can't push the prompt across the viewport. Returns "" for empty
 * rather than the default, so the caller can tell "cleared" from "unset".
 */
export const cleanUser = (raw: string) =>
  raw.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 12);

export function setUser(raw: string) {
  const next = cleanUser(raw) || DEFAULT_USER;
  if (next === user) return;
  user = next;
  for (const f of subs) f();
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Server always renders the default, and the client starts there too, so the
 *  first client render matches the HTML and nothing tears on hydration. */
export function useUser(): string {
  return useSyncExternalStore(
    subscribe,
    () => user,
    () => DEFAULT_USER,
  );
}

export const promptFor = (u: string) => `${u}@${HOST}:~$`;

/** `neelay@latent:~$`, or yours. */
export function usePrompt(): string {
  return promptFor(useUser());
}

export { DEFAULT_USER, HOST };
