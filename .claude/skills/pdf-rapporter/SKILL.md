---
name: pdf-rapporter
description: PDF-generering i BeGone Kundportal - saneringsrapporter, ärenderapporter, kontrollrapporter/egenkontroll, ronderingsrapporter och interna beslutsdokument. Använd vid ändringar i src/utils/pdfReportGenerator.ts, src/utils/ronderingPdfGenerator.ts, src/utils/equipmentPdfGenerator.ts, src/lib/pdf-generator.ts, src/hooks/useWorkReportGeneration.ts, src/hooks/useModernWorkReportGeneration.ts, api/generate-pdf.ts, api/generate-case-report-pdf.ts, api/generate-inspection-report-pdf.ts, api/generate-work-report.ts, api/generate-multisite-pdf.ts, api/send-work-report.ts, tabellen sanitation_reports, jsPDF, Puppeteer, @sparticuz/chromium, gen-*.mjs-skripten för interna dokument.
---

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `src/utils/pdfReportGenerator.ts` | Klient-jsPDF, äldsta "Saneringsrapport"-mallen, anropas av `CaseDetailsModal.tsx` |
| `src/utils/equipmentPdfGenerator.ts` | Klient-jsPDF, "Utrustningsplacering" - **död kod, 0 anropare** |
| `src/utils/ronderingPdfGenerator.ts` | Klient-jsPDF, rondering/egenkontroll-periodrapport (Trafikkontoret), fristående spår |
| `src/utils/statisticsUtils.ts` | `exportStatisticsToPDFLegacy` (rad 277), jsPDF-fallback när `hostname === 'localhost'` (rad 150-156), annars `/api/generate-pdf`. Används av både `CustomerStatistics.tsx` och `MultisiteCustomerStatistics.tsx` |
| `src/lib/pdf-generator.ts` | Delad HTML-mall (`generateWorkReportHTML`), används av två serverless-endpoints |
| `src/hooks/useWorkReportGeneration.ts` | "Klassisk" rapport-hook → `/api/generate-work-report`, sparar till `sanitation_reports` |
| `src/hooks/useModernWorkReportGeneration.ts` | "Trafikljus"-hook → `/api/generate-case-report-pdf`, sparar till `sanitation_reports` |
| `api/generate-pdf.ts` | Kund/multisite-statistikrapport, Puppeteer, `requireAuthenticated` |
| `api/generate-case-report-pdf.ts` | Ärenderapport med trafikljussystem, Puppeteer, **ingen auth** |
| `api/generate-inspection-report-pdf.ts` | Kontrollrapport/Avtalat Servicebesök + satellitkarta + planritning, Puppeteer, **ingen auth** |
| `api/generate-work-report.ts` | Tunn wrapper runt `src/lib/pdf-generator.ts`, CORS `*`, ingen auth |
| `api/generate-multisite-pdf.ts` | Organisationsrapport, `requireAuth(['admin'])` - **död endpoint, ingen UI-anropare** |
| `api/send-work-report.ts` | Genererar via `src/lib/pdf-generator.ts` och mailar (Nodemailer/Resend) |
| `src/services/inspectionReportService.ts` | Anropar `/api/generate-inspection-report-pdf` (rad 102) OCH äger Excel-exporten (ExcelJS) för samma kontrollrapport-data |
| `gen-behovsanalys.mjs` m.fl. i repo-roten | Interna beslutsdokument (ISO/ledningssystem), separat spår, se dokumentstandard-interna.md |

## Arkitektur

Tre helt separata generationsspår som inte delar kod:

- **Spår A - klient-jsPDF**: körs i webbläsaren, bygger PDF direkt med `jspdf`-biblioteket, manuell sidbrytning.
- **Spår B - server-Puppeteer**: Vercel serverless + `@sparticuz/chromium`, HTML→PDF via `page.pdf()`. Boilerplaten (`puppeteer.launch` → `setContent` → `page.pdf` → `browser.close`) är kopierad på fem ställen utan delad helper: `generate-pdf.ts:705`, `generate-case-report-pdf.ts:1050`, `generate-inspection-report-pdf.ts:830`, `generate-multisite-pdf.ts:767` och `src/lib/pdf-generator.ts:774` (den sista delas av `generate-work-report.ts` + `send-work-report.ts`).
- **Spår C - interna dokument**: `gen-*.mjs`-skript, puppeteer-core mot **lokal Chrome** (hårdkodad sökväg, fungerar bara lokalt), ingen databaskoppling, körs manuellt. Se `dokumentstandard-interna.md` för stil/logotyp-regler - rör inte det spåret här.

