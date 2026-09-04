-- ═══════════════════════════════════════════════════════════════
-- Fas A: buggar först
--
-- 1. Backfyllnad av station_type_id (743 rader) + trigger som håller
--    kopplingen ifylld framgent. Utan den skapas § 6-rader utan
--    dubblettskydd, eftersom cbi_addon_period_line_key kräver NOT NULL.
-- 2. RLS: profiles.id -> profiles.user_id på equipment_placements INSERT
--    och station_types ALL. indoor_stations stramas åt från using(true).
-- 3. Nollprisskyddet: sync_addon_period_lines slutar skriva unit_price = 0
--    när priset saknas. Raden skapas inte, och anroparen får price_missing.
--    Utan detta försvinner tilläggsstationer tyst ur faktureringen.
-- 4. Pro rata räknas från markeringsdatum, inte placed_at, så stationer
--    som redan står ute ger en pro rata-rad när de markeras som tillägg.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Stationstyp: normalisering, backfyllnad, trigger
-- ─────────────────────────────────────────────────────────────

-- unaccent finns inte installerad, så normaliseringen görs med translate.
create or replace function station_type_code_norm(p_text text)
returns text
language sql
immutable
as $$
  select translate(lower(trim(coalesce(p_text, ''))), 'åäöéèüÅÄÖÉÈÜ ', 'aaoeeuaaoeeu_');
$$;

comment on function station_type_code_norm(text) is
  'Normaliserar en stationstypstext till jämförbar kod: gemener, svenska tecken utan diakriter, mellanslag till understreck.';

create or replace function station_type_id_for_text(p_text text)
returns uuid
language sql
stable
as $$
  select st.id from station_types st
  where station_type_code_norm(st.code) = station_type_code_norm(p_text)
     or station_type_code_norm(st.name) = station_type_code_norm(p_text)
  order by (station_type_code_norm(st.code) = station_type_code_norm(p_text)) desc
  limit 1;
$$;

-- Backfyllnad: 711 equipment_placements + 32 indoor_stations
update equipment_placements ep
set station_type_id = station_type_id_for_text(ep.equipment_type)
where ep.station_type_id is null
  and station_type_id_for_text(ep.equipment_type) is not null;

update indoor_stations s
set station_type_id = station_type_id_for_text(s.station_type)
where s.station_type_id is null
  and station_type_id_for_text(s.station_type) is not null;

-- Trigger: håll kopplingen ifylld även om servicelagret kringgås
create or replace function station_type_id_autofill()
returns trigger
language plpgsql
as $$
begin
  if new.station_type_id is null then
    new.station_type_id := station_type_id_for_text(
      case tg_table_name when 'indoor_stations' then new.station_type else new.equipment_type end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_placements_station_type on public.equipment_placements;
create trigger trg_equipment_placements_station_type
  before insert or update on public.equipment_placements
  for each row execute function station_type_id_autofill();

drop trigger if exists trg_indoor_stations_station_type on public.indoor_stations;
create trigger trg_indoor_stations_station_type
  before insert or update on public.indoor_stations
  for each row execute function station_type_id_autofill();

-- ─────────────────────────────────────────────────────────────
-- 2. RLS: profiles.id är inte alltid auth.uid()
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Staff can insert equipment" on public.equipment_placements;
create policy "Staff can insert equipment" on public.equipment_placements
  for insert with check (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and profiles.role in ('admin', 'koordinator', 'technician'))
  );

drop policy if exists "Admins can manage station types" on public.station_types;
create policy "Admins can manage station types" on public.station_types
  for all using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and (profiles.role = 'admin' or profiles.is_admin = true))
  ) with check (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and (profiles.role = 'admin' or profiles.is_admin = true))
  );

-- indoor_stations låg öppen: using(true) för alla fyra, alltså skrivbar
-- av varje inloggad inklusive kundkonton. Läsning behålls bred (kunder
-- ser sina egna planritningar via floor_plans), skrivning blir personal.
drop policy if exists "Authenticated users can create indoor stations" on public.indoor_stations;
create policy "Personal kan skapa inomhusstationer" on public.indoor_stations
  for insert with check (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and profiles.role in ('admin', 'koordinator', 'technician'))
  );

drop policy if exists "Authenticated users can update indoor stations" on public.indoor_stations;
create policy "Personal kan uppdatera inomhusstationer" on public.indoor_stations
  for update using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and profiles.role in ('admin', 'koordinator', 'technician'))
  );

