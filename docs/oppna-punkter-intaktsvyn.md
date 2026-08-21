# Öppna punkter: intäktsvyn på kundsidan

Status 2026-08-21. Underlag för den som tar vid.
Kontext: fliken **Intäkter** på `/admin/befintliga-kunder/:id`.

---

## Grundproblemet (fixat i vyn, kvar i modellen)

`case_billing_items.case_type` har en CHECK-constraint som bara tillåter
`'private' | 'business' | 'contract'`. Motsvarande TS-typ är `BillableCaseType`
i `src/types/caseBilling.ts:10`.

Ärenden på **avtalskunder** ligger i tabellen `cases` — och den saknar eget
värde. Koden tvingas därför skriva `'contract'` även när `case_id` pekar på ett
ärende, inte ett avtal.

Uppmätt i produktion:

| `case_type='contract'` | Antal |
|---|---|
| pekar verkligen på ett avtal | 207 |
| **pekar i själva verket på ett ärende** | **133** |
| föräldralös (varken eller) | 1 |

De 133 rör 31 kunder / 68 ärenden / 444 052 kr.

**Viktigt:** ingen rad pekar på fel kund. 116 har rätt `customer_id`, 17 har det
tomt men går att härleda via ärendet. Det var ett *visningsfel*, inte ett
dataintegritetsfel.

### Vad som redan gjorts (commit `f8ecd5a0`)

Vyn slutade lita på `case_type`. `useCustomerRecord.ts` slår nu upp **alla**
`case_id` mot ärendetabellerna och låter träffen avgöra:

- träff i `cases`/`business_cases`/`private_cases` → utfört arbete, tillhör **teknikern**
- ingen träff → avtalsinnehåll, premien tillhör **säljaren**

Därmed behöver `case_type` inte rättas för att UI:t ska bli korrekt.

---

## Kvar att göra

### 1. Sluta kopiera avtalsinnehåll till etableringsärenden

**Var:** `src/components/admin/coordinator/CreateCaseModal.tsx:1012-1038`

```ts
// Auto-populera billing-items från kontraktets billing-items
case_id: createdEstCase.id,   // ett cases.id
case_type: 'contract',        // men märks som avtal
```

Verksamheten vill **inte** ha avtalets artiklar och kostnader inne i
etableringsärendet — de räknas på avtalsnivå. Kopieringen ska bort.

Detta är också källan till de 133 felklassade raderna: varje nytt
etableringsärende skapar fler.

### 2. Ersätt med fritext i ärendebeskrivningen

Önskemål från verksamheten: vad som ingår i avtalet skrivs som fritext i
ärendebeskrivningen i stället för som billing-rader. Hör ihop med punkt 1.

### 3. (Valfritt) Städa modellen

Först om någon vill ha `case_type` semantiskt korrekt: nytt värde krävs i både
CHECK-constraint och `BillableCaseType`, plus migrering av de 133 raderna.
**Inte nödvändigt för UI:t** efter `f8ecd5a0`. Gör inte detta utan uttrycklig
beställning.

### 4. 57 avtal saknar säljare

`contracts.begone_employee_name` är tomt på 57 avtal. Premierna får ingen
attribution i vyn, och all säljarstatistik påverkas. Fanns före `f8ecd5a0` —
inget som den commiten orsakade. Datauppgift, inte kodfix.

### 5. Två billing-rader med fel premie (medvetet ej rättade)

Indexeringen av Huddinge Pastorat uppdaterade `contracts.annual_value` men inte
tjänsteraden i avtalsinnehållet:

| Enhet | `annual_value` | I innehållet |
|---|---|---|
| Klockargården 3 | 44 187 kr | 42 900 kr |
| Prästgården | 21 579 kr | 20 950 kr |

Kunden valde att låta dem stå tills vidare. Två UPDATE-satser när det ska
göras. En tredje kund (Drottningens Pizzeria, −805 kr) har samma avvikelse
sedan tidigare — 3 avtal totalt i databasen.

---

## Beslut som är fattade (ändra inte utan att fråga)

- **Etableringar är normalt 0 kr.** Avsiktligt — betalning sker bara i undantagsfall.
  Det finns ingen affärsregel i koden som uttrycker detta; `services.base_price`
  för `Etableringskostnad` är `null`.
- **Ärenden helt utan intäkt OCH utan kostnad döljs i intäktsvyn.** Bär raden en
  kostnad utan intäkt visas den fortfarande — annars försvinner utlägg tyst.
- **Premien tillhör säljaren, ärendet teknikern.** Får aldrig blandas.

---

## Relaterade filer

| Fil | Roll |
|---|---|
| `src/hooks/useCustomerRecord.ts` | Uppslag + attribution (~rad 665-750) |
| `src/components/admin/customers/record/WorkChainSection.tsx` | Gruppering, etikett, nollfilter |
| `src/components/admin/coordinator/CreateCaseModal.tsx` | Skapar de felklassade raderna |
| `src/types/caseBilling.ts` | `BillableCaseType` |
