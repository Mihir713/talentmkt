-- Resolution pays exactly the winning shares; voids refund cost basis; quorum voids.
begin;
\ir fixtures/world.psql
select plan(21);

-- Two more markets on the same cohort: one to void by hand, one with a quorum rule.
select public.propose_market(:cohort_id, 'grad_school', '{"threshold_pct": 20, "deadline": "2028-09-01"}', 'void me') as p2 \gset
select (public.admin_review_market_proposal(:p2, true) ->> 'market_id')::bigint as void_market_id \gset
select public.propose_market(:cohort_id, 'employed_in_field', '{"threshold_pct": 30, "field": "quantum", "deadline": "2028-05-01"}', 'quorum') as p3 \gset
select (public.admin_review_market_proposal(:p3, true, 150, 'exclude_with_quorum', 60) ->> 'market_id')::bigint as quorum_market_id \gset

-- Positions: t1 is long YES, t2 is long NO, on every market.
select set_config('request.jwt.claims', json_build_object('sub', :'t1', 'role', 'authenticated')::text, true);
select public.execute_trade(:market_id, 'yes', 'buy', 100, p_max_cost => 1000);
select public.execute_trade(:void_market_id, 'yes', 'buy', 50, p_max_cost => 1000);
select public.execute_trade(:void_market_id, 'yes', 'sell', 20, p_min_return => 0);
select public.execute_trade(:quorum_market_id, 'yes', 'buy', 40, p_max_cost => 1000);
select set_config('request.jwt.claims', json_build_object('sub', :'t2', 'role', 'authenticated')::text, true);
select public.execute_trade(:market_id, 'no', 'buy', 80, p_max_cost => 1000);
select public.execute_trade(:void_market_id, 'no', 'buy', 30, p_max_cost => 1000);
select public.execute_trade(:quorum_market_id, 'no', 'buy', 25, p_max_cost => 1000);

-- Guards before the deadline -------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select throws_ok(format('select public.resolve_market(%s)', :market_id), 'P0001', 'not_due',
  'a market cannot resolve before its resolve time');
select set_config('request.jwt.claims', json_build_object('sub', :'t1', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.void_market(%s)', :market_id), 'P0001', 'forbidden',
  'non-admins cannot void markets');

-- Manual void refunds remaining cost basis -----------------------------------------------------
select set_config('request.jwt.claims', '', true);
select yes_cost_basis + no_cost_basis as t1_basis, realized_pnl as t1_realized
  from public.positions where user_id = :'t1' and market_id = :void_market_id \gset
select balance as t1_before from public.accounts where user_id = :'t1' \gset
select yes_cost_basis + no_cost_basis as t2_basis from public.positions where user_id = :'t2' and market_id = :void_market_id \gset
select balance as t2_before from public.accounts where user_id = :'t2' \gset

select lives_ok(format($$select public.void_market(%s, 'pgTAP')$$, :void_market_id), 'an admin can void a market');
select is((select status::text from public.markets where id = :void_market_id), 'voided', 'the voided market is marked voided');
select is((select sum(amount) from public.ledger_entries where user_id = :'t1' and market_id = :void_market_id and kind = 'refund'),
          :t1_basis::numeric, 'a void refunds the remaining cost basis');
select is((select balance from public.accounts where user_id = :'t2'), :t2_before::numeric + :t2_basis::numeric,
  'the refund lands in the balance');
select is((select realized_pnl from public.positions where user_id = :'t1' and market_id = :void_market_id),
          :t1_realized::numeric, 'a void leaves profits already taken by selling unchanged');
select is((select method from public.market_resolutions where market_id = :void_market_id), 'void_admin',
  'the void is recorded with its method');

-- Synthetic outcomes, then resolution ----------------------------------------------------------
select public.admin_set_sim_now('2029-09-03T12:00:00Z');
select public.admin_generate_outcomes(:market_id, 0.8, 1.0);
select public.admin_generate_outcomes(:quorum_market_id, 0.5, 0.4);
select is((select count(*)::int from public.outcome_reports r join public.snapshot_members sm on sm.user_id = r.user_id
             join public.markets m on m.snapshot_id = sm.snapshot_id where m.id = :market_id and r.synthetic),
          30 + 12, 'synthetic reports are written for snapshot members and marked synthetic');

select balance as t1_before_payout from public.accounts where user_id = :'t1' \gset
select balance as t2_before_payout from public.accounts where user_id = :'t2' \gset
select yes_cost_basis + no_cost_basis as t1_basis_main, realized_pnl as t1_realized_main
  from public.positions where user_id = :'t1' and market_id = :market_id \gset

select lives_ok(format('select public.resolve_market(%s)', :market_id), 'an admin can resolve a due market');
select is((select status::text || '/' || outcome::text from public.markets where id = :market_id), 'resolved/yes',
  '24 of 30 employed in Toronto clears a 50% threshold: YES');
select is((select numerator || '/' || denominator from public.market_resolutions where market_id = :market_id), '24/30',
  'the resolution records the raw counts (admin-only)');
select is((select resolved_pct_rounded from public.v_market_cards where id = :market_id), 80,
  'the public card shows the percentage rounded to 5');
select is((select balance from public.accounts where user_id = :'t1'), :t1_before_payout::numeric + 100,
  'each winning share pays exactly 1 credit');
select is((select balance from public.accounts where user_id = :'t2'), :t2_before_payout::numeric,
  'losing shares pay nothing');
select is((select sum(amount) from public.ledger_entries where market_id = :market_id and kind = 'payout'),
          (select sum(yes_shares) from public.positions where market_id = :market_id),
  'total payouts equal the winning shares outstanding');
select is((select realized_pnl from public.positions where user_id = :'t1' and market_id = :market_id),
          :t1_realized_main::numeric + 100 - :t1_basis_main::numeric,
  'realized P&L books payout minus cost basis');
select is((select count(*)::int from public.positions where market_id = :market_id and settled_at is null), 0,
  'every position on the market is settled');
select throws_ok(format('select public.resolve_market(%s)', :market_id), 'P0001', 'market_settled',
  'a settled market cannot resolve twice');

-- Quorum rule ----------------------------------------------------------------------------------
select lives_ok(format('select public.resolve_market(%s)', :quorum_market_id), 'a quorum market resolves');
select is((select status::text || '/' || r.method || '/' || r.response_rate::text
             from public.markets m join public.market_resolutions r on r.market_id = m.id where m.id = :quorum_market_id),
          'voided/void_quorum_not_met/0.4000', 'a 40% response rate under a 60% quorum voids the market');

select * from finish();
rollback;
