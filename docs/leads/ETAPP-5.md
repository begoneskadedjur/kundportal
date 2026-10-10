# Leads (B2B) etapp 5: lead från ärende, Oneflow och kundkoppling (2026-10-10)

Version 3.45.0. Bygger på etapp 3 och 4 (`ETAPP-3-4.md`). Plan och beslut: `leads-plan.html` (#arende, #flode, #beslut).

## Migrationer (supabase/migrations, applicerade via MCP)
| Fil | Innehåll |
|---|---|
| `20261010_leads_etapp5_kallor_och_notiser.sql` | `contracts.source_type` får värdet `lead`, `notifications.case_type` får `lead` (checkarna byttes i en sats) |
| `20261010_leads_etapp5_automatik.sql` | kolumnerna `leads.booked_case_type/booked_case_id`, nya RPC:er, triggern på contracts, ändrade `leads_before_write`, `leads_after_write` och `web_inquiry_skickad_offert` |
| `20261010_leads_etapp5_radgivaren.sql` | `lead_far_se_arende` är intern (ingen RPC) |

Inget raderat. Funktioner och trigger med create or replace.

## Databas
**Nya kolumner:** `leads.booked_case_type` (private_cases, business_cases, cases) och `leads.booked_case_id`: ärendet som bokades från leaden. Check att båda eller inget är satt.

**RPC:er (security definer, search_path satt, bara authenticated):**
- `lead_arende_underlag(p_case_type, p_case_id)`: ärendets kund (företag, org.nr för företagsärenden, kontakt, telefon, e-post, adress, skadedjur, ärendenummer), befintlig lead på ärendet (`befintlig` med `kan_oppna`) och öppna dubbletter via `lead_dubbletter`. Personnummer lämnar aldrig databasen.
- `lead_fran_arende(p_case_type, p_case_id, p_galler, p_beskrivning, p_foretag)`: skapar leaden. `p_galler` är `lopande_avtal`, `fler_adresser`, `annan_tjanst` (företag) eller `hemmet`, `forening`, `foretag` (privat; de två sista kräver `p_foretag`). Finns redan en lead på ärendet returneras den (`skapad = false`).
  - Förifyllt: företag eller namn, org.nr (bara företagsärende), kontaktperson, telefon, e-post, adress, skadedjur (problem_type), notes med ärendenummer, valet och texten.
  - Källa `tekniker_tips` om anroparen är tekniker (och inte admin/koordinator), annars `engangsarende`. Tipsare alltid anroparen. Ägare null för tekniker (hamnar i Nya tips), annars anroparen.
  - Kundgrupp: företagsärende foretag; privat hemmet privat, forening forening, foretag foretag. Typ: fler_adresser och annan_tjanst blir `utokning`, övriga `nytt_avtal`.
  - Nästa steg "Kontakta kunden om tipset" om två dygn.
  - Avvikelse från uppdraget: parametern heter `p_galler` i stället för `p_lead_type`; typ och kundgrupp härleds i databasen så att valen inte kan bli inkonsekventa.
- `lead_anteckning_fran_arende(p_lead, p_case_type, p_case_id, p_text)`: tipset som anteckning på en befintlig lead (dubblett), med ärendet som referens. Teknikern behöver inte se leaden.
- `lead_koppla_besok(p_lead, p_case_type, p_case_id)`: kräver `can_edit_lead`. Sätter booked_case_* och steget Besök bokat om leaden är Ny eller Kontaktad. Historiken får `arende_kopplat` med texten "Besök bokat".

**Behörighetsregeln för ärenden** (`lead_far_se_arende`, intern): samma som RLS-policyerna `private_cases_unified_select` och `business_cases_unified_select`. Admin, koordinator och säljare ser alla; tekniker där de är primär, sekundär eller tertiär, eller nämnda i en kommentar. Raderade ärenden räknas inte.

**Spärren i `leads_before_write`** släpps när GUC `begone.leads_automatik = on`. Den sätts transaktionslokalt bara inne i `lead_koppla_besok` och `contracts_lead_automatik` och stängs efteråt. Ny spärr: andra än admin/koordinator kan inte själva ändra `booked_case_id`, `offer_contract_id` eller `agreement_contract_id`.

**Trigger `contracts_lead_automatik`** (after insert or update of status, source_type, source_id på contracts, security definer). Gäller rader med `source_type = 'lead'`, `source_id = leads.id`. Fel i triggern blir en varning och stoppar aldrig contracts-flödet.
| contracts.status | Effekt på leaden |
|---|---|
| pending (skickad) | `offer_contract_id`, steg Offert skickad från Ny, Kontaktad, Besök bokat eller Parkerad; aktivitet offert_skickad; notis till tipsaren |
| declined, overdue, trashed (bara från pending) | om dokumentet är leadens offert och leaden är öppen: aktivitet offert_avbojd, steg tillbaka till Kontaktad (från Offert skickad), nästa steg "Offerten avböjdes/gick ut: ta ny kontakt" med tid nu. Aldrig automatisk förlust |
| signed eller active | `agreement_contract_id`, steg Vunnen, won_at, customer_id från avtalet om det finns; aktivitet avtal_signerat; notis till tipsaren |

Faktiska statusvärden kontrollerades först: draft, pending, signed, declined, active, ended, overdue, trashed. En signerad offert (type offer) räknas också som vunnen.

**Notiser:** `notifications` med `case_type = 'lead'`, `case_id` = leaden, till tipsaren när den inte är ägaren ("Ditt tips har fått en offert" och "Ditt tips är vunnet"). Klick öppnar rollens Leads-sida med leaden (NotificationBell, NotificationCenter, NotificationModal).

**`web_inquiry_skickad_offert`:** kräver nu `source_id is null or source_type = 'lead'`, så att en offert från en lead (som skapats från en webbförfrågan) fortfarande kan kopplas till förfrågan. Ärendeoffertar påverkas inte.

## Klient
- `src/components/admin/leads/SkapaLeadKnapp.tsx` och `SkapaLeadModal.tsx`: knappen läser `lead_arende_underlag`. Utan lead visas "Skapa lead", med lead "Lead skapad · Företag →" (länk om man får se leaden). Ser man inte ärendet visas inget. Modalen: kund och ursprung, dubblettstatus med "Lägg anteckning där", Vad gäller det? som radiorader, Företag eller förening när det krävs, Vad såg du?, och vad som följer med. Toast med länk efter sparande. Modalen ritas i en egen portal ovanför ärendemodalen.
- Knappen syns i `src/components/admin/technicians/EditCaseModal.tsx` (mellan statusraden och flikarna) för private och business. Samma modal används av kontoret (CaseSearch, CoordinatorSchedule, CasesPage, KPI-listor) och teknikern (TechnicianCases, TechnicianSchedule, även mobil). Avtalsärenden, rondering och egenkontroll öppnas i andra modaler och får ingen knapp.
- `LeadModal.tsx`: Boka besök öppnar `CreateCaseModal` förifylld för admin och koordinator (privat eller företag efter kundgrupp) och anropar `lead_koppla_besok` när ärendet sparats; övriga roller sätter ett nästa steg som förut. Skapa offert öppnar Oneflow-guiden förifylld (`leadId`, `returnPath`) på steg 1, dokumenttyp avtal för nytt avtal och offert för utökning. Vunnen utan kund visar `LeadKundKoppling.tsx` överst: förslag via `WebInquiryService.findCustomerMatches`, sökning på namn, org.nr eller kundnummer, och Skapa kund via `CreateCustomerManuallyModal` (förifylld, med Fortnox-uppslaget). Ursprung och kopplingar visar bokat besök.
- ⋯-menyn behåller "Sätt … för hand (nödutgång)" för admin/koordinator: offerter som skapas utanför leaden (manuellt i guiden eller från ett ärende) kopplas inte automatiskt.
- Oneflow-guiden (`OneflowContractCreator.tsx`) läser `leadId` ur förifyllningen och skickar det till `api/oneflow/create-contract.ts`, som sätter `source_type = 'lead'`, `source_id = leadId` när inget ärende anges (uuid-kontroll). Ärende går före lead.
- `contractService.getContract` slår bara upp källärende för private_case och business_case.
- `CreateCustomerManuallyModal` tar `initialValues` och skickar den nya kundens id till `onCustomerCreated`.

## RLS-test 2026-10-10 (rollbackade transaktioner)
- Tekniker Benny, eget företagsärende: underlag OK, skapa ger source tekniker_tips, owner null, tipsare Benny, steg ny, nästa steg satt; raden och historiken syns via RLS; andra anropet ger samma lead (skapad false); underlaget visar sedan befintlig.
- Tekniker, eget privatärende: Bostadsrättsföreningen utan namn nekas; med namn blir kundgrupp forening, org.nr null, kontakten från ärendet.
- Tekniker, annans ärende: underlag, skapa och anteckning nekas ("Du kan inte se ärendet"); koppla besök på en lead han bara tipsat nekas; sätta vunnen direkt ger 0 rader.
- Koordinator Sofia: skapa på annans ärende OK (source engangsarende, ägare och tipsare Sofia, typ utokning); koppla besök gav Besök bokat och historiken skapad, stage ny > besok_bokat, arende_kopplat; anteckning på befintlig OK.
- Säljare Jimmy: skapa OK (ägare Jimmy); sätta besok_bokat direkt och booked_case direkt nekas; via `lead_koppla_besok` blir steget besok_bokat och GUC:n är av efteråt.
- Kund: underlag nekas, skapa nekas, koppla nekas. Anon: saknar execute.
- Triggern (som webhooken, utan inloggning): utkast ändrar inget; pending ger Offert skickad, offer_contract_id och notis; declined ger Kontaktad och nästa steg nu; nytt avtal (manual som blir lead, sedan pending) ger Offert skickad med nya offer_contract_id; gamla avtalet overdue ändrar inget; signed ger Vunnen, agreement_contract_id, won_at och notis (3 notiser totalt); makulerat utkast ger ingen avböjd-rad; `web_inquiry_skickad_offert` hittar en lead-offert.

Rådgivaren: kvar är `authenticated_security_definer_function_executable` på `lead_arende_underlag`, `lead_fran_arende`, `lead_anteckning_fran_arende`, `lead_koppla_besok` och `web_inquiry_skickad_offert`. Avsiktligt, varje RPC kontrollerar behörigheten själv (samma mönster som etapp 3).

## Bortvalt och kvar
- Unika indexet på (origin_case_type, origin_case_id) gäller alla steg, inte bara öppna. En förlorad lead på ärendet returneras alltså i stället för att en ny skapas. Att ändra det kräver drop av indexet.
- Ingen automatisk koppling av kund när en kund skapas med samma org.nr (trigger på customers) och ingen cron för fakturautfall; kunden kopplas i steget Koppla eller skapa kund.
- Skapa offert sätter ingen koppling förrän dokumentet skickas; ett utkast syns inte på leaden.
- Inga riktiga avtal skapades i Oneflow under testet; triggern testades med simulerade contracts-rader i rollback.
