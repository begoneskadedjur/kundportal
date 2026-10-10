-- Leads etapp 6 (2026-10-10): statistik som RPC. Sammanfattning: docs/leads/ETAPP-6-7.md.
-- Inget raderas och inga DROP (create or replace).
--
-- lead_statistik(p_fran, p_till, p_agare) räknar allt i databasen och returnerar jsonb.
-- Behörighet: admin och koordinator (is_lead_admin) ser alla leads. Övriga anställda
-- (is_lead_staff: säljare, tekniker) får statistik över de leads de själva ser enligt RLS,
-- det vill säga där de är ägare, tipsare eller delad medlem. Kunder och okända nekas.
--
-- Perioden gäller i svensk tid (Europe/Stockholm). Pipeline och hygien är läget just nu
-- (inte periodberoende). Skapade, kedjan och tips räknas på leads skapade i perioden; vunna,
-- förlorade, vinstgrad och vunnen årspremie på won_at/lost_at i perioden; tid i steg på
-- stegbyten som skedde i perioden.
--
-- Vunnen årspremie = avtalets annual_value (agreement_contract_id) om den finns, annars
-- leads.estimated_value. Pipeline = estimated_value.

-- Datum n arbetsdagar (måndag till fredag) efter p_dag. Helgdagar räknas inte bort.
create or replace function public.lead_arbetsdagar_fram(p_dag date, p_antal integer)
returns date
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  d date := p_dag;
  kvar integer := greatest(p_antal, 0);
begin
  while kvar > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 then
      kvar := kvar - 1;
    end if;
  end loop;
  return d;
end;
$function$;

-- Hur långt en lead har kommit: 0 ny, 1 kontaktad, 2 besök bokat, 3 offert skickad, 4 vunnen.
create or replace function public.lead_steg_rang(p_steg text)
returns integer
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select case p_steg
    when 'ny' then 0
    when 'kontaktad' then 1
    when 'besok_bokat' then 2
    when 'offert_skickad' then 3
    when 'vunnen' then 4
    else null
  end;
$function$;

