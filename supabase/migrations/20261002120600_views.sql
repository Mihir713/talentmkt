-- Read models.
--
-- Two kinds of view:
--   * Public aggregates (v_market_cards, v_public_trades, v_cohort_public, v_leaderboard,
--     v_price_candles, mv_skill_signal) run with the owner's privileges, so they can aggregate
--     owner-only tables. Each one selects an explicit column list that contains no user id, no
--     membership and no raw cohort count. That column list is the privacy boundary.
--   * The personal view (v_portfolio) filters on auth.uid() and exposes only the caller's rows.

-- Effective status: an 'open' market past its close time reads as 'closed' even before the
-- admin sweep updates the row.
create view public.v_market_cards as
select
  m.id,
  m.question,
  case when m.status = 'open' and m.closes_at <= public.app_now() then 'closed'::public.market_status
       else m.status end                                              as status,
  t.metric,
  m.params,
  c.id                                                                as cohort_id,
  c.slug                                                              as cohort_slug,
  c.title                                                             as cohort_title,
  array(select sk ->> 'tag' from jsonb_array_elements(c.definition -> 'skills') sk) as skill_slugs,
  public.lmsr_price(m.q_yes, m.q_no, m.b)                             as p_yes,
  public.lmsr_price(m.q_yes, m.q_no, m.b) - coalesce(p24.p_yes, 0.5) as change_24h,
  coalesce(v24.volume, 0)::numeric(18, 6)                             as volume_24h,
  coalesce(vall.volume, 0)::numeric(18, 6)                            as volume_total,
  coalesce(vall.trade_count, 0)                                       as trade_count,
  coalesce(vall.traders, 0)                                           as traders,
  m.opens_at,
  m.closes_at,
  m.resolves_at,
  greatest(extract(epoch from m.closes_at - public.app_now()), 0)::bigint as closes_in_seconds,
  m.outcome,
  r.resolved_at,
  case when r.denominator > 0 then (round(r.numerator * 100.0 / r.denominator / 5) * 5)::int end
                                                                      as resolved_pct_rounded,
  (round(s.member_count / 5.0) * 5)::int                              as snapshot_size_rounded,
  m.resolution_rule,
  m.nonresponse_rule,
  m.quorum_pct,
  m.b,
  m.q_yes,
  m.q_no,
  m.fee_bps,
  m.created_at
from public.markets m
join public.market_templates t on t.id = m.template_id
join public.cohort_snapshots s on s.id = m.snapshot_id
join public.cohorts c on c.id = s.cohort_id
left join public.market_resolutions r on r.market_id = m.id
left join lateral (
  select pp.p_yes from public.price_points pp
   where pp.market_id = m.id and pp.ts <= public.app_now() - interval '24 hours'
   order by pp.ts desc, pp.id desc
   limit 1
) p24 on true
left join lateral (
  select sum(tr.cost) as volume from public.trades tr
   where tr.market_id = m.id and tr.created_at > public.app_now() - interval '24 hours'
) v24 on true
left join lateral (
  select sum(tr.cost) as volume, count(*) as trade_count, count(distinct tr.user_id) as traders
    from public.trades tr where tr.market_id = m.id
) vall on true;

create view public.v_public_trades as
select t.id, t.market_id, t.side, t.action, t.shares, t.cost, t.fee, t.price_before, t.price_after, t.created_at
  from public.trades t;

create view public.v_price_candles as
select
  pp.market_id,
  date_bin('1 hour', pp.ts, timestamptz '2000-01-01')        as bucket,
  (array_agg(pp.p_yes order by pp.ts, pp.id))[1]             as open,
  max(pp.p_yes)                                              as high,
  min(pp.p_yes)                                              as low,
  (array_agg(pp.p_yes order by pp.ts desc, pp.id desc))[1]   as close,
  count(*) filter (where pp.trade_id is not null)            as trades
from public.price_points pp
group by pp.market_id, date_bin('1 hour', pp.ts, timestamptz '2000-01-01');

