# Plan: Tilläggsstationer + kopiera från föregående station

## STATUS 2026-08-31: IMPLEMENTERAD (alla 6 etapper) + specialistgranskad

Migrationen är applicerad i live-DB. Kod pushad till main. EJ browser-testad.

Kvar för go-live (affärsdata som inte kunde läggas in autonomt):
1. PRISER: golvpris för "Betesstation Månadskostnad" (tjänst 43) i standardprislistan + skapa FEV-prislista och sätt customers.price_list_id på SAMTLIGA FEV-rader (HK + enheter). Utan pris skapas 0 kr-rader med varningstoast och ingen faktura.
2. FEV-datastäd: dubblettkundraden "Återvinningscentralen", stationer på rätt enhetsrad.
3. Lägg gärna arbetstid/stationsartikel som automatiska interna kostnader på tjänsten (Tjänsteutbud → Redigera tjänst → Används för tilläggsstationer).

Kända avvikelser/restpunkter efter granskning (medvetna, ej blockerande):
- EditContractCaseModal kör INTE prefill av tilläggsstationsraden — kontrollrundor ska avslutas via kontrollmodulen. Avslutas de i modalen får raden läggas manuellt. (Delad service finns; modalintegration = v2.)
- Vikarie-skyddet (ensureTechnicianOnCase) blockeras av cases-RLS för otilldelade tekniker — fakturafel ger då tydlig toast och raderna ligger kvar (inget tyst tapp). Riktig lösning kräver SECURITY DEFINER-RPC.
- Etableringsräkningen filtrerar inte på placed_by-tekniker eller status (räknar alla tilläggsstationer placerade sedan ärendet öppnades) — antalet är redigerbart i sammanfattningen.
- Progressvisningen i kontrollmodulen kan visa t.ex. "5/4" efter upphämtning + omladdning (kosmetiskt; faktureringen räknar inspektionsrader och blir rätt).
- Dubbelfaktureringsfönstret i createAdHocItemsFromCase (insert lyckas, billed-markering felar) kvarstår — ingen DB-spärr; kandidat för RPC/unik nyckel.
- Borttagsreglerna är klient-side (indoor_stations har RLS USING(true) för authenticated — pre-existing, åtgärdas i säkerhetsplanens fas 3-4).

Framtagen 2026-08-31. Bygger på två kodkartläggningar, live-DB-verifiering (rfyufytjwvqiqwueinoj) och en adversariell specialistgranskning vars korrigeringar är inarbetade. Status: klar för implementation efter beslut på de tre punkterna under "Beslutspunkter".

## Affärsbeslut (låsta)

- Debitering per genomförd kontrollrunda, inte kalendermånad och inte avtalstillägg/årspremie.
- Benämning: "Tillägg utöver avtal" (märkningen) och "Tilläggsstation" (stationen). Aldrig "tillfällig".
- Etablering av tilläggsstationer ska debiteras. Detta är ett medvetet avsteg från beslutet "Etableringar är normalt 0 kr" (docs/oppna-punkter-intaktsvyn.md:141) och gäller enbart tilläggsstationer.
- Tjänsten finns redan: `services` id `886e26cf-0c4d-4628-afb9-2c285750ecc5`, code '43', "Betesstation Månadskostnad", grupp Gnagare. OBS: `base_price` är NULL, så utan prislisterad blir raden 0 kr.

## Verifierade nyckelfakta

