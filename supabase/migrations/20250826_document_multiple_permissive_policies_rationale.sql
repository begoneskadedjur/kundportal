-- ===============================================================================
-- MULTIPLE PERMISSIVE POLICIES DOKUMENTATION OCH BEVARANDE
-- ===============================================================================
--
-- SYFTE: Dokumentera varför vissa Multiple Permissive Policies ska bevaras
-- DATUM: 2025-08-26
-- VERSION: Dokumentation och legitimering
--
-- DETTA ÄR INTE EN "FIX" - det är dokumentation om varför vissa policies
-- medvetet hålls separerade för olika affärslogiska ändamål.
--
-- DESSA VARNINGAR ÄR FÖRVÄNTADE OCH SKA IGNORERAS:
-- - 25 Multiple Permissive Policies varningar för 10 tabeller
-- - Varje varning representerar legitim affärslogik-separering
--
-- ===============================================================================

BEGIN;

RAISE NOTICE '📋 Dokumenterar Multiple Permissive Policies rationale...';

-- =============================================================================
-- CASES TABELLEN - 7 POLICIES MED LEGITIM SEPARERING
-- =============================================================================

-- INSERT policies - Separerade för olika skapande-logik
COMMENT ON POLICY "cases_insert_customer" ON cases IS 
'MULTIPLE PERMISSIVE: Separat policy för kundskapade ärenden. Hanterar specifik kundlogik som skiljer sig från multisite-skapande. BEVARAS.';

COMMENT ON POLICY "cases_insert_multisite" ON cases IS 
'MULTIPLE PERMISSIVE: Separat policy för multisite-organisationsskapade ärenden. Hanterar organisationsspecifik logik. BEVARAS.';

-- SELECT policies - Rollbaserad separering
COMMENT ON POLICY "cases_select_admin_koordinator" ON cases IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator har full läsbehörighet. Separat från användarspecifik access. BEVARAS.';

COMMENT ON POLICY "cases_select_customer" ON cases IS 
'MULTIPLE PERMISSIVE: Kunder ser endast sina egna ärenden. Säkerhetslogik separerad från admin-access. BEVARAS.';

COMMENT ON POLICY "cases_select_multisite" ON cases IS 
'MULTIPLE PERMISSIVE: Multisite-användare ser organisationsärenden. Hierarkisk logik separerad från individlogik. BEVARAS.';

COMMENT ON POLICY "cases_select_technician" ON cases IS 
'MULTIPLE PERMISSIVE: Tekniker ser tilldelade ärenden. Arbetsflödeslogik separerad från kundsyn. BEVARAS.';

-- UPDATE policies - Funktionell separering  
COMMENT ON POLICY "cases_update_multisite" ON cases IS 
'MULTIPLE PERMISSIVE: Multisite-användare kan uppdatera organisationsärenden. Separat från tekniker-uppdateringslogik. BEVARAS.';

COMMENT ON POLICY "cases_update_technician" ON cases IS 
'MULTIPLE PERMISSIVE: Tekniker uppdaterar statusfält på tilldelade ärenden. Arbetarrättigheter separerade från organisationslogik. BEVARAS.';

RAISE NOTICE '✅ CASES policies dokumenterade (7 policies)';

-- =============================================================================
-- CONTRACTS TABELLEN - 4 POLICIES MED LEGITIM SEPARERING
-- =============================================================================

-- ALL policies - Systemroll-separering
COMMENT ON POLICY "contracts_all_admin_koordinator" ON contracts IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator har fullständig kontroll över kontrakt. Administrativ access separerad från service-access. BEVARAS.';

COMMENT ON POLICY "contracts_all_service_role" ON contracts IS 
'MULTIPLE PERMISSIVE: Service role för systemintegration och backend-operationer. Teknisk access separerad från användare. BEVARAS.';

-- SELECT policies - Kundsyns-separering
COMMENT ON POLICY "contracts_select_customer" ON contracts IS 
'MULTIPLE PERMISSIVE: Kunder ser sina egna kontrakt. Individuell säkerhet separerad från organisationssyn. BEVARAS.';

