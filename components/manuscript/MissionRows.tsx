type Status = "active" | "scheduled" | "complete" | "ongoing";

// Lamp color encodes state; only "active" gets the glow (a genuinely running
// thing), matching the mockup's `.live .lamp` box-shadow. "scheduled" is
// amber/warm with no glow (booked, not running). "complete"/"ongoing" both
// read as settled and share the muted lamp — there's no third color for a
// fourth state, and CLAUDE.md's red-discipline rule (this file uses none of
// it) leaves nothing for a "the good kind of done" hue anyway.
const LAMP_CLASS: Record<Status, string> = {
  active: "bg-ok shadow-[0_0_8px_var(--color-ok)]",
  scheduled: "bg-warm",
  complete: "bg-mut",
  ongoing: "bg-mut",
};

// The status word always renders beside the lamp (see below) — this just
// tints the word to match, so color is a second, not the only, carrier.
const STATUS_TEXT_CLASS: Record<Status, string> = {
  active: "text-ok",
  scheduled: "text-warm",
  complete: "text-mut",
  ongoing: "text-mut",
};

/**
 * Mission rows: one line per role, meant to sit inside a single
 * `InstrumentFigure` (see spec §5, "Experience"). Each row is
 * `lamp · when · who · what · status` on desktop, matching the mockup's
 * 5-column grid in DOM order (so no explicit reordering is needed there —
 * plain grid auto-flow lands every field in its mockup column).
 *
 * Below 880px that 5-column row (14px/116px/200px/1fr/auto — already over
 * 400px of fixed-width columns before any text) would force horizontal
 * scroll on a phone, so each row explicitly re-places its five children into
 * a 3-column/3-row block instead of hiding any of them: lamp+who+status
 * share the top line, `when` and `what` each drop to their own full-width
 * line below. Nothing the mockup showed on desktop disappears on mobile —
 * verify at 400px that this reflow, not truncation, is what's happening.
 *
 * 🔒 Status is never color-alone: the lamp is `aria-hidden` and decorative,
 * the status word is real text every time.
 */
export function MissionRows({
  rows,
}: {
  rows: {
    when: string;
    who: string;
    what: string;
    status: Status;
  }[];
}) {
  return (
    <div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[14px_1fr_auto] items-baseline gap-x-3 gap-y-1 border-t border-rule py-3.5 text-[15px] first:border-t-0 min-[880px]:grid-cols-[14px_116px_200px_1fr_auto] min-[880px]:items-baseline min-[880px]:gap-x-3.5 min-[880px]:gap-y-0"
        >
          <span
            aria-hidden
            className={`col-start-1 row-start-1 inline-block h-2 w-2 self-center rounded-full min-[880px]:col-start-1 min-[880px]:row-start-1 ${LAMP_CLASS[row.status]}`}
          />
          <span className="col-start-2 col-span-2 row-start-2 font-mono text-[11px] text-mut min-[880px]:col-start-2 min-[880px]:col-span-1 min-[880px]:row-start-1">
            {row.when}
          </span>
          <span className="col-start-2 row-start-1 font-semibold text-ink min-[880px]:col-start-3 min-[880px]:row-start-1">
            {row.who}
          </span>
          <span className="col-start-2 col-span-2 row-start-3 text-mut min-[880px]:col-start-4 min-[880px]:col-span-1 min-[880px]:row-start-1">
            {row.what}
          </span>
          <span
            className={`col-start-3 row-start-1 justify-self-end font-mono text-[11px] min-[880px]:col-start-5 min-[880px]:row-start-1 min-[880px]:justify-self-auto ${STATUS_TEXT_CLASS[row.status]}`}
          >
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}
