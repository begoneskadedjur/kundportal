-- Upphandlingsportalen (docs/upphandlingsportal-plan.md, etapp 1 och 2)
--
-- Egen del av adminportalen under /admin/upphandlingar. Alla tabeller har
-- prefixet procurement_. Läsning för admin och upphandlingsansvariga
-- (profiles.is_procurement_manager), import och synk via service role från
-- cron. Användarskrivning är begränsad till egna fält med kolumnbehörigheter:
-- importerade fält (titel, köpare, värden, källdata) kan bara service role
-- skriva, så en synk kan aldrig krocka med en manuell rättning.
--
-- Enda ändringen på befintlig tabell: profiles.is_procurement_manager.
-- Additivt: inga drop, inga ändrade kolumner.

-- ---------------------------------------------------------------------------
-- 0. Tillägg

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Flaggan på profiles

alter table public.profiles
  add column if not exists is_procurement_manager boolean not null default false;

comment on column public.profiles.is_procurement_manager is
  'Upphandlingsansvarig: åtkomst till /admin/upphandlingar, notiser och dagligt sammandrag. Sätts under Användarkonton (Personal).';

-- Samma skydd som can_approve_invoices: bara admin/koordinator/service role
-- får ändra flaggan. Funktionen ersätts med identisk logik plus den nya kolumnen.
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_changed text[] := array[]::text[];
  v_admins_kvar int;
begin
  if public.is_privileged_writer() then
    if old.is_admin = true and new.is_admin is distinct from true then
      select count(*) into v_admins_kvar
      from public.profiles p
      where p.is_admin = true and p.user_id is distinct from old.user_id;

      if v_admins_kvar = 0 then
        raise exception 'Kan inte ta bort den sista administratören'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if new.role                   is distinct from old.role                   then v_changed := array_append(v_changed, 'role'); end if;
  if new.is_admin               is distinct from old.is_admin               then v_changed := array_append(v_changed, 'is_admin'); end if;
  if new.is_koordinator         is distinct from old.is_koordinator         then v_changed := array_append(v_changed, 'is_koordinator'); end if;
  if new.customer_id            is distinct from old.customer_id            then v_changed := array_append(v_changed, 'customer_id'); end if;
  if new.organization_id        is distinct from old.organization_id        then v_changed := array_append(v_changed, 'organization_id'); end if;
  if new.multisite_role         is distinct from old.multisite_role         then v_changed := array_append(v_changed, 'multisite_role'); end if;
  if new.technician_id          is distinct from old.technician_id          then v_changed := array_append(v_changed, 'technician_id'); end if;
  if new.can_approve_discounts  is distinct from old.can_approve_discounts  then v_changed := array_append(v_changed, 'can_approve_discounts'); end if;
  if new.can_approve_invoices   is distinct from old.can_approve_invoices   then v_changed := array_append(v_changed, 'can_approve_invoices'); end if;
  if new.is_procurement_manager is distinct from old.is_procurement_manager then v_changed := array_append(v_changed, 'is_procurement_manager'); end if;
  if new.extra_roles            is distinct from old.extra_roles            then v_changed := array_append(v_changed, 'extra_roles'); end if;
  if new.site_access            is distinct from old.site_access            then v_changed := array_append(v_changed, 'site_access'); end if;
  if new.region_access          is distinct from old.region_access          then v_changed := array_append(v_changed, 'region_access'); end if;
  if new.is_active              is distinct from old.is_active              then v_changed := array_append(v_changed, 'is_active'); end if;
  if new.user_id                is distinct from old.user_id                then v_changed := array_append(v_changed, 'user_id'); end if;
  if new.id                     is distinct from old.id                     then v_changed := array_append(v_changed, 'id'); end if;

  if array_length(v_changed, 1) > 0 then
    raise exception 'Behörighet saknas: endast administratör får ändra kolumnerna %',
      array_to_string(v_changed, ', ')
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- Egen profilrad får aldrig skapas med flaggan satt (kompletterar profiles_insert_own)
drop policy if exists profiles_insert_no_procurement_flag on public.profiles;
create policy profiles_insert_no_procurement_flag on public.profiles
  as restrictive for insert to authenticated
  with check (public.is_privileged_writer() or coalesce(is_procurement_manager, false) = false);

