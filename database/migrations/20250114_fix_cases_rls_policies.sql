-- Migration: Fix RLS policies for cases table
-- Date: 2025-01-14
-- Purpose: Enable multisite users and customers to create cases with correct status

-- Ta bort felaktiga INSERT policies
DROP POLICY IF EXISTS "Customers can create cases" ON cases;
DROP POLICY IF EXISTS "Customers can create their own cases" ON cases;

-- Skapa ny korrekt INSERT policy för vanliga kunder
CREATE POLICY "Customers can create their own cases" 
ON cases FOR INSERT 
WITH CHECK (
  customer_id IN (
    SELECT customer_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
  AND status = 'Öppen'  -- Svenska status som vi använder
);

-- Skapa INSERT policy för multisite-användare
CREATE POLICY "Multisite users can create organization cases" 
ON cases FOR INSERT 
WITH CHECK (
  customer_id IN (
    SELECT c.id 
    FROM customers c
    WHERE c.organization_id IN (
      SELECT organization_id 
      FROM multisite_user_roles 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  )
  AND status = 'Öppen'  -- Svenska status
);

-- Lägg till UPDATE policy för multisite-användare
CREATE POLICY "Multisite users can update organization cases" 
ON cases FOR UPDATE 
USING (
  customer_id IN (
    SELECT c.id 
    FROM customers c
    WHERE c.organization_id IN (
      SELECT organization_id 
      FROM multisite_user_roles 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  )
)
WITH CHECK (
  customer_id IN (
    SELECT c.id 
    FROM customers c
    WHERE c.organization_id IN (
      SELECT organization_id 
      FROM multisite_user_roles 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  )
);