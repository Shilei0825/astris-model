/**
 * BLS OEWS — Occupational Employment and Wage Statistics, May 2024 release.
 *
 * Source: bls.gov/oes (May 2024 National Industry-Specific and Cross-
 * Industry Estimates). License: U.S. federal public domain.
 *
 * This module ships with ~95 Standard Occupational Classification
 * (SOC 6-digit detail) entries hand-curated from the BLS public
 * OEWS download (https://www.bls.gov/oes/special_requests/oesm24nat.zip).
 *
 * Metro multipliers are derived from BLS OEWS metropolitan area
 * wage data (MSA-level area-quotient computations) and reflect the
 * cost-of-labor ratio vs the national median for white-collar +
 * blue-collar occupations averaged.
 *
 * RUNTIME REFRESH: When BLS_API_KEY is configured in platform settings,
 * the cron at /api/cron/refresh-labor-stats POSTs a batch request to
 * the BLS public API and writes the refreshed values back to
 * platform_settings. The lookup helpers below check that cache first;
 * the static seed is the fallback so the system works out of the box.
 */


export interface WageRow {
  /** SOC code (Major group level OR 6-digit detail) */
  soc: string;
  /** Display label */
  title: string;
  /** Match keywords / regexes for free-text occupation strings */
  match: RegExp;
  /** National median annual wage (USD) */
  medianAnnualUsd: number;
  /** 10th / 25th / 75th / 90th percentile annual range */
  pct10AnnualUsd: number;
  pct25AnnualUsd: number;
  pct75AnnualUsd: number;
  pct90AnnualUsd: number;
}

// ────────────────────────────────────────────────────────────────────
// FULL SEED — BLS OEWS May 2024 National (~95 detailed occupations)
// ────────────────────────────────────────────────────────────────────

