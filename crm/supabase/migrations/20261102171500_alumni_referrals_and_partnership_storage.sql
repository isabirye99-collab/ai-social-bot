-- CIU Alumni Phase Two: alumni referral self-service and private partnership documents.

create or replace function public.submit_alumni_referral(
  p_referred_student_name text,
  p_referred_student_phone text default null,
  p_referred_student_email text default null,
  p_program text default null,
  p_intake text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_alumni_id uuid;
  v_referral_id uuid;
begin
  if v_user_id is null then
    raise exception 'Please sign in to submit a referral.';
  end if;

  select aa.alumni_id into v_alumni_id
    from public.alumni_accounts aa
   where aa.auth_user_id = v_user_id;

  if v_alumni_id is null then
    raise exception 'No alumni profile is linked to this account.';
  end if;

  if nullif(trim(coalesce(p_referred_student_name, '')), '') is null then
    raise exception 'Please provide the prospective student name.';
  end if;

  insert into public.alumni_referrals (
    alumni_id, referred_student_name, referred_student_phone,
    referred_student_email, program, intake, notes, enrollment_status
  ) values (
    v_alumni_id, trim(p_referred_student_name),
    nullif(trim(coalesce(p_referred_student_phone, '')), ''),
    nullif(trim(coalesce(p_referred_student_email, '')), ''),
    nullif(trim(coalesce(p_program, '')), ''),
    nullif(trim(coalesce(p_intake, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'referred'
  )
  returning id into v_referral_id;

  return v_referral_id;
end;
$$;

revoke all on function public.submit_alumni_referral(text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_alumni_referral(text,text,text,text,text,text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partnership-documents',
  'partnership-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists partnership_documents_staff_select on storage.objects;
drop policy if exists partnership_documents_staff_insert on storage.objects;
drop policy if exists partnership_documents_staff_update on storage.objects;
drop policy if exists partnership_documents_staff_delete on storage.objects;

create policy partnership_documents_staff_select
on storage.objects for select to authenticated
using (bucket_id = 'partnership-documents' and private.is_partnerships_staff());

create policy partnership_documents_staff_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'partnership-documents' and private.is_partnerships_staff());

create policy partnership_documents_staff_update
on storage.objects for update to authenticated
using (bucket_id = 'partnership-documents' and private.is_partnerships_staff())
with check (bucket_id = 'partnership-documents' and private.is_partnerships_staff());

create policy partnership_documents_staff_delete
on storage.objects for delete to authenticated
using (bucket_id = 'partnership-documents' and private.is_partnerships_staff());
