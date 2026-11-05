-- Guiderna för nya /admin/fakturering (3.121.0 till 3.125.0), version 3.126.0.
-- Ersätter 20261105_guide_skicka_godkanda_utkast.sql, som aldrig kördes.
--
-- 1. Skicka avtalsfakturor i tid (guide-avtalsfakturor-kontor) skrivs om och får
--    version 2: faktureringsschemat med alla statusgrupper, fakturans datumrad,
--    Godkänn markerade, Skicka godkända till Fortnox som skapar utkast ett i taget
--    med resultat, och varningen vid för tidig sändning. Arkivet flyttar till en
--    egen guide.
-- 2. Ny guide: Fakturera extraarbeten hos avtalskunder (guide-merforsaljning-avtal-kontor).
-- 3. Ny guide: Följ upp skickade fakturor i arkivet (guide-fakturaarkiv-kontor).
-- 4. Fakturera från ärende till betalning (guide-fakturering-kontor): sista steget
--    beskriver arbetslistan i Merförsäljning Avtal, Bra att veta säger vad Till
--    Fortnox och Skicka godkända till Fortnox gör (fem punkter enligt mallen,
--    inget innehåll borttaget) och Läs också länkar till de nya guiderna.
--
-- Guidemoduler: src/pages/shared/intranet/guider/<slug>.tsx, delade skärmdelar i
-- _fakturakoer.tsx. Läskvittens krävs inte för guider (requires_acknowledgement
-- false); version 2 gör att den omskrivna guiden visas som oläst igen.
-- Idempotent: insert ... on conflict skriver om guiderna, jsonb_set har vakter.

