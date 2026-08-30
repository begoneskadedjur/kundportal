// api/oneflow/download-file.ts - Ladda ner fil från OneFlow och spara till Supabase Storage
import { logMissingAuth } from '../_lib/auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = 'info@begone.se' // Centraliserad avsändare

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Interface för download request
interface DownloadRequest {
  contractId: string
  fileId: string
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Ladda ner fil från OneFlow
const downloadFromOneFlow = async (oneflowContractId: string, oneflowFileId: number): Promise<Buffer | null> => {
  try {
    console.log('📥 Laddar ner fil från OneFlow:', oneflowContractId, oneflowFileId)

    const response = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${oneflowFileId}?download=true`,
      {
        method: 'GET',
        headers: {
          'x-oneflow-api-token': ONEFLOW_API_TOKEN,
          'x-oneflow-user-email': 'info@begone.se'
        },
        redirect: 'follow' // Följ redirects automatiskt
      }
    )

    if (!response.ok) {
      console.error('❌ OneFlow Download API-fel:', response.status, response.statusText)
      return null
    }

    // Kontrollera content type
    const contentType = response.headers.get('content-type')
    console.log('📄 Content type:', contentType)

    // Hämta fil som buffer
    const fileBuffer = await response.buffer()
    console.log('✅ Fil nedladdad från OneFlow, storlek:', fileBuffer.length, 'bytes')
    
    return fileBuffer

  } catch (error) {
    console.error('💥 Fel vid nedladdning från OneFlow:', error)
    return null
  }
}

// Säkerställ att storage bucket existerar
const ensureStorageBucket = async (): Promise<void> => {
  try {
    // Lista buckets för att se om contract-files existerar
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Kunde inte lista storage buckets:', listError)
      return
    }

    const contractFilesBucket = buckets?.find(bucket => bucket.name === 'contract-files')

    if (!contractFilesBucket) {
      console.log('📁 Skapar contract-files bucket...')
      
      const { error: createError } = await supabase.storage.createBucket('contract-files', {
        public: false, // Private bucket
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 52428800 // 50MB limit
      })

      if (createError) {
        console.error('❌ Kunde inte skapa bucket:', createError)
        return
      }

      console.log('✅ Contract-files bucket skapad')
    }

  } catch (error) {
    console.error('💥 Fel vid kontroll av storage bucket:', error)
  }
}

// Spara fil till Supabase Storage
const saveToStorage = async (fileBuffer: Buffer, storagePath: string): Promise<string | null> => {
  try {
    console.log('💾 Sparar fil till Supabase Storage:', storagePath)

    // Säkerställ att bucket existerar
    await ensureStorageBucket()

    // Ladda upp filen
    const { data, error } = await supabase.storage
      .from('contract-files')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true // Skriv över om filen redan existerar
      })

    if (error) {
      console.error('❌ Fel vid uppladdning till storage:', error)
      return null
    }

    console.log('✅ Fil sparad till storage:', data.path)
    return data.path

  } catch (error) {
    console.error('💥 Fel vid sparande till storage:', error)
    return null
  }
}

// Uppdatera fil-status i databas
const updateFileStatus = async (
  fileId: string, 
  status: 'downloading' | 'completed' | 'failed',
  storagePath?: string,
  fileSize?: number
): Promise<void> => {
  try {
    const updates: any = {
      download_status: status,
      updated_at: new Date().toISOString()
    }

    if (status === 'completed') {
      updates.downloaded_at = new Date().toISOString()
      if (storagePath) {
        updates.supabase_storage_path = storagePath
      }
      if (fileSize) {
        updates.file_size = fileSize
      }
    }

    const { error } = await supabase
      .from('contract_files')
      .update(updates)
      .eq('id', fileId)

    if (error) {
      console.error('❌ Fel vid uppdatering av fil-status:', error)
    } else {
      console.log('✅ Fil-status uppdaterad:', status)
    }

  } catch (error) {
    console.error('💥 Fel vid uppdatering av fil-status:', error)
  }
}

// Generera säker storage path
const generateStoragePath = (contractId: string, fileName: string, fileId: string): string => {
  // Skapa säker filnamn
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  return `contracts/${contractId}/${timestamp}_${fileId}_${safeFileName}`
}

// Huvudfunktion
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  logMissingAuth(req, 'oneflow/download-file')
  setCorsHeaders(res)

  // Hantera OPTIONS request för CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera endast POST
  if (req.method !== 'POST') {
    console.error('❌ Icke-POST request mottaget:', req.method)
    return res.status(405).json({ 
      success: false,
      error: 'Endast POST-anrop tillåtna' 
    })
  }

  try {
    // Parsa request body
    const { contractId, fileId }: DownloadRequest = req.body

    if (!contractId || !fileId) {
      return res.status(400).json({
        success: false,
        error: 'contractId och fileId krävs'
      })
    }

    console.log('📥 Download file API anrop för fil:', fileId, 'i kontrakt:', contractId)

    // 1. Hämta fil-metadata från vår databas
    const { data: contractFile, error: fileError } = await supabase
      .from('contract_files')
      .select(`
        *,
        contracts!inner(oneflow_contract_id)
      `)
      .eq('id', fileId)
      .single()

    if (fileError || !contractFile) {
      console.error('❌ Contract file hittades inte:', fileError)
      return res.status(404).json({
        success: false,
        error: 'Fil hittades inte'
      })
    }

    // Kontrollera om filen redan är nedladdad
    if (contractFile.download_status === 'completed' && contractFile.supabase_storage_path) {
      console.log('✅ Fil redan nedladdad, returnerar befintlig path')
      
      // Skapa nedladdningslänk
      const { data: urlData, error: urlError } = await supabase.storage
        .from('contract-files')
        .createSignedUrl(contractFile.supabase_storage_path, 3600) // 1 hour expiry

      if (urlError) {
        console.error('❌ Fel vid skapande av nedladdningslänk:', urlError)
        return res.status(500).json({
          success: false,
          error: 'Kunde inte skapa nedladdningslänk'
        })
      }

      return res.status(200).json({
        success: true,
        data: {
          fileId: contractFile.id,
          fileName: contractFile.file_name,
          downloadUrl: urlData.signedUrl,
          status: 'completed'
        }
      })
    }

    // 2. Uppdatera status till 'downloading'
    await updateFileStatus(fileId, 'downloading')

    // 3. Ladda ner fil från OneFlow
    const fileBuffer = await downloadFromOneFlow(
      (contractFile.contracts as any).oneflow_contract_id,
      contractFile.oneflow_file_id
    )

    if (!fileBuffer) {
      await updateFileStatus(fileId, 'failed')
      return res.status(500).json({
        success: false,
        error: 'Kunde inte ladda ner fil från OneFlow'
      })
    }

    // 4. Spara til Supabase Storage
    const storagePath = generateStoragePath(contractId, contractFile.file_name, fileId)
    const savedPath = await saveToStorage(fileBuffer, storagePath)

    if (!savedPath) {
      await updateFileStatus(fileId, 'failed')
      return res.status(500).json({
        success: false,
        error: 'Kunde inte spara fil till storage'
      })
    }

    // 5. Uppdatera status till 'completed'
    await updateFileStatus(fileId, 'completed', savedPath, fileBuffer.length)

    // 6. Skapa nedladdningslänk
    const { data: urlData, error: urlError } = await supabase.storage
      .from('contract-files')
      .createSignedUrl(savedPath, 3600) // 1 hour expiry

    if (urlError) {
      console.error('❌ Fel vid skapande av nedladdningslänk:', urlError)
      return res.status(500).json({
        success: false,
        error: 'Fil sparad men kunde inte skapa nedladdningslänk'
      })
    }

    console.log('✅ Fil nedladdad och sparad framgångsrikt')
    
    return res.status(200).json({
      success: true,
      data: {
        fileId: contractFile.id,
        fileName: contractFile.file_name,
        downloadUrl: urlData.signedUrl,
        fileSize: fileBuffer.length,
        storagePath: savedPath,
        status: 'completed'
      }
    })

  } catch (error: any) {
    console.error('❌ Download file API fel:', error)

    return res.status(500).json({ 
      success: false,
      error: 'Internt serverfel vid nedladdning av fil',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}