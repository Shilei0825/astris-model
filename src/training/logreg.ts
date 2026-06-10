/**
 * Pure-JS logistic regression.
 *
 * Batch gradient descent with L2 regularization. No dependencies. Fast
 * enough on the dataset sizes we'll see (a few thousand placements is
 * tens of milliseconds for ~50 epochs of ~12 features).
 *
 * Persists as a tiny JSON object that fits in registry.metrics, so
 * inference (sigmoid(w·x + b)) can run in-process at score time without
 * loading a separate artifact.
 */

export interface LogregModel {
  /** Weight per feature, aligned with featureNames */
  weights: number[];
  bias: number;
  featureNames: string[];
  nSamples: number;
  /** Held-out AUC on a 20% test split. null if too few positives/negatives. */
  validationAuc: number | null;
  /** Mean prediction on the training set — for sanity checks */
  meanPrediction: number;
  /** What label this model predicts. e.g. "hit90Days", "hit365Days". */
  target: string;
}

export interface TrainOptions {
  learningRate?: number;
  epochs?: number;
  l2?: number;
  /** Fraction held out for the validation AUC. */
  testSplit?: number;
  /** Optional RNG seed for reproducible splits. */
  seed?: number;
}

export function trainLogreg(
  X: number[][],
  y: number[],
  featureNames: string[],
  target: string,
  opts: TrainOptions = {}
): LogregModel {
  const lr = opts.learningRate ?? 0.05;
  const epochs = opts.epochs ?? 500;
  const l2 = opts.l2 ?? 0.01;
  const testSplit = opts.testSplit ?? 0.2;
  const rng = mulberry32(opts.seed ?? 42);

  // Shuffle + split
  const indices = X.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const testN = Math.max(0, Math.floor(X.length * testSplit));
  const trainIdx = indices.slice(testN);
  const testIdx = indices.slice(0, testN);

  const XT = trainIdx.map((i) => X[i]);
  const yT = trainIdx.map((i) => y[i]);

  const n = XT.length;
  const m = featureNames.length;
  if (n === 0 || m === 0) {
    return {
      weights: new Array(m).fill(0),
      bias: 0,
      featureNames,
      nSamples: 0,
      validationAuc: null,
      meanPrediction: 0,
      target,
    };
  }

  // Feature standardization — keeps gradient descent well-conditioned.
  const mean = new Array(m).fill(0);
  const std = new Array(m).fill(1);
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += XT[i][j];
    mean[j] = s / n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (XT[i][j] - mean[j]) ** 2;
    std[j] = Math.sqrt(v / n) || 1;
  }
  const Xn = XT.map((row) => row.map((x, j) => (x - mean[j]) / std[j]));

  let w = new Array(m).fill(0);
  let b = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gW = new Array(m).fill(0);
    let gB = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < m; j++) z += Xn[i][j] * w[j];
      const p = sigmoid(z);
      const err = p - yT[i];
      for (let j = 0; j < m; j++) gW[j] += err * Xn[i][j];
      gB += err;
    }
    for (let j = 0; j < m; j++) w[j] -= lr * (gW[j] / n + l2 * w[j]);
    b -= (lr * gB) / n;
  }

  // Fold standardization back into the raw weights so callers can score
  // un-normalized inputs at inference time.
  const rawWeights = w.map((wj, j) => wj / std[j]);
  const rawBias = w.reduce((acc, wj, j) => acc - (wj * mean[j]) / std[j], b);

  // Validation AUC on held-out
  let auc: number | null = null;
  if (testN > 0) {
    const scores = testIdx.map((i) => predictProb(X[i], rawWeights, rawBias));
    auc = computeAuc(scores, testIdx.map((i) => y[i]));
  }

  const trainScores = X.map((row) => predictProb(row, rawWeights, rawBias));
  const meanPred = trainScores.reduce((a, b) => a + b, 0) / trainScores.length;

  return {
    weights: rawWeights,
    bias: rawBias,
    featureNames,
    nSamples: n,
    validationAuc: auc,
    meanPrediction: meanPred,
    target,
  };
}

/** Score a single feature vector — used at inference time. */
export function predictProb(x: number[], weights: number[], bias: number): number {
  let z = bias;
  for (let j = 0; j < weights.length; j++) z += x[j] * weights[j];
  return sigmoid(z);
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function computeAuc(scores: number[], labels: number[]): number | null {
  let pos = 0;
  let neg = 0;
  for (const l of labels) {
    if (l === 1) pos++;
    else neg++;
  }
  if (pos === 0 || neg === 0) return null;
  const pairs = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  let cumNeg = 0;
  let auc = 0;
  for (const p of pairs) {
    if (p.y === 0) cumNeg++;
    else auc += cumNeg;
  }
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
