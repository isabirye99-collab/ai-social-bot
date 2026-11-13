alter table public.strategy_plans add column if not exists strategy_period text;

create table if not exists public.strategy_framework_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  strategic_pillar text not null default '',
  objectives text not null default '',
  key_activities text not null default '',
  channels_tools text not null default '',
  kpis_targets text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_intake_strategy_entries (
  id uuid primary key default gen_random_uuid(),
  intake_plan_id uuid not null references public.strategy_intake_plans(id) on delete cascade,
  source_framework_entry_id uuid references public.strategy_framework_entries(id) on delete set null,
  strategic_pillar text not null default '',
  objectives text not null default '',
  key_activities text not null default '',
  channels_tools text not null default '',
  kpis_targets text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategy_framework_entries_plan_idx on public.strategy_framework_entries(plan_id, sort_order);
create index if not exists strategy_intake_strategy_entries_intake_idx on public.strategy_intake_strategy_entries(intake_plan_id);
alter table public.strategy_framework_entries enable row level security;
alter table public.strategy_intake_strategy_entries enable row level security;
grant select, insert, update, delete on public.strategy_framework_entries to authenticated;
grant select, insert, update, delete on public.strategy_intake_strategy_entries to authenticated;
drop policy if exists strategy_framework_entries_staff_access on public.strategy_framework_entries;
create policy strategy_framework_entries_staff_access on public.strategy_framework_entries for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
drop policy if exists strategy_intake_strategy_entries_staff_access on public.strategy_intake_strategy_entries;
create policy strategy_intake_strategy_entries_staff_access on public.strategy_intake_strategy_entries for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());