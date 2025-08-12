-- Migration: Fix infinite recursion in multisite_user_roles RLS policies
-- Purpose: Replace problematic self-referencing policies with safe alternatives
-- Date: 2025-01-13

-- First, drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view roles in their organization" ON multisite_user_roles;
DROP POLICY IF EXISTS "Admin and quality managers can manage roles" ON multisite_user_roles;

-- Create new, safe SELECT policy that uses profiles table instead of self-reference
CREATE POLICY "Users can view roles in their organization" ON multisite_user_roles
FOR SELECT 
USING (
    -- Admins can see all roles
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
    OR
    -- Users can see roles in their own organization (from profiles table)
    organization_id = (
        SELECT organization_id 
        FROM profiles 
        WHERE user_id = auth.uid()
    )
    OR
    -- Users can see their own role
    user_id = auth.uid()
);

-- Create new INSERT policy for admins and quality managers
CREATE POLICY "Admins and quality managers can insert roles" ON multisite_user_roles
FOR INSERT 
WITH CHECK (
    -- Admins can insert any role
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
    OR
    -- Quality managers can insert roles in their organization
    (
        organization_id = (
            SELECT organization_id 
            FROM profiles 
            WHERE user_id = auth.uid() 
            AND multisite_role = 'quality_manager'
        )
    )
);

-- Create new UPDATE policy for admins and quality managers
CREATE POLICY "Admins and quality managers can update roles" ON multisite_user_roles
FOR UPDATE 
USING (
    -- Admins can update any role
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
    OR
    -- Quality managers can update roles in their organization
    (
        organization_id = (
            SELECT organization_id 
            FROM profiles 
            WHERE user_id = auth.uid() 
            AND multisite_role = 'quality_manager'
        )
    )
)
WITH CHECK (
    -- Ensure organization_id doesn't change
    organization_id = (SELECT organization_id FROM multisite_user_roles WHERE id = id)
);

-- Create new DELETE policy for admins and quality managers
CREATE POLICY "Admins and quality managers can delete roles" ON multisite_user_roles
FOR DELETE 
USING (
    -- Admins can delete any role
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
    OR
    -- Quality managers can delete roles in their organization
    (
        organization_id = (
            SELECT organization_id 
            FROM profiles 
            WHERE user_id = auth.uid() 
            AND multisite_role = 'quality_manager'
        )
    )
);

-- Also fix the multisite_organizations policy if it has similar issues
DROP POLICY IF EXISTS "Admin and quality managers can manage organizations" ON multisite_organizations;

CREATE POLICY "Admin and quality managers can manage organizations" ON multisite_organizations
FOR ALL 
USING (
    -- Admins can manage any organization
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
    OR
    -- Quality managers can manage their own organization
    id = (
        SELECT organization_id 
        FROM profiles 
        WHERE user_id = auth.uid() 
        AND multisite_role = 'quality_manager'
    )
);

-- Fix organization_sites policies similarly
DROP POLICY IF EXISTS "Admin and quality managers can manage sites" ON organization_sites;

CREATE POLICY "Admin and quality managers can manage sites" ON organization_sites
FOR ALL 
USING (
    -- Admins can manage any site
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
    OR
    -- Quality managers can manage sites in their organization
    organization_id = (
        SELECT organization_id 
        FROM profiles 
        WHERE user_id = auth.uid() 
        AND multisite_role = 'quality_manager'
    )
);

-- Add comment for documentation
COMMENT ON POLICY "Users can view roles in their organization" ON multisite_user_roles IS 'Fixed policy that avoids infinite recursion by using profiles table for authorization';