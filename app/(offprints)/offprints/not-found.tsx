import { shell } from "@/content/offprints/shell";
import { OffLink } from "@/components/offprints/OffLink";
import { HomeMark } from "@/components/offprints/HomeMark";
import { OFFPRINTS_PREFIX } from "@/lib/offprints/site";

/**
 * The Offprints 404: a plain sheet that says nothing is filed here and
 * points at the index. Like the portfolio's, it never echoes the requested
 * path back into the page.
 */
export default function OffprintsNotFound() {
  const t = shell.notFound;
  return (
    <>
      <main id="main" tabIndex={-1} className="mx-auto max-w-[720px] px-[18px] pt-[72px] pb-[110px] min-[880px]:px-[28px]">
        <h1 className="mb-3 text-[32px] leading-[1.15] font-normal min-[880px]:text-[44px]">{t.heading}</h1>
        <p className="mb-4 text-mut">{t.lede}</p>
        <OffLink href={`${OFFPRINTS_PREFIX}/all`}>{t.back}</OffLink>
      </main>
      <HomeMark />
    </>
  );
}
