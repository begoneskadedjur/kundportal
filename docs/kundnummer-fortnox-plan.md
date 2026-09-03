# Plan: Fortnox styr kundnumret för engångskunder

## STATUS 2026-09-03: IMPLEMENTERAD (fas 1-5), EJ browser-testad

Migrationerna är applicerade i live-DB (fortnox_customer_numbers, fortnox_customer_mirror_state, customer_group_fortnox_stats, business_cases.customer_group_id, ny allocate_customer_number, RLS-täppning på customer_groups). Kod pushad till main.

Kvar för go-live:
1. Registrera Fortnox-webhook för topic customers (create + update) mot `https://kundportal.vercel.app/api/fortnox/webhook?secret=<FORTNOX_WEBHOOK_SECRET>` i Fortnox developer-portal, samma URL som fakturawebhooken. Tills dess håller inkrementell synk (vid allokering och på kundgruppssidan) och den nattliga cronen (02:15) spegeln färsk.
2. Browser-test enligt "Testkriterier" nedan. Särskilt: skapa engångsjobb företag (gruppval krävs nu), avsluta, Till Fortnox.
3. Första gången kundgruppssidan öppnas efter deploy görs en full synk automatiskt om den lokala synken nedan inte redan fyllt spegeln.

Verifierat mot live-Fortnox 2026-09-03 (lokal full synk, 1,5 s, 3 anrop): 918 aktiva kunder, 0 inaktiva, alla kundnummer numeriska, `filter=inactive` och `lastmodified` accepteras. Fortnox högsta privatnummer är 10497 medan portalens räknare stod på 10467, och portalens 10465 (Annica Anderbrant) är Sonja Johnsen i Fortnox. Därför släpper "Till Fortnox" ett portalnummer som spegeln visar tillhör någon annan och hämtar ett nytt (steg 1c-pre i InvoiceDetailModal).

Avvikelser från planen (medvetna):
- Ingen advisory lock i allocate-customer (PostgREST har inga transaktioner). Race hanteras av Fortnox unika kundnummer + retry på 2000637 och portalens unika constraint, vilket planen redan pekade ut som sanningen.
- Portalens räknare (`current_counter`) visas nedtonad som "räknare" på kundgruppssidan och heter "Oneflow-räknare" i redigeringsmodalen, gömdes inte.
- `verify_organization_number` (opt-in i findOrCreateCustomer) är påslagen för engångsfakturor direkt, inte bara i fas 5.
- Tester: vitest infört (`npm test`), 19 tester på de rena funktionerna i `src/shared/fortnoxCustomerNumbers.ts`.

Framtagen 2026-09-03. Bygger på kodkartläggning, live-DB-verifiering (rfyufytjwvqiqwueinoj), en validerande granskning av dagens flöde och två specialistkartläggningar (dataflöden i portalen, Fortnox API). Status: klar för implementation, alla beslutspunkter låsta (se "Beslutspunkter").

## Problemet

Engångsärenden (privat och företag) får vid ärendeavslut en customers-rad med kundnummer ur portalens egen räknare (`customer_groups.current_counter` via RPC `allocate_customer_number`). Fortnox har samma segmentering och samma nummerserier, men många fler kunder och en egen räknare. Serierna glider isär. Avstämningen 2026-08-19 visade t.ex. att portalens 10005 var Leudita Metolli i Fortnox medan portalen trodde det var Stefan Persson.

Dagens "Till Fortnox" gör det värre: `findOrCreateCustomer` (`src/services/fortnoxService.ts:247-256`) kontrollerar bara att NUMRET finns i Fortnox, inte att det är samma kund. Finns numret hos ekonomi på någon annan hamnar fakturautkastet på fel kund utan varning.

Fortnox API har ingen "nästa lediga i intervall". Utelämnas CustomerNumber vid POST tar Fortnox nästa nummer i sin ENDA globala serie (troligen 104xx idag), vilket skulle ge engångsföretag privatpersonsnummer. Därför måste portalen själv räkna fram nästa lediga nummer inom gruppens intervall, ur en spegling av Fortnox kundregister.

## Målbild (beslutad)

1. `/admin/kundgrupper` är en spegling av Fortnox: "Senaste" = högsta använda nummer i Fortnox inom gruppens intervall, alltid aktuell.
2. Nytt engångsärende för FÖRETAG kräver val av kundgrupp i CreateCaseModal. Privatärenden får alltid gruppen med `is_private_default`.
3. Vid "Till Fortnox" söker systemet Fortnox-kund på org-/personnummer. Finns ingen tar det nästa lediga nummer i gruppens intervall, skapar kunden i Fortnox med det numret, skriver tillbaka numret till `customers.customer_number`, sätter `invoices.customer_id` och skapar fakturautkastet som idag.
4. Portalens räknare styr inte längre numret för engångskunder. Oneflow-webhookens allokering för avtalskunder lämnas orörd i fas 1-4.

