# Redesign: /technician/equipment – "Stationer & kunder"

*Analys 2026-08-19, baserad på teknikerfeedback från fält (etableringsbesök), kodkartläggning och verifiering mot live-databasen. Uppdaterad samma dag efter beslut från Christian.*

## Beslut 2026-08-19 (styr allt nedan)

1. **Tekniker ser endast det de själva placerat ut.** Teknikerfiltret (`placed_by_technician_id`) behålls i kundlistan. Koordinatimporterade stationer (Trafikkontoret m.fl., 620 st med NULL-ägare) ska inte ha ägare och hör inte hemma i teknikerns kundlista.
2. **Djuplänk från etableringsärende öppnar ALLTID etableringswizarden**, med kunden förfylld och wizarden startad – teknikern kommer dit för att placera ut något. Dagens beteende råkar bli så p.g.a. buggen `c.id`/`c.customer_id` ([TechnicianEquipment.tsx:204](../src/pages/technician/TechnicianEquipment.tsx)); det ska göras avsiktligt: ta bort modal-förgreningen, fixa race-guarden, gå rakt till wizard.
3. **Ny informationsarkitektur: tre tabbar** – Kunder, Karta, Rutter (se målbild). Interaktiv mobilskiss framtagen som artifact.

## Rotorsaker (verifierade)

### 1. Oläsbara kundnamn = CSS-truncation (fältstoppande)

[ExpandableCustomerRow.tsx:143-227](../src/components/technician/ExpandableCustomerRow.tsx): en enda flexrad klämmer in chevron + ikon + namn + adress + 2 räknare + hälsobadge + 2 ikonknappar. Namnet ligger i `flex-1 min-w-0` med `truncate` mot en `flex-shrink-0`-högersida och klipps på mobil till 1-3 tecken ("C" = Cramo Södertälje, "Hud…" = Huddinge Pastorat). Data i databasen är intakt. Samma mönster i `MultisiteOrgRow.tsx:120`.

### 2. Bugg + race i djuplänken ?customer=

[TechnicianEquipment.tsx:198-212](../src/pages/technician/TechnicianEquipment.tsx): `allCustomers.find(c => c.id === customerId)` – fältet heter `customer_id`, så jämförelsen är alltid `undefined`. Enligt beslut ovan är destinationen (wizard) rätt, men koden ska uttrycka det explicit i stället för via en trasig jämförelse. Race-risken (guard väntar på fel fetch-effekt) fixas samtidigt.

### 3. Kundvalen skalar inte

- Listans sök kräver "börjar på" (`startsWith`, [AllCustomersList.tsx:150](../src/components/technician/AllCustomersList.tsx)) för namn, `includes` för adress – inkonsekvent.
- `AddStationWizard.tsx:589` klipper "Alla kunder" till `slice(0, 20)` – viktigt eftersom etablering hos NY kund sker här.
- Fyra oberoende kundväljarimplementationer i repot, ingen gemensam.

### 4. Arkitekturen skalar inte

- Allt hämtas upfront utan limit: alla placeringar, alla kunder, alla kunder igen för dropdown. Aggregering i JS med joinat kundobjekt per stationsrad.
- N+1: `getStationsByFloorPlan` gör 3-4 queries per station; varje radexpansion 2-3 queries; `getActiveContracts` per sparad station i batchflödet.
- Ingen virtualisering, ingen URL-state, tre handrullade modaler på 1000-1400 rader (modal-i-modal på mobil, back-knapp fungerar ej).
- `refreshData` blankar hela sidan med spinner mitt i batch-placeringsflödet.

### Bifynd att flagga vidare

- **RLS-inkonsekvens** på `equipment_placements`: SELECT-policyn matchar `profiles.user_id`, INSERT/UPDATE/DELETE matchar `profiles.id`. Bör in i säkerhetsplanens fas 3-4.
- `indoor_stations`/`floor_plans` har helt öppen RLS (`USING(true)` på allt).
- Död kod: `CustomerStationsList.tsx`, `CustomerStationCard.tsx` (dublett-interface), `getAllCustomersWithStationStats` (aldrig anropad).
- Koordinatimporterade stationer kan inte raderas av tekniker (delete-RLS knuten till ägarkolumnen) – medvetet OK, separat beslut om det ska ändras.

