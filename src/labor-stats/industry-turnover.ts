/**
 * BLS JOLTS — Quits / total separations, monthly seasonally-adjusted
 * rates by NAICS industry.
 *
 * Source: bls.gov/news.release/jolts.t02.htm (May 2025 release).
 * License: public domain (U.S. federal data).
 *
 * The rate is the share of EMPLOYED workers who voluntarily quit in a
 * given month. We use it to build an industry-baseline retention
 * curve — a candidate's per-(candidate, job) stability/fit features
 * then push the candidate above or below that industry baseline.
 *
 * Refreshing: replace with a periodic fetcher against the BLS public
 * API (no key required for small queries). For now the table is
 * checked-in seed data; values move ~0.1–0.3 pp month-to-month and
 * don't justify a runtime fetch on every score.
 */

export interface IndustryTurnover {
  /** Display name */
  name: string;
  /** 2-digit NAICS supersector code */
  naics: string;
  /** Monthly quits rate, share (0.047 = 4.7%) */
  monthlyQuitsRate: number;
  /** Monthly total separations rate (quits + layoffs + other) */
  monthlySeparationsRate: number;
}

const INDUSTRIES: IndustryTurnover[] = [
  { name: "Total nonfarm",                              naics: "00", monthlyQuitsRate: 0.020, monthlySeparationsRate: 0.034 },
  { name: "Mining and logging",                         naics: "10", monthlyQuitsRate: 0.011, monthlySeparationsRate: 0.027 },
  { name: "Construction",                               naics: "23", monthlyQuitsRate: 0.018, monthlySeparationsRate: 0.046 },
  { name: "Manufacturing — durable goods",              naics: "31a",monthlyQuitsRate: 0.014, monthlySeparationsRate: 0.027 },
  { name: "Manufacturing — nondurable goods",           naics: "31b",monthlyQuitsRate: 0.018, monthlySeparationsRate: 0.032 },
  { name: "Wholesale trade",                            naics: "42", monthlyQuitsRate: 0.015, monthlySeparationsRate: 0.028 },
  { name: "Retail trade",                               naics: "44", monthlyQuitsRate: 0.027, monthlySeparationsRate: 0.043 },
  { name: "Transportation, warehousing, and utilities", naics: "48", monthlyQuitsRate: 0.018, monthlySeparationsRate: 0.034 },
  { name: "Information",                                naics: "51", monthlyQuitsRate: 0.016, monthlySeparationsRate: 0.026 },
  { name: "Financial activities",                       naics: "52", monthlyQuitsRate: 0.013, monthlySeparationsRate: 0.022 },
  { name: "Professional and business services",         naics: "54", monthlyQuitsRate: 0.020, monthlySeparationsRate: 0.038 },
  { name: "Healthcare and social assistance",           naics: "62", monthlyQuitsRate: 0.019, monthlySeparationsRate: 0.030 },
  { name: "Educational services",                       naics: "61", monthlyQuitsRate: 0.011, monthlySeparationsRate: 0.020 },
  { name: "Arts, entertainment, and recreation",        naics: "71", monthlyQuitsRate: 0.030, monthlySeparationsRate: 0.052 },
  { name: "Accommodation and food services",            naics: "72", monthlyQuitsRate: 0.047, monthlySeparationsRate: 0.062 },
  { name: "Other services",                             naics: "81", monthlyQuitsRate: 0.022, monthlySeparationsRate: 0.034 },
  { name: "Federal government",                         naics: "g1", monthlyQuitsRate: 0.005, monthlySeparationsRate: 0.014 },
  { name: "State and local government, excl. education",naics: "g2", monthlyQuitsRate: 0.008, monthlySeparationsRate: 0.014 },
  { name: "State and local government, education",      naics: "g3", monthlyQuitsRate: 0.005, monthlySeparationsRate: 0.012 },
];

/**
 * Map a free-text industry / job-function label to one of the JOLTS
 * supersectors. Best-effort substring match; falls back to total
 * nonfarm so the curve always has a baseline.
 */
