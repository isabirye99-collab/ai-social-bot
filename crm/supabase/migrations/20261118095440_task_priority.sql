-- Add an explicit task priority for the Tasks & Follow-ups work queue.
-- Additive and safe for existing records: all current tasks default to medium.
alter table public.tasks
  add column if not exists priority text not null default 'medium';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_priority_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_priority_check
      check (priority in ('high', 'medium', 'low'));
  end if;
end
$$;

create index if not exists tasks_priority_due_at_idx
  on public.tasks (priority, due_at)
  where status not in ('completed', 'cancelled');
