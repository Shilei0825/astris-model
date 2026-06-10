# Astris HR — Model

The matching, retention-forecasting, and labor-statistics engine that powers
[Astris HR](https://www.astrishr.com). Pure TypeScript, no external model
APIs, no database dependency in the hot path — the library takes plain inputs
and returns scores.

## What's inside

```
src/
├── matcher/
│   ├── types.ts            # ScoredCandidate, ScoredJob, MatchResult, ...
│   ├── scoring.ts          # 7-component industry-aware composite
│   └── counterfactual.ts   # "what if candidate had cert X?" rescorer
├── labor-stats/
│   ├── industry-turnover.ts  # BLS JOLTS + Census LEHD QWI lookup
│   └── wage-tables.ts        # BLS OEWS + Census ACS metro multipliers
└── training/
    ├── logreg.ts           # Logistic regression (Adam)
    ├── gbdt.ts             # XGBoost-flavor gradient-boosted trees
    ├── mlp.ts              # Multilayer perceptron (Adam + ReLU + L2)
    └── kmeans.ts           # K-means clustering for cohort discovery
```

## Composite matcher

Seven weighted components per (candidate, job) pair:

| Component       | Default weight | Notes                                            |
|-----------------|---------------:|--------------------------------------------------|
| Skills          |            40% | Fuzzy + category-bridged + transferable credit   |
| Experience      |            20% | Confidence decay on stale foreign work history   |
| Language        |            10% | Required vs. spoken with proficiency levels      |
| Distance        |            10% | Haversine + state proximity fallback             |
| Schedule        |            10% | Shift / hours-per-week / availability            |
| Certification   |             5% | Required vs. held + months-to-acquire estimate   |
| Transportation  |             5% | License class + reliable vehicle access          |

Weight profiles vary by industry (warehouse / hospitality / manufacturing /
agriculture / driver / analyst / engineer) — inferred from job title +
description. An essential-skill coverage cap prevents inflated overall scores
when key required skills are missing:

```
overall_capped = min(weighted_average, 40 + coverage_ratio × 60)
```

## Retention forecast

`baseline_T = (1 − monthly_quits_rate)^T_months`, anchored to a real federal
labor turnover rate, then bent up or down by a candidate-stability and
component-fit composite:

```
P(stays_T | candidate, job) = clip(baseline_T + Δ_stability + Δ_fit, 0, 1)
```

The turnover rate prefers Census LEHD QWI (state × NAICS-supersector,
quarterly) and falls back to BLS JOLTS (national, monthly) when the QWI cell
is empty. Both are pulled by `industry-turnover.ts` from in-memory caches
that callers populate from the BLS + Census public APIs (free, no key
required for QWI / OEWS; ACS needs a free Census key).

Trapezoidal area under the survival curve over 365 days gives the expected
tenure in days. The forecast is exposed at the 30 / 90 / 180 / 365-day
milestones.

## Wage context

Combines BLS OEWS occupation medians (95 SOC-detail occupations × 60 MSAs)
with a metro cost-of-labor multiplier:

- **Live multiplier:** Census ACS metro median household income / national
  median household income ($74,580). Covers all 410+ MSAs.
- **Seed multiplier:** Hand-curated 60-MSA table as the fallback.

Returns the metro-adjusted median plus P25–P75 band plus the offer's
percentile within peers in the same metro:

```
context = { median, p10, p25, p75, p90, peerCount, sourceQuarter, source }
```

## Ensemble

The composite scorer is intended to slot into an ensemble together with:

1. A retention sub-model (logistic regression trained on labeled
   placement / 90-day / 365-day outcomes).
2. A skills-embedding similarity sub-model.
3. A demographic disparate-impact monitor (4/5ths rule).

Ensemble weights are stored in a registry external to this library — the
library produces sub-scores; the orchestrator combines them.

## Training utilities

Pure-TypeScript implementations of the four learning algorithms used in the
ensemble. No native bindings, no GPU, no Python — they run in a Node 18
worker on a single CPU core because the labeled cohort is small (hundreds
to low thousands of placements) and the feature dimension is small (<256).

| Algorithm           | File                  | Notes                                              |
|---------------------|-----------------------|----------------------------------------------------|
| Logistic regression | `training/logreg.ts`  | Adam, L2, early-stop on validation log-loss        |
| GBDT (XGBoost-ish)  | `training/gbdt.ts`    | Pre-sorted feature splits, depth-limited regression|
| MLP                 | `training/mlp.ts`     | He init, ReLU hidden, sigmoid output, L2, Adam     |
| K-means             | `training/kmeans.ts`  | k-means++ init, cosine + L2 distance               |

All four expose the same shape:

```ts
const { model, history } = train(X, y, hyperparams);
const yhat = predict(model, X_test);
```

## Labor data — sourcing

The library does not fetch network data on its own. Callers populate the
in-memory caches before calling `turnoverForIndustryAndState()` or
`wageContext()`:

```ts
import { setLiveWageCache } from "@astris/model/labor-stats";

// fetch OEWS + ACS rows from your scheduler
const rows = await fetchOewsAndAcsRows();
setLiveWageCache(rows);

// now hot-path calls hit the cache
const ctx = wageContext("Forklift operator", "Newark", "NJ");
```

Same pattern for `turnoverForIndustryAndState(industry, state, qwiCache)` —
pass in the QWI rows you fetched from
`https://api.census.gov/data/timeseries/qwi/sa`.

## License

MIT — see [LICENSE](./LICENSE).
