create or replace function public.lookup_alumni_for_public_update(p_email text)
returns jsonb language sql security definer set search_path = '' as $$
  with matches as (
    select a.id,a.alumni_id,a.full_name,a.gender,a.student_no,a.program,a.faculty,a.graduation_year,
           a.work_email,a.phone,a.whatsapp,a.linkedin,a.city,a.nationality,a.employment_status,
           a.employer,a.job_title,a.industry,a.profile_bio,a.career_interests,
           a.allow_email,a.allow_sms,a.allow_whatsapp
      from public.alumni a
     where lower(trim(coalesce(a.work_email,'')))=lower(trim(coalesce(p_email,'')))
  )
  select jsonb_build_object('match_count',count(*),'profile',
    case when count(*)=1 then (select to_jsonb(m) from matches m limit 1) else null end)
  from matches;
$$;
revoke all on function public.lookup_alumni_for_public_update(text) from public,anon,authenticated;
grant execute on function public.lookup_alumni_for_public_update(text) to service_role;

create or replace function public.submit_alumni_update_from_public_link(p_token_hash text,p_changes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_challenge public.alumni_update_verifications%rowtype;
  v_alumni_id uuid;
  v_count integer;
  v_update_id uuid;
begin
  if p_token_hash is null or length(p_token_hash)<32 then raise exception 'Your verification session is invalid. Please request a new code.'; end if;
  select * into v_challenge from public.alumni_update_verifications
   where verified_token_hash=p_token_hash and verified_expires_at>now() and used_at is null
   order by created_at desc limit 1 for update;
  if not found then raise exception 'Your verification session has expired or has already been used. Please request a new code.'; end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception 'Please provide at least one profile update.'; end if;
  if p_changes - array['gender','student_no','program','faculty','graduation_year','work_email','phone','whatsapp','linkedin','city','nationality','employment_status','employer','job_title','industry','profile_bio','career_interests','allow_email','allow_sms','allow_whatsapp']::text[] <> '{}'::jsonb then
    raise exception 'The update contains fields that cannot be changed online.';
  end if;
  select count(*)::integer,min(a.id::text)::uuid into v_count,v_alumni_id
    from public.alumni a where lower(trim(coalesce(a.work_email,'')))=lower(trim(v_challenge.email));
  if v_count=0 then raise exception 'No alumni record matches this email. Please contact the CIU Alumni Office.';
  elsif v_count>1 then raise exception 'This email matches multiple alumni records. The Alumni Office must resolve the duplicates before an update can be submitted.';
  end if;
  insert into public.alumni_profile_updates(alumni_id,submitted_by,proposed_changes,review_status)
  values(v_alumni_id,null,p_changes,'pending') returning id into v_update_id;
  update public.alumni_update_verifications set used_at=now() where id=v_challenge.id;
  return v_update_id;
end;
$$;
revoke all on function public.submit_alumni_update_from_public_link(text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_alumni_update_from_public_link(text,jsonb) to service_role;
