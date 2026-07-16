import type { ReactNode } from "react";
import { Reveal } from "./ambience/Reveal";
import { ResolveText } from "./ambience/ResolveText";

/**
 * One page section: wrapped in a scroll reveal and carrying the ambience accents.
 *
 * `title`/`lede` are optional: terminal sections fold their own heading and lede
 * inside the panel after the boot log, so they pass neither. Prose sections
 * (research cards) pass both and get them rendered here.
 *
 * There used to be a per-section corner accent here (DenoiseGlyph): six rows of
 * " .·:-=+*" resolving noise into structure, seeded per section. The CharField
 * background now does exactly that, with the same ramp, across the whole page,
 * and re-diffuses patches of itself as you scroll. Two layers of one idea, and
 * once the field went indigo the teal corner block read as a smudge sitting on
 * top of it. Retinting it would have hidden it inside the field it duplicated,
 * so it went instead. The field is the accent now.
 *
 * `watermark` is the optional per-section one — the node graph behind
 * multi-agent, the board grid behind chess — rendered behind the content.
 */
export function Section({
  id,
  title,
  lede,
  label,
  watermark,
  children,
}: {
  id: string;
  title?: string;
  lede?: ReactNode;
  /**
   * Big teal marker in the open gap above the panel, resolving out of noise on
   * scroll-in. Says WHERE YOU ARE; the panel's <h2> says WHAT THE THING IS.
   *
   * 🔒 The two must never be the same words — they used to be ("x0 diffusion"
   * above "x0 diffusion"), which read as a stutter. See CLAUDE.md's naming table
   * before changing either.
   *
   * Still aria-hidden, but NOT because it echoes the <h2> any more: it's a
   * decorative scroll marker, and the <h2> plus the lede carry the content.
   */
  label?: string;
  watermark?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Reveal id={id} className="relative scroll-mt-24 py-20">
      {watermark}

      {label ? (
        // The panel's <h2> is the real heading; this is its echo, so it's hidden
        // from the a11y tree rather than announced twice.
        <p
          aria-hidden="true"
          className="relative mb-8 font-mono text-2xl tracking-tight text-teal sm:text-3xl"
        >
          <ResolveText text={label} />
        </p>
      ) : null}

      <div className="relative">
        {title ? <h2 className="mb-2 text-2xl tracking-tight">{title}</h2> : null}
        {lede ? (
          <p className="mb-8 max-w-[54ch] leading-relaxed text-muted">{lede}</p>
        ) : null}
        {children}
      </div>
    </Reveal>
  );
}
