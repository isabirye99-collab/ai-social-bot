create or replace function public.assign_lead_from_engagement(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_follow_up_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_current_user uuid := auth.uid();
  v_existing_assignee uuid;
begin
  if v_current_user is null then
    raise exception 'Authentication required';
  end if;
  select assigned_to into v_existing_assignee from public.leads where id = p_lead_id;
  if not found then raise exception 'Lead not found'; end if;
  if not private.is_admin_or_manager() and v_existing_assignee is distinct from v_current_user then
    return false;
  end if;
  update public.leads
  set assigned_to = p_assigned_to,
      next_follow_up_at = p_follow_up_at,
      follow_up_status = case when p_follow_up_at is null then 'pending' else 'scheduled' end,
      updated_at = now()
  where id = p_lead_id;
  return true;
end;
$$;
revoke all on function public.assign_lead_from_engagement(uuid, uuid, timestamptz) from public;
grant execute on function public.assign_lead_from_engagement(uuid, uuid, timestamptz) to authenticated;
