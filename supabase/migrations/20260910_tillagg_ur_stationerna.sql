-- § 5 Utrustning läses ur stationerna, aldrig synkas dit av klienten
--
-- 1. Svenska datum på stationen: addon_effective_from (beslut) och
--    addon_removed_on (borttagning), satta i Europe/Stockholm av trigger.
--    Ledgern och pro rata läser dem, inte UTC-tidsstämplar.
-- 2. Synken av § 5-raderna körs av databasen själv när en station ändras
--    (trigger), så stationer in och ut speglas omedelbart. Obeslutade
--    stationer (addon_contract_id null) tas aldrig med: de är brickor.
-- 3. Radens pris är summan av stationernas låsta årspris, inte ett live-
--    uppslag i prislistan.

alter table public.equipment_placements add column if not exists addon_effective_from date;
alter table public.equipment_placements add column if not exists addon_removed_on date;
alter table public.indoor_stations add column if not exists addon_effective_from date;
alter table public.indoor_stations add column if not exists addon_removed_on date;

create or replace function public.addon_station_dates()
returns trigger
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  if coalesce(new.is_addon, false) and new.addon_effective_from is null then
    new.addon_effective_from := coalesce((coalesce(new.addon_marked_at, new.placed_at, now()) at time zone 'Europe/Stockholm')::date, v_today);
  end if;
  if new.status = 'removed' and (tg_op = 'INSERT' or old.status is distinct from 'removed') and new.addon_removed_on is null then
    new.addon_removed_on := v_today;
  elsif new.status <> 'removed' and new.addon_removed_on is not null then
    new.addon_removed_on := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_equipment_placements_addon_dates on public.equipment_placements;
create trigger trg_equipment_placements_addon_dates
  before insert or update of is_addon, status, addon_marked_at on public.equipment_placements
  for each row execute function public.addon_station_dates();
drop trigger if exists trg_indoor_stations_addon_dates on public.indoor_stations;
create trigger trg_indoor_stations_addon_dates
  before insert or update of is_addon, status, addon_marked_at on public.indoor_stations
  for each row execute function public.addon_station_dates();

update public.equipment_placements set
  addon_effective_from = coalesce(addon_effective_from, (coalesce(addon_marked_at, placed_at, created_at) at time zone 'Europe/Stockholm')::date),
  addon_removed_on = case when status = 'removed' then coalesce(addon_removed_on, (coalesce(status_updated_at, updated_at) at time zone 'Europe/Stockholm')::date) else null end
where is_addon;
update public.indoor_stations set
  addon_effective_from = coalesce(addon_effective_from, (coalesce(addon_marked_at, placed_at, created_at) at time zone 'Europe/Stockholm')::date),
  addon_removed_on = case when status = 'removed' then coalesce(addon_removed_on, (coalesce(status_updated_at, updated_at) at time zone 'Europe/Stockholm')::date) else null end
where is_addon;

-- Ledgern läser de svenska datumen
create or replace function public.contract_addon_ledger(p_contract_id uuid)
returns table (
  station_id uuid, kind text, unit_id uuid, unit_name text, station_type_id uuid, station_type_name text, article_name text,
  start_at timestamptz, removed_at timestamptz, unit_price_annual numeric, unit_cost numeric, billing_model text
)
language sql
stable
as $$
  select e.id, 'outdoor'::text, e.customer_id, coalesce(c.site_name, c.company_name), e.station_type_id, st.name, a.name,
    coalesce(e.addon_effective_from::timestamptz, e.addon_marked_at, e.placed_at, e.created_at),
    case when e.status = 'removed' then coalesce(e.addon_removed_on::timestamptz, e.status_updated_at, e.updated_at) end,
    e.addon_unit_price_annual, coalesce(e.addon_unit_cost, a.default_price, 0), e.addon_billing_model
  from public.equipment_placements e
  join public.customers c on c.id = e.customer_id
  left join public.station_types st on st.id = e.station_type_id
  left join public.articles a on a.id = e.article_id
  where e.is_addon and e.addon_contract_id = p_contract_id and coalesce(e.addon_contract_mode, 'separate') = 'separate'
  union all
  select i.id, 'indoor'::text, fp.customer_id, coalesce(c.site_name, c.company_name), i.station_type_id, st.name, a.name,
    coalesce(i.addon_effective_from::timestamptz, i.addon_marked_at, i.placed_at, i.created_at),
    case when i.status = 'removed' then coalesce(i.addon_removed_on::timestamptz, i.status_updated_at, i.updated_at) end,
    i.addon_unit_price_annual, coalesce(i.addon_unit_cost, a.default_price, 0), i.addon_billing_model
  from public.indoor_stations i
  join public.floor_plans fp on fp.id = i.floor_plan_id
  join public.customers c on c.id = fp.customer_id
  left join public.station_types st on st.id = i.station_type_id
  left join public.articles a on a.id = i.article_id
  where i.is_addon and i.addon_contract_id = p_contract_id and coalesce(i.addon_contract_mode, 'separate') = 'separate'
