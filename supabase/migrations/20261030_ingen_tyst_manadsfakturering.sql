-- Steg 13 i docs/planer/avtalsar-exakt-arsdag-teknik.md: ingen tyst månadsfakturering.
--
-- 1. customers.billing_frequency får inget standardvärde (var 'monthly').
--    En ny kundrad utan intervall får NULL. Koden sätter intervallet uttryckligen:
--    årsvis när kunden har årspremie och ingen valt något annat (beslut 2026-10-30,
--    årsvis är standard om inget motsäger det), annars NULL (avrop eller per ärende).
--    Befintliga rader ändras inte (datasteg 20).
-- 2. contracts.billing_frequency_needs_check: avtal som skapas ur kundkortet och
--    ärver kundradens intervall (eller får årsvis som standard) markeras, så att
--    avtalskartans kompletthetsrad ber om kontroll. Alla befintliga avtal får false.
--
-- Ingen drop, ingen dataändring i befintliga rader. Backning:
-- 20261030_ingen_tyst_manadsfakturering_backning.sql

alter table public.customers alter column billing_frequency set default null;

alter table public.contracts
  add column if not exists billing_frequency_needs_check boolean not null default false;

comment on column public.contracts.billing_frequency_needs_check is
  'Steg 13 (2026-10-30): intervallet valdes inte för avtalet (ärvt från kundraden eller årsvis som standard när avtalet skapades ur kundkortet). Släcks när § 6 sparas.';
