-- Automatically schedule the first quarterly review when an MOU becomes active.
create or replace function public.set_partnership_mou_next_review_due()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.agreement_status = 'active' then
    if new.next_review_due is null or
       (tg_op = 'UPDATE' and old.agreement_status is distinct from 'active') then
      new.next_review_due := coalesce(new.last_reviewed_on, new.effective_date, current_date)
        + make_interval(months => new.review_frequency_months);
    end if;
  else
    new.next_review_due := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partnership_mou_review_due_before_write on public.partnership_mous;
create trigger partnership_mou_review_due_before_write
before insert or update on public.partnership_mous
for each row execute function public.set_partnership_mou_next_review_due();

create or replace function public.ensure_partnership_mou_quarterly_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.agreement_status = 'active' and new.next_review_due is not null then
    if not exists (
      select 1
      from public.partnership_mou_reviews r
      where r.mou_id = new.id
        and r.review_due_date = new.next_review_due
        and r.review_status in ('scheduled', 'in_progress', 'completed', 'overdue')
    ) then
      insert into public.partnership_mou_reviews (
        mou_id, review_period_start, review_period_end, review_due_date,
        reviewer_id, review_status, created_by
      ) values (
        new.id,
        coalesce(new.last_reviewed_on, new.effective_date, current_date),
        new.next_review_due,
        new.next_review_due,
        new.responsible_staff_id,
        'scheduled',
        new.created_by
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists partnership_mou_quarterly_review_after_write on public.partnership_mous;
create trigger partnership_mou_quarterly_review_after_write
after insert or update of agreement_status, next_review_due, last_reviewed_on, effective_date
on public.partnership_mous
for each row execute function public.ensure_partnership_mou_quarterly_review();

revoke all on function public.set_partnership_mou_next_review_due() from public;
revoke all on function public.ensure_partnership_mou_quarterly_review() from public;
