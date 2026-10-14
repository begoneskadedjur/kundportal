-- 20261014_byt_stationstyp.sql
-- Byt typ på en befintlig station (3.49.0).
--
-- Tekniker ska kunna byta typ på en utplacerad station (t.ex. Mekanisk fälla
-- till Betesstation) utan att ta bort och placera en ny. Bytet görs bara via
-- RPC change_station_type som låser raden, kontrollerar tilläggsspärren,
-- serienummer, produkt och preparat, numrerar om inomhusstationen i nya
-- typens prefixserie, nollställer tilläggets frysta pris när stationen inte
-- är fakturerad än och loggar bytet i station_type_changes.
--
-- Kontrollraderna får en egen station_type_id så att gamla kontroller och
-- kontrollrapporter visar typen stationen hade då, inte dagens typ.
--
-- Idempotent: inga DROP, bara create ... if not exists / create or replace.

-- ============================================================================
-- 1. Logg över typbyten
-- ============================================================================

create table if not exists public.station_type_changes (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null,
  station_kind text not null check (station_kind in ('outdoor', 'indoor')),
  customer_id uuid references public.customers(id) on delete set null,
  old_type_id uuid references public.station_types(id) on delete set null,
  new_type_id uuid references public.station_types(id) on delete set null,
  old_station_number text,
  new_station_number text,
  old_article_id uuid references public.articles(id) on delete set null,
  new_article_id uuid references public.articles(id) on delete set null,
  session_id uuid references public.station_inspection_sessions(id) on delete set null,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

create index if not exists station_type_changes_station_idx
  on public.station_type_changes (station_id, changed_at desc);
create index if not exists station_type_changes_customer_idx
  on public.station_type_changes (customer_id, changed_at desc);

alter table public.station_type_changes enable row level security;

-- Läsning för personal, samma mönster som stationstabellernas policyer.
-- Inga skrivpolicyer: rader skapas bara av change_station_type (SECURITY DEFINER).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'station_type_changes'
      and policyname = 'Personal kan läsa typbyten'
  ) then
    create policy "Personal kan läsa typbyten" on public.station_type_changes
      for select using (
        exists (
          select 1 from public.profiles
          where profiles.user_id = auth.uid()
            and (profiles.role in ('admin', 'koordinator', 'technician')
                 or profiles.is_admin = true or profiles.is_koordinator = true)
        )
      );
  end if;
end $$;

-- ============================================================================
-- 2. Kontrollraderna minns typen stationen hade vid kontrollen
-- ============================================================================

alter table public.outdoor_station_inspections
  add column if not exists station_type_id uuid references public.station_types(id);
alter table public.indoor_station_inspections
  add column if not exists station_type_id uuid references public.station_types(id);

-- Backfill: inga typbyten har gjorts före denna migration, så stationens
-- nuvarande typ är också typen vid varje tidigare kontroll.
update public.outdoor_station_inspections i
  set station_type_id = ep.station_type_id
from public.equipment_placements ep
where ep.id = i.station_id and i.station_type_id is null and ep.station_type_id is not null;

update public.indoor_station_inspections i
  set station_type_id = s.station_type_id
from public.indoor_stations s
where s.id = i.station_id and i.station_type_id is null and s.station_type_id is not null;

-- Nya kontroller: ärv stationens typ när klienten inte anger någon.
create or replace function public.inspection_station_type_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.station_type_id is null then
    if tg_table_name = 'indoor_station_inspections' then
      select station_type_id into new.station_type_id from public.indoor_stations where id = new.station_id;
    else
      select station_type_id into new.station_type_id from public.equipment_placements where id = new.station_id;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_outdoor_inspection_station_type'
                 and tgrelid = 'public.outdoor_station_inspections'::regclass) then
    create trigger trg_outdoor_inspection_station_type
      before insert on public.outdoor_station_inspections
      for each row execute function public.inspection_station_type_fill();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_indoor_inspection_station_type'
                 and tgrelid = 'public.indoor_station_inspections'::regclass) then
    create trigger trg_indoor_inspection_station_type
      before insert on public.indoor_station_inspections
      for each row execute function public.inspection_station_type_fill();
  end if;
