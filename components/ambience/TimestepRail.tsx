"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-linked reverse-diffusion rail in the left margin.
 *
 * Conceit: the whole page is one reverse-diffusion pass — noise at the hero,
 * resolved at the footer. The tick reads scroll progress and counts the
 * timestep down from T to 0.
 *
 * Driven by scroll position, never a timer, and it writes to the DOM through
 * refs rather than React state: a setState per scroll event would re-render the
 * page tree 60x a second to move a 1px line.
 *
 * The tick tracks scroll 1:1 with no easing, so it has no motion of its own to
 * disable under reduced-motion — it's a readout, like a scrollbar. Hidden below
 * xl, where there's no margin to live in.
 */
const T_MAX = 1000;

export function TimestepRail() {
  const lineRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let railHeight = 0;

    const measure = () => {
      railHeight = lineRef.current?.offsetHeight ?? 0;
    };

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const progress =
        scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      const y = progress * railHeight;

      if (tickRef.current) tickRef.current.style.transform = `translateY(${y}px)`;
      if (labelRef.current) {
        labelRef.current.style.transform = `translateY(${y}px)`;
        labelRef.current.textContent = `t=${Math.round((1 - progress) * T_MAX)}`;
      }
    };

    const onScroll = () => {
      // Coalesce bursts of scroll events into one write per frame.
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-7 top-0 z-30 hidden h-screen select-none xl:block"
    >
      {/* Sits well clear of the tick's own label, which parks here at scroll 0. */}
      <span className="absolute top-[16vh] left-3 -translate-y-8 font-mono text-[10px] whitespace-nowrap text-[--color-rail-label]">
        x_T · t={T_MAX}
      </span>

      <div
        ref={lineRef}
        className="absolute top-[16vh] bottom-[16vh] left-0 w-px bg-[--color-rail]"
      >
        <div
          ref={tickRef}
          className="absolute top-0 -left-[3px] h-px w-[7px] bg-indigo"
        />
        <span
          ref={labelRef}
          className="absolute top-0 left-3 -translate-y-1/2 font-mono text-[10px] whitespace-nowrap text-indigo"
        >
          t={T_MAX}
        </span>
      </div>

      <span className="absolute bottom-[16vh] left-3 translate-y-8 font-mono text-[10px] whitespace-nowrap text-[--color-rail-label]">
        x̂₀ · t=0
      </span>
    </div>
  );
}
