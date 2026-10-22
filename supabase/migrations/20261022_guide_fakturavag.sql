-- Guidemallen: Välj fakturaväg för en kund (admin och koordinator, dator).
-- Fakturavägen kom i 3.77.0. Guidemodul: src/pages/shared/intranet/guider/guide-fakturavag.tsx.
-- Texter och felmeddelanden ur src/shared/invoiceDelivery.ts, InvoiceDeliveryPanel.tsx,
-- InvoiceDetailModal.tsx, ContractInvoiceModal.tsx och PrivateBusinessInvoicing.tsx.
-- Placering i handboken: handbokSektioner.ts, ämnet Pris och fakturering direkt
-- efter guide-fakturering-kontor. Den guiden får också en länk hit under Läs också.
-- Idempotent: on conflict skriver om guiden, länken läggs bara till en gång.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-fakturavag',
  'Välj fakturaväg för en kund',
  'Hur kunden får sina fakturor: e-post, e-faktura eller brev. Så väljer du vägen vid kundens första faktura, och ändrar den senare.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Fakturering › fakturan › rutan Fakturaväg","tar":"4 min","behover":"Behörigheten faktureringsansvarig för att välja väg","enhet":"dator"},
    {"type":"kortsvar","text":"Varje kund har en fakturaväg: e-post, e-faktura eller brev. Säljaren behöver inte veta den. Kunden skriver den i avtalet, och saknas den eller är oklar väljer faktureringsansvarig vägen i fakturan vid kundens första faktura, en gång per kund. Tills dess går fakturan inte att godkänna eller skicka till Fortnox."},
    {"type":"visning","steg":[
      {"text":"Öppna Fakturering och tryck på ögat på raden för Exempel AB.","ser":"Fakturan öppnas. Under nyckeltalen överst ligger rutan Fakturaväg med gul ram och texten Fakturavägen för Exempel AB är inte bekräftad. Skapa utkast i Fortnox är nedtonad."},
      {"text":"Läs Fakturaadress. Där står det kunden skrev i avtalet, här en skanningsadress med en referens. Tryck Brev under Hur ska kunden få fakturan?","ser":"Under valen står Fakturan skickas som brev till fakturaadressen. Vill kunden ha fakturan till kontaktpersonen väljer du E-post och trycker Använd kontaktpersonens e-post under Fakturamejl. Adressen fylls i fältet, men sparas först när du trycker Spara."},
      {"text":"Tryck i Fakturaadress och ta bort referensen, så att bara FE 512, 831 90 Östersund står kvar.","ser":"Felraden under fälten försvinner. Så länge referensen står efter orten säger portalen att adressen saknar gata, postnummer eller ort."},
      {"text":"Tryck i Er referens (valfritt) och skriv Ansvar 28310.","ser":"Referensen står på alla kundens fakturor."},
      {"text":"Tryck [[Spara och uppdatera Fortnox|allman.bock]].","ser":"Det står Fakturavägen är sparad och Fortnox-kortet 1234 uppdaterat. Rutan visar Fakturaväg Brev och Satt av ekonomi med ditt namn och datum. Har kunden inget Fortnox-kort än heter knappen Spara fakturaväg."},
      {"text":"Tryck [[Skapa utkast i Fortnox]].","ser":"Spärren är borta och utkastet skapas. Väntar fakturan på godkännande trycker du [[Godkänn|allman.bock]] först. Den knappen var också spärrad."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Spara-knappen går inte att trycka på","svar":"Har du inte valt väg än: välj E-post, E-faktura eller Brev. Annars står felet under fälten. Står det Ange en giltig e-postadress för fakturan, saknas Fakturamejl eller är felskrivet. Står det Ange fakturaadressen med gata eller box, postnummer och ort, räcker adressen inte för ett brev, till exempel när en referens står efter orten. Rätta fältet, så går knappen att trycka på."},
      {"fraga":"Det står E-faktura kräver ett organisationsnummer på kunden.","svar":"E-faktura går på organisationsnumret, och kunden har inget eller är en privatperson. Välj E-post eller Brev, eller lägg in organisationsnumret på kunden först."},
      {"fraga":"Det står Fortnox-kortet är uppdaterat men portalen kunde inte spara","svar":"Fortnox fick valet men portalen inte. Tryck [[Spara och uppdatera Fortnox]] igen. Kommer ett annat fel när du sparar har ingenting sparats, varken i Fortnox eller i portalen. Försök igen."},
      {"fraga":"Det står 1 faktura väntar på fakturaväg: Exempel AB. Öppna fakturan och välj väg.","svar":"Det kommer när du godkänner flera fakturor på en gång. De andra är godkända. Öppna fakturan till kunden som står uppräknad och välj väg, som i stegen ovan."},
      {"fraga":"Det står Fortnox-kortet säger brev. Portalen har uppdaterats.","svar":"Någon har ändrat leveranssättet direkt i Fortnox. Fortnox-kortet gäller, och portalen har tagit över det. Är det fel: tryck pennan Ändra fakturaväg i rutan, välj rätt väg och spara. Då ändras Fortnox-kortet också."}
    ]},
    {"type":"bra","items":[
      "Vägen gäller kunden och kundens Fortnox-kort, inte en enskild faktura. Ändra den senare med pennan Ändra fakturaväg i rutan, i fakturan eller under Faktureringsinställningar på kunden.",
      "En enhet som faktureras på huvudkontorets Fortnox-kort följer huvudkontorets väg. Då står det gäller via och huvudkontorets namn i rutan, och valet gäller hela kunden.",
      "Ändrar någon leveranssättet direkt i Fortnox tar portalen över det nästa gång en faktura skickas. Då står det Satt av Fortnox-kortet.",
      "Kunder med Fortnox-kort fick vägen från kortet 2026-10-22. En ny kund får e-post direkt om kunden skrev en e-postadress i avtalet. Kontaktpersonens e-post används aldrig av sig själv.",
      "Utan behörigheten faktureringsansvarig ser du rutan men inga val, bara texten Faktureringsansvarig väljer fakturavägen."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB skrev FE 512, 831 90 Östersund. Referens: Ansvar 28310 som fakturaadress i avtalet. Kunden vill ha fakturan som brev till skanningsadressen. Bekräfta vägen och skapa utkastet i Fortnox."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden skrev bara en postadress i avtalet. Vem bestämmer fakturavägen?","alternativ":["Säljaren när avtalet skrivs","Faktureringsansvarig vid kundens första faktura","Teknikern vid första besöket"],"ratt":1,"forklaring":"Säljaren behöver inte veta hur kunden vill ha fakturan. Är det oklart väljer faktureringsansvarig vägen i fakturan, en gång per kund."},
      {"fraga":"Kunden vill ha fakturan till kontaktpersonen Anna Exempel. Vad gör du?","alternativ":["Inget, portalen tar kontaktpersonens e-post","Väljer E-post och skriver hennes adress i Fakturamejl","Skriver hennes adress i Er referens"],"ratt":1,"forklaring":"Kontaktpersonens e-post används aldrig av sig själv. Fakturan går dit först när du har skrivit in den som fakturamejl."},
      {"fraga":"Du väljer E-faktura för Brf Exempelgården i en faktura. Vad gäller för föreningens nästa faktura?","alternativ":["Portalen frågar igen","Den går som e-faktura, vägen gäller kunden och Fortnox-kortet","Den går som brev"],"ratt":1,"forklaring":"Vägen sparas på kunden och på Fortnox-kortet. Du väljer bara en gång."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-fakturering-kontor","label":"Fakturera från ärende till betalning","description":"Godkänn, skapa utkast i Fortnox och följ fakturan till betald."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 36, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;

-- Fakturera från ärende till betalning: länk hit under Läs också (del 8, avslut)
update public.intranet_documents
set content = jsonb_set(
      content,
      '{7,lankar}',
      (content -> 7 -> 'lankar') || $json$[
        {"slug":"guide-fakturavag","label":"Välj fakturaväg för en kund","description":"E-post, e-faktura eller brev. Väljs vid kundens första faktura."}
      ]$json$::jsonb
    ),
    source_updated_at = now()
where slug = 'guide-fakturering-kontor'
  and content -> 7 ->> 'type' = 'avslut'
  and not (content -> 7 -> 'lankar') @> '[{"slug":"guide-fakturavag"}]'::jsonb;
