# Upphandlingsportalen: ny struktur och design

Status: förslag 2026-10-15, steg 1 (granskning, informationsarkitektur, designspec och klickbar skiss). Ingen kod i src/ eller api/ är ändrad. Skissen ligger som fristående HTML (upphandling-skiss.html) och visar startsida, framförhållning, annonser, anbudstavla, detaljsida, avtalsklocka och köparprofil.

Underlag: koden i src/pages/procurement/, src/pages/admin/procurement/ och src/components/admin/procurement/ samt docs/upphandlingsportal-plan.md. Appen gick inte att granska inloggad (portalen kräver ett konto med admin eller is_procurement_manager), så diagnosen bygger på koden.

## 1. Diagnos: varför det känns grötigt

1. **Åtta flikar på samma nivå utan ordning.** PROCUREMENT_TABS i src/pages/procurement/procurementTabs.ts lägger Marknad, Bevakning, Avtalsklocka, Signaler, Köpare, Konkurrenter, Fråga och Inställningar i en rad. Arbetsflöden (Bevakning), framförhållning (Avtalsklocka, Signaler), uppslagsverk (Köpare, Konkurrenter), verktyg (Fråga) och administration (Inställningar) väger lika. Ordningen följer inte jobbet: framförhållningen, som är kärnan, ligger på plats tre och fyra.
2. **Startsidan är ett analysverktyg, inte en arbetsyta.** MarketPage.tsx är startsidan och visar marknadsstorlek, marknadsandel, anbudsfördelning, pipeline per kvartal, utmanarläge, kvalitetsviktade köpare, lärdomar och källhälsa: åtta sektioner med statistik. Det som kräver handling i dag (deadline om tre dagar, nya träffar, avtal som just gått in i bearbetningsfönstret, obesvarade frågor) syns inte förrän man klickat sig vidare. Utmanarläget är dessutom en handlingslista som gömmer sig bland diagrammen.
3. **Detaljsidan är en lång rad av elva block utan arbetsordning.** NoticeDetailPage.tsx renderar Identitet, Källor, Tidslinje, Affären, Utvärdering, Kalkyl, Verkstad (numrerad 6b), Köparhistorik, Konkurrens, Utfall och Hantering under varandra med ankarlänkar. Beslutet som styr allt annat, status och ansvarig, ligger i block 10 längst ned (ManagementBlock.tsx). Inkommen e-post ligger gömd i Utfall (OutcomeBlock.tsx rad 107), och "Vårt anbud" (lämnat pris) ligger också där i stället för vid anbudet.
4. **Dubbletter mellan vyer.** Signalkällor finns både under Signaler och Inställningar (SignalSourcesSection i SignalsPage.tsx och SettingsPage.tsx). Källhälsa finns på Marknad och i Inställningar. Pipeline per kvartal (Marknad) och Förväntade annonser per kvartal (Avtalsklocka) är två varianter av samma prognos. Krav i underlaget visas i Affären (DealBlock.tsx) och igen i kravlistan i verkstaden (RequirementsList.tsx). Köparhistorik och Konkurrens på detaljsidan upprepar köparprofilen.
5. **Ingen synlig väg från ny träff till inlämnat anbud.** Bevakning (WatchPage.tsx) är en enda tabell där nya träffar, upphandlingar vi räknar på och lämnade anbud blandas och skiljs åt med en statusrullista. Det finns ingen inkorg att sortera (ta upp eller avstå) och ingen tavla som visar vad som pågår. Status sätts längst ned på detaljsidan.
6. **Tre statusspråk som krockar.** Upphandlingar har Ny, Bevakas, Analyseras, Anbud pågår, Anbud lämnat ... (OUR_STATUS_LABEL i src/types/procurement.ts). Avtalsklockan har Öppen, Kontaktad, Planerad, Klar, Ignorerad (AWARD_STATUS_LABEL i market/marketStats.ts). Signaler har Ny, Bevakas, Blev upphandling, Avfärdad (SignalsPage.tsx). "Ny" och "Bevakas" betyder olika saker på olika sidor, och "Bevakas" krockar med fliken Bevakning. Bevakas och Analyseras är svåra att skilja åt.
7. **Verktyg på fel ställe.** Anbudsbiblioteket (AnswerLibrary) ligger i Inställningar fast det är ett arbetsverktyg för anbud. Lärdomar vunnet mot förlorat ligger på Marknad. Felträffar i avtalsklockan ligger längst ned på samma sida som avtalen.
8. **Tät, likformig yta.** Varje vy börjar med en PulseRow med fem tal och följs av sektioner i samma ram (Section i ui.tsx), så allt ser lika viktigt ut. Statusval görs med rullistor direkt i tabellraderna (Signaler, Avtalsklocka), vilket gör raderna tunga. Ikoner kommer från lucide-react och följer inte portalens egen ikonstandard.

