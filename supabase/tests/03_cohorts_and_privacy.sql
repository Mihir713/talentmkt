-- Cohort rules (k, validation, frozen snapshots), RLS as different JWTs, account deletion, audit.
begin;
\ir fixtures/world.psql
select plan(35);

-- Cohort rules ---------------------------------------------------------------------------------
select throws_ok($$select public.propose_cohort('pgtap-one-class', 'One class',
    '{"skills": [{"tag": "quantum", "min_weighted_courses": 1}], "universities": ["PGTAP"]}')$$,
  'P0001', 'invalid_definition', 'a single-school, single-course definition is rejected');
select throws_ok($$select public.propose_cohort('pgtap-bad-tag', 'Bad tag', '{"skills": [{"tag": "basket-weaving", "min_weighted_courses": 2}]}')$$,
  'P0001', 'invalid_definition', 'definitions may only use skill tags from the taxonomy');
select throws_ok($$insert into public.cohorts (slug, title, definition, proposed_by, min_size)
                   values ('pgtap-small-k', 'Small k', '{"skills": [{"tag": "quantum", "min_weighted_courses": 2}]}', 'admin', 10)$$,
  '23514', null, 'min_size can never be below 25');

select public.propose_cohort('pgtap-too-small', 'pgTAP too small',
  '{"skills": [{"tag": "quantum", "min_weighted_courses": 5}], "universities": ["PGTAP"]}') as small_id \gset
select throws_ok(format('select public.admin_review_cohort(%s, true)', :small_id), 'P0001', 'below_min_size',
  'a cohort below 25 members cannot go live');
select is((select status::text from public.cohorts where id = :small_id), 'proposed', 'it stays proposed');
select throws_ok(format($$update public.cohorts set definition = '{"skills": [{"tag": "ml", "min_weighted_courses": 1}]}' where id = %s$$, :cohort_id),
  'P0001', 'definition_frozen', 'a live cohort''s definition cannot change');
select throws_ok(format('insert into public.cohort_snapshots (cohort_id, member_count) values (%s, 10)', :cohort_id),
  '23514', null, 'a snapshot can never hold fewer than 25 people');
select throws_ok(format('update public.cohort_snapshots set member_count = 99 where cohort_id = %s', :cohort_id),
  'P0001', 'cohort_snapshots rows are frozen', 'snapshots cannot be edited');
select throws_ok(format('delete from public.snapshot_members where snapshot_id in (select id from public.cohort_snapshots where cohort_id = %s)', :cohort_id),
  'P0001', 'snapshot_members rows are frozen', 'snapshot membership cannot be deleted');
select is((select member_count_rounded from public.v_cohort_public where id = :cohort_id), 30,
  'the public cohort view shows the size rounded to 5');
select is((select count(*)::int from public.v_cohort_public where id = :small_id), 0,
  'proposed cohorts never appear publicly');
select hasnt_column('public', 'v_public_trades', 'user_id', 'the public trade view carries no user id');

-- RLS: student s1 ------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'s1', 'role', 'authenticated')::text, true);
select count(*) filter (where user_id = :'s1') as s1_own, count(*) filter (where user_id <> :'s1') as s1_others
  from public.cohort_memberships \gset
select count(*) as s1_sees_s2_transcript from public.transcript_courses where user_id = :'s2' \gset
select count(*) as s1_own_transcript from public.transcript_courses where user_id = :'s1' \gset
select count(*) as s1_sees_s2_snapshot from public.snapshot_members where user_id = :'s2' \gset
select count(*) as s1_sees_other_ledger from public.ledger_entries where user_id <> :'s1' \gset
select count(*) as s1_sees_proposed from public.cohorts where id = :small_id \gset
select count(*) as s1_sees_proposals from public.market_proposals \gset
select count(*) as s1_sees_settings from public.app_settings \gset
select count(*) as s1_sees_snapshots from public.cohort_snapshots \gset
select count(*) as s1_sees_markets from public.markets where id = :market_id \gset
reset role;

