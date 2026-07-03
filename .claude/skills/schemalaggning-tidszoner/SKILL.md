---
name: schemalaggning-tidszoner
description: Schemaläggning, kalender och tidszonshantering i BeGone Kundportal. Använd vid ändringar i CoordinatorSchedule, TechnicianSchedule, recurringScheduleService, inspectionDateGenerator, dateHelpers, swedishHolidays, tabellerna recurring_schedules/station_inspection_sessions/technician_absences, api/ruttplanerare, api/cron/extend-recurring-schedules, api/schedule-optimizer, work_schedule, FullCalendar, drag & drop, bokningsassistent, timezone/scheduling/calendar/recurring visits/timestamptz.
---

# Schemaläggning, kalender och tidszonshantering

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `src/pages/coordinator/CoordinatorSchedule.tsx` | Det ROUTADE koordinatorschemat (egenbyggd grid, INTE FullCalendar) |
| `src/components/coordinator/schedule/` | Gridens byggstenar: `scheduleConstants.ts` (px/timmar/snap), `scheduleUtils.ts` (positionsmatte, lanes), `TimeGridRow.tsx` (drag & drop, `xToTime`) |
| `src/pages/technician/TechnicianSchedule.tsx` | Teknikeragenda; FullCalendar används bara som datumväljare/kapacitetsöversikt |
| `src/services/recurringScheduleService.ts` | Livscykel för återkommande scheman: skapa, boka om, avboka, konfliktkälla `fetchTechnicianBookings` |
| `src/utils/inspectionDateGenerator.ts` | Klientens datumgenerator (röda dagar, work_schedule, frånvaro, luckletning). Ren funktion |
| `src/utils/dateHelpers.ts` | `toLocalISOStringWithOffset` (:30, korrekt), `toSwedishISOString` (:13, FELKÄLLA vid skrivning), `fromDatabaseDate` (:52) |
| `src/utils/swedishHolidays.ts` | Röda dagar inkl. Meeus-påsk; jul-/nyårs-/midsommarafton avsiktligt röda |
| `api/ruttplanerare/assistant-utils.ts` | Delad motor för boknings-/återbesöks-/teamassistent; korrekt DST via `fromZonedTime` |
| `api/cron/extend-recurring-schedules.ts` | Daglig förlängning 04:00; förenklad generator med kända buggar (se Fallgropar) |
| `api/schedule-optimizer/analyze.ts` | Omfördelningsanalys för `ScheduleOptimizer.tsx` (läser BARA private+business, ej cases/sessions) |
| `src/styles/FullCalendar.css` | Rad 32: toolbaren dold GLOBALT; opt-in via `.fc-show-toolbar-wrapper` |

## Arkitektur

- **Tre schema-ytor**: koordinatorschemat (egen grid), teknikerschemat (agenda + FullCalendar-månadsvälare), ronderingsschema (`RonderingSchedulePage` + wizard). Plus två serverless-assistenter (`api/ruttplanerare/*`, `api/schedule-optimizer/analyze`).
- **Datamodell**: `recurring_schedules` (frekvens, `preferred_time` som `time`-kolumn utan tidszon — "HH:MM"-sträng i appen = svensk väggtid, `generated_until` som date) genererar par av `cases`-rad (status `Bokad`) + `station_inspection_sessions`-rad (med `case_id`). Koordinator/tekniker läser `cases`; kundportalen (`UpcomingVisits`, `InspectionSessionsView`) läser sessions.
- **Tidszonsmodell**: ALLA tidskolumner är `timestamptz`, DB-sessionen kör UTC. Postgres normaliserar till äkta instanter. Läsning sker via `new Date(str)` + `toLocaleTimeString('sv-SE')` i webbläsaren.
- **Konfliktdetektering** slår mot fyra källor: `private_cases` + `business_cases` (tre assignee-roller), `cases` (tre technician-roller), `station_inspection_sessions`. Mönstret finns i `fetchTechnicianBookings` (:207) och `assistant-utils.getSchedules` (:85).
- **Generatorn finns i TVÅ exemplar utan delad kod**: klientens `inspectionDateGenerator.ts` (fullfjädrad) och cronens `generateDatesSimple` (:169, förenklad). Delning mellan `src/` och `api/` sker bara via explicit whitelist i `tsconfig.node.json` (fyra src-filer, detaljer i skill dev-workflow); generatorn ingår inte. Api-projektet ska hållas typfelsfritt.

## Invarianter

