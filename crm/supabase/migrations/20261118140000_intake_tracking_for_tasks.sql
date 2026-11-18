-- Tasks inherit and retain the recruitment intake to keep follow-up work reportable.
alter table public.tasks
  add column if not exists intake_year smallint,
  add column if not exists intake_month smallint;

alter table public.tasks
  drop constraint if exists tasks_intake_month_check,
  add constraint tasks_intake_month_check check (intake_month is null or intake_month in (2,4,8,11));

create index if not exists tasks_intake_cycle_idx on public.tasks(intake_year, intake_month);

update public.tasks t
set intake_year = l.intake_year,
    intake_month = l.intake_month
from public.leads l
where t.lead_id = l.id
  and (t.intake_year is null or t.intake_month is null)
  and l.intake_year is not null
  and l.intake_month is not null;
