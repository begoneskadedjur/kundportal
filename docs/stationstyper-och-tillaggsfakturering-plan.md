# Plan: stationstyper med produkt och pris, samt fakturering av tilläggsstationer

Status: reviderad 2026-09-04 efter fyra expertgranskningar (två före skrivningen, två efter). EJ byggd. Bygger vidare på `docs/tillaggsstationer-tre-modeller-plan.md` (byggt och pushat 2026-09-03).

**Revideringen ändrade planen i sak.** Tre delar av den ursprungliga planen höll inte: läget `separate_all` passar inte fakturamodellen, prislistetrappan får inte skrivas en andra gång i SQL, och den föreslagna indexändringen löste fel problem. Dessutom hittades två tysta pengabuggar i den redan byggda koden som måste med i samma leverans. Avsnitt 12 listar vad som ströks och varför.

## 1. Bakgrund

Tilläggsstationer har sedan 2026-09-03 tre betalningsmodeller (per år, per månad, per kontroll) och två avtalslägen (inbakat i premien via § 7, tillägg utöver avtalet via § 6). Det som saknas:

1. Kundpriset hämtas från EN årstjänst (kod 144) oavsett stationstyp. FEV har 2 348 kr/år för fällor och 1 686 kr/år för ljusfällor (tjänst 79). Ljusfällorna får därför fel pris.
2. Den fysiska produkten som placeras ut registreras inte. Kunden köper "Tilläggsstation per år" men vi sätter ut Aurotrap Nature, AF Atom, plåtlåda eller PW Titan 300, och den interna kostnaden syns inte.
3. Faktureringsläget för tilläggsstationer sitter per avtal (`contracts.equipment_invoice_mode`) och har bara två lägen.

## 2. Beslut (Christian 2026-09-04)

- **Produktnamn:** använd aldrig leverantörens produktnamn mot kund. Stationstypen heter "Mekanisk fälla", produkten är intern.
- **Produktuppdelning hos FEV:** mekaniska fällor = Aurotrap Nature (405220), betesstationer inomhus = AF Atom (502001), betesstationer utomhus = plåtlåda (500501), ljusfällor = PW Titan 300 (102102).
- **Marginalen:** produkten läggs som engångskostnad utan avskrivning. Att § 5 då visar minus är accepterat och rättas senare. Bygg ingen avskrivningsmodell nu.
- **Alla FEV:s 35 stationer är tillägg per år**, inklusive betesstationerna. Inget ingår i premien.
- **Stationen följer enheten:** tilläggsstationen hamnar på det avtal som täcker enheten, automatiskt.
- **Allt ska gå att göra i systemet framgent**, inte genom instick i databasen.

## 3. Två tysta pengabuggar som måste rättas först

Båda finns i den redan byggda koden och skulle ärvas rakt in i det nya. De är viktigare än allt annat i planen.

### 3.1 Nya § 6-rader får 0 kr och försvinner tyst från fakturan

Kedjan är verifierad:

- `contractInvoiceGenerator.ts:630` och `api/cron/generate-continuing-contracts.ts:126` anropar båda `sync_addon_period_lines` med `p_annual_price: null` vid **varje** planering.
- I RPC:n (migration rad 567) gäller `v_annual := coalesce(p_annual_price, v_base_price)`. `v_base_price` är `services.base_price` för tjänst 144, som är **null**.
- För en ny rad finns inget `v_existing_price` att falla tillbaka på, så `v_unit_price` blir `coalesce(null, 0)` = **0**.
- `contractPlanner.ts:287` filtrerar `unit_price_annual > 0`. Raden försvinner utan felmeddelande.

Resultat: en tilläggsstation som synkas från planeringsvägen i stället för från avtalskartan faktureras aldrig, och ingen märker det.

**Åtgärd:** RPC:n ska aldrig skriva `unit_price = 0` på en ny rad. Saknas pris returneras `{ok: false, price_missing: [station_type_id...]}` och raden skapas inte. Avtalskartan och utsättningsformuläret visar "pris saknas" som blockerande fel.

### 3.2 Pro rata uteblir för stationer som redan står ute

