-- Guidemallen (godkänd 2026-10-16): de allmänna guiderna i en tekniker- och en kontorsversion.
--   guide-ticket-systemet           Skicka och svara på en ticket (tekniker, telefon)
--   guide-ticket-systemet-kontor    Skicka och svara på en ticket (admin, koordinator, dator)
--   guide-roller-och-vyer           Hitta rätt i portalen (tekniker, telefon)
--   guide-roller-och-vyer-kontor    Hitta rätt i portalen (admin, koordinator, säljare, dator)
--   guide-rapportera-tillbud        Rapportera ett tillbud, en avvikelse eller en olycka (tekniker, telefon)
--   guide-rapportera-tillbud-kontor Rapportera ett tillbud, en avvikelse eller en olycka (admin, koordinator, dator)
-- Guidemoduler: src/pages/shared/intranet/guider/<slug>.tsx, delade delar i guider/_allmant.tsx.
-- Säljare saknar Tickets och Tillbud & Avvikelser i portalen och ser därför bara roller-och-vyer-kontor.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- ─── 1. Ticket, tekniker ───
(
  'guide-ticket-systemet',
  'Skicka och svara på en ticket',
  'Fråga kontoret eller en kollega direkt i ärendet med @namn, och svara när någon frågar dig.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › pratbubblan uppe till höger","tar":"3 min","behover":"Ett ärende att skriva i","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på pratbubblan i ärendet, skriv @ och välj vem som ska svara. Då blir kommentaren en ticket. Frågor till dig hittar du under klockan uppe till höger, och du svarar med [[Svara]] så att svaret hamnar i samma tråd."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på pratbubblan uppe till höger.","ser":"Panelen Kommunikation öppnas nerifrån."},
      {"text":"Tryck i rutan och skriv @. Tryck på personen eller gruppen som ska svara.","ser":"Namnet står i rutan, till exempel @Anna Exempel. Grupperna @tekniker, @koordinator, @admin och @alla når alla med den rollen."},
      {"text":"Skriv frågan efter namnet och tryck på pappersplanet.","ser":"Kommentaren syns i listan med status Öppen. Den du nämnde får en notis."},
      {"text":"När någon har skrivit till dig: tryck på klockan uppe till höger.","ser":"Sidan Tickets öppnas. Under Att göra ligger det som väntar på ditt svar."},
      {"text":"Tryck på ticketen.","ser":"Kommunikation öppnas med hela tråden."},
      {"text":"Tryck [[Svara]] under kommentaren, skriv ditt svar och tryck på pappersplanet.","ser":"Ovanför rutan står det Svarar och namnet. När svaret är skickat försvinner ticketen från Att göra."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Personen jag vill fråga finns inte i listan","svar":"Listan visar bara aktiva tekniker, koordinatorer och admins. Kunder och säljare går inte att nämna."},
      {"fraga":"Knappen med pappersplanet är grå","svar":"Rutan är tom. Skriv något, eller bifoga en bild med gemet."},
      {"fraga":"Det står Filtypen stöds inte eller Filen är för stor (max 5MB)","svar":"Du kan bifoga bilder (JPG, PNG, WEBP, HEIC) och PDF, högst 5 MB per fil."},
      {"fraga":"Jag svarade men ticketen ligger kvar under Att göra","svar":"Svaret skrevs direkt i rutan och blev en ny ticket. Tryck [[Svara]] under kommentaren först, så hamnar svaret i samma tråd."},
      {"fraga":"Det står Kunde inte skapa kommentar","svar":"Kommentaren sparades inte. Kontrollera att du har täckning och skicka igen."}
    ]},
    {"type":"bra","items":[
      "Bara de du nämner med @ får en notis. Utan @ blir det en vanlig kommentar i ärendet.",
      "Kunderna ser aldrig kommunikationen. Den är intern.",
      "Siffran på klockan visar hur många öppna tickets du är med i.",
      "I telefonen heter flikarna Att göra, Svar, Bevaka, Nytt, Alla och Klart. Klart är de lösta.",
      "Har du startat ticketen och inget mer behövs: tryck på pilen till höger på ticketen och sedan [[Markera löst]]. Bara den som skrev första kommentaren kan göra det."
    ]},
    {"type":"ovning","uppdrag":"Fråga koordinatorn Anna Exempel om Familjen Exempel vill ha kvittot på mejl. När Anna har svarat: svara henne i samma tråd."},
    {"type":"quiz","fragor":[
      {"fraga":"Du vill att koordinatorn Anna ska svara på en fråga i ärendet. Vad skriver du?","alternativ":["Bara frågan, utan namn","@Anna Exempel och sedan frågan","Ett sms till Anna"],"ratt":1,"forklaring":"Med @ blir kommentaren en ticket och Anna får en notis. Utan @ får ingen veta att du har frågat."},
      {"fraga":"Anna har svarat dig med en ny fråga. Hur svarar du så att det hamnar rätt?","alternativ":["Skriver direkt i rutan överst","Trycker Svara under hennes kommentar och skriver","Startar en ny ticket med @Anna Exempel"],"ratt":1,"forklaring":"Svara lägger svaret i samma tråd. Skriver du direkt i rutan blir det en ny ticket, och den gamla ligger kvar under Att göra."},
      {"fraga":"Var hittar du snabbast det som väntar på ditt svar?","alternativ":["Klockan uppe till höger, fliken Att göra","Under Mitt konto","I ärendehistoriken"],"ratt":0,"forklaring":"Klockan öppnar Tickets. Att göra är det som väntar på dig."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i portalen","description":"Menyn, Mitt konto och appen på hemskärmen."},
      {"slug":"guide-rapportera-tillbud","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Den gula knappen i menyn."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 10, now(), array['technician']
),

-- ─── 2. Ticket, kontor ───
(
  'guide-ticket-systemet-kontor',
  'Skicka och svara på en ticket',
  'Fråga en kollega i ärendet med @namn, svara på det som väntar på dig och avsluta tickets som är klara.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Ärendet › pratbubblan uppe till höger, och Tickets i menyn","tar":"4 min","behover":"Ett ärende att skriva i","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck på pratbubblan i ärendet, skriv @ och välj vem som ska svara. Det som väntar på dig ligger under Tickets › Väntar på ditt svar. Svara med [[Svara]] och avsluta med [[Markera löst]] när inget mer behövs."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på pratbubblan uppe till höger.","ser":"Panelen Kommunikation öppnas till höger."},
      {"text":"Skriv @ i rutan och tryck på personen eller gruppen som ska svara.","ser":"Listan Nämn visar Grupper och Personer. Piltangenterna och Enter fungerar också."},
      {"text":"Skriv frågan och tryck [[Skicka]].","ser":"Kommentaren får status Öppen och den du nämnde får en notis. Ctrl och Enter skickar också."},
      {"text":"Tryck Tickets i menyn. Koordinatorn har den under Planering, admin under Organisation.","ser":"Sidan Tickets öppnas på fliken Väntar på ditt svar. Klockan uppe till höger går också dit."},
      {"text":"Tryck på ticketen.","ser":"Kommunikation öppnas med ärendet till vänster och tråden till höger."},
      {"text":"Håll muspekaren över kommentaren och tryck [[Svara]]. Skriv svaret och tryck [[Skicka]].","ser":"Ovanför rutan står det Svarar och namnet. Ticketen försvinner från Väntar på ditt svar."},
      {"text":"När inget mer behövs: tryck på pilen till höger på ticketen och sedan [[Markera löst]].","ser":"Ticketen flyttas till Avslutade. Där finns [[Återöppna]] om frågan kommer tillbaka."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag tryckte Markera löst men ticketen kom tillbaka","svar":"Bara den som skrev första kommentaren i ticketen kan markera den som löst. Be den personen göra det."},
      {"fraga":"Personen jag letar efter finns inte i listan","svar":"Listan visar bara aktiva tekniker, koordinatorer och admins. Säljare och kunder går inte att nämna."},
      {"fraga":"Jag ser ingen Svara-knapp","svar":"Den syns när du håller muspekaren över kommentaren."},
      {"fraga":"Det står Inga tickets i denna kategori","svar":"Byt flik för att se andra tickets. Lösta tickets ligger under Avslutade."},
      {"fraga":"Det står Kunde inte markera ticket som löst","svar":"Försök igen. Hjälper det inte: skriv till admin och ange ärendet."}
    ]},
    {"type":"bra","items":[
      "Bara de du nämner med @ får en notis. @alla når alla användare, använd den sparsamt.",
      "Väntar på ditt svar är din att göra-lista. Svar till dig är svar på dina kommentarer, och Väntar på andras svar är frågor du ställt som ingen har svarat på.",
      "Färgen till vänster på kortet visar läget: röd betyder att någon väntar på dig, gul att du väntar på andra.",
      "Siffran på klockan visar hur många öppna tickets du är med i.",
      "Kunderna ser aldrig kommunikationen. Den är intern."
    ]},
    {"type":"ovning","uppdrag":"Fråga teknikern Erik Exempel hur många fällor han satte ut hos Familjen Exempel. När Erik har svarat: svara honom och markera ticketen som löst."},
    {"type":"quiz","fragor":[
      {"fraga":"En tekniker har frågat dig något i ett ärende. Var ser du det?","alternativ":["Tickets › Väntar på ditt svar","Tickets › Väntar på andras svar","Under Uppdateringar"],"ratt":0,"forklaring":"Väntar på ditt svar visar allt där någon har nämnt dig och väntar på ditt svar."},
      {"fraga":"Erik startade ticketen. Du trycker Markera löst men den kommer tillbaka. Varför?","alternativ":["Ett fel som löser sig själv","Bara den som skrev första kommentaren kan markera den som löst","Du måste trycka Uppdatera först"],"ratt":1,"forklaring":"Ticketen tillhör den som startade den. Be Erik markera den som löst."},
      {"fraga":"Du svarar genom att skriva direkt i rutan överst. Vad händer?","alternativ":["Svaret hamnar i tråden","Det blir en ny ticket och den gamla ligger kvar","Ingenting skickas"],"ratt":1,"forklaring":"Svara lägger svaret i samma tråd. Annars blir det en ny ticket."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."},
      {"slug":"guide-rapportera-tillbud-kontor","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Rapportera och utred från datorn."},
      {"slug":"guide-sokrutan-kontor","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 11, now(), array['admin','koordinator']
),

-- ─── 3. Roller och vyer, tekniker ───
(
  'guide-roller-och-vyer',
  'Hitta rätt i portalen',
  'Menyn i telefonen, Mitt konto, appen på hemskärmen och hur du byter vy om du har flera roller.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["technician"],"var":"[[Mer]] längst ner till höger","tar":"3 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Det du inte ser längst ner ligger under [[Mer]]. Där finns grupperna med sidorna, den gula knappen för tillbud och [[Mitt konto]], där du byter lösenord och lägger portalen som app på hemskärmen."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Mer]] längst ner till höger.","ser":"Menyn öppnas från höger. De tre strecken uppe till höger öppnar samma meny."},
      {"text":"Tryck på en grupp, till exempel Ärenden & Fält.","ser":"Gruppen fälls ut: Mina ärenden, Schema, Specialrapporter, Utrustning och Tickets."},
      {"text":"Tryck [[Mitt konto]] längre ner i menyn.","ser":"Sidan Min profil öppnas. Där ändrar du namn, e-post och telefon och byter lösenord."},
      {"text":"Bläddra ner till Använd som app och tryck [[Så lägger du till appen]].","ser":"På iPhone visar portalen tre steg: Dela-knappen i Safari, Lägg till på hemskärmen och Lägg till. På Android kan knappen heta Lägg till på hemskärmen och öppnar då installationen direkt."},
      {"text":"Har du flera roller: öppna menyn och tryck på vyn du vill byta till, överst i menyn.","ser":"Den vyns översikt öppnas. Växlaren syns bara om du har mer än en roll."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser ingen växlare överst i menyn","svar":"Du har bara en roll. Admin lägger till roller under Användarkonton (Personal), Roller & vyer."},
      {"fraga":"Det står Installerad. Portalen körs som app på den här enheten.","svar":"Appen finns redan på hemskärmen. Öppna den därifrån."},
      {"fraga":"Appen vill att jag loggar in igen","svar":"Det är normalt första gången. Appen har egen inloggning."},
      {"fraga":"Det står Felaktigt nuvarande lösenord","svar":"Det du skrev under Nuvarande lösenord stämmer inte. Har du glömt det: logga ut och tryck Glömt lösenord? på inloggningssidan."}
    ]},
    {"type":"bra","items":[
      "Längst ner i telefonen finns Hem, Ärenden, Schema, Provision och Mer.",
      "Grupperna i menyn är stängda tills du trycker på dem. Gruppen med sidan du står på är redan öppen.",
      "Lösenordet ska ha minst 8 tecken, en stor bokstav, en liten bokstav och en siffra.",
      "Har du fått ett tillfälligt lösenord måste du välja ett eget innan du kommer vidare. Det står Byt lösenord för att fortsätta.",
      "Portalen frågar aldrig själv om appen. Du lägger till den när du vill under Mitt konto."
    ]},
    {"type":"ovning","uppdrag":"Du har både rollen tekniker och koordinator. Ta reda på hur du lägger portalen på hemskärmen i din iPhone. Byt sedan till koordinatorvyn."},
    {"type":"quiz","fragor":[
      {"fraga":"Var byter du lösenord?","alternativ":["Mer › Mitt konto","Mer › Intranät & Hjälpcenter","Ärenden"],"ratt":0,"forklaring":"Mitt konto har Profilinformation och Byt lösenord."},
      {"fraga":"Du ser ingen växlare överst i menyn. Varför?","alternativ":["Telefonen är för gammal","Du har bara en roll","Du måste logga ut först"],"ratt":1,"forklaring":"Växlaren syns bara för den som har mer än en roll."},
      {"fraga":"Du har en iPhone och trycker Så lägger du till appen. Vad gör du sedan?","alternativ":["Väntar på att appen laddas ner","Trycker på Dela i Safari och väljer Lägg till på hemskärmen","Laddar ner BeGone i App Store"],"ratt":1,"forklaring":"På iPhone kan sidan inte installera sig själv. Du lägger till den från Dela-menyn."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-ticket-systemet","label":"Skicka och svara på en ticket","description":"Fråga kontoret direkt i ärendet."},
      {"slug":"guide-rapportera-tillbud","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Den gula knappen i menyn."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 12, now(), array['technician']
),

-- ─── 4. Roller och vyer, kontor ───
(
  'guide-roller-och-vyer-kontor',
  'Hitta rätt i portalen',
  'Sidomenyn, Mitt konto, byta lösenord och växlaren för dig som har flera roller.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Sidomenyn till vänster och växlaren uppe till höger","tar":"3 min","enhet":"dator"},
    {"type":"kortsvar","text":"Sidorna ligger i grupper i menyn till vänster. Längst ner finns [[Mitt konto]], där du byter lösenord. Har du flera roller byter du vy i växlaren uppe till höger."},
    {"type":"visning","steg":[
      {"text":"Tryck på en grupp i menyn till vänster, till exempel Försäljning.","ser":"Gruppen fälls ut och visar sina sidor. Grupper med grön rubrik är öppna från början."},
      {"text":"Tryck [[Mitt konto]] längst ner i menyn.","ser":"Sidan Min profil öppnas med Profilinformation och Byt lösenord."},
      {"text":"Fyll i Nuvarande lösenord, Nytt lösenord och Bekräfta nytt lösenord. Tryck [[Byt lösenord]].","ser":"Det står Lösenord uppdaterat! Raderna under Lösenordskrav: blir gröna när de är uppfyllda."},
      {"text":"Har du flera roller: tryck på vyn du vill byta till i växlaren uppe till höger.","ser":"Den vyns Översikt öppnas. Växlaren syns bara om du har mer än en roll."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser ingen växlare","svar":"Du har bara en roll. Admin lägger till roller under Användarkonton (Personal), Roller & vyer. I säljarvyn finns ingen växlare i dag. Skriv till admin om du behöver byta därifrån."},
      {"fraga":"Det står Lösenorden matchar inte","svar":"Nytt lösenord och Bekräfta nytt lösenord är olika. Skriv samma i båda."},
      {"fraga":"Det står Lösenordet måste innehålla minst en stor bokstav","svar":"Lösenordet ska ha minst 8 tecken, en stor bokstav, en liten bokstav och en siffra. Raderna under Lösenordskrav: visar vad som saknas."},
      {"fraga":"Det står Felaktigt nuvarande lösenord","svar":"Det du skrev under Nuvarande lösenord stämmer inte. Har du glömt det: logga ut och tryck Glömt lösenord? på inloggningssidan."}
    ]},
    {"type":"bra","items":[
      "Uppdateringar längst ner i menyn visar vad som är nytt i portalen. Intranät & Hjälpcenter har handboken och policyerna.",
      "Sök i systemet uppe i mitten, eller Ctrl och K, hittar ärenden och kunder.",
      "Ändrar du e-postadress under Profilinformation skickas en bekräftelse till den nya adressen.",
      "Använd som app finns bara i telefonen. På datorn syns den rutan inte.",
      "Roller ändrar admin under Användarkonton (Personal), Roller & vyer."
    ]},
    {"type":"ovning","uppdrag":"Byt ditt lösenord till ett nytt och byt sedan till teknikervyn. Du har både rollen koordinator och tekniker."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har både admin och tekniker. Hur kommer du till teknikerns sidor?","alternativ":["Loggar ut och in igen som tekniker","Trycker Tekniker i växlaren uppe till höger","Öppnar Mitt konto"],"ratt":1,"forklaring":"Växlaren byter vy direkt, utan att du loggar ut."},
      {"fraga":"Du trycker Byt lösenord och det står Lösenorden matchar inte. Vad är fel?","alternativ":["Nuvarande lösenord är fel","Nytt lösenord och Bekräfta nytt lösenord är olika","Lösenordet är för kort"],"ratt":1,"forklaring":"Skriv exakt samma nya lösenord i båda fälten."}
    ]},
    {"type":"avslut","lankar":[],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 13, now(), array['admin','koordinator','säljare']
),

-- ─── 5. Tillbud, tekniker ───
(
  'guide-rapportera-tillbud',
  'Rapportera ett tillbud, en avvikelse eller en olycka',
  'Oj, aj eller hmm? Så rapporterar du från telefonen, och det här händer sedan.',
  'handbok', 'sakerhet',
  $json$[
    {"type":"intro","roller":["technician"],"var":"[[Mer]] › den gula knappen","tar":"2 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Mer]] och den gula knappen. Tryck [[Rapportera händelse]], välj typ, skriv vad som hände och tryck [[Skicka rapport]]. Rapportera hellre en gång för mycket."},
    {"type":"callout","variant":"warning","title":"Vid akut nödläge","text":"Ring 112 först vid allvarlig skada. Rapportera i portalen när läget är under kontroll."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Mer]] längst ner till höger.","ser":"Menyn öppnas."},
      {"text":"Tryck på den gula knappen [[Rapportera tillbud, avvikelse eller olycka|rapport.avvikelse]].","ser":"Sidan Tillbud & Avvikelser öppnas med dina egna rapporter."},
      {"text":"Tryck [[Rapportera händelse|allman.plus]].","ser":"Formuläret öppnas. Ditt namn står redan under Berörda anställda."},
      {"text":"Välj typ: Oj! Tillbud, Aj! Olycka eller Hmm Avvikelse.","ser":"Rutan du valt blir färgad. Väljer du Olycka visas en påminnelse om anmälan till Arbetsmiljöverket."},
      {"text":"Tryck i Vad har hänt? och beskriv vad som hände, var och hur.","ser":"När inträffade händelsen? är satt till nu. Ändra den om det hände tidigare."},
      {"text":"Tryck [[Skicka rapport]].","ser":"Det står till exempel Tillbud rapporterad. Rapporten syns i listan med status Ny."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Skicka rapport är grå","svar":"Vad har hänt? är tomt. Skriv vad som hände först."},
      {"fraga":"Det står Kunde inte spara","svar":"Rapporten skickades inte. Kontrollera täckningen och tryck [[Skicka rapport]] igen. Det du skrivit ligger kvar."},
      {"fraga":"Det står Inga ärenden hittades under Koppla till ärende","svar":"Du kan bara söka bland dina egna ärenden. Skriv minst två tecken av titeln eller ärendenumret. Kopplingen är valfri, så du kan skicka utan den."},
      {"fraga":"Jag hittar inte en gammal rapport","svar":"Under Tillbud & Avvikelser ser du rapporter du har skickat och rapporter där du står som berörd."}
    ]},
    {"type":"bra","items":[
      "Oj! Tillbud: det kunde ha gått illa men ingen skadades. Aj! Olycka: någon skadades, även lindrigt. Hmm Avvikelse: något avvek från rutin, process eller kvalitetskrav.",
      "Syftet är aldrig att peka ut någon. Rapporterna används för att hitta problem och se till att de inte händer igen.",
      "De som tar emot den typen av rapport får en notis och ett mejl direkt.",
      "Var fler med? Lägg till dem under Berörda anställda. Ditt eget namn går inte att ta bort.",
      "Snabbknappen Rapportera tillbud/olycka på Översikt går också till sidan."
    ]},
    {"type":"ovning","uppdrag":"Stegen gled på det blöta golvet hos Exempel AB. Du tog emot dig och ingen skadades. Rapportera det."},
    {"type":"quiz","fragor":[
      {"fraga":"En kollega skar sig lätt på en kniv vid uppackning. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":1,"forklaring":"Någon skadades, oavsett hur lindrigt. Det är en olycka."},
      {"fraga":"Du halkade men tog emot dig. Ingen skadades. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":0,"forklaring":"Det kunde ha gått illa men ingen skadades. Det är ett tillbud."},
      {"fraga":"Vad händer när du har skickat rapporten?","alternativ":["Inget förrän du ringer kontoret","De som tar emot rapporter får notis och mejl, och rapporten får status Ny","Rapporten skickas till kunden"],"ratt":1,"forklaring":"Mottagarna får besked direkt och utreder rapporten. Du ser status i listan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-ticket-systemet","label":"Skicka och svara på en ticket","description":"Fråga kontoret direkt i ärendet."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i portalen","description":"Menyn, Mitt konto och appen på hemskärmen."}
    ],"fraga":"Din närmaste chef, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 14, now(), array['technician']
),

-- ─── 6. Tillbud, kontor ───
(
  'guide-rapportera-tillbud-kontor',
  'Rapportera ett tillbud, en avvikelse eller en olycka',
  'Rapportera från datorn, och utred och avsluta rapporter om du tar emot dem.',
  'handbok', 'sakerhet',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Den gula knappen överst i sidomenyn","tar":"3 min","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck på den gula knappen och [[Rapportera händelse]]. Välj typ, beskriv, lägg till den det gäller under Berörda anställda och tryck [[Skicka rapport]]. Tar du emot rapporter utreder du dem på samma sida."},
    {"type":"callout","variant":"warning","title":"Vid akut nödläge","text":"Ring 112 först vid allvarlig skada. Rapportera i portalen när läget är under kontroll."},
    {"type":"visning","steg":[
      {"text":"Tryck på den gula knappen [[Rapportera tillbud, avvikelse eller olycka|rapport.avvikelse]] överst i sidomenyn.","ser":"Sidan Tillbud & Avvikelser öppnas."},
      {"text":"Tryck [[Rapportera händelse|allman.plus]].","ser":"Formuläret öppnas överst på sidan."},
      {"text":"Välj typ: Oj! Tillbud, Aj! Olycka eller Hmm Avvikelse.","ser":"Rutan du valt blir färgad."},
      {"text":"Skriv i Vad har hänt? vad som hände, var och hur.","ser":"När inträffade händelsen? är satt till nu. Ändra den om det hände tidigare."},
      {"text":"Välj den det gäller i Lägg till anställd... och tryck på plus.","ser":"Namnet syns under Berörda anställda. På kontoret är ingen förvald."},
      {"text":"Tryck [[Skicka rapport]].","ser":"Det står till exempel Avvikelse rapporterad. Rapporten får status Ny."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Skicka rapport är grå","svar":"Vad har hänt? är tomt, eller ingen står under Berörda anställda. Båda krävs."},
      {"fraga":"Jag kan inte öppna en rapport i listan","svar":"Bara den som tar emot den typen av rapport kan öppna Utredning & åtgärd. Admin väljer mottagare under Användarkonton (Personal), Incidentmottagare."},
      {"fraga":"Det står Fyll i uppföljningen innan ärendet avslutas","svar":"Skriv i Är åtgärden genomförd och tillräcklig? innan du väljer Avslutad och trycker [[Spara & avsluta]]."},
      {"fraga":"Det står Kunde inte spara","svar":"Inget sparades. Försök igen. Det du skrivit ligger kvar."}
    ]},
    {"type":"bra","items":[
      "Tar du emot rapporter får du notis och mejl när en ny kommer. Överst på sidan står det hur många nya rapporter du har att hantera, och [[Visa nya]] visar bara dem.",
      "Tryck på raden för att öppna Utredning & åtgärd. Där fyller du i Klassificering, Orsaksanalys, Beslutad åtgärd med Ansvarig och Klart till, och Uppföljning.",
      "Status går från Ny till Under utredning, Åtgärdad och Avslutad. Avslutad kräver att uppföljningen är ifylld.",
      "Vid olycka och tillbud: bedöm Ska anmälan göras till anmalarbetsskada.se? Allvarlig olycka eller allvarligt tillbud ska anmälas utan dröjsmål.",
      "[[Exportera]] ger hela registret som en fil för Excel, till exempel inför revision. Knappen syns bara för den som tar emot rapporter."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården ringde och klagade på att det bokade besöket i dag aldrig blev av. Teknikern var Erik Exempel. Rapportera det och ange Erik som berörd."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden klagar på att vi missade ett bokat besök. Ingen skadades. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":2,"forklaring":"Kunden fick inte det vi lovat. Det är en avvikelse."},
      {"fraga":"Du ska avsluta en utredd rapport men får Fyll i uppföljningen innan ärendet avslutas. Vad gör du?","alternativ":["Väljer Åtgärdad i stället","Skriver i Är åtgärden genomförd och tillräcklig? och sparar igen","Raderar rapporten"],"ratt":1,"forklaring":"Uppföljningen visar att åtgärden fungerade. Den krävs innan rapporten avslutas."},
      {"fraga":"Du ser en rapport i listan men kan inte öppna den. Varför?","alternativ":["Du tar inte emot den typen av rapport","Rapporten är raderad","Du måste trycka Uppdatera"],"ratt":0,"forklaring":"Bara mottagare av typen kan utreda. Admin väljer mottagare per person."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-ticket-systemet-kontor","label":"Skicka och svara på en ticket","description":"Fråga en kollega direkt i ärendet."},
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 15, now(), array['admin','koordinator']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
