"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
 */
export function DeferredMount({
  children,
  rootMargin = "200px",
}: {
  children: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

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
    <div ref={ref} className={shown ? undefined : "min-h-[200px]"}>
      {shown ? children : null}
    </div>
  );
}
