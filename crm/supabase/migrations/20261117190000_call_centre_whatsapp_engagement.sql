-- Call Centre & WhatsApp Engagement log. Additive migration; preserves existing CRM records.
create table if not exists public.engagement_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  school_id uuid references public.schools(id) on delete set null,
  program text,
  source text not null default 'call_centre' check (source in ('call_centre','whatsapp','school_outreach','other')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists engagement_contacts_phone_idx on public.engagement_contacts(phone);
create index if not exists engagement_contacts_name_idx on public.engagement_contacts(lower(full_name));

create table if not exists public.engagement_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.engagement_contacts(id) on delete cascade,
  channel text not null check (channel in ('incoming_call','outgoing_call','incoming_whatsapp','outgoing_whatsapp')),
  reason text not null,
  response text not null default 'pending',
  notes text,
  outcome text not null default 'in_progress' check (outcome in ('in_progress','interested','applied','admitted','enrolled','dropped','resolved')),
  assigned_to uuid references auth.users(id) on delete set null,
  follow_up_at timestamptz,
  contacted_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists engagement_interactions_contact_idx on public.engagement_interactions(contact_id);
create index if not exists engagement_interactions_date_idx on public.engagement_interactions(contacted_at desc);
create index if not exists engagement_interactions_followup_idx on public.engagement_interactions(follow_up_at) where follow_up_at is not null;

alter table public.engagement_contacts enable row level security;
alter table public.engagement_interactions enable row level security;
drop policy if exists "Authenticated staff manage engagement contacts" on public.engagement_contacts;
create policy "Authenticated staff manage engagement contacts" on public.engagement_contacts for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated staff manage engagement interactions" on public.engagement_interactions;
create policy "Authenticated staff manage engagement interactions" on public.engagement_interactions for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.engagement_contacts to authenticated;
grant select, insert, update, delete on public.engagement_interactions to authenticated;