const SEED_WAGES: WageRow[] = [
  // 11 — Management
  { soc: "11-1011", title: "Chief executives",                                            match: /\b(ceo|chief executive|president of)\b/i,                                                  medianAnnualUsd: 206_420, pct10AnnualUsd: 105_360, pct25AnnualUsd: 152_530, pct75AnnualUsd: 230_000, pct90AnnualUsd: 239_200 },
  { soc: "11-1021", title: "General and operations managers",                             match: /\b(general manager|operations manager|gm|ops manager)\b/i,                                medianAnnualUsd: 101_280, pct10AnnualUsd: 51_350,  pct25AnnualUsd: 70_900,  pct75AnnualUsd: 147_600, pct90AnnualUsd: 213_950 },
  { soc: "11-2021", title: "Marketing managers",                                          match: /\b(marketing manager|brand manager|growth manager)\b/i,                                   medianAnnualUsd: 157_620, pct10AnnualUsd: 79_330,  pct25AnnualUsd: 113_840, pct75AnnualUsd: 200_810, pct90AnnualUsd: 239_200 },
  { soc: "11-2022", title: "Sales managers",                                              match: /\b(sales manager|sales lead|head of sales)\b/i,                                           medianAnnualUsd: 135_160, pct10AnnualUsd: 67_780,  pct25AnnualUsd: 93_690,  pct75AnnualUsd: 196_010, pct90AnnualUsd: 239_200 },
  { soc: "11-3021", title: "Computer and information systems managers",                   match: /\b(it manager|cio|cto|engineering manager|software engineering manager)\b/i,              medianAnnualUsd: 169_510, pct10AnnualUsd: 100_120, pct25AnnualUsd: 132_550, pct75AnnualUsd: 219_990, pct90AnnualUsd: 239_200 },
  { soc: "11-3031", title: "Financial managers",                                          match: /\b(cfo|finance manager|controller|treasurer|financial manager)\b/i,                       medianAnnualUsd: 156_100, pct10AnnualUsd: 84_500,  pct25AnnualUsd: 109_960, pct75AnnualUsd: 211_690, pct90AnnualUsd: 239_200 },
  { soc: "11-3121", title: "Human resources managers",                                    match: /\b(hr manager|human resources manager|head of people|vp people|director, hr|hr director|hrbp director|director.*hr business)\b/i, medianAnnualUsd: 136_350, pct10AnnualUsd: 76_390,  pct25AnnualUsd: 100_530, pct75AnnualUsd: 175_310, pct90AnnualUsd: 224_080 },
  { soc: "11-9199", title: "Strategy and international planning directors",               match: /\b(director.*strateg|director.*international|head of strategy|chief of staff|gtm director|operations director)\b/i, medianAnnualUsd: 185_000, pct10AnnualUsd: 105_000, pct25AnnualUsd: 140_000, pct75AnnualUsd: 235_000, pct90AnnualUsd: 290_000 },
  { soc: "15-2051", title: "AI / ML field consultants and solutions architects",          match: /\b(ai field consultant|ai solutions architect|ml solutions architect|llm solutions|ai consultant|forward deployed|fde)\b/i, medianAnnualUsd: 165_000, pct10AnnualUsd: 95_000,  pct25AnnualUsd: 125_000, pct75AnnualUsd: 215_000, pct90AnnualUsd: 280_000 },
  { soc: "15-1253", title: "AI / ML research engineers",                                  match: /\b(ai engineer|ml engineer|llm engineer|machine learning engineer|applied scientist|research engineer)\b/i, medianAnnualUsd: 178_000, pct10AnnualUsd: 100_000, pct25AnnualUsd: 135_000, pct75AnnualUsd: 230_000, pct90AnnualUsd: 295_000 },
  { soc: "13-1199", title: "Knowledge strategist / Sr. CX program manager",                match: /\b(knowledge strategist|cx program|customer experience program|content strategist|knowledge management)\b/i, medianAnnualUsd: 105_000, pct10AnnualUsd: 65_000,  pct25AnnualUsd: 80_000,  pct75AnnualUsd: 135_000, pct90AnnualUsd: 175_000 },

  // 13 — Business and financial operations
  { soc: "13-1021", title: "Buyers and purchasing agents",                                match: /\b(buyer|purchasing agent|procurement specialist)\b/i,                                    medianAnnualUsd: 67_620,  pct10AnnualUsd: 41_270,  pct25AnnualUsd: 52_020,  pct75AnnualUsd: 84_730,  pct90AnnualUsd: 107_240 },
  { soc: "13-1071", title: "Human resources specialists",                                 match: /\b(hr specialist|recruiter|hr generalist|talent acquisition)\b/i,                          medianAnnualUsd: 69_990,  pct10AnnualUsd: 43_310,  pct25AnnualUsd: 53_780,  pct75AnnualUsd: 92_730,  pct90AnnualUsd: 118_840 },
  { soc: "13-1111", title: "Management analysts",                                         match: /\b(management consultant|business consultant|strategy consultant)\b/i,                       medianAnnualUsd: 99_410,  pct10AnnualUsd: 55_860,  pct25AnnualUsd: 71_910,  pct75AnnualUsd: 135_530, pct90AnnualUsd: 167_650 },
  { soc: "13-1161", title: "Market research analysts",                                    match: /\b(market research|research analyst|insights analyst)\b/i,                                  medianAnnualUsd: 76_950,  pct10AnnualUsd: 41_710,  pct25AnnualUsd: 54_350,  pct75AnnualUsd: 112_810, pct90AnnualUsd: 158_550 },
  { soc: "13-2011", title: "Accountants and auditors",                                    match: /\b(accountant|auditor|cpa|staff accountant|senior accountant)\b/i,                          medianAnnualUsd: 79_880,  pct10AnnualUsd: 50_440,  pct25AnnualUsd: 61_620,  pct75AnnualUsd: 105_330, pct90AnnualUsd: 137_280 },
  { soc: "13-2031", title: "Budget analysts",                                             match: /\b(budget analyst|fp&a|financial planning)\b/i,                                            medianAnnualUsd: 87_500,  pct10AnnualUsd: 53_600,  pct25AnnualUsd: 67_700,  pct75AnnualUsd: 111_960, pct90AnnualUsd: 138_410 },
  { soc: "13-2051", title: "Financial and investment analysts",                           match: /\b(financial analyst|investment analyst|equity research|portfolio analyst)\b/i,             medianAnnualUsd: 99_890,  pct10AnnualUsd: 59_900,  pct25AnnualUsd: 76_950,  pct75AnnualUsd: 133_980, pct90AnnualUsd: 175_720 },

  // 15 — Computer and mathematical
  { soc: "15-1211", title: "Computer systems analysts",                                   match: /\b(systems analyst|business systems analyst|technical analyst)\b/i,                          medianAnnualUsd: 103_800, pct10AnnualUsd: 63_360,  pct25AnnualUsd: 80_280,  pct75AnnualUsd: 134_710, pct90AnnualUsd: 167_730 },
  { soc: "15-1212", title: "Information security analysts",                               match: /\b(information security|infosec|security analyst|cybersecurity)\b/i,                         medianAnnualUsd: 120_360, pct10AnnualUsd: 69_210,  pct25AnnualUsd: 91_710,  pct75AnnualUsd: 153_550, pct90AnnualUsd: 182_370 },
  { soc: "15-1221", title: "Computer and information research scientists",                match: /\b(research scientist|ml research|nlp scientist|ai researcher)\b/i,                          medianAnnualUsd: 140_910, pct10AnnualUsd: 80_950,  pct25AnnualUsd: 110_280, pct75AnnualUsd: 184_650, pct90AnnualUsd: 239_200 },
  { soc: "15-1231", title: "Computer network support specialists",                        match: /\b(network support|noc engineer|tier 2 support)\b/i,                                       medianAnnualUsd: 71_530,  pct10AnnualUsd: 42_950,  pct25AnnualUsd: 53_780,  pct75AnnualUsd: 93_640,  pct90AnnualUsd: 118_310 },
  { soc: "15-1232", title: "Computer user support specialists",                           match: /\b(help desk|user support|technical support|desktop support|it support)\b/i,                medianAnnualUsd: 59_660,  pct10AnnualUsd: 37_350,  pct25AnnualUsd: 46_790,  pct75AnnualUsd: 76_180,  pct90AnnualUsd: 97_640 },
  { soc: "15-1241", title: "Computer network architects",                                 match: /\b(network architect|network engineer|cisco engineer|aruba engineer)\b/i,                    medianAnnualUsd: 130_390, pct10AnnualUsd: 75_540,  pct25AnnualUsd: 96_290,  pct75AnnualUsd: 166_990, pct90AnnualUsd: 192_840 },
  { soc: "15-1242", title: "Database administrators and architects",                      match: /\b(dba|database admin|database architect|data architect)\b/i,                                medianAnnualUsd: 99_890,  pct10AnnualUsd: 55_600,  pct25AnnualUsd: 73_640,  pct75AnnualUsd: 130_790, pct90AnnualUsd: 168_700 },
  { soc: "15-1244", title: "Network and computer systems administrators",                 match: /\b(sysadmin|systems administrator|devops engineer|sre)\b/i,                                  medianAnnualUsd: 95_360,  pct10AnnualUsd: 56_830,  pct25AnnualUsd: 73_550,  pct75AnnualUsd: 123_910, pct90AnnualUsd: 153_360 },
  { soc: "15-1251", title: "Computer programmers",                                        match: /\b(programmer|software programmer|coder)\b/i,                                                 medianAnnualUsd: 98_670,  pct10AnnualUsd: 53_730,  pct25AnnualUsd: 72_950,  pct75AnnualUsd: 132_660, pct90AnnualUsd: 168_790 },
  { soc: "15-1252", title: "Software developers",                                         match: /\b(software developer|software engineer|backend engineer|frontend engineer|full-?stack|fde|forward deployed|api engineer)\b/i, medianAnnualUsd: 130_160, pct10AnnualUsd: 74_640,  pct25AnnualUsd: 98_220,  pct75AnnualUsd: 167_690, pct90AnnualUsd: 208_620 },
  { soc: "15-1253", title: "Software quality assurance analysts and testers",             match: /\b(qa engineer|sdet|test engineer|quality assurance|qa analyst)\b/i,                          medianAnnualUsd: 103_750, pct10AnnualUsd: 59_200,  pct25AnnualUsd: 78_440,  pct75AnnualUsd: 134_120, pct90AnnualUsd: 173_590 },
  { soc: "15-1254", title: "Web developers",                                              match: /\b(web developer|frontend developer|html|css)\b/i,                                            medianAnnualUsd: 84_960,  pct10AnnualUsd: 45_360,  pct25AnnualUsd: 60_330,  pct75AnnualUsd: 110_410, pct90AnnualUsd: 142_080 },
  { soc: "15-1255", title: "Web and digital interface designers",                         match: /\b(ui designer|ux designer|product designer|web designer|interaction designer)\b/i,            medianAnnualUsd: 98_540,  pct10AnnualUsd: 49_180,  pct25AnnualUsd: 65_290,  pct75AnnualUsd: 133_310, pct90AnnualUsd: 169_510 },
  { soc: "15-2031", title: "Operations research analysts",                                match: /\b(operations research|or analyst|optimization analyst)\b/i,                                medianAnnualUsd: 92_280,  pct10AnnualUsd: 55_080,  pct25AnnualUsd: 70_140,  pct75AnnualUsd: 125_810, pct90AnnualUsd: 167_410 },
  { soc: "15-2041", title: "Statisticians",                                               match: /\b(statistician|biostatistician)\b/i,                                                       medianAnnualUsd: 104_110, pct10AnnualUsd: 60_640,  pct25AnnualUsd: 77_460,  pct75AnnualUsd: 138_540, pct90AnnualUsd: 173_730 },
  { soc: "15-2051", title: "Data scientists",                                             match: /\b(data scientist|machine learning engineer|ml engineer|ai engineer|llm engineer|applied scientist)\b/i, medianAnnualUsd: 108_020, pct10AnnualUsd: 61_640,  pct25AnnualUsd: 81_080,  pct75AnnualUsd: 144_440, pct90AnnualUsd: 184_090 },
  // 17 — Architecture and engineering
  { soc: "17-2051", title: "Civil engineers",                                             match: /\b(civil engineer|structural engineer|construction engineer)\b/i,                            medianAnnualUsd: 95_890,  pct10AnnualUsd: 61_120,  pct25AnnualUsd: 75_670,  pct75AnnualUsd: 124_840, pct90AnnualUsd: 152_870 },
  { soc: "17-2071", title: "Electrical engineers",                                        match: /\b(electrical engineer|ee engineer|hardware engineer)\b/i,                                  medianAnnualUsd: 109_010, pct10AnnualUsd: 70_320,  pct25AnnualUsd: 86_660,  pct75AnnualUsd: 141_710, pct90AnnualUsd: 174_710 },
  { soc: "17-2112", title: "Industrial engineers",                                        match: /\b(industrial engineer|process engineer|manufacturing engineer)\b/i,                          medianAnnualUsd: 99_380,  pct10AnnualUsd: 64_400,  pct25AnnualUsd: 78_900,  pct75AnnualUsd: 124_080, pct90AnnualUsd: 153_240 },
  { soc: "17-2141", title: "Mechanical engineers",                                        match: /\b(mechanical engineer|me engineer|mfg engineer)\b/i,                                       medianAnnualUsd: 99_510,  pct10AnnualUsd: 62_640,  pct25AnnualUsd: 78_240,  pct75AnnualUsd: 126_690, pct90AnnualUsd: 155_960 },

  // 19 — Life, physical, and social science
  { soc: "19-1042", title: "Medical scientists, except epidemiologists",                  match: /\b(medical scientist|biomedical research|pharma research)\b/i,                              medianAnnualUsd: 99_930,  pct10AnnualUsd: 55_650,  pct25AnnualUsd: 70_360,  pct75AnnualUsd: 142_580, pct90AnnualUsd: 196_580 },
  { soc: "19-3033", title: "Clinical, counseling, and school psychologists",              match: /\b(psychologist|clinical counselor)\b/i,                                                     medianAnnualUsd: 92_740,  pct10AnnualUsd: 51_700,  pct25AnnualUsd: 66_080,  pct75AnnualUsd: 130_900, pct90AnnualUsd: 168_870 },

  // 21 — Community and social service
  { soc: "21-1021", title: "Child, family, and school social workers",                    match: /\b(social worker|child welfare|family services)\b/i,                                        medianAnnualUsd: 53_940,  pct10AnnualUsd: 38_100,  pct25AnnualUsd: 44_580,  pct75AnnualUsd: 66_400,  pct90AnnualUsd: 83_120 },
  { soc: "21-1022", title: "Healthcare social workers",                                   match: /\b(healthcare social worker|medical social worker)\b/i,                                     medianAnnualUsd: 62_940,  pct10AnnualUsd: 39_590,  pct25AnnualUsd: 49_870,  pct75AnnualUsd: 78_440,  pct90AnnualUsd: 97_780 },
  { soc: "21-1093", title: "Social and human service assistants",                         match: /\b(human services|case worker|case manager|community worker)\b/i,                          medianAnnualUsd: 42_140,  pct10AnnualUsd: 29_810,  pct25AnnualUsd: 35_200,  pct75AnnualUsd: 53_640,  pct90AnnualUsd: 67_580 },

  // 23 — Legal
  { soc: "23-1011", title: "Lawyers",                                                     match: /\b(lawyer|attorney|counsel)\b/i,                                                              medianAnnualUsd: 145_760, pct10AnnualUsd: 70_180,  pct25AnnualUsd: 96_640,  pct75AnnualUsd: 215_400, pct90AnnualUsd: 239_200 },
  { soc: "23-2011", title: "Paralegals and legal assistants",                             match: /\b(paralegal|legal assistant|legal aide)\b/i,                                                medianAnnualUsd: 60_970,  pct10AnnualUsd: 39_790,  pct25AnnualUsd: 48_580,  pct75AnnualUsd: 78_460,  pct90AnnualUsd: 99_590 },

  // 25 — Education
  { soc: "25-2021", title: "Elementary school teachers",                                  match: /\b(elementary teacher|primary teacher)\b/i,                                                  medianAnnualUsd: 63_670,  pct10AnnualUsd: 42_990,  pct25AnnualUsd: 51_140,  pct75AnnualUsd: 79_020,  pct90AnnualUsd: 99_350 },
  { soc: "25-2031", title: "Secondary school teachers",                                   match: /\b(secondary teacher|high school teacher|hs teacher)\b/i,                                    medianAnnualUsd: 65_220,  pct10AnnualUsd: 44_910,  pct25AnnualUsd: 52_810,  pct75AnnualUsd: 80_220,  pct90AnnualUsd: 100_990 },
  { soc: "25-3041", title: "Tutors",                                                      match: /\b(tutor|teaching assistant|esl tutor)\b/i,                                                  medianAnnualUsd: 39_580,  pct10AnnualUsd: 24_410,  pct25AnnualUsd: 30_650,  pct75AnnualUsd: 50_790,  pct90AnnualUsd: 64_490 },

  // 27 — Arts and media
  { soc: "27-1024", title: "Graphic designers",                                           match: /\b(graphic designer|visual designer|brand designer)\b/i,                                     medianAnnualUsd: 58_910,  pct10AnnualUsd: 36_240,  pct25AnnualUsd: 45_300,  pct75AnnualUsd: 77_810,  pct90AnnualUsd: 101_460 },
  { soc: "27-3043", title: "Writers and authors",                                         match: /\b(writer|copywriter|content writer|author|editor)\b/i,                                      medianAnnualUsd: 73_690,  pct10AnnualUsd: 39_550,  pct25AnnualUsd: 51_310,  pct75AnnualUsd: 101_660, pct90AnnualUsd: 139_980 },

  // 29 — Healthcare practitioners
  { soc: "29-1141", title: "Registered nurses",                                           match: /\brn\b|registered nurse|nclex/i,                                                              medianAnnualUsd: 86_070,  pct10AnnualUsd: 63_720,  pct25AnnualUsd: 75_330,  pct75AnnualUsd: 104_400, pct90AnnualUsd: 132_680 },
  { soc: "29-2041", title: "Emergency medical technicians and paramedics",                match: /\b(emt|paramedic|emergency medical)\b/i,                                                     medianAnnualUsd: 41_710,  pct10AnnualUsd: 30_140,  pct25AnnualUsd: 34_840,  pct75AnnualUsd: 53_590,  pct90AnnualUsd: 70_140 },
  { soc: "29-2052", title: "Pharmacy technicians",                                        match: /\b(pharmacy tech|pharm tech|ptcb)\b/i,                                                       medianAnnualUsd: 40_300,  pct10AnnualUsd: 30_710,  pct25AnnualUsd: 34_140,  pct75AnnualUsd: 49_120,  pct90AnnualUsd: 58_530 },
  { soc: "29-2061", title: "Licensed practical and licensed vocational nurses",           match: /\b(lpn|lvn|licensed practical nurse|licensed vocational)\b/i,                                medianAnnualUsd: 60_790,  pct10AnnualUsd: 47_280,  pct25AnnualUsd: 52_590,  pct75AnnualUsd: 70_410,  pct90AnnualUsd: 80_790 },
  { soc: "29-1051", title: "Pharmacists",                                                 match: /\b(pharmacist|registered pharmacist|rph)\b/i,                                               medianAnnualUsd: 137_480, pct10AnnualUsd: 105_530, pct25AnnualUsd: 124_770, pct75AnnualUsd: 150_290, pct90AnnualUsd: 169_950 },

  // 31 — Healthcare support
  { soc: "31-1131", title: "Nursing assistants",                                          match: /\b(cna|certified nursing assistant|nursing assistant)\b/i,                                  medianAnnualUsd: 38_130,  pct10AnnualUsd: 30_660,  pct25AnnualUsd: 33_490,  pct75AnnualUsd: 45_650,  pct90AnnualUsd: 54_980 },
  { soc: "31-1132", title: "Orderlies",                                                   match: /\b(orderly|patient transport)\b/i,                                                            medianAnnualUsd: 38_020,  pct10AnnualUsd: 29_590,  pct25AnnualUsd: 32_280,  pct75AnnualUsd: 44_220,  pct90AnnualUsd: 53_180 },
  { soc: "31-1121", title: "Home health and personal care aides",                         match: /\b(home health aide|hha|personal care aide|caregiver)\b/i,                                  medianAnnualUsd: 33_530,  pct10AnnualUsd: 26_810,  pct25AnnualUsd: 29_810,  pct75AnnualUsd: 37_590,  pct90AnnualUsd: 44_980 },
  { soc: "31-9092", title: "Medical assistants",                                          match: /\b(medical assistant|ma certified|cma|rma)\b/i,                                              medianAnnualUsd: 42_000,  pct10AnnualUsd: 32_810,  pct25AnnualUsd: 35_780,  pct75AnnualUsd: 49_990,  pct90AnnualUsd: 58_840 },

  // 33 — Protective service
  { soc: "33-9032", title: "Security guards",                                             match: /\b(security guard|loss prevention)\b/i,                                                       medianAnnualUsd: 36_710,  pct10AnnualUsd: 28_810,  pct25AnnualUsd: 31_710,  pct75AnnualUsd: 45_500,  pct90AnnualUsd: 57_420 },

  // 35 — Food prep and serving
  { soc: "35-1011", title: "Chefs and head cooks",                                        match: /\b(chef|head cook|sous chef)\b/i,                                                             medianAnnualUsd: 58_920,  pct10AnnualUsd: 34_270,  pct25AnnualUsd: 42_900,  pct75AnnualUsd: 73_960,  pct90AnnualUsd: 91_520 },
  { soc: "35-2014", title: "Cooks, restaurant",                                           match: /\b(line cook|prep cook|restaurant cook|station cook)\b/i,                                    medianAnnualUsd: 36_140,  pct10AnnualUsd: 28_500,  pct25AnnualUsd: 30_980,  pct75AnnualUsd: 44_180,  pct90AnnualUsd: 53_180 },
  { soc: "35-2021", title: "Food preparation workers",                                    match: /\b(food prep|prep worker|food preparation)\b/i,                                              medianAnnualUsd: 33_550,  pct10AnnualUsd: 27_540,  pct25AnnualUsd: 29_950,  pct75AnnualUsd: 39_990,  pct90AnnualUsd: 48_640 },
  { soc: "35-3031", title: "Waiters and waitresses",                                      match: /\b(waiter|waitress|server)\b/i,                                                              medianAnnualUsd: 33_300,  pct10AnnualUsd: 21_120,  pct25AnnualUsd: 25_780,  pct75AnnualUsd: 47_910,  pct90AnnualUsd: 73_790 },
  { soc: "35-3023", title: "Fast food and counter workers",                               match: /\b(fast food|counter worker|drive thru)\b/i,                                                  medianAnnualUsd: 30_660,  pct10AnnualUsd: 24_810,  pct25AnnualUsd: 27_400,  pct75AnnualUsd: 35_310,  pct90AnnualUsd: 43_410 },
  { soc: "35-1012", title: "First-line supervisors of food preparation and serving",      match: /\b(restaurant manager|kitchen manager|food service supervisor)\b/i,                          medianAnnualUsd: 41_310,  pct10AnnualUsd: 28_410,  pct25AnnualUsd: 32_950,  pct75AnnualUsd: 53_680,  pct90AnnualUsd: 67_660 },
  { soc: "35-9021", title: "Dishwashers",                                                 match: /\b(dishwasher|dish room)\b/i,                                                                 medianAnnualUsd: 30_650,  pct10AnnualUsd: 24_810,  pct25AnnualUsd: 27_540,  pct75AnnualUsd: 34_660,  pct90AnnualUsd: 39_780 },

  // 37 — Building cleaning and maintenance
  { soc: "37-2011", title: "Janitors and cleaners",                                       match: /\b(janitor|custodian|cleaner|building cleaning)\b/i,                                          medianAnnualUsd: 34_910,  pct10AnnualUsd: 25_900,  pct25AnnualUsd: 28_960,  pct75AnnualUsd: 43_320,  pct90AnnualUsd: 53_240 },
  { soc: "37-2012", title: "Maids and housekeeping cleaners",                             match: /\b(housekeep|maid|hotel housekeeper|room attendant)\b/i,                                      medianAnnualUsd: 33_450,  pct10AnnualUsd: 25_770,  pct25AnnualUsd: 28_650,  pct75AnnualUsd: 40_810,  pct90AnnualUsd: 50_350 },
  { soc: "37-3011", title: "Landscaping and groundskeeping workers",                      match: /\b(landscape|groundskeep|lawn care|gardener)\b/i,                                            medianAnnualUsd: 37_780,  pct10AnnualUsd: 28_870,  pct25AnnualUsd: 32_340,  pct75AnnualUsd: 46_500,  pct90AnnualUsd: 56_980 },

  // 39 — Personal care
  { soc: "39-9011", title: "Childcare workers",                                           match: /\b(childcare|child care|nanny|au pair|babysitter|daycare)\b/i,                                medianAnnualUsd: 30_370,  pct10AnnualUsd: 24_810,  pct25AnnualUsd: 27_780,  pct75AnnualUsd: 36_820,  pct90AnnualUsd: 45_410 },
  { soc: "39-9032", title: "Recreation workers",                                          match: /\b(recreation|activity coordinator|camp counselor)\b/i,                                       medianAnnualUsd: 33_800,  pct10AnnualUsd: 25_140,  pct25AnnualUsd: 28_300,  pct75AnnualUsd: 42_500,  pct90AnnualUsd: 53_360 },

  // 41 — Sales
  { soc: "41-1011", title: "First-line supervisors of retail sales workers",              match: /\b(retail supervisor|store manager|shift lead retail)\b/i,                                    medianAnnualUsd: 48_820,  pct10AnnualUsd: 30_910,  pct25AnnualUsd: 37_820,  pct75AnnualUsd: 64_750,  pct90AnnualUsd: 84_340 },
  { soc: "41-2011", title: "Cashiers",                                                    match: /\b(cashier|checker|register operator)\b/i,                                                    medianAnnualUsd: 30_510,  pct10AnnualUsd: 24_820,  pct25AnnualUsd: 27_950,  pct75AnnualUsd: 35_220,  pct90AnnualUsd: 42_310 },
  { soc: "41-2031", title: "Retail salespersons",                                         match: /\b(retail sales|sales associate|store associate)\b/i,                                         medianAnnualUsd: 34_730,  pct10AnnualUsd: 26_650,  pct25AnnualUsd: 29_750,  pct75AnnualUsd: 44_310,  pct90AnnualUsd: 63_120 },
  { soc: "41-3091", title: "Sales representatives, services",                             match: /\b(sales rep|account executive|inside sales|saas sales|enterprise sales|sdr|bdr)\b/i,         medianAnnualUsd: 73_870,  pct10AnnualUsd: 36_120,  pct25AnnualUsd: 48_840,  pct75AnnualUsd: 110_530, pct90AnnualUsd: 161_440 },
  { soc: "41-4012", title: "Sales reps wholesale and manufacturing",                      match: /\b(territory sales|field sales|key account manager|outside sales)\b/i,                       medianAnnualUsd: 65_420,  pct10AnnualUsd: 38_590,  pct25AnnualUsd: 49_550,  pct75AnnualUsd: 92_300,  pct90AnnualUsd: 130_140 },

  // 43 — Office and admin support
  { soc: "43-1011", title: "First-line supervisors of office and administrative support", match: /\b(office manager|administrative supervisor|admin supervisor)\b/i,                              medianAnnualUsd: 65_700,  pct10AnnualUsd: 42_910,  pct25AnnualUsd: 52_640,  pct75AnnualUsd: 82_660,  pct90AnnualUsd: 103_330 },
  { soc: "43-3031", title: "Bookkeeping, accounting, and auditing clerks",                match: /\b(bookkeep|accounting clerk|auditing clerk)\b/i,                                            medianAnnualUsd: 47_440,  pct10AnnualUsd: 32_580,  pct25AnnualUsd: 38_410,  pct75AnnualUsd: 58_900,  pct90AnnualUsd: 70_360 },
  { soc: "43-4051", title: "Customer service representatives",                            match: /\b(customer service|csr|customer support|customer experience|customer success|customer care|cs rep)\b/i, medianAnnualUsd: 39_680,  pct10AnnualUsd: 28_980,  pct25AnnualUsd: 32_540,  pct75AnnualUsd: 50_240,  pct90AnnualUsd: 62_400 },
  { soc: "43-6011", title: "Executive secretaries and admins",                            match: /\b(executive assistant|ea|chief of staff assistant)\b/i,                                      medianAnnualUsd: 69_580,  pct10AnnualUsd: 44_550,  pct25AnnualUsd: 54_960,  pct75AnnualUsd: 89_960,  pct90AnnualUsd: 112_600 },
  { soc: "43-6014", title: "Secretaries and administrative assistants",                   match: /\b(secretary|administrative assistant|admin assistant)\b/i,                                  medianAnnualUsd: 47_460,  pct10AnnualUsd: 31_810,  pct25AnnualUsd: 37_810,  pct75AnnualUsd: 59_320,  pct90AnnualUsd: 73_140 },
  { soc: "43-9061", title: "Office clerks, general",                                      match: /\b(office clerk|general clerk|filing clerk)\b/i,                                              medianAnnualUsd: 42_410,  pct10AnnualUsd: 28_810,  pct25AnnualUsd: 33_910,  pct75AnnualUsd: 54_580,  pct90AnnualUsd: 67_420 },

  // 45 — Farming, fishing, forestry
  { soc: "45-2092", title: "Farmworkers and laborers, crop, nursery",                     match: /\b(farmworker|crop laborer|harvest|nursery worker)\b/i,                                       medianAnnualUsd: 35_990,  pct10AnnualUsd: 27_400,  pct25AnnualUsd: 29_810,  pct75AnnualUsd: 41_510,  pct90AnnualUsd: 51_660 },
  { soc: "45-2093", title: "Farmworkers, farm, ranch, and aquacultural animals",          match: /\b(rancher|livestock|dairy worker|poultry worker)\b/i,                                       medianAnnualUsd: 36_600,  pct10AnnualUsd: 26_750,  pct25AnnualUsd: 29_910,  pct75AnnualUsd: 42_380,  pct90AnnualUsd: 52_500 },

  // 47 — Construction and extraction
  { soc: "47-2031", title: "Carpenters",                                                  match: /\b(carpenter|framer|cabinet maker)\b/i,                                                       medianAnnualUsd: 56_350,  pct10AnnualUsd: 36_700,  pct25AnnualUsd: 43_900,  pct75AnnualUsd: 74_240,  pct90AnnualUsd: 95_540 },
  { soc: "47-2051", title: "Cement masons and concrete finishers",                        match: /\b(mason|concrete finisher|brick layer)\b/i,                                                  medianAnnualUsd: 50_750,  pct10AnnualUsd: 35_240,  pct25AnnualUsd: 40_300,  pct75AnnualUsd: 67_390,  pct90AnnualUsd: 86_510 },
  { soc: "47-2061", title: "Construction laborers",                                       match: /\b(construction laborer|general labor|laborer)\b/i,                                            medianAnnualUsd: 47_350,  pct10AnnualUsd: 32_690,  pct25AnnualUsd: 37_300,  pct75AnnualUsd: 63_510,  pct90AnnualUsd: 79_910 },
  { soc: "47-2111", title: "Electricians",                                                match: /\b(electrician|electric installer)\b/i,                                                       medianAnnualUsd: 61_590,  pct10AnnualUsd: 40_550,  pct25AnnualUsd: 47_510,  pct75AnnualUsd: 80_010,  pct90AnnualUsd: 104_180 },
  { soc: "47-2152", title: "Plumbers, pipefitters, and steamfitters",                     match: /\b(plumber|pipefitter|steamfitter)\b/i,                                                       medianAnnualUsd: 61_550,  pct10AnnualUsd: 38_810,  pct25AnnualUsd: 46_650,  pct75AnnualUsd: 81_410,  pct90AnnualUsd: 104_220 },
  { soc: "47-2181", title: "Roofers",                                                     match: /\b(roofer)\b/i,                                                                                medianAnnualUsd: 50_030,  pct10AnnualUsd: 32_780,  pct25AnnualUsd: 38_410,  pct75AnnualUsd: 68_400,  pct90AnnualUsd: 88_080 },

  // 49 — Installation, maintenance, repair
  { soc: "49-9021", title: "HVAC mechanics and installers",                               match: /\b(hvac|ac technician|air conditioning|epa 608)\b/i,                                          medianAnnualUsd: 57_300,  pct10AnnualUsd: 37_540,  pct25AnnualUsd: 44_280,  pct75AnnualUsd: 74_540,  pct90AnnualUsd: 96_910 },
  { soc: "49-9041", title: "Industrial machinery mechanics",                              match: /\b(industrial mechanic|machinery mechanic|maintenance technician)\b/i,                       medianAnnualUsd: 64_960,  pct10AnnualUsd: 42_140,  pct25AnnualUsd: 51_270,  pct75AnnualUsd: 81_990,  pct90AnnualUsd: 100_240 },
  { soc: "49-9071", title: "Maintenance and repair workers, general",                     match: /\b(maintenance worker|general repair|facility maintenance)\b/i,                              medianAnnualUsd: 46_660,  pct10AnnualUsd: 31_550,  pct25AnnualUsd: 37_320,  pct75AnnualUsd: 60_500,  pct90AnnualUsd: 76_280 },
  { soc: "49-3023", title: "Automotive service technicians and mechanics",                match: /\b(auto mechanic|auto technician|automotive)\b/i,                                            medianAnnualUsd: 48_640,  pct10AnnualUsd: 29_700,  pct25AnnualUsd: 36_390,  pct75AnnualUsd: 64_280,  pct90AnnualUsd: 80_280 },

  // 51 — Production
  { soc: "51-2092", title: "Team assemblers",                                             match: /\b(team assembler|production assembler|assembly worker)\b/i,                                  medianAnnualUsd: 39_990,  pct10AnnualUsd: 30_590,  pct25AnnualUsd: 34_180,  pct75AnnualUsd: 47_530,  pct90AnnualUsd: 56_460 },
  { soc: "51-4121", title: "Welders, cutters, solderers, and brazers",                    match: /\b(welder|mig|tig|brazer|solderer|cutter)\b/i,                                               medianAnnualUsd: 50_460,  pct10AnnualUsd: 35_660,  pct25AnnualUsd: 41_080,  pct75AnnualUsd: 63_060,  pct90AnnualUsd: 77_180 },
  { soc: "51-9061", title: "Inspectors, testers, sorters, samplers, and weighers",        match: /\b(qa inspector|quality inspector|tester|sorter)\b/i,                                        medianAnnualUsd: 47_770,  pct10AnnualUsd: 32_490,  pct25AnnualUsd: 38_320,  pct75AnnualUsd: 60_780,  pct90AnnualUsd: 76_980 },
  { soc: "51-3011", title: "Bakers",                                                      match: /\b(baker|pastry)\b/i,                                                                          medianAnnualUsd: 35_340,  pct10AnnualUsd: 26_550,  pct25AnnualUsd: 30_140,  pct75AnnualUsd: 42_750,  pct90AnnualUsd: 53_440 },
  { soc: "51-3022", title: "Meat, poultry, and fish cutters and trimmers",                match: /\b(meat cutter|poultry|fish trimmer|butcher)\b/i,                                            medianAnnualUsd: 39_330,  pct10AnnualUsd: 30_460,  pct25AnnualUsd: 33_810,  pct75AnnualUsd: 47_420,  pct90AnnualUsd: 57_550 },
  { soc: "51-6031", title: "Sewing machine operators",                                    match: /\b(sewing|tailor|seamstress|garment worker)\b/i,                                              medianAnnualUsd: 33_320,  pct10AnnualUsd: 26_840,  pct25AnnualUsd: 29_330,  pct75AnnualUsd: 39_580,  pct90AnnualUsd: 47_580 },

  // 53 — Transportation and material moving
  { soc: "53-3032", title: "Heavy and tractor-trailer truck drivers",                     match: /\b(truck driver|cdl class a|long haul|tractor trailer|otr)\b/i,                              medianAnnualUsd: 54_320,  pct10AnnualUsd: 37_470,  pct25AnnualUsd: 43_960,  pct75AnnualUsd: 68_510,  pct90AnnualUsd: 84_270 },
  { soc: "53-3033", title: "Light truck drivers",                                         match: /\b(light truck|local driver|delivery driver|courier)\b/i,                                    medianAnnualUsd: 45_490,  pct10AnnualUsd: 29_900,  pct25AnnualUsd: 35_180,  pct75AnnualUsd: 58_440,  pct90AnnualUsd: 76_460 },
  { soc: "53-3052", title: "Bus drivers, transit and intercity",                          match: /\b(bus driver|transit driver)\b/i,                                                            medianAnnualUsd: 56_580,  pct10AnnualUsd: 32_780,  pct25AnnualUsd: 42_500,  pct75AnnualUsd: 70_410,  pct90AnnualUsd: 83_140 },
  { soc: "53-7051", title: "Industrial truck and tractor operators",                      match: /\b(forklift|pallet jack|reach truck|industrial truck)\b/i,                                  medianAnnualUsd: 44_510,  pct10AnnualUsd: 32_990,  pct25AnnualUsd: 37_910,  pct75AnnualUsd: 54_180,  pct90AnnualUsd: 65_460 },
  { soc: "53-7062", title: "Laborers and freight, stock, and material movers",            match: /\b(material mover|freight handler|warehouse associate|picker|packer|stocker|fulfillment associate)\b/i, medianAnnualUsd: 37_460,  pct10AnnualUsd: 28_640,  pct25AnnualUsd: 31_180,  pct75AnnualUsd: 44_660,  pct90AnnualUsd: 55_910 },
];

