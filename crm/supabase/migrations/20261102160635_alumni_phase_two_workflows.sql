-- CIU Alumni Phase Two: secure account claiming, profile review and event registration
-- Keep alumni identity linking and event capacity checks on the database server.

create or replace function public.claim_alumni_profile(p_alumni_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_alumni_uuid uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to claim an alumni profile.';
  end if;

  select lower(u.email)
    into v_email
    from auth.users u
   where u.id = v_user_id
     and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'Please verify your email address before claiming your profile.';
  end if;

  select a.id
    into v_alumni_uuid
    from public.alumni a
   where upper(trim(a.alumni_id)) = upper(trim(p_alumni_id))
     and lower(trim(coalesce(a.work_email, ''))) = v_email;

  if v_alumni_uuid is null then
    raise exception 'The Alumni ID and verified email address do not match CIU records. Contact the Alumni Office if your email needs updating.';
  end if;

  insert into public.alumni_accounts (alumni_id, auth_user_id)
  values (v_alumni_uuid, v_user_id)
  on conflict do nothing;

  if not exists (
    select 1 from public.alumni_accounts aa
     where aa.alumni_id = v_alumni_uuid
       and aa.auth_user_id = v_user_id
  ) then
    raise exception 'This alumni record or login account is already linked to another account. Contact the Alumni Office.';
  end if;

  return v_alumni_uuid;
end;
$$;

revoke all on function public.claim_alumni_profile(text) from public, anon;
grant execute on function public.claim_alumni_profile(text) to authenticated;

-- Alumni submit proposed profile changes; the Alumni Office reviews and applies them.
drop policy if exists alumni_self_update on public.alumni;
revoke update on public.alumni from authenticated;
grant update on public.alumni to authenticated;
drop policy if exists alumni_staff_update on public.alumni;
create policy alumni_staff_update on public.alumni
  for update to authenticated
  using (private.is_alumni_staff())
  with check (private.is_alumni_staff());

create or replace function public.submit_alumni_profile_update(p_changes jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_alumni_id uuid;
  v_update_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select aa.alumni_id into v_alumni_id
    from public.alumni_accounts aa
   where aa.auth_user_id = v_user_id;

  if v_alumni_id is null then
    raise exception 'No alumni profile is linked to this account.';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'object'
     or p_changes = '{}'::jsonb then
    raise exception 'Please provide at least one profile change.';
  end if;

  if p_changes - array[
    'work_email','phone','whatsapp','linkedin','city','employment_status',
    'employer','job_title','industry','profile_bio','career_interests',
    'allow_email','allow_sms','allow_whatsapp'
  ]::text[] <> '{}'::jsonb then
    raise exception 'The request contains fields that cannot be changed through the alumni portal.';
  end if;

  insert into public.alumni_profile_updates (alumni_id, submitted_by, proposed_changes)
  values (v_alumni_id, v_user_id, p_changes)
  returning id into v_update_id;

  return v_update_id;
end;
$$;

revoke all on function public.submit_alumni_profile_update(jsonb) from public, anon;
grant execute on function public.submit_alumni_profile_update(jsonb) to authenticated;

-- Enforce event deadlines and capacity while registering, including waitlisting.
create or replace function public.register_alumni_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_alumni_id uuid;
  v_event public.alumni_events%rowtype;
  v_count integer;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Please sign in to register.';
  end if;

  select aa.alumni_id into v_alumni_id
    from public.alumni_accounts aa
   where aa.auth_user_id = v_user_id;

  if v_alumni_id is null then
    raise exception 'No alumni profile is linked to this account.';
  end if;

  select * into v_event
    from public.alumni_events
   where id = p_event_id
   for update;

  if not found or v_event.status <> 'published' then
    raise exception 'This event is not open for registration.';
  end if;

  if v_event.registration_deadline is not null
     and v_event.registration_deadline < now() then
    raise exception 'The registration deadline has passed.';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'Registration for this event is closed.';
  end if;

  select count(*)::integer into v_count
    from public.alumni_event_registrations r
   where r.event_id = p_event_id
     and r.registration_status in ('registered','attended');

  v_status := case
    when v_event.capacity is not null and v_count >= v_event.capacity then 'waitlisted'
    else 'registered'
  end;

  insert into public.alumni_event_registrations (event_id, alumni_id, registration_status)
  values (p_event_id, v_alumni_id, v_status)
  on conflict (event_id, alumni_id) do nothing;

  if not found then
    raise exception 'You are already registered for this event.';
  end if;

  return v_status;
end;
$$;

revoke all on function public.register_alumni_event(uuid) from public, anon;
grant execute on function public.register_alumni_event(uuid) to authenticated;

-- Direct alumni inserts/updates to registrations would bypass capacity checks.
drop policy if exists alumni_event_registrations_self_insert on public.alumni_event_registrations;
revoke insert, update, delete on public.alumni_event_registrations from authenticated;
grant select on public.alumni_event_registrations to authenticated;

