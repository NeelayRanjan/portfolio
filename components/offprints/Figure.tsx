import type { ReactNode } from "react";
import { shell } from "@/content/offprints/shell";

/**
 * A numbered figure in the paper conventions (spec §5a): the interactive,
 * then the caption BELOW it, centred, "Figure N:" in semibold, the caption,
 * and the "try" nudge in italic mut. `id="fig-N"` so captions and prose can
 * cross-reference it.
 */
export function Figure({
  n,
  caption,
  tryText,
  children,
}: {
  n: number;
  caption: ReactNode;
  tryText?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure id={`fig-${n}`} className="mt-[26px] mb-[30px]">
      {children}
      <figcaption className="mt-3 text-center text-[14px] leading-[1.45] text-ink">
        <span className="font-semibold">
          {shell.piece.figure} {n}:
        </span>{" "}
        {caption}
        {tryText ? (
          <>
            {" "}
            <span className="italic text-mut">{tryText}</span>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
