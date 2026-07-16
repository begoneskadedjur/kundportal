# Plan: Multisite-hantering på /admin/befintliga-kunder

**Mål**: En multisite-kund (t.ex. Swedish Pelican: HK + 10 enheter med varsitt avtal) ska kunna hanteras som organisation MED per-enhet-hantering: se/redigera kundnummer, faktureringsinställningar, intäkter och fakturaflöde per enhet. Vanliga kunder (ett avtal, ingen organisation) ska inte påverkas.

**Utredning 2026-07-16** (tre agenter): rotorsaken till alla symptom är att sidopanelen behandlar organisationen som en singelkund med `sites[0]` som bärare av allt avtalsinnehåll. De underliggande verktygen (EditCustomerModal, BillingSettingsModal, fakturagodkännande, Fortnox-sändning) är redan customer_id-baserade och fungerar per enhet — de saknar bara åtkomstvägar.

## Rotorsaker (exakta platser)

| Symptom | Plats |
|---|---|
| "Totalt enheter 11" (HK räknas med) | `useConsolidatedCustomers.ts:673` (`sites.push` inkluderar HK) + `:766` |
| HK visar fel enhets avtal (Väsby) | `CustomerDetailSidePanel.tsx:150` (`primarySite = sites[0]`), `:156-176` (`realContracts` = bara sites[0]:s kontrakt) |
| Intäkter visar 21 792 kr (en enhet) | `CustomerRevenueModal.tsx:99-101` filtreras på `selectedContract.id` från panelen |
| Fakturering öppnar fel kontrakt under HK:s namn | `Customers.tsx:1720` (`customerId=sites[0].id`) + `headquarterCustomerId`-konsolidering |
| Enheter går inte att öppna | Inga onClick: `MultisiteExpandedTabs.tsx` EnheterTab, `SiteListSection.tsx:571` (edit = stub), `CustomerDetailSidePanel.tsx:694-717` |
| Churn "Hög 70%" (falskt) | `customerMetrics.ts:208-218`: årsvärde <50k ger +15 per enhet, `previous_renewals_count=0` ger +15 — org-nivån tar värsta enheten |

## Vad som redan fungerar per enhet (behöver bara åtkomstväg)

- **EditCustomerModal** — customer_number redigerbart (rad 307-313), skriver `.eq('id', customer.id)`, inga site_type-antaganden
- **BillingSettingsModal** — fungerar enhet-scoped med `customerId=enhet, contractId=enhetens kontrakt, headquarterCustomerId=null` (mönster finns i `SingleCustomerDetailModal` rad 903-927)
- **/admin/fakturering** (PrivateBusinessInvoicing) — listar och godkänner enheternas avtalsfakturor per rad; InvoiceDetailModal skickar till Fortnox via `resolveFortnoxCustomerNumber(invoice.customer_id)` (deployad 2026-07-16)
- **ContractInvoiceGenerator.planForCustomer(enhetsId)** — genererar/uppdaterar fakturor korrekt per enhet

## Faser

### Fas 1 — Korrekt org-vy (datamodell i hooken + panel)
1. `useConsolidatedCustomers`: exkludera HK ur `sites` (behåll som `headquarterCustomer`), `totalSites = enheter`, sortera enheter stabilt (site_name). Exponera `allContracts` på org-nivå: alla enheters kontrakt med enhetsreferens (customer_id + site_name per kontrakt).
2. `CustomerDetailSidePanel` (endast multisite-gren): avtalssektionen visar org-aggregat (summa årspremie, period min→max, antal avtal). Kontraktsväljaren (pills) listar organisationens ALLA kontrakt märkta med enhetsnamn. Valt kontrakt bär sitt `customer_id` (enhetens) så alla nedströms modaler scopas rätt.
3. Guard: vanliga kunder och multi-kontrakt-singelkunder (`expandedCustomers`-flödet) går orörda genom befintlig kodväg.

### Fas 2 — Per-enhet-drilldown (huvudleveransen)
4. Gör enhetsrader klickbara (EnheterTab + SidePanelens enhetslista + SiteListSection): öppnar per-enhet-meny/panel med **Redigera** (EditCustomerModal med enhetens rad → kundnummer redigerbart), **Fakturering** (BillingSettingsModal enhet-scoped: `headquarterCustomerId=null`), **Intäkter** (CustomerRevenueModal med nytt enhet-scope), **Visa avtal** (CustomerContractButton med enhetens oneflow_contract_id).
5. **Säkerhetsfix (viktig)**: dagens multisite-öppning av BillingSettingsModal (`Customers.tsx:1719-1726`) propagerar avtalsdatum från HK till ALLA sites (rad 542-552 i modalen) — ska inaktiveras för organisationer vars enheter har egna contracts-rader, annars kan en admin skriva över alla enheters avtal med ett klick.
6. CustomerRevenueModal: ny valfri `scopeCustomerId`-prop — org-läge (default, dagens aggregat) + enhet-läge.

### Fas 3 — Fakturaflödet (mindre)
7. /admin/fakturering: lägg till enhets-/organisationskolumn eller sökbarhet så en orgs alla enhetsfakturor är lätta att hitta (fungerar redan, bara hittbarhet).
8. Bugfix i förbifarten: importflödets auto-create av tjänsterad failar tyst — `case_billing_items` kräver `article_name` + `discounted_price` (NOT NULL utan default), `api/import-customer-by-orgnr.ts` ~rad 530 sätter inte dem.

### Fas 4 — Mätvärden
9. Churn/health för multisite-orgar: beräkna på org-aggregat (summerat årsvärde, äldsta avtalsstart) i stället för per enhet/värsta enhet. Endast `is_multisite`-grenen ändras.

## Guardrails
- Alla ändringar villkoras på multisite-grenen (`organization_id`-gruppering) — singelkunder når aldrig ny kod.
- Regressionskontroll efter varje fas: en vanlig enkontraktskund + en multi-kontrakt-singelkund (t.ex. befintlig med 2 avtal) ska se identiska ut före/efter.
- BillingSettingsModals befintliga öppningsvägar behålls; enhet-scoped är en NY väg.

## Status
- [x] Fas 1 — HK ur sites-arrayen (aggregat via aggRows bevarar äldre orgars siffror), `allContracts` med enhetsreferens, sidopanelens kontraktsväljare listar hela organisationens avtal + "Hela organisationen"-aggregatläge
- [x] Fas 2 — klickbara enhetsrader (sidopanel + Enheter-flik), per-enhet Redigera/Fakturering/Intäkter via `scopeOrgToSite` (enhet öppnas som fristående kund → ingen HK-propagering), Fakturering kräver avtalsval för orgar med enhetsavtal
- [x] Fas 3 — org.nr sökbart på fakturasidan (kundnamn/fakturanr fanns redan), importflödets tjänsterad-insert fixad (article_name + discounted_price)
- [x] Fas 4 — churn/health/förnyelse beräknas på org-aggregat (summerad årspremie + tidigaste start/nästa förnyelse) i stället för värsta enhet
- Följdfixar: TerminateContractModal inkluderar HK-raden, deep-link matchar HK-id, verksamhetschef-fallbacks läser headquarterCustomer

Implementerat 2026-07-16.