- `equipment_placements` och `indoor_stations` saknar fält för kommersiell märkning. `status` (default 'active') bär livscykeln (active/removed/missing/damaged), `calculated_status` bär tröskelstatus. Ny kolumn krävs.
- Preparat + mängd sparas inte på stationen vid utplacering. De skrivs till öppet etableringsärende via `CasePreparationService` (TechnicianEquipment.tsx:359-391, AddStationWizard.tsx:320-351). "Kopiera från föregående" är alltså formulär-state-bevarande, inte läsning från förra stationens DB-rad.
- Utomhus-batchflödet bevarar redan stationstyp + kartläge mellan placeringar (`lastEquipmentType`/`lastUsedMap`, TechnicianEquipment.tsx:97-98, 405-419, 871-872). Inomhus nollställer allt (`resetPlacementMode`, AddStationWizard.tsx:281-286).
- Kontrollärendens avslut (StationInspectionModule.tsx:1222-1244) gör bara `completeInspectionSession` + rå `cases.update(status='Avslutat')` (`updateCaseStatusToCompleted`, inspectionSessionService.ts:1418). Ingen visit snapshot, ingen fakturering, ingen provision, ingen `completed_date`. I prod: 143 inspection-ärenden, 14 har billing-rader (manuellt via modalen).
- `EditContractCaseModal` hanterar inspection-ärenden fullt ut och dess avslutskedja gatar på statusövergången till Avslutat (:1346). Är statusen redan Avslutat körs den aldrig.
- Etableringsärenden (`service_type='establishment'`): `CaseServiceSelector` är `readOnly={isEstablishment}` (EditContractCaseModal.tsx:2620). BE-0008613 har redan en 0 kr-rad för Etableringskostnad.
- Fakturaväg avtalskund: `case_billing_items` (service-rader, pending) → `createAdHocItemsFromCase` (läser BARA pending, markerar billed) → `contract_billing_items` (ad_hoc) → `generateAdhocInvoiceForCase`. `invoice_marking` → Er referens vid `grouping='per_case'`.
- Aktiva stationer i kontrollronder: hårdkodat `.eq('status','active')` i inspectionSessionService.ts:1026 (outdoor) och :1088 (indoor). Räkningen sker per enhets-`customer_id` (indoor via `floor_plans.customer_id`, NOT NULL), samma vägar som kontrollrundan själv, så multisite blir rätt per konstruktion.
- RLS-fakta från granskningen: tekniker kan INTE läsa `contracts` (utom som avtalsansvarig) → avtalsprislistesteget i `getEffectiveServicePrice` hoppar tyst för tekniker. Kundprislistevägen är däremot RLS-säker (customers + price_list_items läsbara). Tekniker får skriva `contract_billing_items` men läsa bara via `technician_owns_case` (primär/sekundär/tertiär på ärendet).
- FEV i live-DB: alla kundrader (HK + enheter) har `price_list_id = NULL` och NOLL rader i `contracts`. Dessutom finns "Återvinningscentralen" som dubblettrader i customers.

## Etapp 1: Datamodell + prissättning

1. Migration: `is_addon boolean NOT NULL DEFAULT false` på båda tabellerna. Verifiera mot live-DB före migration (migrationsmappen är inte schemakällan). Additiv kolumn, inga vyer eller select-listor går sönder.
2. TS-typer: `EquipmentPlacement` (database.ts:1838), `IndoorStation` + `CreateIndoorStationInput` (indoor.ts).
3. Prisdistribution (korrigerad efter granskning):
   - Skapa en FEV-prislista och sätt `customers.price_list_id` på SAMTLIGA FEV-rader (HK + varje enhet). Prisuppslag och räkning sker per enhets-customer_id och kundprislistesteget har ingen parent-fallback.
   - Lägg golvpris i standardprislistan ENDAST för Betesstation Månadskostnad, INTE för Etableringskostnad (se etapp 5 varför).
   - Använd INTE avtalsprislista som bärare: tekniker-RLS blockerar `contracts`-läsningen tyst och ger fel pris i teknikerflödet.
   - Testa prisuppslaget inloggad som tekniker innan etapp 6 byggs.
4. Datastäd FEV före go-live: dubbletten Återvinningscentralen, och kontrollera att stationer ligger på rätt enhetsrad (station på HK-raden räknas mot HK:s kontrollärende, inte enhetens).

## Etapp 2: Märkning vid utplacering

