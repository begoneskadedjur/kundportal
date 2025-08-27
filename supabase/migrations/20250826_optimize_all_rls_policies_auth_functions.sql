-- Migration: Optimize all RLS policies by replacing auth.uid() and auth.email() with subquery versions
-- This improves performance by allowing PostgreSQL to cache the authentication function calls
-- Created: 2025-08-26

BEGIN;

-- Create auth optimization wrapper functions for better performance
CREATE OR REPLACE FUNCTION auth_uid_optimized() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
AS $$ 
  SELECT auth.uid() 
$$;

CREATE OR REPLACE FUNCTION auth_email_optimized() 
RETURNS text 
LANGUAGE sql 
STABLE 
AS $$ 
  SELECT auth.email() 
$$;

-- ============================================================================
-- BILLING_AUDIT_LOG TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage audit logs" ON billing_audit_log;
CREATE POLICY "Admins can manage audit logs" ON billing_audit_log
FOR ALL 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true)
  )
);

-- ============================================================================
-- BUSINESS_CASES TABLE POLICIES  
-- ============================================================================

DROP POLICY IF EXISTS "commission_admin_only_business" ON business_cases;
CREATE POLICY "commission_admin_only_business" ON business_cases
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

-- ============================================================================
-- CASE_UPDATES_LOG TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage case updates" ON case_updates_log;
CREATE POLICY "Admins can manage case updates" ON case_updates_log
FOR ALL 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true)
  )
);

-- ============================================================================
-- CASES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Coordinators can manage all cases" ON cases;
CREATE POLICY "Coordinators can manage all cases" ON cases
FOR ALL 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['admin'::character varying, 'koordinator'::character varying]::text[])
  )
);

DROP POLICY IF EXISTS "Coordinators can view all cases" ON cases;
CREATE POLICY "Coordinators can view all cases" ON cases
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['admin'::character varying, 'koordinator'::character varying]::text[])
  )
);

DROP POLICY IF EXISTS "Customers can create their own cases" ON cases;
CREATE POLICY "Customers can create their own cases" ON cases
FOR INSERT 
TO public 
WITH CHECK (
  customer_id IN (
    SELECT profiles.customer_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  AND (status)::text = 'Öppen'::text
);

DROP POLICY IF EXISTS "Customers can view their own cases" ON cases;
CREATE POLICY "Customers can view their own cases" ON cases
FOR SELECT 
TO public 
USING (
  customer_id IN (
    SELECT profiles.customer_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Multisite users can create organization cases" ON cases;
CREATE POLICY "Multisite users can create organization cases" ON cases
FOR INSERT 
TO public 
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
  AND (status)::text = 'Öppen'::text
);

DROP POLICY IF EXISTS "Multisite users can update organization cases" ON cases;
CREATE POLICY "Multisite users can update organization cases" ON cases
FOR UPDATE 
TO public 
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

DROP POLICY IF EXISTS "Multisite users can view organization cases" ON cases;
CREATE POLICY "Multisite users can view organization cases" ON cases
FOR SELECT 
TO public 
USING (
  customer_id IN (
    SELECT c.id
    FROM customers c
    WHERE c.organization_id IN (
      SELECT mur.organization_id
      FROM multisite_user_roles mur
      WHERE mur.user_id = (SELECT auth.uid()) 
      AND mur.is_active = true
    )
  )
);

DROP POLICY IF EXISTS "Technicians can update assigned cases" ON cases;
CREATE POLICY "Technicians can update assigned cases" ON cases
FOR UPDATE 
TO public 
USING (
  primary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  OR secondary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  OR tertiary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  primary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  OR secondary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  OR tertiary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Technicians can view assigned cases" ON cases;
CREATE POLICY "Technicians can view assigned cases" ON cases
FOR SELECT 
TO public 
USING (
  primary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  OR secondary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  ) 
  OR tertiary_technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- CONTRACT_FILES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "contract_files_admin_koordinator_full_access" ON contract_files;
CREATE POLICY "contract_files_admin_koordinator_full_access" ON contract_files
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true OR (profiles.role)::text = 'koordinator'::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true OR (profiles.role)::text = 'koordinator'::text)
  )
);

DROP POLICY IF EXISTS "contract_files_customer_read_own" ON contract_files;
CREATE POLICY "contract_files_customer_read_own" ON contract_files
FOR SELECT 
TO authenticated 
USING (
  contract_id IN (
    SELECT contracts.id
    FROM contracts
    WHERE contracts.customer_id IN (
      SELECT profiles.customer_id
      FROM profiles
      WHERE profiles.user_id = (SELECT auth.uid()) 
      AND (profiles.role)::text = 'customer'::text
    )
  )
);

