-- Guiderättelse 2026-10-17: ärenden tas bort ur listan och schemat direkt efter Radera
-- (onDeleted), papperskorgen i Mina ärenden går samma väg som Radera (status Borttaget),
-- och följeärenden får eget ärendenummer. Skriver om fyra guider från
-- 20261016_guidemallen_40_arenden.sql med hela innehållet. Moduler i
-- src/pages/shared/intranet/guider/: guide-foljearenden, guide-foljearenden-kontor,
-- guide-avbryta-arenden och guide-avbryta-arenden-kontor.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-foljearenden',
  'Skapa ett följeärende',
  'Hittar du ett nytt skadedjur hos kunden skapar du ett eget ärende för det direkt i telefonen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren uppe till höger","tar":"2 min","behover":"Ett privat- eller företagsärende","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på fotspåren i ärendet, välj [[Skapa nytt ärende]] och välj det nya skadedjuret. Kund, adress, tid och tekniker kopieras. Det nya ärendet får eget ärendenummer, eget pris och egen arbetstid."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Skapa nytt ärende]].","ser":"Rutan Skapa nytt ärende öppnas. Kundinformation, adress och schemaläggning kopieras automatiskt."},
      {"text":"Tryck på Skadedjurstyp * och välj det nya skadedjuret.","ser":"Skadedjuret står i fältet. Knappen går att trycka på först när du har valt."},
      {"text":"Tryck [[Skapa nytt ärende|allman.plus]].","ser":"Det står till exempel Följeärende BE-0001235 skapat för Getingar! och det nya ärendet visas med sitt eget nummer och raden Detta är ett följeärende. I Mina ärenden ligger båda ärendena."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Står det Detta är ett följeärende kan du inte skapa ett till därifrån. Öppna det första ärendet och gör det där."},
      {"fraga":"Knappen Skapa nytt ärende går inte att trycka på","svar":"Du har inte valt skadedjurstyp. Tryck på Skadedjurstyp * och välj."},
      {"fraga":"Det står Kunde inte skapa följeärende","svar":"Inget nytt ärende skapades. Försök igen. Går det inte, skriv till koordinatorn och ange ärendenumret."},
      {"fraga":"Jag står i ett avtalsärende","svar":"Där heter valet [[Kopiera ärende]] och knappen [[Skapa följeärende]]. I övrigt gör du likadant."}
    ]},
    {"type":"bra","items":[
      "Följeärendet får samma kund, adress, tid och tekniker som ärendet du står i.",
      "Det nya ärendet får ett eget ärendenummer, status Bokad, ingen arbetstid och inget pris. Fyll i det som vanligt.",
      "Beskrivningen blir Följeärende från ursprungsärende. Nytt skadedjursproblem: följt av skadedjuret. Skriv gärna till vad du såg.",
      "Samma skadedjur igen är ett återbesök, inte ett följeärende.",
      "Från ett följeärende går det inte att skapa ett nytt följeärende."
    ]},
    {"type":"ovning","uppdrag":"Du är hos Familjen Exempel för råttorna och ser ett getingbo under taket. Skapa ett nytt ärende för getingarna."},
    {"type":"quiz","fragor":[
      {"fraga":"Kunden har råttor och du hittar silverfisk i badrummet. Vad gör du?","alternativ":["Bokar ett återbesök","Skapar ett nytt ärende med fotspåren","Skriver det i råttärendets beskrivning"],"ratt":1,"forklaring":"Ett nytt skadedjur får ett eget ärende med eget pris. Fotspåren och Skapa nytt ärende kopierar kunden åt dig."},
      {"fraga":"Vad följer med till det nya ärendet?","alternativ":["Kund, adress, tid och tekniker","Pris och arbetstid","Rapporten"],"ratt":0,"forklaring":"Kunden och bokningen kopieras. Pris, arbetstid och rapport börjar om från noll."},
      {"fraga":"Det står Detta är ett följeärende och fotspåren syns inte. Varför?","alternativ":["Ärendet är avslutat","Det går inte att skapa följeärenden från ett följeärende","Du saknar behörighet"],"ratt":1,"forklaring":"Öppna det första ärendet och skapa det nya därifrån."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma problem, nästa besök i samma ärende."},
      {"slug":"guide-avbryta-arenden","label":"Avbryt eller ta bort ett ärende","description":"När kunden avbokar."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 62, now(), array['technician']
),
(
  'guide-foljearenden-kontor',
  'Skapa ett följeärende',
  'Ringer kunden om ett nytt skadedjur skapar du ett följeärende från det befintliga ärendet, utan att fylla i kunden igen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Schemat › ärendet › fotspåren uppe till höger","tar":"2 min","behover":"Ett privat- eller företagsärende för kunden","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna kundens ärende i schemat, tryck på fotspåren och välj [[Skapa nytt ärende]]. Välj det nya skadedjuret. Kund, adress, tid och tekniker kopieras. Det nya ärendet får eget ärendenummer och hamnar på samma tid i schemat."},
    {"type":"visning","steg":[
      {"text":"Tryck på kundens besök i schemat.","ser":"Ärendet öppnas."},
      {"text":"Tryck på fotspåren uppe till höger.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Skapa nytt ärende]].","ser":"Rutan Skapa nytt ärende öppnas. Kundinformation, adress och schemaläggning kopieras automatiskt."},
      {"text":"Tryck på Skadedjurstyp * och välj det nya skadedjuret.","ser":"Skadedjuret står i fältet."},
      {"text":"Tryck [[Skapa nytt ärende|allman.plus]].","ser":"Det står till exempel Följeärende BE-0001235 skapat för Getingar!. Ärendet stängs och det nya ligger i schemat på samma tid och tekniker som det första."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser inga fotspår","svar":"Står det Detta är ett följeärende kan du inte skapa ett till därifrån. Öppna det första ärendet och gör det där."},
      {"fraga":"Knappen Skapa nytt ärende går inte att trycka på","svar":"Du har inte valt skadedjurstyp. Tryck på Skadedjurstyp * och välj."},
      {"fraga":"Det står Kunde inte skapa följeärende","svar":"Inget nytt ärende skapades. Försök igen, eller skapa ärendet med [[Nytt ärende]] i schemat."},
      {"fraga":"Det gäller ett avtalsärende","svar":"Där heter valet [[Kopiera ärende]] och knappen [[Skapa följeärende]]. I övrigt gör du likadant."}
    ]},
    {"type":"bra","items":[
      "Det nya ärendet får samma tid och tekniker som det första. Ska det göras en annan tid öppnar du det nya ärendet och ändrar tiden, eller drar det i schemat.",
      "Det nya ärendet får ett eget ärendenummer, status Bokad, ingen arbetstid och inget pris. Det första ärendet behåller sitt nummer.",
      "Beskrivningen blir Följeärende från ursprungsärende. Nytt skadedjursproblem: följt av skadedjuret.",
      "Samma skadedjur igen är ett återbesök, inte ett följeärende.",
      "Från ett följeärende går det inte att skapa ett nytt följeärende."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ett bokat råttärende och ringer om getingar. Skapa ett följeärende för getingarna."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hamnar det nya ärendet i schemat?","alternativ":["Bland ärenden att boka in","På samma tid och tekniker som det första","Dagen efter"],"ratt":1,"forklaring":"Tiden och teknikerna kopieras. Flytta det nya ärendet om det ska göras en annan gång."},
      {"fraga":"Kunden ringer om samma råttor igen efter besöket. Vad gör du?","alternativ":["Skapar ett följeärende","Bokar ett återbesök i ärendet","Skapar ett Engångsjobb Privatperson"],"ratt":1,"forklaring":"Samma problem fortsätter i samma ärende som ett återbesök. Följeärenden är för nya skadedjur."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schemavyn","label":"Hitta och flytta besök i schemat","description":"Dra det nya ärendet till rätt tid."},
      {"slug":"guide-skapa-arenden","label":"Skapa ett ärende och välj rätt ärendetyp","description":"När kunden inte har något ärende sedan tidigare."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 63, now(), array['admin','koordinator']
),
(
  'guide-avbryta-arenden',
  'Avbryt eller ta bort ett ärende',
  'Avbokar kunden skriver du varför i ärendet och tar sedan bort det. Ingenting raderas på riktigt.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › [[Radera|allman.radera]] längst ner till vänster","tar":"2 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Skriv först i ärendets kommunikation varför det avbryts. Tryck sedan [[Radera|allman.radera]] längst ner och [[Ta bort]]. Ärendet får status Borttaget och försvinner direkt ur listan, men all data finns kvar."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på pratbubblan uppe till höger.","ser":"Kommunikation öppnas."},
      {"text":"Skriv varför ärendet avbryts, till exempel att kunden avbokade. Tryck på den gröna pilen.","ser":"Kommentaren visas i panelen."},
      {"text":"Stäng panelen med krysset uppe till höger.","ser":"Du är tillbaka i ärendet."},
      {"text":"Tryck [[Radera|allman.radera]] längst ner till vänster.","ser":"Rutan Ta bort ärende öppnas: Ärendet markeras som borttaget och döljs från alla vyer. All data behålls."},
      {"text":"Tryck [[Ta bort|allman.radera]].","ser":"Det står Ärendet har tagits bort. Ärendet stängs och är borta ur Mina ärenden."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag hittar inte Radera","svar":"Den står i liten röd text längst ner till vänster i ärendet, bredvid Avbryt och Spara ändringar."},
      {"fraga":"Jag har många gamla ärenden som ska bort","svar":"Gå till fliken Gamla ärenden i Mina ärenden. Kryssa i ärendena och tryck [[Ta bort markerade]], med antalet inom parentes. Välj Anledning * och tryck på den röda knappen längst ner. Alla får status Borttaget."},
      {"fraga":"Det står Kunde inte markera ärendet som borttaget","svar":"Ingenting ändrades och ärendet ligger kvar. Försök igen, eller skriv till koordinatorn och ange ärendenumret."},
      {"fraga":"Jag tog bort fel ärende","svar":"Säg till koordinatorn direkt och ange ärendenumret. Ingenting är raderat, all data finns kvar."}
    ]},
    {"type":"bra","items":[
      "Ta bort raderar inget på riktigt. Ärendet får status Borttaget och döljs. Kommentarer, bilder och historik finns kvar.",
      "Skriv alltid varför i kommentaren innan du tar bort. Då vet kontoret vad som hände om kunden hör av sig igen.",
      "Ta bara bort ärenden som inte ska göras: kunden avbokar, kunden går inte att nå eller ärendet är en dubblett.",
      "Ska besöket bara flyttas tar du inte bort något. Säg till koordinatorn i stället.",
      "Papperskorgen på kortet i Mina ärenden gör samma sak som Radera: status Borttaget. Där väljer du Anledning * i stället för att skriva en kommentar."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ringt och avbokat. Skriv i ärendet att kunden avbokade och ta sedan bort ärendet."},
    {"type":"quiz","fragor":[
      {"fraga":"Vad gör du först när kunden avbokar?","alternativ":["Trycker Radera direkt","Skriver i kommentaren varför ärendet avbryts","Ändrar status till Avslutat"],"ratt":1,"forklaring":"Kommentaren finns kvar efteråt och visar varför ärendet avbröts."},
      {"fraga":"Vad händer med bilderna när du tar bort ett ärende?","alternativ":["De raderas","De finns kvar","De skickas till kunden"],"ratt":1,"forklaring":"All data behålls. Ärendet får bara status Borttaget och döljs."},
      {"fraga":"Kunden vill ha en annan dag. Vad gör du?","alternativ":["Tar bort ärendet och skapar ett nytt","Säger till koordinatorn att flytta besöket","Ingenting"],"ratt":1,"forklaring":"Ärendet ska vara kvar, bara tiden ändras."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-foljearenden","label":"Skapa ett följeärende","description":"Nytt skadedjur hos samma kund."},
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Samma problem, nästa besök."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 64, now(), array['technician']
),
(
  'guide-avbryta-arenden-kontor',
  'Avbryt eller ta bort ett ärende',
  'Avbokar kunden skriver du varför i ärendet och tar sedan bort det från schemat. Ingenting raderas på riktigt.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Schemat › ärendet › [[Radera|allman.radera]] längst ner till vänster","tar":"2 min","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna ärendet, skriv i kommunikationen varför det avbryts och tryck sedan [[Radera|allman.radera]] och [[Ta bort]]. Ärendet får status Borttaget och besöket försvinner direkt ur schemat, men all data finns kvar."},
    {"type":"visning","steg":[
      {"text":"Tryck på besöket i schemat.","ser":"Ärendet öppnas."},
      {"text":"Tryck på pratbubblan uppe till höger.","ser":"Kommunikation öppnas till höger."},
      {"text":"Skriv varför ärendet avbryts och tryck [[Skicka|rapport.skicka]].","ser":"Kommentaren visas i panelen."},
      {"text":"Stäng panelen med krysset uppe till höger.","ser":"Du är tillbaka i ärendet."},
      {"text":"Tryck [[Radera|allman.radera]] längst ner till vänster.","ser":"Rutan Ta bort ärende öppnas: Ärendet markeras som borttaget och döljs från alla vyer. All data behålls."},
      {"text":"Tryck [[Ta bort|allman.radera]].","ser":"Det står Ärendet har tagits bort. Ärendet stängs och besöket är borta ur schemat."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser borttagna ärenden i schemat","svar":"Du har kryssat i Borttaget under [[Filter|allman.filter]]. Kryssa ur det, så visas de inte."},
      {"fraga":"Det står Kunde inte markera ärendet som borttaget","svar":"Ingenting ändrades och ärendet ligger kvar. Försök igen."},
      {"fraga":"Jag behöver hitta ett borttaget ärende","svar":"Kryssa i Inkl. avslutade bredvid Sök ärende... i schemat. Då kommer borttagna ärenden med bland träffarna."}
    ]},
    {"type":"bra","items":[
      "Ta bort raderar inget på riktigt. Ärendet får status Borttaget och döljs. Kommentarer, bilder och historik finns kvar.",
      "Skriv alltid varför i kommentaren innan du tar bort. Kommentaren går att söka fram i efterhand.",
      "Ta bara bort ärenden som inte ska göras: kunden avbokar, kunden går inte att nå eller ärendet är en dubblett.",
      "Ska besöket bara flyttas tar du inte bort något. Dra det till den nya tiden i schemat.",
      "En ny förfrågan från en avtalskund som inte ska göras tar du inte bort. Du trycker [[Avvisa]] bland de väntande förfrågningarna och skriver AVVISA för att bekräfta."
    ]},
    {"type":"ovning","uppdrag":"Familjen Exempel har ringt och avbokat sitt besök på tisdag. Skriv varför i ärendet och ta sedan bort det."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har tagit bort ett ärende och kunden ringer om det dagen efter. Hur hittar du det?","alternativ":["Det går inte, det är raderat","Kryssar i Inkl. avslutade och söker i Sök ärende...","Letar i schemat på dagen för besöket"],"ratt":1,"forklaring":"Borttagna ärenden syns inte i schemat, men de finns kvar och kommer med i söket när du kryssar i Inkl. avslutade."},
      {"fraga":"Kunden vill byta dag. Vad gör du?","alternativ":["Tar bort ärendet och skapar ett nytt","Drar besöket till den nya dagen","Avvisar ärendet"],"ratt":1,"forklaring":"Ärendet ska vara kvar. Flytta besöket i schemat."},
      {"fraga":"Vad finns kvar efter att du tagit bort ett ärende?","alternativ":["Ingenting","Kommentarer, bilder och historik","Bara ärendenumret"],"ratt":1,"forklaring":"All data behålls. Ärendet får bara status Borttaget och döljs."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-schemavyn","label":"Hitta och flytta besök i schemat","description":"När kunden bara vill byta tid."},
      {"slug":"guide-skapa-arenden","label":"Skapa ett ärende och välj rätt ärendetyp","description":"Nytt ärende från schemat."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 65, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
