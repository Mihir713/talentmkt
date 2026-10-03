// Cohort definitions, the latent outcome model, and market generation for the seed.

import type { Rng } from '../lib/rng'

export interface CohortSpec {
  slug: string
  title: string
  definition: {
    skills: { tag: string; min_weighted_courses: number }[]
    grad_years?: number[]
    regions?: string[]
    universities?: string[]
  }
  rationale: string
  /** Seeded as a pending proposal instead of being approved. */
  pending?: boolean
}

const skill = (tag: string, min: number) => ({ tag, min_weighted_courses: min })

export const COHORTS: CohortSpec[] = [
  { slug: 'embedded-2027-28-on', title: 'Embedded systems · grads 2027–28 · Ontario', definition: { skills: [skill('embedded-systems', 2.5)], grad_years: [2027, 2028], regions: ['ON'] }, rationale: 'Hardware-software students graduating into a tight embedded market.' },
  { slug: 'embedded-all', title: 'Embedded systems', definition: { skills: [skill('embedded-systems', 2)] }, rationale: 'Everyone with a real embedded track, across schools and years.' },
  { slug: 'ml-2026-27', title: 'Machine learning · grads 2026–27', definition: { skills: [skill('ml', 2)], grad_years: [2026, 2027] }, rationale: 'The ML class entering the market now.' },
  { slug: 'ml-statistics', title: 'Machine learning + statistics', definition: { skills: [skill('ml', 1.5), skill('statistics', 2)] }, rationale: 'Students with both modelling and statistical depth.' },
  { slug: 'deep-learning', title: 'Deep learning', definition: { skills: [skill('deep-learning', 1.4)] }, rationale: 'Students who took deep learning beyond the intro course.' },
  { slug: 'computer-vision', title: 'Computer vision', definition: { skills: [skill('computer-vision', 1)] }, rationale: 'Vision coursework from CS, ECE and BME.' },
  { slug: 'nlp', title: 'Natural language processing', definition: { skills: [skill('nlp', 1)] }, rationale: 'Language-model and retrieval coursework.' },
  { slug: 'distributed-databases', title: 'Distributed systems + databases', definition: { skills: [skill('distributed-systems', 1.4), skill('databases', 1)] }, rationale: 'Backend infrastructure skill set.' },
  { slug: 'cloud-infra', title: 'Cloud infrastructure', definition: { skills: [skill('cloud-infrastructure', 1)] }, rationale: 'Students who built and operated cloud systems.' },
  { slug: 'security', title: 'Security', definition: { skills: [skill('security', 1.5)] }, rationale: 'Software and hardware security coursework.' },
  { slug: 'web-hci', title: 'Web development + HCI', definition: { skills: [skill('web-development', 1), skill('hci', 1)] }, rationale: 'Product-facing engineers.' },
  { slug: 'systems-programming', title: 'Systems programming · grads 2026–28', definition: { skills: [skill('systems-programming', 2), skill('operating-systems', 1)], grad_years: [2026, 2027, 2028] }, rationale: 'Low-level software, close to the metal.' },
  { slug: 'rf-analog', title: 'RF & analog circuits', definition: { skills: [skill('rf-analog', 2.5)] }, rationale: 'Analog and RF designers, a small and specialised pool.' },
  { slug: 'vlsi-architecture', title: 'VLSI + computer architecture', definition: { skills: [skill('vlsi-digital', 1.8), skill('computer-architecture', 1)] }, rationale: 'Chip design track.' },
  { slug: 'dsp-comms', title: 'Signal processing + communications', definition: { skills: [skill('signal-processing', 1.8), skill('communications', 1)] }, rationale: 'Telecom and DSP.' },
  { slug: 'control-systems', title: 'Control systems', definition: { skills: [skill('control-systems', 2)] }, rationale: 'Controls across ECE, mechatronics and chemical.' },
  { slug: 'power-energy', title: 'Power systems + power electronics', definition: { skills: [skill('power-systems', 1.5), skill('power-electronics', 0.6)] }, rationale: 'Grid and energy engineers.' },
  { slug: 'robotics', title: 'Robotics', definition: { skills: [skill('robotics', 1.2)] }, rationale: 'Robotics coursework, mostly mechatronics and mechanical.' },
  { slug: 'mechatronics-2027-28', title: 'Mechatronics · grads 2027–28', definition: { skills: [skill('mechatronics', 1.5)], grad_years: [2027, 2028] }, rationale: 'Upcoming mechatronics grads.' },
  { slug: 'mechanical-design', title: 'Mechanical design & CAD', definition: { skills: [skill('cad-mechanical', 2.5)] }, rationale: 'Design-heavy mechanical students.' },
  { slug: 'thermofluids', title: 'Thermofluids', definition: { skills: [skill('thermofluids', 3)] }, rationale: 'Energy, HVAC and process-adjacent mechanical.' },
  { slug: 'aerospace', title: 'Aerospace', definition: { skills: [skill('aerospace', 1.5)] }, rationale: 'Aero coursework, concentrated at a few schools.' },
  { slug: 'structural', title: 'Structural engineering', definition: { skills: [skill('structural', 2.5)] }, rationale: 'Structural track in civil.' },
  { slug: 'geo-transport', title: 'Geotechnical + transportation', definition: { skills: [skill('geotechnical', 1), skill('transportation', 1)] }, rationale: 'Infrastructure generalists.' },
  { slug: 'environmental-water', title: 'Environmental + water resources', definition: { skills: [skill('environmental', 1), skill('water-resources', 1)] }, rationale: 'Environmental and water engineers.' },
  { slug: 'process-engineering', title: 'Chemical process engineering', definition: { skills: [skill('process-engineering', 3)] }, rationale: 'Core chemical engineering.' },
  { slug: 'materials', title: 'Materials science', definition: { skills: [skill('materials', 2)] }, rationale: 'Materials across chemical, mechanical and electrical.' },
  { slug: 'biomedical', title: 'Biomedical engineering', definition: { skills: [skill('biomedical', 2)] }, rationale: 'Biomedical devices and imaging.' },
  { slug: 'quant-finance', title: 'Quantitative finance + statistics', definition: { skills: [skill('quant-finance', 1.5), skill('statistics', 1.5)] }, rationale: 'Quant track.' },
  { slug: 'operations-research', title: 'Operations research + optimization', definition: { skills: [skill('operations-research', 1), skill('optimization', 1)] }, rationale: 'Analytics and logistics.' },
  { slug: 'data-engineering', title: 'Data engineering', definition: { skills: [skill('data-engineering', 1), skill('databases', 1)] }, rationale: 'Pipelines and warehouses.' },
  { slug: 'ml-uw-uoft', title: 'Machine learning · UW + UofT', definition: { skills: [skill('ml', 2)], universities: ['UW', 'UofT'] }, rationale: 'ML students at the two largest programs.' },
  // Pending proposals for the admin queue. Some are below k = 25 and cannot go live yet.
  { slug: 'quantum', title: 'Quantum computing', definition: { skills: [skill('quantum', 1.5)] }, rationale: 'Quantum coursework, likely too small for now.', pending: true },
  { slug: 'photonics-2027', title: 'Photonics · grads 2027', definition: { skills: [skill('photonics', 1.8)], grad_years: [2027] }, rationale: 'Photonics and optics; probably below k for now.', pending: true },
  { slug: 'product-management', title: 'Product management · grads 2027–28', definition: { skills: [skill('product-management', 1)], grad_years: [2027, 2028] }, rationale: 'Engineers with product coursework.', pending: true },
  { slug: 'mobile', title: 'Mobile development', definition: { skills: [skill('mobile-development', 1)] }, rationale: 'App developers.', pending: true },
]

