/**
 * Setup-skript för case_images storage bucket och databastabell
 *
 * KÖR DETTA SQL I SUPABASE SQL EDITOR:
 *
 * -- 1. Skapa storage bucket för ärendebilder
 * INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 * VALUES (
 *   'case-images',
 *   'case-images',
 *   false,
 *   10485760, -- 10MB max filstorlek
 *   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
 * );
 *
 * -- 2. Skapa case_images tabell
 * CREATE TABLE IF NOT EXISTS case_images (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   case_id TEXT NOT NULL,
 *   case_type TEXT NOT NULL CHECK (case_type IN ('private', 'business', 'contract')),
 *   file_path TEXT NOT NULL,
 *   file_name TEXT NOT NULL,
 *   file_size INTEGER,
 *   mime_type TEXT,
 *   category TEXT NOT NULL CHECK (category IN ('before', 'after', 'general')) DEFAULT 'general',
 *   description TEXT,
 *   uploaded_by UUID REFERENCES auth.users(id),
 *   uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   UNIQUE(case_id, case_type, file_path)
 * );
 *
 * -- 3. Skapa index för snabb sökning
 * CREATE INDEX IF NOT EXISTS idx_case_images_case ON case_images(case_id, case_type);
 * CREATE INDEX IF NOT EXISTS idx_case_images_category ON case_images(category);
 * CREATE INDEX IF NOT EXISTS idx_case_images_uploaded_at ON case_images(uploaded_at DESC);
 *
 * -- 4. Aktivera RLS
 * ALTER TABLE case_images ENABLE ROW LEVEL SECURITY;
 *
 * -- 5. RLS Policies för case_images tabell
 *
 * -- Alla autentiserade användare kan se bilder
 * CREATE POLICY "Users can view case images"
 * ON case_images FOR SELECT
 * USING (auth.role() = 'authenticated');
 *
 * -- Admin, Koordinator och Tekniker kan lägga till bilder
 * CREATE POLICY "Staff can insert images"
 * ON case_images FOR INSERT
 * WITH CHECK (
 *   EXISTS (
 *     SELECT 1 FROM profiles
 *     WHERE id = auth.uid()
 *     AND role IN ('admin', 'koordinator', 'technician')
 *   )
 * );
 *
 * -- Admin, Koordinator och Tekniker kan ta bort bilder
 * CREATE POLICY "Staff can delete images"
 * ON case_images FOR DELETE
 * USING (
 *   EXISTS (
 *     SELECT 1 FROM profiles
 *     WHERE id = auth.uid()
 *     AND role IN ('admin', 'koordinator', 'technician')
 *   )
 * );
 *
 * -- 6. Storage policies för case-images bucket
 *
 * -- Alla autentiserade användare kan läsa bilder
 * CREATE POLICY "Authenticated users can view case images"
 * ON storage.objects FOR SELECT
 * USING (
 *   bucket_id = 'case-images'
 *   AND auth.role() = 'authenticated'
 * );
 *
 * -- Staff kan ladda upp bilder
 * CREATE POLICY "Staff can upload case images"
 * ON storage.objects FOR INSERT
 * WITH CHECK (
 *   bucket_id = 'case-images'
 *   AND EXISTS (
 *     SELECT 1 FROM profiles
 *     WHERE id = auth.uid()
 *     AND role IN ('admin', 'koordinator', 'technician')
 *   )
 * );
 *
 * -- Staff kan ta bort bilder
 * CREATE POLICY "Staff can delete case images"
 * ON storage.objects FOR DELETE
 * USING (
 *   bucket_id = 'case-images'
 *   AND EXISTS (
 *     SELECT 1 FROM profiles
 *     WHERE id = auth.uid()
 *     AND role IN ('admin', 'koordinator', 'technician')
 *   )
 * );
 */

// Konstanter för storage-konfiguration
export const CASE_IMAGES_BUCKET = 'case-images'
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
export const MAX_IMAGE_DIMENSION = 1920 // Max bredd/höjd för komprimering

// Hjälpfunktion för att generera unik filsökväg
export const generateImagePath = (
  caseId: string,
  caseType: 'private' | 'business' | 'contract',
  fileName: string
): string => {
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${caseType}/${caseId}/${timestamp}_${sanitizedFileName}`
}

// Hjälpfunktion för att validera filtyp
export const isValidImageType = (mimeType: string): boolean => {
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

// Hjälpfunktion för att validera filstorlek
export const isValidImageSize = (size: number): boolean => {
  return size <= MAX_IMAGE_SIZE
}