`sync_addon_prorata_line` räknar från `ep.placed_at` och kräver `placed_at >= v_created` (etableringsärendets skapande). FEV:s 35 stationer sattes ut innan tilläggsfunktionen fanns, så villkoret ger **noll rader**. Perioden mellan markering och nästa premie faktureras då varken som pro rata eller via § 6, som börjar 2027-07-01.

Dessutom kollar `covered_by_open_invoice` bara `invoice_type='contract'` utan filter på `contract_invoice_kind` eller `is_consolidated`, så den kan träffa en samlad premiefaktura och hoppa över pro rata på fel grund.

**Åtgärd:** markering av en befintlig station som tillägg ger alltid pro rata från **markeringsdatum**, aldrig från utsättningsdatum. Lägg kind-filter i `covered_by_open_invoice` och undanta `is_consolidated` när läget är per avtal.

## 4. Faktureringslägen för tilläggsstationer (kundnivå)

Ersätter `contracts.equipment_invoice_mode`. Ny kolumn `customers.addon_invoice_mode`, satt från gemet i avtalskartan.

| Läge | Innebörd |
|---|---|
| `with_contract` | Följer kundens faktureringsläge för avtalen (`customers.contract_invoice_mode`). Tilläggen hamnar på premiefakturan, samlad eller per avtal. |
| `separate_per_contract` | En egen tilläggsfaktura per avtal (dagens `separate`). |

**`separate_all` byggs inte nu.** Det ströks efter granskningen, se avsnitt 12.

**Migrering.** Ett enda avtal har `separate` i dag (72818957, FEV Återvinningscentralen) och det har aldrig gett en faktura. Migrationssteg:

```sql
update customers c set addon_invoice_mode = case
  when exists (select 1 from contracts where customer_id = c.id and equipment_invoice_mode = 'separate')
  then 'separate_per_contract' else 'with_contract' end;
```

`contracts.equipment_invoice_mode` behålls som deprecated kolumn en release men **läses aldrig** efter migrationen. Kundläget är enda källan, ingen dubbelstyrning. Kolumnen tas bort i nästa release.

## 5. Stationstypen får produkt och pris

`station_types` får:
- `annual_service_id uuid references services(id)` — tjänsten som bär kundpriset per år. Mekanisk fälla, betesstation, plåtstation, betongstation → tjänst 144. Ljusfälla → tjänst 79.
- Ny tabell `station_type_articles (station_type_id, article_id, is_default, sort_order)` med partiellt unikt index på ett förval per typ.

`services.used_for_addon_stations_annual` (tjänst 144) behålls som fallback när typen saknar tjänst. Notera att flaggan har ett unikt partiellt index, så bara en tjänst kan bära den.

**Redigeras** i `StationTypeEditModal.tsx` (mönster i `ServiceCatalogEditModal.tsx:479-512`). Listan byts atomärt via RPC `set_station_type_articles` — motivet är atomicitet (PostgREST kör varje anrop i egen transaktion), inte behörighet. Behörigheten löses av RLS-fixen i avsnitt 9.

**Betongstation delar tjänst 144.** Prisdifferentiering hör hemma i prislistan, inte i tjänstekatalogen. Ljusfällan har egen tjänst bara för att GNU-avtalet har ett avvikande avtalat pris. Skapa fler tjänster först när en kund har ett avvikande pris.

## 6. Teknikern väljer produkt vid utsättning

- `equipment_placements.article_id` och `indoor_stations.article_id` (ingen av dem finns i dag).
- Fältet visas under stationstypen med typens artiklar, förvalet ifyllt.
- Nollställs vid typbyte, valideras mot typens lista precis som preparat (`EquipmentPlacementForm.tsx:311-319`).
- Följer med i "kopiera från föregående station" (`lastArticleId` i `TechnicianEquipment.tsx` och `AddStationWizard.tsx`), nollställs vid kundbyte.
- Gäller alla stationer, inte bara tillägg.

**Formuläret har inget `station_type_id`.** Typen bärs som kodsträng och `station_type_id` sätts först i servicelagret (`equipmentService.ts:205-210`, `indoorStationService.ts:255-267`). Produktvalet måste därför valideras mot typens **kod**, inte mot ett id formuläret inte har. `IndoorStationForm.tsx:280` sätter `station_type_id` bara vid edit, inte vid create — det måste rättas.

