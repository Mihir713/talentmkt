import { Link, Navigate } from 'react-router'
import { Virtuoso } from 'react-virtuoso'
import { ChangeTint, Credits, Pct } from '../components/ui/figures'
import { LiveIndicator } from '../components/ui/live'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState, ErrorState } from '../components/ui/states'
import { buttonStyles } from '../components/ui/button'
import { useBalance, useSession } from '../lib/auth'
import { cn } from '../lib/cn'
import { formatCredits, formatDateTime, formatPct, formatSharesFixed, formatSignedCredits } from '../lib/format'
import { markValue, usePortfolio, usePortfolioRealtime, useTradeHistory, type PortfolioRow } from '../lib/portfolio'

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="order-2 text-sm text-ink-3">{label}</dt>
      <dd className="order-1 text-2xl font-bold text-ink">{children}</dd>
    </div>
  )
}

const POS = 'grid grid-cols-[minmax(0,1fr)_120px_80px_100px_110px] items-center gap-x-4 max-md:grid-cols-[minmax(0,1fr)_96px]'

function Holding({ p }: { p: PortfolioRow }) {
  const yes = Number(p.yes_shares)
  const no = Number(p.no_shares)
  return (
    <span className="flex flex-col text-right text-sm">
      {yes > 0 && <span className="font-medium text-yes">{formatSharesFixed(yes)} YES</span>}
      {no > 0 && <span className="font-medium text-no">{formatSharesFixed(no)} NO</span>}
    </span>
  )
}

function OpenRow({ p }: { p: PortfolioRow }) {
  const value = markValue(p)
  const pnl = value - Number(p.cost_basis)
  return (
    <li className={cn(POS, 'border-b border-line px-1 py-3 last:border-b-0')} data-testid="position-row">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link to={`/markets/${p.market_id}`} className="line-clamp-2 font-medium text-ink no-underline hover:underline">
          {p.question}
        </Link>
        <span className="truncate text-xs text-ink-3">{p.cohort_title}</span>
      </div>
      <Holding p={p} />
      <span className="text-right text-sm text-ink-2 max-md:hidden">
        <ChangeTint value={p.p_yes ?? 0.5} className="px-1">
          <Pct value={p.p_yes ?? 0.5} />
        </ChangeTint>
      </span>
      <span className="text-right text-sm text-ink max-md:hidden">{formatCredits(value)}</span>
      <span className={cn('text-right text-sm font-medium max-md:hidden', pnl >= 0 ? 'text-yes' : 'text-no')}>{formatSignedCredits(pnl)}</span>
    </li>
  )
}