1. Nytt fält "Tillägg utöver avtal" (checkbox, default av) i `EquipmentPlacementForm` (efter stationstyp-gridden, ~rad 586) och `IndoorStationForm` (~rad 353).
2. Skrivpunkter: `equipmentService.createEquipment` (:194) + anropet TechnicianEquipment.tsx:332-342; `indoorStationService.createStation` (:225) + `AddStationWizard.handleCreateStation`.
3. Redigerbart i efterhand i stationens edit-läge, så en station kan omklassas utan omplacering.
4. BORTTAGSREGLER per märkning (Christians krav 2026-08-31): ordinarie avtalsstationer (is_addon=false) ska för TEKNIKER bara gå att FLYTTA (positionsändring), inte ta bort - alternativen "Borttagen" och "Radera permanent" i statusdialogen (TechnicianEquipment.tsx confirmDelete :434-467 + inomhusmotsvarigheten) döljs/spärras för avtalsstationer. Rekommendation: "Försvunnen" och "Skadad" tillåts även på avtalsstationer (verklighet i fält, påverkar ingen fakturering) - bekräftas av Christian. Tilläggsstationer har full livscykel inkl. upphämtning. Admin/koordinator behåller full rätt på alla stationer (avtalsändringar måste kunna städas).

## Etapp 3: Kopiera från föregående station

Princip: kopiera stationstyp, preparat, mängd, enhet och is_addon-märkning. Aldrig serienummer, position, foto eller kommentar. Kravet "knappen ska inte finnas om stationstypen skiljer sig" uppfylls strukturellt: kopiering utgår alltid från föregående station (samma typ per definition), och vid typbyte i formuläret nollställs preparatet.

OBS verifierad latent bugg som ska fixas i samma veva: utomhus nollställs preparatet vid typbyte BARA om nya typen saknar preparat (EquipmentPlacementForm.tsx:258-264); mellan två preparatbärande typer ligger gammalt `preparation_id` kvar i state och skickas med vid submit. Lägg explicit nollställning vid typbyte. Inomhus nollställer redan alltid (`handleTypeChange`, IndoorStationForm.tsx:178-181).

Utomhus (utökar befintlig mekanik):
1. TechnicianEquipment.tsx:405-419: spara även `lastPreparation {id, quantity, unit}` + `lastIsAddon` i success-blocket.
2. Nya props till `EquipmentPlacementForm` (:871-872): `initialPreparationId/Quantity/Unit` + `initialIsAddon` bredvid `initialEquipmentType`/`autoShowMap`.
3. Formuläret konsumerar initialvärdena (:221-229) och `loadPreparationsForType` (:246-277) får inte nollställa dem när typen är oförändrad.
4. UX: i formuläret visas en diskret rad "Kopierat från föregående station" med möjlighet att rensa.

Inomhus (ny mekanik):
1. `AddStationWizard`: behåll `selectedStationType`/`selectedTypeData` + senaste preparat/mängd/enhet/is_addon efter `handleCreateStation` i stället för att `resetPlacementMode` nollar allt.
2. Footer-knapp "Placera fler - kopiera föregående" (:862-868) som hoppar över `StationTypeSelector` direkt till `placementMode='place'` med senaste värden. Befintlig "Placera fler stationer" behålls för fritt val.
3. `IndoorStationForm`: nya `initialPreparation*`-props (init hårt till null/'g' idag, :88-90), analogt med `initialStationType`-mönstret (:46, :101-110).
4. Paritet i `CustomerStationsModal` (startPlacementMode/resetPlacementMode :330-343). OBS: docs/utrustningssida-redesign.md:102 planerar radera den filen, så kopieringslogiken byggs delbar.

## Etapp 4: Visning "Tilläggsstation"

