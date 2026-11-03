import { copy } from "@/content/copy";
import { TrackedLink } from "@/components/manuscript/TrackedLink";
import { PIECES } from "@/content/offprints/pieces";
import { gateOffprintsLinks, latestPiece } from "@/lib/offprints/pieces";

/**
 * The bibliography: `copy.references.items` rendered as a numbered list,
 * mirroring the approved mockup's `ol.refs`. A reference with no `href`
 * (the first-author paper and the MWSCAS oral, both still unlinkable) renders as
 * plain text rather than a dead or placeholder link. The Offprints entry is
 * dropped while no piece is visible (`gateOffprintsLinks`). A link's vertical
 * padding is hit area only: inline padding doesn't move the line, and 6px
 * a side stays inside the list's own spacing, so neighbours don't overlap.
 */
export function References() {
  const t = copy.references;
  // The Offprints entry shows only once a piece is visible (spec §10.1), on
  // the same predicate as the Masthead's box.
  const items = gateOffprintsLinks(t.items, latestPiece(PIECES, process.env.VERCEL_ENV));

  return (
    <div>
      <h2 id="references" className="mt-[60px] mb-5 scroll-mt-6 text-[22px] font-semibold text-ink">
        {t.heading}
      </h2>
      <ol className="list-decimal space-y-2 pl-7 text-[15px] text-mut marker:text-mut">
        {items.map((item) =>
          item.href ? (
            <li key={item.label}>
              <TrackedLink
                label={item.label}
                href={item.href}
                className="py-1.5 text-link hover:underline hover:underline-offset-[3px]"
              >
                {item.label}
              </TrackedLink>
            </li>
          ) : (
            <li key={item.label}>{item.label}</li>
          ),
        )}
      </ol>
    </div>
  );
}
