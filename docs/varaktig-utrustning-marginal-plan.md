# Plan: varaktig utrustning och marginal genom hela systemet

Status: skriven 2026-09-05 efter två expertgranskningar (ekonomi respektive CRM/arkitektur), alla siffror verifierade mot produktionsdatabasen. BYGGD och pushad 2026-09-05, EJ browser-testad. Avvikelser från planen: fångstbur duvor flaggas inte (verktyg, aldrig obevakad längre än ett dygn); max_payback_years bor i prisinställningarna bredvid min/mål, inte i artikelregistret; treårsmarginalen är med i § 5 och avtalsförslaget; RPC dokumentsignering_statistik lämnad (år 1); HeroMetrics visar marginal efter all kostnad med tydligare etikett i stället för löpande. Ett tidigare försök (commit e4cf43b4) reverterades i 8f2552a6: det byggde på en regex på artikelnamn, konsumerades ingenstans och bröt avtalskartans layout.

## 1. Problemet

Dyra produkter (Aurotrap 3 550 kr, Titan 300 2 419 kr, betongstation 900 kr) står kvar hos kunden i flera år, men marginalen räknas överallt som (årsintäkt minus hela inköpet) genom årsintäkt. Ett avtal med 22 156 kr/år och 29 796 kr i utrustning visar minus 39 procent trots att det ger plus 22 156 kr varje år från år två.

Alla 650 levande avtal är rullande (`renewal_mode = rolling`): de fortsätter tills kunden säger upp, och över 90 procent stannar. Det finns alltså ingen avtalsperiod att fördela kostnaden över, och ingen avskrivning ska byggas. Bokföringen (direktavdrag som förbrukningsinventarie under ett halvt prisbasbelopp) är rätt och rörs inte. Det som ska rättas är den interna lönsamhetsbilden.

Utrustningen är en tredjedel av all registrerad avtalskostnad (616 000 kr av 1,9 mkr, koncentrerad till 44 avtal). Arbetstid är två tredjedelar och ska aldrig fördelas.

## 2. Beslut

- **Kryssruta per artikel: "Varaktig utrustning"** (`articles.is_durable`). Sätts i artikelregistret. Kriteriet är inte pris utan: vi bekostar den, den står kvar hos kunden i mer än ett år, och avtalet (inte fakturan) betalar tillbaka den. Arbetstid, underentreprenör, beten, medel, limskivor, batterier, CO2, installationsmaterial (nät, vajer, piggar, tätning) och våra egna verktyg är aldrig varaktiga.
- **Huvudtal på avtal: löpande marginal** (utan varaktig utrustning). Bredvid alltid: utrustning i kronor engångs och återbetalningstid. Marginal år 1 (dagens siffra) visas som grå referens. De tre talen är EN presentation och visas aldrig var för sig.
- **Huvudtal på ärenden och fakturor: marginal år 1** som i dag. Ett engångsjobb har ingen återkommande intäkt att ställa utrustningen mot; antingen betalar fakturan för fällan (då är år 1 rätt) eller så ska den in i ett avtal via avtalstillägg. Flaggan ger bara en informationsrad "varav varaktig utrustning X kr".
- **En motor.** Alla vyer läser samma beräkning. I dag räknar tolv ställen själva med fem olika färgtrösklar (35/20, 50/30, 0/15, 30/15, 40/20).
- **Prisguiden rörs inte.** Den sätter kundpris som inköp gånger påslag och ska fortsätta göra det oavsett flagga.

## 3. Definitioner

Alla belopp exklusive moms. Kostnad tas från artikelradens `total_price`, aldrig från `articles.default_price` live.

| Tal | Formel |
|---|---|
| Intäkt | Summa tjänsterader (se avsnitt 6 om intäktsbasen på avtal) |
| Kostnad total | Summa artikelrader |
| Utrustning | Artikelrader där `articles.is_durable = true` |
| Löpande kostnad | Kostnad total minus utrustning |
| Arbetstid | Artikelrader där `articles.category = 'Arbetstid'` (ingen regex behövs) |
| Marginal år 1 | (Intäkt minus kostnad total) / Intäkt. Dagens `calculateMarginPercent`. |
| Täckningsbidrag löpande | Intäkt minus löpande kostnad, kronor per år |
| Löpande marginal | (Intäkt minus löpande kostnad) / Intäkt |
| Återbetalningstid | Utrustning / täckningsbidrag löpande. **Mot täckningsbidraget, inte mot bruttointäkten**, annars är fällan "återbetald" innan arbetstiden är täckt. Bidrag noll eller negativt: "återbetalas inte". Utrustning noll: visas inte. |

