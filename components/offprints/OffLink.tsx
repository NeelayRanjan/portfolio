"use client";

import { useEffect, useState } from "react";
import type { AnchorHTMLAttributes } from "react";
import { publicHref } from "@/lib/offprints/host";

/**
 * Every internal Offprints link. Server components write the internal prefix
 * form (`/offprints/all`); on the Offprints host the public URL has no prefix,
 * so the href is swapped after hydration through `publicHref`.
 */
export function OffLink({
  href,
  ...a
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const [shown, setShown] = useState(href);
  useEffect(() => {
    setShown(publicHref(href, window.location.hostname));
  }, [href]);
  return <a href={shown} {...a} />;
}
