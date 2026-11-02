-- Enable authorised staff CRUD actions for Phase Two Alumni and Partnerships screens.
-- Every table remains protected by its existing staff-only RLS policy.
grant insert, update, delete on public.alumni_accounts to authenticated;
grant insert, update, delete on public.alumni_events to authenticated;
grant insert, update, delete on public.alumni_event_registrations to authenticated;
grant insert, update, delete on public.alumni_career_updates to authenticated;
grant insert, update, delete on public.alumni_mentorships to authenticated;
grant insert, update, delete on public.alumni_communications to authenticated;
grant insert, update, delete on public.alumni_referrals to authenticated;
grant insert, update, delete on public.alumni_membership_payments to authenticated;
grant insert, update, delete on public.partnerships to authenticated;
grant insert, update, delete on public.partnership_agreements to authenticated;
grant insert, update, delete on public.partnership_activities to authenticated;
