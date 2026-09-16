import { copy } from "@/content/copy";

/**
 * What the sky behind the page is, and where its data comes from. Server
 * component: the motion/still wording is swapped by CSS media variants, so a
 * reduced-motion visitor (whose sky never turns) never reads "180 times
 * faster". Pinned to the viewport bottom while stargazing (app/globals.css).
 *
 * The colour clause is swapped the same way, by CSS rather than by JS, but on
 * `body[data-stargaze]` instead of a media query (final review m5): this line
 * renders on every page, and off stargaze the sky behind it is grey, so the
 * clause about long-exposure colour would describe nothing on screen.
 */
export function SkyCredit() {
  return (
    <p
      data-sky-credit
      className="px-4 pb-6 text-center font-mono text-[10px] leading-relaxed text-mut/70"
    >
      <span className="motion-reduce:hidden">{copy.stargaze.credit}</span>
      <span className="hidden motion-reduce:inline">{copy.stargaze.creditStill}</span>
      <span data-sky-credit-colour>{copy.stargaze.creditColour}</span>
      {copy.stargaze.creditTail}
    </p>
  );
}
