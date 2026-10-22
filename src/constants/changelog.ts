// src/constants/changelog.ts
// Uppdateringslogg som visas för personalen via "Uppdateringar" i sidomenyn.
//
// Skriv för en kollega som inte följt utvecklingen: vad kan man göra nu som man
// inte kunde igår? Konkret nytta, inte teknik. Två till fyra punkter per release,
// en rad var. Nyast överst - listan renderas i den ordning den står här.
//
// Vid ny release: lägg till högst upp och höj versionen. Alla som inte sett den
// versionen får en prick i sidomenyn.
//
// Versionsnummer: generation.release.rättning, utan koppling till datum.
//   - Ny generation (första siffran) när en central del byggs om i grunden,
//     som Fakturering 2.0 (2.0.0) eller Avtalskartans motor (3.0.0).
//   - Ny release (andra siffran) för varje leverans med ny funktion.
//   - Rättning (tredje siffran) för en leverans som bara rättar fel.
//
// Varje punkt får en kategori: nyhet (kan göra något nytt), andring (något
// bekant fungerar annorlunda) eller buggfix (något som var fel är rättat).
// Skriv { kind, text }. Punkter från tiden före kategorierna är rena
// strängar och visas utan etikett.
//
// VARJE leverans till main ska in här, samma dag: ny post om dagen saknar en,
// annars en punkt till i dagens post. Loggen är det personalen läser.

export type ChangelogKind = 'nyhet' | 'andring' | 'buggfix'

export type ChangelogItem = string | { kind: ChangelogKind; text: string }

export const CHANGELOG_KIND_LABEL: Record<ChangelogKind, string> = {
  nyhet: 'Nyhet',
  andring: 'Ändring',
  buggfix: 'Buggfix',
}

