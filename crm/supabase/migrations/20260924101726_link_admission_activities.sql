alter table public.activities
    add column if not exists admission_id uuid references public.admissions(id) on delete cascade;

  create index if not exists activities_admission_idx
    on public.activities(admission_id);;
