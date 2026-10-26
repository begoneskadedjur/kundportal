-- Handboken för nya arbetsvyn (2026-10-24): stationer och kontroller för tekniker.
-- Guidemoduler i src/pages/shared/intranet/guider/, enheter telefon och dator:
--   guide-stationskontroll    Gör en stationskontroll                        (ny)
--   guide-kontrollrapport     Skicka kontrollrapporten till kunden           (slugen behålls)
--   guide-placera-stationer   Gör en etablering och placera stationerna      (slugen behålls)
--   guide-tillaggsstationer   Sätt ut en tilläggsstation                     (slugen behålls)
--   guide-stationer-sidan     Hitta en kunds stationer och kontroller        (ny)
--   guide-aterbesok-avtal     Boka ett återbesök i ett avtalsärende          (slugen behålls)
-- Interaktiva delar: interactive/nyvy/StationerForbrukning, StationerEtablering, StationerTillaggBetalas.
-- Bara tekniker. Placeringen i handboken styrs av handbokSektioner.ts. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-stationskontroll',
  'Gör en stationskontroll',
  'Kontrollbesöket i nya vyn: Jag är framme, rundan i steget Arbetet, stationsarket, snabb-OK och klarmarkeringen.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mina ärenden › kontrollbesöket › steget Arbetet","tar":"5 min","behover":"Ett bokat kontrollbesök hos en avtalskund","enhet":"mobil"},
    {"type":"kortsvar","text":"Öppna kontrollbesöket och tryck [[Jag är framme]]. I steget Arbetet trycker du [[Starta runda|station.runda]] och kontrollerar stationerna i nummerordning. När alla är kontrollerade trycker du på den gröna bocken uppe till höger, skriver Kommentar från tekniker och trycker [[Ja, klarmarkera]]."},
    {"type":"visning","steg":[
      {"text":"Öppna kontrollbesöket i Mina ärenden. Tryck [[Jag är framme]] när du står hos kunden.","ser":"Steget Arbetet öppnas med rubriken Kontrollera stationerna, kartan med numrerade stationer och listan i nummerordning. Överst står 0 av 6 stationer."},
      {"text":"Tryck [[Starta runda|station.runda]].","ser":"Raden Station 1 av 6 visas och station 1 pulserar på kartan."},
      {"text":"Tryck på station 1 på kartan eller i listan.","ser":"Stationsarket öppnas. Överst står Flytta, Byt typ och Historik, sedan senaste kontrollen och förbrukningen."},
      {"text":"Tryck [[+]] tills förbrukningen stämmer. Varje tryck är 5 gram för betongstationer.","ser":"Rutan blir grön, gul eller röd efter gränserna Varning och Kritisk under rutan."},
      {"text":"Tryck [[Spara|station.ok]].","ser":"Arket stängs, raden blir grön med Kontrollerad nu och nästa station pulserar. Tryck på den och fortsätt."},
      {"text":"När alla stationer är kontrollerade: tryck på den gröna bocken [[Klarmarkera ärende|station.klar]] uppe till höger.","ser":"Rutan Klarmarkera ärende? visar Alla stationer är inspekterade., antalen ute och inne och fältet Kommentar från tekniker."},
      {"text":"Skriv i Kommentar från tekniker hur det såg ut: aktivitet, åtgärder och vad kunden behöver göra. Tryck sedan [[Ja, klarmarkera]].","ser":"Ärendet får status Avslutat och du hamnar i steget Klart med Ärendet är avslutat. Kontrollrapporten finns nu i steget Rapport."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Ja, klarmarkera går inte att trycka på","svar":"Kommentar från tekniker måste vara skriven, och alla stationer måste vara kontrollerade, ute och inne. Rutan visar då Du har inte inspekterat alla stationer ännu. Tryck [[Avbryt]], öppna fliken Inne om kunden har stationer inomhus, och kontrollera de som saknas."},
      {"fraga":"Jag ser ingen grön bock uppe till höger","svar":"Bocken visas först när minst en station är kontrollerad. Spara en station eller använd bocken på en rad."},
      {"fraga":"En station går inte att nå","svar":"Tryck på pilen Hoppa över station i rundraden. Stationen läggs sist i kön. Besöket kan inte klarmarkeras förrän den är kontrollerad, så skriv en ticket till rollen Koordinator om den inte går att nå alls."},
      {"fraga":"Stationen står på fel plats på kartan","svar":"Öppna stationen och tryck [[Flytta|station.flytta]]. Tryck sedan på rätt plats på kartan. Notisen Station flyttad visas."},
      {"fraga":"Det står Det här saknas innan ärendet kan klarmarkeras","svar":"Portalen kontrollerar ärendet innan det stängs. Rätta det som står i listan och tryck Kontrollera igen."}
    ]},
    {"type":"bra","items":[
      "Bocken längst till höger på en rad är snabb-OK. Tryck på den och svara [[OK]] på frågan Markera Station 3 som OK? Stationen sparas utan förbrukning, foto och anteckning.",
      "Förbrukningen sätter stationens status. Under Varning är rutan grön, från Varning gul och från Kritisk röd. Väljer du ett preparat kan gränserna följa preparatet.",
      "Avsluta kontrollrunda stoppar bara ordningen. Det du har sparat finns kvar, och du kan trycka Starta runda igen.",
      "Kommentar från tekniker och kameran överst gäller hela besöket. Kommentaren krävs för att klarmarkera. Den står i kontrollrapporten och skrivs in i arbetsrapporten automatiskt. Du kan lägga till högst 10 bilder.",
      "Besöket ingår i kundens avtal och faktureras inte. Tilläggsstationer sköts i kontrollrundan och faktureras utöver avtalet."
    ]},
    {"type":"interactive","component":"nyvy/StationerForbrukning"},
    {"type":"ovning","uppdrag":"Kontrollera de tre stationerna hos Exempel AB och klarmarkera besöket. Station 2 har 15 gram förbrukning, de andra två är i ordning."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har kontrollerat 5 av 6 stationer och trycker på bocken uppe till höger. Vad händer?","alternativ":["Ärendet stängs och station 6 sparas som OK","Ja, klarmarkera går inte att trycka på förrän alla 6 är kontrollerade","Station 6 flyttas till nästa besök"],"ratt":1,"forklaring":"Klarmarkeringen kräver att alla stationer är kontrollerade, ute och inne."},
      {"fraga":"En betongstation har 30 gram förbrukning. Gränserna är Varning: 10 och Kritisk: 25. Vilken färg får rutan?","alternativ":["Grön","Gul","Röd"],"ratt":2,"forklaring":"30 är över Kritisk: 25, så rutan blir röd och stationen sparas med betydande aktivitet."},
      {"fraga":"När använder du bocken på raden, snabb-OK?","alternativ":["När stationen är i ordning och inget ska fyllas i","När stationen har förbrukning","När stationen inte går att nå"],"ratt":0,"forklaring":"Snabb-OK sparar stationen som OK utan förbrukning. Har stationen förbrukning öppnar du den i stället."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-kontrollrapport","label":"Skicka kontrollrapporten till kunden","description":"PDF, Excel och mejl i steget Rapport."},
      {"slug":"guide-tillaggsstationer","label":"Sätt ut en tilläggsstation","description":"Stationer utöver avtalet och Byt typ."},
      {"slug":"guide-stationer-sidan","label":"Hitta en kunds stationer och kontroller","description":"Sidan Stationer och kundens sida."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 20, now(), array['technician']
),
(
  'guide-kontrollrapport',
  'Skicka kontrollrapporten till kunden',
  'Kontrollrapporten i steget Rapport: PDF, Excel och mejl till kunden, och var kunden själv hittar den.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Kontrollbesöket › steget Rapport","tar":"3 min","behover":"En klarmarkerad stationskontroll","enhet":"mobil"},
    {"type":"kortsvar","text":"När kontrollen är klarmarkerad finns kortet Kontrollrapport i steget Rapport. Tryck [[Skicka till kund]], kontrollera adressen, tryck [[Skicka]] och sedan [[Bekräfta och skicka]]. Kunden hittar samma rapport i sin portal under Rapporter."},
    {"type":"visning","steg":[
      {"text":"Tryck på ikonen för steget Rapport i stegraden, den tredje från vänster.","ser":"Steget Rapport visar Arbetsrapport och kortet Kontrollrapport med Kontrollrunda avslutad 2026-10-26 och knapparna PDF, Excel och Skicka till kund."},
      {"text":"Tryck [[PDF]] om du vill ha rapporten själv.","ser":"PDF:en laddas ned. Den skapas med karta och planritningar, det kan ta upp till en halv minut."},
      {"text":"Tryck [[Skicka till kund]].","ser":"Fältet Mottagare öppnas med kundens kontaktadress ifylld."},
      {"text":"Kontrollera adressen. Vill kunden ha rapporten till någon annan: tryck i fältet och skriv den adressen.","ser":"Adressen står i fältet och Skicka går att trycka på."},
      {"text":"Tryck [[Skicka]].","ser":"Frågan Skicka kontrollrapporten som PDF till adressen? visas med Avbryt och Bekräfta och skicka."},
      {"text":"Tryck [[Bekräfta och skicka]].","ser":"Notisen Kontrollrapporten skickad till adressen visas. Kunden får rapporten som PDF i mejlet."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Kortet Kontrollrapport syns inte","svar":"Det visas först när kontrollrundan är klarmarkerad. Gå till steget Arbetet och klarmarkera rundan."},
      {"fraga":"Det står Kunden saknar kontakt-e-post i kundregistret, ange mottagare manuellt.","svar":"Skriv adressen i Mottagare. Be koordinatorn lägga in adressen på kunden så att den finns nästa gång."},
      {"fraga":"Det står Ange en giltig e-postadress.","svar":"Adressen saknar något, till exempel @ eller punkt. Rätta den, så går Skicka att trycka på."},
      {"fraga":"Kunden säger att mejlet inte kom","svar":"Rapporten skickas från noreply@begone.se. Be kunden titta i skräpposten. Bilagor över 8 MB skickas inte, ladda då ned PDF:en och skriv en ticket till rollen Koordinator."}
    ]},
    {"type":"bra","items":[
      "Kunden hittar samma rapport själv i sin portal under Rapporter, fliken Kontrollrapporter, som PDF eller Excel.",
      "Rapporten skickas aldrig av sig själv. Du skickar den med Skicka till kund.",
      "Svar från kunden går till info@begone.se, inte till dig.",
      "I Ärendets verktyg uppe till höger leder Kontrollrapport också till steget Rapport."
    ]},
    {"type":"ovning","uppdrag":"Skicka kontrollrapporten för Brf Exempelgården till förvaltaren, forvaltning@exempelgarden.se, i stället för kundens vanliga adress."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hittar kunden kontrollrapporten utan att du mejlar den?","alternativ":["I sin portal under Rapporter, fliken Kontrollrapporter","Bara i mejlet från dig","På fakturan"],"ratt":0,"forklaring":"Avslutade kontrollrundor syns i kundportalen under Rapporter, med PDF och Excel."},
      {"fraga":"Du står i steget Rapport men kortet Kontrollrapport syns inte. Varför?","alternativ":["Kunden saknar e-post","Kontrollrundan är inte klarmarkerad än","Rapporten är redan skickad"],"ratt":1,"forklaring":"Kortet visas först när rundan är klarmarkerad i steget Arbetet."},
      {"fraga":"Kunden vill att förvaltaren får rapporten. Vad gör du?","alternativ":["Skriver förvaltarens adress i Mottagare innan du trycker Skicka","Ber kunden vidarebefordra mejlet","Ändrar kundens e-post i kundregistret"],"ratt":0,"forklaring":"Mottagare går att ändra fritt. Kundregistret ändras inte av det."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-stationskontroll","label":"Gör en stationskontroll","description":"Rundan, stationsarket och klarmarkeringen."},
      {"slug":"guide-specialrapporter","label":"Skriv en specialrapport","description":"När kunden behöver mer än kontrollrapporten."},
      {"slug":"guide-stationer-sidan","label":"Hitta en kunds stationer och kontroller","description":"Sidan Stationer och kundens sida."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 21, now(), array['technician']
),
(
  'guide-placera-stationer',
  'Gör en etablering och placera stationerna',
  'Etableringsbesöket i nya vyn: Gå till utplacering, Utomhus eller Inomhus, Hämta GPS, Skapa placering och Färdig med etablering.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Etableringsbesöket › steget Arbetet › Gå till utplacering","tar":"6 min","behover":"Ett bokat etableringsbesök och stationerna med dig","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Jag är framme]] och [[Gå till utplacering|bokning.etablering]] i steget Arbetet. Välj Utomhus, välj typ, tryck [[Hämta GPS]] och [[Skapa placering]] för varje station. När alla är ute trycker du [[Färdig med etablering]] och skriver en Kommentar från tekniker. Etableringen ingår i avtalet, bara tilläggsstationer faktureras."},
    {"type":"visning","steg":[
      {"text":"Öppna etableringsbesöket och tryck [[Jag är framme]].","ser":"Steget Arbetet visar Placera ut stationerna och knappen Gå till utplacering."},
      {"text":"Tryck [[Gå till utplacering|bokning.etablering]].","ser":"Ärendefönstret stängs och sidan Stationer öppnas med rutan Välj typ. Kunden är redan vald. Ärendet är fortfarande öppet."},
      {"text":"Tryck Utomhus.","ser":"Placera station utomhus öppnas med Utrustningstyp, Tillägg utöver avtal och GPS-position."},
      {"text":"Tryck på typen, till exempel Betongstation.","ser":"Typen markeras grön. Mekanisk fälla kräver också serienummer."},
      {"text":"Stå vid stationen och tryck [[Hämta GPS]].","ser":"Rutan blir grön med GPS hämtad, och Noggrannhet visas under."},
      {"text":"Tryck [[Skapa placering]].","ser":"Stationen är placerad visas med antalet placerade nu och knapparna Placera fler utomhus, Placera inomhus och Färdig med etablering."},
      {"text":"När alla stationer är ute: tryck [[Färdig med etablering]], skriv en Kommentar från tekniker och tryck [[Avsluta etablering]].","ser":"Etableringsärendet stängs. Arbetsrapporten skrivs automatiskt med antalet stationer och din kommentar. Har kunden inget schema frågar portalen Återkommande kontroller med Senare och Lägg upp schema."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står GPS-position krävs. Tryck på Hämta GPS.","svar":"Tryck [[Hämta GPS]], eller [[Välj på karta]] och tryck på platsen på kartan."},
      {"fraga":"Noggrannheten är dålig","svar":"Gå ut i det fria en bit från husväggen, eller använd Välj på karta och markera platsen själv."},
      {"fraga":"Jag tryckte på krysset eller Avbryt i formuläret","svar":"Krysset och Avbryt stänger bara rutan. Stationerna du har placerat är sparade och etableringen är fortfarande öppen. Fortsätt eller avsluta den med Färdig med etablering i rutan Pågående etablering överst på Stationer."},
      {"fraga":"Etableringen tar mer än en dag","svar":"Lämna ärendet öppet. Nästa dag står det under Pågående etablering på sidan Stationer och på kundens sida, med till exempel 4 av 6 stationer placerade och knappen Placera station."},
      {"fraga":"Kunden har ingen planritning när jag väljer Inomhus","svar":"Portalen visar Inga planritningar. Ladda upp en bild på planritningen i samma ruta och placera sedan stationerna på den."}
    ]},
    {"type":"bra","items":[
      "Etableringen och avtalets stationer ingår i avtalet och faktureras inte. Stationer kunden betalar för utöver avtalet bockar du i som Tillägg utöver avtal, de faktureras.",
      "Finns tilläggsstationer visar portalen Stäng ärendet och skicka till fakturering med raderna innan ärendet stängs. Tryck Stäng och fakturera.",
      "Avsluta etablering i rutan Pågående etablering frågar först och vill ha en Kommentar från tekniker. Är alla ute heter knappen Avsluta etablering, saknas stationer heter den Avsluta ändå. Arbetsrapporten skrivs automatiskt med antalet stationer och kommentaren, du ser den i steget Rapport efteråt.",
      "Inomhus väljer du planritningen och trycker på platsen där stationen står. Ute och inne kan blandas i samma etablering.",
      "Placera fler utomhus kommer ihåg typen från förra stationen. Kontrollera den innan du sparar."
    ]},
    {"type":"interactive","component":"nyvy/StationerEtablering"},
    {"type":"ovning","uppdrag":"Exempel AB har avtal på 3 betongstationer runt fastigheten. Placera alla tre utomhus och avsluta etableringen."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har satt ut 4 av avtalets 6 stationer och måste åka. Vad gör du?","alternativ":["Trycker Färdig med etablering","Lämnar etableringen öppen och fortsätter nästa dag från Pågående etablering","Skapar ett nytt etableringsärende i morgon"],"ratt":1,"forklaring":"Etableringen står kvar under Pågående etablering med 4 av 6 stationer placerade tills du avslutar den."},
      {"fraga":"Kunden vill ha två stationer till utöver avtalet. Hur placerar du dem?","alternativ":["Som vanliga stationer, kontoret räknar ut det","Bockar i Tillägg utöver avtal i formuläret och väljer hur de betalas","Skriver det i rapporten"],"ratt":1,"forklaring":"Bara stationer med Tillägg utöver avtal faktureras. Andra räknas som avtalets stationer."},
      {"fraga":"Faktureras etableringen?","alternativ":["Ja, alltid","Nej, den ingår i avtalet, bara tilläggsstationer faktureras","Bara om den tar mer än en timme"],"ratt":1,"forklaring":"Etableringen är en del av avtalet. Tilläggsstationerna räknas när du avslutar och faktureras då."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-tillaggsstationer","label":"Sätt ut en tilläggsstation","description":"Stationer utöver avtalet och hur de betalas."},
      {"slug":"guide-stationer-sidan","label":"Hitta en kunds stationer och kontroller","description":"Pågående etablering, kundens sida och schemat."},
      {"slug":"guide-stationskontroll","label":"Gör en stationskontroll","description":"Nästa besök hos kunden."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 22, now(), array['technician']
),
(
  'guide-tillaggsstationer',
  'Sätt ut en tilläggsstation',
  'Station utöver avtalet: Tillägg utöver avtal, per år, per månad eller per kontroll, vad som faktureras och Byt typ.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Stationer › kunden › Placera ny station","tar":"4 min","behover":"Kunden har beställt stationen utöver avtalet","enhet":"mobil"},
    {"type":"kortsvar","text":"Placera stationen som vanligt och bocka i [[Tillägg utöver avtal]] i formuläret. Välj under Betalas hur kunden betalar: per år, per månad eller per kontroll. Tilläggsstationer faktureras, avtalets stationer gör det inte."},
    {"type":"visning","steg":[
      {"text":"På kundens sida under Stationer: tryck [[Placera ny station|falt.nystation]]. Pågår en etablering heter knappen Placera station i rutan Pågående etablering.","ser":"Rutan Välj typ öppnas med kunden vald och frågan Var ska stationen placeras?"},
      {"text":"Tryck Utomhus.","ser":"Placera station utomhus öppnas."},
      {"text":"Tryck på typen, till exempel Betongstation.","ser":"Typen markeras grön."},
      {"text":"Bocka i [[Tillägg utöver avtal]].","ser":"Betalas visas med per år, per månad och per kontroll, med priserna ur kundens prislista."},
      {"text":"Tryck på hur kunden betalar, till exempel per år.","ser":"Valet markeras och texten under förklarar hur det faktureras."},
      {"text":"Stå vid stationen och tryck [[Hämta GPS]].","ser":"Rutan blir grön med GPS hämtad."},
      {"text":"Tryck [[Skapa placering]].","ser":"Stationen är placerad visas. Stationen har en liten markering för tillägg och står som tillägg utöver avtal i stationens ark."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Per år och per månad går inte att välja","svar":"Det står Kräver att kunden har ett avtal i avtalskartan. Välj per kontroll, eller skriv en ticket till rollen Koordinator."},
      {"fraga":"Det står pris saknas","svar":"Kundens prislista saknar priset för den typen. Placera stationen och skriv en ticket till rollen Koordinator så att priset läggs in."},
      {"fraga":"Stationen har fel typ","svar":"Öppna stationen och tryck [[Byt typ|station.byttyp]]. Byt stationstyp öppnas. Välj den nya typen och tryck Byt till Betongstation. Tidigare kontroller står kvar som den gamla typen."},
      {"fraga":"Byt typ går inte att trycka på","svar":"Kunden har betalat för stationen framåt. Det står Typen kan inte bytas, kunden har betalat för stationen till och med datumet. Skriv en ticket till rollen Koordinator."},
      {"fraga":"Kunden vill inte ha tilläggsstationen längre","svar":"Öppna stationen i kontrollrundan, tryck [[Hämta upp|station.hamtaupp]] och sedan Spara och hämta upp. Avtalsstationer hämtas inte upp av tekniker."}
    ]},
    {"type":"bra","items":[
      "Tilläggsstationer ingår inte i avtalets årspremie och faktureras. Avtalets stationer och själva etableringen faktureras inte.",
      "Per år betalas för månaderna kvar till avtalets nästa år och sedan med årsfakturan. Per månad faktureras månadsvis. Per kontroll debiteras etablering och varje kontrollrunda.",
      "När du avslutar etableringen visar portalen Stäng ärendet och skicka till fakturering med Pris per station och Antal. Tryck Stäng och fakturera.",
      "Är priset under listpriset går raden till rabattgodkännande.",
      "Byter du typ på en tilläggsstation gäller den nya typens pris, och kontoret får en notis."
    ]},
    {"type":"interactive","component":"nyvy/StationerTillaggBetalas"},
    {"type":"ovning","uppdrag":"Brf Exempelgården vill ha en betongstation till vid soprummet, utöver avtalet. De betalar per månad. Sätt ut den."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har avtal på 6 stationer och vill ha en sjunde. Vad gäller?","alternativ":["Den ingår i avtalet","Den sätts ut som Tillägg utöver avtal och faktureras","Den faktureras först nästa år"],"ratt":1,"forklaring":"Allt utöver avtalets stationer är tillägg och faktureras enligt valet under Betalas."},
      {"fraga":"Du satte ut en mekanisk fälla men det skulle vara en betongstation. Vad gör du?","alternativ":["Tar bort stationen och placerar en ny","Öppnar stationen och trycker Byt typ","Skriver det i anteckningen"],"ratt":1,"forklaring":"Byt typ behåller stationen och historiken. Tidigare kontroller står kvar som den gamla typen."},
      {"fraga":"Kunden har inget avtal i avtalskartan. Vilket betalningssätt går att välja?","alternativ":["per kontroll","per år","per månad"],"ratt":0,"forklaring":"Per år och per månad kräver ett avtal i avtalskartan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-placera-stationer","label":"Gör en etablering och placera stationerna","description":"Hela etableringen från Gå till utplacering."},
      {"slug":"guide-stationskontroll","label":"Gör en stationskontroll","description":"Tilläggen kontrolleras i rundan som de andra."},
      {"slug":"guide-stationer-sidan","label":"Hitta en kunds stationer och kontroller","description":"Kundens sida, stationens ark och schemat."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 23, now(), array['technician']
),
(
  'guide-stationer-sidan',
  'Hitta en kunds stationer och kontroller',
  'Sidan Stationer: Kunder, Karta och Kontroller, Alla eller Mina, sök och sortering, kundens sida och schemat.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"I telefonen: Mer › Stationer. På datorn: Stationer i sidomenyn","tar":"4 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Stationer listar kunderna med stationer. Välj [[Alla]] eller [[Mina]], sök på kunden och tryck på den för att se stationerna på karta, i lista och på planritning. Fliken [[Kontroller|utrustning.kontroller]] visar försenade och bokade kontroller och kunder utan schema."},
    {"type":"visning","steg":[
      {"text":"Tryck Stationer. I telefonen står den under [[Mer|allman.meny]], Hos kunden. På datorn står den i sidomenyn.","ser":"Stationer öppnas med kunderna och väljaren Kunder, Karta och Kontroller. Pågår en etablering står Att göra överst."},
      {"text":"Tryck [[Mina]] bredvid sorteringen.","ser":"Listan visar bara kunder där du själv har placerat stationer. Alla visar kunder där någon i teamet har placerat."},
      {"text":"Tryck i sökrutan och skriv kundens namn.","ser":"Listan visar kunderna som matchar. Du kan söka på kund, enhet, adress eller org.nr."},
      {"text":"Tryck på kunden.","ser":"Kundens sida öppnas med Ring, Mejla och Navigera, och väljaren Karta, Lista, Planritning och Schema."},
      {"text":"Tryck på en station på kartan.","ser":"Stationens ark öppnas med Flytta, Byt typ och Historik, och Status, Placerad och Senaste kontroll."},
      {"text":"Tryck [[Schema|kund.schema]] i väljaren.","ser":"Kundens återkommande kontroller visas. Saknas schema står knappen Skapa kontrollschema där."},
      {"text":"Tillbaka på Stationer: tryck [[Kontroller|utrustning.kontroller]].","ser":"Försenade, Idag, Denna vecka och Saknar schema. Boka om öppnar kundens schema, Schemalägg lägger upp ett nytt."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Kunden finns inte i listan","svar":"Står du på Mina? Tryck [[Alla]]. Kunder utan stationer visas inte alls. Står det Ingen kund matchar sökningen. finns inget som matchar det du skrev."},
      {"fraga":"Kartan visar inte alla stationer","svar":"Fliken Karta på Stationer visar bara stationerna du själv har placerat, oavsett Alla eller Mina. Kundens alla stationer ser du på kundens sida."},
      {"fraga":"Det står Inget schema på kunden","svar":"Tryck [[Schemalägg|arendelista.boka]] på raden. Samma knapp finns under Kontroller, Saknar schema."},
      {"fraga":"En kontroll är försenad","svar":"Den står under Försenade i Kontroller. Tryck [[Boka om|kund.schema]] för kundens schema, eller pilen för att öppna kontrollen."}
    ]},
    {"type":"bra","items":[
      "Sorteringen har A till Ö, Flest stationer, Avvikelser först, Senast kontrollerad och Saknar schema först.",
      "Antalen på raden är kundens alla stationer, även i läget Mina.",
      "Stationskartan som PDF finns på kundens sida, samma karta som kunden kan ta ut i sin portal.",
      "Pågår en etablering hos kunden står Pågående etablering överst på kundens sida, med Placera station och Avsluta etablering.",
      "Frågetecknet uppe till höger går igenom sidan steg för steg."
    ]},
    {"type":"ovning","uppdrag":"Kollegan Anna Exempel satte ut stationerna hos Brf Exempelgården. Hitta kunden och öppna kundens schema."},
    {"type":"quiz","fragor":[
      {"fraga":"Du hittar inte en kund där Anna Exempel satte ut stationerna. Vad är troligast?","alternativ":["Du står på Mina","Kunden saknar schema","Kunden har avvikelser"],"ratt":0,"forklaring":"Mina visar bara kunder där du själv har placerat stationer. Tryck Alla."},
      {"fraga":"Var ser du vilka kontroller som är försenade?","alternativ":["Fliken Kontroller på Stationer","Fliken Karta på Stationer","Kundens Lista"],"ratt":0,"forklaring":"Kontroller visar Försenade, Idag, Denna vecka och Saknar schema."},
      {"fraga":"Kunden har stationer men inga återkommande kontroller. Vilken knapp trycker du på?","alternativ":["Boka om","Schemalägg","Navigera"],"ratt":1,"forklaring":"Schemalägg lägger upp kontrollerna. Boka om flyttar en kontroll som redan är bokad."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-placera-stationer","label":"Gör en etablering och placera stationerna","description":"Placera station och Pågående etablering."},
      {"slug":"guide-stationskontroll","label":"Gör en stationskontroll","description":"Rundan hos kunden."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Menyn, Mer och sidomenyn."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 24, now(), array['technician']
),
(
  'guide-aterbesok-avtal',
  'Boka ett återbesök i ett avtalsärende',
  'Avtalsärendet i nya vyn: steget Klart, Bara besöket och Boka återbesök. Ärendet står kvar öppet.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Avtalsärendet › steget Klart › Bara besöket","tar":"3 min","behover":"Ett avtalsärende som ska fortsätta, till exempel ett extrabesök","enhet":"mobil"},
    {"type":"kortsvar","text":"Gå till steget Klart och välj Bara besöket. Tryck [[Boka återbesök|arende.aterbesok]], välj ny tid i Start * och tryck [[Boka återbesök]] igen. Ärendet får status Återbesök och stängs inte."},
    {"type":"visning","steg":[
      {"text":"Tryck på ikonen för steget Klart, sist i stegraden.","ser":"Klart visar Kontrollera innan du stänger och Vad är klart? med Hela ärendet och Bara besöket."},
      {"text":"Tryck Bara besöket.","ser":"Det här händer när du bokar återbesöket visas, och knappen Boka återbesök."},
      {"text":"Tryck [[Boka återbesök|arende.aterbesok]].","ser":"Rutan Boka återbesök öppnas med Schemalägg uppföljning för detta ärende och Nuvarande datum."},
      {"text":"Tryck i Start * och välj ny dag och tid.","ser":"Tiden står i fältet. Slut (valfritt) kan vara tomt: då blir besöket lika långt som nuvarande besök, annars 1 timme."},
      {"text":"Skriv gärna vad som ska göras i Anteckning för återbesöket (valfritt).","ser":"Anteckningen följer med återbesöket."},
      {"text":"Tryck [[Boka återbesök]] längst ner.","ser":"Notisen Återbesök bokat. visas och rutan stängs. Ärendet har status Återbesök och står kvar öppet."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Samma tid som nuvarande besök. Välj en ny tid.","svar":"Återbesöket kan inte börja samma tid som besöket du står i. Välj en annan tid i Start *."},
      {"fraga":"Boka återbesök går inte att trycka på","svar":"Start * måste ha en ny tid. Tryck i fältet och välj dag och tid."},
      {"fraga":"Klart visar Ärendet är avslutat","svar":"Ärendet är redan stängt. Skriv en ticket till rollen Koordinator om kunden behöver ett nytt besök."},
      {"fraga":"Det står Motivera rabatten på artikeln under Tjänster & fakturarader innan delfakturering.","svar":"En rad har rabatt utan motivering. Öppna Alla uppgifter med ikonen uppe till höger, skriv motiveringen och boka igen. Eller boka utan Delfakturera dessa artiklar nu."}
    ]},
    {"type":"bra","items":[
      "Återbesöket stänger inte ärendet. Besöket sparas i besökshistoriken, och rapport, tid, material och bedömning töms inför nästa besök.",
      "Delfakturera dessa artiklar nu visas när ärendet har tillagda artiklar med inköpskostnad som inte är fakturerade. I ett avtalsärende gäller det bara det som är tillagt utöver avtalet.",
      "Samma ruta öppnar du från Ärendets verktyg uppe till höger, Boka återbesök.",
      "Stationskontroller stänger du med Klarmarkera i kontrollrundan i steget Arbetet, inte med Hela ärendet."
    ]},
    {"type":"ovning","uppdrag":"Extrabesöket hos Exempel AB är gjort, men du ska tillbaka 9 nov. 2026 08:00 för att se om råttorna har ätit av betet. Boka återbesöket från steget Klart."},
    {"type":"quiz","fragor":[
      {"fraga":"Vad händer med ärendet när du bokar ett återbesök?","alternativ":["Det stängs och ett nytt ärende skapas","Det får status Återbesök och står kvar öppet","Det faktureras direkt"],"ratt":1,"forklaring":"Bara besöket låter ärendet fortsätta. Besöket sparas i besökshistoriken."},
      {"fraga":"Du lämnar Slut (valfritt) tomt. Hur långt blir återbesöket?","alternativ":["En hel dag","Lika långt som nuvarande besök, annars 1 timme","30 minuter"],"ratt":1,"forklaring":"Tomt slut ger samma längd som nuvarande besök. Saknas den blir det 1 timme."},
      {"fraga":"Kunden har köpt extra material utöver avtalet och ska betala det nu. Var gör du det?","alternativ":["Bockar i Delfakturera dessa artiklar nu i samma ruta","Skapar en ny faktura","Väntar tills ärendet stängs"],"ratt":0,"forklaring":"Delfakturera görs tillsammans med återbesöket och gäller bara det som är tillagt utöver avtalet."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma sak i privat- och företagsärenden."},
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera material innan ärendet stängs."},
      {"slug":"guide-stationskontroll","label":"Gör en stationskontroll","description":"Kontrollbesöket och klarmarkeringen."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 25, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
