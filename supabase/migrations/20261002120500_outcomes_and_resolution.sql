-- Outcomes (the oracle), resolution, voiding, and the simulation tools that feed them.

create table public.outcome_reports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (user_id),
  reported_at        timestamptz not null default public.app_now(),
  status             public.outcome_status not null,
  region             text references public.job_regions (code),
  field_skill_tag_id bigint references public.skill_tags (id),
  salary_band        public.salary_band,
  verification       public.verification_level not null default 'self',
  -- Written by the admin simulation panel, never by a person. Lets demo data be told apart
  -- from (and purged before) real reports.
  synthetic          boolean not null default false,
  check (status = 'employed' or (field_skill_tag_id is null and salary_band is null)),
  check (status <> 'employed' or region is not null)
);

create index outcome_reports_user_id_reported_at_idx on public.outcome_reports (user_id, reported_at desc);

-- Raw counts live here and are admin-only. The public sees the outcome (markets.outcome) and a
-- percentage rounded to the nearest 5 (v_market_cards), never the numerator.
-- The outcome itself is not repeated here; it lives on markets.
create table public.market_resolutions (
  market_id     bigint primary key references public.markets (id),
  numerator     int check (numerator >= 0),
  denominator   int check (denominator >= 0),
  response_rate numeric(5, 4) check (response_rate between 0 and 1),
  method        text not null
    check (method in ('count_as_no', 'exclude_with_quorum', 'void_quorum_not_met', 'void_admin')),
  note          text,
  resolved_by   uuid references public.profiles (user_id),
  resolved_at   timestamptz not null default public.app_now(),
  check (numerator <= denominator),
  check (method = 'void_admin' or (numerator is not null and denominator is not null and response_rate is not null))
);

create trigger market_resolutions_append_only
  before update or delete on public.market_resolutions
  for each row execute function private.reject_mutation();

-- ---------------------------------------------------------------------------------------------
-- Settlement
-- ---------------------------------------------------------------------------------------------

