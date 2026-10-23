-- Guidemallen: kontorets Dokumentsignering byggdes om 2026-10-23 och gäller koordinator och
-- admin. Säljaren har kvar den gamla sidan. Därför delas guiden:
--   guide-dokumentsignering          Följ upp offerter och avtal i Dokumentsignering   admin, koordinator
--   guide-boka-in                    Boka in en signerad offert eller ett signerat avtal admin, koordinator
--   guide-dokumentsignering-saljare  Skicka en offert eller ett avtal för signering    säljare (oförändrad text)
-- Teknikerguiden (guide-dokumentsignering-tekniker) rörs inte: gamla teknikervyn gäller alla tekniker.
-- Guidemoduler i src/pages/shared/intranet/guider/ med samma namn, delade delar i _dokument.tsx.
-- Texter ur KontorDokumentsignering, components/coordinator/dokument/** (KontorLista, KontorDetalj,
-- KontorPaneler, kontorData), components/technician/ny/dokument/LoggaSamtal, bokaIn/BokaIn.tsx,
-- bokaIn/KorOmSignering.tsx, services/bokaInService.ts och CreateCaseModal.
-- Placering i handboken: handbokSektioner.ts, ämnet Försäljning.
-- Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-dokumentsignering',
  'Följ upp offerter och avtal i Dokumentsignering',
  'Kön i kontorets arbetsordning, Nästa steg-rutan, Påminn teknikern och kontaktloggen.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Menyn › Dokumentsignering","tar":"4 min","behover":"Inget. Kön visar vad som väntar","enhet":"dator"},
    {"type":"kortsvar","text":"Kön i Dokumentsignering står i den ordning kontoret arbetar: Att boka in, Väntar på kontoret, Fastnat hos tekniker och Bokade. Öppna ett dokument och gör det som står i Nästa steg-rutan. Samtal, påminnelser och förlängningar hamnar i Kontaktloggen."},
    {"type":"visning","steg":[
      {"text":"Tryck på Exempel AB under Fastnat hos tekniker.","ser":"Dokumentet öppnas till höger. Rutan överst säger Förföll för 2 dagar sedan och Nästa steg: påminn Erik att förlänga och ringa kunden, eller förläng och ring själv."},
      {"text":"Tryck [[Påminn Erik|upphandling.notis]] i rutan.","ser":"Påminnelsen till Erik öppnas. Där ser du notisen precis som Erik får den."},
      {"text":"Tryck [[Skicka påminnelsen|upphandling.notis]].","ser":"Det står Erik har fått påminnelsen. Påminnelsen står sist i Kontaktloggen, och raden i kön säger Teknikern påmind."},
      {"text":"Du har också ringt kunden utan att få svar. Tryck [[Logga kontakt|allman.anteckning]].","ser":"Rutan Logga kontakt med Anna Exempel öppnas, med Kanal, Hur gick det och Ring igen. Kanalen är redan Telefon."},
      {"text":"Tryck Inget svar under Hur gick det.","ser":"Inget svar är markerat."},
      {"text":"Tryck Imorgon under Ring igen.","ser":"Imorgon är markerat. Den dagen ligger dokumentet under Ring idag i Väntar på kontoret."},
      {"text":"Tryck [[Spara samtalet|allman.bock]].","ser":"Det står till exempel Samtalet är loggat, du ringer igen 2026-10-24. Samtalet står i Kontaktloggen och som grå rad i kön."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Påminn saknas","svar":"Den visas inte när du själv är säljare på dokumentet, och inte när dokumentet är signerat, avböjt eller avskrivet. Ring kunden själv och logga samtalet med [[Logga kontakt]]."},
      {"fraga":"Det står Erik Exempel har ingen inloggning i portalen","svar":"Teknikern kan inte få notiser, så ingen påminnelse har skickats. Ring teknikern eller kunden själv och logga det med [[Logga kontakt]]."},
      {"fraga":"Jag hittar inte dokumentet","svar":"Sök i rutan Sök kund, kontaktperson, ärendenummer eller tekniker, eller tryck / på tangentbordet. Väntar på kunden och Klara är hopfällda men öppnas när du söker. Har du dolt dokumentet trycker du på raden längst ner, till exempel Visa 2 dokument du har dolt."},
      {"fraga":"Var väljer jag koordinatorstatus?","svar":"Den finns inte längre. Det du gör loggas i Kontaktloggen: samtal, mejl, Oneflow, förlängningar, påminnelser, Boka in och Skriv av. Kön visar den senaste posten som en grå rad."},
      {"fraga":"Kunden har köpt av någon annan, men dokumentet ligger kvar","svar":"Tryck [[Skriv av|allman.arkiv]], välj Kunden valde någon annan och tryck [[Skriv av]] i rutan. Dokumentet flyttas till Klara. Blev det fel öppnar du menyn uppe till höger i dokumentet och trycker Ångra avskrivningen."}
    ]},
    {"type":"bra","items":[
      "Att boka in är signerade dokument som inte är inbokade, äldst först. Väntar på kontoret är Kunden har skrivit, Ring idag och Dina utkast att skicka.",
      "Fastnat hos tekniker är förfallna, fristen går ut inom 3 dagar, mejlet kom inte fram, inte öppnade efter 5 dagar, utkast som inte skickats och obesvarade i mer än 10 dagar. Bokade syns i 14 dagar. Väntar på kunden och Klara är hopfällda längst ner.",
      "[[Påminn Erik]] på teknikerns rad i kön påminner om alla hans dokument under Fastnat hos tekniker, en notis per dokument. Notisen öppnar dokumentet i teknikerns Dokumentsignering.",
      "Ditt eget utkast ligger under Dina utkast att skicka. [[Granska och skicka]] öppnar PDF:en, och där skickar du med [[Skicka för signering]], för en offert [[Skicka offerten]]. Dokumentet går från info@begone.se.",
      "[[Svara kunden]] öppnar skrivrutan med Till kunden i Oneflow. Kunden får då ett mejl från Oneflow. Intern anteckning syns för kontoret och säljaren, inte för kunden."
    ]},
    {"type":"ovning","uppdrag":"Avtalet till Exempel AB har förfallit. Påminn Erik. Du har också ringt kontaktpersonen Anna Exempel utan att få svar: logga samtalet och ring igen imorgon."},
    {"type":"quiz","fragor":[
      {"fraga":"En kund har just signerat. Var hittar du dokumentet?","alternativ":["Under Bokade","Överst under Att boka in","Under Väntar på kunden"],"ratt":1,"forklaring":"Signerade dokument som inte är inbokade ligger överst under Att boka in, äldst först."},
      {"fraga":"Var syns det att du har påmint teknikern?","alternativ":["I koordinatorstatusen","I Kontaktloggen och som grå rad i kön","Bara i teknikerns notiser"],"ratt":1,"forklaring":"Koordinatorstatusen finns inte längre. Allt kontoret gör blir en post i Kontaktloggen."},
      {"fraga":"Kunden har köpt av någon annan. Vad gör du?","alternativ":["Låter dokumentet ligga kvar","Trycker Skriv av och väljer Kunden valde någon annan","Väntar tills fristen går ut"],"ratt":1,"forklaring":"Skriv av flyttar dokumentet till Klara och anledningen hamnar i Kontaktloggen."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-boka-in","label":"Boka in en signerad offert eller ett signerat avtal","description":"Nästa steg när kunden har signerat."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 66, now(), array['admin','koordinator']
),
(
  'guide-boka-in',
  'Boka in en signerad offert eller ett signerat avtal',
  'Boka in från Dokumentsignering eller schemat: förvald ärendetyp, offertens rader och bokning hos den ansvariga teknikern.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Dokumentsignering › Att boka in › [[Boka in]]","tar":"4 min","behover":"Ett signerat dokument under Att boka in","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna dokumentet under Att boka in och tryck [[Boka in]]. Kontrollera ärendetypen och offertens rader och tryck [[Fortsätt till tid och tekniker]]. Bokningen är förifylld med den ansvariga teknikern. När du trycker [[Skapa & Boka Ärende]] stängs ursprungsärendet och raderna flyttas till det nya ärendet."},
    {"type":"visning","steg":[
      {"text":"Brf Exempelgården ligger överst under Att boka in och är öppen till höger. Tryck [[Boka in|arendelista.boka]] i Nästa steg-rutan.","ser":"Boka in Brf Exempelgården öppnas. Ärendetypen är förvald efter offertens mall, här Engångsjobb företag. Under Underlaget från signeringen står adress, kontakt, pris och ansvarig tekniker."},
      {"text":"Läs Offertens rader. Bocka ur Inspektion, den är redan gjord.","ser":"Det står stannar på ursprungsärendet och faktureras där. Längst ner står vad som händer: ursprungsärendet stängs, de valda raderna flyttas och en rad stannar."},
      {"text":"Tryck [[Fortsätt till tid och tekniker]].","ser":"Bokningsformuläret öppnas förifyllt, med rubriken Boka in Brf Exempelgården. Under Sök bland valda tekniker är bara Erik Exempel ibockad, den ansvariga teknikern."},
      {"text":"Tryck [[Hitta bästa tid & tekniker|allman.blixt]].","ser":"Bokningsförslagen för Erik visas."},
      {"text":"Tryck på förslaget som passar.","ser":"Starttid, Sluttid och Erik som ansvarig tekniker fylls i."},
      {"text":"Tryck [[Skapa & Boka Ärende|station.klar]].","ser":"Det står till exempel BE-0001234 bokat, 1 rad flyttade, BE-0001200 stängt. Dokumentet flyttas till Bokade och bokningen står i Kontaktloggen."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Kunden lades inte upp automatiskt","svar":"Avtalet signerades men kunden skapades inte i portalen. I Boka in, under Kör signeringen igen, står vad som saknas. Fyll i det under Fyll i på avtalet och tryck [[Spara och provkör igen]]. Läs Provkörning: det här görs om du kör igen och tryck [[Kör signeringen igen]]. Inget ändras i Oneflow."},
      {"fraga":"Det står Etableringen behöver kunden. Kör signeringen igen först.","svar":"Ett avtal bokas in som Etablering, och då måste kunden finnas. Kör signeringen igen som ovan. Sedan går det att fortsätta."},
      {"fraga":"Förvald är Inget ärende","svar":"Avtalet är ett avropsavtal och bokas när kunden gör ett avrop. Låt Anledning stå på Avropsavtal, bokas vid avrop och tryck [[Stäng utan nytt ärende]]. Dokumentet lämnar Att boka in."},
      {"fraga":"Det står Ärendet är bokat men efterstegen kunde inte köras","svar":"Det nya ärendet finns, men raderna eller ursprungsärendet blev inte klara. Boka inte in igen. Säg till en admin och ta med felmeddelandet."},
      {"fraga":"Offertens rader syns inte i bokningsformuläret","svar":"De läggs på ärendet när det sparas. Lägg inte in dem igen under Tjänster och fakturarader."}
    ]},
    {"type":"bra","items":[
      "Ärendetypen förväljs efter dokumentet. Ett avtal blir Etablering och ett avropsavtal Inget ärende. En offert följer mallen: företagsmallen ger Engångsjobb företag, privatmallen Engångsjobb privat, och ROT- och RUT-mallarna Engångsjobb privat med ROT eller RUT. Byt typ om det gäller något annat.",
      "Bara den ansvariga teknikern är ibockad när du söker tid. Bocka i fler om någon annan också ska kunna ta jobbet.",
      "För ett avtal flyttas inga rader. Premien faktureras via avtalets fakturaplan.",
      "Samma Boka in finns i schemat. Tryck på antalet att boka in i schemats huvud, till exempel 3 att boka in, och på kalenderikonen Boka in i schemat på raden.",
      "Inget ärende kräver en anledning: Avropsavtal, bokas vid avrop, Kunden valde någon annan, Dubblett eller Annat. Ursprungsärendet stängs då utan nytt ärende."
    ]},
    {"type":"ovning","uppdrag":"Brf Exempelgården har signerat offerten. Inspektionen är redan gjord på ursprungsärendet. Boka in bekämpningen hos Erik på första lediga tid."},
    {"type":"quiz","fragor":[
      {"fraga":"Ett avtal av typen Avropsavtal ligger under Att boka in. Vad gör du?","alternativ":["Bokar en Etablering","Väljer Inget ärende och trycker Stäng utan nytt ärende","Låter det ligga kvar"],"ratt":1,"forklaring":"Ett avropsavtal bokas när kunden gör ett avrop. Inget ärende är redan förvalt."},
      {"fraga":"En tjänst på offerten är redan utförd. Vad gör du med den?","alternativ":["Bockar ur den, då faktureras den på ursprungsärendet","Låter den följa med till det nya ärendet","Lägger in den igen i bokningsformuläret"],"ratt":0,"forklaring":"En urbockad rad stannar på ursprungsärendet och faktureras där."},
      {"fraga":"Vem är ibockad när du söker tid i bokningsformuläret?","alternativ":["Alla skadedjurstekniker","Bara dokumentets ansvariga tekniker","Ingen"],"ratt":1,"forklaring":"Den ansvariga teknikern är förvald. Bocka i fler om någon annan också kan ta jobbet."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-dokumentsignering","label":"Följ upp offerter och avtal i Dokumentsignering","description":"Kön, Nästa steg och Påminn teknikern."},
      {"slug":"guide-skapa-arenden","label":"Skapa ett ärende och välj rätt ärendetyp","description":"Ärendetyperna och bokningsassistenten."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 68, now(), array['admin','koordinator']
),
(
  'guide-dokumentsignering-saljare',
  'Skicka en offert eller ett avtal för signering',
  'Granska ett sparat utkast i Dokumentsignering och skicka det till kunden, utan att öppna Oneflow.',
  'handbok', 'arenden',
  $json$[
    {"type":"intro","roller":["säljare"],"var":"Menyn › Dokumentsignering › Utkast, ej skickade","tar":"2 min","behover":"Ett utkast sparat med [[Spara som utkast]] i Skapa Avtal & Offerter","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna utkastet överst i kön i Dokumentsignering. Tryck [[Visa PDF]] och läs igenom. Tryck [[Skicka för signering]], för en offert [[Skicka offerten]], och svara OK på frågan. Dokumentet skickas från info@begone.se."},
    {"type":"visning","steg":[
      {"text":"Tryck på dokumentet under Utkast, ej skickade överst i kön.","ser":"Dokumentet öppnas till höger. Det står Utkast, inte skickat till kunden. Granska PDF:en och skicka."},
      {"text":"Tryck [[Visa PDF]].","ser":"Oneflows PDF öppnas, precis som kunden kommer att se den."},
      {"text":"Läs igenom. Stämmer allt, tryck [[Skicka för signering]]. För en offert heter knappen [[Skicka offerten]].","ser":"En fråga visas, till exempel Skicka avtalet till anna@exempel.se från info@begone.se?"},
      {"text":"Kontrollera e-postadressen och tryck [[OK]].","ser":"Det står Avtalet är skickat för signering, eller Offerten är skickad. Dokumentet lämnar Utkast, ej skickade och bevakas i kön."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Du kan bara hantera dina egna utkast","svar":"Du skickar bara utkast som du själv har skapat eller står som avsändare på. Be koordinatorn skicka det."},
      {"fraga":"Det står Dokumentet är inte längre ett utkast i Oneflow","svar":"Någon har redan skickat eller ändrat dokumentet i Oneflow. Tryck på Uppdatera, pilarna uppe till höger, så ser du läget."},
      {"fraga":"Det står PDF:en är inte klar ännu","svar":"Oneflow håller på att skapa PDF:en. Vänta en stund och tryck [[Visa PDF]] igen."},
      {"fraga":"Ett fält i PDF:en är tomt","svar":"Skicka inte. Felet ligger i Oneflow-mallen. Säg till en admin."},
      {"fraga":"Jag hittar inte utkastet","svar":"Sök på kundens namn eller ärendenumret i Sök kund, ärendenr… Har du dolt dokumentet trycker du på raden med antalet dolda längst ner i kön, till exempel Visa 2 dolda."}
    ]},
    {"type":"bra","items":[
      "Utkast skapar du i Skapa Avtal & Offerter med [[Spara som utkast]] i sista steget. Där kan du också skicka direkt.",
      "Dokumentet skickas från info@begone.se till kontaktpersonens e-post.",
      "Du ser bara dina egna offerter och avtal.",
      "Skriver du i panelen och väljer Svar i Oneflow syns texten för kunden. Internt syns bara för oss.",
      "När kunden har signerat bokar kontoret in jobbet."
    ]},
    {"type":"ovning","uppdrag":"Avtalet till Exempel AB ligger som utkast. Granska PDF:en och skicka det för signering."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hittar du ett sparat utkast?","alternativ":["I Oneflow","Överst i kön i Dokumentsignering, under Utkast, ej skickade","I kundkortet"],"ratt":1,"forklaring":"Utkasten ligger överst i kön. Du behöver inte öppna Oneflow."},
      {"fraga":"Vilken adress skickas dokumentet från?","alternativ":["Din egen e-post","info@begone.se","Kundens e-post"],"ratt":1,"forklaring":"Alla utskick går från info@begone.se. Frågan före utskicket visar vilken adress det går till."},
      {"fraga":"Ett fält är tomt i PDF:en fast du fyllde i det. Vad gör du?","alternativ":["Skickar ändå","Säger till en admin, felet ligger i mallen","Skriver till kunden i Oneflow"],"ratt":1,"forklaring":"Kunden ska aldrig få ett dokument med tomma fält. Felet ligger i Oneflow-mallen."}
    ]},
    {"type":"avslut","lankar":[],"fraga":"Koordinatorn eller admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 69, now(), array['säljare']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