1. Utomhus: `EquipmentMap.tsx` (markörrendering :327-417), visuell särmarkering (t.ex. streckad ring) + detaljblad (`EquipmentDetailSheet`, `CustomerOutdoorStationDetailSheet`, `EquipmentList`). Slår igenom i teknikervy, adminvy, kundportal och regionvy.
2. Inomhus: `IndoorStationMarker.tsx`, badge-mönster finns (:202-223), lägg tilläggsmarkering + komplettera legenden (:280-299).
3. Rapporter (3 separata): `equipmentPdfGenerator.ts` (:400, 473-477), `api/generate-inspection-report-pdf.ts` (:307-311, :379-396), `inspectionReportService.ts` Excel (:324-353, :394-446). Text: "Tillägg utöver avtal".
4. Ytor som INTE får markering i v1 (medvetet): `useCustomerEquipment`-hooken, kundkortets utrustningssektioner, `CaseDetailsModal` (kundportal), `ManageRegionsModal`. Kompletteras vid behov.

## Etapp 5: Etableringsdebitering (beslutad utformning 2026-08-31)

1. Lyft `readOnly={isEstablishment}` (EditContractCaseModal.tsx:2620) så tjänsterader kan redigeras på etableringsärenden.
2. Etableringskostnad-raden är 0 kr per default och ska FINNAS KVAR på ärendet även när den är 0 (Christians beslut: vi tar nästan aldrig betalt, men raden ska finnas där). `base_price ?? 0` ger 0-defaulten gratis. Lägg INTE Etableringskostnad i någon kund- eller avtalsprislista: `CaseServiceSelector` auto-skapar en förvald Etableringskostnad-rad på alla nya etableringsärenden med pris från kund-/avtalsprislistan (:250, :269-285), så en prislisterad skulle prissätta även vanliga avtalsetableringar som ska vara 0 kr.
3. "Färdig med etablering" får en FAKTURERINGSSAMMANFATTNING (Christians beslut, ersätter "koordinatorn avslutar i modalen"): vid klick visas en bekräftelsevy "Stäng ärende och skicka följande för fakturering" med ärendets tjänsterader, antal och priser. Antal på etableringsraden förifylls server-side: tilläggsstationer placerade hos kunden sedan etableringsärendet öppnades (`placed_at >= ärendets skapande` + is_addon + placed_by-tekniker på ärendet), redigerbart i sammanfattningen. Server-side räkning i stället för klient-batch-state täcker etableringar som sträcker sig över flera besök/dagar - klientens batch-räknare tappar allt vid appomstart. Om totalen är 0 kr visas ingen faktureringsinfo alls och ärendet stängs precis som idag utan faktura. Om totalen är > 0 körs faktureringskedjan (samma delade service som etapp 6) vid stängning. Gäller båda vägarna: `handleFinishBatch` (TechnicianEquipment.tsx:564-611) och `handleFinishEstablishmentFromIndoor` (:508-546).
4. Provisionssektionen förblir dold på etableringsärenden (`!isEstablishment`, :2626) - avsiktligt; provision hanteras som vanligt genom att teknikern själv kryssar i provisionsgrundande i ärendet, aldrig automatiskt.

## Etapp 6: Debitering per kontrollrunda (kärnan)

Ny delad servicefunktion, t.ex. `completeContractCaseBilling(caseId, customerId, {technicianId, technicianName})`, extraherad ur EditContractCaseModal-kedjan (:1311-1413) och anropad av BÅDE modalen och StationInspectionModule, så logiken inte driftar i två kopior. Granskningen bekräftade att modulen saknar det mesta modalen har (cases-raden laddas aldrig, ingen profile, ingen formulärstate), så detta är en nyimplementation via delad service, inte en inkoppling.

