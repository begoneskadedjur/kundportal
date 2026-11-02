-- Guiderna om tilläggsstationer efter 3.110 till 3.114.3 (avtalsåret på avtalsdag,
-- nya tilläggsregler, arbetslistan på avtalskartan, betald till och med per station,
-- stationen kopplas till ärendet där den sattes ut). Bara UPDATE, version höjs.
--   guide-tillaggsstationer-fakturering  Besluta och fakturera tilläggsstationer (admin, koordinator)  version 1 -> 2, nytt innehåll
--   guide-tillaggsstationer              Sätt ut en tilläggsstation (tekniker)                        version 2 -> 3, Felsökning och Bra att veta
--   guide-tillaggsstationer-koordinator  Boka etablering för tilläggsstationer (koordinator, admin)  version 1 -> 2, Bra att veta
-- Ingen av guiderna kräver läskvittens (requires_acknowledgement = false), det ändras inte.
-- Guidemodulerna: src/pages/shared/intranet/guider/guide-tillaggsstationer*.tsx.
-- Nya interaktiva delar: tillagg-regler (TillaggRegler.tsx), tillagg-arbetslistan (TillaggArbetslistan.tsx).
-- Idempotent: varje UPDATE körs bara om innehållet inte redan är det nya.

-- 1. Kontoret: besluta och fakturera
update public.intranet_documents
set
  summary = 'Besluta tilläggsstationerna från arbetslistan i avtalskartan, och se hur tilläggsreglerna Följer premien och Som tidigare fakturerar dem.',
  version = 2,
  source_updated_at = date '2026-11-02',
  content = $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Notisen N att göra på avtalskartan, eller [[Befintliga kunder]] › Kräver åtgärd","tar":"4 min","behover":"Behörigheten Faktureringsansvarig","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna notisen N att göra på avtalskartan och tryck [[Tillägg utöver avtalet]] på raden Tillägg att besluta. Kontrollera pris och timmar i Besluta tillägg och tryck [[Besluta]]. På avtal med Tilläggsregler Följer premien skapas ingen pro rata förrän du har beslutat, så besluta så snart notisen kommer."},
    {"type":"visning","steg":[
      {"text":"Tryck på notisen 1 att göra på avtalskartan · Exempel AB.","ser":"Kundens avtalskarta öppnas. Överst står arbetslistan med raden Tillägg att besluta, enheten och vad du ska göra."},
      {"text":"Läs raden Tillägg att besluta. Tryck [[Tillägg utöver avtalet]] på raden.","ser":"Panelen Innehåll och utrustning öppnas till höger. Rutan Besluta tillägg öppnas med Tillägg utöver avtalet valt."},
      {"text":"Kontrollera årspriset per station och timmarna under Vad teknikern satte ut. Ändra om det behövs.","ser":"Timmarna är förifyllda med teknikerns förslag. Per år och beloppet som faktureras nu räknas om direkt."},
      {"text":"Tryck [[Besluta]].","ser":"Det står att stationerna ligger som tillägg utöver avtalet. Arbetslistan byts mot Alla tillägg beslutade."},
      {"text":"Titta i panelen under Tilläggsstationer, betald till och med.","ser":"Varje station står med pro rata väntar. När ärendet är fakturerat står Betald t.o.m. och datumet."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Pris saknas i prislistan på en eller flera rader. Ange pris.","svar":"Portalen letar i avtalets prislista, kundens prislista, Automatisk prislista och sist tjänstens grundpris (144 Tilläggsstation per år, 79 Ljusfälla generell). Skriv årspriset per station i rutan kr per år, eller lägg in priset i kundens prislista först."},
      {"fraga":"Det står Timpris saknas i kundens prislista (tjänst 135). Lägg in det innan arbetstiden ändras.","svar":"Lägg in tjänst 135 i kundens prislista, eller lämna timmarna som de är."},
      {"fraga":"Knappen heter Försök igen","svar":"Ett av besluten kunde inte sparas. De som blev klara ligger kvar beslutade. Tryck [[Försök igen]] för att fortsätta med resten."},
      {"fraga":"Raden heter Station utan ärende","svar":"Stationen är beslutad men hör inte till något ärende, och får ingen pro rata förrän den gör det. Tryck [[Välj ärende]], välj ärendet där stationen sattes ut och tryck [[Välj ärende]] igen."},
      {"fraga":"Kunden ligger kvar under Kräver åtgärd","svar":"Arbetslistan har fler rader, på en annan enhet, ett annat avtal eller en annan uppgift som Faktura att skapa. Gör raderna uppifrån och ned."}
    ]},
    {"type":"bra","items":[
      "Tillägg utöver avtalet rör inte premien och slutar när avtalet slutar. Ingår i premien öppnar samma ruta med Lägg till i avtalet valt: årspremien höjs och kostnaden läggs i § 4.",
      "Varje avtal har Tilläggsregler i panelens grupp Fakturering. Följer premien gäller nya avtal signerade från 2026-10-30 och avtalen för FEV, WBAB och Falu kommun. Alla andra står på Som tidigare och fungerar som förut.",
      "Som tidigare: pro rata läggs på ärendet redan när stationen sätts ut. Följer premien: ingen pro rata före beslutet, sedan på ärendet där stationen sattes ut. Är ärendet redan stängt blir det i stället en faktura av typen Tillägg från utsättning.",
      "Följer premien: tilläggen faktureras i premiens takt. Månadspremie på månadsfakturan, kvartal, halvår eller år på en egen tilläggsfaktura för samma period, ingen premie årsvis på avtalsdagen. En faktura per enhetens referenskod, med enhetens namn på varje rad.",
      "Betald till och med per station står i Innehåll och utrustning. Fakturerades tillägget direkt i Fortnox trycker du [[Registrera Fortnox-faktura]], ska det inte debiteras trycker du [[Efterskänk]]. Antalet räknas om före varje faktura och det blir inga krediteringar."
    ]},
    {"type":"interactive","component":"tillagg-regler"},
    {"type":"interactive","component":"tillagg-arbetslistan"},
    {"type":"interactive","component":"tillagg-jamforelse"},
    {"type":"interactive","component":"tillagg-rakneexempel"},
    {"type":"ovning","uppdrag":"Teknikern har satt ut 2 mekaniska fällor hos Exempel AB Lager och föreslagit 1 timme. Ni har kommit överens med kunden om 2 timmar per år. Besluta tilläggen utöver avtalet."},
    {"type":"quiz","fragor":[
      {"fraga":"Avtalet har Tilläggsregler Följer premien. Teknikern satte ut 2 fällor i går och ingen har beslutat. Vad är fakturerat för fällorna?","alternativ":["Pro rata ligger redan på etableringsärendet","Ingenting än, pro rata skapas först efter beslutet","Hela årspriset ligger på nästa årsfaktura"],"ratt":1,"forklaring":"Med Följer premien skapas pro rata först när tillägget är beslutat i avtalskartan."},
      {"fraga":"Kunden har månadspremie och Tilläggsregler Följer premien. Hur faktureras tillägget?","alternativ":["På månadsfakturan, årspriset delat med tolv","På en egen faktura i samband med årsfakturan","Per kontrollrunda"],"ratt":0,"forklaring":"Med Följer premien följer tilläggen premiens takt."},
      {"fraga":"Etableringsärendet stängdes innan du beslutade. Avtalet följer premien. Vad händer med tiden från utsättningen?","alternativ":["Den faktureras aldrig","Arbetslistan visar Faktura att skapa och Planera fakturor skapar fakturan","Du öppnar ärendet igen och lägger till en rad"],"ratt":1,"forklaring":"Fakturan heter Tillägg från utsättning och tar dagarna fram till nästa periodstart."}
    ]},
    {"type":"avslut","fraga":"Admin, eller skriv i Teams-chatten Systemet.","lankar":[
      {"slug":"guide-tillaggsstationer-koordinator","label":"Boka etablering för tilläggsstationer","description":"Rätt ärende på rätt enhet."},
      {"slug":"guide-aterkommande-schema","label":"Lägg upp ett återkommande schema","description":"Kontrollerna efter etableringen."}
    ]}
  ]$json$::jsonb
