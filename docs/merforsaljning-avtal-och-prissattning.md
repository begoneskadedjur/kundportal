# Merförsäljning Avtal + prissättnings-arkitekturen

**Datum:** 2026-04-20
**Branch:** main (mergat via `feat/merforsaljning-avtal`)
**Commit:** `2ec7e4c6` (merge: `6163642f`)

---

## 1. Syfte & bakgrund

Systemet hade två sammanflätade problem som båda löstes i denna refaktor:

1. **Avslutade avtalsärenden syntes inte på `/admin/fakturering`** — de blandades in i årspremien med fel datum pga en tidszon-bugg + fel datumkälla.
2. **Prislistornas ansvar var oklart** — prislistor användes både för tjänster och för artiklar, vilket skapade dubbel bokföring av pris och omöjliggjorde en clean marginal-beräkning.

Resultatet är en tydlig separation:
- **Artiklar = interna kostnader** (vad vi betalar för råvaran)
- **Tjänster = försäljningspriset** (vad kunden betalar)
- **Prisguiden** är bryggan som lägger artikelkostnader *inuti* en tjänst och räknar ut marginal

---

## 2. Artikelarkitekturen — "interna kostnader"

### 2.1. Vad är en artikel?

En artikel (`articles`-tabellen) är en enskild fysisk eller tids-baserad kostnad vi själva har:

- **Kemikalier**: t.ex. "Fågelpigg 306" à 780 kr
- **Arbetstimmar**: "Servicetekniker timme" à 650 kr
- **Förbrukningsmaterial**: "Betesstationer", "Fällor"

### 2.2. `articles.default_price` = intern kostnad, ALLTID

Detta är hårda regler som gäller efter refaktorn:

- `articles.default_price` representerar **enbart** vad artikeln kostar oss att köpa in eller utföra
- Artiklar prissätts **aldrig** mot kund direkt via en prislista
- Priset är statiskt — alla kunder har samma interna kostnad för samma artikel

### 2.3. Varför artiklar inte längre ligger i prislistor

Tidigare blandades artikel- och tjänstepriser i samma `price_list_items`-tabell. Efter refaktorn:
- `price_list_items` har både `article_id` och `service_id` (XOR via CHECK-constraint)
- **Nya flöden skriver bara service-rader** (artikel-rader lever kvar som historik)
- `customer_contract_articles` används fortfarande av `BillingSettingsModal` för att lagra avtalsartiklar på kund-nivå (orörd — gammalt flöde)

---

## 3. Tjänsterna — "försäljningspriset"

### 3.1. Vad är en tjänst?

En tjänst (`services`-tabellen) är det kunden faktiskt köper:

- "Inspektion Fågel" — 900 kr för att vi åker ut och inspekterar
- "Tak-skyddsbehandling" — en komplett behandling med arbetstid + material
- "Årskontroll råtta"

### 3.2. Prissättningskällor (fallback-kedja)

När en tjänst ska prissättas för ett ärende används denna kedja, i ordning:

1. **Kundens prislista (`price_list_items.service_id`)** — om kunden har en egen prislista med denna tjänst → använd det fasta priset
2. **Prisguidens markup-förslag** — annars räkna (summan av artikelkostnader) × (1 + markup%)
3. **Manuell override** via `case_billing_overrides` — säljare/koordinator kan alltid skriva över med ett förhandlat pris

### 3.3. Årspremie kontra extra-tjänster

- **Årspremien** styrs av `customers.annual_premium` + `customers.price_adjustment_percent`
  - Oförändrad av prislistor
  - Faktureras enligt `billing_anchor_month` + `billing_frequency`
- **Kundens prislista** gäller endast *extra* tjänster utöver avtalet (merförsäljning)

---

## 4. Prisguiden — hur kostnader läggs *inuti* tjänster

Prisguiden har två roller. Det är viktigt att förstå skillnaden.

### 4.1. Roll 1: Artikel → tjänst-mappning (alltid aktiv, per ärenderad)

- `case_billing_items.mapped_service_id` pekar varje **artikelrad i ett ärende** till en tjänst den hör till (inte globalt på artikel-typen)
- CHECK-constraint `mapped_service_only_for_articles` garanterar att fältet bara kan sättas när `item_type = 'article'`
- Mappningen sätts per ärende via dropdownen i [CaseServiceSelector.tsx](../src/components/shared/CaseServiceSelector.tsx) — samma artikel kan höra till olika tjänster i olika ärenden
- Används ALLTID, oavsett om kunden har fast pris eller inte
- Syfte:
  - **Marginalberäkning**: (tjänstens pris) − (summan av artikelradernas kostnader med `mapped_service_id = tjänsten` för just det ärendet) = marginal
  - **Ärenderapport**: vi kan visa vad som användes i ärendet både för kund och internt

