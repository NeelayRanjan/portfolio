"use client";

import { useEffect, useState } from "react";
import { copy } from "@/content/copy";
import { setStargazing } from "@/lib/stargaze";
import { StarMark } from "./StarMark";

/**
 * The second door into stargaze (discoverability spec §5), at the foot of `/`
 * (after References) and of `/lab`. It carries the toggle's own label and
 * mark, since a second door to one feature under a second name reads as a
 * second feature. A button, not a link: it changes the mode, it goes nowhere.
 *
 * It enters through the same store call as the toggle, tagged `footer`, so
 * `demo_used` records which door came first and StargazeToggle returns focus
 * here on exit. It lives inside `main`, so while stargazing it is inert with
 * the rest of the page and out of the way.
 */
export function StargazeFooterEntry() {
  const t = copy.stargaze;
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <p
      data-stargaze-footer
      data-ready={ready ? "" : undefined}
      className="mt-14 border-t border-hair pt-6 font-mono text-[11px] leading-relaxed text-mut"
    >
      {t.footerLead}{" "}
      <button
        type="button"
        data-stargaze-footer-enter
        onClick={() => setStargazing(true, "footer")}
        className="inline-flex items-baseline whitespace-nowrap text-ink underline decoration-dotted underline-offset-[3px] transition-colors hover:text-warm"
      >
        <StarMark />
        {t.enter}
      </button>
    </p>
  );
}