Avtal utan varaktig utrustning: löpande marginal är lika med år 1, utrustningsraden visas inte, etiketten blir bara "Marginal". Samma funktion, inget specialfall.

**Spärr:** löpande marginal är exakt så bra som arbetstidsraderna. Lyfts utrustningen bort är arbetstid i praktiken enda kostnaden kvar, och saknas den visar systemet 95 till 100 procent. Avtal med `visits_per_year > 0` och mindre än en timme arbetstid per besök får texten "arbetstid saknas" i stället för en procentsiffra. Av 27 aktiva avtal med utrustning träffas 5 av spärren i dag, FEV inräknat (1 timme för 4 besök och 10 stationer).

**Tröskelvärden:** `min_margin_percent` (20) och `target_margin_percent` (35) gäller löpande marginal på avtal, år 1 på ärenden. Ny inställning `max_payback_years` (förslag 2,0) ger varning när återbetalningstiden överstiger den. Motivering för 2,0: LOU-avtalen löper 3 år, två år lämnar ett år ren vinst innan kunden kan lämna.

**Valfritt fjärde tal i avtalsförslag:** marginal över 3 år = (3 × intäkt minus 3 × löpande minus utrustning) / (3 × intäkt). Ett ärligt jämförelsetal mellan avtal med och utan utrustning, ingen bokföringsregel.

## 4. Förval för kryssrutan

Sätts i migrationen, Christian granskar i artikelregistret.

**Varaktig:** Aurotrap Nature (405220), Aurotrap Collect (405221), Aurotrap Collect Guard (sitter fast på fällan), PW Titan 300 (102102), PW Nemesis X (102230), PW Chameleon 1x2 (101204), PW Chameleon Uplight (101202), Betongstation (BEK-BET), AF Underground betesstation, Betesstation vägg galvad plåt (500501), AF Atom (502001), AF Rat Box, AF Multis, Ställ för Chameleon, Avloppsfälla råtta, Eagle Eye vinddriven, Extreme Sound System, EA Bird Breezer Flash, Daddi Long Legs, Goodnature A24-kit, Exhale Dispenser.

Billiga stationer (plåtlåda 108 kr, Atom 61 kr) flaggas av konsekvensskäl: annars avgör priset, och nästa fråga blir var gränsen går. Effekten i kronor är försumbar.

**Inte varaktig:** all arbetstid och Hundsök (tjänster), Exacticide-kit och Cimex Eradicator (egna verktyg, borde inte vara ärendekostnad alls), tänger och sprutor, Rodexit tätningslist, fågelnät, vajer, alla beten och medel (Talon, Aquapy, Harmonix, Sewer block, Ratimor, Racumin, K-Othrine, Maxforce), batterier och CO2, limskivor, slagfällor, silverfiskfällor, madrassöverdrag, skyliftshyra.

**Christian avgör:** Fångstbur duvor (1 596 kr). Står den kvar under avtalet är den varaktig; hämtas den hem efter jobbet är den ett verktyg.

## 5. Fällor som planen hanterar

**Kund som säger upp inom år ett.** Löpande marginal säger då inget om förlusten, och det är rätt: den beskriver ett avtal som fortsätter. Förlusten visas i stället vid uppsägning som "resultat under avtalstiden" = verkligt fakturerat minus löpande kostnad för perioden minus utrustning. Bara 2 av 650 avtal har lämnat inom år ett (HSB Tallen: cirka minus 2 400 kr).

**Utrustning som tas bort, flyttas eller skrotas.** Kostnaden stannar på avtalet där den köptes. Flyttas en fälla till annan kund läggs den där som artikelrad med pris 0 och notering "flyttad från X". Ingen flyttlogik byggs; 902 av 922 placeringar saknar ändå `article_id`.

**Avtalstillägg via ärende.** Utrustningen bokförs på ärendet men intäkten höjs på avtalet, så avtalets löpande marginal stiger utan att fällan syns där. Åtgärd: när tillägget skrivs till avtalet kopieras den varaktiga raden till avtalets § 6 med notering "från ärende Y".

**Ekonomidashboarden.** Får aldrig bara exkludera utrustning, då överdrivs årsresultatet med allt som placerats. Tre serier per månad (intäkt, löpande kostnad, utrustning placerad) och två resultat: "löpande resultat" och "resultat efter utrustning". Det andra är den verkliga kassaeffekten och visas alltid.

