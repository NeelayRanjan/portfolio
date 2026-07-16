"use client";

import { useState } from "react";

/**
 * A panel's boot command, with its numbers turned into inputs.
 *
 * THE RULE, and it outranks how much fun this is: **a param is editable only if
 * changing it produces a real, corresponding change. When in doubt, display-only.**
 * A number that changes nothing is worse than a number you can't touch — it is the
 * illusion breaking in the visitor's hands, on a page whose whole claim is that the
 * demos are real. This is "never fake a model's output" applied to a control.
 *
 * That is why this component makes you pass `params` and `frozen` separately
 * rather than parsing flags out of a string. A frozen flag renders as plain text
 * with no affordance, so §2's baked `--steps 32` cannot accidentally look live
 * just because it sits next to a `--digit` that is. Per-demo rulings live in
 * CLAUDE.md; re-read them before making anything here editable.
 *
 * WHY IT LIVES IN THE BOOT LOG and not the panel's title bar: the title bar
 * truncates, and the full sdedit line is ~60 characters. The log is body-width.
 *
 * The swap-in is BootScreen's trick, for BootScreen's reason: the boot TYPES this
 * command a character at a time, and you cannot type into an input on a timer
 * without fighting the caret. So the line types as plain text and the inputs
 * appear once it's done. The typed text is built from the same defaults the params
 * start at, so there is nothing to reconcile at the swap.
 */

export type NumParam = {
  kind: "param";
  /** "--steps". Printed as-is, never parsed. */
  flag: string;
  value: number;
  min: number;
  max: number;
  /** Also sets the printed precision: 0.05 prints 2dp, 1 prints none. */
  step: number;
  /** Numeric keypad instead of a decimal one. */
  int?: boolean;
  onCommit: (v: number) => void;
};

/** A flag whose value is one of a fixed set, e.g. `--target two-moons`. */
export type ChoiceParam = {
  kind: "choice";
  flag: string;
  value: string;
  options: { value: string; label: string }[];
  onCommit: (v: string) => void;
};

/** A flag that is NOT editable, and must not look it. */
export type FrozenParam = { kind: "frozen"; flag: string; value: string };

/**
 * ⚠️ ONE ORDERED LIST, not `params` + `frozen`.
 *
 * The two used to be separate props, which silently forced every live flag ahead
 * of every frozen one. Chess types `--model int8 --sims 250` and that ordering is
 * unrepresentable — the rendered line would come out `--sims 250 --model int8`,
 * disagree with the typed BOOT_CMD, and visibly rewrite itself at the handover.
 * Order here is the order on screen, and it must match the panel's BOOT_CMD.
 */
export type CommandItem = NumParam | ChoiceParam | FrozenParam;

const decimalsOf = (step: number) => (String(step).split(".")[1] ?? "").length;

/**
 * Clamp HARD: snap to the grid, then into range. Never pass a raw value through.
 *
 * The toFixed round-trip is not decoration — `Math.round(0.6 / 0.05) * 0.05` is
 * 0.6000000000000001, which would print as that.
 */
export function snap(p: NumParam, raw: number): number {
  const stepped = Math.round(raw / p.step) * p.step;
  const clamped = Math.min(p.max, Math.max(p.min, stepped));
  return Number(clamped.toFixed(decimalsOf(p.step)));
}

/** String(0.6) is "0.6" and String(2) is "2" — snap() already made it exact. */
const show = (v: number) => String(v);

function ParamInput({ p, disabled }: { p: NumParam; disabled: boolean }) {
  /** null = not being edited, so the committed value shows. A draft has to exist
   *  or you could never type "0." on the way to "0.5". */
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? show(p.value);

  const commit = () => {
    // No draft means no edit — which matters, because disabling a focused input
    // blurs it, and a blur must not re-run anything on its own.
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null); // snap back to the committed value, edited or not
    if (draft.trim() === "" || !Number.isFinite(n)) return;
    const v = snap(p, n);
    if (v !== p.value) p.onCommit(v);
  };

  return (
    <input
      value={text}
      disabled={disabled}
      inputMode={p.int ? "numeric" : "decimal"}
      spellCheck={false}
      autoComplete="off"
      aria-label={`${p.flag}, ${p.min} to ${p.max}`}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur(); // blur commits
        if (e.key === "Escape") {
          setDraft(null); // abandon, keep the old value
          e.currentTarget.blur();
        }
      }}
      // Same font, colour and size as the line it sits in — the dashed rule is
      // the whole affordance, exactly like the boot screen's username.
      className="inline-block select-text border-b border-dashed border-line bg-transparent p-0 text-center align-baseline text-ink outline-none transition-colors hover:border-faint focus:border-teal focus:text-teal disabled:cursor-not-allowed disabled:opacity-50"
      // Sized to content, so the caret sits where the number ends rather than in
      // the middle of a default-width box.
      style={{ width: `${Math.max(text.length, 1)}ch` }}
    />
  );
}

