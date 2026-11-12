-- CIU Strategy & Planning governance hardening.
-- Additive: preserve existing records and record changes to approval/report governance.
create or replace function public.strategy_record_governance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_before := null;
    v_after := to_jsonb(new);
    v_action := 'created';
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_action := case
      when tg_table_name = 'strategy_approval_requests' and old.status is distinct from new.status then 'approval_status_changed'
      when tg_table_name = 'strategy_report_history' and old.status is distinct from new.status then 'report_status_changed'
      else 'updated'
    end;
  else
    v_entity_id := old.id;
    v_before := to_jsonb(old);
    v_after := null;
    v_action := 'deleted';
  end if;

  insert into public.strategy_audit_events(entity_type, entity_id, action, before_data, after_data, actor_id)
  values (tg_table_name, v_entity_id, v_action, v_before, v_after, auth.uid());

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists strategy_approval_audit on public.strategy_approval_requests;
create trigger strategy_approval_audit
after insert or update or delete on public.strategy_approval_requests
for each row execute function public.strategy_record_governance_change();

drop trigger if exists strategy_cycle_allocation_audit on public.strategy_cycle_allocations;
create trigger strategy_cycle_allocation_audit
after insert or update or delete on public.strategy_cycle_allocations
for each row execute function public.strategy_record_governance_change();

drop trigger if exists strategy_meeting_action_audit on public.strategy_meeting_actions;
create trigger strategy_meeting_action_audit
after insert or update or delete on public.strategy_meeting_actions
for each row execute function public.strategy_record_governance_change();

drop trigger if exists strategy_report_history_audit on public.strategy_report_history;
create trigger strategy_report_history_audit
after insert or update or delete on public.strategy_report_history
for each row execute function public.strategy_record_governance_change();

create or replace function public.strategy_protect_final_report_versions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('approved', 'sent') then
    raise exception 'Approved or sent management report versions are locked. Create a new version for corrections.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists strategy_report_final_version_lock on public.strategy_report_history;
create trigger strategy_report_final_version_lock
before update or delete on public.strategy_report_history
for each row execute function public.strategy_protect_final_report_versions();

comment on function public.strategy_record_governance_change() is 'Records approval, cycle allocation, meeting action and report history changes in strategy_audit_events.';
comment on function public.strategy_protect_final_report_versions() is 'Prevents modification or deletion of approved/sent management report versions; corrections require a new version.';
