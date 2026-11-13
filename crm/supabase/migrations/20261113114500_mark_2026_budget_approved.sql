-- Mark the confirmed 2026 charter branding and CRM implementation budget as approved.
update public.strategy_annual_budgets b
set status = 'approved',
    approved_amount = 300000000,
    notes = 'Source: uploaded general strategy document. Approved 2026 budget of UGX 300,000,000 for charter branding and CRM implementation. Approval status reflects the confirmed budget; actual expenditure must be tracked separately.',
    updated_at = now()
from public.strategy_plans p
where b.plan_id = p.id
  and p.strategy_year = 2026
  and b.proposed_amount = 300000000
  and b.notes ilike '%charter branding%'
  and b.notes ilike '%CRM implementation%';
