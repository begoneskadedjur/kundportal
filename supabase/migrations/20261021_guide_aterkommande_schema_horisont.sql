-- Guiden Lägg upp ett återkommande schema följer den nya horisonten (3.71.0):
-- kontroller bokas till periodskiftet, nästa avtalsår läggs ut automatiskt när
-- sista uppsägningsdag passerat, guiden är låst när kunden redan har ett schema
-- och startdatumet får ligga bakåt (sätter bara rytmen).

update intranet_documents set
  summary = 'Boka kundens stationskontroller under Rondering & Schema. Portalen bokar till periodskiftet och lägger ut nästa avtalsår automatiskt.',
  content = $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"[[Rondering & Schema]] › [[Nytt schema]]","tar":"3 min","behover":"Kunden har avtalsdatum i kundkortet och stationerna är utplacerade","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck [[Nytt schema]] i Rondering & Schema, välj kund, ärendetyp och tekniker och gå igenom de fem stegen. Portalen bokar kontrollerna fram till avtalets periodskifte. När sista uppsägningsdag har passerat utan uppsägning läggs hela nästa avtalsår ut automatiskt."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Nytt schema]].","ser":"Rutan Nytt återkommande schema öppnas."},
      {"text":"Välj Kund, Ärendetyp och Ansvarig tekniker. Tryck [[Fortsätt till schemaläggning]].","ser":"Återkommande kontroller öppnas på Steg 1 av 5: Startdatum."},
      {"text":"Välj startdatum i kalendern. Tryck [[Nästa]].","ser":"Steg 2 av 5: Tid per besök. Under kalendern står till vilket datum kontrollerna läggs ut."},
      {"text":"Tryck på hur lång tid en kontrollrunda tar. Tryck [[Nästa]].","ser":"Steg 3 av 5: Frekvens & dag. Står det Enligt avtalet är frekvensen redan förvald."},
      {"text":"Välj frekvens och dag, till exempel Kvartalsvis och Första helgfria vardagen. Tryck [[Nästa]].","ser":"Steg 4 av 5: Klockslag."},
      {"text":"Välj klockslag. Tryck [[Nästa]].","ser":"Förhandsvisningen visar alla datum fram till periodskiftet."},
      {"text":"Tryck på ett datum som inte passar för att ta bort det. Tryck sedan Skapa och antalet, till exempel [[Skapa 4 kontrolltillfällen]].","ser":"Det står 4 kontrolltillfällen skapade och schemat syns i listan."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Kunden har redan ett återkommande schema","svar":"Ett nytt schema skulle ge dubbla kontroller. Nästa avtalsår läggs ut automatiskt. Behöver takten, tiden eller teknikern ändras gör du det i det befintliga schemat."},
      {"fraga":"Det står Avtalsslutdatum saknas","svar":"Kunden saknar både avtalsslut och startdatum. Lägg in avtalsdatumen i kundkortet först."},
      {"fraga":"[[Nästa]] går inte att trycka i steg 1","svar":"Har kunden flera gällande avtal måste du välja avtal först. Står det att avtalet är uppsagt väljer du ett startdatum före sista giltiga dag."},
      {"fraga":"Det står Inga kontroller läggs ut nu","svar":"Startdatumet ligger efter periodskiftet. Schemat skapas ändå, och kontrollerna läggs ut automatiskt när nästa avtalsår är säkert."},
      {"fraga":"Det står Inga datum kunde genereras för vald period","svar":"Perioden är för kort för frekvensen. Gå [[Tillbaka]] och prova ett annat startdatum eller en annan dag i perioden."},
      {"fraga":"Ett datum är gult eller rött i förhandsvisningen","svar":"Gult betyder att datumet har flyttats, till exempel för en röd dag. Rött betyder att teknikern redan har något bokat. Tryck på datumet för att ta bort det, eller flytta besöket i schemat efteråt."},
      {"fraga":"Det står Avtalet saknar besöksfrekvens","svar":"Frekvensen du väljer sparas på avtalet och blir facit för framtida scheman. Kontrollera mot avtalet innan du väljer."}
    ]},
    {"type":"bra","items":[
      "Skapa inte stationskontroller för hand när kunden har ett schema, då blir det dubbla besök. Stationskontroll Avtalskund i Nytt ärende är bara för enstaka extra kontroller.",
      "Kontrollerna blir vanliga ärenden i schemat och kan flyttas en och en.",
      "Med Första helgfria vardagen hoppar portalen över röda dagar.",
      "Kontrollerna följer avtalsåret, precis som fakturorna. Dagen efter sista uppsägningsdag läggs hela nästa avtalsår ut, om avtalet inte är uppsagt.",
      "Ett startdatum bakåt i tiden sätter bara rytmen. Inga kontroller läggs ut före i dag.",
      "Teknikern får samma fråga efter etableringen. [[Ja, schemalägg]] öppnar samma fem steg."
    ]},
    {"type":"ovning","uppdrag":"Lägg upp ett schema för Brf Exempelgården: Stationskontroll med Anna Exempel, start måndag 2026-11-02, 1 timme per besök, kvartalsvis första helgfria vardagen klockan 08:00."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har ett återkommande schema och vill ha en extra kontroll. Vad gör du?","alternativ":["Lägger upp ett nytt schema","Bokar en Stationskontroll Avtalskund för den enda kontrollen","Ändrar frekvensen"],"ratt":1,"forklaring":"Ett nytt schema ger dubbla besök, och portalen låter dig inte lägga ett. En enstaka kontroll bokas som eget ärende."},
      {"fraga":"Avtalet löper ett år i taget och sista uppsägningsdag har passerat. Vad händer med kontrollerna för nästa avtalsår?","alternativ":["Du lägger upp ett nytt schema","De läggs ut automatiskt","De läggs ut två månader i taget"],"ratt":1,"forklaring":"När avtalet inte längre kan sägas upp till periodskiftet läggs hela nästa avtalsår ut automatiskt."},
      {"fraga":"Det står Avtalsslutdatum saknas. Varför?","alternativ":["Teknikern saknar arbetstider","Kunden saknar avtalsdatum i kundkortet","Kunden har inga stationer"],"ratt":1,"forklaring":"Utan avtalsdatum vet portalen inte hur långt schemat ska räcka."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-tillaggsstationer-koordinator","label":"Boka etablering för tilläggsstationer","description":"Stationerna ut först."},
      {"slug":"guide-tillaggsstationer-fakturering","label":"Besluta och fakturera tilläggsstationer","description":"Beslutet i avtalskartan."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  source_updated_at = now()
where slug = 'guide-aterkommande-schema';
