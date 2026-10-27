-- =====================================================================
-- PURCHASE - FLEET - CONSUMPTION MANAGEMENT ERP
-- PHASE 1 : FOUNDATION  (run in Supabase > SQL Editor)
-- Run the blocks in order, one block at a time (select block > Run).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================


-- =====================================================================
-- BLOCK 1 : LOOKUP TABLES  (companies, departments, stores, roles, pages)
-- =====================================================================

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- A store is either one of OUR stores or a VENDOR (external) store.
create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  store_type  text not null default 'own' check (store_type in ('own','vendor')),
  vendor_name text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Roles are data, so you can add more later without changing code.
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text
);

-- Every screen of the app is a row here. Super Admin gives access per user.
create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  module      text not null,
  sort_order  int  not null default 0
);


-- =====================================================================
-- BLOCK 2 : USERS (profiles) AND THEIR ACCESS
-- A login itself lives in Supabase "auth.users". profiles adds our data.
-- =====================================================================

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  employee_code  text unique,
  full_name      text not null,
  designation    text,
  department_id  uuid references public.departments(id),
  role_id        uuid not null references public.roles(id),
  avatar_path    text,                      -- profile picture (storage path)
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Which pages a user can open, and what they can do there.
create table if not exists public.user_page_access (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  page_id      uuid not null references public.pages(id)    on delete cascade,
  can_view     boolean not null default true,
  can_add      boolean not null default false,
  can_edit     boolean not null default false,
  can_approve  boolean not null default false,
  primary key (user_id, page_id)
);

-- A user can be given ONE or MANY stores (own and/or vendor stores).
create table if not exists public.user_stores (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  store_id  uuid not null references public.stores(id)   on delete cascade,
  primary key (user_id, store_id)
);

-- Which companies a user may raise PO / Indent / MRF for.
create table if not exists public.user_companies (
  user_id     uuid not null references public.profiles(id)  on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  primary key (user_id, company_id)
);

-- Which departments a user belongs to / may act for.
create table if not exists public.user_departments (
  user_id        uuid not null references public.profiles(id)    on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  primary key (user_id, department_id)
);


-- =====================================================================
-- BLOCK 3 : PRODUCT MASTER
-- Stock will always be kept in BASE UOM. UOQ = base units in 1 purchase unit
-- (example: Barrel -> ML, UOQ = 200000).
-- =====================================================================

create table if not exists public.uoms (
  id      uuid primary key default gen_random_uuid(),
  code    text not null unique,       -- PC, ML, NOS, PAIR, BARREL, LTR ...
  name    text not null,
  active  boolean not null default true
);

-- 3-level category tree: level 1 = L1, level 2 = L2, level 3 = L3.
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories(id),
  level      smallint not null check (level between 1 and 3),
  name       text not null,
  active     boolean not null default true
);
create unique index if not exists categories_unique_name
  on public.categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  item_code        text not null unique,
  item_name        text not null,
  item_type        text not null default 'product' check (item_type in ('product','service')),
  brand            text,
  ref_part_no      text,
  purchase_uom_id  uuid not null references public.uoms(id),
  base_uom_id      uuid not null references public.uoms(id),
  uoq              numeric(14,3) not null default 1 check (uoq > 0),
  l1_category_id   uuid references public.categories(id),
  l2_category_id   uuid references public.categories(id),
  l3_category_id   uuid references public.categories(id),
  allow_decimal    boolean not null default false,   -- decimal consumption allowed?
  active           boolean not null default true,
  created_by       uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now()
);
-- Blocks accidental duplicates like F004 / F005 in your sample sheet.
create unique index if not exists products_no_duplicates
  on public.products (lower(trim(item_name)), lower(coalesce(brand,'')), item_type, lower(coalesce(ref_part_no,'')));

-- Up to 6 optional images per product (slot 1 to 6; the slot rule enforces the limit).
create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  slot          smallint not null check (slot between 1 and 6),
  storage_path  text not null,
  created_at    timestamptz not null default now(),
  unique (product_id, slot)
);

-- Vendors (suppliers / service vendors) used on PO and service orders.
create table if not exists public.vendors (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,
  name      text not null,
  contact   text,
  phone     text,
  address   text,
  tax_no    text,
  active    boolean not null default true,
  created_at timestamptz not null default now()
);


