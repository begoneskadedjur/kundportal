-- Guidemallen (godkänd 2026-10-16): Skicka en offert från ärendet, för tekniker.
-- Guidemodul: src/pages/shared/intranet/guider/guide-dokumentsignering-tekniker.tsx (visning + övning).
-- Kontorets version är guide-dokumentsignering i 20261016_guidemallen_40_arenden.sql.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-dokumentsignering-tekniker',
  'Skicka en offert från ärendet',
  'Gör en offert av tjänsterna i ärendet, granska Oneflows PDF och skicka den till kunden direkt från telefonen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › kvittot uppe till höger","tar":"3 min","behover":"Ett privat- eller företagsärende med kontaktperson, e-post och tjänster med pris","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på kvittot i ärendet. Kund och tjänster hämtas från ärendet. Tryck [[Skriv förslag från tjänsterna]], granska och tryck [[Skapa och visa Oneflows PDF]]. Ser PDF:en rätt ut trycker du [[Skicka offerten]]. Inget går till kunden innan dess."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på kvittot uppe till höger. På en större skärm står det [[Offert]] bredvid.","ser":"Offertguiden öppnas på steget Offertinnehåll, Steg 6 av 7. Det står Kundinformation förifylld från ärende! (Offert)."},
      {"text":"Rutan har en färdig standardtext om avtalskontroller. Tryck [[Skriv förslag från tjänsterna]].","ser":"Texten byts mot Tjänster som ingår: och en rad per tjänst i ärendet. Skriv gärna till med egna ord."},
      {"text":"Tryck [[Granska offerten →]].","ser":"Granska offerten visas: kund, offertinnehåll, pris och Kontroll före utskick."},
      {"text":"Läs igenom. Bläddra ner och tryck [[Skapa och visa Oneflows PDF]].","ser":"Offerten skapas som utkast i Oneflow och du ser Så här ser kunden offerten. Inget är skickat än."},
      {"text":"Bläddra igenom PDF:en. Stämmer allt, tryck [[Skicka offerten]] under Ser allt rätt ut?","ser":"Det står Offerten är skickad. Efter en stund kommer du till Dokumentsignering."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står att ärendet saknar prissatta tjänster","svar":"Guiden öppnas på steget Tjänster. Lägg till tjänsterna med pris där och tryck [[Nästa]]. Du kan också gå tillbaka till ärendet och lägga in dem under fliken Ekonomi."},
      {"fraga":"Guiden börjar på Välj mall i stället för Offertinnehåll","svar":"Kontaktperson eller e-post saknas i ärendet. Mallen är redan vald. Tryck [[Nästa]] tills du kommer till Motpart och fyll i det som saknas."},
      {"fraga":"Det står att ärendet har både ROT och RUT","svar":"En offert kan bara ha ett avdrag. Ingen offert skapades. Säg till koordinatorn att ärendet behöver delas upp."},
      {"fraga":"Det står Rätta de röda punkterna först","svar":"Något stoppar under Kontroll före utskick. Tryck på länken under den röda punkten, till exempel Rätta under Motpart, och rätta. Gula punkter stoppar inte."},
      {"fraga":"Det står PDF:en är inte klar ännu","svar":"Oneflow håller på att skapa PDF:en. Vänta en stund och tryck [[Försök igen]]."}
    ]},
    {"type":"bra","items":[
      "Mallen väljs efter ärendet: privatperson, ROT, RUT eller företag. För en privatperson står priset inkl. moms, för ett företag exkl. moms.",
      "Offerten skickas från info@begone.se till kontaktpersonens e-post. Adressen står under knappen innan du skickar.",
      "Kan du inte skicka nu? Tryck [[Spara som utkast]]. Den ligger kvar under Dokumentsignering och du skickar den därifrån senare.",
      "När offerten är skickad får ärendet status Offert skickad.",
      "Under Dokumentsignering i menyn ser du bara dina egna offerter och avtal."
    ]},
    {"type":"ovning","uppdrag":"Anna Exempel vill ha pris på att ta bort ett getingbo innan jobbet görs. Tjänsten och priset ligger redan i ärendet. Skicka en offert till henne."},
    {"type":"quiz","fragor":[
      {"fraga":"Offertinnehållet handlar om betesstationer fast jobbet gäller getingar. Vad gör du?","alternativ":["Skickar ändå","Trycker Skriv förslag från tjänsterna och skriver till med egna ord","Avbryter och ringer kontoret"],"ratt":1,"forklaring":"Standardtexten är skriven för avtal. Kunden ska läsa vad just det här jobbet omfattar."},
      {"fraga":"Du har tryckt Skapa och visa Oneflows PDF. Har kunden fått offerten?","alternativ":["Ja, direkt","Nej, inte förrän du trycker Skicka offerten","Ja, när koordinatorn godkänt den"],"ratt":1,"forklaring":"Först skapas ett utkast. Kunden får ingenting förrän du har sett PDF:en och tryckt Skicka offerten."},
      {"fraga":"Kunden vill vänta med offerten till i morgon. Vad gör du?","alternativ":["Trycker Spara som utkast","Trycker Ändra i wizarden","Stänger telefonen"],"ratt":0,"forklaring":"Utkastet ligger kvar under Dokumentsignering. Ändra i wizarden tar bort utkastet i Oneflow."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-prissattning","label":"Sätt rätt pris i ärendet","description":"Tjänsterna och priset som offerten bygger på."},
      {"slug":"guide-leads-tekniker","label":"Tipsa om en lead","description":"När kunden behöver mer hjälp än ett jobb."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 67, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