## Fortnox API-fakta som planen vilar på

- `GET /3/customers`: `limit` 1-500 (default 100), `page`, `MetaInformation.@TotalPages`. `filter=active|inactive` (bara ett åt gången). `lastmodified=YYYY-MM-DD HH:MM` ger alla ändrade sedan tidpunkten, men inte raderade. Sökfält: `organisationnumber`, `customernumber`, `name`, `email` m.fl. `organisationnumber` är exakt strängmatch (därav fallbacken i `api/import-customer-by-orgnr.ts:54-77`).
- `sortby=customernumber` finns men det är ODOKUMENTERAT om sorteringen är numerisk eller lexikografisk. Lita aldrig på den för max-beräkning; jämför numeriskt i egen kod.
- `CustomerNumber` är sträng, alfanumerisk plus `- + / _`. Utelämnas den tar Fortnox nästa i den globala serien.
- Dubblett vid POST: `ErrorInformation.code === 2000637` ("Kundnummer X används redan. Kundnumret har redan använts men blivit raderat."). Känn igen på koden, inte på HTTP-status. Raderade nummer kan ALDRIG återanvändas och syns inte i listan, så bara POST avslöjar dem. Inaktiva kunder syns med `filter=inactive` och deras nummer är upptagna.
- Rate limit 25 anrop per 5 s per token. En full hämtning av ~900 kunder = 2 anrop (active) + 1 (inactive).
- `OrganisationNumber` valideras av Fortnox (Luhn). Skicka `XXXXXX-XXXX` för bolag, `YYMMDD-XXXX` för privatpersoner, utelämna fältet med varning om det inte validerar lokalt.
- Ingen PUT på befintliga kundkort. Ekonomi äger dem (`fortnoxService.ts:225-227`).

## Arkitekturbeslut

**Spegel i egen tabell, inte bara max per grupp.** Tabellen `fortnox_customer_numbers` (customer_number text PK, numeric_value int null, name, organisation_number, org_digits, active bool, fortnox_modified_at, seen_at). "Senaste per grupp" blir en SQL-fråga. Org.nr-uppslaget vid "Till Fortnox" blir lokalt och kostar 0 Fortnox-anrop. `numeric_value` sätts bara för `^\d+$` utan inledande nolla; alfanumeriska nummer lagras men ignoreras i max.

**Allokering i en server-endpoint, inte via proxyn.** `api/fortnox/allocate-customer.ts` med `requireAuth(['admin','koordinator'])`, token via `getValidAccessToken()` (mönster `api/import-customer-by-orgnr.ts:36-87`). Skäl: uppslag + lås + POST-retry + tillbakaskrivning blir en atomär operation, `pg_advisory_xact_lock(hashtext(group_id))` serialiserar två koordinatorer, service role kan skriva till spegeln, och felkoden 2000637 tolkas på ett ställe (frontendens `fortnoxRequest` tappar `code`, `fortnoxService.ts:22-32`). Proxyn behålls för läsning.

**Customers-raden skapas vid avslut UTAN nummer, numret sätts vid "Till Fortnox".** Skäl: tekniker avslutar ärenden men får inte nå Fortnox-proxyn (`api/fortnox/proxy.ts:14`), ett Fortnox-avbrott får inte hindra avslut, och org.nr-sökningen först gör allokeringen idempotent (lyckas Fortnox-POST men portalskrivningen faller, hittas kunden nästa gång).

**Luckor fylls aldrig nedåt.** Nästa nummer = max(spegelns numeriska max i intervallet, `current_counter`) + 1. Luckor är oftast ekonomins raderade kunder som ger 2000637 ändå.

**Signaturen på `findOrCreateCustomer` ändras inte.** All ny logik ligger i endpointen och anropas bara när `customerNumber` saknas. Avtalsflödet (`ContractInvoiceModal.tsx:311`, Oneflow-webhook) är isolerat.

## Faser

### Fas 1: Spegel av Fortnox kundregister + kundgruppssidan

