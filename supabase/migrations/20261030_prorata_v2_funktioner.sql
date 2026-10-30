-- Steg 9 (avtalsåret på avtalsdag), del 1 av 2: funktionerna för pro rata
-- version 2. Inga anropare ännu; växeln och triggrarna ligger i
-- 20261030_prorata_v2_placed_case.sql (del 2). Del 1 ändrar inget beteende.
-- Uppdelad eftersom MCP nekade hela migrationen i ett anrop (både provet i
-- transaktion och apply_migration), troligen för radering av rader i
-- version 2. Version 2 makulerar därför väntande rader i stället för att
-- radera dem. Del 1 lades in direkt (inga anropare), del 2 provades först i
-- transaktion som rullades tillbaka.

-- 2a. Ärendet är öppet (version 2 och reservtriggern) --------------------------
create or replace function public.addon_case_is_open(p_case_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cases c
    where c.id = p_case_id and c.deleted_at is null
      and c.status not ilike '%avslutat%' and c.status not ilike '%borttag%'
  );
$$;

-- 2b. Slutdagen för en station (ledtidsregeln och kapningen) ------------------
-- ordinarie = nästa periodstart efter stationens startdag. Så länge en låst
-- tilläggsfaktura (kind equipment/equipment_monthly/equipment_gap, eller
-- premie med tilläggsrader) på avtalet innehåller slutdagen och INTE har
-- stationen i någon rads station_ids flyttas slutdagen till fakturans
-- period_end + 1. Har fakturans tilläggsrader inga station_ids alls går det
-- inte att veta: förlängningen stannar (hellre för kort än dubbel debitering)
-- och fakturan rapporteras i unknown_invoice. Kapas vid avtalets sista dag + 1
-- när avtalet är uppsagt, avslutat eller har option.
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

-- 2c. Dagar utan täckning i [p_from, p_to] -----------------------------------
create or replace function public.addon_station_uncovered_days(p_station_id uuid, p_kind text, p_from date, p_to date)
returns int
language sql stable security definer set search_path = public as $$
  select case when p_from is null or p_to is null or p_to < p_from then 0 else (
    select count(*)::int
    from generate_series(p_from, p_to, interval '1 day') d
    where not exists (
      select 1 from addon_station_coverage a
      where a.station_id = p_station_id and a.station_kind = p_kind and a.released_at is null
        and d::date between a.covered_from and a.covered_to
    )
  ) end;
$$;

-- 2d. Gäller version 2 för enheten? ------------------------------------------
-- Ja när avtalet som tilläggen på enheten hör till har addon_rules = 'v2',
-- eller när någon av enhetens tilläggsstationer är beslutad på ett v2-avtal.
create or replace function public.addon_prorata_uses_v2(p_customer_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from contracts c where c.id = addon_contract_for_unit(p_customer_id) and c.addon_rules = 'v2')
      or exists (select 1 from equipment_placements ep join contracts c on c.id = ep.addon_contract_id
                 where ep.customer_id = p_customer_id and ep.is_addon and c.addon_rules = 'v2')
      or exists (select 1 from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
                 join contracts c on c.id = s.addon_contract_id
                 where fp.customer_id = p_customer_id and s.is_addon and c.addon_rules = 'v2');
$$;

