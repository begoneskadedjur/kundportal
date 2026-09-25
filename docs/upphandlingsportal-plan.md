# Upphandlingsbevakning: plan

Status: utkast 2 den 2026-09-24, väntar på godkännande. Byggs därefter av en delegerad agent.

## 1. Syfte

En egen upphandlingsportal inbyggd i adminportalen men avgränsad som en egen del. Den ska göra BeGone till en upphandlingsmaskin:

1. Snappa upp allt nytt som annonseras i Sverige, över och under tröskelvärdet, inom en timme.
2. Ge all viktig data per upphandling på ett ställe, med länk till originalannonsen.
3. Notifiera upphandlingsansvariga och skicka ett dagligt sammandrag.
4. Ge så mycket framförhållning som går: avtal som löper ut, förhandsannonser och kommunernas upphandlingsplaner.
5. Visa marknaden: vem som upphandlar, vem som vinner, till vilket värde, hur många anbud som brukar komma, och var vi har störst chans.
6. Räkna på anbudet med vår egen marginalmotor: golvpris, målpris och vinnande band.
7. Bygga egen historik på priser och volymer genom att begära ut offentliga handlingar efter varje tilldelning.
8. Använda portalens befintliga AI (Gemini via api/team-chat.ts och embeddings) för dokumentanalys, anbudsstöd och frågor mot datan.

## 2. Vad som är bekräftat om datan

Två Opus-körningar 2026-09-24. Bekräftat betyder hämtat och räknat samma dag.

### Källor

| Källa | Vad den ger | Åtkomst |
|---|---|---|
| Mercell publikt sök-API | Alla fem registrerade svenska annonsdatabaser plus TED, löpande. Titel, köparnamn (inget orgnr), CPV, NUTS, län, sista anbudsdag (94 %), uppskattat värde (77 %), förväntat avtalsslut (65 %), posttyp (annons, RFI, direktupphandling, tilldelning, förhandsannons), kategori UpcomingTenders (381 poster), status inklusive Cancelled | Öppet JSON, ingen nyckel, odokumenterat |
| TED Search API v3, eForms sedan november 2023 | Köparens orgnr (95 %), vinnare med orgnr (84 %), antal anbud (84 %), kriterietyp pris/kvalitet (89 %), avtalsstart och slut (65 till 68 %), antal förlängningar (55 %), uppskattat värde (92 %), lägsta och högsta anbud (18 %), länk till plattformen (100 % på annonser), anbudsöppning (65 %) | Öppet, fri licens |
| TED äldre XML 2016 till 2023 | Antal anbud (73 %), vinnare med orgnr (98 %), totalvärde (71 %), pris som enda kriterium (80 %) | Öppet, kräver XML-tolk |
| Upphandlingsmyndigheten, sex dataset 2021 till 2025 | Upphandlingar (förfarande, typ, annonsdatabas, överprövad, direktivstyrd, köparens orgnr), kontrakterade anbud med leverantörer och orgnr, kontrakterat värde, antal anbud, antal anbud med leverantörer inklusive förlorare (bara 2024), uppskattat värde | Öppet JSON, CSV och Excel, årsvis |
| Kommers Supplier Hub | Kommers egna annonser, serverrenderad HTML | Öppet, robots tillåter |
| e-Avrop | Söker även i bilagor | robots.txt förbjuder hämtning |
| Kommunernas upphandlingsplaner | Ostrukturerade sidor och PDF:er | Öppet, per kommun |

### Marknaden för skadedjursbekämpning (CPV 9092)

| Mått | Värde |
|---|---|
| Annonserade upphandlingar per år | 16 till 28, cirka 25 de senaste åren |
| Andel i BeGones län | cirka 39 procent |
| Uppskattat värde 2025 | 203 Mkr på 27 upphandlingar |
| Kontrakterat värde 2021 till 2024 | 377 Mkr, medianupphandling 3,5 Mkr |
| Anticimex andel av kontrakterat värde | cirka 77 procent |
| Nomor andel | cirka 19 procent |
| Antal anbud per upphandling | median 2 (2021 till 2025), median 3 i TED 2026, aldrig fler än 3 i UHM |
| Anticimex och Nomor möttes | 20 av 22 upphandlingar 2024 |
| Överprövade | 15 procent, 2023 hela 25 procent |
| Uppskattat mot kontrakterat värde | medianen 1,00, 56 procent exakt lika |