create or replace function public.lead_statistik(p_fran date, p_till date, p_agare uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_admin boolean := public.is_lead_admin();
  v_me uuid := public.my_profile_id();
  v_start timestamptz;
  v_slut timestamptz;
  v_nu timestamptz := now();
  v_idag date := (now() at time zone 'Europe/Stockholm')::date;
  v jsonb;
begin
  if not v_admin and not public.is_lead_staff() then
    raise exception 'Saknar behörighet till leads' using errcode = '42501';
  end if;
  if p_fran is null or p_till is null or p_till < p_fran then
    raise exception 'Ogiltig period';
  end if;

  v_start := p_fran::timestamp at time zone 'Europe/Stockholm';
  v_slut := (p_till + 1)::timestamp at time zone 'Europe/Stockholm';

  with
  bas as (
    select l.*,
      coalesce(c.annual_value, l.estimated_value, 0)::numeric as vunnen_premie
    from public.leads l
    left join public.contracts c on c.id = l.agreement_contract_id
    where (p_agare is null or l.owner_profile_id = p_agare)
      and (v_admin
        or l.owner_profile_id = v_me
        or l.tipped_by_profile_id = v_me
        or exists (select 1 from public.lead_members m
                   where m.lead_id = l.id and m.profile_id = v_me and m.removed_at is null))
  ),
  namn as (
    select p.id, coalesce(nullif(trim(p.display_name), ''), p.email, 'Okänd') as namn, p.role::text as roll
    from public.profiles p
  ),
  -- Stegbyten ur historiken: stage, forlorad och parkerad (bara när fran är ett steg)
  byten as (
    select a.lead_id, a.occurred_at as vid, a.fran_varde as fran,
      case a.kind when 'stage' then a.till_varde when 'forlorad' then 'forlorad' else 'parkerad' end as till
    from public.lead_activities a
    join bas b on b.id = a.lead_id
    where a.kind in ('stage', 'forlorad', 'parkerad')
      and a.fran_varde in ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'vunnen', 'forlorad', 'parkerad')
  ),
  -- Längsta steg en lead nått: nuvarande steg, historiken och kopplingarna
  rang as (
    select b.id,
      greatest(
        coalesce(public.lead_steg_rang(b.stage::text), 0),
        coalesce((select max(greatest(coalesce(public.lead_steg_rang(x.fran), 0), coalesce(public.lead_steg_rang(x.till), 0)))
                  from byten x where x.lead_id = b.id), 0),
        case when exists (select 1 from public.lead_activities a
                          where a.lead_id = b.id and a.kind in ('samtal', 'mejl', 'mote')) then 1 else 0 end,
        case when b.booked_case_id is not null then 2 else 0 end,
        case when b.offer_contract_id is not null then 3 else 0 end,
        case when b.won_at is not null or b.stage = 'vunnen' then 4 else 0 end
      ) as nadd
    from bas b
  ),
  skapade as (
    select b.*, r.nadd,
      coalesce(b.source::text, 'ovrigt') as kalla,
      coalesce(b.origin_case_type, case when b.web_inquiry_id is not null then 'web_inquiries' end, 'inget') as ursprung
    from bas b join rang r on r.id = b.id
    where b.created_at >= v_start and b.created_at < v_slut
  ),
  oppna as (
    select * from bas where stage in ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad')
  ),
  -- Första kontakt: samtal, mejl eller möte, eller steg från Ny till kontaktad eller längre
  forsta_kontakt as (
    select s.id,
      least(
        (select min(a.occurred_at) from public.lead_activities a
          where a.lead_id = s.id and a.kind in ('samtal', 'mejl', 'mote')),
        (select min(x.vid) from byten x
          where x.lead_id = s.id and x.fran = 'ny' and x.till in ('kontaktad', 'besok_bokat', 'offert_skickad', 'vunnen'))
      ) as kontakt_at,
      public.lead_arbetsdagar_fram((s.created_at at time zone 'Europe/Stockholm')::date, 2) as senast
    from skapade s
  ),
  kontakt as (
    select s.owner_profile_id, f.*,
      case
        when f.kontakt_at is not null and (f.kontakt_at at time zone 'Europe/Stockholm')::date <= f.senast then 'inom'
        when f.kontakt_at is not null then 'sen'
        -- Kontaktad enligt steget men utan tidpunkt i historiken (migrerade leads): räknas inte
        when s.nadd >= 1 then 'okand'
        when v_idag > f.senast then 'ej'
        else 'vantar'
      end as utfall
    from forsta_kontakt f join skapade s on s.id = f.id
  ),
  -- Tid i steg: tiden mellan att leaden kom in i ett steg och lämnade det
  ben as (
    select x.lead_id, x.fran as steg, x.vid as ut,
      coalesce(lag(x.vid) over (partition by x.lead_id order by x.vid), b.created_at) as in_at
    from byten x join bas b on b.id = x.lead_id
  ),
  manader as (
    select to_char(m, 'YYYY-MM') as manad
    from generate_series(date_trunc('month', p_fran::timestamp), date_trunc('month', p_till::timestamp), interval '1 month') m
  )
  select jsonb_build_object(
    'behorighet', case when v_admin then 'alla' else 'egna' end,
    'fran', p_fran,
    'till', p_till,

    'summa', jsonb_build_object(
      'skapade', (select count(*) from skapade),
      'tips', (select count(*) from skapade where tipped_by_profile_id is not null),
      'vunna', (select count(*) from bas where won_at >= v_start and won_at < v_slut),
      'forlorade', (select count(*) from bas where lost_at >= v_start and lost_at < v_slut),
      'vunnen_premie', (select coalesce(sum(vunnen_premie), 0) from bas where won_at >= v_start and won_at < v_slut),
      'vunnen_nytt', (select coalesce(sum(vunnen_premie), 0) from bas where won_at >= v_start and won_at < v_slut and lead_type is distinct from 'utokning'),
      'vunnen_utokning', (select coalesce(sum(vunnen_premie), 0) from bas where won_at >= v_start and won_at < v_slut and lead_type = 'utokning'),
      'oppna', (select count(*) from oppna),
      'pipeline', (select coalesce(sum(estimated_value), 0) from oppna),
      'parkerade', (select count(*) from bas where stage = 'parkerad'),
      'ledtid_vunnen_median', (select percentile_cont(0.5) within group (order by extract(epoch from (won_at - created_at)) / 86400.0)
                               from bas where won_at >= v_start and won_at < v_slut and won_at >= created_at),
      'ledtid_vunnen_antal', (select count(*) from bas where won_at >= v_start and won_at < v_slut and won_at >= created_at)
    ),

    'pipeline_steg', (
      select coalesce(jsonb_agg(jsonb_build_object('steg', s.steg, 'antal', coalesce(t.antal, 0), 'varde', coalesce(t.varde, 0)) order by s.ord), '[]'::jsonb)
      from (values ('ny', 1), ('kontaktad', 2), ('besok_bokat', 3), ('offert_skickad', 4), ('parkerad', 5)) s(steg, ord)
      left join (select stage::text as steg, count(*) as antal, coalesce(sum(estimated_value), 0) as varde
                 from bas where stage in ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'parkerad') group by 1) t on t.steg = s.steg
    ),

    'pipeline_agare', (
      select coalesce(jsonb_agg(r order by (r->>'varde')::numeric desc, (r->>'antal')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'profile_id', o.owner_profile_id,
          'namn', coalesce(n.namn, 'Ingen ägare'),
          'antal', count(*),
          'varde', coalesce(sum(o.estimated_value), 0),
          'ny', count(*) filter (where o.stage = 'ny'),
          'kontaktad', count(*) filter (where o.stage = 'kontaktad'),
          'besok_bokat', count(*) filter (where o.stage = 'besok_bokat'),
          'offert_skickad', count(*) filter (where o.stage = 'offert_skickad'),
          'varde_offert', coalesce(sum(o.estimated_value) filter (where o.stage = 'offert_skickad'), 0)
        ) as r
        from oppna o left join namn n on n.id = o.owner_profile_id
        group by o.owner_profile_id, n.namn
      ) x
    ),

    'manader', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'manad', m.manad,
        'skapade', (select count(*) from skapade s where to_char(s.created_at at time zone 'Europe/Stockholm', 'YYYY-MM') = m.manad),
        'tips', (select count(*) from skapade s where s.tipped_by_profile_id is not null and to_char(s.created_at at time zone 'Europe/Stockholm', 'YYYY-MM') = m.manad),
        'vunna', (select count(*) from bas b where b.won_at >= v_start and b.won_at < v_slut and to_char(b.won_at at time zone 'Europe/Stockholm', 'YYYY-MM') = m.manad),
        'forlorade', (select count(*) from bas b where b.lost_at >= v_start and b.lost_at < v_slut and to_char(b.lost_at at time zone 'Europe/Stockholm', 'YYYY-MM') = m.manad),
        'vunnen_nytt', (select coalesce(sum(b.vunnen_premie), 0) from bas b where b.won_at >= v_start and b.won_at < v_slut and b.lead_type is distinct from 'utokning' and to_char(b.won_at at time zone 'Europe/Stockholm', 'YYYY-MM') = m.manad),
        'vunnen_utokning', (select coalesce(sum(b.vunnen_premie), 0) from bas b where b.won_at >= v_start and b.won_at < v_slut and b.lead_type = 'utokning' and to_char(b.won_at at time zone 'Europe/Stockholm', 'YYYY-MM') = m.manad)
      ) order by m.manad), '[]'::jsonb)
      from manader m
    ),

    'kedja_kalla', (
      select coalesce(jsonb_agg(r order by (r->>'skapade')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'nyckel', kalla, 'skapade', count(*),
          'kontaktade', count(*) filter (where nadd >= 1),
          'besok', count(*) filter (where nadd >= 2),
          'offert', count(*) filter (where nadd >= 3),
          'vunna', count(*) filter (where stage = 'vunnen'),
          'forlorade', count(*) filter (where stage = 'forlorad'),
          'oppna', count(*) filter (where stage in ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'parkerad')),
          'vunnen_premie', coalesce(sum(vunnen_premie) filter (where stage = 'vunnen'), 0)
        ) as r
        from skapade group by kalla
      ) x
    ),

    'kedja_ursprung', (
      select coalesce(jsonb_agg(r order by (r->>'skapade')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'nyckel', ursprung, 'skapade', count(*),
          'kontaktade', count(*) filter (where nadd >= 1),
          'besok', count(*) filter (where nadd >= 2),
          'offert', count(*) filter (where nadd >= 3),
          'vunna', count(*) filter (where stage = 'vunnen'),
          'forlorade', count(*) filter (where stage = 'forlorad'),
          'oppna', count(*) filter (where stage in ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'parkerad')),
          'vunnen_premie', coalesce(sum(vunnen_premie) filter (where stage = 'vunnen'), 0)
        ) as r
        from skapade group by ursprung
      ) x
    ),

    'tid_i_steg', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'steg', s.steg, 'antal', coalesce(t.antal, 0), 'median_dagar', t.median_dagar, 'p75_dagar', t.p75_dagar
      ) order by s.ord), '[]'::jsonb)
      from (values ('ny', 1), ('kontaktad', 2), ('besok_bokat', 3), ('offert_skickad', 4), ('parkerad', 5)) s(steg, ord)
      left join (
        select steg, count(*) as antal,
          percentile_cont(0.5) within group (order by extract(epoch from (ut - in_at)) / 86400.0) as median_dagar,
          percentile_cont(0.75) within group (order by extract(epoch from (ut - in_at)) / 86400.0) as p75_dagar
        from ben
        where ut >= v_start and ut < v_slut and ut >= in_at
        group by steg
      ) t on t.steg = s.steg
    ),

    'forlustorsaker', (
      select coalesce(jsonb_agg(jsonb_build_object('orsak', orsak, 'antal', antal) order by antal desc), '[]'::jsonb)
      from (select coalesce(lost_reason::text, 'ovrigt') as orsak, count(*) as antal
            from bas where lost_at >= v_start and lost_at < v_slut group by 1) x
    ),

    'hygien', (
      select coalesce(jsonb_agg(r order by (r->>'oppna')::int desc, r->>'namn'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'profile_id', a.agare,
          'namn', coalesce(n.namn, 'Ingen ägare'),
          'oppna', coalesce(o.oppna, 0),
          'forsenade', coalesce(o.forsenade, 0),
          'saknar_nasta', coalesce(o.saknar, 0),
          'nya_bedomda', coalesce(k.bedomda, 0),
          'nya_inom', coalesce(k.inom, 0),
          'nya_sena', coalesce(k.sena, 0),
          'nya_ej', coalesce(k.ej, 0)
        ) as r
        from (select owner_profile_id as agare from oppna union select owner_profile_id from kontakt) a
        left join (
          select owner_profile_id as agare, count(*) as oppna,
            count(*) filter (where next_action_at is not null and next_action_at < v_nu) as forsenade,
            count(*) filter (where next_action_at is null) as saknar
          from oppna group by 1
        ) o on o.agare is not distinct from a.agare
        left join (
          select owner_profile_id as agare,
            count(*) filter (where utfall in ('inom', 'sen', 'ej')) as bedomda,
            count(*) filter (where utfall = 'inom') as inom,
            count(*) filter (where utfall = 'sen') as sena,
            count(*) filter (where utfall = 'ej') as ej
          from kontakt group by 1
        ) k on k.agare is not distinct from a.agare
        left join namn n on n.id = a.agare
      ) x
    ),

    'tips', (
      select coalesce(jsonb_agg(r order by (r->>'tips')::int desc, r->>'namn'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'profile_id', s.tipped_by_profile_id,
          'namn', coalesce(n.namn, 'Okänd'),
          'roll', n.roll,
          'tips', count(*),
          'oppna', count(*) filter (where s.stage in ('ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'parkerad')),
          'vunna', count(*) filter (where s.stage = 'vunnen'),
          'forlorade', count(*) filter (where s.stage = 'forlorad'),
          'vunnen_premie', coalesce(sum(s.vunnen_premie) filter (where s.stage = 'vunnen'), 0)
        ) as r
        from skapade s left join namn n on n.id = s.tipped_by_profile_id
        where s.tipped_by_profile_id is not null
        group by s.tipped_by_profile_id, n.namn, n.roll
      ) x
    )
  ) into v;

  return v;
end;
$function$;

revoke all on function public.lead_statistik(date, date, uuid) from public, anon;
grant execute on function public.lead_statistik(date, date, uuid) to authenticated;
revoke all on function public.lead_arbetsdagar_fram(date, integer) from public, anon;
grant execute on function public.lead_arbetsdagar_fram(date, integer) to authenticated;
revoke all on function public.lead_steg_rang(text) from public, anon;
grant execute on function public.lead_steg_rang(text) to authenticated;

comment on function public.lead_statistik(date, date, uuid) is
  'Leadsstatistik (etapp 6). Admin/koordinator ser alla leads, övriga anställda de leads de ser enligt RLS (ägare, tipsare, delad). Se docs/leads/ETAPP-6-7.md.';
