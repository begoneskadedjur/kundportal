-- Utförandeadressen som skickades som leveransadress till Fortnox (3.99.0).
-- Sätts när utkastet skapas i Fortnox, null när adressen var samma som
-- fakturaadressen eller ärendet saknade adress.
alter table public.invoices add column if not exists delivery_address text;

comment on column public.invoices.delivery_address is
  'Utförandeadressen (ärendets adress) som skickades som leveransadress på Fortnox-fakturan. Null = ingen leveransadress skickades.';
