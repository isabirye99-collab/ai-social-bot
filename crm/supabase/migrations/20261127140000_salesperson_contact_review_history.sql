-- Persistent, append-only management decisions for leads flagged after repeated unanswered calls.
-- Additive only: does not alter existing lead or interaction records.
create table if not exists public.lead_contact_review_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  trigger_interaction_id uuid not null references public.engagement_interactions(id) on delete restrict,
  decision text not null check (decision in ('retain', 'reassign', 'other_action')),
  notes text not null,
  new_assigned_to uuid references auth.users(id) on delete restrict,
  decided_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  decided_at timestamptz not null default now(),
  constraint lead_contact_review_reassign_assignee_check
    check ((decision = 'reassign' and new_assigned_to is not null) or (decision <> 'reassign' and new_assigned_to is null))
);

create index if not exists lead_contact_review_history_lead_decided_idx
  on public.lead_contact_review_history(lead_id, decided_at desc);
create index if not exists lead_contact_review_history_interaction_idx
  on public.lead_contact_review_history(trigger_interaction_id, decided_at desc);

alter table public.lead_contact_review_history enable row level security;

drop policy if exists "Management can read lead contact review history" on public.lead_contact_review_history;
create policy "Management can read lead contact review history"
  on public.lead_contact_review_history
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

-- All decisions go through the checked RPC so reassignment and its audit record are atomic.
revoke all on public.lead_contact_review_history from anon, authenticated;
grant select on public.lead_contact_review_history to authenticated;

create or replace function public.record_lead_contact_review_decision(
  p_lead_id uuid,
  p_trigger_interaction_id uuid,
  p_decision text,
  p_notes text,
  p_new_assigned_to uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_interaction_lead_id uuid;
  v_new_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.is_active = true;

  if v_role is null or v_role not in ('super_admin', 'admin', 'manager') then
    raise exception 'Only active management users may record lead review decisions';
  end if;

  if p_decision not in ('retain', 'reassign', 'other_action') then
    raise exception 'Choose a valid management review decision';
  end if;

  if nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'A review note is required for the audit trail';
  end if;

  select i.lead_id into v_interaction_lead_id
  from public.engagement_interactions i
  where i.id = p_trigger_interaction_id;

  if not found or v_interaction_lead_id is distinct from p_lead_id then
    raise exception 'The review trigger interaction does not match this lead';
  end if;

  perform 1 from public.leads l where l.id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found';
  end if;

  if p_decision = 'reassign' then
    if p_new_assigned_to is null then
      raise exception 'Choose an active salesperson for reassignment';
    end if;
    perform 1 from public.profiles p
    where p.id = p_new_assigned_to
      and p.is_active = true
      and p.role = 'salesperson';
    if not found then
      raise exception 'The selected assignee is not an active salesperson';
    end if;

    update public.leads
    set assigned_to = p_new_assigned_to,
        updated_at = now()
    where id = p_lead_id;
  elsif p_new_assigned_to is not null then
    raise exception 'A new assignee is only allowed for a reassign decision';
  end if;

  insert into public.lead_contact_review_history
    (lead_id, trigger_interaction_id, decision, notes, new_assigned_to, decided_by)
  values
    (p_lead_id, p_trigger_interaction_id, p_decision, trim(p_notes), p_new_assigned_to, v_actor)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.record_lead_contact_review_decision(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.record_lead_contact_review_decision(uuid, uuid, text, text, uuid) to authenticated;

create or replace function public.prevent_lead_contact_review_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'Lead contact review history is append-only; record a new decision instead';
end;
$$;

drop trigger if exists lead_contact_review_history_append_only on public.lead_contact_review_history;
create trigger lead_contact_review_history_append_only
before update or delete on public.lead_contact_review_history
for each row execute function public.prevent_lead_contact_review_history_mutation();

revoke execute on function public.prevent_lead_contact_review_history_mutation() from public, anon, authenticated;

comment on table public.lead_contact_review_history is
  'Append-only management audit history for leads flagged after repeated unanswered phone calls. Decisions are recorded through record_lead_contact_review_decision.';