Slutsatser som styr bygget:
- Kontrakterat värde i öppna källor är ramtak, inte vinnande pris. Verkliga priser finns bara i 18 procent av TED-tilldelningarna.
- Pris per lägenhet, objekt eller station går inte att räkna ur öppen data. Det kräver egen insamling av handlingar.
- Kriterievikter i TED är oanvändbara. Vikter och prismodell läses ur förfrågningsunderlaget med AI.
- Förhandsannonser är nästan obefintliga (5 på tio år). Framförhållningen bärs av avtalsklockan och upphandlingsplanerna.
- Marknaden är ett duopol med två anbud per upphandling. Ett tredje anbud har ofta stor chans.
- BeGone finns i TED under två stavningar. Leverantörer matchas alltid på orgnr.

## 3. Framförhållning

Fyra signaler i fallande tillförlitlighet:

1. **Avtalsklockan.** Varje känd tilldelning får ett beräknat slutdatum. Ordning: TED contract-duration-end-date plus antal förlängningar, annars Mercell contractExpiryDate, annars antagandet två plus två år. Bearbetningsfönstret sätts till 12 till 18 månader före beräknat slut. Användare kan rätta per rad.
2. **Planerade poster i annonsdatabaserna.** Mercells kategori UpcomingTenders, posttyperna RequestForInformation och PriorInformation, samt Kommers planerade upphandlingar. Hämtas i samma flöde som annonserna.
3. **Signalkällor.** Kurerad lista med webbadresser till kommuners, regioners och bostadsbolags upphandlingsplaner. Dagligt jobb hämtar, jämför med förra hämtningen och låter AI plocka ut rader om skadedjur, sanering och fastighetsservice med kvartal. Listan börjar med köpare i BeGones län.
4. **Förhandsannonser på TED.** Hämtas men väntas ge få träffar.

## 4. Verktyg och insikter

Rangordnade efter ekonomisk nytta. Etapp anger när de byggs.

| # | Verktyg | Vad det ger | Data | Etapp |
|---|---|---|---|---|
| 1 | Anbudskalkyl med marginalgolv | Kostnad per år, golvpris vid minmarginal, målpris vid målmarginal, vinnande band mot kända anbud, förväntat täckningsbidrag vid olika priser | marginEngine i src/shared/marginEngine.ts (min_margin_percent, target_margin_percent, arbetstidsspärr 0,5 h per besök), prislistor, volymer ur underlaget | 1 |
| 2 | Köparprofil | Förfarande, ramavtal eller kontrakt, kriterietyp, antal anbud de brukar få, nuvarande och tidigare leverantör, avtalsdatum, byter de leverantör, överprövningar, uppskattat mot utfall, kundkoppling | UHM, TED, Mercell, customers | 1 till 2 |
| 3 | Avtalsklocka med verkliga datum | Förväntad annons per köpare och kvartal | TED slutdatum och förlängningar, Mercell contractExpiryDate, antagande som reserv | 2 |
| 4 | Konkurrentprofil | Per konkurrent: vinster, lämnade anbud (2024), vinstfrekvens, köpare, län, möten mot andra och utfall, kända prisnivåer | UHM, TED | 2 |
| 5 | Pipeline och förväntat värde | Summan av förväntat täckningsbidrag i bevakningen och avtalsklockan per kvartal. Årsvärde = uppskattat värde delat med avtalstid. Sannolikhet = 1 delat med förväntat antal anbud, justerat för kriterietyp och egen historik | Mercell, TED, verktyg 1 | 1 grovt, 2 bättre |
| 6 | Deadline-disciplin | Sista anbudsdag, anbudsöppning, frågor senast (manuellt eller AI ur underlaget), tilldelningsbeslut, avtalsspärr tio dagar, överprövningsfönster. Påminnelser sju och tre dagar före | TED, Mercell, egen | 1 |
| 7 | Handlingsinsamling | Per avslutad upphandling i våra län: begäran om tilldelningsbeslut, anbudsöppningsprotokoll, utvärderingsrapport och vinnande prisbilaga. Status, uppladdning, AI-extraktion av priser och volymer | Offentliga handlingar, egen | 1 som rutin |
| 8 | Utmanarläge | Köpare där bara Anticimex och Nomor lämnade anbud senast och avtalet löper ut inom 18 månader | UHM 2024, TED | 2 |
| 9 | Kvalitetsviktade köpare | Köpare som utvärderar på pris plus kvalitet, där rapportering, egenkontroll och stationskartor väger | TED kriterietyp | 1 |
| 10 | Marknadsandel per län och trend | Andel av avtalat tak per leverantör, år och län | UHM, TED, länkodning via orgnr | 2 |
| 11 | Prisbenchmark per enhet | Pris per lägenhet, objekt eller besök per region och år | Bara verktyg 7 och egna anbud | Kräver egen historik |
| 12 | Lärdomar vunnet mot förlorat | Kriterietyp, antal anbud, köpartyp, prisavstånd till vinnaren | Egna anbud och utvärderingsprotokoll, minst 10 till 15 egna utfall | Kräver egen historik |
| 13 | Överprövningsrisk | Köpare och upphandlingar som ofta överprövas | UHM, TED | 2 |
| 14 | Fråga datan | Frågor i naturligt språk mot upphandlingsdatan via befintlig AI-assistent | Embeddings på procurement_-tabellerna | 3 |

