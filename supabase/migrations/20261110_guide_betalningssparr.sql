-- Guiden Häva en betalningsspärr (3.128.2), för kontoret (admin och koordinator).
-- Guidemodul: src/pages/shared/intranet/guider/guide-betalningssparr-kontor.tsx.
-- Texterna följer PaymentBlockSection, PaymentBlockNotice, PaymentBlockSettingsSection,
-- PaymentBlockBanner och migrationerna 20261110_betalningssparr*.sql.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-betalningssparr-kontor',
  'Häva en betalningsspärr',
  'En kund med förfallna portalfakturor spärras för nya bokningar. Spärren hävs, pausas eller sätts på kundkortet under Fakturering, alltid med kommentar.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Kundkortet › Fakturering › Betalningsspärr","tar":"3 min","behover":"Ett skäl att häva spärren, till exempel att kunden har betalat eller att ekonomi har sagt ja","enhet":"dator"},
    {"type":"kortsvar","text":"Har kunden obetalda fakturor från portalen visar Skapa ärende en röd ruta och ärendet går inte att spara. Spärren hävs bara på kundkortet, i fliken Fakturering, och du måste alltid skriva varför. Spärren hävs också av sig själv när kunden har betalat."},
    {"type":"visning","steg":[
      {"text":"I den röda rutan Kunden har betalningsspärr: tryck Öppna kundkortet.","ser":"Kundkortet öppnas i en ny flik. Under sidhuvudet står en röd rad Betalningsspärr med skulden och hur länge den varit förfallen."},
      {"text":"Tryck Visa i Fakturering på den röda raden.","ser":"Fliken Fakturering öppnas. Under Betalningsspärr står Automatisk spärr eller Manuell spärr, de obetalda portalfakturorna och historiken."},
      {"text":"Tryck [[Häv spärren]].","ser":"Rutan Häv spärren öppnas. För en automatisk spärr är Pausa automatiken till och med ifyllt 14 dagar fram."},
      {"text":"Tryck på Kommentar och skriv varför du häver spärren.","ser":"Till exempel Kunden har lovat betala fredag. Kommentaren syns bara internt."},
      {"text":"Tryck [[Spara]].","ser":"Det står Spärren hävd, automatiken pausad till och datumet. Historiken visar Spärr hävd med ditt namn och kommentaren. Välj kunden igen i Skapa ärende, så går ärendet att spara."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Skapa & Boka Ärende går inte att trycka på","svar":"Kunden, eller kundens huvudkontor, har betalningsspärr. Den röda rutan visar vilka fakturor det gäller. Häv spärren på kundkortet, eller vänta tills kunden har betalat."},
      {"fraga":"Det står Kunden har betalningsspärr. Ärendet skapades inte.","svar":"Spärren sattes medan du fyllde i ärendet. Inget sparades. Öppna kundkortet och se Betalningsspärr under Fakturering."},
      {"fraga":"Kunden har betalat men spärren ligger kvar","svar":"En automatisk spärr hävs inom 15 minuter efter att betalningen syns från Fortnox. En manuell spärr hävs aldrig av sig själv. Tryck [[Häv spärren]]."},
      {"fraga":"Det står Spärren sitter på huvudkontoret och gäller alla enheter","svar":"Spärren hanteras på huvudkontorets kundkort. Tryck på länken Hantera den hos och huvudkontorets namn."},
      {"fraga":"Jag ser inga knappar under Betalningsspärr","svar":"Bara admin, koordinator och fakturagodkännare kan sätta, häva och pausa spärren. Be någon av dem."}
    ]},
    {"type":"bra","items":[
      "Automatiken spärrar när kundens förfallna skuld på portalens fakturor är mer än 100 kr och mer än 20 dagar efter förfallodagen. Kontrollen körs var 15:e minut och efter varje synk från Fortnox. ROT- och RUT-avdrag som väntar hos Skatteverket och makulerade fakturor räknas inte. Kunder som bara får automatiska fakturor direkt från Fortnox omfattas inte än.",
      "Spärren stoppar Skapa ärende för alla ärendetyper, Boka in, AI-bokningen och kundens förfrågningar i kundportalen. Följeärenden, återbesök och återkommande scheman ger bara en gul varning.",
      "Hävs en automatisk spärr pausas automatiken till datumet du väljer, annars spärras kunden igen inom 15 minuter. [[Sätt manuell spärr]] sätter en spärr som bara hävs för hand. [[Pausa automatiken]] gör att kunden inte spärras på en period. [[Undanta]] tar bort en enskild faktura ur spärren.",
      "En spärr på huvudkontoret gäller alla enheter. Privatpersoner och företag i Skapa ärende kontrolleras på personnummer och org.nr.",
      "Kunden ser en ruta i kundportalen om obetalda fakturor med 010 280 44 10 och info@begone.se, aldrig kommentaren. Kundansvarig och fakturagodkännare får en notis när automatiken sätter eller häver en spärr. Gränserna ändras av admin under Inställningar › Betalningsvillkor."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB behöver ett besök i dag. Kunden har lovat betala fredag och ekonomi har sagt ja. Häv spärren och skriv varför."},
    {"type":"quiz","fragor":[
      {"fraga":"Varför måste du välja ett datum när du häver en automatisk spärr?","alternativ":["Datumet skickas till kunden","Annars spärras kunden igen inom 15 minuter om skulden finns kvar","Datumet blir fakturans nya förfallodag"],"ratt":1,"forklaring":"Automatiken pausas till datumet. Det föreslås 14 dagar fram och syns bara internt."},
      {"fraga":"Kunden har betalningsspärr och du skapar ett följeärende. Vad händer?","alternativ":["Följeärendet stoppas","Du får en gul varning men följeärendet skapas","Spärren hävs"],"ratt":1,"forklaring":"Följeärenden, återbesök och återkommande scheman varnar bara. Nya ärenden i Skapa ärende och Boka in stoppas."},
      {"fraga":"En ROT-faktura är obetald, men kunden har betalat sin del. Avdraget väntar hos Skatteverket. Räknas den?","alternativ":["Ja, hela beloppet","Nej, avdraget räknas inte som kundens skuld","Bara om den är äldre än 60 dagar"],"ratt":1,"forklaring":"Spärren räknar bara kundens del. Avdraget som väntar hos Skatteverket räknas inte."}
    ]},
    {"type":"avslut","lankar":["guide-skapa-arenden","guide-fakturaarkiv-kontor"],"fraga":"Fråga en fakturagodkännare innan du häver en spärr för en kund som inte har betalat."}
  ]$json$::jsonb,
  1, false, true, 0, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section,
  category = excluded.category, content = excluded.content, is_published = excluded.is_published,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