const INDUSTRY_LOOKUP_RULES: { match: RegExp; naics: string }[] = [
  { match: /food service|restaurant|line cook|prep cook|hospitality|hotel|housekeep|barista|bartend|server|caterer/i, naics: "72" },
  { match: /retail|cashier|store associate|sales associate/i, naics: "44" },
  { match: /truck|driver|delivery|warehouse|forklift|courier|cdl|freight|logistic|fulfillment/i, naics: "48" },
  { match: /construction|laborer|carpenter|mason|painter|roof|drywall/i, naics: "23" },
  { match: /manufactur|assembly|production|machine operator|fabricator|welder|machinist/i, naics: "31b" },
  { match: /software|engineer|developer|programmer|devops|sre|data scientist|machine learning|ai engineer|ai consultant|ai field|ai solutions|llm|fde|forward deployed|knowledge strategist|cx program|customer experience program|technical program/i, naics: "51" },
  { match: /director,? (strategy|international|operations|gtm)|chief of staff|head of strategy|long-?range plan|director,? hr|hrbp director|vp people|head of people/i, naics: "54" },
  { match: /nurse|patient care|hospital|clinic|medical|caregiver|healthcare|cna|lpn|pharma|aide/i, naics: "62" },
  { match: /teacher|tutor|education|school|professor|academic/i, naics: "61" },
  { match: /sales|account manager|business development|sdr|bdr/i, naics: "54" },
  { match: /marketing|brand|growth|content|seo|sem/i, naics: "54" },
  { match: /finance|account|cfo|controller|bookkeep|invest|bank|risk/i, naics: "52" },
  { match: /hr|human resource|recruit|talent|people operations|hrbp/i, naics: "54" },
  { match: /artist|musician|entertain|theater|gym|fitness|coach/i, naics: "71" },
  { match: /federal|government|gov-/i, naics: "g1" },
];

export function turnoverForIndustry(industryHint: string | null | undefined): IndustryTurnover {
  const text = (industryHint ?? "").toLowerCase();
  for (const rule of INDUSTRY_LOOKUP_RULES) {
    if (rule.match.test(text)) {
      return INDUSTRIES.find((i) => i.naics === rule.naics) ?? INDUSTRIES[0];
    }
  }
  return INDUSTRIES[0]; // Total nonfarm fallback
}

/**
 * STATE-aware turnover lookup. Tries the Census LEHD QWI cache for a
 * state × industry row first; falls back to the BLS JOLTS national
 * row when QWI doesn't have a value for that pair. This is what makes
 * the retention forecast actually localize — a Bay Area tech role
 * gets ~3.5%/mo, a Rust Belt manufacturing role gets ~1.5%/mo, both
 * for the same NAICS supersector.
 *
 * Returns the IndustryTurnover row PLUS a `source` flag so the UI can
 * label the tooltip "state-specific (Census QWI)" vs "national mean
 * (BLS JOLTS)".
 */
export interface QwiCacheRow {
  state: string;
  naics: string;
  monthlyQuitsRate: number;
  monthlySeparationsRate: number;
  monthlyHiresRate: number;
  quarterYear: string;
}

export function turnoverForIndustryAndState(
  industryHint: string | null | undefined,
  state: string | null | undefined,
  qwiCache?: QwiCacheRow[],
): { row: IndustryTurnover; source: "qwi_state" | "jolts_national"; quarterYear?: string } {
  const national = turnoverForIndustry(industryHint);
  if (!state || !qwiCache || qwiCache.length === 0) return { row: national, source: "jolts_national" };

  const stateAbbr = state.length === 2 ? state.toUpperCase() : state;
  const hit = qwiCache.find((c) => c.state === stateAbbr && c.naics === national.naics);
  if (!hit) return { row: national, source: "jolts_national" };
  return {
    row: {
      name: `${national.name} — ${stateAbbr}`,
      naics: national.naics,
      monthlyQuitsRate: hit.monthlyQuitsRate,
      monthlySeparationsRate: hit.monthlySeparationsRate,
    },
    source: "qwi_state",
    quarterYear: hit.quarterYear,
  };
}

