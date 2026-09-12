import type { ReactNode } from "react";

/**
 * The reviewer's-ink stamp ("UNDER REVIEW"). One of exactly two places on the
 * page allowed to use `--red-ink` (the other is `StatBand`'s `hot` cell) —
 * see CLAUDE.md/spec's red-discipline rule. A claim, not decoration: when
 * the manuscript's status changes, the words inside change with it.
 *
 * No margin baked in on purpose — this is a leaf visual primitive (an inline
 * bordered label), and the mockup's 20px bottom margin is really spacing
 * between the stamp and whatever sits under it in the rail, which is a
 * layout concern for the caller (see the smoke assembly for how it's used
 * inside a Row's rail).
 */
export function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block -rotate-2 border-[1.5px] border-red-ink px-3.5 py-[5px] font-mono text-[11px] font-semibold tracking-[0.14em] text-red-ink">
      {children}
    </span>
  );
}