Dynamisk tjänstkoppling (Christians önskemål 2026-08-31, ersätter hårdkodat service-id):
- Ny inställning på tjänsten i `ServiceCatalogEditModal.tsx` (/admin/tjansteutbud): "Används för tilläggsstationer". Ny kolumn på `services`, t.ex. `used_for_addon_stations boolean DEFAULT false`, med vakt så bara EN tjänst åt gången kan ha flaggan (partiellt unikt index `WHERE used_for_addon_stations`). OBS namnkrock: `is_addon_service` finns redan och betyder "Tilläggstjänst" i prisguiden - helt annan sak, döp tydligt.
- Valfria automatiska INTERNA KOSTNADER: ny liten tabell `service_default_articles (service_id, article_id, quantity_per_unit)` + redigerings-UI i samma modal. När förifyllnaden skapar tjänsteraden skapas också motsvarande artikelrader (interna kostnader, `addArticleToCase`) med antal = stationer × quantity_per_unit, för korrekt marginal på ärendet. Artikelrader blir aldrig fakturarader (befintligt beteende).
- Förifyllnaden slår upp tjänsten via flaggan i stället för hårdkodat id. Saknas flaggad tjänst: gör inget, logga varning.

Förifyllnaden (`prefillAddonStationLine`):
1. Räkna KONTROLLERADE tilläggsstationer i rundan (justerad semantik 2026-08-31): tilläggsstationer (is_addon) som har inspektionsrad i sessionen (`outdoor/indoor_station_inspections` WHERE session_id, join mot stationstabellerna). Motiv: teknikern kan hämta upp tilläggsstationer UNDER rundan - en station som kontrollerats och därefter hämtats upp faktureras en sista gång oavsett i vilken ordning teknikern gjorde momenten, och en station som tillkommit mitt i rundan och kontrollerats faktureras direkt. Fakturan = det som kontrollerades, vilket alltid matchar kundens kontrollrapport. Fallback om sessionen saknar inspektionsrader helt: aktiva tilläggsstationer per customer_id.
2. Bail om 0.
3. Idempotensvakt (korrigerad efter granskning): läs `getCaseBillingItems(caseId, 'contract', 'all')`, INTE default (default är pending-filter och missar billade rader → dubbelfaktura vid återöppnad session). Regel: finns tilläggsstations-tjänsteraden i pending → uppdatera quantity/pris; i billed → skapa inget, och toasta om aktuellt antal skiljer sig från fakturerat ("Tilläggsstationer redan fakturerade för denna runda, antalet har ändrats - meddela kontoret").
4. Pris: `getEffectiveServicePrice(tjänsten, customerId)` → fallback `base_price ?? 0`. Vid 0-pris (Christians beslut): skapa raden med 0 kr så underlaget syns, men generera INGEN faktura när ärendets fakturerbara total är 0 - ärendet avslutas som vanligt. Tydlig varningstoast "pris saknas i prislista" så kontoret rättar. Avslut blockeras aldrig av prisdata.
5. `CaseBillingService.addServiceToCase({service_id, service_code, service_name, quantity: antal, unit_price: pris, case_type:'contract', ...})` + ev. auto-artikelrader enligt tjänstkopplingen. Raden är INTE provisionsgrundande automatiskt - teknikern kryssar själv i som vanligt.

Semantik att hålla fast vid: antalet på raden = tilläggsstationer som KONTROLLERADES i rundan. Raden tickar inte upp löpande när stationer placeras - utplaceringar mellan rundor fångas av nästa runda (och etableringsraden i sitt eget ärende), upphämtningar under en runda faktureras en sista gång eftersom de kontrollerades.

Avslutssekvens i `handleCompleteInspection` (felordning specificerad efter granskning):
1. `completeInspectionSession` (som idag).
2. Statusuppdatering FÖRST, med `completed_date` i samma update (görs inte idag).
3. DÄREFTER faktureringskedjan i egen try/catch: prefill → `createVisitSnapshot` (byggd från sessionens data) → `createAdHocItemsFromCase`. Fakturering får ALDRIG blockera statusövergången; varje delfel ger explicit toast "raderna ligger kvar - kontoret fakturerar från Merförsäljning". Fältmiljö med dåligt nät är normalfallet, inte undantaget.
4. Provision: skapas ALDRIG automatiskt i modulflödet (beslutat). Teknikern kryssar i provisionsgrundande via ärendet som vanligt.

