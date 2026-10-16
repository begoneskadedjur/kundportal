-- Guidemallen (godkänd 2026-10-16), facit: Boka ett återbesök för tekniker.
-- Guidemodul: src/pages/shared/intranet/guider/guide-aterbesok.tsx (visning + övning).
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-aterbesok',
  'Boka ett återbesök',
  'Boka nästa besök i samma ärende från telefonen, och fakturera det som är gjort om kunden ska betala nu.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren uppe till höger","tar":"4 min","behover":"Ett privat- eller företagsärende med adress","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på fotspåren i ärendet, välj [[Boka återbesök]] och välj en av tiderna portalen föreslår. Ska det som är gjort faktureras nu kryssar du i Skapa delfaktura innan du bokar."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Boka återbesök]].","ser":"Du ser Välj datum och längd."},
      {"text":"Välj datum, besökslängd och tekniker. Tryck [[Visa förslag →]].","ser":"Portalen hämtar tider där alla valda tekniker är lediga samtidigt."},
      {"text":"Tryck på den tid som passar.","ser":"Tiden blir grön."},
      {"text":"Ska det som är gjort faktureras nu? Kryssa i Skapa delfaktura för nuvarande tjänster.","ser":"Raderna och summan visas under rutan. Lämna den tom om kunden ska faktureras senare."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat! och ärendet får status Återbesök."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Är ärendet ett följeärende? Då bokar du återbesöket i huvudärendet."},
      {"fraga":"Det står Ärendet saknar adress","svar":"Portalen kan inte föreslå tider utan adress. Tryck [[Ange tid manuellt istället]] och välj tiden själv, eller lägg in adressen i ärendet först."},
      {"fraga":"Det står Inga lediga tider hittades","svar":"De valda teknikerna är upptagna. Gå tillbaka och välj ett annat datum, eller färre tekniker."},
      {"fraga":"Rutan Skapa delfaktura syns inte","svar":"Då står det Inga ofakturerade tjänster på ärendet. Fyll i Tjänster & fakturarader först, eller boka utan delfaktura."},
      {"fraga":"Det står Besökshistoriken kunde inte sparas","svar":"Återbesöket är bokat, men besöket du just gjorde kom inte med i historiken. Skriv till admin och ange ärendenumret."}
    ]},
    {"type":"bra","items":[
      "Det är samma ärende som fortsätter. Status blir Återbesök.",
      "Besöket du just gjorde sparas i ärendehistoriken, klockan uppe till höger.",
      "Ett nytt skadedjur hos samma kund är ett nytt ärende, inte ett återbesök.",
      "Kryssar du inte i Skapa delfaktura ligger raderna kvar och kommer med på nästa faktura.",
      "I avtalsärenden ser bokningen annorlunda ut. Det finns en egen guide för det."
    ]},
    {"type":"ovning","uppdrag":"Första besöket hos Familjen Exempel är gjort. Boka ett återbesök tisdag morgon och fakturera det som är gjort hittills."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har haft råttor och har nu också fått getingar. Vad gör du?","alternativ":["Bokar ett återbesök i råttärendet","Skapar ett nytt ärende","Duplicerar råttärendet"],"ratt":1,"forklaring":"Getingarna är ett nytt problem och får ett eget ärende. Återbesök är för samma problem."},
      {"fraga":"Det står Ärendet saknar adress när du ska få förslag. Vad gör du?","alternativ":["Avbryter och ringer kontoret","Trycker Ange tid manuellt istället","Väljer en annan tekniker"],"ratt":1,"forklaring":"Utan adress kan portalen inte räkna fram tider, men du kan välja tiden själv."},
      {"fraga":"Du lämnar Skapa delfaktura tom. Vad händer med fakturaraderna?","alternativ":["De försvinner","De ligger kvar och kommer med på nästa faktura","Kunden faktureras direkt ändå"],"ratt":1,"forklaring":"Ingenting försvinner. Raderna följer med nästa delfaktura eller slutfakturan."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-delfakturering","label":"Delfakturera ett ärende","description":"Fakturera det som är gjort, eller en gång per månad."},
      {"slug":"guide-aterbesok-avtal","label":"Boka ett återbesök i ett avtalsärende","description":"Avtalsärenden och kontrollrundor."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 31, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
