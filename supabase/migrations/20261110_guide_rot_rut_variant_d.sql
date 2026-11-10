-- Guiderna efter ROT/RUT-offerten i variant D (3.127.5) och 3.127.6:
-- två priskolumner (Pris inkl. moms och Att betala efter ROT/RUT), avdraget
-- i beskrivningen på Arbetskostnad, aldrig som egen rad eller rabatt.
-- Personnummer med 10 eller 12 siffror. RUT har ingen fastighet.
-- Dela upp för ROT/RUT används inte i offerten längre (ROT- och RUT-mallarna
-- bygger raderna själva), så offertguiderna nämner den inte.
-- Bara UPDATE av guidetexter. Idempotent: replace() gör inget när texten redan
-- är bytt, och where-villkoren hoppar över rader som redan är uppdaterade.

-- 1. Skapa en ROT- eller RUT-offert, kontoret
update public.intranet_documents
set
  content = replace(replace(replace(replace(replace(content::text,
    $a$Kunden ser priserna inkl. moms, avdraget och att betala, aldrig timmarna.$a$,
    $b$Kunden ser varje rad i två kolumner, Pris inkl. moms och Att betala efter ROT eller RUT, med summa för båda. Avdraget står i beskrivningen på Arbetskostnad. Timmarna ser kunden aldrig.$b$),
    $a$Listan Kvar innan du kan gå vidare blir grön och visar Att betala efter avdrag.$a$,
    $b$Listan Kvar innan du kan gå vidare blir grön. Under den står Pris inkl. moms och Att betala efter ROT.$b$),
    $a$Skriv personnumret med 12 siffror.$a$,
    $b$Skriv personnumret, ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX.$b$),
    $a$Rubriken Avser, raderna, totalt inkl. moms, avdraget och att betala.$a$,
    $b$Rubriken Avser och raderna i två kolumner, Pris inkl. moms och Att betala efter ROT, med summa för båda. Avdraget står i beskrivningen på Arbetskostnad, inte som egen rad.$b$),
    $a$"Avdraget räknas på arbetskostnaden inkl. moms, i hela kronor och avrundat nedåt, på samma sätt i offerten, i portalen och på fakturan.", $a$,
    $b$"Avdraget räknas på arbetskostnaden inkl. moms, i hela kronor och avrundat nedåt, på samma sätt i offerten, i portalen och på fakturan.", "Avdraget är aldrig en egen rad eller en rabatt. Bara Arbetskostnad skiljer mellan kolumnerna, övriga rader har samma pris i båda.", $b$)::jsonb,
  source_updated_at = now()
where slug = 'guide-rot-rut-offert-kontor'
  and content::text like '%Skriv personnumret med 12 siffror.%';

-- 2. Skapa en ROT- eller RUT-offert, teknikern
update public.intranet_documents
set
  content = replace(replace(replace(replace(content::text,
    $a$Tryck på Personnummer och skriv det med 12 siffror.$a$,
    $b$Tryck på Personnummer och skriv det, ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX.$b$),
    $a$Samma rader, totalt inkl. moms, ROT-avdrag och att betala som i portalen.$a$,
    $b$Samma rader och kolumner som i portalen: Pris inkl. moms och Att betala efter ROT, med summa för båda. Avdraget står i beskrivningen på Arbetskostnad.$b$),
    $a$Det ska vara 12 siffror, ÅÅÅÅMMDD-XXXX. Ett org.nr fungerar inte, företag kan inte få ROT eller RUT.$a$,
    $b$Skriv ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX och kontrollera siffrorna, kontrollsiffran måste stämma. Ett org.nr fungerar inte, företag kan inte få ROT eller RUT.$b$),
    $a$"Fastighetsbeteckning behövs bara för ROT. RUT har ingen fastighet."$a$,
    $b$"Fastighetsbeteckning behövs bara för ROT. RUT har ingen fastighet.", "Kunden ser två priskolumner, Pris inkl. moms och Att betala efter ROT eller RUT. Avdraget är aldrig en egen rad eller en rabatt."$b$)::jsonb,
  source_updated_at = now()
where slug = 'guide-rot-rut-offert-tekniker'
  and content::text like '%skriv det med 12 siffror.%';

