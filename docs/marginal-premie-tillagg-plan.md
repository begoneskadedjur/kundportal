# Marginal per del: premie, tillägg, avtalsrelationen

Plan 2026-09-09. Underlag från tre agenter (ekonomi, data, CRM). Status: väntar på Christians godkännande. Inget är implementerat.

## Frågan

Christian: "Marginalen tar inte hänsyn till tilläggsstationerna, inte heller i pulsen redovisas resultatet av dessa. Tilläggen ingår inte i avtalet, så det är inte fel att de inte ingår i avtalsmarginalen, men de är starkt kopplade till avtalet och borde redovisas."

## Diagnosen

Observationen stämmer, men felet är sammanblandning, inte utelämnande. Motorn räknar redan in tilläggens årspris i intäkten (58 845 = 25 973 + 32 872) och fällornas inköp i kostnaden (48 569), i en enda klump. "Löpande marginal 3,3 %" är ett medelvärde av en premie som går back och ett tillägg som går plus. § 4 visar dessutom fällorna under "Övriga interna kostnader" trots att de är mappade mot § 6-raderna, för § 4 nycklar bara på sina egna rader.

WBAB "Reningsverk, vattenverk och vattentorn" i verkligheten:

| | Intäkt/år | Löpande kostnad | Täckningsbidrag/år | Löpande marginal |
|---|---|---|---|---|
| Premie (§ 4) | 25 973 | 56 896 (arbetstid 56 h) | −30 923 | −119 % |
| Tillägg (§ 6) | 32 872 | 0 | 32 872 | 100 % (utrustning 48 569 engångs, återbetald efter 1,5 år) |
| Avtalsrelationen | 58 845 | 56 896 | 1 949 | 3,3 % |

Premien är underprissatt med cirka 30 000 kr per år. Tilläggen räddar avtalet. Ingen av de två sakerna syns i dag.

## Rekommendation: tre resultat, aldrig ett

Alla tre agenterna landar i samma struktur. Samma motor, körd tre gånger på filtrerade radmängder.

- **Premie**: § 4-rader plus artiklar mappade dit. Intäkt = årspremien. Nyckeltal: täckningsbidrag per år och löpande marginal i procent. Ingen återbetalningstid (ingen utrustning).
- **Tillägg**: § 6-rader plus artiklar mappade dit. Intäkt = summan av § 6-radernas årspris (per månad × 12, per kontroll × besök per år). Nyckeltal: täckningsbidrag per år, varaktig utrustning engångs, återbetald efter. Procenten ensam är brus här, återbetalningstiden är talet som avgör om utsättningen var klok.
- **Avtalsrelationen**: summan. Täckningsbidrag per år, marginal år 1 och över tre år. Aldrig egen färg, aldrig ensam.

**Färgen sätts per del.** Avtalet flaggas rött så snart någon del ligger under minimimarginalen, även om totalen är positiv. WBAB ska synas som ett problemavtal trots plus 1 949 kr.

## Arbetstiden

De 56 timmarna täcker både kontrollbesöken i premien och tillsynen av tilläggsstationerna. Ekonomiagenten föreslår en schablon (minuter per tilläggsstation och besök, global inställning) som dras från premien. Dataagenten avråder från en fördelningsmotor nu.

Rekommendation: **ingen motor i det här steget.** Arbetstiden hör dit den är mappad. Vill man dela lägger man två arbetstidsrader, en mot avtalsraden och en mot en § 6-rad. Omappad arbetstid landar på premien, som i dag, och pulsen visar "varav ofördelat" så att det syns att siffran kan flyttas. Schablonen är nästa steg om det visar sig behövas, och då som en enda global inställning bredvid minimimarginalen, aldrig per avtal.

## § 4 rättas samtidigt

Artiklar som är mappade mot § 6-rader ska inte visas under "Övriga interna kostnader" i § 4. De hör hemma under sin § 6-rad, där de redan visas. § 4 visar bara artiklar mappade mot § 4-rader och riktigt omappade.

## § 5 på pappret

```
§ 5 · Marginal                                        detaljer i pulsen
Premien
5.1  Täckningsbidrag per år ............ −30 923 kr   −119 %  ● röd
     arbetstid 56 h                       56 896 kr
Tilläggsstationer
5.2  Täckningsbidrag per år ............  32 872 kr   ● grön
     varaktig utrustning, engångs         48 569 kr   återbetald efter 1,5 år
Avtalsrelationen
5.3  Täckningsbidrag per år .............  1 949 kr   marginal år 1 −79 % · över tre år −24 %
```

Rad 5.2 visas bara när avtalet har tillägg. Utrustningens "engångs" står alltid utskrivet, så ingen läser den som årskostnad.

## Pulsen

```
Marginal
  Premie          −30 923 kr/år   −119 %   ● röd
  Tillägg         +32 872 kr/år   återbetald efter 1,5 år   ● grön
  ──────────────────────────────────────
  Avtalsrelationen  1 949 kr/år   år 1 −79 % · tre år −24 %
  Avtalsvärde 58 845 kr/år (premie 25 973 + tillägg 32 872) · tillägg 56 % av värdet
  varav ofördelad arbetstid 56 896 kr på premien
```