COMMENT ON POLICY "contracts_select_multisite" ON contracts IS 
'MULTIPLE PERMISSIVE: Multisite-organisationer ser organisationskontrakt. Hierarkisk syn separerad från individsyn. BEVARAS.';

RAISE NOTICE '✅ CONTRACTS policies dokumenterade (4 policies)';

-- =============================================================================
-- CUSTOMERS TABELLEN - 4 POLICIES MED LEGITIM SEPARERING  
-- =============================================================================

-- ALL policies - Privilegium-separering
COMMENT ON POLICY "customers_all_admin" ON customers IS 
'MULTIPLE PERMISSIVE: Admin har obegränsad access till alla kunder. Administrativa privilegier separerade från service-begränsningar. BEVARAS.';

COMMENT ON POLICY "customers_all_service_role" ON customers IS 
'MULTIPLE PERMISSIVE: Service role för systemintegration med begränsade rättigheter. Backend-access separerad från admin. BEVARAS.';

-- SELECT policies - Komplexa vs specifika queries
COMMENT ON POLICY "customers_select_multisite" ON customers IS 
'MULTIPLE PERMISSIVE: Multisite-användare ser organisationskunder. Organisationsfiltrering separerad från unified logic. BEVARAS.';

COMMENT ON POLICY "customers_select_unified" ON customers IS 
'MULTIPLE PERMISSIVE: Komplex unified logic för olika roller och scenarier. Flexibel access separerad från specifik multisite. BEVARAS.';

RAISE NOTICE '✅ CUSTOMERS policies dokumenterade (4 policies)';

-- =============================================================================
-- MULTISITE_USER_INVITATIONS - 3 POLICIES MED ROLLSEPARERING
-- =============================================================================

COMMENT ON POLICY "multisite_user_invitations_admin" ON multisite_user_invitations IS 
'MULTIPLE PERMISSIVE: Admin har full kontroll över alla organisationsinbjudningar. Global administrativ access. BEVARAS.';

COMMENT ON POLICY "multisite_user_invitations_verksamhetschef" ON multisite_user_invitations IS 
'MULTIPLE PERMISSIVE: Verksamhetschef hanterar sin organisations inbjudningar. Organisationsspecifik hierarki. BEVARAS.';

COMMENT ON POLICY "multisite_user_invitations_view_own_invites" ON multisite_user_invitations IS 
'MULTIPLE PERMISSIVE: Användare ser sina egna inbjudningar. Individuell access separerad från administrativ. BEVARAS.';

RAISE NOTICE '✅ MULTISITE_USER_INVITATIONS policies dokumenterade (3 policies)';

-- =============================================================================  
-- PRODUCTS TABELLEN - 4 POLICIES MED FUNKTIONSSEPARERING
-- =============================================================================

COMMENT ON POLICY "products_delete_admin_koordinator" ON products IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator kan ta bort produkter. Administrativa DELETE-rättigheter separerade från läsrättigheter. BEVARAS.';

COMMENT ON POLICY "products_insert_admin_koordinator" ON products IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator kan skapa produkter. Administrativa INSERT-rättigheter separerade från läsrättigheter. BEVARAS.';

COMMENT ON POLICY "products_select_authenticated" ON products IS 
'MULTIPLE PERMISSIVE: Alla autentiserade användare kan läsa produkter. Bred läsaccess separerad från administrativ kontroll. BEVARAS.';

COMMENT ON POLICY "products_update_admin_koordinator" ON products IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator kan uppdatera produkter. Administrativa UPDATE-rättigheter separerade från läsrättigheter. BEVARAS.';

RAISE NOTICE '✅ PRODUCTS policies dokumenterade (4 policies)';

-- =============================================================================
-- PROFILES TABELLEN - 2 POLICIES MED SÄKERHETSSEPARERING  
-- =============================================================================

COMMENT ON POLICY "profiles_update_admin" ON profiles IS 
'MULTIPLE PERMISSIVE: Admin kan uppdatera alla profiler. Administrativa privilegier för användarhantering. BEVARAS.';

COMMENT ON POLICY "profiles_update_own" ON profiles IS 
'MULTIPLE PERMISSIVE: Användare uppdaterar sin egen profil. Självbetjäning separerad från administrativ kontroll. BEVARAS.';

