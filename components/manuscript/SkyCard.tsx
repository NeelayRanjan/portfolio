"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { copy } from "@/content/copy";
import { EMISSION_LINE_COLOUR, type Citation, type SkyFact } from "@/content/sky-facts";
import type { SkyImage } from "@/lib/sky-images";
import type { SkyShower } from "@/lib/sky-objects";

/**
 * The stargaze card (spec docs/superpowers/specs/2026-09-15-sky-objects-design.md §6):
 * title, kind line, the fact's one-liner, any live data lines, the fact's
 * sentences, how to see it, and its sources in APA form. DOM, not canvas, so
 * it is selectable, readable by assistive tech, and its links are real links.
 *
 * The one-liner (controller ruling, task 5): spec §7 says every constellation
 * card carries its origin, and the origin lives only in `fact.oneLiner`. Every
 * card shows it, not just constellations — the facts were reviewed so it
 * never repeats the body.
 *
 * NightSky owns it: which card is open, and where it sits. From 880px up
 * NightSky positions it beside the selection every frame (style.left/top);
 * below 880px it docks to the bottom as a sheet and NightSky leaves the
 * position alone. Citation links are plain, untracked anchors (CLAUDE.md's
 * analytics quota rule: no new events).
 *
 * Final review: below 880px the cap is 60dvh (the dynamic viewport, so a
 * phone's collapsing URL bar can't push the sheet's bottom off screen) and no
 * text is smaller than 12px there; the desktop sizes are unchanged.
 *
 * Fix round 1, I1: below 880px the card was capped at 60vh (the bottom
 * sheet), but at 880px and up it gets the whole viewport height, minus a
 * 16px margin top and bottom, to match `NightSky.tsx`'s `followCard` clamp
 * (`height - 16 - h`) — a shower card's four data lines plus its body used to
 * clip its own Sources list behind the old fixed 60vh cap with ~344px of
 * unused viewport still below it. Content still scrolls inside the card
 * (long constellation origins, showers with every data line) behind a
 * bottom-anchored fade that appears only while there is more to see below
 * and disappears once scrolled to the end — a visible affordance, not a
 * silent clip.
 *
 * Fix round 1, I3: the aside takes focus when it opens (`tabIndex={-1}`,
 * NightSky calls `.focus()`) so Tab reaches the close button and the source
 * links. On a close, NightSky moves focus only if it was inside the card:
 * back to the keyboard-list button that opened it, else to the stargaze exit
 * control (final review F2/F3).
 */

export type CardExtra =
  | { type: "none" }
  | { type: "shower"; shower: SkyShower }
  | { type: "spacecraft"; distanceAu: number; positionDate: string }
  | { type: "iss"; aboveHorizon: boolean; altitudeKm: number; speedKmS: number; epoch: string; still: boolean };

export type CardModel = {
  id: string;
  title: string;
  fact: SkyFact;
  extra: CardExtra;
  /** Galaxies, nebulae, clusters and the Milky Way ("clutter" follow-up,
   *  2026-09-15): their glyphs are drawn far bigger than life, so the card
   *  says so, the same honesty rule as the credit line. */
  notToScale?: boolean;
  /** Set for anything actually drawn in sourced colour (colour round task 7):
   *  an id in `OBJECT_COLOURS`, plus the Milky Way's band. The card then says
   *  the colours come from long exposures and that the eye sees grey. M82 has
   *  no palette, so its card gets no note, which is what keeps this line
   *  honest rather than blanket. */
  colourNote?: boolean;
  /** Of those, the ones whose palette rests on an emission line's own
   *  wavelength (`EMISSION_LINE_COLOURED`): the note gains a sentence and the
   *  Sources list gains `EMISSION_LINE_COLOUR`. Only read when `colourNote`
   *  is set. */
  colourEmissionLines?: boolean;
  /** The card's photograph (spec 2026-09-16): the index entry plus the
   *  index's generation date, which is the citation's access date. Absent
   *  for stars, constellations, showers, the Voyagers and the Kepler field. */
  image?: SkyImage & { accessed: string };
};

