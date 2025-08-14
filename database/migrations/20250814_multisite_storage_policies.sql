-- Migration: Add RLS policies for multisite users to access sanitation reports
-- Date: 2025-08-14
-- Purpose: Enable multisite users (verksamhetschef, regionchef, platsansvarig) to view and download sanitation reports

-- 1. Database RLS policy for viewing report metadata
CREATE POLICY IF NOT EXISTS "Multisite users can view reports" 
ON sanitation_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM multisite_user_roles mur
    INNER JOIN customers c ON c.organization_id = mur.organization_id
    WHERE mur.user_id = auth.uid()
      AND mur.is_active = true
      AND c.id = sanitation_reports.customer_id
      AND c.is_multisite = true
      AND (
        -- Verksamhetschef ser alla
        mur.role_type = 'verksamhetschef'
        -- Regionchef ser sin region
        OR (mur.role_type = 'regionchef' AND c.region = mur.region)
        -- Platsansvarig ser sina sites
        OR (mur.role_type = 'platsansvarig' AND c.id = ANY(mur.site_ids))
      )
  )
);

-- 2. Storage RLS policy for downloading PDF files
CREATE POLICY IF NOT EXISTS "Multisite users can view report files" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'sanitation-reports' 
  AND EXISTS (
    SELECT 1
    FROM sanitation_reports sr
    JOIN multisite_user_roles mur ON true
    JOIN customers c ON c.organization_id = mur.organization_id
    WHERE sr.file_path = objects.name
      AND sr.customer_id = c.id
      AND mur.user_id = auth.uid()
      AND mur.is_active = true
      AND c.is_multisite = true
      AND (
        -- Verksamhetschef ser alla filer i organisationen
        mur.role_type = 'verksamhetschef'
        -- Regionchef ser filer från sin region
        OR (mur.role_type = 'regionchef' AND c.region = mur.region)
        -- Platsansvarig ser filer från sina sites
        OR (mur.role_type = 'platsansvarig' AND c.id = ANY(mur.site_ids))
      )
  )
);

-- Note: These policies enable multisite users to:
-- 1. View sanitation report records in the database
-- 2. Download the actual PDF files from Storage
-- 3. Access is role-based according to their multisite permissions