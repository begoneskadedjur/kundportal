-- Handboken för nya arbetsvyn (2026-10-24), del 5: sälja och kontot (tekniker).
-- Guidemoduler i src/pages/shared/intranet/guider/, enheter telefon och dator:
--   guide-skapa-avtal-offert          (ny)       Skapa och skicka en offert eller ett avtal
--   guide-dokumentsignering-tekniker  (befintlig) Följ dina offerter och avtal i Dokumentsignering
--   guide-min-kundresa                (ny)       Se hur det går för dina offerter och avtal
--   guide-leads-tekniker              (befintlig) Tipsa om en ny kund
--   guide-provision                   (ny)       Förstå din provision
--   guide-mitt-konto                  (ny)       Ställ in Mitt konto och visningen
-- Interaktiva delar i src/pages/shared/intranet/interactive/nyvy/: KontrollForeUtskick,
-- KundresaPerioder, Provisionsraknare, AppenPaHemskarmen.
-- Bara tekniker. Befintliga slugs behålls så att länkar och läsloggen fungerar. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- 1. Skapa och skicka en offert eller ett avtal
(
  'guide-skapa-avtal-offert',
  'Skapa och skicka en offert eller ett avtal',
  'Skapa, Avtal eller offert, stegen, Kontroll före utskick och Oneflows PDF innan du skickar.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Skapa › Avtal eller offert. På datorn också Avtal och offerter › Skapa avtal eller offert i sidomenyn","tar":"6 min","behover":"Kundens namn, telefon och e-post, och vad jobbet kostar","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Skapa|allman.plus]] och välj Avtal eller offert. Gå igenom stegen med [[Nästa]] och granska. Tryck [[Skapa och visa Oneflows PDF]], titta på PDF:en och tryck [[Skicka offerten]] eller [[Skicka för signering]]. Kunden får dokumentet från info@begone.se."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Skapa|allman.plus]].","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck Avtal eller offert.","ser":"Skapa avtal eller offert öppnas på steget Vad ska du skapa? Avtalsförslag är förvalt."},
      {"text":"Tryck Offert. Ska kunden ha ett löpande avtal med årspremie väljer du Avtalsförslag.","ser":"Offert är vald: engångsuppdrag med fast pris som kunden godkänner i Oneflow."},
      {"text":"Gå igenom stegen med [[Nästa]]. I steget Offertinnehåll heter knappen [[Granska offerten]]. Tryck på den.","ser":"Granskningen visar offerten som kunden ser den och rutan Kontroll före utskick med röda, gula och gröna punkter."},
      {"text":"Tryck [[Skapa och visa Oneflows PDF]].","ser":"Offerten skapas som utkast i Oneflow och du ser Så här ser kunden offerten. Inget är skickat än."},
      {"text":"Tryck [[Skicka offerten]]. För ett avtal heter knappen Skicka för signering.","ser":"Det står Offerten är skickad. Kunden har fått den från info@begone.se och du skickas vidare till Dokumentsignering."}
    ]},
    {"type":"list","items":[
      "Dokument: Offert eller Avtalsförslag.",
      "Mall: mallen styr den fasta texten i Oneflow. Offerter har mallar för företag och för privatpersoner, med moms, ROT och RUT. När mallen är vald försvinner steget Avtalspart.",
      "Avtalspart: Företag eller Privatperson. Visas för avtal och för offerter utan mall.",
      "Kundgrupp: bara för avtal. Styr prislista och uppföljning.",
      "BeGone: du står som ansvarig. För avtal fyller du också i Avtalslängd och Startdatum.",
      "Motpart: kundens namn, telefon, e-post och e-post för faktura. Företag behöver också organisationsnummer.",
      "Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Priset står bredvid.",
      "Offertinnehåll eller Avtalsobjekt: texten kunden läser. Tryck Skriv förslag från tjänsterna för en färdig text och skriv till med kundens egna ord."
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag kan inte trycka Nästa","svar":"Bottenlisten säger vad som saknas, till exempel Fyll i e-postadress, Fyll i organisationsnummer eller Lägg till minst en tjänst. Fyll i det, så går det vidare."},
      {"fraga":"Det står Rätta de röda punkterna först","svar":"En röd punkt i Kontroll före utskick stoppar knappen Skapa och visa Oneflows PDF. Tryck Rätta under och den del som står, rätta, och tryck [[Tillbaka till granskningen]]."},
      {"fraga":"Ett fält är tomt i PDF:en fast jag fyllde i det","svar":"Då ligger felet i Oneflow-mallen. Tryck [[Tillbaka och ändra]] och byt mall, eller säg till en admin."},
      {"fraga":"Jag vill skicka senare","svar":"Tryck [[Spara som utkast]]. Utkastet ligger kvar i Dokumentsignering under Utkast att skicka, och där skickar du det med Granska och skicka."}
    ]},
    {"type":"bra","items":[
      "Kunden får offerten eller avtalet från info@begone.se, aldrig från din egen e-post.",
      "Röd punkt stoppar. Gul punkt är en varning: E-post för faktura kan till exempel kunden fylla i vid signeringen.",
      "Tillbaka och ändra tar bort utkastet i Oneflow. Ett nytt skapas när du granskar igen.",
      "Från ett ärende: tryck [[Ärendets verktyg|falt.verktyg]] och Skapa offert. Då är ärendets tjänster och artiklar redan ifyllda.",
      "Skickade offerter och avtal följer du i Dokumentsignering. Kontoret bokar in när kunden har signerat."
    ]},
    {"type":"interactive","component":"nyvy/KontrollForeUtskick"},
    {"type":"ovning","uppdrag":"Familjen Exempel vill ha pris på att ta bort ett getingbo, 2 750 kr. Skapa offerten med mallen för privatpersoner inklusive moms och skicka den."},
    {"type":"quiz","fragor":[
      {"fraga":"Kontroll före utskick visar en gul punkt: Personnummer saknas. Vad händer om du trycker Skapa och visa Oneflows PDF?","alternativ":["Det går inte, alla punkter måste vara gröna","Utkastet skapas, gul punkt stoppar inte","Offerten skickas direkt till kunden"],"ratt":1,"forklaring":"Bara röda punkter stoppar. Inget skickas förrän du har sett PDF:en och tryckt Skicka offerten."},
      {"fraga":"Från vilken adress får kunden offerten?","alternativ":["Din egen e-post","info@begone.se","Kontorets e-post för fakturor"],"ratt":1,"forklaring":"Det står under knappen: Skickas från info@begone.se till kundens e-post."},
      {"fraga":"Kunden ska ha löpande kontroller med årspremie. Vad väljer du i första steget?","alternativ":["Offert","Avtalsförslag","Det spelar ingen roll"],"ratt":1,"forklaring":"Avtalsförslag är ett löpande avtal med årspremie. Offert är ett engångsuppdrag med fast pris."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-dokumentsignering-tekniker","label":"Följ dina offerter och avtal i Dokumentsignering","description":"Vad som väntar på dig och på kunden."},
      {"slug":"guide-min-kundresa","label":"Se hur det går för dina offerter och avtal","description":"Min kundresa, bara jämfört med dig själv."},
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Tjänster, ROT och provision."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 30, now(), array['technician']
),

-- 2. Följ dina offerter och avtal i Dokumentsignering
(
  'guide-dokumentsignering-tekniker',
  'Följ dina offerter och avtal i Dokumentsignering',
  'Arbetskö och Statistik, Att göra först, väntar på kunden, signerade, ring och logga samtal, öppna i Oneflow och skicka utkast.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mer › Dokumentsignering under Sälja. På datorn Dokumentsignering i sidomenyn","tar":"5 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Dokumentsignering visar dina egna offerter och avtal, ordnade efter vem som gör nästa steg. Börja med Att göra överst. Tryck på ett dokument, så står det i rutan överst vad du ska göra och knappen för det."},
    {"type":"visning","steg":[
      {"text":"Öppna Dokumentsignering. I telefonen: tryck [[Mer|allman.meny]] och sedan Dokumentsignering under Sälja. På datorn: tryck Dokumentsignering i sidomenyn.","ser":"Arbetskö visar grupperna Att göra, Väntar på kunden och Signerade. Under rubriken står hur många som finns i varje grupp."},
      {"text":"Tryck på Exempel AB under Att göra, Väntar länge på svar.","ser":"Dokumentet öppnas. Rutan överst säger Inte öppnad, skickad för 5 dagar sedan, och Nästa steg: ring Exempel AB och hör om offerten kom fram."},
      {"text":"Tryck [[Ring|kontakt.telefon]] med kundens namn.","ser":"Telefonen ringer upp kunden och rutan Logga samtal med Exempel AB öppnas."},
      {"text":"Tryck Nådde kunden under Hur gick det.","ser":"Nådde kunden är markerat. Skriv gärna en rad under Anteckning, valfri."},
      {"text":"Tryck [[Spara samtalet|allman.bock]].","ser":"Det står Samtalet är loggat. Samtalet syns under fliken Aktivitet och i rutan."},
      {"text":"Tryck [[Öppna i Oneflow|rapport.oppna]]. I telefonen är det ikonen uppe till höger.","ser":"Oneflow öppnas i en ny flik med dokumentet och PDF:en, så som kunden ser den."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Kunden har skrivit en fråga i Oneflow","svar":"Den ligger under Att göra, Kunden har skrivit. Ring kunden, eller skriv en intern anteckning i fliken Konversation så svarar kontoret kunden i Oneflow."},
      {"fraga":"Offerten har förfallit och kunden vill ha mer tid","svar":"Ring kunden och be kontoret förlänga fristen. Förläng och påminn finns bara för kontoret och säljarna."},
      {"fraga":"Det står Mejlet kom inte fram","svar":"Ring kunden och kontrollera e-postadressen. Säg till kontoret om adressen ska ändras."},
      {"fraga":"Dokumentet finns inte i listan","svar":"Listan visar dokument där du är avsändare eller som du har skapat. Bokade, avböjda och avskrivna ligger under Klara längst ner. Tryck Klara för att se dem."}
    ]},
    {"type":"bra","items":[
      "Att göra: kunden har skrivit, förfallna, väntar länge på svar, samtal du planerat idag och utkast att skicka. Det är det enda du behöver gå igenom.",
      "Väntar på kunden: skickat och inom fristen. Inget att göra än.",
      "Signerade: kontoret registrerar kunden och bokar in. Du behöver inte göra något, men här ser du när det är bokat.",
      "Utkast skickar du med [[Granska och skicka]]. Portalen frågar en gång till innan offerten går från info@begone.se.",
      "Statistik och raden Senaste 90 dagarna visar bara dina egna dokument."
    ]},
    {"type":"ovning","uppdrag":"Offerten till Familjen Exempel ligger som utkast. Öppna Dokumentsignering, granska PDF:en och skicka offerten."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett avtal ligger under Signerade. Vad gör du?","alternativ":["Bokar besöket själv","Ingenting, kontoret registrerar kunden och bokar in","Skickar avtalet en gång till"],"ratt":1,"forklaring":"Signerade dokument bokar kontoret in. Du ser i listan när det är bokat."},
      {"fraga":"Kunden har inte öppnat offerten på fem dagar. Vad föreslår rutan Nästa steg?","alternativ":["Ring kunden och hör om offerten kom fram","Radera offerten","Vänta tills fristen gått ut"],"ratt":0,"forklaring":"Ring och logga samtalet. Då ser både du och kontoret vad som hänt."},
      {"fraga":"Var hamnar en offert du sparade som utkast i Skapa avtal eller offert?","alternativ":["Under Klara","Under Att göra, Utkast att skicka","Den syns inte i portalen"],"ratt":1,"forklaring":"Utkasten ligger under Att göra tills du skickar dem med Granska och skicka."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-avtal-offert","label":"Skapa och skicka en offert eller ett avtal","description":"Från Skapa till Skicka."},
      {"slug":"guide-min-kundresa","label":"Se hur det går för dina offerter och avtal","description":"Signerade, förfallna och tiden till signering."},
      {"slug":"guide-ticket-systemet","label":"Tickets","description":"Fråga kontoret om ett dokument."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 31, now(), array['technician']
),

-- 3. Se hur det går för dina offerter och avtal (Min kundresa)
(
  'guide-min-kundresa',
  'Se hur det går för dina offerter och avtal',
  'Min kundresa: vad som mäts, perioderna 30, 90 och 365 dagar och jämförelsen bara mot dig själv.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mer › Min kundresa under Sälja. På datorn Min kundresa i sidomenyn","tar":"4 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Min kundresa visar vad som hände med offerterna och avtalen du skickade: hur många som signerades, väntar på svar eller föll bort, och hur lång tid det tog. Sidan är din. Jämförelsen görs bara mot din egen period före, aldrig mot kollegor."},
    {"type":"visning","steg":[
      {"text":"Öppna Min kundresa. I telefonen: tryck [[Mer|allman.meny]] och sedan Min kundresa under Sälja. På datorn: tryck Min kundresa i sidomenyn.","ser":"Överst står Sidan är din. Under det väljer du Offerter eller Avtal och perioden."},
      {"text":"Tryck Vem ser vad.","ser":"Listan visar att du ser allt på sidan, att kontoret ser dina dokument på sina egna sidor och att texterna inte sparas."},
      {"text":"Tryck 30 dagar.","ser":"Perioden blir 2026-09-27 till 2026-10-26 och jämförs med 2026-08-28 till 2026-09-26."},
      {"text":"Tryck på den gröna delen av flödet.","ser":"Rutan Signerade visar hur många av de skickade som signerades och hur stor andel det är."},
      {"text":"Tryck Visa flödet som tabell.","ser":"Tabellen visar Steg, Antal och Andel och tid för skickade, signerade, väntar på svar och förföll."},
      {"text":"Tryck Så räknas siffrorna.","ser":"Förklaringen visar vilka dokument som räknas, hur jämförelsen görs och att inget före 2026-05-01 räknas."},
      {"text":"Tryck på en rad under Just nu i din resa.","ser":"Dokumentet öppnas i Dokumentsignering, där du ringer eller loggar samtalet."}
    ]},
    {"type":"interactive","component":"nyvy/KundresaPerioder"},
    {"type":"felsok","items":[
      {"fraga":"Det står Ingen jämförelse än","svar":"Jämförelsen skrivs när båda perioderna har minst 5 dokument. För 365 dagar ligger perioden före 2026-05-01, då portalen tog över, och de dokumenten räknas inte."},
      {"fraga":"En offert jag skickade syns inte","svar":"Bara dokument där du står som avsändare i Oneflow räknas, och de hör till perioden då de skickades. Utkast räknas inte. Prova en längre period."},
      {"fraga":"Det står Siffrorna kunde inte hämtas","svar":"Tryck [[Försök igen]]. Händer det igen, skriv en ticket till rollen Koordinator."}
    ]},
    {"type":"bra","items":[
      "Perioderna är rullande: 30 dagar betyder de senaste 30 dagarna fram till idag.",
      "Väntar på svar räknas inte som förlorat. Kunden kan fortfarande signera.",
      "Tiden är median: hälften av dokumenten var klara inom den tiden. Ett enstaka dokument som drar ut påverkar inte siffran.",
      "Öppnad syns inte än. Oneflow skickar inte den uppgiften till portalen.",
      "Efter signeringen visas Bokad för offerter som kontoret bokat in med Boka in från 2026-10-23. Utförd, fakturerad och betald mäts inte än."
    ]},
    {"type":"ovning","uppdrag":"Ta reda på hur det har gått för dina avtal det senaste året."},
    {"type":"quiz","fragor":[
      {"fraga":"Vem jämförs dina siffror med?","alternativ":["Kollegorna i din region","Din egen period före, lika lång","Alla tekniker i företaget"],"ratt":1,"forklaring":"Sidan är din. Jämförelsen görs bara mot din egen tidigare period, aldrig mot kollegor."},
      {"fraga":"Tre offerter väntar på svar. Räknas de som förlorade?","alternativ":["Ja","Nej, kunden kan fortfarande signera","Bara om kunden har öppnat dem"],"ratt":1,"forklaring":"Väntar på svar är skickat, inte signerat och fristen är inte ute."},
      {"fraga":"Du väljer 365 dagar och det står Ingen jämförelse än. Varför?","alternativ":["Perioden före ligger före 2026-05-01 och räknas inte","Du har för många dokument","Kontoret har stängt av jämförelsen"],"ratt":0,"forklaring":"Dokument från före 2026-05-01, då portalen tog över, räknas inte."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-dokumentsignering-tekniker","label":"Följ dina offerter och avtal i Dokumentsignering","description":"Där du ringer och skickar."},
      {"slug":"guide-skapa-avtal-offert","label":"Skapa och skicka en offert eller ett avtal","description":"Från Skapa till Skicka."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 32, now(), array['technician']
),

-- 4. Tipsa om en ny kund
(
  'guide-leads-tekniker',
  'Tipsa om en ny kund',
  'Skapa › Tips om ny kund, rutan Nytt tips eller lead, ägare eller inte, och sidan Leads och tips.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Skapa › Tips om ny kund. Dina tips ligger under Mer › Leads och tips, på datorn i sidomenyn","tar":"3 min","behover":"Namnet och ett telefonnummer eller en e-post","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Skapa|allman.plus]] och Tips om ny kund. Skriv namnet och telefon eller e-post. Välj Ingen ägare än om koordinatorn ska fördela tipset och tryck [[Skicka tips]]. Ska du själv ringa behåller du Jag som ägare och fyller i Nästa steg och Datum och tid."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Skapa|allman.plus]].","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck Tips om ny kund.","ser":"Leads och tips öppnas med rutan Nytt tips eller lead. Källa är redan Teknikertips."},
      {"text":"Tryck Företag eller namn * och skriv namnet, till exempel Brf Exempelgården.","ser":"Namnet står i fältet."},
      {"text":"Tryck Telefon och skriv numret.","ser":"Telefon eller e-post räcker. Utan båda står det Fyll i telefon eller e-post."},
      {"text":"Tryck Ägare.","ser":"Listan visar Jag, Ingen ägare än (koordinatorn fördelar) och kollegorna."},
      {"text":"Tryck Ingen ägare än (koordinatorn fördelar).","ser":"Knappen byter namn till Skicka tips och det står Utan ägare hamnar leaden under Nya tips där koordinatorn fördelar den."},
      {"text":"Tryck [[Skicka tips]].","ser":"Det står Tipset är skickat och leaden öppnas. Du står som tipsare."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Fälten Nästa steg och Datum och tid blev röda","svar":"Med dig som ägare måste leaden ha ett nästa steg. Fyll i båda, eller välj Ingen ägare än (koordinatorn fördelar)."},
      {"fraga":"Det står Det finns redan en lead med samma uppgifter","svar":"Någon har redan lagt upp kunden. Tryck [[Öppna den]] om du får se den, annars står det Be ägaren dela den med dig. Är det ändå en ny kund trycker du [[Skapa ändå]]."},
      {"fraga":"Jag hittar inte knappen på sidan Leads och tips i telefonen","svar":"Använd [[Skapa|allman.plus]] i bottenmenyn och Tips om ny kund. Den öppnar samma ruta."}
    ]},
    {"type":"bra","items":[
      "Du kan också tipsa från ett privat- eller företagsärende: i steget Klart finns knappen Skapa lead. Kunden och ärendet följer då med.",
      "Sidan heter Mina leads och tips och visar det du har tipsat om, äger eller fått delat med dig. Flikarna är Att göra, Pågående, Nya tips och Alla.",
      "Resten fyller du i på leaden efteråt, till exempel kontaktperson och årspremie.",
      "Med dig som ägare hamnar leaden under Att göra när nästa steg är idag eller har passerat."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB vill ha hjälp med råttor. Du ringer dem själv i morgon klockan 08:00. Lägg upp leaden med dig som ägare."},
    {"type":"quiz","fragor":[
      {"fraga":"Du vill att koordinatorn tar hand om tipset. Vad väljer du under Ägare?","alternativ":["Jag","Ingen ägare än (koordinatorn fördelar)","En säljare du känner"],"ratt":1,"forklaring":"Utan ägare hamnar leaden under Nya tips där koordinatorn fördelar den."},
      {"fraga":"Vad måste alltid fyllas i?","alternativ":["Org.nr","Företag eller namn och telefon eller e-post","Årspremie"],"ratt":1,"forklaring":"Namnet och en kontaktväg krävs. Org.nr och årspremie är valfria."},
      {"fraga":"Du har Jag som ägare och trycker Skapa lead utan nästa steg. Vad händer?","alternativ":["Leaden skapas ändå","Nästa steg och Datum och tid blir röda","Leaden går till koordinatorn"],"ratt":1,"forklaring":"En lead med ägare ska ha ett nästa steg. Ett tips utan ägare får sakna det."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-avtal-offert","label":"Skapa och skicka en offert eller ett avtal","description":"När kunden vill ha pris direkt."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Skapa, Mer och sidomenyn."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 33, now(), array['technician']
),

-- 5. Förstå din provision
(
  'guide-provision',
  'Förstå din provision',
  'Sidan Provision: månad, Intjänat och Lönen, posterna och Så räknas den, och provisionen i steget Pris och fakturering.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mer › Provision under Sälja. På datorn Provision i sidomenyn. I ärendet steget Pris och fakturering","tar":"5 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Provisionen sätts i ärendets steg Pris och fakturering med Ja, provisionsgrundande. Den registreras när ärendet avslutas och betalas ut med lönen när kunden har betalat. I dag är den 6 % av priset exklusive moms, och ärendet måste vara värt minst 4 000 kr exklusive moms."},
    {"type":"visning","steg":[
      {"text":"Öppna Provision. I telefonen: tryck [[Mer|allman.meny]] och sedan Provision under Sälja. På datorn: tryck Provision i sidomenyn.","ser":"Överst står vad du har tjänat den här månaden, vad som är klart för utbetalning och med vilken lön det kommer."},
      {"text":"Tryck pilen till vänster om månaden, Förra månaden.","ser":"Sidan visar september 2026: vad du tjänade då och posterna för de ärendena."},
      {"text":"Tryck [[Lönen|provision.lon]].","ser":"Sidan visar Novemberlönen 2026: provisionen som betalas ut med den lönen och om den är godkänd."},
      {"text":"Tryck Så räknas och betalas provisionen.","ser":"Förklaringen visar Så räknas den, När den betalas ut och Vad statusarna betyder."},
      {"text":"I ärendet: tryck på ikonen för Pris och fakturering i stegraden.","ser":"Steget visar tjänsterna och längre ner rutan Provision med Ja, provisionsgrundande och Nej."},
      {"text":"Tryck Ja, provisionsgrundande.","ser":"Rutan visar Provisionsprocent och Grundbelopp, Fördelning mellan tekniker och Total provision."},
      {"text":"Ändra din andel under Fördelning mellan tekniker.","ser":"Kollegans andel ändras så att det blir 100 % tillsammans, och beloppen räknas om."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Beloppet understiger minsta provisionsgrundande belopp","svar":"Ärendet är värt mindre än 4 000 kr exklusive moms. Provision skapas inte. Vid ROT eller RUT gäller priset före avdraget."},
      {"fraga":"Det står att andelarna måste vara 100 %","svar":"Andelarna under Fördelning mellan tekniker ska bli 100 % tillsammans. Ändra en av dem."},
      {"fraga":"Posten står kvar på Väntar på kundens betalning","svar":"Kunden har inte betalat fakturan än. Posten blir klar för utbetalning av sig själv när kunden betalar."},
      {"fraga":"Provisionen kom inte med lönen jag trodde","svar":"Betalar kunden senast den 6 i månaden kommer provisionen med nästa månads lön, annars med lönen månaden efter. Tryck Lönen för att se vilken lön varje post hör till."}
    ]},
    {"type":"bra","items":[
      "Vid ROT eller RUT räknas provisionen på priset före avdraget.",
      "Kostnader för underentreprenörer dras av innan procenten räknas. Skriv dem under Avdrag (underentreprenörskostnader).",
      "Är ni flera på ärendet delas provisionen efter era andelar. Andelarna fördelas lika från början.",
      "När posten är på väg till utbetalning kan den inte ändras. Innan dess räknas den om när ärendet sparas.",
      "Statusarna: Väntar på kundens betalning, Klar för utbetalning, Godkänd för lön och Utbetald."
    ]},
    {"type":"interactive","component":"nyvy/Provisionsraknare"},
    {"type":"ovning","uppdrag":"Ta reda på hur mycket provision du får med novemberlönen."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett ärende kostar 3 500 kr exklusive moms. Hur mycket provision blir det?","alternativ":["210 kr","Ingen, det är under 4 000 kr","350 kr"],"ratt":1,"forklaring":"Ärendet måste vara värt minst 4 000 kr exklusive moms, annars blir det ingen provision."},
      {"fraga":"Ett ärende kostar 10 000 kr exklusive moms och ni är två med hälften var. Vad får du?","alternativ":["300 kr","600 kr","1 000 kr"],"ratt":0,"forklaring":"6 % av 10 000 kr är 600 kr, och hälften av det är 300 kr."},
      {"fraga":"När betalas provisionen ut?","alternativ":["När ärendet avslutas","Med lönen när kunden har betalat fakturan","En gång om året"],"ratt":1,"forklaring":"Den registreras när ärendet avslutas, men betalas ut med lönen först när kunden har betalat."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Tjänster, ROT och rabatter."},
      {"slug":"guide-utfora-arende","label":"Utför ett besök i ärendet","description":"Stegen från Framme till Klart."}
    ],"fraga":"Koordinatorn eller löneadministratören, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 34, now(), array['technician']
),

-- 6. Ställ in Mitt konto och visningen
(
  'guide-mitt-konto',
  'Ställ in Mitt konto och visningen',
  'Visa hjälptexter, genomgångarna, tema, portalen som app på hemskärmen och byt lösenord.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mer › Mitt konto och visning. På datorn Mitt konto under Hjälp i sidomenyn","tar":"4 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Under Mitt konto stänger du av hjälptexterna och genomgångarna när du kan sidorna, och byter lösenord. Temat byter du på Mer i telefonen och med knappen uppe till höger på datorn. Valen sparas på ditt konto, inte bara i telefonen."},
    {"type":"visning","steg":[
      {"text":"Byt tema. I telefonen: tryck [[Mer|allman.meny]] och sedan raden Mörkt tema under Konto. På datorn: tryck på temaknappen uppe till höger.","ser":"Temat byts direkt. Varje tryck byter i ordningen mörkt, ljust, följer systemet. Raden visar vad nästa tryck byter till."},
      {"text":"Öppna Mitt konto. I telefonen: tryck Mitt konto och visning under Konto. På datorn: tryck Mitt konto under Hjälp i sidomenyn.","ser":"Överst står Visning med två reglage. Under det Min profil."},
      {"text":"Tryck reglaget Visa hjälptexter.","ser":"Reglaget blir grått. Förklaringarna under rubrikerna försvinner och en (i)-knapp visar dem när du behöver."},
      {"text":"Tryck [[Visa genomgångarna igen|allman.aterstall]].","ser":"Det står Genomgångarna visas igen. Alla genomgångar visas på nytt nästa gång du öppnar sidorna."},
      {"text":"Tryck Nuvarande lösenord och skriv ditt lösenord.","ser":"Lösenordet står som punkter."},
      {"text":"Skriv det nya lösenordet i Nytt lösenord och en gång till i Bekräfta nytt lösenord.","ser":"Lösenordskraven blir gröna: minst 8 tecken, en stor bokstav, en liten bokstav och en siffra."},
      {"text":"Tryck [[Byt lösenord|allman.las]].","ser":"Det står Lösenord uppdaterat! Nästa gång loggar du in med det nya."}
    ]},
    {"type":"interactive","component":"nyvy/AppenPaHemskarmen"},
    {"type":"felsok","items":[
      {"fraga":"Det står Felaktigt nuvarande lösenord","svar":"Lösenordet du skrev under Nuvarande lösenord stämmer inte. Skriv det igen. Tryck på ögat för att se vad du skriver."},
      {"fraga":"Det står Lösenorden matchar inte","svar":"Nytt lösenord och Bekräfta nytt lösenord är olika. Skriv samma lösenord i båda."},
      {"fraga":"Jag ser inte rutan Använd som app","svar":"Den visas bara i telefonen. Ligger portalen redan på hemskärmen står det Installerad. Portalen körs som app på den här enheten."},
      {"fraga":"Jag vill tillbaka till den gamla vyn","svar":"Reglaget Ny arbetsvy visas under Visning bara om du har fått rätt att byta själv. Fråga koordinatorn."}
    ]},
    {"type":"bra","items":[
      "Valen under Visning sparas på ditt konto. De gäller i telefonen och på datorn.",
      "Genomgången visas en gång per sida. Frågetecknet uppe till höger, Visa mig hur, visar den igen när du vill.",
      "Appen på hemskärmen har egen inloggning, så du loggar in en gång till första gången du öppnar den.",
      "På datorn ligger Rapportera bugg och Logga ut längst ner i sidomenyn, i telefonen under Mer."
    ]},
    {"type":"ovning","uppdrag":"Byt till ljust tema och stäng av genomgångarna som visas första gången du öppnar en sida."},
    {"type":"quiz","fragor":[
      {"fraga":"Du stänger av Visa hjälptexter i telefonen. Vad händer på datorn?","alternativ":["Hjälptexterna syns fortfarande på datorn","Hjälptexterna är avstängda där också","Du måste stänga av dem på datorn också"],"ratt":1,"forklaring":"Valen sparas på ditt konto, inte bara i telefonen."},
      {"fraga":"Var byter du tema i telefonen?","alternativ":["Mer, raden under Konto","Mitt konto, under Visning","Det går bara på datorn"],"ratt":0,"forklaring":"Temaraden ligger under Konto på Mer. På datorn är det knappen uppe till höger."},
      {"fraga":"Vilket nytt lösenord godkänns?","alternativ":["exempel26","EXEMPEL2026","Exempel2026"],"ratt":2,"forklaring":"Lösenordet måste ha minst 8 tecken, en stor bokstav, en liten bokstav och en siffra."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn och Mer."},
      {"slug":"guide-ticket-systemet","label":"Tickets","description":"Fråga en kollega."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 5, now(), array['technician']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