-- Last price in each of p_points equal buckets over the past p_days, carried forward, for the
-- list sparklines. One call for every visible market.
create function public.market_sparklines(p_market_ids bigint[], p_days int default 7, p_points int default 28)
returns table (market_id bigint, points double precision[])
language sql
stable
security definer
set search_path = ''
as $$
  select ids.id,
         array(
           select coalesce(
                    (select pp.p_yes from public.price_points pp
                      where pp.market_id = ids.id and pp.ts <= b.edge
                      order by pp.ts desc, pp.id desc limit 1),
                    0.5)
             from generate_series(1, least(greatest(p_points, 2), 200)) g (i)
             cross join lateral (
               select public.app_now() - make_interval(days => least(greatest(p_days, 1), 365))
                      + (make_interval(days => least(greatest(p_days, 1), 365)) * g.i / least(greatest(p_points, 2), 200)) as edge
             ) b
            order by g.i)
    from unnest(p_market_ids[1:200]) as ids (id)
    join public.markets m on m.id = ids.id
$$;

-- Runs with the owner's privileges because it joins snapshots and cohorts (whose raw rows are
-- not readable by members); the WHERE clause restricts it to the caller's own positions.
create view public.v_portfolio as
select
  p.market_id,
  m.question,
  m.status,
  m.outcome,
  m.closes_at,
  c.slug                                                   as cohort_slug,
  c.title                                                  as cohort_title,
  p.yes_shares,
  p.no_shares,
  p.yes_cost_basis + p.no_cost_basis                       as cost_basis,
  p.realized_pnl,
  p.settled_at,
  public.lmsr_price(m.q_yes, m.q_no, m.b)                  as p_yes,
  case when p.settled_at is null
       then (p.yes_shares * public.lmsr_price(m.q_yes, m.q_no, m.b)
             + p.no_shares * (1 - public.lmsr_price(m.q_yes, m.q_no, m.b)))::numeric(18, 6)
       else 0 end                                          as mark_value,
  case when p.settled_at is null
       then ((p.yes_shares * public.lmsr_price(m.q_yes, m.q_no, m.b)
              + p.no_shares * (1 - public.lmsr_price(m.q_yes, m.q_no, m.b)))::numeric
             - (p.yes_cost_basis + p.no_cost_basis))::numeric(18, 6)
  end                                                      as unrealized_pnl,
  m.b,
  m.q_yes,
  m.q_no,
  m.fee_bps,
  p.updated_at
from public.positions p
join public.markets m on m.id = p.market_id
join public.cohort_snapshots s on s.id = m.snapshot_id
join public.cohorts c on c.id = s.cohort_id
where p.user_id = auth.uid();

-- P&L = balance + mark value of unsettled positions − credits granted (signup + admin).
-- Brier: for each resolved market a trader traded, their forecast is the share-weighted mean of
-- the YES price their trades left the market at (the price they moved it to). Brier is the mean
-- of (forecast − outcome)². Lower is better; ranked once a trader has 3 resolved markets.
create view public.v_leaderboard as
with traders as (
  select distinct t.user_id from public.trades t
),
open_value as (
  select p.user_id,
         sum(p.yes_shares * public.lmsr_price(m.q_yes, m.q_no, m.b)
             + p.no_shares * (1 - public.lmsr_price(m.q_yes, m.q_no, m.b))) as value
    from public.positions p
    join public.markets m on m.id = p.market_id
   where p.settled_at is null
   group by p.user_id
),
funding as (
  select l.user_id, sum(l.amount) as granted
    from public.ledger_entries l
   where l.kind in ('signup_grant', 'admin_adjust')
   group by l.user_id
),
realized as (
  select p.user_id, sum(p.realized_pnl) as realized from public.positions p group by p.user_id
),
forecasts as (
  select t.user_id, t.market_id, sum(t.price_after * t.shares) / sum(t.shares) as forecast
    from public.trades t
   group by t.user_id, t.market_id
),
brier as (
  select f.user_id,
         avg(power(f.forecast - case when m.outcome = 'yes' then 1 else 0 end, 2)) as brier,
         count(*) as resolved_markets
    from forecasts f
    join public.markets m on m.id = f.market_id and m.status = 'resolved'
   group by f.user_id
),
scored as (
  select pr.handle,
         pr.user_id = auth.uid()                                                     as is_me,
         (a.balance + coalesce(ov.value, 0) - coalesce(fu.granted, 0))::numeric(18, 2) as pnl,
         coalesce(re.realized, 0)::numeric(18, 2)                                     as realized_pnl,
         br.brier,
         coalesce(br.resolved_markets, 0)                                             as resolved_markets
    from traders tr
    join public.profiles pr on pr.user_id = tr.user_id and pr.deleted_at is null
    join public.accounts a on a.user_id = tr.user_id
    left join open_value ov on ov.user_id = tr.user_id
    left join funding fu on fu.user_id = tr.user_id
    left join realized re on re.user_id = tr.user_id
    left join brier br on br.user_id = tr.user_id
)
select
  s.handle,
  s.is_me,
  s.pnl,
  s.realized_pnl,
  rank() over (order by s.pnl desc)                                             as pnl_rank,
  round(s.brier::numeric, 4)                                                    as brier,
  s.resolved_markets,
  case when s.resolved_markets >= 3
       then rank() over (partition by s.resolved_markets >= 3 order by s.brier asc) end as accuracy_rank
