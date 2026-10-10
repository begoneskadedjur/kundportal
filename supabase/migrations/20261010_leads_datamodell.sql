-- Leads (B2B) etapp 3: datamodell, historik och behörighet.
-- Plan: docs/leads/leads-plan.html (beslut 2026-10-10), docs/leads/leads-crm.md.
--
-- Principer
-- * Inget raderas. Gamla kolumner (status, priority, BANT, assigned_to m.fl.) och tabellerna lead_events,
--   lead_comments, lead_technicians och lead_sni_codes lämnas kvar men används inte av nya sidan.
-- * Fritextkällan döps om till source_fritext; nya source är en fast lista.
-- * estimated_value ÄR årspremien (ingen ny kolumn). contract_with = nuvarande leverantör och
--   contract_end_date = nuvarande avtal till. De återanvänds rakt av.
-- * Gamla status hålls i synk med stage av en before-trigger så att Leadsstatistik (etapp 6 ersätter den)
--   fortsätter att fungera.
-- * Historik: lead_activities. Systemhändelser skrivs bara av triggrar (security definer), människans
--   anteckning/samtal/mejl/möte skrivs via RLS-insert. Mönster från web_inquiry_events.
-- * Behörighet: admin/koordinator ser och ändrar allt. Övrig personal (säljare, tekniker) ser leads där de
--   är ägare, tipsare eller delade medlemmar (lead_members). Ägare och medlemmar får ändra; bara ägaren
--   och admin/koordinator får överlåta och dela (RPC lead_overlat, lead_dela, lead_sluta_dela).
--   Kunder ser aldrig något.

-- ---------------------------------------------------------------------------
-- Fasta listor
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.lead_stage as enum ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'vunnen', 'forlorad', 'parkerad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum ('tekniker_tips', 'engangsarende', 'webbforfragan', 'telefon', 'mejl',
    'rekommendation', 'befintlig_kund', 'upphandling', 'kall_bearbetning', 'ovrigt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_type as enum ('nytt_avtal', 'utokning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_customer_group as enum ('foretag', 'privat', 'forening');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_lost_reason as enum ('pris', 'annan_leverantor', 'ingen_budget', 'inget_behov',
    'ingen_kontakt', 'fel_tidpunkt', 'dubblett', 'ovrigt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_activity_kind as enum (
    -- system (bara triggrar)
    'skapad', 'stage', 'agare', 'varde', 'nasta_steg', 'parkerad', 'forlorad', 'delad', 'delning_borttagen',
    'kund_kopplad', 'arende_kopplat', 'offert_skickad', 'offert_avbojd', 'avtal_signerat',
    -- människa (RLS-insert)
    'anteckning', 'samtal', 'mejl', 'mote');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Nya kolumner på leads
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'source' and data_type = 'text') then
    alter table public.leads rename column source to source_fritext;
  end if;
end $$;

