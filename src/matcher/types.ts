/**
 * Pure types for the matching engine. The model is data-shape agnostic
 * — callers can pass any object that satisfies these shapes; no DB
 * coupling, no ORM dependency.
 */

export interface Skill {
  id: string;
  name: string;
  type?: "hard" | "soft" | "certification" | "language";
}

export interface CandidateSkill {
  skillId: string;
  skill: Skill;
  yearsExperience?: number | null;
  proficiency?: number | null;
}

export interface CandidateLanguage {
  language: string;
  proficiency: "none" | "basic" | "conversational" | "fluent" | "native";
}

export interface CandidateWorkHistory {
  jobTitle: string;
  employerName: string;
  country?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isCurrent?: boolean;
}

export interface ScoredCandidate {
  id: string;
  firstName: string;
  lastName: string;
  yearsExperience?: number | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxCommuteMiles?: number | null;
  willingToRelocate?: boolean;
  availabilityType?: string[];
  shiftAvailability?: string[];
  hoursPerWeekMin?: number | null;
  hoursPerWeekMax?: number | null;
  transportationTypes?: string[];
  hasDriversLicense?: boolean;
  languages: CandidateLanguage[];
  skills: CandidateSkill[];
  workHistory?: CandidateWorkHistory[];
}

export interface JobSkill {
  skillId: string;
  skill: Skill;
  isRequired: boolean;
  weight?: number;  // defaults to 1.0
}

export interface ScoredJob {
  id: string;
  title: string;
  description?: string | null;
  department?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isRemote?: boolean;
  experienceRequired?: number | null;
  availabilityType?: string[];
  shifts?: string[];
  hoursPerWeekMin?: number | null;
  hoursPerWeekMax?: number | null;
  requiredCertifications?: string[];
  requiredLanguages?: { language: string; proficiency?: string }[];
  transportationRequired?: boolean;
  transitAccessible?: boolean;
  skills: JobSkill[];
}

export interface ComponentScores {
  skillsScore: number;
  experienceScore: number;
  languageScore: number;
  distanceScore: number;
  scheduleScore: number;
  certificationScore: number;
  transportationScore: number;
}

export interface MatchResult extends ComponentScores {
  overallScore: number;
  recommendation: "recommended" | "strong_match" | "moderate_match" | "weak_match" | "not_recommended";
  gaps: string[];
  transferableSkills: { from: string; to: string; confidence: number }[];
  coverage?: number;
  coverageMatched?: number;
  coverageTotal?: number;
  jobFunction?: string | null;
}

export interface ScoreOptions {
  /** Pre-built transferable-skill graph: Skill.id → Set<Skill.id> of related skills */
  skillGraph?: Map<string, Set<string>>;
  /** Optional company-quality boost added to the composite (0-100 scale) */
  employerQualityScore?: number | null;
}
