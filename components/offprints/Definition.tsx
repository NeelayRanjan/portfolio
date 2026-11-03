import type { ReactNode } from "react";
import { shell } from "@/content/offprints/shell";

const RULE = {
  q: "border-l-q",
  k: "border-l-k",
  v: "border-l-v",
  ink: "border-l-ink",
} as const;

/** A paper "Definition n (term, symbol)." box: role-coloured left rule, italic body. */
export function Definition({
  n,
  term,
  symbol,
  role,
  children,
}: {
  n: number;
  term: string;
  symbol: string;
  role: keyof typeof RULE;
  children: ReactNode;
}) {
  return (
    <div className={`op-def op-def--${role} my-4 border-l-2 bg-fill px-3.5 py-3 text-[14px] ${RULE[role]}`}>
      <b>
        {`${shell.piece.definitionLabel} ${n} (${term}, `}<span className="font-mono">{symbol}</span>{")."}
      </b>{" "}
      <i>{children}</i>
    </div>
  );
}
