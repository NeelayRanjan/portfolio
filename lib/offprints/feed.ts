// The Atom feed, pure. Imports only the Piece type and the site constants.
import type { Piece } from "../../content/offprints/pieces.ts";
import { OFFPRINTS_SITE, pieceUrl } from "./site.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const day = (iso: string) => `${iso}T00:00:00Z`;

/** `pieces` arrive newest first. `fallbackUpdated` is the feed's <updated> only when there are no entries. */
export function atomFeed(pieces: readonly Piece[], fallbackUpdated: string): string {
  const entries = pieces.map((p) => {
    const url = esc(pieceUrl(p.slug));
    return (
      `<entry>\n` +
      `<id>${url}</id>\n` +
      `<link href="${url}"/>\n` +
      `<title>${esc(p.title)}</title>\n` +
      `<summary>${esc(p.claim)}</summary>\n` +
      `<published>${day(p.published)}</published>\n` +
      `<updated>${day(p.revisit?.date ?? p.published)}</updated>\n` +
      `</entry>`
    );
  });
  const latest = pieces
    .map((p) => day(p.revisit?.date ?? p.published))
    .reduce<string | null>((a, b) => (a === null || b > a ? b : a), null);
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">\n` +
    `<title>Offprints</title>\n` +
    `<id>${OFFPRINTS_SITE}/</id>\n` +
    `<link rel="self" href="${OFFPRINTS_SITE}/feed.xml"/>\n` +
    `<link rel="alternate" href="${OFFPRINTS_SITE}/"/>\n` +
    `<author><name>Neelay Ranjan</name></author>\n` +
    `<updated>${esc(latest ?? fallbackUpdated)}</updated>\n` +
    (entries.length ? entries.join("\n") + "\n" : "") +
    `</feed>\n`
  );
}