where slug = 'guide-tillaggsstationer-fakturering'
  and version < 2;

-- 2. Tekniker: sätt ut en tilläggsstation (Felsökning och Bra att veta)
update public.intranet_documents
set
  version = 3,
  source_updated_at = date '2026-11-02',
  content = jsonb_set(
    jsonb_set(
      content::jsonb,
      '{3,items}',
      $json$[
        {"fraga":"Per år och per månad går inte att välja","svar":"Det står Kräver att kunden har ett avtal i avtalskartan. Välj per kontroll, eller skriv en ticket till rollen Koordinator."},
        {"fraga":"Det står pris saknas","svar":"Kundens prislista saknar priset för den typen. Placera stationen och skriv en ticket till rollen Koordinator så att priset läggs in."},
        {"fraga":"Det står Kunden har 2 öppna etableringsärenden. Stationen kopplas till ärende BE-0004512, det senast skapade.","svar":"Stationen hör till det ärendet. Är det inte ärendet du arbetar i, skriv en ticket till rollen Koordinator med båda ärendenumren."},
        {"fraga":"Stationen har fel typ","svar":"Öppna stationen och tryck [[Byt typ|station.byttyp]]. Byt stationstyp öppnas. Välj den nya typen och tryck Byt till Betongstation. Tidigare kontroller står kvar som den gamla typen. Går Byt typ inte att trycka på har kunden betalat för stationen framåt. Skriv då en ticket till rollen Koordinator."},
        {"fraga":"Kunden vill inte ha tilläggsstationen längre","svar":"Öppna stationen i kontrollrundan, tryck [[Hämta upp|station.hamtaupp]] och sedan Spara och hämta upp. Avtalsstationer hämtas inte upp av tekniker."}
      ]$json$::jsonb
    ),
    '{4,items}',
    $json$[
      "Tilläggsstationer ingår inte i avtalets årspremie och faktureras. Avtalets stationer och själva etableringen faktureras inte.",
      "Stationen kopplas till etableringsärendet hos kunden. Har kunden flera öppna etableringsärenden kopplas den till det senast skapade, och du får ett meddelande om vilket.",
      "Kontoret får en notis och beslutar hur tillägget faktureras. Du behöver inte göra något mer. På nyare avtal faktureras tilläggen i samma takt som avtalet, oavsett om du väljer per år eller per månad.",
      "Per kontroll debiteras etablering och varje kontrollrunda. När du avslutar etableringen visar portalen Stäng ärendet och skicka till fakturering med Pris per station och Antal. Tryck Stäng och fakturera.",
      "Är priset under listpriset går raden till rabattgodkännande. Byter du typ på en tilläggsstation gäller den nya typens pris, och kontoret får en notis."
    ]$json$::jsonb
  )
