-- Foundation: extensions, schemas, default privileges, enums, settings, the simulation clock,
-- and the audit log.
--
-- Conventions used by every later migration:
--   * Every function sets search_path = '' and schema-qualifies every name.
--   * public.*  holds tables, views and the functions clients may call (each granted explicitly).
--   * private.* holds internal helpers and trigger functions. Clients have no USAGE on it.
--   * Every time comparison goes through public.app_now(), never now().

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;

-- Deny by default. Supabase grants anon/authenticated full DML on new tables and EXECUTE on new
-- functions. Clients never write tables directly (all writes go through RPCs), and only functions
-- granted explicitly in the security migration are callable.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- Postgres grants EXECUTE on new functions to PUBLIC globally, and a per-schema default can only
-- add to the global one, so the PUBLIC grant has to be revoked globally.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke usage, update on sequences from anon, authenticated;

create type public.user_role as enum ('trader', 'student', 'admin');
create type public.upload_status as enum ('uploaded', 'parsing', 'needs_review', 'confirmed', 'failed');
create type public.grade_band as enum ('A', 'B', 'C', 'D', 'F', 'P', 'IP');
create type public.cohort_status as enum ('proposed', 'active', 'retired');
create type public.proposer as enum ('ai', 'admin');
create type public.market_metric as enum ('employed_in_field', 'employed_in_region', 'salary_at_least', 'grad_school');
create type public.proposal_status as enum ('pending', 'approved', 'rejected');
create type public.nonresponse_rule as enum ('count_as_no', 'exclude_with_quorum');
create type public.market_status as enum ('open', 'closed', 'resolved', 'voided');
-- Used for trade sides and for market outcomes, so "winning side = outcome" is a plain comparison.
create type public.trade_side as enum ('yes', 'no');
create type public.trade_action as enum ('buy', 'sell');
create type public.ledger_kind as enum ('signup_grant', 'trade', 'fee', 'payout', 'refund', 'admin_adjust');
create type public.outcome_status as enum ('employed', 'searching', 'grad_school', 'other');
-- Ordered: salary_band >= '100k_125k' means "at least $100k". Annual base salary, CAD.
create type public.salary_band as enum
  ('under_50k', '50k_75k', '75k_100k', '100k_125k', '125k_150k', '150k_200k', '200k_plus');
create type public.verification_level as enum ('self', 'verified');

-- ---------------------------------------------------------------------------------------------
-- Settings and the simulation clock
-- ---------------------------------------------------------------------------------------------

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- sim_now is a JSON timestamp string, or JSON null for real time.
insert into public.app_settings (key, value) values ('sim_now', 'null');

-- The application's notion of "now". Returns sim_now when an admin has set it, real time otherwise.
-- This is how 2028 resolutions are demoed today. Security definer because app_settings is
-- admin-only under RLS but every caller needs the clock.
create function public.app_now()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value #>> '{}')::timestamptz from public.app_settings s where s.key = 'sim_now'),
    now()
  )
$$;

-- True for direct database sessions (seed script, pgTAP, migrations) and for the service role
-- (Edge Functions). PostgREST always sets request.jwt.claims, so a session with no claims that
-- did not come through the authenticator role is a trusted backend connection.
create function private.is_trusted_backend()
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is null
      then session_user <> 'authenticator'
    else (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  end
$$;

-- ---------------------------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------------------------

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,                -- auth.uid() of the admin; null for trusted backend sessions
  actor_role text not null,       -- 'admin', 'service_role' or the database session user
  action     text not null,
  entity     text not null,
  entity_id  text,
  payload    jsonb not null default '{}'::jsonb,
  app_time   timestamptz not null default public.app_now(),
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

create function private.audit(p_action text, p_entity text, p_entity_id text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor, actor_role, action, entity, entity_id, payload)
  values (
    auth.uid(),
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      session_user::text
    ),
    p_action, p_entity, p_entity_id, coalesce(p_payload, '{}'::jsonb)
  )
$$;

-- Row trigger for admin-managed tables. TG_ARGV[0] names the primary-key column.
-- Updates record only the columns that changed. Payloads never include membership or
-- transcript data because those tables are not audited this way.
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_payload jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_build_object(
             'before', coalesce(jsonb_object_agg(n.key, v_old -> n.key), '{}'::jsonb),
             'after',  coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb))
      into v_payload
      from jsonb_each(v_new) n
     where v_old -> n.key is distinct from n.value;
    if v_payload -> 'after' = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_payload := jsonb_build_object('after', v_new);
  else
    v_payload := jsonb_build_object('before', v_old);
  end if;

  perform private.audit(
    lower(tg_op), tg_table_name, coalesce(v_new, v_old) ->> tg_argv[0], v_payload);
  return null;
end
$$;
