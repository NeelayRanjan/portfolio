"use client";

import { useEffect, useRef } from "react";

/**
 * The migrating particle swarm.
 *
 * One fixed, full-viewport canvas behind the page content. Particles perform
 * Langevin descent into wells carved from whatever text the ACTIVE station
 * declares, and re-target as you scroll: the nameplate at the top, then each
 * section's label in the open gap above its panel.
 *
 * Stations are declared in the DOM, not hardcoded here — any element with
 * `data-swarm` is a station, and its text is the attractor. Sizing comes from
 * the element's own box, so layout owns placement and this owns physics.
 *
 * TODAY THERE IS EXACTLY ONE STATION: the hero nameplate. Section labels were
 * built and then removed — a swarm that re-forms all the way down the page is a
 * full-page background that never stops moving, and on a phone that reads as
 * noise rather than ambience. The multi-station machinery stays because it costs
 * nothing and it's the seam; adding a `data-swarm` element brings it back.
 *
 * That also buys back the off-screen pause: with the swarm confined to the hero,
 * the loop stops once no station is on screen, so scrolling the rest of the page
 * costs nothing. A migrating swarm could never do that — the canvas IS the
 * viewport.
 *
 * IF STATIONS EVER RETURN: don't put one on a section <h2>. Those live inside
 * TerminalPanel, which is opaque (`bg-panel`), and the canvas is behind the
 * content, so the swarm would be invisible. They go in open background.
 */

/* ---- nameplate / stations ------------------------------------------------ */
const TRACKING_RATIO = 6 / 78; // ~6px letter-spacing at 78px, scaled
const FONT_MAX = 130;
/** `data-swarm-frac` is the DESKTOP width fraction. The same fraction of a phone's
 *  much smaller box is a tiny nameplate, so widen it as the viewport narrows —
 *  ramping to +this at <=640px. (The pre-Swarm hero did this and it got lost in
 *  the move; the nameplate was unreadably small on mobile until it came back.) */
const NARROW_FRAC_BOOST = 0.2;
const NARROW_W = 640;
const WIDE_W = 1280;
const STRIDE_SMALL = 3;
const SMALL_SCREEN = 640;
const MAX_POINTS = 5200;

/* ---- energy landscape ---------------------------------------------------- */
/** Energy cells per em of font size. The grid must RESOLVE the letterforms: at a
 *  fixed 5px cell a 48px label's strokes are ~1 cell wide, and the 3x3 blur
 *  smears the whole word into one featureless well, so particles settle into a
 *  blob instead of letters. Scaling the cell to the font keeps a stroke ~3 cells
 *  wide at every station size. */
const CELL_PER_FONT = 1 / 26;
const CELL_MIN = 2;
const COVER_GAIN = 1.6;
const BASIN_MAX_ENERGY = 0.85;

/* ---- Langevin ------------------------------------------------------------ */
const T0 = 2.1;
const T_MIN = 0.22;
const T_TAU = 1400;
const GRAD_FORCE = 10;
/** Inside a letter the energy is flat, so its gradient is ZERO and this is the
 *  only thing holding a particle on its outline home. The spec's 0.02 loses to
 *  the T_MIN=0.22 noise floor and the letters read as fuzz; small labels become
 *  illegible outright. */
const HOME_PULL = 0.1;
const HOME_HEAT_RELIEF = 0.7;
const HEAT_NOISE = 2.6;
const VEL_DAMP = 0.82;
const FORCE_GAIN = 0.4;
const POS_GAIN = 0.5;
const HEAT_DECAY = 0.94;
const HEAT_SPLIT = 0.35;

/* ---- migration ----------------------------------------------------------- */
/** Pull toward a new station, while in transit. Stronger than HOME_PULL so the
 *  swarm actually crosses the page instead of dawdling in the gradient. */
const MIGRATE_PULL = 0.055;
const MIGRATE_MAX = 9; // px/frame cap while migrating
/** A particle counts as arrived within this distance; once all are close, the
 *  station is no longer "in transit" and normal Langevin resumes. */
const ARRIVED_DIST = 26;
/** Fade for particles with no home at the current station (smaller labels need
 *  fewer points, so the excess dissipates instead of doubling up). */
const ALPHA_EASE = 0.06;

/* ---- panel avoidance ----------------------------------------------------- */
/** Panels are opaque and the canvas sits behind them, so a swarm crossing one
 *  just disappears for the length of the trip. Push particles out SIDEWAYS so
 *  they skirt the panel through the page gutter and stay visible the whole way.
 *
 *  Horizontally, not toward the nearest edge: a panel is far wider than it is
 *  tall, so "nearest edge" is usually the top — which shoves a descending swarm
 *  back where it came from and stalls it against the panel's roof. */
