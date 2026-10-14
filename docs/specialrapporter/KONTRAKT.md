# Specialrapporter: kontrakt mellan databas/tjänst och gränssnitt (3.50.0, uppdaterat 3.52.0)

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
listForCase(caseId: string, caseType: SpecialReportCaseType): Promise<SpecialReportListItem[]>   // 3.56.0, filtreras i databasen; list och listForCase delar berika(rows)
getCaseOption(caseId: string, caseType: SpecialReportCaseType): Promise<SpecialReportCaseOption | null>   // 3.56.0, känt ärende utan fritextsök (förval i Ny specialrapport)
searchCases(query: string): Promise<SpecialReportCaseOption[]>   // BE-nummer, kundnamn, kontaktperson; bara ärenden användaren når
create(input: { caseOption: SpecialReportCaseOption; title: string; docType: SpecialReportDocType; start: SpecialReportStart; copyFromReportId?: string }): Promise<string>  // returnerar id; 'per_besok' skapar en del per besök med händelser och färger i tur och ordning, 'kopia' kopierar delar/block (med färg) utan händelser
get(id: string): Promise<SpecialReportFull>                        // bilder med signerade URL:er, delarna med color
updateReport(id: string, patch: Partial<Pick<SpecialReport, 'title'|'doc_type'|'intro'|'assessment'|'recommendations'|'map_view'>>): Promise<void>
addSection(reportId: string, input: { title: string; subtitle?: string | null; label: SpecialReportSectionLabel; area?: LatLng[] | null; blocks?: SpecialReportBlockType[]; color?: string | null }): Promise<SpecialReportSection & { blocks: SpecialReportBlock[]; events: SpecialReportEvent[]; images: SpecialReportImage[] }>  // tom rubrik tillåten, färg = nästa lediga om den inte anges
updateSection(sectionId: string, patch: Partial<Pick<SpecialReportSection, 'title'|'subtitle'|'label'|'area'|'color'>>): Promise<void>  // tom rubrik tillåten
createSectionsForVisits(reportId: string): Promise<FullSection[]>  // en del per besök (source visit) som inte finns i rapporten, rubrik "Besök ÅÅÅÅ-MM-DD", etikett besok, med händelsen
deleteSection(sectionId: string): Promise<void>
reorderSections(reportId: string, orderedIds: string[]): Promise<void>
addBlock(sectionId: string, type: SpecialReportBlockType): Promise<SpecialReportBlock>  // events och images finns högst en gång: befintligt block returneras
updateBlock(blockId: string, content: { text?: string }): Promise<void>
deleteBlock(blockId: string): Promise<void>
reorderBlocks(sectionId: string, orderedIds: string[]): Promise<void>
addEvent(sectionId: string, input: { event_date: string; type: SpecialReportEventType; title: string; description?: string | null }): Promise<SpecialReportEvent>   // skapar events-block i sektionen om det saknas
updateEvent(eventId: string, patch: Partial<Pick<SpecialReportEvent, 'event_date'|'type'|'title'|'description'>>): Promise<void>
deleteEvent(eventId: string): Promise<void>
reorderEvents(sectionId: string, orderedIds: string[]): Promise<void>   // 3.55.0: skriver position 0..n-1
getImportCandidates(reportId: string): Promise<SpecialReportImportCandidate[]>   // visits för ärendet + station_inspection_sessions (bara contract)
importEvents(sectionId: string, candidates: SpecialReportImportCandidate[]): Promise<SpecialReportEvent[]>
uploadImage(reportId: string, sectionId: string, file: File, opts?: { eventId?: string | null; caption?: string | null }): Promise<SpecialReportImage>
updateImage(imageId: string, patch: { caption?: string | null; event_id?: string | null }): Promise<void>  // event_id null = okopplad (3.53.0)
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