## 2. Ny struktur

Utgångspunkten är jobbet i tidsordning: upptäcka tidigt, bevaka annonser, arbeta med anbud, lära av marknaden. Huvudnavigeringen följer samma ordning från vänster till höger.

### Huvudnavigering (fem poster)

| Post | Väg | Jobb | Innehåll |
|---|---|---|---|
| Idag | `/` | Vad kräver handling nu | Deadlines inom 14 dagar, nya annonser att sortera, avtal som gått in i bearbetningsfönstret, mina uppgifter (frågor till köpare, kravrader, inlämningskontroll), nya signaler. Varning om en källa är tyst. |
| Framförhållning | `/avtalsklocka`, `/signaler`, `/prognos` | Upptäcka 12-18 månader före annons | Undertabbar Avtalsklocka, Signaler, Prognos per kvartal. Avtalsklockan ritar varje avtal på en tidslinje med bearbetningsfönster och förlängningsoptioner, har kolumn för kontaktperson och filtret "Bara duopol" som ersätter Utmanarläget på Marknad. |
| Annonser | `/annonser` | Bevaka och sortera nya annonser | Inkorg med nya träffar: Ta upp eller Avstå. Undertabbar Nya, Alla öppna, Under tröskeln, Osorterad e-post. |
| Anbud | `/anbud` | Arbeta fram och lämna anbud | Tavla med kolumnerna Bedöms, Anbud pågår, Lämnat, Avgjort. Undertabbar Tavla, Lista, Anbudsbibliotek. Senare: egna poster för direktupphandling, avrop och offertförfrågan. |
| Marknad | `/marknad`, `/kopare`, `/konkurrenter`, `/fraga` | Lära och prioritera | Undertabbar Översikt, Köpare, Konkurrenter, Lärdomar, Fråga datan. |

I toppraden till höger: sök (öppnar en söklåda över upphandlingar, köpare och konkurrenter), notiser, tema och en kontomeny med Mitt konto, Inställningar och Logga ut. Inställningar lämnar huvudraden.

Varför fem: varje post svarar på en fråga ("vad gör jag nu", "vad kommer", "vad är ute", "vad jobbar vi med", "hur ser marknaden ut"). Köpare och konkurrenter är uppslagsverk som nås från alla vyer genom länkar på namnen; de behöver inte egna platser i huvudraden.

### Sitemap

```
Idag                       /
Framförhållning
  Avtalsklocka             /avtalsklocka
  Signaler                 /signaler
  Prognos                  /prognos
Annonser                   /annonser            (?vy=alla | under | epost)
Anbud
  Tavla                    /anbud
  Lista                    /anbud/lista
  Anbudsbibliotek          /anbud/bibliotek
Upphandling                /upphandling/:id     (/:id/underlag | kalkyl | anbud | utfall | logg)
Marknad
  Översikt                 /marknad
  Köpare                   /kopare  och /kopare/:id
  Konkurrenter             /konkurrenter  och /konkurrenter/:id
  Lärdomar                 /marknad/lardomar
  Fråga datan              /fraga
Kontomeny
  Mitt konto               /mitt-konto
  Inställningar            /installningar       (Bevakningsregler, Signalkällor, Källhälsa, Sammandrag, Ansvariga)
```

Listor för köpare och konkurrenter behåller sina nuvarande adresser. Huvudnavigeringen markerar Marknad när adressen börjar med /kopare, /konkurrenter, /fraga eller /marknad, och Framförhållning för /avtalsklocka, /signaler och /prognos.

