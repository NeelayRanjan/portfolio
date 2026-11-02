import type { Metadata } from "next";
import { PIECES } from "@/content/offprints/pieces";
import { shell } from "@/content/offprints/shell";
import { IndexPage } from "@/components/offprints/IndexPage";
import { visiblePieces } from "@/lib/offprints/pieces";
import { OFFPRINTS_SITE } from "@/lib/offprints/site";

// The index as a page of its own (spec §4): the no-JS, crawler and
// direct-link form of what the peel reveals, on the paper-under grain.
export const metadata: Metadata = {
  title: shell.index.contents,
  alternates: { canonical: `${OFFPRINTS_SITE}/all` },
};

export default function OffprintsAll() {
  return (
    <div data-op-under className="min-h-dvh">
      <IndexPage pieces={visiblePieces(PIECES, process.env.VERCEL_ENV)} />
    </div>
  );
}
