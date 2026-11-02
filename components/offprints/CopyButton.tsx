"use client";

import { useEffect, useRef, useState } from "react";
import { shell } from "@/content/offprints/shell";

const CONFIRM_MS = 1400;

/**
 * Copies `text` (spec §11, "copy buttons"). `navigator.clipboard` first;
 * where it is missing or refused (an insecure origin, a denied permission),
 * the fallback selects the text on the page instead so the reader can copy
 * it themselves: the element marked `data-op-copy-source` inside the
 * button's parent. The label says which happened for 1.4s.
 */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function show(next: "copied" | "selected") {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), CONFIRM_MS);
  }

  function selectSource(button: HTMLButtonElement) {
    const source = button.parentElement?.querySelector("[data-op-copy-source]");
    const selection = window.getSelection();
    if (!source || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(source);
    selection.removeAllRanges();
    selection.addRange(range);
    show("selected");
  }

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    const button = e.currentTarget;
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      show("copied");
    } catch {
      selectSource(button);
    }
  }

  const label =
    state === "copied" ? shell.piece.copied : state === "selected" ? shell.piece.selected : shell.piece.copy;

  return (
    <button
      type="button"
      onClick={onClick}
      data-op-copy
      className="relative border border-ink bg-transparent px-2.5 py-0.5 font-serif text-[13px] text-ink hover:bg-paper after:absolute after:-inset-2 after:content-['']"
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}
