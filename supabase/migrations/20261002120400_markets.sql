-- Markets, LMSR pricing, trading, positions and price history.
--
-- Money rules
--   * Credits and shares are numeric(18,6). LMSR math runs in double precision and is converted
--     back through 15 significant digits (float8 -> numeric), which drops float noise before rounding.
--   * Costs round UP to the micro-credit and payouts/proceeds round DOWN (house favour).
--   * The fee (fee_bps, default 1%) is charged on top of buy cost and deducted from sell proceeds,
--     and is always its own ledger entry.

-- ---------------------------------------------------------------------------------------------
-- Templates and proposals
-- ---------------------------------------------------------------------------------------------

-- param_schema is a small, closed vocabulary (not JSON Schema): every listed key is required and
-- no others are allowed. Types: integer (minimum/maximum/multipleOf), date (minimum/maximum),
-- skill_tag, job_region (optional "enum"), salary_band (optional "enum").
create table public.market_templates (
  id               bigint generated always as identity primary key,
  metric           public.market_metric not null unique,
  question_pattern text not null,
  rule_pattern     text not null,
  param_schema     jsonb not null
);

insert into public.market_templates (metric, question_pattern, rule_pattern, param_schema) values
(
  'employed_in_field',
  'Will ≥{threshold_pct}% of this cohort be working in {field} by {deadline}?',
  'Resolves YES if at least {threshold_pct}% of the people in this market’s frozen cohort snapshot are employed in a role whose main skill area is {field}, going by each person’s latest outcome report on or before {deadline}. Otherwise it resolves NO.',
  '{"threshold_pct": {"type": "integer", "minimum": 10, "maximum": 90, "multipleOf": 5},
    "field":         {"type": "skill_tag"},
    "deadline":      {"type": "date", "minimum": "2026-01-01", "maximum": "2029-12-31"}}'
),
(
  'employed_in_region',
  'Will ≥{threshold_pct}% of this cohort be employed {region} by {deadline}?',
  'Resolves YES if at least {threshold_pct}% of the people in this market’s frozen cohort snapshot are employed in a job located {region}, going by each person’s latest outcome report on or before {deadline}. Otherwise it resolves NO.',
  '{"threshold_pct": {"type": "integer", "minimum": 10, "maximum": 90, "multipleOf": 5},
    "region":        {"type": "job_region", "enum": ["sf-bay-area", "seattle", "nyc", "boston", "toronto", "waterloo", "ottawa", "montreal", "vancouver", "calgary", "remote"]},
    "deadline":      {"type": "date", "minimum": "2026-01-01", "maximum": "2029-12-31"}}'
),
(
  'salary_at_least',
  'Will ≥{threshold_pct}% of this cohort report a base salary of at least {salary_band} by {deadline}?',
  'Resolves YES if at least {threshold_pct}% of the people in this market’s frozen cohort snapshot are employed with an annual base salary of at least {salary_band} (CAD), going by each person’s latest outcome report on or before {deadline}. Otherwise it resolves NO.',
  '{"threshold_pct": {"type": "integer", "minimum": 10, "maximum": 90, "multipleOf": 5},
    "salary_band":   {"type": "salary_band", "enum": ["50k_75k", "75k_100k", "100k_125k", "125k_150k", "150k_200k", "200k_plus"]},
    "deadline":      {"type": "date", "minimum": "2026-01-01", "maximum": "2029-12-31"}}'
),
(
  'grad_school',
  'Will ≥{threshold_pct}% of this cohort be enrolled in graduate school by {deadline}?',
  'Resolves YES if at least {threshold_pct}% of the people in this market’s frozen cohort snapshot are enrolled in graduate school, going by each person’s latest outcome report on or before {deadline}. Otherwise it resolves NO.',
  '{"threshold_pct": {"type": "integer", "minimum": 5, "maximum": 90, "multipleOf": 5},
    "deadline":      {"type": "date", "minimum": "2026-01-01", "maximum": "2029-12-31"}}'
);

