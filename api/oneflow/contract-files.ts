// api/oneflow/contract-files.ts - Lista filer för ett OneFlow kontrakt
import { logMissingAuth, requireAuth } from '../_lib/auth'
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

// Interface för OneFlow file
interface OneFlowFile {
  id: number
  name: string
  type: 'contract' | 'verification' | 'attachment' | 'pdf'
  extension: string
}

// Interface för OneFlow files API response
interface OneFlowFilesResponse {
  data: OneFlowFile[]
  count: number
  _links?: {
    next?: { href: string }
    previous?: { href: string }
    self?: { href: string }
  }
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Hämta filer från OneFlow API
const fetchOneFlowFiles = async (oneflowContractId: string): Promise<OneFlowFilesResponse | null> => {
  try {
    console.log('🔍 Hämtar filer från OneFlow API för kontrakt:', oneflowContractId)

    const response = await fetch(`https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/`, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': 'info@begone.se',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      // Om kontraktet inte finns (404), returnera tomt resultat istället för fel
      if (response.status === 404) {
        console.log('⚠️ Kontrakt finns inte längre i OneFlow (404) - returnerar tomt resultat')
        return {
          data: [],
          count: 0
        }
      }
      
      console.error('❌ OneFlow Files API-fel:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Error response:', errorText)
      return null
    }

    const filesData = await response.json() as OneFlowFilesResponse
    console.log('✅ Filer hämtade från OneFlow:', filesData.count)
    
    return filesData

  } catch (error) {
    console.error('💥 Fel vid hämtning av filer från OneFlow:', error)
    return null
  }
}

// Synka filer till vår databas
const syncFilesToDatabase = async (contractId: string, oneflowFiles: OneFlowFile[]): Promise<void> => {
  try {
    console.log('🔄 Synkar filer till databas för kontrakt:', contractId)

    // Hämta befintliga filer för att undvika dubbletter
    const { data: existingFiles, error: fetchError } = await supabase
      .from('contract_files')
      .select('oneflow_file_id')
      .eq('contract_id', contractId)

    if (fetchError) {
      console.error('❌ Fel vid hämtning av befintliga filer:', fetchError)
      return
    }

    const existingFileIds = existingFiles?.map(f => f.oneflow_file_id) || []

    // Filtrera bort filer som redan existerar
    const newFiles = oneflowFiles.filter(file => !existingFileIds.includes(file.id))

    if (newFiles.length === 0) {
      console.log('✅ Inga nya filer att synka')
      return
    }

    // Skapa fil-records i databasen
    const filesToInsert = newFiles.map(file => ({
      contract_id: contractId,
      oneflow_file_id: file.id,
      file_name: file.name,
      file_type: file.type,
      file_extension: file.extension,
      download_status: 'pending' as const
    }))

    const { error: insertError } = await supabase
      .from('contract_files')
      .insert(filesToInsert)

    if (insertError) {
      console.error('❌ Fel vid insättning av filer:', insertError)
      return
    }

    console.log('✅ Synkat', newFiles.length, 'nya filer till databas')

  } catch (error) {
    console.error('💥 Fel vid synkning av filer till databas:', error)
  }
}

// Huvudfunktion
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  logMissingAuth(req, 'oneflow/contract-files')
  setCorsHeaders(res)

  // Hantera OPTIONS request för CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera endast GET
  if (req.method !== 'GET') {
    console.error('❌ Icke-GET request mottaget:', req.method)
    return res.status(405).json({ 
      success: false,
      error: 'Endast GET-anrop tillåtna' 
    })
  }

  // Guard etapp 4 (docs/sakerhetsplan-api-auth-vag2.md)
  const auth = await requireAuth(req, res, ['admin', 'koordinator', 'säljare'])
  if (!auth) return

  try {
    // Hämta kontrakt-ID från query parameters
    const { contractId } = req.query

    if (!contractId || typeof contractId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'contractId parameter krävs'
      })
    }

    console.log('📋 Contract files API anrop för kontrakt:', contractId)

    // 1. Hämta kontraktet från vår databas för att få OneFlow ID
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('oneflow_contract_id')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      console.error('❌ Kontrakt hittades inte:', contractError)
      return res.status(404).json({
        success: false,
        error: 'Kontrakt hittades inte'
      })
    }

    // 2. Hämta filer från OneFlow API
    const oneflowFiles = await fetchOneFlowFiles(contract.oneflow_contract_id)

    // Om OneFlow returnerar null (inte 404), är det ett verkligt fel
    if (oneflowFiles === null) {
      console.error('❌ Allvarligt fel vid hämtning från OneFlow')
      return res.status(500).json({
        success: false,
        error: 'Kunde inte hämta filer från OneFlow'
      })
    }

    // 3. Synka filer till vår databas (bara om vi har några filer)
    if (oneflowFiles.data && oneflowFiles.data.length > 0) {
      await syncFilesToDatabase(contractId, oneflowFiles.data)
    }

    // 4. Hämta uppdaterad fillista från vår databas
    const { data: contractFiles, error: filesError } = await supabase
      .from('contract_files')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: true })

    if (filesError) {
      console.error('❌ Fel vid hämtning av contract files:', filesError)
      return res.status(500).json({
        success: false,
        error: 'Kunde inte hämta filer från databas'
      })
    }

    console.log('✅ Contract files API framgångsrik')
    
    return res.status(200).json({
      success: true,
      data: {
        oneflowFiles: oneflowFiles.data,
        contractFiles: contractFiles || [],
        totalFiles: oneflowFiles.count
      }
    })

  } catch (error: any) {
    console.error('❌ Contract files API fel:', error)

    return res.status(500).json({ 
      success: false,
      error: 'Internt serverfel vid hämtning av filer',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}