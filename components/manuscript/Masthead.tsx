import Link from "next/link";
import { Row } from "@/components/manuscript/Row";
import { Stamp } from "@/components/manuscript/Stamp";
import { HeadshotFigure } from "@/components/figures/HeadshotFigure";
import { TrackedLink } from "@/components/manuscript/TrackedLink";
import { copy } from "@/content/copy";

/**
 * The masthead: paper title, affiliation, and the bio-as-abstract on the
 * left; the rail carries the headshot toy (if its bundle is deployed: the
 * photo there is sampled live by the owner's own diffusion model, see
 * `components/figures/HeadshotFigure.tsx`), the reviewer's-ink stamp,
 * the date, and the identity links. Mirrors the approved mockup's `header`
 * row (title+affiliation+abstract left; stamp, date, links in the rail).
 *
 * Self-contained like the figure components: reads `copy.masthead` directly
 * rather than taking props, since there is exactly one masthead on the page.
 */
export function Masthead() {
  const t = copy.masthead;

  return (
    <Row
      rail={
        <div className="flex flex-col items-start gap-3">
          <HeadshotFigure />
          {/* The stamp doubles as the way into /lab: the dotted-underlined
              sub-line is the visible affordance, and the whole cluster is one
              link so the hit target isn't a 10px line of text. */}
          <Link href="/lab" className="group inline-block">
            <Stamp>{t.stamp}</Stamp>
            <span className="mt-1.5 block font-mono text-[10px] text-mut underline decoration-dotted underline-offset-[3px] transition-colors group-hover:text-red-ink group-hover:decoration-solid">
              {t.stampNote}
            </span>
          </Link>
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mut">
            {t.date}
          </span>
          <nav className="flex flex-row flex-wrap gap-x-5 gap-y-2 text-[15px] min-[880px]:flex-col min-[880px]:gap-1.5">
            {t.links.map((link) => (
              <TrackedLink
                key={link.label}
                label={link.label}
                href={link.href}
                className="text-link hover:underline hover:underline-offset-[3px]"
              >
                {link.label}
              </TrackedLink>
            ))}
          </nav>
        </div>
      }
    >
      {/* One h1, two sizes (owner call, 2026-09-13): the name carries the old
          display size, the thesis line drops to a subordinate size below it.
          Both stay in the h1 so the accessible page title is unchanged in
          substance. */}
      <h1 className="mb-[18px] font-semibold tracking-[-0.01em] text-ink">
        <span className="block text-[clamp(27px,4.2vw,37px)] leading-[1.22]">
          {t.titleName}
        </span>
        <span className="mt-2 block max-w-[44ch] text-[clamp(17px,2.6vw,22px)] leading-[1.3] font-medium [text-wrap:balance]">
          {t.titleTagline}
        </span>
      </h1>
      <p className="mb-6 text-[15px] text-mut italic">{t.affiliation}</p>
      <p className="text-[16px] leading-relaxed text-ink">{t.abstract}</p>
    </Row>
  );
}
