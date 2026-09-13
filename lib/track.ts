import { track } from "@vercel/analytics";

/**
 * The site's custom analytics events, all in one place so the dashboard's
 * event names never drift between call sites. Page views need nothing here:
 * `<Analytics />` in app/layout.tsx records them, client navigations included.
 *
 * Deliberately two events and no more. Custom events count against a
 * monthly quota, and the questions they answer are the two that matter in
 * application season: did a visitor open the resume (or another identity
 * link), and does anyone actually use the live demos.
 *
 * ⚠️ Local builds cannot show these arriving. Off Vercel the tracker script
 * (`/_vercel/insights/script.js`) 404s, so every call waits in `window.vaq`
 * forever — which is exactly what the verify suite reads to prove the calls
 * fire. Real delivery is only observable in the Vercel dashboard.
 */

/** A click on an outbound identity or reference link (Resume, CV, ORCID...). */
export function trackOutbound(label: string) {
  track("outbound_link", { label });
}

const demosSeen = new Set<string>();

/**
 * A demo produced real output: a sampled headshot, a generated digit, a chess
 * move the engine answered. Once per demo per page load — the question is
 * "did they use it", and a visitor scrubbing a slider must not burn quota.
 * Call only AFTER the work succeeds, never on the button press, so a failed
 * model load doesn't count as use.
 */
export function trackDemoOnce(demo: "headshot" | "draw" | "chess") {
  if (demosSeen.has(demo)) return;
  demosSeen.add(demo);
  track("demo_used", { demo });
}