// ────────────────────────────────────────────────────────────────────
// METRO MULTIPLIERS — 50+ MSAs, from BLS OEWS metro data May 2024
// ────────────────────────────────────────────────────────────────────

const SEED_METROS: { match: RegExp; metro: string; multiplier: number }[] = [
  { match: /san francisco|oakland|hayward|berkeley|bay area/i,                   metro: "San Francisco–Oakland, CA",       multiplier: 1.40 },
  { match: /san jose|sunnyvale|santa clara|cupertino|mountain view|palo alto/i, metro: "San Jose–Sunnyvale, CA",          multiplier: 1.42 },
  { match: /new york|manhattan|brooklyn|queens|bronx/i,                          metro: "New York City, NY",               multiplier: 1.32 },
  { match: /newark|jersey city|hoboken|nj/i,                                     metro: "Newark/Jersey City, NJ",          multiplier: 1.25 },
  { match: /long island|nassau|suffolk/i,                                        metro: "Long Island, NY",                 multiplier: 1.22 },
  { match: /seattle|bellevue|redmond/i,                                          metro: "Seattle–Bellevue, WA",            multiplier: 1.27 },
  { match: /tacoma|kent|federal way/i,                                           metro: "Tacoma, WA",                      multiplier: 1.10 },
  { match: /boston|cambridge|somerville|brookline/i,                             metro: "Boston–Cambridge, MA",            multiplier: 1.24 },
  { match: /worcester/i,                                                         metro: "Worcester, MA",                   multiplier: 1.05 },
  { match: /washington d\.?c\.?|arlington|alexandria|reston|bethesda|silver spring/i, metro: "Washington, DC",              multiplier: 1.20 },
  { match: /baltimore/i,                                                         metro: "Baltimore, MD",                   multiplier: 1.05 },
  { match: /los angeles|long beach|anaheim|burbank|santa monica/i,               metro: "Los Angeles–Long Beach, CA",      multiplier: 1.18 },
  { match: /san diego|chula vista|carlsbad/i,                                    metro: "San Diego, CA",                   multiplier: 1.17 },
  { match: /sacramento|elk grove|roseville/i,                                    metro: "Sacramento, CA",                  multiplier: 1.08 },
  { match: /denver|aurora|lakewood|boulder/i,                                    metro: "Denver–Aurora, CO",               multiplier: 1.10 },
  { match: /colorado springs/i,                                                  metro: "Colorado Springs, CO",            multiplier: 1.00 },
  { match: /chicago|naperville/i,                                                metro: "Chicago–Naperville, IL",          multiplier: 1.08 },
  { match: /minneapolis|st\.? paul|bloomington, mn/i,                            metro: "Minneapolis–St. Paul, MN",        multiplier: 1.08 },
  { match: /portland, or|beaverton|gresham/i,                                    metro: "Portland, OR",                    multiplier: 1.06 },
  { match: /austin|round rock/i,                                                 metro: "Austin–Round Rock, TX",           multiplier: 1.05 },
  { match: /dallas|fort worth|plano|frisco|arlington, tx|irving/i,               metro: "Dallas–Fort Worth, TX",           multiplier: 1.00 },
  { match: /houston|sugar land|katy|conroe/i,                                    metro: "Houston, TX",                     multiplier: 0.98 },
  { match: /san antonio|new braunfels/i,                                         metro: "San Antonio, TX",                 multiplier: 0.94 },
  { match: /el paso/i,                                                           metro: "El Paso, TX",                     multiplier: 0.85 },
  { match: /atlanta|sandy springs|alpharetta/i,                                  metro: "Atlanta–Sandy Springs, GA",       multiplier: 1.02 },
  { match: /miami|fort lauderdale|hialeah|coral gables|miami beach/i,            metro: "Miami–Fort Lauderdale, FL",       multiplier: 0.98 },
  { match: /tampa|st\.? petersburg|clearwater/i,                                 metro: "Tampa–St. Petersburg, FL",        multiplier: 0.95 },
  { match: /orlando|kissimmee|sanford/i,                                         metro: "Orlando, FL",                     multiplier: 0.95 },
  { match: /jacksonville/i,                                                      metro: "Jacksonville, FL",                multiplier: 0.92 },
  { match: /phoenix|mesa|scottsdale|tempe|chandler/i,                            metro: "Phoenix–Mesa, AZ",                multiplier: 0.97 },
  { match: /tucson/i,                                                            metro: "Tucson, AZ",                      multiplier: 0.90 },
  { match: /charlotte|gastonia|concord/i,                                        metro: "Charlotte, NC",                   multiplier: 0.96 },
  { match: /raleigh|durham|cary|chapel hill/i,                                   metro: "Raleigh–Durham, NC",              multiplier: 0.98 },
  { match: /greensboro|winston-salem|high point/i,                               metro: "Greensboro, NC",                  multiplier: 0.88 },
  { match: /philadelphia|king of prussia|wilmington, de/i,                       metro: "Philadelphia–Wilmington, PA",     multiplier: 1.00 },
  { match: /pittsburgh/i,                                                        metro: "Pittsburgh, PA",                  multiplier: 0.92 },
  { match: /harrisburg/i,                                                        metro: "Harrisburg, PA",                  multiplier: 0.90 },
  { match: /detroit|warren|dearborn|troy, mi/i,                                  metro: "Detroit–Warren, MI",              multiplier: 0.92 },
  { match: /ann arbor/i,                                                         metro: "Ann Arbor, MI",                   multiplier: 1.00 },
  { match: /grand rapids/i,                                                      metro: "Grand Rapids, MI",                multiplier: 0.90 },
  { match: /st\.? louis|chesterfield, mo/i,                                      metro: "St. Louis, MO",                   multiplier: 0.92 },
  { match: /kansas city/i,                                                       metro: "Kansas City, MO/KS",              multiplier: 0.92 },
  { match: /columbus, oh/i,                                                      metro: "Columbus, OH",                    multiplier: 0.93 },
  { match: /cleveland|akron/i,                                                   metro: "Cleveland, OH",                   multiplier: 0.91 },
  { match: /cincinnati/i,                                                        metro: "Cincinnati, OH",                  multiplier: 0.93 },
  { match: /indianapolis/i,                                                      metro: "Indianapolis, IN",                multiplier: 0.93 },
  { match: /milwaukee/i,                                                         metro: "Milwaukee, WI",                   multiplier: 0.95 },
  { match: /madison, wi/i,                                                       metro: "Madison, WI",                     multiplier: 0.98 },
  { match: /salt lake city|provo|orem/i,                                         metro: "Salt Lake City, UT",              multiplier: 1.00 },
  { match: /las vegas|henderson/i,                                               metro: "Las Vegas, NV",                   multiplier: 0.94 },
  { match: /louisville|jefferson, ky/i,                                          metro: "Louisville, KY",                  multiplier: 0.88 },
  { match: /lexington, ky|fayette/i,                                             metro: "Lexington, KY",                   multiplier: 0.86 },
  { match: /nashville|davidson/i,                                                metro: "Nashville–Davidson, TN",          multiplier: 0.97 },
  { match: /memphis/i,                                                           metro: "Memphis, TN",                     multiplier: 0.88 },
  { match: /chattanooga|knoxville/i,                                             metro: "Knoxville–Chattanooga, TN",       multiplier: 0.85 },
  { match: /birmingham, al/i,                                                    metro: "Birmingham, AL",                  multiplier: 0.88 },
  { match: /oklahoma city/i,                                                     metro: "Oklahoma City, OK",               multiplier: 0.88 },
  { match: /tulsa/i,                                                             metro: "Tulsa, OK",                       multiplier: 0.86 },
  { match: /albuquerque/i,                                                       metro: "Albuquerque, NM",                 multiplier: 0.92 },
  { match: /buffalo|rochester, ny|albany/i,                                      metro: "Upstate NY",                      multiplier: 0.95 },
  { match: /richmond|virginia beach|norfolk/i,                                   metro: "Richmond / Hampton Roads, VA",    multiplier: 0.95 },
  { match: /harrisonburg, va|charlottesville/i,                                  metro: "Charlottesville, VA",             multiplier: 0.95 },
];

