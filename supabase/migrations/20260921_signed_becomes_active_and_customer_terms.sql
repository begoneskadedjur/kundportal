-- Två regler som tidigare sköttes för hand:
--
-- 1. Ett signerat avtal blir aktivt av sig självt när avtalstiden börjat.
--    Oneflow skickar "lifecycle_state:start" bara för avtal med startdatum
--    inställt i Oneflow, så de flesta stannade som "signed" för alltid.
--    Signed och active räknas båda som levande i portalen, det här är alltså
--    en statusstädning som gör att avtalskortet visar rätt läge.
--
-- 2. Kundraden speglar kundens riktiga avtal, inte avropsavtalet.
--    Ett avropsavtal ger bara rabatterade priser och har varken fakturamånad
--    eller slutdatum. Har kunden ett annat levande avtal är det dess frekvens,
--    fakturamånad, start och slut som ska stå på kundraden (kundlistan,
--    uppsägningsbevakningen, faktureringsinställningarna läser därifrån).
--    Bara ifyllda värden kopieras, ett avtal med tomt fält nollar aldrig kunden.

-- 1a. Engångs-/nattlig körning
create or replace function public.activate_started_contracts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.contracts
  set status = 'active', status_updated_at = now(), updated_at = now()
  where type = 'contract'
    and status = 'signed'
    and terminated_at is null
    and coalesce(start_date, contract_start_date) <= current_date;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function public.activate_started_contracts() is
  'Signerade avtal vars avtalstid börjat sätts till active. Körs nattligt av expire-contracts och direkt av triggern på contracts.';
grant execute on function public.activate_started_contracts() to service_role;

-- 1b. Direkt vid skrivning: signeras ett avtal som redan börjat blir det aktivt på en gång
create or replace function public.trg_contract_signed_becomes_active()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'contract'
     and new.status = 'signed'
     and new.terminated_at is null
     and coalesce(new.start_date, new.contract_start_date) <= current_date then
    new.status := 'active';
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists contract_signed_becomes_active on public.contracts;
create trigger contract_signed_becomes_active
  before insert or update of status, start_date, contract_start_date, terminated_at on public.contracts
  for each row execute function public.trg_contract_signed_becomes_active();

-- 2a. Kundradens avtalsuppgifter ur det primära avtalet
create or replace function public.refresh_customer_contract_terms(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if p_customer_id is null then return; end if;

  -- Primärt avtal: levande, riktigt avtal (inte avrop), det med senast slutdatum först
  select c.billing_frequency, c.billing_anchor_month, c.contract_start_date, c.contract_end_date
  into p
  from public.contracts c
  where c.customer_id = p_customer_id
    and c.type = 'contract'
    and public.contract_is_live(c)
    and coalesce(c.billing_frequency, '') <> 'on_demand'
    and coalesce(c.contract_type, '') not ilike '%avrop%'
  order by c.contract_end_date desc nulls last, c.created_at desc
  limit 1;

  if not found then return; end if;

  update public.customers k
  set billing_frequency   = coalesce(p.billing_frequency, k.billing_frequency),
      billing_anchor_month = coalesce(p.billing_anchor_month, k.billing_anchor_month),
      contract_start_date = coalesce(p.contract_start_date, k.contract_start_date),
      contract_end_date   = coalesce(p.contract_end_date, k.contract_end_date),
      updated_at = now()
  where k.id = p_customer_id
    and (k.billing_frequency    is distinct from coalesce(p.billing_frequency, k.billing_frequency)
      or k.billing_anchor_month is distinct from coalesce(p.billing_anchor_month, k.billing_anchor_month)
      or k.contract_start_date  is distinct from coalesce(p.contract_start_date, k.contract_start_date)
      or k.contract_end_date    is distinct from coalesce(p.contract_end_date, k.contract_end_date));
end;
$$;
comment on function public.refresh_customer_contract_terms(uuid) is
  'Skriver frekvens, fakturamånad, start och slut från kundens primära avtal (levande, ej avrop) till kundraden. Tomma avtalsfält lämnar kundens värde orört.';

-- 2b. Samma trigger som redan håller kundens årsvärde i fas
create or replace function public.trg_contracts_refresh_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_customer_annual_value(old.customer_id);
    perform public.refresh_customer_contract_terms(old.customer_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_customer_annual_value(new.customer_id);
    perform public.refresh_customer_contract_terms(new.customer_id);
  end if;
  return null;
end;
$$;
drop trigger if exists contracts_refresh_customer on public.contracts;
create trigger contracts_refresh_customer
  after insert or delete or update of annual_value, status, terminated_at, effective_end_date,
    contract_start_date, contract_end_date, billing_frequency, billing_anchor_month, contract_type,
    customer_id, template_id on public.contracts
  for each row execute function public.trg_contracts_refresh_customer();

-- 2c. Alla kunder en gång
create or replace function public.refresh_all_customer_contract_terms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n integer := 0;
  v_before timestamptz := clock_timestamp();
begin
  for r in select distinct customer_id from public.contracts where type = 'contract' loop
    perform public.refresh_customer_contract_terms(r.customer_id);
  end loop;
  select count(*) into v_n from public.customers where updated_at >= v_before;
  return v_n;
end;
$$;
grant execute on function public.refresh_all_customer_contract_terms() to service_role;
