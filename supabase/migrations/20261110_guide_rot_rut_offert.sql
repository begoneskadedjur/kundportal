-- Guiderna Skapa en ROT- eller RUT-offert (3.127.0), en för tekniker och en för kontoret.
-- Guidemoduler: src/pages/shared/intranet/guider/guide-rot-rut-offert-tekniker.tsx och
-- guide-rot-rut-offert-kontor.tsx, delade skärmar i _rotrut.tsx.
-- Texterna följer src/constants/rotRutHjalp.ts och OneflowContractCreator/CaseServiceSelector.
-- Idempotent: on conflict skriver om guiderna.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-rot-rut-offert-tekniker',
  'Skapa en ROT- eller RUT-offert',
  'Välj ROT- eller RUT-mallen, välj avdraget på arbetstiden och fyll i fastighet och personnummer. Raderna och priset sköts av portalen.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Skapa offert › Mall › Offertförslag ROT eller RUT (Privatperson)","tar":"5 min","behover":"Privatperson med personnummer och fastighetsbeteckning, arbetstiden planerad","enhet":"mobil"},
    {"type":"kortsvar","text":"Välj ROT-mallen för byggarbete på huset, till exempel tätning, och RUT-mallen för vissa saneringsarbeten. Raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader skapas åt dig. Du väljer [[ROT]] eller [[RUT]] på arbetstiden och fyller i fastighetsbeteckning och personnummer."},
    {"type":"visning","steg":[
      {"text":"I steget Mall: tryck på Offertförslag ROT (Privatperson).","ser":"Mallen är vald. I steget Tjänster står Mallen har ROT-avdrag 30 % och de fyra raderna är skapade. Ärendets tjänst står överst som Avser på 0 kr."},
      {"text":"Under Interna kostnader: tryck [[ROT]] på Arbetstid Privatperson.","ser":"Arbetskostnad får sitt pris från timmarna. Det står hur många timmar som rapporteras, bara internt. Kunden ser aldrig timmarna."},
      {"text":"Tryck på Fastighetsbeteckning och skriv den, med kolon.","ser":"Till exempel Exempelby 1:23. Bor kunden i bostadsrätt kryssar du Bostadsrätt och skriver föreningens org.nr och lägenhetsnummer."},
      {"text":"Tryck på Personnummer och skriv det med 12 siffror.","ser":"Listan Kvar innan du kan gå vidare blir grön."},
      {"text":"Tryck [[Nästa]].","ser":"Du går vidare till Offertinnehåll. Texten nämner raderna, aldrig timmar eller interna kostnader."},
      {"text":"I Granska: tryck [[Skapa och visa Oneflows PDF]].","ser":"Samma rader, totalt inkl. moms, ROT-avdrag och att betala som i portalen."},
      {"text":"Tryck [[Skicka offerten]].","ser":"Det står Offerten är skickad."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Nästa går inte att trycka på","svar":"Något står kvar i listan Kvar innan du kan gå vidare. Tryck på punkten, så hamnar du i fältet eller raden som ska rättas."},
      {"fraga":"Det står Bara arbetstid med ROT hör till Arbetskostnad","svar":"En kostnad som inte är arbetstid med ROT ligger på Arbetskostnad. Byt rad i Ligger på, eller tryck ROT på arbetstiden."},
      {"fraga":"Det står Ärendets tjänst ska ha 0 kr","svar":"Tjänsten överst har ett pris. Tryck Gör till rubrik, 0 kr. Priset räknas på raderna under."},
      {"fraga":"Personnumret godkänns inte","svar":"Det ska vara 12 siffror, ÅÅÅÅMMDD-XXXX. Ett org.nr fungerar inte, företag kan inte få ROT eller RUT."}
    ]},
    {"type":"bra","items":[
      "ROT ger 30 % och RUT 50 % avdrag på arbetskostnaden inkl. moms, aldrig på material, servicebil eller övrigt.",
      "Interna kostnader hamnar på rätt rad av sig själva: Arbetstid på Arbetskostnad, Bekämpning, Tillbehör och Inspektion på Material och utrustning, Underentreprenör och Övrigt på Övriga kostnader. Du kan byta rad i Ligger på.",
      "Servicebil skriver du in själv. Rader på 0 kr syns inte för kunden.",
      "Timmarna går till Skatteverket via Fortnox när jobbet faktureras. Kunden ser bara beloppet.",
      "ROT rapporteras alltid som byggarbete. Du behöver inte välja typ av arbete."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel vill täta grunden mot råttor. Skapa en ROT-offert med 10 timmars arbete och skicka den."},
    {"type":"quiz","fragor":[
      {"fraga":"Vilken mall väljer du för tätning av grunden?","alternativ":["RUT-mallen","ROT-mallen","Inkl moms utan avdrag"],"ratt":1,"forklaring":"Tätning är byggarbete på huset. Det är ROT, 30 %."},
      {"fraga":"Ser kunden hur många timmar du planerat?","alternativ":["Ja, på Arbetskostnad","Nej, bara beloppet","Bara i fakturan"],"ratt":1,"forklaring":"Kunden ser Arbetskostnad, 1 st med beloppet. Timmarna går bara till Skatteverket."},
      {"fraga":"Kunden bor i bostadsrätt. Vad fyller du i?","alternativ":["Föreningens org.nr och lägenhetsnummer","Kundens personnummer två gånger","Ingenting"],"ratt":0,"forklaring":"Kryssa Bostadsrätt och fyll i föreningens org.nr och lägenhetsnummer i stället för fastighetsbeteckning."}
    ]},
    {"type":"avslut","lankar":["guide-skapa-avtal-offert","guide-dokumentsignering-tekniker"],"fraga":"Fråga kontoret om du är osäker på om jobbet är ROT eller RUT."}
  ]$json$::jsonb,
  1, false, true, 0, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section,
  category = excluded.category, content = excluded.content, is_published = excluded.is_published,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-rot-rut-offert-kontor',
  'Skapa en ROT- eller RUT-offert',
  'ROT- och RUT-mallen bygger offerten av fyra rader, räknar avdraget inkl. moms och stoppar tills fastighet, personnummer och arbetstid är rätt. Fakturan visar avdraget mot Fortnox.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Skapa Avtal & Offerter › Offert › Mall","tar":"6 min","behover":"Privatperson med personnummer och fastighetsbeteckning, eller bostadsrätt med föreningens org.nr och lägenhetsnummer","enhet":"dator"},
    {"type":"kortsvar","text":"ROT-mallen (30 %) gäller byggarbete på huset, RUT-mallen (50 %) vissa saneringsarbeten. Portalen skapar raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader, lägger de interna kostnaderna på rätt rad och räknar priset. Kunden ser priserna inkl. moms, avdraget och att betala, aldrig timmarna."},
    {"type":"visning","steg":[
      {"text":"I steget Mall: tryck på Offertförslag ROT (Privatperson).","ser":"I Tjänster står Mallen har ROT-avdrag 30 % och de fyra raderna är skapade. Ärendets tjänst står överst som Avser på 0 kr, den används i statistiken."},
      {"text":"Under Interna kostnader: tryck [[ROT]] på Arbetstid Privatperson.","ser":"Arbetskostnad får priset från prisguiden. Timmarna visas bara internt och rapporteras till Skatteverket via Fortnox."},
      {"text":"Skriv fastighetsbeteckningen, med kolon.","ser":"Bostadsrätt: kryssa Bostadsrätt och skriv föreningens org.nr och lägenhetsnummer."},
      {"text":"Skriv personnumret med 12 siffror.","ser":"Listan Kvar innan du kan gå vidare blir grön och visar Att betala efter avdrag."},
      {"text":"Tryck [[Nästa]] och skriv offertinnehållet.","ser":"Texten får inte nämna den andra avdragstypen. Gör den det stoppas Granska offerten."},
      {"text":"I Granska: tryck [[Skapa och visa Oneflows PDF]].","ser":"Rubriken Avser, raderna, totalt inkl. moms, avdraget och att betala."},
      {"text":"Tryck [[Skicka offerten]].","ser":"Det står Offerten är skickad. Ändras raderna i Oneflow syns en röd rad i dokumentet under Dokumentsignering."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Offerten kan inte skapas och en lista","svar":"Servern kontrollerar samma saker som listan i Tjänster: arbetstid med avdrag, fastighet, personnummer, privatperson, bara mallens avdrag, alla interna kostnader på en rad och ärendets tjänst på 0 kr. Rätta det som står och försök igen."},
      {"fraga":"Fakturan går inte att skicka till Fortnox","svar":"En ROT- eller RUT-faktura stoppas om personnummer, fastighet, plats eller datum för arbetet saknas. Meddelandet säger vad. Rätta på ärendet eller fakturan och tryck [[Skapa utkast i Fortnox]] igen."},
      {"fraga":"Fortnox avdrag skiljer sig från Begärt avdrag","svar":"Rutan på fakturan visar skillnaden. Kontrollera avdraget i Fortnox innan fakturan bokförs."},
      {"fraga":"CSV-exporten hoppar över fakturan","svar":"ROT- och RUT-fakturor exporteras inte som CSV. Öppna fakturan och tryck [[Skapa utkast i Fortnox]]."}
    ]},
    {"type":"bra","items":[
      "Avdraget räknas på arbetskostnaden inkl. moms, i hela kronor och avrundat nedåt, på samma sätt i offerten, i portalen och på fakturan.",
      "Bara privatpersoner. Ett org.nr stoppar offerten och fakturan.",
      "Fakturan får rubriken Avser som textrad, Arbetskostnad som husarbete med timmarna, och plats, datum och fastighet som textrader.",
      "Fakturans ROT/RUT-ruta visar personnumret maskerat, timmarna, begärt avdrag och Fortnox avdrag. Där markerar du Begäran gjord, Utbetald eller Avvisad.",
      "Begäran om utbetalning görs i Fortnox när kunden har betalat, senast 31 januari året efter betalningen."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel vill täta grunden mot råttor. Skapa en ROT-offert med 10 timmars arbete och skicka den."},
    {"type":"quiz","fragor":[
      {"fraga":"Hur mycket avdrag ger RUT?","alternativ":["30 % av hela priset","50 % av arbetskostnaden inkl. moms","50 % av arbetskostnaden exkl. moms"],"ratt":1,"forklaring":"RUT ger 50 % och ROT 30 %, alltid på arbetskostnaden inkl. moms."},
      {"fraga":"Var hamnar en intern kostnad i kategorin Underentreprenör?","alternativ":["Arbetskostnad","Material och utrustning","Övriga kostnader"],"ratt":2,"forklaring":"Underentreprenör och Övrigt hamnar på Övriga kostnader, utan avdrag."},
      {"fraga":"Personnumret saknas på en ROT-faktura. Vad händer när du skickar?","alternativ":["Fakturan skickas utan avdrag","Fakturan stoppas med ett besked","Fortnox fyller i det"],"ratt":1,"forklaring":"Avdraget tas aldrig bort i tysthet. Fakturan stoppas tills personnumret finns."}
    ]},
    {"type":"avslut","lankar":["guide-skapa-avtalsforslag-kontor"],"fraga":"Fråga ekonomi om avdraget eller begäran hos Skatteverket."}
  ]$json$::jsonb,
  1, false, true, 0, now(), array['admin','koordinator','säljare']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section,
  category = excluded.category, content = excluded.content, is_published = excluded.is_published,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
