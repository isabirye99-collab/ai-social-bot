-- Recalculate the next quarterly review when the previous review is completed.
create or replace function public.set_partnership_mou_next_review_due()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.agreement_status = 'active' then
    if new.last_reviewed_on is distinct from old.last_reviewed_on and new.last_reviewed_on is not null then
      new.next_review_due := new.last_reviewed_on + make_interval(months => new.review_frequency_months);
    elsif new.next_review_due is null or
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

-- Keep review timestamps and the MOU's review schedule synchronized.
create or replace function public.complete_partnership_mou_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.review_status = 'completed' and old.review_status is distinct from 'completed' then
    new.reviewed_on := coalesce(new.reviewed_on, current_date);
    update public.partnership_mous
      set last_reviewed_on = new.reviewed_on,
          next_review_due = new.reviewed_on + make_interval(months => review_frequency_months)
      where id = new.mou_id and agreement_status = 'active';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partnership_mou_review_completion_before_write on public.partnership_mou_reviews;
create trigger partnership_mou_review_completion_before_write
before update on public.partnership_mou_reviews
for each row execute function public.complete_partnership_mou_review();

revoke all on function public.complete_partnership_mou_review() from public;
