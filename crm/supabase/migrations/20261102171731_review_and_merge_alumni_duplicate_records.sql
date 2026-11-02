create or replace function public.resolve_alumni_duplicate(p_duplicate_id uuid,p_primary_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_duplicate public.alumni%rowtype;
  v_primary public.alumni%rowtype;
  v_missing text[] := array[]::text[];
  v_has_contact boolean;
begin
  if (select auth.uid()) is null or not private.is_alumni_staff() then
    raise exception 'You are not authorised to resolve alumni duplicates.';
  end if;
  if p_duplicate_id is null or p_primary_id is null or p_duplicate_id=p_primary_id then
    raise exception 'Select two different alumni records.';
  end if;
  select * into v_duplicate from public.alumni where id=p_duplicate_id for update;
  if not found then raise exception 'The duplicate record could not be found.'; end if;
  select * into v_primary from public.alumni where id=p_primary_id for update;
  if not found then raise exception 'The primary alumni record could not be found.'; end if;
  if v_duplicate.duplicate_review_status <> 'unreviewed' then
    raise exception 'This record has already been reviewed. Refresh the duplicate queue.';
  end if;
  if v_primary.duplicate_review_status='confirmed_duplicate' then
    raise exception 'The selected primary record is already archived as a duplicate.';
  end if;

  update public.alumni a set
    gender=coalesce(nullif(trim(a.gender),''),nullif(trim(v_duplicate.gender),'')),
    student_no=coalesce(nullif(trim(a.student_no),''),nullif(trim(v_duplicate.student_no),'')),
    program=coalesce(nullif(trim(a.program),''),nullif(trim(v_duplicate.program),'')),
    faculty=coalesce(nullif(trim(a.faculty),''),nullif(trim(v_duplicate.faculty),'')),
    graduation_year=coalesce(a.graduation_year,v_duplicate.graduation_year),
    work_email=coalesce(nullif(trim(a.work_email),''),nullif(trim(v_duplicate.work_email),'')),
    phone=coalesce(nullif(trim(a.phone),''),nullif(trim(v_duplicate.phone),'')),
    whatsapp=coalesce(nullif(trim(a.whatsapp),''),nullif(trim(v_duplicate.whatsapp),'')),
    linkedin=coalesce(nullif(trim(a.linkedin),''),nullif(trim(v_duplicate.linkedin),'')),
    city=coalesce(nullif(trim(a.city),''),nullif(trim(v_duplicate.city),'')),
    nationality=coalesce(nullif(trim(a.nationality),''),nullif(trim(v_duplicate.nationality),'')),
    employment_status=coalesce(nullif(trim(a.employment_status),''),nullif(trim(v_duplicate.employment_status),'')),
    employer=coalesce(nullif(trim(a.employer),''),nullif(trim(v_duplicate.employer),'')),
    job_title=coalesce(nullif(trim(a.job_title),''),nullif(trim(v_duplicate.job_title),'')),
    industry=coalesce(nullif(trim(a.industry),''),nullif(trim(v_duplicate.industry),'')),
    profile_bio=coalesce(nullif(trim(a.profile_bio),''),nullif(trim(v_duplicate.profile_bio),'')),
    career_interests=coalesce(nullif(trim(a.career_interests),''),nullif(trim(v_duplicate.career_interests),'')),
    updated_at=now()
  where a.id=p_primary_id returning a.* into v_primary;

  if nullif(trim(v_primary.work_email),'') is null then v_missing:=array_append(v_missing,'work_email'); end if;
  if nullif(trim(v_primary.phone),'') is null and nullif(trim(v_primary.whatsapp),'') is null then v_missing:=array_append(v_missing,'phone'); end if;
  if nullif(trim(v_primary.student_no),'') is null then v_missing:=array_append(v_missing,'student_no'); end if;
  if nullif(trim(v_primary.program),'') is null then v_missing:=array_append(v_missing,'program'); end if;
  if v_primary.graduation_year is null then v_missing:=array_append(v_missing,'graduation_year'); end if;
  if nullif(trim(v_primary.faculty),'') is null then v_missing:=array_append(v_missing,'faculty'); end if;
  if nullif(trim(v_primary.city),'') is null then v_missing:=array_append(v_missing,'city'); end if;
  if nullif(trim(v_primary.linkedin),'') is null then v_missing:=array_append(v_missing,'linkedin'); end if;
  if nullif(trim(v_primary.employment_status),'') is null then v_missing:=array_append(v_missing,'employment_status'); end if;
  if nullif(trim(v_primary.employer),'') is null then v_missing:=array_append(v_missing,'employer'); end if;
  if nullif(trim(v_primary.job_title),'') is null then v_missing:=array_append(v_missing,'job_title'); end if;
  if nullif(trim(v_primary.industry),'') is null then v_missing:=array_append(v_missing,'industry'); end if;
  v_has_contact:=nullif(trim(v_primary.work_email),'') is not null or nullif(trim(v_primary.phone),'') is not null or nullif(trim(v_primary.whatsapp),'') is not null;

  update public.alumni set missing_fields=v_missing,
    verification_status=case when cardinality(v_missing)=0 then 'verified' when v_has_contact then 'needs_review' else 'contact_required' end,
    last_verified_at=case when cardinality(v_missing)=0 then now() else null end,
    updated_at=now()
   where id=p_primary_id;
  update public.alumni set duplicate_review_status='confirmed_duplicate',duplicate_of=p_primary_id,
    duplicate_reviewed_at=now(),duplicate_reviewed_by=(select auth.uid()),updated_at=now()
   where id=p_duplicate_id;
  return p_primary_id;
end;
$$;
revoke all on function public.resolve_alumni_duplicate(uuid,uuid) from public,anon;
grant execute on function public.resolve_alumni_duplicate(uuid,uuid) to authenticated;
