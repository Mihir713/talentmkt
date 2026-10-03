import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ListSkeleton, MarketListHeader, MarketRow } from '../components/market/MarketRow'
import { buttonStyles } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { Delta, Pct } from '../components/ui/figures'
import { Skeleton } from '../components/ui/skeleton'
import { signOut, useProfile, useSession, useStudentProfile } from '../lib/auth'
import { useAppNow } from '../lib/clock'
import { useMyCohorts } from '../lib/cohorts'
import { formatShares, formatWhole } from '../lib/format'
import { useMarketCards, useSparklines } from '../lib/markets'
import { useMySkillProfile } from '../lib/onboarding'
import { supabase } from '../lib/supabase'

function useSkillSignal() {
  return useQuery({
    queryKey: ['skill-signal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mv_skill_signal').select('*')
      if (error) throw error
      return new Map(data.map((r) => [r.slug!, r]))
    },
    staleTime: 5 * 60_000,
  })
}

async function removeFiles(paths: string[] | null) {
  if (paths?.length) await supabase.storage.from('transcripts').remove(paths)
}

export function Component() {
  const { session, ready } = useSession()
  const profile = useProfile()
  const student = useStudentProfile()
  const skills = useMySkillProfile(!!session)
  const signal = useSkillSignal()
  const cohorts = useMyCohorts()
  const { data: cards } = useMarketCards()
  const now = useAppNow(60_000)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const cohortIds = new Set((cohorts.data ?? []).map((c) => c.id))
  const markets = (cards ?? []).filter((c) => cohortIds.has(c.cohortId)).sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.volume24h - a.volume24h)
  const { data: sparks } = useSparklines(markets.map((m) => m.id))

  if (ready && !session) return <Navigate to="/signin?next=/me" replace />
  if (profile.data && profile.data.role !== 'student') return <Navigate to="/portfolio" replace />
  if (student.isSuccess && (!student.data || !student.data.grad_year)) return <Navigate to="/onboard" replace />

  const mine = (skills.data ?? []).filter((s) => s.weighted >= 1).slice(0, 10)

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-12 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-[-0.015em]">What traders believe about your skills</h1>
        <p className="max-w-[65ch] text-md text-ink-2">
          For each skill in your coursework: the average chance traders give YES across open markets on cohorts built around that skill,
          weighted by how much has been traded. It reads the crowd’s optimism about people with the skill. It isn’t a forecast about you, and
          it isn’t what anyone is worth.
        </p>
      </header>

      <section aria-labelledby="signal-heading" className="flex flex-col gap-3">
        <h2 id="signal-heading" className="sr-only">
          Skill Signal
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)_96px_96px_110px] gap-x-4 border-b border-line-strong px-1 pb-2 text-xs font-medium text-ink-3 max-sm:grid-cols-[minmax(0,1fr)_80px_80px]">
          <span>Skill (your weighted courses)</span>
          <span className="text-right">Traders’ view</span>
          <span className="text-right">7 days</span>
          <span className="text-right max-sm:hidden">Markets</span>
        </div>
        {skills.isPending || signal.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ul data-testid="skill-signal">
            {mine.map((s) => {
              const sig = signal.data?.get(s.slug)
              return (
                <li key={s.slug} className="grid grid-cols-[minmax(0,1fr)_96px_96px_110px] items-center gap-x-4 border-b border-line px-1 py-3 last:border-b-0 max-sm:grid-cols-[minmax(0,1fr)_80px_80px]">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{s.label}</span> <span className="text-sm text-ink-3">({formatShares(s.weighted)})</span>
                  </span>
                  <span className="text-right">
                    {sig?.signal != null ? <Pct value={sig.signal} className="font-bold text-ink" /> : <span className="text-sm text-ink-3">No markets</span>}
                  </span>
                  <span className="text-right text-sm">{sig?.change_7d != null ? <Delta value={sig.change_7d} /> : <span className="text-ink-3">n/a</span>}</span>
                  <span className="text-right text-sm text-ink-3 max-sm:hidden">
                    {sig?.open_markets ? `${sig.open_markets} · ${formatWhole(sig.volume)} cr` : 'none open'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="cohorts-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="cohorts-heading" className="text-lg font-semibold">
            Your cohorts and their markets
          </h2>
          <p className="text-ink-2">You can follow these but not trade them: you’d know your own outcome before anyone else. Only you can see that you’re in them.</p>
        </div>
        {cohorts.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : cohorts.data?.length ? (
          <ul className="flex flex-wrap gap-2">
            {cohorts.data.map((c) => (
              <li key={c.id}>
                <Link to={`/cohorts/${c.slug}`} className="inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-sm text-ink no-underline hover:border-line-strong">
                  {c.title} <span className="ml-2 text-ink-3">~{c.member_count_rounded}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-3">You’re not in a live cohort yet. Cohorts go live once 25 people match their rule.</p>
        )}
        {markets.length > 0 && (
          <>
            <MarketListHeader className="mt-2" label={`${markets.length} markets`} />
            {!cards ? <ListSkeleton /> : (
              <ul>
                {markets.map((m) => (
                  <MarketRow key={m.id} card={m} now={now} spark={sparks?.get(m.id)} watching={false} signedIn={false} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="privacy-heading" className="flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex flex-col gap-1">
          <h2 id="privacy-heading" className="text-lg font-semibold">
            Your data
          </h2>
          <p className="max-w-[65ch] text-ink-2">
            {student.data?.university?.name ? `${student.data.university.name}, ` : ''}
            {student.data?.program?.name ? `${student.data.program.name}, ` : ''}graduating {student.data?.grad_year}. Your transcript PDF was
            deleted when you confirmed your courses.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/onboard" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
            Upload a new transcript
          </Link>
          <ConfirmDialog
            trigger="Delete my data"
            title="Delete your transcript data?"
            confirmLabel="Delete my data"
            onConfirm={async () => {
              const { data, error } = await supabase.rpc('delete_my_data')
              if (error) throw new Error(error.details ?? error.message)
              await removeFiles(data)
              await queryClient.invalidateQueries()
              toast.success('Your courses and cohort memberships are deleted.')
              navigate('/onboard')
            }}
          >
            <p>This removes your courses, outcome reports and cohort memberships, so you drop out of every future snapshot. You keep your account and credits.</p>
            <p>Markets that already opened keep you in their frozen snapshot, so the insider rule still applies to them.</p>
          </ConfirmDialog>
          <ConfirmDialog
            trigger="Delete my account"
            title="Delete your account?"
            confirmLabel="Delete my account"
            typeToConfirm="delete"
            onConfirm={async () => {
              const { data, error } = await supabase.rpc('delete_my_account')
              if (error) throw new Error(error.details ?? error.message)
              await removeFiles(data)
              await signOut()
              toast.success('Your account is deleted.')
              navigate('/')
            }}
          >
            <p>Your email and all your data are erased and you’re signed out for good. This can’t be undone.</p>
            <p>Frozen snapshots keep an anonymous placeholder in your place, so open markets can still resolve; you count as not having reported.</p>
          </ConfirmDialog>
        </div>
      </section>
    </div>
  )
}
