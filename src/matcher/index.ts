/** Public surface of the matcher. */
export * from "./types.js";
export { scoreMatch } from "./scoring.js";
export {
  computeCounterfactual,
  formatMonths,
  type CounterfactualSkillProjection,
  type MatchCounterfactual,
} from "./counterfactual.js";
