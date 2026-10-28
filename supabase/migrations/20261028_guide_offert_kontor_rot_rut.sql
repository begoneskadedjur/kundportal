-- Handboken 2026-10-28 (3.106.0): kontorets offertguide och ROT/RUT där mallen bestämmer avdraget.
--   guide-dokumentsignering-saljare  (ändrad) Var "Skicka en offert eller ett avtal för signering" (säljare).
--                                    Nu "Skapa och skicka en offert" för admin, koordinator och säljare, dator,
--                                    byggd som teknikerns offertguide. Avtal täcks av guide-skapa-avtalsforslag-kontor.
--                                    Slug behålls så att läsloggen fungerar. Version 2.
--   guide-skapa-avtal-offert         (ändrad text) ROT/RUT: mallen bestämmer avdraget, Nästa spärras när raderna
--                                    inte stämmer med mallen.
--   guide-skapa-avtalsforslag-kontor (ändrad text) Läs också: offertguiden.
-- Bara UPDATE. Inga DELETE eller DROP. Går att köra flera gånger.

-- 1. Kontoret och säljaren: Skapa och skicka en offert
update public.intranet_documents
set
  title = 'Skapa och skicka en offert',
  summary = 'Skapa Avtal & Offerter, Offert, mallen som bestämmer ROT eller RUT, befintlig eller ny kund, Dela upp för ROT/RUT, Kontroll före utskick och Oneflows PDF innan du skickar.',
  category = 'arenden',
  audience_roles = array['admin','koordinator','säljare'],
  sort_order = 64,
  version = greatest(version, 2),
  source_updated_at = now(),
  content = $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Skapa Avtal & Offerter överst i sidomenyn. Admin: Skapa avtal på Översikt","tar":"8 min","behover":"Kundens namn, telefon och e-post och vad jobbet kostar. För ROT eller RUT också personnummer, fastighetsbeteckning och hur mycket av priset som är arbete","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna Skapa Avtal & Offerter, välj Offert och den mall som passar kunden. Mallen bestämmer om offerten har ROT, RUT eller inget avdrag. Gå igenom stegen med [[Nästa]] och skicka med [[Skicka offerten]] när du har sett Oneflows PDF."},
    {"type":"visning","steg":[
      {"text":"Tryck Skapa Avtal & Offerter överst i sidomenyn.","ser":"Skapa avtal eller offert öppnas på steget Vad ska du skapa? Avtalsförslag är förvalt."},
      {"text":"Tryck Offert och sedan [[Nästa]].","ser":"Steget Mall visar offertmallarna. ROT- och RUT-mallarna står som Privatperson · ROT-avdrag och Privatperson · RUT-avdrag."},
      {"text":"Familjen Exempel ska ha ROT. Tryck Offertförslag, ROT (Privatperson) och sedan [[Nästa]] till Motpart.","ser":"Steget Avtalspart hoppas över, mallen säger att det är en privatperson. I Tjänster går nu bara ROT att välja."},
      {"text":"Tryck i Sök kund under Befintlig kund och skriv kundens namn.","ser":"Finns kunden trycker du [[Koppla|allman.plus]] på raden, så fylls fälten i från kundkortet. Står det Ingen kund hittades fyller du i namn, telefon och e-post nedan och trycker [[Nästa]]."},
      {"text":"I Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. Tryck sedan [[Dela upp för ROT/RUT|allman.kalkyl]] under tjänsten.","ser":"Formuläret visar Varav arbetskostnad, Timmar och Avdrag. Under Avdrag står bara ROT (30 %), eftersom mallen är ROT-mallen."},
      {"text":"Fyll i arbetskostnaden och timmarna och tryck [[Dela upp]].","ser":"Under tjänsten står Varav arbetskostnad 2 500 kr, 2 h, ROT och fältet Fastighetsbeteckning *. Fyll i det. Längst ner står ROT-avdrag och Att betala (kund)."},
      {"text":"Gå vidare med [[Nästa]] och [[Granska offerten]]. Tryck [[Skapa och visa Oneflows PDF]], läs PDF:en och tryck [[Skicka offerten]].","ser":"Det står Offerten är skickad. Kunden har fått offerten från info@begone.se och du skickas vidare till Dokumentsignering."}
    ]},
    {"type":"list","items":[
      "Dokument: Offert är för engångsjobb med fast pris. Ett löpande avtal med årspremie har en egen guide, Skapa och skicka ett avtalsförslag.",
      "Mall: mallen styr offertens fasta text i Oneflow och bestämmer avdraget. Offertförslag, ROT (Privatperson) söker ROT och Offertförslag, RUT (Privatperson) söker RUT. Med företagsmallen och mallen för privatpersoner inklusive moms går inget avdrag att välja. När mallen är vald försvinner steget Avtalspart.",
      "BeGone: du står som ansvarig.",
      "Motpart: överst står Befintlig kund. Sök på namn, org.nr eller kundnummer och tryck Koppla, så fylls fälten i från kundkortet. Ändringar gäller bara offerten, kundkortet ändras inte. Finns kunden inte fyller du i namn, telefon, e-post och e-post för faktura. Företag behöver också organisationsnummer.",
      "Tjänster: tryck Lägg till tilläggstjänst och välj tjänsten. ROT och RUT dras bara på arbetskostnaden, som du delar ut med Dela upp för ROT/RUT. Arbetet blir en egen rad, Skadedjurstekniker timpris, och totalen mot kunden ändras inte.",
      "Offertinnehåll: texten kunden läser. Tryck Skriv förslag från tjänsterna för en färdig text och skriv till med kundens egna ord."
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag kan inte trycka Nästa","svar":"Bottenlisten säger vad som saknas eller är fel, till exempel Fyll i e-postadress, Lägg till minst en tjänst eller ett fel om ROT och RUT. Rätta det, så går det vidare."},
      {"fraga":"Det står Mallen gäller ROT, men \"Skadedjurstekniker timpris\" har RUT","svar":"Avdraget på raden passar inte mallen. Tryck Ändra under tjänsten och välj ROT, eller gå till steget Mall och välj RUT-mallen. Står det att mallen har inget ROT- eller RUT-avdrag väljer du ROT- eller RUT-mallen, eller tar bort uppdelningen. Raderna ändras aldrig av sig själva när du byter mall."},
      {"fraga":"Det står Dokumentet har både ROT och RUT","svar":"En offert kan bara ha ett avdrag. Byt avdraget på raderna så att alla har det mallen gäller."},
      {"fraga":"Det står att ROT/RUT ligger på en tjänst som inte är arbetstid","svar":"Avdraget ligger på en tjänst där material ingår i priset. Välj Inget avdrag på raden och tryck Dela upp för ROT/RUT, så hamnar avdraget på arbetskostnaden."},
      {"fraga":"Dela upp för ROT/RUT syns inte","svar":"Knappen visas bara med ROT- eller RUT-mallen, på en tjänst med pris som inte är låst av en prislista. Välj rätt mall i steget Mall."}
    ]},
    {"type":"bra","items":[
      "Inget skickas till kunden förrän du har sett Oneflows PDF och tryckt [[Skicka offerten]]. Kunden får offerten från info@begone.se.",
      "Mallen bestämmer avdraget. Texten om ROT eller RUT står i Oneflow-mallen: ROT-mallen söker 30 % och RUT-mallen 50 % av arbetskostnaden. Kunden betalar det som står i offerten, och avdraget hanteras mot Skatteverket.",
      "Byter du mall efter att ha delat upp arbetet ändras inga rader. Felet står i bottenlisten, Nästa går inte att trycka, och granskningen visar det som en röd punkt tills raden eller mallen är rättad.",
      "Arbetsraden följer med när offerten bokas in: på ärendet ligger arbetskostnaden kvar under tjänsten med avdraget och fastighetsbeteckningen, och på fakturan står den som arbetskostnad för tjänsten.",
      "[[Tillbaka och ändra]] tar bort utkastet i Oneflow. [[Spara som utkast]] lägger det i Dokumentsignering, där du skickar det senare."
    ]},
    {"type":"callout","variant":"warning","title":"Personnummer och fastighetsbeteckning","text":"Fyll i Fastighetsbeteckning under arbetskostnaden och kundens personnummer i Motpart redan i offerten. De följer med till ärendet när offerten bokas in, och utan fastighetsbeteckning går ärendet inte att fakturera med avdrag."},
    {"type":"callout","variant":"info","title":"Rabatt på offerten","text":"Rabatt ger du i steget Tjänster: tryck Prisguide, skriv procenten i Rabatt % och skriv en motivering. Nästa går inte att trycka förrän motiveringen är skriven. Offerten kan inte skickas förrän en rabattansvarig har godkänt rabatten, det står i granskningen. Arbetsraden får samma rabatt och godkänns med tjänsten."},
    {"type":"ovning","uppdrag":"Familjen Exempel vill ha en offert på tätning av ventil, 3 750 kr inkl. moms. 2 500 kr av det är arbete, två timmar, och familjen ska ha ROT. Fastigheten heter Exempelby 1:23. Skapa offerten och skicka den."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har valt Offertförslag, ROT (Privatperson). Vilka avdrag kan du välja i Tjänster?","alternativ":["ROT och RUT","Bara ROT","Inget avdrag"],"ratt":1,"forklaring":"Mallen bestämmer avdraget. ROT-mallen söker ROT, så bara ROT syns i Tjänster."},
      {"fraga":"Du har delat upp arbetet med ROT och byter sedan till mallen för privatpersoner inklusive moms. Vad händer?","alternativ":["Avdraget tas bort av sig självt","Nästa spärras och bottenlisten säger att mallen inte har något ROT- eller RUT-avdrag","Offerten skickas med ROT ändå"],"ratt":1,"forklaring":"Raderna ändras aldrig av sig själva. Du väljer: tillbaka till ROT-mallen, eller ta bort uppdelningen."},
      {"fraga":"När får kunden offerten?","alternativ":["När du trycker Skapa och visa Oneflows PDF","När du har sett PDF:en och tryckt Skicka offerten","När du trycker Granska offerten"],"ratt":1,"forklaring":"Skapa och visa Oneflows PDF skapar bara ett utkast i Oneflow. Offerten går till kunden först när du trycker Skicka offerten."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-avtalsforslag-kontor","label":"Skapa och skicka ett avtalsförslag","description":"När kunden ska ha ett löpande avtal med årspremie."},
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn och vyerna."}
    ],"fraga":"Koordinatorn, eller en admin."}
  ]$json$::jsonb
