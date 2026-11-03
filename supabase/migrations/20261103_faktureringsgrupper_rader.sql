-- Faktureringsgrupper, del 2 (2026-11-03): en § 6-rad per enhet, stationstyp
-- och modell så länge cbi_addon_period_line_key finns.
--
-- Det unika indexet cbi_addon_period_line_key (case_id, site_customer_id,
-- station_type_id, billing_model) tillåter bara EN tilläggsrad per enhet,
-- stationstyp och modell. Gruppen är därför radens: en station utan egen grupp
-- ärver gruppen från raden den ligger på (addon_line_group_for_key), och
-- stationer kan bara byta grupp alla på en gång per rad så länge indexet finns
-- (set_addon_station_billing_group). Utan grupper är allt som förut.
--
-- Additivt: nytt unikt index med gruppen (svagare än det gamla så länge det
-- finns), nya och omskrivna funktioner. Drop-raden för det gamla indexet står
-- längst ned, bortkommenterad, för Christian att köra.

create unique index if not exists cbi_addon_period_line_group_key
  on public.case_billing_items (case_id, site_customer_id, station_type_id, billing_model, coalesce(addon_billing_group_id::text, ''::text))
  where site_customer_id is not null and station_type_id is not null
    and billing_model = any (array['per_year'::text, 'per_month'::text]) and status <> 'cancelled'::text;

-- Kan en enhet ha flera § 6-rader för samma stationstyp och modell (en per grupp)?
create or replace function public.addon_line_split_ready()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'case_billing_items' and indexname = 'cbi_addon_period_line_key');
$$;

-- Gruppen på § 6-raden för enhet, stationstyp och modell (rad utan grupp går först)
create or replace function public.addon_line_group_for_key(p_contract_id uuid, p_unit_id uuid, p_station_type_id uuid, p_model text)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select public.addon_billing_group_valid(
    (select b.addon_billing_group_id from public.case_billing_items b
     where b.case_id = p_contract_id and b.site_customer_id = p_unit_id
       and b.station_type_id is not distinct from p_station_type_id and b.billing_model = p_model
       and b.status <> 'cancelled' and not coalesce(b.is_addon_labour_line, false)
     order by b.addon_billing_group_id nulls first, b.created_at
     limit 1),
    p_contract_id);
$$;

-- Stationens grupp: egen, annars radens (ärvs)
create or replace function public.addon_station_billing_group(p_station_id uuid, p_contract_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select coalesce(public.addon_billing_group_valid(ep.addon_billing_group_id, p_contract_id),
                     public.addon_line_group_for_key(p_contract_id, ep.customer_id, ep.station_type_id, ep.addon_billing_model))
     from public.equipment_placements ep where ep.id = p_station_id),
    (select coalesce(public.addon_billing_group_valid(s.addon_billing_group_id, p_contract_id),
                     public.addon_line_group_for_key(p_contract_id, fp.customer_id, s.station_type_id, s.addon_billing_model))
     from public.indoor_stations s join public.floor_plans fp on fp.id = s.floor_plan_id where s.id = p_station_id));
$$;

-- Glappen: stationens grupp ärvs från raden på samma sätt
-- Synken: station utan egen grupp hamnar på radens grupp
do $mig$
declare
  v_def text;
  v_new text;
  v_prev text;
  v_pairs text[][];
  i int;
