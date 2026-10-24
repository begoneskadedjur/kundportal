-- Handboken för nya arbetsvyn (2026-10-24), facit: Hitta rätt i nya arbetsvyn.
-- Guidemodul: src/pages/shared/intranet/guider/guide-roller-och-vyer.tsx, enheter telefon och dator.
-- Slugen behålls så att länkar och läsloggen fungerar. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-roller-och-vyer',
  'Hitta rätt i nya arbetsvyn',
  'Bottenmenyn i telefonen, sidomenyn på datorn, Skapa, Tickets och var allt annat ligger.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Överallt i portalen: menyn längst ner i telefonen, till vänster på datorn","tar":"4 min","enhet":"mobil"},
    {"type":"kortsvar","text":"I telefonen når du det du gör varje dag i menyn längst ner: [[Idag|falt.idag]], [[Karta|falt.karta]], [[Skapa|allman.plus]], [[Ärenden|arende.arende]] och [[Mer|allman.meny]]. På datorn ligger alla sidor i sidomenyn till vänster. Klockan uppe till höger går till Tickets."},
    {"type":"visning","steg":[
      {"text":"Tryck [[Idag|falt.idag]].","ser":"Idag visar nästa uppdrag med Navigera, Ring och Öppna, och dagens besök i den ordning de är bokade."},
      {"text":"Tryck [[Karta|falt.karta]].","ser":"Kartan visar dagens stopp med siffror i den ordning du kör. Byt mellan Idag och Imorgon under kartan."},
      {"text":"Tryck [[Ärenden|arende.arende]]. På datorn heter det Mina ärenden.","ser":"Mina ärenden visar veckans besök och det som väntar på dig, till exempel passerade besök som ska avslutas."},
      {"text":"Tryck [[Skapa|allman.plus]].","ser":"Rutan Vad vill du göra? öppnas: avtal eller offert, specialrapport, ny station, tips om ny kund, ticket till en kollega och AI-assistenten."},
      {"text":"I telefonen: tryck [[Mer|allman.meny]]. På datorn står allt redan i sidomenyn.","ser":"Under Mer ligger resten i samma grupper som på datorn: Min dag, Hos kunden, Sälja och Hjälp, och längst ner Mitt konto."},
      {"text":"Tryck på klockan uppe till höger.","ser":"Tickets öppnas. Siffran på klockan är antalet trådar som väntar på dig."},
      {"text":"Tryck på frågetecknet uppe till höger.","ser":"Visa mig hur går igenom sidan du står på, steg för steg. Frågetecknet finns på varje sida."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inte bottenmenyn","svar":"Den finns bara i telefonen och på smala skärmar. På datorn ligger samma sidor i sidomenyn till vänster."},
      {"fraga":"Jag hittar inte Stationer","svar":"I telefonen: tryck [[Mer|allman.meny]], Stationer står under Hos kunden. På datorn står den i sidomenyn under Hos kunden."},
      {"fraga":"Siffran på klockan försvinner inte","svar":"Den visar trådar som väntar på dig. Svara i tråden eller tryck [[Markera som klar|allman.bock]] när inget mer behövs."},
      {"fraga":"Jag ser den gamla menyn","svar":"Den nya vyn slås på per person på personalkortet. Fråga koordinatorn om du ska ha den."}
    ]},
    {"type":"bra","items":[
      "Den gula varningsknappen uppe till höger är för tillbud, avvikelser och olyckor. Den finns på varje sida.",
      "Förstoringsglaset uppe till höger söker kund, adress eller ärende. På datorn kan du också trycka Ctrl+K.",
      "Under Mer, Mitt konto, stänger du av hjälptexterna och genomgångarna när du kan sidorna.",
      "Lägg portalen på hemskärmen, så öppnas den som en app. Mitt konto visar hur du gör i din telefon."
    ]},
    {"type":"ovning","uppdrag":"Kollegan Anna Exempel har frågat dig något. Öppna sidan där frågan ligger, och gå sedan till Stationer."},
    {"type":"quiz","fragor":[
      {"fraga":"Du står hos kunden och vill öppna dagens nästa besök. Var börjar du?","alternativ":["Idag, längst ner till vänster","Mer, under Hjälp","Skapa, mitt i menyn"],"ratt":0,"forklaring":"Idag visar nästa uppdrag överst med Navigera, Ring och Öppna."},
      {"fraga":"Klockan uppe till höger visar 2. Vad betyder det?","alternativ":["Två nya besök är bokade","Två trådar i Tickets väntar på dig","Två tillbud är rapporterade"],"ratt":1,"forklaring":"Klockan går till Tickets. Siffran är trådar där någon har frågat dig eller svarat på din fråga."},
      {"fraga":"Du vill skicka ett tips om en ny kund. Vilken knapp?","alternativ":["Ärenden","Skapa","Karta"],"ratt":1,"forklaring":"Skapa samlar allt du kan skapa: avtal, rapporter, stationer, tips och tickets."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-din-dag","label":"Planera dagen med Idag och Karta","description":"Nästa uppdrag, rutten och restiden."},
      {"slug":"guide-ticket-systemet","label":"Tickets","description":"Fråga en kollega om ett ärende."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 1, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
