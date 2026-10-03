// Concurrent execute_trade calls on one market must serialize: fire many parallel clients at the
// same market (plus a second market, so the same accounts are contended across markets) and
// check the final state. Runs against the seeded local database; the trades it adds are ordinary
// bot trades and stay in the data.
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/lib/db'
import { Rng } from '../../scripts/lib/rng'

const CLIENTS = 24
const TRADES_PER_CLIENT = 10

const admin = connect()
const pool = connect({ max: CLIENTS })
afterAll(async () => {
  await Promise.all([admin.end(), pool.end()])
})

describe('concurrent trading', () => {
  it('serializes parallel trades on one market and keeps every invariant', async () => {
    const markets = await admin<{ id: string; cohort_id: string }[]>`
      select m.id, s.cohort_id from public.markets m
        join public.cohort_snapshots s on s.id = m.snapshot_id
       where m.status = 'open' and m.closes_at > public.app_now() + interval '1 day'
       order by m.id limit 2`
    expect(markets.length, 'run `npm run seed` first').toBe(2)
    const marketIds = markets.map((m) => Number(m.id))

    // Traders who are not insiders on either market and can afford a few trades.
    const traders = await admin<{ user_id: string }[]>`
      select a.user_id from public.accounts a
        join public.profiles p on p.user_id = a.user_id and p.role = 'trader' and p.deleted_at is null
       where a.balance > 50
         and not private.is_insider(a.user_id, ${marketIds[0]!})
         and not private.is_insider(a.user_id, ${marketIds[1]!})
       order by a.user_id limit ${CLIENTS}`
    expect(traders.length).toBe(CLIENTS)

    const [before] = await admin<{ max_id: string | null }[]>`select max(id) as max_id from public.trades`
    const firstNewId = Number(before!.max_id ?? 0)

    const rng = new Rng(4242)
    const plans = traders.map((t) =>
      Array.from({ length: TRADES_PER_CLIENT }, () => ({
        user: t.user_id,
        market: rng.chance(0.75) ? marketIds[0]! : marketIds[1]!,
        side: rng.chance(0.5) ? 'yes' : 'no',
        shares: Number(rng.range(0.5, 4).toFixed(6)),
      })))

    const results = await Promise.allSettled(
      plans.map(async (trades) => {
        for (const t of trades) {
          await pool.begin(async (tx) => {
            await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: t.user, role: 'authenticated' })}, true)`
            await tx`select public.execute_trade(${t.market}, ${t.side}::public.trade_side, 'buy', ${t.shares}, p_max_cost => 1000)`
          })
        }
      }))
    const failures = results.filter((r) => r.status === 'rejected')
    expect(failures.map((f) => String((f as PromiseRejectedResult).reason))).toEqual([])

    const [counts] = await admin<{ n: string }[]>`select count(*) as n from public.trades where id > ${firstNewId}`
    expect(Number(counts!.n)).toBe(CLIENTS * TRADES_PER_CLIENT)

    // Each new trade must have seen the state left by the one before it.
    const [chain] = await admin<{ broken: string }[]>`
      select count(*) as broken from (
        select id, price_before, lag(price_after) over (partition by market_id order by id) as previous
          from public.trades where market_id = any(${marketIds})) x
       where id > ${firstNewId} and previous is not null and price_before <> previous`
    expect(Number(chain!.broken)).toBe(0)

    const [q] = await admin<{ mismatched: string }[]>`
      select count(*) as mismatched from public.markets m
        join (select market_id, sum(yes_shares) as y, sum(no_shares) as n from public.positions group by market_id) p
          on p.market_id = m.id
       where m.id = any(${marketIds}) and (m.q_yes <> p.y or m.q_no <> p.n)`
    expect(Number(q!.mismatched)).toBe(0)

    const [ledger] = await admin<{ mismatched: string }[]>`
      select count(*) as mismatched from public.accounts a
        join (select user_id, sum(amount) as total from public.ledger_entries group by user_id) l using (user_id)
       where a.user_id = any(${traders.map((t) => t.user_id)}) and a.balance <> l.total`
    expect(Number(ledger!.mismatched)).toBe(0)
  })
})
