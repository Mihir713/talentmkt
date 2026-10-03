import { Star } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { useToggleWatchlist, type MarketCard } from '../../lib/markets'
import { cn } from '../../lib/cn'
import { formatClosesIn, formatWhole } from '../../lib/format'
import { ChangeTint, Delta, Pct } from '../ui/figures'
import { Skeleton } from '../ui/skeleton'
import { Sparkline } from '../ui/sparkline'

function WatchStar({ marketId, watching }: { marketId: number; watching: boolean }) {
  const toggle = useToggleWatchlist()
  return (
    <button
      type="button"
      onClick={() => toggle.mutate(marketId)}
      aria-pressed={watching}
      aria-label={watching ? 'Stop watching' : 'Watch'}
      className="relative z-10 flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Star aria-hidden weight={watching ? 'fill' : 'regular'} className={cn('size-4', watching && 'text-caution')} />
    </button>
  )
}

export const ROW = 'grid grid-cols-[minmax(0,1fr)_88px_76px_80px_88px_112px_32px] items-center gap-x-4 max-lg:grid-cols-[minmax(0,1fr)_80px_72px_32px]'

export function MarketRow({ card, now, spark, watching, signedIn }: { card: MarketCard; now: number; spark?: number[]; watching: boolean; signedIn: boolean }) {
  const settled = card.status === 'resolved' || card.status === 'voided'
  return (
    <li className={cn(ROW, 'group relative border-b border-line px-1 py-3 last:border-b-0 hover:bg-surface')}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          to={`/markets/${card.id}`}
          className="line-clamp-2 font-medium text-ink no-underline after:absolute after:inset-0 after:content-[''] group-hover:underline"
        >
          {card.question}
        </Link>
        <span className="truncate text-xs text-ink-3">{card.cohortTitle}</span>
      </div>
      <div className="text-right">
        {card.status === 'resolved' ? (
          <span className={cn('text-md font-bold', card.outcome === 'yes' ? 'text-yes' : 'text-no')}>{card.outcome?.toUpperCase()}</span>
        ) : card.status === 'voided' ? (
          <span className="text-sm font-medium text-ink-3">Voided</span>
        ) : (
          <ChangeTint value={card.pYes} className="px-1">
            <Pct value={card.pYes} className="text-md font-bold text-ink" />
          </ChangeTint>
        )}
      </div>
      <div className="text-right text-sm">{settled ? <span className="text-ink-3">Settled</span> : <Delta value={card.change24h} />}</div>
      <div className="flex justify-end max-lg:hidden">
        <Sparkline points={spark} />
      </div>
      <div className="text-right text-sm text-ink-2 max-lg:hidden">{formatWhole(card.volume24h)}</div>
      <div className="text-right text-sm text-ink-3 max-lg:hidden">{settled ? 'Settled' : formatClosesIn(card.closesAt, now).replace('closes in ', '')}</div>
      <div className="flex justify-end">{signedIn ? <WatchStar marketId={card.id} watching={watching} /> : null}</div>
    </li>
  )
}

export function ListSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} className={cn(ROW, 'border-b border-line px-1 py-3')}>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="ml-auto h-5 w-12" />
          <Skeleton className="ml-auto h-4 w-12" />
          <Skeleton className="ml-auto h-6 w-[72px] max-lg:hidden" />
          <Skeleton className="ml-auto h-4 w-12 max-lg:hidden" />
          <Skeleton className="ml-auto h-4 w-16 max-lg:hidden" />
          <span />
        </li>
      ))}
    </ul>
  )
}


export function MarketListHeader({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn(ROW, 'border-b border-line-strong px-1 pb-2 text-xs font-medium text-ink-3', className)}>
      <span>{label}</span>
      <span className="text-right">Chance</span>
      <span className="text-right">24h</span>
      <span className="text-right max-lg:hidden">7 days</span>
      <span className="text-right max-lg:hidden">24h volume</span>
      <span className="text-right max-lg:hidden">Closes in</span>
      <span />
    </div>
  )
}
