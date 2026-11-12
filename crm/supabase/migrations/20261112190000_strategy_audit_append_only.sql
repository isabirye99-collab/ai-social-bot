-- Strategy audit history must be written by trusted database triggers only.
-- Preserve existing events; prevent authenticated clients from forging or altering audit records.
drop policy if exists strategy_audit_events_insert on public.strategy_audit_events;
drop policy if exists strategy_audit_events_update on public.strategy_audit_events;
drop policy if exists strategy_audit_events_delete on public.strategy_audit_events;

revoke insert, update, delete, truncate, references, trigger
  on table public.strategy_audit_events from anon, authenticated;

-- The SECURITY DEFINER trigger function records events on behalf of the transaction.
-- Keep its search_path pinned in the function definition and do not expose it as an RPC.
revoke execute on function public.strategy_record_governance_change() from public, anon, authenticated;

comment on table public.strategy_audit_events is
  'Append-only audit history. Authenticated users may read according to RLS; trusted database triggers write events.';
