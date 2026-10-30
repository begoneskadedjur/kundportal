-- Steg 11 (avtalsåret på avtalsdag), del 1 av 2: tilläggsregler version 2.
-- Bara nya funktioner utan anropare i databasen. Generatorn och cronen anropar
-- addon_gap_candidates och invoice_marking_split_ready för avtal med
-- addon_rules = 'v2' (inga i dag). Del 2 (20261030_tillaggsregler_v2_vakt.sql)
-- ersätter ledtidsfunktionen, överlappsvakten, vyn och arbetslistans glapprad.

-- 1. Har avtalet premie? Samma regel som TS (addonPlanV2.ts hasPremium):
-- annual_value > 0 eller minst ett steg i premietrappan.
create or replace function public.addon_contract_has_premium(p_contract_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from contracts c where c.id = p_contract_id and coalesce(c.annual_value, 0) > 0)
      or exists (select 1 from contract_premium_events e where e.contract_id = p_contract_id);
$$;

-- 2. Nästa periodstart enligt tilläggens takt (version 2):
-- premie månad/kvartal/halvår/år: premiens perioder (contract_next_period_start),
-- ingen premie (eller premie utan intervall): årsvis på avtalets exakta årsdag.
create or replace function public.contract_addon_next_period_start(p_contract_id uuid, p_from date)
returns date
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  v date;
begin
  select id, contract_start_date, billing_frequency into c from contracts where id = p_contract_id;
  if not found or p_from is null then
    return null;
  end if;
  if addon_contract_has_premium(p_contract_id)
     and coalesce(c.billing_frequency, '') in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    return contract_next_period_start(p_contract_id, p_from);
  end if;
  if c.contract_start_date is null then
    return null;
  end if;
  if p_from < c.contract_start_date then
    return c.contract_start_date;
  end if;
  select p.period_end + 1 into v from contract_period_on_pure(c.contract_start_date, 'annual', p_from) p;
  return v;
end $$;

