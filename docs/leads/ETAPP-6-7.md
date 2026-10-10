# Leads (B2B) etapp 6 och 7: statistik och tipsbonus (2026-10-10)

Bygger på etapp 3 till 5 (`ETAPP-3-4.md`, `ETAPP-5.md`). Plan och beslut: `leads-plan.html` (#historik, #etapper, #beslut). Versioner: 3.46.0 (etapp 6) och 3.47.0 (etapp 7).

## Etapp 6: statistik (3.46.0)

### Migration
| Fil | Innehåll |
|---|---|
| `20261010_leads_etapp6_statistik.sql` | `lead_arbetsdagar_fram`, `lead_steg_rang`, RPC `lead_statistik` |

Applicerad via MCP i tre steg (`leads_etapp6_statistik`, `..._kedja`, `..._kontakt`); filen är slutläget. Inget raderat, inga DROP.

### RPC `lead_statistik(p_fran date, p_till date, p_agare uuid default null)`
Security definer, search_path satt, execute bara för authenticated (anon saknar).

**Behörighet (valt):** admin och koordinator (`is_lead_admin`) får statistik över alla leads. Övriga anställda (`is_lead_staff`: säljare och tekniker) får statistik över de leads de ser enligt RLS: där de är ägare, tipsare eller delad medlem (borttagna delningar räknas inte). Svaret har `behorighet = 'alla' | 'egna'` och sidan skriver ut när urvalet är det egna. Kunder och okända nekas (42501). Skälet att inte neka säljare helt: en säljare ska kunna följa sin egen kedja och hygien; urvalet blir samma som listan de redan ser.

`p_agare` filtrerar på `owner_profile_id` i alla delar.

**Tidsregler** (svensk tid, `Europe/Stockholm`):
- Pipeline och hygienens öppna leads: läget nu, oberoende av perioden.
- Skapade, tips, kedjan och tips per tipsare: leads skapade i perioden (kohort).
- Vunna, förlorade, vinstgrad, vunnen årspremie, ledtid och förlustorsaker: `won_at`/`lost_at` i perioden.
- Tid i steg: stegbyten som skedde i perioden.

**Värden:** pipeline = `estimated_value` (årspremien). Vunnen årspremie = `contracts.annual_value` för `agreement_contract_id` om den finns, annars `estimated_value`. Uppdelning nytt avtal och utökning på `lead_type`.

**Svaret (jsonb):**
| Nyckel | Innehåll |
|---|---|
| `summa` | skapade, tips, vunna, forlorade, vunnen_premie, vunnen_nytt, vunnen_utokning, oppna, pipeline, parkerade, ledtid_vunnen_median (dagar), ledtid_vunnen_antal |
| `pipeline_steg` | antal och årspremie per öppet steg (ny, kontaktad, besok_bokat, offert_skickad, parkerad) |
| `pipeline_agare` | per ägare (null = Ingen ägare): antal per steg, antal, värde, värde i offert |
| `manader` | per månad i perioden: skapade, tips, vunna, forlorade, vunnen_nytt, vunnen_utokning |
| `kedja_kalla`, `kedja_ursprung` | per `source` respektive `origin_case_type` (`web_inquiries` om leaden kom från en webbförfrågan, `inget` annars): skapade, kontaktade, besok, offert, vunna, forlorade, oppna, vunnen_premie |
| `tid_i_steg` | per steg: antal byten, median och 75:e percentil i dagar |
| `forlustorsaker` | antal per `lost_reason` |
| `hygien` | per ägare: öppna, försenat nästa steg (`next_action_at` passerat), saknar nästa steg, och för nya leads i perioden: bedömda, kontaktade inom 2 arbetsdagar, senare, ej kontaktade |
| `tips` | per `tipped_by_profile_id`: namn, roll, tips, pågående, vunna, förlorade, vunnen årspremie |

**Kedjan:** ett steg räknas som nått om leaden någon gång varit där: högsta av nuvarande steg, alla `fran`/`till` i stegbytena, samtal/mejl/möte (minst kontaktad), `booked_case_id` (besök), `offer_contract_id` (offert) och `won_at` (vunnen). Migrerade vunna leads räknas därför som att de passerat besök och offert.

**Tid i steg:** stegbytena ur `lead_activities` (kind `stage`, `forlorad`, och `parkerad` när `fran_varde` är ett steg; byte av bara återupptagsdatum räknas inte). Tiden i ett steg = bytet ut ur steget minus föregående byte för samma lead (eller `created_at` för det första).

**Kontaktade inom 2 arbetsdagar:** första kontakt = tidigaste samtal, mejl eller möte, eller byte från Ny till Kontaktad eller längre. Fristen = två arbetsdagar efter skapandedagen (`lead_arbetsdagar_fram`, måndag till fredag; helgdagar räknas inte bort). Utfall: inom, sen, ej (fristen passerad utan kontakt), väntar (fristen inte passerad, räknas inte), okänd (leaden är kontaktad enligt steget men saknar tidpunkt i historiken, till exempel de migrerade, räknas inte).

### Klient
- `src/components/admin/leads/statistik/LeadsStatistik.tsx`: fliken. Periodväljare (30 dagar, 90 dagar, 12 månader som standard, I år, Egen period med DateField) och ägarfilter, i adressen som `period`, `pfran`, `ptill`, `sagare` bredvid `flik=statistik`. Sektioner: Perioden i korthet (platt definitionslista, inga kort), Pipeline per steg (punkt, tal, tunn stapel), Pipeline per ägare (tabell med summa), Vunnen årspremie per månad (Recharts, staplat nytt avtal i kategoriplats 1 och utökning i plats 2 enligt dataviz-paletten via `useDiagramFarger`, förklaring och hover), Månad för månad (tabell, tips per månad för uppföljningen 2026-12-01), Från lead till affär, Tid i steg med ledtid, Förlustorsaker, Hygien per ägare (statuspunkter mot målen 90 % och 10 %), Tips per tipsare. Hämtas om när fönstret får fokus.
- `LeadsStatistikKedja.tsx`: kedjan per källa eller ursprung, sorterbar, andel och stapel under talet, summeringsrad och CSV. Samma stil som `WebLeadsKedja`.
- `leadsStatistikFormat.ts`: perioder, etiketter för källa och ursprung, månad och dagar.
- CSV-export för kedjan, hygienen och tipsen (`laddaNerCsv`, semikolon och BOM).
- `Leads.tsx`: femte fliken Statistik (inte för tekniker; länken Statistik i sidhuvudet borttagen). `leadLogik.ts`: `Flik` har `statistik`.
- Ny ikon `allman.ladda-ner` (export). Kontrollera i `/admin/ikoner` i båda temana.
- `LeadService.statistik()`, typerna `LeadStatistik` med flera i `src/types/leads.ts`.

### Omdirigeringar och borttaget
- `/admin/leadsstatistik`, `/koordinator/leadsstatistik`, `/saljare/leadsstatistik` och `/admin/leads/analytics` går till rollens `/leads?flik=statistik` (Navigate, replace).
- Menyraden Leadsstatistik borttagen i admin, koordinator, säljare och DashboardDemo (och sidtitlarna).
- Borttagna filer: `src/pages/admin/LeadAnalytics.tsx` och `src/components/admin/leads/analytics/*` (LeadConversionFunnel, LeadGeographicDistribution, LeadKpiOverview, LeadRevenueAnalytics, LeadTeamPerformance, LeadTrendAnalysis). Inget annat importerade dem.

### Gamla status-kolumnen
Synken stage till status i `leads_before_write` ligger kvar. Den fanns inte bara för LeadAnalytics: `src/pages/saljare/SäljareDashboard.tsx` läser fortfarande `leads.status` (pipeline-räknare och listan). Synken kan tas bort när säljarens dashboard läser `stage`; därefter kan även övergången status till stage i triggern tas bort.

### Test 2026-10-10 (rollbackade transaktioner)
- Admin Christian, 2025-01-01 till 2026-10-10: 23 skapade, 4 tips (Benny 2, Hans 2), 8 vunna, 1 förlorad, vunnen årspremie 117 038 kr, pipeline 546 697 kr på 14 öppna, månadsserien har 22 månader.
- Tekniker Hans: `behorighet = egna`, 6 leads (samma som RLS-testet i etapp 3).
- Säljare Jimmy: `egna`, 4 leads.
- Admin med `p_agare` = Peter: 9 skapade, 7 öppna.
- Kund: nekas (42501). Anon: saknar execute.

Rådgivaren: `authenticated_security_definer_function_executable` på `lead_statistik`, avsiktligt (samma mönster som övriga lead-RPC:er; funktionen kontrollerar behörigheten själv). Hjälpfunktionerna är inte security definer och har search_path.

## Etapp 7: tipsbonus i provisionerna (3.47.0)

### Migration
| Fil | Innehåll |
|---|---|
| `20261010_leads_etapp7_tipsbonus.sql` | enumvärdet `tipsbonus` i `lead_activity_kind`, `case_type = 'lead'` på `commission_posts`, unikt index per lead, inställningarna, funktionerna och triggrarna |

Applicerad via MCP i tre steg: `leads_etapp7_tipsbonus_kind` (ALTER TYPE ... ADD VALUE måste committas före användning), `leads_etapp7_tipsbonus` och `leads_etapp7_tipsbonus_format` (beloppen i notes med mellanslag). Filen är slutläget. Inget raderat; checken `commission_posts_case_type_check` byttes i en sats (drop och add, samma mönster som etapp 5).

### Inställningar (commission_settings, redigeras på /admin/provisioner)
Kugghjulet Inställningar (bara admin) visar nu två paneler: Provisionsinställningar och **Tipsbonus för leads** (`src/components/admin/provisions/TipsbonusPanel.tsx`). Numeriska värden som övriga provisioner; ja/nej som 1/0 och datum som ÅÅÅÅMMDD.

| Nyckel | Startvärde | Betydelse |
|---|---|---|
| `tipsbonus_aktiv` | 0 (av) | på/av. **Avstängd från början**: Christian sätter procent och villkor och slår på |
| `tipsbonus_procent` | 5 | procent av första årets premie |
| `tipsbonus_min_belopp` | 500 | lägsta belopp; en lägre bonus höjs hit |
| `tipsbonus_max_belopp` | 5 000 | tak; 0 = inget tak |
| `tipsbonus_min_premie` | 0 | lägsta årspremie för att bonus ska utgå |
| `tipsbonus_utokning` | 1 | utökning hos befintlig kund (`lead_type = utokning`) räknas |
| `tipsbonus_bara_tekniker` | 0 | 0 = alla som tipsar utom ägaren, 1 = bara tipsare med rollen tekniker |
| `tipsbonus_galler_fran` | 20261010 | gäller leads vunna (won_at, svensk tid) från och med datumet |

Panelen visar räkneexempel (10 000, 30 000 och 100 000 kr i årspremie) med samma regel som databasen och sparar bara ändrade värden (`ProvisionService.getTipsbonusSettings` och `saveTipsbonusSettings`, typen `TipsbonusSettings` och `TIPSBONUS_NYCKLAR` i `src/types/provision.ts`). Ändringar påverkar aldrig redan bokförda poster (procent och belopp fryses i posten, som för övrig provision).

### Bokföring när leaden vinns
Trigger `leads_tipsbonus` (after insert or update på leads, utan kolumnlista eftersom steget kan sättas av `leads_before_write`) anropar `tipsbonus_skapa(lead)` när steget blir Vunnen. Det gäller både Oneflow-automatiken från etapp 5 (avtal signerat) och Vunnen satt för hand av admin eller koordinator. Fel blir en varning och stoppar aldrig sparningen.

`tipsbonus_skapa` skapar en post bara om: inställningen är på, leaden är vunnen, tipsare finns, tipsaren inte är ägaren, utökning är tillåten om leaden är en utökning, won_at är på eller efter gäller från-datumet, tipsaren är tekniker om det krävs, underlaget är större än 0 och minst lägsta årspremie, och ingen tipsbonus redan finns för leaden.

**Beloppsunderlag:** avtalets `contracts.annual_value` via `agreement_contract_id` om den finns och är större än 0, annars `leads.estimated_value`. Vilket som användes står i postens notes. **Belopp** = round(underlag × procent / 100, 2), höjt till lägsta belopp och sänkt till taket.

**Posten** (`commission_posts`): `case_type = 'lead'`, `case_id` = leadens id, `case_title = 'Tipsbonus: <företag>'`, `case_number` null, `commission_type = 'tipsbonus'`, `technician_id` = tipsarens `profiles.technician_id` (alla dagens anställda har en), annars profilens id, `technician_name` och `technician_email` frysta, `commission_percentage` = procenten, `share_percentage` 100, `base_amount` = underlaget, `status = 'pending_invoice'`, notes med regeln. **Idempotent:** kontroll i funktionen plus unikt index `idx_commission_posts_tipsbonus_lead` på `case_id` där `commission_type = 'tipsbonus'`. En lead som vinns, öppnas och vinns igen har fortfarande en post.

Leadens historik får en rad av typen `tipsbonus` ("Tipsbonus bokförd till Hans Norman. Den betalas ut när första fakturan är betald."). Beloppet står inte i historiken, som alla som ser leaden kan läsa.

### Klar för utbetalning när första fakturan är betald
`tipsbonus_frigor(lead)` letar den tidigast betalda fakturan som hör till leaden:
1. faktura med `invoices.contract_id = leads.agreement_contract_id` (säker koppling), annars
2. avtals- eller merförsäljningsfaktura (`invoice_type` contract eller adhoc) på `leads.customer_id`, skapad tidigast dagen före `won_at`.

Väg 2 är reserven när avtalet inte är kopplat till fakturan (bara 113 av 118 betalda avtalsfakturor har `contract_id`) och för kunder som kopplas i steget Koppla eller skapa kund. Risken: vid utökning hos en befintlig kund kan nästa ordinarie årsfaktura frigöra bonusen även om den inte gäller utökningen.

Posten får `ready_for_payout`, `invoice_paid_date` = fakturans betaldatum och `payout_month = compute_payout_month(betaldatum)` (samma brytdag som övriga provisioner), notes "Frigjord av faktura X betald ÅÅÅÅ-MM-DD", och leaden får en historikrad. Anropas från:
- `trg_invoice_paid_tipsbonus` (after update på invoices när status blir paid) och `trg_invoice_paid_tipsbonus_insert` (faktura som skapas som betald). Egna triggrar bredvid `trg_invoice_paid`; `handle_invoice_paid` och dess `pending_invoice`-vakt är orörda.
- `leads_tipsbonus` när kund eller avtal kopplas till en vunnen lead.
- `tipsbonus_skapa` direkt efter att posten skapats (fakturan kan redan vara betald).

Därefter samma flöde som all provision: Godkänn, Utbetald och löneunderlaget på /admin/provisioner.

### Var posten syns
- Admin: /admin/provisioner, under tipsarens namn i utbetalningsmånaden, med "Tipsbonus" i nummerkolumnen och "Tipsbonus: företaget" som titel. Ögat på raden öppnar leaden (`/admin/leads?id=`) i stället för en faktura. CSV-exporten har typen "Tipsbonus (lead)".
- Tekniker: /technician/commissions, samma text (posten har teknikerns `technician_id`).
- Säljare och koordinatorer som tipsar får posten på sitt `technician_id`; de saknar egen provisionsvy, admin ser posten.

### Behörighet
`tipsbonus_skapa`, `tipsbonus_frigor`, `tipsbonus_installning` och triggerfunktionerna är security definer med search_path och utan execute för public, anon och authenticated: bara triggrarna anropar dem. Rådgivaren har inga nya varningar.

Känd skuld (inte ändrad här, se skill provisioner, Riktning 2): `commission_settings` har uppdateringspolicyn `true` för alla inloggade, så tekniskt kan vem som helst som är inloggad ändra även tipsbonusens inställningar via API:t. Panelen visas bara för admin.

### Test 2026-10-10 (rollbackade transaktioner, inställningar 10 %, lägst 500, tak 3 000)
1. Säters kommun (tips Hans, ägare satt till Peter, 100 000 kr) vinns: en post på 3 000 kr (taket), Hans technician_id, "Tipsbonus: Säters kommun", pending_invoice, historikrad.
2. Dubbel vinst (Vunnen, Kontaktad, Vunnen): fortfarande en post.
3. Sörmlandsvatten, ägare = tipsare (Benny): ingen post.
4. Ingarvsgruppen, 2 000 kr: 200 kr höjs till 500 kr.
5. Inaktiv: ingen post.
6. Utökning när utökning inte räknas: ingen post.
7. Kund kopplad, avtalsfaktura på kunden skapas och betalas 2026-10-12: posten blir ready_for_payout med utbetalning 2026-12 (brytdag 6), historikrad "klar för utbetalning".
8. Oneflow-vägen: simulerat avtal (source_type lead, annual_value 24 000) pending och sedan signed: leaden blir Vunnen med agreement_contract_id och posten blir 2 400 kr på "avtalets årspremie"; betald faktura på avtalet (2026-10-05) frigör den med utbetalning 2026-11.
- authenticated och anon saknar execute på funktionerna. Inga tipsbonusposter finns i produktion efter testerna (inställningen är av).

### Kvar och bortvalt
- Om en vunnen lead flyttas tillbaka från Vunnen ligger posten kvar (pending_invoice). Den rättas för hand på /admin/provisioner; ingen automatisk makulering eftersom `commission_posts.status` saknar ett makulerat-värde.
- En makulerad faktura flyttar inte tillbaka en redan frigjord tipsbonus (`handle_invoice_cancelled` matchar på ärende).
- Ingen browsertest av panelen eller fliken Statistik är gjord.
