// api/oneflow/diagnostics.ts - Förbättrad Oneflow Diagnostik och Testing API
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// Centraliserad funktion för Oneflow API-anrop
const oneflowFetch = async (endpoint: string, token: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
  const API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1'
  const url = `${API_URL}${endpoint}`
  
  console.log(`🔍 Anropar Oneflow: ${method} ${url}`)
  
  const options: any = {
    method,
    headers: {
      'x-oneflow-api-token': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }

  if (body && method === 'POST') {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Oneflow API fel (${response.status}): ${errorText}`)
    throw new Error(`Oneflow API Error: ${response.status} - ${errorText}`)
  }
  
  console.log(`✅ Framgångsrikt svar från ${endpoint}`)
  return response.json()
}

// Validera miljövariabler
const validateEnvironment = () => {
  const token = process.env.ONEFLOW_API_TOKEN
  const userEmail = 'info@begone.se' // Centraliserad avsändare
  const workspaceId = process.env.ONEFLOW_WORKSPACE_ID

  if (!token) {
    throw new Error('ONEFLOW_API_TOKEN miljövariabel saknas')
  }

  return { token, userEmail, workspaceId }
}

// Hämta alla arbetsytor
const getWorkspaces = async (token: string) => {
  console.log('🏢 Hämtar arbetsytor...')
  const data = await oneflowFetch('/workspaces', token)
  
  const workspaces = data.data.map((ws: any) => ({
    id: ws.id,
    name: ws.name,
    is_default: ws.is_default || false
  }))

  return {
    count: workspaces.length,
    workspaces,
    recommendation: workspaces.length > 0 
      ? `Använd ID ${workspaces[0].id} som ONEFLOW_WORKSPACE_ID` 
      : 'Inga arbetsytor hittades'
  }
}

// Analysera kontrakt
const analyzeContract = async (contractId: string, token: string) => {
  console.log(`📋 Analyserar kontrakt ${contractId}...`)
  const data = await oneflowFetch(`/contracts/${contractId}`, token)
  
  return {
    contract_info: {
      id: data.id,
      name: data.name,
      state: data.state,
      created_time: data.created_time
    },
    participants: data.participants?.map((p: any) => ({
      name: p.name,
      email: p.email,
      company_name: p.company_name,
      signatory: p.signatory
    })) || [],
    data_fields: data.data_fields?.map((df: any) => ({
      custom_id: df.custom_id,
      value: df.value,
      type: df.type
    })) || [],
    parties: data.parties?.map((party: any) => ({
      type: party.type,
      name: party.name,
      identification_number: party.identification_number
    })) || []
  }
}

// Analysera mall med test-skapande
const analyzeTemplate = async (templateId: string, token: string, userEmail?: string, workspaceId?: string) => {
  console.log(`📄 Analyserar mall ${templateId}...`)
  
  // Hämta basic template info
  const templateData = await oneflowFetch(`/templates/${templateId}`, token)
  
  const basicInfo = {
    id: templateData.id,
    name: templateData.name,
    state: templateData.state,
    workspace_id: templateData.workspace_id
  }

  const dataFields = templateData.data_fields?.map((df: any) => ({
    key: df.key,
    name: df.name,
    type: df.type,
    required: df.required || false
  })) || []

  // Försök skapa test-kontrakt om vi har userEmail och workspaceId
  let testResult = null
  if (userEmail && workspaceId) {
    try {
      console.log('🧪 Skapar test-kontrakt för att analysera fält-krav...')
      
      const testPayload = {
        workspace_id: parseInt(workspaceId),
        template_id: parseInt(templateId),
        parties: [
          {
            type: 'company',
            name: 'Test Företag AB',
            identification_number: '556123-4567',
            participants: [
              {
                name: 'Test Person',
                email: 'test@example.com',
                _permissions: { 'contract:update': false },
                signatory: false,
                delivery_channel: 'email'
              }
            ]
          }
        ]
        // Inga data_fields för att se vad som händer
      }

      const createResponse = await fetch('https://api.oneflow.com/v1/contracts/create', {
        method: 'POST',
        headers: {
          'x-oneflow-api-token': token,
          'x-oneflow-user-email': 'info@begone.se',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      })

      if (createResponse.ok) {
        const contractData = await createResponse.json()
        console.log('✅ Test-kontrakt skapat:', contractData.id)
        
        // Ta bort test-kontraktet
        try {
          await oneflowFetch(`/contracts/${contractData.id}`, token, 'DELETE')
          console.log('🗑️ Test-kontrakt borttaget')
        } catch (deleteError) {
          console.log('⚠️ Kunde inte ta bort test-kontrakt')
        }

        testResult = {
          success: true,
          message: 'Mall fungerar utan data fields',
          contract_id: contractData.id
        }
      } else {
        const errorData = await createResponse.json()
        console.log('📝 Test-kontrakt fel (förväntat):', errorData)

        // Analysera fel för att hitta required fields
        let requiredFields: string[] = []
        if (errorData.parameter_problems) {
          Object.entries(errorData.parameter_problems).forEach(([key, value]) => {
            if (key.includes('data_fields') && Array.isArray(value)) {
              (value as string[]).forEach(msg => {
                const match = msg.match(/Required field '([^']+)'/i)
                if (match) {
                  requiredFields.push(match[1])
                }
              })
            }
          })
        }

        testResult = {
          success: false,
          message: 'Mall kräver data fields',
          required_fields: requiredFields,
          error_details: errorData
        }
      }
    } catch (testError: any) {
      console.error('❌ Test-kontrakt fel:', testError)
      testResult = {
        success: false,
        message: 'Kunde inte testa mall',
        error: testError.message
      }
    }
  }

  return {
    template: basicInfo,
    data_fields: dataFields,
    test_result: testResult,
    recommendation: testResult?.success 
      ? 'Mall är redo att användas!'
      : testResult?.required_fields?.length 
        ? `Mall kräver följande fält: ${testResult.required_fields.join(', ')}`
        : 'Kontrollera mallens inställningar i Oneflow'
  }
}

// Huvudfunktion
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res)

  // Hantera OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera endast GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Endast GET-anrop tillåtna'
    })
  }

  try {
    console.log('🔧 Oneflow diagnostik startad')

    // Validera miljövariabler
    const { token, userEmail, workspaceId } = validateEnvironment()

    // Hämta query parametrar
    const { mode, contractId, templateId } = req.query

    switch (mode) {
      case 'workspaces':
        const workspacesResult = await getWorkspaces(token)
        return res.status(200).json({
          success: true,
          mode: 'workspaces',
          result: workspacesResult
        })

      case 'contract':
        if (!contractId) {
          return res.status(400).json({
            success: false,
            error: 'contractId parameter krävs för contract-läge'
          })
        }
        const contractResult = await analyzeContract(contractId as string, token)
        return res.status(200).json({
          success: true,
          mode: 'contract',
          contract_id: contractId,
          result: contractResult
        })

      case 'template':
        if (!templateId) {
          return res.status(400).json({
            success: false,
            error: 'templateId parameter krävs för template-läge'
          })
        }
        const templateResult = await analyzeTemplate(
          templateId as string, 
          token, 
          userEmail, 
          workspaceId
        )
        return res.status(200).json({
          success: true,
          mode: 'template',
          template_id: templateId,
          result: templateResult
        })

      case 'health':
        // Enkel health check
        const healthData = await oneflowFetch('/workspaces', token)
        return res.status(200).json({
          success: true,
          mode: 'health',
          result: {
            api_connection: 'OK',
            token_valid: true,
            workspaces_accessible: healthData.data.length > 0,
            environment: {
              has_token: !!token,
              has_user_email: !!userEmail,
              has_workspace_id: !!workspaceId
            }
          }
        })

      default:
        return res.status(400).json({
          success: false,
          error: 'Ogiltig mode parameter',
          available_modes: {
            workspaces: 'Lista alla arbetsytor (?mode=workspaces)',
            contract: 'Analysera kontrakt (?mode=contract&contractId=123)',
            template: 'Analysera mall (?mode=template&templateId=456)',
            health: 'API health check (?mode=health)'
          },
          examples: [
            '/api/oneflow/diagnostics?mode=workspaces',
            '/api/oneflow/diagnostics?mode=template&templateId=8486368',
            '/api/oneflow/diagnostics?mode=health'
          ]
        })
    }

  } catch (error: any) {
    console.error('❌ Diagnostik fel:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Diagnostik misslyckades',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}