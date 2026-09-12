"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { copy } from "@/content/copy";

/**
 * Figure 3 — the flight day: `flight_lm_day.mp4`, a trained transformer's
 * synthesis of a full day of FAA flight plans. Muted, looping, lazy
 * (`preload="none"` + a poster frame so nothing downloads at first paint),
 * playing only while at least 40% of it is on screen.
 *
 * `prefers-reduced-motion` never autoplays: native `controls` render instead,
 * and the play-on-scroll effect is skipped entirely, so the video never
 * calls `.play()` on its own — it only plays if someone presses the native
 * control.
 *
 * The reduced-motion check is client-only (no server signal for a media
 * feature), so the component renders the SSR-safe default (motion allowed,
 * no controls) on first paint and flips state after mount — no hydration
 * mismatch, just a state update after commit, same pattern any client-only
 * media query needs.
 */
export function FlightFigure() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.4) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.4, 1] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <InstrumentFigure n="3" caption={copy.research.figFlight.caption}>
      {/* The source video is a light-background matplotlib map — the one
          light-mode object on a dark page. Treatment (owner call: seamless
          against the panel): full invert + hue-rotate flips the ground to
          TRUE black and keeps the teal paths, then mix-blend-mode: screen
          makes black contribute nothing — the ground becomes literally the
          panel behind it, no border, no visible rectangle; only the flights,
          state lines and timestamp paint. hue-rotate(37deg) lands the
          inverted teal dots/trails on the warm readout accent while the
          unsaturated grays (states, timestamp) stay neutral; clip-path
          inset(2px) shaves the source's own not-quite-white edge row, which
          survived inversion as a 1px light border. Presentation only; the
          committed video's pixels are untouched. */}
      <div className="mx-auto w-full max-w-[680px]">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster="/research/flight_poster.webp"
          controls={reducedMotion}
          aria-label={copy.research.figFlight.videoAria}
          className="w-full mix-blend-screen [clip-path:inset(2px)] [filter:invert(1)_hue-rotate(33deg)_saturate(2.1)_brightness(1.05)]"
        >
          <source src="/research/flight_lm_day.mp4" type="video/mp4" />
        </video>
      </div>
    </InstrumentFigure>
  );
}