-- ─── 1. Skicka avtalsfakturor i tid ───
insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-avtalsfakturor-kontor',
  'Skicka avtalsfakturor i tid',
  'Fliken Avtalskunder visar när varje avtalsfaktura ska skickas. Godkänn och skicka flera på en gång, och vänta när portalen säger att en faktura skickas för tidigt.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Fakturering › Avtalskunder","tar":"6 min","behover":"Behörigheten faktureringsansvarig för att godkänna","enhet":"dator"},
    {"type":"kortsvar","text":"Fliken Avtalskunder visar avtalsfakturorna som ett schema, ordnade efter när de ska skickas. Skicka Perioden har börjat och Försenade först. Bocka i en hel grupp, tryck [[Godkänn markerade|allman.bock]] och sedan [[Skicka godkända till Fortnox|rapport.skicka]], så blir varje faktura ett utkast i Fortnox."},
    {"type":"visning","steg":[
      {"text":"Öppna Fakturering i menyn och tryck på fliken Avtalskunder.","ser":"Läget Att hantera visar faktureringsschemat. Överst står nyckeltalen. Fakturorna står i grupperna Perioden har börjat, Försenade, Skicka denna vecka, Kommande och Väntar på beslut. Till höger står kalendern med skickdatumen, Så faktureras avtalen och Skickat senaste veckan."},
      {"text":"Tryck på raden Brf Exempelgården under Försenade.","ser":"Fakturan öppnas. Raden överst visar Skulle skickas, Perioden börjar och Förfaller om skickad idag. Här granskar du raderna, och här makulerar du en faktura som inte ska skickas."},
      {"text":"Stäng fakturan med krysset uppe till höger.","ser":"Du är tillbaka i schemat. Behöver något rättas i fakturan gör du det innan du godkänner."},
      {"text":"Bocka i rutan på gruppraden Försenade.","ser":"Båda fakturorna i gruppen markeras. Knappraden överst visar 2 fakturor markerade och summan exkl. moms. [[Avmarkera]] tar bort markeringen."},
      {"text":"Tryck [[Godkänn markerade (2)|allman.bock]].","ser":"Det står 2 fakturor godkända. Markeringen släpps och raderna visar Godkänd. Knappen visar Skicka godkända till Fortnox (3), eftersom Exempel Fastigheter AB redan var godkänd."},
      {"text":"Tryck [[Skicka godkända till Fortnox (3)|rapport.skicka]].","ser":"Rutan Skapa 3 utkast i Fortnox visar kund, faktura och belopp för varje faktura och Totalt. Utan markering tar knappen alla godkända. Skickas någon för tidigt frågar portalen först."},
      {"text":"Tryck [[Skapa 3 utkast|rapport.skicka]].","ser":"Utkasten skapas ett i taget och förloppet visar Skapar 1 av 3. Sedan står Fortnox nr och numret på varje faktura, eller varför den inte blev ett utkast. Tryck [[Stäng]] så laddas listan om."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Godkänn markerade går inte att trycka på","svar":"Ingen av de markerade fakturorna väntar på godkännande. Syns knappen inte alls saknar du behörigheten faktureringsansvarig: be admin om den. Står det att fakturor väntar på fakturaväg är de andra godkända. Öppna fakturan som stoppades och välj väg i rutan Fakturaväg."},
      {"fraga":"En faktura ligger under Väntar på beslut","svar":"Premien på avtalet är inte bekräftad. Bekräfta premien i avtalskartan. Sedan flyttar fakturan till sin grupp och går att godkänna."},
      {"fraga":"Portalen frågar Perioden börjar eller Fakturan gäller, med Vänta till och Skicka ändå","svar":"En faktura skickas för tidigt. Tryck Vänta till och datumet. Då skickas ingenting, inte heller de andra fakturorna. Bocka i det som ska iväg nu och tryck [[Skicka godkända till Fortnox|rapport.skicka]] igen."},
      {"fraga":"En faktura misslyckades eller hoppades över","svar":"Den ligger kvar i schemat. Resultatet visar orsaken på raden, till exempel att kunden är inaktiv i Fortnox. Öppna fakturan, rätta det som saknas och tryck [[Skapa utkast i Fortnox]] där. Ett fel stoppar aldrig de andra fakturorna."},
      {"fraga":"Jag hittar inte en faktura som ska skickas om flera månader","svar":"Kommande visar fakturor som ska skickas inom 60 dagar. Tryck Visa alla kommande längst ner i gruppen, eller sök på kunden."}
    ]},
    {"type":"bra","items":[
      "Årsvis, halvårsvis och kvartalsvis skickas 40 dagar före periodstart. Månadsvis skickas den 1:a i den månad fakturan gäller, och utkastet syns en vecka innan. Tillägg per månad skickas den 1:a, tillsammans med månadens premie.",
      "Perioden har börjat (röd) betyder att kunden redan har fått tjänsten. Försenade (orange) skulle ha skickats men perioden har inte börjat. Skicka denna vecka ska skickas inom sju dagar. Kommande visar 60 dagar framåt. Väntar på beslut går inte att godkänna förrän premien är bekräftad i avtalskartan.",
      "Fakturadatum i Fortnox blir dagen du skickar och förfallodagen 30 dagar senare. Står det Betalas efter periodstart i rött under Förfaller om skickad idag betalar kunden efter att perioden har börjat.",
      "Portalen frågar innan en månadsfaktura skickas mer än 10 dagar före sin period, eller en års-, halvårs- eller kvartalsfaktura mer än 60 dagar före periodstart. Det gäller både [[Skapa utkast i Fortnox]] i fakturan och [[Skicka godkända till Fortnox|rapport.skicka]].",
      "[[Skicka godkända till Fortnox|rapport.skicka]] skapar ett utkast i Fortnox för varje godkänd faktura, ett i taget, på samma sätt som Skapa utkast i Fortnox i fakturan. Utan markering tas alla godkända. Utkasten bokförs och skickas till kunden i Fortnox. Skickade fakturor ligger i [[Arkiv]]."
    ]},
    {"type":"ovning","uppdrag":"Godkänn de två försenade fakturorna och skapa utkasten i Fortnox, tillsammans med Exempel Fastigheter AB som redan är godkänd. Brf Exempelparken är också godkänd men ska vänta till sitt datum."},
    {"type":"quiz","fragor":[
      {"fraga":"Vilken grupp skickar du först?","alternativ":["Kommande","Perioden har börjat","Väntar på beslut"],"ratt":1,"forklaring":"Kunden har redan fått tjänsten. Skicka de fakturorna först, sedan Försenade."},
      {"fraga":"Portalen frågar Perioden börjar 2027-02-01. Vad händer om du trycker Vänta till 2026-12-23?","alternativ":["Bara den fakturan väntar, de andra skickas","Ingenting skickas","Fakturan makuleras"],"ratt":1,"forklaring":"Vänta till skickar ingenting alls. Bocka i det som ska iväg nu och tryck Skicka godkända till Fortnox igen."},
      {"fraga":"När skickas en månadsfaktura för januari?","alternativ":["40 dagar före, i november","Den 1 januari","När kunden har betalat december"],"ratt":1,"forklaring":"Månadsfakturor skickas den 1:a i den månad de gäller. Utkastet syns en vecka innan."}
    ]},
    {"type":"avslut","fraga":"Admin, eller skriv i Teams-chatten Systemet.","lankar":[
      {"slug":"guide-merforsaljning-avtal-kontor","label":"Fakturera extraarbeten hos avtalskunder","description":"Arbetslistan i Merförsäljning Avtal."},
      {"slug":"guide-fakturaarkiv-kontor","label":"Följ upp skickade fakturor i arkivet","description":"Betalt, obetalt och förfallet, filter och export."},
      {"slug":"guide-tillaggsstationer-fakturering","label":"Besluta och fakturera tilläggsstationer","description":"Tilläggen på avtalsfakturorna."}
    ]}
  ]$json$::jsonb,
  2, false, true, 37, current_date, array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  section = excluded.section,
  category = excluded.category,
  content = excluded.content,
  version = greatest(public.intranet_documents.version, excluded.version),
  is_published = excluded.is_published,
  source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;

