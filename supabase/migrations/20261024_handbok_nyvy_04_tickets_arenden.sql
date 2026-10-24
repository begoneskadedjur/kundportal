-- Handboken för nya arbetsvyn (2026-10-24): Tickets och ärendets verktyg, tekniker.
-- Guidemoduler i src/pages/shared/intranet/guider/ med samma namn, enheter telefon och dator,
-- delade delar i _nyvy_tickets.tsx, interaktiv del interactive/nyvy/TicketMottagare.tsx.
--   guide-ticket-systemet     Skicka en ticket till en kollega       kommunikation  10
--   guide-foljearenden        Skapa ett ärende för ett nytt skadedjur arenden        62
--   guide-avbryta-arenden     Avbryt eller ta bort ett ärende        arenden        64
--   guide-specialrapporter    Skriv en specialrapport                utrustning     52
-- Slugsen behålls så att länkar och läsloggen fungerar. guide-skapa-arenden är bara för
-- kontoret och rörs inte. Texter ur InternAdministration, components/fragor/**, SkapaArk,
-- NyTeknikerLayout, EditCaseModal (stegflödet och Ärendets verktyg), ArendeVerktygArk,
-- DeleteCaseConfirmDialog, caseDeleteService, CommunicationSlidePanel, CommentInput,
-- CaseSpecialReportsSection, NewSpecialReportModal, SpecialReportEditorPage,
-- AddSectionModal och MobileAddEventSheet. Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- ─── 1. Tickets ───
(
  'guide-ticket-systemet',
  'Skicka en ticket till en kollega',
  'Fråga en kollega, en roll eller alla om ett ärende, läs svaret och markera tråden som klar.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Klockan uppe till höger, eller Tickets under Min dag (i telefonen under Mer). Skapa › Ticket till en kollega öppnar rutan Ny ticket direkt.","tar":"4 min","behover":"Ett ärende som frågan gäller","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på klockan uppe till höger och sedan [[Ny ticket|allman.plus]]. Välj vem som ska få frågan, vilket ärende den gäller, skriv och skicka. Svaret kommer under Väntar på dig, och när inget mer behövs trycker du [[Markera som klar|allman.bock]]."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Ny ticket|allman.plus]] överst på Tickets. Du kommer till Tickets med klockan uppe till höger.","ser":"Rutan Ny ticket öppnas. I telefonen kommer den nerifrån, på datorn mitt på skärmen. Under 1 Till vem? är En kollega redan valt."},
      {"text":"Tryck på Anna Exempel i listan under Sök kollega.","ser":"Anna är vald. Längst ner står Anna får en notis direkt."},
      {"text":"Tryck på ärendet hos Familjen Exempel under 2 Om vilket ärende?","ser":"Förslagen är dina ärenden i dag och i morgon. Det valda ärendet står i en grön ruta med [[Byt ärende]]."},
      {"text":"Tryck i rutan Meddelande under 3 Vad gäller det? och skriv frågan.","ser":"Knappen längst ner heter Skicka till Anna och är grön. En bild eller en PDF lägger du till under 4 Bild eller fil."},
      {"text":"Tryck [[Skicka till Anna|rapport.skicka]].","ser":"Det står Skickat till Anna. Tråden öppnas med status Väntar på Anna sedan och klockslaget. I telefonen fyller tråden skärmen, på datorn står den till höger om listan."},
      {"text":"När Anna har svarat står siffran 1 på klockan. Tryck på tråden under Väntar på dig › Svar till dig.","ser":"Annas svar står under Nytt sedan du läste, och under din fråga står Läst av Anna. På datorn är den första tråden redan öppen när du kommer till sidan."},
      {"text":"Läs svaret. Behövs inget mer, tryck [[Markera som klar|allman.bock]].","ser":"Det står Markerad som klar. Tråden flyttas till Klara och siffran på klockan försvinner."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Skicka är grå","svar":"Du behöver välja vem som ska få frågan, välja ett ärende och skriva ett meddelande. Så länge ingen är vald står det Välj vem som ska få frågan. längst ner."},
      {"fraga":"Det står Inga ärenden hittades.","svar":"Sök på ärendenummer, kund eller adress, med minst två tecken. Sökningen visar samma ärenden som sökrutan i portalen."},
      {"fraga":"Det står Ingen kollega heter så.","svar":"Listan har bara aktiva admins, koordinatorer och tekniker. Säljare och kunder går inte att välja. Du kan söka på en del av namnet."},
      {"fraga":"Det står Kunde inte skicka. Försök igen.","svar":"Frågan skickades inte. Rutan är kvar med det du skrev. Kontrollera att du har täckning och tryck på knappen igen."},
      {"fraga":"Det står till exempel kvitto.docx: bara bilder och PDF","svar":"Du kan bifoga bilder och PDF, högst 5 MB per fil. En för stor fil ger filen är större än 5 MB och följer inte med."}
    ]},
    {"type":"bra","items":[
      "Siffran på klockan är antalet trådar under Väntar på dig: Frågor till dig och Svar till dig. Frågor till en roll eller till alla räknas inte, de ligger under Omnämnd, för kännedom.",
      "Har någon frågat dig ligger tråden under Frågor till dig. Skriv i rutan Svar till och namnet, och tryck [[Skicka svar|rapport.skicka]]. Svaret hamnar i samma tråd.",
      "Du kan också fråga i ärendet: tryck på verktygen uppe till höger, sedan Kommunikation, och skriv @ och namnet. Det blir samma tråd, och den syns i Tickets.",
      "Tryck [[Öppna ärendet|rapport.oppna]] i tråden för att läsa ärendet. Är ärendet inte ditt står det Du är inte tilldelad ärendet. Du kan läsa det och svara i kommunikationen, och någon Jag är framme finns inte.",
      "Trådarna sparas alltid i ett ärende. Kunden ser dem aldrig. Gul status betyder att ingen har svarat på två dagar."
    ]},
    {"type":"interactive","component":"nyvy/TicketMottagare"},
    {"type":"ovning","uppdrag":"Fråga koordinatorn Anna Exempel om Familjen Exempel vill ha kvittot på mejl. När Anna har svarat: läs svaret och markera tråden som klar."},
    {"type":"quiz","fragor":[
      {"fraga":"Du vill att koordinatorn Anna svarar. Vad väljer du under Till vem?","alternativ":["En roll, Koordinator","En kollega, och sedan Anna Exempel","Alla"],"ratt":1,"forklaring":"Väljer du Anna hamnar frågan under Frågor till dig hos henne och syns på hennes klocka. En roll hamnar under Omnämnd, för kännedom hos alla koordinatorer."},
      {"fraga":"Anna har svarat. Var hittar du svaret?","alternativ":["Under Väntar på dig › Svar till dig","Under Du väntar på svar","Under Klara"],"ratt":0,"forklaring":"Svar på dina frågor ligger under Väntar på dig tills du markerar tråden som klar. Siffran på klockan visar att något väntar."},
      {"fraga":"Svaret räcker och inget mer behövs. Vad gör du?","alternativ":["Låter tråden ligga kvar","Trycker Markera som klar","Skriver en ny ticket"],"ratt":1,"forklaring":"Markera som klar flyttar tråden till Klara för alla. Svarar någon igen öppnas den igen."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn, Skapa och klockan."},
      {"slug":"guide-avbryta-arenden","label":"Avbryt eller ta bort ett ärende","description":"Radera ärende och anledningen under Ärendets verktyg."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 10, now(), array['technician']
),

-- ─── 2. Nytt skadedjur hos samma kund ───
(
  'guide-foljearenden',
  'Skapa ett ärende för ett nytt skadedjur',
  'Hittar du ett nytt skadedjur hos kunden skapar du ett eget ärende för det under Ärendets verktyg.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › Ärendets verktyg uppe till höger › Återbesök och nytt ärende","tar":"2 min","behover":"Ett privat- eller företagsärende","enhet":"mobil"},
    {"type":"kortsvar","text":"Öppna ärendet, tryck på verktygen uppe till höger och välj [[Skapa nytt ärende|allman.plus]]. Välj det nya skadedjuret och tryck [[Skapa nytt ärende|allman.plus]] i rutan. Kund, adress, tid och tekniker kopieras, och det nya ärendet öppnas direkt."},
    {"type":"visning","steg":[
      {"text":"Tryck på Familjen Exempel i Mina ärenden.","ser":"Ärendet öppnas i steget Framme. I telefonen fyller det skärmen, på datorn står det mitt på sidan."},
      {"text":"Tryck på verktygen uppe till höger i ärendet, ikonen i mitten.","ser":"Ärendets verktyg öppnas. I telefonen kommer listan nerifrån, på datorn uppe till höger."},
      {"text":"Tryck [[Skapa nytt ärende|allman.plus]] under Återbesök och nytt ärende.","ser":"Rutan Skapa nytt ärende öppnas: Välj skadedjurstyp. Kundinformation, adress och schemaläggning kopieras automatiskt."},
      {"text":"Tryck på Skadedjurstyp * och välj det nya skadedjuret, här Getingar.","ser":"Getingar står i fältet. Knappen Skapa nytt ärende går att trycka på först när du har valt."},
      {"text":"Tryck [[Skapa nytt ärende|allman.plus]].","ser":"Det står Följeärende skapat för Getingar! och det nya ärendet öppnas i steget Framme, med samma ärendenummer som det första. Båda ärendena ligger i Mina ärenden."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inte Skapa nytt ärende under verktygen","svar":"Du står i ett följeärende eller i ett avtalsärende. I ett följeärende finns bara [[Boka återbesök|arende.aterbesok]]: öppna det första ärendet för att skapa ett nytt. I ett avtalsärende heter gruppen Nytt ärende från det här och valet [[Kopiera ärende|allman.plus]]."},
      {"fraga":"Knappen Skapa nytt ärende går inte att trycka på","svar":"Du har inte valt skadedjurstyp. Tryck på Skadedjurstyp * och välj."},
      {"fraga":"Det står Kunde inte skapa följeärende","svar":"Inget nytt ärende skapades. Försök igen. Går det inte, skriv en ticket till rollen Koordinator om ärendet."},
      {"fraga":"Jag hittar inte det första ärendet efteråt","svar":"Det nya ärendet öppnas i samma ruta. Stäng det med krysset uppe till höger, så ligger båda ärendena i Mina ärenden."}
    ]},
    {"type":"bra","items":[
      "Det nya ärendet får samma kund, adress, tid och tekniker som ärendet du står i, och samma ärendenummer.",
      "Det börjar med status Bokad, ingen arbetstid och inget pris. Fyll i det i stegen som vanligt.",
      "Beskrivningen blir Följeärende från ursprungsärende. Nytt skadedjursproblem: följt av skadedjuret. Skriv gärna till vad du såg.",
      "Samma skadedjur igen är ett återbesök, inte ett nytt ärende. Boka det med [[Boka återbesök|arende.aterbesok]] i samma grupp under verktygen.",
      "Duplicera ärende gör en kopia där du väljer vad som följer med. För ett nytt skadedjur använder du Skapa nytt ärende."
    ]},
    {"type":"ovning","uppdrag":"Du är hos Familjen Exempel för råttorna och ser ett getingbo under taket. Skapa ett nytt ärende för getingarna."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har råttor och du hittar silverfisk i badrummet. Vad gör du?","alternativ":["Bokar ett återbesök","Skapar ett nytt ärende under Ärendets verktyg","Skriver det i råttärendets rapport"],"ratt":1,"forklaring":"Ett nytt skadedjur får ett eget ärende med eget pris. Skapa nytt ärende kopierar kunden åt dig."},
      {"fraga":"Vad följer med till det nya ärendet?","alternativ":["Kund, adress, tid och tekniker","Pris och arbetstid","Rapporten"],"ratt":0,"forklaring":"Kunden och bokningen kopieras. Pris, arbetstid och rapport börjar om från noll."},
      {"fraga":"Var hittar du Skapa nytt ärende i nya vyn?","alternativ":["I steget Klart","Under Ärendets verktyg, Återbesök och nytt ärende","Under Skapa i bottenmenyn"],"ratt":1,"forklaring":"Skapa i bottenmenyn har inga ärenden. Det nya ärendet skapar du från ärendet du står i, under verktygen."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma problem, nästa besök i samma ärende."},
      {"slug":"guide-avbryta-arenden","label":"Avbryt eller ta bort ett ärende","description":"När kunden avbokar."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 62, now(), array['technician']
),

-- ─── 3. Avbryt eller ta bort ───
(
  'guide-avbryta-arenden',
  'Avbryt eller ta bort ett ärende',
  'Avbokar kunden tar du bort ärendet under Ärendets verktyg och väljer en anledning. Ingenting raderas på riktigt.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › Ärendets verktyg uppe till höger › Ta bort › Radera ärende","tar":"2 min","behover":"Ett ärende som inte ska göras","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på verktygen uppe till höger i ärendet och sedan [[Radera ärende|allman.radera]]. Välj en anledning, skriv en kommentar om det behövs och tryck [[Ta bort|allman.radera]]. Ärendet får status Borttaget och försvinner ur Mina ärenden, men all data finns kvar."},
    {"type":"visning","steg":[
      {"text":"I ärendet: tryck på verktygen uppe till höger, ikonen i mitten.","ser":"Ärendets verktyg öppnas. I telefonen kommer listan nerifrån, på datorn uppe till höger. Längst ner står gruppen Ta bort."},
      {"text":"Tryck [[Radera ärende|allman.radera]] under Ta bort.","ser":"Rutan Ta bort ärende öppnas: Ärendet markeras som borttaget och döljs från alla vyer. All data behålls. Knappen Ta bort är avstängd."},
      {"text":"Tryck på Anledning *, där det står Välj anledning...","ser":"Listan öppnas: Kund accepterade inte kostnadsförslaget, Kund återkopplade aldrig, Löst vid inspektion, Kund avbokade, Kund ej nåbar, Dublett och Övrigt."},
      {"text":"Tryck på den anledning som stämmer, här Kund avbokade.","ser":"Anledningen står i fältet. Under den visas Kommentar (valfritt), där du kan skriva till exempel vad kunden sa. Knappen Ta bort går nu att trycka på."},
      {"text":"Tryck [[Ta bort|allman.radera]].","ser":"Det står Ärendet har tagits bort. Ärendet stängs och är borta ur Mina ärenden."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Ta bort går inte att trycka på","svar":"Du har inte valt någon anledning. Tryck på Anledning * och välj. Har du valt Övrigt måste du också skriva i Kommentar *."},
      {"fraga":"Jag hittar inte Radera ärende","svar":"Det står längst ner under Ärendets verktyg, i gruppen Ta bort. Rulla ner i listan. I ronderingar och egenkontroller kan tekniker inte ta bort ärendet: skriv en ticket till rollen Koordinator."},
      {"fraga":"Det står Kunde inte markera ärendet som borttaget","svar":"Ingenting ändrades och ärendet ligger kvar. Försök igen. Går det inte, skriv en ticket till rollen Koordinator om ärendet."},
      {"fraga":"Jag tog bort fel ärende","svar":"Skriv till koordinatorn direkt och ange ärendenumret. Ingenting är raderat, all data finns kvar."}
    ]},
    {"type":"bra","items":[
      "Ta bort raderar inget på riktigt. Ärendet får status Borttaget och döljs. Kommentarer, bilder och historik finns kvar.",
      "Anledningen och kommentaren sparas på ärendet. Välj den anledning som stämmer, Övrigt bara när ingen annan passar. Då är kommentaren obligatorisk.",
      "Behöver fler veta, till exempel koordinatorn, kan du skriva i ärendets kommunikation: tryck på verktygen och sedan Kommunikation.",
      "Ta bara bort ärenden som inte ska göras: kunden avbokar, kunden går inte att nå eller ärendet är en dubblett.",
      "Ska besöket bara flyttas tar du inte bort något. Skriv en ticket till koordinatorn i stället, eller boka ett återbesök om ärendet ska fortsätta."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ringt och avbokat. Ta bort ärendet med rätt anledning."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden ringer och avbokar. Vilken anledning väljer du?","alternativ":["Övrigt","Kund avbokade","Kund ej nåbar"],"ratt":1,"forklaring":"Välj den anledning som stämmer. Övrigt är bara för sådant som inte står i listan, och då måste du skriva en kommentar."},
      {"fraga":"Vad händer med bilderna när du tar bort ett ärende?","alternativ":["De raderas","De finns kvar","De skickas till kunden"],"ratt":1,"forklaring":"All data behålls. Ärendet får status Borttaget och döljs."},
      {"fraga":"Kunden vill ha en annan dag. Vad gör du?","alternativ":["Tar bort ärendet och skapar ett nytt","Skriver en ticket till koordinatorn om att flytta besöket","Ingenting"],"ratt":1,"forklaring":"Ärendet ska vara kvar, bara tiden ändras."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-foljearenden","label":"Skapa ett ärende för ett nytt skadedjur","description":"Nytt skadedjur hos samma kund."},
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma problem, nästa besök."},
      {"slug":"guide-ticket-systemet","label":"Skicka en ticket till en kollega","description":"Fråga koordinatorn om ärendet."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 64, now(), array['technician']
),

-- ─── 4. Specialrapport ───
(
  'guide-specialrapporter',
  'Skriv en specialrapport',
  'Samla ett krångligt uppdrag i en rapport med delar, händelser och bilder, från steget Rapport i ärendet.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › steget Rapport › Specialrapporter. Alla rapporter: Specialrapporter under Hos kunden.","tar":"5 min","behover":"Ett ärende där du är tekniker","enhet":"mobil"},
    {"type":"kortsvar","text":"Gå till steget Rapport i ärendet och tryck på plus i rutan Specialrapporter. Tryck [[Skapa rapport]], lägg till en del med [[Lägg till del|allman.plus]] och fyll den med [[Ny händelse|allman.plus]]. Allt sparas medan du skriver."},
    {"type":"visning","steg":[
      {"text":"I ärendet: tryck på ikonen för Rapport i stegraden.","ser":"Steget Rapport visar saneringsrapporten och rutan Specialrapporter: Ingen än. En fri rapport med delar, händelser och bilder."},
      {"text":"Tryck på plus i rutan Specialrapporter.","ser":"Ny specialrapport öppnas. Ärendet är valt, titeln är ifylld och Typ av rapport är föreslagen utifrån ärendet."},
      {"text":"Låt Börja tomt vara valt och tryck [[Skapa rapport]].","ser":"Det står Rapporten är skapad. Redigeraren öppnas med Klar att skicka och Rapportens delar."},
      {"text":"Tryck [[Lägg till del|allman.plus]].","ser":"Rutan frågar Vad ska delen handla om? Du kan ändra det senare. Välj mellan Område, Besök, Underleverantör och Fritt."},
      {"text":"Tryck Besök.","ser":"Delen öppnas. I telefonen står du under fliken Redigera, på datorn står delen till höger om listan."},
      {"text":"Tryck [[Ny händelse|allman.plus]].","ser":"I telefonen öppnas rutan Ny händelse med delen förvald. På datorn läggs händelsen till direkt i delen."},
      {"text":"I telefonen: välj under Vad har du gjort? och tryck [[Spara i rapporten]]. På datorn: välj typ och skriv i händelsen.","ser":"I telefonen står det Händelsen är sparad i rapporten. Under titeln står Sparad och klockslaget."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"[[Skapa rapport]] går inte att trycka på","svar":"Ärendet eller titeln saknas. Sök fram ärendet med BE-nummer och skriv en titel. Väljer du Utgå från tidigare rapport måste du också välja rapporten."},
      {"fraga":"Det står Rapporten har inga delar än. Lägg till en del först.","svar":"En händelse måste höra till en del. Gå till Delar och tryck [[Lägg till del|allman.plus]]."},
      {"fraga":"Det står Osparade ändringar när jag öppnar en rapport","svar":"Du har ändrat något i ärendet. Tryck [[Spara och öppna]], så sparas ärendet innan rapporten öppnas."},
      {"fraga":"Det står att händelsen sparades men att foton inte kunde laddas upp","svar":"Händelsen finns kvar. Öppna delen och ladda upp fotona igen."},
      {"fraga":"Under titeln står Kunde inte spara","svar":"Den senaste ändringen kom inte fram. Kontrollera att du har täckning och skriv det senaste igen."}
    ]},
    {"type":"bra","items":[
      "Du kan också börja med Skapa › Specialrapport. Då kommer du till sidan Specialrapporter, trycker [[Ny rapport|allman.plus]] och söker fram ärendet själv.",
      "Sidan Specialrapporter ligger under Hos kunden: i telefonen under Mer, på datorn i sidomenyn. Där finns alla dina rapporter med Alla, Pågående och Skickade.",
      "Allt sparas medan du skriver. Specialrapporten kommer utöver ärendets vanliga saneringsrapport.",
      "Avvikelse är för sådant kunden behöver åtgärda, till exempel en öppen ventil. Den syns i rött i rapporten.",
      "[[Snygga till hela rapporten|rapport.snygga]] rättar stavning och skiljetecken. Inget ändras förrän du trycker Använd."
    ]},
    {"type":"p","text":"Prova Snygga till. Ett av förslagen nedan är fel."},
    {"type":"interactive","component":"specialrapport-snygga-till"},
    {"type":"ovning","uppdrag":"Skapa en specialrapport i ärendet hos Familjen Exempel. Lägg till en del för dagens besök och lägg in betningen som en händelse."},
    {"type":"quiz","fragor":[
      {"fraga":"Var börjar du en specialrapport för ärendet du står i?","alternativ":["I steget Rapport, plus i rutan Specialrapporter","I steget Klart","Under Mitt konto"],"ratt":0,"forklaring":"Från steget Rapport är ärendet redan valt. Under Ärendets verktyg leder Specialrapporter till samma steg."},
      {"fraga":"Du hittar en öppen ventil som kunden behöver täta. Vilken typ av händelse väljer du?","alternativ":["Notering","Avvikelse","Åtgärd"],"ratt":1,"forklaring":"Avvikelse är för sådant kunden behöver åtgärda. Den syns i rött i rapporten."},
      {"fraga":"Måste du trycka Spara innan du lämnar rapporten?","alternativ":["Ja, annars försvinner allt","Nej, allt sparas medan du skriver","Bara på datorn"],"ratt":1,"forklaring":"Rapporten sparas hela tiden. Under titeln ser du när den sparades senast."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-kontrollrapport","label":"Mejla kontrollrapporten till kunden","description":"Rapporten efter en stationskontroll."},
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Nästa besök i samma ärende."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 52, now(), array['technician']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