Strukna: statistisk vinstmodell (för lite data, basfrekvens räcker), andel där lägsta pris vann (priser saknas), benchmark ur öppen data (volymer saknas).

## 5. AI i portalen

Befintlig AI: Gemini via api/team-chat.ts och api/ai-*.ts, embeddings via api/embeddings.ts och cron sync-embeddings. Portalen använder samma uppsättning genom nya endpoints under api/procurement/.

| Användning | Indata | Utdata | Etapp |
|---|---|---|---|
| Underlagsextraktion | Uppladdat förfrågningsunderlag och bilagor | Volymer (lägenheter, objekt, besök per år), kriterier med vikter, prismodell (à-pris, fast pris, fiktiv kalkyl), frågor senast, avtalstid och optioner, krav som certifiering, inställelsetid, viten, referenser. Sparas som strukturerade fält med källsida | 1 |
| Sammanfattning | Samma | Kort sammanfattning och en lista med "det här avgör affären" | 1 |
| Signalextraktion | Ändrade upphandlingsplaner | Rader om skadedjur med kvartal och tillförlitlighet | 3 |
| Handlingsextraktion | Tilldelningsbeslut, anbudsöppningsprotokoll, prisbilagor | Anbudsgivare, priser, poäng, volymer | 2 |
| Anbudsstöd | Kvalitetskriterier plus BeGones eget material (egenkontroll, stationskartor, rapporter, tidigare anbudstexter) | Utkast till svar per kriterium med hänvisning till källmaterial. Utkast, aldrig färdig text | 4 |
| Fråga datan | Fråga i naturligt språk | Svar ur procurement_-tabellerna via embeddings, samma mönster som team-chat | 3 |

## 5b. Anbudsverkstad

Per upphandling finns en anbudsverkstad. Anbudet lämnas alltid på köparens plattform, aldrig från portalen. Portalen producerar underlag och filer.

| Del | Innehåll | Etapp |
|---|---|---|
| Kravlista | AI läser uppladdat underlag och skapar en checklista: skallkrav, börkrav, bevis som ska bifogas (F-skatt, försäkring, certifikat, referenser), kvalitetskriterier med vikt, allt med sidhänvisning. Varje krav bockas av med ansvarig och bilaga. Listan granskas alltid av en människa | 1 |
| Prisbilaga | À-prisrader fylls från prislistor och kalkylen, marginal per rad och totalt, export i köparens format (xlsx) | 1 |
| Frågor till köparen | AI föreslår frågor ur oklarheter i underlaget, med frågor senast som deadline | 1 |
| Inlämningskontroll | Före sista dag: alla krav bockade, alla bilagor på plats, pris över golvet, signering klar | 1 |
| Kvalitetssvar | Utkast per kriterium ur eget material via embeddings (tidigare anbud, egenkontroll, stationskartor, rapportmallar), redigeras i portalen, export som docx. Anbudsbibliotek med bästa svar per kriterietyp | 4 |

## 5c. E-postflöde för handlingar

Utgående e-post finns via Resend. Inkommande byggs nytt.

1. **Begäran.** På en tilldelad upphandling väljs handlingar (tilldelningsbeslut, anbudsöppningsprotokoll, utvärderingsrapport, vinnande prisbilaga) och köparens registratoradress ur köparprofilen. Mall: begäran om allmän handling med hänvisning till tryckfrihetsförordningen. Skickas från upphandling@begone.se med unik svarsadress upphandling+bgu-{id}@begone.se och tagg [BGU-{id}] i ämnet. Loggas i procurement_document_requests med status Skickad.
2. **Inkommande.** Resend inbound (verifieras mot deras dokumentation) på en subdomän med egen MX så företagets e-post inte påverkas. Webhook api/procurement/inbound-email med signaturkontroll. Matchning: svarsadress eller ämnestagg, annars avsändardomän mot köparen, annars kön Osorterat där personal kopplar manuellt.
3. **Bilagor.** PDF, xlsx, docx, zip till storage under upphandlingen. AI klassificerar (tilldelningsbeslut, protokoll, prisbilaga, avslag) och extraherar anbudsgivare, priser, poäng, placering till procurement_bidders. Ansvarig godkänner innan siffrorna räknas som verifierade.
4. **Uppföljning.** Påminnelse efter sju dagar, eskalering efter fjorton. Status på upphandlingen, i köparprofilen och i sammandraget.
5. **Bonus.** Plattformarnas egna aviseringar (Mercell, TendSign) till samma inkorg matchas mot upphandlingen som andra källa.