// ---------------------------------------------------------------------------------------------
// Latent outcome model: what "really" happens to people with each kind of skill. Bots never see
// these numbers directly; they see them through private bias and noise.
// ---------------------------------------------------------------------------------------------

type Group = 'software' | 'ai' | 'hardware' | 'mech' | 'civil' | 'chem' | 'finance'

const GROUP_OF: Record<string, Group> = {
  'software-engineering': 'software', algorithms: 'software', 'systems-programming': 'software',
  'operating-systems': 'software', 'distributed-systems': 'software', databases: 'software',
  networking: 'software', security: 'software', compilers: 'software', 'web-development': 'software',
  'mobile-development': 'software', 'cloud-infrastructure': 'software', hci: 'software',
  'computer-graphics': 'software', 'data-engineering': 'software',
  ml: 'ai', 'deep-learning': 'ai', nlp: 'ai', 'computer-vision': 'ai', statistics: 'ai', optimization: 'ai',
  'embedded-systems': 'hardware', 'computer-architecture': 'hardware', 'vlsi-digital': 'hardware',
  'rf-analog': 'hardware', 'signal-processing': 'hardware', communications: 'hardware',
  'control-systems': 'hardware', 'power-systems': 'hardware', 'power-electronics': 'hardware', photonics: 'hardware',
  'cad-mechanical': 'mech', thermofluids: 'mech', 'solid-mechanics': 'mech', robotics: 'mech',
  mechatronics: 'mech', manufacturing: 'mech', aerospace: 'mech',
  structural: 'civil', geotechnical: 'civil', transportation: 'civil', environmental: 'civil', 'water-resources': 'civil',
  'process-engineering': 'chem', materials: 'chem', biomedical: 'chem', biotech: 'chem',
  'applied-math': 'ai', physics: 'chem', quantum: 'hardware',
  'quant-finance': 'finance', economics: 'finance', 'operations-research': 'finance', 'product-management': 'software',
}

