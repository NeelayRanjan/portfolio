import type { ReactNode } from "react";

/** A displayed equation: maths centred in italic, the tag "(n)" flushed right. */
export function Equation({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="my-5 grid grid-cols-[1fr_auto] items-baseline gap-x-3">
      <div className="text-center text-[17px] italic">{children}</div>
      <span className="text-[14px]">{`(${n})`}</span>
    </div>
  );
}
