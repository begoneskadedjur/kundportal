-- Tilläggsstationens inköpspris fryses om när produkten byts.
-- Tidigare sattes addon_unit_cost bara när den var tom, så ett byte från
-- t.ex. Aurotrap Nature till Collect behöll Natures pris i avslutssteget,
-- beslutsvyn och liggaren medan avtalets kostnadsrad räknade på Collect.
-- Årspriset (addon_unit_price_annual) rörs inte: det följer stationstypen,
-- som är låst i formulären medan stationen är betald.

CREATE OR REPLACE FUNCTION public.addon_station_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_unit uuid;
begin
  if not coalesce(new.is_addon, false) then return new; end if;
  if tg_op = 'UPDATE' and new.article_id is distinct from old.article_id then
    new.addon_unit_cost := null;
  end if;
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
end; $function$;
