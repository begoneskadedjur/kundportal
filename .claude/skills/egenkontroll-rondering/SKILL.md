---
name: egenkontroll-rondering
description: Egenkontroll, rondering, inspektioner och stationer i BeGone Kundportal. Använd vid ändringar i inspectionSessionService, ronderingService, egenkontrollService, indoorStationService, equipmentService, floorPlanService, stationTypeService, StationInspectionModule, RonderingPage, EgenkontrollCaseModal, RonderingCaseModal, MultisiteEgenkontrollView, tabellerna station_inspection_sessions/outdoor_station_inspections/indoor_station_inspections/rondering_station_logs/rondering_annotations/egenkontroll_templates/egenkontroll_questions/egenkontroll_station_reviews/egenkontroll_review_answers/equipment_placements/indoor_stations/station_types/preparations/customer_regions, kontrollrapport, planritningar, stationskontroll, inspection sessions, station inspection, self-inspection, pest stations, floor plans, bait stations.
---

# Egenkontroll, rondering, inspektioner och stationer

TRE delsystem som delar stationsdata. Namnen lurar: admin-sidan `/admin/egenkontroll` (`EgenkontrollPage.tsx`, bara en tab-wrapper) visar BÅDE ronderings- och egenkontrolldata via `RonderingPage`.

| Delsystem | `cases.service_type` | Datatabeller | Utförs av |
|---|---|---|---|
| A. Stationskontroll (sessioner) | `inspection` | `station_inspection_sessions`, `outdoor/indoor_station_inspections`, `inspection_session_photos` | Tekniker via `/technician/inspection/:caseId` |
| B. Rondering Trafikkontoret | `rondering_trafikkontoret` | `rondering_station_logs`, `rondering_annotations` | Tekniker/koordinator via `RonderingCaseModal` |
| C. Egenkontroll Trafikkontoret | `egenkontroll_trafikkontoret` | `egenkontroll_templates/questions/station_reviews/review_answers` (delar `rondering_annotations` med B) | Koordinator via `EgenkontrollCaseModal` (`src/pages/coordinator/CoordinatorSchedule.tsx:353`) |

Gemensam stationsdata: `equipment_placements` (utomhus, GPS, `serial_number`) och `indoor_stations` (procentposition på `floor_plans`, autogenererat `station_number`), typade via `station_types` (datadrivet: code, prefix, färg, trösklar, `threshold_source`). Mätserier i `station_measurements` (indoor XOR outdoor FK). `customer_regions.geojson_polygon.coordinates[0]` är `[lng, lat]`, RonderingPage rad 624-625 vänder till `{lat, lng}`.

