import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Chip } from '../components/ui/chip'
import { Skeleton } from '../components/ui/skeleton'
import { Tab, TabList, TabPanel, Tabs } from '../components/ui/tabs'
import { useProfile, useSession } from '../lib/auth'
import { METRIC_LABELS, useSkillTags } from '../lib/catalog'
import { useAppClockOffset, useAppNow, useIsSimulatedClock } from '../lib/clock'
import { describeDefinition, type CohortDefinition } from '../lib/cohorts'
import { toAppError } from '../lib/errors'
import { deadlineDay, formatDate, formatDateTime, formatPct } from '../lib/format'
import { useMarketCards } from '../lib/markets'
import { supabase } from '../lib/supabase'

const input = 'h-8 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink outline-none focus-visible:border-focus'

/** Run an admin RPC, toast the outcome, refresh everything (admin actions touch many views). */
function useAdminAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ run }: { run: () => PromiseLike<{ error: unknown }>; success: string }) => {
      const result = await run()
      if (result.error) throw toAppError(result.error)
      return result
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.success)
      queryClient.invalidateQueries()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })
}

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const payload = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(payload?.message ?? error.message)
  }
  return data as { proposals: { rejected?: string }[] }
}

function Section({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="max-w-[70ch] text-sm text-ink-2">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function CohortQueue() {
  const action = useAdminAction()
  const { data: tags } = useSkillTags()
  const labels = new Map((tags ?? []).map((t) => [t.slug, t.label]))
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'cohorts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_cohort_overview')
      if (error) throw error
      return data
    },
  })
  const propose = useMutation({
    mutationFn: () => invokeFunction('propose-cohorts', {}),
    onSuccess: (d) => {
      const rejected = d.proposals.filter((p) => p.rejected).length
      toast.success(`${d.proposals.length - rejected} cohort proposals added${rejected ? `, ${rejected} rejected by the validator` : ''}.`)
      action.reset()
      queryClientRefresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const queryClient = useQueryClient()
  const queryClientRefresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })
  const pending = (data ?? []).filter((c) => c.status === 'proposed')
  return (
    <Section
      title="Cohort proposals"
      description="Exact sizes are shown here only. A cohort can't go live below its minimum (25)."
      actions={
        <Button size="sm" onClick={() => propose.mutate()} disabled={propose.isPending}>
          {propose.isPending ? 'Asking Claude…' : 'Propose cohorts with AI'}
        </Button>
      }
    >
      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-ink-3">No cohort proposals waiting.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {pending.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium text-ink">
                  {c.title} <Chip tone="quiet" className="ml-1">{c.proposed_by === 'ai' ? `AI · ${c.model}` : 'Admin'}</Chip>
                </p>
                <p className="text-sm text-ink-2">{describeDefinition(c.definition as unknown as CohortDefinition, labels)}</p>
                {c.rationale && <p className="text-sm text-ink-3">{c.rationale}</p>}
                <p className="text-sm">
                  <span className={c.member_count < c.min_size ? 'text-danger' : 'text-ink'}>{c.member_count} people match</span>
                  <span className="text-ink-3"> · needs {c.min_size}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="primary" disabled={c.member_count < c.min_size || action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_review_cohort', { p_cohort_id: c.id, p_approve: true }), success: `${c.title} is live.` })}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_review_cohort', { p_cohort_id: c.id, p_approve: false }), success: 'Cohort retired.' })}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function paramsText(metric: keyof typeof METRIC_LABELS, params: Record<string, string | number>, labels: Map<string, string>) {
  const by = `by ${formatDate(`${params.deadline}T12:00:00Z`)}`
  if (metric === 'employed_in_field') return `≥${params.threshold_pct}% working in ${labels.get(String(params.field)) ?? params.field} ${by}`
  if (metric === 'employed_in_region') return `≥${params.threshold_pct}% employed in ${params.region} ${by}`
  if (metric === 'salary_at_least') return `≥${params.threshold_pct}% with salary ≥ ${String(params.salary_band).split('_')[0]} ${by}`
  return `≥${params.threshold_pct}% in grad school ${by}`
}

