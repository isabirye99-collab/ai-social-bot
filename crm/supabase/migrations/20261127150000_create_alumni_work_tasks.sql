-- Alumni Relations daily work tracking. Additive only; does not modify existing alumni records.
create table if not exists public.alumni_work_tasks (
  id uuid primary key default gen_random_uuid(),
  alumni_id uuid references public.alumni(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  task_type text not null default 'follow_up' check (task_type in ('call','email','meeting','profile_review','event_follow_up','mentorship','referral','follow_up','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  due_date date,
  outcome text,
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_alumni_work_tasks_assigned_due on public.alumni_work_tasks(assigned_to, due_date, status);
create index if not exists idx_alumni_work_tasks_alumni on public.alumni_work_tasks(alumni_id, created_at desc);
alter table public.alumni_work_tasks enable row level security;
drop policy if exists alumni_work_tasks_read on public.alumni_work_tasks;
create policy alumni_work_tasks_read on public.alumni_work_tasks for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('super_admin','admin','manager')) or assigned_to = auth.uid() or created_by = auth.uid());
drop policy if exists alumni_work_tasks_insert on public.alumni_work_tasks;
create policy alumni_work_tasks_insert on public.alumni_work_tasks for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('super_admin','admin','manager')) or created_by = auth.uid());
drop policy if exists alumni_work_tasks_update on public.alumni_work_tasks;
create policy alumni_work_tasks_update on public.alumni_work_tasks for update to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('super_admin','admin','manager')) or assigned_to = auth.uid() or created_by = auth.uid())
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('super_admin','admin','manager')) or assigned_to = auth.uid() or created_by = auth.uid());