alter table public.leads
  add column if not exists legacy_status public.lead_status,
  add column if not exists stage public.lead_stage not null default 'ny',
  add column if not exists stage_changed_at timestamptz,
  add column if not exists owner_profile_id uuid references public.profiles(id),
  add column if not exists tipped_by_profile_id uuid references public.profiles(id),
  add column if not exists source public.lead_source,
  add column if not exists lead_type public.lead_type not null default 'nytt_avtal',
  add column if not exists customer_group public.lead_customer_group,
  add column if not exists origin_case_type text,
  add column if not exists origin_case_id uuid,
  add column if not exists web_inquiry_id uuid references public.web_inquiries(id) on delete set null,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists offer_contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists agreement_contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists parked_until date,
  add column if not exists lost_reason public.lead_lost_reason,
  add column if not exists lost_note text,
  add column if not exists won_at timestamptz,
  add column if not exists lost_at timestamptz,
  add column if not exists org_nr_norm text generated always as (nullif(regexp_replace(coalesce(organization_number, ''), '\D', '', 'g'), '')) stored,
  add column if not exists phone_norm text generated always as (
    nullif(case
      when regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') ~ '^46[1-9]'
        then '0' || substr(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'), 3)
      else regexp_replace(coalesce(phone_number, ''), '\D', '', 'g')
    end, '')) stored,
  add column if not exists email_norm text generated always as (nullif(lower(btrim(coalesce(email, ''))), '')) stored;

comment on column public.leads.estimated_value is 'Uppskattad årspremie i kr (används som årspremie sedan etapp 3)';
comment on column public.leads.contract_with is 'Nuvarande leverantör';
comment on column public.leads.contract_end_date is 'Nuvarande avtal löper till';
comment on column public.leads.status is 'GAMMAL statusskala. Hålls i synk med stage av leads_before_write. Läs stage.';
comment on column public.leads.legacy_status is 'Status före migreringen 2026-10-10 (bevaras)';
comment on column public.leads.source_fritext is 'Gammal fritextkälla före 2026-10-10 (bevaras)';

do $$ begin
  alter table public.leads add constraint leads_origin_case_type_check
    check (origin_case_type is null or origin_case_type in ('private_cases', 'business_cases', 'cases', 'station_inspection_sessions'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.leads add constraint leads_origin_pair_check
    check ((origin_case_type is null) = (origin_case_id is null));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.leads add constraint leads_lost_reason_check
    check (stage <> 'forlorad' or lost_reason is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.leads add constraint leads_parked_until_check
    check (stage <> 'parkerad' or parked_until is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.leads add constraint leads_next_action_len_check
    check (next_action is null or char_length(next_action) <= 300);
exception when duplicate_object then null; end $$;

create unique index if not exists leads_origin_unik on public.leads (origin_case_type, origin_case_id) where origin_case_id is not null;
create index if not exists leads_owner_idx on public.leads (owner_profile_id);
create index if not exists leads_tipped_by_idx on public.leads (tipped_by_profile_id);
create index if not exists leads_stage_next_idx on public.leads (stage, next_action_at);
create index if not exists leads_org_nr_norm_idx on public.leads (org_nr_norm);
create index if not exists leads_phone_norm_idx on public.leads (phone_norm);
create index if not exists leads_email_norm_idx on public.leads (email_norm);
create index if not exists leads_customer_idx on public.leads (customer_id);

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner för RLS (security definer, profiles.user_id = auth.uid())
-- ---------------------------------------------------------------------------
create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id from public.profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.is_lead_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_active, true)
      and (
        p.role::text in ('admin', 'koordinator')
        or coalesce(p.is_admin, false)
        or coalesce(p.is_koordinator, false)
        or coalesce(p.extra_roles, '{}'::text[]) && array['admin', 'koordinator']::text[]
      )
  );
$$;

create or replace function public.is_lead_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_active, true)
      and (
        p.role::text in ('admin', 'koordinator', 'säljare', 'technician')
        or coalesce(p.is_admin, false)
        or coalesce(p.is_koordinator, false)
        or coalesce(p.extra_roles, '{}'::text[]) && array['admin', 'koordinator', 'säljare', 'technician']::text[]
      )
  );
$$;

-- Personalprofil (för ägare och delning): aktiv anställd
create or replace function public.lead_ar_personal(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile
      and coalesce(p.is_active, true)
      and (
        p.role::text in ('admin', 'koordinator', 'säljare', 'technician')
        or coalesce(p.is_admin, false)
        or coalesce(p.is_koordinator, false)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Delning: lead_members (borttagning = removed_at, raden ligger kvar)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_members (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id),
  constraint lead_members_unik unique (lead_id, profile_id)
);
create index if not exists lead_members_profile_idx on public.lead_members (profile_id) where removed_at is null;
alter table public.lead_members enable row level security;

create or replace function public.is_lead_member(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.lead_members m
    where m.lead_id = p_lead and m.removed_at is null and m.profile_id = public.my_profile_id()
  );
$$;

create or replace function public.can_see_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.is_lead_admin()
    or (public.is_lead_staff() and (
      exists (select 1 from public.leads l
              where l.id = p_lead
                and (l.owner_profile_id = public.my_profile_id() or l.tipped_by_profile_id = public.my_profile_id()))
      or public.is_lead_member(p_lead)));
$$;

create or replace function public.can_edit_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.is_lead_admin()
    or (public.is_lead_staff() and (
      exists (select 1 from public.leads l where l.id = p_lead and l.owner_profile_id = public.my_profile_id())
      or public.is_lead_member(p_lead)));
$$;

-- ---------------------------------------------------------------------------
-- Historik: lead_activities
-- ---------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind public.lead_activity_kind not null,
  text text check (text is null or char_length(text) <= 4000),
  fran_varde text,
  till_varde text,
  ref_table text,
  ref_id uuid,
  occurred_at timestamptz not null default now(),
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, occurred_at desc);
alter table public.lead_activities enable row level security;

-- ---------------------------------------------------------------------------
-- Triggrar på leads
-- ---------------------------------------------------------------------------
-- updated_at/updated_by: profil via user_id (förut auth.uid() rakt in i en profil-FK).
-- update_history skrivs inte längre (kolumnen lämnas kvar).
create or replace function public.update_leads_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(current_setting('begone.leads_migrering', true), '') = 'on' then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(public.my_profile_id(), new.updated_by, new.created_by);
  return new;
end;
$$;

create or replace function public.lead_stage_fran_status(p_status text)
returns public.lead_stage
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case p_status
    when 'green_deal' then 'vunnen'
    when 'red_lost' then 'forlorad'
    when 'orange_hot' then 'kontaktad'
    when 'yellow_warm' then 'kontaktad'
    else 'ny'
  end::public.lead_stage;
$$;

create or replace function public.leads_before_write()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := public.my_profile_id();
  v_admin boolean := public.is_lead_admin();
  v_inloggad boolean := auth.uid() is not null;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_me);
    new.updated_by := coalesce(new.updated_by, new.created_by);
  end if;

  -- Övergång: gammal kod som bara ändrar status flyttar stage (tas bort när inget skriver status)
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.stage is not distinct from old.stage then
    new.stage := public.lead_stage_fran_status(new.status::text);
    if new.stage = 'forlorad' and new.lost_reason is null then new.lost_reason := 'ovrigt'; end if;
  end if;

  if v_inloggad and not v_admin then
    -- Automatiska steg sätts av systemet (etapp 5); admin/koordinator kan sätta dem för hand tills vidare
    if new.stage in ('besok_bokat', 'offert_skickad', 'vunnen')
       and (tg_op = 'INSERT' or new.stage is distinct from old.stage) then
      raise exception 'Steget sätts automatiskt och kan inte väljas för hand' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if new.owner_profile_id is distinct from old.owner_profile_id and old.owner_profile_id is distinct from v_me then
        raise exception 'Bara ägaren eller admin/koordinator kan överlåta leaden' using errcode = '42501';
      end if;
      if new.tipped_by_profile_id is distinct from old.tipped_by_profile_id then
        raise exception 'Tipsaren kan bara ändras av admin/koordinator' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'vunnen' then new.won_at := coalesce(new.won_at, now()); else new.won_at := null; end if;
    if new.stage = 'forlorad' then
      new.lost_at := coalesce(new.lost_at, now());
    else
      new.lost_at := null;
      new.lost_reason := null;
      new.lost_note := null;
    end if;
    if new.stage <> 'parkerad' then new.parked_until := null; end if;
  end if;

  -- Gamla statusskalan följer stage (för Leadsstatistik tills etapp 6)
  new.status := case new.stage
    when 'ny' then 'blue_cold'
    when 'kontaktad' then 'yellow_warm'
    when 'besok_bokat' then 'orange_hot'
    when 'offert_skickad' then 'orange_hot'
    when 'vunnen' then 'green_deal'
    when 'forlorad' then 'red_lost'
    when 'parkerad' then 'blue_cold'
  end::public.lead_status;

  return new;
