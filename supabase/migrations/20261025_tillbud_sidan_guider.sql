-- Guiderna för Tillbud och avvikelser efter den nya sidan (2026-10-24).
-- Sidan: src/pages/admin/IncidentsPage.tsx med src/components/tillbud/*, flikarna
-- Rapportera, Mina rapporter och Registret (bara mottagare).
-- Guidemoduler: src/pages/shared/intranet/guider/guide-rapportera-tillbud.tsx (tekniker,
-- telefon och dator) och guide-rapportera-tillbud-kontor.tsx (admin, koordinator, säljare).
-- Slugs, kategorier och målgrupper behålls så att länkar och läsloggen fungerar. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-rapportera-tillbud',
  'Rapportera ett tillbud, en avvikelse eller en olycka',
  'Oj, aj eller hmm? Så rapporterar du med den gula knappen och följer rapporten under Mina rapporter.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Den gula varningsknappen uppe till höger, på varje sida","tar":"3 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på den gula varningsknappen uppe till höger. Sidan öppnas med formuläret: välj typ, skriv vad som hände och tryck [[Skicka rapport|rapport.skicka]]. Under Mina rapporter ser du hur långt rapporten har kommit."},
    {"type":"callout","variant":"warning","title":"Vid akut nödläge","text":"Ring 112 först vid allvarlig skada. Rapportera i portalen när läget är under kontroll."},
    {"type":"visning","steg":[
      {"text":"Tryck på den gula varningsknappen uppe till höger.","ser":"Sidan Tillbud och avvikelser öppnas på fliken Rapportera, med formuläret Rapportera en händelse."},
      {"text":"Under 1 Vad hände?: tryck Oj! Tillbud, Aj! Olycka eller Hmm Avvikelse.","ser":"Rutan du väljer blir färgad. Tillbud är valt från början. Väljer du Olycka visas en påminnelse om 112 och om anmälan till Arbetsmiljöverket."},
      {"text":"Tryck i Vad har hänt? och skriv vad som hände, var och hur.","ser":"Under 3 När och vem är tiden satt till nu och du står redan som berörd. Ändra tiden om det hände tidigare."},
      {"text":"Vill du visa hur det såg ut: tryck [[Lägg till bilder|allman.foto]] under Bilder och fota eller välj bilder.","ser":"Bilderna står som små rutor. Krysset på en bild tar bort den. Du kan lägga till högst sex bilder."},
      {"text":"Vill du koppla rapporten till ett ärende: tryck på besöket under Dina besök i går och i dag, eller sök bland dina ärenden.","ser":"Ärendet står i en grön ruta. Sökningen hittar dina privat-, företags- och avtalsärenden. Kopplingen är valfri."},
      {"text":"Tryck [[Skicka rapport|rapport.skicka]].","ser":"Det står Tillbudet är rapporterat. De som tar emot tillbud har fått en notis och ett mejl."},
      {"text":"Tryck [[Se mina rapporter|allman.lista]].","ser":"Mina rapporter visar rapporten under Pågår med status Ny."},
      {"text":"Tryck på rapporten.","ser":"Rapporten öppnas med bilderna under texten. Under Hanteringen står hur långt den har kommit. Är rapporten kopplad till ett ärende öppnar du ärendet genom att trycka på det vid Ärende. I telefonen går du tillbaka med pilen uppe till vänster. På datorn visas rapporten bredvid listan."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Skicka rapport är grå","svar":"Vad har hänt? är tomt. Under knappen står vad som saknas."},
      {"fraga":"Det står Kunde inte spara. Det du skrivit ligger kvar.","svar":"Rapporten skickades inte. Kontrollera täckningen och tryck [[Skicka rapport|rapport.skicka]] igen."},
      {"fraga":"Det står att bilderna inte gick att ladda upp","svar":"Rapporten är skickad men bilderna kom inte med. Öppna rapporten under Mina rapporter och tryck [[Lägg till bilder|allman.foto]]."},
      {"fraga":"Det står Inga ärenden hittades under Koppla till ärende","svar":"Sökningen hittar bara dina egna ärenden. Skriv minst två tecken av kunden, adressen eller ärendenumret. Kopplingen är valfri, så du kan skicka utan den."},
      {"fraga":"Det står Tiden kan inte vara senare än nu","svar":"Ändra När inträffade händelsen? till när det hände och tryck [[Skicka rapport|rapport.skicka]] igen."},
      {"fraga":"Jag hittar inte en gammal rapport","svar":"Tryck på fliken Mina rapporter. Klara rapporter ligger hopfällda under Avslutade. Där finns rapporter du har skickat och rapporter där du står som berörd."}
    ]},
    {"type":"bra","items":[
      "Oj! Tillbud: det kunde ha gått illa men ingen skadades. Aj! Olycka: någon skadades, även lindrigt. Hmm Avvikelse: något avvek från rutin, process eller kvalitetskrav.",
      "Syftet är aldrig att peka ut någon. Rapporterna används för att hitta problem och se till att de inte händer igen.",
      "Statusen visar hur långt rapporten har kommit: Ny, Under utredning, Åtgärdad och Avslutad. Den som tar emot rapporten ändrar statusen.",
      "Var fler med? Lägg till dem under Berörda anställda. Ditt eget namn går inte att ta bort.",
      "Byter du flik ligger det du skrivit kvar. Formuläret når du också längst ner under Skapa och i sökrutan, åtgärden Rapportera tillbud."
    ]},
    {"type":"ovning","uppdrag":"Stegen gled på det blöta golvet hos Exempel AB. Du tog emot dig och ingen skadades. Rapportera det och kontrollera sedan att rapporten kom fram."},
    {"type":"quiz","fragor":[
      {"fraga":"En kollega skar sig lätt på en kniv vid uppackning. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":1,"forklaring":"Någon skadades, oavsett hur lindrigt. Det är en olycka."},
      {"fraga":"Du halkade men tog emot dig. Ingen skadades. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":0,"forklaring":"Det kunde ha gått illa men ingen skadades. Det är ett tillbud."},
      {"fraga":"Var ser du hur långt din rapport har kommit?","alternativ":["Under Mina rapporter, statusen på raden","I Tickets","Ingenstans, du får ett mejl när den är klar"],"ratt":0,"forklaring":"Mina rapporter visar statusen: Ny, Under utredning, Åtgärdad och Avslutad. Tryck på rapporten för att se Hanteringen."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-ticket-systemet","label":"Tickets","description":"Fråga en kollega om ett ärende."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn och Mer."}
    ],"fraga":"Din närmaste chef, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 6, now(), array['technician']
),
(
  'guide-rapportera-tillbud-kontor',
  'Rapportera ett tillbud, en avvikelse eller en olycka',
  'Rapportera från datorn, och utred och avsluta rapporter i Registret om du tar emot dem.',
  'handbok', 'sakerhet',
  $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Den gula knappen överst i sidomenyn","tar":"4 min","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck på den gula knappen överst i sidomenyn. Välj typ, beskriv, välj den det gäller under Berörda anställda och tryck [[Skicka rapport|rapport.skicka]]. Tar du emot rapporter utreder du dem under fliken Registret."},
    {"type":"callout","variant":"warning","title":"Vid akut nödläge","text":"Ring 112 först vid allvarlig skada. Rapportera i portalen när läget är under kontroll."},
    {"type":"visning","steg":[
      {"text":"Tryck på den gula knappen [[Rapportera tillbud, avvikelse eller olycka|rapport.avvikelse]] överst i sidomenyn.","ser":"Sidan Tillbud & Avvikelser öppnas på fliken Rapportera, med formuläret."},
      {"text":"Under 1 Vad hände?: tryck Hmm Avvikelse.","ser":"Rutan blir färgad. Oj! Tillbud är när det kunde ha gått illa och Aj! Olycka när någon skadades."},
      {"text":"Skriv i Vad har hänt? vad som hände, var och hur.","ser":"Under 3 När och vem är tiden satt till nu. Ändra den om det hände tidigare."},
      {"text":"Har du bilder: tryck [[Lägg till bilder|allman.foto]] under Bilder och välj dem.","ser":"Bilderna står som små rutor. Krysset på en bild tar bort den. Högst sex bilder."},
      {"text":"Under Berörda anställda: välj den det gäller i listan Välj den det gäller.","ser":"Namnet står under Berörda anställda. På kontoret är ingen förvald. Listan heter nu Lägg till fler berörda."},
      {"text":"Tryck [[Skicka rapport|rapport.skicka]].","ser":"Det står till exempel Avvikelsen är rapporterad. Rapporten får status Ny."},
      {"text":"Tar du emot rapporter: tryck på fliken Registret.","ser":"Registret visar rapporterna i grupper efter status: Nya, Under utredning, Åtgärdade, väntar på uppföljning och Avslutade."},
      {"text":"Tryck på rapporten under Nya.","ser":"Rapporten öppnas till höger med Status, Direktåtgärd, Klassificering, Orsaksanalys, Beslutad åtgärd och Uppföljning. Fyll i och tryck [[Spara|allman.bock]]."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Skicka rapport är grå","svar":"Vad har hänt? är tomt, eller ingen står under Berörda anställda. Under knappen står vad som saknas."},
      {"fraga":"Jag ser ingen flik som heter Registret","svar":"Registret finns bara för den som tar emot rapporter. Admin väljer mottagare per person under Användarkonton (Personal), Incidentmottagare."},
      {"fraga":"Det står Fyll i uppföljningen innan rapporten avslutas","svar":"Skriv i Är åtgärden genomförd och tillräcklig? innan du väljer Avslutad och trycker [[Spara och avsluta|allman.bock]]."},
      {"fraga":"Rapporten har ingen knapp Spara","svar":"Du tar inte emot den typen av rapport. Du ser rapporten och under Hanteringen hur långt den har kommit."},
      {"fraga":"Det står Kunde inte spara. Det du skrivit ligger kvar.","svar":"Inget sparades. Försök igen."}
    ]},
    {"type":"bra","items":[
      "Tar du emot rapporter får du notis och mejl när en ny kommer. Knappen Öppna och hantera i mejlet öppnar rapporten direkt. Finns nya att hantera öppnas sidan på Registret.",
      "Status går från Ny till Under utredning, Åtgärdad och Avslutad. Avslutad kräver att uppföljningen är ifylld.",
      "Vid olycka och tillbud: bedöm Ska anmälan göras till anmalarbetsskada.se? Allvarlig olycka eller allvarligt tillbud ska anmälas utan dröjsmål.",
      "Filtrera Registret på typ, status och datum. [[Exportera|rapport.hamta]] ger rapporterna som syns som en fil för Excel, till exempel inför revision.",
      "I rapporten står bilderna under texten. Tryck på en bild för att se den stor. Rapportören och mottagarna kan lägga till fler bilder. Är rapporten kopplad till ett ärende öppnar du ärendet vid Ärende.",
      "Säljaren hittar sidan också under Verktyg › Tillbud & Avvikelser i menyn. Under Mina rapporter ser du rapporter du har skickat."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården ringde och klagade på att det bokade besöket i dag aldrig blev av. Teknikern var Erik Exempel. Rapportera det och ange Erik som berörd."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden klagar på att vi missade ett bokat besök. Ingen skadades. Vilken typ är det?","alternativ":["Tillbud","Olycka","Avvikelse"],"ratt":2,"forklaring":"Kunden fick inte det vi lovat. Det är en avvikelse."},
      {"fraga":"Du ska avsluta en utredd rapport men får Fyll i uppföljningen innan rapporten avslutas. Vad gör du?","alternativ":["Väljer Åtgärdad i stället","Skriver i Är åtgärden genomförd och tillräcklig? och sparar igen","Raderar rapporten"],"ratt":1,"forklaring":"Uppföljningen visar att åtgärden fungerade. Den krävs innan rapporten avslutas."},
      {"fraga":"Du öppnar en rapport men det finns ingen knapp Spara. Varför?","alternativ":["Du tar inte emot den typen av rapport","Rapporten är raderad","Du måste uppdatera sidan"],"ratt":0,"forklaring":"Bara den som tar emot typen kan utreda. Admin väljer mottagare per person."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 15, now(), array['admin','koordinator','säljare']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
