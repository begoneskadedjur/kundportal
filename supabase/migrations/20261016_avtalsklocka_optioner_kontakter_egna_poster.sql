-- 20261016_avtalsklocka_optioner_kontakter_egna_poster.sql
-- Upphandlingsportalen 3.65.0 (docs/upphandlingsportal-ux-plan.md etapp 6 och 7).
-- Bara tillägg: nya kolumner, en ny tabell, en ny RPC och omskrivna
-- likhetsfunktioner (create or replace). Inget tas bort.
--
--   1. Riktiga förlängningsoptioner per tilldelning: basavtalets slut,
--      optionerna i månader, antal, texten ur annonsen och källan.
--   2. Notis när ett avtal går in i bearbetningsfönstret: window_notified_at
--      (en gång per avtal) och window_notify_enabled per person.
--   3. Kontaktpersoner hos köparen: kontakten ur annonsen per upphandling på
--      procurement_notices och aggregerat per köpare i procurement_contacts
--      (ur TED och manuellt tillagda).
--   4. Egna poster i Anbud: direktupphandling, avrop och offertförfrågan
--      (procurement_notices.manual_type) via RPC:n
--      procurement_create_manual_notice. Synkens dedup matchar aldrig mot dem.

-- ---------------------------------------------------------------------------
-- 1. Förlängningsoptioner

alter table public.procurement_awards
  add column if not exists base_end_date date,
  add column if not exists option_months integer,
  add column if not exists option_count integer,
  add column if not exists option_text text,
  add column if not exists option_source text,
  add column if not exists window_notified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'procurement_awards_option_source_check') then
    alter table public.procurement_awards add constraint procurement_awards_option_source_check
      check (option_source is null or option_source in ('ted_eforms', 'ted_xml', 'text', 'manual'));
  end if;
end $$;

comment on column public.procurement_awards.base_end_date is 'Basavtalets slut utan förlängningsoptioner';
comment on column public.procurement_awards.option_months is 'Förlängningsoptioner i månader som ingår i calc_end_date (0 = inga, null = okänt)';
comment on column public.procurement_awards.option_count is 'Antal förlängningar (TED BT-58 eller ur texten)';
comment on column public.procurement_awards.option_text is 'Optionstexten ur annonsen (TED BT-57, BT-54 eller RENEWAL_DESCR)';
comment on column public.procurement_awards.option_source is 'ted_eforms, ted_xml, text eller manual när optionerna kommer ur annonsen';
comment on column public.procurement_awards.window_notified_at is 'Notisen om bearbetningsfönstret är skickad (en gång per avtal)';

-- Avtal som redan är i eller förbi fönstret i dag får ingen notis i efterhand:
-- de syns redan på Idag och i avtalsklockan.
update public.procurement_awards
set window_notified_at = now()
where window_notified_at is null
  and coalesce(corrected_end_date, calc_end_date) is not null
  and (coalesce(corrected_end_date, calc_end_date) - interval '18 months')::date <= (now() at time zone 'Europe/Stockholm')::date;

-- ---------------------------------------------------------------------------
-- 2. Notisen av och på per person

alter table public.procurement_user_settings
  add column if not exists window_notify_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- 3. Kontaktpersoner

alter table public.procurement_notices
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists manual_type text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'procurement_notices_manual_type_check') then
    alter table public.procurement_notices add constraint procurement_notices_manual_type_check
      check (manual_type is null or manual_type in ('direct', 'call_off', 'rfq'));
  end if;
end $$;

comment on column public.procurement_notices.contact_name is 'Kontaktperson hos köparen ur annonsen (TED BT-502)';
comment on column public.procurement_notices.manual_type is 'Egen post i Anbud: direct (direktupphandling), call_off (avrop från ramavtal), rfq (offertförfrågan)';

create table if not exists public.procurement_contacts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.procurement_buyers(id) on delete cascade,
  -- buyer_id:e-post (eller normaliserat namn). Unik för kontakter ur annonserna, null för manuella utan e-post.
  contact_key text unique,
  name text,
  role text,
  email text,
  phone text,
  last_contacted_at date,
  source text not null default 'manual' check (source in ('ted', 'mercell', 'manual')),
  notice_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procurement_contacts_buyer_idx on public.procurement_contacts (buyer_id);

alter table public.procurement_contacts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'procurement_contacts' and policyname = 'procurement_contacts_select') then
    create policy procurement_contacts_select on public.procurement_contacts for select using (public.has_procurement_access());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'procurement_contacts' and policyname = 'procurement_contacts_insert') then
    create policy procurement_contacts_insert on public.procurement_contacts for insert with check (public.has_procurement_access());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'procurement_contacts' and policyname = 'procurement_contacts_update') then
    create policy procurement_contacts_update on public.procurement_contacts for update using (public.has_procurement_access()) with check (public.has_procurement_access());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'procurement_contacts' and policyname = 'procurement_contacts_delete') then
    create policy procurement_contacts_delete on public.procurement_contacts for delete using (public.has_procurement_access());
  end if;
end $$;

