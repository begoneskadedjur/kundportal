-- Avtalsåret på exakt avtalsdag, steg 5: datamodellen, additivt.
-- docs/planer/avtalsar-exakt-arsdag-teknik.md, steg 5 och avsnitt 6.
--
-- Alla nya kolumner är NULL och ingen kod läser dem ännu. NULL betyder dagens
-- beteende. Inga befintliga rader får värden.
--
-- Det gamla unika indexet invoices_contract_period_key och kind-checken
-- invoices_contract_invoice_kind_check ligger kvar. De byts av Christian i
-- SQL-editorn, raderna står i teknikplanen under steg 5 (MCP nekar sådana satser).

-- 1. Avtalet: växlarna för exakt avtalsdag och nya tilläggsregler
alter table public.contracts
  add column if not exists billing_anchor_mode text
    check (billing_anchor_mode is null or billing_anchor_mode = 'start_day'),
  add column if not exists billing_anchor_verified_at timestamptz,
  add column if not exists billing_anchor_verified_by uuid references public.profiles(id),
  add column if not exists billing_anchor_verified_note text,
  add column if not exists addon_rules text
    check (addon_rules is null or addon_rules = 'v2');

comment on column public.contracts.billing_anchor_mode is
  'NULL = perioder från den 1:a (dagens regel). start_day = perioder från contract_start_date med klampning.';
comment on column public.contracts.addon_rules is
  'NULL = dagens tilläggsregler. v2 = täckning per station, glappfakturor och pro rata version 2.';

-- 2. Fakturan: märkning för tilläggsfakturor per enhet
alter table public.invoices
  add column if not exists marking_key text;

comment on column public.invoices.marking_key is
  'Märkningen tilläggsfakturan avser (en faktura per avtal, period, typ och märkning). NULL på alla befintliga.';

-- 3. Stationen: ärendet där den sattes ut
alter table public.equipment_placements
  add column if not exists placed_case_id uuid references public.cases(id) on delete set null;
alter table public.indoor_stations
  add column if not exists placed_case_id uuid references public.cases(id) on delete set null;
create index if not exists ep_placed_case_idx on public.equipment_placements (placed_case_id) where placed_case_id is not null;
create index if not exists is_placed_case_idx on public.indoor_stations (placed_case_id) where placed_case_id is not null;

-- 4. Pro rata-raden: vilka stationer den avser
alter table public.case_billing_items
  add column if not exists station_ids uuid[];

-- 5. Unikt index som också bär märkningen. Med marking_key NULL överallt är det
-- likvärdigt med invoices_contract_period_key.
create unique index if not exists invoices_contract_period_marking_key
  on public.invoices (contract_id, billing_period_start, contract_invoice_kind, coalesce(marking_key, ''))
  where invoice_type = 'contract' and contract_id is not null and contract_invoice_kind <> 'adjustment'
    and status <> 'cancelled' and invoice_number !~~ 'F-%';

-- 6. Täckning per station (avsnitt 6). Inga triggers ännu, de kommer i steg 8.
create table if not exists public.addon_station_coverage (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null,
  station_kind text not null check (station_kind in ('outdoor', 'indoor')),
  unit_customer_id uuid not null references public.customers(id),
  contract_id uuid references public.contracts(id),
  covered_from date not null,
  covered_to date not null,
  source text not null check (source in ('invoice', 'prorata', 'gap_invoice', 'fortnox_manual', 'waived', 'backfill')),
  invoice_id uuid references public.invoices(id) on delete set null,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,
  case_billing_item_id uuid references public.case_billing_items(id) on delete set null,
  fortnox_document_number text,
  invoice_cancelled_at timestamptz,
  note text,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id),
  release_reason text,
  constraint asc_dates check (covered_to >= covered_from),
  constraint asc_manual_has_ref check (source <> 'fortnox_manual' or fortnox_document_number is not null),
  constraint asc_waived_has_note check (source <> 'waived' or nullif(trim(note), '') is not null)
);

comment on table public.addon_station_coverage is
  'Täckt period per tilläggsstation. En aktiv rad (released_at is null) täcker sina dagar. Skrivs bara via SECURITY DEFINER-funktioner och triggers (steg 8).';

create index if not exists asc_station_idx on public.addon_station_coverage (station_id, station_kind) where released_at is null;
create index if not exists asc_invoice_idx on public.addon_station_coverage (invoice_id);

alter table public.addon_station_coverage enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'addon_station_coverage' and policyname = 'asc_select_internal'
  ) then
    create policy asc_select_internal on public.addon_station_coverage
      for select using (public.intranet_is_internal());
  end if;
end $$;

-- Ingen skrivpolicy. Anon får ingenting.
revoke all on public.addon_station_coverage from anon;
