-- CIU Alumni and Partnerships foundation
-- Creates the alumni relationship, self-service, events, mentorship and partnership records.
create table if not exists public.alumni (
 id uuid primary key default gen_random_uuid(), alumni_id text not null unique, student_no text,
 full_name text not null, gender text, work_email text, phone text, whatsapp text, linkedin text,
 city text, nationality text, program text, faculty text, graduation_year integer,
 employment_status text, employer text, job_title text, industry text,
 mentor boolean not null default false, volunteer boolean not null default false,
 business_owner boolean not null default false, membership_status text,
 whatsapp_group boolean not null default false, linkedin_follower boolean not null default false,
 engagement_score numeric(6,2),
 verification_status text not null default 'needs_review'
  check (verification_status in ('needs_review','in_progress','verified','contact_required')),
 missing_fields text[] not null default '{}', profile_bio text, career_interests text,
 profile_photo_url text, allow_email boolean not null default false,
 allow_sms boolean not null default false, allow_whatsapp boolean not null default false,
 source_import text not null default 'CIU Alumni Database', last_verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists alumni_name_search_idx on public.alumni using gin (to_tsvector('simple', coalesce(full_name,'')));
create index if not exists alumni_program_year_idx on public.alumni (program, graduation_year);
create index if not exists alumni_verification_idx on public.alumni (verification_status);
create index if not exists alumni_employment_idx on public.alumni (employment_status);

create table if not exists public.alumni_accounts (
 id uuid primary key default gen_random_uuid(), alumni_id uuid not null unique references public.alumni(id) on delete cascade,
 auth_user_id uuid not null unique references auth.users(id) on delete cascade,
 linked_by uuid references public.profiles(id) on delete set null, linked_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table if not exists public.alumni_profile_updates (
 id uuid primary key default gen_random_uuid(), alumni_id uuid not null references public.alumni(id) on delete cascade,
 submitted_by uuid not null references auth.users(id) on delete cascade, proposed_changes jsonb not null,
 review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, review_notes text,
 created_at timestamptz not null default now()
);
create table if not exists public.alumni_events (
 id uuid primary key default gen_random_uuid(), title text not null, description text, event_type text, venue text,
 starts_at timestamptz not null, ends_at timestamptz, registration_deadline timestamptz,
 capacity integer check (capacity is null or capacity > 0),
 status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.alumni_event_registrations (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.alumni_events(id) on delete cascade,
 alumni_id uuid not null references public.alumni(id) on delete cascade,
 registration_status text not null default 'registered' check (registration_status in ('registered','attended','cancelled','waitlisted')),
 registered_at timestamptz not null default now(), checked_in_at timestamptz, notes text, unique(event_id, alumni_id)
);
create table if not exists public.alumni_career_updates (
 id uuid primary key default gen_random_uuid(), alumni_id uuid not null references public.alumni(id) on delete cascade,
 employer text, job_title text, industry text, employment_status text, city text, country text, update_summary text,
 is_verified boolean not null default false, submitted_by uuid references auth.users(id) on delete set null,
 reviewed_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.alumni_mentorships (
 id uuid primary key default gen_random_uuid(), mentor_alumni_id uuid not null references public.alumni(id) on delete cascade,
 mentee_name text, mentee_email text, mentee_student_no text, mentee_program text, focus_area text,
 status text not null default 'pending' check (status in ('pending','active','completed','declined')),
 started_at date, ended_at date, notes text, assigned_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists public.alumni_communications (
 id uuid primary key default gen_random_uuid(), alumni_id uuid references public.alumni(id) on delete set null,
 channel text not null, subject text, message_summary text, audience text, delivery_status text,
 sent_by uuid references public.profiles(id) on delete set null, sent_at timestamptz not null default now()
);
create table if not exists public.alumni_referrals (
 id uuid primary key default gen_random_uuid(), alumni_id uuid not null references public.alumni(id) on delete cascade,
 referred_student_name text not null, referred_student_phone text, referred_student_email text, program text, intake text,
 lead_id uuid references public.leads(id) on delete set null, enrollment_status text not null default 'referred',
 incentive_status text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.alumni_membership_payments (
 id uuid primary key default gen_random_uuid(), alumni_id uuid not null references public.alumni(id) on delete cascade,
 amount numeric(14,2) not null default 0 check (amount >= 0), currency text not null default 'UGX',
 payment_date date, payment_reference text,
 payment_status text not null default 'pending' check (payment_status in ('pending','paid','waived','refunded')),
 recorded_by uuid references public.profiles(id) on delete set null, notes text, created_at timestamptz not null default now()
);

create table if not exists public.partnerships (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete set null,
 name text not null, category text,
 status text not null default 'prospect' check (status in ('prospect','engaging','negotiation','active','on_hold','expired','closed')),
 relationship_owner uuid references public.profiles(id) on delete set null, primary_contact_name text,
 primary_contact_email text, primary_contact_phone text, strategic_objective text,
 estimated_value numeric(16,2), currency text not null default 'UGX', start_date date, end_date date,
 next_action text, next_action_date date, notes text, created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists partnerships_status_idx on public.partnerships(status);
create index if not exists partnerships_end_date_idx on public.partnerships(end_date);
create table if not exists public.partnership_agreements (
 id uuid primary key default gen_random_uuid(), partnership_id uuid not null references public.partnerships(id) on delete cascade,
 agreement_title text not null, agreement_type text not null default 'MoU', reference_number text,
 signed_date date, effective_date date, expiry_date date, renewal_notice_days integer not null default 90,
 document_url text, status text not null default 'draft' check (status in ('draft','under_review','signed','expired','terminated')),
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.partnership_activities (
 id uuid primary key default gen_random_uuid(), partnership_id uuid not null references public.partnerships(id) on delete cascade,
 activity_title text not null, activity_type text, description text, planned_date date, completed_date date,
 target_beneficiaries integer, actual_beneficiaries integer, outcome text,
 status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
 owner_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);

create or replace function private.is_alumni_staff()
returns boolean language sql stable security invoker set search_path = ''
as $$
 select exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true
  and (p.role::text in ('super_admin','admin','manager')
   or coalesce(p.module_permissions,'{}'::text[]) @> array['alumni']::text[]));
$$;
create or replace function private.is_partnerships_staff()
returns boolean language sql stable security invoker set search_path = ''
as $$
 select exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true
  and (p.role::text in ('super_admin','admin','manager')
   or coalesce(p.module_permissions,'{}'::text[]) @> array['partnerships']::text[]));
$$;

alter table public.alumni enable row level security;
alter table public.alumni_accounts enable row level security;
alter table public.alumni_profile_updates enable row level security;
alter table public.alumni_events enable row level security;
alter table public.alumni_event_registrations enable row level security;
alter table public.alumni_career_updates enable row level security;
alter table public.alumni_mentorships enable row level security;
alter table public.alumni_communications enable row level security;
alter table public.alumni_referrals enable row level security;
alter table public.alumni_membership_payments enable row level security;
alter table public.partnerships enable row level security;
alter table public.partnership_agreements enable row level security;
alter table public.partnership_activities enable row level security;

revoke all on public.alumni,public.alumni_accounts,public.alumni_profile_updates,public.alumni_events,
 public.alumni_event_registrations,public.alumni_career_updates,public.alumni_mentorships,
 public.alumni_communications,public.alumni_referrals,public.alumni_membership_payments,
 public.partnerships,public.partnership_agreements,public.partnership_activities from anon,authenticated;
grant select on public.alumni,public.alumni_accounts,public.alumni_profile_updates,public.alumni_events,
 public.alumni_event_registrations,public.alumni_career_updates,public.alumni_mentorships,
 public.alumni_communications,public.alumni_referrals,public.alumni_membership_payments,
 public.partnerships,public.partnership_agreements,public.partnership_activities to authenticated;
grant update (work_email,phone,whatsapp,linkedin,city,employment_status,employer,job_title,industry,
 profile_bio,career_interests,profile_photo_url,allow_email,allow_sms,allow_whatsapp,updated_at) on public.alumni to authenticated;
grant insert on public.alumni_profile_updates,public.alumni_career_updates to authenticated;
grant insert,update,delete on public.alumni_event_registrations to authenticated;

create policy alumni_staff_read on public.alumni for select to authenticated using (private.is_alumni_staff());
create policy alumni_self_read on public.alumni for select to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni.id and aa.auth_user_id=(select auth.uid())));
create policy alumni_self_update on public.alumni for update to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni.id and aa.auth_user_id=(select auth.uid())))
 with check (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni.id and aa.auth_user_id=(select auth.uid())));
create policy alumni_accounts_staff_all on public.alumni_accounts for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_accounts_self_read on public.alumni_accounts for select to authenticated using (auth_user_id=(select auth.uid()));
create policy alumni_profile_updates_staff_all on public.alumni_profile_updates for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_profile_updates_self_read on public.alumni_profile_updates for select to authenticated using (submitted_by=(select auth.uid()));
create policy alumni_profile_updates_self_insert on public.alumni_profile_updates for insert to authenticated
 with check (submitted_by=(select auth.uid()) and exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_profile_updates.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_events_staff_all on public.alumni_events for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_events_published_read on public.alumni_events for select to authenticated
 using (status='published' and exists(select 1 from public.alumni_accounts aa where aa.auth_user_id=(select auth.uid())));
create policy alumni_event_registrations_staff_all on public.alumni_event_registrations for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_event_registrations_self_read on public.alumni_event_registrations for select to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_event_registrations.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_event_registrations_self_insert on public.alumni_event_registrations for insert to authenticated
 with check (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_event_registrations.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_career_updates_staff_all on public.alumni_career_updates for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_career_updates_self_read on public.alumni_career_updates for select to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_career_updates.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_career_updates_self_insert on public.alumni_career_updates for insert to authenticated
 with check (submitted_by=(select auth.uid()) and exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_career_updates.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_mentorships_staff_all on public.alumni_mentorships for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_mentorships_self_read on public.alumni_mentorships for select to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_mentorships.mentor_alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_communications_staff_all on public.alumni_communications for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_referrals_staff_all on public.alumni_referrals for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_referrals_self_read on public.alumni_referrals for select to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_referrals.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy alumni_membership_payments_staff_all on public.alumni_membership_payments for all to authenticated
 using (private.is_alumni_staff()) with check (private.is_alumni_staff());
create policy alumni_membership_payments_self_read on public.alumni_membership_payments for select to authenticated
 using (exists(select 1 from public.alumni_accounts aa where aa.alumni_id=alumni_membership_payments.alumni_id and aa.auth_user_id=(select auth.uid())));
create policy partnerships_staff_all on public.partnerships for all to authenticated
 using (private.is_partnerships_staff()) with check (private.is_partnerships_staff());
create policy partnership_agreements_staff_all on public.partnership_agreements for all to authenticated
 using (private.is_partnerships_staff()) with check (private.is_partnerships_staff());
create policy partnership_activities_staff_all on public.partnership_activities for all to authenticated
 using (private.is_partnerships_staff()) with check (private.is_partnerships_staff());
