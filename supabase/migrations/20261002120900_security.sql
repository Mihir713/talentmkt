-- Row-level security, grants, realtime, storage, and audit triggers.
--
-- Access model
--   public read : catalog tables, markets, price history, templates, live cohorts, public views
--   owner only  : profiles, accounts, ledger, trades, positions, watchlist, outcome reports,
--                 student profile, transcripts, memberships, snapshot membership
--   admin only  : proposals, resolutions, snapshots (raw counts), settings, audit log
-- No table has an INSERT/UPDATE/DELETE policy and anon/authenticated hold no DML grants:
-- every write goes through a security-definer RPC.

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end
$$;

-- Public reference data and market state
create policy "public read" on public.universities      for select to anon, authenticated using (true);
create policy "public read" on public.programs          for select to anon, authenticated using (true);
create policy "public read" on public.courses           for select to anon, authenticated using (true);
create policy "public read" on public.skill_tags        for select to anon, authenticated using (true);
create policy "public read" on public.course_skill_tags for select to anon, authenticated using (true);
create policy "public read" on public.job_regions       for select to anon, authenticated using (true);
create policy "public read" on public.market_templates  for select to anon, authenticated using (true);
create policy "public read" on public.markets           for select to anon, authenticated using (true);
create policy "public read" on public.price_points      for select to anon, authenticated using (true);

-- Proposed cohorts are invisible to everyone but admins.
create policy "live cohorts are public" on public.cohorts for select to anon, authenticated
  using (status <> 'proposed' or (select public.is_admin()));

-- Owner only
create policy "own row" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "own row" on public.accounts           for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.ledger_entries    for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.trades            for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.positions         for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.watchlist         for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.outcome_reports   for select to authenticated using (user_id = (select auth.uid()));
create policy "own row" on public.student_profiles   for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.transcript_uploads for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.transcript_courses for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows" on public.snapshot_members  for select to authenticated using (user_id = (select auth.uid()));
-- Members see their own memberships in live cohorts only. Nobody else, admins included.
create policy "own rows in live cohorts" on public.cohort_memberships for select to authenticated
  using (user_id = (select auth.uid())
         and exists (select 1 from public.cohorts c where c.id = cohort_id and c.status <> 'proposed'));

-- Admin only
create policy "admins" on public.market_proposals   for select to authenticated using ((select public.is_admin()));
create policy "admins" on public.market_resolutions for select to authenticated using ((select public.is_admin()));
create policy "admins" on public.cohort_snapshots   for select to authenticated using ((select public.is_admin()));
create policy "admins" on public.app_settings       for select to authenticated using ((select public.is_admin()));
create policy "admins" on public.audit_log          for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

-- Belt and braces on top of the default-privilege change in the foundation migration.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public;

revoke select on public.v_portfolio from anon;
grant select on public.mv_skill_signal to anon, authenticated;

grant execute on function
  public.app_now(),
  public.is_admin(),
  public.lmsr_cost(double precision, double precision, double precision),
  public.lmsr_price(double precision, double precision, double precision),
  public.lmsr_shares_for_cost(double precision, double precision, double precision, double precision),
  public.quote_trade(bigint, public.trade_side, public.trade_action, numeric, numeric),
  public.can_trade(bigint),
  public.market_sparklines(bigint[], int, int),
  public.search_catalog(text, int),
  public.search_courses(bigint, text, int),
  public.landing_stats()
to anon, authenticated;

grant execute on function
  public.execute_trade(bigint, public.trade_side, public.trade_action, numeric, numeric, numeric),
  public.toggle_watchlist(bigint),
  public.give_student_consent(),
  public.begin_transcript_upload(text),
  public.confirm_transcript(uuid, bigint, int, jsonb),
  public.mark_transcript_file_deleted(uuid),
  public.my_skill_profile(),
  public.submit_outcome_report(public.outcome_status, text, text, public.salary_band),
  public.delete_my_data(),
  public.delete_my_account(),
  -- admin functions: callable by any signed-in user, each rejects non-admins itself
  public.compute_memberships(bigint),
  public.freeze_snapshot(bigint),
  public.resolve_market(bigint),
  public.void_market(bigint, text),
  public.admin_resolve_due_markets(),
  public.admin_generate_outcomes(bigint, numeric, numeric),
  public.admin_refresh_skill_signal(),
  public.admin_set_sim_now(timestamptz),
  public.propose_cohort(text, text, jsonb, text, text, text),
  public.admin_review_cohort(bigint, boolean),
  public.propose_market(bigint, public.market_metric, jsonb, text, text, text),
  public.admin_review_market_proposal(bigint, boolean, numeric, public.nonresponse_rule, int),
  public.admin_cohort_overview(),
  public.admin_skill_cooccurrence(numeric)
to authenticated;

-- record_transcript_parse is for the Edge Function's service role only (it also checks).
revoke execute on function public.record_transcript_parse(uuid, public.upload_status, jsonb, text, text, text)
  from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------------------------
-- postgres_changes respects RLS per subscriber: everyone gets market and price updates, each
-- user gets only their own trades, positions and balance. Other people's trades reach the tape
-- through private.broadcast_trade (topic market:<id>), which carries no user id.
alter publication supabase_realtime
  add table public.markets, public.price_points, public.trades, public.positions, public.accounts;

-- ---------------------------------------------------------------------------------------------
-- Storage: private transcripts bucket, one folder per user
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transcripts', 'transcripts', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "transcripts: students upload to their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'transcripts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.student_profiles sp where sp.user_id = (select auth.uid())));

create policy "transcripts: owners read their own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'transcripts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "transcripts: owners delete their own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'transcripts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------
-- Audit: every admin-managed table writes to audit_log
-- ---------------------------------------------------------------------------------------------

create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function private.audit_row('key');
create trigger audit_cohorts after insert or update or delete on public.cohorts
  for each row execute function private.audit_row('id');
create trigger audit_cohort_snapshots after insert on public.cohort_snapshots
  for each row execute function private.audit_row('id');
create trigger audit_market_proposals after insert or update or delete on public.market_proposals
  for each row execute function private.audit_row('id');
create trigger audit_markets_insert after insert on public.markets
  for each row execute function private.audit_row('id');
-- Not q_yes/q_no: those change on every trade and are not admin actions.
create trigger audit_markets_update after update of status, outcome, b, closes_at, resolves_at on public.markets
  for each row execute function private.audit_row('id');
create trigger audit_market_resolutions after insert on public.market_resolutions
  for each row execute function private.audit_row('market_id');
create trigger audit_market_templates after insert or update or delete on public.market_templates
  for each row execute function private.audit_row('id');
create trigger audit_skill_tags after insert or update or delete on public.skill_tags
  for each row execute function private.audit_row('id');
create trigger audit_profile_roles after update of role on public.profiles
  for each row execute function private.audit_row('user_id');