-- 3. Märkningsnyckeln för en enhet på ett avtal (samma regel som
-- src/shared/addonMarking.ts): enhetens billing_reference, annars avtalets
-- invoice_reference, annars huvudkontorets (eller kundens) billing_reference.
-- Versaler utan blanksteg i ändarna, tom sträng när ingen finns.
create or replace function public.addon_marking_key_for_unit(p_unit_id uuid, p_contract_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select upper(trim(coalesce(
    nullif(trim(u.billing_reference), ''),
    nullif(trim(ct.invoice_reference), ''),
    nullif(trim(r.billing_reference), ''),
    '')))
  from (select 1) one
  left join contracts ct on ct.id = p_contract_id
  left join customers u on u.id = p_unit_id
  left join customers cc on cc.id = ct.customer_id
  left join customers r on r.id = coalesce(u.parent_customer_id, cc.parent_customer_id, ct.customer_id);
$$;

-- 4. Glappfakturans underlag: beslutade tilläggsstationer på ett v2-avtal
-- vars ärende är stängt och som saknar väntande pro rata-rad, med dagarna
-- utan täckning från startdagen till dagen före nästa ordinarie periodstart
-- (ledtidsregeln och kapningen i addon_prorata_v2_end). Redigerbara
-- tilläggsfakturor (equipment, equipment_monthly, premie med tilläggsrader)
-- som täcker startdagen tar stationen själva och utesluter den. Ett redigerbart
-- glapputkast utesluter inte (planeringen ska känna igen det), det visas i
-- on_open_gap_invoice. Läser bara.
create or replace function public.addon_gap_candidates(p_contract_id uuid)
returns table(
  station_kind text, station_id uuid, unit_id uuid, unit_name text, station_type_id uuid, type_name text,
  model text, annual numeric, start_day date, gap_from date, gap_to date, days int, end_day date,
  marking_key text, on_open_gap_invoice uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not addon_coverage_can_read() then
    raise exception 'Behörighet saknas';
  end if;
  if not exists (select 1 from contracts c where c.id = p_contract_id and c.addon_rules = 'v2') then
    return;
  end if;
  return query
  with st as (
    select 'outdoor'::text as skind, ep.id, ep.customer_id as uid, ep.station_type_id as tid,
           ep.addon_billing_model as m, ep.addon_unit_price_annual as a, ep.placed_case_id as pcase,
           coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date) as sday
    from equipment_placements ep
    where ep.addon_contract_id = p_contract_id and ep.is_addon and ep.status = 'active'
      and ep.addon_contract_mode = 'separate' and ep.addon_billing_model in ('per_year', 'per_month')
      and ep.placed_case_id is not null
    union all
    select 'indoor', s2.id, fp.customer_id, s2.station_type_id, s2.addon_billing_model, s2.addon_unit_price_annual,
           s2.placed_case_id,
           coalesce(s2.addon_effective_from, (coalesce(s2.addon_marked_at, s2.placed_at) at time zone 'Europe/Stockholm')::date)
    from indoor_stations s2 join floor_plans fp on fp.id = s2.floor_plan_id
    where s2.addon_contract_id = p_contract_id and s2.is_addon and s2.status = 'active'
      and s2.addon_contract_mode = 'separate' and s2.addon_billing_model in ('per_year', 'per_month')
      and s2.placed_case_id is not null
  ), cand as (
    select st.* from st
    where st.sday is not null
      and not addon_case_is_open(st.pcase)
      and not exists (
        select 1 from case_billing_items b
        where b.is_addon_prorata_line and not coalesce(b.is_addon_labour_line, false)
          and b.status = 'pending' and st.id = any(b.station_ids))
      and not exists (
        select 1 from invoices i
        where i.contract_id = p_contract_id and i.invoice_type = 'contract'
          and i.status in ('draft', 'pending_approval', 'ready')
          and coalesce(i.is_consolidated, false) = false
          and i.billing_period_start <= st.sday
          and coalesce(i.billing_period_end, i.billing_period_start) >= st.sday
          and (i.contract_invoice_kind in ('equipment', 'equipment_monthly')
               or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
                   and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                               and ii.line_kind in ('equipment_annual', 'equipment_monthly')))))
  ), e as (
    select cand.*, en.end_day as eday
    from cand cross join lateral addon_prorata_v2_end(p_contract_id, cand.id, cand.sday) en
    where en.end_day is not null and en.end_day > cand.sday
  ), d as (
    select e.*, g.day
    from e cross join lateral (
      select gs::date as day from generate_series(e.sday, e.eday - 1, interval '1 day') gs
      where not exists (
        select 1 from addon_station_coverage a
        where a.station_id = e.id and a.station_kind = e.skind and a.released_at is null
          and gs::date between a.covered_from and a.covered_to)
    ) g
  )
  select d.skind, d.id, d.uid,
         max(coalesce(nullif(trim(cu.site_name), ''), cu.company_name)),
         d.tid, max(stt.name),
         d.m, coalesce(max(d.a), addon_annual_price_for_type(d.tid, d.uid, p_contract_id)),
         d.sday, min(d.day), max(d.day), count(*)::int, d.eday,
         addon_marking_key_for_unit(d.uid, p_contract_id),
         (select i.id from invoices i join invoice_items ii on ii.invoice_id = i.id
          where i.contract_id = p_contract_id and i.invoice_type = 'contract'
            and i.contract_invoice_kind = 'equipment_gap'
            and i.status in ('draft', 'pending_approval', 'ready')
            and d.id = any(ii.station_ids)
          order by i.created_at desc limit 1)
  from d
  left join customers cu on cu.id = d.uid
  left join station_types stt on stt.id = d.tid
  group by d.skind, d.id, d.uid, d.tid, d.m, d.sday, d.eday;
end $$;

-- 5. Kan tilläggsfakturor delas per märkning och glappfakturor skapas?
-- Ja först när Christian kört drop-raderna från steg 5: gamla unika indexet
-- invoices_contract_period_key borta och kind-checken tillåter equipment_gap.
create or replace function public.invoice_marking_split_ready()
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
           select 1 from pg_indexes
           where schemaname = 'public' and tablename = 'invoices' and indexname = 'invoices_contract_period_key')
     and exists (
           select 1 from pg_constraint
           where conname = 'invoices_contract_invoice_kind_check'
             and conrelid = 'public.invoices'::regclass
             and pg_get_constraintdef(oid) like '%equipment_gap%');
$$;

revoke all on function public.addon_contract_has_premium(uuid) from public, anon, authenticated;
revoke all on function public.contract_addon_next_period_start(uuid, date) from public, anon, authenticated;
revoke all on function public.addon_marking_key_for_unit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.addon_gap_candidates(uuid) from public, anon;
revoke all on function public.invoice_marking_split_ready() from public, anon;
grant execute on function public.addon_gap_candidates(uuid) to authenticated, service_role;
grant execute on function public.invoice_marking_split_ready() to authenticated, service_role;