Etiketten "Löpande marginal" utan prefix tas bort, det var den som skapade förvirringen.

## § 6

Varje stationstyprad får en marginalrad under sina artiklar, samma mönster som § 4: radens årspris mot produktkostnaden, med återbetalningstid.

## Datamodell

```ts
export type ContractPart = 'premium' | 'addons'
export interface ContractMarginParts {
  premium: MarginBreakdown
  addons: MarginBreakdown | null   // null när § 6 saknas
  total: MarginBreakdown           // som i dag
  unallocated_cost: number         // omappade artiklar, redan inräknade i premium
}
```

`splitContractLines(items, { annualValue, visitsPerYear, settings })` i marginEngine.ts: klassar tjänsterader (premium eller addon_contract_mode included → premie, annars tillägg), artiklar via mapped_service_id, tre anrop till summarizeBillingLines. `CaseServiceSummary` får `parts?`. Inga nya kolumner, ingen ny I/O.

Edge: inga § 6 → addons null och dagens utseende. Avrop (premie 0) → "–", aldrig −∞. Per kontroll utan besök per år → "besök per år saknas". Inbakade tillägg (included) räknas som premie och tas inte med i tilläggsintäkten, annars dubbelräknas de. Kompletthetens "arbetstid saknas" läser premiedelen.

Ändrade filer: marginEngine.ts, caseBilling.ts (typ), caseBillingService.ts (getContractMarginSummary), ContractContentSection.tsx (§ 4 filter, § 5), ContractEquipmentSection.tsx (marginal per § 6-rad), ContractSettingsDrawer.tsx (pulsen, kompletthet), contractCompleteness.ts.

## Byggs inte nu

Schablon för arbetstid per station, fördelningsnyckel i databasen, historik per del, marginal i procent på totalen (brus), ändring av fakturaflödet.

## Risker

- Totalen döljer en förlustpremie. Färg per del och rött avtal vid någon del under minimum.
- § 6 klassar artiklar på site_customer_id, motorn på mapped_service_id. Samma klassning i båda, annars stämmer inte listan mot siffran.
- Tilläggens procent ser falskt bra ut år efter år, för utrustningen köptes en gång. Skriv alltid ut återbetalningstiden bredvid.
- Engångskostnad läses som löpande. "engångs" på raden, alltid.

## Tillägg 2026-09-09: tilläggen som resultat över avtalsperioden

Christian: tilläggens kostnad tas en gång, intäkten återkommer år efter år, och plockas en station bort ska resultatet låsas på borttagningsdatumet.

Regel:
- Per station: intäkt = årspris × tid ute (från utsättningsdatum till i dag, till avtalsslutet, eller till borttagningsdatumet). Kostnad = inköpet, en gång. Borttagen station behåller sitt låsta resultat i summan för alltid.
- Tilläggsdelen visar tre tal, aldrig en procent: resultat hittills, resultat till avtalsslut (med option som underrad), brytpunkt (månad då intäkten passerat inköpet). Färgen sätts på "till avtalsslut".
- Datum finns: equipment_placements.placed_at och status_updated_at vid removed (samma på indoor_stations), contracts.contract_end_date och option_until.
- WBAB Reningsverk: 14 stationer satta aug–sep 2026, 32 872 kr/år, fällor 48 569 kr. Hittills −47 500, till 2028-06-29 +11 700, med option till 2030 +77 400, brytpunkt mars 2028.

Ändrar inte premiedelen. Kräver att marginEngine får en tidsdimension för tillägg (per station), inte bara årsbild. Artifact uppdaterad: https://claude.ai/code/artifact/d5fc29d0-7729-4d42-b1c6-7e30df88fe96

## Status 2026-09-09: BYGGT, ej browser-testat

- Migration `20260909_tillagg_ledger.sql` (applicerad): `addon_unit_price_annual` + `addon_unit_cost` på equipment_placements och indoor_stations, trigger `addon_station_snapshot` fyller från prislista/artikel, backfill (WBAB: 20 mekaniska 2 348, 1 ljusfälla 1 686), RPC `contract_addon_ledger(p_contract_id)` läser stationerna (även borttagna, `status_updated_at` = borttagningsdatum).
- `src/shared/addonLedger.ts`: `computeAddonLedger` (per station, per typ, per § 6-rad; hittills/till avtalsslut/med option/brytpunkt). `src/hooks/useAddonLedger.ts`.
- `splitContractLines` i marginEngine → `CaseServiceSummary.parts` (premium/addons/total). Kompletthetsraden räknar arbetstid på `parts.premium`.
- § 4: artiklar mappade mot § 6-rader räknas inte längre som premiens övriga kostnader. § 5: Premien / Tilläggsstationer / Avtalsrelationen. § 6: ledgerrad per rad. Pulsen: Marginal i tre delar + "Tillägg över tid".
- Gårlångens ljusfälla-rad rättad 2 348 → 1 686.
