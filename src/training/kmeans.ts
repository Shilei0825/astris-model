/**
 * Pure-JS k-means clustering (Lloyd's algorithm).
 *
 * Used for cohort discovery — astris-cohort-kmeans-v1. Powers the
 * "find similar candidates" UX. Not in the composite match score.
 *
 * Initialization: k-means++ for cluster-center stability across reruns.
 * Distance: squared Euclidean. Standardized features (mean=0, std=1).
 * Centroids serialized as JSON so inference walks them in-process at
 * query time — no external artifact loader.
 */

export interface KMeansModel {
  /** k cluster centroids in standardized feature space. */
  centroids: number[][];
  /** Per-feature mean used for standardization at training time. */
  mean: number[];
  /** Per-feature std used for standardization at training time. */
  std: number[];
  featureNames: string[];
  /** Cluster sizes from the training fit (informational). */
  sizes: number[];
  /** Mean within-cluster sum of squared distances on the training set. */
  inertia: number;
  k: number;
  nSamples: number;
  iterations: number;
}

export interface KMeansOptions {
  k?: number;
  maxIter?: number;
  /** Tolerance on centroid movement to early-stop. */
  tol?: number;
  seed?: number;
}

export function trainKmeans(
  X: number[][],
  featureNames: string[],
  opts: KMeansOptions = {}
): KMeansModel {
  const k = Math.max(2, opts.k ?? 6);
  const maxIter = opts.maxIter ?? 100;
  const tol = opts.tol ?? 1e-4;
  const rng = mulberry32(opts.seed ?? 42);

  const n = X.length;
  const m = featureNames.length;
  if (n === 0 || m === 0) {
    return {
      centroids: [],
      mean: new Array(m).fill(0),
      std: new Array(m).fill(1),
      featureNames,
      sizes: [],
      inertia: 0,
      k,
      nSamples: 0,
      iterations: 0,
    };
  }

  // Standardize features so distances aren't dominated by high-variance dims.
  const mean = new Array(m).fill(0);
  const std = new Array(m).fill(1);
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += X[i][j];
    mean[j] = s / n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (X[i][j] - mean[j]) ** 2;
    std[j] = Math.sqrt(v / n) || 1;
  }
  const Xn = X.map((row) => row.map((x, j) => (x - mean[j]) / std[j]));

  // k-means++ init: pick the first centroid uniformly at random, then
  // each subsequent centroid weighted by squared distance from the
  // nearest already-chosen centroid.
  const centroids: number[][] = [];
  centroids.push(Xn[Math.floor(rng() * n)].slice());
  while (centroids.length < k) {
    const distances = Xn.map((x) => {
      let best = Infinity;
      for (const c of centroids) {
        const d = sqDist(x, c);
        if (d < best) best = d;
      }
      return best;
    });
    const total = distances.reduce((a, b) => a + b, 0);
    if (total === 0) {
      // All points are duplicates — degenerate. Pad with random points.
      centroids.push(Xn[Math.floor(rng() * n)].slice());
      continue;
    }
    let pick = rng() * total;
    for (let i = 0; i < distances.length; i++) {
      pick -= distances[i];
      if (pick <= 0) {
        centroids.push(Xn[i].slice());
        break;
      }
    }
  }

  const assignments = new Array(n).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let bestK = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = sqDist(Xn[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          bestK = c;
        }
      }
      if (assignments[i] !== bestK) {
        assignments[i] = bestK;
        moved++;
      }
    }

    const sums: number[][] = Array.from({ length: k }, () => new Array(m).fill(0));
    const counts: number[] = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c] += 1;
      for (let j = 0; j < m; j++) sums[c][j] += Xn[i][j];
    }

    let maxShift = 0;
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        // Empty cluster — re-seed to a random point so we don't stall.
        centroids[c] = Xn[Math.floor(rng() * n)].slice();
        continue;
      }
      const newCentroid = sums[c].map((s) => s / counts[c]);
      const shift = Math.sqrt(sqDist(newCentroid, centroids[c]));
      if (shift > maxShift) maxShift = shift;
      centroids[c] = newCentroid;
    }

    if (moved === 0 || maxShift < tol) break;
  }

  // Compute inertia + sizes
  const sizes = new Array(k).fill(0);
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    sizes[assignments[i]] += 1;
    inertia += sqDist(Xn[i], centroids[assignments[i]]);
  }

  return {
    centroids,
    mean,
    std,
    featureNames,
    sizes,
    inertia: inertia / n,
    k,
    nSamples: n,
    iterations,
  };
}

/**
 * Assign a feature vector to the nearest cluster. Returns -1 if the
 * model is empty.
 */
export function assignCluster(x: number[], model: KMeansModel): number {
  if (model.centroids.length === 0) return -1;
  // Standardize using the training-time mean/std so the input lives in
  // the same space as the centroids.
  const xn = x.map((v, j) => (v - model.mean[j]) / model.std[j]);
  let bestK = 0;
  let bestD = Infinity;
  for (let c = 0; c < model.centroids.length; c++) {
    const d = sqDist(xn, model.centroids[c]);
    if (d < bestD) {
      bestD = d;
      bestK = c;
    }
  }
  return bestK;
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let j = 0; j < a.length; j++) {
    const d = a[j] - b[j];
    s += d * d;
  }
  return s;
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
