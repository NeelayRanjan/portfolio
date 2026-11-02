import { TrackedLink } from "@/components/manuscript/TrackedLink";
import { shell } from "@/content/offprints/shell";

/**
 * The way back to the portfolio, top right (spec §6): the portfolio's own
 * mark (scripts/icon-mark.svg: the STIX N with two corner brackets), drawn
 * on the paper in ink with stamp-red brackets and no tile, so it carries no
 * rounded corners. A 44px target around a 32px glyph.
 */
export function HomeMark() {
  return (
    <TrackedLink
      label="Portfolio"
      href="https://neelayranjan.dev"
      title={shell.homeMark.title}
      aria-label={shell.homeMark.title}
      data-op-home
      className="fixed top-[10px] right-[12px] z-40 grid h-11 w-11 place-items-center hover:no-underline"
    >
      <svg viewBox="0 0 96 96" width="32" height="32" aria-hidden="true">
        <path
          d="M9.984 24.384V9.984H24.384"
          fill="none"
          stroke="var(--color-stamp)"
          strokeWidth="4"
          strokeLinecap="square"
        />
        <path
          d="M86.016 71.616V86.016H71.616"
          fill="none"
          stroke="var(--color-stamp)"
          strokeWidth="4"
          strokeLinecap="square"
        />
        <path
          d="M70.155 74.88H63.294L31.378 32.559H28.703L26.633 28.892Q25.198 26.84 24.025 25.864Q22.851 24.889 21.571 24.551Q20.292 24.212 18.533 24.212V21.12H35.866L64.835 59.591H65.24V34.651Q65.24 31.256 64.831 28.939Q64.422 26.623 62.829 25.417Q61.237 24.212 57.553 24.212V21.12H77.467V24.212Q74.137 24.212 72.57 25.432Q71.002 26.652 70.579 29.014Q70.155 31.375 70.155 34.8ZM38.337 74.284H18.533V71.192Q21.769 71.192 23.388 69.558Q25.006 67.925 25.573 64.927Q26.139 61.929 26.139 57.883V26.793H30.973V61.562Q30.973 65.608 31.539 67.672Q32.106 69.735 33.724 70.464Q35.343 71.192 38.337 71.192Z"
          fill="var(--color-ink)"
        />
      </svg>
    </TrackedLink>
  );
}