Upphämtning UNDER kontrollrunda (tillagd 2026-08-31 efter Christians fråga om ordningen kontroll/borttag):
- Problemet med två separata vyer: kontrollen görs i StationInspectionModule, borttag i utrustningsvyn. Markerar teknikern stationen Borttagen FÖRE kontrollen försvinner den ur sessionens stationslista (listorna filtrerar status='active' och modulen re-synkar total_* vid laddning, StationInspectionModule :304-321) - då kan den inte längre kontrolleras, får ingen sista kontroll i rapporten och faktureras inte. Rätt ordning (kontrollera → hämta upp) ska inte vila på instruktion utan byggas in i UI:t:
- NY ÅTGÄRD i kontrollmodulen: på tilläggsstationens kontrollformulär finns knappen "Kontrollera + hämta upp" - sparar inspektionsraden OCH sätter stationens status till Borttagen i ett moment. Ett tryck, ordningen kan inte bli fel, ingen navigering till utrustningsvyn behövs. (Vanlig "Spara kontroll" finns kvar för stationer som ska stå kvar.)
- AVSLUTSVAKT: vid "Avsluta kontroll" varnas om det finns aktiva tilläggsstationer UTAN inspektionsrad i sessionen ("N tilläggsstationer är inte kontrollerade - kontrollera eller hämta upp innan avslut"). Avslut blockeras inte, men teknikern gör ett informerat val.
- Utrustningsvyns borttagsflöde finns kvar (t.ex. upphämtning utanför kontrollrunda), men under en runda är kontrollmodulen huvudvägen.

Vikarie-fallet (verifierat): tekniker som inte är tilldelad ärendet kan skriva `contract_billing_items` men inte läsa tillbaka dem → fakturagenereringen får 0 rader och kastar; raderna ligger kvar ofakturerade med toast (inget tyst intäktstapp). Åtgärd: sätt sessionens tekniker som `secondary_technician_id` på ärendet före kedjan, så blir både läsning och ev. framtida provision giltiga.

RLS-testning: hela etapp 6 testas inloggad som tekniker (skapa-och-läs-tillbaka), enligt repots kända fälla.

## Ordning och beroenden

Etapp 1 → 2 → (3 och 4 parallellt) → 5 → 6. Etapp 3 kan levereras fristående tidigt (direkt teknikernytta) så länge etapp 2:s fält finns i formulären.

## Beslutspunkter - AVGJORDA av Christian 2026-08-31

1. Provision: ALDRIG automatisk. Hanteras som vanligt per ärende - teknikern kryssar själv i provisionsgrundande. Modulflödet skapar inga provisionsposter.
2. Etableringsfakturering: teknikerns "Färdig med etablering" visar faktureringssammanfattning och fakturerar direkt vid total > 0; vid 0 kr stängs ärendet utan faktureringsinfo (se etapp 5.3).
3. 0-pris: raden skapas som synligt underlag men ingen faktura genereras när totalen är 0; varningstoast om pris saknas (se etapp 6, förifyllnad punkt 4).

## Kända risker efter granskning

- Dubbelfaktureringsskyddet vilar på pending-filtret i `createAdHocItemsFromCase` + 'all'-vakten. Ingen DB-constraint finns. Framtida ändringar av statusflödet på `case_billing_items` kan bryta skyddet tyst.
- Antal ändrat mellan avslut när raden redan är billed: mellanskillnaden faktureras inte automatiskt, bara toast. Accepterad manuell hantering.
- readOnly-lyftet öppnar radredigering på ALLA etableringsärenden (beteendeförändring).
- `contract_id` på placering auto-resolvas till första aktiva avtalet (TechnicianEquipment.tsx:317-329); för multikontraktkunder kan tilläggsstationer peka på fel avtal. Ingen ändring i denna plan, känd begränsning.
- FEV-datastäd (dubblettkund, stationer på rätt enhetsrad) är go-live-krav för korrekt räkning.