## Nyckelfiler
- `src/services/inspectionSessionService.ts` - delsystem A, funktionsexporter. Felstil: console.error + return null/[] (anropare MÅSTE null-checka). B/C-services kastar i stället - blanda inte ihop stilarna när du wrappar.
- `src/services/ronderingService.ts` - `ANNOTATION_CATEGORIES` (rad 34) lever ENDAST i frontend, DB-kolumnen `category` saknar CHECK. `logStation` (rad 55) sväljer 23505 avsiktligt (idempotens mot UNIQUE(case_id, station_id)).
- `src/services/egenkontrollService.ts` - statisk klass. Mallkedja: kundens org-mall → global mall. `createTemplateForOrganization` (rad 135) KLONAR globala frågorna, senare ändringar propagerar inte.
- `src/services/indoorStationService.ts` - `createStation` (rad 194) skriver bara textkoden, aldrig `station_type_id`. `getStationPhotoUrl` (rad 567): bucket väljs på path-prefix (`indoor/`/`outdoor/` → `inspection-photos`, annars `indoor-station-photos`).
- `src/services/equipmentService.ts` - utomhus. `deleteEquipment` (rad 291) verifierar radering via select (RLS blockerar annars tyst).
- `src/services/floorPlanService.ts` - `replaceFloorPlanImage` byter bara bilden, stationer bevaras. `deleteFloorPlan`: stationer raderas via DB CASCADE. Laddar upp RÅFIL (alla foto-vägar komprimerar till WebP, denna inte).
- `src/services/recurringScheduleService.ts` - `createCaseAndSession` (rad 503): case FÖRST, sedan session.
- `src/pages/admin/RonderingPage.tsx` (1895 rader) - HELA månadsrapporten B+C: dedupe per region+månad (rad 94), DBSCAN-riskzoner eps 250 m (funktionen rad 114 har default eps 400 — anropet rad 721 skickar 250/minPts 4), hotspots = ≥2 månader `bait_consumed='all'` i rad, klientside Google-geocoding.
- `src/pages/technician/StationInspectionModule.tsx` (2737 rader) - teknikerflödet A. Re-synkar `total_*` mot faktiskt stationsantal vid varje laddning (rad 304-321).
- `src/components/organisation/MultisiteEgenkontrollView.tsx` - kundportalens historik. Splittar case-bilder på description-prefix (rad 112-121). Laddar mallen från `siteIds[0]` enbart - håller så länge mallar är per organisation.
- `src/components/admin/coordinator/CreateCaseModal.tsx:886-937` - skapar inspection-case + session; sessionsfelet är icke-fatalt → case utan session ger "Ingen inspektionssession hittades" hos teknikern.
- Stationstyps-admin: `StationTypesSettings.tsx`/`StationTypesPage.tsx`/`StationTypeEditModal.tsx` (ingen fil heter "StationTypesManager").
- PDF: kontrollrapport A = `inspectionReportService.ts` + `api/generate-inspection-report-pdf.ts` (Puppeteer, server). Ronderingens månads-PDF = `src/utils/ronderingPdfGenerator.ts` (jsPDF, klient) + `RonderingPage.handleExportPdf` (rad 947-1031). Blanda inte ihop.
- `src/hooks/useInspectionStatusLabels.ts` - etiketter från DB-tabellen `inspection_status_labels`, remappar legacy `ok`→`none`, `activity`→`medium` (display-only).

## Arkitektur
- **A (livscykel):** case FÖRST (status `'Bokad'`) → session med `case_id` + frysta `total_*` → `in_progress` → per station upsert med FRYST auto-beräknad status → `completed` → `cases.status='Avslutat'`. Reopen = `in_progress` + `completed_at=null`. Sessioner skapas via direkta inserts (CreateCaseModal, recurringScheduleService, samt `api/cron/extend-recurring-schedules.ts` som skapar sessions UTAN case - känd bugg, se skill schemalaggning-tidszoner) - `createInspectionSession` i servicen anropas av ingen. `getCompletedSessionsForCustomer` inkluderar AVSIKTLIGT `in_progress` (återöppnade sessioner ska synas i kundportalen).
- **B:** en logg per (case, station), DELETE = avbockning. Delbesök har `parent_case_id` och läser/skriver mot `caseData.parent_case_id ?? caseData.id` (RonderingCaseModal rad 378, 474) så flera delbesök ackumulerar mot originalärendet.
- **C:** `ensureReview` (eller `addStation`) MÅSTE köras före `upsertAnswer` (FK-brott annars). yes_no är TRESTATUS: null = ej kontrollerad, true = godkänd, false = avvikelse (`countFailed`). Kartavvikelser delar `rondering_annotations` med B; RonderingPage taggar `source: 'rondering'|'egenkontroll'` per ärendetyp.
- **Bild-tagging (load-bearing konvention):** B/C-bilder går via `CaseImageService.uploadCaseImage(caseId, 'contract', ...)` där `description`-prefixet är nyckeln: `egenkontroll:{station_id}` respektive `annotation:{annotation_id}`. Läsning = hämta alla case-bilder, filtrera på prefix.
- **DB-triggern** `update_inspection_session_progress` räknar om `inspected_*` med COUNT(*); frontend inkrementerar OCKSÅ (StationInspectionModule rad 1079-1099). Redundant men konvergent - lita på DB-värdet, rör inte konstruktionen.
- Teknikern får egenkontroll-cases som vanligt `'contract'`-ärende (`TechnicianSchedule.tsx:320-323` saknar mappning) - ser buggigt ut men egenkontroll är designat för koordinatorn.

