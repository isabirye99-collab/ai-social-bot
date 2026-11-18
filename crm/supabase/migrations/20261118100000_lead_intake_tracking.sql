-- Intake tracking for CIU leads. Keep initial intake and a full audit trail when leads move cycles.
alter table public.leads
  add column if not exists intake_year smallint,
  add column if not exists intake_month smallint,
  add column if not exists original_intake_year smallint,
  add column if not exists original_intake_month smallint,
  add column if not exists intake_changed_at timestamptz,
  add column if not exists intake_changed_by uuid references auth.users(id) on delete set null;

alter table public.leads
  drop constraint if exists leads_intake_month_check,
  add constraint leads_intake_month_check check (intake_month is null or intake_month in (2,4,8,11)),
  drop constraint if exists leads_original_intake_month_check,
  add constraint leads_original_intake_month_check check (original_intake_month is null or original_intake_month in (2,4,8,11));

create index if not exists leads_intake_cycle_idx on public.leads(intake_year, intake_month);
create index if not exists leads_intake_programme_idx on public.leads(intake_year, intake_month, lower(product_service));

create table if not exists public.lead_intake_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_intake_year smallint,
  previous_intake_month smallint,
  new_intake_year smallint not null,
  new_intake_month smallint not null check (new_intake_month in (2,4,8,11)),
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists lead_intake_history_lead_idx on public.lead_intake_history(lead_id, changed_at desc);
alter table public.lead_intake_history enable row level security;
drop policy if exists "Authenticated staff read lead intake history" on public.lead_intake_history;
create policy "Authenticated staff read lead intake history" on public.lead_intake_history for select to authenticated using (true);
drop policy if exists "Authenticated staff record lead intake changes" on public.lead_intake_history;
create policy "Authenticated staff record lead intake changes" on public.lead_intake_history for insert to authenticated with check (true);
grant select, insert on public.lead_intake_history to authenticated;

-- Initial intake classification for records with a known programme only.
-- November 2026 is reserved for PGDME, MPH and HEC/allied-health programmes.
-- Other known programmes default to February 2027. Records with no programme remain unassigned for staff review.
update public.leads
set intake_year = case
      when upper(trim(coalesce(product_service,''))) in ('PGDME','MPH')
        or upper(trim(coalesce(product_service,''))) like 'HEC%'
        or upper(trim(coalesce(product_service,''))) like '%ALLIED HEALTH%'
      then 2026 else 2027 end,
    intake_month = case
      when upper(trim(coalesce(product_service,''))) in ('PGDME','MPH')
        or upper(trim(coalesce(product_service,''))) like 'HEC%'
        or upper(trim(coalesce(product_service,''))) like '%ALLIED HEALTH%'
      then 11 else 2 end,
    original_intake_year = case
      when upper(trim(coalesce(product_service,''))) in ('PGDME','MPH')
        or upper(trim(coalesce(product_service,''))) like 'HEC%'
        or upper(trim(coalesce(product_service,''))) like '%ALLIED HEALTH%'
      then 2026 else 2027 end,
    original_intake_month = case
      when upper(trim(coalesce(product_service,''))) in ('PGDME','MPH')
        or upper(trim(coalesce(product_service,''))) like 'HEC%'
        or upper(trim(coalesce(product_service,''))) like '%ALLIED HEALTH%'
      then 11 else 2 end
where intake_year is null and nullif(trim(product_service),'') is not null;
