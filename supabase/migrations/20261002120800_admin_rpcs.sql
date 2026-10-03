-- Admin RPCs: the simulation clock, cohort and market proposal queues, and inputs for the
-- AI proposers. Every function starts with private.assert_admin(); table changes are audited by
-- the triggers attached in the security migration, bulk actions audit explicitly.

create function public.admin_set_sim_now(p_ts timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  update public.app_settings
     set value = coalesce(to_jsonb(p_ts), 'null'::jsonb), updated_at = now()
   where key = 'sim_now';
  return public.app_now();
end
$$;

-- Cohort proposals come from the propose-cohorts Edge Function (model + prompt_version set) or
-- from an admin. They stay invisible until approved.
create function public.propose_cohort(
  p_slug text, p_title text, p_definition jsonb, p_rationale text default null,
  p_model text default null, p_prompt_version text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform private.assert_admin();
  insert into public.cohorts (slug, title, definition, rationale, proposed_by, model, prompt_version)
  values (p_slug, p_title, p_definition, p_rationale,
          case when p_model is null then 'admin' else 'ai' end::public.proposer, p_model, p_prompt_version)
  returning id into v_id;
  return v_id;
end
$$;

-- Approve: compute memberships and go live (blocked below min_size). Reject: retire.
create function public.admin_review_cohort(p_cohort_id bigint, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.cohort_status;
  v_count int;
begin
  perform private.assert_admin();
  select status into v_status from public.cohorts where id = p_cohort_id for update;
  if not found then
    raise exception 'cohort_not_found' using detail = 'No cohort with that id.';
  end if;
  if v_status <> 'proposed' then
    raise exception 'cohort_reviewed' using detail = 'This cohort has already been reviewed.';
  end if;

  if not p_approve then
    update public.cohorts set status = 'retired' where id = p_cohort_id;
    return jsonb_build_object('cohort_id', p_cohort_id, 'status', 'retired');
  end if;

  v_count := private.compute_memberships(p_cohort_id);
  update public.cohorts
     set status = 'active', approved_by = auth.uid(), approved_at = now()
   where id = p_cohort_id;
  -- Give the new cohort its public skill profile right away instead of at the next cron tick.
  refresh materialized view concurrently private.mv_cohort_skill_mix;
  return jsonb_build_object('cohort_id', p_cohort_id, 'status', 'active', 'member_count', v_count);
end
$$;

create function public.propose_market(
  p_cohort_id bigint, p_metric public.market_metric, p_params jsonb, p_rationale text,
  p_model text default null, p_prompt_version text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform private.assert_admin();
  if not exists (select 1 from public.cohorts where id = p_cohort_id and status = 'active') then
    raise exception 'cohort_not_active' using detail = 'Markets can only be proposed on live cohorts.';
  end if;
  insert into public.market_proposals
    (cohort_id, template_id, params, rationale, proposed_by, model, prompt_version)
  select p_cohort_id, t.id, p_params, p_rationale,
         case when p_model is null then 'admin' else 'ai' end::public.proposer, p_model, p_prompt_version
    from public.market_templates t
   where t.metric = p_metric
  returning id into v_id;
  if v_id is null then
    raise exception 'invalid_params' using detail = 'Unknown market template.';
  end if;
  return v_id;
end
$$;

-- Approve: freeze the cohort's snapshot, then open the market. The question and resolution rule
-- are rendered from the template; nothing the model wrote becomes contract text.
create function public.admin_review_market_proposal(
  p_proposal_id bigint, p_approve boolean, p_b numeric default 150,
  p_nonresponse_rule public.nonresponse_rule default 'count_as_no', p_quorum_pct int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.market_proposals%rowtype;
  v_snapshot_id bigint;
  v_market_id bigint;
begin
  perform private.assert_admin();
  select * into v_p from public.market_proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal_not_found' using detail = 'No proposal with that id.';
  end if;
  if v_p.status <> 'pending' then
    raise exception 'proposal_reviewed' using detail = 'This proposal has already been reviewed.';
  end if;

  if not p_approve then
    update public.market_proposals
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_proposal_id;
    return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'rejected');
  end if;

  if exists (
    select 1 from public.markets m
      join public.cohort_snapshots s on s.id = m.snapshot_id
     where s.cohort_id = v_p.cohort_id and m.template_id = v_p.template_id
       and m.params = v_p.params and m.status in ('open', 'closed')) then
    raise exception 'duplicate_market' using detail = 'An identical market is already live on this cohort.';
  end if;

  v_snapshot_id := private.freeze_snapshot(v_p.cohort_id);
  v_market_id := private.create_market(
    v_snapshot_id, v_p.template_id, v_p.params, p_b, p_nonresponse_rule,
    case when p_nonresponse_rule = 'exclude_with_quorum' then coalesce(p_quorum_pct, 60) end,
    p_proposal_id);

  update public.market_proposals
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;

  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'approved', 'market_id', v_market_id);
end
$$;

-- Exact counts for the admin review queue. Only admins can call this; nobody else sees exact
-- cohort sizes.
create function public.admin_cohort_overview()
returns table (
  id bigint, slug text, title text, status public.cohort_status, definition jsonb,
  proposed_by public.proposer, rationale text, model text, member_count int, min_size int,
  open_markets int, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return query
  select c.id, c.slug, c.title, c.status, c.definition, c.proposed_by, c.rationale, c.model,
         case when c.status = 'proposed'
              then (select count(*) from private.cohort_member_ids(c.definition))::int
              else (select count(*) from public.cohort_memberships m where m.cohort_id = c.id)::int end,
         c.min_size,
         (select count(*) from public.markets mm join public.cohort_snapshots s on s.id = mm.snapshot_id
           where s.cohort_id = c.id and mm.status = 'open')::int,
         c.created_at
    from public.cohorts c
   order by c.status, c.created_at desc;
end
$$;

-- Input for propose-cohorts: aggregated counts only, never rows about a person. A student
-- "has" a skill when their weighted course count for it reaches p_min_weighted. Counts below 25
-- are suppressed.
create function public.admin_skill_cooccurrence(p_min_weighted numeric default 2)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin();
  with strong as (
    select tc.user_id, st.slug
      from public.transcript_courses tc
      join public.course_skill_tags cst on cst.course_id = tc.course_id
      join public.skill_tags st on st.id = cst.skill_tag_id
     where tc.grade_band is distinct from 'F'
     group by tc.user_id, st.slug
    having sum(cst.weight) >= p_min_weighted
  ),
  singles as (
    select slug, count(*) as students from strong group by slug having count(*) >= 25
  ),
  pairs as (
    select a.slug as a, b.slug as b, count(*) as students
      from strong a join strong b on a.user_id = b.user_id and a.slug < b.slug
     group by a.slug, b.slug
    having count(*) >= 25
  ),
  grad_years as (
    select sp.grad_year, count(*) as students
      from public.student_profiles sp where sp.grad_year is not null
     group by sp.grad_year having count(*) >= 25
  )
  select jsonb_build_object(
           'min_weighted_courses', p_min_weighted,
           'students_with_transcripts', (select count(distinct user_id) from public.transcript_courses),
           'skills', coalesce((select jsonb_agg(jsonb_build_object('tag', slug, 'students', students) order by students desc) from singles), '[]'),
           'pairs', coalesce((select jsonb_agg(jsonb_build_object('a', a, 'b', b, 'students', students) order by students desc) from pairs), '[]'),
           'grad_years', coalesce((select jsonb_agg(jsonb_build_object('year', grad_year, 'students', students) order by grad_year) from grad_years), '[]'),
           'regions', coalesce((select jsonb_agg(distinct u.region) from public.universities u), '[]'))
    into v_result;
  return v_result;
end
$$;
