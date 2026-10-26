revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin_or_manager() from public, anon, authenticated;
grant execute on function public.is_admin_or_manager() to authenticated;;
