-- Restrict who can alter engagement records while preserving the existing staff-wide read workflow.
-- This migration is additive to the salesperson feature branch and is NOT applied to production.
-- Managers can administer all records. Staff can create records attributed to themselves and edit/delete
-- their own ordinary Call Centre interactions. Salesperson task-outcome interactions are management-only
-- for subsequent edits/deletes so the accountability record cannot be silently changed by its creator.

drop policy if exists "Authenticated staff manage engagement contacts" on public.engagement_contacts;
drop policy if exists "Active staff read engagement contacts" on public.engagement_contacts;
drop policy if exists "Active staff create own engagement contacts" on public.engagement_contacts;
drop policy if exists "Creators and management update engagement contacts" on public.engagement_contacts;
drop policy if exists "Creators and management delete engagement contacts" on public.engagement_contacts;

create policy "Active staff read engagement contacts"
  on public.engagement_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    )
  );

create policy "Active staff create own engagement contacts"
  on public.engagement_contacts
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    )
  );

create policy "Creators and management update engagement contacts"
  on public.engagement_contacts
  for update to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

create policy "Creators and management delete engagement contacts"
  on public.engagement_contacts
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

drop policy if exists "Authenticated staff manage engagement interactions" on public.engagement_interactions;
drop policy if exists "Active staff read engagement interactions" on public.engagement_interactions;
drop policy if exists "Active staff create engagement interactions" on public.engagement_interactions;
drop policy if exists "Creators and management update engagement interactions" on public.engagement_interactions;
drop policy if exists "Management delete engagement interactions" on public.engagement_interactions;

create policy "Active staff read engagement interactions"
  on public.engagement_interactions
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    )
  );

create policy "Active staff create engagement interactions"
  on public.engagement_interactions
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    )
    and (
      coalesce(reason, '') <> 'Salesperson task call outcome'
      or (
        channel = 'outgoing_call'
        and lead_id is not null
        and task_id is not null
        and assigned_to = auth.uid()
        and exists (
          select 1 from public.tasks t
          where t.id = engagement_interactions.task_id
            and t.lead_id = engagement_interactions.lead_id
            and t.task_type::text = 'call'
            and (t.assigned_to = auth.uid() or t.created_by = auth.uid())
        )
      )
    )
  );

create policy "Creators and management update engagement interactions"
  on public.engagement_interactions
  for update to authenticated
  using (
    (
      created_by = auth.uid()
      and coalesce(reason, '') <> 'Salesperson task call outcome'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
  )
  with check (
    (
      created_by = auth.uid()
      and coalesce(reason, '') <> 'Salesperson task call outcome'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

create policy "Management delete engagement interactions"
  on public.engagement_interactions
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and p.role in ('super_admin', 'admin', 'manager')
    )
    or (
      created_by = auth.uid()
      and coalesce(reason, '') <> 'Salesperson task call outcome'
    )
  );

comment on policy "Management delete engagement interactions" on public.engagement_interactions is
  'Salesperson task call outcome interactions are management-delete-only to protect daily accountability records.';
