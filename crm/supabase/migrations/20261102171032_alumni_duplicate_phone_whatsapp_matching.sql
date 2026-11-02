drop view if exists public.alumni_duplicate_candidates;
create view public.alumni_duplicate_candidates with (security_invoker = true) as
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         a.duplicate_review_status,a.duplicate_of,'email'::text as match_type,lower(trim(a.work_email)) as match_value,g.match_count
    from public.alumni a
    join (select lower(trim(work_email)) as match_value,count(*)::integer as match_count
            from public.alumni where nullif(trim(work_email),'') is not null
           group by lower(trim(work_email)) having count(*)>1) g
      on lower(trim(a.work_email))=g.match_value
  union all
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         a.duplicate_review_status,a.duplicate_of,'student number'::text,upper(trim(a.student_no)),g.match_count
    from public.alumni a
    join (select upper(trim(student_no)) as match_value,count(*)::integer as match_count
            from public.alumni where nullif(trim(student_no),'') is not null
           group by upper(trim(student_no)) having count(*)>1) g
      on upper(trim(a.student_no))=g.match_value
  union all
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         a.duplicate_review_status,a.duplicate_of,'phone'::text,regexp_replace(trim(phone),'[^0-9]','','g'),g.match_count
    from public.alumni a
    join (select regexp_replace(trim(phone),'[^0-9]','','g') as match_value,count(*)::integer as match_count
            from public.alumni where nullif(trim(phone),'') is not null
           group by regexp_replace(trim(phone),'[^0-9]','','g') having count(*)>1) g
      on regexp_replace(trim(a.phone),'[^0-9]','','g')=g.match_value
   where length(g.match_value)>=8
  union all
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         a.duplicate_review_status,a.duplicate_of,'whatsapp'::text,regexp_replace(trim(whatsapp),'[^0-9]','','g'),g.match_count
    from public.alumni a
    join (select regexp_replace(trim(whatsapp),'[^0-9]','','g') as match_value,count(*)::integer as match_count
            from public.alumni where nullif(trim(whatsapp),'') is not null
           group by regexp_replace(trim(whatsapp),'[^0-9]','','g') having count(*)>1) g
      on regexp_replace(trim(a.whatsapp),'[^0-9]','','g')=g.match_value
   where length(g.match_value)>=8;
grant select on public.alumni_duplicate_candidates to authenticated;
