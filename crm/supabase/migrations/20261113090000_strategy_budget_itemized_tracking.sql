-- Itemized CIU marketing budget with actual expenditure and strategy/activity links.
create table if not exists public.strategy_budget_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  category text not null,
  item_name text not null,
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  unit_rate numeric(14,2) not null default 0 check (unit_rate >= 0),
  planned_amount numeric(14,2) not null default 0 check (planned_amount >= 0),
  actual_spent numeric(14,2) not null default 0 check (actual_spent >= 0),
  strategic_goal_id uuid references public.strategy_framework_entries(id) on delete set null,
  activity_id uuid references public.strategy_activities(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_budget_items_plan_item_unique unique (plan_id, category, item_name)
);
alter table public.strategy_budget_items enable row level security;
drop policy if exists strategy_budget_items_staff_access on public.strategy_budget_items;
create policy strategy_budget_items_staff_access on public.strategy_budget_items
  for all to authenticated using (private.is_strategy_staff()) with check (private.is_strategy_staff());
create index if not exists strategy_budget_items_plan_idx on public.strategy_budget_items(plan_id);
create index if not exists strategy_budget_items_goal_idx on public.strategy_budget_items(strategic_goal_id);
create index if not exists strategy_budget_items_activity_idx on public.strategy_budget_items(activity_id);

-- Seed the 2025–2026 budget as provided; expenditure starts at zero and is entered by staff.
insert into public.strategy_budget_items (plan_id,category,item_name,quantity,unit_rate,planned_amount)
select p.id, v.category, v.item_name, v.quantity, v.unit_rate, v.planned_amount
from public.strategy_plans p
cross join (values
('Community Engagement','Church Activations (1/month)',5,300000,1500000),
('Community Engagement','Mosque Activations (1/month)',5,300000,1500000),
('Community Engagement','School Activation',30,300000,9000000),
('Community Engagement','Mall Activations (1/month)',4,300000,1200000),
('Community Engagement','Nursing School activation',10,500000,5000000),
('Community Engagement','Hospital Activation',5,500000,2500000),
('Community Engagement','Community Outreach - Medical outreach (quarterly)',4,600000,2400000),
('Community Engagement','Events Sponsorships',6,1000000,6000000),
('Community Engagement','Martyr''s Day in Namugongo',1,2000000,2000000),
('Community Engagement','International Midwives Day',1,1000000,1000000),
('Community Engagement','International Nurses Day',1,1000000,1000000),
('Community Engagement','Marketing Workshop',3,1000000,3000000),
('Student Engagements','CIU Day',1,12000000,12000000),
('Student Engagements','University Bazar',1,1000000,1000000),
('Student Engagements','Open Day',1,2000000,2000000),
('Student Engagements','Alumni Engagement',1,2000000,2000000),
('Student Engagements','Public Lecture (LIT)',12,1000000,12000000),
('Student Engagements','Screen at the Reception',1,1500000,1500000),
('Advertising & Publications','Advertising with Phaneroo',3,1000000,3000000),
('Advertising & Publications','Annual University Guide - New Vision',1,6000000,6000000),
('Advertising & Publications','Catholic Magazine',6,300000,1800000),
('Advertising & Publications','Ministry of Education Calendar',1,500000,500000),
('Advertising & Publications','NCHE Exhibition and Publication',1,12000000,12000000),
('Radio Advertising','Eastern Radios (6 months)',4,1000000,4000000),
('Radio Advertising','Western Radio (6 months)',4,1000000,4000000),
('Radio Advertising','Central Radio (6 months)',4,1700000,6800000),
('Radio Advertising','Northern Radios (6 months)',4,1000000,4000000),
('Radio Advertising','Audio Production',4,300000,1200000),
('Outdoor Advertising','Street Pole Banners (12 months; 10 poles)',12,250000,30000000),
('Outdoor Advertising','Mukwano Billboard (12 months)',12,1700000,20400000),
('Outdoor Advertising','Makerere Billboard (12 months)',1,2500000,2500000),
('Outdoor Advertising','Juba Billboard',12,2500000,30000000),
('Outdoor Advertising','Bombo Road (12 months)',12,1770000,21240000),
('Digital Marketing','Sponsored Ads (Facebook)',12,3000000,36000000),
('Digital Marketing','Twitter (Premium)',1,375000,375000),
('Digital Marketing','TikTok (Premium)',1,0,0),
('Digital Marketing','LinkedIn (Premium)',1,2696250,2696250),
('Digital Marketing','Social Media Influencer (Dr. Hilary Okello)',12,500000,6000000),
('Digital Marketing','Graphics Software',12,80000,960000),
('Digital Marketing','Video and Photography - Content Creation',2,1000000,2000000),
('Digital Marketing','SMS Marketing - Lead Generation Campaigns',1,1500000,1500000),
('Digital Marketing','WhatsApp Advertisement (Kaye AI)',10000,250,2500000),
('Marketing Materials','Brochures (Trifold A4)',10000,1888,18880000),
('Marketing Materials','File Folders',2000,2950,5900000),
('Marketing Materials','Branded Pens',5000,550,2750000),
('Marketing Materials','T-shirts (Round Neck)',1000,20000,20000000),
('Marketing Materials','Stickers',10000,500,5000000),
('Marketing Materials','Pull-up Banners',5,250000,1250000),
('Marketing Materials','CIU Magazine (2 times)',200,23600,4720000),
('Marketing Materials','A5 Notebooks',2000,10000,20000000),
('Marketing Materials','Marketing Tent',1,5000000,5000000),
('Marketing Materials','Open-up Banners',5,420000,2100000),
('Marketing Materials','Success Cards',1500,1200,1800000),
('Commissions','5% Commission',1,50000000,50000000)
) as v(category,item_name,quantity,unit_rate,planned_amount)
where p.strategy_year = 2026
on conflict (plan_id,category,item_name) do nothing;
