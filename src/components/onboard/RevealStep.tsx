import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { formatShares } from '../../lib/format'
import { useMySkillProfile } from '../../lib/onboarding'
import { supabase } from '../../lib/supabase'
import { buttonStyles } from '../ui/button'
import { Skeleton } from '../ui/skeleton'

/** The payoff: what the transcript says about your skills, and the cohorts you joined. */
export function RevealStep({ cohortIds }: { cohortIds: number[] }) {
  const { data: skills, isPending } = useMySkillProfile()
  const { data: cohorts, isPending: cohortsPending } = useQuery({
    queryKey: ['my-new-cohorts', cohortIds],
    queryFn: async () => {
      if (!cohortIds.length) return []
      const { data, error } = await supabase.from('v_cohort_public').select('id, slug, title, member_count_rounded, open_markets').in('id', cohortIds)
      if (error) throw error
      return data
    },
  })
  const top = (skills ?? []).slice(0, 8)
  const max = Math.max(...top.map((s) => s.weighted), 1)

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-[-0.015em]">Your skill profile</h1>
          <p className="text-md text-ink-2">From your confirmed courses. Each bar is weighted courses: a course entirely about a skill counts 1.</p>
        </div>
        {isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ul className="flex flex-col gap-2.5" data-testid="skill-profile">
            {top.map((s, i) => (
              <li key={s.slug} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                <span className="truncate text-ink">{s.label}</span>
                <span className="h-2.5 overflow-hidden rounded-[2px] bg-surface-2">
                  <span
                    className="reveal-bar block h-full rounded-[2px] bg-yes"
                    style={{ width: `${(s.weighted / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                  />
                </span>
                <span className="text-right text-ink-2">{formatShares(s.weighted)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-[-0.015em]">Your cohorts</h2>
          <p className="text-ink-2">
            Traders bet on how these groups do. You can follow their markets but not trade them, since you’d know your own outcome first.
          </p>
        </div>
        {cohortsPending ? (
          <Skeleton className="h-24 w-full" />
        ) : cohorts && cohorts.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface" data-testid="my-cohorts">
            {cohorts.map((c) => (
              <li key={c.id}>
                <Link to={`/cohorts/${c.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 no-underline hover:bg-surface-2">
                  <span className="font-medium text-ink">{c.title}</span>
                  <span className="shrink-0 text-sm text-ink-3">
                    about {c.member_count_rounded} people · {c.open_markets} open {c.open_markets === 1 ? 'market' : 'markets'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-line bg-surface p-4 text-ink-2" data-testid="no-cohorts">
            You’re not in a live cohort yet. Cohorts only go live once 25 people match their rule, and new ones are proposed as more students
            join. You’ll see them on your page when you’re in one.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/me" className={buttonStyles({ variant: 'primary', size: 'lg' })}>
          See what traders believe
        </Link>
        <Link to="/markets" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
          Browse markets
        </Link>
      </div>
    </div>
  )
}
