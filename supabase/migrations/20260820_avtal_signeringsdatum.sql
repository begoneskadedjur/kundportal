-- 20260820_avtal_signeringsdatum.sql
-- Riktigt signeringsdatum på avtalet.
--
-- Tidslinjen visade contracts.created_at som "Avtalet signerat", vilket för
-- avtal som lagts upp i efterhand blev dagen raden skapades i portalen — inte
-- när kunden faktiskt skrev under. Ett avtal signerat 2025-09-19 kunde alltså
-- stå som signerat 2026-08-20.
--
-- signed_at bär det verkliga datumet: från Oneflow vid signering, eller
-- manuellt ifyllt för historiska avtal.

alter table public.contracts
  add column if not exists signed_at date;

comment on column public.contracts.signed_at is
  'Datum då avtalet faktiskt signerades av kunden. Sätts från Oneflow vid signering, eller manuellt för avtal som lagts upp i efterhand. Skiljt från created_at som bara är när raden skapades i portalen.';

-- Backfyll: för Oneflow-avtal ÄR created_at signeringstillfället (raden skapas
-- av webhooken när avtalet signeras). Portalskapade ('local') och importerade
-- lämnas tomma — deras created_at säger inget om signeringen.
update public.contracts
   set signed_at = created_at::date
 where signed_at is null
   and status in ('signed', 'active')
   and template_id is not null
   and template_id not in ('local', 'imported')
   and oneflow_contract_id not like 'local-%'
   and oneflow_contract_id not like 'imported-%';
