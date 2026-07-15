"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_USER, cleanUser, promptFor, setUser, useUser } from "@/lib/identity";
import { CharField } from "./CharField";
import { markBooted } from "@/lib/booted";

/**
 * The page ssh's into itself before it loads. Full-screen, ~2.5s, once per fresh
 * load.
 *
 *   root@latent:~$ ssh neelay@neelayranjan.dev
 *                      ^^^^^^ editable, and that is the easter egg
 *   connected · latent
 *   neelay@latent:~$ ./latent --serve
 *
 * You start at a root shell and connect to the box the site is served from. The
 * prompt landing on `latent` after dialling `neelayranjan.dev` is not a mistake:
 * ssh shows you the remote's HOSTNAME, not the domain you dialled.
 *
 * The editable part is the ssh USERNAME, which is the whole conceit: you connect
 * as yourself, and the machine takes your word for it. Every prompt on the page
 * follows (this one, and every section panel's boot log) via lib/identity.ts.
 *
 * WHY THIS ONE IS JS AND THE OLD HERO PROMPT WAS CSS. The previous version typed
 * with a `width`/`ch` animation over text that was already in the DOM, which got
 * no-JS and reduced-motion for free. That trick cannot survive a sequence that
 * pauses for input and gates the page behind its own completion. It doesn't need
 * to: this overlay is pure decoration sitting ON TOP of a fully server-rendered
 * page, so no-JS and crawlers get the site directly (see the noscript rule in
 * layout.tsx) rather than an empty shell. The content was never inside the
 * animation.
 *
 * The clock accumulates only while `held` is false, so focusing the username
 * pauses the boot instead of racing it. Nothing else stalls it.
 */
const DOMAIN = "neelayranjan.dev";
const SSH_PREFIX = "ssh ";
const SSH_SUFFIX = `@${DOMAIN}`;
/** Schedule length only. Typing finishes before the field is editable, so the
 *  default name is always what gets typed. */
const SSH_CMD = SSH_PREFIX + DEFAULT_USER + SSH_SUFFIX;
const START_CMD = "./latent --serve";
/** Output, so it prints whole rather than typing. Costs no time, only its dwell. */
const CONNECT_LINE = "connected · latent";

/** 30ms. Below the 40-70 the brief first asked for, on purpose and by request:
 *  the ssh line is 27 characters, and at 40 it read as watching someone hunt for
 *  keys rather than a machine connecting. Whole sequence lands at ~2.0s + the
 *  fade. Faster than this and the username stops being noticeable at all, which
 *  is the one thing on this screen worth finding. */
const MS_PER_CHAR = 30;
/** The beat between a line finishing and enter landing. */
const ENTER_MS = 220;
/** How long `connected` sits before the shell comes back. */
const CONNECT_DWELL_MS = 300;
const FADE_MS = 420;
/** ~33fps. It only runs for two seconds and the tree is four lines. */
const TICK_MS = 30;

const T_SSH_END = SSH_CMD.length * MS_PER_CHAR;
const T_CONNECT = T_SSH_END + ENTER_MS;
const T_CMD_START = T_CONNECT + CONNECT_DWELL_MS;
const T_DONE = T_CMD_START + START_CMD.length * MS_PER_CHAR + ENTER_MS;

/** Characters revealed by `elapsed`, given the line started typing at `start`. */
const typedTo = (text: string, elapsed: number, start: number) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((elapsed - start) / MS_PER_CHAR))));

function Cursor() {
  return (
    <span className="term-cursor ml-px inline-block h-[1em] w-[0.5em] translate-y-[0.15em] animate-[blink_1.1s_steps(1)_infinite] bg-indigo" />
  );
}

