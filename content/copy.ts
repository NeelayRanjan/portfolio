/**
 * All user-facing copy on the site, in one place.
 *
 * ⚠️ EDIT COPY HERE, not inline in components. This file exists so a wording
 * change is find-by-name in one file instead of a hunt through JSX. Components
 * reference `copy.*`; they no longer hold the strings.
 *
 * v2 (the "framed manuscript" redesign, see docs/superpowers/specs/2026-09-11-
 * site-redesign-design.md). The IA changed from a single-page faux-terminal to
 * a two-page paper (`/` and `/lab`), so the namespaces below are organized
 * around that: `meta`, `masthead`, `table1`, `research`, `systems`, `experience`,
 * `references`, `lab`, `notFound`. Facts come from CLAUDE.md's "Content facts"
 * section, never `content/resume-notes.md` (deleted alongside this restructure
 * — it was stale and superseded).
 *
 * Every string here is voice-gated: `node scripts/check-voice.mjs` scans every
 * string literal in this file (except the v1compat block below) for em dashes,
 * en-dash connectors, and CLAUDE.md's banned-word list. Run it after any edit.
 *
 * WHAT LIVES HERE: headings, ledes, captions, button labels, boot-log lines,
 * terminal command names, notices, prose notes, status words, page metadata,
 * the 404, and the demo labels/blurbs.
 *
 * WHAT DELIBERATELY STAYS INLINE (moving it would change behavior, not just copy):
 *   - `--flag` tokens (`--digit`, `--sims`, …). They are logic identifiers, not
 *     free prose: threaded through `commitParam`, `CommandLine`'s `flag` prop,
 *     and the echo templates, and interwoven with number interpolation in each
 *     panel's `BOOT_CMD`. They must match their param keys; centralizing them
 *     would risk a silent desync and touch the param plumbing.
 *   - Number-format glue in interpolated readouts (` · `, `p=`, `v=`, `n=`, `/`,
 *     step/timing/percent counters). These are formatting, not sentences.
 *   - aria-labels built from live structural values (`${flag}, ${min} to ${max}`,
 *     the ASCII-grid "… at step N of M" alt text). Static aria-labels ARE here.
 *   - Enum values rendered directly (the `pixel`/`ascii`/`game` button faces are
 *     the state key itself).
 *   - The `neelay@latent:~$` prompt: composed live in `lib/identity.ts` from the
 *     editable username + host, so it's a template, not a literal. (v1compat —
 *     see below; the prompt dies with the boot screen.)
 *   - `content/sample-space.md`, already the external source for that write-up.
 *
 * Strings that were HTML entities in JSX (`&rsquo;`, `&quot;`, `&ndash;`) are the
 * actual Unicode characters here (’ " –), so the render is byte-identical.
 *
 * ⚠️ COMPATIBILITY DURING THE REDESIGN (controller decision, Task 7): v1
 * components still on disk (`components/ambience/*`, `EnergyHero`,
 * `TerminalPanel`, `Section`, `app/not-found.tsx`, `app/layout.tsx`'s metadata)
 * and the demo components carried into the new IA (`DrawDigit`, `ChessPanel`,
 * `ChessActivations`, `DiffusionVisualizer`, `JepaPanel`, `SampleSpace`,
 * `SampleSpaceWriteup`, and their `lib/chess-protocol.ts` / `lib/sample-space.ts`
 * support) all reference `copy.*` keys and must keep compiling as this file
 * restructures. The demo components were mechanically repointed at their new
 * namespace (`copy.sdedit.*` → `copy.systems.draw.*`, `copy.chess.*` →
 * `copy.systems.chess.*`, `copy.diffusion.*` → `copy.lab.diffusion.*`,
 * `copy.jepa.*` → `copy.lab.jepa.*`, `copy.sampleSpace.*` →
 * `copy.lab.sampleSpace.*`) with every leaf key name kept IDENTICAL — the
 * string blocks moved wholesale, nothing in them was rewritten. `research`'s
 * three figure sub-keys were renamed to match this task's interface
 * (`wipe`→`figWipe`, `efficiency`→`figEfficiency`, `flight`→`figFlight`) with
 * the three consuming figure components updated to match.
 *
 * What couldn't be mechanically moved without breaking a v1-only file stays in
 * the v1compat block at the bottom, bounded by the literal marker comments
 * `// v1compat:start` / `// v1compat:end` (scripts/check-voice.mjs skips
 * everything between them — that copy is v1's, not this pass's). It is NOT a
 * nested namespace: `hero`, `boot`, `anchors`, and `commandLine` stay flat
 * top-level keys because `EnergyHero.tsx`, `BootScreen.tsx`, `CommandLine.tsx`
 * and `JepaPanel.tsx` (for `copy.anchors.jepa`) reference them at those exact
 * paths today, and this task's brief is explicit that those files are not to
 * be touched beyond the specified renames. `notFoundV1` is the one exception
 * that needed a NEW name (not a flat `notFound`, which this restructure
 * repoints to new drafted content): `app/not-found.tsx`'s seven references
 * were repointed from `copy.notFound.*` to `copy.notFoundV1.*` — a path edit,
 * not a JSX change, per the brief's own instruction for that file. Do not
 * extend the v1compat block; it deletes with the files that read it (Task 13).
 */
