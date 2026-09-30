-- 20260930_tillagg_arbetstid_underlag.sql
-- Följer 20260930_tillagg_arbetstid_tidslinje.sql.
-- 1. Stationstriggern kör även artikelsynken, så intern kostnad (produkter
--    och arbetstid) följer med när en station plockas bort eller beslutas.
-- 2. addon_completion_summary: utrustningskostnad för de nya stationerna
--    (stationens låsta inköp, annars artikelns) och produkterna bakom.
-- 3. addon_unit_decision_info: underlag för kontorets beslut per enhet
--    (teknikerns senaste förslag, timmar i dag, timpris, intern timkostnad,
--    nästa periodstart och obeslutade stationers utrustningskostnad).

create or replace function public.trg_station_sync_addon_lines()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare v_unit uuid; v_contract uuid; v_old_contract uuid;
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
    begin perform public.sync_addon_article_lines(v_contract); exception when others then null; end;
  end if;
  if v_old_contract is not null and v_old_contract is distinct from v_contract then
    begin perform public.sync_addon_period_lines(v_unit, v_old_contract, null); exception when others then null; end;
    begin perform public.sync_addon_article_lines(v_old_contract); exception when others then null; end;
  end if;
  return null;
end; $$;

-- Enhetens aktiva tilläggsstationer (per år/per månad): ny eller innan
-- relativt ärendets skapande, beslutsläge och utrustningskostnad.
create or replace function public.addon_unit_station_rows(p_unit_id uuid, p_since timestamptz)
returns table(station_type_id uuid, model text, mode text, undecided boolean, is_new boolean, article_name text, unit_cost numeric)
language sql stable security definer
set search_path = public
as $$
  select ep.station_type_id, ep.addon_billing_model, ep.addon_contract_mode,
         ep.addon_contract_id is null,
         coalesce(ep.addon_marked_at, ep.placed_at) >= p_since,
         a.name, coalesce(ep.addon_unit_cost, a.default_price, 0)
  from equipment_placements ep left join articles a on a.id = ep.article_id
  where ep.customer_id = p_unit_id and ep.is_addon and ep.status = 'active'
    and ep.addon_billing_model in ('per_year', 'per_month')
  union all
  select s.station_type_id, s.addon_billing_model, s.addon_contract_mode,
         s.addon_contract_id is null,
         coalesce(s.addon_marked_at, s.placed_at) >= p_since,
         a.name, coalesce(s.addon_unit_cost, a.default_price, 0)
  from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
  left join articles a on a.id = s.article_id
  where fp.customer_id = p_unit_id and s.is_addon and s.status = 'active'
    and s.addon_billing_model in ('per_year', 'per_month');
$$;
revoke all on function public.addon_unit_station_rows(uuid, timestamptz) from public, anon;

create or replace function public.addon_completion_summary(p_case_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_unit uuid;
  v_created timestamptz;
  v_case_number text;
  v_contract uuid;
  v_next date;
  v_types jsonb;
  v_articles jsonb;
  v_cost numeric;
  v_proposal record;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  select customer_id, created_at, case_number into v_unit, v_created, v_case_number
  from cases where id = p_case_id and deleted_at is null;
  if v_unit is null then
    return jsonb_build_object('ok', false, 'reason', 'no_case');
  end if;
  v_contract := addon_contract_for_unit(v_unit);
  if v_contract is not null then
    v_next := contract_next_period_start(v_contract, v_today);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'station_type_id', a.station_type_id,
    'station_type_name', coalesce(t.name, 'Station'),
    'model', a.model,
    'before', a.before_count,
    'before_pending', a.before_pending,
    'new', a.new_count,
    'included', a.included_count,
    'new_cost', a.new_cost,
    'annual_price', addon_annual_price_for_type(a.station_type_id, v_unit, v_contract)
  ) order by t.name), '[]'::jsonb)
  into v_types
  from (
    select station_type_id, model,
      count(*) filter (where not is_new and coalesce(mode, 'separate') <> 'included') as before_count,
      count(*) filter (where not is_new and undecided) as before_pending,
      count(*) filter (where is_new and coalesce(mode, 'separate') <> 'included') as new_count,
      count(*) filter (where coalesce(mode, 'separate') = 'included') as included_count,
      coalesce(sum(unit_cost) filter (where is_new and coalesce(mode, 'separate') <> 'included'), 0) as new_cost
    from addon_unit_station_rows(v_unit, v_created) group by station_type_id, model
  ) a left join station_types t on t.id = a.station_type_id;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', n, 'cost', cost) order by name), '[]'::jsonb),
         coalesce(sum(cost), 0)
  into v_articles, v_cost
  from (
    select coalesce(article_name, 'Produkt') as name, count(*) as n, sum(unit_cost) as cost
    from addon_unit_station_rows(v_unit, v_created) where is_new and coalesce(mode, 'separate') <> 'included'
    group by coalesce(article_name, 'Produkt')
  ) x;

  select addon_labour_hours, addon_labour_hours_before, status, total_price into v_proposal
  from case_billing_items
  where case_id = p_case_id and is_addon_prorata_line and is_addon_labour_line and status <> 'cancelled'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'case_number', v_case_number,
    'case_created_at', v_created,
    'unit_id', v_unit,
    'unit_name', (select coalesce(site_name, company_name) from customers where id = v_unit),
    'contract_id', v_contract,
    'contract_name', (select coalesce(nullif(trim(display_name), ''), label, contract_type) from contracts where id = v_contract),
    'contract_end_date', (select contract_end_date from contracts where id = v_contract),
    'today', v_today,
    'next_period_start', v_next,
    'hourly_price', case when v_contract is not null then addon_labour_hourly_price(v_unit, v_contract) end,
    'hourly_cost', addon_labour_hourly_cost(),
    'labour_hours_before', case when v_contract is not null then addon_unit_labour_hours(v_contract, v_unit) else 0 end,
    'proposal_hours', v_proposal.addon_labour_hours,
    'proposal_hours_before', v_proposal.addon_labour_hours_before,
    'proposal_status', v_proposal.status,
    'proposal_total', v_proposal.total_price,
    'new_equipment_cost', v_cost,
    'new_articles', v_articles,
    'types', v_types
  );
