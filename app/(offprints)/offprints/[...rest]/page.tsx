import { notFound } from "next/navigation";

// Any /offprints/a/b path no Offprints route matches ends here, so the
// Offprints not-found.tsx serves it (not the portfolio's). Prerendered, as
// the portfolio's own catch-all is.
export const dynamic = "force-static";

export default function OffprintsCatchAll() {
  notFound();
}
