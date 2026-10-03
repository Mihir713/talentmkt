// Admin-triggered: proposes new cohort definitions from aggregated skill co-occurrence counts.
// The model sees only counts (suppressed below 25), never a row about a person. Proposals land
// as `proposed` cohorts (invisible until an admin approves); the SQL validator rejects bad ones.
import { callTool, MODEL, ModelOutputError, NotConfiguredError, type StrictTool } from '../_shared/claude.ts'
import { clients, cors, json, requireAdmin } from '../_shared/http.ts'

const PROMPT_VERSION = 'propose-cohorts@2026-10-02'

interface Proposal {
  slug: string
  title: string
  rationale: string
  skills: { tag: string; min_weighted_courses: number }[]
  grad_years: number[] | null
  regions: string[] | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { user, service } = clients(req)
  const denied = await requireAdmin(user)
  if (denied) return denied

  const [{ data: stats, error: statsError }, { data: existing }, { data: tags }] = await Promise.all([
    user.rpc('admin_skill_cooccurrence', { p_min_weighted: 2 }),
    service.from('cohorts').select('slug, title, definition, status'),
    service.from('skill_tags').select('slug'),
  ])
  if (statsError) return json({ error: 'stats_failed', message: statsError.message }, 500)
  const slugs = (tags ?? []).map((t) => t.slug as string)

  const tool: StrictTool = {
    name: 'propose_cohorts',
    description: 'Propose new cohort definitions.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['cohorts'],
      properties: {
        cohorts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['slug', 'title', 'rationale', 'skills', 'grad_years', 'regions'],
            properties: {
              slug: { type: 'string', description: 'lowercase-hyphenated, unique' },
              title: { type: 'string', description: 'e.g. "Embedded systems · grads 2027–28 · Ontario"' },
              rationale: { type: 'string', description: 'One sentence: why this group is worth a market.' },
              skills: {
                type: 'array',
                description: '1 to 3 skill requirements.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['tag', 'min_weighted_courses'],
                  properties: { tag: { type: 'string', enum: slugs }, min_weighted_courses: { type: 'number' } },
                },
              },
              grad_years: { type: ['array', 'null'], items: { type: 'integer' } },
              regions: { type: ['array', 'null'], items: { type: 'string' } },
            },
          },
        },
      },
    },
  }

  try {
    const result = await callTool<{ cohorts: Proposal[] }>({
      system: `You design cohorts for a prediction market about students' career outcomes. A cohort is a readable rule over coursework: for each listed skill, a student needs at least min_weighted_courses weighted courses in it (a full course on the skill counts 1). Prefer skill-level groups that span schools; never a single school with a single course. Every cohort must plausibly have at least 25 students given the counts. Do not duplicate existing cohorts. Answer only by calling propose_cohorts with 3 to 6 proposals.`,
      tool,
      effort: 'medium',
      content: [
        {
          type: 'text',
          text: `Aggregated counts (students with at least ${2} weighted courses per skill; counts under 25 suppressed):\n${JSON.stringify(stats)}\n\nExisting cohorts:\n${JSON.stringify(
            (existing ?? []).map((c) => ({ slug: c.slug, title: c.title, definition: c.definition })),
          )}`,
        },
      ],
    })

    const outcomes = []
    for (const p of result.cohorts) {
      const definition: Record<string, unknown> = { skills: p.skills }
      if (p.grad_years?.length) definition.grad_years = p.grad_years
      if (p.regions?.length) definition.regions = p.regions
      const { data, error } = await service.rpc('propose_cohort', {
        p_slug: p.slug,
        p_title: p.title,
        p_definition: definition,
        p_rationale: p.rationale,
        p_model: MODEL,
        p_prompt_version: PROMPT_VERSION,
      })
      outcomes.push(error ? { slug: p.slug, rejected: error.details ?? error.message } : { slug: p.slug, cohort_id: data })
    }
    return json({ proposals: outcomes })
  } catch (e) {
    if (e instanceof NotConfiguredError) return json({ error: 'not_configured', message: 'Set ANTHROPIC_API_KEY in the Edge Function secrets to use AI proposals.' }, 503)
    return json({ error: 'model_failed', message: e instanceof ModelOutputError ? e.message : String(e) }, 502)
  }
})
