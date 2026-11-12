-- Protect approved weekly reports at database level, independent of the browser UI.
-- Additive migration: does not delete or rewrite existing report data.
create or replace function public.strategy_prevent_approved_report_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.status = 'approved' then
    raise exception 'Approved weekly reports are locked; use a controlled correction/version workflow.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' then
    raise exception 'Approved weekly reports are locked; use a controlled correction/version workflow.';
  end if;

  if tg_op = 'UPDATE' and new.staff_id is distinct from old.staff_id then
    raise exception 'A weekly report owner cannot be changed.';
  end if;

  if tg_op = 'UPDATE' and new.reporting_start is distinct from old.reporting_start then
    raise exception 'A weekly report period cannot be changed after creation.';
  end if;

  if tg_op = 'UPDATE' and new.reporting_end is distinct from old.reporting_end then
    raise exception 'A weekly report period cannot be changed after creation.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists strategy_weekly_report_lock on public.strategy_weekly_reports;
create trigger strategy_weekly_report_lock
before update or delete on public.strategy_weekly_reports
for each row execute function public.strategy_prevent_approved_report_mutation();

comment on function public.strategy_prevent_approved_report_mutation() is
'Prevents editing/deleting approved weekly reports and changing report owner or period. Controlled correction/version workflow is required.';
