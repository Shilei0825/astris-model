/**
 * Astris HR Model — composite scoring engine.
 *
 * Seven-component weighted composite per (candidate, job) pair, with
 * industry-aware weight profiles, fuzzy + category-bridged skill
 * matching, an essential-skill coverage cap that prevents high scores
 * without real skill coverage, and confidence decay on stale foreign
 * work history.
 *
 *   Default weights (when the job's function can't be inferred):
 *     Skills        40%
 *     Experience    20%
 *     Language      10%
 *     Distance      10%
 *     Schedule      10%
 *     Certification  5%
 *     Transportation 5%
 *
 * Each component returns a 0-100 score; the overall is the weighted
 * average, clamped by the coverage cap = 40 + (matched_skills /
 * total_required_skills) × 60.
 */

import type { ScoredCandidate, ScoredJob, MatchResult, ScoreOptions, ComponentScores } from "./types";







/** Credit given for a transferable (related) skill vs. a direct skill match. */
const TRANSFERABLE_CREDIT = 0.6;

type ComponentWeights = {
  skills: number; experience: number; language: number;
  distance: number; schedule: number; certification: number; transportation: number;
};

/** Default 7-component weight profile for jobs that don't pattern-match a
 *  more specific industry. Sums to 1.0. */
const DEFAULT_WEIGHTS: ComponentWeights = {
  skills: 0.4,
  experience: 0.2,
  language: 0.1,
  distance: 0.1,
  schedule: 0.1,
  certification: 0.05,
  transportation: 0.05,
};

/**
 * Per-function weight profiles. Lets the matcher emphasize different
 * components for different industries:
 *   - driver        → transport + license matter more, skills count less
 *   - analyst       → skills + language fluency dominate; distance matters less
 *   - healthcare    → certification + schedule (shifts) heaviest
 *   - food_service  → schedule + certification (food handler), language low
 *   - trades        → certification + transport (own vehicle), skills moderate
 *   - sales         → language (fluency) + skills, distance lower
 *   - manual_labor  → schedule + transport + transportation, language low
 *
 * Each profile MUST sum to 1.0 — picked by the scorer based on the
 * inferred job function (title + description + required-skill categories).
 */
const FUNCTION_WEIGHT_PROFILES: Partial<Record<JobFunction, ComponentWeights>> = {
  driver:       { skills: 0.20, experience: 0.15, language: 0.05, distance: 0.20, schedule: 0.15, certification: 0.15, transportation: 0.10 },
  warehouse:    { skills: 0.25, experience: 0.15, language: 0.05, distance: 0.15, schedule: 0.20, certification: 0.10, transportation: 0.10 },
  manual_labor: { skills: 0.20, experience: 0.20, language: 0.05, distance: 0.15, schedule: 0.20, certification: 0.10, transportation: 0.10 },
  construction: { skills: 0.25, experience: 0.20, language: 0.05, distance: 0.15, schedule: 0.15, certification: 0.10, transportation: 0.10 },

  trades:       { skills: 0.30, experience: 0.20, language: 0.05, distance: 0.10, schedule: 0.10, certification: 0.15, transportation: 0.10 },
  food_service: { skills: 0.25, experience: 0.15, language: 0.05, distance: 0.15, schedule: 0.20, certification: 0.15, transportation: 0.05 },
  hospitality:  { skills: 0.25, experience: 0.15, language: 0.10, distance: 0.15, schedule: 0.20, certification: 0.10, transportation: 0.05 },
  retail:       { skills: 0.20, experience: 0.10, language: 0.15, distance: 0.15, schedule: 0.20, certification: 0.05, transportation: 0.15 },
  caregiving:   { skills: 0.25, experience: 0.20, language: 0.15, distance: 0.15, schedule: 0.15, certification: 0.05, transportation: 0.05 },

  nursing:      { skills: 0.30, experience: 0.15, language: 0.10, distance: 0.10, schedule: 0.15, certification: 0.15, transportation: 0.05 },
  pharmacy:     { skills: 0.35, experience: 0.15, language: 0.10, distance: 0.10, schedule: 0.10, certification: 0.15, transportation: 0.05 },
  healthcare:   { skills: 0.30, experience: 0.15, language: 0.10, distance: 0.10, schedule: 0.15, certification: 0.15, transportation: 0.05 },

  analyst:      { skills: 0.45, experience: 0.20, language: 0.15, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.05 },
  data_eng:     { skills: 0.45, experience: 0.20, language: 0.15, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.05 },
  ai_ml:        { skills: 0.45, experience: 0.20, language: 0.15, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.05 },
  engineer:     { skills: 0.45, experience: 0.20, language: 0.15, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.05 },
  it_ops:       { skills: 0.40, experience: 0.20, language: 0.10, distance: 0.10, schedule: 0.10, certification: 0.05, transportation: 0.05 },
  security:     { skills: 0.45, experience: 0.20, language: 0.10, distance: 0.05, schedule: 0.05, certification: 0.10, transportation: 0.05 },
  identity:     { skills: 0.45, experience: 0.20, language: 0.10, distance: 0.05, schedule: 0.05, certification: 0.10, transportation: 0.05 },
  network:      { skills: 0.40, experience: 0.20, language: 0.10, distance: 0.10, schedule: 0.10, certification: 0.05, transportation: 0.05 },

  sales:        { skills: 0.35, experience: 0.20, language: 0.20, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.10 },
  marketing:    { skills: 0.40, experience: 0.20, language: 0.20, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.05 },
  cx:           { skills: 0.30, experience: 0.20, language: 0.25, distance: 0.05, schedule: 0.10, certification: 0.05, transportation: 0.05 },
  hr:           { skills: 0.35, experience: 0.20, language: 0.20, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.10 },
  ops:          { skills: 0.35, experience: 0.20, language: 0.15, distance: 0.10, schedule: 0.10, certification: 0.05, transportation: 0.05 },
  strategy:     { skills: 0.40, experience: 0.25, language: 0.15, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.05 },
  project_mgmt: { skills: 0.35, experience: 0.25, language: 0.15, distance: 0.05, schedule: 0.05, certification: 0.05, transportation: 0.10 },
};

