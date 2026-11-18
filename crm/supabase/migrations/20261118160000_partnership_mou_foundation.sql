-- CIU CRM Partnerships: MOU lifecycle, commitments, quarterly reviews and scholarships.
-- Additive migration: existing partnership records are preserved.
create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  category text,
  status text not null default 'prospect',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partnership_mous (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  agreement_title text not null,
  agreement_type text not null check (agreement_type in ('academic', 'marketing', 'other')),
  agreement_reference text,
  signed_date date,
  effective_date date,
  expiry_date date,
  agreement_status text not null default 'draft'
    check (agreement_status in ('draft', 'pending_signature', 'active', 'suspended', 'expired', 'terminated', 'renewal_in_progress')),
  responsible_staff_id uuid references public.profiles(id) on delete set null,
  renewal_owner_id uuid references public.profiles(id) on delete set null,
  renewal_notes text,
  document_url text,
  review_frequency_months integer not null default 3 check (review_frequency_months > 0),
  last_reviewed_on date,
  next_review_due date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_mous_dates_check check (
    effective_date is null or expiry_date is null or expiry_date >= effective_date
  )
);

create table if not exists public.partnership_mou_commitments (
  id uuid primary key default gen_random_uuid(),
  mou_id uuid not null references public.partnership_mous(id) on delete cascade,
  commitment_title text not null,
  description text,
  commitment_category text not null default 'other'
    check (commitment_category in ('academic', 'recruitment', 'marketing', 'scholarship', 'financial', 'engagement', 'other')),
  responsible_party text not null default 'shared'
    check (responsible_party in ('ciu', 'partner', 'shared')),
  target_value numeric(14,2),
  achieved_value numeric(14,2) not null default 0,
  unit text,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'at_risk', 'not_met', 'cancelled')),
  evidence_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_mou_commitments_values_check check (
    (target_value is null or target_value >= 0) and achieved_value >= 0
  )
);

create table if not exists public.partnership_mou_reviews (
  id uuid primary key default gen_random_uuid(),
  mou_id uuid not null references public.partnership_mous(id) on delete cascade,
  review_period_start date not null,
  review_period_end date not null,
  review_due_date date not null,
  reviewed_on date,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_status text not null default 'scheduled'
    check (review_status in ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled')),
  overall_score numeric(5,2),
  commitments_score numeric(5,2),
  engagement_score numeric(5,2),
  outcomes_score numeric(5,2),
  scholarship_score numeric(5,2),
  findings text,
  challenges text,
  evidence_url text,
  renewal_recommendation text
    check (renewal_recommendation is null or renewal_recommendation in ('renew', 'renew_with_changes', 'improve', 'suspend', 'discontinue', 'not_yet_decided')),
  next_actions text,
  next_review_due date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_mou_reviews_period_check check (review_period_end >= review_period_start),
  constraint partnership_mou_reviews_scores_check check (
    (overall_score is null or overall_score between 0 and 100) and
    (commitments_score is null or commitments_score between 0 and 100) and
    (engagement_score is null or engagement_score between 0 and 100) and
    (outcomes_score is null or outcomes_score between 0 and 100) and
    (scholarship_score is null or scholarship_score between 0 and 100)
  )
);

create table if not exists public.partnership_scholarship_allocations (
  id uuid primary key default gen_random_uuid(),
  mou_id uuid not null references public.partnership_mous(id) on delete cascade,
  allocation_name text not null,
  academic_year text,
  programme_name text,
  number_of_awards integer not null default 0 check (number_of_awards >= 0),
  award_value numeric(14,2),
  currency text not null default 'UGX',
  allocation_status text not null default 'planned'
    check (allocation_status in ('planned', 'approved', 'open', 'fully_allocated', 'closed', 'cancelled')),
  eligibility_notes text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_scholarship_allocations_value_check check (award_value is null or award_value >= 0)
);

create table if not exists public.partnership_scholarship_recipients (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.partnership_scholarship_allocations(id) on delete cascade,
  student_name text not null,
  student_number text,
  programme_name text,
  lead_id uuid references public.leads(id) on delete set null,
  admission_id uuid,
  award_value numeric(14,2),
  currency text not null default 'UGX',
  recipient_status text not null default 'nominated'
    check (recipient_status in ('nominated', 'approved', 'offered', 'accepted', 'enrolled', 'declined', 'withdrawn', 'completed')),
  decision_date date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_scholarship_recipients_value_check check (award_value is null or award_value >= 0)
);

create index if not exists partnership_mous_partner_idx on public.partnership_mous(partnership_id);
create index if not exists partnership_mous_status_expiry_idx on public.partnership_mous(agreement_status, expiry_date);
create index if not exists partnership_mous_review_due_idx on public.partnership_mous(next_review_due);
create index if not exists partnership_mou_commitments_due_idx on public.partnership_mou_commitments(mou_id, due_date, status);
create index if not exists partnership_mou_reviews_due_idx on public.partnership_mou_reviews(review_status, review_due_date);
create index if not exists partnership_scholarship_allocations_mou_idx on public.partnership_scholarship_allocations(mou_id);
create index if not exists partnership_scholarship_recipients_allocation_idx on public.partnership_scholarship_recipients(allocation_id, recipient_status);

alter table public.partnership_mous enable row level security;
alter table public.partnership_mou_commitments enable row level security;
alter table public.partnership_mou_reviews enable row level security;
alter table public.partnership_scholarship_allocations enable row level security;
alter table public.partnership_scholarship_recipients enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'partnership_mous',
    'partnership_mou_commitments',
    'partnership_mou_reviews',
    'partnership_scholarship_allocations',
    'partnership_scholarship_recipients'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_staff_access', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_partnerships_staff()) with check (private.is_partnerships_staff())',
      tbl || '_staff_access', tbl
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end
$$;
