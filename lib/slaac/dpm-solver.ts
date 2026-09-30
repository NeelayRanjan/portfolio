/** DPM-Solver++ multistep, ported from diffusers 0.38.0
 *  `schedulers/scheduling_dpmsolver_multistep.py` (DPMSolverMultistepScheduler,
 *  plus its module-level `betas_for_alpha_bar` and `rescale_zero_terminal_snr`)
 *  for EXACTLY the rerouter's config in public/slaac/meta.json: 1000 train
 *  steps, squaredcos_cap_v2, rescale_betas_zero_snr, trailing spacing,
 *  v_prediction, dpmsolver++, order 2, midpoint, lower_order_final,
 *  final_sigmas_type "zero". Any other config throws rather than silently
 *  running a branch that was never ported.
 *
 *  Precision: diffusers keeps betas, alphas_cumprod and the inference sigmas
 *  as float32 tensors, so the schedule is rounded through Math.fround at the
 *  same points; the per-step arithmetic runs in float64 on those float32
 *  sigmas and the result is returned as float32 (diffusers upcasts the sample
 *  to float32 and casts prev_sample back to the model output's dtype).
 *  Pinned per step by scripts/test-slaac-dpm.mjs. No imports, on purpose. */

export type DpmConfig = {
  num_train_timesteps: number;
  beta_schedule: "squaredcos_cap_v2";
  rescale_betas_zero_snr: boolean;
  timestep_spacing: "trailing";
  prediction_type: "v_prediction";
  algorithm_type: "dpmsolver++";
  solver_order: 2;
  solver_type: "midpoint";
  lower_order_final: boolean;
  final_sigmas_type: "zero";
};

const f32 = Math.fround;

/** betas_for_alpha_bar(T, max_beta=0.999, "cosine"): computed in Python
 *  floats (float64), then torch.tensor(..., dtype=float32). */
function cosineBetas(T: number): Float64Array {
  const alphaBar = (t: number) => Math.cos(((t + 0.008) / 1.008) * Math.PI / 2) ** 2;
  const betas = new Float64Array(T);
  for (let i = 0; i < T; i++) {
    const t1 = i / T, t2 = (i + 1) / T;
    betas[i] = f32(Math.min(1 - alphaBar(t2) / alphaBar(t1), 0.999));
  }
  return betas;
}

/** torch.cumprod on a float32 CPU tensor: the running product is accumulated
 *  in float64 (torch's acc_type for float on CPU) and each output is rounded
 *  to float32. Measured: this matches torch bitwise on all 1000 entries, a
 *  float32 running product matches on 9. */
function cumprod32(a: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  let acc = 1;
  for (let i = 0; i < a.length; i++) {
    acc *= a[i];
    out[i] = f32(acc);
  }
  return out;
}

/** rescale_zero_terminal_snr(betas), every tensor op in float32. */
function rescaleZeroTerminalSnr(betas: Float64Array): Float64Array {
  const T = betas.length;
  const alphas = betas.map((b) => f32(1 - b));
  const ac = cumprod32(alphas);
  const sq = ac.map((v) => f32(Math.sqrt(v)));
  const s0 = sq[0], sT = sq[T - 1];
  const scale = f32(s0 / f32(s0 - sT));
  for (let i = 0; i < T; i++) sq[i] = f32(f32(sq[i] - sT) * scale);
  const bar = sq.map((v) => f32(v * v));
  const out = new Float64Array(T);
  out[0] = f32(1 - bar[0]);
  for (let i = 1; i < T; i++) out[i] = f32(1 - f32(bar[i] / bar[i - 1]));
  return out;
}

/** np.round: round half to even. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** _sigma_to_alpha_sigma_t for a VP (non-flow) schedule. */
function alphaSigma(sigma: number): [number, number] {
  const alpha = 1 / Math.sqrt(sigma * sigma + 1);
  return [alpha, sigma * alpha];
}

export class DpmSolver {
  readonly alphasCumprod: Float64Array;
  timesteps: number[] = [];
  private readonly trainSigmas: Float64Array;
  private sigmas: Float64Array = new Float64Array(0);
  private modelOutputs: (Float64Array | null)[] = [null, null];
  private lowerOrderNums = 0;
  private stepIndex: number | null = null;
  private readonly T: number;

  constructor(cfg: DpmConfig) {
    const want: Record<string, unknown> = {
      beta_schedule: "squaredcos_cap_v2",
      rescale_betas_zero_snr: true,
      timestep_spacing: "trailing",
      prediction_type: "v_prediction",
      algorithm_type: "dpmsolver++",
      solver_order: 2,
      solver_type: "midpoint",
      lower_order_final: true,
      final_sigmas_type: "zero",
    };
    for (const [k, v] of Object.entries(want)) {
      if ((cfg as Record<string, unknown>)[k] !== v) {
        throw new Error(`DpmSolver: ${k}=${JSON.stringify((cfg as Record<string, unknown>)[k])} is not ported (only ${JSON.stringify(v)})`);
      }
    }
    if (!Number.isInteger(cfg.num_train_timesteps) || cfg.num_train_timesteps < 2) {
      throw new Error(`DpmSolver: bad num_train_timesteps ${cfg.num_train_timesteps}`);
    }
    this.T = cfg.num_train_timesteps;

    const betas = rescaleZeroTerminalSnr(cosineBetas(this.T));
    const ac = cumprod32(betas.map((b) => f32(1 - b)));
    // "Close to 0 without being 0 so first sigma is not inf" (diffusers).
    ac[this.T - 1] = 2 ** -24;
    this.alphasCumprod = ac;
    // ((1 - alphas_cumprod) / alphas_cumprod) ** 0.5, float32 tensor ops.
    this.trainSigmas = ac.map((a) => f32(Math.sqrt(f32(f32(1 - a) / a))));
  }

