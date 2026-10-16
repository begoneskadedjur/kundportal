-- Guidemallen (godkänd 2026-10-16): återbesök och fakturering.
-- Guidemoduler: src/pages/shared/intranet/guider/<slug>.tsx (visning + övning),
-- delade delar i guider/_fakturering.tsx.
--   guide-delfakturering       Delfakturera ett ärende                 tekniker, mobil (skrivs om)
--   guide-aterbesok-avtal      Boka ett återbesök i ett avtalsärende   tekniker, mobil (ny)
--   guide-aterbesok-kontor     Boka ett återbesök                      kontor, dator (ny)
--   guide-fakturering          Fyll i fakturaraderna                   tekniker, mobil (skrivs om)
--   guide-fakturering-kontor   Fakturera från ärende till betalning    kontor, dator (skrivs om)
-- Idempotent: on conflict skriver om guiden.

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
      {"fraga":"Det står Underlaget är 0 kr, ingen delfaktura skapad","svar":"Raderna summerar till 0 kr. Då blir det ingen faktura, men återbesöket är bokat."},
      {"fraga":"Det står Delfaktura: Fastighetsbeteckning saknas för ROT/RUT","svar":"Återbesöket är bokat men delfakturan skapades inte. Raderna ligger kvar. Fyll i Fastighetsbeteckning * under fliken Ekonomi och kryssa i vid nästa återbesök, eller låt raderna komma med när ärendet avslutas."},
      {"fraga":"Jag glömde kryssa i","svar":"Inget försvinner. Raderna ligger kvar och kommer med på nästa delfaktura eller på slutfakturan. Fakturan blir bara större."}
    ]},
    {"type":"bra","items":[
      "En delfaktura tar alla ofakturerade rader på ärendet, oavsett hur många besök de kommer från.",
      "En faktura per månad: kryssa inte i vid besöken mitt i månaden. Kryssa i vid månadens sista besök, så kommer hela månaden med.",
      "Det sista besöket behöver inget kryss. När du avslutar ärendet blir resten slutfakturan.",
      "Har ärendet ett anpassat pris ska du inte delfakturera. Det anpassade priset gäller hela ärendet och skulle komma med på varje faktura. Ta det med kontoret.",
      "Det går inte att delfakturera utan att boka ett återbesök. Ska inget mer besök bokas avslutar du ärendet i stället."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården vill ha en faktura per månad. Du är där 2026-10-13 och 2026-10-27, som är oktobers sista besök. Boka återbesöken klockan 08:00 så att hela oktober blir en faktura."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden vill ha en faktura per månad och det är mitt i månaden. Vad gör du med Skapa delfaktura?","alternativ":["Kryssar i","Lämnar den tom","Avslutar ärendet"],"ratt":1,"forklaring":"Raderna ligger kvar och kommer med när du kryssar i vid månadens sista besök."},
      {"fraga":"Ärendet har ett anpassat pris. Ska du delfakturera?","alternativ":["Ja, vid varje återbesök","Nej, ta det med kontoret","Bara om kunden ber om det"],"ratt":1,"forklaring":"Det anpassade priset gäller hela ärendet och skulle hamna på varje faktura."},
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
  'guide-aterbesok-avtal',
  'Boka ett återbesök i ett avtalsärende',
  'Boka nästa besök i ett avtalsärende från telefonen, och fakturera merförsäljning direkt om kunden ska betala nu.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren uppe till höger","tar":"3 min","behover":"Ett avtalsärende som du har öppnat från schemat","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på fotspåren i avtalsärendet, välj [[Boka återbesök]] och ändra Start * till den nya tiden. Har du sålt något utöver avtalet kan du kryssa i Delfakturera dessa artiklar nu innan du bokar."},
    {"type":"visning","steg":[
      {"text":"Tryck på fotspåren uppe till höger i avtalsärendet.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Boka återbesök]].","ser":"Rutan Boka återbesök öppnas. I Start * står ärendets nuvarande tid."},
      {"text":"Tryck på Start * och välj nytt datum och ny tid.","ser":"Den nya tiden står i fältet."},
      {"text":"Tryck på Slut (valfritt) och välj när besöket slutar.","ser":"Lämnar du fältet tomt slutar besöket samma minut som det börjar."},
      {"text":"Har du sålt något utöver avtalet som ska faktureras nu? Kryssa i Delfakturera dessa artiklar nu under Tillagda artiklar.","ser":"Det står Artiklarna skickas till fakturering och rensas från ärendet. Lämna rutan tom om det ska faktureras när ärendet avslutas."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat! Du kan boka fler återbesök. Bokningen syns under Tidigare återbesök och ärendet får status Återbesök."},
      {"text":"Tryck på krysset uppe till höger i rutan.","ser":"Du är tillbaka i ärendet med den nya tiden."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inte Boka återbesök, bara Lägg till delbesök","svar":"Då är du i en rondering. Där bokar du ett delbesök i stället för ett återbesök."},
      {"fraga":"Rutan Tillagda artiklar syns inte","svar":"Den syns bara när ärendet har en ofakturerad rad under Tjänster & fakturarader och en artikel under Interna kostnader som är kopplad till tjänsten i Prisguiden. Annars finns inget att delfakturera."},
      {"fraga":"Det står Motivera rabatten på ... under Tjänster & fakturarader innan delfakturering.","svar":"En rad har rabatt. Öppna fliken Ekonomi och skriv i Motivering till rabatt (krävs vid avslut). Boka sedan igen."},
      {"fraga":"Det står ... har kundpris men ingen tjänst att faktureras på","svar":"En artikel med kundpris saknar tjänst. Koppla den mot en tjänst i [[Prisguide|allman.kalkyl]] under fliken Ekonomi och boka igen."},
      {"fraga":"Det står Raderna sparades men fakturan kunde inte skapas","svar":"Återbesöket är bokat men fakturan saknas. Skriv till admin och ange ärendenumret."}
    ]},
    {"type":"bra","items":[
      "Själva kontrollen faktureras inte. Den ingår i avtalet och täcks av årspremien.",
      "Bara det du har sålt utöver avtalet delfaktureras. Fakturan hamnar hos kontoret under Merförsäljning Avtal.",
      "Kryssar du inte i följer merförsäljningen med när ärendet avslutas.",
      "Rutan stängs inte efter bokningen. Trycker du [[Boka återbesök]] igen bokar du ett återbesök till.",
      "Har du skrivit arbetsrapport sparas besöket i besökshistoriken, klockan uppe till höger."
    ]},
    {"type":"ovning","uppdrag":"Kontrollen hos Exempel AB är gjord och du har monterat två extra råttfällor som kunden har köpt. Boka återbesöket tisdag 2026-10-27 08:00 till 09:00 och fakturera fällorna nu."},
    {"type":"quiz","fragor":[
      {"fraga":"Du öppnar Boka återbesök och trycker direkt på Boka återbesök utan att ändra något. Vad händer?","alternativ":["Portalen ber dig välja datum","Återbesöket bokas på samma tid som det nuvarande besöket","Ingenting händer"],"ratt":1,"forklaring":"Start * är redan ifylld med ärendets nuvarande tid. Ändra den alltid först."},
      {"fraga":"Vad faktureras när du kryssar i Delfakturera dessa artiklar nu?","alternativ":["Hela avtalsbesöket","Det du har sålt utöver avtalet","Årspremien för nästa period"],"ratt":1,"forklaring":"Besök som ingår i avtalet faktureras aldrig. Bara merförsäljningen går till fakturering."},
      {"fraga":"Du har bokat och rutan är fortfarande öppen. Vad gör du?","alternativ":["Trycker Boka återbesök igen för säkerhets skull","Stänger rutan med krysset","Trycker Avbryt för att ångra"],"ratt":1,"forklaring":"Bokningen är klar. Trycker du igen bokar du ett återbesök till."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Privat- och företagsärenden, med förslag på tider."},
      {"slug":"guide-fakturering","label":"Fyll i fakturaraderna","description":"Tjänster, artiklar och merförsäljning under fliken Ekonomi."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 32, now(), array['technician']
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
      "Har ärendet ett anpassat pris ska du inte delfakturera. Det anpassade priset gäller hela ärendet."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har fått första behandlingen mot vägglöss. Boka nästa besök onsdag 2026-10-21 på förmiddagen och skapa en delfaktura för det som är gjort."},
    {"type":"quiz","fragor":[
      {"fraga":"Förslagen visar Inga lediga tider hittades. Vad gör du först?","alternativ":["Skapar ett nytt ärende","Byter datum eller väljer färre tekniker","Bokar utan tid"],"ratt":1,"forklaring":"De valda teknikerna är upptagna den dagen. Ett annat datum eller färre tekniker ger nya förslag."},
      {"fraga":"Var hamnar delfakturan?","alternativ":["Under Fakturering › Privat & Företag","Under Fakturering › Merförsäljning Avtal","Direkt hos kunden"],"ratt":0,"forklaring":"Den går samma väg som andra fakturor: granskning, Fortnox och sedan kunden."},
      {"fraga":"Kunden har ett anpassat pris på hela ärendet. Ska du delfakturera?","alternativ":["Ja, vid varje återbesök","Nej, ta det när ärendet avslutas","Ja, men bara en gång"],"ratt":1,"forklaring":"Det anpassade priset gäller hela ärendet och skulle komma med på varje delfaktura."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-fakturering-kontor","label":"Fakturera från ärende till betalning","description":"Godkänn, skapa utkast i Fortnox och följ fakturan till betald."},
      {"slug":"guide-schemavyn","label":"Schemavyn","description":"Vyer, sök, filter och drag och släpp i schemat."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 33, now(), array['admin','koordinator']
),
(
  'guide-fakturering',
  'Fyll i fakturaraderna',
  'Fakturan byggs av det du fyller i under fliken Ekonomi. Så lägger du till tjänster, ROT och artiklar innan du avslutar.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fliken Ekonomi","tar":"5 min","behover":"Ett ärende där jobbet är gjort","enhet":"mobil"},
    {"type":"kortsvar","text":"Fyll i Tjänster & fakturarader under fliken Ekonomi, lägg in det du har använt under Interna kostnader och avsluta ärendet. Det du fyller i blir fakturan, kontoret skickar den."},
    {"type":"visning","steg":[
      {"text":"Tryck på fliken Ekonomi.","ser":"Du ser Tjänster & fakturarader. Huvudtjänsten ligger redan där med sitt pris."},
      {"text":"Tryck [[Lägg till tilläggstjänst|allman.plus]] och tryck på tjänsten du har gjort.","ser":"Det står till exempel Tätning av ventil tillagd, och raden syns i listan."},
      {"text":"Ska en privatkund ha ROT eller RUT? Tryck [[Dela upp för ROT/RUT|allman.kalkyl]] under tjänsten.","ser":"En ruta öppnas där du anger hur mycket av priset som är arbete."},
      {"text":"Skriv Varav arbetskostnad och Timmar, välj ROT eller RUT och tryck [[Dela upp]].","ser":"Under tjänsten står Varav arbetskostnad. Summan visar avdraget och Att betala (kund)."},
      {"text":"Tryck i fältet Fastighetsbeteckning * och skriv fastighetsbeteckningen.","ser":"Utan den går ärendet inte att spara."},
      {"text":"Tryck på Interna kostnader och tryck på artiklarna du har använt.","ser":"Artikeln läggs till med sitt inköpspris. Den syns inte på fakturan men ger rätt marginal."},
      {"text":"När jobbet är klart: tryck Avslutat i statusraden överst och tryck [[Spara ändringar]].","ser":"Ärendet avslutas och fakturan skapas av raderna. Kontoret tar den vidare."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag kan inte ändra priset","svar":"Står det Fast pris eller Låst av avtal kommer priset från kundens prislista eller avtal. Det ändras inte i ärendet."},
      {"fraga":"Jag ser inget ROT-val","svar":"ROT och RUT finns bara i privatärenden. På en arbetstidstjänst väljer du ROT eller RUT direkt på raden. På andra tjänster trycker du [[Dela upp för ROT/RUT]]."},
      {"fraga":"Det står Fastighetsbeteckning krävs för ROT/RUT på: ... Fyll i den innan du sparar.","svar":"Skriv fastighetsbeteckningen i fältet Fastighetsbeteckning * under raden med avdraget och spara igen."},
      {"fraga":"Det står Motivera rabatten på ... under Tjänster & fakturarader innan ärendet avslutas","svar":"Skriv varför i Motivering till rabatt (krävs vid avslut) på raden med rabatt och spara igen."},
      {"fraga":"Det står Ett ärende kan inte ha både ROT och RUT","svar":"Ta bort det ena avdraget. Behövs båda ska det vara två ärenden. Fråga kontoret."}
    ]},
    {"type":"bra","items":[
      "Privatärenden visar priserna inkl. moms. Företag och avtal visar exkl. moms.",
      "Avtalskunder: står det Ingår i avtalet på raden täcks den av årspremien och faktureras inte.",
      "Merförsäljning hos en avtalskund lägger du till som tilläggstjänst. Kundens prislista styr priset och kontoret fakturerar det skilt från premien.",
      "[[Lägg till i avtalet]] på en rad i ett avtalsärende höjer kundens årspremie. Använd den bara när det är överenskommet med kunden.",
      "ROT- och RUT-avdraget ligger alltid på arbetet, aldrig på material. Totalen mot kunden ändras inte av uppdelningen."
    ]},
    {"type":"ovning","uppdrag":"Du har bekämpat råttor hos Familjen Exempel och tätat en ventil. Tätningen kostar 1 250 kr och 1 000 kr av det är arbete, en timme. Familjen ska ha ROT och fastigheten heter Exempelby 1:23. Du använde en snapfälla. Fyll i och avsluta ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Var lägger du in snapfällan du använde?","alternativ":["Som tilläggstjänst","Under Interna kostnader","I arbetsrapporten"],"ratt":1,"forklaring":"Interna kostnader syns inte på fakturan men ger rätt marginal."},
      {"fraga":"En privatkund ska ha ROT på en tätning där material ingår. Vad gör du?","alternativ":["Väljer ROT på hela raden","Trycker Dela upp för ROT/RUT och anger arbetskostnaden","Sänker priset med 30 %"],"ratt":1,"forklaring":"Avdraget får bara ligga på arbetet. Uppdelningen gör en egen rad för arbetet som bär avdraget."},
      {"fraga":"En rad i ett avtalsärende säger Ingår i avtalet. Vad betyder det?","alternativ":["Den faktureras när ärendet avslutas","Den täcks av årspremien och faktureras inte","Du måste lägga till den i avtalet"],"ratt":1,"forklaring":"Det som ingår i avtalet betalar kunden redan genom årspremien."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort, eller en gång per månad."},
      {"slug":"guide-aterbesok-avtal","label":"Boka ett återbesök i ett avtalsärende","description":"Och delfakturera merförsäljning."}
    ],"fraga":"Kontoret, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 34, now(), array['technician']
),
(
  'guide-fakturering-kontor',
  'Fakturera från ärende till betalning',
  'Sidan Fakturering steg för steg: granska, godkänn, skapa utkast i Fortnox och följ fakturan till betald, även delfakturor.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Fakturering i menyn","tar":"6 min","behover":"Behörigheten faktureringsansvarig för att godkänna","enhet":"dator"},
    {"type":"kortsvar","text":"Fakturor som behöver dig ligger i arbetskön överst på sidan Fakturering. Godkänn de som har rabatt, tryck [[Skapa utkast i Fortnox]] och bokför och skicka i Fortnox. Statusen följer sedan med till portalen."},
    {"type":"visning","steg":[
      {"text":"Öppna Fakturering i menyn och tryck på Kräver godkännande i arbetskön.","ser":"Listan visar bara fakturor som väntar på godkännande. Det är fakturor med rabatt."},
      {"text":"Tryck på ögat längst till höger på raden.","ser":"Fakturan öppnas. En delfaktura är märkt ◔ Delfaktura, och Ärendets fakturakedja visar ärendets alla fakturor."},
      {"text":"Läs Att granska innan godkännande och tryck [[Godkänn|allman.bock]].","ser":"Det står Faktura godkänd inkl. rabatt. Status blir Redo för Fortnox."},
      {"text":"Tryck [[Skapa utkast i Fortnox]].","ser":"Det står Utkast skapat i Fortnox med numret. Status blir Utkast i Fortnox."},
      {"text":"Tryck [[Fortnox (nr 1234)]] och bokför och skicka fakturan i Fortnox.","ser":"Fortnox öppnas i en ny flik. I portalen blir statusen Bokförd och sedan Skickad."},
      {"text":"Stäng fakturan och tryck [[Arkiv]].","ser":"Arkivet visar bokförda, skickade och betalda fakturor. När kunden har betalat står det Betald."},
      {"text":"Tryck på fliken Merförsäljning Avtal.","ser":"Här ligger extraarbeten hos avtalskunder. En gul ruta Ofakturerad merförsäljning betyder att en faktura inte skapades. Tryck [[Skapa faktura]] i rutan."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Godkänn går inte att trycka på","svar":"Det står Endast faktureringsansvarig kan godkänna. Låt en faktureringsansvarig godkänna, eller be admin om behörigheten."},
      {"fraga":"Skapa utkast i Fortnox är låst","svar":"Fakturan väntar på godkännande. Knappen är låst tills fakturan godkänts av faktureringsansvarig."},
      {"fraga":"Det står Kunden saknar kundnummer","svar":"Lägg till kundnumret på kundkortet och tryck [[Skapa utkast i Fortnox]] igen."},
      {"fraga":"Det står Fakturan finns redan i Fortnox","svar":"Skicka inte igen. Tryck [[Synka]] i fakturan för att hämta dess status."},
      {"fraga":"Statusen har inte ändrats efter bokföringen i Fortnox","svar":"Öppna fakturan och tryck [[Synka]]."}
    ]},
    {"type":"bra","items":[
      "Fliken avgör sorten: Privat & Företag är engångsärenden och delfakturor, Avtalskunder är årspremierna per period och Merförsäljning Avtal är extraarbeten hos avtalskunder.",
      "Fakturor utan rabatt hoppar över godkännandet och börjar som Redo för Fortnox.",
      "[[Till Fortnox]] uppe till höger laddar ner en exportfil med fakturorna som är Redo för Fortnox. Den skapar inga utkast.",
      "Ärendets fakturakedja visar alla fakturor på ärendet, rader som inte är fakturerade än och raden Slutfaktura, som skapas när ärendet avslutas.",
      "Provisionen för ett besök frigörs när fakturan som täcker besöket är betald."
    ]},
    {"type":"ovning","uppdrag":"En delfaktura till Familjen Exempel har rabatt och väntar på godkännande. Godkänn den och skapa utkastet i Fortnox."},
    {"type":"quiz","fragor":[
      {"fraga":"En faktura har status Kräver godkännande. Varför?","alternativ":["Kunden har inte betalat","En rad har rabatt","Fortnox svarar inte"],"ratt":1,"forklaring":"Rabatter godkänns av faktureringsansvarig innan fakturan kan gå till Fortnox."},
      {"fraga":"Vad gör Skapa utkast i Fortnox?","alternativ":["Skickar fakturan till kunden","Skapar ett utkast i Fortnox som inte är bokfört","Markerar fakturan som betald"],"ratt":1,"forklaring":"Bokföring och utskick gör du i Fortnox. Statusen följer sedan med till portalen."},
      {"fraga":"Hur känner du igen en delfaktura?","alternativ":["Det står ◔ Delfaktura i fakturans rubrik","Den ligger under Avtalskunder","Den har inget fakturanummer"],"ratt":0,"forklaring":"Delfakturor ligger under Privat & Företag och märks i rubriken. Fakturakedjan visar resten av ärendets fakturor."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok-kontor","label":"Boka ett återbesök","description":"Och skapa en delfaktura för det som är gjort."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 35, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
