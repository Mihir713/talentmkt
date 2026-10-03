import { Link, useParams } from 'react-router'
import { SkillBars, useCohortPublic, type TopSkill } from '../components/market/CohortProfile'
import { ListSkeleton, MarketListHeader, MarketRow } from '../components/market/MarketRow'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/states'
import { useUserId } from '../lib/auth'
import { useSkillTags } from '../lib/catalog'
import { useAppNow } from '../lib/clock'
import { describeDefinition, type CohortDefinition } from '../lib/cohorts'
import { useMarketCards, useMarketsRealtime, useSparklines, useWatchlist } from '../lib/markets'

export function Component() {
  const slug = useParams().slug!
  const now = useAppNow(60_000)
  const signedIn = !!useUserId()
  const cohort = useCohortPublic({ slug })
  const { data: tags } = useSkillTags()
  const { data: cards, isPending: cardsPending } = useMarketCards()
  const { data: watchlist } = useWatchlist()
  useMarketsRealtime()
  const markets = (cards ?? [])
    .filter((c) => c.cohortSlug === slug)
    .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.volume24h - a.volume24h)
  const { data: sparks } = useSparklines(markets.map((m) => m.id))

  if (cohort.isPending) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-10 sm:px-6" aria-hidden>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-full max-w-[640px]" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (!cohort.data) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <EmptyState title="This cohort isn’t public" action={<Link to="/markets" className="underline">Browse markets</Link>}>
          Cohorts appear once at least 25 people match their rule. This one is either still a proposal, below that size, or doesn’t exist.
        </EmptyState>
      </div>
    )
  }
  const c = cohort.data
  const labels = new Map((tags ?? []).map((t) => [t.slug, t.label]))
  const skills = (c.top_skills ?? []) as unknown as TopSkill[]

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-10 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-[-0.015em]">{c.title}</h1>
        <p className="max-w-[65ch] text-md text-ink-2">{describeDefinition(c.definition as unknown as CohortDefinition, labels)}</p>
        <p className="text-sm text-ink-3">
          About <span className="font-semibold text-ink">{c.member_count_rounded}</span> people today, rounded to the nearest 5. Who they are is
          private, including to admins.
        </p>
      </header>

      <section aria-labelledby="mix-heading" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <h2 id="mix-heading" className="text-lg font-semibold">
            Skill composition
          </h2>
          <p className="text-ink-2">
            The skills that most set this cohort apart: the share of members with at least one full course in each, next to the share across all
            students.
          </p>
        </div>
        {skills.length ? <SkillBars skills={skills} limit={8} /> : <p className="text-ink-3">Not enough data to show yet.</p>}
      </section>

      <section aria-labelledby="markets-heading" className="flex flex-col gap-3">
        <h2 id="markets-heading" className="text-lg font-semibold">
          Markets on this cohort
        </h2>
        <MarketListHeader label={`${markets.length} ${markets.length === 1 ? 'market' : 'markets'}`} />
        {cardsPending ? (
          <ListSkeleton />
        ) : markets.length === 0 ? (
          <p className="py-6 text-ink-3">No markets yet. New ones are proposed for live cohorts and opened once an admin approves them.</p>
        ) : (
          <ul>
            {markets.map((m) => (
              <MarketRow key={m.id} card={m} now={now} spark={sparks?.get(m.id)} watching={watchlist?.has(m.id) ?? false} signedIn={signedIn} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
