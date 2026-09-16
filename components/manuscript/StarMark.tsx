/**
 * The mark on both doors into stargaze (discoverability spec §5): a small
 * four-pointed star, drawn in the button's own colour. Decorative:
 * `aria-hidden`, so the button's accessible name stays exactly its label.
 * Server-renderable with a fixed em size, so nothing shifts on hydration.
 */
export function StarMark() {
  return (
    <svg
      data-star-mark
      aria-hidden
      focusable="false"
      viewBox="0 0 10 10"
      width="0.9em"
      height="0.9em"
      className="mr-[0.4em] inline-block shrink-0 align-[-0.1em]"
    >
      <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" fill="currentColor" />
    </svg>
  );
}