1. **ALDRIG skriva en tidssträng utan offset/Z** till en tidskolumn. `toSwedishISOString` producerar naiv väggtid som Postgres tolkar som UTC, alltså 1-2 h fel. Använd `toLocalISOStringWithOffset` i nya flöden. `toISOString()` är instant-korrekt (samma lagrade värde) och lever i fungerande kod (drag & drop, `InspectionCaseModal`), men vissa rapport-/visningsvägar läser klockslaget rått, därav offset-konventionen (commit b00938f9).
2. **cases + sessions skapas och raderas i par** i klientflödet: case FÖRST (sessionen behöver `case_id`), vid radering sessions FÖRST (FK). Avbokning: cases till `'Borttaget'`, sessions till `'cancelled'`, aldrig hårt delete utom i `rescheduleExistingSessions` (:617).
3. **`generated_until` + `last_generated_at` måste uppdateras efter varje generering**, annars skapar cronen dubbletter. Dubblettskyddet jämför bara datumdelen av `scheduled_at`.
4. **Konfliktkoll mot alla fyra källor och alla tre teknikerroller**. Kopiera `fetchTechnicianBookings`/`getSchedules`, hitta inte på egen delmängd.
5. **Dagnyckel ur `Date`**: alltid `['sunday','monday',...][d.getDay()]`. Samma mönster på 6+ ställen, avvik inte.
6. **`preferred_time` betyder svensk väggtid** och blir korrekt bara i svensk tidszonskontext (webbläsare eller `fromZonedTime('Europe/Stockholm')` server-side). På Vercel är serverns tidszon UTC, `new Date(y,m,d,h,min)` är fel där.
7. **Ny FullCalendar-instans**: toolbaren är dold globalt; lägg `.fc-show-toolbar-wrapper` på wrappern om toolbar önskas.

## Vanliga uppgifter

**Ny ärendetyp (service_type) i schemat:**
1. `src/components/admin/coordinator/CreateCaseModal.tsx` (koordinatorschemats modal, inte customer-varianten): ny gren i submit (~:846) + `ScheduleHeader` `CaseType`-union (:14)
2. `pages/coordinator/CoordinatorSchedule.tsx`: `adaptCaseToBeGoneRow` (:111, case_type-mappning) + `handleOpenCaseModal` (:345, modalroutning)
3. `TechnicianSchedule.tsx`: case_type-härledning (:319) + `handleOpenModal` (:442)
4. `scheduleConstants.getStatusStyle` (:44) för färg

**Ändra konflikt-/lucklogik:** tre parallella implementationer måste hållas i synk: `inspectionDateGenerator.ts` (preview + skapande), `api/cron/extend-recurring-schedules.ts` (förlängning), ev. `api/ruttplanerare/assistant-utils.ts`.

**Ny röd dag:** bara `swedishHolidays.ts`, men cronen använder den INTE (bara helger). Vill du ha röda dagar i cron måste logiken porteras dit manuellt.

**Ändra grid-layout:** konstanter i `scheduleConstants.ts`, positionsmatte i `scheduleUtils.ts`, drop-tid i `TimeGridRow.xToTime`/`WeekGridView.yToTime`. Håll `SNAP_MINUTES` synkat mellan dem.

## Fallgropar

