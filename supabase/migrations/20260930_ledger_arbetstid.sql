-- 20260930_ledger_arbetstid.sql
-- Tilläggets resultat över tid räknar även "Arbetstid för att hantera tilläggen".
--
-- contract_addon_ledger(p_contract_id) läste bara stationerna. Arbetstiden på
-- avtalet (§ 6-raden: case_billing_items med case_id = avtalet,
-- is_addon_labour_line, item_type = 'service', site_customer_id = enheten) är
-- en löpande intäkt (timmar × kundens timpris per år) och en löpande kostnad
-- (timmar × Arbetstid Företag per år, kostnadsraden mappad mot § 6-raden).
--
-- Bakåtkompatibelt: samma namn och samma första parameter. Nya kolumner
-- läggs sist och arbetstidsraderna (kind = 'labour') kommer bara med när
-- p_include_labour = true, så en äldre klient som anropar med bara
-- p_contract_id får exakt samma rader som förut.
--
-- Arbetstidsradens start = samma dag som stationerna räknas från: tidigaste
-- tilläggsstationen på enheten inom avtalsåret som beslutet gäller
-- ([billing_start_date - 1 år, beslutet]), annars beslutsdagen (radens
-- created_at). Det är samma dag som ärendets pro rata-rad för arbetstiden
-- debiterar från (addon_labour_prorata_recalc), och billing_start_date är
-- bara dagen då tillägget börjar följa avtalets år.
--
-- Begränsning: timmarna har ingen historik. Ändras timmarna räknas nuvarande
-- värde från start. En rad som nollats (0 h) räknas inte alls.

drop function if exists public.contract_addon_ledger(uuid);

create or replace function public.contract_addon_ledger(
  p_contract_id uuid,
  p_include_labour boolean default false
)
returns table(
  station_id uuid,
  kind text,
  unit_id uuid,
  unit_name text,
  station_type_id uuid,
  station_type_name text,
  article_name text,
  start_at timestamptz,
  removed_at timestamptz,
  unit_price_annual numeric,
  unit_cost numeric,
  billing_model text,
  labour_hours numeric,
  labour_rate numeric,
  labour_cost_per_hour numeric
)
language sql
stable
set search_path = public
as $function$
  select e.id, 'outdoor'::text, e.customer_id, coalesce(c.site_name, c.company_name), e.station_type_id, st.name, a.name,
    coalesce(e.addon_effective_from::timestamptz, e.addon_marked_at, e.placed_at, e.created_at),
    case when e.status = 'removed' then coalesce(e.addon_removed_on::timestamptz, e.status_updated_at, e.updated_at) end,
    e.addon_unit_price_annual, coalesce(e.addon_unit_cost, a.default_price, 0), e.addon_billing_model,
    null::numeric, null::numeric, null::numeric
  from public.equipment_placements e join public.customers c on c.id = e.customer_id
  left join public.station_types st on st.id = e.station_type_id left join public.articles a on a.id = e.article_id
  where e.is_addon and e.addon_contract_id = p_contract_id and coalesce(e.addon_contract_mode, 'separate') = 'separate'
  union all
  select i.id, 'indoor'::text, fp.customer_id, coalesce(c.site_name, c.company_name), i.station_type_id, st.name, a.name,
    coalesce(i.addon_effective_from::timestamptz, i.addon_marked_at, i.placed_at, i.created_at),
    case when i.status = 'removed' then coalesce(i.addon_removed_on::timestamptz, i.status_updated_at, i.updated_at) end,
    i.addon_unit_price_annual, coalesce(i.addon_unit_cost, a.default_price, 0), i.addon_billing_model,
    null::numeric, null::numeric, null::numeric
  from public.indoor_stations i join public.floor_plans fp on fp.id = i.floor_plan_id join public.customers c on c.id = fp.customer_id
  left join public.station_types st on st.id = i.station_type_id left join public.articles a on a.id = i.article_id
  where i.is_addon and i.addon_contract_id = p_contract_id and coalesce(i.addon_contract_mode, 'separate') = 'separate'
  union all
  -- Arbetstid för att hantera tilläggen, en rad per enhet
  select l.id, 'labour'::text, l.site_customer_id, coalesce(c.site_name, c.company_name), null::uuid,
    'Arbetstid för att hantera tilläggen'::text, cost.article_name,
    least(l.created_at, coalesce(st.first_start, l.created_at)),
    null::timestamptz,
    round(l.addon_labour_hours * coalesce(l.addon_annual_unit_price, l.total_price / nullif(l.addon_labour_hours, 0)), 2),
    0::numeric,
    'per_year'::text,
    l.addon_labour_hours,
    coalesce(l.addon_annual_unit_price, l.total_price / nullif(l.addon_labour_hours, 0)),
    coalesce(cost.total_price / nullif(cost.addon_labour_hours, 0), public.addon_labour_hourly_cost())
  from public.case_billing_items l
  join public.customers c on c.id = l.site_customer_id
  left join lateral (
    select k.total_price, k.addon_labour_hours, k.article_name
    from public.case_billing_items k
    where k.case_id = l.case_id and k.is_addon_labour_line and k.item_type = 'article'
      and k.status <> 'cancelled'
      and (k.mapped_service_id = l.id or (k.mapped_service_id is null and k.site_customer_id = l.site_customer_id))
    order by (k.mapped_service_id = l.id) desc nulls last
    limit 1
  ) cost on true
  left join lateral (
    select min(s.start_at) as first_start from (
      select coalesce(e.addon_effective_from::timestamptz, e.addon_marked_at, e.placed_at, e.created_at) as start_at
      from public.equipment_placements e
      where e.is_addon and e.addon_contract_id = p_contract_id and e.customer_id = l.site_customer_id
        and coalesce(e.addon_contract_mode, 'separate') = 'separate'
      union all
      select coalesce(i.addon_effective_from::timestamptz, i.addon_marked_at, i.placed_at, i.created_at)
      from public.indoor_stations i join public.floor_plans fp on fp.id = i.floor_plan_id
      where i.is_addon and i.addon_contract_id = p_contract_id and fp.customer_id = l.site_customer_id
        and coalesce(i.addon_contract_mode, 'separate') = 'separate'
    ) s
    where l.billing_start_date is not null
      and s.start_at >= (l.billing_start_date - interval '1 year')
      and s.start_at <= l.created_at
  ) st on true
  where p_include_labour
    and l.case_id = p_contract_id
    and l.is_addon_labour_line
    and not coalesce(l.is_addon_prorata_line, false)
    and l.item_type = 'service'
    and l.status <> 'cancelled'
    and l.site_customer_id is not null
    and coalesce(l.addon_labour_hours, 0) > 0
$function$;

comment on function public.contract_addon_ledger(uuid, boolean) is
  'Tilläggens resultat över tid: stationerna (kostnad en gång, intäkt från beslutet) och med p_include_labour även arbetstiden för att hantera tilläggen per enhet (kind = labour, löpande intäkt och kostnad per år).';

revoke all on function public.contract_addon_ledger(uuid, boolean) from public, anon;
grant execute on function public.contract_addon_ledger(uuid, boolean) to authenticated, service_role;
