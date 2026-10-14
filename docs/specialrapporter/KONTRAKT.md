# Specialrapporter: kontrakt mellan databas/tjänst och gränssnitt (3.50.0, uppdaterat 3.51.0)

Godkänd skiss: https://claude.ai/artifact/4trQgTPQZJBTM45aofwoJN (lokala källfiler i sessionens scratchpad, se uppdraget).
Typer: `src/types/specialReport.ts` (gemensam, ändras bara i samförstånd).

## Beslut
- En specialrapport hör alltid till ett ärende (`case_id` + `case_type` = `contract` → `cases`, `private` → `private_cases`, `business` → `business_cases`).
- Åtkomst: admin, koordinator och tekniker som är primär, sekundär eller tertiär på ärendet. Skaparen behåller åtkomst.
- Leverans: bara mejl (och nedladdning). Ingen kundportal.
- Ordval i gränssnittet (3.51.0): en sektion heter **del** överallt där användaren ser det ("Lägg till del", "Ta bort delen", "Typ av del", "Rapportens delar"). Försättssidan heter **Om rapporten** ("Kund, adress och inledning"). I databas, typer och kod heter det fortfarande `section`.
- Rapporten är allmän: del (sektion) = rubrik, underrubrik, etikett (`omrade|besok|underlev|fritt`), valfritt ritat område och block (`text|events|images|map`). Högst ett `events`-block per sektion; blocket visar sektionens alla händelser.
- Varje del har en färg `color` (`#rrggbb`, check-constraint, null tillåts) ur `SECTION_COLORS` (8 färger). Ny del får första färgen som inte används i rapporten, annars i tur och ordning. Färgen syns i listan, rubriken, kartans polygon och nummer, kartutsnittet, förhandsvisningen och PDF:en (rubrikstreck, nummer, polygoner och nummer på kartorna). Reserv utan färg: brandgrön i PDF:en, palettens färg efter plats i gränssnittet.
- Tom rubrik på en del är tillåten (`title` är `not null`, tom sträng går bra). Gränssnittet visar "Utan rubrik", PDF:en visar typen av del.
- Översiktskartan är valfri (`map_view`). Ett ritat område skapar en del med etikett `omrade`, tom rubrik och blocken `map` + `text` + `events`; rutan "Vad heter området?" tar namn och färg.
- Klar att skicka (fem punkter: inledning, minst en del, minst en händelse, bedömning, rekommendationer) räknas i gränssnittet (`klarAttSkicka` i `specialReportUtils.ts`) och hindrar aldrig utskicket.
- Versioner: `current_version` är den som pågår. Skicka låser versionen (rad i `special_report_versions` med PDF) och `current_version` räknas upp.
- Bilder: bucket `special-reports` (privat), sökväg `{report_id}/{uuid}.webp`, komprimeras med `compressToWebP` (`src/utils/imageUtils.ts`).
- PDF enligt dokumentstandarden (försättssida med logga och metablock, 1 Översikt, 2.x delar, 3 Bedömning och åtgärder). Kartor som satellitskärmdump via Puppeteer (inte Static Maps).

## Databas (migration `supabase/migrations/20261014_specialrapporter.sql`)
Färg: migration `supabase/migrations/20261014_specialrapporter_farg.sql` (`special_report_sections.color`).
Tabeller: `special_reports`, `special_report_sections`, `special_report_blocks`, `special_report_events`, `special_report_images`, `special_report_versions` (kolumner = typerna, `area` och `map_view` som jsonb, `content` jsonb, `sent_to` text[]).
Funktion `can_access_special_report(p_report_id uuid) returns boolean` (security definer) används av all RLS. Funktion `can_access_case_for_report(p_case_id uuid, p_case_type text)` för insert av nya rapporter.

## Tjänst `src/services/specialReportService.ts` (statisk klass `SpecialReportService`)
Alla metoder kastar `Error` med svensk text vid fel.

