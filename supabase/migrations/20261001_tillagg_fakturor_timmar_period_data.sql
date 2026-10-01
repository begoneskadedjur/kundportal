-- 20261001_tillagg_fakturor_timmar_period_data.sql
--
-- Datarättning för tilläggsfakturor som skapades före 20261001_tillagg_arbetstid_timmar
-- (BE-0008974 / INV-202609-915419 och BE-0008975 / INV-202609-915420).
-- Totalbeloppen ändras inte. Bara fakturor som inte lämnat portalen
-- (pending_approval, ready) rörs.
--
-- 1. Arbetstidsraden: antal 1 à 801,64 blir 2 h à 400,82 (1,5 h à 399,37,
--    summan 599,05 behålls) på case_billing_items, contract_billing_items
--    och invoice_items.
-- 2. Fakturans period: tilläggsfakturan (per ärende) avser pro rata-perioden,
--    från första dagen som betalas till dagen före avtalets nästa
--    periodstart, inte avslutsmånaden. Merförsäljningsraderna på fakturan får
--    samma period så att kundkortets dubblettkontroll (kund + periodstart)
--    fortsätter att matcha.

with lab as (
  select id, greatest(coalesce(addon_labour_hours, 0) - coalesce(addon_labour_hours_before, 0), 0) as h, total_price
  from public.case_billing_items
  where is_addon_prorata_line and is_addon_labour_line and status = 'billed' and quantity = 1 and total_price > 0
)
update public.case_billing_items k
set quantity = lab.h, unit_price = round(lab.total_price / lab.h, 2), discounted_price = round(lab.total_price / lab.h, 2), updated_at = now()
from lab
where k.id = lab.id and lab.h > 0;

update public.contract_billing_items c
set quantity = k.quantity, unit_price = k.unit_price, updated_at = now()
from public.case_billing_items k, public.invoices i
where c.case_billing_item_id = k.id and k.is_addon_labour_line and k.is_addon_prorata_line
  and c.invoice_id = i.id and i.status in ('pending_approval', 'ready')
  and c.quantity = 1 and k.quantity <> 1 and c.total_price = k.total_price;

update public.invoice_items ii
set quantity = c.quantity, unit_price = c.unit_price
from public.contract_billing_items c, public.invoices i
where ii.contract_billing_item_id = c.id and ii.invoice_id = i.id
  and i.status in ('pending_approval', 'ready')
  and c.case_billing_item_id is not null
  and ii.quantity = 1 and c.quantity <> 1 and ii.total_price = c.total_price;

-- Fakturans period ur tilläggsraderna (samma formel som timelineFromRow:
-- dagar = round(à-pris / årspris × 365), första dagen = periodstart − dagar)
with addon as (
  select i.id as invoice_id,
         min(k.billing_start_date - round(
           case when k.is_addon_labour_line
                then k.total_price / nullif(greatest(coalesce(k.addon_labour_hours, 0) - coalesce(k.addon_labour_hours_before, 0), 0) * k.addon_annual_unit_price, 0)
                else k.unit_price / nullif(k.addon_annual_unit_price, 0) end * 365)::int) as p_start,
         max(k.billing_start_date - 1) as p_end
  from public.invoices i
  join public.invoice_items ii on ii.invoice_id = i.id
  join public.contract_billing_items c on c.id = ii.contract_billing_item_id
  join public.case_billing_items k on k.id = c.case_billing_item_id
  where i.invoice_type = 'adhoc' and i.case_id is not null
    and i.status in ('pending_approval', 'ready')
    and k.is_addon_prorata_line and k.billing_start_date is not null and k.addon_annual_unit_price > 0 and k.total_price > 0
  group by i.id
)
update public.invoices i
set billing_period_start = addon.p_start, billing_period_end = addon.p_end
from addon
where i.id = addon.invoice_id and addon.p_start is not null;

update public.contract_billing_items c
set billing_period_start = i.billing_period_start, billing_period_end = i.billing_period_end, updated_at = now()
from public.invoices i
where c.invoice_id = i.id and i.invoice_type = 'adhoc' and i.case_id is not null
  and i.status in ('pending_approval', 'ready')
  and exists (select 1 from public.contract_billing_items x where x.invoice_id = i.id and x.case_billing_item_id is not null)
  and (c.billing_period_start is distinct from i.billing_period_start or c.billing_period_end is distinct from i.billing_period_end);