select ok(:s1_own > 0, 'a student sees their own cohort memberships');
select is(:s1_others::int, 0, 'a student cannot see anyone else''s memberships');
select is(:s1_own_transcript::int, 3, 'a student sees their own transcript rows');
select is(:s1_sees_s2_transcript::int, 0, 'a student cannot see another student''s transcript');
select is(:s1_sees_s2_snapshot::int, 0, 'a student cannot see who else is in a snapshot');
select is(:s1_sees_other_ledger::int, 0, 'nobody can read another user''s ledger');
select is(:s1_sees_proposed + :s1_sees_proposals + :s1_sees_settings + :s1_sees_snapshots, 0,
  'proposed cohorts, proposals, settings and raw snapshots are hidden from non-admins');
select is(:s1_sees_markets::int, 1, 'markets are public');
select ok(not has_table_privilege('authenticated', 'public.cohort_memberships', 'INSERT')
          and not has_table_privilege('authenticated', 'public.trades', 'INSERT')
          and not has_table_privilege('anon', 'public.ledger_entries', 'INSERT'),
  'clients hold no write grants on any table');

-- Personal view: a trader sees their own position (through joins they can't read directly), nobody else's.
select set_config('request.jwt.claims', json_build_object('sub', :'t1', 'role', 'authenticated')::text, true);
select public.execute_trade(:market_id, 'yes', 'buy', 5, p_max_cost => 100);
set local role authenticated;
select count(*) as t1_portfolio from public.v_portfolio \gset
select set_config('request.jwt.claims', json_build_object('sub', :'t2', 'role', 'authenticated')::text, true);
select count(*) as t2_portfolio from public.v_portfolio \gset
reset role;
select set_config('request.jwt.claims', '', true);
select is(:t1_portfolio::int, 1, 'a trader sees their own position in v_portfolio');
select is(:t2_portfolio::int, 0, 'v_portfolio never shows another trader''s positions');

-- RLS: anon and admin --------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select count(*) as anon_memberships from public.cohort_memberships \gset
select count(*) as anon_cards from public.v_market_cards where id = :market_id \gset
reset role;
select is(:anon_memberships::int, 0, 'anonymous visitors see no memberships');
select is(:anon_cards::int, 1, 'anonymous visitors can read market cards');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select count(*) as admin_memberships from public.cohort_memberships \gset
select count(*) as admin_proposals from public.market_proposals \gset
reset role;
select is(:admin_memberships::int, 0, 'admins cannot read cohort memberships either');
select ok(:admin_proposals > 0, 'admins can read the proposal queue');

-- Account deletion -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'s3', 'role', 'authenticated')::text, true);
select public.delete_my_account();
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.snapshot_members where user_id = :'s3'), 0,
  'a deleted account is removed from frozen snapshots');
select is((select member_count from public.cohort_snapshots s join public.markets m on m.snapshot_id = s.id where m.id = :market_id), 30,
  'the snapshot keeps its size, so the market stays resolvable');
select is((select count(*)::int from public.snapshot_members sm join public.markets m on m.snapshot_id = sm.snapshot_id
             where m.id = :market_id and sm.user_id is null), 1,
  'the deleted member becomes an anonymous tombstone');
select ok((select deleted_at is not null and handle like 'deleted-%' from public.profiles where user_id = :'s3'),
  'the profile becomes a tombstone');
select ok((select email is null and banned_until = 'infinity' from auth.users where id = :'s3'),
  'the login identity is erased and banned');
select is((select count(*)::int from public.transcript_courses where user_id = :'s3')
        + (select count(*)::int from public.cohort_memberships where user_id = :'s3'), 0,
  'transcript data and memberships are deleted');
select set_config('request.jwt.claims', json_build_object('sub', :'s3', 'role', 'authenticated')::text, true);
select throws_ok(format($$select public.execute_trade(%s, 'yes', 'buy', 1, p_max_cost => 10)$$, :market_id),
  'P0001', 'account_deleted', 'a deleted account cannot act');

-- Audit ----------------------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select public.admin_set_sim_now('2027-01-01T00:00:00Z');
select set_config('request.jwt.claims', '', true);
select ok(exists (select 1 from public.audit_log where entity = 'app_settings' and actor = :'admin'),
  'admin actions write to the audit log with the admin as actor');

select * from finish();
rollback;
