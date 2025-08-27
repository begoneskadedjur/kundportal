-- Migration: Fix critical multisite role names - verksamhetsansvarig -> verksamhetschef
-- This fixes incorrect role names in RLS policies that would break multisite functionality
-- Created: 2025-08-26

BEGIN;

-- Log the start of this critical migration
DO $$
BEGIN
  RAISE NOTICE 'Starting critical multisite role name fix migration...';
  RAISE NOTICE 'Fixing verksamhetsansvarig -> verksamhetschef in RLS policies';
END
$$;

-- ============================================================================
-- MULTISITE_USER_ROLES TABLE POLICIES - CRITICAL FIXES
-- ============================================================================

-- Fix DELETE policy for multisite_user_roles
DROP POLICY IF EXISTS "Admins and quality managers can delete roles" ON multisite_user_roles;
CREATE POLICY "Admins and quality managers can delete roles" ON multisite_user_roles
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  ) 
  OR organization_id = (
    SELECT profiles.organization_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.multisite_role = 'verksamhetschef'::text
  )
);

-- Fix INSERT policy for multisite_user_roles
DROP POLICY IF EXISTS "Admins and quality managers can insert roles" ON multisite_user_roles;
CREATE POLICY "Admins and quality managers can insert roles" ON multisite_user_roles
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  ) 
  OR organization_id = (
    SELECT profiles.organization_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.multisite_role = 'verksamhetschef'::text
  )
);

-- Fix UPDATE policy for multisite_user_roles
DROP POLICY IF EXISTS "Admins and quality managers can update roles" ON multisite_user_roles;
CREATE POLICY "Admins and quality managers can update roles" ON multisite_user_roles
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  ) 
  OR organization_id = (
    SELECT profiles.organization_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.multisite_role = 'verksamhetschef'::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  ) 
  OR organization_id = (
    SELECT profiles.organization_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.multisite_role = 'verksamhetschef'::text
  )
);

-- ============================================================================
-- VALIDATION - Verify that policies have been created correctly
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Check that all three policies were created successfully
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'multisite_user_roles'
      AND policyname IN (
        'Admins and quality managers can delete roles',
        'Admins and quality managers can insert roles', 
        'Admins and quality managers can update roles'
      )
      AND (qual ILIKE '%verksamhetschef%' OR with_check ILIKE '%verksamhetschef%');
    
    IF policy_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All 3 multisite_user_roles policies created with correct role name "verksamhetschef"';
    ELSE
        RAISE EXCEPTION 'VALIDATION FAILED: Expected 3 policies with verksamhetschef, found %', policy_count;
    END IF;
    
    -- Verify no policies still reference the incorrect role name
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'multisite_user_roles'
      AND (qual ILIKE '%verksamhetsansvarig%' OR with_check ILIKE '%verksamhetsansvarig%');
      
    IF policy_count = 0 THEN
        RAISE NOTICE 'SUCCESS: No policies reference incorrect role name "verksamhetsansvarig"';
    ELSE
        RAISE EXCEPTION 'VALIDATION FAILED: Found % policies still referencing verksamhetsansvarig', policy_count;
    END IF;
END
$$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Critical multisite role name fix completed successfully!';
  RAISE NOTICE 'Multisite role hierarchy is now correct:';
  RAISE NOTICE '  - verksamhetschef (company manager)';
  RAISE NOTICE '  - regionchef (regional manager)';
  RAISE NOTICE '  - platsansvarig (site manager)';
END
$$;

COMMIT;