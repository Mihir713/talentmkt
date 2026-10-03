// TS ↔ SQL parity: the client quote (src/lib/lmsr.ts) must agree with the database functions to
// 1e-6 across a few hundred random cases. Requires the local Supabase stack.
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/lib/db'
import { Rng } from '../../scripts/lib/rng'
import { lmsrCost, lmsrPrice, lmsrSharesForCost, priceTrade, quoteTrade, type Action, type Side } from '../../src/lib/lmsr'

const sql = connect()
afterAll(() => sql.end())

interface Case {
  qYes: number
  qNo: number
  b: number
  feeBps: number
  side: Side
  action: Action
  shares: number
  spend: number
}

function makeCases(n: number): Case[] {
  const rng = new Rng(20261002)
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6
  return Array.from({ length: n }, () => {
    const qYes = round6(rng.chance(0.1) ? 0 : rng.range(0, rng.pick([50, 1500, 20000])))
    const qNo = round6(rng.chance(0.1) ? 0 : rng.range(0, rng.pick([50, 1500, 20000])))
    const action: Action = rng.chance(0.6) ? 'buy' : 'sell'
    const side: Side = rng.chance(0.5) ? 'yes' : 'no'
    const held = side === 'yes' ? qYes : qNo
    const shares = round6(action === 'sell' ? Math.max(held * rng.range(0.001, 1), 0.000001) : 10 ** rng.range(-3, 4))
    return {
      qYes, qNo, side, action, shares,
      b: rng.pick([25, 150, 300, 2000]),
      feeBps: rng.pick([0, 100, 250]),
      spend: round6(10 ** rng.range(-2, 6)),
    }
  })
}

describe('LMSR parity (TS vs SQL)', () => {
  const cases = makeCases(400)

  it('matches cost, price, inversion, trade pricing and spend quotes to 1e-6', async () => {
    const rows = await sql<{
      cost: number; price: number; inv: number; amount: string; fee: string
      price_after: number; spend_shares: string
    }[]>`
      select
        public.lmsr_cost(c.q_yes, c.q_no, c.b) as cost,
        public.lmsr_price(c.q_yes, c.q_no, c.b) as price,
        public.lmsr_shares_for_cost(c.q_yes, c.q_no, c.b, c.spend) as inv,
        pt.amount, pt.fee, pt.price_after,
        private.shares_for_spend(c.q_yes::numeric, c.q_no::numeric, c.b::numeric, c.fee_bps,
                                 c.side::public.trade_side, c.spend::numeric) as spend_shares
      from unnest(
        ${cases.map((c) => c.qYes)}::float8[], ${cases.map((c) => c.qNo)}::float8[],
        ${cases.map((c) => c.b)}::float8[], ${cases.map((c) => c.feeBps)}::int[],
        ${cases.map((c) => c.side)}::text[], ${cases.map((c) => c.action)}::text[],
        ${cases.map((c) => c.shares)}::float8[], ${cases.map((c) => c.spend)}::float8[]
      ) with ordinality as c (q_yes, q_no, b, fee_bps, side, action, shares, spend, i)
      cross join lateral private.price_trade(
        c.q_yes::numeric, c.q_no::numeric, c.b::numeric, c.fee_bps,
        c.side::public.trade_side, c.action::public.trade_action, c.shares::numeric) pt
      order by c.i`

    expect(rows).toHaveLength(cases.length)
    const tol = 1e-6
    cases.forEach((c, i) => {
      const row = rows[i]!
      const where = `case ${i}: ${JSON.stringify(c)}`
      // Absolute cost can be large (C ≈ max(q)); compare relative to magnitude.
      expect(Math.abs(lmsrCost(c.qYes, c.qNo, c.b) - row.cost), where).toBeLessThan(tol * Math.max(1, row.cost))
      expect(Math.abs(lmsrPrice(c.qYes, c.qNo, c.b) - row.price), where).toBeLessThan(tol)
      expect(Math.abs(lmsrSharesForCost(c.qYes, c.qNo, c.b, c.spend) - row.inv), where).toBeLessThan(tol * Math.max(1, row.inv))

      const ts = priceTrade(c, c.side, c.action, c.shares)
      expect(Math.abs(ts.amount - Number(row.amount)), where).toBeLessThanOrEqual(tol + 1e-12)
      expect(Math.abs(ts.fee - Number(row.fee)), where).toBeLessThanOrEqual(tol + 1e-12)
      expect(Math.abs(ts.priceAfter - row.price_after), where).toBeLessThan(tol)

      const quote = quoteTrade(c, c.side, 'buy', { spend: c.spend })
      expect(Math.abs((quote?.shares ?? 0) - Math.max(Number(row.spend_shares), 0)), where).toBeLessThanOrEqual(tol + 1e-12)
    })
  })
})
