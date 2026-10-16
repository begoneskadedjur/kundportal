-- Två nya handboksguider som länkar till varandra (3.67.0):
--   guide-delfakturering  fakturera ett ärende i flera delar, en faktura per månad,
--                         avtalskunder och vad kontoret ser
--   guide-aterbesok       boka återbesök i privat-, företags- och avtalsärenden
-- Interaktiva delar (src/pages/shared/intranet/interactive/delfakturering/):
--   delfaktura-manad  övning: en faktura per månad
--   aterbesok-ovning  klickbar efterbildning av Boka återbesök med Skapa delfaktura
-- Faktureringsguiderna (tekniker och kontor) får en länk till delfakturering, och
-- teknikerguidens påstående att engångsärenden bara faktureras vid avslut rättas.
-- Ingen läskvittens. Idempotent: on conflict skriver om guiderna, länkarna läggs
-- bara till en gång.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-delfakturering',
  'Delfakturering: fakturera ett ärende i flera delar',
  'Hur du fakturerar det som är gjort innan ärendet är klart, hur du samlar en månads besök på en faktura och vad som gäller för avtalskunder.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"p","text":"Ett ärende med flera besök behöver inte vänta med faktureringen tills allt är klart. Med en delfaktura fakturerar du det som är gjort hittills, och ärendet fortsätter som vanligt. Det görs i samma steg som när du bokar återbesöket."},
    {"type":"callout","variant":"success","title":"Det viktigaste på en halv minut","text":"Kryssa i Skapa delfaktura när du bokar återbesöket. Allt som är ofakturerat på ärendet just då blir en faktura, oavsett hur många besök det kommer från. Kryssar du inte i ligger raderna kvar och följer med nästa delfaktura eller slutfakturan. Ingenting försvinner."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Så gör du","description":"Steg för steg, med en övning","target":"sa-gor-du"},
      {"label":"En faktura per månad","description":"Många besök men en samlad faktura","target":"per-manad"},
      {"label":"Avtalskunder","description":"Delfakturera merförsäljning","target":"avtal"},
      {"label":"Kontoret","description":"Så känner du igen en delfaktura","target":"kontoret"},
      {"label":"Vanliga frågor","description":"Korta svar","target":"fragor"}
    ]},
    {"type":"chain","title":"Ett ärende med två fakturor","steps":["Besök","Boka återbesök","Skapa delfaktura","Nästa besök","Avsluta ärendet","Slutfaktura"],"labels":["Rader läggs","Fotspåren","Kryssa i","Börjar från noll","Som vanligt","Resten"]},

    {"type":"h2","id":"sa-gor-du","text":"Så gör du"},
    {"type":"steps","items":[
      "Fyll i Tjänster & fakturarader för det som är gjort, precis som vanligt.",
      "Tryck på fotspåren uppe till höger i ärendet och välj Boka återbesök.",
      "Välj datum, besökslängd och tekniker och tryck Visa förslag.",
      "Välj en tid. Under anteckningen finns rutan Skapa delfaktura för nuvarande tjänster. Kryssa i den. Raderna och summan visas under rutan, så du ser exakt vad som faktureras.",
      "Tryck Boka återbesök. Portalen svarar med Återbesök bokat och delfaktura och fakturanumret."
    ]},
    {"type":"p","text":"Prova själv. Övningen ser ut som i portalen men ingenting sparas:"},
    {"type":"interactive","component":"aterbesok-ovning"},
    {"type":"h3","id":"vad-hander","text":"Det här händer med raderna"},
    {"type":"list","items":[
      "Raderna som kom med på delfakturan räknas som fakturerade och försvinner från ärendets Tjänster & fakturarader. Nästa besök börjar från noll.",
      "Delfakturan hamnar under Fakturering › Privat & Företag och går samma väg som andra fakturor: granskning, godkännande, Fortnox och kunden.",
      "När ärendet avslutas blir det som lagts till efter den senaste delfakturan en slutfaktura. Är allt redan delfakturerat blir det ingen slutfaktura.",
      "Summerar raderna till 0 kr skapas ingen delfaktura. Återbesöket bokas ändå."
    ]},

    {"type":"h2","id":"per-manad","text":"En faktura per månad"},
    {"type":"p","text":"Ibland är teknikern ute flera gånger i månaden och kunden vill ha en samlad faktura per månad. Det fungerar så här:"},
    {"type":"steps","items":[
      "Besöken mitt i månaden: boka återbesöket som vanligt men kryssa inte i Skapa delfaktura. Raderna ligger kvar på ärendet, och varje rad vet vilket besök den hör till.",
      "Månadens sista besök: kryssa i Skapa delfaktura när du bokar återbesöket. Fakturan tar med allt som samlats sedan förra fakturan, alltså hela månaden.",
      "Nästa månad: samma sak igen.",
      "När jobbet är klart avslutar du ärendet. Det som är kvar blir slutfakturan."
    ]},
    {"type":"interactive","component":"delfaktura-manad"},
    {"type":"callout","variant":"info","title":"Glömde du krysset?","text":"Då händer inget farligt. Raderna ligger kvar och kommer med på nästa delfaktura eller på slutfakturan. Fakturan blir bara större och täcker fler besök."},

    {"type":"h2","id":"avtal","text":"Avtalskunder"},
    {"type":"p","text":"Besök som ingår i avtalet faktureras aldrig, de täcks av årspremien. Har du gjort något utöver avtalet, alltså merförsäljning, kan den delfaktureras när du bokar återbesöket i avtalsärendet."},
    {"type":"list","items":[
      "Rutan heter Delfakturera dessa artiklar nu och finns under rubriken Tillagda artiklar i Boka återbesök.",
      "Rutan visas när ärendet har ofakturerade tjänsterader med artiklar kopplade till tjänsten.",
      "Har en rad rabatt måste rabatten vara motiverad under Tjänster & fakturarader först. Artiklar med kundpris måste vara kopplade till en tjänst.",
      "Fakturan hamnar under Fakturering › Merförsäljning Avtal."
    ]},

    {"type":"h2","id":"kontoret","text":"Kontoret: så känner du igen en delfaktura"},
    {"type":"list","items":[
      "Öppnar du fakturan står det Delfaktura överst.",
      "Fakturakedjan i fakturans detaljvy visar ärendets alla fakturor: vad som redan är fakturerat och vilka rader som väntar.",
      "Ärendehistoriken visar varje delfaktura med fakturanummer, belopp och vem som skapade den.",
      "Provisionen för ett besök frigörs när fakturan som täcker besöket är betald."
    ]},

    {"type":"h2","id":"fragor","text":"Vanliga frågor"},
    {"type":"h3","text":"Kan jag delfakturera utan att boka ett återbesök?"},
    {"type":"p","text":"Nej, inte i dag. Delfakturan skapas i samma steg som återbesöket bokas. Ska inget mer besök bokas avslutar du ärendet, så blir resten slutfakturan."},
    {"type":"h3","text":"Har ärendet ett anpassat pris?"},
    {"type":"p","text":"Delfakturera inte. Det anpassade priset gäller hela ärendet och skulle hamna på varje faktura. Ta det med kontoret i stället."},
    {"type":"h3","text":"Fungerar ROT och RUT på en delfaktura?"},
    {"type":"p","text":"Ja. Samma kontroller som på slutfakturan görs, till exempel att fastighetsbeteckningen finns och att avdraget ligger på arbetstiden."},
    {"type":"h3","text":"Kan raderna komma med två gånger?"},
    {"type":"p","text":"Nej. En rad som har kommit med på en delfaktura är fakturerad och kan inte komma med igen."},

    {"type":"link","slug":"guide-aterbesok","label":"Återbesök: nästa besök i samma ärende","description":"Hur du bokar ett återbesök, med smarta förslag eller egen tid."},
    {"type":"link","slug":"guide-fakturering","label":"Fakturering: din del som tekniker","description":"Vad du fyller i för att fakturan ska bli rätt."}
  ]$json$::jsonb,
  1, false, true, 30, now(), null
),
(
  'guide-aterbesok',
  'Återbesök: nästa besök i samma ärende',
  'Hur du bokar ett återbesök i privat-, företags- och avtalsärenden, vad som sparas och när du delfakturerar.',
  'handbok', 'arenden',
  $json$[
    {"type":"p","text":"Ett återbesök är nästa besök i samma ärende, till exempel en uppföljning efter en råttbekämpning. Ärendet får en ny tid och fortsätter, och det gjorda besöket sparas i historiken. Är det ett nytt problem hos samma kund skapar du ett nytt ärende i stället."},
    {"type":"callout","variant":"success","title":"Det viktigaste på en halv minut","text":"Tryck på fotspåren uppe till höger i ärendet och välj Boka återbesök. Ärendet får den nya tiden och status Återbesök. Vill du fakturera det som är gjort hittills kryssar du i Skapa delfaktura i samma steg."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Privat och företag","description":"Datum, förslag och delfaktura","target":"privat-foretag"},
      {"label":"Avtalsärenden","description":"Ny tid och delfakturering av merförsäljning","target":"avtal"},
      {"label":"Det här sparas","description":"Besökshistorik och ärendehistorik","target":"sparas"},
      {"label":"Återbesök eller nytt ärende","description":"Välj rätt","target":"ratt-val"}
    ]},

    {"type":"h2","id":"privat-foretag","text":"Privat och företag"},
    {"type":"steps","items":[
      "Öppna ärendet och tryck på fotspåren uppe till höger. Välj Boka återbesök.",
      "Steg 1: välj datum för återbesöket, besökslängd och vilka tekniker som ska åka. Tryck Visa förslag.",
      "Steg 2: portalen föreslår tider där alla valda tekniker är lediga samtidigt. Välj en. Passar ingen tid trycker du Ange tid manuellt.",
      "Skriv gärna en anteckning, till exempel kontrollera betesintag.",
      "Ska det som är gjort faktureras nu: kryssa i Skapa delfaktura för nuvarande tjänster. Annars lämnar du rutan tom.",
      "Tryck Boka återbesök."
    ]},
    {"type":"p","text":"Prova själv. Övningen ser ut som i portalen men ingenting sparas:"},
    {"type":"interactive","component":"aterbesok-ovning"},
    {"type":"callout","variant":"info","title":"Ska kunden faktureras nu eller senare?","text":"Lämnar du rutan tom ligger raderna kvar på ärendet och följer med nästa delfaktura eller slutfakturan. Vill kunden ha en faktura per månad kryssar du bara i på månadens sista besök. Läs mer i guiden om delfakturering."},
    {"type":"list","items":[
      "Saknar ärendet adress, eller är ingen tekniker vald, kan portalen inte ge förslag. Ange tiden manuellt.",
      "Följeärenden har inga fotspår. Boka återbesöket i huvudärendet."
    ]},

    {"type":"h2","id":"avtal","text":"Avtalsärenden"},
    {"type":"steps","items":[
      "Öppna avtalsärendet, kontrollärendet eller egenkontrollen och tryck på fotspåren. Välj Boka återbesök.",
      "Under Boka nytt besöksdatum väljer du start och slut.",
      "Har du gjort merförsäljning med artiklar visas Tillagda artiklar med rutan Delfakturera dessa artiklar nu. Kryssa i om det ska faktureras nu.",
      "Skriv en anteckning om du vill och tryck Boka återbesök."
    ]},
    {"type":"p","text":"Besöksdata som arbetsrapport, tidsåtgång och skadedjursnivå sparas i besökshistoriken och töms i ärendet, så att nästa besök fylls i från början."},

    {"type":"h2","id":"sparas","text":"Det här sparas"},
    {"type":"list","items":[
      "Det gjorda besöket sparas i ärendets besökshistorik, med tekniker, datum och rapport.",
      "Ärendehistoriken, klockan uppe till höger i ärendet, visar varje återbesök med gammal och ny tid, vem som bokade och anteckningen. Delfakturor syns där också.",
      "Under Tidigare återbesök i Boka återbesök ser du de återbesök som redan har bokats i ärendet."
    ]},

    {"type":"h2","id":"ratt-val","text":"Återbesök eller nytt ärende"},
    {"type":"list","items":[
      "Boka återbesök: samma problem, samma ärende. En uppföljning, en kontroll till eller ett jobb som inte blev klart.",
      "Skapa nytt ärende (Kopiera ärende i avtalsärenden): ett nytt problem hos samma kund, till exempel getingar hos en kund som redan har ett ärende för råttor.",
      "Duplicera ärende: en kopia där du väljer vad som följer med. Besöken hänger inte ihop."
    ]},

    {"type":"link","slug":"guide-delfakturering","label":"Delfakturering: fakturera ett ärende i flera delar","description":"Fakturera det som är gjort när du bokar återbesöket, eller en gång per månad."}
  ]$json$::jsonb,
  1, false, true, 31, now(), null
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  section = excluded.section,
  category = excluded.category,
  content = excluded.content,
  requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;

