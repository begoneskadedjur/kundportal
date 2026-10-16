-- Guidemallen (godkänd 2026-10-16): prissättning och specialrapporter.
-- Fyra guider, en per roll och uppgift:
--   guide-prissattning              Sätt rätt pris i ärendet (tekniker, telefon)
--   guide-prissattning-kontor       Prislistor och marginal (admin, dator)
--   guide-specialrapporter          Skriv en specialrapport (tekniker, telefon)
--   guide-specialrapporter-kontor   Granska och skicka en specialrapport (admin, koordinator, dator)
-- Guidemoduler: src/pages/shared/intranet/guider/<slug>.tsx (visning + övning).
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-prissattning',
  'Sätt rätt pris i ärendet',
  'Lägg in det ärendet har kostat, låt Prisguiden räkna fram priset och se marginalen, direkt i telefonen.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fliken Ekonomi › Tjänster & fakturarader","tar":"5 min","behover":"Ett ärende där tjänsten är vald","enhet":"mobil"},
    {"type":"kortsvar","text":"Lägg in det du har förbrukat under Interna kostnader. Öppna [[Prisguide|allman.kalkyl]], koppla artiklarna till tjänsten och tryck [[Applicera priser]]. Vill du avrunda skriver du ett eget pris i prisrutan."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på fliken Ekonomi.","ser":"Under Tjänster & fakturarader ligger ärendets tjänst redan som en rad med grundpriset."},
      {"text":"Tryck Interna kostnader.","ser":"Listan fälls ut med Sök artikel... och artiklarna du kan välja."},
      {"text":"Tryck på en artikel du har använt. Gör likadant för varje artikel.","ser":"Artikeln läggs till med antal och inköpskostnad. Ändra antalet med minus och plus. Marginalen syns uppe i Tjänster & fakturarader."},
      {"text":"Tryck [[Prisguide|allman.kalkyl]] i Tjänster & fakturarader.","ser":"Prisguiden öppnas med Tilldela interna kostnader till fakturarader."},
      {"text":"Välj tjänsten i rutan under varje artikel.","ser":"Justera påslag & marginal visas med prisförslaget. Påslaget börjar på det rekommenderade, i dag 40 %."},
      {"text":"Tryck [[Applicera priser]].","ser":"Det står Priser uppdaterade. Priset på raden är inköpet plus påslaget, och marginalen räknas om."},
      {"text":"Vill du avrunda: tryck i prisrutan och skriv ett eget pris.","ser":"Priset sparas när du lämnar rutan. I privatärenden står priset inkl. moms, i företagsärenden exkl. moms."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Prisrutan går inte att ändra och det står Fast pris","svar":"Kunden har ett avtalat pris i sin prislista. Det gäller, och Prisguiden ändrar det inte. Lägg ändå in artiklarna, de behövs för marginalen."},
      {"fraga":"Det står Låst av avtal","svar":"Priset räknas fram ur kundens avtalade artikelpriser, kundpris gånger antal. Ändra antalet eller kopplingen i Prisguiden i stället."},
      {"fraga":"[[Applicera priser]] går inte att trycka på","svar":"Ingen artikel är kopplad till en tjänst. Välj tjänst under minst en artikel först."},
      {"fraga":"Det står att en artikel har kundpris men ingen tjänst att faktureras på","svar":"Öppna [[Prisguide|allman.kalkyl]] och koppla artikeln till tjänsten. Annars faktureras inte det avtalade priset, och ärendet går inte att avsluta."},
      {"fraga":"Det står Motivera rabatten på ... under Tjänster & fakturarader innan ärendet avslutas","svar":"En rad har rabatt. Skriv varför i rutan Motivering till rabatt (krävs vid avslut) under raden. Motiveringen visas för den som godkänner rabatter."}
    ]},
    {"type":"bra","items":[
      "Interna kostnader visas aldrig på fakturan. De finns för att marginalen ska bli rätt.",
      "Marginalen räknas på priset exkl. moms. I dag är den grön från 35 %, gul från 20 % och röd under 20 %.",
      "Rader och priser sparas direkt. Du behöver inte trycka på något extra för raderna.",
      "Fast pris från kundens prislista går alltid före Prisguiden.",
      "Kopplingen mellan artikel och tjänst sparas när du trycker [[Applicera priser]]."
    ]},
    {"type":"ovning","uppdrag":"Du har sanerat råttor hos Familjen Exempel: 5 timmars arbete och 2 betesstationer. Lägg in kostnaderna, låt Prisguiden räkna fram priset och avrunda det till 4 500 kr."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har satt ut tre betesstationer, men kunden betalar bara för tjänsten. Lägger du in stationerna?","alternativ":["Nej, de syns ju inte på fakturan","Ja, under Interna kostnader","Ja, som en egen tjänsterad"],"ratt":1,"forklaring":"Interna kostnader syns inte för kunden, men utan dem blir marginalen fel."},
      {"fraga":"Prisguiden föreslår 4 375 kr och du vill ta 4 500 kr. Vad gör du?","alternativ":["Skriver 4 500 i prisrutan","Drar i påslaget tills det blir exakt 4 500","Ber kontoret ändra fakturan"],"ratt":0,"forklaring":"Förslaget är en startpunkt. Priset i prisrutan är det som gäller."},
      {"fraga":"Raden visar Fast pris. Vad betyder det?","alternativ":["Priset kommer från kundens prislista","Prisguiden har låst priset","Kunden har fått rabatt"],"ratt":0,"forklaring":"Fast pris kommer från kundens prislista och går inte att ändra i ärendet."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-fakturering","label":"Fakturering, din del som tekniker","description":"Vad som händer med raderna när ärendet är klart."},
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort, eller en gång per månad."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 50, now(), array['technician']
),
(
  'guide-prissattning-kontor',
  'Prislistor och marginal',
  'Sätt kundens fasta priser i prislistan, styr marginalgränserna och godkänn rabatter, på datorn.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin"],"var":"Menyn › Produkter & Priser › Prislistor","tar":"6 min","behover":"Admin. För Godkännanden också rätten att godkänna rabatter.","enhet":"dator"},
    {"type":"kortsvar","text":"Kundens fasta priser sätter du i Prislistor: välj Fast pris (kr) på tjänsten och spara med bocken. Marginalgränserna finns under Tjänsteutbud › [[Inställningar]]. Rabatter godkänner du under Godkännanden."},
    {"type":"visning","steg":[
      {"text":"Tryck Prislistor i menyn.","ser":"Du ser alla prislistor. Standardlistan är märkt Standard med en stjärna."},
      {"text":"Tryck pilen framför kundens prislista.","ser":"Fliken Tjänster visar varje tjänst med Grundpris, Diff, Läge och Kundpris."},
      {"text":"Välj Fast pris (kr) under Läge på tjänsten.","ser":"Rutan under Kundpris fylls med grundpriset och raden visas som osparad."},
      {"text":"Skriv kundens pris och tryck bocken.","ser":"Det står Pris sparat. Diff visar skillnaden mot grundpriset i kronor och procent."},
      {"text":"Gå till Tjänsteutbud och tryck [[Inställningar]].","ser":"Kalkylatorinställningar öppnas med Marginalregler och Prisguide."},
      {"text":"Ändra Önskvärd marginal % eller Minsta marginal % och tryck [[Spara]].","ser":"Det står Inställningar sparade. Gränserna styr marginalens färger i ärendet och i Prisguiden."},
      {"text":"Gå till Godkännanden, läs motiveringen och tryck [[Godkänn]].","ser":"Det står Faktura godkänd - tekniker notifierad och fakturan försvinner ur listan."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Du är inte rabattansvarig","svar":"Rätten att godkänna rabatter ges per person under Användarkonton (Personal). Det gäller även admin."},
      {"fraga":"Det står Minsta marginal kan inte vara högre än önskvärd marginal","svar":"Sänk Minsta marginal % eller höj Önskvärd marginal % och tryck [[Spara]] igen."},
      {"fraga":"Rabatten är för hög eller motivering saknas","svar":"Tryck [[Avslå]], skriv Anledning (obligatorisk) och tryck [[Avslå och notifiera tekniker]]. Fakturan ligger kvar under Godkännanden tills rabatten är åtgärdad."},
      {"fraga":"Jag får en fråga om 0 kr när jag sparar","svar":"0 kr betyder gratis per ärende för alla kunder med prislistan. Ingår tjänsten i avtalet hör den hemma i § 4 på avtalet, inte i prislistan."},
      {"fraga":"Jag vill ta bort ett fast pris","svar":"Välj Prisguide under Läge och tryck bocken. Då används grundpriset och Prisguiden igen."}
    ]},
    {"type":"bra","items":[
      "Prislistan kopplas till kunden i avtalskartan, under § 2 · Prislista för avrop.",
      "Har kunden ingen egen prislista får ärendet tjänstens grundpris från Tjänsteutbud.",
      "Fast pris i prislistan låser priset i ärendet. Teknikern kan inte ändra det, och Prisguiden pausas för raden.",
      "Rekommenderat påslag % är startvärdet för påslaget i Prisguiden. Minsta debitering är det lägsta belopp Prisguiden föreslår.",
      "Avtalstillägg är aldrig rabatt. Under Godkännanden visas de för sig, som tillägg som betalas pro rata."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB ska betala 1 500 kr för Getingbekämpning. Lägg in det i prislistan Exempel AB och godkänn sedan rabatten som väntar."},
    {"type":"quiz","fragor":[
      {"fraga":"En kund ska ha 1 500 kr för getingar i stället för grundpriset. Var gör du det?","alternativ":["I Tjänsteutbud","I kundens prislista med Fast pris (kr)","I ärendet varje gång"],"ratt":1,"forklaring":"Grundpriset i Tjänsteutbud gäller alla. Kundens pris hör hemma i kundens prislista."},
      {"fraga":"Marginalen ska bli röd först under 25 %. Vad ändrar du?","alternativ":["Minsta marginal %","Önskvärd marginal %","Rekommenderat påslag %"],"ratt":0,"forklaring":"Minsta marginal % är gränsen för den röda varningen."},
      {"fraga":"En rabatt saknar motivering. Vad gör du?","alternativ":["Godkänner, det är en formalitet","Avslår med en anledning, teknikern får en notis","Tar bort fakturan"],"ratt":1,"forklaring":"Avslå med en anledning. Fakturan ligger kvar tills rabatten är åtgärdad."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-fakturering-kontor","label":"Fakturering från ärende till betalning","description":"Flödet efter att priset är satt."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 51, now(), array['admin']
),
(
  'guide-specialrapporter',
  'Skriv en specialrapport',
  'Samla ett krångligt uppdrag i en rapport med delar, områden på kartan, händelser och bilder, direkt i telefonen.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fliken Utförande › Specialrapporter","tar":"6 min","behover":"Ett ärende där du är tekniker","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på plus i rutan Specialrapporter och sedan [[Skapa rapport]]. Lägg till en del per område, besök eller underleverantör och fyll den med [[Ny händelse]]. Allt sparas medan du skriver."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet, fliken Utförande, och tryck på plus i rutan Specialrapporter.","ser":"Ny specialrapport öppnas. Ärendet är valt och titeln är ifylld."},
      {"text":"Låt Börja tomt vara valt och tryck [[Skapa rapport]].","ser":"Det står Rapporten är skapad. Du ser Klar att skicka och Rapportens delar."},
      {"text":"Tryck [[Lägg till del]].","ser":"Rutan frågar Vad ska delen handla om? Du kan ändra det senare."},
      {"text":"Tryck Område.","ser":"Kartan öppnas och ritningen startar. Tryck ut områdets hörn ett i taget, minst tre."},
      {"text":"Tryck [[Skapa del]] när hörnen sitter rätt.","ser":"Rutan Vad heter området? kommer upp. Skriv namnet och tryck Spara. Delen öppnas under Redigera."},
      {"text":"Tryck den gröna knappen [[Ny händelse]].","ser":"Delen är förvald. Står du inne i ett ritat område står det Föreslagen efter området du står i."},
      {"text":"Välj under Vad har du gjort?, kontrollera datum och rubrik och tryck [[Spara i rapporten]].","ser":"Det står Händelsen är sparad i rapporten. Foton du lägger till hör till händelsen."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"[[Skapa rapport]] går inte att trycka på","svar":"Ärendet eller titeln saknas. Sök fram ärendet med BE-nummer och skriv en titel. Väljer du Utgå från tidigare rapport måste du också välja rapporten."},
      {"fraga":"[[Skapa del]] är grå på kartan","svar":"Det behövs minst tre hörn. Tryck ut fler hörn på kartan."},
      {"fraga":"Det står Rapporten har inga delar än. Lägg till en del först.","svar":"En händelse måste höra till en del. Gå till Delar och tryck [[Lägg till del]]."},
      {"fraga":"Det står att händelsen sparades men att foton inte kunde laddas upp","svar":"Händelsen finns kvar. Öppna delen och ladda upp fotona igen i bildblocket."},
      {"fraga":"Under titeln står Kunde inte spara","svar":"Den senaste ändringen kom inte fram. Kontrollera att du har täckning och skriv det senaste igen."}
    ]},
    {"type":"bra","items":[
      "Allt sparas medan du skriver. Under titeln står Sparad och klockslaget.",
      "Specialrapporten kommer utöver ärendets vanliga rapport.",
      "Avvikelse är för sådant kunden behöver åtgärda, till exempel en öppen ventil. Den syns i rött i rapporten.",
      "[[Snygga till hela rapporten|rapport.snygga]] rättar stavning och skiljetecken. Inget ändras förrän du trycker Använd.",
      "Du ser rapporter du har skapat och rapporter på ärenden där du är tekniker."
    ]},
    {"type":"p","text":"Prova Snygga till. Ett av förslagen nedan är fel."},
    {"type":"interactive","component":"specialrapport-snygga-till"},
    {"type":"ovning","uppdrag":"Skapa en specialrapport för Brf Exempelgården. Rita förrådet som ett område och lägg in att du har betat där."},
    {"type":"quiz","fragor":[
      {"fraga":"Du hittar en öppen ventil som kunden behöver täta. Vilken typ väljer du?","alternativ":["Notering","Avvikelse","Åtgärd"],"ratt":1,"forklaring":"Avvikelse är för sådant kunden behöver åtgärda. Den syns i rött i rapporten."},
      {"fraga":"Du har tryckt ut två hörn och Skapa del är grå. Varför?","alternativ":["Kartan är inte med i rapporten","Det behövs minst tre hörn","Området måste ha ett namn först"],"ratt":1,"forklaring":"Ett område behöver minst tre hörn. Namnet skriver du efteråt."},
      {"fraga":"Måste du trycka Spara innan du lämnar rapporten?","alternativ":["Ja, annars försvinner allt","Nej, allt sparas medan du skriver","Bara i mobilen"],"ratt":1,"forklaring":"Rapporten sparas hela tiden. Under titeln ser du när den sparades senast."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Nästa besök i samma ärende."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 52, now(), array['technician']
),
(
  'guide-specialrapporter-kontor',
  'Granska och skicka en specialrapport',
  'Granska en specialrapport, snygga till texten, titta igenom hela PDF:en och skicka en låst version till kunden.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Ärendet › rutan Specialrapporter","tar":"5 min","behover":"En specialrapport på ärendet","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna rapporten från ärendet och fyll i det som är grått i Klar att skicka. Kör [[Snygga till hela rapporten|rapport.snygga]], titta igenom [[Hela PDF:en]] och tryck [[Skicka till kund|rapport.skicka]]. Den skickade versionen låses."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Öppna rapporten|rapport.oppna]] i rutan Specialrapporter i ärendet.","ser":"Redigeraren öppnas. Till höger står Så ser kunden rapporten. Pilen uppe till vänster tar dig tillbaka till ärendet."},
      {"text":"Tryck på en grå rad i Klar att skicka, till exempel Bedömning skriven.","ser":"Du hamnar i rätt fält. Skriv det som saknas, så blir raden grön."},
      {"text":"Tryck [[Snygga till hela rapporten|rapport.snygga]].","ser":"Snygga till texten visar Så blir texten: rött tas bort, grönt läggs till. Bocka ur det du inte vill ha."},
      {"text":"Tryck [[Använd]] och antalet ändringar.","ser":"Det står hur många ändringar som gjordes. [[Ångra]] finns i samma ruta en stund."},
      {"text":"Tryck [[Hela PDF:en|rapport.forhandsgranska]] ovanför förhandsvisningen.","ser":"Rapportens sidor visas i helskärm. Den riktiga PDF:en skapas när du laddar ner eller skickar."},
      {"text":"Tryck [[Skicka till kund|rapport.skicka]].","ser":"Skicka rapporten till kunden öppnas. Till är ifyllt med kontakten på ärendet, och meddelandet räknar upp det som är nytt sedan förra versionen."},
      {"text":"Kontrollera Till, Ämne och Meddelande och tryck [[Skicka version 2|rapport.skicka]].","ser":"Det står Version 2 är skickad. PDF:en bifogas mejlet och versionen låses. Numret är alltid den version som pågår."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står 1 sak saknas: bedömning. Du kan ändå skicka rapporten.","svar":"Klar att skicka har en grå rad. Tryck [[Avbryt]], fyll i det som saknas och skicka sedan."},
      {"fraga":"Det står Rapporten har för mycket text för en genomläsning. Snygga till en del i taget.","svar":"Kör Snygga till på en del eller ett block i taget i stället för på hela rapporten."},
      {"fraga":"Det står Texten har ändrats sedan genomläsningen, kör Snygga till igen","svar":"Någon skrev i texten medan förslagen togs fram. Kör Snygga till igen."},
      {"fraga":"Skicka-knappen går inte att trycka på","svar":"Mottagare eller ämne saknas, eller en adress är ogiltig. Lägg till en adress med [[Lägg till mottagare]]."},
      {"fraga":"Rapporten står som Ändrad sedan utskicket i ärendet","svar":"Någon har ändrat rapporten efter senaste utskicket. Kunden har inte fått ändringarna. Skicka en ny version."}
    ]},
    {"type":"bra","items":[
      "Koordinator och admin ser alla specialrapporter. Teknikern ser sina egna och rapporter på sina ärenden.",
      "Kunden ser inte rapporten i kundportalen. Den kommer som PDF i mejlet.",
      "En skickad version låses. Det som ändras efteråt hamnar i nästa version.",
      "Alla skickade versioner finns kvar under Versioner i utskicket och kan laddas ned var för sig.",
      "Föreslår Snygga till att rätta ett ord som redan är rätt: tryck Rätt stavat, lägg till i ordlistan. Ordlistan finns i menyn."
    ]},
    {"type":"ovning","uppdrag":"Anna Exempel har skrivit rapporten om Brf Exempelgården, men bedömningen saknas. Skriv den, titta igenom hela PDF:en och skicka version 2 till kontakten."},
    {"type":"quiz","fragor":[
      {"fraga":"Version 1 är skickad och teknikern lägger till en händelse. Vad får kunden?","alternativ":["Ingenting förrän du skickar version 2","Version 1 uppdateras av sig själv","Ett mejl om ändringen"],"ratt":0,"forklaring":"En skickad version är låst. Kunden får ändringarna när du skickar nästa version."},
      {"fraga":"Klar att skicka visar 4 av 5. Kan du skicka?","alternativ":["Nej, knappen är låst","Ja, utskicket påminner om det som saknas","Bara admin kan skicka"],"ratt":1,"forklaring":"Du kan alltid skicka, men utskicket säger vad som saknas."},
      {"fraga":"Snygga till vill rätta ett produktnamn som redan är rätt stavat. Vad gör du?","alternativ":["Trycker Använd ändå","Bockar ur förslaget och trycker Rätt stavat, lägg till i ordlistan","Stänger och skriver om texten"],"ratt":1,"forklaring":"Ordet hamnar i ordlistan och rättas aldrig igen, för någon."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-sokrutan-kontor","label":"Sökrutan","description":"Hitta ärendet snabbt."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 53, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