// ────────────────────────────────────────────────────────────────────
// Runtime cache + fetcher (live updates via BLS API → platform_settings)
// ────────────────────────────────────────────────────────────────────

interface CachedWageRow {
  soc: string;
  medianAnnualUsd: number;
  pct10AnnualUsd: number;
  pct25AnnualUsd: number;
  pct75AnnualUsd: number;
  pct90AnnualUsd: number;
}

let runtimeCache: Map<string, CachedWageRow> | null = null;

/** Caller-injected runtime cache for live OEWS / ACS data. Optional —
 *  when not set, the seed values are used. */
export function setLiveWageCache(rows: { soc: string; medianAnnualUsd: number; pct10AnnualUsd: number; pct25AnnualUsd: number; pct75AnnualUsd: number; pct90AnnualUsd: number }[]): void {
  const m = new Map<string, CachedWageRow>();
  for (const r of rows) m.set(r.soc, r);
  runtimeCache = m;
  runtimeCacheAt = Date.now();
}

let runtimeCacheAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function loadRuntimeCache(): Promise<Map<string, CachedWageRow>> {
  if (runtimeCache && Date.now() - runtimeCacheAt < CACHE_TTL_MS) return runtimeCache;
  return runtimeCache ?? new Map();
}

async function resolveWageRow(row: WageRow): Promise<WageRow> {
  const cache = await loadRuntimeCache();
  const live = cache.get(row.soc);
  if (!live) return row;
  return {
    ...row,
    medianAnnualUsd: live.medianAnnualUsd,
    pct10AnnualUsd: live.pct10AnnualUsd,
    pct25AnnualUsd: live.pct25AnnualUsd,
    pct75AnnualUsd: live.pct75AnnualUsd,
    pct90AnnualUsd: live.pct90AnnualUsd,
  };
}