Migration:
- `fortnox_customer_numbers` enligt ovan, index på `numeric_value` och `org_digits`. RLS: läs för admin/koordinator, skriv bara service role.
- Watermark i befintliga tomma tabellen `fortnox_sync_state` (topic `customers`) eller egen kolumn.
- `customer_groups`: täpp policyn `Allow authenticated write` (ALL för alla inloggade, även kundkonton) till admin-only. Verifierat via pg_policies 2026-09-03.

Kod:
- `api/_lib/fortnoxCustomerMirror.ts`: `syncMirror({ full | since })`. Full = `limit=500` paginerat, `filter=active` sedan `filter=inactive`. Inkrementell = `lastmodified = watermark minus 10 min`, båda filtren. Parsar numeriskt, upsertar, flyttar watermark.
- `api/fortnox/webhook.ts`: hantera `Type === 'CUSTOMER'` bredvid dagens `INVOICE`. Hämta kundkortet från Fortnox på `EntityId` (aldrig lita på payloaden, samma princip som fakturagrenen) och upserta spegeln. Registreras i Fortnox developer-portal på topic customers (create + update), samma URL och `?secret=` som fakturawebhooken. Fortnox gör om leveransen en gång per minut i upp till fem försök om vi svarar fel.
- `api/cron/sync-fortnox-customers.ts`: nattlig full synk, `requireCronSecret` + `withCronLog`, ny rad i `vercel.json` (11:e cronen, t.ex. `15 2 * * *`). Skyddsnät för missade webhooks och för raderingar (lastmodified ser inte raderade; full synk markerar rader som inte längre finns).
- `api/fortnox/sync-customers.ts`: `requireAuth(['admin'])`, inkrementell synk för knappen "Uppdatera nu". Kundgruppssidan anropar den själv vid inläsning om watermark är äldre än 10 min.

Färskhet i tre lager, så "ofas" inte kan uppstå där det spelar roll:
1. Webhook: spegeln uppdateras inom sekunder när ekonomi lägger upp eller ändrar en kund i Fortnox.
2. Allokering (fas 4) kör ALLTID en inkrementell synk först och POST:en är sanningen (2000637 vid krock). Även en gammal spegel kostar bara ett retry, aldrig fel nummer.
3. Nattlig full synk fångar allt annat.
- `src/components/admin/settings/CustomerGroupsSettings.tsx` + `customerGroupService.ts`: "Senaste" = `max(numeric_value)` i intervallet från spegeln, med "synkad ÅÅÅÅ-MM-DD HH:MM" under; null = "ej synkad" och `current_counter` nedtonat. Kapacitetsstapeln (rad 146) räknar på spegelns max. Kolumnen "Kunder" behålls som portalens antal, lägg gärna Fortnox antal bredvid.
- `CustomerGroupEditModal.tsx:33,105,117`: fältet `current_counter` döps om till "Oneflow-räknare" eller göms.

Fas 1 är fristående och ger direkt nytta: sidan visar sanningen från Fortnox innan något annat byggs.

### Fas 2: Kundgrupp på företagsärendet

Migration: `alter table business_cases add column customer_group_id uuid references customer_groups(id)` (nullable, ingen backfill; 457 avslutade företagsärenden men bara 13 skapade senaste 90 dagarna).

Kod:
- `src/types/database.ts:380` (Row/Insert/Update), `database.d.ts` regenereras, `EditCaseModal.tsx:102` (`TechnicianCase`).
- `src/components/admin/coordinator/CreateCaseModal.tsx`: select "Kundgrupp" bredvid företagsfälten (rad 2409-2417), källa `CustomerGroupService.getActiveGroups()` utan `is_private_default`. Validering efter rad 938: obligatoriskt för `caseType === 'business'`. Insert på rad 1340-1346 spreadar `formData`, så värdet följer med när fältet ligger i formData. Avtalsspårets fält (rad 1996-2007) berörs inte.
- `CoordinatorSchedule.tsx:210-224` har explicit kolumnlista: lägg till `customer_group_id`. `CasesPage.tsx:407` och `CaseSearch.tsx:219` selectar `*`.
- `EditCaseModal.tsx:950` initiera `selectedCustomerGroupId` från `caseData.customer_group_id`; rad 1262 `selectedCustomerGroupId || currentCase.customer_group_id`. Befintlig väljare vid avslut blir fallback för legacy-ärenden utan grupp.
- Uppföljningsärende (`EditCaseModal.tsx:~830`) kopierar `org_nr` fältvis: kopiera även `customer_group_id`.
- Bonus (kan vänta): vid blur på org.nr i CreateCaseModal, slå upp spegeln + customers och visa "Befintlig kund, nr X" så gruppvalet kan hoppas över.

