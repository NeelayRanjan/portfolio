"use client";

import { useEffect } from "react";
import { warmBackground } from "@/lib/warm";

/**
 * Fires `warmBackground()` once on mount and renders nothing. `warmBackground`
 * is already memoized (a module-level `started` flag) and gated on
 * affordability internally, so this component's only job is to call it from
 * a client boundary — `page.tsx` itself stays a server component.
 */
export function WarmKick() {
  useEffect(() => {
    warmBackground();
  }, []);

  return null;
}
