/** Public surface of the training module. */
export {
  trainLogreg,
  predictProb,
  type LogregModel,
  type TrainOptions,
} from "./logreg.js";
export {
  trainGbdt,
  predictGbdtProb,
  type TreeNode,
  type GbdtModel,
  type GbdtOptions,
} from "./gbdt.js";
export {
  trainMlp,
  predictMlpProb,
  type MlpModel,
  type MlpOptions,
} from "./mlp.js";
export {
  trainKmeans,
  assignCluster,
  type KMeansModel,
  type KMeansOptions,
} from "./kmeans.js";