interface GroupProfile {
  employed: number          // share employed ~2 years out
  fieldMatch: number        // share of employed working in their main skill area
  grad: number              // share in grad school
  salaryMedian: number      // index into SALARY_BANDS
  regions: Record<string, number>   // share of employed by region
}

export const SALARY_BANDS = ['under_50k', '50k_75k', '75k_100k', '100k_125k', '125k_150k', '150k_200k', '200k_plus'] as const

const PROFILES: Record<Group, GroupProfile> = {
  software: { employed: 0.88, fieldMatch: 0.55, grad: 0.08, salaryMedian: 3.2, regions: { 'sf-bay-area': 0.16, toronto: 0.32, waterloo: 0.12, seattle: 0.07, nyc: 0.06, remote: 0.09, vancouver: 0.05 } },
  ai: { employed: 0.84, fieldMatch: 0.45, grad: 0.22, salaryMedian: 3.4, regions: { 'sf-bay-area': 0.2, toronto: 0.3, waterloo: 0.08, seattle: 0.06, nyc: 0.08, remote: 0.07, montreal: 0.06 } },
  hardware: { employed: 0.85, fieldMatch: 0.5, grad: 0.14, salaryMedian: 2.6, regions: { waterloo: 0.18, ottawa: 0.14, toronto: 0.28, 'sf-bay-area': 0.08, montreal: 0.06, calgary: 0.04 } },
  mech: { employed: 0.82, fieldMatch: 0.48, grad: 0.12, salaryMedian: 2.1, regions: { toronto: 0.34, waterloo: 0.1, montreal: 0.08, calgary: 0.08, ottawa: 0.05, 'sf-bay-area': 0.03 } },
  civil: { employed: 0.87, fieldMatch: 0.62, grad: 0.1, salaryMedian: 1.8, regions: { toronto: 0.42, ottawa: 0.08, vancouver: 0.08, calgary: 0.09 } },
  chem: { employed: 0.78, fieldMatch: 0.45, grad: 0.24, salaryMedian: 2.0, regions: { toronto: 0.3, calgary: 0.14, montreal: 0.08, ottawa: 0.05 } },
  finance: { employed: 0.86, fieldMatch: 0.4, grad: 0.12, salaryMedian: 3.0, regions: { toronto: 0.55, nyc: 0.12, montreal: 0.05, remote: 0.04 } },
}

export function groupOf(tag: string): Group {
  return GROUP_OF[tag] ?? 'software'
}

export type Metric = 'employed_in_field' | 'employed_in_region' | 'salary_at_least' | 'grad_school'

export interface MarketSpec {
  cohortSlug: string
  metric: Metric
  params: Record<string, string | number>
  rationale: string
  /** True share of the cohort that meets the rule at the deadline. */
  expectedRate: number
  /** Initial P(YES) from the latent model. */
  truth: number
  b: number
  nonresponse: 'count_as_no' | 'exclude_with_quorum'
  /** Deterministic popularity weight for trading activity. */
  popularity: number
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x))

