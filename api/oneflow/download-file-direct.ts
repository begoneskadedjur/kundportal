// api/oneflow/download-file-direct.ts - Direkt nedladdning med rätta headers
import { logMissingAuth, requireAuth } from '../_lib/auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Interface för direct download request
interface DirectDownloadRequest {
  contractId: string
  fileId: string
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  logMissingAuth(req, 'oneflow/download-file-direct')
  setCorsHeaders(res)

  // Hantera OPTIONS request för CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera både POST och GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Endast POST- och GET-anrop tillåtna'
    })
  }

  // Guard etapp 4 (docs/sakerhetsplan-api-auth-vag2.md)
  const auth = await requireAuth(req, res, ['admin', 'koordinator', 'säljare'])
  if (!auth) return

  try {
    let contractId: string
    let fileId: string

    // Hantera både POST body och GET query params
    if (req.method === 'POST') {
      ({ contractId, fileId } = req.body as DirectDownloadRequest)
    } else {
      contractId = req.query.contractId as string
      fileId = req.query.fileId as string
    }

    if (!contractId || !fileId) {
      return res.status(400).json({
        success: false,
        error: 'contractId och fileId krävs'
      })
    }

    console.log('⬇️ Direct download request för fil:', fileId, 'i kontrakt:', contractId)
    
    // 🔧 DEBUG: Logga request headers för felsökning
    console.log('📋 Request headers:', {
      'user-agent': req.headers['user-agent'],
      'accept': req.headers['accept'],
      'accept-encoding': req.headers['accept-encoding']
    })

    // 1. Hämta fil-metadata från vår databas
    const { data: contractFile, error: fileError } = await supabase
      .from('contract_files')
      .select(`
        *,
        contracts!inner(oneflow_contract_id)
      `)
      .eq('id', fileId)
      .eq('contract_id', contractId)
      .single()

    if (fileError || !contractFile) {
      console.error('❌ Fil hittades inte:', fileError)
      return res.status(404).json({
        success: false,
        error: 'Fil hittades inte'
      })
    }

    // 2. Kontrollera om filen finns i storage
    if (contractFile.download_status !== 'completed' || !contractFile.supabase_storage_path) {
      return res.status(404).json({
        success: false,
        error: 'Filen har inte laddats ner än. Använd vanliga download-funktionen först.'
      })
    }

    // 3. Hämta filen från Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contract-files')
      .download(contractFile.supabase_storage_path)

    if (downloadError || !fileData) {
      console.error('❌ Fel vid hämtning från storage:', downloadError)
      return res.status(500).json({
        success: false,
        error: 'Kunde inte hämta fil från storage'
      })
    }

    // 4. Sätt headers för nedladdning (detta är nyckeln!)
    let fileName = contractFile.file_name
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'pdf'
    
    // 🔧 FIX: Säkerställ att PDF-filer har .pdf extension för korrekt filtyp i OS
    if (fileExtension !== 'pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
      // Om filen inte har extension eller fel extension, lägg till .pdf
      fileName = fileName.includes('.') ? fileName.replace(/\.[^.]*$/, '.pdf') : `${fileName}.pdf`
      console.log(`🔧 Korrigerat filnamn: ${contractFile.file_name} → ${fileName}`)
    }
    
    // 🔧 FIX: Använd korrekt Content-Type för att visa rätt filtyp men trigga nedladdning via Content-Disposition
    let contentType = 'application/octet-stream' // Default fallback
    if (fileExtension === 'pdf') {
      contentType = 'application/pdf' // Korrekt för PDF-filer så de visas som PDF
    } else if (fileExtension === 'doc' || fileExtension === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    // KRITISKA HEADERS för nedladdning:
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`) // 🔑 Detta triggar nedladdning
    res.setHeader('Content-Length', fileData.size.toString()) // 🔧 FIX: Explicit toString()
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Accept-Ranges', 'bytes') // 🔧 FIX: Stöd för partial content

    console.log('✅ Skickar fil för nedladdning:', fileName, `(${fileData.size} bytes)`)

    // 5. 🔧 FIX: Streama filen direkt utan buffer-konvertering för att förhindra korruption
    try {
      // Använd direkta stream istället för buffer-konvertering som kan korruptera data
      const arrayBuffer = await fileData.arrayBuffer()
      
      // 🔧 FIX: Validera data-integritet
      if (arrayBuffer.byteLength !== fileData.size) {
        console.error('❌ Data size mismatch:', {
          expected: fileData.size,
          actual: arrayBuffer.byteLength
        })
        throw new Error('Fil-data korrupted: storleksskillnad upptäckt')
      }
      
      // Skicka som UInt8Array direkt för att behålla binär integritet
      const uint8Array = new Uint8Array(arrayBuffer)
      const finalBuffer = Buffer.from(uint8Array)
      
      // 🔧 DEBUG: Logga final buffer stats för felsökning
      console.log('📊 Buffer stats före sändning:', {
        originalSize: fileData.size,
        arrayBufferSize: arrayBuffer.byteLength,
        uint8ArraySize: uint8Array.length,
        finalBufferSize: finalBuffer.length,
        allSizesMatch: fileData.size === arrayBuffer.byteLength && 
                      arrayBuffer.byteLength === uint8Array.length && 
                      uint8Array.length === finalBuffer.length
      })
      
      res.status(200).send(finalBuffer)
      
    } catch (streamError) {
      console.error('❌ Fel vid streaming av fil:', streamError)
      throw new Error('Kunde inte streama fil-data korrekt')
    }

  } catch (error: any) {
    console.error('❌ Direct download API fel:', error)

    return res.status(500).json({
      success: false,
      error: 'Internt serverfel vid direktnedladdning',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}