Manuellt ändå: svar via e-tjänst, lösenordsskyddade filer, postadress, maskade priser. Inkommande text behandlas som data, aldrig som instruktioner till AI.

## 6. Avgränsning och säkerhet

- **Egen del av adminportalen.** Routes under /admin/upphandlingar, egen flikrad inne i vyn. Länk i sidomenyn under Försäljning med räknare för olästa träffar.
- **Upphandlingsansvarig.** Ny flagga profiles.is_procurement_manager, satt per person under Användarkonton (Personal) på samma sätt som faktureringsansvar, med etiketten Upphandlingsansvarig på personkortet. När flaggan slås på får personen en notis och ett e-postmeddelande med länk till /admin/upphandlingar, och posten dyker upp i sidomenyn. Admin har alltid åtkomst. Flera personer kan vara ansvariga samtidigt.
- **Egna tabeller** med prefix procurement_. RLS: läsning för admin och flaggade profiler, användarskrivning bara på egna fält, all import via service role från cron.
- **All hämtning från externa källor sker på servern** i api/cron/ med requireCronSecret och withCronLog. Egen user agent, högst ett anrop per sekund per källa, backoff vid fel.
- **Källhälsa** i procurement_source_health. Varning i portalen om en källa varit tyst över 24 timmar, notis till admin efter tre fel i rad. TED plus Kommers bär bevakningen om Mercell faller bort.
- **Ingen skrapning av e-Avrop** och ingen inloggning hos någon plattform i kod.
- **Manuella endpoints** under api/procurement/ använder requireAuth plus flaggkontroll.

## 7. Datamodell

| Tabell | Innehåll |
|---|---|
| procurement_notices | En rad per upphandling efter dedup. Titel, beskrivning, köpare (id), CPV, NUTS och län, publicerad, frågor senast, sista anbudsdag, anbudsöppning, uppskattat värde, förfarande, ramavtal eller kontrakt, avtalsstart, avtalsslut, antal förlängningar, kriterietyp, kriterievikter (jsonb), prismodell, posttyp, status hos oss, ansvarig, matchpoäng, sannolikhet, förväntat täckningsbidrag, dedup-nyckel |
| procurement_notice_sources | Källposter: källa, käll-id, länk, rådata jsonb, hämtad |
| procurement_buyers | Köpare med orgnr, namn, aliasnamn (Mercell saknar orgnr), sektor, län via orgnr och NUTS, kundkoppling till customers |
| procurement_awards | Tilldelningar för nya och historiska upphandlingar: vinnare (orgnr), värde och värdets art (ramtak eller verkligt pris), antal anbud, lägsta och högsta anbud, tilldelningsdatum, avtal tecknat, avtalsstart, beräknat slut, rättat slut, bearbetningsfönster, ansvarig, källa |
| procurement_bidders | Alla kända anbudsgivare per upphandling inklusive förlorare och oss själva: orgnr, namn, pris, poäng, placering, vann, källa |
| procurement_suppliers | Leverantörsregister på orgnr med aliasnamn |
| procurement_bids | Våra egna anbud: kalkyl (jsonb från marginEngine), volymer, golvpris, målpris, lämnat pris, utfall, lärdom |
| procurement_document_requests | Begärda handlingar per upphandling: typ, begärd, mottagen, status, fil |
| procurement_documents | Uppladdade dokument: fil i storage, typ, uppladdad av, AI-extraktion jsonb, sammanfattning |
| procurement_signals | Signaler: typ, köpare, text, förväntat kvartal, tillförlitlighet, källa och länk, kopplad avtalsrad, status |
| procurement_signal_sources | Kurerade webbadresser med hash, senaste hämtning, aktiv |
| procurement_watch_rules | CPV-prefix, nyckelord, negativa ord, län, poäng |
| procurement_events | Händelselogg per upphandling |
| procurement_read_state | Vem som sett vad, för räknaren |
| procurement_source_health | Källa, senaste körning, senaste lyckade, antal poster, fel i rad |

