-- Guiden Skapa ett ärende och välj rätt ärendetyp (admin och koordinator):
-- ärendetyperna förklaras, och Extrabesök Avtalskund lyfts fram eftersom avtalskunder
-- ofta läggs upp som engångsjobb (Christian 2026-10-21).
-- Fakta ur koden: typerna och undertexterna i src/constants/caseTypeLabels.ts och
-- ScheduleHeader, kundportalen läser bara cases-tabellen (Portal.tsx, CaseList.tsx),
-- typen går inte att byta på ett skapat ärende, Radera ger status Borttaget.

update intranet_documents
set
  summary = 'Skapa ett nytt ärende från schemat, välj rätt typ och boka det med bokningsassistenten. Avtalskunder får alltid en avtalstyp.',
  source_updated_at = now(),
  content = $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Schemat › [[Nytt ärende]] uppe till höger","tar":"5 min","behover":"Kundens adress och kontaktuppgifter, och om kunden har avtal med oss","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck [[Nytt ärende]] i schemat och välj typ. Har kunden avtal med oss väljer du en avtalstyp, oftast Extrabesök Avtalskund, även när jobbet inte ingår i avtalet. Bara kunder utan avtal blir Engångsjobb Privatperson eller Engångsjobb Företag."},
    {"type":"callout","variant":"warning","title":"Det vanligaste misstaget","text":"En avtalskund ringer om något som inte ingår i avtalet, till exempel getingar hos en kund som har avtal om råttor. Det är ett Extrabesök Avtalskund, inte ett engångsjobb. Som engångsjobb hamnar ärendet utanför avtalet: kunden ser det inte i sin kundportal, och det faktureras som ett eget engångsjobb i stället för som merförsäljning på avtalet."},
    {"type":"p","text":"Så väljer du ärendetyp. Engångsärenden står överst i listan och Avtalskunder under."},
    {"type":"list","items":[
      "Engångsjobb Privatperson: en privatperson utan avtal. Faktureras separat, och ROT eller RUT kan dras på arbetet.",
      "Engångsjobb Företag: ett företag eller en förening utan avtal. Faktureras separat.",
      "Extrabesök Avtalskund: allt en avtalskund vill ha utöver avtalet. Ett annat skadedjur, en extra sanering eller ett extra besök mellan kontrollerna. Fakturaraderna blir merförsäljning på avtalet.",
      "Stationskontroll Avtalskund: en enstaka kontroll av kundens stationer. Återkommande kontroller läggs i Rondering & Schema.",
      "Etablering Avtalskund: utplacering av stationer när avtalet startar. Tjänsten Etableringskostnad väljs automatiskt.",
      "Rondering Trafikkontoret och Egenkontroll: bara för regionalkundernas egenkontrollprogram."
    ]},
    {"type":"visning","steg":[
      {"text":"Öppna schemat och tryck [[Nytt ärende]] uppe till höger.","ser":"En lista öppnas med Engångsärenden överst och Avtalskunder under."},
      {"text":"Välj ärendetyp. Har kunden avtal väljer du Extrabesök Avtalskund. Har kunden inget avtal väljer du Engångsjobb Privatperson eller Engångsjobb Företag.","ser":"Formuläret öppnas, till exempel Nytt ärende: Engångsjobb Privatperson."},
      {"text":"Fyll i Adress och välj Tjänst under Intelligent Bokning. Tryck [[Hitta bästa tid & tekniker]].","ser":"Bokningsförslagen visas under knappen, med tid, tekniker och restid."},
      {"text":"Tryck på det förslag som passar.","ser":"Starttid, Sluttid och ansvarig tekniker fylls i under Bokning & Detaljer."},
      {"text":"Fyll i kunden under Kund & Kontakt: Kontaktperson, Telefonnummer och Personnummer. För ett företag fyller du i Företagsnamn och väljer Kundgrupp i stället för personnummer.","ser":"Fält med * måste vara ifyllda."},
      {"text":"Tryck [[Skapa & Boka Ärende|station.klar]].","ser":"Det står Ärendet har skapats! och besöket ligger i schemat på den tid du valde."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Adress och Tjänst måste vara ifyllda","svar":"Bokningsassistenten behöver båda för att räkna fram tider. Fyll i Adress och Tjänst och tryck [[Hitta bästa tid & tekniker]] igen."},
      {"fraga":"Det står Alla fält med * under 'Bokning & Detaljer' måste vara ifyllda","svar":"Starttid, Sluttid eller ansvarig tekniker saknas. Välj ett bokningsförslag, eller fyll i tiderna och teknikern själv."},
      {"fraga":"Det står Välj kundgrupp för företagskunden","svar":"Engångsjobb Företag kräver Kundgrupp under Kund & Kontakt. Den avgör kundnumrets serie i Fortnox."},
      {"fraga":"Det står Du måste välja en avtalskund","svar":"Du har valt en av avtalstyperna. Välj kunden i listan överst i formuläret. Har kunden inget avtal ska du välja Engångsjobb Privatperson eller Engångsjobb Företag."},
      {"fraga":"Jag valde fel ärendetyp, till exempel ett engångsjobb åt en avtalskund","svar":"Har du inte skapat ärendet än: tryck [[Avbryt]] och välj [[Nytt ärende]] igen. Är ärendet redan skapat går typen inte att byta. Skriv varför i kommunikationen, ta bort ärendet med [[Radera|allman.radera]] och skapa det igen med rätt typ. Är ärendet avslutat eller fakturerat frågar du admin först."}
    ]},
    {"type":"bra","items":[
      "En avtalskund som vill ha något utöver avtalet är alltid Extrabesök Avtalskund, även när skadedjuret inte står i avtalet. Ärendet behåller kopplingen till avtalet och kunden ser det i sin kundportal.",
      "Osäker på om kunden har avtal? Sök fram kunden under Kunder & Avtal › Befintliga kunder innan du väljer typ.",
      "Ett engångsjobb ska aldrig vara en etablering. Etablering Avtalskund är bara utplacering av stationer hos en avtalskund.",
      "Skicka bokningsbekräftelse? står på Nej. Väljer du ett av Ja-valen får kunden ett sms när du skapar ärendet."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB har inget avtal och vill bli av med möss. Skapa ärendet och boka det första förslaget från bokningsassistenten."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett företag utan avtal vill ha hjälp med getingar en gång. Vilken typ väljer du?","alternativ":["Etablering Avtalskund","Engångsjobb Företag","Extrabesök Avtalskund"],"ratt":1,"forklaring":"Kund utan avtal är alltid ett engångsjobb. Etablering och Extrabesök är bara för avtalskunder."},
      {"fraga":"Brf Exempelgården har avtal om råttor och ringer om getingar. Vilken typ väljer du?","alternativ":["Engångsjobb Företag","Extrabesök Avtalskund","Stationskontroll Avtalskund"],"ratt":1,"forklaring":"Getingarna ingår inte i avtalet, men Brf Exempelgården är avtalskund. Allt en avtalskund vill ha utöver avtalet är Extrabesök Avtalskund."},
      {"fraga":"Du trycker Hitta bästa tid & tekniker och får Adress och Tjänst måste vara ifyllda. Vad gör du?","alternativ":["Väljer en tekniker själv","Fyller i adress och tjänst och trycker igen","Byter ärendetyp"],"ratt":1,"forklaring":"Assistenten räknar tider från adressen och tjänsten. Båda måste finnas."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schemavyn","label":"Hitta och flytta besök i schemat","description":"Sök fram ett besök och dra det till en ny tid."},
      {"slug":"guide-foljearenden-kontor","label":"Skapa ett följeärende","description":"Nytt skadedjur hos samma kund, utan att fylla i allt igen."},
      {"slug":"guide-avbryta-arenden-kontor","label":"Avbryt eller ta bort ett ärende","description":"När ett ärende har fel typ eller inte ska göras."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb
where slug = 'guide-skapa-arenden';
