import { ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react'
import { Virtuoso } from 'react-virtuoso'
import { cn } from '../../lib/cn'
import { formatAgo, formatCredits, formatPct, formatSharesFixed } from '../../lib/format'
import { useTrades } from '../../lib/markets'
import { LiveIndicator } from '../ui/live'
import { Skeleton } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'

/** Public trades, newest first, virtualized. No trader identities, by design. */
export function TradeTape({ marketId, live, appNow }: { marketId: number; live: boolean; appNow: number }) {
  const { data, isPending, isError, refetch } = useTrades(marketId)
  return (
    <section aria-labelledby="tape-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="tape-heading" className="text-lg font-semibold">
          Trades
        </h2>
        <LiveIndicator connected={live} />
      </div>
      {isError ? (
        <ErrorState message="Recent trades couldn’t be loaded." onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState title="No trades yet">The first trade sets the price away from 50%.</EmptyState>
      ) : (
        <div className="rounded-lg border border-line bg-surface">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b border-line px-3 py-2 text-xs text-ink-3 max-sm:grid-cols-[1fr_auto_auto]">
            <span>Trade</span>
            <span className="text-right max-sm:hidden">Shares</span>
            <span className="text-right">Credits</span>
            <span className="text-right">Price after</span>
          </div>
          <Virtuoso
            style={{ height: 360 }}
            data={data}
            computeItemKey={(_, t) => t.id!}
            itemContent={(_, t) => {
              const buy = t.action === 'buy'
              const yes = t.side === 'yes'
              return (
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b border-line px-3 py-2 text-sm last:border-b-0 max-sm:grid-cols-[1fr_auto_auto]">
                  <span className="flex min-w-0 items-center gap-2">
                    {buy === yes ? (
                      <ArrowUpRight aria-hidden className="size-4 shrink-0 text-yes" />
                    ) : (
                      <ArrowDownRight aria-hidden className="size-4 shrink-0 text-no" />
                    )}
                    <span className="truncate">
                      <span className="text-ink-2">{buy ? 'Bought' : 'Sold'}</span>{' '}
                      <span className={cn('font-semibold', yes ? 'text-yes' : 'text-no')}>{yes ? 'YES' : 'NO'}</span>
                      <span className="text-ink-3"> · {formatAgo(t.created_at!, appNow)}</span>
                    </span>
                  </span>
                  <span className="text-right text-ink-2 max-sm:hidden">{formatSharesFixed(t.shares)}</span>
                  <span className="text-right text-ink-2">{formatCredits(Number(t.cost) + (buy ? Number(t.fee) : -Number(t.fee)))}</span>
                  <span className="text-right font-medium text-ink">{formatPct(t.price_after)}</span>
                </div>
              )
            }}
          />
        </div>
      )}
    </section>
  )
}
