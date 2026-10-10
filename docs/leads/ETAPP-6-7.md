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