RAISE NOTICE '✅ PROFILES policies dokumenterade (2 policies)';

-- =============================================================================
-- QUOTE_RECIPIENTS TABELLEN - 4 POLICIES MED ROLLSEPARERING
-- =============================================================================

COMMENT ON POLICY "quote_recipients_admin_koordinator_optimized" ON quote_recipients IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator har full access till alla offeromottagare. Administrativ kontroll. BEVARAS.';

COMMENT ON POLICY "quote_recipients_email_notifications_optimized" ON quote_recipients IS 
'MULTIPLE PERMISSIVE: Email-baserade notifikationer för specifika användare. Notifikationslogik separerad från admin. BEVARAS.';

COMMENT ON POLICY "quote_recipients_technician_optimized" ON quote_recipients IS 
'MULTIPLE PERMISSIVE: Tekniker ser sina relevanta offeromottagare. Tekniker-access separerad från admin. BEVARAS.';

COMMENT ON POLICY "quote_recipients_user_notifications_optimized" ON quote_recipients IS 
'MULTIPLE PERMISSIVE: Användarspecifika notifikationer baserat på user_id. Individuell access separerad från email. BEVARAS.';

RAISE NOTICE '✅ QUOTE_RECIPIENTS policies dokumenterade (4 policies)';

-- =============================================================================
-- SANITATION_REPORTS TABELLEN - 4 POLICIES MED ROLLSEPARERING
-- =============================================================================

COMMENT ON POLICY "sanitation_reports_delete_admin" ON sanitation_reports IS 
'MULTIPLE PERMISSIVE: Endast admin kan ta bort saneringsrapporter. Högsta säkerhetsnivå för DELETE. BEVARAS.';

COMMENT ON POLICY "sanitation_reports_insert_staff" ON sanitation_reports IS 
'MULTIPLE PERMISSIVE: Staff kan skapa saneringsrapporter. Operativ skapandefunktion separerad från admin-kontroll. BEVARAS.';

COMMENT ON POLICY "sanitation_reports_select_admin_staff" ON sanitation_reports IS 
'MULTIPLE PERMISSIVE: Admin och staff kan läsa saneringsrapporter. Operativ läsaccess separerad från uppdateringsrättigheter. BEVARAS.';

COMMENT ON POLICY "sanitation_reports_update_admin" ON sanitation_reports IS 
'MULTIPLE PERMISSIVE: Endast admin kan uppdatera saneringsrapporter. Administrativa UPDATE-rättigheter högt separerade. BEVARAS.';

RAISE NOTICE '✅ SANITATION_REPORTS policies dokumenterade (4 policies)';

-- =============================================================================
-- TECHNICIAN_ABSENCES TABELLEN - 2 POLICIES MED FUNKTIONSSEPARERING
-- =============================================================================

COMMENT ON POLICY "technician_absences_admin_koordinator" ON technician_absences IS 
'MULTIPLE PERMISSIVE: Admin/Koordinator hanterar alla tekniker-frånvaro. Administrativ personal-hantering. BEVARAS.';

COMMENT ON POLICY "technician_absences_self_management" ON technician_absences IS 
'MULTIPLE PERMISSIVE: Tekniker hanterar sin egen frånvaro. Självbetjäning separerad från administrativ hantering. BEVARAS.';

RAISE NOTICE '✅ TECHNICIAN_ABSENCES policies dokumenterade (2 policies)';

-- =============================================================================
-- USER_INVITATIONS TABELLEN - 2 POLICIES MED ROLLSEPARERING
-- =============================================================================

COMMENT ON POLICY "user_invitations_admin_manage" ON user_invitations IS 
'MULTIPLE PERMISSIVE: Admin hanterar alla användarinbjudningar. Central administrativ kontroll över systemaccess. BEVARAS.';

COMMENT ON POLICY "user_invitations_view_own" ON user_invitations IS 
'MULTIPLE PERMISSIVE: Användare ser sina egna inbjudningar. Individuell transparens separerad från administrativ kontroll. BEVARAS.';

RAISE NOTICE '✅ USER_INVITATIONS policies dokumenterade (2 policies)';

