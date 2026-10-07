-- Leads (Webb), fliken Statistik: all aggregering i databasen.
--
-- Varför en RPC: sidan hämtar förfrågningarna med select * och limit 2000 (inkorgen). Statistiken
-- räknades tidigare i klienten på samma lista, vilket blir fel när det finns fler än 2000 rader och
-- tungt långt innan dess. Funktionen läser bara perioden (index på created_at), aggregerar i ett
-- svep och skickar några hundra grupprader oavsett om perioden har 7 eller 10 000 förfrågningar.
--
-- Rättighet: security definer med samma kontroll som RLS-policyn web_inquiries_select_staff
-- (is_web_inquiry_staff: admin, koordinator, säljare). Definer behövs för värdet på vunna affärer,
-- som räknas med google_ads_arendevarde() (fakturaunderlaget i case_billing_items m.fl.), vilken
-- inte är öppen för authenticated.
--
-- Klassning av kanal (Google Ads, organiskt, AI ...) görs i klienten med samma kod som tabellen
-- (leadKlassning.kanalFor). Här grupperas bara på de fält klassningen läser (klick-id, utm_source,
-- utm_medium, annons-id i adressen, referrerns domän) så att det blir få grupper.
--
-- Utdata: { totalt, skrap, befintliga, rader: [{g, k, b, n, akuta, kontaktade, samma_dag, bokade,
-- vunna, forl_efter, forl_utan, pagaende, varde, svarstid_median}] } där g är gruppen
-- (totalt, tjanst, kundgrupp, kalla, kanal, kampanj, sokord, sida, ort, vecka, heat, matris,
-- tid_alla, tid_kundgrupp, tid_kanal), k nyckeln och b periodens start (bara tid_*).
-- Bara nyförsäljning räknas: status skräp och befintlig kund ligger utanför (antalen anges för sig).

create or replace function public.web_inquiry_statistik(p_fran date, p_till date, p_gran text default 'dag')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
  v_start timestamptz;
  v_slut timestamptz;
begin
  if not public.is_web_inquiry_staff() then
    raise exception 'Saknar behörighet till webbförfrågningar' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltig period';
  end if;
  if p_gran not in ('dag', 'vecka', 'manad') then
    raise exception 'Ogiltig granularitet';
  end if;

  -- Periodens gränser i svensk tid, så att indexet på created_at används
  v_start := p_fran::timestamp at time zone 'Europe/Stockholm';
  v_slut := (p_till + 1)::timestamp at time zone 'Europe/Stockholm';

  with bas as (
    select w.*, (w.created_at at time zone 'Europe/Stockholm') as lokal
    from public.web_inquiries w
    where w.created_at >= v_start and w.created_at < v_slut
  ),
  w as (
    select b.*,
      case p_gran
        when 'dag' then b.lokal::date
        when 'vecka' then date_trunc('week', b.lokal)::date
        else date_trunc('month', b.lokal)::date
      end as hink,
      (b.forsta_kontakt_at is not null or b.bokad_at is not null) as ar_kontaktad,
      (b.forsta_kontakt_at is not null
        and (b.forsta_kontakt_at at time zone 'Europe/Stockholm')::date = b.lokal::date) as ar_samma_dag,
      case when b.forsta_kontakt_at >= b.created_at
        then extract(epoch from b.forsta_kontakt_at - b.created_at) / 60.0 end as svarstid,
      case when b.status = 'vunnen' and b.arende_id is not null and b.arende_tabell in ('private_cases', 'business_cases')
        then public.google_ads_arendevarde(b.arende_tabell, b.arende_id) end as varde,
      jsonb_build_array(
        (b.gclid is not null or b.gbraid is not null or b.wbraid is not null),
        coalesce(b.utm_source, ''),
        coalesce(b.utm_medium, ''),
        lower(coalesce(b.landing_url, '') || ' ' || coalesce(b.referrer, '')) ~ '[?&](gclid|gbraid|wbraid|gad_source)=',
        coalesce(regexp_replace(lower(substring(b.referrer from '^[A-Za-z][A-Za-z0-9+.-]*://([^/:?#]+)')), '^www\.', ''), '')
      )::text as kanalnyckel,
      initcap(lower(coalesce(nullif(trim(b.rattad_ort), ''), nullif(trim(b.city), '')))) as ort
    from bas b
    where b.status not in ('skrap', 'befintlig_kund')
  ),
  u as (
    select w.*, d.g, d.k, d.b
    from w
    cross join lateral (values
      ('totalt', '', null::date),
      ('tjanst', coalesce(w.pest_type, ''), null),
      ('kundgrupp', w.kundgrupp::text, null),
      ('kalla', w.kalla::text || '|' || coalesce(w.fran, ''), null),
      ('kanal', w.kanalnyckel, null),
      ('kampanj', coalesce(nullif(w.utm_campaign, ''),
         case when w.gclid is not null or w.gbraid is not null or w.wbraid is not null
           then 'Google Ads, okänd kampanj' else 'Ingen kampanj' end), null),
      ('sokord', coalesce(nullif(w.utm_term, ''), 'Inget sökord'), null),
      ('sida', coalesce(nullif(w.sida, ''), 'Okänd'), null),
      ('ort', coalesce(w.ort, ''), null),
      ('vecka', to_char(w.lokal, 'IYYY-"v"IW'), null),
      ('heat', extract(isodow from w.lokal)::int::text || '-' || extract(hour from w.lokal)::int::text, null),
      ('matris', case when w.bokad_tjanst is not null then coalesce(w.pest_type, '') || '|' || w.bokad_tjanst end, null),
      ('tid_alla', '', w.hink),
      ('tid_kundgrupp', w.kundgrupp::text, w.hink),
      ('tid_kanal', w.kanalnyckel, w.hink)
    ) d(g, k, b)
    where d.k is not null
  ),
  agg as (
    select g, k, b,
      count(*) as n,
      count(*) filter (where akut) as akuta,
      count(*) filter (where ar_kontaktad) as kontaktade,
      count(*) filter (where ar_samma_dag) as samma_dag,
      count(*) filter (where bokad_at is not null) as bokade,
      count(*) filter (where status = 'vunnen') as vunna,
      count(*) filter (where status = 'forlorad' and bokad_at is not null) as forl_efter,
      count(*) filter (where status = 'forlorad' and bokad_at is null) as forl_utan,
      count(*) filter (where status = 'bokad') as pagaende,
      coalesce(sum(varde), 0) as varde,
      count(varde) as med_varde,
      percentile_cont(0.5) within group (order by svarstid) as svarstid_median
    from u
    group by g, k, b
  )
  select jsonb_build_object(
    'fran', p_fran,
    'till', p_till,
    'gran', p_gran,
    'skrap', (select count(*) from bas where status = 'skrap'),
    'befintliga', (select count(*) from bas where status = 'befintlig_kund'),
    'rader', coalesce((select jsonb_agg(to_jsonb(a)) from agg a), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

revoke all on function public.web_inquiry_statistik(date, date, text) from public, anon;
grant execute on function public.web_inquiry_statistik(date, date, text) to authenticated;

comment on function public.web_inquiry_statistik(date, date, text) is
  'Leads (Webb), fliken Statistik: aggregat för nyförsäljningen under perioden (svensk tid). Kräver is_web_inquiry_staff().';
