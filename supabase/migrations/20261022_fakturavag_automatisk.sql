-- Fakturavägen sätts automatiskt (beslut 2026-10-22, Christian): ny kund
-- med giltigt fakturamejl får e-post dit, annars e-post till kontaktpersonen.
-- Signeringen sätter vägen själv ur avtalet (brev när avtalet har en adress),
-- se deriveDeliveryFromContract i src/shared/invoiceDelivery.ts.
create or replace function public.customers_invoice_delivery_default()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_re constant text := '^[^\s@]+@[^\s@]+\.[^\s@]+$';
begin
  if new.invoice_delivery_method is not null then
    return new;
  end if;
  if new.billing_email is not null and btrim(new.billing_email) ~ v_re then
    new.invoice_delivery_method := 'email';
    new.invoice_delivery_source := coalesce(new.invoice_delivery_source, 'upplaggning');
    new.invoice_delivery_confirmed_at := coalesce(new.invoice_delivery_confirmed_at, now());
    new.invoice_delivery_confirmed_by_name := coalesce(new.invoice_delivery_confirmed_by_name, 'Fakturamejl på kunden');
  elsif new.contact_email is not null and btrim(new.contact_email) ~ v_re then
    new.billing_email := btrim(new.contact_email);
    new.invoice_delivery_method := 'email';
    new.invoice_delivery_source := coalesce(new.invoice_delivery_source, 'upplaggning');
    new.invoice_delivery_confirmed_at := coalesce(new.invoice_delivery_confirmed_at, now());
    new.invoice_delivery_confirmed_by_name := coalesce(new.invoice_delivery_confirmed_by_name, 'Kontaktpersonens e-post (inget fakturamejl angivet)');
  end if;
  return new;
end;
$$;
