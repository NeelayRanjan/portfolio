/**
 * Table 1: the full-span stat band. A double rule (2px ink over 1px rule)
 * frames a mono caption, then a row of large serif numerals with a label
 * under each, cells separated by whitespace rather than dividers (per the
 * mockup — no vertical rule between cells, just each cell's own right
 * padding).
 *
 * The "Table 1." prefix is fixed rather than a prop: unlike `InstrumentFigure`
 * (which numbers arbitrarily many figures via `n`), this component exists for
 * exactly one insertion point on the page. `caption` is only the sentence
 * after the label ("The short version.").
 *
 * `hot` is the ONE other place on the page besides `Stamp` allowed to use
 * `--red-ink` (see CLAUDE.md/spec red-discipline rule) — it marks the
 * headline finding (0.882 Dice), not a decoration choice per cell.
 */
export function StatBand({
  caption,
  cells,
}: {
  caption: string;
  cells: { value: string; label: string; hot?: boolean }[];
}) {
  return (
    <div className="mt-16 border-t-2 border-ink border-b border-rule">
      <div className="py-2.5 font-mono text-xs text-mut">
        <b className="font-semibold text-ink">Table 1.</b> {caption}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] border-t border-rule">
        {cells.map((cell, i) => (
          <div key={i} className="py-6 pr-[22px]">
            <b
              className={
                "block text-[clamp(32px,4vw,46px)] leading-[1.05] font-semibold tracking-[-0.01em] " +
                (cell.hot ? "text-red-ink" : "text-ink")
              }
            >
              {cell.value}
            </b>
            <span className="mt-1.5 block max-w-[26ch] text-[13.5px] text-mut">
              {cell.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
