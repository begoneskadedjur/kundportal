-- ============================================================
-- Handbok: gör så här-listor konverteras till visuella
-- steg-block (numrerade steg) och stationsguiden får en
-- planritningssektion med rådet att ladda upp i liggande
-- format (visningen och stationsplaceringen är byggd för det).
-- ============================================================

-- Konvertera sekventiella listor till steps (index verifierade mot innehållet)
UPDATE intranet_documents SET content = jsonb_set(jsonb_set(content, '{2,type}', '"steps"'), '{8,type}', '"steps"')
WHERE slug = 'guide-ticket-systemet';

UPDATE intranet_documents SET content = jsonb_set(content, '{3,type}', '"steps"')
WHERE slug = 'guide-foljearenden';

UPDATE intranet_documents SET content = jsonb_set(content, '{2,type}', '"steps"')
WHERE slug = 'guide-avbryta-arenden';

UPDATE intranet_documents SET content = jsonb_set(content, '{4,type}', '"steps"')
WHERE slug = 'guide-rapportera-tillbud';

UPDATE intranet_documents SET content = jsonb_set(content, '{5,type}', '"steps"')
WHERE slug = 'guide-roller-och-vyer';

-- Stationsguiden: steg-block + utökad inomhussektion med planritningsråd
UPDATE intranet_documents SET
  content = $json$[
    {"type":"h2","text":"Varför registrera utrustning?"},
    {"type":"p","text":"När du placerar fällor och stationer hos kunder registrerar du dem med GPS-position. Då vet nästa tekniker exakt var utrustningen står, kunden ser sin utrustning i kundportalen, och dokumentationen med kartor ger ett professionellt intryck."},
    {"type":"h2","text":"Så gör du - sex steg"},
    {"type":"steps","items":[
      "Öppna utrustningssidan från din dashboard (Snabbåtgärder) eller direkt via Utrustning i menyn.",
      "Välj kund med chip-filtret eller sökfältet.",
      "Tryck på den gröna plus-knappen nere till höger på kartvyn.",
      "Välj utrustningstyp i listan. Mekaniska fällor kräver serienummer för spårbarhet.",
      "Hämta GPS-position - stå så nära utrustningen som möjligt när du trycker.",
      "Lägg gärna till foto och kommentar, och tryck Spara placering."
    ]},
    {"type":"callout","variant":"warning","title":"Om GPS inte fungerar","text":"Se till att du är utomhus eller nära ett fönster, ge webbläsaren tillåtelse att använda plats, och vänta några sekunder. Du kan också klicka direkt på kartan för att markera positionen manuellt."},
    {"type":"h2","text":"Bra foton och kommentarer"},
    {"type":"p","text":"Ett foto och en tydlig kommentar gör det mycket lättare för nästa tekniker. Visa utrustningen OCH omgivningen, inkludera landmärken som dörrar och skyltar, och undvik för nära eller suddiga bilder."},
    {"type":"callout","variant":"info","title":"Exempel på bra kommentarer","text":"Bakom sopcontainern, vänster sida. Vid lastbrygga 2, under trappan. Innanför grinden, 3 meter höger. I källaren, rum B12, vid fläkten."},
    {"type":"h2","text":"Inomhusstationer och planritningar"},
    {"type":"p","text":"Stationer inomhus placeras på kundens planritning i stället för på kartan, och kontrolleras sedan via egenkontroller och ronderingar. Planritningen laddas upp på kunden en gång och återanvänds vid varje kontroll."},
    {"type":"callout","variant":"warning","title":"Ladda upp planritningar i liggande format","text":"Använd alltid liggande format (landskap - bredare än högt) när du laddar upp en planritning. Visningen och stationsplaceringen är byggda för liggande bilder: stående ritningar blir små och svåra att arbeta med, både när stationer placeras ut och när de kontrolleras i fält. Är originalet stående - rotera bilden innan du laddar upp."},
    {"type":"h2","text":"Vanliga frågor"},
    {"type":"list","items":[
      "Kan jag redigera en placering efteråt? Ja - klicka på placeringen i listan. Du kan uppdatera foto, kommentar och position.",
      "Ser kunden mina placeringar? Ja, inloggade kunder ser sin utrustning med bilder och kommentarer i kundportalen.",
      "Vad om jag placerar hos fel kund? Kontakta kontoret så flyttas placeringen - det går inte att byta kund själv i efterhand.",
      "Måste jag ta foto? Nej, men det rekommenderas starkt."
    ]}
  ]$json$::jsonb
WHERE slug = 'guide-placera-stationer';