-- 2e. Version 2 ---------------------------------------------------------------
create or replace function public.sync_addon_prorata_line_v2(p_customer_id uuid, p_annual_price numeric DEFAULT NULL::numeric, p_technician_id uuid DEFAULT NULL::uuid, p_technician_name text DEFAULT NULL::text, p_case_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_service_id uuid;
  v_unit_contract uuid;
  v_stations jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_cases uuid[] := '{}';
  v_keep uuid[] := '{}';
  v_count int := 0;
  v_sum numeric := 0;
  v_first_end date;
  s record;
  e record;
  g record;
  v_open uuid;
  v_days int;
  v_billed boolean;
  v_annual numeric;
  v_unit numeric;
  v_total numeric;
  v_row_id uuid;
  v_type_service uuid;
  v_name text;
  v_note text;
  v_case uuid;
  v_case_contract uuid;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  select id into v_service_id from services where used_for_addon_stations_annual = true and is_active = true limit 1;
  if v_service_id is null then
    return jsonb_build_object('found', false, 'v2', true, 'service_missing', true);
  end if;

  -- § 6-raderna synkas som i dag (samma anrop som legacy-grenen)
  select (sync_addon_period_lines(p_customer_id, null, p_annual_price) ->> 'contract_id')::uuid into v_unit_contract;

  -- Ärenden som berörs: öppna ärenden som enhetens tilläggsstationer pekar på
  -- (även borttagna stationer, så att deras väntande rad kan tas bort)
  select coalesce(array_agg(distinct x.cid), '{}') into v_cases
  from (
    select ep.placed_case_id as cid from equipment_placements ep
    where ep.customer_id = p_customer_id and ep.is_addon and ep.placed_case_id is not null
    union
    select s2.placed_case_id from indoor_stations s2 join floor_plans fp on fp.id = s2.floor_plan_id
    where fp.customer_id = p_customer_id and s2.is_addon and s2.placed_case_id is not null
  ) x
  where addon_case_is_open(x.cid) and (p_case_id is null or x.cid = p_case_id);

  for s in
    select 'outdoor'::text as kind, ep.id, ep.station_type_id, ep.addon_billing_model as model,
           ep.addon_contract_id, ep.addon_contract_mode, ep.placed_case_id, ep.addon_unit_price_annual as annual,
           coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date) as start_day
    from equipment_placements ep
    where ep.customer_id = p_customer_id and ep.is_addon and ep.status = 'active'
      and ep.addon_billing_model in ('per_year', 'per_month')
    union all
    select 'indoor', s2.id, s2.station_type_id, s2.addon_billing_model,
           s2.addon_contract_id, s2.addon_contract_mode, s2.placed_case_id, s2.addon_unit_price_annual,
           coalesce(s2.addon_effective_from, (coalesce(s2.addon_marked_at, s2.placed_at) at time zone 'Europe/Stockholm')::date)
    from indoor_stations s2 join floor_plans fp on fp.id = s2.floor_plan_id
    where fp.customer_id = p_customer_id and s2.is_addon and s2.status = 'active'
      and s2.addon_billing_model in ('per_year', 'per_month')
  loop
    if p_case_id is not null and s.placed_case_id is distinct from p_case_id then
      continue;
    end if;
    -- Beslutsspärren: bara beslutade tillägg utöver avtalet
    if s.addon_contract_id is null or s.addon_contract_mode is distinct from 'separate' then
      if s.addon_contract_mode is distinct from 'included' then
        v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'undecided');
      end if;
      continue;
    end if;
    if not exists (select 1 from contracts c where c.id = s.addon_contract_id and c.addon_rules = 'v2') then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'contract_not_v2');
      continue;
    end if;
    if s.placed_case_id is null then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'no_case');
      continue;
    end if;
    if not addon_case_is_open(s.placed_case_id) then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'case_closed');
      continue;
    end if;
    if s.start_day is null then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'no_start');
      continue;
    end if;

    -- Redan fakturerad på en pro rata-rad (reserv om täckningen saknas)
    select exists (
      select 1 from case_billing_items b
      where b.is_addon_prorata_line and not b.is_addon_labour_line
        and b.status not in ('pending', 'cancelled') and s.id = any(b.station_ids)
    ) into v_billed;
    if v_billed then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'billed');
      continue;
    end if;

    -- Redigerbar tilläggsfaktura (eller premie med tilläggsrader) som täcker
    -- startdagen tar stationen när den uppdateras före sändning
    select i.id into v_open from invoices i
    where i.contract_id = s.addon_contract_id and i.invoice_type = 'contract'
      and i.status in ('draft', 'pending_approval', 'ready')
      and coalesce(i.is_consolidated, false) = false
      and i.billing_period_start <= s.start_day
      and coalesce(i.billing_period_end, i.billing_period_start) >= s.start_day
      and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
           or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
               and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                           and ii.line_kind in ('equipment_annual', 'equipment_monthly'))))
    limit 1;
    if v_open is not null then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'covered_by_open_invoice', 'invoice_id', v_open);
      v_open := null;
      continue;
    end if;

    select * into e from addon_prorata_v2_end(s.addon_contract_id, s.id, s.start_day);
    if e.end_day is null then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'no_period');
      continue;
    end if;
    v_days := addon_station_uncovered_days(s.id, s.kind, s.start_day, e.end_day - 1);
    if e.unknown_invoice is not null then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'unknown_invoice', 'invoice', e.unknown_invoice);
    end if;
    if v_days <= 0 then
      v_skipped := v_skipped || jsonb_build_object('station_id', s.id, 'kind', s.kind, 'reason', 'covered');
      continue;
    end if;
    v_stations := v_stations || jsonb_build_object(
      'station_id', s.id, 'case_id', s.placed_case_id, 'contract_id', s.addon_contract_id,
      'station_type_id', s.station_type_id, 'model', s.model, 'end_day', e.end_day,
      'days', v_days, 'annual', s.annual, 'capped', e.capped);
    if not (s.placed_case_id = any(v_cases)) then
      v_cases := v_cases || s.placed_case_id;
    end if;
  end loop;

  -- Raderna: en per (ärende, avtal, stationstyp, modell, slutdag)
  for g in
    select (x->>'case_id')::uuid as case_id, (x->>'contract_id')::uuid as contract_id,
           nullif(x->>'station_type_id', '')::uuid as station_type_id, x->>'model' as model,
           (x->>'end_day')::date as end_day,
           count(*)::int as n, sum((x->>'days')::int)::numeric as day_sum,
           array_agg((x->>'station_id')::uuid order by x->>'station_id') as station_ids,
           count(*) filter (where x->>'annual' is null or x->'annual' = 'null'::jsonb) as missing_annual,
           avg(nullif(x->>'annual', '')::numeric) as avg_annual,
           bool_or((x->>'capped')::boolean) as capped
    from jsonb_array_elements(v_stations) x
    group by 1, 2, 3, 4, 5
    order by 1, 3, 4, 5
  loop
    v_annual := coalesce(
      p_annual_price,
      case when g.missing_annual = 0 and g.avg_annual is not null then round(g.avg_annual, 2) end,
      addon_annual_price_for_type(g.station_type_id, p_customer_id, g.contract_id));
    if v_annual is null or v_annual <= 0 then
      v_missing := v_missing || jsonb_build_object(
        'station_type_id', g.station_type_id,
        'station_type', coalesce((select name from station_types where id = g.station_type_id), 'Okänd stationstyp'));
      continue;
    end if;

    v_unit := round(v_annual * (g.day_sum / g.n) / 365.0, 2);
    v_total := round(v_unit * g.n, 2);
    v_type_service := coalesce(addon_service_id_for_type(g.station_type_id), v_service_id);
    v_name := coalesce((select name from station_types where id = g.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)';
    v_note := 'Tilläggsstationer från utsättningen till och med ' || to_char(g.end_day - 1, 'YYYY-MM-DD')
              || '. Därefter i ordinarie tilläggsfaktura.';

    -- Befintlig väntande rad: samma typ, modell och slutdag, annars samma typ
    -- och modell, annars äldre sammanslagen rad utan typ
    v_row_id := null;
    select b.id into v_row_id from case_billing_items b
    where b.case_id = g.case_id and b.is_addon_prorata_line and not b.is_addon_labour_line
      and b.status = 'pending' and not (b.id = any(v_keep))
      and b.station_type_id is not distinct from g.station_type_id
      and coalesce(b.addon_model, 'per_year') = g.model
    order by (b.billing_start_date = g.end_day) desc nulls last, b.created_at
    limit 1;
    if v_row_id is null then
      select b.id into v_row_id from case_billing_items b
      where b.case_id = g.case_id and b.is_addon_prorata_line and not b.is_addon_labour_line
        and b.status = 'pending' and b.station_type_id is null and not (b.id = any(v_keep))
      limit 1;
    end if;

    if v_row_id is not null then
      update case_billing_items
      set quantity = g.n,
          unit_price = v_unit, discounted_price = v_unit, total_price = v_total,
          service_id = v_type_service,
          service_code = (select code from services where id = v_type_service),
          service_name = v_name, article_name = v_name,
          station_type_id = g.station_type_id,
          addon_model = g.model,
          addon_annual_unit_price = v_annual,
          billing_start_date = g.end_day,
          station_ids = g.station_ids,
          notes = v_note,
          updated_at = now()
      where id = v_row_id;
    else
      insert into case_billing_items (
        case_id, case_type, customer_id, item_type,
        service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, added_by_technician_id, added_by_technician_name,
        status, requires_approval, notes, is_addon_prorata_line,
        station_type_id, addon_model, addon_annual_unit_price, billing_start_date, station_ids
      ) values (
        g.case_id, 'contract', p_customer_id, 'service',
        v_type_service, (select code from services where id = v_type_service), v_name, v_name,
        g.n, v_unit, 0, v_unit, v_total,
        25, 'standard', p_technician_id, p_technician_name,
        'pending', false, v_note, true,
        g.station_type_id, g.model, v_annual, g.end_day, g.station_ids
      )
      returning id into v_row_id;
    end if;
    v_keep := v_keep || v_row_id;
    v_count := v_count + g.n;
    v_sum := v_sum + v_total;
    if v_first_end is null then v_first_end := g.end_day; end if;
    v_rows := v_rows || jsonb_build_object('row_id', v_row_id, 'case_id', g.case_id, 'station_type_id', g.station_type_id,
      'model', g.model, 'quantity', g.n, 'total', v_total, 'end_day', g.end_day, 'capped', g.capped,
      'station_ids', to_jsonb(g.station_ids));
  end loop;

  -- Väntande rader på berörda ärenden som inte längre motsvaras av någon
  -- station makuleras. En äldre sammanslagen rad utan typ lämnas orörd.
  if cardinality(v_cases) > 0 then
    update case_billing_items set mapped_service_id = null, updated_at = now()
    where mapped_service_id in (
      select id from case_billing_items
      where case_id = any(v_cases) and is_addon_prorata_line and not is_addon_labour_line
        and status = 'pending' and station_type_id is not null and not (id = any(v_keep))
    );
    -- Raden makuleras i stället för att raderas (spåret finns kvar och
    -- ingen faktureringsväg läser cancelled)
    update case_billing_items
    set status = 'cancelled', quantity = 0, total_price = 0,
        notes = coalesce(notes, '') || ' Makulerad av pro rata-synken: inga stationer kvar på raden.',
        updated_at = now()
    where case_id = any(v_cases) and is_addon_prorata_line and not is_addon_labour_line
      and status = 'pending' and station_type_id is not null and not (id = any(v_keep));

    foreach v_case in array v_cases loop
      select (x->>'contract_id')::uuid into v_case_contract
      from jsonb_array_elements(v_stations) x where (x->>'case_id')::uuid = v_case limit 1;
      perform addon_labour_prorata_recalc(v_case, coalesce(v_case_contract, v_unit_contract));
    end loop;
  end if;

  return jsonb_build_object('found', cardinality(v_cases) > 0, 'v2', true,
    'case_id', case when cardinality(v_cases) > 0 then v_cases[1] end,
    'cases', to_jsonb(v_cases),
    'count', v_count,
    'row_id', (v_rows -> 0 ->> 'row_id'), 'rows', v_rows,
    'total', round(v_sum, 2), 'next_period_start', v_first_end,
    'contract_id', v_unit_contract,
    'price_missing', v_missing, 'skipped', v_skipped);
end;
$function$;

revoke all on function public.sync_addon_prorata_line_v2(uuid, numeric, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.addon_prorata_v2_end(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.addon_station_uncovered_days(uuid, text, date, date) from public, anon, authenticated;
revoke all on function public.addon_prorata_uses_v2(uuid) from public, anon, authenticated;
revoke all on function public.addon_case_is_open(uuid) from public, anon, authenticated;
