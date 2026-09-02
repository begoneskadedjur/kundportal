-- Avtalskartan som motor, fas 1: avtalets referens på fakturan + händelsetyper.
--
-- invoice_reference: skrivs som "Er referens" på årspremiefakturor (LOU-kunder
-- kräver referenskod; FEV/WBAB: kod från beställaren). Per enhet finns redan
-- customers.billing_reference; detta är avtalets egen.
-- diary_number: diarie-/upphandlingsnummer (t.ex. GNU 2026/60) som skrivs i
-- radtext och ExternalInvoiceReference1.
--
-- contract_events.event_type utökas med 'indexation' (premietrappans
-- indexsteg) och 'renewal' (option/förlängning, fas 3).
-- Applicerad mot live-DB 2026-09-02 via MCP.

alter table contracts
  add column if not exists invoice_reference text,
  add column if not exists diary_number text;

comment on column contracts.invoice_reference is 'Er referens på avtalets fakturor (årspremie). Enhetens kod ligger i customers.billing_reference.';
comment on column contracts.diary_number is 'Diarie-/upphandlingsnummer, t.ex. GNU 2026/60. Skrivs i fakturans radtext.';

alter table contract_events drop constraint if exists contract_events_event_type_check;
alter table contract_events add constraint contract_events_event_type_check
  check (event_type in ('price_list', 'scope_mode', 'note', 'billing', 'indexation', 'renewal', 'other'));
