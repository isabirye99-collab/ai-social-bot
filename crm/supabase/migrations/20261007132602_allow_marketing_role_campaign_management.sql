
create or replace function private.is_marketing_or_admin_manager()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('super_admin','admin','manager','marketing')
      and is_active = true
  );
$$;

drop policy if exists "campaigns_write" on public.campaigns;
create policy "campaigns_write"
on public.campaigns for all to authenticated
using (private.is_marketing_or_admin_manager() or created_by = auth.uid())
with check (private.is_marketing_or_admin_manager() or created_by = auth.uid());

drop policy if exists "campaign_leads_write" on public.campaign_leads;
create policy "campaign_leads_write"
on public.campaign_leads for all to authenticated
using (private.is_marketing_or_admin_manager())
with check (private.is_marketing_or_admin_manager());

drop policy if exists "campaign_import_batches_write" on public.campaign_import_batches;
create policy "campaign_import_batches_write"
on public.campaign_import_batches for all to authenticated
using (private.is_marketing_or_admin_manager() or imported_by = auth.uid())
with check (private.is_marketing_or_admin_manager() or imported_by = auth.uid());

revoke all on function private.is_marketing_or_admin_manager() from public;
grant execute on function private.is_marketing_or_admin_manager() to authenticated;
;