where slug = 'guide-dokumentsignering-saljare';

-- 2. Teknikerns offertguide: mallen bestämmer avdraget
update public.intranet_documents
set
  content = replace(replace(replace(replace(replace(content::text,
    'Det finns mallar för företag exklusive moms och för privatpersoner inklusive moms, med ROT och med RUT. När mallen är vald försvinner steget Avtalspart.',
    'Det finns mallar för företag exklusive moms och för privatpersoner inklusive moms, med ROT och med RUT. Mallen bestämmer avdraget: med ROT-mallen går bara ROT att välja och med RUT-mallen bara RUT. När mallen är vald försvinner steget Avtalspart.'),
    'Knappen visas bara när mallen gäller en privatperson, tjänsten har ett pris och priset inte är låst av en prislista. Är tjänsten själv Skadedjurstekniker timpris väljer du ROT eller RUT direkt på raden.',
    'Knappen visas bara med ROT- eller RUT-mallen, på en tjänst med pris som inte är låst av en prislista. Med de andra mallarna går inget avdrag att välja. Är tjänsten själv Skadedjurstekniker timpris väljer du avdraget direkt på raden.'),
    'Välj mallen Offertförslag, ROT (Privatperson) eller Offertförslag, RUT (Privatperson). Mallen väljer inte avdraget, det gör du i Tjänster.',
    'Välj mallen Offertförslag, ROT (Privatperson) eller Offertförslag, RUT (Privatperson). Mallen bestämmer avdraget: med ROT-mallen går bara ROT att välja i Tjänster, med RUT-mallen bara RUT. Byter du mall efteråt ändras inga rader, men Nästa går inte att trycka förrän raden eller mallen är rättad. Bottenlisten säger vad som inte stämmer.'),
    '"Mallen för ROT räcker, avdraget räknas ut av sig självt", "I Tjänster med Dela upp för ROT/RUT, på arbetskostnaden", "I Motpart, vid personnumret"',
    '"Mallen för ROT räcker, avdraget räknas ut av sig självt", "Med ROT-mallen, och sedan Dela upp för ROT/RUT i Tjänster på arbetskostnaden", "I Motpart, vid personnumret"'),
    'Mallen styr bara texten. Avdraget väljer du i Tjänster, och det läggs på en egen rad för arbetskostnaden.',
    'Mallen bestämmer att det blir ROT, och bara ROT går då att välja. Avdraget lägger du i Tjänster med Dela upp för ROT/RUT, på en egen rad för arbetskostnaden.')::jsonb,
  source_updated_at = now()
where slug = 'guide-skapa-avtal-offert'
  and content::text like '%Mallen väljer inte avdraget, det gör du i Tjänster.%';

-- 3. Kontorets avtalsguide: Läs också pekar på offertguiden
update public.intranet_documents
set
  content = replace(replace(content::text,
    '{"slug": "guide-roller-och-vyer-kontor", "label": "Hitta rätt i portalen", "description": "Sidomenyn och vyerna."}',
    '{"slug": "guide-dokumentsignering-saljare", "label": "Skapa och skicka en offert", "description": "När kunden vill ha ett engångsjobb med fast pris."}, {"slug": "guide-roller-och-vyer-kontor", "label": "Hitta rätt i portalen", "description": "Sidomenyn och vyerna."}'),
    'Dokument: Avtalsförslag är förvalt. Offert är för engångsjobb med fast pris.',
    'Dokument: Avtalsförslag är förvalt. Offert är för engångsjobb med fast pris och har en egen guide, Skapa och skicka en offert.')::jsonb,
  source_updated_at = now()
where slug = 'guide-skapa-avtalsforslag-kontor'
  and content::text not like '%"slug": "guide-dokumentsignering-saljare"%';