## Snygga till och ordlistan (3.52.0)
Skiss: V3-Granska, V3-Knappar och V3-Ordlista (sessionens scratchpad).
- Migration `supabase/migrations/20261014_ordlista.sql`: tabellen `text_glossary` (term, source `artikel|tjanst|produkt|preparat|stationstyp|manuell`, source_id **text** eftersom `products.id` är text, active, added_by, created_at), unikt index på `lower(term)`. RLS: personal (admin, koordinator, tekniker) läser och lägger till manuella ord; admin och koordinator ändrar och tar bort manuella ord. Triggers `text_glossary_sync_trg` på `articles`, `services`, `products`, `preparations` och `station_types` lägger till nya namn och följer namnbyten, men rör aldrig avstängda rader.
- API `api/polish-text.ts`: POST `{ fields: { id, label, text }[], context?: { customerName?, address? } }` (högst 30 fält och 20 000 tecken, annars 413) svarar `{ changes, blocked, protectedTerms }`. Gemini (`gemini-3-flash-preview`) föreslår, servern kontrollerar: entydig plats, samma siffror, skyddade termer orörda (utom exakt ordlistans stavning), ingen överlappning, inga tankstreck. Typer i `src/types/textPolish.ts`.
- Klient: `src/services/textPolishService.ts` (`polish`, `addToGlossary`, `listGlossary`, `setActive`, `deleteTerm`), granskningsrutan `PolishReviewModal.tsx` och sidan `src/pages/shared/GlossaryPage.tsx` (`/koordinator/ordlista`, `/admin/ordlista`).
- Tillämpningen sker i redigeraren via de vanliga sparvägarna (fördröjd sparning, förhandsvisningen följer med). Fältets text måste vara oförändrad sedan genomläsningen, annars hoppas fältet över. Ångra i toasten återställer originaltexterna.
- Fältens id i granskningen: `rapport:intro|assessment|recommendations`, `del:<del>:title|subtitle`, `block:<del>:<block>`, `handelse:<del>:<händelse>:title|description`, `bild:<del>:<bild>`.

