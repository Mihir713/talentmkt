import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Star } from '@phosphor-icons/react'
import { Button } from '../components/ui/button'
import { LiveIndicator } from '../components/ui/live'
import { Select, type SelectItem } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState, ErrorState } from '../components/ui/states'
import { useUserId } from '../lib/auth'
import { METRIC_LABELS, useSkillTags } from '../lib/catalog'
import { useAppNow } from '../lib/clock'
import { cn } from '../lib/cn'
import { useMarketCards, useMarketsRealtime, useSparklines, useWatchlist, type MarketCard } from '../lib/markets'
import { ListSkeleton, MarketListHeader, MarketRow } from '../components/market/MarketRow'

type Sort = 'volume' | 'closing' | 'move' | 'newest'
const SORTS: SelectItem[] = [
  { value: 'volume', label: '24h volume' },
  { value: 'closing', label: 'Closing soon' },
  { value: 'move', label: 'Biggest 24h move' },
  { value: 'newest', label: 'Newest' },
]
const STATUS: SelectItem[] = [
  { value: 'open', label: 'Open' },
  { value: 'settled', label: 'Resolved or voided' },
  { value: 'all', label: 'All' },
]
const METRICS: SelectItem[] = [{ value: 'all', label: 'Any' }, ...Object.entries(METRIC_LABELS).map(([value, label]) => ({ value, label }))]
const DEADLINES: SelectItem[] = [
  { value: 'all', label: 'Any' },
  { value: '90d', label: 'Next 3 months' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
  { value: '2028', label: '2028' },
  { value: '2029', label: '2029' },
]

function useFilters() {
  const [params, setParams] = useSearchParams()
  const get = (key: string, fallback: string) => params.get(key) ?? fallback
  const filters = {
    skill: get('skill', 'all'),
    metric: get('metric', 'all'),
    deadline: get('deadline', 'all'),
    status: get('status', 'open'),
    sort: get('sort', 'volume') as Sort,
    watching: params.get('watching') === '1',
  }
  const set = (key: string, value: string, fallback: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === fallback) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const clear = () => setParams(new URLSearchParams(), { replace: true })
  return { filters, set, clear, active: params.size > 0 && !(params.size === 1 && params.has('sort')) }
}

function applyFilters(cards: MarketCard[], f: ReturnType<typeof useFilters>['filters'], now: number, watchlist?: Set<number>) {
  const open = (c: MarketCard) => c.status === 'open' && new Date(c.closesAt).getTime() > now
  const list = cards.filter((c) => {
    if (f.status === 'open' && !open(c)) return false
    if (f.status === 'settled' && c.status !== 'resolved' && c.status !== 'voided') return false
    if (f.skill !== 'all' && !c.skillSlugs.includes(f.skill)) return false
    if (f.metric !== 'all' && c.metric !== f.metric) return false
    if (f.watching && !watchlist?.has(c.id)) return false
    if (f.deadline === '90d' && new Date(c.closesAt).getTime() - now > 90 * 86_400_000) return false
    if (/^\d{4}$/.test(f.deadline) && !String(c.params.deadline ?? '').startsWith(f.deadline)) return false
    return true
  })
  const by: Record<Sort, (a: MarketCard, b: MarketCard) => number> = {
    volume: (a, b) => b.volume24h - a.volume24h || b.volumeTotal - a.volumeTotal,
    closing: (a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt),
    move: (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
    newest: (a, b) => Date.parse(b.opensAt) - Date.parse(a.opensAt),
  }
  return list.sort(by[f.sort])
}

export function Component() {
  const { filters, set, clear, active } = useFilters()
  const now = useAppNow(60_000)
  const signedIn = !!useUserId()
  const { data: cards, isPending, isError, refetch } = useMarketCards()
  const { data: tags } = useSkillTags()
  const { data: watchlist } = useWatchlist()
  const live = useMarketsRealtime()

  const shown = useMemo(() => (cards ? applyFilters(cards, filters, now, watchlist) : []), [cards, filters, now, watchlist])
  const sparkIds = useMemo(() => shown.slice(0, 200).map((c) => c.id), [shown])
  const { data: sparks } = useSparklines(sparkIds)
  const openCount = cards?.filter((c) => c.status === 'open' && Date.parse(c.closesAt) > now).length

  const skillItems: SelectItem[] = [{ value: 'all', label: 'Any' }, ...(tags ?? []).map((t) => ({ value: t.slug, label: t.label, group: t.category }))]

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-[-0.015em]">Markets</h1>
          <p className="text-ink-2">
            {openCount != null ? <>{openCount} open markets</> : <Skeleton className="inline-block h-4 w-24 align-middle" />} on anonymous cohorts of
            25 or more people. Each price is what traders currently believe.
          </p>
        </div>
        <LiveIndicator connected={live} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <Select label="Skill" value={filters.skill} onChange={(v) => set('skill', v, 'all')} items={skillItems} className="max-w-[260px]" />
        <Select label="Outcome" value={filters.metric} onChange={(v) => set('metric', v, 'all')} items={METRICS} />
        <Select label="Deadline" value={filters.deadline} onChange={(v) => set('deadline', v, 'all')} items={DEADLINES} />
        <Select label="Status" value={filters.status} onChange={(v) => set('status', v, 'open')} items={STATUS} />
        {signedIn && (
          <button
            type="button"
            aria-pressed={filters.watching}
            onClick={() => set('watching', filters.watching ? '0' : '1', '0')}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors',
              filters.watching ? 'border-line-strong bg-surface-2 text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
            )}
          >
            <Star aria-hidden weight={filters.watching ? 'fill' : 'regular'} className={cn('size-3.5', filters.watching && 'text-caution')} />
            Watching
          </button>
        )}
        <div className="ml-auto">
          <Select label="Sort" value={filters.sort} onChange={(v) => set('sort', v, 'volume')} items={SORTS} />
        </div>
      </div>

      <MarketListHeader className="mt-5" label={cards ? `${shown.length} ${shown.length === 1 ? 'market' : 'markets'}` : 'Markets'} />

      {isError ? (
        <ErrorState className="mt-4" message="Markets couldn’t be loaded." onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState
          title={filters.watching ? 'You’re not watching any markets that match' : 'No markets match these filters'}
          action={
            active ? (
              <Button size="sm" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
        >
          {filters.watching ? 'Star a market to keep it here.' : 'Try a broader skill or deadline.'}
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {shown.map((card) => (
            <MarketRow key={card.id} card={card} now={now} spark={sparks?.get(card.id)} watching={watchlist?.has(card.id) ?? false} signedIn={signedIn} />
          ))}
        </ul>
      )}
    </div>
  )
}
