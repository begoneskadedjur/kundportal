-- Avtalskartan som motor, fas 2: avtalet är källan till årspremiefakturan.
-- Se docs/avtalskarta-motor-plan.md avsnitt 4 (M2, M3, M4, M5).
-- Applicerad mot live-DB 2026-09-02 via MCP.

-- M2: faktureringsläge per kund (läses bara på huvudkontorsraden)
alter table customers
  add column if not exists contract_invoice_mode text not null default 'per_contract';
alter table customers drop constraint if exists customers_contract_invoice_mode_check;
alter table customers add constraint customers_contract_invoice_mode_check
  check (contract_invoice_mode in ('per_contract', 'consolidated'));
comment on column customers.contract_invoice_mode is 'Årspremie: en faktura per avtal (per_contract) eller en samlad faktura per period med en rad per avtal (consolidated). Gemet i avtalskartan.';

-- M3: samlad faktura + avtal per fakturarad
alter table invoices
  add column if not exists is_consolidated boolean not null default false,
  add column if not exists contract_invoice_kind text not null default 'premium';
alter table invoices drop constraint if exists invoices_contract_invoice_kind_check;
alter table invoices add constraint invoices_contract_invoice_kind_check
  check (contract_invoice_kind in ('premium', 'equipment', 'adjustment'));
-- En samlad faktura bär flera avtal och aldrig ett ärende: provision frigörs
-- via handle_invoice_paid bara med case_id, och det ska inte kunna ske här.
alter table invoices drop constraint if exists invoices_consolidated_no_case;
alter table invoices add constraint invoices_consolidated_no_case
  check (not is_consolidated or case_id is null);

alter table invoice_items
  add column if not exists contract_id uuid references contracts(id) on delete set null,
  add column if not exists line_kind text;
alter table invoice_items drop constraint if exists invoice_items_line_kind_check;
alter table invoice_items add constraint invoice_items_line_kind_check
  check (line_kind is null or line_kind in ('premium', 'equipment_annual', 'index_note', 'addon_round', 'service', 'article', 'generic'));
create index if not exists invoice_items_contract_idx on invoice_items(contract_id) where contract_id is not null;

-- Planeringsnycklar: en faktura per (avtal, period, slag) respektive
-- (kund, period, slag) för samlade. Justeringar undantas: två indexeringar
-- eller indexering + tillägg samma period måste kunna ge två justeringar.
create unique index if not exists invoices_contract_period_key
  on invoices(contract_id, billing_period_start, contract_invoice_kind)
  where invoice_type = 'contract' and contract_id is not null
    and contract_invoice_kind <> 'adjustment'
    and status <> 'cancelled' and invoice_number not like 'F-%';
create unique index if not exists invoices_consolidated_period_key
  on invoices(customer_id, billing_period_start, contract_invoice_kind)
  where invoice_type = 'contract' and is_consolidated
    and contract_invoice_kind <> 'adjustment'
    and status <> 'cancelled' and invoice_number not like 'F-%';

-- M4: premietrappan blir fakturakälla
alter table contract_premium_events
  add column if not exists percent numeric,
  add column if not exists index_reference text,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_by_name text,
  add column if not exists first_invoice_id uuid references invoices(id) on delete set null;
create unique index if not exists premium_events_contract_day_type
  on contract_premium_events(contract_id, effective_from, event_type);

-- M5: faktureringsläge på avtalsinnehållets tjänsterader (§ 6 Utrustning)
--   premium   = ingår i årspremien (dagens rader)
--   per_year  = debiteras utöver premien, antal x pris per år, egen rad på årsfakturan
--   per_round = tilläggsstation som debiteras per kontrollrunda (tjänst 43), aldrig från avtalet
alter table case_billing_items
  add column if not exists billing_model text not null default 'premium',
  add column if not exists station_type_id uuid references station_types(id);
alter table case_billing_items drop constraint if exists cbi_billing_model_check;
alter table case_billing_items add constraint cbi_billing_model_check
  check (billing_model in ('premium', 'per_year', 'per_round'));
alter table case_billing_items drop constraint if exists cbi_billing_model_contract_only;
alter table case_billing_items add constraint cbi_billing_model_contract_only
  check (billing_model = 'premium' or (case_type = 'contract' and item_type = 'service'));

-- Avtalstillägg spårar avtalet, inte bara kunden
alter table contract_additions
  add column if not exists contract_id uuid references contracts(id) on delete set null;