## Invarianter
- **Migrationsmappen `supabase/migrations/` är INTE schemakällan.** Flera tabeller/kolumner (rondering-tabellerna, `inspection_status_labels`, `station_measurements` m.m.) applicerades direkt mot remote. Verifiera ALLTID mot live-DB (`rfyufytjwvqiqwueinoj`) via MCP innan migration.
- **ALDRIG session före case** i delsystem A - sessionslösa inspection-cases är trasiga för teknikern.
- **Utförandetider** (`inspected_at`, `measured_at`, `started_at`, `completed_at`) skrivs med `toLocalISOStringWithOffset()` från `dateHelpers.ts`, aldrig rå `toISOString()` (commit b00938f9). SCHEMATIDER från redan korrekta Date-instanser använder legitimt `.toISOString()`. Egenkontrollens `reviewed_at` + alla `updated_at` är UTC-Z - befintligt undantag, migrera läsvägarna (RonderingPage rad 1738) om du ändrar.
- **Ny läskod för stationstyper MÅSTE implementera typesByCode-fallbacken**: FK-join `station_types!station_type_id`, fallback `Map(code → type)` mot textkoden. Dagens läge kräver detta eftersom skrivvägarna aldrig sätter FK:n; målbilden (Riktning §2) är FK + backfill, då centraliseras fallbacken.
- **Skriv aldrig om FRYST status i sparade inspektionsrader** - tröskeländringar i efterhand ska inte ändra historik; summeringar räknar om från `measurement_value`, skillnaden är avsiktlig.
- **RLS är `authenticated USING (true)` överallt** - medvetet parkerat till säkerhetsplanens fas 3-4. Strama inte åt piecemeal, det knäcker kundportalens läsvägar (teknikernamn-workarounden i `getCompletedSessionsForCustomer` rad 209-224 finns just därför).
- `preparations.station_type_ids` innehåller `station_types.id`, INTE code.
- Rör inte: de 9 legacy-boolean-kolumnerna på `egenkontroll_station_reviews` (ersatta av frågesystemet, läses inte), `logStation`s 23505-svälj, `getCaseSummary` som returnerar `total: 0` (anroparen fyller i).

## Vanliga uppgifter
**Ny svarstyp i egenkontroll:** migration (CHECK på `egenkontroll_questions.answer_type` + ev. värdekolumn, mönster i `20260624_egenkontroll_answer_types.sql`) → typer i egenkontrollService → input-UI i `EgenkontrollCaseModal` → visning på TRE ställen: `MultisiteEgenkontrollView.tsx:385-440`, `RonderingPage.tsx:1703-1721` OCH `answerLines` i `handleExportPdf` (RonderingPage:1009-1020) → frågebyggaren `EgenkontrollSettingsPage.tsx`.

**Ny avvikelsekategori:** lägg bara till i `ANNOTATION_CATEGORIES` (ronderingService:34) + typunionen rad 19. Ingen DB-ändring. Okända kategorier fallbackar till `trash_bins`-stil på kartan.

**Nytt fält på inspektionsraden (A):** typ i `inspectionSession.ts` → BÅDA create-funktionerna OCH BÅDA update-grenarna i upsert (4 ställen i inspectionSessionService) → formuläret i StationInspectionModule → ev. `InspectionSessionsView`.

**Ny stationstyp:** ren admin-UI-operation via StationTypesSettings, helt datadrivet. Koppla preparat via `preparations.station_type_ids` (id, inte code).