end;
$$;

create or replace trigger leads_before_write
  before insert or update on public.leads
  for each row execute function public.leads_before_write();

create or replace function public.leads_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_profile uuid;
begin
  if coalesce(current_setting('begone.leads_migrering', true), '') = 'on' then
    return null;
  end if;
  v_profile := coalesce(public.my_profile_id(), new.updated_by);

  if tg_op = 'INSERT' then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, occurred_at, profile_id)
    values (new.id, 'skapad', new.source::text,
            coalesce(new.origin_case_type, case when new.web_inquiry_id is not null then 'web_inquiries' end),
            coalesce(new.origin_case_id, new.web_inquiry_id),
            new.created_at, coalesce(public.my_profile_id(), new.created_by));
    return null;
  end if;

  if new.stage is distinct from old.stage then
    if new.stage = 'forlorad' then
      insert into public.lead_activities (lead_id, kind, text, fran_varde, till_varde, profile_id)
      values (new.id, 'forlorad', new.lost_note, old.stage::text, new.lost_reason::text, v_profile);
    elsif new.stage = 'parkerad' then
      insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
      values (new.id, 'parkerad', old.stage::text, new.parked_until::text, v_profile);
    else
      insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
      values (new.id, 'stage', old.stage::text, new.stage::text, v_profile);
    end if;
  elsif new.stage = 'parkerad' and new.parked_until is distinct from old.parked_until then
    insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
    values (new.id, 'parkerad', old.parked_until::text, new.parked_until::text, v_profile);
  end if;

  if new.owner_profile_id is distinct from old.owner_profile_id then
    insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
    values (new.id, 'agare', old.owner_profile_id::text, new.owner_profile_id::text, v_profile);
  end if;

  if new.estimated_value is distinct from old.estimated_value then
    insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
    values (new.id, 'varde', old.estimated_value::text, new.estimated_value::text, v_profile);
  end if;

  if new.next_action is distinct from old.next_action or new.next_action_at is distinct from old.next_action_at then
    insert into public.lead_activities (lead_id, kind, text, fran_varde, till_varde, profile_id)
    values (new.id, 'nasta_steg', new.next_action, old.next_action_at::text, new.next_action_at::text, v_profile);
  end if;

  if new.customer_id is distinct from old.customer_id and new.customer_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'kund_kopplad', new.customer_id::text, 'customers', new.customer_id, v_profile);
  end if;

  if new.origin_case_id is distinct from old.origin_case_id and new.origin_case_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'arende_kopplat', new.origin_case_id::text, new.origin_case_type, new.origin_case_id, v_profile);
  end if;

  if new.offer_contract_id is distinct from old.offer_contract_id and new.offer_contract_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'offert_skickad', new.offer_contract_id::text, 'contracts', new.offer_contract_id, v_profile);
  end if;

  if new.agreement_contract_id is distinct from old.agreement_contract_id and new.agreement_contract_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'avtal_signerat', new.agreement_contract_id::text, 'contracts', new.agreement_contract_id, v_profile);
  end if;

  return null;
