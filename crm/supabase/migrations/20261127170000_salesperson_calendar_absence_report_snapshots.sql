-- CIU salesperson accountability: working calendar, absence approvals, and immutable end-of-day snapshots.
-- Apply only in a controlled release after reviewing against the target Supabase schema.

create table if not exists public.ciu_working_calendar (
  calendar_date date primary key,
  title text not null,
  day_type text not null check (day_type in ('public_holiday', 'ciu_closure', 'working_day')),
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ciu_working_calendar enable row level security;
drop policy if exists "Authenticated users can read active CIU calendar" on public.ciu_working_calendar;
create policy "Authenticated users can read active CIU calendar"
  on public.ciu_working_calendar for select to authenticated using (is_active = true);
drop policy if exists "Management manages CIU working calendar" on public.ciu_working_calendar;
create policy "Management manages CIU working calendar"
  on public.ciu_working_calendar for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role in ('super_admin','admin','manager')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role in ('super_admin','admin','manager')));

create table if not exists public.salesperson_absence_requests (
  id uuid primary key default gen_random_uuid(),
  salesperson_id uuid not null references auth.users(id) on delete restrict,
  absence_date date not null,
  day_fraction numeric(3,2) not null check (day_fraction > 0 and day_fraction <= 1),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_notes text,
  constraint salesperson_absence_daily_unique unique (salesperson_id, absence_date)
);
create index if not exists salesperson_absence_date_status_idx on public.salesperson_absence_requests(absence_date, status);
alter table public.salesperson_absence_requests enable row level security;
drop policy if exists "Salespeople read own absence requests and management reads team" on public.salesperson_absence_requests;
create policy "Salespeople read own absence requests and management reads team"
  on public.salesperson_absence_requests for select to authenticated
  using (
    salesperson_id = auth.uid()
    or requested_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role in ('super_admin','admin','manager'))
  );
drop policy if exists "Salespeople request own absence" on public.salesperson_absence_requests;
create policy "Salespeople request own absence"
  on public.salesperson_absence_requests for insert to authenticated
  with check (
    salesperson_id = auth.uid()
    and requested_by = auth.uid()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role = 'salesperson')
  );

create table if not exists public.salesperson_absence_decision_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.salesperson_absence_requests(id) on delete restrict,
  salesperson_id uuid not null references auth.users(id) on delete restrict,
  absence_date date not null,
  previous_status text not null check (previous_status in ('pending','approved','rejected')),
  new_status text not null check (new_status in ('approved','rejected')),
  decision_notes text,
  decided_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  decided_at timestamptz not null default now()
);
create index if not exists salesperson_absence_decision_history_request_idx
  on public.salesperson_absence_decision_history(request_id, decided_at desc);
alter table public.salesperson_absence_decision_history enable row level security;
drop policy if exists "Salespeople and management read absence decision history" on public.salesperson_absence_decision_history;
create policy "Salespeople and management read absence decision history"
  on public.salesperson_absence_decision_history for select to authenticated
  using (
    salesperson_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role in ('super_admin','admin','manager'))
  );
revoke all on public.salesperson_absence_decision_history from anon, authenticated;
grant select on public.salesperson_absence_decision_history to authenticated;

create or replace function public.decide_salesperson_absence(
  p_request_id uuid,
  p_decision text,
  p_decision_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_request public.salesperson_absence_requests%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.role into v_role from public.profiles p where p.id = v_actor and p.is_active = true;
  if v_role is null or v_role not in ('super_admin','admin','manager') then
    raise exception 'Only active management users may approve or reject absences';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Choose approved or rejected'; end if;
  select * into v_request from public.salesperson_absence_requests where id = p_request_id for update;
  if not found then raise exception 'Absence request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'This absence request has already been decided'; end if;
  update public.salesperson_absence_requests
    set status = p_decision, decided_by = v_actor, decided_at = now(),
        decision_notes = nullif(trim(coalesce(p_decision_notes,'')), '')
    where id = p_request_id;

  insert into public.salesperson_absence_decision_history
    (request_id, salesperson_id, absence_date, previous_status, new_status, decision_notes, decided_by)
  values
    (v_request.id, v_request.salesperson_id, v_request.absence_date, v_request.status, p_decision,
     nullif(trim(coalesce(p_decision_notes,'')), ''), v_actor);

  return p_request_id;
end;
$$;
revoke all on function public.decide_salesperson_absence(uuid,text,text) from public, anon;
grant execute on function public.decide_salesperson_absence(uuid,text,text) to authenticated;

create table if not exists public.salesperson_contact_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  salesperson_id uuid not null references auth.users(id) on delete restrict,
  revision integer not null check (revision >= 1),
  report_data jsonb not null,
  finalized_at timestamptz not null default now(),
  finalized_by uuid references auth.users(id) on delete restrict default auth.uid(),
  finalization_source text not null default 'manual' check (finalization_source in ('manual','automated')),
  supersedes_id uuid references public.salesperson_contact_report_snapshots(id) on delete restrict,
  correction_reason text,
  constraint salesperson_contact_report_revision_unique unique (report_date, salesperson_id, revision),
  constraint salesperson_contact_report_correction_reason_check check ((revision = 1 and supersedes_id is null and correction_reason is null) or (revision > 1 and supersedes_id is not null and nullif(trim(correction_reason),'') is not null))
);
create index if not exists salesperson_contact_report_latest_idx on public.salesperson_contact_report_snapshots(report_date, salesperson_id, revision desc);
alter table public.salesperson_contact_report_snapshots enable row level security;
drop policy if exists "Salespeople read own snapshots and management reads team" on public.salesperson_contact_report_snapshots;
create policy "Salespeople read own snapshots and management reads team"
  on public.salesperson_contact_report_snapshots for select to authenticated
  using (
    salesperson_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role in ('super_admin','admin','manager'))
  );
