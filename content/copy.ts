/**
 * All user-facing copy on the site, in one place.
 *
 * ⚠️ EDIT COPY HERE, not inline in components. This file exists so a wording
 * change is find-by-name in one file instead of a hunt through JSX. Components
 * reference `copy.*`; they no longer hold the strings.
 *
 * WHAT LIVES HERE: headings, ledes, captions, button labels, boot-log lines,
 * terminal command names, notices, prose notes, status words, section anchors,
 * page metadata, the 404, the boot screen, and the demo labels/blurbs that used
 * to sit in lib data (`SEARCH_MODES`, `TARGETS`).
 *
 * WHAT DELIBERATELY STAYS INLINE (moving it would change behavior, not just copy):
 *   - `--flag` tokens (`--digit`, `--sims`, …). They are logic identifiers, not
 *     free prose: threaded through `commitParam`, `CommandLine`'s `flag` prop, and
 *     the echo templates, and interwoven with number interpolation in each panel's
 *     `BOOT_CMD`. They must match their param keys; centralizing them would risk a
 *     silent desync and touch the param plumbing.
 *   - Number-format glue in interpolated readouts (` · `, `p=`, `v=`, `n=`, `/`,
 *     step/timing/percent counters). These are formatting, not sentences.
 *   - aria-labels built from live structural values (`${flag}, ${min} to ${max}`,
 *     the ASCII-grid "… at step N of M" alt text). Static aria-labels ARE here.
 *   - Enum values rendered directly (the `pixel`/`ascii`/`game` button faces are
 *     the state key itself).
 *   - The `neelay@latent:~$` prompt: composed live in `lib/identity.ts` from the
 *     editable username + host, so it's a template, not a literal.
 *   - `content/sample-space.md`, already the external source for that write-up.
 *
 * Strings that were HTML entities in JSX (`&rsquo;`, `&quot;`, `&ndash;`) are the
 * actual Unicode characters here (’ " –), so the render is byte-identical.
 */
