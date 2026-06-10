/**
 * Pure-JS gradient-boosted decision tree classifier (XGBoost-flavor).
 *
 * Trees are fit sequentially against the negative gradient of the
 * log-loss. Splits chosen by XGBoost's gain formula
 *   gain = G_L^2/(H_L + λ) + G_R^2/(H_R + λ) - G^2/(H + λ)
 * Leaves store
 *   w* = -G/(H + λ)
 * Persisted as serializable JSON (tree node objects) into
 * astris_model_registry.metrics so inference is in-process.
 *
 * Not as fast as the real XGBoost — no column or row subsampling, no
 * histogram-based split-finding. Adequate for thousands of placement
 * outcomes with ~15 features.
 */

export interface TreeNode {
  /** Split feature index (internal node only) */
  f?: number;
  /** Split threshold; left if x[f] <= t (internal node only) */
  t?: number;
  /** Left child (internal node only) */
  l?: TreeNode;
  /** Right child (internal node only) */
  r?: TreeNode;
  /** Leaf value — added to the running logit prediction */
  v?: number;
}

export interface GbdtModel {
  trees: TreeNode[];
  /** Initial logit (log-odds of the training positive rate) */
  bias: number;
  learningRate: number;
  featureNames: string[];
  nSamples: number;
  validationAuc: number | null;
  meanPrediction: number;
  target: string;
  hyperparams: {
    numTrees: number;
    maxDepth: number;
    minSamplesLeaf: number;
    l2: number;
  };
}

export interface GbdtOptions {
  numTrees?: number;
  learningRate?: number;
  maxDepth?: number;
  minSamplesLeaf?: number;
  l2?: number;
  testSplit?: number;
  seed?: number;
}

export function trainGbdt(
  X: number[][],
  y: number[],
  featureNames: string[],
  target: string,
  opts: GbdtOptions = {}
): GbdtModel {
  const numTrees = opts.numTrees ?? 50;
  const learningRate = opts.learningRate ?? 0.1;
  const maxDepth = opts.maxDepth ?? 4;
  const minSamplesLeaf = opts.minSamplesLeaf ?? 5;
  const l2 = opts.l2 ?? 1.0;
  const testSplit = opts.testSplit ?? 0.2;
  const rng = mulberry32(opts.seed ?? 42);

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

  // Initial bias = logit(positive rate). Clamp away from 0/1 to avoid
  // ±Infinity when one class is rare.
  const pos = yT.reduce((s, v) => s + v, 0);
  const total = yT.length;
  const p0 = clamp((pos + 1) / (total + 2), 1e-3, 1 - 1e-3);
  const bias = Math.log(p0 / (1 - p0));

  const predictions = new Array(XT.length).fill(bias);
  const trees: TreeNode[] = [];

  for (let t = 0; t < numTrees; t++) {
    const gradients = new Array(XT.length);
    const hessians = new Array(XT.length);
    for (let i = 0; i < XT.length; i++) {
      const p = sigmoid(predictions[i]);
      gradients[i] = p - yT[i];
      hessians[i] = p * (1 - p);
    }
    const tree = fitTree(XT, gradients, hessians, maxDepth, minSamplesLeaf, l2);
    trees.push(tree);
    for (let i = 0; i < XT.length; i++) {
      predictions[i] += learningRate * predictTree(XT[i], tree);
    }
  }

  const partialModel: GbdtModel = {
    trees,
    bias,
    learningRate,
    featureNames,
    nSamples: XT.length,
    validationAuc: null,
    meanPrediction: 0,
    target,
    hyperparams: { numTrees, maxDepth, minSamplesLeaf, l2 },
  };

  let validationAuc: number | null = null;
  if (testN > 0) {
    const scores = testIdx.map((i) => predictGbdtProb(X[i], partialModel));
    validationAuc = computeAuc(scores, testIdx.map((i) => y[i]));
  }

  const trainScores = X.map((row) => predictGbdtProb(row, partialModel));
  const meanPred = trainScores.reduce((a, b) => a + b, 0) / trainScores.length;

  return { ...partialModel, validationAuc, meanPrediction: meanPred };
}

