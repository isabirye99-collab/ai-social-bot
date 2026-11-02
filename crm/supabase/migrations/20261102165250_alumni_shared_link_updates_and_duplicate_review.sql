-- Staff-reviewed duplicate detection metadata for the CIU alumni register.
alter table public.alumni
  add column if not exists duplicate_review_status text not null default 'unreviewed',
  add column if not exists duplicate_of uuid references public.alumni(id) on delete set null,
  add column if not exists duplicate_reviewed_at timestamptz,
  add column if not exists duplicate_reviewed_by uuid references auth.users(id) on delete set null;
alter table public.alumni drop constraint if exists alumni_duplicate_review_status_check;
alter table public.alumni add constraint alumni_duplicate_review_status_check
  check (duplicate_review_status in ('unreviewed','confirmed_duplicate','not_duplicate','merged'));
create index if not exists alumni_duplicate_review_status_idx on public.alumni(duplicate_review_status);
create or replace view public.alumni_duplicate_candidates with (security_invoker = true) as
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         'email'::text as match_type,lower(trim(a.work_email)) as match_value,g.match_count
    from public.alumni a
    join (select lower(trim(work_email)) as match_value,count(*)::integer as match_count
            from public.alumni where nullif(trim(work_email),'') is not null
           group by lower(trim(work_email)) having count(*)>1) g
      on lower(trim(a.work_email))=g.match_value
  union all
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         'student number'::text,upper(trim(a.student_no)),g.match_count
    from public.alumni a
    join (select upper(trim(student_no)) as match_value,count(*)::integer as match_count
            from public.alumni where nullif(trim(student_no),'') is not null
           group by upper(trim(student_no)) having count(*)>1) g
      on upper(trim(a.student_no))=g.match_value
  union all
  select a.id,a.alumni_id,a.full_name,a.work_email,a.phone,a.whatsapp,a.student_no,a.program,a.graduation_year,
         'phone'::text,regexp_replace(coalesce(nullif(trim(a.phone),''),nullif(trim(a.whatsapp),'')),'[^0-9]','','g'),g.match_count
    from public.alumni a
    join (select regexp_replace(coalesce(nullif(trim(phone),''),nullif(trim(whatsapp),'')),'[^0-9]','','g') as match_value,
                 count(*)::integer as match_count
            from public.alumni where nullif(trim(coalesce(phone,whatsapp,'')),'') is not null
           group by regexp_replace(coalesce(nullif(trim(phone),''),nullif(trim(whatsapp),'')),'[^0-9]','','g')
          having count(*)>1) g
      on regexp_replace(coalesce(nullif(trim(a.phone),''),nullif(trim(a.whatsapp),'')),'[^0-9]','','g')=g.match_value
   where length(g.match_value)>=8;
grant select on public.alumni_duplicate_candidates to authenticated;
