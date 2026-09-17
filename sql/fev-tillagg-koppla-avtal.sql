-- FEV (kundnr 5004): 35 tilläggsstationer har läget 'separate' men inget avtal
-- kopplat, så § 6-synken räknade dem aldrig (0 st) och inga tilläggsfakturor
-- planerades. Kopplar varje station till avtalet som täcker enheten via
-- contract_sites och låser årspriset ur prislistan (2 348 / 1 686 kr).
-- Kör i Supabase SQL-editorn som postgres. Förväntat: outdoor 22, indoor 15 (inga utan pris).
begin;

with fev_contracts as (
  select cs.contract_id, cs.customer_id as unit_id
  from contract_sites cs join contracts c on c.id = cs.contract_id
  where c.customer_id = '9da6ff49-eaab-4bbe-a657-9c59ce8cfac7'
    and c.status in ('signed', 'active')
    and (cs.active_to is null or cs.active_to >= current_date)
),
upd_out as (
  update equipment_placements ep
  set addon_contract_id = fc.contract_id,
      addon_unit_price_annual = coalesce(ep.addon_unit_price_annual, addon_annual_price_for_type(ep.station_type_id, ep.customer_id, fc.contract_id))
  from fev_contracts fc
  where fc.unit_id = ep.customer_id and ep.is_addon and ep.status = 'active'
    and ep.addon_contract_mode = 'separate' and ep.addon_contract_id is null
  returning ep.id, ep.addon_unit_price_annual
),
upd_in as (
  update indoor_stations s
  set addon_contract_id = fc.contract_id,
      addon_unit_price_annual = coalesce(s.addon_unit_price_annual, addon_annual_price_for_type(s.station_type_id, fp.customer_id, fc.contract_id))
  from floor_plans fp, fev_contracts fc
  where fp.id = s.floor_plan_id and fc.unit_id = fp.customer_id and s.is_addon and s.status = 'active'
    and s.addon_contract_mode = 'separate' and s.addon_contract_id is null
  returning s.id, s.addon_unit_price_annual
)
select 'outdoor' as kind, count(*) as n, count(*) filter (where addon_unit_price_annual is null) as utan_pris from upd_out
union all
select 'indoor', count(*), count(*) filter (where addon_unit_price_annual is null) from upd_in;

-- § 6-raderna får antal och pris (triggern gör detta också, men uttryckligt skadar inte)
select sync_addon_period_lines(null, id, null) from contracts
where customer_id = '9da6ff49-eaab-4bbe-a657-9c59ce8cfac7' and status in ('signed', 'active');

-- Kontroll: förväntat Återvinning 10, KVV 3, HK 3, Reningsverk 19 fördelat på typ
select left(cbi.case_id::text, 8) as avtal, u.site_name, cbi.service_name, cbi.quantity, cbi.unit_price, cbi.total_price
from case_billing_items cbi join customers u on u.id = cbi.site_customer_id
where cbi.case_type = 'contract' and cbi.billing_model in ('per_year', 'per_month')
  and cbi.case_id in (select id from contracts where customer_id = '9da6ff49-eaab-4bbe-a657-9c59ce8cfac7')
order by 1, 2, 3;

commit;
