import type { ReactNode } from "react";

/** A displayed equation: maths centred in italic, the tag "(n)" flushed right. */
export function Equation({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="my-5 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
      <div className="min-w-0 overflow-x-auto text-center text-[17px] italic">{children}</div>
      <span className="text-[14px]">{`(${n})`}</span>
    </div>
  );
}
