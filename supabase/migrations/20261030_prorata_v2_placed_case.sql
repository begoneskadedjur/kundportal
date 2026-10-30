-- Steg 9 (avtalsåret på avtalsdag), del 2 av 2 (del 1: 20261030_prorata_v2_funktioner.sql): station kopplas till ärendet där den
-- sattes ut, pro rata version 2.
--
-- 1. sync_addon_prorata_line_legacy: dagens sync_addon_prorata_line, omdöpt (ordagrant).
-- 2. sync_addon_prorata_line_v2: ny regel, gäller bara enheter där avtalet har
--    addon_rules = 'v2'. Per station och ärende (placed_case_id), bara dagar
--    som saknar täckning, kapas vid avtalets slut, förlängs förbi låsta
--    tilläggsfakturor som inte innehåller stationen (ledtidsregeln).
-- 3. sync_addon_prorata_line (samma signatur): väljer gren. Utan v2-avtal går
--    anropet till legacy med exakt samma argument, så alla avtal i dag får
--    samma resultat som före migrationen.
-- 4. trg_station_placed_case: BEFORE INSERT på båda stationstabellerna. Sätter
--    placed_case_id på nya tilläggsstationer när enheten har exakt ett öppet
--    etableringsärende eller pågående kontrollärende. Rör inga befintliga rader.
-- 5. trg_cbi_prorata_coverage: pro rata-täckningen skrivs bara över dagar som
--    saknar täckning (glappen). Gäller bara rader med station_ids, som bara
--    version 2 fyller.
--
-- Inga glappfakturor (equipment_gap) skapas här; det är steg 11.
-- Backning: 20261030_prorata_v2_placed_case_backning.sql.

-- 1. Dagens funktion ordagrant under nytt namn ------------------------------
-- Döps om i stället för att skrivas av, så att kroppen är exakt dagens
-- (md5 på prosrc 21da9cefdea958769f30136f5743869f före och efter).
alter function public.sync_addon_prorata_line(uuid, numeric, uuid, text, uuid)
  rename to sync_addon_prorata_line_legacy;