### 4.2. Roll 2: Prisförslag via markup (villkorligt)

- `services.recommended_markup_percent` + `services.recommended_markup_percent` (default 40%) driver en slider
- Slidern räknar: `pris = artikelkostnader × (1 + markup%)`
- **Pausas** när kundens prislista har ett fast pris för tjänsten
  - För då är priset redan bestämt; markup används bara internt för marginalen
- **Aktiv** när kunden saknar fast pris i prislistan
  - Då blir markup-förslaget det faktiska försäljningspriset (kan fortfarande skrivas över manuellt)

### 4.3. Konkret exempel

> Ärende BE-0008300 (avslutat 2026-04-20)
>
> - Tjänst: "Inspektion Fågel" → **900 kr** (från kundens prislista, fast pris)
> - Artikel 1: "Inspektion Fågel" (arbetstid/tjänstepost) → **900 kr**
> - Artikel 2: "Fågelpigg 306" (material) → **780 kr**
>
> Faktureras till kund: **1 680 kr** (900 + 780)

Kopplingen lagras i `case_billing_items` där artiklarna har `mapped_service_id` som pekar till tjänsten.

---

## 5. Faktureringsflöden — tre typer

Systemet har tre distinkta faktureringsflöden, som förr kolliderade men nu är helt separerade.

### 5.1. Privat- & företagskunder (engångsfaktura per ärende)

- **Datakälla**: `case_billing_items` per ärende + `invoices` / `invoice_items`
- **Trigger**: Ärende avslutas med pris satt
- **UI**: `/admin/fakturering` → fliken **"Privat & Företag"**
- **Service**: `InvoiceService.createInvoiceFromCase`
- **Datum**: ärendets `completed_date`
- **Egenskap**: en faktura per ärende, inget återkommande

### 5.2. Avtalskunder — årspremie (återkommande)

- **Datakälla**: `contract_billing_items` med `item_type = 'contract'`
- **Trigger**: Månadsvis batch driven av `billing_anchor_month` + `billing_frequency` per kund
- **UI**: `/admin/fakturering` → fliken **"Avtalskunder"** (`MonthlyBillingPipeline`)
- **Service**: `ContractBillingService.getMonthlyPipelineData` (filtrerar nu *endast* `item_type = 'contract'`)
- **Datum**: `billing_period_start` (månadens första dag)
- **Egenskap**: täcker `customers.annual_premium` uppdelat per period
- **Statusflöde**: pending → approved → invoiced → paid (+ cancelled)

### 5.3. Avtalskunder — merförsäljning (NYTT, per ärende/månad)

> Detta är hela syftet med refaktorn.

- **Datakälla**: `contract_billing_items` med `item_type = 'ad_hoc'`
- **Trigger**: Avslutat avtalsärende med pris (`createAdHocItemsFromCase`)
- **UI**: `/admin/fakturering` → fliken **"Merförsäljning Avtal"** (ny!)
- **Service**: `ContractBillingService.getAdhocSalesPipelineData`
- **Datum**: `invoice_date` = ärendets `completed_date` (trumfar allt annat)
- **Egenskap**: helt separat från årspremien — syns inte på "Avtalskunder"-fliken

#### Gruppering — ny kundinställning

I `BillingSettingsModal` finns nu en kolumn `adhoc_invoice_grouping` per kund:

- **`per_case`** (default): en faktura per avslutat ärende
- **`monthly_batch`**: slå ihop alla merförsäljningsärenden för samma månad till en samlad faktura

Inställningen ligger i `Faktureringssättet`-sektionen som ett select: *"Merförsäljning från ärenden"*.

#### Konkret fall: BE-0008300

- Avslutat 2026-04-20 kl 17:15 svensk tid
- 2 rader i `contract_billing_items`:
  - `item_type = ad_hoc`, artikel "Inspektion Fågel", 900 kr, `invoice_date = 2026-04-20`
  - `item_type = ad_hoc`, artikel "Fågelpigg 306", 780 kr, `invoice_date = 2026-04-20`
- Status: `approved`
- Visas under april 2026 på "Merförsäljning Avtal"-fliken — inte på "Avtalskunder"

---

## 6. Bugfixarna i samma släpp

### 6.1. Tidszon-bugg i `createAdHocItemsFromCase`

**Före:**
```ts
const periodStart = new Date(year, month, 1).toISOString().split('T')[0]
// 2026-04-01 i svensk tid → UTC → "2026-03-31" (!)
```

**Efter:**
```ts
const y = completedDate.getFullYear()
const m = completedDate.getMonth()
const fmt = (n: number) => String(n).padStart(2, '0')
const invoiceDate = `${y}-${fmt(m + 1)}-${fmt(completedDate.getDate())}`
const periodStart = `${y}-${fmt(m + 1)}-01`
// Bygger strängen manuellt från lokala komponenter, ingen UTC-konvertering
```

