/**
 * Pure-JS multi-layer perceptron (MLP) classifier.
 *
 * Trained with minibatch stochastic gradient descent + Adam optimizer
 * for binary classification with sigmoid output. Persisted as
 * serializable JSON (weights + biases per layer) into
 * astris_model_registry.metrics so inference is in-process — no
 * Python, no native deps, no model-server roundtrip.
 *
 * Architecture (configurable):
 *   - Input layer  : numFeatures neurons
 *   - Hidden layer(s) : ReLU activation, He initialization
 *   - Output layer : single sigmoid neuron (binary log-loss)
 *
 * Default: 1 hidden layer of 16 neurons. Capacity tuned for our
 * ~15-feature retention modeling task — bigger doesn't help with
 * a few hundred examples.
 *
 * For multi-output prediction (the 4 retention milestones), train
 * four MLPs in parallel — same architecture, different labels —
 * and bundle. See trainRetentionMlpBundle() in retention-mlp.ts.
 *
 * Not as fast as PyTorch — no GPU acceleration, no vectorized BLAS.
 * Adequate for thousands of placement outcomes with ≤30 features.
 */

export interface MlpModel {
  /** Number of input features */
  numFeatures: number;
  /** Hidden layer sizes — e.g. [16] = one hidden layer of 16 neurons */
  hiddenSizes: number[];
  /** Per-layer weights: shape [outputs][inputs] */
  weights: number[][][];
  /** Per-layer biases: shape [outputs] */
  biases: number[][];
  /** Feature names — must match the input vector positions */
  featureNames: string[];
  /** What we trained against (the binary label column) */
  target: string;
  /** Mean of training labels — useful sanity check for inference */
  meanPrediction: number;
  /** Held-out validation AUC if a test split was used */
  validationAuc: number | null;
  /** Size of the training set used */
  nSamples: number;
  hyperparams: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    l2: number;
    hiddenSizes: number[];
  };
}

export interface MlpOptions {
  hiddenSizes?: number[];
  learningRate?: number;
  batchSize?: number;
  epochs?: number;
  /** L2 weight-decay coefficient */
  l2?: number;
  /** Held-out test split share (0–0.5) for AUC */
  testSplit?: number;
  seed?: number;
}

export function trainMlp(
  X: number[][],
  y: number[],
  featureNames: string[],
  target: string,
  opts: MlpOptions = {},
): MlpModel {
  const hiddenSizes = opts.hiddenSizes ?? [16];
  const learningRate = opts.learningRate ?? 0.01;
  const batchSize = opts.batchSize ?? Math.min(32, X.length);
  const epochs = opts.epochs ?? 200;
  const l2 = opts.l2 ?? 0.001;
  const testSplit = opts.testSplit ?? 0.2;
  const rng = mulberry32(opts.seed ?? 42);

  // Train/test split
  const idx = X.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const testN = Math.max(0, Math.floor(X.length * testSplit));
  const trainIdx = idx.slice(testN);
  const testIdx = idx.slice(0, testN);

  const XT = trainIdx.map((i) => X[i]);
  const yT = trainIdx.map((i) => y[i]);

  // Initialize parameters with He init for ReLU layers
  const numFeatures = X[0].length;
  const layerSizes = [numFeatures, ...hiddenSizes, 1];
  const weights: number[][][] = [];
  const biases: number[][] = [];
  for (let L = 0; L < layerSizes.length - 1; L++) {
    const fanIn = layerSizes[L];
    const fanOut = layerSizes[L + 1];
    const w: number[][] = [];
    for (let i = 0; i < fanOut; i++) {
      const row: number[] = [];
      const scale = Math.sqrt(2 / fanIn);
      for (let j = 0; j < fanIn; j++) row.push((rng() * 2 - 1) * scale);
      w.push(row);
    }
    weights.push(w);
    biases.push(new Array(fanOut).fill(0));
  }

  // Adam optimizer state
  const mW = weights.map((w) => w.map((row) => row.map(() => 0)));
  const vW = weights.map((w) => w.map((row) => row.map(() => 0)));
  const mB = biases.map((b) => b.map(() => 0));
  const vB = biases.map((b) => b.map(() => 0));
  const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
  let step = 0;

  // Train
  for (let epoch = 0; epoch < epochs; epoch++) {
    // Shuffle each epoch
    for (let i = XT.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [XT[i], XT[j]] = [XT[j], XT[i]];
      [yT[i], yT[j]] = [yT[j], yT[i]];
    }
    for (let b = 0; b < XT.length; b += batchSize) {
      step += 1;
      const bs = Math.min(batchSize, XT.length - b);
      const dW = weights.map((w) => w.map((row) => row.map(() => 0)));
      const dB = biases.map((bb) => bb.map(() => 0));

      // Accumulate gradients across the minibatch via per-sample
      // forward + backward.
      for (let s = 0; s < bs; s++) {
        const x = XT[b + s];
        const label = yT[b + s];
        const { activations, preActivations } = forward(x, weights, biases);
        // Output gradient: dL/dz_out = sigmoid(z_out) - y
        const yhat = activations[activations.length - 1][0];
        let delta: number[] = [yhat - label];
        for (let L = weights.length - 1; L >= 0; L--) {
          const aPrev = activations[L];
          // Accumulate weight gradient: dW[L][i][j] += delta[i] * aPrev[j]
          for (let i = 0; i < weights[L].length; i++) {
            const di = delta[i];
            dB[L][i] += di;
            for (let j = 0; j < aPrev.length; j++) dW[L][i][j] += di * aPrev[j];
          }
          // Propagate delta back through ReLU of preActivations[L-1]
          if (L > 0) {
            const newDelta: number[] = new Array(aPrev.length).fill(0);
            for (let j = 0; j < aPrev.length; j++) {
              let s = 0;
              for (let i = 0; i < weights[L].length; i++) s += weights[L][i][j] * delta[i];
              // ReLU derivative = 1 if preActivation > 0 else 0
              newDelta[j] = preActivations[L - 1][j] > 0 ? s : 0;
            }
            delta = newDelta;
          }
        }
      }

      // Adam update
      for (let L = 0; L < weights.length; L++) {
        for (let i = 0; i < weights[L].length; i++) {
          for (let j = 0; j < weights[L][i].length; j++) {
            const g = dW[L][i][j] / bs + l2 * weights[L][i][j];
            mW[L][i][j] = beta1 * mW[L][i][j] + (1 - beta1) * g;
            vW[L][i][j] = beta2 * vW[L][i][j] + (1 - beta2) * g * g;
            const mhat = mW[L][i][j] / (1 - Math.pow(beta1, step));
            const vhat = vW[L][i][j] / (1 - Math.pow(beta2, step));
            weights[L][i][j] -= learningRate * mhat / (Math.sqrt(vhat) + eps);
          }
          const gb = dB[L][i] / bs;
          mB[L][i] = beta1 * mB[L][i] + (1 - beta1) * gb;
          vB[L][i] = beta2 * vB[L][i] + (1 - beta2) * gb * gb;
          const mhat = mB[L][i] / (1 - Math.pow(beta1, step));
          const vhat = vB[L][i] / (1 - Math.pow(beta2, step));
          biases[L][i] -= learningRate * mhat / (Math.sqrt(vhat) + eps);
        }
      }
    }
  }

  // Final inference + validation
  const trainPreds = XT.map((x) => predictMlpProb({ weights, biases } as MlpModel, x));
  const meanPrediction = trainPreds.reduce((a, b) => a + b, 0) / trainPreds.length;

  let validationAuc: number | null = null;
  if (testN > 0) {
    const partialModel = {
      weights, biases, numFeatures, hiddenSizes, featureNames, target,
      meanPrediction, validationAuc: null, nSamples: XT.length,
      hyperparams: { learningRate, batchSize, epochs, l2, hiddenSizes },
    };
    const scores = testIdx.map((i) => predictMlpProb(partialModel, X[i]));
    validationAuc = computeAuc(scores, testIdx.map((i) => y[i]));
  }

  return {
    numFeatures,
    hiddenSizes,
    weights,
    biases,
    featureNames,
    target,
    meanPrediction,
    validationAuc,
    nSamples: XT.length,
    hyperparams: { learningRate, batchSize, epochs, l2, hiddenSizes },
  };
}

