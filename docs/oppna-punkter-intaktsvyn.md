# Öppna punkter: intäktsvyn på kundsidan

Status 2026-08-21. **Validerad mot produktion 2026-08-24** — siffror uppdaterade,
en ny punkt tillkom (Heimstaden-dubbletterna, punkt 0) och orsakstexten i
punkt 1 nyanserades. Underlag för den som tar vid.
Kontext: fliken **Intäkter** på `/admin/befintliga-kunder/:id`.

---

## Grundproblemet (fixat i vyn, kvar i modellen)

`case_billing_items.case_type` har en CHECK-constraint som bara tillåter
`'private' | 'business' | 'contract'`. Motsvarande TS-typ är `BillableCaseType`
i `src/types/caseBilling.ts:10`.

Ärenden på **avtalskunder** ligger i tabellen `cases` — och den saknar eget
värde. Koden tvingas därför skriva `'contract'` även när `case_id` pekar på ett
ärende, inte ett avtal.

Uppmätt i produktion (2026-08-24; siffrorna 2026-08-21 inom parentes):

| `case_type='contract'` | Antal |
|---|---|
| pekar verkligen på ett avtal | 207 |
| **pekar i själva verket på ett ärende** | **139** (133) |
| föräldralös (varken eller) | 1 |

De 139 rör 33 kunder / 73 ärenden / 445 068 kr — och består av **två helt
olika sorter**:

| Sort | Antal | Bedömning |
|---|---|---|
| Arbetsrader på rutinärenden/inspektioner (teknikerns riktiga tjänster + artiklar, skrivna via `caseBillingService`) | 97 | **Önskade.** Fortsätter skapas varje dag — modellen har inget annat värde att ge dem. Visas korrekt efter `f8ecd5a0`. |
| Etableringskopior av avtalsinnehåll (`CreateCaseModal`) | 42 | **Oönskade.** Det är dessa punkt 1 stoppar. |

**Viktigt:** ingen rad pekar på fel kund. 122 har rätt `customer_id`, 17 har
det tomt. Det var ett *visningsfel*, inte ett dataintegritetsfel.

**Nyans (2026-08-24):** de 17 raderna utan `customer_id` hämtas aldrig av vyn
(`useCustomerRecord` filtrerar på `.in('customer_id', familyIds)`, rad ~502) —
de är alltså osynliga, inte härledda. Harmlöst idag eftersom alla 17 är
oönskade etableringskopior, men **rätta dem inte** (då dyker de upp i vyn) —
radera dem i samband med punkt 1.

### Vad som redan gjorts (commit `f8ecd5a0`)

Vyn slutade lita på `case_type`. `useCustomerRecord.ts` slår nu upp **alla**
`case_id` mot ärendetabellerna och låter träffen avgöra:

- träff i `cases`/`business_cases`/`private_cases` → utfört arbete, tillhör **teknikern**
- ingen träff → avtalsinnehåll, premien tillhör **säljaren**

Därmed behöver `case_type` inte rättas för att UI:t ska bli korrekt.
Logiken omvaliderad 2026-08-24: sund, inklusive dedup-filtret för ersatta avtal.

---

## Kvar att göra

### 0. NY (hittad 2026-08-24): dubblerade premierader hos Heimstaden

**Enda punkten som ger fel siffror i vyn idag.** Fyra avtal har sitt
avtalsinnehåll dubblerat (ett tripplerat), dubblettraderna skapade
**2026-07-16**. Vyns dedup-filter tar bara bort rader på *ersatta* avtal —
dubbletter på samma levande avtal summeras rakt av:

| Avtal | Rader | Vyn visar | Ska vara |
|---|---|---|---|
| Heimstaden Ferdinand AB (`b75d3d11`) | 2 (5 maj + 16 juli, olika tjänstenamn, samma pris) | 29 790 kr | 14 895 kr |
| Heimstaden GefleBo AB (`c3c2596f`) | 2 identiska | 23 226 kr | 11 613 kr |
| Heimstaden Maria 5 AB (`833d6806`, mek. fällor) | 2 identiska | 41 380 kr | 20 690 kr |
| Heimstaden Maria 5 AB (`f0861788`, Aurocon) | **3** identiska | 78 600 kr | 26 200 kr |

