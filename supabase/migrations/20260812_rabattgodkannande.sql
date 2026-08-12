-- Rabattgodkännande-flödet:
-- 1. Utsedda personer (profiles.can_approve_discounts) ansvarar för att
--    godkänna fakturor med rabatterade rader innan de skickas.
-- 2. Tekniker måste motivera varje rabatt vid ärendeavslut - motiveringen
--    lagras per fakturarad och visas för godkännaren.
-- OBS: avtalstilläggsrader (contract_addition_annual) räknas INTE som rabatt -
-- deras låga pris är pro rata för återstående tid, inte ett sänkt pris.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_approve_discounts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.can_approve_discounts IS
  'Rabattansvarig: får godkänna/avslå fakturor med rabatterade rader (tilldelas på anvandarkonton-personal)';

ALTER TABLE case_billing_items ADD COLUMN IF NOT EXISTS discount_motivation text;

COMMENT ON COLUMN case_billing_items.discount_motivation IS
  'Teknikerns motivering till rabatten - krävs vid ärendeavslut när discount_percent > 0';