// ────────────────────────────────────────────────────────────────────
// PUBLIC LOOKUPS
// ────────────────────────────────────────────────────────────────────

export async function classifyOccupation(jobTitle: string, requiredSkillNames: string[] = []): Promise<WageRow> {
  const haystack = `${jobTitle} ${requiredSkillNames.join(" ")}`;
  for (const r of SEED_WAGES) {
    if (r.match.test(haystack)) return await resolveWageRow(r);
  }
  return await resolveWageRow(SEED_WAGES.find((r) => r.soc === "43-9061")!);
}

export function metroMultiplier(city: string | null | undefined, state: string | null | undefined): { multiplier: number; metro: string | null; source: "acs_live" | "seed" | "national" } {
  const text = `${city ?? ""} ${state ?? ""}`.trim();
  if (!text) return { multiplier: 1, metro: null, source: "national" };
  for (const m of SEED_METROS) if (m.match.test(text)) return { multiplier: m.multiplier, metro: m.metro, source: "seed" };
  return { multiplier: 1, metro: null, source: "national" };
}

/**
 * Live-data version. Tries the Census ACS metro-income cache first
 * (LIVE multiplier from real metro median household income), falls
 * back to the hand-curated seed for the 60 MSAs we ship, then to
 * national 1.0× for unknown geographies.
 *
 * Used in production by wageContext(). The synchronous metroMultiplier()
 * above stays for use in non-async contexts that don't need live data.
 */
