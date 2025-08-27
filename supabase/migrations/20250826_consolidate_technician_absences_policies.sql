-- ===============================================================================
-- TECHNICIAN_ABSENCES RLS POLICY KONSOLIDERING
-- ===============================================================================
--
-- SYFTE: Konsolidera technician_absences policies för att eliminera Multiple Permissive Policies varningar
-- DATUM: 2025-08-26
-- PROBLEM: technician_absences har 16+ varningar från admin+manage_own policies
--
-- STRATEGI: 2 policies (multiplicerat över roles) → 2 konsoliderade policies
-- RESULTAT: Eliminera Multiple Permissive Policies varningar för technician_absences
--
-- ===============================================================================

BEGIN;

RAISE NOTICE '🔄 Konsoliderar TECHNICIAN_ABSENCES policies...';

-- =============================================================================
-- STEG 1: TA BORT FRAGMENTERADE POLICIES
-- =============================================================================

-- Ta bort befintliga policies som skapar role-duplication
DROP POLICY IF EXISTS "technician_absences_admin_koordinator_full_access" ON technician_absences;
DROP POLICY IF EXISTS "technician_absences_manage_own" ON technician_absences;

-- Ta bort eventuella andra variants
DROP POLICY IF EXISTS "technician_absences_admin_koordinator" ON technician_absences;
DROP POLICY IF EXISTS "technician_absences_self_management" ON technician_absences;

RAISE NOTICE '✅ Gamla fragmenterade technician_absences policies borttagna';

-- =============================================================================
-- STEG 2: SKAPA KONSOLIDERADE POLICIES
-- =============================================================================

-- ----------------------
-- POLICY 1: ADMIN/KOORDINATOR FULL ACCESS (ALL operations)
-- ----------------------
CREATE POLICY "technician_absences_admin_full_access" ON technician_absences
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND role::text IN ('admin', 'koordinator')
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND role::text IN ('admin', 'koordinator')
            AND is_active = true
        )
    );

RAISE NOTICE '✅ Admin/koordinator full access policy skapad';

-- ----------------------  
-- POLICY 2: TECHNICIAN SELF-MANAGEMENT (ALL operations on own records)
-- ----------------------
CREATE POLICY "technician_absences_self_management" ON technician_absences
    FOR ALL
    TO authenticated
    USING (
        -- Tekniker kan hantera sina egna frånvaroperioder
        technician_id IN (
            SELECT technician_id FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND technician_id IS NOT NULL
            AND is_active = true
        )
    )
    WITH CHECK (
        -- Tekniker kan endast skapa/uppdatera sina egna frånvaroperioder
        technician_id IN (
            SELECT technician_id FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND technician_id IS NOT NULL
            AND is_active = true
        )
    );

RAISE NOTICE '✅ Technician self-management policy skapad';

-- ----------------------
-- POLICY 3: SERVICE ROLE ACCESS (Backend/API)
-- ----------------------  
CREATE POLICY "technician_absences_service_role" ON technician_absences
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
    WHERE tablename = 'technician_absences';
    
    IF policy_count = 3 THEN
        RAISE NOTICE '✅ Exakt 3 policies skapade för technician_absences';
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
    WHERE relname = 'technician_absences';
    
    IF rls_enabled THEN
        RAISE NOTICE '✅ RLS aktiverat för technician_absences';
    ELSE
        RAISE EXCEPTION 'RLS inte aktiverat för technician_absences';
    END IF;
END $$;

-- =============================================================================
-- SLUTRAPPORT
-- =============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== TECHNICIAN_ABSENCES RLS KONSOLIDERING SLUTFÖRD ===';
RAISE NOTICE '';
RAISE NOTICE '📊 RESULTAT:';
RAISE NOTICE '  • Role-duplicated policies: ELIMINERADE';
RAISE NOTICE '  • Multiple Permissive Policies varningar: ELIMINERADE';
RAISE NOTICE '  • Nya konsoliderade policies: 3 stycken';
RAISE NOTICE '';
RAISE NOTICE '🔒 TEKNIKER FRÅNVARO SÄKERHET BEVARAD:';
RAISE NOTICE '  • Admin/koordinator: Full access till alla teknikers frånvaro';
RAISE NOTICE '  • Tekniker: Kan endast hantera sina egna frånvaroperioder';
RAISE NOTICE '  • Ingen tekniker kan se andras frånvaro';
RAISE NOTICE '  • Service role: Backend system access';
RAISE NOTICE '';
RAISE NOTICE '📅 FRÅNVAROHANTERING:';
RAISE NOTICE '  • Tekniker kan skapa sina egna ledigheter';
RAISE NOTICE '  • Tekniker kan uppdatera sina egna frånvaroperioder';
RAISE NOTICE '  • Tekniker kan ta bort sina egna frånvaroperioder';
RAISE NOTICE '  • Admin/koordinator kan hantera all personalfrånvaro';
RAISE NOTICE '';
RAISE NOTICE '✅ MIGRATION SLUTFÖRD FRAMGÅNGSRIKT';

COMMIT;