import type { Piece } from "@/content/offprints/pieces";
import { shell } from "@/content/offprints/shell";
import { dayMonthYear } from "@/lib/offprints/pieces";

/** One rubber stamp: the verdict over its dated line. */
function Stamp({ verdict, line, date }: { verdict: string; line: string; date: string }) {
  return (
    <div
      data-op-stamp
      className="inline-block -rotate-[7deg] border-2 border-stamp px-[9px] py-[5px] text-left font-mono text-[12px] leading-[1.3] tracking-[0.06em] text-stamp uppercase opacity-90 mix-blend-multiply"
    >
      <b className="block text-[15px] font-medium tracking-[0.1em]">{verdict}</b>
      {line} · {dayMonthYear(date)}
    </div>
  );
}

/**
 * The owner's call on a piece (spec §8.1): "USEFUL" or "USELESS" over
 * "my call · 1 Nov 2026", rotated −7°, 2px stamp border, multiply blend.
 * When the piece has been revisited, a second stamp sits beside it (below
 * it, at 880px and up). At 880px and up the stamps hang off the document
 * head's right edge, 52px out into the margin (the head is the positioning
 * parent; PieceFrame insets the title 138px a side to clear them); below
 * that they sit inline, centred, above the title.
 */
export function CallStamp({ piece }: { piece: Piece }) {
  return (
    <div
      data-op-call
      className="mb-3.5 flex flex-wrap justify-center gap-3 min-[880px]:absolute min-[880px]:top-[-14px] min-[880px]:right-[-52px] min-[880px]:mb-0 min-[880px]:flex-col min-[880px]:items-end"
    >
      <Stamp verdict={piece.call.verdict} line={shell.piece.callLine} date={piece.call.date} />
      {piece.revisit ? (
        <Stamp verdict={piece.revisit.verdict} line={shell.piece.revisitLine} date={piece.revisit.date} />
      ) : null}
    </div>
  );
}
