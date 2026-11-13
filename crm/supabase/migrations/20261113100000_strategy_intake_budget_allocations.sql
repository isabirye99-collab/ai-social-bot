create table if not exists public.strategy_intake_budget_allocations (
  id uuid primary key default gen_random_uuid(),
  intake_plan_id uuid not null references public.strategy_intake_plans(id) on delete cascade,
  budget_item_id uuid not null references public.strategy_budget_items(id) on delete cascade,
  activity_id uuid references public.strategy_activities(id) on delete set null,
  allocated_amount numeric(14,2) not null default 0 check (allocated_amount >= 0),
  actual_spent numeric(14,2) not null default 0 check (actual_spent >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_intake_budget_allocations_intake_idx on public.strategy_intake_budget_allocations(intake_plan_id);
create index if not exists strategy_intake_budget_allocations_budget_item_idx on public.strategy_intake_budget_allocations(budget_item_id);
create index if not exists strategy_intake_budget_allocations_activity_idx on public.strategy_intake_budget_allocations(activity_id);
alter table public.strategy_intake_budget_allocations enable row level security;
drop policy if exists strategy_intake_budget_allocations_strategy_staff on public.strategy_intake_budget_allocations;
create policy strategy_intake_budget_allocations_strategy_staff on public.strategy_intake_budget_allocations
 for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
