-- RPCs for students and traders: consent, transcripts, privacy controls, watchlist, search.

-- Step 2 of onboarding. The university comes from the verified email domain.
create function public.give_student_consent()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_email text;
  v_confirmed timestamptz;
  v_university_id bigint;
begin
  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  v_university_id := private.university_for_email(v_email);
  if v_university_id is null then
    raise exception 'not_a_student' using detail = 'Sign in with your university email to join as a student.';
  end if;

  insert into public.student_profiles (user_id, university_id, verified_email_at, consent_at)
  values (v_uid, v_university_id, coalesce(v_confirmed, now()), now())
  on conflict (user_id) do update set consent_at = excluded.consent_at;

  return jsonb_build_object('university_id', v_university_id);
end
$$;

-- Registers a PDF the student just uploaded to storage at <uid>/<file>.pdf.
create function public.begin_transcript_upload(p_storage_path text)
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
    raise exception 'consent_required' using detail = 'Review and accept how we use your transcript first.';
  end if;
  if p_storage_path not like v_uid::text || '/%' or p_storage_path !~ '\.pdf$' then
    raise exception 'invalid_upload' using detail = 'Upload a PDF to your own folder.';
  end if;
  insert into public.transcript_uploads (user_id, storage_path) values (v_uid, p_storage_path)
  returning id into v_id;
  return v_id;
end
$$;