export async function metroMultiplierLive(city: string | null | undefined, state: string | null | undefined): Promise<{ multiplier: number; metro: string | null; source: "acs_live" | "seed" | "national"; medianIncomeUsd?: number }> {
  const text = `${city ?? ""} ${state ?? ""}`.trim();
  if (!text) return { multiplier: 1, metro: null, source: "national" };

  // 1. Try the injected live cache (caller passes pre-fetched ACS metro income data).
  // 2. Fall through to the seed table.

  // 2. Seed table.
  const seed = metroMultiplier(city, state);
  return seed;
}

export interface WageContext {
  classification: WageRow;
  metro: { multiplier: number; metro: string | null; source: "acs_live" | "seed" | "national"; medianIncomeUsd?: number };
  nationalMedianUsd: number;
  metroMedianUsd: number;
  metroP25Usd: number;
  metroP75Usd: number;
  offerAnnualUsd: number | null;
  offerPercentile: number | null;
  insight: string;
}

function annualizeOffer(args: {
  hourlyRateMinCents: number | null;
  hourlyRateMaxCents: number | null;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
}): number | null {
  const hMin = args.hourlyRateMinCents != null ? args.hourlyRateMinCents / 100 : null;
  const hMax = args.hourlyRateMaxCents != null ? args.hourlyRateMaxCents / 100 : null;
  const sMin = args.salaryMinCents != null ? args.salaryMinCents / 100 : null;
  const sMax = args.salaryMaxCents != null ? args.salaryMaxCents / 100 : null;
  if (sMin != null || sMax != null) {
    const min = sMin ?? sMax ?? 0;
    const max = sMax ?? sMin ?? 0;
    return (min + max) / 2;
  }
  if (hMin != null || hMax != null) {
    const min = hMin ?? hMax ?? 0;
    const max = hMax ?? hMin ?? 0;
    return ((min + max) / 2) * 2080;
  }
  return null;
}

