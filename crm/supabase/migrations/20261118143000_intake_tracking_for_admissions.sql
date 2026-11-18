-- Persist intake on customer/admission records as well as their linked leads.
alter table public.admissions
  add column if not exists intake_year smallint,
  add column if not exists intake_month smallint;

alter table public.admissions
  drop constraint if exists admissions_intake_month_check,
  add constraint admissions_intake_month_check check (intake_month is null or intake_month in (2,4,8,11));

create index if not exists admissions_intake_cycle_idx on public.admissions(intake_year, intake_month);

update public.admissions a
set intake_year = l.intake_year,
    intake_month = l.intake_month
from public.leads l
where a.lead_id = l.id
  and (a.intake_year is null or a.intake_month is null)
  and l.intake_year is not null
  and l.intake_month is not null;