export const copy = {
  /** <title>, meta description, and the share-card (OG/Twitter) text. */
  meta: {
    title: "Neelay Ranjan · diffusion for data-scarce, safety-critical systems",
    siteName: "neelayranjan.dev",
    /** The unfurl description. Concrete, because a share card is the one place a
     *  recruiter or admissions reader sees before deciding whether to click. */
    blurb:
      "I build diffusion models for domains where labels are scarce and mistakes " +
      "are expensive: vessel segmentation from 16 labeled angiograms, a chess " +
      "engine that fits in 553 KB, a transformer that synthesizes a day of FAA " +
      "flight traffic. Two of these run live on this page, in your browser.",
    ogImageAlt: "Neelay Ranjan, generative-modeling researcher",
  },

  /** The masthead: paper title, affiliation line, bio-as-abstract, and the
   *  margin rail (stamp, date, identity links). Spec §5. */
  masthead: {
    title:
      "Neelay Ranjan. Diffusion models for domains where labels are scarce and mistakes are expensive.",
    affiliation: "NASA Ames Research Center · Regenstrief Institute · Purdue University",
    /** ~80 words, first person. Numbers here are load-bearing: keep them in
     *  sync with `research.prose` and CLAUDE.md's content facts. */
    abstract:
      "I build generative models for domains where labeled data is scarce and a " +
      "wrong prediction costs more than a missed one. My first-author paper on " +
      "label-efficient vessel segmentation from catheter angiograms is under " +
      "review at JAMIA. At NASA Ames I work on airspace coordination and a " +
      "synthetic dataset for air traffic control speech; at Regenstrief I trained " +
      "the diffusion model behind that paper. I also build a 553 KB chess engine " +
      "that runs in your browser. I'm on leave from Purdue's AI program, applying " +
      "to master's programs for fall 2027.",
    /** A claim, not decor: this changes when JAMIA's review resolves. */
    stamp: "UNDER REVIEW",
    date: "September 2026",
    links: [
      {
        label: "Resume",
        href: "https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview",
      },
      {
        label: "CV",
        href: "https://docs.google.com/document/d/1mzXEobC6bxIV_SqX761EVrDTmsYtrbsA/preview",
      },
      { label: "GitHub", href: "https://github.com/NeelayRanjan" },
      { label: "ORCID", href: "https://orcid.org/0009-0008-9482-0160" },
      { label: "Email", href: "mailto:neelay.ranjan@outlook.com" },
    ],
  },

  /** Table 1: the full-span stat band under the masthead. */
  table1: {
    caption: "The headline numbers from the paper below, and the chess engine running in your browser.",
    cells: [
      {
        value: "0.882",
        label: "Dice at 16 labeled angiograms, under review at JAMIA",
        hot: true,
      },
      { value: "25/25", label: "paired runs ahead of every baseline" },
      { value: "~75%", label: "faster surgeon corrections, measured" },
      { value: "553 KB", label: "chess engine, roughly 1900–2200 Elo, in your browser" },
    ],
  },

  /** §1 Research: the JAMIA paper, the two computed figures, the MWSCAS
   *  credit, and the NASA arc + flight-day figure. */
  research: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "Research",
    /** Two paragraphs. Every number matches CLAUDE.md's content facts and
     *  `masthead.abstract` exactly. */
    prose: [
      "My first-author paper, “Bootstrapping surgeon labeling campaigns with " +
        "x0-diffusion: label-efficient vessel segmentation of catheter-based " +
        "angiograms,” is under review at JAMIA (with Shantanu Dev and Andrew " +
        "Gonzalez at Regenstrief Institute). I trained a diffusion model to predict " +
        "the clean segmentation mask directly instead of predicting the noise, so " +
        "it reaches 0.882 Dice from just 16 labels, ahead of five baselines in 25 " +
        "of 25 paired runs.",
      "The same model produced ~75% faster corrections for a surgeon reviewing its " +
        "output, measured directly rather than estimated. The claim is label " +
        "efficiency, not peak accuracy: a few baselines eventually reach comparable " +
        "Dice too, once they see far more than 16 labels.",
    ],
    /** Rail note beside the prose. */
    scopeNote:
      "Label efficiency, not peak accuracy: given enough labeled images, some baselines match this Dice score too.",
    /** Figure 1 — real masks on a real angiogram, drag-to-compare. Carried
     *  over from Task 6 unchanged, renamed from `wipe` to match this task's
     *  interface (`components/figures/WipeFigure.tsx` updated to match). */
    figWipe: {
      caption:
        "Real segmentation masks on image 189 from the pelvic-iliac angiography benchmark, both models working from the same 16-label training budget. Drag to compare: x0-diffusion (red) scores 0.866 Dice on this image against SAM’s 0.774.",
      angiogramAlt:
        "Pelvic-iliac angiogram, image 189 from the segmentation benchmark",
      label: "wipe",
      cutLabel: "cut",
      ariaPre:
        "Wipe between the SAM mask and the x0-diffusion mask, cut at ",
      ariaPost: "%",
    },
    /** Figure 2 — mean Dice vs labeled images, computed from the paper's
     *  data. Carried over unchanged, renamed from `efficiency`. */
    figEfficiency: {
      caption:
        "Mean Dice against labeled training images, aggregated from the paper’s per-image metrics across every seed and fold. x0-diffusion (red) reaches 0.882 Dice at 16 labels, a score most baselines only match once they’ve seen 32 to 80. SAM is flat because it’s zero-shot and never retrains on the labels at all; ε-diffusion, the same architecture trained on the standard noise-prediction objective instead, stays stuck near 0.23 no matter how many labels it gets.",
      xAxisLabel: "labeled images",
      modelLabels: {
        x0diffusion: "x0-diffusion",
        sam: "SAM",
        deeplabv3: "DeepLabV3",
        resnet: "ResNet",
        vit_base_patch16: "ViT-B/16",
        hybridresnetvit: "hybrid resnet+vit",
        ediffusion: "ε-diffusion",
      },
    },
    /** MWSCAS credit line: prose sentence plus the formal citation, kept
     *  separate so the citation can stay a literal, checkable string. */
    mwscas: {
      prose:
        "I also led the PCB design team for an MRI birdcage coil, presented as an oral at IEEE MWSCAS 2026 in Cincinnati on August 11, 2026.",
      citation:
        "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), IEEE MWSCAS 2026 (oral).",
    },
    /** NASA block: the three-engagement arc, presented as one, plus the
     *  SLAAC poster's real numbers. */
    nasaProse:
      "At NASA Ames, I'm three engagements presented as one arc: SLAAC (space-launch and airspace coordination) in summer 2026 with Dr. Kapil Sheth, a synthetic text-to-speech-to-database pipeline for air traffic control speech from fall 2026 with Stephen Clarke, and a lunar digital twin project using diffusion in summer 2027. The SLAAC poster's numbers: 98–99% clear the 25 nm buffer, +1.1% median added distance at infinite lookahead, and within 1.2% of geometric optimum.",
    /** Figure 3 — the flight-plan synthesis video. Carried over unchanged,
     *  renamed from `flight`. */
    figFlight: {
      caption:
        "A trained transformer’s synthesis of a full day of FAA flight plans, generating trajectories at the density of real historical air traffic, roughly 44,000 flights. Every path in this clip is synthetic; none of it is recorded ATC data.",
      videoAria:
        "A trained transformer’s synthesis of a day of FAA flight plans, looping video",
    },
    /** Short margin notes (rail `Note`s) beside the research figures: data
     *  provenance and a claims caveat, distinct from `scopeNote` above. */
    noteBars: [
      {
        tag: "data",
        body: "The angiogram and both masks come from the public pelvic-iliac angiography benchmark, so publishing these frames is clean.",
      },
      {
        tag: "credit",
        body: "IEEE Xplore indexing for the MWSCAS paper isn't confirmed yet, so I'm not claiming it here.",
      },
    ],
  },

  /** §2 Live systems: the two demos that stay on page 1. */
  systems: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "Live systems",
    intro:
      "Both demos below run their real trained weights in your browser. Nothing here is a recording or a mockup.",

    /** Figure 4 — live SDEdit draw-a-digit. Carried over wholesale from v1's
     *  `sdedit` namespace (`copy.sdedit.*` → `copy.systems.draw.*`); every
     *  leaf key name is unchanged. */
    draw: {
      /** New for the manuscript chrome: v1's panel had no caption, so this one
       *  is drafted rather than carried over. */
      figureCaption:
        "A diffusion model dissolving your handwriting into static and pulling a cleaner digit back out, running its real 26 MB weights on your device. Draw in the left box; the middle panel is the sample as it computes, and the right one is the model’s running guess at the finished digit.",
      cmd: "./sdedit",
      bootLines: [
        "sdedit: partially noise your drawing -> denoise -> your strokes survive",
        "runtime: onnxruntime-web (webgpu, wasm fallback) · fully client-side",
        "weights: mnist_x0.onnx (26 MB, lazy on first stroke)",
      ],
      label: "sdedit",
      statusBooting: "booting",
      statusFetching: "fetching weights…",
      statusReady: "ready",
      statusDraw: "draw to load",
      loadFailed: "model failed to load",
      heading: "SDEdit",
      lede: {
        pre: "Draw one, pick its label, and watch it dissolve into static and re-form. This is ",
        tech: "SDEdit",
        post: ": your drawing is noised partially to pure static and then denoised back, so the coarse structure is never fully destroyed. Your slant and your strokes survive into the result. It is your digit being cleaned up, not a lookalike created from scratch. The whole thing runs on your device, nothing is sent anywhere.",
      },
      canvasAria: "Drawing canvas for digit",
      canvasCaption:
        "your drawing · the pen is deliberately fat, so the strokes survive being downscaled 14x",
      resultFetching: "fetching weights…",
      resultReady: "hit generate",
      resultDraw: "draw to load the model",
      resultCaptionIdle: "the result · your strokes survive the noise",
      resultForward: " · forward process, no model calls",
      resultRunning: " · the model running",
      x0Placeholder: "the model’s guess appears here",
      x0Label: "x̂₀",
      x0CaptionPre: " · its guess at the finished digit",
      x0Held: " · held still, nothing has run yet",
      x0Repredicted: " · re-predicted every step",
      x0CaptionIdle: "x̂₀ · its guess, updated at every step",
      label_: "label",
      labelGuessing: "· guessing…",
      labelAuto: "· auto",
      labelYours: "· yours",
      fitAriaMid: ", fits your drawing ",
      fitAriaPost: "%",
      clear: "clear",
      sampling: "sampling…",
      generate: "generate",
      predicting: "predicting label…",
      generateHint: "draw once to fetch the weights",
      predictingHint: "wait for the label guess to finish",
      hint: "edit any number",
      classify: {
        a: "The model is class-conditional, so it needs a label. That guess comes from the diffusion model itself. It predicts the finished digit under all ten labels from identical seeds, and whichever best matches your strokes wins. No second classifier model required. ",
        bPre: "The ",
        /** ⚠️ The key name is v1's (leaf names were carried over wholesale), the
         *  VALUE is not: the fit tint moved from teal to the manuscript's warm
         *  amber, and this word names the colour a visitor is looking at. If the
         *  tint ever changes hue again, this string changes with it. */
        teal: "amber",
        bPost: " behind each label is that score, so you can see the rankings per categorical. This one was ",
        coinFlip: "practically a coin flip",
        nearThing: "a bit unsure",
        notClose: "a landslide",
        cMid: ". ",
        cPre: "It’s a suggestion, so override it if it’s wrong. Worth trying anyway: draw a 5 and ask for a ",
        four: "8",
        cPost: ". If you get lucky, the model will hallucinate and close the bottom loop.",
      },
    },

    /** Figure 5 — the EBM chess engine. Carried over wholesale from v1's
     *  `chess` namespace (`copy.chess.*` → `copy.systems.chess.*`); every
     *  leaf key name is unchanged, including the nested `search` and
     *  `activations` blocks `lib/chess-protocol.ts` and
     *  `components/ChessActivations.tsx` read. */
    chess: {
      /** New for the manuscript chrome: v1's panel had no caption, so this one
       *  is drafted rather than carried over. */
      figureCaption:
        "A 553 KB energy-based model running its real int8 weights on your device, roughly 1900–2200 Elo against Stockfish’s limited modes. You are white; click a piece, then a square. The tint on the board is the engine’s own ranking of every legal reply, and “what it saw” swaps the game for the model’s internals laid back onto the squares.",
      cmd: "./entropy_chess",
      bootLines: [
        "energy-based model · 469K params · scores positions, never outputs a move",
        "int8 quantized to 553 KB · a smaller download than the Pi’s fp32",
        "onnxruntime-web (wasm) · mcts in a worker · chess.js owns every rule -> ready",
      ],
      label: "entropy-chess",
      statusBooting: "booting",
      statusLoading: "loading 553 KB…",
      statusSearchingPre: "searching · ",
      statusThinking: "thinking…",
      statusGameOver: "game over",
      statusSelfPlay: "self-play",
      statusYourMove: "your move",
      statusWaiting: "…",
      statusEnginePending: "engine pending",
      engineError: "engine error",
      viewSaw: "what it saw",
      heading: "Energy-based modeling over board states",
      lede: {
        a: "A 469K-parameter convolutional energy-based model. It scores resulting positions rather than proposing moves: every legal move is played out, the batch ranked in one forward pass, and the lowest-energy position wins. Trained on about 30M positions from Lichess games where both sides were rated 1800+, then run under AlphaZero-style MCTS on a Raspberry Pi 4 for real-time play, roughly 1900–2200 Elo against Stockfish’s limited modes.",
        b: "Two findings from the on-device work: int8 quantization cost close to nothing (-14 ±59 Elo), and on the Pi’s ARM cores fp32 runs faster than int8, so the deployed engine ships fp32. This page runs the 553 KB int8 file in your browser, by default as the bare network with no search. MCTS runs ~500 sequential forward passes a move, too slow to run live, so here you’re a few hundred Elo below the full engine.",
      },
      activationsLede:
        "The model’s evaluation, laid back onto the board, and computed on your device. This works here and not on the diffusion models for a structural reason: the chess backbone never downsamples below the initial 8x8, so every layer stays cleanly correlated to the squares and can be read as a position. A UNet’s pooled middle layers have no such luxury.",
      checkmatePre: "checkmate · ",
      checkmateWinsBlack: "black wins",
      checkmateWinsWhite: "white wins",
      drawStalemate: "draw · stalemate",
      drawThreefold: "draw · threefold repetition",
      drawInsufficient: "draw · insufficient material",
      drawFiftyMove: "draw · fifty-move rule",
      check: "check",
      illegalMove: "illegal move",
      hintPlayPre: "it would play ",
      mapCaption: "its move map",
      mapCaptionTail: " · where the engine wanted to go, brightest = most wanted",
      selfPlayCaption: "engine vs engine · it plays both sides",
      boardCaptionIdle: "you are white · click a piece, then a square",
      moveMap: "move map",
      mapNoteMcts:
        "Where the search actually spent its simulations, summed onto the square each move lands on.",
      mapNoteArgmin:
        "Its ranking of every legal reply, summed onto the square each one lands on. Free: it comes from the same pass that picked its move.",
      promoteTo: "promote to",
      promoteAria: "promote to",
      top3: "the engine’s top 3",
      makeMove: "make a move",
      loadingEngine: "loading the engine…",
      searchLabel: "search",
      searchNoteSetPre: " Set it with ",
      /** The sims control's own name. It was the `--sims` flag on v1's typed
       *  command line; the manuscript chrome renders it as a labeled number box
       *  called `sims`, and this note points at that box, so the two have to
       *  keep saying the same word. */
      searchNoteSims: "sims",
      searchNoteRange: " above, ",
      searchNoteTo: " to ",
      searchNotePiRuns: ". The Pi runs ",
      searchNoteFloor:
        ". Below 250 simulations the search returns the same move as this the vast majority of the time, which is why sims stops at 250 rather than at 1.",
      newGame: "new game",
      engineVsEngine: "engine vs engine",
      stop: "stop",
      takeBack: "take back",
      thinking: "thinking…",
      hintButton: "hint",
      hintNote: {
        word: "hint",
        post: " asks what it would play from where you are sitting. It is the same call it makes for itself, at whatever the search is set to: the encoder always builds from the side to move, so your move and its move are one computation.",
      },
      searchNote: {
        pre: "At 1 ply it ranks every legal reply and plays the best, in one forward pass. ",
        letItThink: "let it think",
        post: " runs the Pi’s actual search on top of those same numbers, in a worker, so the page keeps moving while it does. It is slower here than it has any right to be: the model is 469K parameters, and scoring one position costs ~6.6ms in WASM no matter how many threads you give it, unlike the PI's 2 second inferencing time for 500 sims.",
      },
      hint: "how long it thinks",
      simsEchoWhenThink: " · applies when you let it think",
      simsEchoNextMove: " · applies to its next move",
      search: {
        ply1Label: "1 ply",
        ply1About: "one forward pass, ~150ms",
        thinkLabel: "let it think",
        thinkAbout: "simulations",
      },
      activations: {
        toMoveWhite: "white to move",
        toMoveBlack: "black to move",
        attribution: "energy attribution",
        layerActivation: "layer activation",
        activationPrefix: "activation · ",
        channelPrefix: " · ch ",
        hottest: "hottest:",
        depthPrefix: "depth · ",
        shallowToDeep:
          "shallow to deep. Early layers are local and edge-like; deep layers concentrate onto the squares that decide the eval, and it all stays board-aligned the whole way.",
        topChannels: "top channels",
        mean: "mean",
        channelCaveat:
          "Explore at your own risk: not every channel is human-interpretable. Plenty light up on nothing nameable. The mean map and the attribution view are the trustworthy ones.",
        saliencyBody:
          "The model outputs a single scalar energy. The gradient of that energy with respect to the board says which squares most move its evaluation: the hanging piece, the key defender, the passed pawn, your blunder...",
        valueHeadPre: "value head: ",
        valueHeadPost: " for white",
        valueHeadLevel: " · about level",
        scenarios: "scenarios",
      },
    },
  },

  /** §3 Experience: one instrument figure, one mission row per role. */
  experience: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "Experience",
    /** Figure 6's caption: the one instrument figure that wraps `MissionRows`. */
    figureCaption:
      "Five roles since 2024, most recent first. The lamp is real state, not decoration: green means active now.",
    rows: [
      {
        when: "2026–2027",
        who: "NASA Ames Research Center",
        what: "SLAAC airspace coordination, a synthetic ATC speech pipeline, and a lunar digital twin next summer.",
        status: "active",
      },
      {
        when: "2024 to present",
        who: "Regenstrief Institute",
        what: "x0-diffusion vessel segmentation and a synthetic angiogram pipeline, with Shantanu Dev and Dr. Andrew Gonzalez.",
        status: "ongoing",
      },
      {
        when: "2025",
        who: "Davinci Wearables",
        what: "An agentic vision pipeline that estimates nutrition from meal photos, under 15% error.",
        status: "complete",
      },
      {
        when: "2024–2025",
        who: "V2X aircraft-maintenance LLM",
        what: "Led the two-stage RAG design; cut hallucinations from about 40% to about 5%.",
        status: "complete",
      },
      {
        when: "2026",
        who: "MRI birdcage coil",
        what: "Led the embedded and PCB team; presented as an oral at IEEE MWSCAS 2026.",
        status: "complete",
      },
    ],
  },

  /** The bibliography: real links, presented as references. */
  references: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "References",
    items: [
      {
        label:
          "Bootstrapping surgeon labeling campaigns with x0-diffusion (under review at JAMIA)",
        href: "",
      },
      {
        label:
          "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), IEEE MWSCAS 2026 (oral)",
        href: "",
      },
      {
        label: "Resume",
        href: "https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview",
      },
      {
        label: "CV",
        href: "https://docs.google.com/document/d/1mzXEobC6bxIV_SqX761EVrDTmsYtrbsA/preview",
      },
      { label: "GitHub", href: "https://github.com/NeelayRanjan" },
      { label: "ORCID", href: "https://orcid.org/0009-0008-9482-0160" },
      { label: "LinkedIn", href: "https://linkedin.com/in/neelayranjan" },
      { label: "Email", href: "mailto:neelay.ranjan@outlook.com" },
      { label: "Supplementary material", href: "/lab" },
    ],
  },

  /** /lab — "Supplementary material": the three demos that left page 1. */
  lab: {
    /** Above the heading, a link back to the main page. */
    backLink: "← back to the paper",
    heading: "Supplementary material",
    intro:
      "Three panels that used to sit on page one. Two run real trained models in your browser; the third is a hand-built illustration of a different sampling method, labeled as such.",
    s1Intro:
      "Figure S1 plays two trained diffusion models denoising the same ten digits: one in continuous pixel space, one in a discrete, absorbing-state token space.",
    s2Intro:
      "Figure S2 compares two vision encoders trained identically except for one thing: whether they predict pixels or representations.",
    s3Intro:
      "Figure S3 is illustrative, not a trained model: hand-built stochastic and deterministic paths across the same 2D target, showing why flow matching needs far fewer steps.",

    /** Figure S1 — the diffusion trajectory viewer. Carried over wholesale
     *  from v1's `diffusion` namespace (`copy.diffusion.*` →
     *  `copy.lab.diffusion.*`); every leaf key name is unchanged. */
    diffusion: {
      cmd: "./ascii-diffusion",
      bootLines: [
        "resolving trajectory source /diffusion_traj.json",
        "decoding 10 digits x 32 frames, 28x28 row-major",
        'warming ascii ramp " .:-=+*#%@" -> ready',
      ],
      labelPixel: "continuous-diffusion",
      labelAscii: "discrete-diffusion",
      statusBooting: "booting",
      statusLoading: "loading",
      /** New for the manuscript chrome (Task 11): v1's panel had no caption. */
      figureCaption:
        "Two trained diffusion models on the same ten digits: a 6.47M-parameter pixel model that denoises from static, and a 1.28M-parameter model that unmasks ascii cells one at a time and never revises one once committed. Only the digit is a live control here; the step count and schedule are properties of the export.",
      /** Sits next to the frozen steps/schedule, which render as plain text
       *  rather than a control. See the ⚠️ comment above BOOT_CMD. */
      frozenNote: "Baked into the export: only the digit is live.",
      notice: {
        tag: "placeholder data",
        body: ". These frames are synthetic, not output from a trained model: a bitmap digit run through a hand-rolled noising schedule, played backwards. Real trajectories drop into ",
        path: "/diffusion_traj.json",
        tail: " unchanged.",
      },
      headingContinuous: "Continuous diffusion",
      headingDiscrete: "Discrete diffusion",
      ledePixel:
        "Noise sharpens into a digit, one step at a time. On the left, the noisy state x_t resolving. On the right, the model’s prediction of the finished digit from that step. This model predicts the clean image directly rather than the noise, which is why you get both at every step. The ascii filter is then applied on top of the generated image.",
      ledeAscii:
        "A different model, and a different kind of corruption: masked cells resolve into ascii characters. It starts with every cell masked and commits them one at a time, most-confident first. Once a cell commits it’s frozen and never re-predicted, so the grid can only ever fill in, never flicker. On the left, what’s committed so far, mask holes and all. On the right, the model’s current guess for every cell, including the ones it hasn’t decided yet.",
      modelLabel: "model",
      asciiUnavailable: "ascii_traj.json not present",
      digitLabel: "digit",
      pause: "pause",
      play: "play",
      replay: "replay",
      errorPrefix: "could not load trajectories: ",
      missingPre: "no trajectory for digit ",
      missingPost: " in this dataset",
      loadingTrajectories: "loading trajectories…",
      xtLabel: "x_t",
      x0Label: "x̂₀",
      xtNoisy: "noisy state",
      xtCommitted: "committed so far",
      x0Predicted: "predicted sample",
      x0Guess: "current guess",
      progressAria: "Reverse diffusion progress",
      hint: "edit the digit",
    },

    /** Figure S2 — MAE vs I-JEPA representation comparison. Carried over
     *  wholesale from v1's `jepa` namespace (`copy.jepa.*` →
     *  `copy.lab.jepa.*`); every leaf key name is unchanged.
     *  `copy.anchors.jepa` (the scroll anchor `JepaPanel.tsx` also reads) is
     *  untouched — it lives in the v1compat block below. */
    jepa: {
      cmd: "./jepa",
      bootLines: [
        "resolving manifest /jepa/manifest.json",
        "decoding 4096 embeddings · two encoders, one variable",
        "loading sprite atlas 3072x3072 -> ready",
      ],
      label: "jepa",
      statusBooting: "booting",
      statusLoading: "loading atlas…",
      heading: "Predicting pixels, or predicting representations",
      lede: {
        a: "Two encoders, same architecture, masking, optimiser, schedule and seed, trained for 65 epochs on the same 100,000 unlabeled STL-10 images. One thing differs. MAE predicts the hidden patches’ pixels; I-JEPA predicts their representations, from an EMA copy of the encoder. A pixel loss has to account for everything in the image, including what can’t be predicted: texture, clutter, the exact colour of the sky. A latent target discards that first and predicts structure instead.",
        b: "Neither saw a label during pretraining. ",
        cPre: "Frozen features, linear probe: MAE ",
        cMid1: ", I-JEPA ",
        cMid2: ". kNN at k=20: ",
        cMid3: " and ",
        cPost:
          ". The kNN gap is the wider one, and kNN is retrieval. MAE’s neighbours often match the background rather than the subject. ",
      },
      scope:
        "This is a claim about representation quality, not about dense pixel-precise output like segmentation, where a UNet’s skip connections carry exactly the detail a latent target throws away.",
      neighborNotePre: "Neighbours are top-",
      neighborNotePost:
        " by cosine similarity in the encoder’s full embedding space, not in any reduction of it.",
      queryLabel: "query",
      queryCaption: "click any thumbnail to make it the query",
      presetsLabel: "presets",
      random: "random",
      maeName: "MAE",
      maeTarget: "(pixel target)",
      jepaName: "I-JEPA",
      jepaTarget: "(latent target)",
      differsMark: "✕",
      samePost: " same class",
      meanPurityPre: "across all ",
      meanPurityMid: " images · mae ",
      meanPurityMid2: " · i-jepa ",
      meanPurityPost: " of neighbours share the query’s class",
      ariaSame: ", same class as the query",
      ariaDiffers: ", different class from the query",
      ariaSetQuery: ". Set as query.",
      ariaQueryPre: "query image, class ",
      errorPrefix: "could not load the representation bundle: ",
      /** New for the manuscript chrome (Task 11): v1's panel had no caption. */
      figureCaption:
        "Two vision encoders' answers to the same query image, drawn straight from the export: no model runs in your browser here. Click any thumbnail, including a result, to make it the new query.",
    },

    /** Figure S3 — sample-space DDPM vs flow matching (illustrative).
     *  Carried over wholesale from v1's `sampleSpace` namespace
     *  (`copy.sampleSpace.*` → `copy.lab.sampleSpace.*`); every leaf key
     *  name is unchanged, including the `targets` block `lib/sample-space.ts`
     *  reads. */
    sampleSpace: {
      cmd: "./sample_space",
      label: "sample-space --compare ddpm,flow",
      bootTop: "building 2d target manifold from a closed form",
      bootBottom: "hand-drawn fields, no weights loaded -> ready",
      statusBooting: "booting",
      statusIllustrative: "illustrative",
      noticeTag: "illustrative",
      noticeBody:
        "Hand-drawn fields on a 2D toy distribution. No model weights are loaded or run here.",
      heading: "Stochastic vs deterministic",
      /** New for the manuscript chrome (Task 11): v1's panel had no caption. */
      figureCaption:
        "A hand-built illustration, not a trained model: the same start and target run through a stochastic 40-step path and a deterministic 9-step path. Switch the target shape or click a panel to launch a new trajectory.",
      /** Label over the target segmented control, replacing the boot
       *  command's `--target` select. */
      targetLabel: "target",
      lede: {
        pre: "The same target, the same starting point, two ways of getting there. Click either panel to launch a trajectory from that point. Both panels run the same start, so the routes are directly comparable. Switch ",
        target: "target",
        post: " above to run the same comparison over a different shape: the spiral makes the step-count gap easiest to see, because the routes are long enough to watch.",
      },
      ddpmLabel: "DDPM",
      ddpmCaptionPre: " · stochastic (SDE), ",
      ddpmCaptionPost: " steps. Jagged; a different route every run.",
      flowLabel: "Flow matching",
      flowCaptionPre: " · deterministic (ODE), ",
      flowCaptionPost: " steps. Smooth; the same route every time.",
      targetCaptionPre: "target · ",
      hint: "try another shape",
      targets: {
        twoMoonsLabel: "two-moons",
        twoMoonsBlurb: "two interleaving half-moons",
        spiralLabel: "spiral",
        spiralBlurb: "two galactic arms winding out from the centre",
        ringLabel: "ring",
        ringBlurb: "a single closed circle",
        gaussiansLabel: "8-gaussians",
        gaussiansBlurb: "eight modes on a circle",
      },
    },
  },

  /** The 404 page, restyled to the "reference not found" conceit (spec §2).
   *  Drafted now; `app/not-found.tsx` still reads the OLD shape from
   *  `notFoundV1` in the v1compat block below until a later task rebuilds
   *  the page against this. */
  notFound: {
    heading: "Reference not found",
    lede:
      "This citation doesn't resolve to a real page. The site only has two: the paper itself, and its supplementary material.",
    links: [
      { label: "Back to the paper", href: "/" },
      { label: "Supplementary material", href: "/lab" },
    ],
  },

  // v1compat:start
  /**
   * v1compat — consumed only by doomed v1 files; deleted with them in a
   * later task (Task 13's sweep). Do not extend.
   *
   * Kept FLAT (not nested under a wrapper object) because the v1-only files
   * that read these reference them at exactly these top-level paths today:
   * `EnergyHero.tsx` (`hero`), `components/ambience/BootScreen.tsx` (`boot`),
   * `components/ambience/CommandLine.tsx` (`commandLine`), and
   * `JepaPanel.tsx`'s one remaining v1 reference, the scroll anchor
   * (`anchors.jepa` — everything else in that file was mechanically moved to
   * `copy.lab.jepa.*` above). `app/layout.tsx` also reads `hero.tagline` for
   * the meta description and needed no edit as a result.
   *
   * `notFoundV1` is the one entry here under a different name than its v1
   * key: the new `notFound` above claims that name for the redesigned 404,
   * so `app/not-found.tsx`'s seven references were repointed from
   * `copy.notFound.*` to `copy.notFoundV1.*` (a path edit, not a JSX change).
   *
   * scripts/check-voice.mjs skips everything between the marker comments
   * that bound this block.
   */
  hero: {
    name: "Neelay Ranjan",
    subtext: "energy-based models · diffusion · flight-path generation",
    tagline:
      "Generative-modeling researcher. Diffusion for safety-critical, data-scarce domains.",
    affiliation: "NASA Ames · Regenstrief Institute",
    caption: {
      a: "Illustrative Langevin simulation. The name is the ground state of an energy landscape carved from its own letterforms: particles descend into the wells and settle. Impulses repel them",
      out: "out",
      b: "; they re-anneal",
      backIn: "back in",
      c: ". Drag to pick up a cluster. Hand-built simulation, not a trained model.",
    },
    realNote: {
      pre: "These are real models I trained myself, ",
      live: "running live in your browser",
      mid: ". The first demo is the exception: a model this size would mean a 50 MB download the moment you arrive, before anything moved, so it replays real frames I exported instead.",
    },
    resumeLabel: "Resume",
    links: {
      resumeUrl:
        "https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview",
      items: [
        { label: "GitHub", href: "https://github.com/NeelayRanjan" },
        { label: "LinkedIn", href: "https://linkedin.com/in/neelayranjan" },
        { label: "Email", href: "mailto:neelay.ranjan@outlook.com" },
      ],
    },
  },

  boot: {
    domain: "neelayranjan.dev",
    sshPrefix: "ssh ",
    connectLine: "connected · latent",
    startCmd: "./latent --serve",
    usernameAria:
      "the user to connect as. Edit it to use your own name in this page's shell prompts.",
  },

  anchors: {
    jepa: "mae vs i-jepa",
  },

  commandLine: {
    reset: "reset",
  },

  notFoundV1: {
    shell: "sh",
    status: "404",
    catError: ": No such file or directory",
    ls: "ls ~",
    sections: [
      { href: "/#diffusion", name: "diffusion" },
      { href: "/#draw", name: "draw" },
      { href: "/#chess", name: "chess" },
      { href: "/#jepa", name: "jepa" },
      { href: "/#sample-space", name: "sample-space" },
    ],
    heading: "Page not found",
    lede:
      "The site is a single page, so there is not much to get lost in beyond a typo. Those five are everything on it. Just imagine some cool demos for me ;)",
  },
  // v1compat:end
} as const;
