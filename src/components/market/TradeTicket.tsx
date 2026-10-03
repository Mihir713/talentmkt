import { LockSimple, WarningCircle } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { cn } from '../../lib/cn'
import { formatCredits, formatPct, formatShares } from '../../lib/format'
import { quoteTrade, type Action, type Side } from '../../lib/lmsr'
import type { CanTradeReason, MarketCard, Position } from '../../lib/markets'
import { useExecuteTrade } from '../../lib/trading'
import { Button, buttonStyles } from '../ui/button'
import { Kbd } from '../ui/kbd'
import { Segmented } from '../ui/segmented'
import { Skeleton } from '../ui/skeleton'

const SLIPPAGE = 0.02

interface Props {
  market: MarketCard
  canTrade: { allowed: boolean; reason: CanTradeReason } | undefined
  position: Position | null | undefined
  balance: number | undefined
  signedIn: boolean
  initialSide?: Side
  onDone?: () => void
  className?: string
}

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn('text-right', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{children}</dd>
    </div>
  )
}

/** Shown in place of the form when this person can't trade this market. */
function Blocked({ reason, market }: { reason: CanTradeReason; market: MarketCard }) {
  if (reason === 'insider') {
    return (
      <div className="flex flex-col gap-2 p-4" data-testid="insider-block">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <LockSimple aria-hidden className="size-4" /> You’re in this market’s cohort
        </p>
        <p className="text-ink-2">
          Members can’t trade markets about their own cohort: they know their own outcomes before anyone else does. You can follow the
          price here and trade any other market.
        </p>
        <Link to="/me" className="mt-1 text-sm font-medium text-ink underline">
          See your cohorts
        </Link>
      </div>
    )
  }
  const closed = market.status !== 'open' || reason === 'market_closed'
  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="font-semibold text-ink">{closed ? 'Trading is closed' : 'Trading is unavailable'}</p>
      <p className="text-ink-2">
        {market.status === 'resolved'
          ? `This market resolved ${market.outcome?.toUpperCase()}. Winning shares paid 1 credit each.`
          : market.status === 'voided'
            ? 'This market was voided and every position was refunded at cost.'
            : closed
              ? 'The deadline has arrived. The market resolves once outcome reports are in.'
              : reason === 'account_deleted'
                ? 'This account has been deleted.'
                : 'Try reloading the page.'}
      </p>
    </div>
  )
}

