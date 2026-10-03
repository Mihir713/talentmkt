import { describe, expect, it } from 'vitest'
import { Rng } from '../../scripts/lib/rng'
import {
  ceil6,
  floor6,
  lmsrCost,
  lmsrPrice,
  lmsrSharesForCost,
  maxHouseLoss,
  quoteTrade,
  type MarketState,
} from './lmsr'

const fresh: MarketState = { qYes: 0, qNo: 0, b: 150, feeBps: 100 }

describe('lmsr math', () => {
  it('starts at 50% with cost b·ln2', () => {
    expect(lmsrPrice(0, 0, 150)).toBe(0.5)
    expect(lmsrCost(0, 0, 150)).toBeCloseTo(150 * Math.LN2, 12)
  })

  it('prices are symmetric and move toward the side bought', () => {
    expect(lmsrPrice(40, 10, 150) + lmsrPrice(10, 40, 150)).toBeCloseTo(1, 15)
    expect(lmsrPrice(100, 0, 150)).toBeGreaterThan(lmsrPrice(50, 0, 150))
  })

  it('stays finite at extreme share imbalances', () => {
    for (const diff of [1e3, 1e5, 1e7]) {
      expect(Number.isFinite(lmsrCost(diff, 0, 150))).toBe(true)
      expect(lmsrPrice(diff, 0, 150)).toBeLessThanOrEqual(1)
      expect(lmsrPrice(0, diff, 150)).toBeGreaterThanOrEqual(0)
    }
  })

  it('spend inversion recovers the cost', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 500; i++) {
      const qy = rng.range(0, 3000)
      const qn = rng.range(0, 3000)
      const b = rng.pick([50, 150, 500])
      const cost = 10 ** rng.range(-4, 6)
      const shares = lmsrSharesForCost(qy, qn, b, cost)
      const recovered = lmsrCost(qy + shares, qn, b) - lmsrCost(qy, qn, b)
      expect(Math.abs(recovered - cost)).toBeLessThan(Math.max(1e-9, cost * 1e-9))
    }
  })

  it('house loss on a market is bounded by b·ln2', () => {
    const shares = 50_000
    const paid = lmsrCost(shares, 0, 150) - lmsrCost(0, 0, 150)
    expect(shares - paid).toBeLessThanOrEqual(maxHouseLoss(150) + 1e-9)
  })
})

describe('rounding', () => {
  it('rounds costs up and proceeds down to the micro-credit', () => {
    expect(ceil6(1.0000001)).toBe(1.000001)
    expect(floor6(1.0000009)).toBe(1)
    expect(ceil6(2.5)).toBe(2.5)
    expect(floor6(2.5)).toBe(2.5)
  })

  it('does not round float noise up a whole micro-credit', () => {
    expect(ceil6(0.1 + 0.2)).toBe(0.3)
    expect(ceil6(1.000001 * 3)).toBe(3.000003)
  })
})

describe('quotes', () => {
  it('a spend quote never costs more than the spend', () => {
    const rng = new Rng(11)
    for (let i = 0; i < 1000; i++) {
      const market = { qYes: rng.range(0, 2000), qNo: rng.range(0, 2000), b: rng.pick([50, 150, 500]), feeBps: rng.pick([0, 100, 250]) }
      const spend = Number((10 ** rng.range(-3, 6)).toFixed(6))
      const quote = quoteTrade(market, rng.chance(0.5) ? 'yes' : 'no', 'buy', { spend })
      if (quote) expect(quote.total).toBeLessThanOrEqual(spend)
    }
  })

  it('buying then selling the same shares never makes money', () => {
    const rng = new Rng(13)
    for (let i = 0; i < 500; i++) {
      const market = { qYes: rng.range(0, 1500), qNo: rng.range(0, 1500), b: 150, feeBps: 100 }
      const buy = quoteTrade(market, 'yes', 'buy', { spend: rng.range(1, 500) })
      if (!buy) continue
      const after = { ...market, qYes: market.qYes + buy.shares }
      const sell = quoteTrade(after, 'yes', 'sell', { shares: buy.shares })
      expect(sell?.total ?? 0).toBeLessThanOrEqual(buy.total)
    }
  })

  it('reports fee, payout and price movement for a buy', () => {
    const quote = quoteTrade(fresh, 'yes', 'buy', { spend: 100 })
    expect(quote).not.toBeNull()
    expect(quote!.fee).toBeCloseTo(quote!.cost * 0.01, 5)
    expect(quote!.maxPayout).toBe(quote!.shares)
    expect(quote!.priceAfter).toBeGreaterThan(quote!.priceBefore)
  })

  it('returns null for amounts too small to buy anything', () => {
    expect(quoteTrade(fresh, 'yes', 'buy', { spend: 0.000002 })).toBeNull()
    expect(quoteTrade(fresh, 'yes', 'buy', { spend: 0 })).toBeNull()
    expect(quoteTrade(fresh, 'yes', 'sell', { spend: 10 })).toBeNull()
  })
})
