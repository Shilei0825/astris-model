/**
 * Counterfactual scorer + months-to-ready estimator.
 *
 * Patent-strategy alignment (docs/patents/strategy.md):
 *   - Family 1 — Months-to-Ready Estimator (composite-time formula)
 *   - Family 2 — Counterfactual Scorer ("what if candidate had cert X?")
 *
 * Both functions are pure post-processing on an existing Match row — no
 * extra DB or LLM calls. They parse the gap report the matcher already
 * persisted into `Match.gaps` (lines of the form
 *   "Missing skill: <name> — <how-to-acquire>"
 * where the trailing piece always ends with a time range, e.g.
 *   "Salesforce — Trailhead.salesforce.com (free) → Salesforce Admin cert — 1–3 months"
 * ), extracts the named gaps + acquisition time, and derives:
 *
 *   (a) months-to-ready: the SHORTEST total time for the candidate to
 *       cover the missing essential skills, assuming they could acquire
 *       them in parallel (cap at the longest single acquisition window).
 *   (b) counterfactual score for each top-N missing skill: re-runs the
 *       composite formula with that skill counted as matched, returning
 *       the projected score. Lets the employer see "if you fund this
 *       candidate's Salesforce admin certificate (1–3 months), they go
 *       from 62 to 84".
 */

export interface CounterfactualSkillProjection {
  skill: string;
  acquire: string;
  months: { min: number; max: number };
  projectedScore: number;
  delta: number;
}

export interface MatchCounterfactual {
  monthsToReady: { min: number; max: number } | null;
  projections: CounterfactualSkillProjection[];
  parsedGaps: { skill: string; acquire: string; months: { min: number; max: number } | null }[];
}

/**
 * Compute the counterfactual scenario for one Match row. Pass in the
 * matcher-persisted row (just the score components + gaps array — does
 * not need the candidate / job fetches).
 */
export function computeCounterfactual(m: {
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  languageScore: number;
  distanceScore: number;
  scheduleScore: number;
  certificationScore: number;
  transportationScore: number;
  gaps: string[];
}): MatchCounterfactual {
  const parsedGaps = parseGaps(m.gaps);

  // Months-to-Ready: longest single max-time among the essential gaps.
  // Assumption: candidate can stack acquisitions in parallel (free
  // online + employer-sponsored study + paid bootcamp etc). We cap at
  // 24 months — anything beyond that signals "career retraining"
  // territory, not job-readiness work.
  let minTotal = 0;
  let maxTotal = 0;
  for (const g of parsedGaps) {
    if (!g.months) continue;
    minTotal = Math.max(minTotal, g.months.min);
    maxTotal = Math.max(maxTotal, g.months.max);
  }
  const monthsToReady = parsedGaps.some((g) => g.months) ? { min: minTotal, max: Math.min(maxTotal, 24) } : null;

  // Counterfactual scoring: for each of the top-3 named gaps, what would
  // the score be if the candidate had that skill?
  //
  // The matcher applies a coverage cap: overall = min(weightedSum,
  // 40 + coverage × 60). Adding one matched skill lifts coverage by
  // 1/total — call that delta_cov — and bumps skillsScore by
  // (1/total) × 100. The weighted-sum delta is (1/total) × 100 ×
  // weight_skills = (1/total) × 40 (since skills weight is 0.4 in the
  // default profile).
  //
  // We approximate `total` = max(5, gaps_count) — assume the candidate
  // has at least 5 required skills. The new score is the min of the
  // updated weighted sum and the updated coverage cap.
  const projections: CounterfactualSkillProjection[] = [];
  const totalRequired = Math.max(5, parsedGaps.length);
  for (const g of parsedGaps.slice(0, 3)) {
    const newSkillScore = Math.min(100, m.skillsScore + (100 / totalRequired));
    const weightedDelta = (newSkillScore - m.skillsScore) * 0.4;
    const newWeightedSum = m.overallScore + weightedDelta;
    // The cap moves up too: + (1/total) × 60.
    const newCap = Math.min(100, m.overallScore + (60 / totalRequired) + weightedDelta);
    const projectedScore = Math.min(newWeightedSum, newCap);
    if (g.months) {
      projections.push({
        skill: g.skill,
        acquire: g.acquire,
        months: g.months,
        projectedScore,
        delta: projectedScore - m.overallScore,
      });
    }
  }

  return { monthsToReady, projections, parsedGaps };
}