## Målbild: tre tabbar, mobil först

Skiss (interaktiv artifact): tabbarna ligger som segmenterad kontroll under sidhuvudet.

### Tab 1 – Kunder
Kunder teknikern ansvarar för (egna utplaceringar) + schemainställningar.
- Tvåradiga rader: rad 1 = kundnamn `line-clamp-2` (aldrig oläsbar truncation), rad 2 = adress + chips ("12 ute · 4 inne", hälsoprick, "Schema saknas"-varning). Hela raden tap-yta.
- Sök: substring på namn/adress/org.nr, debounced.
- Kunddetaljvy som **egen routad sida** (`/technician/equipment/customer/:id?tab=utomhus|inomhus|schema`), ersätter `CustomerStationsModal`: fullt namn, navigera-knapp, flikar Utomhus/Inomhus/Schema, schemahantering, "Lägg till station" med kunden låst.

### Tab 2 – Karta
Kartvy över teknikerns alla stationer ( `EquipmentMap` + klustring finns), filter per stationstyp, tap på station → bottom-card med info + "Öppna kund".

### Tab 3 – Kontroller (beslutad inriktning 2026-08-19, ersätter tidigare rutt-idé)
**En samlad överblick över kundernas kontrollscheman – inte en ruttvy och inte en ersättare för schemasidan.** Teknikern ser vad som ska göras idag/veckan/månaden och vilken kund som står näst på tur.

- **Omfattning: enbart stationskontroller** (beslut). Övriga ärendetyper bor kvar i /technician/schedule.
- **Datakälla: enbart inbokade besök** (beslut) – `station_inspection_sessions` (`scheduled_at`, `technician_id`, status). Återkommande scheman genererar alltid bokningar (cron `extend-recurring-schedules`), så "förfallen utan bokning" ska inte finnas som tillstånd.
- **Varningsflagga (beslut):** en bokad kontroll som inte utförts inom sin dag/tid lyfts överst i ett "Kräver åtgärd"-block (röd), synligt i alla tre perioderna – ska hanteras skyndsamt.
- Struktur per period: "Kräver åtgärd" → dagens/veckans inbokade kontroller (datum-bubbla, kund, frekvens, stationsantal, statuspill) → "Näst på tur"-kort (nästa kommande bokning) → notis om kunder som saknar kontrollschema (länk till kundens schemaflik).
- Månadsvyn har en summering (utförda/passerade/kvar) för att se läget i stort.
- Tap på rad → kundens schemaflik i kunddetaljvyn. Inga bokningar skapas/flyttas härifrån; schemasidan förblir source of truth.
- Query: sessions för teknikern inom periodfönstret + senaste utförd per kund; billig och paginerbar. Ingen geokodning behövs (kartan bor i tab 2).

### Etableringsflödet
- `?customer=<id>` från ärendemodal → **alltid** `AddStationWizard` startad på steg 2 med kunden förfylld (dagens steg-2-hopp finns redan i `AddStationWizard.tsx:116-131`).
- Batchflödet (Placera fler → Färdig med etablering → schema-prompt), `contract_id`-resolvning och preparatkoppling behålls oförändrade.

## Datalager

Parametriserad RPC (migration `20260819_technician_equipment_search.sql`):
- `pg_trgm` (ej installerat idag) + gin-trgm-index på `customers.company_name`, `contact_address`.
- `search_customers_with_station_stats(p_search, p_technician_id, p_limit 50, p_offset)` → per kund: antal ute/inne, problemantal, senaste aktivitet, aktivt schema, nästa session, centroid, window-count. **Scopet är teknikerns egna utplaceringar** (beslut 1) – men räkningen per kund ska ta med kundens ALLA stationer när kunden väl kvalificerat sig, annars ljuger räknarna vid delade kunder. (Verifiera önskat beteende vid implementation.)
- Rutt-query: sessions per dag/vecka/månad för teknikern, joinat med kundcentroid.
- `SECURITY INVOKER`; inga RLS-ändringar nu.
- Ny service `src/services/technicianEquipmentService.ts` (rör inte delade `equipmentService`-exporter).
- Ingen realtime: refetch vid fokus/navigering + optimistiska räknare.

