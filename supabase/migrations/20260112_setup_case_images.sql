-- Migration: Setup case_images storage and table
-- Version: 1.0
-- Date: 2026-01-12
-- Description: Creates storage bucket and table for case images

-- ============================================
-- STEG 1: Skapa storage bucket för ärendebilder
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-images',
  'case-images',
  false,
  10485760, -- 10MB max filstorlek
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEG 2: Skapa case_images tabell
-- ============================================
CREATE TABLE IF NOT EXISTS case_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  case_type TEXT NOT NULL CHECK (case_type IN ('private', 'business', 'contract')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  category TEXT NOT NULL CHECK (category IN ('before', 'after', 'general')) DEFAULT 'general',
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(case_id, case_type, file_path)
);

-- ============================================
-- STEG 3: Skapa index för snabb sökning
-- ============================================
CREATE INDEX IF NOT EXISTS idx_case_images_case ON case_images(case_id, case_type);
CREATE INDEX IF NOT EXISTS idx_case_images_category ON case_images(category);
CREATE INDEX IF NOT EXISTS idx_case_images_uploaded_at ON case_images(uploaded_at DESC);

-- ============================================
-- STEG 4: Aktivera RLS
-- ============================================
ALTER TABLE case_images ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEG 5: RLS Policies för case_images tabell
-- ============================================

-- Policy: Alla autentiserade användare kan se bilder
DROP POLICY IF EXISTS "Users can view case images" ON case_images;
CREATE POLICY "Users can view case images"
ON case_images FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Admin, Koordinator och Tekniker kan lägga till bilder
DROP POLICY IF EXISTS "Staff can insert images" ON case_images;
CREATE POLICY "Staff can insert images"
ON case_images FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'koordinator', 'technician')
  )
);

-- Policy: Admin, Koordinator och Tekniker kan uppdatera bilder
DROP POLICY IF EXISTS "Staff can update images" ON case_images;
CREATE POLICY "Staff can update images"
ON case_images FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'koordinator', 'technician')
  )
);

-- Policy: Admin, Koordinator och Tekniker kan ta bort bilder
DROP POLICY IF EXISTS "Staff can delete images" ON case_images;
CREATE POLICY "Staff can delete images"
ON case_images FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'koordinator', 'technician')
  )
);

-- ============================================
-- STEG 6: Storage policies för case-images bucket
-- ============================================

-- Policy: Alla autentiserade användare kan läsa bilder från case-images bucket
DROP POLICY IF EXISTS "Authenticated users can view case images" ON storage.objects;
CREATE POLICY "Authenticated users can view case images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'case-images'
  AND auth.role() = 'authenticated'
);

-- Policy: Staff kan ladda upp bilder till case-images bucket
DROP POLICY IF EXISTS "Staff can upload case images" ON storage.objects;
CREATE POLICY "Staff can upload case images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'case-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'koordinator', 'technician')
  )
);

-- Policy: Staff kan uppdatera bilder i case-images bucket
DROP POLICY IF EXISTS "Staff can update case images" ON storage.objects;
CREATE POLICY "Staff can update case images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'case-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'koordinator', 'technician')
  )
);

-- Policy: Staff kan ta bort bilder från case-images bucket
DROP POLICY IF EXISTS "Staff can delete case images" ON storage.objects;
CREATE POLICY "Staff can delete case images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'case-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'koordinator', 'technician')
  )
);

-- ============================================
-- VERIFIERING (valfritt, kör separat)
-- ============================================
-- SELECT * FROM storage.buckets WHERE id = 'case-images';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'case_images';
-- SELECT policyname FROM pg_policies WHERE tablename = 'case_images';