/** Pick the weight profile that applies to a job. Falls back to default. */
function weightsForJob(j: ScoredJob, requiredSkillNames: string[]): { weights: ComponentWeights; jobFunction: JobFunction | null } {
  const fn = inferJobFunction(j.title, j.description, requiredSkillNames);
  if (fn && FUNCTION_WEIGHT_PROFILES[fn]) {
    return { weights: FUNCTION_WEIGHT_PROFILES[fn]!, jobFunction: fn };
  }
  return { weights: DEFAULT_WEIGHTS, jobFunction: fn };
}

export function scoreMatch(
  c: ScoredCandidate,
  j: ScoredJob,
  opts: ScoreOptions = {}
): MatchResult {
  const { skillsScore, transferableSkills, coverage, coverageMatched, coverageTotal } = scoreSkills(c, j, opts.skillGraph);
  const experienceScore = scoreExperience(c, j);
  const languageScore = scoreLanguages(c, j);
  const distanceScore = scoreDistance(c, j);
  const scheduleScore = scoreSchedule(c, j);
  const certificationScore = scoreCertifications(c, j);
  const transportationScore = scoreTransportation(c, j);

  // Pick industry-specific component weights — a driver job emphasizes
  // transport + license; an analyst job emphasizes skills + language.
  const { weights, jobFunction } = weightsForJob(j, j.skills.filter((s) => s.isRequired).map((s) => s.skill.name));

  const baseOverall =
    skillsScore * weights.skills +
    experienceScore * weights.experience +
    languageScore * weights.language +
    distanceScore * weights.distance +
    scheduleScore * weights.schedule +
    certificationScore * weights.certification +
    transportationScore * weights.transportation;

  // ESSENTIAL-SKILL COVERAGE CAP. The composite has 7 components and most
  // candidates score 90-100 on language / distance / schedule / cert /
  // transport because those default to favourable values when the JD
  // doesn't constrain them. Without a cap, a candidate who matches 1 out
  // of 30 required skills can still climb to 75+ on the strength of the
  // other six components alone. That's the "high score, but essential
  // skills not matched" failure mode the user flagged.
  //
  // Cap = 40 + coverage × 60, where coverage = matched_skills /
  // total_required_skills (binary tally, independent of weight).
  //   coverage 0.0  → composite capped at 40 (weak match)
  //   coverage 0.3  → capped at 58
  //   coverage 0.5  → capped at 70  (moderate floor)
  //   coverage 0.75 → capped at 85
  //   coverage 1.0  → no effective cap
  //
  // Only applied when the job has required skills at all (some entries
  // come in with isRequired: false on everything; for those we skip the
  // cap and trust the rest of the pipeline).
  const requiredSkillCount = j.skills.filter((s) => s.isRequired).length;
  const coverageCap = requiredSkillCount > 0 ? 40 + coverage * 60 : 100;
  const overall = Math.min(baseOverall, coverageCap);

  return {
    skillsScore,
    experienceScore,
    languageScore,
    distanceScore,
    scheduleScore,
    certificationScore,
    transportationScore,
    overallScore: clamp(overall, 0, 100),
    recommendation: recommendationFor(overall),
    gaps: collectGaps(c, j, { skillsScore, certificationScore, languageScore, distanceScore, coverage, coverageMatched, coverageTotal }, opts.skillGraph, transferableSkills),
    transferableSkills,
    coverage,
    coverageMatched,
    coverageTotal,
    jobFunction,
  };
}

