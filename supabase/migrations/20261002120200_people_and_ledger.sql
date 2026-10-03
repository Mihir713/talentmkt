-- People (profiles, students, transcripts) and the append-only credit ledger.

create table public.profiles (
  -- No ON DELETE CASCADE: accounts are anonymized, never hard-deleted, because the ledger and
  -- trade history are append-only. See public.delete_my_account().
  user_id    uuid primary key references auth.users (id),
  handle     text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(handle) <= 40),
  role       public.user_role not null default 'trader',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid() and p.role = 'admin' and p.deleted_at is null
  )
$$;

create function private.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_backend() or public.is_admin() then
    return;
  end if;
  raise exception 'forbidden' using detail = 'This action is for admins only.';
end
$$;

-- The signed-in, non-deleted caller. Every user-facing RPC starts here.
create function private.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using detail = 'Sign in first.';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_uid and deleted_at is null) then
    raise exception 'account_deleted' using detail = 'This account has been deleted.';
  end if;
  return v_uid;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------------------------

-- DENORMALIZATION (1 of 2): accounts.balance equals sum(ledger_entries.amount) for the user.
-- It is stored so execute_trade can lock one row and check funds without summing the ledger,
-- and so the CHECK (balance >= 0) rejects any overdraft at the database level. It is written only
-- by private.ledger_apply_to_balance() (the trigger below). Any other UPDATE is rejected.
create table public.accounts (
  user_id    uuid primary key references public.profiles (user_id),
  balance    numeric(18, 6) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.accounts (user_id),
  amount     numeric(18, 6) not null check (amount <> 0),   -- signed: + credit, - debit
  kind       public.ledger_kind not null,
  trade_id   bigint,   -- FK added with public.trades
  market_id  bigint,   -- FK added with public.markets
  memo       text,
  created_at timestamptz not null default public.app_now(),
  check ((kind in ('trade', 'fee')) = (trade_id is not null)),
  check (kind not in ('trade', 'fee', 'payout', 'refund') or market_id is not null),
  check (case kind
           when 'signup_grant' then amount > 0
           when 'fee'          then amount < 0
           when 'payout'       then amount > 0
           when 'refund'       then amount > 0
           else true
         end)
);

create index ledger_entries_user_id_created_at_idx on public.ledger_entries (user_id, created_at desc);
create index ledger_entries_trade_id_idx on public.ledger_entries (trade_id) where trade_id is not null;

create function private.ledger_apply_to_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  perform set_config('talentmkt.ledger_write', 'on', true);
  update public.accounts
     set balance = balance + new.amount, updated_at = now()
   where user_id = new.user_id;
  get diagnostics v_rows = row_count;
  perform set_config('talentmkt.ledger_write', '', true);
  if v_rows = 0 then
    raise exception 'ledger entry for unknown account %', new.user_id;
  end if;
  return null;
end
$$;

create trigger ledger_entries_apply_to_balance
  after insert on public.ledger_entries
  for each row execute function private.ledger_apply_to_balance();

create function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using detail = format('%s on %s is not allowed.', tg_op, tg_table_name);
end
$$;

create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function private.reject_mutation();

create trigger ledger_entries_no_truncate
  before truncate on public.ledger_entries
  for each statement execute function private.reject_mutation();

create function private.guard_account_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.balance <> 0 then
      raise exception 'accounts start at zero; credit them through ledger_entries';
    end if;
  elsif new.balance is distinct from old.balance
        and coalesce(current_setting('talentmkt.ledger_write', true), '') <> 'on' then
    raise exception 'accounts.balance is maintained by the ledger trigger only';
  end if;
  return new;
end
$$;

create trigger accounts_guard_balance
  before insert or update on public.accounts
  for each row execute function private.guard_account_balance();

create trigger accounts_no_delete
  before delete on public.accounts
  for each row execute function private.reject_mutation();

-- ---------------------------------------------------------------------------------------------
-- Students and transcripts
-- ---------------------------------------------------------------------------------------------