**Inomhusstationer hänger på `floor_plan_id`, inte på kunden.** Kundkopplingen går via `floor_plans.customer_id`. All prissättning och synk för inomhusstationer måste gå den vägen.

## 7. Priset per stationstyp: en implementation, två anropare

Den ursprungliga planen ville skriva `addon_price_for_station_type` i SQL. **Det görs inte.** Prislistetrappan bor i `priceListService.ts:282-360` och är inte trivial: avtalets lista löses via RPC `get_price_list_contract_candidates`, sorteras klientsidigt på `isLiveContract` och nyast-vinner över fyra källor, sedan kundens lista, sedan standardlistan. Kodkommentaren säger uttryckligen att urvalslogiken bor i TS och att RPC:n bara är dataleverantör. En andra implementation i SQL divergerar garanterat.

**I stället:** bryt ut trappan till en SECURITY DEFINER-RPC `effective_service_price(p_service_id, p_customer_id, p_contract_id)` som blir enda källan. `getEffectiveServicePrice` i TS blir ett tunt anrop till den, och `sync_addon_period_lines` anropar samma funktion. Cronen kan inte återanvända TS-logiken (den importerar `src/lib/supabase`), vilket är just varför den delade RPC:n behövs.

`p_annual_price` behålls som explicit override från `AddonDropPrompt`. Null betyder "slå upp per typ" — men med åtgärden i 3.1, alltså aldrig "skriv 0".

`AddonStationBillingService.getAddonPrices` blir per stationstyp. Det påverkar `AddonPrices`-typen, `AddonModelPicker`, `AddonDropPrompt`, `TechnicianEquipment` och `AddStationWizard`.

## 8. Produkten som intern kostnad

`sync_addon_period_lines` skapar per enhet och stationstyp:

1. **Tjänsteraden** som i dag, med typens tjänst och `billing_model per_year|per_month`.
2. **En artikelrad per faktisk produkt:** `item_type='article'`, `article_id`, `billing_model='premium'`, `site_customer_id`, `station_type_id`, `mapped_service_id` = tjänsteradens id, `unit_price` = `articles.default_price`.

**Grupperingen är per (avtal, enhet, stationstyp, article_id), inte per stationstyp.** Samma stationstyp kan ha olika produkter på samma enhet: betesstation ute är plåtlåda, betesstation inne är AF Atom. Det finns i produktion hos Maserfrakt (Gjutargatan 9 ute + 6 inne, Katrineborgsgatan 6 + 9, Örjasvägen 5 + 7, Godsvägen 4 + 5) och Demo AB. Tjänsteraden behåller sin grovkorniga nyckel; artikelraderna blir N stycken mot en tjänsterad.

**`mapped_service_id` är korrekt använt.** Den främmande nyckeln pekar på `case_billing_items(id)`, inte på `services(id)` — verifierat mot `case_billing_items_mapped_service_id_fkey`. Grupperingen i `caseBillingService.ts:565-595` slår upp radens id.

**Indexet:** artikelraden har `billing_model='premium'` och faller därmed **utanför** `cbi_addon_period_line_key`, som är partiellt på `billing_model IN ('per_year','per_month')`. Den ursprungliga planens förslag att lägga till `item_type` i det indexet löser alltså ingenting — raden når aldrig indexet. Konsekvensen är värre än en krock: artikelraden får **inget dubblettskydd alls**, och RPC:n anropas vid varje planering. Skapa i stället ett eget index:

```sql
create unique index cbi_addon_article_line_key on case_billing_items
  (case_id, site_customer_id, station_type_id, article_id)
  where item_type = 'article' and billing_model = 'premium'
    and station_type_id is not null and status <> 'cancelled';
```

**Artikelrader når aldrig fakturan.** Filtret `item_type='service'` är verifierat på båda vägarna: `contractInvoiceGenerator.ts:644` och `api/cron/generate-continuing-contracts.ts:138`.

**Stationer utan produktval** hoppas över och räknas i RPC:ns svar, så UI kan visa "3 stationer saknar produkt". De skapar aldrig en artikelrad med null-artikel.

**Priset fryses på raden.** Dagens RPC behåller `v_existing_price` när `p_annual_price` är null, alltså frysning. Det behålls: en befintlig rad räknas inte om när prislistan ändras.

## 9. Buggar i datamodellen

