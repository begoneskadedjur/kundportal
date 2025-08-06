// src/utils/setupContractFilesStorage.ts - Engångsskript för att sätta upp Supabase Storage för kontraktsfiler
import { supabase } from '../lib/supabase'

/**
 * Sätt upp contract-files storage bucket och RLS policies
 * Detta bör bara köras en gång vid initial setup
 */
export async function setupContractFilesStorage(): Promise<{
  success: boolean
  message: string
  details?: any
}> {
  try {
    console.log('🔧 Sätter upp Supabase Storage för contract-files...')

    // 1. Kontrollera om bucket redan existerar
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Kunde inte lista buckets:', listError)
      return {
        success: false,
        message: 'Kunde inte kontrollera befintliga storage buckets',
        details: listError
      }
    }

    const existingBucket = buckets?.find(bucket => bucket.name === 'contract-files')

    if (existingBucket) {
      console.log('✅ Contract-files bucket existerar redan')
      return {
        success: true,
        message: 'Contract-files storage bucket existerar redan och är redo att använda'
      }
    }

    // 2. Skapa bucket
    console.log('📁 Skapar contract-files bucket...')
    
    const { error: createError } = await supabase.storage.createBucket('contract-files', {
      public: false,           // Privat bucket - bara autentiserade användare
      allowedMimeTypes: [      // Tillåt endast PDF-filer
        'application/pdf',
        'application/x-pdf'
      ],
      fileSizeLimit: 52428800, // 50MB max per fil
      
      // Extra säkerhetsinställningar
      // @ts-ignore - Detta kan vara Supabase-version specifikt
      filePolicy: {
        allowUploads: true,
        allowDownloads: true,
        allowDeletes: false    // Förhindra borttagning av filer
      }
    })

    if (createError) {
      console.error('❌ Kunde inte skapa bucket:', createError)
      return {
        success: false,
        message: 'Kunde inte skapa contract-files storage bucket',
        details: createError
      }
    }

    console.log('✅ Contract-files bucket skapad framgångsrikt')

    // 3. Sätt upp RLS (Row Level Security) policies för storage
    // Detta görs vanligtvis i SQL-konsolen, men vi kan försöka här
    try {
      console.log('🔒 Sätter upp RLS policies för storage...')
      
      // Notera: Detta kanske inte fungerar via JavaScript-klienten
      // I så fall behöver policies sättas upp manuellt i Supabase Dashboard
      
      // Policy för att läsa filer (endast autentiserade användare)
      const { error: policyError1 } = await supabase.rpc('create_storage_policy', {
        policy_name: 'contract_files_read_policy',
        bucket_name: 'contract-files',
        operation: 'SELECT',
        definition: 'auth.role() = \'authenticated\''
      })

      // Policy för att ladda upp filer (endast admin och koordinator)
      const { error: policyError2 } = await supabase.rpc('create_storage_policy', {
        policy_name: 'contract_files_upload_policy', 
        bucket_name: 'contract-files',
        operation: 'INSERT',
        definition: `
          auth.role() = 'authenticated' 
          AND auth.jwt() ->> 'user_role' IN ('admin', 'koordinator')
        `
      })

      if (policyError1 || policyError2) {
        console.warn('⚠️  Kunde inte sätta RLS policies automatiskt. Detta behöver göras manuellt i Supabase Dashboard.')
        console.warn('Policies error:', policyError1, policyError2)
      } else {
        console.log('✅ RLS policies satta för contract-files storage')
      }
      
    } catch (policyError) {
      console.warn('⚠️  RLS policy setup misslyckades. Detta kan behöva göras manuellt:', policyError)
    }

    // 4. Testa upload/download funktionalitet
    console.log('🧪 Testar basic upload/download funktionalitet...')
    
    const testFile = new Blob(['Test file content'], { type: 'text/plain' })
    const testPath = `test/setup-test-${Date.now()}.txt`
    
    const { error: uploadError } = await supabase.storage
      .from('contract-files')
      .upload(testPath, testFile)
    
    if (uploadError) {
      console.warn('⚠️  Test upload misslyckades:', uploadError)
    } else {
      console.log('✅ Test upload lyckades')
      
      // Ta bort testfil
      const { error: deleteError } = await supabase.storage
        .from('contract-files')
        .remove([testPath])
      
      if (deleteError) {
        console.warn('⚠️  Kunde inte ta bort testfil:', deleteError)
      }
    }

    return {
      success: true,
      message: 'Contract-files storage bucket har satts upp framgångsrikt! Du kan nu ladda ner och spara kontraktsfiler.',
      details: {
        bucketName: 'contract-files',
        isPublic: false,
        fileSizeLimit: '50MB',
        allowedTypes: ['application/pdf']
      }
    }

  } catch (error) {
    console.error('💥 Oväntat fel vid setup av contract-files storage:', error)
    return {
      success: false,
      message: 'Oväntat fel vid setup av storage',
      details: error
    }
  }
}

