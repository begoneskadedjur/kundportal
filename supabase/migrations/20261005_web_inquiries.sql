-- 20261005_web_inquiries.sql
-- Leads (Webb): förfrågningar från formulären på begone.se i en egen pipeline,
-- skild från B2B-leadsen i tabellen leads. Plan: docs/begone-se/forfragningar-plan.md.
--
-- Skrivs av det publika API:t api/forfragan.ts med service role (ingen INSERT för
-- inloggade eller anon). Läses och ändras av admin, koordinator och säljare.
-- Inga DROP-satser: tabeller med if not exists, funktioner med create or replace.

-- ---------------------------------------------------------------------------
-- Rollkontroll: admin, koordinator eller säljare (huvudroll eller extra roll)

create or replace function public.is_web_inquiry_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_active, true)
      and (
        p.role::text in ('admin', 'koordinator', 'säljare')
        or p.extra_roles && array['admin', 'koordinator', 'säljare']::text[]
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- web_inquiries

create table if not exists public.web_inquiries (
  id uuid primary key default gen_random_uuid(),
  -- Numret som sajtens tack visar. Eget format, aldrig kopplat till ärendenummer eller artanalysen.
  referens text generated always as (upper(left(id::text, 8))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  kalla text not null default 'offertflode' check (kalla in ('offertflode', 'artanalys')),
  fran text,
  sida text,
  landing_url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,

  form_type text not null default 'offert' check (form_type in ('offert', 'akut')),
  akut boolean not null default false,
  customer_kind text not null default 'privat' check (customer_kind in ('privat', 'foretag')),
  kundgrupp text not null default 'privat' check (kundgrupp in ('privat', 'brf_fastighet', 'verksamhet')),

  name text not null,
  phone text not null,
  email text,
  company_name text,
  organization_number text,
  address text,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  city text,
  omrade_tackt boolean not null default false,
  pest_type text check (pest_type is null or char_length(pest_type) <= 60),
  message text check (message is null or char_length(message) <= 4000),
  details jsonb not null default '{}'::jsonb,
  bilder jsonb not null default '[]'::jsonb,

  consent boolean not null default false,
  consent_text_version text,
  privacy_notice_shown boolean not null default false,
  started_at timestamptz,
  submitted_at timestamptz,
  ip_hash text,
  user_agent text,

  status text not null default 'ny' check (status in ('ny', 'kontaktad', 'offert', 'vunnen', 'forlorad', 'skrap')),
  status_andrad_at timestamptz,
  forsta_kontakt_at timestamptz,
  tilldelad_till uuid references public.profiles(id) on delete set null,
  tilldelad_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  kvittens_skickad_at timestamptz
);

create unique index if not exists web_inquiries_referens_key on public.web_inquiries (referens);
create index if not exists web_inquiries_created_at_idx on public.web_inquiries (created_at desc);
create index if not exists web_inquiries_status_idx on public.web_inquiries (status);
create index if not exists web_inquiries_pest_type_idx on public.web_inquiries (pest_type);
create index if not exists web_inquiries_tilldelad_idx on public.web_inquiries (tilldelad_till);

comment on table public.web_inquiries is 'Leads (Webb): förfrågningar från begone.se. Skrivs bara av api/forfragan.ts (service role). Skild från B2B-tabellen leads.';
comment on column public.web_inquiries.referens is 'Numret i sajtens tack och kvittensmejl. Aldrig kopplat till ärendenummer eller artanalysen.';

-- ---------------------------------------------------------------------------
-- web_inquiry_events: anteckningar och historik

create table if not exists public.web_inquiry_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.web_inquiries(id) on delete cascade,
  typ text not null check (typ in ('anteckning', 'status', 'tilldelning', 'konvertering', 'bilder')),
  text text check (text is null or char_length(text) <= 4000),
  fran_varde text,
  till_varde text,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists web_inquiry_events_inquiry_idx on public.web_inquiry_events (inquiry_id, created_at);

-- ---------------------------------------------------------------------------
-- Trigger: tidsstämplar och historik vid status- och tilldelningsbyte

create or replace function public.web_inquiries_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_andrad_at := now();
    if old.status = 'ny' and new.forsta_kontakt_at is null then
      new.forsta_kontakt_at := now();
    end if;
  end if;
  if new.tilldelad_till is distinct from old.tilldelad_till then
    new.tilldelad_at := case when new.tilldelad_till is null then null else now() end;
  end if;
  return new;
end;
$$;

create or replace trigger web_inquiries_before_update
  before update on public.web_inquiries
  for each row execute function public.web_inquiries_before_update();

create or replace function public.web_inquiries_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid;
begin
  select p.id into v_profile from public.profiles p where p.user_id = auth.uid() limit 1;
  if new.status is distinct from old.status then
    insert into public.web_inquiry_events (inquiry_id, typ, fran_varde, till_varde, profile_id)
    values (new.id, 'status', old.status, new.status, v_profile);
  end if;
  if new.tilldelad_till is distinct from old.tilldelad_till then
    insert into public.web_inquiry_events (inquiry_id, typ, fran_varde, till_varde, profile_id)
    values (new.id, 'tilldelning', old.tilldelad_till::text, new.tilldelad_till::text, v_profile);
  end if;
  if new.lead_id is distinct from old.lead_id and new.lead_id is not null then
    insert into public.web_inquiry_events (inquiry_id, typ, text, till_varde, profile_id)
    values (new.id, 'konvertering', 'B2B-lead skapad', new.lead_id::text, v_profile);
  end if;
  return null;
end;
$$;

create or replace trigger web_inquiries_after_update
  after update on public.web_inquiries
  for each row execute function public.web_inquiries_after_update();

-- ---------------------------------------------------------------------------
-- RLS

alter table public.web_inquiries enable row level security;
alter table public.web_inquiry_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_inquiries' and policyname = 'web_inquiries_select_staff') then
    create policy web_inquiries_select_staff on public.web_inquiries
      for select to authenticated using (public.is_web_inquiry_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_inquiries' and policyname = 'web_inquiries_update_staff') then
    create policy web_inquiries_update_staff on public.web_inquiries
      for update to authenticated using (public.is_web_inquiry_staff()) with check (public.is_web_inquiry_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_inquiry_events' and policyname = 'web_inquiry_events_select_staff') then
    create policy web_inquiry_events_select_staff on public.web_inquiry_events
      for select to authenticated using (public.is_web_inquiry_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_inquiry_events' and policyname = 'web_inquiry_events_insert_staff') then
    create policy web_inquiry_events_insert_staff on public.web_inquiry_events
      for insert to authenticated with check (
        public.is_web_inquiry_staff()
        and typ = 'anteckning'
        and profile_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
      );
  end if;
end $$;

-- Ingen INSERT- eller DELETE-policy på web_inquiries och ingen UPDATE- eller DELETE-policy
-- på web_inquiry_events: RLS nekar allt sådant för anon och inloggade.

-- ---------------------------------------------------------------------------
-- Realtid

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'web_inquiries') then
    alter publication supabase_realtime add table public.web_inquiries;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Räknaren i sidomenyn: antal med status ny

create or replace function public.web_inquiries_new_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_web_inquiry_staff()
    then (select count(*)::int from public.web_inquiries where status = 'ny')
    else 0 end;
$$;

grant execute on function public.web_inquiries_new_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Bilder: privat bucket. Uppladdning bara via signerade URL:er från API:t.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('web-inquiry-images', 'web-inquiry-images', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'web_inquiry_images_select_staff') then
    create policy web_inquiry_images_select_staff on storage.objects
      for select to authenticated
      using (bucket_id = 'web-inquiry-images' and public.is_web_inquiry_staff());
  end if;
end $$;