export function Component() {
  const { session, ready } = useSession()
  const balance = useBalance()
  const portfolio = usePortfolio()
  const trades = useTradeHistory()
  const live = usePortfolioRealtime()

  if (ready && !session) return <Navigate to="/signin?next=/portfolio" replace />

  const positions = portfolio.data?.positions ?? []
  const open = positions.filter((p) => !p.settled_at && (Number(p.yes_shares) > 0 || Number(p.no_shares) > 0))
  const settled = positions.filter((p) => p.settled_at)
  const openValue = open.reduce((s, p) => s + markValue(p), 0)
  const realized = positions.reduce((s, p) => s + Number(p.realized_pnl), 0)
  const unrealized = open.reduce((s, p) => s + markValue(p) - Number(p.cost_basis), 0)
  const total = balance.data != null && portfolio.data ? balance.data + openValue - portfolio.data.granted : null

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-10 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-[-0.015em]">Portfolio</h1>
          <LiveIndicator connected={live} />
        </div>
        {balance.data == null || !portfolio.data ? (
          <Skeleton className="h-16 w-full max-w-[640px]" />
        ) : (
          <dl className="grid grid-cols-2 gap-6 border-y border-line py-5 sm:grid-cols-4">
            <Stat label="Balance (credits)">
              <Credits value={balance.data} />
            </Stat>
            <Stat label="Open positions, at today’s prices">
              <Credits value={openValue} />
            </Stat>
            <Stat label="Realized P&L">
              <span className={realized >= 0 ? 'text-yes' : 'text-no'}>{formatSignedCredits(realized)}</span>
            </Stat>
            <Stat label="Total P&L since you joined">
              <span className={(total ?? 0) >= 0 ? 'text-yes' : 'text-no'}>{formatSignedCredits(total)}</span>
            </Stat>
          </dl>
        )}
      </header>

      <section aria-labelledby="open-heading" className="flex flex-col gap-3">
        <h2 id="open-heading" className="text-lg font-semibold">
          Open positions <span className="font-normal text-ink-3">· unrealized {formatSignedCredits(unrealized)}</span>
        </h2>
        {portfolio.isError ? (
          <ErrorState message="Positions couldn’t be loaded." onRetry={() => portfolio.refetch()} />
        ) : portfolio.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : open.length === 0 ? (
          <EmptyState title="No open positions" action={<Link to="/markets" className={buttonStyles({ variant: 'primary', size: 'sm' })}>Browse markets</Link>}>
            Buy YES or NO on a market and it shows up here, valued at the current price.
          </EmptyState>
        ) : (
          <div>
            <div className={cn(POS, 'border-b border-line-strong px-1 pb-2 text-xs font-medium text-ink-3')}>
              <span>Market</span>
              <span className="text-right">Shares</span>
              <span className="text-right max-md:hidden">Chance</span>
              <span className="text-right max-md:hidden">Worth now</span>
              <span className="text-right max-md:hidden">Unrealized</span>
            </div>
            <ul>{open.map((p) => <OpenRow key={p.market_id} p={p} />)}</ul>
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section aria-labelledby="settled-heading" className="flex flex-col gap-3">
          <h2 id="settled-heading" className="text-lg font-semibold">
            Settled
          </h2>
          <ul className="flex flex-col">
            {settled.map((p) => (
              <li key={p.market_id} className="flex items-center justify-between gap-4 border-b border-line px-1 py-3 last:border-b-0">
                <Link to={`/markets/${p.market_id}`} className="line-clamp-2 min-w-0 text-sm text-ink no-underline hover:underline">
                  {p.question}
                </Link>
                <span className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-ink-3">{p.status === 'voided' ? 'Voided, refunded' : `Resolved ${p.outcome?.toUpperCase()}`}</span>
                  <span className={cn('w-24 text-right font-medium', Number(p.realized_pnl) >= 0 ? 'text-yes' : 'text-no')}>{formatSignedCredits(p.realized_pnl)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-lg font-semibold">
          Trade history
        </h2>
        {trades.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : !trades.data?.length ? (
          <p className="text-ink-3">No trades yet.</p>
        ) : (
          <div className="rounded-lg border border-line bg-surface">
            <Virtuoso
              style={{ height: Math.min(420, trades.data.length * 52 + 4) }}
              data={trades.data}
              computeItemKey={(_, t) => t.id}
              itemContent={(_, t) => {
                const buy = t.action === 'buy'
                const total = buy ? Number(t.cost) + Number(t.fee) : Number(t.cost) - Number(t.fee)
                return (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-line px-3 py-2.5 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-ink">
                        {buy ? 'Bought' : 'Sold'} {formatSharesFixed(t.shares)}{' '}
                        <span className={t.side === 'yes' ? 'font-semibold text-yes' : 'font-semibold text-no'}>{t.side.toUpperCase()}</span> ·{' '}
                        <Link to={`/markets/${t.market_id}`} className="text-ink-2 no-underline hover:underline">
                          {(t.market as { question: string } | null)?.question}
                        </Link>
                      </span>
                      <span className="text-xs text-ink-3">{formatDateTime(t.created_at)}</span>
                    </span>
                    <span className="text-right text-ink-2">{formatPct(t.price_after)} after</span>
                    <span className={cn('w-24 text-right font-medium', buy ? 'text-ink' : 'text-yes')}>
                      {buy ? '−' : '+'}
                      {formatCredits(total)}
                    </span>
                  </div>
                )
              }}
            />
          </div>
        )}
      </section>
    </div>
  )
}