-- Edge Function (service role) only: records parsing progress and the extracted courses.
create function public.record_transcript_parse(
  p_upload_id uuid, p_status public.upload_status, p_parsed_json jsonb default null,
  p_model text default null, p_prompt_version text default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trusted_backend() then
    raise exception 'forbidden' using detail = 'Only the transcript parser can do this.';
  end if;
  if p_status = 'confirmed' then
    raise exception 'invalid_status' using detail = 'Only the student can confirm a transcript.';
  end if;
  update public.transcript_uploads
     set status = p_status,
         parsed_json = coalesce(p_parsed_json, parsed_json),
         model = coalesce(p_model, model),
         prompt_version = coalesce(p_prompt_version, prompt_version),
         error = p_error
   where id = p_upload_id and status <> 'confirmed';
  if not found then
    raise exception 'upload_not_found' using detail = 'No pending upload with that id.';
  end if;
end
$$;

-- Step 6 of onboarding. Nothing reaches transcript_courses until this runs.
-- p_courses: [{ "code", "title", "level"?, "term", "grade"?, "tags"?: [{ "slug", "weight" }] }]
-- tags are required only for courses not already in the catalog.
create function public.confirm_transcript(
  p_upload_id uuid, p_program_id bigint, p_grad_year int, p_courses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_university_id bigint;
  v_course jsonb;
  v_code text;
  v_course_id bigint;
  v_level int;
  v_tag jsonb;
  v_cohorts bigint[];
begin
  select sp.university_id into v_university_id from public.student_profiles sp where sp.user_id = v_uid;
  if not found then
    raise exception 'consent_required' using detail = 'Review and accept how we use your transcript first.';
  end if;
  perform 1 from public.transcript_uploads
   where id = p_upload_id and user_id = v_uid and status = 'needs_review'
     for update;
  if not found then
    raise exception 'upload_not_found' using detail = 'This transcript isn''t ready to confirm.';
  end if;
  if not exists (select 1 from public.programs where id = p_program_id and university_id = v_university_id) then
    raise exception 'invalid_program' using detail = 'Choose a program at your university.';
  end if;
  if p_grad_year is null or p_grad_year not between 2024 and 2032 then
    raise exception 'invalid_grad_year' using detail = 'Graduation year must be between 2024 and 2032.';
  end if;
  if jsonb_typeof(p_courses) <> 'array' or jsonb_array_length(p_courses) not between 1 and 150 then
    raise exception 'invalid_courses' using detail = 'A transcript needs between 1 and 150 courses.';
  end if;

  delete from public.transcript_courses where user_id = v_uid;

  for v_course in select jsonb_array_elements(p_courses) loop
    v_code := upper(btrim(regexp_replace(v_course ->> 'code', '\s+', ' ', 'g')));
    if v_code is null or length(v_code) not between 2 and 20 then
      raise exception 'invalid_courses' using detail = 'Every course needs a code.';
    end if;

    select c.id into v_course_id from public.courses c where c.university_id = v_university_id and c.code = v_code;
    if not found then
      if length(btrim(coalesce(v_course ->> 'title', ''))) = 0 then
        raise exception 'invalid_courses' using detail = format('Add a title for %s.', v_code);
      end if;
      if jsonb_typeof(v_course -> 'tags') <> 'array' or jsonb_array_length(v_course -> 'tags') = 0 then
        raise exception 'invalid_courses' using detail = format('Confirm at least one skill for %s.', v_code);
      end if;
      v_level := coalesce((v_course ->> 'level')::int,
                          least(greatest(nullif(substring(v_code from '[0-9]'), '')::int, 1), 8), 1);
      insert into public.courses (university_id, code, title, level)
      values (v_university_id, v_code, btrim(v_course ->> 'title'), v_level)
      returning id into v_course_id;
      for v_tag in select jsonb_array_elements(v_course -> 'tags') loop
        insert into public.course_skill_tags (course_id, skill_tag_id, weight)
        select v_course_id, st.id, (v_tag ->> 'weight')::numeric
          from public.skill_tags st where st.slug = v_tag ->> 'slug';
        if not found then
          raise exception 'invalid_courses' using detail = format('Unknown skill "%s".', v_tag ->> 'slug');
        end if;
      end loop;
    end if;

    insert into public.transcript_courses (user_id, course_id, term, grade_band)
    values (v_uid, v_course_id, v_course ->> 'term', (v_course ->> 'grade')::public.grade_band)
    on conflict do nothing;
  end loop;

  update public.student_profiles set program_id = p_program_id, grad_year = p_grad_year where user_id = v_uid;
  update public.transcript_uploads set status = 'confirmed', confirmed_at = now() where id = p_upload_id;

  v_cohorts := private.recompute_user_memberships(v_uid);

  return jsonb_build_object(
    'courses', (select count(*) from public.transcript_courses where user_id = v_uid),
    'cohort_ids', to_jsonb(v_cohorts));
end
$$;

-- Called right after the PDF is removed from storage.
create function public.mark_transcript_file_deleted(p_upload_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transcript_uploads
     set file_deleted_at = coalesce(file_deleted_at, now())
   where id = p_upload_id
     and (private.is_trusted_backend() or user_id = auth.uid());
  if not found then
    raise exception 'upload_not_found' using detail = 'No upload with that id.';
  end if;
end
$$;

-- The caller's skill profile: weighted course count per tag over passed courses.
create function public.my_skill_profile()
returns table (slug text, label text, category text, weighted numeric, courses int)
language sql
stable
security definer
set search_path = ''
as $$
  select st.slug, st.label, st.category, sum(cst.weight), count(distinct tc.course_id)::int
    from public.transcript_courses tc
    join public.course_skill_tags cst on cst.course_id = tc.course_id
    join public.skill_tags st on st.id = cst.skill_tag_id
   where tc.user_id = auth.uid() and tc.grade_band is distinct from 'F'
   group by st.slug, st.label, st.category
   order by sum(cst.weight) desc, st.slug
$$;

-- Removes transcript data, outcome reports and cohort memberships, so the person drops out of
-- every future snapshot. Snapshots already frozen keep them (they were in the cohort when the
-- market opened, so the insider rule still applies). Returns the storage paths still to delete.
create function public.delete_my_data()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_paths text[];
begin
  select coalesce(array_agg(storage_path) filter (where file_deleted_at is null), '{}')
    into v_paths from public.transcript_uploads where user_id = v_uid;
  delete from public.transcript_courses where user_id = v_uid;
  delete from public.transcript_uploads where user_id = v_uid;
  delete from public.outcome_reports where user_id = v_uid;
  delete from public.cohort_memberships where user_id = v_uid;
  update public.student_profiles set program_id = null, grad_year = null where user_id = v_uid;
  return v_paths;
end
$$;

-- Deletes an account by anonymizing it. The ledger, trades and positions are append-only market
-- records, so the profile row stays as a tombstone ("deleted-…" handle, deleted_at set) holding
-- them; everything that identifies the person goes:
--   * transcript data, outcome reports, memberships, student profile, watchlist: deleted
--   * frozen snapshot rows: tombstoned (user_id null). See the trade-off note on snapshot_members.
--   * auth.users: email, phone and metadata cleared, sessions and identities removed, banned.
-- Open positions stay in their markets and settle to the tombstone; nobody can use those credits.
create function public.delete_my_account()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_paths text[];
begin
  v_paths := public.delete_my_data();
  delete from public.student_profiles where user_id = v_uid;
  delete from public.watchlist where user_id = v_uid;
  update public.snapshot_members set user_id = null where user_id = v_uid;
  update public.profiles
     set handle = 'deleted-' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 10),
         role = 'trader',
         deleted_at = now()
   where user_id = v_uid;

  delete from auth.sessions where user_id = v_uid;
  delete from auth.identities where user_id = v_uid;
  update auth.users
     set email = null, phone = null, raw_user_meta_data = '{}'::jsonb,
         banned_until = 'infinity', deleted_at = now()
   where id = v_uid;
  return v_paths;
end
$$;

create function public.toggle_watchlist(p_market_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  delete from public.watchlist where user_id = v_uid and market_id = p_market_id;
  if found then
    return false;
  end if;
  if not exists (select 1 from public.markets where id = p_market_id) then
    raise exception 'market_not_found' using detail = 'No market with that id.';
  end if;
  insert into public.watchlist (user_id, market_id) values (v_uid, p_market_id);
  return true;
end
$$;

-- ⌘K: markets, public cohorts and skill tags. Proposed cohorts never appear.
create function public.search_catalog(p_query text, p_limit int default 8)
returns table (kind text, key text, title text, subtitle text, score real)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select btrim(p_query) as q, least(greatest(p_limit, 1), 25) as lim)
  (select 'market', m.id::text, m.question, c.title,
          extensions.word_similarity(q.q, m.question)
     from q, public.markets m
     join public.cohort_snapshots s on s.id = m.snapshot_id
     join public.cohorts c on c.id = s.cohort_id
    where length(q.q) >= 2
      and (m.question ilike '%' || q.q || '%' or extensions.word_similarity(q.q, m.question) > 0.4)
    order by m.status = 'open' desc, 5 desc, m.id desc
    limit (select lim from q))
  union all
  (select 'cohort', v.slug, v.title, v.member_count_rounded || ' people',
          extensions.word_similarity(q.q, v.title)
     from q, public.v_cohort_public v
    where length(q.q) >= 2
      and (v.title ilike '%' || q.q || '%' or extensions.word_similarity(q.q, v.title) > 0.4)
    order by 5 desc
    limit (select lim from q))
  union all
  (select 'skill', st.slug, st.label, st.category,
          greatest(extensions.word_similarity(q.q, st.label), extensions.word_similarity(q.q, st.slug))
     from q, public.skill_tags st
    where length(q.q) >= 1
      and (st.label ilike '%' || q.q || '%' or st.slug ilike '%' || q.q || '%'
           or extensions.word_similarity(q.q, st.label) > 0.4)
    order by 5 desc
    limit (select lim from q))
$$;

-- Onboarding: find a course to add by code or title at one university.
create function public.search_courses(p_university_id bigint, p_query text, p_limit int default 10)
returns table (id bigint, code text, title text, level int)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.code, c.title, c.level
    from public.courses c
   where c.university_id = p_university_id
     and length(btrim(p_query)) >= 2
     and (c.code ilike btrim(p_query) || '%' or c.title ilike '%' || btrim(p_query) || '%'
          or extensions.word_similarity(btrim(p_query), c.title) > 0.4)
   order by c.code ilike btrim(p_query) || '%' desc,
            extensions.word_similarity(btrim(p_query), c.title) desc, c.code
   limit least(greatest(p_limit, 1), 25)
$$;
