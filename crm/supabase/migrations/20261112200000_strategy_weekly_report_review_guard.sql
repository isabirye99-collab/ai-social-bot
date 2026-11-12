-- Enforce weekly report review authority in the database, not only in the UI.
-- Existing records are preserved; this only validates future updates.
create or replace function public.strategy_guard_weekly_report_review()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_is_manager boolean := false;
begin
  select pr.role into v_role
  from public.profiles pr
  where pr.id = auth.uid()
    and pr.is_active = true;

  v_is_manager := coalesce(v_role in ('super_admin', 'admin', 'manager'), false);

  if (
    new.status is distinct from old.status
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewer_comments is distinct from old.reviewer_comments
  ) and not v_is_manager then
    raise exception 'Only an active manager or administrator may review weekly staff reports.';
  end if;

  if old.status in ('submitted', 'reviewed', 'returned_for_revision', 'approved')
     and not v_is_manager
     and (
       new.completed_work is distinct from old.completed_work
       or new.recruitment_outcomes is distinct from old.recruitment_outcomes
       or new.challenges is distinct from old.challenges
       or new.next_week_plan is distinct from old.next_week_plan
       or new.evidence is distinct from old.evidence
     ) then
    raise exception 'Submitted weekly reports cannot be edited by staff. Return the report for revision first.';
  end if;

  return new;
end;
$$;

drop trigger if exists strategy_weekly_report_review_guard on public.strategy_weekly_reports;
create trigger strategy_weekly_report_review_guard
before update on public.strategy_weekly_reports
for each row execute function public.strategy_guard_weekly_report_review();

comment on function public.strategy_guard_weekly_report_review() is
'Restricts review decisions to active managers/admins and prevents staff editing submitted reports until returned for revision.';
