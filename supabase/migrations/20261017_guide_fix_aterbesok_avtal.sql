-- Guiden Boka ett återbesök i ett avtalsärende efter rättningen 2026-10-17
-- (RevisitContractModal): rutan stängs efter bokningen, Start * börjar tom och
-- går inte att boka på nuvarande tid, tomt Slut ger samma längd som nuvarande
-- besök (annars 1 timme), delfaktureringen kan inte köras två gånger.
-- Egenkontroller öppnas för teknikern som avtalsärenden och bokas på samma sätt.
-- Guidemodul: src/pages/shared/intranet/guider/guide-aterbesok-avtal.tsx
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-aterbesok-avtal',
  'Boka ett återbesök i ett avtalsärende',
  'Boka nästa besök i ett avtalsärende eller en egenkontroll från telefonen, och fakturera merförsäljning direkt om kunden ska betala nu.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › fotspåren uppe till höger","tar":"3 min","behover":"Ett avtalsärende eller en egenkontroll som du har öppnat från schemat","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på fotspåren i avtalsärendet, välj [[Boka återbesök]] och välj en ny tid i Start *. Har du sålt något utöver avtalet kan du kryssa i Delfakturera dessa artiklar nu innan du bokar. Rutan stängs när återbesöket är bokat."},
    {"type":"visning","steg":[
      {"text":"Tryck på fotspåren uppe till höger i avtalsärendet.","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck [[Boka återbesök]].","ser":"Rutan Boka återbesök öppnas. Nuvarande datum visar ärendets tid nu. Start * är tom."},
      {"text":"Tryck på Start * och välj nytt datum och ny tid.","ser":"Den nya tiden står i fältet. Väljer du samma tid som nuvarande besök blir fältet rött och det står Samma tid som nuvarande besök. Välj en ny tid."},
      {"text":"Tryck på Slut (valfritt) och välj när besöket slutar, eller lämna fältet tomt.","ser":"Lämnar du fältet tomt får återbesöket samma längd som nuvarande besök, annars 1 timme."},
      {"text":"Har du sålt något utöver avtalet som ska faktureras nu? Kryssa i Delfakturera dessa artiklar nu under Tillagda artiklar.","ser":"Det står Artiklarna skickas till fakturering och rensas från ärendet. Lämna rutan tom om det ska faktureras när ärendet avslutas."},
      {"text":"Tryck [[Boka återbesök|allman.kalender]].","ser":"Det står Återbesök bokat. Rutan stängs och du är tillbaka i ärendet med den nya tiden och status Återbesök."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det går inte att trycka på Boka återbesök","svar":"Start * är tom eller har samma tid som nuvarande besök. Välj en ny tid. Står det Slut måste vara efter Start. när du trycker, välj en senare sluttid eller lämna Slut tomt."},
      {"fraga":"Jag ser inte Boka återbesök, bara Lägg till delbesök","svar":"Då är du i en rondering. Där bokar du ett delbesök i stället för ett återbesök."},
      {"fraga":"Rutan Tillagda artiklar syns inte","svar":"Den syns bara när ärendet har en ofakturerad rad under Tjänster & fakturarader och en artikel under Interna kostnader som är kopplad till tjänsten i Prisguiden. Annars finns inget att delfakturera."},
      {"fraga":"Det står Motivera rabatten på ... eller ... har kundpris men ingen tjänst att faktureras på","svar":"Öppna fliken Ekonomi. Vid rabatt skriver du i Motivering till rabatt (krävs vid avslut). Vid kundpris kopplar du artikeln mot en tjänst i [[Prisguide|allman.kalkyl]]. Boka sedan igen."},
      {"fraga":"Det står Raderna sparades men fakturan kunde inte skapas","svar":"Återbesöket är bokat men fakturan saknas. Skriv till admin och ange ärendenumret."}
    ]},
    {"type":"bra","items":[
      "Själva kontrollen faktureras inte. Den ingår i avtalet och täcks av årspremien.",
      "Bara det du har sålt utöver avtalet delfaktureras. Fakturan hamnar hos kontoret under Merförsäljning Avtal. Kryssar du inte i följer merförsäljningen med när ärendet avslutas.",
      "Samma artiklar kan aldrig faktureras två gånger. När de är skickade står det Artiklarna var redan skickade till fakturering. om någon försöker igen.",
      "Egenkontroller öppnas som avtalsärenden. Återbesöket bokas på samma sätt.",
      "Har du skrivit arbetsrapport sparas besöket i besökshistoriken, klockan uppe till höger."
    ]},
    {"type":"ovning","uppdrag":"Kontrollen hos Exempel AB är gjord och du har monterat två extra råttfällor som kunden har köpt. Boka återbesöket tisdag 2026-10-27 08:00 till 09:00 och fakturera fällorna nu."},
    {"type":"quiz","fragor":[
      {"fraga":"Du öppnar Boka återbesök och vill trycka på Boka återbesök direkt. Vad händer?","alternativ":["Knappen går inte att trycka på förrän du har valt en ny tid i Start *","Återbesöket bokas på samma tid som det nuvarande besöket","Ärendet avslutas"],"ratt":0,"forklaring":"Start * är tom när rutan öppnas, och samma tid som nuvarande besök går inte att boka."},
      {"fraga":"Vad faktureras när du kryssar i Delfakturera dessa artiklar nu?","alternativ":["Hela avtalsbesöket","Det du har sålt utöver avtalet","Årspremien för nästa period"],"ratt":1,"forklaring":"Besök som ingår i avtalet faktureras aldrig. Bara merförsäljningen går till fakturering."},
      {"fraga":"Du lämnar Slut (valfritt) tomt. Hur långt blir återbesöket?","alternativ":["Lika långt som nuvarande besök, annars 1 timme","0 minuter","Hela dagen"],"ratt":0,"forklaring":"Portalen tar längden från nuvarande besök. Saknas den blir det 1 timme."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-aterbesok","label":"Boka ett återbesök","description":"Privat- och företagsärenden, med förslag på tider."},
      {"slug":"guide-fakturering","label":"Fyll i fakturaraderna","description":"Tjänster, artiklar och merförsäljning under fliken Ekonomi."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 32, now(), array['technician']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
