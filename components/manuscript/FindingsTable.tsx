import { copy } from "@/content/copy";

/**
 * Table 1: a ledger of what the page shows and where (2026-10-26, owner's
 * pick of three directions). It replaced `StatBand`, a row of four big
 * numerals over small labels that read as the generic hero-metric template:
 * mixed units side by side, a red accent on one, and nothing to compare
 * against. A paper's Table 1 is typeset, so this is a real `<table>` with
 * booktabs-style rules: a 2px ink rule over the caption, a hairline under
 * the head, a rule to close. Numbers sit at body size inside sentences; no
 * cell is louder than another, and no red.
 *
 * Below 880px each row folds into two lines (finding and link, then the
 * result), since three columns don't fit a phone's sheet. The `order`
 * classes only apply there; at 880px and up the rows are table rows again.
 *
 * Each "Shown in" link targets an id that exists at first paint: the
 * deferred figures (3-5) are anchored on their DeferredMount slots, so a jump
 * works before the figure has mounted.
 */
export function FindingsTable() {
  const t = copy.table1;
  return (
    <div className="mt-16 border-t-2 border-ink border-b border-rule">
      <table className="w-full border-collapse text-left">
        <caption className="caption-top py-2.5 text-left font-mono text-xs text-mut">
          <b className="font-semibold text-ink">Table 1.</b> {t.caption}
        </caption>
        <thead className="hidden min-[880px]:table-header-group">
          <tr className="border-y border-rule font-mono text-[11px] text-mut">
            <th scope="col" className="py-2 pr-6 font-normal">
              {t.head.finding}
            </th>
            <th scope="col" className="py-2 pr-6 font-normal">
              {t.head.result}
            </th>
            <th scope="col" className="py-2 font-normal">
              {t.head.where}
            </th>
          </tr>
        </thead>
        <tbody className="border-t border-rule min-[880px]:border-t-0">
          {t.rows.map((row) => (
            <tr
              key={row.href}
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-hair py-3 last:border-b-0 min-[880px]:table-row min-[880px]:py-0"
            >
              <th
                scope="row"
                className="order-1 text-[15px] font-semibold text-ink min-[880px]:w-[190px] min-[880px]:py-3 min-[880px]:pr-6 min-[880px]:align-baseline"
              >
                {row.finding}
              </th>
              <td className="order-3 col-span-2 text-[15px] leading-relaxed text-mut min-[880px]:py-3 min-[880px]:pr-6 min-[880px]:align-baseline">
                {row.result}
              </td>
              <td className="order-2 text-right min-[880px]:w-[100px] min-[880px]:py-3 min-[880px]:text-left min-[880px]:align-baseline">
                <a
                  href={row.href}
                  className="whitespace-nowrap py-1 font-mono text-[12px] text-link hover:underline hover:underline-offset-[3px]"
                >
                  {row.where}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