Dedup: primärt köparens orgnr plus normaliserad titel plus sista anbudsdag. Sekundärt källa plus käll-id, där Mercells TED-poster bär TED-numret. Reserv: trigram-likhet på titel över 0,6 med samma köpare och sista dag inom en dag.

Matchning: hård träff när någon CPV börjar på 9092 ger 100 poäng. Mjuk träff när CPV finns i närliggande grupper (90900000, 90910000, 90911000, 70000000, 70330000, 50700000, 77231200) och minst ett nyckelord i titel eller beskrivning ger 50 plus 10 per nyckelord. Järfällahus låg på CPV 70000000 och hittades bara via titeln, så nyckelorden är nödvändiga. Notis vid 60 poäng, direktnotis vid 100.

## 8. Cron och skript

| Jobb | Schema | Gör |
|---|---|---|
| api/cron/procurement-sync-mercell | varje timme 06 till 22, vardagar | Nyaste poster för Sverige tills allt är äldre än förra körningen. Dedup, matchning, signaler ur UpcomingTenders, RFI och PriorInformation, notiser |
| api/cron/procurement-sync-ted | dagligen 07:15 | Annonser, tilldelningar och förhandsannonser för SWE med CPV-lista och de eForms-fält som listas i avsnitt 2. Tilldelningar fyller awards och bidders |
| api/cron/procurement-sync-kommers | dagligen 07:30 | Reserv. POST-sökning på CPV och nyckelord |
| api/cron/procurement-signals | dagligen 05:30 | Signalkällor, diff, AI-extraktion vid ändring |
| api/cron/procurement-digest | dagligen 07:45, vardagar | Sammandrag via Resend: nya träffar, deadlines inom sju dagar, avtal in i fönstret, nya signaler, handlingar att begära |
| api/cron/procurement-deadlines | dagligen 06:00 | Påminnelser sju och tre dagar före sista anbudsdag och frågor senast, avtalsspärr och överprövningsfönster |
| scripts/import-uhm-procurements.mjs | manuellt, årligen | Sex UHM-dataset via CSV för CPV 9092 och närliggande. Fyller buyers, awards, bidders, suppliers |
| scripts/import-ted-history.mjs | manuellt, en gång | TED 2016 till 2023 via XML för antal anbud, vinnare och värde |

## 9. Vyer

Alla vyer under /admin/upphandlingar med egen flikrad: Marknad, Bevakning, Avtalsklocka, Signaler, Köpare, Konkurrenter, Inställningar. Skisser i designytan "Upphandlingsportal skisser".

1. **Marknad.** Startsidan. Marknadens storlek och trend, marknadsandel per leverantör och år, antal anbud per upphandling, pipeline med förväntat täckningsbidrag per kvartal, utmanarläge, kvalitetsviktade köpare, källhälsa.
2. **Bevakning.** Lista med matchade upphandlingar med poäng, förväntat antal anbud, kriterietyp, uppskattat årsvärde, sannolikhet, förväntat täckningsbidrag, status, ansvarig, källor.
3. **Upphandling.** Detaljsida i tio block: identitet, källor och dokument, tidslinje, affären, utvärdering, vår kalkyl, köparhistorik, konkurrens, utfall och handlingar, hantering.
4. **Anbudskalkyl.** Volymer in, kostnad ut, golvpris, målpris, vinnande band mot kända anbud, förväntat täckningsbidrag vid olika priser. Sparas på upphandlingen.
5. **Avtalsklocka.** Kända avtal med nuvarande leverantör, slutdatum med källa, bearbetningsfönster, status, ansvarig.
6. **Signaler.** Signaler och signalkällor.
7. **Köpare.** Register med profil per köpare.
8. **Konkurrenter.** Register med profil per leverantör och möten mot varandra.
9. **Inställningar.** Bevakningsregler, signalkällor, källhälsa, sammandrag på eller av, länk till Användarkonton (Personal).

Stil: följ kundsidan under Befintliga kunder (CustomerRecordPage och komponenterna i src/components/admin/customers/record), inte de äldre tunga Card-komponenterna. Innehåll max-w-5xl centrerat, bakgrund slate-950, tunna ramar slate-800, sektionsrubriker som liten versal text i slate-500, pulsrad i stil med CustomerPulseRow, tabeller med 12 till 13 px text och tabular-nums, statuspunkter med text i stället för piller, brandgrönt bara som accent. Ljust och mörkt läge via befintlig ThemeToggle och variabelremappingen i globals.css. Svensk text, datum ÅÅÅÅ-MM-DD, komma som decimal. Diagram med Recharts i en färg per serie enligt befintliga light-overrides.

## 10. Notiser

