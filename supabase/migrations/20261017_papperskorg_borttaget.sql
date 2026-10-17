-- Papperskorgen i Mina ärenden (2026-10-17).
-- CloseCaseModal satte bara deleted_at/close_reason och lämnade status orörd, så ärendena
-- syntes kvar i koordinatorschemat. Papperskorgen går nu via caseDeleteService.deleteCase
-- (status 'Borttaget', samma som Radera i ärendemodalen). Den här migrationen sätter
-- status 'Borttaget' på de rader som redan ligger i papperskorgen. deleteCase sätter inget
-- annat än status (deleted_at, close_reason och deleted_by_* finns redan på raderna).
--
-- Berör 61 rader vid granskning 2026-10-17: 31 private_cases, 26 business_cases, 4 cases.
-- Ingen av raderna har fakturor, provisionsposter eller stationskontrollsessioner.
-- OBS: business_cases 263518fb-1602-4a85-abeb-2f6a53bf3ba4 (BE-6037) har status Avslutat.
-- Granskningsfråga:
--   select 'private_cases' tabell, id, case_number, status, deleted_at, close_reason
--   from private_cases where deleted_at is not null and status is distinct from 'Borttaget'
--   union all
--   select 'business_cases', id, case_number, status, deleted_at, close_reason
--   from business_cases where deleted_at is not null and status is distinct from 'Borttaget'
--   union all
--   select 'cases', id, case_number, status, deleted_at, close_reason
--   from cases where deleted_at is not null and status is distinct from 'Borttaget'
--   order by 1, 5;
--
-- På cases köar triggern cases_technician_notifications en avbokningsnotis till teknikern
-- när status blir Borttaget. De fyra avtalsärendena togs bort av teknikern själv för länge
-- sedan, så triggern stängs av under uppdateringen. private_cases/business_cases-triggern
-- gör ingenting när status är Borttaget.
-- Idempotent: rader som redan har status Borttaget rörs inte.

begin;

update public.private_cases
set status = 'Borttaget'
where deleted_at is not null and status is distinct from 'Borttaget';

update public.business_cases
set status = 'Borttaget'
where deleted_at is not null and status is distinct from 'Borttaget';

alter table public.cases disable trigger cases_technician_notifications;

update public.cases
set status = 'Borttaget'
where deleted_at is not null and status is distinct from 'Borttaget';

alter table public.cases enable trigger cases_technician_notifications;

commit;
