
alter table public.activities
  add column if not exists admission_id uuid references public.admissions(id) on delete cascade;

create index if not exists activities_admission_id_idx
  on public.activities(admission_id);

create table if not exists public.admission_payments (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions(id) on delete cascade,
  payment_type text not null default 'Tuition'
    check (payment_type in ('Application','Acceptance','Tuition','Other')),
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  reference text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admission_payments_admission_id_idx
  on public.admission_payments(admission_id);
create index if not exists admission_payments_payment_date_idx
  on public.admission_payments(payment_date);

alter table public.admission_payments enable row level security;

drop policy if exists admission_payments_read on public.admission_payments;
create policy admission_payments_read
  on public.admission_payments
  for select to authenticated
  using (true);

drop policy if exists admission_payments_write on public.admission_payments;
create policy admission_payments_write
  on public.admission_payments
  for all to authenticated
  using (
    is_admin_or_manager()
    or exists (
      select 1 from public.admissions a
      where a.id = admission_payments.admission_id
        and a.assigned_to = auth.uid()
    )
  )
  with check (
    is_admin_or_manager()
    or exists (
      select 1 from public.admissions a
      where a.id = admission_payments.admission_id
        and a.assigned_to = auth.uid()
    )
  );

drop policy if exists activities_admission_read on public.activities;
create policy activities_admission_read
  on public.activities
  for select to authenticated
  using (true);

drop policy if exists activities_admission_write on public.activities;
create policy activities_admission_write
  on public.activities
  for insert to authenticated
  with check (
    is_admin_or_manager()
    or created_by = auth.uid()
    or exists (
      select 1 from public.admissions a
      where a.id = activities.admission_id
        and a.assigned_to = auth.uid()
    )
  );
;
