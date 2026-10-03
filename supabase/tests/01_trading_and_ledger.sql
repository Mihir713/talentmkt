-- Trading, the ledger, write guards, the insider rule, and whole-database invariants.
begin;
\ir fixtures/world.psql
select plan(33);

-- Pricing and signup ---------------------------------------------------------------------------
select is(public.lmsr_price(0, 0, 150), 0.5::double precision, 'a fresh market prices YES at 50%');
select is((select balance from public.accounts where user_id = :'t1'), 1000.000000::numeric,
  'new users start with 1,000 credits');
select is((select count(*)::int from public.ledger_entries where user_id = :'t1' and kind = 'signup_grant'), 1,
  'the starting credits are a ledger entry');

-- Buying ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'t1', 'role', 'authenticated')::text, true);
select lives_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 100, p_max_cost => 1000)$$, :market_id),
  'a trader can buy YES shares');
select is((select yes_shares from public.positions where user_id = :'t1' and market_id = :market_id), 100.000000::numeric,
  'the position holds the shares bought');
select is((select sum(amount) from public.ledger_entries where user_id = :'t1' and trade_id is not null),
          (select -(cost + fee) from public.trades where user_id = :'t1'),
  'the trade and fee entries debit exactly cost + fee');
select is((select count(*)::int from public.ledger_entries where user_id = :'t1' and kind = 'fee'), 1,
  'the fee is its own ledger entry');
select ok((select fee = ceil(cost * 0.01 * 1000000) / 1000000 from public.trades where user_id = :'t1'),
  'the fee is 1% of cost, rounded up to the micro-credit');
select is((select balance from public.accounts where user_id = :'t1'),
          (select 1000 - cost - fee from public.trades where user_id = :'t1'),
  'the balance reflects the trade');

-- Rejections -----------------------------------------------------------------------------------
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 100, p_max_cost => 1)$$, :market_id),
  'P0001', 'price_moved', 'a buy above the caller''s max cost is rejected');
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 5000, p_max_cost => 100000)$$, :market_id),
  'P0001', 'insufficient_balance', 'a buy beyond the balance is rejected');
select throws_ok(format($$select public.execute_trade(%s, 'no', 'sell', 1, p_min_return => 0)$$, :market_id),
  'P0001', 'insufficient_shares', 'selling shares you do not hold is rejected');
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'sell', 50, p_min_return => 1000)$$, :market_id),
  'P0001', 'price_moved', 'a sale below the caller''s min return is rejected');

-- Selling --------------------------------------------------------------------------------------
select lives_ok(format($$select public.execute_trade(%s, 'yes', 'sell', 50, p_min_return => 0)$$, :market_id),
  'a trader can sell part of a position');
select is((select yes_cost_basis from public.positions where user_id = :'t1' and market_id = :market_id),
          (select (cost + fee) - round((cost + fee) * 50 / 100, 6) from public.trades where user_id = :'t1' and action = 'buy'),
  'selling half the shares removes half the cost basis');
select is((select q_yes from public.markets where id = :market_id),
          (select sum(yes_shares) from public.positions where market_id = :market_id),
  'q_yes equals the YES shares outstanding');

-- Write guards ---------------------------------------------------------------------------------
select throws_ok(format($$update public.accounts set balance = 1000000 where user_id = %L$$, :'t1'),
  'P0001', 'accounts.balance is maintained by the ledger trigger only', 'balances cannot be updated directly');
select throws_ok($$update public.ledger_entries set amount = 1 where id = (select max(id) from public.ledger_entries)$$,
  'P0001', 'ledger_entries is append-only', 'ledger entries cannot be updated');
select throws_ok($$delete from public.ledger_entries where id = (select max(id) from public.ledger_entries)$$,
  'P0001', 'ledger_entries is append-only', 'ledger entries cannot be deleted');
select throws_ok(format($$update public.markets set q_yes = 0 where id = %s$$, :market_id),
  'P0001', 'markets.q_yes/q_no are maintained by execute_trade only', 'q_yes cannot change outside execute_trade');
select throws_ok(format($$insert into public.ledger_entries (user_id, amount, kind) values (%L, -1000000, 'admin_adjust')$$, :'t1'),
  '23514', null, 'the ledger cannot take a balance below zero');

