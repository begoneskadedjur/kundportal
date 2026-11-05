-- Guiden Skicka avtalsfakturor i tid (admin och koordinator, dator), 3.124.0.
-- Faktureringsschemat i fliken Avtalskunder, Godkänn markerade, varningen vid
-- för tidig sändning och arkivet. Guidemodul:
-- src/pages/shared/intranet/guider/guide-avtalsfakturor-kontor.tsx.
-- Dessutom: guiden Fakturera från ärende till betalning beskrev den gula rutan
-- Ofakturerad merförsäljning, som ersatts av gruppen Utfört arbete utan faktura.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-avtalsfakturor-kontor',
  'Skicka avtalsfakturor i tid',
  'Fliken Avtalskunder visar när varje avtalsfaktura ska skickas. Godkänn flera på en gång, och vänta när portalen säger att en faktura skickas för tidigt.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Fakturering › Avtalskunder","tar":"5 min","behover":"Behörigheten faktureringsansvarig för att godkänna","enhet":"dator"},
    {"type":"kortsvar","text":"Fliken Avtalskunder visar avtalsfakturorna som ett schema. Skicka det som står under Perioden har börjat och Försenade först. Bocka i en hel grupp och tryck [[Godkänn markerade|allman.bock]] för att godkänna flera på en gång."},
    {"type":"visning","steg":[
      {"text":"Öppna Fakturering i menyn och tryck på fliken Avtalskunder.","ser":"Läget Att hantera visar schemat. Överst står Perioden har börjat, Försenade, Kommande 30 dagar och Skickat i månaden."},
      {"text":"Bocka i rutan på gruppraden Försenade.","ser":"Alla fakturor i gruppen markeras. Raden överst visar antal och summa exkl. moms. Perioden har börjat (röd) skickas först, Försenade (orange) skulle ha skickats men perioden har inte börjat."},
      {"text":"Tryck [[Godkänn markerade (2)|allman.bock]].","ser":"Det står 2 fakturor godkända. Fakturorna står kvar i sin grupp med texten Godkänd."},
      {"text":"Tryck på en faktura under Kommande, till exempel en månadsfaktura.","ser":"Fakturan öppnas. Raden under stegen visar Skulle skickas, Perioden börjar och Förfaller om skickad idag. Röd text betyder att kunden betalar efter att perioden har börjat."},
      {"text":"Tryck [[Skapa utkast i Fortnox]].","ser":"Det står Fakturan gäller januari 2027. Portalen frågar eftersom en månadsfaktura skickas den 1:a i den månad den gäller."},
      {"text":"Tryck [[Vänta till 2027-01-01]].","ser":"Ingenting skickas och fakturan ligger kvar under Kommande. Skicka ändå skapar utkastet i Fortnox ändå."},
      {"text":"Stäng fakturan och tryck [[Arkiv]] uppe till höger.","ser":"Arkivet visar skickade fakturor per månad med Betald, Skickad, Förfallen eller Krediterad. Överst står Fakturerat, Betalt, Obetalt, ej förfallet och Förfallet för vald period."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Godkänn markerade går inte att trycka på","svar":"Ingen av de markerade fakturorna väntar på godkännande, eller så saknar du behörigheten faktureringsansvarig. Syns inte knappen alls: be admin om behörigheten."},
      {"fraga":"En faktura ligger under Väntar på beslut","svar":"Premien på avtalet är inte bekräftad. Bekräfta premien i avtalskartan. Sedan flyttar fakturan till sin grupp och går att godkänna."},
      {"fraga":"Det står att fakturor väntar på fakturaväg","svar":"De andra fakturorna är godkända. Öppna fakturan som stoppades och välj väg i rutan Fakturaväg. Godkänn den sedan."},
      {"fraga":"Jag hittar inte en faktura som ska skickas om flera månader","svar":"Kommande visar fakturor som ska skickas inom 60 dagar. Tryck Visa alla kommande längst ner i gruppen, eller sök på kunden."}
    ]},
    {"type":"bra","items":[
      "Årsvis, halvårsvis och kvartalsvis skickas 40 dagar före periodstart. Månadsvis skickas den 1:a i den månad fakturan gäller, och utkastet syns en vecka innan.",
      "Fakturadatum i Fortnox blir dagen du skickar och förfallodagen 30 dagar senare. Kolumnen Förfaller om skickad idag visar vilken dag det blir.",
      "Portalen frågar innan en månadsfaktura skickas mer än 10 dagar före sin period, eller en års-, halvårs- eller kvartalsfaktura mer än 60 dagar före periodstart. Det gäller både Skapa utkast i Fortnox och Skicka godkända till Fortnox.",
      "[[Skicka godkända till Fortnox|rapport.skicka]] laddar ner en exportfil med de godkända fakturorna. Utan markering tas alla godkända. Ett utkast direkt i Fortnox skapar du i fakturan.",
      "I arkivet är makulerade utkast som aldrig skickades dolda. Bocka i Visa makulerade för att se dem. Exportera ger en fil som öppnas i Excel."
    ]},
    {"type":"ovning","uppdrag":"Två avtalsfakturor är försenade. Godkänn båda på en gång."},
    {"type":"quiz","fragor":[
      {"fraga":"Vilken grupp skickar du först?","alternativ":["Kommande","Perioden har börjat","Väntar på beslut"],"ratt":1,"forklaring":"Kunden har redan fått tjänsten. Skicka de fakturorna först, sedan Försenade."},
      {"fraga":"När skickas en månadsfaktura för januari?","alternativ":["40 dagar före, i november","Den 1 januari","När kunden har betalat december"],"ratt":1,"forklaring":"Månadsfakturor skickas den 1:a i den månad de gäller. Utkastet syns en vecka innan."},
      {"fraga":"Portalen frågar Fakturan gäller januari 2027. Vad gör du?","alternativ":["Trycker Vänta till 2027-01-01","Makulerar fakturan","Skapar fakturan för hand i Fortnox"],"ratt":0,"forklaring":"Då skickas ingenting. Fakturan ligger kvar och skickas på sitt datum."}
    ]},
    {"type":"avslut","fraga":"Admin, eller skriv i Teams-chatten Systemet.","lankar":[
      {"slug":"guide-fakturering-kontor","label":"Fakturera från ärende till betalning","description":"Godkänn och skapa utkast i Fortnox för en enskild faktura."},
      {"slug":"guide-tillaggsstationer-fakturering","label":"Besluta och fakturera tilläggsstationer","description":"Tilläggen på avtalsfakturorna."}
    ]}
  ]$json$::jsonb,
  1, false, true, 37, current_date, array['admin','koordinator']
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

-- Fakturera från ärende till betalning: sista steget i visningen
update intranet_documents
set
  source_updated_at = current_date,
  content = jsonb_set(
    content::jsonb,
    '{2,steg,6,ser}',
    to_jsonb('Här ligger extraarbeten hos avtalskunder. Gruppen Utfört arbete utan faktura visar ärenden som saknar faktura. Tryck [[Skapa faktura]] på raden.'::text)
  )
where slug = 'guide-fakturering-kontor'
  and content::jsonb -> 2 ->> 'type' = 'visning'
  and content::jsonb -> 2 -> 'steg' -> 6 ->> 'text' = 'Tryck på fliken Merförsäljning Avtal.';
