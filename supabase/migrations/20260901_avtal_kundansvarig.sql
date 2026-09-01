-- Kundansvarig per AVTAL (applicerad 2026-09-01 via MCP, namn: avtal_kundansvarig).
-- Kunden kan ha två avtal med olika kundansvariga för olika enheter — därför
-- bor värdet på avtalet och speglas till kundraderna avtalet omfattar
-- (ContractScopeService.setAccountManager), aldrig till hela familjen.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS account_manager_name text,
  ADD COLUMN IF NOT EXISTS account_manager_email text;

COMMENT ON COLUMN public.contracts.account_manager_name IS 'Kundansvarig för avtalet — sätts på avtalskartan, speglas till kundrader som avtalet omfattar';
COMMENT ON COLUMN public.contracts.account_manager_email IS 'Kundansvarigs e-post (från personalregistret) — visas för kunden i kundportalen via customers-speglingen';
