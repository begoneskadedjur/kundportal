---
name: multisite-organisation
description: Multisite-organisationer och regionala kunder i BeGone Kundportal. Använd vid arbete med MultisiteContext, OrganizationsPage, ManageRegionsModal, UserModal, RegionalMapView, tabellerna customers (is_multisite/site_type/organization_id), multisite_user_roles, customer_regions, api/create-multisite-users, portalerna /organisation och /regional, roller verksamhetschef/regionchef/platsansvarig, multisite/organization/sites/regional customer/regions/stations.
---

# Multisite, organisationer och regionala kunder

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `src/contexts/MultisiteContext.tsx` | Navet: laddar roll, organisation, sites, accessibleSites, impersonation |
| `src/types/multisite.ts` | Typer + `getPermissionsForRole` (kanonisk permissions-matris) + `calculateTrafficLightColor` |
| `src/pages/organisation/Portal.tsx` + `RegionalPortal.tsx` | Kundportalerna (TVÅ separata vy-switchar med duplicerade ROLE_LABELS) |
| `src/components/organisation/MultisitePortalLayout.tsx` | `MultisitePortalView`-unionen (rad 24) + `navItems` (rad 35), mobilnav visar bara `slice(0,5)` |
| `src/pages/admin/multisite/OrganizationsPage.tsx` | Admin-huvudsida (`/admin/anvandarkonton-kund`), koordinator-varianten är ren re-export |
| `src/components/admin/multisite/*` | Wizard, ConvertToMultisiteInline, ConvertToRegionalCustomerModal, ManageRegionsModal, UserModal, SiteModal |
| `src/components/admin/coordinator/CreateCaseModal.tsx` | Ärendeskapande med site-val, rondering/egenkontroll |
| `api/create-multisite-users.ts`, `api/multisite-users.ts`, `api/update-multisite-user-email.ts` | Användar-API (service-role) |
| `src/utils/multisiteHelpers.ts`, `src/utils/multisiteRoleValidation.ts` | Hjälpare; validation-filen är den ANDRA (duplicerade) permissions-matrisen |

## Arkitektur

**Allt är rader i `customers`.** Ingen organisationstabell finns. En organisation = customers-rader som delar `organization_id` (fristående UUID från `crypto.randomUUID()`, INTE en FK; kommentaren i `database.ts:94` om `multisite_organizations` är inaktuell). Huvudkontor: `is_multisite=true, site_type='huvudkontor'`, bär ALL avtalsdata. Enhet: samma `organization_id` + `site_type='enhet'` + `parent_customer_id=<HK-id>` + `site_name/site_code/region`. Tabellen `organization_sites` är DROPPAD ur databasen; kod som refererar den är död (se Fallgropar).

**Regionalkund** = samma modell + `is_regional=true` på både HK och enheter. Enheterna är geografiska regioner med GeoJSON-polygoner i `customer_regions`, portalen blir `/regional` i stället för `/organisation`. Regioner har inga egna avtal; regionvyerna visar HK:s avtalsdata. Referens: Stockholms Kommun (HK `5a58dd74-f562-4e55-95bb-469f8841e81b`, org-UUID `f2bada00-6179-4f58-919f-b90bb1f7780b`, 7 regioner, 607 stationer i regionerna + 13 på HK).

**Roller** i `multisite_user_roles` (`user_id, organization_id, role_type, site_ids uuid[], is_active`): `verksamhetschef` (alla enheter), `regionchef` och `platsansvarig` (bara enheter i `site_ids`; rollradens kolumn `region` är legacy). I regionalkund-UI:t heter platsansvarig "Regionansvarig" (`UserModal.tsx:71`), samma DB-värde. Rollen SPEGLAS i `profiles.multisite_role` + `profiles.organization_id`; spegeln är obligatorisk eftersom RLS på `multisite_user_roles` kräver att `profiles.organization_id` matchar. CHECK-constraint kräver `role='customer'`, `customer_id=null`, `technician_id=null` för multisite-profiler.

