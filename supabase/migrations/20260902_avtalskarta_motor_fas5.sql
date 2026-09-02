-- Fas 5: fakturapaus per avtal (avtalskartan som motor).
-- Pausen låg bara på kundraden; med flera avtal per kund måste den ligga på avtalet.
-- Applicerad via MCP 2026-09-02 (avtalskarta_motor_fas5_billing_paused_until).
alter table public.contracts
  add column if not exists billing_paused_until date;

comment on column public.contracts.billing_paused_until is
  'Fakturering pausad till detta datum (billing_active=false). Cron reactivate-paused-billing sätter billing_active=true och nollar fältet när datumet passerat. Tomt = paus tills vidare.';

create index if not exists contracts_billing_paused_until_idx
  on public.contracts (billing_paused_until)
  where billing_paused_until is not null;

-- customers.total_contract_value är meningslös när kundraden speglar summan
-- av flera levande avtal (olika löptider). Triggern nollar då fältet i stället
-- för att räkna summan gånger huvudkontorets datum.
-- Applicerad via MCP 2026-09-02 (avtalskarta_motor_fas5_total_contract_value_multi).
CREATE OR REPLACE FUNCTION public.compute_total_contract_value()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  months_count integer;
  live_contracts integer;
BEGIN
  IF NEW.annual_value IS NULL OR NEW.annual_value <= 0
     OR NEW.contract_start_date IS NULL OR NEW.contract_end_date IS NULL THEN
    NEW.total_contract_value := NULL;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO live_contracts
    FROM public.contracts c
   WHERE c.customer_id = NEW.id
     AND c.type = 'contract'
     AND c.status IN ('signed', 'active')
     AND c.terminated_at IS NULL;

  IF live_contracts > 1 THEN
    NEW.total_contract_value := NULL;
    RETURN NEW;
  END IF;

  months_count := (EXTRACT(YEAR FROM age(NEW.contract_end_date, NEW.contract_start_date)) * 12
                 + EXTRACT(MONTH FROM age(NEW.contract_end_date, NEW.contract_start_date)))::integer;
  IF months_count <= 0 THEN
    NEW.total_contract_value := NULL;
  ELSE
    NEW.total_contract_value := ROUND(NEW.annual_value * (months_count::numeric / 12));
  END IF;
  RETURN NEW;
END;
$function$;
