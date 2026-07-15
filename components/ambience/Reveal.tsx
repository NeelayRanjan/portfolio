"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades and lifts its children in as they enter the viewport.
 *
 * The hidden state lives in CSS (.reveal), not React, so the server renders the
 * final markup and this only flips a data attribute. Reduced-motion callers get
 * the content shown outright — see the .reveal rules in globals.css — and the
 * <noscript> override in layout.tsx un-hides everything when JS never runs.
 */
export function Reveal({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.shown = "true";
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.shown = "true";
        io.disconnect(); // one-way: never re-hide on scroll back up
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
