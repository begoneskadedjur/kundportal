-- Faktureringsgrupper, tre rättelser (2026-11-03, 3.117.2, steg 0c i
-- docs/planer/avtalsar-exakt-arsdag-teknik.md).
--
-- Grundregel: varje dag en tilläggsstation står ute faktureras exakt en gång,
-- via pro rata på etableringsärendet, täckning, glappfaktura eller en
-- planerad faktura. Pro rata (sync_addon_prorata_line_v2), förhandsvisningen
-- (addon_group_prorata_preview) och glappen (addon_gap_candidates) går alla
-- genom addon_prorata_v2_end_for_group; planeringen (computeAddonPlanV2 i
-- Planera fakturor och nattjobbet) läser § 6-radens startdag.
--
-- 1. Startdatum vid gruppbyte: addon_line_start_for_group ger samma startdag
--    som synken ger en ny rad. set_addon_line_billing_group och helradsflytten
--    i set_addon_station_billing_group sätter den när raden byter grupp.
-- 2. Tomma rader: synken makulerar v2-rader med antal 0 som saknar historik
--    (fakturarader, täckning, konflikter, avtalsrader, arbetsrader). Rader med
--    historik behålls men flyttas inte med och väljs inte före en rad med
--    stationer (addon_line_group_for_key).
-- 3. Pro rata till första planerade periodstart: addon_first_billable_start
--    (gruppens skapad-dag, första period planeraren tar, radens startdag) och
--    addon_prorata_v2_end_for_group går vidare period för period tills dit.
--    Utan grupp gäller det bara stationer per månad (steg 0); per år utan
--    grupp är oförändrat.
--
-- Additiv: två nya funktioner och omskrivningar. Inga kunddata ändras av
-- migrationen (synken makulerar tomma rader när den körs nästa gång).

-- ─── 1. Startdag för en ny eller flyttad § 6-rad ────────────────────────────

create or replace function public.addon_line_start_for_group(p_contract_id uuid, p_model text, p_group_id uuid, p_today date)
 returns date
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- Samma regel som sync_addon_period_lines använder när den lägger till en rad
  select case
    when public.addon_billing_group_valid(p_group_id, p_contract_id) is not null
      then public.contract_addon_next_period_start(p_contract_id, p_today, p_model, public.addon_billing_group_valid(p_group_id, p_contract_id))
    when p_model = 'per_month' then (date_trunc('month', p_today) + interval '1 month')::date
    else public.contract_next_period_start(p_contract_id, p_today)
  end;
$function$;

comment on function public.addon_line_start_for_group(uuid, text, uuid, date) is
  'Startdagen (billing_start_date) en ny eller flyttad § 6-rad får i gruppen (NULL = utan grupp). Samma regel som synken.';

-- ─── 3. Första periodstart planeraren fakturerar ────────────────────────────

create or replace function public.addon_first_billable_start(
  p_contract_id uuid, p_unit_id uuid, p_station_type_id uuid, p_model text, p_group_id uuid, p_today date)
 returns date
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  c record;
  g record;
  v_group uuid;
  v_anchor date;
  v_floor date;
  v_lh date;
  v_line date;
  v_mprem boolean;
  v_prem boolean;
  v_freq text;
  v_exact boolean;
