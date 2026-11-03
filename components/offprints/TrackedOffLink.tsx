"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackOutbound } from "@/lib/track";
import { OffLink } from "./OffLink";

/**
 * An `OffLink` that also records `outbound_link {label}` on click (spec §8:
 * the N mark and the feed link are the Offprints host's outbound links). The
 * labels match the portfolio's own: "Portfolio" for any way back to
 * neelayranjan.dev (as `HomeMark`), "RSS" for the feed. `onAuxClick` catches
 * middle-click, as `TrackedLink` does. One leaf, so the index and the piece
 * frame stay server components.
 */
export function TrackedOffLink({
  label,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; label: string }) {
  return (
    <OffLink
      {...props}
      data-track-label={label}
      onClick={() => trackOutbound(label)}
      onAuxClick={() => trackOutbound(label)}
    />
  );
}