/**
 * Parse a Match.gaps[] array into structured gap entries. The matcher
 * writes lines like:
 *   "Missing skills: Salesforce — Trailhead.salesforce.com (free) → Salesforce Admin cert — 1–3 months;
 *    CPG — Coursera 'Marketing in a Digital World' (UIUC, free audit) — 4 weeks (+2 more)"
 *
 * The "+N more" trailing parenthetical is dropped. Time ranges in the
 * acquire string are extracted via regex.
 */
function parseGaps(gaps: string[]): { skill: string; acquire: string; months: { min: number; max: number } | null }[] {
  const out: { skill: string; acquire: string; months: { min: number; max: number } | null }[] = [];
  for (const gap of gaps) {
    const colonIx = gap.indexOf(":");
    if (colonIx < 0) continue;
    // Skip the coverage line that leads with "Essential-skill coverage:"
    if (/essential-skill coverage|coverage:/i.test(gap.slice(0, colonIx))) continue;
    // Strip trailing "(+N more)"
    const body = gap.slice(colonIx + 1).replace(/\s*\(\+\d+ more\)\s*$/, "").trim();
    for (const item of body.split(/;\s*/)) {
      const dashIx = item.indexOf(" — ");
      if (dashIx < 0) continue;
      const skill = item.slice(0, dashIx).trim();
      const acquire = item.slice(dashIx + 3).trim();
      out.push({ skill, acquire, months: extractMonths(acquire) });
    }
  }
  return out;
}

/**
 * Extract a time window from an acquisition string. Supports:
 *   "1–3 months", "1-3 months", "6 months", "6 weeks", "12 weeks",
 *   "4–8 weeks", "4 hours", "30 hours", "3–6 months", "1 week"
 * Returns { min, max } in months. "weeks" / "hours" convert; ranges
 * widen min and max accordingly.
 */
function extractMonths(text: string): { min: number; max: number } | null {
  // Try ranges first: "1–3 months", "4–8 weeks"
  const range = text.match(/(\d+)\s*[–-]\s*(\d+)\s*(year|month|week|day|hour)s?/i);
  if (range) {
    const lo = parseInt(range[1], 10);
    const hi = parseInt(range[2], 10);
    const unit = range[3].toLowerCase();
    return { min: convertToMonths(lo, unit), max: convertToMonths(hi, unit) };
  }
  const single = text.match(/(\d+)\s*(year|month|week|day|hour)s?/i);
  if (single) {
    const n = parseInt(single[1], 10);
    const unit = single[2].toLowerCase();
    const m = convertToMonths(n, unit);
    return { min: m, max: m };
  }
  return null;
}

function convertToMonths(n: number, unit: string): number {
  if (unit === "year") return n * 12;
  if (unit === "month") return n;
  if (unit === "week") return Math.max(0.25, Math.round((n / 4.33) * 4) / 4);
  if (unit === "day") return Math.max(0.25, Math.round((n / 30) * 4) / 4);
  if (unit === "hour") return Math.max(0.25, Math.round((n / 160) * 4) / 4);
  return n;
}

/** Format a months range for display. */
export function formatMonths(r: { min: number; max: number }): string {
  if (r.min === r.max) return monthsLabel(r.min);
  return `${monthsLabel(r.min)}–${monthsLabel(r.max).replace(/\s*(months?|weeks?)$/, "")}`.trim() + (r.max >= 12 ? " months" : "");
}

function monthsLabel(m: number): string {
  if (m < 1) {
    const wks = Math.max(1, Math.round(m * 4.33));
    return `${wks} ${wks === 1 ? "week" : "weeks"}`;
  }
  if (m >= 12 && Number.isInteger(m / 12)) {
    const y = m / 12;
    return `${y} ${y === 1 ? "year" : "years"}`;
  }
  const r = Math.round(m * 10) / 10;
  return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)} months`;
}
