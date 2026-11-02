create table if not exists public.partnership_contacts (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  full_name text not null,
  job_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partnership_contacts_partnership_idx on public.partnership_contacts(partnership_id);
create unique index if not exists partnership_contacts_one_primary_idx on public.partnership_contacts(partnership_id) where is_primary;
alter table public.partnership_contacts enable row level security;
drop policy if exists partnership_contacts_staff_all on public.partnership_contacts;
create policy partnership_contacts_staff_all on public.partnership_contacts
  for all to authenticated using (private.is_partnerships_staff()) with check (private.is_partnerships_staff());
grant select, insert, update, delete on public.partnership_contacts to authenticated;
