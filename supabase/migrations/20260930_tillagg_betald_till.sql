-- ============================================================
-- Tilläggsstation: betald till och med.
--
-- Används av varningen när någon tar bort (Borttagen eller raderar) en
-- tilläggsstation per år eller per månad. Svarar på hur långt fram
-- stationen redan är fakturerad, så att teknikern kan se att kunden inte
-- får tillbaka något och att stationen inte faktureras från nästa period.
--
-- Källor, per station:
--  a) pro rata-raden på etablerings- eller kontrollärendet
--     (case_billing_items.is_addon_prorata_line, samma enhet och stationstyp,
--     stationen markerad under ärendet). Fakturerad rad (inte pending eller
--     cancelled) täcker fram till billing_start_date minus en dag. Äldre rader
--     utan billing_start_date räknas fram med avtalets nästa periodstart
--     från ärendets avslutsdag.
--  b) tilläggsfakturor (contract_invoice_kind equipment/equipment_monthly)
--     med status booked, sent, overdue eller paid, där stationen finns i
--     fakturaradens station_ids (eller, när listan saknas, raden gäller samma
--     enhet och stationstyp). Täcker till billing_period_end.
-- Senaste täckta slutdatum som är idag eller senare vinner.
--
-- Stationer inbakade i premien (addon_contract_mode = included) och per
-- kontroll ger applies = false: borttag ändrar inget som redan är betalt.
-- Ingen kreditering görs någonsin.
-- ============================================================

create or replace function public.addon_station_paid_through(p_station_id uuid, p_indoor boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_unit uuid;
  v_type uuid;
  v_is_addon boolean;
  v_model text;
  v_mode text;
  v_contract uuid;
  v_marked timestamptz;
  v_best date;
  v_source text;
  v_ref text;
  v_pending boolean := false;
  r record;
  v_end date;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  if coalesce(p_indoor, false) then
    select fp.customer_id, s.station_type_id, s.is_addon, s.addon_billing_model, s.addon_contract_mode,
           s.addon_contract_id, coalesce(s.addon_marked_at, s.placed_at)
      into v_unit, v_type, v_is_addon, v_model, v_mode, v_contract, v_marked
    from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
    where s.id = p_station_id;
  else
    select ep.customer_id, ep.station_type_id, ep.is_addon, ep.addon_billing_model, ep.addon_contract_mode,
           ep.addon_contract_id, coalesce(ep.addon_marked_at, ep.placed_at)
      into v_unit, v_type, v_is_addon, v_model, v_mode, v_contract, v_marked
    from equipment_placements ep
    where ep.id = p_station_id;
  end if;

  if v_unit is null or not coalesce(v_is_addon, false)
     or v_model not in ('per_year', 'per_month')
     or coalesce(v_mode, 'separate') = 'included' then
    return jsonb_build_object('applies', false, 'model', v_model);
  end if;

  v_contract := coalesce(v_contract, addon_contract_for_unit(v_unit));

  -- a) Pro rata-rader på ärendet där stationen sattes ut eller markerades
  for r in
    select cbi.status, cbi.billing_start_date, cbi.updated_at, c.case_number,
           c.completed_date, c.status as case_status
    from case_billing_items cbi
    join cases c on c.id = cbi.case_id
    where cbi.is_addon_prorata_line
      and not coalesce(cbi.is_addon_labour_line, false)
      and coalesce(cbi.site_customer_id, cbi.customer_id) = v_unit
      and (cbi.station_type_id is null or cbi.station_type_id is not distinct from v_type)
      and (cbi.addon_model is null or cbi.addon_model = v_model)
      and cbi.status <> 'cancelled'
      and c.deleted_at is null
      and v_marked >= c.created_at - interval '1 day'
      and (cbi.status = 'pending' or v_marked <= cbi.updated_at)
  loop
    if r.status = 'pending' then
      if r.case_status not ilike '%avslutat%' then
        v_pending := true;
      end if;
      continue;
    end if;
    v_end := r.billing_start_date;
    if v_end is null then
      if v_model = 'per_month' then
        v_end := (date_trunc('month', coalesce(r.completed_date::date, r.updated_at::date)) + interval '1 month')::date;
      elsif v_contract is not null then
        v_end := contract_next_period_start(v_contract, coalesce(r.completed_date::date, (r.updated_at at time zone 'Europe/Stockholm')::date));
      end if;
    end if;
    if v_end is null then
      continue;
    end if;
    v_end := v_end - 1;
    if v_end >= v_today and (v_best is null or v_end > v_best) then
      v_best := v_end;
      v_source := 'prorata';
      v_ref := r.case_number;
    end if;
  end loop;

  -- b) Skickade, bokförda eller betalda tilläggsfakturor
  for r in
    select i.billing_period_end, coalesce(i.invoice_number, i.fortnox_document_number) as ref
    from invoices i
    join invoice_items ii on ii.invoice_id = i.id
    left join case_billing_items src on src.id = ii.case_billing_item_id
    where i.contract_invoice_kind in ('equipment', 'equipment_monthly')
      and i.status in ('booked', 'sent', 'overdue', 'paid')
      and i.billing_period_end is not null
      and i.billing_period_end >= v_today
      and (
        p_station_id = any(coalesce(ii.station_ids, '{}'::uuid[]))
        or (ii.station_ids is null
            and src.site_customer_id = v_unit
            and (src.station_type_id is null or src.station_type_id is not distinct from v_type))
      )
  loop
    if v_best is null or r.billing_period_end > v_best then
      v_best := r.billing_period_end;
      v_source := 'invoice';
      v_ref := r.ref;
    end if;
  end loop;

  return jsonb_build_object(
    'applies', true,
    'model', v_model,
    'paid_through', v_best,
    'next_billing_from', case when v_best is null then null else v_best + 1 end,
    'source', v_source,
    'reference', v_ref,
    'not_billed_yet', (v_best is null and v_pending)
  );
end;
$function$;

revoke all on function public.addon_station_paid_through(uuid, boolean) from public, anon;
grant execute on function public.addon_station_paid_through(uuid, boolean) to authenticated;

comment on function public.addon_station_paid_through(uuid, boolean) is
  'Hur långt fram en tilläggsstation (per år/per månad, tillägg utöver avtalet) redan är fakturerad. Används av varningen vid borttag. Inga krediteringar.';
