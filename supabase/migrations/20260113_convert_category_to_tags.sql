-- Migration: Convert category to tags array
-- Version: 1.0
-- Date: 2026-01-13
-- Description: Converts single category column to tags array for multi-select support
--              and adds new tags: 'pr' and 'education'

-- ============================================
-- STEG 1: Lägg till ny tags-kolumn
-- ============================================
ALTER TABLE case_images
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY['general']::TEXT[];

-- ============================================
-- STEG 2: Migrera befintlig data från category till tags
-- ============================================
UPDATE case_images
SET tags = ARRAY[category]::TEXT[]
WHERE category IS NOT NULL AND (tags IS NULL OR tags = ARRAY['general']::TEXT[]);

-- ============================================
-- STEG 3: Ta bort gamla category-kolumnen
-- ============================================
-- Först ta bort constraint och index
DROP INDEX IF EXISTS idx_case_images_category;

-- Ta bort kolumnen (data är migrerad till tags)
ALTER TABLE case_images DROP COLUMN IF EXISTS category;

-- ============================================
-- STEG 4: Skapa nytt index för tags-sökning
-- ============================================
-- GIN index för effektiv array-sökning
CREATE INDEX IF NOT EXISTS idx_case_images_tags ON case_images USING GIN (tags);

-- ============================================
-- STEG 5: Lägg till check constraint för tillåtna tags
-- ============================================
-- Kontrollerar att alla taggar i arrayen är giltiga
ALTER TABLE case_images
ADD CONSTRAINT valid_tags CHECK (
  tags <@ ARRAY['before', 'after', 'general', 'pr', 'education']::TEXT[]
);

-- ============================================
-- STEG 6: Säkerställ att tags aldrig är tomt
-- ============================================
ALTER TABLE case_images
ADD CONSTRAINT tags_not_empty CHECK (
  array_length(tags, 1) > 0
);

-- ============================================
-- VERIFIERING (valfritt, kör separat)
-- ============================================
-- SELECT id, tags FROM case_images LIMIT 10;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'case_images';
-- \d case_images