-- 3. Samma signatur som förut: väljer gren -----------------------------------
create or replace function public.sync_addon_prorata_line(p_customer_id uuid, p_annual_price numeric DEFAULT NULL::numeric, p_technician_id uuid DEFAULT NULL::uuid, p_technician_name text DEFAULT NULL::text, p_case_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  if addon_prorata_uses_v2(p_customer_id) then
    return sync_addon_prorata_line_v2(p_customer_id, p_annual_price, p_technician_id, p_technician_name, p_case_id);
  end if;
  return sync_addon_prorata_line_legacy(p_customer_id, p_annual_price, p_technician_id, p_technician_name, p_case_id);
end;
$function$;

-- Hjälpfunktionerna och grenarna anropas bara inifrån sync_addon_prorata_line
revoke all on function public.sync_addon_prorata_line_legacy(uuid, numeric, uuid, text, uuid) from public, anon, authenticated;

-- 4. Reservtriggern för ärendet ---------------------------------------------
create or replace function public.trg_station_placed_case()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_unit uuid;
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_ids uuid[];
begin
  if new.placed_case_id is not null or not coalesce(new.is_addon, false) then
    return new;
  end if;
  begin
    if tg_table_name = 'indoor_stations' then
      select fp.customer_id into v_unit from floor_plans fp where fp.id = new.floor_plan_id;
    else
      v_unit := new.customer_id;
    end if;
    if v_unit is null then
      return new;
    end if;
    select array_agg(distinct x.id) into v_ids
    from (
      select c.id from cases c
      where c.customer_id = v_unit and c.service_type = 'establishment'
        and c.deleted_at is null and c.status not ilike '%avslutat%' and c.status not ilike '%borttag%'
        and (c.created_at at time zone 'Europe/Stockholm')::date <= v_today
      union
      select c.id from cases c join station_inspection_sessions si on si.case_id = c.id
      where c.customer_id = v_unit
        and c.deleted_at is null and c.status not ilike '%avslutat%' and c.status not ilike '%borttag%'
        and (c.created_at at time zone 'Europe/Stockholm')::date <= v_today
        and si.started_at is not null and si.completed_at is null
        and si.status not in ('completed', 'cancelled')
    ) x;
    if coalesce(cardinality(v_ids), 0) = 1 then
      new.placed_case_id := v_ids[1];
    end if;
  exception when others then
    raise warning 'trg_station_placed_case: ärendet kunde inte sättas: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.trg_station_placed_case() from public, anon, authenticated;

create or replace trigger trg_station_placed_case
  before insert on public.equipment_placements
  for each row execute function public.trg_station_placed_case();
create or replace trigger trg_station_placed_case
  before insert on public.indoor_stations
  for each row execute function public.trg_station_placed_case();

-- 5. Pro rata-täckning bara över glappen ------------------------------------
create or replace function public.trg_cbi_prorata_coverage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sid uuid;
  st record;
  gp record;
  v_invoice uuid;
  v_item uuid;
  v_to date;
  v_any boolean;
begin
  if new.billing_start_date is null then
    return new;
  end if;
  begin
    v_to := new.billing_start_date - 1;
    select ii.invoice_id, ii.id into v_invoice, v_item
    from invoice_items ii join invoices i on i.id = ii.invoice_id
    where ii.case_billing_item_id = new.id and i.status <> 'cancelled'
    order by i.created_at desc
    limit 1;
    foreach v_sid in array new.station_ids loop
      select * into st from addon_station_lookup(v_sid, null) limit 1;
      if st.unit_customer_id is null or st.start_day is null or st.start_day > v_to then
        continue;
      end if;
      -- Pro rata version 2 debiterar bara dagar utan täckning; täckningen
      -- skrivs över samma glapp. Finns inget glapp alls skrivs hela perioden
      -- som förut (blir konflikt eller ingenting om raden redan finns).
      v_any := false;
      for gp in
        with days as (
          select d::date as day from generate_series(st.start_day, v_to, interval '1 day') d
          where not exists (
            select 1 from addon_station_coverage a
            where a.station_id = v_sid and a.station_kind = st.station_kind and a.released_at is null
              and d::date between a.covered_from and a.covered_to)
        ), grp as (
          select day, day - (row_number() over (order by day))::int as g from days
        )
        select min(day) as gap_from, max(day) as gap_to from grp group by g order by 1
      loop
        if not v_any then
          -- första glappet: samma väg som förut (lås, idempotens, konflikt)
          perform addon_coverage_write_or_conflict(v_sid, st.station_kind, st.unit_customer_id, st.contract_id,
                                                   gp.gap_from, gp.gap_to, 'prorata',
                                                   v_invoice, v_item, new.id);
        else
          -- följande glapp: write_or_conflict ser raden ovan och skulle hoppa
          -- över; glappet är otäckt per definition och vakten prövar ändå
          insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id,
                                              covered_from, covered_to, source,
                                              invoice_id, invoice_item_id, case_billing_item_id, created_by_name)
          values (v_sid, st.station_kind, st.unit_customer_id, st.contract_id, gp.gap_from, gp.gap_to, 'prorata',
                  v_invoice, v_item, new.id, 'System');
        end if;
        v_any := true;
      end loop;
      if not v_any then
        perform addon_coverage_write_or_conflict(v_sid, st.station_kind, st.unit_customer_id, st.contract_id,
                                                 st.start_day, v_to, 'prorata',
                                                 v_invoice, v_item, new.id);
      end if;
    end loop;
  exception when others then
    raise warning 'trg_cbi_prorata_coverage: täckning för rad % kunde inte skrivas: %', new.id, sqlerrm;
  end;
  return new;
end $function$;
