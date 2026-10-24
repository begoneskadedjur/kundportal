-- Handboken för nya arbetsvyn (2026-10-24), gruppen Min dag. Bara tekniker.
--   guide-din-dag            ny      Planera dagen med Idag och Karta
--   guide-schema-tekniker    ny      Se ditt schema som dag, vecka och månad (guide-schemavyn är kontorets och lämnas orörd)
--   guide-mina-arenden       ny      Håll koll på dina ärenden i Mina ärenden
--   guide-sokrutan-tekniker  omskriven för nya vyn, slugen behålls för läsloggen
--   guide-rapportera-tillbud omskriven för nya vyn, slugen behålls för läsloggen
-- Guidemoduler: src/pages/shared/intranet/guider/<slug>.tsx, enheter telefon och dator.
-- Interaktiva delar: interactive/nyvy/NastaUppdrag, HurFullDag, VarHamnarArendet, SokTolkning.
-- Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-din-dag',
  'Planera dagen med Idag och Karta',
  'Nästa uppdrag med restid, dagens rutt, Att göra och morgondagens stopp på kartan.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"[[Idag|falt.idag]] och [[Karta|falt.karta]]: i telefonen längst ner, på datorn i sidomenyn under Min dag","tar":"4 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Idag visar nästa uppdrag överst med restiden och knapparna [[Navigera|falt.navigera]], [[Ring|kontakt.telefon]] och [[Öppna|arende.arende]]. Under står dagens rutt, Att göra och Imorgon. [[Karta|falt.karta]] visar samma besök som numrerade stopp, idag eller imorgon."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Idag|falt.idag]].","ser":"Överst står Nästa uppdrag: tiden, hur länge det är kvar, kunden och adressen. Under adressen står restiden, till exempel Ca 12 min med bil härifrån, 8,4 km."},
      {"text":"Tryck [[Navigera|falt.navigera]] i Nästa uppdrag.","ser":"Vägbeskrivningen till kunden öppnas i Google Maps. [[Ring|kontakt.telefon]] bredvid ringer kontaktpersonen."},
      {"text":"Tryck [[Öppna|arende.arende]] när du är framme.","ser":"Ärendet öppnas på steget Framme. Den gröna knappen heter [[Jag är framme]]."},
      {"text":"Tryck på krysset uppe till höger i ärendet.","ser":"Ärendet stängs och du är tillbaka på Idag. Listan läses om, så det du har gjort syns direkt."},
      {"text":"Tryck på rutan Imorgon, 2 besök.","ser":"Kartan öppnas med morgondagens stopp. På rutan står också när första besöket börjar."},
      {"text":"Tryck [[Idag, 3 stopp]] överst på kartan.","ser":"Kartan visar dagens stopp med siffror i den ordning besöken är bokade. Stopp 1 är dagens första besök."},
      {"text":"Tryck på stopp 2 i listan. I telefonen ligger listan under kartan, på datorn till höger.","ser":"Stopp 2 av 3 blir valt, med adressen, restiden och knapparna Navigera, Ring och Öppna. Knapparna gäller alltid stoppet som är valt."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Restiden syns inte under adressen","svar":"Raden visas bara när restiden gick att räkna. Telefonen frågar första gången om portalen får använda din position: svara ja. Har bilen Abax används bilens position, då står det Från bilen."},
      {"fraga":"[[Navigera|falt.navigera]] eller [[Ring|kontakt.telefon]] är grå","svar":"Adressen eller telefonnumret saknas i ärendet. Öppna ärendet och kontrollera uppgifterna, eller skriv en ticket till rollen Koordinator."},
      {"fraga":"Det står Adressen hittades inte på kartan.","svar":"Kartan hittade inte adressen. Stoppet finns ändå i listan med samma siffra, och Navigera söker på adressen som den står i ärendet."},
      {"fraga":"Det står Kartan kunde inte laddas. Listan nedan fungerar ändå.","svar":"Kontrollera täckningen och öppna Karta igen. Stoppen och knapparna i listan fungerar ändå."},
      {"fraga":"Det står Kunde inte hämta din position. Kontrollera att platstjänster är på.","svar":"Telefonen ger inte portalen din position. Slå på platstjänster för webbläsaren i telefonens inställningar och tryck på positionsknappen uppe till höger på kartan igen."}
    ]},
    {"type":"bra","items":[
      "Nästa uppdrag är dagens första besök som inte är klart. Ett besök som slutade för mer än en timme sedan hoppas över när det finns fler besök kvar.",
      "Att göra visar det som inte hör till dagens besök: Offerter att följa upp (förfallna eller som väntat minst 5 dagar), Ärenden att boka och Besök att avsluta. Tryck på raden så öppnas rätt sida.",
      "Raden under rubriken, till exempel Måndag 26 oktober, 3 besök, öppnar Schema.",
      "Klara besök får en bock i Dagens rutt och ett grått stopp på kartan.",
      "Positionsknappen uppe till höger på kartan visar var du är. Har bilen Abax används bilens position, annars telefonens."
    ]},
    {"type":"interactive","component":"nyvy/NastaUppdrag"},
    {"type":"ovning","uppdrag":"Familjen Exempel ringer och undrar när du kommer imorgon. Hitta besöket på kartan."},
    {"type":"quiz","fragor":[
      {"fraga":"Navigera är grå i Nästa uppdrag. Varför?","alternativ":["Adressen saknas i ärendet","Du har inte tryckt Jag är framme","Telefonen saknar täckning"],"ratt":0,"forklaring":"Navigera behöver en adress. Saknas den är knappen grå och visar Adress saknas."},
      {"fraga":"Ett besök från i fredags är inte avslutat. Var syns det på Idag?","alternativ":["Under Dagens rutt","Under Att göra, som Besök att avsluta","Ingenstans, det är för gammalt"],"ratt":1,"forklaring":"Besök vars datum har passerat utan att de avslutats står under Att göra, med Datumet har passerat."},
      {"fraga":"Vad betyder siffran 2 på kartan?","alternativ":["Andra stoppet i den ordning besöken är bokade","Två kunder på samma adress","Två timmar till besöket"],"ratt":0,"forklaring":"Stoppen är numrerade i den ordning de är bokade. Samma siffra står i listan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schema-tekniker","label":"Se ditt schema som dag, vecka och månad","description":"Hela veckan, lediga stunder och körtid."},
      {"slug":"guide-mina-arenden","label":"Håll koll på dina ärenden","description":"Det som väntar på dig och passerade besök."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn och Mer."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 2, now(), array['technician']
),
(
  'guide-schema-tekniker',
  'Se ditt schema som dag, vecka och månad',
  'Byt mellan Dag, Vecka och Månad, öppna ett besök och sök bland dina ärenden på alla datum.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"[[Schema|allman.kalender]]: i telefonen under [[Mer|allman.meny]], på datorn i sidomenyn under Min dag","tar":"5 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Schemat visar dina besök som [[Dag|falt.idag]], [[Vecka|falt.vecka]] eller [[Månad|falt.manad]]. I telefonen börjar det på Dag med veckan överst, på datorn på Vecka. Tryck på ett besök för att öppna det. Sökfältet hittar dina ärenden på alla datum."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Schema|allman.kalender]]. I telefonen står den under [[Mer|allman.meny]].","ser":"Schemat öppnas. I telefonen på Dag med veckan överst och en rad om hur mycket som är bokat. På datorn på Vecka, med besöken i tid."},
      {"text":"Tryck [[Månad|falt.manad]].","ser":"Hela månaden visas. Siffran är antal besök och punkten visar hur full dagen är."},
      {"text":"Tryck på 27 i månaden.","ser":"Tisdag 27 oktober öppnas i läget Dag. Mellan besöken står körtiden och de lediga stunderna, till exempel Ledigt 09:00 till 10:00."},
      {"text":"Tryck på besöket hos Familjen Exempel klockan 10:00.","ser":"I telefonen fälls besöket ut med Navigera, Ring och Öppna. På datorn visas det under Valt besök till höger."},
      {"text":"Tryck [[Öppna|arende.arende]]. På datorn heter knappen [[Öppna ärendet|arende.arende]].","ser":"Ärendet öppnas på steget Framme. Krysset uppe till höger tar dig tillbaka till schemat."},
      {"text":"Tryck i sökfältet och skriv Exempelgården.","ser":"Träffarna visas per dag, på alla datum. [[Rensa|allman.stang]] tar bort sökningen."},
      {"text":"Tryck [[Visa dagen]] vid Onsdag 28 oktober.","ser":"Schemat visar onsdagen i läget Dag och sökningen töms."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Ett besök syns inte i schemat","svar":"Kontrollera filtret. I telefonen har [[Filter|allman.filter]] en grön punkt när något är bortvalt. Tryck [[Återställ filtret]]. Stängda ärenden är dolda från början."},
      {"fraga":"Det står Inte klarmarkerat på ett besök","svar":"Datumet har passerat men besöket är inte avslutat. Öppna ärendet och avsluta besöket."},
      {"fraga":"En dag står som Ledig fast jag jobbar","svar":"Arbetstiden och de lediga dagarna kommer från ditt arbetsschema, och Frånvaro från den frånvaro som är registrerad på dig. Stämmer det inte, be koordinatorn ändra det."},
      {"fraga":"Det står Inga träffar","svar":"Sökfältet hittar bara dina egna ärenden. Skriv minst två tecken av kundens namn, adressen, telefonnumret eller ärendenumret."}
    ]},
    {"type":"bra","items":[
      "Under varje dag står hur många av dagens arbetstimmar som är bokade, till exempel 5 av 8 tim bokade. Punkten är grön vid Plats kvar, gul vid Nästan fullt och röd vid Fullt.",
      "Mellan besöken står körtiden med bil, till exempel 14 min körning. Lediga stunder på minst en halvtimme står som till exempel Ledigt 09:00 till 10:00.",
      "Filtret väljer typ av besök och status. I telefonen: [[Filter|allman.filter]] bredvid sökfältet. På datorn: rutan Visa till höger. Klara besök visas nedtonade.",
      "I telefonen byter du vecka med pilarna eller genom att svepa åt sidan i veckan. [[Idag|falt.idag]] hoppar tillbaka till idag.",
      "[[Uppdatera|allman.aterstall]] hämtar schemat på nytt. Bredvid står när det senast uppdaterades."
    ]},
    {"type":"interactive","component":"nyvy/HurFullDag"},
    {"type":"ovning","uppdrag":"Brf Exempelgården har ringt om besöket på torsdag. Öppna besöket i schemat."},
    {"type":"quiz","fragor":[
      {"fraga":"Under onsdag står 7,5 av 8 tim bokade och en röd punkt. Vad betyder det?","alternativ":["Dagen är full","Du har frånvaro den dagen","Besöken är försenade"],"ratt":0,"forklaring":"Från 90 procent av arbetstiden står dagen som Fullt, med röd punkt."},
      {"fraga":"Ett besök från förra veckan står som Inte klarmarkerat. Vad gör du?","alternativ":["Ingenting, det försvinner av sig självt","Öppnar ärendet och avslutar besöket","Väljer bort det i filtret"],"ratt":1,"forklaring":"Det står kvar tills besöket är avslutat. Det syns också under Passerade besök att avsluta i Mina ärenden."},
      {"fraga":"Du söker på en kund i schemat men får inga träffar. Vad är troligast?","alternativ":["Ärendet är en kollegas, sökfältet visar bara dina","Schemat visar bara idag","Du måste trycka Uppdatera först"],"ratt":0,"forklaring":"Sökfältet i schemat letar i dina egna ärenden, på alla datum."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-din-dag","label":"Planera dagen med Idag och Karta","description":"Nästa uppdrag, rutten och restiden."},
      {"slug":"guide-mina-arenden","label":"Håll koll på dina ärenden","description":"Att göra, Kommande och Avslutade."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 3, now(), array['technician']
),
(
  'guide-mina-arenden',
  'Håll koll på dina ärenden i Mina ärenden',
  'Att göra, Kommande och Avslutade, passerade besök att avsluta, filter och sortering.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"[[Ärenden|arende.arende]] längst ner i telefonen, Mina ärenden i sidomenyn på datorn","tar":"5 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Mina ärenden har tre lägen: [[Att göra|arendelista.att-gora]], [[Kommande|arendelista.kommande]] och [[Avslutade|arendelista.avslutade]]. Att göra visar veckans besök och det som väntar på dig, som passerade besök att avsluta. Överst står läget i en mening."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Ärenden|arende.arende]]. På datorn heter det Mina ärenden.","ser":"Överst står läget i en mening, till exempel 4 besök kvar den här veckan. Under ligger Den här veckan och Väntar på dig."},
      {"text":"Tryck på raden under Passerade besök att avsluta. På datorn: tryck [[Öppna ärendet|arende.arende]] längst till höger på raden.","ser":"Ärendet öppnas på steget Framme. Där går du igenom stegen och avslutar besöket."},
      {"text":"Tryck på krysset uppe till höger i ärendet.","ser":"Ärendet stängs och listan läses om. Är besöket avslutat har det flyttat till Avslutade."},
      {"text":"Tryck i Filtrera listan och skriv Exempel AB.","ser":"Listan visar bara det som matchar kundens namn, adressen, telefonnumret eller ärendenumret. Siffrorna på lägena räknas om."},
      {"text":"Tryck [[Filter|allman.filter]].","ser":"Välj vilka typer som visas och ålder: Alla, Högst 30 dagar gamla eller Äldre än 30 dagar. [[Visa alla]] tar bort filtret."},
      {"text":"Tryck [[Kommande|arendelista.kommande]].","ser":"Besöken efter den här veckan, vecka för vecka i 4 veckor. Det som ligger längre fram samlas per kund under Längre fram."},
      {"text":"Tryck [[Avslutade|arendelista.avslutade]].","ser":"Avslutade ärenden per månad, senaste först. Den senaste månaden är utfälld."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Ett passerat besök står inte under Passerade besök att avsluta","svar":"Där står bara besök med status Bokad eller Återbesök. Har ärendet en annan status, till exempel Ombokning, ligger det under Övriga öppna ärenden längst ner. Tryck på raden för att fälla ut."},
      {"fraga":"Raden är orange","svar":"Det har gått mer än 30 dagar sedan besöket. Avsluta det så snart du kan."},
      {"fraga":"Det står Inga träffar","svar":"Inget i läget matchar sökningen eller filtret. Töm Filtrera listan, eller öppna [[Filter|allman.filter]] och tryck [[Visa alla]]."},
      {"fraga":"Det står Ärendet kunde inte hittas bland dina ärenden","svar":"Du öppnade en länk till ett ärende där du inte är tekniker. Fråga koordinatorn."}
    ]},
    {"type":"bra","items":[
      "Siffran på Att göra är veckans besök som inte är klara, plus det som väntar på dig.",
      "Behöver en tid gäller privat- och företagsärenden utan bokad tid. Ikonen till höger på raden ringer kunden.",
      "Att göra och Kommande sorteras Äldst först, Avslutade Nyast först. [[Sortera|arendelista.sortera]] byter till Äldst först, Nyast först eller Kund A till Ö.",
      "På datorn visar ett tryck på raden ärendet till höger, med beskrivning och senaste rapporten. Två snabba tryck öppnar det.",
      "Övriga öppna ärenden längst ner är hopfällt. Där ligger det som väntar på kunden eller kontoret, till exempel Offert skickad eller Ombokning."
    ]},
    {"type":"interactive","component":"nyvy/VarHamnarArendet"},
    {"type":"ovning","uppdrag":"Besöket hos Familjen Exempel den 2026-10-20 är inte avslutat. Öppna ärendet, stäng det och titta sedan på besöken efter den här veckan."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett privatärende har status Öppen och ingen tid. Var står det?","alternativ":["Under Behöver en tid i Att göra","Under Kommande","Under Avslutade"],"ratt":0,"forklaring":"Privat- och företagsärenden som ska bokas står under Väntar på dig, Behöver en tid."},
      {"fraga":"Ett kontrollbesök från förra veckan är inte avslutat. Var hittar du det?","alternativ":["Under Längre fram i Kommande","Under Passerade besök att avsluta i Att göra","Under Avslutade"],"ratt":1,"forklaring":"Ett bokat besök vars datum har passerat står under Passerade besök att avsluta tills det är avslutat."},
      {"fraga":"Du vill se vad du avslutade i september. Var tittar du?","alternativ":["Avslutade, månaden September 2026","Kommande","Att göra med åldern Äldre än 30 dagar"],"ratt":0,"forklaring":"Avslutade visar ärendena per månad, räknat från dagen ärendet avslutades."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-din-dag","label":"Planera dagen med Idag och Karta","description":"Nästa uppdrag, rutten och restiden."},
      {"slug":"guide-schema-tekniker","label":"Se ditt schema som dag, vecka och månad","description":"Hela veckan, lediga stunder och körtid."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 4, now(), array['technician']
),
(
  'guide-sokrutan-tekniker',
  'Hitta ett ärende eller en kund med sökrutan',
  'Sök på telefonnummer, ärendenummer, adress eller namn, i telefonen eller på datorn, och öppna ärendet direkt.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Förstoringsglaset uppe till höger. På datorn sökfältet överst, eller Ctrl+K","tar":"3 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på förstoringsglaset uppe till höger, på datorn sökfältet överst. Skriv det du vet: telefonnummer, ärendenummer, adress eller kundens namn, och tryck på träffen. Du ser bara dina egna ärenden."},
    {"type":"visning","steg":[
      {"text":"Tryck på förstoringsglaset uppe till höger. På datorn: tryck i sökfältet Sök kund, adress eller ärende överst.","ser":"Sökrutan öppnas med Senast öppnade och Åtgärder. I telefonen fyller den hela skärmen."},
      {"text":"Tryck i fältet och skriv telefonnumret 070-123 45 67.","ser":"Det står tolkas som telefonnummer. Träffarna kommer medan du skriver."},
      {"text":"Tryck på ärendet med status Återbesök.","ser":"Mina ärenden öppnas och ärendet öppnas på steget Framme."},
      {"text":"Tryck på krysset uppe till höger i ärendet.","ser":"Ärendet stängs."},
      {"text":"Tryck på förstoringsglaset igen.","ser":"Ärendet du nyss öppnade ligger överst under Senast öppnade."},
      {"text":"Skriv Exempel AB.","ser":"Under Kunder står kunden. Under Åtgärder står Skapa offert för Exempel AB och Skapa avtal för Exempel AB."},
      {"text":"Tryck [[Skapa offert för Exempel AB]].","ser":"Offertguiden öppnas med kunden ifylld."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Inga träffar för och det jag skrev","svar":"Du hittar bara ärenden där du är en av teknikerna. Kontrollera numret, eller skriv kundens namn eller gatan i stället."},
      {"fraga":"Det står Skriv minst två tecken.","svar":"Sökrutan börjar leta vid två tecken. Skriv ett tecken till."},
      {"fraga":"Jag hittar inte ett gammalt ärende","svar":"Ärenden från ClickUp, före 2026-05-01, kommer bara med om du skriver ordet arkiv, till exempel arkiv möss. De hamnar i gruppen Arkiv (ClickUp)."},
      {"fraga":"Det står Sökningen misslyckades. Försök igen om en stund.","svar":"Portalen svarade inte. Vänta en stund och skriv igen. Fortsätter det, skriv en ticket till rollen Koordinator."}
    ]},
    {"type":"bra","items":[
      "Telefonnummer kan skrivas med eller utan mellanslag och bindestreck.",
      "En kund i träffarna öppnar kundens stationsvy. Under den markerade raden finns också Skapa offert och Skapa avtal med kunden ifylld.",
      "Med tom ruta får du åtgärderna Skapa offert, Skapa avtal, Rapportera tillbud och Mitt schema.",
      "På datorn öppnar Ctrl+K sökrutan, på Mac Cmd+K. Pilarna väljer rad, Enter öppnar, Tab byter mellan valen under raden och Esc stänger.",
      "Du ser ärenden där du är en av teknikerna, och offerter och avtal som du har skapat eller ansvarar för."
    ]},
    {"type":"interactive","component":"nyvy/SokTolkning"},
    {"type":"ovning","uppdrag":"Familjen Exempel ringer från 070-123 45 67 och frågar om besöket imorgon. Hitta ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden ringer och du har bara telefonnumret. Vad skriver du?","alternativ":["Kundens namn, som du gissar","Telefonnumret, som det står","Ingenting, du ringer kontoret"],"ratt":1,"forklaring":"Sökrutan känner igen telefonnummer, med eller utan mellanslag och bindestreck."},
      {"fraga":"Du söker på ett ärende från i våras, före 2026-05-01, och får inga träffar. Vad gör du?","alternativ":["Skriver ordet arkiv i sökningen","Skriver numret en gång till","Ger upp"],"ratt":0,"forklaring":"Gamla ärenden från ClickUp kommer bara med när du skriver arkiv. Du ser bara dina egna."},
      {"fraga":"Varför hittar du inte en kollegas ärende?","alternativ":["Sökrutan är trasig","Du ser bara ärenden där du är en av teknikerna","Du skrev för många tecken"],"ratt":1,"forklaring":"Teknikerns sökning visar dina egna ärenden och dem du delar med andra tekniker."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn och Mer."},
      {"slug":"guide-mina-arenden","label":"Håll koll på dina ärenden","description":"Att göra, Kommande och Avslutade."},
      {"slug":"guide-din-dag","label":"Planera dagen med Idag och Karta","description":"Nästa uppdrag, rutten och restiden."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 5, now(), array['technician']
),
(
  'guide-rapportera-tillbud',
  'Rapportera ett tillbud, en avvikelse eller en olycka',
  'Oj, aj eller hmm? Så rapporterar du med den gula knappen, och det här händer sedan.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Den gula varningsknappen uppe till höger, på varje sida","tar":"3 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på den gula varningsknappen uppe till höger och sedan [[Rapportera händelse|allman.plus]]. Välj typ, skriv vad som hände och tryck [[Skicka rapport]]. Rapportera hellre en gång för mycket."},
    {"type":"callout","variant":"warning","title":"Vid akut nödläge","text":"Ring 112 först vid allvarlig skada. Rapportera i portalen när läget är under kontroll."},
    {"type":"visning","steg":[
      {"text":"Tryck på den gula varningsknappen uppe till höger.","ser":"Sidan Tillbud och avvikelser öppnas med dina egna rapporter."},
      {"text":"Tryck [[Rapportera händelse|allman.plus]].","ser":"Formuläret öppnas. Ditt namn står redan under Berörda anställda och som Rapportör."},
      {"text":"Välj typ: Oj! Tillbud, Aj! Olycka eller Hmm Avvikelse.","ser":"Rutan du väljer blir färgad. Tillbud är valt från början. Väljer du Olycka visas en påminnelse om anmälan till Arbetsmiljöverket."},
      {"text":"Tryck i Vad har hänt? och beskriv vad som hände, var och hur.","ser":"När inträffade händelsen? är satt till nu. Ändra den om det hände tidigare."},
      {"text":"Vill du koppla rapporten till ett ärende: tryck i Koppla till ärende och skriv ärendets titel eller nummer.","ser":"Dina privat- och företagsärenden visas. Tryck på rätt ärende. Kopplingen är valfri."},
      {"text":"Tryck [[Skicka rapport]].","ser":"Det står till exempel Tillbud rapporterad. Rapporten ligger överst i listan med status Ny."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Skicka rapport är grå","svar":"Vad har hänt? är tomt. Skriv vad som hände först."},
      {"fraga":"Det står Kunde inte spara","svar":"Rapporten skickades inte. Kontrollera täckningen och tryck [[Skicka rapport]] igen. Det du skrivit ligger kvar."},
      {"fraga":"Det står Inga ärenden hittades under Koppla till ärende","svar":"Sökningen hittar bara dina privat- och företagsärenden, inte avtalsbesök. Skriv minst två tecken av titeln eller ärendenumret. Kopplingen är valfri, så du kan skicka utan den."},
      {"fraga":"Jag hittar inte en gammal rapport","svar":"Under Tillbud och avvikelser ser du rapporter du har skickat och rapporter där du står som berörd."}
    ]},
    {"type":"bra","items":[
      "Oj! Tillbud: det kunde ha gått illa men ingen skadades. Aj! Olycka: någon skadades, även lindrigt. Hmm Avvikelse: något avvek från rutin, process eller kvalitetskrav.",
      "Syftet är aldrig att peka ut någon. Rapporterna används för att hitta problem och se till att de inte händer igen.",
      "De som tar emot den typen av rapport får en notis och ett mejl direkt.",
      "Var fler med? Lägg till dem under Berörda anställda. Ditt eget namn går inte att ta bort.",
      "I sökrutan finns åtgärden Rapportera tillbud. Den öppnar formuläret direkt."
    ]},
    {"type":"ovning","uppdrag":"Stegen gled på det blöta golvet hos Exempel AB. Du tog emot dig och ingen skadades. Rapportera det."},
    {"type":"quiz","fragor":[
      {"fraga":"En kollega skar sig lätt på en kniv vid uppackning. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":1,"forklaring":"Någon skadades, oavsett hur lindrigt. Det är en olycka."},
      {"fraga":"Du halkade men tog emot dig. Ingen skadades. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":0,"forklaring":"Det kunde ha gått illa men ingen skadades. Det är ett tillbud."},
      {"fraga":"Vad händer när du har skickat rapporten?","alternativ":["Inget förrän du ringer kontoret","De som tar emot rapporter får notis och mejl, och rapporten får status Ny","Rapporten skickas till kunden"],"ratt":1,"forklaring":"Mottagarna får besked direkt och utreder rapporten. Du ser status i listan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-ticket-systemet","label":"Tickets","description":"Fråga en kollega om ett ärende."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn och Mer."}
    ],"fraga":"Din närmaste chef, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 6, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
