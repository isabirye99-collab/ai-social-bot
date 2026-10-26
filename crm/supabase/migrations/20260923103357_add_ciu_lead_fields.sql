alter table public.leads
    add column if not exists ciu_number text,
    add column if not exists feedback text,
    add column if not exists follow_up_status text not null default 'Pending',
    add column if not exists amount_paid numeric(14,2) not null default 0;

  create unique index if not exists leads_ciu_number_unique_idx
    on public.leads (ciu_number)
    where ciu_number is not null and btrim(ciu_number) <> '';

  create index if not exists leads_follow_up_status_idx
    on public.leads (follow_up_status);;