**RLS ger org-BRED läsning** av `cases` och `equipment_placements` (ingen site_ids-filtrering; `sanitation_reports` HAR den, inkonsekvent). Per-site-avgränsning för regionchef/platsansvarig är enbart UI-nivå. Byt aldrig klientfiltrering mot "RLS fixar det".

**Routing**: `AuthContext.tsx:88-122` skickar customer-profil utan `customer_id` till `/regional` eller `/organisation` beroende på HK:s `is_regional`. Admin läser användarlistan via RPC `get_organization_users_complete(org_id)`. `MultisiteProtectedRoute` släpper in admin/koordinator utan multisite-data, så vyer måste tåla `organization=null`.

**Dataflöde i portalen**: alla vyer får `selectedSiteId: string|'all'` + redan rollfiltrerade `sites` och filtrerar med `cases.customer_id IN (siteIds)`. Enklaste mönstret är att wrappa en kundportal-komponent per site (som `MultisiteCasesView`). Regionchefens aggregat är bara klient-side summering.

## Invarianter

- **ALDRIG blanda ihop `organization.id` (HK:ns customer.id) och `organization.organization_id` (grupperings-UUID:t)** (`MultisiteContext.tsx:269-272`). Fel val ger tomma resultat.
- **`cases.customer_id` pekar alltid på SITEN** (CreateCaseModal:849-862). Aggregera per org via `customers.organization_id`-join eller `IN (siteIds)`. ALDRIG ny filtrering på `cases.site_id` (legacy; kommentaren i `database.ts:226` om FK till organization_sites är inaktuell).
- **Håll `multisite_user_roles.site_ids` i synk** när enheter raderas/återskapas, annars visar portalen 0 enheter. `ManageRegionsModal.tsx:383-400` gör det; `handleDeleteSite` i OrganizationsPage gör det INTE (känd brist).
- **Skapa ALDRIG multisite-användare klient-side.** Trestegskedjan auth-user + profiles-spegel + multisite_user_roles görs bara korrekt i `api/create-multisite-users.ts`.
- **Ta inte bort 500 ms-sleepen** i `api/create-multisite-users.ts` (~rad 180). Medvetet race-skydd mot SECURITY DEFINER-triggern `handle_new_user` som skapar profilen från user-metadata.
- **En användare = EN organisation.** `MultisiteContext.tsx:214-219` hämtar rollen med `.maybeSingle()` på bara user_id; två aktiva roller kraschar hämtningen. Antagandet genomsyrar profiles-spegeln, RLS och API-auth. Multi-org kräver egen design, fixa inte bara kontexten.
- **Använd aldrig `canUserAccessSite` (`multisiteHelpers.ts:171`) ensam** - den returnerar blankt `true` för regionchef. Kontexten kompenserar i `canAccessSite` genom intersect med `accessibleSites`; gå via kontexten.

## Vanliga uppgifter

**Ny vy i portalen**: utöka `MultisitePortalView`-unionen + `navItems` i `MultisitePortalLayout.tsx:24,35` → rendera i BÅDE `Portal.tsx` OCH `RegionalPortal.tsx` (två switchar, se vy-registerbuggen under Fallgropar). Ta emot `selectedSiteId`/`sites`. Mobilnav visar bara `navItems.slice(0, 5)` - ett nytt item kan knuffa ut ett annat.

**Ny multisite-roll**: DB-CHECK på `multisite_user_roles.role_type` OCH `profiles.multisite_role` + `types/multisite.ts` (union + getPermissionsForRole) + `multisiteRoleValidation.ts` + MultisiteContext (accessibleSites, canInviteRole) + `UserModal.getRoles` + rollnamnsmappar i `create-multisite-users.ts:408` + ROLE_LABELS i båda portalsidorna + `getRoleName` i OrganizationsPage:928 + RLS-policies + `handle_new_user`-triggern.

