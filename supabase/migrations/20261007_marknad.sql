-- Marknad: behörigheten Marknadsansvarig, Google Ads-statistik i databasen och läs-RPC:er
-- för sidan /admin/leads-webb/marknad (även /koordinator och /saljare).
--
-- 1. profiles.can_view_marketing. Bara administratör (eller service role) får ändra flaggan,
--    inte koordinator. Skyddet ligger i guard_profile_privilege_columns().
-- 2. google_ads_kampanj_dag, google_ads_konvertering_dag, google_ads_sokterm_vecka. RLS på utan
--    policys: ingen läsning eller skrivning för anon/authenticated. Nattjobbet
--    api/cron/google-ads-statistik.ts skriver via google_ads_statistik_spara() (bara service role).
-- 3. marknad_oversikt, marknad_soktermer, marknad_leads, marknad_utfall, marknad_samtycke:
--    security definer, kräver can_view_marketing för auth.uid(), annars fel 42501.
--
-- Additivt: inga drop, inga ändrade kolumner.

-- ---------------------------------------------------------------------------
-- 1. Behörigheten

alter table public.profiles
  add column if not exists can_view_marketing boolean not null default false;

comment on column public.profiles.can_view_marketing is
  'Marknadsansvarig: åtkomst till sidan Marknad (Google Ads, webbförfrågningar, cookiesamtycke). Sätts av admin under Användarkonton (Personal).';

-- Administratör i strikt mening: service role, RLS-bypass (migrationer) eller is_admin.
-- Koordinator räcker inte (till skillnad från is_privileged_writer()).
create or replace function public.is_admin_writer()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    coalesce(auth.role(), '') = 'service_role'
    or (select rolbypassrls from pg_roles where rolname = session_user)
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    );
$$;

grant execute on function public.is_admin_writer() to authenticated;

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
  -- Marknadsansvarig: bara administratör, även när en koordinator annars får skriva
  if new.can_view_marketing is distinct from old.can_view_marketing and not public.is_admin_writer() then
    raise exception 'Behörighet saknas: endast administratör får ändra Marknadsansvarig'
      using errcode = '42501';
  end if;

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
  if new.can_view_marketing     is distinct from old.can_view_marketing     then v_changed := array_append(v_changed, 'can_view_marketing'); end if;
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

-- Egen profilrad får aldrig skapas med flaggan satt
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                 and policyname = 'profiles_insert_no_marketing_flag') then
    create policy profiles_insert_no_marketing_flag on public.profiles
      as restrictive for insert to authenticated
      with check (public.is_admin_writer() or coalesce(can_view_marketing, false) = false);
  end if;
end $$;

update public.profiles set can_view_marketing = true
where lower(email) = 'christian.karlsson@begone.se';

-- ---------------------------------------------------------------------------
-- 2. Google Ads-statistik

create table if not exists public.google_ads_kampanj_dag (
  datum date not null,
  customer_id text not null,
  campaign_id text not null,
  kampanjnamn text not null,
  status text,
  kanaltyp text,
  kostnad_sek numeric(14,2) not null default 0,
  visningar integer not null default 0,
  klick integer not null default 0,
  interaktioner integer not null default 0,
  konverteringar numeric(12,2) not null default 0,       -- primära (kolumnen Konverteringar i Ads)
  konverteringsvarde numeric(14,2) not null default 0,
  alla_konverteringar numeric(12,2) not null default 0,  -- inkl. sekundära
  sokvisningsandel numeric(6,4),                          -- bara sökkampanjer
  tappad_andel_budget numeric(6,4),
  tappad_andel_rank numeric(6,4),
  hamtad_at timestamptz not null default now(),
  primary key (datum, customer_id, campaign_id)
);

create table if not exists public.google_ads_konvertering_dag (
  datum date not null,                  -- klickets/interaktionens datum (Ads standard)
  customer_id text not null,
  campaign_id text not null,
  atgard_id text not null,
  konverteringsatgard text not null,
  kategori text,
  konverteringar numeric(12,2) not null default 0,
  konverteringsvarde numeric(14,2) not null default 0,
  alla_konverteringar numeric(12,2) not null default 0,
  alla_konverteringsvarde numeric(14,2) not null default 0,
  hamtad_at timestamptz not null default now(),
  primary key (datum, customer_id, campaign_id, atgard_id)
);

