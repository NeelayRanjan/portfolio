/** A booktabs table: heavy top and bottom rules, one light rule under the header, no verticals. */
export function Booktabs({
  n,
  caption,
  head,
  rows,
  align,
}: {
  n: number;
  caption: string;
  head: string[];
  rows: string[][];
  align?: ("left" | "right")[];
}) {
  const cls = (i: number) => (align?.[i] === "right" ? "text-right" : "text-left");
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-[14px] [font-variant-numeric:tabular-nums]">
        <caption className="mb-1.5 text-left text-[13px]">
          {`Table ${n}: ${caption}`}
        </caption>
        <thead>
          <tr className="border-t-2 border-t-ink border-b border-b-ink">
            {head.map((h, i) => (
              <th key={i} className={`px-2.5 py-1 font-normal italic ${cls(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={ri === rows.length - 1 ? "border-b-2 border-b-ink" : ""}>
              {r.map((c, ci) => (
                <td key={ci} className={`px-2.5 py-1 ${cls(ci)}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
