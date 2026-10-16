-- Guidemallen (godkänd 2026-10-16), gruppen stationer, kontroller och tilläggsstationer.
-- Sex guider, en uppgift och en roll per guide:
--   guide-placera-stationer               tekniker, telefon
--   guide-kontrollrapport                 tekniker, telefon (ny)
--   guide-tillaggsstationer               tekniker, telefon (teknikerdelen av den gamla guiden)
--   guide-tillaggsstationer-koordinator   koordinator och admin, dator (ny)
--   guide-tillaggsstationer-fakturering   admin och koordinator, dator (ny)
--   guide-aterkommande-schema             admin och koordinator, dator
-- Guidemoduler: src/pages/shared/intranet/guider/<slug>.tsx, delade delar i _stationer.tsx.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-placera-stationer',
  'Placera en station eller fälla',
  'Sätt ut stationer hos en avtalskund från telefonen, med typ, GPS-position och foto, och avsluta etableringen.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Etableringsärendet › [[Gå till utplacering]]","tar":"2 min per station","behover":"Ett öppet etableringsärende hos en avtalskund","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Gå till utplacering]] i etableringsärendet och välj Utomhus. Välj stationstyp, tryck Hämta GPS när du står vid stationen och tryck [[Skapa placering]]. När alla stationer står ute trycker du [[Färdig med etablering]]."},
    {"type":"visning","steg":[
      {"text":"Öppna etableringsärendet och tryck [[Gå till utplacering]].","ser":"Rutan Välj typ öppnas. Kunden är redan vald."},
      {"text":"Tryck Utomhus.","ser":"Formuläret Ny utrustningsplacering öppnas. Inomhus är för planritningen."},
      {"text":"Tryck på stationstypen under Utrustningstyp.","ser":"Typen blir grön. Mekanisk fälla kräver serienummer, de andra typerna gör det inte."},
      {"text":"Stå vid stationen och tryck Hämta GPS.","ser":"Det står GPS hämtad och hur noggrann positionen är."},
      {"text":"Tryck på fotorutan och fota stationen med omgivningen.","ser":"Bilden visas i formuläret. Foto och kommentar är valfria men hjälper nästa tekniker att hitta rätt."},
      {"text":"Tryck [[Skapa placering]].","ser":"Det står Station placerad! och hur många stationer du har placerat."},
      {"text":"Tryck Placera fler utomhus för nästa station. När alla står ute trycker du [[Färdig med etablering]].","ser":"Ärendet stängs. Saknar kunden återkommande schema frågar portalen om Återkommande kontroller."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Serienummer krävs för Mekanisk fälla","svar":"Mekaniska fällor måste ha serienummer. Skriv numret från fällan i fältet Serienummer och tryck [[Skapa placering]] igen."},
      {"fraga":"Det står GPS-position krävs","svar":"Positionen saknas. Tryck Hämta GPS, eller tryck Välj på karta, dra nålen till platsen och tryck [[Använd denna position]]."},
      {"fraga":"Noggrannheten står som Dålig!","svar":"Telefonen hittar inte GPS. Gå utomhus och prova igen, eller tryck Välj på karta och dra nålen till rätt plats."},
      {"fraga":"Det står Inga stationer har placerats i denna etablering ännu","svar":"Du tryckte Färdig med etablering eller krysset innan något var sparat. Tryck Avbryt så är ärendet fortfarande öppet, och placera stationerna först."},
      {"fraga":"Inomhus står det Inga planritningar","svar":"Kunden har ingen planritning än. Tryck [[Ladda upp planritning]] och välj bilden. Använd liggande format, bredare än högt."}
    ]},
    {"type":"bra","items":[
      "Inomhus placerar du på planritningen: tryck på plusknappen, välj typ, tryck på platsen i ritningen, tryck [[Bekräfta position]] och sedan [[Lägg till station]].",
      "Nästa station får samma typ, preparat och markering som den förra. Det står Kopierat från föregående station, och [[Rensa]] tar bort det.",
      "På kartan ser du alla kundens stationer, även kollegornas. Andra kunders stationer visas nedtonade, bara för orientering.",
      "Kunden ser stationstypen, aldrig produkten du valde.",
      "Är stationen ett tillägg utöver avtalet kryssar du i Tillägg utöver avtal. Det finns en egen guide för det."
    ]},
    {"type":"ovning","uppdrag":"Du är på etablering hos Exempel AB. Sätt ut en betongstation vid soptunnorna med GPS och foto, och avsluta etableringen."},
    {"type":"quiz","fragor":[
      {"fraga":"Du ska sätta ut en mekanisk fälla men [[Skapa placering]] sparar inte. Vad saknas troligen?","alternativ":["Ett foto","Serienumret","En kommentar"],"ratt":1,"forklaring":"Mekaniska fällor kräver serienummer. Foto och kommentar är valfria."},
      {"fraga":"Stationen står i ett garage och noggrannheten står som Dålig!. Vad gör du?","alternativ":["Sparar ändå","Trycker Välj på karta och drar nålen till rätt plats","Avbryter och ringer kontoret"],"ratt":1,"forklaring":"Med Välj på karta markerar du platsen själv när GPS:en inte räcker."},
      {"fraga":"Du har satt ut tre av fyra stationer och trycker [[Färdig med etablering]]. Vad händer?","alternativ":["Ärendet stängs","Portalen frågar efter den fjärde","Ingenting"],"ratt":0,"forklaring":"Ärendet stängs direkt. Tryck Placera fler utomhus tills alla står ute."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-tillaggsstationer","label":"Sätt ut en tilläggsstation","description":"Stationer som kunden betalar för utöver avtalet."},
      {"slug":"guide-kontrollrapport","label":"Mejla kontrollrapporten till kunden","description":"Efter kontrollrundan."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 40, now(), array['technician']
),
(
  'guide-kontrollrapport',
  'Mejla kontrollrapporten till kunden',
  'Klarmarkera kontrollrundan och skicka kontrollrapporten som PDF till kunden direkt från avtalsärendet.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Avtalsärendet › fliken Utförande › Kontrollrapport","tar":"1 min","behover":"En kontrollrunda där alla stationer är kontrollerade","enhet":"mobil"},
    {"type":"kortsvar","text":"Klarmarkera kontrollrundan först, annars syns ingen rapport. Öppna sedan avtalsärendet, gå till fliken Utförande och tryck [[Skicka till kund]] i rutan Kontrollrapport."},
    {"type":"visning","steg":[
      {"text":"Tryck på den gröna bocken uppe till höger i Stationskontroll.","ser":"Rutan Klarmarkera ärende? öppnas och visar hur många stationer som är kontrollerade."},
      {"text":"Tryck [[Ja, klarmarkera]].","ser":"Det står Inspektion avslutad! och ärendet får status Avslutat."},
      {"text":"Öppna avtalsärendet och tryck på fliken Utförande.","ser":"Rutan Kontrollrapport visar Kontrollrunda avslutad med datum och ditt namn."},
      {"text":"Tryck [[Skicka till kund]].","ser":"Fältet Mottagare är förifyllt med kundens e-post. Du kan skriva en annan adress."},
      {"text":"Tryck [[Skicka]].","ser":"Portalen frågar Skicka kontrollrapporten som PDF till och visar adressen."},
      {"text":"Tryck [[Bekräfta och skicka]].","ser":"Det står Kontrollrapporten skickad till och adressen."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Rutan Kontrollrapport syns inte","svar":"Rundan är inte klarmarkerad, eller så har den låsts upp igen med [[Lås upp]]. Öppna rundan med [[Gå till inspektion]] och klarmarkera den."},
      {"fraga":"[[Ja, klarmarkera]] går inte att trycka","svar":"Det står Du har inte inspekterat alla stationer ännu. Kontrollera stationerna som saknas först."},
      {"fraga":"Det står Kunden saknar kontakt-e-post i kundregistret, ange mottagare manuellt.","svar":"Skriv adressen själv i Mottagare. Be kontoret lägga in e-posten på kunden."},
      {"fraga":"Det står Ange en giltig e-postadress.","svar":"Adressen är felskriven. Rätta den så går det att trycka [[Skicka]]."},
      {"fraga":"Det står att rapporten är för stor för att skickas som bilaga","svar":"PDF:en är större än 8 MB. Tryck [[PDF]], ladda ned rapporten och dela den på annat sätt."}
    ]},
    {"type":"bra","items":[
      "Rapporten skickas som PDF från noreply@begone.se. Svarar kunden hamnar svaret hos info@begone.se.",
      "PDF:en skapas med karta och planritningar. Det kan ta upp till en halv minut.",
      "[[PDF]] och [[Excel]] laddar ned rapporten till telefonen, till exempel om du vill visa den på plats.",
      "Kontaktpersonens namn kommer med i hälsningen bara när du skickar till kundens egen adress.",
      "Låser du upp rundan igen försvinner rutan tills rundan är klarmarkerad på nytt."
    ]},
    {"type":"ovning","uppdrag":"Kontrollrundan hos Brf Exempelgården är klar. Klarmarkera den och mejla kontrollrapporten till förvaltaren, forvaltning@exempelgarden.se."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har kontrollerat alla stationer men ser ingen ruta Kontrollrapport i ärendet. Varför?","alternativ":["Kunden saknar e-post","Rundan är inte klarmarkerad","Rapporten har redan skickats"],"ratt":1,"forklaring":"Rutan visas först när kontrollrundan är avslutad."},
      {"fraga":"Förvaltaren ska ha rapporten, inte kontaktpersonen. Vad gör du?","alternativ":["Skickar till kunden och ber dem skicka vidare","Ändrar adressen i Mottagare innan du trycker Skicka","Det går inte"],"ratt":1,"forklaring":"Mottagaren är bara förifylld. Du kan skriva vilken adress som helst."},
      {"fraga":"Det står att rapporten är för stor. Vad gör du?","alternativ":["Skickar igen","Laddar ned PDF:en och delar den på annat sätt","Låser upp rundan"],"ratt":1,"forklaring":"Bilagor över 8 MB skickas inte. Nedladdningen fungerar ändå."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-placera-stationer","label":"Placera en station eller fälla","description":"Sätt ut stationer med GPS och foto."},
      {"slug":"guide-tillaggsstationer","label":"Sätt ut en tilläggsstation","description":"Stationer som kunden betalar för utöver avtalet."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 41, now(), array['technician']
),
(
  'guide-tillaggsstationer',
  'Sätt ut en tilläggsstation',
  'Markera en station som tillägg utöver avtalet, välj hur kunden betalar och svara på frågan om arbetstid när etableringen avslutas.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Utplaceringen › Ny utrustningsplacering › Tillägg utöver avtal","tar":"3 min","behover":"Kunden har bett om stationen utöver avtalet","enhet":"mobil"},
    {"type":"kortsvar","text":"Kryssa i Tillägg utöver avtal när du sätter ut stationen och välj hur den betalas, oftast per år. När du trycker [[Färdig med etablering]] svarar du på hur mycket arbetstid tilläggen tar per år."},
    {"type":"visning","steg":[
      {"text":"Fyll i typ, serienummer och position som vanligt. Tryck på Produkt och välj den fälla du satte ut.","ser":"Har typen bara en produkt är den redan vald. Kunden ser bara stationstypen."},
      {"text":"Kryssa i Tillägg utöver avtal.","ser":"Betalas visas med per år, per månad och per kontroll och kundens pris. Per år är förvalt när kunden har avtal och ett årspris."},
      {"text":"Tryck [[Skapa placering]].","ser":"Det står Station placerad!. Faktureringsansvarig får en notis om tillägget."},
      {"text":"Tryck [[Färdig med etablering]] när alla stationer står ute.","ser":"Rutan Stäng ärende och skicka följande för fakturering visar Arbetstid för att hantera tilläggen."},
      {"text":"Skriv i rutan hur många timmar per år tilläggen tar.","ser":"Under Så faktureras det ser du vad kunden betalar per år från avtalets nästa år."},
      {"text":"Tryck [[Stäng & fakturera]].","ser":"Det står Etablering avslutad och hur många rader som gick till fakturering."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Per år och per månad går inte att välja","svar":"Det står Kräver att kunden har ett avtal i avtalskartan. Välj per kontroll, eller fråga kontoret om kunden ska ha avtal."},
      {"fraga":"Det står pris saknas, eller Pris saknas för och stationstypen","svar":"Stationen sparas ändå men faktureras inte förrän priset finns. Säg till kontoret så lägger de in priset."},
      {"fraga":"Det står Ange arbetstiden i timmar per år. Skriv 0 om ingen extra tid behövs.","svar":"Frågan måste besvaras. Gör din bästa bedömning i hela eller halva timmar. Dina timmar är ett förslag som kontoret kan ändra."},
      {"fraga":"Stationstypen går inte att byta och Tillägg utöver avtal är grå","svar":"Det står Betald till och med och ett datum. Kunden har betalat för stationen, så typ och betalning är låsta. Ta bort stationen och placera en ny om något av det ska ändras."},
      {"fraga":"Det står Betald till och med när jag tar bort stationen","svar":"Kunden får ingen återbetalning. Behåll stationen om kunden inte uttryckligen vill ta bort den. Vill kunden det trycker du en gång till: Klicka igen för att ta bort, eller Ta bort ändå i kontrollrundan."}
    ]},
    {"type":"bra","items":[
      "Per år: kunden betalar för tiden kvar till avtalets nästa år och sedan årspriset på en egen faktura i samband med årsfakturan. Per månad: årspriset delat med tolv. Per kontroll: vid etableringen och vid varje kontrollrunda där stationen kontrolleras.",
      "Produkten är en intern kostnad. Byter du fälla senare väljer du den nya produkten i Redigera station.",
      "Har enheten redan tillägg är Nej förvalt i frågan om arbetstid. Välj Ja och skriv det nya totala antalet timmar om det behövs mer tid.",
      "Frågan om arbetstid kommer också när du klarmarkerar en kontrollrunda, om enheten har fått nya tillägg under ärendet.",
      "I kontrollrundan hämtar du upp en tilläggsstation med [[Hämta upp|station.hamtaupp]] och sedan [[Spara och hämta upp]]."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB vill ha en mekanisk fälla, Aurotrap Collect, utöver avtalet och betala per år. Sätt ut den, svara 1 timme per år på frågan om arbetstid och stäng ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden vill ha två extra fällor och betala en gång om året. Vad väljer du under Betalas?","alternativ":["per kontroll","per år","per månad"],"ratt":1,"forklaring":"Per år ger en egen faktura i samband med avtalets årsfaktura."},
      {"fraga":"Du vet inte exakt hur mycket arbetstid tilläggen tar. Vad gör du?","alternativ":["Hoppar över frågan","Skriver din bästa bedömning, eller 0 om ingen extra tid behövs","Lämnar ärendet öppet"],"ratt":1,"forklaring":"Frågan måste besvaras. Dina timmar är ett förslag som faktureringsansvarig kan ändra."},
      {"fraga":"En betald tilläggsstation ska bli en annan typ. Hur gör du?","alternativ":["Byter typ i Redigera station","Tar bort stationen och placerar en ny","Kryssar ur Tillägg utöver avtal"],"ratt":1,"forklaring":"Typ och betalning är låsta när kunden har betalat."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-placera-stationer","label":"Placera en station eller fälla","description":"Grunderna: typ, GPS och foto."},
      {"slug":"guide-kontrollrapport","label":"Mejla kontrollrapporten till kunden","description":"Efter kontrollrundan."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 42, now(), array['technician']
),
(
  'guide-tillaggsstationer-koordinator',
  'Boka etablering för tilläggsstationer',
  'Boka en Etablering Avtalskund på rätt enhet och skriv till teknikern vilka tilläggsstationer som ska ut.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["koordinator","admin"],"var":"[[Öppna schema]] › [[Nytt ärende]] › Etablering Avtalskund","tar":"3 min","behover":"Kunden finns i kundregistret som avtalskund","enhet":"dator"},
    {"type":"kortsvar","text":"Boka en Etablering Avtalskund på den enhet där stationerna ska stå. Skriv i Beskrivning till tekniker vilka tilläggsstationer som ska ut och hur kunden vill betala. Teknikern sätter ut dem och markerar dem som tillägg."},
    {"type":"visning","steg":[
      {"text":"Öppna schemat och tryck [[Nytt ärende]].","ser":"Menyn visar Engångsärenden och Avtalskunder."},
      {"text":"Tryck Etablering Avtalskund.","ser":"Rutan Ny etablering öppnas."},
      {"text":"Tryck i Välj avtalskund (nyetablering) och välj kunden.","ser":"Har kunden flera enheter visas fältet Välj anläggning/site."},
      {"text":"Välj enheten där stationerna ska stå.","ser":"Enhetens namn står i fältet."},
      {"text":"Fyll i Adress, Starttid och Sluttid och välj Ansvarig under Tekniker.","ser":"Fälten med stjärna måste vara ifyllda."},
      {"text":"Skriv i Beskrivning till tekniker hur många tilläggsstationer, vilken typ och hur kunden vill betala.","ser":"Teknikern ser texten i ärendet."},
      {"text":"Tryck [[Skapa & Boka Ärende]].","ser":"Det står Etablering inbokad för och enhetens namn."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Du måste välja en avtalskund","svar":"Kunden är inte vald. Tryck i Välj avtalskund (nyetablering) och välj kunden i listan."},
      {"fraga":"Det står Du måste välja en region för denna kund","svar":"Kunden har flera enheter. Välj enheten i Välj anläggning/site, även om meddelandet säger region."},
      {"fraga":"Enheten finns inte i kundlistan","svar":"Listan visar bara huvudkunden. Välj den, sedan väljer du enheten i Välj anläggning/site."},
      {"fraga":"Det står att kunden har flera gällande avtal","svar":"Välj vilket avtal etableringen hör till i rutan som visas, och tryck [[Skapa & Boka Ärende]] igen."},
      {"fraga":"Teknikern kan bara välja per kontroll","svar":"Kunden saknar avtal i avtalskartan. Per år och per månad kräver ett avtal."}
    ]},
    {"type":"bra","items":[
      "Samma ärendetyp används för stationer som ingår i avtalet och för tillägg.",
      "Tillägg kan också sättas ut under en vanlig kontrollrunda. Då är det kontrollärendet som bär tillägget.",
      "Tjänsten Etableringskostnad är förvald. Inga fakturarader kopieras från avtalet, premien styrs av avtalskartan.",
      "Teknikern öppnar ärendet och trycker [[Gå till utplacering]]. Kunden är redan vald där.",
      "När tilläggen är utsatta får faktureringsansvarig en notis och beslutar dem i avtalskartan."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB vill ha 2 mekaniska fällor utöver avtalet vid lagret, betalda per år. Boka en etablering på Exempel AB Lager hos Anna Exempel torsdag 2026-10-22 klockan 08:00 till 10:00."},
    {"type":"quiz","fragor":[
      {"fraga":"Exempel AB har flera enheter och fällorna ska stå på lagret. Var väljer du lagret?","alternativ":["I Välj avtalskund (nyetablering)","I Välj anläggning/site","I Beskrivning till tekniker"],"ratt":1,"forklaring":"Kundlistan visar huvudkunden. Enheten väljs i fältet under."},
      {"fraga":"Kunden vill ha extra fällor vid nästa kontrollrunda, som redan är bokad. Måste du boka en etablering?","alternativ":["Ja, alltid","Nej, tillägg kan sättas ut under kontrollrundan","Nej, kontoret lägger in dem själv"],"ratt":1,"forklaring":"Kontrollärendet bär då tillägget."},
      {"fraga":"Kunden saknar avtal i avtalskartan. Hur kan teknikern ta betalt för tillägget?","alternativ":["Bara per kontroll","Bara per år","Hur som helst"],"ratt":0,"forklaring":"Per år och per månad kräver ett avtal."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-tillaggsstationer-fakturering","label":"Besluta och fakturera tilläggsstationer","description":"Beslutet i avtalskartan."},
      {"slug":"guide-aterkommande-schema","label":"Lägg upp ett återkommande schema","description":"Kontrollerna efter etableringen."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 43, now(), array['koordinator','admin']
),
(
  'guide-tillaggsstationer-fakturering',
  'Besluta och fakturera tilläggsstationer',
  'Besluta tilläggsstationerna i avtalskartan, välj Tillägg utöver avtalet eller Lägg till i avtalet, och se hur fakturorna och priserna hänger ihop.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Notisen Tillägg att besluta, eller [[Befintliga kunder]] › Kräver åtgärd","tar":"2 min","behover":"Behörigheten Faktureringsansvarig","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna notisen Tillägg att besluta, tryck [[Öppna § 5]] och välj [[Tillägg utöver avtalet]] vid raden. Kontrollera pris och timmar i Besluta tillägg och tryck [[Besluta]]. Utan beslut blir det ingen årsdebitering av tillägget."},
    {"type":"visning","steg":[
      {"text":"Tryck på notisen Tillägg att besluta och kundens namn.","ser":"Kundens avtalskarta öppnas med en gul remsa som visar antal tillägg att besluta och beloppet per år."},
      {"text":"Tryck [[Öppna § 5]].","ser":"Panelen Innehåll och utrustning visar Att besluta med en rad per stationstyp och enhet."},
      {"text":"Tryck [[Tillägg utöver avtalet]] vid raden.","ser":"Rutan Besluta tillägg öppnas. Tillägg utöver avtalet är redan valt under Hur ska tillägget faktureras?"},
      {"text":"Kontrollera årspriset och timmarna under Vad teknikern satte ut. Ändra om det behövs.","ser":"Timmarna är förifyllda med teknikerns förslag. Per år räknas om direkt."},
      {"text":"Tryck [[Besluta]].","ser":"Det står att stationerna ligger som tillägg utöver avtalet, och remsan blir Alla tillägg beslutade."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Pris saknas i prislistan på en eller flera rader. Ange pris.","svar":"Skriv årspriset per station i rutan kr per år, eller lägg in priset i kundens prislista först."},
      {"fraga":"Det står Timpris saknas i kundens prislista (tjänst 135). Lägg in det innan arbetstiden ändras.","svar":"Lägg in tjänst 135 i kundens prislista, eller lämna timmarna som de är."},
      {"fraga":"Det står Ange timmar som 0 eller mer.","svar":"Timmarna är felskrivna. Skriv 0 eller ett positivt tal."},
      {"fraga":"Knappen heter Försök igen","svar":"Ett av besluten kunde inte sparas. De som blev klara ligger kvar beslutade. Tryck [[Försök igen]] för att fortsätta med resten."},
      {"fraga":"Kunden ligger kvar under Kräver åtgärd","svar":"Det finns fler rader att besluta, kanske på ett annat avtal. Tryck Nästa avtal i panelen och besluta resten."}
    ]},
    {"type":"bra","items":[
      "Tillägg utöver avtalet blir en egen faktura i samband med avtalets årsfaktura. Premien rörs inte och tillägget slutar när avtalet slutar. Lägg till i avtalet höjer årspremien och lägger kostnaden i § 4.",
      "Tiden fram till avtalets nästa periodstart faktureras när ärendet stängs, under Fakturering › Merförsäljning Avtal. Beloppet är detsamma oavsett beslut.",
      "Antalet stationer räknas om när tilläggets faktura planeras. En borttagen station faktureras inte, och det blir inga krediteringar.",
      "Priserna: tjänst 144 Tilläggsstation per år, 79 Ljusfälla generell, 43 per kontroll och 135 timpris. Portalen letar i avtalets prislista, kundens prislista, Automatisk prislista och sist tjänstens grundpris.",
      "I Automatisk prislista kostar 144 och 79 i dag 3 600 kr per år och 135 kostar 1 016 kr per timme. Tjänst 43 har inget pris."
    ]},
    {"type":"interactive","component":"tillagg-jamforelse"},
    {"type":"interactive","component":"tillagg-rakneexempel"},
    {"type":"ovning","uppdrag":"Teknikern har satt ut 2 mekaniska fällor hos Exempel AB Lager och föreslagit 1 timme. Ni har kommit överens med kunden om 2 timmar per år. Besluta tilläggen utöver avtalet."},
    {"type":"quiz","fragor":[
      {"fraga":"Teknikern har satt ut 3 fällor utöver avtalet och kunden har inte bett om något annat. Vilket val gör du?","alternativ":["Lägg till i avtalet","Tillägg utöver avtalet","Inget, det sköts automatiskt"],"ratt":1,"forklaring":"Tillägg utöver avtalet är förvalt och det vanliga. Premien rörs inte."},
      {"fraga":"Ingen beslutar tilläggen. Vad händer?","alternativ":["Kunden faktureras ändå varje år","Kunden betalar delen för nu men ingen årsdebitering blir av","Stationerna tas bort"],"ratt":1,"forklaring":"Kunden står kvar under Kräver åtgärd tills tilläggen är beslutade."},
      {"fraga":"Kunden har ett eget pris för tjänst 144 i sin prislista. Vilket pris används?","alternativ":["Automatisk prislista","Kundens prislista","Tjänstens grundpris"],"ratt":1,"forklaring":"Kundens prislista går före Automatisk prislista. Bara avtalets egen prislista går före."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-tillaggsstationer-koordinator","label":"Boka etablering för tilläggsstationer","description":"Rätt ärende på rätt enhet."},
      {"slug":"guide-aterkommande-schema","label":"Lägg upp ett återkommande schema","description":"Kontrollerna efter etableringen."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 44, now(), array['admin','koordinator']
),
(
  'guide-aterkommande-schema',
  'Lägg upp ett återkommande schema',
  'Boka alla stationskontroller fram till avtalets slut på en gång under Rondering & Schema.',
  'handbok', 'utrustning',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"[[Rondering & Schema]] › [[Nytt schema]]","tar":"3 min","behover":"Kunden har avtalsdatum i kundkortet och stationerna är utplacerade","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck [[Nytt schema]] i Rondering & Schema, välj kund, ärendetyp och tekniker och gå igenom de fem stegen. Portalen bokar alla kontroller fram till avtalets slut på en gång."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Nytt schema]].","ser":"Rutan Nytt återkommande schema öppnas."},
      {"text":"Välj Kund, Ärendetyp och Ansvarig tekniker. Tryck [[Fortsätt till schemaläggning]].","ser":"Återkommande kontroller öppnas på Steg 1 av 5: Startdatum."},
      {"text":"Välj startdatum i kalendern. Tryck [[Nästa]].","ser":"Steg 2 av 5: Tid per besök."},
      {"text":"Tryck på hur lång tid en kontrollrunda tar. Tryck [[Nästa]].","ser":"Steg 3 av 5: Frekvens & dag. Står det Enligt avtalet är frekvensen redan förvald."},
      {"text":"Välj frekvens och dag, till exempel Kvartalsvis och Första helgfria vardagen. Tryck [[Nästa]].","ser":"Steg 4 av 5: Klockslag."},
      {"text":"Välj klockslag. Tryck [[Nästa]].","ser":"Förhandsvisningen visar alla datum fram till avtalets slut."},
      {"text":"Tryck på ett datum som inte passar för att ta bort det. Tryck sedan Skapa och antalet, till exempel [[Skapa 4 kontrolltillfällen]].","ser":"Det står 4 kontrolltillfällen skapade och schemat syns i listan."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Avtalsslutdatum saknas","svar":"Kunden saknar både avtalsslut och startdatum. Lägg in avtalsdatumen i kundkortet först."},
      {"fraga":"[[Nästa]] går inte att trycka i steg 1","svar":"Står det Avtalsperioden slutar och ett datum väljer du ett startdatum före det. Har kunden flera gällande avtal måste du också välja avtal."},
      {"fraga":"Det står Inga datum kunde genereras för vald period","svar":"Perioden är för kort för frekvensen. Gå [[Tillbaka]] och prova ett annat startdatum eller en annan dag i perioden."},
      {"fraga":"Ett datum är gult eller rött i förhandsvisningen","svar":"Gult betyder att datumet har flyttats, till exempel för en röd dag. Rött betyder att teknikern redan har något bokat. Tryck på datumet för att ta bort det, eller flytta besöket i schemat efteråt."},
      {"fraga":"Det står Avtalet saknar besöksfrekvens","svar":"Frekvensen du väljer sparas på avtalet och blir facit för framtida scheman. Kontrollera mot avtalet innan du väljer."}
    ]},
    {"type":"bra","items":[
      "Skapa inte stationskontroller för hand när kunden har ett schema, då blir det dubbla besök. Stationskontroll Avtalskund i Nytt ärende är bara för enstaka extra kontroller.",
      "Kontrollerna blir vanliga ärenden i schemat och kan flyttas en och en.",
      "Med Första helgfria vardagen hoppar portalen över röda dagar.",
      "Vid fortlöpande avtal planeras kontrollerna till nästa periodskifte, sedan förlängs schemat automatiskt.",
      "Teknikern får samma fråga efter etableringen. [[Ja, schemalägg]] öppnar samma fem steg."
    ]},
    {"type":"ovning","uppdrag":"Lägg upp ett schema för Brf Exempelgården: Stationskontroll med Anna Exempel, start måndag 2026-11-02, 1 timme per besök, kvartalsvis första helgfria vardagen klockan 08:00."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har ett återkommande schema och vill ha en extra kontroll. Vad gör du?","alternativ":["Lägger upp ett nytt schema","Bokar en Stationskontroll Avtalskund för den enda kontrollen","Ändrar frekvensen"],"ratt":1,"forklaring":"Ett nytt schema ger dubbla besök. En enstaka kontroll bokas som eget ärende."},
      {"fraga":"Ett datum i förhandsvisningen är en dag då teknikern är på kurs. Vad gör du?","alternativ":["Avbryter allt","Trycker på datumet så att det tas bort","Väljer en annan frekvens"],"ratt":1,"forklaring":"Ett tryck tar bort datumet. Resten av schemat skapas som vanligt."},
      {"fraga":"Det står Avtalsslutdatum saknas. Varför?","alternativ":["Teknikern saknar arbetstider","Kunden saknar avtalsdatum i kundkortet","Kunden har inga stationer"],"ratt":1,"forklaring":"Utan avtalsdatum vet portalen inte hur långt schemat ska räcka."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-tillaggsstationer-koordinator","label":"Boka etablering för tilläggsstationer","description":"Stationerna ut först."},
      {"slug":"guide-tillaggsstationer-fakturering","label":"Besluta och fakturera tilläggsstationer","description":"Beslutet i avtalskartan."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 45, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
