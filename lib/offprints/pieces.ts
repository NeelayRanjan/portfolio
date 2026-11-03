// Pure visibility and label helpers. Imports: the registry's types and the
// canonical host constant (site.ts, itself import-free but for host.ts).
import type { Piece } from "../../content/offprints/pieces.ts";
import { OFFPRINTS_SITE } from "./site.ts";

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

/** Page 1's door gate (spec §10.1): page 1 links Offprints only once a piece
 *  is visible, i.e. `latestPiece(PIECES, VERCEL_ENV)` is non-null. With no
 *  piece (`latest` null) every link into the Offprints host drops; the
 *  Masthead's box is gated on the same `latest`. */
export function gateOffprintsLinks<T extends { href: string }>(
  items: readonly T[],
  latest: Piece | null,
): T[] {
  return latest ? items.slice() : items.filter((i) => !i.href.startsWith(OFFPRINTS_SITE));
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

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-01" → "1 Nov 2026", the call stamp's date. Built by hand, not
 *  through Intl, so the output never depends on the runtime's CLDR data
 *  (en-GB's September abbreviation changed between ICU releases). */
export function dayMonthYear(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
