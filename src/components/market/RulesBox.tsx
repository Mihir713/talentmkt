import { deadlineDay, formatDate } from '../../lib/format'
import type { MarketCard } from '../../lib/markets'

const METRIC_SOURCE: Record<MarketCard['metric'], string> = {
  employed_in_field: 'Each member’s latest outcome report: status and the main skill area of their role.',
  employed_in_region: 'Each member’s latest outcome report: status and where the job is located.',
  salary_at_least: 'Each member’s latest outcome report: status and annual base salary band (CAD).',
  grad_school: 'Each member’s latest outcome report: whether they are enrolled in graduate school.',
}

/** The contract, in the Stripe-docs register: one-line summary, the exact rule, then the terms. */
export function RulesBox({ market }: { market: MarketCard }) {
  return (
    <section aria-labelledby="rules-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="rules-heading" className="text-lg font-semibold">
          How this resolves
        </h2>
        <p className="text-ink-2">The rule below was fixed when the market opened and can’t change.</p>
      </div>
      <blockquote className="max-w-[72ch] rounded-md bg-surface-2 px-4 py-3 text-md leading-relaxed text-ink">{market.resolutionRule}</blockquote>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-ink-3">Who counts</dt>
          <dd className="text-ink">
            About {market.snapshotSizeRounded} people, frozen when the market opened on {formatDate(market.opensAt)}. Rounded to the nearest
            5; the exact list is private.
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-ink-3">Data source</dt>
          <dd className="text-ink">{METRIC_SOURCE[market.metric]}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-ink-3">If someone doesn’t report</dt>
          <dd className="text-ink">
            {market.nonresponseRule === 'count_as_no'
              ? 'They count as NO.'
              : `They’re left out, as long as at least ${market.quorumPct}% of the snapshot reports. Below that the market is voided and everyone is refunded at cost.`}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-ink-3">Dates</dt>
          <dd className="text-ink">
            Trading closes as {formatDate(market.closesAt)} begins. Outcomes are read as of the end of {formatDate(deadlineDay(market.resolvesAt))},
            Toronto time.
          </dd>
        </div>
      </dl>
    </section>
  )
}
