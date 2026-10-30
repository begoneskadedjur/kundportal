-- Backning för 20261030_prorata_v2_placed_case.sql och 20261030_prorata_v2_funktioner.sql (steg 9).
-- Dagens definitioner av sync_addon_prorata_line och trg_cbi_prorata_coverage
-- före migrationen, ordagrant ur pg_get_functiondef 2026-10-30.
-- Kör hela filen i SQL-editorn (create or replace skriver över växeln med dagens kod). De nya hjälpfunktionerna (sync_addon_prorata_line_legacy,
-- _v2, addon_prorata_v2_end, addon_station_uncovered_days, addon_prorata_uses_v2,
-- addon_case_is_open, trg_station_placed_case) kan stå kvar oanvända. Reservtriggern
-- tas bort av Christian i SQL-editorn om den ska bort:
--   drop trigger trg_station_placed_case on public.equipment_placements;
--   drop trigger trg_station_placed_case on public.indoor_stations;

create or replace function public.sync_addon_prorata_line(p_customer_id uuid, p_annual_price numeric DEFAULT NULL::numeric, p_technician_id uuid DEFAULT NULL::uuid, p_technician_name text DEFAULT NULL::text, p_case_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_case_id uuid;
  v_created timestamptz;
  v_contract_id uuid;
  v_service_id uuid;
  v_next_start date;
  v_next_month date := (date_trunc('month', (now() at time zone 'Europe/Stockholm')) + interval '1 month')::date;
  v_open_invoice uuid;
  v_missing jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_keep uuid[] := '{}';
  v_count int := 0;
  v_sum numeric := 0;
  v_row_id uuid;
  v_billed int;
  v_n int;
  v_unit numeric;
  v_total numeric;
  v_type_service uuid;
  v_name text;
  v_legacy uuid;
  r record;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  if p_case_id is not null then
    select id, created_at into v_case_id, v_created
    from cases
    where id = p_case_id and customer_id = p_customer_id
      and status not ilike '%avslutat%' and deleted_at is null;
  else
    select id, created_at into v_case_id, v_created
    from cases
    where customer_id = p_customer_id
      and service_type = 'establishment'
      and status not ilike '%avslutat%'
      and deleted_at is null
    order by created_at desc
    limit 1;
  end if;
  if v_case_id is null then
    return jsonb_build_object('found', false);
  end if;

  select id into v_service_id from services where used_for_addon_stations_annual = true and is_active = true limit 1;
  if v_service_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'service_missing', true);
  end if;

  select (sync_addon_period_lines(p_customer_id, null, p_annual_price) ->> 'contract_id')::uuid into v_contract_id;
  if v_contract_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'no_contract', true);
  end if;
  v_next_start := contract_next_period_start(v_contract_id, v_today);
  if v_next_start is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'no_period', true);
  end if;

  select id into v_open_invoice from invoices
  where contract_id = v_contract_id and invoice_type = 'contract'
    and coalesce(contract_invoice_kind, 'premium') = 'premium'
    and coalesce(is_consolidated, false) = false
    and billing_period_start <= v_today and billing_period_end >= v_today
    and status in ('draft', 'pending_approval', 'ready')
  limit 1;
  if v_open_invoice is not null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'covered_by_open_invoice', v_open_invoice);
  end if;

  select id into v_legacy from case_billing_items
  where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
    and status = 'pending' and station_type_id is null
  limit 1;

  for r in
    with st as (
      select ep.station_type_id, ep.addon_billing_model as model,
             greatest(coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365) as start_day
      from equipment_placements ep
      where ep.customer_id = p_customer_id and ep.is_addon = true and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
        and coalesce(ep.addon_marked_at, ep.placed_at) >= v_created
      union all
      select s.station_type_id, s.addon_billing_model,
             greatest(coalesce(s.addon_effective_from, (coalesce(s.addon_marked_at, s.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365)
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      where fp.customer_id = p_customer_id and s.is_addon = true and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate'
        and coalesce(s.addon_marked_at, s.placed_at) >= v_created
    )
    select station_type_id, model, count(*)::int as n,
           sum(greatest((case when model = 'per_month' then v_next_month else v_next_start end) - start_day, 0))::numeric as day_sum,
           case when model = 'per_month' then v_next_month else v_next_start end as end_day
    from st
    group by station_type_id, model
  loop
    v_unit := coalesce(p_annual_price, addon_annual_price_for_type(r.station_type_id, p_customer_id, v_contract_id));
    if v_unit is null or v_unit <= 0 then
      v_missing := v_missing || jsonb_build_object(
        'station_type_id', r.station_type_id,
        'station_type', coalesce((select name from station_types where id = r.station_type_id), 'Okänd stationstyp')
      );
      continue;
    end if;

    select coalesce(sum(quantity), 0)::int into v_billed from case_billing_items
    where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
      and station_type_id is not distinct from r.station_type_id
      and coalesce(addon_model, 'per_year') = r.model
      and status not in ('pending', 'cancelled');
    v_n := greatest(r.n - v_billed, 0);

    v_row_id := null;
    select id into v_row_id from case_billing_items
    where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
      and station_type_id is not distinct from r.station_type_id
      and coalesce(addon_model, 'per_year') = r.model
      and status = 'pending'
    limit 1;
    if v_row_id is null and v_legacy is not null then
      v_row_id := v_legacy;
      v_legacy := null;
    end if;

    if v_n = 0 then
      continue;
    end if;

    v_unit := round(v_unit * (r.day_sum / r.n) / 365.0, 2);
    v_total := round(v_unit * v_n, 2);
    v_type_service := coalesce(addon_service_id_for_type(r.station_type_id), v_service_id);
    v_name := coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)';

    if v_row_id is not null then
      update case_billing_items
      set quantity = v_n,
          unit_price = v_unit, discounted_price = v_unit, total_price = v_total,
          service_id = v_type_service,
          service_code = (select code from services where id = v_type_service),
          service_name = v_name, article_name = v_name,
          station_type_id = r.station_type_id,
          addon_model = r.model,
          addon_annual_unit_price = coalesce(p_annual_price, addon_annual_price_for_type(r.station_type_id, p_customer_id, v_contract_id)),
          billing_start_date = r.end_day,
          notes = 'Tilläggsstationer fram till avtalets nästa periodstart. Därefter på en egen faktura i samband med årsfakturan.',
          updated_at = now()
      where id = v_row_id;
    else
      insert into case_billing_items (
        case_id, case_type, customer_id, item_type,
        service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, added_by_technician_id, added_by_technician_name,
        status, requires_approval, notes, is_addon_prorata_line,
        station_type_id, addon_model, addon_annual_unit_price, billing_start_date
      ) values (
        v_case_id, 'contract', p_customer_id, 'service',
        v_type_service, (select code from services where id = v_type_service), v_name, v_name,
        v_n, v_unit, 0, v_unit, v_total,
        25, 'standard', p_technician_id, p_technician_name,
        'pending', false,
        'Tilläggsstationer fram till avtalets nästa periodstart. Därefter på en egen faktura i samband med årsfakturan.',
        true,
        r.station_type_id, r.model,
        coalesce(p_annual_price, addon_annual_price_for_type(r.station_type_id, p_customer_id, v_contract_id)),
        r.end_day
      )
      returning id into v_row_id;
    end if;
    v_keep := v_keep || v_row_id;
    v_count := v_count + v_n;
    v_sum := v_sum + v_total;
    v_rows := v_rows || jsonb_build_object('row_id', v_row_id, 'station_type_id', r.station_type_id, 'model', r.model, 'quantity', v_n, 'total', v_total);
  end loop;

  -- Äldre sammanslagen rad som inte togs över av någon ny typ lämnas orörd
  if v_legacy is not null then
    v_keep := v_keep || v_legacy;
  end if;

  update case_billing_items set mapped_service_id = null, updated_at = now()
  where mapped_service_id in (
    select id from case_billing_items
    where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
      and status = 'pending' and not (id = any(v_keep))
  );
  delete from case_billing_items
  where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
    and status = 'pending' and not (id = any(v_keep));

  perform addon_labour_prorata_recalc(v_case_id, v_contract_id);

  return jsonb_build_object('found', true, 'case_id', v_case_id, 'count', v_count,
    'row_id', (v_rows -> 0 ->> 'row_id'), 'rows', v_rows,
    'total', round(v_sum, 2), 'next_period_start', v_next_start, 'contract_id', v_contract_id,
    'price_missing', v_missing);
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_cbi_prorata_coverage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sid uuid;
  st record;
  v_invoice uuid;
  v_item uuid;
  v_to date;
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
      perform addon_coverage_write_or_conflict(v_sid, st.station_kind, st.unit_customer_id, st.contract_id,
                                               st.start_day, v_to, 'prorata',
                                               v_invoice, v_item, new.id);
    end loop;
  exception when others then
    raise warning 'trg_cbi_prorata_coverage: täckning för rad % kunde inte skrivas: %', new.id, sqlerrm;
  end;
  return new;
end $function$;
