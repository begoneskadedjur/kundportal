-- Migration: Add billing_type column to customers table
-- Date: 2025-01-20
-- Purpose: Enable storage of billing type (consolidated/per_site) for multisite organizations

-- Add billing_type column with check constraint
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'consolidated'
CHECK (billing_type IN ('consolidated', 'per_site'));

-- Add column comment for documentation
COMMENT ON COLUMN public.customers.billing_type IS 'Faktureringstyp för multisite-organisationer: consolidated (konsoliderad) eller per_site (per anläggning)';

-- Set default value for existing multisite headquarters
UPDATE public.customers 
SET billing_type = 'consolidated'
WHERE is_multisite = true 
AND site_type = 'huvudkontor'
AND billing_type IS NULL;