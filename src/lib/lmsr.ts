// Client mirror of the LMSR functions in supabase/migrations/20261002120400_markets.sql, so trade
// quotes are instant. The database is the source of truth: execute_trade re-prices every trade
// and rejects it if the caller's max_cost / min_return no longer holds.
// tests/db/lmsr-parity.test.ts checks these agree with SQL to 1e-6.

export type Side = 'yes' | 'no'
export type Action = 'buy' | 'sell'

export interface MarketState {
  qYes: number
  qNo: number
  b: number
  feeBps: number
}

export interface TradeQuote {
  shares: number
  /** Cost of a buy (rounded up) or proceeds of a sell (rounded down), before fee. */
  cost: number
  fee: number
  /** Buys: cost + fee, the most you pay. Sells: proceeds − fee, what you receive. */
  total: number
  avgPrice: number
  priceBefore: number
  priceAfter: number
  /** Buys only: what the shares pay if the side wins. */
  maxPayout: number | null
}

// Postgres raises on exp() overflow/underflow, so SQL clamps every exponent; mirror it exactly.
const EXP_LIMIT = 700
const MICRO = 1_000_000

/** C(qy, qn) = b · ln(e^(qy/b) + e^(qn/b)), in log-sum-exp form. */
export function lmsrCost(qYes: number, qNo: number, b: number): number {
  return Math.max(qYes, qNo) + b * Math.log(1 + Math.exp(Math.max(-Math.abs(qYes - qNo) / b, -EXP_LIMIT)))
}

/** P(YES) = 1 / (1 + e^((qn − qy)/b)). */
export function lmsrPrice(qYes: number, qNo: number, b: number): number {
  return 1 / (1 + Math.exp(Math.min(Math.max((qNo - qYes) / b, -EXP_LIMIT), EXP_LIMIT)))
}

/** Shares of one side that raw LMSR cost `cost` buys: Δ = c + b · softplus(r + ln(1 − e^(−c/b))). */
export function lmsrSharesForCost(qSide: number, qOther: number, b: number, cost: number): number {
  if (cost <= 0) return 0
  const x = cost / b
  const oneMinusExp = x < 1e-4 ? x * (1 - (x / 2) * (1 - x / 3)) : 1 - Math.exp(-Math.min(x, EXP_LIMIT))
  const z = (qOther - qSide) / b + Math.log(oneMinusExp)
  return cost + b * (Math.max(z, 0) + Math.log(1 + Math.exp(Math.max(-Math.abs(z), -EXP_LIMIT))))
}

// Postgres casts float8 to numeric through 15 significant digits, which drops float noise before
// rounding. Doing the same here keeps ceil/floor on the same side of each micro-credit boundary.
function micros(value: number): number {
  return Number((value * MICRO).toPrecision(15))
}

/** Rounds up to the micro-credit (costs and fees: house favour). */
export function ceil6(value: number): number {
  return Math.ceil(micros(Number(value.toPrecision(15)))) / MICRO
}

/** Rounds down to the micro-credit (proceeds and payouts: house favour). */
export function floor6(value: number): number {
  return Math.floor(micros(Number(value.toPrecision(15)))) / MICRO
}

/** Truncates a share amount to 6 decimals, like numeric(18,6) assignment in execute_trade. */
export function trunc6(value: number): number {
  return Math.trunc(micros(value)) / MICRO
}

/** Mirrors private.price_trade: prices `shares` of one side. */
export function priceTrade(market: MarketState, side: Side, action: Action, shares: number) {
  const delta = action === 'buy' ? shares : -shares
  const nextYes = market.qYes + (side === 'yes' ? delta : 0)
  const nextNo = market.qNo + (side === 'no' ? delta : 0)
  const diff = lmsrCost(nextYes, nextNo, market.b) - lmsrCost(market.qYes, market.qNo, market.b)
  const amount = action === 'buy' ? Math.max(ceil6(diff), 0.000001) : Math.max(floor6(-diff), 0)
  const fee = ceil6((amount * market.feeBps) / 10000)
  return {
    amount,
    fee,
    priceBefore: lmsrPrice(market.qYes, market.qNo, market.b),
    priceAfter: lmsrPrice(nextYes, nextNo, market.b),
  }
}

/**
 * Mirrors public.quote_trade. Pass `shares`, or for buys `spend`: the most to pay in total,
 * fee included. Returns null when the amount is too small to buy anything.
 */
export function quoteTrade(
  market: MarketState,
  side: Side,
  action: Action,
  amount: { shares: number } | { spend: number },
): TradeQuote | null {
  let shares: number
  if ('spend' in amount) {
    if (action !== 'buy' || !(amount.spend > 0)) return null
    const qSide = side === 'yes' ? market.qYes : market.qNo
    const qOther = side === 'yes' ? market.qNo : market.qYes
    // Same 3 µcredit hold-back as SQL, so cost + fee never exceeds the spend.
    const netCost = (amount.spend - 0.000003) / (1 + market.feeBps / 10000)
    shares = floor6(lmsrSharesForCost(qSide, qOther, market.b, netCost))
  } else {
    shares = trunc6(amount.shares)
  }
  if (!(shares > 0)) return null

  const priced = priceTrade(market, side, action, shares)
  const total = action === 'buy' ? priced.amount + priced.fee : priced.amount - priced.fee
  return {
    shares,
    cost: priced.amount,
    fee: priced.fee,
    total: Math.round(total * MICRO) / MICRO,
    avgPrice: priced.amount / shares,
    priceBefore: priced.priceBefore,
    priceAfter: priced.priceAfter,
    maxPayout: action === 'buy' ? shares : null,
  }
}

/** Largest possible house loss on a market: b · ln 2. */
export function maxHouseLoss(b: number): number {
  return b * Math.LN2
}
