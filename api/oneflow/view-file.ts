// api/oneflow/view-file.ts - Visa fil i webbläsaren utan att markera som nedladdad
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

// Interface för view request
interface ViewRequest {
  contractId: string
  fileId: string
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Skapa temporär view-länk från OneFlow
const createViewLink = async (oneflowContractId: string, oneflowFileId: number): Promise<string | null> => {
  try {
    console.log('👁️ Skapar view-länk för OneFlow fil:', oneflowContractId, oneflowFileId)

    // Hämta fil-metadata från OneFlow
    const response = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${oneflowFileId}`,
      {
        method: 'GET',
        headers: {
          'x-oneflow-api-token': ONEFLOW_API_TOKEN,
          'x-oneflow-user-email': 'info@begone.se',
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('❌ OneFlow File API-fel:', response.status, response.statusText)
      return null
    }

    const fileData = await response.json()
    
    // OneFlow returnerar ofta en direktlänk i file object
    if (fileData.download_url) {
      console.log('✅ OneFlow view-länk skapad')
      return fileData.download_url
    }

    // Fallback: skapa view-länk via download-endpoint
    const downloadResponse = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${oneflowFileId}?download=true`,
      {
        method: 'GET',
        headers: {
          'x-oneflow-api-token': ONEFLOW_API_TOKEN,
          'x-oneflow-user-email': 'info@begone.se'
        },
        redirect: 'manual' // Få redirect-URL utan att följa den
      }
    )

    // Om vi får en redirect, använd den URL:en
    if (downloadResponse.status >= 300 && downloadResponse.status < 400) {
      const redirectUrl = downloadResponse.headers.get('location')
      if (redirectUrl) {
        console.log('✅ OneFlow redirect view-länk skapad')
        return redirectUrl
      }
    }

    console.warn('⚠️ Kunde inte skapa view-länk från OneFlow')
    return null

  } catch (error: any) {
    console.error('💥 Fel vid skapande av view-länk:', error)
    return null
  }
}

// Huvudfunktion
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res)

  // Hantera OPTIONS request för CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera endast POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Endast POST-anrop tillåtna'
    })
  }

  try {
    const { contractId, fileId }: ViewRequest = req.body

    if (!contractId || !fileId) {
      return res.status(400).json({
        success: false,
        error: 'contractId och fileId krävs'
      })
    }

    console.log('👁️ View file request:', contractId, fileId)

    // 1. Hämta fil-information från databas
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

    // 2. Skapa view-länk från OneFlow
    const viewUrl = await createViewLink(
      (contractFile.contracts as any).oneflow_contract_id,
      contractFile.oneflow_file_id
    )

    if (!viewUrl) {
      return res.status(500).json({
        success: false,
        error: 'Kunde inte skapa view-länk från OneFlow'
      })
    }

    console.log('✅ View-länk skapad framgångsrikt')
    
    return res.status(200).json({
      success: true,
      data: {
        fileId: contractFile.id,
        fileName: contractFile.file_name,
        viewUrl: viewUrl,
        fileType: contractFile.file_type,
        message: 'View-länk skapad (fil markeras INTE som nedladdad)'
      }
    })

  } catch (error: any) {
    console.error('❌ View file API fel:', error)

    return res.status(500).json({
      success: false,
      error: 'Internt serverfel vid skapande av view-länk',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}