## 6. Datafel som måste rättas i samma leverans

1. **Intäktsbasen i § 5 saknar årspremien.** § 5 summerar tjänsterader, men premieraden på FEV Återvinningscentralen står på 0 kr medan `annual_value` är 6 842. Avtalsvärdet som visas (22 156) saknar hela premien; rätt är 28 998. På aktiva avtal avviker 11 av 68 från `annual_value`, 4 har premieraden på noll. Årsintäkt på avtal definieras om: `annual_value` + per_year-rader + per_month-rader × 12 + per_round-rader × `visits_per_year`. Premieraden blir en beskrivning, inte en intäktskälla.

2. **Ekonomidashboarden räknar kostnad som `default_price × quantity`** på fyra ställen (`economicsServiceV2.ts` rad 250, 320, 649, 716). För doseringsartiklar är quantity i gram eller ml och priset per förpackning. Verifierat: en K-Othrine-rad på 3 390 kr räknas som **871 200 kr**. Byts till radens `total_price`. Kurvorna i /admin/ekonomi kommer att hoppa vid deploy; förvarna.

3. **§ 6 etiketterar tilläggsstationernas produktrader "Ingår i premien"** (`ContractEquipmentSection.tsx:141-160`) eftersom `sync_addon_article_lines` skriver `billing_model='premium'` på dem. Artikelrader faktureras aldrig, så fältet saknar betydelse där; klassningen ska gå på vad raden är mappad mot. Rader med `site_customer_id` eller mappade mot en per_year/per_month-tjänsterad grupperas under "Tilläggsstationer, intern kostnad". RPC:n rörs inte (använder fältet som idempotensnyckel).

4. **§ 5 döljs helt när avtalet saknar premietjänsterader** (villkoret `services.length > 0`). Ett avtal med enbart tilläggsstationer får ingen marginalparagraf. Villkoret byts till `service_count > 0` i summeringen.

5. **Sidopanelen visar marginalen som pill-badge** (`CustomerDetailSidePanel.tsx:665`). Byts till platt text med statuspunkt.

## 7. Bygget

### A. Migration
```sql
alter table public.articles add column is_durable boolean not null default false;
comment on column public.articles.is_durable is
  'Varaktig utrustning som står kvar hos kunden i flera år (stationer, fällor). Engångskostnad i marginalen, inte löpande.';
alter table public.pricing_settings add column max_payback_years numeric not null default 2.0;
update public.articles set is_durable = true where code in (...förvalslistan...);
```
Ingen RLS-ändring: artiklar läses redan av alla inloggade och flaggan avslöjar inget om pris. Att kundrollen kan läsa `default_price` och artikelrader via `cbi_customer_read` är ett separat, redan känt hål (234 rader hos 57 kunder) som åtgärdas för sig.

### B. Motor
Ny `src/shared/marginEngine.ts` utan supabase-import (så utkast i wizards kan använda den): `summarizeBillingLines(items, settings, context: 'contract' | 'case') -> MarginBreakdown` och `marginTone(pct, settings)` som enda källa för färg.

```ts
interface MarginBreakdown {
  revenue: number
  cost_total: number
  cost_durable: number
  cost_ongoing: number
  labour_cost: number
  labour_hours: number
  labour_missing: boolean
  consumable_cost: number
  margin_percent_year1: number | null
  margin_percent_ongoing: number | null
  contribution_ongoing: number
  payback_years: number | null
  payback_never: boolean
  durable_lines: Array<{ article_name: string; quantity: number; cost: number }>
}
```

`CaseBillingService.getCaseServiceSummary` och `getAccumulatedSummaryForCases` returnerar `breakdown` och anropar motorn. `margin_percent` behålls som år 1 under övergången. Selecten i den ackumulerade varianten får `article:articles(is_durable, category)`. Enhetstest med vitest (mall: `src/shared/fortnoxCustomerNumbers.test.ts`), inklusive fallet "artikel utan relation" som annars tyst räknas som förbrukning.