create table if not exists public.google_ads_sokterm_vecka (
  vecka date not null,                  -- måndagen
  customer_id text not null,
  campaign_id text not null,
  sokterm text not null,
  kostnad_sek numeric(14,2) not null default 0,
  visningar integer not null default 0,
  klick integer not null default 0,
  konverteringar numeric(12,2) not null default 0,
  hamtad_at timestamptz not null default now(),
  primary key (vecka, customer_id, campaign_id, sokterm)
);

create index if not exists google_ads_konvertering_dag_datum_idx on public.google_ads_konvertering_dag (datum);
create index if not exists google_ads_sokterm_vecka_vecka_idx on public.google_ads_sokterm_vecka (vecka);

alter table public.google_ads_kampanj_dag enable row level security;
alter table public.google_ads_konvertering_dag enable row level security;
alter table public.google_ads_sokterm_vecka enable row level security;
revoke all on public.google_ads_kampanj_dag from anon, authenticated;
revoke all on public.google_ads_konvertering_dag from anon, authenticated;
revoke all on public.google_ads_sokterm_vecka from anon, authenticated;

-- Ersätter fönstret [p_fran, p_till] för kontot: upsert av Googles rader, och rader i fönstret som
-- inte längre finns hos Google nollställs (ingen delete; MCP-migrationer med delete nekas).
-- Google justerar siffror bakåt (sena konverteringar räknas på klickdagen), därför skrivs hela fönstret om.
-- Söktermer upsertas för veckorna p_sok_fran (måndag) till p_till när p_sok inte är null.
create or replace function public.google_ads_statistik_spara(
  p_customer_id text,
  p_fran date,
  p_till date,
  p_kampanj jsonb,
  p_konv jsonb,
  p_sok jsonb default null,
  p_sok_fran date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_k int := 0; v_c int := 0; v_s int := 0;
begin
  if p_customer_id is null or p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltiga parametrar';
  end if;

  create temp table if not exists _ny_kampanj on commit drop as
    select * from public.google_ads_kampanj_dag limit 0;
  insert into _ny_kampanj
  select r.datum, p_customer_id, r.campaign_id, r.kampanjnamn, r.status, r.kanaltyp,
         coalesce(r.kostnad_sek, 0), coalesce(r.visningar, 0), coalesce(r.klick, 0), coalesce(r.interaktioner, 0),
         coalesce(r.konverteringar, 0), coalesce(r.konverteringsvarde, 0), coalesce(r.alla_konverteringar, 0),
         r.sokvisningsandel, r.tappad_andel_budget, r.tappad_andel_rank, now()
  from jsonb_populate_recordset(null::public.google_ads_kampanj_dag, coalesce(p_kampanj, '[]'::jsonb)) r
  where r.datum between p_fran and p_till;

  update public.google_ads_kampanj_dag g
     set kostnad_sek = 0, visningar = 0, klick = 0, interaktioner = 0, konverteringar = 0,
         konverteringsvarde = 0, alla_konverteringar = 0, sokvisningsandel = null,
         tappad_andel_budget = null, tappad_andel_rank = null, hamtad_at = now()
   where g.customer_id = p_customer_id and g.datum between p_fran and p_till
     and not exists (select 1 from _ny_kampanj n where n.datum = g.datum and n.campaign_id = g.campaign_id);

  insert into public.google_ads_kampanj_dag select * from _ny_kampanj
  on conflict (datum, customer_id, campaign_id) do update set
    kampanjnamn = excluded.kampanjnamn, status = excluded.status, kanaltyp = excluded.kanaltyp,
    kostnad_sek = excluded.kostnad_sek, visningar = excluded.visningar, klick = excluded.klick,
    interaktioner = excluded.interaktioner, konverteringar = excluded.konverteringar,
    konverteringsvarde = excluded.konverteringsvarde, alla_konverteringar = excluded.alla_konverteringar,
    sokvisningsandel = excluded.sokvisningsandel, tappad_andel_budget = excluded.tappad_andel_budget,
    tappad_andel_rank = excluded.tappad_andel_rank, hamtad_at = now();
  get diagnostics v_k = row_count;

  create temp table if not exists _ny_konv on commit drop as
    select * from public.google_ads_konvertering_dag limit 0;
  insert into _ny_konv
  select r.datum, p_customer_id, r.campaign_id, r.atgard_id, r.konverteringsatgard, r.kategori,
         coalesce(r.konverteringar, 0), coalesce(r.konverteringsvarde, 0),
         coalesce(r.alla_konverteringar, 0), coalesce(r.alla_konverteringsvarde, 0), now()
  from jsonb_populate_recordset(null::public.google_ads_konvertering_dag, coalesce(p_konv, '[]'::jsonb)) r
  where r.datum between p_fran and p_till;

  update public.google_ads_konvertering_dag g
     set konverteringar = 0, konverteringsvarde = 0, alla_konverteringar = 0, alla_konverteringsvarde = 0, hamtad_at = now()
   where g.customer_id = p_customer_id and g.datum between p_fran and p_till
     and not exists (select 1 from _ny_konv n where n.datum = g.datum and n.campaign_id = g.campaign_id and n.atgard_id = g.atgard_id);

  insert into public.google_ads_konvertering_dag select * from _ny_konv
  on conflict (datum, customer_id, campaign_id, atgard_id) do update set
    konverteringsatgard = excluded.konverteringsatgard, kategori = excluded.kategori,
    konverteringar = excluded.konverteringar, konverteringsvarde = excluded.konverteringsvarde,
    alla_konverteringar = excluded.alla_konverteringar, alla_konverteringsvarde = excluded.alla_konverteringsvarde,
    hamtad_at = now();
  get diagnostics v_c = row_count;

  if p_sok is not null then
    insert into public.google_ads_sokterm_vecka
    select r.vecka, p_customer_id, r.campaign_id, r.sokterm,
           coalesce(r.kostnad_sek, 0), coalesce(r.visningar, 0), coalesce(r.klick, 0), coalesce(r.konverteringar, 0), now()
    from jsonb_populate_recordset(null::public.google_ads_sokterm_vecka, p_sok) r
    where r.vecka between coalesce(p_sok_fran, p_fran) and p_till
    on conflict (vecka, customer_id, campaign_id, sokterm) do update
      set kostnad_sek = excluded.kostnad_sek, visningar = excluded.visningar,
          klick = excluded.klick, konverteringar = excluded.konverteringar, hamtad_at = now();
    get diagnostics v_s = row_count;
  end if;

  return jsonb_build_object('kampanj_dag', v_k, 'konvertering_dag', v_c, 'sokterm_vecka', v_s);
end;
$$;

revoke all on function public.google_ads_statistik_spara(text, date, date, jsonb, jsonb, jsonb, date) from public, anon, authenticated;
grant execute on function public.google_ads_statistik_spara(text, date, date, jsonb, jsonb, jsonb, date) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Hjälpfunktioner

create or replace function public.har_marknadsbehorighet()
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
      and p.can_view_marketing = true
  );
