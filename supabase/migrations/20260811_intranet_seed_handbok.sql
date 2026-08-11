-- ============================================================
-- Intranät: handboksguider som strukturerat innehåll.
-- Ersätter de hårdkodade guide-sidorna från januari 2026 med
-- uppdaterat innehåll (ClickUp-referenser borttagna, nya
-- funktioner tillagda). Guider kräver ingen kvittens men kan
-- markeras som lästa (används av onboarding-checklistan).
-- ============================================================

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, requires_acknowledgement, content)
VALUES
(
  'guide-ticket-systemet',
  'Ticket-systemet',
  'All intern kommunikation på ett ställe: skapa, svara på och lös tickets - och förstå de sex flikarna.',
  'handbok',
  'kommunikation',
  10,
  false,
  $json$[
    {"type":"h2","text":"Vad är en ticket?"},
    {"type":"p","text":"En ticket är en sparbar fråga. När du skriver en kommentar med @namn i ett ärende skapas en ticket - en tråd som följs upp tills den är löst. All intern kommunikation kring ärenden sker i ticketsystemet, så att allt finns samlat, sparat och sökbart."},
    {"type":"list","items":[
      "Tekniker skriver: @Admin Klar att fakturera",
      "En ticket skapas och Admin får en notis",
      "Admin svarar: Fakturerat! Faktura #12345",
      "Admin klickar Markera löst - klart!"
    ]},
    {"type":"callout","variant":"info","title":"Därför tickets","text":"Ingen väntar på mejl eller telefonsamtal, alla frågor och svar sparas för uppföljning och revision, och du kan söka på fakturanummer, nyckelord eller namn i efterhand."},
    {"type":"h2","text":"De sex flikarna"},
    {"type":"p","text":"På sidan Tickets finns sex flikar som hjälper dig prioritera:"},
    {"type":"list","items":[
      "Väntar på ditt svar (röd) - någon har @nämnt dig och väntar på att du agerar. Detta är din att göra-lista, kolla den dagligen.",
      "Svar till dig (orange) - någon har svarat på din kommentar, även utan att @nämna dig.",
      "Väntar på andras svar (gul) - du har ställt en fråga och väntar på svar. Bevaka dessa.",
      "Ny aktivitet (blå) - tickets med nya kommentarer som du inte läst ännu.",
      "Alla tickets (grå) - komplett översikt över alla öppna tickets där du är involverad.",
      "Avslutade (grön) - lösta tickets. Sökbara när du behöver hitta gammal information."
    ]},
    {"type":"h2","text":"Skapa en ticket"},
    {"type":"list","items":[
      "Öppna ett ärende (privat, företag eller avtal).",
      "Klicka på pratbubblan i övre högra hörnet.",
      "Skriv din kommentar med @namn - den du taggar får en notis och ticketen hamnar i deras Väntar på ditt svar."
    ]},
    {"type":"callout","variant":"info","title":"Vem kan du tagga?","text":"@Förnamn Efternamn för en specifik person, @Admin / @Koordinator / @Tekniker för alla med den rollen, eller @alla för alla med tillgång till ärendet (använd sparsamt)."},
    {"type":"h2","text":"Svara och markera löst"},
    {"type":"p","text":"Hitta ticketen i Tickets, klicka för att öppna ärendet och skriv ditt svar i kommunikationspanelen. När du svarar flyttas ticketen från Väntar på ditt svar till Väntar på andras svar."},
    {"type":"p","text":"När frågan är besvarad och ingen mer åtgärd krävs klickar du Markera löst. Ticketen arkiveras i Avslutade men kan återöppnas vid behov. Den som skapade ticketen, den som taggades och admin kan markera som löst."},
    {"type":"h2","text":"Söka och hitta"},
    {"type":"p","text":"Sökfältet i Tickets letar i alla flikar - både aktiva och arkiverade. Sök på fakturanummer, kundnamn, nyckelord eller personnamn. Du kan söka på delar av ord: faktur hittar fakturering."},
    {"type":"h2","text":"Vanliga frågor"},
    {"type":"list","items":[
      "Kan kunder se mina tickets? Nej - alla tickets och intern kommunikation är helt interna. Kunder ser dem aldrig.",
      "Hur vet jag när någon svarar? Du får en notis (klockan i menyn) och ticketen dyker upp under Ny aktivitet.",
      "Kan jag återöppna en löst ticket? Ja - öppna den från Avslutade-fliken och klicka Återöppna.",
      "Vad är skillnaden på ticket och vanlig kommentar? En ticket skapas när du taggar någon med @ och har en status (öppen/löst). Kommentarer utan @ är bara anteckningar."
    ]},
    {"type":"callout","variant":"success","title":"Fem saker att komma ihåg","text":"1. @namn i en kommentar = ticket. 2. Kolla Väntar på ditt svar dagligen. 3. Svara snabbt. 4. Markera löst när klart. 5. Sök i Avslutade för gammal info."}
  ]$json$::jsonb
),
(
  'guide-foljearenden',
  'Följeärenden',
  'Skapa nya ärenden direkt i fält när du upptäcker extra problem hos kunden - utan att ringa kontoret.',
  'handbok',
  'arenden',
  11,
  false,
  $json$[
    {"type":"h2","text":"Vad är ett följeärende?"},
    {"type":"p","text":"Du är hos en kund för att sanera råttor och upptäcker silverfisk i badrummet. I stället för att ringa kontoret skapar du ett följeärende direkt i mobilen. Kundens uppgifter kopieras automatiskt, och det nya ärendet får eget pris och egen provisionsberäkning."},
    {"type":"h2","text":"Så gör du - fyra steg"},
    {"type":"list","items":[
      "Öppna ärendet du jobbar med från din ärendelista - det öppnas i en popup.",
      "Klicka på den orangea knappen Följeärende längst upp i popupen, bredvid Avtal och Offert.",
      "Välj det NYA skadedjuret i dropdown-menyn - inte det du redan behandlar.",
      "Klicka Skapa följeärende. Det nya ärendet skapas och öppnas automatiskt."
    ]},
    {"type":"h2","text":"Vad kopieras automatiskt?"},
    {"type":"list","items":[
      "Kundens namn, kontaktuppgifter, adress och telefonnummer",
      "Samma schemalagda tid",
      "Du som tilldelad tekniker"
    ]},
    {"type":"p","text":"Det nya ärendet får egen skadedjurstyp, egen tidloggning (0 min), eget pris och status Bokad."},
    {"type":"h2","text":"Vanliga frågor"},
    {"type":"list","items":[
      "Får jag provision för följeärendet? Ja - det räknas som ett helt eget ärende med eget pris och egen tidloggning.",
      "Kan jag skapa följeärende från vilket ärende som helst? Från privatperson- och företagsärenden. Från ett följeärende går det inte att skapa ytterligare följeärenden.",
      "Vad händer om jag väljer fel skadedjur? Ingen fara - du kan ändra skadedjurstypen i det nya ärendet efteråt.",
      "Ser kontoret att jag skapade ärendet? Ja, det loggas vem som skapade följeärendet och från vilket ärende."
    ]},
    {"type":"callout","variant":"warning","title":"Om knappen inte syns","text":"Kontrollera att du jobbar med ett privatperson- eller företagsärende, att ärendet inte redan är ett följeärende och att det är öppnat i redigeringsläge."}
  ]$json$::jsonb
),
(
  'guide-avbryta-arenden',
  'Avbryta ärenden: slaska, inte radera',
  'När och hur du avbryter ärenden - och varför du i princip aldrig ska radera.',
  'handbok',
  'arenden',
  12,
  false,
  $json$[
    {"type":"callout","variant":"warning","title":"Den viktigaste regeln","text":"Radera aldrig ett ärende. I 99 procent av fallen ska du i stället slaska det - då bevaras all data, historik och alla bilder, och ärendet kan återöppnas om det behövs."},
    {"type":"h2","text":"Vad händer vid radering?"},
    {"type":"list","items":[
      "All data försvinner permanent - kommentarer, bilder, historik och tidsloggar.",
      "Det går inte att ångra.",
      "Om kunden ringer igen finns ingenting kvar att luta sig mot."
    ]},
    {"type":"h2","text":"Slaska i stället"},
    {"type":"p","text":"Att slaska betyder att ändra ärendets status till Slaskad. Ärendet är avbrutet men all data finns kvar. Slaska när kunden avbokar, inte går att nå, ärendet inte längre är aktuellt eller jobbet inte kan utföras."},
    {"type":"list","items":[
      "Öppna ärendet och hitta statusfältet (oftast längst upp).",
      "Välj statusen Slaskad i dropdown-menyn.",
      "Dokumentera ALLTID anledningen i fältet Tekniker dokumentation - det är obligatoriskt vid slaskning."
    ]},
    {"type":"callout","variant":"info","title":"Exempel på bra anledningar","text":"Kunden avbokade pga flytt till annan stad. Kunden svarar inte på telefon - försökt 3 gånger. Kunden löste problemet själv. Dubblettärende - se ärende #12345."},
    {"type":"h2","text":"När FÅR man radera?"},
    {"type":"p","text":"Endast i undantagsfall: dubblettärenden som skapats av misstag, ärenden med helt fel kund eller information, samt testärenden. Kunden avbokade, jobbet kunde inte utföras eller att rensa upp är ALDRIG skäl att radera - slaska i stället."},
    {"type":"p","text":"Raderingsknappen finns i Danger Zone längst ner i ärendets redigeringsläge och kräver dubbel bekräftelse. Använd den bara om du är helt säker."},
    {"type":"motto","text":"Osäker? Slaska! Det är alltid bättre att slaska än att radera."}
  ]$json$::jsonb
),
(
  'guide-placera-stationer',
  'Placera stationer och fällor',
  'Registrera utrustning hos kund med GPS-position, foto och kommentar så att alla hittar tillbaka.',
  'handbok',
  'utrustning',
  13,
  false,
  $json$[
    {"type":"h2","text":"Varför registrera utrustning?"},
    {"type":"p","text":"När du placerar fällor och stationer hos kunder registrerar du dem med GPS-position. Då vet nästa tekniker exakt var utrustningen står, kunden ser sin utrustning i kundportalen, och dokumentationen med kartor ger ett professionellt intryck."},
    {"type":"h2","text":"Så gör du - sex steg"},
    {"type":"list","items":[
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
    {"type":"h2","text":"Vanliga frågor"},
    {"type":"list","items":[
      "Kan jag redigera en placering efteråt? Ja - klicka på placeringen i listan. Du kan uppdatera foto, kommentar och position.",
      "Ser kunden mina placeringar? Ja, inloggade kunder ser sin utrustning med bilder och kommentarer i kundportalen.",
      "Vad om jag placerar hos fel kund? Kontakta kontoret så flyttas placeringen - det går inte att byta kund själv i efterhand.",
      "Måste jag ta foto? Nej, men det rekommenderas starkt."
    ]},
    {"type":"callout","variant":"info","title":"Inomhusstationer","text":"Stationer inomhus placeras på kundens planritning i stället för på kartan, och kontrolleras via egenkontroller och ronderingar. Fråga koordinatorn om du är osäker på vilket flöde som gäller hos en kund."}
  ]$json$::jsonb
),
(
  'guide-rapportera-tillbud',
  'Rapportera tillbud, avvikelse eller olycka',
  'Oj eller aj? Så rapporterar du direkt i portalen - och det här händer med din rapport.',
  'handbok',
  'sakerhet',
  14,
  false,
  $json$[
    {"type":"h2","text":"Oj eller aj - vad är skillnaden?"},
    {"type":"list","items":[
      "Tillbud (Oj!) - något hände som KUNDE ha lett till skada, men ingen skadades. Exempel: du halkade på ett spill men tog emot dig.",
      "Olycka (Aj!) - något hände och någon skadades eller mådde dåligt. Exempel: du skar dig vid ett ingrepp.",
      "Avvikelse (Hmm) - något fungerar inte som det ska: en rutin som inte följs, ett kundklagomål, spill eller läckage av bekämpningsmedel, eller en överenskommelse som inte hålls."
    ]},
    {"type":"callout","variant":"success","title":"Rapportera hellre en gång för mycket","text":"Syftet är aldrig att peka ut någon - det är att hitta återkommande eller allvarliga problem så att vi kan förhindra att de händer igen. Det är en del av vårt ISO-arbete."},
    {"type":"h2","text":"Så rapporterar du"},
    {"type":"list","items":[
      "Klicka på den gula knappen Rapportera tillbud, avvikelse eller olycka i sidomenyn (finns även i mobilmenyn).",
      "Välj typ: tillbud, olycka eller avvikelse.",
      "Beskriv vad som hände, när det inträffade och vad du gjorde direkt.",
      "Skicka - klart!"
    ]},
    {"type":"h2","text":"Vad händer med rapporten?"},
    {"type":"p","text":"De ansvariga mottagarna får en notis och ett mail direkt. Rapporten utreds enligt vårt ISO-arbetssätt: orsak och grundorsak analyseras, en åtgärd beslutas med ansvarig och deadline, och ärendet följs upp innan det stängs. Du kan själv följa status på dina rapporter under Tillbud & Avvikelser."},
    {"type":"callout","variant":"warning","title":"Vid akut nödläge","text":"Vid brand gäller RÄDDA - VARNA - UTRYM - LARMA - SLÄCK OM MÖJLIGT. Ring alltid 112 först vid allvarlig skada. Rapportera i portalen när situationen är under kontroll - alla nödlägen ska också rapporteras till VD."}
  ]$json$::jsonb
),
(
  'guide-roller-och-vyer',
  'Roller, vyer och ditt konto',
  'Så växlar du mellan Admin/Koordinator/Tekniker-vyerna, hittar Mitt konto och byter lösenord.',
  'handbok',
  'guide',
  15,
  false,
  $json$[
    {"type":"h2","text":"Vyväxlaren"},
    {"type":"p","text":"Har du flera portalroller (t.ex. både admin och tekniker) ser du en växlare högst upp i sidomenyn. Klicka på den vy du vill arbeta i - portalen kommer ihåg ditt val till nästa inloggning. Vilka roller du har styrs av administratören under Användarkonton (Personal)."},
    {"type":"h2","text":"Mitt konto"},
    {"type":"p","text":"Längst ner i sidomenyn hittar du Mitt konto. Där uppdaterar du namn, e-post och telefonnummer - och byter lösenord."},
    {"type":"h2","text":"Byta lösenord"},
    {"type":"list","items":[
      "Gå till Mitt konto och sektionen Byt lösenord.",
      "Ange ditt nuvarande lösenord och välj ett nytt (minst 8 tecken med stor och liten bokstav samt siffra).",
      "Har du glömt lösenordet? Använd Glömt lösenord på inloggningssidan, eller be en administratör skicka ett nytt."
    ]},
    {"type":"callout","variant":"info","title":"Fått ett tillfälligt lösenord?","text":"När administratören skickar ett nytt lösenord loggar du in med det och tvingas direkt välja ett eget innan du kommer vidare. Det är helt normalt och tar under en minut."},
    {"type":"h2","text":"Intranätet"},
    {"type":"p","text":"Via Intranät & Hjälpcenter längst ner i menyn når du policys att kvittera, den här handboken, kontaktlistan och anslagstavlan. En gul siffra på länken betyder att du har dokument kvar att kvittera."}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
