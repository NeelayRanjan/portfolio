"use client";

import type { Ref } from "react";
import { copy } from "@/content/copy";
import type { Citation, SkyFact } from "@/content/sky-facts";
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
 */

export type CardExtra =
  | { type: "none" }
  | { type: "shower"; shower: SkyShower }
  | { type: "spacecraft"; distanceAu: number; positionDate: string };

export type CardModel = { id: string; title: string; fact: SkyFact; extra: CardExtra };

const LONG_DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

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
    case "none":
      return [];
  }
}

export function SkyCard({ model, cardRef, onClose }: { model: CardModel; cardRef: Ref<HTMLElement>; onClose: () => void }) {
  const t = copy.stargaze.card;
  const titleId = `sky-card-title-${model.id}`;
  return (
    <aside
      ref={cardRef}
      data-sky-card={model.id}
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto border-t border-rule bg-panel/95 px-4 py-4 font-mono text-[11px] leading-relaxed text-mut shadow-[0_0_40px_rgba(0,0,0,0.6)] min-[880px]:right-auto min-[880px]:bottom-auto min-[880px]:w-[320px] min-[880px]:border"
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
      <p data-sky-card-oneliner className="mt-1 italic text-mut/90">
        {model.fact.oneLiner}
      </p>
      {extraLines(model.extra).map((line) => (
        <p key={line} data-sky-card-data className="mt-1">
          {line}
        </p>
      ))}
      <p className="mt-3 font-serif text-[13px] leading-snug text-ink/90">{model.fact.body.join(" ")}</p>
      <p data-sky-card-visibility className="mt-2">
        {model.fact.visibility}
      </p>
      <h3 className="mt-3 text-[10px] text-mut/80">{t.sources}</h3>
      <ol data-sky-card-sources className="mt-1 space-y-1 text-[10px] leading-snug">
        {model.fact.citations.map((c) => (
          <CitationItem key={c.url} c={c} />
        ))}
      </ol>
    </aside>
  );
}
