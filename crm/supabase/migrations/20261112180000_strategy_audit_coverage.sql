-- Extend append-only audit coverage to strategy planning and staff report records.
-- Additive and data-preserving.
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
      when tg_table_name = 'strategy_weekly_reports' and old.status is distinct from new.status then 'weekly_report_status_changed'
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

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists strategy_weekly_report_audit on public.strategy_weekly_reports;
create trigger strategy_weekly_report_audit
after insert or update or delete on public.strategy_weekly_reports
for each row execute function public.strategy_record_governance_change();

drop trigger if exists strategy_objective_audit on public.strategy_objectives;
create trigger strategy_objective_audit
after insert or update or delete on public.strategy_objectives
for each row execute function public.strategy_record_governance_change();

drop trigger if exists strategy_intake_target_audit on public.strategy_intake_plans;
create trigger strategy_intake_target_audit
after insert or update or delete on public.strategy_intake_plans
for each row execute function public.strategy_record_governance_change();

drop trigger if exists strategy_activity_audit on public.strategy_activities;
create trigger strategy_activity_audit
after insert or update or delete on public.strategy_activities
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
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on table public.strategy_audit_events is 'Audit history for strategy objectives, intake targets, activities, approvals, allocations, weekly reports, meeting actions and report history.';