**Ändra regionindelning**: ALLTID via ManageRegionsModal. Den kör en avsiktligt ordningskänslig femstegssekvens: (1) INSERT nya region-kunder, (2) radera+återskapa polygoner, (3) point-in-polygon-omtilldelning av ALLA stationer (utanför alla polygoner → HK), (4) flytta `case_billing_items.customer_id` till HK (NO ACTION-FK) och FÖRST DÄREFTER radera borttagna regioner, (5) synka `site_ids`. Rå SQL utan alla fem stegen ger FK-fel eller tom portal.

**Felsöka "tom portal"** (i ordning): (1) aktiv rad i `multisite_user_roles` för user_id, (2) `site_ids` innehåller EXISTERANDE customer-ids, (3) HK-rad med rätt `organization_id`+`site_type='huvudkontor'`+`is_active`, (4) `profiles.organization_id` = rollradens (RLS!), (5) `profiles.multisite_role` satt + `role='customer'` + `customer_id=null` (CHECK), (6) HK:s `is_regional` styr /regional vs /organisation.

## Fallgropar

- **Vy-registret är ur synk**: `egenkontroll` finns i navItems men `pages/organisation/Portal.tsx` renderar den inte → tom sida i /organisation (bara `RegionalPortal.tsx` renderar den). Omvänt renderar Portal.tsx `quotes` men inget navItem sätter den → offertvyn onåbar via nav.
- **`src/pages/multisite/Portal.tsx` + hela `src/components/multisite/`** är den GAMLA portalen utan route (`/multisite` redirectar); `pages/multisite/Portal.tsx` importeras ingenstans. Den filtrerar på `site_id` i `private_cases` m.fl. (`MultisiteDashboard.tsx:59,73` — fel datamodell). Återanvänd aldrig mönster härifrån. `OrganizationManagement.tsx` och `MultisiteRegistrationPage` importeras i `App.tsx:62,65` men har inga routes.
- **Döda/trasiga API:er**: `api/link-sites-to-customers.ts` och `api/debug-sites.ts` läser droppade `organization_sites` och kraschar om de körs. `api/save-quote-recipient.ts` (anropas från `OneflowContractCreator.tsx:651-673` med felaktig svarshantering) läser också `organization_sites` och hårdkodar `region='Huddinge'`; det FUNGERANDE recipient-flödet skriver `quote_recipients` klient-side i `EditContractCaseModal.tsx`.
- **Trasiga raderingsflöden i OrganizationsPage**: `handleDeleteOrganization` (576-637) städar aldrig profiles/auth-users och FK-kraschar halvvägs om `case_billing_items` finns (NO ACTION-FK; `customer_regions` städas däremot automatiskt via ON DELETE CASCADE); `handleDeleteUser` (747-777) raderar bara rollraden - profil + auth-user lever kvar och kan logga in (tom portal-läge).
- **GeoJSON i `customer_regions` är `[lng, lat]`**, Google Maps vill ha `{lat, lng}`. Konverteringar i `ManageRegionsModal.tsx:96-99` och RegionalMapView. Polygonringen måste stängas (första punkten dupliceras sist).
- **Namnkrock-mappningar**: wizarden mappar roleAssignments via site_name (`MultisiteRegistrationWizard.tsx:560-572`), ManageRegionsModal via site_name+region-kod (293-296). Dubblettnamn ger fel mappning.
- **Impersonation är rent klient-state** (försvinner vid reload), DB-frågor körs som ADMIN (RLS-fel kunden ser syns inte) och navigerar alltid till `/organisation` även för regionala användare.
- **Region-kunder får syntetisk e-post** `region-<kod>@intern.begone.se` (`ManageRegionsModal.tsx:273`). Filter/utskick måste undanta dessa.
- **Kontaktinfo-prioritet i CreateCaseModal**: vanliga ärenden platsansvarig > site > HK (450-470); rondering/egenkontroll ALLTID HK (440-442) och kundlistan visar bara `is_regional=true`-huvudkunder.
- **`RonderingSchedulePage.tsx:862-895` grupperar via `parent_customer_id`**, inte organization_id - en org utan fältet försvinner ur vyn.
- **Metadata i portal-skapade ärenden ligger som JSON-sträng i `cases.notes`** (`OrganizationServiceRequest.tsx:104-148`). Avsiktligt fulhack, inget eget fält finns.
- **`customers.billing_type` styr ingen faktureringslogik**: admin-UI läser/skriver fältet (`BillingSettingsModal.tsx:483`, `Customers.tsx:1752`, `OrganizationsPage.tsx:384`) men ingen service agerar på det, och MultisiteContext hårdkodar `'consolidated'` (`MultisiteContext.tsx:145,257,276`). Lämna tills per-site-fakturering byggs.
- **Sites-trippelfiltret** `organization_id + site_type='enhet' + is_multisite=true` är kopierat i ~20 filer med tyst divergens (MultisiteContext filtrerar `is_active` men inte `is_multisite`, admin tvärtom). Grep `site_type.*enhet` vid ändring.
- **Egenkontroll-mallar**: uppslag site → `customers.organization_id` → org-mall i `egenkontroll_templates` → global fallback. Detaljer (klonings-semantik: org-mallar propagerar inte globala ändringar): se skill egenkontroll-rondering.

