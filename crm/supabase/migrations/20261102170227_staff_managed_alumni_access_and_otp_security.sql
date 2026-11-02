-- Alumni are staff-managed; the public update workflow uses a one-time email code
-- handled by the alumni-update Edge Function, not alumni Supabase Auth accounts.
revoke all on function public.claim_alumni_profile(text) from public, anon, authenticated;
revoke all on function public.register_alumni_event(uuid) from public, anon, authenticated;
revoke all on function public.submit_alumni_profile_update(jsonb) from public, anon, authenticated;
revoke all on function public.submit_alumni_referral(text,text,text,text,text,text) from public, anon, authenticated;
drop policy if exists alumni_email_claim_read on public.alumni;
drop policy if exists alumni_self_read on public.alumni;
drop policy if exists alumni_accounts_self_claim on public.alumni_accounts;
drop policy if exists alumni_accounts_self_read on public.alumni_accounts;
drop policy if exists alumni_career_updates_self_insert on public.alumni_career_updates;
drop policy if exists alumni_career_updates_self_read on public.alumni_career_updates;
drop policy if exists alumni_event_registrations_self_read on public.alumni_event_registrations;
drop policy if exists alumni_events_published_read on public.alumni_events;
drop policy if exists alumni_membership_payments_self_read on public.alumni_membership_payments;
drop policy if exists alumni_mentorships_self_read on public.alumni_mentorships;
drop policy if exists alumni_profile_updates_self_insert on public.alumni_profile_updates;
drop policy if exists alumni_profile_updates_self_read on public.alumni_profile_updates;
drop policy if exists alumni_referrals_self_read on public.alumni_referrals;
drop policy if exists alumni_update_verifications_service_role on public.alumni_update_verifications;
create policy alumni_update_verifications_service_role on public.alumni_update_verifications
  for all to service_role using (true) with check (true);
create index if not exists alumni_duplicate_of_idx on public.alumni(duplicate_of);
create index if not exists alumni_duplicate_reviewed_by_idx on public.alumni(duplicate_reviewed_by);
create index if not exists partnership_contacts_created_by_idx on public.partnership_contacts(created_by);
