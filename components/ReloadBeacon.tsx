"use client";

import { useEffect } from "react";
import { trackReloadOnce } from "@/lib/track";

/**
 * Fires `trackReloadOnce()` from a client boundary once per page load and
 * renders nothing, so `app/layout.tsx` stays a server component. The
 * function itself decides whether this load was a reload.
 */
export function ReloadBeacon() {
  useEffect(() => {
    trackReloadOnce();
  }, []);

  return null;
}
