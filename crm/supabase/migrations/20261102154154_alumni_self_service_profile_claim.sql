-- Allow a signed-in graduate to find only the alumni record whose work email
-- matches the authenticated email, then link that record to their own Auth account.
create policy alumni_email_claim_read on public.alumni
for select to authenticated
using (
  (select auth.uid()) is not null
  and lower(coalesce(work_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy alumni_accounts_self_claim on public.alumni_accounts
for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.alumni a
    where a.id = alumni_accounts.alumni_id
      and lower(coalesce(a.work_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and coalesce(a.work_email, '') <> ''
  )
);