### Fas 3: Ärendeavslut skapar kundrad utan nummer

- `src/services/caseCustomerService.ts`: `customerNumber: number | null` (rad 22). Dedupe (rad 41): ta bort `.not('customer_number','is',null)`, lägg till `.is('parent_customer_id', null)` (multisite-enheter blir aldrig engångskund), sortera nummer nulls-last sedan `created_at`. Rad 50: `if (existing)`; saknar raden grupp men params har en, uppdatera. Ta bort `allocateNumber`-anropet (rad 83-84), insert med `customer_number: null` (rad 102). Behåll gruppkravet (rad 79-81).
- `EditCaseModal.tsx`: uppslaget rad 955-969 utan null-filter, spara `existingCustomerId` + `existingCustomerNumber`. Rad 1265-1267 tål null. `upsertInvoiceFromCase` (rad 1272-1295) får `customer_id: result.customerId`. `needsCustomerGroup` (rad 1512-1518) och sektionen rad 2195-2199: villkor "ingen customers-rad OCH ingen grupp på ärendet". Text rad 2203: "Kundnummer tilldelas när fakturan skickas till Fortnox". Rad 2224 "Nästa nr" visar spegelns max + 1 eller tas bort.
- `RevisitModal.tsx:289-299`: skicka `customerGroupId: caseData.customer_group_id` (idag skickas ingen grupp, så nya företagskunder kastar "Välj kundgrupp" här) och `customer_id`.
- `src/services/invoiceService.ts:306-318` och `170-190`: nytt fält `customer_id` i `customerInfo`, skrivs vid insert. Idag har ALLA 17 engångsfakturor `customer_id = NULL`, så "Till Fortnox" går alltid via org.nr-fallbacken.

### Fas 4: Allokering vid "Till Fortnox"

Ny endpoint `api/fortnox/allocate-customer.ts`, body `{ customerId, groupId, invoiceId }`:

```
begin tx; pg_advisory_xact_lock(hashtext(groupId))
{start, end} = customer_groups[groupId]
if watermark äldre än 10 min: syncMirror(since)
hits = spegel where org_digits = digits(customer.org_nr)   (12-siffrigt personnr trimmas till 10)
  exakt en aktiv träff  -> adoptera numret, skapa inget
  flera aktiva          -> returnera kandidater, UI väljer (mönster: avtalskandidat-väljaren i SiteModal)
  bara inaktiva         -> returnera förslag "reaktivera" som förstahandsval
n = max(spegelns max i [start,end], current_counter) + 1
för försök 1..5:
  n > end -> fel "Serien full"
  POST customers { CustomerNumber: String(n), Name, Type, OrganisationNumber?, Email, adress, TermsOfPayment, ... }
  ok -> bryt
  code 2000637 -> n += 1, fortsätt
  429 -> vänta 5 s, räknas som försök
  annat -> fel utan retry
upsert spegel(n, active); current_counter = GREATEST(current_counter, n)
update customers set customer_number = n; update invoices set customer_id
commit; return { created | reused | candidates }
```

Kundkortets fält byggs med samma logik som `findOrCreateCustomer` idag (Type via `isPersonnummer`, `parseSwedishAddress`, 10 dagar + priser inkl. moms för privat, teknikern som Vår referens). Flytta den byggaren till en delad ren funktion så båda vägarna ger samma kort.

Hantering av 23505 på `customers_customer_number_key`: en annan portalrad bär redan numret (typiskt samma bolag importerat som avtalskund). Sätt `invoices.customer_id` till den raden, lämna engångsraden utan nummer, logga varning, visa toast.

`InvoiceDetailModal.tsx` (`handleSendToFortnox`, rad 844-1080):
- Steg 1 (rad 852-871): behåll `resolveFortnoxCustomerNumber` först. Org.nr-fallbacken hämtar RADEN (id, customer_number, customer_group_id) utan null-filter och med `parent_customer_id is null`. Saknas rad helt: skapa via `getOrCreateCaseCustomer` (legacy-fakturor).
- Steg 1b (rad 900-903): `customer_group_id` i select mot business_cases. Grupp i prioritet: customers-raden, ärendet, privatgruppen om personnummer. Saknas grupp för företag: toast "Sätt kundgrupp på ärendet" och avbryt. Saknas org.nr för företag: toast och avbryt (281 av 790 business_cases saknar org_nr; kravet ställs vid "Till Fortnox", inte vid skapande).
- Nytt steg: om `customerNumber` är null, anropa endpointen. Vid `candidates`: liten väljare i modalen, sedan nytt anrop med valt nummer. Visa "Befintlig Fortnox-kund 2557 används" när numret adopterats och ligger utanför vald grupp.
- Steg 2 (rad 934-945): oförändrat, `findOrCreateCustomer` hittar nu alltid kunden.