$$;

-- § 5-raderna ur stationerna, grupperade per enhet, stationstyp och modell.
-- Det här är den enda sanningen om vad som står ute just nu.
create or replace function public.contract_addon_lines(p_contract_id uuid)
returns table (unit_id uuid, station_type_id uuid, billing_model text, quantity int, annual_total numeric, price_missing int)
language sql
stable
as $$
  select unit_id, station_type_id, billing_model, count(*)::int,
         coalesce(sum(unit_price_annual), 0), count(*) filter (where unit_price_annual is null)::int
  from public.contract_addon_ledger(p_contract_id)
  where removed_at is null and billing_model in ('per_year', 'per_month')
  group by unit_id, station_type_id, billing_model
$$;

-- Synken: kräver beslutad koppling till avtalet, priset ur stationerna,
-- får köras av databasens egen trigger (auth.uid() saknas).
-- Funktionskroppen: se pg_get_functiondef('sync_addon_period_lines') efter 2026-09-10.
-- Ändringar mot 2026-09-04: (a) `addon_contract_id = v_contract_id` i stället för
-- `is null or`, (b) v_annual och befintliga rader ur contract_addon_lines,
-- (c) behörighet: internal, service_role eller auth.uid() is null (trigger).

create or replace function public.trg_station_sync_addon_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit uuid;
  v_contract uuid;
  v_old_contract uuid;
begin
  if tg_table_name = 'indoor_stations' then
    select fp.customer_id into v_unit from public.floor_plans fp where fp.id = coalesce(new.floor_plan_id, old.floor_plan_id);
  else
    v_unit := coalesce(new.customer_id, old.customer_id);
  end if;
  v_contract := case when tg_op = 'DELETE' then null else new.addon_contract_id end;
  v_old_contract := case when tg_op = 'INSERT' then null else old.addon_contract_id end;
  if v_contract is not null then
    begin perform public.sync_addon_period_lines(v_unit, v_contract, null); exception when others then null; end;
  end if;
  if v_old_contract is not null and v_old_contract is distinct from v_contract then
    begin perform public.sync_addon_period_lines(v_unit, v_old_contract, null); exception when others then null; end;
  end if;
  return null;
end;
$$;
drop trigger if exists station_sync_addon_lines on public.equipment_placements;
create trigger station_sync_addon_lines
  after insert or update of is_addon, status, addon_contract_id, addon_contract_mode, addon_billing_model, station_type_id, addon_unit_price_annual or delete on public.equipment_placements
  for each row execute function public.trg_station_sync_addon_lines();
drop trigger if exists station_sync_addon_lines on public.indoor_stations;
create trigger station_sync_addon_lines
  after insert or update of is_addon, status, addon_contract_id, addon_contract_mode, addon_billing_model, station_type_id, addon_unit_price_annual or delete on public.indoor_stations
  for each row execute function public.trg_station_sync_addon_lines();

-- Fryst kopia på fakturaraden: vilka stationer raden avsåg
alter table public.invoice_items add column if not exists station_ids uuid[];
comment on column public.invoice_items.station_ids is 'Tilläggsstationer raden avsåg när fakturan skapades. Historiken ändras inte när stationer plockas bort.';
