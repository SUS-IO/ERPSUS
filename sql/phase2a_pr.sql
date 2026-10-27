-- =====================================================================
-- PHASE 2a : PURCHASE REQUISITION (PR)   (run block by block)
-- Needs Phase 1 and Phase 1b to be done first.
-- =====================================================================

-- BLOCK A : tables
-- Numbering counters (one counter per company + document type + year)
create table if not exists public.doc_counters (
  company_id uuid not null references public.companies(id),
  doc_type   text not null,
  yr         int  not null,
  last_no    int  not null default 0,
  primary key (company_id, doc_type, yr)
);
alter table public.doc_counters enable row level security;   -- no policies: only functions touch it

create table if not exists public.pr_headers (
  id             uuid primary key default gen_random_uuid(),
  pr_no          text unique,                          -- given when submitted
  company_id     uuid not null references public.companies(id),
  department_id  uuid not null references public.departments(id),
  raised_by      uuid not null default auth.uid() references public.profiles(id),
  required_date  date,
  purpose        text,
  status         text not null default 'draft'
                 check (status in ('draft','submitted','signed','cancelled')),
  version        int  not null default 1,
  locked_by      uuid references public.profiles(id),
  locked_until   timestamptz,
  submitted_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.pr_lines (
  id           uuid primary key default gen_random_uuid(),
  pr_id        uuid not null references public.pr_headers(id) on delete cascade,
  line_no      int  not null,
  description  text not null,                          -- plain text, as you wanted
  qty          numeric(14,3) not null check (qty > 0),
  unit         text,
  remarks      text,
  unique (pr_id, line_no)
);

-- People whose names print on the PR (raised by / verified by / approvers)
create table if not exists public.pr_signers (
  id                uuid primary key default gen_random_uuid(),
  pr_id             uuid not null references public.pr_headers(id) on delete cascade,
  user_id           uuid not null references public.profiles(id),
  role_label        text not null,                     -- Raised by / Verified by / Approved by
  sort_order        int  not null,
  name_snap         text,                              -- name + designation frozen at submit
  designation_snap  text,
  unique (pr_id, user_id)
);


-- BLOCK B : freeze guards
drop trigger if exists trg_guard on public.pr_headers;
create trigger trg_guard before update on public.pr_headers
  for each row execute function public.doc_guard();

-- lines and signers cannot change once the PR is out of draft
create or replace function public.pr_child_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(new.pr_id, old.pr_id); st text;
begin
  if coalesce(current_setting('app.workflow', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  select status into st from public.pr_headers where id = v_id;
  if st is distinct from 'draft' then
    raise exception 'FROZEN: this PR is submitted and cannot be edited';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard on public.pr_lines;
create trigger trg_guard before insert or update or delete on public.pr_lines
  for each row execute function public.pr_child_guard();
drop trigger if exists trg_guard on public.pr_signers;
create trigger trg_guard before insert or update or delete on public.pr_signers
  for each row execute function public.pr_child_guard();

-- audit trail
do $$
declare t text;
begin
  foreach t in array array['pr_headers','pr_lines','pr_signers'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;


-- BLOCK C : functions
create or replace function public.pr_mine(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pr_headers where id = p_id and raised_by = auth.uid())
$$;

-- names for the "Verified by / Approvers" pickers (normal users cannot read other profiles)
create or replace function public.list_people()
returns table (id uuid, full_name text, designation text, department_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.designation, p.department_id
    from public.profiles p
   where p.active and public.is_active_user()
   order by p.full_name
$$;

-- SUBMIT: numbers the PR, freezes it, and fixes names + designations for the printout
create or replace function public.submit_pr(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare h public.pr_headers; n int; v_no text; v_comp text; v_yr int := extract(year from now())::int;
begin
  select * into h from public.pr_headers where id = p_id for update;
  if not found then raise exception 'PR not found'; end if;
  if h.raised_by <> auth.uid() then raise exception 'Only the person who raised this PR can submit it'; end if;
  if not public.has_perm('pr','add') then raise exception 'You do not have permission to submit PRs'; end if;
  if h.status <> 'draft' then raise exception 'This PR is already submitted'; end if;
  if not exists (select 1 from public.pr_lines where pr_id = p_id) then raise exception 'Add at least one item'; end if;
  if not exists (select 1 from public.pr_signers where pr_id = p_id and role_label = 'Verified by') then
    raise exception 'Select who verifies this PR';
  end if;

  select code into v_comp from public.companies where id = h.company_id;
  insert into public.doc_counters (company_id, doc_type, yr, last_no)
       values (h.company_id, 'PR', v_yr, 1)
  on conflict (company_id, doc_type, yr)
       do update set last_no = public.doc_counters.last_no + 1
    returning last_no into n;
  v_no := 'PR/' || v_comp || '/' || v_yr || '/' || lpad(n::text, 4, '0');

  perform set_config('app.workflow', 'on', true);       -- allowed to pass the freeze guard, this transaction only
  update public.pr_headers set status = 'submitted', pr_no = v_no, submitted_at = now() where id = p_id;
  insert into public.pr_signers (pr_id, user_id, role_label, sort_order) values (p_id, h.raised_by, 'Raised by', 0);
  update public.pr_signers s
     set name_snap = p.full_name, designation_snap = p.designation
    from public.profiles p
   where s.user_id = p.id and s.pr_id = p_id;
  return v_no;
end $$;


-- BLOCK D : security rules
alter table public.pr_headers enable row level security;
alter table public.pr_lines   enable row level security;
alter table public.pr_signers enable row level security;

-- you see PRs you raised, PRs of your departments, or all if you work in Purchase (PO right)
drop policy if exists p_read on public.pr_headers;
create policy p_read on public.pr_headers for select to authenticated using (
  public.has_perm('pr','view') and (
    raised_by = auth.uid()
    or public.has_perm('po','view')
    or department_id in (select department_id from public.user_departments where user_id = auth.uid())
    or department_id = (select department_id from public.profiles where id = auth.uid())
  )
);
drop policy if exists p_add on public.pr_headers;
create policy p_add on public.pr_headers for insert to authenticated
  with check (public.has_perm('pr','add') and raised_by = auth.uid() and status = 'draft');
drop policy if exists p_edit on public.pr_headers;
create policy p_edit on public.pr_headers for update to authenticated
  using (raised_by = auth.uid() and public.has_perm('pr','add'))
  with check (raised_by = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['pr_lines','pr_signers'] loop
    execute format('drop policy if exists p_read  on public.%I', t);
    execute format('drop policy if exists p_write on public.%I', t);
    execute format('create policy p_read  on public.%I for select to authenticated using (exists (select 1 from public.pr_headers h where h.id = pr_id))', t);
    execute format('create policy p_write on public.%I for all to authenticated using (public.pr_mine(pr_id)) with check (public.pr_mine(pr_id))', t);
  end loop;
end $$;


-- BLOCK E : permissions for new tables, private document storage, live updates
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- private bucket for generated PDFs and signed scans (used in the next step)
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;
drop policy if exists "doc read" on storage.objects;
drop policy if exists "doc insert" on storage.objects;
create policy "doc read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_active_user());
create policy "doc insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_active_user());

alter publication supabase_realtime add table public.pr_headers;