const LONG_DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** Time on its own: a combined date-time format inserts locale glue ("at") that varies by engine. */
const TIME = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** "2026-09-15" -> "September 15, 2026". */
const longDate = (iso: string) => LONG_DATE.format(new Date(`${iso}T00:00:00Z`));
/** "08-13" -> "Aug 13" (the year only fixes the calendar; these windows recur). */
const monthDay = (md: string) => SHORT_DATE.format(new Date(Date.UTC(2026, Number(md.slice(0, 2)) - 1, Number(md.slice(3)))));
const period = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);

function CitationItem({ c }: { c: Citation }) {
  const t = copy.stargaze.card;
  return (
    <li>
      {period(c.author)} ({c.year}). <i>{period(c.title)}</i> {period(c.site)} {t.retrieved} {longDate(c.accessed)},{" "}
      {t.from}{" "}
      <a href={c.url} target="_blank" rel="noopener" className="break-all text-link underline underline-offset-2">
        {c.url}
      </a>
    </li>
  );
}

/**
 * The card's own sources, plus the emission-line colour source on the cards
 * whose colour note names emission lines (colour round task 7). It is one
 * shared citation for a claim fifteen cards would otherwise each have to
 * carry, so it is appended here rather than written into every fact. Deduped
 * by url in case a fact ever cites the same page itself.
 */
function cardCitations(model: CardModel): Citation[] {
  const base = model.fact.citations;
  const out = !model.colourNote || !model.colourEmissionLines || base.some((c) => c.url === EMISSION_LINE_COLOUR.url) ? base : [...base, EMISSION_LINE_COLOUR];
  if (!model.image) return out;
  return [
    ...out,
    {
      author: model.image.author,
      year: "n.d.",
      title: `${model.image.sourceTitle}${copy.stargaze.card.imageSourceSuffix}`,
      site: copy.stargaze.card.imageSite,
      url: model.image.sourceUrl,
      accessed: model.image.accessed,
    },
  ];
}

function extraLines(extra: CardExtra): string[] {
  const t = copy.stargaze.card;
  switch (extra.type) {
    case "shower": {
      const s = extra.shower;
      return [
        `${t.showerActive}${monthDay(s.start)}${t.showerTo}${monthDay(s.end)}${t.showerPeak}${monthDay(s.peak)}${t.showerZhr}${s.zhr}.`,
        `${t.showerParent}${s.parent}.`,
        t.showerDrift,
        t.showerTable,
      ];
    }
    case "spacecraft":
      return [`${t.spacecraftPre}${longDate(extra.positionDate)}${t.spacecraftMid}${extra.distanceAu.toFixed(1)}${t.spacecraftPost}`];
    case "iss":
      return [
        extra.aboveHorizon ? t.issAbove : t.issBelow,
        `${t.issAltitude}${Math.round(extra.altitudeKm)}${t.issSpeed}${extra.speedKmS.toFixed(2)}${t.issSpeedPost}`,
        `${t.issEpoch}${LONG_DATE.format(new Date(extra.epoch))}, ${TIME.format(new Date(extra.epoch))}${t.issEpochPost}`,
        extra.still ? t.issClockStill : t.issClock,
      ];
    case "none":
      return [];
  }
}