begin
  v_def := pg_get_functiondef('public.sync_addon_period_lines(uuid,uuid,numeric)'::regprocedure);
  v_pairs := array[
    array[$a$addon_billing_group_valid(ep.addon_billing_group_id, v_contract_id) as gid$a$,
          $a$coalesce(addon_billing_group_valid(ep.addon_billing_group_id, v_contract_id),
                      addon_line_group_for_key(v_contract_id, ep.customer_id, ep.station_type_id, ep.addon_billing_model)) as gid$a$],
    array[$a$addon_billing_group_valid(s.addon_billing_group_id, v_contract_id)
      from indoor_stations s$a$,
          $a$coalesce(addon_billing_group_valid(s.addon_billing_group_id, v_contract_id),
                      addon_line_group_for_key(v_contract_id, fp.customer_id, s.station_type_id, s.addon_billing_model))
      from indoor_stations s$a$]
  ];
  v_new := v_def;
  for i in 1 .. array_length(v_pairs, 1) loop
    v_prev := v_new;
    v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
    if v_new = v_prev then
      raise exception 'sync_addon_period_lines: byte % hittades inte', i;
    end if;
  end loop;
  execute v_new;

  v_def := pg_get_functiondef('public.addon_gap_candidates(uuid)'::regprocedure);
  v_pairs := array[
    array[$a$addon_billing_group_valid(ep.addon_billing_group_id, p_contract_id) as gid$a$,
          $a$addon_station_billing_group(ep.id, p_contract_id) as gid$a$],
    array[$a$addon_billing_group_valid(s2.addon_billing_group_id, p_contract_id)
    from indoor_stations s2$a$,
          $a$addon_station_billing_group(s2.id, p_contract_id)
    from indoor_stations s2$a$]
  ];
  v_new := v_def;
  for i in 1 .. array_length(v_pairs, 1) loop
    v_prev := v_new;
    v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
    if v_new = v_prev then
      raise exception 'addon_gap_candidates: byte % hittades inte', i;
    end if;
  end loop;
  execute v_new;

  v_def := pg_get_functiondef('public.sync_addon_prorata_line_v2(uuid,numeric,uuid,text,uuid)'::regprocedure);
  v_pairs := array[
    array[$a$and i.addon_billing_group_id is not distinct from addon_billing_group_valid(s.gid, s.addon_contract_id)$a$,
          $a$and i.addon_billing_group_id is not distinct from addon_station_billing_group(s.id, s.addon_contract_id)$a$]
  ];
  v_new := v_def;
  for i in 1 .. array_length(v_pairs, 1) loop
    v_prev := v_new;
    v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
    if v_new = v_prev then
      raise exception 'sync_addon_prorata_line_v2: byte % hittades inte', i;
    end if;
  end loop;
  execute v_new;
end $mig$;

-- Stationer byter grupp. Så länge cbi_addon_period_line_key finns kan en rad
-- inte delas: flyttas alla aktiva stationer på raden byter raden grupp, annars
-- stoppas bytet med ett tydligt besked. Därefter synkas § 6-raderna.
create or replace function public.set_addon_station_billing_group(p_outdoor_ids uuid[], p_indoor_ids uuid[], p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contracts uuid[];
  v_c uuid;
  v_n int := 0;
  v_m int := 0;
  k record;
  v_others int;
  v_split boolean := addon_line_split_ready();
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

  -- En rad per enhet, stationstyp och modell: hela raden eller inget
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
      -- Alla stationer på raden flyttas: raden byter grupp
      update case_billing_items b set addon_billing_group_id = p_group_id, updated_at = now()
      where b.case_id = k.cid and b.site_customer_id = k.uid and b.station_type_id is not distinct from k.tid
        and b.billing_model = k.model and b.status <> 'cancelled' and not coalesce(b.is_addon_labour_line, false)
        and (v_split is false or b.addon_billing_group_id is null);
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
end $$;

revoke all on function public.addon_line_split_ready() from anon;
revoke all on function public.addon_line_group_for_key(uuid, uuid, uuid, text) from anon;

-- ─── Drop-raderna (körs INTE här; Christian kör dem i SQL-editorn) ─────────
-- Efter dem kan en enhet ha en § 6-rad per grupp för samma stationstyp och
-- modell, och två grupper kan ha fakturor med samma typ, periodstart och märkning.
--
--   drop index if exists public.cbi_addon_period_line_key;
--   drop index if exists public.invoices_contract_period_marking_key;