- **Levande skrivbuggar med `toSwedishISOString`** (naiv väggtid till timestamptz, 1-2 h fel): `RevisitModal.tsx:241-242`, `RonderingCaseModal.tsx:157-158`, `RevisitContractModal.tsx:183-184`, `EditCaseModal.tsx:1023` och `EditContractCaseModal.tsx:1059` (`completed_date`, kan tippa ärenden i fel provisionsmånad vid månadsskifte). Kopiera INTE dessa mönster.
- **Cronens UTC-bugg**: `extend-recurring-schedules.ts:212` bygger tiden med `new Date(y,m,d,prefH,prefM)` på UTC-server, alltså driftar cron-förlängda serier 1-2 h mot klientgenererade. Korrekt förlaga: `assistant-utils.buildDailySchedules` (:373) med `fromZonedTime`.
- **Cron skapar bara sessions, INTE cases** (:113-132). Cron-förlängda besök syns i kundportalen men är osynliga i koordinator- och teknikerschemat. Klientflödet (`createCaseAndSession` :503) skapar paret.
- **cases och sessions synkas inte vid flytt**: `handleCaseMoved` (`CoordinatorSchedule.tsx:389`, cases-uppdateringen :430-441) och `InspectionCaseModal` (:271, update :283) uppdaterar bara `cases.scheduled_start/end`; den länkade sessionen behåller gammal tid och kunden ser fel i portalen. (Kontext: 2 h-diffar verifierade i produktions-DB, juni 2026.)
- **Fönsterfiltret missar överlapp**: `fetchTechnicianBookings` (:221-279) filtrerar på att STARTEN ligger i fönstret; en bokning 30 juni-2 juli syns inte i ett fönster som börjar 1 juli. Frånvarohämtningen (:308) använder `.or(start_date.lte...,end_date.gte...)` och missar inga överlapp (den över-hämtar snarare).
- **Död kod som lurar**: `src/components/admin/coordinator/CoordinatorSchedule.tsx` + `ScheduleTimeline.tsx` (gammalt schema, inte routat, filhuvudet ljuger om sökvägen), `pages/coordinator/BookingAssistant.tsx` (routen pekar på `ScheduleOptimizer.tsx`), `extendScheduleIfNeeded` (:719) och `validateWorkSchedule` (`database.ts:1350`) saknar anropare. `WorkScheduleEditor` sparar HELT utan validering.
- **Teknikerschemat visar avtalsärenden bara för primär tekniker** (`.eq('primary_technician_id', ...)` :295); koordinatorschemat visar alla tre roller. Känd asymmetri.
- **Avsiktligt, rör inte**: force-placering med `hasConflictWarning` i generatorn (:350-360, hellre dubbelbokning att flytta än tyst uteblivet besök); jul-/nyårs-/midsommarafton som röda dagar; rå DOM för `.day-selected` och scroll-synk i teknikerschemat (prestanda/FullCalendar-interop, commit 8e83de4e); `setUTCHours(12)`-tricket vid dagbyten i `TechnicianSchedule` (:507, :598) som skyddar mot off-by-one eftersom `toDateString` (:38) ger UTC-datum.
- Default-arbetstid är inkonsekvent: generator 07-17, `DEFAULT_WORK_SCHEDULE`/analyze.ts 08-17, `getTechWorkHours` 8 h. Anta ingen gemensam default.
- Batch-läge i `RecurringScheduleWizard` (`src/components/technician/RecurringScheduleWizard.tsx:321-343`): bara första enheten får full konfliktalgoritm, resten kedjas efter föregående sluttid samma dag. Avsiktligt.
- `CreateCaseModal` med typ inspection skapar sessionen UTAN `scheduled_end` (sessionData :919-928 saknar fältet; jämför `createCaseAndSession` som sätter det).

## Riktning

Dagens läge har fyra kända skulder värda att betala av. Skillens invarianter ska inte hindra dessa fixar, tvärtom.

1. **Deprecatera `toSwedishISOString` i skrivvägar** (dagens läge: fem levande felskrivningar, se Fallgropar). Målbild: byt till `toLocalISOStringWithOffset`, märk funktionen `@deprecated` för allt utom läs/visning, städa redan felskrivna DB-rader med engångs-SQL. Låg risk; verifiera att ett 08:00-återbesök lagras som `06:00Z` sommartid.
2. **Rätta cronens tidszonsbygge** med `fromZonedTime('Europe/Stockholm')` (date-fns-tz finns redan i api-projektet) och gör 17-gränsen (:228) tidszonsmedveten. Passa på att porta röda dagar. Dubblettskyddet påverkas inte (jämför bara datumdel).
3. **Synka sessions när länkat case flyttas**: hjälpfunktion `syncSessionTimesForCase(caseId, start, end)` som uppdaterar `scheduled_at/scheduled_end` för `status='scheduled'`, anropad från `handleCaseMoved` och `InspectionCaseModal`. No-op för cases utan session. Rör inte `cancelled`-sessions och krocka inte med `rescheduleExistingSessions` som raderar/återskapar par.
4. **Byt fönsterfiltret till äkta överlapp** (`.lte('start_date', to)` + `.gte('due_date', from)`) i `fetchTechnicianBookings`, `getSchedules` och cronens bokningshämtning. Fler träffar gör bara förslagen försiktigare.

Långsiktig målbild för generatorerna: en delad, testbar modul i stället för tre parallella implementationer. Delning är tekniskt möjlig redan i dag — lägg modulen i `tsconfig.node.json`-whitelisten (mönstret finns: `src/types/database.ts` konsumeras av `api/technician/dashboard.ts`). Tills en sådan modul byggts gäller regeln att ändringar porteras till alla tre (se Vanliga uppgifter).