### C. Vyer som byter till motorn
| Fil | Ändring |
|---|---|
| `CaseServiceSelector.tsx:391-396` | motor med `context: 'case'`, indikatorn visar år 1 + "varav varaktig" |
| `ServiceCostBreakdown.tsx:81-107` | motor, egna trösklar 50/30 bort, tar `PricingSettings` |
| `InvoicePulseRow.tsx:73-91`, `useInvoicePulse.ts:16-17` | motor med `invoice.subtotal` som intäkt, trösklar från settings |
| `InvoiceDetailModal.tsx:1906-1910`, `ContractInvoiceModal.tsx:141-145` | select får relationen, negativkoll via motor |
| `ContractContentSection.tsx` | § 5 enligt D, § 4 per tjänst via motor, villkoret i punkt 6.4, intäktsbasen i 6.1 |
| `ContractEquipmentSection.tsx:141-160` | etikett enligt 6.3 |
| `CustomerDetailSidePanel.tsx:665-668` | läs `breakdown`, pill bort |
| `OneflowContractCreator.tsx:1668-1750` | motor med `context: 'contract'`, alla tal inklusive år 1 synligt (säljaren ska se att år 1 går back), 35/20 bort, hint på varaktig artikel: "säljs oftast som årspris (tjänst 144), inte engångsköp" |
| `OfferItemsSection.tsx:50-54` | motor, verifiera att relationen laddas |
| `contractService.ts:300-335` | select får relationen, `breakdown`, `margin_pct` blir löpande; pipeline-gränserna 30/15 mot settings |
| `economicsServiceV2.ts` fyra funktioner | `total_price` i stället för live-pris, `is_durable` i uppslaget, nya serier |
| `useCustomerRecord.ts:565-575`, `WorkChainSection.tsx:132-228` | relation + motor |
| `contractAdditionService.ts:208` | kopiera varaktig rad till avtalets § 6 |
| RPC `dokumentsignering_statistik` | kan skjutas; märks "år 1" i UI tills vidare |

Rörs inte: `PriceCalculatorPanel.tsx`, `PrissattningDemo.tsx`.

### D. § 5 på avtalskartan
Utan varaktig utrustning: dagens remsa oförändrad. Med varaktig utrustning: ledger i samma rytm som § 4 och § 6 (radnummer `w-6 text-[11px]`, serif `text-[13.5px]`, prickad ledare `border-dotted border-[#d9d3c2]`, belopp `tabular-nums`). Ingen kursiv förklaring under, förklaringen bärs av radnamnen "per år" och "engångs".

```
§ 5 · MARGINAL
5.1  Avtalsvärde per år ································       28 998 kr
5.2  Löpande kostnad per år   arbetstid 1 016 ··········       −1 016 kr
     Täckningsbidrag per år        27 982 kr        96,5 %  löpande marginal
5.3  Varaktig utrustning, engångs   Aurotrap × 7 · Titan × 2 · plåtlåda × 1   −29 796 kr
     Återbetald efter 1,1 år                              år 1: −6,3 %  marginal
```

Procenten på täckningsbidragsraden färgas av `marginInk(margin_percent_ongoing)`. År 1 alltid grå, aldrig färgad. Vid arbetstidsspärr ersätts procenten med "arbetstid saknas" i `#9b3535`. Vid `payback_never`: "återbetalas inte med nuvarande löpande kostnad". Varningsbanderollen triggas bara av löpande marginal under min.

### E. Artikelregistret
`ArticleEditModal.tsx`: kryssruta "Varaktig utrustning" i blocket vid rad 641 (ovanför ROT/RUT), dold för kategorin Arbetstid, mönster från `is_dosage_product`, klasserna `text-[#20c58f] focus:ring-[#20c58f]`. `ArticlesTable.tsx:405`: liten textrad "Varaktig utrustning" under namnet, ingen pill. Typer i `types/articles.ts`, service i `articleService.ts`.

### F. Ordning och tid
1. Migration, typer, artikelregister, förval: 1,5 h. Ger Christian flaggorna att granska direkt.
2. Motor + test: 3 h
3. § 5, § 4, § 6-etikett, intäktsbas, sidopanel: 3,5 h
4. Ärendemodal, offert, avtalsförslag: 3 h
5. Fakturamodaler och puls: 2,5 h
6. Avtalsaggregat och pipeline: 2 h
7. Ekonomidashboard (bugfix + nya serier): 3 h
8. Kundkortets intäkter: 1,5 h
9. Typkontroll mot baseline, lint på rörda filer, browsertest FEV, Maserfrakt, Meteoren: 2 h

Cirka 22 timmar, tre arbetsdagar. Steg 1 till 3 ger synligt resultat på avtalskartan först.

## 8. Öppna beslut

1. Fångstbur: varaktig eller verktyg?
2. `max_payback_years` = 2,0?
3. Marginal över 3 år som fjärde tal i avtalsförslaget: ja eller nej?
4. Förvarning till den som läser /admin/ekonomi: kurvorna ändras när doseringsbuggen rättas.
