alter table public.engagement_interactions
  add column if not exists lead_id uuid null references public.leads(id) on delete set null,
  add column if not exists task_id uuid null references public.tasks(id) on delete set null;

create index if not exists engagement_interactions_lead_id_idx
  on public.engagement_interactions(lead_id);

create index if not exists engagement_interactions_task_id_idx
  on public.engagement_interactions(task_id);
