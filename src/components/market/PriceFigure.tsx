import { cn } from '../../lib/cn'
import { deadlineDay, formatDate, formatPct } from '../../lib/format'
import type { MarketCard } from '../../lib/markets'
import { ChangeTint, Delta, Pct } from '../ui/figures'
import { LiveIndicator } from '../ui/live'

/**
 * The page's signature: the number set inside the sentence it supports.
 * "Traders put this at 62%" while trading; a plain statement of the result once settled.
 */
export function PriceFigure({ market, live, appNow, className }: { market: MarketCard; live: boolean; appNow: number; className?: string }) {
  if (market.status === 'resolved') {
    const yes = market.outcome === 'yes'
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <p className="text-xl text-ink-2">
          Resolved{' '}
          <span className={cn('text-4xl font-bold tracking-[-0.02em] sm:text-5xl', yes ? 'text-yes' : 'text-no')}>{yes ? 'YES' : 'NO'}</span>
        </p>
        <p className="text-base text-ink-2">
          {market.resolvedPctRounded != null && <>About {market.resolvedPctRounded}% of the snapshot met the rule. </>}
          Traders’ last price was {formatPct(market.pYes)}.
        </p>
      </div>
    )
  }
  if (market.status === 'voided') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <p className="text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">Voided</p>
        <p className="text-base text-ink-2">Every position was refunded at what it cost. Traders’ last price was {formatPct(market.pYes)}.</p>
      </div>
    )
  }
  const closed = market.status === 'closed' || new Date(market.closesAt).getTime() <= appNow
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xl text-ink-2">{closed ? 'Trading closed at' : 'Traders put this at'}</span>
        <ChangeTint value={market.pYes} className="-mx-1 px-1">
          <Pct value={market.pYes} className="text-5xl font-bold tracking-[-0.02em] text-ink sm:text-6xl" />
        </ChangeTint>
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Delta value={market.change24h} className="font-medium" /> in 24 hours
        </span>
        {closed ? <span>Resolves after {formatDate(deadlineDay(market.resolvesAt))}</span> : <LiveIndicator connected={live} />}
      </p>
    </div>
  )
}