**Triple-redundans i ärenderapport-flödet**: samma sorts rapport ("saneringsrapport för ett ärende") kan genereras via tre olika vägar som alla skriver till `sanitation_reports` men med olika datamodeller:

1. `pdfReportGenerator.ts` (klient-jsPDF) - sparar **ingenting** till databasen, bara `pdf.save()` i browsern.
2. `useWorkReportGeneration.ts` → `/api/generate-work-report` → `pdf-generator.ts::generateWorkReportHTML` - sparar till `sanitation_reports`.
3. `useModernWorkReportGeneration.ts` → `/api/generate-case-report-pdf` → `generateSingleCaseHTML` - sparar till `sanitation_reports`, lägger även till `pest_level`/`problem_rating` (trafikljus).

Väg 2 och 3 är ~85% identisk kod i hooksen (`saveReportToDatabase`, `hasRecentReport`, `getTimeSinceReport`, `base64ToBlob`).

## Invarianter

- **ALDRIG anta att UI-knappen "Generera rapport" pekar på en enda mall** - avgör alltid via anropskedjan (modal → hook → endpoint) vilken av de tre vägarna som faktiskt körs, annars ändras fel fil och inget syns i produktion.
- **ALDRIG flytta `puppeteer.launch()` i `generate-inspection-report-pdf.ts` till efter HTML-genereringen** - browser-instansen måste finnas FÖRE `generateInspectionReportHTML(...)` anropas, eftersom samma browser återanvänds för att rendera satellitkarta och planritning som separata sidor och skickas in som parameter (rad 847). Kommentar i filen (rad 829) säger detta explicit.
- **ALDRIG byt satellitkarta till Google Static Maps API** i `generate-inspection-report-pdf.ts` - Static API blockerar satellitvy i EU/EEA (verklig Google-begränsning, inte kodfel). Puppeteer-sidan med Maps JS API är den medvetna lösningen.
- **ALDRIG visa priser i ärenderapporter** - `case_billing_items` hämtas bara för `article_name, quantity` (+ `article_code` i hooken), aldrig pris (kommentar i `useWorkReportGeneration.ts:118`, samma mönster i `generate-case-report-pdf.ts:1023-1027`).
- Dagens läge: `api/generate-case-report-pdf.ts` och `api/generate-inspection-report-pdf.ts` saknar auth helt och `generate-case-report-pdf.ts` använder service-role-nyckel för uppslag från ett okontrollerat `case_id` i request body. Detta är en känd säkerhetslucka, inte ett avsiktligt mönster - lägg **inte till fler** endpoints med samma brist när du bygger nytt; nya PDF-endpoints ska ha `requireAuthenticated` från start (jämför `api/generate-pdf.ts`).

## Vanliga uppgifter

**A. Lägg till/ändra ett fält i ärenderapport (kundportal)**
Avgör först vilken väg UI-knappen använder. Troligast väg 3 (trafikljus): ändra `generateSingleCaseHTML` i `api/generate-case-report-pdf.ts` OCH `createModernReportData` i `useModernWorkReportGeneration.ts`. Ska ändringen synas i teknikerns vy (väg 2) också: uppdatera även `pdf-generator.ts::generateWorkReportHTML` + `useWorkReportGeneration.ts::createReportData`. Glöm inte att kolla alla tre.

**B. Ändra kontrollrapport/egenkontroll-PDF**
Rör både `api/generate-inspection-report-pdf.ts` (PDF) och `src/services/inspectionReportService.ts` (Excel) - samma fil äger Excel-formatet men statuslogiken (`getStatusLabel`/`statusFill` i service vs `getStatusColor`/`getStatusLabel` i API) är dubblerad och hålls manuellt i synk.

**C. Ändra rondering-periodrapport (Trafikkontoret)**
Bara `src/utils/ronderingPdfGenerator.ts` + `src/pages/admin/RonderingPage.tsx` (bygger `RonderingPdfCase[]`/`RonderingPdfEkVisit[]`). Fristående spår, påverkar inget annat.

**D. Byta logotyp/färgpalett i kundrapporter**
Ingen delad konstant finns. Måste ändras separat i minst: `beGoneColors` i `pdfReportGenerator.ts` (rad 53) och `equipmentPdfGenerator.ts` (rad 31), konstanten `C` i `ronderingPdfGenerator.ts` (rad 8, kortare variant), samt inline-hex (`#20c58f` m.fl.) i HTML-mallarna i `generate-case-report-pdf.ts`, `generate-inspection-report-pdf.ts` och `src/lib/pdf-generator.ts`.

