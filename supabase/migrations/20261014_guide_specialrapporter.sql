-- Handboksguide om Specialrapporter (3.50.0 till 3.54.1) för tekniker, koordinator och admin.
-- Två interaktiva delar (src/pages/shared/intranet/interactive/specialrapporter/):
-- specialrapport-delar (klickbar miniatyr av Rapportens delar) och
-- specialrapport-snygga-till (övning i att välja bort ändringar).
-- Ingen läskvittens. Idempotent: on conflict på slug skriver om guiden, inget tas bort.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-specialrapporter',
  'Specialrapporter: en rapport för krångliga uppdrag',
  'När du använder en specialrapport, hur du bygger den med delar, områden, händelser och bilder, hur Snygga till fungerar och hur rapporten skickas till kunden.',
  'handbok', 'guide',
  $json$[
    {"type":"p","text":"Vissa uppdrag passar inte i en vanlig rapport. Det kan vara flera byggnader, många besök under flera månader eller en underleverantör som tätar åt oss. Då samlar du allt i en specialrapport, och kunden får en enda rapport som visar vad vi har hittat, vad vi har gjort och vad kunden behöver göra."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"När du använder den","description":"Specialrapport eller vanlig rapport","target":"nar"},
      {"label":"Skapa rapporten","description":"Från menyn eller ärendet","target":"skapa"},
      {"label":"Rapportens delar","description":"Typer, färg och ordning","target":"delar"},
      {"label":"Rita områden","description":"Översiktskartan","target":"rita"},
      {"label":"Innehåll i en del","description":"Text, händelser, bilder och kartutsnitt","target":"innehall"},
      {"label":"Ute på plats","description":"Mobilen och Ny händelse","target":"mobil"},
      {"label":"Snygga till","description":"Rättelser och ordlistan","target":"snygga"},
      {"label":"Bedömning och åtgärder","description":"Slutsatsen och Klar att skicka","target":"bedomning"},
      {"label":"Skicka till kunden","description":"PDF, mejl och versioner","target":"skicka"},
      {"label":"Vanliga frågor","description":"Kort och konkret","target":"fragor"}
    ]},

    {"type":"h2","id":"nar","text":"När du använder en specialrapport"},
    {"type":"p","text":"Den vanliga rapporten från ärendet räcker för de flesta jobb. Ta en specialrapport när kunden behöver se helheten:"},
    {"type":"list","items":[
      "Uppdraget omfattar flera byggnader, våningar eller delar av en tomt, och det spelar roll var något hittades.",
      "Det har blivit många besök, till exempel en sanering som pågått i flera månader.",
      "En underleverantör har gjort en del av arbetet, till exempel tätning, och kunden ska se det i samma rapport.",
      "Kunden har bett om en samlad redovisning, till exempel inför ett styrelsemöte eller en myndighet."
    ]},
    {"type":"callout","variant":"info","title":"Ersätter inte saneringsrapporten","text":"Specialrapporten kommer utöver de vanliga rapporterna i ärendet. Saneringsrapporten görs som vanligt."},
    {"type":"chain","title":"Så går det till","steps":["Skapa","Delar","Händelser och bilder","Snygga till","Bedömning och åtgärder","Skicka"],"labels":["koppla till ärendet","område, besök","på plats eller i efterhand","läs förslagen","din slutsats","PDF via mejl"]},

    {"type":"h2","id":"skapa","text":"Skapa rapporten"},
    {"type":"p","text":"Du kan börja på två ställen:"},
    {"type":"list","items":[
      "Specialrapporter i menyn. Tryck Ny rapport. Där ser du också alla rapporter du har tillgång till, med filtren Alla, Pågående och Skickade.",
      "Ärendets Utförande-flik. Rutan Specialrapport visar rapporter som redan finns för ärendet. Plusknappen skapar en ny med ärendet redan valt."
    ]},
    {"type":"steps","items":[
      "Sök fram ärendet med BE-nummer, kund eller kontaktperson. Kunden, adressen och kontaktpersonen hämtas till rapporten.",
      "Välj upplägg (se nedan).",
      "Skriv en titel, till exempel Råttor i Brf Solgläntan, augusti till oktober.",
      "Kontrollera Typ av rapport. Den föreslås utifrån ärendet: Inspektionsrapport, Saneringsrapport eller Åtgärdsrapport.",
      "Tryck Skapa rapport. Redigeraren öppnas direkt."
    ]},
    {"type":"h3","text":"De fyra uppläggen"},
    {"type":"list","items":[
      "Börja tomt: du lägger till delar efter hand.",
      "Börja med kartan: varje område du ritar blir en del.",
      "En del per besök: ärendets besök hämtas in, ett per del.",
      "Utgå från tidigare rapport: samma struktur som en äldre rapport, men nya händelser."
    ]},
    {"type":"p","text":"Upplägget låser ingenting. Delar av alla slag kan blandas i samma rapport."},

    {"type":"h2","id":"delar","text":"Rapportens delar"},
    {"type":"p","text":"Till vänster i redigeraren finns Klar att skicka och listan Rapportens delar. Listan börjar alltid med Om rapporten och Översiktskarta och slutar med Bedömning och åtgärder. Däremellan ligger delarna, var och en med nummer och egen färg. Klicka på raderna i bilden nedan."},
    {"type":"interactive","component":"specialrapport-delar"},
    {"type":"h3","text":"Lägg till del"},
    {"type":"p","text":"Tryck Lägg till del och välj vad delen ska handla om:"},
    {"type":"list","items":[
      "Område: en plats du ritar på kartan, till exempel ett hus, en källare eller en del av tomten. Kartan öppnas och ritningen startar.",
      "Besök: vad som gjordes en viss dag, oavsett var.",
      "Underleverantör: arbete som någon annan utförde på vårt uppdrag, till exempel tätning.",
      "Fritt: valfri rubrik med text och bilder."
    ]},
    {"type":"p","text":"Har ärendet besök som inte finns i rapporten än visas knappen Skapa en del per besök i samma ruta."},
    {"type":"h3","text":"Färg och ordning"},
    {"type":"list","items":[
      "Varje del får nästa lediga färg. Färgen syns i listan, på kartan och i PDF:en. Byt den under Färg i delen.",
      "Dra en del i listan för att ändra ordning. I mobilen och med tangentbordet finns Flytta upp och Flytta ned i menyn med tre punkter vid delen.",
      "Numret följer ordningen, både i redigeraren och i rapporten."
    ]},

    {"type":"h2","id":"rita","text":"Rita områden på kartan"},
    {"type":"steps","items":[
      "Öppna Översiktskarta och tryck Rita område uppe till vänster på kartan.",
      "Tryck ut områdets hörn ett i taget. En streckad linje visar hur området blir innan du trycker.",
      "Dra i ett hörn om det hamnade fel. Ångra-knappen tar bort det senaste hörnet.",
      "Stäng området genom att trycka på första hörnet eller på Skapa del. Det behövs minst tre hörn.",
      "Rutan Vad heter området? kommer upp. Skriv ett namn, till exempel Förrådet eller Baksidan, välj färg och tryck Spara."
    ]},
    {"type":"list","items":[
      "Bocken Med i rapporten avgör om översiktskartan kommer med i rapporten. Så länge bocken är satt sparas kartans utsnitt när du flyttar eller zoomar.",
      "En del utan område visar Ingen plats ritad och länken Rita område i listan. Då ritar du områden till en del som redan finns.",
      "Knappen med lager växlar mellan Visa gatunamn och Dölj gatunamn."
    ]},

    {"type":"h2","id":"innehall","text":"Innehåll i en del"},
    {"type":"p","text":"Överst i delen finns Delens rubrik, Underrubrik, Typ, Färg och Plats. Under det ligger blocken som kort. Längst ned finns Lägg till i delen med Mer text, Händelser, Bilder och Kartutsnitt. Menyn med tre punkter på ett block flyttar eller tar bort det."},
    {"type":"h3","text":"Text"},
    {"type":"p","text":"Beskriv läget med egna ord, till exempel spår, ingångar och skador."},
    {"type":"h3","text":"Händelser"},
    {"type":"p","text":"Händelser är fynd och åtgärder med datum. Varje händelse har Datum, Typ, Rubrik och Beskrivning. Typerna är Inspektion, Besök, Betning, Åtgärd, Underleverantör, Notering och Avvikelse."},
    {"type":"list","items":[
      "Ny händelse lägger till ett besök med dagens datum. Bredvid finns snabbknappar för Inspektion, Besök, Betning, Åtgärd och Avvikelse.",
      "Avvikelse är för sådant kunden behöver åtgärda, till exempel en öppen ventil eller avfall vid fasaden. Den syns i rött i redigeraren, i rapportens händelsetabell och på översikten.",
      "Hämta från ärendet tar in ärendets besök och, i avtalsärenden, kontrollrundor. Det som redan finns i rapporten visas gråat.",
      "Tryck på en händelse för att ändra den direkt i raden."
    ]},
    {"type":"h3","text":"Bilder"},
    {"type":"list","items":[
      "Ladda upp bilder i bildblocket, eller tryck Ta foto i mobilen. Varje bild får ett nummer, Bild 1, Bild 2 och så vidare, samma som i rapporten.",
      "Gemet på en händelse (Bifoga bild) kopplar bilden till händelsen direkt. Bilden hamnar i delens bildblock, som skapas om det saknas.",
      "I bildblocket väljer du Hör till händelse för varje bild. Rapportens händelsetabell hänvisar då till bildens nummer.",
      "Skriv en kort bildtext som säger vad kunden ser."
    ]},
    {"type":"h3","text":"Kartutsnitt"},
    {"type":"p","text":"Kartutsnittet visar delens område inzoomat. Det kommer med i rapporten. Saknar delen område trycker du Rita ett på kartan."},

    {"type":"h2","id":"mobil","text":"Ute på plats i mobilen"},
    {"type":"p","text":"I mobilen finns en flikrad längst ned med Delar, Redigera och Visa som kund."},
    {"type":"list","items":[
      "Delar visar Klar att skicka och listan Rapportens delar.",
      "Redigera visar den del du valt.",
      "Visa som kund visar sidan som kunden får, och knappen Redigera den här delen tar dig tillbaka."
    ]},
    {"type":"steps","items":[
      "Tryck den gröna knappen Ny händelse. Den finns i Delar och Redigera.",
      "Välj del. Står du inne i ett ritat område är det området förvalt, och det står Föreslagen efter området du står i.",
      "Välj typ under Vad har du gjort?, kontrollera datum och skriv rubrik och beskrivning.",
      "Lägg till foton med kameran eller ur bildbiblioteket.",
      "Tryck Spara i rapporten."
    ]},

    {"type":"h2","id":"snygga","text":"Snygga till"},
    {"type":"p","text":"Snygga till läser igenom texten och föreslår rättelser. Knappen finns i rubrikraden för hela rapporten, i Om rapporten, i Bedömning och åtgärder och på textblock, händelseblock och bildblock."},
    {"type":"h3","text":"Det här gör AI:n"},
    {"type":"list","items":[
      "Rättar stavning, stor bokstav, skiljetecken och stycken.",
      "Föreslår ibland en tydligare formulering. Formulering är avbockad från början.",
      "Siffror, datum, mängder, kundens namn och adress ändras aldrig, inte heller namn på artiklar, tjänster, produkter, preparat och stationstyper.",
      "Ingenting ändras förrän du har tryckt Använd."
    ]},
    {"type":"h3","text":"Granskningsrutan"},
    {"type":"p","text":"Till vänster står Så blir texten: borttaget i rött och överstruket, nytt i grönt. Till höger finns förslagen i grupper med kryssrutor. Tryck på en markering i texten eller bocka ur rutan för att välja bort ett förslag. Tryck sedan Använd och antalet ändringar. Ångra finns i rutan som kommer upp direkt efteråt."},
    {"type":"p","text":"Prova själv. Ett av förslagen nedan är fel."},
    {"type":"interactive","component":"specialrapport-snygga-till"},
    {"type":"h3","text":"Ordlistan"},
    {"type":"p","text":"Föreslår AI:n att rätta ett ord som redan är rätt, tryck Rätt stavat, lägg till i ordlistan under förslaget. Då rättas ordet aldrig igen, för någon. Koordinator och admin hittar Ordlistan i menyn. Där syns alla skyddade ord, och där kan du lägga till egna ord, ta bort dem eller stänga av ett namn som hämtats automatiskt."},

    {"type":"h2","id":"bedomning","text":"Bedömning och åtgärder"},
    {"type":"p","text":"Sista raden i Rapportens delar är din slutsats till kunden. Överst ser du hur många avvikelser, händelser och rekommenderade åtgärder rapporten har."},
    {"type":"list","items":[
      "Bedömning: hur ser läget ut nu? Två eller tre meningar räcker.",
      "Avvikelser att åtgärda: visas när rapporten har avvikelser. Tryck på en rad för att komma till delen den hör till.",
      "Rekommenderade åtgärder: en åtgärd per rad. Enter ger nästa rad, och pilarna flyttar en rad upp eller ned. Kunden ser dem som numrerade punkter."
    ]},
    {"type":"h3","text":"Klar att skicka"},
    {"type":"p","text":"Rutan överst till vänster visar vad som återstår: Inledning skriven, Minst ett område eller besök, Händelser registrerade, Bedömning skriven och Rekommenderade åtgärder skrivna. Tryck på en rad så hamnar du i rätt fält. Du kan alltid skicka, men utskicket påminner om det som saknas."},

    {"type":"h2","id":"skicka","text":"Förhandsvisa, ladda ner och skicka"},
    {"type":"list","items":[
      "På en bred skärm syns rapporten som kunden ser den bredvid det du skriver. Trycker du på något på sidan hamnar du i rätt fält. På en smalare skärm öppnar Visa som kund samma sida i en panel från höger.",
      "Ladda ner PDF i rubrikraden tar fram PDF:en som den ser ut just nu.",
      "Skicka till kund öppnar utskicket. Fyll i Till, kontrollera Ämne och Meddelande och tryck Skicka version och numret. PDF:en bifogas mejlet."
    ]},
    {"type":"h3","text":"Versioner"},
    {"type":"list","items":[
      "En skickad version låses. Fortsätter du arbeta i rapporten blir det nästa version, och kunden får den när du skickar igen.",
      "I utskicket visas Nytt sedan version och numret, och meddelandet till kunden räknar upp det som har tillkommit.",
      "Rapporten och alla skickade versioner finns kvar på ärendet. Under Versioner kan du ladda ned varje version."
    ]},

    {"type":"h2","id":"fragor","text":"Vanliga frågor"},
    {"type":"h3","text":"Vem ser rapporten?"},
    {"type":"p","text":"Koordinator och admin ser alla specialrapporter. En tekniker ser rapporter som hen har skapat och rapporter på ärenden där hen är tekniker."},
    {"type":"h3","text":"Ser kunden rapporten i kundportalen?"},
    {"type":"p","text":"Nej. Kunden får rapporten som PDF i mejlet när du trycker Skicka till kund. Vill du visa den innan dess, ladda ner PDF:en."},
    {"type":"h3","text":"Ersätter den saneringsrapporten?"},
    {"type":"p","text":"Nej. Saneringsrapporten görs som vanligt i ärendet. Specialrapporten är en samlad redovisning utöver den."},
    {"type":"h3","text":"Måste jag spara?"},
    {"type":"p","text":"Nej. Allt sparas medan du skriver. Under titeln står Sparad och klockslaget, eller Sparar när något är på väg."},
    {"type":"h3","text":"Kan jag ändra något efter att rapporten är skickad?"},
    {"type":"p","text":"Ja. Det du ändrar hamnar i nästa version. Den skickade versionen är låst och finns kvar som den var."}
  ]$json$::jsonb,
  1, false, true, 29, now(), array['technician','koordinator','admin']
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  section = excluded.section,
  category = excluded.category,
  content = excluded.content,
  requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;