from scored s;

-- Per cohort and skill tag: how many members have at least one full weighted course in the tag,
-- and the same share across every student with a transcript. The difference is what makes a
-- cohort distinct (every engineer takes first-year calculus; not every engineer takes RF).
-- Materialized because it aggregates every member's transcript and moves slowly. Lives in
-- private: its raw per-tag counts can be tiny, so only rounded shares are public.
create materialized view private.mv_cohort_skill_mix as
with weighted as (
  select tc.user_id, cst.skill_tag_id, sum(cst.weight) as w
    from public.transcript_courses tc
    join public.course_skill_tags cst on cst.course_id = tc.course_id
   where tc.grade_band is distinct from 'F'
   group by tc.user_id, cst.skill_tag_id
  having sum(cst.weight) >= 1
),
population as (
  select count(distinct user_id)::numeric as n from public.transcript_courses
),
overall as (
  select w.skill_tag_id, count(*) / nullif((select n from population), 0) as share
    from weighted w group by w.skill_tag_id
)
select m.cohort_id, st.slug, st.label, count(*)::int as members, coalesce(o.share, 0)::numeric(6, 4) as overall_share
  from public.cohort_memberships m
  join weighted w on w.user_id = m.user_id
  join public.skill_tags st on st.id = w.skill_tag_id
  left join overall o on o.skill_tag_id = w.skill_tag_id
 group by m.cohort_id, st.slug, st.label, o.share;

create unique index mv_cohort_skill_mix_idx on private.mv_cohort_skill_mix (cohort_id, slug);

-- Public cohort profile. Hidden while the live member count is below min_size (k).
-- Counts are rounded to the nearest 5. top_skills lists the eight skills most over-represented
-- relative to all students, each with the share of members who have at least one full course in
-- it (rounded to the whole percent) and the share across all students.
create view public.v_cohort_public as
select
  c.id,
  c.slug,
  c.title,
  c.definition,
  c.status,
  c.created_at,
  (round(mc.n / 5.0) * 5)::int as member_count_rounded,
  coalesce(ts.top_skills, '[]'::jsonb) as top_skills,
  coalesce(mk.open_markets, 0) as open_markets,
  coalesce(mk.total_markets, 0) as total_markets
from public.cohorts c
cross join lateral (
  select count(*) as n from public.cohort_memberships m where m.cohort_id = c.id
) mc
left join lateral (
  select jsonb_agg(jsonb_build_object('slug', x.slug, 'label', x.label, 'share_pct', x.share_pct,
                                      'overall_pct', round(x.overall_share * 100)::int)
                   order by x.lift desc, x.slug) as top_skills
    from (select sm.slug, sm.label, sm.overall_share,
                 least(100, round(sm.members * 100.0 / mc.n))::int as share_pct,
                 sm.members::numeric / mc.n - sm.overall_share as lift
            from private.mv_cohort_skill_mix sm
           where sm.cohort_id = c.id
           order by lift desc, sm.slug limit 8) x
) ts on true
left join lateral (
  select count(*) filter (where mm.status = 'open' and mm.closes_at > public.app_now()) as open_markets,
         count(*) as total_markets
    from public.markets mm
    join public.cohort_snapshots ss on ss.id = mm.snapshot_id
   where ss.cohort_id = c.id
) mk on true
where c.status in ('active', 'retired')
  and mc.n >= c.min_size;