-- 3. Skapa och skicka en offert, kontoret (guide-dokumentsignering-saljare).
-- Exemplet är nu en offert utan avdrag, ROT och RUT har en egen guide.
update public.intranet_documents
set
  summary = $b$Skapa Avtal & Offerter, Offert, rätt mall, befintlig eller ny kund, tjänsterna, Kontroll före utskick och Oneflows PDF innan du skickar. ROT och RUT har en egen guide.$b$,
  content = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(content::text,
    $a$För ROT eller RUT också personnummer, fastighetsbeteckning och hur mycket av priset som är arbete$a$,
    $b$ROT och RUT har en egen guide, Skapa en ROT- eller RUT-offert$b$),
    $a$Mallen bestämmer om offerten har ROT, RUT eller inget avdrag.$a$,
    $b$Mallen bestämmer om offerten har ROT, RUT eller inget avdrag. ROT- och RUT-offerter har en egen guide.$b$),
    $a$Steget Avtalspart hoppas över, mallen säger att det är en privatperson. I Tjänster går nu bara ROT att välja.$a$,
    $b$Steget Avtalspart hoppas över, mallen säger att det är en privatperson.$b$),
    $a$Familjen Exempel ska ha ROT. Tryck Offertförslag, ROT (Privatperson) och sedan [[Nästa]] till Motpart.$a$,
    $b$Familjen Exempel ska inte ha avdrag. Tryck Offertförslag, Inkl moms (Privatperson) och sedan [[Nästa]] till Motpart.$b$),
    $a${"ser": "Formuläret visar Varav arbetskostnad, Timmar och Avdrag. Under Avdrag står bara ROT (30 %), eftersom mallen är ROT-mallen.", "text": "I Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Tryck sedan [[Dela upp för ROT/RUT|allman.kalkyl]] under tjänsten."}$a$,
    $b${"ser": "Tjänsten står under Tjänster & fakturarader med priset inkl. moms.", "text": "I Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten."}$b$),
    $a${"ser": "Under tjänsten står Varav arbetskostnad 2 500 kr, 2 h, ROT och fältet Fastighetsbeteckning *. Fyll i det. Längst ner står ROT-avdrag och Att betala (kund).", "text": "Fyll i arbetskostnaden och timmarna och tryck [[Dela upp]]."}$a$,
    $b${"ser": "Texten Tjänster som ingår står i rutan. Skriv till med kundens egna ord.", "text": "Tryck [[Nästa]] och sedan [[Skriv förslag från tjänsterna]]."}$b$),
    $a$Offertförslag, ROT (Privatperson) söker ROT och Offertförslag, RUT (Privatperson) söker RUT. Med företagsmallen och mallen för privatpersoner inklusive moms går inget avdrag att välja.$a$,
    $b$ROT- och RUT-mallarna bygger offerten med raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader och har en egen guide, Skapa en ROT- eller RUT-offert. Företagsmallen och mallen för privatpersoner inklusive moms har inget avdrag.$b$),
    $a$Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. ROT och RUT dras bara på arbetskostnaden, som du delar ut med Dela upp för ROT/RUT. Arbetet blir en egen rad, Skadedjurstekniker timpris, och totalen mot kunden ändras inte.$a$,
    $b$Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Priset står bredvid.$b$),
    $a$Avdraget på raden passar inte mallen. Tryck Ändra under tjänsten och välj ROT, eller gå till steget Mall och välj RUT-mallen. Står det att mallen har inget ROT- eller RUT-avdrag väljer du ROT- eller RUT-mallen, eller tar bort uppdelningen. Raderna ändras aldrig av sig själva när du byter mall.$a$,
    $b$Avdraget på raden passar inte mallen. Byt avdraget på raden, eller gå till steget Mall och välj mallen med samma avdrag. Står det att mallen har inget ROT- eller RUT-avdrag väljer du Inget avdrag på raden, eller ROT- eller RUT-mallen. Raderna ändras aldrig av sig själva när du byter mall.$b$),
    $a$, {"svar": "Avdraget ligger på en tjänst där material ingår i priset. Välj Inget avdrag på raden och tryck Dela upp för ROT/RUT, så hamnar avdraget på arbetskostnaden.", "fraga": "Det står att ROT/RUT ligger på en tjänst som inte är arbetstid"}, {"svar": "Knappen visas bara med ROT- eller RUT-mallen, på en tjänst med pris som inte är låst av en prislista. Välj rätt mall i steget Mall.", "fraga": "Dela upp för ROT/RUT syns inte"}$a$,
    $b$, {"svar": "Välj ROT- eller RUT-mallen i steget Mall. Portalen skapar raderna, och du väljer avdraget på arbetstiden under Interna kostnader. Guiden Skapa en ROT- eller RUT-offert visar hur.", "fraga": "Kunden ska ha ROT eller RUT"}$b$),
    $a$Mallen bestämmer avdraget. Texten om ROT eller RUT står i Oneflow-mallen: ROT-mallen söker 30 % och RUT-mallen 50 % av arbetskostnaden. Kunden betalar det som står i offerten, och avdraget hanteras mot Skatteverket.$a$,
    $b$Mallen bestämmer avdraget. ROT-mallen ger 30 % och RUT-mallen 50 % av arbetskostnaden inkl. moms. I en ROT- eller RUT-offert ser kunden två priskolumner, Pris inkl. moms och Att betala efter avdraget. Avdraget är aldrig en egen rad eller en rabatt.$b$),
    $a$Byter du mall efter att ha delat upp arbetet ändras inga rader. Felet står i bottenlisten, Nästa går inte att trycka, och granskningen visar det som en röd punkt tills raden eller mallen är rättad.$a$,
    $b$Byter du mall ändras inga rader. Passar raderna inte mallen står felet i bottenlisten, Nästa går inte att trycka, och granskningen visar en röd punkt tills raden eller mallen är rättad.$b$),
    $a$Arbetsraden följer med när offerten bokas in: på ärendet ligger arbetskostnaden kvar under tjänsten med avdraget och fastighetsbeteckningen, och på fakturan står den som arbetskostnad för tjänsten.$a$,
    $b$Raderna följer med till ärendet när offerten bokas in.$b$),
    $a$Fyll i Fastighetsbeteckning under arbetskostnaden och kundens personnummer i Motpart redan i offerten. De följer med till ärendet när offerten bokas in, och utan fastighetsbeteckning går ärendet inte att fakturera med avdrag.$a$,
    $b$Ska kunden ha ROT eller RUT väljer du ROT- eller RUT-mallen. Då fyller du i personnumret, ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX, och för ROT också fastighetsbeteckningen. RUT har ingen fastighet. Guiden Skapa en ROT- eller RUT-offert visar hela flödet.$b$),
    $a$ Arbetsraden får samma rabatt och godkänns med tjänsten.$a$,
    $b$$b$),
    $a$Familjen Exempel vill ha en offert på tätning av ventil, 3 750 kr inkl. moms. 2 500 kr av det är arbete, två timmar, och familjen ska ha ROT. Fastigheten heter Exempelby 1:23. Skapa offerten och skicka den.$a$,
    $b$Familjen Exempel vill ha en offert på tätning av ventil, 3 750 kr inkl. moms, utan ROT eller RUT. Skapa offerten med mallen för privatpersoner inklusive moms och skicka den.$b$)
  , $a$Du har delat upp arbetet med ROT och byter sedan till mallen för privatpersoner inklusive moms. Vad händer?$a$,
    $b$En rad har ROT och du byter till mallen för privatpersoner inklusive moms. Vad händer?$b$)
  , $a$Du väljer: tillbaka till ROT-mallen, eller ta bort uppdelningen.$a$,
    $b$Du väljer: tillbaka till ROT-mallen, eller Inget avdrag på raden.$b$)
  , $a$"lankar": [{"slug": "guide-skapa-avtalsforslag-kontor"$a$,
    $b$"lankar": [{"slug": "guide-rot-rut-offert-kontor", "label": "Skapa en ROT- eller RUT-offert", "description": "När kunden ska ha ROT- eller RUT-avdrag."}, {"slug": "guide-skapa-avtalsforslag-kontor"$b$)
  , $a$"title": "Personnummer och fastighetsbeteckning"$a$,
    $b$"title": "ROT och RUT"$b$)::jsonb,
  source_updated_at = now()
where slug = 'guide-dokumentsignering-saljare'
  and content::text like '%Dela upp för ROT/RUT%';

-- 4. Skapa och skicka en offert, teknikern (guide-skapa-avtal-offert)
update public.intranet_documents
set
  content = replace(replace(replace(replace(replace(replace(replace(content::text,
    $a$För ROT eller RUT också personnummer, fastighetsbeteckning och hur mycket av priset som är arbete$a$,
    $b$För ROT eller RUT också personnummer och de planerade arbetstimmarna, för ROT dessutom fastighetsbeteckning$b$),
    $a$Mallen bestämmer avdraget: med ROT-mallen går bara ROT att välja och med RUT-mallen bara RUT.$a$,
    $b$Med ROT- eller RUT-mallen bygger portalen raderna åt dig, se guiden Skapa en ROT- eller RUT-offert.$b$),
    $a${"svar": "Knappen visas bara med ROT- eller RUT-mallen, på en tjänst med pris som inte är låst av en prislista. Med de andra mallarna går inget avdrag att välja. Är tjänsten själv Skadedjurstekniker timpris väljer du avdraget direkt på raden.", "fraga": "Dela upp för ROT/RUT syns inte"}$a$,
    $b${"svar": "Välj ROT- eller RUT-mallen i steget Mall. Portalen skapar raderna, och du trycker ROT eller RUT på Arbetstid Privatperson under Interna kostnader. Med de andra mallarna går inget avdrag att välja.", "fraga": "Var väljer jag ROT eller RUT?"}$b$),
    $a$Välj mallen Offertförslag, ROT (Privatperson) eller Offertförslag, RUT (Privatperson). Mallen bestämmer avdraget: med ROT-mallen går bara ROT att välja i Tjänster, med RUT-mallen bara RUT. Byter du mall efteråt ändras inga rader, men Nästa går inte att trycka förrän raden eller mallen är rättad. Bottenlisten säger vad som inte stämmer. Avdraget gäller bara arbetskostnaden: lägg till tjänsten och tryck Dela upp för ROT/RUT på raden. Fyll i Varav arbetskostnad och Timmar, välj ROT (30 %) eller RUT (50 %) och tryck Dela upp. Arbetet blir en egen rad, Skadedjurstekniker timpris, som bär avdraget. Totalen mot kunden ändras inte. Längst ner i Tjänster står ROT-avdrag och Att betala (kund). En offert kan inte ha både ROT och RUT.$a$,
    $b$Välj mallen Offertförslag, ROT (Privatperson) eller Offertförslag, RUT (Privatperson). Då skapar portalen raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader, och ärendets tjänst blir rubriken Avser på 0 kr. Tryck ROT eller RUT på Arbetstid Privatperson, med de timmar du planerar. ROT ger 30 % och RUT 50 % av arbetskostnaden inkl. moms. Kunden ser två priskolumner, Pris inkl. moms och Att betala efter ROT eller RUT, och avdraget står i beskrivningen på Arbetskostnad, aldrig som egen rad eller rabatt. Timmarna ser kunden aldrig. En offert kan inte ha både ROT och RUT. Guiden Skapa en ROT- eller RUT-offert visar hela flödet.$b$),
    $a$Fyll i Fastighetsbeteckning på raden med avdraget och kundens personnummer i Motpart redan i offerten. De följer med till ärendet när kontoret bokar in, och utan fastighetsbeteckning går ärendet inte att fakturera med avdrag. Granskningen visar Totalt exkl. moms utan avdraget, så titta i Oneflows PDF hur priset visas för kunden innan du skickar.$a$,
    $b$Med ROT- eller RUT-mallen fyller du i kundens personnummer i Tjänster, ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX. För ROT också fastighetsbeteckningen, eller föreningens org.nr och lägenhetsnummer om kunden bor i bostadsrätt. RUT har ingen fastighet. De följer med till ärendet när kontoret bokar in. Granskningen visar samma rader och summor som Oneflows PDF.$b$),
    $a$"Mallen för ROT räcker, avdraget räknas ut av sig självt", "Med ROT-mallen, och sedan Dela upp för ROT/RUT i Tjänster på arbetskostnaden"$a$,
    $b$"Mallen räcker, avdraget dras på hela priset", "Med ROT-mallen, och sedan ROT på Arbetstid Privatperson i Tjänster"$b$),
    $a$Mallen bestämmer att det blir ROT, och bara ROT går då att välja. Avdraget lägger du i Tjänster med Dela upp för ROT/RUT, på en egen rad för arbetskostnaden.$a$,
    $b$Mallen bestämmer att det blir ROT. Avdraget räknas bara på Arbetskostnad, och du väljer ROT på arbetstiden i Tjänster.$b$)::jsonb,
  source_updated_at = now()
where slug = 'guide-skapa-avtal-offert'
  and content::text like '%Dela upp för ROT/RUT%';

-- 5. Delfakturera ett ärende: meddelandet gäller bara ROT sedan 3.127.4
update public.intranet_documents
set
  content = replace(content::text,
    $a$Fastighetsbeteckning saknas för ROT/RUT på:$a$,
    $b$Fastighetsbeteckning saknas för ROT på:$b$)::jsonb,
  source_updated_at = now()
where slug = 'guide-delfakturering'
  and content::text like '%saknas för ROT/RUT på:%';