/**
 * A `<select>` wearing the command line's clothes.
 *
 * Native on purpose: it gets the platform's own picker, keyboard handling and
 * touch behaviour for free, and this site has no component libraries. Sized to
 * its text like the number inputs, so the line doesn't jump when the value does.
 */
function ChoiceInput({ p, disabled }: { p: ChoiceParam; disabled: boolean }) {
  return (
    <span className="relative inline-block">
      <select
        value={p.value}
        disabled={disabled}
        aria-label={p.flag}
        onChange={(e) => p.onCommit(e.target.value)}
        className="cursor-pointer appearance-none border-b border-dashed border-line bg-transparent p-0 pr-3 font-mono text-[11px] text-ink outline-none transition-colors hover:border-faint focus:border-teal focus:text-teal disabled:cursor-not-allowed disabled:opacity-50"
        style={{ width: `${p.value.length + 2}ch` }}
      >
        {p.options.map((o) => (
          // The picker itself is the OS's, so it needs a readable background —
          // it doesn't inherit the panel's.
          <option key={o.value} value={o.value} className="bg-panel text-ink">
            {o.label}
          </option>
        ))}
      </select>
      {/* appearance-none removes the arrow, and the arrow is the affordance. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-[2px] text-faint"
      >
        ▾
      </span>
    </span>
  );
}

export function CommandLine({
  name,
  items,
  disabled = false,
  dirty = false,
  hint,
  onReset,
}: {
  name: string;
  /** In BOOT_CMD's order. See CommandItem. */
  items: CommandItem[];
  /** True while a run is in flight. */
  disabled?: boolean;
  /** Anything differs from its default. Drives the reset affordance. */
  dirty?: boolean;
  /**
   * A trailing shell comment pointing at the inputs, e.g. "edit any number".
   *
   * The dashed underline is a thin affordance on its own — you have to already be
   * looking at the line to notice it. A `#` comment is what a real command line
   * would carry, so it says "these are yours" without adding chrome.
   *
   * ⚠️ Word it per panel. "edit any number" is a lie on §2, where only `--digit`
   * is live and the rest is baked into the export.
   */
  hint?: string;
  onReset?: () => void;
}) {
  return (
    <span className="text-ink">
      <span aria-hidden="true" className="whitespace-nowrap">
        {name}
      </span>
      {/* ⚠️ Each flag and its value wrap as ONE unit, and the space BETWEEN units
          is the only break opportunity. Without the nowrap the line breaker splits
          `--strength` into `--` + `strength` across two lines (a hyphen is a legal
          break), and a flag can end up orphaned from the box it labels. See the
          Tokens note in BootLog — same bug, same reason. */}
      {items.map((it) => (
        <span key={it.flag}>
          {" "}
          <span className="whitespace-nowrap">
            {it.kind === "frozen" ? (
              // Baked. No underline, no control, no hover: it must read as output.
              <span aria-hidden="true">
                {it.flag} {it.value}
              </span>
            ) : (
              <>
                <span aria-hidden="true">{it.flag} </span>
                {it.kind === "param" ? (
                  <ParamInput p={it} disabled={disabled} />
                ) : (
                  <ChoiceInput p={it} disabled={disabled} />
                )}
              </>
            )}
          </span>
        </span>
      ))}
      {/* One slot, two states. The hint retires the moment you've used it, and
          reset takes its place — which is also the only moment reset is worth
          offering. A `#` comment is what a real command line would carry, so it
          points at the inputs without adding chrome. */}
      {dirty && onReset ? (
        <button
          onClick={onReset}
          disabled={disabled}
          className="ml-3 border-b border-dashed border-line text-faint transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
        >
          # reset
        </button>
      ) : hint ? (
        // aria-hidden: the inputs are already exposed as labelled controls, so a
        // screen reader is told they're editable without this.
        <span aria-hidden="true" className="ml-3 text-faint">
          # {hint}
        </span>
      ) : null}
    </span>
  );
}
