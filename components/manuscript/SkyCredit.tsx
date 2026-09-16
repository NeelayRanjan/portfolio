import { copy } from "@/content/copy";

/**
 * What the sky behind the page is, and where its data comes from. Server
 * component: the motion/still wording is swapped by CSS media variants, so a
 * reduced-motion visitor (whose sky never turns) never reads "180 times
 * faster". Pinned to the viewport bottom while stargazing (app/globals.css).
 *
 * `creditTail` follows either variant and carries its own leading space. It
 * is no longer stargaze-gated: the sky shows colour on every page since the
 * discoverability round (spec §7), so the colour claim is true everywhere.
 *
 * `data-sky-credit-body` carries the chrome's desk-toned backing in both
 * modes (app/globals.css, discoverability Task 6): the Milky Way passing
 * behind the line used to pull its contrast down to ~3.0:1. It is also
 * `data-stargaze-chrome`: while stargazing it takes the pointer over its box.
 */
export function SkyCredit() {
  return (
    <p
      data-sky-credit
      className="px-4 pb-6 text-center font-mono text-[10px] leading-relaxed text-mut/70"
    >
      <span data-sky-credit-body data-stargaze-chrome>
        <span className="motion-reduce:hidden">{copy.stargaze.credit}</span>
        <span className="hidden motion-reduce:inline">{copy.stargaze.creditStill}</span>
        {copy.stargaze.creditTail}
      </span>
    </p>
  );
}