/** Forward pass with all intermediate activations (for backprop). */
function forward(x: number[], weights: number[][][], biases: number[][]): { activations: number[][]; preActivations: number[][] } {
  const activations: number[][] = [x];
  const preActivations: number[][] = [];
  let a = x;
  for (let L = 0; L < weights.length; L++) {
    const isLast = L === weights.length - 1;
    const z: number[] = new Array(weights[L].length).fill(0);
    for (let i = 0; i < weights[L].length; i++) {
      let s = biases[L][i];
      for (let j = 0; j < weights[L][i].length; j++) s += weights[L][i][j] * a[j];
      z[i] = s;
    }
    preActivations.push(z);
    const aNext = isLast ? z.map(sigmoid) : z.map((v) => (v > 0 ? v : 0)); // ReLU on hidden, sigmoid on output
    activations.push(aNext);
    a = aNext;
  }
  return { activations, preActivations };
}

/** Inference: returns the sigmoid output probability. */
export function predictMlpProb(model: Pick<MlpModel, "weights" | "biases">, x: number[]): number {
  let a = x;
  for (let L = 0; L < model.weights.length; L++) {
    const isLast = L === model.weights.length - 1;
    const z: number[] = new Array(model.weights[L].length).fill(0);
    for (let i = 0; i < model.weights[L].length; i++) {
      let s = model.biases[L][i];
      for (let j = 0; j < model.weights[L][i].length; j++) s += model.weights[L][i][j] * a[j];
      z[i] = s;
    }
    a = isLast ? z.map(sigmoid) : z.map((v) => (v > 0 ? v : 0));
  }
  return a[0];
}

/* ───────── helpers ───────── */

function sigmoid(z: number): number {
  if (z >= 0) { const e = Math.exp(-z); return 1 / (1 + e); }
  const e = Math.exp(z);
  return e / (1 + e);
}

function computeAuc(scores: number[], labels: number[]): number | null {
  let pos = 0, neg = 0;
  for (const l of labels) { if (l === 1) pos++; else neg++; }
  if (pos === 0 || neg === 0) return null;
  const pairs = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  let cumNeg = 0, auc = 0;
  for (const p of pairs) { if (p.y === 0) cumNeg++; else auc += cumNeg; }
  return auc / (pos * neg);
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
