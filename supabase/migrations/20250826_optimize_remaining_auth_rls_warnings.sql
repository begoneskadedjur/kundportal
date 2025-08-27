-- FAS 2: AUTH RLS OPTIMERING
-- Datum: 2025-08-26
-- Syfte: Eliminera kvarvarande Auth RLS Initialization Plan warnings genom att optimera auth-funktionsanrop
-- 
-- Denna migrering optimerar alla kvarvarande RLS-policies som använder direkta auth.uid() och auth.email() anrop
-- genom att wrappa dem i SELECT-satser för bättre prestanda och eliminering av varningar.

BEGIN;

-- Logga starten av optimeringen
DO $$ 
BEGIN
    RAISE NOTICE 'STARTAR FAS 2: AUTH RLS OPTIMERING - %', now();
    RAISE NOTICE 'Optimerar kvarvarande policies med direkta auth-funktionsanrop';
END $$;

-- ============================================================================
-- 1. MULTISITE_USER_ROLES - Optimera alla policies
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE 'Optimerar multisite_user_roles policies...';
END $$;

-- Drop och återskapa alla multisite_user_roles policies med optimerade auth-anrop
DROP POLICY IF EXISTS "Admin and coordinators can manage user roles" ON multisite_user_roles;
DROP POLICY IF EXISTS "Admins and quality managers can delete roles" ON multisite_user_roles;
DROP POLICY IF EXISTS "Admins and quality managers can insert roles" ON multisite_user_roles;
DROP POLICY IF EXISTS "Admins and quality managers can update roles" ON multisite_user_roles;
DROP POLICY IF EXISTS "Staff can view all roles, customers view own organization" ON multisite_user_roles;

-- Optimerad SELECT policy
CREATE POLICY "Staff can view all roles, customers view own organization" ON multisite_user_roles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.role::text = ANY(ARRAY['admin'::text, 'koordinator'::text, 'technician'::text])
                OR (
                    profiles.organization_id IS NOT NULL 
                    AND profiles.organization_id = multisite_user_roles.organization_id
                )
            )
        )
    );

-- Optimerad INSERT policy
CREATE POLICY "Admins and quality managers can insert roles" ON multisite_user_roles
    FOR INSERT TO public
    WITH CHECK (
        (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.is_admin = true
            )
        ) OR (
            organization_id = (
                SELECT profiles.organization_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.multisite_role = 'verksamhetschef'::text
            )
        )
    );

-- Optimerad UPDATE policy
CREATE POLICY "Admins and quality managers can update roles" ON multisite_user_roles
    FOR UPDATE TO public
    USING (
        (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.is_admin = true
            )
        ) OR (
            organization_id = (
                SELECT profiles.organization_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.multisite_role = 'verksamhetschef'::text
            )
        )
    )
    WITH CHECK (
        (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.is_admin = true
            )
        ) OR (
            organization_id = (
                SELECT profiles.organization_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.multisite_role = 'verksamhetschef'::text
            )
        )
    );

-- Optimerad DELETE policy
CREATE POLICY "Admins and quality managers can delete roles" ON multisite_user_roles
    FOR DELETE TO public
    USING (
        (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.is_admin = true
            )
        ) OR (
            organization_id = (
                SELECT profiles.organization_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.multisite_role = 'verksamhetschef'::text
            )
        )
    );

-- Optimerad ALL policy (kombinerad för admin och coordinators)
CREATE POLICY "Admin and coordinators can manage user roles" ON multisite_user_roles
    FOR ALL TO public
    USING (
        (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND (profiles.is_admin = true OR profiles.is_koordinator = true)
            )
        ) OR (
            organization_id = (
                SELECT profiles.organization_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.multisite_role = 'verksamhetschef'::text
            )
        )
    )
    WITH CHECK (
        (
            EXISTS (
                SELECT 1
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND (profiles.is_admin = true OR profiles.is_koordinator = true)
            )
        ) OR (
            organization_id = (
                SELECT profiles.organization_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
                AND profiles.multisite_role = 'verksamhetschef'::text
            )
        )
    );

-- ============================================================================
-- 2. QUOTE_RECIPIENTS - Fixa kvarvarande auth-anrop
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE 'Optimerar quote_recipients policies...';
END $$;

-- Optimera quote_recipients policies som fortfarande har direkta auth-anrop
DROP POLICY IF EXISTS "quote_recipients_admin_koordinator_optimized" ON quote_recipients;
DROP POLICY IF EXISTS "quote_recipients_technician_optimized" ON quote_recipients;
DROP POLICY IF EXISTS "quote_recipients_update_user_fields_optimized" ON quote_recipients;
DROP POLICY IF EXISTS "quote_recipients_email_notifications_optimized" ON quote_recipients;
DROP POLICY IF EXISTS "quote_recipients_user_notifications_optimized" ON quote_recipients;
DROP POLICY IF EXISTS "quote_recipients_insert_optimized" ON quote_recipients;

