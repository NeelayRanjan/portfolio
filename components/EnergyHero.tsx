"use client";

import { PROFILE } from "@/content/profile";
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
      <h1 className="sr-only">{PROFILE.name}</h1>

      {/* Station 0. Empty by design: the Swarm canvas paints the nameplate into
          this box. Sizing and placement come from the box, so it lives in the
          same max-w-5xl gutter as the copy below — left-aligned text then starts
          on the same edge as the tagline instead of the viewport's. */}
      <div className="mx-auto w-full max-w-5xl px-6">
        <div
          data-swarm="NEELAY|RANJAN"
          data-swarm-align="left"
          data-swarm-frac="0.52"
          aria-hidden="true"
          className="h-[52svh] max-h-[440px] min-h-[260px] w-full"
        />
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 pb-16">
        {/* The hero's typing prompt moved to the full-screen boot (BootScreen),
            which now owns the login beat above the nameplate. HeroBoot stays: it
            is the page-load side effects (the asset warm, tab-hidden cursors),
            and it still runs behind the boot screen, which is the cover. */}
        <HeroBoot />

        <p className="font-mono text-[11px] tracking-[2px] text-faint">
          {PROFILE.subtext}
        </p>

        <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed text-faint">
          Illustrative Langevin simulation. The name is the ground state of an energy
          landscape carved from its own letterforms: particles descend into the wells
          and settle. Thermal kicks knock them{" "}
          <span className="text-indigo">out</span>; they re-anneal{" "}
          <span className="text-teal">back in</span>. Drag to pick up a cluster.
          Hand-built landscape, not a trained model.
        </p>

        <p className="mt-6 max-w-2xl leading-relaxed text-muted">
          {PROFILE.affiliation}
        </p>

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-3 font-mono text-sm">
          {/* Only rendered once PROFILE.resumeUrl is set, so an unset link never
              ships as a dead one. Externally hosted on purpose — see profile.ts. */}
          {PROFILE.resumeUrl ? (
            <a
              href={PROFILE.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-indigo underline-offset-4 transition-colors hover:text-teal hover:underline"
            >
              Resume
            </a>
          ) : null}
          {PROFILE.links.map((link) => (
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
