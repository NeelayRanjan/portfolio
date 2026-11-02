"use client";

import type { AnchorHTMLAttributes } from "react";

/**
 * Every internal Offprints link. Server components always write the
 * internal prefix form (`/offprints/all`); on the Offprints host the public
 * URL has no prefix, so Task 4 swaps the href on mount through
 * `publicHref(href, location.hostname)` (lib/offprints/host.ts). Until then
 * this is a stub that renders the href unchanged.
 */
export function OffLink({
  href,
  ...a
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...a} />;
}
