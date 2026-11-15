-- Prevent the same existing strategy activity from being allocated twice to one intake.
-- The partial index preserves legacy allocations that do not have an activity_id linked.
create unique index if not exists strategy_intake_budget_allocations_intake_activity_uidx
  on public.strategy_intake_budget_allocations (intake_plan_id, activity_id)
  where activity_id is not null;

notify pgrst, 'reload schema';
