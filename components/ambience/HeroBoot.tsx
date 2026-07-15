"use client";

import { useEffect } from "react";
import { warmBackground } from "@/lib/warm";

/**
 * The two side effects the hero's boot beat owns. Renders nothing.
 *
 * Deliberately NOT wired to the boot screen: the warm-up neither waits for the
 * typing nor holds it up. They start together and the boot is only cover for the
 * latency. This still mounts behind the overlay, so the warm runs during it.
 *
 * 1. Warm heavy assets — see lib/warm.ts for what, and for the measurements that
 *    decide what is worth warming at all.
 * 2. Park terminal cursors while the tab is backgrounded. There is no CSS media
 *    query for tab visibility, so this flips `data-tab-hidden` on <html> and
 *    globals.css does the rest. Global on purpose: the section labels blink too,
 *    and they should stop for the same reason.
 */
export function HeroBoot() {
  useEffect(() => {
    warmBackground();

    const sync = () =>
      document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    sync(); // the tab can already be hidden on load — opened in a background tab
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      document.documentElement.removeAttribute("data-tab-hidden");
    };
  }, []);

  return null;
}