end;
$$;

create or replace trigger leads_after_write
  after insert or update on public.leads
  for each row execute function public.leads_after_write();

-- Delning loggas i tidslinjen
create or replace function public.lead_members_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_profile uuid;
begin
  if coalesce(current_setting('begone.leads_migrering', true), '') = 'on' then
    return null;
  end if;
  v_profile := public.my_profile_id();
  if tg_op = 'INSERT' and new.removed_at is null then
    insert into public.lead_activities (lead_id, kind, till_varde, profile_id)
    values (new.lead_id, 'delad', new.profile_id::text, coalesce(v_profile, new.added_by));
  elsif tg_op = 'UPDATE' and (old.removed_at is null) <> (new.removed_at is null) then
    insert into public.lead_activities (lead_id, kind, till_varde, profile_id)
    values (new.lead_id, case when new.removed_at is null then 'delad' else 'delning_borttagen' end::public.lead_activity_kind,
            new.profile_id::text, coalesce(v_profile, new.removed_by, new.added_by));
  end if;
  return null;
end;
$$;

create or replace trigger lead_members_after_write
  after insert or update on public.lead_members
  for each row execute function public.lead_members_after_write();

-- Ett loggat samtal, mejl eller möte på en ny lead flyttar den till Kontaktad
create or replace function public.lead_activities_after_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.kind in ('samtal', 'mejl', 'mote') then
    update public.leads set stage = 'kontaktad' where id = new.lead_id and stage = 'ny';
  end if;
  return null;
end;
$$;

create or replace trigger lead_activities_after_insert
  after insert on public.lead_activities
  for each row execute function public.lead_activities_after_insert();

