-- Guiden Besluta och fakturera tilläggsstationer får faktureringsgrupperna
-- (2026-11-03, 3.117.0). Bara UPDATE av guidens innehåll, version 2 -> 3.
-- Ingen läskvittens krävs (requires_acknowledgement = false), det ändras inte.
--   Bra att veta, punkt 4: hur man ger tilläggen ett eget intervall.
--   Den interaktiva delen tillagg-regler (TillaggRegler.tsx) har fått valet Faktureringsgrupp.
-- Idempotent: körs bara när guiden har version 2.

update public.intranet_documents
set
  version = 3,
  source_updated_at = date '2026-11-03',
  content = jsonb_set(
    content::jsonb,
    '{4,items,3}',
    to_jsonb('Följer premien: tilläggen faktureras i premiens takt. Månadspremie på månadsfakturan, kvartal, halvår eller år på en egen tilläggsfaktura för samma period, ingen premie årsvis på avtalsdagen. En faktura per enhetens referenskod, med enhetens namn på varje rad. Ska tilläggen ha ett eget intervall, till exempel varje månad fast premien är årlig, skapar du en grupp under Innehåll och utrustning › Faktureringsgrupper och väljer den på tilläggsraden eller i Besluta tillägg.'::text)
  )
where slug = 'guide-tillaggsstationer-fakturering'
  and version = 2
  and content::jsonb -> 4 ->> 'type' = 'bra';