## Fallgropar
1. **Ingen DB-unik på (station_id, session_id)** i inspektionstabellerna - upsert-skyddet är klientside select-then-write (rad 725/957); dubbelklick ger dubbletter som blåser upp räknare (triggern kör COUNT(*)) och dubbelräknar summeringen.
2. **Tröskellogiken finns i TRE divergerade kopior**: `types/indoor.ts:143` (0 → 'none'), `inspectionSessionService.ts:333` (0-hantering hos anroparna, rad 281/307), `types/stationTypes.ts:200` (0 passerar in: med `threshold_direction:'below'` blir 0 "Kritisk" i portalen samtidigt som summeringen säger "none"). Ändra alla tre tillsammans, eller konsolidera (Riktning §3).
3. **0/null-divergens vid sparning:** StationInspectionModule:1070 skickar tomt mätfält som 0; `createOutdoorInspection` (rad 705) gör `|| null` (0 → null första sparningen) men update-grenen (rad 745) `?? null` (0 kvarstår vid re-sparning). Samma station får olika rådata beroende på antal sparningar.
4. **`upsertAnswer` bumpar `reviewed_at` FÖRE felkontrollen** (egenkontrollService:361-365) - misslyckat svar stämplar stationen som granskad; modalens optimistiska rollback rullar inte tillbaka `reviewed_at` i DB.
5. **`getLatestInspectionValuesForCustomer` typljuger**: deklarerar `'ok'|'warning'|'critical'` men får `'low'|'medium'|'high'`-strängar (inspectionSessionService:397, 425, 448) - jämförelser mot 'warning'/'critical' matchar aldrig.
6. **`deleteStationType`/`getStationCountsByType` räknar bara FK-referenser** (stationTypeService:219, 279) - typer som används via textkod kan raderas trots hundratals stationer, och visar count 0.
7. **`getEquipmentStats.byType` hårdkodar 3 legacy-typer** (equipmentService:459) → NaN för datadrivna koder; syns i `CustomerEquipmentSection`/`CustomerEquipmentMap`.
8. **Klientside-geocoding i RonderingPage** kräver laddad Google Maps - annars tyst adresslösa avvikelser, även i PDF:n.
9. **`getStationsByFloorPlan` har N+1** (3 queries per station, indoorStationService:28) - känd prestandaskuld.
10. `station_inspection_sessions.contract_id` finns med FK (multi-kontrakt fas 8a) men sätts aldrig av kod - däremot sätter `TechnicianEquipment.tsx:326-336` numera `equipment_placements.contract_id` (fas 8d). `egenkontroll_templates.organization_id` är löst UUID utan FK.
11. Inkonsekvent kundfilter: `floorPlanService.getCustomersWithFloorPlans` filtrerar `status='active'`, `equipmentService.getCustomersForDropdown` filtrerar `is_active=true`. Känt.
12. Type-check: `npm run type-check` (baseline-skript, inga NYA fel får tillkomma). `tsc --noEmit` mot rot-tsconfig är no-op.

## Riktning
Dagens läge beskrivs ovan; nedan är målbilder. Betala av opportunistiskt när du ändå rör respektive kodväg.

1. **Fixa felordningen i `upsertAnswer`** (fallgrop 4): flytta `if (error) throw` till direkt efter upserten så `reviewed_at` bara bumpas vid lyckad skrivning. Nästan riskfri omordning, hög nytta - granskad-stämpeln är kundvänd sanning i RonderingPage och MultisiteEgenkontrollView.
2. **Sätt `station_type_id` vid skapande + backfill + delad hjälpare**: backfilla via `station_types.code`, skriv FK:n i `createStation` och `TechnicianEquipment`-vägen, extrahera de ~9 inline-fallbackarna till en `resolveStationTypes()`-hjälpare (behåll code-fallbacken defensivt - kodlösa legacy-textkoder kan finnas). Då blir raderingsskyddet i `deleteStationType` korrekt. Uppdatera det att räkna via BÅDE FK och textkod tills backfillen är bekräftad.
3. **Konsolidera tröskellogiken till EN kanonisk funktion** (rimligen i `stationTypes.ts`) som returnerar nivån + explicit mappning nivå→ok/warning/critical, låt de andra två delegera, och fixa typlögnen (fallgrop 5). OBS: 0-semantiken för `direction:'below'` (betesvikt 0 = allt uppätet?) är ett produktbeslut, inte ett tyst default. Rör inte frysta statusar i sparade rader.
4. **DB-unik + riktig upsert på inspektionstabellerna**: dedupe-SQL först (behåll senaste `inspected_at`), sedan `UNIQUE (station_id, session_id) WHERE session_id IS NOT NULL`, sedan `.upsert(onConflict)` i upsertOutdoor/IndoorInspection, och normalisera tomt mätfält till null i BÅDA create-vägarna (fallgrop 1 + 3). Verifiera constraint-läget mot live-DB först, inte migrationsmappen.
