
create or replace function public.assign_lead_to_salesperson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_salesperson uuid;
begin
  if new.assigned_to is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('crm_lead_salesperson_assignment'));

  select p.id
    into selected_salesperson
  from public.profiles p
  left join public.leads l
    on l.assigned_to = p.id
  where p.role = 'salesperson'::app_role
    and p.is_active = true
  group by p.id
  order by count(l.id) asc, p.created_at asc, p.id
  limit 1;

  if selected_salesperson is null then
    raise exception 'No active salesperson is available to receive this lead';
  end if;

  new.assigned_to := selected_salesperson;
  return new;
end;
$$;

drop trigger if exists trg_auto_assign_lead_salesperson on public.leads;

create trigger trg_auto_assign_lead_salesperson
before insert on public.leads
for each row
execute function public.assign_lead_to_salesperson();

update public.leads l
set assigned_to = (
  select p.id
  from public.profiles p
  where p.role = 'salesperson'::app_role
    and p.is_active = true
  order by p.created_at asc, p.id
  limit 1
)
where l.assigned_to is null;

revoke all on function public.assign_lead_to_salesperson() from public;
grant execute on function public.assign_lead_to_salesperson() to authenticated;
;