## Fallgropar

- `calculateOptimalTextWidth` i `pdfReportGenerator.ts` (rad ~118-126) kompenserar manuellt för att jsPDF underskattar textbredd. Ändra inte `compensationFactor` utan att testa mot lång svensk brödtext - text sticker annars ut ur korten.
- Manuell sidbrytning (`if (yPosition > pageHeight - N) {...}`) med olika magiska tal (40/60/80/100/140) upprepas i varje sektion i de tre jsPDF-filerna. `ronderingPdfGenerator.ts` har åtminstone en `checkPageBreak(needed)`-helper (rad ~116-121); de andra två saknar det.
- `formatAddress()` är kopierad tre gånger med små ordningsskillnader: `pdfReportGenerator.ts:146-210`, `pdf-generator.ts:111-146`, inline i `send-work-report.ts:10-55`. Ändrar du adressformatet i en, glöm inte de andra.
- `equipmentPdfGenerator.ts` har en genomtänkt typ-fallback-kedja (`resolveTypeDisplay`, rad ~15-28: `station_type_data` → legacy engelsk konfig → rå textsträng) men filen har **0 anropare** - bekräftat via grep, ingen produktionskod importerar `generateEquipmentPdf`.
- `ronderingPdfGenerator.ts` renderar portrait A4 medan `generate-inspection-report-pdf.ts` kör `landscape: true` (rad ~857) för näraliggande innehåll - två system, ingen delad logik, ingen anledning att de måste matcha men lätt att bli förvirrad vid jämförelse.
- `case_images`-filtret i `generate-case-report-pdf.ts` (rad 998-1003) hanterar bara `case_type='contract'`, trots att `case_type` har tre möjliga värden (`private_case`/`business_case`/`contract`, se `sanitationReportService.ts:6`). Samma hårdkodade contract-filter ligger på `case_preparations` (rad 1020) och `case_billing_items` (rad 1027).
- Versionsfälten på `sanitation_reports` (`is_current`, `version`, `replaced_at`, `replaced_by`) sätts **inte** av `sanitationReportService.ts` vid ny insert - troligen DB-trigger. Verifiera i databasen innan du ändrar sparlogiken, annars kan gamla rapporter felaktigt förbli markerade som aktuella.

## Riktning

Dagens läge har tre parallella ärenderapport-vägar och två döda filer - det är inte målbilden, bara historik från stegvis påbyggnad (trafikljussystemet lades till som ett nytt spår istället för att ersätta det gamla).

1. **Ta bort dödkod**: `src/utils/equipmentPdfGenerator.ts` (0 anropare, bekräftat) och `api/generate-multisite-pdf.ts` (kommentaren i filen säger själv "Död endpoint utan UI-anropare"). Verifiera med en sista global grep innan borttagning, fråga om equipmentPdfGenerator var tänkt för en snar UI-funktion.
2. **Lägg till auktorisering** på `api/generate-case-report-pdf.ts` och `api/generate-inspection-report-pdf.ts` (t.ex. `requireAuthenticated`, samma nivå som `generate-pdf.ts`). Detta är den enda punkten här som är ett faktiskt säkerhetshål, inte bara teknisk skuld - `generate-case-report-pdf.ts` slår upp kunddata/bilder via service-role-nyckel utifrån ett okontrollerat `case_id`. Kräver samtidig uppdatering av anropande hooks (skicka Authorization-header), gör som egen testad PR.
3. **Slå ihop de två rapport-hooksen**: bryt ut delad `saveReportToDatabase`/historik-logik från `useWorkReportGeneration.ts` och `useModernWorkReportGeneration.ts` till en gemensam persistence-hook, så en bugfix i t.ex. `customer_id`-fallback bara behöver göras en gång. Låt varje "byggare" (klassisk/trafikljus) bara ansvara för request-body, delegera sparning.
4. **Bryt ut delad `formatAddress()` + färgpalett** till en modul importerbar från både klient- och serverless-kod (samma mönster som `pdf-generator.ts` redan delas mellan två API-endpoints). Ren mekanisk refaktor, gör isolerat från funktionsändringar och jämför minst en PDF per spår visuellt efteråt.

Målbild: en rapportmotor per rapporttyp (ärenderapport, kontrollrapport, rondering), inte en per historisk implementation av samma rapporttyp.