  setTimesteps(steps: number): void {
    if (!Number.isInteger(steps) || steps < 1) throw new Error(`DpmSolver: bad step count ${steps}`);
    // lambda_min_clipped is -inf by default, so clipped_idx = 0 and
    // last_timestep = num_train_timesteps.
    const last = this.T;
    const ratio = this.T / steps;
    // np.arange(last, 0, -ratio): length ceil((0 - last) / -ratio), filled
    // the way numpy's float fill does it, a[i] = start + i * (a[1] - a[0]),
    // whose delta differs from -ratio by a rounding. That difference moves a
    // half-way value off .5 and changes the rounded timestep (48, 96 and 112
    // steps all differ if the plain start + i * -ratio is used).
    const n = Math.ceil((0 - last) / -ratio);
    const delta = (last + -ratio) - last;
    const ts: number[] = [];
    for (let i = 0; i < n; i++) ts.push(roundHalfEven(i === 0 ? last : last + i * delta) - 1);
    // np.interp at integer timesteps picks the stored float32 sigma exactly,
    // and clamps outside [0, T-1]: some step counts (61, 103 measured) make
    // arange one element long and diffusers' last timestep is -1, which
    // np.interp maps to sigmas[0]. final_sigmas_type "zero" appends 0.
    const sig = new Float64Array(ts.length + 1);
    ts.forEach((t, i) => (sig[i] = this.trainSigmas[Math.min(Math.max(t, 0), this.T - 1)]));
    sig[ts.length] = 0;
    this.timesteps = ts;
    this.sigmas = sig;
    this.modelOutputs = [null, null];
    this.lowerOrderNums = 0;
    this.stepIndex = null;
  }

  /** index_for_timestep: the second match if duplicated, the last index if absent. */
  private indexFor(timestep: number): number {
    const hits: number[] = [];
    this.timesteps.forEach((t, i) => { if (t === timestep) hits.push(i); });
    if (hits.length === 0) return this.timesteps.length - 1;
    return hits.length > 1 ? hits[1] : hits[0];
  }

  step(modelOutput: Float32Array, timestep: number, sample: Float32Array): Float32Array {
    if (this.timesteps.length === 0) throw new Error("DpmSolver: call setTimesteps first");
    if (modelOutput.length !== sample.length) throw new Error("DpmSolver: shape mismatch");
    if (this.stepIndex === null) this.stepIndex = this.indexFor(timestep);
    const i = this.stepIndex;
    if (i + 1 >= this.sigmas.length) throw new Error("DpmSolver: stepped past the schedule");

    // final_sigmas_type "zero" always forces first order on the last step.
    const lowerOrderFinal = i === this.timesteps.length - 1;

    // convert_model_output, dpmsolver++ + v_prediction: x0 = a*x - s*v.
    const [a0, s0] = alphaSigma(this.sigmas[i]);
    const x0 = new Float64Array(sample.length);
    for (let k = 0; k < x0.length; k++) x0[k] = f32(a0 * sample[k] - s0 * modelOutput[k]);
    this.modelOutputs[0] = this.modelOutputs[1];
    this.modelOutputs[1] = x0;

    const [alphaT, sigmaT] = alphaSigma(this.sigmas[i + 1]);
    const lambdaT = Math.log(alphaT) - Math.log(sigmaT);
    const lambdaS0 = Math.log(a0) - Math.log(s0);
    const h = lambdaT - lambdaS0;
    const cSample = sigmaT / s0;
    const cD = alphaT * (Math.exp(-h) - 1.0);
    const out = new Float32Array(sample.length);

    if (this.lowerOrderNums < 1 || lowerOrderFinal) {
      // dpm_solver_first_order_update
      for (let k = 0; k < out.length; k++) out[k] = cSample * sample[k] - cD * x0[k];
    } else {
      // multistep_dpm_solver_second_order_update, midpoint
      const [a1, s1] = alphaSigma(this.sigmas[i - 1]);
      const lambdaS1 = Math.log(a1) - Math.log(s1);
      const r0 = (lambdaS0 - lambdaS1) / h;
      const m0 = x0, m1 = this.modelOutputs[0]!;
      for (let k = 0; k < out.length; k++) {
        const d1 = (1.0 / r0) * (m0[k] - m1[k]);
        out[k] = cSample * sample[k] - cD * m0[k] - 0.5 * cD * d1;
      }
    }

    if (this.lowerOrderNums < 2) this.lowerOrderNums += 1;
    this.stepIndex = i + 1;
    return out;
  }
}
