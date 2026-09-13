"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackOutbound } from "@/lib/track";

/**
 * A plain `<a>` that records an `outbound_link` event on click. The client
 * boundary is this one leaf, so the Masthead and References stay server
 * components. `onAuxClick` catches middle-click "open in new tab", which a
 * bare `onClick` misses.
 */
export function TrackedLink({
  label,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { label: string }) {
  return (
    <a
      {...props}
      data-track-label={label}
      onClick={() => trackOutbound(label)}
      onAuxClick={() => trackOutbound(label)}
    />
  );
}
