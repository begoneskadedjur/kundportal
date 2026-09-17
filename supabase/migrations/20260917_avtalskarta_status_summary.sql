-- Avtalskartans status per kund, för markören i Befintliga kunder.
-- Speglar de vitala delarna i contractCompleteness.ts (avtalstyp, omfattning,
-- premie, faktureringsvillkor, fakturaplan, besöksfrekvens, schema, löptid,
-- signering, prislista för avrop) men räknas i databasen så listan kan hämta allt i ett anrop.
--
-- status: 'none' = inga levande avtalspapper (bara kundrad/importrester),
--         'incomplete' = papper finns men vitala delar saknas,
--         'complete' = alla papper kompletta.

create or replace function public.contract_map_status_summary()
returns table (
  root_customer_id uuid,
  organization_id uuid,
  live_contracts integer,
  status text,
  missing_count integer,
  missing text[]
)
language sql
stable
as $$
  with roots as (
    select c.id, c.organization_id from public.customers c where c.parent_customer_id is null
  ),
  live as (
    select ct.*, coalesce(cu.parent_customer_id, cu.id) as root_id,
      (cu.parent_customer_id is not null) as is_unit,
      coalesce(ct.contract_type, ct.label) ilike 'Avropsavtal%' as is_avrop
    from public.contracts ct
    join public.customers cu on cu.id = ct.customer_id
    where public.contract_is_live(ct)
  ),
  -- Enheter som avtalet täcker med stationskontroll, för schemakravet
  covered as (
    select l.id as contract_id, cs.customer_id
    from live l join public.contract_sites cs on cs.contract_id = l.id
    where (cs.active_to is null or cs.active_to >= current_date) and coalesce(cs.service_mode, 'inspection') = 'inspection'
    union
    select l.id, l.customer_id from live l where l.is_unit
    union
    select l.id, u.id from live l join public.customers u on u.parent_customer_id = l.root_id where l.covers_all_sites
  ),
  no_schedule as (
    select cv.contract_id, count(*) as n
    from covered cv
    where not exists (
      select 1 from public.recurring_schedules rs
      where rs.customer_id = cv.customer_id and rs.status = 'active'
    )
    group by cv.contract_id
  ),
  checks as (
    select l.root_id, l.id,
      array_remove(array[
        case when coalesce(l.label, l.contract_type) is null then 'Avtalstyp' end,
        case when not (l.covers_all_sites or l.is_unit or exists (
          select 1 from public.contract_sites cs where cs.contract_id = l.id and (cs.active_to is null or cs.active_to >= current_date)
        )) then 'Omfattning' end,
        case when not (l.is_avrop or coalesce(l.annual_value, 0) > 0) then 'Årspremie' end,
        case when not (l.is_avrop or coalesce(l.annual_value, 0) <= 0
          or (l.billing_frequency is not null and (l.billing_anchor_month is not null or l.billing_frequency = 'on_demand'))) then 'Faktureringsvillkor' end,
        case when not (l.is_avrop or l.visits_per_year is not null or l.visit_frequency is not null) then 'Besöksfrekvens' end,
        case when not l.is_avrop and coalesce((select n from no_schedule ns where ns.contract_id = l.id), 0) > 0 then 'Schema' end,
        case when not (coalesce(l.contract_start_date, l.start_date) is not null and l.notice_period_months is not null
          and (l.contract_end_date is not null or l.renewal_mode = 'rolling' or l.renewal_mode is null)) then 'Löptid' end,
        case when l.signed_at is null then 'Signering' end,
        case when not (l.is_avrop or coalesce(l.annual_value, 0) <= 0 or l.billing_active = false or exists (
          select 1 from public.invoices i left join public.invoice_items ii on ii.invoice_id = i.id
          where i.invoice_type = 'contract' and i.status <> 'cancelled' and i.billing_period_start > current_date
            and (i.contract_id = l.id or ii.contract_id = l.id)
        )) then 'Fakturaplan' end,
        case when l.is_avrop and l.price_list_id is null then 'Prislista' end
      ], null) as missing
    from live l
  ),
  agg as (
    select ch.root_id, count(*)::integer as live_contracts,
      (select array_agg(distinct m order by m) from checks c2, unnest(c2.missing) m where c2.root_id = ch.root_id) as missing
    from checks ch group by ch.root_id
  )
  select r.id, r.organization_id,
    coalesce(a.live_contracts, 0),
    case when coalesce(a.live_contracts, 0) = 0 then 'none'
         when coalesce(array_length(a.missing, 1), 0) > 0 then 'incomplete'
         else 'complete' end,
    coalesce(array_length(a.missing, 1), 0),
    coalesce(a.missing, '{}'::text[])
  from roots r left join agg a on a.root_id = r.id
$$;

grant execute on function public.contract_map_status_summary() to authenticated;
