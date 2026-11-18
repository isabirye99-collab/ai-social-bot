-- Link Partnership follow-up actions to the existing CRM Tasks module.
alter table public.tasks
  add column if not exists partnership_mou_id uuid references public.partnership_mous(id) on delete set null,
  add column if not exists partnership_mou_review_id uuid references public.partnership_mou_reviews(id) on delete set null;

create index if not exists tasks_partnership_mou_id_idx on public.tasks(partnership_mou_id);
create index if not exists tasks_partnership_mou_review_id_idx on public.tasks(partnership_mou_review_id);
