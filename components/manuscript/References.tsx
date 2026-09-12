import { copy } from "@/content/copy";

/**
 * The bibliography: `copy.references.items` rendered as a numbered list,
 * mirroring the approved mockup's `ol.refs`. A reference with no `href`
 * (the JAMIA paper and the MWSCAS oral, both still unlinkable) renders as
 * plain text rather than a dead or placeholder link.
 */
export function References() {
  const t = copy.references;

  return (
    <div>
      <h2 className="mt-[60px] mb-5 text-[22px] font-semibold text-ink">
        {t.heading}
      </h2>
      <ol className="list-decimal space-y-2 pl-7 text-[15px] text-mut marker:text-mut">
        {t.items.map((item) =>
          item.href ? (
            <li key={item.label}>
              <a
                href={item.href}
                className="text-link hover:underline hover:underline-offset-[3px]"
              >
                {item.label}
              </a>
            </li>
          ) : (
            <li key={item.label}>{item.label}</li>
          ),
        )}
      </ol>
    </div>
  );
}
