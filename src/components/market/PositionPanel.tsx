import { formatCredits, formatShares, formatSignedCredits } from '../../lib/format'
import type { MarketCard, Position } from '../../lib/markets'

/** The signed-in user's holding in this market, marked to the current price. */
export function PositionPanel({ market, position }: { market: MarketCard; position: Position | null | undefined }) {
  if (!position || (position.yesShares <= 0 && position.noShares <= 0 && position.realizedPnl === 0)) return null
  const value = position.settled ? 0 : position.yesShares * market.pYes + position.noShares * (1 - market.pYes)
  const unrealized = position.settled ? null : value - position.costBasis
  return (
    <section aria-labelledby="position-heading" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 id="position-heading" className="text-md font-semibold">
        Your position
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {position.yesShares > 0 && (
          <div className="flex flex-col">
            <dt className="text-ink-3">YES shares</dt>
            <dd className="font-semibold text-yes">{formatShares(position.yesShares)}</dd>
          </div>
        )}
        {position.noShares > 0 && (
          <div className="flex flex-col">
            <dt className="text-ink-3">NO shares</dt>
            <dd className="font-semibold text-no">{formatShares(position.noShares)}</dd>
          </div>
        )}
        {!position.settled && (
          <>
            <div className="flex flex-col">
              <dt className="text-ink-3">Worth now</dt>
              <dd className="text-ink">{formatCredits(value)} cr</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-ink-3">Paid</dt>
              <dd className="text-ink">{formatCredits(position.costBasis)} cr</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-ink-3">Unrealized</dt>
              <dd className={unrealized! >= 0 ? 'text-yes' : 'text-no'}>{formatSignedCredits(unrealized)} cr</dd>
            </div>
          </>
        )}
        <div className="flex flex-col">
          <dt className="text-ink-3">Realized</dt>
          <dd className="text-ink">{formatSignedCredits(position.realizedPnl)} cr</dd>
        </div>
      </dl>
    </section>
  )
}
