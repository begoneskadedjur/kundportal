-- Tilläggsstationer som resultat över tid
--
-- Kostnaden tas en gång, intäkten löper så länge stationen är ute. Plockas
-- den bort låses resultatet på borttagningsdatumet. För att historiken inte
-- ska räknas om när prislistan indexeras sparas årspris och inköp PER
-- STATION när beslutet tas (addon_unit_price_annual, addon_unit_cost).
-- Ledgern läses från stationerna (även borttagna), aldrig från § 6-raderna
-- som bara speglar det som står ute just nu.

alter table public.equipment_placements add column if not exists addon_unit_price_annual numeric;
alter table public.equipment_placements add column if not exists addon_unit_cost numeric;
alter table public.indoor_stations add column if not exists addon_unit_price_annual numeric;
alter table public.indoor_stations add column if not exists addon_unit_cost numeric;
comment on column public.equipment_placements.addon_unit_price_annual is 'Årspris per station vid beslutet, låst. Ledgern räknar intäkt härifrån.';
comment on column public.equipment_placements.addon_unit_cost is 'Inköpspris för produkten vid utsättning, låst. Engångskostnad i ledgern.';

-- Snapshot: inköp från artikeln när stationen blir tillägg, årspris ur
-- prislistan när stationen kopplas till ett avtal (klienten kan skriva över
-- med det pris som bekräftades i popovern).
create or replace function public.addon_station_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit uuid;
begin
  if not coalesce(new.is_addon, false) then return new; end if;
  if new.addon_unit_cost is null and new.article_id is not null then
    select default_price into new.addon_unit_cost from public.articles where id = new.article_id;
  end if;
  if new.addon_unit_price_annual is null and new.addon_contract_id is not null and new.station_type_id is not null then
    if tg_table_name = 'indoor_stations' then
      select fp.customer_id into v_unit from public.floor_plans fp where fp.id = new.floor_plan_id;
    else
      v_unit := new.customer_id;
    end if;
    if v_unit is not null then
      new.addon_unit_price_annual := public.addon_annual_price_for_type(new.station_type_id, v_unit, new.addon_contract_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_placements_addon_snapshot on public.equipment_placements;
create trigger trg_equipment_placements_addon_snapshot
  before insert or update of is_addon, addon_contract_id, article_id, station_type_id on public.equipment_placements
  for each row execute function public.addon_station_snapshot();

drop trigger if exists trg_indoor_stations_addon_snapshot on public.indoor_stations;
create trigger trg_indoor_stations_addon_snapshot
  before insert or update of is_addon, addon_contract_id, article_id, station_type_id on public.indoor_stations
  for each row execute function public.addon_station_snapshot();

-- Backfill: redan beslutade stationer får dagens pris och artikelns inköp
update public.equipment_placements e
  set addon_unit_cost = coalesce(e.addon_unit_cost, a.default_price),
      addon_unit_price_annual = coalesce(e.addon_unit_price_annual,
        case when e.addon_contract_id is not null and e.station_type_id is not null
          then public.addon_annual_price_for_type(e.station_type_id, e.customer_id, e.addon_contract_id) end)
from public.articles a
where a.id = e.article_id and e.is_addon;

update public.indoor_stations i
  set addon_unit_cost = coalesce(i.addon_unit_cost, a.default_price),
      addon_unit_price_annual = coalesce(i.addon_unit_price_annual,
        case when i.addon_contract_id is not null and i.station_type_id is not null
          then public.addon_annual_price_for_type(i.station_type_id, fp.customer_id, i.addon_contract_id) end)
from public.floor_plans fp, public.articles a
where fp.id = i.floor_plan_id and a.id = i.article_id and i.is_addon;

-- Ledgern: alla tilläggsstationer som beslutats som tillägg utöver avtalet,
-- inklusive borttagna. Inbakade (included) hör till premien och är inte med.
create or replace function public.contract_addon_ledger(p_contract_id uuid)
returns table (
  station_id uuid,
  kind text,
  unit_id uuid,
  unit_name text,
  station_type_id uuid,
  station_type_name text,
  article_name text,
  start_at timestamptz,
  removed_at timestamptz,
  unit_price_annual numeric,
  unit_cost numeric,
  billing_model text
)
language sql
stable
as $$
  select e.id, 'outdoor'::text, e.customer_id, coalesce(c.site_name, c.company_name), e.station_type_id, st.name, a.name,
    coalesce(e.addon_marked_at, e.placed_at, e.created_at),
    case when e.status = 'removed' then coalesce(e.status_updated_at, e.updated_at) end,
    e.addon_unit_price_annual, coalesce(e.addon_unit_cost, a.default_price, 0), e.addon_billing_model
  from public.equipment_placements e
  join public.customers c on c.id = e.customer_id
  left join public.station_types st on st.id = e.station_type_id
  left join public.articles a on a.id = e.article_id
  where e.is_addon and e.addon_contract_id = p_contract_id and coalesce(e.addon_contract_mode, 'separate') = 'separate'
  union all
  select i.id, 'indoor'::text, fp.customer_id, coalesce(c.site_name, c.company_name), i.station_type_id, st.name, a.name,
    coalesce(i.addon_marked_at, i.placed_at, i.created_at),
    case when i.status = 'removed' then coalesce(i.status_updated_at, i.updated_at) end,
    i.addon_unit_price_annual, coalesce(i.addon_unit_cost, a.default_price, 0), i.addon_billing_model
  from public.indoor_stations i
  join public.floor_plans fp on fp.id = i.floor_plan_id
  join public.customers c on c.id = fp.customer_id
  left join public.station_types st on st.id = i.station_type_id
  left join public.articles a on a.id = i.article_id
  where i.is_addon and i.addon_contract_id = p_contract_id and coalesce(i.addon_contract_mode, 'separate') = 'separate'
$$;

grant execute on function public.contract_addon_ledger(uuid) to authenticated;
