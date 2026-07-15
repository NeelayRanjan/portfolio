import type { ReactNode } from "react";
import { Reveal } from "./ambience/Reveal";
import { DenoiseGlyph } from "./ambience/DenoiseGlyph";

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
  swarmLabel,
  watermark,
  children,
}: {
  id: string;
  title?: string;
  lede?: ReactNode;
  glyphSeed?: number;
  /**
   * Text the migrating swarm re-forms into, in the open gap above this section's
   * panel. Placed here rather than on the <h2> because the panel is opaque and
   * the swarm canvas sits behind it — see components/ambience/Swarm.tsx.
   */
  swarmLabel?: string;
  watermark?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Reveal id={id} className="relative scroll-mt-24 py-20">
      {watermark}
      <DenoiseGlyph seed={glyphSeed} className="top-16 right-0" />

      {swarmLabel ? (
        <div
          data-swarm={swarmLabel}
          data-swarm-align="left"
          data-swarm-frac="0.42"
          aria-hidden="true"
          className="mb-10 h-20 w-full"
        />
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