-- ─── 2. Fakturera extraarbeten hos avtalskunder ───
insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-merforsaljning-avtal-kontor',
  'Fakturera extraarbeten hos avtalskunder',
  'Fliken Merförsäljning Avtal är en arbetslista: skapa fakturan för utfört arbete, godkänn flera på en gång och skapa utkasten i Fortnox.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Fakturering › Merförsäljning Avtal","tar":"5 min","behover":"Behörigheten faktureringsansvarig för att godkänna","enhet":"dator"},
    {"type":"kortsvar","text":"Extraarbeten hos avtalskunder faktureras under Merförsäljning Avtal. Saknar ett utfört jobb faktura står det under Utfört arbete utan faktura: tryck [[Skapa faktura|allman.plus]]. Godkänn sedan flera på en gång och skapa utkasten med [[Skicka godkända till Fortnox|rapport.skicka]]."},
    {"type":"visning","steg":[
      {"text":"Öppna Fakturering i menyn och tryck på fliken Merförsäljning Avtal.","ser":"Läget Att hantera visar arbetslistan. Överst står Utfört, saknar faktura, Kräver godkännande, Godkända, att skicka och Skickat i november. Listan har grupperna Utfört arbete utan faktura, Kräver godkännande och Godkända, redo för Fortnox."},
      {"text":"Tryck [[Skapa faktura|allman.plus]] på raden Exempel Bygg AB under Utfört arbete utan faktura.","ser":"Det står Faktura skapad för Exempel Bygg AB. Fakturan ligger nu under Kräver godkännande."},
      {"text":"Tryck på raden Exempel Bygg AB under Kräver godkännande.","ser":"Fakturan öppnas. Granska raderna, Märkning faktura och Utfört arbete. Ska fakturan inte skickas trycker du [[Makulera]]."},
      {"text":"Stäng fakturan och bocka i rutan på gruppraden Kräver godkännande.","ser":"Båda fakturorna markeras. Knappraden visar 2 fakturor markerade och summan inkl. moms."},
      {"text":"Tryck [[Godkänn markerade (2)|allman.bock]].","ser":"Det står 2 fakturor godkända. Fakturorna flyttar till Godkända, redo för Fortnox med Godkänd av och ditt namn."},
      {"text":"Tryck [[Skicka godkända till Fortnox (3)|rapport.skicka]].","ser":"Rutan Skapa 3 utkast i Fortnox visar kund, faktura och belopp för varje faktura och Totalt inkl. moms. Utan markering tar knappen alla godkända."},
      {"text":"Tryck [[Skapa 3 utkast|rapport.skicka]].","ser":"Utkasten skapas ett i taget. Resultatet visar Fortnox nr och numret på varje faktura, eller varför den inte blev ett utkast. Tryck [[Stäng]] så laddas listan om."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Inget att fakturera, raderna kan redan vara kopplade","svar":"Raderna har redan en faktura. Listan laddas om av sig själv. Leta efter fakturan under Kräver godkännande eller i [[Arkiv]]."},
      {"fraga":"Det står Kunde inte skapa faktura och ett felmeddelande","svar":"Fakturan skapades inte och raden ligger kvar. Läs felmeddelandet. Saknas något på kunden eller ärendet, rätta det och tryck [[Skapa faktura|allman.plus]] igen. Fortsätter det, skriv i Teams-chatten Systemet."},
      {"fraga":"Godkänn markerade går inte att trycka på","svar":"Ingen av de markerade fakturorna väntar på godkännande. Syns knappen inte alls saknar du behörigheten faktureringsansvarig: be admin om den."},
      {"fraga":"En faktura misslyckades eller hoppades över","svar":"Den ligger kvar i listan. Resultatet visar orsaken på raden. Öppna fakturan, rätta det som saknas och tryck [[Skapa utkast i Fortnox]] där. Ett fel stoppar aldrig de andra fakturorna."},
      {"fraga":"Datumet under Utfört är orange","svar":"Jobbet gjordes för mer än sju dagar sedan. Fakturan ska skickas inom en vecka efter att jobbet är utfört, så ta den först."}
    ]},
    {"type":"bra","items":[
      "Gruppen Utfört arbete utan faktura ersätter den gula rutan Ofakturerad merförsäljning. Där hamnar stängda ärenden som har fakturarader men ingen faktura.",
      "Fakturan skapas när ärendet stängs och ska skickas inom en vecka. Lagens gräns är den 15:e månaden efter.",
      "En faktura per ärende. Kundens märkning blir Er referens, arbetsorder och objekt blir Ert ordernummer och ärendets adress blir leveansadress. Kolumnen Märkning på fakturan visar vad som skickas.",
      "Beloppen i listan är inkl. moms. Delfakturor för ärenden med flera besök ligger här också, märkta delfaktura.",
      "[[Skicka godkända till Fortnox|rapport.skicka]] skapar ett utkast i Fortnox för varje godkänd faktura, ett i taget. Utan markering tas alla godkända. Skickade fakturor ligger i [[Arkiv]] uppe till höger."
    ]},
    {"type":"ovning","uppdrag":"Jobbet hos Exempel Bygg AB är utfört men saknar faktura. Skapa fakturan, godkänn den tillsammans med Brf Exempelgården och skapa utkasten i Fortnox."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett stängt ärende hos en avtalskund saknar faktura. Var syns det?","alternativ":["Under Utfört arbete utan faktura","I en gul ruta överst på sidan","Under Avtalskunder"],"ratt":0,"forklaring":"Den gula rutan finns inte längre. Ärendet står överst i Merförsäljning Avtal med knappen Skapa faktura."},
      {"fraga":"Du trycker Skicka godkända till Fortnox utan att bocka i något. Vilka fakturor tas med?","alternativ":["Inga","Alla godkända","Bara den äldsta"],"ratt":1,"forklaring":"Utan markering tas alla godkända. Vill du bara skicka några bockar du i dem först."},
      {"fraga":"Var hamnar kundens märkning på fakturan?","alternativ":["Som Er referens","Som fakturanummer","Ingenstans"],"ratt":0,"forklaring":"Märkningen blir Er referens. Arbetsorder och objekt blir Ert ordernummer."}
    ]},
    {"type":"avslut","fraga":"Admin, eller skriv i Teams-chatten Systemet.","lankar":[
      {"slug":"guide-fakturering-kontor","label":"Fakturera från ärende till betalning","description":"Godkänn och skapa utkast i Fortnox för en enskild faktura."},
      {"slug":"guide-avtalsfakturor-kontor","label":"Skicka avtalsfakturor i tid","description":"Faktureringsschemat i Avtalskunder."},
      {"slug":"guide-fakturaarkiv-kontor","label":"Följ upp skickade fakturor i arkivet","description":"Betalt, obetalt och förfallet, filter och export."}
    ]}
  ]$json$::jsonb,
  1, false, true, 38, current_date, array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  section = excluded.section,
  category = excluded.category,
  content = excluded.content,
  is_published = excluded.is_published,
  source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;