### Route-mappning gammal till ny

| Gammal väg | Ny väg | Hur |
|---|---|---|
| `/` (Marknad) | `/marknad` | `/` blir Idag. Ingen omdirigering behövs, men ett tips på Idag första veckan: "Marknaden ligger nu under Marknad". |
| `/bevakning` | `/annonser` eller `/anbud/lista` | Omdirigering till `/annonser`. Notisklockans räknare flyttar till Annonser. |
| `/avtalsklocka` | `/avtalsklocka` | Oförändrad, under Framförhållning. |
| `/signaler` | `/signaler` | Oförändrad, under Framförhållning. Signalkällorna flyttar till Inställningar. |
| `/kopare`, `/kopare/:id` | samma | Oförändrade, under Marknad. |
| `/konkurrenter`, `/konkurrenter/:id` | samma | Oförändrade, under Marknad. |
| `/fraga` | `/fraga` | Oförändrad, under Marknad. |
| `/installningar` | `/installningar` | Oförändrad, nås från kontomenyn. Länken i sammandragsmejlet fortsätter fungera. |
| `/:noticeId` | `/upphandling/:noticeId` | Den gamla vägen ligger kvar för alltid och renderar samma sida (eller ersätter adressen). Matcha bara uuid så att nya ord på roten aldrig tolkas som ett id. |
| `/upphandling/:noticeId` | samma, plus `/:steg` | Finns redan i ProcurementApp.tsx och blir den kanoniska vägen. |
| `/admin/upphandlingar/*` | som i dag | LegacyRedirect behålls. I adminportalen speglas samma struktur under /admin/upphandlingar. |

## 3. Detaljsidan i fem steg

Sidhuvudet bär det som styr allt: titel, köpare (länk), BGU-nummer, status som färgad text med punkt, ansvarig, sista anbudsdag med dagar kvar, och de två primära handlingarna för steget (till exempel "Ta upp" och "Avstå" för en ny träff, "Markera som lämnat" när anbudet är klart). Under sidhuvudet ligger en stegrad med understrukna tabbar. Varje steg visar en liten punkt: grå ej påbörjat, gul pågår, grön klart.

| Steg | Väg | Innehåll | Från dagens block |
|---|---|---|---|
| 1. Översikt | `/upphandling/:id` | Tre frågor: vad (AI-sammanfattning, "det här avgör affären", omfattning), när (tidslinjens datum som en rad: publicerad, frågor senast, sista anbudsdag, tilldelning, avtalsstart), är den värd det (årsvärde, förväntat antal anbud, sannolikhet, förväntat TB). Köparen i korthet (nuvarande leverantör, avtalsslut, median anbud, länk till profilen) och konkurrensen i korthet. Ansvarig och anteckningar. | Identitet (kortad), Tidslinje (datum), Affären (sammanfattning), Köparhistorik och Konkurrens (kortade), Hantering |
| 2. Underlag | `/underlag` | Dokument och uppladdning med AI-läsning, källposter och originalannons, kravlistan (en enda lista, filter Ska-krav, Kvalitet, Pris), utvärderingskriterier och vikter, volymer, frågor till köparen. | Källor och dokument, Affären (volymer, krav), Utvärdering, Frågor till köparen |
| 3. Kalkyl | `/kalkyl` | Kalkylen mot marginalmotorn (golvpris, målpris, vinnande band) och prisbilagan som fylls ur kalkylen. | Vår kalkyl, Prisbilaga |
| 4. Anbud | `/anbud` | Kvalitetssvar med anbudsbiblioteket, inlämningskontroll, lämnat pris och datum, knappen Markera som lämnat. | Kvalitetssvar, Inlämningskontroll, Vårt anbud (från Utfall) |
| 5. Utfall | `/utfall` | Tilldelning, anbudsgivare och priser, begär ut handlingar, lärdom. | Utfall och handlingar |
| Logg | `/logg` | Händelser och inkommen e-post i en tidsföljd, med flytt av e-post. Ligger till höger i stegraden, nedtonad. | Tidslinje (händelser), Inkommen e-post |

