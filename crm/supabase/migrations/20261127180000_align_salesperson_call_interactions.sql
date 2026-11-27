-- Align salesperson task call outcomes with the existing engagement_interactions schema.
-- This is additive/backwards-compatible: it permits lead-linked interactions without an engagement_contacts row
-- and preserves existing outcome values while allowing the CRM task outcome labels.
alter table public.engagement_interactions
  alter column contact_id drop not null;

alter table public.engagement_interactions
  drop constraint if exists engagement_interactions_outcome_check;

alter table public.engagement_interactions
  add constraint engagement_interactions_outcome_check
  check (outcome = any (array[
    'in_progress',
    'interested',
    'applied',
    'admitted',
    'enrolled',
    'dropped',
    'resolved',
    'Interested',
    'Applied',
    'Application Submitted',
    'Admitted',
    'Paid Application Fee',
    'Acceptance Fee Paid',
    'Enrolled',
    'Follow up later',
    'Not interested',
    'Financial issues',
    'Lost Leads',
    'No Answer',
    'Unreachable',
    'Wrong Number',
    'Dropped'
  ]::text[]));

comment on column public.engagement_interactions.contact_id is
  'Optional link to an engagement contact; lead-linked CRM interactions may reference lead_id without an engagement_contacts row.';