## Redigeraren och bildkoppling (3.53.0)
Skiss: V4-OmRapporten och V4-Del (sessionens scratchpad).
- Om rapporten (`OmRapporten.tsx`): framsidesbanderoll med fasta färger (#0f2a22), kundkort per ärendetyp (`contract` Avtalskund, varning om kundnummer saknas; `business` Företag, engångsuppdrag, kundnummer bara om det finns; `private` Privatperson, inget kundnummer, namn från `customer_name` eller `contact_name`), typ av rapport som radiogrupp med förslaget från `foreslaDokumenttyp(report.title)`, inledning med startfraser.
- Del (`SectionEditor.tsx`): rubrikband i delens färg, egenskapsrad (typ, färg, plats) med menyer i `Meny.tsx` (popover från sm, bottenark på mobil, Escape och klick utanför stänger), block som kort med ⋯-meny. Layouten styrs av container queries.
- Bilder och händelser: `special_report_images.event_id` (on delete set null). Gemknappen på en händelse laddar upp med `eventId`; tjänsten och redigeraren skapar delens bildblock om det saknas. Bildblockets val "Hör till händelse" sparas med `updateImage(id, { event_id })`. Tas en händelse bort blir bilderna okopplade, även lokalt.
- Bilderna numreras löpande per del (`position`). Förhandsvisningen och PDF:en visar numren i händelsetabellens kolumn Bild och "Hör till: <rubrik>" under bildtexten.

## Avvikelser och rekommenderade åtgärder (3.54.0)
- Händelsetypen `avvikelse` (migration `supabase/migrations/20261014_specialrapporter_avvikelse.sql` utökar checken på `special_report_events.type`). Etikett Avvikelse, röd `#dc2626`, ton `#fef2f2` (`AVVIKELSE_FARG`, `AVVIKELSE_TON` i `src/types/specialReport.ts`), ikon `rapport.avvikelse`.
- `avvikelserIRapporten(sections)` ger avvikelserna i delarnas ordning med delens nummer (2.x) och rubrik. Används av förhandsvisningen och PDF:en: röd markering i händelsetabellen, rutan "Avvikelser i den här delen (N)" överst i delen och "Avvikelser att åtgärda (N)" på översikten (bara när det finns avvikelser).
- `recommendations` heter Rekommenderade åtgärder i gränssnittet och lagras som rader avskilda med radbrytning (schemat oförändrat). `atgardsRader(text)` ger raderna utan tomma rader och utan inledande punkt eller siffra. Redigeraren (`AtgardsLista.tsx`) har lägg till, ta bort, flytta och Enter för nästa rad. PDF:en visar en grön panel med numrerade punkter och översikten "Det här rekommenderar vi" med de tre första.
- Snygga till stoppar förslag som delar eller slår ihop rader i `rapport:recommendations`.

## Händelseordning, täthet och förhandsvisningen som rulle (3.55.0)
Skiss: Handelser, Bilder, Forhandsvisning och HelaPdf (sessionens scratchpad, mappen tatare).
- `special_report_events.position integer not null default 0` (migration `supabase/migrations/20261014_specialrapporter_handelse_ordning.sql`). Händelser sorteras på position och sedan created_at överallt: `get`, PDF:en, förhandsvisningen, Snygga till och `avvikelserIRapporten` (hjälpen `handelseOrdning` i `src/types/specialReport.ts`). `addEvent` och `importEvents` sätter max + 1 (import i datumordning). Datumet styr inte längre ordningen.
- Händelseblocket är en tät lista: grepp för dra och släpp (HTML5, linje före eller efter raden), ⋯-meny med Redigera, Flytta upp, Flytta ned och Ta bort (med bekräftelse), Alt och pil upp eller ned på raden. Ny ordning sparas direkt med `reorderEvents`, en flytt i taget (kö i redigeraren).
- Bildblocket är ett tätt rutnät (2 till 5 i bredd efter behållaren) med uppladdningsruta. Ladda upp i blockets huvud öppnar samma filväljare.
- Förhandsvisningen (`ReportPreview.tsx`) är en rulle med alla sidor. Sidbrytningen finns i `rapportSidor.tsx`: bitarna mäts i en osynlig behållare (sidan ritas i 420 x 594 px och skalas med transform) och fördelas i ett varv. Varje bit placeras en gång, en för hög bit klipps. Fortsättningssidor får "2.x Namn, fortsättning" och upprepat tabellhuvud. Sidbrytningen är en uppskattning; PDF:en från servern bryter själv.
- Hela PDF:en (`HelaPdfModal.tsx`): egen portal i helskärm med miniatyrer, stor sida, piltangenter, Ladda ner PDF och Skicka till kund.

## Specialrapporter i ärendemodalerna (3.56.0)
- `CaseSpecialReportsSection` (props `caseId`, `caseType`, `caseNumber?`, `readOnly?`, `osparat?`) ligger i EditCaseModal (`private`/`business`), EditContractCaseModal (`contract`, inte i kundvyn), RonderingCaseModal (`contract`, delbesök visar huvudärendets rapporter via `parent_case_id ?? id`), EgenkontrollCaseModal (`contract`) och som läsvy (`readOnly`, ingen plusknapp) i admins kundkort (`CaseDetailPanel`). Kundvyer har inte listan.
- Hämtas med `listForCase` och igen när fliken blir synlig. `SpecialReportListItem` har `last_sent_to: string[]` och `last_sent_version_id` från senaste versionen.
- Rad: statuspunkt, titel, Skickad / Ändrad sedan utskicket / Utkast i statusfärg, senaste utskick (första mottagaren + "och N till"), antal delar och händelser. Ikonknappar 44 px: Ladda ner PDF (skickad = låsta versionens PDF via `getVersionPdfUrl`, annars `downloadPdf`, toast.loading under tiden) och Öppna rapporten (`rapport.ladda-pdf`, `rapport.oppna`).
- Öppna skickar `state.tillbaka = { pathname, caseId, caseType }`. Redigeraren sparar det per rapport i sessionStorage (`specialrapport-tillbaka:<id>`) och tillbaka-knappen går till sidan med `?openCase=<id>&caseType=<typ>&comm=0`. Kundkortet skickar bara sidan.
- Osparade ändringar: modalen ger `osparat = { finns, spara }`. `useOsparatArende(formData, fält)` i `specialReportUtils.ts` jämför de fält användaren redigerar mot det som senast lästs eller sparats. Finns ändringar frågar listan: Spara och öppna / Öppna utan att spara / Avbryt.
- `NewSpecialReportModal` tar `initialCaseType` (och valfritt `initialCase`) och väljer ärendet via `getCaseOption`, med sökningen som reserv.