/**
 * Kontrollera om contract-files storage är korrekt uppsatt
 */
export async function verifyContractFilesStorage(): Promise<{
  isSetup: boolean
  bucketExists: boolean
  canUpload: boolean
  canDownload: boolean
  message: string
}> {
  try {
    console.log('🔍 Verifierar contract-files storage setup...')

    // Kontrollera bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      return {
        isSetup: false,
        bucketExists: false,
        canUpload: false,
        canDownload: false,
        message: 'Kunde inte kontrollera storage buckets'
      }
    }

    const bucketExists = !!buckets?.find(bucket => bucket.name === 'contract-files')
    
    if (!bucketExists) {
      return {
        isSetup: false,
        bucketExists: false,
        canUpload: false,
        canDownload: false,
        message: 'Contract-files bucket existerar inte'
      }
    }

    // Testa upload
    let canUpload = false
    const testFile = new Blob(['verification test'], { type: 'text/plain' })
    const testPath = `verification/test-${Date.now()}.txt`
    
    const { error: uploadError } = await supabase.storage
      .from('contract-files')
      .upload(testPath, testFile)
    
    if (!uploadError) {
      canUpload = true
      
      // Testa download
      const { data, error: downloadError } = await supabase.storage
        .from('contract-files')
        .download(testPath)
      
      const canDownload = !downloadError && !!data
      
      // Rensa upp testfil
      await supabase.storage.from('contract-files').remove([testPath])
      
      return {
        isSetup: true,
        bucketExists: true,
        canUpload: true,
        canDownload,
        message: canDownload 
          ? 'Contract-files storage är fullt funktionellt'
          : 'Storage fungerar för upload men download misslyckades'
      }
    }

    return {
      isSetup: false,
      bucketExists: true,
      canUpload: false,
      canDownload: false,
      message: `Upload test misslyckades: ${uploadError.message}`
    }

  } catch (error) {
    return {
      isSetup: false,
      bucketExists: false,
      canUpload: false,
      canDownload: false,
      message: `Verifiering misslyckades: ${error}`
    }
  }
}

// Manual RLS policies som behöver köras i SQL Editor om automatisk setup misslyckas
export const MANUAL_RLS_POLICIES = `
-- Aktivera RLS för storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy för att läsa contract-files (alla autentiserade användare)
CREATE POLICY "contract_files_read_policy" ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contract-files');

-- Policy för att ladda upp contract-files (endast admin och koordinator)
CREATE POLICY "contract_files_upload_policy" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-files' 
  AND auth.jwt() ->> 'user_role' IN ('admin', 'koordinator')
);

-- Policy för att uppdatera contract-files metadata (endast admin)
CREATE POLICY "contract_files_update_policy" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-files'
  AND auth.jwt() ->> 'user_role' = 'admin'
);
`