### Fas 5: Efterarbete

- RPC `allocate_customer_number` (används av Oneflow-webhooken `api/oneflow/webhook.ts:1030, 1189`): `current_counter = GREATEST(current_counter, spegelns max i intervallet) + 1`. Ren SQL-ändring, webhooken rörs inte, och avtalskunder slutar springa förbi Fortnox. Kända avvikelser redan idag: räknaren ligger före portalens max i BRF (121 vs 125), Kommersiell Regional (1559 vs 1552), Företag lokalt (3569 vs 3567).
- Opt-in-flagga i `findOrCreateCustomer` som verifierar att befintlig Fortnox-kunds `OrganisationNumber` matchar innan numret används (default av, slås på i engångsflödet).
- Datastäd: 51 kundrader har nummer men ingen grupp, 66 saknar nummer, 8 org.nr har flera rader (556509-6731 har 8 rader). Dedupe-regeln i fas 3 hanterar det tekniskt, men listan bör gås igenom.
- Tester: repot saknar testrunner. Lägg logiken i rena funktioner (`nextFreeNumber`, `chooseCustomerRow`, `normalizeOrgNr`, `maxPerGroup`, `parseFortnoxError`) och inför vitest med fall för: hål i serien, icke-numeriska Fortnox-nummer, intervallgräns nådd, dedupe-prioritering, 2000637-retry, 23505-mappning.

## Beslutspunkter (låsta)

1. **Flera aktiva Fortnox-träffar på samma org.nr** (kända dubbletter, t.ex. Granen 39/113, Kista Galleria 1511/2003): koordinatorn VÄLJER i modalen. Beslutat av Christian 2026-09-03. Aldrig auto-val. Väljaren visar nummer, namn, aktiv/inaktiv och antal fakturor i spegeln om det finns, med numret inom vald grupp överst.
2. **Räknarfältet på kundgruppssidan**: visas nedtonat som "Oneflow-räknare" tills fas 5 är klar, sedan göms det.

## Nu-läge

Faktureringen sker parallellt i Fortnox och portalen under övergången, så dagens portalnummer (t.ex. Annica Anderbrant 10465) är inget akut problem enligt Christian 2026-09-03. Planen bygger för framtiden, ingen manuell kontroll krävs nu.

## Uppskattning

| Fas | Innehåll | Filer | Rader |
|---|---|---|---|
| 1 | Spegel, cron, admin-endpoint, kundgruppssidan, RLS-täppning | 1 migration + 2 nya api + 1 lib + 3 filer + vercel.json | ~250 |
| 2 | Kolumn + gruppval i CreateCaseModal, typer, kolumnlista, uppföljningskopia | 1 migration + 5 filer | ~80 |
| 3 | caseCustomerService, EditCaseModal, RevisitModal, invoiceService | 4 filer | ~90 |
| 4 | allocate-customer-endpoint, delad kortbyggare, InvoiceDetailModal-steg, kandidatväljare | 1 ny api + 3 filer | ~220 |
| 5 | RPC, opt-in-flagga, vitest | 1 migration + 4 filer | ~150 |

Totalt cirka 800 rader över ~20 filer. Fas 1 och 2 är oberoende av varandra och kan gå först.

## Testkriterier (manuellt, efter fas 4)

- Ny företagskund i grupp "Företag Privat lokalt": Fortnox-kort skapas med nästa lediga 35xx, portalens kundrad får samma nummer, fakturautkastet ligger på det kortet.
- Företag som redan finns i Fortnox med annat nummer: numret adopteras, inget nytt kort, UI visar det.
- Privatperson: gruppen väljs automatiskt, nummer i 10xxx-serien.
- Avtalskund med engångsjobb: `resolveFortnoxCustomerNumber` träffar, endpointen anropas inte.
- Två koordinatorer skickar samtidigt i samma grupp: olika nummer, inga fel.
- Ekonomi skapar kund manuellt på nästa nummer mellan uppslag och POST: retry ger nummer + 1.
- Fortnox frånkopplat: tekniker kan fortfarande avsluta ärendet, "Till Fortnox" ger tydligt fel.
- Kundgruppssidan: "Senaste" stämmer mot Fortnox efter "Uppdatera nu".