```ts
list(): Promise<SpecialReportListItem[]>
searchCases(query: string): Promise<SpecialReportCaseOption[]>   // BE-nummer, kundnamn, kontaktperson; bara ärenden användaren når
create(input: { caseOption: SpecialReportCaseOption; title: string; docType: SpecialReportDocType; start: SpecialReportStart; copyFromReportId?: string }): Promise<string>  // returnerar id; 'per_besok' skapar en del per besök med händelser och färger i tur och ordning, 'kopia' kopierar delar/block (med färg) utan händelser
get(id: string): Promise<SpecialReportFull>                        // bilder med signerade URL:er, delarna med color
updateReport(id: string, patch: Partial<Pick<SpecialReport, 'title'|'doc_type'|'intro'|'assessment'|'recommendations'|'map_view'>>): Promise<void>
addSection(reportId: string, input: { title: string; subtitle?: string | null; label: SpecialReportSectionLabel; area?: LatLng[] | null; blocks?: SpecialReportBlockType[]; color?: string | null }): Promise<SpecialReportSection & { blocks: SpecialReportBlock[]; events: SpecialReportEvent[]; images: SpecialReportImage[] }>  // tom rubrik tillåten, färg = nästa lediga om den inte anges
updateSection(sectionId: string, patch: Partial<Pick<SpecialReportSection, 'title'|'subtitle'|'label'|'area'|'color'>>): Promise<void>  // tom rubrik tillåten
createSectionsForVisits(reportId: string): Promise<FullSection[]>  // en del per besök (source visit) som inte finns i rapporten, rubrik "Besök ÅÅÅÅ-MM-DD", etikett besok, med händelsen
deleteSection(sectionId: string): Promise<void>
reorderSections(reportId: string, orderedIds: string[]): Promise<void>
addBlock(sectionId: string, type: SpecialReportBlockType): Promise<SpecialReportBlock>
updateBlock(blockId: string, content: { text?: string }): Promise<void>
deleteBlock(blockId: string): Promise<void>
reorderBlocks(sectionId: string, orderedIds: string[]): Promise<void>
addEvent(sectionId: string, input: { event_date: string; type: SpecialReportEventType; title: string; description?: string | null }): Promise<SpecialReportEvent>   // skapar events-block i sektionen om det saknas
updateEvent(eventId: string, patch: Partial<Pick<SpecialReportEvent, 'event_date'|'type'|'title'|'description'>>): Promise<void>
deleteEvent(eventId: string): Promise<void>
getImportCandidates(reportId: string): Promise<SpecialReportImportCandidate[]>   // visits för ärendet + station_inspection_sessions (bara contract)
importEvents(sectionId: string, candidates: SpecialReportImportCandidate[]): Promise<SpecialReportEvent[]>
uploadImage(reportId: string, sectionId: string, file: File, opts?: { eventId?: string | null; caption?: string | null }): Promise<SpecialReportImage>
updateImage(imageId: string, patch: { caption?: string | null }): Promise<void>
deleteImage(imageId: string): Promise<void>
downloadPdf(reportId: string): Promise<{ url: string; filename: string }>  // förhandsgranskning av pågående version, ingen låsning
send(reportId: string, input: { recipients: string[]; subject: string; message: string; saveToCase: boolean }): Promise<SpecialReportVersion>
getVersionPdfUrl(versionId: string): Promise<string>
```

## API `api/special-report-pdf.ts`
POST `{ reportId, action: 'download' | 'send', recipients?, subject?, message?, saveToCase? }` med användarens JWT.
- Kontrollerar åtkomst (samma regel som RLS) och läser rapporten med service role.
- Bygger HTML, renderar PDF med puppeteer-core + @sparticuz/chromium, laddar upp till `special-reports/{report_id}/versioner/...` och svarar med en signerad URL (aldrig base64 i svaret, Vercels gräns 4,5 MB).
- `download`: `{ url, filename, pageCount }` för pågående version (fil `.../utkast.pdf`, skrivs över).
- `send`: mejlar via Resend SMTP (`BeGone Rapporter <noreply@begone.se>`, replyTo info@begone.se) med PDF som bilaga (över 8 MB: länk i stället), skapar rad i `special_report_versions`, räknar upp `current_version`, svarar `{ version }`. Sparas INTE i `sanitation_reports` (triggern där markerar ärendets saneringsrapport som ersatt); rapporten hör redan till ärendet.
