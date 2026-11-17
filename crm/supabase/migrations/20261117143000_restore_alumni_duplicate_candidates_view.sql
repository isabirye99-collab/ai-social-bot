-- Restore the duplicate-candidate source used by crm/app/alumni/duplicates/page.tsx.
-- SECURITY INVOKER ensures the view uses the caller's alumni table RLS policies.
create or replace view public.alumni_duplicate_candidates
with (security_invoker = true)
as
with match_keys as (
  select lower(trim(work_email)) as match_value, 'email'::text as match_type
  from public.alumni
  where nullif(trim(work_email), '') is not null
    and coalesce(duplicate_review_status, 'unreviewed') <> 'confirmed_duplicate'
  group by lower(trim(work_email)) having count(*) > 1
  union all
  select lower(trim(student_no)), 'student number'
  from public.alumni
  where nullif(trim(student_no), '') is not null
    and coalesce(duplicate_review_status, 'unreviewed') <> 'confirmed_duplicate'
  group by lower(trim(student_no)) having count(*) > 1
  union all
  select regexp_replace(trim(phone), '\\D', '', 'g'), 'phone'
  from public.alumni
  where nullif(trim(phone), '') is not null
    and length(regexp_replace(trim(phone), '\\D', '', 'g')) >= 7
    and coalesce(duplicate_review_status, 'unreviewed') <> 'confirmed_duplicate'
  group by regexp_replace(trim(phone), '\\D', '', 'g') having count(*) > 1
  union all
  select regexp_replace(trim(whatsapp), '\\D', '', 'g'), 'whatsapp'
  from public.alumni
  where nullif(trim(whatsapp), '') is not null
    and length(regexp_replace(trim(whatsapp), '\\D', '', 'g')) >= 7
    and coalesce(duplicate_review_status, 'unreviewed') <> 'confirmed_duplicate'
  group by regexp_replace(trim(whatsapp), '\\D', '', 'g') having count(*) > 1
), candidates as (
  select a.id, a.alumni_id, a.full_name, a.work_email, a.phone, a.whatsapp,
         a.student_no, a.program, a.graduation_year,
         coalesce(a.duplicate_review_status, 'unreviewed') as duplicate_review_status,
         a.duplicate_of, k.match_type, k.match_value
  from public.alumni a
  join match_keys k on (
    (k.match_type='email' and lower(trim(a.work_email))=k.match_value) or
    (k.match_type='student number' and lower(trim(a.student_no))=k.match_value) or
    (k.match_type='phone' and regexp_replace(trim(a.phone), '\\D', '', 'g')=k.match_value) or
    (k.match_type='whatsapp' and regexp_replace(trim(a.whatsapp), '\\D', '', 'g')=k.match_value)
  )
  where coalesce(a.duplicate_review_status, 'unreviewed') <> 'confirmed_duplicate'
)
select id, alumni_id, full_name, work_email, phone, whatsapp, student_no, program,
       graduation_year, duplicate_review_status, duplicate_of, match_type, match_value,
       count(*) over (partition by match_type, match_value)::integer as match_count
from candidates;

grant select on public.alumni_duplicate_candidates to authenticated;
