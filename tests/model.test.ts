import { test } from "node:test";
import assert from "node:assert/strict";

import { scoreMatch } from "../src/matcher/scoring.ts";
import { computeCounterfactual } from "../src/matcher/counterfactual.ts";
import { industryAdjustedRetention, __INDUSTRIES } from "../src/labor-stats/industry-turnover.ts";
import type { ScoredCandidate, ScoredJob } from "../src/matcher/types.ts";

/* ── AST-1: scoreMatch must not throw on a job missing optional arrays ── */
test("AST-1: scoreMatch returns a number for a minimal job/candidate", () => {
  const candidate: any = {
    id: "c1", firstName: "A", lastName: "B", yearsExperience: 7, state: "NJ",
    languages: [],
    skills: [{ skillId: "forklift", skill: { id: "forklift", name: "Forklift" } }],
  };
  const job: any = {
    id: "j1", title: "Warehouse Lead", state: "NJ",
    skills: [{ skillId: "forklift", skill: { id: "forklift", name: "Forklift" }, isRequired: true }],
  };
  const r = scoreMatch(candidate as ScoredCandidate, job as ScoredJob);
  assert.equal(typeof r.overallScore, "number");
  assert.ok(Number.isFinite(r.overallScore));
});

/* ── AST-5: the four coverage/jobFunction fields must be returned ── */
test("AST-5: scoreMatch returns coverage + jobFunction fields", () => {
  const candidate: any = {
    id: "c1", firstName: "A", lastName: "B", yearsExperience: 7, state: "NJ",
    languages: [], skills: [{ skillId: "forklift", skill: { id: "forklift", name: "Forklift" } }],
  };
  const job: any = {
    id: "j1", title: "Warehouse Lead", state: "NJ",
    skills: [{ skillId: "forklift", skill: { id: "forklift", name: "Forklift" }, isRequired: true }],
  };
  const r = scoreMatch(candidate, job);
  assert.equal(r.coverageTotal, 1);
  assert.equal(r.coverageMatched, 1);
  assert.equal(r.coverage, 1);
  assert.equal(r.jobFunction, "warehouse");
});

/* ── AST-6: proficiency must matter ── */
test("AST-6: native speaker outscores basic when fluent is required", () => {
  const job: any = {
    id: "j", title: "Bilingual CX Rep", state: "NJ", skills: [],
    requiredLanguages: [{ language: "Spanish", proficiency: "fluent" }],
  };
  const base = { id: "c", firstName: "A", lastName: "B", state: "NJ", skills: [] };
  const native: any = { ...base, languages: [{ language: "Spanish", proficiency: "native" }] };
  const basic: any = { ...base, languages: [{ language: "Spanish", proficiency: "basic" }] };
  assert.ok(scoreMatch(native, job).languageScore > scoreMatch(basic, job).languageScore);
});

/* ── AST-4: day-length training must be parsed, not dropped ── */
test("AST-4: a '1 day' certificate gap yields a non-null monthsToReady", () => {
  const cf = computeCounterfactual({
    overallScore: 62, skillsScore: 60, experienceScore: 100, languageScore: 100,
    distanceScore: 100, scheduleScore: 100, certificationScore: 0, transportationScore: 100,
    gaps: ["Missing certifications: forklift-osha — OSHA-compliant forklift cert at warehouse staffing agency — 1 day"],
  });
  assert.notEqual(cf.monthsToReady, null);
  assert.ok(cf.parsedGaps[0].months && cf.parsedGaps[0].months.max > 0);
});

/* ── AST-2: retention must carry positive signal and never saturate ── */
test("AST-2: strong match > baseline > weak match at every horizon, none == 1.0", () => {
  const perfect = { skillsScore: 100, experienceScore: 100, languageScore: 100, distanceScore: 100, scheduleScore: 100, certificationScore: 100, transportationScore: 100 };
  const zero = { skillsScore: 0, experienceScore: 0, languageScore: 0, distanceScore: 0, scheduleScore: 0, certificationScore: 0, transportationScore: 0 };
  for (const industry of __INDUSTRIES) {
    const q = industry.monthlyQuitsRate;
    const base = { r30: (1 - q) ** 1, r90: (1 - q) ** 3, r180: (1 - q) ** 6, r365: (1 - q) ** 12 };
    const hi = industryAdjustedRetention({ industry, ...perfect });
    const lo = industryAdjustedRetention({ industry, ...zero });
    for (const k of ["r30", "r90", "r180", "r365"] as const) {
      assert.ok(hi[k] > base[k], `${industry.name} ${k}: strong ${hi[k]} !> baseline ${base[k]}`);
      assert.ok(lo[k] < base[k], `${industry.name} ${k}: weak ${lo[k]} !< baseline ${base[k]}`);
      assert.ok(hi[k] < 1, `${industry.name} ${k}: strong retention saturated at 1.0`);
      assert.ok(hi[k] > lo[k]);
    }
  }
});
