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
 * move the engine answered, or a visitor entering stargaze mode. Once per demo
 * per page load — the question is "did they use it", and a visitor scrubbing a
 * slider must not burn quota. Call only AFTER the work succeeds, never on the
 * button press, so a failed model load doesn't count as use.
 */
export function trackDemoOnce(demo: "headshot" | "draw" | "chess" | "stargaze", via?: StargazeVia) {
  if (demosSeen.has(demo)) return;
  demosSeen.add(demo);
  track("demo_used", via ? { demo, via } : { demo });
}

/**
 * Which door a visitor used into stargaze (discoverability spec §5): the
 * toggle above the sheet, or the button at the foot of the page. A property
 * on the one `demo_used` event, never an event of its own (the quota rule),
 * so it records only the door of the FIRST entry in a page load.
 */
export type StargazeVia = "toggle" | "footer";

let reloadSent = false;

/**
 * This page load arrived by reload. The third event, added deliberately
 * (2026-09-16): a silent tab crash on a phone leaves exactly one field
 * signal, the reload that follows it, and the WebKit wasm runaway that
 * crashed the draw demo (see CLAUDE.md, Known bugs) was invisible to page
 * views alone. Once per page load by definition, so it costs no more quota
 * than a page view; the dashboard splits it by device and route. Read it as
 * a rate against page views, mobile vs desktop, before and after a fix.
 */
export function trackReloadOnce() {
  if (reloadSent) return;
  reloadSent = true;
  const nav = performance.getEntriesByType?.("navigation")?.[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (nav?.type !== "reload") return;
  // `track` is a silent no-op until `<Analytics />` installs `window.va` in
  // its own effect, and that runs AFTER this leaf's mount effect (measured:
  // sent straight from the effect, the event was dropped and the queue held
  // only the pageview). So wait for the queue, up to 10 s.
  let tries = 0;
  const send = () => {
    if ((window as Window & { va?: unknown }).va) {
      track("page_reload");
      return;
    }
    if (++tries < 100) window.setTimeout(send, 100);
  };
  send();
}