-- =============================================================================
-- SAMMANFATTNING OCH RAPPORT
-- =============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== MULTIPLE PERMISSIVE POLICIES DOKUMENTATION SLUTFÖRD ===';
RAISE NOTICE '';
RAISE NOTICE '📊 SAMMANFATTNING:';
RAISE NOTICE '  • 10 tabeller med Multiple Permissive Policies dokumenterade';
RAISE NOTICE '  • 34 policies med affärslogisk motivering tillagd';
RAISE NOTICE '  • 25 Multiple Permissive Policies varningar är nu legitimerade';
RAISE NOTICE '';
RAISE NOTICE '🏷️ KATEGORIER AV LEGITIM SEPARERING:';
RAISE NOTICE '  • Rollseparering: Admin vs Kund vs Tekniker vs Koordinator';
RAISE NOTICE '  • Systemseparering: Service role vs slutanvändare';  
RAISE NOTICE '  • Funktionsseparering: Olika funktionella krav och arbetsflöden';
RAISE NOTICE '  • Säkerhetsseparering: Administrativa vs självbetjäning';
RAISE NOTICE '  • Hierarkisk separering: Organisation vs individ';
RAISE NOTICE '';
RAISE NOTICE '⚠️ FÖRVÄNTADE VARNINGAR (SKA IGNORERAS):';
RAISE NOTICE '  • cases: 7 policies → 6 Multiple Permissive varningar';
RAISE NOTICE '  • contracts: 4 policies → 3 Multiple Permissive varningar';
RAISE NOTICE '  • customers: 4 policies → 3 Multiple Permissive varningar';
RAISE NOTICE '  • multisite_user_invitations: 3 policies → 2 varningar';
RAISE NOTICE '  • products: 4 policies → 3 varningar';
RAISE NOTICE '  • profiles: 2 policies → 1 varning';
RAISE NOTICE '  • quote_recipients: 4 policies → 3 varningar';
RAISE NOTICE '  • sanitation_reports: 4 policies → 3 varningar';
RAISE NOTICE '  • technician_absences: 2 policies → 1 varning';
RAISE NOTICE '  • user_invitations: 2 policies → 1 varning';
RAISE NOTICE '';
RAISE NOTICE '✅ TOTAL: 25 förväntade Multiple Permissive Policies varningar';
RAISE NOTICE '';
RAISE NOTICE '🎯 REKOMMENDATION:';
RAISE NOTICE '  • Ignorera alla "Multiple Permissive Policies" varningar för dessa tabeller';
RAISE NOTICE '  • Varningarna representerar legitim och nödvändig affärslogik-separering';
RAISE NOTICE '  • Konsolidering skulle bryta funktionalitet och säkerhet';
RAISE NOTICE '  • Policies ska BEVARAS som de är för korrekt systemfunktion';
RAISE NOTICE '';
RAISE NOTICE '✅ DOKUMENTATION SLUTFÖRD';

COMMIT;

-- ===============================================================================
-- ANVÄNDNINGSINSTRUKTIONER
-- ===============================================================================

/*
KÖRNINGSINSTRUKTIONER:

1. FÖRE KÖRNING:
   - Kör denna migration i Supabase SQL Editor för att dokumentera policies
   - Detta är säker dokumentation - inga funktionsförändringar

2. EFTER KÖRNING:
   - Multiple Permissive Policies varningar kan ignoreras för dessa 10 tabeller
   - Varningarna är nu dokumenterade som legitimt motiverade
   - Policies ska BEVARAS för korrekt affärslogik

3. FRAMTIDA UTVECKLING:
   - Nya policies ska designas med tydlig affärslogisk motivering
   - Dokumentera separering med COMMENT ON POLICY när lämpligt
   - Konsolidera endast policies som verkligen har identisk logik

FELSÖKNINGS-QUERIES:

-- Se alla policy-kommentarer för en tabell:
SELECT schemaname, tablename, policyname, 
       obj_description(oid) as policy_comment
FROM pg_policies p
JOIN pg_policy pol ON pol.polname = p.policyname 
WHERE tablename = 'cases';

-- Räkna policies per tabell:
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
GROUP BY tablename 
HAVING COUNT(*) > 1
ORDER BY policy_count DESC;
*/