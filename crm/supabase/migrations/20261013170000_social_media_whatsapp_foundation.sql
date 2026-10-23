
-- Social Media Hub and WhatsApp Marketing foundation.
-- Additive migration: preserves existing campaigns and CRM data.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null,
  body text not null default '',
  platforms text[] not null default '{}',
  media_urls text[] not null default '{}',
  status text not null default 'draft'
    check (status in (
      'draft', 'pending_approval', 'approved', 'scheduled',
      'publishing', 'published', 'failed', 'rejected'
    )),
  scheduled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  platform_post_ids jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('social_post', 'whatsapp_campaign')),
  entity_id uuid not null,
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_comments text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.social_platform_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null
    check (platform in (
      'wordpress', 'tiktok', 'facebook', 'instagram', 'x', 'linkedin'
    )),
  account_name text,
  external_account_id text,
  connection_status text not null default 'not_connected'
    check (connection_status in (
      'not_connected', 'pending', 'connected', 'expired', 'error'
    )),
  connected_by uuid references public.profiles(id) on delete set null,
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_account_id)
);

create table if not exists public.whatsapp_consents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  phone_e164 text not null,
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'opted_in', 'opted_out')),
  consent_source text,
  consent_text text,
  consent_at timestamptz,
  revoked_at timestamptz,
  captured_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_e164),
  check (
    (consent_status <> 'opted_in')
    or consent_at is not null
  )
);

create table if not exists public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  phone_e164 text not null,
  template_name text,
  provider_message_id text unique,
  delivery_status text not null default 'queued'
    check (delivery_status in (
      'queued', 'submitted', 'sent', 'delivered',
      'read', 'failed', 'skipped'
    )),
  error_message text,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists social_posts_status_schedule_idx
  on public.social_posts(status, scheduled_at);

create index if not exists marketing_approvals_pending_idx
  on public.marketing_approvals(status, requested_at);

create index if not exists whatsapp_consents_status_idx
  on public.whatsapp_consents(consent_status);

create index if not exists whatsapp_message_logs_campaign_idx
  on public.whatsapp_message_logs(campaign_id, delivery_status);

create index if not exists whatsapp_message_logs_phone_idx
  on public.whatsapp_message_logs(phone_e164, created_at desc);

alter table public.social_posts enable row level security;
alter table public.marketing_approvals enable row level security;
alter table public.social_platform_connections enable row level security;
alter table public.whatsapp_consents enable row level security;
alter table public.whatsapp_message_logs enable row level security;

-- Social content: marketing staff can prepare drafts and request approval.
drop policy if exists social_posts_read on public.social_posts;
create policy social_posts_read
  on public.social_posts for select to authenticated
  using (private.is_marketing_or_admin_manager());

drop policy if exists social_posts_insert on public.social_posts;
create policy social_posts_insert
  on public.social_posts for insert to authenticated
  with check (
    private.is_marketing_or_admin_manager()
    and status not in ('approved', 'scheduled', 'publishing', 'published')
  );

drop policy if exists social_posts_update on public.social_posts;
create policy social_posts_update
  on public.social_posts for update to authenticated
  using (private.is_marketing_or_admin_manager())
  with check (
    private.is_admin_or_manager()
    or status not in ('approved', 'scheduled', 'publishing', 'published')
  );

drop policy if exists social_posts_delete on public.social_posts;
create policy social_posts_delete
  on public.social_posts for delete to authenticated
  using (private.is_admin_or_manager());

-- Approval requests can be viewed by marketing and management.
drop policy if exists marketing_approvals_read
  on public.marketing_approvals;
create policy marketing_approvals_read
  on public.marketing_approvals for select to authenticated
  using (private.is_marketing_or_admin_manager());

drop policy if exists marketing_approvals_insert
  on public.marketing_approvals;
create policy marketing_approvals_insert
  on public.marketing_approvals for insert to authenticated
  with check (
    private.is_marketing_or_admin_manager()
    and status = 'pending'
  );

drop policy if exists marketing_approvals_review
  on public.marketing_approvals;
create policy marketing_approvals_review
  on public.marketing_approvals for update to authenticated
  using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- Connection records contain metadata only; OAuth secrets belong server-side.
drop policy if exists social_connections_read
  on public.social_platform_connections;
create policy social_connections_read
  on public.social_platform_connections for select to authenticated
  using (private.is_marketing_or_admin_manager());

drop policy if exists social_connections_manage
  on public.social_platform_connections;
create policy social_connections_manage
  on public.social_platform_connections for all to authenticated
  using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- Only authorized marketing and management users can access consent records.
drop policy if exists whatsapp_consents_read
  on public.whatsapp_consents;
create policy whatsapp_consents_read
  on public.whatsapp_consents for select to authenticated
  using (private.is_marketing_or_admin_manager());

drop policy if exists whatsapp_consents_insert
  on public.whatsapp_consents;
create policy whatsapp_consents_insert
  on public.whatsapp_consents for insert to authenticated
  with check (private.is_marketing_or_admin_manager());

drop policy if exists whatsapp_consents_update
  on public.whatsapp_consents;
create policy whatsapp_consents_update
  on public.whatsapp_consents for update to authenticated
  using (private.is_marketing_or_admin_manager())
  with check (private.is_marketing_or_admin_manager());

-- Delivery logs are readable by authorized staff.
-- No authenticated write policy: sending/webhook code must be server-side.
drop policy if exists whatsapp_message_logs_read
  on public.whatsapp_message_logs;
create policy whatsapp_message_logs_read
  on public.whatsapp_message_logs for select to authenticated
  using (private.is_marketing_or_admin_manager());

-- Protect publishing state transitions at database level.
-- Draft creation and ordinary content editing remain possible.
-- Actual publishing must be performed by trusted server-side code.

create or replace function private.guard_social_post_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_role text;
  required_approval_status text;
begin
  caller_role := coalesce(auth.role(), '');

  -- Only trusted server-side service-role code may publish.
  if new.status in ('publishing', 'published')
     and caller_role <> 'service_role' then
    raise exception 'Publishing requires trusted server-side execution';
  end if;

  -- Approval and scheduling require a manager/admin or trusted server.
  if new.status in ('approved', 'scheduled')
     and caller_role <> 'service_role'
     and not private.is_admin_or_manager() then
    raise exception 'Manager approval is required';
  end if;

  -- Approval-related states must have a matching review record.
  required_approval_status := case
    when new.status in ('approved', 'scheduled') then 'approved'
    when new.status = 'rejected' then 'rejected'
    when new.status = 'pending_approval' then 'pending'
    else null
  end;

  if required_approval_status is not null
     and not exists (
       select 1
       from public.marketing_approvals a
       where a.entity_type = 'social_post'
         and a.entity_id = new.id
         and a.status = required_approval_status
     ) then
    raise exception 'A matching marketing approval record is required';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_social_post_status
  on public.social_posts;

create trigger guard_social_post_status
before insert or update of status
on public.social_posts
for each row
execute function private.guard_social_post_status();

revoke all on function private.guard_social_post_status()
  from public, anon, authenticated;
