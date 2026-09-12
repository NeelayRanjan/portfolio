import Link from "next/link";
import { Sheet } from "@/components/manuscript/Sheet";
import { copy } from "@/content/copy";

/**
 * 404, restyled to the "reference not found" conceit (spec §2): the same
 * shape as `References`, a numbered list of citations, except the entry a
 * visitor followed here doesn't resolve. It renders struck through, next to
 * the site's two real routes.
 *
 * Server component, deliberately. The v1 page read `usePathname` to echo the
 * attempted path back into the shell; this one doesn't. RULING: never echo a
 * visitor-supplied path into the page, even inertly — a generic
 * `copy.notFound.brokenLabel` ("the page you asked for") says the same thing
 * without reflecting attacker-controlled path strings, and it means this page
 * needs no "use client" and no pathname at all.
 */
export default function NotFound() {
  const t = copy.notFound;

  return (
    <main className="flex-1 px-4 pb-24">
      <Sheet>
        <h1 className="mt-[60px] mb-5 text-[22px] font-semibold text-ink">
          {t.heading}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-mut">{t.lede}</p>

        <ol className="mt-6 list-decimal space-y-2 pl-7 text-[15px] text-mut marker:text-mut">
          <li className="line-through text-mut">{t.brokenLabel}</li>
          {t.links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-link hover:underline hover:underline-offset-[3px]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ol>
      </Sheet>
    </main>
  );
}