-- ============================================================================
-- CONTRACTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "contracts_admin_koordinator_full_access" ON contracts;
CREATE POLICY "contracts_admin_koordinator_full_access" ON contracts
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true OR (profiles.role)::text = 'koordinator'::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true OR (profiles.role)::text = 'koordinator'::text)
  )
);

DROP POLICY IF EXISTS "contracts_customer_read_own" ON contracts;
CREATE POLICY "contracts_customer_read_own" ON contracts
FOR SELECT 
TO authenticated 
USING (
  customer_id IN (
    SELECT profiles.customer_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'customer'::text
  )
);

DROP POLICY IF EXISTS "contracts_multisite_read_organization" ON contracts;
CREATE POLICY "contracts_multisite_read_organization" ON contracts
FOR SELECT 
TO authenticated 
USING (
  customer_id IN (
    SELECT c.id
    FROM customers c
    WHERE c.organization_id IN (
      SELECT mur.organization_id
      FROM multisite_user_roles mur
      WHERE mur.user_id = (SELECT auth.uid()) 
      AND mur.is_active = true
    )
  )
);

-- ============================================================================
-- CUSTOMERS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Multisite users can view their organization customers" ON customers;
CREATE POLICY "Multisite users can view their organization customers" ON customers
FOR SELECT 
TO public 
USING (
  organization_id IN (
    SELECT multisite_user_roles.organization_id
    FROM multisite_user_roles
    WHERE multisite_user_roles.user_id = (SELECT auth.uid()) 
    AND multisite_user_roles.is_active = true
  )
);

-- ============================================================================
-- MULTISITE_USER_INVITATIONS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "multisite_invitations_admin_full_access" ON multisite_user_invitations;
CREATE POLICY "multisite_invitations_admin_full_access" ON multisite_user_invitations
FOR ALL 
TO authenticated 
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

DROP POLICY IF EXISTS "multisite_invitations_read_own" ON multisite_user_invitations;
CREATE POLICY "multisite_invitations_read_own" ON multisite_user_invitations
FOR SELECT 
TO authenticated 
USING (
  email = (
    SELECT users.email
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
  )::text
);

DROP POLICY IF EXISTS "multisite_invitations_verksamhetschef_organization" ON multisite_user_invitations;
CREATE POLICY "multisite_invitations_verksamhetschef_organization" ON multisite_user_invitations
FOR ALL 
TO authenticated 
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

-- ============================================================================
-- MULTISITE_USER_ROLES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin and coordinators can manage user roles" ON multisite_user_roles;
CREATE POLICY "Admin and coordinators can manage user roles" ON multisite_user_roles
FOR ALL 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true)
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
    AND (profiles.is_admin = true OR profiles.is_koordinator = true)
  ) 
  OR organization_id = (
    SELECT profiles.organization_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.multisite_role = 'verksamhetschef'::text
  )
);

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
    AND profiles.multisite_role = 'verksamhetsansvarig'::text
  )
);

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
    AND profiles.multisite_role = 'verksamhetsansvarig'::text
  )
);

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
    AND profiles.multisite_role = 'verksamhetsansvarig'::text
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
    AND profiles.multisite_role = 'verksamhetsansvarig'::text
  )
);

DROP POLICY IF EXISTS "Staff can view all roles, customers view own organization" ON multisite_user_roles;
CREATE POLICY "Staff can view all roles, customers view own organization" ON multisite_user_roles
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (
      (profiles.role)::text = ANY (ARRAY['admin'::text, 'koordinator'::text, 'technician'::text]) 
      OR (profiles.organization_id IS NOT NULL AND profiles.organization_id = multisite_user_roles.organization_id)
    )
  )
);

-- ============================================================================
-- PRIVATE_CASES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "commission_admin_only_private" ON private_cases;
CREATE POLICY "commission_admin_only_private" ON private_cases
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

-- ============================================================================
-- PRODUCTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can delete products" ON products;
CREATE POLICY "Admins can delete products" ON products
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can insert products" ON products;
CREATE POLICY "Admins can insert products" ON products
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins can update products" ON products
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can view products" ON products;
CREATE POLICY "Admins can view products" ON products
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
FOR INSERT 
TO public 
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

