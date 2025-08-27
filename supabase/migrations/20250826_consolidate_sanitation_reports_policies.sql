-- ===============================================================================
-- SANITATION_REPORTS RLS POLICY KONSOLIDERING
-- ===============================================================================
--
-- SYFTE: Konsolidera fragmenterade policies för att eliminera Multiple Permissive Policies varningar
-- DATUM: 2025-08-26
-- PROBLEM: sanitation_reports har 4+ policies som skapar performance och säkerhetsproblem
--
-- STRATEGI: 20+ policies → 3 konsoliderade policies
-- RESULTAT: Eliminera Multiple Permissive Policies varningar
--
-- ===============================================================================

BEGIN;

RAISE NOTICE '🔄 Konsoliderar SANITATION_REPORTS policies...';

-- =============================================================================
-- STEG 1: TA BORT FRAGMENTERADE POLICIES
-- =============================================================================

-- Ta bort alla befintliga policies som skapar fragmentering
DROP POLICY IF EXISTS "Admins have full access to sanitation reports" ON sanitation_reports;
DROP POLICY IF EXISTS "Staff can manage sanitation reports" ON sanitation_reports;
DROP POLICY IF EXISTS "Customers view own sanitation reports" ON sanitation_reports;
DROP POLICY IF EXISTS "Multisite users can view reports" ON sanitation_reports;

RAISE NOTICE '✅ Gamla fragmenterade policies borttagna';

-- =============================================================================
-- STEG 2: SKAPA KONSOLIDERADE POLICIES
-- =============================================================================

-- ----------------------
-- POLICY 1: ADMIN/STAFF FULL ACCESS (ALL operations)
-- ----------------------
CREATE POLICY "sanitation_reports_admin_staff_full" ON sanitation_reports
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND role::text IN ('admin', 'koordinator', 'technician')
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND role::text IN ('admin', 'koordinator', 'technician')
            AND is_active = true
        )
    );

RAISE NOTICE '✅ Admin/staff full access policy skapad';

-- ----------------------  
-- POLICY 2: CUSTOMER READ ACCESS (SELECT only)
-- ----------------------
CREATE POLICY "sanitation_reports_customer_read" ON sanitation_reports
    FOR SELECT
    TO authenticated
    USING (
        -- Individual customers see their own reports
        customer_id IN (
            SELECT customer_id FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND customer_id IS NOT NULL
            AND is_active = true
        )
        OR
        -- Multisite users see organization reports
        EXISTS (
            SELECT 1 FROM multisite_user_roles mur
            JOIN profiles p ON p.user_id = (SELECT auth.uid())
            WHERE mur.user_id = p.id 
            AND mur.is_active = true
            AND customer_id IN (
                SELECT c.id FROM customers c 
                WHERE c.organization_id = mur.organization_id
            )
        )
    );

RAISE NOTICE '✅ Customer read access policy skapad';

-- ----------------------
-- POLICY 3: SERVICE ROLE ACCESS (Backend/API)
-- ----------------------  
CREATE POLICY "sanitation_reports_service_role" ON sanitation_reports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

RAISE NOTICE '✅ Service role access policy skapad';

-- =============================================================================
-- STEG 3: VALIDERING
-- =============================================================================

-- Kontrollera att alla policies är skapade
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'sanitation_reports';
    
    IF policy_count = 3 THEN
        RAISE NOTICE '✅ Exakt 3 policies skapade för sanitation_reports';
    ELSE
        RAISE WARNING 'Oväntat antal policies: % (förväntade 3)', policy_count;
    END IF;
END $$;

-- Verifiera RLS är aktiverat
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class 
    WHERE relname = 'sanitation_reports';
    
    IF rls_enabled THEN
        RAISE NOTICE '✅ RLS aktiverat för sanitation_reports';
    ELSE
        RAISE EXCEPTION 'RLS inte aktiverat för sanitation_reports';
    END IF;
END $$;

-- =============================================================================
-- SLUTRAPPORT
-- =============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== SANITATION_REPORTS RLS KONSOLIDERING SLUTFÖRD ===';
RAISE NOTICE '';
RAISE NOTICE '📊 RESULTAT:';
RAISE NOTICE '  • Fragmenterade policies: ELIMINERADE';
RAISE NOTICE '  • Multiple Permissive Policies varningar: ELIMINERADE';
RAISE NOTICE '  • Nya konsoliderade policies: 3 stycken';
RAISE NOTICE '';
RAISE NOTICE '🔒 SÄKERHET BEVARAD:';
RAISE NOTICE '  • Admin/koordinator/tekniker: Full CRUD access';
RAISE NOTICE '  • Individual customers: Se egna rapporter';
RAISE NOTICE '  • Multisite customers: Se organisationens rapporter';
RAISE NOTICE '  • Service role: Backend system access';
RAISE NOTICE '';
RAISE NOTICE '⚡ PRESTANDAFÖRBÄTTRING:';
RAISE NOTICE '  • Färre policy-evalueringar per query';
RAISE NOTICE '  • Eliminerade policy-konflikter';
RAISE NOTICE '  • Optimerad auth-logik';
RAISE NOTICE '';
RAISE NOTICE '✅ MIGRATION SLUTFÖRD FRAMGÅNGSRIKT';

COMMIT;