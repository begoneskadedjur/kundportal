# Plan: stationstyper med produkt och pris, samt fakturering av tilläggsstationer

Status: skriven 2026-09-04 efter två expertgranskningar (stationsflöde respektive ekonomi). EJ byggd. Bygger vidare på `docs/tillaggsstationer-tre-modeller-plan.md` (byggt och pushat 2026-09-03).

## 1. Bakgrund

Tilläggsstationer har sedan 2026-09-03 tre betalningsmodeller (per år, per månad, per kontroll) och två avtalslägen (inbakat i premien via § 7, tillägg utöver avtalet via § 6). Det som saknas:

1. Kundpriset hämtas från EN årstjänst (kod 144) oavsett stationstyp. FEV har 2 348 kr/år för fällor och 1 686 kr/år för ljusfällor (tjänst 79). Ljusfällorna får därför fel pris.
2. Den fysiska produkten som placeras ut registreras inte. Kunden köper "Tilläggsstation per år" men vi sätter ut Aurotrap Nature, AF Atom, plåtlåda eller PW Titan 300, och den interna kostnaden syns inte.
3. Faktureringsläget för tilläggsstationer sitter per avtal (`contracts.equipment_invoice_mode`, with_premium eller separate) och har bara två lägen. Christian vill ha tre, på kundnivå.

## 2. Beslut (Christian 2026-09-04)

- **Produktnamn:** använd aldrig leverantörens produktnamn mot kund. Stationstypen heter "Mekanisk fälla", produkten är intern.
- **Produktuppdelning hos FEV:** mekaniska fällor = Aurotrap Nature (405220), betesstationer inomhus = AF Atom (502001), betesstationer utomhus = plåtlåda (500501), ljusfällor = PW Titan 300 (102102).
- **Marginalen:** produkten läggs som engångskostnad utan avskrivning. Att § 5 då visar minus är accepterat och rättas senare. Bygg ingen avskrivningsmodell nu.
- **Alla FEV:s 35 stationer är tillägg per år**, inklusive betesstationerna. Inget ingår i premien.
- **Stationen följer enheten:** tilläggsstationen hamnar på det avtal som täcker enheten, automatiskt.
- **Allt ska gå att göra i systemet framgent**, inte genom instick i databasen.

## 3. Tre faktureringslägen för tilläggsstationer (kundnivå)

Ersätter `contracts.equipment_invoice_mode`. Ny inställning på kunden, satt från gemet i avtalskartan:

| Läge | Innebörd |
|---|---|
| `with_contract` | Följer kundens faktureringsläge för avtalen. Fakturerar kunden alla avtal samlat hamnar tilläggen på den samlade fakturan; fakturerar kunden avtalen var för sig hamnar de på det avtal enhetens station tillhör. |
| `separate_all` | Kundens alla tilläggsstationer på EN egen faktura, utöver avtalspremien, oavsett hur avtalen faktureras. |
| `separate_per_contract` | En egen tilläggsfaktura per avtal (dagens `separate`). |

Standard för nya kunder: `with_contract`. FEV får `separate_all` eller `separate_per_contract` beroende på hur Fortnox 648, 744, 745 och 862 ska motsvaras (fyra separata fakturor talar för `separate_per_contract`).

## 4. Stationstypen får produkt och pris

`station_types` får:
- `annual_service_id uuid references services(id)` — tjänsten som bär kundpriset per år. Mekanisk fälla, betesstation, plåtstation, betongstation → tjänst 144. Ljusfälla → tjänst 79.
- Ny tabell `station_type_articles (station_type_id, article_id, is_default, sort_order)` med partiellt unikt index på ett förval per typ. Artiklarna teknikern kan välja mellan.

`services.used_for_addon_stations_annual` (kod 144) behålls som fallback när typen saknar tjänst.

**Redigeras** i `StationTypeEditModal.tsx` (mönster finns i `ServiceCatalogEditModal.tsx:479-512`). Skrivning via SECURITY DEFINER-RPC `set_station_type_articles` så listan byts atomärt.

## 5. Teknikern väljer produkt vid utsättning

- `equipment_placements.article_id` och `indoor_stations.article_id`.
- Fältet visas under stationstypen med typens artiklar, förvalet ifyllt.
- Nollställs vid typbyte (`handleTypeSelect`), valideras mot typens lista precis som preparat (`EquipmentPlacementForm.tsx:311-319`).
- Följer med i "kopiera från föregående station" (`lastArticleId` i `TechnicianEquipment.tsx` och `AddStationWizard.tsx`), nollställs vid kundbyte.
- Gäller alla stationer, inte bara tillägg.

## 6. Priset per stationstyp

`sync_addon_period_lines` slår i dag upp tjänsten en gång före loopen och tar `p_annual_price` från klienten. Ändras till uppslag per stationstyp inne i loopen, via ny SQL-funktion `addon_price_for_station_type(station_type_id, customer_id)` som replikerar prislistetrappan (avtalets lista → kundens → standard → `services.base_price` → 0).

Signaturen `p_annual_price` behålls som override (används av `AddonDropPrompt` när användaren skriver in ett pris manuellt), men null betyder "slå upp per typ".

