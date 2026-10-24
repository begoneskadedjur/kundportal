-- Handboken för nya arbetsvyn (2026-10-24), grupp Ärendet steg för steg.
-- Fem teknikerguider, alla med telefon och dator (enheter ['mobil','dator'] i modulerna):
--   guide-utfora-arende   Gör ett besök steg för steg          (ny)
--   guide-prissattning    Sätt rätt pris i ärendet             (omskriven, slug behålls)
--   guide-fakturering     Stäng ärendet eller bara besöket     (omskriven, slug behålls)
--   guide-aterbesok       Boka ett återbesök                   (omskriven, slug behålls)
--   guide-delfakturering  Delfakturera ett ärende              (omskriven, slug behålls)
-- Guidemodulerna: src/pages/shared/intranet/guider/<slug>.tsx, delade delar i _nyvy_arendet.tsx.
-- Interaktiva delar: interactive/nyvy/ArendetsVerktyg, RotRaknare, StangJamforelse, DelfakturaPlan.
-- Befintliga slugs behålls så att länkar och läsloggen fungerar. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-utfora-arende',
  'Gör ett besök steg för steg',
  'Från Jag är framme till Klart: stegen i ärendet, rapporten, Ärendets verktyg och Alla uppgifter.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Idag eller Mina ärenden › Öppna › stegen i ärendet","tar":"6 min","behover":"Ett bokat privat- eller företagsärende där du är tilldelad","enhet":"mobil"},
    {"type":"kortsvar","text":"Öppna ärendet och gå igenom stegen i raden överst: Framme, Arbetet, Foton och preparat, Rapport, Pris och fakturering och Klart. Tryck [[Jag är framme]] när du står på plats. Den gröna knappen längst ner sparar det du har ändrat och tar dig till nästa steg."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Öppna]] under Nästa uppdrag i Idag.","ser":"Ärendet öppnas i steget Framme. Överst står Framme och Steg 1 av 6, under det raden med stegens ikoner."},
      {"text":"Kontrollera kontakten och adressen. Tryck sedan [[Jag är framme]] längst ner.","ser":"Du kommer till Arbetet. Arbetstiden räknas nu i bakgrunden, den visas inte i stegen."},
      {"text":"Läs Beskrivning och kontrollera Tjänst. Tryck [[Vidare till foton och preparat]].","ser":"Steget visar Använda preparat och Bilder."},
      {"text":"Lägg till bilder och preparat. Tryck sedan [[Vidare till rapport]].","ser":"Bilderna sparas när du går vidare. Steget Rapport visar Saneringsrapport, Specialrapporter och knapparna för rapporten."},
      {"text":"Skriv vad du gjorde i Saneringsrapport och tryck [[Skicka till Familjen Exempel|kontakt.mejl]]. Knappen visar kundens namn.","ser":"Ärendet sparas först. Det står Rapport skickad till Familjen Exempel! och under knapparna vilken version som är skickad till kund."},
      {"text":"Tryck [[Vidare till pris och fakturering]].","ser":"Steget visar Tjänster & fakturarader och längst ner Provision. Guiden Sätt rätt pris i ärendet går igenom steget."},
      {"text":"Kontrollera raderna och tryck [[Vidare till klart]].","ser":"Klart kontrollerar ärendet och låter dig välja Hela ärendet eller Bara besöket. Guiden Stäng ärendet eller bara besöket går igenom steget."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Vidare till arbetet i stället för Jag är framme","svar":"Jag är framme visas bara för den som är tilldelad ärendet, och bara när arbetstiden inte redan räknas, till exempel om du redan har varit framme. Är du inte tilldelad står det Du är inte tilldelad ärendet under Är du framme hos kunden? Då kan du läsa ärendet och svara i kommunikationen."},
      {"fraga":"Rapportknapparna är gråa","svar":"Under knapparna står Rapporten kan tas fram när ärendet har ett namn. Byt namn under Ärendets verktyg. Tryck på [[Ärendets verktyg|falt.verktyg]] uppe till höger och [[Byt ärendenamn|rapport.penna]]."},
      {"fraga":"Det står Kontaktpersonen saknar e-post","svar":"Gå till steget Framme och skriv e-postadressen under Kontaktinformation. Tryck sedan på ikonen Rapport i stegraden och skicka igen."},
      {"fraga":"Jag hittar inte Starttid och Sluttid","svar":"Tiderna och teknikerna finns inte i stegen. Tryck på [[Alla uppgifter|falt.uppgifter]] uppe till höger, så ser du den vanliga flikvyn med Ärende, Utförande och Ekonomi. Samma ikon tar dig tillbaka till stegen."},
      {"fraga":"Jag tryckte på krysset av misstag","svar":"Krysset uppe till höger stänger ärendet. Det som sparades när du gick vidare finns kvar. Öppna ärendet igen från Idag eller Mina ärenden."}
    ]},
    {"type":"bra","items":[
      "Du kan hoppa mellan stegen genom att trycka på deras ikoner. Ett steg med orange ram har något som saknas innan ärendet kan stängas.",
      "Den gröna knappen sparar det du har ändrat innan den går vidare, även bilderna. Går det inte att spara stannar du kvar i steget.",
      "Arbetstiden räknas i bakgrunden från Jag är framme tills du stänger ärendet eller bokar återbesöket. Vid nästa besök räknas den från Jag är framme igen.",
      "[[Ärendets verktyg|falt.verktyg]] uppe till höger samlar resten: rapporterna, avtal och offert, återbesök och nytt ärende, Kommunikation, Ring, Byt ärendenamn, Historik, Ändra status och Radera ärende.",
      "En specialrapport skapar du med plustecknet vid Specialrapporter i steget Rapport."
    ]},
    {"type":"interactive","component":"nyvy/ArendetsVerktyg"},
    {"type":"ovning","uppdrag":"Du har parkerat utanför hos Familjen Exempel. Öppna ärendet, tala om att du är framme, fotografera ventilen, skriv rapporten och skicka den till kunden. Gå sedan vidare till Pris och fakturering. Titta gärna i Ärendets verktyg och Alla uppgifter på vägen."},
    {"type":"quiz","fragor":[
      {"fraga":"Kollegan Anna Exempel har ärendet. Du öppnar det för att svara på hennes fråga. Vad står på den gröna knappen i Framme?","alternativ":["Jag är framme","Vidare till arbetet","Stäng hela ärendet"],"ratt":1,"forklaring":"Jag är framme visas bara för den som är tilldelad ärendet. Du kan läsa och svara, men ärendet sköts av Anna."},
      {"fraga":"Kunden vill ha rapporten. Hur får kunden den?","alternativ":["Du skickar den med knappen i steget Rapport","Den skickas av sig själv när ärendet stängs","Kontoret skickar den när fakturan går iväg"],"ratt":0,"forklaring":"Rapporten skickas inte av sig själv. Knappen i steget Rapport visar kundens namn."},
      {"fraga":"Besöket drog över och sluttiden ska ändras. Var gör du det?","alternativ":["I steget Framme","I Alla uppgifter, fliken Ärende","I Ärendets verktyg under Rapporter"],"ratt":1,"forklaring":"Starttid och Sluttid finns under Schemaläggning i den vanliga flikvyn, Alla uppgifter."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Tjänsterader, Prisguiden, ROT och provision."},
      {"slug":"guide-fakturering","label":"Stäng ärendet eller bara besöket","description":"Steget Klart och vad som händer med fakturan."},
      {"slug":"guide-specialrapporter","label":"Skriv en specialrapport","description":"Inspektion, sanering eller annan rapport med bilder."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 10, now(), array['technician']
),
(
  'guide-prissattning',
  'Sätt rätt pris i ärendet',
  'Tjänsterader, Interna kostnader, Prisguiden, ROT och RUT på arbetet och provisionen i steget Pris och fakturering.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › steget Pris och fakturering","tar":"6 min","behover":"Ett privat- eller företagsärende där tjänsten är vald","enhet":"mobil"},
    {"type":"kortsvar","text":"I steget Pris och fakturering lägger du in tjänsterna under Tjänster & fakturarader och det du har förbrukat under Interna kostnader. [[Prisguide|allman.kalkyl]] räknar fram priset ur inköpet. ROT och RUT dras bara på arbetskostnaden, som du delar ut med [[Dela upp för ROT/RUT|allman.kalkyl]]."},
    {"type":"visning","steg":[
      {"text":"Tryck på ikonen Pris och fakturering i stegraden.","ser":"Steget visar Personnummer, Tjänster & fakturarader med tjänsten och längst ner Provision. I ett företagsärende står Organisationsnummer i stället för Personnummer."},
      {"text":"Tryck Interna kostnader och tryck på artiklarna du har använt.","ser":"Artiklarna läggs till med inköpspris. De syns inte på fakturan, men marginalen uppe i Tjänster & fakturarader räknas om."},
      {"text":"Tryck [[Prisguide|allman.kalkyl]].","ser":"Prisguiden öppnas med Tilldela interna kostnader till fakturarader."},
      {"text":"Välj tjänsten i rutan under artikeln.","ser":"Justera påslag & marginal visas med prisförslaget. Påslaget börjar på det rekommenderade, i dag 40 %."},
      {"text":"Tryck [[Applicera priser]].","ser":"Det står Priser uppdaterade. Priset på raden är inköpet plus påslaget, och marginalen räknas om."},
      {"text":"Ska en privatkund ha ROT eller RUT? Tryck [[Dela upp för ROT/RUT|allman.kalkyl]] under tjänsten.","ser":"Formuläret öppnas med Varav arbetskostnad, Timmar och Avdrag, och en uträkning som visar vad kunden betalar."},
      {"text":"Fyll i Varav arbetskostnad och Timmar, välj ROT eller RUT och tryck [[Dela upp]].","ser":"Det står Arbetskostnaden uppdelad (ROT). Under tjänsten står Varav arbetskostnad och fältet Fastighetsbeteckning *. Fyll i det."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Prisrutan går inte att ändra och det står Fast pris eller Låst av avtal","svar":"Priset kommer från kundens prislista eller avtal och ändras inte i ärendet. Lägg ändå in artiklarna under Interna kostnader, de behövs för marginalen."},
      {"fraga":"Det står Arbetskostnaden kan inte vara högre än totalpriset","svar":"Arbetet får inte vara större än radens totalpris. Ändra tjänstens pris först om arbetet ska vara större."},
      {"fraga":"Jag ser ingen Dela upp för ROT/RUT","svar":"Den finns bara i privatärenden, och inte på rader med Fast pris eller Låst av avtal. På själva arbetstidstjänsten väljer du ROT eller RUT direkt på raden."},
      {"fraga":"Det står Motivering krävs innan ärendet kan avslutas","svar":"En rad har rabatt. Skriv varför i Motivering till rabatt (krävs vid avslut) under raden. Motiveringen visas för den som godkänner rabatter, och fakturan väntar på godkännandet."},
      {"fraga":"Det står att beloppet understiger minsta provisionsgrundande belopp","svar":"Underlaget är under 4 000 kr exkl. moms. Då registreras ingen provision för ärendet. Det är inget fel."}
    ]},
    {"type":"bra","items":[
      "I privatärenden står priserna inkl. moms, i företagsärenden exkl. moms. Marginalen räknas alltid på priset exkl. moms.",
      "Interna kostnader visas aldrig på fakturan. De finns för att marginalen ska bli rätt.",
      "ROT ger 30 % och RUT 50 % av arbetskostnaden i avdrag. Arbetet blir en egen rad, Skadedjurstekniker timpris, och totalen mot kunden ändras inte. Fastighetsbeteckningen krävs, och ett ärende kan inte ha både ROT och RUT.",
      "Provision: välj Ja, provisionsgrundande under Provision. Det blir 6 % av priset exkl. moms, fördelat efter andelarna mellan teknikerna. Andelarna ska bli 100 %, och Avdrag (underentreprenörskostnader) dras från underlaget först.",
      "Ingen provision under 4 000 kr exkl. moms. Med ROT räknas provisionen på beloppet före avdraget."
    ]},
    {"type":"interactive","component":"nyvy/RotRaknare"},
    {"type":"ovning","uppdrag":"Familjen Exempel har fått Tätning av ventil för 3 750 kr inkl. moms. 2 500 kr av det är arbete, två timmar, och familjen ska ha ROT. Fastigheten heter Exempelby 1:23. Dela upp raden."},
    {"type":"quiz","fragor":[
      {"fraga":"Tätning av ventil kostar 3 750 kr inkl. moms. 2 500 kr är arbete och kunden ska ha ROT. Hur stort blir avdraget?","alternativ":["1 125 kr","750 kr","1 250 kr"],"ratt":1,"forklaring":"ROT är 30 % av arbetskostnaden, inte av hela priset. 30 % av 2 500 kr är 750 kr, och kunden betalar 3 000 kr."},
      {"fraga":"Ett privatärende kostar 4 375 kr inkl. moms. Blir det provision?","alternativ":["Ja, 6 % av 4 375 kr","Nej, underlaget 3 500 kr exkl. moms är under 4 000 kr","Ja, men först efter ROT-avdraget"],"ratt":1,"forklaring":"Provisionen räknas på priset exkl. moms. 4 375 kr inkl. moms är 3 500 kr exkl. moms, under gränsen 4 000 kr."},
      {"fraga":"Ett företagsärende är på 10 000 kr exkl. moms och provisionsgrundande. Du och Anna Exempel har 50 % var. Hur mycket får du?","alternativ":["600 kr","300 kr","500 kr"],"ratt":1,"forklaring":"6 % av 10 000 kr är 600 kr. Din andel är hälften, 300 kr."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-utfora-arende","label":"Gör ett besök steg för steg","description":"Alla stegen från Jag är framme till Klart."},
      {"slug":"guide-fakturering","label":"Stäng ärendet eller bara besöket","description":"Vad som händer med raderna när du stänger."},
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort när du bokar återbesöket."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 50, now(), array['technician']
),
(
  'guide-fakturering',
  'Stäng ärendet eller bara besöket',
  'Steget Klart: kontrollen före stängning, Hela ärendet eller Bara besöket, och vad som händer med fakturan.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › steget Klart","tar":"5 min","behover":"Ett ärende där arbetet, rapporten och raderna är klara","enhet":"mobil"},
    {"type":"kortsvar","text":"I steget Klart väljer du Hela ärendet eller Bara besöket. [[Stäng hela ärendet]] gör en faktura av raderna, som går vidare till godkännande och Fortnox. Inget skickas till kunden direkt. Ska du tillbaka väljer du Bara besöket i stället."},
    {"type":"visning","steg":[
      {"text":"Tryck på ikonen Klart längst till höger i stegraden.","ser":"Klart kör Kontrollera innan du stänger. Antingen står det Inget saknas enligt det som är sparat, eller vad som saknas."},
      {"text":"Står det att något saknas: tryck på knappen under, här [[Gå till steget Pris och fakturering]].","ser":"Du kommer till steget där det saknas. Här är fältet Fastighetsbeteckning * rött."},
      {"text":"Fyll i det som saknas, här Fastighetsbeteckning *.","ser":"Det sparas när du lämnar fältet."},
      {"text":"Tryck på ikonen Klart igen.","ser":"Kontrollen körs igen. Det står Inget saknas enligt det som är sparat."},
      {"text":"Kontrollera att Hela ärendet är valt och läs Det här händer när du stänger.","ser":"Punkterna visar status, besökshistoriken, fakturan, provisionen och rapporten."},
      {"text":"Tryck [[Stäng hela ärendet]].","ser":"Knappen visar Sparar ärendet..., Kontrollerar ärendet... och Stänger ärendet... Sedan står det Ärendet är avslutat med avslutsdatumet."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står 1 sak saknas innan ärendet kan stängas.","svar":"Varje sak har en knapp, Gå till steget och stegets namn. Tryck på den, fyll i och gå tillbaka till Klart. Steg där något saknas har orange ram i stegraden."},
      {"fraga":"Det står Motivera rabatten på ... under Tjänster & fakturarader.","svar":"En rad har rabatt. Skriv varför i Motivering till rabatt (krävs vid avslut) under raden i Pris och fakturering."},
      {"fraga":"Det står Sluttid kan inte vara tidigare än starttiden.","svar":"Tryck [[Ändra tiden i Alla uppgifter]]. Rätta Sluttid under Schemaläggning i fliken Ärende och gå tillbaka till stegen."},
      {"fraga":"Det står Välj kundgrupp under Pris och fakturering innan ärendet kan avslutas.","svar":"Gäller företag som inte finns i kundregistret än. Välj en grupp under Kundgrupp (för fakturering) i steget Pris och fakturering."},
      {"fraga":"Det står Kontrollen kunde inte köras. Försök igen.","svar":"Kontrollera att du har täckning och tryck på ikonen Klart igen."}
    ]},
    {"type":"bra","items":[
      "Hela ärendet: ärendet får status Avslutat och dagens datum som avslutsdatum, och besöket sparas i besökshistoriken.",
      "Raderna blir en faktura som går vidare till godkännande och Fortnox. Kunden får inget direkt. Är underlaget 0 kr skapas ingen faktura.",
      "Rapporten skickas inte av sig själv. Skicka den i steget Rapport innan du stänger.",
      "[[Spara utan att stänga]] sparar allt och låter ärendet stå öppet, till exempel när du måste åka innan du är klar.",
      "[[Skapa lead|lead.tips]] längst ner i Klart tipsar kontoret om ett löpande avtal eller merförsäljning hos kunden."
    ]},
    {"type":"interactive","component":"nyvy/StangJamforelse"},
    {"type":"ovning","uppdrag":"Jobbet hos Familjen Exempel är klart och raderna är ifyllda med ROT. Fastighetsbeteckningen saknas, den är Exempelby 1:23. Stäng hela ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Du ska tillbaka till kunden om två veckor. Vad väljer du i Klart?","alternativ":["Hela ärendet","Bara besöket","Spara utan att stänga"],"ratt":1,"forklaring":"Bara besöket bokar återbesöket. Ärendet får status Återbesök och står kvar öppet."},
      {"fraga":"Du har tryckt Stäng hela ärendet. När får kunden fakturan?","alternativ":["Direkt i sin e-post","När fakturan har gått vidare till godkännande och Fortnox","När du skickar rapporten"],"ratt":1,"forklaring":"Fakturan skapas när du stänger och går vidare till godkännande och Fortnox. Inget skickas till kunden direkt."},
      {"fraga":"Fastighetsbeteckningen saknas och du trycker Stäng hela ärendet. Vad händer?","alternativ":["Ärendet stängs och kontoret fyller i resten","Ärendet sparas och kontrolleras, men stängs inte förrän fastighetsbeteckningen finns","Fakturan skickas utan ROT"],"ratt":1,"forklaring":"Kontrollen stoppar stängningen och visar vad som saknas, med en knapp till rätt steg."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Bara besöket, steg för steg."},
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort när du bokar återbesöket."},
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Raderna som blir fakturan."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 34, now(), array['technician']
),
(
  'guide-aterbesok',
  'Boka ett återbesök',
  'Boka nästa besök i samma ärende från steget Klart, med förslag på lediga tider.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › steget Klart › Bara besöket","tar":"4 min","behover":"Ett privat- eller företagsärende som inte är ett följeärende","enhet":"mobil"},
    {"type":"kortsvar","text":"I steget Klart: tryck Bara besöket och [[Boka återbesök|arende.aterbesok]]. Välj datum och längd, tryck [[Visa förslag →]], välj en tid och tryck [[Boka återbesök|allman.kalender]]. Ärendet får status Återbesök och stängs inte."},
    {"type":"visning","steg":[
      {"text":"Tryck på ikonen Klart längst till höger i stegraden.","ser":"Klart visar Kontrollera innan du stänger och valen Hela ärendet och Bara besöket."},
      {"text":"Tryck Bara besöket.","ser":"Under valen står Det här händer när du bokar återbesöket, och den gröna knappen heter Boka återbesök."},
      {"text":"Tryck [[Boka återbesök|arende.aterbesok]].","ser":"Ärendet sparas och dialogen Boka återbesök öppnas med Välj datum och längd."},
      {"text":"Tryck i Datum för återbesök * och välj dag.","ser":"Dagen syns i fältet. Lördag och söndag går inte att välja. Besökslängd står på 1 tim, tryck en annan längd om det behövs."},
      {"text":"Tryck [[Visa förslag →]].","ser":"Smarta förslag visar lediga tider den dagen."},
      {"text":"Tryck på tiden som passar.","ser":"Tiden blir markerad och det står Vald tid med start och slut. Under finns Anteckning (valfritt) och rutan för delfaktura."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat! och ärendet har status Återbesök."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inte Bara besöket","svar":"Bara besöket finns inte i följeärenden, där finns bara Hela ärendet. Fråga koordinatorn om ett nytt besök ska bokas."},
      {"fraga":"Det står Inga lediga tider hittades från detta datum. Prova ett annat datum.","svar":"Tryck [[Ange tid manuellt istället]], eller tryck [[← Byt datum]] och välj en annan dag."},
      {"fraga":"Det står att ärendet saknar adress","svar":"Utan adress kan portalen inte hämta smarta förslag. Tryck [[Ange tid manuellt istället]], eller lägg in adressen i steget Framme först."},
      {"fraga":"Boka återbesök går inte att trycka på","svar":"Välj en tid först, bland förslagen eller med Ange tid manuellt."},
      {"fraga":"Det står Välj minst en tekniker.","svar":"Ärendet har flera tekniker. Kryssa i minst en under Tekniker för återbesök."}
    ]},
    {"type":"bra","items":[
      "Ärendet sparas innan dialogen öppnas, och besöket sparas i besökshistoriken med teknikerna och rapporten.",
      "Har ärendet flera tekniker väljer du vilka som ska med under Tekniker för återbesök. Förslagen visar tider där alla valda är lediga samtidigt.",
      "Anteckning (valfritt) syns under Tidigare återbesök nästa gång dialogen öppnas.",
      "Ska kunden faktureras för det som är gjort? Kryssa i Skapa delfaktura för nuvarande tjänster i samma dialog.",
      "Samma dialog finns i [[Ärendets verktyg|falt.verktyg]] under Återbesök och nytt ärende."
    ]},
    {"type":"ovning","uppdrag":"Du ska tillbaka till Familjen Exempel tisdag 2026-10-27 kl 10:30, en och en halv timme. Skriv anteckningen Kontrollera fällorna i källaren och boka återbesöket."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden vill ha besöket kl 08:00, men den tiden finns inte bland förslagen. Vad gör du?","alternativ":["Väljer närmaste förslag och ringer kunden","Trycker Ange tid manuellt och väljer 08:00","Bokar ett nytt ärende"],"ratt":1,"forklaring":"Ange tid manuellt låter dig välja datum och tid själv."},
      {"fraga":"Vilken status får ärendet när återbesöket är bokat?","alternativ":["Återbesök","Avslutat","Bokad"],"ratt":0,"forklaring":"Ärendet får status Återbesök och står kvar öppet tills du stänger hela ärendet."},
      {"fraga":"Kunden vill ha återbesöket på en lördag. Vad gör du?","alternativ":["Väljer lördagen i Datum för återbesök *","Fråga koordinatorn, helger går inte att välja i dialogen","Väljer lördagen under Ange tid manuellt"],"ratt":1,"forklaring":"Lördag och söndag går inte att välja, varken bland förslagen eller manuellt."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort när du bokar återbesöket."},
      {"slug":"guide-fakturering","label":"Stäng ärendet eller bara besöket","description":"Steget Klart och vad som händer med fakturan."},
      {"slug":"guide-aterbesok-avtal","label":"Boka ett återbesök i ett avtalsärende","description":"Och delfakturera merförsäljning."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 31, now(), array['technician']
),
(
  'guide-delfakturering',
  'Delfakturera ett ärende',
  'Fakturera det som är gjort när du bokar återbesöket, eller samla en månads besök på en faktura.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › steget Klart › Bara besöket › Boka återbesök","tar":"4 min","behover":"Ett privat- eller företagsärende med ifyllda Tjänster & fakturarader","enhet":"mobil"},
    {"type":"kortsvar","text":"Kryssa i Skapa delfaktura för nuvarande tjänster när du bokar återbesöket. Allt som är ofakturerat på ärendet blir en faktura, som går vidare till godkännande och Fortnox. Kryssar du inte i ligger raderna kvar och kommer med nästa gång."},
    {"type":"visning","steg":[
      {"text":"Tryck på ikonen Klart längst till höger i stegraden.","ser":"Klart visar valen Hela ärendet och Bara besöket."},
      {"text":"Tryck Bara besöket.","ser":"Det står att delfakturering är en kryssruta i återbesöksdialogen."},
      {"text":"Tryck [[Boka återbesök|arende.aterbesok]].","ser":"Ärendet sparas och dialogen Boka återbesök öppnas."},
      {"text":"Välj datum och tryck [[Visa förslag →]].","ser":"Förslagen visas. Längre ner finns rutan Skapa delfaktura för nuvarande tjänster."},
      {"text":"Tryck på tiden som passar.","ser":"Tiden blir markerad och det står Vald tid."},
      {"text":"Kryssa i Skapa delfaktura för nuvarande tjänster.","ser":"Raderna och Totalt (exkl. moms) visas, och det står Tjänsterna markeras som fakturerade och tas bort från ärendet."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat och delfaktura med fakturanumret. I steget Pris och fakturering står Inga tjänster tillagda än."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Rutan Skapa delfaktura syns inte","svar":"Då står det Inga ofakturerade tjänster på ärendet. Lägg in raderna i steget Pris och fakturering först."},
      {"fraga":"Rutan Skapa delfaktura för nuvarande tjänster är grå","svar":"Under rutan står Ärendet har ett anpassat pris för hela jobbet. Det faktureras när ärendet avslutas. Boka återbesöket utan delfaktura. Priset kommer med på slutfakturan."},
      {"fraga":"Det står Återbesök bokat. Underlaget är 0 kr, ingen delfaktura skapad.","svar":"Raderna summerar till 0 kr. Då blir det ingen faktura, men återbesöket är bokat."},
      {"fraga":"Det står Delfaktura: Fastighetsbeteckning saknas för ROT/RUT på: ...","svar":"Återbesöket är bokat men delfakturan skapades inte, och raderna ligger kvar. Fyll i Fastighetsbeteckning * i steget Pris och fakturering och kryssa i vid nästa återbesök, eller låt raderna komma med när du stänger hela ärendet."},
      {"fraga":"Jag glömde kryssa i","svar":"Inget försvinner. Raderna ligger kvar och kommer med på nästa delfaktura eller på slutfakturan."}
    ]},
    {"type":"bra","items":[
      "En delfaktura tar alla ofakturerade rader på ärendet, oavsett hur många besök de kommer från.",
      "En faktura per månad: kryssa inte i vid besöken mitt i månaden. Kryssa i vid månadens sista besök, så kommer hela månaden med.",
      "Det sista besöket behöver inget kryss. När du stänger hela ärendet blir resten slutfakturan.",
      "Har ärendet ett anpassat pris för hela jobbet går det inte att delfakturera. Fasta priser från kundens prislista på raderna spärrar inget.",
      "Det går inte att delfakturera utan att boka ett återbesök. Ska inget mer besök bokas stänger du hela ärendet i stället."
    ]},
    {"type":"interactive","component":"nyvy/DelfakturaPlan"},
    {"type":"ovning","uppdrag":"Brf Exempelgården ska få faktura för det som är gjort nu: Råttbekämpning, första besöket 1 800 kr och Tätning av ventil 950 kr exkl. moms. Du kommer tillbaka tisdag 2026-10-27 kl 08:00. Boka återbesöket och skapa delfakturan."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden vill ha en faktura per månad och det är mitt i månaden. Vad gör du med Skapa delfaktura?","alternativ":["Kryssar i","Lämnar den tom","Stänger hela ärendet"],"ratt":1,"forklaring":"Raderna ligger kvar och kommer med när du kryssar i vid månadens sista besök."},
      {"fraga":"Rutan är grå och det står att ärendet har ett anpassat pris för hela jobbet. Vad gör du?","alternativ":["Ber kontoret ta bort priset så att du kan kryssa i","Bokar återbesöket utan delfaktura","Stänger hela ärendet i stället"],"ratt":1,"forklaring":"Det anpassade priset gäller hela ärendet och faktureras en gång, när ärendet avslutas."},
      {"fraga":"Du kryssade i Skapa delfaktura och bokade. Vad händer med raderna?","alternativ":["De faktureras och försvinner från ärendet","De ligger kvar och faktureras igen när du stänger","De flyttas till nästa besök"],"ratt":0,"forklaring":"Raderna räknas som fakturerade och kan inte komma med igen. Nästa besök börjar från noll."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Bara besöket, steg för steg."},
      {"slug":"guide-fakturering","label":"Stäng ärendet eller bara besöket","description":"Slutfakturan när du stänger hela ärendet."},
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Raderna som blir fakturan."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 30, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