Motiv: stegen följer arbetets ordning, och varje steg ryms på en skärm i stället för en sida på elva block. Status och ansvarig flyttar från sista blocket till sidhuvudet. Allt som rör köparen i detalj ligger på köparprofilen och nås med en länk.

## 4. Statusspråk

Ett ord betyder en sak i hela portalen. Databasvärdena behålls; bara etiketterna ändras.

| Område | Etiketter (punktfärg) |
|---|---|
| Upphandling | Ny (blå), Bedöms (gul, ersätter Bevakas och Analyseras), Anbud pågår (grön), Lämnat (grön, mörkare), Vunnen (grön, fet), Förlorad (röd), Avstår (grå), Avbruten (grå), Arkiverad (grå) |
| Avtalsklocka | Ej kontaktad (blå), Kontaktad (gul), Möte bokat (grön, ersätter Planerad), Klar (grå), Ignorerad (grå) |
| Signal | Ny (blå), Följs (gul, ersätter Bevakas), Blev annons (grön), Avfärdad (grå) |
| Fönster | Före fönstret (grå), I fönstret (grön), Sent (gul, under 12 månader kvar), Annons väntas nu (röd) |

## 5. Designspecifikation

### Layout
- Innehåll max 1120 px brett, centrerat, sidmarginal 16 px på mobil och 24 px från 640 px.
- Topprad 56 px: logotyp, huvudnavigering som understrukna tabbar, till höger ikonknappar för sök, notiser, tema och konto (44 × 44 px träffyta).
- Undertabbar under sidrubriken, understrukna, 14 px. Aldrig fler än fem.
- Sidrubrik 20 px halvfet med en rad förklaring i 13 px nedtonad text under.
- Sektioner skiljs med luft (32 px) och en liten versal rubrik (11 px, spärrad 0,12 em), inte med ramar runt allt. Ram används bara för tabeller och tavlans kolumner: 1 px, radie 10 px.
- Inga Card-komponenter och inga skuggor utom på flytande menyer.
- Nyckeltal bara på Idag och Marknad, och då högst fyra i en rad utan ram runt varje tal.

### Typografi
- Portalens systemstack (system-ui, Segoe UI, Roboto, Helvetica, Arial). tabular-nums på alla tal.
- Skala: 11 (etiketter), 12 (metadata), 13 (tabellrader), 14 (brödtext), 16 (rubrik i sektion), 20 (sidrubrik), 28 (stora tal på Idag).
- Vikt 400 och 600. Fet stil bara för olästa rader och siffror som ska läsas först.

### Färger
Tokens som i globals.css (variabelremappning). Ljust och mörkt läge ges samma omsorg.

| Token | Mörkt | Ljust | Användning |
|---|---|---|---|
| bakgrund | #0b1220 | #eef2f6 | sidan |
| yta | #111a2b | #ffffff | tabeller, tavlans kolumner, menyer |
| linje | #1f2a3d | #dfe5ec | ramar och avdelare |
| text | #e6ebf2 | #0f172a | rubriker och värden |
| text-2 | #94a3b8 | #475569 | metadata |
| text-3 | #64748b | #7c8a9d | etiketter |
| brand | #20c58f | #0f9e6f | primärknapp, aktiv tabb, länkar vid hover |
| gul | #f5b740 | #b7791f | pågår, snart |
| röd | #f87171 | #c2410c | deadline inom 3 dagar, förlorad |
| blå | #60a5fa | #2563eb | ny, oläst |

Brandgrönt är accent, inte yta: aktiv tabb, primärknapp, statuspunkt för pågående anbud. Semantiska färger används bara i statuspunkter och för dagar kvar.

### Status
- Status är alltid en liten punkt (6 px) plus text i 12-13 px. Aldrig piller eller bakgrundsfärgade etiketter.
- Dagar kvar visas som "om 3 dagar" i röd text under 4 dagar, gul under 8, annars nedtonad.
- Oläst rad: blå punkt till vänster och halvfet titel.

