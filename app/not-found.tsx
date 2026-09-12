"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TerminalPanel } from "@/components/TerminalPanel";
import { usePrompt } from "@/lib/identity";
import { copy } from "@/content/copy";

/**
 * 404, as a shell that can't find the file.
 *
 * It inherits the whole layout, which is the point: the boot screen still ssh's
 * in, the CharField still runs, and the prompt still follows whatever name you
 * connected as. A mistyped URL lands somewhere that is recognisably the same
 * machine rather than on Next's unstyled default in the wrong font.
 *
 * The swarm is inherited too and costs nothing here: there's no `data-swarm`
 * station on this page, so its observer never fires and the loop never starts.
 *
 * A client component only because it reads the attempted path. That is also the
 * one thing here worth being careful about — see MAX_PATH.
 */

/** The real sections (copy.notFoundV1.sections) double as navigation, so `ls` isn't
 *  a joke that dead-ends. */

/**
 * Long enough to recognise your own typo, short enough that a pasted essay can't
 * push the prompt across the panel.
 *
 * Echoing a visitor-supplied path back into the page is the one place this site
 * does that at all. It's inert because React escapes a text child, so `<script>`
 * in a URL renders as those literal characters. It would NOT be inert via
 * innerHTML, which is the same rule the ASCII grids follow for the same reason.
 */
const MAX_PATH = 32;

export default function NotFound() {
  const prompt = usePrompt();
  const raw = usePathname() || "/";
  const path = raw.length > MAX_PATH ? `${raw.slice(0, MAX_PATH)}…` : raw;

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
        <TerminalPanel label={copy.notFoundV1.shell} status={copy.notFoundV1.status}>
          <div className="font-mono text-[11px] leading-relaxed">
            <div className="select-none">
              <span aria-hidden="true" className="text-teal">
                {prompt}
              </span>{" "}
              <span className="text-ink">cat {path}</span>
            </div>
            {/* The real error, and the only line here a screen reader needs from
                the theatre: it's the one that says what happened. */}
            <div className="text-muted">cat: {path}{copy.notFoundV1.catError}</div>

            <div className="mt-4 select-none">
              <span aria-hidden="true" className="text-teal">
                {prompt}
              </span>{" "}
              <span className="text-ink">{copy.notFoundV1.ls}</span>
            </div>
            <nav aria-label="Sections" className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
              {copy.notFoundV1.sections.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="text-teal underline-offset-4 hover:underline"
                >
                  {s.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Heading and lede inside the panel, after the shell — the same shape
              every terminal section on the home page uses. */}
          <h1 className="mt-6 mb-2 text-2xl tracking-tight">{copy.notFoundV1.heading}</h1>
          <p className="max-w-2xl leading-relaxed text-muted">{copy.notFoundV1.lede}</p>
        </TerminalPanel>
      </div>
    </main>
  );
}
