import type { ReactNode } from "react";
import { TerminalLabel } from "./ambience/TerminalLabel";

type TerminalPanelProps = {
  /** Monospace label in the title bar, e.g. "x0-diffusion --digit 7". */
  label: string;
  /** Right-aligned status text in the title bar. */
  status?: ReactNode;
  /** Renders below the title bar, above the body. Used for the illustrative tag. */
  notice?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Drop the body padding when the child manages its own edges (e.g. canvas). */
  flush?: boolean;
};

const DOTS = [
  { color: "#f0564a", label: "close" },
  { color: "#f2b23e", label: "minimise" },
  { color: "#5dcaa5", label: "zoom" },
];

export function TerminalPanel({
  label,
  status,
  notice,
  children,
  className = "",
  flush = false,
}: TerminalPanelProps) {
  return (
    <section
      // The panel is opaque, so the swarm canvas behind it can't show through.
      // This marks it as an obstacle to route around — see ambience/Swarm.tsx.
      data-swarm-avoid=""
      className={`overflow-hidden rounded-lg border border-line bg-panel ${className}`}
    >
      <header className="flex items-center gap-3 border-b border-line bg-panel-bar px-4 py-2.5">
        <span className="flex shrink-0 gap-2" aria-hidden="true">
          {DOTS.map((dot) => (
            <span
              key={dot.label}
              className="size-2.5 rounded-full opacity-70"
              style={{ background: dot.color }}
            />
          ))}
        </span>
        <span className="truncate font-mono text-xs tracking-wide text-muted">
          <TerminalLabel text={label} />
        </span>
        {status ? (
          <span className="ml-auto shrink-0 font-mono text-xs text-faint">
            {status}
          </span>
        ) : null}
      </header>

      {notice ? (
        <p className="border-b border-line px-4 py-2 font-mono text-[11px] leading-relaxed text-faint">
          {notice}
        </p>
      ) : null}

      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}
