// Pure visibility and label helpers. The only import is the registry's types.
import type { Piece } from "../../content/offprints/pieces.ts";

export function visiblePieces(all: readonly Piece[], vercelEnv: string | undefined): Piece[] {
  return all
    .filter((p) => vercelEnv !== "production" || p.status === "published")
    .slice()
    .sort((a, b) =>
      a.published === b.published ? b.number - a.number : a.published < b.published ? 1 : -1,
    );
}

export function latestPiece(all: readonly Piece[], vercelEnv: string | undefined): Piece | null {
  return visiblePieces(all, vercelEnv)[0] ?? null;
}

export function pieceBySlug(
  all: readonly Piece[],
  slug: string,
  vercelEnv: string | undefined,
): Piece | null {
  return visiblePieces(all, vercelEnv).find((p) => p.slug === slug) ?? null;
}

export function numberLabel(n: number): string {
  return `No. ${n}`;
}

export function monthYear(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
