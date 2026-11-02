-- Grant staff-side workflow actions; RLS policies continue to restrict these writes to Alumni Office staff.
grant update, delete on public.alumni_profile_updates to authenticated;
grant update, delete on public.alumni_event_registrations to authenticated;
