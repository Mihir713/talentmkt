-- Cohorts: readable rule definitions, computed memberships, and frozen snapshots.
--
-- Privacy model
--   * k = 25. A cohort cannot be activated below min_size (>= 25), and a snapshot cannot be
--     frozen with fewer than 25 members.
--   * cohort_memberships and snapshot_members are readable only by the member themselves.
--     Not by other users, not by admins. Public surfaces get rounded aggregates through views.

create table public.cohorts (
  id             bigint generated always as identity primary key,
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title          text not null check (length(title) between 3 and 120),
  definition     jsonb not null,
  status         public.cohort_status not null default 'proposed',
  min_size       int not null default 25 check (min_size >= 25),
  proposed_by    public.proposer not null,
  rationale      text check (length(rationale) <= 600),
  model          text,
  prompt_version text,
  approved_by    uuid references public.profiles (user_id),
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  check ((proposed_by = 'ai') = (model is not null and prompt_version is not null)),
  check (approved_by is null or approved_at is not null)
);

create index cohorts_title_trgm_idx on public.cohorts using gin (title extensions.gin_trgm_ops);

create table public.cohort_memberships (
  cohort_id   bigint not null references public.cohorts (id),
  user_id     uuid not null references public.profiles (user_id),
  computed_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create index cohort_memberships_user_id_idx on public.cohort_memberships (user_id);

-- A snapshot is a frozen record of who was in a cohort when a market opened, so a market's
-- denominator never changes. member_count is written once, in the same transaction as the
-- snapshot_members rows, and neither table can be updated afterwards (triggers below), so the two
-- cannot drift. It carries the k check.
create table public.cohort_snapshots (
  id           bigint generated always as identity primary key,
  cohort_id    bigint not null references public.cohorts (id),
  frozen_at    timestamptz not null default public.app_now(),
  member_count int not null check (member_count >= 25)
);

create index cohort_snapshots_cohort_id_idx on public.cohort_snapshots (cohort_id);

-- ACCOUNT DELETION TRADE-OFF: when a member deletes their account, their row here becomes an
-- anonymized tombstone (user_id set to null) instead of being removed. The snapshot keeps its
-- size, so open markets keep their denominator and stay resolvable, and the person is no longer
-- linked to the cohort. The cost is that a deleted member can never report an outcome, so they
-- count as a non-response: a NO under count_as_no, and lower response rate under
-- exclude_with_quorum. That is the honest reading of "we no longer know".
create table public.snapshot_members (
  snapshot_id bigint not null references public.cohort_snapshots (id),
  member_no   int not null check (member_no >= 1),
  user_id     uuid references public.profiles (user_id),   -- null = tombstone
  primary key (snapshot_id, member_no),
  unique (snapshot_id, user_id)
);

create index snapshot_members_user_id_idx on public.snapshot_members (user_id) where user_id is not null;

create function private.guard_snapshot_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Tombstoning a deleted account is the only permitted change. Nested because PL/pgSQL does not
  -- short-circuit AND, and cohort_snapshots rows have no user_id.
  if tg_table_name = 'snapshot_members' and tg_op = 'UPDATE' then
    if new.snapshot_id = old.snapshot_id and new.member_no = old.member_no
       and old.user_id is not null and new.user_id is null then
      return new;
    end if;
  end if;
  raise exception '% rows are frozen', tg_table_name
    using detail = format('%s on %s is not allowed.', tg_op, tg_table_name);
end
$$;

create trigger cohort_snapshots_frozen
  before update or delete on public.cohort_snapshots
  for each row execute function private.guard_snapshot_immutable();

create trigger snapshot_members_frozen
  before update or delete on public.snapshot_members
  for each row execute function private.guard_snapshot_immutable();

-- ---------------------------------------------------------------------------------------------
-- Definition validation
-- ---------------------------------------------------------------------------------------------
-- Shape:
--   { "skills": [{"tag": "embedded-systems", "min_weighted_courses": 3}],   -- 1 to 4, required
--     "grad_years": [2027, 2028],                                           -- optional
--     "regions": ["ON"],                                                    -- optional, university region
--     "universities": ["UW", "UofT"] }                                      -- optional, short names
-- A person qualifies when, for every listed skill, the sum of tag weights over their passed
-- courses reaches min_weighted_courses, and every optional filter matches.

create function private.validate_cohort_definition(p_def jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
  v_skill jsonb;
  v_tags text[] := '{}'::text[];
  v_total numeric := 0;
  v_min numeric;
begin
  if jsonb_typeof(p_def) is distinct from 'object' then
    raise exception 'invalid_definition' using detail = 'Definition must be a JSON object.';
  end if;
  for v_key in select jsonb_object_keys(p_def) loop
    if v_key not in ('skills', 'grad_years', 'regions', 'universities') then
      raise exception 'invalid_definition' using detail = format('Unknown key "%s".', v_key);
    end if;
  end loop;

  if jsonb_typeof(p_def -> 'skills') is distinct from 'array'
     or jsonb_array_length(p_def -> 'skills') not between 1 and 4 then
    raise exception 'invalid_definition' using detail = 'skills must list 1 to 4 skill requirements.';
  end if;
  for v_skill in select jsonb_array_elements(p_def -> 'skills') loop
    if not exists (select 1 from public.skill_tags where slug = v_skill ->> 'tag') then
      raise exception 'invalid_definition' using detail = format('Unknown skill tag "%s".', v_skill ->> 'tag');
    end if;
    if (v_skill ->> 'tag') = any (v_tags) then
      raise exception 'invalid_definition' using detail = format('Skill "%s" is listed twice.', v_skill ->> 'tag');
    end if;
    v_tags := v_tags || (v_skill ->> 'tag');
    if jsonb_typeof(v_skill -> 'min_weighted_courses') is distinct from 'number' then
      raise exception 'invalid_definition' using detail = 'min_weighted_courses must be a number.';
    end if;
    v_min := (v_skill ->> 'min_weighted_courses')::numeric;
    if v_min < 0.5 or v_min > 20 then
      raise exception 'invalid_definition' using detail = 'min_weighted_courses must be between 0.5 and 20.';
    end if;
    v_total := v_total + v_min;
  end loop;

  if p_def ? 'grad_years' and (
       jsonb_typeof(p_def -> 'grad_years') <> 'array'
       or jsonb_array_length(p_def -> 'grad_years') = 0
       or exists (select 1 from jsonb_array_elements(p_def -> 'grad_years') y
                   where jsonb_typeof(y) <> 'number' or (y #>> '{}')::numeric not between 2024 and 2032
                      or (y #>> '{}')::numeric <> trunc((y #>> '{}')::numeric))) then
    raise exception 'invalid_definition' using detail = 'grad_years must be a non-empty list of years 2024 to 2032.';
  end if;

  if p_def ? 'regions' and (
       jsonb_typeof(p_def -> 'regions') <> 'array'
       or jsonb_array_length(p_def -> 'regions') = 0
       or exists (select 1 from jsonb_array_elements_text(p_def -> 'regions') r
                   where not exists (select 1 from public.universities u where u.region = r))) then
    raise exception 'invalid_definition' using detail = 'regions must list region codes that have universities.';
  end if;

  if p_def ? 'universities' and (
       jsonb_typeof(p_def -> 'universities') <> 'array'
       or jsonb_array_length(p_def -> 'universities') = 0
       or exists (select 1 from jsonb_array_elements_text(p_def -> 'universities') s
                   where not exists (select 1 from public.universities u where u.short_name = s))) then
    raise exception 'invalid_definition' using detail = 'universities must list known university short names.';
  end if;

  -- One school plus effectively one course would let traders bet on a single classroom.
  if p_def ? 'universities' and jsonb_array_length(p_def -> 'universities') = 1 and v_total <= 1 then
    raise exception 'invalid_definition'
      using detail = 'A single-school cohort must require more than one weighted course.';
  end if;
end
$$;

create function private.guard_cohort()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.definition is distinct from old.definition then
    if tg_op = 'UPDATE' and old.status <> 'proposed' then
      raise exception 'definition_frozen'
        using detail = 'A cohort''s definition cannot change once it has been approved.';
    end if;
    perform private.validate_cohort_definition(new.definition);
  end if;

  if tg_op = 'UPDATE' and old.status = 'retired' and new.status <> 'retired' then
    raise exception 'cohort_retired' using detail = 'Retired cohorts cannot be reactivated.';
  end if;

  -- Activation is blocked below min_size. On INSERT a cohort has no members yet, so a cohort can
  -- only become active after compute_memberships has run.
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if (select count(*) from public.cohort_memberships m where m.cohort_id = new.id) < new.min_size then
      raise exception 'below_min_size'
        using detail = format('A cohort needs at least %s members to go live.', new.min_size);
    end if;
  end if;
  return new;
end
$$;

create trigger cohorts_guard
  before insert or update on public.cohorts
  for each row execute function private.guard_cohort();

-- ---------------------------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------------------------

-- The single source of truth for "who matches this definition". Pass p_user_id to test one person
-- (used when a transcript is confirmed). Failed courses do not count; in-progress courses do.
create function private.cohort_member_ids(p_def jsonb, p_user_id uuid default null)
returns table (member_id uuid)
language sql
stable
set search_path = ''
as $$
  with req as (
    select r.tag, r.min_weighted_courses
      from jsonb_to_recordset(p_def -> 'skills') as r (tag text, min_weighted_courses numeric)
  ),
  scores as (
    select tc.user_id, st.slug, sum(cst.weight) as weighted
      from public.transcript_courses tc
      join public.course_skill_tags cst on cst.course_id = tc.course_id
      join public.skill_tags st on st.id = cst.skill_tag_id
     where st.slug in (select tag from req)
       and tc.grade_band is distinct from 'F'
       and (p_user_id is null or tc.user_id = p_user_id)
     group by tc.user_id, st.slug
  ),
  qualified as (
    select s.user_id
      from scores s
      join req r on r.tag = s.slug and s.weighted >= r.min_weighted_courses
     group by s.user_id
    having count(*) = (select count(*) from req)
  )
  select q.user_id
    from qualified q
    join public.student_profiles sp on sp.user_id = q.user_id
    join public.universities u on u.id = sp.university_id
   where sp.grad_year is not null
     and (not p_def ? 'grad_years'
          or sp.grad_year in (select (y #>> '{}')::int from jsonb_array_elements(p_def -> 'grad_years') y))
     and (not p_def ? 'regions'
          or u.region in (select jsonb_array_elements_text(p_def -> 'regions')))
     and (not p_def ? 'universities'
          or u.short_name in (select jsonb_array_elements_text(p_def -> 'universities')))
$$;

create function private.compute_memberships(p_cohort_id bigint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_def jsonb;
  v_count int;
begin
  select c.definition into v_def
    from public.cohorts c
   where c.id = p_cohort_id and c.status <> 'retired'
     for update;
  if not found then
    raise exception 'cohort_not_found' using detail = 'No live cohort with that id.';
  end if;

  with fresh as (
    select member_id from private.cohort_member_ids(v_def)
  ),
  removed as (
    delete from public.cohort_memberships m
     where m.cohort_id = p_cohort_id
       and not exists (select 1 from fresh f where f.member_id = m.user_id)
  )
  insert into public.cohort_memberships (cohort_id, user_id)
  select p_cohort_id, f.member_id from fresh f
  on conflict do nothing;

  select count(*) into v_count from public.cohort_memberships where cohort_id = p_cohort_id;
  return v_count;
end
$$;

-- Admin entry point. Returns the exact member count (admins see exact counts; the public never does).
create function public.compute_memberships(p_cohort_id bigint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform private.assert_admin();
  v_count := private.compute_memberships(p_cohort_id);
  perform private.audit('compute_memberships', 'cohorts', p_cohort_id::text,
                        jsonb_build_object('member_count', v_count));
  return v_count;
end
$$;

-- Re-evaluates one person against every live cohort. Called when a transcript is confirmed or
-- data is deleted. Returns the ids of the cohorts they are now in.
create function private.recompute_user_memberships(p_user_id uuid)
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cohort record;
  v_in boolean;
begin
  for v_cohort in select c.id, c.definition from public.cohorts c where c.status <> 'retired' order by c.id loop
    v_in := exists (select 1 from private.cohort_member_ids(v_cohort.definition, p_user_id));
    if v_in then
      insert into public.cohort_memberships (cohort_id, user_id) values (v_cohort.id, p_user_id)
      on conflict do nothing;
    else
      delete from public.cohort_memberships where cohort_id = v_cohort.id and user_id = p_user_id;
    end if;
  end loop;
  return array(select cohort_id from public.cohort_memberships where user_id = p_user_id order by cohort_id);
end
$$;

-- Freezes the cohort's current membership. Recomputes first so the snapshot reflects every
-- confirmed transcript. The member_count CHECK enforces k = 25.
create function private.freeze_snapshot(p_cohort_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.cohort_status;
  v_snapshot_id bigint;
  v_count int;
begin
  select c.status into v_status from public.cohorts c where c.id = p_cohort_id for update;
  if v_status is distinct from 'active' then
    raise exception 'cohort_not_active' using detail = 'Only active cohorts can be snapshotted.';
  end if;

  v_count := private.compute_memberships(p_cohort_id);
  if v_count < 25 then
    raise exception 'below_min_size'
      using detail = format('This cohort has fallen below %s members and cannot back a new market.', 25);
  end if;

  insert into public.cohort_snapshots (cohort_id, member_count)
  values (p_cohort_id, v_count)
  returning id into v_snapshot_id;

  insert into public.snapshot_members (snapshot_id, member_no, user_id)
  select v_snapshot_id, row_number() over (order by m.user_id), m.user_id
    from public.cohort_memberships m
   where m.cohort_id = p_cohort_id;

  return v_snapshot_id;
end
$$;

create function public.freeze_snapshot(p_cohort_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return private.freeze_snapshot(p_cohort_id);
end
$$;
