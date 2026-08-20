-- 20260820_avtal_besoksfrekvens.sql
-- Besöksfrekvens på avtalet: hur ofta kunden ska besökas enligt avtalet.
--
-- Bakgrund: customers.service_frequency finns men är fritext ("6 inspektioner
-- per år", "Kvartalsvis", "5 gånger per säsong") och går inte att koppla till
-- schemaläggningen. Den som lägger upp ett rondering-schema har därför ingen
-- uppgift om vad kunden faktiskt betalat för.
--
-- Här lagras frekvensen strukturerat på AVTALET, med samma värden som
-- recurring_schedules.frequency så schemaläggaren kan förvälja rätt intervall.
-- Avropsavtal har ingen frekvens (besök sker vid behov) → null.

alter table public.contracts
  add column if not exists visit_frequency text
    check (visit_frequency in ('monthly','quarterly','semi_annual','annual','custom')),
  -- Antal besök per år enligt avtalet. Bär det som frekvensvärdet inte fångar
  -- (t.ex. 6 ggr/år) och används som facit i uppföljningen.
  add column if not exists visits_per_year smallint
    check (visits_per_year is null or (visits_per_year > 0 and visits_per_year <= 52));

comment on column public.contracts.visit_frequency is
  'Besöksfrekvens enligt avtalet. Samma värden som recurring_schedules.frequency. Null = ingen fast frekvens (t.ex. avropsavtal).';
comment on column public.contracts.visits_per_year is
  'Antal ingående besök per år enligt avtalet. Facit för uppföljning och underlag vid schemaläggning.';