-- Skill Signal: per skill tag, the volume-weighted mean implied P(YES) across open markets whose
-- cohort definition includes the tag, and the same mean 7 days ago (markets that did not exist
-- 7 days ago are left out of the earlier mean, and each market is weighted by its volume up to
-- that point). Mixes metrics by design; it is a read of overall trader optimism for the skill.
create materialized view public.mv_skill_signal as
with open_markets as (
  select m.id, m.q_yes, m.q_no, m.b, m.opens_at, c.definition
    from public.markets m
    join public.cohort_snapshots s on s.id = m.snapshot_id
    join public.cohorts c on c.id = s.cohort_id
   where m.status = 'open' and m.closes_at > public.app_now()
),
tagged as (
  select om.*, st.id as skill_tag_id
    from open_markets om
    cross join lateral jsonb_array_elements(om.definition -> 'skills') sk
    join public.skill_tags st on st.slug = sk ->> 'tag'
),
priced as (
  select tg.skill_tag_id,
         tg.id as market_id,
         public.lmsr_price(tg.q_yes, tg.q_no, tg.b) as p_now,
         (select pp.p_yes from public.price_points pp
           where pp.market_id = tg.id and pp.ts <= public.app_now() - interval '7 days'
           order by pp.ts desc, pp.id desc limit 1) as p_7d,
         (select coalesce(sum(t.cost), 0) from public.trades t where t.market_id = tg.id) as volume,
         (select coalesce(sum(t.cost), 0) from public.trades t
           where t.market_id = tg.id and t.created_at <= public.app_now() - interval '7 days') as volume_7d
    from tagged tg
),
agg as (
  select p.skill_tag_id,
         sum(p.p_now * p.volume) / nullif(sum(p.volume), 0) as signal,
         sum(p.p_7d * p.volume_7d) filter (where p.p_7d is not null)
           / nullif(sum(p.volume_7d) filter (where p.p_7d is not null), 0) as signal_7d_ago,
         count(*) as open_markets,
         sum(p.volume) as volume
    from priced p
   group by p.skill_tag_id
)
select
  st.id                                  as skill_tag_id,
  st.slug,
  st.label,
  st.category,
  a.signal,
  a.signal_7d_ago,
  a.signal - a.signal_7d_ago             as change_7d,
  coalesce(a.open_markets, 0)            as open_markets,
  coalesce(a.volume, 0)::numeric(18, 2)  as volume,
  public.app_now()                       as computed_at
from public.skill_tags st
left join agg a on a.skill_tag_id = st.id;

create unique index mv_skill_signal_skill_tag_id_idx on public.mv_skill_signal (skill_tag_id);

-- Landing page figures, all live: open markets, live cohorts, people trading, trades.
create function public.landing_stats()
returns table (open_markets int, live_cohorts int, traders int, trades int, students int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.markets m where m.status = 'open' and m.closes_at > public.app_now())::int,
    (select count(*) from public.v_cohort_public)::int,
    (select count(distinct t.user_id) from public.trades t)::int,
    (select count(*) from public.trades)::int,
    -- Rounded to the nearest 50 so the landing page never states an exact head count.
    ((select round(count(*) / 50.0) * 50 from public.student_profiles sp where sp.grad_year is not null))::int
$$;

-- Refreshes the slow-moving read models. Concurrent refresh keeps readers unblocked.
create function private.refresh_read_models()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.mv_skill_signal;
  refresh materialized view concurrently private.mv_cohort_skill_mix;
end
$$;

create function public.admin_refresh_skill_signal()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  perform private.refresh_read_models();
  perform private.audit('refresh', 'read_models', null, '{}'::jsonb);
  return public.app_now();
end
$$;

-- Every 5 minutes.
select cron.schedule('refresh-read-models', '*/5 * * * *', 'select private.refresh_read_models()');