export interface ChangelogEntry {
  /** Visas som mono-etikett, t.ex. "3.10.0" */
  version: string
  /** ÅÅÅÅ-MM-DD */
  date: string
  /** Kort rubrik för vad releasen handlar om */
  title: string
  /** En rad per punkt, skriven som nytta för användaren */
  items: ChangelogItem[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.77.0',
    date: '2026-10-22',
    title: 'Fakturavägen bekräftas vid första fakturan',
    items: [
      { kind: 'nyhet', text: 'Varje kund har en fakturaväg: e-post, e-faktura eller brev. Den syns överst i fakturan och under Faktureringsinställningar på kunden. Faktureringsansvarig kan ändra den där, och Fortnox-kortet uppdateras direkt. Den nya guiden Välj fakturaväg för en kund i handboken visar hur det går till.' },
      { kind: 'andring', text: 'En faktura kan inte godkännas eller skickas till Fortnox förrän kundens fakturaväg är bekräftad. Saknas den väljer faktureringsansvarig vägen i fakturan. Säljaren behöver inte veta hur kunden vill betala.' },
      { kind: 'andring', text: 'Det kunden skriver om fakturan i Oneflow-avtalet tas om hand. En e-postadress blir fakturavägen e-post. En postadress eller skanningsadress hamnar som fakturaadress, och ekonomi bekräftar vägen vid första fakturan. Förut kunde en adress hamna i fältet för fakturamejl.' },
      { kind: 'buggfix', text: 'En ändring i ett Oneflow-avtal kunde koppla loss avtalet från kunden som valts i avtalswizarden. Nu ligger kopplingen kvar.' },
    ],
  },
  {
    version: '3.76.0',
    date: '2026-10-22',
    title: 'Admin ser vem som läst guiderna',
    items: [
      { kind: 'nyhet', text: 'Läskvittenser har en ny flik, Guider. Där ser admin för varje medarbetare vilka guider för den egna rollen som är öppnade och genomgångna, när, hur länge, hur långt man kom i stegen, om övningen gjordes och hur det gick på frågorna. Det går också att se per guide vilka som inte har läst den.' },
      { kind: 'andring', text: 'Handboken säger nu att portalen sparar vilka guider man har öppnat och hur det gick. Bara admin ser det.' },
    ],
  },
  {
    version: '3.75.0',
    date: '2026-10-21',
    title: 'Webbförfrågningar visar om de kom via en film',
    items: [
      { kind: 'nyhet', text: 'En förfrågan från begone.se som skickas efter knappen under en film får raden "Kom till formuläret via: Knappen under filmen". Då ser vi om filmerna på råttsidan och mussidan ger förfrågningar.' },
    ],
  },
  {
    version: '3.74.0',
    date: '2026-10-21',
    title: 'Statusknappen syns',
    items: [
      { kind: 'andring', text: 'Knappen för att byta status i ärendefönstren heter nu "Ändra status" och är grön med en egen ikon, så den är lätt att hitta. Önskemål från teknikerna.' },
      { kind: 'andring', text: 'Mellanstatusar som Återbesök visas som text med en färgad punkt bredvid stegen.' },
      { kind: 'andring', text: 'Handbokens guide Skapa ett ärende och välj rätt ärendetyp förklarar nu alla ärendetyper, och när en avtalskund ska ha Extrabesök Avtalskund i stället för ett engångsjobb.' },
      { kind: 'buggfix', text: 'Tekniker som öppnade portalen från hemskärmen eller en länk kunde få handboken för admin, med texten "Inga guider för din roll ännu". Nu följer handboken och ärendefönstren alltid portalen man står i.' },
    ],
  },
  {
    version: '3.73.1',
    date: '2026-10-21',
    title: 'Avtalsfakturor går att skicka till Fortnox',
    items: [
      { kind: 'buggfix', text: 'Avtalsfakturor får Vår referens i Fortnox: kundansvarig, annars säljaren som skickade avtalet. Förut kom referensen bara med om avtalet hade en kundansvarig, vilket nästan inga avtal har.' },
      { kind: 'buggfix', text: 'Avtalsfakturor stoppades av Fortnox med "Dokumenttext innehåller ogiltiga tecken". Fakturatexten innehöll mittpunkter (·) som Fortnox inte godtar. Text som skickas till Fortnox tvättas nu från sådana tecken, i portalen ser texten ut som förut.' },
    ],
  },
  {
    version: '3.73.0',
    date: '2026-10-21',
    title: 'Avtalskunder får kundnummer från Fortnox',
    items: [
      { kind: 'andring', text: 'En ny avtalskund får sitt kundnummer första gången ett utkast skickas till Fortnox, på samma sätt som engångskunder. Numret tas ur kundgruppen som valdes i avtalsguiden. Finns personen eller bolaget redan i Fortnox används det kortet.' },
      { kind: 'buggfix', text: 'Förut fick avtalskunden ett nummer redan vid signeringen, men bara i portalen. Fortnox kunde då ge samma nummer till en annan kund innan första fakturan skickades.' },
      { kind: 'andring', text: 'En kund utan kundnummer visas inte längre som ett fel. Kundkortet säger "Kundnummer ges vid första Fortnox-utkastet" och punkten i kundlistan är grå.' },
    ],
  },
  {
    version: '3.72.4',
    date: '2026-10-21',
    title: 'Fakturor hamnar aldrig på fel Fortnox-kund',
    items: [
      { kind: 'buggfix', text: 'Innan en faktura skickas till Fortnox kontrolleras att kundnumret där har samma person- eller organisationsnummer som kunden. Gäller nu även avtalsfakturor, inte bara engångskunder. Stämmer det inte stoppas sändningen med ett meddelande om vem numret tillhör.' },
    ],
  },
  {
    version: '3.72.3',
    date: '2026-10-21',
    title: 'Uppsagda avtal faktureras till slutdatumet',
    items: [
      { kind: 'buggfix', text: 'Ett uppsagt avtal faktureras till och med sista giltiga dag. Förut stängdes faktureringen av direkt vid uppsägningen, så ett månadsfakturerat avtal missade sina sista månader.' },
      { kind: 'andring', text: 'Uppsägningsrutorna föreslår sista giltiga dag enligt avtalet. Hinner uppsägningen före sista uppsägningsdag gäller avtalet till periodskiftet, annars har det redan förlängts ett år. Datumet går att ändra.' },
    ],
  },
  {
    version: '3.72.2',
    date: '2026-10-21',
    title: 'Uppsagda avtal försvinner ur schemat',
    items: [
      { kind: 'buggfix', text: 'När ett avtal sägs upp tas ärendena efter slutdatumet bort ur schemat. Förut avbokades bara kontrollerna, och ärendena låg kvar som Bokad. Besök på sista giltiga dagen ligger kvar.' },
      { kind: 'andring', text: 'Ångras uppsägningen kommer både kontrollerna och ärendena tillbaka i schemat.' },
    ],
  },
  {
    version: '3.72.1',
    date: '2026-10-21',
    title: 'Schemat för avtal utan slutdatum',
    items: [
      { kind: 'andring', text: 'Avtal utan slutdatum räknas som avtalsstarten plus avtalstiden, till exempel 3 år, eller ett år om avtalstid saknas. Hela den perioden läggs ut i schemat, sedan ett år i taget som faktureringen.' },
    ],
  },
  {
    version: '3.72.0',
    date: '2026-10-21',
    title: 'Återkommande kontroller följer avtalsåret',
    items: [
      { kind: 'buggfix', text: 'Ett schema med till exempel 6 kontroller per år fick 6 kontroller varannan månad när det förlängdes. Nu får det 6 per år, jämnt fördelade.' },
      { kind: 'andring', text: 'Kontrollerna läggs ut till avtalets periodskifte. Dagen efter sista uppsägningsdag läggs hela nästa avtalsår ut automatiskt, om avtalet inte är uppsagt. Förut förlängdes schemat två månader i taget.' },
      { kind: 'andring', text: 'Har kunden redan ett återkommande schema går det inte att lägga ett till. Rutan visar det befintliga schemat och när nästa avtalsår läggs ut.' },
      { kind: 'nyhet', text: 'Startdatumet för ett schema kan väljas fritt, även efter periodskiftet. Ett datum bakåt sätter bara rytmen, kontroller läggs aldrig ut före i dag.' },
    ],
  },
  {
    version: '3.71.2',
    date: '2026-10-20',
    title: 'Dokumentlistan i upphandlingar',
    items: [
      { kind: 'andring', text: 'Dokumentlistan under Underlag är en lista i stället för en tabell, så att Ta bort och Kör igen alltid syns. Felmeddelandet visas i sin helhet.' },
      { kind: 'andring', text: 'Listan över senaste uppladdningen går att stänga.' },
      { kind: 'buggfix', text: 'Läs in frågorna i en RFI visar inte längre "svar följde med" när inga svar var ifyllda, och varnar bara för AI:n när inte alla frågor hittades.' },
    ],
  },
  {
    version: '3.71.1',
    date: '2026-10-20',
    title: 'RFI-frågorna går att läsa in',
    items: [
      { kind: 'buggfix', text: 'Läs in frågorna i en RFI misslyckades med "null value" när formuläret hade både företagsuppgifter och fritextfrågor. Frågorna sparas nu.' },
    ],
  },
  {
    version: '3.71.0',
    date: '2026-10-20',
    title: 'RFI-läge i upphandlingsportalen',
    items: [
      { kind: 'nyhet', text: 'En RFI har nu ett eget läge med fyra steg: Översikt, Underlag, Svar och Uppföljning. Kalkyl, krav och prisbilaga visas inte, och knappen heter Markera som besvarad. Läget kan bytas i sidhuvudet om annonstypen är fel.' },
      { kind: 'nyhet', text: 'Köparens frågeformulär läses in fråga för fråga, ordagrant och i ordning, med var svaret ska stå. Under Svar fyller du i varje fråga, låter AI skriva utkast ur BeGones eget material och godkänner svaren ett i taget.' },
      { kind: 'nyhet', text: 'Exportera ifyllt formulär skriver svaren i en kopia av köparens Word-fil på rätt ställen. Företagsuppgifter som omsättning och moderbolag sparas och fylls i automatiskt nästa gång.' },
      { kind: 'nyhet', text: 'När RFI:n är besvarad följs köparen under Signaler, godkända svar kan sparas i anbudsbiblioteket och Uppföljning visar den riktiga annonsen när den dyker upp.' },
    ],
  },
  {
    version: '3.70.4',
    date: '2026-10-19',
    title: 'Avtalspriset är exkl. moms för alla',
    items: [
      { kind: 'buggfix', text: 'Avtalswizarden lade på moms på privatpersoners pris innan avtalet skickades till Oneflow, och signeringen drog sedan av momsen igen. Nu är priset i Oneflow-avtalet alltid exkl. moms, för privatpersoner som för företag, och premien i portalen är exakt avtalspriset. Momsen läggs på fakturan.' },
    ],
  },
  {
    version: '3.70.3',
    date: '2026-10-19',
    title: 'Besök som försvann ur schemat',
    items: [
      { kind: 'buggfix', text: 'Flyttar du ett besöks Från tid i ärendet följer Till tid med och besöket behåller sin längd. Förut stod sluttiden kvar på det gamla datumet och besöket syntes inte i schemat.' },
      { kind: 'andring', text: 'Ett besök går inte att spara med en sluttid före starttiden. Du får meddelandet "Sluttid kan inte vara tidigare än starttiden." Det gäller när du skapar ärenden, ändrar dem, bokar återbesök och flyttar besök i schemat.' },
    ],
  },
  {
    version: '3.70.0',
    date: '2026-10-18',
    title: 'Handboken i ordning',
    items: [
      { kind: 'nyhet', text: 'Handboken visar guiderna i fem ämnen i den ordning du bör läsa dem: Kom igång, Ärenden och besök, Stationer och kontroller, Pris och fakturering och Försäljning. Överst ser du hur många du har läst och vilken guide som är nästa.' },
      { kind: 'andring', text: 'Du ser guiderna för vyn du står i. Har du flera roller byter du vy för att se de andra rollernas guider.' },
      { kind: 'buggfix', text: 'I guiderna som visar datorns skärm lade sig skärmen över stegen. Nu står stegen överst och skärmen i full bredd under.' },
      { kind: 'buggfix', text: 'Gamla länkar och bokmärken till guider leder till din egen version av guiden. Öppnar du teknikerns version från kontorsvyn kommer du till kontorets.' },
    ],
  },
  {
    version: '3.69.1',
    date: '2026-10-17',
    title: 'Delfaktura och anpassat pris, offerttext från ärendet',
    items: [
      { kind: 'buggfix', text: 'Har ett ärende ett anpassat pris för hela jobbet går det inte att delfakturera. Rutan är grå och priset faktureras en gång, när ärendet avslutas. Fasta priser från kundens prislista påverkas inte.' },
      { kind: 'buggfix', text: 'En offert som skapas från ett ärende får texten från ärendets tjänster i stället för avtalets standardtext. Står standardtexten kvar i en offert blir kontrollen gul: Kontrollera offertinnehållet.' },
      { kind: 'buggfix', text: 'Ärenden som tagits bort med papperskorgen i Mina ärenden syns inte längre i schemat.' },
      { kind: 'andring', text: 'Ett följeärende har samma ärendenummer som det första ärendet, som det var tidigare.' },
    ],
  },
  {
    version: '3.69.0',
    date: '2026-10-17',
    title: 'Rättningar i återbesök, tickets, säljarvyn och borttagna ärenden',
    items: [
      { kind: 'buggfix', text: 'Återbesök i avtalsärenden: rutan stängs när återbesöket är bokat, du måste välja en ny tid och samma merförsäljning kan inte delfaktureras två gånger. Återbesök från en egenkontroll fungerar igen.' },
      { kind: 'buggfix', text: 'Markera löst och Återöppna på tickets fungerar för den som startade ticketen, den som är nämnd i den och för admin och koordinator. Går det inte står det varför. Svara syns alltid i telefonen.' },
      { kind: 'nyhet', text: 'Säljare kan söka med Ctrl+K, byta vy och rapportera tillbud från säljarvyn.' },
      { kind: 'buggfix', text: 'Följeärenden får ett eget ärendenummer. Ett borttaget ärende försvinner direkt ur schemat och listan, och papperskorgen i Mina ärenden tar bort på samma sätt som Radera.' },
    ],
  },
  {
    version: '3.68.0',
    date: '2026-10-16',
    title: 'Ny handbok: en guide per uppgift och roll',
    items: [
      { kind: 'nyhet', text: 'Alla guider i handboken är omgjorda efter samma mall: kort svar överst, steg bredvid en skärm som ser ut som portalen, vad du gör om det krånglar, en övning där du provar själv och några frågor på slutet.' },
      { kind: 'andring', text: 'Du ser bara guiderna för din roll. Tekniker får guider med telefonens skärm, kontoret med datorns. Samma ämne kan finnas i två versioner, en för varje.' },
      { kind: 'andring', text: 'Knappen för återbesök i ärendet har fått en egen ikon med två fotspår, samma som i guiderna.' },
    ],
  },
  {
    version: '3.67.0',
    date: '2026-10-16',
    title: 'Handboken: delfakturering och återbesök',
    items: [
      { kind: 'nyhet', text: 'Ny guide i handboken om delfakturering: fakturera det som är gjort när återbesöket bokas, samla en månads besök på en faktura och delfakturera merförsäljning hos avtalskunder. Med en övning där du provar själv.' },
      { kind: 'nyhet', text: 'Ny guide om att boka återbesök, med en klickbar övning från fotspåren till bokat besök. Guiderna länkar till varandra, och båda faktureringsguiderna länkar till delfakturering.' },
    ],
  },
  {
    version: '3.66.1',
    date: '2026-10-16',
    title: 'Färre felträffar i upphandlingsbevakningen',
    items: [
      { kind: 'buggfix', text: 'Korta sökord som möss, mygg och duvor räknas inte längre mitt i andra ord. "Studentmössor" gav tidigare en träff på möss. Husmöss, myggor och myggbekämpning ger fortfarande träff.' },
    ],
  },
  {
    version: '3.66.0',
    date: '2026-10-16',
    title: 'Bearbetningsfönstret räknas mot basavtalet',
    items: [
      { kind: 'andring', text: 'Bearbetningsfönstret (18 till 12 månader före slut) räknas nu mot basavtalets slut, inte mot sista möjliga slut med förlängningsoptioner. Köparen kan välja att inte förlänga, så vi börjar bearbeta i tid. Det gäller avtalsklockans lägen och sortering, Idag, notisen och sammandraget. I prognosen räknas annonsen tidigast inför basavtalets slut, och avtal med optioner visas som osäkra eftersom annonsen kan komma senare om köparen förlänger.' },
      { kind: 'nyhet', text: 'Slutdatumet i avtalsklockan, köparprofilens avtal och upphandlingens översikt är basavtalets slut. Har avtalet förlängningsoptioner står en liten ikon efter datumet: håll muspekaren över eller tryck på den för att se optionerna, sista möjliga slut, varifrån uppgiften kommer och om en option troligen är avropad.' },
    ],
  },
  {
    version: '3.65.0',
    date: '2026-10-16',
    title: 'Avtalsklocka med tidslinje, kontaktpersoner och egna poster',
    items: [
      { kind: 'nyhet', text: 'Avtalsklockan ritar varje avtal på en tidslinje med bearbetningsfönster, förlängningsoption och avtalsslut. Sök, sortera, välj område och filtrera på köpare där bara två anbudsgivare brukar svara. Status och ansvarig byts i en meny, felträffar ligger under Status och listan går att exportera till Excel.' },
      { kind: 'andring', text: 'Förlängningsoptionerna läses nu ur annonsen (antal, längd eller sista möjliga slut) innan avtalsklockan antar ett år per förlängning. Hur slutdatumet räknats syns på raden.' },
      { kind: 'nyhet', text: 'Köparprofilen har Kontaktpersoner: kontakten ur TED-annonserna kommer med automatiskt, och du kan lägga till egna med roll, telefon, e-post och senast kontakt. Kontaktpersonen syns också i avtalsklockan och i upphandlingens översikt.' },
      { kind: 'nyhet', text: 'Ny post på Anbud: lägg upp en direktupphandling, ett avrop från ramavtal eller en offertförfrågan som inte kommer via någon annons. Den hamnar som Bedöms på tavlan.' },
      { kind: 'nyhet', text: 'Notis när ett avtal går in i bearbetningsfönstret, en gång per avtal, med länk till köparen. Stängs av under Inställningar, Sammandrag och notiser.' },
      { kind: 'andring', text: 'Prognos visar en enda prognos per kvartal: avtalsklockans väntade annonser plus öppna anbud, med ljusare stapel för osäkert slutdatum. Signaler går att exportera till Excel och status byts i en meny. I köparprofilen begärs handlingar per tidigare avtal.' },
    ],
  },
  {
    version: '3.64.0',
    date: '2026-10-16',
    title: 'Annonser, anbudstavla och upphandlingen i steg',
    items: [
      { kind: 'nyhet', text: 'Annonser är en inkorg med Nya, Alla öppna, Under tröskeln och Osorterad e-post. Sök, välj område och sortering, ta upp eller avstå direkt i listan och exportera listan till Excel.' },
      { kind: 'nyhet', text: 'Anbud öppnar på en tavla med Bedöms, Anbud pågår, Lämnat och Avgjort. Dra korten mellan kolumnerna på datorn eller byt status i kortets meny på mobilen. Listan finns kvar under Lista.' },
      { kind: 'andring', text: 'En upphandling visas i fem steg: Översikt, Underlag, Kalkyl, Anbud och Utfall, plus Logg. Status och ansvarig byts i sidhuvudet, där också Avstå och Markera som lämnat finns.' },
      { kind: 'nyhet', text: 'Hämta underlaget öppnar rätt sida hos e-Avrop, TendSign eller Kommers. Släpp sedan zip-filen på upphandlingen, så packas den upp och varje fil läses av AI.' },
      { kind: 'nyhet', text: 'Prisbilagan i fyra steg: läs in köparens prisbilaga, föreslå priser ur prislistan och kalkylen med marginal per rad, justera och exportera med priserna inskrivna i köparens egen Excel-fil.' },
    ],
  },
  {
    version: '3.63.0',
    date: '2026-10-15',
    title: 'Ny ordning i upphandlingsportalen',
    items: [
      { kind: 'nyhet', text: 'Upphandlingsportalen öppnar på Idag: sista anbudsdag inom 14 dagar, nya annonser att ta upp eller avstå från, avtal som just gått in i bearbetningsfönstret, dina uppgifter och nya signaler.' },
      { kind: 'andring', text: 'Menyn följer jobbet: Idag, Framförhållning (avtalsklocka, signaler, prognos), Annonser (tidigare Bevakning), Anbud (lista och anbudsbibliotek) och Marknad (översikt, köpare, konkurrenter, lärdomar, fråga datan). Inställningar och Mitt konto ligger i kontomenyn, och sök öppnas med Ctrl+K.' },
      { kind: 'andring', text: 'Nya statusord: Bedöms ersätter Bevakas och Analyseras, Lämnat ersätter Anbud lämnat. I avtalsklockan heter Öppen nu Ej kontaktad och Planerad heter Möte bokat, och signaler som bevakas heter Följs.' },
      { kind: 'andring', text: 'Marknad, avtalsklockan och köparlistan visar hela Sverige från början, och går att avgränsa till Norrland, Svealand, Götaland eller ett län.' },
      { kind: 'buggfix', text: 'Sökning på BGU-nummer när man flyttar e-post till en upphandling hittade inga träffar.' },
    ],
  },
  {
    version: '3.62.0',
    date: '2026-10-15',
    title: 'Fakturaplan inom bindningstiden',
    items: [
      { kind: 'andring', text: 'Planera fakturor planerar bara avtalets nuvarande bindningstid. Nästa avtalsperiod skapas automatiskt dagen efter sista uppsägningsdag, om avtalet inte sagts upp.' },
      { kind: 'andring', text: 'Förlängningen av avtal kontrolleras nu varje natt i stället för en gång i månaden.' },
      { kind: 'buggfix', text: 'Förlängningen kunde skapa dubbla fakturautkast för kunder utan avtalsrad.' },
      { kind: 'buggfix', text: 'Artiklar faktureras aldrig som egna rader med inköpspris. De ingår i tjänsten de hör till.' },
    ],
  },
  {
    version: '3.61.0',
    date: '2026-10-15',
    title: 'Signerade avtal läggs upp av sig själva',
    items: [
      { kind: 'nyhet', text: 'När ett avtal från portalen signeras skapas kunden, avtalskartan och fakturaplanen automatiskt. Premiefakturan hamnar under Avtalskunder och faktureringsansvariga får en notis om vad som ska kontrolleras.' },
      { kind: 'nyhet', text: 'Ärenden med avtal får egna statusar: "Avtal skickat" och "Avtal signerat - Etablera". Offerter behåller sina.' },
      { kind: 'buggfix', text: 'Avtal som signerades på eller efter startdatum fick ingen kund och försvann ur Dokumentsignering. Nu syns de under Signerade och räknas i signeringsgraden.' },
      { kind: 'andring', text: 'Ett ärende som stängs med 0 kr skapar ingen faktura. Avtalsraden på ett ärende faktureras aldrig som engångstjänst när avtalet signerats.' },
    ],
  },
  {
    version: '3.60.0',
    date: '2026-10-15',
    title: 'Arbetskostnad för ROT och RUT',
    items: [
      { kind: 'nyhet', text: 'Privatärenden: skriv totalpriset inkl. moms på tjänsten och ange hur mycket som är arbete. Arbetet blir en egen rad och visas under tjänsten, med uträkning av avdraget och vad kunden betalar.' },
      { kind: 'andring', text: 'Totalpriset ändras inte när arbetet delas upp. Uppdelningen kan ändras eller tas bort i efterhand.' },
      { kind: 'andring', text: 'Fakturan kallar arbetsraden "Arbetskostnad" med tjänstens namn och skickar timmarna till Fortnox för Skatteverket.' },
      { kind: 'buggfix', text: 'Fakturan stoppas om ärendet har både ROT och RUT eller avdrag på fel tjänst, och anpassat pris ger inte längre avdrag på hela beloppet.' },
    ],
  },
  {
    version: '3.59.1',
    date: '2026-10-15',
    title: 'Dela upp för ROT/RUT',
    items: [
      { kind: 'buggfix', text: 'Dela upp för ROT/RUT säger direkt i formuläret varför uppdelningen inte går, till exempel när arbetet är större än radens pris.' },
    ],
  },
  {
    version: '3.59.0',
    date: '2026-10-15',
    title: 'Fakturaplanen kollar Fortnox',
    items: [
      { kind: 'nyhet', text: 'Planera fakturor kontrollerar perioder som redan har börjat mot kundens fakturor i Fortnox. Finns fakturan redan där kopplas utkastet till den i stället för att ligga kvar som Väntar, så att ingen dubblett skickas.' },
      { kind: 'nyhet', text: 'Har Fortnox-fakturan ett indexerat belopp kopplas den ändå och årspremien får ett indexsteg från periodstart. Passar flera fakturor väljer du själv vilken som är periodens.' },
      { kind: 'nyhet', text: 'Saknas fakturan i Fortnox fast perioden har börjat står det Saknas i Fortnox, att skicka. Avtalskartan varnar i § 6 när en period är fakturerad i Fortnox men inte kopplad.' },
    ],
  },
  {
    version: '3.58.0',
    date: '2026-10-15',
    title: 'Automatisk prislista',
    items: [
      { kind: 'andring', text: 'Förvalslistan heter nu Automatisk prislista och innehåller hela den generella avropslistan: saneringar, hundsök, värmebehandling, tilläggsstationer, ljusfälla och timpris. Kunder utan egen prislista får alla priserna i § 2 på avtalskartan.' },
      { kind: 'andring', text: 'Standard avropsavtal har fått tilläggsstation, ljusfälla och timpris. Artikellistan med interna kostnader heter Intern prislista.' },
    ],
  },
  {
    version: '3.57.0',
    date: '2026-10-15',
    title: 'Egna ikoner i bokningen',
    items: [
      { kind: 'andring', text: 'Nytt ärende, bokningsförslagen och tjänstelistan använder portalens egna ikoner, med nya ritningar för bland annat team, restid, bokningsförslag och etablering.' },
      { kind: 'buggfix', text: 'Utskick, restid och Lägg till i avtalet har fått ikoner som visar vad de gör.' },
      { kind: 'andring', text: 'Bokningsförslagen visar rang, Bäst val och betyg på en lugn statusrad överst i kortet i stället för brickor.' },
    ],
  },
  {
    version: '3.56.1',
    date: '2026-10-15',
    title: 'Kundgrupp bara där den behövs',
    items: [
      { kind: 'buggfix', text: 'Nytt ärende för avtalskund frågar inte längre efter kundgrupp. Gruppen och kundnumret finns redan på kunden.' },
    ],
  },
  {
    version: '3.56.0',
    date: '2026-10-14',
    title: 'Specialrapporter i ärendena',
    items: [
      { kind: 'nyhet', text: 'Specialrapporter syns i alla ärenden: privat, företag, avtal, rondering och egenkontroll, med knappar för att öppna rapporten och ladda ner PDF:en.' },
      { kind: 'andring', text: 'Tillbaka från en specialrapport leder till ärendet du kom ifrån.' },
      { kind: 'andring', text: 'Varning om osparade ändringar i ärendet när du öppnar en specialrapport.' },
      { kind: 'buggfix', text: 'Ny specialrapport från ett ärende väljer alltid rätt ärende.' },
      { kind: 'buggfix', text: 'Rondering: bilder som inte sparats sparas nu när ärendet stängs, i stället för att stängningen kunde fastna.' },
    ],
  },
  {
    version: '3.55.0',
    date: '2026-10-14',
    title: 'Specialrapporter: tätare redigering och hela rapporten i förhandsvisningen',
    items: [
      { kind: 'nyhet', text: 'Händelserna går att sortera själv: dra i greppet, använd Flytta upp och Flytta ned i menyn eller Alt och piltangenterna. Ordningen följer med till rapporten och PDF:en.' },
      { kind: 'andring', text: 'Händelser och bilder visas mycket tätare: en rad per händelse som öppnas för redigering med ett klick, och bilderna i ett rutnät med upp till fem i bredd. Delens rubrik och egenskaper tar mindre plats.' },
      { kind: 'nyhet', text: 'Förhandsvisningen visar alla sidor under varandra med sidbrytningar och sidnummer, och följer med till delen du redigerar. Med Hela PDF:en ser du rapporten sida för sida i helskärm och kan ladda ner eller skicka direkt.' },
    ],
  },
  {
    version: '3.54.2',
    date: '2026-10-14',
    title: 'Specialrapporter: nya ikoner för händelsetyperna',
    items: [
      { kind: 'andring', text: 'Händelsetyperna har fått egna ikoner i samma stil som avtalswizarden, i snabbknapparna, typväljaren, händelsekorten, hämtningen från ärendet och i mobilen. Snabbknapparna är nu en lugn grupp där typen syns i ikonen, och Avvikelse känns igen på sin röda varningstriangel.' },
    ],
  },
  {
    version: '3.54.1',
    date: '2026-10-14',
    title: 'Specialrapporter: tydligare slutsats och en guide i handboken',
    items: [
      { kind: 'andring', text: 'Bedömning och åtgärder har samma kort som Om rapporten: en banderoll med antal avvikelser, händelser och åtgärder, ett kort för bedömningen, en lista över rapportens avvikelser som leder till rätt del och ett tydligt kort för de rekommenderade åtgärderna.' },
      { kind: 'nyhet', text: 'Handboken har en ny guide, Specialrapporter: en rapport för krångliga uppdrag, för tekniker, koordinator och admin. Den går igenom hela vägen från ny rapport till utskick, med en klickbar bild av rapportens delar och en övning i Snygga till.' },
    ],
  },
  {
    version: '3.54.0',
    date: '2026-10-14',
    title: 'Specialrapporter: avvikelser och rekommenderade åtgärder syns tydligt',
    items: [
      { kind: 'nyhet', text: 'Ny händelsetyp Avvikelse för sådant kunden behöver åtgärda. Den har en egen röd snabbknapp och syns som ett rött kort med varningsikon i redigeraren.' },
      { kind: 'nyhet', text: 'I rapporten får avvikelser en röd markering i händelsetabellen, en ruta överst i delen och en sammanfattning på översikten med vilken del varje avvikelse hör till.' },
      { kind: 'andring', text: 'Rekommendationer heter nu Rekommenderade åtgärder och skrivs som en numrerad lista, en åtgärd per rad. Enter ger nästa rad, och raderna kan flyttas upp och ned eller tas bort. Det du redan skrivit delas upp i rader automatiskt.' },
      { kind: 'andring', text: 'Kunden ser åtgärderna som numrerade punkter i en grön panel, och översikten visar de tre första under Det här rekommenderar vi.' },
    ],
  },
  {
    version: '3.53.0',
    date: '2026-10-14',
    title: 'Specialrapporter: tydligare redigerare och bilder kopplade till händelser',
    items: [
      { kind: 'nyhet', text: 'Bifoga bilder direkt från en händelse med gemknappen. Bilden hamnar i delens bildblock, händelsen visar miniatyrerna och rapportens händelsetabell hänvisar till bildens nummer.' },
      { kind: 'nyhet', text: 'Varje bild kan kopplas till en händelse i bildblocket med valet Hör till händelse. I PDF:en står det vilken händelse bilden hör till.' },
      { kind: 'andring', text: 'Om rapporten visar rapportens framsida med titel, period, siffror och karta, ett kundkort med klickbar telefon, e-post och adress för alla sorters kunder, typ av rapport som tre kort och startfraser för inledningen.' },
      { kind: 'andring', text: 'En del har nu ett rubrikband i delens färg, typ, färg och plats samlade på en rad, och blocken som kort där flytta och ta bort finns under menyn med tre punkter.' },
      { kind: 'andring', text: 'Bilder till en händelse kan tas med kameran eller väljas ur bildbiblioteket i mobilen, även i Ny händelse.' },
    ],
  },
  {
    version: '3.52.0',
    date: '2026-10-14',
    title: 'Specialrapporter: Snygga till texten',
    items: [
      { kind: 'nyhet', text: 'Snygga till läser igenom texten i en specialrapport och föreslår rättelser av stavning, stor bokstav, skiljetecken och stycken. Knappen finns på varje textblock, händelseblock och bildblock, i Om rapporten och i Bedömning och åtgärder, och i rubrikraden för hela rapporten på en gång.' },
      { kind: 'nyhet', text: 'Du ser alla förslag innan något ändras: borttaget rött och överstruket, nytt i grönt. Bocka i eller ur per förslag eller per grupp. Förslag om formulering är avbockade från början. Ångra finns direkt efteråt.' },
      { kind: 'nyhet', text: 'Siffror, datum, mängder, kundens namn och adress och alla namn på artiklar, tjänster, produkter, preparat och stationstyper ändras aldrig, utom för att skriva ett produktnamn exakt som i listan. Är ett ord rätt stavat kan du lägga till det i ordlistan direkt från förslaget.' },
      { kind: 'nyhet', text: 'Ordlistan (för koordinator och admin) visar alla skyddade ord. Lägg till egna ord, ta bort dem igen eller stäng av ett namn som hämtats automatiskt.' },
    ],
  },
  {
    version: '3.51.0',
    date: '2026-10-14',
    title: 'Specialrapporter: se rapporten som kunden medan du skriver',
    items: [
      { kind: 'nyhet', text: 'Bredvid det du skriver syns nu en sida som ser ut som rapporten kunden får. Den uppdateras medan du skriver, fältet du står i ramas in, och trycker du på något på sidan hamnar du i rätt fält. På smalare skärmar öppnas sidan med Visa som kund i en panel från höger, så att skrivytan aldrig blir för smal. I mobilen finns samma sida under Visa som kund.' },
      { kind: 'nyhet', text: 'Varje del har en egen färg som syns i listan, på kartan och i PDF:en, så det är lätt att se vilket område som är vilket. Färgen går att byta.' },
      { kind: 'nyhet', text: 'Klar att skicka visar vad som återstår: inledning, minst en del, händelser, bedömning och rekommendationer. Tryck på en rad för att komma dit. Du kan alltid skicka, men utskicket påminner om det som saknas.' },
      { kind: 'nyhet', text: 'Lägg till del frågar vad delen ska handla om: område, besök, underleverantör eller fritt. Har ärendet besök som inte finns i rapporten kan du skapa en del per besök med ett tryck. När du ritat ett område på kartan får du namnge det och välja färg direkt.' },
      { kind: 'andring', text: 'Sektion heter nu del, och försättssidan heter Om rapporten med kort för kund, ärende, kontaktperson och adress. Nya delar och textblock är tomma med exempel i stället för ifylld text, och typ av rapport föreslås utifrån ärendet när du skapar en rapport.' },
      { kind: 'andring', text: 'I mobilen finns en flikrad längst ned med Delar, Redigera och Visa som kund, och varje del kan flyttas upp eller ned från menyn vid delen.' },
    ],
  },
  {
    version: '3.50.1',
    date: '2026-10-14',
    title: 'Specialrapporter: bättre ritning av områden',
    items: [
      { kind: 'andring', text: 'När du ritar ett område syns en streckad linje från sista hörnet till pekaren och tillbaka till första hörnet, så du ser hur området blir innan du klickar. Hörnen går att dra för att justera, och området stängs bara när du trycker på första hörnet eller Skapa sektion.' },
      { kind: 'andring', text: 'Områdena på kartan syns tydligt i grönt, och det valda området har vit kant.' },
      { kind: 'buggfix', text: 'Redigeraren blev bredare än skärmen, så att knapparna för förhandsgranskning, nedladdning, skicka och ta bort sektion hamnade utanför. Nu får allt plats.' },
    ],
  },
  {
    version: '3.50.0',
    date: '2026-10-14',
    title: 'Specialrapporter',
    items: [
      { kind: 'nyhet', text: 'Specialrapporter: en egen rapport kopplad till ett ärende, för uppdrag som inte passar i en vanlig rapport. Dela in den i sektioner per område, besök, underleverantör eller fritt, och bygg varje sektion av text, händelser med datum, bilder och kartutsnitt.' },
      { kind: 'nyhet', text: 'Rita områden på en satellitkarta, så blir varje område en egen sektion. Händelser kan läggas till ute på plats i mobilen, och besök och kontroller kan hämtas från ärendet.' },
      { kind: 'nyhet', text: 'Rapporten blir en PDF enligt vår dokumentstandard och mejlas till kunden. Varje skickad version låses och sparas, och du kan fortsätta arbeta i nästa version när något nytt har hänt.' },
      { kind: 'nyhet', text: 'Teknikerna på ärendet och koordinatorerna arbetar i samma rapport. Specialrapporter finns i menyn och under Utförande i ärendet.' },
    ],
  },
  {
    version: '3.49.0',
    date: '2026-10-14',
    title: 'Byt stationstyp och ny kontrollrunda',
    items: [
      { kind: 'nyhet', text: 'Byt typ på en utplacerad station, till exempel mekanisk fälla till betesstation, direkt i kontrollrundan eller från utrustningsvyn. Produkt och serienummer väljs för den nya typen, tidigare kontroller står kvar med typen stationen hade då och inomhusstationer får nytt nummer i den nya typens serie.' },
      { kind: 'nyhet', text: 'Byter en tilläggsstation som inte är fakturerad typ gäller den nya typens årspris, och den som godkänner fakturor får en notis. Betald framåt kan den inte byta typ.' },
      { kind: 'andring', text: 'Kontrollrundan har fått egna ikoner i stället för textknappar: verktygsrad med Flytta, Byt typ, Historik och Hämta upp, stationstypens ikon i listan och på kartan, OK som bockknapp och antal med minus och plus.' },
      { kind: 'andring', text: 'Flyttläget på kartan och planritningen visar hur långt stationen flyttas.' },
      { kind: 'buggfix', text: 'På telefon hamnade kartans förklaring och knappar ovanpå kommentarer och flikar när man scrollade i kontrollrundan. Nu stannar de i kartan, och bara rubriken och förloppet ligger kvar överst så att stationslistan får plats.' },
      { kind: 'buggfix', text: 'Byte av typ i utrustningsvyns redigeringsformulär slog inte igenom i kartor, rapporter och fakturering.' },
    ],
  },
  {
    version: '3.48.3',
    date: '2026-10-13',
    title: 'Provisionsinställningar bara för admin',
    items: [
      { kind: 'buggfix', text: 'Bara admin kan ändra provisionsinställningarna och tipsbonusen.' },
    ],
  },
  {
    version: '3.48.2',
    date: '2026-10-13',
    title: 'Svart skärm från ärendet',
    items: [
      { kind: 'buggfix', text: 'Avtal och Offert i ett engångsärende gav svart skärm i stället för att öppna avtalsguiden. Nu öppnas guiden med kundens uppgifter som vanligt, och Skapa lead fungerar som förut.' },
    ],
  },
  {
    version: '3.48.1',
    date: '2026-10-10',
    title: 'Handboken: hoppa till avsnitt',
    items: [
      { kind: 'buggfix', text: 'Hoppa till-korten och innehållsförteckningen i handbokens guider skickade dig till startsidan. Nu går de till rätt avsnitt i guiden.' },
    ],
  },
  {
    version: '3.48.0',
    date: '2026-10-10',
    title: 'Handboken: guider till nya Leads',
    items: [
      { kind: 'nyhet', text: 'Handboken har tre nya guider om Leads, en per roll: Tipsa om en lead för tekniker, Leads för säljare och Leads för koordinator och admin. Var och en ser bara sin.' },
      { kind: 'nyhet', text: 'Guiderna har övningar där du skapar en lead från ett påhittat ärende, trycker Klar, välj nästa och ser tidslinjen fyllas, klickar dig igenom stegen och räknar på tipsbonusen med de inställningar som gäller nu. Ingenting sparas.' },
    ],
  },
  {
    version: '3.47.0',
    date: '2026-10-10',
    title: 'Tipsbonus för leads i provisionerna',
    items: [
      { kind: 'nyhet', text: 'Den som tipsar om en lead som blir vunnen får en tipsbonus i provisionerna, som Tipsbonus: företaget. Bonusen blir klar för utbetalning när kundens första faktura är betald. Ägaren av leaden får ingen tipsbonus.' },
      { kind: 'nyhet', text: 'Under Inställningar på Provisioner finns Tipsbonus för leads: på eller av, procent av första årets premie, lägsta och högsta belopp, lägsta årspremie, om utökning hos befintlig kund räknas, om bara tekniker får bonus och från vilket datum.' },
      { kind: 'nyhet', text: 'Leadens historik visar när tipsbonusen bokförs och när den blir klar för utbetalning.' },
    ],
  },
  {
    version: '3.46.0',
    date: '2026-10-10',
    title: 'Leads: statistiken flyttar in på Leads-sidan',
    items: [
      { kind: 'nyhet', text: 'Fliken Statistik på Leads-sidan visar pipeline per steg och ägare, vinstgrad, vunnen årspremie per månad (nya avtal och utökning för sig), kedjan från lead till affär per källa och ursprung, tid i steg, förlustorsaker och tips per tipsare.' },
      { kind: 'nyhet', text: 'Hygien per ägare visar försenade och saknade nästa steg och hur många nya leads som kontaktades inom två arbetsdagar. Kedjan, hygienen och tipsen kan exporteras till CSV.' },
      { kind: 'andring', text: 'Den gamla sidan Leadsstatistik är borttagen ur menyn; gamla länkar öppnar fliken Statistik. Admin och koordinator ser alla leads, övriga ser statistik över sina egna, tipsade och delade.' },
    ],
  },
  {
    version: '3.45.0',
    date: '2026-10-10',
    title: 'Leads: tips från ärendet och statusen sätter sig själv',
    items: [
      { kind: 'nyhet', text: 'Skapa lead finns i engångsärenden för privatpersoner och företag, både på kontoret och i teknikerns vy. Välj vad det gäller och skriv en rad; kontakt, telefon, adress och skadedjur följer med från ärendet, och finns redan en öppen lead kan tipset läggas som anteckning där.' },
      { kind: 'nyhet', text: 'Boka besök i en lead öppnar ärendemodalen förifylld, och när ärendet sparas blir leaden Besök bokat. Skapa offert öppnar Oneflow-guiden med leaden som källa.' },
      { kind: 'nyhet', text: 'När offerten eller avtalet skickas blir leaden Offert skickad, avböjs det går den tillbaka till Kontaktad med ett nytt nästa steg, och signeras det blir den Vunnen. Den som tipsade får en notis vid offert och vunnen affär.' },
      { kind: 'nyhet', text: 'En vunnen lead utan kund visar steget Koppla eller skapa kund med förslag från kundregistret.' },
    ],
  },
  {
    version: '3.44.0',
    date: '2026-10-10',
    title: 'Nya Leads (B2B): en arbetskö med nästa steg',
    items: [
      { kind: 'nyhet', text: 'Leads (B2B) är omgjord. Fliken Att göra visar försenade, dagens och leads utan nästa steg, plus parkerade som vaknar i dag. Pågående, Nya tips och Alla finns bredvid, och sök och filter sparas i adressen så att en länk visar samma urval.' },
      { kind: 'nyhet', text: 'En lead öppnas med nästa steg överst. Klar, välj nästa loggar vad som gjordes och kräver ett nytt steg, parkering med datum eller förlorad med orsak. Samtal, mejl, möten och anteckningar loggas direkt i tidslinjen.' },
      { kind: 'nyhet', text: 'Ägaren kan överlåta leaden och dela den med kollegor. Ny lead kräver bara fem fält och varnar om samma org.nr, telefon eller e-post redan finns.' },
      { kind: 'andring', text: 'Tekniker hittar sina tips under Mina leads och tips och kan tipsa från mobilen med knappen längst ned.' },
    ],
  },
  {
    version: '3.43.0',
    date: '2026-10-10',
    title: 'Leads: ägare, nästa steg och riktig behörighet',
    items: [
      { kind: 'nyhet', text: 'Varje lead har nu en ägare, ett steg (Ny, Kontaktad, Besök bokat, Offert skickad, Vunnen, Förlorad eller Parkerad), en källa ur en fast lista och ett nästa steg med datum. De 23 befintliga leadsen är överflyttade med den som skapade dem som ägare.' },
      { kind: 'nyhet', text: 'En lead kan delas med kollegor och överlåtas till någon annan. Tekniker och säljare ser bara leads de äger, har tipsat om eller fått delade med sig. Admin och koordinator ser alla.' },
      { kind: 'andring', text: 'Historiken på en lead skrivs nu av systemet med före och efter, och samtal, mejl, möten och anteckningar ligger i samma tidslinje. De gamla "uppdaterad"-raderna följer inte med.' },
      { kind: 'buggfix', text: 'Startsidan för tekniker och säljare räknar nu egna leads och dagens uppföljningar rätt. Förut visade de alltid 0.' },
    ],
  },
  {
    version: '3.42.0',
    date: '2026-10-10',
    title: 'Ett eget ikonset för hela portalen',
    items: [
      { kind: 'nyhet', text: 'Portalen har fått en gemensam ikonstandard med egna ikoner för leads, ärenden, kontakt, dokument, skadedjur och källor. De tas i bruk vy för vy, först i nya Leads. Ikonerna i Leads (Webb) och söklådan ingår redan och ser ut som förut.' },
      { kind: 'nyhet', text: 'Admin kan granska alla ikoner i alla storlekar på sidan Ikoner (/admin/ikoner), söka på namn och växla mellan ljust och mörkt tema.' },
    ],
  },
  {
    version: '3.41.1',
    date: '2026-10-10',
    title: 'Leads: sparning tömmer inte längre fält',
    items: [
      { kind: 'buggfix', text: 'När en lead sparades i Redigera skrevs fält som hemsida, adress, verksamhetstyp, beslutsfattare, upphandling, offertdatum och kontaktdatum över med tomt. Nu sparas bara de fält du faktiskt ändrat.' },
      { kind: 'buggfix', text: 'Historiken på en lead fylls inte längre av dubbla rader och "uppdaterad"-rader för fält som inte ändrats. Varje sparning ger en rad som listar de ändrade fälten.' },
    ],
  },
  {
    version: '3.41.0',
    date: '2026-10-09',
    title: 'Avtalswizarden: tydligare val och en sammanfattning bredvid',
    items: [
      { kind: 'andring', text: 'Valen i avtalswizarden, som dokumenttyp, mall, avtalspart och kundgrupp, visas som kort med egna illustrationer så att det går fort att hitta rätt.' },
      { kind: 'andring', text: 'På bred skärm syns en sammanfattning av avtalet bredvid formuläret, med det du fyllt i hittills: mall, kundgrupp, avtalstid, motpart, årspremie och avtalsobjekt.' },
    ],
  },
  {
    version: '3.40.0',
    date: '2026-10-09',
    title: 'Avtalswizarden: granska avtalet och se Oneflows PDF innan det skickas',
    items: [
      { kind: 'nyhet', text: 'Sista steget visar avtalet som kunden kommer att läsa, med en kontrollista bredvid. Röda punkter, som ett tomt avtalsobjekt eller en ogiltig e-post, måste rättas innan du går vidare. Ändra tar dig till rätt steg och tillbaka till granskningen.' },
      { kind: 'nyhet', text: 'Avtal och offerter skapas först som utkast och du ser Oneflows riktiga PDF i portalen. Därifrån skickar du för signering, går tillbaka och ändrar, eller sparar utkastet till senare.' },
      { kind: 'nyhet', text: 'Sparade utkast ligger överst i Dokumentsignering under "Utkast, ej skickade". Där kan du öppna PDF:en och skicka utan att gå in i Oneflow.' },
      { kind: 'andring', text: 'Motpart har ett nytt fält, E-post för faktura, som följer med till avtalet. Wizarden har fått ett lugnare utseende med stegen överst och knapparna fast i nederkant.' },
    ],
  },
  {
    version: '3.39.0',
    date: '2026-10-09',
    title: 'Avtalswizarden: avtalslängd med enhet och snygga kontaktuppgifter',
    items: [
      { kind: 'nyhet', text: 'Kontaktuppgifterna snyggas till när du lämnar fältet: namn får stor bokstav, telefon skrivs som 070-123 45 67, adressen som "Storgatan 15, 111 22 Stockholm", e-post med gemener och org.nr med bindestreck. Företagsnamn med egen skiftning lämnas som de är.' },
      { kind: 'buggfix', text: 'Avtalet skrev "inledande period om 2." utan enhet. Nu väljer du år eller månader vid avtalslängden och avtalet säger "om 2 år" eller "om 6 månader".' },
      { kind: 'buggfix', text: 'Avtalsöversikten räknade avtal på "6 månader" som sex år i avtalsvärde och snittlängd.' },
    ],
  },
  {
    version: '3.38.1',
    date: '2026-10-08',
    title: 'Fakturamodalen: kundnummer för engångskunder',
    items: [
      { kind: 'buggfix', text: 'Fakturor till privatpersoner och företag utan avtal visar inte längre "Kundnr saknas" i rött. Där står nu att kundnumret tilldelas när utkastet skapas i Fortnox, vilket sker automatiskt.' },
    ],
  },
  {
    version: '3.38.0',
    date: '2026-10-08',
    title: 'Marknad: retargeting',
    items: [
      { kind: 'nyhet', text: 'Sidan Marknad har en ny sektion Retargeting: hur stora besökslistorna är per tjänst och när de är stora nog för att användas i sökannonser.' },
      { kind: 'nyhet', text: 'Lönar det sig? jämför besökare som varit på sajten förut med nya, per kampanj och tjänst, och säger i klartext om det är lönsamt, inte lönsamt eller om det är för lite data än.' },
    ],
  },
  {
    version: '3.37.1',
    date: '2026-10-08',
    title: 'Samtyckesloggen räknar även statistik',
    items: [
      { kind: 'andring', text: 'Cookiesamtycket på sidan Marknad räknar nu valet för Statistik (Google Analytics) tillsammans med Marknadsföring, så godkänt, nekat och delvis stämmer när statistiken slås på på begone.se.' },
    ],
  },
  {
    version: '3.37.0',
    date: '2026-10-07',
    title: 'Leads (Webb): AI-assistenter och hänvisningar per källa',
    items: [
      { kind: 'nyhet', text: 'Förfrågningar från en AI-chatt visar vilken assistent kunden kom från, till exempel ChatGPT, Copilot eller Perplexity, med en egen AI-ikon. Hänvisningar visar källan direkt, till exempel Trustpilot.' },
      { kind: 'nyhet', text: 'Källfiltret går att sätta på AI-assistent eller Hänvisning som helhet eller på en enskild källa.' },
      { kind: 'nyhet', text: 'I statistiken fälls AI-assistent och Hänvisning ut per källa och går att sortera på båda nivåerna. Ny vy Per källa inom kanal, och CSV-exporten tar med källan.' },
    ],
  },
  {
    version: '3.36.0',
    date: '2026-10-07',
    title: 'Ny statistik i Leads (Webb)',
    items: [
      { kind: 'nyhet', text: 'Statistikfliken har nyckeltal med förändring mot föregående period och trendlinje, en tratt från förfrågan till vunnen affär, trend per dag, vecka eller månad, fördelning per tjänst, källa och kundgrupp, och en värmekarta över när förfrågningarna kommer in.' },
      { kind: 'nyhet', text: 'Tabellen Från förfrågan till affär går att sortera, visar värdet av vunna affärer och kan exporteras till CSV. Nya flikar för kanal och ingångssida.' },
      { kind: 'andring', text: 'Statistiken räknas nu i databasen, så den stämmer och går snabbt även med tusentals förfrågningar.' },
    ],
  },
  {
    version: '3.35.0',
    date: '2026-10-07',
    title: 'Leads (Webb) i ny form och sidan Marknad',
    items: [
      { kind: 'nyhet', text: 'Leads (Webb) har filter för fritext, status, tjänst, kundgrupp, källa, tilldelad och datum. Filtren sparas i adressen, så en filtrerad lista går att länka till.' },
      { kind: 'nyhet', text: 'Förfrågningar kan arkiveras en och en eller flera åt gången, så att skräp och avslutade inte syns. Visa arkiverade tar fram dem igen, och Ångra finns direkt efteråt.' },
      { kind: 'andring', text: 'Tabellen i Leads (Webb) har ikoner för tjänst och källa (till exempel Google Ads eller organisk sökning), statuspunkt, fast rubrikrad och kort på mobil.' },
      { kind: 'nyhet', text: 'Ny sida Marknad, nås från Leads (Webb): annonskostnad, visningar, klick, konverteringar, bokade och genomförda uppdrag med värde, förfrågningar per källa och cookiesamtycke. Kräver den nya behörigheten Marknadsansvarig, som sätts i personalvyn.' },
    ],
  },
  {
    version: '3.34.0',
    date: '2026-10-06',
    title: 'Förberett för cookiebannern på begone.se',
    items: [
      { kind: 'nyhet', text: 'Portalen tar emot och sparar besökarnas cookieval från begone.se, utan IP-adress, så att samtycket kan visas i efterhand.' },
      { kind: 'nyhet', text: 'En webbförfrågan sparar nu även annonsklick från iPhone och om besökaren har godkänt mätning, så att förfrågan kan kopplas till rätt annons.' },
    ],
  },
  {
    version: '3.33.0',
    date: '2026-10-06',
    title: 'Guide till sökrutan',
    items: [
      { kind: 'nyhet', text: 'Ny guide i Intranät & Hjälpcenter: Sökrutan. Tekniker och kontor har var sin version med vad du kan skriva, vad ikonerna betyder och vilka snabbval som finns.' },
      { kind: 'nyhet', text: 'I guiden finns en övningssökruta med exempeldata, där du kan prova sökningen och tangenterna utan att röra riktiga ärenden.' },
      { kind: 'nyhet', text: 'När sökrutan är tom finns länken Ny här? Så fungerar sökningen, som går direkt till guiden för din roll.' },
    ],
  },
  {
    version: '3.32.0',
    date: '2026-10-06',
    title: 'Sökrutan fungerar',
    items: [
      { kind: 'nyhet', text: 'Sökrutan högst upp, eller Ctrl+K, söker nu i hela systemet: ärenden, kunder, offerter och avtal, webbleads, tekniker och fakturor. Den känner igen ärendenummer, org.nr, telefon, e-post, kundnummer och postnummer.' },
      { kind: 'nyhet', text: 'Varje träff har en egen ikon för sin typ. Under den markerade raden finns snabbval, till exempel Boka in, Schemat, Ny offert och Nytt avtal med kunden ifylld. Tab hoppar mellan valen.' },
      { kind: 'nyhet', text: 'Tekniker hittar sina egna ärenden och ärenden de delar med andra, kundernas samlade stationsvy och sina egna dokument. Koordinator och admin hittar allt. Skriv ordet arkiv för att även få med gamla ClickUp-ärenden.' },
      { kind: 'buggfix', text: 'Notiser och Gå till ärende i Dokumentsignering ledde till inloggningssidan i stället för till ärendet.' },
    ],
  },
  {
    version: '3.31.0',
    date: '2026-10-06',
    title: 'Ny start: bara portalens egna ärenden räknas',
    items: [
      { kind: 'andring', text: 'Statistik, översikter och listor räknar nu bara ärenden och offerter från portalen. Det gäller dashboards, ekonomi, teknikerstatistik, kundresa, försäljningspipeline, dokumentsignering och AI-assistenterna. De gamla ClickUp-ärendena är arkiverade.' },
      { kind: 'andring', text: 'Kalendrarna för koordinator och tekniker visar inte längre gamla ClickUp-bokningar, inte heller bakåt i tiden.' },
      { kind: 'nyhet', text: 'Ärendesöken och sökningen i schemat har kryssrutan Visa arkiv, för när en kund hör av sig om ett gammalt ärende. Arkiverade träffar är märkta Arkiv (ClickUp).' },
      { kind: 'andring', text: 'Kundkortets siffror räknar bara nya ärenden. Historiken visar fortfarande allt, med gamla ärenden märkta Arkiv (ClickUp). Kunderna ser inte längre gamla offerter i kundportalen.' },
    ],
  },
  {
    version: '3.30.0',
    date: '2026-10-06',
    title: 'Gamla ärenden från ClickUp är arkiverade',
    items: [
      { kind: 'andring', text: 'Ärenden som importerades från ClickUp är arkiverade. De syns inte längre i Mina ärenden, på Översikt eller i Min kundresa, så listorna visar bara det som hanteras i portalen.' },
      { kind: 'andring', text: 'Offerter och avtal från före 2026-05-01 som väntar på signering, har förfallit eller redan är signerade syns inte längre i Dokumentsignering eller i offertstatistiken. Aktiva avtal påverkas inte.' },
    ],
  },
  {
    version: '3.29.1',
    date: '2026-10-06',
    title: 'Leads (Webb): tydligare länkar',
    items: [
      { kind: 'andring', text: 'Öppna ärende, Öppna kunden, Öppna offerten och länken till Leads (B2B) i en webbförfrågan ser nu ut som knappar.' },
    ],
  },
  {
    version: '3.29.0',
    date: '2026-10-06',
    title: 'Leads (Webb): befintliga avtalskunder',
    items: [
      { kind: 'nyhet', text: 'En förfrågan från en befintlig avtalskund visar en ruta med kunden, avtalets slutdatum och hur den känns igen (org.nr, e-postdomän eller telefonnummer), med länk till kunden.' },
      { kind: 'nyhet', text: 'Skapa ärende öppnar då ärendemodalen för avtalskunder med kunden vald, och du väljer extrabesök, stationskontroll eller etablering. Är det fel kund väljer du bort matchningen och skapar ärendet som vanligt.' },
      { kind: 'nyhet', text: 'Koppla befintligt ärende: har ärendet redan skapats på annat sätt söker du fram det på ärendenumret och kopplar det till förfrågan.' },
      { kind: 'nyhet', text: 'Ny status Befintlig kund. Avtalskundernas ärenden räknas inte som vunna eller förlorade, och statistiken visar dem för sig med hur många ärenden som genomförts.' },
      { kind: 'buggfix', text: 'Allmänna e-posttjänster känns igen även med utländsk ändelse, till exempel hotmail.co.uk, och fler svenska leverantörer som Comhem och Tele2, så att de aldrig matchar en kund.' },
    ],
  },
  {
    version: '3.28.0',
    date: '2026-10-06',
    title: 'Bildanalysen: vägen och bilden följer med förfrågan',
    items: [
      { kind: 'nyhet', text: 'En förfrågan från bildanalysen på begone.se visar nu vilken väg sajten har lovat, till exempel fast pris per telefon eller mejl, kostnadsfri inspektion eller råd först, så att ingen erbjuder ett besök i onödan.' },
      { kind: 'nyhet', text: 'Bilden från analysen följer med förfrågan och syns bland bilderna i Leads (Webb).' },
      { kind: 'nyhet', text: 'Analysen känner igen fem arter till: stadsduva, trut eller fiskmås, kaja, skogsmus och brokig pälsänger.' },
      { kind: 'buggfix', text: 'Analysen skiljer husmus från skogsmus på buken: husmusen har ingen skarp gräns mellan rygg och buk.' },
    ],
  },
  {
    version: '3.27.0',
    date: '2026-10-05',
    title: 'Leads (Webb): rätt adress och personnummer eller org.nr',
    items: [
      { kind: 'buggfix', text: 'Adressen i förfrågan, listan, ärendet och offerten skrivs nu utan dubbletter, med kundens egen ort, postnummer som 196 31 och stor bokstav i gata och ort. Ett område som Kungsängen och Bro skrivs inte som ort.' },
      { kind: 'nyhet', text: 'Under Uppgifter efter samtalet i förfrågan fyller du i personnummer eller org.nr och rättar adressen medan du pratar med kunden. Kundens egna svar står kvar.' },
      { kind: 'nyhet', text: 'Numret kontrolleras med kontrollsiffran och personnumret visas dolt tills du klickar på Visa. Uppgifterna följer med till Skapa ärende och Skapa offert.' },
    ],
  },
  {
    version: '3.26.0',
    date: '2026-10-05',
    title: 'Leads (Webb): offert, bokad tjänst och ärendenummer',
    items: [
      { kind: 'nyhet', text: 'Skapa offert i förfrågan öppnar offertguiden med kundens uppgifter ifyllda. När offerten skickats får förfrågan status Offert och en rad i historiken med länk till offerten.' },
      { kind: 'andring', text: 'Status Offert kan inte längre sättas för hand. Den sätts bara när en offert faktiskt skickats från förfrågan.' },
      { kind: 'andring', text: 'En offert kan bara kopplas till förfrågan av den som skapade den, och en offert hör alltid till en enda förfrågan.' },
      { kind: 'nyhet', text: 'När ett ärende skapas från förfrågan sparas ärendenumret och den bokade tjänsten. Båda syns i förfrågan och i listan, och kundens eget val står kvar.' },
      { kind: 'nyhet', text: 'Statistiken visar kundens val mot bokad tjänst, till exempel hur ofta Vet inte blev möss.' },
    ],
  },
  {
    version: '3.25.1',
    date: '2026-10-05',
    title: 'Leads (Webb): rättningar efter granskning',
    items: [
      { kind: 'buggfix', text: 'Escape i ärendemodalen stänger inte längre förfrågan bakom, så att ett påbörjat ärende inte försvinner.' },
      { kind: 'buggfix', text: 'En förfrågan kan bara kopplas till ärendet som skapades från den, inte till ett äldre ärende som redan fakturerats.' },
    ],
  },
  {
    version: '3.25.0',
    date: '2026-10-05',
    title: 'Leads (Webb): från förfrågan till ärende',
    items: [
      { kind: 'nyhet', text: 'Knappen Skapa ärende i en webbförfrågan öppnar ärendemodalen förifylld med kundens namn, telefon, e-post, adress, tjänst, svar och meddelande. Bilderna följer med till ärendet.' },
      { kind: 'nyhet', text: 'Förfrågan får status Bokad när ärendet skapas, och knappen blir Öppna ärendet så att samma förfrågan inte blir två ärenden.' },
      { kind: 'nyhet', text: 'Vunnen och Förlorad sätts automatiskt varje natt: vunnen om ärendet fakturerats inom 30 dagar från bokningen, 90 dagar om en offert skickats. Förlorad och Skräp kan fortfarande sättas för hand på förfrågningar som inte bokats.' },
      { kind: 'nyhet', text: 'Statistiken visar kedjan från förfrågan till bokad och vunnen, och hur många som förlorats efter respektive utan bokning, per tjänst, källa, kundgrupp, vecka, kampanj och sökord.' },
    ],
  },
  {
    version: '3.24.1',
    date: '2026-10-05',
    title: 'Notis om nya webbförfrågningar',
    items: [
      { kind: 'nyhet', text: 'Koordinatorerna får en notis under klockan när en ny förfrågan kommer in från begone.se.' },
      { kind: 'buggfix', text: 'Formulären på den nya sajten kan nu skicka förfrågningar även från testadressen innan begone.se har flyttats.' },
    ],
  },
  {
    version: '3.24.0',
    date: '2026-10-05',
    title: 'Leads (Webb): förfrågningar från begone.se',
    items: [
      { kind: 'andring', text: 'Leads heter nu Leads (B2B) i menyn och på sidan. Inget annat är ändrat.' },
      { kind: 'nyhet', text: 'Leads (Webb) under Försäljning samlar förfrågningarna från formulären på nya begone.se, med bilder, svaren från formuläret och varifrån på sajten de kom. Räknaren i menyn visar hur många som är nya.' },
      { kind: 'nyhet', text: 'Varje förfrågan har status från Ny till Vunnen, Förlorad eller Skräp, kan tilldelas en kollega och får anteckningar med historik. Företag och BRF:er blir en B2B-lead med ett klick, förifylld.' },
      { kind: 'nyhet', text: 'Fliken Statistik visar efterfrågan per vecka, tjänst, kundgrupp och sida, och hur många som fick kontakt samma dag.' },
      { kind: 'buggfix', text: 'Sidan på en förfrågan är nu sidan där formuläret skickades, inte sidan besökaren landade på först.' },
    ],
  },
  {
    version: '3.23.0',
    date: '2026-10-04',
    title: 'Artanalysen på nya begone.se',
    items: [
      { kind: 'nyhet', text: 'Portalen tar emot bildrutor från artanalysen på nya begone.se och föreslår en art bland 24 vanliga skadedjur. Inga bilder sparas, och en besökare kan bara göra ett fåtal analyser per dygn. Analysen har inga nummer och syns inte bland ärendena.' },
    ],
  },
  {
    version: '3.22.0',
    date: '2026-10-02',
    title: 'Tydligare stationskarta',
    items: [
      { kind: 'buggfix', text: 'Utrustningskartan visar nu alla utomhusstationer. Tidigare stannade den vid 1 000, så 154 stationer syntes inte på kartan och räknades inte i siffrorna.' },
      { kind: 'andring', text: 'Kartan under Utrustning fyller hela höjden. Teckenförklaringen ligger inte längre över kartan utan i listan till vänster, där varje stationstyp visas med samma markör som på kartan.' },
      { kind: 'nyhet', text: 'Så läser du kartan: en förklaring av färg, ikon, plusbricka, nummerbricka och kantfärgerna för status. Finns under filtren och vid utplacering.' },
      { kind: 'nyhet', text: 'Markörerna i personalens kartor visar produktens eller stationstypens ikon, och grupperna har en ring i typernas färger. Kartan går att filtrera på Saknas, Skadade och Bara tillägg.' },
      { kind: 'nyhet', text: 'Vid utplacering visas den nya stationen som den kommer att se ut, och GPS-positionen får en cirkel och en text som till exempel GPS ± 6 m. Över 15 m visas en uppmaning att dra nålen till rätt plats.' },
      { kind: 'nyhet', text: 'Kunderna får samma tydliga karta under Fällor & stationer, i både kundportalen och organisationsportalen: stationstypens ikon i markören, numret under, typerna som knappar ovanför kartan och Så läser du kartan. Kunderna ser aldrig produkternas ikoner.' },
      { kind: 'buggfix', text: 'Numret i kundens stationslista är nu samma som på kartan. Tidigare räknade listan från den nyaste stationen och kartan från den äldsta.' },
      { kind: 'nyhet', text: 'Kontrollrapporten och stationskartan som PDF visar samma markörer som portalen: typens färg och ikon, numret under och status i kanten, med en teckenförklaring under varje karta. Utrustningsrapporten har markören i listorna.' },
      { kind: 'buggfix', text: 'Kontrollrapporten skriver nu ut Tillägg utöver avtal för tilläggsstationer. Uppgiften hämtades aldrig tidigare, så raden var alltid tom.' },
      { kind: 'buggfix', text: 'Stationsnumren är nu desamma i kundportalen, stationskartan och kontrollrapporten. Utomhus numreras för sig och varje planritning börjar om på 1, äldst först. Borttagna stationer får inget nummer. Tidigare visade kundens inomhuslista teknikerns beteckning och PDF:en räknade inomhus vidare efter utomhus.' },
      { kind: 'andring', text: 'Kunderna ser nu produktens ikon i markören när stationen har en produkt med ikon, i portalen och i rapporterna. Texten säger fortfarande stationstypen, till exempel Betesstation, aldrig produktens namn.' },
    ],
  },
  {
    version: '3.21.0',
    date: '2026-10-01',
    title: 'Tilläggsfakturan förklarar sig själv',
    items: [
      { kind: 'nyhet', text: 'Fakturor med tilläggsstationer visar ett block Tillägg utöver avtalet med samma tidslinje som ärendets Ekonomi-flik: vilken period fakturan gäller, hur många dagar av året och uträkningen per station och per timme.' },
      { kind: 'nyhet', text: 'Kostnaderna på tilläggsfakturan visar utrustningen som en engångskostnad, den interna arbetstiden per år och ungefär när tillägget är betalt tillbaka, i stället för en negativ marginal.' },
      { kind: 'andring', text: 'Priskontrollen räknar tilläggsrader mot avtalspriset för just de dagar fakturan gäller. Stämmer det står det Stämmer mot avtalspriset och fakturan larmar inte längre rött.' },
      { kind: 'andring', text: 'Tilläggsraderna har perioden under namnet och arbetstiden faktureras i timmar, till exempel 2 h à 400,82 kr. Kundens faktura i Fortnox får samma period och en rad om när tilläggen faktureras nästa gång.' },
      { kind: 'andring', text: 'Sidokortet på tilläggsfakturan visar period, nästa tilläggsfaktura, avtalet och hur många stationer som väntar på beslut i avtalskartan.' },
      { kind: 'buggfix', text: 'Teknikerns namn hämtas nu alltid från teknikerregistret när en etablering stängs. Tidigare kunde e-postadressen hamna som namn på besöket och raderna, och andrateknikern kom inte med på besöket.' },
      { kind: 'andring', text: 'Blocket Tillägg utöver avtalet på fakturan är hopfällt och visar en sammanfattning på en rad. Tryck på Visa uträkning för tidslinjen och uträkningen per station och timme.' },
      { kind: 'nyhet', text: 'Under Stationer & Fällor har varje stationstyp en sektion Produkter. Där väljer du vilka artiklar teknikern kan välja mellan vid utplacering, vilken som är förval och i vilken ordning de visas.' },
      { kind: 'andring', text: 'En tilläggsstation per år eller per månad som kunden redan har betalat kan inte byta stationstyp, tilläggsläge eller betalning. Formuläret visar vilket datum den är betald till. Produkt, position och övriga fält går att ändra som vanligt.' },
      { kind: 'buggfix', text: 'Byts produkten på en tilläggsstation räknas den interna kostnaden om till den nya produktens inköpspris. Tidigare låg det gamla priset kvar.' },
      { kind: 'andring', text: 'Guiden Tilläggsstationer är uppdelad per roll. Överst väljer du Tekniker, Koordinator, Faktureringsansvarig eller Admin och hamnar direkt i ditt avsnitt, med nya delar om produktval och låsta stationer.' },
      { kind: 'nyhet', text: 'Nya stationsikoner ritade efter produkterna ni använder, till exempel Rat Box, plåtstation på vägg, Chameleon, Aurotrap, A24 och avloppsfälla. Välj under Ikon i Stationer & Fällor: dagens fem knappar finns kvar och Alla ikoner fäller ned hela listan.' },
      { kind: 'nyhet', text: 'En produkt kan få en egen intern ikon med ikonknappen på produktraden. Personalen ser den i alla kartvyer, både utomhuskartan och planritningen, med stationsnumret i en liten bricka under. Kunderna ser allt som förut.' },
      { kind: 'nyhet', text: 'Handbokens guider har en innehållsförteckning även på mobilen och en knapp Innehåll som tar dig tillbaka när du har scrollat ned.' },
    ],
  },
  {
    version: '3.20.0',
    date: '2026-09-30',
    title: 'Varning när en betald tilläggsstation tas bort',
    items: [
      { kind: 'nyhet', text: 'Tar du bort en tilläggsstation som kunden redan har betalat för visas vilket datum den är betald till och med, att kunden inte får något tillbaka och att den inte faktureras från nästa period. Klicka igen för att ta bort den ändå.' },
      { kind: 'nyhet', text: 'Är tilläggsstationen inte fakturerad än står det i stället att den inte räknas med om den tas bort.' },
      { kind: 'andring', text: 'Guiden Tilläggsstationer beskriver varningen vid borttag, har en ny fråga om varför fakturan skapas innan tilläggen är beslutade och en luftigare tabell över vem som gör vad.' },
      { kind: 'buggfix', text: 'Lägg till i avtalet i Besluta tillägg gäller nu från avtalets nästa periodstart som förval, inte från idag. Tiden fram till dess betalas redan på ärendet, så kunden betalar inte samma tid två gånger.' },
      { kind: 'andring', text: 'Guiden Tilläggsstationer skriver ut vad som faktureras när ärendet stängs: tiden fram till avtalets nästa periodstart.' },
      { kind: 'andring', text: 'Kontrollformuläret i kontrollrundan har Flytta och Spara längst ned i full bredd och ett kryss för att stänga uppe till höger, så inget trycks ihop på mobilen. Med Hämta upp ikryssat heter knappen Spara och ta bort.' },
    ],
  },
  {
    version: '3.19.0',
    date: '2026-09-30',
    title: 'Ny guide om tilläggsstationer',
    items: [
      { kind: 'nyhet', text: 'Handboken har en ny guide om tilläggsstationer: vem gör vad, hela kedjan steg för steg med bilder på skärmarna, ett räkneexempel där du kan byta datum och timmar, och svar på vanliga frågor' },
    ],
  },
  {
    version: '3.18.1',
    date: '2026-09-30',
    title: 'Renare Ekonomi-flik för tillägg',
    items: [
      { kind: 'andring', text: 'Tilläggets kalkyl visas inte längre i ärendets Ekonomi-flik. Den finns kvar när tillägget beslutas i avtalskartan och på avtalet' },
    ],
  },
  {
    version: '3.18.0',
    date: '2026-09-30',
    title: 'Ett mail per återkommande schema',
    items: [
      { kind: 'andring', text: 'När ett återkommande schema läggs upp får teknikern ett enda mail med kund, adress, frekvens, dag, klockslag och antal tillfällen, i stället för en lista med varje tillfälle. Samma sak när schemat förlängs eller byter tekniker' },
      { kind: 'andring', text: 'Engångsärenden ger ett mail per ärende, även när flera bokas inom samma minuter' },
    ],
  },
  {
    version: '3.17.2',
    date: '2026-09-30',
    title: 'Återkommande kontroller ger datum igen',
    items: [
      { kind: 'buggfix', text: 'Återkommande kontroller gav 0 tillfällen med Varje vecka och Andra veckans dag. Nu läggs kontrollen på veckodagen i stället, och ett startdatum efter avtalsperiodens slut går inte längre att välja' },
    ],
  },
  {
    version: '3.17.1',
    date: '2026-09-30',
    title: 'Arbetstiden i tilläggets resultat',
    items: [
      {
        kind: 'buggfix',
        text: 'Tilläggets resultat över tid i avtalskartan räknar nu med arbetstiden för att hantera tilläggen - intäkt och intern kostnad per år från beslutet, så hittills, till avtalsslutet och brytpunkten stämmer',
      },
    ],
  },
  {
    version: '3.17.0',
    date: '2026-09-30',
    title: 'Tillägg bredvid avtalet',
    items: [
      { kind: 'nyhet', text: 'Tilläggsstationer i Ekonomi-fliken visar en tidslinje: vad kunden betalar nu för månaderna kvar till avtalets år och vad som gäller sedan, med pris per station på båda sidor' },
      { kind: 'nyhet', text: 'Arbetstid för att hantera tilläggen: teknikern anger timmar per år när nya tillägg sätts ut, priset kommer alltid från kundens timpris i prislistan' },
      { kind: 'nyhet', text: 'Besluta tillägg i avtalskartan visar vad teknikern satte ut, arbetstiden, tilläggets kalkyl och när det är betalt tillbaka. Välj Tillägg utöver avtalet eller Lägg till i avtalet' },
      { kind: 'andring', text: 'Tillägg faktureras alltid på en egen faktura i samband med årsfakturan, en rad per stationstyp, och slutar när avtalet slutar' },
      { kind: 'buggfix', text: 'Ärendets marginal räknas bara på ärendets egna rader, tilläggens utrustning drar inte längre ned den' },
    ],
  },
  {
    version: '3.16.0',
    date: '2026-09-29',
    title: 'Kontrollrapporten direkt i ärendet',
    items: [
      { kind: 'nyhet', text: 'Avslutade stationskontroller visar kontrollrapporten under Utförande i ärendet. Den laddas ned som PDF eller Excel och kan mejlas till kunden därifrån, utan att logga in som kunden' },
      { kind: 'buggfix', text: 'Sökfältet i schemat hittar nu även avtalsärenden, som stationskontroller och avtalsbesök, på ärendenummer, kundnamn eller kontaktperson' },
    ],
  },
  {
    version: '3.15.0',
    date: '2026-09-29',
    title: 'Enheter hanteras på kundkortet',
    items: [
      { kind: 'nyhet', text: 'Enheter läggs till, redigeras och avaktiveras direkt på kundkortets Enheter-flik. Användarkonton kund visar enheterna med en länk dit' },
      { kind: 'nyhet', text: 'Kundnumret hämtas från Fortnox på org.nr när en enhet eller ny kund läggs upp. Finns kunden inte i Fortnox skapas den där med nästa lediga nummer i kundgruppen, i stället för att numret skrivs in för hand' },
      { kind: 'andring', text: 'Enheter som är egna bolag visar sin Fortnox-status i kundlistan, och räknas med under Saknar Fortnox-nr när numret saknas' },
      { kind: 'andring', text: 'Indexera alla på avtalskartan tar med enhetsavtalen, kan lägga steget vid varje avtals nästa periodstart, räknar på premien som gäller vid datumet och hoppar över avtal som redan är indexerade' },
      { kind: 'andring', text: 'Enheternas kundnummer står i samma kolumn som huvudkontorets i kundlistan' },
      { kind: 'buggfix', text: 'Nya Fortnox-kundkort får bolagets juridiska namn, inte enhetsnamnet' },
    ],
  },
  {
    version: '3.14.5',
    date: '2026-09-27',
    title: 'Sökhistoriken hämtas in av sig själv',
    items: [
      { kind: 'andring', text: 'Historiken från Google Search Console hämtas nu in automatiskt i omgångar tills den är komplett, utan att någon behöver starta hämtningen' },
    ],
  },
  {
    version: '3.14.4',
    date: '2026-09-26',
    title: 'Sökdata från Google hämtas varje natt',
    items: [
      { kind: 'nyhet', text: 'Klick, visningar och placering i Googles sökresultat för begone.se hämtas automatiskt varje natt, per sida och per sökfråga, med historik 16 månader bakåt' },
    ],
  },
  {
    version: '3.14.3',
    date: '2026-09-26',
    title: 'Google-omdömen hämtas varje natt',
    items: [
      { kind: 'nyhet', text: 'Begones betyg och senaste omdömen på Google hämtas automatiskt varje natt, så att nya begone.se alltid kan visa aktuella omdömen' },
    ],
  },
  {
    version: '3.14.2',
    date: '2026-09-25',
    title: 'Teknikern syns på fakturan och Återställ skapar inga dubbletter',
    items: [
      { kind: 'buggfix', text: 'Ärenden där teknikern valdes för hand i Nytt ärende sparades utan teknikerns namn, så fakturan visade inte vem som utfört arbetet. Namnet sparas nu alltid, och de ärenden som saknade det är ifyllda' },
      { kind: 'buggfix', text: 'Återställ på en makulerad faktura som redan finns i Fortnox ger den tillbaka sin Fortnox-status och sitt nummer, i stället för att skapa ett nytt utkast med nytt nummer' },
    ],
  },
  {
    version: '3.14.1',
    date: '2026-09-25',
    title: 'Inkommen e-post syns på upphandlingen',
    items: [
      {
        kind: 'nyhet',
        text: 'Under Utfall och handlingar på varje upphandling listas nu inkommen e-post med avsändare, bilagor, AI:ns sammanfattning och brödtext. Ett felkopplat mejl flyttas till rätt upphandling eller till Osorterat, och bilagor och utlästa anbudsgivare följer med.',
      },
    ],
  },
  {
    version: '3.14.0',
    date: '2026-09-25',
    title: 'Upphandlingsbevakning på egen adress, säkrare avtalsklocka och anbudsstöd',
    items: [
      { kind: 'nyhet', text: 'Upphandlingsbevakningen har en egen adress, upphandling.begone.se, med egen inloggning och bara upphandlingarna. Menyposten Upphandlingar öppnar den i en ny flik' },
      { kind: 'andring', text: 'Avtalsklockan räknar slutdatum från avtalets start och avtalstid när den finns, visar hur datumet räknats och skriver "annons väntas nu" i stället för att lägga gamla avtal i ett passerat kvartal' },
      { kind: 'andring', text: 'Köpare som redan annonserat eller tilldelat en ny upphandling tas ur fönstret och visas med länk till den nya annonsen. Felträffar som lokalvård och hissar är bortfiltrerade och kan granskas längst ned i avtalsklockan' },
      { kind: 'nyhet', text: 'Under fliken Fråga kan du ställa frågor om marknaden i vanlig svenska och få svar med länkar till upphandlingarna' },
      { kind: 'nyhet', text: 'I anbudsverkstaden skriver knappen Skriv utkast ett förslag på svar per kvalitetskriterium ur vårt eget material. Bra svar sparas i anbudsbiblioteket och kan användas igen. Lärdomar från vunna och förlorade anbud visas under Marknad' },
    ],
  },
  {
    version: '3.13.0',
    date: '2026-09-24',
    title: 'Upphandlingar: bevakning, marknad och anbudskalkyl',
    items: [
      { kind: 'nyhet', text: 'Upphandlingar under Försäljning samlar alla offentliga upphandlingar inom skadedjur i Sverige från Mercell och TED, med poäng för hur väl de passar oss, sista anbudsdag och länk till annonsen' },
      { kind: 'nyhet', text: 'Varje upphandling har en egen sida med köparens historik, konkurrenterna, anbudskalkyl mot vår marginalmotor (golvpris, målpris och förväntat täckningsbidrag) och en anbudsverkstad med kravlista, prisbilaga och frågor till köparen' },
      { kind: 'nyhet', text: 'Ladda upp förfrågningsunderlaget så läser AI:n ut volymer, kriterier med vikter, skallkrav och vad som avgör affären. Handlingar efter tilldelning kan begäras ut direkt från sidan' },
      { kind: 'nyhet', text: 'Under Användarkonton (Personal) finns reglaget Upphandlingsansvarig. Den som slås på får åtkomst, notiser vid nya träffar och ett dagligt sammandrag på vardagsmorgnar' },
    ],
  },
  {
    version: '3.12.0',
    date: '2026-09-24',
    title: 'Tilläggsstationer med plustecken, stationer som står tätt sprids ut',
    items: [
      { kind: 'andring', text: 'Tilläggsstationer visas med ett litet plustecken i markörens kant i stället för en violett ring, både på kartan och på planritningen. Plustecknet syns även när stationen är kontrollerad eller markerad' },
      { kind: 'nyhet', text: 'Stationer som står så tätt att de täcker varandra sprids ut i en liten ring med en tunn linje till pricken där stationen faktiskt står. Alla går att trycka på, och linjerna försvinner när man zoomat in så att de får plats' },
      { kind: 'andring', text: 'Kartans förklaring ritar symbolerna som markörerna ser ut och förklarar linjen när någon grupp är utspridd' },
    ],
  },
  {
    version: '3.11.1',
    date: '2026-09-24',
    title: 'Tilläggsstationer på kartan och kundkortet',
    items: [
      { kind: 'buggfix', text: 'Kartans förklaring säger nu vad den violetta ringen betyder: stationen är ett tillägg utöver avtalet' },
      { kind: 'buggfix', text: 'Kundkortets utrustning visar vilken tekniker som satte ut stationen, i stället för "Okänd"' },
      { kind: 'buggfix', text: 'Pro rata-raden för tilläggsstationer räknar med rätt årspris per stationstyp, så ljusfällor får sitt eget pris' },
    ],
  },
  {
    version: '3.11.0',
    date: '2026-09-23',
    title: 'Ny version av sig själv',
    items: [
      { kind: 'nyhet', text: 'Portalen märker när en ny version finns, till exempel när appen öppnas igen efter en paus, och visar "Ny version finns" med en knapp för att ladda om' },
      { kind: 'nyhet', text: 'Vid nästa sidbyte hämtas den nya versionen av sig själv, aldrig mitt i ett formulär' },
      { kind: 'andring', text: 'Punkterna under Uppdateringar är märkta Nyhet, Ändring eller Buggfix' },
    ],
  },
  {
    version: '3.10.1',
    date: '2026-09-23',
    title: 'Uppdateringar fungerar på telefonen',
    items: [
      { kind: 'buggfix', text: 'Listan under Uppdateringar går att scrolla och stänga på mobilen, även i appläget' },
    ],
  },
  {
    version: '3.10.0',
    date: '2026-09-23',
    title: 'Portalen som app på mobilen',
    items: [
      { kind: 'nyhet', text: 'Under Mitt konto finns "Använd som app": lägg portalen på hemskärmen och kör den utan adressfält, med egen ikon' },
      { kind: 'nyhet', text: 'Android installerar direkt från knappen, iPhone får en kort guide till Dela-menyn' },
      { kind: 'nyhet', text: 'Ny version hämtas av sig själv vid nästa start - inga omladdningar mitt i arbetet' },
    ],
  },
  {
    version: '3.9.0',
    date: '2026-09-23',
    title: 'Tydligare kartor vid utplacering',
    items: [
      { kind: 'nyhet', text: 'Andra kunders stationer visas nedtonade på kartan när du placerar ut, så de inte blandas ihop med kundens egna' },
      { kind: 'nyhet', text: 'Knappen "Dölj andra kunder" på kartan stänger av dem helt - valet kommer ihåg sig' },
      { kind: 'nyhet', text: 'Fliken Karta följer den kund du håller på med och visar grannarna inom 500 meter nedtonade' },
      { kind: 'andring', text: 'Kundfiltret på fliken Karta är en kundväljare i stället för kryssrutor' },
    ],
  },
  {
    version: '3.8.0',
    date: '2026-09-21',
    title: 'Signerade avtal aktiveras själva',
    items: [
      'Ett avtal som signeras i Oneflow blir aktivt av sig självt och kundraden följer det riktiga avtalet',
      'Kundkortets tidslinje visar när kommande fakturor skapas och skickas',
      'Fortnox-verifieringen stämplas automatiskt ur kundspegeln',
      'Avtalskartan går ner i lugnt läge när fakturorna redan är planerade',
    ],
  },
  {
    version: '3.7.0',
    date: '2026-09-18',
    title: 'Fakturaplan och utrustning',
    items: [
      'Avtal som förlängs får rullande slutdatum och planeras förbi det gamla slutdatumet',
      'En passerad period kan registreras som fakturerad utanför portalen',
      'Kvar att betala hämtas från Fortnox, delbetalda fakturor får egen status',
      'Faktureringsansvariga får en notis när ett avtal signeras',
      'Utrustningssidan visar kundens alla stationer, med växeln Alla/Mina',
    ],
  },
  {
    version: '3.6.0',
    date: '2026-09-17',
    title: 'Fakturafliken på kundkortet',
    items: [
      'Fakturafliken delar upp årspremie, merförsäljning och avtal, och visar kommande fakturor',
      'Avtalskartan har fakturaplanen som eget steg och en markör i kundlistan',
      'Enhetskoden är fakturamärkningen och kontakten följer enheten',
      'Tilläggsstationer utan avtal syns som brickor att besluta',
    ],
  },
  {
    version: '3.5.0',
    date: '2026-09-15',
    title: 'Stationskarta som PDF',
    items: [
      'Kunden kan ladda ned stationskarta och stationsöversikt som PDF från kundportalen',
    ],
  },
  {
    version: '3.4.0',
    date: '2026-09-09',
    title: 'Avtalet har en källa för premien',
    items: [
      'Avtalstypen bär premien, § 4 visar andelar och trappan styr kolumnerna',
      'Kontrollschemat kommer ur § 3 och nästa faktura står på pappret',
      'Ramavtalet skrivs en gång och enheterna står i en bilaga',
      'Ekonomin har fått en egen läsyta med strukturerad historik och hopfällbara paragrafer',
    ],
  },
  {
    version: '3.3.0',
    date: '2026-09-08',
    title: 'Avtalskartan i tre lager',
    items: [
      'Pappret läser, panelen styr och pulsen visar hur avtalet mår',
      'Ronden visas som en svärm på ärendefliken - en rad per enhet på gemensam tidsaxel',
      'Obeslutade tilläggsstationer letar upp faktureringsansvarig och kan beslutas samlat per avtal',
    ],
  },
  {
    version: '3.2.0',
    date: '2026-09-05',
    title: 'Stationstyper med produkt och pris',
    items: [
      'Varje stationstyp har produkt och pris, tilläggsstationer faktureras i tre lägen',
      'Kundens prislista styrs av avtalskartan',
      'Varaktig utrustning bokförs som engångskostnad och all marginal räknas i en motor',
      'Tekniker kan avsluta ärenden med faktura och kunder ser inga inköpspriser',
    ],
  },
  {
    version: '3.1.0',
    date: '2026-09-03',
    title: 'Tilläggsstationer och kundpriser',
    items: [
      'Tilläggsstationer kan betalas på tre sätt och teknikern väljer vid utsättningen',
      'Avtalade kundpriser på artiklar följer med till fakturan med låst tjänst och specifikation',
      'Engångskunder får kundnummer från Fortnox via en spegel som synkas var tionde minut',
      'Privatpersoner får priser inklusive moms på fakturautkasten',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-09-02',
    title: 'Avtalskartans motor',
    items: [
      'Avtalsbladet har fått § 7 Premie, § 8 Referenser och § 9 Löptid, och avtalet är källan till årspremiefakturan',
      'Besök per enhet, optioner och bevakning planeras ur avtalet',
      'Ingår i avtalet, katalog, arkiv och ångra på avtalskartan',
      'Fakturering kan pausas per avtal och kundkortsavtal nollas när kunden fått ett riktigt avtal',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-09-01',
    title: 'Kundansvarig och prislistor',
    items: [
      'Kundansvarig sätts på avtalet i Avtalskartan och följer avtalets omfattning',
      'Prislista, avtalstyp och säljare från avtalet speglas till kundens inställningar',
      'Artikelväljaren visar alla artiklar och kan lägga till en hel kategori i taget',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-08-31',
    title: 'Tilläggsstationer',
    items: [
      'Stationer utöver avtalet kan placeras, märkas och faktureras - både etablering och per kontrollrunda',
      'Preparat kommer ihåg sig per station till nästa kontroll och arbetsrapporten fylls i automatiskt',
      'Etableringsärenden går inte längre att avsluta utan placerade stationer',
      'Enhetens egna uppgifter visas i ärendemodalen med val av rätt avtal',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-08-30',
    title: 'Säkrad åtkomst till systemets API:er',
    items: [
      'Alla API-anrop kräver nu inloggning och rätt behörighet',
      'Kunder och enheter kan bara nå sina egna uppgifter',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-08-28',
    title: 'Besök och provisioner',
    items: [
      'Besöket är nu en egen post - flera tekniker kan dela på samma ärende med provision per besök',
      'Provisionen frigörs i takt med att kunden betalar fakturan',
      'Kunden anger adress, märkning och enhet direkt i serviceanmälan',
      'Kundkortet visar inloggningsrytm, täckning och kontohistorik',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-08-26',
    title: 'Fakturering 2.0 och Provisioner 2.0',
    items: [
      'Faktureringen har fått arbetskö, färgsatt status och egen arkivvy',
      'Faktureringsansvarig kvitterar innan fakturan kan skickas till Fortnox',
      'Rabatt och provision visas i godkännandet, betalvillkor räknas från sändningen',
      'Provisioner samlas till en utbetalning per tekniker och månad',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-25',
    title: 'Fakturamodal och ärendehistorik',
    items: [
      'Fakturamodalen visar prisavstämning, besökstidslinje och hela fakturakedjan',
      'Ärendehistoriken ger en ny tekniker full besökskontext med fakturor och betalstatus',
      'Avtalskunder utan rumsnummer får en vaktrondsvy i stället för rumsdesignen',
      'Ärenden kan öppnas direkt i schemat från kundkortet',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-24',
    title: 'Rumsanalys',
    items: [
      'Nytt fält Rum nr för kunder med boendeverksamhet',
      'Kundkortet visar statistik per rum och pekar ut problemrum efter frekvens och riktning',
      'Grundorsaksbokning förifyller tjänsten och föreslår rätt tekniker',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-21',
    title: 'Intäktsmodell och säljare',
    items: [
      'En gemensam intäktsmodell för portalen och historiken - inga dubbelräknade ärenden',
      'Avtalspremien tillhör säljaren och ärendet teknikern',
      'Säljare kan sättas direkt på avtalskartan',
      'Svenskt datumformat i hela portalen',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-20',
    title: 'Avtalskartan',
    items: [
      'Avtal visas som dokument med drag och släpp för vilka enheter som omfattas',
      'Tjänster, interna kostnader och marginal syns direkt på avtalet',
      'Avtal kan sägas upp, avslutade avtal ligger kvar synliga',
      'Kontrollbesök och scheman kopplas till rätt avtal',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-19',
    title: 'Ny kundvy och utrustningssida',
    items: [
      'Kundsidan har byggts om med avtalskort, tidslinje och faktureringskedja',
      'Ny listvy med grupper och snabbpanel utan paginering',
      'Egen flik för Åtkomst och konton per kund',
      'Utrustningssidan har fått tabbar för Kunder, Karta och Kontroller med sökbara kundrader',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-18',
    title: 'Dokumentsignering',
    items: [
      'Master-detail-arbetsyta med prioriterad kö för avtal och offerter',
      'Statistikvy med djupanalys och jämförelse mellan tekniker',
      'Konversationen synkar från Oneflow och ursprungsärendet länkas i panelen',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-17',
    title: 'Rapporter enligt dokumentstandarden',
    items: [
      'Saneringsrapporten och ärenderapporten följer företagets dokumentstandard',
      'Ärendets bilder följer med i saneringsrapporten',
      'Schemat visar beläggning uppdelad på engångskunder och avtalskunder',
      'Tekniker kan bytas och fördelas på scheman med kontroll mot krockar',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-12',
    title: 'Avtalstillägg och rabattgodkännande',
    items: [
      'Tekniker kan lägga till en tjänst i avtalet från fältet - pro rata nu, höjd årspremie sedan',
      'Rabatter kräver motivering och godkännande av ansvarig',
      'Ärendemodalerna har designats om för avtal, privat och företag',
      'Avtalshistoriken visas som tidslinje på kundkortet',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-11',
    title: 'Intranät och handbok',
    items: [
      'Nytt intranät med start, anslag, kontakter, KMA och handbok',
      'Policys kräver läskvittens och visar vem som kvitterat vilken version',
      'Interaktiva guider för prissättning, fakturering, ärendetyper och schema',
      'Mitt konto för profil och byte av lösenord i alla rollvyer',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-10',
    title: 'Ljust läge och incidentflöde',
    items: [
      'Ljust läge finns i hela systemet och väljs per användare',
      'Portalroller kan kombineras fritt med växlare mellan vyerna',
      'ISO-utredningsflöde för incidenter med grundorsak, åtgärd och uppföljning',
      'Mottagare för tillbud och olyckor ställs in direkt på personkorten',
    ],
  },
]

/** Senaste versionen - används för att avgöra om användaren har osedda uppdateringar */
export const LATEST_VERSION = CHANGELOG[0]?.version ?? ''