const AVOID_PAD = 22; // taper band outside the panel box
const AVOID_FORCE = 7;
/** Below this much gutter there's nowhere to route to (the panel spans the
 *  viewport), so pushing sideways would just fling particles off-screen. */
const AVOID_MIN_GUTTER = 44;

/* ---- disturbances -------------------------------------------------------- */
const KICK_MIN_MS = 2800;
const KICK_MAX_MS = 4600;
const KICK_R_MIN = 46;
const KICK_R_MAX = 66;
const KICK_HEAT = 0.7;

/* ---- drag ---------------------------------------------------------------- */
const GRAB_R = 72;
const GRAB_HEAT = 0.8;
const FLING_MAX = 26;
const HOLD_PULL = 0.09;
const HOLD_DAMP = 0.86;
const HOLD_JITTER = 1.1;
const HOLD_CORE = 26;
const HOLD_REPEL = 0.55;
const MOUSE_VEL_GAIN = 0.22;

/** All per-frame tuning is expressed at 60fps; each tick scales by dt/this so the
 *  sim runs identically at 30, 60 or 144Hz. The kick schedule and the anneal run
 *  on wall-clock ms, so unscaled physics would drift out of step with them. */
const BASE_FRAME_MS = 1000 / 60;

type Station = {
  el: HTMLElement;
  /** Energy cell size in px for this station, scaled to its font. */
  cell: number;
  /** Home points in the station's LOCAL box coords, as flat x,y pairs. */
  homes: Float32Array;
  count: number;
  /** energy[gy * gw + gx] over the station's local box. */
  energy: Float32Array;
  gw: number;
  gh: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heat: number;
  /** Eases to 1 when this particle has a home at the active station, else to 0. */
  alpha: number;
  grabbed: boolean;
};

