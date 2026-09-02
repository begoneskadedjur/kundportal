-- Avtalskartan som motor, fas 3: besök per enhet, option och bevakning.
-- Se docs/avtalskarta-motor-plan.md avsnitt 4 (M1 option, M7 contract_sites).
-- Applicerad mot live-DB 2026-09-02 via MCP.

-- § 3 per enhet: driftläge och besöksfrekvens per enhet i avtalet.
--   inspection = enheten ska ha återkommande stationskontroller (schema förväntas)
--   on_demand  = enheten arbetar ärendestyrt (avrop), schemalöshet är korrekt
-- Frekvensen per enhet är valfri; saknas den gäller avtalets (contracts.visit_frequency).
alter table contract_sites
  add column if not exists service_mode text not null default 'inspection',
  add column if not exists visit_frequency text,
  add column if not exists visits_per_year smallint;
alter table contract_sites drop constraint if exists contract_sites_service_mode_check;
alter table contract_sites add constraint contract_sites_service_mode_check
  check (service_mode in ('inspection', 'on_demand'));
alter table contract_sites drop constraint if exists contract_sites_visit_frequency_check;
alter table contract_sites add constraint contract_sites_visit_frequency_check
  check (visit_frequency is null or visit_frequency in ('monthly', 'quarterly', 'semi_annual', 'annual', 'custom'));
alter table contract_sites drop constraint if exists contract_sites_visits_per_year_check;
alter table contract_sites add constraint contract_sites_visits_per_year_check
  check (visits_per_year is null or (visits_per_year between 1 and 52));

-- § 9 Löptid och option. Beslut 2026-09-02: inget avtal stoppas automatiskt,
-- fälten styr BEVAKNINGEN (påminnelse till kundansvarig), inte livscykeln.
--   rolling = löper vidare tills uppsägning (dagens beteende)
--   fixed   = fast slutdatum, påminnelse 90 dagar före slutdatumet
--   option  = fast period med option på förlängning, påminnelse 90 dagar
--             före option_decision_deadline; "Nyttja option" flyttar slutdatumet
alter table contracts
  add column if not exists renewal_mode text not null default 'rolling',
  add column if not exists option_until date,
  add column if not exists option_decision_deadline date,
  add column if not exists renewal_reminder_days smallint not null default 90;
alter table contracts drop constraint if exists contracts_renewal_mode_check;
alter table contracts add constraint contracts_renewal_mode_check
  check (renewal_mode in ('rolling', 'fixed', 'option'));
comment on column contracts.option_until is 'Längsta slutdatum om alla optioner nyttjas';
comment on column contracts.option_decision_deadline is 'Sista dag att besluta om nästa option (kundansvarig påminns renewal_reminder_days före)';