## Fasindelad plan

### Fas 0 – KLAR 2026-08-19
"Gå till utplacering"-knappen: `dvh` + `min(600px, 85dvh)` i `Modal.tsx`, `flex-wrap` i ärendemodalens footer.

### Fas 1 – Snabba fixar (1-2 dagar, ingen schemaändring)
1. `ExpandableCustomerRow` + `MultisiteOrgRow`: tvåradig layout, `line-clamp-2`, metadata rad 2, större tap-ytor, `site_name` för enheter.
2. `AllCustomersList`: `includes`-sök konsekvent (namn/adress/org.nr/enheter), placeholder "Sök kund, adress eller org.nr".
3. Djuplänken: explicit wizard-väg (ta bort modal-förgreningen + fixa race-guarden).
4. `AddStationWizard`: ta bort `slice(0, 20)`-taket (sökfältet bär listan).

### Fas 2 – Datalager + routad kunddetaljvy (~1-1,5 vecka)
1. Migrationen ovan (verifiera kolumnnamn mot live-DB via MCP före apply).
2. `technicianEquipmentService.ts`.
3. Ny sida `TechnicianCustomerStationsPage.tsx`; extrahera `CustomerStationsModal`-innehållet till `src/components/technician/customer-stations/` (Header, OutdoorStationsTab, IndoorStationsTab, ScheduleTab).
4. Route `equipment/customer/:customerId` i `App.tsx`.
5. Opportunistiskt: `station_type_id` i skrivvägar som flyttas; N+1-fix i `getStationsByFloorPlan`.

### Fas 3 – Tabbarna (~2 veckor)
1. `TechnicianEquipment.tsx` skrivs om till tabb-hubb: Kunder / Karta / Rutter (tabb-state i URL `?tab=`).
2. Nya komponenter i `src/components/technician/equipment-hub/`: `CustomerSearchBar`, `CustomerResultRow`, `StationsMapTab`, `RoutesTab` (+ `RouteDayView`, `RouteStopRow`).
3. Rutter: dag/vecka/månad från `station_inspection_sessions`, avbockning kopplad till sessionsstatus, navigera-knappar.
4. `AddStationWizard` steg 1 byts till samma sök/RPC.
5. Städning: radera `CustomerStationsModal`, `AllCustomersList`, `ExpandableCustomerRow`, `MultisiteOrgRow`, död kod i `equipmentService`.

Risker fas 3: ruttvyns datakvalitet beror på att sessioner faktiskt schemaläggs med `scheduled_at`; degradera till "inga planerade kontroller" + länk till schema. Batch-schemaläggning över multisite-enheter re-verifieras mot `RecurringScheduleWizard.batchUnits`.

## Får inte brytas (alla faser)

- Kontrollrapporter (`inspectionReportService`, `api/generate-inspection-report-pdf.ts`) och inspektionsflödet `/technician/inspection/:caseId` + session-livscykeln.
- Kundportalen (`CustomerEquipmentView`, `CustomerEquipmentMap`, `MultisiteStationsView`, `RegionalMapView`) – endast additiva DB-ändringar.
- Admin (`CustomerEquipmentSection`, `CustomerEquipmentDualView` – beroende av `contract_id`).
- Delade komponenter: `EquipmentPlacementForm`, `EquipmentMap`, `FloorPlanViewer`, `IndoorStationForm`, detail-sheets.
- Etableringsärendets livscykel (`service_type='establishment'` → `Avslutat` vid "Färdig med etablering").
- Inga RLS-ändringar (säkerhetsplanens fas 3-4).

**Total omfattning: ca 3,5-4 veckor, varje fas självständigt shippbar.**
