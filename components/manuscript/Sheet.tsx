import type { ReactNode } from "react";

/**
 * The bordered page on the desk. Every /  and /lab page lives inside exactly
 * one of these: a fixed-max-width paper rectangle, centered, with its own
 * clamp()'d inline padding so prose/figures never touch the border.
 *
 * Mirrors the approved mockup's `.sheet` rule verbatim (max-width 1000px, 1px
 * `--rule` border, `--paper` fill, soft drop shadow, top margin 56px, padding
 * clamped between 20-56px inline / 28-64px block). The outer 16px page gutter
 * that keeps the sheet's border off the viewport edge on narrow screens is a
 * page-shell concern, not this component's: it lives on whatever wraps Sheet
 * (see the smoke assembly in app/page.tsx for today's stand-in).
 */
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <div data-sheet className="mx-auto mt-14 max-w-[1000px] border border-rule bg-paper px-[clamp(20px,5vw,56px)] py-[clamp(28px,5vw,64px)] shadow-[0_0_90px_rgba(0,0,0,0.55)]">
      {children}
    </div>
  );
}
