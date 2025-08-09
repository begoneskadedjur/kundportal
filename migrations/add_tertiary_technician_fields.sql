-- Migration: Add tertiary technician and additional fields to cases table
-- Run this in your Supabase SQL editor

-- Add tertiary technician fields
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS tertiary_technician_id UUID REFERENCES technicians(id),
ADD COLUMN IF NOT EXISTS tertiary_technician_name TEXT,
ADD COLUMN IF NOT EXISTS tertiary_technician_email TEXT;

-- Add alternative contact person fields
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS alternative_contact_person TEXT,
ADD COLUMN IF NOT EXISTS alternative_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS alternative_contact_email TEXT;

-- Add recommendations field for customer portal
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS recommendations TEXT;

-- Add work report field if it doesn't exist
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS work_report TEXT;

-- Add materials used field
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS materials_used TEXT;

-- Update RLS policies to allow customer to view work_report and recommendations
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Customers can view their own cases" ON cases;

-- Recreate policy with access to all relevant fields
CREATE POLICY "Customers can view their own cases" ON cases
FOR SELECT
USING (
  customer_id IN (
    SELECT customer_id FROM profiles WHERE id = auth.uid()
  )
);

-- Ensure coordinators and technicians can update all fields
DROP POLICY IF EXISTS "Coordinators can manage all cases" ON cases;

CREATE POLICY "Coordinators can manage all cases" ON cases
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'koordinator')
  )
);

DROP POLICY IF EXISTS "Technicians can update assigned cases" ON cases;

CREATE POLICY "Technicians can update assigned cases" ON cases
FOR UPDATE
USING (
  primary_technician_id IN (
    SELECT technician_id FROM profiles WHERE id = auth.uid()
  )
  OR
  secondary_technician_id IN (
    SELECT technician_id FROM profiles WHERE id = auth.uid()
  )
  OR
  tertiary_technician_id IN (
    SELECT technician_id FROM profiles WHERE id = auth.uid()
  )
);

-- Create index for faster queries on tertiary technician
CREATE INDEX IF NOT EXISTS idx_cases_tertiary_technician_id ON cases(tertiary_technician_id);

-- Add comments for documentation
COMMENT ON COLUMN cases.tertiary_technician_id IS 'Third technician assigned to the case';
COMMENT ON COLUMN cases.tertiary_technician_name IS 'Name of the third technician';
COMMENT ON COLUMN cases.tertiary_technician_email IS 'Email of the third technician';
COMMENT ON COLUMN cases.alternative_contact_person IS 'Alternative contact person for this specific case';
COMMENT ON COLUMN cases.alternative_contact_phone IS 'Phone number of alternative contact person';
COMMENT ON COLUMN cases.alternative_contact_email IS 'Email of alternative contact person';
COMMENT ON COLUMN cases.recommendations IS 'Recommendations for the customer after service completion';
COMMENT ON COLUMN cases.work_report IS 'Detailed report of work performed';
COMMENT ON COLUMN cases.materials_used IS 'List of materials used during the service';