end;
$$;


create or replace function public.addon_unit_decision_info(p_unit_id uuid, p_contract_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_prop record;
  v_pending_cost numeric;
  v_pending_articles jsonb;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  select cbi.case_id, c.case_number, cbi.addon_labour_hours, cbi.addon_labour_hours_before, cbi.status, cbi.created_at
  into v_prop
  from case_billing_items cbi join cases c on c.id = cbi.case_id
  where cbi.customer_id = p_unit_id and cbi.is_addon_prorata_line and cbi.is_addon_labour_line
    and cbi.status <> 'cancelled' and c.deleted_at is null
  order by cbi.created_at desc
  limit 1;

  select coalesce(sum(cost), 0), coalesce(jsonb_agg(jsonb_build_object('station_type_id', station_type_id, 'name', name, 'quantity', n, 'cost', cost)), '[]'::jsonb)
  into v_pending_cost, v_pending_articles
  from (
    select station_type_id, coalesce(name, 'Produkt') as name, count(*) as n, sum(cost) as cost from (
      select ep.station_type_id, a.name, coalesce(ep.addon_unit_cost, a.default_price, 0) as cost
      from equipment_placements ep left join articles a on a.id = ep.article_id
      where ep.customer_id = p_unit_id and ep.is_addon and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month') and ep.addon_contract_id is null
      union all
      select s.station_type_id, a.name, coalesce(s.addon_unit_cost, a.default_price, 0)
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      left join articles a on a.id = s.article_id
      where fp.customer_id = p_unit_id and s.is_addon and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month') and s.addon_contract_id is null
    ) y group by station_type_id, coalesce(name, 'Produkt')
  ) x;

  return jsonb_build_object(
    'unit_id', p_unit_id,
    'unit_name', (select coalesce(site_name, company_name) from customers where id = p_unit_id),
    'contract_id', p_contract_id,
    'today', v_today,
    'next_period_start', contract_next_period_start(p_contract_id, v_today),
    'contract_end_date', (select contract_end_date from contracts where id = p_contract_id),
    'hourly_price', addon_labour_hourly_price(p_unit_id, p_contract_id),
    'hourly_cost', addon_labour_hourly_cost(),
    'labour_hours_now', addon_unit_labour_hours(p_contract_id, p_unit_id),
    'proposal_case_id', v_prop.case_id,
    'proposal_case_number', v_prop.case_number,
    'proposal_hours', v_prop.addon_labour_hours,
    'proposal_hours_before', v_prop.addon_labour_hours_before,
    'proposal_status', v_prop.status,
    'pending_equipment_cost', v_pending_cost,
    'pending_articles', v_pending_articles
  );
end;
$$;

grant execute on function public.addon_unit_decision_info(uuid, uuid) to authenticated;
revoke execute on function public.addon_unit_decision_info(uuid, uuid) from anon;
