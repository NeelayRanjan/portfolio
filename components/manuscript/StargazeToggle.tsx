"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { isStargazing, setStargazing, useStargazing } from "@/lib/stargaze";

/**
 * "stargaze for a bit?" in the desk margin above the sheet, and, while
 * stargazing, a fixed bar with a hint and "back to the page". Rendered once
 * from app/layout.tsx, so it exists on every page and no page becomes a
 * client component.
 *
 * Focus follows the mode: entering moves focus to the exit control (the
 * entry button is hidden, and `main` is inert); leaving returns it to the
 * entry button. Escape leaves from anywhere.
 */
export function StargazeToggle() {
  const on = useStargazing();
  const t = copy.stargaze;
  const enterRef = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const wasOn = useRef(false);
  const [ready, setReady] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    setReady(true);
    setTouch(window.matchMedia("(hover: none)").matches);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStargazing()) setStargazing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (on) {
      wasOn.current = true;
      exitRef.current?.focus();
    } else if (wasOn.current) {
      wasOn.current = false;
      enterRef.current?.focus();
    }
  }, [on]);

  return (
    <>
      <div
        data-stargaze-toggle
        data-ready={ready ? "" : undefined}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4"
      >
        <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-end">
          <button
            ref={enterRef}
            type="button"
            hidden={on}
            onClick={() => setStargazing(true)}
            className="pointer-events-auto font-mono text-[11px] text-mut underline decoration-dotted underline-offset-[3px] transition-colors hover:text-ink"
          >
            {t.enter}
          </button>
        </div>
      </div>
      {on ? (
        <div className="fixed inset-x-0 top-0 z-20 px-4">
          <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between gap-4 font-mono text-[11px]">
            <span className="text-mut">{touch ? t.hintTouch : t.hintPointer}</span>
            <button
              ref={exitRef}
              type="button"
              data-stargaze-exit
              onClick={() => setStargazing(false)}
              className="text-ink underline decoration-dotted underline-offset-[3px] transition-colors hover:text-warm"
            >
              {t.exit}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
