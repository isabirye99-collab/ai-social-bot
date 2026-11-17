-- Allow students to submit their own contact details from a public, phone-friendly field form.
-- Only inserts are allowed for anon users, and the school must be an existing secondary school.
drop policy if exists "Public students can register school contacts" on public.school_student_contacts;
create policy "Public students can register school contacts"
  on public.school_student_contacts
  for insert to anon
  with check (
    created_by is null
    and length(trim(student_name)) between 2 and 180
    and length(trim(contact)) between 5 and 40
    and length(trim(program)) between 2 and 180
    and (email is null or length(email) <= 254)
    and exists (
      select 1 from public.schools s
      where s.id = school_id
        and lower(trim(s.school_type)) = 'secondary'
    )
  );
grant insert on public.school_student_contacts to anon;
