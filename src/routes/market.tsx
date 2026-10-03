import { ArrowLeft, Star } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'
import { CohortProfile } from '../components/market/CohortProfile'
import { MobileTradeSheet } from '../components/market/MobileTradeSheet'
import { PositionPanel } from '../components/market/PositionPanel'
import { PriceChart } from '../components/market/PriceChart'
import { PriceFigure } from '../components/market/PriceFigure'
import { RulesBox } from '../components/market/RulesBox'
import { TradeTape } from '../components/market/TradeTape'
import { TradeTicket } from '../components/market/TradeTicket'
import { Chip } from '../components/ui/chip'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState, ErrorState } from '../components/ui/states'
import { useBalance, useUserId } from '../lib/auth'
import { useAppNow } from '../lib/clock'
import { cn } from '../lib/cn'
import { deadlineDay, formatClosesIn, formatDate } from '../lib/format'
import { useCanTrade, useMarket, useMarketRealtime, usePosition, useToggleWatchlist, useWatchlist, type MarketCard } from '../lib/markets'

function StatusChip({ market, appNow }: { market: MarketCard; appNow: number }) {
  if (market.status === 'resolved') return <Chip tone={market.outcome === 'yes' ? 'yes' : 'no'}>Resolved {market.outcome?.toUpperCase()}</Chip>
  if (market.status === 'voided') return <Chip tone="quiet">Voided, refunded</Chip>
  if (market.status === 'closed' || new Date(market.closesAt).getTime() <= appNow) return <Chip tone="caution">Awaiting resolution</Chip>
  return <Chip tone="quiet">Open, {formatClosesIn(market.closesAt, appNow)}</Chip>
}

function WatchButton({ marketId }: { marketId: number }) {
  const userId = useUserId()
  const { data: watchlist } = useWatchlist()
  const toggle = useToggleWatchlist()
  if (!userId) return null
  const watching = watchlist?.has(marketId) ?? false
  return (
    <button
      type="button"
      onClick={() => toggle.mutate(marketId)}
      aria-pressed={watching}
      className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
    >
      <Star aria-hidden weight={watching ? 'fill' : 'regular'} className={cn('size-4', watching && 'text-caution')} />
      {watching ? 'Watching' : 'Watch'}
    </button>
  )
}

function MarketSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full max-w-[720px]" />
        <Skeleton className="h-9 w-3/4 max-w-[560px]" />
        <Skeleton className="h-6 w-80" />
        <Skeleton className="h-16 w-96" />
        <Skeleton className="h-[300px] w-full" />
      </div>
      <Skeleton className="h-[460px] w-full max-lg:hidden" />
    </div>
  )
}

export function Component() {
  const id = Number(useParams().id)
  const appNow = useAppNow(30_000)
  const signedIn = !!useUserId()
  const { data: market, isPending, isError, refetch } = useMarket(id)
  const canTrade = useCanTrade(id)
  const position = usePosition(id)
  const balance = useBalance()
  const live = useMarketRealtime(id)

  if (!Number.isFinite(id)) return <MarketNotFound />
  if (isPending) return <MarketSkeleton />
  if (isError)
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <ErrorState message="This market couldn’t be loaded." onRetry={() => refetch()} />
      </div>
    )
  if (!market) return <MarketNotFound />

  const settled = market.status === 'resolved' || market.status === 'voided'
  const ticketProps = {
    market,
    canTrade: canTrade.data,
    position: position.data,
    balance: balance.data,
    signedIn,
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:pb-16">
      <Link to="/markets" className="inline-flex items-center gap-1 text-sm text-ink-3 no-underline hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All markets
      </Link>

      <div className="mt-4 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-7">
          <header className="flex flex-col gap-3">
            <h1 className="max-w-[24em] text-2xl font-bold tracking-[-0.015em] text-ink sm:text-3xl">{market.question}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/cohorts/${market.cohortSlug}`} className="no-underline">
                <Chip className="max-w-[280px] hover:border-line-strong hover:text-ink">
                  <span className="truncate">{market.cohortTitle}</span>
                </Chip>
              </Link>
              <StatusChip market={market} appNow={appNow} />
              <span className="text-xs text-ink-3">Resolves after {formatDate(deadlineDay(market.resolvesAt))}</span>
              <span className="ml-auto">
                <WatchButton marketId={market.id} />
              </span>
            </div>
          </header>

          <PriceFigure market={market} live={live} appNow={appNow} />
          <PriceChart marketId={market.id} pYes={market.pYes} appNow={appNow} live={live} settled={settled} />
          <RulesBox market={market} />
          <div className="lg:hidden">
            <PositionPanel market={market} position={position.data} />
          </div>
          <TradeTape marketId={market.id} live={live} appNow={appNow} />
        </div>

        <aside className="flex flex-col gap-4 max-lg:hidden lg:sticky lg:top-20 lg:self-start">
          <TradeTicket {...ticketProps} />
          <PositionPanel market={market} position={position.data} />
          <CohortProfile cohortId={market.cohortId} slug={market.cohortSlug} title={market.cohortTitle} />
        </aside>
        <div className="lg:hidden">
          <CohortProfile cohortId={market.cohortId} slug={market.cohortSlug} title={market.cohortTitle} />
        </div>
      </div>
      <MobileTradeSheet {...ticketProps} />
    </div>
  )
}

function MarketNotFound() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <EmptyState title="Market not found" action={<Link to="/markets" className="underline">Browse markets</Link>}>
        There’s no market at this address. It may have been mistyped.
      </EmptyState>
    </div>
  )
}