where slug = 'guide-tillaggsstationer'
  and version < 3
  and content::jsonb -> 3 ->> 'type' = 'felsok'
  and content::jsonb -> 4 ->> 'type' = 'bra';

-- 3. Koordinator: boka etablering (Bra att veta)
update public.intranet_documents
set
  version = 2,
  source_updated_at = date '2026-11-02',
  content = jsonb_set(
    content::jsonb,
    '{4,items}',
    $json$[
      "Samma ärendetyp används för stationer som ingår i avtalet och för tillägg.",
      "Tillägg kan också sättas ut under en vanlig kontrollrunda. Då är det kontrollärendet som bär tillägget.",
      "Tjänsten Etableringskostnad är förvald. Inga fakturarader kopieras från avtalet, premien styrs av avtalskartan.",
      "Tilläggsstationen kopplas till etableringsärendet där den sätts ut. Har enheten flera öppna etableringsärenden kopplas den till det senast skapade. Boka därför inte två etableringar på samma enhet samtidigt.",
      "Teknikern öppnar ärendet och trycker [[Gå till utplacering]]. När tilläggen är utsatta får faktureringsansvarig notisen N att göra på avtalskartan och beslutar dem där."
    ]$json$::jsonb
  )
where slug = 'guide-tillaggsstationer-koordinator'
  and version < 2
  and content::jsonb -> 4 ->> 'type' = 'bra';
