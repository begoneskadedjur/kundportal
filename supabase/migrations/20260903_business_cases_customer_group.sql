-- Kundnummer från Fortnox, fas 2: kundgrupp väljs redan när koordinatorn
-- skapar ett engångsärende för företag (docs/kundnummer-fortnox-plan.md).
-- Nullable, ingen backfill: äldre ärenden utan grupp får välja grupp vid avslut
-- (EditCaseModals befintliga väljare) eller vid Till Fortnox.

ALTER TABLE business_cases
  ADD COLUMN IF NOT EXISTS customer_group_id uuid REFERENCES customer_groups(id);

COMMENT ON COLUMN business_cases.customer_group_id IS
  'Kundgrupp vald av koordinator vid skapande. Styr vilket Fortnox-nummerintervall kunden får vid Till Fortnox.';
