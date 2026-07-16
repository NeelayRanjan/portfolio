"use client";

import { copy } from "@/content/copy";
import { HeroBoot } from "@/components/ambience/HeroBoot";

/**
 * The hero's copy, and the swarm's first station.
 *
 * The particle sim itself lives in `components/ambience/Swarm.tsx` — one fixed,
 * full-viewport canvas shared by every station, so the swarm can migrate down the
 * page. This component only reserves the nameplate's box and declares what text
 * the swarm should carve its wells from (`data-swarm`), plus the real <h1>.
 */
export function EnergyHero() {
  return (
    <header className="relative border-b border-line">
      {/* The swarm is decoration; this is what screen readers and crawlers get. */}
      <h1 className="sr-only">{copy.hero.name}</h1>

      {/* Station 0. Empty by design: the Swarm canvas paints the nameplate into
          this box. Sizing and placement come from the box, so it lives in the
          same max-w-5xl gutter as the copy below — left-aligned text then starts
          on the same edge as the tagline instead of the viewport's. */}
      <div className="mx-auto w-full max-w-5xl px-6">
        {/* ⚠️ THE BOX IS WHERE THE HERO'S DEAD ZONE LIVED. Swarm centres the
            nameplate in this box, so every pixel of height the letters don't use
            becomes air, split evenly above and below. It was 108px of nothing
            between the name and the tagline (measured: box 0..440, ink 113..332,
            tagline at 440).

            Two things that look like the fix and aren't. `data-swarm-frac` drives
            WIDTH, not height. And a single shrunken box only works on desktop:
            below ~1024px the font is width-bound rather than FONT_MAX-bound, so
            the name shrinks while a fixed box doesn't — a flat max-h-[336px]
            measured a 129px gap on a 375px phone, worse than the bug it was
            fixing. Hence three steps, tracking where the font actually comes from.
            The other half of the fix is Swarm's height fraction (0.62 -> 0.86).

            Measured gap below the ink, settled: 375px 47 · 640px 44 · 768px 32 ·
            1024px 46 · 1280px 57. Re-measure if you touch any of it. */}
        <div
          data-swarm="NEELAY|RANJAN"
          data-swarm-align="left"
          data-swarm-frac="0.52"
          aria-hidden="true"
          className="h-[40svh] max-h-[192px] min-h-[160px] w-full sm:max-h-[272px] lg:max-h-[336px]"
        />
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 pb-24">
        {/* The hero's typing prompt moved to the full-screen boot (BootScreen),
            which now owns the login beat above the nameplate. HeroBoot stays: it
            is the page-load side effects (the asset warm, tab-hidden cursors),
            and it still runs behind the boot screen, which is the cover. */}
        <HeroBoot />

        <p className="font-mono text-[11px] tracking-[2px] text-faint">
          {copy.hero.subtext}
        </p>

        <p className="mt-4 max-w-2xl font-mono text-[11px] leading-relaxed text-faint">
          {copy.hero.caption.a}{" "}
          <span className="text-indigo">{copy.hero.caption.out}</span>
          {copy.hero.caption.b}{" "}
          <span className="text-teal">{copy.hero.caption.backIn}</span>
          {copy.hero.caption.c}
        </p>

        <p className="mt-6 max-w-[54ch] leading-relaxed text-muted">
          {copy.hero.affiliation}
        </p>

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
          {/* Only rendered once PROFILE.resumeUrl is set, so an unset link never
              ships as a dead one. Externally hosted on purpose — see profile.ts. */}
          {copy.hero.links.resumeUrl ? (
            <a
              href={copy.hero.links.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-indigo underline-offset-4 transition-colors hover:text-teal hover:underline"
            >
              {copy.hero.resumeLabel}
            </a>
          ) : null}
          {copy.hero.links.items.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-indigo underline-offset-4 transition-colors hover:text-teal hover:underline"
              {...(link.href.startsWith("http")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
