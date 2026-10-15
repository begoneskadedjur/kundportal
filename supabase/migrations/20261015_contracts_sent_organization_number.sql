-- Org- eller personnumret som wizarden skickade till Oneflow.
--
-- Kunden kan ändra fältet "Org nr" i Oneflow vid signering. Webhooken skriver
-- Oneflows värde till contracts.organization_number (även vid data_field:update
-- före signeringen), så det vi skickade gick förlorat. Pär-Eric Nilsson
-- (Oneflow 16463726) ändrade 19551205-7158 till ogiltiga 19551205-758.
--
-- create-contract skriver kolumnen, webhooken rör den aldrig. Vid signering
-- jämförs Oneflows nummer med den här: klarar kundens nummer inte
-- kontrollsiffran behålls vårt (api/_lib/contractSigning.ts).
alter table public.contracts
  add column if not exists sent_organization_number text;

comment on column public.contracts.sent_organization_number is
  'Org- eller personnumret wizarden skickade till Oneflow (create-contract). Skrivs aldrig av webhooken. Jämförs mot kundens värde vid signering.';
