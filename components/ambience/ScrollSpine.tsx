"use client";

import { useEffect, useRef } from "react";

/**
 * A thin scroll-position spine in the left margin.
 *
 * This was the "diffusion timestep rail": it labelled the top `x_T · t=1000` and
 * the footer `x̂₀ · t=0`, on the conceit that the page was one reverse-diffusion
 * pass. That conceit belonged to the migrating swarm, which is gone. The
 * CharField does re-diffuse as you scroll, but only locally — a patch scrambles
 * and re-resolves wherever a section arrives. It is not a monotonic denoise from
 * hero to footer, so the countdown would be claiming something the page doesn't
 * do. The labels went; the spine stayed.
 *
 * It is now exactly what it looks like: a quiet readout of how far down you are.
 *
 * Driven by scroll position, never a timer, and written through refs rather than
 * state — a setState per scroll event would re-render the page tree 60x a second
 * to move a 1px tick. The tick tracks scroll 1:1 with no easing, so there's no
 * motion of its own to disable under reduced-motion; it's a readout, like a
 * scrollbar. Hidden below xl, where there's no margin to live in.
 */
export function ScrollSpine() {
  const lineRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<HTMLDivElement>(null);

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
      if (tickRef.current) {
        tickRef.current.style.transform = `translateY(${progress * railHeight}px)`;
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
      className="pointer-events-none fixed top-0 left-7 z-30 hidden h-screen select-none xl:block"
    >
      <div
        ref={lineRef}
        className="absolute top-[16vh] bottom-[16vh] left-0 w-px bg-[--color-rail]"
      >
        <div
          ref={tickRef}
          className="absolute top-0 -left-[3px] h-px w-[7px] bg-indigo"
        />
      </div>
    </div>
  );
}