begin
  select id, contract_start_date, billing_frequency, billing_anchor_mode into c from contracts where id = p_contract_id;
  if not found or p_today is null then
    return null;
  end if;
  v_group := addon_billing_group_valid(p_group_id, p_contract_id);
  v_prem := addon_contract_has_premium(p_contract_id);
  v_mprem := v_prem and coalesce(c.billing_frequency, '') = 'monthly';
  -- Utan grupp: bara stationer per månad på egna månadsfakturor (steg 0)
  if v_group is null and not (p_model = 'per_month' and not v_mprem) then
    return null;
  end if;

  -- § 6-radens startdag; utan rad den startdag synken ger en ny rad
  select b.billing_start_date into v_line
  from case_billing_items b
  where b.case_id = p_contract_id and b.site_customer_id = p_unit_id
    and b.station_type_id is not distinct from p_station_type_id and b.billing_model = p_model
    and b.status <> 'cancelled' and not coalesce(b.is_addon_labour_line, false) and not coalesce(b.is_addon_prorata_line, false)
    and addon_billing_group_valid(b.addon_billing_group_id, p_contract_id) is not distinct from v_group
  order by (coalesce(b.quantity, 0) > 0) desc, b.created_at
  limit 1;
  if not found then
    v_line := addon_line_start_for_group(p_contract_id, p_model, v_group, p_today);
  end if;

  if v_group is not null then
    select gr.cadence, gr.created_at into g from contract_addon_billing_groups gr where gr.id = v_group;
    -- Perioder före dagen gruppen skapades tas inte med (computeGroupBuckets)
    v_floor := (g.created_at at time zone 'Europe/Stockholm')::date;
    if g.cadence <> 'follows_premium' then
      v_anchor := contract_addon_billing_group_anchor(v_group);
    end if;
  end if;

  if v_anchor is not null then
    -- Gruppens egen takt. Månad: från perioden som innehåller dagen;
    -- kvartal, halvår, år: inga passerade perioder (före innevarande månad)
    if g.cadence = 'monthly' then
      if p_today < v_anchor then
        v_lh := v_anchor;
      else
        select p.period_start into v_lh from contract_period_on_pure(v_anchor, 'monthly', p_today) p;
      end if;
    else
      v_lh := date_trunc('month', p_today)::date;
    end if;
    -- Radens startdag snäpps bakåt till gruppens period som innehåller den
    if v_line is not null and v_line > v_anchor then
      select p.period_start into v_line from contract_period_on_pure(v_anchor, g.cadence, v_line) p;
    end if;
    return greatest(v_floor, v_lh, v_line);
  end if;

  if p_model = 'per_month' and not v_mprem then
    -- Egna månadsfakturor (computePlannedMonthlyEquipmentPeriods): från
    -- perioden som innehåller dagen, raden från sin startdag
    if c.billing_anchor_mode = 'start_day' and c.contract_start_date is not null then
      if p_today < c.contract_start_date then
        v_lh := c.contract_start_date;
      else
        select p.period_start into v_lh from contract_period_on_pure(c.contract_start_date, 'monthly', p_today) p;
      end if;
    else
      v_lh := date_trunc('month', p_today)::date;
    end if;
    return greatest(v_floor, v_lh, v_line);
  end if;

  -- Grupp som följer premien: premiens perioder (eller årsdagen utan premie),
  -- inga passerade perioder; i exakt läge tas en rad med från en halvårs- eller
  -- årsperiod som började högst 31 dagar före dess startdag (snapsToPeriodStart)
  v_lh := date_trunc('month', p_today)::date;
  if v_prem and coalesce(c.billing_frequency, '') in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    v_freq := c.billing_frequency;
    v_exact := c.billing_anchor_mode = 'start_day';
  else
    v_freq := 'annual';
    v_exact := true;
  end if;
  if v_line is not null and v_exact and v_freq in ('semi_annual', 'annual') then
    v_line := v_line - 31;
  end if;
  -- Vid månadspremie ligger raderna på premiefakturan: ingen skapad-gräns
  return greatest(case when v_mprem then null else v_floor end, v_lh, v_line);
end $function$;