$$;

grant execute on function public.har_marknadsbehorighet() to authenticated;

-- Konverteringsåtgärdens namn till sidans typer
create or replace function public.google_ads_konv_typ(p_namn text, p_kategori text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when p_namn ilike 'bokat uppdrag%' then 'bokat'
    when p_namn ilike 'genomfört uppdrag%' or p_namn ilike 'genomfort uppdrag%' then 'genomfort'
    when p_namn ilike 'formulär%' then 'formular'
    when p_namn ilike 'calls from ads%' then 'samtal_annons'
    when p_namn ilike 'samtal från webbplats%' or p_namn ilike '%calls from website%' then 'samtal_webb'
    else 'ovrigt'
  end;
$$;

-- Webbförfrågans källa: google_ads, organiskt, direkt eller ovrigt
create or replace function public.web_inquiry_kalla_typ(
  p_gclid text, p_gbraid text, p_wbraid text, p_utm_source text, p_utm_medium text, p_landing_url text, p_referrer text
)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when coalesce(nullif(btrim(p_gclid), ''), nullif(btrim(p_gbraid), ''), nullif(btrim(p_wbraid), '')) is not null
      or (coalesce(p_utm_source, '') ilike 'google%' and lower(coalesce(p_utm_medium, '')) in ('cpc', 'ppc', 'paid', 'paidsearch', 'paid_search'))
      or coalesce(p_landing_url, '') ~* '[?&](gclid|gbraid|wbraid|gad_source)='
      or coalesce(p_referrer, '') ~* '^https?://([a-z0-9-]+\.)*(googlesyndication|doubleclick|googleadservices)\.'
      then 'google_ads'
    when lower(coalesce(p_utm_medium, '')) = 'organic'
      or coalesce(p_referrer, '') ~* '^https?://([a-z0-9-]+\.)*(google|bing|duckduckgo|yahoo|ecosia|yandex|startpage|qwant)\.[a-z.]+(/|$)'
      then 'organiskt'
    when nullif(btrim(coalesce(p_utm_source, '')), '') is null
      and (nullif(btrim(coalesce(p_referrer, '')), '') is null or p_referrer ~* '^https?://([a-z0-9-]+\.)*begone\.se(/|$)')
      then 'direkt'
    else 'ovrigt'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Läs-RPC:er för sidan Marknad

create or replace function public.marknad_oversikt(p_fran date, p_till date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  if not public.har_marknadsbehorighet() then
    raise exception 'Kräver behörigheten Marknadsansvarig' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran or p_till - p_fran > 800 then
    raise exception 'Ogiltig period';
  end if;

  with k as (
    select * from public.google_ads_kampanj_dag where datum between p_fran and p_till
  ),
  c as (
    select datum, campaign_id, public.google_ads_konv_typ(konverteringsatgard, kategori) as typ,
           sum(alla_konverteringar) as antal, sum(alla_konverteringsvarde) as varde
    from public.google_ads_konvertering_dag
    where datum between p_fran and p_till
    group by 1, 2, 3
  ),
  senaste as (
    select distinct on (campaign_id) campaign_id, kampanjnamn, status, kanaltyp
    from public.google_ads_kampanj_dag
    order by campaign_id, datum desc
  ),
  perk as (
    select k.campaign_id,
           sum(k.kostnad_sek) as kostnad, sum(k.visningar) as visningar, sum(k.klick) as klick,
           sum(k.interaktioner) as interaktioner, sum(k.konverteringar) as konverteringar,
           sum(k.konverteringsvarde) as konverteringsvarde,
           case when sum(k.visningar) filter (where k.sokvisningsandel > 0) > 0
                then round(sum(k.visningar) filter (where k.sokvisningsandel > 0)::numeric
                     / sum(k.visningar / k.sokvisningsandel) filter (where k.sokvisningsandel > 0), 4)
           end as sokvisningsandel
    from k group by k.campaign_id
  ),
  ctyp as (
    select campaign_id,
           sum(antal) filter (where typ = 'formular') as formular,
           sum(antal) filter (where typ = 'samtal_annons') as samtal_annons,
           sum(antal) filter (where typ = 'samtal_webb') as samtal_webb,
           sum(antal) filter (where typ = 'bokat') as bokat,
           sum(varde) filter (where typ = 'bokat') as bokat_varde,
           sum(antal) filter (where typ = 'genomfort') as genomfort,
           sum(varde) filter (where typ = 'genomfort') as genomfort_varde
    from c group by campaign_id
  ),
  dag_k as (
    select datum, sum(kostnad_sek) as kostnad, sum(klick) as klick, sum(visningar) as visningar,
           sum(konverteringar) as konverteringar
    from k group by datum
  ),
  dag_c as (
    select datum,
           sum(antal) filter (where typ = 'formular') as formular,
           sum(antal) filter (where typ in ('samtal_annons', 'samtal_webb')) as samtal
    from c group by datum
  )
  select jsonb_build_object(
    'totalt', (
      select jsonb_build_object(
        'kostnad', coalesce(sum(kostnad_sek), 0),
        'visningar', coalesce(sum(visningar), 0),
        'klick', coalesce(sum(klick), 0),
        'interaktioner', coalesce(sum(interaktioner), 0),
        'konverteringar', coalesce(sum(konverteringar), 0),
        'konverteringsvarde', coalesce(sum(konverteringsvarde), 0),
        'dagar_med_data', count(distinct datum)
      ) from k
    ),
    'konv_typer', coalesce((
      select jsonb_object_agg(typ, jsonb_build_object('antal', antal, 'varde', varde))
      from (select typ, sum(antal) as antal, sum(varde) as varde from c group by typ) x
    ), '{}'::jsonb),
    'per_kampanj', coalesce((
      select jsonb_agg(jsonb_build_object(
        'campaign_id', p.campaign_id, 'namn', s.kampanjnamn, 'status', s.status, 'kanaltyp', s.kanaltyp,
        'kostnad', p.kostnad, 'visningar', p.visningar, 'klick', p.klick, 'interaktioner', p.interaktioner,
        'konverteringar', p.konverteringar, 'konverteringsvarde', p.konverteringsvarde,
        'sokvisningsandel', p.sokvisningsandel,
        'formular', coalesce(t.formular, 0), 'samtal_annons', coalesce(t.samtal_annons, 0),
        'samtal_webb', coalesce(t.samtal_webb, 0),
        'bokat', coalesce(t.bokat, 0), 'bokat_varde', coalesce(t.bokat_varde, 0),
        'genomfort', coalesce(t.genomfort, 0), 'genomfort_varde', coalesce(t.genomfort_varde, 0)
      ) order by p.kostnad desc)
      from perk p
      join senaste s on s.campaign_id = p.campaign_id
      left join ctyp t on t.campaign_id = p.campaign_id
    ), '[]'::jsonb),
    'per_dag', (
      select jsonb_agg(jsonb_build_object(
        'datum', d::date,
        'kostnad', coalesce(dk.kostnad, 0), 'klick', coalesce(dk.klick, 0),
        'visningar', coalesce(dk.visningar, 0), 'konverteringar', coalesce(dk.konverteringar, 0),
        'formular', coalesce(dc.formular, 0), 'samtal', coalesce(dc.samtal, 0)
      ) order by d)
      from generate_series(p_fran::timestamp, p_till::timestamp, interval '1 day') d
      left join dag_k dk on dk.datum = d::date
      left join dag_c dc on dc.datum = d::date
    ),
    'data', (
      select jsonb_build_object('forsta_datum', min(datum), 'sista_datum', max(datum), 'hamtad_at', max(hamtad_at))
      from public.google_ads_kampanj_dag
    )
  ) into v;

  return v;
end;
$$;

create or replace function public.marknad_soktermer(p_fran date, p_till date, p_antal integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  if not public.har_marknadsbehorighet() then
    raise exception 'Kräver behörigheten Marknadsansvarig' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltig period';
  end if;

  with s as (
    select t.sokterm, sum(t.kostnad_sek) as kostnad, sum(t.visningar) as visningar, sum(t.klick) as klick,
           sum(t.konverteringar) as konverteringar,
           string_agg(distinct coalesce(n.kampanjnamn, t.campaign_id), ', ') as kampanjer
    from public.google_ads_sokterm_vecka t
    left join lateral (
      select kampanjnamn from public.google_ads_kampanj_dag kd
      where kd.campaign_id = t.campaign_id order by kd.datum desc limit 1
    ) n on true
    where t.vecka between date_trunc('week', p_fran)::date and p_till
    group by t.sokterm
  )
  select jsonb_build_object(
    'fran_vecka', date_trunc('week', p_fran)::date,
    'antal_termer', (select count(*) from s),
    'rader', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.kostnad desc)
      from (select * from s order by kostnad desc, klick desc limit greatest(1, least(coalesce(p_antal, 50), 500))) x
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.marknad_leads(p_fran date, p_till date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  if not public.har_marknadsbehorighet() then
    raise exception 'Kräver behörigheten Marknadsansvarig' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltig period';
  end if;

  with w as (
    select
      (w.created_at at time zone 'Europe/Stockholm')::date as dag,
      public.web_inquiry_kalla_typ(w.gclid, w.gbraid, w.wbraid, w.utm_source, w.utm_medium, w.landing_url, w.referrer) as kalla,
      case w.status
        when 'vunnen' then 'vunnen' when 'forlorad' then 'forlorad'
        when 'skrap' then 'skrap' when 'befintlig_kund' then 'befintlig_kund'
        else 'pagar' end as utfall,
      w.status,
      (w.details ->> 'samtycke_marknadsforing') = 'true' as samtycke,
      lower(coalesce(nullif(btrim(w.pest_type), ''), 'okänd')) as tjanst
    from public.web_inquiries w
    where (w.created_at at time zone 'Europe/Stockholm')::date between p_fran and p_till
  )
  select jsonb_build_object(
    'totalt', (select count(*) from w),
    'skrap', (select count(*) from w where utfall = 'skrap'),
    'samtycke', (select count(*) from w where samtycke),
    'samtycke_underlag', (select count(*) from w where utfall <> 'skrap'),
    'samtycke_ej_skrap', (select count(*) from w where samtycke and utfall <> 'skrap'),
    'per_kalla', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kalla', kalla, 'antal', antal, 'vunnen', vunnen, 'forlorad', forlorad, 'pagar', pagar,
        'skrap', skrap, 'befintlig_kund', befintlig, 'samtycke', samtycke) order by antal desc)
      from (
        select kalla, count(*) as antal,
               count(*) filter (where utfall = 'vunnen') as vunnen,
               count(*) filter (where utfall = 'forlorad') as forlorad,
               count(*) filter (where utfall = 'pagar') as pagar,
               count(*) filter (where utfall = 'skrap') as skrap,
               count(*) filter (where utfall = 'befintlig_kund') as befintlig,
               count(*) filter (where samtycke) as samtycke
        from w group by kalla
      ) x
    ), '[]'::jsonb),
    'per_tjanst', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tjanst', tjanst, 'antal', antal, 'google_ads', ads, 'vunnen', vunnen, 'forlorad', forlorad,
        'pagar', pagar, 'skrap', skrap) order by antal desc)
      from (
        select tjanst, count(*) as antal,
               count(*) filter (where kalla = 'google_ads') as ads,
               count(*) filter (where utfall = 'vunnen') as vunnen,
               count(*) filter (where utfall = 'forlorad') as forlorad,
               count(*) filter (where utfall = 'pagar') as pagar,
               count(*) filter (where utfall = 'skrap') as skrap
        from w group by tjanst
      ) x
    ), '[]'::jsonb),
    'per_status', coalesce((
      select jsonb_object_agg(status, antal) from (select status, count(*) as antal from w group by status) x
    ), '{}'::jsonb),
    'per_dag', (
      select jsonb_agg(jsonb_build_object(
        'datum', d::date,
        'google_ads', (select count(*) from w where w.dag = d::date and w.kalla = 'google_ads'),
        'ovriga', (select count(*) from w where w.dag = d::date and w.kalla <> 'google_ads')
      ) order by d)
      from generate_series(p_fran::timestamp, p_till::timestamp, interval '1 day') d
    )
  ) into v;
  return v;