-- ---------------------------------------------------------------------------
-- 2. Åtkomstfunktion (SECURITY DEFINER så att RLS inte rekurserar på profiles)

create or replace function public.has_procurement_access()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_active, true) = true
      and (p.is_admin = true or p.role = 'admin' or p.is_procurement_manager = true
           or 'admin' = any(coalesce(p.extra_roles, '{}'::text[])))
  );
$$;

grant execute on function public.has_procurement_access() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tabeller

-- Köpare. Mercell saknar orgnr, så köpare kan skapas på namn och få orgnr senare.
create table if not exists public.procurement_buyers (
  id uuid primary key default gen_random_uuid(),
  org_number text unique,                         -- tio siffror utan bindestreck
  name text not null,
  normalized_name text not null,
  aliases text[] not null default '{}',
  sector text,                                    -- kommun, region, stat, kommunalt bolag, övrigt
  county_code text,                               -- NUTS3, t.ex. SE110
  county_name text,
  nuts_codes text[] not null default '{}',
  customer_id uuid references public.customers(id) on delete set null,
  registrar_email text,                           -- registratorns adress för begäran om handlingar
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_buyers_normalized_name_idx on public.procurement_buyers (normalized_name);
create index if not exists procurement_buyers_aliases_idx on public.procurement_buyers using gin (aliases);
create index if not exists procurement_buyers_customer_idx on public.procurement_buyers (customer_id);

-- Leverantörer, alltid på orgnr. BeGone finns under två stavningar i TED.
create table if not exists public.procurement_suppliers (
  id uuid primary key default gen_random_uuid(),
  org_number text unique,
  name text not null,
  normalized_name text not null,
  aliases text[] not null default '{}',
  is_begone boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_suppliers_normalized_name_idx on public.procurement_suppliers (normalized_name);
create index if not exists procurement_suppliers_aliases_idx on public.procurement_suppliers using gin (aliases);

-- En rad per upphandling efter dedup
create table if not exists public.procurement_notices (
  id uuid primary key default gen_random_uuid(),
  bgu_number bigint generated always as identity unique,  -- [BGU-123] i e-post
  title text not null,
  normalized_title text not null,
  description text,
  buyer_id uuid references public.procurement_buyers(id) on delete set null,
  buyer_name text,
  buyer_org_number text,
  cpv_codes text[] not null default '{}',
  nuts_codes text[] not null default '{}',
  county_codes text[] not null default '{}',
  county_names text[] not null default '{}',
  published_at timestamptz,
  questions_deadline timestamptz,
  tender_deadline timestamptz,
  opening_at timestamptz,
  award_decision_at timestamptz,
  estimated_value numeric,
  value_currency text default 'SEK',
  procedure_type text,
  is_framework boolean,
  contract_start date,
  contract_end date,
  renewal_max integer,
  duration_months numeric,
  criteria_type text check (criteria_type in ('price', 'quality', 'mixed', 'cost')),
  criteria_weights jsonb,
  price_model text,                               -- à-pris, fast pris, fiktiv kalkyl
  volumes jsonb,                                  -- lägenheter, objekt, besök per år
  notice_kind text not null default 'tender'
    check (notice_kind in ('tender', 'direct', 'rfi', 'prior_information', 'award', 'modification', 'other')),
  source_status text,                             -- Mercell tenderStatus, t.ex. Open, Cancelled
  platform_url text,
  document_url text,
  our_status text not null default 'new'
    check (our_status in ('new', 'watching', 'analyzing', 'bidding', 'submitted', 'won', 'lost', 'declined', 'cancelled', 'archived')),
  owner_id uuid references auth.users(id) on delete set null,
  match_score integer not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  expected_bids numeric,
  win_probability numeric,
  annual_value numeric,
  expected_contribution numeric,
  ai_summary text,
  ai_deciders jsonb,                              -- "det här avgör affären"
  requirements_summary jsonb,                     -- skallkrav, viten, referenser ur underlaget
  notes text,
  dedup_key text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_notices_dedup_idx on public.procurement_notices (dedup_key);
create index if not exists procurement_notices_buyer_idx on public.procurement_notices (buyer_id);
create index if not exists procurement_notices_deadline_idx on public.procurement_notices (tender_deadline);
create index if not exists procurement_notices_published_idx on public.procurement_notices (published_at desc);
create index if not exists procurement_notices_score_idx on public.procurement_notices (match_score desc);
create index if not exists procurement_notices_status_idx on public.procurement_notices (our_status);
create index if not exists procurement_notices_cpv_idx on public.procurement_notices using gin (cpv_codes);
create index if not exists procurement_notices_title_trgm_idx on public.procurement_notices using gin (normalized_title extensions.gin_trgm_ops);

-- Källposter per upphandling
create table if not exists public.procurement_notice_sources (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  source text not null check (source in ('mercell', 'ted', 'kommers', 'uhm', 'email', 'manual')),
  source_id text not null,                        -- Mercell id, TED publiceringsnummer
  source_sub text,                                -- Mercells sourceId (TED, e-Avrop, TendSign ...)
  external_ref text,                              -- TED-numret utan inledande nollor, för dedup mellan källor
  url text,
  raw jsonb,
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists procurement_notice_sources_notice_idx on public.procurement_notice_sources (notice_id);
create index if not exists procurement_notice_sources_ext_idx on public.procurement_notice_sources (external_ref);

-- Tilldelningar, nya och historiska
create table if not exists public.procurement_awards (
  id uuid primary key default gen_random_uuid(),
  award_key text not null unique,                 -- källa:referens:vinnare
  notice_id uuid references public.procurement_notices(id) on delete set null,
  buyer_id uuid references public.procurement_buyers(id) on delete set null,
  buyer_name text,
  title text,
  cpv_codes text[] not null default '{}',
  county_code text,
  source text not null check (source in ('mercell', 'ted', 'ted_xml', 'uhm', 'email', 'manual')),
  source_ref text,                                -- TED-nummer, UHM upphandlings-id
  supplier_id uuid references public.procurement_suppliers(id) on delete set null,
  winner_org_number text,
  winner_name text,
  value numeric,
  value_kind text not null default 'unknown' check (value_kind in ('ceiling', 'actual', 'estimated', 'unknown')),
  bids_received integer,
  lowest_bid numeric,
  highest_bid numeric,
  criteria_type text,
  procedure_type text,
  is_framework boolean,
  award_date date,
  contract_signed_date date,
  contract_start date,
  contract_end date,
  renewal_max integer,
  calc_end_date date,
  calc_end_source text check (calc_end_source in ('ted_end_plus_renewals', 'ted_end', 'mercell_expiry', 'assumption_2_2', 'manual')),
  corrected_end_date date,
  corrected_by uuid references auth.users(id) on delete set null,
  corrected_at timestamptz,
  window_start date,                              -- 18 månader före beräknat slut
  window_end date,                                -- 12 månader före beräknat slut
  was_appealed boolean,
  status text not null default 'open' check (status in ('open', 'contacted', 'planned', 'done', 'ignored')),
  owner_id uuid references auth.users(id) on delete set null,
  notes text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_awards_notice_idx on public.procurement_awards (notice_id);
create index if not exists procurement_awards_buyer_idx on public.procurement_awards (buyer_id);
create index if not exists procurement_awards_supplier_idx on public.procurement_awards (supplier_id);
create index if not exists procurement_awards_end_idx on public.procurement_awards (calc_end_date);
create index if not exists procurement_awards_ref_idx on public.procurement_awards (source, source_ref);

-- Alla kända anbudsgivare per upphandling, inklusive förlorare och oss
create table if not exists public.procurement_bidders (
  id uuid primary key default gen_random_uuid(),
  bidder_key text not null unique,                -- källa:referens:orgnr eller namn
  notice_id uuid references public.procurement_notices(id) on delete cascade,
  award_id uuid references public.procurement_awards(id) on delete set null,
  source_ref text,
  supplier_id uuid references public.procurement_suppliers(id) on delete set null,
  org_number text,
  name text not null,
  price numeric,
  score numeric,
  rank integer,
  is_winner boolean not null default false,
  is_begone boolean not null default false,
  source text not null check (source in ('ted', 'ted_xml', 'uhm', 'email', 'document', 'manual')),
  document_id uuid,
  verified boolean not null default false,        -- ansvarig har godkänt siffrorna
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists procurement_bidders_notice_idx on public.procurement_bidders (notice_id);
create index if not exists procurement_bidders_award_idx on public.procurement_bidders (award_id);
create index if not exists procurement_bidders_supplier_idx on public.procurement_bidders (supplier_id);
create index if not exists procurement_bidders_ref_idx on public.procurement_bidders (source_ref);

-- Våra egna anbud (kalkylen sparas som jsonb ur procurementCalcService)
create table if not exists public.procurement_bids (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  label text,
  calc jsonb not null default '{}'::jsonb,
  volumes jsonb not null default '{}'::jsonb,
  contract_years numeric,
  annual_cost numeric,
  floor_price numeric,
  target_price numeric,
  submitted_price numeric,
  win_probability numeric,
  expected_contribution numeric,
  is_current boolean not null default true,
  outcome text not null default 'pending' check (outcome in ('pending', 'won', 'lost', 'cancelled', 'withdrawn')),
  lesson text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_bids_notice_idx on public.procurement_bids (notice_id);

-- Begärda handlingar
create table if not exists public.procurement_document_requests (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid references public.procurement_notices(id) on delete cascade,
  award_id uuid references public.procurement_awards(id) on delete set null,
  buyer_id uuid references public.procurement_buyers(id) on delete set null,
  doc_types text[] not null default '{}',         -- award_decision, opening_protocol, evaluation_report, price_appendix
  recipient_email text not null,
  reply_to text,
  subject text,
  body text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'reminded', 'escalated', 'partial', 'received', 'rejected', 'closed')),
  sent_at timestamptz,
  reminded_at timestamptz,
  escalated_at timestamptz,
  received_at timestamptz,
  resend_message_id text,
  created_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_document_requests_notice_idx on public.procurement_document_requests (notice_id);
create index if not exists procurement_document_requests_status_idx on public.procurement_document_requests (status);

-- Inkommande e-post (Resend inbound). Omatchade hamnar i kön Osorterat.
create table if not exists public.procurement_inbound_emails (
  id uuid primary key default gen_random_uuid(),
  message_id text unique,
  from_email text,
  from_domain text,
  to_emails text[] not null default '{}',
  subject text,
  text_body text,
  received_at timestamptz not null default now(),
  notice_id uuid references public.procurement_notices(id) on delete set null,
  request_id uuid references public.procurement_document_requests(id) on delete set null,
  match_method text check (match_method in ('reply_to', 'subject_tag', 'sender_domain', 'manual')),
  status text not null default 'unsorted' check (status in ('matched', 'unsorted', 'ignored')),
  ai_classification jsonb,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists procurement_inbound_emails_status_idx on public.procurement_inbound_emails (status);

-- Dokument: uppladdade underlag och inkomna handlingar
create table if not exists public.procurement_documents (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid references public.procurement_notices(id) on delete cascade,
  request_id uuid references public.procurement_document_requests(id) on delete set null,
  inbound_email_id uuid references public.procurement_inbound_emails(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  doc_type text not null default 'unknown'
    check (doc_type in ('tender_documents', 'appendix', 'award_decision', 'opening_protocol', 'evaluation_report', 'price_appendix', 'rejection', 'bid', 'other', 'unknown')),
  origin text not null default 'upload' check (origin in ('upload', 'email')),
  uploaded_by uuid references auth.users(id) on delete set null,
  ai_status text not null default 'pending' check (ai_status in ('pending', 'running', 'done', 'failed', 'skipped')),
  ai_extraction jsonb,
  ai_summary text,
  ai_error text,
  verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists procurement_documents_notice_idx on public.procurement_documents (notice_id);

-- Anbudsverkstad: kravlista
create table if not exists public.procurement_requirements (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  text text not null,
  req_type text not null default 'skall' check (req_type in ('skall', 'bor', 'bevis', 'kvalitet')),
  weight numeric,
  page text,                                      -- sidhänvisning i underlaget
  owner_id uuid references auth.users(id) on delete set null,
  done boolean not null default false,
  attachment_document_id uuid references public.procurement_documents(id) on delete set null,
  attachment_note text,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_requirements_notice_idx on public.procurement_requirements (notice_id);

-- Anbudsverkstad: frågor till köparen
create table if not exists public.procurement_questions (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  question text not null,
  reason text,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'answered', 'dropped')),
  answer text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_questions_notice_idx on public.procurement_questions (notice_id);

-- Anbudsverkstad: prisbilaga
create table if not exists public.procurement_price_lines (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  label text not null,
  unit text,
  quantity numeric not null default 1,           -- årsvolym enligt underlaget
  unit_price numeric,                            -- vårt à-pris exkl. moms
  unit_cost numeric,                             -- vår kostnad per enhet
  price_list_item_id uuid references public.price_list_items(id) on delete set null,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_price_lines_notice_idx on public.procurement_price_lines (notice_id);

-- Signalkällor: kurerade webbadresser till upphandlingsplaner
create table if not exists public.procurement_signal_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  buyer_id uuid references public.procurement_buyers(id) on delete set null,
  kind text not null default 'kommun' check (kind in ('kommun', 'region', 'bostadsbolag', 'stat', 'other')),
  county_code text,
  content_hash text,
  last_text text,                                -- senaste hämtade text, för diff
  last_fetched_at timestamptz,
  last_changed_at timestamptz,
  last_status integer,
  last_error text,
  active boolean not null default true,
  verified boolean not null default false,       -- false = seedad, ej granskad av människa
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Signaler: framförhållning ur planer, planerade poster och avtalsklockan
create table if not exists public.procurement_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  signal_type text not null check (signal_type in ('plan', 'upcoming', 'rfi', 'prior_information', 'contract_expiry', 'other')),
  buyer_id uuid references public.procurement_buyers(id) on delete set null,
  buyer_name text,
  text text not null,
  expected_quarter text,                          -- 2027-Q1
  reliability text not null default 'medium' check (reliability in ('low', 'medium', 'high')),
  source text not null,                           -- mercell, ted, signal_source, manual
  url text,
  signal_source_id uuid references public.procurement_signal_sources(id) on delete set null,
  award_id uuid references public.procurement_awards(id) on delete set null,
  notice_id uuid references public.procurement_notices(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'watching', 'converted', 'dismissed')),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_signals_status_idx on public.procurement_signals (status);
create index if not exists procurement_signals_buyer_idx on public.procurement_signals (buyer_id);

-- Bevakningsregler för matchningen
create table if not exists public.procurement_watch_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rule_type text not null check (rule_type in ('cpv_hard', 'cpv_soft', 'keyword', 'negative', 'county')),
  cpv_prefixes text[] not null default '{}',
  keywords text[] not null default '{}',
  county_codes text[] not null default '{}',
  points integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Händelselogg per upphandling
create table if not exists public.procurement_events (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid references public.procurement_notices(id) on delete cascade,
  award_id uuid references public.procurement_awards(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists procurement_events_notice_idx on public.procurement_events (notice_id, created_at desc);
create index if not exists procurement_events_meta_idx on public.procurement_events using gin (metadata);

-- Vem som sett vad, för räknaren i sidomenyn
create table if not exists public.procurement_read_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

-- Källhälsa
create table if not exists public.procurement_source_health (
  source text primary key,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_count integer,
  consecutive_failures integer not null default 0,
  last_error text,
  cursor text,                                    -- Mercell: publiceringstid för nyaste posten förra lyckade körningen
  updated_at timestamptz not null default now()
);

-- Per person: dagligt sammandrag på eller av
create table if not exists public.procurement_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  digest_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. updated_at

create or replace function public.procurement_touch_updated_at()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp'
as $
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'procurement_buyers', 'procurement_suppliers', 'procurement_notices', 'procurement_awards',
    'procurement_bids', 'procurement_document_requests', 'procurement_requirements',
    'procurement_questions', 'procurement_price_lines', 'procurement_signal_sources',
    'procurement_signals', 'procurement_watch_rules', 'procurement_user_settings'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.procurement_touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RLS och behörigheter
--
-- Läsning: has_procurement_access(). Service role går förbi RLS.
-- Skrivning: kolumnbehörigheter styr VILKA fält användare får ändra,
-- policyn styr VEM. anon får ingenting.

do $$
declare t text;
begin
  foreach t in array array[
    'procurement_buyers', 'procurement_suppliers', 'procurement_notices', 'procurement_notice_sources',
    'procurement_awards', 'procurement_bidders', 'procurement_bids', 'procurement_document_requests',
    'procurement_inbound_emails', 'procurement_documents', 'procurement_requirements',
    'procurement_questions', 'procurement_price_lines', 'procurement_signal_sources',
    'procurement_signals', 'procurement_watch_rules', 'procurement_events', 'procurement_read_state',
    'procurement_source_health', 'procurement_user_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_procurement_access())', t || '_select', t);
  end loop;
end $$;

-- Import-tabeller: användare ändrar bara sina egna fält
grant update (our_status, owner_id, questions_deadline, criteria_type, criteria_weights, price_model, volumes,
              expected_bids, win_probability, annual_value, expected_contribution, notes)
  on public.procurement_notices to authenticated;
grant update (corrected_end_date, corrected_by, corrected_at, status, owner_id, notes)
  on public.procurement_awards to authenticated;
grant update (customer_id, registrar_email, sector, website, notes)
  on public.procurement_buyers to authenticated;
grant update (notes) on public.procurement_suppliers to authenticated;
grant update (status, award_id, notice_id) on public.procurement_signals to authenticated;
grant update (verified, verified_by, verified_at) on public.procurement_bidders to authenticated;
grant insert on public.procurement_bidders to authenticated;
grant update (notice_id, request_id, match_method, status) on public.procurement_inbound_emails to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'procurement_notices', 'procurement_awards', 'procurement_buyers', 'procurement_suppliers',
    'procurement_signals', 'procurement_bidders', 'procurement_inbound_emails'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_procurement_access()) with check (public.has_procurement_access())', t || '_update', t);
  end loop;
end $$;

drop policy if exists procurement_bidders_insert on public.procurement_bidders;
create policy procurement_bidders_insert on public.procurement_bidders
  for insert to authenticated with check (public.has_procurement_access() and source in ('manual', 'document'));

-- Arbetstabeller: fulla rättigheter för den som har åtkomst
do $$
declare t text;
begin
  foreach t in array array[
    'procurement_bids', 'procurement_document_requests', 'procurement_documents',
    'procurement_requirements', 'procurement_questions', 'procurement_price_lines',
    'procurement_signal_sources', 'procurement_watch_rules'
  ] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_procurement_access()) with check (public.has_procurement_access())', t || '_write', t);
  end loop;
end $$;

-- Händelser: insert i eget namn
grant insert on public.procurement_events to authenticated;
drop policy if exists procurement_events_insert on public.procurement_events;
create policy procurement_events_insert on public.procurement_events
  for insert to authenticated with check (public.has_procurement_access() and (actor_id is null or actor_id = auth.uid()));

-- Läsläge och personliga inställningar: bara egna rader
grant insert, update, delete on public.procurement_read_state to authenticated;
drop policy if exists procurement_read_state_select on public.procurement_read_state;
create policy procurement_read_state_select on public.procurement_read_state
  for select to authenticated using (user_id = auth.uid());
drop policy if exists procurement_read_state_write on public.procurement_read_state;
create policy procurement_read_state_write on public.procurement_read_state
  for all to authenticated using (user_id = auth.uid() and public.has_procurement_access())
  with check (user_id = auth.uid() and public.has_procurement_access());

grant insert, update on public.procurement_user_settings to authenticated;
drop policy if exists procurement_user_settings_select on public.procurement_user_settings;
create policy procurement_user_settings_select on public.procurement_user_settings
  for select to authenticated using (user_id = auth.uid() or public.has_procurement_access());
drop policy if exists procurement_user_settings_write on public.procurement_user_settings;
create policy procurement_user_settings_write on public.procurement_user_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. RPC: räknaren och dedupens trigramreserv

-- Olästa träffar (matchpoäng >= 60, publicerade senaste 60 dagarna) för inloggad användare
create or replace function public.procurement_unread_count()
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when not public.has_procurement_access() then 0 else (
    select count(*)::int
    from public.procurement_notices n
    where n.match_score >= 60
      and n.first_seen_at >= now() - interval '60 days'
      and n.our_status not in ('archived', 'declined', 'cancelled')
      and not exists (
        select 1 from public.procurement_read_state r
        where r.notice_id = n.id and r.user_id = auth.uid()
      )
  ) end;
$$;
grant execute on function public.procurement_unread_count() to authenticated;

-- Reserv i dedupen: trigramlikhet på titel över tröskeln, samma köpare och
-- sista anbudsdag inom en dag. Anropas av synken med service role.
create or replace function public.procurement_find_similar_notice(
  p_normalized_title text,
  p_buyer_id uuid,
  p_deadline timestamptz,
  p_threshold real default 0.6
)
returns table (id uuid, similarity real)
language sql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  select n.id, extensions.similarity(n.normalized_title, p_normalized_title) as similarity
  from public.procurement_notices n
  where p_buyer_id is not null
    and n.buyer_id = p_buyer_id
    and (
      (p_deadline is null and n.tender_deadline is null)
      or (p_deadline is not null and n.tender_deadline between p_deadline - interval '1 day' and p_deadline + interval '1 day')
    )
    and extensions.similarity(n.normalized_title, p_normalized_title) > p_threshold
  order by 2 desc
  limit 1;
$$;
revoke execute on function public.procurement_find_similar_notice(text, uuid, timestamptz, real) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Storage: privat bucket för underlag och handlingar

insert into storage.buckets (id, name, public)
values ('procurement-documents', 'procurement-documents', false)
on conflict (id) do nothing;

drop policy if exists "Upphandling: läsa dokument" on storage.objects;
create policy "Upphandling: läsa dokument" on storage.objects
  for select to authenticated using (bucket_id = 'procurement-documents' and public.has_procurement_access());
drop policy if exists "Upphandling: ladda upp dokument" on storage.objects;
create policy "Upphandling: ladda upp dokument" on storage.objects
  for insert to authenticated with check (bucket_id = 'procurement-documents' and public.has_procurement_access());
drop policy if exists "Upphandling: ta bort dokument" on storage.objects;
create policy "Upphandling: ta bort dokument" on storage.objects
  for delete to authenticated using (bucket_id = 'procurement-documents' and public.has_procurement_access());

-- ---------------------------------------------------------------------------
-- 8. Seed

-- Bevakningsregler enligt planens avsnitt 7. Järfällahus låg på CPV 70000000
-- och hittades bara via titeln, därav nyckelorden på den mjuka regeln.
insert into public.procurement_watch_rules (name, rule_type, cpv_prefixes, keywords, county_codes, points)
select * from (values
  ('Skadedjursbekämpning (CPV 9092)', 'cpv_hard', array['9092'], array[]::text[], array[]::text[], 100),
  ('Närliggande CPV-grupper', 'cpv_soft', array['909', '9091', '90911', '70', '7033', '507', '772312'], array[]::text[], array[]::text[], 50),
  ('Nyckelord', 'keyword', array[]::text[],
    array['skadedjur', 'skadedjursbekämpning', 'skadedjurssanering', 'skadedjurskontroll', 'råttbekämpning', 'råttor', 'råtta',
          'möss', 'gnagare', 'kackerlackor', 'vägglöss', 'insektsbekämpning', 'fågelsäkring', 'duvor', 'getingar',
          'myror', 'mygg', 'pest control', 'sanering av anläggningar', 'saneringstjänster'],
    array[]::text[], 10),
  ('Negativa ord', 'negative', array[]::text[],
    array['asbest', 'pcb', 'marksanering', 'radon', 'rivning', 'fuktsanering', 'mögelsanering', 'klottersanering'],
    array[]::text[], -50),
  ('BeGones län', 'county', array[]::text[], array[]::text[],
    array['SE110', 'SE121', 'SE122', 'SE123', 'SE312', 'SE313'], 10)
) as v(name, rule_type, cpv_prefixes, keywords, county_codes, points)
where not exists (select 1 from public.procurement_watch_rules);

-- Källor för källhälsan
insert into public.procurement_source_health (source)
values ('mercell'), ('ted'), ('kommers'), ('signals'), ('deadlines'), ('digest')
on conflict (source) do nothing;

-- BeGone som leverantör, båda TED-stavningarna som alias
insert into public.procurement_suppliers (org_number, name, normalized_name, aliases, is_begone)
values ('5593789208', 'BeGone Skadedjur & Sanering AB', 'begone skadedjur sanering',
        array['BeGone Skadedjur och sanering AB', 'Begone Skadedjur & Sanering AB'], true)
on conflict (org_number) do update set is_begone = true;

-- Signalkällor i BeGones län. OVERIFIERADE: adresserna är startsidor eller
-- upphandlingssidor hittade 2026-09-24, inte granskade för att innehålla en
-- upphandlingsplan. Granska och rätta under Inställningar.
insert into public.procurement_signal_sources (name, url, kind, county_code, verified, notes)
values
  ('Stockholms stad', 'https://upphandling.stockholm/', 'kommun', 'SE110', false, 'Upphandlingsportal, planerade upphandlingar ej bekräftade'),
  ('Region Stockholm', 'https://www.regionstockholm.se/om-region-stockholm/inkop-och-upphandling/', 'region', 'SE110', false, null),
  ('Stockholmshem, kommande upphandlingar', 'https://www.stockholmshem.se/om-oss/upphandling/kommande-upphandlingar/', 'bostadsbolag', 'SE110', false, 'Sidan heter Kommande upphandlingar'),
  ('Svenska Bostäder', 'https://www.svenskabostader.se/om-oss/upphandling/', 'bostadsbolag', 'SE110', false, null),
  ('Huddinge kommun', 'https://www.huddinge.se/naringsliv-och-upphandling', 'kommun', 'SE110', false, null),
  ('Järfällahus', 'https://www.jarfallahus.se/om-oss/upphandling', 'bostadsbolag', 'SE110', false, null),
  ('Uppsala kommun', 'https://www.uppsala.se/foretag-och-naringsliv/upphandling-och-leverantor/', 'kommun', 'SE121', false, null),
  ('Uppsalahem', 'https://www.uppsalahem.se/om-oss/agare-och-organisation/upphandling/', 'bostadsbolag', 'SE121', false, null),
  ('Region Uppsala', 'https://regionuppsala.se/', 'region', 'SE121', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Nyköpingshem', 'https://www.nykopingshem.se/', 'bostadsbolag', 'SE122', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Eskilstuna kommun', 'https://www.eskilstuna.se/', 'kommun', 'SE122', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Linköpings kommun', 'https://www.linkoping.se/', 'kommun', 'SE123', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Stångåstaden', 'https://www.stangastaden.se/om-stangastaden/upphandling/', 'bostadsbolag', 'SE123', false, null),
  ('Norrköpings kommun', 'https://www.norrkoping.se/', 'kommun', 'SE123', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Hyresbostäder i Norrköping', 'https://www.hyresbostader.se/om-oss/upphandling/', 'bostadsbolag', 'SE123', false, null),
  ('Falu kommun, Upphandlingscenter Falun Borlänge', 'https://www.falun.se/jobb--foretagande/starta-och-driva-foretag/upphandlingar.html', 'kommun', 'SE312', false, null),
  ('Tunabyggen', 'https://www.tunabyggen.se/', 'bostadsbolag', 'SE312', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Region Dalarna', 'https://www.regiondalarna.se/', 'region', 'SE312', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Gävle kommun', 'https://www.gavle.se/', 'kommun', 'SE313', false, 'Startsida, upphandlingssidan ej hittad'),
  ('Gavlegårdarna', 'https://www.gavlegardarna.se/', 'bostadsbolag', 'SE313', false, 'Startsida, upphandlingssidan ej hittad')
on conflict (url) do nothing;

-- ---------------------------------------------------------------------------
-- 9. RPC-funktionerna är bara för inloggade (advisor: anon ska inte kunna anropa)

revoke execute on function public.has_procurement_access() from public, anon;
revoke execute on function public.procurement_unread_count() from public, anon;
grant execute on function public.has_procurement_access() to authenticated;
grant execute on function public.procurement_unread_count() to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Tilldelningsannonser saknar sista anbudsdag. För att en TED-tilldelning
-- ska landa på den ursprungliga annonsen i stället för att bli en egen rad
-- matchas den på samma köpare och trigramlikhet utan datumkrav, bara mot
-- upphandlingar som inte själva är tilldelningar.

create or replace function public.procurement_find_similar_notice_any(
  p_normalized_title text,
  p_buyer_id uuid,
  p_threshold real default 0.6
)
returns table (id uuid, similarity real)
language sql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  select n.id, extensions.similarity(n.normalized_title, p_normalized_title) as similarity
  from public.procurement_notices n
  where p_buyer_id is not null
    and n.buyer_id = p_buyer_id
    and n.notice_kind <> 'award'
    and extensions.similarity(n.normalized_title, p_normalized_title) > p_threshold
  order by 2 desc, n.published_at desc nulls last
  limit 1;
$$;
revoke execute on function public.procurement_find_similar_notice_any(text, uuid, real) from public, anon, authenticated;