revoke all on public.salesperson_contact_report_snapshots from anon, authenticated;
grant select on public.salesperson_contact_report_snapshots to authenticated;

create or replace function public.finalize_salesperson_contact_report(
  p_report_date date,
  p_report_data jsonb,
  p_correction_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_salesperson_id uuid;
  v_salesperson_name text;
  v_latest public.salesperson_contact_report_snapshots%rowtype;
  v_revision integer;
  v_new_id uuid;
  v_day_type text;
  v_working_day boolean;
  v_absence_fraction numeric(3,2);
  v_target integer;
  v_unique_students integer;
  v_status text;
  v_calls jsonb;
  v_snapshot_data jsonb;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_report_date is null or p_report_data is null or jsonb_typeof(p_report_data) <> 'object' then
    raise exception 'A report date and report data are required';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_actor and p.is_active = true;
  if v_role is null then raise exception 'An active CRM profile is required'; end if;
  if v_role = 'salesperson' then
    v_salesperson_id := v_actor;
  elsif v_role in ('super_admin','admin','manager') then
    v_salesperson_id := nullif(p_report_data->>'salesperson_id','')::uuid;
    if v_salesperson_id is null then raise exception 'Choose the salesperson whose report is being finalised'; end if;
  else
    raise exception 'This role cannot finalise salesperson contact reports';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_salesperson_id and p.is_active = true and p.role = 'salesperson') then
    raise exception 'The report owner must be an active salesperson';
  end if;
  if p_report_date > (now() at time zone 'Africa/Kampala')::date then
    raise exception 'A future report date cannot be finalised or corrected';
  end if;

  -- Compute report metrics from the database, not from client-supplied JSON.
  -- Call creator is the primary attribution; assigned_to is only a legacy fallback.
  select p.full_name into v_salesperson_name
    from public.profiles p where p.id = v_salesperson_id;
  select c.day_type into v_day_type
    from public.ciu_working_calendar c
   where c.calendar_date = p_report_date and c.is_active = true
   limit 1;
  if found then
    v_working_day := v_day_type = 'working_day';
  else
    v_working_day := extract(isodow from p_report_date) between 1 and 5;
  end if;

  select least(1::numeric, coalesce(sum(a.day_fraction), 0))
    into v_absence_fraction
    from public.salesperson_absence_requests a
   where a.salesperson_id = v_salesperson_id
     and a.absence_date = p_report_date
     and a.status = 'approved';
  v_target := case when v_working_day
    then greatest(0, round(50 * (1 - v_absence_fraction))::integer)
    else 0 end;

  v_day_start := p_report_date::timestamp at time zone 'Africa/Kampala';
  v_day_end := (p_report_date + 1)::timestamp at time zone 'Africa/Kampala';

  select count(distinct i.lead_id)::integer
    into v_unique_students
    from public.engagement_interactions i
   where i.channel = 'outgoing_call'
     and lower(trim(coalesce(i.response, ''))) = 'answered'
     and lower(trim(coalesce(i.outcome, ''))) <> 'wrong number'
     and i.lead_id is not null
     and coalesce(i.created_by, i.assigned_to) = v_salesperson_id
     and i.contacted_at >= v_day_start
     and i.contacted_at < v_day_end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'contacted_at', i.contacted_at,
      'lead_id', i.lead_id,
      'student_name', coalesce(l.name, l.ciu_number, 'Unnamed student'),
      'ciu_number', coalesce(l.ciu_number, ''),
      'phone', coalesce(l.phone, ''),
      'outcome', coalesce(i.outcome, '')
    ) order by i.contacted_at
  ), '[]'::jsonb)
    into v_calls
    from public.engagement_interactions i
    left join public.leads l on l.id = i.lead_id
   where i.channel = 'outgoing_call'
     and lower(trim(coalesce(i.response, ''))) = 'answered'
     and lower(trim(coalesce(i.outcome, ''))) <> 'wrong number'
     and i.lead_id is not null
     and coalesce(i.created_by, i.assigned_to) = v_salesperson_id
     and i.contacted_at >= v_day_start
     and i.contacted_at < v_day_end;

  v_status := case
    when v_target = 0 then 'Exempt / non-working day'
    when v_unique_students >= v_target then 'Target achieved'
    when v_unique_students > 0 then 'Below target'
    else 'No qualifying calls'
  end;
  v_snapshot_data := coalesce(p_report_data, '{}'::jsonb) || jsonb_build_object(
    'salesperson_id', v_salesperson_id,
    'report_date', p_report_date,
    'salesperson_name', coalesce(v_salesperson_name, 'Unnamed salesperson'),
    'target', v_target,
    'unique_students_contacted', v_unique_students,
    'status', v_status,
    'working_day', v_working_day,
    'approved_absence_fraction', v_absence_fraction,
    'generated_at_eat', to_char(now() at time zone 'Africa/Kampala', 'YYYY-MM-DD HH24:MI:SS'),
    'finalization_method', 'server-verified',
    'calls', v_calls
  );

  select * into v_latest from public.salesperson_contact_report_snapshots
   where report_date = p_report_date and salesperson_id = v_salesperson_id
   order by revision desc limit 1;
  if found then
    -- Corrections to an existing immutable snapshot may be made later, including
    -- for prior dates, but must always create a new revision with a reason.
    if nullif(trim(coalesce(p_correction_reason,'')), '') is null then
      raise exception 'A correction reason is required because a report has already been finalised';
    end if;
    v_revision := v_latest.revision + 1;
    insert into public.salesperson_contact_report_snapshots
      (report_date, salesperson_id, revision, report_data, finalized_by, supersedes_id, correction_reason)
    values
      (p_report_date, v_salesperson_id, v_revision, v_snapshot_data, v_actor, v_latest.id, trim(p_correction_reason))
    returning id into v_new_id;
  else
    -- Only the first finalisation is limited to today's report after 17:00 EAT.
    if p_report_date <> (now() at time zone 'Africa/Kampala')::date then
      raise exception 'An original report can only be finalised for the current EAT date';
    end if;
    if (now() at time zone 'Africa/Kampala')::time < time '17:00' then
      raise exception 'Daily contact reports can be finalised from 5:00pm East Africa Time';
    end if;
    if nullif(trim(coalesce(p_correction_reason,'')), '') is not null then
      raise exception 'A correction reason is only valid after the original report exists';
    end if;
    if not v_working_day then
      raise exception 'An original report can only be finalised on an official CIU working day';
    end if;
    insert into public.salesperson_contact_report_snapshots
      (report_date, salesperson_id, revision, report_data, finalized_by)
    values (p_report_date, v_salesperson_id, 1, v_snapshot_data, v_actor)
    returning id into v_new_id;
  end if;
  return v_new_id;
