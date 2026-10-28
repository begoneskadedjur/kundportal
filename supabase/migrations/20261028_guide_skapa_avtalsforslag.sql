-- Handboken 2026-10-28: guider för att skapa och skicka ett avtalsförslag, och offertguiden
-- som ren offertguide.
-- Guidemoduler i src/pages/shared/intranet/guider/:
--   guide-skapa-avtalsforslag          (ny)  Skapa och skicka ett avtalsförslag, tekniker, telefon och dator
--   guide-skapa-avtalsforslag-kontor   (ny)  Skapa och skicka ett avtalsförslag, admin, koordinator och säljare, dator
--   guide-skapa-avtal-offert           (ändrad) Skapa och skicka en offert, tekniker. Avtalsinnehållet flyttat
--                                       till den nya guiden, Befintlig kund i Motpart, ROT och RUT. Slug behålls
--                                       så att länkar och läsloggen fungerar. Version 2 eftersom innehållet är nytt.
-- Länktexterna till offertguiden i andra teknikerguider får den nya titeln.
-- Inga DELETE eller DROP. Går att köra flera gånger.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- 1. Teknikern: Skapa och skicka ett avtalsförslag
(
  'guide-skapa-avtalsforslag',
  'Skapa och skicka ett avtalsförslag',
  'Skapa, Avtal eller offert, befintlig eller ny kund, enheter, kundgrupp, Kontroll före utskick och Oneflows PDF innan du skickar.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Skapa › Avtal eller offert. På datorn också Avtal och offerter › Skapa avtal eller offert i sidomenyn","tar":"8 min","behover":"Kundens namn eller org.nr, en kontaktperson med telefon och e-post, och vad avtalet ska kosta per år","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Skapa|allman.plus]], välj Avtal eller offert och behåll Avtalsförslag. Sök fram kunden under Befintlig kund eller fyll i en ny, och gå igenom stegen med [[Nästa]]. Inget skickas förrän du har sett Oneflows PDF och tryckt [[Skicka för signering]]."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Skapa|allman.plus]].","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck Avtal eller offert.","ser":"Skapa avtal eller offert öppnas på steget Vad ska du skapa? Avtalsförslag är förvalt. Gå vidare med Nästa genom Mall och Avtalspart till Motpart."},
      {"text":"I Motpart: skriv kundens namn, org.nr eller kundnummer i Sök kund under Befintlig kund. Tryck [[Koppla|allman.plus]] på rätt kund.","ser":"Det står Kopplad till Exempel AB, kundnr 3512. Fälten nedan är ifyllda från kundkortet."},
      {"text":"Exempel AB har enheter. Tryck Hela verksamheten.","ser":"Det står Avtalet omfattar alla nuvarande och framtida enheter. När du trycker Nästa hoppas Kundgrupp över, eftersom kunden redan har en kundgrupp på kundkortet."},
      {"text":"Gå igenom BeGone, Tjänster och Avtalsobjekt med [[Nästa]]. I Avtalsobjekt heter knappen [[Granska avtalet]]. Tryck på den.","ser":"Granskningen visar avtalet som kunden ser det och rutan Kontroll före utskick med röda, gula och gröna punkter."},
      {"text":"Tryck [[Skapa och visa Oneflows PDF]].","ser":"Avtalet skapas som utkast i Oneflow och du ser Så här ser kunden avtalet. Inget är skickat än."},
      {"text":"Läs igenom PDF:en. Stämmer allt trycker du [[Skicka för signering]].","ser":"Det står Avtalet är skickat. Kunden har fått avtalet för signering från info@begone.se och du skickas vidare till Dokumentsignering."}
    ]},
    {"type":"list","items":[
      "Dokument: Avtalsförslag är förvalt. Offert är för engångsjobb och har en egen guide.",
      "Mall: mallen styr avtalets fasta text i Oneflow. Skadedjursavtal är den mest använda.",
      "Avtalspart: Företag eller Privatperson. Kopplar du en befintlig kund i nästa steg ställs det in efter kundkortet.",
      "Motpart, befintlig kund: sök på namn, org.nr eller kundnummer under Befintlig kund och tryck Koppla. Fälten fylls i från kundkortet. Du kan ändra dem, men ändringen gäller bara avtalet. Kundkortet ändras inte.",
      "Motpart, kund med enheter: under Avtalet läggs på väljer du huvudkontoret eller en enhet. På huvudkontoret väljer du Hela verksamheten eller Bara huvudkontoret, eller kryssar i enheterna.",
      "Motpart, ny kund: står det Ingen kund hittades fyller du i Företagsnamn, Org.nr och kontaktpersonens namn, telefon och e-post. Kunden läggs upp när avtalet signeras.",
      "Kundgrupp: styr prislista och hur kunden följs upp. Har den kopplade kunden en kundgrupp på kundkortet hoppas steget över, och i stegraden står det Från kundkortet. Är du osäker på vilken kundgrupp du ska välja, fråga Peter Bergqvist, peter.bergqvist@begone.se.",
      "BeGone: du står som ansvarig. Fyll i Avtalslängd och Startdatum.",
      "Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Summan står som Årspremie exkl. moms i granskningen.",
      "Avtalsobjekt: texten under § 2 i avtalet. Standardtexten står från början. Tryck Skriv förslag från tjänsterna eller skriv vad som ingår med kundens egna ord. Villkor i portalen under texten ser kunden inte."
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Välj vilka enheter avtalet omfattar","svar":"Kunden är ett huvudkontor med enheter. Välj Hela verksamheten eller Bara huvudkontoret, eller kryssa i enheterna under Vilka enheter omfattar avtalet?"},
      {"fraga":"Det står Kunden har redan ett levande avtal","svar":"Kontrollera att det är rätt kund och att det inte egentligen är ett tillägg eller en förnyelse. Är du osäker, fråga koordinatorn innan du skickar."},
      {"fraga":"Jag vet inte vilken kundgrupp jag ska välja","svar":"Fråga Peter Bergqvist, peter.bergqvist@begone.se. Nästa går inte att trycka förrän en kundgrupp är vald, då står det Välj en kundgrupp i bottenlisten."},
      {"fraga":"Det står Rätta de röda punkterna först","svar":"En röd punkt i Kontroll före utskick stoppar knappen Skapa och visa Oneflows PDF. Tryck Rätta under och den del som står, rätta, och tryck [[Tillbaka till granskningen]]."},
      {"fraga":"Ett fält är tomt i PDF:en fast jag fyllde i det","svar":"Då ligger felet i Oneflow-mallen. Tryck [[Tillbaka och ändra]] och byt mall, eller säg till en admin."}
    ]},
    {"type":"bra","items":[
      "Inget skickas till kunden förrän du har sett Oneflows PDF och tryckt [[Skicka för signering]]. Kunden får avtalet från info@begone.se, aldrig från din egen e-post.",
      "Ändrar du org.nr så att det inte stämmer med kundkortet kopplas kunden bort, och det står varför. Avtalet gäller då en ny kund. Sök fram rätt kund eller rätta numret.",
      "Röd punkt stoppar. Gul punkt är en varning: E-post för faktura kan kunden fylla i vid signeringen.",
      "[[Tillbaka och ändra]] tar bort utkastet i Oneflow. [[Spara som utkast]] lägger det i Dokumentsignering, där du skickar det senare.",
      "Skickade avtal följer du i Dokumentsignering. Kontoret bokar in när kunden har signerat."
    ]},
    {"type":"interactive","component":"nyvy/KontrollForeUtskick"},
    {"type":"ovning","uppdrag":"Brf Exempelgården vill ha löpande kontroll mot gnagare för 8 400 kr per år. Föreningen är inte kund än. Skapa avtalsförslaget med mallen Skadedjursavtal och skicka det för signering."},
    {"type":"quiz","fragor":[
      {"fraga":"Du kopplar Exempel AB under Befintlig kund. Kundkortet har en kundgrupp. Vad händer med steget Kundgrupp?","alternativ":["Du måste välja kundgrupp ändå","Steget hoppas över och det står Från kundkortet","Avtalet får ingen kundgrupp"],"ratt":1,"forklaring":"Kundgruppen förväljs från kundkortet och steget hoppas över. Du kan öppna steget i stegraden och välja en annan."},
      {"fraga":"Du ändrar kontaktpersonens telefonnummer efter att kunden är kopplad. Vad händer med kundkortet?","alternativ":["Kundkortet uppdateras direkt","Ingenting, ändringen gäller bara avtalet","Kunden kopplas bort"],"ratt":1,"forklaring":"Det står i rutan Befintlig kund: ändringar i fälten gäller bara avtalet, kundkortet ändras inte."},
      {"fraga":"När får kunden avtalet?","alternativ":["När du trycker Skapa och visa Oneflows PDF","När du har sett PDF:en och tryckt Skicka för signering","När du trycker Granska avtalet"],"ratt":1,"forklaring":"Skapa och visa Oneflows PDF skapar bara ett utkast i Oneflow. Avtalet går till kunden först när du trycker Skicka för signering."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-avtal-offert","label":"Skapa och skicka en offert","description":"När kunden vill ha ett engångsjobb med fast pris."},
      {"slug":"guide-dokumentsignering-tekniker","label":"Följ dina offerter och avtal i Dokumentsignering","description":"Vad som väntar på dig och på kunden."},
      {"slug":"guide-min-kundresa","label":"Se hur det går för dina offerter och avtal","description":"Min kundresa, bara jämfört med dig själv."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator. Om kundgrupp: Peter Bergqvist, peter.bergqvist@begone.se."}
  ]$json$::jsonb,
  1, false, true, 29, now(), array['technician']
),

-- 2. Kontoret och säljaren: Skapa och skicka ett avtalsförslag
(
  'guide-skapa-avtalsforslag-kontor',
  'Skapa och skicka ett avtalsförslag',
  'Skapa Avtal & Offerter, befintlig eller ny kund, enheter, kundgrupp, Kontroll före utskick och Oneflows PDF innan du skickar.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Skapa Avtal & Offerter överst i sidomenyn. Admin: Skapa avtal på Översikt","tar":"8 min","behover":"Kundens namn eller org.nr, en kontaktperson med telefon och e-post, och vad avtalet ska kosta per år","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna Skapa Avtal & Offerter och behåll Avtalsförslag. Sök fram kunden under Befintlig kund eller fyll i en ny, och gå igenom stegen med [[Nästa]]. Inget skickas förrän du har sett Oneflows PDF och tryckt [[Skicka för signering]]."},
    {"type":"visning","steg":[
      {"text":"Tryck Skapa Avtal & Offerter överst i sidomenyn.","ser":"Skapa avtal eller offert öppnas på steget Vad ska du skapa? Avtalsförslag är förvalt."},
      {"text":"Tryck [[Nästa]]. Välj mall och avtalspart och tryck [[Nästa]] tills du kommer till Motpart.","ser":"Motpart visar rutan Befintlig kund överst och fälten för en ny kund under."},
      {"text":"Skriv kundens namn, org.nr eller kundnummer i Sök kund under Befintlig kund. Tryck [[Koppla|allman.plus]] på rätt kund.","ser":"Det står Kopplad till Exempel AB, kundnr 3512. Fälten nedan är ifyllda från kundkortet."},
      {"text":"Exempel AB har enheter. Tryck Hela verksamheten.","ser":"Det står Avtalet omfattar alla nuvarande och framtida enheter. När du trycker Nästa hoppas Kundgrupp över, eftersom kunden redan har en kundgrupp på kundkortet."},
      {"text":"Gå igenom BeGone, Tjänster och Avtalsobjekt med [[Nästa]]. I Avtalsobjekt heter knappen [[Granska avtalet]]. Tryck på den.","ser":"Granskningen visar avtalet som kunden ser det, rutan Kontroll före utskick och Villkor i portalen med uppsägningstid, fakturering och kundgrupp."},
      {"text":"Tryck [[Skapa och visa Oneflows PDF]].","ser":"Avtalet skapas som utkast i Oneflow och du ser Så här ser kunden avtalet. Inget är skickat än."},
      {"text":"Läs igenom PDF:en. Stämmer allt trycker du [[Skicka för signering]].","ser":"Det står Avtalet är skickat. Kunden har fått avtalet för signering från info@begone.se och du skickas vidare till Dokumentsignering."}
    ]},
    {"type":"list","items":[
      "Dokument: Avtalsförslag är förvalt. Offert är för engångsjobb med fast pris.",
      "Mall: mallen styr avtalets fasta text i Oneflow. Skadedjursavtal är den mest använda.",
      "Avtalspart: Företag eller Privatperson. Kopplar du en befintlig kund i nästa steg ställs det in efter kundkortet.",
      "Motpart, befintlig kund: sök på namn, org.nr eller kundnummer under Befintlig kund och tryck Koppla. Skriver du ett fullständigt org.nr i fältet nedan och numret redan finns visas kunden under Numret finns i kundregistret. Fälten fylls i från kundkortet. Ändringar gäller bara avtalet, kundkortet ändras inte.",
      "Motpart, kund med enheter: under Avtalet läggs på väljer du huvudkontoret eller en enhet. Väljer du en enhet blir bara enheten avtalspart, och uppgifter som enheten saknar ärvs från huvudkontoret. På huvudkontoret väljer du Hela verksamheten eller Bara huvudkontoret, eller kryssar i enheterna.",
      "Motpart, ny kund: står det Ingen kund hittades fyller du i Företagsnamn, Org.nr och kontaktpersonens namn, telefon och e-post. Kunden läggs upp när avtalet signeras.",
      "Kundgrupp: styr prislista och hur kunden följs upp. Har den kopplade kunden en kundgrupp på kundkortet hoppas steget över, och i stegraden står det Från kundkortet. Är du osäker på vilken kundgrupp du ska välja, fråga Peter Bergqvist, peter.bergqvist@begone.se.",
      "BeGone: du står som ansvarig. Fyll i Avtalslängd och Startdatum.",
      "Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Summan står som Årspremie exkl. moms i granskningen.",
      "Avtalsobjekt: texten under § 2 i avtalet. Standardtexten står från början. Tryck Skriv förslag från tjänsterna eller skriv vad som ingår med kundens egna ord. Under texten väljer du Uppsägningstid och Faktureringsintervall, som styr bevakning och fakturering och inte syns för kunden."
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Välj vilka enheter avtalet omfattar","svar":"Kunden är ett huvudkontor med enheter. Välj Hela verksamheten eller Bara huvudkontoret, eller kryssa i enheterna under Vilka enheter omfattar avtalet?"},
      {"fraga":"Det står Kunden har redan ett levande avtal","svar":"Kontrollera att det är rätt kund och att det inte egentligen är ett tillägg eller en förnyelse innan du skickar."},
      {"fraga":"Jag vet inte vilken kundgrupp jag ska välja","svar":"Fråga Peter Bergqvist, peter.bergqvist@begone.se. Nästa går inte att trycka förrän en kundgrupp är vald, då står det Välj en kundgrupp i bottenlisten."},
      {"fraga":"Det står Rätta de röda punkterna först","svar":"En röd punkt i Kontroll före utskick stoppar knappen Skapa och visa Oneflows PDF. Tryck Rätta under och den del som står, rätta, och tryck [[Tillbaka till granskningen]]."},
      {"fraga":"Ett fält är tomt i PDF:en fast jag fyllde i det","svar":"Då ligger felet i Oneflow-mallen. Tryck [[Tillbaka och ändra]] och byt mall, eller säg till en admin."}
    ]},
    {"type":"bra","items":[
      "Inget skickas till kunden förrän du har sett Oneflows PDF och tryckt [[Skicka för signering]]. Kunden får avtalet från info@begone.se.",
      "Ändrar du org.nr så att det inte stämmer med kundkortet kopplas kunden bort, och det står varför. Avtalet gäller då en ny kund. Sök fram rätt kund eller rätta numret.",
      "Röd punkt stoppar. Gul punkt är en varning: E-post för faktura kan kunden fylla i vid signeringen.",
      "[[Tillbaka och ändra]] tar bort utkastet i Oneflow. [[Spara som utkast]] lägger det i Dokumentsignering, där du kan öppna PDF:en igen och skicka senare.",
      "Ett avtal med rabatt kan inte skickas förrän en rabattansvarig har godkänt rabatten. Det står i granskningen."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården vill ha löpande kontroll mot gnagare för 8 400 kr per år. Föreningen är inte kund än. Skapa avtalsförslaget med mallen Skadedjursavtal och skicka det för signering."},
    {"type":"quiz","fragor":[
      {"fraga":"Du kopplar Exempel AB under Befintlig kund. Kundkortet har en kundgrupp. Vad händer med steget Kundgrupp?","alternativ":["Du måste välja kundgrupp ändå","Steget hoppas över och det står Från kundkortet","Avtalet får ingen kundgrupp"],"ratt":1,"forklaring":"Kundgruppen förväljs från kundkortet och steget hoppas över. Du kan öppna steget i stegraden och välja en annan."},
      {"fraga":"Avtalet ska gälla huvudkontoret och alla enheter, även de som tillkommer. Vad väljer du?","alternativ":["Bara huvudkontoret","Hela verksamheten","Kryss på varje enhet som finns i dag"],"ratt":1,"forklaring":"Hela verksamheten omfattar alla nuvarande och framtida enheter. Kryss gäller bara de enheter du kryssar i."},
      {"fraga":"När får kunden avtalet?","alternativ":["När du trycker Skapa och visa Oneflows PDF","När du har sett PDF:en och tryckt Skicka för signering","När du trycker Granska avtalet"],"ratt":1,"forklaring":"Skapa och visa Oneflows PDF skapar bara ett utkast i Oneflow. Avtalet går till kunden först när du trycker Skicka för signering."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn och vyerna."}
    ],"fraga":"Peter Bergqvist om kundgrupp, peter.bergqvist@begone.se. Annars en admin."}
  ]$json$::jsonb,
  1, false, true, 65, now(), array['admin','koordinator','säljare']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;

-- 3. Teknikern: Skapa och skicka en offert (samma slug, nytt innehåll, version 2)
update public.intranet_documents
set
  title = 'Skapa och skicka en offert',
  summary = 'Skapa, Avtal eller offert, Offert, befintlig eller ny kund, ROT och RUT, Kontroll före utskick och Oneflows PDF innan du skickar.',
  version = greatest(version, 2),
  source_updated_at = now(),
  content = $json$[
    {"type":"intro","roller":["technician"],"var":"Skapa › Avtal eller offert. På datorn också Avtal och offerter › Skapa avtal eller offert i sidomenyn","tar":"7 min","behover":"Kundens namn, telefon och e-post och vad jobbet kostar. För ROT eller RUT också personnummer, fastighetsbeteckning och hur mycket av priset som är arbete","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Skapa|allman.plus]], välj Avtal eller offert och sedan Offert. Gå igenom stegen med [[Nästa]] och tryck [[Skapa och visa Oneflows PDF]]. Inget skickas förrän du har sett PDF:en och tryckt [[Skicka offerten]], och kunden får offerten från info@begone.se."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Skapa|allman.plus]].","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck Avtal eller offert.","ser":"Skapa avtal eller offert öppnas på steget Vad ska du skapa? Avtalsförslag är förvalt."},
      {"text":"Tryck Offert.","ser":"Offert är vald: engångsuppdrag med fast pris som kunden godkänner i Oneflow."},
      {"text":"Gå vidare med [[Nästa]] till Motpart. Tryck i Sök kund under Befintlig kund och skriv kundens namn.","ser":"Finns kunden trycker du [[Koppla|allman.plus]] på raden, så fylls fälten i från kundkortet. Står det Ingen kund hittades fyller du i namn, telefon och e-post nedan."},
      {"text":"Gå igenom stegen med [[Nästa]]. I steget Offertinnehåll heter knappen [[Granska offerten]]. Tryck på den.","ser":"Granskningen visar offerten som kunden ser den och rutan Kontroll före utskick med röda, gula och gröna punkter."},
      {"text":"Tryck [[Skapa och visa Oneflows PDF]].","ser":"Offerten skapas som utkast i Oneflow och du ser Så här ser kunden offerten. Inget är skickat än."},
      {"text":"Tryck [[Skicka offerten]].","ser":"Det står Offerten är skickad. Kunden har fått den från info@begone.se och du skickas vidare till Dokumentsignering."}
    ]},
    {"type":"list","items":[
      "Dokument: Offert. Ska kunden ha ett löpande avtal med årspremie finns guiden Skapa och skicka ett avtalsförslag.",
      "Mall: mallen styr den fasta texten i Oneflow. Det finns mallar för företag exklusive moms och för privatpersoner inklusive moms, med ROT och med RUT. När mallen är vald försvinner steget Avtalspart.",
      "BeGone: du står som ansvarig.",
      "Motpart: överst står Befintlig kund. Sök på namn, org.nr eller kundnummer och tryck Koppla, så fylls fälten i från kundkortet. Ändringar gäller bara offerten. Finns kunden inte fyller du i namn, telefon, e-post och e-post för faktura. Företag behöver också organisationsnummer.",
      "Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Priset står bredvid.",
      "Offertinnehåll: texten kunden läser. Tryck Skriv förslag från tjänsterna för en färdig text och skriv till med kundens egna ord."
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag kan inte trycka Nästa","svar":"Bottenlisten säger vad som saknas, till exempel Fyll i e-postadress, Fyll i organisationsnummer eller Lägg till minst en tjänst. Fyll i det, så går det vidare."},
      {"fraga":"Det står Rätta de röda punkterna först","svar":"En röd punkt i Kontroll före utskick stoppar knappen Skapa och visa Oneflows PDF. Tryck Rätta under och den del som står, rätta, och tryck [[Tillbaka till granskningen]]."},
      {"fraga":"Dela upp för ROT/RUT syns inte","svar":"Knappen visas bara när mallen gäller en privatperson, tjänsten har ett pris och priset inte är låst av en prislista. Är tjänsten själv Skadedjurstekniker timpris väljer du ROT eller RUT direkt på raden."},
      {"fraga":"Ett fält är tomt i PDF:en fast jag fyllde i det","svar":"Då ligger felet i Oneflow-mallen. Tryck [[Tillbaka och ändra]] och byt mall, eller säg till en admin."},
      {"fraga":"Det står Rabatten väntar på godkännande","svar":"Offerten har rabatt som en rabattansvarig inte har godkänt än. Skicka offerten går inte att trycka. Du får en notis när rabatten är godkänd eller avslagen. Skicka sedan offerten från Dokumentsignering med Granska och skicka."}
    ]},
    {"type":"bra","items":[
      "Inget skickas till kunden förrän du har sett Oneflows PDF och tryckt [[Skicka offerten]]. Kunden får offerten från info@begone.se, aldrig från din egen e-post.",
      "Röd punkt stoppar. Gul punkt är en varning: E-post för faktura kan till exempel kunden fylla i vid signeringen.",
      "[[Tillbaka och ändra]] tar bort utkastet i Oneflow. [[Spara som utkast]] lägger det i Dokumentsignering under Utkast att skicka, där du skickar det med Granska och skicka.",
      "Från ett ärende: tryck [[Ärendets verktyg|falt.verktyg]] och Skapa offert. Då är ärendets tjänster och artiklar redan ifyllda.",
      "Skickade offerter följer du i Dokumentsignering. Kontoret bokar in när kunden har signerat."
    ]},
    {"type":"callout","variant":"info","title":"ROT och RUT i offerten","text":"Välj mallen Offertförslag, ROT (Privatperson) eller Offertförslag, RUT (Privatperson). Mallen väljer inte avdraget, det gör du i Tjänster. Avdraget gäller bara arbetskostnaden: lägg till tjänsten och tryck Dela upp för ROT/RUT på raden. Fyll i Varav arbetskostnad och Timmar, välj ROT (30 %) eller RUT (50 %) och tryck Dela upp. Arbetet blir en egen rad, Skadedjurstekniker timpris, som bär avdraget. Totalen mot kunden ändras inte. Längst ner i Tjänster står ROT-avdrag och Att betala (kund). En offert kan inte ha både ROT och RUT."},
    {"type":"callout","variant":"warning","title":"Personnummer och fastighetsbeteckning","text":"Fyll i Fastighetsbeteckning på raden med avdraget och kundens personnummer i Motpart redan i offerten. De följer med till ärendet när kontoret bokar in, och utan fastighetsbeteckning går ärendet inte att fakturera med avdrag. Granskningen visar Totalt exkl. moms utan avdraget, så titta i Oneflows PDF hur priset visas för kunden innan du skickar."},
    {"type":"callout","variant":"info","title":"Rabatt på offerten","text":"Rabatt ger du i steget Tjänster: tryck Prisguide, skriv procenten i Rabatt % och skriv en motivering. Nästa går inte att trycka förrän motiveringen är skriven, och bottenlisten säger Skriv en motivering till rabatten i prisguiden. Kunden ser listpris, rabatt i procent och pris efter rabatt i Oneflow. Offerten kan inte skickas förrän en rabattansvarig har godkänt rabatten, det står i granskningen."},
    {"type":"interactive","component":"nyvy/KontrollForeUtskick"},
    {"type":"ovning","uppdrag":"Familjen Exempel vill ha pris på att ta bort ett getingbo, 2 750 kr. Skapa offerten med mallen för privatpersoner inklusive moms och skicka den."},
    {"type":"quiz","fragor":[
      {"fraga":"Kontroll före utskick visar en gul punkt: Personnummer saknas. Vad händer om du trycker Skapa och visa Oneflows PDF?","alternativ":["Det går inte, alla punkter måste vara gröna","Utkastet skapas, gul punkt stoppar inte","Offerten skickas direkt till kunden"],"ratt":1,"forklaring":"Bara röda punkter stoppar. Inget skickas förrän du har sett PDF:en och tryckt Skicka offerten."},
      {"fraga":"Från vilken adress får kunden offerten?","alternativ":["Din egen e-post","info@begone.se","Kontorets e-post för fakturor"],"ratt":1,"forklaring":"Det står under knappen: Skickas från info@begone.se till kundens e-post."},
      {"fraga":"Kunden ska ha ROT-avdrag. Var väljer du ROT?","alternativ":["Mallen för ROT räcker, avdraget räknas ut av sig självt","I Tjänster med Dela upp för ROT/RUT, på arbetskostnaden","I Motpart, vid personnumret"],"ratt":1,"forklaring":"Mallen styr bara texten. Avdraget väljer du i Tjänster, och det läggs på en egen rad för arbetskostnaden."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-avtalsforslag","label":"Skapa och skicka ett avtalsförslag","description":"När kunden ska ha ett löpande avtal med årspremie."},
      {"slug":"guide-dokumentsignering-tekniker","label":"Följ dina offerter och avtal i Dokumentsignering","description":"Vad som väntar på dig och på kunden."},
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Tjänster, ROT och provision."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb
where slug = 'guide-skapa-avtal-offert';

-- 4. Länktexterna till offertguiden i andra teknikerguider
update public.intranet_documents
set content = replace(content::text,
      '"label": "Skapa och skicka en offert eller ett avtal"',
      '"label": "Skapa och skicka en offert"')::jsonb,
    source_updated_at = now()
where slug in ('guide-dokumentsignering-tekniker', 'guide-min-kundresa', 'guide-leads-tekniker')
  and content::text like '%"label": "Skapa och skicka en offert eller ett avtal"%';