end;
$$;

create or replace function public.marknad_utfall(p_fran date, p_till date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  if not public.har_marknadsbehorighet() then
    raise exception 'Kräver behörigheten Marknadsansvarig' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltig period';
  end if;

  -- Kohort: förfrågningar som kom in under perioden och vad de har blivit hittills.
  -- Samma definitioner som google_ads_konverteringar_urval(), men utan krav på samtycke.
  with w as (
    select w.*,
      public.web_inquiry_kalla_typ(w.gclid, w.gbraid, w.wbraid, w.utm_source, w.utm_medium, w.landing_url, w.referrer) as kalla_typ,
      c.status as offert_status, c.id as kontrakt_id
    from public.web_inquiries w
    left join public.contracts c on c.id = w.offert_contract_id
    where (w.created_at at time zone 'Europe/Stockholm')::date between p_fran and p_till
      and w.status not in ('skrap', 'befintlig_kund')
  ),
  r as (
    select w.kalla_typ as kalla,
      ((w.arende_id is not null and w.bokad_at is not null) or w.offert_status = 'signed') as bokat,
      coalesce(
        case when w.arende_id is not null and w.bokad_at is not null and w.arende_tabell in ('private_cases', 'business_cases')
             then public.google_ads_arendevarde(w.arende_tabell, w.arende_id) end,
        case when w.offert_status = 'signed' then public.google_ads_offertvarde(w.kontrakt_id) end
      ) as bokat_varde,
      (w.status = 'vunnen' and w.fakturerad_at is not null and w.arende_id is not null) as genomfort,
      case when w.status = 'vunnen' and w.fakturerad_at is not null and w.arende_id is not null
                and w.arende_tabell in ('private_cases', 'business_cases') then
        coalesce(
          nullif((select sum(i.subtotal) from public.invoices i
                  where i.case_id = w.arende_id
                    and i.case_type = case w.arende_tabell when 'private_cases' then 'private' else 'business' end
                    and i.status in ('booked', 'sent', 'paid', 'overdue')), 0),
          public.google_ads_arendevarde(w.arende_tabell, w.arende_id))
      end as genomfort_varde
    from w
  ),
  agg as (
    select g.grupp,
      count(*) as forfragningar,
      count(*) filter (where bokat) as bokat,
      coalesce(sum(bokat_varde) filter (where bokat), 0) as bokat_varde,
      count(*) filter (where genomfort) as genomfort,
      coalesce(sum(genomfort_varde) filter (where genomfort), 0) as genomfort_varde
    from r
    cross join lateral (values ('alla'::text), (case when r.kalla = 'google_ads' then 'google_ads' end)) g(grupp)
    where g.grupp is not null
    group by g.grupp
  )
  select jsonb_build_object(
    'alla', coalesce((select to_jsonb(a) - 'grupp' from agg a where grupp = 'alla'),
                     jsonb_build_object('forfragningar', 0, 'bokat', 0, 'bokat_varde', 0, 'genomfort', 0, 'genomfort_varde', 0)),
    'google_ads', coalesce((select to_jsonb(a) - 'grupp' from agg a where grupp = 'google_ads'),
                     jsonb_build_object('forfragningar', 0, 'bokat', 0, 'bokat_varde', 0, 'genomfort', 0, 'genomfort_varde', 0)),
    'uppladdning', coalesce((
      select jsonb_agg(jsonb_build_object('typ', typ, 'status', status, 'antal', antal, 'varde', varde, 'senast', senast))
      from (
        select k.typ, k.status, count(*) as antal, coalesce(sum(k.varde), 0) as varde, max(k.updated_at) as senast
        from public.google_ads_konverteringar k
        join public.web_inquiries w on w.id = k.inquiry_id
        where (w.created_at at time zone 'Europe/Stockholm')::date between p_fran and p_till
        group by k.typ, k.status
      ) x
    ), '[]'::jsonb),
    'uppladdning_totalt', (select count(*) from public.google_ads_konverteringar where status = 'uppladdad')
  ) into v;
  return v;
end;
$$;

create or replace function public.marknad_samtycke(p_fran date, p_till date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  if not public.har_marknadsbehorighet() then
    raise exception 'Kräver behörigheten Marknadsansvarig' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltig period';
  end if;

  with c as (
    select cc.*, (cc.created_at at time zone 'Europe/Stockholm')::date as dag
    from public.cookie_consents cc
    where (cc.created_at at time zone 'Europe/Stockholm')::date between p_fran and p_till
  )
  select jsonb_build_object(
    'totalt', (select count(*) from c),
    'godkant', (select count(*) from c where status = 'accepted'),
    'nekat', (select count(*) from c where status = 'rejected'),
    'delvis', (select count(*) from c where status = 'partial'),
    'unika', (select count(distinct samtyckes_id) from c),
    'forsta_loggen', (select min(created_at) from public.cookie_consents),
    'per_dag', (
      select jsonb_agg(jsonb_build_object(
        'datum', d::date,
        'godkant', (select count(*) from c where c.dag = d::date and c.status = 'accepted'),
        'nekat', (select count(*) from c where c.dag = d::date and c.status = 'rejected'),
        'delvis', (select count(*) from c where c.dag = d::date and c.status = 'partial')
      ) order by d)
      from generate_series(p_fran::timestamp, p_till::timestamp, interval '1 day') d
    ),
    'per_land', coalesce((
      select jsonb_agg(jsonb_build_object('land', land, 'antal', antal) order by antal desc)
      from (select coalesce(country, '??') as land, count(*) as antal from c group by 1) x
    ), '[]'::jsonb),
    'senaste', coalesce((
      select jsonb_agg(jsonb_build_object(
        'samtyckes_id', samtyckes_id, 'land', country, 'status', status, 'action', action,
        'handling', handling, 'lager', lager, 'statistik', statistik, 'marknadsforing', marknadsforing,
        'version', version, 'tid', created_at) order by created_at desc)
      from (select * from c order by created_at desc limit 50) x
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.marknad_oversikt(date, date) from public, anon;
revoke all on function public.marknad_soktermer(date, date, integer) from public, anon;
revoke all on function public.marknad_leads(date, date) from public, anon;
revoke all on function public.marknad_utfall(date, date) from public, anon;
revoke all on function public.marknad_samtycke(date, date) from public, anon;
grant execute on function public.marknad_oversikt(date, date) to authenticated;
grant execute on function public.marknad_soktermer(date, date, integer) to authenticated;
grant execute on function public.marknad_leads(date, date) to authenticated;
grant execute on function public.marknad_utfall(date, date) to authenticated;
grant execute on function public.marknad_samtycke(date, date) to authenticated;
