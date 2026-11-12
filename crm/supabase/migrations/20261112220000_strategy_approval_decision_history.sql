-- Immutable decision history for the Strategy Approvals Centre.
-- Additive only: existing approval requests and CRM data remain intact.

create table if not exists public.strategy_approval_decision_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.strategy_approval_requests(id) on delete restrict,
  previous_status text not null,
  decision text not null check (decision in ('approved','rejected','returned_for_revision','escalated')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_comment text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists strategy_approval_decisions_request_idx
  on public.strategy_approval_decision_history(request_id, decided_at desc);

create index if not exists strategy_approval_decisions_reviewer_idx
  on public.strategy_approval_decision_history(reviewer_id, decided_at desc);

alter table public.strategy_approval_decision_history enable row level security;

drop policy if exists strategy_approval_decision_history_read on public.strategy_approval_decision_history;
create policy strategy_approval_decision_history_read
  on public.strategy_approval_decision_history
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.is_active = true
        and pr.role in ('super_admin','admin','manager','marketing')
        and (pr.role = 'super_admin' or pr.module_permissions is null
          or pr.module_permissions @> '["strategy"]'::jsonb)
    )
  );

-- Clients cannot forge, edit, or erase decisions. The trigger writes history
-- using the trusted function owner, while readers remain subject to RLS.
revoke insert, update, delete, truncate, references, trigger
  on table public.strategy_approval_decision_history from anon, authenticated;

create or replace function public.strategy_record_approval_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved','rejected','returned_for_revision','escalated') then
    insert into public.strategy_approval_decision_history (
      request_id, previous_status, decision, reviewer_id, reviewer_comment, decided_at
    ) values (
      new.id, old.status, new.status, new.decided_by,
      new.decision_comment, coalesce(new.decided_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists strategy_approval_decision_history_capture
  on public.strategy_approval_requests;
create trigger strategy_approval_decision_history_capture
  after update of status on public.strategy_approval_requests
  for each row execute function public.strategy_record_approval_decision();

revoke execute on function public.strategy_record_approval_decision() from public, anon, authenticated;

comment on table public.strategy_approval_decision_history is
  'Append-only decision history for Strategy approval requests, including reviewer identity, decision and timestamp.';
