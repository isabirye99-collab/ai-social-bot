-- Atomically move a lead to another intake and preserve the transfer history.
create or replace function public.move_lead_to_intake(
  p_lead_id uuid,
  p_new_intake_year smallint,
  p_new_intake_month smallint,
  p_reason text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous_year smallint;
  v_previous_month smallint;
  v_original_year smallint;
  v_original_month smallint;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required to move a lead intake.';
  end if;
  if p_new_intake_year < 2020 or p_new_intake_year > 2100 then
    raise exception 'Invalid intake year.';
  end if;
  if p_new_intake_month not in (2,4,8,11) then
    raise exception 'Intake month must be February, April, August or November.';
  end if;

  select intake_year, intake_month, original_intake_year, original_intake_month
    into v_previous_year, v_previous_month, v_original_year, v_original_month
    from public.leads
    where id = p_lead_id
    for update;

  if not found then
    raise exception 'Lead not found or you do not have access to it.';
  end if;

  update public.leads
     set intake_year = p_new_intake_year,
         intake_month = p_new_intake_month,
         original_intake_year = coalesce(v_original_year, v_previous_year, p_new_intake_year),
         original_intake_month = coalesce(v_original_month, v_previous_month, p_new_intake_month),
         intake_changed_at = now(),
         intake_changed_by = v_user_id,
         updated_at = now()
   where id = p_lead_id;

  insert into public.lead_intake_history (
    lead_id, previous_intake_year, previous_intake_month,
    new_intake_year, new_intake_month, reason, changed_by
  ) values (
    p_lead_id, v_previous_year, v_previous_month,
    p_new_intake_year, p_new_intake_month, nullif(trim(p_reason), ''), v_user_id
  );
end;
$$;
grant execute on function public.move_lead_to_intake(uuid, smallint, smallint, text) to authenticated;
