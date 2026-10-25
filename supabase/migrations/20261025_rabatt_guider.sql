-- 20261025_rabatt_guider.sql
-- Handboken för Rabatt i prisguiden med godkännande (3.97.0, 2026-10-25).
-- Var rabatten ges, att motivering krävs, att rabattansvarig godkänner, att
-- offerten inte kan skickas innan och varningen i prisrutan.
-- Följer docs/handbok/guidemallen.md: felsökning och Bra att veta hålls inom
-- mallens antal, det nya läggs som en callout direkt efter Bra att veta.
-- Idempotent: varje uppdatering körs bara om markörtexten saknas.

-- Hjälpare: lägg ett block direkt efter guidens bra-block
create or replace function pg_temp.lagg_efter_bra(p_content jsonb, p_block jsonb)
returns jsonb
language sql
as $$
  select jsonb_agg(x.e order by x.ord, x.sub)
  from (
    select t.e, t.ord, 0 as sub from jsonb_array_elements(p_content) with ordinality as t(e, ord)
    union all
    select p_block, t.ord, 1 from jsonb_array_elements(p_content) with ordinality as t(e, ord)
     where t.e->>'type' = 'bra'
  ) x
$$;

-- Hjälpare: lägg en fråga sist i felsökningen
create or replace function pg_temp.lagg_till_felsok(p_content jsonb, p_fraga text, p_svar text)
returns jsonb
language sql
as $$
  select jsonb_agg(
    case when t.e->>'type' = 'felsok'
      then jsonb_set(t.e, '{items}', (t.e->'items') || jsonb_build_array(jsonb_build_object('fraga', p_fraga, 'svar', p_svar)))
      else t.e end
    order by t.ord)
  from jsonb_array_elements(p_content) with ordinality as t(e, ord)
$$;

-- ─── Teknikern: Sätt rätt pris i ärendet ───
update public.intranet_documents d
set content = pg_temp.lagg_efter_bra(
      replace(
        d.content::text,
        'En rad har rabatt. Skriv varför i Motivering till rabatt (krävs vid avslut) under raden. Motiveringen visas för den som godkänner rabatter, och fakturan väntar på godkännandet.',
        'En rad har rabatt. Skriv varför i Motivering till rabatten (krävs) under raden eller i [[Prisguide|allman.kalkyl]]. Motiveringen visas för rabattansvarig, som godkänner rabatten. Fakturan väntar tills rabatten är godkänd.'
      )::jsonb,
      jsonb_build_object(
        'type', 'callout',
        'variant', 'info',
        'title', 'Ge rabatt i prisguiden',
        'text', 'Tryck Prisguide och öppna Påslag, marginal och rabatt. Under Totalt på denna rad skriver du procenten i Rabatt %. Du ser Listpris, Rabatt i kronor och Pris efter rabatt, och marginalen räknas efter rabatten. Skriv varför i Motivering till rabatten (krävs). Applicera priser går inte att trycka förrän motiveringen är skriven. Raden visar sedan Väntar på godkännande tills en rabattansvarig har godkänt den, och därefter Godkänd av med namn och datum. Sänker du priset i prisrutan på raden står det Priset är under listpriset. Ge rabatt i prisguiden så att den godkänns. Skriv då tillbaka listpriset och ge rabatten i prisguiden. Har tjänsten delats upp för ROT eller RUT får arbetsraden samma rabatt, och avdraget räknas på priset efter rabatt.'
      )
    ),
    source_updated_at = now()
where d.slug = 'guide-prissattning'
  and d.content::text not like '%Ge rabatt i prisguiden%';

-- ─── Kontoret: Prislistor och marginal ───
update public.intranet_documents d
set content = pg_temp.lagg_efter_bra(
      replace(
        d.content::text,
        'Rabatter godkänner du under Godkännanden.',
        'Rabatter ges i Prisguiden och godkänns av rabattansvarig under Godkännanden.'
      )::jsonb,
      jsonb_build_object(
        'type', 'callout',
        'variant', 'info',
        'title', 'Så godkänns rabatter',
        'text', 'Alla som ser Prisguiden kan ge rabatt i procent per tjänst, med en motivering. Varje rabatt godkänns av en rabattansvarig, och den som gav rabatten får godkänna själv om hen är rabattansvarig. Rabattansvariga får en notis med länk. Rabatt på ett ärende godkänns när fakturan godkänns under Godkännanden, fliken Rabatter & tillägg. Rabatt på en offert eller ett avtal godkänns under fliken Offerter och avtal, eller i dokumentet i Dokumentsignering med Godkänn rabatten. Offerten eller avtalet kan inte skickas till kunden förrän rabatten är godkänd. Avslå kräver en anledning, och den som skapade dokumentet får en notis. På ett avtal gäller rabatten varje årspremie under hela avtalstiden.'
      )
    ),
    source_updated_at = now()