- Direktnotis i notifications till alla upphandlingsansvariga vid hård träff. Klick öppnar detaljsidan.
- Räknare i sidomenyn (badgeKey 'procurement') för olästa träffar.
- Dagligt sammandrag via Resend 07:45 på vardagar. Kan stängas av per person.
- Påminnelser till ansvarig sju och tre dagar före sista anbudsdag och frågor senast, samt vid tilldelningsbeslut och avtalsspärrens slut.
- Notis när en tilldelning kommer in på en upphandling vi lämnat anbud på, med vinnare och antal anbud.

## 11. Etapper

| Etapp | Innehåll | Uppskattning |
|---|---|---|
| 1. Grund, kalkyl och verkstad | Tabeller, RLS, flagga med notis och länk, navigering, Mercell och TED-synk, dedup, matchning, Bevakning, Upphandling med tio block, Anbudskalkyl mot marginEngine, deadline-påminnelser, direktnotiser, källhälsa, uppladdning och AI-extraktion av underlag, anbudsverkstad (kravlista, prisbilaga, frågor, inlämningskontroll), e-postflöde för handlingar ut och in | 8 dagar |
| 2. Marknad och historik | UHM-import (sex dataset), TED-historik via XML, köpar- och leverantörsregister på orgnr, Avtalsklocka med verkliga datum, Marknad, Köpare, Konkurrenter, utmanarläge, marknadsandel, handlingsextraktion | 4 dagar |
| 3. Framförhållning och sammandrag | Planerade poster, signalkällor med diff och AI, Kommers-reserv, dagligt sammandrag, Inställningar, fråga datan | 3 dagar |
| 4. Anbudsstöd | Utkast per kvalitetskriterium ur eget material, lärdomar vunnet mot förlorat | 2 dagar |

Varje etapp levereras som egen commit med punkt i uppdateringsloggen. Version 3.13.0 för etapp 1, sedan 3.14.0 och vidare.

## 12. Antaganden att verifiera under bygget

- Mercell-API:ets parametrar för sortering och posttyp. Bekräftat: filter på leveransland, sidstorlek 100, nyckelord, fälten docTypeCode, boppCategory, tenderStatus, contractExpiryDate.
- Att Mercells källposter för TED bär TED:s publiceringsnummer.
- Avtalsspärr tio dagar och överprövningsfönster enligt LOU, kontrolleras mot lagtext.
- Att köpare lämnar ut prisbilagor efter tilldelning. Sekretessprövning görs per fall och praxis varierar.
- Länkodning av kommunala bolag via orgnr kräver en uppslagslista som byggs under importen.
- Vilka signalkällor som ger något. Starta med 20 till 30 adresser i BeGones län.

Rådata och skript från utredningen ligger i scripts/data/procurement/: mse.jsonl (5 153 Mercell-poster), uhm_pest.jsonl (123 UHM-rader) och ua/ med p_*.json (UHM per dataset), ted_can.json, ted_all.json, tedfields.json (TED:s 1 830 fältnamn) och lx/ (äldre TED-XML). Använd dem som fixtures för importskripten och dedup-testerna. Lägg mappen i .gitignore om den inte ska in i repot.

## 13. Driftsättning

Byggt 2026-09-24 (etapp 1 och delar av etapp 2 och 3). Migrationen `supabase/migrations/20260924_upphandlingsportal.sql` är applicerad på projektet.

Byggt 2026-09-25 (version 3.14.0): fristående plattform på upphandling.begone.se, datakvalitet i avtalsklockan, Kommers, Fråga datan, kvalitetssvar, anbudsbibliotek och lärdomar. Migrationerna `20260925_upphandling_etapp3_4.sql` och `20260925_upphandling_uppfoljning_relevans.sql` är applicerade.

### Fristående plattform: upphandling.begone.se

Samma kodbas och Vercel-projekt (`kundportal`) som kundportalen. När appen körs på värdnamnet `upphandling.begone.se` renderas ett eget skal (`src/pages/procurement/ProcurementApp.tsx`) med egen inloggning, flikrad, notisklocka för upphandlingsnotiser, temaväxlare, Mitt konto och Logga ut. Routes ligger på roten: `/`, `/bevakning`, `/avtalsklocka`, `/signaler`, `/kopare`, `/konkurrenter`, `/fraga`, `/installningar`, `/mitt-konto` och `/{upphandlingens id}`. Inga andra portaldelar nås; okända adresser går till startsidan. Bara profiler med admin eller `is_procurement_manager` släpps in. Gamla länkar `/admin/upphandlingar/...` på subdomänen skickas vidare.

