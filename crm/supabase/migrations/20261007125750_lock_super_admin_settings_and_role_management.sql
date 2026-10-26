drop policy if exists "CRM settings manageable by admins" on public.crm_settings;

create policy "CRM settings manageable by super admins"
on public.crm_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'::app_role
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'::app_role
      and p.is_active = true
  )
);

drop policy if exists "profiles_update_manager" on public.profiles;

create policy "profiles_update_super_admin"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = (select auth.uid())
      and actor.role = 'super_admin'::app_role
      and actor.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = (select auth.uid())
      and actor.role = 'super_admin'::app_role
      and actor.is_active = true
  )
);;
