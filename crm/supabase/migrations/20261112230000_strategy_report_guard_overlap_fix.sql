-- Resolve overlapping report-history guards.
-- strategy_report_history_guard already enforces immutable approved/sent snapshots
-- while allowing the explicitly controlled approved -> sent confirmation.
-- The older final-version trigger rejected every UPDATE to approved reports,
-- including that permitted confirmation, so remove only the redundant trigger.
drop trigger if exists strategy_report_final_version_lock on public.strategy_report_history;
