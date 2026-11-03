import { Fragment } from "react";
import type { ReactNode } from "react";

/** One maths symbol: a base with an optional subscript and superscript. */
export type MathTerm = { readonly base: string; readonly sub?: string; readonly sup?: string };
/** A run of maths or prose: plain strings and composed terms, in order. */
export type MathPart = string | MathTerm;

/**
 * Composes maths from parts held in a piece's content file, with real
 * <sub>/<sup>, never TeX source on the page (a string stays a string). Inside
 * prose, `text` renders the plain strings (e.g. `withCites`, so "[2]" still
 * links); inside an `Equation` the default leaves them as they are.
 */
export function MathText({
  parts,
  text = (s) => s,
}: {
  parts: readonly MathPart[];
  text?: (s: string) => ReactNode;
}) {
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <Fragment key={i}>{text(p)}</Fragment>
    ) : (
      <Fragment key={i}>
        {p.base}
        {p.sub ? <sub>{p.sub}</sub> : null}
        {p.sup ? <sup>{p.sup}</sup> : null}
      </Fragment>
    ),
  );
}