export function SkyCard({
  model,
  outOfView,
  cardRef,
  onClose,
}: {
  model: CardModel;
  /** The subject has left the viewport (final review F3): the card stays open and says so. */
  outOfView: boolean;
  cardRef: Ref<HTMLElement>;
  onClose: () => void;
}) {
  const t = copy.stargaze.card;
  const titleId = `sky-card-title-${model.id}`;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Whether there is more content below the fold (fix round 1, I1): the fade
  // shows only while scrolling would reveal more and hides once the last
  // pixel is in view, so it never lies about there being anything left.
  const [showFade, setShowFade] = useState(false);
  // A photograph that 404s (a stale index entry, a moved file) falls back to
  // the card's un-photographed layout rather than an empty box or a broken-
  // image glyph (task 3): the box is sized by CSS aspect-ratio before load,
  // so this never causes a layout jump, only a removal.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [model.id]);
  const showImage = !!model.image && !imageFailed;

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
    setShowFade(overflowing && !atBottom);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
    // model.id: a new card's content can overflow (or stop overflowing)
    // differently from the last one, at the same viewport size.
  }, [checkScroll, model.id]);

  return (
    <aside
      ref={cardRef}
      data-sky-card={model.id}
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-rule bg-panel/95 shadow-[0_0_40px_rgba(0,0,0,0.6)] outline-none min-[880px]:right-auto min-[880px]:bottom-auto min-[880px]:w-[320px] min-[880px]:border"
    >
      {showImage ? (
        // Sized by CSS aspect-ratio, never by the bitmap (owner layout call):
        // the card's cached offsetHeight (card-controller.ts's updateCardSize,
        // read on open/resize/ResizeObserver) must be correct before the
        // photograph itself has loaded, or the viewport clamp in followCard
        // would be a frame behind. 2:1 capped at 28dvh below 880px (so the
        // whole docked card stays under its 60dvh cap); 4:3 uncapped from
        // 880px, where the card no longer docks to the viewport height.
        <figure
          data-sky-card-image
          className="m-0 aspect-[2/1] max-h-[28dvh] w-full overflow-hidden border-b border-rule min-[880px]:aspect-[4/3] min-[880px]:max-h-none"
        >
          {/* model.image is narrowed non-null by showImage, but TS can't see
              that through the state read above. */}
          <img
            src={model.image!.src}
            alt={model.image!.alt}
            width={model.image!.width}
            height={model.image!.height}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        </figure>
      ) : null}
      <div
        ref={scrollRef}
        className={[
          "overflow-y-auto px-4 py-4 font-mono text-[12px] leading-relaxed text-mut min-[880px]:text-[11px]",
          showImage ? "max-h-[32dvh] min-[880px]:max-h-[calc(100vh-32px-240px)]" : "max-h-[60dvh] min-[880px]:max-h-[calc(100vh-32px)]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-serif text-[17px] leading-snug text-ink">
            {model.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeAria}
            className="shrink-0 underline decoration-dotted underline-offset-[3px] transition-colors hover:text-ink"
          >
            {t.close}
          </button>
        </div>
        <p data-sky-card-kind className="mt-1 text-warm">
          {model.fact.kind}
        </p>
        {showImage ? (
          <p data-sky-card-image-credit className="mt-1 text-mut/80">
            {t.imageCredit}
            {model.image!.author} · {model.image!.license}
            {model.image!.note ? ` ${model.image!.note}` : ""}
          </p>
        ) : null}
        {/* Polite, so a screen reader hears the subject leave (and the
            line go) without the card itself being re-announced. */}
        <div aria-live="polite">
          {outOfView ? (
            <p data-sky-card-out-of-view className="mt-1 text-ink">
              {t.outOfView}
            </p>
          ) : null}
        </div>
        <p data-sky-card-oneliner className="mt-1 italic text-mut/90">
          {model.fact.oneLiner}
        </p>
        {extraLines(model.extra).map((line) => (
          <p key={line} data-sky-card-data className="mt-1">
            {line}
          </p>
        ))}
        {model.notToScale ? (
          <p data-sky-card-not-to-scale className="mt-1">
            {t.notToScale}
          </p>
        ) : null}
        {model.colourNote ? (
          <p data-sky-card-colour-note className="mt-1">
            {t.colourNote}
            {model.colourEmissionLines ? ` ${t.colourNoteLines}` : ""}
          </p>
        ) : null}
        <p className="mt-3 font-serif text-[13px] leading-snug text-ink/90">{model.fact.body.join(" ")}</p>
        <p data-sky-card-visibility className="mt-2">
          {model.fact.visibility}
        </p>
        <h3 className="mt-3 text-[12px] text-mut/80 min-[880px]:text-[10px]">{t.sources}</h3>
        <ol data-sky-card-sources className="mt-1 space-y-1 text-[12px] leading-snug min-[880px]:text-[10px]">
          {cardCitations(model).map((c) => (
            <CitationItem key={c.url} c={c} />
          ))}
        </ol>
      </div>
      {showFade ? (
        <div
          data-sky-card-fade
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-panel/95 to-transparent"
        />
      ) : null}
    </aside>
  );
}
