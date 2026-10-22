-- Fakturavägen: hur kunden får sina fakturor (e-post, brev eller e-faktura).
-- Beslut 2026-10-22 (Christian, fallet Nacka vatten och avfall): den som gör
-- avtalet kan inte veta hur kunden vill betala. Kunden skriver det i Oneflow,
-- ekonomi bekräftar vägen vid första fakturan. Ingen faktura godkänns eller
-- skickas till Fortnox utan bekräftad väg (src/shared/invoiceDelivery.ts).
--
-- Värdena motsvarar Fortnox-kortets DefaultDeliveryTypes.Invoice:
-- email = EMAIL, print = PRINT, einvoice = ELECTRONICINVOICE.

alter table public.customers
  add column if not exists invoice_delivery_method text,
  add column if not exists invoice_delivery_source text,
  add column if not exists invoice_delivery_confirmed_at timestamptz,
  add column if not exists invoice_delivery_confirmed_by_name text;

alter table public.customers
  add constraint customers_invoice_delivery_method_check
  check (invoice_delivery_method is null or invoice_delivery_method in ('email', 'print', 'einvoice'));

alter table public.customers
  add constraint customers_invoice_delivery_source_check
  check (invoice_delivery_source is null or invoice_delivery_source in ('kund', 'ekonomi', 'fortnox', 'upplaggning'));

comment on column public.customers.invoice_delivery_method is
  'Fakturavägen: email | print | einvoice (Fortnox DefaultDeliveryTypes.Invoice). Null = ej bekräftad, faktura kan inte godkännas.';
comment on column public.customers.invoice_delivery_source is
  'Vem som satte vägen: kund (Oneflow), ekonomi (portalen), fortnox (kortet), upplaggning (giltigt fakturamejl när kunden skapades).';

-- Ny kund med giltigt fakturamejl: vägen är e-post. Den som lägger upp kunden
-- har fått mejlet av kunden. Utan mejl lämnas vägen tom för ekonomi.
create or replace function public.customers_invoice_delivery_default()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.invoice_delivery_method is null
     and new.billing_email is not null
     and btrim(new.billing_email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    new.invoice_delivery_method := 'email';
    new.invoice_delivery_source := coalesce(new.invoice_delivery_source, 'upplaggning');
    new.invoice_delivery_confirmed_at := coalesce(new.invoice_delivery_confirmed_at, now());
  end if;
  return new;
end;
$$;

create trigger trg_customers_invoice_delivery_default
  before insert on public.customers
  for each row execute function public.customers_invoice_delivery_default();

-- Befintliga kunder utan Fortnox-kort och med giltigt fakturamejl: e-post,
-- som fakturorna går i dag. Kunder med kort får vägen från kortet
-- (20261022_fakturavag_fran_fortnox.sql). Enheter på huvudkontorets kort
-- lämnas tomma: huvudkontorets väg gäller.
update public.customers c
set invoice_delivery_method = 'email',
    invoice_delivery_source = 'upplaggning',
    invoice_delivery_confirmed_at = now(),
    invoice_delivery_confirmed_by_name = 'Fakturamejlet vid införandet 2026-10-22'
where c.invoice_delivery_method is null
  and c.customer_number is null
  and c.billing_email is not null
  and btrim(c.billing_email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';
