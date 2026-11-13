alter table public.strategy_intake_budget_allocations
  add column if not exists allocated_quantity numeric(14,3) not null default 0 check (allocated_quantity >= 0);

alter table public.strategy_intake_budget_allocations
  add column if not exists intake_unit_rate numeric(14,2) not null default 0 check (intake_unit_rate >= 0);

-- Preserve historical allocation amounts while providing best-effort quantity/rate values.
-- The annual budget rate is used only to backfill existing records; future intake rates are editable.
update public.strategy_intake_budget_allocations a
set intake_unit_rate = coalesce(b.unit_rate, 0),
    allocated_quantity = case
      when coalesce(b.unit_rate, 0) > 0 then round(a.allocated_amount / b.unit_rate, 3)
      else 0
    end
from public.strategy_budget_items b
where b.id = a.budget_item_id;

comment on column public.strategy_intake_budget_allocations.allocated_quantity is
  'Quantity planned for this individual intake; may exceed the annual quantity with a visible application warning.';
comment on column public.strategy_intake_budget_allocations.intake_unit_rate is
  'Unit rate for this individual intake; can differ from the annual budget item rate.';
comment on column public.strategy_intake_budget_allocations.allocated_amount is
  'Planned total for this intake, calculated as allocated_quantity multiplied by intake_unit_rate.';
