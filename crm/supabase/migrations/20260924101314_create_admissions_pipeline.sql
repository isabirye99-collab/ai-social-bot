create table if not exists public.admissions (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid unique references public.leads(id) on delete set null,
    contact_id uuid references public.contacts(id) on delete set null,
    ciu_number text,
    full_names text not null,
    telephone text,
    email text,
    program text not null,
    program_category text not null default 'Bachelor',
    stage text not null default 'New',
    application_fee numeric(14,2) not null default 0,
    application_paid numeric(14,2) not null default 0,
    acceptance_fee numeric(14,2) not null default 0,
    acceptance_paid numeric(14,2) not null default 0,
    tuition_fee numeric(14,2) not null default 0,
    tuition_paid numeric(14,2) not null default 0,
    assigned_to uuid references public.profiles(id) on delete set null,
    follow_up_date date,
    source text,
    last_contact date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint admissions_stage_check check (stage in ('New','Contacted','Qualified','Application Started','Application Submitted','Admitted','Acceptance Paid','Enrolled','Lost/Dropped')),
    constraint admissions_category_check check (program_category in ('HEC','Diploma','Bachelor','Postgraduate')),
    constraint admissions_nonnegative_fees check (
      application_fee >= 0 and application_paid >= 0 and
      acceptance_fee >= 0 and acceptance_paid >= 0 and
      tuition_fee >= 0 and tuition_paid >= 0
    )
  );

  create unique index if not exists admissions_ciu_number_unique_idx
    on public.admissions(ciu_number)
    where ciu_number is not null and btrim(ciu_number) <> '';

  create index if not exists admissions_stage_idx on public.admissions(stage);
  create index if not exists admissions_assigned_to_idx on public.admissions(assigned_to);
  create index if not exists admissions_follow_up_date_idx on public.admissions(follow_up_date);

  alter table public.admissions enable row level security;

  drop policy if exists admissions_read on public.admissions;
  create policy admissions_read on public.admissions
    for select to authenticated
    using (true);

  drop policy if exists admissions_write on public.admissions;
  create policy admissions_write on public.admissions
    for all to authenticated
    using (is_admin_or_manager() or assigned_to = auth.uid())
    with check (is_admin_or_manager() or assigned_to = auth.uid());

  create or replace function public.set_admissions_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

  drop trigger if exists admissions_updated_at on public.admissions;
  create trigger admissions_updated_at
    before update on public.admissions
    for each row execute function public.set_admissions_updated_at();;