create table public.student_profiles (
  user_id           uuid primary key references public.profiles (user_id),
  university_id     bigint not null references public.universities (id),
  program_id        bigint,                -- set when the transcript is confirmed
  grad_year         int check (grad_year between 2024 and 2032),
  verified_email_at timestamptz not null,
  consent_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  foreign key (program_id, university_id) references public.programs (id, university_id)
);

create table public.transcript_uploads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (user_id),
  storage_path    text not null unique,
  status          public.upload_status not null default 'uploaded',
  model           text,
  prompt_version  text,
  parsed_json     jsonb,
  error           text,
  file_deleted_at timestamptz,
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now(),
  check (storage_path like user_id::text || '/%'),
  check ((status = 'confirmed') = (confirmed_at is not null)),
  check (parsed_json is null or (model is not null and prompt_version is not null))
);

create index transcript_uploads_user_id_idx on public.transcript_uploads (user_id, created_at desc);

create table public.transcript_courses (
  user_id    uuid not null references public.profiles (user_id),
  course_id  bigint not null references public.courses (id),
  term       text not null check (term ~ '^(Fall|Winter|Spring|Summer) [0-9]{4}$'),
  grade_band public.grade_band,
  primary key (user_id, course_id, term)
);

create index transcript_courses_course_id_idx on public.transcript_courses (course_id);

-- ---------------------------------------------------------------------------------------------
-- New users: profile, account, signup grant
-- ---------------------------------------------------------------------------------------------

-- Pseudonymous handle derived from the user id, e.g. "quiet-heron-41". Deterministic for a given
-- id (so seeded data is reproducible) and reveals nothing about the person.
create function private.make_handle(p_user_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_adj  text[] := array['amber','brisk','calm','civic','clear','coral','crisp','dusky','eager','early',
                         'fair','fleet','frank','glad','grand','hardy','keen','lucid','merry','noble',
                         'olive','plain','quiet','rapid','sage','sharp','sober','solid','steady','swift',
                         'tidy','vivid'];
  v_noun text[] := array['alder','badger','bison','cedar','condor','crane','delta','egret','falcon','fern',
                         'finch','gecko','harbor','heron','ibis','juniper','kestrel','lark','lynx','maple',
                         'marten','meadow','orca','osprey','otter','pine','plover','quarry','raven','ridge',
                         'sparrow','willow'];
  v_hash bytea := decode(md5(p_user_id::text), 'hex');
  v_base text;
  v_handle text;
  v_n int := 0;
begin
  v_base := v_adj[1 + get_byte(v_hash, 0) % 32] || '-' || v_noun[1 + get_byte(v_hash, 1) % 32];
  v_handle := v_base || '-' || (10 + (get_byte(v_hash, 2) * 256 + get_byte(v_hash, 3)) % 90)::text;
  while exists (select 1 from public.profiles where handle = v_handle) loop
    v_n := v_n + 1;
    v_handle := v_base || '-' || (100 + (get_byte(v_hash, 2) * 256 + get_byte(v_hash, 3) + v_n) % 9900)::text;
  end loop;
  return v_handle;
end
$$;

-- Matches an email against university domains, including subdomains (mail.utoronto.ca).
create function private.university_for_email(p_email text)
returns bigint
language sql
stable
set search_path = ''
as $$
  select u.id
    from public.universities u
   where lower(split_part(p_email, '@', 2)) = u.email_domain
      or lower(split_part(p_email, '@', 2)) like '%.' || u.email_domain
   order by length(u.email_domain) desc
   limit 1
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, handle, role)
  values (
    new.id,
    private.make_handle(new.id),
    case when private.university_for_email(new.email) is not null then 'student' else 'trader' end::public.user_role
  );
  insert into public.accounts (user_id) values (new.id);
  insert into public.ledger_entries (user_id, amount, kind, memo)
  values (new.id, 1000, 'signup_grant', 'Starting credits');
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
