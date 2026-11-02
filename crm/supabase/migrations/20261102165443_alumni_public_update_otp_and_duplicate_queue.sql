-- Shared-link alumni updates: OTP challenges are stored server-side and never exposed.
drop function if exists public.get_alumni_update_profile();
drop function if exists public.submit_alumni_update_by_email(jsonb);
alter table public.alumni_profile_updates alter column submitted_by drop not null;
create table if not exists public.alumni_update_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 10),
  verified_token_hash text,
  verified_expires_at timestamptz,
  used_at timestamptz,
  request_ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists alumni_update_verifications_email_created_idx
  on public.alumni_update_verifications (lower(email), created_at desc);
alter table public.alumni_update_verifications enable row level security;
revoke all on public.alumni_update_verifications from anon, authenticated;
grant all on public.alumni_update_verifications to service_role;
drop view if exists public.alumni_duplicate_candidates;
create view public.alumni_duplicate_candidates with (security_invoker = true) as
  select a.id, a.alumni_id, a.full_name, a.work_email, a.phone, a.whatsapp,
         a.student_no, a.program, a.graduation_year, a.duplicate_review_status,
         a.duplicate_of, 'email'::text as match_type, lower(trim(a.work_email)) as match_value,
         g.match_count
    from public.alumni a
    join (select lower(trim(work_email)) as match_value, count(*)::integer as match_count
            from public.alumni where nullif(trim(work_email), '') is not null
           group by lower(trim(work_email)) having count(*) > 1) g
      on lower(trim(a.work_email)) = g.match_value
  union all
  select a.id, a.alumni_id, a.full_name, a.work_email, a.phone, a.whatsapp,
         a.student_no, a.program, a.graduation_year, a.duplicate_review_status,
         a.duplicate_of, 'student number'::text, upper(trim(a.student_no)), g.match_count
    from public.alumni a
    join (select upper(trim(student_no)) as match_value, count(*)::integer as match_count
            from public.alumni where nullif(trim(student_no), '') is not null
           group by upper(trim(student_no)) having count(*) > 1) g
      on upper(trim(a.student_no)) = g.match_value
  union all
  select a.id, a.alumni_id, a.full_name, a.work_email, a.phone, a.whatsapp,
         a.student_no, a.program, a.graduation_year, a.duplicate_review_status,
         a.duplicate_of, 'phone'::text,
         regexp_replace(coalesce(nullif(trim(a.phone), ''), nullif(trim(a.whatsapp), '')), '[^0-9]', '', 'g'),
         g.match_count
    from public.alumni a
    join (select regexp_replace(coalesce(nullif(trim(phone), ''), nullif(trim(whatsapp), '')), '[^0-9]', '', 'g') as match_value,
                 count(*)::integer as match_count
            from public.alumni where nullif(trim(coalesce(phone, whatsapp, '')), '') is not null
           group by regexp_replace(coalesce(nullif(trim(phone), ''), nullif(trim(whatsapp), '')), '[^0-9]', '', 'g')
          having count(*) > 1) g
      on regexp_replace(coalesce(nullif(trim(a.phone), ''), nullif(trim(a.whatsapp), '')), '[^0-9]', '', 'g') = g.match_value
   where length(g.match_value) >= 8;
grant select on public.alumni_duplicate_candidates to authenticated;
