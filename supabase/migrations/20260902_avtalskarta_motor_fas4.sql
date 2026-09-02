-- Avtalskartan som motor, fas 4: "ingår i avtalet" som explicit val.
--
-- § 4 Tjänster i avtalet styr nu ärendet: en tjänsterad som täcks av kundens
-- avtal skapas med covered_by_contract = true och pris 0, och faktureras
-- aldrig som merförsäljning (createAdHocItemsFromCase hoppar över den).
-- Tidigare fanns "ingår" bara som filter i avtalskartans avropskatalog.
-- Applicerad mot live-DB 2026-09-02 via MCP.

alter table case_billing_items
  add column if not exists covered_by_contract boolean not null default false;
comment on column case_billing_items.covered_by_contract is 'Raden täcks av kundens avtal (§ 4) och faktureras inte som merförsäljning';
create index if not exists case_billing_items_covered_idx on case_billing_items(case_id) where covered_by_contract;
