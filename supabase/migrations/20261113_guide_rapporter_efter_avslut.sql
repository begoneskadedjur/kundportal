-- Guiderna för rapporten efter avslut och sidan Mina rapporter (3.132.0 och 3.132.1),
-- för teknikern i nya arbetsvyn.
--  1. Ny guide Skicka en rapport i efterhand (guide-skicka-rapport-efterhand).
--     Guidemodul: src/pages/shared/intranet/guider/guide-skicka-rapport-efterhand.tsx.
--  2. guide-kontrollrapport skrivs om: rutan Rapporten är klar i steget Klart först,
--     kortet Kontrollrapport i steget Rapport för en annan adress.
--  3. guide-fakturering: steg 7 om rutan Rapporten är klar, Bra att veta och övningen.
--  4. guide-utfora-arende, guide-stationskontroll och guide-roller-och-vyer: enstaka
--     texter om rutan i Klart och menyvalet Rapporter.
-- Texterna följer KlartSteg, KlartRapport, SkickaTillKundArk, NyRapporter och
-- InspectionReportSection. Idempotent: insert on conflict och jsonb_set med typkontroll.

-- 1. Ny guide ──────────────────────────────────────────────────────────────

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values (
  'guide-skicka-rapport-efterhand',
  'Skicka en rapport i efterhand',
  'Under Rapporter skickar du rapporten för ett avslutat ärende till kunden eller dig själv, eller laddar ned den, när du inte gjorde det direkt efter avslutet.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mer › Rapporter i telefonen. Rapporter i sidomenyn på datorn, under Mina ärenden","tar":"3 min","behover":"Ett avslutat ärende där du var tekniker 1, 2 eller 3","enhet":"mobil"},
    {"type":"kortsvar","text":"Under Rapporter står dina avslutade ärenden med rapporten. Tryck [[Skicka|rapport.skicka]] på raden, välj Till kunden och tryck [[Skicka|rapport.skicka]] när adressen stämmer. [[Ladda ned|rapport.ladda]] ger dig PDF:en. Inget skickas av sig självt."},
    {"type":"visning","steg":[
      {"text":"Öppna Rapporter. I telefonen: tryck [[Mer|allman.meny]] och sedan [[Rapporter|rapport.rapport]] under Min dag. På datorn: tryck Rapporter i sidomenyn.","ser":"Mina rapporter öppnas. Dina avslutade ärenden de senaste 30 dagarna står per månad, senaste först, med kundens e-post på varje rad."},
      {"text":"Är ärendet äldre än 30 dagar: tryck [[90 dagar]]. 12 mån visar ett helt år.","ser":"Listan visar också äldre månader, här September 2026."},
      {"text":"Tryck i Sök kund eller ärendenummer och skriv Exempel AB.","ser":"Bara rader som matchar kunden, ärendenumret, kontaktpersonen eller e-postadressen syns."},
      {"text":"Tryck [[Skicka|rapport.skicka]], den gröna knappen på raden.","ser":"Rutan Skicka rapporten öppnas med Till kunden och kundens adress, och Till mig med din adress."},
      {"text":"Tryck Till kunden.","ser":"Frågan Skicka till kund? visar adressen rapporten går till. Inget är skickat än."},
      {"text":"Kontrollera adressen och tryck [[Skicka|rapport.skicka]].","ser":"Notisen Rapport skickad till Anna Exempel! visas. Kunden får rapporten som PDF."},
      {"text":"Vill du ha rapporten själv: tryck [[Ladda ned|rapport.ladda]] på raden.","ser":"PDF:en laddas ned och notisen Rapport nedladdad! visas. På datorn har panelen till höger också Ladda ned PDF, Skicka till mig och Öppna ärendet."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inte ärendet","svar":"Listan visar bara ärenden med status Avslutat där du var tekniker 1, 2 eller 3. Välj en längre period, 90 dagar eller 12 mån, och töm sökrutan. Egenkontroller har ingen ärenderapport och visas inte. Är ärendet inte avslutat finns det i Mina ärenden."},
      {"fraga":"Adressen är fel, eller det står Kunden saknar e-post i ärendet","svar":"Adressen kommer från ärendets kunduppgifter. Öppna ärendet och rätta e-postadressen innan du skickar: på datorn med [[Öppna ärendet|arende.arende]] i panelen, i telefonen under Mina ärenden, Avslutade. På datorn kan du också skriva en annan adress i fältet under Skicka till kund. Den gäller bara det utskicket, ärendet ändras inte. För en kontrollrapport kommer adressen från kundkortet, be koordinatorn rätta den."},
      {"fraga":"Skicka till mig går till fel adress, eller det står Ditt konto saknar e-post","svar":"Till mig använder e-postadressen på ditt personalkort, inte adressen du loggar in med i Mitt konto. Be koordinatorn rätta den."},
      {"fraga":"Det står Rapporten kunde inte hämtas. Öppna ärendet och försök där.","svar":"Rapporten gick inte att ta fram från listan. Öppna ärendet och skicka den från steget Rapport. Står det Ingen avslutad kontrollrunda hittades är stationskontrollen inte klarmarkerad."},
      {"fraga":"Frågan säger att rapporten skickades till kunden förut","svar":"Kunden har redan fått en rapport för ärendet. Skickar du igen får kunden en ny version. Tryck [[Avbryt]] om kunden redan har den."}
    ]},
    {"type":"bra","items":[
      "Rapporter finns bara i nya arbetsvyn. I gamla vyn skickar du rapporten från ärendet som tidigare.",
      "Inget skickas av sig självt. Till kunden frågar alltid Skicka till kund? och visar adressen först. Till mig skickar direkt till din egen e-post.",
      "Privat- och företagsärenden har saneringsrapporten, stationskontroller kontrollrapporten och avtalsbesök och ronderingar ärenderapporten. Alla typer smalnar av listan till en sort.",
      "På datorn finns Ladda ned Excel för kontrollrapporter. Adressfältet i panelen skickar till någon annan än kunden, till exempel en förvaltare.",
      "Direkt när du stänger ett ärende visar steget Klart rutan Rapporten är klar. Väljer du Skicka inte nu där hittar du rapporten här."
    ]},
    {"type":"ovning","uppdrag":"Exempel AB har bett om saneringsrapporten från besöket i september. Du stängde ärendet och valde Skicka inte nu. Hitta rapporten under Rapporter och skicka den till kunden."},
    {"type":"quiz","fragor":[
      {"fraga":"Du valde Skicka inte nu när du stängde ärendet. Var hittar du rapporten sedan?","alternativ":["Under Rapporter, i telefonen under Mer","Under Specialrapporter","Ingenstans, den skickas till kunden av sig själv nästa dag"],"ratt":0,"forklaring":"Rapporten finns kvar under Rapporter. Inget skickas av sig självt."},
      {"fraga":"Besöket var för två månader sedan och syns inte i listan. Vad gör du?","alternativ":["Söker på kundens namn","Väljer 90 dagar","Ber kontoret skicka rapporten"],"ratt":1,"forklaring":"Listan visar 30 dagar när sidan öppnas. Sökningen letar bara i perioden du har valt. 90 dagar eller 12 mån visar äldre ärenden."},
      {"fraga":"Du har tryckt Skicka på raden och sedan Till kunden. Har kunden fått rapporten?","alternativ":["Ja, direkt","Nej, först när du trycker Skicka i frågan Skicka till kund?","Nej, kontoret måste godkänna den först"],"ratt":1,"forklaring":"Frågan visar adressen. Rapporten skickas när du trycker Skicka där."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-fakturering","label":"Stäng ärendet eller bara besöket","description":"Steget Klart och rutan Rapporten är klar."},
      {"slug":"guide-kontrollrapport","label":"Skicka kontrollrapporten till kunden","description":"Rapporten efter en stationskontroll."},
      {"slug":"guide-mina-arenden","label":"Håll koll på dina ärenden i Mina ärenden","description":"Att göra, Kommande och Avslutade."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 35, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section,
  category = excluded.category, content = excluded.content, is_published = excluded.is_published,
  sort_order = excluded.sort_order, source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;

-- 2. guide-kontrollrapport ───────────────────────────────────────────────

update public.intranet_documents
set summary = 'Kontrollrapporten efter en stationskontroll: rutan Rapporten är klar i steget Klart, och kortet i steget Rapport när rapporten ska till en annan adress.',
    content = $json$[
      {"type":"intro","roller":["technician"],"var":"Kontrollbesöket › steget Klart, eller steget Rapport","tar":"3 min","behover":"En klarmarkerad stationskontroll","enhet":"mobil"},
      {"type":"kortsvar","text":"När kontrollen är klarmarkerad visar steget Klart rutan Rapporten är klar. Tryck [[Skicka till kund|rapport.skicka]], kontrollera adressen och tryck [[Skicka|rapport.skicka]]. Ska rapporten till en annan adress skickar du den från kortet Kontrollrapport i steget Rapport. Kunden hittar samma rapport i sin portal under Rapporter."},
      {"type":"visning","steg":[
        {"text":"Tryck [[Skicka till kund|rapport.skicka]] i rutan Rapporten är klar i steget Klart. Under knappen står kundens adress.","ser":"Frågan Skicka till kund? visar Kontrollrapporten för ärendenumret skickas till: och adressen."},
        {"text":"Kontrollera adressen och tryck [[Skicka|rapport.skicka]].","ser":"Notisen Kontrollrapporten skickad till adressen visas. Rutan visar Kontrollrapporten är skickad och Skickad till adressen."},
        {"text":"Ska rapporten till en annan adress, till exempel en förvaltare: tryck på ikonen för steget Rapport i stegraden, den tredje från vänster.","ser":"Steget Rapport visar Arbetsrapport och kortet Kontrollrapport med Kontrollrunda avslutad och knapparna PDF, Excel och Skicka till kund."},
        {"text":"Tryck [[Skicka till kund]] i kortet.","ser":"Fältet Mottagare öppnas med kundens kontaktadress ifylld."},
        {"text":"Tryck i fältet och skriv den andra adressen.","ser":"Adressen står i fältet och Skicka går att trycka på."},
        {"text":"Tryck [[Skicka]].","ser":"Frågan Skicka kontrollrapporten som PDF till adressen? visas med Avbryt och Bekräfta och skicka."},
        {"text":"Tryck [[Bekräfta och skicka]].","ser":"Notisen Kontrollrapporten skickad till adressen visas. Mottagaren får rapporten som PDF i mejlet."}
      ]},
      {"type":"felsok","items":[
        {"fraga":"Rutan Rapporten är klar eller kortet Kontrollrapport syns inte","svar":"De visas först när kontrollrundan är klarmarkerad. Gå till steget Arbetet och klarmarkera rundan."},
        {"fraga":"Det står Kunden saknar e-post i ärendet, så rapporten kan inte skickas till kunden härifrån.","svar":"Gå till steget Rapport, tryck [[Skicka till kund]] och skriv adressen i Mottagare. Där står Kunden saknar kontakt-e-post i kundregistret, ange mottagare manuellt. Be koordinatorn lägga in adressen på kunden så att den finns nästa gång."},
        {"fraga":"Det står Ange en giltig e-postadress.","svar":"Adressen saknar något, till exempel @ eller punkt. Rätta den, så går Skicka att trycka på."},
        {"fraga":"Kunden säger att mejlet inte kom","svar":"Rapporten skickas från noreply@begone.se. Be kunden titta i skräpposten. Bilagor över 8 MB skickas inte, ladda då ned PDF:en och skriv en ticket till rollen Koordinator."}
      ]},
      {"type":"bra","items":[
        "Kunden hittar samma rapport själv i sin portal under Rapporter, fliken Kontrollrapporter, som PDF eller Excel.",
        "Rapporten skickas aldrig av sig själv. Skicka inte nu fäller ihop rutan i Klart. Rapporten finns sedan under Rapporter, där du kan skicka eller ladda ned den när du vill.",
        "Rutan i Klart har också Ladda ned PDF, Ladda ned Excel och Skicka till mig, som går till din egen e-post. Skicka till kund där går alltid till kundens adress.",
        "Svar från kunden går till info@begone.se, inte till dig.",
        "I Ärendets verktyg uppe till höger leder Kontrollrapport också till steget Rapport."
      ]},
      {"type":"ovning","uppdrag":"Skicka kontrollrapporten för Brf Exempelgården till förvaltaren, forvaltning@exempelgarden.se, i stället för kundens vanliga adress."},
      {"type":"quiz","fragor":[
        {"fraga":"Var hittar kunden kontrollrapporten utan att du mejlar den?","alternativ":["I sin portal under Rapporter, fliken Kontrollrapporter","Bara i mejlet från dig","På fakturan"],"ratt":0,"forklaring":"Avslutade kontrollrundor syns i kundportalen under Rapporter, med PDF och Excel."},
        {"fraga":"Du står i steget Klart men rutan Rapporten är klar syns inte. Varför?","alternativ":["Kunden saknar e-post","Kontrollrundan är inte klarmarkerad än","Rapporten är redan skickad"],"ratt":1,"forklaring":"Rutan visas när rundan är klarmarkerad i steget Arbetet och ärendet är avslutat."},
        {"fraga":"Kunden vill att förvaltaren får rapporten. Vad gör du?","alternativ":["Skriver förvaltarens adress i Mottagare i steget Rapport innan du trycker Skicka","Trycker Skicka till kund i rutan i Klart","Ändrar kundens e-post i kundregistret"],"ratt":0,"forklaring":"Skicka till kund i Klart går alltid till kundens adress. Mottagare i steget Rapport går att ändra fritt, och kundregistret ändras inte av det."}
      ]},
      {"type":"avslut","fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator.","lankar":[
        {"slug":"guide-stationskontroll","label":"Gör en stationskontroll","description":"Rundan, stationsarket och klarmarkeringen."},
        {"slug":"guide-skicka-rapport-efterhand","label":"Skicka en rapport i efterhand","description":"Rapporter, när du valde Skicka inte nu."},
        {"slug":"guide-stationer-sidan","label":"Hitta en kunds stationer och kontroller","description":"Sidan Stationer och kundens sida."}
      ]}
    ]$json$::jsonb,
    source_updated_at = now()
where slug = 'guide-kontrollrapport';

-- 3. guide-fakturering ───────────────────────────────────────────────────

update public.intranet_documents
set summary = 'Steget Klart: kontrollen före stängning, Hela ärendet eller Bara besöket, vad som händer med fakturan och rutan Rapporten är klar efteråt.',
    content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
      '{1,text}', to_jsonb('I steget Klart väljer du Hela ärendet eller Bara besöket. [[Stäng hela ärendet]] gör en faktura av raderna, som går vidare till godkännande och Fortnox. Inget skickas till kunden direkt. När ärendet är stängt visar Klart rutan Rapporten är klar, där du skickar eller laddar ned rapporten. Ska du tillbaka väljer du Bara besöket i stället.'::text)),
      '{2,steg,6}', $json${"text":"Tryck [[Skicka till kund|rapport.skicka]] i rutan Rapporten är klar. Under knappen står kundens adress.","ser":"Frågan Skicka till kund? visar adressen. Tryck [[Skicka|rapport.skicka]] så får kunden rapporten. Vill du vänta: tryck Avbryt och sedan Skicka inte nu. Rapporten finns kvar under Rapporter."}$json$::jsonb),
      '{4,items,2}', to_jsonb('Rapporten skickas inte av sig själv. När ärendet är stängt visar Klart rutan Rapporten är klar med Skicka till kund, Ladda ned PDF, Skicka till mig och Skicka inte nu. Du kan också skicka den i steget Rapport innan du stänger.'::text)),
      '{6,uppdrag}', to_jsonb('Jobbet hos Familjen Exempel är klart och raderna är ifyllda med ROT. Fastighetsbeteckningen saknas, den är Exempelby 1:23. Stäng hela ärendet och skicka sedan rapporten till kunden.'::text)),
    source_updated_at = now()
where slug = 'guide-fakturering'
  and content->1->>'type' = 'kortsvar'
  and content->2->>'type' = 'visning'
  and jsonb_array_length(content->2->'steg') between 6 and 7
  and content->4->>'type' = 'bra'
  and content->6->>'type' = 'ovning';

-- 4. Enstaka texter ──────────────────────────────────────────────────────

-- Gör ett besök steg för steg: sista steget och quizfrågan om rapporten
update public.intranet_documents
set content = jsonb_set(jsonb_set(jsonb_set(content,
      '{2,steg,6,ser}', to_jsonb('Klart kontrollerar ärendet och låter dig välja Hela ärendet eller Bara besöket. När ärendet är stängt kan du skicka rapporten där, i rutan Rapporten är klar. Guiden Stäng ärendet eller bara besöket går igenom steget.'::text)),
      '{7,fragor,1,alternativ,0}', to_jsonb('Du skickar den i steget Rapport, eller i rutan Rapporten är klar när ärendet är stängt'::text)),
      '{7,fragor,1,forklaring}', to_jsonb('Rapporten skickas inte av sig själv. Skicka den i steget Rapport, i rutan Rapporten är klar i steget Klart, eller senare under Rapporter.'::text)),
    source_updated_at = now()
where slug = 'guide-utfora-arende'
  and content->2->>'type' = 'visning'
  and jsonb_array_length(content->2->'steg') = 7
  and content->7->>'type' = 'quiz';

-- Gör en stationskontroll: sista steget och länken till kontrollrapporten
update public.intranet_documents
set content = jsonb_set(jsonb_set(content,
      '{2,steg,6,ser}', to_jsonb('Ärendet får status Avslutat och du hamnar i steget Klart med Ärendet är avslutat och rutan Rapporten är klar. Där skickar du kontrollrapporten till kunden eller laddar ned den.'::text)),
      '{8,lankar,0,description}', to_jsonb('Rutan Rapporten är klar i Klart och kortet i steget Rapport.'::text)),
    source_updated_at = now()
where slug = 'guide-stationskontroll'
  and content->2->>'type' = 'visning'
  and jsonb_array_length(content->2->'steg') = 7
  and content->8->>'type' = 'avslut'
  and content->8->'lankar'->0->>'slug' = 'guide-kontrollrapport';

-- Hitta rätt i nya arbetsvyn: menyvalet Rapporter under Min dag
update public.intranet_documents
set content = jsonb_set(content,
      '{4,items,4}', to_jsonb('Rapporter under Min dag, i telefonen under Mer, listar dina avslutade ärenden. Där skickar du rapporten till kunden eller laddar ned den i efterhand.'::text)),
    source_updated_at = now()
where slug = 'guide-roller-och-vyer'
  and content->4->>'type' = 'bra'
  and jsonb_array_length(content->4->'items') between 4 and 5;