end;
$$;
revoke all on function public.finalize_salesperson_contact_report(date,jsonb,text) from public, anon;
grant execute on function public.finalize_salesperson_contact_report(date,jsonb,text) to authenticated;

create or replace function public.prevent_salesperson_contact_report_mutation()
returns trigger language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  raise exception 'Finalised report snapshots are immutable; create a new correction revision instead';
end;
$$;
drop trigger if exists salesperson_contact_report_snapshots_append_only on public.salesperson_contact_report_snapshots;
create trigger salesperson_contact_report_snapshots_append_only
before update or delete on public.salesperson_contact_report_snapshots
for each row execute function public.prevent_salesperson_contact_report_mutation();
revoke execute on function public.prevent_salesperson_contact_report_mutation() from public, anon, authenticated;

create or replace function public.prevent_salesperson_absence_history_mutation()
returns trigger language plpgsql security invoker set search_path = public, pg_temp
as $absence_audit$
begin
  raise exception 'Absence decision history is append-only';
end;
$absence_audit$;
drop trigger if exists salesperson_absence_decision_history_append_only on public.salesperson_absence_decision_history;
create trigger salesperson_absence_decision_history_append_only
before update or delete on public.salesperson_absence_decision_history
for each row execute function public.prevent_salesperson_absence_history_mutation();
revoke execute on function public.prevent_salesperson_absence_history_mutation() from public, anon, authenticated;

comment on table public.ciu_working_calendar is 'Management-maintained CIU working calendar. Public holidays and campus closures must be entered and maintained by authorised staff.';
comment on table public.salesperson_absence_requests is 'Daily salesperson absence requests, with approved full-day or partial-day fraction and decision audit.';
comment on table public.salesperson_contact_report_snapshots is 'Immutable end-of-day salesperson contact report snapshots. Corrections append a new revision with reason and superseded snapshot.';

comment on table public.salesperson_absence_decision_history is 'Append-only audit of manager decisions on salesperson absence requests.';
