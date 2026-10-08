-- Marknad: retargeting. Besökslistornas storlek per dag och resultat per målgrupp (lista) per kampanj och dag,
-- så att sidan Marknad kan jämföra återkommande besökare (på listan) med övriga (kampanjen minus listan).
--
-- 1. google_ads_besokslista_dag: user_list per dag (storlek i sök och display, status). Ögonblicksbild
--    tagen av nattjobbet, datum = körningsdagen i svensk tid.
-- 2. google_ads_malgrupp_dag: campaign_audience_view per dag, kampanj och målgruppskriterium.
-- 3. google_ads_retargeting_spara(): skrivning, bara service role (nattjobbet api/cron/google-ads-statistik.ts).
--    Egen funktion i stället för fler parametrar på google_ads_statistik_spara(): en ny signatur skulle
--    skapa en överlagring bredvid den gamla (create or replace byter inte signatur, drop används inte).
-- 4. marknad_retargeting(p_fran, p_till): läs-RPC, kräver can_view_marketing.
--
-- Additivt: inga drop, inga ändrade kolumner.

create table if not exists public.google_ads_besokslista_dag (
  datum date not null,                       -- körningsdagen (Europe/Stockholm)
  customer_id text not null,
  user_list_id text not null,
  namn text not null,
  typ text,
  membership_status text,
  storlek_sok bigint,                        -- size_for_search (Google rundar och visar 0 under en gräns)
  storlek_display bigint,                    -- size_for_display
  storleksintervall_sok text,                -- size_range_for_search
  kan_visas_i_sok boolean,                   -- eligible_for_search
  hamtad_at timestamptz not null default now(),
  primary key (datum, customer_id, user_list_id)
);

create table if not exists public.google_ads_malgrupp_dag (
  datum date not null,
  customer_id text not null,
  campaign_id text not null,
  criterion_id text not null,
  user_list_id text,                         -- null för målgrupper som inte är listor
  malgrupp text,                             -- kriteriets visningsnamn
  bud_justering numeric(8,4),                -- campaign_criterion.bid_modifier (null = ingen)
  visningar integer not null default 0,
  klick integer not null default 0,
  kostnad_sek numeric(14,2) not null default 0,
  konverteringar numeric(12,2) not null default 0,
  konverteringsvarde numeric(14,2) not null default 0,
  alla_konverteringar numeric(12,2) not null default 0,
  alla_konverteringsvarde numeric(14,2) not null default 0,
  hamtad_at timestamptz not null default now(),
  primary key (datum, customer_id, campaign_id, criterion_id)
);

create index if not exists google_ads_malgrupp_dag_lista_idx on public.google_ads_malgrupp_dag (user_list_id, datum);

alter table public.google_ads_besokslista_dag enable row level security;
alter table public.google_ads_malgrupp_dag enable row level security;
revoke all on public.google_ads_besokslista_dag from anon, authenticated;
revoke all on public.google_ads_malgrupp_dag from anon, authenticated;