function shareAtLeast(profile: GroupProfile, bandIndex: number): number {
  // Smooth band distribution around the group median.
  return logistic((profile.salaryMedian - bandIndex + 0.5) * 1.6)
}

function timeFactor(deadline: string): number {
  const year = Number(deadline.slice(0, 4))
  return year <= 2026 ? 0.82 : year === 2027 ? 0.92 : 1
}

const round5 = (x: number) => Math.round(x / 5) * 5
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Deadlines markets can use. Past ones become already-resolved markets. */
export const DEADLINES = {
  past: ['2026-07-01', '2026-08-01', '2026-09-01'],
  soon: ['2026-10-31', '2026-11-30', '2026-12-31'],
  later: ['2027-05-01', '2027-09-01', '2028-01-01', '2028-05-01', '2028-09-01', '2029-05-01', '2029-09-01'],
}

export function planMarkets(rng: Rng, activeCohorts: CohortSpec[], targetCount: number): MarketSpec[] {
  const specs: MarketSpec[] = []
  const used = new Set<string>()
  let attempts = 0
  while (specs.length < targetCount && attempts < targetCount * 20) {
    attempts++
    // Every cohort gets at least two markets before the rest are spread at random.
    const cohort = specs.length < activeCohorts.length * 2
      ? activeCohorts[specs.length % activeCohorts.length]!
      : rng.pick(activeCohorts)
    const mainTag = cohort.definition.skills[0]!.tag
    const profile = PROFILES[groupOf(mainTag)]
    const bucket = rng.next()
    const deadline = bucket < 0.11 ? rng.pick(DEADLINES.past) : bucket < 0.24 ? rng.pick(DEADLINES.soon) : rng.pick(DEADLINES.later)
    const tf = timeFactor(deadline)
    const metric = rng.weighted<Metric>(['employed_in_field', 'employed_in_region', 'salary_at_least', 'grad_school'],
      (m) => ({ employed_in_field: 1, employed_in_region: 1.3, salary_at_least: 1, grad_school: 0.5 })[m])

    let expected: number
    const params: Record<string, string | number> = { deadline }
    let rationale: string
    if (metric === 'employed_in_field') {
      params.field = mainTag
      expected = profile.employed * tf * profile.fieldMatch
      rationale = `How many stay in ${mainTag.replace(/-/g, ' ')} is the clearest read on demand for the skill.`
    } else if (metric === 'employed_in_region') {
      const region = rng.weighted(Object.keys(profile.regions), (r) => profile.regions[r]!)
      params.region = region
      expected = profile.employed * tf * profile.regions[region]!
      rationale = `Tests how strongly this cohort pulls toward ${region.replace(/-/g, ' ')}.`
    } else if (metric === 'salary_at_least') {
      const band = clamp(Math.round(profile.salaryMedian + rng.range(-1.2, 1.2)), 1, SALARY_BANDS.length - 1)
      params.salary_band = SALARY_BANDS[band]!
      expected = profile.employed * tf * shareAtLeast(profile, band)
      rationale = 'Salary thresholds near the cohort median split traders well.'
    } else {
      expected = profile.grad * (tf < 1 ? 0.9 : 1)
      rationale = 'Grad school share is a useful counterweight to employment markets.'
    }

    const min = metric === 'grad_school' ? 5 : 10
    const threshold = clamp(round5(expected * 100 + rng.normal(0, 7)), min, 90)
    params.threshold_pct = threshold
    const key = `${cohort.slug}|${metric}|${JSON.stringify(params)}`
    if (used.has(key)) continue
    used.add(key)

    // Realised rates vary around expectation by about 5 points.
    const truth = clamp(logistic((expected - threshold / 100) / 0.05 * 1.7), 0.04, 0.96)
    specs.push({
      cohortSlug: cohort.slug,
      metric,
      params,
      rationale,
      expectedRate: expected,
      truth,
      b: rng.chance(0.15) ? 300 : 150,
      nonresponse: rng.chance(0.12) ? 'exclude_with_quorum' : 'count_as_no',
      popularity: Math.exp(rng.normal(0, 0.7)),
    })
  }
  return specs
}
