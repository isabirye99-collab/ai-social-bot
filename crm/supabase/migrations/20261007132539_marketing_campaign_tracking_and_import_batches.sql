
create table if not exists public.campaign_import_batches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  file_name text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  failed_rows integer not null default 0,
  imported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_lead_imports (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  import_batch_id uuid references public.campaign_import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, lead_id)
);

alter table public.campaign_import_batches enable row level security;
alter table public.campaign_lead_imports enable row level security;

drop policy if exists "campaign_import_batches_read" on public.campaign_import_batches;
create policy "campaign_import_batches_read"
on public.campaign_import_batches for select to authenticated
using (true);

drop policy if exists "campaign_import_batches_write" on public.campaign_import_batches;
create policy "campaign_import_batches_write"
on public.campaign_import_batches for all to authenticated
using (private.is_admin_or_manager() or imported_by = auth.uid())
with check (private.is_admin_or_manager() or imported_by = auth.uid());

drop policy if exists "campaign_lead_imports_read" on public.campaign_lead_imports;
create policy "campaign_lead_imports_read"
on public.campaign_lead_imports for select to authenticated
using (true);

drop policy if exists "campaign_lead_imports_write" on public.campaign_lead_imports;
create policy "campaign_lead_imports_write"
on public.campaign_lead_imports for all to authenticated
using (private.is_admin_or_manager())
with check (private.is_admin_or_manager());

create index if not exists idx_campaign_import_batches_campaign
on public.campaign_import_batches(campaign_id, created_at desc);

create index if not exists idx_campaign_lead_imports_campaign
on public.campaign_lead_imports(campaign_id, created_at desc);
;