-- Gamla klient-/triggerloggningen till lead_events stängs av (funktionerna blir no-op, triggrarna ligger kvar)
create or replace function public.log_lead_events()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Ersatt av leads_after_write -> lead_activities (2026-10-10)
  return null;
end;
$$;

create or replace function public.log_lead_contact_events()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Ersatt 2026-10-10: kontaktändringar loggas inte längre i lead_events
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: leads (befintliga policyer skrivs om på plats, inga drop)
-- ---------------------------------------------------------------------------
alter policy employees_select_leads on public.leads to authenticated
  using (
    public.is_lead_admin()
    or (public.is_lead_staff() and (
      owner_profile_id = public.my_profile_id()
      or tipped_by_profile_id = public.my_profile_id()
      or public.is_lead_member(id)))
  );

alter policy employees_insert_leads on public.leads to authenticated
  with check (
    public.is_lead_staff() and (
      public.is_lead_admin()
      or owner_profile_id = public.my_profile_id()
      or tipped_by_profile_id = public.my_profile_id())
  );

-- ALL-policyn blir admin/koordinator (radering och allt annat)
alter policy employees_modify_leads on public.leads to authenticated
  using (public.is_lead_admin())
  with check (public.is_lead_admin());

do $$ begin
  create policy leads_update_owner_member on public.leads
    for update to authenticated
    using (public.is_lead_staff() and (owner_profile_id = public.my_profile_id() or public.is_lead_member(id)))
    with check (public.is_lead_staff());
exception when duplicate_object then null; end $$;

