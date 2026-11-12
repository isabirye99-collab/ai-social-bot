-- CIU Strategy & Planning: budget, approvals, risks, reporting and notification records.
-- Additive migration. Does not alter or delete existing CRM tables or records.

create table if not exists public.strategy_annual_budgets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.strategy_plans(id) on delete cascade,
  proposed_amount numeric not null default 0 check (proposed_amount >= 0),
  approved_amount numeric check (approved_amount is null or approved_amount >= 0),
  currency text not null default 'UGX',
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','returned_for_revision','rejected')),
  prepared_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_cycle_allocations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  cycle text not null check (cycle in ('february','august')),
  proposed_amount numeric not null default 0 check (proposed_amount >= 0),
  approved_amount numeric check (approved_amount is null or approved_amount >= 0),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','returned_for_revision','rejected')),
  submitted_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, cycle)
);

create table if not exists public.strategy_activity_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.strategy_activities(id) on delete cascade,
  programme text not null,
  intake_month integer check (intake_month in (2,4,8,11)),
  planned_amount numeric not null default 0 check (planned_amount >= 0),
  committed_amount numeric not null default 0 check (committed_amount >= 0),
  finance_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id, programme, intake_month)
);

create table if not exists public.strategy_approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('annual_strategy','annual_budget','cycle_allocation','strategy_change','budget_reallocation','additional_funding','risk_escalation','report')),
  entity_type text not null,
  entity_id uuid,
  title text not null,
  reason text not null,
  previous_values jsonb not null default '{}'::jsonb,
  proposed_values jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','returned_for_revision','escalated')),
  submitted_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_comment text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_risks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'pending' check (status in ('pending','in_progress','overdue','resolved')),
  objective_id uuid references public.strategy_objectives(id) on delete set null,
  activity_id uuid references public.strategy_activities(id) on delete set null,
  intake_month integer check (intake_month in (2,4,8,11)),
  programme text,
  corrective_action text,
  action_owner uuid references public.profiles(id) on delete set null,
  due_date date,
  resolved_at timestamptz,
  outcome_notes text,
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
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','reviewed','returned_for_revision','approved')),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporting_end >= reporting_start),
  unique(staff_id, reporting_start, reporting_end)
);

create table if not exists public.strategy_meetings (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.strategy_plans(id) on delete set null,
  meeting_at timestamptz not null,
  title text not null default 'Weekly Marketing Meeting',
  minutes text not null default '',
  decisions jsonb not null default '[]'::jsonb,
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
  status text not null default 'pending' check (status in ('pending','in_progress','completed','overdue','cancelled')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_report_recipients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email)
);

create table if not exists public.strategy_report_history (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.strategy_plans(id) on delete set null,
  report_type text not null,
  reporting_start date,
  reporting_end date,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','reviewed','approved','sent','failed')),
  snapshot jsonb not null default '{}'::jsonb,
  storage_path text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  recipients jsonb not null default '[]'::jsonb,
  provider_status text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique(report_type, reporting_start, reporting_end, version)
);

create table if not exists public.strategy_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  channel text not null default 'in_app' check (channel in ('in_app','email')),
  status text not null default 'pending' check (status in ('pending','sent','failed','read')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists strategy_approvals_queue_idx on public.strategy_approval_requests(status, submitted_at desc);
create index if not exists strategy_risks_attention_idx on public.strategy_risks(priority, status, due_date);
create index if not exists strategy_weekly_reports_period_idx on public.strategy_weekly_reports(reporting_start desc, status);
create index if not exists strategy_meeting_actions_due_idx on public.strategy_meeting_actions(status, due_date);
create index if not exists strategy_report_history_period_idx on public.strategy_report_history(report_type, reporting_end desc);
create index if not exists strategy_notifications_recipient_idx on public.strategy_notifications(recipient_id, status, created_at desc);

alter table public.strategy_annual_budgets enable row level security;
alter table public.strategy_cycle_allocations enable row level security;
alter table public.strategy_activity_cost_allocations enable row level security;
alter table public.strategy_approval_requests enable row level security;
alter table public.strategy_risks enable row level security;
alter table public.strategy_weekly_reports enable row level security;
alter table public.strategy_meetings enable row level security;
alter table public.strategy_meeting_actions enable row level security;
alter table public.strategy_report_recipients enable row level security;
alter table public.strategy_report_history enable row level security;
alter table public.strategy_notifications enable row level security;

-- Module access is required for all Strategy data. Staff weekly reports and
-- notifications are restricted to their own records unless management access applies.
create policy strategy_budgets_access on public.strategy_annual_budgets for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_cycle_allocations_access on public.strategy_cycle_allocations for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_cost_allocations_access on public.strategy_activity_cost_allocations for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_approvals_read on public.strategy_approval_requests for select to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));
create policy strategy_approvals_submit on public.strategy_approval_requests for insert to authenticated
with check (submitted_by = auth.uid() and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));
create policy strategy_approvals_decide on public.strategy_approval_requests for update to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager')))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager')));

create policy strategy_risks_access on public.strategy_risks for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_weekly_reports_read on public.strategy_weekly_reports for select to authenticated
using (staff_id = auth.uid() or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));
create policy strategy_weekly_reports_insert on public.strategy_weekly_reports for insert to authenticated
with check (staff_id = auth.uid());
create policy strategy_weekly_reports_update on public.strategy_weekly_reports for update to authenticated
using (staff_id = auth.uid() or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (staff_id = auth.uid() or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_meetings_access on public.strategy_meetings for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_meeting_actions_access on public.strategy_meeting_actions for all to authenticated
using (exists (select 1 from public.strategy_meetings m join public.profiles pr on pr.id = auth.uid() where m.id = meeting_id and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.strategy_meetings m join public.profiles pr on pr.id = auth.uid() where m.id = meeting_id and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_recipients_access on public.strategy_report_recipients for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_report_history_access on public.strategy_report_history for all to authenticated
using (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)))
with check (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager','marketing') and (pr.role = 'super_admin' or pr.module_permissions is null or pr.module_permissions @> '["strategy"]'::jsonb)));

create policy strategy_notifications_own on public.strategy_notifications for all to authenticated
using (recipient_id = auth.uid() or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager')))
with check (recipient_id = auth.uid() or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('super_admin','admin','manager')));