I adminportalen öppnar menyposten Upphandlingar subdomänen i ny flik. Routes under `/admin/upphandlingar` finns kvar som reserv för utveckling. Lokalt: öppna `http://localhost:5173/login?procurement=1` (flaggan sparas i fliken, `?procurement=0` stänger av) eller sätt `VITE_PROCUREMENT_HOST`.

DNS och Vercel (görs av Christian eller huvudsessionen):

1. Cloudflare: CNAME `upphandling` till `cname.vercel-dns.com`, proxy av (DNS only, grått moln).
2. Vercel: lägg till domänen `upphandling.begone.se` på projektet `kundportal`. Kontrollerat 2026-09-25: domänen är redan tillagd och verifierad på projektet.
3. `vercel.json` behöver ingen ändring: SPA-omskrivningarna gäller alla värdnamn och `/api/*` fungerar på båda.
4. Supabase Auth: lägg till `https://upphandling.begone.se` under Authentication, URL Configuration (Site URL eller Redirect URLs) om lösenordsåterställning ska kunna landa där.
5. Sätt `PROCUREMENT_PORTAL_URL` och `VITE_PROCUREMENT_PORTAL_URL` om adressen någon gång ändras.

### Avtalsklockan efter 2026-09-25

- Slutdatum i ordningen TED slutdatum plus förlängningar, Mercell `contractExpiryDate`, avtalsstart plus avtalstid (TED eller annonstexten, `contract_duration` och `text_duration`), sist två plus två år från avtalsstarten. Avtalsstarten tas från avtalsstart, tecknat avtal, tilldelning plus en månad, tilldelningsannonsen eller UHM-annonsen plus sex månader. Beräkningen står i klartext i `calc_basis`.
- Äldre TED-XML: den ursprungliga annonsen läses (`--fetch-cn`) för avtalstid, start, slut och förlängningar.
- Felträffar flaggas i `excluded_reason`, rådatan behålls. Kräver skadedjursord i titeln eller huvud-CPV 90921 till 90924, och titlar om lokalvård, hissar, vassklippning, grönytor, snö, städning med mera räknas bort. Manuella beslut i portalen (Felträff, Återställ) behålls vid omkörning.
- Uppföljning (`procurement_refresh_award_followups`, körs efter TED- och Mercell-synken): ny annons om skadedjur från samma köpare, senare tilldelning från samma köpare, eller slut passerat. Köpare som annonserat på nytt tas ur fönstret.
- Omräkning av allt: `node scripts/recompute-procurement-awards.mjs --fetch-cn` (`--dry-run` visar bara). Kördes 2026-09-25: 123 av 303 tilldelningar flaggades som felträffar.
- Län på köpare: `procurement_municipalities` (SCB:s 290 kommuner) och `procurement_resolve_buyer_counties()`.

### Miljövariabler i Vercel

| Variabel | Krävs | Vad |
|---|---|---|
| `CRON_SECRET` | finns | Alla procurement-cron kör `requireCronSecret` |
| `RESEND_API_KEY` | finns | Utgående post. Nyckeln i produktion är begränsad till sändning (upptäckt 2026-09-25) |
| `RESEND_RECEIVING_API_KEY` | ny | Nyckel med Full access i Resend, används av `api/procurement/inbound-email` för att hämta mottagna mejl och bilagor. Utan den svarar Resend 401 restricted_api_key och mejlet fastnar |
| `GOOGLE_AI_API_KEY` | finns | Gemini för underlagsextraktion, klassning av handlingar och signaler |
| `RESEND_WEBHOOK_SECRET` | ny | Hemligheten (whsec_...) från webhooken i Resend, för signaturkontroll i `api/procurement/inbound-email` |
| `PROCUREMENT_REPLY_DOMAIN` | ny | Domänen i svarsadressen `upphandling+bgu-{nr}@{domän}`. Sätt till mottagningssubdomänen, t.ex. `inbound.begone.se`. Standard är `begone.se`, då hamnar svaren i företagets vanliga inkorg och matchas inte automatiskt |
| `PROCUREMENT_FROM_EMAIL` | valfri | Avsändare, standard `BeGone Upphandling <upphandling@begone.se>`. Domänen måste vara verifierad i Resend |
| `PROCUREMENT_REPLY_LOCAL` | valfri | Lokal del i svarsadressen, standard `upphandling` |
| `PROCUREMENT_USER_AGENT` | valfri | User agent mot Mercell, TED och signalkällor, standard med kontaktadress upphandling@begone.se |
| `MERCELL_NOTICE_URL_TEMPLATE` | valfri | Länkmall till Mercells annonssida, standard `https://app.mercell.com/tender/{id}` (verifierad 2026-09-25, samma id som sök-API:et) |
| `PORTAL_URL` | finns | Kundportalens adress |
| `PROCUREMENT_PORTAL_URL` | valfri | Upphandlingsportalens adress för alla länkar i procurement-mejl, notiser och sammandrag. Standard `https://upphandling.begone.se` |
| `VITE_PROCUREMENT_PORTAL_URL` | valfri | Samma adress i klienten (menyposten och notislänkar i kundportalen). Standard `https://upphandling.begone.se` |
| `VITE_MAIN_PORTAL_URL` | valfri | Kundportalens adress från den fristående portalen (länken till Användarkonton). Standard `https://kundportal.vercel.app` |
| `VITE_PROCUREMENT_HOST` | valfri | Extra värdnamn som ska ge det fristående skalet, t.ex. `upphandling.localhost` vid utveckling |

