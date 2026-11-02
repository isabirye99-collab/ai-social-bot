create or replace function public.lookup_alumni_for_public_update(p_email text)
returns jsonb language sql security definer set search_path = '' as $$
  with matches as (
    select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.linkedin,a.city,a.nationality,
           a.employment_status,a.employer,a.job_title,a.industry,a.profile_bio,a.career_interests,
           a.allow_email,a.allow_sms,a.allow_whatsapp
      from public.alumni a
     where lower(trim(coalesce(a.work_email,''))) = lower(trim(coalesce(p_email,'')))
  )
  select jsonb_build_object(
    'match_count',count(*),
    'profile',case when count(*)=1 then (select to_jsonb(m) from matches m limit 1) else null end
  ) from matches;
$$;
revoke all on function public.lookup_alumni_for_public_update(text) from public,anon,authenticated;
grant execute on function public.lookup_alumni_for_public_update(text) to service_role;
