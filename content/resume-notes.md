# Resume notes — information mine

Source of truth for section copy (research cards, project blurbs, hero). Extracted
from `RESUME_Neelay_Ranjan.pdf` on 2026-07-14.

**Not rendered anywhere on the site, and the PDF is deliberately not in `/public/`** —
the resume changes often, so this is a mine to pull facts from, not a linked artifact.
Re-extract when the PDF changes.

**Phone number intentionally omitted.** It's on the PDF but this repo is git-tracked and
Vercel-bound; no reason to publish it. Email/LinkedIn/GitHub below are already public.

---

## Identity

- **Email:** neelay.ranjan@outlook.com  ← the professional address; *not* the gmail in git config
- **LinkedIn:** linkedin.com/in/neelayranjan
- **GitHub:** github.com/nranjan1
- **Site:** neelayranjan.dev

## Professional summary (resume's own framing)

Generative-modeling researcher building diffusion systems for safety-critical,
data-scarce domains. First-authoring work where **x0 (flipped-objective) diffusion
priors and SAM-x0 refinement pipelines beat frontier foundation models (SAM)** on
vascular imaging in the ultra-low-data regime while retaining computational
efficiency, and applying the same data-efficient generative approach to real-time
aircraft hazard-avoidance routing at NASA. Focus on **modular & interpretable
pipelines**, from segmentation to on-device inference at milliwatt power budgets.

> Note: the site tagline currently reads "diffusion for safety-critical, data-scarce
> domains" — consistent with this.

## Education

Purdue University, College of Engineering — Indianapolis, IN
B.S. Artificial Intelligence · Concentration: Intelligent Control & Systems · Minor: Mathematics
Expected December 2026 · GPA 3.7/4.0
John Martinson Honors College · Dean's List · CITI Certified (Biomedical Research)
U.S. Citizen (Clearance-Eligible)

## Publications

1. "Data-Efficient Vascular Segmentation via x0 Diffusion Priors: Surpassing
   Foundation Models in Ultra-Low-Data Regimes." N. Ranjan et al. *First author, in preparation.*
2. "A Modular SAM-Prior Diffusion Refinement Pipeline for Real-World Angiogram
   Segmentation." N. Ranjan et al. *First author, in preparation.*
3. "Seven-Shot Cerebral Vessel Segmentation: Low-Data Diffusion Refinement for
   Moyamoya MRA." N. Ranjan et al. *First author, in preparation.*
4. "Helical Antenna for Electromagnetic Field Stimulation in Alzheimer's Disease
   Therapy." *Accepted, IEEE MWSCAS 2026.* Led the PCB design team.

> Three of four are "in preparation" — decide how to present unpublished work on a
> public site before these go into research cards.

## Experience

### NASA Ames Research Center — May 2026 to present
*AI/ML Applied Research Intern, Generative Trajectory Modeling & Mass-Synthesis*
Moffett Field / Mountain View, CA

- Weather- and hazard-aware aircraft routing with diffusion models on FAA radar-track
  (TRX) data; generates flyable trajectories within **~11 nm (Fréchet)** of filed
  routes that avoid special-use airspace and launch-related hazard zones, for rapid
  emergency rerouting.
- **Mid-sampling gradient-guidance step** steering the diffusion trajectory around
  airspace hazards at inference time — hazard rerouting with **no retraining and no
  new data**.
- (In progress) An **LLM with a novel token vocabulary that "speaks" filed flight
  plans**, synthesizing a full day of **~44,000 FAA-managed flights** matched to the
  density/frequency of historical and projected traffic, for capacity and safety
  studies on US airspace failure modes.

### Regenstrief Institute — Feb 2024 to present
*Computer Vision & Generative Modeling Researcher* · Indianapolis, IN

- **x0 flipped-objective diffusion segmenter outperforms SAM** on benchmark angiogram
  segmentation in ultra-low-data regimes: **80% Dice vs SAM's 73% at just 19 labeled
  images** — establishing diffusion priors as a data-efficient alternative to large
  pretrained encoders.
- **SAM-x0 tiled refinement pipeline** (SAM prior + x0 diffusion refiner) for
  region-agnostic angiograms at native 1024 resolution: **70% Dice at 22 train
  images**, beating both SAM (46%) and raw x0 (32%), retaining full-res performance
  at partial-res compute cost.
- Adapted to cerebral **moyamoya MRA**: vasculature from only **7 annotated training
  examples** (~55% Dice) via patient-level cross-validation and aggressive tiling
  augmentation.

## Projects

### Energy-based model for chess — distilled solar-powered inference device (April 2026)
- Trained an EBM that learns an energy landscape over chess positions to sample and
  score moves. **~2000 Elo conservative / ~2330 ±41 nominal** (int8 build, 500 sims,
  0.5s/move Stockfish ladder, 2026-07-15); scored 52.5% vs a nominal SF-2500 rung.
- Distilled and embedded the EBM on a custom ultra-low-power **RP 2W board (~1s/move)**
  for a standalone interactive chess unit running fully on-device, **powered solely by
  onboard solar**.
- Backstory: v1 ran on an ESP32 at ~1450 Elo and was lost entirely, no backups. v2 is
  the rebuild, and is now stronger than its author.

> **Elo — settled 2026-07-15.** This was contradictory for a while: the resume said
> ~2250, while `ARCHITECTURE.md` (2026-07-14) said "defensible ~1850-2000" because the
> ladder's rungs were compressed. `entropy-chess/docs/2026-07-15-elo-ladder.md` re-ran it
> at 0.5s/move and supersedes both.
>
> **Say "roughly 2000-2300", or "master-ish vs Stockfish's limited modes". Do NOT claim
> 2300+ flat** — rung labels compress, and the honest range is the point. Quantization
> cost ~0 Elo, so the 553KB int8 build is as strong as the fp32 one.

### LLM design team lead — aircraft maintenance assistant (V2X), Aug 2024 – May 2025
- Led design and fine-tuning of a maintenance-assistant LLM; two-stage RAG pipeline
  (summary-level source selection → section-level pinpointing with direct quoting)
  cut hallucinations from **~40% to ~5%**.

## Technical skills

- **Languages:** Python, C++, Embedded C, Bash, SQL; NumPy, Pandas, SciPy, Matplotlib, Jupyter
- **ML & CV:** PyTorch, HuggingFace (Transformers, Diffusers, PEFT), scikit-learn, OpenCV;
  deep learning, computer vision, generative modeling, diffusion & energy-based models,
  CNNs, image segmentation, medical image analysis, self-supervised & contrastive
  learning, transfer learning, LLM fine-tuning (LoRA), RAG, agentic LLMs / MCP, model
  evaluation & ablation
- **Infrastructure:** Git, Linux, Docker, CUDA, multi-GPU distributed training
  (NVIDIA H100 NVL), SLURM, Weights & Biases, LaTeX
- **Hardware & edge:** PCB design, embedded ML, on-device / ultra-low-power inference,
  quantization, knowledge distillation, ESP32, Raspberry Pi, C firmware
