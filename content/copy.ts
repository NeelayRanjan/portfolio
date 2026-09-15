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
 * string literal in this file for em dashes, en-dash connectors, and
 * CLAUDE.md's banned-word list. Run it after any edit.
 *
 * WHAT LIVES HERE: headings, ledes, captions, button labels, notices, prose
 * notes, status words, page metadata, the 404, and the demo labels/blurbs.
 *
 * WHAT DELIBERATELY STAYS INLINE (moving it would change behavior, not just copy):
 *   - `--flag` tokens (`--digit`, `--sims`, …). They are logic identifiers, not
 *     free prose: threaded through each panel's own param controls and echo
 *     templates, and interwoven with number interpolation. They must match
 *     their param keys; centralizing them would risk a silent desync and
 *     touch the param plumbing.
 *   - Number-format glue in interpolated readouts (` · `, `p=`, `v=`, `n=`, `/`,
 *     step/timing/percent counters). These are formatting, not sentences.
 *   - aria-labels built from live structural values (`${flag}, ${min} to ${max}`,
 *     the ASCII-grid "… at step N of M" alt text). Static aria-labels ARE here.
 *   - Enum values rendered directly (the `pixel`/`ascii`/`game` button faces are
 *     the state key itself).
 *   - `content/sample-space.md`, already the external source for that write-up.
 *
 * Strings that were HTML entities in JSX (`&rsquo;`, `&quot;`, `&ndash;`) are the
 * actual Unicode characters here (’ " –), so the render is byte-identical.
 *
 * v1's faux-terminal chrome (`components/ambience/*`, `EnergyHero`,
 * `TerminalPanel`, `Section`, `lib/identity.ts`, `lib/booted.ts`) and the
 * flat top-level `hero`/`boot`/`anchors`/`notFoundV1` keys that fed it were
 * deleted in Task 13's sweep, once nothing on either page mounted them any
 * more. The demo components carried into the new IA (`DrawDigit`,
 * `ChessPanel`, `ChessActivations`, `DiffusionVisualizer`, `JepaPanel`,
 * `SampleSpace`, `SampleSpaceWriteup`) were mechanically repointed at their
 * new namespace earlier (`copy.sdedit.*` → `copy.systems.draw.*`,
 * `copy.chess.*` → `copy.systems.chess.*`, `copy.diffusion.*` →
 * `copy.lab.diffusion.*`, `copy.jepa.*` → `copy.lab.jepa.*`,
 * `copy.sampleSpace.*` → `copy.lab.sampleSpace.*`) with every leaf key name
 * kept identical, and `copy.commandLine.reset` (the one string those demos'
 * own reset button still shares) survived the sweep as a flat top-level key.
 * `research`'s three figure sub-keys were renamed to match that task's
 * interface (`wipe`→`figWipe`, `efficiency`→`figEfficiency`,
 * `flight`→`figFlight`) with the three consuming figure components updated
 * to match. `figEfficiency` has since been replaced outright by `figCdf`
 * (2026-09-12): Figure 2 is the paper's Dice CDF now, not a label-budget
 * ladder, so the ladder's `measuredTo*`, `ladder*` and `diceMissing` strings
 * and its seven-model `modelLabels` map are gone with it. Later the same
 * day `figWipe` was replaced by `figLabelEff` (the owner's call): Figure 1
 * is the label-efficiency sweep over `label_efficiency.json` now, and the
 * wipe's component and strings are gone (the wipe ASSETS stay in
 * `public/research/`, unrendered).
 */
