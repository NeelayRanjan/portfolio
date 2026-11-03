import type { Piece, RevisitVerdict } from "@/content/offprints/pieces";
import { shell } from "@/content/offprints/shell";
import { OFFPRINTS_PREFIX } from "@/lib/offprints/site";
import { monthYear } from "@/lib/offprints/pieces";
import { OffLink } from "./OffLink";
import { TrackedOffLink } from "./TrackedOffLink";

// The revisit stamp's class and colour per verdict (spec §7).
const REVISIT: Record<RevisitVerdict, string> = {
  "held up": "held text-k",
  "aged badly": "aged text-stamp",
  mixed: "mixed text-mut",
};

/**
 * The index as a table of contents (spec §7): the masthead, "Contents", the
 * pieces newest first (the caller passes `visiblePieces(...)`, already
 * sorted and filtered), then the foot. No background of its own: `/all`
 * puts it on `paper-under` grain, and the Shell's index layer (Task 6) does
 * the same beneath a piece. Each row's link is named by the title alone
 * and stretched over the row. The masthead's h1 takes focus when the peel
 * opens, hence tabIndex -1.
 */
export function IndexPage({
  pieces,
  currentSlug,
}: {
  pieces: readonly Piece[];
  currentSlug?: string;
}) {
  const t = shell.index;
  return (
    <div className="mx-auto max-w-[720px] px-[18px] pt-[72px] pb-[110px] min-[880px]:px-[28px]">
      <header className="mb-7 text-center">
        <h1 tabIndex={-1} className="mb-1 text-[30px] leading-tight font-semibold">
          {t.masthead}
        </h1>
        <p className="text-[15px] text-mut italic">{t.line}</p>
      </header>

      <h2 className="mb-3.5 text-[20px] font-semibold">{t.contents}</h2>
      <ol className="list-none p-0" data-op-contents>
        {pieces.map((p) => {
          const open = p.slug === currentSlug;
          return (
            <li
              key={p.slug}
              data-op-entry={p.slug}
              className="group relative min-h-11 px-1 py-3 hover:bg-ink/[0.04]"
            >
              <span className="flex items-baseline gap-2 text-[18px]">
                <span className="min-w-[1.8em] tabular-nums">{`${p.number}.`}</span>
                {/* The link's accessible name is the title alone; its ::after
                    stretches over the whole row (the li is relative), so the
                    row stays one 44px+ target. */}
                <OffLink
                  href={`${OFFPRINTS_PREFIX}/${p.slug}`}
                  aria-current={open ? "page" : undefined}
                  className="text-ink group-hover:text-link group-hover:underline group-hover:underline-offset-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ink"
                >
                  {p.title}
                </OffLink>
                {open ? <span className="text-[13px] text-mut">{t.open}</span> : null}
                <span
                  aria-hidden="true"
                  className="min-w-5 flex-1 -translate-y-[5px] border-b border-dotted border-mut"
                />
                <span className="text-[14px] whitespace-nowrap text-mut">{monthYear(p.published)}</span>
              </span>
              <span className="flex flex-wrap gap-x-3.5 gap-y-1 pl-[2.2em] text-[14px] text-mut">
                <span className="basis-full italic">{p.claim}</span>
                <span className="sc call text-stamp">
                  {t.callPrefix}
                  {p.call.verdict}
                </span>
                {p.revisit ? (
                  <span className={`sc ${REVISIT[p.revisit.verdict]}`}>
                    {t.revisitPrefix}
                    {p.revisit.verdict}
                  </span>
                ) : null}
                {p.status === "draft" ? <span className="sc draft">{t.draft}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      <footer className="mt-10 flex flex-wrap gap-4 border-t border-rule pt-3 text-[13px] text-mut">
        {/* Both are outbound_link (spec §8): "RSS", and "Portfolio" as the N mark. */}
        <TrackedOffLink label="RSS" href={`${OFFPRINTS_PREFIX}/feed.xml`}>
          {t.feed}
        </TrackedOffLink>
        <TrackedOffLink label="Portfolio" href="https://neelayranjan.dev">
          {t.home}
        </TrackedOffLink>
      </footer>
    </div>
  );
}