drop policy if exists "Authenticated users can delete indoor stations" on public.indoor_stations;
create policy "Personal kan ta bort inomhusstationer" on public.indoor_stations
  for delete using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and profiles.role in ('admin', 'koordinator', 'technician'))
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Nollprisskyddet i sync_addon_period_lines
--
-- Tidigare: v_annual := coalesce(p_annual_price, v_base_price) där
-- base_price är null för tjänst 144 -> ny rad fick unit_price = 0 ->
-- contractPlanner filtrerade bort unit_price_annual > 0 utan spår.
-- Nu: rader utan pris skapas inte, och station_type_id samlas i
-- price_missing så anroparen kan visa "pris saknas" som blockerande fel.
-- ─────────────────────────────────────────────────────────────

create or replace function sync_addon_period_lines(
  p_customer_id uuid default null,
  p_contract_id uuid default null,
  p_annual_price numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_contract_id uuid := p_contract_id;
  v_contract_customer uuid;
  v_service_id uuid;
  v_service_code text;
  v_service_name text;
  v_base_price numeric;
  v_rows int := 0;
  r record;
  v_unit_price numeric;
  v_existing_id uuid;
  v_existing_price numeric;
  v_annual numeric;
  v_next_start date;
  v_missing jsonb := '[]'::jsonb;
  v_type_name text;
begin
  if not intranet_is_internal() and auth.role() <> 'service_role' then
    raise exception 'Behörighet saknas';
  end if;

  select id, code, name, base_price
  into v_service_id, v_service_code, v_service_name, v_base_price
  from services
  where used_for_addon_stations_annual = true and is_active = true
  limit 1;
  if v_service_id is null then
    return jsonb_build_object('ok', false, 'reason', 'service_missing');
  end if;

  if v_contract_id is null then
    if p_customer_id is null then
      raise exception 'Ange enhet eller avtal';
    end if;
    select coalesce(
      (select ep.addon_contract_id from equipment_placements ep
        where ep.customer_id = p_customer_id and ep.is_addon and ep.status = 'active' and ep.addon_contract_id is not null
        order by ep.placed_at desc limit 1),
      (select s.addon_contract_id from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
        where fp.customer_id = p_customer_id and s.is_addon and s.status = 'active' and s.addon_contract_id is not null
        order by s.placed_at desc limit 1)
    ) into v_contract_id;
    if v_contract_id is null then
      select c.id into v_contract_id
      from contracts c
      where c.type = 'contract'
        and c.status in ('signed', 'active')
        and c.terminated_at is null
        and (
          c.customer_id = p_customer_id
          or exists (
            select 1 from contract_sites cs
            where cs.contract_id = c.id and cs.customer_id = p_customer_id
              and (cs.active_to is null or cs.active_to >= v_today)
              and (cs.active_from is null or cs.active_from <= v_today)
          )
          or (c.covers_all_sites = true and c.customer_id = (select parent_customer_id from customers where id = p_customer_id))
        )
      order by (c.customer_id = p_customer_id) desc, c.display_order nulls last, c.created_at
      limit 1;
    end if;
    if v_contract_id is null then
      return jsonb_build_object('ok', false, 'reason', 'no_contract');
    end if;
  end if;

  select customer_id into v_contract_customer from contracts where id = v_contract_id;
  v_next_start := contract_next_period_start(v_contract_id, v_today);

  for r in
    with units as (
      select p_customer_id as customer_id where p_customer_id is not null
      union
      select c.customer_id from contracts c where c.id = v_contract_id and p_customer_id is null
      union
      select cs.customer_id from contract_sites cs
        where cs.contract_id = v_contract_id and p_customer_id is null
          and (cs.active_to is null or cs.active_to >= v_today)
      union
      select u.id from customers u
        join contracts c on c.id = v_contract_id and c.covers_all_sites = true and u.parent_customer_id = c.customer_id
        where p_customer_id is null
    ),
    stations as (
      select ep.customer_id, ep.station_type_id, ep.addon_billing_model as model
      from equipment_placements ep
      join units u on u.customer_id = ep.customer_id
      where ep.is_addon = true and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
        and (ep.addon_contract_id is null or ep.addon_contract_id = v_contract_id)
      union all
      select fp.customer_id, s.station_type_id, s.addon_billing_model
      from indoor_stations s
      join floor_plans fp on fp.id = s.floor_plan_id
      join units u on u.customer_id = fp.customer_id
      where s.is_addon = true and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate'
        and (s.addon_contract_id is null or s.addon_contract_id = v_contract_id)
    ),
    counted as (
      select customer_id, station_type_id, model, count(*) as n
      from stations group by customer_id, station_type_id, model
    ),
    existing as (
      select site_customer_id as customer_id, station_type_id, billing_model as model, 0::bigint as n
      from case_billing_items
      where case_id = v_contract_id and site_customer_id is not null
        and billing_model in ('per_year', 'per_month') and status <> 'cancelled'
        and (p_customer_id is null or site_customer_id = p_customer_id)
    )
    select customer_id, station_type_id, model, max(n) as n
    from (select * from counted union all select * from existing) x
    group by customer_id, station_type_id, model
  loop
    select id, unit_price into v_existing_id, v_existing_price
    from case_billing_items
    where case_id = v_contract_id and site_customer_id = r.customer_id
      and station_type_id is not distinct from r.station_type_id
      and billing_model = r.model and status <> 'cancelled'
    limit 1;

    -- Priset per stationstyp: explicit override, annars typens egen
    -- prislistetrappa, annars den generella årstjänstens.
    v_annual := coalesce(
      p_annual_price,
      addon_annual_price_for_type(r.station_type_id, r.customer_id, v_contract_id),
      v_base_price
    );

    if v_existing_id is not null then
      -- Befintlig rad: priset fryses, bara antalet följer verkligheten.
      v_unit_price := coalesce(p_annual_price, v_existing_price);
      if p_annual_price is not null and r.model = 'per_month' then
        v_unit_price := round(p_annual_price / 12, 2);
      end if;
      update case_billing_items
      set quantity = r.n,
          unit_price = v_unit_price,
          discounted_price = v_unit_price,
          total_price = round(v_unit_price * r.n, 2),
          updated_at = now()
      where id = v_existing_id;
      v_rows := v_rows + 1;
    elsif r.n > 0 then
      -- Ny rad utan pris skapas ALDRIG som 0 kr: den skulle filtreras
      -- bort tyst av planeraren och stationen aldrig faktureras.
      if v_annual is null or v_annual <= 0 then
        select name into v_type_name from station_types where id = r.station_type_id;
        v_missing := v_missing || jsonb_build_object(
          'station_type_id', r.station_type_id,
          'station_type', coalesce(v_type_name, 'Okänd stationstyp'),
          'site_customer_id', r.customer_id,
          'model', r.model,
          'quantity', r.n
        );
        continue;
      end if;

      v_unit_price := case
        when r.model = 'per_month' then round(v_annual / 12, 2)
        else v_annual
      end;

      insert into case_billing_items (
        case_id, case_type, customer_id, site_customer_id, station_type_id, item_type,
        service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, status, requires_approval, billing_model, billing_start_date, notes
      ) values (
        v_contract_id, 'contract', v_contract_customer, r.customer_id, r.station_type_id, 'service',
        coalesce(addon_service_id_for_type(r.station_type_id), v_service_id),
        coalesce((select s2.code from services s2 where s2.id = addon_service_id_for_type(r.station_type_id)), v_service_code),
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        r.n, v_unit_price, 0, v_unit_price, round(v_unit_price * r.n, 2),
        25, 'standard', 'pending', false, r.model,
        case when r.model = 'per_month' then (date_trunc('month', v_today) + interval '1 month')::date else v_next_start end,
        'Synkas från utplacerade tilläggsstationer'
      );
      v_rows := v_rows + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_missing) = 0,
    'contract_id', v_contract_id,
    'rows', v_rows,
    'next_period_start', v_next_start,
    'price_missing', v_missing
  );
end;
$$;

revoke all on function sync_addon_period_lines(uuid, uuid, numeric) from public;
grant execute on function sync_addon_period_lines(uuid, uuid, numeric) to authenticated;
grant execute on function sync_addon_period_lines(uuid, uuid, numeric) to service_role;

comment on function sync_addon_period_lines(uuid, uuid, numeric) is
  'Synkar § 6-rader mot utplacerade tilläggsstationer. Priset per stationstyp via addon_annual_price_for_type. Rader utan pris skapas aldrig som 0 kr utan returneras i price_missing.';
