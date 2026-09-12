import type { ReactNode } from "react";

/**
 * An instrument figure: the panel chrome every demo/figure on the page uses.
 * Replaces v1's `TerminalPanel` sitewide (see CLAUDE.md's recurring-motif
 * section for the thing this superseded).
 *
 * - Two corner ticks (top-left, bottom-right), `aria-hidden` — pure
 *   decoration standing in for the mockup's `::before`/`::after` pseudo
 *   elements, which Tailwind utilities can't target directly. Real spans,
 *   not pseudo-elements, so no arbitrary-CSS escape hatch is needed.
 * - `readout` is optional, top-right, amber/`text-warm` mono — for a control
 *   with live state worth echoing (a slider position, a step count). Absent
 *   for figures with nothing to read out.
 * - The caption is always `Figure {n}.` in bold ink, followed by serif
 *   `text-mut` prose — never mono. The figure NUMBER is data (`n`), not the
 *   word "Figure", since later figures are strings like "S1" (/lab).
 */
export function InstrumentFigure({
  n,
  caption,
  readout,
  children,
  id,
}: {
  n: string;
  caption: ReactNode;
  readout?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <figure id={id} className="relative my-8 border border-rule bg-panel p-5">
      <span
        aria-hidden
        className="absolute -top-px -left-px h-2.5 w-2.5 border-t-2 border-l-2 border-mut"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-mut"
      />
      {readout ? (
        <span className="absolute top-3 right-4 font-mono text-[11px] font-semibold text-warm tabular-nums">
          {readout}
        </span>
      ) : null}
      {children}
      <figcaption className="mt-3.5 text-sm leading-relaxed text-mut">
        <b className="font-semibold text-ink">Figure {n}.</b> {caption}
      </figcaption>
    </figure>
  );
}
