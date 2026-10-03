// Admin-triggered, per live cohort: proposes markets from the cohort's public stats. The model
// picks a template and parameters and writes a one-sentence rationale; it never writes question
// or rule text (SQL renders those from the template on approval).
import { callTool, MODEL, ModelOutputError, NotConfiguredError, type StrictTool } from '../_shared/claude.ts'
import { clients, cors, json, requireAdmin } from '../_shared/http.ts'

const PROMPT_VERSION = 'propose-markets@2026-10-02'
const METRICS = ['employed_in_field', 'employed_in_region', 'salary_at_least', 'grad_school'] as const
const REGIONS = ['sf-bay-area', 'seattle', 'nyc', 'boston', 'toronto', 'waterloo', 'ottawa', 'montreal', 'vancouver', 'calgary', 'remote']
const BANDS = ['50k_75k', '75k_100k', '100k_125k', '125k_150k', '150k_200k', '200k_plus']

interface Proposal {
  metric: (typeof METRICS)[number]
  threshold_pct: number
  deadline: string
  field: string | null
  region: string | null
  salary_band: string | null
  rationale: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { user, service } = clients(req)
  const denied = await requireAdmin(user)
  if (denied) return denied

  const { cohort_id: cohortId } = await req.json().catch(() => ({}))
  const { data: cohort } = await service.from('v_cohort_public').select('*').eq('id', cohortId).maybeSingle()
  if (!cohort) return json({ error: 'cohort_not_found', message: 'Pick a live cohort.' }, 404)
  const { data: markets } = await service.from('v_market_cards').select('question, metric, params, status').eq('cohort_id', cohortId)
  const { data: tags } = await service.from('skill_tags').select('slug')
  const slugs = (tags ?? []).map((t) => t.slug as string)
  const today = new Date().toISOString().slice(0, 10)

  const tool: StrictTool = {
    name: 'propose_markets',
    description: 'Propose markets for this cohort.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['markets'],
      properties: {
        markets: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['metric', 'threshold_pct', 'deadline', 'field', 'region', 'salary_band', 'rationale'],
            properties: {
              metric: { type: 'string', enum: [...METRICS] },
              threshold_pct: { type: 'integer', description: 'Multiple of 5, 10 to 90 (5 to 90 for grad_school).' },
              deadline: { type: 'string', description: 'YYYY-MM-DD, after today and no later than 2029-12-31.' },
              field: { type: ['string', 'null'], enum: [...slugs, null], description: 'Only for employed_in_field.' },
              region: { type: ['string', 'null'], enum: [...REGIONS, null], description: 'Only for employed_in_region.' },
              salary_band: { type: ['string', 'null'], enum: [...BANDS, null], description: 'Only for salary_at_least (lower bound, CAD).' },
              rationale: { type: 'string', description: 'One sentence on why traders would disagree about this.' },
            },
          },
        },
      },
    },
  }

  try {
    const result = await callTool<{ markets: Proposal[] }>({
      system: `You propose binary prediction markets about a student cohort's career outcomes. Choose thresholds near where informed traders would disagree (aim for a price between 25% and 75%), deadlines that make sense for the cohort's graduation years, and avoid duplicating existing markets. Set only the parameter the metric uses; the others are null. Today is ${today}. Answer only by calling propose_markets with 2 to 4 proposals.`,
      tool,
      effort: 'medium',
      content: [
        {
          type: 'text',
          text: `Cohort (public, rounded stats only):\n${JSON.stringify({
            title: cohort.title,
            definition: cohort.definition,
            people: cohort.member_count_rounded,
            top_skills: cohort.top_skills,
          })}\n\nExisting markets on this cohort:\n${JSON.stringify(markets ?? [])}`,
        },
      ],
    })

    const outcomes = []
    for (const p of result.markets) {
      const params: Record<string, string | number> = { threshold_pct: p.threshold_pct, deadline: p.deadline }
      if (p.metric === 'employed_in_field' && p.field) params.field = p.field
      if (p.metric === 'employed_in_region' && p.region) params.region = p.region
      if (p.metric === 'salary_at_least' && p.salary_band) params.salary_band = p.salary_band
      const { data, error } = await service.rpc('propose_market', {
        p_cohort_id: cohortId,
        p_metric: p.metric,
        p_params: params,
        p_rationale: p.rationale,
        p_model: MODEL,
        p_prompt_version: PROMPT_VERSION,
      })
      outcomes.push(error ? { metric: p.metric, rejected: error.details ?? error.message } : { metric: p.metric, proposal_id: data })
    }
    return json({ proposals: outcomes })
  } catch (e) {
    if (e instanceof NotConfiguredError) return json({ error: 'not_configured', message: 'Set ANTHROPIC_API_KEY in the Edge Function secrets to use AI proposals.' }, 503)
    return json({ error: 'model_failed', message: e instanceof ModelOutputError ? e.message : String(e) }, 502)
  }
})
