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
/** One address, shared by the masthead, References and the colophon. */
const EMAIL = "neelay.ranjan@outlook.com";

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
      "flight traffic. On the page you can play the chess engine, or watch an " +
      "autopilot fly a lander on Titan by planning inside a learned model of " +
      "the flight.",
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
      /** One sentence, true before and after a press (2026-09-30: the old
       *  state-swapping lead, "Right now that's the photo file itself" /
       *  "This photo is sampled, not loaded", was cut as self-vouching). It
       *  describes what a press does, so it never claims the at-rest file
       *  is a sample. */
      captionBody:
        "Press a face and a 1.3M-parameter diffusion model, overfit on three " +
        "photos of me, samples it in your browser in 25 steps from fresh noise.",
      /** The v2-module variant (rendered only when the vendored sampler
       *  supports transitions): presses after the first morph the on-screen
       *  picture instead of restarting from noise, so the body has to say
       *  that or the old "new noise every press" line goes false. */
      captionBodyMorph:
        "Press a face and a 1.3M-parameter diffusion model, overfit on three " +
        "photos of me, samples it in your browser in 25 steps from fresh noise. " +
        "After that, pressing a different face re-noises the picture on screen " +
        "partway and pulls the new photo out of it; resample starts over from noise.",
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
     *  until then, which was wrong). Since the discoverability round
     *  (2026-09-16, spec §6) the stamp is no longer a link; the door to /lab
     *  is the bordered box below it. */
    stamp: "IN PREPARATION",
    /** The /lab box under the stamp. Two lines:
     *    "Supplementary material →"   (the arrow is the box's decoration)
     *    "diffusion trajectories · MAE vs I-JEPA · a day of synthesized flight plans · SDEdit on MNIST"
     *  The contents line is a teaser, deliberately NOT composed from the /lab
     *  section headings: those are written for their own context
     *  ("Predicting pixels, or predicting representations") and run four
     *  items long in a narrow rail (controller ruling, 2026-09-16). If a /lab
     *  section is added, removed or renamed, update this line with it. */
    supplementLabel: "Supplementary material",
    supplementContents:
      "diffusion trajectories · MAE vs I-JEPA · a day of synthesized flight plans · SDEdit on MNIST",
    date: "September 2026",
    /** The in-page contents line under the abstract (2026-10-26 audit: the
     *  page runs ~5,800px on a desktop and ~12,600px on a phone, and
     *  Experience sat after four figures with no way to jump to it). The
     *  hrefs are the sections' own heading ids; the labels are short forms
     *  of their headings. If a page-1 section is added, renamed or removed,
     *  update this list with it. */
    contentsLabel: "Contents",
    contents: [
      { label: "Research", href: "#research" },
      { label: "NASA Ames", href: "#nasa" },
      { label: "Live systems", href: "#systems" },
      { label: "Experience", href: "#experience" },
      { label: "References", href: "#references" },
    ],
    /** The identity links, on the line under the affiliation since the
     *  2026-10-26 audit (they sat at the foot of the rail, ~750px down on a
     *  desktop and over a screen down on a phone; opening the resume is the
     *  first visitor action that matters). */
    links: [
      {
        // Served by this site (owner call, 2026-09-22), not Drive: the resume
        // now lives in a PRIVATE GitHub repo, which can't serve a public
        // link, and the Drive copy went stale. scripts/pull-resume.mjs copies
        // the PDF in; the path is stable, so it survives every update.
        label: "Resume",
        href: "/resume.pdf",
      },
      // CV hidden (owner call, 2026-09-14: not public-facing yet). Its /preview
      // URL is in CLAUDE.md's links; restore it here and in references.items.
      { label: "GitHub", href: "https://github.com/NeelayRanjan" },
      { label: "ORCID", href: "https://orcid.org/0009-0008-9482-0160" },
      { label: "Email", href: `mailto:${EMAIL}` },
    ],
  },

  /** Table 1: the full-span stat band under the masthead. */
  table1: {
    caption: "Headline numbers from the paper and the chess engine.",
    cells: [
      {
        value: "0.882",
        label: "Dice at 16 labeled angiograms, from my paper in preparation",
        hot: true,
      },
      { value: "25/25", label: "paired runs ahead of every baseline at 16 labels" },
      { value: "~75%", label: "faster surgeon corrections" },
      /** The Elo is the engine WITH search on the Pi (owner-confirmed); the
       *  page's own engine runs without it, "a few hundred Elo weaker", so
       *  the cell says which (2026-10-26 audit). */
      { value: "553 KB", label: "chess engine, roughly 1900-2200 Elo with search on a Raspberry Pi" },
    ],
  },

  /** §1 Research: the first-author paper, the two computed figures, the MWSCAS
   *  credit, and the NASA box (SLAAC first, the rerouter as Figure 3). */
  research: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "Research",
    /** Two paragraphs. Every number matches CLAUDE.md's content facts and
     *  `masthead.abstract` exactly. */
    prose: [
      "In my first-author paper, in preparation with Shantanu Dev and Andrew " +
        "Gonzalez at Regenstrief Institute, I trained a diffusion model to " +
        "predict the clean segmentation mask directly instead of the noise. It " +
        "reaches 0.882 Dice from 16 labels, ahead of five baselines in 25 of 25 " +
        "paired runs. Trained the usual way, predicting noise, the same " +
        "architecture stays near 0.23 Dice at every budget.",
      "The same model made a surgeon ~75% faster at correcting its output.",
    ],
    /** Margin notes (2026-09-30): the reference detail that used to sit in
     *  the prose column, moved to the rail so the main column reads fast.
     *  `paper` and `study` sit beside the prose, `scope` under DATA beside
     *  Figure 1. In the NASA box (2026-09-30, SLAAC round), `slaac` sits in
     *  the rail beside the NASA paragraphs, and `data` and `disclaimer` sit
     *  under Figure 3 as a footnote band (two columns from 880px): stacked
     *  in the rail they ran 725px against ~290px of prose. See the comment
     *  in app/page.tsx's NASA box. Main column keeps the claims, the notes
     *  keep the provenance. */
    notes: {
      paper: {
        tag: "paper",
        body: "Ranjan, Dev, Gonzalez. “Bootstrapping surgeon labeling campaigns with x0-diffusion: label-efficient vessel segmentation of catheter-based angiograms.” In preparation.",
      },
      study: {
        tag: "study",
        body: "Measured with one vascular surgeon, my coauthor Dr. Andrew Gonzalez.",
      },
      scope: {
        tag: "scope",
        body: "The claim is label efficiency, not peak accuracy: given far more than 16 labels, some baselines match it.",
      },
      /** The poster's result in words (owner, 2026-10-01: "remove the
       *  numbers, and just keep the high-level"; no numerals anywhere in the
       *  NASA box). Each clause is one of the poster's columns, cited as the
       *  poster's (task-13-facts.md): 98% / 99% of final reroutes held the
       *  25 nm buffer ("nearly every"); +23 nm (3.4%) / +10 nm (1.1%) median
       *  added ("small detours"); within 2.3% / 1.2% of the geometric optimum
       *  ("close to"); median waypoints added 0 / -1 ("added no waypoints, and
       *  under infinite lookahead removed one"). "Kept every leg the full
       *  buffer distance from the airspace" is the same
       *  measure, in the same words, as the DIFFERENCES note's. */
      slaac: {
        tag: "slaac",
        body: "From the SLAAC poster: under both lookahead policies, nearly every final reroute kept every leg the full buffer distance from the airspace, with small detours close to the geometric optimum. The median reroute added no waypoints, and under infinite lookahead removed one.",
      },
      /** Owner's intent: data re-sourced from public data where possible,
       *  with some loss of quality. The airspace is the FAA's Special Use
       *  Airspace layer for one chart cycle (launch-sua.json's `cycle`) plus
       *  a past launch TFR each for Starbase and Van Horn, which have no
       *  charted airspace; the dates and the count left the copy with every
       *  other number (2026-10-01). The nav database is the owner's internal
       *  one (cleared for publication), which is why this says "where I
       *  could", not "all public". */
      data: {
        tag: "data",
        body: "Public where I could, at some loss of quality: the airspace is the FAA’s Special Use Airspace layer, plus past launch TFRs for the sites with nothing charted, since NASA’s airspace file isn’t public. With no historical route database, the filed routes are my flight-plan model’s.",
      },
      /** The owner's disclaimer, made concrete (the word "approximation" is
       *  out by ruling; the owner rewords later). No numerals since
       *  2026-10-01 (owner: "remove the numbers, and just keep the
       *  high-level"); every limitation stays as a plain statement. What each
       *  clause stands on: "fewer steps" is 20 against the pipeline's 40
       *  (Task 10, R10); "seconds on my laptop" is Task 15's medians of
       *  2.07-6.54 s for one route, "longer ... every flight at once" Task
       *  12c's 34.7 s for all of them (stock Firefox 152, prod build, first
       *  press), and no phone has been timed, so none is named; "fewer final
       *  reroutes keep every leg the full buffer" is the gate's 85-95% (about
       *  65% near launch sites) against the poster's 98-99%, the same measure
       *  as the SLAAC note's, and "almost none cross" is its 99.3-99.6% with
       *  no leg crossing (20 steps, 25 nm margin, snapped plans; R10 rules
       *  the copy must not imply the full buffer is always held). The route
       *  count that app/page.tsx used to inject left with the numbers. */
      disclaimer: {
        tag: "differences",
        body: "My SLAAC models are integrated into the simulation software NASA and the FAA use to evaluate future air traffic management strategies. This demo keeps the diffusion model’s weights but samples in fewer steps than my pipeline does, on public airspace and routes written ahead of time. A reroute takes seconds on my laptop, longer with more airspace or every flight at once. On this demo’s test cases, fewer final reroutes keep every leg the full buffer distance from the airspace than the poster reports, though almost none cross it.",
      },
    },
    /**
     * Figure 1 — the label-efficiency chart. Static since 2026-09-30 (owner
     * call: the slider, readouts and mask strip hurt engagement). The chart's
     * own annotation (x0's value, the lead over the next best) is computed
     * from `public/research/label_efficiency.json`; the caption quotes the
     * standing content fact (0.882 at 16) and values the chart displays, so
     * if the export is regenerated, re-read the json and re-check the 0.047
     * and the two models named here.
     */
    figLabelEff: {
      caption:
        "Mean test Dice at each label budget, pooled over every seed and fold (2,500 predictions per point). At 16 labels x0-diffusion leads the next best model, zero-shot SAM, by 0.047; by 32 labels DeepLabV3 and ResNet-UNet have caught up. ε-diffusion (~0.23) is left off the axes.",
      /** Screen-reader name for the chart itself. The caption is the long form. */
      chartAria:
        "Mean test Dice against label budget for x0-diffusion and five baselines",
      xAxisLabel: "labeled training angiograms",
      yAxisLabel: "mean test Dice",
      /** Mono note under the chart; the budgets and train size are read from
       *  the file and spliced between these pieces. */
      logNotePre: "log x axis. budgets ",
      logNoteAnd: " and ",
      logNotePost: " labels of the ",
      logNoteEnd: " training images.",
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
        "Every per-image test Dice at 16 labels, pooled over all seeds and folds (2,500 per line). At 0.5 Dice, 0.32% of x0-diffusion’s predictions fall below, against 5.4% for SAM and 13.5% for ResNet-UNet. x0-diffusion’s mean is only a few points ahead of the baselines, but it almost never fails outright. The images come from a seed-1 re-run, one per slider stop, chosen by SAM Dice near the cursor; SAM is stochastic, so its mask can score differently from its recorded run.",
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
      /** The two data scopes, said once in mono under the panels. The row
     *  count between Mid and Post is read from cdf.json and printed with a
     *  thousands separator ("2,500"). */
      scopeNotePre: "curve: every test prediction at ",
      scopeNoteMid: " labels, ",
      scopeNotePost: " per model. panels: a rerun of seed 1, fold 1, same budget.",
      modelLabels: {
        x0diffusion: "x0-diffusion",
        sam: "SAM (zero-shot)",
        resnet: "ResNet-UNet",
      },
    },
    /** MWSCAS credit line: prose sentence plus the formal citation, kept
     *  separate so the citation can stay a literal, checkable string. */
    mwscas: {
      /** The rail tag over the citation, which sits beside the prose. */
      citeTag: "reference",
      prose:
        "I also led the PCB design team for a helical antenna for electromagnetic field stimulation in Alzheimer’s disease therapy; we presented it as an oral at IEEE MWSCAS 2026 in Cincinnati on August 11.",
      citation:
        "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), “Helical Antenna for Electromagnetic Field Stimulation in Alzheimer’s Disease Therapy,” IEEE MWSCAS 2026 (oral).",
    },
    /** The NASA box's heading (2026-09-30; the full name since 2026-10-01,
     *  owner's call). */
    nasaHeading: "NASA Ames Research Center",
    /** The NASA box's prose, one paragraph per role, SLAAC first (the
     *  figure under it is SLAAC's). Framing paraphrases the SLAAC poster
     *  ("structure is learned offline, hazards are applied online, no
     *  retraining"; "a reroute must come back as an ordered list of named
     *  fixes a controller will accept"; "the policy is the operator's
     *  dial"). "Space launch and air/airspace coordination" is the owner's
     *  wording (2026-10-01). No numerals (owner, 2026-10-01: "remove the
     *  numbers, and just keep the high-level"): the dates live in the
     *  Experience rows, and "fewer errors than the Whisper system in use" is
     *  the resume's 17% WER against 20%. No names: mentors and colleagues
     *  are omitted by the owner's call (2026-10-01, "no name dropping").
     *  The AIAA line (owner, 2026-10-05) is the resume's "Extended abstract
     *  for AIAA AVIATION 2027, in preparation", year dropped here for the
     *  no-numerals rule; the References entry carries the full citation. */
    nasaProse: [
      "On SLAAC, space launch and air/airspace coordination, I trained a diffusion model on FAA radar tracks to reroute flights around closed airspace. It learns what routes look like offline and applies the airspace while it samples, so a new closure needs no retraining. A reroute has to come back as an ordered list of named fixes a controller would accept, and the operator chooses how far ahead it may look; the figure below has both settings.",
      "Since August I’ve been on SHIFT: speech-to-text for air traffic control that makes fewer errors than the Whisper system in use, and a generate-and-rank parser that turns the transcripts into a maneuver database. I’m writing the parser up with NASA as an extended abstract for AIAA AVIATION.",
    ],
    /** Figure S3 on /lab since the SLAAC round (2026-09-30): the flight-plan
     *  LM's synthesized day. Was Figure 3 on page 1; the key stays under
     *  `research` so FlightFigure's import didn't move. "Matched to historical
     *  traffic density" and the ATM-software use are the 2026-09-30 resume's
     *  words; the waypoint sentence is the owner's (2026-09-29). */
    figFlight: {
      caption:
        "A full day of FAA flight plans, about 44,000 flights matched to historical traffic density, written by the flight-plan language model I trained from scratch for SLAAC on its own token vocabulary. Days like this one feed the simulation software NASA and the FAA use to evaluate future air traffic management strategies. Most of my time went into the waypoint system: a continuous route that obeyed every rule would often stop obeying them once it was snapped onto the waypoint map.",
      videoAria:
        "A day of FAA flight plans synthesized by a transformer I trained, looping video",
    },
    /** Figure 3 since the SLAAC round (2026-09-30): the rerouter. The
     *  caption's three table caveats are measured behaviour (task-13
     *  facts): clearance under the margin happens (the gate's 85-95%),
     *  added distance can be negative where a reroute straightens an LM
     *  bend, and a flight whose AIRPORT (first or last fix) sits inside the
     *  airspace can't clear and draws dashed: the walk pins both airports,
     *  while an interior filed fix inside is dropped (wide) or skipped (hug),
     *  so a box over the middle of a route clears. The other way to end
     *  cannot-clear is rare: a snapped leg the repair budget can't pull back
     *  out (the gate's two failures). Colours: filed routes are ink at 0.45
     *  (grey), plans green, the model's own arc a faint dotted green under
     *  its snapped plan, hollow dots BENDs (reroute-map.ts). Runtime line is
     *  pre + arcs + mid (runtimeMidOne for a single arc) + seconds + post.
     *  `unavailable` is for a load that failed; `runFailed` for a run that
     *  threw after the data and model had loaded. */
    figReroute: {
      /** Two sentences since the 2026-10-26 audit (it ran ~110 words). What
       *  each line style means moved to `key`, drawn beside the map; what the
       *  table's numbers mean moved to `tableNote`, shown with the table. */
      caption:
        "My flight plan model wrote the filed routes ahead of time. On your device, my diffusion model samples an arc around each conflict and snaps it to named fixes. Press reroute, or pick one route first.",
      /** The map's key, under the canvas, each entry beside a sample of its
       *  own line style (reroute-map.ts's drawPlan). */
      key: {
        filed: "filed route",
        plan: "reroute",
        dense: "arc before snapping",
        bend: "bend with no fix close enough",
        cannotClear: "can’t clear",
        crossing: "leg still crossing",
      },
      /** Under the single-route table and a picked flight's numbers. */
      tableNote:
        "Clearance turns red under the margin. Added distance goes negative where a reroute straightens a bend in the filed route. A flight can’t clear when its airport is inside the airspace, or rarely when a snapped leg still crosses.",
      unavailable: "The rerouter’s data or model didn’t load, so there’s nothing to run.",
      runFailed: "The reroute stopped with an error. Try again.",
      ringTooFew: "A shape needs at least three corners.",
      ringSelfCrossing: "That shape crosses itself. Draw it again.",
      ringDegenerate: "That shape has no area. Draw it again.",
      cannotClear: "can’t clear",
      untouched: "unchanged",
      noConflict: "No filed route comes within the margin of any airspace, so there’s nothing to reroute.",
      stale: "The settings changed since this run. Press reroute to run it again.",
      loading: "fetching the weights",
      running: "rerouting",
      runtimePre: "",
      runtimeMid: " arcs in ",
      runtimeMidOne: " arc in ",
      runtimePost: " s",
      /** Before a press: the arcs it will sample, counted by the planner on
       *  this page (no time: only measured numbers go in copy). */
      toSamplePre: "",
      toSampleMid: " arcs to sample",
      toSampleMidOne: " arc to sample",
      /** While running: "rerouting 12/43 arcs". */
      runningArcs: " arcs",
      /** All-flights mode, after a run. */
      pickHint: "Click a flight on the map for its numbers.",
      drawHint: "Click or tap to add corners, then the first corner again to close the shape.",
      controls: {
        pair: "route",
        draw: "draw airspace",
        close: "close shape",
        clear: "clear",
        launch: "all launch sites",
        margin: "margin",
        marginUnit: "nm",
        lookahead: "lookahead",
        hug: "1 waypoint",
        wide: "infinite",
        go: "reroute",
        /** The same button while a press is in flight. */
        stop: "stop",
        /** The route picker's first option: "all flights (373)". */
        allFlightsPre: "all flights (",
        allFlightsPost: ")",
        /** The map's view (task 12b): fit the pair, or the whole lower 48. */
        view: "map",
        viewFocus: "focus",
        viewUs: "whole US",
      },
      table: {
        flight: "route",
        added: "added",
        addedPct: "added %",
        clearance: "min clearance",
        crossings: "legs crossing",
        /** The all-flights detail row's first column. */
        pair: "pair",
      },
      /** All flights: the summary that stands in for a 373-row table. */
      summary: {
        checked: "flights checked",
        affected: "near airspace",
        rerouted: "rerouted",
        cannotClear: "can’t clear",
        medianAdded: "median added",
        worstAdded: "most added",
        lowestClearance: "lowest clearance",
      },
      /** Starbase and Van Horn have no charted SUA (launch-sua-sources.md),
       *  so each is one past launch TFR, labelled as such per the spec. */
      launchNote:
        "Red areas are each launch site’s charted restricted and warning areas, merged into one outline. Starbase and Van Horn have none charted, so each uses a past launch TFR.",
      canvasAria: "Map of the lower 48 with the filed routes, the airspace and any rerouted plans",
    },
    /** The margin note beside Figure 1: where the angiograms come from,
     *  linked to the benchmark's own repo (Zohranyan et al., Dr-SAM, CVPRW
     *  2024; its README is the one in external_materials/paper1/data/
     *  benchmarkDataset/). Rendered pre + link + post. The SCOPE note and the
     *  CREDIT note (IEEE Xplore) were cut 2026-09-29, owner's edit pass. */
    dataNote: {
      tag: "data",
      pre: "The angiograms in Figures 1 and 2 are from the ",
      link: "public pelvic-iliac benchmark",
      href: "https://github.com/vazgenzohranyan/Dr.SAM",
      post: ".",
    },
  },

  /** §2 Live systems: the two demos on page 1 (chess, and since 2026-10-15
   *  the Titan lander; the draw demo's copy below now renders on /lab). */
  systems: {
    /** The section's `<h2>`, added for Task 8's page assembly. */
    heading: "Live systems",
    intro:
      "Both demos below run the trained models in your browser.",

    /** The Titan lander, Figure 5 since 2026-10-15 (components/LanderFigure.tsx).
     *  ⚠️ PREVIEW: drafted from lunar_lander's titan-copy-notes.preview.md,
     *  not yet approved by the owner, and the module still draws its own
     *  testing UI with its own strings (lander.js, outside this file and
     *  outside check-voice). Sources for every fact below, from the copy
     *  notes: "shaped like" because Dragonfly contributes only its looks
     *  (owner, 2026-10-15; the game does use its 875 kg and 3.85 m); the
     *  dream samples the next 3 s from the last 1 s of flight and a plan of
     *  rotor commands; the game's link is 1 s each way (2 s round trip);
     *  67-92 minutes is the one-way light time from NASA's Saturn fact sheet
     *  (1,205.5-1,658.6 million km); in manual flight the main craft is the
     *  dream's average prediction of where the craft is when the newest
     *  command arrives (a required line). No build-specific number (the
     *  autopilot's landing rates, the parameter count) until the release
     *  build, whose numbers will differ. */
    lander: {
      /** The h3 and lede, chess's pattern. The lede says what the autopilot
       *  does (the copy notes: it plans "by imagining candidate thrust plans
       *  inside" the dream and flies the real physics); no plan count, since
       *  the planner's budget varies by device and steps down when slow. */
      heading: "Planning inside a learned model of the flight",
      lede: "Every half second the autopilot tries candidate thrust plans inside a diffusion model of its own flight, then flies the best one on the real physics.",
      /** 2026-10-16, the diorama: the flight is 2D and the depth is drawing,
       *  said once here (the honesty rule for illustrative pieces). */
      figureCaption:
        "An autopilot flies a rotorcraft shaped like NASA’s Dragonfly over Titan’s dunes. The flight is two-dimensional; the depth around it is drawing. The chart below the scene is the model’s side: from the last second of flight, a diffusion model predicts the next three seconds for each candidate plan, and the autopilot flies the first half second of the best one, then plans again. On a computer you can take the controls: your commands then cross a 2 s round-trip link to Earth (light takes 67-92 minutes each way), and the craft you see is the model’s average prediction of where it will be when your command arrives.",
      loadFailed: "The lander didn’t load. Reload the page to try again.",
      loading: "loading the model",
      /** Readout parts (the figure's amber corner): who is flying, height,
       *  the value head's landing chance. "est." is the owner's call
       *  (2026-10-16): the preview's value head misses its own calibration
       *  gate (ECE 0.051 against < 0.05), so the number is labelled an
       *  estimate rather than hidden. */
      who: {
        autopilot: "autopilot",
        you: "you",
        simplePilot: "simple pilot",
        fallback: "physics fallback",
      },
      metres: "m",
      landingPre: "landing ",
      landingPost: "% est.",
      landed: "landed",
      crashed: "crashed",
      windLabel: "wind",
      /** Index = ConditionsLevel. The fourth must carry the copy notes'
       *  required label, which `beyondNote` states in full when it's picked. */
      levels: ["calm", "breezy", "strong", "beyond predicted"],
      beyondNote: "Beyond Titan’s predicted near-surface winds: a game setting, not a Dragonfly limit.",
      /** The fault menu (2026-10-16): the four faults the module has, each
       *  described by what the engine does (lunar_lander src/world/world.ts:
       *  WEAK_ROTOR_FRAC 0.6, GUST_FRONT 5-12 s, LIDAR_DROPOUT_S 8, hazardField
       *  on the target). Index order = the menu's. */
      faultLabel: "fault",
      faultTitle: "throw a fault at it",
      faults: [
        { kind: "weakRotor", name: "weak rotor", what: "one rotor drops to 60% thrust" },
        { kind: "gustFront", name: "gust front", what: "a wind shift for 5-12 s" },
        { kind: "lidarDropout", name: "lidar dropout", what: "no new ground scanned for 8 s" },
        { kind: "hazard", name: "hazard on target", what: "boulders on the landing site" },
      ],
      /** The model chart (components/figures/LanderModelChart.tsx). ⚠️ An
       *  autopilot plan gives the dream every command, so the dream does not
       *  read the ground for those futures; the planner checks them against
       *  it. Only manual futures read it. `groundChecked` / `groundRead` say
       *  which, chosen from the module's own `ground.read` flag. */
      chart: {
        labelPlan: "the model’s next 3 s for each candidate plan",
        labelFutures: "the model’s sampled next 3 s of your flight",
        groundChecked: "dots: ground the autopilot checks them against",
        groundRead: "dots: ground the model reads",
        scanned: "scanned",
        unscanned: "not yet",
        hazard: "hazard",
        craft: "craft",
        target: "target",
        waiting: "the model’s first prediction appears here",
        /** The slow-device ladder's last rung flies without the model, so
         *  there is nothing to chart while it does. */
        simplePilot: "the simple pilot flies without the model, so there’s nothing to chart",
        aria: "The model’s predicted paths for the next three seconds, over the ground around the craft",
        /** The chunk key and the time panel (2026-10-16, "make chunking
         *  visible"). `flyingNow` wraps the module's own `execS` (0.5 s). */
        flyingNowPre: "flying now: the first ",
        flyingNowPost: " s of the best plan",
        rest: "the rest, replanned before it’s flown",
        earlier: "earlier chunks, one per plan",
        actual: "the actual flight",
        timeTitle: "height over time, meters",
        now: "now",
        timeAria: "Height over time: the chunk of the plan being flown, the rest of the plan, the chunks earlier plans flew, and the actual flight",
      },
      takeControls: "take the controls",
      giveBack: "let the autopilot fly",
      newFlight: "new flight",
      /** The module's own key bindings (its old full UI's help line). */
      keys: "W/S or ↑/↓ lengthen and shorten the thrust, A/D or ←/→ lean it. Esc lets go of the keys.",
      /** The line under the controls, chosen from the module's `display`,
       *  `mode` and `outcome` together (guide §4: only the manual view is a
       *  prediction; the onboard view and a confirmed touchdown are not). */
      view: {
        onboard: "The autopilot flies onboard, with no link delay. The faint shapes are the plans it’s weighing.",
        prediction: "You fly through a 2 s round trip, so the craft is the model’s average prediction of where it will be when your newest command arrives. The faint craft are other samples, and the inset is the downlink, 1 s old.",
        fallback: "Without the model, a physics predictor that ignores wind draws the craft.",
        touchdown: "Touchdown confirmed by the downlink.",
      },
      /** Words the module draws ON the canvas (LanderOptions.text). The
       *  terrain label is the copy notes' required wording; `{s}` and
       *  `{label}` are the module's own placeholders. */
      canvas: {
        terrainCaption: "illustrative terrain, generated from Cassini-observed dune and crater statistics",
        awaitingTouchdown: "touchdown predicted, waiting for the downlink",
        insetLabel: "downlink, {s} s old",
        targetLabel: "{label} (illustrative)",
        simplePilot: "Planner too slow on this device: a simple pilot is flying",
        noModel: "The model didn’t load: a physics predictor that ignores wind draws the craft",
      },
    },

    /** Figure S4 on /lab since 2026-10-15 (page 1's Figure 5 until the Titan
     *  lander took that slot; the namespace stays `systems.draw` so the verify
     *  suite and DrawDigit keep their keys). Was Figure 4 until the 2026-09-13 order swap — live SDEdit draw-a-digit. Carried over wholesale from v1's
     *  `sdedit` namespace (`copy.sdedit.*` → `copy.systems.draw.*`); every
     *  leaf key name is unchanged. */
    draw: {
      /** New for the manuscript chrome: v1's panel had no caption, so this one
       *  is drafted rather than carried over. */
      figureCaption:
        "SDEdit on a 26 MB x0-prediction MNIST model. Draw in the first box; the second shows the sample denoising, and the third the model’s prediction of the finished digit at each step.",
      statusFetching: "fetching weights…",
      statusReady: "ready",
      statusDraw: "draw to load",
      loadFailed: "model failed to load",
      heading: "SDEdit",
      lede: {
        pre: "Draw a digit and watch it dissolve into static and re-form. This is ",
        tech: "SDEdit",
        post: " (Meng et al., 2022): the drawing is noised partway to static and then denoised, so its coarse structure survives and the result keeps your slant and strokes.",
      },
      canvasAria: "Drawing canvas for digit",
      canvasCaption:
        "your drawing · the pen is deliberately fat, so the strokes survive being downscaled 14x",
      resultFetching: "fetching weights…",
      resultReady: "hit generate",
      resultDraw: "draw to load the model",
      resultCaptionIdle: "the result",
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
        /** The claim leads (owner request, 2026-09-16). Since 2026-09-29 this
         *  paragraph is the only place it's made: the permanent classifyLead
         *  line was cut as the third repeat. "A cheap version" is exact:
         *  lib/classify.ts runs Li et al.'s idea at ONE timestep with ONE
         *  shared noise draw, where they average denoising error over many. */
        a: "The label guess comes from the same diffusion model, with no separate classifier: it predicts the finished digit under all ten labels from identical noise and picks the one closest to your strokes. It’s a cheap version of the diffusion-classifier idea from Li et al. (2023). ",
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
        cPre: "Override the guess if it’s wrong, or on purpose: draw a 5, ask for an ",
        four: "8",
        cPost: ", and sometimes the model closes the bottom loop.",
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
        "The 553 KB int8 engine. You play white: click a piece, then a square. The tint ranks every legal reply, and “what it saw” shows the model’s internals on eight preset positions.",
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
      /** Cut to the claims (2026-09-30, owner: "cut it down to around half");
       *  the provenance lives in `ledeNotes`, a side column beside it. The
       *  limit (no search here, a few hundred Elo weaker) stays in the main
       *  column on purpose: a stated limit is what reads as real. */
      lede: {
        a: "An energy-based model with 469K parameters scores the position after each legal move and plays the one it scores lowest. I research energy models and diffusion, and wanted to see how well scoring alone could pick moves.",
        b: "With MCTS on a Raspberry Pi Zero 2 W it plays at roughly 1900-2200 Elo against Stockfish’s limited modes. Here it runs without search, a few hundred Elo weaker.",
      },
      ledeNotes: [
        { tag: "training", body: "About 30M positions from Lichess games between players rated 1800+." },
        {
          tag: "pi",
          body: "int8 cost -14 ±59 Elo. fp32 runs faster on the Pi’s ARM cores, so the Pi ships fp32 and this page the smaller int8 file.",
        },
      ],
      activationsLede:
        "The model’s internals on eight positions I picked, precomputed from the same weights. This works for the chess model and not the diffusion models because the backbone never downsamples below 8x8, so every layer stays aligned with the squares. A UNet’s pooled middle layers don’t.",
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
      /** Shown while self-play runs at one ply, the only mode where it applies
       *  (lib/chess-selfplay.ts). The numbers are the rule's own constants. */
      selfPlayRule:
        "Up to twice a game, when its second or third choice is at least 80% as likely as its first, it may play that instead, so games vary.",
      /** "took its second choice · p=0.211 vs 0.236", when a departure was just played. */
      selfPlayTookPre: "took its ",
      selfPlaySecond: "second choice",
      selfPlayThird: "third choice",
      selfPlayVs: " vs ",
      boardCaptionIdle: "you are white · click a piece, then a square",
      moveMap: "move map",
      mapNoteMcts:
        "Where the search actually spent its simulations, summed onto the square each move lands on.",
      mapNoteArgmin:
        "Its ranking of every legal reply, summed onto the square each lands on, from the same forward pass that picked the move.",
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
        ". Below 250 simulations the search almost always returns this same move (23 of 24 positions measured), so the box starts at 250.",
      newGame: "new game",
      engineVsEngine: "engine vs engine",
      stop: "stop",
      takeBack: "take back",
      thinking: "thinking…",
      hintButton: "hint",
      searchNote: {
        letItThink: "let it think",
        post: " runs the Pi’s MCTS in a worker. At ~6.6ms a position in WASM, whatever the thread count, it’s slow here. The Pi does 500 sims in about 2 seconds.",
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
          "shallow to deep. Early layers are local and edge-like; deep layers concentrate onto the squares that decide the eval.",
        topChannels: "top channels",
        mean: "mean",
        channelCaveat:
          "Most single channels light up on nothing nameable. Trust the mean map and the attribution view.",
        saliencyBody:
          "The gradient of the model’s one energy with respect to the board shows which squares move the evaluation most, like a hanging piece or a passed pawn.",
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
      "Green is active now; amber is paused until January.",
    rows: [
      /** Two NASA roles, per the 2026-09-30 resume (reverse chronological,
       *  as the resume lists them). SLAAC ended in August, so its lamp is
       *  "complete"; SHIFT keeps NASA's old "active". */
      {
        when: "since Aug 2026",
        who: "NASA Ames · SHIFT",
        what: "Speech-to-text for air traffic control, a generate-and-rank parser from transcripts to maneuvers, and a synthetic speech corpus that grows the recorded data about 20x.",
        status: "active",
      },
      {
        when: "May-Aug 2026",
        who: "NASA Ames · SLAAC",
        what: "Diffusion rerouting around closed airspace, and a flight-plan language model that writes a day of about 44,000 flights.",
        status: "complete",
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
        what: "Led the PCB design team on a helical antenna for electromagnetic field stimulation; presented as an oral at IEEE MWSCAS 2026.",
        status: "complete",
      },
      {
        when: "2025",
        who: "Davinci Wearables",
        what: "An agentic vision pipeline that estimates nutrition from meal photos, under 15% error.",
        status: "complete",
      },
      {
        when: "2024-2025",
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
      /** Authors and the full title, as the PAPER note gives them, in the
       *  same form as the two citations below (2026-10-26 audit: it was the
       *  only one with no authors). No link until the arXiv preprint. */
      {
        label:
          "N. Ranjan, S. Dev, A. Gonzalez, “Bootstrapping surgeon labeling campaigns with x0-diffusion: label-efficient vessel segmentation of catheter-based angiograms” (in preparation)",
        href: "",
      },
      /** The SHIFT paper (owner, 2026-10-05; resume commit "AIAA"). Both
       *  names by the owner's call, though the NASA prose names no one: a
       *  citation lists its authors. Status ladder, owner-set: "in
       *  preparation" until the abstract goes in (due Nov 2026), then
       *  "submitted", and nothing stronger until it is accepted. */
      {
        label:
          "N. Ranjan, S. Clarke, et al., “Generate-and-rank extraction of air traffic control clearances into an en route ontology,” extended abstract for AIAA AVIATION 2027 (in preparation)",
        href: "",
      },
      {
        label:
          "F. Perez, J. Morisaki, H. Kanakri, M. Rizkalla, et al. (incl. N. Ranjan), “Helical Antenna for Electromagnetic Field Stimulation in Alzheimer’s Disease Therapy,” IEEE MWSCAS 2026 (oral)",
        href: "",
      },
      { label: "Resume", href: "/resume.pdf" },
      // CV hidden with the masthead's (see masthead.links).
      { label: "GitHub", href: "https://github.com/NeelayRanjan" },
      { label: "ORCID", href: "https://orcid.org/0009-0008-9482-0160" },
      { label: "LinkedIn", href: "https://linkedin.com/in/neelayranjan" },
      { label: "Email", href: `mailto:${EMAIL}` },
      { label: "Supplementary material", href: "/lab" },
    ],
  },

  /** /lab — "Supplementary material": the demos that left page 1 (S4, the
   *  draw demo, since 2026-10-15). */
  lab: {
    /** Above the heading, a link back to the main page. */
    backLink: "← back to the paper",
    heading: "Supplementary material",
    intro:
      "S1-S3 replay output from trained models. S4 runs its model live.",

    /** Figure S1 — the diffusion trajectory viewer. Carried over wholesale
     *  from v1's `diffusion` namespace (`copy.diffusion.*` →
     *  `copy.lab.diffusion.*`); every leaf key name is unchanged. */
    diffusion: {
      statusLoading: "loading",
      /** New for the manuscript chrome (Task 11): v1's panel had no caption. */
      figureCaption:
        "Two trained diffusion models on the same ten digits, built to compare continuous and discrete diffusion side by side: a 6.47M-parameter pixel model that denoises from static, and a 1.28M-parameter model that unmasks ascii cells one at a time and never revises a cell once it’s committed.",
      /** Sits next to the frozen steps/schedule, which render as plain text
       *  rather than a control. See the ⚠️ comment above BOOT_CMD. */
      frozenNote: "Replayed from an export; only the digit is selectable.",
      notice: {
        tag: "placeholder data",
        body: "These frames are synthetic, not output from a trained model: a bitmap digit run through a hand-rolled noising schedule, played backwards. Real trajectories drop into ",
        path: "/diffusion_traj.json",
        tail: " unchanged.",
      },
      headingContinuous: "Continuous diffusion",
      headingDiscrete: "Discrete diffusion",
      ledePixel:
        "On the left, the noisy state x_t. On the right, the model’s prediction of the finished digit at that step. This model is trained to predict the clean image instead of the noise, so that prediction is its raw output. In pixel mode the ascii look is only a filter.",
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
    /** Figure S3's heading and lede (2026-10-01, final review): the same
     *  treatment S1 and S2 get, rendered inside FlightFigure. The 222M and
     *  "too big for a browser" are CLAUDE.md's SLAAC facts; the caption keeps
     *  the 44,000 flights and the waypoint story, so the lede doesn't repeat it.
     *  The first sentence is confirmed by the owner (2026-10-01): the video
     *  came from route_lm_best.pt, the same LM that wrote Figure 3's routes. */
    flight: {
      heading: "A language model that writes flight plans",
      lede:
        "The filed routes in Figure 3 on the first page come from this model. At 222M parameters it’s too big to run in a browser, so what plays here is a video of one day it wrote.",
    },

    jepa: {
      statusLoading: "loading atlas…",
      heading: "Predicting pixels, or predicting representations",
      lede: {
        a: "I trained two encoders with the same architecture, masking, optimizer, schedule and seed for 65 epochs on the same 100,000 unlabeled STL-10 images. One thing differs. MAE predicts the hidden patches’ pixels; I-JEPA predicts their representations, from an EMA copy of the encoder. A pixel loss has to account for everything in the image, including what can’t be predicted: texture, clutter, the exact color of the sky. A latent target discards that first and predicts structure instead.",
        b: "Neither saw a label during pretraining. ",
        cPre: "Frozen features, linear probe: MAE ",
        cMid1: ", I-JEPA ",
        cMid2: ". kNN at k=20: ",
        cMid3: " and ",
        cPost:
          ". The kNN gap is the wider one, and kNN is retrieval. MAE’s neighbors often match the background rather than the subject. ",
      },
      scope:
        "This is a claim about representation quality, not about dense pixel-precise output like segmentation, where a UNet’s skip connections carry exactly the detail a latent target throws away.",
      neighborNotePre: "Neighbors are the top ",
      neighborNotePost: " by cosine similarity in the full embedding space.",
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
      meanPurityPost: " of neighbors share the query’s class",
      ariaSame: ", same class as the query",
      ariaDiffers: ", different class from the query",
      ariaSetQuery: ". Set as query.",
      ariaQueryPre: "query image, class ",
      errorPrefix: "could not load the representation bundle: ",
      /** New for the manuscript chrome (Task 11): v1's panel had no caption. */
      figureCaption:
        "Each encoder’s nearest neighbors for the same query, precomputed. Click any thumbnail, including a result, to make it the query.",
    },

  },

  /** Stargaze mode + the night-sky credit (components/manuscript/
   *  StargazeToggle.tsx, SkyCredit.tsx). `enter` is the owner's own wording.
   *  `creditStill` is the reduced-motion variant ("at" rather than "from":
   *  that sky never turns). Neither states the speed-up since the owner's
   *  second trim (2026-09-16); if one ever does again, it must match
   *  SKY_SPEEDUP in lib/sky-math.ts (180) and stay out of `creditStill`. The
   *  ISS card's `issClock` still states it, and must match too. */
  /** The skip link, the first stop on every page (app/layout.tsx). It jumps
   *  past the night sky's controls to the page's own `main#main`. */
  skipLink: "Skip to content",
  /** The accessible name of a live figure's slot before it mounts
   *  (components/manuscript/DeferredMount.tsx). Heard only for the moment
   *  between Tab reaching the slot and the figure's first control taking
   *  focus. */
  deferredFigure: "Live figure, loading",

  /** The line at the foot of every page (components/manuscript/Colophon.tsx). */
  colophon: {
    rights: "© 2026 Neelay Ranjan",
    links: [
      { label: "Email", text: EMAIL, href: `mailto:${EMAIL}` },
      { label: "Resume", text: "Resume", href: "/resume.pdf" },
    ],
  },

  stargaze: {
    enter: "stargaze for a bit?",
    exit: "back to the page",
    /** The stargaze hint bar, composed (spec §4), pointer variant:
     *    "drag to look around, click a name or symbol to read about it
     *     · 44 objects, 88 constellations and more have cards · browse the list"
     *  The two numbers come from the loaded data, never from here; the
     *  separators are the bar's own markup. `browseList` is the control that
     *  opens the list as a visible panel.
     *  Pointer: a drawn name's box and the symbol are both hit targets.
     *  Touch: since the discoverability round phones draw names for the
     *  coloured objects below 880px, and those names are hit targets, so the
     *  touch hint may promise a name too (it used to promise only symbols,
     *  final review F1). */
    hintPointer: "drag to look around, click a name or symbol to read about it",
    hintTouch: "drag to look around, tap a name or symbol to read about it",
    /** "{objects} objects, {constellations} constellations and more have cards":
     *  "and more" because planets, the Moon, the Milky Way, the ISS and active
     *  showers open cards too and aren't counted, so it must not read as a
     *  total (final review m2). */
    countsObjects: " objects, ",
    countsConstellations: " constellations and more have cards",
    browseList: "browse the list",
    /** The screen-reader name of the stargaze keyboard list (NightSky, F2):
     *  one button per selectable currently on screen. */
    listLabel: "On screen now",
    /** The same list opened as a visible panel by `browseList`. Its contents
     *  are what's on screen, so the title says that, in the bar's register. */
    listPanelTitle: "on screen now",
    listPanelClose: "close the list",
    /** Once per session, near the pointer, the first time it enters the sky
     *  in paper mode (spec §5). Short: it's gone in a few seconds. */
    invite: "the sky over NASA Ames",
    /** The secret door (Task 17): shown once stargaze is entered by clicking
     *  a constellation in the sky, never for the toggle or the footer door.
     *  The owner's words, verbatim (2026-10-01). */
    secretMessage:
      "You found my secret escape. Stargaze with me for a bit: this is the sky over NASA Ames, where I work.",
    /** The second way in, at the foot of `/` and `/lab`: this lead line,
     *  then a button labelled with `enter` itself ("stargaze for a bit?"). A
     *  second door to the same feature carries the same name, or visitors
     *  don't connect the two (controller ruling, 2026-09-16). */
    footerLead: "The background is the sky over NASA Ames.",
    /** The owner's own sentences (trimmed twice on 2026-09-16, the second
     *  time dropping the speed-up clause): keep both word for word. Each is a
     *  complete sentence ending in its own full stop, and `creditTail`
     *  follows either one, so it opens with a space:
     *    "The sky over NASA Ames from the moment you arrived. The shapes are
     *     enlarged and coloured as long exposures show them, but every
     *     position is real."
     *    "The sky over NASA Ames at the moment you arrived. The shapes are
     *     enlarged and coloured as long exposures show them, but every
     *     position is real."
     *  No longer stargaze-gated: the sky shows colour on every page since the
     *  discoverability round (spec §3, §7). */
    credit:
      "The sky over NASA Ames from the moment you opened the page.",
    creditStill:
      "The sky over NASA Ames when you opened the page.",
    /** The eyes-see-grey reason lives on each coloured card's `colourNote`,
     *  with its source; the credit only says where the colour comes from. */
    creditTail: " Objects are drawn enlarged, in long-exposure color.",
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
      /** Under the photograph: "Photograph: NASA, ESA · Public domain". The
       *  author and license are data from the Commons API (index.json), never
       *  typed here. */
      imageCredit: "Photograph: ",
      /** The photograph's own citation, in the same APA shape as the facts':
       *  author (year n.d.), "<file title> [Photograph]", Wikimedia Commons. */
      imageSourceSuffix: " [Photograph]",
      imageSite: "Wikimedia Commons",
      /** Final-review fix #2: Commons' CC BY / CC BY-SA licenses ask that a
       *  modification be disclosed. Appended to the credit line right after
       *  the license name, chosen by the index entry's `cropped` flag (every
       *  photograph is resized; two, m8 and m33, are also cropped). */
      imageResized: ", resized",
      imageCropped: ", cropped and resized",
      /** Task 19 (R25): a myth constellation's card opens with an artwork
       *  (a painting, a vase, a star-atlas plate) rather than a photograph.
       *  The credit says "Image:" for it, its citation is tagged "[Image]",
       *  and after the artwork's own name (index.json's `artwork`) comes this
       *  line, so nobody reads it as a picture of the sky. */
      imageCreditArtwork: "Image: ",
      imageSourceSuffixArtwork: " [Image]",
      imageArtworkNote: "An artwork, not a photograph of the sky.",
      /** "Retrieved September 15, 2026, from https://…" (APA). */
      retrieved: "Retrieved",
      from: "from",
      titleMoon: "Moon",
      titleIss: "International Space Station",
      titleMilkyWay: "Milky Way",
      /** Shown only on galaxy/nebula/cluster cards and the Milky Way's own
       *  card ("clutter" follow-up, 2026-09-15): their glyphs are drawn far
       *  bigger than life; the position is not. */
      notToScale: "Drawn far bigger than it looks from Earth.",
      /** Shown only on cards whose object is actually drawn in sourced
       *  colour (colour round task 7: an id in lib/sky-layers.ts's
       *  OBJECT_COLOURS, plus the Milky Way's band). M82 has no palette, so
       *  its card carries no colour note. The grey is sourced, same
       *  citation as the credit line's.
       *
       *  Final-review fix #1: with a photograph now sitting above this text,
       *  "these colours" read as a claim about the PHOTOGRAPH, which for a
       *  narrowband composite (several of this round's picks) is false.
       *  Reworded so the subject is unmistakably the drawn symbol, not the
       *  photograph above it; the photograph's own colour honesty is a
       *  separate per-pick `note` (see scripts/sky-image-picks.json). */
      colourNote:
        "The symbol's colors follow long-exposure photographs; your own eyes would see it gray, because at that brightness vision runs on rod cells, which register no color.",
      /** Appended to the note on the nebulae and remnants whose palette
       *  rests on an emission line's own wavelength (EMISSION_LINE_COLOURED),
       *  and the reason those cards also list Lodriguss under Sources. Star
       *  colour is temperature, so the clusters and the galaxies get neither. */
      colourNoteLines:
        "The symbol's color is what this object's own emission lines emit, not a narrowband palette that maps those lines onto other colors.",
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
      issClockStill: "This sky holds still at the moment you opened the page, so the station does too.",
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