-- ─── 3. Följ upp skickade fakturor i arkivet ───
insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-fakturaarkiv-kontor',
  'Följ upp skickade fakturor i arkivet',
  'Arkivet i Avtalskunder och Merförsäljning Avtal visar skickade fakturor per månad: betalt, obetalt och förfallet, med filter och export.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Fakturering › Avtalskunder eller Merförsäljning Avtal › Arkiv","tar":"4 min","behover":"Inget. Arkivet läser det som skickats till Fortnox","enhet":"dator"},
    {"type":"kortsvar","text":"Skickade avtals- och merförsäljningsfakturor ligger i [[Arkiv]] uppe till höger i flikarna Avtalskunder och Merförsäljning Avtal. Välj period och status, så visar nyckeltalen vad som är betalt, obetalt och förfallet. [[Exportera|allman.ladda-ner]] ger en fil för Excel."},
    {"type":"visning","steg":[
      {"text":"Öppna Fakturering i menyn och tryck på fliken Avtalskunder.","ser":"Läget Att hantera visar det som inte är skickat än."},
      {"text":"Tryck [[Arkiv]] uppe till höger.","ser":"Arkivet visar fakturorna per månad, nyast först: Fakturadatum, Fortnox- och portalnummer, kund, period, belopp inkl. moms, förfallodag och status. Överst står Fakturerat, Betalt, Obetalt, ej förfallet och Förfallet. Från början visas senaste 30 dagarna."},
      {"text":"Tryck på Period och välj I år.","ser":"Nyckeltalen och listan gäller hela året. Månad visar en månad i taget och Egen period mellan två datum."},
      {"text":"Tryck [[Förfallna]].","ser":"Bara förfallna fakturor syns, med Förfallen och antal dagar i rött. Nyckeltalet Förfallet visar vilka kunder det gäller."},
      {"text":"Tryck [[Exportera|allman.ladda-ner]].","ser":"En fil laddas ner med fakturorna som syns i listan. Den öppnas i Excel."},
      {"text":"Tryck på fliken Merförsäljning Avtal.","ser":"Fliken öppnas i läget Att hantera. Växeln är egen för varje flik."},
      {"text":"Tryck [[Arkiv]].","ser":"Arkivet för merförsäljning visar ärendenumret under kunden och Er referens i stället för period. Filtren och exporten fungerar på samma sätt."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Inga fakturor i perioden","svar":"Ingen faktura passar perioden och filtret. Välj en längre period under Period, eller tryck [[Alla]]."},
      {"fraga":"Jag hittar inte en makulerad faktura","svar":"Makulerade utkast som aldrig skickades är dolda. Bocka i Visa makulerade. Siffran inom parentes visar hur många de är."},
      {"fraga":"Det står Inga fakturor att exportera","svar":"Exportera tar bara det som syns i listan, och listan är tom. Ändra period eller filter först."},
      {"fraga":"Statusen stämmer inte med Fortnox","svar":"Betalning och kreditering hämtas från Fortnox. Öppna fakturan och tryck [[Synka]] för att hämta dess status."},
      {"fraga":"Jag hittar inte arkivet för Privat & Företag","svar":"Där är arkivet fortfarande reglaget Arkiv bredvid sökrutan, som förut."}
    ]},
    {"type":"bra","items":[
      "Arkivet visar fakturor som skickats till Fortnox, betalda och krediterade. Det som inte är skickat ligger i Att hantera.",
      "Fakturadatum är dagen fakturan bokfördes eller skickades i Fortnox. Listan grupperas per månad efter det datumet.",
      "Skickad är obetald men inte förfallen. Förfallen visar antal dagar. Betald visar betaldagen. Utkast i Fortnox är inte bokförd än. Krediterad är krediterad i Fortnox och Makulerad skickades aldrig.",
      "Nyckeltalen räknar inkl. moms för vald period. Makulerade och krediterade fakturor räknas inte med.",
      "Exportera ger en fil med semikolon och decimalkomma som öppnas i Excel. Den tar fakturorna som syns, med belopp exkl. moms, moms och inkl. moms."
    ]},
    {"type":"ovning","uppdrag":"Ta fram alla förfallna avtalsfakturor från i år och exportera listan."},
    {"type":"quiz","fragor":[
      {"fraga":"En kund säger att den har betalat, men arkivet säger Förfallen. Vad gör du?","alternativ":["Öppnar fakturan och trycker Synka","Ändrar statusen själv","Makulerar fakturan"],"ratt":0,"forklaring":"Betalningen hämtas från Fortnox. Synka hämtar fakturans status direkt."},
      {"fraga":"Varför syns inte en makulerad faktura i arkivet?","alternativ":["Den är raderad","Makulerade är dolda tills du bockar i Visa makulerade","Den ligger under Privat & Företag"],"ratt":1,"forklaring":"Makulerade utkast som aldrig skickades döljs för att inte blandas ihop med riktiga fakturor."},
      {"fraga":"Vad kommer med när du trycker Exportera?","alternativ":["Alla fakturor som finns","Fakturorna som syns i listan","Bara de förfallna"],"ratt":1,"forklaring":"Exporten följer period, statusfilter och sökning."}
    ]},
    {"type":"avslut","fraga":"Admin, eller skriv i Teams-chatten Systemet.","lankar":[
      {"slug":"guide-avtalsfakturor-kontor","label":"Skicka avtalsfakturor i tid","description":"Faktureringsschemat i Avtalskunder."},
      {"slug":"guide-merforsaljning-avtal-kontor","label":"Fakturera extraarbeten hos avtalskunder","description":"Arbetslistan i Merförsäljning Avtal."},
      {"slug":"guide-fakturering-kontor","label":"Fakturera från ärende till betalning","description":"Privat & Företag och den enskilda fakturan."}
    ]}
  ]$json$::jsonb,
  1, false, true, 39, current_date, array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  section = excluded.section,
  category = excluded.category,
  content = excluded.content,
  is_published = excluded.is_published,
  source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;