export function BootScreen() {
  const user = useUser();
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_USER);
  /** A ref, not state: the clock reads it every tick and must not re-subscribe. */
  const held = useRef(false);

  useEffect(() => {
    // Reduced motion skips the whole thing. The CSS hides it too, so there is no
    // flash of overlay before this runs.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      setGone(true);
      return;
    }

    // Nothing to scroll to yet, and a stray wheel event scrolling the hidden page
    // under the overlay would be visible the moment it lifts.
    const html = document.documentElement;
    html.style.overflow = "hidden";

    let timer = 0;
    let last = performance.now();
    let acc = 0;
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      // The pause: time spent editing is time the boot does not advance.
      if (!held.current) acc += dt;
      setElapsed(acc);
      if (acc >= T_DONE) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(tick, TICK_MS);
    };
    timer = window.setTimeout(tick, TICK_MS);

    return () => {
      window.clearTimeout(timer);
      html.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    document.documentElement.style.overflow = "";
    // Release the swarm here, at the START of the fade, not at the end of it. Its
    // anneal runs on wall-clock from the first frame, so anything that starts it
    // earlier spends the descent behind an opaque overlay. Starting it now means
    // it is ~420ms in when the overlay clears (T still ~1.55 against a 2.1 start),
    // so the reveal lands on a swarm mid-descent rather than on an empty gap that
    // pops. See lib/booted.ts.
    markBooted();
    const t = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [done]);

  if (gone) return null;

  const typing = elapsed < T_SSH_END;
  const showConnect = elapsed >= T_CONNECT;
  const showCmd = elapsed >= T_CMD_START;

  return (
    <div
      className={`boot-screen fixed inset-0 z-50 bg-base ${done ? "boot-screen--done" : ""}`}
    >
      {/* The field, kept alive inside the terminal screen. The page's own copy is
          buried under this overlay's opaque bg-base, so the boot gets its own.
          It needs no z-index wrangling: `z-50` makes this a stacking context, and
          a negative-z child paints above its parent's BACKGROUND but below the
          parent's in-flow content — which lands the field exactly between the
          backdrop and the terminal lines.

          Two instances tick for the ~2.5s the boot lasts. Cheap at 10fps, and the
          base pattern is deterministic, so the outer one is already drawing the
          same field: when this unmounts there is nothing to match up. */}
      <CharField />

      <div className="mx-auto w-full max-w-5xl px-6 pt-12 font-mono text-xs leading-relaxed">
        {/* root is indigo, you are teal. The colour change is the connection. */}
        <div>
          <span aria-hidden="true" className="text-indigo">
            {promptFor("root")}
          </span>{" "}
          {typing ? (
            <>
              <span aria-hidden="true" className="text-ink">
                {typedTo(SSH_CMD, elapsed, 0)}
              </span>
              <Cursor />
            </>
          ) : (
            // Once the line is typed the username becomes the field. Swapped in
            // rather than typed into: you cannot type into an input character by
            // character on a timer without fighting the caret.
            <span className="text-ink">
              <span aria-hidden="true">{SSH_PREFIX}</span>
              {/* The only focusable thing here, and the only thing not aria-hidden:
                  a screen reader gets the control, not the theatre around it. The
                  dashed rule is the entire affordance — invisible in passing,
                  obvious if you are reading this line. */}
              <input
                value={draft}
                onChange={(e) => {
                  const v = cleanUser(e.target.value);
                  setDraft(v);
                  setUser(v); // live: the prompt below rewrites as you type
                }}
                onFocus={() => {
                  held.current = true;
                }}
                onBlur={() => {
                  held.current = false;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                spellCheck={false}
                autoComplete="off"
                aria-label="the user to connect as. Edit it to use your own name in this page's shell prompts."
                className="inline-block border-b border-dashed border-line bg-transparent p-0 align-baseline text-teal outline-none focus:border-teal"
                // Sized to its content so the caret sits where the text ends
                // rather than in the middle of a default-width box.
                style={{ width: `${Math.max(draft.length, 1)}ch` }}
              />
              <span aria-hidden="true">{SSH_SUFFIX}</span>
              {!showConnect ? <Cursor /> : null}
            </span>
          )}
        </div>

        {showConnect ? (
          <div aria-hidden="true" className="text-faint">
            {CONNECT_LINE}
          </div>
        ) : null}

        {showCmd ? (
          <div aria-hidden="true">
            <span className="text-teal">{promptFor(user)}</span>{" "}
            <span className="text-ink">{typedTo(START_CMD, elapsed, T_CMD_START)}</span>
            <Cursor />
          </div>
        ) : null}
      </div>
    </div>
  );
}
