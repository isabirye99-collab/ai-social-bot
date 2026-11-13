-- Permit authenticated policy evaluation to resolve the private Strategy access helper.
grant usage on schema private to authenticated;
grant execute on function private.is_strategy_staff() to authenticated;
