-- Backning för steg 11 del 2 (20261030_tillaggsregler_v2_vakt.sql): definitionerna före
-- steget, ordagrant ur tidigare migrationer. Körs i SQL-editorn vid behov (ingen drop).

-- addon_prorata_v2_end (ur 20261030_prorata_v2_funktioner.sql)
create or replace function public.addon_prorata_v2_end(p_contract_id uuid, p_station_id uuid, p_start date)
returns table(end_day date, ordinary date, capped boolean, unknown_invoice text)
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  inv record;
  v_end date;
  v_last date;
  v_guard int := 0;
begin
  select * into c from contracts where id = p_contract_id;
  if not found or p_start is null then
    return;
  end if;
  ordinary := contract_next_period_start(p_contract_id, p_start);
  if ordinary is null then
    return;
  end if;
  v_end := ordinary;
  capped := false;
  unknown_invoice := null;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 60;
    select i.id, coalesce(i.invoice_number, i.id::text) as nr,
           coalesce(i.billing_period_end, i.billing_period_start) as pe,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id and p_station_id = any(ii.station_ids)) as has_station,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                   and (ii.line_kind in ('equipment_annual', 'equipment_monthly') or i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap'))
                   and coalesce(cardinality(ii.station_ids), 0) > 0) as has_ids
      into inv
    from invoices i
    where i.contract_id = p_contract_id
      and i.invoice_type = 'contract'
      and i.status in ('booked', 'sent', 'overdue', 'paid')
      and i.billing_period_start <= v_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= v_end
      and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
           or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
               and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                           and ii.line_kind in ('equipment_annual', 'equipment_monthly'))))
    order by i.billing_period_start desc, i.created_at desc
    limit 1;
    exit when not found;
    exit when inv.has_station;
    if not inv.has_ids then
      unknown_invoice := inv.nr;
      exit;
    end if;
    exit when inv.pe + 1 <= v_end;
    v_end := inv.pe + 1;
  end loop;

  if c.terminated_at is not null or c.renewal_mode = 'option' or c.status in ('ended', 'trashed', 'declined') then
    v_last := coalesce(c.effective_end_date, c.contract_end_date);
    if v_last is not null and v_last + 1 < v_end then
      v_end := v_last + 1;
      capped := true;
    end if;
  end if;
  end_day := v_end;
  return next;
end $$;

-- guard_contract_invoice_overlap (ur 20261030_avtalsar_overlap_share.sql)
create or replace function public.guard_contract_invoice_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_new_end date := coalesce(new.billing_period_end, new.billing_period_start);
  v_share numeric;
  v_restore boolean := false;
begin
  if new.invoice_type is distinct from 'contract'
     or new.status = 'cancelled'
     or coalesce(new.is_historical, false)
     or coalesce(new.invoice_number, '') like 'F-%'
     or new.billing_period_start is null
     or coalesce(new.contract_invoice_kind, 'premium') not in ('premium', 'equipment', 'equipment_monthly') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_restore := old.status is not distinct from 'cancelled';
    if not v_restore
       and old.billing_period_start is not distinct from new.billing_period_start
       and old.billing_period_end is not distinct from new.billing_period_end
       and old.contract_invoice_kind is not distinct from new.contract_invoice_kind
       and old.contract_id is not distinct from new.contract_id
       and old.is_consolidated is not distinct from new.is_consolidated
       and old.invoice_type is not distinct from new.invoice_type
       and coalesce(old.is_historical, false) = coalesce(new.is_historical, false)
       and (coalesce(old.invoice_number, '') like 'F-%') = (coalesce(new.invoice_number, '') like 'F-%') then
      -- Bara statusbyte eller andra fält: perioden är redan prövad
      return new;
    end if;
  end if;

  if coalesce(current_setting('app.allow_period_overlap', true), '') = 'on' then
    return new;
  end if;

  for r in
    select i.id, i.invoice_number, i.status, i.billing_period_start as s,
           coalesce(i.billing_period_end, i.billing_period_start) as e
    from invoices i
    where i.id <> new.id
      and i.invoice_type = 'contract'
      and i.status <> 'cancelled'
      and coalesce(i.contract_invoice_kind, 'premium') = coalesce(new.contract_invoice_kind, 'premium')
      and (
        (new.contract_id is not null and i.contract_id = new.contract_id and not coalesce(i.is_consolidated, false))
        or (coalesce(new.is_consolidated, false) and coalesce(i.is_consolidated, false) and i.customer_id = new.customer_id)
      )
      and i.billing_period_start <= v_new_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= new.billing_period_start
  loop
    -- Steg 7: samma andel som portalens matchning (periodOverlapShare i
    -- src/shared/contractInvoiceMatch.ts), räknad i en gemensam funktion.
    v_share := public.contract_period_overlap_share(r.s, r.e, new.billing_period_start, v_new_end);

    if v_restore and new.fortnox_document_number is not null then
      if v_share >= 0.5 then
        raise warning 'Återställd faktura % (% t.o.m. %) överlappar faktura % (% t.o.m. %)',
          coalesce(new.invoice_number, new.id::text), new.billing_period_start, v_new_end,
          coalesce(r.invoice_number, r.id::text), r.s, r.e;
      end if;
      continue;
    end if;

    if v_share >= 0.5 then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s finns redan på faktura %s (%s t.o.m. %s)',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;

    if tg_op = 'INSERT'
       and r.status not in ('booked', 'sent', 'overdue', 'paid')
       and coalesce(r.invoice_number, '') not like 'F-%' then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s överlappar utkastet %s (%s t.o.m. %s). Ändra utkastet i stället.',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;
  end loop;

  return new;
end $$;

-- trigger och vy (ur 20261030_invoice_period_overlap_guard.sql)
create or replace trigger trg_invoices_period_overlap_guard
  before insert or update of billing_period_start, billing_period_end, contract_invoice_kind, contract_id, is_consolidated, status
  on public.invoices
  for each row execute function public.guard_contract_invoice_overlap();

create or replace view public.contract_invoice_overlaps
with (security_invoker = true) as
  select a.id as invoice_a, a.invoice_number as number_a, a.status as status_a,
         b.id as invoice_b, b.invoice_number as number_b, b.status as status_b,
         a.customer_id, a.contract_id, coalesce(a.contract_invoice_kind, 'premium') as kind,
         greatest(a.billing_period_start, b.billing_period_start) as overlap_from,
         least(coalesce(a.billing_period_end, a.billing_period_start), coalesce(b.billing_period_end, b.billing_period_start)) as overlap_to
  from invoices a join invoices b on a.id < b.id
   and a.invoice_type = 'contract' and b.invoice_type = 'contract'
   and a.status <> 'cancelled' and b.status <> 'cancelled'
   and coalesce(a.contract_invoice_kind, 'premium') = coalesce(b.contract_invoice_kind, 'premium')
   and coalesce(a.contract_invoice_kind, 'premium') <> 'adjustment'
   and a.customer_id = b.customer_id
   and a.contract_id is not distinct from b.contract_id
   and coalesce(a.is_consolidated, false) = coalesce(b.is_consolidated, false)
   and a.billing_period_start <= coalesce(b.billing_period_end, b.billing_period_start)
   and b.billing_period_start <= coalesce(a.billing_period_end, a.billing_period_start);

revoke all on public.contract_invoice_overlaps from anon, authenticated;

-- contract_work_items_internal (ur 20261030_arbetslista_funktion.sql)
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
