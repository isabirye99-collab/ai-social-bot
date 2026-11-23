-- Allow salespeople to read lead details for tasks assigned to them,
-- even when the lead itself is still owned by another salesperson.
-- This is read-only visibility; it does not transfer lead ownership or modify data.

drop policy if exists "leads_read" on public.leads;

create policy "leads_read"
on public.leads
for select
to authenticated
using (
  private.is_admin_or_manager()
  or private.is_marketing()
  or assigned_to = (select auth.uid())
  or exists (
    select 1
    from public.tasks t
    where t.lead_id = leads.id
      and t.assigned_to = (select auth.uid())
  )
);