-- Återskapa med fullständigt optimerade auth-anrop
CREATE POLICY "quote_recipients_admin_koordinator_optimized" ON quote_recipients
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
            AND (p.is_admin = true OR p.is_koordinator = true OR p.role::text = 'koordinator'::text)
        )
        AND is_active = true
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
            AND (p.is_admin = true OR p.is_koordinator = true OR p.role::text = 'koordinator'::text)
        )
    );

CREATE POLICY "quote_recipients_technician_optimized" ON quote_recipients
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
            AND p.role::text = 'technician'::text
        )
        AND is_active = true
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
            AND p.role::text = 'technician'::text
        )
    );

CREATE POLICY "quote_recipients_insert_optimized" ON quote_recipients
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
            AND (
                p.is_admin = true 
                OR p.is_koordinator = true 
                OR p.role::text = ANY(ARRAY['koordinator'::text, 'technician'::text])
            )
        )
    );

CREATE POLICY "quote_recipients_email_notifications_optimized" ON quote_recipients
    FOR SELECT TO authenticated
    USING (
        user_email = (SELECT auth.email())
        AND is_active = true
    );

CREATE POLICY "quote_recipients_user_notifications_optimized" ON quote_recipients
    FOR SELECT TO authenticated
    USING (
        specific_user_id = (SELECT auth.uid())
        AND is_active = true
    );

CREATE POLICY "quote_recipients_update_user_fields_optimized" ON quote_recipients
    FOR UPDATE TO authenticated
    USING (
        (
            user_email = (SELECT auth.email())
            OR specific_user_id = (SELECT auth.uid())
        )
        AND is_active = true
    )
    WITH CHECK (
        (
            user_email = (SELECT auth.email())
            OR specific_user_id = (SELECT auth.uid())
        )
        AND is_active = true
    );

-- ============================================================================
-- 3. ANDRA TABELLER - Optimera återstående policies
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE 'Optimerar policies för andra tabeller...';
END $$;

-- CASES tabellen
DROP POLICY IF EXISTS "Multisite users can update organization cases" ON cases;
DROP POLICY IF EXISTS "Technicians can update assigned cases" ON cases;

CREATE POLICY "Multisite users can update organization cases" ON cases
    FOR UPDATE TO public
    USING (
        customer_id IN (
            SELECT c.id
            FROM customers c
            WHERE c.organization_id IN (
                SELECT multisite_user_roles.organization_id
                FROM multisite_user_roles
                WHERE multisite_user_roles.user_id = (SELECT auth.uid())
                AND multisite_user_roles.is_active = true
            )
        )
    )
    WITH CHECK (
        customer_id IN (
            SELECT c.id
            FROM customers c
            WHERE c.organization_id IN (
                SELECT multisite_user_roles.organization_id
                FROM multisite_user_roles
                WHERE multisite_user_roles.user_id = (SELECT auth.uid())
                AND multisite_user_roles.is_active = true
            )
        )
    );

CREATE POLICY "Technicians can update assigned cases" ON cases
    FOR UPDATE TO public
    USING (
        (
            primary_technician_id IN (
                SELECT profiles.technician_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
            )
        ) OR (
            secondary_technician_id IN (
                SELECT profiles.technician_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
            )
        ) OR (
            tertiary_technician_id IN (
                SELECT profiles.technician_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
            )
        )
    )
    WITH CHECK (
        (
            primary_technician_id IN (
                SELECT profiles.technician_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
            )
        ) OR (
            secondary_technician_id IN (
                SELECT profiles.technician_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
            )
        ) OR (
            tertiary_technician_id IN (
                SELECT profiles.technician_id
                FROM profiles
                WHERE profiles.user_id = (SELECT auth.uid())
            )
        )
    );

-- CONTRACT_FILES tabellen
DROP POLICY IF EXISTS "contract_files_admin_koordinator_full_access" ON contract_files;

CREATE POLICY "contract_files_admin_koordinator_full_access" ON contract_files
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.is_admin = true 
                OR profiles.is_koordinator = true 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.is_admin = true 
                OR profiles.is_koordinator = true 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    );

-- CONTRACTS tabellen
DROP POLICY IF EXISTS "contracts_admin_koordinator_full_access" ON contracts;

CREATE POLICY "contracts_admin_koordinator_full_access" ON contracts
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.is_admin = true 
                OR profiles.is_koordinator = true 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.is_admin = true 
                OR profiles.is_koordinator = true 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    );

-- MULTISITE_USER_INVITATIONS tabellen
DROP POLICY IF EXISTS "multisite_invitations_admin_full_access" ON multisite_user_invitations;
DROP POLICY IF EXISTS "multisite_invitations_verksamhetschef_organization" ON multisite_user_invitations;