## Riktning

Skillen beskriver dagens läge; följande skuld är värd att betala av när koden ändå rörs. Blockera inte förbättringarna med invarianterna ovan.

1. ~~**Auth på service-role-endpoints**~~ KLART 2026-07-03 (`bd487586`, `f74f44fc`): delad kontroll i `api/_lib/multisiteAuth.ts` (`getManagerContext` + `canManageOrganization`: admin/koordinator alla orgar, verksamhetschef bara sin egen) på alla tre endpoints, auth före body-validering. E-postbytet vägrar dessutom röra konton som inte är multisite-användare. Alla frontend-anropare skickar Bearer via `getAuthHeaders()`. 500 ms-sleepen är kvar.
2. **Server-side atomär radering**. Dagens läge: org-/site-/användarradering är klient-side, icke-transaktionell, synkar inte `site_ids` och städar aldrig profiles/auth-users. Målbild: SECURITY DEFINER-RPC:er `delete_organization`/`delete_site`/`delete_multisite_user` som atomärt flyttar billing-items, raderar polygoner/roller, synkar `site_ids` och nollar `profiles.organization_id`/`multisite_role`, med egen admin/koordinator-koll (mönster: `get_organization_users_complete`). Refaktorera ManageRegionsModals femstegssekvens först EFTER att RPC:erna finns - den är i dag den enda kod som gör synken rätt.
3. **Radera den döda multisite-generationen**: `src/components/multisite/*`, `src/pages/multisite/Portal.tsx`, `OrganizationManagement`/`MultisiteRegistrationPage`-importerna i App.tsx, `api/debug-sites.ts`, `api/link-sites-to-customers.ts`. Bevisat orefererad (`pages/multisite/Portal.tsx` importeras ingenstans och tree-shakas; App.tsx-importerna rad 62,65 bundlar däremot OrganizationManagement/MultisiteRegistrationPage i onödan) och är en aktiv fälla (fel datamodell) + onödig attackyta. `save-quote-recipient` kräver funktionstest av Oneflow-offertflödet först - ta den i separat steg.
4. **`MultisiteService` + EN permissions-matris**. Dagens läge: sites-trippelfiltret i ~20 filer och två matriser (`types/multisite.ts:187` vs `multisiteRoleValidation.ts:18`) som kan divergera tyst. Målbild: statisk `src/services/multisiteService.ts` med `getSites(orgId, { includeInactive? })`/`getHeadquarters(orgId)` (samma mönster som övriga services), types-varianten som kanonisk matris. Migrera fil för fil vid beröring, inte big bang. Laga samtidigt vy-registret: ersätt de två portal-switcharna med ett gemensamt register (view-id → komponent + villkor) så Portal.tsx och RegionalPortal.tsx inte kan divergera.
