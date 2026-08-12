-- Fakturamärkning på avtalsärenden (cases).
-- Fältet motsvarar business_cases.markning_faktura och mappas till
-- invoices.invoice_marking ("Er referens" i Fortnox) när merförsäljnings-
-- fakturan skapas per ärende. Redigerbart i efterhand i ärendemodalen.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS invoice_marking text;

COMMENT ON COLUMN cases.invoice_marking IS
  'Fakturamärkning ("Er referens") som förs över till merförsäljningsfakturan för ärendet';
