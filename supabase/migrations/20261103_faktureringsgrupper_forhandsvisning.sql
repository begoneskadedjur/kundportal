-- Faktureringsgrupper, förhandsvisning i Besluta tillägg (2026-11-03, 3.117.1).
--
-- Besluta tillägg visade första fakturan och pro rata-beloppet med avtalets
-- vanliga takt även när en faktureringsgrupp var vald. Förhandsvisningen
-- räknas nu i databasen med exakt samma steg som sync_addon_prorata_line_v2
-- gör när beslutet sparats (stationen i gruppen):
--
--   addon_prorata_v2_end_for_group: kroppen ur addon_prorata_v2_end med
--     gruppen som parameter i stället för stationens sparade grupp.
--     addon_prorata_v2_end anropar den med addon_station_billing_group, så
--     svaret är detsamma som förut (kontrollerat på alla tilläggsstationer).
--   addon_group_prorata_preview: pro rata och första fakturadag för en
--     brickas stationer i en grupp, utan att skriva något.
--
-- Bara nya funktioner och en omskrivning med samma svar. Inga kunddata ändras.

create or replace function public.addon_prorata_v2_end_for_group(p_contract_id uuid, p_station_id uuid, p_start date, p_group_id uuid)
 returns table(end_day date, ordinary date, capped boolean, unknown_invoice text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  c record;
  inv record;
  v_end date;
  v_last date;
  v_guard int := 0;
  v_key text;
  v_model text;
  v_group uuid;
  v_group_key text;
begin
  select * into c from contracts where id = p_contract_id;
  if not found or p_start is null then
    return;
  end if;
  -- Stationens modell (steg 0): per månad räknar till nästa månadsstart
  select coalesce(
    (select ep.addon_billing_model from equipment_placements ep where ep.id = p_station_id),
    (select s.addon_billing_model from indoor_stations s where s.id = p_station_id)
  ) into v_model;
  -- Faktureringsgruppen (giltig för avtalet), NULL = vanliga regler
  v_group := addon_billing_group_valid(p_group_id, p_contract_id);
  -- Steg 11: tilläggens takt (premiens perioder, eller årsdagen utan premie)
  ordinary := contract_addon_next_period_start(p_contract_id, p_start, v_model, v_group);
  v_key := addon_marking_key_for_unit((select l.unit_customer_id from addon_station_lookup(p_station_id, null) l limit 1), p_contract_id);
  if v_group is not null then
    select nullif(upper(trim(g.marking)), '') into v_group_key from contract_addon_billing_groups g where g.id = v_group;
    v_key := coalesce(v_group_key, v_key);
  end if;
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
      and (i.marking_key is null or i.marking_key = v_key)
      and i.addon_billing_group_id is not distinct from v_group
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
end $function$;

-- Samma svar som förut: stationens sparade grupp (egen, annars radens)
create or replace function public.addon_prorata_v2_end(p_contract_id uuid, p_station_id uuid, p_start date)
 returns table(end_day date, ordinary date, capped boolean, unknown_invoice text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select e.end_day, e.ordinary, e.capped, e.unknown_invoice
  from public.addon_prorata_v2_end_for_group(p_contract_id, p_station_id, p_start,
         public.addon_station_billing_group(p_station_id, p_contract_id)) e;
$function$;

-- Förhandsvisning för Besluta tillägg: brickans stationer som tillägg utöver
-- avtalet i gruppen p_group_id, årspris p_annual per station. Samma urval,
-- slutdag, otäckta dagar och avrundning som sync_addon_prorata_line_v2 (en
-- rad per ärende, stationstyp, modell och slutdag). Skriver ingenting.
--   first_invoice: gruppens första faktura (tidigaste slutdagen för pro rata,
--     annars gruppens nästa periodstart från i dag)
--   total: det som faktureras på etableringsärendet nu
create or replace function public.addon_group_prorata_preview(
  p_contract_id uuid, p_group_id uuid, p_outdoor_ids uuid[], p_indoor_ids uuid[], p_annual numeric)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_group uuid;
  s record;
  e record;
  g record;
  v_days int;
  v_unit numeric;
  v_total numeric := 0;
  v_rows jsonb := '[]'::jsonb;
  v_st jsonb := '[]'::jsonb;
  v_first date;
  v_model text;
  v_cadence text;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  v_group := addon_billing_group_valid(p_group_id, p_contract_id);
  if v_group is null then
    return null;
  end if;
  select cadence into v_cadence from contract_addon_billing_groups where id = v_group;

  for s in
    select 'outdoor'::text as kind, ep.id, ep.station_type_id, ep.addon_billing_model as model, ep.placed_case_id,
           coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date) as start_day
    from equipment_placements ep
    where ep.id = any(coalesce(p_outdoor_ids, '{}')) and ep.is_addon and ep.status = 'active'
      and ep.addon_billing_model in ('per_year', 'per_month')
    union all
    select 'indoor', s2.id, s2.station_type_id, s2.addon_billing_model, s2.placed_case_id,
           coalesce(s2.addon_effective_from, (coalesce(s2.addon_marked_at, s2.placed_at) at time zone 'Europe/Stockholm')::date)
    from indoor_stations s2
    where s2.id = any(coalesce(p_indoor_ids, '{}')) and s2.is_addon and s2.status = 'active'
      and s2.addon_billing_model in ('per_year', 'per_month')
  loop
    v_model := coalesce(v_model, s.model);
    if s.placed_case_id is null or not addon_case_is_open(s.placed_case_id) or s.start_day is null then
      continue;
    end if;
    if exists (
      select 1 from case_billing_items b
      where b.is_addon_prorata_line and not b.is_addon_labour_line
        and b.status not in ('pending', 'cancelled') and s.id = any(b.station_ids)) then
      continue;
    end if;
    if exists (
      select 1 from invoices i
      where i.contract_id = p_contract_id and i.invoice_type = 'contract'
        and i.status in ('draft', 'pending_approval', 'ready')
        and coalesce(i.is_consolidated, false) = false
        and i.addon_billing_group_id is not distinct from v_group
        and i.billing_period_start <= s.start_day
        and coalesce(i.billing_period_end, i.billing_period_start) >= s.start_day
        and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
             or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
                 and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                             and ii.line_kind in ('equipment_annual', 'equipment_monthly'))))) then
      continue;
    end if;
    select * into e from addon_prorata_v2_end_for_group(p_contract_id, s.id, s.start_day, v_group);
    if e.end_day is null then
      continue;
    end if;
    v_days := addon_station_uncovered_days(s.id, s.kind, s.start_day, e.end_day - 1);
    if v_days <= 0 then
      continue;
    end if;
    v_st := v_st || jsonb_build_object('case_id', s.placed_case_id, 'station_type_id', s.station_type_id,
      'model', s.model, 'end_day', e.end_day, 'start_day', s.start_day, 'days', v_days);
  end loop;

  if p_annual is not null and p_annual > 0 then
    for g in
      select x->>'case_id' as case_id, x->>'station_type_id' as station_type_id, x->>'model' as model,
             (x->>'end_day')::date as end_day, min((x->>'start_day')::date) as start_day,
             count(*)::int as n, sum((x->>'days')::int)::numeric as day_sum
      from jsonb_array_elements(v_st) x
      group by 1, 2, 3, 4
      order by 4
    loop
      v_unit := round(p_annual * (g.day_sum / g.n) / 365.0, 2);
      v_total := v_total + round(v_unit * g.n, 2);
      v_rows := v_rows || jsonb_build_object('quantity', g.n, 'total', round(v_unit * g.n, 2),
        'start_day', g.start_day, 'end_day', g.end_day, 'days', round(g.day_sum / g.n));
      if v_first is null or g.end_day < v_first then
        v_first := g.end_day;
      end if;
    end loop;
  end if;

  if v_first is null then
    v_first := contract_addon_next_period_start(p_contract_id, v_today, coalesce(v_model, 'per_year'), v_group);
  end if;

  return jsonb_build_object(
    'group_id', v_group,
    'cadence', v_cadence,
    'first_invoice', v_first,
    'total', round(v_total, 2),
    'rows', v_rows);
end $$;

revoke all on function public.addon_prorata_v2_end_for_group(uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.addon_prorata_v2_end_for_group(uuid, uuid, date, uuid) to service_role;
revoke all on function public.addon_prorata_v2_end(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.addon_prorata_v2_end(uuid, uuid, date) to service_role;
revoke all on function public.addon_group_prorata_preview(uuid, uuid, uuid[], uuid[], numeric) from public, anon;
grant execute on function public.addon_group_prorata_preview(uuid, uuid, uuid[], uuid[], numeric) to authenticated, service_role;