export const copy = {
  /** <title>, meta description, and the share-card (OG/Twitter) text. */
  meta: {
    title: "Neelay Ranjan · generative modeling for data-scarce, safety-critical systems",
    siteName: "neelayranjan.dev",
    /** The unfurl description. Concrete, because a share card is the one place a
     *  recruiter or admissions reader sees before deciding whether to click. */
    blurb:
      "I build generative models for domains where labels are scarce and mistakes " +
      "are expensive: vessel segmentation from 16 labeled angiograms, a chess " +
      "engine that fits in 553 KB, a transformer that synthesizes a day of FAA " +
      "flight traffic. The chess engine runs live on this page, in your browser, " +
      "next to a separate live diffusion demo where you draw a digit and watch it denoise.",
    ogImageAlt: "Neelay Ranjan, generative-modeling researcher",
  },

  /** The masthead: paper title, affiliation line, bio-as-abstract, and the
   *  margin rail (stamp, date, identity links). Spec §5. */
  masthead: {
    /** Split (owner call, 2026-09-13): the name and the one-line thesis were
     *  one string at one size; the tagline now renders smaller than the name.
     *  Both live inside the single h1, so the page title reads as before. */
    titleName: "Neelay Ranjan",
    titleTagline:
      "Generative modeling for domains where labels are scarce and mistakes are expensive.",
    affiliation: "NASA Ames Research Center · Regenstrief Institute · Purdue University",
    /** ~80 words, first person. Numbers here are load-bearing: keep them in
     *  sync with `research.prose` and CLAUDE.md's content facts. */
    abstract:
      "I build generative models for domains where labeled data is scarce and a " +
      "wrong prediction costs more than a missed one. My first-author paper on " +
      "label-efficient vessel segmentation from catheter angiograms is in " +
      "preparation. At NASA Ames I work on airspace coordination and a " +
      "synthetic dataset for air traffic control speech; at Regenstrief I trained " +
      "the diffusion model behind that paper. I also built a 553 KB chess engine; " +
      "you can play it further down this page. I'm on a gap semester from my AI " +
      "degree at Purdue, applying to master's programs for fall 2027.",
    /**
     * The author photo, which is a live diffusion sample rather than a file
     * (`components/figures/HeadshotFigure.tsx`). Every claim below is checked:
     * 1.31M params and three source photos come from the bundle's README,
     * "25 steps" is `steps_default` in both v2 metas, and "fresh noise
     * every press" is the module's documented behavior. No latency claim is
     * made here on purpose: the only numbers measured so far are node-wasm
     * ones, and CLAUDE.md's rule is to quote what you measure in a real
     * browser.
     */
    headshot: {
      /** Real alt text, one per class index, describing the actual photo. Used
       *  by the at-rest <img>; the face buttons get the aria-labels below. */
      photoAlts: [
        "Neelay Ranjan on a city street at night, headphones around his neck.",
        "Neelay Ranjan outdoors, trees behind him.",
        "Neelay Ranjan in front of the NASA seal.",
      ],
      /** Fallback if a retrained export ships more classes than there are alts. */
      photoAltGeneric: "Neelay Ranjan.",
      /**
       * ⚠️ THE FIRST SENTENCE SWAPS WITH THE STATE, and that is a correctness
       * fix, not a flourish. At rest the box really is the loaded file, so
       * "this photo is sampled, not loaded" was false for every visitor who
       * never pressed anything. The body is shared, so the two states can't
       * drift apart.
       */
      captionLeadRest: "Right now that's the photo file itself. ",
      captionLeadSampled: "This photo is sampled, not loaded. ",
      captionBody:
        "I overfit a 1.3M-parameter diffusion model on three photos of me " +
        "until it memorized them, and pressing a face runs it here in your " +
        "browser: 25 steps from fresh noise back to that photo. New noise " +
        "every press, so the route changes and the face doesn't.",
      /** The v2-module variant (rendered only when the vendored sampler
       *  supports transitions): presses after the first morph the on-screen
       *  picture instead of restarting from noise, so the body has to say
       *  that or the old "new noise every press" line goes false. */
      captionBodyMorph:
        "I overfit a 1.3M-parameter diffusion model on three photos of me " +
        "until it memorized them. A press runs it here in your browser: the " +
        "first sample climbs out of fresh noise, and after that pressing a " +
        "different face partially re-noises the picture on screen and pulls " +
        "the new photo out of it. resample starts over from noise.",
      /** The canvas's accessible name: this, " 1 of 3", then the photo's own
       *  alt text. The alt has to ride along or a screen-reader user loses the
       *  description of what the author looks like the moment the canvas
       *  replaces the <img>, permanently. */
      canvasAria: "Live diffusion sample of photo",
      /** Each face button's accessible name: pre + i+1 + mid + count + post. */
      faceAriaPre: "Sample photo ",
      faceAriaMid: " of ",
      faceAriaPost: " with the diffusion model",
      resample: "resample",
      resampleAria: "Sample the current photo again from new noise",
      /** Readout line states. The step counter's "7/25" glue stays inline. */
      statusRest: "press a face to sample it",
      statusLoading: "fetching the weights",
      statusSampling: "sampling",
      statusDone: "sampled from noise",
      /** v2 transition mode only: a cross-class press re-noised the on-screen
       *  picture partway and denoised it into the new photo. Distinct from
       *  statusDone because "sampled from noise" would be false for that run. */
      statusMorphed: "morphed from the last sample",
      /** The model files are absent at runtime although the photos are served:
       *  say so rather than leaving a dead button. */
      statusAbsent: "the model isn't deployed, so this is the photo itself",
      statusFailed: "the model didn't load",
    },
    /** A claim, not decor: it tracks the paper's real status (owner,
     *  2026-09-14: in preparation, NOT yet under review; it said UNDER REVIEW
     *  until then, which was wrong). The
     *  stamp is also the door to /lab (owner call, 2026-09-12): the sub-line
     *  below it carries the affordance and links the supplementary page. */
    stamp: "IN PREPARATION",
    stampNote: "pending additional materials",
    date: "September 2026",
    links: [
      {
        label: "Resume",
        href: "https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview",
      },
      // CV hidden (owner call, 2026-09-14: not public-facing yet). Its /preview
      // URL is in CLAUDE.md's links; restore it here and in references.items.
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
        label: "Dice at 16 labeled angiograms, from my paper in preparation",
        hot: true,
      },
      { value: "25/25", label: "paired runs ahead of every baseline" },
      { value: "~75%", label: "faster surgeon corrections, measured" },
      { value: "553 KB", label: "chess engine, roughly 1900–2200 Elo, in your browser" },
    ],
  },

  /** §1 Research: the first-author paper, the two computed figures, the MWSCAS
   *  credit, and the NASA arc + flight-day figure. */
  research: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "Research",
    /** Two paragraphs. Every number matches CLAUDE.md's content facts and
     *  `masthead.abstract` exactly. */
    prose: [
      "My first-author paper, “Bootstrapping surgeon labeling campaigns with " +
        "x0-diffusion: label-efficient vessel segmentation of catheter-based " +
        "angiograms,” is in preparation (with Shantanu Dev and Andrew " +
        "Gonzalez at Regenstrief Institute). I trained a diffusion model to predict " +
        "the clean segmentation mask directly instead of predicting the noise, so " +
        "it reaches 0.882 Dice from 16 labels, ahead of five baselines in 25 " +
        "of 25 paired runs.",
      "The same model made a surgeon ~75% faster at correcting its output, " +
        "measured rather than estimated. The claim is label " +
        "efficiency, not peak accuracy: a few baselines eventually reach comparable " +
        "Dice too, once they see far more than 16 labels.",
    ],
    /** Rail note beside the prose. */
    scopeNote:
      "The claim lives at 16 labels. Hand the baselines 80 and some of them catch up.",
    /**
     * Figure 1 — the label-efficiency sweep (2026-09-12, replacing the wipe;
     * the owner's call, built on Figure 2's slider-and-readout pattern). All
     * numbers live in `public/research/label_efficiency.json` and the
     * component reads every one from the file; the caption quotes only the
     * standing content facts (0.882 at 16) plus values the figure itself
     * displays. The lead/trail sentence under the readouts is COMPUTED per
     * budget: x0 leads at 16 and trails from 32 on, and that flip is the
     * finding, so the trail wording below is as load-bearing as the lead.
     * "Same architecture on the noise objective" for ε-diffusion comes from
     * the retired ladder figure's caption, which the owner approved.
     */
    figLabelEff: {
      caption:
        "The graph behind the headline number. Each point is one model’s mean test Dice at one label budget, pooled over every seed and fold, 2,500 predictions per point; whiskers mark one standard deviation at the budget the slider selects. At 16 labeled angiograms x0-diffusion sits at 0.882 and the nearest baseline is SAM at 0.835, which is zero-shot and never trains on labels, so its line is flat. Slide right and the trained baselines climb: DeepLabV3 catches up at 32 labels, and by 80 it and ResNet-UNet edge ahead. That crossover is the claim, label efficiency rather than peak accuracy. One baseline is left off the axes: ε-diffusion, the same architecture trained to predict the noise instead of the clean mask, sits near 0.23 Dice at every budget, and keeping its line squashed the range where the differences live. Under the chart, one real test angiogram with each model’s mask at the selected budget: at 16 labels ResNet-UNet returns noise on it and by 80 it has caught up, SAM’s single zero-shot mask never changes, and x0-diffusion barely moves. Each panel prints the Dice computed from the exact pixels it paints.",
      /** Screen-reader name for the chart itself. The caption is the long form. */
      chartAria:
        "Mean test Dice against label budget for x0-diffusion and five baselines",
      xAxisLabel: "labeled training angiograms",
      yAxisLabel: "mean test Dice",
      /** Mono note under the chart; the budgets and train size are read from
       *  the file and spliced between these pieces. */
      logNotePre: "x axis is log-spaced. budgets ",
      logNoteAnd: " and ",
      logNotePost: " labels of the ",
      logNoteEnd: " training images.",
      /** The readout row above the slider, wrapped around the cursor value. */
      meanPre: "mean dice at ",
      meanPost: " labels, ±1 std dev",
      /** The computed lead/trail sentence. */
      gapLeadPre: "x0-diffusion leads the closest baseline, ",
      gapTrailPre: "x0-diffusion trails the best baseline, ",
      gapMid: ", by ",
      gapPost: " dice.",
      /** Slider: the panel's top-right readout, its label, its aria text. */
      readoutLabel: "labels",
      sliderLabel: "labels",
      sliderAriaPre: "Label budget for the whiskers, readouts and mask panels: ",
      sliderAriaPost: " labeled angiograms",
      /** The strip: the bare angiogram column, then one column per model. */
      angioLabel: "angiogram",
      angioAltPre: "Pelvic-iliac angiogram from the segmentation benchmark, test image ",
      imagePre: "test image ",
      diceLabel: "Dice",
      maskAriaPre: "Predicted vessel mask from ",
      maskAriaMid: " trained on ",
      maskAriaPost: " labels, Dice ",
      /** Mono note under the strip, wrapped around the live budget. */
      stripNotePre: "masks: the seed-1, fold-1 run at ",
      stripNotePost: " labels. dice computed from the shown pixels.",
      modelLabels: {
        x0diffusion: "x0-diffusion",
        sam: "SAM (zero-shot)",
        vit_base_patch16: "ViT-B/16",
        hybridresnetvit: "hybrid ResNet+ViT",
        resnet: "ResNet-UNet",
        deeplabv3: "DeepLabV3",
        ediffusion: "ε-diffusion",
      },
    },
    /**
     * Figure 2 — the paper's Dice CDF (`external_materials/paper1/img/fig_dice_cdf`),
     * made pannable (2026-09-12, replacing the label-budget ladder). The
     * caption carries THREE things the figure can't say on its own: that the
     * y axis is clipped on purpose, that the cursor is a threshold rather than
     * the shown image's score, and that the cached masks and the curve are two
     * different exports. Numbers here are interpolated from `cdf.json` where
     * they can be; the three shares below 0.5 are quoted in prose because the
     * sentence reads as a finding, not a readout.
     */
    figCdf: {
      caption:
        "The distribution behind the mean. Every per-image test Dice at the 16-label budget, pooled over all seeds and folds, so each line is 2,500 predictions: read up from a Dice value and you get the share of predictions that scored below it. The y axis is clipped at 30% because the failure tail is the part worth seeing. At the thin reference line, 0.5 Dice, x0-diffusion (solid green) has put 0.32% of its predictions, SAM (dashed red) 5.4%, and ResNet-UNet (dotted amber) 13.5%. x0-diffusion’s mean is a few points ahead of the baselines; what it almost never does is fail outright. Move the slider to pan the cursor along the Dice axis and the readouts give each model’s exact share below it. Under the chart, one real test image per stop with all three models’ masks over it, drawn from a re-run of the paper’s seed-1 runs that covers all 100 test images, so each stop lands on an image whose SAM Dice sits near the cursor, real failures included. Every panel prints the Dice computed from the pixels it paints, against the benchmark’s ground truth for that image. The trained models reproduce their recorded runs from those pixels, ResNet-UNet to the fourth decimal; SAM’s inference is stochastic, so its masks here are a fresh draw that can score off its recorded row, and the number shown is the one the shown pixels earn.",
      /** Screen-reader name for the chart itself. The caption is the long form. */
      chartAria:
        "Cumulative share of per-image test Dice at 16 labels, for x0-diffusion, SAM and ResNet-UNet",
      xAxisLabel: "per-image test Dice",
      yAxisLabel: "cumulative share of predictions",
      /** Says out loud what the 30% ceiling already does. */
      clipNote: "y axis clipped at 30%. the tail is the whole finding.",
      /** The readout row above the slider, wrapped around the cursor value. */
      sharePre: "share below ",
      sharePost: " dice",
      /** Slider: the panel's top-right readout, its label, its aria text. */
      readoutLabel: "dice",
      sliderLabel: "dice",
      sliderAriaPre: "Dice threshold for the cursor and the image panels: ",
      sliderAriaPost: ", nine stops from 0.10 to 0.90",
      /** The strip: the bare angiogram column, then one column per model. */
      angioLabel: "angiogram",
      angioAltPre: "Pelvic-iliac angiogram from the segmentation benchmark, test image ",
      imagePre: "test image ",
      diceLabel: "Dice",
      maskAriaPre: "Predicted vessel mask from ",
      maskAriaMid: " on test image ",
      maskAriaPost: ", Dice ",
      /** The two data scopes, said once in mono under the panels. */
      scopeNotePre: "curve: every test prediction at ",
      scopeNoteMid: " labels, ",
      scopeNotePost:
        " rows per model. panels: the seed-1, fold-1 re-run of that same budget, dice computed from the shown pixels.",
      modelLabels: {
        x0diffusion: "x0-diffusion",
        sam: "SAM (zero-shot)",
        resnet: "ResNet-UNet",
      },
    },
    /** MWSCAS credit line: prose sentence plus the formal citation, kept
     *  separate so the citation can stay a literal, checkable string. */
    mwscas: {
      prose:
        "I also led the PCB design team for a helical antenna for electromagnetic field stimulation in Alzheimer’s disease therapy; we presented it as an oral at IEEE MWSCAS 2026 in Cincinnati on August 11.",
      citation:
        "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), “Helical Antenna for Electromagnetic Field Stimulation in Alzheimer’s Disease Therapy,” IEEE MWSCAS 2026 (oral).",
    },
    /** NASA block: the three-engagement arc, presented as one, plus the
     *  SLAAC poster's real numbers. */
    nasaProse:
      "My NASA Ames work is two engagements: SLAAC, space-launch and airspace coordination, with Dr. Kapil Sheth in summer 2026, and a synthetic text-to-speech-to-database pipeline for air traffic control speech with Stephen Clarke this fall. The SLAAC poster's numbers: 98–99% clear the 25 nm buffer, +1.1% median added distance at infinite lookahead, and within 1.2% of geometric optimum.",
    /** Figure 3 — the flight-plan synthesis video. Carried over unchanged,
     *  renamed from `flight`. */
    figFlight: {
      caption:
        "A transformer I trained from scratch on its own flight-plan vocabulary, writing a full day of FAA flight plans: roughly 44,000 flights, matched to the density of a real day of traffic. Its output feeds NASA capacity and safety studies of US airspace failure modes. Every path in this clip is synthetic; none of it is recorded ATC data.",
      videoAria:
        "A day of FAA flight plans synthesized by a transformer I trained, looping video",
    },
    /** Short margin notes (rail `Note`s) beside the research figures: data
     *  provenance and a claims caveat, distinct from `scopeNote` above. */
    noteBars: [
      {
        tag: "data",
        body: "Figure 1 pools the paper's own metrics export: 2,500 per-image predictions behind every point. The angiograms in Figures 1 and 2 come from the public pelvic-iliac benchmark, so publishing them is clean.",
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

    /** Figure 5 (was 4 until the 2026-09-13 order swap) — live SDEdit draw-a-digit. Carried over wholesale from v1's
     *  `sdedit` namespace (`copy.sdedit.*` → `copy.systems.draw.*`); every
     *  leaf key name is unchanged. */
    draw: {
      /** New for the manuscript chrome: v1's panel had no caption, so this one
       *  is drafted rather than carried over. */
      figureCaption:
        "A diffusion model dissolving your handwriting into static and pulling a cleaner digit back out, running its real 26MB weights on your device. Draw in the first box; the second shows the sample as it computes, and the third is the model’s running guess at the finished digit.",
      statusFetching: "fetching weights…",
      statusReady: "ready",
      statusDraw: "draw to load",
      loadFailed: "model failed to load",
      heading: "SDEdit",
      lede: {
        pre: "Draw a digit, pick its label, and watch it dissolve into static and re-form. This is ",
        tech: "SDEdit",
        post: ": your drawing is noised partway to static and then denoised back, so its coarse structure is never fully destroyed. Your slant and your strokes survive into the result: it's your digit cleaned up, not a lookalike drawn from scratch. Everything runs on your device; nothing is sent anywhere.",
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
        bPost: " behind each label is that score, so you can see the whole ranking. This one was ",
        coinFlip: "practically a coin flip",
        nearThing: "a bit unsure",
        notClose: "a landslide",
        cMid: ". ",
        cPre: "It’s a suggestion, so override it if it’s wrong. Worth trying anyway: draw a 5 and ask for an ",
        four: "8",
        cPost: ". If you get lucky, the model will hallucinate and close the bottom loop.",
      },
    },

    /** Figure 4 (was 5 until the 2026-09-13 order swap) — the EBM chess engine. Carried over wholesale from v1's
     *  `chess` namespace (`copy.chess.*` → `copy.systems.chess.*`); every
     *  leaf key name is unchanged, including the nested `search` and
     *  `activations` blocks `lib/chess-protocol.ts` and
     *  `components/ChessActivations.tsx` read. */
    chess: {
      /** New for the manuscript chrome: v1's panel had no caption, so this one
       *  is drafted rather than carried over. */
      figureCaption:
        "A 553 KB energy-based model running its real int8 weights on your device, roughly 1900–2200 Elo against Stockfish’s limited modes. You are white; click a piece, then a square. The tint on the board is the engine’s own ranking of every legal reply, and “what it saw” swaps the game for the model’s internals laid back onto the squares.",
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
        a: "A 469K-parameter convolutional energy-based model. It scores resulting positions rather than proposing moves: every legal move is played out, the batch ranked in one forward pass, and the lowest-energy position wins. Trained on about 30M positions from Lichess games where both sides were rated 1800+, then run under AlphaZero-style MCTS on a Raspberry Pi Zero 2 W for real-time play, roughly 1900–2200 Elo against Stockfish’s limited modes.",
        b: "Two findings from the on-device work: int8 quantization cost close to nothing (-14 ±59 Elo), and on the Pi’s ARM cores fp32 runs faster than int8, so the deployed engine ships fp32. This page runs the 553 KB int8 file in your browser, by default as the bare network with no search. MCTS runs ~500 sequential forward passes a move, too slow to be the default here, so out of the box you’re a few hundred Elo below the full engine.",
      },
      activationsLede:
        "The model’s evaluation, laid back onto the board: eight curated positions, precomputed from the real weights. This works here and not on the diffusion models for a structural reason: the chess backbone never downsamples below the initial 8x8, so every layer stays cleanly correlated to the squares and can be read as a position. A UNet’s pooled middle layers have no such luxury.",
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
        ". Below 250 simulations the search returns this same move almost every time (23 of 24 positions measured), so the sims box refuses to go below 250.",
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
        post: " runs the Pi’s actual search on top of those same numbers, in a worker, so the page keeps moving while it does. It is slower here than it has any right to be: the model is 469K parameters, and scoring one position costs ~6.6ms in WASM no matter how many threads you give it. The Pi gets through its 500 sims in about 2 seconds.",
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
      "Five roles since 2024 and my degree, current work first. The lamp is real state, not decoration: green means active now, and amber means paused until January.",
    rows: [
      {
        when: "2026",
        who: "NASA Ames Research Center",
        what: "SLAAC airspace coordination and a synthetic ATC speech pipeline.",
        status: "active",
      },
      {
        when: "2024 to present",
        who: "Regenstrief Institute",
        what: "x0-diffusion vessel segmentation and a synthetic angiogram pipeline, with Shantanu Dev and Dr. Andrew Gonzalez.",
        status: "active",
      },
      {
        /** Facts from the live resume (2026-09-14). The status word is the
         *  abstract's own "gap semester" (owner's wording), on the amber lamp:
         *  enrolled but not in classes this fall, so "active" would be false. */
        when: "expected May 2027",
        who: "Purdue University",
        what: "B.S. in Artificial Intelligence, Intelligent Control & Systems concentration, math minor. John Martinson Honors College, Dean’s List, 3.68 GPA.",
        status: "gap semester",
      },
      {
        when: "2026",
        who: "Alzheimer’s stimulation antenna",
        what: "Led the embedded and PCB team on a helical antenna for electromagnetic field stimulation; presented as an oral at IEEE MWSCAS 2026.",
        status: "complete",
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
    ],
  },

  /** The bibliography: real links, presented as references. */
  references: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "References",
    items: [
      {
        label:
          "Bootstrapping surgeon labeling campaigns with x0-diffusion (in preparation)",
        href: "",
      },
      {
        label:
          "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), “Helical Antenna for Electromagnetic Field Stimulation in Alzheimer’s Disease Therapy,” IEEE MWSCAS 2026 (oral)",
        href: "",
      },
      {
        label: "Resume",
        href: "https://docs.google.com/document/d/1Du0NEDaov2tRzY-tWbuN0wrO6xk6SFDi/preview",
      },
      // CV hidden with the masthead's (see masthead.links).
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
      "Three panels that used to sit on page one. Two replay real trained models’ output; the third is a hand-built illustration of a different sampling method, labeled as such.",
    s1Intro:
      "Figure S1 plays two trained diffusion models denoising the same ten digits: one in continuous pixel space, one in a discrete, absorbing-state token space.",
    s2Intro:
      "Figure S2 compares two vision encoders trained identically except for one thing: whether they predict pixels or representations.",
    s3Intro:
      "Figure S3 is illustrative, not a trained model: hand-built stochastic and deterministic paths to the same 2D target. The stochastic walk takes 40 steps; the deterministic route takes 9.",

    /** Figure S1 — the diffusion trajectory viewer. Carried over wholesale
     *  from v1's `diffusion` namespace (`copy.diffusion.*` →
     *  `copy.lab.diffusion.*`); every leaf key name is unchanged. */
    diffusion: {
      statusLoading: "loading",
      /** New for the manuscript chrome (Task 11): v1's panel had no caption. */
      figureCaption:
        "Two trained diffusion models on the same ten digits: a 6.47M-parameter pixel model that denoises from static, and a 1.28M-parameter model that unmasks ascii cells one at a time and never revises one once committed. Only the digit is a live control here; the step count and schedule are properties of the export.",
      /** Sits next to the frozen steps/schedule, which render as plain text
       *  rather than a control. See the ⚠️ comment above BOOT_CMD. */
      frozenNote: "Baked into the export: only the digit is live.",
      notice: {
        tag: "placeholder data",
        body: "These frames are synthetic, not output from a trained model: a bitmap digit run through a hand-rolled noising schedule, played backwards. Real trajectories drop into ",
        path: "/diffusion_traj.json",
        tail: " unchanged.",
      },
      headingContinuous: "Continuous diffusion",
      headingDiscrete: "Discrete diffusion",
      ledePixel:
        "Noise sharpens into a digit, one step at a time. On the left, the noisy state x_t resolving. On the right, the model’s prediction of the finished digit from that step. This model predicts the clean image directly rather than the noise, which is why you get both at every step. The ascii look is a filter applied on top; the model itself works in pixels.",
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
     *  `copy.lab.jepa.*`); every leaf key name is unchanged. */
    jepa: {
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
        "Two vision encoders’ answers to the same query image, drawn straight from the export: no model runs in your browser here. Click any thumbnail, including a result, to make it the new query.",
    },

    /** Figure S3 — sample-space DDPM vs flow matching (illustrative).
     *  Carried over wholesale from v1's `sampleSpace` namespace
     *  (`copy.sampleSpace.*` → `copy.lab.sampleSpace.*`); every leaf key
     *  name is unchanged, including the `targets` block `lib/sample-space.ts`
     *  reads. */
    sampleSpace: {
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
        pre: "The same target, the same starting point, two ways of getting there. Click either panel to launch a trajectory; it runs in both panels from the same start, so the routes are directly comparable. Switch ",
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

  /** Stargaze mode + the night-sky credit (components/manuscript/
   *  StargazeToggle.tsx, SkyCredit.tsx). `enter` is the owner's own wording.
   *  ⚠️ `credit` states the speed-up; it must match SKY_SPEEDUP in
   *  lib/sky-math.ts (180). `creditStill` is the reduced-motion variant: that
   *  sky never turns, so the "180 times faster" sentence would be false there. */
  stargaze: {
    enter: "stargaze for a bit?",
    exit: "back to the page",
    /** Pointer: a drawn name's box and the symbol are both hit targets.
     *  Touch: phones draw no names below 880px, so the hint promises only
     *  the symbol (final review F1). */
    hintPointer: "drag to look around, click a symbol or name to read about it",
    hintTouch: "drag to look around, tap a symbol to read about it",
    /** The screen-reader name of the stargaze keyboard list (NightSky, F2):
     *  one button per selectable currently on screen. */
    listLabel: "On screen now",
    credit:
      "The sky over NASA Ames from the moment you arrived, turning 180 times faster than the real one. Stars from the Extended Hipparcos Compilation; lines, Latin names, the Milky Way and the Messier objects from d3-celestial; English names and constellation origins from Wikipedia; spacecraft positions from JPL Horizons; meteor showers from the IMO; the ISS from CelesTrak. Every card cites its sources.",
    creditStill:
      "The sky over NASA Ames at the moment you arrived. Stars from the Extended Hipparcos Compilation; lines, Latin names, the Milky Way and the Messier objects from d3-celestial; English names and constellation origins from Wikipedia; spacecraft positions from JPL Horizons; meteor showers from the IMO; the ISS from CelesTrak. Every card cites its sources.",
    /** The stargaze card (components/manuscript/SkyCard.tsx). Numbers and
     *  dates between these fragments come from the data files; the facts
     *  themselves live in content/sky-facts.ts. */
    card: {
      close: "close",
      closeAria: "Close this card",
      /** Shown while the card's subject is off the screen (F3); the card
       *  stays open, and the line clears if the subject comes back. */
      outOfView: "Out of view for now.",
      sources: "Sources",
      /** "Retrieved September 15, 2026, from https://…" (APA). */
      retrieved: "Retrieved",
      from: "from",
      titleMoon: "Moon",
      titleIss: "International Space Station",
      titleMilkyWay: "Milky Way",
      /** "Active Jul 17 to Aug 24, peak Aug 13. Zenithal hourly rate (ZHR) at peak: 100." */
      showerActive: "Active ",
      showerTo: " to ",
      showerPeak: ", peak ",
      showerZhr: ". Zenithal hourly rate (ZHR) at peak: ",
      showerParent: "Parent body: ",
      showerDrift:
        "The burst marks the radiant at the peak. The real radiant creeps a little each night, and this chart leaves that out.",
      showerTable: "Dates, radiant and rate from the IMO 2026 Meteor Shower Calendar, Table 5.",
      /** "Position on September 15, 2026: 171.8 au from Earth." */
      spacecraftPre: "Position on ",
      spacecraftMid: ": ",
      spacecraftPost: " au from Earth.",
      issAbove: "Above the horizon over NASA Ames at this chart's time.",
      issBelow: "Below the horizon over NASA Ames at this chart's time.",
      /** "Altitude 419 km, moving at 7.66 km/s." */
      issAltitude: "Altitude ",
      issSpeed: " km, moving at ",
      issSpeedPost: " km/s.",
      /** "Orbit data (TLE) from September 15, 2026, 04:12 UTC." */
      issEpoch: "Orbit data (TLE) from ",
      issEpochPost: " UTC.",
      issClock: "This sky runs 180 times faster than the real one, so the station crosses it in seconds.",
      issClockStill: "This sky holds still at the moment you arrived, so the station does too.",
    },
  },

  /** The 404 page, restyled to the "reference not found" conceit (spec §2).
   *  `app/not-found.tsx` reads this shape directly. */
  notFound: {
    heading: "Reference not found",
    lede:
      "This citation doesn't resolve to a real page. The site only has two: the paper itself, and its supplementary material.",
    /** The struck-through entry standing in for whatever was requested.
     *  Generic on purpose: the site never echoes a visitor-supplied path
     *  back into the page. See app/not-found.tsx. */
    brokenLabel: "The page you asked for",
    links: [
      { label: "Back to the paper", href: "/" },
      { label: "Supplementary material", href: "/lab" },
    ],
  },

  /** Shared by both live-system panels' "reset" affordance
   *  (`DrawDigit.tsx`, `ChessPanel.tsx`) — the one slot that swaps between a
   *  hint and a reset button once a param's been touched. Not nested under
   *  `systems` because it's the same word for both, not a per-demo string. */
  commandLine: {
    reset: "reset",
  },
} as const;