-- Listorna upsertas för p_lista_datum. Målgruppsraderna ersätter fönstret [p_fran, p_till] på samma sätt
-- som google_ads_statistik_spara(): upsert, och rader i fönstret som Google inte längre returnerar nollställs.
create or replace function public.google_ads_retargeting_spara(
  p_customer_id text,
  p_fran date,
  p_till date,
  p_lista_datum date,
  p_listor jsonb,
  p_malgrupp jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_l int := 0; v_m int := 0;
begin
  if p_customer_id is null or p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltiga parametrar';
  end if;

  if p_lista_datum is not null and p_listor is not null then
    insert into public.google_ads_besokslista_dag
    select p_lista_datum, p_customer_id, r.user_list_id, r.namn, r.typ, r.membership_status,
           r.storlek_sok, r.storlek_display, r.storleksintervall_sok, r.kan_visas_i_sok, now()
    from jsonb_populate_recordset(null::public.google_ads_besokslista_dag, p_listor) r
    where r.user_list_id is not null and r.namn is not null
    on conflict (datum, customer_id, user_list_id) do update set
      namn = excluded.namn, typ = excluded.typ, membership_status = excluded.membership_status,
      storlek_sok = excluded.storlek_sok, storlek_display = excluded.storlek_display,
      storleksintervall_sok = excluded.storleksintervall_sok, kan_visas_i_sok = excluded.kan_visas_i_sok,
      hamtad_at = now();
    get diagnostics v_l = row_count;
  end if;

  if p_malgrupp is not null then
    create temp table if not exists _ny_malgrupp on commit drop as
      select * from public.google_ads_malgrupp_dag limit 0;
    insert into _ny_malgrupp
    select r.datum, p_customer_id, r.campaign_id, r.criterion_id, r.user_list_id, r.malgrupp, r.bud_justering,
           coalesce(r.visningar, 0), coalesce(r.klick, 0), coalesce(r.kostnad_sek, 0),
           coalesce(r.konverteringar, 0), coalesce(r.konverteringsvarde, 0),
           coalesce(r.alla_konverteringar, 0), coalesce(r.alla_konverteringsvarde, 0), now()
    from jsonb_populate_recordset(null::public.google_ads_malgrupp_dag, p_malgrupp) r
    where r.datum between p_fran and p_till and r.campaign_id is not null and r.criterion_id is not null;

    update public.google_ads_malgrupp_dag g
       set visningar = 0, klick = 0, kostnad_sek = 0, konverteringar = 0, konverteringsvarde = 0,
           alla_konverteringar = 0, alla_konverteringsvarde = 0, hamtad_at = now()
     where g.customer_id = p_customer_id and g.datum between p_fran and p_till
       and not exists (select 1 from _ny_malgrupp n
                       where n.datum = g.datum and n.campaign_id = g.campaign_id and n.criterion_id = g.criterion_id);

    insert into public.google_ads_malgrupp_dag select * from _ny_malgrupp
    on conflict (datum, customer_id, campaign_id, criterion_id) do update set
      user_list_id = excluded.user_list_id, malgrupp = excluded.malgrupp, bud_justering = excluded.bud_justering,
      visningar = excluded.visningar, klick = excluded.klick, kostnad_sek = excluded.kostnad_sek,
      konverteringar = excluded.konverteringar, konverteringsvarde = excluded.konverteringsvarde,
      alla_konverteringar = excluded.alla_konverteringar, alla_konverteringsvarde = excluded.alla_konverteringsvarde,
      hamtad_at = now();
    get diagnostics v_m = row_count;
  end if;

  return jsonb_build_object('besokslista_dag', v_l, 'malgrupp_dag', v_m);
end;
$$;

revoke all on function public.google_ads_retargeting_spara(text, date, date, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.google_ads_retargeting_spara(text, date, date, date, jsonb, jsonb) to service_role;

-- Läs-RPC för sektionen Retargeting.
--
-- listor: varje "Christian | Besökare"-lista med senaste storlek, storleken vid periodens början och
--   en trend per dag i perioden.
-- jamforelse: per kampanj och lista i perioden. "lista" = målgruppsraden (besökare på listan),
--   "ovriga" = kampanjens totaler minus listan, räknat från första dagen listan hade data i kampanjen
--   (dagar före kopplingen räknas inte in i övriga). Konverteringar = primära (kolumnen Konverteringar).
create or replace function public.marknad_retargeting(p_fran date, p_till date)
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

  with lista_senaste as (
    select distinct on (user_list_id) user_list_id, namn, typ, membership_status, datum,
           storlek_sok, storlek_display, storleksintervall_sok, kan_visas_i_sok
    from public.google_ads_besokslista_dag
    where namn like 'Christian | Besökare%'
    order by user_list_id, datum desc
  ),
  lista_start as (
    select distinct on (user_list_id) user_list_id, datum, storlek_sok, storlek_display
    from public.google_ads_besokslista_dag
    where namn like 'Christian | Besökare%' and datum >= p_fran
    order by user_list_id, datum asc
  ),
  koppling as (
    -- första dagen kriteriet har data i kampanjen (oavsett period)
    select campaign_id, criterion_id, min(datum) as forsta
    from public.google_ads_malgrupp_dag
    group by 1, 2
  ),
  m as (
    select g.campaign_id, g.criterion_id, max(g.user_list_id) as user_list_id, max(g.malgrupp) as malgrupp,
           max(g.bud_justering) as bud_justering,
           greatest(p_fran, k.forsta) as fran,
           sum(g.visningar) as visningar, sum(g.klick) as klick, sum(g.kostnad_sek) as kostnad,
           sum(g.konverteringar) as konverteringar, sum(g.konverteringsvarde) as konverteringsvarde
    from public.google_ads_malgrupp_dag g
    join koppling k on k.campaign_id = g.campaign_id and k.criterion_id = g.criterion_id
    where g.datum between p_fran and p_till
    group by g.campaign_id, g.criterion_id, k.forsta
  ),
  j as (
    select m.*, coalesce(ls.namn, m.malgrupp, m.criterion_id) as listnamn,
           kn.kampanjnamn, kn.status as kampanjstatus,
           t.visningar as t_visningar, t.klick as t_klick, t.kostnad as t_kostnad,
           t.konverteringar as t_konverteringar, t.konverteringsvarde as t_konverteringsvarde
    from m
    left join lista_senaste ls on ls.user_list_id = m.user_list_id
    left join lateral (
      select kampanjnamn, status from public.google_ads_kampanj_dag kd
      where kd.campaign_id = m.campaign_id order by kd.datum desc limit 1
    ) kn on true
    left join lateral (
      select coalesce(sum(kd.visningar), 0) as visningar, coalesce(sum(kd.klick), 0) as klick,
             coalesce(sum(kd.kostnad_sek), 0) as kostnad, coalesce(sum(kd.konverteringar), 0) as konverteringar,
             coalesce(sum(kd.konverteringsvarde), 0) as konverteringsvarde
      from public.google_ads_kampanj_dag kd
      where kd.campaign_id = m.campaign_id and kd.datum between m.fran and p_till
    ) t on true
  )
  select jsonb_build_object(
    'listor', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_list_id', ls.user_list_id, 'namn', ls.namn, 'typ', ls.typ, 'status', ls.membership_status,
        'datum', ls.datum, 'storlek_sok', ls.storlek_sok, 'storlek_display', ls.storlek_display,
        'storleksintervall_sok', ls.storleksintervall_sok, 'kan_visas_i_sok', ls.kan_visas_i_sok,
        'start_datum', st.datum, 'start_storlek_sok', st.storlek_sok, 'start_storlek_display', st.storlek_display,
        'trend', coalesce((
          select jsonb_agg(jsonb_build_object('datum', d.datum, 'sok', d.storlek_sok, 'display', d.storlek_display) order by d.datum)
          from public.google_ads_besokslista_dag d
          where d.user_list_id = ls.user_list_id and d.datum between p_fran and greatest(p_till, ls.datum)
        ), '[]'::jsonb)
      ) order by ls.namn)
      from lista_senaste ls
      left join lista_start st on st.user_list_id = ls.user_list_id
    ), '[]'::jsonb),
    'jamforelse', coalesce((
      select jsonb_agg(jsonb_build_object(
        'campaign_id', j.campaign_id, 'kampanj', coalesce(j.kampanjnamn, j.campaign_id), 'kampanjstatus', j.kampanjstatus,
        'criterion_id', j.criterion_id, 'user_list_id', j.user_list_id, 'lista', j.listnamn,
        'bud_justering', j.bud_justering, 'fran', j.fran,
        'lista_varden', jsonb_build_object(
          'visningar', j.visningar, 'klick', j.klick, 'kostnad', j.kostnad,
          'konverteringar', j.konverteringar, 'konverteringsvarde', j.konverteringsvarde),
        'ovriga', jsonb_build_object(
          'visningar', greatest(j.t_visningar - j.visningar, 0), 'klick', greatest(j.t_klick - j.klick, 0),
          'kostnad', greatest(j.t_kostnad - j.kostnad, 0),
          'konverteringar', greatest(j.t_konverteringar - j.konverteringar, 0),
          'konverteringsvarde', greatest(j.t_konverteringsvarde - j.konverteringsvarde, 0))
      ) order by j.kampanjnamn, j.listnamn)
      from j
      where j.listnamn like 'Christian | Besökare%'
    ), '[]'::jsonb),
    'data', (
      select jsonb_build_object(
        'listor_hamtad_at', (select max(hamtad_at) from public.google_ads_besokslista_dag),
        'malgrupp_forsta_datum', (select min(datum) from public.google_ads_malgrupp_dag),
        'malgrupp_hamtad_at', (select max(hamtad_at) from public.google_ads_malgrupp_dag)
      )
    )
  ) into v;

  return v;
end;
$$;

revoke all on function public.marknad_retargeting(date, date) from public, anon;
grant execute on function public.marknad_retargeting(date, date) to authenticated;