### 6.2. Fel datumkälla

Tidigare använde `createAdHocItemsFromCase` `new Date()` (spar-tillfället). Nu tar den emot `completedAt: Date | string = new Date()` explicit — anroparen i `EditContractCaseModal` skickar in när ärendet faktiskt stängdes.

### 6.3. Årspremie-pipelinens filter

`getMonthlyPipelineData` filtrerar nu på `item_type = 'contract'` så ad-hoc-rader inte smyger in på fel flik.

---

## 7. Datamodell-förändringar (migration)

```sql
-- Ny kundinställning
ALTER TABLE customers
  ADD COLUMN adhoc_invoice_grouping text NOT NULL DEFAULT 'per_case'
  CHECK (adhoc_invoice_grouping IN ('per_case', 'monthly_batch'));

-- Nytt datum på billing-items (styr ad-hoc-bucketen)
ALTER TABLE contract_billing_items
  ADD COLUMN invoice_date date;

-- Backfill befintlig ad-hoc-data
UPDATE contract_billing_items cbi
SET invoice_date = COALESCE(c.completed_date::date, cbi.billing_period_start)
FROM cases c
WHERE cbi.case_id = c.id AND cbi.item_type = 'ad_hoc';

-- Retroaktiv fix för BE-0008300
UPDATE contract_billing_items
SET invoice_date = '2026-04-20'
WHERE case_id = '76393c45-220f-48bd-ad8a-652de505ebbc';

-- Index för snabb uppslagning per kund + månad
CREATE INDEX contract_billing_items_adhoc_invoice_date_idx
  ON contract_billing_items (customer_id, invoice_date)
  WHERE item_type = 'ad_hoc';
```

---

## 8. Kritiska filer att känna till

| Fil | Roll |
|---|---|
| [src/services/contractBillingService.ts](../src/services/contractBillingService.ts) | `createAdHocItemsFromCase`, `getMonthlyPipelineData`, ny `getAdhocSalesPipelineData` |
| [src/components/admin/contractBilling/MonthlyBillingPipeline.tsx](../src/components/admin/contractBilling/MonthlyBillingPipeline.tsx) | Årspremie-fliken (endast `item_type = 'contract'`) |
| [src/components/admin/contractBilling/AdhocSalesPipeline.tsx](../src/components/admin/contractBilling/AdhocSalesPipeline.tsx) | **NY** — Merförsäljning Avtal-fliken |
| [src/pages/admin/invoicing/AdhocInvoicing.tsx](../src/pages/admin/invoicing/AdhocInvoicing.tsx) | **NY** — tunn wrapper för routingen |
| [src/pages/admin/invoicing/index.tsx](../src/pages/admin/invoicing/index.tsx) | Tab-layouten (Privat & Företag / Avtalskunder / Merförsäljning Avtal) |
| [src/components/admin/customers/BillingSettingsModal.tsx](../src/components/admin/customers/BillingSettingsModal.tsx) | Nytt select för `adhoc_invoice_grouping` |
| [src/components/coordinator/EditContractCaseModal.tsx](../src/components/coordinator/EditContractCaseModal.tsx) | Anropar `createAdHocItemsFromCase` med rätt `completedAt` |
| [src/types/contractBilling.ts](../src/types/contractBilling.ts) | `AdhocInvoiceGrouping`, `AdhocSalesEntry`, `AdhocSalesMonth` |

---

## 9. Regler för framtida arbete

1. **Rör aldrig `articles.default_price` som försäljningspris** — det är alltid intern kostnad
2. **Blanda aldrig ad-hoc och årspremie** — ad-hoc styrs av `invoice_date`, årspremien av `billing_period_start`
3. **Bygg YYYY-MM-DD manuellt** från lokala datumkomponenter när du skapar billing-rader — använd aldrig `toISOString()` för datum-kolumner (de är `date`, inte `timestamptz`)
4. **Prisguidens markup pausas** när kundens prislista har fast pris — men artikel-mappningen via `case_billing_items.mapped_service_id` (per ärenderad) är alltid aktiv för marginalberäkningen
5. **`adhoc_invoice_grouping` är per kund** — påverkar bara "Merförsäljning Avtal"-fliken, inte årspremien

---

## 10. Verifiering utförd

- [x] `npm run type-check` → grön
- [x] BE-0008300 har `invoice_date = 2026-04-20` på båda raderna (900 + 780 = 1 680 kr)
- [x] Retroaktiv backfill av `invoice_date` på alla befintliga ad-hoc-rader
- [x] Merge till main + push till origin (`591c1eaf..6163642f`)
