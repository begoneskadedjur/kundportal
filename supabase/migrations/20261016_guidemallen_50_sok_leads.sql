-- Guidemallen (godkänd 2026-10-16): sökrutan och leads, en uppgift per guide och roll.
-- Guidemoduler i src/pages/shared/intranet/guider/:
--   guide-sokrutan-tekniker.tsx, guide-sokrutan-kontor.tsx (delade delar i _sok.tsx)
--   guide-leads-tekniker.tsx, guide-leads-saljare.tsx, guide-leads-kontor.tsx (delade delar i _leads.tsx)
-- Tipsbonusen nämns inte: den är avstängd (commission_settings.tipsbonus_aktiv = 0).
-- Idempotent: on conflict skriver om guiderna.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-sokrutan-tekniker',
  'Hitta ett ärende eller en kund med sökrutan',
  'Sök på telefonnummer, ärendenummer, adress eller namn i telefonen och öppna ärendet direkt.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Förstoringsglaset uppe till höger","tar":"1 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på förstoringsglaset uppe till höger och skriv det du vet: telefonnummer, ärendenummer, adress eller kundens namn. Tryck på träffen så öppnas ärendet. Du ser bara dina egna ärenden."},
    {"type":"visning","steg":[
      {"text":"Tryck på förstoringsglaset uppe till höger.","ser":"Sökrutan öppnas. Du ser det du öppnade senast och några åtgärder."},
      {"text":"Tryck i fältet och skriv minst två tecken, till exempel telefonnumret 070-123 45 67.","ser":"Under fältet står hur sökrutan läser det, här tolkas som telefonnummer. Träffarna kommer medan du skriver."},
      {"text":"Tryck på ärendet du letar efter.","ser":"Ärendet öppnas under Mina ärenden. Nästa gång ligger det under Senast öppnade."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Inga träffar för och det jag skrev","svar":"Du hittar bara ärenden där du är en av teknikerna. Kontrollera numret, eller skriv kundens namn eller gatan i stället. Alla ord du skriver måste finnas i träffen."},
      {"fraga":"Det står Skriv minst två tecken.","svar":"Sökrutan börjar leta vid två tecken. Skriv ett tecken till."},
      {"fraga":"Jag hittar inte ett gammalt ärende","svar":"Ärenden från ClickUp, före 2026-05-01, kommer bara med om du skriver ordet arkiv i sökningen, till exempel arkiv möss. De hamnar i gruppen Arkiv (ClickUp)."},
      {"fraga":"Det står Sökningen misslyckades. Försök igen om en stund.","svar":"Telefonen fick inget svar från portalen. Vänta en stund och skriv igen. Fortsätter det, skriv i Teams-chatten Systemet."}
    ]},
    {"type":"bra","items":[
      "Telefonnummer och org.nr kan skrivas som du vill. Mellanslag och bindestreck spelar ingen roll.",
      "En kund i träffarna öppnar kundens stationsvy. Under den markerade raden finns också Skapa offert och Skapa avtal med kunden ifylld.",
      "Du ser ärenden där du är en av teknikerna, och offerter och avtal som du har skapat eller står som ansvarig på.",
      "Med tom ruta får du snabbvalen Skapa offert, Skapa avtal, Rapportera tillbud och Mitt schema.",
      "På datorn öppnar du sökrutan med Ctrl+K, på Mac med Cmd+K."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel ringer från 070-123 45 67 och frågar om besöket på tisdag. Hitta ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden ringer och du har bara telefonnumret. Vad skriver du?","alternativ":["Kundens namn, som du gissar","Telefonnumret, som det står","Ingenting, du ringer kontoret"],"ratt":1,"forklaring":"Sökrutan känner igen telefonnummer, med eller utan mellanslag och bindestreck."},
      {"fraga":"Du söker på ett ärende från i våras, före 2026-05-01, och får inga träffar. Vad gör du?","alternativ":["Skriver ordet arkiv i sökningen","Skriver numret en gång till","Ger upp"],"ratt":0,"forklaring":"Gamla ärenden från ClickUp kommer bara med när du skriver arkiv. Du ser bara dina egna."},
      {"fraga":"Varför hittar du inte en kollegas ärende?","alternativ":["Sökrutan är trasig","Du ser bara ärenden där du är en av teknikerna","Du skrev för många tecken"],"ratt":1,"forklaring":"Teknikerns sökning visar dina egna ärenden och dem du delar med andra tekniker."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-leads-tekniker","label":"Tipsa om en lead","description":"När kunden eller grannen behöver mer hjälp."},
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Nästa besök i samma ärende."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 70, now(), array['technician']
),
(
  'guide-sokrutan-kontor',
  'Hitta med sökrutan',
  'Hitta ärenden, kunder, leads, tekniker och fakturor med Ctrl+K, och boka in eller skapa offert direkt från träffen.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Sök i systemet... högst upp, eller Ctrl+K","tar":"1 min","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck Ctrl+K och skriv det du vet: nummer, org.nr, telefon, e-post eller namn. Markera träffen så visas snabbvalen, till exempel [[Boka in]] för ett ärende som saknar tid."},
    {"type":"visning","steg":[
      {"text":"Tryck Ctrl+K, eller tryck på [[Sök i systemet...]] högst upp.","ser":"Sökrutan öppnas med Senast öppnade och Åtgärder."},
      {"text":"Skriv det du vet, här telefonnumret 08-123 456 78.","ser":"Till höger i fältet står tolkas som telefonnummer. Träffarna kommer i grupper, här Ärenden, Kunder och Åtgärder."},
      {"text":"Tryck ↓ eller håll musen över ärendet som saknar tid.","ser":"Raden markeras och snabbvalen [[Öppna]] och [[Boka in]] visas under den."},
      {"text":"Tryck [[Boka in]].","ser":"Schemat öppnas med Boka in: och ärendets namn. Välj tekniker och tid som vanligt."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Inga träffar för och det jag skrev","svar":"Skriv färre eller andra ord. Alla ord måste finnas i träffen. Gamla ärenden från ClickUp och dokument från Oneflow kommer bara med om du skriver ordet arkiv."},
      {"fraga":"Snabbvalen syns inte","svar":"De syns bara under den markerade raden. Flytta med ↓ eller håll musen över raden. Ett tryck på själva raden öppnar den direkt."},
      {"fraga":"Det står Flytta i stället för Boka in","svar":"Ärendet har redan en tid. Flytta öppnar ärendet i schemat."},
      {"fraga":"Det står Sökningen misslyckades. Försök igen om en stund.","svar":"Vänta en stund och skriv igen. Fortsätter det, skriv i Teams-chatten Systemet."}
    ]},
    {"type":"bra","items":[
      "Ett nummer som 4711 letar efter ärendenummer, kundnummer, fakturanummer och Fortnox-nummer på samma gång.",
      "Söker du på en kund får du också Ny offert till och Nytt avtal för kunden. Har kunden avtal får du Nytt ärende hos kunden.",
      "Söker du på en tekniker får du Boka in ärende hos och teknikerns förnamn. Den öppnar bokningsassistenten med teknikern vald.",
      "Tab byter snabbval på den markerade raden, Enter gör det valda och Esc stänger.",
      "Koordinatorn söker i alla ärenden. Admin får dessutom Personalkort på teknikerna."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB ringer från 08-123 456 78. Deras nya ärende har ingen tid än. Boka in det."},
    {"type":"quiz","fragor":[
      {"fraga":"Du skriver 08-123 456 78. Hur ser du att sökrutan förstod?","alternativ":["Det står tolkas som telefonnummer till höger i fältet","Träffarna blir gröna","Det kommer en notis"],"ratt":0,"forklaring":"Sökrutan visar alltid hur den läser det du skriver, till höger i fältet."},
      {"fraga":"Ärendet har redan en tid och ska till en annan dag. Vilket snabbval?","alternativ":["Boka in","Flytta","Öppna"],"ratt":1,"forklaring":"Boka in finns bara när ärendet saknar tid. Har det en tid heter valet Flytta."},
      {"fraga":"Du hittar inte ett ärende från ClickUp i våras. Vad skriver du?","alternativ":["Ordet arkiv och ditt sökord","Ärendenumret en gång till","Ordet clickup"],"ratt":0,"forklaring":"Ordet arkiv tar med gamla ärenden från ClickUp och dokument från Oneflow."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-leads-kontor","label":"Fördela nya tips","description":"Ge nya tips från teknikerna till rätt säljare."},
      {"slug":"guide-schemavyn","label":"Schemavyn","description":"Vyer, sök, filter och drag och släpp i schemat."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 71, now(), array['admin','koordinator']
),
(
  'guide-leads-tekniker',
  'Tipsa om en lead',
  'Tipsa från ärendet i telefonen när kunden, föreningen eller kundens företag behöver mer hjälp.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › Skapa lead under statusraden","tar":"1 min","behover":"Ett privat engångsärende eller ett företagsärende","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Skapa lead|lead.tips]] i ärendet, välj vad tipset gäller och skriv en rad om vad du såg. Tryck [[Skicka lead]]. Kund, telefon, adress och skadedjur följer med av sig själva."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck [[Skapa lead|lead.tips]] under statusraden.","ser":"Rutan Skapa lead öppnas med kundens namn överst."},
      {"text":"Under Vad gäller det? trycker du på det som passar, här Bostadsrättsföreningen.","ser":"Valet blir markerat. Gäller tipset föreningen eller kundens företag kommer ett fält för namnet."},
      {"text":"Skriv föreningens namn i fältet Förening.","ser":"Namnet blir leadens namn."},
      {"text":"Skriv en rad under Vad såg du?","ser":"Till exempel möss i soprummet, kunden sitter i styrelsen."},
      {"text":"Tryck [[Skicka lead]].","ser":"Det står Leaden är skapad. Ärendet visar Lead skapad och namnet."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser ingen knapp Skapa lead","svar":"Knappen finns bara i privata engångsärenden och företagsärenden. I avtalsärenden, rondering och egenkontroll tipsar du under Mina leads och tips, med [[Tipsa om en lead]] längst ned."},
      {"fraga":"Det står Lead skapad i stället för knappen","svar":"Ärendet har redan en lead. Varje ärende kan bara ha en."},
      {"fraga":"Det står Välj vad det gäller.","svar":"Du har inte valt något under Vad gäller det? Tryck på det som passar och skicka igen."},
      {"fraga":"Det står Det finns en öppen lead med samma uppgifter","svar":"Någon har redan en lead med samma telefon, e-post eller org.nr. Tryck [[Lägg anteckning där]] så hamnar ditt tips i den leaden. Är det något nytt trycker du [[Skapa ny lead ändå]]."}
    ]},
    {"type":"bra","items":[
      "Du står som tipsare. Personnummer följer aldrig med.",
      "Koordinatorn ger tipset till en säljare. Målet är att kunden kontaktas inom två arbetsdagar.",
      "Du följer tipset under Försäljning › Mina leads och tips.",
      "Du får en notis när tipset får en offert eller ett avtalsförslag, och när det är vunnet.",
      "I företagsärenden är valen Löpande avtal, Fler adresser och Annan tjänst."
    ]},
    {"type":"ovning","uppdrag":"Hos Familjen Exempel berättar kunden att hon sitter i styrelsen i Brf Exempelgården och att föreningen har möss i soprummet. Tipsa om föreningen."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden vill ha regelbunden kontroll i sin egen villa. Vad väljer du?","alternativ":["Löpande avtal för hemmet","Bostadsrättsföreningen","Kundens företag"],"ratt":0,"forklaring":"Löpande avtal för hemmet gäller kundens egen bostad."},
      {"fraga":"Du är på en rondering och ser att grannen behöver hjälp. Var tipsar du?","alternativ":["Med Skapa lead i ronderingen","Med Tipsa om en lead under Mina leads och tips","Ingenstans, det går inte"],"ratt":1,"forklaring":"Skapa lead finns bara i engångsärenden. Annars tipsar du under Mina leads och tips."},
      {"fraga":"Rutan säger att det finns en öppen lead med samma uppgifter. Vad gör du?","alternativ":["Skapa ny lead ändå","Lägg anteckning där","Avbryter och glömmer det"],"ratt":1,"forklaring":"Då hamnar ditt tips hos den som redan arbetar med kunden, och det blir ingen dubblett."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-sokrutan-tekniker","label":"Hitta ett ärende eller en kund med sökrutan","description":"Sök på telefon, nummer eller namn."},
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Nästa besök i samma ärende."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 72, now(), array['technician']
),
(
  'guide-leads-saljare',
  'Arbeta med dina leads',
  'Börja dagen i Att göra och avsluta varje kontakt med Klar, välj nästa, så att leaden alltid har ett nästa steg.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["säljare"],"var":"Leads (B2B) › Att göra","tar":"2 min","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna leaden överst under Att göra och gör det som står i Nästa steg. Tryck sedan [[Klar, välj nästa|allman.bock]], skriv vad som hände och välj ett nytt nästa steg med datum. Varje öppen lead ska ha ett nästa steg."},
    {"type":"visning","steg":[
      {"text":"Öppna Leads (B2B) i menyn. Tryck på leaden överst under Försenade.","ser":"Leaden öppnas. Rutan Nästa steg är röd och det står försenat."},
      {"text":"Gör det som står, till exempel ring kunden. Tryck sedan [[Klar, välj nästa|allman.bock]].","ser":"Rutan blir Klart. Vad blev gjort och vad händer sedan?"},
      {"text":"Välj vad du gjorde. Samtal är förvalt.","ser":"Du kan välja Anteckning, Samtal, Mejl eller Möte."},
      {"text":"Skriv vad som hände under Vad hände?","ser":"Lämnar du rutan tom loggas Klart: och det gamla steget."},
      {"text":"Under Nytt nästa steg skriver du vad som ska göras i fältet Nästa steg.","ser":"Datum och tid är förvalt till nästa vardag 09:00. Ändra om det behövs."},
      {"text":"Tryck [[Spara]].","ser":"Det du gjorde hamnar under Aktivitet. Var leaden Ny blir den Kontaktad. Den försvinner ur Att göra tills datumet kommer."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Skriv nästa steg och välj datum","svar":"Fältet Nästa steg eller Datum och tid är tomt. Fyll i båda och tryck Spara igen."},
      {"fraga":"Det står Inget nästa steg. Bestäm vad som ska hända och när.","svar":"Leaden saknar nästa steg. Tryck [[Välj nästa steg]] och fyll i vad och när."},
      {"fraga":"Knappen Klar, välj nästa syns inte","svar":"Du är tipsare på leaden men inte ägare, och den är inte delad med dig. Be ägaren dela den med dig."},
      {"fraga":"Det står Välj ett datum framåt i tiden då leaden ska vakna","svar":"Du valde Parkera. Välj en dag efter i dag under Vaknar den."},
      {"fraga":"Det står Leaden finns inte eller är inte delad med dig","svar":"Du öppnade en länk till en lead som du inte ser. Be ägaren dela den med dig."}
    ]},
    {"type":"bra","items":[
      "Ett samtal, mejl eller möte räknas som kontakt. En anteckning gör det inte.",
      "[[Ändra]] flyttar nästa steg utan att logga något.",
      "Parkera kräver ett datum då leaden vaknar. Förlorad kräver en orsak.",
      "Besök bokat, Offert skickad och Vunnen sätts av sig själva. Skapa offerten med [[Skapa offert|dok.offert]] i leaden, annars flyttas den inte.",
      "Pil upp och ned flyttar i listan, Enter öppnar och N startar en ny lead."
    ]},
    {"type":"interactive","component":"leads-steg","variant":"saljare"},
    {"type":"ovning","uppdrag":"Du har just ringt Exempel AB. De vill ha en offert. Logga samtalet och sätt nästa steg Skicka offert."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har ringt kunden. Vad trycker du på för att både logga samtalet och sätta ett nytt steg?","alternativ":["Logga samtal","Klar, välj nästa","Ändra"],"ratt":1,"forklaring":"Logga samtal sparar bara samtalet. Ändra flyttar bara steget. Klar, välj nästa gör båda."},
      {"fraga":"Kunden har avtal med en annan leverantör ett halvår till. Vad gör du?","alternativ":["Markerar leaden som förlorad","Parkerar den med ett datum då den ska vakna","Låter nästa steg vara försenat"],"ratt":1,"forklaring":"En parkerad lead kommer tillbaka under Parkerade som vaknar i dag samma dag som du valde."},
      {"fraga":"Du skapar offerten direkt i guiden i stället för från leaden. Vad händer med leaden?","alternativ":["Den blir Offert skickad","Ingenting, den flyttas inte","Den blir Vunnen"],"ratt":1,"forklaring":"Bara dokument som skapas med Skapa offert i leaden flyttar den. Be annars koordinatorn sätta steget."}
    ]},
    {"type":"avslut","lankar":[],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 73, now(), array['säljare']
),
(
  'guide-leads-kontor',
  'Fördela nya tips',
  'Fördela nya tips till rätt säljare: läs vad teknikern skrev och överlåt leaden.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Leads (B2B) › Nya tips","tar":"2 min","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna fliken Nya tips och tipset överst. Läs teknikerns text under Mer uppgifter, tryck [[Överlåt eller dela|lead.dela]], välj säljaren under Ny ägare och tryck [[Överlåt|lead.agare]]."},
    {"type":"visning","steg":[
      {"text":"Öppna Leads (B2B) i menyn och tryck på fliken Nya tips.","ser":"Tipsen som väntar, äldst överst. Siffran vid fliken visar hur många. Ingen ägare står i gult."},
      {"text":"Tryck på tipset överst.","ser":"Leaden öppnas. Du ser Ingen ägare och Tips från och teknikerns namn."},
      {"text":"Tryck [[Mer uppgifter]].","ser":"Under Beskrivning och behov står ärendet tipset kom från, vad det gäller och teknikerns text."},
      {"text":"Tryck [[Överlåt eller dela|lead.dela]].","ser":"Rutan öppnas. Det står Ägare nu: ingen."},
      {"text":"Tryck på Ny ägare och välj säljaren.","ser":"Knappen Överlåt är inte grå längre."},
      {"text":"Tryck [[Överlåt|lead.agare]].","ser":"Det står Leaden är överlåten till och säljarens namn. Ägaren syns i leadens huvud."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Överlåt går inte att trycka på","svar":"Den är grå tills du har valt en kollega under Ny ägare."},
      {"fraga":"Tipset ligger kvar under Nya tips","svar":"Nya tips visar också tips som fortfarande är Ny, även när de har en ägare. Tipset försvinner därifrån när säljaren loggar ett samtal, mejl eller möte, eller sätter steget Kontaktad."},
      {"fraga":"Det står Inga nya tips att fördela.","svar":"Alla tips har en ägare och har kontaktats. Inget väntar."},
      {"fraga":"Jag gav tipset till fel person","svar":"Öppna leaden, tryck [[Överlåt eller dela|lead.dela]] igen och välj rätt säljare."}
    ]},
    {"type":"bra","items":[
      "Ett tips från en tekniker har ingen ägare och nästa steg Kontakta kunden om tipset om två dygn. Målet är kontakt inom två arbetsdagar.",
      "Vill du ta tipset själv väljer du [[Ta leaden]] i radens meny eller under Fler åtgärder (⋯) i leaden.",
      "Tipsaren står kvar som tipsare när du överlåter, och får notiser när tipset får en offert och när det är vunnet.",
      "[[Boka besök|allman.kalender]] i leaden öppnar ärendemodalen ifylld. När ärendet sparas kopplas det och steget blir Besök bokat.",
      "Under Fler åtgärder (⋯) kan du sätta Besök bokat, Offert skickad och Vunnen för hand. Gör det bara när besöket eller offerten skapades utanför leaden."
    ]},
    {"type":"interactive","component":"leads-steg","variant":"kontor"},
    {"type":"ovning","uppdrag":"Anna Exempel har tipsat om Brf Exempelgården. Läs vad hon skrev och ge tipset till säljaren Sara Exempel."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hittar du vad teknikern skrev i tipset?","alternativ":["Under Mer uppgifter, i Beskrivning och behov","I rutan Nästa steg","Under Kontakt"],"ratt":0,"forklaring":"Teknikerns text sparas i Beskrivning och behov tillsammans med ärendenumret."},
      {"fraga":"Du vill ta ett tips själv. Vad trycker du på?","alternativ":["Ny lead med samma uppgifter","Ta leaden i radens meny","Klar, välj nästa"],"ratt":1,"forklaring":"Ta leaden gör dig till ägare direkt. Den finns i radens meny och under Fler åtgärder i leaden."},
      {"fraga":"En offert skapades direkt i guiden, inte från leaden. Leaden står kvar på Kontaktad. Vad gör du?","alternativ":["Sätter Offert skickad för hand under Fler åtgärder","Skapar en ny lead","Väntar, den flyttas av sig själv"],"ratt":0,"forklaring":"Systemet vet inte att offerten hör till leaden. Nödutgången under Fler åtgärder är till för just det."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-sokrutan-kontor","label":"Hitta med sökrutan","description":"Ctrl+K, snabbval och Boka in."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 74, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
