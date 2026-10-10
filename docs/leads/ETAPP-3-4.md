# Leads (B2B) etapp 3 och 4: teknisk sammanfattning (2026-10-10)

Plan och beslut: `leads-plan.html` (#beslut). Versioner: 3.43.0 (etapp 3, databas) och 3.44.0 (etapp 4, sidan).

## Migrationer (supabase/migrations, applicerade via MCP)
| Fil | Innehåll |
|---|---|
| `20261010_leads_kontaktfalt_valfria.sql` | contact_person, phone_number, email blir nullable |
| `20261010_leads_datamodell.sql` | enums, nya kolumner, lead_members, lead_activities, hjälpfunktioner, triggrar, RLS, RPC:er |
| `20261010_leads_migrering.sql` | engångsmigrering av de 23 leadsen och deras historik (skyddad: hoppar över om lead_activities har rader) |
| `20261010_leads_sokvag_kontaktsynk.sql` | search_path på kontaktsynk-triggrarna (rådgivaren) |

Inget raderat och inga DROP. Gamla kolumner (status, priority, BANT, assigned_to, follow_up_date m.fl.) och tabellerna lead_events, lead_comments, lead_technicians, lead_sni_codes ligger kvar men används inte av nya sidan. Fritextkällan döptes om till `source_fritext`; gamla status sparades i `legacy_status`.

## Datamodell
**Enums:** `lead_stage` (ny, kontaktad, besok_bokat, offert_skickad, vunnen, forlorad, parkerad), `lead_source` (tio värden), `lead_type` (nytt_avtal, utokning), `lead_customer_group` (foretag, privat, forening), `lead_lost_reason` (åtta), `lead_activity_kind`.

**Nya kolumner på leads:** stage, stage_changed_at, owner_profile_id, tipped_by_profile_id, source, lead_type, customer_group, origin_case_type + origin_case_id (unikt par), web_inquiry_id, customer_id, offer_contract_id, agreement_contract_id, next_action, next_action_at (timestamptz), parked_until (date), lost_reason, lost_note, won_at, lost_at, legacy_status, samt genererade org_nr_norm, phone_norm, email_norm för dubblettkontroll.

**Återanvända kolumner (beslut):** `estimated_value` ÄR årspremien (ingen ny estimated_annual_value, så Leadsstatistik fungerar oförändrad). `contract_with` = leverantör nu, `contract_end_date` = nuvarande avtal till.

**Checkar:** förlorad kräver lost_reason, parkerad kräver parked_until, origin-paret båda eller inget, next_action max 300 tecken. Ingen check på att öppna leads har nästa steg (migrerade saknar det och visas i "Saknar nästa steg").

**lead_members** (lead_id, profile_id, added_by, created_at, removed_at, removed_by, unikt par). Borttagning = removed_at sätts, raden ligger kvar.

**lead_activities** (id, lead_id, kind, text, fran_varde, till_varde, ref_table, ref_id, occurred_at, profile_id, created_at).

## Triggrar
- `leads_before_write` (before insert/update): created_by/updated_by förvalda från inloggad profil; spärr för icke admin/koordinator mot besok_bokat/offert_skickad/vunnen, mot ägarbyte om man inte är ägare och mot ändrad tipsare; vid stegbyte stage_changed_at, won_at, lost_at, nollställning av lost_*/parked_until; **gamla status hålls i synk med stage** (ny/parkerad → blue_cold, kontaktad → yellow_warm, besök/offert → orange_hot, vunnen → green_deal, förlorad → red_lost). Övergång: ändras bara status (gammal kod) flyttas stage.
- `leads_after_write` (security definer): loggar skapad, stage, parkerad, forlorad, agare, varde, nasta_steg, kund_kopplad, arende_kopplat, offert_skickad, avtal_signerat med före och efter.
- `lead_members_after_write`: delad / delning_borttagen.
- `lead_activities_after_insert`: samtal, mejl eller möte på en lead i steg ny flyttar den till kontaktad.
- `update_leads_updated_at` omskriven: updated_by via profiles.user_id, update_history skrivs inte längre.
- `log_lead_events` och `log_lead_contact_events` är no-op (triggrarna ligger kvar).
- GUC `begone.leads_migrering = on` stänger av loggning och updated_at under migreringen.

## Hjälpfunktioner och RPC:er (security definer, bara authenticated)
- `my_profile_id()`, `is_lead_admin()` (admin/koordinator inkl. is_admin, is_koordinator, extra_roles), `is_lead_staff()` (alla anställda roller), `lead_ar_personal(uuid)`, `is_lead_member(uuid)`, `can_see_lead(uuid)`, `can_edit_lead(uuid)`.
- `lead_overlat(p_lead, p_ny_agare, p_behall_som_delad)`: ägaren eller admin/koordinator.
- `lead_dela(p_lead, p_profiler uuid[])`: ägaren eller admin/koordinator, returnerar antal.
- `lead_sluta_dela(p_lead, p_profil)`: ägaren, admin/koordinator eller medlemmen själv.
- `lead_dubbletter(p_org, p_telefon, p_epost, p_utom)`: träffar på alla leads (namn, steg, ägare, träff, kan_oppna).
- `lead_personal()`: anställda att välja som ägare och för namn i tidslinjen.

Rådgivaren varnar för att dessa är körbara av authenticated: avsiktligt, samma mönster som is_web_inquiry_staff; varje RPC kontrollerar behörigheten själv.

## RLS
| | leads | lead_activities | lead_members | lead_contacts |
|---|---|---|---|---|
| admin, koordinator | allt (ALL-policyn employees_modify_leads) | läsa, skriva människans kinds, ändra | läsa | allt |
| säljare, tekniker | läsa där ägare, tipsare eller delad; skapa om ägare eller tipsare är jag; ändra som ägare eller delad | läsa och skriva människans kinds på leads de ser | läsa på leads de ser | läsa/skapa på synliga, ändra där de får ändra leaden |
| kund | inget | inget | inget | inget |

Gamla tabeller (lead_events, lead_comments, lead_technicians, lead_sni_codes): läsning som leaden, skrivning bara admin/koordinator. Befintliga policyer skrevs om med ALTER POLICY (inga drop).

**RLS-test 2026-10-10 (rollback):** admin 23 leads, koordinator 23, säljare Jimmy 4, tekniker Hans 6, Benny 5, Kim 2, kund 0. Tekniker: tips utan ägare OK och läses tillbaka; skapa åt annan nekas; uppdatera egen OK; medlem uppdaterar OK men kan inte byta ägare eller dela; sätta vunnen nekas; systemkind nekas; anteckning på osynlig lead nekas; ägare delar och överlåter OK; osynlig lead uppdateras 0 rader. Säljare: skapa, parkera, förlora OK; skapa åt Sofia som tipsare OK; tipsare (ej ägare) uppdaterar 0 rader men kan logga samtal. Kund: kan inte skapa eller anropa RPC.

## Migreringen av de 23 leadsen
- Steg: ny 1, kontaktad 12, offert_skickad 1 (Svenska Krämfabriken, hade "Offert skickad"), vunnen 8, forlorad 1 (orsak övrigt). BRF Kastellberget (orange_hot utan offert) blev kontaktad.
- Ägare = skaparen. Fyra tekniker-skapade (Benny 2, Hans 2) fick tipsare = skaparen och källa tekniker_tips.
- Källa ur fritext: mejl, telefon, engångsärende eller övrigt.
- Kundgrupp: förening för BRF, förening och samfällighet, annars företag.
- Nästa steg: follow_up_date blev "Följ upp" med datum på 4 öppna leads; övriga öppna saknar nästa steg.
- 21 kollegor i lead_technicians blev delade medlemmar (utom ägaren själv).
- Historik: 69 rader i lead_activities (23 skapad, 5 stage, 1 forlorad, 4 offert_skickad, 2 varde, 2 samtal, 2 mote, 9 anteckning, 21 delad). Brus och testhändelser kopierades inte; lead_events och lead_comments är orörda.

## Klient (etapp 4)
- `src/pages/admin/Leads.tsx`: flikar Att göra, Pågående, Nya tips, Alla; filter i adressen (`flik`, `q`, `agare`, `kalla`, `status`), `?id=` öppnar leaden.
- `src/components/admin/leads/`: `leadLogik.ts` (filter, grupper, format, klasser), `LeadsTabell.tsx`, `LeadModal.tsx`, `LeadNastaSteg.tsx`, `LeadAktivitet.tsx`, `LeadDelning.tsx`, `LeadFaltSektion.tsx`, `NyLeadModal.tsx`.
- `src/services/leadService.ts`, `src/types/leads.ts`. `Modal.tsx` fick `mobilHelskarm`.
- Leads (Webb) skapar B2B-lead med NyLeadModal (web_inquiry_id sätts, förfrågan kopplas som förut).
- Borttaget: CreateLeadModal, EditLeadModal, LeadDetailModal, LeadsTable, LeadsFilters, LeadFilterPanel, LeadColumnSelector, LeadsExpandedRow, SNIBranchManager, LeadTechnicianManager, LeadTagsManager, LeadCommentsSystem, LeadTimeline, LeadContactsManager, utils/leadEventLogger.ts. Leadsstatistik (`leads/analytics/*`, LeadAnalytics.tsx) ligger kvar till etapp 6 och läser estimated_value och synkad status.

## Vad etapp 5 till 7 bygger på
- **Etapp 5 (lead från ärende, Oneflow):** sätt `origin_case_type/origin_case_id` (unikt par hindrar dubbletter), `tipped_by_profile_id` och `source = engangsarende`; triggern loggar arende_kopplat. Offert: sätt `offer_contract_id` och stage `offert_skickad` från en trigger på contracts (security definer, auth.uid() null eller admin passerar spärren); avtal: `agreement_contract_id` + stage vunnen; avböjd offert: aktivitet offert_avbojd (kind finns) och next_action_at = i dag. Kundkoppling: `customer_id` (loggas kund_kopplad). Knappen Boka besök i modalen sätter i dag bara ett nästa steg; kopplas till ärendeskapande här. Dubblettkontrollen finns i `lead_dubbletter`.
- **Etapp 6 (statistik):** tid i steg ur lead_activities kind stage/forlorad/parkerad (fran/till, occurred_at), förlustorsaker ur lost_reason, tips per tipped_by_profile_id, pipeline på estimated_value per stage och owner_profile_id. Därefter kan status-synken i leads_before_write tas bort.
- **Etapp 7 (tipsbonus):** tipped_by_profile_id + won_at + estimated_value (årspremie) + lead_type (utökning eller nytt avtal) räcker som underlag.
