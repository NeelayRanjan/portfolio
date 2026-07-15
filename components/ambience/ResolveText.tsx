"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Text that resolves out of noise when it scrolls into view.
 *
 * The site's whole language is things resolving: noise into a digit, masked cells
 * into characters, a scattered swarm into a nameplate. A section label that
 * arrives the same way is that idea at a glance, and it costs one short timer.
 *
 * ONE-SHOT, then static. That keeps it in the same category as the scroll reveals
 * rather than becoming a second thing that never stops moving — the page below
 * the hero stays calm (see Page ambience in CLAUDE.md).
 *
 * The scramble charset is the ASCII ramp, not random letters: the same glyphs the
 * diffusion panels resolve through, so it reads as denoising rather than as a
 * hacker-movie effect.
 */
const RAMP = " .:-=+*#%@";
/** How long a character stays noise before locking, plus its stagger down the
 *  line. Left-to-right, so it reads as resolving rather than flickering. */
const STAGGER_MS = 55;
const SETTLE_MS = 260;
/** Re-roll the noise glyphs at ~20fps: fast enough to shimmer, slow enough to
 *  read as characters rather than a blur. */
const ROLL_MS = 50;

export function ResolveText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  // Server-renders the real text, so crawlers and a JS-less browser get it
  // outright. The scramble only ever replaces it on the client.
  const [shown, setShown] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let start = 0;
    let lastRoll = 0;
    let done = false;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      // Every character has its own moment to lock, marching left to right.
      const total = text.length * STAGGER_MS + SETTLE_MS;
      if (t >= total) {
        setShown(text);
        done = true;
        return;
      }
      if (now - lastRoll >= ROLL_MS) {
        lastRoll = now;
        let out = "";
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === " ") {
            out += " "; // spaces are structure; scrambling them jitters the width
            continue;
          }
          out += t >= i * STAGGER_MS + SETTLE_MS
            ? ch
            : RAMP[(Math.random() * RAMP.length) | 0];
        }
        setShown(out);
      }
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done) return;
        io.disconnect(); // resolve once; never replay on scroll-back
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