comment on function public.addon_first_billable_start(uuid, uuid, uuid, text, uuid, date) is
  'Första dag planeraren kan fakturera en station i (avtal, enhet, typ, modell, grupp) från: gruppens skapad-dag, första icke passerade period och § 6-radens startdag. NULL utan grupp för per år (oförändrat). TS-tvilling: addonFirstBillableStart.';

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
  v_type uuid;
  v_unit uuid;
  v_group uuid;
  v_group_key text;
  v_min date;
  v_next date;
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
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
  select coalesce(
    (select ep.station_type_id from equipment_placements ep where ep.id = p_station_id),
    (select s.station_type_id from indoor_stations s where s.id = p_station_id)
  ) into v_type;
  -- Faktureringsgruppen (giltig för avtalet), NULL = vanliga regler
  v_group := addon_billing_group_valid(p_group_id, p_contract_id);
  -- Steg 11: tilläggens takt (premiens perioder, eller årsdagen utan premie)
  ordinary := contract_addon_next_period_start(p_contract_id, p_start, v_model, v_group);
  v_unit := (select l.unit_customer_id from addon_station_lookup(p_station_id, null) l limit 1);
  v_key := addon_marking_key_for_unit(v_unit, p_contract_id);
  if v_group is not null then
    select nullif(upper(trim(g.marking)), '') into v_group_key from contract_addon_billing_groups g where g.id = v_group;
    v_key := coalesce(v_group_key, v_key);
  end if;
  if ordinary is null then
    return;
  end if;
  -- Steg 0c: första periodstart planeraren fakturerar (NULL = som förut)
  v_min := addon_first_billable_start(p_contract_id, v_unit, v_type, v_model, v_group, v_today);
  v_end := ordinary;
  capped := false;
  unknown_invoice := null;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 60;
    -- Låsta fakturor som förut. Före första planerade periodstart också
    -- utkast: de faktureras som de ligger (planeraren rör inte passerade).
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
      and (i.status in ('booked', 'sent', 'overdue', 'paid')
           or (v_min is not null and v_end < v_min and i.status in ('draft', 'pending_approval', 'ready')))
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
    if found then
      exit when inv.has_station;
      if not inv.has_ids then
        unknown_invoice := inv.nr;
        exit;
      end if;
      exit when inv.pe + 1 <= v_end;
      v_end := inv.pe + 1;
    else
      -- Ingen faktura här: vidare till nästa periodstart så länge planeraren
      -- inte fakturerar perioden (passerad, före gruppen, före radens start)
      exit when v_min is null or v_end >= v_min;
      v_next := contract_addon_next_period_start(p_contract_id, v_end, v_model, v_group);
      exit when v_next is null or v_next <= v_end;
      v_end := v_next;
    end if;
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

-- ─── 1 och 2. Raderna: startdag vid gruppbyte, tomma rader ──────────────────

create or replace function public.addon_line_group_for_key(p_contract_id uuid, p_unit_id uuid, p_station_type_id uuid, p_model text)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- En rad med stationer före en tom rad (steg 0c)
  select public.addon_billing_group_valid(
    (select b.addon_billing_group_id from public.case_billing_items b
     where b.case_id = p_contract_id and b.site_customer_id = p_unit_id
       and b.station_type_id is not distinct from p_station_type_id and b.billing_model = p_model
       and b.status <> 'cancelled' and not coalesce(b.is_addon_labour_line, false)
     order by (coalesce(b.quantity, 0) > 0) desc, b.addon_billing_group_id nulls first, b.created_at
     limit 1),
    p_contract_id);
$function$;

