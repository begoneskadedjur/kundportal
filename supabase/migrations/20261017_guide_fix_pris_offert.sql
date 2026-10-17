-- Guiderna efter rättningen 2026-10-17 (anpassat pris och offertinnehåll).
-- Anpassat pris gäller hela ärendet: rutan Skapa delfaktura för nuvarande
-- tjänster i RevisitModal är grå när ärendet har ett anpassat pris, och
-- InvoiceService.createInvoiceFromCase vägrar delfaktura med anpassat pris.
--   guide-delfakturering              Delfakturera ett ärende           tekniker
--   guide-aterbesok-kontor            Boka ett återbesök                kontor
--   guide-aterbesok                   Boka ett återbesök                tekniker
-- Offert från ett ärende får offertinnehållet skrivet från tjänsterna (samma
-- text som Skriv förslag från tjänsterna). Avtalets standardtext används bara
-- för avtal, och står den orörd i en offert blir kontrollpunkten gul:
-- Kontrollera offertinnehållet.
--   guide-dokumentsignering-tekniker  Skicka en offert från ärendet     tekniker
--     (guidemodulen guider/guide-dokumentsignering-tekniker.tsx är omskriven)
-- Utgår från 20261016_guidemallen_00_aterbesok.sql, _10_fakturering.sql och
-- _45_dokumentsignering_tekniker.sql. Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-delfakturering',
  'Delfakturera ett ärende',
  'Fakturera det som är gjort när du bokar återbesöket, eller samla en månads besök på en faktura.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren › Boka återbesök","tar":"4 min","behover":"Ett privat- eller företagsärende med ifyllda Tjänster & fakturarader","enhet":"mobil"},
    {"type":"kortsvar","text":"Kryssa i Skapa delfaktura för nuvarande tjänster när du bokar återbesöket. Allt som är ofakturerat på ärendet blir en faktura. Kryssar du inte i ligger raderna kvar och kommer med nästa gång."},
    {"type":"visning","steg":[
      {"text":"Tryck på fliken Ekonomi och kontrollera Tjänster & fakturarader.","ser":"Raderna här är det som kommer med på delfakturan."},
      {"text":"Tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Boka återbesök]].","ser":"Du ser Välj datum och längd."},
      {"text":"Välj datum och tryck [[Visa förslag →]].","ser":"Portalen visar lediga tider."},
      {"text":"Tryck på den tid som passar.","ser":"Tiden blir markerad. Under tiderna finns rutan Skapa delfaktura för nuvarande tjänster."},
      {"text":"Kryssa i Skapa delfaktura för nuvarande tjänster.","ser":"Raderna och Totalt (exkl. moms) visas, så du ser exakt vad som faktureras."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat och delfaktura med fakturanumret. Under Tjänster & fakturarader står Inga tjänster tillagda än."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Rutan Skapa delfaktura syns inte","svar":"Då står det Inga ofakturerade tjänster på ärendet. Fyll i Tjänster & fakturarader under fliken Ekonomi först."},
      {"fraga":"Rutan Skapa delfaktura för nuvarande tjänster är grå","svar":"Under rutan står Ärendet har ett anpassat pris för hela jobbet. Det faktureras när ärendet avslutas. Då går det inte att delfakturera. Boka återbesöket utan delfaktura. Det anpassade priset kommer med på slutfakturan."},
      {"fraga":"Det står Underlaget är 0 kr, ingen delfaktura skapad","svar":"Raderna summerar till 0 kr. Då blir det ingen faktura, men återbesöket är bokat."},
      {"fraga":"Det står Delfaktura: Fastighetsbeteckning saknas för ROT/RUT","svar":"Återbesöket är bokat men delfakturan skapades inte. Raderna ligger kvar. Fyll i Fastighetsbeteckning * under fliken Ekonomi och kryssa i vid nästa återbesök, eller låt raderna komma med när ärendet avslutas."},
      {"fraga":"Jag glömde kryssa i","svar":"Inget försvinner. Raderna ligger kvar och kommer med på nästa delfaktura eller på slutfakturan. Fakturan blir bara större."}
    ]},
    {"type":"bra","items":[
      "En delfaktura tar alla ofakturerade rader på ärendet, oavsett hur många besök de kommer från.",
      "En faktura per månad: kryssa inte i vid besöken mitt i månaden. Kryssa i vid månadens sista besök, så kommer hela månaden med.",
      "Det sista besöket behöver inget kryss. När du avslutar ärendet blir resten slutfakturan.",
      "Har ärendet ett anpassat pris för hela jobbet går det inte att delfakturera. Rutan är grå och priset faktureras en gång, när ärendet avslutas. Fasta priser från kundens prislista på raderna är inte anpassat pris och spärrar inget.",
      "Det går inte att delfakturera utan att boka ett återbesök. Ska inget mer besök bokas avslutar du ärendet i stället."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården vill ha en faktura per månad. Du är där 2026-10-13 och 2026-10-27, som är oktobers sista besök. Boka återbesöken klockan 08:00 så att hela oktober blir en faktura."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden vill ha en faktura per månad och det är mitt i månaden. Vad gör du med Skapa delfaktura?","alternativ":["Kryssar i","Lämnar den tom","Avslutar ärendet"],"ratt":1,"forklaring":"Raderna ligger kvar och kommer med när du kryssar i vid månadens sista besök."},
      {"fraga":"Rutan Skapa delfaktura för nuvarande tjänster är grå och det står att ärendet har ett anpassat pris för hela jobbet. Vad gör du?","alternativ":["Ber kontoret ta bort priset så att du kan kryssa i","Bokar återbesöket utan delfaktura","Avslutar ärendet i stället"],"ratt":1,"forklaring":"Det anpassade priset gäller hela ärendet och faktureras en gång, när ärendet avslutas. Återbesöket bokar du som vanligt."},
      {"fraga":"Du kryssade i Skapa delfaktura och bokade. Vad händer med raderna?","alternativ":["De faktureras och försvinner från ärendet","De ligger kvar och faktureras igen vid avslut","De flyttas till nästa besök"],"ratt":0,"forklaring":"Raderna räknas som fakturerade och kan inte komma med igen. Nästa besök börjar från noll."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Nästa besök i samma ärende, steg för steg."},
      {"slug":"guide-fakturering","label":"Fyll i fakturaraderna","description":"Tjänster, ROT och artiklar under fliken Ekonomi."}
    ],"fraga":"Kontoret, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 30, now(), array['technician']
),
(
  'guide-aterbesok-kontor',
  'Boka ett återbesök',
  'Boka nästa besök i samma ärende från datorn, och skapa en delfaktura om kunden ska betala det som är gjort.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Ärenden › ärendet › fotspåren uppe till höger","tar":"3 min","behover":"Ett privat- eller företagsärende med adress","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna ärendet, tryck på fotspåren och välj [[Boka återbesök]]. Välj datum, tryck [[Visa förslag →]] och välj en tid. Ska det som är gjort faktureras nu kryssar du i Skapa delfaktura för nuvarande tjänster innan du bokar."},
    {"type":"visning","steg":[
      {"text":"Gå till Ärenden i menyn och tryck på ärendet i listan.","ser":"Ärendet öppnas."},
      {"text":"Tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Boka återbesök]].","ser":"Du ser Välj datum och längd."},
      {"text":"Välj datum och besökslängd. Tryck [[Visa förslag →]].","ser":"Portalen hämtar lediga tider för teknikerna på ärendet. Har ärendet flera tekniker väljer du först vilka som ska med."},
      {"text":"Tryck på den tid som passar.","ser":"Tiden blir markerad."},
      {"text":"Ska det som är gjort faktureras nu? Kryssa i Skapa delfaktura för nuvarande tjänster.","ser":"Raderna och Totalt (exkl. moms) visas. Lämna rutan tom om kunden ska faktureras senare."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat! eller Återbesök bokat och delfaktura med fakturanumret. Ärendet får status Återbesök."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Är ärendet ett följeärende? Då bokar du återbesöket i huvudärendet."},
      {"fraga":"Det står Ärendet saknar adress","svar":"Portalen kan inte föreslå tider utan adress. Tryck [[Ange tid manuellt istället]] och välj tiden själv, eller lägg in adressen i ärendet först."},
      {"fraga":"Det står Inga lediga tider hittades från detta datum. Prova ett annat datum.","svar":"Tryck [[← Byt datum]] och välj ett annat datum, eller välj färre tekniker."},
      {"fraga":"Det står Kunde inte hämta schemaförslag","svar":"Förslagen gick inte att hämta just nu. Prova igen om en stund. Fungerar det inte, skriv i Teams-chatten Systemet."},
      {"fraga":"Det står Delfaktura: följt av ett fel","svar":"Återbesöket är bokat men delfakturan skapades inte. Raderna ligger kvar på ärendet. Rätta felet, till exempel en saknad fastighetsbeteckning, och fakturera vid nästa återbesök eller när ärendet avslutas."}
    ]},
    {"type":"bra","items":[
      "Lördag och söndag går inte att välja som datum.",
      "Avtalsärenden har en egen ruta. Där väljer du Start * och Slut (valfritt) själv, och merförsäljning delfaktureras med Delfakturera dessa artiklar nu.",
      "Delfakturan hamnar under Fakturering › Privat & Företag och är märkt Delfaktura.",
      "Summerar raderna till 0 kr skapas ingen delfaktura. Återbesöket bokas ändå.",
      "Har ärendet ett anpassat pris för hela jobbet är rutan Skapa delfaktura för nuvarande tjänster grå och går inte att kryssa i. Det anpassade priset faktureras när ärendet avslutas."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har fått första behandlingen mot vägglöss. Boka nästa besök onsdag 2026-10-21 på förmiddagen och skapa en delfaktura för det som är gjort."},
    {"type":"quiz","fragor":[
      {"fraga":"Förslagen visar Inga lediga tider hittades. Vad gör du först?","alternativ":["Skapar ett nytt ärende","Byter datum eller väljer färre tekniker","Bokar utan tid"],"ratt":1,"forklaring":"De valda teknikerna är upptagna den dagen. Ett annat datum eller färre tekniker ger nya förslag."},
      {"fraga":"Var hamnar delfakturan?","alternativ":["Under Fakturering › Privat & Företag","Under Fakturering › Merförsäljning Avtal","Direkt hos kunden"],"ratt":0,"forklaring":"Den går samma väg som andra fakturor: granskning, Fortnox och sedan kunden."},
      {"fraga":"Rutan Skapa delfaktura för nuvarande tjänster är grå. Varför?","alternativ":["Ärendet har ett anpassat pris för hela jobbet","Kunden har fasta priser i sin prislista","Ärendet saknar adress"],"ratt":0,"forklaring":"Det anpassade priset gäller hela ärendet och faktureras när ärendet avslutas. Fasta priser från prislistan spärrar inte delfakturan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-fakturering-kontor","label":"Fakturera från ärende till betalning","description":"Godkänn, skapa utkast i Fortnox och följ fakturan till betald."},
      {"slug":"guide-schemavyn","label":"Schemavyn","description":"Vyer, sök, filter och drag och släpp i schemat."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 33, now(), array['admin','koordinator']
),
(
  'guide-aterbesok',
  'Boka ett återbesök',
  'Boka nästa besök i samma ärende från telefonen, och fakturera det som är gjort om kunden ska betala nu.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren uppe till höger","tar":"4 min","behover":"Ett privat- eller företagsärende med adress","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på fotspåren i ärendet, välj [[Boka återbesök]] och välj en av tiderna portalen föreslår. Ska det som är gjort faktureras nu kryssar du i Skapa delfaktura innan du bokar."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Boka återbesök]].","ser":"Du ser Välj datum och längd."},
      {"text":"Välj datum, besökslängd och tekniker. Tryck [[Visa förslag →]].","ser":"Portalen hämtar tider där alla valda tekniker är lediga samtidigt."},
      {"text":"Tryck på den tid som passar.","ser":"Tiden blir grön."},
      {"text":"Ska det som är gjort faktureras nu? Kryssa i Skapa delfaktura för nuvarande tjänster.","ser":"Raderna och summan visas under rutan. Lämna den tom om kunden ska faktureras senare."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat! och ärendet får status Återbesök."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Är ärendet ett följeärende? Då bokar du återbesöket i huvudärendet."},
      {"fraga":"Det står Ärendet saknar adress","svar":"Portalen kan inte föreslå tider utan adress. Tryck [[Ange tid manuellt istället]] och välj tiden själv, eller lägg in adressen i ärendet först."},
      {"fraga":"Det står Inga lediga tider hittades","svar":"De valda teknikerna är upptagna. Gå tillbaka och välj ett annat datum, eller färre tekniker."},
      {"fraga":"Rutan Skapa delfaktura syns inte eller är grå","svar":"Står det Inga ofakturerade tjänster på ärendet fyller du i Tjänster & fakturarader först, eller bokar utan delfaktura. Är rutan grå har ärendet ett anpassat pris för hela jobbet. Då bokar du utan delfaktura, och priset faktureras när ärendet avslutas."},
      {"fraga":"Det står Besökshistoriken kunde inte sparas","svar":"Återbesöket är bokat, men besöket du just gjorde kom inte med i historiken. Skriv till admin och ange ärendenumret."}
    ]},
    {"type":"bra","items":[
      "Det är samma ärende som fortsätter. Status blir Återbesök.",
      "Besöket du just gjorde sparas i ärendehistoriken, klockan uppe till höger.",
      "Ett nytt skadedjur hos samma kund är ett nytt ärende, inte ett återbesök.",
      "Kryssar du inte i Skapa delfaktura ligger raderna kvar och kommer med på nästa faktura.",
      "I avtalsärenden ser bokningen annorlunda ut. Det finns en egen guide för det."
    ]},
    {"type":"ovning","uppdrag":"Första besöket hos Familjen Exempel är gjort. Boka ett återbesök tisdag morgon och fakturera det som är gjort hittills."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har haft råttor och har nu också fått getingar. Vad gör du?","alternativ":["Bokar ett återbesök i råttärendet","Skapar ett nytt ärende","Duplicerar råttärendet"],"ratt":1,"forklaring":"Getingarna är ett nytt problem och får ett eget ärende. Återbesök är för samma problem."},
      {"fraga":"Det står Ärendet saknar adress när du ska få förslag. Vad gör du?","alternativ":["Avbryter och ringer kontoret","Trycker Ange tid manuellt istället","Väljer en annan tekniker"],"ratt":1,"forklaring":"Utan adress kan portalen inte räkna fram tider, men du kan välja tiden själv."},
      {"fraga":"Du lämnar Skapa delfaktura tom. Vad händer med fakturaraderna?","alternativ":["De försvinner","De ligger kvar och kommer med på nästa faktura","Kunden faktureras direkt ändå"],"ratt":1,"forklaring":"Ingenting försvinner. Raderna följer med nästa delfaktura eller slutfakturan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort, eller en gång per månad."},
      {"slug":"guide-aterbesok-avtal","label":"Boka ett återbesök i ett avtalsärende","description":"Avtalsärenden och kontrollrundor."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 31, now(), array['technician']
),
(
  'guide-dokumentsignering-tekniker',
  'Skicka en offert från ärendet',
  'Gör en offert av tjänsterna i ärendet, granska Oneflows PDF och skicka den till kunden direkt från telefonen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › kvittot uppe till höger","tar":"3 min","behover":"Ett privat- eller företagsärende med kontaktperson, e-post och tjänster med pris","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på kvittot i ärendet. Kund, tjänster och offertinnehåll hämtas från ärendet. Läs texten, tryck [[Granska offerten →]] och sedan [[Skapa och visa Oneflows PDF]]. Ser PDF:en rätt ut trycker du [[Skicka offerten]]. Inget går till kunden innan dess."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på kvittot uppe till höger. På en större skärm står det [[Offert]] bredvid.","ser":"Offertguiden öppnas på steget Offertinnehåll, Steg 6 av 7. Det står Kundinformation förifylld från ärende! (Offert). I rutan står redan Tjänster som ingår: och en rad per tjänst i ärendet."},
      {"text":"Läs texten i rutan. Skriv gärna till med egna ord, till exempel var boet sitter. Tryck [[Granska offerten →]].","ser":"Granska offerten visas: kund, offertinnehåll, pris och Kontroll före utskick."},
      {"text":"Läs igenom. Bläddra ner och tryck [[Skapa och visa Oneflows PDF]].","ser":"Offerten skapas som utkast i Oneflow och du ser Så här ser kunden offerten. Inget är skickat än."},
      {"text":"Bläddra igenom PDF:en. Stämmer allt, tryck [[Skicka offerten]] under Ser allt rätt ut?","ser":"Det står Offerten är skickad. Efter en stund kommer du till Dokumentsignering."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står att ärendet saknar prissatta tjänster","svar":"Guiden öppnas på steget Tjänster. Lägg till tjänsterna med pris där och tryck [[Nästa]]. Offertinnehållet skrivs från tjänsterna du lägger till. Du kan också gå tillbaka till ärendet och lägga in dem under fliken Ekonomi."},
      {"fraga":"Guiden börjar på Välj mall i stället för Offertinnehåll","svar":"Kontaktperson eller e-post saknas i ärendet. Mallen är redan vald. Tryck [[Nästa]] tills du kommer till Motpart och fyll i det som saknas."},
      {"fraga":"Det står att ärendet har både ROT och RUT","svar":"En offert kan bara ha ett avdrag. Ingen offert skapades. Säg till koordinatorn att ärendet behöver delas upp."},
      {"fraga":"Det står Rätta de röda punkterna först, eller en punkt är gul","svar":"En röd punkt stoppar. Tryck på länken under punkten, till exempel Rätta under Motpart, och rätta. Gula punkter stoppar inte men ska läsas. Står det Kontrollera offertinnehållet har offerten avtalets standardtext om betesstationer. Tryck Fyll i under Offertinnehåll och sedan [[Skriv förslag från tjänsterna]]."},
      {"fraga":"Det står PDF:en är inte klar ännu","svar":"Oneflow håller på att skapa PDF:en. Vänta en stund och tryck [[Försök igen]]."}
    ]},
    {"type":"bra","items":[
      "Mallen väljs efter ärendet: privatperson, ROT, RUT eller företag. För en privatperson står priset inkl. moms, för ett företag exkl. moms.",
      "Offerten skickas från info@begone.se till kontaktpersonens e-post. Adressen står under knappen innan du skickar.",
      "Kan du inte skicka nu? Tryck [[Spara som utkast]]. Den ligger kvar under Dokumentsignering och du skickar den därifrån senare.",
      "När offerten är skickad får ärendet status Offert skickad.",
      "Under Dokumentsignering i menyn ser du bara dina egna offerter och avtal."
    ]},
    {"type":"ovning","uppdrag":"Anna Exempel vill ha pris på att ta bort ett getingbo innan jobbet görs. Tjänsten och priset ligger redan i ärendet. Skicka en offert till henne."},
    {"type":"quiz","fragor":[
      {"fraga":"Under Kontroll före utskick står Kontrollera offertinnehållet med en gul punkt. Vad gör du?","alternativ":["Skickar ändå, gul stoppar inte","Trycker Fyll i under Offertinnehåll, sedan Skriv förslag från tjänsterna, och läser igenom","Avbryter och ringer kontoret"],"ratt":1,"forklaring":"Offerten har avtalets standardtext om betesstationer och avtalskontroller. Kunden ska läsa vad just det här jobbet omfattar."},
      {"fraga":"Du har tryckt Skapa och visa Oneflows PDF. Har kunden fått offerten?","alternativ":["Ja, direkt","Nej, inte förrän du trycker Skicka offerten","Ja, när koordinatorn godkänt den"],"ratt":1,"forklaring":"Först skapas ett utkast. Kunden får ingenting förrän du har sett PDF:en och tryckt Skicka offerten."},
      {"fraga":"Kunden vill vänta med offerten till i morgon. Vad gör du?","alternativ":["Trycker Spara som utkast","Trycker Ändra i wizarden","Stänger telefonen"],"ratt":0,"forklaring":"Utkastet ligger kvar under Dokumentsignering. Ändra i wizarden tar bort utkastet i Oneflow."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Tjänsterna och priset som offerten bygger på."},
      {"slug":"guide-leads-tekniker","label":"Tipsa om en lead","description":"När kunden behöver mer hjälp än ett jobb."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 67, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
