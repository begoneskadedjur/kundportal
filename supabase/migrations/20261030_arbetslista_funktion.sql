-- Steg 10 (avtalsåret på avtalsdag), del 1 av 2: arbetslistan som intern
-- funktion utan anropare och utan körrätt för klienter. Ändrar inget beteende.
-- Del 2 (klientfunktionen, notisen, triggrarna och RPC:erna) ligger i
-- 20261030_arbetslista_avtalskartan.sql. Uppdelad som i steg 9: del 1 lades in
-- direkt efter prov i transaktion som rullades tillbaka, del 2 provades med
-- scripts/regression/arbetslista.test.sql.

-- 1. Arbetslistan --------------------------------------------------------------
create or replace function public.contract_work_items_internal(p_root_customer_id uuid default null)
returns table(
  kind text, root_customer_id uuid, root_name text, unit_id uuid, unit_name text, contract_id uuid,
  station_kind text, station_ids uuid[], station_count int, case_id uuid, case_number text,
  invoice_id uuid, invoice_number text, coverage_ids uuid[], conflict_ids uuid[],
  period_from date, period_to date, annual_kr numeric, v2 boolean, instruction text,
  sort_order int, sort_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  -- 1a. Makulerad faktura i täckningen: Fakturera igen eller Efterskänk
  return query
  with fam as (
    select c.id, coalesce(c.parent_customer_id, c.id) as root_id,
           coalesce(nullif(trim(c.site_name), ''), c.company_name) as name
    from customers c
    where p_root_customer_id is null or c.id = p_root_customer_id or c.parent_customer_id = p_root_customer_id
  ), x as (
    select a.id as cov_id, a.station_id, a.station_kind as skind, a.unit_customer_id as uid, a.contract_id as cid,
           a.covered_from, a.covered_to, a.invoice_cancelled_at,
           f.root_id, f.name as uname, cb.case_id as cbcase,
           coalesce(a.invoice_id, (
             select ii.invoice_id from invoice_items ii join invoices i2 on i2.id = ii.invoice_id
             where ii.case_billing_item_id = a.case_billing_item_id
             order by (i2.status = 'cancelled') desc, i2.created_at desc limit 1)) as inv_id
    from addon_station_coverage a
    join fam f on f.id = a.unit_customer_id
    left join case_billing_items cb on cb.id = a.case_billing_item_id
    where a.released_at is null and a.invoice_cancelled_at is not null
  )
  select 'coverage_cancelled'::text, x.root_id, r.company_name, x.uid, max(x.uname), x.cid,
         x.skind, array_agg(distinct x.station_id), count(distinct x.station_id)::int,
         (array_agg(x.cbcase))[1], max(c.case_number), x.inv_id, max(i.invoice_number),
         array_agg(x.cov_id), null::uuid[], x.covered_from, x.covered_to, null::numeric, true,
         'Faktura ' || coalesce(max(i.invoice_number), max(i.fortnox_document_number), max(c.case_number), 'utan nummer')
           || ' makulerades. Ska stationerna faktureras igen eller efterskänkas?',
         10, min(x.invoice_cancelled_at)
  from x
  join customers r on r.id = x.root_id
  left join invoices i on i.id = x.inv_id
  left join cases c on c.id = x.cbcase
  group by x.root_id, r.company_name, x.uid, x.cid, x.skind, x.inv_id, x.covered_from, x.covered_to;

  -- 1b. Konflikt: fakturan täcker dagar som redan är täckta
  return query
  with fam as (
    select c.id, coalesce(c.parent_customer_id, c.id) as root_id,
           coalesce(nullif(trim(c.site_name), ''), c.company_name) as name
    from customers c
    where p_root_customer_id is null or c.id = p_root_customer_id or c.parent_customer_id = p_root_customer_id
  ), x as (
    select k.id as kid, k.station_id, k.station_kind as skind, k.covered_from, k.covered_to, k.created_at as kat,
           lk.unit_customer_id as uid, lk.contract_id as cid, f.root_id, f.name as uname,
           coalesce(k.invoice_id, (
             select ii.invoice_id from invoice_items ii
             where ii.case_billing_item_id = k.case_billing_item_id
             order by ii.created_at desc limit 1)) as inv_id,
           cb.case_id as cbcase,
           case when k.conflict_with is null then 'annan täckning'
                else concat_ws(' ',
                  case cw.source
                    when 'invoice' then 'faktura'
                    when 'gap_invoice' then 'glappfaktura'
                    when 'prorata' then 'pro rata på'
                    when 'fortnox_manual' then 'Fortnox-faktura'
                    when 'waived' then 'en efterskänkt period'
                    when 'backfill' then 'tidigare fakturering'
                    else 'täckning' end,
                  case when cw.source = 'waived' then null else addon_coverage_ref(k.conflict_with) end)
           end as cw_text
    from addon_coverage_conflicts k
    cross join lateral (select l.unit_customer_id, l.contract_id from addon_station_lookup(k.station_id, k.station_kind) l limit 1) lk
    join fam f on f.id = lk.unit_customer_id
    left join addon_station_coverage cw on cw.id = k.conflict_with
    left join case_billing_items cb on cb.id = k.case_billing_item_id
    where k.resolved_at is null
  )
  select 'coverage_conflict'::text, x.root_id, r.company_name, x.uid, max(x.uname), x.cid,
         x.skind, array_agg(distinct x.station_id), count(distinct x.station_id)::int,
         (array_agg(x.cbcase))[1], max(c.case_number), x.inv_id, max(i.invoice_number),
         null::uuid[], array_agg(x.kid), min(x.covered_from), max(x.covered_to), null::numeric, true,
         'Faktura ' || coalesce(max(i.invoice_number), max(c.case_number), 'utan nummer')
           || ' täcker dagar som redan är täckta av ' || string_agg(distinct x.cw_text, ', ') || '.',
         20, min(x.kat)
  from x
  join customers r on r.id = x.root_id
  left join invoices i on i.id = x.inv_id
  left join cases c on c.id = x.cbcase
  group by x.root_id, r.company_name, x.uid, x.cid, x.skind, x.inv_id;

  -- 1c. Tilläggsstationer som väntar på beslut (samma urval som
  -- addon_pending_summary, per enhet och avtal). Väntande pro rata-rader på
  -- enhetens ärenden markeras, men rörs inte.
  return query
  with fam as (
    select c.id, coalesce(c.parent_customer_id, c.id) as root_id,
           coalesce(nullif(trim(c.site_name), ''), c.company_name) as name
    from customers c
    where p_root_customer_id is null or c.id = p_root_customer_id or c.parent_customer_id = p_root_customer_id
  ), st as (
    select e.id, e.customer_id as uid, e.station_type_id, e.addon_marked_at
    from equipment_placements e
    where e.is_addon and e.addon_contract_id is null and coalesce(e.status, 'active') <> 'removed'
    union all
    select i.id, fp.customer_id, i.station_type_id, i.addon_marked_at
    from indoor_stations i join floor_plans fp on fp.id = i.floor_plan_id
    where i.is_addon and i.addon_contract_id is null and coalesce(i.status, 'active') <> 'removed'
  ), u as (
    select st.*, f.root_id, f.name as uname from st join fam f on f.id = st.uid
  ), cv as (
    select u.*, (
      select ct.id from contracts ct
      where ct.status = 'active'
        and (
          ct.id in (
            select cs.contract_id from contract_sites cs
            where cs.customer_id = u.uid and (cs.active_to is null or cs.active_to >= v_today)
          )
          or ct.customer_id = u.uid
          or (ct.customer_id = u.root_id and ct.covers_all_sites)
        )
      order by ct.created_at
      limit 1
    ) as cid
    from u
  ), g as (
    select cv.root_id, cv.uid, max(cv.uname) as uname, cv.cid,
           array_agg(cv.id) as ids, count(*)::int as n,
           coalesce(sum(coalesce(addon_annual_price_for_type(cv.station_type_id, cv.uid, cv.cid), 0)), 0) as kr,
           min(cv.addon_marked_at) as first_at
    from cv where cv.cid is not null
    group by cv.root_id, cv.uid, cv.cid
  )
  select 'addon_decide'::text, g.root_id, r.company_name, g.uid, g.uname, g.cid,
         null::text, g.ids, g.n, null::uuid, pp.case_numbers, null::uuid, null::text,
         null::uuid[], null::uuid[], null::date, null::date, g.kr, uv.v2,
         g.n || case when g.n = 1 then ' tilläggsstation' else ' tilläggsstationer' end
           || ' på ' || g.uname || ' väntar på beslut. Välj om de ingår i premien eller faktureras som tillägg.'
           || case when uv.v2 then ' Pro rata skapas först efter beslutet.' else '' end
           || case when pp.case_numbers is not null
                then ' Ärende ' || pp.case_numbers || ' har redan en väntande pro rata-rad för tilläggen. Kontrollera den innan ärendet faktureras.'
                else '' end,
         30, g.first_at
  from g
  join customers r on r.id = g.root_id
  cross join lateral (select addon_prorata_uses_v2(g.uid) as v2) uv
  left join lateral (
    select string_agg(distinct c.case_number, ', ') as case_numbers
    from case_billing_items b join cases c on c.id = b.case_id
    where b.is_addon_prorata_line and not coalesce(b.is_addon_labour_line, false) and b.status = 'pending'
      and c.deleted_at is null and (c.customer_id = g.uid or b.site_customer_id = g.uid)
  ) pp on true;

  -- 1d. Beslutad station på avtal med nya tilläggsregler men utan ärende
  return query
  with fam as (
    select c.id, coalesce(c.parent_customer_id, c.id) as root_id,
           coalesce(nullif(trim(c.site_name), ''), c.company_name) as name
    from customers c
    where p_root_customer_id is null or c.id = p_root_customer_id or c.parent_customer_id = p_root_customer_id
  ), st as (
    select 'outdoor'::text as skind, ep.id, ep.customer_id as uid, ep.addon_contract_id as cid, ep.addon_marked_at as m
    from equipment_placements ep join contracts c on c.id = ep.addon_contract_id
    where ep.is_addon and ep.status = 'active' and ep.addon_contract_mode = 'separate' and c.addon_rules = 'v2'
      and ep.addon_billing_model in ('per_year', 'per_month') and ep.placed_case_id is null
    union all
    select 'indoor', s2.id, fp.customer_id, s2.addon_contract_id, s2.addon_marked_at
    from indoor_stations s2 join floor_plans fp on fp.id = s2.floor_plan_id
    join contracts c on c.id = s2.addon_contract_id
    where s2.is_addon and s2.status = 'active' and s2.addon_contract_mode = 'separate' and c.addon_rules = 'v2'
      and s2.addon_billing_model in ('per_year', 'per_month') and s2.placed_case_id is null
  )
  select 'addon_no_case'::text, f.root_id, r.company_name, st.uid, max(f.name), st.cid,
         st.skind, array_agg(st.id), count(*)::int, null::uuid, null::text, null::uuid, null::text,
         null::uuid[], null::uuid[], null::date, null::date, null::numeric, true,
         case when count(*) = 1
           then 'Stationen på ' || max(f.name) || ' sattes ut utan ärende. Välj ärendet den hör till.'
           else count(*) || ' stationer på ' || max(f.name) || ' sattes ut utan ärende. Välj ärendet de hör till.' end,
         40, min(st.m)
  from st join fam f on f.id = st.uid join customers r on r.id = f.root_id
  group by f.root_id, r.company_name, st.uid, st.cid, st.skind;

  -- 1e. Glapp som blir en glappfaktura i nästa planering (ärendet är stängt,
  -- ingen pro rata-rad tar stationen). Bara avtal med nya tilläggsregler.
  return query
  with fam as (
    select c.id, coalesce(c.parent_customer_id, c.id) as root_id,
           coalesce(nullif(trim(c.site_name), ''), c.company_name) as name
    from customers c
    where p_root_customer_id is null or c.id = p_root_customer_id or c.parent_customer_id = p_root_customer_id
  ), st as (
    select 'outdoor'::text as skind, ep.id, ep.customer_id as uid, ep.addon_contract_id as cid, ep.placed_case_id as pcase,
           coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date) as start_day
    from equipment_placements ep join contracts c on c.id = ep.addon_contract_id
    where ep.is_addon and ep.status = 'active' and ep.addon_contract_mode = 'separate' and c.addon_rules = 'v2'
      and ep.addon_billing_model in ('per_year', 'per_month') and ep.placed_case_id is not null
    union all
    select 'indoor', s2.id, fp.customer_id, s2.addon_contract_id, s2.placed_case_id,
           coalesce(s2.addon_effective_from, (coalesce(s2.addon_marked_at, s2.placed_at) at time zone 'Europe/Stockholm')::date)
    from indoor_stations s2 join floor_plans fp on fp.id = s2.floor_plan_id
    join contracts c on c.id = s2.addon_contract_id
    where s2.is_addon and s2.status = 'active' and s2.addon_contract_mode = 'separate' and c.addon_rules = 'v2'
      and s2.addon_billing_model in ('per_year', 'per_month') and s2.placed_case_id is not null
  ), cand as (
    select st.*, f.root_id, f.name as uname
    from st join fam f on f.id = st.uid
    where st.start_day is not null
      and not addon_case_is_open(st.pcase)
      and not exists (
        select 1 from case_billing_items b
        where b.is_addon_prorata_line and not coalesce(b.is_addon_labour_line, false)
          and b.status <> 'cancelled' and st.id = any(b.station_ids))
      and not exists (
        select 1 from invoices i
        where i.contract_id = st.cid and i.invoice_type = 'contract'
          and i.status in ('draft', 'pending_approval', 'ready')
          and coalesce(i.is_consolidated, false) = false
          and i.billing_period_start <= st.start_day
          and coalesce(i.billing_period_end, i.billing_period_start) >= st.start_day
          and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
               or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
                   and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                               and ii.line_kind in ('equipment_annual', 'equipment_monthly')))))
  ), e as (
    select cand.*, en.end_day
    from cand cross join lateral addon_prorata_v2_end(cand.cid, cand.id, cand.start_day) en
    where en.end_day is not null and en.end_day > cand.start_day
  ), gd as (
    select e.root_id, e.uname, e.uid, e.cid, e.id, d.day
    from e cross join lateral (
      select g::date as day from generate_series(e.start_day, e.end_day - 1, interval '1 day') g
      where not exists (
        select 1 from addon_station_coverage a
        where a.station_id = e.id and a.station_kind = e.skind and a.released_at is null
          and g::date between a.covered_from and a.covered_to)
    ) d
  )
  select 'gap_invoice'::text, gd.root_id, r.company_name, gd.uid, max(gd.uname), gd.cid,
         null::text, array_agg(distinct gd.id), count(distinct gd.id)::int, null::uuid, null::text,
         null::uuid, null::text, null::uuid[], null::uuid[], min(gd.day), max(gd.day), null::numeric, true,
         count(distinct gd.id) || case when count(distinct gd.id) = 1 then ' station' else ' stationer' end
           || ' på ' || max(gd.uname) || ' saknar betalning ' || to_char(min(gd.day), 'YYYY-MM-DD')
           || ' t.o.m. ' || to_char(max(gd.day), 'YYYY-MM-DD') || '. Planera fakturor skapar fakturan.',
         50, null::timestamptz
  from gd join customers r on r.id = gd.root_id
  group by gd.root_id, r.company_name, gd.uid, gd.cid;

  -- 1f. Avtal i exakt läge vars avtalsdag inte är kontrollerad
  return query
  with fam as (
    select c.id, coalesce(c.parent_customer_id, c.id) as root_id,
           coalesce(nullif(trim(c.site_name), ''), c.company_name) as name
    from customers c
    where p_root_customer_id is null or c.id = p_root_customer_id or c.parent_customer_id = p_root_customer_id
  )
  select 'anchor_verify'::text, f.root_id, r.company_name, ct.customer_id, f.name, ct.id,
         null::text, null::uuid[], 0, null::uuid, null::text, null::uuid, null::text,
         null::uuid[], null::uuid[], ct.contract_start_date, null::date, null::numeric, coalesce(ct.addon_rules = 'v2', false),
         'Kontrollera startdatum mot Oneflow-avtalet och markera avtalsdagen.'::text,
         60, ct.created_at
  from contracts ct
  join fam f on f.id = ct.customer_id
  join customers r on r.id = f.root_id
  where ct.billing_anchor_mode = 'start_day' and ct.billing_anchor_verified_at is null
    and ct.type = 'contract' and ct.status in ('signed', 'active');
end $$;

revoke all on function public.contract_work_items_internal(uuid) from public, anon, authenticated;

