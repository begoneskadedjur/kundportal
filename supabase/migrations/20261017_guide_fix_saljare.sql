-- Guiderna efter att säljarvyn fick sökrutan, växlaren och Tillbud & Avvikelser (2026-10-17).
--   guide-roller-och-vyer-kontor     Växlaren finns nu i säljarvyn. Sökrutan beskrivs per roll.
--                                    Avslutet länkar till tillbudsguiden, som alla tre rollerna ser.
--   guide-rapportera-tillbud-kontor  Gäller nu även säljare (route /saljare/tillbud-avvikelser,
--                                    gula knappen i säljarens sidomeny). Ticketguiden tas bort ur
--                                    avslutet eftersom säljaren inte ser den.
--   guide-sokrutan-saljare           Ny: säljarens sökning ger kunder, dokument och webbleads, inga
--                                    ärenden, så kontorets guide (Boka in) gäller inte säljaren.
--                                    Modul: src/pages/shared/intranet/guider/guide-sokrutan-saljare.tsx
-- guide-sokrutan-kontor är oförändrad och gäller fortfarande admin och koordinator.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- ─── Roller och vyer, kontor ───
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
      {"fraga":"Jag ser ingen växlare","svar":"Du har bara en roll. Admin lägger till roller under Användarkonton (Personal), Roller & vyer."},
      {"fraga":"Det står Lösenorden matchar inte","svar":"Nytt lösenord och Bekräfta nytt lösenord är olika. Skriv samma i båda."},
      {"fraga":"Det står Lösenordet måste innehålla minst en stor bokstav","svar":"Lösenordet ska ha minst 8 tecken, en stor bokstav, en liten bokstav och en siffra. Raderna under Lösenordskrav: visar vad som saknas."},
      {"fraga":"Det står Felaktigt nuvarande lösenord","svar":"Det du skrev under Nuvarande lösenord stämmer inte. Har du glömt det: logga ut och tryck Glömt lösenord? på inloggningssidan."}
    ]},
    {"type":"bra","items":[
      "Uppdateringar längst ner i menyn visar vad som är nytt i portalen. Intranät & Hjälpcenter har handboken och policyerna.",
      "Sök i systemet uppe i mitten, eller Ctrl och K, hittar det din roll får se. Koordinatorn och admin hittar ärenden och kunder. Säljaren hittar kunder, offerter och avtal och webbleads.",
      "Ändrar du e-postadress under Profilinformation skickas en bekräftelse till den nya adressen.",
      "Använd som app finns bara i telefonen. På datorn syns den rutan inte.",
      "Roller ändrar admin under Användarkonton (Personal), Roller & vyer."
    ]},
    {"type":"ovning","uppdrag":"Byt ditt lösenord till ett nytt och byt sedan till teknikervyn. Du har både rollen koordinator och tekniker."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har både admin och tekniker. Hur kommer du till teknikerns sidor?","alternativ":["Loggar ut och in igen som tekniker","Trycker Tekniker i växlaren uppe till höger","Öppnar Mitt konto"],"ratt":1,"forklaring":"Växlaren byter vy direkt, utan att du loggar ut."},
      {"fraga":"Du trycker Byt lösenord och det står Lösenorden matchar inte. Vad är fel?","alternativ":["Nuvarande lösenord är fel","Nytt lösenord och Bekräfta nytt lösenord är olika","Lösenordet är för kort"],"ratt":1,"forklaring":"Skriv exakt samma nya lösenord i båda fälten."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-rapportera-tillbud-kontor","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Den gula knappen överst i sidomenyn."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 13, now(), array['admin','koordinator','säljare']
),

-- ─── Tillbud, kontor ───
(
  'guide-rapportera-tillbud-kontor',
  'Rapportera ett tillbud, en avvikelse eller en olycka',
  'Rapportera från datorn, och utred och avsluta rapporter om du tar emot dem.',
  'handbok', 'sakerhet',
  $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Den gula knappen överst i sidomenyn","tar":"3 min","enhet":"dator"},
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
      "Tryck på raden för att öppna Utredning & åtgärd. Där fyller du i Klassificering, Orsaksanalys, Beslutad åtgärd med Ansvarig och Klart till, och Uppföljning. Status går från Ny till Under utredning, Åtgärdad och Avslutad, och Avslutad kräver att uppföljningen är ifylld.",
      "Vid olycka och tillbud: bedöm Ska anmälan göras till anmalarbetsskada.se? Allvarlig olycka eller allvarligt tillbud ska anmälas utan dröjsmål.",
      "Säljaren hittar sidan också under Verktyg › Tillbud & Avvikelser i menyn. I listan ser du rapporter du har skickat.",
      "[[Exportera]] ger hela registret som en fil för Excel, till exempel inför revision. Knappen syns bara för den som tar emot rapporter."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården ringde och klagade på att det bokade besöket i dag aldrig blev av. Teknikern var Erik Exempel. Rapportera det och ange Erik som berörd."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden klagar på att vi missade ett bokat besök. Ingen skadades. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":2,"forklaring":"Kunden fick inte det vi lovat. Det är en avvikelse."},
      {"fraga":"Du ska avsluta en utredd rapport men får Fyll i uppföljningen innan ärendet avslutas. Vad gör du?","alternativ":["Väljer Åtgärdad i stället","Skriver i Är åtgärden genomförd och tillräcklig? och sparar igen","Raderar rapporten"],"ratt":1,"forklaring":"Uppföljningen visar att åtgärden fungerade. Den krävs innan rapporten avslutas."},
      {"fraga":"Du ser en rapport i listan men kan inte öppna den. Varför?","alternativ":["Du tar inte emot den typen av rapport","Rapporten är raderad","Du måste trycka Uppdatera"],"ratt":0,"forklaring":"Bara mottagare av typen kan utreda. Admin väljer mottagare per person."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 15, now(), array['admin','koordinator','säljare']
),

-- ─── Sökrutan, säljare ───
(
  'guide-sokrutan-saljare',
  'Hitta en kund och skapa en offert med sökrutan',
  'Hitta kunder, offerter, avtal och webbleads med Ctrl+K, och skapa en offert med kunden ifylld direkt från träffen.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["säljare"],"var":"Sök i systemet... högst upp, eller Ctrl+K","tar":"1 min","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck Ctrl+K och skriv det du vet: telefon, e-post, org.nr, kundnummer eller namn. Under kunden finns snabbvalen, till exempel [[Ny offert]] som öppnar offertguiden med kunden ifylld."},
    {"type":"visning","steg":[
      {"text":"Tryck Ctrl+K, eller tryck på [[Sök i systemet...]] högst upp.","ser":"Sökrutan öppnas med Senast öppnade och Åtgärder: Ny lead, Ny offert, Nytt avtal och Rapportera tillbud."},
      {"text":"Skriv det du vet, här telefonnumret 08-123 456 78.","ser":"Till höger i fältet står tolkas som telefonnummer. Träffarna kommer i grupper, här Kunder, Dokument och Åtgärder. Kunden överst är markerad."},
      {"text":"Tryck [[Ny offert]] under kunden.","ser":"Offertguiden öppnas med kundens namn, org.nr och kontaktuppgifter ifyllda. Fortsätt som vanligt."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Inga träffar för och det jag skrev","svar":"Skriv färre eller andra ord. Alla ord måste finnas i träffen. Äldre dokument från Oneflow kommer bara med om du skriver ordet arkiv."},
      {"fraga":"Jag hittar inte ett ärende","svar":"Säljarens sökning visar inga ärenden. Sök på kunden i stället och tryck [[Kundkort]]."},
      {"fraga":"Snabbvalen syns inte","svar":"De syns bara under den markerade raden. Flytta med ↓ eller håll musen över raden. Ett tryck på själva raden öppnar den direkt."},
      {"fraga":"Det står Sökningen misslyckades. Försök igen om en stund.","svar":"Vänta en stund och skriv igen. Fortsätter det, skriv i Teams-chatten Systemet."}
    ]},
    {"type":"bra","items":[
      "Du hittar alla kunder, alla offerter och avtal och alla webbleads. Längst ner till höger i sökrutan står Kunder, dokument och webbleads.",
      "Ett nummer som 1042 letar efter kundnummer och efter referensnummer på offerter och webbleads.",
      "En offert eller ett avtal öppnas under Dokumentsignering. En webblead öppnas under Leads (Webb).",
      "Söker du på en kund får du också åtgärderna Ny offert till och Nytt avtal för kunden.",
      "Tab byter snabbval på den markerade raden, Enter gör det valda och Esc stänger. Sök... längst ner i sidomenyn öppnar också sökrutan."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB ringer från 08-123 456 78 och vill ha en ny offert. Hitta kunden och skapa offerten med kunden ifylld."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden ringer och du har bara telefonnumret. Vad skriver du i sökrutan?","alternativ":["Kundens namn, som du gissar","Telefonnumret, som det står","Ingenting, du letar under Befintliga kunder"],"ratt":1,"forklaring":"Sökrutan känner igen telefonnummer, med eller utan mellanslag och bindestreck."},
      {"fraga":"Du vill skapa en offert med kunden ifylld. Vilket snabbval under kunden?","alternativ":["Kundkort","Ny offert","Stationer"],"ratt":1,"forklaring":"Ny offert öppnar offertguiden med kundens uppgifter ifyllda."},
      {"fraga":"Du söker på ett ärendenummer och får inga träffar. Varför?","alternativ":["Sökrutan är trasig","Säljarens sökning visar inga ärenden","Du måste skriva ordet arkiv"],"ratt":1,"forklaring":"Säljaren söker bland kunder, dokument och webbleads. Sök på kunden och öppna kundkortet."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-leads-saljare","label":"Arbeta med dina leads","description":"Dina leads från början till avslut."},
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 71, now(), array['säljare']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