grant select, insert, update, delete on public.procurement_contacts to authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'procurement_contacts_touch') then
    create trigger procurement_contacts_touch before update on public.procurement_contacts
      for each row execute function public.procurement_touch_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Egna poster: direktupphandling, avrop och offertförfrågan

create or replace function public.procurement_create_manual_notice(
  p_type text,
  p_title text,
  p_buyer_id uuid default null,
  p_buyer_name text default null,
  p_deadline date default null,
  p_value numeric default null,
  p_owner_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_buyer public.procurement_buyers%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_name text;
  v_actor text;
begin
  if not public.has_procurement_access() then
    raise exception 'Upphandlingsportalen kräver att du är upphandlingsansvarig';
  end if;
  if p_type is null or p_type not in ('direct', 'call_off', 'rfq') then
    raise exception 'Okänd posttyp';
  end if;
  if v_title = '' then
    raise exception 'Titel saknas';
  end if;
  if p_buyer_id is not null then
    select * into v_buyer from public.procurement_buyers where id = p_buyer_id;
    if not found then
      raise exception 'Köparen finns inte';
    end if;
  end if;
  v_name := coalesce(v_buyer.name, nullif(btrim(coalesce(p_buyer_name, '')), ''));
  select coalesce(display_name, email) into v_actor from public.profiles where user_id = auth.uid();

  insert into public.procurement_notices (
    id, title, normalized_title, buyer_id, buyer_name, buyer_org_number, county_codes, county_names,
    published_at, tender_deadline, estimated_value, annual_value, value_currency,
    notice_kind, our_status, owner_id, match_score, match_reasons, notes, dedup_key, manual_type
  ) values (
    v_id,
    v_title,
    lower(regexp_replace(v_title, '[^[:alnum:]åäöéü ]+', ' ', 'g')),
    v_buyer.id,
    v_name,
    v_buyer.org_number,
    case when v_buyer.county_code is null then '{}'::text[] else array[v_buyer.county_code] end,
    case when v_buyer.county_name is null then '{}'::text[] else array[v_buyer.county_name] end,
    now(),
    case when p_deadline is null then null else ((p_deadline::text || ' 23:59')::timestamp at time zone 'Europe/Stockholm') end,
    p_value,
    p_value,
    'SEK',
    case when p_type = 'direct' then 'direct' else 'other' end,
    'analyzing',
    p_owner_id,
    0,
    '[]'::jsonb,
    nullif(btrim(coalesce(p_notes, '')), ''),
    -- Egen nyckel: synkens dedup (orgnr|titel|dag) kan aldrig träffa en egen post
    'manual:' || v_id::text,
    p_type
  );

  insert into public.procurement_notice_sources (notice_id, source, source_id, raw, fetched_at)
  values (v_id, 'manual', 'manual:' || v_id::text, jsonb_build_object('manual_type', p_type), now());

  insert into public.procurement_events (notice_id, event_type, title, detail, metadata, actor_id, actor_name)
  values (
    v_id, 'created',
    case p_type when 'direct' then 'Direktupphandling skapad' when 'call_off' then 'Avrop från ramavtal skapat' else 'Offertförfrågan skapad' end,
    v_name,
    jsonb_build_object('manual_type', p_type),
    auth.uid(), v_actor
  );

  return v_id;
end;
$$;

revoke all on function public.procurement_create_manual_notice(text, text, uuid, text, date, numeric, uuid, text) from public;
grant execute on function public.procurement_create_manual_notice(text, text, uuid, text, date, numeric, uuid, text) to authenticated;

-- Synkens reserv (trigramlikhet) ska aldrig slå ihop en annons med en egen post
create or replace function public.procurement_find_similar_notice(p_normalized_title text, p_buyer_id uuid, p_deadline timestamp with time zone, p_threshold real default 0.6)
returns table(id uuid, similarity real)
language sql
stable security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select n.id, extensions.similarity(n.normalized_title, p_normalized_title) as similarity
  from public.procurement_notices n
  where p_buyer_id is not null
    and n.buyer_id = p_buyer_id
    and n.manual_type is null
    and (
      (p_deadline is null and n.tender_deadline is null)
      or (p_deadline is not null and n.tender_deadline between p_deadline - interval '1 day' and p_deadline + interval '1 day')
    )
    and extensions.similarity(n.normalized_title, p_normalized_title) > p_threshold
  order by 2 desc
  limit 1;
$function$;

create or replace function public.procurement_find_similar_notice_any(p_normalized_title text, p_buyer_id uuid, p_threshold real default 0.6)
returns table(id uuid, similarity real)
language sql
stable security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select n.id, extensions.similarity(n.normalized_title, p_normalized_title) as similarity
  from public.procurement_notices n
  where p_buyer_id is not null
    and n.buyer_id = p_buyer_id
    and n.notice_kind <> 'award'
    and n.manual_type is null
    and extensions.similarity(n.normalized_title, p_normalized_title) > p_threshold
  order by 2 desc, n.published_at desc nulls last
  limit 1;
$function$;
