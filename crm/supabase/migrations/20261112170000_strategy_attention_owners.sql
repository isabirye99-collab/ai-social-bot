-- Add optional accountability owners to strategic activities and risks.
-- Existing records remain valid; null means an owner has not yet been assigned.
alter table public.strategy_activities
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

alter table public.strategy_risks
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create index if not exists strategy_activities_owner_id_idx
  on public.strategy_activities(owner_id);

create index if not exists strategy_risks_owner_id_idx
  on public.strategy_risks(owner_id);
