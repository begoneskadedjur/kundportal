-- Kundpris på artikelrader (avtalade priser, t.ex. LOU-prisbilaga).
-- Prislistans kundpris (custom_price/tier) sparas som ögonblicksbild på ärenderaden.
-- unit_price förblir inköpspriset (articles.default_price, ev. per doseringsenhet).
-- Artiklar med kundpris ger härlett låst pris på den tjänst de mappas mot och en
-- specifikationstext på fakturaraden ("20 st Myrdosa à 18 kr"). Null = inget kundpris (dagens beteende).
-- Applicerad via MCP 2026-09-03 (kundpris_artiklar_case_billing_items).
alter table public.case_billing_items
  add column if not exists customer_unit_price numeric;

comment on column public.case_billing_items.customer_unit_price is
  'Kundens avtalade pris per enhet (exkl. moms) från prislistan vid tillägg; null = inget kundpris. unit_price är alltid inköpspris.';

alter table public.case_billing_items
  drop constraint if exists cbi_customer_unit_price_articles_only;
alter table public.case_billing_items
  add constraint cbi_customer_unit_price_articles_only
  check (customer_unit_price is null or item_type = 'article');