create function private.validate_market_params(p_template_id bigint, p_params jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_schema jsonb;
  v_key text;
  v_spec jsonb;
  v_val jsonb;
  v_num numeric;
  v_date date;
begin
  select t.param_schema into v_schema from public.market_templates t where t.id = p_template_id;
  if v_schema is null then
    raise exception 'invalid_params' using detail = 'Unknown market template.';
  end if;
  if jsonb_typeof(p_params) is distinct from 'object' then
    raise exception 'invalid_params' using detail = 'params must be a JSON object.';
  end if;
  for v_key in select jsonb_object_keys(p_params) loop
    if not v_schema ? v_key then
      raise exception 'invalid_params' using detail = format('Unexpected parameter "%s".', v_key);
    end if;
  end loop;

  for v_key, v_spec in select key, value from jsonb_each(v_schema) loop
    v_val := p_params -> v_key;
    if v_val is null then
      raise exception 'invalid_params' using detail = format('Missing parameter "%s".', v_key);
    end if;
    case v_spec ->> 'type'
      when 'integer' then
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'invalid_params' using detail = format('"%s" must be a number.', v_key);
        end if;
        v_num := (v_val #>> '{}')::numeric;
        if v_num <> trunc(v_num)
           or v_num < (v_spec ->> 'minimum')::numeric or v_num > (v_spec ->> 'maximum')::numeric
           or (v_spec ? 'multipleOf' and mod(v_num, (v_spec ->> 'multipleOf')::numeric) <> 0) then
          raise exception 'invalid_params' using detail = format('"%s" is out of range.', v_key);
        end if;
      when 'date' then
        begin
          v_date := (v_val #>> '{}')::date;
        exception when others then
          raise exception 'invalid_params' using detail = format('"%s" must be a date (YYYY-MM-DD).', v_key);
        end;
        if v_date < (v_spec ->> 'minimum')::date or v_date > (v_spec ->> 'maximum')::date then
          raise exception 'invalid_params' using detail = format('"%s" is out of range.', v_key);
        end if;
      when 'skill_tag' then
        if not exists (select 1 from public.skill_tags where slug = v_val #>> '{}') then
          raise exception 'invalid_params' using detail = format('"%s" must be a known skill tag.', v_key);
        end if;
      when 'job_region' then
        if not exists (select 1 from public.job_regions where code = v_val #>> '{}')
           or (v_spec ? 'enum' and not (v_spec -> 'enum') ? (v_val #>> '{}')) then
          raise exception 'invalid_params' using detail = format('"%s" must be a supported region.', v_key);
        end if;
      when 'salary_band' then
        if (v_val #>> '{}') not in (select unnest(enum_range(null::public.salary_band))::text)
           or (v_spec ? 'enum' and not (v_spec -> 'enum') ? (v_val #>> '{}')) then
          raise exception 'invalid_params' using detail = format('"%s" must be a supported salary band.', v_key);
        end if;
      else
        raise exception 'invalid_params' using detail = format('Template declares unknown type for "%s".', v_key);
    end case;
  end loop;
end
$$;

-- Human-readable value for one template parameter.
create function private.param_label(p_key text, p_value jsonb)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_key
    when 'threshold_pct' then p_value #>> '{}'
    when 'deadline'      then to_char((p_value #>> '{}')::date, 'FMMon FMDD, YYYY')
    when 'field'         then (select case when substr(st.label, 2, 1) ~ '[a-z]'
                                           then lower(left(st.label, 1)) || substr(st.label, 2)
                                           else st.label end
                                 from public.skill_tags st where st.slug = p_value #>> '{}')
    when 'region'        then (select r.phrase from public.job_regions r where r.code = p_value #>> '{}')
    when 'salary_band'   then case p_value #>> '{}'
                                when '50k_75k'   then '$50k'
                                when '75k_100k'  then '$75k'
                                when '100k_125k' then '$100k'
                                when '125k_150k' then '$125k'
                                when '150k_200k' then '$150k'
                                when '200k_plus' then '$200k'
                              end
    else p_value #>> '{}'
  end
$$;

create function private.render_template(p_pattern text, p_params jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out text := p_pattern;
  v_key text;
  v_val jsonb;
begin
  for v_key, v_val in select key, value from jsonb_each(p_params) loop
    v_out := replace(v_out, '{' || v_key || '}', private.param_label(v_key, v_val));
  end loop;
  if v_out ~ '\{[a-z_]+\}' then
    raise exception 'template has unfilled placeholders: %', v_out;
  end if;
  return v_out;
end
$$;

create table public.market_proposals (
  id             bigint generated always as identity primary key,
  cohort_id      bigint not null references public.cohorts (id),
  template_id    bigint not null references public.market_templates (id),
  params         jsonb not null,
  rationale      text not null check (length(rationale) between 1 and 500),
  proposed_by    public.proposer not null,
  model          text,
  prompt_version text,
  status         public.proposal_status not null default 'pending',
  reviewed_by    uuid references public.profiles (user_id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  check ((proposed_by = 'ai') = (model is not null and prompt_version is not null)),
  check ((status = 'pending') = (reviewed_at is null))
);

create index market_proposals_status_idx on public.market_proposals (status, created_at);

create function private.guard_market_proposal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.params is distinct from old.params or new.template_id <> old.template_id then
    perform private.validate_market_params(new.template_id, new.params);
  end if;
  if tg_op = 'UPDATE' and old.status <> 'pending' then
    raise exception 'proposal_reviewed' using detail = 'This proposal has already been reviewed.';
  end if;
  return new;
end
$$;

create trigger market_proposals_guard
  before insert or update on public.market_proposals
  for each row execute function private.guard_market_proposal();

-- ---------------------------------------------------------------------------------------------
-- Markets
-- ---------------------------------------------------------------------------------------------

-- DENORMALIZATION (2 of 2): q_yes / q_no equal the total YES / NO shares outstanding, i.e.
-- sum(positions.yes_shares) and sum(positions.no_shares) for the market. They are stored so
-- execute_trade can price a trade from the one row it locks (SELECT ... FOR UPDATE) instead of
-- aggregating positions under lock. Only execute_trade writes them; private.guard_market rejects
-- any other change.
--
-- question and resolution_rule are the rendered contract text, frozen at creation so a later
-- template edit can never change what an open market means.
create table public.markets (
  id               bigint generated always as identity primary key,
  snapshot_id      bigint not null references public.cohort_snapshots (id),
  template_id      bigint not null references public.market_templates (id),
  proposal_id      bigint unique references public.market_proposals (id),
  question         text not null,
  params           jsonb not null,
  resolution_rule  text not null,
  nonresponse_rule public.nonresponse_rule not null default 'count_as_no',
  quorum_pct       int check (quorum_pct between 1 and 100),
  opens_at         timestamptz not null default public.app_now(),
  closes_at        timestamptz not null,
  resolves_at      timestamptz not null,
  status           public.market_status not null default 'open',
  b                numeric(18, 6) not null default 150 check (b >= 10 and b <= 100000),
  q_yes            numeric(18, 6) not null default 0 check (q_yes >= 0),
  q_no             numeric(18, 6) not null default 0 check (q_no >= 0),
  fee_bps          int not null default 100 check (fee_bps between 0 and 1000),
  outcome          public.trade_side,
  created_at       timestamptz not null default now(),
  check (opens_at < closes_at and closes_at <= resolves_at),
  check ((nonresponse_rule = 'exclude_with_quorum') = (quorum_pct is not null)),
  check ((status = 'resolved') = (outcome is not null))
);

create index markets_status_closes_at_idx on public.markets (status, closes_at);
create index markets_snapshot_id_idx on public.markets (snapshot_id);
create index markets_question_trgm_idx on public.markets using gin (question extensions.gin_trgm_ops);

create function private.guard_market()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.q_yes, new.q_no) is distinct from (old.q_yes, old.q_no)
     and coalesce(current_setting('talentmkt.trade_write', true), '') <> 'on' then
    raise exception 'markets.q_yes/q_no are maintained by execute_trade only';
  end if;
  if (new.snapshot_id, new.template_id, new.question, new.params, new.resolution_rule,
      new.nonresponse_rule, new.quorum_pct, new.opens_at, new.fee_bps)
     is distinct from
     (old.snapshot_id, old.template_id, old.question, old.params, old.resolution_rule,
      old.nonresponse_rule, old.quorum_pct, old.opens_at, old.fee_bps) then
    raise exception 'market_terms_frozen' using detail = 'A market''s terms cannot change after it opens.';
  end if;
  if new.b <> old.b and exists (select 1 from public.trades t where t.market_id = old.id) then
    raise exception 'market_terms_frozen' using detail = 'Liquidity (b) can only change before the first trade.';
  end if;
  if old.status in ('resolved', 'voided') and new.status <> old.status then
    raise exception 'market_settled' using detail = 'This market is already settled.';
  end if;
  return new;
end
$$;

create trigger markets_guard
  before update on public.markets
  for each row execute function private.guard_market();

create trigger markets_no_delete
  before delete on public.markets
  for each row execute function private.reject_mutation();

create table public.trades (
  id           bigint generated always as identity primary key,
  market_id    bigint not null references public.markets (id),
  user_id      uuid not null references public.profiles (user_id),
  side         public.trade_side not null,
  action       public.trade_action not null,
  shares       numeric(18, 6) not null check (shares > 0),
  cost         numeric(18, 6) not null check (cost >= 0),   -- credits paid (buy) or received (sell), before fee
  fee          numeric(18, 6) not null check (fee >= 0),
  price_before double precision not null check (price_before between 0 and 1),   -- P(YES)
  price_after  double precision not null check (price_after between 0 and 1),
  created_at   timestamptz not null default public.app_now()
);

create index trades_market_id_created_at_idx on public.trades (market_id, created_at desc);
create index trades_user_id_created_at_idx on public.trades (user_id, created_at desc);

create trigger trades_append_only
  before update or delete on public.trades
  for each row execute function private.reject_mutation();

alter table public.ledger_entries
  add constraint ledger_entries_trade_id_fkey foreign key (trade_id) references public.trades (id),
  add constraint ledger_entries_market_id_fkey foreign key (market_id) references public.markets (id);

-- Per-side average-cost basis: buying adds what was paid (cost + fee); selling removes the
-- sold fraction of the basis and books the difference to realized_pnl. Voiding refunds the
-- remaining basis. settled_at marks positions closed out by resolution or voiding.
create table public.positions (
  user_id        uuid not null references public.profiles (user_id),
  market_id      bigint not null references public.markets (id),
  yes_shares     numeric(18, 6) not null default 0 check (yes_shares >= 0),
  no_shares      numeric(18, 6) not null default 0 check (no_shares >= 0),
  yes_cost_basis numeric(18, 6) not null default 0 check (yes_cost_basis >= 0),
  no_cost_basis  numeric(18, 6) not null default 0 check (no_cost_basis >= 0),
  realized_pnl   numeric(18, 6) not null default 0,
  settled_at     timestamptz,
  updated_at     timestamptz not null default public.app_now(),
  primary key (user_id, market_id)
);

create index positions_market_id_idx on public.positions (market_id);

-- One row per trade plus the opening price. This is the public, user-free price history that
-- charts and realtime price ticks read; trades itself stays owner-only.
create table public.price_points (
  id        bigint generated always as identity primary key,
  market_id bigint not null references public.markets (id),
  trade_id  bigint unique references public.trades (id),   -- null for the opening point
  ts        timestamptz not null default public.app_now(),
  p_yes     double precision not null check (p_yes between 0 and 1)
);

create index price_points_market_id_ts_idx on public.price_points (market_id, ts);

create trigger price_points_append_only
  before update or delete on public.price_points
  for each row execute function private.reject_mutation();

create table public.watchlist (
  user_id    uuid not null references public.profiles (user_id),
  market_id  bigint not null references public.markets (id),
  created_at timestamptz not null default now(),
  primary key (user_id, market_id)
);

-- ---------------------------------------------------------------------------------------------
-- LMSR
-- ---------------------------------------------------------------------------------------------
-- Postgres raises on exp() overflow/underflow instead of returning inf/0, so every exponent is
-- clamped to [-700, 700]. src/lib/lmsr.ts mirrors these functions exactly.

-- C(qy, qn) = b · ln(e^(qy/b) + e^(qn/b)), as log-sum-exp: max + b · ln(1 + e^(−|qy−qn|/b)).
create function public.lmsr_cost(p_q_yes double precision, p_q_no double precision, p_b double precision)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select greatest(p_q_yes, p_q_no) + p_b * ln(1 + exp(greatest(-abs(p_q_yes - p_q_no) / p_b, -700)))
$$;

-- p_yes = e^(qy/b) / (e^(qy/b) + e^(qn/b)) = 1 / (1 + e^((qn−qy)/b)).
create function public.lmsr_price(p_q_yes double precision, p_q_no double precision, p_b double precision)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select 1 / (1 + exp(least(greatest((p_q_no - p_q_yes) / p_b, -700), 700)))
$$;

-- Shares of one side that a raw LMSR cost c buys, in closed form.
-- From q_side + Δ = b · ln(e^((C0+c)/b) − e^(q_other/b)), dividing through by e^(q_side/b):
--   Δ = c + b · softplus(r + ln(1 − e^(−c/b))),   r = (q_other − q_side) / b
-- which never exponentiates anything large. 1 − e^(−x) uses a series below 1e-4 to keep precision.
create function public.lmsr_shares_for_cost(
  p_q_side double precision, p_q_other double precision, p_b double precision, p_cost double precision)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case
    when p_cost <= 0 then 0::double precision
    else p_cost + p_b * (greatest(z, 0) + ln(1 + exp(greatest(-abs(z), -700))))
  end
  from (
    select (p_q_other - p_q_side) / p_b
           + ln(case when x < 1e-4 then x * (1 - x / 2 * (1 - x / 3)) else 1 - exp(-least(x, 700)) end) as z
      from (select p_cost / p_b as x) s
  ) t
$$;

create function private.ceil6(p numeric)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$ select (ceil(p * 1000000) / 1000000)::numeric(18, 6) $$;

create function private.floor6(p numeric)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$ select (floor(p * 1000000) / 1000000)::numeric(18, 6) $$;

-- Prices one trade of p_shares. amount is the cost of a buy (rounded up) or the proceeds of a sell
-- (rounded down), before fee. Every quote and every executed trade goes through this function.
create function private.price_trade(
  p_q_yes numeric, p_q_no numeric, p_b numeric, p_fee_bps int,
  p_side public.trade_side, p_action public.trade_action, p_shares numeric,
  out amount numeric, out fee numeric, out price_before double precision, out price_after double precision)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_d  numeric := case when p_action = 'buy' then p_shares else -p_shares end;
  v_qy double precision := p_q_yes;
  v_qn double precision := p_q_no;
  v_b  double precision := p_b;
  -- The new quantities are summed exactly in numeric, as execute_trade stores them, so a trade's
  -- price_after is bit-identical to the next trade's price_before.
  v_ny double precision := p_q_yes + case when p_side = 'yes' then v_d else 0 end;
  v_nn double precision := p_q_no + case when p_side = 'no' then v_d else 0 end;
  v_diff double precision := public.lmsr_cost(v_ny, v_nn, v_b) - public.lmsr_cost(v_qy, v_qn, v_b);
begin
  if p_action = 'buy' then
    amount := greatest(private.ceil6(v_diff::numeric), 0.000001);   -- a buy is never free
  else
    amount := greatest(private.floor6((-v_diff)::numeric), 0);
  end if;
  fee := private.ceil6(amount * p_fee_bps / 10000);
  price_before := public.lmsr_price(v_qy, v_qn, v_b);
  price_after  := public.lmsr_price(v_ny, v_nn, v_b);
end
$$;

-- Shares a buy of p_spend total credits (fee included) gets, floored to the micro-share.
-- Solves for slightly less than the spend: cost and fee each round up by at most 1 µcredit, so
-- holding back 3 µcredits guarantees cost + fee <= p_spend.
create function private.shares_for_spend(
  p_q_yes numeric, p_q_no numeric, p_b numeric, p_fee_bps int, p_side public.trade_side, p_spend numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select private.floor6(public.lmsr_shares_for_cost(
    case when p_side = 'yes' then p_q_yes else p_q_no end,
    case when p_side = 'yes' then p_q_no else p_q_yes end,
    p_b,
    ((p_spend - 0.000003) / (1 + p_fee_bps / 10000.0))::double precision)::numeric)
$$;

-- Read-only quote. Pass p_shares, or (buys only) p_spend: the most the caller wants to pay in
-- total, fee included. A spend quote's total never exceeds p_spend.
create function public.quote_trade(
  p_market_id bigint, p_side public.trade_side, p_action public.trade_action,
  p_shares numeric default null, p_spend numeric default null)
returns table (
  shares numeric, cost numeric, fee numeric, total numeric, avg_price double precision,
  price_before double precision, price_after double precision, max_payout numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.markets%rowtype;
  v_shares numeric;
  v_q record;
begin
  select * into v_m from public.markets m where m.id = p_market_id;
  if not found then
    raise exception 'market_not_found' using detail = 'No market with that id.';
  end if;

  if p_spend is not null then
    if p_action <> 'buy' then
      raise exception 'invalid_trade' using detail = 'Spend amounts only apply to buys.';
    end if;
    if p_spend <= 0 then
      raise exception 'invalid_trade' using detail = 'Enter a positive amount.';
    end if;
    v_shares := private.shares_for_spend(v_m.q_yes, v_m.q_no, v_m.b, v_m.fee_bps, p_side, p_spend);
  else
    v_shares := trunc(p_shares, 6);
  end if;
  if v_shares is null or v_shares <= 0 then
    raise exception 'invalid_trade' using detail = 'That amount is too small to buy any shares.';
  end if;

  select * into v_q from private.price_trade(v_m.q_yes, v_m.q_no, v_m.b, v_m.fee_bps, p_side, p_action, v_shares);

  shares := v_shares;
  cost := v_q.amount;
  fee := v_q.fee;
  total := case when p_action = 'buy' then v_q.amount + v_q.fee else v_q.amount - v_q.fee end;
  avg_price := (v_q.amount / v_shares)::double precision;
  price_before := v_q.price_before;
  price_after := v_q.price_after;
  max_payout := case when p_action = 'buy' then v_shares end;
  return next;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Insider rule
-- ---------------------------------------------------------------------------------------------

-- Someone is an insider on a market if they are in its frozen snapshot, or currently in the
-- snapshot's cohort (for example after confirming a transcript later).
create function private.is_insider(p_user_id uuid, p_market_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.markets m
             join public.snapshot_members sm on sm.snapshot_id = m.snapshot_id
            where m.id = p_market_id and sm.user_id = p_user_id)
      or exists (
           select 1 from public.markets m
             join public.cohort_snapshots s on s.id = m.snapshot_id
             join public.cohort_memberships cm on cm.cohort_id = s.cohort_id
            where m.id = p_market_id and cm.user_id = p_user_id)
$$;

create function private.enforce_insider_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_insider(new.user_id, new.market_id) then
    raise exception 'insider'
      using detail = 'You''re in this market''s cohort, so you can''t trade on it.';
  end if;
  return new;
end
$$;

create trigger trades_insider_rule
  before insert on public.trades
  for each row execute function private.enforce_insider_rule();

-- ---------------------------------------------------------------------------------------------
-- Trading
-- ---------------------------------------------------------------------------------------------

-- Executes one trade atomically: locks the market row, checks status, close time, insider rule,
-- balance or holdings, and the caller's slippage limit, then writes the trade, the position,
-- the ledger entries and the price point. Buys need p_max_cost (total incl. fee); sells need
-- p_min_return (proceeds after fee). Errors use the message as a stable code and the detail as
-- copy the UI can show.
create function public.execute_trade(
  p_market_id bigint, p_side public.trade_side, p_action public.trade_action, p_shares numeric,
  p_max_cost numeric default null, p_min_return numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_now timestamptz := public.app_now();
  v_shares numeric(18, 6) := trunc(p_shares, 6);
  v_m public.markets%rowtype;
  v_pos public.positions%rowtype;
  v_q record;
  v_total numeric;
  v_net numeric;
  v_balance numeric;
  v_held numeric;
  v_basis numeric;
  v_removed numeric;
  v_trade_id bigint;
  v_yes boolean := p_side = 'yes';
  v_sign int := case when p_action = 'buy' then 1 else -1 end;
begin
  if p_side is null or p_action is null or v_shares is null or v_shares <= 0 then
    raise exception 'invalid_trade' using detail = 'Choose a side and a positive number of shares.';
  end if;
  if v_shares > 10000000 then
    raise exception 'invalid_trade' using detail = 'That trade is too large.';
  end if;
  if p_action = 'buy' and p_max_cost is null then
    raise exception 'invalid_trade' using detail = 'Buys need a maximum cost.';
  end if;
  if p_action = 'sell' and p_min_return is null then
    raise exception 'invalid_trade' using detail = 'Sells need a minimum return.';
  end if;

  select * into v_m from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found' using detail = 'No market with that id.';
  end if;
  if v_m.status <> 'open' or v_now >= v_m.closes_at then
    raise exception 'market_closed' using detail = 'Trading on this market has closed.';
  end if;
  if v_now < v_m.opens_at then
    raise exception 'market_not_open' using detail = 'This market hasn''t opened yet.';
  end if;
  if private.is_insider(v_uid, p_market_id) then
    raise exception 'insider' using detail = 'You''re in this market''s cohort, so you can''t trade on it.';
  end if;

  select * into v_pos from public.positions where user_id = v_uid and market_id = p_market_id for update;

  select * into v_q
    from private.price_trade(v_m.q_yes, v_m.q_no, v_m.b, v_m.fee_bps, p_side, p_action, v_shares);

  if p_action = 'buy' then
    v_total := v_q.amount + v_q.fee;
    if v_total > p_max_cost then
      raise exception 'price_moved'
        using detail = format('The price moved. This trade now costs %s credits, above your limit of %s.',
                              to_char(v_total, 'FM999G999G990D00'), to_char(p_max_cost, 'FM999G999G990D00'));
    end if;
    select balance into v_balance from public.accounts where user_id = v_uid for update;
    if v_balance < v_total then
      raise exception 'insufficient_balance'
        using detail = format('This trade costs %s credits and you have %s.',
                              to_char(v_total, 'FM999G999G990D00'), to_char(v_balance, 'FM999G999G990D00'));
    end if;
  else
    v_held := coalesce(case when v_yes then v_pos.yes_shares else v_pos.no_shares end, 0);
    if v_held < v_shares then
      raise exception 'insufficient_shares'
        using detail = format('You hold %s %s shares.', to_char(v_held, 'FM999G999G990D00'), upper(p_side::text));
    end if;
    v_net := v_q.amount - v_q.fee;
    if v_net < p_min_return then
      raise exception 'price_moved'
        using detail = format('The price moved. This sale now returns %s credits, below your limit of %s.',
                              to_char(v_net, 'FM999G999G990D00'), to_char(p_min_return, 'FM999G999G990D00'));
    end if;
  end if;

  perform set_config('talentmkt.trade_write', 'on', true);
  update public.markets
     set q_yes = q_yes + case when v_yes then v_sign * v_shares else 0 end,
         q_no  = q_no  + case when v_yes then 0 else v_sign * v_shares end
   where id = p_market_id;
  perform set_config('talentmkt.trade_write', '', true);

  insert into public.trades (market_id, user_id, side, action, shares, cost, fee, price_before, price_after, created_at)
  values (p_market_id, v_uid, p_side, p_action, v_shares, v_q.amount, v_q.fee, v_q.price_before, v_q.price_after, v_now)
  returning id into v_trade_id;

  if p_action = 'buy' then
    insert into public.positions as p (user_id, market_id, yes_shares, no_shares, yes_cost_basis, no_cost_basis, updated_at)
    values (v_uid, p_market_id,
            case when v_yes then v_shares else 0 end, case when v_yes then 0 else v_shares end,
            case when v_yes then v_total else 0 end,  case when v_yes then 0 else v_total end,
            v_now)
    on conflict (user_id, market_id) do update
       set yes_shares     = p.yes_shares + excluded.yes_shares,
           no_shares      = p.no_shares + excluded.no_shares,
           yes_cost_basis = p.yes_cost_basis + excluded.yes_cost_basis,
           no_cost_basis  = p.no_cost_basis + excluded.no_cost_basis,
           updated_at     = excluded.updated_at;

    insert into public.ledger_entries (user_id, amount, kind, trade_id, market_id, created_at)
    values (v_uid, -v_q.amount, 'trade', v_trade_id, p_market_id, v_now);
  else
    v_basis := case when v_yes then v_pos.yes_cost_basis else v_pos.no_cost_basis end;
    v_removed := case when v_shares = v_held then v_basis else round(v_basis * v_shares / v_held, 6) end;
    update public.positions
       set yes_shares     = yes_shares - case when v_yes then v_shares else 0 end,
           no_shares      = no_shares - case when v_yes then 0 else v_shares end,
           yes_cost_basis = yes_cost_basis - case when v_yes then v_removed else 0 end,
           no_cost_basis  = no_cost_basis - case when v_yes then 0 else v_removed end,
           realized_pnl   = realized_pnl + v_net - v_removed,
           updated_at     = v_now
     where user_id = v_uid and market_id = p_market_id;

    if v_q.amount > 0 then
      insert into public.ledger_entries (user_id, amount, kind, trade_id, market_id, created_at)
      values (v_uid, v_q.amount, 'trade', v_trade_id, p_market_id, v_now);
    end if;
  end if;

  if v_q.fee > 0 then
    insert into public.ledger_entries (user_id, amount, kind, trade_id, market_id, created_at)
    values (v_uid, -v_q.fee, 'fee', v_trade_id, p_market_id, v_now);
  end if;

  insert into public.price_points (market_id, trade_id, ts, p_yes)
  values (p_market_id, v_trade_id, v_now, v_q.price_after);

  select balance into v_balance from public.accounts where user_id = v_uid;

  return jsonb_build_object(
    'trade_id', v_trade_id,
    'market_id', p_market_id,
    'side', p_side,
    'action', p_action,
    'shares', v_shares,
    'cost', v_q.amount,
    'fee', v_q.fee,
    'total', case when p_action = 'buy' then v_q.amount + v_q.fee else v_q.amount - v_q.fee end,
    'price_before', v_q.price_before,
    'price_after', v_q.price_after,
    'balance', v_balance,
    'created_at', v_now);
end
$$;

-- Lets the trade ticket show the right state before the user tries: insider, closed, signed out.
create function public.can_trade(p_market_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.markets%rowtype;
begin
  select * into v_m from public.markets where id = p_market_id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'market_not_found');
  end if;
  if v_m.status <> 'open' or public.app_now() >= v_m.closes_at then
    return jsonb_build_object('allowed', false, 'reason', 'market_closed');
  end if;
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;
  if exists (select 1 from public.profiles where user_id = v_uid and deleted_at is not null) then
    return jsonb_build_object('allowed', false, 'reason', 'account_deleted');
  end if;
  if private.is_insider(v_uid, p_market_id) then
    return jsonb_build_object('allowed', false, 'reason', 'insider');
  end if;
  return jsonb_build_object('allowed', true, 'reason', null);
end
$$;

-- Public trade tape over Realtime Broadcast. trades is owner-only under RLS, so postgres_changes
-- cannot carry other people's trades. This sends the same columns as v_public_trades (no user id)
-- to the topic market:<id>.
create function private.broadcast_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id, 'market_id', new.market_id, 'side', new.side, 'action', new.action,
      'shares', new.shares, 'cost', new.cost, 'fee', new.fee,
      'price_before', new.price_before, 'price_after', new.price_after, 'created_at', new.created_at),
    'trade',
    'market:' || new.market_id,
    false);
  return null;
end
$$;

create trigger trades_broadcast
  after insert on public.trades
  for each row execute function private.broadcast_trade();

-- ---------------------------------------------------------------------------------------------
-- Market creation (used by proposal approval)
-- ---------------------------------------------------------------------------------------------

-- Deadline D means "on or before D, Toronto time": trading closes at the start of D and the
-- outcome is read as of the end of D.
create function private.create_market(
  p_snapshot_id bigint, p_template_id bigint, p_params jsonb, p_b numeric,
  p_nonresponse_rule public.nonresponse_rule, p_quorum_pct int, p_proposal_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.market_templates%rowtype;
  v_deadline date;
  v_closes timestamptz;
  v_resolves timestamptz;
  v_rule text;
  v_market_id bigint;
begin
  perform private.validate_market_params(p_template_id, p_params);
  select * into v_t from public.market_templates where id = p_template_id;

  v_deadline := (p_params ->> 'deadline')::date;
  v_closes := v_deadline::timestamp at time zone 'America/Toronto';
  v_resolves := (v_deadline + 1)::timestamp at time zone 'America/Toronto';
  if v_closes <= public.app_now() then
    raise exception 'deadline_passed' using detail = 'The deadline must be in the future.';
  end if;

  v_rule := private.render_template(v_t.rule_pattern, p_params)
    || ' ' || case p_nonresponse_rule
         when 'count_as_no' then
           'People with no report by the deadline count as NO.'
         else format(
           'People with no report by the deadline are left out of the count, as long as at least %s%% of the snapshot has reported. Below that, the market is voided and every position is refunded at cost.',
           p_quorum_pct)
       end
    || ' Data source: outcome reports that cohort members submit on talentmkt, self-reported unless marked verified.';

  insert into public.markets (
    snapshot_id, template_id, proposal_id, question, params, resolution_rule,
    nonresponse_rule, quorum_pct, closes_at, resolves_at, b)
  values (
    p_snapshot_id, p_template_id, p_proposal_id, private.render_template(v_t.question_pattern, p_params),
    p_params, v_rule, p_nonresponse_rule, p_quorum_pct, v_closes, v_resolves, coalesce(p_b, 150))
  returning id into v_market_id;

  insert into public.price_points (market_id, ts, p_yes)
  select v_market_id, m.opens_at, 0.5 from public.markets m where m.id = v_market_id;

  return v_market_id;
end
$$;