### Knappar och ikoner
- Primär handling: text plus ikon, fylld brandgrön med vit text (`text-[#fff]` enligt temaregeln), 40 px hög.
- Sekundär handling: text plus ikon, ram i linjefärg.
- Verktyg (exportera, filtrera, flytta, ta bort, öppna original): ikonknapp 44 × 44 px med aria-label och title.
- Ingen emoji och inga tecken som ikoner. Alla ikoner från Icon.tsx.
- Statusbyte görs i en meny från statusens text, inte med en rullista i varje rad.

### Tabeller och tavla
- Rader 13 px, minst 44 px höga, hela raden klickbar till detaljsidan.
- Tavlan: fyra kolumner med räknare och summa årsvärde i kolumnhuvudet. Korten är platta rader med tunn ram: titel, köpare, dagar kvar, årsvärde, ansvarig. Dra mellan kolumner på dator, statusmeny på mobil.
- Excel-export (beslutat tillägg): ikonknapp "Exportera till Excel" i sidhuvudet på varje lista (annonser, anbudslista, avtalsklocka, signaler, köpare, konkurrenter).

### Tomma lägen
- 32 px ikon i nedtonad färg, en mening om vad som saknas och en om vad som fyller listan, till exempel "Inga nya annonser. Synken hämtar nya annonser varje timme." Eventuell handling som sekundärknapp.
- På Idag: "Inget kräver handling i dag" med länk till Framförhållning.

### Mobil
- Huvudnavigeringen blir en fast bottenrad med fem ikoner och korta etiketter (Idag, Framåt, Annonser, Anbud, Marknad), 56 px plus säkerhetsmarginal.
- Tabeller blir listor med två rader per post. Tavlan blir undertabbar per kolumn.
- Detaljsidans stegrad skrollar horisontellt i sin egen behållare, sidan skrollar aldrig i sidled.
- Primärknappen i detaljsidan ligger i en fast rad längst ned på mobil.

### Text
Svenska, inga tankstreck (bindestreck eller omformulering), datum ÅÅÅÅ-MM-DD, komma som decimal, mellanslag som tusentalsavgränsare, belopp som "380 000 kr" eller "1,2 mnkr" i nyckeltal.

## 6. Ikoner: domänen upphandling

Ny fil src/components/icons/set/upphandling.tsx, registrerad i set/index.ts. 24 × 24, streck 1,6 från Icon.tsx, rundade ändar, 2 px marginal, en färg. Ritningarna finns i skissen under Ikoner. Befintliga ikoner återanvänds där de passar: allman.kalkyl, allman.sok, allman.filter, allman.hand (avstå), allman.historik (logg), allman.ladda-ner, kontakt.telefon, kontakt.mejl, rapport.lank (originalannons).

| Namn | Föreställer | Används för |
|---|---|---|
| upphandling.idag | Sol som går upp över en horisontlinje | Idag |
| upphandling.framforhallning | Kikare | Framförhållning |
| upphandling.avtalsklocka | Timglas | Avtalsklocka |
| upphandling.signal | Punkt med två ljudvågor åt varje håll | Signaler |
| upphandling.prognos | Staplar där den sista är streckad | Prognos per kvartal |
| upphandling.annons | Megafon | Annonser |
| upphandling.anbud | Kuvert med ett blad som sticker upp | Anbud |
| upphandling.tavla | Tre kolumner med kort | Anbudstavlan |
| upphandling.ta-upp | Pil in i en kolumn | Ta upp en annons |
| upphandling.underlag | Mapp med blad | Underlag |
| upphandling.krav | Lista med bockrutor | Kravlista |
| upphandling.prisbilaga | Tabell med rader och summarad | Prisbilaga |
| upphandling.kvalitet | Rosett med band | Kvalitetssvar |
| upphandling.inlamning | Pil ned i ett tråg med kant | Inlämningskontroll, Markera som lämnat |
| upphandling.utfall | Pokal | Utfall, Vunnen |
| upphandling.kopare | Rådhus med fronton och pelare | Köpare |
| upphandling.konkurrent | Schackbonde | Konkurrenter |
| upphandling.marknadsandel | Cirkeldiagram med utbruten bit | Marknad |
| upphandling.fraga | Pratbubbla med frågetecken ritat som linje | Fråga datan |
| upphandling.fonster | Kalender med markerat intervall | Bearbetningsfönster, notis vid fönster |
| upphandling.forlangning | Kalender med pil åt höger | Förlängningsoptioner |
| upphandling.kontaktperson | Person med namnbricka | Kontaktperson hos köparen |
| upphandling.direkt | Blad med blixt | Direktupphandling |
| upphandling.avrop | Ram med pil ut | Avrop från ramavtal |
| upphandling.offert | Blad med pratbubbla | Offertförfrågan |
| upphandling.excel | Tabell med pil ned | Exportera till Excel |
| upphandling.notis | Ringklocka | Notiser |