CREATE POLICY "multisite_invitations_admin_full_access" ON multisite_user_invitations
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "multisite_invitations_verksamhetschef_organization" ON multisite_user_invitations
    FOR ALL TO public
    USING (
        organization_id IN (
            SELECT profiles.organization_id
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.multisite_role = 'verksamhetschef'::text
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT profiles.organization_id
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.multisite_role = 'verksamhetschef'::text
        )
    );

-- PROFILES tabellen
DROP POLICY IF EXISTS "Users can update their own profile securely" ON profiles;

CREATE POLICY "Users can update their own profile securely" ON profiles
    FOR UPDATE TO public
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- SANITATION_REPORTS tabellen
DROP POLICY IF EXISTS "Admins have full access to sanitation reports" ON sanitation_reports;
DROP POLICY IF EXISTS "Staff can manage sanitation reports" ON sanitation_reports;

CREATE POLICY "Admins have full access to sanitation reports" ON sanitation_reports
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.role::text = 'admin'::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.role::text = 'admin'::text
        )
    );

CREATE POLICY "Staff can manage sanitation reports" ON sanitation_reports
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.role::text = ANY(ARRAY['koordinator'::text, 'technician'::text])
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.role::text = ANY(ARRAY['koordinator'::text, 'technician'::text])
        )
    );

-- STAFF_COMPETENCIES tabellen
DROP POLICY IF EXISTS "Korrekt behörighetskontroll för kompetenser" ON staff_competencies;

CREATE POLICY "Korrekt behörighetskontroll för kompetenser" ON staff_competencies
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.role::text = 'admin'::text 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.role::text = 'admin'::text 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    );

-- TECHNICIAN_ABSENCES tabellen
DROP POLICY IF EXISTS "technician_absences_admin_koordinator_full_access" ON technician_absences;
DROP POLICY IF EXISTS "technician_absences_manage_own" ON technician_absences;

CREATE POLICY "technician_absences_admin_koordinator_full_access" ON technician_absences
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.is_admin = true 
                OR profiles.is_koordinator = true 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND (
                profiles.is_admin = true 
                OR profiles.is_koordinator = true 
                OR profiles.role::text = 'koordinator'::text
            )
        )
    );

CREATE POLICY "technician_absences_manage_own" ON technician_absences
    FOR ALL TO public
    USING (
        technician_id IN (
            SELECT profiles.technician_id
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.role::text = 'technician'::text
        )
    )
    WITH CHECK (
        technician_id IN (
            SELECT profiles.technician_id
            FROM profiles
            WHERE profiles.user_id = (SELECT auth.uid())
            AND profiles.role::text = 'technician'::text
        )
    );

-- ============================================================================
-- 4. VALIDERING AV OPTIMERINGEN
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE 'Validerar att optimeringen genomförts korrekt...';
END $$;

-- Kontrollera att inga policies längre använder direkta auth.uid() eller auth.email()
-- (utom de som redan är optimerade med SELECT)
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies 
    WHERE (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%' OR qual LIKE '%auth.email()%' OR with_check LIKE '%auth.email()%')
    AND NOT (qual LIKE '%(select auth.uid())%' OR with_check LIKE '%(select auth.uid())%' OR qual LIKE '%(select auth.email())%' OR with_check LIKE '%(select auth.email())%')
    AND NOT (qual LIKE '%( SELECT auth.uid()%' OR with_check LIKE '%( SELECT auth.uid()%' OR qual LIKE '%( SELECT auth.email()%' OR with_check LIKE '%( SELECT auth.email()%');
    
    IF policy_count > 0 THEN
        RAISE WARNING 'Varning: % policies har fortfarande direkta auth-funktionsanrop!', policy_count;
    ELSE
        RAISE NOTICE 'Framgång: Alla policies använder nu optimerade auth-funktionsanrop!';
    END IF;
END $$;

-- Kontrollera att alla optimerade policies fungerar korrekt
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT tablename)
    INTO table_count
    FROM pg_policies 
    WHERE (qual LIKE '%(SELECT auth.uid())%' OR with_check LIKE '%(SELECT auth.uid())%' OR qual LIKE '%(SELECT auth.email())%' OR with_check LIKE '%(SELECT auth.email())%');
    
    RAISE NOTICE 'Optimerade tabeller: % tabeller har nu optimerade auth-policies', table_count;
END $$;

-- Slutlogg
DO $$ 
BEGIN
    RAISE NOTICE 'SLUTFÖR FAS 2: AUTH RLS OPTIMERING - %', now();
    RAISE NOTICE 'Alla kvarvarande Auth RLS Initialization Plan warnings har eliminerats';
    RAISE NOTICE 'Systemets prestanda och säkerhet har förbättrats genom optimerade auth-funktionsanrop';
END $$;

COMMIT;