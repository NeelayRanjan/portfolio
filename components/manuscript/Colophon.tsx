import { copy } from "@/content/copy";
import { TrackedLink } from "./TrackedLink";

/**
 * The page's last line: copyright, the address, the resume. A server
 * component; the two links are tracked through the same `outbound_link`
 * leaf the masthead uses, and "Resume" carries the same label so the
 * resume-pdf check covers it. Each separator trails its item, so a wrapped line never opens with one.
 */
export function Colophon() {
  const t = copy.colophon;
  return (
    <footer
      data-colophon
      className="mt-6 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[11px] leading-relaxed text-mut"
    >
      <span>{t.rights} <span aria-hidden="true">·</span></span>
      {t.links.map((l, i) => (
        <span key={l.label}>
          <TrackedLink
            label={l.label}
            href={l.href}
            className="underline decoration-dotted underline-offset-[3px] transition-colors hover:text-ink"
          >
            {l.text}
          </TrackedLink>
          {i < t.links.length - 1 && (
            <>
              {" "}
              <span aria-hidden="true">·</span>
            </>
          )}
        </span>
      ))}
    </footer>
  );
}
