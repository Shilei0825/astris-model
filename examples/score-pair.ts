/**
 * Score a single candidate-job pair with the composite matcher.
 *
 *   npx tsx examples/score-pair.ts
 */
import { scoreMatch } from "../src/matcher/scoring";
import type { ScoredCandidate, ScoredJob } from "../src/matcher/types";

const candidate: ScoredCandidate = {
  id: "c-001",
  firstName: "Amal",
  lastName: "Bekele",
  yearsExperience: 6,
  city: "Newark",
  state: "NJ",
  hasDriversLicense: true,
  transportationTypes: ["own_vehicle"],
  languages: [
    { language: "English",  proficiency: "conversational" },
    { language: "Amharic",  proficiency: "native" },
  ],
  skills: [
    { skillId: "forklift",  skill: { id: "forklift",  name: "Forklift",            type: "hard" }, yearsExperience: 3, proficiency: 4 },
    { skillId: "warehouse", skill: { id: "warehouse", name: "Warehouse operations", type: "hard" }, yearsExperience: 6, proficiency: 5 },
  ],
  workHistory: [
    {
      jobTitle: "Warehouse operator",
      employerName: "Addis Logistics",
      country: "ET",
      startDate: new Date("2018-01-01"),
      endDate: new Date("2024-05-01"),
    },
  ],
};

const job: ScoredJob = {
  id: "j-001",
  title: "Forklift operator",
  description:
    "Operate a forklift in a 200K sqft cross-dock warehouse. Day shift. Forklift cert required.",
  city: "Elizabeth",
  state: "NJ",
  shifts: ["day"],
  hoursPerWeekMin: 40,
  hoursPerWeekMax: 40,
  experienceRequired: 2,
  requiredCertifications: ["forklift-osha"],
  requiredLanguages: [{ language: "English", proficiency: "basic" }],
  skills: [
    { skillId: "forklift",  skill: { id: "forklift",  name: "Forklift",             type: "hard" }, isRequired: true,  weight: 1 },
    { skillId: "warehouse", skill: { id: "warehouse", name: "Warehouse operations", type: "hard" }, isRequired: true,  weight: 1 },
  ],
};

const result = scoreMatch(candidate, job);

console.log("Overall:", result.overallScore);
console.log("Recommendation:", result.recommendation);
console.log("Components:", {
  skills:         result.skillsScore,
  experience:     result.experienceScore,
  language:       result.languageScore,
  distance:       result.distanceScore,
  schedule:       result.scheduleScore,
  certification:  result.certificationScore,
  transportation: result.transportationScore,
});
console.log("Coverage:", result.coverage, `(${result.coverageMatched}/${result.coverageTotal})`);
console.log("Gaps:", result.gaps);
