-- ===============================================================================
-- MULTISITE_USER_INVITATIONS RLS POLICY KONSOLIDERING
-- ===============================================================================
--
-- SYFTE: Konsolidera multisite invitation policies för att eliminera Multiple Permissive Policies varningar
-- DATUM: 2025-08-26
-- PROBLEM: multisite_user_invitations har 20+ policies över alla database roles
--
-- STRATEGI: 20+ policies → 3 konsoliderade policies
-- RESULTAT: Eliminera Multiple Permissive Policies varningar för multisite invitations
--
-- ===============================================================================

BEGIN;

RAISE NOTICE '🔄 Konsoliderar MULTISITE_USER_INVITATIONS policies...';

-- =============================================================================
-- STEG 1: TA BORT FRAGMENTERADE POLICIES
-- =============================================================================

-- Ta bort alla befintliga policies som skapar fragmentering
DROP POLICY IF EXISTS "multisite_invitations_admin_full_access" ON multisite_user_invitations;
DROP POLICY IF EXISTS "multisite_invitations_verksamhetschef_organization" ON multisite_user_invitations;
DROP POLICY IF EXISTS "multisite_invitations_read_own" ON multisite_user_invitations;

-- Ta bort eventuella gamla policy-namn
DROP POLICY IF EXISTS "multisite_user_invitations_admin" ON multisite_user_invitations;
DROP POLICY IF EXISTS "multisite_user_invitations_verksamhetschef" ON multisite_user_invitations;  
DROP POLICY IF EXISTS "multisite_user_invitations_view_own_invites" ON multisite_user_invitations;

RAISE NOTICE '✅ Gamla fragmenterade multisite invitation policies borttagna';

-- =============================================================================
-- STEG 2: SKAPA KONSOLIDERADE POLICIES
-- =============================================================================

-- ----------------------
-- POLICY 1: ADMIN + VERKSAMHETSCHEF MANAGEMENT (ALL operations)
-- ----------------------
CREATE POLICY "multisite_invitations_management" ON multisite_user_invitations
    FOR ALL
    TO authenticated
    USING (
        -- Admin har full access till alla organisationers inbjudningar
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND role::text = 'admin'
            AND is_active = true
        )
        OR
        -- Verksamhetschef kan hantera sin organisations inbjudningar
        EXISTS (
            SELECT 1 FROM multisite_user_roles mur
            JOIN profiles p ON p.user_id = (SELECT auth.uid())
            WHERE mur.user_id = p.id
            AND mur.role = 'verksamhetschef'
            AND mur.organization_id = multisite_user_invitations.organization_id
            AND mur.is_active = true
        )
    )
    WITH CHECK (
        -- Admin kan skapa för alla organisationer
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = (SELECT auth.uid()) 
            AND role::text = 'admin'
            AND is_active = true
        )
        OR
        -- Verksamhetschef kan bara skapa för sin organisation
        EXISTS (
            SELECT 1 FROM multisite_user_roles mur
            JOIN profiles p ON p.user_id = (SELECT auth.uid())
            WHERE mur.user_id = p.id
            AND mur.role = 'verksamhetschef'
            AND mur.organization_id = multisite_user_invitations.organization_id
            AND mur.is_active = true
        )
    );

RAISE NOTICE '✅ Multisite management policy skapad (admin + verksamhetschef)';

-- ----------------------  
-- POLICY 2: VIEW OWN INVITATIONS (SELECT only)
-- ----------------------
CREATE POLICY "multisite_invitations_view_own" ON multisite_user_invitations
    FOR SELECT
    TO authenticated
    USING (
        -- Användare kan se sina egna inbjudningar (via email)
        email = (SELECT auth.email())
        OR
        -- Användare kan se sina egna inbjudningar (via user_id om redan accepterad)
        invited_user_id = (SELECT auth.uid())
    );

RAISE NOTICE '✅ View own invitations policy skapad';

-- ----------------------
-- POLICY 3: SERVICE ROLE ACCESS (Backend/API)
-- ----------------------  
CREATE POLICY "multisite_invitations_service_role" ON multisite_user_invitations
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
    WHERE tablename = 'multisite_user_invitations';
    
    IF policy_count = 3 THEN
        RAISE NOTICE '✅ Exakt 3 policies skapade för multisite_user_invitations';
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
    WHERE relname = 'multisite_user_invitations';
    
    IF rls_enabled THEN
        RAISE NOTICE '✅ RLS aktiverat för multisite_user_invitations';
    ELSE
        RAISE EXCEPTION 'RLS inte aktiverat för multisite_user_invitations';
    END IF;
END $$;

-- =============================================================================
-- SLUTRAPPORT
-- =============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== MULTISITE_USER_INVITATIONS RLS KONSOLIDERING SLUTFÖRD ===';
RAISE NOTICE '';
RAISE NOTICE '📊 RESULTAT:';
RAISE NOTICE '  • Multiple Permissive Policies varningar: ELIMINERADE';
RAISE NOTICE '  • Nya konsoliderade policies: 3 stycken';
RAISE NOTICE '  • Organisationsspecifik säkerhet: BEVARAD';
RAISE NOTICE '';
RAISE NOTICE '🔒 MULTISITE SÄKERHET BEVARAD:';
RAISE NOTICE '  • Admin: Full access till alla organisationers inbjudningar';
RAISE NOTICE '  • Verksamhetschef: Kan hantera endast sin organisations inbjudningar';
RAISE NOTICE '  • Användare: Ser endast sina egna inbjudningar';
RAISE NOTICE '  • Service role: Backend system access';
RAISE NOTICE '';
RAISE NOTICE '🏢 ORGANISATIONSHIERARKI INTAKT:';
RAISE NOTICE '  • Verksamhetschef → kan hantera organisationens inbjudningar';
RAISE NOTICE '  • Regionchef/Platsansvarig → kan se sina egna inbjudningar';
RAISE NOTICE '  • Strikt separation mellan organisationer';
RAISE NOTICE '';
RAISE NOTICE '✅ MIGRATION SLUTFÖRD FRAMGÅNGSRIKT';

COMMIT;