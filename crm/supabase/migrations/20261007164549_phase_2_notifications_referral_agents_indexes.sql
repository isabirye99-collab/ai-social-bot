
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_read_created_idx
  on public.notifications (recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid() or private.is_admin_or_manager());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_insert_manage on public.notifications;
create policy notifications_insert_manage
  on public.notifications
  for insert
  to authenticated
  with check (
    recipient_id = auth.uid()
    or private.is_admin_or_manager()
  );

create table if not exists public.referral_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_name text,
  phone text,
  email text,
  location text,
  commission_type text not null default 'fixed',
  commission_value numeric not null default 0,
  status text not null default 'active',
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_agents_commission_nonnegative check (commission_value >= 0)
);

create index if not exists referral_agents_assigned_to_idx
  on public.referral_agents (assigned_to);
create index if not exists referral_agents_status_idx
  on public.referral_agents (status);

alter table public.referral_agents enable row level security;

drop policy if exists referral_agents_read on public.referral_agents;
create policy referral_agents_read
  on public.referral_agents
  for select
  to authenticated
  using (true);

drop policy if exists referral_agents_write on public.referral_agents;
create policy referral_agents_write
  on public.referral_agents
  for all
  to authenticated
  using (private.is_admin_or_manager() or assigned_to = auth.uid())
  with check (private.is_admin_or_manager() or assigned_to = auth.uid());

create index if not exists activities_created_by_activity_at_idx
  on public.activities (created_by, activity_at desc);

create index if not exists activities_lead_activity_at_idx
  on public.activities (lead_id, activity_at desc);

create index if not exists admission_payments_admission_date_idx
  on public.admission_payments (admission_id, payment_date desc);

create index if not exists admissions_stage_created_idx
  on public.admissions (stage, created_at desc);

create index if not exists leads_score_created_idx
  on public.leads (score desc, created_at desc);
;
