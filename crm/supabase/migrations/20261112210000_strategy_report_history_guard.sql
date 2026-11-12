-- Protect management report history from silent edits after review or delivery.
-- Drafts remain editable by authorised Strategy users; approval/status transitions are management-only.
create or replace function public.strategy_guard_report_history()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_role text;
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved', 'sent') then
      raise exception 'Approved or sent management reports cannot be deleted';
    end if;
    raise exception 'Management report history is retained; deletion is not permitted';
  end if;

  if old.status in ('approved', 'sent') then
    raise exception 'Approved or sent management reports are immutable; create a new version';
  end if;

  if new.status is distinct from old.status then
    select pr.role into actor_role
    from public.profiles pr
    where pr.id = auth.uid() and pr.is_active = true;

    if actor_role is null or actor_role not in ('super_admin', 'admin', 'manager') then
      raise exception 'Only active management users may change management report review status';
    end if;

    if not (
      (old.status = 'draft' and new.status = 'reviewed')
      or (old.status = 'reviewed' and new.status in ('approved', 'draft'))
      or (old.status = 'approved' and new.status = 'sent')
    ) then
      raise exception 'Invalid management report status transition: % to %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists strategy_report_history_guard on public.strategy_report_history;
create trigger strategy_report_history_guard
before update or delete on public.strategy_report_history
for each row execute function public.strategy_guard_report_history();

revoke execute on function public.strategy_guard_report_history() from public, anon, authenticated;
comment on function public.strategy_guard_report_history() is
  'Prevents deletion and post-approval edits of management report snapshots and restricts status transitions to management roles.';