1. **743 stationer saknar `station_type_id`** (711 `equipment_placements` + 32 `indoor_stations`; 620 Stockholms stad, 32 av FEV:s 35). Alla åtta distinkta texter matchar case-insensitivt mot en `station_types.code`, ingen station blir utan träff. `unaccent` är **inte** installerad, så normaliseringen måste gå via `translate(lower(x),'åäöé','aaoe')`.

   Detta är inte bara en bugg utan en **förutsättning**: `sync_addon_period_lines` grupperar på `station_type_id`, medan `cbi_addon_period_line_key` kräver `station_type_id IS NOT NULL`. Rader med null-typ skapas alltså utan indexskydd och dubbleras vid upprepad synk. Backfyllnaden måste vara migrationens första steg, följd av en trigger som sätter `station_type_id` från texten vid insert.

2. **RLS-buggar på tre tabeller:**
   - `station_types`, policy "Admins can manage station types" (ALL): `profiles.id = auth.uid()` i både USING och WITH CHECK. 7 av 26 profiler har `id <> user_id` och är utelåsta.
   - `equipment_placements`, policy "Staff can insert equipment" (INSERT): samma bugg i WITH CHECK. Migration 20260903 fixade update och delete men missade insert.
   - `indoor_stations`: alla fyra policyer är `using (true)` för samtliga autentiserade. Ny `article_id` blir därmed skrivbar av vem som helst inloggad, inklusive kundroller. Bör stramas åt i samma migration.

## 10. FEV:s 35 stationer

Verifierat 2026-09-04: Återvinningscentralen 3 mek + 1 betes ute, 4 mek + 2 ljus inne. Huvudkontor 3 mek. Kraftvärmeverk 3 betes. Boda 2 mek + 2 ljus. Enviken 2 mek + 4 ljus. Främby 2 betes. Linghed 2 mek + 2 ljus. Vika 2 betes + 1 ljus. Sågmyra saknar stationer. Summa **16 mekaniska, 8 betes, 11 ljus = 35**. Alla åtta betesstationer står utomhus (ingen inne). Ingen station har `is_addon` i dag, och inga § 6-rader finns i databasen.

**FEV får `separate_per_contract`.** Fyra Fortnox-fakturor (648, 744, 745, 862) motsvarar fyra avtal en till en, och läget kräver noll ändringar i diff, cron och Fortnox-koppling.

Ordning, via systemet:
1. Backfyllnad av stationstyp (avsnitt 9).
2. Produkt per station enligt avsnitt 2.
3. Markera som tillägg, per år, med pro rata från markeringsdatum (avsnitt 3.2).
4. Avtalsläge tillägg utöver avtalet, kopplat till det avtal som täcker enheten.
5. Synk av § 6 och kontroll av antal och priser.
6. Fortnox-koppling av 648, 745, 862, 744 som `contract_invoice_kind='equipment'` med `contract_id` satt (dagens import räcker i detta läge).

`billing_start_date` blir 2027-07-01, verifierat via `contract_next_period_start` för alla fyra avtal. Perioden dit är betald genom F-643 (35 114 kr exkl. moms, 43 893 inkl., `is_consolidated=true`, `contract_id=null`). Ingen § 6-rad får startdatum före 2027-07-01.

**Tjänst 43 saknas i GNU-prislistan.** Får någon FEV-station `per_round` blir priset 0 kr. Lägg in tjänst 43 eller blockera per_round för FEV.

## 11. Golvpriser

**Ingen tjänst i katalogen har `base_price`** — inte bara 144 och 79, utan även 43, 135, 36 och 9. Kunder utan prislisterad får därför 0 kr överallt, inte bara på tilläggsstationer.

Två åtgärder, båda behövs:
- **Affärsdata:** lägg 144, 79 och 43 i standardprislistan med golvpriser (Christian sätter beloppen).
- **Kod:** åtgärden i 3.1, så att ett misslyckat prisuppslag blir ett blockerande fel i stället för en tyst nolla.

## 12. Vad som ströks ur den ursprungliga planen

