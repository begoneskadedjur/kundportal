-- Steg 0 (2026-11-03): tilläggsstationer per månad i tilläggsregler v2.
--
-- En station med addon_billing_model 'per_month' på ett v2-avtal faktureras
-- månadsvis (egna månadsfakturor, kind equipment_monthly), oavsett premiens
-- takt. Är premien månadsvis ligger tilläggen som förut på premiefakturan,
-- och då är premiens nästa period också nästa månad. Stationer per år följer
-- premiens perioder (eller årsdagen utan premie) som förut.
--
-- contract_addon_next_period_start får en tredje parameter med stationens
-- modell. Den gamla tvåparametersvarianten finns kvar och ger samma svar som
-- förut (modell okänd = premiens takt). addon_prorata_v2_end läser stationens
-- modell, så pro rata vid utsättning och glappen räknar till nästa
-- MÅNADSstart för stationer per månad.
--
-- TS-spegeln är addonCadenceFor i src/shared/addonPlanV2.ts.

create or replace function public.contract_addon_next_period_start(p_contract_id uuid, p_from date, p_billing_model text)
returns date
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  c record;
  v date;
begin
  select id, contract_start_date, billing_frequency, billing_anchor_mode into c from contracts where id = p_contract_id;
  if not found or p_from is null then
    return null;
  end if;
  -- Station per månad: nästa månadsstart, utom när premien är månadsvis (då
  -- på premiefakturan, och premiens nästa period är redan nästa månad)
  if p_billing_model = 'per_month'
     and not (addon_contract_has_premium(p_contract_id) and coalesce(c.billing_frequency, '') = 'monthly') then
    if c.billing_anchor_mode = 'start_day' and c.contract_start_date is not null then
      if p_from < c.contract_start_date then
        return c.contract_start_date;
      end if;
      select p.period_end + 1 into v from contract_period_on_pure(c.contract_start_date, 'monthly', p_from) p;
      return v;
    end if;
    return (date_trunc('month', p_from) + interval '1 month')::date;
  end if;
  -- Övriga: premiens perioder, annars avtalets årsdag (oförändrat sedan steg 11)
  if addon_contract_has_premium(p_contract_id)
     and coalesce(c.billing_frequency, '') in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    return contract_next_period_start(p_contract_id, p_from);
  end if;
  if c.contract_start_date is null then
    return null;
  end if;
  if p_from < c.contract_start_date then
    return c.contract_start_date;
  end if;
  select p.period_end + 1 into v from contract_period_on_pure(c.contract_start_date, 'annual', p_from) p;
  return v;
end $function$;

revoke all on function public.contract_addon_next_period_start(uuid, date, text) from public, anon, authenticated;
grant execute on function public.contract_addon_next_period_start(uuid, date, text) to service_role;

-- Tvåparametersvarianten: modell okänd, samma svar som förut
create or replace function public.contract_addon_next_period_start(p_contract_id uuid, p_from date)
returns date
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.contract_addon_next_period_start(p_contract_id, p_from, null::text);
$function$;

create or replace function public.addon_prorata_v2_end(p_contract_id uuid, p_station_id uuid, p_start date)
returns table(end_day date, ordinary date, capped boolean, unknown_invoice text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  c record;
  inv record;
  v_end date;
  v_last date;
  v_guard int := 0;
  v_key text;
  v_model text;
begin
  select * into c from contracts where id = p_contract_id;
  if not found or p_start is null then
    return;
  end if;
  -- Stationens modell (steg 0): per månad räknar till nästa månadsstart
  select coalesce(
    (select ep.addon_billing_model from equipment_placements ep where ep.id = p_station_id),
    (select s.addon_billing_model from indoor_stations s where s.id = p_station_id)
  ) into v_model;
  -- Steg 11: tilläggens takt (premiens perioder, eller årsdagen utan premie)
  ordinary := contract_addon_next_period_start(p_contract_id, p_start, v_model);
  v_key := addon_marking_key_for_unit((select l.unit_customer_id from addon_station_lookup(p_station_id, null) l limit 1), p_contract_id);
  if ordinary is null then
    return;
  end if;
  v_end := ordinary;
  capped := false;
  unknown_invoice := null;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 60;
    select i.id, coalesce(i.invoice_number, i.id::text) as nr,
           coalesce(i.billing_period_end, i.billing_period_start) as pe,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id and p_station_id = any(ii.station_ids)) as has_station,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                   and (ii.line_kind in ('equipment_annual', 'equipment_monthly') or i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap'))
                   and coalesce(cardinality(ii.station_ids), 0) > 0) as has_ids
      into inv
    from invoices i
    where i.contract_id = p_contract_id
      and i.invoice_type = 'contract'
      and i.status in ('booked', 'sent', 'overdue', 'paid')
      and i.billing_period_start <= v_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= v_end
      -- Steg 11: bara fakturor för stationens märkning (NULL = en faktura för hela avtalet)
      and (i.marking_key is null or i.marking_key = v_key)
      and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
           or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
               and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                           and ii.line_kind in ('equipment_annual', 'equipment_monthly'))))
    order by i.billing_period_start desc, i.created_at desc
    limit 1;
    exit when not found;
    exit when inv.has_station;
    if not inv.has_ids then
      unknown_invoice := inv.nr;
      exit;
    end if;
    exit when inv.pe + 1 <= v_end;
    v_end := inv.pe + 1;
  end loop;

  if c.terminated_at is not null or c.renewal_mode = 'option' or c.status in ('ended', 'trashed', 'declined') then
    v_last := coalesce(c.effective_end_date, c.contract_end_date);
    if v_last is not null and v_last + 1 < v_end then
      v_end := v_last + 1;
      capped := true;
    end if;
  end if;
  end_day := v_end;
  return next;
end $function$;