export function Swarm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Transparent: the body's dot-grid and the grain layer must show through.
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let stations: Station[] = [];
    let obstacles: { l: number; t: number; r: number; b: number }[] = [];
    let particles: Particle[] = [];
    let active = -1;
    let transit = false;
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, holding: false };

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let elapsed = 0;
    let age = 0;
    let nextKick = KICK_MIN_MS;

    /** Rasterize one station's text and derive its homes + energy grid. */
    const buildStation = (el: HTMLElement): Station | null => {
      const rect = el.getBoundingClientRect();
      const bw = Math.round(rect.width);
      const bh = Math.round(rect.height);
      if (bw < 8 || bh < 8) return null;

      const lines = (el.dataset.swarm ?? "").split("|").filter(Boolean);
      if (!lines.length) return null;
      const align = el.dataset.swarmAlign === "center" ? "center" : "left";
      const baseFrac = Number(el.dataset.swarmFrac ?? 0.34);
      const wide = Math.min(1, Math.max(0, (w - NARROW_W) / (WIDE_W - NARROW_W)));
      const frac = Math.min(0.92, baseFrac + (1 - wide) * NARROW_FRAC_BOOST);

      const off = document.createElement("canvas");
      off.width = bw;
      off.height = bh;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return null;

      const setFont = (size: number) => {
        octx.font = `700 ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
        octx.letterSpacing = `${(size * TRACKING_RATIO).toFixed(2)}px`;
      };
      // measureText is linear in font size: measure once at a reference, scale to target.
      const REF = 100;
      setFont(REF);
      const refW = Math.max(...lines.map((l) => octx.measureText(l).width));
      let font = REF * ((bw * frac) / refW);
      font = Math.min(font, (bh * 0.62) / (lines.length * 1.02), FONT_MAX);
      setFont(font);

      octx.fillStyle = "#fff";
      octx.textAlign = align;
      octx.textBaseline = "middle";
      const lineH = font * 1.02;
      const top = bh / 2 - ((lines.length - 1) * lineH) / 2;
      const x = align === "center" ? bw / 2 : 0;
      lines.forEach((line, i) => octx.fillText(line, x, top + i * lineH));

      const mask = octx.getImageData(0, 0, bw, bh).data;
      const on = (px: number, py: number) =>
        px >= 0 && py >= 0 && px < bw && py < bh && mask[(py * bw + px) * 4 + 3] > 128;

      const cell = Math.max(CELL_MIN, Math.round(font * CELL_PER_FONT));

      // Energy grid: per-cell coverage -> 3x3 box blur -> energy. Low inside letters.
      const gw = Math.ceil(bw / cell);
      const gh = Math.ceil(bh / cell);
      const cover = new Float32Array(gw * gh);
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          let hits = 0;
          for (let py = gy * cell; py < (gy + 1) * cell; py++) {
            for (let px = gx * cell; px < (gx + 1) * cell; px++) if (on(px, py)) hits++;
          }
          cover[gy * gw + gx] = hits / (cell * cell);
        }
      }
      const energy = new Float32Array(gw * gh);
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          let sum = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = gx + dx;
              const ny = gy + dy;
              if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
              sum += cover[ny * gw + nx];
              n++;
            }
          }
          energy[gy * gw + gx] = 1 - Math.min(1, (sum / n) * COVER_GAIN);
        }
      }

      // Homes are OUTLINE points, not the filled interior: an on-pixel with at
      // least one off 4-neighbour. Particles trace thin, even letterforms instead
      // of clumping inside the strokes.
      let pts: number[] = [];
      for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
          if (!on(px, py)) continue;
          if (on(px - 1, py) && on(px + 1, py) && on(px, py - 1) && on(px, py + 1)) continue;
          pts.push(px, py);
        }
      }
      const thin = (step: number) => {
        const out: number[] = [];
        for (let i = 0; i < pts.length / 2; i += step) out.push(pts[i * 2], pts[i * 2 + 1]);
        pts = out;
      };
      if (w < SMALL_SCREEN) thin(STRIDE_SMALL);
      if (pts.length / 2 > MAX_POINTS) thin(2);

      return { el, cell, homes: new Float32Array(pts), count: pts.length / 2, energy, gw, gh };
    };

    const buildAll = () => {
      const els = [...document.querySelectorAll<HTMLElement>("[data-swarm]")];
      stations = els.map(buildStation).filter((s): s is Station => s !== null);

      // One particle per home of the largest station; smaller stations fade the
      // excess out rather than stacking duplicates on the same point.
      const n = stations.reduce((m, s) => Math.max(m, s.count), 0);
      if (particles.length !== n) {
        particles = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          vy: 0,
          heat: 0,
          alpha: 1,
          grabbed: false,
        }));
      }
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildAll();
    };

    /** The station nearest the viewport's upper third wins. */
    const pickActive = () => {
      const line = h * 0.45;
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < stations.length; i++) {
        const r = stations[i].el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - line);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };

    /** Panel boxes in viewport coords. One pass per frame, not per particle. */
    const readObstacles = () => {
      obstacles = [];
      for (const el of document.querySelectorAll<HTMLElement>("[data-swarm-avoid]")) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > h + 200) continue; // far off-screen
        if (Math.min(r.left, w - r.right) < AVOID_MIN_GUTTER) continue; // no gutter
        obstacles.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      }
    };

    /** Sideways shove out of any panel this particle is inside. */
    const avoidForce = (px: number, py: number) => {
      let fx = 0;
      for (const q of obstacles) {
        if (py < q.t - AVOID_PAD || py > q.b + AVOID_PAD) continue;
        if (px < q.l - AVOID_PAD || px > q.r + AVOID_PAD) continue;
        const toLeft = px - (q.l - AVOID_PAD);
        const toRight = q.r + AVOID_PAD - px;
        const depth = Math.min(toLeft, toRight);
        // Taper across the pad band so the boundary doesn't snap.
        const t = Math.min(1, depth / AVOID_PAD);
        fx += (toLeft < toRight ? -1 : 1) * AVOID_FORCE * t;
      }
      return fx;
    };

    const energyAt = (s: Station, gx: number, gy: number) => {
      // Outside the station's box is maximum energy, so gradients push inward.
      if (gx < 0 || gy < 0 || gx >= s.gw || gy >= s.gh) return 1;
      return s.energy[gy * s.gw + gx];
    };

    const thermalKick = (s: Station, ox: number, oy: number) => {
      if (!s.count) return;
      const i = (Math.random() * s.count) | 0;
      const cx = s.homes[i * 2] + ox;
      const cy = s.homes[i * 2 + 1] + oy;
      const r = KICK_R_MIN + Math.random() * (KICK_R_MAX - KICK_R_MIN);
      const r2 = r * r;
      for (let j = 0; j < particles.length && j < s.count; j++) {
        const hx = s.homes[j * 2] + ox;
        const hy = s.homes[j * 2 + 1] + oy;
        const dx = hx - cx;
        const dy = hy - cy;
        if (dx * dx + dy * dy <= r2) particles[j].heat = KICK_HEAT;
      }
    };

    const grab = (x: number, y: number) => {
      const r2 = GRAB_R * GRAB_R;
      let held = 0;
      for (const p of particles) {
        if (p.alpha < 0.5) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy > r2) continue;
        p.grabbed = true;
        p.heat = GRAB_HEAT;
        held++;
      }
      pointer.holding = held > 0;
      return held;
    };

    const release = () => {
      for (const p of particles) {
        if (!p.grabbed) continue;
        p.grabbed = false;
        p.vx = Math.max(-FLING_MAX, Math.min(FLING_MAX, p.vx));
        p.vy = Math.max(-FLING_MAX, Math.min(FLING_MAX, p.vy));
      }
      pointer.holding = false;
    };

    const paint = () => {
      ctx.clearRect(0, 0, w, h);
      const s = stations[active];
      if (!s) return;
      const r = s.el.getBoundingClientRect();

      // Basin heatmap for the active station only, translated to its box.
      for (let gy = 0; gy < s.gh; gy++) {
        for (let gx = 0; gx < s.gw; gx++) {
          const e = s.energy[gy * s.gw + gx];
          if (e >= BASIN_MAX_ENERGY) continue;
          ctx.fillStyle = `rgba(93, 202, 165, ${((1 - e) * 0.1).toFixed(3)})`;
          ctx.fillRect(r.left + gx * s.cell, r.top + gy * s.cell, s.cell, s.cell);
        }
      }

      // Two colour passes rather than a fillStyle change per particle.
      ctx.fillStyle = "rgba(93, 202, 165, 0.92)";
      for (const p of particles) {
        if (p.alpha < 0.04 || p.heat > HEAT_SPLIT) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x - 0.7, p.y - 0.7, 1.4, 1.4);
      }
      ctx.fillStyle = "rgba(143, 136, 221, 0.95)";
      for (const p of particles) {
        if (p.alpha < 0.04 || p.heat <= HEAT_SPLIT) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    };

    /** Reduced-motion: particles parked at their homes, redrawn as you scroll.
     *  No physics, no kicks, no drag — a readout, like the rail. */
    const paintResolved = () => {
      ctx.clearRect(0, 0, w, h);
      active = pickActive();
      const s = stations[active];
      if (!s) return;
      const r = s.el.getBoundingClientRect();
      ctx.fillStyle = "rgba(93, 202, 165, 0.92)";
      for (let i = 0; i < s.count; i++) {
        ctx.fillRect(s.homes[i * 2] + r.left - 0.7, s.homes[i * 2 + 1] + r.top - 0.7, 1.4, 1.4);
      }
    };

    const step = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(step);

      const dt = elapsed === 0 ? BASE_FRAME_MS : Math.min(now - elapsed, 48);
      elapsed = now;
      const k = dt / BASE_FRAME_MS;
      age += dt;

      readObstacles();

      const next = pickActive();
      if (next !== active) {
        active = next;
        transit = true; // migrate hard until the swarm lands
      }
      const s = stations[active];
      if (!s) return;

      const r = s.el.getBoundingClientRect();
      const ox = r.left;
      const oy = r.top;

      const T = Math.max(T_MIN, T0 * Math.exp(-age / T_TAU));
      const noiseK = Math.sqrt(k);
      const damp = Math.pow(VEL_DAMP, k);
      const heatDecay = Math.pow(HEAT_DECAY, k);
      const alphaK = 1 - Math.pow(1 - ALPHA_EASE, k);

      nextKick -= dt;
      if (nextKick <= 0) {
        if (!transit) thermalKick(s, ox, oy);
        nextKick = KICK_MIN_MS + Math.random() * (KICK_MAX_MS - KICK_MIN_MS);
      }

      pointer.vx *= Math.pow(0.6, k);
      pointer.vy *= Math.pow(0.6, k);

      let allArrived = true;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const hasHome = i < s.count;

        // No home at this station: dissipate rather than double up on a point.
        p.alpha += ((hasHome ? 1 : 0) - p.alpha) * alphaK;
        if (!hasHome) {
          p.heat *= heatDecay;
          continue;
        }

        if (p.grabbed) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const near = Math.min(1, d / HOLD_CORE);
          let fx = dx * HOLD_PULL * near;
          let fy = dy * HOLD_PULL * near;
          if (d < HOLD_CORE) {
            const push = (1 - d / HOLD_CORE) * HOLD_REPEL;
            fx -= (dx / d) * push;
            fy -= (dy / d) * push;
          }
          fx += (Math.random() * 2 - 1) * HOLD_JITTER * noiseK + pointer.vx * MOUSE_VEL_GAIN;
          fy += (Math.random() * 2 - 1) * HOLD_JITTER * noiseK + pointer.vy * MOUSE_VEL_GAIN;
          const hdamp = Math.pow(HOLD_DAMP, k);
          p.vx = p.vx * hdamp + fx * k;
          p.vy = p.vy * hdamp + fy * k;
          p.x += p.vx * k;
          p.y += p.vy * k;
          p.heat = GRAB_HEAT;
          continue;
        }

        const hx = s.homes[i * 2] + ox;
        const hy = s.homes[i * 2 + 1] + oy;
        const dx = hx - p.x;
        const dy = hy - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > ARRIVED_DIST) allArrived = false;

        let fx: number;
        let fy: number;
        if (transit) {
          // Crossing the page: a plain capped spring. The energy gradient is
          // meaningless this far from the station's box, and noise just smears
          // the migration, so neither applies until the swarm lands.
          const d = dist || 0.001;
          const speed = Math.min(dist * MIGRATE_PULL, MIGRATE_MAX);
          fx = (dx / d) * speed;
          fy = (dy / d) * speed;
        } else {
          const gx = Math.floor((p.x - ox) / s.cell);
          const gy = Math.floor((p.y - oy) / s.cell);
          const dEdx = (energyAt(s, gx + 1, gy) - energyAt(s, gx - 1, gy)) / 2;
          const dEdy = (energyAt(s, gx, gy + 1) - energyAt(s, gx, gy - 1)) / 2;
          const pull = HOME_PULL * (1 - HOME_HEAT_RELIEF * p.heat);
          const noise = T + p.heat * HEAT_NOISE;
          fx = -dEdx * GRAD_FORCE + dx * pull + (Math.random() * 2 - 1) * noise * noiseK;
          fy = -dEdy * GRAD_FORCE + dy * pull + (Math.random() * 2 - 1) * noise * noiseK;
        }

        // Route around the panels rather than vanishing behind them.
        fx += avoidForce(p.x, p.y);

        p.vx = p.vx * damp + fx * FORCE_GAIN * k;
        p.vy = p.vy * damp + fy * FORCE_GAIN * k;
        p.x += p.vx * POS_GAIN * k;
        p.y += p.vy * POS_GAIN * k;
        p.heat *= heatDecay;
        if (p.heat < 0.005) p.heat = 0;
      }

      if (transit && allArrived) transit = false;
      paint();
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      elapsed = 0;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    active = pickActive();
    if (reduced) paintResolved();

    // With the swarm confined to the hero, the loop can stop once no station is
    // on screen — scrolling the rest of the page then costs nothing. The canvas
    // stays mounted (it's fixed and full-viewport); only the sim halts, and the
    // last frame is cleared so nothing is left stranded mid-air.
    let onScreen = false;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen && !document.hidden) start();
        else {
          stop();
          ctx.clearRect(0, 0, w, h);
        }
      },
      { rootMargin: "80px" },
    );
    for (const el of document.querySelectorAll<HTMLElement>("[data-swarm]")) io.observe(el);

    const onVisibility = () => {
      if (document.hidden || !onScreen) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Reduced-motion still has to track scroll, or a fixed nameplate would
    // follow the reader down the page.
    let scrollRaf = 0;
    const onScroll = () => {
      if (!reduced || scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        paintResolved();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---- drag ------------------------------------------------------------
       The canvas is pointer-events:none — a full-viewport layer that ate clicks
       would break every link and button on the page. Listen on the document
       instead and bail on anything interactive or panel-covered, so dragging
       only works over open background, which is exactly where particles show. */
    const blocked = (t: EventTarget | null) =>
      t instanceof Element && t.closest("section, a, button, input, textarea, select");

    const onDown = (e: PointerEvent) => {
      if (reduced || e.pointerType === "touch" || blocked(e.target)) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      grab(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (!pointer.holding) return;
      pointer.vx = e.clientX - pointer.x;
      pointer.vy = e.clientY - pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onUp = () => {
      if (pointer.holding) release();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      // Rebuilding re-rasterizes every station's text and grid — debounce it.
      resizeTimer = window.setTimeout(() => {
        resize();
        if (reduced) paintResolved();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(scrollRaf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // -z-10 paints above the body's background (dot-grid) but below in-flow
      // content, so the opaque panels still sit on top.
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