-- Insider rule ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'s1', 'role', 'authenticated')::text, true);
select is(public.can_trade(:market_id) ->> 'reason', 'insider', 'can_trade tells a cohort member they are an insider');
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 1, p_max_cost => 100)$$, :market_id),
  'P0001', 'insider', 'execute_trade rejects a member of the market''s snapshot');
select set_config('request.jwt.claims', '', true);
select throws_ok(
  format($$insert into public.trades (market_id, user_id, side, action, shares, cost, fee, price_before, price_after)
           values (%s, %L, 'yes', 'buy', 1, 1, 0, 0.5, 0.5)$$, :market_id, :'s1'),
  'P0001', 'insider', 'the insider trigger blocks member trades even outside execute_trade');

-- A student who joins the cohort after the snapshot froze is still an insider.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated',
        'late@pgtap.test', now(), '{}', '{}', now(), now());
insert into public.student_profiles (user_id, university_id, program_id, grad_year, verified_email_at, consent_at)
select '00000000-0000-4000-8000-0000000000aa', u.id, p.id, 2027, now(), now()
  from public.universities u join public.programs p on p.university_id = u.id where u.short_name = 'PGTAP';
insert into public.transcript_courses (user_id, course_id, term, grade_band)
select '00000000-0000-4000-8000-0000000000aa', c.id, 'Winter 2026', 'B'
  from public.courses c join public.universities u on u.id = c.university_id where u.short_name = 'PGTAP';
select private.recompute_user_memberships('00000000-0000-4000-8000-0000000000aa');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000aa', 'role', 'authenticated')::text, true);
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 1, p_max_cost => 100)$$, :market_id),
  'P0001', 'insider', 'a current cohort member outside the snapshot is also blocked');

-- Closed markets and anonymous callers ---------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select public.admin_set_sim_now('2029-09-02T00:00:00Z');
select set_config('request.jwt.claims', json_build_object('sub', :'t2', 'role', 'authenticated')::text, true);
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 1, p_max_cost => 100)$$, :market_id),
  'P0001', 'market_closed', 'trading after the close time is rejected');
select set_config('request.jwt.claims', '', true);
select public.admin_set_sim_now(null);

set local role anon;
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 1, p_max_cost => 100)$$, :market_id),
  '42501', null, 'anonymous callers cannot execute trades');
reset role;

-- Whole-database invariants (these also cover seeded data) -------------------------------------
select is((select count(*)::int from public.accounts where balance < 0), 0, 'no balance is negative');
select is(
  (select count(*)::int from public.accounts a
     left join (select user_id, sum(amount) as total from public.ledger_entries group by user_id) l using (user_id)
    where a.balance <> coalesce(l.total, 0)),
  0, 'every balance equals the sum of its ledger entries');
select is(
  (select count(*)::int from public.positions p
     left join (select user_id, market_id,
                       sum(case when side = 'yes' then case when action = 'buy' then shares else -shares end else 0 end) as yes_shares,
                       sum(case when side = 'no'  then case when action = 'buy' then shares else -shares end else 0 end) as no_shares
                  from public.trades group by user_id, market_id) t using (user_id, market_id)
    where p.yes_shares <> coalesce(t.yes_shares, 0) or p.no_shares <> coalesce(t.no_shares, 0)),
  0, 'every position equals its trade history');
select is(
  (select count(*)::int from public.markets m
     left join (select market_id, sum(yes_shares) as y, sum(no_shares) as n from public.positions group by market_id) p
       on p.market_id = m.id
    where m.q_yes <> coalesce(p.y, 0) or m.q_no <> coalesce(p.n, 0)),
  0, 'every market''s q_yes / q_no equal the shares outstanding');
select is(
  (select count(*)::int from public.trades t
     join (select trade_id, sum(amount) as total from public.ledger_entries where trade_id is not null group by trade_id) l
       on l.trade_id = t.id
    where l.total <> case when t.action = 'buy' then -(t.cost + t.fee) else t.cost - t.fee end),
  0, 'every trade''s ledger entries net to exactly its cash flow');
select is(
  (select count(*)::int from (
     select price_before, lag(price_after) over (partition by market_id order by id) as previous
       from public.trades) x
    where previous is not null and price_before <> previous),
  0, 'every trade starts at the price the previous trade left (trades serialize per market)');

select * from finish();
rollback;