export const copy = {
  /** <title>, meta description, and the share-card (OG/Twitter) text. */
  meta: {
    title: "Neelay Ranjan · generative-modeling researcher",
    siteName: "neelayranjan.dev",
    /** The unfurl description. Concrete, because a share card is the one place a
     *  recruiter reads before deciding whether to click. */
    blurb:
      "Generative-modeling researcher at NASA Ames and Regenstrief. Diffusion for " +
      "safety-critical, data-scarce domains. Three trained models run live on this " +
      "page, in your browser.",
    ogImageAlt: "NEELAY RANJAN resolved out of a particle swarm on a near-black field",
  },

  hero: {
    name: "Neelay Ranjan",
    /** Sub-text under the nameplate. */
    subtext: "energy-based models · diffusion · flight-path generation",
    /** Longer form — used for page metadata (the meta description) rather than
     *  shown in the hero. */
    tagline:
      "Generative-modeling researcher. Diffusion for safety-critical, data-scarce domains.",
    affiliation: "NASA Ames · Regenstrief Institute",
    /**
     * The Langevin caption under the nameplate, in fragments because two words are
     * colour-emphasized inline. Rendered: a + " " + <indigo>out</indigo> + b +
     * " " + <teal>backIn</teal> + c.
     */
    caption: {
      a: "Illustrative Langevin simulation. The name is the ground state of an energy landscape carved from its own letterforms: particles descend into the wells and settle. Thermal kicks knock them",
      out: "out",
      b: "; they re-anneal",
      backIn: "back in",
      c: ". Drag to pick up a cluster. Hand-built landscape, not a trained model.",
    },
    /** The Resume link label. Its URL lives in `links.resumeUrl` below. */
    resumeLabel: "Resume",
    links: {
      /**
       * Where the resume lives. Deliberately NOT in `public/`: it changes often, and
       * an external URL means updating it needs no commit and no redeploy — edit the
       * doc and the link is current. Set empty and the Resume link isn't rendered,
       * so no dead link ships.
       *
       * `/preview`, NOT the `/edit?usp=sharing&ouid=...` URL Drive hands you when you
       * click Share. Three reasons, all checked against the live doc rather than
       * assumed:
       *   - `ouid` is the owner's Google account id. It does nothing for a visitor.
       *   - `/edit` opens the full Docs editing chrome for a read-only viewer.
       *   - `/export?format=pdf` works, but sends `Content-Disposition: attachment`,
       *     so it downloads a file instead of showing anything. `/preview` renders in
       *     the tab and still offers download.
       * The file is an uploaded .docx shared `{role: reader, type: anyone}` — verified,
       * or this link would wall visitors behind a request-access screen.
       */
      resumeUrl:
        "https://docs.google.com/document/d/1-qa5lXInCIQoPsL4uvpHWgShjfeeVh_l/preview",
      /** Label + href travel together — the label is copy, the href is config, but
       *  splitting them would only make an edit touch two places. */
      items: [
        { label: "GitHub", href: "https://github.com/NeelayRanjan" },
        { label: "LinkedIn", href: "https://linkedin.com/in/neelayranjan" },
        { label: "Email", href: "mailto:neelay.ranjan@outlook.com" },
      ],
    },
  },

  /** The teal mono anchors in the gap above each panel (page.tsx). They name
   *  WHERE YOU ARE; each panel's <h2> names WHAT THE THING IS. Never the same
   *  words — see CLAUDE.md's naming table. */
  anchors: {
    diffusion: "two models, one idea",
    draw: "draw a digit",
    chess: "play the engine",
    sampleSpace: "sample space",
  },

  /** §2 — the diffusion trajectory viewer. */
  diffusion: {
    cmd: "./x0_diffusion",
    bootLines: [
      "resolving trajectory source /diffusion_traj.json",
      "decoding 10 digits x 32 frames, 28x28 row-major",
      'warming ascii ramp " .:-=+*#%@" -> ready',
    ],
    /** Program-name faces in the title bar (the `--digit N` flag stays inline). */
    labelPixel: "x0-diffusion",
    labelAscii: "ascii-diffusion",
    statusBooting: "booting",
    statusLoading: "loading",
    /** Only shown if the loaded data is synthetic — real trajectories never trip
     *  it, but the copy is here so an edit is findable. Fragments: the emphasized
     *  tag, the body, and the path span. */
    notice: {
      tag: "placeholder data",
      body: ". These frames are synthetic, not output from a trained model: a bitmap digit run through a hand-rolled noising schedule, played backwards. Real trajectories drop into ",
      path: "/diffusion_traj.json",
      tail: " unchanged.",
    },
    /** The <h2> follows the toggle: pixel is Gaussian (continuous), ascii is
     *  absorbing-state (discrete). */
    headingContinuous: "Continuous diffusion",
    headingDiscrete: "Discrete diffusion",
    ledePixel:
      "Noise sharpens into a digit, one step at a time. On the left, the noisy state x_t resolving. On the right, the model’s prediction of the finished digit from that step. This model predicts the clean image directly rather than the noise, which is why you get both at every step.",
    ledeAscii:
      "A different model, and a different kind of corruption: masked cells resolve into characters. It starts with every cell masked and commits them one at a time, most-confident first. There is no noise anywhere in it. Once a cell commits it’s frozen and never re-predicted, so the grid can only ever fill in, never flicker. On the left, what’s committed so far, mask holes and all. On the right, the model’s current guess for every cell, including the ones it hasn’t decided yet.",
    modelLabel: "model",
    /** Hover title on the ascii button when its data file is absent. */
    asciiUnavailable: "ascii_traj.json not present",
    digitLabel: "digit",
    pause: "pause",
    play: "play",
    replay: "replay",
    /** Load/empty states in the figure area. `errorPrefix`/`missing*` interpolate. */
    errorPrefix: "could not load trajectories: ",
    missingPre: "no trajectory for digit ",
    missingPost: " in this dataset",
    loadingTrajectories: "loading trajectories…",
    /** Figure captions. `xtLabel`/`x0Label` are the coloured tokens; the rest
     *  follows the mode. */
    xtLabel: "x_t",
    x0Label: "x̂₀",
    xtNoisy: "noisy state",
    xtCommitted: "committed so far",
    x0Predicted: "predicted sample",
    x0Guess: "current guess",
    /** Static aria-label on the progress bar. */
    progressAria: "Reverse diffusion progress",
    hint: "edit the digit",
  },

  /** §2b — live SDEdit draw-a-digit. */
  sdedit: {
    cmd: "./sdedit",
    bootLines: [
      "sdedit: noise your drawing ~60% -> denoise -> your strokes survive",
      "runtime: onnxruntime-web (webgpu, wasm fallback) · fully client-side",
      "weights: mnist_x0.onnx (26 MB, lazy on first stroke)",
    ],
    /** Title-bar program face (the `--digit N --strength S` flags stay inline). */
    label: "sdedit",
    statusBooting: "booting",
    statusFetching: "fetching weights…",
    statusReady: "ready",
    statusDraw: "draw to load",
    /** Failure notice. Emphasized tag + interpolated error. */
    loadFailed: "model failed to load",
    heading: "SDEdit",
    /** Lede: pre + <ink>SDEdit</ink> + post. */
    lede: {
      pre: "Draw one, pick its label, and watch it dissolve into static and re-form. This is ",
      tech: "SDEdit",
      post: ": your drawing is noised about 60% of the way to pure static and then denoised back, so the coarse structure is never destroyed. Your slant and your strokes survive into the result. It is genuinely your digit being cleaned up, not a lookalike fetched from the model. The whole thing runs on your device; nothing is sent anywhere.",
    },
    /** Static prefix of the canvas aria-label (`… for digit ${digit}`). */
    canvasAria: "Drawing canvas for digit",
    canvasCaption:
      "your drawing · the pen is deliberately fat, so the strokes survive being downscaled 14x",
    /** Middle (result) figure. */
    resultFetching: "fetching weights…",
    resultReady: "hit generate",
    resultDraw: "draw to load the model",
    resultCaptionIdle: "the result · your strokes survive the noise",
    resultForward: " · forward process, no model calls",
    resultRunning: " · the model running",
    /** Right (x̂₀) figure. */
    x0Placeholder: "the model’s guess appears here",
    x0Label: "x̂₀",
    x0CaptionPre: " · its guess at the finished digit",
    x0Held: " · held still, nothing has run yet",
    x0Repredicted: " · re-predicted every step",
    x0CaptionIdle: "x̂₀ · its guess, updated at every step",
    /** Label picker. */
    label_: "label",
    labelGuessing: "· guessing…",
    labelAuto: "· auto",
    labelYours: "· yours",
    /** Static prefix of a digit button's aria-label (`${d}, fits your drawing N%`). */
    fitAriaMid: ", fits your drawing ",
    fitAriaPost: "%",
    clear: "clear",
    sampling: "sampling…",
    generate: "generate",
    /** Hover title on generate before the weights are in. */
    generateHint: "draw once to fetch the weights",
    hint: "edit any number",
    /** The classifier explainer, in fragments: it has an inline <teal>, a
     *  conditional decisiveness phrase, and an inline <indigo>. */
    classify: {
      a: "The model is class-conditional, so it needs a label. That guess comes from the diffusion model itself: it predicts the finished digit under all ten labels from identical noise, and whichever best explains your strokes wins. No second model. ",
      bPre: "The ",
      teal: "teal",
      bPost: " behind each label is that score, so you can see the ranking it actually produced rather than take the winner on faith. This one was ",
      coinFlip: "close to a coin flip",
      nearThing: "a near thing",
      notClose: "not close",
      cMid: ". ",
      cPre: "It’s a suggestion, so override it if it’s wrong. Worth trying anyway: draw a 7 and ask for a ",
      four: "4",
      cPost: ". You can watch conditioning fight your drawing.",
    },
  },

  /** §4 — the EBM chess engine. */
  chess: {
    cmd: "./entropy_chess",
    bootLines: [
      "energy-based model · 469K params · scores positions, never outputs a move",
      "int8 quantized to 553 KB · the same artifact that runs on the Pi",
      "onnxruntime-web (wasm) · mcts in a worker · chess.js owns every rule -> ready",
    ],
    /** Title-bar face (the `--engine ebm --search argmin|mcts` flags stay inline). */
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
    /** Engine-error notice. Emphasized tag + interpolated message. */
    engineError: "engine error",
    /** view toggle: `game` face is the state key; this is the other one. */
    viewSaw: "what it saw",
    heading: "Energy-based modeling over board states",
    lede:
      "A 469K-parameter convolutional energy-based model. It scores resulting positions rather than proposing moves: every legal move is played out, the whole batch is ranked in one forward pass, and the lowest-energy position wins. Trained on ~30M positions from Lichess games where both players were rated 1800+, then quantized to 553 KB for a Raspberry Pi Zero 2 W with a 3.5\" touchscreen. Strength is roughly 2000–2300 against Stockfish’s limited modes. Quantization cost about nothing. This is that same int8 file, running in your browser.",
    activationsLede:
      "The model’s evaluation, laid back onto the board, and computed on your device. This works here and not on the diffusion models for a structural reason: the chess backbone never downsamples below 8x8, so every layer stays registered to the squares and can be read as a position. A UNet’s middle layers have no such luxury.",
    /** Outcome banners. The winner side interpolates into `checkmatePre`. */
    checkmatePre: "checkmate · ",
    checkmateWinsBlack: "black wins",
    checkmateWinsWhite: "white wins",
    drawStalemate: "draw · stalemate",
    drawThreefold: "draw · threefold repetition",
    drawInsufficient: "draw · insufficient material",
    drawFiftyMove: "draw · fifty-move rule",
    /** Board caption states. `hintPlay`/`mapCaption` interpolate live values. */
    check: "check",
    illegalMove: "illegal move",
    hintPlayPre: "it would play ",
    mapCaption: "its move map",
    mapCaptionTail: " · where the engine wanted to go, brightest = most wanted",
    selfPlayCaption: "engine vs engine · it plays both sides",
    boardCaptionIdle: "you are white · click a piece, then a square",
    moveMap: "move map",
    /** The move-map note follows the search mode. */
    mapNoteMcts:
      "Where the search actually spent its simulations, summed onto the square each move lands on.",
    mapNoteArgmin:
      "Its ranking of every legal reply, summed onto the square each one lands on. Free: it comes from the same pass that picked its move.",
    /** Promotion picker. `promoteAria` interpolates the piece. */
    promoteTo: "promote to",
    promoteAria: "promote to",
    top3: "the engine’s top 3",
    makeMove: "make a move",
    loadingEngine: "loading the engine…",
    searchLabel: "search",
    /** Search-note fragments. `simsPre` interpolates the sim count; `--sims` and
     *  the numbers stay inline. */
    searchNoteSetPre: " Set it with ",
    searchNoteSims: "--sims",
    searchNoteRange: " above, ",
    searchNoteTo: " to ",
    searchNotePiRuns: ". The Pi runs ",
    searchNoteFloor:
      ". Below 250 simulations the search returns the same move as this, which is why --sims stops there rather than at 1.",
    /** Game buttons. */
    newGame: "new game",
    engineVsEngine: "engine vs engine",
    stop: "stop",
    takeBack: "take back",
    thinking: "thinking…",
    hintButton: "hint",
    /** Hint explainer: pre + <indigo>hint</indigo> + post. */
    hintNote: {
      word: "hint",
      post: " asks what it would play from where you are sitting. It is the same call it makes for itself, at whatever the search is set to: the encoder always builds from the side to move, so your move and its move are one computation.",
    },
    /** Search explainer: pre + <teal>let it think</teal> + post. */
    searchNote: {
      pre: "At 1 ply it ranks every legal reply and plays the best, in one forward pass. ",
      letItThink: "let it think",
      post: " runs the Pi’s actual search on top of those same numbers, in a worker, so the page keeps moving while it does. It is slower here than it has any right to be: the model is 469K parameters, and scoring one position costs ~6.6ms in WASM no matter how many threads you give it.",
    },
    hint: "how long it thinks",
    /** --sims echo lines, shown under the boot log after an edit. The number
     *  interpolates; `--sims` stays inline. */
    simsEchoWhenThink: " · applies when you let it think",
    simsEchoNextMove: " · applies to its next move",
    /** The two search modes (id + sims stay in chess-protocol.ts; these are their
     *  faces). */
    search: {
      ply1Label: "1 ply",
      ply1About: "one forward pass, ~150ms",
      thinkLabel: "let it think",
      thinkAbout: "simulations",
    },
    /** The interpretability view. */
    activations: {
      toMoveWhite: "white to move",
      toMoveBlack: "black to move",
      attribution: "energy attribution",
      layerActivation: "layer activation",
      /** `activation · ${layer}` and `· ch ${n}` interpolate the layer/channel. */
      activationPrefix: "activation · ",
      channelPrefix: " · ch ",
      hottest: "hottest:",
      /** depth slider label interpolates `${layer} (${i}/${n})`. */
      depthPrefix: "depth · ",
      shallowToDeep:
        "shallow to deep. Early layers are local and edge-like; deep layers concentrate onto the squares that decide the eval, and it all stays board-aligned the whole way.",
      topChannels: "top channels",
      mean: "mean",
      channelCaveat:
        "Explore at your own risk: not every channel is human-interpretable. Plenty light up on nothing nameable. The mean map and the attribution view are the trustworthy ones.",
      saliencyBody:
        "The model outputs a single scalar energy. The gradient of that energy with respect to the board says which squares most move its evaluation: the hanging piece, the key defender, the passed pawn.",
      /** value head: `+${n} for white · about level`. Sign/number/level interpolate. */
      valueHeadPre: "value head: ",
      valueHeadPost: " for white",
      valueHeadLevel: " · about level",
      scenarios: "scenarios",
    },
  },

  /** §3 — sample-space DDPM vs flow matching (illustrative). */
  sampleSpace: {
    cmd: "./sample_space",
    /** Title-bar label (the `--compare ddpm,flow` flag stays inline). */
    label: "sample-space --compare ddpm,flow",
    // The middle boot line ("ddpm: N stochastic steps · flow: M …") interpolates
    // DDPM_STEPS/FLOW_STEPS, so it stays a template inline in SampleSpace.tsx.
    bootTop: "building 2d target manifold from a closed form",
    bootBottom: "hand-drawn fields, no weights loaded -> ready",
    statusBooting: "booting",
    statusIllustrative: "illustrative",
    /** Notice: emphasized tag + body. */
    noticeTag: "illustrative",
    noticeBody:
      ". Hand-drawn fields on a 2D toy distribution. No model weights are loaded or run here.",
    heading: "Stochastic vs deterministic",
    /** Lede: pre + <ink>--target</ink> + post. */
    lede: {
      pre: "The same target, the same starting point, two ways of getting there. Click either panel to launch a trajectory from that point. Both panels run the same start, so the routes are directly comparable. Switch ",
      target: "--target",
      post: " above to run the same comparison over a different shape: the spiral makes the step-count gap easiest to see, because the routes are long enough to watch.",
    },
    /** Panel captions. The step counts interpolate; DDPM/flow are the tokens. */
    ddpmLabel: "DDPM",
    ddpmCaptionPre: " · stochastic (SDE), ",
    ddpmCaptionPost: " steps. Jagged; a different route every run.",
    flowLabel: "Flow matching",
    flowCaptionPre: " · deterministic (ODE), ",
    flowCaptionPost: " steps. Smooth; the same route every time.",
    /** `target · ${blurb}` — prefix here, blurb from `targets` below. */
    targetCaptionPre: "target · ",
    hint: "try another shape",
    /** The four shapes (ids stay in lib/sample-space.ts; these are their faces). */
    targets: {
      twoMoonsLabel: "two-moons",
      twoMoonsBlurb: "two interleaving half-moons",
      spiralLabel: "spiral",
      spiralBlurb: "two arms winding out from the centre",
      ringLabel: "ring",
      ringBlurb: "a single closed circle",
      gaussiansLabel: "8-gaussians",
      gaussiansBlurb: "eight modes on a circle",
    },
  },

  /** The 404 page (app/not-found.tsx). */
  notFound: {
    shell: "sh",
    status: "404",
    /** `cat ${path}` and `cat: ${path}: …` interpolate the attempted path. */
    catError: ": No such file or directory",
    ls: "ls ~",
    /** `ls` output — the real section names, doubling as navigation. */
    sections: [
      { href: "/#diffusion", name: "diffusion" },
      { href: "/#draw", name: "draw" },
      { href: "/#chess", name: "chess" },
      { href: "/#sample-space", name: "sample-space" },
    ],
    heading: "Page not found",
    lede:
      "The site is a single page, so there is not much to get lost in beyond a typo. Those four are everything on it.",
  },

  /** The ssh boot screen (components/ambience/BootScreen.tsx). The prompt itself
   *  is composed in lib/identity.ts; these are the fixed lines around it. */
  boot: {
    domain: "neelayranjan.dev",
    sshPrefix: "ssh ",
    connectLine: "connected · latent",
    startCmd: "./latent --serve",
    usernameAria:
      "the user to connect as. Edit it to use your own name in this page's shell prompts.",
  },

  /** Shared terminal chrome. */
  commandLine: {
    reset: "reset",
  },
} as const;