-- lead_activities
do $$ begin
  create policy lead_activities_select on public.lead_activities
    for select to authenticated using (public.can_see_lead(lead_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy lead_activities_insert_human on public.lead_activities
    for insert to authenticated
    with check (
      kind in ('anteckning', 'samtal', 'mejl', 'mote')
      and profile_id = public.my_profile_id()
      and public.can_see_lead(lead_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy lead_activities_admin_update on public.lead_activities
    for update to authenticated using (public.is_lead_admin()) with check (public.is_lead_admin());
exception when duplicate_object then null; end $$;

-- lead_members: läsning för den som ser leaden, skrivning bara via RPC
do $$ begin
  create policy lead_members_select on public.lead_members
    for select to authenticated using (public.can_see_lead(lead_id));
exception when duplicate_object then null; end $$;

-- lead_contacts (extra kontakter): samma synlighet som leaden
alter policy employees_select_lead_contacts on public.lead_contacts to authenticated
  using (public.can_see_lead(lead_id));
alter policy employees_insert_lead_contacts on public.lead_contacts to authenticated
  with check (public.can_see_lead(lead_id));
alter policy employees_modify_lead_contacts on public.lead_contacts to authenticated
  using (public.can_edit_lead(lead_id))
  with check (public.can_edit_lead(lead_id));

-- Gamla tabeller: läsning som leaden, skrivning bara admin/koordinator (ingen kod skriver längre)
alter policy employees_select_lead_comments on public.lead_comments to authenticated using (public.can_see_lead(lead_id));
alter policy employees_insert_lead_comments on public.lead_comments to authenticated with check (public.is_lead_admin());
alter policy employees_modify_lead_comments on public.lead_comments to authenticated using (public.is_lead_admin()) with check (public.is_lead_admin());

alter policy employees_select_lead_technicians on public.lead_technicians to authenticated using (public.can_see_lead(lead_id));
alter policy employees_insert_lead_technicians on public.lead_technicians to authenticated with check (public.is_lead_admin());
alter policy employees_modify_lead_technicians on public.lead_technicians to authenticated using (public.is_lead_admin()) with check (public.is_lead_admin());

alter policy employees_select_lead_sni_codes on public.lead_sni_codes to authenticated using (public.can_see_lead(lead_id));
alter policy employees_insert_lead_sni_codes on public.lead_sni_codes to authenticated with check (public.is_lead_admin());
alter policy employees_modify_lead_sni_codes on public.lead_sni_codes to authenticated using (public.is_lead_admin()) with check (public.is_lead_admin());

alter policy "Employees can view lead_events" on public.lead_events to authenticated using (public.can_see_lead(lead_id));
alter policy "Employees can create lead_events" on public.lead_events to authenticated with check (public.is_lead_admin());
alter policy "Employees can insert lead_events" on public.lead_events to authenticated with check (public.is_lead_admin());
alter policy "Employees can update lead_events" on public.lead_events to authenticated using (public.is_lead_admin());
alter policy "Employees can delete lead_events" on public.lead_events to authenticated using (public.is_lead_admin());

-- ---------------------------------------------------------------------------
-- RPC: överlåt, dela, sluta dela, dubbletter, personal
-- ---------------------------------------------------------------------------
create or replace function public.lead_overlat(p_lead uuid, p_ny_agare uuid, p_behall_som_delad boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := public.my_profile_id();
  v_agare uuid;
begin
  select owner_profile_id into v_agare from public.leads where id = p_lead;
  if not found then raise exception 'Leaden finns inte' using errcode = 'P0002'; end if;
  if not (public.is_lead_admin() or (public.is_lead_staff() and v_agare = v_me)) then
    raise exception 'Bara ägaren eller admin/koordinator kan överlåta leaden' using errcode = '42501';
  end if;
  if p_ny_agare is null or not public.lead_ar_personal(p_ny_agare) then
    raise exception 'Ny ägare måste vara en aktiv anställd' using errcode = '22023';
  end if;
  if v_agare is not distinct from p_ny_agare then return; end if;

  update public.leads set owner_profile_id = p_ny_agare where id = p_lead;

  -- Den nya ägaren behöver ingen delning
  update public.lead_members set removed_at = now(), removed_by = v_me
   where lead_id = p_lead and profile_id = p_ny_agare and removed_at is null;

  if p_behall_som_delad and v_agare is not null then
    insert into public.lead_members (lead_id, profile_id, added_by)
    values (p_lead, v_agare, v_me)
    on conflict (lead_id, profile_id) do update
      set removed_at = null, removed_by = null, added_by = excluded.added_by
      where public.lead_members.removed_at is not null;
  end if;
end;
$$;

create or replace function public.lead_dela(p_lead uuid, p_profiler uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := public.my_profile_id();
  v_agare uuid;
  v_p uuid;
  v_antal integer := 0;
begin
  select owner_profile_id into v_agare from public.leads where id = p_lead;
  if not found then raise exception 'Leaden finns inte' using errcode = 'P0002'; end if;
  if not (public.is_lead_admin() or (public.is_lead_staff() and v_agare = v_me)) then
    raise exception 'Bara ägaren eller admin/koordinator kan dela leaden' using errcode = '42501';
  end if;
  foreach v_p in array coalesce(p_profiler, '{}'::uuid[]) loop
    continue when v_p is null or v_p is not distinct from v_agare or not public.lead_ar_personal(v_p);
    insert into public.lead_members (lead_id, profile_id, added_by)
    values (p_lead, v_p, v_me)
    on conflict (lead_id, profile_id) do update
      set removed_at = null, removed_by = null, added_by = excluded.added_by
      where public.lead_members.removed_at is not null;
    if found then v_antal := v_antal + 1; end if;
  end loop;
  return v_antal;
end;
$$;

create or replace function public.lead_sluta_dela(p_lead uuid, p_profil uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me uuid := public.my_profile_id();
  v_agare uuid;
begin
  select owner_profile_id into v_agare from public.leads where id = p_lead;
  if not found then raise exception 'Leaden finns inte' using errcode = 'P0002'; end if;
  -- Ägaren och admin/koordinator tar bort vem som helst; en medlem kan lämna själv
  if not (public.is_lead_admin() or (public.is_lead_staff() and (v_agare = v_me or p_profil = v_me))) then
    raise exception 'Du kan inte ändra delningen' using errcode = '42501';
  end if;
  update public.lead_members set removed_at = now(), removed_by = v_me
   where lead_id = p_lead and profile_id = p_profil and removed_at is null;
end;
$$;

-- Dubblettkontroll före ny lead: org.nr, telefon och e-post mot alla leads.
-- Returnerar bara namn, steg och ägare; kan_oppna säger om anroparen får se leaden.
create or replace function public.lead_dubbletter(p_org text, p_telefon text, p_epost text, p_utom uuid default null)
returns table (id uuid, company_name text, stage public.lead_stage, agare text, traff text, kan_oppna boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org text := nullif(regexp_replace(coalesce(p_org, ''), '\D', '', 'g'), '');
  v_tel text := nullif(regexp_replace(coalesce(p_telefon, ''), '\D', '', 'g'), '');
  v_epost text := nullif(lower(btrim(coalesce(p_epost, ''))), '');
begin
  if not public.is_lead_staff() then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  if v_tel ~ '^46[1-9]' then v_tel := '0' || substr(v_tel, 3); end if;
  if v_org is not null and length(v_org) < 10 then v_org := null; end if;
  if v_tel is not null and length(v_tel) < 7 then v_tel := null; end if;

  return query
  select l.id, l.company_name, l.stage, p.display_name::text,
         case when v_org is not null and l.org_nr_norm = v_org then 'org.nr'
              when v_tel is not null and l.phone_norm = v_tel then 'telefon'
              else 'e-post' end,
         public.can_see_lead(l.id)
    from public.leads l
    left join public.profiles p on p.id = l.owner_profile_id
   where (p_utom is null or l.id <> p_utom)
     and ((v_org is not null and l.org_nr_norm = v_org)
       or (v_tel is not null and l.phone_norm = v_tel)
       or (v_epost is not null and l.email_norm = v_epost))
   order by (l.stage in ('vunnen', 'forlorad')), l.created_at desc
   limit 5;
end;
$$;

-- Personal att välja som ägare eller dela med (alla anställda kan äga en lead)
create or replace function public.lead_personal()
returns table (id uuid, namn text, roll text, aktiv boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_lead_staff() then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  return query
  select p.id, coalesce(p.display_name, p.email)::text, p.role::text, coalesce(p.is_active, true)
    from public.profiles p
   where p.role::text in ('admin', 'koordinator', 'säljare', 'technician')
      or coalesce(p.is_admin, false) or coalesce(p.is_koordinator, false)
   order by coalesce(p.display_name, p.email);
end;
$$;

-- Rättigheter på funktionerna: bara inloggade
revoke all on function public.my_profile_id() from public, anon;
revoke all on function public.is_lead_admin() from public, anon;
revoke all on function public.is_lead_staff() from public, anon;
revoke all on function public.lead_ar_personal(uuid) from public, anon;
revoke all on function public.is_lead_member(uuid) from public, anon;
revoke all on function public.can_see_lead(uuid) from public, anon;
revoke all on function public.can_edit_lead(uuid) from public, anon;
revoke all on function public.lead_overlat(uuid, uuid, boolean) from public, anon;
revoke all on function public.lead_dela(uuid, uuid[]) from public, anon;
revoke all on function public.lead_sluta_dela(uuid, uuid) from public, anon;
revoke all on function public.lead_dubbletter(text, text, text, uuid) from public, anon;
revoke all on function public.lead_personal() from public, anon;
revoke all on function public.leads_after_write() from public, anon, authenticated;
revoke all on function public.lead_members_after_write() from public, anon, authenticated;
revoke all on function public.lead_activities_after_insert() from public, anon, authenticated;

grant execute on function public.my_profile_id() to authenticated;
grant execute on function public.is_lead_admin() to authenticated;
grant execute on function public.is_lead_staff() to authenticated;
grant execute on function public.lead_ar_personal(uuid) to authenticated;
grant execute on function public.is_lead_member(uuid) to authenticated;
grant execute on function public.can_see_lead(uuid) to authenticated;
grant execute on function public.can_edit_lead(uuid) to authenticated;
grant execute on function public.lead_overlat(uuid, uuid, boolean) to authenticated;
grant execute on function public.lead_dela(uuid, uuid[]) to authenticated;
grant execute on function public.lead_sluta_dela(uuid, uuid) to authenticated;
grant execute on function public.lead_dubbletter(text, text, text, uuid) to authenticated;
grant execute on function public.lead_personal() to authenticated;

grant select, insert, update on public.lead_activities to authenticated;
grant select on public.lead_members to authenticated;
revoke all on public.lead_activities from anon;
revoke all on public.lead_members from anon;
