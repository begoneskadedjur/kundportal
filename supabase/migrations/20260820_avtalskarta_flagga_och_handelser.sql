-- 20260820_avtalskarta_flagga_och_handelser.sql
-- Avtalskartan, steg 2: (1) avtal som täcker HELA verksamheten inklusive
-- enheter som tillkommer senare, (2) logg för avtalsändringar som inte har
-- någon egen tabell (prislistbyten m.m.) så de syns i avtalets tidslinje.

-- ---------------------------------------------------------------------------
-- 1. covers_all_sites: avtalet omfattar alla nuvarande OCH framtida enheter
--    under kundens huvudkontor. Alternativet till att lista varje enhet i
--    contract_sites. contract_sites gäller fortfarande för avtal som bara
--    täcker vissa enheter.
-- ---------------------------------------------------------------------------
alter table public.contracts
  add column if not exists covers_all_sites boolean not null default false;

comment on column public.contracts.covers_all_sites is
  'True = avtalet omfattar alla enheter under kundens huvudkontor, även enheter som skapas senare. False = omfattningen styrs av contract_sites.';

-- ---------------------------------------------------------------------------
-- 2. contract_events: generell händelselogg per avtal för ändringar som
--    saknar egen tabell. Premieändringar bor kvar i contract_premium_events
--    och omfattning i contract_sites — denna tabell fångar resten.
-- ---------------------------------------------------------------------------
create table if not exists public.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  event_type text not null check (event_type in ('price_list', 'scope_mode', 'note', 'billing', 'other')),
  title text not null,
  detail text,
  -- Fritt formad kontext (t.ex. {"from_price_list_id":"…","to_price_list_id":"…"})
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

comment on table public.contract_events is
  'Händelselogg per avtal för ändringar utan egen tabell (prislistbyten, omfattningsläge). Visas i avtalets tidslinje på kundsidan.';

create index if not exists idx_contract_events_contract_id
  on public.contract_events (contract_id, occurred_at desc);

alter table public.contract_events enable row level security;

-- Samma mönster som contract_sites/contract_premium_events: inloggade läser,
-- inloggade skriver (admin/koordinator är de enda som når kundsidan).
drop policy if exists authenticated_read_contract_events on public.contract_events;
create policy authenticated_read_contract_events
  on public.contract_events for select
  to authenticated
  using (true);

drop policy if exists authenticated_write_contract_events on public.contract_events;
create policy authenticated_write_contract_events
  on public.contract_events for all
  to authenticated
  using (true)
  with check (true);
