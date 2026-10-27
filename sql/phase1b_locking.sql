-- =====================================================================
-- PHASE 1b : VERSION CHECK + FREEZE/LOCK GUARD  (run in SQL Editor)
-- =====================================================================

-- BLOCK A : every product row gets a version number that goes up on each save.
-- The app saves "only if the version is still the one I opened", so an old
-- screen can never overwrite someone else's newer change.
alter table public.products add column if not exists version int not null default 1;

create or replace function public.bump_version()
returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end $$;

drop trigger if exists trg_version on public.products;
create trigger trg_version before update on public.products
  for each row execute function public.bump_version();


-- BLOCK B : reusable guard for every DOCUMENT table (PR, PO, GRN, MRF, Job Card).
-- Phase 2 attaches it to each document table that has the columns:
--   status text, version int, locked_by uuid, locked_until timestamptz
-- Rules enforced INSIDE the database (screens cannot bypass them):
--   1. Once status is not 'draft', nobody can edit the document directly.
--      Only the workflow functions (approve / reject / receive ...) can change it.
--   2. While an approver has it open (locked_by + locked_until in the future),
--      nobody else can change it.
--   3. Every save raises the version number.
create or replace function public.doc_guard()
returns trigger language plpgsql as $$
declare
  wf boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
begin
  if not wf then
    if old.status <> 'draft' then
      raise exception 'FROZEN: this document is submitted and cannot be edited';
    end if;
    if old.locked_by is not null and old.locked_until > now()
       and old.locked_by is distinct from auth.uid() then
      raise exception 'LOCKED: this document is open with another user';
    end if;
  end if;
  new.version := old.version + 1;
  return new;
end $$;


-- BLOCK C : switch on live updates for the product tables
alter publication supabase_realtime add table
  public.products, public.product_images, public.categories;
