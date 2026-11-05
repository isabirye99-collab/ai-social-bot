create or replace function private.is_partnerships_staff()
returns boolean
language sql
stable
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (
        p.role::text in ('super_admin', 'admin', 'manager', 'marketing')
        or coalesce(p.module_permissions, '{}'::text[]) @> array['partnerships']::text[]
      )
  );
$function$;

revoke all on function private.is_partnerships_staff() from public;
grant execute on function private.is_partnerships_staff() to authenticated;