function scoreSkills(
  c: ScoredCandidate,
  j: ScoredJob,
  graph?: Map<string, Set<string>>
): { skillsScore: number; transferableSkills: MatchResult["transferableSkills"]; coverage: number; coverageMatched: number; coverageTotal: number } {
  const required = j.skills.filter((s) => s.isRequired);
  if (required.length === 0) return { skillsScore: 70, transferableSkills: [], coverage: 1, coverageMatched: 0, coverageTotal: 0 };

  const candidateSkills = c.skills.map((cs) => ({ id: cs.skillId, name: cs.skill.name }));
  const candidateSkillIds = new Set(candidateSkills.map((cs) => cs.id));
  // Pre-compute normalized + tokenized + categorized forms once per candidate.
  const candidateTokens = candidateSkills.map((cs) => ({
    cs,
    norm: normalizeSkill(cs.name),
    tokens: skillTokens(cs.name),
    categories: skillCategories(cs.name),
  }));
  const transferable: MatchResult["transferableSkills"] = [];

  // Total weight = sum of JobSkill.weight (defaults to 1.0). The parser /
  // employer can mark "core" skills heavier (driving for a driver role,
  // Python/R for an analyst role) so they dominate the composite even
  // when the candidate has equal counts of nice-to-have skills.
  const totalWeight = required.reduce((s, r) => s + (r.weight ?? 1), 0);

  let credit = 0;
  // Coverage counter: how many required skills got at least a meaningful
  // (≥0.5) credit. This is independent of weight — a binary "the
  // candidate has some evidence of this skill" tally — and acts as a hard
  // floor on the composite. A candidate matching only 1/30 essential
  // skills should NOT score 80 just because their schedule and
  // transportation are perfect.
  let coverageMatched = 0;

  for (const req of required) {
    const reqWeight = req.weight ?? 1;

    // 1. Direct skill-ID hit (cheapest, full credit at this weight).
    if (candidateSkillIds.has(req.skillId)) {
      credit += reqWeight;
      coverageMatched += 1;
      continue;
    }

    // 2. Fuzzy NAME match. Job-required skill names come from the parser
    // and are noisy — "Salesforce administration", "Salesforce admin",
    // "SFDC", "Salesforce CRM" all collide on different IDs but mean the
    // same thing. We give:
    //   - full credit when the normalized skill names are identical
    //   - 0.85 credit when one name's tokens are a subset of the other
    //   - Jaccard credit (clamped at 0.7) when the bags overlap heavily
    const reqNorm = normalizeSkill(req.skill.name);
    const reqTokens = skillTokens(req.skill.name);
    const reqCategories = skillCategories(req.skill.name);
    let best: { confidence: number; from: string } | null = null;
    for (const ct of candidateTokens) {
      if (ct.norm === reqNorm) { best = { confidence: 1, from: ct.cs.name }; break; }
      const overlap = jaccard(reqTokens, ct.tokens);
      const isSubset = reqTokens.size > 0 && ct.tokens.size > 0
        && ([...reqTokens].every((t) => ct.tokens.has(t)) || [...ct.tokens].every((t) => reqTokens.has(t)));
      let confidence = isSubset ? Math.max(0.85, overlap) : overlap >= 0.5 ? Math.min(0.7, overlap) : 0;
      // 2b. Skill-category overlap — recognizes that "R" and "SAS" and
      // "SPSS" all belong to the same analyst-language family, "CDL" and
      // "DOT compliance" both belong to driver. If the bag of categories
      // overlaps but the tokens don't, give a 0.6 floor so the candidate
      // gets meaningful (but not full) credit for the related skill.
      if (confidence < 0.6 && reqCategories.size > 0 && ct.categories.size > 0) {
        for (const cat of ct.categories) if (reqCategories.has(cat)) { confidence = Math.max(confidence, 0.6); break; }
      }
      if (confidence > 0 && (!best || confidence > best.confidence)) {
        best = { confidence, from: ct.cs.name };
      }
    }
    if (best) {
      credit += best.confidence * reqWeight;
      if (best.confidence >= 0.5) coverageMatched += 1;
      transferable.push({ from: best.from, to: req.skill.name, confidence: best.confidence });
      continue;
    }

    // 3. Transferable-skill graph (curated relatedSkills edges).
    if (graph) {
      const reqRelated = graph.get(req.skillId);
      if (reqRelated) {
        for (const cs of candidateSkills) {
          if (reqRelated.has(cs.id)) {
            credit += TRANSFERABLE_CREDIT * reqWeight;
            if (TRANSFERABLE_CREDIT >= 0.5) coverageMatched += 1;
            transferable.push({ from: cs.name, to: req.skill.name, confidence: TRANSFERABLE_CREDIT });
            break;
          }
        }
      }
    }
  }

  // Function-fit bonus. Classify the job into a function family from its
  // title (driver / analyst / engineer / sales / etc.) and check whether
  // the candidate has any KEYSTONE skill for that family even if it
  // wasn't in the explicit required-skills list. A driver candidate with
  // a CDL gets a function-fit bonus on any driver role. An analyst with
  // R / SAS / SPSS gets a bonus on any analyst role.
  const jobFunction = inferJobFunction(j.title, j.description, required.map((r) => r.skill.name));
  let functionFitBonus = 0;
  if (jobFunction) {
    const keystones = FUNCTION_KEYSTONES[jobFunction] ?? new Set<string>();
    if (keystones.size > 0) {
      const hits = candidateTokens.filter((ct) => {
        for (const cat of ct.categories) if (keystones.has(cat)) return true;
        return false;
      });
      // Up to 15-point bonus on the raw skillsScore for clear function fit.
      // Scales by min(hits, 3) / 3 so 3+ keystone skills give full bonus.
      functionFitBonus = (Math.min(hits.length, 3) / 3) * 15;
    }
  }

  const rawSkillScore = clamp((credit / Math.max(1, totalWeight)) * 100, 0, 100);
  const coverage = coverageMatched / required.length;
  // Coverage gates the function-fit bonus: a candidate who has matched
  // less than 1/3 of the required skills shouldn't pick up a +15 bonus
  // just because they hold one keystone skill in the function family.
  const bonusGate = coverage < 0.33 ? 0 : coverage < 0.66 ? 0.5 : 1;
  return {
    skillsScore: clamp(rawSkillScore + functionFitBonus * bonusGate, 0, 100),
    transferableSkills: transferable,
    coverage,
    coverageMatched,
    coverageTotal: required.length,
  };
}

/* ───────── skill-name fuzzy match helpers ───────── */

const SKILL_STOPWORDS = new Set([
  "and", "or", "the", "a", "an", "of", "for", "with", "to", "in", "on",
  "at", "by", "into", "from", "as", "is", "are", "be", "been", "being",
  "across", "through", "via", "etc",
]);

