import { Fragment, type ReactNode } from "react";
import type { Piece } from "@/content/offprints/pieces";
import { shell } from "@/content/offprints/shell";
import { OFFPRINTS_PREFIX, pieceUrl } from "@/lib/offprints/site";
import { monthYear, numberLabel } from "@/lib/offprints/pieces";
import { CallStamp } from "./CallStamp";
import { CopyButton } from "./CopyButton";
import { OffLink } from "./OffLink";

/** A section a piece supplies: its heading and its body. */
export type PieceSection = { heading: string; body: ReactNode };

/**
 * Turns "[1]" in a copy string into a link to reference 1, in link blue
 * (spec §5a: inline citations in `link` only). Copy stays plain strings.
 */
export function withCites(text: string): ReactNode {
  const parts = text.split(/(\[\d+\])/);
  return parts.map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    return m ? (
      <a key={i} href={`#ref-${m[1]}`}>
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

/**
 * The frame every piece sits in (spec §5a, §8). Rendered BY the piece's own
 * component (components/offprints/pieces/<slug>/Piece.tsx), because the
 * piece owns its copy and its figures; the frame owns the order and the
 * numbering. Top to bottom:
 *
 *   the document head (the call stamp, title, author, affiliation, the
 *   italic date line with the number, "draft" outside production);
 *   the Abstract (`abstract`, a copy string; "[n]" becomes a citation link);
 *   `children`: the figure chain, the hero first;
 *   the numbered sections, in this order with running numbers 1, 2, 3...:
 *     every entry of `sections` (the piece's own, e.g. "Two kinds of
 *     memory"), then "Why it matters now" (`why`), then "Words, if you want
 *     them" (`words`, folded in a <details>; omitted when absent), then
 *     "Revisited" only when the registry entry has a `revisit`;
 *   References (unnumbered, hanging indents, "[n]" labels), the cite block
 *   with its copy button, and the foot.
 *
 * Shape settled for Task 3: a piece passes `sections` as a plain array of
 * `{ heading, body }` and never numbers anything itself, so adding a section
 * to a piece renumbers everything after it with no other edit.
 */
export function PieceFrame({
  piece,
  abstract,
  sections = [],
  why,
  words,
  children,
}: {
  piece: Piece;
  abstract: string;
  sections?: readonly PieceSection[];
  why: ReactNode;
  words?: ReactNode;
  children: ReactNode;
}) {
  const t = shell.piece;
  // Running numbers: the piece's own sections, then why, words, revisited.
  const whyN = sections.length + 1;
  const wordsN = whyN + 1;
  const revisitN = (words ? wordsN : whyN) + 1;
  const year = piece.published.slice(0, 4);
  const cite = `${t.citeAuthor} (${year}). ${piece.title}. ${shell.meta.siteName}, ${numberLabel(piece.number)}. ${pieceUrl(piece.slug)}`;

  return (
    <article className="mx-auto max-w-[720px] px-[18px] pt-[72px] pb-[110px] min-[880px]:px-[28px]">
      <header className="relative mb-[30px] text-center">
        <CallStamp piece={piece} />
        <h1 className="mb-2.5 text-[32px] leading-[1.15] font-normal text-balance min-[880px]:px-[138px] min-[880px]:text-[44px]">
          {piece.title}
        </h1>
        <p className="text-[17px]">
          {t.author}
          <sup className="text-[12px] text-link">1</sup>
        </p>
        <p className="mt-0.5 text-[13px] text-mut">
          <sup className="text-[12px]">1</sup> {t.affiliation}
        </p>
        <p className="mt-1 text-[15px] text-mut italic">
          {monthYear(piece.published)} · {numberLabel(piece.number)}
          {piece.status === "draft" ? ` · ${shell.index.draft}` : null}
        </p>
      </header>

      <section aria-labelledby="op-abstract" className="mx-auto mb-9 max-w-[560px] text-[15px] hyphens-auto">
        <h2 id="op-abstract" className="mb-1.5 text-center text-[15px] font-semibold">
          {t.abstract}
        </h2>
        <p className="text-justify">{withCites(abstract)}</p>
      </section>

      {children}

      {sections.map((s, i) => (
        <NumberedSection key={s.heading} n={i + 1} heading={s.heading}>
          {s.body}
        </NumberedSection>
      ))}

      <NumberedSection n={whyN} heading={t.why}>
        {why}
      </NumberedSection>

      {words ? (
        <section className="mt-9">
          <details>
            <summary className="cursor-pointer">
              <h2 className="inline text-[20px] font-semibold">
                <span className="inline-block min-w-[1.6em] tabular-nums">{wordsN}</span>
                {t.words}
              </h2>
            </summary>
            <div className="mt-2.5">{words}</div>
          </details>
        </section>
      ) : null}

      {piece.revisit ? (
        <NumberedSection n={revisitN} heading={t.revisited}>
          <p>{piece.revisit.line}</p>
        </NumberedSection>
      ) : null}

      <section aria-labelledby="op-references" className="mt-9">
        <h2 id="op-references" className="mb-2.5 text-[20px] font-semibold">
          {t.references}
        </h2>
        <ol className="m-0 list-none pl-8">
          {piece.sources.map((s) => (
            <li key={s.label} id={`ref-${s.label}`} className="mb-2 -indent-8 text-[14.5px]">
              <span className="inline-block w-8 indent-0 text-link">[{s.label}]</span>
              {s.href ? <a href={s.href}>{s.title}</a> : s.title}. {s.venue}, {s.year}.
            </li>
          ))}
        </ol>

        <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-2.5 border-l-2 border-ink bg-fill px-3 py-2.5 text-[13.5px]">
          <div>
            <p className="sc mb-1 text-[13px] text-mut">{t.cite}</p>
            <code data-op-copy-source className="font-mono text-[12px] break-words whitespace-pre-wrap">
              {cite}
            </code>
          </div>
          <CopyButton text={cite} />
        </div>
      </section>

      <footer className="mt-10 flex flex-wrap gap-4 border-t border-rule pt-3 text-[13px] text-mut">
        <span className="sc">{shell.meta.siteName}</span>
        <span>
          {numberLabel(piece.number)} · {monthYear(piece.published)}
        </span>
        <OffLink href={`${OFFPRINTS_PREFIX}/feed.xml`}>{t.footRss}</OffLink>
      </footer>
    </article>
  );
}

function NumberedSection({ n, heading, children }: { n: number; heading: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-2.5 text-[20px] font-semibold">
        <span className="inline-block min-w-[1.6em] tabular-nums">{n}</span>
        {heading}
      </h2>
      {children}
    </section>
  );
}