export function TradeTicket({ market, canTrade, position, balance, signedIn, initialSide = 'yes', onDone, className }: Props) {
  const [action, setAction] = useState<Action>('buy')
  const [side, setSide] = useState<Side>(initialSide)
  const [amount, setAmount] = useState('')
  const [priceMoved, setPriceMoved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const trade = useExecuteTrade(market.id)

  const state = { qYes: market.qYes, qNo: market.qNo, b: market.b, feeBps: market.feeBps }
  const held = side === 'yes' ? (position?.yesShares ?? 0) : (position?.noShares ?? 0)
  const value = Number(amount)
  const quote = useMemo(
    () => (value > 0 ? quoteTrade(state, side, action, action === 'buy' ? { spend: value } : { shares: value }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [market.qYes, market.qNo, market.b, market.feeBps, side, action, value],
  )

  const yesPrice = market.pYes
  const sidePrice = side === 'yes' ? yesPrice : 1 - yesPrice
  const priceAfterSide = quote ? (side === 'yes' ? quote.priceAfter : 1 - quote.priceAfter) : null

  let problem: string | null = null
  if (signedIn && action === 'buy' && balance != null && value > balance) problem = `You have ${formatCredits(balance)} credits.`
  if (signedIn && action === 'sell' && value > held + 1e-9) problem = held > 0 ? `You hold ${formatShares(held)} ${side.toUpperCase()} shares.` : `You don’t hold any ${side.toUpperCase()} shares.`
  if (value > 0 && !quote) problem = 'That amount is too small to trade.'

  const canSubmit = signedIn && !!quote && !problem && !trade.isPending

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSubmit || !quote) return
    setPriceMoved(false)
    trade.mutate(
      { side, action, shares: quote.shares, quotedTotal: quote.total, slippage: SLIPPAGE },
      {
        onSuccess: (result) => {
          setAmount('')
          toast.success(
            action === 'buy'
              ? `Bought ${formatShares(result.shares)} ${side.toUpperCase()} for ${formatCredits(Number(result.total))} credits`
              : `Sold ${formatShares(result.shares)} ${side.toUpperCase()} for ${formatCredits(Number(result.total))} credits`,
          )
          onDone?.()
        },
        onError: (error) => {
          if (error.code === 'price_moved') setPriceMoved(true)
          toast.error(error.message)
        },
      },
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const key = e.key.toLowerCase()
    if (key === 'y' || key === 'n') {
      e.preventDefault()
      setSide(key === 'y' ? 'yes' : 'no')
    }
  }

  if (canTrade && !canTrade.allowed && canTrade.reason !== 'not_authenticated') {
    return (
      <div className={cn('rounded-lg border border-line bg-surface', className)}>
        <Blocked reason={canTrade.reason} market={market} />
      </div>
    )
  }

  const quick = action === 'buy' ? [10, 50, 100] : null

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      aria-label="Trade ticket"
      className={cn('flex flex-col rounded-lg border border-line bg-surface', className)}
    >
      <div className="flex items-center justify-between border-b border-line px-4 pt-1">
        <div role="tablist" aria-label="Buy or sell" className="flex gap-4">
          {(['buy', 'sell'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={action === a}
              onClick={() => {
                setAction(a)
                setAmount('')
              }}
              className={cn(
                '-mb-px h-10 border-b-2 text-sm font-semibold capitalize transition-colors duration-150',
                action === a ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink',
              )}
            >
              {a}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-2xs text-ink-3 max-sm:hidden">
          <Kbd>Y</Kbd>
          <Kbd>N</Kbd> side
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <Segmented
          ariaLabel="Side"
          size="lg"
          value={side}
          onChange={setSide}
          className="w-full"
          options={[
            {
              value: 'yes',
              ariaLabel: `YES at ${formatPct(yesPrice)}`,
              label: (
                <>
                  YES <span className="font-normal opacity-80">{formatPct(yesPrice)}</span>
                </>
              ),
              selectedClassName: '!bg-yes !text-on-yes',
            },
            {
              value: 'no',
              ariaLabel: `NO at ${formatPct(1 - yesPrice)}`,
              label: (
                <>
                  NO <span className="font-normal opacity-80">{formatPct(1 - yesPrice)}</span>
                </>
              ),
              selectedClassName: '!bg-no !text-on-no',
            },
          ]}
        />

        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink">{action === 'buy' ? 'Amount' : 'Shares to sell'}</span>
            {signedIn &&
              (action === 'buy' ? (
                balance == null ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span className="text-xs text-ink-3">{formatCredits(balance)} cr available</span>
                )
              ) : (
                <span className="text-xs text-ink-3">
                  {formatShares(held)} {side.toUpperCase()} held
                </span>
              ))}
          </span>
          <div
            className={cn(
              'flex h-11 items-center rounded-md border bg-bg px-3 transition-colors duration-150 focus-within:border-focus',
              problem ? 'border-danger' : 'border-line-strong',
            )}
          >
            <input
              ref={inputRef}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!!problem}
              aria-describedby="ticket-problem"
              value={amount}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.]/g, '')
                if (/^\d{0,9}(\.\d{0,6})?$/.test(next)) setAmount(next)
              }}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-ink-3"
            />
            <span className="text-sm text-ink-3">{action === 'buy' ? 'credits' : 'shares'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quick?.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String((Number(amount) || 0) + n))}
                className="h-7 rounded-md border border-line px-2.5 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                +{n}
              </button>
            ))}
            {signedIn && (action === 'buy' ? balance != null && balance > 0 : held > 0) && (
              <button
                type="button"
                onClick={() => setAmount(action === 'buy' ? String(Math.floor(balance! * 100) / 100) : String(held))}
                className="h-7 rounded-md border border-line px-2.5 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                Max
              </button>
            )}
          </div>
          <p id="ticket-problem" role={problem ? 'alert' : undefined} className={cn('min-h-[1.05rem] text-xs', problem ? 'text-danger' : 'text-transparent')}>
            {problem ?? ' '}
          </p>
        </label>

        <dl className="flex flex-col gap-1.5 text-sm">
          {action === 'buy' ? (
            <>
              <Row label="Shares">{quote ? formatShares(quote.shares) : '0'}</Row>
              <Row label="Average price">{quote ? `${formatCredits(quote.avgPrice)} cr` : `${formatCredits(sidePrice)} cr`}</Row>
              <Row label="Price after">
                {priceAfterSide != null ? `${formatPct(sidePrice)} to ${formatPct(priceAfterSide)}` : formatPct(sidePrice)}
              </Row>
              <Row label={`Fee (${market.feeBps / 100}%)`}>{quote ? `${formatCredits(quote.fee)} cr` : '0.00 cr'}</Row>
              <Row label={`Pays if ${side.toUpperCase()}`} strong>
                {quote ? `${formatCredits(quote.maxPayout ?? 0)} cr` : '0.00 cr'}
              </Row>
            </>
          ) : (
            <>
              <Row label="Average price">{quote ? `${formatCredits(quote.avgPrice)} cr` : `${formatCredits(sidePrice)} cr`}</Row>
              <Row label="Price after">
                {priceAfterSide != null ? `${formatPct(sidePrice)} to ${formatPct(priceAfterSide)}` : formatPct(sidePrice)}
              </Row>
              <Row label={`Fee (${market.feeBps / 100}%)`}>{quote ? `${formatCredits(quote.fee)} cr` : '0.00 cr'}</Row>
              <Row label="You receive" strong>
                {quote ? `${formatCredits(quote.total)} cr` : '0.00 cr'}
              </Row>
            </>
          )}
        </dl>

        {priceMoved && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-caution-soft px-3 py-2 text-sm text-caution">
            <WarningCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            The price moved before your trade landed. The quote above is current; submit again to trade at it.
          </p>
        )}

        {signedIn ? (
          <Button
            type="submit"
            size="lg"
            variant={side === 'yes' ? 'yes' : 'no'}
            disabled={!canSubmit}
            className="w-full"
            data-testid="submit-trade"
          >
            {trade.isPending
              ? 'Placing trade…'
              : problem && action === 'buy' && balance != null && value > balance
                ? 'Not enough credits'
                : quote
                  ? action === 'buy'
                    ? `Buy ${side.toUpperCase()} for ${formatCredits(quote.total)}`
                    : `Sell ${formatShares(quote.shares)} ${side.toUpperCase()}`
                  : `${action === 'buy' ? 'Buy' : 'Sell'} ${side.toUpperCase()}`}
          </Button>
        ) : (
          <Link to={`/signin?next=/markets/${market.id}`} className={cn(buttonStyles({ variant: 'primary', size: 'lg' }), 'w-full')}>
            Sign in to trade
          </Link>
        )}

        <p className="text-xs text-ink-3">
          Your trade only goes through if its cost hasn’t moved more than {SLIPPAGE * 100}% from this quote by the time it reaches the
          market. Play credits only.
        </p>
      </div>
    </form>
  )
}
