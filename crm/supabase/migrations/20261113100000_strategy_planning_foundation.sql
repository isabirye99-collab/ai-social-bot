-- Strategy & Planning foundation schema for the CIU CRM.
-- Safe to apply to an existing CRM: creates missing tables and indexes only.
-- Access is limited to authenticated staff with Strategy module access or management roles.

create schema if not exists private;

create or replace function private.is_strategy_staff()
returns boolean
language sql
stable
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (
        p.role::text in ('super_admin', 'admin', 'manager')
        or coalesce(p.module_permissions, '{}'::text[]) @> array['strategy']::text[]
      )
  );
$function$;

revoke all on function private.is_strategy_staff() from public;
grant execute on function private.is_strategy_staff() to authenticated;

create table if not exists public.strategy_plans (
  id uuid primary key default gen_random_uuid(),
  strategy_year integer not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','returned','archived')),
  summary text,
  prepared_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_objectives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  title text not null,
  description text,
  target_value numeric,
  actual_value numeric not null default 0,
  unit text not null default 'items',
  status text not null default 'not_started' check (status in ('not_started','in_progress','at_risk','completed','on_hold')),
  due_date date,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_intake_plans (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  intake_month integer not null check (intake_month between 1 and 12),
  cycle text,
  programme text not null,
  target_applications integer not null default 0 check (target_applications >= 0),
  target_admissions integer not null default 0 check (target_admissions >= 0),
  target_registrations integer not null default 0 check (target_registrations >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, intake_month, programme)
);

create table if not exists public.strategy_activities (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  title text not null,
  description text,
  activity_type text not null default 'general',
  starts_on date,
  ends_on date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','on_hold','cancelled')),
  budget_amount numeric(14,2) not null default 0 check (budget_amount >= 0),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_annual_budgets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  proposed_amount numeric(14,2) not null default 0 check (proposed_amount >= 0),
  approved_amount numeric(14,2),
  status text not null default 'pending_approval' check (status in ('draft','pending_approval','approved','returned','rejected')),
  notes text,
  prepared_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_risks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','resolved')),
  corrective_action text,
  due_date date,
  programme text,
  owner_id uuid references public.profiles(id) on delete set null,
  raised_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.strategy_plans(id) on delete set null,
  reporting_start date not null,
  reporting_end date not null,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  completed_work text not null default '',
  recruitment_outcomes jsonb not null default '{}'::jsonb,
  challenges text,
  next_week_plan text,
  status text not null default 'submitted' check (status in ('draft','submitted','reviewed','approved','returned')),
  submitted_at timestamptz,
  reviewer_comments text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporting_end >= reporting_start),
  unique(staff_id, reporting_start, reporting_end)
);

create table if not exists public.strategy_approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','returned','rejected')),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id) on delete set null,
  decision_comment text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_meetings (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.strategy_plans(id) on delete set null,
  meeting_at timestamptz not null,
  title text not null,
  minutes text,
  decisions text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_meeting_actions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.strategy_meetings(id) on delete cascade,
  action text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_cycle_allocations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  cycle text not null,
  proposed_amount numeric(14,2) not null default 0 check (proposed_amount >= 0),
  approved_amount numeric(14,2),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','returned','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, cycle)
);

create table if not exists public.strategy_report_history (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  report_type text not null,
  reporting_start date,
  reporting_end date,
  version integer not null default 1,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  provider_status text,
  provider_message_id text,
  recipients jsonb not null default '[]'::jsonb,
  unique(plan_id, report_type, version)
);

create table if not exists public.strategy_approval_decision_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.strategy_approval_requests(id) on delete cascade,
  previous_status text,
  decision text not null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_comment text,
  decided_at timestamptz not null default now()
);