-- Voids a market and refunds each holder's remaining cost basis (what they paid for the shares
-- they still hold). Profits already taken by selling are kept; realized_pnl is unchanged because
-- refund = basis.
create function private.void_market(
  p_market_id bigint, p_method text, p_note text, p_numerator int, p_denominator int, p_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := public.app_now();
begin
  update public.markets set status = 'voided' where id = p_market_id;

  insert into public.market_resolutions
    (market_id, numerator, denominator, response_rate, method, note, resolved_by, resolved_at)
  values (p_market_id, p_numerator, p_denominator, p_rate, p_method, p_note, auth.uid(), v_now);

  insert into public.ledger_entries (user_id, amount, kind, market_id, memo, created_at)
  select p.user_id, p.yes_cost_basis + p.no_cost_basis, 'refund', p_market_id, 'Market voided', v_now
    from public.positions p
   where p.market_id = p_market_id and p.yes_cost_basis + p.no_cost_basis > 0
   order by p.user_id;

  update public.positions set settled_at = v_now where market_id = p_market_id;
end
$$;

create function public.void_market(p_market_id bigint, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.market_status;
begin
  perform private.assert_admin();
  select status into v_status from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found' using detail = 'No market with that id.';
  end if;
  if v_status in ('resolved', 'voided') then
    raise exception 'market_settled' using detail = 'This market is already settled.';
  end if;
  perform private.void_market(p_market_id, 'void_admin', p_reason, null, null, null);
  return jsonb_build_object('market_id', p_market_id, 'status', 'voided');
end
$$;

-- Evaluates the market's rule against the snapshot members' latest outcome reports as of
-- resolves_at, applies the non-response rule, records the resolution, and pays each winning
-- share 1 credit through the ledger. Tombstoned (deleted) members count as non-responses.
create function public.resolve_market(p_market_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.markets%rowtype;
  v_metric public.market_metric;
  v_n int;
  v_responders int;
  v_yes int;
  v_den int;
  v_rate numeric;
  v_threshold int;
  v_outcome public.trade_side;
  v_now timestamptz := public.app_now();
begin
  perform private.assert_admin();

  select * into v_m from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found' using detail = 'No market with that id.';
  end if;
  if v_m.status in ('resolved', 'voided') then
    raise exception 'market_settled' using detail = 'This market is already settled.';
  end if;
  if v_now < v_m.resolves_at then
    raise exception 'not_due'
      using detail = format('This market resolves after %s.', to_char(v_m.resolves_at at time zone 'America/Toronto', 'FMMon FMDD, YYYY'));
  end if;

  select t.metric into v_metric from public.market_templates t where t.id = v_m.template_id;
  select s.member_count into v_n from public.cohort_snapshots s where s.id = v_m.snapshot_id;
  v_threshold := (v_m.params ->> 'threshold_pct')::int;

  with latest as (
    select distinct on (r.user_id) r.*
      from public.outcome_reports r
      join public.snapshot_members sm on sm.user_id = r.user_id and sm.snapshot_id = v_m.snapshot_id
     where r.reported_at < v_m.resolves_at
     order by r.user_id, r.reported_at desc, r.id desc
  )
  select count(*),
         count(*) filter (where case v_metric
           when 'employed_in_field' then
             l.status = 'employed'
             and l.field_skill_tag_id = (select st.id from public.skill_tags st where st.slug = v_m.params ->> 'field')
           when 'employed_in_region' then
             l.status = 'employed' and l.region = v_m.params ->> 'region'
           when 'salary_at_least' then
             l.status = 'employed' and l.salary_band >= (v_m.params ->> 'salary_band')::public.salary_band
           when 'grad_school' then
             l.status = 'grad_school'
         end)
    into v_responders, v_yes
    from latest l;

  v_rate := round(v_responders::numeric / v_n, 4);

  if v_m.nonresponse_rule = 'exclude_with_quorum' then
    if v_responders = 0 or v_responders * 100 < v_m.quorum_pct * v_n then
      perform private.void_market(p_market_id, 'void_quorum_not_met',
        format('%s%% of the snapshot reported; the quorum is %s%%.', round(v_rate * 100), v_m.quorum_pct),
        v_yes, v_responders, v_rate);
      return jsonb_build_object('market_id', p_market_id, 'status', 'voided', 'response_rate', v_rate);
    end if;
    v_den := v_responders;
  else
    v_den := v_n;
  end if;

  v_outcome := case when v_yes * 100 >= v_threshold * v_den
                      then 'yes'::public.trade_side else 'no'::public.trade_side end;

  update public.markets set status = 'resolved', outcome = v_outcome where id = p_market_id;

  insert into public.market_resolutions
    (market_id, numerator, denominator, response_rate, method, resolved_by, resolved_at)
  values (p_market_id, v_yes, v_den, v_rate, v_m.nonresponse_rule::text, auth.uid(), v_now);

  insert into public.ledger_entries (user_id, amount, kind, market_id, memo, created_at)
  select p.user_id, w.shares, 'payout', p_market_id, 'Market resolved ' || upper(v_outcome::text), v_now
    from public.positions p
    cross join lateral (
      select private.floor6(case when v_outcome = 'yes' then p.yes_shares else p.no_shares end) as shares
    ) w
   where p.market_id = p_market_id and w.shares > 0
   order by p.user_id;

  update public.positions p
     set realized_pnl = p.realized_pnl
                        + private.floor6(case when v_outcome = 'yes' then p.yes_shares else p.no_shares end)
                        - (p.yes_cost_basis + p.no_cost_basis),
         settled_at = v_now
   where p.market_id = p_market_id;

  return jsonb_build_object(
    'market_id', p_market_id,
    'status', 'resolved',
    'outcome', v_outcome,
    'resolved_pct_rounded', case when v_den > 0 then round(v_yes * 100.0 / v_den / 5) * 5 end,
    'response_rate', v_rate);
end
$$;

-- Closes markets past their close time, then resolves every market past its resolve time.
create function public.admin_resolve_due_markets()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed int;
  v_id bigint;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  perform private.assert_admin();

  update public.markets set status = 'closed'
   where status = 'open' and closes_at <= public.app_now();
  get diagnostics v_closed = row_count;

  for v_id in
    select m.id from public.markets m
     where m.status in ('open', 'closed') and m.resolves_at <= public.app_now()
     order by m.resolves_at, m.id
  loop
    v_result := public.resolve_market(v_id);
    v_results := v_results || v_result;
  end loop;

  return jsonb_build_object('closed', v_closed, 'settled', v_results);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Reporting outcomes
-- ---------------------------------------------------------------------------------------------

create function public.submit_outcome_report(
  p_status public.outcome_status, p_region text default null,
  p_field text default null, p_salary_band public.salary_band default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_id uuid;
begin
  if not exists (select 1 from public.student_profiles where user_id = v_uid) then
    raise exception 'not_a_student' using detail = 'Only verified students report outcomes.';
  end if;
  if p_status = 'employed' and p_region is null then
    raise exception 'invalid_report' using detail = 'Tell us where the job is located.';
  end if;
  if p_field is not null and not exists (select 1 from public.skill_tags where slug = p_field) then
    raise exception 'invalid_report' using detail = 'Unknown skill area.';
  end if;

  insert into public.outcome_reports (user_id, status, region, field_skill_tag_id, salary_band)
  values (
    v_uid, p_status, p_region,
    case when p_status = 'employed' then (select id from public.skill_tags where slug = p_field) end,
    case when p_status = 'employed' then p_salary_band end)
  returning id into v_id;
  return v_id;
end
$$;

-- Simulation: writes synthetic outcome reports for a market's snapshot members so that exactly
-- round(true_rate * responders) of them satisfy the market's rule. Reports are dated in the 90
-- days before the deadline (or before now, if the clock has not reached the deadline yet) and
-- marked synthetic. A newer report supersedes older ones, so running this again re-rolls them.
create function public.admin_generate_outcomes(
  p_market_id bigint, p_true_rate numeric, p_response_rate numeric default 0.9)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.markets%rowtype;
  v_metric public.market_metric;
  v_cohort_id bigint;
  v_cohort_tags bigint[];
  v_bands public.salary_band[] := enum_range(null::public.salary_band);
  v_param_band public.salary_band;
  v_field_id bigint;
  v_anchor timestamptz;
  v_members int;
  v_responders int;
  v_yes int;
begin
  perform private.assert_admin();
  if p_true_rate not between 0 and 1 or p_response_rate not between 0 and 1 then
    raise exception 'invalid_rate' using detail = 'Rates are between 0 and 1.';
  end if;

  select * into v_m from public.markets where id = p_market_id;
  if not found then
    raise exception 'market_not_found' using detail = 'No market with that id.';
  end if;
  select t.metric into v_metric from public.market_templates t where t.id = v_m.template_id;
  select s.cohort_id into v_cohort_id from public.cohort_snapshots s where s.id = v_m.snapshot_id;
  select array_agg(st.id) into v_cohort_tags
    from public.cohorts c
    cross join lateral jsonb_array_elements(c.definition -> 'skills') sk
    join public.skill_tags st on st.slug = sk ->> 'tag'
   where c.id = v_cohort_id;
  v_field_id := (select id from public.skill_tags where slug = v_m.params ->> 'field');
  v_param_band := (v_m.params ->> 'salary_band')::public.salary_band;
  v_anchor := least(public.app_now(), v_m.resolves_at - interval '1 hour');

  select count(*) into v_members from public.snapshot_members where snapshot_id = v_m.snapshot_id and user_id is not null;
  v_responders := round(v_members * p_response_rate);
  v_yes := round(v_responders * p_true_rate);

  with picked as (
    select sm.user_id, row_number() over (order by random()) as rn
      from public.snapshot_members sm
     where sm.snapshot_id = v_m.snapshot_id and sm.user_id is not null
  ),
  roles as (
    select user_id, rn <= v_yes as satisfies, random() as r1, random() as r2, random() as r3
      from picked where rn <= v_responders
  )
  insert into public.outcome_reports
    (user_id, reported_at, status, region, field_skill_tag_id, salary_band, synthetic)
  select
    x.user_id,
    v_anchor - (x.r3 * interval '90 days'),
    x.status,
    case when x.status = 'employed' then x.region end,
    case when x.status = 'employed' then x.field_id end,
    case when x.status = 'employed' then x.band end,
    true
  from (
    select r.user_id, r.r3,
      -- status
      case
        when v_metric = 'grad_school' then
          case when r.satisfies then 'grad_school' when r.r1 < 0.8 then 'employed' else 'searching' end
        when r.satisfies then 'employed'
        when r.r1 < 0.35 then 'searching'
        when v_metric = 'salary_at_least' and v_param_band = v_bands[1] then 'searching'
        else 'employed'
      end::public.outcome_status as status,
      -- region
      case
        when v_metric = 'employed_in_region' and r.satisfies then v_m.params ->> 'region'
        when v_metric = 'employed_in_region' then
          (select code from public.job_regions where code <> v_m.params ->> 'region' order by md5(code || r.user_id::text) limit 1)
        else (select code from public.job_regions order by md5(code || r.user_id::text) limit 1)
      end as region,
      -- field
      case
        when v_metric = 'employed_in_field' and r.satisfies then v_field_id
        when v_metric = 'employed_in_field' then
          (select id from public.skill_tags where id <> v_field_id order by md5(id::text || r.user_id::text) limit 1)
        else v_cohort_tags[1 + floor(r.r2 * coalesce(array_length(v_cohort_tags, 1), 1))::int]
      end as field_id,
      -- salary band
      case
        when v_metric = 'salary_at_least' and r.satisfies then
          v_bands[array_position(v_bands, v_param_band) + floor(r.r2 * (array_length(v_bands, 1) - array_position(v_bands, v_param_band) + 1))::int]
        when v_metric = 'salary_at_least' then
          v_bands[1 + floor(r.r2 * (array_position(v_bands, v_param_band) - 1))::int]
        else v_bands[2 + floor(r.r2 * 5)::int]
      end as band
    from roles r
  ) x;

  perform private.audit('generate_outcomes', 'markets', p_market_id::text,
    jsonb_build_object('true_rate', p_true_rate, 'response_rate', p_response_rate,
                       'reports', v_responders, 'satisfying', v_yes));

  return jsonb_build_object('market_id', p_market_id, 'reports', v_responders, 'satisfying', v_yes);
end
$$;
