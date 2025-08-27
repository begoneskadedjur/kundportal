-- Konsolidering av RLS policies för CASES tabellen
-- Mål: Reducera från 9 policies till 4 policies (≈56% minskning)
-- Eliminerar Multiple Permissive Policies varningar

BEGIN;

-- Steg 1: Ta bort alla befintliga fragmenterade policies (förutom service_role)
DROP POLICY IF EXISTS "Coordinators can view all cases" ON cases;
DROP POLICY IF EXISTS "Customers can view their own cases" ON cases;
DROP POLICY IF EXISTS "Multisite users can view organization cases" ON cases;
DROP POLICY IF EXISTS "Technicians can view assigned cases" ON cases;
DROP POLICY IF EXISTS "Customers can create their own cases" ON cases;
DROP POLICY IF EXISTS "Multisite users can create organization cases" ON cases;
DROP POLICY IF EXISTS "Technicians can update assigned cases" ON cases;
DROP POLICY IF EXISTS "Multisite users can update organization cases" ON cases;

-- Steg 2: Skapa 4 konsoliderade policies

-- Policy 1: Konsoliderad SELECT policy för alla användarroller
CREATE POLICY "cases_unified_select" ON cases
    FOR SELECT
    TO public
    USING (
        -- Admin och koordinator: Se alla cases
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
              AND profiles.role IN ('admin', 'koordinator')
        )
        OR
        -- Kunder: Se endast sina egna cases
        customer_id IN (
            SELECT profiles.customer_id 
            FROM profiles 
            WHERE profiles.user_id = auth.uid()
              AND profiles.customer_id IS NOT NULL
        )
        OR
        -- Multisite-användare: Se organisationens cases
        customer_id IN (
            SELECT c.id 
            FROM customers c
            WHERE c.organization_id IN (
                SELECT mur.organization_id 
                FROM multisite_user_roles mur
                WHERE mur.user_id = auth.uid() 
                  AND mur.is_active = true
            )
        )
        OR
        -- Tekniker: Se tilldelade cases (primary, secondary, tertiary)
        (
            primary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
            OR
            secondary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
            OR
            tertiary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
        )
    );

-- Policy 2: Konsoliderad INSERT policy för kunder och multisite-användare
CREATE POLICY "cases_unified_insert" ON cases
    FOR INSERT
    TO public
    WITH CHECK (
        (
            -- Kunder: Skapa sina egna cases (endast status 'Öppen')
            customer_id IN (
                SELECT profiles.customer_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.customer_id IS NOT NULL
            )
            AND status = 'Öppen'
        )
        OR
        (
            -- Multisite-användare: Skapa organisationens cases (endast status 'Öppen')
            customer_id IN (
                SELECT c.id 
                FROM customers c
                WHERE c.organization_id IN (
                    SELECT mur.organization_id 
                    FROM multisite_user_roles mur
                    WHERE mur.user_id = auth.uid() 
                      AND mur.is_active = true
                )
            )
            AND status = 'Öppen'
        )
    );

-- Policy 3: Konsoliderad UPDATE policy för tekniker och multisite-användare
CREATE POLICY "cases_unified_update" ON cases
    FOR UPDATE
    TO public
    USING (
        -- Tekniker: Uppdatera tilldelade cases
        (
            primary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
            OR
            secondary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
            OR
            tertiary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
        )
        OR
        -- Multisite-användare: Uppdatera organisationens cases
        customer_id IN (
            SELECT c.id 
            FROM customers c
            WHERE c.organization_id IN (
                SELECT mur.organization_id 
                FROM multisite_user_roles mur
                WHERE mur.user_id = auth.uid() 
                  AND mur.is_active = true
            )
        )
    )
    WITH CHECK (
        -- Samma kontroller för WITH CHECK
        (
            primary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
            OR
            secondary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
            OR
            tertiary_technician_id IN (
                SELECT profiles.technician_id 
                FROM profiles 
                WHERE profiles.user_id = auth.uid()
                  AND profiles.technician_id IS NOT NULL
            )
        )
        OR
        customer_id IN (
            SELECT c.id 
            FROM customers c
            WHERE c.organization_id IN (
                SELECT mur.organization_id 
                FROM multisite_user_roles mur
                WHERE mur.user_id = auth.uid() 
                  AND mur.is_active = true
            )
        )
    );

-- Steg 3: Verifiera att service_role policy fortfarande finns
-- (den ska behållas som den är för backend-access)

COMMIT;

-- Kommentar: Migration slutförd
-- Resultat: CASES tabellen har nu 4 policies istället för 9
-- - cases_service_role_all (behållen)
-- - cases_unified_select (ny konsoliderad)
-- - cases_unified_insert (ny konsoliderad) 
-- - cases_unified_update (ny konsoliderad)