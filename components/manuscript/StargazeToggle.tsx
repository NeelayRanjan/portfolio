"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { getStargazeEntry, isStargazing, setStargazing, useStargazing } from "@/lib/stargaze";
import { StarMark } from "./StarMark";
import { isListPanelOpen, setHintBottom, setListPanelOpen, useCardCounts, useListHasItems, useListPanelOpen } from "@/lib/stargaze-browse";

/**
 * "stargaze for a bit?" in the desk margin above the sheet, and, while
 * stargazing, a fixed bar with a hint and "back to the page". Rendered once
 * from app/layout.tsx, so it exists on every page and no page becomes a
 * client component.
 *
 * Focus follows the mode: entering moves focus to the exit control (the
 * entry button is hidden, and `main` is inert); leaving returns it to the
 * door the visitor came in by, this toggle or the footer button
 * (StargazeFooterEntry), so both doors behave the same. Escape leaves from
 * anywhere.
 *
 * The chrome's backing (discoverability Task 6): the hint and the exit
 * control each sit on a desk-toned pill, the same #0c0b09 at 0.85 the sky's
 * hover label uses, so a drawn name passing under them can't print through
 * the text. Each pill is `data-stargaze-chrome`: it is a control, so it takes
 * the pointer over its own box (no hover, no drag, no card for a name hidden
 * under it; night-sky/pointer-controller.ts). The bar between the pills is
 * pointer-transparent, because the sky there is visible and stays live.
 *
 * The hint is chosen by `(hover: none)`: a pointer clicks a drawn name or its
 * symbol, a finger taps one (phones draw names for the coloured objects).
 *
 * Counts and the list (discoverability spec §4): once the sky's data has
 * landed the bar also says how many objects and constellations have cards,
 * both counted from the loaded data by NightSky (lib/stargaze-browse.ts),
 * and more, and offers "browse the list", which opens NightSky's keyboard
 * list as a visible panel. Until the counts exist the bar shows no counts; it
 * never shows a zero standing in for data that hasn't arrived. The browse
 * control follows the list itself, not the counts: it shows whenever the
 * list has something in it (or the panel is open), so an absent objects.json
 * doesn't hide a list that still holds constellations (final review m2).
 *
 * The bar's measured bottom edge is published (setHintBottom) because it
 * wraps on a narrow screen: phone names keep clear of its real height, and
 * the list panel docks below it on desktop and never grows over it on a phone.
 */
/** The desk-toned backing shared by the stargaze chrome (the hint, the exit
 *  control, and the credit via globals.css): the desk at 0.85, as the sky's
 *  own hover label, with a feathered edge so it reads as shade, not a box. */
const CHROME_PILL =
  "pointer-events-auto rounded-md bg-desk/85 px-2 py-1 shadow-[0_0_8px_4px_rgb(12_11_9/0.85)]";

export function StargazeToggle() {
  const on = useStargazing();
  const t = copy.stargaze;
  const enterRef = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const counts = useCardCounts();
  const panelOpen = useListPanelOpen();
  const listHasItems = useListHasItems();
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
      const footer = getStargazeEntry() === "footer" ? document.querySelector<HTMLElement>("[data-stargaze-footer-enter]") : null;
      (footer ?? enterRef.current)?.focus({ preventScroll: true });
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
            onClick={() => setStargazing(true, "toggle")}
            className="pointer-events-auto inline-flex items-baseline font-mono text-[11px] text-mut underline decoration-dotted underline-offset-[3px] transition-colors hover:text-ink"
          >
            <StarMark />
            {t.enter}
          </button>
        </div>
      </div>
      {on ? (
        <div ref={barRef} data-stargaze-bar className="pointer-events-none fixed inset-x-0 top-0 z-20 px-4">
          <div className="mx-auto flex min-h-14 max-w-[1000px] items-center justify-between gap-4 py-2 font-mono text-[11px]">
            <p data-stargaze-hint data-stargaze-chrome className={`${CHROME_PILL} text-mut`}>
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
                </>
              ) : null}
              {listHasItems || panelOpen ? (
                <>
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
              data-stargaze-chrome
              onClick={() => setStargazing(false)}
              className={`${CHROME_PILL} shrink-0 whitespace-nowrap text-ink underline decoration-dotted underline-offset-[3px] transition-colors hover:text-warm`}
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