create index if not exists strategy_objectives_plan_id_idx on public.strategy_objectives(plan_id);
create index if not exists strategy_activities_plan_id_idx on public.strategy_activities(plan_id);
create index if not exists strategy_activities_owner_id_idx on public.strategy_activities(owner_id);
create index if not exists strategy_intake_plans_plan_month_idx on public.strategy_intake_plans(plan_id, intake_month);
create index if not exists strategy_annual_budgets_plan_id_idx on public.strategy_annual_budgets(plan_id);
create index if not exists strategy_risks_plan_status_idx on public.strategy_risks(plan_id, status);
create index if not exists strategy_risks_owner_id_idx on public.strategy_risks(owner_id);
create index if not exists strategy_weekly_reports_staff_period_idx on public.strategy_weekly_reports(staff_id, reporting_start desc);
create index if not exists strategy_approval_requests_submitted_at_idx on public.strategy_approval_requests(submitted_at desc);
create index if not exists strategy_meetings_meeting_at_idx on public.strategy_meetings(meeting_at desc);
create index if not exists strategy_meeting_actions_due_date_idx on public.strategy_meeting_actions(due_date);
create index if not exists strategy_cycle_allocations_plan_cycle_idx on public.strategy_cycle_allocations(plan_id, cycle);
create index if not exists strategy_report_history_plan_created_idx on public.strategy_report_history(plan_id, created_at desc);
create index if not exists strategy_approval_decision_history_decided_idx on public.strategy_approval_decision_history(decided_at desc);

alter table public.strategy_plans enable row level security;
alter table public.strategy_objectives enable row level security;
alter table public.strategy_intake_plans enable row level security;
alter table public.strategy_activities enable row level security;
alter table public.strategy_annual_budgets enable row level security;
alter table public.strategy_risks enable row level security;
alter table public.strategy_weekly_reports enable row level security;
alter table public.strategy_approval_requests enable row level security;
alter table public.strategy_meetings enable row level security;
alter table public.strategy_meeting_actions enable row level security;
alter table public.strategy_cycle_allocations enable row level security;
alter table public.strategy_report_history enable row level security;
alter table public.strategy_approval_decision_history enable row level security;

grant select, insert, update, delete on public.strategy_plans to authenticated;
grant select, insert, update, delete on public.strategy_objectives to authenticated;
grant select, insert, update, delete on public.strategy_intake_plans to authenticated;
grant select, insert, update, delete on public.strategy_activities to authenticated;
grant select, insert, update, delete on public.strategy_annual_budgets to authenticated;
grant select, insert, update, delete on public.strategy_risks to authenticated;
grant select, insert, update, delete on public.strategy_weekly_reports to authenticated;
grant select, insert, update, delete on public.strategy_approval_requests to authenticated;
grant select, insert, update, delete on public.strategy_meetings to authenticated;
grant select, insert, update, delete on public.strategy_meeting_actions to authenticated;
grant select, insert, update, delete on public.strategy_cycle_allocations to authenticated;
grant select, insert, update, delete on public.strategy_report_history to authenticated;
grant select, insert, update, delete on public.strategy_approval_decision_history to authenticated;

drop policy if exists strategy_plans_staff_access on public.strategy_plans;
create policy strategy_plans_staff_access on public.strategy_plans for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_objectives_staff_access on public.strategy_objectives;
create policy strategy_objectives_staff_access on public.strategy_objectives for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_intake_plans_staff_access on public.strategy_intake_plans;
create policy strategy_intake_plans_staff_access on public.strategy_intake_plans for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_activities_staff_access on public.strategy_activities;
create policy strategy_activities_staff_access on public.strategy_activities for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_annual_budgets_staff_access on public.strategy_annual_budgets;
create policy strategy_annual_budgets_staff_access on public.strategy_annual_budgets for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_risks_staff_access on public.strategy_risks;
create policy strategy_risks_staff_access on public.strategy_risks for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_weekly_reports_staff_access on public.strategy_weekly_reports;
create policy strategy_weekly_reports_staff_access on public.strategy_weekly_reports for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_approval_requests_staff_access on public.strategy_approval_requests;
create policy strategy_approval_requests_staff_access on public.strategy_approval_requests for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_meetings_staff_access on public.strategy_meetings;
create policy strategy_meetings_staff_access on public.strategy_meetings for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_meeting_actions_staff_access on public.strategy_meeting_actions;
create policy strategy_meeting_actions_staff_access on public.strategy_meeting_actions for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_cycle_allocations_staff_access on public.strategy_cycle_allocations;
create policy strategy_cycle_allocations_staff_access on public.strategy_cycle_allocations for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_report_history_staff_access on public.strategy_report_history;
create policy strategy_report_history_staff_access on public.strategy_report_history for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_approval_decision_history_staff_access on public.strategy_approval_decision_history;
create policy strategy_approval_decision_history_staff_access on public.strategy_approval_decision_history for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
