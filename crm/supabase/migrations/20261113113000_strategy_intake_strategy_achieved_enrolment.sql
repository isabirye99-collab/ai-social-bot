-- Add narrative intake strategies and actual enrolled-student tracking.
alter table public.strategy_intake_plans
  add column if not exists intake_strategy text,
  add column if not exists achieved_registrations integer not null default 0
    check (achieved_registrations >= 0);

-- Preserve the combined targets from existing programme-specific rows without
-- deleting or modifying those original rows.
insert into public.strategy_intake_plans
  (plan_id, intake_month, cycle, programme, target_applications, target_admissions, target_registrations)
select
  plan_id,
  intake_month,
  case when intake_month in (2, 4) then 'february' else 'august' end,
  'All programmes',
  sum(target_applications)::integer,
  sum(target_admissions)::integer,
  sum(target_registrations)::integer
from public.strategy_intake_plans
where programme <> 'All programmes'
group by plan_id, intake_month
on conflict (plan_id, intake_month, programme) do nothing;
