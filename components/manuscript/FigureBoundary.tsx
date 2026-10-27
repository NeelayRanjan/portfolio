"use client";

import { Component, type ReactNode } from "react";
import { copy } from "@/content/copy";

/**
 * Keeps one figure's crash inside that figure (2026-10-27). With no boundary,
 * an error thrown while rendering a live figure unmounted the whole page:
 * the lander's chart throwing on a view from a stale cached module blanked
 * `/` for everyone who scrolled that far. DeferredMount wraps every deferred
 * figure in one. The fallback says what happened and offers a remount; it
 * never stands in for the figure's output.
 */
export class FigureBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("figure crashed", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-figure-crashed className="my-8 border border-rule bg-panel p-5 font-mono text-[12px] text-mut">
        {copy.figureCrashed}{" "}
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="text-ink underline decoration-dotted underline-offset-[3px] hover:text-warm"
        >
          {copy.figureRetry}
        </button>
      </div>
    );
  }
}
