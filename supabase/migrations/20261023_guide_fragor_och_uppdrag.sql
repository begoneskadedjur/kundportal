-- Guidemallen: sidan Tickets byggdes om 2026-10-23 (3.89.0) till Frågor och uppdrag för
-- admin, koordinator och tekniker. Guiderna skrivs om efter den nya sidan. Slugsen behålls
-- så att länkar och läsloggen fungerar:
--   guide-ticket-systemet          Fråga en kollega i Frågor och uppdrag              tekniker
--   guide-ticket-systemet-kontor   Ta hand om frågor och uppdrag till kontoret        admin, koordinator
-- Guidemoduler i src/pages/shared/intranet/guider/ med samma namn, delade delar i _fragor.tsx.
-- Texter ur InternAdministration, components/fragor/** (NyFragaDialog, TradLista, TradVy,
-- SvarsRuta, fragorLogik, filer), hooks/useTicketsBadge, technicianNavConfig,
-- coordinatorNavConfig, adminNavConfig, TechnicianMobileNav och ny/layout/SkapaArk.
-- Placering i handboken: handbokSektioner.ts, ämnet Kom igång (oförändrad).
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- ─── 1. Frågor och uppdrag, tekniker ───
(
  'guide-ticket-systemet',
  'Fråga en kollega i Frågor och uppdrag',
  'Skicka en fråga eller ett uppdrag om ett ärende till en kollega, läs svaret och markera tråden som klar.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Klockan uppe till höger, eller Menyn › Ärenden & Fält › Frågor och uppdrag","tar":"3 min","behover":"Ett ärende som frågan gäller","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på klockan uppe till höger, så öppnas Frågor och uppdrag. Tryck [[Ny fråga eller uppdrag|allman.plus]], välj kollega och ärende, skriv frågan och skicka. Svaret kommer under Väntar på dig, och när inget mer behövs trycker du [[Markera som klar|allman.bock]]."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Ny fråga eller uppdrag|allman.plus]] överst på sidan.","ser":"Rutan Ny fråga eller uppdrag öppnas nerifrån. Under 1 Till vem? är En kollega redan valt."},
      {"text":"Tryck på Anna Exempel i listan under Sök kollega.","ser":"Anna är vald. Längst ner står Anna får en notis direkt."},
      {"text":"Tryck på ärendet hos Familjen Exempel under 2 Om vilket ärende?","ser":"Förslagen är dina ärenden i dag och i morgon. Det valda ärendet står i en grön ruta med [[Byt ärende]]."},
      {"text":"Tryck i rutan Meddelande under 3 Vad gäller det? och skriv frågan.","ser":"Knappen längst ner heter Skicka till Anna och är grön."},
      {"text":"Tryck [[Skicka till Anna|rapport.skicka]].","ser":"Det står Skickat till Anna och tråden öppnas med status Väntar på Anna sedan och klockslaget. I listan ligger den under Du väntar på svar."},
      {"text":"När Anna har svarat står siffran 1 på klockan, och tråden ligger under Väntar på dig › Svar till dig. Tryck på tråden.","ser":"Tråden öppnas. Annas svar står under Nytt sedan du läste, och under din fråga står Läst av Anna."},
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
      "Siffran på klockan och i menyn är antalet trådar under Väntar på dig: Frågor till dig och Svar till dig.",
      "Har någon frågat dig ligger tråden under Frågor till dig. Öppna den, skriv i rutan Svar till och namnet, och tryck [[Skicka svar|rapport.skicka]]. Svaret hamnar i samma tråd.",
      "Du kan också fråga direkt i ärendet: tryck på pratbubblan, skriv @ och välj namnet. Det blir samma tråd, och den syns här. [[Visa i ärendets kommunikation|dok.konversation]] visar tråden i ärendet.",
      "En roll eller Alla når alla med rollen, och frågan hamnar under Omnämnd, för kännedom hos dem. Vill du ha svar från en viss person, välj personen. Gul status betyder att ingen har svarat på två dagar.",
      "I nya arbetsvyn trycker du [[Skapa]] och väljer Fråga eller uppdrag till en kollega. Frågor och uppdrag ligger där under Min dag i menyn. Kunden ser aldrig trådarna."
    ]},
    {"type":"ovning","uppdrag":"Fråga koordinatorn Anna Exempel om Familjen Exempel vill ha kvittot på mejl. När Anna har svarat: läs svaret och markera tråden som klar."},
    {"type":"quiz","fragor":[
      {"fraga":"Du vill att koordinatorn Anna svarar. Vad väljer du under Till vem?","alternativ":["En roll, Koordinator","En kollega, och sedan Anna Exempel","Alla"],"ratt":1,"forklaring":"Väljer du Anna hamnar frågan under Frågor till dig hos henne. En roll hamnar under Omnämnd, för kännedom hos alla koordinatorer."},
      {"fraga":"Anna har svarat. Var hittar du svaret?","alternativ":["Under Väntar på dig › Svar till dig","Under Du väntar på svar","Under Klara"],"ratt":0,"forklaring":"Svar på dina frågor ligger under Väntar på dig tills du markerar tråden som klar. Siffran på klockan visar att något väntar."},
      {"fraga":"Svaret räcker och inget mer behövs. Vad gör du?","alternativ":["Låter tråden ligga kvar","Trycker Markera som klar","Startar en ny fråga"],"ratt":1,"forklaring":"Markera som klar flyttar tråden till Klara för alla. Svarar någon igen öppnas den igen."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i portalen","description":"Menyn, Mitt konto och appen på hemskärmen."},
      {"slug":"guide-rapportera-tillbud","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Den gula knappen i menyn."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 10, now(), array['technician']
),

-- ─── 2. Frågor och uppdrag, kontor ───
(
  'guide-ticket-systemet-kontor',
  'Ta hand om frågor och uppdrag till kontoret',
  'Min inkorg och Alla, Jag tar den på frågor till en roll och svaret i tråden.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Menyn › Planering › Frågor och uppdrag, för admin under Organisation. Klockan uppe till höger går också dit.","tar":"4 min","behover":"Inget. Sidan visar det som väntar","enhet":"dator"},
    {"type":"kortsvar","text":"Min inkorg visar det som väntar på dig. Under Alla ser du alla trådar, och frågor till en roll eller alla som ingen har svarat på ligger överst. Tryck [[Jag tar den|allman.hand]], skriv svaret och tryck [[Skicka svar|rapport.skicka]]."},
    {"type":"visning","steg":[
      {"text":"Tryck Frågor och uppdrag i menyn. Koordinatorn har den under Planering, admin under Organisation.","ser":"Sidan öppnas på Min inkorg med det som väntar på dig överst, och den första tråden öppnas till höger. Eriks fråga till koordinatorerna ligger under Omnämnd, för kännedom."},
      {"text":"Tryck Alla ovanför sökrutan.","ser":"Filtren Till, Från, Ärendetyp, Status och Bara olästa visas. Överst ligger Till en roll eller alla, ingen har svarat. Eriks fråga öppnas till höger med status Väntat 40 minuter."},
      {"text":"Tryck [[Jag tar den|allman.hand]].","ser":"Det står Tråden väntar nu på dig. Under Vem är med står du med Tog den, och tråden flyttas till Väntar på en person. De andra ser i Alla att den väntar på dig."},
      {"text":"Tryck i rutan Svar till Erik och skriv svaret.","ser":"Svaret står i rutan. Skriv @ om du vill nämna fler kollegor."},
      {"text":"Tryck [[Skicka svar|rapport.skicka]].","ser":"Det står Svaret skickades. Tråden flyttas till Besvarade, inte klara, och Erik får svaret under Svar till dig."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Jag tar den syns inte","svar":"Den finns bara på trådar till en roll eller alla som ingen har svarat på. Den visas inte om du själv startade tråden, om frågan redan är ställd till dig eller om tråden är klar. Svara i rutan i stället."},
      {"fraga":"En tråd som var klar ligger öppen igen","svar":"Någon har svarat i den. Ett nytt svar öppnar en klar tråd igen. Tryck [[Markera som klar|allman.bock]] igen när inget mer behövs."},
      {"fraga":"Jag hittar inte en gammal tråd","svar":"Klara är hopfälld längst ner. Tryck på rubriken, och på [[Visa fler klara]] om det finns fler. I Alla kan du välja Klara eller Alla under Status. Sökrutan letar i text, kund, ärendenummer och namn, och / på tangentbordet hoppar dit."},
      {"fraga":"Det står Kunde inte hämta frågor och uppdrag","svar":"Listan kunde inte laddas. Ladda om sidan. Hjälper det inte, säg till en admin."},
      {"fraga":"En anteckning, till exempel ett fakturanummer, syns i Alla","svar":"Kommentarer utan mottagare ligger hopfällda under Anteckningar utan mottagare. De räknas inte som öppna och ingen väntar på svar."}
    ]},
    {"type":"bra","items":[
      "Min inkorg har Väntar på dig med Frågor till dig och Svar till dig, Du väntar på svar, Omnämnd, för kännedom och Klara. Siffran på klockan och i menyn är antalet under Väntar på dig.",
      "En fråga till @koordinator eller @alla ligger hos varje koordinator under Omnämnd, för kännedom. I Alla ligger den överst tills någon svarar eller tar den. Gul status betyder att ingen har svarat på två dagar.",
      "Vill du fråga någon själv: tryck [[Ny fråga eller uppdrag|allman.plus]], välj En kollega, En roll eller Alla och välj ärendet. Eller skriv @ och namnet i ärendets kommunikation. Det blir samma tråd på båda ställena.",
      "Den som frågade markerar som klar. Admin och koordinator kan markera alla trådar som klara och öppna dem igen med [[Öppna igen|allman.aterstall]].",
      "Under din egen replik står Läst av och namnet när mottagaren har läst. [[Visa i ärendets kommunikation|dok.konversation]] visar tråden markerad i ärendet. Kunden ser aldrig trådarna."
    ]},
    {"type":"ovning","uppdrag":"Teknikern Erik Exempel har frågat koordinatorerna om besöket hos Familjen Exempel kan flyttas till fredag. Hitta frågan i Alla, ta den och svara Erik."},
    {"type":"quiz","fragor":[
      {"fraga":"En tekniker skriver till @koordinator. Var ser du snabbast att ingen har svarat?","alternativ":["Min inkorg › Väntar på dig","Alla › Till en roll eller alla, ingen har svarat","Klara"],"ratt":1,"forklaring":"En fråga till en roll ligger hos dig under Omnämnd, för kännedom. I Alla ligger den överst tills någon svarar eller tar den."},
      {"fraga":"Vad händer när du trycker Jag tar den?","alternativ":["Tråden markeras som klar","Tråden väntar på dig tills du svarar, och de andra ser att du har den","Frågan skickas vidare till admin"],"ratt":1,"forklaring":"Jag tar den sparas som ett svar i tråden. Den flyttas till Väntar på en person och väntar på dig."},
      {"fraga":"Du har svarat Erik. Vem markerar tråden som klar?","alternativ":["Erik, som frågade. Kontoret kan också göra det","Bara admin","Ingen, den stängs av sig själv"],"ratt":0,"forklaring":"Den som frågade markerar som klar. Admin och koordinator kan markera alla trådar som klara."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."},
      {"slug":"guide-rapportera-tillbud-kontor","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Rapportera och utred från datorn."},
      {"slug":"guide-sokrutan-kontor","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 11, now(), array['admin','koordinator']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