-- =====================================================================
-- BLOCK 4 : AUDIT LOG  (who did what, when, old and new values)
-- Nobody can edit or delete these rows from the app.
-- =====================================================================

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid,
  action      text not null,
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb
);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(), tg_op, tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'companies','departments','stores','roles','profiles','user_page_access',
    'user_stores','user_companies','user_departments','uoms','categories',
    'products','product_images','vendors'
  ] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;


-- =====================================================================
-- BLOCK 5 : PERMISSION HELPER FUNCTIONS
-- super_admin / admin : full access to everything (in the database)
-- viewer (auditor/CEO): can only VIEW, can never add, edit or delete
-- others             : exactly what Super Admin ticked in user_page_access
-- =====================================================================

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select r.code from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = auth.uid() and p.active
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'super_admin', false)
$$;

-- action: 'view' | 'add' | 'edit' | 'approve'
create or replace function public.has_perm(p_page text, p_action text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_ok boolean;
begin
  v_role := public.my_role();
  if v_role is null then return false; end if;
  if v_role in ('super_admin','admin') then return true; end if;
  if v_role = 'viewer' then return p_action = 'view'; end if;
  select case p_action
           when 'view'    then a.can_view
           when 'add'     then a.can_add
           when 'edit'    then a.can_edit
           when 'approve' then a.can_approve
           else false end
    into v_ok
    from public.user_page_access a
    join public.pages pg on pg.id = a.page_id
   where a.user_id = auth.uid() and pg.code = p_page;
  return coalesce(v_ok, false);
end $$;

-- A user edits only their OWN name/designation/picture, never role or status.
create or replace function public.update_my_profile(p_full_name text, p_designation text, p_avatar_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set full_name   = coalesce(nullif(trim(p_full_name),''), full_name),
         designation = coalesce(p_designation, designation),
         avatar_path = coalesce(p_avatar_path, avatar_path)
   where id = auth.uid();
end $$;


-- =====================================================================
-- BLOCK 6 : SECURITY RULES (Row Level Security)
-- Deleting is NOT allowed from the app on any table (strict process).
-- Use "active = false" to retire a record.
-- =====================================================================

alter table public.companies        enable row level security;
alter table public.departments      enable row level security;
alter table public.stores           enable row level security;
alter table public.roles            enable row level security;
alter table public.pages            enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_page_access enable row level security;
alter table public.user_stores      enable row level security;
alter table public.user_companies   enable row level security;
alter table public.user_departments enable row level security;
alter table public.uoms             enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_images   enable row level security;
alter table public.vendors          enable row level security;
alter table public.audit_log        enable row level security;

-- Simple master tables: everyone active can read; add/edit by page permission.
do $$
declare r record;
begin
  for r in select * from (values
      ('companies','companies'), ('departments','departments'), ('stores','stores'),
      ('uoms','uom_master'), ('categories','categories'),
      ('products','product_master'), ('product_images','product_master'),
      ('vendors','vendors')
  ) as x(tbl, page) loop
    execute format('drop policy if exists p_read on public.%I', r.tbl);
    execute format('drop policy if exists p_add  on public.%I', r.tbl);
    execute format('drop policy if exists p_edit on public.%I', r.tbl);
    execute format('create policy p_read on public.%I for select to authenticated using (public.is_active_user())', r.tbl);
    execute format('create policy p_add  on public.%I for insert to authenticated with check (public.has_perm(%L, ''add''))', r.tbl, r.page);
    execute format('create policy p_edit on public.%I for update to authenticated using (public.has_perm(%L, ''edit'')) with check (public.has_perm(%L, ''edit''))', r.tbl, r.page, r.page);
  end loop;
end $$;

-- product_images may be removed/replaced by people who can edit the master
drop policy if exists p_del on public.product_images;
create policy p_del on public.product_images for delete to authenticated
  using (public.has_perm('product_master','edit'));

-- roles and pages: everyone active reads; only Super Admin changes
drop policy if exists p_read on public.roles;
drop policy if exists p_all  on public.roles;
create policy p_read on public.roles for select to authenticated using (public.is_active_user());
create policy p_all  on public.roles for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists p_read on public.pages;
drop policy if exists p_all  on public.pages;
create policy p_read on public.pages for select to authenticated using (public.is_active_user());
create policy p_all  on public.pages for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- profiles: see yourself, or everyone if you hold the 'users' page view right
drop policy if exists p_read on public.profiles;
drop policy if exists p_all  on public.profiles;
create policy p_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_perm('users','view'));
create policy p_all  on public.profiles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- access tables: same pattern; only Super Admin changes them
do $$
declare t text;
begin
  foreach t in array array['user_page_access','user_stores','user_companies','user_departments'] loop
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('drop policy if exists p_all  on public.%I', t);
    execute format('create policy p_read on public.%I for select to authenticated using (user_id = auth.uid() or public.has_perm(''users'',''view''))', t);
    execute format('create policy p_all  on public.%I for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', t);
  end loop;
end $$;

-- audit log: read only, for people who hold the 'audit' page view right
drop policy if exists p_read on public.audit_log;
create policy p_read on public.audit_log for select to authenticated
  using (public.has_perm('audit','view'));


-- =====================================================================
-- BLOCK 7 : STARTING DATA (roles, pages, units, two company placeholders)
-- =====================================================================

insert into public.roles (code, name, description) values
  ('super_admin','Super Admin','Everything, including creating logins and access'),
  ('admin','Admin','Same as Super Admin except creating logins and Supabase details'),
  ('viewer','Viewer (Auditor / CEO)','Can view everything, cannot add, edit or delete'),
  ('user','Standard User','Access exactly as ticked by Super Admin')
on conflict (code) do nothing;

insert into public.pages (code, name, module, sort_order) values
  ('dashboard','Dashboard','General',1),
  ('users','Users and Access','Admin',10),
  ('companies','Companies','Admin',11),
  ('departments','Departments','Admin',12),
  ('stores','Stores','Admin',13),
  ('audit','Audit Log','Admin',14),
  ('uom_master','Units of Measure','Masters',20),
  ('categories','Categories','Masters',21),
  ('product_master','Product Master','Masters',22),
  ('vendors','Vendors','Masters',23),
  ('vehicles','Vehicles','Masters',24),
  ('pr','Purchase Requisition','Purchase',30),
  ('po','Purchase Order','Purchase',31),
  ('grn','GRN','Stores',40),
  ('stock','Stock','Stores',41),
  ('mrf','MRF','Stores',42),
  ('issue','Issue and Challan','Stores',43),
  ('acknowledge','Acknowledge Receipt','Stores',44),
  ('vendor_store','Vendor Store Module','Stores',45),
  ('service','Service Out / In','Stores',46),
  ('job_cards','Job Cards','Workshop',50),
  ('documents','Document Downloads','Reports',60)
on conflict (code) do nothing;

insert into public.uoms (code, name) values
  ('PC','Piece'), ('NOS','Numbers'), ('PAIR','Pair'), ('SET','Set'),
  ('ML','Millilitre'), ('LTR','Litre'), ('BARREL','Barrel (200 L)'),
  ('KG','Kilogram'), ('GM','Gram'), ('MTR','Metre')
on conflict (code) do nothing;

-- Two companies: rename these to your real company names later.
insert into public.companies (code, name) values
  ('C1','Company 1 (rename me)'),
  ('C2','Company 2 (rename me)')
on conflict (code) do nothing;


-- =====================================================================
-- BLOCK 8 : IMAGE STORAGE  (profile pictures and product images)
-- The app compresses images in the browser BEFORE uploading.
-- =====================================================================

insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('product-images','product-images', true)
on conflict (id) do nothing;

drop policy if exists "img read" on storage.objects;
create policy "img read" on storage.objects for select
  using (bucket_id in ('avatars','product-images'));

-- avatars: each user writes only inside their own folder (folder name = their user id)
drop policy if exists "avatar insert" on storage.objects;
drop policy if exists "avatar update" on storage.objects;
drop policy if exists "avatar delete" on storage.objects;
create policy "avatar insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- product images: anyone with Product Master add/edit right
drop policy if exists "pimg insert" on storage.objects;
drop policy if exists "pimg update" on storage.objects;
drop policy if exists "pimg delete" on storage.objects;
create policy "pimg insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_perm('product_master','add'));
create policy "pimg update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_perm('product_master','edit'));
create policy "pimg delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_perm('product_master','edit'));


-- =====================================================================
-- BLOCK 9 : CREATE YOUR FIRST SUPER ADMIN  (do this ONCE)
-- Step A (not SQL): Supabase > Authentication > Users > Add user >
--         "Create new user", enter an email + password, tick Auto Confirm.
-- Step B: change the email below to the SAME email, then run this block.
-- =====================================================================

-- insert into public.profiles (id, employee_code, full_name, designation, role_id)
-- select u.id, 'SA001', 'Your Name', 'Super Admin', r.id
--   from auth.users u, public.roles r
--  where u.email = 'your-email@example.com' and r.code = 'super_admin';
