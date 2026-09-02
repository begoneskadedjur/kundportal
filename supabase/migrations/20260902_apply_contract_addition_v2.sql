-- Avtalskartan som motor, fas 2 (M6): avtalstillägg skriver AVTALET.
--
-- Tidigare höjde apply_contract_addition customers.annual_value, som
-- fakturaplaneringen inte läser för kunder med riktiga avtal. Nu:
--   * p_contract_id satt: contracts.annual_value höjs, ett 'addition'-steg
--     skrivs i contract_premium_events, och en § 6-rad (per_year) läggs på
--     avtalsinnehållet så utrustningen följer med nästa årspremie.
--     Kundradens annual_value höjs också (den är summan av levande avtal).
--   * p_contract_id null (synth-kund utan avtalsrad): dagens beteende.
-- Applicerad mot live-DB 2026-09-02 via MCP.

drop function if exists apply_contract_addition(uuid, uuid, uuid, text, numeric, numeric, date, text);

create or replace function apply_contract_addition(
  p_case_billing_item_id uuid,
  p_customer_id uuid,
  p_case_id uuid,
  p_description text,
  p_annual_amount numeric,
  p_prorated_amount numeric,
  p_effective_from date,
  p_created_by_name text default null,
  p_contract_id uuid default null,
  p_service_id uuid default null,
  p_service_code text default null,
  p_service_name text default null,
  p_quantity numeric default 1,
  p_vat_rate numeric default 25
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_existing contract_additions%rowtype;
  v_prev numeric;
  v_new numeric;
  v_addition_id uuid;
  v_qty numeric := greatest(coalesce(p_quantity, 1), 1);
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  if p_annual_amount is null or p_annual_amount <= 0 then
    raise exception 'Årsbeloppet måste vara större än 0';
  end if;

  -- Idempotens: redan applicerad rad returnerar befintligt resultat
  select * into v_existing from contract_additions
  where case_billing_item_id = p_case_billing_item_id;
  if found then
    return jsonb_build_object(
      'already_applied', true,
      'previous_annual_value', v_existing.previous_annual_value,
      'new_annual_value', v_existing.new_annual_value,
      'effective_from', v_existing.effective_from
    );
  end if;

  if p_contract_id is not null then
    select coalesce(annual_value, 0) into v_prev
    from contracts where id = p_contract_id for update;
    if not found then
      raise exception 'Avtalet hittades inte';
    end if;
    v_new := v_prev + p_annual_amount;
    update contracts set annual_value = v_new, total_value = v_new where id = p_contract_id;
    -- Kundraden speglar summan av levande avtal
    update customers set annual_value = coalesce(annual_value, 0) + p_annual_amount where id = p_customer_id;
  else
    select coalesce(annual_value, 0) into v_prev
    from customers where id = p_customer_id for update;
    if not found then
      raise exception 'Kunden hittades inte';
    end if;
    v_new := v_prev + p_annual_amount;
    update customers set annual_value = v_new where id = p_customer_id;
  end if;

  insert into contract_additions (
    customer_id, contract_id, case_id, case_billing_item_id, description,
    annual_amount, prorated_amount, effective_from,
    previous_annual_value, new_annual_value,
    created_by, created_by_name
  ) values (
    p_customer_id, p_contract_id, p_case_id, p_case_billing_item_id, p_description,
    p_annual_amount, p_prorated_amount, p_effective_from,
    v_prev, v_new,
    auth.uid(), p_created_by_name
  )
  returning id into v_addition_id;

  if p_contract_id is not null then
    -- Premietrappan: tillägget som eget steg från nästa period
    insert into contract_premium_events (
      contract_id, effective_from, annual_value, event_type, note, source_addition_id, created_by
    ) values (
      p_contract_id, p_effective_from, v_new, 'addition', p_description, v_addition_id, p_created_by_name
    )
    on conflict (contract_id, effective_from, event_type) do update
      set annual_value = excluded.annual_value,
          note = coalesce(contract_premium_events.note, '') || ' · ' || excluded.note;

    -- § 6 Utrustning: raden på avtalsinnehållet som årsfakturan läser (per_year)
    if p_service_id is not null then
      insert into case_billing_items (
        case_id, case_type, customer_id, item_type, service_id, service_code, service_name,
        article_name, quantity, unit_price, total_price, vat_rate, discount_percent,
        price_source, status, billing_model, added_by_technician_name, notes
      ) values (
        p_contract_id, 'contract', p_customer_id, 'service', p_service_id, p_service_code, p_service_name,
        p_service_name, v_qty, round(p_annual_amount / v_qty, 2), p_annual_amount, coalesce(p_vat_rate, 25), 0,
        'standard', 'pending', 'per_year', p_created_by_name,
        'Avtalstillägg från ärende, gäller från ' || p_effective_from::text
      );
    end if;
  end if;

  return jsonb_build_object(
    'already_applied', false,
    'previous_annual_value', v_prev,
    'new_annual_value', v_new,
    'effective_from', p_effective_from,
    'contract_id', p_contract_id
  );
end;
$$;
