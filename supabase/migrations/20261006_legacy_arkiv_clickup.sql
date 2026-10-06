-- Arkiv för data från övergångsperioden (ClickUp-import + Oneflow-import före 2026-05-01).
-- Raderna ligger kvar orörda (status, fakturering, provision, kundportal), men
-- tekniker-, koordinator- och statistikvyer filtrerar bort legacy_archived_at IS NOT NULL.

alter table public.private_cases  add column if not exists legacy_archived_at timestamptz;
alter table public.business_cases add column if not exists legacy_archived_at timestamptz;
alter table public.contracts      add column if not exists legacy_archived_at timestamptz;

comment on column public.private_cases.legacy_archived_at  is 'Satt = importerat från ClickUp, hanterat där. Döljs i arbets- och statistikvyer.';
comment on column public.business_cases.legacy_archived_at is 'Satt = importerat från ClickUp, hanterat där. Döljs i arbets- och statistikvyer.';
comment on column public.contracts.legacy_archived_at      is 'Satt = offert/avtal från före 2026-05-01 som inte längre ska följas upp. Aktiva avtal arkiveras aldrig.';

-- Triggers av: notiser till tekniker, signed→active, kundrad-refresh m.fl. får inte
-- köras på en ren arkivmarkering.
set local session_replication_role = replica;

-- Alla ärenden som kom från ClickUp (öppna som avslutade)
update public.private_cases  set legacy_archived_at = now() where clickup_task_id is not null and legacy_archived_at is null;
update public.business_cases set legacy_archived_at = now() where clickup_task_id is not null and legacy_archived_at is null;

-- Dokument i signeringsflödet från före gränsdatumet. active/ended/trashed/draft rörs inte.
update public.contracts set legacy_archived_at = now()
where created_at < '2026-05-01T00:00:00+02:00'
  and status in ('pending', 'overdue', 'signed', 'declined')
  and legacy_archived_at is null;
set local session_replication_role = origin;
