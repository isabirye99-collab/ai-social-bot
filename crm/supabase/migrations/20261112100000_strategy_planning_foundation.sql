-- CIU Strategy & Planning foundation (additive; no existing CRM data is modified).
-- Run through the project's reviewed Supabase migration workflow after code review.

create table if not exists public.strategy_plans (
  id uuid primary key default gen_random_uuid(),
  strategy_year integer not null unique check (strategy_year between 2000 and 2200),
  title text not null default 'Annual Marketing Strategy',
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'returned_for_revision', 'archived')),
  summary text,
  prepared_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_objectives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  title text not null,
  description text,
  accountable_owner uuid references public.profiles(id) on delete set null,
  target_value numeric,
  actual_value numeric,
  unit text,
  due_date date,
  status text not null default 'on_track'
    check (status in ('on_track', 'at_risk', 'behind', 'achieved', 'not_achieved')),
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_intake_plans (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  intake_month integer not null check (intake_month in (2, 4, 8, 11)),
  cycle text generated always as (case when intake_month in (2, 4) then 'february' else 'august' end) stored,
  programme text not null,
  target_applications integer not null default 0 check (target_applications >= 0),
  target_admissions integer not null default 0 check (target_admissions >= 0),
  target_registrations integer not null default 0 check (target_registrations >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, intake_month, programme)
);

create table if not exists public.strategy_activities (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  objective_id uuid references public.strategy_objectives(id) on delete set null,
  title text not null,
  description text,
  activity_type text,
  channel text,
  starts_on date,
  ends_on date,
  accountable_owner uuid references public.profiles(id) on delete set null,
  supporting_staff uuid[] not null default '{}',
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'delayed', 'on_hold', 'cancelled')),
  target_value numeric,
  actual_value numeric,
  outcome_notes text,
  lessons_learned text,
  budget_amount numeric not null default 0 check (budget_amount >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.strategy_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists strategy_objectives_plan_idx on public.strategy_objectives(plan_id, sort_order);
create index if not exists strategy_intake_plan_cycle_idx on public.strategy_intake_plans(plan_id, cycle, intake_month);
create index if not exists strategy_activities_plan_status_idx on public.strategy_activities(plan_id, status);
create index if not exists strategy_audit_entity_idx on public.strategy_audit_events(entity_type, entity_id, created_at desc);

alter table public.strategy_plans enable row level security;
alter table public.strategy_objectives enable row level security;
alter table public.strategy_intake_plans enable row level security;
alter table public.strategy_activities enable row level security;
alter table public.strategy_audit_events enable row level security;

-- Match existing CRM access boundaries. No broad public policies are created.
drop policy if exists strategy_plans_read on public.strategy_plans;
create policy strategy_plans_read on public.strategy_plans
  for select to authenticated using (private.is_marketing_or_admin_manager());

drop policy if exists strategy_plans_insert on public.strategy_plans;
create policy strategy_plans_insert on public.strategy_plans
  for insert to authenticated with check (private.is_marketing_or_admin_manager());

drop policy if exists strategy_plans_update on public.strategy_plans;
create policy strategy_plans_update on public.strategy_plans
  for update to authenticated
  using (private.is_marketing_or_admin_manager())
  with check (private.is_marketing_or_admin_manager());

drop policy if exists strategy_objectives_access on public.strategy_objectives;
create policy strategy_objectives_access on public.strategy_objectives
  for all to authenticated
  using (exists (select 1 from public.strategy_plans p where p.id = plan_id and private.is_marketing_or_admin_manager()))
  with check (exists (select 1 from public.strategy_plans p where p.id = plan_id and private.is_marketing_or_admin_manager()));

drop policy if exists strategy_intake_plans_access on public.strategy_intake_plans;
create policy strategy_intake_plans_access on public.strategy_intake_plans
  for all to authenticated
  using (exists (select 1 from public.strategy_plans p where p.id = plan_id and private.is_marketing_or_admin_manager()))
  with check (exists (select 1 from public.strategy_plans p where p.id = plan_id and private.is_marketing_or_admin_manager()));

drop policy if exists strategy_activities_access on public.strategy_activities;
create policy strategy_activities_access on public.strategy_activities
  for all to authenticated
  using (exists (select 1 from public.strategy_plans p where p.id = plan_id and private.is_marketing_or_admin_manager()))
  with check (exists (select 1 from public.strategy_plans p where p.id = plan_id and private.is_marketing_or_admin_manager()));

drop policy if exists strategy_audit_events_read on public.strategy_audit_events;
create policy strategy_audit_events_read on public.strategy_audit_events
  for select to authenticated using (private.is_marketing_or_admin_manager());

drop policy if exists strategy_audit_events_insert on public.strategy_audit_events;
create policy strategy_audit_events_insert on public.strategy_audit_events
  for insert to authenticated with check (private.is_marketing_or_admin_manager());

comment on table public.strategy_plans is 'Annual CIU Strategy & Planning records; calendar-year plans.';
comment on table public.strategy_intake_plans is 'Four intake-level targets grouped into February and August recruitment cycles.';
comment on table public.strategy_audit_events is 'Append-only audit history for strategy decisions and authorised corrections.';