DROP POLICY IF EXISTS "Users can update their own profile securely" ON profiles;
CREATE POLICY "Users can update their own profile securely" ON profiles
FOR UPDATE 
TO public 
USING (
  (SELECT auth.uid()) = user_id
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

-- ============================================================================
-- QUOTE_RECIPIENTS TABLE POLICIES (Already optimized, but ensuring consistency)
-- ============================================================================

DROP POLICY IF EXISTS "quote_recipients_admin_koordinator_optimized" ON quote_recipients;
CREATE POLICY "quote_recipients_admin_koordinator_optimized" ON quote_recipients
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = (SELECT auth.uid()) 
    AND (p.is_admin = true OR p.is_koordinator = true OR (p.role)::text = 'koordinator'::text)
  ) 
  AND is_active = true
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = (SELECT auth.uid()) 
    AND (p.is_admin = true OR p.is_koordinator = true OR (p.role)::text = 'koordinator'::text)
  )
);

DROP POLICY IF EXISTS "quote_recipients_email_notifications_optimized" ON quote_recipients;
CREATE POLICY "quote_recipients_email_notifications_optimized" ON quote_recipients
FOR SELECT 
TO authenticated 
USING (
  user_email = (SELECT auth.email()) 
  AND is_active = true
);

DROP POLICY IF EXISTS "quote_recipients_insert_optimized" ON quote_recipients;
CREATE POLICY "quote_recipients_insert_optimized" ON quote_recipients
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = (SELECT auth.uid()) 
    AND (p.is_admin = true OR p.is_koordinator = true OR (p.role)::text = ANY (ARRAY['koordinator'::character varying, 'technician'::character varying]::text[]))
  )
);

DROP POLICY IF EXISTS "quote_recipients_technician_optimized" ON quote_recipients;
CREATE POLICY "quote_recipients_technician_optimized" ON quote_recipients
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = (SELECT auth.uid()) 
    AND (p.role)::text = 'technician'::text
  ) 
  AND is_active = true
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = (SELECT auth.uid()) 
    AND (p.role)::text = 'technician'::text
  )
);

DROP POLICY IF EXISTS "quote_recipients_update_user_fields_optimized" ON quote_recipients;
CREATE POLICY "quote_recipients_update_user_fields_optimized" ON quote_recipients
FOR UPDATE 
TO authenticated 
USING (
  (user_email = (SELECT auth.email()) OR specific_user_id = (SELECT auth.uid())) 
  AND is_active = true
)
WITH CHECK (
  (user_email = (SELECT auth.email()) OR specific_user_id = (SELECT auth.uid())) 
  AND is_active = true
);

DROP POLICY IF EXISTS "quote_recipients_user_notifications_optimized" ON quote_recipients;
CREATE POLICY "quote_recipients_user_notifications_optimized" ON quote_recipients
FOR SELECT 
TO authenticated 
USING (
  specific_user_id = (SELECT auth.uid()) 
  AND is_active = true
);

-- ============================================================================
-- SANITATION_REPORTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins have full access to sanitation reports" ON sanitation_reports;
CREATE POLICY "Admins have full access to sanitation reports" ON sanitation_reports
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'admin'::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'admin'::text
  )
);

DROP POLICY IF EXISTS "Customers view own sanitation reports" ON sanitation_reports;
CREATE POLICY "Customers view own sanitation reports" ON sanitation_reports
FOR SELECT 
TO authenticated 
USING (
  customer_id IN (
    SELECT profiles.customer_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'customer'::text
  )
);

DROP POLICY IF EXISTS "Multisite users can view reports" ON sanitation_reports;
CREATE POLICY "Multisite users can view reports" ON sanitation_reports
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM multisite_user_roles mur
    JOIN customers c ON c.organization_id = mur.organization_id
    WHERE mur.user_id = (SELECT auth.uid()) 
    AND mur.is_active = true 
    AND c.id = sanitation_reports.customer_id 
    AND c.is_multisite = true 
    AND (
      mur.role_type = 'verksamhetschef'::text 
      OR (mur.role_type = 'regionchef'::text AND c.id = ANY (mur.site_ids)) 
      OR (mur.role_type = 'platsansvarig'::text AND c.id = ANY (mur.site_ids))
    )
  )
);

DROP POLICY IF EXISTS "Staff can manage sanitation reports" ON sanitation_reports;
CREATE POLICY "Staff can manage sanitation reports" ON sanitation_reports
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['koordinator'::character varying, 'technician'::character varying]::text[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['koordinator'::character varying, 'technician'::character varying]::text[])
  )
);