function MarketQueue() {
  const action = useAdminAction()
  const queryClient = useQueryClient()
  const { data: tags } = useSkillTags()
  const labels = new Map((tags ?? []).map((t) => [t.slug, t.label]))
  const [b, setB] = useState('150')
  const [rule, setRule] = useState<'count_as_no' | 'exclude_with_quorum'>('count_as_no')
  const [cohortForAi, setCohortForAi] = useState('')
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'market-proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_proposals')
        .select('id, params, rationale, proposed_by, model, created_at, cohort:cohorts(id, title), template:market_templates(metric)')
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
  const { data: live } = useQuery({
    queryKey: ['admin', 'live-cohorts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_cohort_public').select('id, title').order('title')
      if (error) throw error
      return data
    },
  })
  const propose = useMutation({
    mutationFn: () => invokeFunction('propose-markets', { cohort_id: Number(cohortForAi) }),
    onSuccess: (d) => {
      const rejected = d.proposals.filter((p) => p.rejected).length
      toast.success(`${d.proposals.length - rejected} market proposals added${rejected ? `, ${rejected} rejected by the validator` : ''}.`)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Section
      title="Market proposals"
      description="Approving freezes the cohort's snapshot and opens the market. The question and rule are rendered from the template, never written by the model."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Cohort for AI proposals" className={input} value={cohortForAi} onChange={(e) => setCohortForAi(e.target.value)}>
            <option value="">Choose a live cohort</option>
            {live?.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.title}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!cohortForAi || propose.isPending} onClick={() => propose.mutate()}>
            {propose.isPending ? 'Asking Claude…' : 'Propose markets with AI'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          Liquidity b
          <input className={`${input} w-20`} inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="flex items-center gap-2">
          Non-response
          <select className={input} value={rule} onChange={(e) => setRule(e.target.value as typeof rule)}>
            <option value="count_as_no">Count as NO</option>
            <option value="exclude_with_quorum">Exclude, 60% quorum</option>
          </select>
        </label>
        <span className="text-ink-3">House loss is capped at b × ln 2 ≈ {Math.round(Number(b || 0) * Math.LN2)} credits per market.</span>
      </div>
      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : !data?.length ? (
        <p className="text-sm text-ink-3">No market proposals waiting.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface" data-testid="market-proposals">
          {data.map((p) => {
            const metric = (p.template as { metric: keyof typeof METRIC_LABELS }).metric
            const cohort = p.cohort as { id: number; title: string }
            return (
              <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between" data-testid="market-proposal">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium text-ink">{paramsText(metric, p.params as Record<string, string | number>, labels)}</p>
                  <p className="text-sm text-ink-2">
                    {cohort.title} · {METRIC_LABELS[metric]} <Chip tone="quiet" className="ml-1">{p.proposed_by === 'ai' ? `AI · ${p.model}` : 'Admin'}</Chip>
                  </p>
                  <p className="text-sm text-ink-3">{p.rationale}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        run: () => supabase.rpc('admin_review_market_proposal', { p_proposal_id: p.id, p_approve: true, p_b: Number(b) || 150, p_nonresponse_rule: rule, p_quorum_pct: rule === 'exclude_with_quorum' ? 60 : undefined }),
                        success: 'Snapshot frozen; the market is open.',
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_review_market_proposal', { p_proposal_id: p.id, p_approve: false }), success: 'Proposal rejected.' })}>
                    Reject
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function Resolution() {
  const action = useAdminAction()
  const now = useAppNow(30_000)
  const { data: cards } = useMarketCards()
  const due = (cards ?? []).filter((c) => (c.status === 'open' || c.status === 'closed') && Date.parse(c.resolvesAt) <= now)
  const open = (cards ?? []).filter((c) => c.status === 'open' || c.status === 'closed').sort((a, b) => Date.parse(a.resolvesAt) - Date.parse(b.resolvesAt))
  const [voidId, setVoidId] = useState('')
  const [reason, setReason] = useState('')
  return (
    <div className="flex flex-col gap-10">
      <Section title="Due for resolution" description="Markets past their resolve time. Resolution reads each snapshot member's latest outcome report as of the deadline and pays winning shares through the ledger.">
        {due.length === 0 ? (
          <p className="text-sm text-ink-3">Nothing is due at the app’s current time. Move the simulation clock forward to resolve future markets.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface" data-testid="due-markets">
            {due.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-3">
                <span className="flex min-w-0 flex-col">
                  <Link to={`/markets/${c.id}`} className="line-clamp-2 text-sm text-ink">
                    {c.question}
                  </Link>
                  <span className="truncate text-xs text-ink-3">{c.cohortTitle}</span>
                </span>
                <Button size="sm" variant="primary" disabled={action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('resolve_market', { p_market_id: c.id }), success: 'Market resolved and paid out.' })}>
                  Resolve
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Void a market" description="Refunds every holder's remaining cost basis. Use when a market can't be resolved fairly.">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Market to void" className={`${input} max-w-[520px] min-w-0 flex-1`} value={voidId} onChange={(e) => setVoidId(e.target.value)}>
            <option value="">Choose an open market</option>
            {open.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} {c.question}
              </option>
            ))}
          </select>
          <input aria-label="Reason" className={`${input} w-64`} placeholder="Reason (shown in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="danger" disabled={!voidId || action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('void_market', { p_market_id: Number(voidId), p_reason: reason || undefined }), success: 'Market voided; positions refunded.' })}>
            Void and refund
          </Button>
        </div>
      </Section>
    </div>
  )
}

function Simulation() {
  const action = useAdminAction()
  const simulated = useIsSimulatedClock()
  const offset = useAppClockOffset().data ?? 0
  const now = useAppNow(10_000)
  const [when, setWhen] = useState('2028-09-03T12:00')
  const [marketId, setMarketId] = useState('')
  const [rate, setRate] = useState(70)
  const [response, setResponse] = useState(90)
  const { data: cards } = useMarketCards()
  const candidates = (cards ?? []).filter((c) => c.status === 'open' || c.status === 'closed').sort((a, b) => Date.parse(a.resolvesAt) - Date.parse(b.resolvesAt))
  return (
    <div className="flex flex-col gap-10">
      <Section title="Simulation clock" description="Every time comparison in the database uses this clock. Set it past a deadline to demo resolution today.">
        <p className="text-sm text-ink-2">
          App time: <span className="font-semibold text-ink">{formatDateTime(new Date(now))}</span> {simulated ? `(simulated, ${Math.round(offset / 86_400_000)} days ahead)` : '(real time)'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Simulated time" type="datetime-local" className={input} value={when} onChange={(e) => setWhen(e.target.value)} data-testid="sim-time" />
          <Button size="sm" variant="primary" disabled={action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_set_sim_now', { p_ts: new Date(when).toISOString() }), success: 'Simulation clock set.' })} data-testid="set-sim">
            Set clock
          </Button>
          <Button size="sm" disabled={!simulated || action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_set_sim_now', { p_ts: null as unknown as string }), success: 'Back to real time.' })}>
            Back to real time
          </Button>
        </div>
      </Section>
      <Section title="Synthetic outcome reports" description="Writes reports for a market's snapshot members so the chosen share meets its rule. Marked synthetic; for demos only.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select aria-label="Market" className={`${input} max-w-[460px] min-w-0 flex-1`} value={marketId} onChange={(e) => setMarketId(e.target.value)} data-testid="gen-market">
            <option value="">Choose a market</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} resolves {formatDate(deadlineDay(c.resolvesAt))}: {c.question}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-ink-2">
            True rate
            <input type="range" min={0} max={100} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            <span className="w-10 text-ink">{formatPct(rate / 100)}</span>
          </label>
          <label className="flex items-center gap-2 text-ink-2">
            Response
            <input type="range" min={0} max={100} step={5} value={response} onChange={(e) => setResponse(Number(e.target.value))} />
            <span className="w-10 text-ink">{formatPct(response / 100)}</span>
          </label>
          <Button size="sm" disabled={!marketId || action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_generate_outcomes', { p_market_id: Number(marketId), p_true_rate: rate / 100, p_response_rate: response / 100 }), success: 'Synthetic reports written.' })} data-testid="gen-outcomes">
            Generate reports
          </Button>
        </div>
      </Section>
      <Section title="Sweep" description="Closes markets past their close time and resolves every market past its resolve time.">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_resolve_due_markets'), success: 'Due markets resolved.' })} data-testid="resolve-due">
            Resolve all due markets
          </Button>
          <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ run: () => supabase.rpc('admin_refresh_skill_signal'), success: 'Skill Signal refreshed.' })}>
            Refresh Skill Signal
          </Button>
        </div>
      </Section>
    </div>
  )
}

function Audit() {
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_log').select('id, actor_role, action, entity, entity_id, created_at, app_time').order('id', { ascending: false }).limit(100)
      if (error) throw error
      return data
    },
  })
  if (isPending) return <Skeleton className="h-64 w-full" />
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
      {data?.map((a) => (
        <li key={a.id} className="grid grid-cols-[160px_90px_minmax(0,1fr)_90px] gap-3 px-3 py-2 max-sm:grid-cols-[minmax(0,1fr)_80px]">
          <span className="text-ink-3 max-sm:hidden">{formatDateTime(a.created_at)}</span>
          <span className="font-medium text-ink">{a.action}</span>
          <span className="truncate text-ink-2">
            {a.entity} {a.entity_id && `#${a.entity_id}`}
          </span>
          <span className="text-right text-ink-3 max-sm:hidden">{a.actor_role}</span>
        </li>
      ))}
    </ul>
  )
}

export function Component() {
  const { session, ready } = useSession()
  const profile = useProfile()
  if (ready && !session) return <Navigate to="/signin?next=/admin" replace />
  if (profile.isPending) return <div className="mx-auto max-w-[1100px] px-6 py-10"><Skeleton className="h-64 w-full" /></div>
  if (profile.data?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="mt-2 text-ink-2">This account can’t manage cohorts or markets.</p>
      </div>
    )
  }
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-[-0.015em]">Admin</h1>
      <Tabs defaultValue="queue">
        <TabList>
          <Tab value="queue">Proposals</Tab>
          <Tab value="resolve">Resolution</Tab>
          <Tab value="sim">Simulation</Tab>
          <Tab value="audit">Audit log</Tab>
        </TabList>
        <TabPanel value="queue" className="flex flex-col gap-10 pt-6">
          <CohortQueue />
          <MarketQueue />
        </TabPanel>
        <TabPanel value="resolve" className="pt-6">
          <Resolution />
        </TabPanel>
        <TabPanel value="sim" className="pt-6">
          <Simulation />
        </TabPanel>
        <TabPanel value="audit" className="pt-6">
          <Audit />
        </TabPanel>
      </Tabs>
    </div>
  )
}
