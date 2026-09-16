"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { isStargazing, setStargazing, useStargazing } from "@/lib/stargaze";
import { isListPanelOpen, setHintBottom, setListPanelOpen, useCardCounts, useListPanelOpen } from "@/lib/stargaze-browse";

/**
 * "stargaze for a bit?" in the desk margin above the sheet, and, while
 * stargazing, a fixed bar with a hint and "back to the page". Rendered once
 * from app/layout.tsx, so it exists on every page and no page becomes a
 * client component.
 *
 * Focus follows the mode: entering moves focus to the exit control (the
 * entry button is hidden, and `main` is inert); leaving returns it to the
 * entry button. Escape leaves from anywhere.
 *
 * The hint is chosen by `(hover: none)`: a pointer clicks a drawn name or its
 * symbol, a finger taps one (phones draw names for the coloured objects).
 *
 * Counts and the list (discoverability spec §4): once the sky's data has
 * landed the bar also says how many objects and constellations have cards,
 * both counted from the loaded data by NightSky (lib/stargaze-browse.ts),
 * and offers "browse the list", which opens NightSky's keyboard list as a
 * visible panel. Until the counts exist the bar shows the hint alone; it
 * never shows a zero standing in for data that hasn't arrived.
 *
 * The bar's measured bottom edge is published (setHintBottom) because it
 * wraps on a narrow screen: phone names keep clear of its real height, and
 * the list panel docks below it on desktop and never grows over it on a phone.
 */
export function StargazeToggle() {
  const on = useStargazing();
  const t = copy.stargaze;
  const enterRef = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const counts = useCardCounts();
  const panelOpen = useListPanelOpen();
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

  useEffect(() => {
    const bar = barRef.current;
    if (!on || !bar) return;
    const measure = () => setHintBottom(bar.getBoundingClientRect().bottom);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar, { box: "border-box" });
    return () => {
      ro.disconnect();
      setHintBottom(0);
    };
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
        <div ref={barRef} data-stargaze-bar className="fixed inset-x-0 top-0 z-20 px-4">
          <div className="mx-auto flex min-h-14 max-w-[1000px] items-center justify-between gap-4 py-2 font-mono text-[11px]">
            <p data-stargaze-hint className="text-mut">
              <span data-stargaze-hint-text>{touch ? t.hintTouch : t.hintPointer}</span>
              {counts ? (
                <>
                  <span aria-hidden> · </span>
                  <span data-stargaze-counts>
                    <span data-stargaze-count-objects>{counts.objects}</span>
                    {t.countsObjects}
                    <span data-stargaze-count-constellations>{counts.constellations}</span>
                    {t.countsConstellations}
                  </span>
                  <span aria-hidden> · </span>
                  <button
                    type="button"
                    data-stargaze-browse
                    aria-expanded={panelOpen}
                    onClick={() => setListPanelOpen(!isListPanelOpen())}
                    className="text-ink underline decoration-dotted underline-offset-[3px] transition-colors hover:text-warm"
                  >
                    {t.browseList}
                  </button>
                </>
              ) : null}
            </p>
            <button
              ref={exitRef}
              type="button"
              data-stargaze-exit
              onClick={() => setStargazing(false)}
              className="shrink-0 whitespace-nowrap text-ink underline decoration-dotted underline-offset-[3px] transition-colors hover:text-warm"
            >
              {t.exit}
            </button>
          </div>
        </div>
      ) : null}
      {/* NightSky portals the stargaze keyboard list in here (final review
          F2): right after the exit control in DOM order, so Tab goes from
          "back to the page" straight into what's on screen. Always rendered,
          so it exists before stargaze mode first turns on. */}
      <div data-sky-list-slot />
    </>
  );
}
