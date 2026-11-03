# The concepts site: planning record and start point

Started 2026-11-01. This is the durable record of a new, semi-separate site of
visual, interactive explainers of recent AI concepts. It is written so a later
session can plan and build one piece without re-deriving any of this. Update it
whenever a question below is answered or a rule changes; this file wins over
memory.

Status: SHELL BUILT on branch `offprints` (2026-11-01), unmerged; next: the
hybrid-attention figures' own spec and plan, then ship shell + piece together.
Sections marked OPEN are the owner's to answer.

What exists (branch `offprints`, not deployed, subdomain not bound):
- The shell spec, `docs/superpowers/specs/2026-11-01-offprints-shell-design.md`
  (§10 the settlements, §11 the interaction patterns), and its plan,
  `docs/superpowers/plans/2026-11-01-offprints-shell.md`.
- The site: `app/(offprints)/offprints/`, `proxy.ts` and `lib/offprints/host.ts`
  (host mapping), `components/offprints/` (Shell with the dog-ear peel, paper
  primitives), `lib/offprints/` (registry rules, feed, peel geometry),
  `content/offprints/` (registry and copy).
- Piece 1, hybrid attention, as a draft with Figure 1 only
  (`content/offprints/hybrid-attention/figure1.json`).
- Page 1's Offprints door and six `offprints-*` verify checks.
- The contract and the numbers are in CLAUDE.md, "Offprints" under the demos.

## 1. What it is

A set of pieces, each explaining one recent AI concept almost entirely through
interactive visuals. The owner's framing: "here are some of my recent favorite
topics", not a schedule. Motivation: a competent AI dev should be current and
able to explain hard concepts; "visualized CNN" pages are commodity, so the
subjects are the concepts driving attention and money now, and the owner's own
projection of whether each one matters gets recorded and later judged.

Reader: senior and experienced in the field, not a frontier researcher, falling
behind on developments. Ten minutes at most per piece, most of it spent playing
with demos, not reading.

## 2. Hard requirements (owner, 2026-11-01)

- Empirically NOT blog-formatted. A piece is one continuous visual, or a series
  of visuals the reader interacts with to understand. No wall of text, not even
  a paragraph where a visual can do the job. Example the owner gave: a sentence
  like "The cat jumped over the fence, while the dog violently crashed through
  it."; you highlight a token like "it" and see its Q (what am I asking for),
  K (who am I looking for) and V (what I have to offer), and every other token
  lights up or dims by its relation to it.
- Interactive is the default, not the exception. Visual heavy.
- Any necessary words go near the END, as a supplement.
- Each piece carries a "real-world relevance" section that grounds it: who is
  shipping it, why it is drawing attention and money.
- Each piece carries the owner's projection, useful or useless, at publish
  time. When the next piece is published, the previous one is revisited and
  stamped with how it aged against the truth. The owner likes this a lot.
- Own pace. No racing a release. A piece is done when it is published.
- The owner is fine publishing an "overhyped" verdict.
- Smaller concepts (RoPE, recent attention variants) qualify if the demo is
  good. Anything with an interactive demo is in.
- RSS feed yes. Comments: hard no. Newsletter: no.
- Its own look, semi-separate from the portfolio, with an easy and very
  prominent way to reach it from the portfolio.
- The portfolio's constitution carries over: never fake a model's output, a
  control is honest or absent, illustrative pieces are labelled illustrative,
  measure don't assume, mobile above all. A demo is real computation; where a
  real model is involved it runs client-side or its output is precomputed from
  the actual model and said so.
- The LLM-written-prose problem is handled by the visual-heavy approach; the
  little text there is still gets the voice rules (CLAUDE.md "Voice").

## 3. Theme and template (the current step)

Owner's brief (2026-11-01): off-white, paper-grained background. A simple
three-line icon at the left that opens a bar on the left listing all the
concepts. Choosing a concept should bump out like sliding another sheet of
paper out. Top right: the portfolio's icon, which goes back to the portfolio.
This site gets a different icon; the owner is open to buying a domain.