/** Score with a fitted GBDT model. */
export function predictGbdtProb(x: number[], model: GbdtModel): number {
  let logit = model.bias;
  for (const tree of model.trees) {
    logit += model.learningRate * predictTree(x, tree);
  }
  return sigmoid(logit);
}

/* ───────── tree building ───────── */

function fitTree(
  X: number[][],
  gradients: number[],
  hessians: number[],
  maxDepth: number,
  minSamplesLeaf: number,
  l2: number
): TreeNode {
  const allIndices = X.map((_, i) => i);
  return buildNode(X, gradients, hessians, allIndices, 0, maxDepth, minSamplesLeaf, l2);
}

function buildNode(
  X: number[][],
  gradients: number[],
  hessians: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesLeaf: number,
  l2: number
): TreeNode {
  // Leaf-ify when we hit depth or can't split.
  if (depth >= maxDepth || indices.length <= minSamplesLeaf * 2) {
    return makeLeaf(gradients, hessians, indices, l2);
  }

  const split = findBestSplit(X, gradients, hessians, indices, minSamplesLeaf, l2);
  if (!split) return makeLeaf(gradients, hessians, indices, l2);

  return {
    f: split.feature,
    t: split.threshold,
    l: buildNode(X, gradients, hessians, split.left, depth + 1, maxDepth, minSamplesLeaf, l2),
    r: buildNode(X, gradients, hessians, split.right, depth + 1, maxDepth, minSamplesLeaf, l2),
  };
}

function makeLeaf(gradients: number[], hessians: number[], indices: number[], l2: number): TreeNode {
  let sumG = 0;
  let sumH = 0;
  for (const i of indices) {
    sumG += gradients[i];
    sumH += hessians[i];
  }
  return { v: -sumG / (sumH + l2) };
}

function findBestSplit(
  X: number[][],
  gradients: number[],
  hessians: number[],
  indices: number[],
  minSamplesLeaf: number,
  l2: number
): { feature: number; threshold: number; left: number[]; right: number[] } | null {
  const numFeatures = X[0].length;

  let totalG = 0;
  let totalH = 0;
  for (const i of indices) {
    totalG += gradients[i];
    totalH += hessians[i];
  }

  let best: { feature: number; threshold: number; gain: number; left: number[]; right: number[] } | null = null;

  for (let f = 0; f < numFeatures; f++) {
    // Sort indices by this feature value
    const sorted = [...indices].sort((a, b) => X[a][f] - X[b][f]);
    let leftG = 0;
    let leftH = 0;
    for (let k = 0; k < sorted.length - 1; k++) {
      leftG += gradients[sorted[k]];
      leftH += hessians[sorted[k]];
      // Only consider split points between distinct feature values
      if (X[sorted[k]][f] === X[sorted[k + 1]][f]) continue;
      const leftN = k + 1;
      const rightN = sorted.length - leftN;
      if (leftN < minSamplesLeaf || rightN < minSamplesLeaf) continue;
      const rightG = totalG - leftG;
      const rightH = totalH - leftH;
      const gain =
        (leftG * leftG) / (leftH + l2) +
        (rightG * rightG) / (rightH + l2) -
        (totalG * totalG) / (totalH + l2);
      if (!best || gain > best.gain) {
        const threshold = (X[sorted[k]][f] + X[sorted[k + 1]][f]) / 2;
        best = {
          feature: f,
          threshold,
          gain,
          left: sorted.slice(0, leftN),
          right: sorted.slice(leftN),
        };
      }
    }
  }

  if (!best || best.gain <= 0) return null;
  return { feature: best.feature, threshold: best.threshold, left: best.left, right: best.right };
}

function predictTree(x: number[], node: TreeNode): number {
  if (node.v !== undefined) return node.v;
  if (node.f === undefined || node.t === undefined) return 0;
  return x[node.f] <= node.t
    ? predictTree(x, node.l ?? { v: 0 })
    : predictTree(x, node.r ?? { v: 0 });
}

/* ───────── helpers ───────── */

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