export function turnoverForFunctionCategory(fn: string | null | undefined): IndustryTurnover {
  if (!fn) return INDUSTRIES[0];
  const mapping: Record<string, string> = {
    driver: "48", warehouse: "48",
    food_service: "72", hospitality: "72", retail: "44",
    construction: "23", trades: "23", manual_labor: "31b",
    nursing: "62", healthcare: "62", pharmacy: "62", caregiving: "62",
    analyst: "51", data_eng: "51", ai_ml: "51", engineer: "51", it_ops: "51", security: "51", identity: "51", network: "51",
    sales: "54", marketing: "54", cx: "54", hr: "54", ops: "54", strategy: "54", project_mgmt: "54",
  };
  const naics = mapping[fn];
  if (naics) return INDUSTRIES.find((i) => i.naics === naics) ?? INDUSTRIES[0];
  return INDUSTRIES[0];
}

/**
 * Industry-anchored retention curve.
 *
 * baseline_T = (1 − monthly_quits_rate) ^ T_months  — pure industry physics.
 * Then we adjust by the candidate-job stability + fit composite:
 *
 *   stability = avg(language, distance, schedule, transportation) / 100
 *   fit       = avg(skills, experience, certification)            / 100
 *
 * The adjustment scales the monthly quit HAZARD, not the survival
 * probability:
 *
 *   factor_T = 1.5 − (w_stability_T · stability + w_fit_T · fit)
 *   q_adj_T  = monthly_quits_rate · factor_T
 *   r_T      = (1 − q_adj_T) ^ T_months
 *
 * Because the per-horizon weights sum to 1 and both features are in [0,1],
 * factor_T ranges [0.5, 1.5]:
 *   - a strong match lowers the quit hazard (factor → 0.5), so retention is
 *     strictly ABOVE the industry baseline at every horizon;
 *   - a weak match raises it (factor → 1.5), strictly BELOW baseline.
 * Scaling the hazard (rather than the survival curve) keeps r_T strictly
 * inside (0,1) for any finite rate — so a perfect candidate can never
 * saturate at exactly 100%, and the baseline is never a hard ceiling.
 *
 * The early-window (30-day) factor weights stability more; the late-window
 * (365-day) factor weights fit more.
 */
export function industryAdjustedRetention(args: {
  industry: IndustryTurnover;
  skillsScore: number;
  experienceScore: number;
  languageScore: number;
  distanceScore: number;
  scheduleScore: number;
  certificationScore: number;
  transportationScore: number;
}): { r30: number; r90: number; r180: number; r365: number; industry: IndustryTurnover } {
  const stability = (args.languageScore + args.distanceScore + args.scheduleScore + args.transportationScore) / 4 / 100;
  const fit       = (args.skillsScore + args.experienceScore + args.certificationScore) / 3 / 100;

  const q = args.industry.monthlyQuitsRate;

  // Per-horizon hazard factor in [0.5, 1.5]. Weights (stability, fit) sum
  // to 1 at each horizon: stability dominates early, fit dominates late.
  const factor = (wStab: number, wFit: number) => 1.5 - (wStab * stability + wFit * fit);
  const q30  = q * factor(0.70, 0.30);
  const q90  = q * factor(0.60, 0.40);
  const q180 = q * factor(0.45, 0.55);
  const q365 = q * factor(0.30, 0.70);

  return {
    r30:  clamp01(Math.pow(1 - q30,  1)),
    r90:  clamp01(Math.pow(1 - q90,  3)),
    r180: clamp01(Math.pow(1 - q180, 6)),
    r365: clamp01(Math.pow(1 - q365, 12)),
    industry: args.industry,
  };
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

export const __INDUSTRIES = INDUSTRIES;