### DNS för inkommande post (Resend inbound)

Resend kräver en egen subdomän när huvuddomänen redan har MX-poster, annars flyttas företagets e-post.

1. Lägg till och verifiera en mottagningsdomän i Resend, förslagsvis `inbound.begone.se`.
2. Lägg MX-posten som Resend visar i dashboarden på subdomänen (prioritet 10). Huvuddomänens MX rörs inte.
3. Sätt `PROCUREMENT_REPLY_DOMAIN=inbound.begone.se` i Vercel.
4. Skapa en webhook i Resend för händelsen `email.received` mot `https://<portalens domän>/api/procurement/inbound-email` och lägg hemligheten i `RESEND_WEBHOOK_SECRET`.
5. Testa: skicka ett mejl till `upphandling+bgu-1@inbound.begone.se` med en PDF. Det ska dyka upp under Bevakning, Osorterad e-post, eller på upphandling BGU-1.

Webhooken bär inte brödtext eller bilagor. Endpointen hämtar dem från `GET https://api.resend.com/emails/receiving/{id}` och `.../attachments` (download_url giltig en timme).

### Cron (vercel.json, tider i UTC)

| Jobb | Schema UTC | Svensk tid (sommar) |
|---|---|---|
| `procurement-sync-mercell` | `0 4-20 * * 1-5` | varje timme 06 till 22 vardagar |
| `procurement-sync-ted` | `15 5 * * *` | 07:15 |
| `procurement-deadlines` | `0 4 * * *` | 06:00 |
| `procurement-digest` | `45 5,6 * * 1-5` | 07:45, skickar bara när klockan är 7 i Sverige (fungerar både sommar och vinter) |
| `procurement-signals` | `30 3 * * *` | 05:30 |
| `procurement-sync-kommers` | `30 5 * * *` | 07:30, reserv: Kommers annonser och förhandsannonser. Manuellt `?since=ÅÅÅÅ-MM-DD`, `?old=1` tar med utgångna |

Vintertid ligger övriga jobb en timme tidigare i svensk tid. Manuell körning: `curl -H "Authorization: Bearer $CRON_SECRET" https://<portal>/api/cron/procurement-sync-ted?since=2026-07-01`. Sammandraget kan tvingas med `?force=1`.

### Manuella importskript

- `node scripts/import-uhm-procurements.mjs` fyller köpare, leverantörer, tilldelningar och anbudsgivare ur Upphandlingsmyndighetens sex dataset. `--fixtures` läser `scripts/data/procurement/`, `--dry-run` skriver inget.
- `node scripts/import-ted-history.mjs` fyller TED-historiken (eForms via API från 2023-11, äldre XML).

### Kvar att göra efter driftsättning

- Kör Kommers-synken manuellt en gång med `?since=` och följ den i `cron_runs` (kördes lokalt mot databasen 2026-09-25: 23 listade, 1 inläst, 0 dubbletter).
- Nationella Kommers-annonser saknar köpare och exakt sista anbudsdag (bara listans "N dagar kvar"). Mercell-synkens Kommers-nyckel saknar instans, id kan i teorin krocka mellan Kommers-instanser.
- Kvalitetssvar: export som docx är inte byggd. Spara i biblioteket skapar alltid ett nytt svar.
- Fråga datan använder textmatchning, inte embeddings (inga procurement-rader i document_embeddings).

- Granska de 20 seedade signalkällorna under Upphandlingar, Inställningar. De är markerade som overifierade och flera pekar på startsidor.
- Sätt Upphandlingsansvarig på rätt personer under Användarkonton (Personal).
- Verifiera avtalsspärrens tio dagar och formuleringen i begäran om allmän handling juridiskt.
