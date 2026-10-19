-- Avtalskartans status per kund, för markören i Befintliga kunder.
-- Speglar de vitala delarna i contractCompleteness.ts (avtalstyp, omfattning,
-- premie, faktureringsvillkor, fakturaplan, besöksfrekvens, schema, löptid,
-- signering, prislista för avrop) men räknas i databasen så listan kan hämta allt i ett anrop.
--
-- status: 'none' = inga levande avtalspapper (bara kundrad/importrester),
--         'incomplete' = papper finns men vitala delar saknas,
--         'complete' = alla papper kompletta.

-- Nästa period i planeringsfönstret som börjar efter i dag och saknar faktura.
-- Speglar contractPlanner.bindingWindow + iterPeriodsPure (beslut 2026-10-15):
-- perioder på månadens första dag (ankarmånad för årsavtal), hela perioden måste
-- rymmas i bindningstiden, nästa bindningsperiod först efter sista uppsägningsdag.
-- null = inget att planera i dag.
create or replace function public.contract_next_unplanned_period(p_contract_id uuid, p_today date default current_date)
returns date
language plpgsql
stable
as $
declare
  c record;
  v_step int;
  v_notice int;
  v_current_end date;
  v_deadline date;
  v_plan_end date;
  v_full boolean;
  v_anchor int;
  v_first date;
  v_p date;
  v_k int;
begin
  select contract_start_date, start_date, contract_end_date, effective_end_date, terminated_at, renewal_mode,
         billing_frequency, billing_anchor_month, notice_period_months
    into c from public.contracts where id = p_contract_id;
  if c is null or coalesce(c.contract_start_date, c.start_date) is null then return null; end if;
  if c.billing_frequency is null or c.billing_frequency = 'on_demand' then return null; end if;

  v_step := case c.billing_frequency when 'monthly' then 1 when 'quarterly' then 3 when 'semi_annual' then 6 else 12 end;
  v_full := c.billing_frequency in ('annual', 'semi_annual');
  v_notice := coalesce(c.notice_period_months, 2);

  if c.terminated_at is not null then
    v_plan_end := coalesce(c.effective_end_date, c.contract_end_date);
    if v_plan_end is null then return null; end if;
  elsif c.contract_end_date is null then
    v_plan_end := p_today + (v_notice || ' months')::interval;
  elsif coalesce(c.renewal_mode, 'rolling') = 'option' then
    v_plan_end := c.contract_end_date;
  else
    v_current_end := c.contract_end_date;
    v_k := 0;
    while v_current_end < p_today and v_k < 100 loop
      v_current_end := v_current_end + interval '1 year';
      v_k := v_k + 1;
    end loop;
    v_deadline := v_current_end - (v_notice || ' months')::interval;
    v_plan_end := case when p_today > v_deadline then v_current_end + interval '12 months' else v_current_end end;
  end if;

  if c.billing_frequency = 'annual' then
    v_anchor := coalesce(c.billing_anchor_month, extract(month from coalesce(c.contract_start_date, c.start_date))::int);
    v_first := make_date(extract(year from coalesce(c.contract_start_date, c.start_date))::int, v_anchor, 1);
    if v_first < date_trunc('month', coalesce(c.contract_start_date, c.start_date))::date then
      v_first := v_first + interval '1 year';
    end if;
  else
    v_first := date_trunc('month', coalesce(c.contract_start_date, c.start_date))::date;
  end if;

  for v_k in 0..600 loop
    v_p := (v_first + (v_k * v_step) * interval '1 month')::date;
    if v_p >= v_plan_end then exit; end if;
    if v_full and (v_p + ((v_step - 1) || ' months')::interval)::date > v_plan_end then exit; end if;
    if v_p > p_today then
      if not exists (
        select 1 from public.invoices i left join public.invoice_items ii on ii.invoice_id = i.id
        where i.invoice_type = 'contract' and i.status <> 'cancelled'
          and (i.contract_id = p_contract_id or ii.contract_id = p_contract_id)
          and i.billing_period_start < (v_p + (v_step || ' months')::interval)::date
          and coalesce(i.billing_period_end, i.billing_period_start) >= v_p
      ) then
        return v_p;
      end if;
      return null;
    end if;
  end loop;
  return null;
end;
$;

grant execute on function public.contract_next_unplanned_period(uuid, date) to authenticated;


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
        -- Fakturaplan: nästa period i planeringsfönstret (contract_next_unplanned_period,
        -- samma regel som contractPlanner.bindingWindow) måste ha en faktura. Inget att
        -- planera i dag = planerat.
        case when not (l.is_avrop or coalesce(l.annual_value, 0) <= 0 or l.billing_active = false
          or public.contract_next_unplanned_period(l.id) is null) then 'Fakturaplan' end,
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
