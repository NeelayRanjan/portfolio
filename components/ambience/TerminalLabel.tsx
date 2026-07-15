"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A panel's command label, with a little life: a blinking cursor, and every so
 * often the last flag re-types itself.
 *
 * A quirk, not a distraction. The retype is rare, quick, and staggered per panel
 * so they never fire together — several headers twitching in unison would read as
 * a glitch rather than as a terminal sitting there.
 *
 * Under prefers-reduced-motion neither happens: no blink, no retype, just text.
 */

/** Same charset the rest of the site scrambles through. */
const NOISE = " .:-=+*#%@/\\|_";
/** Rare. This is the difference between a quirk and a nuisance. */
const RETYPE_MIN_MS = 9000;
const RETYPE_MAX_MS = 20000;
/** Quick: the whole flicker is under a third of a second. */
const SCRAMBLE_MS = 240;
const SCRAMBLE_STEP_MS = 55;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export function TerminalLabel({ text }: { text: string }) {
  // Server-renders the real label: this is a decoration on top of text that must
  // exist regardless.
  const [shown, setShown] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setShown(text); // the label is live (digit pickers, modes) — follow it
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Only the LAST token flickers. Scrambling the command name would look like
    // the panel broke; scrambling a flag looks like it's re-reading its config.
    const cut = text.lastIndexOf(" ");
    if (cut < 0) return;
    const head = text.slice(0, cut + 1);
    const tail = text.slice(cut + 1);
    if (!tail) return;

    let timers: number[] = [];
    let cancelled = false;

    const retype = () => {
      if (cancelled) return;
      const start = performance.now();
      const step = () => {
        if (cancelled) return;
        const t = performance.now() - start;
        if (t >= SCRAMBLE_MS) {
          setShown(head + tail);
          schedule();
          return;
        }
        let out = "";
        for (let i = 0; i < tail.length; i++) {
          // Resolve left to right, so it reads as re-typing rather than as static.
          out +=
            t / SCRAMBLE_MS > (i + 1) / tail.length
              ? tail[i]
              : NOISE[(Math.random() * NOISE.length) | 0];
        }
        setShown(head + out);
        timers.push(window.setTimeout(step, SCRAMBLE_STEP_MS));
      };
      step();
    };

    const schedule = () => {
      timers.push(window.setTimeout(retype, rand(RETYPE_MIN_MS, RETYPE_MAX_MS)));
    };
    // Stagger the first one per instance, so panels never fire in unison.
    timers.push(window.setTimeout(schedule, rand(0, 6000)));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers = [];
    };
  }, [text]);

  return (
    <span ref={ref}>
      {shown}
      {/* The blink is a CSS animation, so it costs no JS at all. The global
          reduced-motion rule collapses its duration, leaving a static cursor. */}
      <span
        aria-hidden="true"
        className="ml-1 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] animate-[blink_1.1s_steps(1)_infinite] bg-faint align-baseline"
      />
    </span>
  );
}
