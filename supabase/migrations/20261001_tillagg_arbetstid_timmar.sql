-- 20261001_tillagg_arbetstid_timmar.sql
--
-- Tilläggsfakturor i fakturamodalen (BE-0008974/75, 2026-10-01):
--
-- 1. Arbetstiden för att hantera tilläggen faktureras som TIMMAR: antal =
--    timmar (ökningen, addon_labour_hours minus addon_labour_hours_before),
--    à-pris = kundens timpris × dagar / 365. Summan räknas som förut på
--    hela raden (round(timmar × timpris × dagar / 365, 2)) och ändras inte.
--    Går summan inte jämnt ut på timmarna (1,5 h) avrundas à-priset till
--    två decimaler och summan behålls: 599,05 kr = 1,5 h à 399,37 kr.
--    Totalen är sanningen, à-priset är en visning av den.
--
--    case_billing_items.quantity och invoice_items.quantity var integer och
--    kunde inte bära 1,5 h. De blir numeric (contract_billing_items.quantity
--    är redan numeric). Inga vyer eller funktionsresultat beror på typen.
--
-- 2. contract_billing_items.case_billing_item_id: ärenderaden som
--    merförsäljningsraden kopierades från. Fakturamodalen och generatorn
--    hittar tilläggsradens årspris och periodstart via den i stället för att
--    matcha på kod eller namn.

alter table public.case_billing_items alter column quantity type numeric using quantity::numeric;
alter table public.invoice_items alter column quantity type numeric using quantity::numeric;

alter table public.contract_billing_items
  add column if not exists case_billing_item_id uuid references public.case_billing_items(id) on delete set null;

comment on column public.contract_billing_items.case_billing_item_id is
  'Ärenderaden (case_billing_items) som merförsäljningsraden kopierades från vid avslut. Bär tilläggsradens årspris och periodstart till fakturan.';

create index if not exists contract_billing_items_case_billing_item_id_idx
  on public.contract_billing_items (case_billing_item_id)
  where case_billing_item_id is not null;

-- Bakåtfyllnad för tilläggsrader: entydig träff på ärende + kod
update public.contract_billing_items cbi
set case_billing_item_id = x.cb_id
from (
  select c.id as cbi_id, min(k.id::text)::uuid as cb_id, count(*) as n
  from public.contract_billing_items c
  join public.case_billing_items k
    on k.case_id = c.case_id
   and k.item_type = 'service'
   and k.is_addon_prorata_line
   and coalesce(k.service_code, k.article_code) = c.article_code
   and k.status <> 'cancelled'
  where c.item_type = 'ad_hoc' and c.case_billing_item_id is null
  group by c.id
) x
where cbi.id = x.cbi_id and x.n = 1;

-- Arbetstidens pro rata: timmar × pro rata-timpris
create or replace function public.addon_labour_prorata_recalc(p_case_id uuid, p_contract_id uuid)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  l record;
  v_unit uuid;
  v_created timestamptz;
  v_start date;
  v_next date;
  v_rate numeric;
  v_delta numeric;
  v_total numeric := 0;
  v_unit_price numeric := 0;
begin
  select * into l from case_billing_items
  where case_id = p_case_id and is_addon_prorata_line and is_addon_labour_line and status = 'pending'
  limit 1;
  if not found then return null; end if;

  select customer_id, created_at into v_unit, v_created from cases where id = p_case_id;
  v_next := case when p_contract_id is not null then contract_next_period_start(p_contract_id, v_today) end;
  v_rate := addon_labour_hourly_price(v_unit, p_contract_id);

  select min(start_day) into v_start from (
    select greatest(coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365) as start_day
    from equipment_placements ep
    where ep.customer_id = v_unit and ep.is_addon and ep.status = 'active'
      and ep.addon_billing_model = 'per_year'
      and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
      and coalesce(ep.addon_marked_at, ep.placed_at) >= v_created
    union all
    select greatest(coalesce(s.addon_effective_from, (coalesce(s.addon_marked_at, s.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365)
    from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
    where fp.customer_id = v_unit and s.is_addon and s.status = 'active'
      and s.addon_billing_model = 'per_year'
      and coalesce(s.addon_contract_mode, 'separate') = 'separate'
      and coalesce(s.addon_marked_at, s.placed_at) >= v_created
  ) x;

  v_delta := greatest(coalesce(l.addon_labour_hours, 0) - coalesce(l.addon_labour_hours_before, 0), 0);
  if v_start is not null and v_next is not null and v_rate is not null and v_delta > 0 then
    -- Summan exakt som förut (hela raden avrundas en gång), à-priset härleds
    v_total := round(v_delta * v_rate * greatest(v_next - v_start, 0) / 365.0, 2);
    v_unit_price := round(v_total / v_delta, 2);
  end if;

  update case_billing_items
  set quantity = case when v_delta > 0 then v_delta else 1 end,
      unit_price = v_unit_price, discounted_price = v_unit_price, total_price = v_total,
      addon_annual_unit_price = v_rate,
      billing_start_date = v_next,
      updated_at = now()
  where id = l.id;
  return v_total;
end;
$function$;
