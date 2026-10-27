"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/content/copy";

/**
 * Mount `children` only once this slot first reaches the viewport.
 *
 * This replaces v1's boot-log gate. The typed terminal boot was theatre, but it
 * was also the LOADING STRATEGY: a panel's heavy work (a 26MB model, a 3MB
 * trajectory, chess.js) started when `done` flipped rather than on page load.
 * Dropping the theatre would have quietly moved every payload to first paint, so
 * the deferral survives on its own here.
 *
 * ⚠️ It fires under `prefers-reduced-motion` too, and that is deliberate: this is
 * a loading strategy, not an animation. Reduced-motion visitors skip animation,
 * they do not volunteer to download every model up front.
 *
 * One-way and one-shot — the observer disconnects on the first intersection, so
 * scrolling back past a mounted demo never unmounts or re-mounts it (which would
 * throw away a drawing, a game, or a loaded session).
 *
 * The pre-mount wrapper carries a `min-h` so the observer has a real box to
 * intersect: a zero-height div wedged between two sections can be scrolled past
 * without ever satisfying the callback on some layouts.
 *
 * KEYBOARD (2026-10-26 audit): an unmounted slot has nothing focusable in it,
 * so Tab went from Figure 2's slider straight to References and a keyboard
 * visitor never met the rerouter, chess or the lander. The empty slot is now a
 * tab stop. Focusing it mounts the children (a focus also scrolls it into
 * view, so the observer would have fired anyway), keeps focus on the same
 * wrapper element (now tabIndex -1), and moves it to the first focusable
 * control inside once one renders, if focus hasn't gone elsewhere first.
 * Mounting is still only ever caused by the visitor reaching the slot.
 */
export function DeferredMount({
  children,
  rootMargin = "200px",
  id,
}: {
  children: ReactNode;
  rootMargin?: string;
  /** An anchor that exists before the children mount (Table 1 links to the
   *  deferred figures through it), with scroll margin like the headings. */
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  // Set only by a keyboard mount: the wrapper then stays programmatically
  // focusable (tabIndex -1) so focus can sit on it until a control renders.
  // A scroll mount leaves the wrapper a plain div, as it always was.
  const [viaFocus, setViaFocus] = useState(false);
  const focusInside = useRef(false);

  // After a keyboard mount: hand focus to the first control inside as soon as
  // the children render one (they may load in stages), for up to 5 s.
  useEffect(() => {
    if (!shown || !focusInside.current) return;
    focusInside.current = false;
    const el = ref.current;
    if (!el) return;
    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const tryFocus = () => {
      if (document.activeElement !== el) return true; // the visitor moved on
      const target = el.querySelector<HTMLElement>(FOCUSABLE);
      if (!target) return false;
      target.focus();
      return true;
    };
    if (tryFocus()) return;
    const mo = new MutationObserver(() => {
      if (tryFocus()) stop();
    });
    const timer = window.setTimeout(() => stop(), 5000);
    const stop = () => {
      mo.disconnect();
      window.clearTimeout(timer);
    };
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    return stop;
  }, [shown]);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect(); // mount once; never replay on scroll-back
        setShown(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return (
    <div
      ref={ref}
      id={id}
      className={[shown ? "" : "min-h-[200px]", id ? "scroll-mt-6" : ""].filter(Boolean).join(" ") || undefined}
      tabIndex={shown ? (viaFocus ? -1 : undefined) : 0}
      role={shown ? undefined : "group"}
      aria-label={shown ? undefined : copy.deferredFigure}
      onFocus={
        shown
          ? undefined
          : (e) => {
              if (e.target !== e.currentTarget) return;
              focusInside.current = true;
              setViaFocus(true);
              setShown(true);
            }
      }
    >
      {shown ? children : null}
    </div>
  );
}