-- ============================================================================
-- STAFF_COMPETENCIES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Korrekt behörighetskontroll för kompetenser" ON staff_competencies;
CREATE POLICY "Korrekt behörighetskontroll för kompetenser" ON staff_competencies
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND ((profiles.role)::text = 'admin'::text OR (profiles.role)::text = 'koordinator'::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND ((profiles.role)::text = 'admin'::text OR (profiles.role)::text = 'koordinator'::text)
  )
);

-- ============================================================================
-- TECHNICIAN_ABSENCES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "technician_absences_admin_koordinator_full_access" ON technician_absences;
CREATE POLICY "technician_absences_admin_koordinator_full_access" ON technician_absences
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true OR (profiles.role)::text = 'koordinator'::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.is_admin = true OR profiles.is_koordinator = true OR (profiles.role)::text = 'koordinator'::text)
  )
);

DROP POLICY IF EXISTS "technician_absences_manage_own" ON technician_absences;
CREATE POLICY "technician_absences_manage_own" ON technician_absences
FOR ALL 
TO authenticated 
USING (
  technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'technician'::text
  )
)
WITH CHECK (
  technician_id IN (
    SELECT profiles.technician_id
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'technician'::text
  )
);

-- ============================================================================
-- USER_INVITATIONS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage invitations" ON user_invitations;
CREATE POLICY "Admins can manage invitations" ON user_invitations
FOR ALL 
TO public 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND profiles.is_admin = true
  )
);

DROP POLICY IF EXISTS "Users can view their own invitations" ON user_invitations;
CREATE POLICY "Users can view their own invitations" ON user_invitations
FOR SELECT 
TO public 
USING (
  (email)::text = (
    SELECT users.email
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
  )::text
);

-- ============================================================================
-- STORAGE OBJECTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can delete sanitation reports" ON storage.objects;
CREATE POLICY "Admins can delete sanitation reports" ON storage.objects
FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'sanitation-reports'::text 
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = 'admin'::text
  )
);

DROP POLICY IF EXISTS "Customers can view own sanitation reports" ON storage.objects;
CREATE POLICY "Customers can view own sanitation reports" ON storage.objects
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'sanitation-reports'::text 
  AND EXISTS (
    SELECT 1
    FROM sanitation_reports sr
    JOIN profiles p ON p.customer_id = sr.customer_id
    WHERE p.user_id = (SELECT auth.uid()) 
    AND (p.role)::text = 'customer'::text 
    AND sr.file_path = objects.name
  )
);

DROP POLICY IF EXISTS "Multisite users can view report files" ON storage.objects;
CREATE POLICY "Multisite users can view report files" ON storage.objects
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'sanitation-reports'::text 
  AND EXISTS (
    SELECT 1
    FROM sanitation_reports sr
    JOIN multisite_user_roles mur ON true
    JOIN customers c ON c.organization_id = mur.organization_id
    WHERE sr.file_path = objects.name 
    AND sr.customer_id = c.id 
    AND mur.user_id = (SELECT auth.uid()) 
    AND mur.is_active = true 
    AND c.is_multisite = true 
    AND (
      mur.role_type = 'verksamhetschef'::text 
      OR (mur.role_type = 'regionchef'::text AND c.region = mur.region) 
      OR (mur.role_type = 'platsansvarig'::text AND c.id = ANY (mur.site_ids))
    )
  )
);

DROP POLICY IF EXISTS "Staff can update sanitation reports" ON storage.objects;
CREATE POLICY "Staff can update sanitation reports" ON storage.objects
FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'sanitation-reports'::text 
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['admin'::character varying, 'koordinator'::character varying]::text[])
  )
);

DROP POLICY IF EXISTS "Staff can upload sanitation reports" ON storage.objects;
CREATE POLICY "Staff can upload sanitation reports" ON storage.objects
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'sanitation-reports'::text 
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['admin'::character varying, 'koordinator'::character varying, 'technician'::character varying]::text[])
  )
);

DROP POLICY IF EXISTS "Staff can view all sanitation reports" ON storage.objects;
CREATE POLICY "Staff can view all sanitation reports" ON storage.objects
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'sanitation-reports'::text 
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid()) 
    AND (profiles.role)::text = ANY (ARRAY['admin'::character varying, 'koordinator'::character varying, 'technician'::character varying]::text[])
  )
);

-- Add comments for documentation
COMMENT ON FUNCTION auth_uid_optimized() IS 'Optimized wrapper for auth.uid() to improve RLS policy performance through subquery caching';
COMMENT ON FUNCTION auth_email_optimized() IS 'Optimized wrapper for auth.email() to improve RLS policy performance through subquery caching';

COMMIT;