-- Tre handboksguider om leadssystemet (etapp 1 till 7, version 3.41.1 till 3.47.0), en per roll:
-- tekniker (tipsa), säljare (arbeta leads) och koordinator + admin (fördela, boka, offert, statistik, tipsbonus).
-- Samma interaktiva komponenter (src/pages/shared/intranet/interactive/leads/) med olika variant.
-- Ingen läskvittens. Kördes 2026-10-10 via MCP; filen är idempotent (on conflict).
-- Sist: sökrutans kontorsguide säger webbleads i stället för leads (sökrutan hittar bara webbförfrågningar).

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-leads-tekniker',
  'Tipsa om en lead',
  'Så skapar du en lead från ett ärende på 15 sekunder, vad som händer med tipset och hur tipsbonusen fungerar.',
  'handbok', 'guide',
  $json$[
    {"type":"p","text":"Du är den som står i kundens kök, lager och trapphus. Du ser råttorna i lagret bredvid, hör att grannföreningen har samma problem och märker när en kund borde ha ett löpande avtal. Ett tips från dig tar 15 sekunder och kan bli ett avtal som löper i flera år."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Skapa lead från ärendet","description":"Knappen Skapa lead i engångsärendet","target":"arendet"},
      {"label":"Prova själv","description":"Övning med ett påhittat ärende","target":"prova"},
      {"label":"Mina leads och tips","description":"Där du följer dina tips","target":"mina"},
      {"label":"Vad händer sedan","description":"Stegen och notiserna du får","target":"sedan"},
      {"label":"Tipsbonus","description":"Räkna på vad ett tips kan ge","target":"bonus"},
      {"label":"Egna leads","description":"Du kan också äga en lead själv","target":"aga"}
    ]},

    {"type":"h2","id":"varfor","text":"Varför dina tips är viktiga"},
    {"type":"list","items":[
      "Kunden litar redan på dig. Ett tips från ett besök är den lättaste affären vi kan göra.",
      "Säljaren får allt från ärendet direkt: kund, telefon, adress, skadedjur och det du skrev.",
      "Du ser hela vägen. Tipset ligger kvar under Mina leads och tips, och du får en notis när det blir offert och när det blir avtal.",
      "Tipset kan ge tipsbonus i provisionerna när ledningen har slagit på den."
    ]},

    {"type":"h2","id":"arendet","text":"Skapa lead från ärendet"},
    {"type":"steps","items":[
      "Öppna engångsärendet från Mina ärenden eller schemat. Det fungerar lika bra i mobilen som på datorn.",
      "Tryck Skapa lead. Knappen sitter under statusraden, ovanför flikarna Ärende och Utförande.",
      "Välj vad tipset gäller.",
      "Skriv en rad under Vad såg du? Till exempel råttor även i lagret, vill ha stationer där också.",
      "Tryck Skicka lead. Det kommer en ruta med en länk till leaden, och ärendet visar sedan Lead skapad med företagets namn."
    ]},
    {"type":"callout","variant":"info","title":"Bara i engångsärenden","text":"Knappen finns i privata engångsärenden och företagsärenden. Avtalsärenden, rondering och egenkontroll har ingen knapp. Där tipsar du med knappen Tipsa om en lead under Mina leads och tips."},
    {"type":"h3","text":"Vad gäller det?"},
    {"type":"p","text":"I ett företagsärende väljer du mellan tre rader:"},
    {"type":"list","items":[
      "Löpande avtal: kunden vill ha regelbunden kontroll.",
      "Fler adresser: kunden har fler lokaler.",
      "Annan tjänst: till exempel sanering eller tätning."
    ]},
    {"type":"p","text":"I ett privat engångsärende väljer du mellan:"},
    {"type":"list","items":[
      "Löpande avtal för hemmet: kunden vill ha regelbunden kontroll.",
      "Bostadsrättsföreningen: kunden sitter i styrelsen eller vet vem som gör det. Skriv föreningens namn.",
      "Kundens företag: kunden driver eller arbetar på ett företag med behov. Skriv företagets namn."
    ]},
    {"type":"h3","text":"Det här följer med av sig självt"},
    {"type":"p","text":"Företag eller namn, org.nr i företagsärenden, kontaktperson, telefon, e-post, adress, skadedjur, ärendenumret och din text. Du står som tipsare. Personnummer följer aldrig med."},
    {"type":"h3","text":"Om det redan finns en lead"},
    {"type":"p","text":"Har någon redan en öppen lead med samma org.nr, telefon eller e-post visas den i rutan. Tryck Lägg anteckning där, så hamnar din text i den leadens tidslinje i stället för att det blir en dubblett. Är du säker på att det är något nytt trycker du Skapa ny lead ändå."},

    {"type":"h2","id":"prova","text":"Prova själv"},
    {"type":"p","text":"Övningen är samma ruta som i ärendet, med påhittade kunder. Prova båda ärendetyperna och kryssa i Det finns redan en lead för att se dubblettläget. Ingenting sparas."},
    {"type":"interactive","component":"leads-skapa-ovning","variant":"tekniker"},

    {"type":"h2","id":"mina","text":"Mina leads och tips"},
    {"type":"p","text":"Under Försäljning i menyn hittar du Mina leads och tips. Där ser du allt du har tipsat om, allt du äger och det kollegor har delat med dig."},
    {"type":"list","items":[
      "Att göra visar det som är försenat, ska göras i dag eller saknar nästa steg.",
      "Pågående visar alla öppna leads.",
      "Nya tips visar dina tips som ännu inte har fått en ägare eller inte har kontaktats än.",
      "Alla visar även vunna och förlorade."
    ]},
    {"type":"p","text":"Som tipsare kan du läsa leaden och skriva i Aktivitet, till exempel om kunden ringer dig igen. Knapparna för att ändra leaden har bara ägaren och de som leaden är delad med. Klicka på en rad i bilden nedan."},
    {"type":"interactive","component":"leads-lista","variant":"tekniker"},
    {"type":"h3","text":"Tipsa utan ett ärende"},
    {"type":"steps","items":[
      "Tryck Tipsa om en lead längst ned i mobilen, eller Nytt tips uppe till höger på datorn.",
      "Fyll i företag eller namn och telefon eller e-post. Källan är redan satt till Teknikertips.",
      "Välj Ingen ägare än (koordinatorn fördelar) under Ägare. Då behövs inget nästa steg och knappen heter Skicka tips.",
      "Tryck Skicka tips."
    ]},
    {"type":"callout","variant":"warning","title":"Ägare är förvald till dig","text":"Låter du Jag stå kvar som ägare blir leaden din att driva, och då måste du fylla i nästa steg och datum. Vill du bara lämna tipset, välj Ingen ägare än."},

    {"type":"h2","id":"sedan","text":"Vad händer sedan"},
    {"type":"chain","title":"Tipsets väg","steps":["Ditt tips","Nya tips","Säljaren ringer","Besök","Offert","Avtal"],"labels":["du","koordinatorn fördelar","inom 2 arbetsdagar","koordinatorn bokar","från Oneflow","signerat"]},
    {"type":"p","text":"Klicka på stegen nedan och se vem som flyttar leaden och vad som krävs. De flesta steg flyttas av systemet, inte av någon person."},
    {"type":"interactive","component":"leads-steg","variant":"tekniker"},
    {"type":"h3","text":"Notiserna du får"},
    {"type":"list","items":[
      "Ditt tips har fått en offert: offerten från leaden har skickats till kunden.",
      "Ditt tips är vunnet: kunden har signerat.",
      "Trycker du på notisen öppnas leaden under Mina leads och tips."
    ]},
    {"type":"p","text":"Notiserna kommer bara när någon annan än du äger leaden."},

    {"type":"h2","id":"bonus","text":"Tipsbonus"},
    {"type":"p","text":"När tipsbonusen är påslagen får den som tipsade en bonus när leaden blir vunnen. Procent, lägsta belopp och tak bestäms av ledningen. Räknaren nedan visar de inställningar som gäller just nu."},
    {"type":"interactive","component":"leads-tipsbonus","variant":"tekniker"},
    {"type":"list","items":[
      "Bonusen syns under Provisioner som Tipsbonus: och företagets namn.",
      "I leadens tidslinje står när bonusen har bokförts och när den är klar för utbetalning. Beloppet står bara i Provisioner.",
      "Äger du själv leaden när den vinns blir det ingen tipsbonus."
    ]},

    {"type":"h2","id":"aga","text":"Du kan också äga en lead"},
    {"type":"p","text":"Ibland vill du driva affären själv, till exempel med en kund du känner väl. Då står du som ägare och sköter leaden som en säljare: du har ett nästa steg med datum, trycker Klar, välj nästa när det är gjort, loggar samtal och kan skapa offert direkt från leaden."},
    {"type":"callout","variant":"info","title":"Vill du lämna över?","text":"Öppna leaden och tryck Överlåt eller dela. Välj ny ägare och tryck Överlåt. Du står kvar som tipsare, och med bocken Behåll mig som delad fortsätter du att se leaden."},
    {"type":"h3","text":"Vem får göra vad"},
    {"type":"interactive","component":"leads-roller","variant":"tekniker"}
  ]$json$::jsonb,
  1, false, true, 26, now(), array['technician']
),
(
  'guide-leads-saljare',
  'Leads för säljare',
  'Arbetsdagen i Att göra, ny lead med fem fält, regeln om nästa steg, överlåta och dela, offert via Oneflow och din statistik.',
  'handbok', 'guide',
  $json$[
    {"type":"p","text":"Leads (B2B) är listan över företag och föreningar som kan bli avtalskunder. Sidan bygger på en enda regel: varje öppen lead har ett nästa steg med datum. Då vet du alltid vad du ska göra i dag, och ingen lead glöms bort."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Arbetsdagen","description":"Att göra, flikarna och filtret","target":"dagen"},
      {"label":"Ny lead","description":"Fem fält och dubblettkontrollen","target":"ny"},
      {"label":"Regeln om nästa steg","description":"Klar, välj nästa","target":"nasta"},
      {"label":"Överlåt och dela","description":"Ge bort eller ta hjälp","target":"dela"},
      {"label":"Offert och automatiska steg","description":"Oneflow flyttar leaden åt dig","target":"offert"},
      {"label":"Din statistik","description":"Fliken Statistik","target":"statistik"}
    ]},

    {"type":"h2","id":"dagen","text":"Arbetsdagen i Att göra"},
    {"type":"p","text":"Öppna Leads (B2B) i menyn. Fliken Att göra är din lista för dagen, uppdelad i fyra grupper:"},
    {"type":"list","items":[
      "Försenade: nästa steg skulle ha gjorts. Börja här.",
      "I dag: det du har bestämt för i dag.",
      "Saknar nästa steg: leads där ingen har bestämt vad som ska hända.",
      "Parkerade som vaknar i dag: leads du lade åt sidan och som nu är dags igen."
    ]},
    {"type":"p","text":"Siffran vid Att göra visar hur många rader som väntar. När listan är tom har alla dina leads ett nästa steg framåt i tiden."},
    {"type":"list","items":[
      "Pågående visar alla öppna leads, sorterade på nästa steg.",
      "Nya tips visar de leads du ser som saknar ägare, eller som är tips och fortfarande Ny. Koordinatorn fördelar tipsen.",
      "Alla visar även vunna och förlorade.",
      "Ägare: Mina är förvalt och visar det du äger, har tipsat om eller fått delat. Sök, Källa och Status filtrerar vidare.",
      "Pil upp och ned flyttar mellan raderna, Enter öppnar och N startar en ny lead."
    ]},
    {"type":"p","text":"Klicka på en rad i bilden nedan för att se hur leaden ser ut när du öppnar den."},
    {"type":"interactive","component":"leads-lista","variant":"saljare"},

    {"type":"h2","id":"ny","text":"Ny lead"},
    {"type":"p","text":"Tryck Ny Lead högst upp i sidomenyn, Ny lead på sidan eller tangenten N. Du fyller i fem saker. Resten fyller du i på leaden efteråt."},
    {"type":"steps","items":[
      "Företag eller namn.",
      "Kontaktperson.",
      "Telefon eller e-post. Minst ett av dem.",
      "Källa, till exempel Telefon, Rekommendation eller Kall bearbetning.",
      "Nästa steg med datum och tid. Förslaget är Ring och presentera oss nästa vardag klockan 09.00."
    ]},
    {"type":"p","text":"Org.nr och årspremie är frivilliga men gör dubblettkontrollen och statistiken bättre. Ägare är förvald till dig. Väljer du en kollega som ägare står du som tipsare."},
    {"type":"callout","variant":"info","title":"Dubblettkontrollen","text":"Innan leaden sparas letar systemet efter samma org.nr, telefon eller e-post bland alla leads. Finns en träff visas den med steg och ägare. Öppna den om du kan se den, be annars ägaren dela den med dig. Skapa ändå finns om det verkligen är en ny affär."},
    {"type":"p","text":"Du kan också skapa en lead direkt från ett engångsärende med knappen Skapa lead i ärendet. Då följer kund, kontakt, adress och skadedjur med, källan blir Engångsärende och du blir ägare."},

    {"type":"h2","id":"nasta","text":"Regeln om nästa steg"},
    {"type":"motto","text":"Varje öppen lead har ett nästa steg med datum."},
    {"type":"list","items":[
      "Rutan Nästa steg ligger överst i leaden. Den blir röd när datumet har passerat och gul när nästa steg saknas.",
      "När du har gjort det som stod, tryck Klar, välj nästa. Välj vad som hände och skriv en rad, sedan väljer du ett nytt nästa steg, Parkera eller Förlorad. Det går inte att bara bocka av.",
      "Ändra flyttar nästa steg utan att logga något."
    ]},
    {"type":"p","text":"Prova i övningen nedan. Lägg märke till att ett samtal på en lead som är Ny flyttar den till Kontaktad av sig själv, medan en anteckning inte gör det."},
    {"type":"interactive","component":"leads-nasta-steg","variant":"saljare"},

    {"type":"h2","id":"logga","text":"Logga samtal, mejl och möten"},
    {"type":"list","items":[
      "Logga samtal i åtgärdsraden hoppar ned till Aktivitet med Samtal valt.",
      "I Aktivitet väljer du Anteckning, Samtal, Mejl eller Möte, skriver och trycker Spara. Ctrl+Enter sparar också.",
      "Systemets händelser ligger i samma tidslinje: stegbyten, ny ägare, delning, årspremie, offert och avtal. Nyast står överst.",
      "Ett samtal, mejl eller möte räknas som kontakt i statistiken. En anteckning gör det inte."
    ]},

    {"type":"h2","id":"dela","text":"Överlåt och dela"},
    {"type":"p","text":"Tryck Överlåt eller dela i leaden."},
    {"type":"list","items":[
      "Överlåt: välj Ny ägare och tryck Överlåt. Med bocken Behåll mig som delad fortsätter du att se leaden.",
      "Dela med: välj en kollega och tryck Dela. Den som leaden är delad med kan ändra den och logga, men inte byta ägare eller dela vidare.",
      "En kollega som inte längre behövs tar du bort med Ta bort. Är du själv delad lämnar du med Lämna.",
      "Bara ägaren, koordinatorn och admin kan överlåta och dela."
    ]},

    {"type":"h2","id":"avslut","text":"Parkera, förlorad och återuppta"},
    {"type":"list","items":[
      "Parkera när kunden inte är aktuell nu, till exempel för att avtalet med nuvarande leverantör löper ett halvår till. Välj datum då leaden ska vakna och skriv vad som ska göras då.",
      "Förlorad kräver en orsak: Pris, Valde annan leverantör, Ingen budget, Inget behov, Fick aldrig kontakt, Fel tidpunkt, Dubblett eller Övrigt. Skriv gärna en kommentar, till exempel vilken leverantör kunden valde.",
      "Återuppta finns på parkerade och förlorade leads. Du väljer ett nytt nästa steg och leaden blir Kontaktad."
    ]},

    {"type":"h2","id":"offert","text":"Offert via Oneflow och automatiska steg"},
    {"type":"steps","items":[
      "Tryck Skapa offert i leaden. Avtals- och offertguiden öppnas med kundens uppgifter ifyllda.",
      "Dokumenttypen är Avtal för ett nytt avtal och Offert för en utökning. Du kan byta i första steget.",
      "Skicka dokumentet från guiden som vanligt.",
      "När dokumentet skickas blir leaden Offert skickad. När kunden signerar blir den Vunnen. Du behöver inte göra något."
    ]},
    {"type":"callout","variant":"warning","title":"Skapa offerten från leaden","text":"Bara ett dokument som skapats med Skapa offert i leaden flyttar leaden. Skapar du offerten någon annanstans vet systemet inte att den hör ihop. Be då koordinatorn att sätta steget."},
    {"type":"list","items":[
      "Avböjs offerten eller går den ut går leaden tillbaka till Kontaktad med nästa steg att ta ny kontakt, satt till i dag. Den blir aldrig förlorad av sig själv.",
      "Boka besök skriver ett nästa steg åt dig. Ärendet bokas av koordinatorn från leaden, och då blir steget Besök bokat.",
      "När leaden är vunnen men saknar kund visas Koppla eller skapa kund överst. Välj ett förslag, sök på namn, org.nr eller kundnummer, eller tryck Skapa kund."
    ]},
    {"type":"p","text":"Klicka på stegen för att se vem som sätter vad."},
    {"type":"interactive","component":"leads-steg","variant":"saljare"},

    {"type":"h2","id":"statistik","text":"Din statistik"},
    {"type":"p","text":"Fliken Statistik på Leads-sidan visar dina leads: de du äger, har tipsat om eller fått delade. Välj period överst: 30 dagar, 90 dagar, 12 månader, I år eller Egen period."},
    {"type":"list","items":[
      "Pipeline per steg visar öppna leads och uppskattad årspremie just nu.",
      "Från lead till affär visar hur många som gick vidare i varje steg, per källa eller per ursprung.",
      "Tid i steg visar hur länge leads brukar ligga i varje steg.",
      "Hygien per ägare visar försenade och saknade nästa steg, och hur snabbt nya leads kontaktades. Målet är minst 90 % inom 2 arbetsdagar och under 10 % försenade."
    ]},

    {"type":"h2","id":"roller","text":"Vem får göra vad"},
    {"type":"interactive","component":"leads-roller","variant":"saljare"}
  ]$json$::jsonb,
  1, false, true, 27, now(), array['säljare']
),
(
  'guide-leads-kontor',
  'Leads för koordinator och admin',
  'Fördela nya tips, boka besök och skapa offert från leaden, koppla kund när den vinns, nödutgången, statistiken och tipsbonusens inställningar.',
  'handbok', 'guide',
  $json$[
    {"type":"p","text":"Leads (B2B) samlar företag och föreningar som kan bli avtalskunder. Tekniker tipsar från sina ärenden, säljare driver leads framåt och systemet flyttar stegen när besök bokas och offerter skickas och signeras. Du fördelar tipsen, bokar besöken och håller koll på helheten."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Leads i korthet","description":"Stegen och vem som får göra vad","target":"kort"},
      {"label":"Fördela Nya tips","description":"Ta leaden eller överlåt","target":"tips"},
      {"label":"Boka besök","description":"Ärendemodalen ifylld från leaden","target":"besok"},
      {"label":"Skapa offert","description":"Oneflow flyttar leaden","target":"offert"},
      {"label":"Vunnen och kund","description":"Koppla eller skapa kund","target":"vunnen"},
      {"label":"Nödutgången","description":"Sätt steget för hand","target":"nodutgang"},
      {"label":"Statistik","description":"Kedjan och hygienen","target":"statistik"},
      {"label":"Tipsbonus","description":"Inställningar på Provisioner","target":"bonus"}
    ]},

    {"type":"h2","id":"kort","text":"Leads i korthet"},
    {"type":"motto","text":"Varje öppen lead har ett nästa steg med datum."},
    {"type":"list","items":[
      "Ny och Kontaktad sätts för hand. Ett samtal, mejl eller möte på en ny lead gör den Kontaktad av sig själv.",
      "Besök bokat, Offert skickad och Vunnen sätts automatiskt när du bokar besöket från leaden och när dokumentet från leaden skickas och signeras.",
      "Parkerad kräver ett datum då leaden vaknar. Förlorad kräver en orsak. Båda går att återuppta.",
      "Ny lead har fem fält: företag eller namn, kontaktperson, telefon eller e-post, källa och nästa steg med datum. Dubblettkontrollen letar på org.nr, telefon och e-post.",
      "Klar, välj nästa i rutan Nästa steg loggar vad som gjordes och kräver ett nytt nästa steg, Parkera eller Förlorad."
    ]},
    {"type":"interactive","component":"leads-steg","variant":"kontor"},
    {"type":"h3","text":"Vem får göra vad"},
    {"type":"interactive","component":"leads-roller","variant":"kontor"},
    {"type":"h3","text":"Listan"},
    {"type":"p","text":"Att göra delar upp dagen i Försenade, I dag, Saknar nästa steg och Parkerade som vaknar i dag. Välj Ägare: Alla ägare för att se hela företagets lista, eller en kollega för att se dennes. Sidfoten visar antal öppna och pipeline i kronor. Klicka på en rad i bilden."},
    {"type":"interactive","component":"leads-lista","variant":"kontor"},

    {"type":"h2","id":"tips","text":"Fördela Nya tips"},
    {"type":"p","text":"Fliken Nya tips är din fördelningskö. Här hamnar leads som saknar ägare, och tips som fortfarande är Ny även om de har fått en ägare. Siffran vid fliken visar hur många som väntar."},
    {"type":"steps","items":[
      "Öppna Nya tips. Äldst ligger överst.",
      "Öppna tipset. Teknikerns text står under Mer uppgifter, i fältet Beskrivning och behov, tillsammans med ärendenumret.",
      "Vill du ta det själv, välj Ta leaden i radens meny eller i ⋯-menyn i leaden.",
      "Ska en säljare ta det, öppna leaden, tryck Överlåt eller dela, välj Ny ägare och tryck Överlåt."
    ]},
    {"type":"callout","variant":"info","title":"Två arbetsdagar","text":"Tipset får nästa steg Kontakta kunden om tipset om två dygn. Målet är att kunden kontaktas inom två arbetsdagar. Statistiken mäter det per ägare."},
    {"type":"p","text":"Tipsaren står kvar som tipsare när leaden överlåts. Det är det som ger notiser och tipsbonus."},

    {"type":"h2","id":"besok","text":"Boka besök"},
    {"type":"steps","items":[
      "Tryck Boka besök i leaden. Ärendemodalen öppnas ifylld: privat ärende om kundgruppen är privatperson, annars företagsärende, med kontakt, telefon, e-post, adress, skadedjur och en beskrivning som börjar med Besök från lead.",
      "Välj tekniker och tid som vanligt och spara ärendet.",
      "Ärendet kopplas till leaden. Var leaden Ny eller Kontaktad blir den Besök bokat. Bokat besök syns under Ursprung och kopplingar."
    ]},
    {"type":"p","text":"Säljare och tekniker har också knappen Boka besök, men hos dem skriver den bara ett nästa steg. De ber dig boka. Gör det från leaden, annars kopplas ärendet inte."},

    {"type":"h2","id":"offert","text":"Skapa offert"},
    {"type":"list","items":[
      "Skapa offert i leaden öppnar avtals- och offertguiden med kundens uppgifter ifyllda, på första steget. Avtal är förvalt för ett nytt avtal och Offert för en utökning.",
      "När dokumentet skickas blir leaden Offert skickad och tipsaren får notisen Ditt tips har fått en offert. Ett utkast ändrar ingenting.",
      "När kunden signerar blir leaden Vunnen och tipsaren får notisen Ditt tips är vunnet.",
      "Avböjs offerten eller går den ut går leaden tillbaka till Kontaktad med nästa steg att ta ny kontakt, satt till i dag. Den blir aldrig förlorad av sig själv."
    ]},
    {"type":"callout","variant":"warning","title":"Bara dokument från leaden","text":"En offert som skapas direkt i guiden eller från ett ärende kopplas inte till leaden. Använd då nödutgången nedan."},

    {"type":"h2","id":"vunnen","text":"Vunnen och kundkoppling"},
    {"type":"p","text":"Har avtalet en kund kopplas den till leaden av sig själv. Annars visas Koppla eller skapa kund överst i leaden tills det är gjort, så att avtal, fakturering och statistik hänger ihop."},
    {"type":"list","items":[
      "Förslag visas när org.nr, e-postdomän eller telefon matchar en kund. Tryck Koppla.",
      "Sök kund på namn, org.nr eller kundnummer.",
      "Finns kunden inte, tryck Skapa kund. Formuläret för ny kund öppnas ifyllt från leaden, och den nya kunden kopplas när den sparas."
    ]},

    {"type":"h2","id":"nodutgang","text":"Nödutgången i ⋯-menyn"},
    {"type":"p","text":"Under Fler åtgärder (⋯) i leaden finns Sätt Besök bokat för hand (nödutgång), Sätt Offert skickad för hand (nödutgång) och Sätt Vunnen för hand (nödutgång). Bara koordinator och admin ser dem."},
    {"type":"list","items":[
      "Använd dem när ett besök eller en offert skapades utanför leaden och inte kan göras om.",
      "Vunnen för hand räknas i statistiken och bokför tipsbonusen om den är påslagen. Tipsaren får ingen notis, den kommer bara från Oneflow.",
      "Kunden kopplar du sedan i Koppla eller skapa kund."
    ]},

    {"type":"h2","id":"statistik","text":"Statistikfliken"},
    {"type":"p","text":"Fliken Statistik på Leads-sidan visar alla leads för dig. Välj period (30 dagar, 90 dagar, 12 månader, I år eller Egen period) och ägare överst. Pipeline och hygienens öppna leads är läget just nu. Det andra gäller perioden."},
    {"type":"list","items":[
      "Perioden i korthet: skapade, tips, vunna, förlorade, vunnen årspremie och ledtid.",
      "Pipeline per steg och Pipeline per ägare: öppna leads och uppskattad årspremie.",
      "Vunnen årspremie per månad och Månad för månad: nya avtal och utökning för sig.",
      "Från lead till affär: kedjan per källa eller per ursprung.",
      "Tid i steg, Förlustorsaker, Hygien per ägare och Tips per tipsare."
    ]},
    {"type":"h3","text":"Så läser du kedjan"},
    {"type":"p","text":"Varje rad är en källa eller ett ursprung, till exempel Teknikertips eller företagsärende. Kolumnerna Kontaktade, Besök bokat, Offert och Vunna visar hur många av leadsen som skapades i perioden som nådde dit, med andelen under talet. En lead räknas som att den nått ett steg om den någon gång varit där. Jämför andelarna mellan raderna: en källa med många leads men få offerter behöver ett annat arbetssätt. Kedjan, hygienen och tipsen går att ladda ner som CSV."},
    {"type":"h3","text":"Så läser du hygienen"},
    {"type":"list","items":[
      "Försenat nästa steg: andel öppna leads där datumet har passerat. Målet är under 10 %.",
      "Saknar nästa steg: öppna leads utan nästa steg. Målet är noll.",
      "Kontaktade inom 2 arbetsdagar: av nya leads i perioden. Målet är minst 90 %. Kontakt räknas när ett samtal, mejl eller möte loggas eller när leaden flyttas från Ny.",
      "Punkten är grön när målet nås. För kontaktade inom 2 arbetsdagar är den gul mellan 70 och 90 % och röd under det."
    ]},

    {"type":"h2","id":"bonus","text":"Tipsbonusens inställningar"},
    {"type":"p","text":"Admin ställer in tipsbonusen på Provisioner. Tryck Inställningar. Panelen Tipsbonus för leads ligger under Provisionsinställningar."},
    {"type":"list","items":[
      "På eller av. Bonusen är avstängd tills den slås på.",
      "Procent av första årets premie, Lägsta belopp och Högsta belopp (tak), där 0 betyder inget tak.",
      "Lägsta årspremie för bonus.",
      "Vem får bonus: Alla som tipsar, utom ägaren, eller Bara tekniker.",
      "Utökning hos befintlig kund: om den ger bonus eller bara nya avtal.",
      "Gäller leads vunna från och med ett datum.",
      "Tryck Spara tipsbonus. Ändringar gäller bonusar som bokförs efter att du sparat, aldrig redan bokförda."
    ]},
    {"type":"interactive","component":"leads-tipsbonus","variant":"kontor"},
    {"type":"list","items":[
      "Bonusen bokförs när leaden blir vunnen och blir klar för utbetalning när kundens första faktura är betald. Sedan godkänns och betalas den som annan provision.",
      "På Provisioner står posten under tipsarens namn med Tipsbonus i nummerkolumnen och Tipsbonus: företaget som titel. Ögat på raden öppnar leaden. I CSV-exporten heter typen Tipsbonus (lead).",
      "Flyttas en vunnen lead tillbaka ligger bonusposten kvar. Rätta den för hand på Provisioner."
    ]}
  ]$json$::jsonb,
  1, false, true, 28, now(), array['admin','koordinator']
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

-- Sökrutan hittar webbförfrågningar (Leads (webb)), inte leads (B2B). Hela innehållet skrivs om med samma text
-- där bara ordet byts, så att guiden inte motsäger det nya leadssystemet.
update public.intranet_documents
set content = replace(content::text, 'kundens ärenden, avtal, leads och fakturor', 'kundens ärenden, avtal, webbleads och fakturor')::jsonb,
    source_updated_at = now()
where slug = 'guide-sokrutan-kontor'
  and content::text like '%kundens ärenden, avtal, leads och fakturor%';