**`separate_all` (en tilläggsfaktura för hela kunden).** Fakturamodellens diff är per avtal hela vägen: `loadExisting` filtrerar på `contract_id`, cronens `periodKey(kind, periodStart)` slås upp i `perContract.get(contract.id)`, och konsolideringsgrenen har `periodKey('premium', ...)` hårdkodat på `generate-continuing-contracts.ts:489`. Både generatorn (rad 507) och cronen (rad 460) kodar dessutom in antagandet i klartext: tilläggsfakturor samlas aldrig. En kundövergripande utrustningsfaktura matchar ingen nyckel och skulle skapas på nytt vid varje körning.

Att bygga det kräver `is_consolidated=true` + `contract_id=null` för kind `equipment`, en equipment-variant av `loadConsolidatedPeriodsForContract`, och en typmedveten konsolideringsgren i cronen. Dessutom måste perioden grupperas på `(billing_frequency, billing_anchor_month)` som premien redan gör, eftersom kunder med olika avtalsperioder finns i produktion (Kiab 6501). Och `refreshContractInvoiceBeforeSend` bailar på `is_consolidated` (rad 451), så antalet skulle frysas vid skapandet.

FEV är enda tänkbara användaren och `separate_per_contract` passar dem bättre. Läget läggs till när en kund faktiskt behöver det.

**`addon_price_for_station_type` som fristående SQL-trappa.** Ersatt av den delade RPC:n i avsnitt 7.

**Indexändringen av `cbi_addon_period_line_key`.** Löste ett problem som inte finns; ersatt av eget artikelindex i avsnitt 8.

## 13. Ändringslista

1. **Migration A (buggar först):** backfyllnad av `station_type_id` + trigger, RLS-fix på `station_types`, `equipment_placements` INSERT och `indoor_stations`, 0-kronorsskyddet i `sync_addon_period_lines`, pro rata från markeringsdatum, kind-filter i `covered_by_open_invoice`.
2. **Migration B (modellen):** `station_types.annual_service_id`, tabell `station_type_articles` + RLS + RPC, `article_id` på båda stationstabellerna, index `cbi_addon_article_line_key`, `customers.addon_invoice_mode` + datamigrering.
3. **Migration C (priset):** `effective_service_price`, omskriven `sync_addon_period_lines` (pris per typ, artikelrader per produkt), `sync_addon_prorata_line` per typ.
4. `priceListService`: `getEffectiveServicePrice` blir ett anrop till den delade RPC:n.
5. `stationTypeService`, `StationTypeEditModal`: artikellista och tjänsteval.
6. `EquipmentPlacementForm`, `IndoorStationForm`, `TechnicianEquipment`, `AddStationWizard`: produktval, validering mot typkod, kopiering, `station_type_id` vid create.
7. `addonStationBillingService`: priser per typ, artikelsynk.
8. Kundläget: gemet i avtalskartan, planeraren och cronen läser `customers.addon_invoice_mode`, `contracts.equipment_invoice_mode` läses bort.
9. `ContractEquipmentSection`: produkt och kundpris per enhet och typ, egen rubrik för tilläggens interna kostnad, varning när rad avviker från senast skickade faktura.
10. FEV:s markering enligt avsnitt 10.

**Uppskattning: två arbetsdagar.** Den ursprungliga gissningen på en dag byggde på att fakturamotorn inte behövde röras, vilket inte stämde.

## 14. Öppna punkter

- **Kreditering saknas.** Tas en station bort efter att equipment-fakturan skickats uppdaterar `sync_addon_period_lines` raden medan fakturan står kvar. `refreshEditableEquipmentInvoices` rör bara redigerbara fakturor, så de divergerar tyst. Regel att skriva in: raden speglar nuläget, fakturahistoriken är sanningen, avtalskartan visar en not vid avvikelse.
- **Avslutade avtal.** § 6-rader ligger kvar som `pending` och stationernas `addon_contract_id` pekar på ett dött avtal. Vid terminering bör raderna sättas till `cancelled` och kopplingen nollas.
- **En enhet, ett avtal.** `sync_addon_period_lines` tar `addon_contract_id` från den senast placerade stationen på enheten. Pekar två stationer på olika avtal går synken fel. FEV uppfyller invarianten, men den bör dokumenteras och helst valideras.
- **Månadsavrundning.** `round(v_annual/12, 2)` gånger 12 ger 2 348,04 för 2 348. Kosmetiskt, syns i UI.
- **`adjustment`** i CHECK-constrainten på `contract_invoice_kind` används ingenstans. Kan städas.