create or replace function public.set_addon_line_billing_group(p_line_id uuid, p_group_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  l record;
  v_old uuid;
  v_out int := 0;
  v_in int := 0;
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  if not addon_billing_group_can_write() then
    raise exception 'Behörighet saknas: kräver admin eller koordinator';
  end if;
  select * into l from case_billing_items where id = p_line_id;
  if not found or l.case_type is distinct from 'contract' or coalesce(l.billing_model, '') not in ('per_year', 'per_month') then
    raise exception 'Raden är ingen tilläggsrad i § 6';
  end if;
  if p_group_id is not null and addon_billing_group_valid(p_group_id, l.case_id) is null then
    raise exception 'Gruppen hör inte till avtalet, eller avtalet har inte nya tilläggsregler';
  end if;
  v_old := addon_billing_group_valid(l.addon_billing_group_id, l.case_id);
  if v_old is not distinct from p_group_id then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if l.site_customer_id is not null and exists (
    select 1 from case_billing_items x
    where x.id <> l.id and x.case_id = l.case_id and x.site_customer_id = l.site_customer_id
      and x.station_type_id is not distinct from l.station_type_id and x.billing_model = l.billing_model
      and x.status <> 'cancelled' and not coalesce(x.is_addon_labour_line, false)
      and addon_billing_group_valid(x.addon_billing_group_id, l.case_id) is not distinct from p_group_id) then
    raise exception 'Enheten har redan en rad för stationstypen i den gruppen. Byt grupp på stationerna i stället.';
  end if;
  -- Steg 0c: raden börjar som en ny rad i gruppen; dagarna före fångas av
  -- pro rata, glapp eller täckning (addon_first_billable_start läser startdagen)
  update case_billing_items
  set addon_billing_group_id = p_group_id,
      billing_start_date = addon_line_start_for_group(l.case_id, l.billing_model, p_group_id, v_today),
      updated_at = now()
  where id = l.id;
  if l.site_customer_id is not null then
    update equipment_placements ep set addon_billing_group_id = p_group_id
    where ep.addon_contract_id = l.case_id and ep.customer_id = l.site_customer_id and ep.is_addon and ep.status = 'active'
      and ep.station_type_id is not distinct from l.station_type_id and ep.addon_billing_model = l.billing_model
      and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
      and addon_billing_group_valid(ep.addon_billing_group_id, l.case_id) is not distinct from v_old;
    get diagnostics v_out = row_count;
    update indoor_stations s set addon_billing_group_id = p_group_id
    from floor_plans fp
    where fp.id = s.floor_plan_id and s.addon_contract_id = l.case_id and fp.customer_id = l.site_customer_id
      and s.is_addon and s.status = 'active'
      and s.station_type_id is not distinct from l.station_type_id and s.addon_billing_model = l.billing_model
      and coalesce(s.addon_contract_mode, 'separate') = 'separate'
      and addon_billing_group_valid(s.addon_billing_group_id, l.case_id) is not distinct from v_old;
    get diagnostics v_in = row_count;
  end if;
  return jsonb_build_object('ok', true, 'changed', true, 'stations', v_out + v_in);
end $function$;

create or replace function public.set_addon_station_billing_group(p_outdoor_ids uuid[], p_indoor_ids uuid[], p_group_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_contracts uuid[];
  v_c uuid;
  v_n int := 0;
  v_m int := 0;
  k record;
  v_others int;
  v_split boolean := addon_line_split_ready();
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  if not addon_billing_group_can_write() then
    raise exception 'Behörighet saknas: kräver admin eller koordinator';
  end if;
  select coalesce(array_agg(distinct x.cid), '{}') into v_contracts from (
    select ep.addon_contract_id as cid from equipment_placements ep where ep.id = any(coalesce(p_outdoor_ids, '{}'))
    union
    select s.addon_contract_id from indoor_stations s where s.id = any(coalesce(p_indoor_ids, '{}'))
  ) x where x.cid is not null;
  if p_group_id is not null then
    if cardinality(v_contracts) <> 1 or addon_billing_group_valid(p_group_id, v_contracts[1]) is null then
      raise exception 'Gruppen hör inte till stationernas avtal, eller avtalet har inte nya tilläggsregler';
    end if;
  end if;

  for k in
    select distinct x.cid, x.uid, x.tid, x.model from (
      select ep.addon_contract_id as cid, ep.customer_id as uid, ep.station_type_id as tid, ep.addon_billing_model as model
      from equipment_placements ep where ep.id = any(coalesce(p_outdoor_ids, '{}'))
      union all
      select s.addon_contract_id, fp.customer_id, s.station_type_id, s.addon_billing_model
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id where s.id = any(coalesce(p_indoor_ids, '{}'))
    ) x where x.cid is not null
  loop
    select count(*) into v_others from (
      select ep.id, addon_station_billing_group(ep.id, k.cid) as g from equipment_placements ep
      where ep.addon_contract_id = k.cid and ep.customer_id = k.uid and ep.station_type_id is not distinct from k.tid
        and ep.addon_billing_model = k.model and ep.is_addon and ep.status = 'active'
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
        and not (ep.id = any(coalesce(p_outdoor_ids, '{}')))
      union all
      select s.id, addon_station_billing_group(s.id, k.cid) from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      where s.addon_contract_id = k.cid and fp.customer_id = k.uid and s.station_type_id is not distinct from k.tid
        and s.addon_billing_model = k.model and s.is_addon and s.status = 'active'
        and coalesce(s.addon_contract_mode, 'separate') = 'separate'
        and not (s.id = any(coalesce(p_indoor_ids, '{}')))
    ) o where o.g is distinct from p_group_id;
    if v_others = 0 then
      -- Hela raden byter grupp och får den nya gruppens startdag (steg 0c).
      -- En tom rad (antal 0) flyttas inte med; synken lägger en ny rad.
      update case_billing_items b
      set addon_billing_group_id = p_group_id,
          billing_start_date = addon_line_start_for_group(k.cid, k.model, p_group_id, v_today),
          updated_at = now()
      where b.case_id = k.cid and b.site_customer_id = k.uid and b.station_type_id is not distinct from k.tid
        and b.billing_model = k.model and b.status <> 'cancelled' and not coalesce(b.is_addon_labour_line, false)
        and (v_split is false or (b.addon_billing_group_id is null and coalesce(b.quantity, 0) > 0))
        and addon_billing_group_valid(b.addon_billing_group_id, k.cid) is distinct from p_group_id;
    elsif not v_split then
      raise exception 'Enheten har fler stationer av samma typ på samma tilläggsrad. Byt grupp på hela raden under Faktureringsgrupper i avtalskartan.';
    end if;
  end loop;

  update equipment_placements set addon_billing_group_id = p_group_id where id = any(coalesce(p_outdoor_ids, '{}'));
  get diagnostics v_n = row_count;
  update indoor_stations set addon_billing_group_id = p_group_id where id = any(coalesce(p_indoor_ids, '{}'));
  get diagnostics v_m = row_count;
  foreach v_c in array v_contracts loop
    perform sync_addon_period_lines(null, v_c, null);
  end loop;
  return jsonb_build_object('ok', true, 'stations', v_n + v_m);
end $function$;

create or replace function public.sync_addon_period_lines(p_customer_id uuid DEFAULT NULL::uuid, p_contract_id uuid DEFAULT NULL::uuid, p_annual_price numeric DEFAULT NULL::numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_contract_id uuid := p_contract_id;
  v_contract_customer uuid;
  v_service_id uuid; v_service_code text; v_service_name text; v_base_price numeric;
  v_rows int := 0; r record;
  v_unit_price numeric; v_existing_id uuid; v_existing_price numeric; v_annual numeric; v_next_start date;
  v_missing jsonb := '[]'::jsonb; v_type_name text; v_type_service uuid;
  v_ended int;
  v_empty uuid[];
begin
  if not intranet_is_internal() and auth.role() <> 'service_role' and auth.uid() is not null then
    raise exception 'Behörighet saknas';
  end if;

  select id, code, name, base_price into v_service_id, v_service_code, v_service_name, v_base_price
  from services where used_for_addon_stations_annual = true and is_active = true limit 1;
  if v_service_id is null then return jsonb_build_object('ok', false, 'reason', 'service_missing'); end if;

  if v_contract_id is null then
    if p_customer_id is null then raise exception 'Ange enhet eller avtal'; end if;
    v_contract_id := addon_contract_for_unit(p_customer_id);
    if v_contract_id is null then return jsonb_build_object('ok', false, 'reason', 'no_contract'); end if;
  end if;

  if addon_contract_has_ended(v_contract_id) then
    v_ended := addon_cancel_lines_for_ended_contract(v_contract_id);
    return jsonb_build_object('ok', true, 'contract_id', v_contract_id, 'rows', 0, 'ended', true, 'cancelled', v_ended, 'price_missing', '[]'::jsonb);
  end if;

  select customer_id into v_contract_customer from contracts where id = v_contract_id;
  v_next_start := contract_next_period_start(v_contract_id, v_today);

  for r in
    with units as (
      select p_customer_id as customer_id where p_customer_id is not null
      union select c.customer_id from contracts c where c.id = v_contract_id and p_customer_id is null
      union select cs.customer_id from contract_sites cs where cs.contract_id = v_contract_id and p_customer_id is null and (cs.active_to is null or cs.active_to >= v_today)
      union select u.id from customers u join contracts c on c.id = v_contract_id and c.covers_all_sites = true and u.parent_customer_id = c.customer_id where p_customer_id is null
    ),
    stations as (
      select ep.customer_id, ep.station_type_id, ep.addon_billing_model as model, ep.addon_unit_price_annual as annual,
             coalesce(addon_billing_group_valid(ep.addon_billing_group_id, v_contract_id),
                      addon_line_group_for_key(v_contract_id, ep.customer_id, ep.station_type_id, ep.addon_billing_model)) as gid
      from equipment_placements ep join units u on u.customer_id = ep.customer_id
      where ep.is_addon = true and ep.status = 'active' and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate' and ep.addon_contract_id = v_contract_id
      union all
      select fp.customer_id, s.station_type_id, s.addon_billing_model, s.addon_unit_price_annual,
             coalesce(addon_billing_group_valid(s.addon_billing_group_id, v_contract_id),
                      addon_line_group_for_key(v_contract_id, fp.customer_id, s.station_type_id, s.addon_billing_model))
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id join units u on u.customer_id = fp.customer_id
      where s.is_addon = true and s.status = 'active' and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate' and s.addon_contract_id = v_contract_id
    ),
    counted as (
      select customer_id, station_type_id, model, gid, count(*) as n, sum(annual) as annual_sum, count(*) filter (where annual is null) as missing
      from stations group by customer_id, station_type_id, model, gid
    ),
    existing as (
      select site_customer_id as customer_id, station_type_id, billing_model as model,
             addon_billing_group_valid(addon_billing_group_id, v_contract_id) as gid, 0::bigint as n, null::numeric as annual_sum, 0::bigint as missing
      from case_billing_items
      where case_id = v_contract_id and site_customer_id is not null and billing_model in ('per_year', 'per_month') and status <> 'cancelled'
        and not is_addon_labour_line
        and (p_customer_id is null or site_customer_id = p_customer_id)
    )
    select customer_id, station_type_id, model, gid, max(n) as n, sum(annual_sum) as annual_sum, sum(missing) as missing
    from (select * from counted union all select * from existing) x
    group by customer_id, station_type_id, model, gid
  loop
    v_existing_id := null; v_existing_price := null;
    select id, unit_price into v_existing_id, v_existing_price
    from case_billing_items
    where case_id = v_contract_id and site_customer_id = r.customer_id
      and station_type_id is not distinct from r.station_type_id and billing_model = r.model and status <> 'cancelled'
      and not is_addon_labour_line
      and addon_billing_group_valid(addon_billing_group_id, v_contract_id) is not distinct from r.gid
    limit 1;

    v_annual := coalesce(
      p_annual_price,
      case when r.n > 0 and r.missing = 0 and r.annual_sum is not null then round(r.annual_sum / r.n, 2) end,
      addon_annual_price_for_type(r.station_type_id, r.customer_id, v_contract_id),
      v_base_price
    );

    if v_existing_id is not null then
      v_unit_price := coalesce(
        case when r.n > 0 and (p_annual_price is not null or (r.missing = 0 and r.annual_sum is not null))
             then (case when r.model = 'per_month' then round(v_annual / 12, 2) else v_annual end) end,
        v_existing_price
      );
      update case_billing_items
      set quantity = r.n, unit_price = v_unit_price, discounted_price = v_unit_price, total_price = round(v_unit_price * r.n, 2),
          addon_annual_unit_price = case when r.model = 'per_month' then round(v_unit_price * 12, 2) else v_unit_price end,
          updated_at = now()
      where id = v_existing_id;
      v_rows := v_rows + 1;
    elsif r.n > 0 then
      if v_annual is null or v_annual <= 0 then
        select name into v_type_name from station_types where id = r.station_type_id;
        v_missing := v_missing || jsonb_build_object('station_type_id', r.station_type_id, 'station_type', coalesce(v_type_name, 'Okänd stationstyp'), 'site_customer_id', r.customer_id, 'model', r.model, 'quantity', r.n);
        continue;
      end if;
      v_unit_price := case when r.model = 'per_month' then round(v_annual / 12, 2) else v_annual end;
      v_type_service := coalesce(addon_service_id_for_type(r.station_type_id), v_service_id);
      insert into case_billing_items (
        case_id, case_type, customer_id, site_customer_id, station_type_id, item_type, service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price, vat_rate, price_source, status, requires_approval, billing_model, billing_start_date,
        addon_annual_unit_price, notes, addon_billing_group_id
      ) values (
        v_contract_id, 'contract', v_contract_customer, r.customer_id, r.station_type_id, 'service', v_type_service,
        coalesce((select s2.code from services s2 where s2.id = v_type_service), v_service_code),
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        r.n, v_unit_price, 0, v_unit_price, round(v_unit_price * r.n, 2), 25, 'standard', 'pending', false, r.model,
        -- Samma regel som addon_line_start_for_group (gruppbyte, steg 0c)
        addon_line_start_for_group(v_contract_id, r.model, r.gid, v_today),
        v_annual,
        'Synkas från utplacerade tilläggsstationer', r.gid
      );
      v_rows := v_rows + 1;
    end if;
  end loop;

  -- Steg 0c: tomma rader (antal 0) utan historik makuleras på avtal med nya
  -- tilläggsregler. Historik = fakturarader (oavsett fakturans status),
  -- täckning, täckningskonflikter, avtalsrader eller arbetsrader som pekar på
  -- raden; sådana rader behålls med antal 0 och räknas inte. Artikelrader för
  -- intern kostnad som pekar på raden släpps först (som pro rata-synken).
  if exists (select 1 from contracts c where c.id = v_contract_id and c.addon_rules = 'v2') then
    select coalesce(array_agg(l.id), '{}') into v_empty
    from case_billing_items l
    where l.case_id = v_contract_id and l.case_type = 'contract' and l.item_type = 'service'
      and l.site_customer_id is not null and l.billing_model in ('per_year', 'per_month')
      and l.status <> 'cancelled' and coalesce(l.quantity, 0) = 0
      and not coalesce(l.is_addon_labour_line, false) and not coalesce(l.is_addon_prorata_line, false)
      and (p_customer_id is null or l.site_customer_id = p_customer_id)
      and not exists (select 1 from invoice_items ii where ii.case_billing_item_id = l.id)
      and not exists (select 1 from addon_station_coverage a where a.case_billing_item_id = l.id)
      and not exists (select 1 from addon_coverage_conflicts a where a.case_billing_item_id = l.id)
      and not exists (select 1 from contract_billing_items x where x.case_billing_item_id = l.id)
      and not exists (select 1 from case_billing_items k where k.labor_for_item_id = l.id);
    if cardinality(v_empty) > 0 then
      update case_billing_items set mapped_service_id = null, updated_at = now() where mapped_service_id = any(v_empty);
      update case_billing_items
      set status = 'cancelled',
          notes = coalesce(notes, '') || ' Makulerad av synken: inga stationer kvar på raden.',
          updated_at = now()
      where id = any(v_empty);
    end if;
  end if;

  update case_billing_items l
  set quantity = 0, unit_price = 0, discounted_price = 0, total_price = 0, addon_labour_hours = 0, updated_at = now()
  where l.case_id = v_contract_id and l.is_addon_labour_line and not l.is_addon_prorata_line
    and l.item_type = 'service' and l.status <> 'cancelled'
    and (p_customer_id is null or l.site_customer_id = p_customer_id)
    and coalesce(l.addon_labour_hours, 0) > 0
    and not exists (
      select 1 from equipment_placements ep
      where ep.customer_id = l.site_customer_id and ep.is_addon and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate' and ep.addon_contract_id = v_contract_id
      union all
      select 1 from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      where fp.customer_id = l.site_customer_id and s.is_addon and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate' and s.addon_contract_id = v_contract_id
    );

  return jsonb_build_object('ok', jsonb_array_length(v_missing) = 0, 'contract_id', v_contract_id, 'rows', v_rows, 'next_period_start', v_next_start, 'price_missing', v_missing);
end;
$function$;

revoke all on function public.addon_line_start_for_group(uuid, text, uuid, date) from public, anon, authenticated;
grant execute on function public.addon_line_start_for_group(uuid, text, uuid, date) to service_role;
revoke all on function public.addon_first_billable_start(uuid, uuid, uuid, text, uuid, date) from public, anon, authenticated;
grant execute on function public.addon_first_billable_start(uuid, uuid, uuid, text, uuid, date) to service_role;