-- Teknikerguiden: engångsärenden kan också delfaktureras
update public.intranet_documents
set content = replace(
      content::text,
      'Engångsärenden (privat och företag) faktureras när du avslutar ärendet - underlaget är exakt de rader du fyllt i.',
      'Engångsärenden (privat och företag) faktureras när du avslutar ärendet - underlaget är exakt de rader du fyllt i. Har ärendet flera besök kan du fakturera det som är gjort när du bokar återbesöket, se Delfakturering.'
    )::jsonb,
    source_updated_at = now()
where slug = 'guide-fakturering'
  and content::text not like '%se Delfakturering.%';

-- Länk till delfakturering i båda faktureringsguiderna, före de befintliga länkarna
update public.intranet_documents d
set content = (
      select jsonb_agg(e order by o)
      from (
        select e, case when e->>'type' = 'link' then o + 1000 else o end as o
        from jsonb_array_elements(d.content) with ordinality as t(e, o)
        union all
        select '{"type":"link","slug":"guide-delfakturering","label":"Delfakturering: fakturera ett ärende i flera delar","description":"Fakturera det som är gjort när återbesöket bokas, eller en gång per månad."}'::jsonb, 999
      ) x
    ),
    source_updated_at = now()
where d.slug in ('guide-fakturering', 'guide-fakturering-kontor')
  and not d.content @> '[{"slug":"guide-delfakturering"}]'::jsonb;

-- Kontorsguiden: ett stycke om delfakturor under Ärendetyper
update public.intranet_documents
set content = replace(
      content::text,
      'Engångsärenden (privat och företag): teknikern avslutar ärendet och underlaget hamnar under Privat & Företag.',
      'Engångsärenden (privat och företag): teknikern avslutar ärendet och underlaget hamnar under Privat & Företag. Ärenden med flera besök kan också ha delfakturor, som skapas när återbesöket bokas och är märkta Delfaktura.'
    )::jsonb,
    source_updated_at = now()
where slug = 'guide-fakturering-kontor'
  and content::text not like '%märkta Delfaktura.%';
