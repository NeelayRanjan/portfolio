import type { ReactNode } from "react";
import { Reveal } from "./ambience/Reveal";
import { DenoiseGlyph } from "./ambience/DenoiseGlyph";
import { ResolveText } from "./ambience/ResolveText";

/**
 * One page section: wrapped in a scroll reveal and carrying the ambience accents.
 *
 * `title`/`lede` are optional: terminal sections fold their own heading and lede
 * inside the panel after the boot log, so they pass neither. Prose sections
 * (research cards) pass both and get them rendered here.
 *
 * Every section gets a corner denoise glyph (seeded per section so no two are
 * identical). `watermark` is the optional per-section one — the node graph
 * behind multi-agent, the board grid behind chess — rendered behind the content.
 */
export function Section({
  id,
  title,
  lede,
  glyphSeed = 1,
  label,
  watermark,
  children,
}: {
  id: string;
  title?: string;
  lede?: ReactNode;
  glyphSeed?: number;
  /**
   * Big teal marker in the open gap above the panel, resolving out of noise on
   * scroll-in. Decorative: it echoes the <h2> inside the panel, so it's
   * aria-hidden rather than read out twice.
   */
  label?: string;
  watermark?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Reveal id={id} className="relative scroll-mt-24 py-20">
      {watermark}
      <DenoiseGlyph seed={glyphSeed} className="top-16 right-0" />

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
          <p className="mb-8 max-w-2xl leading-relaxed text-muted">{lede}</p>
        ) : null}
        {children}
      </div>
    </Reveal>
  );
}