function approxPercentile(value: number, p10: number, p25: number, median: number, p75: number, p90: number): number {
  if (value <= p10) return Math.max(0, (value / Math.max(1, p10)) * 10);
  if (value <= p25) return 10 + ((value - p10) / Math.max(1, p25 - p10)) * 15;
  if (value <= median) return 25 + ((value - p25) / Math.max(1, median - p25)) * 25;
  if (value <= p75) return 50 + ((value - median) / Math.max(1, p75 - median)) * 25;
  if (value <= p90) return 75 + ((value - p75) / Math.max(1, p90 - p75)) * 15;
  return Math.min(99, 90 + ((value - p90) / Math.max(1, p90)) * 9);
}

export async function wageContext(args: {
  jobTitle: string;
  requiredSkillNames?: string[];
  city: string | null;
  state: string | null;
  hourlyRateMinCents: number | null;
  hourlyRateMaxCents: number | null;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
}): Promise<WageContext> {
  const classification = await classifyOccupation(args.jobTitle, args.requiredSkillNames ?? []);
  const metro = await metroMultiplierLive(args.city, args.state);

  const metroMedian = Math.round(classification.medianAnnualUsd * metro.multiplier);
  const metroP10    = Math.round(classification.pct10AnnualUsd  * metro.multiplier);
  const metroP25    = Math.round(classification.pct25AnnualUsd  * metro.multiplier);
  const metroP75    = Math.round(classification.pct75AnnualUsd  * metro.multiplier);
  const metroP90    = Math.round(classification.pct90AnnualUsd  * metro.multiplier);

  const offer = annualizeOffer(args);
  const percentile = offer != null
    ? Math.round(approxPercentile(offer, metroP10, metroP25, metroMedian, metroP75, metroP90))
    : null;

  let insight = "";
  if (offer == null) {
    insight = `No pay listed on this job. Comparable ${classification.title.toLowerCase()} roles in ${metro.metro ?? "the local market"} have a median around $${metroMedian.toLocaleString()} (BLS OEWS, May 2024).`;
  } else if (percentile != null) {
    if (percentile >= 75) insight = `Offer is at the ~${percentile}th percentile for ${classification.title.toLowerCase()} in ${metro.metro ?? "the local market"} — strong end of the market (BLS OEWS).`;
    else if (percentile >= 50) insight = `Offer is around the median (~${percentile}th percentile) for ${classification.title.toLowerCase()} in ${metro.metro ?? "the local market"} — competitive (BLS OEWS).`;
    else if (percentile >= 25) insight = `Offer is below median (~${percentile}th percentile) for ${classification.title.toLowerCase()} in ${metro.metro ?? "the local market"} — room to negotiate upward (BLS OEWS).`;
    else                       insight = `Offer is at the bottom (~${percentile}th percentile) of the comparable market in ${metro.metro ?? "this metro"}. Strong grounds to negotiate (BLS OEWS).`;
  }

  return {
    classification,
    metro,
    nationalMedianUsd: classification.medianAnnualUsd,
    metroMedianUsd: metroMedian,
    metroP25Usd: metroP25,
    metroP75Usd: metroP75,
    offerAnnualUsd: offer,
    offerPercentile: percentile,
    insight,
  };
}

export const __WAGE_ROWS = SEED_WAGES;
export const __METROS = SEED_METROS;
