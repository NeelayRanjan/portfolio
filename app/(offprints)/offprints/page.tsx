import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PIECES } from "@/content/offprints/pieces";
import { shell } from "@/content/offprints/shell";
import { componentFor } from "@/components/offprints/pieces";
import { IndexPage } from "@/components/offprints/IndexPage";
import { Shell } from "@/components/offprints/Shell";
import { latestPiece, visiblePieces } from "@/lib/offprints/pieces";
import { OFFPRINTS_OG_IMAGE, pieceUrl } from "@/lib/offprints/site";

/**
 * The Offprints root: the latest visible piece (spec §4). Its canonical is
 * the piece's own URL, so the root never competes with it in search. With
 * no visible piece (a production build before the first piece is
 * published) it is a 404, never an empty sheet (spec §10.1).
 */
export function generateMetadata(): Metadata {
  const piece = latestPiece(PIECES, process.env.VERCEL_ENV);
  if (!piece) return {};
  return {
    // A layout's title template skips a page in its own segment, so the
    // root spells the template out itself ("Hybrid attention · Offprints").
    title: { absolute: `${piece.title} · ${shell.meta.siteName}` },
    description: piece.claim,
    alternates: { canonical: pieceUrl(piece.slug) },
    openGraph: { url: pieceUrl(piece.slug), title: piece.title, description: piece.claim, images: [OFFPRINTS_OG_IMAGE] },
  };
}

export default function OffprintsHome() {
  const piece = latestPiece(PIECES, process.env.VERCEL_ENV);
  if (!piece) notFound();
  const Body = componentFor(piece);
  return (
    <Shell
      index={<IndexPage pieces={visiblePieces(PIECES, process.env.VERCEL_ENV)} currentSlug={piece.slug} />}
      currentSlug={piece.slug}
    >
      <Body piece={piece} />
    </Shell>
  );
}