## 7. Byggordning i etapper

Varje etapp är en egen leverans med punkt i uppdateringsloggen och kan pushas för sig.

| Etapp | Innehåll | Beroenden |
|---|---|---|
| 1. Ikoner och ord | upphandling.tsx med ikonerna ovan, byt lucide-ikoner i portalen, nya statusetiketter (avsnitt 4) i types/procurement.ts och marketStats.ts. Inga routes ändras. | Inga |
| 2. Skal och navigering | Fem huvudposter, undertabbar, kontomeny, bottenrad på mobil. Marknad flyttar till /marknad, Inställningar till kontomenyn, signalkällor och källhälsa bara i Inställningar, anbudsbiblioteket till Anbud. Omdirigering /bevakning till /annonser. | Etapp 1 |
| 3. Idag | Ny startsida med handlingslistor. Läser befintliga tabeller (notices, awards, signals, requirements, questions). Källhälsovarning flyttar hit. | Etapp 2 |
| 4. Annonser och Anbud | Inkorgen med Ta upp och Avstå, tavlan med fyra kolumner, listvyn, Excel-export från listorna. | Etapp 2 |
| 5. Detaljsidan i steg | Sidhuvud med status och ansvarig, fem steg plus Logg som undervägar, blocken flyttas utan att logiken ändras. /:id och /upphandling/:id fortsätter fungera. | Etapp 1 |
| 6. Framförhållning | Prognosflik (slår ihop de två kvartalsprognoserna), felträffar i egen vy, statusmeny i stället för rullistor, kontaktperson hos köparen på köparprofilen och i avtalsklockan. | Etapp 2 |
| 7. Beslutade tillägg | Riktiga förlängningsoptioner i avtalsklockan, egna poster för direktupphandling, avrop och offertförfrågan i Anbud, notis när ett avtal går in i bearbetningsfönstret (cron och notifications). | Etapp 4 och 6 |

Etapp 5 kan byggas parallellt med 3 och 4 eftersom den bara rör detaljsidan.

## 8. Risker

### Gamla länkar måste fungera
URL:er till portalen skapas på dessa ställen och ska fortsätta fungera utan ändring:

| Var | Vad | Åtgärd |
|---|---|---|
| api/_lib/procurement.ts `noticeLink()` (rad 838) | `{PROCUREMENT_PORTAL_URL}/{id}` | Behåll vägen `/:id`. Byt gärna till `/upphandling/{id}` för nya mejl, men gamla mejl pekar på `/:id` för alltid. |
| api/_lib/procurement.ts rad 870 | Direktmejl vid hård träff, via noticeLink | Som ovan. |
| api/cron/procurement-deadlines.ts rad 66 | Påminnelse om deadline, via noticeLink | Som ovan. |
| api/cron/procurement-digest.ts rad 75, 83, 102 | Sammandragets länkar till upphandlingar | Som ovan. |
| api/cron/procurement-digest.ts rad 113 | `{PROCUREMENT_PORTAL_URL}/installningar` | Behåll /installningar. |
| api/procurement/notify-manager.ts rad 33 | Startsidan | `/` blir Idag, vilket är rätt landning för en ny ansvarig. |
| api/_lib/procurement.ts `insertNotifications()` | Rader i notifications med case_type 'procurement' och case_id | Klientens tolkning nedan. |
| src/components/communication/NotificationBell.tsx rad 90, NotificationCenter.tsx rad 70, NotificationModal.tsx rad 147 | `procurementPortalUrl('/' + case_id)` | Fungerar så länge `/:id` finns. |
| src/components/procurement/ProcurementNotificationBell.tsx rad 93 | `procurementPath('/' + case_id)` | Som ovan. |
| src/pages/procurement/ProcurementApp.tsx | LegacyRedirect för /admin/upphandlingar/* och vägen upphandling/:noticeId | Behåll båda. |

Den nya catch-all-vägen `/:noticeId` ska bara matcha uuid. Annars kan ett nytt ord på roten som skrivs fel tolkas som ett id och ge "Upphandlingen finns inte".

### Övriga risker
- **Vana.** Två till tre användare har lärt sig dagens flikar. Etapp 2 bör visa en kort rad på Idag om var sakerna flyttat, en vecka.
- **Adminportalens speglade routes.** Sidorna finns också under /admin/upphandlingar (ProcurementLayout.tsx). Flikarna läses från samma lista, så procurementTabs.ts behöver bli en tvånivåstruktur som båda skalen använder.
- **Räknaren i notisklockan.** useProcurementBadge räknar olästa och visas i dag vid Bevakning. Den ska flytta till Annonser och betyda samma sak.
- **Statusetiketter i mejl.** Sammandraget och påminnelserna skriver ut statusord. De nya etiketterna måste in i api/ samtidigt som i klienten, annars syns två språk.
- **Prognosen.** Att slå ihop Marknadens pipeline per kvartal och Avtalsklockans kvartalsprognos kräver att räknereglerna i marketStats.ts (pipelineByQuarter, expectedAnnouncementQuarter) stäms av så att talen inte ändras oväntat.
- **Tavlan och drag.** Drag och släpp mellan kolumner ändrar our_status och loggar en händelse; samma kontroller som updateNotice gör i dag måste gälla.

## Beslut från Christian 2026-10-15 (gäller före allt ovan)

Skiss: https://claude.ai/artifact/2Zm6kPRqJqSMGBRFbgcef9 (version 3). Exempeldatan i skissen är påhittad, bygg mot riktig data.

1. **Hela Sverige som standard.** Inget "BeGones län" som förval någonstans. Områdesval: Hela Sverige, landsdel (Norrland, Svealand, Götaland) eller enskilt län, i Marknad, Avtalsklockan och Annonser. Varje köpare visar sitt län. Avtalsklockan får sökruta och sortering (fönstret öppnar först, avtalsslut, årsvärde, köpare A-Ö, län).
2. **Ordet duopol tas bort.** Filtret heter "Bara två anbudsgivare brukar svara", nyckeltal "Två anbudsgivare, slut inom 18 mån".
3. **Hämta underlaget.** Knapp per upphandling som öppnar rätt dokumentsida hos plattformen (e-Avrop, TendSign, Kommers). Plattform ur document_url, annars länk byggd ur Mercells sourceId/sourceNoticeId (procurement_notice_sources.source_sub). Bredvid en släppyta för zip eller lösa filer: zip packas upp i webbläsaren eller servern, varje fil sparas i bucket procurement-documents och körs genom api/procurement/extract-document.ts fil för fil (gräns 50 MB per fil, hoppa över och rapportera större). Ingen inloggad automatik, inga konton, ingen skrapning av plattformarna.
4. **Prisbilagan i fyra steg.** (a) "Läs in köparens prisbilaga": AI läser köparens Excel/PDF-prisbilaga bland uppladdade dokument och skapar en rad per post (benämning, enhet, mängd), (b) "Föreslå priser": pris per rad ur BeGones prislistor eller kalkylen, kostnad och marginal per rad via marginEngine, (c) justera fritt, (d) export i köparens eget format (skriv priserna i deras fil när den finns, annars nuvarande xlsx). Dagens "Fyll från kalkylen" (en rad "Besök enligt avtalet") ersätts. Aldrig ordet "Fyll ur".
5. **Begär ut handlingar** finns kvar: per tidigare avtal i köparprofilen och i steget Utfall.
6. Leverantörskonton och kontakt med Antirio ingår INTE.
