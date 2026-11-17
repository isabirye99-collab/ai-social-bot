create table if not exists public.school_student_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_name text not null,
  contact text not null,
  email text,
  program text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_student_contacts_school_id_idx
  on public.school_student_contacts(school_id);
create index if not exists school_student_contacts_student_name_idx
  on public.school_student_contacts(lower(student_name));

alter table public.school_student_contacts enable row level security;

drop policy if exists "Authenticated staff can view school student contacts" on public.school_student_contacts;
create policy "Authenticated staff can view school student contacts"
  on public.school_student_contacts for select to authenticated using (true);

drop policy if exists "Authenticated staff can add school student contacts" on public.school_student_contacts;
create policy "Authenticated staff can add school student contacts"
  on public.school_student_contacts for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Authenticated staff can update school student contacts" on public.school_student_contacts;
create policy "Authenticated staff can update school student contacts"
  on public.school_student_contacts for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can delete school student contacts" on public.school_student_contacts;
create policy "Authenticated staff can delete school student contacts"
  on public.school_student_contacts for delete to authenticated using (true);

grant select, insert, update, delete on public.school_student_contacts to authenticated;
