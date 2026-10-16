-- Guidemallen (godkänd 2026-10-16): ärenden, schema och dokumentsignering.
-- Guidemoduler i src/pages/shared/intranet/guider/: guide-skapa-arenden, guide-schemavyn,
-- guide-foljearenden, guide-foljearenden-kontor, guide-avbryta-arenden,
-- guide-avbryta-arenden-kontor och guide-dokumentsignering (delade delar i _arenden.tsx).
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-skapa-arenden',
  'Skapa ett ärende och välj rätt ärendetyp',
  'Skapa ett nytt ärende från schemat, välj rätt typ och boka det med bokningsassistenten.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Schemat › [[Nytt ärende]] uppe till höger","tar":"4 min","behover":"Kundens adress och kontaktuppgifter","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck [[Nytt ärende]] i schemat och välj typ. Kund utan avtal är alltid Engångsjobb Privatperson eller Engångsjobb Företag. Fyll i adress och tjänst, välj ett av bokningsförslagen och tryck [[Skapa & Boka Ärende]]."},
    {"type":"visning","steg":[
      {"text":"Öppna schemat och tryck [[Nytt ärende]] uppe till höger.","ser":"En lista öppnas med Engångsärenden överst och Avtalskunder under."},
      {"text":"Välj ärendetyp. Har kunden inget avtal väljer du Engångsjobb Privatperson eller Engångsjobb Företag.","ser":"Formuläret öppnas, till exempel Nytt ärende: Engångsjobb Privatperson."},
      {"text":"Fyll i Adress och välj Tjänst under Intelligent Bokning. Tryck [[Hitta bästa tid & tekniker]].","ser":"Bokningsförslagen visas under knappen, med tid, tekniker och restid."},
      {"text":"Tryck på det förslag som passar.","ser":"Starttid, Sluttid och ansvarig tekniker fylls i under Bokning & Detaljer."},
      {"text":"Fyll i kunden under Kund & Kontakt: Kontaktperson, Telefonnummer och Personnummer. För ett företag fyller du i Företagsnamn och väljer Kundgrupp i stället för personnummer.","ser":"Fält med * måste vara ifyllda."},
      {"text":"Tryck [[Skapa & Boka Ärende|station.klar]].","ser":"Det står Ärendet har skapats! och besöket ligger i schemat på den tid du valde."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Adress och Tjänst måste vara ifyllda","svar":"Bokningsassistenten behöver båda för att räkna fram tider. Fyll i Adress och Tjänst och tryck [[Hitta bästa tid & tekniker]] igen."},
      {"fraga":"Det står Alla fält med * under 'Bokning & Detaljer' måste vara ifyllda","svar":"Starttid, Sluttid eller ansvarig tekniker saknas. Välj ett bokningsförslag, eller fyll i tiderna och teknikern själv."},
      {"fraga":"Det står Välj kundgrupp för företagskunden","svar":"Engångsjobb Företag kräver Kundgrupp under Kund & Kontakt. Den avgör kundnumrets serie i Fortnox."},
      {"fraga":"Det står Du måste välja en avtalskund","svar":"Du har valt en av avtalstyperna. Välj kunden i listan överst i formuläret. Har kunden inget avtal ska du välja Engångsjobb Privatperson eller Engångsjobb Företag."},
      {"fraga":"Jag valde fel ärendetyp","svar":"Tryck [[Avbryt]] och välj [[Nytt ärende]] igen. Formuläret har ingen knapp för att byta typ när du har kommit dit från schemat."}
    ]},
    {"type":"bra","items":[
      "Etablering Avtalskund är bara utplacering av stationer hos en avtalskund. Tjänsten Etableringskostnad väljs automatiskt. Ett engångsjobb ska aldrig vara en etablering.",
      "Vill en avtalskund ha något utöver avtalet väljer du Extrabesök Avtalskund. Fakturaraderna blir merförsäljning.",
      "Stationskontroll Avtalskund är för en enstaka kontroll. Återkommande kontroller läggs i Rondering & Schema.",
      "Rondering Trafikkontoret och Egenkontroll är bara för regionalkundernas egenkontrollprogram.",
      "Skicka bokningsbekräftelse? står på Nej. Väljer du ett av Ja-valen får kunden ett sms när du skapar ärendet."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB har inget avtal och vill bli av med möss. Skapa ärendet och boka det första förslaget från bokningsassistenten."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett företag utan avtal vill ha hjälp med getingar en gång. Vilken typ väljer du?","alternativ":["Etablering Avtalskund","Engångsjobb Företag","Extrabesök Avtalskund"],"ratt":1,"forklaring":"Kund utan avtal är alltid ett engångsjobb. Etablering och Extrabesök är bara för avtalskunder."},
      {"fraga":"En avtalskund vill ha en extra sanering utöver avtalet. Vilken typ väljer du?","alternativ":["Extrabesök Avtalskund","Engångsjobb Företag","Stationskontroll Avtalskund"],"ratt":0,"forklaring":"Extrabesök Avtalskund behåller kopplingen till avtalet, och fakturaraderna blir merförsäljning."},
      {"fraga":"Du trycker Hitta bästa tid & tekniker och får Adress och Tjänst måste vara ifyllda. Vad gör du?","alternativ":["Väljer en tekniker själv","Fyller i adress och tjänst och trycker igen","Byter ärendetyp"],"ratt":1,"forklaring":"Assistenten räknar tider från adressen och tjänsten. Båda måste finnas."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schemavyn","label":"Hitta och flytta besök i schemat","description":"Sök fram ett besök och dra det till en ny tid."},
      {"slug":"guide-foljearenden-kontor","label":"Skapa ett följeärende","description":"Nytt skadedjur hos samma kund, utan att fylla i allt igen."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 60, now(), array['admin','koordinator']
),
(
  'guide-schemavyn',
  'Hitta och flytta besök i schemat',
  'Sök fram ett besök, gå till rätt dag och dra det till en ny tid eller en annan tekniker.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Sidomenyn › [[Öppna schema]]","tar":"3 min","enhet":"dator"},
    {"type":"kortsvar","text":"Sök fram kunden i Sök ärende... och se vilken dag besöket ligger. Gå dit med pilarna och dra besöket med musen till den nya tiden. Byter du rad byter du tekniker. Flytten sparas när du släpper."},
    {"type":"visning","steg":[
      {"text":"Skriv kundens namn eller ärendenummer i Sök ärende... uppe till höger.","ser":"Träffarna visas under fältet, med status, skadedjur och adress."},
      {"text":"Tryck på träffen.","ser":"Ärendet öppnas och du ser dag och tid under Schemaläggning. Stäng det med [[Avbryt]]."},
      {"text":"Gå till rätt dag med pilen till höger om datumet.","ser":"Schemat visar den dagen, med en rad per tekniker."},
      {"text":"Håll nere musknappen på besöket.","ser":"Besöket tonas ner medan du drar det."},
      {"text":"Dra till den nya tiden på rätt teknikers rad och släpp.","ser":"En blå linje med klockslag visar var besöket hamnar. Tid och tekniker sparas direkt när du släpper."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står till exempel Anna Exempel arbetar inte 18:00 den dagen","svar":"Teknikern arbetar inte den tiden enligt sitt arbetsschema, så besöket flyttades inte. Välj en tid inom arbetstiden eller en annan tekniker."},
      {"fraga":"Det står Kunde inte flytta ärendet","svar":"Flytten sparades inte och schemat laddas om. Försök igen, eller öppna ärendet och ändra tiden där."},
      {"fraga":"Sök ärende hittar inte ärendet","svar":"Söket letar på namn, telefon, e-post, personnummer, org.nr och ärendenummer, inte på adress. Avslutade och borttagna ärenden kommer med när du kryssar i Inkl. avslutade. Gamla ärenden från ClickUp kommer med när du kryssar i Visa arkiv."},
      {"fraga":"En tekniker saknas i schemat","svar":"Från början visas tekniker med rollen Skadedjurstekniker. Tryck [[Filter|allman.filter]] och kryssa i teknikern under Tekniker."}
    ]},
    {"type":"bra","items":[
      "Det finns ingen spara-knapp i schemat. Flytten sparas när du släpper.",
      "Besöket behåller sin längd när du flyttar det.",
      "Drar du till en annan teknikers rad blir den teknikern ansvarig. Ligger besöket på flera rader, dra det från raden där det står Ansvarig.",
      "I Vecka flyttar du till en annan dag och tid, i Månad till en annan dag med samma klockslag. Byta tekniker gör du i Dag.",
      "Avslutade och borttagna ärenden syns inte i schemat från början. Du kan visa dem under Filter."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel vill att besöket flyttas till 13:00 samma dag, och Erik Exempel ska ta det. Sök fram besöket och flytta det."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har dragit ett besök till en ny tid och släppt. Vad gör du sedan för att spara?","alternativ":["Trycker Spara ändringar i ärendet","Ingenting, flytten är redan sparad","Laddar om sidan"],"ratt":1,"forklaring":"Flytten sparas när du släpper. Går det inte står det Kunde inte flytta ärendet."},
      {"fraga":"Besöket ska till en annan tekniker. Vilken vy använder du?","alternativ":["Dag","Vecka","Månad"],"ratt":0,"forklaring":"Bara i dagvyn har varje tekniker en egen rad att dra till. Vecka och Månad flyttar bara dag och tid."},
      {"fraga":"Du söker på kundens gatuadress men hittar inget. Varför?","alternativ":["Kunden finns inte","Söket letar inte på adress","Du måste kryssa i Visa arkiv"],"ratt":1,"forklaring":"Sök på namn, telefon, e-post, personnummer, org.nr eller ärendenummer i stället."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-arenden","label":"Skapa ett ärende och välj rätt ärendetyp","description":"Nytt ärende från schemat med bokningsassistenten."},
      {"slug":"guide-avbryta-arenden-kontor","label":"Avbryt eller ta bort ett ärende","description":"När kunden avbokar."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 61, now(), array['admin','koordinator']
),
(
  'guide-foljearenden',
  'Skapa ett följeärende',
  'Hittar du ett nytt skadedjur hos kunden skapar du ett eget ärende för det direkt i telefonen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren uppe till höger","tar":"2 min","behover":"Ett privat- eller företagsärende","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på fotspåren i ärendet, välj [[Skapa nytt ärende]] och välj det nya skadedjuret. Kund, adress, tid och tekniker kopieras. Det nya ärendet får eget pris och egen arbetstid."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Skapa nytt ärende]].","ser":"Rutan Skapa nytt ärende öppnas. Kundinformation, adress och schemaläggning kopieras automatiskt."},
      {"text":"Tryck på Skadedjurstyp * och välj det nya skadedjuret.","ser":"Skadedjuret står i fältet. Knappen går att trycka på först när du har valt."},
      {"text":"Tryck [[Skapa nytt ärende|allman.plus]].","ser":"Det står till exempel Följeärende skapat för Getingar! och det nya ärendet visas med raden Detta är ett följeärende."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Står det Detta är ett följeärende kan du inte skapa ett till därifrån. Öppna det första ärendet och gör det där."},
      {"fraga":"Knappen Skapa nytt ärende går inte att trycka på","svar":"Du har inte valt skadedjurstyp. Tryck på Skadedjurstyp * och välj."},
      {"fraga":"Det står Kunde inte skapa följeärende","svar":"Inget nytt ärende skapades. Försök igen. Går det inte, skriv till koordinatorn och ange ärendenumret."},
      {"fraga":"Jag står i ett avtalsärende","svar":"Där heter valet [[Kopiera ärende]] och knappen [[Skapa följeärende]]. I övrigt gör du likadant."}
    ]},
    {"type":"bra","items":[
      "Följeärendet får samma kund, adress, tid och tekniker som ärendet du står i.",
      "Det nya ärendet får status Bokad, ingen arbetstid och inget pris. Fyll i det som vanligt.",
      "Beskrivningen blir Följeärende från ursprungsärende. Nytt skadedjursproblem: följt av skadedjuret. Skriv gärna till vad du såg.",
      "Samma skadedjur igen är ett återbesök, inte ett följeärende.",
      "Från ett följeärende går det inte att skapa ett nytt följeärende."
    ]},
    {"type":"ovning","uppdrag":"Du är hos Familjen Exempel för råttorna och ser ett getingbo under taket. Skapa ett nytt ärende för getingarna."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har råttor och du hittar silverfisk i badrummet. Vad gör du?","alternativ":["Bokar ett återbesök","Skapar ett nytt ärende med fotspåren","Skriver det i råttärendets beskrivning"],"ratt":1,"forklaring":"Ett nytt skadedjur får ett eget ärende med eget pris. Fotspåren och Skapa nytt ärende kopierar kunden åt dig."},
      {"fraga":"Vad följer med till det nya ärendet?","alternativ":["Kund, adress, tid och tekniker","Pris och arbetstid","Rapporten"],"ratt":0,"forklaring":"Kunden och bokningen kopieras. Pris, arbetstid och rapport börjar om från noll."},
      {"fraga":"Det står Detta är ett följeärende och fotspåren syns inte. Varför?","alternativ":["Ärendet är avslutat","Det går inte att skapa följeärenden från ett följeärende","Du saknar behörighet"],"ratt":1,"forklaring":"Öppna det första ärendet och skapa det nya därifrån."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma problem, nästa besök i samma ärende."},
      {"slug":"guide-avbryta-arenden","label":"Avbryt eller ta bort ett ärende","description":"När kunden avbokar."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 62, now(), array['technician']
),
(
  'guide-foljearenden-kontor',
  'Skapa ett följeärende',
  'Ringer kunden om ett nytt skadedjur skapar du ett följeärende från det befintliga ärendet, utan att fylla i kunden igen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Schemat › ärendet › fotspåren uppe till höger","tar":"2 min","behover":"Ett privat- eller företagsärende för kunden","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna kundens ärende i schemat, tryck på fotspåren och välj [[Skapa nytt ärende]]. Välj det nya skadedjuret. Kund, adress, tid och tekniker kopieras, och det nya ärendet hamnar på samma tid i schemat."},
    {"type":"visning","steg":[
      {"text":"Tryck på kundens besök i schemat.","ser":"Ärendet öppnas."},
      {"text":"Tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Skapa nytt ärende]].","ser":"Rutan Skapa nytt ärende öppnas. Kundinformation, adress och schemaläggning kopieras automatiskt."},
      {"text":"Tryck på Skadedjurstyp * och välj det nya skadedjuret.","ser":"Skadedjuret står i fältet."},
      {"text":"Tryck [[Skapa nytt ärende|allman.plus]].","ser":"Det står till exempel Följeärende skapat för Getingar!. Ärendet stängs och det nya ligger i schemat på samma tid och tekniker som det första."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Står det Detta är ett följeärende kan du inte skapa ett till därifrån. Öppna det första ärendet och gör det där."},
      {"fraga":"Knappen Skapa nytt ärende går inte att trycka på","svar":"Du har inte valt skadedjurstyp. Tryck på Skadedjurstyp * och välj."},
      {"fraga":"Det står Kunde inte skapa följeärende","svar":"Inget nytt ärende skapades. Försök igen, eller skapa ärendet med [[Nytt ärende]] i schemat."},
      {"fraga":"Det gäller ett avtalsärende","svar":"Där heter valet [[Kopiera ärende]] och knappen [[Skapa följeärende]]. I övrigt gör du likadant."}
    ]},
    {"type":"bra","items":[
      "Det nya ärendet får samma tid och tekniker som det första. Ska det göras en annan tid öppnar du det nya ärendet och ändrar tiden, eller drar det i schemat.",
      "Det nya ärendet får status Bokad, ingen arbetstid och inget pris.",
      "Beskrivningen blir Följeärende från ursprungsärende. Nytt skadedjursproblem: följt av skadedjuret.",
      "Samma skadedjur igen är ett återbesök, inte ett följeärende.",
      "Från ett följeärende går det inte att skapa ett nytt följeärende."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ett bokat råttärende och ringer om getingar. Skapa ett följeärende för getingarna."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hamnar det nya ärendet i schemat?","alternativ":["Bland ärenden att boka in","På samma tid och tekniker som det första","Dagen efter"],"ratt":1,"forklaring":"Tiden och teknikerna kopieras. Flytta det nya ärendet om det ska göras en annan gång."},
      {"fraga":"Kunden ringer om samma råttor igen efter besöket. Vad gör du?","alternativ":["Skapar ett följeärende","Bokar ett återbesök i ärendet","Skapar ett Engångsjobb Privatperson"],"ratt":1,"forklaring":"Samma problem fortsätter i samma ärende som ett återbesök. Följeärenden är för nya skadedjur."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schemavyn","label":"Hitta och flytta besök i schemat","description":"Dra det nya ärendet till rätt tid."},
      {"slug":"guide-skapa-arenden","label":"Skapa ett ärende och välj rätt ärendetyp","description":"När kunden inte har något ärende sedan tidigare."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 63, now(), array['admin','koordinator']
),
(
  'guide-avbryta-arenden',
  'Avbryt eller ta bort ett ärende',
  'Avbokar kunden skriver du varför i ärendet och tar sedan bort det. Ingenting raderas på riktigt.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › [[Radera|allman.radera]] längst ner till vänster","tar":"2 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Skriv först i ärendets kommunikation varför det avbryts. Tryck sedan [[Radera|allman.radera]] längst ner och [[Ta bort]]. Ärendet får status Borttaget och döljs, men all data finns kvar."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på pratbubblan uppe till höger.","ser":"Kommunikation öppnas."},
      {"text":"Skriv varför ärendet avbryts, till exempel att kunden avbokade. Tryck på den gröna pilen.","ser":"Kommentaren visas i panelen."},
      {"text":"Stäng panelen med krysset uppe till höger.","ser":"Du är tillbaka i ärendet."},
      {"text":"Tryck [[Radera|allman.radera]] längst ner till vänster.","ser":"Rutan Ta bort ärende öppnas: Ärendet markeras som borttaget och döljs från alla vyer. All data behålls."},
      {"text":"Tryck [[Ta bort|allman.radera]].","ser":"Det står Ärendet har tagits bort och ärendet stängs."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag hittar inte Radera","svar":"Den står i liten röd text längst ner till vänster i ärendet, bredvid Avbryt och Spara ändringar."},
      {"fraga":"Ärendet syns fortfarande i listan","svar":"Listan uppdateras inte direkt. Ladda om sidan, då är ärendet borta."},
      {"fraga":"Det står Kunde inte markera ärendet som borttaget","svar":"Ingenting ändrades och ärendet ligger kvar. Försök igen, eller skriv till koordinatorn och ange ärendenumret."},
      {"fraga":"Jag tog bort fel ärende","svar":"Säg till koordinatorn direkt och ange ärendenumret. Ingenting är raderat, all data finns kvar."}
    ]},
    {"type":"bra","items":[
      "Ta bort raderar inget på riktigt. Ärendet får status Borttaget och döljs. Kommentarer, bilder och historik finns kvar.",
      "Skriv alltid varför i kommentaren innan du tar bort. Då vet kontoret vad som hände om kunden hör av sig igen.",
      "Ta bara bort ärenden som inte ska göras: kunden avbokar, kunden går inte att nå eller ärendet är en dubblett.",
      "Ska besöket bara flyttas tar du inte bort något. Säg till koordinatorn i stället."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ringt och avbokat. Skriv i ärendet att kunden avbokade och ta sedan bort ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Vad gör du först när kunden avbokar?","alternativ":["Trycker Radera direkt","Skriver i kommentaren varför ärendet avbryts","Ändrar status till Avslutat"],"ratt":1,"forklaring":"Kommentaren finns kvar efteråt och visar varför ärendet avbröts."},
      {"fraga":"Vad händer med bilderna när du tar bort ett ärende?","alternativ":["De raderas","De finns kvar","De skickas till kunden"],"ratt":1,"forklaring":"All data behålls. Ärendet får bara status Borttaget och döljs."},
      {"fraga":"Kunden vill ha en annan dag. Vad gör du?","alternativ":["Tar bort ärendet och skapar ett nytt","Säger till koordinatorn att flytta besöket","Ingenting"],"ratt":1,"forklaring":"Ärendet ska vara kvar, bara tiden ändras."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-foljearenden","label":"Skapa ett följeärende","description":"Nytt skadedjur hos samma kund."},
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma problem, nästa besök."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 64, now(), array['technician']
),
(
  'guide-avbryta-arenden-kontor',
  'Avbryt eller ta bort ett ärende',
  'Avbokar kunden skriver du varför i ärendet och tar sedan bort det från schemat. Ingenting raderas på riktigt.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Schemat › ärendet › [[Radera|allman.radera]] längst ner till vänster","tar":"2 min","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna ärendet, skriv i kommunikationen varför det avbryts och tryck sedan [[Radera|allman.radera]] och [[Ta bort]]. Ärendet får status Borttaget och döljs, men all data finns kvar."},
    {"type":"visning","steg":[
      {"text":"Tryck på besöket i schemat.","ser":"Ärendet öppnas."},
      {"text":"Tryck på pratbubblan uppe till höger.","ser":"Kommunikation öppnas till höger."},
      {"text":"Skriv varför ärendet avbryts och tryck [[Skicka|rapport.skicka]].","ser":"Kommentaren visas i panelen."},
      {"text":"Stäng panelen med krysset uppe till höger.","ser":"Du är tillbaka i ärendet."},
      {"text":"Tryck [[Radera|allman.radera]] längst ner till vänster.","ser":"Rutan Ta bort ärende öppnas: Ärendet markeras som borttaget och döljs från alla vyer. All data behålls."},
      {"text":"Tryck [[Ta bort|allman.radera]].","ser":"Det står Ärendet har tagits bort och ärendet stängs."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Besöket ligger kvar i schemat","svar":"Schemat laddas inte om när du tar bort. Ladda om sidan, då är besöket borta."},
      {"fraga":"Det står Kunde inte markera ärendet som borttaget","svar":"Ingenting ändrades och ärendet ligger kvar. Försök igen."},
      {"fraga":"Jag behöver hitta ett borttaget ärende","svar":"Kryssa i Inkl. avslutade bredvid Sök ärende... i schemat. Då kommer borttagna ärenden med bland träffarna."}
    ]},
    {"type":"bra","items":[
      "Ta bort raderar inget på riktigt. Ärendet får status Borttaget och döljs. Kommentarer, bilder och historik finns kvar.",
      "Skriv alltid varför i kommentaren innan du tar bort. Kommentaren går att söka fram i efterhand.",
      "Ta bara bort ärenden som inte ska göras: kunden avbokar, kunden går inte att nå eller ärendet är en dubblett.",
      "Ska besöket bara flyttas tar du inte bort något. Dra det till den nya tiden i schemat.",
      "En ny förfrågan från en avtalskund som inte ska göras tar du inte bort. Du trycker [[Avvisa]] bland de väntande förfrågningarna och skriver AVVISA för att bekräfta."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ringt och avbokat sitt besök på tisdag. Skriv varför i ärendet och ta sedan bort det."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har tagit bort ärendet men besöket syns kvar i schemat. Varför?","alternativ":["Det gick inte att ta bort","Schemat laddas inte om förrän du laddar om sidan","Kunden måste godkänna först"],"ratt":1,"forklaring":"Ladda om sidan. Borttagna ärenden visas inte i schemat från början."},
      {"fraga":"Kunden vill byta dag. Vad gör du?","alternativ":["Tar bort ärendet och skapar ett nytt","Drar besöket till den nya dagen","Avvisar ärendet"],"ratt":1,"forklaring":"Ärendet ska vara kvar. Flytta besöket i schemat."},
      {"fraga":"Vad finns kvar efter att du tagit bort ett ärende?","alternativ":["Ingenting","Kommentarer, bilder och historik","Bara ärendenumret"],"ratt":1,"forklaring":"All data behålls. Ärendet får bara status Borttaget och döljs."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schemavyn","label":"Hitta och flytta besök i schemat","description":"När kunden bara vill byta tid."},
      {"slug":"guide-skapa-arenden","label":"Skapa ett ärende och välj rätt ärendetyp","description":"Nytt ärende från schemat."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 65, now(), array['admin','koordinator']
),
(
  'guide-dokumentsignering',
  'Skicka en offert eller ett avtal för signering',
  'Granska ett sparat utkast i Dokumentsignering och skicka det till kunden, utan att öppna Oneflow.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["koordinator","säljare"],"var":"Menyn › Dokumentsignering › Utkast, ej skickade","tar":"2 min","behover":"Ett utkast sparat med [[Spara som utkast]] i Skapa Avtal & Offerter","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna utkastet överst i kön i Dokumentsignering. Tryck [[Visa PDF]] och läs igenom. Tryck [[Skicka för signering]], för en offert [[Skicka offerten]], och svara OK på frågan. Dokumentet skickas från info@begone.se."},
    {"type":"visning","steg":[
      {"text":"Tryck på dokumentet under Utkast, ej skickade överst i kön.","ser":"Dokumentet öppnas till höger. Det står Utkast, inte skickat till kunden. Granska PDF:en och skicka."},
      {"text":"Tryck [[Visa PDF]].","ser":"Oneflows PDF öppnas, precis som kunden kommer att se den."},
      {"text":"Läs igenom. Stämmer allt, tryck [[Skicka för signering]]. För en offert heter knappen [[Skicka offerten]].","ser":"En fråga visas, till exempel Skicka avtalet till anna@exempel.se från info@begone.se?"},
      {"text":"Kontrollera e-postadressen och tryck [[OK]].","ser":"Det står Avtalet är skickat för signering, eller Offerten är skickad. Dokumentet lämnar Utkast, ej skickade och bevakas i kön."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Du kan bara hantera dina egna utkast","svar":"Som säljare skickar du bara utkast som du själv har skapat eller står som avsändare på. Be koordinatorn skicka det."},
      {"fraga":"Det står Dokumentet är inte längre ett utkast i Oneflow","svar":"Någon har redan skickat eller ändrat dokumentet i Oneflow. Tryck på Uppdatera, pilarna uppe till höger, så ser du läget."},
      {"fraga":"Det står PDF:en är inte klar ännu","svar":"Oneflow håller på att skapa PDF:en. Vänta en stund och tryck [[Visa PDF]] igen."},
      {"fraga":"Ett fält i PDF:en är tomt","svar":"Skicka inte. Felet ligger i Oneflow-mallen. Säg till en admin."},
      {"fraga":"Jag hittar inte utkastet","svar":"Sök på kundens namn eller ärendenumret i Sök kund, ärendenr… Har du dolt dokumentet trycker du på raden med antalet dolda längst ner i kön, till exempel Visa 2 dolda."}
    ]},
    {"type":"bra","items":[
      "Utkast skapar du i Skapa Avtal & Offerter med [[Spara som utkast]] i sista steget. Där kan du också skicka direkt.",
      "Dokumentet skickas från info@begone.se till kontaktpersonens e-post.",
      "Säljare ser bara sina egna dokument. Koordinatorn ser alla.",
      "Skriver du i panelen och väljer Svar i Oneflow syns texten för kunden. Internt syns bara för oss.",
      "När kunden har signerat bokar koordinatorn in jobbet med [[Boka in]] i samma panel."
    ]},
    {"type":"ovning","uppdrag":"Avtalet till Exempel AB ligger som utkast. Granska PDF:en och skicka det för signering."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hittar du ett sparat utkast?","alternativ":["I Oneflow","Överst i kön i Dokumentsignering, under Utkast, ej skickade","I kundkortet"],"ratt":1,"forklaring":"Utkasten ligger överst i kön. Du behöver inte öppna Oneflow."},
      {"fraga":"Vilken adress skickas dokumentet från?","alternativ":["Din egen e-post","info@begone.se","Kundens e-post"],"ratt":1,"forklaring":"Alla utskick går från info@begone.se. Frågan före utskicket visar vilken adress det går till."},
      {"fraga":"Ett fält är tomt i PDF:en fast du fyllde i det. Vad gör du?","alternativ":["Skickar ändå","Säger till en admin, felet ligger i mallen","Skriver till kunden i Oneflow"],"ratt":1,"forklaring":"Kunden ska aldrig få ett dokument med tomma fält. Felet ligger i Oneflow-mallen."}
    ]},
    {"type":"avslut","lankar":[],"fraga":"Koordinatorn eller admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 66, now(), array['koordinator','säljare']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
