-- Backning av 20261030_nya_avtal_avtalsdag.sql (steg 15). Körs INTE som
-- migration: Christian kör raderna i SQL-editorn om steget ska backas (MCP
-- nekar drop). Koden (api/_lib/contractSigning.ts, ContractScopeService)
-- backas med git revert; utan funktionen faller signeringen tillbaka på att
-- inte sätta tilläggsreglerna (se readDefaultAddonRules).
--
-- Avtal som hunnit signeras behåller sina värden (rätt enligt besluten) eller
-- nollställs i ett datasteg.

drop trigger if exists contract_billing_mode_insert_guard on public.contracts;
drop function if exists public.trg_contract_billing_mode_insert_guard();
drop function if exists public.contract_default_addon_rules(uuid, uuid);
