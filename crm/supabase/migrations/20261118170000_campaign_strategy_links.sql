-- Connect marketing execution to CIU Strategy & Planning.
-- Nullable links preserve all existing campaign records and workflows.
alter table public.campaigns
  add column if not exists intake_plan_id uuid references public.strategy_intake_plans(id) on delete set null,
  add column if not exists activity_id uuid references public.strategy_activities(id) on delete set null;

create index if not exists campaigns_intake_plan_id_idx
  on public.campaigns(intake_plan_id);
create index if not exists campaigns_activity_id_idx
  on public.campaigns(activity_id);
