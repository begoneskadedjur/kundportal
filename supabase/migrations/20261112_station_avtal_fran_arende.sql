-- Stationen hör till avtalet som etableringsärendet är bokat för (2026-11-12)
--
-- Heimstaden Maria 5 (BE-0009740, 2026-11-09): kunden hade fyra aktiva avtal.
-- Etableringen var bokad för nya Trap-X-avtalet, men fällan fick kundens
-- första avtal (Aurocon) och tilläggsavtalet blev tomt. addon_contract_for_unit
-- föll då tillbaka på första avtalet, pro rata räknades mot Aurocons årsdag och
-- sync_addon_article_lines lade interna kostnadsrader på alla fyra avtalen.
--
-- Vid utsättning (INSERT) sätts nu:
--   - equipment_placements.contract_id = ärendets avtal (placed_case_id -> cases.contract_id)
--     när ärendet är bokat för ett levande avtal
--   - addon_contract_id = samma avtal för tilläggsstationer, annars stationens
--     contract_id, så att en tilläggsstation aldrig står utan avtal
--   - addon_unit_price_annual mot det avtalet när snapshot-triggern inte hann
--
-- Namnet börjar på trg_station_z så att triggern körs efter trg_station_placed_case
-- (BEFORE-triggers körs i namnordning), som kan sätta placed_case_id.
-- Fel här stoppar aldrig utsättningen.

create or replace function public.trg_station_avtal_fran_arende()
returns trigger
language plpgsql
as $$
declare
  v_contract uuid;
  v_unit uuid;
begin
  begin
    if new.placed_case_id is not null then
      select k.id into v_contract
      from cases c
      join contracts k on k.id = c.contract_id
      where c.id = new.placed_case_id
        and k.type = 'contract'
        and k.status in ('signed', 'active')
        and k.terminated_at is null;
    end if;

    if tg_table_name = 'equipment_placements' then
      if v_contract is not null then
        new.contract_id := v_contract;
      end if;
      v_contract := coalesce(v_contract, new.contract_id);
    end if;

    if coalesce(new.is_addon, false) and new.addon_contract_id is null and v_contract is not null then
      new.addon_contract_id := v_contract;
      if new.addon_unit_price_annual is null and new.station_type_id is not null then
        if tg_table_name = 'indoor_stations' then
          select fp.customer_id into v_unit from floor_plans fp where fp.id = new.floor_plan_id;
        else
          v_unit := new.customer_id;
        end if;
        if v_unit is not null then
          new.addon_unit_price_annual := public.addon_annual_price_for_type(new.station_type_id, v_unit, v_contract);
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'trg_station_avtal_fran_arende: avtalet kunde inte sättas: %', sqlerrm;
  end;
  return new;
end
$$;

create or replace trigger trg_station_z_avtal_fran_arende
  before insert on public.equipment_placements
  for each row execute function public.trg_station_avtal_fran_arende();

create or replace trigger trg_station_z_avtal_fran_arende
  before insert on public.indoor_stations
  for each row execute function public.trg_station_avtal_fran_arende();
