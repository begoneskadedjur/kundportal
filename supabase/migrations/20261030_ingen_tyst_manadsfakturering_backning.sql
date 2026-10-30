-- Backning för 20261030_ingen_tyst_manadsfakturering.sql (steg 13).
-- Standardvärdet tillbaka. Kolumnen billing_frequency_needs_check kan stå kvar
-- oanvänd (false på alla gamla avtal); ska den bort kör Christian i SQL-editorn:
--   alter table public.contracts drop column billing_frequency_needs_check;
-- (gör det först efter git revert av koden, annars skriver kartan till en kolumn som saknas)

alter table public.customers alter column billing_frequency set default 'monthly';