Continuity the portfolio offers (reuse or deliberately break, owner's call):
- Type: STIX Two Text (serif body) and Spline Sans Mono (labels, numbers),
  loaded through next/font. Character grids use Geist Mono by a measured rule.
- The paper grain: `[data-sheet]` in `app/globals.css` is an SVG fractal-noise
  tile (256px, baseFrequency 0.8, 3 octaves, `color-interpolation-filters=
  "sRGB"`) whose colour matrix is the paper token plus 0.1 x (noise - 0.5).
  The same technique with light tokens gives an off-white grain whose mean
  tone stays the paper colour.
- The stamp (`components/manuscript/Stamp.tsx`): the red rubber-stamp status
  mark. The projection stamp and the revisit stamp are its natural cousins.
- Colour conventions on the portfolio: green = x0/true active, red = SAM/
  reviewer's ink, amber = instrument readouts, link-blue = links. These are
  the portfolio's figure semantics; the concepts site may define its own.

DECIDED on 2026-11-01, from mockups in `.superpowers/brainstorm/` (gitignored):
- Name: **Offprints**, at the subdomain **offprints.neelayranjan.dev** (an
  offprint is a separately printed copy of one article, handed around).
  Build it in this repo as a route group with its own layout; map the
  subdomain to this Vercel project and route by host.
- Landing: the root shows the LATEST piece. The index lists pieces newest
  first (number, title, one-line claim, date, the call stamp, the revisit
  stamp once it exists).
- The paper IS the page: full-bleed off-white grain, one reading column
  (~720px), no desk, no visible stack, no side borders (the owner rejected
  a centred sheet on a desk and a visible stack of sheet edges: "clean and
  decluttered").
- Navigation: NO hamburger. A dog-ear at the top-left corner is the only
  control; at rest the page beneath shows through the small folded corner.
  APPROVED 2026-11-01 ("love it, looks great"), mockup
  `layout-dogear-v3.html`: a CLICK on the corner peels the sheet all the way
  (the fold sweeps diagonally across the page) and opens the index; a DRAG
  on the corner peels only as far as the pointer, so the reader can peek at
  the index beneath; release past ~40% of the way opens, earlier lays it
  back down. Quiet 3D: a flat fold with one soft shadow and a light crease
  (the owner asked for "a little less 3d" than the curled v2). Hover lifts
  the corner slightly. The index page lies under the sheet; choosing a piece
  peels its sheet back on. Escape closes. Rest 40px, hover 52px, slop 6px,
  650ms ease-out, reduced motion snaps.
  The portfolio's N mark sits top right and links home.
- Type: the portfolio's STIX Two Text + Spline Sans Mono.
- Phones: "watch it run" or prerendered rigid versions of a demo (the QKV
  example with fixed sentences) are acceptable where touch can't drive it.
- A fixed site-wide demo palette is still proposed (Q, K, V hues; one
  sequential ramp; the stamp red), to be validated with the dataviz
  validator before the first piece ships. Mockup values: ink #1d1b17 on
  paper #efebe3, under-page #e6e1d7, stamp #b9311f, Q #3f55c9, K #1e8468,
  V #b86a12.

Still OPEN: the Offprints icon (the dog-ear itself is the obvious candidate);
dog-ear corner stays top-left unless the owner says otherwise.

Proposed page template (not yet approved):
1. Title and one-line claim; the projection stamp with its date.
2. The chain of interactives, each with a one-line caption and one "try"
   nudge. The first one is the hero.
3. "Why it matters now": the real-world relevance.
4. "Words, if you want them": the supplement.
5. "Revisited": stamped when the next piece ships.
6. Sources.

## 4. The pieces: order and research so far

Order (owner): 1. hybrid attention, 2. JEPA, 3. Kev (public Kev; the
open-source clone Jev has a good write-up; one line on NASA use is worth it).

Research notes, 2026-11-01 (verify dates against primary sources before
publishing):

- Hybrid attention. Alibaba says Qwen3.8-Flash-Next (released 2026-08-26,
  arXiv 2608.30320) is the Qwen 4 architecture; Qwen 4 itself was unreleased
  as of 2026-11-01 (rumoured for the week of Nov 2). The architecture: Gated
  DeltaNet (GDN) layers and attention layers in a 3:1 pattern; the attention
  layers become Qwen Sparse Attention (QSA) in continued pretraining; a
  four-branch Gated Residual; a 51B-parameter n-gram embedding table kept in
  host memory; Muon. GDN per head: decay S~ = alpha_t S, error e = v - S~^T k,
  write S = S~ + beta_t k e^T, read y = S^T q, with q,k L2-normed after a
  short causal conv, beta = sigmoid(W_b x), alpha = exp(-exp(A) softplus(W_a x
  + b)). QSA: an MQA-style indexer (4 query heads of 128 dims, one shared key
  head), keys average-pooled in blocks of 4 tokens, score I_ib = sum_h
  ReLU(q_i^h . k_b), top 512 blocks (a 2048-token budget) selected; trained by
  KL to the dense teacher's block-pooled attention. No latent-reasoning
  mechanism in the paper; thinking mode is inherited from Qwen 3. The June
  2026 "Bridging the Gap..." paper found latent chain-of-thought losing to
  explicit chain-of-thought beyond 1B parameters.
- JEPA. AMI Labs (LeCun) raised a $1.03B seed in March 2026. LeJEPA (Nov
  2025) replaced anti-collapse heuristics with one regularizer, SIGReg
  (random 1D projections tested against a Gaussian). LeWorldModel (March
  2026) is a 15M-parameter JEPA world model trained end to end from pixels,
  two loss terms; small enough to run in a browser. Meta shipped V-JEPA 2.1
  (March 2026). Theory papers from AMI in May and June 2026.
- Kev. Jared Palmer's decision models (0.8B, 4B, 9B, 27B; September 2026),
  fine-tunes or LoRAs on Qwen bases. Reads a document plus typed questions
  (choice, score, yes/no) and returns a calibrated probability distribution
  over the supplied options; never generates text; temperature-scaled; the
  27B card reports ECE and admits its checkpoint was chosen after seeing test
  results. The owner used Kev as the ranker in NASA SHIFT's generate-and-rank
  parser (CLAUDE.md); any NASA mention is one line and should be cleared with
  the mentor first. Kev-0.8B and Kev-4B are in this machine's HF cache.
- Other candidates, ranked on 2026-11-01: diffusion language models (Mercury
  3 shipped 2026-10-19; the owner's specialty), Engram / n-gram conditional
  memory (DeepSeek, Jan 2026; now in Qwen3.8-Next), Muon (Kimi K2, GLM-5,
  DeepSeek V4), RL environments and GRPO (the biggest money story), interactive
  world models (Genie 3, Matrix-Game 3.5), manifold-constrained
  hyper-connections (DeepSeek V4), test-time training / Titans / Nested
  Learning, latent and looped reasoning (a contrarian piece), compressed-KV
  attention economics.

## 5. Assets already in hand for piece 1

`external_materials/concepts/hybrid-attention/` (gitignored, owner's machine):
- `extract.py`: runs Qwen/Qwen3.5-0.8B-Base (a real 3:1 GDN + attention
  hybrid, 24 layers, attention at 3, 7, 11, 15, 19, 23; 8 query heads, 2 KV
  heads, head dim 256; 16 GDN heads of dim 128) in the Brainworm venv
  (`~/Documents/Brainworm/.venv/bin/python`, torch 2.15 + transformers 5.22;
  the model is in the HF cache) on four sentences and writes
  `hybrid-data.json` (3.2 MB).
- The JSON holds, per sentence: tokens; every attention layer's per-head
  weights; post-RoPE q, k and raw v (256-d) for the three heads that put the
  most mass on the antecedents of a chosen pronoun; and for every GDN layer
  and head the exact "implicit attention" of the delta rule (a[t][j] =
  q_t . u_j^(t), where S_t = sum_j u_j^(t) v_j^T; checked against the
  recurrence at 1e-15), plus beta and alpha per token.
- Measured head picks: "it" in the cat sentence -> layer 7 head 1 puts 0.94
  of its mass on cat/fence/dog; "Germany" -> layer 7 head 4, 0.97.
- Reproduce with `python -I extract.py` from that directory (CPU, ~1 min).

## 6. Process rules for later sessions

- Brainstorm with the owner before building a piece; the owner answers
  questions in batches and prefers all thoughts at once.
- A piece needs a real artifact. Hardware available: this laptop (RTX 4070
  Laptop, 8 GB), a desktop with a 4070 Ti Super, a Modal subscription.
- Spikes are throwaway and say so; keeping one is a new decision.
- Measure in a real browser on a production build; headless Firefox is not a
  timing device (CLAUDE.md traps apply).

## 7. Prior art, reviewed 2026-11-01 (owner asked before settling the shell)

Three lineages, none of which is a paper OBJECT with demos-first and words
last; that combination is Offprints' open ground.
- The paper LOOK: Distill (2016-2021, indefinite hiatus; its template is
  open source; front matter, DOI, citation block, figures that break out of
  the text column; the hiatus post calls the format very labour-intensive),
  Anthropic's Transformer Circuits Thread (the Distill template reused, index
  by month, "paper"/"note" labels, active through Oct 2026), Tufte CSS and
  Gwern.net (margin notes, dropcaps, print typography), the arXiv "project
  page" template lineage (Nerfies and its forks: white page, centred title,
  author row, video hero, abstract; the most commodity look in ML and the one
  to avoid), the StyleKit "LaTeX paper" style spec.
- The INTERACTION lineage: Bartosz Ciechanowski (inline WebGL figures with
  sliders, but ~10k words a piece: the text ratio to avoid), bbycroft's LLM
  Visualization (one 3D scene, stepped walkthrough, almost no prose: the
  closest to the owner's intent), Polo Club's Transformer Explainer (a tool,
  not an article), Nicky Case and the explorables community (one paragraph
  per interaction, awesome-explorables list), The Pudding (numbered issues
  #226 in Oct 2026, scrollytelling, lowercase titles), Immersive Math and
  Seeing Theory (textbook chapters with fully interactive figures).
- The paper OBJECT: Niccolò Miranda's "Paper Portfolio" (a newspaper you
  drag sideways, project pages tear open; Webflow + GSAP, per Colorlib), the
  page-curl pattern from e-reader apps, folded-corner CSS techniques
  (Gallagher; Kitty Giraudel, March 2026). No site found uses a dog-ear as
  its navigation.
Risks noted: paper grain + serif can read as a Tufte-CSS clone or the "AI
cream" default (differentiate through the object metaphor, the stamps and
the real models); Distill's labour cost is the cadence warning in another
form.
