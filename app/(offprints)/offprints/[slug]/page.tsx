import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PIECES } from "@/content/offprints/pieces";
import { componentFor } from "@/components/offprints/pieces";
import { IndexPage } from "@/components/offprints/IndexPage";
import { Shell } from "@/components/offprints/Shell";
import { pieceBySlug, visiblePieces } from "@/lib/offprints/pieces";
import { OFFPRINTS_OG_IMAGE, pieceUrl } from "@/lib/offprints/site";

// Only the visible pieces exist: every other slug, a draft on a production
// build included, is a 404 (dynamicParams = false), never rendered on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return visiblePieces(PIECES, process.env.VERCEL_ENV).map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const piece = pieceBySlug(PIECES, slug, process.env.VERCEL_ENV);
  if (!piece) return {};
  return {
    title: piece.title,
    description: piece.claim,
    alternates: { canonical: pieceUrl(piece.slug) },
    openGraph: { url: pieceUrl(piece.slug), title: piece.title, description: piece.claim, images: [OFFPRINTS_OG_IMAGE] },
  };
}

export default async function OffprintsPiece({ params }: Props) {
  const { slug } = await params;
  const piece = pieceBySlug(PIECES, slug, process.env.VERCEL_ENV);
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
