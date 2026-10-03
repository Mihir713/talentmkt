import { ArrowRight } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { ConsentFacts } from '../components/ConsentFacts'
import { buttonStyles } from '../components/ui/button'
import { Delta, Pct } from '../components/ui/figures'
import { Skeleton } from '../components/ui/skeleton'
import { useAppNow } from '../lib/clock'
import { cn } from '../lib/cn'
import { deadlineDay, formatDate, formatWhole } from '../lib/format'
import { useMarketCards, type MarketCard } from '../lib/markets'
import { supabase } from '../lib/supabase'

function useLandingStats() {
  return useQuery({
    queryKey: ['landing-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('landing_stats').single()
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
}

/** The day's front page: the busiest open market as the lead, two more beneath it. */
function FrontPage() {
  const now = useAppNow(60_000)
  const { data: cards, isPending } = useMarketCards()
  const picks = useMemo(() => {
    const open = (cards ?? []).filter((c) => c.status === 'open' && Date.parse(c.closesAt) > now)
    const byVolume = [...open].sort((a, b) => b.volume24h - a.volume24h || b.volumeTotal - a.volumeTotal)
    const lead = byVolume[0]
    // Two more from different cohorts so the page shows range, not one cohort three times.
    const rest = byVolume.filter((c) => c.cohortId !== lead?.cohortId).filter((c, i, all) => all.findIndex((x) => x.cohortId === c.cohortId) === i)
    return lead ? [lead, ...rest.slice(0, 2)] : []
  }, [cards, now])

  if (isPending) {
    return (
      <div className="flex flex-col gap-6" aria-hidden>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-16 w-40" />
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    )
  }
  const [lead, ...rest] = picks
  if (!lead) return null
  return (
    <section aria-label="Markets trading now" className="flex flex-col">
      <LeadMarket card={lead} />
      <div className="grid border-t border-line sm:grid-cols-2">
        {rest.map((card, i) => (
          <SecondaryMarket key={card.id} card={card} className={cn(i === 0 && 'sm:border-r sm:border-line sm:pr-6', i === 1 && 'max-sm:border-t max-sm:border-line sm:pl-6')} />
        ))}
      </div>
    </section>
  )
}

function LeadMarket({ card }: { card: MarketCard }) {
  return (
    <Link to={`/markets/${card.id}`} className="group flex flex-col gap-3 pb-6 no-underline">
      <span className="text-sm text-ink-3">{card.cohortTitle}</span>
      <span className="text-xl font-semibold text-ink group-hover:underline sm:text-2xl">{card.question}</span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg text-ink-2">Traders put this at</span>
        <Pct value={card.pYes} className="text-5xl font-bold tracking-[-0.02em] text-ink" />
        <Delta value={card.change24h} className="text-sm font-medium" />
      </span>
      <span className="text-sm text-ink-3">
        {formatWhole(card.volume24h)} credits traded in 24 hours. Resolves after {formatDate(deadlineDay(card.resolvesAt))}.
      </span>
    </Link>
  )
}

function SecondaryMarket({ card, className }: { card: MarketCard; className?: string }) {
  return (
    <Link to={`/markets/${card.id}`} className={cn('group flex flex-col gap-2 py-5 no-underline', className)}>
      <span className="text-xs text-ink-3">{card.cohortTitle}</span>
      <span className="line-clamp-3 font-medium text-ink group-hover:underline">{card.question}</span>
      <span className="flex items-baseline gap-2">
        <Pct value={card.pYes} className="text-2xl font-bold text-ink" />
        <Delta value={card.change24h} className="text-xs" />
      </span>
    </Link>
  )
}

function Numbers() {
  const { data } = useLandingStats()
  const items = data
    ? [
        { value: data.open_markets, label: 'open markets' },
        { value: data.live_cohorts, label: 'live cohorts' },
        { value: data.trades, label: 'trades so far' },
        { value: data.traders, label: 'people trading' },
      ]
    : null
  return (
    <dl className="grid grid-cols-2 gap-y-4 border-y border-line py-5 sm:grid-cols-4">
      {items
        ? items.map((item) => (
            <div key={item.label} className="flex flex-col">
              <dt className="order-2 text-sm text-ink-3">{item.label}</dt>
              <dd className="order-1 text-2xl font-bold text-ink">{formatWhole(item.value)}</dd>
            </div>
          ))
        : Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5" aria-hidden>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
    </dl>
  )
}

const DEFINITIONS = [
  {
    term: 'A cohort',
    text: 'A group of at least 25 students defined by a readable rule about their coursework, like “3 or more embedded-systems courses, graduating 2027 or 2028”. Students join by confirming their transcripts; the rule decides who’s in.',
  },
  {
    term: 'A market',
    text: 'A yes-or-no question about a cohort’s careers, like “Will 60% or more be employed in the SF Bay Area by Sep 1, 2028?”, with a resolution rule fixed before trading starts. Traders buy YES or NO with play credits; the price is the crowd’s probability.',
  },
  {
    term: 'Why it’s anonymous',
    text: 'Every market is about a frozen snapshot of the whole cohort, never a person. Counts are rounded, nobody can see who is in a cohort, and members can’t trade their own cohort’s markets.',
  },
]

export function Component() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <section className="grid gap-x-16 gap-y-10 pt-10 pb-12 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-20">
        <div className="flex flex-col gap-6 lg:pt-4">
          <h1 className="text-4xl font-bold tracking-[-0.025em] text-ink sm:text-5xl">A market on where skills lead.</h1>
          <p className="max-w-[44ch] text-lg text-ink-2">
            Students join anonymous cohorts by the courses they took. Traders use play credits to say what happens to each cohort’s careers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/signin?next=/onboard" className={buttonStyles({ variant: 'primary', size: 'lg' })}>
              Join as a student
            </Link>
            <Link to="/markets" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
              Browse markets <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
        <FrontPage />
      </section>

      <Numbers />

      <section aria-labelledby="how-heading" className="grid gap-x-16 gap-y-8 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-3">
          <h2 id="how-heading" className="text-3xl font-bold tracking-[-0.015em]">
            How it works
          </h2>
          <p className="max-w-[44ch] text-ink-2">
            Students see what traders believe about people with their skills, without anyone learning who they are. It’s a read on a skill,
            not a score for a person.
          </p>
        </div>
        <dl className="flex flex-col divide-y divide-line">
          {DEFINITIONS.map((d) => (
            <div key={d.term} className="grid gap-2 py-5 first:pt-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
              <dt className="text-lg font-semibold text-ink">{d.term}</dt>
              <dd className="text-ink-2">{d.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="what-we-store" aria-labelledby="store-heading" className="scroll-mt-20 border-t border-line py-16">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="flex flex-col gap-3">
            <h2 id="store-heading" className="text-3xl font-bold tracking-[-0.015em]">
              What we store
            </h2>
            <p className="max-w-[44ch] text-ink-2">
              The same four statements every student agrees to before uploading anything. You can delete your data or your account at any
              time.
            </p>
          </div>
          <ConsentFacts />
        </div>
      </section>

      <section className="flex flex-col items-start gap-4 border-t border-line py-14">
        <h2 className="text-2xl font-bold tracking-[-0.015em]">Credits are play money.</h2>
        <p className="max-w-[60ch] text-ink-2">
          Everyone starts with 1,000. They can’t be bought, sold or cashed out; they keep score on a public leaderboard of profit and
          forecasting accuracy.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/signin?next=/onboard" className={buttonStyles({ variant: 'primary' })}>
            Join as a student
          </Link>
          <Link to="/leaderboard" className={buttonStyles({ variant: 'secondary' })}>
            See the leaderboard
          </Link>
        </div>
      </section>
    </div>
  )
}