where d.slug = 'guide-prissattning-kontor'
  and d.content::text not like '%Så godkänns rabatter%';

-- ─── Kontoret: Fakturera från ärende till betalning ───
update public.intranet_documents d
set content = pg_temp.lagg_efter_bra(
      replace(
        d.content::text,
        'Rabatter godkänns av faktureringsansvarig innan fakturan kan gå till Fortnox.',
        'Rabatter godkänns av rabattansvarig innan fakturan kan gå till Fortnox.'
      )::jsonb,
      jsonb_build_object(
        'type', 'callout',
        'variant', 'warning',
        'title', 'Faktura med rabatt',
        'text', 'En faktura med rabatt godkänns av en rabattansvarig. Står det Fakturan har en rabatt som väntar på godkännande av rabattansvarig när du trycker Godkänn: be en rabattansvarig godkänna fakturan under Godkännanden. När rabatten är godkänd ligger godkännandet kvar på raden, även om fakturan skapas om.'
      )
    ),
    source_updated_at = now()
where d.slug = 'guide-fakturering-kontor'
  and d.content::text not like '%Faktura med rabatt%';

-- ─── Teknikern: Skapa och skicka en offert eller ett avtal ───
update public.intranet_documents d
set content = pg_temp.lagg_efter_bra(
      pg_temp.lagg_till_felsok(
        d.content,
        'Det står Rabatten väntar på godkännande',
        'Offerten har rabatt som en rabattansvarig inte har godkänt än. Skicka offerten går inte att trycka. Du får en notis när rabatten är godkänd eller avslagen. Skicka sedan offerten från Dokumentsignering med Granska och skicka.'
      ),
      jsonb_build_object(
        'type', 'callout',
        'variant', 'info',
        'title', 'Rabatt på offerten',
        'text', 'Rabatt ger du i steget Tjänster: tryck Prisguide, skriv procenten i Rabatt % och skriv en motivering. Nästa går inte att trycka förrän motiveringen är skriven, och bottenlisten säger Skriv en motivering till rabatten i prisguiden. Kunden ser listpris, rabatt i procent och pris efter rabatt i Oneflow. Offerten kan inte skickas förrän en rabattansvarig har godkänt rabatten, det står i granskningen. På ett avtal gäller rabatten varje årspremie under hela avtalstiden.'
      )
    ),
    source_updated_at = now()
where d.slug = 'guide-skapa-avtal-offert'
  and d.content::text not like '%Rabatt på offerten%';

-- ─── Teknikern: Följ dina offerter och avtal i Dokumentsignering ───
update public.intranet_documents d
set content = pg_temp.lagg_till_felsok(
      d.content,
      'Det står Rabatten väntar på godkännande',
      'Utkastet har rabatt som en rabattansvarig inte har godkänt än, och då kan det inte skickas till kunden. Rutan Rabatt i dokumentet visar listpris, rabatt och status. Du får en notis när rabatten är godkänd. Tryck sedan Granska och skicka.'
    ),
    source_updated_at = now()
where d.slug = 'guide-dokumentsignering-tekniker'
  and d.content::text not like '%Rabatten väntar på godkännande%';

-- ─── Kontoret och säljaren: Dokumentsignering ───
update public.intranet_documents d
set content = pg_temp.lagg_efter_bra(
      d.content,
      jsonb_build_object(
        'type', 'callout',
        'variant', 'warning',
        'title', 'Utkast med rabatt',
        'text', 'Ett utkast med rabatt kan inte skickas förrän rabatten är godkänd. Rutan Rabatt i dokumentet visar listpris, rabatt i procent, pris efter rabatt, motivering och status, och knappen för att skicka är låst så länge det står Rabatten väntar på godkännande. Är du rabattansvarig trycker du Godkänn rabatten, eller Avslå och skriver en anledning. Den som skapade dokumentet får en notis.'
      )
    ),
    source_updated_at = now()
where d.slug in ('guide-dokumentsignering', 'guide-dokumentsignering-saljare')
  and d.content::text not like '%Utkast med rabatt%';
