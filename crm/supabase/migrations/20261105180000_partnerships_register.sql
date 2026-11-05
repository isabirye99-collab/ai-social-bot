-- Partnerships register and CSV import support
create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_person text,
  email text,
  phone text,
  partnership_type text,
  status text not null default 'Active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partnerships_organization_name_idx
  on public.partnerships (lower(organization_name));
create index if not exists partnerships_email_idx
  on public.partnerships (lower(email))
  where email is not null and email <> '';
create index if not exists partnerships_created_at_idx
  on public.partnerships (created_at desc);

alter table public.partnerships enable row level security;

drop policy if exists partnerships_read on public.partnerships;
create policy partnerships_read
  on public.partnerships for select to authenticated
  using (true);

drop policy if exists partnerships_insert on public.partnerships;
create policy partnerships_insert
  on public.partnerships for insert to authenticated
  with check (private.is_marketing_or_admin_manager());

drop policy if exists partnerships_update on public.partnerships;
create policy partnerships_update
  on public.partnerships for update to authenticated
  using (private.is_marketing_or_admin_manager())
  with check (private.is_marketing_or_admin_manager());

drop policy if exists partnerships_delete on public.partnerships;
create policy partnerships_delete
  on public.partnerships for delete to authenticated
  using (private.is_marketing_or_admin_manager());

grant select, insert, update, delete on public.partnerships to authenticated;
