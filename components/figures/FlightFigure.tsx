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
    <InstrumentFigure n="3" caption={copy.research.flight.caption}>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster="/research/flight_poster.webp"
        controls={reducedMotion}
        aria-label={copy.research.flight.videoAria}
        className="w-full border border-rule"
      >
        <source src="/research/flight_lm_day.mp4" type="video/mp4" />
      </video>
    </InstrumentFigure>
  );
}