/** Lowercase, strip punctuation, collapse whitespace. */
function normalizeSkill(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Set of non-stopword tokens for Jaccard / subset comparison. */
function skillTokens(name: string): Set<string> {
  const norm = normalizeSkill(name);
  const out = new Set<string>();
  for (const raw of norm.split(/[\s/-]+/)) {
    if (!raw) continue;
    if (SKILL_STOPWORDS.has(raw)) continue;
    if (raw.length < 2) continue;
    out.add(raw);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/* ───────── skill category / function lookup tables ─────────
 *
 * Hand-curated taxonomy so the matcher knows that "R", "SAS", "SPSS", "Stata"
 * are all analyst languages; "CDL", "DOT compliance", "defensive driving"
 * are all driver competencies; "Python", "JavaScript", "Go" are software
 * languages, etc. Each skill name can belong to multiple categories — e.g.
 * "Python" is both an analyst_language AND a software_language; a hit on
 * either matches.
 *
 * The keys here are SUBSTRINGS we search inside the normalized skill name
 * (lowercased, punctuation-stripped). That way "Salesforce administration"
 * and "SFDC" and "Salesforce Admin" all hit the "salesforce" needle.
 */
const SKILL_CATEGORY_RULES: { match: RegExp; categories: string[] }[] = [
  // Driver
  { match: /\b(cdl|class a|class b|dot compliance|hazmat|tanker)\b/, categories: ["driver_cert", "driver"] },
  { match: /\b(driv(ing|er)|route plan|delivery|navigat|trucking|vehicle inspection|safe driv)\b/, categories: ["driver"] },
  { match: /\bdefensive driv|\bdmv\b|\bclean driving record\b/, categories: ["driver"] },

  // Analyst / data
  { match: /\b(r|sas|spss|stata|matlab|spotfire)\b/, categories: ["analyst_language", "analyst"] },
  { match: /\b(python|jupyter|pandas|numpy|scipy)\b/, categories: ["analyst_language", "software_language", "analyst"] },
  { match: /\b(sql|postgres|mysql|snowflake|bigquery|redshift)\b/, categories: ["analyst_language", "analyst", "data_eng"] },
  { match: /\b(tableau|power bi|powerbi|looker|qlik|domo|metabase|mode)\b/, categories: ["analyst_bi", "analyst"] },
  { match: /\b(data analy|data scien|data engineer|machine learn|statistic|forecast|regression|a\/b test)\b/, categories: ["analyst"] },
  { match: /\b(excel|sheets|spreadsheet|vlookup|pivot|vba)\b/, categories: ["analyst_office", "analyst"] },
  { match: /\b(etl|airflow|dbt|kafka|spark|databricks)\b/, categories: ["data_eng", "analyst"] },

  // Software engineering
  { match: /\b(javascript|typescript|node|react|vue|angular|next\.?js)\b/, categories: ["software_language", "frontend"] },
  { match: /\b(java|kotlin|scala|c\+\+|c#|\.net|rust|go(lang)?|php|ruby|swift|elixir)\b/, categories: ["software_language", "engineer"] },
  { match: /\b(docker|kubernetes|terraform|ansible|aws|azure|gcp|devops|sre)\b/, categories: ["devops", "engineer"] },
  { match: /\b(rest|graphql|api|microservic|backend|server-?side)\b/, categories: ["backend", "engineer"] },
  { match: /\b(software engineer|system design|architectur|design pattern)\b/, categories: ["engineer"] },

  // Network / IT
  { match: /\b(network|cisco|meraki|aruba|palo alto|firewall|vpn|switching|routing|wireless)\b/, categories: ["network", "it_ops"] },
  { match: /\b(okta|saml|sso|mfa|identity|iam|scim|active directory|azure ad)\b/, categories: ["identity", "it_ops"] },
  { match: /\b(linux|bash|powershell|sysadmin|infrastruct|incident)\b/, categories: ["it_ops"] },
  { match: /\b(security|infosec|comptia|cissp|penetration|threat)\b/, categories: ["security", "it_ops"] },

  // AI / ML
  { match: /\b(llm|gpt|claude|gemini|rag|embedding|agent|function calling|tool use|prompt)\b/, categories: ["ai_ml", "engineer"] },
  { match: /\b(tensorflow|pytorch|scikit|hugging|transformer|fine-?tun)\b/, categories: ["ai_ml", "analyst"] },

  // Sales / BD
  { match: /\b(salesforce|sfdc|hubspot|pipedrive|outreach|gong|salesloft|zoominfo)\b/, categories: ["sales_tools", "sales"] },
  { match: /\b(sales|account manage|account executive|business develop|prospect|pipeline|quota|close|negotiat)\b/, categories: ["sales"] },
  { match: /\b(sdr|bdr|inside sales|outside sales|territory|enterprise sales|saas sales)\b/, categories: ["sales"] },
  { match: /\b(media buy|adtech|cpg|retail media|campaign|google ads|programmatic|trade desk)\b/, categories: ["sales_adtech", "sales", "marketing"] },

  // Marketing / CX
  { match: /\b(marketing|seo|sem|content marketing|brand|growth|paid social|copywrit)\b/, categories: ["marketing"] },
  { match: /\b(customer experience|customer support|customer success|cx|csm|escalation|deflection)\b/, categories: ["cx", "support"] },
  { match: /\b(knowledge management|km|playbook|runbook|documentation)\b/, categories: ["km", "cx"] },
  { match: /\b(genesys|zendesk|intercom|freshdesk|ahf|fcr|aht)\b/, categories: ["cx_tools", "cx"] },

  // HR / Ops
  { match: /\b(hr |human resource|hrbp|talent|people operations|recruit|hiring|onboard|workforce plan|comp|benefit)\b/, categories: ["hr"] },
  { match: /\b(performance manage|organizational design|leadership coach|employment law|labor relations)\b/, categories: ["hr"] },
  { match: /\b(project manage|program manage|pmp|agile|scrum|kanban|jira)\b/, categories: ["project_mgmt"] },
  { match: /\b(supply chain|logistic|inventory|procure|warehouse|operations)\b/, categories: ["ops"] },
  { match: /\b(strateg|long-?range plan|gtm|go-?to-?market|new market entry|m&a|roi model)\b/, categories: ["strategy"] },

  // Healthcare
  { match: /\b(rn|registered nurse|nclex|cna|lpn|patient care|vital sign|epic|emr|ehr|medication admin|iv insert|bls|acls)\b/, categories: ["healthcare", "nursing"] },
  { match: /\b(pharmac|ptcb|prescription|drug interaction|compounding)\b/, categories: ["healthcare", "pharmacy"] },
  { match: /\b(medical|clinical|patient education|hospital|hipaa|claims|billing|coding)\b/, categories: ["healthcare"] },

  // Manual labor / trades
  { match: /\b(forklift|pallet|warehouse|inventory|loading)\b/, categories: ["warehouse", "manual_labor"] },
  { match: /\b(carpent|mason|painter|roof|drywall|concrete|framing)\b/, categories: ["construction", "manual_labor"] },
  { match: /\b(welding|mig|tig|fabricat|cnc|machinist)\b/, categories: ["trades", "manual_labor"] },
  { match: /\b(electric|wiring|electrician|conduit|breaker)\b/, categories: ["trades", "manual_labor"] },
  { match: /\b(plumb|pipe fit|hvac|epa 608|refriger)\b/, categories: ["trades", "manual_labor"] },
  { match: /\b(manual labor|heavy lift|physical|outdoor work|agricultur|farm|harvest|crop)\b/, categories: ["manual_labor"] },

  // Hospitality / food
  { match: /\b(line cook|prep cook|sous|chef|baker|fryer|saute|grill|catering)\b/, categories: ["food_service", "hospitality"] },
  { match: /\b(serv ?safe|food safety|food handler|haccp|knife skill|food prep)\b/, categories: ["food_service", "hospitality"] },
  { match: /\b(housekeep|front desk|hotel|guest service|hospitality|bartend|barista)\b/, categories: ["hospitality"] },
  { match: /\b(cash handl|pos|point of sale|register|retail)\b/, categories: ["retail"] },

  // Childcare / caregiving
  { match: /\b(childcare|nanny|babysitter|eldercare|home health aide|hha|caregiver)\b/, categories: ["caregiving"] },

  // Language / communication
  { match: /\b(interpret|translat|bilingual|spanish-english|english-arabic|esl|tesol)\b/, categories: ["language_services"] },
  { match: /\b(communicat|public speak|written communication|verbal communication|presentation)\b/, categories: ["communication"] },

  // Soft / leadership
  { match: /\b(leadership|people manage|team lead|mentor|coach)\b/, categories: ["leadership"] },
  { match: /\b(cross-functional|stakeholder|collaborat|conflict resolut)\b/, categories: ["collaboration"] },
];

function skillCategories(name: string): Set<string> {
  const norm = " " + normalizeSkill(name) + " ";
  const out = new Set<string>();
  for (const rule of SKILL_CATEGORY_RULES) {
    if (rule.match.test(norm)) for (const c of rule.categories) out.add(c);
  }
  return out;
}

/* Job-function classifier + keystone skills.
 *
 * Returns the dominant function family for a job, looked up via title /
 * description keywords (cheap, deterministic). The matcher then bumps
 * candidates who hold any keystone skill in that family — so an analyst
 * job with R / SAS / SPSS / Python listed gets a lift for candidates with
 * those skills even when the JD's exact phrasing was different.
 */
type JobFunction =
  | "driver" | "analyst" | "engineer" | "data_eng" | "ai_ml"
  | "sales" | "marketing" | "cx" | "hr" | "ops" | "strategy" | "project_mgmt"
  | "healthcare" | "nursing" | "pharmacy"
  | "warehouse" | "trades" | "construction" | "manual_labor"
  | "food_service" | "hospitality" | "retail" | "caregiving"
  | "it_ops" | "security" | "identity" | "network";

const JOB_TITLE_RULES: { match: RegExp; func: JobFunction }[] = [
  { match: /\bdriver|cdl|chauffeur|trucker|courier\b/i, func: "driver" },
  { match: /\bdata (analyst|scien)|bi analyst|business analyst|insights analyst\b/i, func: "analyst" },
  { match: /\bdata engineer|etl engineer|analytics engineer\b/i, func: "data_eng" },
  { match: /\bml engineer|machine learning|ai engineer|llm engineer|forward deployed engineer|applied ai\b/i, func: "ai_ml" },
  { match: /\bsoftware engineer|backend engineer|frontend engineer|full[- ]?stack|sre|devops|corporate engineer|platform engineer\b/i, func: "engineer" },
  { match: /\bsecurity engineer|infosec|cyber/i, func: "security" },
  { match: /\bidentity|iam |okta\b/i, func: "identity" },
  { match: /\bnetwork engineer|systems engineer|infrastructure engineer/i, func: "it_ops" },
  { match: /\bsales|account manager|account executive|sdr|bdr|business development|enterprise sales|partnerships\b/i, func: "sales" },
  { match: /\bmarketing|growth|seo|sem|brand manager|content marketer\b/i, func: "marketing" },
  { match: /\bcustomer experience|customer support|customer success|csm|knowledge strategist\b/i, func: "cx" },
  { match: /\bhr |hrbp|recruiter|talent acquisition|people operations\b/i, func: "hr" },
  { match: /\boperations|supply chain|logistics|procure|inventory manager\b/i, func: "ops" },
  { match: /\bstrateg|chief of staff|gtm strategy|long-?range plan/i, func: "strategy" },
  { match: /\bproject manager|program manager|technical program manager|pmp\b/i, func: "project_mgmt" },
  { match: /\bnurse|rn |lpn |cna |patient care/i, func: "nursing" },
  { match: /\bpharmacist|pharmacy tech/i, func: "pharmacy" },
  { match: /\bmedical|clinical|hospital|healthcare\b/i, func: "healthcare" },
  { match: /\bwarehouse|forklift|picker|packer|fulfillment\b/i, func: "warehouse" },
  { match: /\bwelder|electrician|plumber|carpenter|hvac|machinist\b/i, func: "trades" },
  { match: /\bconstruction|laborer|mason\b/i, func: "construction" },
  { match: /\bcook|chef|baker|food service|kitchen|line cook|prep cook\b/i, func: "food_service" },
  { match: /\bhotel|housekeep|front desk|hospitality|server|bartender|barista\b/i, func: "hospitality" },
  { match: /\bretail|cashier|sales associate|store associate\b/i, func: "retail" },
  { match: /\bnanny|childcare|eldercare|caregiver|home health/i, func: "caregiving" },
];

function inferJobFunction(title: string | null | undefined, description: string | null | undefined, requiredSkillNames: string[]): JobFunction | null {
  const text = `${title ?? ""} ${(description ?? "").slice(0, 600)}`.toLowerCase();
  // 1. Title / description keyword match wins first.
  for (const rule of JOB_TITLE_RULES) {
    if (rule.match.test(text)) return rule.func;
  }
  // 2. Fall back to the dominant category across the required skills.
  const counts = new Map<JobFunction, number>();
  for (const sn of requiredSkillNames) {
    for (const cat of skillCategories(sn)) {
      if (FUNCTION_KEYSTONES[cat as JobFunction]) {
        counts.set(cat as JobFunction, (counts.get(cat as JobFunction) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return null;
  let best: { f: JobFunction; n: number } | null = null;
  for (const [f, n] of counts) if (!best || n > best.n) best = { f, n };
  return best?.f ?? null;
}

/**
 * For each job function, the set of skill CATEGORIES (from
 * SKILL_CATEGORY_RULES above) that a candidate could plausibly hold to
 * demonstrate fit. A driver role's keystones are driver / driver_cert; an
 * analyst role's keystones include analyst_language / analyst_bi /
 * analyst_office / data_eng.
 */
const FUNCTION_KEYSTONES: Partial<Record<JobFunction, Set<string>>> = {
  driver:        new Set(["driver", "driver_cert"]),
  analyst:       new Set(["analyst_language", "analyst_bi", "analyst_office", "analyst", "data_eng"]),
  data_eng:      new Set(["data_eng", "analyst_language", "devops"]),
  ai_ml:         new Set(["ai_ml", "software_language", "analyst_language"]),
  engineer:      new Set(["software_language", "backend", "frontend", "engineer", "devops"]),
  it_ops:        new Set(["it_ops", "network", "identity", "devops"]),
  security:      new Set(["security", "identity", "it_ops"]),
  identity:      new Set(["identity", "it_ops"]),
  network:       new Set(["network", "it_ops"]),
  sales:         new Set(["sales", "sales_tools", "sales_adtech", "marketing"]),
  marketing:     new Set(["marketing", "sales_adtech"]),
  cx:            new Set(["cx", "cx_tools", "km", "support", "communication"]),
  hr:            new Set(["hr", "leadership", "collaboration"]),
  ops:           new Set(["ops", "project_mgmt", "warehouse"]),
  strategy:      new Set(["strategy", "analyst", "project_mgmt"]),
  project_mgmt:  new Set(["project_mgmt", "leadership"]),
  nursing:       new Set(["nursing", "healthcare"]),
  pharmacy:      new Set(["pharmacy", "healthcare"]),
  healthcare:    new Set(["healthcare", "nursing", "pharmacy"]),
  warehouse:     new Set(["warehouse", "manual_labor"]),
  trades:        new Set(["trades", "manual_labor"]),
  construction:  new Set(["construction", "manual_labor"]),
  manual_labor:  new Set(["manual_labor"]),
  food_service:  new Set(["food_service", "hospitality"]),
  hospitality:   new Set(["hospitality", "food_service", "retail"]),
  retail:        new Set(["retail", "hospitality"]),
  caregiving:    new Set(["caregiving", "healthcare"]),
};

function scoreExperience(c: ScoredCandidate, j: ScoredJob): number {
  const rawYears = c.yearsExperience ?? 0;
  // CONFIDENCE DECAY on foreign work history (Family 1 patent claim).
  //
  // If the candidate's most recent work history is in a country other
  // than the United States AND ended more than 5 years ago, the
  // effective experience years are discounted. Long-stale foreign
  // experience is less predictive of US-job readiness than recent
  // domestic experience. We cap the decay at 50% so a candidate with
  // 20 years of stale foreign work still gets credit for 10.
  const effectiveYears = applyExperienceDecay(rawYears, c);

  if (!j.experienceRequired) return 80;
  if (effectiveYears >= j.experienceRequired) return 100;
  if (effectiveYears === 0) return 20;
  return clamp((effectiveYears / j.experienceRequired) * 100, 0, 100);
}

/**
 * Confidence-decay function. Returns the candidate's effective years of
 * experience after discounting foreign work history that ended ≥5 years
 * ago. Implements Family 1 — "Confidence decay reduces match weight as
 * foreign-credential age increases".
 *
 * - Most recent work history is in the US OR ended in the last 5 years:
 *   no decay, full rawYears.
 * - Most recent foreign work history ended 5–10 years ago: 25% discount.
 * - Ended 10–15 years ago: 40% discount.
 * - Ended 15+ years ago: 50% discount (floor — never below half credit).
 */
function applyExperienceDecay(rawYears: number, c: ScoredCandidate): number {
  if (rawYears === 0) return 0;
  const wh = c.workHistory ?? [];
  if (wh.length === 0) return rawYears;
  // Find the most recent endDate (or now() if isCurrent) across foreign jobs.
  let mostRecentForeignEnd: number | null = null;
  let hasRecentUS = false;
  for (const w of wh) {
    if (!w.country || w.country.toLowerCase() === "us" || w.country.toLowerCase() === "united states") {
      if (w.isCurrent || (w.endDate && (Date.now() - w.endDate.getTime()) / (1000 * 60 * 60 * 24 * 365) < 5)) {
        hasRecentUS = true;
      }
      continue;
    }
    const t = w.isCurrent ? Date.now() : w.endDate?.getTime() ?? 0;
    if (!mostRecentForeignEnd || t > mostRecentForeignEnd) mostRecentForeignEnd = t;
  }
  if (hasRecentUS || !mostRecentForeignEnd) return rawYears;
  const yearsSince = (Date.now() - mostRecentForeignEnd) / (1000 * 60 * 60 * 24 * 365);
  if (yearsSince < 5) return rawYears;
  if (yearsSince < 10) return rawYears * 0.75;
  if (yearsSince < 15) return rawYears * 0.60;
  return rawYears * 0.50;
}

/** Ordered proficiency ladder — index is the rank used for comparisons. */
const PROFICIENCY_RANK: Record<string, number> = {
  none: 0, basic: 1, conversational: 2, fluent: 3, native: 4,
};

function proficiencyRank(p: string | null | undefined): number {
  if (!p) return 0;
  return PROFICIENCY_RANK[p.toLowerCase()] ?? 0;
}

function scoreLanguages(c: ScoredCandidate, j: ScoredJob): number {
  const required = (j.requiredLanguages as unknown as { language: string; proficiency?: string }[]) ?? [];
  if (required.length === 0) return 100;
  const candidateLangs = new Map(
    c.languages.map((l) => [l.language.toLowerCase(), l.proficiency])
  );
  // Per-language credit that respects proficiency (README: "Required vs.
  // spoken with proficiency levels"). A job that doesn't state a required
  // proficiency only needs the language present (any level ≥ basic). When
  // it does state one, meeting-or-exceeding earns full credit, one level
  // short earns partial, absent earns none. Averaged across required langs.
  let total = 0;
  for (const r of required) {
    const held = candidateLangs.get(r.language.toLowerCase());
    if (held === undefined) continue; // candidate doesn't speak it at all
    const heldRank = proficiencyRank(held);
    const needRank = r.proficiency ? proficiencyRank(r.proficiency) : 1; // default: basic presence
    if (heldRank >= needRank) total += 1;
    else if (heldRank >= needRank - 1 && heldRank > 0) total += 0.6; // one step short
    // else: no meaningful credit
  }
  return clamp((total / required.length) * 100, 0, 100);
}

function scoreDistance(c: ScoredCandidate, j: ScoredJob): number {
  if (j.isRemote) return 100;
  if (!c.latitude || !c.longitude || !j.latitude || !j.longitude) {
    // Fallback: ZIP/state match heuristic
    if (c.state && j.state && c.state === j.state) return 70;
    return 50;
  }
  const miles = haversineMiles(c.latitude, c.longitude, j.latitude, j.longitude);
  const maxMi = c.maxCommuteMiles ?? 30;
  if (miles <= maxMi) return 100;
  if (miles <= maxMi * 1.5) return 60;
  if (miles <= maxMi * 2) return 30;
  return 10;
}

function scoreSchedule(c: ScoredCandidate, j: ScoredJob): number {
  const jobAvail = j.availabilityType ?? [];
  const jobShifts = j.shifts ?? [];
  const overlapAvail = arrayOverlap(c.availabilityType, jobAvail);
  const overlapShift = arrayOverlap(c.shiftAvailability, jobShifts);
  if (jobAvail.length === 0 && jobShifts.length === 0) return 80;
  let score = 0;
  if (jobAvail.length > 0) {
    score += overlapAvail ? 50 : 0;
  } else {
    score += 50;
  }
  if (jobShifts.length > 0) {
    score += overlapShift ? 50 : 0;
  } else {
    score += 50;
  }
  return clamp(score, 0, 100);
}

function scoreCertifications(c: ScoredCandidate, j: ScoredJob): number {
  const requiredCerts = j.requiredCertifications ?? [];
  if (requiredCerts.length === 0) return 100;
  const cset = new Set(
    c.skills
      .filter((s) => s.skill.type === "certification")
      .map((s) => s.skill.name.toLowerCase())
  );
  const have = requiredCerts.filter((r) => cset.has(r.toLowerCase())).length;
  return clamp((have / requiredCerts.length) * 100, 0, 100);
}

function scoreTransportation(c: ScoredCandidate, j: ScoredJob): number {
  const transport = c.transportationTypes ?? [];
  if (!j.transportationRequired) {
    if (j.transitAccessible) return 100;
    return transport.length > 0 ? 90 : 70;
  }
  // Job requires transportation
  if (transport.includes("own_vehicle") && c.hasDriversLicense) return 100;
  if (transport.includes("carpool") || transport.includes("rideshare")) return 70;
  if (j.transitAccessible && transport.includes("public_transit")) return 80;
  return 30;
}

function collectGaps(
  c: ScoredCandidate,
  j: ScoredJob,
  scores: Partial<ComponentScores> & { coverage?: number; coverageMatched?: number; coverageTotal?: number },
  graph?: Map<string, Set<string>>,
  transferable?: { from: string; to: string; confidence: number }[],
): string[] {
  const gaps: string[] = [];

  // Lead with the coverage line so the employer/case worker sees up front
  // whether this candidate has the essential skills at all. When coverage
  // is below 50%, this drives the composite cap and explains a moderate
  // score better than any single missing-skill line.
  if (scores.coverageTotal != null && scores.coverageTotal > 0 && scores.coverage != null && scores.coverage < 0.8) {
    const pct = Math.round((scores.coverage ?? 0) * 100);
    gaps.push(`Essential-skill coverage: ${scores.coverageMatched}/${scores.coverageTotal} (${pct}%). The composite is capped at ${Math.round(40 + (scores.coverage ?? 0) * 60)} until coverage clears 100%.`);
  }

  // List the SPECIFIC required skills the candidate is missing — and pair
  // each with a one-line "how to acquire" suggestion so the case worker
  // (or candidate) knows the next concrete step.
  if ((scores.skillsScore ?? 100) < 100) {
    const required = j.skills.filter((s) => s.isRequired);
    const candidateSkillIds = new Set(c.skills.map((s) => s.skillId));
    const bridgedRequiredNames = new Set((transferable ?? []).map((t) => t.to));

    const missing: string[] = [];
    for (const req of required) {
      if (candidateSkillIds.has(req.skillId)) continue;
      if (bridgedRequiredNames.has(req.skill.name)) continue;  // already covered by a transferable bridge
      // If the graph has any candidate->required edge, also skip
      let bridged = false;
      if (graph) {
        const reqRelated = graph.get(req.skillId);
        if (reqRelated) {
          for (const cs of c.skills) if (reqRelated.has(cs.skillId)) { bridged = true; break; }
        }
      }
      if (bridged) continue;
      missing.push(req.skill.name);
    }
    if (missing.length) {
      const detail = missing.slice(0, 5).map((n) => `${n} — ${acquireSuggestion(n)}`).join("; ");
      const more = missing.length > 5 ? ` (+${missing.length - 5} more)` : "";
      gaps.push(`Missing skill${missing.length > 1 ? "s" : ""}: ${detail}${more}`);
    }
  }

  if ((scores.certificationScore ?? 100) < 100 && (j.requiredCertifications?.length ?? 0)) {
    const cset = new Set(c.skills.filter((s) => s.skill.type === "certification").map((s) => s.skill.name));
    const missing = (j.requiredCertifications ?? []).filter((r) => !cset.has(r));
    if (missing.length) {
      const detail = missing.map((n) => `${n} — ${acquireSuggestion(n)}`).join("; ");
      gaps.push(`Missing certifications: ${detail}`);
    }
  }
  if ((scores.languageScore ?? 100) < 70) gaps.push("Language mismatch — ESL classes (3–6 months) via local resettlement agency or community college");
  if ((scores.distanceScore ?? 100) < 50) gaps.push("Beyond preferred commute distance — consider relocation assistance or remote/hybrid roles");
  return gaps;
}

/**
 * One-line "how to acquire" hint for a missing skill / certification.
 *
 * Driven by keyword lookup so a single entry covers many JD phrasings
 * (e.g. "Salesforce", "Salesforce CRM", "SFDC administrator" all hit the
 * Salesforce row). Order matters — first match wins.
 *
 * Falls back to a generic self-study suggestion when nothing matches.
 */
function acquireSuggestion(skill: string): string {
  const s = skill.toLowerCase();
  for (const [needle, hint] of ACQUIRE_TABLE) if (s.includes(needle)) return hint;
  return "free online courses (Khan Academy / Coursera audit) — 2–6 weeks self-study";
}

const ACQUIRE_TABLE: [string, string][] = [
  // Software / engineering
  ["python",          "Coursera 'Python for Everybody' (free audit) — 8 weeks"],
  ["javascript",      "freeCodeCamp JavaScript curriculum — 6–10 weeks, free"],
  ["typescript",      "Total TypeScript free tier + 1 production project — 4–8 weeks"],
  ["react",           "React.dev official tutorial → freeCodeCamp 'Frontend Libraries' — 6 weeks"],
  ["node",            "The Odin Project Node.js path — 6–8 weeks, free"],
  ["sql",             "Mode Analytics SQL tutorial (free) — 2 weeks to fluency"],
  ["aws",             "AWS Cloud Practitioner free training + $100 exam — 4–6 weeks"],
  ["azure",           "Microsoft Learn Azure Fundamentals (free) — 4 weeks to AZ-900"],
  ["cloud",           "AWS/Azure/GCP free tier + Cloud Practitioner cert — 4–6 weeks"],
  ["data analysis",   "Google Data Analytics Certificate (Coursera, financial aid available) — 6 months"],
  ["data science",    "DataCamp 'Data Scientist' track (free 7-day trial → financial aid) — 3–6 months"],
  ["machine learning","Andrew Ng's ML course on Coursera (free audit) — 11 weeks"],
  ["product management","Reforma Product Discovery + 1 portfolio case — 8–12 weeks"],
  ["devops",          "Linux Foundation LFS101 free intro → KodeKloud labs — 6–10 weeks"],
  ["security",        "TryHackMe free path → CompTIA Security+ ($380 voucher) — 3–6 months"],

  // CRM / sales / marketing
  ["salesforce",      "Trailhead.salesforce.com (free) → Salesforce Admin cert — 1–3 months"],
  ["sfdc",            "Trailhead.salesforce.com (free) → Salesforce Admin cert — 1–3 months"],
  ["crm",             "Trailhead.salesforce.com OR HubSpot Academy (free) — 4–8 weeks"],
  ["hubspot",         "HubSpot Academy free certifications — 2–4 weeks"],
  ["seo",             "Semrush Academy or Ahrefs Academy (free) — 4 weeks"],
  ["sem",             "Google Skillshop Search Ads cert (free) — 2–3 weeks"],
  ["google ads",      "Google Skillshop free certs (Search, Display, Video) — 2–4 weeks"],
  ["account manage",  "HubSpot Academy 'Inbound Sales' free cert + shadowing — 4–6 weeks"],
  ["sales develop",   "Pavilion SDR Academy or Vendition apprenticeship — 4–12 weeks"],
  ["business develop","HubSpot Sales + LinkedIn 'BD Fundamentals' — 4–6 weeks"],
  ["customer success","Gainsight free PulseLocal training + CSM cert — 6–10 weeks"],

  // CPG / advertising / retail media
  ["cpg",             "Coursera 'Marketing in a Digital World' (UIUC, free audit) — 4 weeks"],
  ["retail media",    "Trade Desk Edge Academy (free) → entry-level adtech roles — 4–6 weeks"],
  ["advertising",     "Google Skillshop + IAB Digital Marketing & Media Foundations cert — 6 weeks"],
  ["media buy",       "Trade Desk Edge Academy free certs — 4–6 weeks"],
  ["analytics",       "Google Analytics free cert + Looker Studio practice — 3–4 weeks"],
  ["tableau",         "Tableau Public + free Tableau eLearning — 4 weeks to Specialist"],
  ["power bi",        "Microsoft Learn 'Analyst Associate' (free) — 4–6 weeks to PL-300"],
  ["excel",           "Excel Easy + ExcelJet free tutorials + 1 project — 2–4 weeks"],
  ["sheets",          "Google Sheets free training in Workspace Learning Center — 2 weeks"],

  // Operations / management
  ["project manage",  "PMI 'Project Management Basics' free + Google PM Certificate — 3–6 months"],
  ["program manage",  "Coursera Google Project Management Cert + 1 case study — 6 months"],
  ["six sigma",       "Council for Six Sigma Yellow Belt (free) — 2–4 weeks"],
  ["operations",      "Coursera 'Supply Chain Fundamentals' (Rutgers, free audit) — 4 weeks"],
  ["supply chain",    "edX 'MITx Supply Chain Fundamentals' free audit — 12 weeks"],
  ["procurement",     "CIPS Level 2 free intro + employer-sponsored study — 3–6 months"],

  // Healthcare-adjacent
  ["medical",         "Free Coursera 'AI in Healthcare' audit + CNA training $300–800 — 4–12 weeks"],
  ["clinical",        "Local community college CNA / MA certificate — 4–12 weeks, ~$800"],
  ["nursing",         "CNA cert ($300–800, 4–8 weeks) → LPN bridge program (12–18 mo)"],
  ["pharmacy",        "Pharmacy Tech (PTCB) cert — 3–9 months, ~$500–1,500"],

  // Hospitality / food / trades
  ["servsafe",        "ServSafe Food Handler online cert — 1 week, $15"],
  ["food safety",     "ServSafe Food Handler online cert — 1 week, $15"],
  ["cdl",             "CDL school 3–7 weeks, $3K–7K (many employers reimburse)"],
  ["forklift",        "OSHA-compliant forklift cert at warehouse staffing agency — 1 day"],
  ["osha",            "OSHA 10 / 30 online cert — 10–30 hours, $60–180"],
  ["welding",         "Community-college welding certificate — 6–9 months"],
  ["hvac",            "EPA 608 universal cert + community-college HVAC program — 6–18 months"],
  ["electrical",      "Pre-apprenticeship + IBEW/IEC apprenticeship — 4 years (paid)"],

  // Soft / general
  ["communication",   "Toastmasters local club ($90/6mo) + LinkedIn Learning 'Communication Foundations'"],
  ["leadership",      "LinkedIn Learning 'Leadership Foundations' + take on a small team project"],
  ["english",         "ESL classes via local resettlement agency or community college — 3–6 months"],
  ["bilingual",       "Already met if candidate has the target language"],

  // Driving
  ["driver",          "State DMV driver's license + clean record — varies by state"],
  ["delivery",        "Personal vehicle + delivery-platform onboarding (DoorDash/Instacart) — 1–2 weeks"],
];

function recommendationFor(score: number): MatchResult["recommendation"] {
  if (score >= 90) return "recommended";
  if (score >= 75) return "strong_match";
  if (score >= 55) return "moderate_match";
  if (score >= 35) return "weak_match";
  return "not_recommended";
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function arrayOverlap<T>(a: T[] | null | undefined, b: T[] | null | undefined): boolean {
  if (!a || !b) return false;
  const s = new Set(a);
  return b.some((x) => s.has(x));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
