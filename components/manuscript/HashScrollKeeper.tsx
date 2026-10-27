"use client";

import { useEffect } from "react";

/**
 * Keeps an in-page jump on its target while deferred figures mount above it
 * (round 2, 2026-10-27). The contents line and Table 1 link to sections
 * below figures that mount on scroll-in and grow from a 200px placeholder.
 * Firefox and Chrome keep the target in place with CSS scroll anchoring; an
 * engine without it (WebKit, as far as we know: measured here only by
 * forcing `overflow-anchor: none` in Firefox) let "Experience" drift a
 * screen past the viewport as chess and the lander mounted above it.
 *
 * For 4 s after a hash jump, each time the page's size changes, the target
 * is scrolled back to its own scroll-margin. It stands down at once if the
 * visitor scrolls with a wheel, a touch or a key, so it never fights them,
 * and does nothing where anchoring already held the target (off by 4px or
 * less).
 */
export function HashScrollKeeper() {
  useEffect(() => {
    let target: HTMLElement | null = null;
    let until = 0;
    let userMoved = false;
    const arm = (id: string) => {
      target = id ? document.getElementById(id) : null;
      until = performance.now() + 4000;
      userMoved = false;
    };
    const onHash = () => arm(decodeURIComponent(location.hash.slice(1)));
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const id = a?.getAttribute("href")?.slice(1);
      // After the browser's own jump (a same-hash click fires no hashchange).
      if (id) window.setTimeout(() => arm(decodeURIComponent(id)), 0);
    };
    const stand = () => {
      userMoved = true;
    };
    const ro = new ResizeObserver(() => {
      if (!target || userMoved || performance.now() > until) return;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      if (Math.abs(target.getBoundingClientRect().top - margin) > 4) target.scrollIntoView({ block: "start" });
    });
    ro.observe(document.body);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    for (const ev of ["wheel", "touchstart", "keydown"] as const) window.addEventListener(ev, stand, { passive: true });
    if (location.hash.length > 1) onHash();
    return () => {
      ro.disconnect();
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      for (const ev of ["wheel", "touchstart", "keydown"] as const) window.removeEventListener(ev, stand);
    };
  }, []);
  return null;
}