Åtgärd: radera de 5 överflödiga raderna (behåll äldsta per avtal) **och** ta
reda på vad som kördes 2026-07-16 som skapade dem, så det inte upprepas.

### 1. Sluta kopiera avtalsinnehåll till etableringsärenden

**Var:** `src/components/admin/coordinator/CreateCaseModal.tsx:1012-1038`

```ts
// Auto-populera billing-items från kontraktets billing-items
case_id: createdEstCase.id,   // ett cases.id
case_type: 'contract',        // men märks som avtal
```

Verksamheten vill **inte** ha avtalets artiklar och kostnader inne i
etableringsärendet — de räknas på avtalsnivå. Kopieringen ska bort.

**Nyanserat 2026-08-24:** kopieringen är källan till de *oönskade* raderna
(42 st), men inte till majoriteten av de felmärkta — 97 är teknikerns riktiga
arbetsrader som fortsätter skapas oavsett (se Grundproblemet). Räkna alltså
inte med att antalet `'contract'`-märkta ärenderader slutar växa efter denna
fix — bara att de oönskade kopiorna slutar tillkomma.

I samma veva: **radera de befintliga 42 kopiorna** (inkl. de 17 utan
`customer_id`) — de är brus som döljs av nollradsfiltret idag men ligger kvar
i datat.

### 2. Ersätt med fritext i ärendebeskrivningen

Önskemål från verksamheten: vad som ingår i avtalet skrivs som fritext i
ärendebeskrivningen i stället för som billing-rader. Hör ihop med punkt 1.

### 3. (Valfritt) Städa modellen

Först om någon vill ha `case_type` semantiskt korrekt: nytt värde krävs i både
CHECK-constraint och `BillableCaseType`, plus migrering av raderna som pekar
på ärenden. **Inte nödvändigt för UI:t** efter `f8ecd5a0`. Gör inte detta utan
uttrycklig beställning.

### 4. Avtal saknar säljare (siffran omätt 2026-08-24)

`contracts.begone_employee_name` är tomt på **72** avtal i vyns statusurval
(74 totalt, varav 23 ej trashade och 15 signed/active). Dokumentets tidigare
siffra 57 gick inte att reproducera under någon rimlig definition.
Förmildrande: vyn faller tillbaka på kundens `sales_person`-fält
(`useCustomerRecord.ts:710`) när avtalet saknar säljare, så alla blir inte
"ej registrerad". Fanns före `f8ecd5a0`. Datauppgift, inte kodfix.

### 5. Billing-rader med gammal premie (medvetet ej rättade)

Indexeringen av Huddinge Pastorat uppdaterade `contracts.annual_value` men inte
tjänsteraden i avtalsinnehållet:

| Enhet | `annual_value` | I innehållet |
|---|---|---|
| Klockargården 3 | 44 187 kr | 42 900 kr |
| Prästgården | 21 579 kr | 20 950 kr |

Kunden valde att låta dem stå tills vidare. Två UPDATE-satser när det ska
göras. Samma typ av avvikelse finns även hos Drottningens Pizzeria (−805 kr)
och Conpletus (avslutat avtal, 14 940 vs 9 047 kr). Heimstaden-avvikelserna
som en bredare svepning hittar är i själva verket dubbletter — se punkt 0,
inte denna.

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
| `src/hooks/useCustomerRecord.ts` | Uppslag + attribution (~rad 665-750), hämtningsfiltret på `customer_id` (~rad 502) |
| `src/components/admin/customers/record/WorkChainSection.tsx` | Gruppering, etikett, nollfilter |
| `src/components/admin/coordinator/CreateCaseModal.tsx` | Skapar etableringskopiorna |
| `src/services/caseBillingService.ts` | Skriver de legitima arbetsraderna (`case_type` från ärendetyp) |
| `src/types/caseBilling.ts` | `BillableCaseType` |