`AddonStationBillingService.getAddonPrices` blir per stationstyp. Det påverkar `AddonPrices`-typen, `AddonModelPicker`, `AddonDropPrompt`, `TechnicianEquipment` och `AddStationWizard`.

## 7. Produkten som intern kostnad

`sync_addon_period_lines` skapar per (avtal, enhet, stationstyp) ett radpar:
1. Tjänsteraden som i dag, med typens tjänst, `billing_model per_year|per_month`.
2. En artikelrad: `item_type='article'`, `article_id` = stationernas produkt, `billing_model='premium'` (CHECK `cbi_billing_model_contract_only` tillåter inget annat på artiklar), `site_customer_id`, `station_type_id`, `mapped_service_id` = tjänsteradens id, `unit_price` = `articles.default_price`.

Artikelrader når aldrig fakturan: både `contractInvoiceGenerator.loadContractSources` och cronens `loadSources` filtrerar `item_type='service'`.

**Indexändring:** `cbi_addon_period_line_key` utökas med `item_type`, annars kan artikelraden krocka med tjänsteraden.

## 8. Två buggar som måste med

1. **743 stationer saknar `station_type_id`** (620 av dem Stockholms stad, importerade; 32 av FEV:s 35). Utrustningssidan döljer det genom textfallback (`equipmentService.ts:53-67`), men prisuppslaget behöver kopplingen. Alla matchar på kod om man normaliserar versaler: "Betongstation" mot "betongstation", "Plåtstation" mot "platstation". Backfyllnad plus en trigger eller servicelogik som alltid sätter `station_type_id` vid skapande, så diffen inte kan uppstå igen.
2. **RLS-bugg på `station_types`:** admin-policyn matchar `profiles.id = auth.uid()` i stället för `profiles.user_id`. Sju av 26 profiler har olika värden, de kan inte redigera stationstyper. Samma bugg som rättades för `equipment_placements` i migration `20260903_tillaggsstationer_modeller.sql:369-381`.

## 9. FEV:s 35 stationer

Utplacerat (verifierat 2026-09-04): Återvinningscentralen 3 mek + 1 betes ute, 4 mek + 2 ljus inne. Huvudkontor 3 mek. Kraftvärmeverk 3 betes. Boda 2 mek + 2 ljus. Enviken 2 mek + 4 ljus. Främby 2 betes. Linghed 2 mek + 2 ljus. Vika 2 betes + 1 ljus. Sågmyra saknar stationer. Summa 16 mekaniska fällor, 8 betesstationer, 11 ljusfällor.

Ordning, via systemet:
1. Stationstyp på alla 35 (backfyllnaden i punkt 8).
2. Produkt per station enligt punkt 2.
3. Markera som tillägg, per år.
4. Avtalsläge tillägg utöver avtalet, kopplat till det avtal som täcker enheten.
5. Synk av § 6 och kontroll av antal och priser.
6. Fortnox-koppling av 648 (Återvinningscentralen), 745 (KVV), 862 (Huvudkontor), 744 (reningsverken) som `contract_invoice_kind='equipment'`.

`billing_start_date` blir 2027-07-01 automatiskt, vilket är rätt: perioden fram dit är betald via F-643 (35 114 kr exkl. moms, 43 893 kr inkl.). Kontrollera att ingen § 6-rad får startdatum före 2027-07-01, annars dubbelfaktureras den betalda perioden.

## 10. Ändringslista

1. Migration: `station_types.annual_service_id`, tabell `station_type_articles` + RLS + RPC, `article_id` på båda stationstabellerna, RLS-fix på `station_types`, index­ändring `cbi_addon_period_line_key`, backfyllnad av `station_type_id`.
2. Migration: `addon_price_for_station_type`, omskriven `sync_addon_period_lines` (pris per typ, artikelrad), `sync_addon_prorata_line` per typ.
3. Kundnivåns faktureringsläge: kolumn på `customers`, gemet i avtalskartan, planeraren och cronen läser det i stället för `contracts.equipment_invoice_mode`.
4. `stationTypeService`, `StationTypeEditModal`: artikellista och tjänsteval.
5. `EquipmentPlacementForm`, `IndoorStationForm`, `TechnicianEquipment`, `AddStationWizard`: produktval och kopiering.
6. `addonStationBillingService`: priser per typ, artikelsynk.
7. `ContractEquipmentSection`: visa produkt och kundpris per enhet och typ, egen rubrik för tilläggens interna kostnad.
8. FEV:s markering enligt punkt 9.

Uppskattning: en arbetsdag, cirka 600 rader varav hälften SQL. Fakturamotorn (`contractPlanner`, `contractInvoiceGenerator`) behöver inte röras utöver läget i punkt 3.

## 11. Öppna frågor

- Vilket av de tre lägena ska FEV ha? Fyra separata Fortnox-fakturor talar för `separate_per_contract`.
- Ska betongstation ha egen tjänst eller dela 144?
- Golvpris för tjänst 144 och 79 i standardprislistan saknas (båda har `base_price = null`), så kunder utan prislisterad får 0 kr.
