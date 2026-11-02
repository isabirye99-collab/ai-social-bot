-- Allow authorised Alumni Office staff to import the original alumni register.
grant insert on public.alumni to authenticated;
create policy alumni_staff_insert on public.alumni for insert to authenticated
  with check (private.is_alumni_staff());
