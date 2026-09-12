import { Row } from "@/components/manuscript/Row";
import { Stamp } from "@/components/manuscript/Stamp";
import { HeadshotFigure } from "@/components/figures/HeadshotFigure";
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
          <Stamp>{t.stamp}</Stamp>
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mut">
            {t.date}
          </span>
          <nav className="flex flex-row flex-wrap gap-x-5 gap-y-2 text-[15px] min-[880px]:flex-col min-[880px]:gap-1.5">
            {t.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-link hover:underline hover:underline-offset-[3px]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      }
    >
      <h1 className="mb-[18px] max-w-[22ch] text-[clamp(27px,4.2vw,37px)] leading-[1.22] font-semibold tracking-[-0.01em] text-ink [text-wrap:balance]">
        {t.title}
      </h1>
      <p className="mb-6 text-[15px] text-mut italic">{t.affiliation}</p>
      <p className="text-[16px] leading-relaxed text-ink">{t.abstract}</p>
    </Row>
  );
}
