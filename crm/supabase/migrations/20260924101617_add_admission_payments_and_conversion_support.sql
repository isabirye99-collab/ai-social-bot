create table if not exists public.admission_payments (
    id uuid primary key default gen_random_uuid(),
    admission_id uuid not null references public.admissions(id) on delete cascade,
    payment_type text not null,
    amount numeric(14,2) not null default 0,
    payment_date date not null default current_date,
    reference text,
    notes text,
    recorded_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint admission_payments_type_check check (payment_type in ('Application','Acceptance','Tuition')),
    constraint admission_payments_amount_check check (amount > 0)
  );

  create index if not exists admission_payments_admission_idx
    on public.admission_payments(admission_id);

  create index if not exists admission_payments_date_idx
    on public.admission_payments(payment_date);

  alter table public.admission_payments enable row level security;

  drop policy if exists admission_payments_read on public.admission_payments;
  create policy admission_payments_read on public.admission_payments
    for select to authenticated using (true);

  drop policy if exists admission_payments_write on public.admission_payments;
  create policy admission_payments_write on public.admission_payments
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
    );;