-- ─── 4. Fakturera från ärende till betalning ───
-- Sista steget i visningen (index 2, steg 6)
update public.intranet_documents
set
  source_updated_at = current_date,
  content = jsonb_set(
    content::jsonb,
    '{2,steg,6,ser}',
    to_jsonb('Här ligger extraarbeten hos avtalskunder som en arbetslista: Utfört arbete utan faktura, Kräver godkännande och Godkända, redo för Fortnox. Guiden Fakturera extraarbeten hos avtalskunder visar hur du skapar, godkänner och skickar dem.'::text)
  )
where slug = 'guide-fakturering-kontor'
  and content::jsonb -> 2 ->> 'type' = 'visning'
  and content::jsonb -> 2 -> 'steg' -> 6 ->> 'text' = 'Tryck på fliken Merförsäljning Avtal.';

-- Bra att veta (index 4): fem punkter, samma innehåll plus det nya om knapparna
update public.intranet_documents
set
  source_updated_at = current_date,
  content = jsonb_set(
    content::jsonb,
    '{4,items}',
    $json$[
      "Fliken avgör sorten: Privat & Företag är engångsärenden och delfakturor, Avtalskunder är premierna per period och Merförsäljning Avtal är extraarbeten hos avtalskunder. De två avtalsflikarna har egna guider.",
      "Fakturor utan rabatt hoppar över godkännandet och börjar som Redo för Fortnox. [[Till Fortnox]] uppe till höger under Privat & Företag laddar ner en exportfil med fakturorna som är Redo för Fortnox och skapar inga utkast. Under Avtalskunder och Merförsäljning Avtal skapar [[Skicka godkända till Fortnox|rapport.skicka]] ett utkast i Fortnox för varje godkänd faktura, ett i taget.",
      "Ärendets fakturakedja visar alla fakturor på ärendet, rader som inte är fakturerade än och raden Slutfaktura, som skapas när ärendet avslutas. Det kräver en skriven rapport. Kontroller och etableringar dokumenteras i stationerna och behöver ingen skriven rapport.",
      "Raden Utfört på i rutan Utfört arbete visar var jobbet gjordes. Står det Blir leveansadress på fakturan skickas adressen till Fortnox och skrivs ut som Leveansadress på fakturan. Kundkortet ändras inte. Arbetsrapporten och specialrapporten läser du från fakturan: tryck Läs eller Visa i rutan Utfört arbete. Inget av det följer med till Fortnox.",
      "Provisionen för ett besök frigörs när fakturan som täcker besöket är betald."
    ]$json$::jsonb
  )
where slug = 'guide-fakturering-kontor'
  and content::jsonb -> 4 ->> 'type' = 'bra';

-- Läs också (index 8)
update public.intranet_documents
set
  source_updated_at = current_date,
  content = jsonb_set(
    content::jsonb,
    '{8,lankar}',
    $json$[
      {"slug":"guide-aterbesok-kontor","label":"Boka ett återbesök","description":"Och skapa en delfaktura för det som är gjort."},
      {"slug":"guide-avtalsfakturor-kontor","label":"Skicka avtalsfakturor i tid","description":"Faktureringsschemat i Avtalskunder."},
      {"slug":"guide-merforsaljning-avtal-kontor","label":"Fakturera extraarbeten hos avtalskunder","description":"Arbetslistan i Merförsäljning Avtal."}
    ]$json$::jsonb
  )
where slug = 'guide-fakturering-kontor'
  and content::jsonb -> 8 ->> 'type' = 'avslut';
