import type { ReactNode } from "react";

/**
 * The anchored grid: prose on the left, a margin rail on the right. The prose
 * column's left edge never moves — it's `minmax(0,560px)`, so it holds its
 * width even when there's no rail to balance it, keeping every Row's prose
 * flush with every other Row's, rail or no rail.
 *
 * ⚠️ The split point is 880px, which isn't one of Tailwind's default
 * breakpoints (sm/md/lg = 640/768/1024). The brief is explicit: use the
 * `min-[880px]:` arbitrary variant everywhere in this component, never `md:`
 * — if the grid collapsed at 768 but the rail's border-side flip happened at
 * 880 (or vice versa), there'd be a 112px-wide band where the two disagree
 * and the rail note would render mid-column with the wrong border edge.
 *
 * `railAlign` only matters at the desktop (grid) layout — stacked below
 * 880px there's nothing to align against, the rail just follows the prose in
 * normal flow. Left undefined, a rail stretches to the row's full height
 * (CSS Grid's default `align-items: stretch`), which is what the masthead
 * wants: the hairline divider runs the whole height of the header row.
 * `"end"` is for a short rail note beside taller prose (e.g. a one-line
 * SCOPE note beside a full paragraph), so it sits at the foot of the row
 * instead of stretching into empty space above it.
 */
export function Row({
  children,
  rail,
  railAlign,
}: {
  children: ReactNode;
  rail?: ReactNode;
  railAlign?: "start" | "end";
}) {
  return (
    <div className="min-[880px]:grid min-[880px]:grid-cols-[minmax(0,560px)_minmax(200px,1fr)] min-[880px]:gap-x-12">
      <div>{children}</div>
      {rail ? (
        <aside
          className={[
            // Rail base type: serif italic-friendly, small, muted — matches
            // the mockup's `.rail` rule. Individual rail content (Stamp, nav
            // links) overrides size/color as needed; this is just the default.
            "mt-2 border-t border-hair pt-3 text-[13.5px] leading-relaxed text-mut",
            "min-[880px]:mt-0 min-[880px]:border-t-0 min-[880px]:border-l min-[880px]:pl-6",
            railAlign === "end"
              ? "min-[880px]:self-end"
              : railAlign === "start"
                ? "min-[880px]:self-start"
                : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}

/**
 * A rail note: a mono uppercase tag (`SCOPE`, `NOTE`, …) over a serif italic
 * body. This is the shape v1's mono demo captions played — the honesty
 * notes, the scope caveats — now living in the margin instead of under a
 * panel.
 */
export function Note({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div className="text-[13.5px] leading-relaxed text-mut">
      <span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mut">
        {tag}
      </span>
      <em className="italic">{children}</em>
    </div>
  );
}