end $$;

-- ============================================================================
-- 3. Notisen "Tillägg att besluta" får bara röra sina egna rader
-- ============================================================================
-- addon_pending_refresh_notifications uppdaterade ALLA olästa kundnotiser för
-- huvudkontoret (case_type 'customer'), alltså även "Nytt avtal signerat" från
-- Oneflow-webhooken och den nya typbytesnotisen nedan. Samma kropp som
-- 20260908_tillagg_att_besluta.sql, men begränsad på titeln.

create or replace function public.addon_pending_refresh_notifications(p_root_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  p record;
  v_title text;
  v_preview text;
begin
  select * into s from public.addon_pending_summary() where root_customer_id = p_root_customer_id;

  if s.root_customer_id is null then
    -- Inget kvar att besluta: notiserna är klara
    update public.notifications
      set is_read = true, read_at = coalesce(read_at, now())
    where case_type = 'customer' and case_id = p_root_customer_id and not is_read
      and title like 'Tillägg att besluta%';
    return;
  end if;

  v_title := 'Tillägg att besluta · ' || s.company_name;
  v_preview := s.stations || ' tilläggsstation' || case when s.stations = 1 then '' else 'er' end
    || ' på ' || s.contracts || ' avtal väntar på beslut om fakturering, '
    || replace(to_char(round(s.annual_kr), 'FM999G999G999'), ',', ' ') || ' kr/år.';

  for p in select id from public.profiles where can_approve_invoices and is_active loop
    update public.notifications
      set title = v_title, preview = v_preview, created_at = now()
    where recipient_id = p.id and case_type = 'customer' and case_id = p_root_customer_id and not is_read
      and title like 'Tillägg att besluta%';
    if not found then
      insert into public.notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
      values (p.id, p_root_customer_id, 'customer', v_title, v_preview, s.company_name, p.id, 'Systemet', false);
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- 4. RPC change_station_type
-- ============================================================================
--
-- Felkoder (RAISE EXCEPTION '<KOD>: ...', översätts i StationTypeService):
--   FORBIDDEN, NOT_FOUND, SAME_TYPE, ADDON_PAID_LOCKED, SERIAL_REQUIRED,
--   ARTICLE_NOT_ALLOWED
--
-- Förskottsbetald (spärr): samma regel som useAddonPaidLock i klienten.
--   Tillägg per år/per månad som inte är inbakat i premien och där
--   addon_station_paid_through(...) ger ett paid_through-datum (en avslutad
--   pro rata-rad eller en bokförd/skickad/betald utrustningsfaktura täcker en
--   period som slutar i dag eller senare).
--
-- Inte fakturerad (pris nollställs): stationen finns inte på någon
--   utrustningsfakturarad (invoice_items.station_ids) utöver förslag
--   (pending_approval) och makulerade, och ingen pro rata-rad för enheten,
--   gamla typen och modellen är godkänd/fakturerad efter att stationen
--   markerades (samma matchning som addon_station_paid_through). Pro rata-
--   rader som fortfarande är 'pending' räknas som ofakturerade.
--
-- Triggerordning vid UPDATE (BEFORE-triggrar körs i namnordning):
--   station_contract_fields_align  (bara UPDATE OF contract_id/addon_contract_id, körs inte)
--   trg_*_addon_dates              (rör inte pris)
--   trg_*_addon_normalize          (rör inte pris)
--   trg_*_addon_snapshot           (UPDATE OF ... article_id, station_type_id: körs,
--                                   ser NEW.station_type_id = nya typen och
--                                   NEW.addon_unit_price_annual = NULL och fryser
--                                   nya typens pris; nollar addon_unit_cost själv
--                                   när article_id ändras och hämtar ny kostnad)
--   trg_*_product_icon             (UPDATE OF article_id: ny produktikon)
--   trg_*_station_type             (autofill, no-op eftersom vi sätter id:t)
--   *_updated_at
-- Därefter AFTER station_sync_addon_lines (UPDATE OF station_type_id,
-- addon_unit_price_annual) som synkar § 5-raderna: stationen flyttar från
-- gamla typens grupp (antal minskar) till nya typens grupp.
-- Eftersom station_type_id och addon_unit_price_annual = NULL skrivs i SAMMA
-- UPDATE ser snapshot-triggern båda, och nya priset sätts innan raden sparas.
-- addon_pending_notify (UPDATE OF is_addon, addon_contract_id, status) körs inte.

create or replace function public.change_station_type(
  p_station_id uuid,
  p_kind text,
  p_new_type_id uuid,
  p_article_id uuid default null,
  p_serial_number text default null,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_new_type record;
  v_old_type_name text;
  v_unit uuid;
  v_root uuid;
  v_unit_name text;
  v_floor_plan uuid;
  v_old_type uuid;
  v_old_text text;
  v_old_number text;
  v_new_number text;
  v_old_article uuid;
  v_new_article uuid;
  v_old_serial text;
  v_new_serial text;
  v_prep uuid;
  v_new_prep uuid;
  v_is_addon boolean;
  v_model text;
  v_mode text;
  v_marked timestamptz;
  v_paid jsonb;
  v_invoiced boolean := false;
  v_price_reset boolean := false;
  v_ordinal int;
  v_max int;
  p record;
begin
  -- Rollkontroll som stationstabellernas UPDATE-policyer
  select id into v_profile_id
  from public.profiles
  where user_id = auth.uid()
    and (role in ('admin', 'koordinator', 'technician') or is_admin = true or is_koordinator = true)
  limit 1;
  if v_profile_id is null then
    raise exception 'FORBIDDEN: Behörighet saknas';
  end if;

  if p_kind not in ('outdoor', 'indoor') then
    raise exception 'NOT_FOUND: Okänd stationsort %', p_kind;
  end if;

  select id, code, name, prefix, coalesce(requires_serial_number, false) as requires_serial
    into v_new_type
  from public.station_types
  where id = p_new_type_id and coalesce(is_active, true);
  if v_new_type.id is null then
    raise exception 'NOT_FOUND: Stationstypen finns inte';
  end if;

  -- Lås stationen och läs nuvarande värden
  if p_kind = 'indoor' then
    select s.station_type_id, s.station_type, s.station_number, s.article_id, null::text,
           s.preparation_id, s.is_addon, s.addon_billing_model, s.addon_contract_mode,
           coalesce(s.addon_marked_at, s.placed_at), s.floor_plan_id
      into v_old_type, v_old_text, v_old_number, v_old_article, v_old_serial,
           v_prep, v_is_addon, v_model, v_mode, v_marked, v_floor_plan
    from public.indoor_stations s
    where s.id = p_station_id
    for update;
    if not found then
      raise exception 'NOT_FOUND: Stationen finns inte';
    end if;
    select customer_id into v_unit from public.floor_plans where id = v_floor_plan;
  else
    select ep.station_type_id, ep.equipment_type, null::text, ep.article_id, ep.serial_number,
           ep.preparation_id, ep.is_addon, ep.addon_billing_model, ep.addon_contract_mode,
           coalesce(ep.addon_marked_at, ep.placed_at), ep.customer_id
      into v_old_type, v_old_text, v_old_number, v_old_article, v_old_serial,
           v_prep, v_is_addon, v_model, v_mode, v_marked, v_unit
    from public.equipment_placements ep
    where ep.id = p_station_id
    for update;
    if not found then
      raise exception 'NOT_FOUND: Stationen finns inte';
    end if;
  end if;

  -- Typen kan sakna FK på äldre rader: lös ut den via textkoden
  v_old_type := coalesce(v_old_type, public.station_type_id_for_text(v_old_text));

  if v_old_type = p_new_type_id then
    raise exception 'SAME_TYPE: Stationen har redan den typen';
  end if;

  -- Tilläggsspärren: betald framåt får inte byta typ (useAddonPaidLock)
  if coalesce(v_is_addon, false)
     and v_model in ('per_year', 'per_month')
     and coalesce(v_mode, 'separate') <> 'included' then
    v_paid := public.addon_station_paid_through(p_station_id, p_kind = 'indoor');
    if coalesce((v_paid ->> 'applies')::boolean, false) and (v_paid ->> 'paid_through') is not null then
      raise exception 'ADDON_PAID_LOCKED: Tilläggsstationen är betald till och med %', v_paid ->> 'paid_through';
    end if;
  end if;

  -- Serienummer (bara utomhus har kolumnen)
  v_new_serial := nullif(btrim(coalesce(p_serial_number, '')), '');
  if p_kind = 'outdoor' then
    v_new_serial := coalesce(v_new_serial, nullif(btrim(coalesce(v_old_serial, '')), ''));
    if v_new_type.requires_serial and v_new_serial is null then
      raise exception 'SERIAL_REQUIRED: Den nya typen kräver serienummer';
    end if;
  end if;

  -- Produkt: angiven måste höra till nya typen; annars behåll gammal om
  -- den är tillåten, annars ingen
  if p_article_id is not null then
    if not exists (select 1 from public.station_type_articles
                   where station_type_id = p_new_type_id and article_id = p_article_id) then
      raise exception 'ARTICLE_NOT_ALLOWED: Produkten hör inte till den nya typen';
    end if;
    v_new_article := p_article_id;
  elsif v_old_article is not null and exists (
    select 1 from public.station_type_articles
    where station_type_id = p_new_type_id and article_id = v_old_article
  ) then
    v_new_article := v_old_article;
  else
    v_new_article := null;
  end if;

  -- Preparat: behålls bara om nya typen finns i preparations.station_type_ids
  -- (text[] med station_types.id)
  if v_prep is not null and exists (
    select 1 from public.preparations
    where id = v_prep and p_new_type_id::text = any(coalesce(station_type_ids, '{}'::text[]))
  ) then
    v_new_prep := v_prep;
  else
    v_new_prep := null;
  end if;

  -- Inte fakturerad än? (se huvudkommentaren)
  if coalesce(v_is_addon, false) then
    select exists (
      select 1
      from public.invoice_items ii
      join public.invoices i on i.id = ii.invoice_id
      where p_station_id = any(coalesce(ii.station_ids, '{}'::uuid[]))
        and i.status not in ('pending_approval', 'cancelled')
    ) or exists (
      select 1
      from public.case_billing_items cbi
      join public.cases c on c.id = cbi.case_id
      where cbi.is_addon_prorata_line
        and not coalesce(cbi.is_addon_labour_line, false)
        and coalesce(cbi.site_customer_id, cbi.customer_id) = v_unit
        and (cbi.station_type_id is null or cbi.station_type_id is not distinct from v_old_type)
        and (cbi.addon_model is null or cbi.addon_model = v_model)
        and cbi.status not in ('pending', 'cancelled')
        and c.deleted_at is null
        and v_marked >= c.created_at - interval '1 day'
        and v_marked <= cbi.updated_at
    ) into v_invoiced;
    v_price_reset := not v_invoiced;
  end if;

  -- Inomhus: nytt nummer i nya typens prefixserie på planritningen
  -- (spegel av generateStationNumber i src/types/indoor.ts: högsta numret med
  -- prefixet bland ALLA stationer på planritningen + 1, tre siffror).
  -- Samma prefix som förut: numret behålls.
  if p_kind = 'indoor' then
    if v_old_number is not null
       and left(v_old_number, length(v_new_type.prefix) + 1) = v_new_type.prefix || '-' then
      v_new_number := v_old_number;
    else
      -- Serialisera numreringen per planritning
      perform pg_advisory_xact_lock(hashtext('indoor_station_number:' || v_floor_plan::text));
      select coalesce(max(substring(substr(s.station_number, length(v_new_type.prefix) + 2) from '^[0-9]+')::int), 0)
        into v_max
      from public.indoor_stations s
      where s.floor_plan_id = v_floor_plan
        and left(s.station_number, length(v_new_type.prefix) + 1) = v_new_type.prefix || '-'
        and substring(substr(s.station_number, length(v_new_type.prefix) + 2) from '^[0-9]+') is not null;
      v_new_number := v_new_type.prefix || '-' || lpad((v_max + 1)::text, 3, '0');
    end if;

    update public.indoor_stations
      set station_type_id = p_new_type_id,
          station_type = v_new_type.code,
          station_number = v_new_number,
          article_id = v_new_article,
          preparation_id = v_new_prep,
          preparation_quantity = case when v_new_prep is null then null else preparation_quantity end,
          preparation_unit = case when v_new_prep is null then null else preparation_unit end,
          addon_unit_price_annual = case when v_price_reset then null else addon_unit_price_annual end
    where id = p_station_id;
  else
    update public.equipment_placements
      set station_type_id = p_new_type_id,
          equipment_type = v_new_type.code,
          serial_number = v_new_serial,
          article_id = v_new_article,
          preparation_id = v_new_prep,
          preparation_quantity = case when v_new_prep is null then null else preparation_quantity end,
          preparation_unit = case when v_new_prep is null then null else preparation_unit end,
          addon_unit_price_annual = case when v_price_reset then null else addon_unit_price_annual end
    where id = p_station_id;
  end if;

  -- Kontroller i pågående session gäller nya typen (teknikern byter typ
  -- under besöket). Mätvärde och preparat hörde till gamla typen och nollas,
  -- så rapporten aldrig visar t.ex. gram på en mekanisk fälla. Äldre
  -- sessioner behåller typen de kontrollerades som.
  if p_session_id is not null then
    if p_kind = 'indoor' then
      update public.indoor_station_inspections
        set station_type_id = p_new_type_id, measurement_value = null, measurement_unit = null, preparation_id = null
      where station_id = p_station_id and session_id = p_session_id;
    else
      update public.outdoor_station_inspections
        set station_type_id = p_new_type_id, measurement_value = null, measurement_unit = null, preparation_id = null
      where station_id = p_station_id and session_id = p_session_id;
    end if;
  end if;

  insert into public.station_type_changes (
    station_id, station_kind, customer_id, old_type_id, new_type_id,
    old_station_number, new_station_number, old_article_id, new_article_id, session_id, changed_by
  ) values (
    p_station_id, p_kind, v_unit, v_old_type, p_new_type_id,
    v_old_number, v_new_number, v_old_article, v_new_article, p_session_id, auth.uid()
  );

  -- Tilläggsstation: meddela den som godkänner fakturor
  if coalesce(v_is_addon, false) and v_unit is not null then
    select coalesce(parent_customer_id, id), coalesce(site_name, company_name)
      into v_root, v_unit_name
    from public.customers where id = v_unit;
    select name into v_old_type_name from public.station_types where id = v_old_type;

    -- Stationens nummer som i vyerna (src/shared/stationNumbering.ts): aktiva
    -- stationer från 1, äldst först; utomhus per enhet, inomhus per planritning
    if p_kind = 'indoor' then
      select n into v_ordinal from (
        select s.id, row_number() over (order by s.placed_at nulls first, s.id::text) as n
        from public.indoor_stations s
        where s.floor_plan_id = v_floor_plan and coalesce(s.status, 'active') <> 'removed'
      ) x where x.id = p_station_id;
    else
      select n into v_ordinal from (
        select ep.id, row_number() over (order by ep.placed_at nulls first, ep.id::text) as n
        from public.equipment_placements ep
        where ep.customer_id = v_unit and ep.status <> 'removed'
      ) x where x.id = p_station_id;
    end if;

    if v_root is not null then
      for p in select id from public.profiles where can_approve_invoices and is_active loop
        insert into public.notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
        values (
          p.id, v_root, 'customer',
          'Tilläggsstation bytte typ',
          'Station ' || coalesce(v_new_number, v_ordinal::text, '?') || ' hos ' || coalesce(v_unit_name, 'kunden') || ': '
            || coalesce(v_old_type_name, v_old_text, 'okänd typ') || ' till ' || v_new_type.name,
          v_unit_name, p.id, 'Systemet', false
        );
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'station_id', p_station_id,
    'old_type_id', v_old_type,
    'new_type_id', p_new_type_id,
    'old_station_number', v_old_number,
    'new_station_number', v_new_number,
    'price_reset', v_price_reset
  );
end;
$$;

revoke all on function public.change_station_type(uuid, text, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.change_station_type(uuid, text, uuid, uuid, text, uuid) to authenticated;
